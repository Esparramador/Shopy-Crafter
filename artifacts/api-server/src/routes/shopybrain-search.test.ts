// /shopybrain/search y /execute-action son ahora envoltorios de brainRoute y
// brainExecute: el chat de admin tiene que recibir exactamente lo mismo que antes.
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ claude: vi.fn() }));

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeBrainDb } = await import("../test/fake-brain-db.js");
  return {
    ...schema,
    db: fakeBrainDb.db,
    pool: { query: async () => ({ rows: [] }) },
  };
});
vi.mock("../lib/auth.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/claude.js", () => ({
  askClaudeWithUsage: ai.claude,
  askClaudeWithBrain: vi.fn(),
  buildBrandDnaContext: vi.fn(async () => ""),
  buildShopyBrainContext: vi.fn(async () => ""),
  learnFromOperation: vi.fn(),
}));
vi.mock("../lib/gemini.js", () => ({ askGeminiWithSearch: vi.fn() }));
vi.mock("../lib/api-usage.js", () => ({ recordApiUsage: vi.fn(async () => {}) }));
vi.mock("../lib/master-skills-injector.js", () => ({ buildMasterSkillsBlock: () => "" }));
vi.mock("./entity-research.js", () => ({ loadExistingEntityKnowledge: vi.fn(async () => ({ hasKnowledge: false })) }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { brainEventsTable } from "@workspace/db";
import { fakeBrainDb } from "../test/fake-brain-db.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: router } = await import("./shopybrain.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as unknown as { session: object }).session = { userId: "admin-1" }; next(); });
  app.use("/api", router);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => { server.close(); });
beforeEach(() => { fakeBrainDb.reset(); ai.claude.mockReset(); });

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /shopybrain/search (chat de admin)", () => {
  it("misma forma de respuesta: answer, source, engine, usage, entidad y detectedAction", async () => {
    const usage = { inputTokens: 100, outputTokens: 20, costUsd: 0.01, model: "claude-sonnet-4-5" };
    ai.claude.mockResolvedValueOnce({ text: 'Voy a mirarlo.\n:::ACTION:::{"action":"store_status","params":{"projectId":7}}:::END_ACTION:::', usage });

    const r = await post("/shopybrain/search", { query: "estado de la tienda", returnRaw: true, engineMode: "claude", activeProjectId: 7, conversationHistory: "Usuario: hola" });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Object.keys(body).sort()).toEqual(["answer", "detectedAction", "engine", "entityKnowledgeUsed", "potentialEntity", "source", "usage"]);
    expect(body).toEqual({
      answer: "Voy a mirarlo.",
      source: "claude",
      engine: "claude",
      usage,
      entityKnowledgeUsed: false,
      potentialEntity: null,
      detectedAction: { action: "store_status", params: { projectId: 7 } },
    });
    // Sigue llevando el historial y el prompt de admin.
    expect(String(ai.claude.mock.calls[0]![1][0].content)).toContain("Conversación previa:\nUsuario: hola");
    expect(String(ai.claude.mock.calls[0]![2])).toContain("CAPACIDADES DE ACCIÓN DIRECTA — SHOPIFY:");
    await vi.waitFor(() => expect(fakeBrainDb.insertsInto("brain_events")[0]).toMatchObject({ gate: "admin", channel: "admin_chat", kind: "action", userId: "admin-1" }));
  });

  it("varias acciones van también en detectedActions; sin acciones, detectedAction es null", async () => {
    ai.claude.mockResolvedValueOnce({
      text: 'Hecho.\n:::ACTION:::{"action":"list_products","params":{}}:::END_ACTION:::\n:::ACTION:::{"action":"get_orders","params":{}}:::END_ACTION:::',
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, model: "m" },
    });
    const two = await (await post("/shopybrain/search", { query: "productos y pedidos", returnRaw: true, engineMode: "claude" })).json();
    expect(two.detectedAction).toEqual({ action: "list_products", params: {} });
    expect(two.detectedActions).toHaveLength(2);

    ai.claude.mockResolvedValueOnce({ text: "Nada que ejecutar.", usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, model: "m" } });
    const none = await (await post("/shopybrain/search", { query: "explícame algo", returnRaw: true, engineMode: "claude" })).json();
    expect(none.detectedAction).toBeNull();
    expect(none).not.toHaveProperty("detectedActions");
  });

  it("si la IA falla, el mismo mensaje de recuperación de siempre", async () => {
    ai.claude.mockRejectedValueOnce(new Error("429 rate_limit_error"));
    const r = await post("/shopybrain/search", { query: "hola", returnRaw: true, engineMode: "claude" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      answer: "⏳ Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.",
      source: "error_recovery",
      detectedAction: null,
    });
  });
});

describe("POST /shopybrain/execute-action", () => {
  it("mismos errores de siempre", async () => {
    let r = await post("/shopybrain/execute-action", {});
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "action requerida" });

    r = await post("/shopybrain/execute-action", { action: "no_existe", params: { projectId: 3 } });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Acción desconocida: no_existe" });

    r = await post("/shopybrain/execute-action", { action: "store_status", params: { projectId: 3, productId: "../admin" } });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Parámetro no válido: productId" });
  });

  it("una destructiva sin token pide confirmación", async () => {
    const r = await post("/shopybrain/execute-action", { action: "delete_product", params: { projectId: 3, productId: "55", confirmed: true } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ requiresConfirmation: true, action: "delete_product" });
  });
});

describe("GET /shopybrain/events y /catalog", () => {
  it("lista eventos por puerta, del más nuevo al más viejo", async () => {
    fakeBrainDb.seed(brainEventsTable, [{ id: 3, gate: "public", channel: "landing_chat", kind: "answer", status: "ok" }]);
    const r = await fetch(`${base}/shopybrain/events?gate=public&limit=10`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ events: [expect.objectContaining({ id: 3, gate: "public" })], nextBefore: null });
    expect((await fetch(`${base}/shopybrain/events?gate=root`)).status).toBe(400);
  });

  it("filtra por canal", async () => {
    fakeBrainDb.seed(brainEventsTable, [
      { id: 5, gate: "admin", channel: "studio-fusion", kind: "execute", status: "ok" },
      { id: 4, gate: "admin", channel: "admin_chat", kind: "answer", status: "ok" },
    ]);
    const r = await (await fetch(`${base}/shopybrain/events?channel=studio-fusion`)).json();
    expect(r.events.map((e: { id: number }) => e.id)).toEqual([5]);
  });

  it("el catálogo por puerta", async () => {
    const r = await (await fetch(`${base}/shopybrain/catalog?gate=public`)).json();
    expect(r.actions.map((a: { name: string }) => a.name)).toEqual(["create_lead"]);
  });
});
