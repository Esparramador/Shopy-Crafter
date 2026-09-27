import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import Stripe from "stripe";

const inserts: unknown[] = [];
const dbUpdates: unknown[] = [];

vi.mock("@workspace/db", () => {
  const table = (name: string) => new Proxy({ __name: name }, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : `${name}.${String(k)}`) });
  return {
    subscriptionsTable: table("subscriptions"),
    affiliatesTable: table("affiliates"),
    referralTrackingTable: table("referral_tracking"),
    usersTable: table("users"),
    db: {
      execute: async () => ({ rows: [] }),
      select: () => ({ from: () => ({ where: async () => [] }) }),
      insert: () => ({ values: async (v: unknown) => { inserts.push(v); } }),
      update: () => ({ set: (v: unknown) => ({ where: async () => { dbUpdates.push(v); } }) }),
    },
  };
});
vi.mock("drizzle-orm", () => ({ eq: () => ({}), sql: Object.assign(() => ({}), { raw: () => ({}) }) }));
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
beforeEach(() => { inserts.length = 0; dbUpdates.length = 0; process.env.STRIPE_WEBHOOK_SECRET = SECRET; });

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
});
