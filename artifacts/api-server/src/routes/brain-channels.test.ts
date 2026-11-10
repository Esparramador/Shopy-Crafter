// La landing (puerta public) y el chat del cliente (puerta client) pasan por
// ShopyBrain: Gemini rápido con streaming, solo las acciones de su puerta, el lead
// solo con los datos que el visitante escribió y nunca datos de otro proyecto.
// IA, leads y BD simulados; las rutas, de verdad sobre un express efímero.
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  geminiChat: vi.fn(),
  geminiStream: vi.fn(),
  claude: vi.fn(),
  acceptLead: vi.fn(),
  session: {} as Record<string, unknown>,
}));

vi.mock("@workspace/db", async (orig) => {
  process.env.DATABASE_URL ||= "postgres://test@127.0.0.1:9/none"; // el Pool no conecta
  const { fakeBrainDb } = await import("../test/fake-brain-db.js");
  return { ...(await orig<object>()), db: fakeBrainDb.db };
});
vi.mock("../lib/auth.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/gemini.js", () => ({
  askGeminiChat: m.geminiChat,
  askGeminiStream: m.geminiStream,
  askGeminiWithSearch: vi.fn(async () => ({ text: "", sources: [], queries: [] })),
  askGeminiWithUrls: vi.fn(async () => ({ text: "" })),
}));
vi.mock("../lib/claude.js", () => ({
  askClaudeWithUsage: m.claude,
  buildBrandDnaContext: vi.fn(async (pid: number) => `\nADN-DE-MARCA-${pid}`),
  buildShopyBrainContext: vi.fn(async () => "\nOMNICORE-GLOBAL"),
  learnFromOperation: vi.fn(),
}));
vi.mock("../lib/client-advisor.js", async (orig) => ({ ...(await orig<object>()), extractAndLearnFromChat: vi.fn() }));
vi.mock("../lib/contact-lead.js", () => ({ acceptContactLead: m.acceptLead }));
vi.mock("../lib/push-helper.js", () => ({ sendPushToAdmins: vi.fn(async () => {}), sendPushToClientByProject: vi.fn(async () => {}) }));
vi.mock("../lib/api-usage.js", () => ({ recordApiUsage: vi.fn(async () => {}) }));
vi.mock("../lib/master-skills-injector.js", () => ({ buildMasterSkillsBlock: () => "" }));
vi.mock("./entity-research.js", () => ({ loadExistingEntityKnowledge: vi.fn(async () => ({ hasKnowledge: false })) }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { clientKnowledgeTable, omnicoreMemoriesTable, productsTable, projectsTable } from "@workspace/db";
import { fakeBrainDb } from "../test/fake-brain-db.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: publicChat } = await import("./public-chat.js");
  const { default: client } = await import("./client.js");
  const app = express();
  app.set("trust proxy", false);
  app.use(express.json());
  app.use((req, _res, next) => { (req as unknown as { session: object }).session = { ...m.session }; next(); });
  app.use("/api", publicChat);
  app.use("/api/client", client);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
}, 60_000);
afterAll(() => { server.close(); });

beforeEach(() => {
  fakeBrainDb.reset();
  m.geminiChat.mockReset();
  m.geminiStream.mockReset();
  m.claude.mockReset();
  m.acceptLead.mockReset();
  m.session = {};
  fakeBrainDb.seed(projectsTable, [
    { id: 7, name: "Cerámica Lunar", shopDomain: "ceramica-lunar.myshopify.com", platformType: "shopify" },
    { id: 8, name: "Otra Tienda", shopDomain: "otra.myshopify.com", platformType: "shopify" },
  ]);
  fakeBrainDb.seed(clientKnowledgeTable, [
    { id: "a", projectId: "7", category: "company_info", title: "Producto", content: "Vende cerámica artesanal hecha a mano", updatedAt: new Date() },
    { id: "b", projectId: "8", category: "pricing_strategy", title: "Margen", content: "SECRETO-8: margen del 62 % con el proveedor X", updatedAt: new Date() },
  ]);
  fakeBrainDb.seed(productsTable, [
    { id: 1, projectId: 7, title: "Taza Luna", price: "18", auditScore: 72, auditGrade: "B" },
    { id: 2, projectId: 8, title: "PRODUCTO-SECRETO-8", price: "99", auditScore: 40, auditGrade: "D" },
  ]);
  fakeBrainDb.seed(omnicoreMemoriesTable, [
    { id: "m1", title: "Aprendizaje", content: "SECRETO-GLOBAL: dato de otro cliente", confidence: 0.9, updatedAt: new Date() },
  ]);
});

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Gemini en streaming, en trozos (aquí partimos el bloque de acción a propósito). */
function streamOf(chunks: string[]) {
  return async function* () {
    for (const text of chunks) yield { text };
    yield { done: true, usage: { inputTokens: 10, outputTokens: 5, thinkingTokens: 0, totalTokens: 15, costUsd: 0, model: "gemini-flash-test" } };
  };
}

