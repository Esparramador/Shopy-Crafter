/**
 * stripe-master.ts — God Mode: Account Factory + Master Admin API
 * ─────────────────────────────────────────────────────────────────────────────
 * Rutas exclusivas para el Super-Admin / Agencia:
 *   GET  /admin/stripe/master-overview        → todos los proyectos + estado Stripe
 *   POST /admin/stripe/create-account         → Account Factory (Connect Custom)
 *   POST /admin/stripe/assign-key             → The Vault (clave API directa)
 *   POST /admin/stripe/rotate-key/:projectId  → Re-encriptar clave
 *   DEL  /admin/stripe/accounts/:projectId    → Desvincular cuenta
 *   GET  /admin/stripe/balance/:projectId     → Balance en tiempo real
 */

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { encrypt, safeDecrypt } from "../lib/crypto.js";
import { getPlatformStripe, saveDirectApiKey } from "../lib/stripe-tenant.js";

const router = Router();

async function getDb() {
  const { db } = await import("@workspace/db");
  return db;
}

// ── Ensure stripe_key_enc column exists ──────────────────────────────────────
async function ensureVaultColumn(): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(sql`
      ALTER TABLE stripe_accounts ADD COLUMN IF NOT EXISTS stripe_key_enc TEXT
    `);
  } catch (_) {}
}
ensureVaultColumn();

