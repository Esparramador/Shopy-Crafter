import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, affiliatesTable, referralTrackingTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-01-27.acacia" as const;

const router = Router();

const PLANS: Record<string, {
  name: string; price: number; storesLimit: number; imagesIncluded: number; features: string[];
  periodDays: number; visible?: boolean;
}> = {
  emprendedor: {
    name: "Emprendedor", price: 14, storesLimit: 1, imagesIncluded: 10, periodDays: 30,
    features: ["1 tienda", "5 productos/mes", "10 imágenes IA/mes", "Auditoría Shopify", "Chatbot IA", "SEO básico"],
  },
  starter: {
    name: "Starter", price: 37, storesLimit: 3, imagesIncluded: 45, periodDays: 30,
    features: ["3 tiendas", "15 productos/mes", "45 imágenes IA/mes", "Todos los módulos IA", "SEO técnico", "Pricing dinámico", "Soporte prioritario"],
  },
  agency_pro: {
    name: "Growth", price: 112, storesLimit: 10, imagesIncluded: 300, periodDays: 30,
    features: ["10 tiendas", "60 productos/mes", "300 imágenes IA/mes", "A/B Testing", "Informes Pro", "Análisis competidores", "API Access"],
  },
  enterprise: {
    name: "Enterprise", price: 299, storesLimit: -1, imagesIncluded: 1200, periodDays: 30,
    features: ["Tiendas ilimitadas", "200 productos/mes", "1.200 imágenes IA/mes", "A/B Testing ilimitado", "White-label", "Account Manager", "Soporte 24/7"],
  },
  trial: {
    name: "Trial", price: 0, storesLimit: 1, imagesIncluded: 100, periodDays: 14,
    features: ["1 tienda", "100 imágenes IA", "Auditoría básica"],
    visible: false,
  },
  pro: {
    name: "Pro (legado)", price: 297, storesLimit: 10, imagesIncluded: 2000, periodDays: 30,
    features: ["Legado"], visible: false,
  },
  agency: {
    name: "Agency (legado)", price: 697, storesLimit: -1, imagesIncluded: -1, periodDays: 30,
    features: ["Legado"], visible: false,
  },
};

router.get("/billing/subscription", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

    if (!sub) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const [created] = await db.insert(subscriptionsTable).values({
        userId,
        plan: "trial",
        status: "trialing",
        trialEndsAt: trialEnd,
        storesLimit: 1,
        imagesIncluded: 100,
      }).returning();
      res.json({ subscription: created, plan: PLANS.trial, daysRemaining: 14 });
      return;
    }

    const plan = PLANS[sub.plan as keyof typeof PLANS] ?? PLANS.trial;
    const daysRemaining = sub.trialEndsAt
      ? Math.max(0, Math.floor((sub.trialEndsAt.getTime() - Date.now()) / 86400000))
      : null;

    res.json({ subscription: sub, plan, daysRemaining });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Billing Plans DB table (no-migration approach: raw SQL) ─────────────────