/** Lee el SSE: el texto completo y el evento final. */
async function readSse(r: Response): Promise<{ text: string; frames: Array<Record<string, unknown>>; last: Record<string, unknown> }> {
  const raw = await r.text();
  const frames = raw.split("\n\n").filter(f => f.startsWith("data: ")).map(f => JSON.parse(f.slice(6)) as Record<string, unknown>);
  return { text: frames.map(f => (typeof f.text === "string" ? f.text : "")).join(""), frames, last: frames[frames.length - 1] ?? {} };
}

const events = () => fakeBrainDb.insertsInto("brain_events");
const systemPromptOf = (mock: ReturnType<typeof vi.fn>) => String(mock.mock.calls.at(-1)?.[1] ?? "");

describe("landing (puerta public)", () => {
  it("pedir un reembolso no ejecuta nada: la acción se descarta y queda en brain_events", async () => {
    m.geminiChat.mockResolvedValueOnce('Hecho, te devuelvo el dinero.\n:::ACTION:::{"action":"stripe_create_refund","params":{"chargeId":"ch_1"}}:::END_ACTION:::');

    const r = await post("/public/landing-chat", { messages: [{ role: "user", content: "haz un reembolso del cobro ch_1" }] });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.content).toBe("Hecho, te devuelvo el dinero.");
    expect(body.lead).toBeUndefined();
    expect(m.acceptLead).not.toHaveBeenCalled();

    // Prompt de la puerta public + el del canal; sin memorias ni acciones internas.
    const sys = systemPromptOf(m.geminiChat);
    expect(sys).toContain("INSTRUCCIONES DE ESTE CANAL (landing-chat)");
    expect(sys).toContain("ShopyAdvisor");
    expect(sys).toContain("- create_lead:");
    expect(sys).not.toContain("- stripe_create_refund:");
    expect(sys).not.toContain("SECRETO-GLOBAL");

    await vi.waitFor(() => expect(events()).toHaveLength(1));
    expect(events()[0]).toMatchObject({
      gate: "public", channel: "landing-chat", kind: "answer", status: "ok",
      droppedActions: [{ action: "stripe_create_refund" }],
    });
  });

  it("con nombre y email escritos por el visitante, abre el lead (streaming) y lo confirma", async () => {
    m.acceptLead.mockResolvedValueOnce("accepted");
    m.geminiStream.mockImplementationOnce(streamOf([
      "¡Gracias, Ana! Abro tu solicitud.",
      '\n:::ACT',
      'ION:::{"action":"create_lead","params":{"name":"Ana","email":"ana@ceramica.es","storeUrl":"ceramica.es","message":"Quiere el Pre-Informe"}}:::END_',
      "ACTION:::",
    ]));

    const r = await post("/public/landing-chat/stream", {
      messages: [
        { role: "user", content: "Quiero que analicéis mi tienda ceramica.es" },
        { role: "assistant", content: "¡Claro! ¿Me dices tu nombre y tu email?" },
        { role: "user", content: "Soy Ana, ana@ceramica.es" },
      ],
    });
    expect(r.status).toBe(200);
    const { text, last } = await readSse(r);
    expect(text).not.toContain(":::");
    expect(text).toContain("¡Gracias, Ana! Abro tu solicitud.");
    expect(text).toContain("He abierto tu solicitud");
    expect(text).toContain("Pre-Informe");
    expect(last).toMatchObject({ done: true, lead: { ok: true } });

    expect(m.acceptLead).toHaveBeenCalledTimes(1);
    expect(m.acceptLead.mock.calls[0]![0]).toMatchObject({ name: "Ana", email: "ana@ceramica.es", extraInfo: "Abierta por ShopyBrain (landing-chat)" });
    await vi.waitFor(() => expect(events().map(e => `${e.kind}:${e.status}`)).toEqual(expect.arrayContaining(["handoff:ok", "execute:ok"])));
  });

  it("si el email no lo escribió el visitante (lo inventa el modelo), no se abre nada y se le piden los datos", async () => {
    m.geminiChat.mockResolvedValueOnce('Te abro la solicitud.\n:::ACTION:::{"action":"create_lead","params":{"name":"Visitante","email":"visitante@example.com"}}:::END_ACTION:::');

    const r = await post("/public/landing-chat", { messages: [{ role: "user", content: "quiero que me contactéis" }] });
    const body = await r.json();
    expect(m.acceptLead).not.toHaveBeenCalled();
    expect(body.lead).toBeUndefined();
    expect(body.content).toContain("necesito tu nombre y tu email");
  });

  it("el streaming sigue funcionando: trozos en orden y evento final done", async () => {
    m.geminiStream.mockImplementationOnce(streamOf(["Shopy Crafter ", "optimiza tu ", "tienda con IA."]));
    const r = await post("/public/landing-chat/stream", { messages: [{ role: "user", content: "¿qué hacéis exactamente por una tienda?" }] });
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const { frames, text, last } = await readSse(r);
    expect(frames.filter(f => f.text).length).toBeGreaterThanOrEqual(3);
    expect(text).toBe("Shopy Crafter optimiza tu tienda con IA.");
    expect(last).toMatchObject({ done: true });
    expect(last.error).toBeUndefined();
  });

  it("si Gemini corta el stream, el navegador recibe stream_failed (y repite por JSON)", async () => {
    m.geminiStream.mockImplementationOnce(async function* () { yield { text: "Empie" }; yield { error: "boom" }; yield { done: true }; });
    const r = await post("/public/landing-chat/stream", { messages: [{ role: "user", content: "cuéntame los planes que tenéis" }] });
    const { last } = await readSse(r);
    expect(last).toMatchObject({ error: "stream_failed", done: true });
  });
});

