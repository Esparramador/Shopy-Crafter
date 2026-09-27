import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";

// Estas rutas se montan ANTES del requireAdmin global (routes/index.ts) y no tenían
// guardia propia: cualquiera sin sesión podía usar Claude/ElevenLabs a coste de la
// plataforma y leer el ADN de marca de cualquier projectId.
const aiCalls = vi.fn();
vi.mock("@workspace/db", () => ({ db: new Proxy({}, { get: () => { aiCalls(); throw new Error("no debería tocar la BD"); } }) }));
vi.mock("../lib/claude.js", () => new Proxy({}, { get: (_t, k) => (k === "then" ? undefined : k === "CLAUDE_MODEL" ? "m" : () => { aiCalls(); throw new Error("no debería llamar a la IA"); }) }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: vismeRouter } = await import("./visme");
  const { default: promptExecRouter } = await import("./prompt-exec");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as unknown as { session: object }).session = {}; next(); }); // sin login
  app.use("/api", vismeRouter);
  app.use("/api", promptExecRouter);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => { server.close(); });

describe("rutas de IA de admin sin sesión", () => {
  for (const [path, body] of [
    ["/visme/generate", { prompt: "x", projectId: 1 }],
    ["/visme/adapt", { prompt: "x" }],
    ["/visme/compose", { snippetIds: ["a"] }],
    ["/visme/preview", { snippetId: "a" }],
    ["/prompt-library/execute", { template: "hola", projectId: 1 }],
    ["/prompt-library/preview-vars", { template: "hola", projectId: 1 }],
  ] as const) {
    it(`POST ${path} → 403 sin tocar IA ni BD`, async () => {
      const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      expect(r.status).toBe(403);
    });
  }

  it("no se llamó a la IA ni a la BD", () => {
    expect(aiCalls).not.toHaveBeenCalled();
  });
});
