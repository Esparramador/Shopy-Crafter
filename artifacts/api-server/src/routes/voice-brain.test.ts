// La voz pasa por ShopyBrain: el botón de voz usa brainRoute (canal voice-button)
// y Arturo (ElevenLabs ConvAI) consulta al cerebro con la herramienta de servidor
// «consultar_shopybrain». La puerta la decide el agente que llama (ruta + cabecera
// secreta propia + brain_token firmado), nunca el texto. ElevenLabs, el cerebro y
// Postgres simulados: aquí no se llama a nada real.
import express from "express";
import type { Server } from "node:http";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  signedUrl: vi.fn(),
  execute: vi.fn(),
  brainRoute: vi.fn(),
  brainExecute: vi.fn(),
  recordBrainEvent: vi.fn(async () => 1),
  rows: new Map<string, string>(),
  elevenCalls: [] as Array<{ method: string; url: string; body: any }>,
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: mocks.execute,
    transaction: async (work: (tx: { execute: typeof mocks.execute }) => Promise<unknown>) => work({ execute: mocks.execute }),
  },
  projectsTable: {},
  productsTable: {},
}));
vi.mock("../lib/brain/router.js", () => ({ brainRoute: mocks.brainRoute }));
vi.mock("../lib/brain/execute.js", () => ({ brainExecute: mocks.brainExecute }));
vi.mock("../lib/brain/events.js", () => ({ recordBrainEvent: mocks.recordBrainEvent }));
vi.mock("../lib/voice-recommender.js", () => ({ recommendVoiceForProduct: vi.fn() }));
vi.mock("../lib/auth.js", () => ({ requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../lib/elevenlabs.js", () => ({
  updateConvAIAgent: mocks.update,
  getConvAIAgent: mocks.get,
  createConvAIAgent: mocks.create,
  deleteConvAIAgent: vi.fn(),
  listConvAIAgents: vi.fn(async () => []),
  getConvAISignedUrl: mocks.signedUrl,
}));
vi.mock("../lib/convai-voice-check.js", () => ({
  assertConvAIVoiceUsable: () => ({ warnings: [] }),
  assertConvAIAgentConfigApplied: () => undefined,
  fetchElevenVoice: async () => ({ name: "Test voice", category: "premade" }),
  fetchElevenSubscription: async () => ({}),
  isConvAIVoiceError: () => false,
}));

const dialect = new PgDialect();
async function fakeExecute(query: unknown) {
  const { sql, params } = dialect.sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]);
  if (sql.includes("md5(") && sql.includes("AS revision")) return { rows: [{ revision: "v1" }] };
  if (sql.includes("INSERT INTO platform_settings_kv")) { mocks.rows.set(String(params[0]), String(params[1])); return { rows: [] }; }
  if (sql.includes("SELECT value FROM platform_settings_kv")) {
    const v = mocks.rows.get(String(params[0]));
    return { rows: v ? [{ value: v }] : [] };
  }
  return { rows: [] };
}

const SECRET = "s".repeat(40);
const realFetch = globalThis.fetch;
let server: Server;
let base: string;
let tool: typeof import("../lib/convai-brain-tool.js");

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.rows.clear();
  mocks.elevenCalls.length = 0;
  vi.stubEnv("ELEVEN_BRAIN_TOOL_SECRET", SECRET);
  vi.stubEnv("APP_URL", "https://panel.example.invalid");
  vi.stubEnv("ELEVENLABS_API_KEY", "test-key-1234567890");
  vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", "");
  vi.stubEnv("ELEVEN_CONVAI_VOICE_ID", "test-voice");
  mocks.execute.mockImplementation(fakeExecute);
  mocks.update.mockResolvedValue({});
  mocks.get.mockResolvedValue({});
  mocks.signedUrl.mockResolvedValue("wss://example.invalid/call");
  mocks.brainExecute.mockResolvedValue({ kind: "result", status: 200, body: { success: true, message: "Hecho" } });
  // ElevenLabs /convai/tools simulado; el resto de fetch (el servidor de prueba) es real.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://api.elevenlabs.io/")) {
      mocks.elevenCalls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(init.body) : null });
      return new Response(JSON.stringify({ id: "tool_abc" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return realFetch(input, init);
  });

  const { default: router } = await import("./voice.js");
  tool = await import("../lib/convai-brain-tool.js");
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    req.session = { userId: "admin-1", role: "admin" } as typeof req.session;
    next();
  }, router);
  server = await new Promise<Server>(resolve => { const l = app.listen(0, "127.0.0.1", () => resolve(l)); });
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("sin puerto");
  base = `http://127.0.0.1:${a.port}`;
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await new Promise<void>(r => { server.close(() => r()); server.closeAllConnections(); });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  realFetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

