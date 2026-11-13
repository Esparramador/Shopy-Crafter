// Los estudios informan al cerebro al terminar: trackStudioRun() registra en
// brain_events la entrada y el resultado sin tocar lo que responde el handler.
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@workspace/db", async (orig) => {
  process.env.DATABASE_URL ||= "postgres://test@127.0.0.1:9/none"; // el Pool no conecta
  const { fakeBrainDb } = await import("../../test/fake-brain-db.js");
  return { ...(await orig<object>()), db: fakeBrainDb.db };
});
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { fakeBrainDb } from "../../test/fake-brain-db.js";
import { summarizeStudioResult, trackStudioRun } from "./studio-report.js";

const events = () => fakeBrainDb.insertsInto("brain_events");

function fakeRes() {
  const res = new EventEmitter() as EventEmitter & { statusCode: number; writableFinished: boolean; json: (b: unknown) => unknown; status: (c: number) => unknown; sent?: unknown };
  res.statusCode = 200;
  res.writableFinished = false;
  res.json = (b: unknown) => { res.sent = b; res.writableFinished = true; res.emit("finish"); return res; };
  res.status = (c: number) => { res.statusCode = c; return res; };
  return res;
}

beforeEach(() => fakeBrainDb.reset());

describe("trackStudioRun", () => {
  it("registra el vídeo de Fusion con su prompt, resultado y duración, sin cambiar la respuesta", async () => {
    const req = { body: { projectId: "7", promptText: "a red sneaker spinning", model: "veo_3" }, session: { userId: "admin-1", role: "admin" } } as unknown as Request;
    const res = fakeRes();
    trackStudioRun(req, res as unknown as Response, {
      studio: "fusion", operation: "generate-video",
      input: r => r.body.promptText, params: r => ({ model: r.body.model }),
    });
    (res as unknown as Response).json({ success: true, videoUrl: "https://cdn/x.mp4", vaultId: 12 });
    expect(res.sent).toEqual({ success: true, videoUrl: "https://cdn/x.mp4", vaultId: 12 });
    await vi.waitFor(() => expect(events()).toHaveLength(1));
    expect(events()[0]).toMatchObject({
      gate: "admin", channel: "studio-fusion", kind: "execute", status: "ok", userId: "admin-1", projectId: 7,
      input: "a red sneaker spinning", actions: [{ action: "generate-video", params: { model: "veo_3" } }],
      detail: "videoUrl: https://cdn/x.mp4 · vaultId: 12",
    });
    expect(typeof events()[0]!.durationMs).toBe("number");
  });

  it("un error del estudio queda como error con su mensaje; un cliente queda en su puerta", async () => {
    const req = { body: { type: "seo-audit" }, session: { userId: "c-9", role: "client" } } as unknown as Request;
    const res = fakeRes();
    trackStudioRun(req, res as unknown as Response, { studio: "generador", operation: "run", input: r => r.body.type });
    (res as unknown as Response).status(400);
    (res as unknown as Response).json({ error: "Se requiere un proyecto asociado" });
    await vi.waitFor(() => expect(events()).toHaveLength(1));
    expect(events()[0]).toMatchObject({ gate: "client", channel: "studio-generador", status: "error", detail: "Se requiere un proyecto asociado", projectId: null });
  });

  it("si la conexión se corta antes de responder, se registra una sola vez como error", async () => {
    const res = fakeRes();
    trackStudioRun({ body: {} } as unknown as Request, res as unknown as Response, { studio: "fusion", operation: "analyze" });
    res.emit("close");
    res.emit("close");
    await vi.waitFor(() => expect(events()).toHaveLength(1));
    expect(events()[0]).toMatchObject({ status: "error", detail: "La conexión se cerró antes de terminar" });
  });
});

describe("summarizeStudioResult", () => {
  it("cuenta listas y omite data URIs y textos largos", () => {
    expect(summarizeStudioResult({ success: true, images: [1, 2, 3], preview: "data:image/png;base64,AAAA", html: "x".repeat(200) }, 200)).toBe("images: 3");
    expect(summarizeStudioResult({ success: true, message: "Informe generado" }, 200)).toBe("Informe generado");
    expect(summarizeStudioResult(undefined, 502)).toBe("HTTP 502");
  });
});
