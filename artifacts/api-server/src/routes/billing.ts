import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, affiliatesTable, referralTrackingTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import Stripe from "stripe";
import { PLAN_CATALOG, planFeatures, TRIAL } from "../lib/plan-catalog.js";
import {
  STRIPE_API_VERSION, getStripe, activatePlan, createPlanCheckout, handleStripeEvent,
  recurringRevenue, ensureStripeBillingSchema, type BillingInterval,
} from "../lib/stripe-billing.js";
import { publicAppUrl } from "../lib/account-tokens.js";


const router = Router();

type BillingPlan = {
  name: string; price: number; priceAnnual: number; storesLimit: number; imagesIncluded: number; features: string[];
  periodDays: number; visible?: boolean;
};

// Planes de pago = catálogo único (lib/plan-catalog.ts). Cada plan es 1 tienda.
const PLANS: Record<string, BillingPlan> = {
  ...Object.fromEntries(PLAN_CATALOG.map(p => [p.id, {
    name: p.name, price: p.priceMonthly, priceAnnual: p.priceAnnual, storesLimit: 1,
    imagesIncluded: p.imagesPerMonth, periodDays: 30,
    features: planFeatures(p).map(f => f.text),
  } satisfies BillingPlan])),
  trial: {
    name: "Prueba", price: 0, priceAnnual: 0, storesLimit: 1, imagesIncluded: TRIAL.imagesPerMonth, periodDays: TRIAL.days,
    features: [`${TRIAL.productsPerMonth} productos`, `${TRIAL.imagesPerMonth} imágenes IA`], visible: false,
  },
  // Legados: solo para mostrar suscripciones antiguas; no se venden.
  pro: { name: "Pro (legado)", price: 297, priceAnnual: 0, storesLimit: 10, imagesIncluded: 2000, periodDays: 30, features: ["Legado"], visible: false },
  agency: { name: "Agency (legado)", price: 697, priceAnnual: 0, storesLimit: -1, imagesIncluded: -1, periodDays: 30, features: ["Legado"], visible: false },
};

/** Planes que se pueden contratar (con precio y del catálogo). */
const SELLABLE = new Set<string>(PLAN_CATALOG.map(p => p.id));

router.get("/billing/subscription", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

    if (!sub) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + TRIAL.days);
      const [created] = await db.insert(subscriptionsTable).values({
        userId,
        plan: "trial",
        status: "trialing",
        trialEndsAt: trialEnd,
        storesLimit: 1,
        imagesIncluded: TRIAL.imagesPerMonth,
      }).returning();
      res.json({ subscription: created, plan: PLANS.trial, daysRemaining: TRIAL.days });
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

