import express from "express";
import type { Server } from "node:http";
import { EventEmitter, once } from "node:events";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  signedUrl: vi.fn(),
  verify: vi.fn(),
  execute: vi.fn(),
  rows: new Map<string, string>(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: mocks.execute,
    transaction: async (work: (tx: { execute: typeof mocks.execute }) => Promise<void>) =>
      work({ execute: mocks.execute }),
  },
  projectsTable: {},
  productsTable: {},
}));
vi.mock("../lib/claude.js", () => ({
  askClaudeJsonWithBrain: vi.fn(), learnFromOperation: vi.fn(),
}));
vi.mock("../lib/voice-recommender.js", () => ({ recommendVoiceForProduct: vi.fn() }));
vi.mock("../lib/auth.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../lib/elevenlabs.js", () => ({
  updateConvAIAgent: mocks.update,
  getConvAIAgent: mocks.get,
  createConvAIAgent: mocks.create,
  deleteConvAIAgent: mocks.delete,
  getConvAISignedUrl: mocks.signedUrl,
}));
vi.mock("../lib/convai-voice-check.js", () => ({
  assertConvAIVoiceUsable: () => ({ warnings: [] }),
  assertConvAIAgentConfigApplied: mocks.verify,
  fetchElevenVoice: async () => ({ name: "Test voice", category: "premade" }),
  fetchElevenSubscription: async () => ({}),
  isConvAIVoiceError: () => false,
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe("ConvAI call/apply single-flight with an environment-pinned admin", () => {
  let server: Server;
  let base: string;
  let requests: EventEmitter;
  const pinnedId = "test-pinned-admin";

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.rows.clear();
    vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", pinnedId);
    vi.stubEnv("ELEVEN_CONVAI_VOICE_ID", "test-voice");
    mocks.update.mockResolvedValue({});
    mocks.get.mockResolvedValue({});
    mocks.signedUrl.mockResolvedValue("wss://example.invalid/test-call");
    mocks.verify.mockImplementation(() => undefined);
    mocks.execute.mockImplementation(async query => {
      const { sql, params } = new PgDialect().sqlToQuery(query);
      if (sql.includes("INSERT INTO platform_settings_kv")) {
        mocks.rows.set(String(params[0]), String(params[1]));
      } else if (sql.includes("DELETE FROM platform_settings_kv")) {
        mocks.rows.delete(String(params[0]));
      }
      // Versión compartida de los ajustes (voice.ts: getConvAIDatabaseRevision): cambia al guardar.
      if (sql.includes("md5(") && sql.includes("AS revision")) {
        const keys = params.map(String);
        const revision = keys.filter(k => mocks.rows.has(k)).sort().map(k => `${k}:${mocks.rows.get(k)}`).join("|");
        return { rows: [{ revision }] };
      }
      if (sql.includes("SELECT value FROM platform_settings_kv")) {
        const value = mocks.rows.get(String(params[0]));
        return { rows: value ? [{ value }] : [] };
      }
      return {
        rows: sql.includes("SELECT key, value FROM platform_settings_kv")
          ? Array.from(mocks.rows, ([key, value]) => ({ key, value }))
          : [],
      };
    });
    const { default: router } = await import("./voice.js");
    const app = express();
    requests = new EventEmitter();
    app.use(express.json(), (req, _res, next) => {
      req.session = { userId: "test-admin", name: "Test admin", email: "" } as typeof req.session;
      next();
      requests.emit(`${req.method} ${req.path}`);
    }, router);
    server = await new Promise<Server>(resolve => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server port");
    base = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });

  function call() {
    return fetch(`${base}/voice/convai/call-url`);
  }
  function apply() {
    return fetch(`${base}/voice/convai/voice-settings/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentTypes: ["admin"] }),
    });
  }

  it.each(["call", "apply"] as const)(
    "a concurrent %s waits while reset verifies the env-pinned admin without deleting or recreating it",
    async competitor => {
      const verification = deferred();
      const verificationStarted = deferred();
      mocks.create.mockImplementation(async ({ name }: { name: string }) => ({
        agent_id: `created-${name.includes("CEO") ? "admin" : "agent"}`,
      }));
      mocks.delete.mockResolvedValue({});
      mocks.get.mockImplementationOnce(async () => {
        verificationStarted.resolve();
        await verification.promise;
        return {};
      });

      const resetting = fetch(`${base}/voice/convai/reset-agents`, { method: "POST" });
      await verificationStarted.promise;
      const arrived = once(
        requests,
        competitor === "call" ? "GET /voice/convai/call-url" : "POST /voice/convai/voice-settings/apply",
      );
      const competing = competitor === "call" ? call() : apply();
      let competitorSettled = false;
      void competing.then(() => { competitorSettled = true; });
      await arrived;

      expect(competitorSettled).toBe(false);
      expect(mocks.signedUrl).not.toHaveBeenCalled();
      expect(mocks.delete).not.toHaveBeenCalledWith(pinnedId);
      expect(mocks.create.mock.calls.some(([config]) => config?.name?.includes("CEO"))).toBe(false);

      verification.resolve();
      const [resetResponse, competitorResponse] = await Promise.all([resetting, competing]);
      expect(resetResponse.status).toBe(200);
      expect(competitorResponse.status).toBe(200);
      if (competitor === "call") {
        expect(mocks.verify).toHaveBeenCalled();
        expect(mocks.signedUrl).toHaveBeenCalledExactlyOnceWith(pinnedId);
      } else {
        expect(mocks.signedUrl).not.toHaveBeenCalled();
      }
      expect(mocks.delete).not.toHaveBeenCalledWith(pinnedId);
      expect(mocks.create.mock.calls.some(([config]) => config?.name?.includes("CEO"))).toBe(false);
    },
  );

  it.each(["call", "apply"] as const)(
    "a concurrent %s waits for reset to recreate and verify an unpinned admin",
    async competitor => {
      vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", "");
      const oldId = "deleted-admin-agent";
      const newId = "verified-new-admin";
      mocks.rows.set("convai_admin_agent_id", oldId);
      mocks.create.mockImplementation(async () => ({ agent_id: newId }));
      mocks.delete.mockResolvedValue({});
      const verification = deferred();
      const verificationStarted = deferred();
      mocks.get.mockImplementationOnce(async () => {
        verificationStarted.resolve();
        await verification.promise;
        return {};
      });

      const resetting = fetch(`${base}/voice/convai/reset-agents`, { method: "POST" });
      await verificationStarted.promise;
      const arrived = once(
        requests,
        competitor === "call" ? "GET /voice/convai/call-url" : "POST /voice/convai/voice-settings/apply",
      );
      const competing = competitor === "call" ? call() : apply();
      let competitorSettled = false;
      void competing.then(() => { competitorSettled = true; });
      await arrived;

      expect(competitorSettled).toBe(false);
      expect(mocks.delete).toHaveBeenCalledWith(oldId);
      expect(mocks.signedUrl).not.toHaveBeenCalled();
      expect(mocks.signedUrl).not.toHaveBeenCalledWith(oldId);

      verification.resolve();
      const [resetResponse, competitorResponse] = await Promise.all([resetting, competing]);
      expect(resetResponse.status).toBe(200);
      expect(competitorResponse.status).toBe(200);
      if (competitor === "call") {
        expect(mocks.verify).toHaveBeenCalled();
        expect(mocks.signedUrl).toHaveBeenCalledExactlyOnceWith(newId);
      } else {
        expect(mocks.signedUrl).not.toHaveBeenCalled();
      }
      expect(mocks.signedUrl).not.toHaveBeenCalledWith(oldId);
      expect(mocks.delete).toHaveBeenCalledWith(oldId);
    },
  );

  it.each(["pinned", "recreated"] as const)(
    "never returns a call URL when reset verification fails for a %s admin",
    async mode => {
      const oldId = "deleted-admin-agent";
      if (mode === "recreated") {
        vi.stubEnv("ELEVEN_CONVAI_DEFAULT_AGENT_ID", "");
        mocks.rows.set("convai_admin_agent_id", oldId);
        mocks.create.mockResolvedValue({ agent_id: "unverified-new-admin" });
        mocks.delete.mockResolvedValue({});
      }
      const verification = deferred();
      const verificationStarted = deferred();
      mocks.get.mockImplementationOnce(async () => {
        verificationStarted.resolve();
        await verification.promise;
        return {};
      });
      mocks.verify.mockImplementationOnce(() => { throw new Error("verification failed"); });

      const resetting = fetch(`${base}/voice/convai/reset-agents`, { method: "POST" });
      await verificationStarted.promise;
      const callArrived = once(requests, "GET /voice/convai/call-url");
      const calling = call();
      await callArrived;
      expect(mocks.signedUrl).not.toHaveBeenCalled();

      verification.resolve();
      const [resetResponse, callResponse] = await Promise.all([resetting, calling]);
      expect(resetResponse.status).toBe(500);
      expect(callResponse.status).not.toBe(200);
      expect(mocks.signedUrl).not.toHaveBeenCalled();
      expect(mocks.verify).toHaveBeenCalled();
      if (mode === "recreated") expect(mocks.delete).toHaveBeenCalledWith(oldId);
      else {
        expect(mocks.delete).not.toHaveBeenCalledWith(pinnedId);
        expect(mocks.create).not.toHaveBeenCalled();
      }
    },
  );

  it("apply joins the call's pending PATCH and verification without creating another agent", async () => {
    const patch = deferred();
    const entered = deferred();
    mocks.update.mockImplementationOnce(() => {
      entered.resolve();
      return patch.promise;
    });
    const calling = call();
    await entered.promise;
    const applyArrived = once(requests, "POST /voice/convai/voice-settings/apply");
    const applying = apply();
    await applyArrived;
    expect(mocks.signedUrl).not.toHaveBeenCalled();
    patch.resolve();
    const [callResponse, applyResponse] = await Promise.all([calling, applying]);
    expect(callResponse.status).toBe(200);
    expect(applyResponse.status).toBe(200);
    expect(await callResponse.json()).toMatchObject({ agentId: pinnedId });
    expect(await applyResponse.json()).toMatchObject({
      success: true, agents: { admin: { agentId: pinnedId, sharedFlight: true } },
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("a warm cached call waits for apply's verification before requesting a signed URL", async () => {
    expect((await call()).status).toBe(200);
    mocks.signedUrl.mockClear();
    mocks.update.mockClear();
    mocks.get.mockClear();
    mocks.verify.mockClear();
    const verification = deferred();
    const entered = deferred();
    mocks.get.mockImplementationOnce(async () => {
      entered.resolve();
      await verification.promise;
      return {};
    });
    const applying = apply();
    await entered.promise;
    const callArrived = once(requests, "GET /voice/convai/call-url");
    const calling = call();
    await callArrived;
    expect(mocks.signedUrl).not.toHaveBeenCalled();
    verification.resolve();
    const [applyResponse, callResponse] = await Promise.all([applying, calling]);
    expect(applyResponse.status).toBe(200);
    expect(callResponse.status).toBe(200);
    expect(await callResponse.json()).toMatchObject({ agentId: pinnedId });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.signedUrl).toHaveBeenCalledExactlyOnceWith(pinnedId);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not accept stale verification and retries apply against the same pinned agent", async () => {
    const patch = deferred();
    const entered = deferred();
    mocks.update.mockImplementationOnce(() => {
      entered.resolve();
      return patch.promise;
    });
    mocks.verify.mockImplementationOnce(() => { throw new Error("stale settings"); });
    const calling = call();
    await entered.promise;
    const applyArrived = once(requests, "POST /voice/convai/voice-settings/apply");
    const applying = apply();
    await applyArrived;
    patch.resolve();
    const [callResponse, applyResponse] = await Promise.all([calling, applying]);
    expect(callResponse.status).toBe(500);
    expect(mocks.signedUrl).not.toHaveBeenCalled();
    expect(applyResponse.status).toBe(200);
    expect(await applyResponse.json()).toMatchObject({
      success: true, agents: { admin: { agentId: pinnedId, status: "applied" } },
    });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.verify).toHaveBeenCalledTimes(2);
    expect(mocks.update.mock.calls.every(([id]) => id === pinnedId)).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(["call", "apply"] as const)(
    "catches up when settings are saved after %s verification has read old settings",
    async owner => {
    const readback = deferred();
    const readStarted = deferred();
    let providerConfig: any;
    mocks.update.mockImplementation(async (_id, config) => {
      providerConfig = structuredClone(config);
      return {};
    });
    mocks.get.mockImplementation(async () => {
      const snapshot = structuredClone(providerConfig);
      // The verifier concurrently reads the old DB settings before this
      // provider response returns. It would otherwise approve that old pair.
      if (mocks.get.mock.calls.length === 1) {
        readStarted.resolve();
        await readback.promise;
      }
      return snapshot;
    });
    mocks.verify.mockImplementation((persisted, expected) => {
      const tts = persisted.conversation_config.tts;
      expect(tts.stability).toBe(expected.stability);
      expect(tts.similarity_boost).toBe(expected.similarityBoost);
      expect(tts.speed).toBe(expected.speed);
    });

    const firstRequest = owner === "call" ? call() : apply();
    await readStarted.promise;
    const settings = { stability: 0.35, similarityBoost: 0.65, speed: 0.9 };
    const saved = await fetch(`${base}/voice/convai/voice-settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ saved: true, settings });
    const applyArrived = once(requests, "POST /voice/convai/voice-settings/apply");
    const callArrived = once(requests, "GET /voice/convai/call-url");
    const applying = apply();
    const laterCall = call();
    await Promise.all([applyArrived, callArrived]);
    expect(mocks.signedUrl).not.toHaveBeenCalled();
    readback.resolve();

    const responses = await Promise.all([firstRequest, applying, laterCall]);
    expect(responses.map(response => response.status)).toEqual([200, 200, 200]);
    expect(await responses[1].json()).toMatchObject({
      success: true, agents: { admin: { agentId: pinnedId, sharedFlight: true } },
    });
    expect(providerConfig.conversation_config.tts).toMatchObject({
      stability: settings.stability,
      similarity_boost: settings.similarityBoost,
      speed: settings.speed,
    });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.verify).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.signedUrl.mock.calls.every(([id]) => id === pinnedId)).toBe(true);
  });
});
