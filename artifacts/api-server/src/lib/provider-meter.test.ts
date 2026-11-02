import { describe, it, expect, afterEach, vi } from "vitest";

const recorded: unknown[] = [];
vi.mock("./api-usage.js", async (orig) => ({
  ...(await orig<typeof import("./api-usage.js")>()),
  recordApiUsage: async (row: unknown) => { recorded.push(row); },
}));
vi.mock("@workspace/db", () => ({ db: { execute: vi.fn(), insert: vi.fn() } }));
vi.mock("@workspace/db/schema", () => ({ apiUsageLogTable: {} }));
vi.mock("./ai-budget.js", () => ({ assertAiBudget: async () => {} }));
vi.mock("./logger.js", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { classifyBillable, creditsSpent, eurPerRequest, usdPerCredit, meterCredits } = await import("./provider-meter.js");

describe("provider-meter", () => {
  afterEach(() => {
    delete process.env.PROVIDER_EUR_PER_REQUEST_FREEPIK;
    delete process.env.PROVIDER_EUR_PER_REQUEST_FREEPIK_UPSCALE;
    delete process.env.MESHY_USD_PER_CREDIT;
  });

  it("créditos gastados = saldo antes − después; null si falta una lectura", () => {
    expect(creditsSpent(1000, 970)).toBe(30);
    expect(creditsSpent(10, 12)).toBe(0); // recarga entre lecturas: nunca negativo
    expect(creditsSpent(null, 5)).toBeNull();
    expect(creditsSpent(5, Number.NaN)).toBeNull();
  });

  it("precio por crédito: tarifa pública salvo que el entorno lo cambie", () => {
    expect(usdPerCredit("meshy")).toBe(0.02);
    expect(usdPerCredit("tripo3d")).toBe(0.01);
    process.env.MESHY_USD_PER_CREDIT = "0.015";
    expect(usdPerCredit("meshy")).toBe(0.015);
  });

  it("precio por petición: el de la operación gana al del proveedor; sin precio → null", () => {
    expect(eurPerRequest("freepik", "upscale")).toBeNull();
    process.env.PROVIDER_EUR_PER_REQUEST_FREEPIK = "0.05";
    process.env.PROVIDER_EUR_PER_REQUEST_FREEPIK_UPSCALE = "0.2";
    expect(eurPerRequest("freepik", "upscale")).toBe(0.2);
    expect(eurPerRequest("freepik", "text-to-image")).toBe(0.05);
  });

  it("solo factura crear predicción en Replicate y TTS/STS/doblaje en ElevenLabs", () => {
    expect(classifyBillable("https://api.replicate.com/v1/models/kwaivgi/kling-v2.1-standard/predictions", "{}"))
      .toMatchObject({ provider: "replicate", model: "kwaivgi/kling-v2.1-standard" });
    expect(classifyBillable("https://api.replicate.com/v1/predictions", JSON.stringify({ version: "abc123" })))
      .toMatchObject({ provider: "replicate", model: "abc123" });
    expect(classifyBillable("https://api.replicate.com/v1/files", "x")).toBeNull();
    expect(classifyBillable("https://api.replicate.com/v1/predictions/xyz", "")).toBeNull();
    const tts = classifyBillable("https://api.elevenlabs.io/v1/text-to-speech/voice1", JSON.stringify({ text: "hola mundo" }));
    expect(tts).toMatchObject({ provider: "elevenlabs", operation: "tts", units: 10 });
    expect(tts?.costUsd).toBeGreaterThan(0);
    expect(classifyBillable("https://api.elevenlabs.io/v1/dubbing", null)).toMatchObject({ operation: "dubbing" });
    expect(classifyBillable("https://api.elevenlabs.io/v1/voices", null)).toBeNull();
    expect(classifyBillable("no es url", null)).toBeNull();
  });

  it("meterCredits registra los créditos reales gastados por la tarea", async () => {
    recorded.length = 0;
    const balances = [500, 470];
    const out = await meterCredits({ provider: "meshy", operation: "image-to-3d", readBalance: async () => balances.shift() ?? null, run: async () => "ok" });
    expect(out).toBe("ok");
    expect(recorded[0]).toMatchObject({ provider: "meshy", inputUnits: 30, unitsLabel: "credits" });
    expect((recorded[0] as { costUsd: number }).costUsd).toBeCloseTo(0.6);
  });
});
