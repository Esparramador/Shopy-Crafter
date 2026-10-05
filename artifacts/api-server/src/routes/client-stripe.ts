/**
 * client-stripe.ts — Vista de cliente (sesión de cliente, sin permisos admin)
 * de SU cuenta Stripe. Solo lectura. Montado en /api/client/stripe/*.
 *
 * Toda la información sale de la API de Stripe en tiempo real a través de
 * resolveStripeForProject(pid, { strict: true }) — nunca de la cuenta Master.
 */
import { Router, type Request, type Response } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getPlatform } from "../lib/platform-capabilities.js";
import { monthlyAmount, type Interval } from "../lib/stripe-commerce.js";
import {
  resolveStripeForProject,
  getStripeConnection,
  StripeNotLinkedError,
} from "../lib/stripe-tenant.js";

const router = Router();

function getClientProjectId(req: Request): number {
  const s: any = req.session ?? {};
  if (s.clientId) return parseInt(String(s.clientId), 10) || 0;
  if (s.role === "admin" && req.query.pid) return parseInt(String(req.query.pid), 10) || 0;
  return 0;
}

/** Garantiza que el proyecto existe, es de plataforma Stripe y devuelve el cliente Stripe. */
async function stripeForClient(req: Request, res: Response) {
  const pid = getClientProjectId(req);
  if (!pid) { res.status(400).json({ error: "No project linked" }); return null; }
  const [project] = await db
    .select({ id: projectsTable.id, platformType: projectsTable.platformType })
    .from(projectsTable).where(eq(projectsTable.id, pid)).limit(1);
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return null; }
  if (project.platformType !== "stripe") {
    res.status(400).json({ error: `Este proyecto es de plataforma ${getPlatform(project.platformType).label}, no Stripe`, code: "NOT_STRIPE_PROJECT" });
    return null;
  }
  try {
    const { stripe, mode } = await resolveStripeForProject(pid, { strict: true });
    return { pid, stripe, mode };
  } catch (err: any) {
    if (err instanceof StripeNotLinkedError) {
      res.status(409).json({ error: err.message, code: err.code, connected: false });
      return null;
    }
    throw err;
  }
}

function fail(res: Response, err: any, what: string) {
  logger.error({ err: err?.message }, `GET /client/stripe/${what} error`);
  const status = Number(err?.statusCode) || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: err?.message ?? `Error cargando ${what}` });
}

// Importe mensual equivalente de TODAS las líneas (cantidad y periodicidad normalizadas).
const monthly = (sub: any): number =>
  (sub.items?.data ?? []).reduce((acc: number, it: any) => acc + monthlyAmount({
    unitAmount: it?.price?.unit_amount ?? null,
    quantity: it?.quantity ?? 1,
    interval: (it?.price?.recurring?.interval ?? null) as Interval | null,
    intervalCount: it?.price?.recurring?.interval_count ?? null,
  }), 0);

// ── GET /client/stripe/connection ─────────────────────────────────────────────
router.get("/connection", async (req, res): Promise<void> => {
  const pid = getClientProjectId(req);
  if (!pid) { res.status(400).json({ error: "No project linked" }); return; }
  const info = await getStripeConnection(pid);
  // El cliente no necesita saber el account_id interno
  res.json({
    connected: info.connected,
    keyMode: info.keyMode,
    displayName: info.displayName,
    email: info.email,
    country: info.country,
    currency: info.currency,
    connectedAt: info.connectedAt,
  });
});

