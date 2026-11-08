import { describe, it, expect, vi } from "vitest";
import { compareXaiCatalog, fetchXaiModels, xaiApiKey } from "./xai-models.js";

describe("xai-models", () => {
  it("cruza los IDs vivos con los de la plataforma", () => {
    const r = compareXaiCatalog(["grok-4.3", "grok-4.7", "grok-imagine-video"], ["grok-4.3", "grok-3-fast", "grok-4.3"], new Date(0));
    expect(r.confirmed).toEqual(["grok-4.3"]);
    expect(r.missing).toEqual(["grok-3-fast"]);
    expect(r.notInCatalog).toEqual(["grok-4.7", "grok-imagine-video"]);
    expect(r.checkedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("sin clave no llama a la API ni inventa modelos", async () => {
    const f = vi.fn();
    const r = await fetchXaiModels(["grok-4.3"], { apiKey: null, fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, reason: "no_key" });
    expect(f).not.toHaveBeenCalled();
  });

  it("lee GET /v1/models con la clave en Bearer", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "grok-4.3" }, { id: "grok-4.7" }] }), { status: 200 }));
    const r = await fetchXaiModels(["grok-4.3", "grok-3-mini-fast"], { apiKey: "k", fetchImpl: f as unknown as typeof fetch });
    expect(f).toHaveBeenCalledWith("https://api.x.ai/v1/models", expect.objectContaining({ headers: { Authorization: "Bearer k" } }));
    expect(r.ok && r.missing).toEqual(["grok-3-mini-fast"]);
  });

  it("informa del error HTTP sin lanzar", async () => {
    const f = vi.fn(async () => new Response("bad key", { status: 401 }));
    const r = await fetchXaiModels([], { apiKey: "k", fetchImpl: f as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: false, reason: "http_error", status: 401 });
  });

  it("acepta XAI_API_KEY o GROK_API_KEY", () => {
    expect(xaiApiKey({ GROK_API_KEY: " g " } as NodeJS.ProcessEnv)).toBe("g");
    expect(xaiApiKey({} as NodeJS.ProcessEnv)).toBeNull();
  });
});
