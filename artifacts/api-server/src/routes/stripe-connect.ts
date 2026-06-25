import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import Stripe from "stripe";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { encrypt, decrypt } from "../lib/crypto.js";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────
function getAppUrl() {
  return process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
}

function getPlatformStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurado");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

async function getDb() {
  const { db } = await import("@workspace/db");
  return db;
}

// ── DB Setup ───────────────────────────────────────────────────────────────────
async function ensureStripeTables(): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stripe_accounts (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL UNIQUE,
        access_token_enc TEXT,
        refresh_token_enc TEXT,
        publishable_key TEXT,
        scope TEXT,
        stripe_user_id TEXT,
        account_type TEXT DEFAULT 'standard',
        onboarding_complete BOOLEAN DEFAULT FALSE,
        display_name TEXT,
        email TEXT,
        country TEXT DEFAULT 'ES',
        currency TEXT DEFAULT 'eur',
        connected_at TIMESTAMPTZ DEFAULT NOW(),
        last_synced_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS stripe_accounts_project_id_idx ON stripe_accounts(project_id)
    `);
    logger.info("✅ stripe_accounts table ready");
  } catch (err: any) {
    logger.warn({ err }, "stripe_accounts table setup warning (non-fatal)");
  }
}

ensureStripeTables();

// ── OAuth state map (same pattern as Shopify) ─────────────────────────────────
const oauthState = new Map<string, { projectId: number; userId: string }>();

// ── GET /stripe/oauth/start ───────────────────────────────────────────────────
// Inicia el OAuth de Stripe Connect (igual que /shopify/oauth/start)
router.get("/stripe/oauth/start", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = process.env.STRIPE_CLIENT_ID;
    if (!clientId) {
      res.status(400).json({ error: "STRIPE_CLIENT_ID no configurado. Añade el secret en el entorno." });
      return;
    }

    const projectId = parseInt(String(req.query.projectId ?? "0"), 10);
    if (!projectId) {
      res.status(400).json({ error: "projectId requerido" });
      return;
    }

    const userId = (req.session as any).userId;
    const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    oauthState.set(state, { projectId, userId });
    setTimeout(() => oauthState.delete(state), 10 * 60 * 1000);

    const redirectUri = `${getAppUrl()}/api/stripe/oauth/callback`;
    const authUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.json({ authUrl });
  } catch (err: any) {
    logger.error({ err }, "GET /stripe/oauth/start error");
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stripe/oauth/callback ────────────────────────────────────────────────
router.get("/stripe/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>;
    const appUrl = getAppUrl();

    if (oauthError) {
      logger.warn({ oauthError }, "Stripe OAuth cancelado por usuario");
      res.redirect(`${appUrl}/dashboard?stripe_error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!state || !oauthState.has(state)) {
      res.status(400).send("Estado OAuth inválido o expirado");
      return;
    }

    const saved = oauthState.get(state)!;
    oauthState.delete(state);

    const stripe = getPlatformStripe();
    const response = await stripe.oauth.token({ grant_type: "authorization_code", code });

    const {
      access_token,
      refresh_token,
      stripe_user_id,
      stripe_publishable_key,
      scope,
    } = response as any;

    // Fetch account details
    const account = await stripe.accounts.retrieve(stripe_user_id);
    const displayName = account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? "";
    const email = account.email ?? "";
    const country = account.country ?? "ES";
    const currency = account.default_currency ?? "eur";
    const onboardingComplete = account.details_submitted ?? false;

    const db = await getDb();

    // Upsert — mismo patrón que Shopify projects
    await db.execute(sql`
      INSERT INTO stripe_accounts
        (project_id, account_id, access_token_enc, refresh_token_enc, publishable_key, scope,
         stripe_user_id, display_name, email, country, currency, onboarding_complete)
      VALUES
        (${saved.projectId}, ${stripe_user_id}, ${encrypt(access_token)},
         ${refresh_token ? encrypt(refresh_token) : null},
         ${stripe_publishable_key ?? null}, ${scope ?? null},
         ${stripe_user_id}, ${displayName}, ${email},
         ${country}, ${currency}, ${onboardingComplete})
      ON CONFLICT (account_id) DO UPDATE SET
        access_token_enc = EXCLUDED.access_token_enc,
        refresh_token_enc = EXCLUDED.refresh_token_enc,
        publishable_key = EXCLUDED.publishable_key,
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        onboarding_complete = EXCLUDED.onboarding_complete,
        last_synced_at = NOW()
    `);

    logger.info({ projectId: saved.projectId, stripe_user_id }, "✅ Stripe Connect vinculado");
    res.redirect(`${appUrl}/dashboard?stripe_connected=1&project=${saved.projectId}`);
  } catch (err: any) {
    logger.error({ err }, "GET /stripe/oauth/callback error");
    res.redirect(`${getAppUrl()}/dashboard?stripe_error=${encodeURIComponent(err.message)}`);
  }
});

