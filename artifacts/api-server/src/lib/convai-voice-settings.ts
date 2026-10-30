/**
 * Ajustes de voz de Arturo (agente ConvAI): stability / similarity_boost / speed.
 *
 * Antes eran constantes en routes/voice.ts; ahora se persisten en
 * platform_settings_kv (claves convai_tts_*) para poder afinarlos desde el
 * panel de admin sin redesplegar. Este módulo contiene solo la parte pura
 * (defaults, límites, normalización y parseo de filas) para poder testearla;
 * la lectura/escritura en BD vive en routes/voice.ts.
 */

export interface ConvAITtsSettings {
  /** 0–1. Media (0.5) → voz estable sin altibajos. */
  stability: number;
  /** 0–1. Alta (0.8) → fiel al timbre de la voz original. */
  similarityBoost: number;
  /** 0.7–1.2 (rango aceptado por ElevenLabs). 1.2 → 20% más rápido. */
  speed: number;
}

export type ConvAITtsSettingKey = keyof ConvAITtsSettings;

/**
 * Valores elegidos por el dueño escuchando muestras (sept 2026): prefirió el
 * par estable 0.5 / 0.8 frente al expresivo 0.18 / 0.92. Son el valor por
 * defecto cuando no hay nada guardado en BD.
 */
export const CONVAI_TTS_DEFAULTS: Readonly<ConvAITtsSettings> = Object.freeze({
  stability: 0.5,
  similarityBoost: 0.8,
  speed: 1.2,
});

/** Límites que acepta la API de ElevenLabs para cada ajuste. */
export const CONVAI_TTS_LIMITS: Readonly<Record<ConvAITtsSettingKey, { min: number; max: number; step: number }>> = Object.freeze({
  stability: { min: 0, max: 1, step: 0.05 },
  similarityBoost: { min: 0, max: 1, step: 0.05 },
  speed: { min: 0.7, max: 1.2, step: 0.05 },
});

/** Clave en platform_settings_kv de cada ajuste. */
export const CONVAI_TTS_KV_KEYS: Readonly<Record<ConvAITtsSettingKey, string>> = Object.freeze({
  stability: "convai_tts_stability",
  similarityBoost: "convai_tts_similarity_boost",
  speed: "convai_tts_speed",
});

const LABELS: Record<ConvAITtsSettingKey, string> = {
  stability: "stability",
  similarityBoost: "similarity_boost",
  speed: "speed",
};

export class ConvAITtsSettingsError extends Error {
  readonly field: ConvAITtsSettingKey;
  constructor(field: ConvAITtsSettingKey, message: string) {
    super(message);
    this.name = "ConvAITtsSettingsError";
    this.field = field;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Redondea a 2 decimales para que lo guardado coincida con lo que se muestra. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Valida y normaliza los tres ajustes recibidos del formulario de admin.
 * Lanza ConvAITtsSettingsError (mensaje en español) si falta alguno o está
 * fuera del rango que acepta ElevenLabs. No aplica defaults silenciosos: un
 * valor ausente en un guardado es un error, no "déjalo como estaba".
 */
export function normalizeConvAITtsSettings(input: unknown): ConvAITtsSettings {
  const src = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const out: Partial<ConvAITtsSettings> = {};
  for (const key of Object.keys(CONVAI_TTS_LIMITS) as ConvAITtsSettingKey[]) {
    // Aceptar también el nombre snake_case que usa ElevenLabs.
    const raw = src[key] ?? src[LABELS[key]];
    const n = toNumber(raw);
    if (n === null) {
      throw new ConvAITtsSettingsError(key, `${LABELS[key]} es obligatorio y debe ser un número`);
    }
    const { min, max } = CONVAI_TTS_LIMITS[key];
    if (n < min || n > max) {
      throw new ConvAITtsSettingsError(key, `${LABELS[key]} debe estar entre ${min} y ${max} (recibido ${n})`);
    }
    out[key] = round2(n);
  }
  return out as ConvAITtsSettings;
}

export interface StoredConvAITtsSettings {
  settings: ConvAITtsSettings;
  /** "db" si los tres valores vienen de BD; "default" si no hay nada; "mixed" si falta alguno. */
  source: "db" | "default" | "mixed";
  /** Claves cuyo valor en BD no era válido (se ignoró y se usó el default). */
  invalid: ConvAITtsSettingKey[];
}

/**
 * Construye los ajustes a partir de las filas {key,value} de platform_settings_kv.
 * Un valor corrupto o fuera de rango NO rompe las llamadas de voz: se ignora,
 * se usa el default y se devuelve en `invalid` para que el panel lo avise.
 */
export function parseStoredConvAITtsSettings(rows: Array<{ key: string; value: string | null }>): StoredConvAITtsSettings {
  const byKey = new Map<string, string | null>();
  for (const r of rows ?? []) if (r && typeof r.key === "string") byKey.set(r.key, r.value);

  const settings: ConvAITtsSettings = { ...CONVAI_TTS_DEFAULTS };
  const invalid: ConvAITtsSettingKey[] = [];
  let found = 0;
  for (const key of Object.keys(CONVAI_TTS_KV_KEYS) as ConvAITtsSettingKey[]) {
    const kv = CONVAI_TTS_KV_KEYS[key];
    if (!byKey.has(kv)) continue;
    found += 1;
    const n = toNumber(byKey.get(kv));
    const { min, max } = CONVAI_TTS_LIMITS[key];
    if (n === null || n < min || n > max) {
      invalid.push(key);
      continue;
    }
    settings[key] = round2(n);
  }
  const source: StoredConvAITtsSettings["source"] = found === 0 ? "default" : found === 3 ? "db" : "mixed";
  return { settings, source, invalid };
}

/** Texto corto de muestra para el botón "Escuchar" (misma voz y modelo que Arturo). */
export const CONVAI_TTS_PREVIEW_TEXT =
  "¡Buenas! Soy Arturo, el secretario del CEO de Shopy Crafter. Dime, ¿en qué te puedo echar una mano hoy?";

/** Longitud máxima del texto de muestra: la previsualización es corta y barata. */
export const CONVAI_TTS_PREVIEW_MAX_CHARS = 300;
