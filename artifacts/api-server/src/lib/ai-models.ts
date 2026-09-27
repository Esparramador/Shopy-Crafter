/**
 * AI Model Registry & Tier Selection
 * ----------------------------------
 * Selects the right Claude / Gemini / xAI model per task tier WITHOUT hardcoding
 * model names anywhere in the app. Four layers (priority order):
 *   1. Explicit override passed to the call (`opts.model`).
 *   2. DB override stored in `platform_settings` table (admin can change live).
 *   3. ENV defaults (CLAUDE_MODEL_*, GEMINI_MODEL_*).
 *   4. Hard fallback (verified June-25-2026 via GET /v1beta/models + HTTP 200 test).
 *
 * Tiers:
 *   - "fast"   → cheap & quick      (Claude Haiku 4.5  / Gemini 3.5 Flash        / Grok 3 Mini Fast)
 *   - "smart"  → balanced default   (Claude Sonnet 4.6 / Gemini 3.1 Pro Preview  / Grok 3 Fast)
 *   - "genius" → max reasoning      (Claude Opus 4.8   / Gemini 3.1 Pro Preview  / Grok 3)
 *   - "vision" → multimodal-strong  (Claude Sonnet 4.6 / Gemini 2.5 Flash        / Grok 2 Vision)
 *
 * Cached for 60s so live admin changes propagate quickly without DB hammering.
 */
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";

export type AITier = "fast" | "smart" | "genius" | "vision";
export type AIProvider = "claude" | "gemini" | "xai";

// June-2026 stable defaults. Override via env or admin UI; never hardcode in
// callsites — always go through `pickModel(provider, tier, override)`.
const HARD_DEFAULTS: Record<AIProvider, Record<AITier, string>> = {
  claude: {
    fast: "claude-haiku-4-5",
    smart: "claude-sonnet-4-6",
    genius: "claude-opus-4-8",
    vision: "claude-sonnet-4-6",
  },
  gemini: {
    // Verified 2026-06-25 via GET /v1beta/models + HTTP 200 smoke test
    fast:   "gemini-3.5-flash",          // Latest fast — confirmed available
    smart:  "gemini-3.1-pro-preview",    // Latest pro  — confirmed available
    genius: "gemini-3.1-pro-preview",    // Top reasoning — confirmed available
    vision: "gemini-2.5-flash",          // Reliable multimodal — confirmed available
  },
  xai: {
    fast: "grok-3-mini-fast",
    smart: "grok-3-fast",
    genius: "grok-3",
    vision: "grok-2-vision-1212",
  },
};

const ENV_KEYS: Record<AIProvider, Record<AITier, string>> = {
  claude: {
    fast: "CLAUDE_MODEL_FAST",
    smart: "CLAUDE_MODEL", // backward compatible
    genius: "CLAUDE_MODEL_GENIUS",
    vision: "CLAUDE_MODEL_VISION",
  },
  gemini: {
    fast: "GEMINI_MODEL", // backward compatible
    smart: "GEMINI_PRO_MODEL",
    genius: "GEMINI_GENIUS_MODEL",
    vision: "GEMINI_VISION_MODEL",
  },
  xai: {
    fast: "XAI_MODEL_FAST",
    smart: "XAI_MODEL",
    genius: "XAI_MODEL_GENIUS",
    vision: "XAI_MODEL_VISION",
  },
};

const SETTINGS_KEYS: Record<AIProvider, Record<AITier, string>> = {
  claude: {
    fast: "ai.claude.fast",
    smart: "ai.claude.smart",
    genius: "ai.claude.genius",
    vision: "ai.claude.vision",
  },
  gemini: {
    fast: "ai.gemini.fast",
    smart: "ai.gemini.smart",
    genius: "ai.gemini.genius",
    vision: "ai.gemini.vision",
  },
  xai: {
    fast: "ai.xai.fast",
    smart: "ai.xai.smart",
    genius: "ai.xai.genius",
    vision: "ai.xai.vision",
  },
};

