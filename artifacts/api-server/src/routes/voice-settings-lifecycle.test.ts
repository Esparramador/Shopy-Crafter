// Ajustes de voz de Arturo: historial paginado (#144), guardado con versión y
// 409 (#145), informe de aplicación persistido (#150), fallo parcial y
// reintento solo de los fallidos (#151), auditoría/limpieza de agentes
// huérfanos (#88), la voz llega al agente de clientes (#148) y se aplica tras
// un reinicio (#149). Todo con ElevenLabs y Postgres simulados.
import express from "express";
import type { Server } from "node:http";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  signedUrl: vi.fn(),
  verify: vi.fn(),
  execute: vi.fn(),
  rows: new Map<string, { value: string; updatedAt: number }>(),
  history: [] as Array<{ id: number; created_at: string; user_id: string; user_name: string; user_email: string; settings: unknown }>,
  clock: 0,
  sql: [] as string[],
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: mocks.execute,
    transaction: async (work: (tx: { execute: typeof mocks.execute }) => Promise<unknown>) =>
      work({ execute: mocks.execute }),
  },
  projectsTable: {},
  productsTable: {},
}));
vi.mock("../lib/claude.js", () => ({ askClaudeJsonWithBrain: vi.fn(), learnFromOperation: vi.fn() }));
vi.mock("../lib/voice-recommender.js", () => ({ recommendVoiceForProduct: vi.fn() }));
vi.mock("../lib/auth.js", () => ({ requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../lib/elevenlabs.js", () => ({
  updateConvAIAgent: mocks.update,
  getConvAIAgent: mocks.get,
  createConvAIAgent: mocks.create,
  deleteConvAIAgent: mocks.delete,
  listConvAIAgents: mocks.list,
  getConvAISignedUrl: mocks.signedUrl,
}));
vi.mock("../lib/convai-voice-check.js", () => ({
  assertConvAIVoiceUsable: () => ({ warnings: [] }),
  assertConvAIAgentConfigApplied: mocks.verify,
  fetchElevenVoice: async () => ({ name: "Test voice", category: "premade" }),
  fetchElevenSubscription: async () => ({}),
  isConvAIVoiceError: () => false,
}));

const dialect = new PgDialect();
const TTS_KEYS = ["convai_tts_similarity_boost", "convai_tts_speed", "convai_tts_stability"];

function setRow(key: string, value: string) {
  mocks.rows.set(key, { value, updatedAt: ++mocks.clock });
}

/** Postgres en memoria: solo las sentencias que usa voice.ts. */
async function fakeExecute(query: unknown) {
  const { sql, params } = dialect.sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]);
  mocks.sql.push(sql);
  if (sql.includes("md5(") && sql.includes("AS revision")) {
    const keys = params.map(String).sort();
    return { rows: [{ revision: "v:" + keys.filter(k => mocks.rows.has(k)).map(k => `${k}:${mocks.rows.get(k)!.value}:${mocks.rows.get(k)!.updatedAt}`).join("|") }] };
  }
  if (sql.includes("INSERT INTO platform_settings_kv")) {
    setRow(String(params[0]), String(params[1]));
    return { rows: [{ key: params[0] }] };
  }
  if (sql.includes("DELETE FROM platform_settings_kv")) { mocks.rows.delete(String(params[0])); return { rows: [] }; }
  if (sql.includes("INSERT INTO convai_tts_settings_history")) {
    const id = mocks.history.length + 1;
    mocks.history.push({
      id, created_at: new Date(Date.UTC(2026, 10, 1, 0, id)).toISOString(),
      user_id: String(params[0]), user_name: String(params[1]), user_email: String(params[2]), settings: JSON.parse(String(params[3])),
    });
    return { rows: [] };
  }
  if (sql.includes("FROM convai_tts_settings_history")) {
    const sorted = [...mocks.history].sort((a, b) => b.id - a.id);
    const hasCursor = sql.includes("WHERE (created_at, id) <");
    const before = hasCursor ? Number(params[0]) : Infinity;
    const limit = Number(params[params.length - 1]);
    return { rows: sorted.filter(r => r.id < before).slice(0, limit) };
  }
  if (sql.includes("SELECT value FROM platform_settings_kv")) {
    const row = mocks.rows.get(String(params[0]));
    return { rows: row ? [{ value: row.value }] : [] };
  }
  if (sql.includes("SELECT key, value FROM platform_settings_kv") && sql.includes("value IN")) {
    const ids = new Set(params.map(String));
    return { rows: [...mocks.rows].filter(([, r]) => ids.has(r.value)).map(([key, r]) => ({ key, value: r.value })) };
  }
  if (sql.includes("SELECT key, value FROM platform_settings_kv")) {
    const keys = new Set(params.map(String));
    return { rows: [...mocks.rows].filter(([k]) => keys.has(k)).map(([key, r]) => ({ key, value: r.value })) };
  }
  return { rows: [] };
}

