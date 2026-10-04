import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import Stripe from "stripe";

const inserts: unknown[] = [];
const dbUpdates: unknown[] = [];
const rawSql: string[] = [];

vi.mock("@workspace/db", () => {
  const table = (name: string) => new Proxy({ __name: name }, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : `${name}.${String(k)}`) });
  return {
    subscriptionsTable: table("subscriptions"),
    affiliatesTable: table("affiliates"),
    referralTrackingTable: table("referral_tracking"),
    usersTable: table("users"),
    db: {
      execute: async (q: { __sql?: string }) => { if (q?.__sql) rawSql.push(q.__sql); return { rows: [] }; },
      select: () => ({ from: () => ({ where: async () => [] }) }),
      insert: () => ({ values: async (v: unknown) => { inserts.push(v); } }),
      update: () => ({ set: (v: unknown) => ({ where: async () => { dbUpdates.push(v); } }) }),
    },
  };
});
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  sql: Object.assign((strings: TemplateStringsArray) => ({ __sql: strings.join("?") }), { raw: () => ({}) }),
}));
vi.mock("../lib/auth.js", () => ({ requireAdmin: (_q: unknown, _s: unknown, next: () => void) => next(), requireAuth: (_q: unknown, _s: unknown, next: () => void) => next() }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { default: billingRouter } = await import("./billing");
const { keepRawBodyForWebhooks } = await import("../lib/raw-body");

const SECRET = "whsec_test_secret";
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: keepRawBodyForWebhooks }));
  app.use("/api", billingRouter);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/billing/stripe/webhook`;
});
afterAll(() => { server.close(); });
beforeEach(() => { inserts.length = 0; dbUpdates.length = 0; rawSql.length = 0; process.env.STRIPE_WEBHOOK_SECRET = SECRET; });

async function send(event: unknown) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return fetch(base, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
}

const paidEvent = JSON.stringify({
  id: "evt_1", object: "event", type: "checkout.session.completed",
  data: { object: { id: "cs_1", object: "checkout.session", payment_status: "paid", metadata: { userId: "u1", planId: "starter" } } },
});

describe("POST /billing/stripe/webhook", () => {
  it("sin STRIPE_WEBHOOK_SECRET rechaza (503) y no activa nada", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: paidEvent });
    expect(r.status).toBe(503);
    expect(inserts).toHaveLength(0);
  });

  it("sin cabecera stripe-signature rechaza (400) aunque el payload diga 'paid'", async () => {
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: paidEvent });
    expect(r.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("con firma inválida rechaza (400)", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload: paidEvent, secret: "whsec_otro" });
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: paidEvent });
    expect(r.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("con firma válida sobre el cuerpo original activa la suscripción", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload: paidEvent, secret: SECRET });
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: paidEvent });
    expect(r.status).toBe(200);
    expect(inserts).toEqual([expect.objectContaining({ userId: "u1", plan: "starter", status: "active" })]);
  });

  it("alta de plan anual: guarda cliente y suscripción de Stripe y aplica el plan al proyecto", async () => {
    const r = await send({
      id: "evt_2", object: "event", type: "checkout.session.completed",
      data: { object: { id: "cs_2", object: "checkout.session", mode: "subscription", status: "complete", payment_status: "paid",
        customer: "cus_1", subscription: "sub_1", metadata: { kind: "plan", userId: "u2", planId: "agency_pro", interval: "year" } } },
    });
    expect(r.status).toBe(200);
    expect(inserts).toEqual([expect.objectContaining({ userId: "u2", plan: "agency_pro", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", imagesIncluded: 300 })]);
    expect(rawSql.some(q => q.includes("SELECT client_id FROM users"))).toBe(true);
  });

  it("invoice.paid renueva: extiende el periodo hasta el fin de la línea facturada", async () => {
    const end = 1_900_000_000;
    const r = await send({
      id: "evt_3", object: "event", type: "invoice.paid",
      data: { object: { id: "in_1", object: "invoice", parent: { subscription_details: { subscription: "sub_1", metadata: { kind: "plan" } } },
        lines: { data: [{ period: { start: end - 2_592_000, end } }] } } },
    });
    expect(r.status).toBe(200);
    expect(dbUpdates).toEqual([expect.objectContaining({ status: "active", currentPeriodEnd: new Date(end * 1000) })]);
  });

  it("invoice.payment_failed marca la suscripción como past_due", async () => {
    const r = await send({
      id: "evt_4", object: "event", type: "invoice.payment_failed",
      data: { object: { id: "in_2", object: "invoice", parent: { subscription_details: { subscription: "sub_1", metadata: {} } }, lines: { data: [] } } },
    });
    expect(r.status).toBe(200);
    expect(dbUpdates).toEqual([{ status: "past_due" }]);
  });

  it("customer.subscription.deleted da de baja y devuelve el proyecto a cuotas de prueba", async () => {
    const r = await send({
      id: "evt_5", object: "event", type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", object: "subscription", status: "canceled", cancel_at_period_end: false, metadata: { kind: "plan", userId: "u2" } } },
    });
    expect(r.status).toBe(200);
    expect(dbUpdates).toEqual([{ status: "canceled", cancelAtPeriodEnd: 0 }]);
  });

  it("servicio mensual contratado: se registra como suscripción de servicio", async () => {
    const r = await send({
      id: "evt_6", object: "event", type: "checkout.session.completed",
      data: { object: { id: "cs_3", object: "checkout.session", mode: "subscription", status: "complete", payment_status: "paid",
        customer: "cus_2", subscription: "sub_9", amount_total: 19000, currency: "eur",
        metadata: { kind: "service", userId: "u3", serviceId: "7", serviceName: "SEO mensual", projectId: "12", interval: "month" } } },
    });
    expect(r.status).toBe(200);
    expect(rawSql.some(q => q.includes("INSERT INTO service_subscriptions"))).toBe(true);
    expect(inserts).toHaveLength(0);
  });
});