async function ensureBillingPlansTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS billing_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        price_annual REAL DEFAULT 0,
        currency TEXT DEFAULT '€',
        period TEXT DEFAULT '/mes',
        featured BOOLEAN DEFAULT FALSE,
        badge TEXT,
        features JSONB DEFAULT '[]',
        cta_label TEXT DEFAULT 'Contactar →',
        cta_style TEXT DEFAULT 'ghost',
        cta_href TEXT DEFAULT '#fp-contact',
        stores_limit INTEGER DEFAULT 1,
        images_included INTEGER DEFAULT 10,
        period_days INTEGER DEFAULT 30,
        visible BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS shopify_checkout_url TEXT`);
    await db.execute(sql`ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS user_id TEXT`);
    await db.execute(sql`ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('payment_method', 'stripe')
      ON CONFLICT (key) DO NOTHING
    `);
  } catch (err) {
    logger.warn({ err }, "billing_plans table setup warning");
  }
}
ensureBillingPlansTable();

// ── Seed canonical plans once per deploy (idempotent via version tag) ─────────
const CANONICAL_SEED_VERSION = "v12-canonical-5plans-2026-mid";
const CANONICAL_BILLING_PLANS = [
  {
    id: "emprendedor",
    name: "Emprendedor",
    price: 14, priceAnnual: 140,
    currency: "€", featured: false, badge: null,
    features: [
      { text: "5 productos/mes", included: true },
      { text: "10 imágenes IA/mes", included: true },
      { text: "Auditoría de tienda Shopify", included: true },
      { text: "Chatbot IA de atención", included: true },
      { text: "SEO básico automático", included: true },
      { text: "Soporte por email", included: true },
      { text: "A/B Testing", included: false },
      { text: "API Access", included: false },
    ],
    ctaLabel: "Empezar →", ctaStyle: "ghost", ctaHref: "#fp-contact",
    storesLimit: 1, imagesIncluded: 10, sortOrder: 0,
  },
  {
    id: "starter",
    name: "Starter",
    price: 37, priceAnnual: 370,
    currency: "€", featured: false, badge: null,
    features: [
      { text: "15 productos/mes", included: true },
      { text: "45 imágenes IA/mes", included: true },
      { text: "Todos los módulos de IA", included: true },
      { text: "SEO técnico automático", included: true },
      { text: "Pricing dinámico con IA", included: true },
      { text: "Soporte prioritario", included: true },
      { text: "A/B Testing", included: false },
      { text: "API Access", included: false },
    ],
    ctaLabel: "Solicitar acceso →", ctaStyle: "ghost", ctaHref: "#fp-contact",
    storesLimit: 3, imagesIncluded: 45, sortOrder: 1,
  },
  {
    id: "agency_pro",
    name: "Growth",
    price: 112, priceAnnual: 1120,
    currency: "€", featured: true, badge: "Más popular",
    features: [
      { text: "60 productos/mes", included: true },
      { text: "300 imágenes IA/mes", included: true },
      { text: "Todos los módulos de IA", included: true },
      { text: "A/B Testing (hasta 10 activos)", included: true },
      { text: "Informes Pro mensuales", included: true },
      { text: "Análisis de competidores en vivo", included: true },
      { text: "API Access + Webhooks", included: true },
      { text: "Soporte prioritario 12h", included: true },
    ],
    ctaLabel: "Empezar ahora →", ctaStyle: "gold", ctaHref: "#fp-contact",
    storesLimit: 10, imagesIncluded: 300, sortOrder: 2,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 299, priceAnnual: 2990,
    currency: "€", featured: false, badge: null,
    features: [
      { text: "200 productos/mes", included: true },
      { text: "1.200 imágenes IA/mes", included: true },
      { text: "A/B Testing ilimitado", included: true },
      { text: "Informes ejecutivos semanales", included: true },
      { text: "White-label & Multi-tienda", included: true },
      { text: "Account Manager dedicado", included: true },
      { text: "API privada + acceso prioritario", included: true },
      { text: "Soporte 24/7 dedicado", included: true },
    ],
    ctaLabel: "Hablar con ventas →", ctaStyle: "ghost", ctaHref: "#fp-contact",
    storesLimit: -1, imagesIncluded: 1200, sortOrder: 3,
  },
  {
    id: "personalizado",
    name: "A medida",
    price: 0, priceAnnual: 0,
    currency: "€", featured: false, badge: null,
    features: [
      { text: "Productos y tiendas ilimitadas", included: true },
      { text: "Imágenes IA ilimitadas", included: true },
      { text: "Integración personalizada", included: true },
      { text: "SLA contractual garantizado", included: true },
      { text: "Onboarding dedicado", included: true },
      { text: "Formación al equipo", included: true },
      { text: "Facturación flexible", included: true },
      { text: "Acceso prioritario a nuevos motores", included: true },
    ],
    ctaLabel: "Solicitar propuesta →", ctaStyle: "ghost", ctaHref: "#fp-contact",
    storesLimit: -1, imagesIncluded: -1, sortOrder: 4,
  },
];

async function seedCanonicalBillingPlans(): Promise<void> {
  try {
    const existing = await db.execute(sql`
      SELECT id FROM billing_plans WHERE id = 'seed-version-tag' LIMIT 1
    `).catch(() => ({ rows: [] as any[] }));
    const versionRow = await db.execute(sql`
      SELECT badge FROM billing_plans WHERE id = ${CANONICAL_SEED_VERSION} LIMIT 1
    `).catch(() => ({ rows: [] as any[] }));
    if (versionRow.rows.length > 0) return;

    logger.info("🌱 Seeding canonical billing plans...");
    await db.execute(sql`UPDATE billing_plans SET visible = FALSE`);
    for (const p of CANONICAL_BILLING_PLANS) {
      await db.execute(sql`
        INSERT INTO billing_plans
          (id,name,price,price_annual,currency,period,featured,badge,features,cta_label,cta_style,cta_href,stores_limit,images_included,period_days,visible,sort_order)
        VALUES (
          ${p.id}, ${p.name}, ${p.price}, ${p.priceAnnual}, ${p.currency}, '/mes',
          ${p.featured}, ${p.badge ?? null}, ${JSON.stringify(p.features)},
          ${p.ctaLabel}, ${p.ctaStyle}, ${p.ctaHref},
          ${p.storesLimit}, ${p.imagesIncluded}, 30, TRUE, ${p.sortOrder}
        )
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name, price=EXCLUDED.price, price_annual=EXCLUDED.price_annual,
          featured=EXCLUDED.featured, badge=EXCLUDED.badge, features=EXCLUDED.features,
          cta_label=EXCLUDED.cta_label, cta_style=EXCLUDED.cta_style, cta_href=EXCLUDED.cta_href,
          stores_limit=EXCLUDED.stores_limit, images_included=EXCLUDED.images_included,
          visible=TRUE, sort_order=EXCLUDED.sort_order
      `);
    }
    await db.execute(sql`
      INSERT INTO billing_plans (id,name,price,visible,sort_order)
      VALUES (${CANONICAL_SEED_VERSION}, 'seed-version', 0, FALSE, 999)
      ON CONFLICT (id) DO NOTHING
    `);
    logger.info("✅ Canonical billing plans seeded");
  } catch (err) {
    logger.warn({ err }, "billing plans seed warning (non-fatal)");
  }
}
seedCanonicalBillingPlans();

function rowToPlan(row: any) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    priceAnnual: Number(row.price_annual ?? row.price * 10),
    currency: row.currency ?? "€",
    period: row.period ?? "/mes",
    featured: !!row.featured,
    badge: row.badge ?? null,
    features: Array.isArray(row.features) ? row.features : JSON.parse(row.features ?? "[]"),
    ctaLabel: row.cta_label ?? "Contactar →",
    ctaStyle: row.cta_style ?? "ghost",
    ctaHref: row.cta_href ?? "/contacto",
    storesLimit: Number(row.stores_limit ?? 1),
    imagesIncluded: Number(row.images_included ?? 10),
  };
}

router.get("/billing/plans", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId as string | undefined;
    const result = userId
      ? await db.execute(sql`
          SELECT * FROM billing_plans
          WHERE visible = TRUE AND (user_id IS NULL OR user_id = ${userId})
          ORDER BY sort_order ASC, created_at ASC
        `)
      : await db.execute(sql`
          SELECT * FROM billing_plans
          WHERE visible = TRUE AND user_id IS NULL
          ORDER BY sort_order ASC, created_at ASC
        `);
    res.json(result.rows.map(rowToPlan));
  } catch {
    res.json([]);
  }
});

router.post("/billing/plans", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { id, name, price, priceAnnual, currency = "€", period = "/mes", featured = false,
      badge = null, features = [], ctaLabel = "Contactar →", ctaStyle = "ghost",
      ctaHref = "/contacto", storesLimit = 1, imagesIncluded = 10,
      userId = null, paymentMethod = "stripe" } = req.body as Record<string, any>;
    if (!id || !name || price == null) { res.status(400).json({ error: "id, name y price son requeridos" }); return; }
    const maxRes = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM billing_plans`);
    const nextOrder = Number((maxRes.rows[0] as any)?.m ?? -1) + 1;
    await db.execute(sql`
      INSERT INTO billing_plans (id,name,price,price_annual,currency,period,featured,badge,features,cta_label,cta_style,cta_href,stores_limit,images_included,period_days,visible,sort_order,user_id,payment_method)
      VALUES (${id},${name},${Number(price)},${Number(priceAnnual ?? price * 10)},${currency},${period},${!!featured},${badge ?? null},${JSON.stringify(features)},${ctaLabel},${ctaStyle},${ctaHref},${Number(storesLimit)},${Number(imagesIncluded)},30,TRUE,${nextOrder},${userId ?? null},${paymentMethod})
    `);
    logger.info({ id, name, userId }, "✅ billing_plan created");
    res.json({ ok: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.put("/billing/plans/:planId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { planId } = req.params;
    const { name, price, priceAnnual, currency, period, featured, badge, features,
      ctaLabel, ctaStyle, ctaHref, storesLimit, imagesIncluded } = req.body as Record<string, any>;
    await db.execute(sql`
      UPDATE billing_plans SET
        name=${name}, price=${Number(price)}, price_annual=${Number(priceAnnual ?? price * 10)},
        currency=${currency ?? "€"}, period=${period ?? "/mes"}, featured=${!!featured},
        badge=${badge ?? null}, features=${JSON.stringify(features ?? [])},
        cta_label=${ctaLabel ?? "Contactar →"}, cta_style=${ctaStyle ?? "ghost"}, cta_href=${ctaHref ?? "/contacto"},
        stores_limit=${Number(storesLimit ?? 1)}, images_included=${Number(imagesIncluded ?? 10)}
      WHERE id=${planId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/billing/plans/:planId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { planId } = req.params;
    await db.execute(sql`UPDATE billing_plans SET visible=FALSE WHERE id=${planId}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/billing/upgrade", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    const role = (req.session as any).role;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { plan: planId } = req.body as { plan: string };
    if (!planId || !PLANS[planId]) {
      res.status(400).json({ error: "Plan no válido", validPlans: Object.keys(PLANS) });
      return;
    }

    const plan = PLANS[planId];

    const existingSub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const currentPlan = existingSub[0]?.plan ?? "trial";

    if (currentPlan === planId) {
      res.status(400).json({ error: "Ya estás en este plan." });
      return;
    }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const isAdmin = role === "admin";
    const isFreeDowngrade = plan.price === 0;

    if (isAdmin || isFreeDowngrade) {
      const updates = {
        plan: planId,
        status: planId === "trial" ? "trialing" : "active",
        storesLimit: plan.storesLimit,
        imagesIncluded: plan.imagesIncluded,
        currentPeriodEnd: isFreeDowngrade ? null : periodEnd,
        trialEndsAt: planId === "trial" ? periodEnd : null,
        cancelAtPeriodEnd: 0,
      };

      if (existingSub.length > 0) {
        const [updated] = await db.update(subscriptionsTable)
          .set(updates)
          .where(eq(subscriptionsTable.userId, userId))
          .returning();
        logger.info({ userId, plan: planId, role }, "✅ Plan actualizado");
        res.json({ subscription: updated, plan, message: `Plan actualizado a ${plan.name}` });
      } else {
        const [created] = await db.insert(subscriptionsTable)
          .values({ userId, ...updates })
          .returning();
        logger.info({ userId, plan: planId, role }, "✅ Suscripción creada");
        res.json({ subscription: created, plan, message: `Plan activado: ${plan.name}` });
      }
      return;
    }

    const APP_URL = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

    // ── Stripe Checkout (when STRIPE_SECRET_KEY is configured) ───────────────
    const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
    if (STRIPE_SECRET) {
      const stripe = new Stripe(STRIPE_SECRET, { apiVersion: STRIPE_API_VERSION });
      const [user] = await db.select({ email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `Shopy Crafter — ${plan.name}`,
              description: plan.features.slice(0, 3).join(" · "),
            },
            unit_amount: Math.round(plan.price * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        success_url: `${APP_URL}/admin/billing?stripe=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/admin/billing?stripe=cancelled`,
        metadata: { userId, planId },
        ...(user?.email ? { customer_email: user.email } : {}),
      });
      logger.info({ userId, planId, sessionId: session.id }, "💳 Stripe Checkout session creada");
      res.json({
        requiresPayment: true,
        confirmationUrl: session.url!,
        plan,
        message: `Redirigiendo a Stripe para confirmar el pago de ${plan.name} (€${plan.price}/mes)...`,
      });
      return;
    }

    const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;

    if (SHOPIFY_CLIENT_ID) {
      const returnUrl = `${APP_URL}/api/billing/shopify/callback`;
      const confirmationUrl = `https://accounts.shopify.com/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=&redirect_uri=${encodeURIComponent(returnUrl)}&state=${planId}_${userId}`;
      res.json({
        requiresPayment: true,
        confirmationUrl,
        plan,
        message: `Serás redirigido a Shopify para confirmar el pago de ${plan.name} (€${plan.price}/mes)`,
      });
      return;
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "craftershopy@gmail.com";
    const subject = encodeURIComponent(`Solicitud de upgrade al plan ${plan.name}`);
    const body = encodeURIComponent(
      `Hola,\n\nQuiero actualizar mi plan a ${plan.name} (€${plan.price}/mes).\n\n` +
      `Mi ID de usuario: ${userId}\n\nGracias.`
    );
    const mailtoUrl = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;

    res.json({
      requiresManualPayment: true,
      checkoutUrl: mailtoUrl,
      plan,
      message: `Para activar el plan ${plan.name} (€${plan.price}/mes), contacta con soporte. Se generará un link de pago personalizado.`,
      contactEmail: ADMIN_EMAIL,
      price: plan.price,
      planName: plan.name,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err: msg }, "billing/upgrade error");
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/shopify/callback", async (req, res): Promise<void> => {
  try {
    const { state, code } = req.query as { state?: string; code?: string };
    if (!state) { res.status(400).json({ error: "Estado inválido" }); return; }

    const [planId, userId] = state.split("_");
    const plan = PLANS[planId];
    if (!plan || !userId) { res.status(400).json({ error: "Parámetros inválidos" }); return; }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const updates = {
      plan: planId,
      status: "active",
      storesLimit: plan.storesLimit,
      imagesIncluded: plan.imagesIncluded,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      cancelAtPeriodEnd: 0,
    };

    if (existing.length > 0) {
      await db.update(subscriptionsTable).set(updates).where(eq(subscriptionsTable.userId, userId));
    } else {
      await db.insert(subscriptionsTable).values({ userId, ...updates });
    }

    logger.info({ userId, planId, code }, "✅ Shopify billing callback processed");
    const APP_URL = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    res.redirect(`${APP_URL}/#billing?success=1&plan=${planId}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/affiliate", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, userId));
    if (!affiliate) { res.json({ affiliate: null }); return; }

    const referrals = await db.select().from(referralTrackingTable)
      .where(eq(referralTrackingTable.affiliateId, affiliate.id));

    res.json({ affiliate, referrals });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/billing/affiliate/join", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const existing = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, userId));
    if (existing.length > 0) { res.json({ affiliate: existing[0] }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const code = (user?.name || "user").toLowerCase().replace(/\s+/, "") + Math.random().toString(36).slice(2, 6);

    const [affiliate] = await db.insert(affiliatesTable).values({
      id: randomUUID(), userId, referralCode: code,
    }).returning();

    res.json({ affiliate, message: "¡Bienvenido al programa de afiliados!" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/invoices", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (!sub) { res.json([]); return; }

    const plan = PLANS[sub.plan as keyof typeof PLANS] ?? PLANS.trial;
    const invoices = [];
    if (sub.status === "active" && sub.currentPeriodEnd) {
      const months = Math.min(6, Math.max(1, Math.round((Date.now() - (sub.createdAt?.getTime?.() ?? Date.now())) / 2592000000) + 1));
      for (let i = 0; i < months; i++) {
        const date = new Date(Date.now() - i * 2592000000);
        invoices.push({
          id: `INV-${String(i + 1).padStart(3, "0")}`,
          date: date.toISOString(),
          amount: plan.price,
          plan: plan.name,
          status: "paid",
        });
      }
    }
    res.json(invoices);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/billing/admin/upgrade-user", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { userId, plan: planId, reason } = req.body as { userId: string; plan: string; reason?: string };

    if (!userId) { res.status(400).json({ error: "userId requerido" }); return; }
    if (!planId || !PLANS[planId]) {
      res.status(400).json({ error: "Plan no válido", validPlans: Object.keys(PLANS) });
      return;
    }

    const plan = PLANS[planId];
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const updates = {
      plan: planId,
      status: planId === "trial" ? "trialing" : "active",
      storesLimit: plan.storesLimit,
      imagesIncluded: plan.imagesIncluded,
      currentPeriodEnd: planId === "trial" ? null : periodEnd,
      trialEndsAt: planId === "trial" ? periodEnd : null,
      cancelAtPeriodEnd: 0,
    };

    if (existing.length > 0) {
      const [updated] = await db.update(subscriptionsTable)
        .set(updates)
        .where(eq(subscriptionsTable.userId, userId))
        .returning();
      logger.info({ targetUserId: userId, planId, reason }, "👑 Admin: plan actualizado manualmente");
      res.json({ subscription: updated, plan, message: `Usuario actualizado a ${plan.name}` });
    } else {
      const [created] = await db.insert(subscriptionsTable)
        .values({ userId, ...updates })
        .returning();
      logger.info({ targetUserId: userId, planId, reason }, "👑 Admin: suscripción creada manualmente");
      res.json({ subscription: created, plan, message: `Suscripción ${plan.name} creada para el usuario` });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Admin: payment method global settings ─────────────────────────────────
router.get("/billing/admin/payment-settings", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`SELECT value FROM app_settings WHERE key = 'payment_method'`);
    const method = (result.rows[0] as any)?.value ?? "stripe";
    res.json({ method });
  } catch {
    res.json({ method: "stripe" });
  }
});

router.put("/billing/admin/payment-settings", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { method } = req.body as { method: string };
    const valid = ["stripe", "shopify", "manual"];
    if (!valid.includes(method)) { res.status(400).json({ error: "Método inválido. Use: stripe, shopify, manual" }); return; }
    await db.execute(sql`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('payment_method', ${method}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    logger.info({ method }, "💳 Payment method updated");
    res.json({ ok: true, method });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── Admin: all plans (including user-specific) ─────────────────────────────
router.get("/billing/admin/plans-all", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT bp.*, u.email AS user_email, u.name AS user_name
      FROM billing_plans bp
      LEFT JOIN users u ON bp.user_id = u.id
      WHERE bp.visible = TRUE
      ORDER BY bp.sort_order ASC, bp.created_at ASC
    `);
    res.json(result.rows.map(r => ({
      ...rowToPlan(r),
      userId: (r as any).user_id ?? null,
      userEmail: (r as any).user_email ?? null,
      userName: (r as any).user_name ?? null,
      paymentMethod: (r as any).payment_method ?? "stripe",
    })));
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── Admin: assign a custom plan to a specific user ─────────────────────────
router.post("/billing/admin/assign-user-plan", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { planId, userId, reason } = req.body as { planId: string; userId: string; reason?: string };
    if (!planId || !userId) { res.status(400).json({ error: "planId y userId son requeridos" }); return; }
    // Update the billing plan to restrict it to this user
    await db.execute(sql`UPDATE billing_plans SET user_id = ${userId} WHERE id = ${planId}`);
    logger.info({ planId, userId, reason }, "👑 Plan asignado a usuario específico");
    res.json({ ok: true, message: `Plan "${planId}" asignado a usuario ${userId}` });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── GET /billing/stripe/verify?session_id=... ────────────────────────────────
// Called by the frontend after Stripe redirects back with ?stripe=success&session_id=...
// Verifies the payment was successful and activates the subscription.
router.get("/billing/stripe/verify", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { session_id } = req.query as { session_id?: string };
    if (!session_id) { res.status(400).json({ error: "session_id requerido" }); return; }

    const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET) { res.status(400).json({ error: "Stripe no configurado en esta plataforma" }); return; }

    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: STRIPE_API_VERSION });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: `El pago aún no se ha completado (estado: ${session.payment_status})` }); return;
    }

    // Extract metadata saved when the session was created
    const metaUserId = session.metadata?.userId ?? "";
    const planId = session.metadata?.planId ?? "";

    // Security: ensure the session belongs to this user
    if (metaUserId && metaUserId !== String(userId)) {
      res.status(403).json({ error: "Esta sesión no pertenece a tu cuenta" }); return;
    }

    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) { res.status(400).json({ error: `Plan desconocido: ${planId}` }); return; }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const updates = {
      plan: planId,
      status: "active",
      storesLimit: plan.storesLimit,
      imagesIncluded: plan.imagesIncluded,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      cancelAtPeriodEnd: 0,
    };

    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, String(userId)));
    if (existing.length > 0) {
      await db.update(subscriptionsTable).set(updates).where(eq(subscriptionsTable.userId, String(userId)));
    } else {
      await db.insert(subscriptionsTable).values({ userId: String(userId), ...updates });
    }

    logger.info({ userId, planId, sessionId: session_id }, "✅ Stripe verify: suscripción activada");
    res.json({ success: true, plan: { ...plan, id: planId }, message: `¡Plan ${plan.name} activado correctamente!` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Error interno";
    logger.error({ err: msg }, "billing/stripe/verify error");
    res.status(500).json({ error: msg });
  }
});

// ── POST /billing/stripe/webhook ─────────────────────────────────────────────
// Stripe sends checkout.session.completed here (configure in Stripe Dashboard).
// Requires STRIPE_WEBHOOK_SECRET from the Stripe Dashboard → Webhooks section.
router.post("/billing/stripe/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;
  try {
    if (webhookSecret && sig) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: STRIPE_API_VERSION });
      event = stripe.webhooks.constructEvent((req as any).rawBody ?? req.body, sig, webhookSecret);
    } else {
      // No webhook secret configured — accept the payload directly (less secure, OK for dev)
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "stripe webhook signature error");
    res.status(400).json({ error: `Webhook error: ${err.message}` }); return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    if (session.payment_status !== "paid") { res.json({ received: true }); return; }

    const metaUserId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const plan = PLANS[planId as keyof typeof PLANS];

    if (!metaUserId || !plan) {
      logger.warn({ metaUserId, planId }, "stripe webhook: missing metadata");
      res.json({ received: true }); return;
    }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);
    const updates = {
      plan: planId,
      status: "active",
      storesLimit: plan.storesLimit,
      imagesIncluded: plan.imagesIncluded,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      cancelAtPeriodEnd: 0,
    };

    try {
      const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, metaUserId));
      if (existing.length > 0) {
        await db.update(subscriptionsTable).set(updates).where(eq(subscriptionsTable.userId, metaUserId));
      } else {
        await db.insert(subscriptionsTable).values({ userId: metaUserId, ...updates });
      }
      logger.info({ metaUserId, planId, sessionId: session.id }, "✅ Stripe webhook: suscripción activada");
    } catch (err: any) {
      logger.error({ err: err.message }, "stripe webhook: DB error");
      res.status(500).json({ error: "DB error" }); return;
    }
  }

  res.json({ received: true });
});

router.get("/billing/admin/subscriptions", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const subs = await db.select({
      userId: subscriptionsTable.userId,
      plan: subscriptionsTable.plan,
      status: subscriptionsTable.status,
      trialEndsAt: subscriptionsTable.trialEndsAt,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      storesLimit: subscriptionsTable.storesLimit,
      imagesIncluded: subscriptionsTable.imagesIncluded,
      imagesUsed: subscriptionsTable.imagesUsed,
      createdAt: subscriptionsTable.createdAt,
      email: usersTable.email,
      name: usersTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
    .orderBy(subscriptionsTable.createdAt);

    res.json(subs);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
