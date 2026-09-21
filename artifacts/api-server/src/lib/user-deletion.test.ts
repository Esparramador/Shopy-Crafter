import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Doble de drizzle: devuelve filas por tabla y registra lo que borra la transacción ──
type Row = Record<string, unknown>;
const tables = {
  users: "users", subscriptions: "subscriptions", onboarding: "onboarding_progress", achievements: "achievements",
  platform_settings: "platform_settings", referral_tracking: "referral_tracking", affiliates: "affiliates",
  report_templates: "report_templates", youtube_tokens: "youtube_tokens",
};
let selectRows: Record<string, Row[]> = {};
const txOps: string[] = [];
let transactionRan = false;

const nameOf = (t: unknown) => (t as { __name: string }).__name;
function selectChain(fromCb?: (table: string) => void) {
  return {
    from: (t: unknown) => {
      fromCb?.(nameOf(t));
      const rows = selectRows[nameOf(t)] ?? [];
      const result = { limit: async () => rows, then: (r: (v: Row[]) => void) => r(rows) };
      return { where: () => result };
    },
  };
}

vi.mock("@workspace/db", () => {
  const mk = (name: string, cols: string[]) => Object.fromEntries([["__name", name], ...cols.map(c => [c, `${name}.${c}`])]);
  return {
    usersTable: mk("users", ["id", "email", "role"]),
    subscriptionsTable: mk("subscriptions", ["userId", "stripeSubscriptionId", "status", "plan"]),
    onboardingProgressTable: mk("onboarding_progress", ["userId"]),
    achievementsTable: mk("achievements", ["userId"]),
    platformSettingsTable: mk("platform_settings", ["key"]),
    referralTrackingTable: mk("referral_tracking", ["referredUserId", "affiliateId"]),
    affiliatesTable: mk("affiliates", ["id", "userId"]),
    reportTemplatesTable: mk("report_templates", ["userId"]),
    youtubeTokensTable: mk("youtube_tokens", ["userId"]),
    db: {
      select: () => selectChain(),
      transaction: async (cb: (tx: unknown) => Promise<void>) => {
        transactionRan = true;
        const tx = {
          execute: async (q: unknown) => {
            const text = JSON.stringify(q);
            txOps.push(text.includes("user_sessions") ? "sql:user_sessions" : text.includes("to_regclass") ? "sql:to_regclass" : "sql:calendar_tokens");
            return { rows: text.includes("to_regclass") ? [{ t: "calendar_tokens" }] : [] };
          },
          delete: (t: unknown) => ({ where: async () => { txOps.push(`delete:${nameOf(t)}`); } }),
          update: (t: unknown) => ({ set: () => ({ where: async () => { txOps.push(`update:${nameOf(t)}`); } }) }),
          select: () => selectChain(),
        };
        await cb(tx);
      },
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
  sql: Object.assign((strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings.join("?"), vals }), {}),
}));

import { deleteClientUser, subscriptionBlocksDeletion } from "./user-deletion";

const client = { id: "c1", email: "c1@e2e.invalid", role: "client" };

beforeEach(() => { selectRows = {}; txOps.length = 0; transactionRan = false; });

describe("subscriptionBlocksDeletion", () => {
  it("no bloquea sin fila, sin id de Stripe, o con suscripción ya cancelada", () => {
    expect(subscriptionBlocksDeletion(undefined)).toBe(false);
    expect(subscriptionBlocksDeletion({ stripeSubscriptionId: null, status: "active" })).toBe(false);
    expect(subscriptionBlocksDeletion({ stripeSubscriptionId: "sub_1", status: "canceled" })).toBe(false);
    expect(subscriptionBlocksDeletion({ stripeSubscriptionId: "sub_1", status: "incomplete_expired" })).toBe(false);
  });
  it("bloquea cualquier suscripción de Stripe que siga facturando", () => {
    for (const status of ["active", "trialing", "past_due", "unpaid", "paused", null]) {
      expect(subscriptionBlocksDeletion({ stripeSubscriptionId: "sub_1", status })).toBe(true);
    }
  });
});

describe("deleteClientUser", () => {
  it("rechaza borrarse a uno mismo sin tocar la BD", async () => {
    const r = await deleteClientUser("admin1", "admin1");
    expect(r).toEqual({ ok: false, status: 400, error: expect.stringContaining("propio usuario") });
    expect(transactionRan).toBe(false);
  });

  it("404 si el usuario no existe", async () => {
    const r = await deleteClientUser("ghost", "admin1");
    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(transactionRan).toBe(false);
  });

  it("403 si el objetivo es un admin", async () => {
    selectRows = { users: [{ id: "a2", email: "a2@x", role: "admin" }] };
    const r = await deleteClientUser("a2", "admin1");
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(transactionRan).toBe(false);
  });

  it("409 si tiene una suscripción de Stripe activa (no se borra nada local)", async () => {
    selectRows = { users: [client], subscriptions: [{ stripeSubscriptionId: "sub_live", status: "active", plan: "starter" }] };
    const r = await deleteClientUser("c1", "admin1");
    expect(r).toMatchObject({ ok: false, status: 409, subscription: { stripeSubscriptionId: "sub_live", plan: "starter" } });
    expect(transactionRan).toBe(false);
  });

  it("borra un cliente sin facturación pendiente limpiando sus dependencias en orden", async () => {
    selectRows = { users: [client], subscriptions: [{ stripeSubscriptionId: "sub_old", status: "canceled", plan: "starter" }] };
    const r = await deleteClientUser("c1", "admin1");
    expect(r).toEqual({ ok: true, deleted: { id: "c1", email: "c1@e2e.invalid" } });
    expect(txOps).toEqual([
      "sql:user_sessions",
      "delete:onboarding_progress",
      "delete:achievements",
      "delete:subscriptions",
      "delete:platform_settings",
      "update:referral_tracking",
      "delete:referral_tracking",
      "delete:affiliates",
      "delete:report_templates",
      "delete:youtube_tokens",
      "sql:to_regclass",
      "sql:calendar_tokens",
      "delete:users",
    ]);
    // Los referidos del afiliado se borran ANTES que el afiliado, y el usuario al final.
    expect(txOps.indexOf("delete:referral_tracking")).toBeLessThan(txOps.indexOf("delete:affiliates"));
    expect(txOps.at(-1)).toBe("delete:users");
  });
});
