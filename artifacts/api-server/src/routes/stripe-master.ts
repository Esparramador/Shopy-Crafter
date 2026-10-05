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
import { monthlyAmount, sanitizeMetadata, type Interval } from "../lib/stripe-commerce.js";
import { getPlatformStripe, saveDirectApiKey, resolveStripeForProject, getStripeConnection, unlinkStripeForProject } from "../lib/stripe-tenant.js";

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
        p.platform_type,
        p.shop_domain,
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
    sendStripeError(res, err, "Error guardando clave");
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
    sendStripeError(res, err, "Error rotando clave");
  }
});

// ── DELETE /admin/stripe/accounts/:projectId ─────────────────────────────────
router.delete("/admin/stripe/accounts/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    // Mismo camino que DELETE /admin/stripe/project/:id/link: borrar stripe_accounts Y limpiar
    // projects.client_secret, si no ensureStripeAccountForProject() volvería a auto-vincular la clave.
    const removed = await unlinkStripeForProject(projectId);
    const db = await getDb();
    await db.execute(sql`UPDATE projects SET client_secret = '', updated_at = NOW() WHERE id = ${projectId} AND platform_type = 'stripe'`);
    res.json({ success: true, removed, message: "Cuenta Stripe desvinculada" });
  } catch (err: any) {
    sendStripeError(res, err, "Error desvinculando cuenta");
  }
});

// ── GET /admin/stripe/balance/:projectId ─────────────────────────────────────
// Balance en tiempo real del proyecto (cualquier modo)
router.get("/admin/stripe/balance/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const { stripe, mode } = await resolveProject(projectId);

    const balance = await stripe.balance.retrieve();
    const available = balance.available.reduce((s, b) => s + b.amount, 0);
    const pending   = balance.pending.reduce((s, b) => s + b.amount, 0);
    const currency  = balance.available[0]?.currency ?? "eur";

    res.json({ available, pending, currency, mode });
  } catch (err: any) {
    sendStripeError(res, err, "Error obteniendo balance");
  }
});

// ── GET /admin/stripe/transactions/:projectId ────────────────────────────────
router.get("/admin/stripe/transactions/:projectId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const { stripe } = await resolveProject(projectId);

    const charges = await stripe.charges.list({ limit });
    res.json({ charges: charges.data, hasMore: charges.has_more });
  } catch (err: any) {
    sendStripeError(res, err, "Error obteniendo transacciones");
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

    const { stripe, mode } = await resolveProject(projectId);

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
    sendStripeError(res, err, "Error creando PaymentIntent");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PROJECT-SCOPED STRIPE ROUTES  /admin/stripe/project/:projectId/*
// Todas usan resolveStripeForProject → no necesitan accountId externo
// ════════════════════════════════════════════════════════════════════════════

/** Resolución ESTRICTA: un proyecto Stripe sin cuenta vinculada devuelve 409, nunca datos de la cuenta Master. */
async function resolveProject(projectId: number) {
  return resolveStripeForProject(projectId, { strict: true });
}

function sendStripeError(res: Response, err: any, fallback = "Error") {
  const status = Number(err?.statusCode) || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: err?.message ?? fallback,
    code: err?.code,
  });
}

// GET /admin/stripe/project/:id/connection ───────────────────────────────────
// Estado de la vinculación (para cabecera del Hub y el chatbot). Nunca lanza.
router.get("/admin/stripe/project/:id/connection", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const pid = parseInt(String(req.params.id), 10);
  res.json(await getStripeConnection(pid));
});

