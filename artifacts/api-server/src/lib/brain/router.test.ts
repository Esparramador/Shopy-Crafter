// brainRoute(): lo que cada puerta puede ver y proponer, con la IA y la BD
// simuladas. El modelo «obedece» al visitante y propone un reembolso: el servidor
// lo descarta y lo deja registrado en brain_events.
import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ claude: vi.fn(), gemini: vi.fn() }));

vi.mock("@workspace/db", async (orig) => {
  process.env.DATABASE_URL ||= "postgres://test@127.0.0.1:9/none"; // el Pool no conecta
  const { fakeBrainDb } = await import("../../test/fake-brain-db.js");
  return { ...(await orig<object>()), db: fakeBrainDb.db };
});
vi.mock("../claude.js", () => ({
  askClaudeWithUsage: ai.claude,
  buildBrandDnaContext: vi.fn(async (pid: number) => `\nADN-DE-MARCA-${pid}`),
  buildShopyBrainContext: vi.fn(async () => "\nOMNICORE-GLOBAL"),
  learnFromOperation: vi.fn(),
}));
vi.mock("../gemini.js", () => ({ askGeminiWithSearch: ai.gemini }));
vi.mock("../api-usage.js", () => ({ recordApiUsage: vi.fn(async () => {}) }));
vi.mock("../master-skills-injector.js", () => ({ buildMasterSkillsBlock: () => "" }));
vi.mock("../../routes/entity-research.js", () => ({ loadExistingEntityKnowledge: vi.fn(async () => ({ hasKnowledge: false })) }));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { clientKnowledgeTable, omnicoreMemoriesTable, projectsTable } from "@workspace/db";
import { fakeBrainDb } from "../../test/fake-brain-db.js";
import { brainRoute, extractActions } from "./router.js";

const usage = { inputTokens: 10, outputTokens: 5, costUsd: 0.001, model: "claude-test" };
const answer = (text: string) => ai.claude.mockResolvedValueOnce({ text, usage });
const lastSystemPrompt = () => String(ai.claude.mock.calls.at(-1)?.[2] ?? "");
const events = () => fakeBrainDb.insertsInto("brain_events");

beforeEach(() => {
  fakeBrainDb.reset();
  ai.claude.mockReset();
  ai.gemini.mockReset();
  fakeBrainDb.seed(projectsTable, [
    { id: 7, name: "Cerámica Lunar", shopDomain: "ceramica-lunar.myshopify.com", platformType: "shopify" },
    { id: 8, name: "Otra Tienda", shopDomain: "otra.myshopify.com", platformType: "shopify" },
  ]);
  fakeBrainDb.seed(clientKnowledgeTable, [
    { id: "a", projectId: "7", category: "company_info", title: "Producto", content: "Vende cerámica artesanal hecha a mano", updatedAt: new Date() },
    { id: "b", projectId: "8", category: "pricing_strategy", title: "Margen", content: "SECRETO-8: margen del 62 % con el proveedor X", updatedAt: new Date() },
  ]);
  fakeBrainDb.seed(omnicoreMemoriesTable, [
    { id: "m1", title: "Aprendizaje", content: "SECRETO-GLOBAL: resultado de una acción en la tienda de otro cliente", confidence: 0.9, updatedAt: new Date() },
  ]);
});