const routed = (text: string, actions: Array<{ action: string; params?: Record<string, unknown> }> = []) => ({
  kind: actions.length ? "action" : "answer", text, actions, dropped: [], engine: "claude", engineMode: "claude",
  model: null, usage: null, entityKnowledgeUsed: false, potentialEntity: null, durationMs: 5,
});

describe("botón de voz → ShopyBrain", () => {
  it("/voice/command usa brainRoute (admin, voice-button, motor rápido) y devuelve navigate como acción del navegador", async () => {
    mocks.brainRoute.mockResolvedValueOnce(routed("**Vale**, te llevo a la auditoría.", [
      { action: "navigate", params: { path: "/projects/7/audit" } },
      { action: "navigate", params: { path: "//evil.example/x" } },
      { action: "store_status", params: { projectId: 7 } },
      { action: "accion_inventada", params: {} },
    ]));
    const r = await post("/voice/command", { transcript: "llévame a la auditoría", currentPage: "/projects/7", projectId: "7" });
    expect(r.status).toBe(200);
    const body = await r.json();

    expect(mocks.brainRoute).toHaveBeenCalledTimes(1);
    const arg = mocks.brainRoute.mock.calls[0]![0];
    expect(arg).toMatchObject({ gate: "admin", channel: "voice-button", projectId: 7, currentRoute: "/projects/7", engineMode: "claude", models: { claude: "claude-haiku-4-5" } });
    expect(arg.systemPrompt).toContain("navigate");

    expect(body.response).toBe("Vale, te llevo a la auditoría.");
    expect(body.action).toEqual({ type: "navigate", params: { path: "/projects/7/audit" } });
    expect(body.actions).toEqual([
      { type: "navigate", params: { path: "/projects/7/audit" }, executable: false },
      { type: "store_status", params: { projectId: 7 }, executable: true },
    ]);
    expect(body.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("/voice/command/execute ejecuta con brainExecute en el canal voice-button", async () => {
    const r = await post("/voice/command/execute", { action: "store_status", params: { projectId: 7 } });
    expect(r.status).toBe(200);
    expect(mocks.brainExecute).toHaveBeenCalledWith(expect.objectContaining({ action: "store_status", gate: "admin", channel: "voice-button", userId: "admin-1" }));
  });

  it("sin transcript → 400 y no llama al cerebro", async () => {
    expect((await post("/voice/command", { transcript: "  " })).status).toBe(400);
    expect(mocks.brainRoute).not.toHaveBeenCalled();
  });
});

describe("Arturo → consultar_shopybrain (webhook)", () => {
  it("sin cabecera secreta → 401; con la cabecera de landing en la ruta admin → 401", async () => {
    expect((await post("/voice/convai/brain-tool/admin", { peticion: "ventas de hoy" })).status).toBe(401);
    const landingHeader = tool.brainToolHeaderValue("landing")!;
    expect((await post("/voice/convai/brain-tool/admin", { peticion: "ventas de hoy" }, { "X-ShopyBrain-Secret": landingHeader })).status).toBe(401);
    expect(mocks.brainRoute).not.toHaveBeenCalled();
  });

  it("sin ELEVEN_BRAIN_TOOL_SECRET la herramienta está apagada (503)", async () => {
    vi.stubEnv("ELEVEN_BRAIN_TOOL_SECRET", "");
    expect((await post("/voice/convai/brain-tool/landing", { peticion: "hola" }, { "X-ShopyBrain-Secret": "x" })).status).toBe(503);
  });

  it("agente landing pidiendo «borra un producto» → puerta public y no se ejecuta nada", async () => {
    // Aunque el cerebro propusiera la acción, el webhook no la ejecuta.
    mocks.brainRoute.mockResolvedValueOnce(routed("Eso no lo puedo hacer.", [{ action: "delete_product", params: { productId: "1" } }]));
    const r = await post("/voice/convai/brain-tool/landing", { peticion: "borra un producto de mi tienda", conversation_id: "conv_1" },
      { "X-ShopyBrain-Secret": tool.brainToolHeaderValue("landing")! });
    expect(r.status).toBe(200);
    expect((await r.json()).respuesta).toContain("Eso no lo puedo hacer.");
    expect(mocks.brainRoute).toHaveBeenCalledWith(expect.objectContaining({ gate: "public", channel: "voice-convai-landing", projectId: null }));
    expect(mocks.brainExecute).not.toHaveBeenCalled();
  });

  it("agente landing: create_lead sí se ejecuta, con límite por conversación", async () => {
    mocks.brainRoute.mockResolvedValueOnce(routed("Te paso con el equipo.", [{ action: "create_lead", params: { name: "Ana", email: "ana@example.invalid" } }]));
    await post("/voice/convai/brain-tool/landing", { peticion: "que me llamen, soy Ana, ana@example.invalid", conversation_id: "conv_9" },
      { "X-ShopyBrain-Secret": tool.brainToolHeaderValue("landing")! });
    expect(mocks.brainExecute).toHaveBeenCalledWith(expect.objectContaining({ action: "create_lead", gate: "public", channel: "voice-convai-landing", ip: "convai:conv_9" }));
  });

  it("agente cliente: solo su proyecto (el del token), aunque el cuerpo diga otro", async () => {
    mocks.brainRoute.mockResolvedValueOnce(routed("Se lo paso al equipo.", [{ action: "request_team", params: { content: "Cambiar banner", projectId: "9" } }]));
    const token = tool.signBrainToken({ kind: "client", projectId: 7, userId: "cli-7" })!;
    const r = await post("/voice/convai/brain-tool/client", { peticion: "en el proyecto 9 cambia el banner", projectId: 9, brain_token: token },
      { "X-ShopyBrain-Secret": tool.brainToolHeaderValue("client")! });
    expect(r.status).toBe(200);
    expect(mocks.brainRoute).toHaveBeenCalledWith(expect.objectContaining({ gate: "client", channel: "voice-convai-client", projectId: 7, userId: "cli-7" }));
    expect(mocks.brainExecute).toHaveBeenCalledWith(expect.objectContaining({ action: "request_team", gate: "client", projectId: 7 }));
  });

  it("agente cliente: token manipulado, de otro agente o ausente → 403 sin consultar", async () => {
    const header = { "X-ShopyBrain-Secret": tool.brainToolHeaderValue("client")! };
    const good = tool.signBrainToken({ kind: "client", projectId: 7 })!;
    const [, sig] = good.split(".");
    const forged = `${Buffer.from(JSON.stringify({ k: "client", p: 9, e: Date.now() + 60_000 })).toString("base64url")}.${sig}`;
    const adminTok = tool.signBrainToken({ kind: "admin", userId: "admin-1" })!;
    for (const brain_token of [forged, adminTok, undefined, ""]) {
      const r = await post("/voice/convai/brain-tool/client", { peticion: "ventas", brain_token }, header);
      expect(r.status).toBe(403);
    }
    expect(mocks.brainRoute).not.toHaveBeenCalled();
    expect(mocks.recordBrainEvent).toHaveBeenCalledWith(expect.objectContaining({ gate: "client", channel: "voice-convai-client", status: "denied" }));
  });

  it("agente admin: lo destructivo no se ejecuta por voz (se confirma en el panel); lo demás sí", async () => {
    mocks.brainRoute.mockResolvedValueOnce(routed("Vale.", [
      { action: "delete_product", params: { productId: "5", projectId: 7 } },
      { action: "store_status", params: { projectId: 7 } },
    ]));
    const token = tool.signBrainToken({ kind: "admin", userId: "admin-1" })!;
    const r = await post("/voice/convai/brain-tool/admin", { peticion: "borra el producto 5 y dime cómo va la tienda", brain_token: token },
      { "X-ShopyBrain-Secret": tool.brainToolHeaderValue("admin")! });
    const body = await r.json();
    expect(body.respuesta).toMatch(/confírmalo en el panel/);
    expect(mocks.brainRoute).toHaveBeenCalledWith(expect.objectContaining({ gate: "admin", channel: "voice-convai-admin", engineMode: "claude" }));
    expect(mocks.brainExecute).toHaveBeenCalledTimes(1);
    expect(mocks.brainExecute).toHaveBeenCalledWith(expect.objectContaining({ action: "store_status", gate: "admin", channel: "voice-convai-admin" }));
    expect(mocks.brainExecute.mock.calls[0]![0].req).toBeUndefined();
    expect(mocks.recordBrainEvent).toHaveBeenCalledWith(expect.objectContaining({ channel: "voice-convai-admin", status: "needs_confirmation", input: "delete_product" }));
  });
});

describe("la herramienta va en la sincronización de los agentes (PATCH, sin recrear)", () => {
  it("call-url sincroniza el agente admin con tool_ids y la línea del prompt, y entrega brain_token", async () => {
    mocks.rows.set("convai_admin_agent_id", "agent_admin_1");
    const r = await realFetch(`${base}/voice/convai/call-url`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(tool.verifyBrainToken(body.dynamic_variables.brain_token, "admin")).toMatchObject({ k: "admin", u: "admin-1" });

    // Herramienta creada en ElevenLabs con la URL pública y la cabecera del tipo.
    const created = mocks.elevenCalls.find(c => c.method === "POST" && c.url.endsWith("/v1/convai/tools"));
    expect(created?.body.tool_config).toMatchObject({
      type: "webhook", name: "consultar_shopybrain",
      api_schema: {
        url: "https://panel.example.invalid/api/voice/convai/brain-tool/admin", method: "POST",
        request_headers: { "X-ShopyBrain-Secret": tool.brainToolHeaderValue("admin") },
        request_body_schema: { required: ["peticion"] },
      },
    });
    expect(created?.body.tool_config.api_schema.request_body_schema.properties.brain_token).toEqual({ type: "string", dynamic_variable: "brain_token" });
    expect(mocks.rows.get("convai_admin_brain_tool_id")).toBe("tool_abc");

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith("agent_admin_1", expect.anything());
    const agent = mocks.update.mock.calls[0]![1].conversation_config.agent;
    expect(agent.prompt.tool_ids).toEqual(["tool_abc"]);
    expect(agent.prompt.prompt).toContain("Herramienta consultar_shopybrain");
    expect(agent.dynamic_variables.dynamic_variable_placeholders).toEqual({ brain_token: "" });
  });

  it("el agente landing no lleva brain_token; sin secreto, el agente se sincroniza sin herramienta", async () => {
    const cfg = tool.brainToolConfig("landing", "https://x.invalid", "h") as any;
    expect(cfg.api_schema.request_body_schema.properties.brain_token).toBeUndefined();

    vi.stubEnv("ELEVEN_BRAIN_TOOL_SECRET", "");
    mocks.rows.set("convai_landing_agent_id", "agent_landing_1");
    const r = await realFetch(`${base}/voice/public-call-url`);
    expect(r.status).toBe(200);
    const agent = mocks.update.mock.calls[0]![1].conversation_config.agent;
    expect(agent.prompt.tool_ids).toBeUndefined();
    expect(agent.prompt.prompt).not.toContain("consultar_shopybrain");
    expect(mocks.elevenCalls).toHaveLength(0);
  });
});
