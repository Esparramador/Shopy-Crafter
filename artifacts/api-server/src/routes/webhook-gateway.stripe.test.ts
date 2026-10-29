import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import Stripe from "stripe";

type Row = Record<string, unknown>;
const dbUpdates: Array<{ table: string; set: Row; where: unknown }> = [];
let failNextUpdate: Error | null = null;

vi.mock("@workspace/db", () => {
  const table = (name: string) => new Proxy({ __name: name }, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : `${name}.${String(k)}`) });
  const nameOf = (t: unknown) => (t as { __name: string }).__name;
  return {
    projectsTable: table("projects"),
    subscriptionsTable: table("subscriptions"),
    usersTable: table("users"),
    db: {
      execute: async () => ({ rows: [] }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: async () => {} }),
      update: (t: unknown) => ({ set: (set: Row) => ({ where: async (where: unknown) => { if (failNextUpdate) { const e = failNextUpdate; failNextUpdate = null; throw e; } dbUpdates.push({ table: nameOf(t), set, where }); } }) }),
    },
  };
});
vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  sql: Object.assign((strings: TemplateStringsArray) => ({ __sql: strings.join("?") }), { raw: () => ({}) }),
}));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../lib/crypto.js", () => ({ safeDecrypt: (v: string) => v }));

const { default: gatewayRouter } = await import("./webhook-gateway");
const { keepRawBodyForWebhooks } = await import("../lib/raw-body");

const SECRET = "whsec_gateway_test";
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: keepRawBodyForWebhooks }));
  app.use("/api", gatewayRouter);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/webhooks/stripe`;
});
afterAll(() => { server.close(); });
beforeEach(() => { dbUpdates.length = 0; failNextUpdate = null; process.env.STRIPE_WEBHOOK_SECRET = SECRET; });

async function send(event: unknown, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(base, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
}

const subEvent = (type: string, status: string, id = "sub_dash") => ({
  id: `evt_${type}_${status}`, object: "event", type,
  data: { object: { id, object: "subscription", status, customer: "cus_1", cancel_at_period_end: false } },
});
const canceledLocal = { table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 }, where: { eq: ["subscriptions.stripeSubscriptionId", "sub_dash"] } };

describe("POST /webhooks/stripe — customer.subscription.* sincroniza la fila local", () => {
  it("customer.subscription.deleted (cancelada desde el dashboard de Stripe) → fila local canceled por stripe_subscription_id", async () => {
    const r = await send(subEvent("customer.subscription.deleted", "canceled"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ received: true });
    expect(dbUpdates).toEqual([canceledLocal]);
  });

  it("customer.subscription.updated con status canceled → fila local canceled", async () => {
    await send(subEvent("customer.subscription.updated", "canceled"));
    expect(dbUpdates).toEqual([canceledLocal]);
  });

  it("customer.subscription.updated con status active (p. ej. cambio de plan) NO toca la fila", async () => {
    const r = await send(subEvent("customer.subscription.updated", "active"));
    expect(r.status).toBe(200);
    expect(dbUpdates).toEqual([]);
  });

  it("si la BD falla al sincronizar responde 500 (Stripe reintenta) y el reintento deja la fila canceled", async () => {
    failNextUpdate = new Error("connection terminated");
    const first = await send(subEvent("customer.subscription.deleted", "canceled"));
    expect(first.status).toBe(500);
    expect(await first.json()).toMatchObject({ received: false });
    expect(dbUpdates).toEqual([]);
    // Reintento de Stripe con el mismo evento: ahora sí se aplica.
    const retry = await send(subEvent("customer.subscription.deleted", "canceled"));
    expect(retry.status).toBe(200);
    expect(dbUpdates).toEqual([canceledLocal]);
  });

  it("con firma inválida rechaza (401) y no toca nada", async () => {
    const r = await send(subEvent("customer.subscription.deleted", "canceled"), "whsec_otro");
    expect(r.status).toBe(401);
    expect(dbUpdates).toEqual([]);
  });

  it("sin STRIPE_WEBHOOK_SECRET rechaza (401) aunque el evento sea válido", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const r = await send(subEvent("customer.subscription.deleted", "canceled"));
    expect(r.status).toBe(401);
    expect(dbUpdates).toEqual([]);
  });
});