// ── GET /stripe/accounts ──────────────────────────────────────────────────────
// Lista todas las cuentas Stripe conectadas (admin) o las del proyecto (user)
router.get("/stripe/accounts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const projectId = req.query.projectId ? parseInt(String(req.query.projectId), 10) : null;

    let rows: any[];
    if (projectId) {
      const result = await db.execute(sql`
        SELECT id, project_id, account_id, publishable_key, scope, display_name, email,
               country, currency, onboarding_complete, account_type, connected_at, last_synced_at
        FROM stripe_accounts WHERE project_id = ${projectId} ORDER BY connected_at DESC
      `);
      rows = result.rows;
    } else {
      const result = await db.execute(sql`
        SELECT sa.id, sa.project_id, sa.account_id, sa.publishable_key, sa.scope,
               sa.display_name, sa.email, sa.country, sa.currency, sa.onboarding_complete,
               sa.account_type, sa.connected_at, sa.last_synced_at,
               p.name as project_name, p.shop_domain
        FROM stripe_accounts sa
        LEFT JOIN projects p ON p.id = sa.project_id
        ORDER BY sa.connected_at DESC
      `);
      rows = result.rows;
    }

    res.json(rows);
  } catch (err: any) {
    logger.error({ err }, "GET /stripe/accounts error");
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stripe/accounts/:accountId/overview ──────────────────────────────────
// Dashboard financiero: balance + métricas (igual que leer productos Shopify)
router.get("/stripe/accounts/:accountId/overview", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const db = await getDb();

    const result = await db.execute(sql`
      SELECT access_token_enc, currency FROM stripe_accounts WHERE account_id = ${accountId}
    `);
    const row = result.rows[0] as any;
    if (!row) { res.status(404).json({ error: "Cuenta Stripe no encontrada" }); return; }

    const accessToken = decrypt(row.access_token_enc);
    const stripe = new Stripe(accessToken, { apiVersion: "2026-05-27.dahlia" });

    const [balance, charges, customers, subscriptions] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 5 }),
      stripe.customers.list({ limit: 1 }),
      stripe.subscriptions.list({ limit: 1 }).catch(() => ({ data: [], has_more: false } as any)),
    ]);

    // Totales de los últimos 30 días
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const [recentCharges, payouts] = await Promise.all([
      stripe.charges.list({ limit: 100, created: { gte: since } }),
      stripe.payouts.list({ limit: 5 }),
    ]);

    const grossVolume = recentCharges.data.reduce((s, c) => s + (c.amount ?? 0), 0);
    const netVolume = recentCharges.data.reduce((s, c) => s + (c.amount ?? 0) - (c.application_fee_amount ?? 0), 0);
    const totalFees = grossVolume - netVolume;
    const successCount = recentCharges.data.filter(c => c.status === "succeeded").length;
    const failedCount = recentCharges.data.filter(c => c.status === "failed").length;

    const available = balance.available.reduce((s, b) => s + b.amount, 0);
    const pending = balance.pending.reduce((s, b) => s + b.amount, 0);

    res.json({
      balance: { available, pending, currency: balance.available[0]?.currency ?? row.currency },
      metrics: {
        grossVolume,
        netVolume,
        totalFees,
        successCount,
        failedCount,
        period: "últimos 30 días",
      },
      recentCharges: charges.data.map(c => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        description: c.description,
        customer: typeof c.customer === "string" ? c.customer : c.customer?.id,
        created: c.created,
        receiptUrl: c.receipt_url,
      })),
      payouts: payouts.data.map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date,
        created: p.created,
      })),
    });

    // Update last_synced_at
    await db.execute(sql`UPDATE stripe_accounts SET last_synced_at = NOW() WHERE account_id = ${accountId}`);
  } catch (err: any) {
    logger.error({ err }, "GET /stripe/accounts/:id/overview error");
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stripe/accounts/:accountId/transactions ─────────────────────────────
router.get("/stripe/accounts/:accountId/transactions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const startingAfter = req.query.starting_after as string | undefined;

    const db = await getDb();
    const result = await db.execute(sql`
      SELECT access_token_enc FROM stripe_accounts WHERE account_id = ${accountId}
    `);
    const row = result.rows[0] as any;
    if (!row) { res.status(404).json({ error: "Cuenta no encontrada" }); return; }

    const stripe = new Stripe(decrypt(row.access_token_enc), { apiVersion: "2026-05-27.dahlia" });

    const params: Stripe.ChargeListParams = { limit };
    if (startingAfter) params.starting_after = startingAfter;

    const charges = await stripe.charges.list(params);

    res.json({
      data: charges.data.map(c => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        description: c.description,
        customer: typeof c.customer === "string" ? c.customer : c.customer?.id,
        customerEmail: c.billing_details?.email,
        created: c.created,
        receiptUrl: c.receipt_url,
        refunded: c.refunded,
        disputeStatus: (c as any).dispute?.status ?? null,
      })),
      has_more: charges.has_more,
      last_id: charges.data[charges.data.length - 1]?.id,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /stripe/accounts/:id/transactions error");
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stripe/accounts/:accountId/customers ────────────────────────────────
router.get("/stripe/accounts/:accountId/customers", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const startingAfter = req.query.starting_after as string | undefined;

    const db = await getDb();
    const result = await db.execute(sql`
      SELECT access_token_enc FROM stripe_accounts WHERE account_id = ${accountId}
    `);
    const row = result.rows[0] as any;
    if (!row) { res.status(404).json({ error: "Cuenta no encontrada" }); return; }

    const stripe = new Stripe(decrypt(row.access_token_enc), { apiVersion: "2026-05-27.dahlia" });
    const params: Stripe.CustomerListParams = { limit };
    if (startingAfter) params.starting_after = startingAfter;

    const customers = await stripe.customers.list(params);

    res.json({
      data: customers.data.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        created: c.created,
        currency: c.currency,
        balance: c.balance,
        description: c.description,
        phone: c.phone,
      })),
      has_more: customers.has_more,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stripe/accounts/:accountId/subscriptions ────────────────────────────
router.get("/stripe/accounts/:accountId/subscriptions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);

    const db = await getDb();
    const result = await db.execute(sql`
      SELECT access_token_enc FROM stripe_accounts WHERE account_id = ${accountId}
    `);
    const row = result.rows[0] as any;
    if (!row) { res.status(404).json({ error: "Cuenta no encontrada" }); return; }

    const stripe = new Stripe(decrypt(row.access_token_enc), { apiVersion: "2026-05-27.dahlia" });
    const subs = await stripe.subscriptions.list({ limit, status: "all" });

    res.json({
      data: subs.data.map(s => ({
        id: s.id,
        status: s.status,
        customer: typeof s.customer === "string" ? s.customer : (s.customer as any)?.id,
        currentPeriodEnd: (s as any).current_period_end,
        currentPeriodStart: (s as any).current_period_start,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        created: s.created,
        items: s.items.data.map(i => ({
          id: i.id,
          priceId: i.price.id,
          amount: i.price.unit_amount,
          currency: i.price.currency,
          interval: i.price.recurring?.interval,
          productId: typeof i.price.product === "string" ? i.price.product : (i.price.product as any)?.id,
        })),
      })),
      has_more: subs.has_more,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /stripe/accounts/:accountId/disconnect ─────────────────────────────
router.delete("/stripe/accounts/:accountId/disconnect", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const db = await getDb();

    // Revoke OAuth token with Stripe
    try {
      const clientId = process.env.STRIPE_CLIENT_ID;
      if (clientId) {
        const stripe = getPlatformStripe();
        await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: String(accountId) });
      }
    } catch (revokeErr) {
      logger.warn({ revokeErr }, "Stripe token revoke failed (non-fatal)");
    }

    await db.execute(sql`DELETE FROM stripe_accounts WHERE account_id = ${accountId}`);
    logger.info({ accountId }, "✅ Stripe account desconectada");
    res.json({ ok: true, message: "Cuenta Stripe desconectada correctamente" });
  } catch (err: any) {
    logger.error({ err }, "DELETE /stripe/accounts/:id/disconnect error");
    res.status(500).json({ error: err.message });
  }
});

// ── POST /stripe/accounts/:accountId/sync ─────────────────────────────────────
router.post("/stripe/accounts/:accountId/sync", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const db = await getDb();

    const result = await db.execute(sql`
      SELECT access_token_enc FROM stripe_accounts WHERE account_id = ${accountId}
    `);
    const row = result.rows[0] as any;
    if (!row) { res.status(404).json({ error: "Cuenta no encontrada" }); return; }

    const stripe = new Stripe(decrypt(row.access_token_enc), { apiVersion: "2026-05-27.dahlia" });
    const account = await stripe.accounts.retrieve(String(accountId));

    await db.execute(sql`
      UPDATE stripe_accounts SET
        display_name = ${account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null},
        email = ${account.email ?? null},
        country = ${account.country ?? "ES"},
        onboarding_complete = ${account.details_submitted ?? false},
        last_synced_at = NOW()
      WHERE account_id = ${accountId}
    `);

    res.json({ ok: true, message: "Cuenta sincronizada" });
  } catch (err: any) {
    logger.error({ err }, "POST /stripe/accounts/:id/sync error");
    res.status(500).json({ error: err.message });
  }
});