// ── GET /admin/stripe/master-overview ────────────────────────────────────────
// Devuelve todos los proyectos con su estado Stripe
router.get("/admin/stripe/master-overview", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();

    const projects = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p."platformType" AS platform_type,
        p."shopDomain"   AS shop_domain,
        p.plan,
        sa.account_id,
        sa.account_type,
        sa.display_name      AS stripe_display_name,
        sa.email             AS stripe_email,
        sa.country           AS stripe_country,
        sa.currency          AS stripe_currency,
        sa.onboarding_complete,
        sa.connected_at,
        CASE
          WHEN sa.stripe_key_enc IS NOT NULL THEN 'direct'
          WHEN sa.account_type   = 'custom'  THEN 'connect_custom'
          WHEN sa.access_token_enc IS NOT NULL THEN 'connect_oauth'
          ELSE 'none'
        END AS stripe_mode,
        CASE
          WHEN sa.stripe_key_enc IS NOT NULL
            THEN 'sk_' || SUBSTRING(sa.stripe_key_enc, 1, 8) || '••••••••'
          ELSE NULL
        END AS key_preview
      FROM projects p
      LEFT JOIN stripe_accounts sa ON sa.project_id = p.id
      ORDER BY p.id DESC
    `);

    res.json({ projects: projects.rows });
  } catch (err: any) {
    logger.error({ err }, "stripe-master: overview error");
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ── POST /admin/stripe/create-account ────────────────────────────────────────
// Account Factory — Crea una cuenta Connect Custom desde cero
router.post("/admin/stripe/create-account", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, email, country = "ES", businessType = "individual", displayName } = req.body as any;
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }

    const stripe = getPlatformStripe();

    const account = await stripe.accounts.create({
      type: "custom",
      country,
      email: email ?? undefined,
      business_type: businessType,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: { schedule: { interval: "manual" } },
      },
      metadata: {
        shopy_crafter_project_id: String(projectId),
        created_by: "shopy_crafter_master_admin",
      },
    } as any);

    const db = await getDb();
    await db.execute(sql`
      INSERT INTO stripe_accounts
        (project_id, account_id, account_type, onboarding_complete, display_name,
         email, country, currency, metadata)
      VALUES (
        ${projectId}, ${account.id}, 'custom', FALSE,
        ${displayName ?? (account as any).settings?.dashboard?.display_name ?? null},
        ${email ?? null}, ${country}, 'eur',
        ${JSON.stringify({ created_by: "factory", capabilities: ["card_payments","transfers"] })}
      )
      ON CONFLICT (account_id) DO UPDATE SET
        account_type = 'custom',
        project_id   = EXCLUDED.project_id
    `);

    logger.info({ projectId, accountId: account.id }, "✅ Stripe Custom account created");
    res.json({
      success: true,
      accountId: account.id,
      onboardingUrl: null,
      message: `Cuenta ${account.id} creada. Usa /admin/stripe/onboarding-link para generar el link de onboarding.`,
    });
  } catch (err: any) {
    logger.error({ err }, "stripe-master: create-account error");
    res.status(500).json({ error: err?.message ?? "Error al crear cuenta Stripe" });
  }
});

// ── POST /admin/stripe/onboarding-link ───────────────────────────────────────
// Genera AccountLink para completar onboarding de una cuenta Custom
router.post("/admin/stripe/onboarding-link", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId, returnUrl, refreshUrl } = req.body as any;
    if (!accountId) { res.status(400).json({ error: "accountId requerido" }); return; }

    const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
    const stripe = getPlatformStripe();

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl ?? `${appUrl}/admin/stripe-master`,
      return_url:  returnUrl  ?? `${appUrl}/admin/stripe-master`,
      type: "account_onboarding",
    });

    res.json({ url: link.url, expiresAt: link.expires_at });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error generando link" });
  }
});

// ── POST /admin/stripe/assign-key ────────────────────────────────────────────
// The Vault — Guarda la clave API secreta del cliente encriptada
router.post("/admin/stripe/assign-key", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, secretKey, publishableKey } = req.body as any;
    if (!projectId || !secretKey) {
      res.status(400).json({ error: "projectId y secretKey requeridos" });
      return;
    }

    const result = await saveDirectApiKey(Number(projectId), String(secretKey), publishableKey);
    logger.info({ projectId, accountId: result.accountId }, "✅ Direct Stripe key stored in Vault");
    res.json({
      success: true,
      accountId: result.accountId,
      displayName: result.displayName,
      email: result.email,
      mode: "direct",
      message: "Clave encriptada y guardada correctamente en el Vault",
    });
  } catch (err: any) {
    logger.error({ err }, "stripe-master: assign-key error");
    res.status(500).json({ error: err?.message ?? "Error guardando clave" });
  }
});

// ── POST /admin/stripe/rotate-key/:projectId ─────────────────────────────────
// Re-encripta la clave — útil tras rotación en Stripe Dashboard
router.post("/admin/stripe/rotate-key/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const { secretKey } = req.body as any;
    if (!secretKey) { res.status(400).json({ error: "secretKey requerido" }); return; }

    await saveDirectApiKey(projectId, secretKey);
    res.json({ success: true, message: "Clave rotada y re-encriptada correctamente" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error rotando clave" });
  }
});

// ── DELETE /admin/stripe/accounts/:projectId ─────────────────────────────────
router.delete("/admin/stripe/accounts/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const db = await getDb();
    await db.execute(sql`DELETE FROM stripe_accounts WHERE project_id = ${projectId}`);
    res.json({ success: true, message: "Cuenta Stripe desvinculada" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error desvinculando cuenta" });
  }
});

// ── GET /admin/stripe/balance/:projectId ─────────────────────────────────────
// Balance en tiempo real del proyecto (cualquier modo)
router.get("/admin/stripe/balance/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const { resolveStripeForProject } = await import("../lib/stripe-tenant.js");
    const { stripe, mode } = await resolveStripeForProject(projectId);

    const balance = await stripe.balance.retrieve();
    const available = balance.available.reduce((s, b) => s + b.amount, 0);
    const pending   = balance.pending.reduce((s, b) => s + b.amount, 0);
    const currency  = balance.available[0]?.currency ?? "eur";

    res.json({ available, pending, currency, mode });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error obteniendo balance" });
  }
});

// ── GET /admin/stripe/transactions/:projectId ────────────────────────────────
router.get("/admin/stripe/transactions/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const { resolveStripeForProject } = await import("../lib/stripe-tenant.js");
    const { stripe } = await resolveStripeForProject(projectId);

    const charges = await stripe.charges.list({ limit });
    res.json({ charges: charges.data, hasMore: charges.has_more });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error obteniendo transacciones" });
  }
});

// ── POST /admin/stripe/payment-intent ────────────────────────────────────────
// Universal Payment Intent — funciona con cualquier modo
router.post("/admin/stripe/payment-intent", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, amount, currency = "eur", description, customerEmail } = req.body as any;
    if (!projectId || !amount) {
      res.status(400).json({ error: "projectId y amount requeridos" });
      return;
    }

    const { resolveStripeForProject } = await import("../lib/stripe-tenant.js");
    const { stripe, mode } = await resolveStripeForProject(projectId);

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency,
      description,
      receipt_email: customerEmail,
      automatic_payment_methods: { enabled: true },
      metadata: {
        shopy_crafter_project_id: String(projectId),
        stripe_mode: mode,
      },
    });

    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, mode });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error creando PaymentIntent" });
  }
});

export default router;