describe("chat del cliente (puerta client)", () => {
  it("el cliente A no ve datos de B y su request_team va a SU proyecto aunque el modelo diga otro", async () => {
    m.session = { clientId: "7", role: "client", userId: "u-7", name: "Ana Lunar" };
    m.geminiChat.mockResolvedValueOnce('Se lo paso al equipo.\n:::ACTION:::{"action":"request_team","params":{"projectId":8,"content":"Cambiar el banner de portada"}}:::END_ACTION:::\n:::ACTION:::{"action":"stripe_create_refund","params":{"chargeId":"ch_9"}}:::END_ACTION:::');

    const r = await post("/client/ai-chat", { message: "dile al equipo que cambie el banner de portada", history: [] });
    expect(r.status).toBe(200);
    const body = await r.json();

    const sys = systemPromptOf(m.geminiChat);
    expect(sys).toContain("Cerámica Lunar");
    expect(sys).toContain("Vende cerámica artesanal");
    expect(sys).toContain("Taza Luna");
    expect(sys).toContain("ADN-DE-MARCA-7");
    for (const leak of ["SECRETO-8", "PRODUCTO-SECRETO-8", "Otra Tienda", "SECRETO-GLOBAL", "OMNICORE-GLOBAL", "ADN-DE-MARCA-8", "- stripe_create_refund:"]) {
      expect(sys).not.toContain(leak);
    }

    // El texto «dile al equipo» ya reenvía el mensaje: request_team no se duplica.
    expect(body.forwarded).toBe(true);
    expect(body.reply).toBe("Se lo paso al equipo.");
    const inserted = fakeBrainDb.executes.filter(e => e.sql.includes("INSERT INTO messages"));
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.params).toContain("7");
    expect(inserted[0]!.params).not.toContain("8");

    await vi.waitFor(() => expect(events()[0]).toMatchObject({
      gate: "client", channel: "client-chat", projectId: 7, userId: "u-7",
      droppedActions: [{ action: "stripe_create_refund" }],
    }));
  });

  it("request_team propuesto por el cerebro: se ejecuta en el proyecto de la sesión y se confirma al cliente", async () => {
    m.session = { clientId: "7", role: "client", userId: "u-7", name: "Ana Lunar" };
    m.geminiChat.mockResolvedValueOnce('De acuerdo.\n:::ACTION:::{"action":"request_team","params":{"projectId":8,"content":"Quiere rediseñar la ficha de producto"}}:::END_ACTION:::');

    const r = await post("/client/ai-chat", { message: "quiero rediseñar la ficha de producto, ¿podéis?", history: [], projectMode: false });
    const body = await r.json();
    expect(body.forwarded).toBe(true);
    expect(body.teamRequest).toMatchObject({ ok: true });
    expect(body.reply).toContain("El equipo de Shopy Crafter ha recibido tu petición");
    const inserted = fakeBrainDb.executes.filter(e => e.sql.includes("INSERT INTO messages"));
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.params).toEqual(expect.arrayContaining(["7", "Ana Lunar"]));
    await vi.waitFor(() => expect(events().some(e => e.kind === "execute" && e.status === "ok" && e.projectId === 7)).toBe(true));
  });

  it("streaming del cliente: texto sin bloques de acción, confirmación del equipo y done", async () => {
    m.session = { clientId: "7", role: "client", userId: "u-7", name: "Ana Lunar" };
    m.geminiStream.mockImplementationOnce(streamOf([
      "Tu tienda va bien. ",
      "Paso la petición.\n:::ACTION:::{\"action\":\"request_team\",\"params\":{\"content\":\"Revisar envíos\"}}",
      ":::END_ACTION:::",
    ]));

    const r = await post("/client/ai-chat/stream", { message: "¿cómo va mi tienda? y que revisen los envíos", history: [] });
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const { text, last } = await readSse(r);
    expect(text).not.toContain(":::");
    expect(text).toContain("Tu tienda va bien.");
    expect(text).toContain("El equipo de Shopy Crafter ha recibido tu petición");
    expect(last).toMatchObject({ done: true, teamRequest: { ok: true } });
    expect(systemPromptOf(m.geminiStream)).not.toContain("SECRETO-8");
  });

  it("sin proyecto en la sesión no se pregunta al cerebro", async () => {
    m.session = { role: "client", userId: "u-x" };
    const r = await post("/client/ai-chat/stream", { message: "hola, ¿qué tal va todo?", history: [] });
    expect(r.status).toBe(400);
    expect(m.geminiStream).not.toHaveBeenCalled();
  });
});
