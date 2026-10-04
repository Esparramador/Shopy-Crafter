import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { SERVICE_CATALOG, LEGACY_SEEDED_SERVICE_NAMES, priceDisplay } from "../lib/service-catalog.js";
import { getStripe, createServiceCheckout, type SellableService } from "../lib/stripe-billing.js";
import { publicAppUrl } from "../lib/account-tokens.js";

const router = Router();

async function getDb() {
  const { db } = await import("@workspace/db");
  return db;
}

// ── DB Setup ──────────────────────────────────────────────────────────────────
async function ensureTiendaTables(): Promise<void> {
  try {
    const db = await getDb();

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tienda_services (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        short_desc TEXT,
        icon TEXT DEFAULT '⚡',
        price_display TEXT DEFAULT 'Consultar precio',
        features JSONB DEFAULT '[]',
        cta_label TEXT DEFAULT 'Solicitar →',
        cta_url TEXT,
        badge TEXT,
        color_accent TEXT DEFAULT 'gold',
        sort_order INTEGER DEFAULT 0,
        visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tienda_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        shopify_domain TEXT,
        storefront_access_token TEXT,
        admin_api_key TEXT,
        admin_api_secret TEXT,
        checkout_url_prefix TEXT,
        store_name TEXT DEFAULT 'Shopy Crafter',
        currency TEXT DEFAULT 'EUR',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS shopify_checkout_url TEXT
    `);

    await db.execute(sql`
      INSERT INTO tienda_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`ALTER TABLE tienda_services ADD COLUMN IF NOT EXISTS price_eur NUMERIC`);
    await db.execute(sql`ALTER TABLE tienda_services ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'quote'`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`);

    // v2: servicios con precio real y cobro por Stripe. Los sembrados en la v1
    // prometían "monitorización 24/7", "account manager dedicado", "entrega en
    // 48h"…: se ocultan (no se borran) y se siembra el catálogo nuevo. Los
    // servicios que haya creado el admin no se tocan.
    const ver = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'tienda_services_version'`);
    if ((ver.rows[0] as { value?: string } | undefined)?.value !== "v2") {
      for (const legacy of LEGACY_SEEDED_SERVICE_NAMES) {
        await db.execute(sql`UPDATE tienda_services SET visible = FALSE, updated_at = NOW() WHERE name = ${legacy}`);
      }
      for (const svc of SERVICE_CATALOG) {
        await db.execute(sql`
          INSERT INTO tienda_services
            (name, description, short_desc, icon, price_display, features, cta_label, badge, color_accent, sort_order, visible, price_eur, billing_interval)
          VALUES (${svc.name}, ${svc.description}, ${svc.shortDesc}, ${svc.icon}, ${priceDisplay(svc.priceEur, svc.interval)},
            ${JSON.stringify(svc.features)}::jsonb, ${svc.ctaLabel}, ${svc.badge}, ${svc.color}, ${svc.sortOrder}, TRUE,
            ${svc.priceEur}, ${svc.interval})
        `);
      }
      await db.execute(sql`
        INSERT INTO app_settings (key, value, updated_at) VALUES ('tienda_services_version', 'v2', NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `);
      logger.info("🌱 Tienda services v2 seeded (precios reales)");
    }

    logger.info("✅ Tienda tables ready");
  } catch (err) {
    logger.warn({ err }, "Tienda tables setup warning");
  }
}
ensureTiendaTables();

// ── PUBLIC: GET /tienda/plans ─────────────────────────────────────────────────
router.get("/tienda/plans", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.execute(sql`
      SELECT id, name, price, price_annual, currency, featured, badge, features,
             cta_label, cta_style, cta_href, shopify_checkout_url,
             stores_limit, images_included, sort_order
      FROM billing_plans
      WHERE visible = TRUE
      ORDER BY sort_order ASC
    `);
    res.json(result.rows);
  } catch (err: any) {
    logger.error({ err }, "GET /tienda/plans error");
    res.status(500).json({ error: err.message });
  }
});