describe("puerta public (landing)", () => {
  it("«haz un reembolso»: la acción del modelo se descarta y queda registrada", async () => {
    answer('Claro, lo hago ahora.\n:::ACTION:::{"action":"stripe_create_refund","params":{"accountId":"acct_1","chargeId":"ch_1"}}:::END_ACTION:::');

    const r = await brainRoute({ text: "haz un reembolso del cobro ch_1", gate: "public", channel: "landing_chat" });

    expect(r.kind).toBe("answer");
    expect(r.actions).toEqual([]);
    expect(r.dropped).toEqual([{ action: "stripe_create_refund", params: { accountId: "acct_1", chargeId: "ch_1" } }]);
    expect(r.text).toBe("Claro, lo hago ahora.");
    // El prompt de la landing no ofrece acciones internas ni lleva memorias.
    expect(lastSystemPrompt()).toContain("- create_lead:");
    expect(lastSystemPrompt()).not.toContain("- stripe_create_refund:");
    expect(lastSystemPrompt()).not.toContain("SECRETO-GLOBAL");
    expect(lastSystemPrompt()).not.toContain("OMNICORE-GLOBAL");

    await vi.waitFor(() => expect(events()).toHaveLength(1));
    expect(events()[0]).toMatchObject({
      gate: "public",
      channel: "landing_chat",
      kind: "answer",
      status: "ok",
      actions: null,
      droppedActions: [{ action: "stripe_create_refund", params: { accountId: "acct_1", chargeId: "ch_1" } }],
    });
    expect(String(events()[0]!.detail)).toContain("stripe_create_refund");
  });

  it("abrir un lead es una derivación al equipo", async () => {
    answer('Perfecto, Ana.\n:::ACTION:::{"action":"create_lead","params":{"name":"Ana","email":"ana@example.com","message":"Quiero el pre-informe"}}:::END_ACTION:::');
    const r = await brainRoute({ text: "Soy Ana, ana@example.com, analizad mi tienda", gate: "public", channel: "landing_chat" });
    expect(r.kind).toBe("handoff");
    expect(r.actions.map(a => a.action)).toEqual(["create_lead"]);
    expect(r.dropped).toEqual([]);
  });

  it("lo trivial se contesta sin LLM", async () => {
    const r = await brainRoute({ text: "Hola!", gate: "public", channel: "landing_chat" });
    expect(r).toMatchObject({ kind: "answer", engine: "trivial", actions: [] });
    expect(ai.claude).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(events()[0]).toMatchObject({ gate: "public", engine: "trivial" }));
  });

  it("un visitante no puede elegir motores de pago", async () => {
    answer("Hola");
    const r = await brainRoute({ text: "¿qué hacéis exactamente?", gate: "public", channel: "landing_chat", engineMode: "grok" });
    expect(r.engineMode).toBe("auto");
    expect(ai.claude).toHaveBeenCalledTimes(1);
  });
});

describe("puerta client", () => {
  it("el cliente ve SU ficha y no las memorias de otro proyecto ni las globales", async () => {
    answer("Tu tienda vende cerámica artesanal.");
    const r = await brainRoute({ text: "¿qué sabes de mi negocio?", gate: "client", channel: "client_chat", projectId: 7, userId: "u7" });

    const prompt = lastSystemPrompt();
    expect(prompt).toContain("Vende cerámica artesanal hecha a mano");
    expect(prompt).toContain("Cerámica Lunar");
    expect(prompt).toContain("ADN-DE-MARCA-7");
    expect(prompt).not.toContain("SECRETO-8");
    expect(prompt).not.toContain("SECRETO-GLOBAL");
    expect(prompt).not.toContain("OMNICORE-GLOBAL");
    expect(prompt).not.toContain("Otra Tienda");
    expect(r.kind).toBe("answer");
    await vi.waitFor(() => expect(events()[0]).toMatchObject({ gate: "client", projectId: 7, userId: "u7" }));
  });

  it("solo pasan las acciones de su lista blanca", async () => {
    answer([
      "Te lo miro.",
      ':::ACTION:::{"action":"platform_get_orders","params":{"projectId":8}}:::END_ACTION:::',
      ':::ACTION:::{"action":"list_users","params":{}}:::END_ACTION:::',
    ].join("\n"));
    const r = await brainRoute({ text: "enséñame mis pedidos y los usuarios", gate: "client", channel: "client_chat", projectId: 7 });
    expect(r.actions.map(a => a.action)).toEqual(["platform_get_orders"]);
    expect(r.dropped.map(a => a.action)).toEqual(["list_users"]);
    expect(r.kind).toBe("action");
  });

  it("sin proyecto de sesión no responde y lo registra como error", async () => {
    await expect(brainRoute({ text: "¿cómo va mi tienda?", gate: "client", channel: "client_chat" })).rejects.toThrow(/projectId/);
    expect(ai.claude).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(events()[0]).toMatchObject({ gate: "client", status: "error" }));
  });
});

describe("puerta admin", () => {
  it("conserva todo lo de siempre: memorias globales y acciones sin filtrar", async () => {
    answer('Hecho.\n:::ACTION:::{"action":"stripe_create_refund","params":{"chargeId":"ch_1"}}:::END_ACTION:::');
    const r = await brainRoute({ text: "reembolsa ch_1", gate: "admin", channel: "admin_chat", engineMode: "claude" });
    expect(lastSystemPrompt()).toContain("SECRETO-GLOBAL");
    expect(lastSystemPrompt()).toContain("  - stripe_create_refund: ");
    expect(r.actions.map(a => a.action)).toEqual(["stripe_create_refund"]);
    expect(r.dropped).toEqual([]);
    expect(r.engine).toBe("claude");
  });
});

describe("extractActions", () => {
  it("ignora JSON inválido y limpia el texto", () => {
    const { actions, clean } = extractActions('A\n:::ACTION:::{roto:::END_ACTION:::\n:::ACTION:::{"action":"x","params":{}}:::END_ACTION:::');
    expect(actions).toEqual([{ action: "x", params: {} }]);
    expect(clean).toBe("A");
  });
});