// ── GET /client/stripe/overview ───────────────────────────────────────────────
router.get("/overview", async (req, res): Promise<void> => {
  try {
    const ctx = await stripeForClient(req, res);
    if (!ctx) return;
    const { stripe, pid } = ctx;

    const now = Math.floor(Date.now() / 1000);
    const d30 = now - 30 * 86400;
    const d60 = d30 - 30 * 86400;

    const [balanceR, chargesR, subsR, customersR, invoicesR, payoutsR] = await Promise.allSettled([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 100, created: { gte: d60 } }),
      stripe.subscriptions.list({ limit: 100, status: "all" }),
      stripe.customers.list({ limit: 100 }),
      stripe.invoices.list({ limit: 50 }),
      stripe.payouts.list({ limit: 5 }),
    ]);

    const balance = balanceR.status === "fulfilled" ? balanceR.value : null;
    const charges = chargesR.status === "fulfilled" ? chargesR.value.data : [];
    const subs = subsR.status === "fulfilled" ? subsR.value.data : [];
    const customers = customersR.status === "fulfilled" ? customersR.value.data : [];
    const invoices = invoicesR.status === "fulfilled" ? invoicesR.value.data : [];
    const payouts = payoutsR.status === "fulfilled" ? payoutsR.value.data : [];
    const warnings = [chargesR, subsR, customersR, invoicesR, payoutsR, balanceR]
      .filter(r => r.status === "rejected")
      .map(r => (r as PromiseRejectedResult).reason?.message ?? "error");

    const ok30 = charges.filter(c => c.created >= d30 && c.status === "succeeded");
    const okPrev = charges.filter(c => c.created < d30 && c.status === "succeeded");
    const failed30 = charges.filter(c => c.created >= d30 && c.status === "failed");
    const refunded30 = ok30.reduce((s, c) => s + (c.amount_refunded ?? 0), 0);
    const gross30 = ok30.reduce((s, c) => s + c.amount, 0);
    const grossPrev = okPrev.reduce((s, c) => s + c.amount, 0);
    const trend = grossPrev > 0 ? ((gross30 - grossPrev) / grossPrev) * 100 : 0;

    const dailyMap: Record<string, { amount: number; count: number }> = {};
    for (let i = 0; i < 30; i++) {
      const key = new Date((d30 + i * 86400) * 1000).toISOString().slice(0, 10);
      dailyMap[key] = { amount: 0, count: 0 };
    }
    for (const c of ok30) {
      const key = new Date(c.created * 1000).toISOString().slice(0, 10);
      if (dailyMap[key]) { dailyMap[key].amount += c.amount; dailyMap[key].count += 1; }
    }

    const activeSubs = subs.filter(s => s.status === "active" || s.status === "trialing");
    const pastDue = subs.filter(s => s.status === "past_due" || s.status === "unpaid").length;
    // MRR como Stripe: activas y con pago pendiente; las de prueba aún no facturan.
    const mrr = Math.round(subs.filter(s => s.status === "active" || s.status === "past_due").reduce((s, sub) => s + monthly(sub), 0));
    const openInvoices = invoices.filter(i => i.status === "open");
    const openAmount = openInvoices.reduce((s, i) => s + (i.amount_due ?? 0), 0);

    const currency = balance?.available[0]?.currency ?? ok30[0]?.currency ?? "eur";

    res.json({
      connected: true,
      projectId: pid,
      currency,
      warnings,
      balance: balance ? {
        available: balance.available.reduce((s, b) => s + b.amount, 0),
        pending: balance.pending.reduce((s, b) => s + b.amount, 0),
      } : null,
      volume30: gross30,
      count30: ok30.length,
      failed30: failed30.length,
      refunded30,
      aov: ok30.length ? gross30 / ok30.length : 0,
      trend,
      mrr,
      activeSubCount: activeSubs.length,
      pastDueSubCount: pastDue,
      customerCount: customers.length,
      customerHasMore: customersR.status === "fulfilled" ? customersR.value.has_more : false,
      openInvoiceCount: openInvoices.length,
      openInvoiceAmount: openAmount,
      dailyChart: Object.entries(dailyMap).map(([date, v]) => ({ date, amount: v.amount, count: v.count })),
      recentCharges: charges.slice(0, 10).map(c => ({
        id: c.id, amount: c.amount, currency: c.currency, status: c.status,
        description: c.description, created: c.created, receiptEmail: c.receipt_email,
        refunded: c.refunded, amountRefunded: c.amount_refunded,
        paymentMethod: c.payment_method_details?.type ?? null,
      })),
      nextPayouts: payouts.map(p => ({ id: p.id, amount: p.amount, currency: p.currency, status: p.status, arrivalDate: p.arrival_date })),
    });
  } catch (err: any) {
    fail(res, err, "overview");
  }
});

