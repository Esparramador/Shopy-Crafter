import { Router, type Request, type Response, type NextFunction } from "express";
import { SHOPIFY_API_VERSION } from "../lib/shopify.js";
import { sql } from "drizzle-orm";
import Stripe from "stripe";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { resolveStripeForAccount } from "../lib/stripe-tenant.js";

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

// ── Aislamiento de tenant ─────────────────────────────────────────────────────
// Las rutas /stripe/accounts/:accountId/* se montan ANTES del gate global requireAdmin y
// solo llevan requireAuth, así que una sesión de cliente podría alcanzarlas. Un cliente
// (no admin) solo puede operar sobre la cuenta Stripe vinculada a SU propio proyecto.
function sessionOf(req: Request): { role?: string; clientId?: number | string | null } {
  return ((req as any).session ?? {}) as any;
}
function ownProjectId(req: Request): number | null {
  const s = sessionOf(req);
  if (s.role === "admin") return null; // admin: sin restricción
  const own = s.clientId ? parseInt(String(s.clientId), 10) : NaN;
  return Number.isFinite(own) && own > 0 ? own : 0; // 0 = cliente sin proyecto asignado
}
async function requireStripeAccountAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const own = ownProjectId(req);
    if (own === null) { next(); return; }
    if (own === 0) { res.status(403).json({ error: "Tu sesión no tiene ningún proyecto asignado" }); return; }
    const db = await getDb();
    const r = await db.execute(sql`SELECT project_id FROM stripe_accounts WHERE account_id = ${String(req.params.accountId)} LIMIT 1`);
    const row = r.rows[0] as any;
    if (!row) { res.status(404).json({ error: "Cuenta Stripe no encontrada" }); return; }
    if (Number(row.project_id) !== own) { res.status(403).json({ error: "No tienes acceso a esta cuenta Stripe" }); return; }
    next();
  } catch (err: any) {
    logger.error({ err }, "requireStripeAccountAccess error");
    res.status(500).json({ error: err.message });
  }
}
router.use("/stripe/accounts/:accountId", requireAuth, requireStripeAccountAccess);

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
    // Un cliente solo puede vincular Stripe a su propio proyecto
    const own = ownProjectId(req);
    if (own !== null && own !== projectId) {
      res.status(403).json({ error: "No puedes vincular Stripe a un proyecto que no es tuyo" });
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
    let projectId = req.query.projectId ? parseInt(String(req.query.projectId), 10) : null;

    // Un cliente (no admin) solo puede ver la cuenta de SU proyecto
    const sess: any = (req as any).session ?? {};
    if (sess.role !== "admin") {
      const own = sess.clientId ? parseInt(String(sess.clientId), 10) : NaN;
      if (!own) { res.json([]); return; }
      projectId = own;
    }

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

    const { stripe, row } = await getStripeForAccount(accountId);

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
    const { stripe } = await getStripeForAccount(accountId);

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
    const { stripe } = await getStripeForAccount(accountId);
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
    const { stripe } = await getStripeForAccount(accountId);
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

    const { stripe } = await getStripeForAccount(accountId);
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
router.post("/stripe/draft-order", requireAdmin, async (req: Request, res: Response): Promise<void> => {
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
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`,
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

// ── Helper: Get Stripe instance from accountId (supports all 3 modes) ─────────
async function getStripeForAccount(accountId: string | string[]): Promise<{ stripe: Stripe; row: any }> {
  // Soporta cuentas directas (stripe_key_enc), Connect Custom y OAuth — misma lógica que resolveStripeForProject
  const { stripe, row } = await resolveStripeForAccount(String(accountId));
  return { stripe, row };
}

// ── GET /stripe/accounts/:accountId/products ──────────────────────────────────
router.get("/stripe/accounts/:accountId/products", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const [products, prices] = await Promise.all([
      stripe.products.list({ limit, active: true }),
      stripe.prices.list({ limit: 100, active: true }),
    ]);
    const priceMap: Record<string, any[]> = {};
    for (const p of prices.data) {
      const pid = typeof p.product === "string" ? p.product : (p.product as any)?.id;
      if (pid) { priceMap[pid] = priceMap[pid] ?? []; priceMap[pid].push(p); }
    }
    res.json({
      data: products.data.map(p => ({
        id: p.id, name: p.name, description: p.description, active: p.active,
        created: p.created, images: p.images,
        prices: (priceMap[p.id] ?? []).map(pr => ({
          id: pr.id, amount: pr.unit_amount, currency: pr.currency,
          interval: pr.recurring?.interval ?? null, type: pr.type,
        })),
      })),
      has_more: products.has_more,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/products ─────────────────────────────────
router.post("/stripe/accounts/:accountId/products", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { name, description, price, currency = "eur", interval, images } = req.body as any;
    if (!name) { res.status(400).json({ error: "name requerido" }); return; }
    const product = await stripe.products.create({ name, description: description ?? undefined, images: images ?? undefined });
    let createdPrice: any = null;
    if (price && Number(price) > 0) {
      const pd: Stripe.PriceCreateParams = {
        product: product.id,
        unit_amount: Math.round(Number(price) * 100),
        currency: String(currency).toLowerCase(),
      };
      if (interval) pd.recurring = { interval };
      createdPrice = await stripe.prices.create(pd);
    }
    res.json({ product, price: createdPrice, message: `Producto "${name}" creado en Stripe` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /stripe/accounts/:accountId/products/:productId ─────────────────────
router.patch("/stripe/accounts/:accountId/products/:productId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { name, description, active } = req.body as any;
    const updated = await stripe.products.update(req.params.productId as string, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(active !== undefined ? { active } : {}),
    });
    res.json({ product: updated, message: "Producto actualizado" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /stripe/accounts/:accountId/products/:productId ────────────────────
// Stripe no permite eliminar productos con precios — se archivan (active=false)
router.delete("/stripe/accounts/:accountId/products/:productId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    await stripe.products.update(req.params.productId as string, { active: false });
    res.json({ ok: true, message: "Producto archivado correctamente" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/charges ──────────────────────────────────
router.post("/stripe/accounts/:accountId/charges", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { amount, currency = "eur", customerId, description, paymentMethodId, receiptEmail } = req.body as any;
    if (!amount) { res.status(400).json({ error: "amount requerido (en céntimos, ej. 4900 = €49)" }); return; }
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount)),
      currency: String(currency).toLowerCase(),
      customer: customerId ?? undefined,
      description: description ?? undefined,
      receipt_email: receiptEmail ?? undefined,
      payment_method: paymentMethodId ?? undefined,
      confirm: !!paymentMethodId,
      automatic_payment_methods: paymentMethodId ? undefined : { enabled: true },
    });
    res.json({ paymentIntent: { id: pi.id, status: pi.status, clientSecret: pi.client_secret, amount: pi.amount, currency: pi.currency }, message: `PaymentIntent ${pi.id} creado (${pi.status})` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/refunds ──────────────────────────────────
router.post("/stripe/accounts/:accountId/refunds", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { chargeId, paymentIntentId, amount, reason = "requested_by_customer" } = req.body as any;
    if (!chargeId && !paymentIntentId) { res.status(400).json({ error: "chargeId o paymentIntentId requerido" }); return; }
    const refund = await stripe.refunds.create({
      charge: chargeId ?? undefined,
      payment_intent: paymentIntentId ?? undefined,
      amount: amount ? Math.round(Number(amount)) : undefined,
      reason: reason as any,
    });
    res.json({ refund: { id: refund.id, amount: refund.amount, status: refund.status, currency: refund.currency }, message: `Reembolso ${refund.id} — ${refund.status}` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/customers ────────────────────────────────
router.post("/stripe/accounts/:accountId/customers", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { email, name, phone, description, metadata } = req.body as any;
    if (!email) { res.status(400).json({ error: "email requerido" }); return; }
    const customer = await stripe.customers.create({ email, name: name ?? undefined, phone: phone ?? undefined, description: description ?? undefined, metadata: metadata ?? undefined });
    res.json({ customer: { id: customer.id, email: customer.email, name: customer.name, created: customer.created }, message: `Cliente ${email} creado (${customer.id})` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /stripe/accounts/:accountId/customers/:customerId ─────────────────────
router.get("/stripe/accounts/:accountId/customers/:customerId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const customer = await stripe.customers.retrieve(req.params.customerId as string);
    res.json({ customer });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /stripe/accounts/:accountId/invoices ──────────────────────────────────
router.get("/stripe/accounts/:accountId/invoices", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const status = req.query.status as string | undefined;
    const params: Stripe.InvoiceListParams = { limit };
    if (status) params.status = status as any;
    const invoices = await stripe.invoices.list(params);
    res.json({
      data: invoices.data.map(inv => ({
        id: inv.id, number: inv.number, status: inv.status,
        amountDue: inv.amount_due, amountPaid: inv.amount_paid, currency: inv.currency,
        customer: typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id,
        customerEmail: inv.customer_email, customerName: inv.customer_name,
        dueDate: inv.due_date, created: inv.created,
        hostedUrl: inv.hosted_invoice_url, pdfUrl: inv.invoice_pdf,
      })),
      has_more: invoices.has_more,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/invoices ─────────────────────────────────
router.post("/stripe/accounts/:accountId/invoices", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { customerId, description, daysUntilDue = 30, lineItems, autoAdvance = false } = req.body as any;
    if (!customerId) { res.status(400).json({ error: "customerId requerido" }); return; }
    if (lineItems?.length > 0) {
      for (const item of lineItems) {
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: Math.round(Number(item.amount) * 100),
          currency: String(item.currency ?? "eur").toLowerCase(),
          description: item.description ?? "Servicio",
        });
      }
    }
    const invoice = await stripe.invoices.create({
      customer: customerId,
      description: description ?? undefined,
      days_until_due: daysUntilDue,
      collection_method: "send_invoice",
      auto_advance: autoAdvance,
    });
    res.json({ invoice: { id: invoice.id, number: invoice.number, status: invoice.status, amountDue: invoice.amount_due, hostedUrl: invoice.hosted_invoice_url }, message: `Factura ${invoice.number ?? invoice.id} creada` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/invoices/:invoiceId/send ─────────────────
router.post("/stripe/accounts/:accountId/invoices/:invoiceId/send", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    let inv = await stripe.invoices.retrieve(req.params.invoiceId as string);
    if (inv.status === "draft") inv = await stripe.invoices.finalizeInvoice(req.params.invoiceId as string);
    const sent = await stripe.invoices.sendInvoice(req.params.invoiceId as string);
    res.json({ ok: true, status: sent.status, hostedUrl: sent.hosted_invoice_url, message: "Factura enviada al cliente" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /stripe/accounts/:accountId/invoices/:invoiceId/void ─────────────────
router.post("/stripe/accounts/:accountId/invoices/:invoiceId/void", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const voided = await stripe.invoices.voidInvoice(req.params.invoiceId as string);
    res.json({ ok: true, status: voided.status, message: "Factura anulada" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /stripe/accounts/:accountId/payouts ───────────────────────────────────
router.get("/stripe/accounts/:accountId/payouts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10), 100);
    const payouts = await stripe.payouts.list({ limit });
    res.json({
      data: payouts.data.map(p => ({
        id: p.id, amount: p.amount, currency: p.currency, status: p.status,
        arrivalDate: p.arrival_date, created: p.created, description: p.description,
        type: p.type, method: p.method,
      })),
      has_more: payouts.has_more,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /stripe/accounts/:accountId/subscriptions/:subId ────────────────────
router.patch("/stripe/accounts/:accountId/subscriptions/:subId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const { cancelAtPeriodEnd, metadata, trialEnd } = req.body as any;
    const updated = await stripe.subscriptions.update(req.params.subId as string, {
      cancel_at_period_end: cancelAtPeriodEnd ?? undefined,
      metadata: metadata ?? undefined,
      trial_end: trialEnd ?? undefined,
    });
    res.json({ subscription: { id: updated.id, status: updated.status, cancelAtPeriodEnd: updated.cancel_at_period_end }, message: `Suscripción ${req.params.subId} actualizada` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /stripe/accounts/:accountId/subscriptions/:subId ───────────────────
router.delete("/stripe/accounts/:accountId/subscriptions/:subId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stripe } = await getStripeForAccount(req.params.accountId as string);
    const immediately = req.query.immediately === "true" || req.body?.immediately === true;
    const cancelled = immediately
      ? await stripe.subscriptions.cancel(req.params.subId as string)
      : await stripe.subscriptions.update(req.params.subId as string, { cancel_at_period_end: true });
    res.json({ ok: true, status: cancelled.status, cancelAtPeriodEnd: (cancelled as any).cancel_at_period_end, message: immediately ? "Suscripción cancelada inmediatamente" : "Suscripción se cancelará al final del período" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /stripe/oauth/check ───────────────────────────────────────────────────
router.get("/stripe/oauth/check", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
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
