import { beforeEach, describe, expect, it, vi } from "vitest";

const stored: Array<{ name: string; value: string }> = [];
vi.mock("@workspace/db", () => ({
  db: { transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ execute: async () => ({ rows: [] }) }) },
}));
vi.mock("../routes/api-keys.js", () => ({
  storeGeneratedApiKey: async (_p: string, name: string, value: string) => { stored.push({ name, value }); },
}));

import { BILLING_WEBHOOK_EVENTS, billingWebhookSecrets, billingWebhookUrl, ensureBillingWebhook } from "./stripe-webhook-setup";

type Ep = { id: string; url: string; status: string; enabled_events: string[] };
function fakeStripe(endpoints: Ep[]) {
  const calls = { update: [] as unknown[], create: [] as unknown[] };
  const stripe = {
    webhookEndpoints: {
      list: () => ({ async *[Symbol.asyncIterator]() { for (const e of endpoints) yield e; } }),
      update: async (id: string, params: unknown) => { calls.update.push({ id, params }); return {}; },
      create: async (params: unknown) => { calls.create.push(params); return { id: "we_new", secret: "whsec_generado" }; },
    },
  };
  return { stripe: stripe as never, calls };
}

beforeEach(() => {
  stored.length = 0;
  process.env.APP_URL = "https://shopycrafter.com";
  delete process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("billingWebhookUrl", () => {
  it("solo con dominio https real", () => {
    expect(billingWebhookUrl()).toBe("https://shopycrafter.com/api/billing/stripe/webhook");
    process.env.APP_URL = "http://localhost:8080";
    expect(billingWebhookUrl()).toBeNull();
  });
});

describe("ensureBillingWebhook", () => {
  it("añade solo los eventos que faltan al endpoint existente, sin crear otro", async () => {
    const { stripe, calls } = fakeStripe([
      { id: "we_otro", url: "https://otra.com/api/billing/stripe/webhook", status: "enabled", enabled_events: [] },
      { id: "we_1", url: "https://shopycrafter.com/api/billing/stripe/webhook/", status: "enabled", enabled_events: ["checkout.session.completed", "charge.refunded"] },
    ]);
    const r = await ensureBillingWebhook(stripe);
    expect(r.status).toBe("updated");
    expect(r.endpointId).toBe("we_1");
    expect(r.added).not.toContain("checkout.session.completed");
    expect(r.added).toContain("checkout.session.expired");
    expect(calls.create).toHaveLength(0);
    const ev = (calls.update[0] as { params: { enabled_events: string[] } }).params.enabled_events;
    expect(ev).toContain("charge.refunded");
    expect(new Set(ev).size).toBe(ev.length);
  });

  it("no toca nada si ya está completo", async () => {
    const { stripe, calls } = fakeStripe([{ id: "we_1", url: "https://shopycrafter.com/api/billing/stripe/webhook", status: "enabled", enabled_events: [...BILLING_WEBHOOK_EVENTS] }]);
    expect((await ensureBillingWebhook(stripe)).status).toBe("ok");
    expect(calls.update).toHaveLength(0);
  });

  it("crea el endpoint y guarda su secreto aparte, sin pisar STRIPE_WEBHOOK_SECRET", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_manual";
    const { stripe, calls } = fakeStripe([]);
    const r = await ensureBillingWebhook(stripe);
    expect(r.status).toBe("created");
    expect(calls.create).toHaveLength(1);
    expect(stored).toEqual([{ name: "STRIPE_BILLING_WEBHOOK_SECRET", value: "whsec_generado" }]);
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBe("whsec_manual");
  });

  it("sin clave de Stripe no hace nada", async () => {
    expect((await ensureBillingWebhook(null)).status).toBe("skipped");
  });
});

describe("billingWebhookSecrets", () => {
  it("acepta los dos secretos sin duplicar", () => {
    process.env.STRIPE_BILLING_WEBHOOK_SECRET = "whsec_a";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_a";
    expect(billingWebhookSecrets()).toEqual(["whsec_a"]);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_b";
    expect(billingWebhookSecrets()).toEqual(["whsec_a", "whsec_b"]);
  });
});