// ── Seed canonical plans once per deploy (idempotent via version tag) ─────────
// v13: precios, cuotas y textos del catálogo único (antes 14/37/112/299 € con
// promesas que el sistema no cumplía: API Access, White-label, SLA, soporte 24/7…).
const CANONICAL_SEED_VERSION = "v13-catalog-2026-09";
const CANONICAL_BILLING_PLANS = [
  ...PLAN_CATALOG.map(p => ({
    id: p.id, name: p.name, price: p.priceMonthly, priceAnnual: p.priceAnnual,
    currency: "€", featured: p.featured, badge: p.badge,
    features: planFeatures(p),
    ctaLabel: p.ctaLabel, ctaStyle: p.featured ? "gold" : "ghost", ctaHref: "#fp-contact",
    storesLimit: 1, imagesIncluded: p.imagesPerMonth, sortOrder: p.sortOrder,
  })),
  {
    id: "personalizado", name: "A medida", price: 0, priceAnnual: 0,
    currency: "€", featured: false, badge: null,
    features: [
      { text: "Varias tiendas en una misma cuenta", included: true },
      { text: "Cuotas de productos e imágenes a medida", included: true },
      { text: "Diseño web y apps nativas", included: true },
      { text: "Presupuesto cerrado según alcance", included: true },
    ],
    ctaLabel: "Pedir presupuesto", ctaStyle: "ghost", ctaHref: "#fp-contact",
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
// Seed DESPUÉS de crear la tabla (antes se lanzaban en paralelo: en una BD nueva
// el seed podía correr sin billing_plans y no se sembraba nada hasta reiniciar).
const billingPlansReady = ensureBillingPlansTable().then(seedCanonicalBillingPlans);
void ensureStripeBillingSchema().catch(() => {});
void billingPlansReady;

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

    // ── Stripe Checkout (suscripción mensual o anual real) ───────────────────
    const stripe = getStripe();
    if (stripe && SELLABLE.has(planId)) {
      const interval: BillingInterval = (req.body as { interval?: string }).interval === "year" ? "year" : "month";
      const APP = publicAppUrl() ?? "";
      const [user] = await db.select({ email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const url = await createPlanCheckout(stripe, {
        userId, email: user?.email, planId, interval,
        customerId: existingSub[0]?.stripeCustomerId ?? null,
        successUrl: `${APP}/admin/billing?stripe=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP}/admin/billing?stripe=cancelled`,
      });
      logger.info({ userId, planId, interval }, "💳 Stripe Checkout de plan creado");
      res.json({
        requiresPayment: true,
        confirmationUrl: url,
        plan,
        message: `Redirigiendo a Stripe para el pago de ${plan.name}...`,
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

// Antes: activaba el plan del `state` (plan_userId, puesto por quien llama) sin
// sesión, sin cobro ni verificación con Shopify → Enterprise gratis para cualquiera
// y cambio de plan de otras cuentas. El flujo "Shopify" nunca creaba un cargo real
// (era una autorización OAuth vacía), así que se retira: el pago va por Stripe.
router.get("/billing/shopify/callback", (_req, res): void => {
  res.status(410).json({ error: "Flujo de pago retirado: usa el checkout de Stripe" });
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

// Facturas reales de Stripe. Antes se inventaba una factura "pagada" por mes
// transcurrido aunque no hubiera ningún cobro.
router.get("/billing/invoices", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const stripe = getStripe();
    if (!sub?.stripeCustomerId || !stripe) { res.json([]); return; }

    const list = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 24 });
    res.json(list.data.map(inv => ({
      id: inv.number ?? inv.id,
      date: new Date((inv.created ?? 0) * 1000).toISOString(),
      amount: (inv.amount_paid || inv.amount_due || 0) / 100,
      currency: inv.currency,
      status: inv.status,
      pdfUrl: inv.invoice_pdf ?? null,
      hostedUrl: inv.hosted_invoice_url ?? null,
    })));
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

    const stripe = getStripe();
    if (!stripe) { res.status(400).json({ error: "Stripe no configurado en esta plataforma" }); return; }
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
    if (!plan || !SELLABLE.has(planId)) { res.status(400).json({ error: `Plan desconocido: ${planId}` }); return; }

    const interval: BillingInterval = session.metadata?.interval === "year" ? "year" : "month";
    await activatePlan(String(userId), planId, {
      interval,
      customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
    });

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

  // SECURITY: fail-closed. Antes, sin secreto O sin cabecera stripe-signature se
  // aceptaba el payload tal cual: cualquiera podía enviar un checkout.session.completed
  // falso y activarse un plan de pago. Además rawBody no existía y constructEvent
  // fallaba siempre, así que la vía firmada nunca funcionó.
  if (!webhookSecret) {
    logger.error("stripe webhook: STRIPE_WEBHOOK_SECRET no configurado — petición rechazada");
    res.status(503).json({ error: "Webhook de Stripe no configurado" }); return;
  }
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!sig || !rawBody) {
    res.status(400).json({ error: "Falta la firma stripe-signature o el cuerpo original" }); return;
  }

  let event: Stripe.Event;
  try {
    // Verificar la firma no necesita la API key (new Stripe("") lanza si falta).
    event = Stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    logger.warn({ err: err.message }, "stripe webhook signature error");
    res.status(400).json({ error: `Webhook error: ${err.message}` }); return;
  }

  try {
    await handleStripeEvent(event);
  } catch (err: any) {
    // 500 → Stripe reintenta el evento más tarde (no se pierde un cobro).
    logger.error({ err: err?.message, type: event.type }, "stripe webhook: error procesando evento");
    res.status(500).json({ error: "Error procesando el evento" }); return;
  }

  res.json({ received: true });
});

// ── Checkout de plan para cualquier usuario autenticado (clientes incluidos) ──
router.post("/billing/checkout", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { planId, interval: rawInterval, returnPath } = req.body as { planId?: string; interval?: string; returnPath?: string };
    if (!planId || !SELLABLE.has(planId)) { res.status(400).json({ error: "Plan no válido" }); return; }
    const stripe = getStripe();
    if (!stripe) { res.status(503).json({ error: "El pago con tarjeta no está disponible todavía. Escríbenos y te enviamos el enlace de pago." }); return; }
    const interval: BillingInterval = rawInterval === "year" ? "year" : "month";
    const back = typeof returnPath === "string" && /^\/[a-z0-9/_-]*$/i.test(returnPath) ? returnPath : "/client/tienda";
    const APP = publicAppUrl() ?? "";
    const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const url = await createPlanCheckout(stripe, {
      userId, email: user?.email, planId, interval, customerId: sub?.stripeCustomerId ?? null,
      successUrl: `${APP}${back}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}${back}?stripe=cancelled`,
    });
    res.json({ url });
  } catch (err: any) {
    logger.error({ err: err?.message }, "billing/checkout error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── Portal de Stripe: cambiar tarjeta, ver facturas y cancelar la suscripción ──
router.post("/billing/portal", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const stripe = getStripe();
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (!stripe || !sub?.stripeCustomerId) { res.status(400).json({ error: "No hay una suscripción de pago asociada a tu cuenta" }); return; }
    const back = (req.body as { returnPath?: string })?.returnPath;
    const path = typeof back === "string" && /^\/[a-z0-9/_-]*$/i.test(back) ? back : "/client/tienda";
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${publicAppUrl() ?? ""}${path}`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err: err?.message }, "billing/portal error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ── Admin: ingresos recurrentes mensuales (MRR) reales ──
router.get("/billing/admin/mrr", requireAdmin, async (_req, res): Promise<void> => {
  try {
    res.json(await recurringRevenue());
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

/** Margen real del mes por cliente: ingreso de la suscripción − IA registrada − imágenes. */
router.get("/billing/admin/margins", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { projectMargins } = await import("../lib/ai-budget.js");
    const projects = await projectMargins();
    const totals = projects.reduce((t, p) => ({
      revenueEur: t.revenueEur + p.revenueEur,
      costEur: t.costEur + p.aiSpendEur + p.imageCostEur,
    }), { revenueEur: 0, costEur: 0 });
    res.json({
      projects,
      totals: {
        revenueEur: Math.round(totals.revenueEur * 100) / 100,
        costEur: Math.round(totals.costEur * 100) / 100,
        marginEur: Math.round((totals.revenueEur - totals.costEur) * 100) / 100,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
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