// POST /admin/stripe/project/:id/link ────────────────────────────────────────
// Vincular / sustituir la clave secreta del proyecto desde el Hub.
router.post("/admin/stripe/project/:id/link", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const { secretKey, publishableKey } = req.body as any;
    if (!secretKey) { res.status(400).json({ error: "secretKey requerido" }); return; }
    const result = await saveDirectApiKey(pid, String(secretKey), publishableKey ? String(publishableKey) : undefined);
    // Mantener projects.client_secret coherente con la clave activa
    const db = await getDb();
    await db.execute(sql`UPDATE projects SET client_secret = ${encrypt(String(secretKey).trim())}, updated_at = NOW() WHERE id = ${pid} AND platform_type = 'stripe'`);
    res.json({ success: true, ...result, connection: await getStripeConnection(pid) });
  } catch (err: any) {
    sendStripeError(res, err, "Error vinculando cuenta Stripe");
  }
});

// DELETE /admin/stripe/project/:id/link ──────────────────────────────────────
router.delete("/admin/stripe/project/:id/link", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const removed = await unlinkStripeForProject(pid);
    const db = await getDb();
    await db.execute(sql`UPDATE projects SET client_secret = '', updated_at = NOW() WHERE id = ${pid} AND platform_type = 'stripe'`);
    res.json({ success: true, removed });
  } catch (err: any) {
    sendStripeError(res, err, "Error desvinculando cuenta Stripe");
  }
});

// GET /admin/stripe/project/:id/overview ─────────────────────────────────────
router.get("/admin/stripe/project/:id/overview", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const connection = await getStripeConnection(pid);
    if (!connection.connected) {
      res.json({ connected: false, connection, mode: null, balance: null, volume30: 0, count30: 0, aov: 0, trend: 0, mrr: 0, activeSubCount: 0, customerCount: 0, dailyChart: [], recentCharges: [] });
      return;
    }
    const { stripe, mode } = await resolveProject(pid);

    const now = Math.floor(Date.now() / 1000);
    const d30 = now - 30 * 86400;
    const d60 = d30 - 30 * 86400;
    // Paginación completa (con tope) para que volumen y MRR no dependan de los 50 últimos objetos.
    const [balance, charges, customers, subs] = await Promise.allSettled([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 100, created: { gte: d60 } }).autoPagingToArray({ limit: 5000 }),
      stripe.customers.list({ limit: 100 }).autoPagingToArray({ limit: 5000 }),
      stripe.subscriptions.list({ limit: 100, status: "all" }).autoPagingToArray({ limit: 5000 }),
    ]);
    const warnings = [balance, charges, customers, subs]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map(r => String(r.reason?.message ?? r.reason));

    const bal = balance.status === "fulfilled" ? balance.value : null;
    const chList = charges.status === "fulfilled" ? charges.value : [];
    const cuList = customers.status === "fulfilled" ? customers.value : [];
    const suList = subs.status === "fulfilled" ? subs.value : [];

    // Ventas netas: cobros correctos menos lo devuelto.
    const net = (c: Stripe.Charge) => c.amount - (c.amount_refunded ?? 0);
    const recent30 = chList.filter(c => c.created >= d30 && c.status === "succeeded");
    const volume30 = recent30.reduce((s, c) => s + net(c), 0);
    const count30 = recent30.length;
    const aov = count30 > 0 ? volume30 / count30 : 0;
    const prevVol = chList.filter(c => c.created >= d60 && c.created < d30 && c.status === "succeeded").reduce((s, c) => s + net(c), 0);
    const trend = prevVol > 0 ? ((volume30 - prevVol) / prevVol) * 100 : 0;

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) dailyMap[new Date((d30 + i * 86400) * 1000).toISOString().slice(0, 10)] = 0;
    for (const c of recent30) {
      const key = new Date(c.created * 1000).toISOString().slice(0, 10);
      if (key in dailyMap) dailyMap[key] += net(c);
    }
    const dailyChart = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

    // MRR como Stripe: suscripciones activas o con pago pendiente (no las de prueba),
    // todas las líneas, con cantidad y periodicidad normalizadas a un mes.
    const mrrSubs = suList.filter(s => s.status === "active" || s.status === "past_due");
    const mrr = Math.round(mrrSubs.reduce((sum, sub) => sum + (sub.items?.data ?? []).reduce((acc, it) => acc + monthlyAmount({
      unitAmount: it.price?.unit_amount ?? null,
      quantity: it.quantity ?? 1,
      interval: (it.price?.recurring?.interval ?? null) as Interval | null,
      intervalCount: it.price?.recurring?.interval_count ?? null,
    }), 0), 0));
    const activeSubCount = suList.filter(s => s.status === "active" || s.status === "trialing" || s.status === "past_due").length;

    res.json({
      connected: true,
      connection,
      mode,
      balance: bal ? {
        available: bal.available.reduce((s, b) => s + b.amount, 0),
        pending:   bal.pending.reduce((s, b) => s + b.amount, 0),
        currency:  bal.available[0]?.currency ?? "eur",
      } : null,
      volume30, count30, aov, trend, mrr, activeSubCount,
      trialingCount: suList.filter(s => s.status === "trialing").length,
      pastDueCount: suList.filter(s => s.status === "past_due").length,
      customerCount: cuList.length,
      customerCountCapped: cuList.length >= 5000,
      dailyChart,
      warnings,
      recentCharges: [...chList].sort((x, y) => y.created - x.created).slice(0, 8).map(c => ({
        id: c.id, amount: c.amount, currency: c.currency,
        status: c.refunded ? "refunded" : c.status, description: c.description,
        created: c.created, customer: c.customer,
        receiptEmail: c.receipt_email,
      })),
    });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// GET /admin/stripe/project/:id/transactions ──────────────────────────────────