let server: Server;
let base: string;

async function startServer() {
  const { default: router } = await import("./voice.js");
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    req.session = { userId: "admin-1", name: "Ana Admin", email: "ana@example.invalid", role: "admin" } as typeof req.session;
    next();
  }, router);
  server = await new Promise<Server>(resolve => { const l = app.listen(0, "127.0.0.1", () => resolve(l)); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server port");
  base = `http://127.0.0.1:${address.port}`;
}

async function stopServer() {
  if (server) await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

/** Simula un reinicio del proceso API: módulo nuevo (cachés vacías), misma BD. */
async function restartServer() {
  await stopServer();
  vi.resetModules();
  await startServer();
}

const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const put = (body: unknown) => ({ ...json(body), method: "PUT" });

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.rows.clear();
  mocks.history.length = 0;
  mocks.sql.length = 0;
  vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", "");
  vi.stubEnv("ELEVEN_CONVAI_VOICE_ID", "test-voice");
  mocks.update.mockResolvedValue({});
  mocks.get.mockResolvedValue({});
  mocks.signedUrl.mockResolvedValue("wss://example.invalid/call");
  mocks.verify.mockImplementation(() => undefined);
  mocks.execute.mockImplementation(fakeExecute);
  await startServer();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await stopServer();
});

describe("#144 historial completo de la voz", () => {
  it("la tarjeta sigue mostrando 5 y el historial pagina hasta el primer cambio", async () => {
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.5, similarityBoost: 0.8, speed: 0.7 + i * 0.04 }));
      expect(r.status).toBe(200);
    }
    const card = await (await fetch(`${base}/voice/convai/voice-settings`)).json();
    expect(card.history).toHaveLength(5);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const r = await fetch(`${base}/voice/convai/voice-settings/history?limit=5${cursor ? `&before=${cursor}` : ""}`);
      expect(r.status).toBe(200);
      const page = await r.json();
      seen.push(...page.entries.map((e: { id: string }) => e.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => String(12 - i)));
    // La entrada más antigua se puede restaurar con el PUT validado normal.
    const oldest = mocks.history[0].settings as Record<string, number>;
    const restore = await fetch(`${base}/voice/convai/voice-settings`, put(oldest));
    expect(restore.status).toBe(200);
    expect((await restore.json()).settings).toEqual(oldest);
  });

  it.each(["limit=0", "limit=51", "limit=abc", "before=x1"])("rechaza parámetros inválidos (%s)", async q => {
    expect((await fetch(`${base}/voice/convai/voice-settings/history?${q}`)).status).toBe(400);
  });
});

describe("#145 dos admins no se pisan", () => {
  it("devuelve 409 sin guardar si la versión cambió y permite confirmar sobre la nueva", async () => {
    const loaded = await (await fetch(`${base}/voice/convai/voice-settings`)).json();
    expect(typeof loaded.version).toBe("string");

    // Admin B guarda primero con la versión que cargó.
    const b = await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.3, similarityBoost: 0.8, speed: 1, expectedVersion: loaded.version }));
    expect(b.status).toBe(200);
    const historyAfterB = mocks.history.length;

    // Admin A guarda con la versión antigua: conflicto, nada guardado.
    const a = await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.9, similarityBoost: 0.8, speed: 1, expectedVersion: loaded.version }));
    expect(a.status).toBe(409);
    const conflict = await a.json();
    expect(conflict.code).toBe("voice_settings_conflict");
    expect(conflict.current.settings).toMatchObject({ stability: 0.3 });
    expect(conflict.current.lastChange).toMatchObject({ userName: "Ana Admin" });
    expect(mocks.history.length).toBe(historyAfterB);
    expect(mocks.rows.get("convai_tts_stability")?.value).toBe("0.3");

    // A confirma su ajuste sobre la versión nueva: se guarda y queda en el historial.
    const confirm = await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.9, similarityBoost: 0.8, speed: 1, expectedVersion: conflict.current.version }));
    expect(confirm.status).toBe(200);
    expect(mocks.history.length).toBe(historyAfterB + 1);
  });

  it("acepta la versión por If-Match y mantiene compatibilidad sin versión", async () => {
    const loaded = await (await fetch(`${base}/voice/convai/voice-settings`)).json();
    const withHeader = await fetch(`${base}/voice/convai/voice-settings`, {
      method: "PUT", headers: { "content-type": "application/json", "if-match": `"${loaded.version}"` },
      body: JSON.stringify({ stability: 0.4, similarityBoost: 0.8, speed: 1 }),
    });
    expect(withHeader.status).toBe(200);
    expect((await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.45, similarityBoost: 0.8, speed: 1 }))).status).toBe(200);
  });
});

