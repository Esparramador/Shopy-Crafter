/**
 * Cobro recurrente con Stripe: planes (mensual/anual) y servicios mensuales.
 *
 * Ciclo de vida que se sincroniza desde el webhook firmado:
 *   checkout.session.completed   → alta (guarda cliente y suscripción de Stripe)
 *   invoice.paid                 → renovación: extiende el periodo pagado
 *   invoice.payment_failed       → past_due (se mantiene el plan hasta que Stripe
 *                                  agote los reintentos y cancele)
 *   customer.subscription.updated→ estado y "cancelar al final del periodo"
 *   customer.subscription.deleted→ baja: el proyecto vuelve a cuotas de prueba
 *
 * El plan de pago también se aplica al proyecto del cliente (projects.plan),
 * que es donde checkProductionLimit aplica las cuotas reales. Antes pagar solo
 * cambiaba la tabla subscriptions y las cuotas no se movían.
 */
import Stripe from "stripe";
import { db, subscriptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { catalogPlan } from "./plan-catalog.js";

export const STRIPE_API_VERSION = "2026-05-27.dahlia" as const;

export type BillingInterval = "month" | "year";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION }) : null;
}

let schemaReady: Promise<void> | null = null;

/** Columnas y tablas del cobro recurrente (idempotente). */
export function ensureStripeBillingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT`);
      await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS service_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          project_id INTEGER,
          service_id INTEGER NOT NULL,
          service_name TEXT NOT NULL,
          stripe_subscription_id TEXT UNIQUE,
          stripe_customer_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'eur',
          interval TEXT NOT NULL DEFAULT 'month',
          current_period_end TIMESTAMPTZ,
          cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS service_orders (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          project_id INTEGER,
          service_id INTEGER NOT NULL,
          service_name TEXT NOT NULL,
          stripe_session_id TEXT UNIQUE,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'eur',
          status TEXT NOT NULL DEFAULT 'paid',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch(err => {
      schemaReady = null;
      logger.warn({ err }, "stripe billing schema setup failed");
      throw err;
    });
  }
  return schemaReady;
}

function addInterval(from: Date, interval: BillingInterval): Date {
  const d = new Date(from);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Precio vigente del plan: el configurado en billing_plans (lo que ve el cliente) o el del catálogo. */
export async function planPriceCents(planId: string, interval: BillingInterval): Promise<{ cents: number; name: string } | null> {
  const cat = catalogPlan(planId);
  if (!cat) return null;
  let monthly = cat.priceMonthly;
  let annual = cat.priceAnnual;
  let name = cat.name;
  try {
    const r = await db.execute(sql`SELECT name, price, price_annual FROM billing_plans WHERE id = ${planId} AND visible = TRUE LIMIT 1`);
    const row = r.rows[0] as { name?: string; price?: number; price_annual?: number } | undefined;
    if (row && Number(row.price) > 0) {
      monthly = Number(row.price);
      annual = Number(row.price_annual) > 0 ? Number(row.price_annual) : monthly * 10;
      name = row.name || name;
    }
  } catch { /* sin tabla: catálogo */ }
  const amount = interval === "year" ? annual : monthly;
  return amount > 0 ? { cents: Math.round(amount * 100), name } : null;
}

async function clientProjectId(userId: string): Promise<number | null> {
  const r = await db.execute(sql`SELECT client_id FROM users WHERE id = ${userId} LIMIT 1`);
  const id = Number((r.rows[0] as { client_id?: string | null } | undefined)?.client_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Aplica las cuotas del plan al proyecto del cliente (reinicia el contador mensual). */
async function syncProjectPlan(userId: string, planId: string): Promise<void> {
  const projectId = await clientProjectId(userId);
  if (!projectId) return;
  const renews = addInterval(new Date(), "month");
  await db.execute(sql`
    UPDATE projects SET plan = ${planId}, plan_renews_at = ${renews.toISOString()},
      products_used_this_month = 0, images_used_this_month = 0
    WHERE id = ${projectId}
  `);
}

async function upsertSubscription(userId: string, values: Partial<typeof subscriptionsTable.$inferInsert>): Promise<void> {
  const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (existing.length > 0) {
    await db.update(subscriptionsTable).set(values).where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, ...values });
  }
}

/** Activa un plan de pago (alta o cambio) y lo aplica al proyecto. */
export async function activatePlan(userId: string, planId: string, opts: {
  interval: BillingInterval; periodEnd?: Date; customerId?: string | null; subscriptionId?: string | null;
}): Promise<void> {
  const cat = catalogPlan(planId);
  if (!cat) throw new Error(`Plan desconocido: ${planId}`);
  await upsertSubscription(userId, {
    plan: planId,
    status: "active",
    storesLimit: 1,
    imagesIncluded: cat.imagesPerMonth,
    currentPeriodEnd: opts.periodEnd ?? addInterval(new Date(), opts.interval),
    trialEndsAt: null,
    cancelAtPeriodEnd: 0,
    ...(opts.customerId ? { stripeCustomerId: opts.customerId } : {}),
    ...(opts.subscriptionId ? { stripeSubscriptionId: opts.subscriptionId } : {}),
  });
  await db.execute(sql`UPDATE subscriptions SET billing_interval = ${opts.interval}, updated_at = NOW() WHERE user_id = ${userId}`).catch(() => {});
  await syncProjectPlan(userId, planId);
}

interface CheckoutUrls { successUrl: string; cancelUrl: string }

/**
 * IVA: los precios del catálogo son sin IVA. Con STRIPE_AUTOMATIC_TAX=1 (y Stripe
 * Tax activado en el panel) Stripe calcula y suma el IVA de cada cliente. Sin Stripe
 * Tax, STRIPE_TAX_RATE_ID (p. ej. un Tax Rate "IVA 21 %" exclusivo) se aplica a cada línea.
 */
function taxOptions(): { automatic_tax?: { enabled: true } } {
  return process.env.STRIPE_AUTOMATIC_TAX === "1" ? { automatic_tax: { enabled: true } } : {};
}

function lineTaxRates(): { tax_rates?: string[] } {
  const id = process.env.STRIPE_TAX_RATE_ID;
  return process.env.STRIPE_AUTOMATIC_TAX !== "1" && id ? { tax_rates: [id] } : {};
}

/** Cliente existente (sus datos fiscales se actualizan) o email para crear uno nuevo. */
function customerOptions(customerId?: string | null, email?: string | null) {
  if (customerId) return { customer: customerId, customer_update: { name: "auto" as const, address: "auto" as const } };
  return email ? { customer_email: email } : {};
}

export async function createPlanCheckout(stripe: Stripe, p: {
  userId: string; email?: string | null; planId: string; interval: BillingInterval; customerId?: string | null;
} & CheckoutUrls): Promise<string> {
  const price = await planPriceCents(p.planId, p.interval);
  if (!price) throw new Error("Plan no contratable");
  const cat = catalogPlan(p.planId)!;
  const metadata = { kind: "plan", userId: p.userId, planId: p.planId, interval: p.interval };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: `Shopy Crafter — Plan ${price.name}`,
          description: `${cat.productsPerMonth} productos y ${cat.imagesPerMonth} imágenes IA al mes`,
        },
        unit_amount: price.cents,
        recurring: { interval: p.interval },
      },
      quantity: 1,
      ...lineTaxRates(),
    }],
    subscription_data: { metadata },
    metadata,
    allow_promotion_codes: true,
    ...taxOptions(),
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    ...customerOptions(p.customerId, p.email),
  });
  if (!session.url) throw new Error("Stripe no devolvió la URL de pago");
  return session.url;
}

export interface SellableService {
  id: number; name: string; price_eur: number | string | null; billing_interval: string | null;
}

export async function createServiceCheckout(stripe: Stripe, p: {
  userId: string; email?: string | null; service: SellableService; projectId: number | null; customerId?: string | null;
} & CheckoutUrls): Promise<string> {
  const cents = Math.round(Number(p.service.price_eur) * 100);
  const interval = p.service.billing_interval;
  if (!(cents > 0) || (interval !== "month" && interval !== "one_time")) throw new Error("Este servicio se contrata por presupuesto");
  const metadata = {
    kind: "service", userId: p.userId, serviceId: String(p.service.id), serviceName: p.service.name.slice(0, 200),
    projectId: p.projectId ? String(p.projectId) : "", interval,
  };
  const recurring = interval === "month";
  const session = await stripe.checkout.sessions.create({
    mode: recurring ? "subscription" : "payment",
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: `Shopy Crafter — ${p.service.name}` },
        unit_amount: cents,
        ...(recurring ? { recurring: { interval: "month" as const } } : {}),
      },
      quantity: 1,
      ...lineTaxRates(),
    }],
    // Pago único: Stripe crea cliente y factura igual que en las suscripciones.
    ...(recurring
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata }, invoice_creation: { enabled: true, invoice_data: { metadata } }, ...(p.customerId ? {} : { customer_creation: "always" as const }) }),
    metadata,
    ...taxOptions(),
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    ...customerOptions(p.customerId, p.email),
  });
  if (!session.url) throw new Error("Stripe no devolvió la URL de pago");
  return session.url;
}

// ─── Webhook ────────────────────────────────────────────────────────────────

type Meta = Record<string, string | undefined>;

function idOf(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const id = (v as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function invoiceSubscription(inv: Stripe.Invoice): { id: string | null; metadata: Meta } {
  const details = inv.parent?.subscription_details;
  const legacy = (inv as unknown as { subscription?: unknown }).subscription;
  return {
    id: idOf(details?.subscription) ?? idOf(legacy),
    metadata: (details?.metadata ?? {}) as Meta,
  };
}

function invoicePeriodEnd(inv: Stripe.Invoice): Date | null {
  const ends = (inv.lines?.data ?? []).map(l => l.period?.end ?? 0).filter(n => n > 0);
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
}

async function onCheckoutCompleted(s: Stripe.Checkout.Session): Promise<void> {
  const m = (s.metadata ?? {}) as Meta;
  const kind = m.kind ?? (m.planId ? "plan" : undefined);
  if (s.mode === "subscription" && s.status !== "complete") return;
  if (s.mode === "payment" && s.payment_status !== "paid") return;
  if (!m.userId) { logger.warn({ sessionId: s.id }, "stripe: checkout sin userId"); return; }

  if (kind === "plan" && m.planId) {
    const interval: BillingInterval = m.interval === "year" ? "year" : "month";
    await activatePlan(m.userId, m.planId, { interval, customerId: idOf(s.customer), subscriptionId: idOf(s.subscription) });
    logger.info({ userId: m.userId, planId: m.planId, interval }, "✅ Stripe: plan activado");
    return;
  }

  if (kind === "service" && m.serviceId) {
    await ensureStripeBillingSchema();
    const projectId = m.projectId ? Number(m.projectId) : null;
    const amount = s.amount_total ?? 0;
    if (s.mode === "subscription") {
      const periodEnd = addInterval(new Date(), "month");
      await db.execute(sql`
        INSERT INTO service_subscriptions (user_id, project_id, service_id, service_name, stripe_subscription_id, stripe_customer_id, status, amount_cents, currency, interval, current_period_end)
        VALUES (${m.userId}, ${projectId}, ${Number(m.serviceId)}, ${m.serviceName ?? "Servicio"}, ${idOf(s.subscription)}, ${idOf(s.customer)}, 'active', ${amount}, ${s.currency ?? "eur"}, 'month', ${periodEnd.toISOString()})
        ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active', updated_at = NOW()
      `);
    } else {
      await db.execute(sql`
        INSERT INTO service_orders (user_id, project_id, service_id, service_name, stripe_session_id, amount_cents, currency, status)
        VALUES (${m.userId}, ${projectId}, ${Number(m.serviceId)}, ${m.serviceName ?? "Servicio"}, ${s.id}, ${amount}, ${s.currency ?? "eur"}, 'paid')
        ON CONFLICT (stripe_session_id) DO NOTHING
      `);
    }
    logger.info({ userId: m.userId, serviceId: m.serviceId, mode: s.mode }, "✅ Stripe: servicio contratado");
  }
}

async function onInvoicePaid(inv: Stripe.Invoice): Promise<void> {
  const { id: subId, metadata } = invoiceSubscription(inv);
  if (!subId) return;
  const periodEnd = invoicePeriodEnd(inv);
  if (metadata.kind === "service") {
    await ensureStripeBillingSchema();
    await db.execute(sql`
      UPDATE service_subscriptions SET status = 'active', current_period_end = ${periodEnd?.toISOString() ?? null}, updated_at = NOW()
      WHERE stripe_subscription_id = ${subId}
    `);
    return;
  }
  // Renovación de plan: se prolonga el periodo pagado.
  await db.update(subscriptionsTable)
    .set({ status: "active", ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) })
    .where(eq(subscriptionsTable.stripeSubscriptionId, subId));
}

async function onInvoiceFailed(inv: Stripe.Invoice): Promise<void> {
  const { id: subId, metadata } = invoiceSubscription(inv);
  if (!subId) return;
  if (metadata.kind === "service") {
    await ensureStripeBillingSchema();
    await db.execute(sql`UPDATE service_subscriptions SET status = 'past_due', updated_at = NOW() WHERE stripe_subscription_id = ${subId}`);
    return;
  }
  await db.update(subscriptionsTable).set({ status: "past_due" }).where(eq(subscriptionsTable.stripeSubscriptionId, subId));
}

async function onSubscriptionChanged(sub: Stripe.Subscription, deleted: boolean): Promise<void> {
  const m = (sub.metadata ?? {}) as Meta;
  const status = deleted ? "canceled" : sub.status;
  const cancelAtEnd = !!sub.cancel_at_period_end;
  if (m.kind === "service") {
    await ensureStripeBillingSchema();
    await db.execute(sql`
      UPDATE service_subscriptions SET status = ${status}, cancel_at_period_end = ${cancelAtEnd}, updated_at = NOW()
      WHERE stripe_subscription_id = ${sub.id}
    `);
    return;
  }
  await db.update(subscriptionsTable)
    .set({ status, cancelAtPeriodEnd: cancelAtEnd ? 1 : 0 })
    .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
  if (deleted && m.userId) {
    // Baja efectiva: el proyecto vuelve a las cuotas de prueba.
    const projectId = await clientProjectId(m.userId);
    if (projectId) await db.execute(sql`UPDATE projects SET plan = 'trial' WHERE id = ${projectId}`);
  }
}

/** Procesa un evento ya verificado con la firma del webhook. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "invoice.paid":
      return onInvoicePaid(event.data.object as Stripe.Invoice);
    case "invoice.payment_failed":
      return onInvoiceFailed(event.data.object as Stripe.Invoice);
    case "customer.subscription.updated":
      return onSubscriptionChanged(event.data.object as Stripe.Subscription, false);
    case "customer.subscription.deleted":
      return onSubscriptionChanged(event.data.object as Stripe.Subscription, true);
    default:
      return;
  }
}

// ─── Ingresos recurrentes (MRR) ─────────────────────────────────────────────

export async function recurringRevenue(): Promise<{
  mrr: number; activePlans: number; activeServices: number;
  byPlan: { planId: string; name: string; count: number; mrr: number }[];
  services: { name: string; count: number; mrr: number }[];
}> {
  await ensureStripeBillingSchema().catch(() => {});
  const subs = await db.execute(sql`
    SELECT plan, COALESCE(billing_interval, 'month') AS billing_interval, COUNT(*)::int AS n
    FROM subscriptions
    WHERE status IN ('active', 'past_due') AND stripe_subscription_id IS NOT NULL
    GROUP BY plan, COALESCE(billing_interval, 'month')
  `);
  const byPlanMap = new Map<string, { planId: string; name: string; count: number; mrr: number }>();
  for (const row of subs.rows as { plan: string; billing_interval: string; n: number }[]) {
    const cat = catalogPlan(row.plan);
    if (!cat) continue;
    const price = await planPriceCents(row.plan, row.billing_interval === "year" ? "year" : "month");
    const monthly = price ? (row.billing_interval === "year" ? price.cents / 12 : price.cents) / 100 : 0;
    const cur = byPlanMap.get(row.plan) ?? { planId: row.plan, name: cat.name, count: 0, mrr: 0 };
    cur.count += Number(row.n);
    cur.mrr += monthly * Number(row.n);
    byPlanMap.set(row.plan, cur);
  }
  const svc = await db.execute(sql`
    SELECT service_name, COUNT(*)::int AS n, SUM(amount_cents)::int AS cents
    FROM service_subscriptions WHERE status IN ('active', 'past_due')
    GROUP BY service_name
  `).catch(() => ({ rows: [] as unknown[] }));
  const services = (svc.rows as { service_name: string; n: number; cents: number }[])
    .map(r => ({ name: r.service_name, count: Number(r.n), mrr: Number(r.cents) / 100 }));
  const byPlan = [...byPlanMap.values()].map(p => ({ ...p, mrr: Math.round(p.mrr * 100) / 100 }));
  const mrr = byPlan.reduce((a, p) => a + p.mrr, 0) + services.reduce((a, s) => a + s.mrr, 0);
  return {
    mrr: Math.round(mrr * 100) / 100,
    activePlans: byPlan.reduce((a, p) => a + p.count, 0),
    activeServices: services.reduce((a, s) => a + s.count, 0),
    byPlan, services,
  };
}