// ── GET /client/stripe/charges ────────────────────────────────────────────────
router.get("/charges", async (req, res): Promise<void> => {
  try {
    const ctx = await stripeForClient(req, res);
    if (!ctx) return;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const startingAfter = req.query.starting_after ? String(req.query.starting_after) : undefined;
    const list = await ctx.stripe.charges.list({ limit, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    res.json({
      hasMore: list.has_more,
      data: list.data.map(c => ({
        id: c.id, amount: c.amount, amountRefunded: c.amount_refunded, currency: c.currency,
        status: c.status, description: c.description, created: c.created,
        receiptEmail: c.receipt_email, customer: typeof c.customer === "string" ? c.customer : c.customer?.id ?? null,
        paymentMethod: c.payment_method_details?.type ?? null,
        cardBrand: c.payment_method_details?.card?.brand ?? null,
        last4: c.payment_method_details?.card?.last4 ?? null,
        disputed: c.disputed, refunded: c.refunded, receiptUrl: c.receipt_url,
        failureMessage: c.failure_message,
      })),
    });
  } catch (err: any) {
    fail(res, err, "charges");
  }
});

// ── GET /client/stripe/customers ──────────────────────────────────────────────
router.get("/customers", async (req, res): Promise<void> => {
  try {
    const ctx = await stripeForClient(req, res);
    if (!ctx) return;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const q = req.query.q ? String(req.query.q).trim().slice(0, 100) : "";
    // Stripe Search: el valor va entre comillas; escapamos \ y " para que el término no rompa la sintaxis
    const qEsc = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const list = q
      ? await ctx.stripe.customers.search({ query: `email~"${qEsc}" OR name~"${qEsc}"`, limit })
      : await ctx.stripe.customers.list({ limit });
    res.json({
      hasMore: list.has_more,
      data: list.data.map(c => ({
        id: c.id, email: c.email, name: c.name, phone: c.phone, created: c.created,
        currency: c.currency, balance: c.balance, delinquent: c.delinquent,
        description: c.description,
      })),
    });
  } catch (err: any) {
    fail(res, err, "customers");
  }
});

// ── GET /client/stripe/subscriptions ──────────────────────────────────────────
router.get("/subscriptions", async (req, res): Promise<void> => {
  try {
    const ctx = await stripeForClient(req, res);
    if (!ctx) return;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const status = String(req.query.status ?? "all") as any;
    const list = await ctx.stripe.subscriptions.list({ limit, status, expand: ["data.customer"] });
    res.json({
      hasMore: list.has_more,
      data: list.data.map(s => {
        const item = (s.items?.data ?? [])[0];
        const price = item?.price;
        const cust: any = s.customer;
        return {
          id: s.id, status: s.status, created: s.created,
          currentPeriodEnd: (s as any).current_period_end ?? item?.current_period_end ?? null,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          customerId: typeof cust === "string" ? cust : cust?.id ?? null,
          customerEmail: typeof cust === "object" && cust ? cust.email ?? null : null,
          customerName: typeof cust === "object" && cust ? cust.name ?? null : null,
          productName: typeof price?.product === "object" && price?.product ? (price.product as any).name ?? null : null,
          priceNickname: price?.nickname ?? null,
          amount: price?.unit_amount ?? null,
          currency: price?.currency ?? s.currency,
          interval: price?.recurring?.interval ?? null,
          quantity: item?.quantity ?? 1,
          monthlyValue: monthly(s),
        };
      }),
    });
  } catch (err: any) {
    fail(res, err, "subscriptions");
  }
});

// ── GET /client/stripe/invoices ───────────────────────────────────────────────
router.get("/invoices", async (req, res): Promise<void> => {
  try {
    const ctx = await stripeForClient(req, res);
    if (!ctx) return;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const status = req.query.status ? String(req.query.status) as any : undefined;
    const list = await ctx.stripe.invoices.list({ limit, ...(status ? { status } : {}) });
    res.json({
      hasMore: list.has_more,
      data: list.data.map(i => ({
        id: i.id, number: i.number, status: i.status, created: i.created, dueDate: i.due_date,
        amountDue: i.amount_due, amountPaid: i.amount_paid, amountRemaining: i.amount_remaining,
        currency: i.currency, customerEmail: i.customer_email, customerName: i.customer_name,
        hostedInvoiceUrl: i.hosted_invoice_url, invoicePdf: i.invoice_pdf,
        description: i.description,
      })),
    });
  } catch (err: any) {
    fail(res, err, "invoices");
  }
});

// ── GET /client/stripe/payouts ────────────────────────────────────────────────
router.get("/payouts", async (req, res): Promise<void> => {
  try {
    const ctx = await stripeForClient(req, res);
    if (!ctx) return;
    const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 100);
    const [list, balance] = await Promise.all([
      ctx.stripe.payouts.list({ limit }),
      ctx.stripe.balance.retrieve().catch(() => null),
    ]);
    res.json({
      hasMore: list.has_more,
      balance: balance ? {
        available: balance.available.reduce((s, b) => s + b.amount, 0),
        pending: balance.pending.reduce((s, b) => s + b.amount, 0),
        currency: balance.available[0]?.currency ?? "eur",
      } : null,
      data: list.data.map(p => ({
        id: p.id, amount: p.amount, currency: p.currency, status: p.status,
        arrivalDate: p.arrival_date, created: p.created, method: p.method, type: p.type,
        description: p.description, failureMessage: p.failure_message,
      })),
    });
  } catch (err: any) {
    fail(res, err, "payouts");
  }
});

export default router;