router.get("/admin/stripe/project/:id/transactions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
    const { stripe } = await resolveProject(pid);
    const charges = await stripe.charges.list({ limit });
    res.json({ data: charges.data.map(c => ({
      id: c.id, amount: c.amount, currency: c.currency, status: c.status,
      description: c.description, created: c.created,
      customer: c.customer, receiptEmail: c.receipt_email,
      refunded: c.refunded, disputed: c.disputed,
      paymentMethod: (c as any).payment_method_details?.type ?? "card",
    })), hasMore: charges.has_more });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// GET /admin/stripe/project/:id/customers ─────────────────────────────────────
router.get("/admin/stripe/project/:id/customers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
    const { stripe } = await resolveProject(pid);
    const customers = await stripe.customers.list({ limit, expand: ["data.subscriptions"] });
    const data = customers.data.map(c => ({
      id: c.id, email: c.email, name: c.name, created: c.created,
      currency: c.currency, balance: c.balance,
      subscriptionCount: (c as any).subscriptions?.total_count ?? 0,
      delinquent: c.delinquent,
      metadata: c.metadata,
    }));
    res.json({ data, hasMore: customers.has_more });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// POST /admin/stripe/project/:id/customers ────────────────────────────────────
router.post("/admin/stripe/project/:id/customers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const { email, name, phone, description, metadata } = req.body as any;
    if (!email) { res.status(400).json({ error: "email requerido" }); return; }
    const { stripe } = await resolveProject(pid);
    const customer = await stripe.customers.create({ email, name, phone, description, metadata: { ...sanitizeMetadata(metadata), sc_project_id: String(pid) } });
    res.json({ customer });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// GET /admin/stripe/project/:id/subscriptions ─────────────────────────────────
router.get("/admin/stripe/project/:id/subscriptions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
    const status = (req.query.status as string) || undefined;
    const { stripe } = await resolveProject(pid);
    const params: any = { limit, expand: ["data.customer", "data.default_payment_method"] };
    if (status && status !== "all") params.status = status;
    const subs = await stripe.subscriptions.list(params);
    // price.product llega como id (expandirlo supera el límite de 4 niveles): nombres en una sola consulta.
    const productIds = [...new Set(subs.data.flatMap(s => (s.items?.data ?? []).map(it => String(it.price?.product ?? "")).filter(Boolean)))];
    const names = new Map<string, string>();
    for (let i = 0; i < productIds.length; i += 100) {
      const page = await stripe.products.list({ ids: productIds.slice(i, i + 100), limit: 100 });
      for (const p of page.data) names.set(p.id, p.name);
    }
    const data = subs.data.map(s => {
      const item = s.items?.data?.[0];
      const price = item?.price;
      return {
        id: s.id, status: s.status, created: s.created,
        currentPeriodEnd: (s as any).current_period_end ?? item?.current_period_end ?? null,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        customer: typeof s.customer === "string" ? { id: s.customer } : { id: (s.customer as any).id, email: (s.customer as any).email, name: (s.customer as any).name },
        priceAmount: price?.unit_amount ?? 0,
        priceCurrency: price?.currency ?? "eur",
        priceInterval: price?.recurring?.interval ?? "month",
        productName: (s.items?.data ?? []).map(it => names.get(String(it.price?.product ?? "")) ?? it.price?.nickname ?? "—").join(" + "),
        priceIntervalCount: price?.recurring?.interval_count ?? 1,
        quantity: item?.quantity ?? 1,
        itemCount: s.items?.data?.length ?? 0,
        metadata: s.metadata,
        trialEnd: s.trial_end,
      };
    });
    res.json({ data, hasMore: subs.has_more });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// DELETE /admin/stripe/project/:id/subscriptions/:subId ───────────────────────
router.delete("/admin/stripe/project/:id/subscriptions/:subId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const { stripe } = await resolveProject(pid);
    const sub = await stripe.subscriptions.cancel(String(req.params.subId));
    res.json({ status: sub.status });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// GET /admin/stripe/project/:id/invoices ──────────────────────────────────────
router.get("/admin/stripe/project/:id/invoices", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
    const { stripe } = await resolveProject(pid);
    const invoices = await stripe.invoices.list({ limit, expand: ["data.customer"] });
    const data = invoices.data.map(inv => ({
      id: inv.id, number: inv.number, status: inv.status,
      amountDue: inv.amount_due, amountPaid: inv.amount_paid,
      currency: inv.currency, created: inv.created, dueDate: inv.due_date,
      customerEmail: inv.customer_email,
      customerName: typeof inv.customer === "object" ? (inv.customer as any)?.name : null,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));
    res.json({ data, hasMore: invoices.has_more });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// POST /admin/stripe/project/:id/invoices/:invId/send ─────────────────────────
router.post("/admin/stripe/project/:id/invoices/:invId/send", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const { stripe } = await resolveProject(pid);
    const inv = await stripe.invoices.sendInvoice(String(req.params.invId));
    res.json({ status: inv.status });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// POST /admin/stripe/project/:id/invoices/:invId/void ─────────────────────────
router.post("/admin/stripe/project/:id/invoices/:invId/void", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const { stripe } = await resolveProject(pid);
    const inv = await stripe.invoices.voidInvoice(String(req.params.invId));
    res.json({ status: inv.status });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// GET /admin/stripe/project/:id/payouts ───────────────────────────────────────
router.get("/admin/stripe/project/:id/payouts", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(String(req.params.id), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 50);
    const { stripe } = await resolveProject(pid);
    const [payouts, balance] = await Promise.all([
      stripe.payouts.list({ limit }),
      stripe.balance.retrieve(),
    ]);
    res.json({
      data: payouts.data.map(p => ({
        id: p.id, amount: p.amount, currency: p.currency, status: p.status,
        created: p.created, arrivalDate: p.arrival_date,
        description: p.description, method: p.method,
      })),
      hasMore: payouts.has_more,
      balance: {
        available: balance.available.reduce((s, b) => s + b.amount, 0),
        pending:   balance.pending.reduce((s, b) => s + b.amount, 0),
        currency:  balance.available[0]?.currency ?? "eur",
      },
    });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

// Productos, precios, enlaces de pago, cupones, alta de suscripciones, facturas,
// pagos y devoluciones del proyecto: routes/stripe-commerce.ts

export default router;
