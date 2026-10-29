import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let selectRows: Record<string, Row[]> = {};
const updates: Array<{ table: string; set: Row }> = [];
const wheres: unknown[] = [];
const deleteClientUserMock = vi.hoisted(() => vi.fn());

const nameOf = (t: unknown) => (t as { __name: string }).__name;

vi.mock("@workspace/db", () => {
  const mk = (name: string, cols: string[]) => Object.fromEntries([["__name", name], ...cols.map(c => [c, `${name}.${c}`])]);
  return {
    usersTable: mk("users", ["id", "role", "isActive", "email"]),
    subscriptionsTable: mk("subscriptions", ["userId", "stripeSubscriptionId", "status", "cancelAtPeriodEnd", "currentPeriodEnd"]),
    db: {
      select: () => ({
        from: (t: unknown) => ({ where: () => ({ limit: async () => selectRows[nameOf(t)] ?? [] }) }),
      }),
      update: (t: unknown) => ({ set: (set: Row) => ({ where: async (w: unknown) => { updates.push({ table: nameOf(t), set }); wheres.push(w); } }) }),
    },
  };
});
vi.mock("drizzle-orm", () => ({ eq: (a: unknown, b: unknown) => ({ eq: [a, b] }) }));
vi.mock("./logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("stripe", () => ({ default: class { subscriptions = { retrieve: async () => { throw new Error("no debería llamarse en tests"); }, cancel: async () => { throw new Error("no debería llamarse en tests"); }, update: async () => { throw new Error("no debería llamarse en tests"); } }; } }));
vi.mock("./user-deletion.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./user-deletion.js")>();
  return { ...actual, deleteClientUser: deleteClientUserMock };
});

import { cancelClientSubscription, isStripeAlreadyCanceledError, syncLocalSubscriptionFromStripeEvent } from "./subscription-cancel";
import { deleteClientUser } from "./user-deletion";
import { stripeSubscriptionDashboardUrl } from "./stripe-dashboard-url";

const client = { id: "c1", role: "client" };
const activeSub = { stripeSubscriptionId: "sub_live", status: "active" };

beforeEach(() => {
  selectRows = {};
  updates.length = 0;
  wheres.length = 0;
  deleteClientUserMock.mockReset().mockResolvedValue({ ok: true, deleted: { id: "c1", email: "c1@example.com" } });
});

describe("stripeSubscriptionDashboardUrl", () => {
  it("apunta a modo test con clave sk_test_ o sin clave, y a live con sk_live_", () => {
    expect(stripeSubscriptionDashboardUrl("sub_1", "sk_test_abc")).toBe("https://dashboard.stripe.com/test/subscriptions/sub_1");
    expect(stripeSubscriptionDashboardUrl("sub_1", "")).toBe("https://dashboard.stripe.com/test/subscriptions/sub_1");
    expect(stripeSubscriptionDashboardUrl("sub_1", "sk_live_abc")).toBe("https://dashboard.stripe.com/subscriptions/sub_1");
  });
});

const missing = () => Object.assign(new Error("No such subscription: 'sub_live'"), { code: "resource_missing" });
const alreadyCanceled = () => Object.assign(new Error("This subscription has already been canceled."), { code: "invalid_request_error" });
const canceledOnlyDetails = () => new Error("A canceled subscription can only update its cancellation_details.");
const PERIOD_END = new Date("2026-11-28T10:00:00.000Z");
type Snap = { status: string; cancelAtPeriodEnd: boolean; periodEnd: Date | null };
const snap = (status: string, extra: Partial<Snap> = {}): Snap => ({ status, cancelAtPeriodEnd: false, periodEnd: null, ...extra });
function fakeStripe(opts: { retrieve?: () => Promise<Snap>; cancel?: () => Promise<Snap>; cancelAtPeriodEnd?: () => Promise<Snap> } = {}) {
  return {
    retrieve: vi.fn(opts.retrieve ?? (async () => snap("active", { periodEnd: PERIOD_END }))),
    cancel: vi.fn(opts.cancel ?? (async () => snap("canceled"))),
    cancelAtPeriodEnd: vi.fn(opts.cancelAtPeriodEnd ?? (async () => snap("active", { cancelAtPeriodEnd: true, periodEnd: PERIOD_END }))),
  };
}
const AT_END = { atPeriodEnd: true };
// Revocar = desactivar + anular invitación pendiente (el setup por invitación reactivaría al usuario).
const REVOKE = { isActive: 0, inviteToken: null, inviteExpires: null };

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
    expect(await cancelClientSubscription("c1", "a1", stripe)).toEqual({ ok: true, mode: "now", alreadyCanceled: true, alreadyScheduled: false, localUpdated: false, userDeactivated: false, stripeSubscriptionId: "sub_old", status: "canceled", periodEnd: null });
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
    expect(r).toEqual({ ok: true, mode: "now", alreadyCanceled: false, alreadyScheduled: false, localUpdated: true, userDeactivated: false, stripeSubscriptionId: "sub_live", status: "canceled", periodEnd: null });
    expect(updates).toEqual([{ table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 } }]);
  });

  it("si Stripe confirma que ya está cancelada, sincroniza la fila local sin volver a cancelar", async () => {
    const stripe = fakeStripe({ retrieve: async () => snap("canceled") });
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
    const stripe = fakeStripe({ cancel: async () => snap("active") });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502 });
    expect(updates).toEqual([]);
  });
});

