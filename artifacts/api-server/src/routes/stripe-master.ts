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

// ════════════════════════════════════════════════════════════════════════════
// PROJECT-SCOPED STRIPE ROUTES  /admin/stripe/project/:projectId/*
// Todas usan resolveStripeForProject → no necesitan accountId externo
// ════════════════════════════════════════════════════════════════════════════

async function resolveProject(projectId: number) {
  const { resolveStripeForProject } = await import("../lib/stripe-tenant.js");
  return resolveStripeForProject(projectId);
}

// GET /admin/stripe/project/:id/overview ─────────────────────────────────────
router.get("/admin/stripe/project/:id/overview", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { stripe, mode } = await resolveProject(pid);

    const [balance, charges, customers, subs] = await Promise.allSettled([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 50 }),
      stripe.customers.list({ limit: 10 }),
      stripe.subscriptions.list({ limit: 10 }),
    ]);

    const bal = balance.status === "fulfilled" ? balance.value : null;
    const chList = charges.status === "fulfilled" ? charges.value.data : [];
    const cuList = customers.status === "fulfilled" ? customers.value.data : [];
    const suList = subs.status === "fulfilled" ? subs.value.data : [];

    const now = Math.floor(Date.now() / 1000);
    const d30 = now - 30 * 86400;
    const recent30 = chList.filter(c => c.created >= d30 && c.status === "succeeded");
    const volume30 = recent30.reduce((s, c) => s + c.amount, 0);
    const count30 = recent30.length;
    const aov = count30 > 0 ? volume30 / count30 : 0;

    const prev30start = d30 - 30 * 86400;
    const prevCharges = chList.filter(c => c.created >= prev30start && c.created < d30 && c.status === "succeeded");
    const prevVol = prevCharges.reduce((s, c) => s + c.amount, 0);
    const trend = prevVol > 0 ? ((volume30 - prevVol) / prevVol) * 100 : 0;

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date((d30 + i * 86400) * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    for (const c of recent30) {
      const key = new Date(c.created * 1000).toISOString().slice(0, 10);
      if (key in dailyMap) dailyMap[key] += c.amount;
    }
    const dailyChart = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

    const activeSubCount = suList.filter(s => s.status === "active" || s.status === "trialing").length;
    const mrr = suList
      .filter(s => s.status === "active" || s.status === "trialing")
      .reduce((s, sub) => {
        const item = (sub.items?.data ?? [])[0];
        const price = item?.price;
        if (!price || !price.unit_amount) return s;
        const monthly = price.recurring?.interval === "year"
          ? price.unit_amount / 12
          : price.unit_amount;
        return s + monthly;
      }, 0);

    res.json({
      mode,
      balance: bal ? {
        available: bal.available.reduce((s, b) => s + b.amount, 0),
        pending:   bal.pending.reduce((s, b) => s + b.amount, 0),
        currency:  bal.available[0]?.currency ?? "eur",
      } : null,
      volume30, count30, aov, trend, mrr, activeSubCount,
      customerCount: cuList.length,
      dailyChart,
      recentCharges: chList.slice(0, 8).map(c => ({
        id: c.id, amount: c.amount, currency: c.currency,
        status: c.status, description: c.description,
        created: c.created, customer: c.customer,
        receiptEmail: c.receipt_email,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// GET /admin/stripe/project/:id/transactions ──────────────────────────────────
router.get("/admin/stripe/project/:id/transactions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
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
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// GET /admin/stripe/project/:id/customers ─────────────────────────────────────
router.get("/admin/stripe/project/:id/customers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
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
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/customers ────────────────────────────────────
router.post("/admin/stripe/project/:id/customers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { email, name, phone, description, metadata } = req.body as any;
    if (!email) { res.status(400).json({ error: "email requerido" }); return; }
    const { stripe } = await resolveProject(pid);
    const customer = await stripe.customers.create({ email, name, phone, description, metadata });
    res.json({ customer });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// GET /admin/stripe/project/:id/subscriptions ─────────────────────────────────
router.get("/admin/stripe/project/:id/subscriptions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
    const status = (req.query.status as string) || undefined;
    const { stripe } = await resolveProject(pid);
    const params: any = { limit, expand: ["data.customer", "data.default_payment_method"] };
    if (status && status !== "all") params.status = status;
    const subs = await stripe.subscriptions.list(params);
    const data = subs.data.map(s => {
      const item = s.items?.data?.[0];
      const price = item?.price;
      return {
        id: s.id, status: s.status, created: s.created,
        currentPeriodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        customer: typeof s.customer === "string" ? { id: s.customer } : { id: (s.customer as any).id, email: (s.customer as any).email, name: (s.customer as any).name },
        priceAmount: price?.unit_amount ?? 0,
        priceCurrency: price?.currency ?? "eur",
        priceInterval: price?.recurring?.interval ?? "month",
        productName: (price as any)?.product?.name ?? price?.nickname ?? "—",
        trialEnd: s.trial_end,
      };
    });
    res.json({ data, hasMore: subs.has_more });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// DELETE /admin/stripe/project/:id/subscriptions/:subId ───────────────────────
router.delete("/admin/stripe/project/:id/subscriptions/:subId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { stripe } = await resolveProject(pid);
    const sub = await stripe.subscriptions.cancel(req.params.subId);
    res.json({ status: sub.status });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// GET /admin/stripe/project/:id/products ──────────────────────────────────────
router.get("/admin/stripe/project/:id/products", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { stripe } = await resolveProject(pid);
    const [products, prices] = await Promise.all([
      stripe.products.list({ limit: 100, active: true }),
      stripe.prices.list({ limit: 100, active: true, expand: ["data.product"] }),
    ]);
    const pricesByProduct: Record<string, any[]> = {};
    for (const price of prices.data) {
      const pid2 = typeof price.product === "string" ? price.product : (price.product as any).id;
      if (!pricesByProduct[pid2]) pricesByProduct[pid2] = [];
      pricesByProduct[pid2].push({
        id: price.id, unitAmount: price.unit_amount, currency: price.currency,
        interval: price.recurring?.interval ?? null, type: price.type,
        nickname: price.nickname,
      });
    }
    const data = products.data.map(p => ({
      id: p.id, name: p.name, description: p.description,
      active: p.active, created: p.created,
      images: p.images.slice(0, 1),
      prices: pricesByProduct[p.id] ?? [],
    }));
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/products ──────────────────────────────────────
router.post("/admin/stripe/project/:id/products", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { name, description, amount, currency = "eur", interval } = req.body as any;
    if (!name || !amount) { res.status(400).json({ error: "name y amount requeridos" }); return; }
    const { stripe } = await resolveProject(pid);
    const product = await stripe.products.create({ name, description });
    const priceParams: any = {
      product: product.id,
      unit_amount: Math.round(Number(amount) * 100),
      currency,
    };
    if (interval) priceParams.recurring = { interval };
    const price = await stripe.prices.create(priceParams);
    res.json({ product, price });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// GET /admin/stripe/project/:id/invoices ──────────────────────────────────────
router.get("/admin/stripe/project/:id/invoices", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
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
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/invoices ─────────────────────────────────────
router.post("/admin/stripe/project/:id/invoices", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { customerId, description, amount, currency = "eur", daysUntilDue = 30, autoSend = false } = req.body as any;
    if (!customerId || !amount) { res.status(400).json({ error: "customerId y amount requeridos" }); return; }
    const { stripe } = await resolveProject(pid);
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(Number(amount) * 100),
      currency,
      description,
    });
    const invoice = await stripe.invoices.create({
      customer: customerId,
      days_until_due: Number(daysUntilDue),
      collection_method: "send_invoice",
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    if (autoSend) await stripe.invoices.sendInvoice(finalized.id);
    res.json({ invoice: finalized });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/invoices/:invId/send ─────────────────────────
router.post("/admin/stripe/project/:id/invoices/:invId/send", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { stripe } = await resolveProject(pid);
    const inv = await stripe.invoices.sendInvoice(req.params.invId);
    res.json({ status: inv.status });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/invoices/:invId/void ─────────────────────────
router.post("/admin/stripe/project/:id/invoices/:invId/void", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { stripe } = await resolveProject(pid);
    const inv = await stripe.invoices.voidInvoice(req.params.invId);
    res.json({ status: inv.status });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// GET /admin/stripe/project/:id/payouts ───────────────────────────────────────
router.get("/admin/stripe/project/:id/payouts", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
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
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/charges ──────────────────────────────────────
router.post("/admin/stripe/project/:id/charges", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { amount, currency = "eur", description, customerEmail } = req.body as any;
    if (!amount) { res.status(400).json({ error: "amount requerido" }); return; }
    const { stripe } = await resolveProject(pid);
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency, description,
      receipt_email: customerEmail,
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

// POST /admin/stripe/project/:id/refunds ──────────────────────────────────────
router.post("/admin/stripe/project/:id/refunds", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.id, 10);
    const { chargeId, amount, reason = "requested_by_customer" } = req.body as any;
    if (!chargeId) { res.status(400).json({ error: "chargeId requerido" }); return; }
    const { stripe } = await resolveProject(pid);
    const params: any = { charge: chargeId, reason };
    if (amount) params.amount = Math.round(Number(amount) * 100);
    const refund = await stripe.refunds.create(params);
    res.json({ refund });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error" });
  }
});

export default router;
