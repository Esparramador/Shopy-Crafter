import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkOpenaiHealth } from "./provider-health.js";

describe("comprobación de salud de OpenAI", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("usa la base URL de Replit y no envía su clave proxy a OpenAI directo", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "replit-proxy-test-key");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://proxy.example/v1/");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkOpenaiHealth();

    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer replit-proxy-test-key" },
      }),
    );
  });

  it("marca desconocido cuando el proxy no ofrece GET /models, no como clave inválida", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "replit-proxy-test-key");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://proxy.example/v1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 405 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkOpenaiHealth();

    expect(result).toMatchObject({
      provider: "openai",
      status: "unknown",
      hasKey: true,
    });
    expect(result.detail).toContain("HTTP 405");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example/v1/models",
      expect.any(Object),
    );
  });

  it("conserva la comprobación directa cuando solo hay una clave de OpenAI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "direct-openai-test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkOpenaiHealth();

    expect(result.status).toBe("missing_key");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.any(Object),
    );
  });

  it("no afirma que el proveedor está caído si falta la base URL del proxy", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "replit-proxy-test-key");

    const result = await checkOpenaiHealth();

    expect(result).toMatchObject({
      provider: "openai",
      status: "unknown",
      hasKey: true,
    });
    expect(result.detail).toContain("AI_INTEGRATIONS_OPENAI_BASE_URL");
  });
});