interface CachedSettings {
  values: Map<string, string>;
  ts: number;
}
let cache: CachedSettings | null = null;
let inflight: Promise<Map<string, string>> | null = null;
const CACHE_TTL_MS = 60_000;

/** In-memory snapshot of the DB overrides — refreshed every CACHE_TTL_MS by a
 *  background tick and on every successful DB read. Used by pickModelSync so
 *  hot paths (gemini.ts) honor admin overrides without an await. */
const snapshot: Map<string, string> = new Map();

async function loadSettingsFromDb(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.values;
  // single-flight: dedupe concurrent loads (avoid cache stampede)
  if (inflight) return inflight;
  inflight = (async () => {
    const map = new Map<string, string>();
    try {
      const allKeys: string[] = [];
      for (const p of ["claude", "gemini", "xai"] as AIProvider[]) {
        for (const t of ["fast", "smart", "genius", "vision"] as AITier[]) {
          allKeys.push(SETTINGS_KEYS[p][t]);
        }
      }
      const rows = await db.select().from(platformSettingsTable).where(inArray(platformSettingsTable.key, allKeys));
      for (const r of rows) {
        if (typeof r.value === "string" && r.value.trim().length > 0) {
          map.set(r.key, r.value.trim());
        }
      }
    } catch (e: any) {
      logger.warn({ err: e?.message }, "[AI Models] settings table read failed — using env/defaults");
    }
    cache = { values: map, ts: Date.now() };
    // mirror into the sync snapshot so pickModelSync sees the latest values
    snapshot.clear();
    for (const [k, v] of map.entries()) snapshot.set(k, v);
    return map;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function invalidateAIModelCache(): void {
  cache = null;
  // proactively re-hydrate snapshot in the background so the next sync read
  // sees the new value within milliseconds, not after the next 60s tick.
  void loadSettingsFromDb().catch(() => {});
}

// Background refresher — keeps the sync snapshot fresh for hot paths.
let bgStarted = false;
function startBackgroundRefresh(): void {
  if (bgStarted) return;
  bgStarted = true;
  // first warm right away
  void loadSettingsFromDb().catch(() => {});
  setInterval(() => {
    void loadSettingsFromDb().catch(() => {});
  }, CACHE_TTL_MS).unref?.();
}
startBackgroundRefresh();

/**
 * Modelos retirados por el proveedor → sucesor vigente. Un override guardado en
 * ajustes o en el entorno con uno de estos IDs haría fallar TODAS las llamadas
 * de ese tier; se sustituye y se avisa en el log.
 */
const RETIRED_MODELS: Record<string, string> = {
  "claude-3-opus-20240229": "claude-opus-4-8",
  "claude-3-opus-latest": "claude-opus-4-8",
  "claude-3-5-sonnet-20241022": "claude-sonnet-4-6",
  "claude-3-5-sonnet-20240620": "claude-sonnet-4-6",
  "claude-3-5-sonnet-latest": "claude-sonnet-4-6",
  "claude-3-7-sonnet-20250219": "claude-sonnet-4-6",
  "claude-3-7-sonnet-latest": "claude-sonnet-4-6",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5",
  "claude-3-5-haiku-latest": "claude-haiku-4-5",
  "claude-3-haiku-20240307": "claude-haiku-4-5",
  "claude-haiku-3-5": "claude-haiku-4-5",
  "claude-haiku-3-5-20241022": "claude-haiku-4-5",
  "claude-opus-4-1": "claude-opus-4-8",
  "claude-opus-4-1-20250805": "claude-opus-4-8",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-001": "gemini-2.5-flash",
  "gemini-2.0-flash-exp": "gemini-2.5-flash",
  "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite-001": "gemini-2.5-flash-lite",
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-2.5-pro",
};
const warnedRetired = new Set<string>();
export function replaceRetiredModel(model: string): string {
  const next = RETIRED_MODELS[model];
  if (!next) return model;
  if (!warnedRetired.has(model)) {
    warnedRetired.add(model);
    logger.warn({ model, replacement: next }, "[ai-models] modelo retirado por el proveedor — usando su sucesor; actualiza el ajuste");
  }
  return next;
}

/**
 * Resolves the actual model name for a given provider + tier.
 * Override chain: explicit arg → DB setting → env var → hard default.
 */
export async function pickModel(provider: AIProvider, tier: AITier = "smart", override?: string): Promise<string> {
  if (override && typeof override === "string" && override.trim().length > 0) {
    return replaceRetiredModel(override.trim());
  }
  const settings = await loadSettingsFromDb();
  const dbVal = settings.get(SETTINGS_KEYS[provider][tier]);
  if (dbVal) return replaceRetiredModel(dbVal);
  const envKey = ENV_KEYS[provider][tier];
  const envVal = process.env[envKey];
  if (envVal && envVal.trim().length > 0) return replaceRetiredModel(envVal.trim());
  return HARD_DEFAULTS[provider][tier];
}

/** Sync version for hot paths. Honors DB overrides via the in-memory snapshot
 *  (refreshed every 60s + immediately after each `setAIModelOverride`).
 *  Falls back to ENV → hard default. */
export function pickModelSync(provider: AIProvider, tier: AITier = "smart"): string {
  const snapVal = snapshot.get(SETTINGS_KEYS[provider][tier]);
  if (snapVal) return replaceRetiredModel(snapVal);
  const envKey = ENV_KEYS[provider][tier];
  const envVal = process.env[envKey];
  if (envVal && envVal.trim().length > 0) return replaceRetiredModel(envVal.trim());
  return HARD_DEFAULTS[provider][tier];
}

export interface AIModelMatrix {
  claude: Record<AITier, { current: string; default: string; envKey: string; settingsKey: string; source: "override" | "db" | "env" | "default" }>;
  gemini: Record<AITier, { current: string; default: string; envKey: string; settingsKey: string; source: "override" | "db" | "env" | "default" }>;
  xai: Record<AITier, { current: string; default: string; envKey: string; settingsKey: string; source: "override" | "db" | "env" | "default" }>;
}

/** Snapshot for the admin UI: what model is each tier resolving to and why. */
export async function getAIModelMatrix(): Promise<AIModelMatrix> {
  const settings = await loadSettingsFromDb();
  const build = (provider: AIProvider) => {
    const out = {} as Record<AITier, { current: string; default: string; envKey: string; settingsKey: string; source: "override" | "db" | "env" | "default" }>;
    for (const t of ["fast", "smart", "genius", "vision"] as AITier[]) {
      const settingsKey = SETTINGS_KEYS[provider][t];
      const envKey = ENV_KEYS[provider][t];
      const dbVal = settings.get(settingsKey);
      const envVal = process.env[envKey];
      let current: string;
      let source: "db" | "env" | "default";
      if (dbVal) { current = dbVal; source = "db"; }
      else if (envVal && envVal.trim().length > 0) { current = envVal.trim(); source = "env"; }
      else { current = HARD_DEFAULTS[provider][t]; source = "default"; }
      out[t] = { current, default: HARD_DEFAULTS[provider][t], envKey, settingsKey, source };
    }
    return out;
  };
  return { claude: build("claude"), gemini: build("gemini"), xai: build("xai") };
}

/** Persist a tier→model override into platform_settings (admin only). */
export async function setAIModelOverride(provider: AIProvider, tier: AITier, model: string | null): Promise<void> {
  const key = SETTINGS_KEYS[provider][tier];
  if (!model || model.trim().length === 0) {
    await db.delete(platformSettingsTable).where(eq(platformSettingsTable.key, key));
  } else {
    await db
      .insert(platformSettingsTable)
      .values({ key, value: model.trim() })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: model.trim(), updatedAt: new Date() } });
  }
  invalidateAIModelCache();
}

