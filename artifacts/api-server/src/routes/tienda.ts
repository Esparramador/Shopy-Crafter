import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

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

    const cnt = await db.execute(sql`SELECT COUNT(*) as c FROM tienda_services`);
    if (Number((cnt.rows[0] as any)?.c ?? 0) === 0) {
      await db.execute(sql`
        INSERT INTO tienda_services
          (name, description, short_desc, icon, price_display, features, cta_label, color_accent, sort_order)
        VALUES
          ('Auditoría Completa IA',
           'Análisis exhaustivo de tu tienda Shopify con inteligencia artificial. Revisión de SEO, conversión, UX, pricing y competencia.',
           'Análisis completo en 24h', '🔍', 'Desde €149',
           '["Análisis SEO técnico","Auditoría de conversión","Análisis de competidores","Revisión de pricing","Informe ejecutivo IA","1 sesión de consultoría"]',
           'Solicitar auditoría →', 'gold', 0),

          ('Setup Express 48h',
           'Configuración completa de todos los módulos IA de Shopy Crafter en tu tienda en menos de 48 horas.',
           'Todo configurado en 2 días', '⚡', 'Desde €299',
           '["Configuración de todos los módulos","Integración API Shopify","Configuración SEO inicial","Configuración chatbot IA","Formación de 1h incluida","Soporte 30 días post-setup"]',
           'Solicitar setup →', 'jade', 1),

          ('Pack 100 Imágenes IA',
           '100 imágenes de producto profesionales generadas con IA. Diferentes ángulos, fondos y estilos adaptados a tu marca.',
           '100 imágenes en 48h', '🖼️', 'Desde €199',
           '["100 imágenes de producto","Múltiples ángulos y estilos","Fondos blancos y lifestyle","Adaptadas a tu marca","Formato WebP optimizado","Entrega en 48h"]',
           'Solicitar pack →', 'gold', 2),

          ('SEO Técnico Full Pack',
           'Optimización SEO técnica completa de tu tienda. Schemas, meta tags, velocidad, Core Web Vitals y contenido optimizado.',
           'Posiciona más alto en Google', '🔍', 'Desde €399',
           '["Auditoría técnica completa","Optimización de schemas","Meta tags y títulos IA","Optimización de velocidad","Core Web Vitals","Contenido SEO optimizado","Informe mensual"]',
           'Solicitar SEO →', 'jade', 3),

          ('A/B Testing Pro',
           'Diseño, configuración y análisis de tests A/B para aumentar tu tasa de conversión. Con IA para identificar las mejores variantes.',
           'Aumenta tu conversión', '📊', 'Desde €249/mes',
           '["Hasta 5 tests simultáneos","Análisis estadístico IA","Informes semanales","Recomendaciones automáticas","Implementación de ganadores","Gestión continua"]',
           'Solicitar A/B →', 'gold', 4),

          ('Gestión Mensual IA',
           'Gestión y optimización continua de tu tienda Shopify con IA. Actualizaciones semanales, monitorización 24/7 y soporte dedicado.',
           'Tu tienda siempre optimizada', '🤖', 'Desde €799/mes',
           '["Optimización semanal","Monitorización 24/7","Actualizaciones de contenido","Gestión de pricing dinámico","Análisis de competidores","Account Manager dedicado","Reunión mensual de resultados"]',
           'Solicitar gestión →', 'jade', 5)
      `);
      logger.info("🌱 Tienda services seeded");
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
    } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "name requerido" }); return; }
    const db = await getDb();
    const result = await db.execute(sql`
      INSERT INTO tienda_services
        (name, description, short_desc, icon, price_display, features, cta_label,
         cta_url, badge, color_accent, sort_order, visible)
      VALUES (
        ${name},
        ${description ?? null},
        ${short_desc ?? null},
        ${icon ?? "⚡"},
        ${price_display ?? "Consultar precio"},
        ${JSON.stringify(features ?? [])}::jsonb,
        ${cta_label ?? "Solicitar →"},
        ${cta_url ?? null},
        ${badge ?? null},
        ${color_accent ?? "gold"},
        ${sort_order ?? 0},
        ${visible !== false}
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
    } = req.body ?? {};
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

    const ref = `${userId}:${planId}`;
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

// ── WEBHOOK: POST /api/webhooks/shopify/orders-paid ──────────────────────────
// Configure in Shopify Admin → Settings → Notifications → Webhooks
// Topic: orders/paid  |  URL: https://yourdomain.com/api/webhooks/shopify/orders-paid
// Secret: value of SHOPIFY_WEBHOOK_SECRET env var
router.post("/webhooks/shopify/orders-paid", async (req: Request, res: Response) => {
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
    const hmacHeader = (req.headers["x-shopify-hmac-sha256"] as string) ?? "";

    if (secret) {
      const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
      const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
      const digestBuf = Buffer.from(digest);
      const headerBuf = Buffer.from(hmacHeader);
      const valid = digestBuf.length === headerBuf.length && timingSafeEqual(digestBuf, headerBuf);
      if (!valid) {
        logger.warn("Shopify webhook HMAC inválido");
        return void res.status(401).json({ error: "HMAC inválido" });
      }
    }

    const order = req.body as any;
    const noteAttributes: { name: string; value: string }[] = order.note_attributes ?? [];
    const refAttr = noteAttributes.find(a => a.name === "ref");

    if (!refAttr?.value) {
      logger.warn({ orderId: order.id }, "Webhook orders/paid sin ref — ignorado");
      return void res.sendStatus(200);
    }

    const [userId, planId] = refAttr.value.split(":");
    if (!userId || !planId) return void res.sendStatus(200);

    const db = await getDb();

    const planRes = await db.execute(sql`
      SELECT id, period_days FROM billing_plans WHERE id = ${planId}
    `);
    const plan = planRes.rows[0] as any;
    if (!plan) {
      logger.warn({ planId }, "Plan no encontrado en webhook");
      return void res.sendStatus(200);
    }

    const periodDays = plan.period_days ?? 30;
    const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

    await db.execute(sql`
      INSERT INTO subscriptions (user_id, plan, status, period_end, shopify_order_id, updated_at)
      VALUES (${userId}, ${planId}, 'active', ${periodEnd.toISOString()}, ${String(order.id ?? "")}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        plan            = EXCLUDED.plan,
        status          = 'active',
        period_end      = EXCLUDED.period_end,
        shopify_order_id = EXCLUDED.shopify_order_id,
        updated_at      = NOW()
    `);

    logger.info({ userId, planId, orderId: order.id }, "✅ Plan activado via Shopify webhook");
    res.sendStatus(200);
  } catch (err: any) {
    logger.error({ err }, "POST /webhooks/shopify/orders-paid error");
    res.sendStatus(200);
  }
});

export default router;
