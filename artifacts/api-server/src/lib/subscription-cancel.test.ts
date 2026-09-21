import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let selectRows: Record<string, Row[]> = {};
const updates: Array<{ table: string; set: Row }> = [];

const nameOf = (t: unknown) => (t as { __name: string }).__name;

vi.mock("@workspace/db", () => {
  const mk = (name: string, cols: string[]) => Object.fromEntries([["__name", name], ...cols.map(c => [c, `${name}.${c}`])]);
  return {
    usersTable: mk("users", ["id", "role"]),
    subscriptionsTable: mk("subscriptions", ["userId", "stripeSubscriptionId", "status", "cancelAtPeriodEnd"]),
    db: {
      select: () => ({
        from: (t: unknown) => ({ where: () => ({ limit: async () => selectRows[nameOf(t)] ?? [] }) }),
      }),
      update: (t: unknown) => ({ set: (set: Row) => ({ where: async () => { updates.push({ table: nameOf(t), set }); } }) }),
    },
  };
});
vi.mock("drizzle-orm", () => ({ eq: (a: unknown, b: unknown) => ({ eq: [a, b] }) }));
vi.mock("./logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("stripe", () => ({ default: class { subscriptions = { retrieve: async () => { throw new Error("no debería llamarse en tests"); }, cancel: async () => { throw new Error("no debería llamarse en tests"); } }; } }));

import { cancelClientSubscription } from "./subscription-cancel";
import { stripeSubscriptionDashboardUrl } from "./stripe-dashboard-url";

const client = { id: "c1", role: "client" };
const activeSub = { stripeSubscriptionId: "sub_live", status: "active" };

beforeEach(() => { selectRows = {}; updates.length = 0; });

describe("stripeSubscriptionDashboardUrl", () => {
  it("apunta a modo test con clave sk_test_ o sin clave, y a live con sk_live_", () => {
    expect(stripeSubscriptionDashboardUrl("sub_1", "sk_test_abc")).toBe("https://dashboard.stripe.com/test/subscriptions/sub_1");
    expect(stripeSubscriptionDashboardUrl("sub_1", "")).toBe("https://dashboard.stripe.com/test/subscriptions/sub_1");
    expect(stripeSubscriptionDashboardUrl("sub_1", "sk_live_abc")).toBe("https://dashboard.stripe.com/subscriptions/sub_1");
  });
});

const missing = () => Object.assign(new Error("No such subscription: 'sub_live'"), { code: "resource_missing" });
function fakeStripe(opts: { retrieve?: () => Promise<{ status: string }>; cancel?: () => Promise<{ status: string }> } = {}) {
  return {
    retrieve: vi.fn(opts.retrieve ?? (async () => ({ status: "active" }))),
    cancel: vi.fn(opts.cancel ?? (async () => ({ status: "canceled" }))),
  };
}

describe("cancelClientSubscription", () => {
  it("rechaza al propio actor, 404 sin usuario y 403 para admins, sin tocar Stripe ni la BD", async () => {
    const stripe = fakeStripe();
    expect(await cancelClientSubscription("a1", "a1", stripe)).toMatchObject({ ok: false, status: 400 });
    expect(await cancelClientSubscription("ghost", "a1", stripe)).toMatchObject({ ok: false, status: 404 });
    selectRows = { users: [{ id: "a2", role: "admin" }] };
    expect(await cancelClientSubscription("a2", "a1", stripe)).toMatchObject({ ok: false, status: 403 });
    expect(stripe.retrieve).not.toHaveBeenCalled();
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("devuelve alreadyCanceled sin llamar a Stripe si la fila local ya no bloquea el borrado", async () => {
    const stripe = fakeStripe();
    selectRows = { users: [client], subscriptions: [{ stripeSubscriptionId: "sub_old", status: "canceled" }] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toEqual({ ok: true, alreadyCanceled: true, localUpdated: false, stripeSubscriptionId: "sub_old", status: "canceled" });
    selectRows = { users: [client] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: true, alreadyCanceled: true, stripeSubscriptionId: null });
    expect(stripe.retrieve).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("503 con enlace al dashboard si Stripe no está configurado y la suscripción sigue facturando", async () => {
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", null)).toMatchObject({ ok: false, status: 503, stripeDashboardUrl: expect.stringContaining("sub_live") });
    expect(updates).toEqual([]);
  });

  it("verifica en Stripe, cancela con confirmación y solo entonces marca la fila local como canceled", async () => {
    const stripe = fakeStripe();
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe);
    expect(stripe.retrieve).toHaveBeenCalledWith("sub_live");
    expect(stripe.cancel).toHaveBeenCalledWith("sub_live");
    expect(r).toEqual({ ok: true, alreadyCanceled: false, localUpdated: true, stripeSubscriptionId: "sub_live", status: "canceled" });
    expect(updates).toEqual([{ table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 } }]);
  });

  it("si Stripe confirma que ya está cancelada, sincroniza la fila local sin volver a cancelar", async () => {
    const stripe = fakeStripe({ retrieve: async () => ({ status: "canceled" }) });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: true, alreadyCanceled: true, localUpdated: true });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it("FAIL CLOSED: resource_missing (clave de otro modo/cuenta) → 409 sin cancelar ni tocar la fila local", async () => {
    const stripe = fakeStripe({ retrieve: async () => { throw missing(); } });
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe);
    expect(r).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/test\/live|otra cuenta/), stripeDashboardUrl: expect.stringContaining("sub_live") });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("502 y sin cambios locales si Stripe falla al consultar por otro motivo", async () => {
    const stripe = fakeStripe({ retrieve: async () => { throw new Error("api_connection_error"); } });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502, error: expect.stringContaining("api_connection_error") });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("502 y sin cambios locales si Stripe rechaza la cancelación", async () => {
    const stripe = fakeStripe({ cancel: async () => { throw new Error("card_declined"); } });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502, error: expect.stringContaining("card_declined") });
    expect(updates).toEqual([]);
  });

  it("502 si cancel() responde pero la suscripción sigue en un estado que factura", async () => {
    const stripe = fakeStripe({ cancel: async () => ({ status: "active" }) });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502 });
    expect(updates).toEqual([]);
  });
});