// ── PUBLIC: GET /tienda/services ─────────────────────────────────────────────
router.get("/tienda/services", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.execute(sql`
      SELECT * FROM tienda_services WHERE visible = TRUE ORDER BY sort_order ASC
    `);
    res.json(result.rows);
  } catch (err: any) {
    logger.error({ err }, "GET /tienda/services error");
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: GET /tienda/settings ──────────────────────────────────────────────
router.get("/tienda/settings", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.execute(sql`SELECT * FROM tienda_settings WHERE id = 1`);
    res.json(result.rows[0] ?? {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: PUT /tienda/settings ──────────────────────────────────────────────
router.put("/tienda/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      shopify_domain, storefront_access_token, admin_api_key,
      admin_api_secret, checkout_url_prefix, store_name, currency,
    } = req.body ?? {};
    const db = await getDb();
    await db.execute(sql`
      UPDATE tienda_settings SET
        shopify_domain = ${shopify_domain ?? null},
        storefront_access_token = ${storefront_access_token ?? null},
        admin_api_key = ${admin_api_key ?? null},
        admin_api_secret = ${admin_api_secret ?? null},
        checkout_url_prefix = ${checkout_url_prefix ?? null},
        store_name = ${store_name ?? "Shopy Crafter"},
        currency = ${currency ?? "EUR"},
        updated_at = NOW()
      WHERE id = 1
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: GET /tienda/admin/services ─────────────────────────────────────────
router.get("/tienda/admin/services", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.execute(sql`SELECT * FROM tienda_services ORDER BY sort_order ASC`);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: PUT /tienda/plans/:planId/checkout-url ─────────────────────────────
router.put("/tienda/plans/:planId/checkout-url", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { shopify_checkout_url } = req.body ?? {};
    const db = await getDb();
    await db.execute(sql`
      UPDATE billing_plans
      SET shopify_checkout_url = ${shopify_checkout_url ?? null}
      WHERE id = ${planId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: POST /tienda/services ─────────────────────────────────────────────
router.post("/tienda/services", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, description, short_desc, icon, price_display,
      features, cta_label, cta_url, badge, color_accent, sort_order, visible,
      price_eur, billing_interval,
    } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "name requerido" }); return; }
    const interval = ["one_time", "month", "quote"].includes(billing_interval) ? billing_interval : "quote";
    const price = price_eur === null || price_eur === undefined || price_eur === "" ? null : Number(price_eur);
    if (price !== null && !(price > 0)) { res.status(400).json({ error: "price_eur debe ser un número positivo" }); return; }
    const db = await getDb();
    const result = await db.execute(sql`
      INSERT INTO tienda_services
        (name, description, short_desc, icon, price_display, features, cta_label,
         cta_url, badge, color_accent, sort_order, visible, price_eur, billing_interval)
      VALUES (
        ${name},
        ${description ?? null},
        ${short_desc ?? null},
        ${icon ?? "⚡"},
        ${price_display ?? priceDisplay(price, interval)},
        ${JSON.stringify(features ?? [])}::jsonb,
        ${cta_label ?? "Solicitar →"},
        ${cta_url ?? null},
        ${badge ?? null},
        ${color_accent ?? "gold"},
        ${sort_order ?? 0},
        ${visible !== false},
        ${price},
        ${interval}
      )
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: PUT /tienda/services/:id ──────────────────────────────────────────
router.put("/tienda/services/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name, description, short_desc, icon, price_display,
      features, cta_label, cta_url, badge, color_accent, sort_order, visible,
      price_eur, billing_interval,
    } = req.body ?? {};
    const interval = ["one_time", "month", "quote"].includes(billing_interval) ? billing_interval : null;
    const price = price_eur === undefined ? undefined : price_eur === null || price_eur === "" ? null : Number(price_eur);
    if (typeof price === "number" && !(price > 0)) { res.status(400).json({ error: "price_eur debe ser un número positivo" }); return; }
    const db = await getDb();
    const featsJson = features !== undefined ? JSON.stringify(features) : null;
    await db.execute(sql`
      UPDATE tienda_services SET
        name             = COALESCE(${name ?? null}, name),
        description      = COALESCE(${description ?? null}, description),
        short_desc       = COALESCE(${short_desc ?? null}, short_desc),
        icon             = COALESCE(${icon ?? null}, icon),
        price_display    = COALESCE(${price_display ?? null}, price_display),
        features         = COALESCE(${featsJson !== null ? featsJson : null}::jsonb, features),
        cta_label        = COALESCE(${cta_label ?? null}, cta_label),
        cta_url          = ${cta_url ?? null},
        badge            = ${badge ?? null},
        color_accent     = COALESCE(${color_accent ?? null}, color_accent),
        sort_order       = COALESCE(${sort_order !== undefined ? sort_order : null}, sort_order),
        visible          = COALESCE(${visible !== undefined ? visible : null}, visible),
        price_eur        = ${price === undefined ? sql`price_eur` : price},
        billing_interval = COALESCE(${interval}, billing_interval),
        updated_at       = NOW()
      WHERE id = ${Number(id)}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: DELETE /tienda/services/:id ───────────────────────────────────────
router.delete("/tienda/services/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.execute(sql`DELETE FROM tienda_services WHERE id = ${Number(id)}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ref = userId:planId:firma. Firma HMAC con SESSION_SECRET (obligatorio al arrancar).
function checkoutRefSig(userId: string, planId: string): string {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", key).update(`tienda-ref:${userId}:${planId}`).digest("hex").slice(0, 32);
}

export function signCheckoutRef(userId: string, planId: string): string {
  return `${userId}:${planId}:${checkoutRefSig(userId, planId)}`;
}

export function verifyCheckoutRef(ref: string): { userId: string; planId: string } | null {
  const parts = ref.split(":");
  if (parts.length !== 3) return null;
  const [userId, planId, sig] = parts;
  if (!userId || !planId || !sig) return null;
  const expected = Buffer.from(checkoutRefSig(userId, planId));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got) ? { userId, planId } : null;
}

// ── CLIENT: POST /tienda/create-checkout ─────────────────────────────────────
// Generates a Shopify checkout URL pre-filled with the user's email + a ref
// token (userId:planId) so the orders/paid webhook can activate the right plan.
router.post("/tienda/create-checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    const { planId } = req.body ?? {};
    const userId = (req as any).session?.userId;
    if (!planId) return void res.status(400).json({ error: "planId requerido" });

    const db = await getDb();

    const planRes = await db.execute(sql`
      SELECT id, name, shopify_checkout_url FROM billing_plans
      WHERE id = ${planId} AND visible = TRUE
    `);
    const plan = planRes.rows[0] as any;
    if (!plan) return void res.status(404).json({ error: "Plan no encontrado" });
    if (!plan.shopify_checkout_url) {
      return void res.status(400).json({ error: "URL de checkout no configurada para este plan" });
    }

    const userRes = await db.execute(sql`SELECT email FROM users WHERE id = ${userId}`);
    const userEmail = (userRes.rows[0] as any)?.email ?? "";

    const ref = signCheckoutRef(String(userId), String(planId));
    const url = new URL(plan.shopify_checkout_url);
    if (userEmail) url.searchParams.set("email", userEmail);
    url.searchParams.set("note_attributes[ref]", ref);
    url.searchParams.set("note_attributes[plan]", String(plan.name));

    logger.info({ userId, planId, ref }, "Checkout URL generada");
    res.json({ checkoutUrl: url.toString() });
  } catch (err: any) {
    logger.error({ err }, "POST /tienda/create-checkout error");
    res.status(500).json({ error: err.message });
  }
});

// ── CLIENT: POST /tienda/services/:id/checkout — pago único o suscripción mensual (Stripe) ──
router.post("/tienda/services/:id/checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).session?.userId ?? "");
    const clientId = (req as any).session?.clientId;
    const stripe = getStripe();
    if (!stripe) return void res.status(503).json({ error: "El pago con tarjeta no está disponible todavía. Escríbenos y te enviamos el enlace de pago." });
    const db = await getDb();
    const r = await db.execute(sql`
      SELECT id, name, price_eur, billing_interval FROM tienda_services WHERE id = ${Number(req.params.id)} AND visible = TRUE
    `);
    const service = r.rows[0] as unknown as SellableService | undefined;
    if (!service) return void res.status(404).json({ error: "Servicio no encontrado" });
    const u = await db.execute(sql`SELECT email FROM users WHERE id = ${userId}`);
    const s2 = await db.execute(sql`SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId}`);
    const APP = publicAppUrl() ?? "";
    const url = await createServiceCheckout(stripe, {
      userId,
      email: (u.rows[0] as { email?: string } | undefined)?.email,
      customerId: (s2.rows[0] as { stripe_customer_id?: string | null } | undefined)?.stripe_customer_id ?? null,
      service,
      projectId: clientId ? Number(clientId) : null,
      successUrl: `${APP}/client/tienda?stripe=success`,
      cancelUrl: `${APP}/client/tienda?stripe=cancelled`,
    });
    res.json({ url });
  } catch (err: any) {
    logger.error({ err: err?.message }, "POST /tienda/services/:id/checkout error");
    res.status(400).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── WEBHOOK: POST /api/webhooks/shopify/orders-paid ──────────────────────────
// Configure in Shopify Admin → Settings → Notifications → Webhooks
// Topic: orders/paid  |  URL: https://yourdomain.com/api/webhooks/shopify/orders-paid
// Secret: value of SHOPIFY_WEBHOOK_SECRET env var
router.post("/webhooks/shopify/orders-paid", async (req: Request, res: Response) => {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
    const hmacHeader = (req.headers["x-shopify-hmac-sha256"] as string) ?? "";

    // SECURITY: fail-closed (como webhook-gateway.ts). Antes, sin SHOPIFY_WEBHOOK_SECRET
    // se aceptaba cualquier POST y activaba el plan indicado en note_attributes.ref
    // para cualquier usuario.
    if (!secret) {
      logger.error("Shopify orders-paid: SHOPIFY_WEBHOOK_SECRET no configurado — petición rechazada");
      return void res.status(503).json({ error: "Webhook no configurado" });
    }
    const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) return void res.status(400).json({ error: "Falta el cuerpo original" });
    const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
    const digestBuf = Buffer.from(digest);
    const headerBuf = Buffer.from(hmacHeader);
    const valid = digestBuf.length === headerBuf.length && timingSafeEqual(digestBuf, headerBuf);
    if (!valid) {
      logger.warn("Shopify webhook HMAC inválido");
      return void res.status(401).json({ error: "HMAC inválido" });
    }

    const order = req.body as any;
    const noteAttributes: { name: string; value: string }[] = order.note_attributes ?? [];
    const refAttr = noteAttributes.find(a => a.name === "ref");

    if (!refAttr?.value) {
      logger.warn({ orderId: order.id }, "Webhook orders/paid sin ref — ignorado");
      return void res.sendStatus(200);
    }

    // El ref va en la URL de checkout (lo controla el comprador): solo vale si
    // lleva nuestra firma. Antes bastaba con escribir otro userId o planId.
    const verified = verifyCheckoutRef(refAttr.value);
    if (!verified) {
      logger.warn({ orderId: order.id }, "Webhook orders/paid con ref sin firma válida — ignorado");
      return void res.sendStatus(200);
    }
    const { userId, planId } = verified;

    const db = await getDb();

    const planRes = await db.execute(sql`
      SELECT id, price, period_days, stores_limit, images_included FROM billing_plans WHERE id = ${planId}
    `);
    const plan = planRes.rows[0] as any;
    if (!plan) {
      logger.warn({ planId }, "Plan no encontrado en webhook");
      return void res.sendStatus(200);
    }

    // Lo pagado debe cubrir el precio del plan (evita pagar el checkout de un
    // plan barato con el ref firmado de uno caro).
    const paid = Number(order.total_price ?? order.current_total_price ?? NaN);
    const price = Number(plan.price ?? 0);
    if (!Number.isFinite(paid) || paid + 0.01 < price) {
      logger.warn({ orderId: order.id, planId, paid, price }, "Webhook orders/paid: importe menor que el plan — no se activa");
      return void res.sendStatus(200);
    }

    const periodDays = Number(plan.period_days) || 30;
    const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS shopify_order_id TEXT`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
    // Columnas reales del esquema (antes period_end/… inexistentes: el INSERT
    // fallaba, se respondía 200 y el cliente pagaba sin recibir el plan).
    await db.execute(sql`
      INSERT INTO subscriptions (user_id, plan, status, current_period_end, stores_limit, images_included, trial_ends_at, cancel_at_period_end, shopify_order_id, updated_at)
      VALUES (${userId}, ${planId}, 'active', ${periodEnd.toISOString()}, ${plan.stores_limit ?? 1}, ${plan.images_included ?? 10}, NULL, 0, ${String(order.id ?? "")}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        plan               = EXCLUDED.plan,
        status             = 'active',
        current_period_end = EXCLUDED.current_period_end,
        stores_limit       = EXCLUDED.stores_limit,
        images_included    = EXCLUDED.images_included,
        trial_ends_at      = NULL,
        cancel_at_period_end = 0,
        shopify_order_id   = EXCLUDED.shopify_order_id,
        updated_at         = NOW()
    `);

    logger.info({ userId, planId, orderId: order.id }, "✅ Plan activado via Shopify webhook");
    res.sendStatus(200);
  } catch (err: any) {
    // 500 → Shopify reintenta (antes 200: un fallo de BD perdía el pago).
    logger.error({ err }, "POST /webhooks/shopify/orders-paid error");
    res.sendStatus(500);
  }
});

export default router;