describe("cancelClientSubscription — atPeriodEnd (cancelar al final del periodo + revocar acceso)", () => {
  it("programa cancel_at_period_end en Stripe, marca la fila local y desactiva al usuario (no lo borra)", async () => {
    const stripe = fakeStripe();
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe, AT_END);
    expect(stripe.retrieve).toHaveBeenCalledWith("sub_live");
    expect(stripe.cancelAtPeriodEnd).toHaveBeenCalledWith("sub_live");
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, mode: "period_end", alreadyCanceled: false, alreadyScheduled: false, localUpdated: true, userDeactivated: true, stripeSubscriptionId: "sub_live", status: "active", periodEnd: PERIOD_END });
    expect(updates).toEqual([
      { table: "subscriptions", set: { cancelAtPeriodEnd: 1, currentPeriodEnd: PERIOD_END } },
      { table: "users", set: REVOKE },
    ]);
  });

  it("si Stripe ya la tenía programada, no vuelve a llamar a update pero sincroniza la fila y desactiva", async () => {
    const stripe = fakeStripe({ retrieve: async () => snap("active", { cancelAtPeriodEnd: true, periodEnd: PERIOD_END }) });
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe, AT_END);
    expect(stripe.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, mode: "period_end", alreadyScheduled: true, userDeactivated: true, periodEnd: PERIOD_END });
    expect(updates.map(u => u.table)).toEqual(["subscriptions", "users"]);
  });

  it("si Stripe confirma que ya está cancelada, marca canceled (no programada) y desactiva", async () => {
    const stripe = fakeStripe({ retrieve: async () => snap("canceled") });
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe, AT_END);
    expect(stripe.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, mode: "period_end", alreadyCanceled: true, userDeactivated: true, status: "canceled" });
    expect(updates).toEqual([
      { table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 } },
      { table: "users", set: REVOKE },
    ]);
  });

  it("sin suscripción que facture, solo revoca el acceso", async () => {
    const stripe = fakeStripe();
    selectRows = { users: [client] };
    expect(await cancelClientSubscription("c1", "a1", stripe, AT_END)).toMatchObject({ ok: true, mode: "period_end", alreadyCanceled: true, userDeactivated: true, localUpdated: false });
    expect(stripe.retrieve).not.toHaveBeenCalled();
    expect(updates).toEqual([{ table: "users", set: REVOKE }]);
  });

  it("revocar anula la invitación pendiente: el enlace de invitación no puede reactivar al usuario", async () => {
    const stripe = fakeStripe();
    selectRows = { users: [client], subscriptions: [activeSub] };
    await cancelClientSubscription("c1", "a1", stripe, AT_END);
    const userUpdate = updates.find(u => u.table === "users");
    expect(userUpdate?.set).toMatchObject({ isActive: 0, inviteToken: null, inviteExpires: null });
  });

  it("FAIL CLOSED: resource_missing → 409 sin programar nada ni desactivar al usuario", async () => {
    const stripe = fakeStripe({ retrieve: async () => { throw missing(); } });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe, AT_END)).toMatchObject({ ok: false, status: 409, stripeDashboardUrl: expect.stringContaining("sub_live") });
    expect(stripe.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("502 y sin cambios locales si update() falla o no deja cancel_at_period_end=true", async () => {
    selectRows = { users: [client], subscriptions: [activeSub] };
    const failing = fakeStripe({ cancelAtPeriodEnd: async () => { throw new Error("rate_limit"); } });
    expect(await cancelClientSubscription("c1", "a1", failing, AT_END)).toMatchObject({ ok: false, status: 502, error: expect.stringContaining("rate_limit") });
    const noop = fakeStripe({ cancelAtPeriodEnd: async () => snap("active") });
    expect(await cancelClientSubscription("c1", "a1", noop, AT_END)).toMatchObject({ ok: false, status: 502 });
    expect(updates).toEqual([]);
  });

  it("503 si Stripe no está configurado: no desactiva al usuario", async () => {
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", null, AT_END)).toMatchObject({ ok: false, status: 503 });
    expect(updates).toEqual([]);
  });
});

