// Las dos URL de webhook de Stripe (/api/billing/stripe/webhook y /api/webhooks/stripe) y la
// vuelta de Checkout (GET /api/billing/stripe/verify) pasan por la misma lógica:
//  · #101 cualquier activación guarda stripe_subscription_id → el DELETE del cliente da 409.
//  · #109 una cancelación (y el resto de eventos) deja el mismo estado llegue por la URL que llegue,
//         y un mismo evento enviado a las dos URL se aplica una sola vez.
// Base de datos en memoria; Stripe nunca se llama (eventos firmados con un secreto de prueba).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";

type Row = Record<string, unknown>;
const tables = vi.hoisted(() => ({ store: {} as Record<string, Record<string, unknown>[]>, events: new Map<string, string>() }));
const sessionToRetrieve = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));

vi.mock("@workspace/db", () => {
  const table = (name: string) => new Proxy({ __name: name }, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : `${name}.${String(k)}`) });
  const nameOf = (t: unknown) => (t as { __name: string }).__name;
  type Cond = { eq?: [string, unknown] } | undefined;
  const matches = (row: Row, cond: Cond) => !cond?.eq || row[cond.eq[0].split(".")[1]!] === cond.eq[1];
  const rowsOf = (t: unknown) => (tables.store[nameOf(t)] ??= []);
  const pick = (rows: Row[], cols?: Record<string, string>) => rows.map(r => cols
    ? Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, r[String(c).split(".")[1]!]]))
    : { ...r });
  return {
    subscriptionsTable: table("subscriptions"), usersTable: table("users"), projectsTable: table("projects"),
    affiliatesTable: table("affiliates"), referralTrackingTable: table("referral_tracking"),
    platformSettingsTable: table("platform_settings"), onboardingProgressTable: table("onboarding_progress"),
    achievementsTable: table("achievements"), auditLogTable: table("audit_log"), reportTemplatesTable: table("report_templates"),
    youtubeTokensTable: table("youtube_tokens"),
    db: {
      execute: async (q: { __sql?: string; values?: unknown[] }) => {
        const text = q?.__sql ?? "";
        if (text.includes("INSERT INTO stripe_webhook_events")) {
          const id = String(q.values?.[0]);
          const st = tables.events.get(id);
          if (st === "done" || st === "processing") return { rows: [] };
          tables.events.set(id, "processing");
          return { rows: [{ event_id: id }] };
        }
        if (text.includes("UPDATE stripe_webhook_events")) {
          const v = q.values ?? [];
          tables.events.set(String(v[v.length - 1]), String(v[0]));
        }
        return { rows: [] };
      },
      select: (cols?: Record<string, string>) => ({
        from: (t: unknown) => ({
          where: (cond: Cond) => {
            const rows = pick(rowsOf(t).filter(r => matches(r, cond)), cols);
            return Object.assign(rows, { limit: async (n: number) => rows.slice(0, n) });
          },
        }),
      }),
      insert: (t: unknown) => ({ values: async (v: Row) => { rowsOf(t).push({ ...v }); } }),
      update: (t: unknown) => ({
        set: (set: Row) => ({ where: async (cond: Cond) => { for (const r of rowsOf(t)) if (matches(r, cond)) Object.assign(r, set); } }),
      }),
    },
  };
});
vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  inArray: () => ({}),
  sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ __sql: strings.join("?"), values }), { raw: () => ({}) }),
}));
vi.mock("../lib/auth.js", () => ({ requireAdmin: (_q: unknown, _s: unknown, next: () => void) => next(), requireAuth: (_q: unknown, _s: unknown, next: () => void) => next() }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../lib/crypto.js", () => ({ safeDecrypt: (v: string) => v }));
// SDK de Stripe: la verificación de firmas es la real; la única llamada a la API
// (checkout.sessions.retrieve de la vuelta de Checkout) devuelve una sesión fija.
vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal<{ default: { webhooks: unknown } }>()).default;
  function FakeStripe() {
    return { checkout: { sessions: { retrieve: async () => sessionToRetrieve.value } } };
  }
  (FakeStripe as unknown as { webhooks: unknown }).webhooks = actual.webhooks;
  return { default: FakeStripe };
});

const { default: Stripe } = await import("stripe");
const { default: billingRouter } = await import("./billing");
const { default: gatewayRouter } = await import("./webhook-gateway");
const { keepRawBodyForWebhooks } = await import("../lib/raw-body");
const { deleteClientUser, subscriptionBlocksDeletion } = await import("../lib/user-deletion");

const SECRET = "whsec_unified_test";
let server: Server;
let origin: string;
let sessionUserId = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: keepRawBodyForWebhooks }));
  app.use((req, _res, next) => { (req as unknown as { session: Row }).session = { userId: sessionUserId }; next(); });
  app.use("/api", billingRouter);
  app.use("/api", gatewayRouter);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });
beforeEach(() => {
  tables.store = {};
  tables.events.clear();
  sessionToRetrieve.value = null;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_never_called";
});

const URLS = { billing: "/api/billing/stripe/webhook", gateway: "/api/webhooks/stripe" } as const;
type Endpoint = keyof typeof URLS;