/** Catalog of known June-2026 models for the admin UI dropdowns. */
export const KNOWN_MODELS: Record<AIProvider, Array<{ id: string; label: string; tierHint: AITier; notes?: string }>> = {
  claude: [
    // IDs vigentes (sep-2026). Retirados por Anthropic y eliminados de la lista:
    // Claude 3 / 3.5 / 3.7 y Opus 4.1 (retirado 05-08-2026).
    { id: "claude-fable-5-1", label: "Claude Fable 5.1", tierHint: "genius", notes: "El más capaz; razonamiento y tareas agénticas largas (pensamiento siempre activo)" },
    { id: "claude-fable-5", label: "Claude Fable 5", tierHint: "genius", notes: "Generación anterior de Fable" },
    { id: "claude-opus-5", label: "Claude Opus 5", tierHint: "genius", notes: "Opus actual — razonamiento profundo y programación" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", tierHint: "genius", notes: "Máximo razonamiento, ideal para tareas complejas y programación avanzada" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", tierHint: "genius", notes: "Alta capacidad de razonamiento y análisis de datos complejos" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6", tierHint: "genius", notes: "Modelo de alto rendimiento para razonamiento profundo" },
    { id: "claude-opus-4-5", label: "Claude Opus 4.5", tierHint: "genius", notes: "Versión estable de Opus para flujos de trabajo críticos" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", tierHint: "smart", notes: "Sonnet actual — calidad cercana a Opus a menor coste" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tierHint: "smart", notes: "El mejor equilibrio entre velocidad y capacidad, con soporte de visión" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", tierHint: "smart", notes: "Versión estable de Sonnet con excelentes capacidades multimodales" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tierHint: "fast", notes: "Ultra rápido y económico, ideal para clasificación y extracción de datos" },
  ],
  // ── GEMINI — Verified 2026-06-25 via GET /v1beta/models (direct API) ──────
  // All IDs below confirmed present in the models list. HTTP 200 smoke-tested:
  //   gemini-3.5-flash ✅  gemini-3.1-pro-preview ✅  gemini-2.5-flash ✅
  gemini: [
    // ── Flagship text / reasoning (Gemini 3.x) ───────────────────────────
    { id: "gemini-3.5-flash",                       label: "Gemini 3.5 Flash",                        tierHint: "fast",   notes: "⚡ Más rápido y barato — default fast (verificado 2026-06-25)" },
    { id: "gemini-3.1-pro-preview",                 label: "Gemini 3.1 Pro Preview",                  tierHint: "genius", notes: "🧠 Top razonamiento — default smart/genius (verificado 2026-06-25)" },
    { id: "gemini-3.1-pro-preview-customtools",     label: "Gemini 3.1 Pro Preview (CustomTools)",    tierHint: "genius", notes: "🧠 Pro + soporte extendido de herramientas" },
    { id: "gemini-3-pro-preview",                   label: "Gemini 3 Pro Preview",                    tierHint: "smart",  notes: "💡 Gen 3 Pro — sólido razonamiento, menor coste que 3.1" },
    { id: "gemini-3-flash-preview",                 label: "Gemini 3 Flash Preview",                  tierHint: "fast",   notes: "⚡ Flash Gen 3 — equilibrio velocidad/calidad" },
    // ── Lite / Ultra-económicos ────────────────────────────────────────────
    { id: "gemini-3.1-flash-lite",                  label: "Gemini 3.1 Flash Lite",                   tierHint: "fast",   notes: "💰 Ultra-barato, tareas simples y clasificación" },
    { id: "gemini-3.1-flash-lite-preview",          label: "Gemini 3.1 Flash Lite Preview",           tierHint: "fast",   notes: "💰 Flash lite preview — mínimo coste" },
    { id: "gemini-2.5-flash-lite",                  label: "Gemini 2.5 Flash Lite",                   tierHint: "fast",   notes: "💰 Flash lite 2.5" },
    // ── Imagen nativa (responseModalities IMAGE) ──────────────────────────
    { id: "gemini-3.1-flash-image",                 label: "Gemini 3.1 Flash Image (Nano Banana 2)",  tierHint: "vision", notes: "🖼️ Generación imagen — último estable (verificado 2026-06-25)" },
    { id: "gemini-3.1-flash-image-preview",         label: "Gemini 3.1 Flash Image Preview",          tierHint: "vision", notes: "🖼️ Preview imagen más reciente" },
    { id: "gemini-3-pro-image",                     label: "Gemini 3 Pro Image (Nano Banana Pro)",    tierHint: "vision", notes: "🖼️ Calidad pro en generación de imagen (verificado 2026-06-25)" },
    { id: "gemini-3-pro-image-preview",             label: "Gemini 3 Pro Image Preview",              tierHint: "vision", notes: "🖼️ Preview imagen pro gen 3" },
    { id: "gemini-2.5-flash-image",                 label: "Gemini 2.5 Flash Image (Nano Banana)",    tierHint: "vision", notes: "🖼️ Imagen flash 2.5 — default vision tier (verificado 2026-06-25)" },
    // ── TTS / Voz nativa (generateContent, audio output) ─────────────────
    { id: "gemini-3.1-flash-tts-preview",           label: "Gemini 3.1 Flash TTS",                    tierHint: "fast",   notes: "🔊 TTS nativo 3.1 — sólo salida de audio" },
    { id: "gemini-2.5-flash-preview-tts",           label: "Gemini 2.5 Flash TTS",                    tierHint: "fast",   notes: "🔊 TTS audio nativo 2.5 — sólo salida de audio" },
    { id: "gemini-2.5-pro-preview-tts",             label: "Gemini 2.5 Pro TTS",                      tierHint: "smart",  notes: "🔊 TTS alta calidad con voz Pro — sólo salida de audio" },
    // ── 2.5 / 2.0 estables ────────────────────────────────────────────────
    { id: "gemini-2.5-flash",                       label: "Gemini 2.5 Flash",                        tierHint: "fast",   notes: "default vision multimodal (verificado 2026-06-25)" },
    { id: "gemini-2.5-pro",                         label: "Gemini 2.5 Pro",                          tierHint: "smart",  notes: "verificado 2026-06-25" },
    { id: "gemini-2.5-computer-use-preview-10-2025", label: "Gemini 2.5 Computer Use Preview",        tierHint: "genius", notes: "🤖 Agente autónomo / computer use (experimental)" },
    // ── Aliases (resuelven siempre al modelo más reciente) ────────────────
    { id: "gemini-flash-latest",                    label: "Gemini Flash Latest (alias)",             tierHint: "fast",   notes: "🔄 Resuelve al flash más reciente automáticamente" },
    { id: "gemini-flash-lite-latest",               label: "Gemini Flash Lite Latest (alias)",        tierHint: "fast",   notes: "🔄 Resuelve al flash-lite más reciente" },
    { id: "gemini-pro-latest",                      label: "Gemini Pro Latest (alias)",               tierHint: "smart",  notes: "🔄 Resuelve al pro más reciente" },
  ],
  xai: [
    { id: "grok-3", label: "Grok 3", tierHint: "genius", notes: "Flagship model June 2026, highest reasoning" },
    { id: "grok-3-fast", label: "Grok 3 Fast", tierHint: "smart", notes: "Balanced Grok 3 performance" },
    { id: "grok-3-mini", label: "Grok 3 Mini", tierHint: "fast", notes: "Lightweight Grok 3 for quick tasks" },
    { id: "grok-3-mini-fast", label: "Grok 3 Mini Fast", tierHint: "fast", notes: "Fastest Grok 3 mini variant" },
    { id: "grok-2-1212", label: "Grok 2", tierHint: "smart", notes: "Stable Grok 2 flagship" },
    { id: "grok-2-vision-1212", label: "Grok 2 Vision", tierHint: "vision", notes: "Multimodal Grok 2 with vision support" },
    { id: "grok-vision-beta", label: "Grok Vision Beta", tierHint: "vision", notes: "Experimental vision capabilities" },
  ],
};