describe("cancelClientSubscription — Stripe responde 'already canceled' al mutar (cancelada desde el dashboard entre retrieve y cancel)", () => {
  it("modo now: cancel() falla con 'already been canceled' → se confirma con retrieve y se trata como éxito (fila local canceled)", async () => {
    let calls = 0;
    const stripe = fakeStripe({
      retrieve: async () => (++calls === 1 ? snap("active", { periodEnd: PERIOD_END }) : snap("canceled")),
      cancel: async () => { throw alreadyCanceled(); },
    });
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe);
    expect(stripe.retrieve).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: true, mode: "now", alreadyCanceled: true, alreadyScheduled: false, localUpdated: true, userDeactivated: false, stripeSubscriptionId: "sub_live", status: "canceled", periodEnd: null });
    expect(updates).toEqual([{ table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 } }]);
  });

  it("modo now: cancel() falla con resource_missing tras un retrieve OK → también se confirma con retrieve antes de marcar", async () => {
    let calls = 0;
    const stripe = fakeStripe({
      retrieve: async () => (++calls === 1 ? snap("active") : snap("canceled")),
      cancel: async () => { throw missing(); },
    });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: true, alreadyCanceled: true, localUpdated: true, status: "canceled" });
    expect(updates).toHaveLength(1);
  });

  it("FAIL CLOSED: 'already canceled' pero retrieve sigue diciendo active → 502 sin tocar la fila local", async () => {
    const stripe = fakeStripe({ cancel: async () => { throw alreadyCanceled(); } });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502, error: expect.stringContaining("already been canceled") });
    expect(stripe.retrieve).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([]);
  });

  it("FAIL CLOSED: 'already canceled' pero el retrieve de confirmación falla → 502 sin tocar la fila local", async () => {
    let calls = 0;
    const stripe = fakeStripe({
      retrieve: async () => { if (++calls === 1) return snap("active"); throw new Error("api_connection_error"); },
      cancel: async () => { throw alreadyCanceled(); },
    });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502 });
    expect(updates).toEqual([]);
  });

  it("un error de cancel() que NO habla de cancelación previa sigue siendo 502 sin retrieve extra", async () => {
    const stripe = fakeStripe({ cancel: async () => { throw new Error("rate_limit"); } });
    selectRows = { users: [client], subscriptions: [activeSub] };
    expect(await cancelClientSubscription("c1", "a1", stripe)).toMatchObject({ ok: false, status: 502, error: expect.stringContaining("rate_limit") });
    expect(stripe.retrieve).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([]);
  });

  it("modo period_end: update() falla con 'A canceled subscription can only update…' → confirmado canceled, fila canceled y usuario desactivado", async () => {
    let calls = 0;
    const stripe = fakeStripe({
      retrieve: async () => (++calls === 1 ? snap("active", { periodEnd: PERIOD_END }) : snap("canceled")),
      cancelAtPeriodEnd: async () => { throw canceledOnlyDetails(); },
    });
    selectRows = { users: [client], subscriptions: [activeSub] };
    const r = await cancelClientSubscription("c1", "a1", stripe, AT_END);
    expect(r).toMatchObject({ ok: true, mode: "period_end", alreadyCanceled: true, alreadyScheduled: false, userDeactivated: true, status: "canceled" });
    expect(updates).toEqual([
      { table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 } },
      { table: "users", set: REVOKE },
    ]);
  });
});

describe("isStripeAlreadyCanceledError", () => {
  it("reconoce las distintas formas en que Stripe dice 'ya cancelada' y rechaza el resto", () => {
    expect(isStripeAlreadyCanceledError(alreadyCanceled())).toBe(true);
    expect(isStripeAlreadyCanceledError(canceledOnlyDetails())).toBe(true);
    expect(isStripeAlreadyCanceledError(missing())).toBe(true);
    expect(isStripeAlreadyCanceledError(new Error("This subscription is already cancelled"))).toBe(true);
    expect(isStripeAlreadyCanceledError(new Error("rate_limit"))).toBe(false);
    expect(isStripeAlreadyCanceledError(new Error("card_declined"))).toBe(false);
    expect(isStripeAlreadyCanceledError(undefined)).toBe(false);
  });
});

