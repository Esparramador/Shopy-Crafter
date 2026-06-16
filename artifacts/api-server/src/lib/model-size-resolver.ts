/**
 * model-size-resolver.ts
 *
 * Universal image-size picker for all AI generation providers.
 * Principle: never hardcode model-level size enums — fetch them from the
 * provider's schema API on first use and cache them 24 h in memory.
 *
 * Supported providers:
 *   openai    — gpt-image-1 / 1.5 / 1-mini (enum) · gpt-image-2 (free WxH)
 *   runway    — Gen4 / Gen4.5 (3 aspect-ratio buckets, "W:H" notation)
 *   xai       — Grok Imagine (aspect-ratio string, 1K or 2K output)
 *   gemini    — Imagen 4/5 via native Gemini API (free WxH, any ratio)
 *   replicate — any model: schema fetched live from api.replicate.com
 *               Falls back to pass-through (aspect_ratio string) when the
 *               model has no size/image_size enum (e.g. flux-1.1-pro-ultra).
 */

export interface SizeResult {
  w: number;
  h: number;
  /**
   * The size string exactly as the provider API expects it.
   * e.g. "1280x832" (Replicate), "1920:1080" (Runway), "16:9" (xAI)
   */
  sizeString: string;
  /** Absolute ratio error (0 = perfect match) */
  error: number;
}

// ── Cache (in-memory, 24 h TTL) ─────────────────────────────────────────────
interface CacheEntry { sizes: Array<[number, number]>; expires: number }
const SCHEMA_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "W:H", "WxH", "W×H" → ratio float */
export function parseRatioString(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)[:/x×](\d+(?:\.\d+)?)$/i);
  if (m) return parseFloat(m[1]) / parseFloat(m[2]);
  return 1;
}

/** Pick the enum entry whose W/H ratio is closest to targetRatio */
function closestEnum(sizes: Array<[number, number]>, targetRatio: number): SizeResult {
  if (!sizes || sizes.length === 0) {
    return { w: 0, h: 0, sizeString: "1024x1024", error: Infinity };
  }
  let best = sizes[0], bestDiff = Infinity;
  for (const [w, h] of sizes) {
    const diff = Math.abs(w / h - targetRatio);
    if (diff < bestDiff) { bestDiff = diff; best = [w, h]; }
  }
  return { w: best[0], h: best[1], sizeString: `${best[0]}x${best[1]}`, error: bestDiff };
}

/**
 * Compute exact WxH for providers that accept free resolution.
 * Keeps total pixels ≤ maxPixels and aligns dimensions to `step`.
 */
function freeResolution(
  targetRatio: number,
  maxPixels: number,
  step = 16,
  fmt: (w: number, h: number) => string = (w, h) => `${w}x${h}`,
): SizeResult {
  let w = Math.round(Math.sqrt(maxPixels * targetRatio) / step) * step;
  let h = Math.round(w / targetRatio / step) * step;
  while (w * h > maxPixels * 1.05) { w -= step; h = Math.round(w / targetRatio / step) * step; }
  w = Math.max(w, step);
  h = Math.max(h, step);
  return { w, h, sizeString: fmt(w, h), error: Math.abs(w / h - targetRatio) };
}

// ── Replicate schema fetcher ─────────────────────────────────────────────────

async function fetchReplicateEnumSizes(
  replicateId: string,
  token: string,
): Promise<Array<[number, number]> | null> {
  const [owner, name] = replicateId.split("/");
  if (!owner || !name) return null;
  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    // Schema can be nested under latest_version or directly on the model
    const schema =
      data?.latest_version?.openapi_schema ??
      data?.openapi_schema;
    const inputProps: Record<string, any> =
      schema?.components?.schemas?.Input?.properties ?? {};

    // Check common size-field names in priority order
    for (const key of ["size", "image_size", "output_size", "resolution"]) {
      const prop = inputProps[key];
      if (!prop) continue;
      const enumVals: string[] = prop.enum ?? prop.allOf?.[0]?.enum ?? [];
      const parsed: Array<[number, number]> = [];
      for (const v of enumVals) {
        const m = String(v).match(/^(\d+)[x×](\d+)$/i);
        if (m) parsed.push([parseInt(m[1]), parseInt(m[2])]);
      }
      if (parsed.length > 0) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Provider constants ───────────────────────────────────────────────────────

// OpenAI gpt-image-1 / 1.5 / mini fixed enum
const GPT_IMAGE_STD_SIZES: Array<[number, number]> = [
  [1024, 1024],
  [1536, 1024],
  [1024, 1536],
];

// Runway Gen4 / Gen4.5 aspect buckets
const RUNWAY_SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1080, 1920],
  [1080, 1080],
];