async function send(endpoint: Endpoint, event: Row) {
  const payload = JSON.stringify(event);
  const header = (Stripe as unknown as { webhooks: { generateTestHeaderString: (o: { payload: string; secret: string }) => string } })
    .webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return fetch(origin + URLS[endpoint], { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
}

const seedClient = (id: string) => {
  (tables.store.users ??= []).push({ id, email: `${id}@tienda.es`, role: "client", isActive: 1 });
};
const subOf = (userId: string) => (tables.store.subscriptions ?? []).find(r => r.userId === userId);

const checkoutEvent = (eventId: string, userId: string, subId: string) => ({
  id: eventId, object: "event", type: "checkout.session.completed",
  data: { object: {
    id: `cs_${eventId}`, object: "checkout.session", mode: "subscription", status: "complete", payment_status: "paid",
    customer: `cus_${userId}`, subscription: subId, metadata: { kind: "plan", userId, planId: "starter", interval: "month" },
  } },
});

describe("#101 — toda activación de pago guarda la suscripción de Stripe y bloquea el borrado (409)", () => {
  for (const endpoint of ["billing", "gateway"] as const) {
    it(`checkout.session.completed por ${URLS[endpoint]}`, async () => {
      seedClient("u1");
      expect((await send(endpoint, checkoutEvent(`evt_ck_${endpoint}`, "u1", "sub_u1"))).status).toBe(200);
      expect(subOf("u1")).toMatchObject({ plan: "starter", status: "active", stripeCustomerId: "cus_u1", stripeSubscriptionId: "sub_u1" });
      const del = await deleteClientUser("u1", "admin1");
      expect(del).toMatchObject({ ok: false, status: 409, subscription: { stripeSubscriptionId: "sub_u1" } });
    });
  }

  it("vuelta de Checkout (GET /billing/stripe/verify)", async () => {
    seedClient("u2");
    sessionUserId = "u2";
    sessionToRetrieve.value = {
      id: "cs_v", payment_status: "paid", customer: "cus_u2", subscription: { id: "sub_u2" },
      metadata: { userId: "u2", planId: "starter", interval: "month" },
    };
    const r = await fetch(`${origin}/api/billing/stripe/verify?session_id=cs_v`);
    expect(r.status).toBe(200);
    expect(subOf("u2")).toMatchObject({ plan: "starter", status: "active", stripeCustomerId: "cus_u2", stripeSubscriptionId: "sub_u2" });
    expect(await deleteClientUser("u2", "admin1")).toMatchObject({ ok: false, status: 409 });
  });
});

describe("#109 — un evento de Stripe deja el mismo estado llegue por la URL que llegue", () => {
  const scenario = async (endpoint: Endpoint) => {
    seedClient("u3");
    await send(endpoint, checkoutEvent(`evt_a_${endpoint}`, "u3", "sub_u3"));
    const afterCheckout = { ...subOf("u3") };
    await send(endpoint, {
      id: `evt_f_${endpoint}`, object: "event", type: "invoice.payment_failed",
      data: { object: { id: "in_1", object: "invoice", parent: { subscription_details: { subscription: "sub_u3", metadata: { kind: "plan" } } }, lines: { data: [] } } },
    });
    const afterFailed = { ...subOf("u3") };
    await send(endpoint, {
      id: `evt_u_${endpoint}`, object: "event", type: "customer.subscription.updated",
      data: { object: { id: "sub_u3", object: "subscription", status: "active", cancel_at_period_end: true, metadata: { kind: "plan", userId: "u3" } } },
    });
    const afterScheduled = { ...subOf("u3") };
    const del = await send(endpoint, {
      id: `evt_d_${endpoint}`, object: "event", type: "customer.subscription.deleted",
      data: { object: { id: "sub_u3", object: "subscription", status: "canceled", cancel_at_period_end: false, metadata: { kind: "plan", userId: "u3" } } },
    });
    expect(del.status).toBe(200);
    const afterDeleted = { ...subOf("u3") };
    const strip = (r: Row) => { const { currentPeriodEnd: _c, ...rest } = r; return rest; };
    return [afterCheckout, afterFailed, afterScheduled, afterDeleted].map(strip);
  };

  it("alta, impago, cancelación programada y baja: mismo resultado por las dos URL", async () => {
    const viaBilling = await scenario("billing");
    tables.store = {};
    const viaGateway = await scenario("gateway");
    expect(viaGateway).toEqual(viaBilling);
    expect(viaBilling.map(r => r.status)).toEqual(["active", "past_due", "active", "canceled"]);
    expect(viaBilling[2]).toMatchObject({ cancelAtPeriodEnd: 1 });
    // Tras la baja ya no hay facturación: el cliente se puede borrar.
    expect(subscriptionBlocksDeletion(subOf("u3") as { stripeSubscriptionId: string; status: string })).toBe(false);
  });

  it("el mismo evento enviado a las dos URL (o reintentado) se aplica una sola vez", async () => {
    seedClient("u4");
    const ev = checkoutEvent("evt_dup", "u4", "sub_u4");
    expect((await send("billing", ev)).status).toBe(200);
    // Si el admin cambia la fila entre medias, la entrega repetida no la pisa.
    Object.assign(subOf("u4")!, { plan: "agency_pro" });
    expect((await send("gateway", ev)).status).toBe(200);
    expect((await send("billing", ev)).status).toBe(200);
    expect(subOf("u4")).toMatchObject({ plan: "agency_pro" });
    expect(tables.events.get("evt_dup")).toBe("done");
  });
});