describe("syncLocalSubscriptionFromStripeEvent (webhook customer.subscription.*)", () => {
  const byStripeId = (id: string) => ({ eq: ["subscriptions.stripeSubscriptionId", id] });

  it("customer.subscription.deleted → la fila con ese stripe_subscription_id pasa a canceled", async () => {
    const r = await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "sub_dash", status: "active", deleted: true });
    expect(r).toEqual({ applied: true, reason: "synced" });
    expect(updates).toEqual([{ table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 0 } }]);
    expect(wheres).toEqual([byStripeId("sub_dash")]);
  });

  it("customer.subscription.updated con status canceled / incomplete_expired → canceled", async () => {
    expect(await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "sub_dash", status: "canceled", deleted: false })).toMatchObject({ applied: true });
    expect(await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "sub_dash", status: "INCOMPLETE_EXPIRED", deleted: false })).toMatchObject({ applied: true });
    expect(updates).toHaveLength(2);
    expect(wheres).toEqual([byStripeId("sub_dash"), byStripeId("sub_dash")]);
  });

  it("customer.subscription.updated con un status que sigue facturando NO toca la fila", async () => {
    for (const status of ["active", "past_due", "trialing", "unpaid", undefined]) {
      expect(await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "sub_dash", status, deleted: false })).toEqual({ applied: false, reason: "still_billing" });
    }
    expect(updates).toEqual([]);
  });

  it("borra y audita solo al cliente revocado cuyo periodo ya terminó", async () => {
    selectRows = {
      subscriptions: [{
        userId: "c1", cancelAtPeriodEnd: 1, currentPeriodEnd: new Date(Date.now() - 60_000),
      }],
      users: [{ id: "c1", role: "client", isActive: 0, email: "c1@example.com" }],
    };
    const r = await syncLocalSubscriptionFromStripeEvent({
      stripeSubscriptionId: "sub_dash", status: "canceled", deleted: true,
    });
    expect(r).toEqual({ applied: true, reason: "synced", autoDeletedUserId: "c1" });
    expect(updates).toEqual([{ table: "subscriptions", set: { status: "canceled", cancelAtPeriodEnd: 1 } }]);
    expect(deleteClientUser).toHaveBeenCalledWith("c1", "system:stripe-webhook", {
      audit: {
        actorId: "system:stripe-webhook",
        action: "delete_user",
        details: "Deleted revoked user c1 after Stripe subscription sub_dash expired",
      },
    });
  });

  it("no borra a usuarios activos, no revocados, o con fecha de fin futura", async () => {
    const base = { userId: "c1", cancelAtPeriodEnd: 1, currentPeriodEnd: new Date(Date.now() - 60_000) };
    for (const candidate of [
      { subscription: base, user: { id: "c1", role: "client", isActive: 1 } },
      { subscription: { ...base, cancelAtPeriodEnd: 0 }, user: { id: "c1", role: "client", isActive: 0 } },
      { subscription: base, user: { id: "c1", role: "admin", isActive: 0 } },
    ]) {
      deleteClientUserMock.mockClear();
      selectRows = { subscriptions: [candidate.subscription], users: [candidate.user] };
      await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "sub_dash", status: "canceled", deleted: true });
      expect(deleteClientUser).not.toHaveBeenCalled();
    }
    deleteClientUserMock.mockClear();
    selectRows = {
      subscriptions: [{ ...base, currentPeriodEnd: new Date(Date.now() + 60_000) }],
      users: [{ id: "c1", role: "client", isActive: 0 }],
    };
    await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "sub_dash", status: "canceled", deleted: true });
    expect(deleteClientUser).not.toHaveBeenCalled();
  });

  it("sin id de suscripción no hace nada", async () => {
    expect(await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: "", status: "canceled", deleted: true })).toEqual({ applied: false, reason: "no_id" });
    expect(await syncLocalSubscriptionFromStripeEvent({ stripeSubscriptionId: undefined, status: "canceled", deleted: true })).toEqual({ applied: false, reason: "no_id" });
    expect(updates).toEqual([]);
  });
});