// xAI supported aspect ratio strings (passed verbatim to the API)
const XAI_RATIOS: Array<[number, number]> = [
  [1, 1], [16, 9], [9, 16], [4, 3], [3, 4],
  [3, 2], [2, 3], [21, 9],
];

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns the best size/resolution for a given provider + model + aspect ratio.
 *
 * @param provider   "openai" | "runway" | "xai" | "gemini" | "replicate"
 * @param model      The model name / ID as used internally (e.g. "gpt-image-2")
 * @param aspect     Target aspect/resolution string: "16:9", "1920x1080", "3:2" …
 * @param opts.replicateId     Full Replicate model ID "owner/name"
 * @param opts.replicateToken  API token (needed for schema fetch)
 */
export async function pickBestImageSize(
  provider: string,
  model: string,
  aspect: string,
  opts: { replicateId?: string; replicateToken?: string } = {},
): Promise<SizeResult> {
  const ratio = parseRatioString(aspect);

  // ── OpenAI ────────────────────────────────────────────────────────────────
  if (provider === "openai") {
    if (model === "gpt-image-2") {
      // Flexible WxH: divisible by 16, ratio 1:3–3:1, ≤ ~1.5MP
      const clamped = Math.min(Math.max(ratio, 1 / 3), 3);
      return freeResolution(clamped, 1536 * 1024, 16);
    }
    return closestEnum(GPT_IMAGE_STD_SIZES, ratio);
  }

  // ── Runway ────────────────────────────────────────────────────────────────
  if (provider === "runway") {
    const r = closestEnum(RUNWAY_SIZES, ratio);
    return { ...r, sizeString: `${r.w}:${r.h}` };
  }

  // ── xAI / Grok ────────────────────────────────────────────────────────────
  if (provider === "xai") {
    let best = XAI_RATIOS[0], bestDiff = Infinity;
    for (const [w, h] of XAI_RATIOS) {
      const diff = Math.abs(w / h - ratio);
      if (diff < bestDiff) { bestDiff = diff; best = [w, h]; }
    }
    return { w: best[0], h: best[1], sizeString: `${best[0]}:${best[1]}`, error: bestDiff };
  }

  // ── Gemini / free-resolution ─────────────────────────────────────────────
  if (provider === "gemini") {
    return freeResolution(ratio, 2048 * 2048, 8);
  }

  // ── Replicate (dynamic schema) ────────────────────────────────────────────
  if (provider === "replicate" && opts.replicateId) {
    const cacheKey = opts.replicateId;
    const now = Date.now();
    const hit = SCHEMA_CACHE.get(cacheKey);

    if (hit && hit.expires > now) {
      if (hit.sizes.length === 0) return { w: 0, h: 0, sizeString: aspect, error: 0 };
      return closestEnum(hit.sizes, ratio);
    }

    // Fetch schema (only if token available)
    if (opts.replicateToken) {
      const sizes = await fetchReplicateEnumSizes(opts.replicateId, opts.replicateToken);
      if (sizes && sizes.length > 0) {
        SCHEMA_CACHE.set(cacheKey, { sizes, expires: now + CACHE_TTL });
        return closestEnum(sizes, ratio);
      }
      // No size enum found — model uses aspect_ratio string; pass through
      SCHEMA_CACHE.set(cacheKey, { sizes: [], expires: now + CACHE_TTL });
    }
    // Pass-through: return the aspect string as-is
    return { w: 0, h: 0, sizeString: aspect, error: 0 };
  }

  // Fallback pass-through
  return { w: 0, h: 0, sizeString: aspect, error: 0 };
}

/**
 * Convenience: invalidate a single model's cached schema.
 * Useful if you know a model's schema has changed.
 */
export function invalidateSizeCache(replicateId: string): void {
  SCHEMA_CACHE.delete(replicateId);
}
