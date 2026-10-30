import { describe, expect, it } from "vitest";
import {
  CONVAI_TTS_DEFAULTS,
  CONVAI_TTS_KV_KEYS,
  ConvAITtsSettingsError,
  normalizeConvAITtsSettings,
  parseStoredConvAITtsSettings,
} from "./convai-voice-settings";

describe("normalizeConvAITtsSettings (formulario de admin)", () => {
  it("acepta los tres valores en rango y los redondea a 2 decimales", () => {
    expect(normalizeConvAITtsSettings({ stability: 0.456, similarityBoost: "0,9", speed: 1 })).toEqual({
      stability: 0.46,
      similarityBoost: 0.9,
      speed: 1,
    });
  });

  it("acepta los nombres snake_case de ElevenLabs", () => {
    expect(normalizeConvAITtsSettings({ stability: 0.5, similarity_boost: 0.8, speed: 1.2 })).toEqual(CONVAI_TTS_DEFAULTS);
  });

  it("rechaza un valor ausente en vez de aplicar un default silencioso", () => {
    expect(() => normalizeConvAITtsSettings({ stability: 0.5, speed: 1.2 })).toThrowError(ConvAITtsSettingsError);
    try {
      normalizeConvAITtsSettings({ stability: 0.5, speed: 1.2 });
    } catch (err) {
      expect((err as ConvAITtsSettingsError).field).toBe("similarityBoost");
    }
  });

  it("rechaza valores fuera del rango que acepta ElevenLabs", () => {
    expect(() => normalizeConvAITtsSettings({ stability: 1.2, similarityBoost: 0.8, speed: 1 })).toThrow(/stability debe estar entre 0 y 1/);
    expect(() => normalizeConvAITtsSettings({ stability: 0.5, similarityBoost: 0.8, speed: 1.5 })).toThrow(/speed debe estar entre 0.7 y 1.2/);
    expect(() => normalizeConvAITtsSettings({ stability: 0.5, similarityBoost: 0.8, speed: 0.5 })).toThrow(/speed/);
  });

  it("rechaza texto que no es un número", () => {
    expect(() => normalizeConvAITtsSettings({ stability: "alta", similarityBoost: 0.8, speed: 1 })).toThrow(/stability es obligatorio/);
  });
});

describe("parseStoredConvAITtsSettings (filas de platform_settings_kv)", () => {
  it("devuelve los defaults del dueño (0.5 / 0.8 / 1.2) cuando no hay nada guardado", () => {
    const r = parseStoredConvAITtsSettings([]);
    expect(r.settings).toEqual({ stability: 0.5, similarityBoost: 0.8, speed: 1.2 });
    expect(r.source).toBe("default");
    expect(r.invalid).toEqual([]);
  });

  it("lee los tres valores guardados", () => {
    const r = parseStoredConvAITtsSettings([
      { key: CONVAI_TTS_KV_KEYS.stability, value: "0.3" },
      { key: CONVAI_TTS_KV_KEYS.similarityBoost, value: "0.9" },
      { key: CONVAI_TTS_KV_KEYS.speed, value: "1.05" },
      { key: "billing_provider", value: "stripe" },
    ]);
    expect(r.settings).toEqual({ stability: 0.3, similarityBoost: 0.9, speed: 1.05 });
    expect(r.source).toBe("db");
  });

  it("ignora un valor corrupto o fuera de rango sin romper la llamada y lo señala", () => {
    const r = parseStoredConvAITtsSettings([
      { key: CONVAI_TTS_KV_KEYS.stability, value: "abc" },
      { key: CONVAI_TTS_KV_KEYS.similarityBoost, value: "0.9" },
      { key: CONVAI_TTS_KV_KEYS.speed, value: "9" },
    ]);
    expect(r.settings).toEqual({ stability: 0.5, similarityBoost: 0.9, speed: 1.2 });
    expect(r.invalid).toEqual(["stability", "speed"]);
    expect(r.source).toBe("db");
  });

  it("marca source=mixed si solo hay parte de las claves", () => {
    const r = parseStoredConvAITtsSettings([{ key: CONVAI_TTS_KV_KEYS.speed, value: "1" }]);
    expect(r.settings.speed).toBe(1);
    expect(r.settings.stability).toBe(0.5);
    expect(r.source).toBe("mixed");
  });
});
