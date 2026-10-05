/**
 * Proveedores de vídeo del Ad Studio (producto → anuncio).
 *
 * Solo modelos verificados (oct-2026): ID, parámetros y precio comprobados en la
 * documentación pública de cada proveedor. El catálogo anterior anunciaba
 * modelos inexistentes (p. ej. "Veo 4") o con IDs/parámetros incorrectos
 * (Runway "gen4_5_turbo", Hailuo con duraciones que la API rechaza).
 *
 * Precios (USD):
 *  - Runway API: 1 crédito = 0,01 $. gen4_turbo 5 créd/s, gen4.5 12 créd/s.
 *  - Kling 3.0 (kwaivgi/kling-v3-video): standard 0,084 $/s (0,126 con audio),
 *    pro 0,112 $/s (0,168 con audio). Se presupuesta con audio (cota superior).
 *  - Hailuo 2.3 (minimax/hailuo-2.3): 768p 6 s 0,28 · 10 s 0,56 · 1080p 6 s 0,49.
 *    Hailuo 2.3 Fast: 0,19 · 0,32 · 0,33.
 */

export type AdAspect = "9:16" | "16:9" | "1:1" | "4:5";

export type AdVideoProviderKey =
  | "runway-gen4.5"
  | "runway-gen4-turbo"
  | "kling-v3-pro"
  | "kling-v3-std"
  | "hailuo-2.3"
  | "hailuo-2.3-fast";

export interface AdVideoProvider {
  key: AdVideoProviderKey;
  label: string;
  vendor: "runway" | "replicate";
  modelId: string;
  tier: "premium" | "standard" | "economy";
  quality: number;
  description: string;
  /** Duraciones que acepta la API (s). */
  durations: number[];
  /** Formatos que el modelo genera de forma nativa. El resto se recorta después. */
  nativeAspects: AdAspect[];
}

export const AD_VIDEO_PROVIDERS: Record<AdVideoProviderKey, AdVideoProvider> = {
  "runway-gen4.5": {
    key: "runway-gen4.5", label: "Runway Gen-4.5", vendor: "runway", modelId: "gen4.5",
    tier: "premium", quality: 10,
    description: "Máximo realismo y movimiento de cámara de Runway. Imagen → vídeo.",
    durations: [5, 8, 10], nativeAspects: ["9:16", "16:9", "1:1"],
  },
  "kling-v3-pro": {
    key: "kling-v3-pro", label: "Kling 3.0 Pro (1080p)", vendor: "replicate", modelId: "kwaivgi/kling-v3-video",
    tier: "premium", quality: 10,
    description: "Kling 3.0 en modo pro: 1080p, muy buena física y fidelidad al producto.",
    durations: [5, 8, 10], nativeAspects: ["9:16", "16:9", "1:1"],
  },
  "kling-v3-std": {
    key: "kling-v3-std", label: "Kling 3.0 Standard (720p)", vendor: "replicate", modelId: "kwaivgi/kling-v3-video",
    tier: "standard", quality: 9,
    description: "Kling 3.0 en modo estándar: 720p, misma calidad de movimiento a menor coste.",
    durations: [5, 8, 10], nativeAspects: ["9:16", "16:9", "1:1"],
  },
  "hailuo-2.3": {
    key: "hailuo-2.3", label: "Hailuo 2.3", vendor: "replicate", modelId: "minimax/hailuo-2.3",
    tier: "standard", quality: 8,
    description: "MiniMax Hailuo 2.3: 1080p en 6 s (768p en 10 s). Movimiento natural.",
    durations: [6, 10], nativeAspects: ["9:16", "16:9", "1:1", "4:5"],
  },
  "runway-gen4-turbo": {
    key: "runway-gen4-turbo", label: "Runway Gen-4 Turbo", vendor: "runway", modelId: "gen4_turbo",
    tier: "economy", quality: 8,
    description: "Rápido y económico. Bueno para probar ángulos antes de la versión final.",
    durations: [5, 10], nativeAspects: ["9:16", "16:9", "1:1"],
  },
  "hailuo-2.3-fast": {
    key: "hailuo-2.3-fast", label: "Hailuo 2.3 Fast", vendor: "replicate", modelId: "minimax/hailuo-2.3-fast",
    tier: "economy", quality: 7,
    description: "La opción más barata: 1080p en 6 s (768p en 10 s). Ideal para bocetos y A/B.",
    durations: [6, 10], nativeAspects: ["9:16", "16:9", "1:1", "4:5"],
  },
};

/** Claves antiguas guardadas en borradores, vídeos virales o el cerebro → equivalente real. */
const LEGACY_ALIASES: Record<string, AdVideoProviderKey> = {
  "replicate-kling-master": "kling-v3-pro",
  "replicate-kling-2.5-turbo": "kling-v3-std",
  "replicate-kling": "kling-v3-std",
  "kling-3.0-omni": "kling-v3-pro",
  "replicate-hailuo": "hailuo-2.3",
};

export function resolveAdVideoProvider(key: string | undefined | null): AdVideoProvider | null {
  if (!key) return null;
  const k = (key in AD_VIDEO_PROVIDERS ? key : LEGACY_ALIASES[key]) as AdVideoProviderKey | undefined;
  return k ? AD_VIDEO_PROVIDERS[k] : null;
}

/** Duración válida más cercana a la pedida (la API rechaza las demás). */
export function effectiveDuration(p: AdVideoProvider, requestedSec: number): number {
  const req = Number.isFinite(requestedSec) ? requestedSec : p.durations[0];
  return p.durations.reduce((best, d) => (Math.abs(d - req) < Math.abs(best - req) ? d : best), p.durations[0]);
}

