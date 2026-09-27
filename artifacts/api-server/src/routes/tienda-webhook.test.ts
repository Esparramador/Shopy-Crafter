import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createHmac } from "crypto";
import type { AddressInfo } from "net";
import type { Server } from "http";

const executed: unknown[] = [];

vi.mock("@workspace/db", () => ({
  db: {
    execute: async (q: { text?: string }) => {
      executed.push(q);
      // SELECT del plan: devuelve un plan válido; el resto, vacío.
      return { rows: [{ id: "starter", price: 37, period_days: 30, stores_limit: 3, images_included: 45 }] };
    },
  },
}));
vi.mock("drizzle-orm", () => ({ sql: Object.assign((s: TemplateStringsArray) => ({ text: s.join("?") }), { raw: () => ({}) }) }));
vi.mock("../lib/auth.js", () => ({ requireAdmin: (_q: unknown, _s: unknown, next: () => void) => next(), requireAuth: (_q: unknown, _s: unknown, next: () => void) => next() }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

process.env.SESSION_SECRET = "test-session-secret";
const { default: tiendaRouter, signCheckoutRef, verifyCheckoutRef } = await import("./tienda");
const { keepRawBodyForWebhooks } = await import("../lib/raw-body");

const SECRET = "shpss_test";
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: keepRawBodyForWebhooks }));
  app.use("/api", tiendaRouter);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/webhooks/shopify/orders-paid`;
});
afterAll(() => { server.close(); });
beforeEach(() => { process.env.SHOPIFY_WEBHOOK_SECRET = SECRET; });

// Espacios y un carácter no ASCII: re-serializar el JSON NO reproduciría estos bytes.
const orderBody = (ref: string, total = "37.00") =>
  `{"id": 1001, "total_price": "${total}", "note_attributes": [{"name": "ref", "value": "${ref}"}], "note": "caf\\u00e9"}`;
const body = orderBody(signCheckoutRef("u1", "starter"));
const post = (b: string) => fetch(base, { method: "POST", headers: { "content-type": "application/json", "x-shopify-hmac-sha256": sign(b) }, body: b });
const sign = (payload: string, secret = SECRET) => createHmac("sha256", secret).update(payload).digest("base64");
const upserts = () => executed.filter(q => (q as { text?: string }).text?.includes("INSERT INTO subscriptions"));

describe("POST /webhooks/shopify/orders-paid", () => {
  it("sin SHOPIFY_WEBHOOK_SECRET rechaza (503) y no activa nada", async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    executed.length = 0;
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(r.status).toBe(503);
    expect(upserts()).toHaveLength(0);
  });

  it("con HMAC inválido rechaza (401)", async () => {
    executed.length = 0;
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json", "x-shopify-hmac-sha256": sign(body, "otro") }, body });
    expect(r.status).toBe(401);
    expect(upserts()).toHaveLength(0);
  });

  it("con HMAC válido sobre los bytes originales activa el plan", async () => {
    executed.length = 0;
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json", "x-shopify-hmac-sha256": sign(body) }, body });
    expect(r.status).toBe(200);
    expect(upserts()).toHaveLength(1);
  });

  it("ref sin firma (userId:planId escrito a mano) no activa nada", async () => {
    executed.length = 0;
    const r = await post(orderBody("u1:starter"));
    expect(r.status).toBe(200);
    expect(upserts()).toHaveLength(0);
  });

  it("ref firmado para otro usuario/plan manipulado no activa nada", async () => {
    executed.length = 0;
    const [, , sig] = signCheckoutRef("u1", "starter").split(":");
    const r = await post(orderBody(`u2:starter:${sig}`));
    expect(r.status).toBe(200);
    expect(upserts()).toHaveLength(0);
  });

  it("importe pagado menor que el precio del plan no activa nada", async () => {
    executed.length = 0;
    const r = await post(orderBody(signCheckoutRef("u1", "starter"), "14.00"));
    expect(r.status).toBe(200);
    expect(upserts()).toHaveLength(0);
  });
});

describe("ref de checkout firmado", () => {
  it("verifica solo refs firmados por el servidor", () => {
    expect(verifyCheckoutRef(signCheckoutRef("u1", "growth"))).toEqual({ userId: "u1", planId: "growth" });
    expect(verifyCheckoutRef("u1:growth")).toBeNull();
    expect(verifyCheckoutRef("u1:growth:deadbeef")).toBeNull();
  });
});