describe("#150/#151 fallo parcial al aplicar, informe persistido y reintento", () => {
  beforeEach(() => {
    setRow("convai_admin_agent_id", "agent-admin");
    setRow("convai_client_agent_id", "agent-client");
    setRow("convai_landing_agent_id", "agent-landing");
  });

  it("muestra el fallo de un agente, lo recupera tras reabrir y reintenta solo ese sin guardar ni recrear", async () => {
    await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.35, similarityBoost: 0.7, speed: 1 }));
    mocks.update.mockImplementation(async (id: string) => {
      if (id === "agent-client") throw new Error("ElevenLabs ConvAI update 500: boom");
      return {};
    });

    const first = await fetch(`${base}/voice/convai/voice-settings/apply`, { method: "POST" });
    expect(first.status).toBe(502);
    const body = await first.json();
    expect(body.agents).toMatchObject({
      admin: { status: "applied", agentId: "agent-admin" },
      client: { status: "error", agentId: "agent-client" },
      landing: { status: "applied", agentId: "agent-landing" },
    });

    // Reabrir el panel (y hasta reiniciar el proceso): el informe sigue ahí.
    await restartServer();
    const reopened = await (await fetch(`${base}/voice/convai/voice-settings`)).json();
    expect(reopened.lastApply.agents).toMatchObject({
      admin: { status: "applied" }, client: { status: "error" }, landing: { status: "applied" },
    });

    // Reintento solo del fallido.
    mocks.update.mockReset().mockResolvedValue({});
    mocks.create.mockClear();
    const historyBefore = mocks.history.length;
    const ttsWritesBefore = mocks.sql.filter(s => s.includes("INSERT INTO platform_settings_kv")).length;
    const retry = await fetch(`${base}/voice/convai/voice-settings/apply`, json({ agentTypes: ["client"] }));
    expect(retry.status).toBe(200);
    expect(Object.keys((await retry.json()).agents)).toEqual(["client"]);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toBe("agent-client");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.history.length).toBe(historyBefore);
    // La única escritura en platform_settings_kv es el informe, no los ajustes.
    const writes = mocks.sql.filter(s => s.includes("INSERT INTO platform_settings_kv")).length - ttsWritesBefore;
    expect(writes).toBe(1);
    for (const key of TTS_KEYS) expect(mocks.rows.get(key)).toBeDefined();

    const merged = await (await fetch(`${base}/voice/convai/voice-settings`)).json();
    expect(merged.lastApply.agents).toMatchObject({
      admin: { status: "applied" }, client: { status: "applied" }, landing: { status: "applied" },
    });
  });

  it("un guardado nuevo deja de mostrar el informe de la versión anterior", async () => {
    await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.35, similarityBoost: 0.7, speed: 1 }));
    expect((await fetch(`${base}/voice/convai/voice-settings/apply`, { method: "POST" })).status).toBe(200);
    expect((await (await fetch(`${base}/voice/convai/voice-settings`)).json()).lastApply).not.toBeNull();
    await fetch(`${base}/voice/convai/voice-settings`, put({ stability: 0.4, similarityBoost: 0.7, speed: 1 }));
    expect((await (await fetch(`${base}/voice/convai/voice-settings`)).json()).lastApply).toBeNull();
  });
});