/** Hailuo solo da 1080p en clips de 6 s. */
export function hailuoResolution(durationSec: number): "1080p" | "768p" {
  return durationSec <= 6 ? "1080p" : "768p";
}

const HAILUO_PRICES: Record<"hailuo-2.3" | "hailuo-2.3-fast", { "1080p-6": number; "768p-10": number }> = {
  "hailuo-2.3": { "1080p-6": 0.49, "768p-10": 0.56 },
  "hailuo-2.3-fast": { "1080p-6": 0.33, "768p-10": 0.32 },
};

/** Coste en USD del clip de vídeo (cota superior). */
export function videoCostUsd(p: AdVideoProvider, requestedSec: number): number {
  const d = effectiveDuration(p, requestedSec);
  switch (p.key) {
    case "runway-gen4.5": return d * 0.12;
    case "runway-gen4-turbo": return d * 0.05;
    case "kling-v3-pro": return d * 0.168;
    case "kling-v3-std": return d * 0.126;
    case "hailuo-2.3":
    case "hailuo-2.3-fast":
      return d <= 6 ? HAILUO_PRICES[p.key]["1080p-6"] : HAILUO_PRICES[p.key]["768p-10"];
  }
}

/** Resto de la pieza por anuncio, en USD: imagen Nano Banana (≤0,04), escena con
 *  producto real (otra imagen), voz + música ElevenLabs (cota 0,12). */
const IMAGE_USD = 0.04;
const AUDIO_USD = 0.12;
const USD_TO_EUR = 0.92;

export function adCostUsd(p: AdVideoProvider, requestedSec: number, opts: { images?: number } = {}): number {
  return videoCostUsd(p, requestedSec) + (opts.images ?? 1) * IMAGE_USD + AUDIO_USD;
}

/**
 * Créditos de imagen que cuesta un anuncio. Los anuncios gastan la cuota de
 * imágenes del plan, que está calculada a IMAGE_UNIT_COST_EUR por crédito: se
 * cobran tantos créditos como imágenes costaría lo mismo, para que ningún plan
 * pierda dinero con vídeo (antes eran 6 fijos ≈ 0,22 € aunque costara 1,8 €).
 */
export function adCredits(p: AdVideoProvider, requestedSec: number, imageUnitCostEur: number, opts: { images?: number } = {}): number {
  const eur = adCostUsd(p, requestedSec, opts) * USD_TO_EUR;
  return Math.max(1, Math.ceil(eur / imageUnitCostEur));
}

/** Créditos de imagen equivalentes a un coste en USD (misma regla que adCredits). */
export function creditsForUsd(usd: number, imageUnitCostEur: number): number {
  return Math.max(1, Math.ceil((usd * USD_TO_EUR) / imageUnitCostEur));
}

/** Ratio de Runway para cada formato (4:5 no existe: se genera 3:4 y se recorta). */
export const RUNWAY_RATIOS: Record<AdAspect, string> = {
  "9:16": "720:1280",
  "16:9": "1280:720",
  "1:1": "960:960",
  "4:5": "832:1104",
};

/** Formato a pedir al modelo: el nativo si existe; si no, el más cercano para recortar después. */
export function generationAspect(p: AdVideoProvider, target: AdAspect): AdAspect {
  if (p.nativeAspects.includes(target)) return target;
  return target === "4:5" ? (p.nativeAspects.includes("9:16") ? "9:16" : "1:1") : target;
}

/** Parámetros de entrada de Replicate para cada modelo. */
export function replicateInput(
  p: AdVideoProvider,
  o: { prompt: string; negativePrompt: string; imageDataUri: string; requestedSec: number; aspect: AdAspect },
): Record<string, unknown> {
  const duration = effectiveDuration(p, o.requestedSec);
  if (p.key === "kling-v3-pro" || p.key === "kling-v3-std") {
    return {
      prompt: o.prompt,
      negative_prompt: o.negativePrompt,
      start_image: o.imageDataUri,
      duration,
      aspect_ratio: generationAspect(p, o.aspect),
      mode: p.key === "kling-v3-pro" ? "pro" : "standard",
      // La voz y la música se montan después; el audio del modelo se descarta.
      generate_audio: false,
    };
  }
  // Hailuo: el formato sale de la imagen inicial.
  return {
    prompt: o.prompt,
    first_frame_image: o.imageDataUri,
    duration,
    resolution: hailuoResolution(duration),
    prompt_optimizer: false,
  };
}

/** Recorte centrado para pasar de (w,h) al formato objetivo, con dimensiones pares. */
export function centerCropFor(w: number, h: number, target: AdAspect): { w: number; h: number; x: number; y: number } | null {
  const [a, b] = target.split(":").map(Number);
  const r = a / b;
  const cur = w / h;
  if (Math.abs(cur - r) < 0.01) return null;
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  if (cur > r) {
    const cw = even(h * r);
    return { w: cw, h: even(h), x: Math.floor((w - cw) / 2), y: 0 };
  }
  const ch = even(w / r);
  return { w: even(w), h: ch, x: 0, y: Math.floor((h - ch) / 2) };
}

/** Catálogo para la UI: precio y créditos reales para la duración pedida. */
export function listAdVideoProviders(requestedSec: number, imageUnitCostEur: number, images = 1) {
  return Object.values(AD_VIDEO_PROVIDERS).map(p => ({
    key: p.key,
    label: p.label,
    tier: p.tier,
    quality: p.quality,
    description: p.description,
    durations: p.durations,
    nativeAspects: p.nativeAspects,
    effectiveDurationSec: effectiveDuration(p, requestedSec),
    costPerAdEur: Math.round(adCostUsd(p, requestedSec, { images }) * USD_TO_EUR * 100) / 100,
    creditsPerAd: adCredits(p, requestedSec, imageUnitCostEur, { images }),
  }));
}