// ── POST /stripe/draft-order ──────────────────────────────────────────────────
// Crea un Draft Order en la tienda Shopify vinculada y devuelve la URL de checkout
// El usuario paga en el checkout de Shopify (con su pasarela: Stripe Payments, etc.)
router.post("/stripe/draft-order", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency = "EUR", description, customerEmail, note, lineItems } = req.body ?? {};
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "amount requerido (en céntimos, ej. 4900 = €49)" });
      return;
    }

    const db = await getDb();
    // Obtener configuración de la tienda propia (tienda_settings)
    const settingsRes = await db.execute(sql`SELECT * FROM tienda_settings WHERE id = 1`);
    const settings = settingsRes.rows[0] as any;

    if (!settings?.shopify_domain || !settings?.admin_api_key) {
      res.status(400).json({
        error: "Tienda Shopify no configurada. Ve a Admin → Mi Tienda → Configuración y añade tu dominio y API key.",
      });
      return;
    }

    const shopDomain = settings.shopify_domain.replace(/\/$/, "");
    const adminApiKey = settings.admin_api_key;

    // Build line items — si no se especifican, creamos un producto genérico
    const items = lineItems ?? [
      {
        title: description ?? "Servicio personalizado",
        price: (amount / 100).toFixed(2),
        quantity: 1,
      },
    ];

    const draftOrderPayload: any = {
      draft_order: {
        line_items: items.map((item: any) => ({
          title: item.title,
          price: String(item.price ?? (amount / 100).toFixed(2)),
          quantity: item.quantity ?? 1,
          requires_shipping: false,
          taxable: false,
        })),
        note: note ?? description ?? "Pedido creado desde Shopy Crafter",
        currency,
        ...(customerEmail ? { email: customerEmail } : {}),
        use_customer_default_address: false,
      },
    };

    const shopifyRes = await fetch(
      `https://${shopDomain}/admin/api/2026-01/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminApiKey,
        },
        body: JSON.stringify(draftOrderPayload),
      }
    );

    if (!shopifyRes.ok) {
      const errBody = await shopifyRes.text();
      logger.error({ status: shopifyRes.status, errBody }, "Shopify Draft Order error");
      res.status(502).json({ error: `Error de Shopify: ${shopifyRes.status} ${errBody}` });
      return;
    }

    const { draft_order } = await shopifyRes.json() as any;

    logger.info({ draftOrderId: draft_order.id, invoiceUrl: draft_order.invoice_url }, "✅ Draft Order creado");

    res.json({
      ok: true,
      draftOrderId: draft_order.id,
      invoiceUrl: draft_order.invoice_url,         // URL de checkout para enviar al cliente
      checkoutUrl: draft_order.invoice_url,
      adminUrl: `https://${shopDomain}/admin/draft_orders/${draft_order.id}`,
      totalPrice: draft_order.total_price,
      currency: draft_order.currency,
    });
  } catch (err: any) {
    logger.error({ err }, "POST /stripe/draft-order error");
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stripe/oauth/check ───────────────────────────────────────────────────
router.get("/stripe/oauth/check", async (_req: Request, res: Response): Promise<void> => {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  res.json({
    configured: !!(clientId && secretKey),
    hasClientId: !!clientId,
    hasSecretKey: !!secretKey,
    mode: secretKey?.startsWith("sk_test_") ? "test" : secretKey?.startsWith("sk_live_") ? "live" : "not_set",
  });
});

export default router;
