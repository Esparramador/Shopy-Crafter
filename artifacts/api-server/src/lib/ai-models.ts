/**
 * AI Model Registry & Tier Selection
 * ----------------------------------
 * Selects the right Claude / Gemini model per task tier WITHOUT hardcoding
 * model names anywhere in the app. Three layers (priority order):
 *   1. Explicit override passed to the call (`opts.model`).
 *   2. DB override stored in `platform_settings` table (admin can change live).
 *   3. ENV defaults (CLAUDE_MODEL_*, GEMINI_MODEL_*).
 *   4. Hard fallback (latest known June-2026 stable models).
 *
 * Tiers:
 *   - "fast"   → cheap & quick (Haiku 4.5 / Gemini 3.5 Flash)
 *   - "smart"  → balanced default (Sonnet 4.6 / Gemini 3.1 Pro Preview)
 *   - "genius" → max reasoning (Opus 4.8 / Gemini 3.1 Pro Preview)
 *   - "vision" → multimodal-strong (Sonnet 4.6 vision / Gemini 3.1 Pro Preview)
 *
 * Cached for 60s so live admin changes propagate quickly without DB hammering.
 */
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";

export type AITier = "fast" | "smart" | "genius" | "vision";
export type AIProvider = "claude" | "gemini";

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
    fast: "gemini-3.5-flash",
    smart: "gemini-3.1-pro-preview",
    genius: "gemini-3.1-pro-preview",
    vision: "gemini-3.1-pro-preview",
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
      for (const p of ["claude", "gemini"] as AIProvider[]) {
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
 * Resolves the actual model name for a given provider + tier.
 * Override chain: explicit arg → DB setting → env var → hard default.
 */
export async function pickModel(provider: AIProvider, tier: AITier = "smart", override?: string): Promise<string> {
  if (override && typeof override === "string" && override.trim().length > 0) {
    return override.trim();
  }
  const settings = await loadSettingsFromDb();
  const dbVal = settings.get(SETTINGS_KEYS[provider][tier]);
  if (dbVal) return dbVal;
  const envKey = ENV_KEYS[provider][tier];
  const envVal = process.env[envKey];
  if (envVal && envVal.trim().length > 0) return envVal.trim();
  return HARD_DEFAULTS[provider][tier];
}

/** Sync version for hot paths. Honors DB overrides via the in-memory snapshot
 *  (refreshed every 60s + immediately after each `setAIModelOverride`).
 *  Falls back to ENV → hard default. */
export function pickModelSync(provider: AIProvider, tier: AITier = "smart"): string {
  const snapVal = snapshot.get(SETTINGS_KEYS[provider][tier]);
  if (snapVal) return snapVal;
  const envKey = ENV_KEYS[provider][tier];
  const envVal = process.env[envKey];
  if (envVal && envVal.trim().length > 0) return envVal.trim();
  return HARD_DEFAULTS[provider][tier];
}

export interface AIModelMatrix {
  claude: Record<AITier, { current: string; default: string; envKey: string; settingsKey: string; source: "override" | "db" | "env" | "default" }>;
  gemini: Record<AITier, { current: string; default: string; envKey: string; settingsKey: string; source: "override" | "db" | "env" | "default" }>;
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
  return { claude: build("claude"), gemini: build("gemini") };
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
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tierHint: "fast", notes: "Cheapest, fast, good for classification & extraction" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tierHint: "smart", notes: "Best balance — default for most tasks (vision-capable)" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", tierHint: "genius", notes: "Highest reasoning, latest Opus, slowest, most expensive" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", tierHint: "genius", notes: "High reasoning, alternative to Opus 4.8" },
    { id: "claude-fable-5", label: "Claude Fable 5", tierHint: "genius", notes: "Creative storytelling & long-form generation" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (legacy)", tierHint: "smart" },
    { id: "claude-opus-4-1", label: "Claude Opus 4.1 (legacy)", tierHint: "genius" },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (legacy May-2025)", tierHint: "smart" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude Sonnet 3.5 (legacy)", tierHint: "smart" },
  ],
  gemini: [
    { id: "gemini-3.5-flash",          label: "Gemini 3.5 Flash",              tierHint: "fast",   notes: "Latest flash — fastest & cheapest, June 2026" },
    { id: "gemini-3.1-pro-preview",    label: "Gemini 3.1 Pro Preview",        tierHint: "genius", notes: "Latest pro — top reasoning, default smart/genius" },
    { id: "gemini-3-pro-preview",      label: "Gemini 3 Pro Preview",          tierHint: "smart",  notes: "Gemini 3 pro — solid reasoning, slightly cheaper" },
    { id: "gemini-3.1-flash-image",    label: "Gemini 3.1 Flash Image",        tierHint: "vision", notes: "Image generation/edit — latest stable image model" },
    { id: "gemini-3-pro-image",        label: "Gemini 3 Pro Image",            tierHint: "vision", notes: "Pro-quality image generation (Nano-Banana v2)" },
    { id: "gemini-2.5-flash-image",    label: "Gemini 2.5 Flash Image (NB v1)",tierHint: "vision", notes: "Image generation — fast/cheap (Nano-Banana v1)" },
    { id: "gemini-2.5-flash",          label: "Gemini 2.5 Flash (legacy)",     tierHint: "fast" },
    { id: "gemini-2.5-pro",            label: "Gemini 2.5 Pro (legacy)",       tierHint: "smart" },
  ],
};
