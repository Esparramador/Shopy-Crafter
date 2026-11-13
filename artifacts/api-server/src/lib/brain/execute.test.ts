// brainExecute(): la puerta se comprueba en el servidor, sin req para client/public,
// y un cliente solo actúa sobre su proyecto. Conector, leads y BD simulados.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ withPlatform: vi.fn(), acceptLead: vi.fn(), push: vi.fn(async () => {}) }));

vi.mock("@workspace/db", async (orig) => {
  process.env.DATABASE_URL ||= "postgres://test@127.0.0.1:9/none"; // el Pool no conecta
  const { fakeBrainDb } = await import("../../test/fake-brain-db.js");
  return { ...(await orig<object>()), db: fakeBrainDb.db };
});
vi.mock("../platform-helper.js", () => ({ withPlatform: m.withPlatform, getProjectPlatformType: vi.fn(async () => "shopify") }));
vi.mock("../contact-lead.js", () => ({ acceptContactLead: m.acceptLead }));
vi.mock("../push-helper.js", () => ({ sendPushToAdmins: m.push }));
vi.mock("../claude.js", () => ({ learnFromOperation: vi.fn() }));
vi.mock("../vault.js", () => ({ saveToVault: vi.fn(async () => {}) }));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { fakeBrainDb } from "../../test/fake-brain-db.js";
import { brainExecute } from "./execute.js";

const events = () => fakeBrainDb.insertsInto("brain_events");

beforeEach(() => {
  fakeBrainDb.reset();
  m.withPlatform.mockReset();
  m.acceptLead.mockReset();
});

describe("puerta public", () => {
  it("un reembolso pedido desde la landing se rechaza (403) y se registra", async () => {
    const out = await brainExecute({
      action: "stripe_create_refund", params: { accountId: "acct_1", chargeId: "ch_1", confirmed: true },
      gate: "public", channel: "landing_chat", ip: "203.0.113.9",
    });
    expect(out).toEqual({ kind: "result", status: 403, body: { error: "La acción stripe_create_refund no está permitida aquí." } });
    await vi.waitFor(() => expect(events()).toHaveLength(1));
    expect(events()[0]).toMatchObject({ gate: "public", kind: "execute", status: "denied", actions: [{ action: "stripe_create_refund" }] });
  });

  it("create_lead registra el lead (y su Pre-Informe) con la IP del visitante", async () => {
    m.acceptLead.mockResolvedValueOnce("accepted");
    const out = await brainExecute({
      action: "create_lead",
      params: { name: " Ana ", email: "Ana@Example.com", storeUrl: "https://ana.example", message: "Quiero crecer", services: ["seo", 3] },
      gate: "public", channel: "landing_chat", ip: "203.0.113.9",
    });
    expect(out).toMatchObject({ kind: "result", status: 200, body: { success: true } });
    const [lead, opts] = m.acceptLead.mock.calls[0]!;
    expect(lead).toMatchObject({ name: "Ana", email: "ana@example.com", storeUrl: "https://ana.example", message: "Quiero crecer", services: ["seo"] });
    expect(opts).toMatchObject({ ip: "203.0.113.9" });
    await vi.waitFor(() => expect(events()[0]).toMatchObject({ gate: "public", status: "ok" }));
  });

  it("sin email válido no abre nada", async () => {
    const out = await brainExecute({ action: "create_lead", params: { name: "Ana", email: "no-es-email" }, gate: "public" });
    expect(out).toMatchObject({ status: 400 });
    expect(m.acceptLead).not.toHaveBeenCalled();
  });

  it("respeta el límite por IP", async () => {
    m.acceptLead.mockResolvedValueOnce("rate_limited");
    const out = await brainExecute({ action: "create_lead", params: { name: "Ana", email: "ana@example.com" }, gate: "public", ip: "1.2.3.4" });
    expect(out).toMatchObject({ status: 429 });
  });
});

describe("puerta client", () => {
  it("lee SUS pedidos aunque el modelo pida otro proyecto, sin req", async () => {
    m.withPlatform.mockImplementation(async (pid: number) => ({ ok: true, data: [{ total: "10.00", currency: "EUR", pid }] }));
    const out = await brainExecute({ action: "platform_get_orders", params: { projectId: 8 }, gate: "client", projectId: 7, channel: "client_chat" });
    expect(out).toMatchObject({ kind: "result", status: 200, body: { action: "platform_get_orders", success: true, total: 1 } });
    expect(m.withPlatform).toHaveBeenCalledTimes(1);
    expect(m.withPlatform.mock.calls[0]![0]).toBe(7);
  });

  it("request_team deja la petición en los mensajes de SU proyecto y avisa al equipo", async () => {
    const out = await brainExecute({
      action: "request_team", params: { projectId: 8, title: "Nueva colección", content: "Quiero una colección de Navidad" },
      gate: "client", projectId: 7, userName: "Lucía",
    });
    expect(out).toMatchObject({ status: 200, body: { success: true } });
    const insert = fakeBrainDb.executes.find(e => e.sql.includes("INSERT INTO messages"))!;
    expect(insert.params).toContain("7");
    expect(insert.params).not.toContain("8");
    expect(insert.params).toContain("Lucía");
    expect(m.push).toHaveBeenCalled();
  });

  it("no puede usar acciones de admin", async () => {
    const out = await brainExecute({ action: "list_users", params: {}, gate: "client", projectId: 7 });
    expect(out).toMatchObject({ status: 403 });
  });

  it("sin proyecto de sesión no ejecuta", async () => {
    const out = await brainExecute({ action: "platform_get_orders", params: { projectId: 7 }, gate: "client" });
    expect(out).toMatchObject({ status: 400 });
    expect(m.withPlatform).not.toHaveBeenCalled();
  });
});

describe("puerta admin", () => {
  it("las acciones propias de las otras puertas no son del admin", async () => {
    const out = await brainExecute({ action: "create_lead", params: { name: "x", email: "x@example.com" }, gate: "admin" });
    expect(out).toMatchObject({ status: 403 });
  });
});