describe("#88 agentes ConvAI huérfanos y duplicados", () => {
  beforeEach(() => {
    setRow("convai_admin_agent_id", "agent-admin");
    setRow("convai_landing_agent_id", "agent-landing");
    mocks.list.mockResolvedValue([
      { agent_id: "agent-admin", name: "Arturo — Secretario del CEO de Shopy Crafter" },
      { agent_id: "agent-landing", name: "Arturo — Secretario de Shopy Crafter" },
      { agent_id: "old-1", name: "Arturo — Secretario de Shopy Crafter" },
      { agent_id: "old-2", name: "ShopyBrain — Asistente Admin" },
      { agent_id: "custom-1", name: "Asistente Tienda Zara" },
    ]);
    mocks.delete.mockResolvedValue({});
  });

  it("la vista previa marca en uso, huérfanos y personalizados", async () => {
    const r = await fetch(`${base}/voice/convai/orphans`);
    expect(r.status).toBe(200);
    const audit = await r.json();
    const status = Object.fromEntries(audit.agents.map((a: { agentId: string; status: string }) => [a.agentId, a.status]));
    expect(status).toEqual({ "agent-admin": "in_use", "agent-landing": "in_use", "old-1": "orphan", "old-2": "orphan", "custom-1": "custom" });
    expect(audit.orphanIds).toEqual(["old-1", "old-2"]);
    expect(audit.duplicateNames).toEqual([{ name: "Arturo — Secretario de Shopy Crafter", count: 2 }]);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("exige confirmación explícita", async () => {
    expect((await fetch(`${base}/voice/convai/orphans/delete`, json({ agentIds: ["old-1"] }))).status).toBe(400);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("borra solo huérfanos confirmados", async () => {
    const r = await fetch(`${base}/voice/convai/orphans/delete`, json({ agentIds: ["old-1", "old-2"], confirm: true }));
    expect(r.status).toBe(200);
    expect(mocks.delete.mock.calls.map(c => c[0])).toEqual(["old-1", "old-2"]);
  });

  it.each([["agent-landing", "referenced"], ["custom-1", "custom"], ["ghost", "not_found"]])(
    "si la selección incluye %s (%s) no borra NADA",
    async (id, reason) => {
      const r = await fetch(`${base}/voice/convai/orphans/delete`, json({ agentIds: ["old-1", id], confirm: true }));
      expect(r.status).toBe(409);
      expect((await r.json()).refused).toEqual([expect.objectContaining({ agentId: id, reason })]);
      expect(mocks.delete).not.toHaveBeenCalled();
    },
  );

  it("nunca borra el agente fijado por ELEVEN_CONVAI_DEFAULT_AGENT_ID ni uno referenciado por otra clave", async () => {
    vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", "old-1");
    setRow("some_other_feature_agent", "old-2");
    const audit = await (await fetch(`${base}/voice/convai/orphans`)).json();
    expect(audit.orphanIds).toEqual([]);
    expect((await fetch(`${base}/voice/convai/orphans/delete`, json({ agentIds: ["old-1"], confirm: true }))).status).toBe(409);
    expect((await fetch(`${base}/voice/convai/orphans/delete`, json({ agentIds: ["old-2"], confirm: true }))).status).toBe(409);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe("#148/#149 la voz guardada llega a los agentes", () => {
  const saved = { stability: 0.35, similarityBoost: 0.65, speed: 0.9 };

  function expectTts(config: any) {
    expect(config.conversation_config.tts).toMatchObject({
      stability: saved.stability, similarity_boost: saved.similarityBoost, speed: saved.speed,
    });
  }

  it("#148 tras guardar, la URL de llamada de cliente sincroniza el agente client con los valores nuevos", async () => {
    setRow("convai_client_agent_id", "agent-client");
    expect((await fetch(`${base}/voice/convai/voice-settings`, put(saved))).status).toBe(200);
    const r = await fetch(`${base}/voice/client-call-url`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ agentId: "agent-client", mode: "client" });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toBe("agent-client");
    expectTts(mocks.update.mock.calls[0][1]);
    // El verificador compara lo leído de ElevenLabs con estos mismos valores.
    expect(mocks.verify.mock.calls[0][1]).toMatchObject(saved);
    expect(mocks.signedUrl).toHaveBeenCalledExactlyOnceWith("agent-client");
  });

  it("#149 tras reiniciar el proceso, la primera llamada aplica los valores de la BD al agente fijado", async () => {
    vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", "pinned-admin");
    expect((await fetch(`${base}/voice/convai/voice-settings`, put(saved))).status).toBe(200);
    await restartServer();
    mocks.update.mockClear();
    const r = await fetch(`${base}/voice/convai/call-url`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ agentId: "pinned-admin" });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toBe("pinned-admin");
    expectTts(mocks.update.mock.calls[0][1]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.signedUrl).toHaveBeenCalledExactlyOnceWith("pinned-admin");
  });
});
