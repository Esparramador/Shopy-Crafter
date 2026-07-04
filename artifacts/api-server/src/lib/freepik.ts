/**
 * Freepik AI API — integración completa
 * Docs: https://docs.freepik.com/api/ai
 * Auth: x-freepik-api-key header
 * Env: FREEPIK_API_KEY
 *
 * Freepik actúa como AGREGADOR de motores:
 *  - Mystic       → motor propio Freepik
 *  - Flux Dev/Pro → Black Forest Labs
 *  - Kling        → Kuaishou (vídeo)
 *  - Hailuo       → MiniMax (vídeo)
 *  - + otros según disponibilidad en su plataforma
 *
 * Principio: NO hardcodear nada; la plataforma detecta engines disponibles
 * vía getFreepikEngines() y actualiza el catálogo dinámicamente.
 */

const BASE = "https://api.freepik.com/v1";

function getKey(): string {
  const k = process.env.FREEPIK_API_KEY;
  if (!k) throw new Error("FREEPIK_API_KEY no configurada en variables de entorno");
  return k;
}

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export interface FreepikImageOptions {
  prompt: string;
  negative_prompt?: string;
  num_images?: number;
  width?: number;
  height?: number;
  aspect_ratio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "3:2" | "2:3" | "4:5" | "5:4" | "21:9";
  model?: string;
  style?: string;
  color?: string;
  lighting?: string;
  framing?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
  strength?: number;
}

export interface FreepikImageResult {
  base64: string;
  mimeType: string;
  seed?: number;
  has_nsfw?: boolean;
}

export interface FreepikVideoOptions {
  prompt: string;
  negative_prompt?: string;
  image_url?: string;
  image_tail_url?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  duration?: 5 | 10;
  engine?: string;
}

export interface FreepikVideoTask {
  task_id?: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  progress?: number;
  error?: string;
}

export interface FreepikEngine {
  id: string;
  name: string;
  category: "image" | "video" | "audio" | "edit" | "upscale" | "search";
  provider: string;
  cost_tier: "economy" | "balanced" | "quality";
  capabilities: string[];
  api_endpoint: string;
}

// ─── RESOLUCIÓN DE TAMAÑO ─────────────────────────────────────────────────────

function resolveSize(opts: Pick<FreepikImageOptions, "width" | "height" | "aspect_ratio">): { width: number; height: number } {
  if (opts.width && opts.height) return { width: opts.width, height: opts.height };
  if (opts.aspect_ratio) {
    const [w, h] = opts.aspect_ratio.split(":").map(Number);
    const base = 1024;
    const maxDim = Math.max(w, h);
    const width = Math.round((base * w) / maxDim / 64) * 64;
    const height = Math.round((base * h) / maxDim / 64) * 64;
    return { width, height };
  }
  return { width: 1024, height: 1024 };
}

// ─── GENERACIÓN DE IMAGEN T2I ────────────────────────────────────────────────

export async function generateFreepikImage(opts: FreepikImageOptions): Promise<FreepikImageResult[]> {
  const key = getKey();
  const { width, height } = resolveSize(opts);

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    num_images: opts.num_images ?? 1,
    image: { size: { width, height } },
  };

  if (opts.model)                  body.model = opts.model;
  if (opts.negative_prompt)        body.negative_prompt = opts.negative_prompt;
  if (opts.guidance_scale != null) body.guidance_scale = opts.guidance_scale;
  if (opts.num_inference_steps)    body.num_inference_steps = opts.num_inference_steps;
  if (opts.seed != null)           body.seed = opts.seed;

  const styling: Record<string, string> = {};
  if (opts.style)    styling.style    = opts.style;
  if (opts.color)    styling.color    = opts.color;
  if (opts.lighting) styling.lightning = opts.lighting;
  if (opts.framing)  styling.framing  = opts.framing;
  if (Object.keys(styling).length) body.styling = styling;

  const res = await fetch(`${BASE}/ai/text-to-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-freepik-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Freepik T2I ${res.status}: ${err.slice(0, 400)}`);
  }

  const data = await res.json() as {
    data: Array<{ base64: string; content_type?: string; has_nsfw?: boolean }>;
    meta?: { seed?: number };
  };

  return data.data.map(img => ({
    base64: img.base64,
    mimeType: img.content_type ?? "image/jpeg",
    seed: data.meta?.seed,
    has_nsfw: img.has_nsfw,
  }));
}

// ─── IMAGEN A IMAGEN ──────────────────────────────────────────────────────────

export async function freepikImageToImage(opts: FreepikImageOptions & { imageBase64: string }): Promise<FreepikImageResult[]> {
  const key = getKey();
  const { width, height } = resolveSize(opts);

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    image: { base64: opts.imageBase64, size: { width, height } },
    strength: opts.strength ?? 0.7,
    num_images: opts.num_images ?? 1,
  };
  if (opts.negative_prompt) body.negative_prompt = opts.negative_prompt;
  if (opts.seed != null)    body.seed = opts.seed;

  const res = await fetch(`${BASE}/ai/image-to-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-freepik-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Freepik I2I ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json() as { data: Array<{ base64: string }> };
  return data.data.map(img => ({ base64: img.base64, mimeType: "image/jpeg" }));
}

// ─── UPSCALER 4× ─────────────────────────────────────────────────────────────

export async function upscaleFreepikImage(imageBase64: string, mimeType = "image/jpeg"): Promise<string> {
  const key = getKey();
  const ext = mimeType.split("/")[1] ?? "jpg";
  const binary = Buffer.from(imageBase64, "base64");
  const blob = new Blob([binary], { type: mimeType });
  const form = new FormData();
  form.append("image", blob, `image.${ext}`);

  const res = await fetch(`${BASE}/ai/image-upscaler`, {
    method: "POST",
    headers: { "x-freepik-api-key": key },
    body: form as unknown as BodyInit,
  });

  if (!res.ok) throw new Error(`Freepik Upscaler ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json() as { data: { base64: string } };
  return data.data.base64;
}

// ─── RECOLOR ──────────────────────────────────────────────────────────────────

export async function recolorFreepikImage(imageBase64: string, prompt: string): Promise<FreepikImageResult[]> {
  const key = getKey();
  const body = { prompt, image: { base64: imageBase64 } };

  const res = await fetch(`${BASE}/ai/recolor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-freepik-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Freepik Recolor ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json() as { data: Array<{ base64: string }> };
  return data.data.map(img => ({ base64: img.base64, mimeType: "image/jpeg" }));
}

// ─── ELIMINAR FONDO ───────────────────────────────────────────────────────────

export async function removeFreepikBackground(imageBase64: string, mimeType = "image/jpeg"): Promise<string> {
  const key = getKey();
  const ext = mimeType.split("/")[1] ?? "jpg";
  const binary = Buffer.from(imageBase64, "base64");
  const blob = new Blob([binary], { type: mimeType });
  const form = new FormData();
  form.append("image", blob, `image.${ext}`);

  const res = await fetch(`${BASE}/ai/background-removal`, {
    method: "POST",
    headers: { "x-freepik-api-key": key },
    body: form as unknown as BodyInit,
  });

  if (!res.ok) throw new Error(`Freepik BG Removal ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json() as { data: { base64: string } };
  return data.data.base64;
}

// ─── EXPAND / OUTPAINTING ─────────────────────────────────────────────────────

export async function expandFreepikImage(opts: {
  imageBase64: string;
  prompt?: string;
  width: number;
  height: number;
  top?: number; bottom?: number; left?: number; right?: number;
}): Promise<string> {
  const key = getKey();
  const body: Record<string, unknown> = {
    image: { base64: opts.imageBase64 },
    target: { width: opts.width, height: opts.height },
  };
  if (opts.prompt) body.prompt = opts.prompt;

  const margins: Record<string, number> = {};
  if (opts.top    != null) margins.top    = opts.top;
  if (opts.bottom != null) margins.bottom = opts.bottom;
  if (opts.left   != null) margins.left   = opts.left;
  if (opts.right  != null) margins.right  = opts.right;
  if (Object.keys(margins).length) body.margins = margins;

  const res = await fetch(`${BASE}/ai/image-expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-freepik-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Freepik Expand ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json() as { data: { base64: string } };
  return data.data.base64;
}

// ─── MODELO VIRTUAL (fashion / avatar) ───────────────────────────────────────

export async function freepikVirtualModel(opts: {
  faceImageBase64: string;
  garmentImageBase64?: string;
  prompt: string;
  num_images?: number;
}): Promise<FreepikImageResult[]> {
  const key = getKey();
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    num_images: opts.num_images ?? 1,
    face_image: { base64: opts.faceImageBase64 },
  };
  if (opts.garmentImageBase64) body.garment_image = { base64: opts.garmentImageBase64 };

  const res = await fetch(`${BASE}/ai/virtual-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-freepik-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Freepik Virtual Model ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json() as { data: Array<{ base64: string }> };
  return data.data.map(img => ({ base64: img.base64, mimeType: "image/jpeg" }));
}

// ─── GENERACIÓN DE VÍDEO (Freepik agrega Kling, Hailuo, etc.) ────────────────

// Engine name → model-specific Freepik endpoint path (POST + poll GET /<path>/<taskId>)
// Source: docs.freepik.com/api-reference/video — verified July 2026
const FREEPIK_ENGINE_ENDPOINT: Record<string, string> = {
  "kling-2":         "/ai/video/kling-v3-std",
  "kling-1.5":       "/ai/video/kling-v3-std",
  "kling-pro":       "/ai/video/kling-v3-pro",
  "kling-v3-std":    "/ai/video/kling-v3-std",
  "kling-v3-pro":    "/ai/video/kling-v3-pro",
  "kling-v3-omni":   "/ai/video/kling-v3-omni",
  "hailuo-02":       "/ai/video/hailuo-video-02",
  "hailuo":          "/ai/video/hailuo-video-02",
};

// Track taskId → endpoint path for correct polling (model-specific poll URL)
const _freepikTaskPollPath = new Map<string, string>();

export async function generateFreepikVideoTask(opts: FreepikVideoOptions): Promise<string> {
  const key = getKey();

  const specificPath = opts.engine ? FREEPIK_ENGINE_ENDPOINT[opts.engine] : undefined;
  const apiPath = specificPath ?? (opts.image_url ? "/ai/image-to-video" : "/ai/text-to-video");

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: opts.aspect_ratio ?? "16:9",
    duration: opts.duration ?? 5,
  };
  if (opts.negative_prompt) body.negative_prompt = opts.negative_prompt;
  if (opts.image_url)       body.image_url  = opts.image_url;
  if (opts.image_tail_url)  body.image_tail_url = opts.image_tail_url;
  if (opts.engine && !specificPath) body.engine = opts.engine;

  const res = await fetch(`${BASE}${apiPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-freepik-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Freepik Video ${res.status}: ${(await res.text()).slice(0, 400)}`);

  const data = await res.json() as { data: { task_id?: string; video_url?: string } };
  if (data.data.video_url) return data.data.video_url;
  if (data.data.task_id) {
    _freepikTaskPollPath.set(data.data.task_id, apiPath);
    return data.data.task_id;
  }
  throw new Error("Freepik Video: respuesta inesperada");
}

export async function pollFreepikVideoTask(taskId: string, timeoutMs = 10 * 60_000): Promise<string> {
  const key = getKey();
  const start = Date.now();
  const pollPath = _freepikTaskPollPath.get(taskId) ?? "/ai/video/kling-v3-std";

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const res = await fetch(`${BASE}${pollPath}/${taskId}`, {
        headers: { "x-freepik-api-key": key },
      });
      if (!res.ok) continue;
      const data = await res.json() as FreepikVideoTask;
      if (data.status === "completed" && data.video_url) {
        _freepikTaskPollPath.delete(taskId);
        return data.video_url;
      }
      if (data.status === "failed") throw new Error(`Freepik video task falló (${taskId}): ${data.error ?? "sin detalles"}`);
    } catch (err: unknown) {
      if (String((err as Error).message).includes("falló")) throw err;
    }
  }
  throw new Error(`Freepik video timeout (>${Math.round(timeoutMs / 60000)} min) — task: ${taskId}`);
}

// ─── BÚSQUEDA EN STOCK DE FREEPIK ────────────────────────────────────────────

export async function searchFreepikStock(query: string, opts: {
  type?: "photo" | "vector" | "psd" | "icon" | "video";
  limit?: number;
  page?: number;
  orientation?: "horizontal" | "vertical" | "square";
  color?: string;
} = {}): Promise<Array<{ id: string; url: string; thumb: string; title: string; premium: boolean; type: string }>> {
  const key = getKey();
  const params = new URLSearchParams({
    term:  query,
    limit: String(opts.limit ?? 20),
    page:  String(opts.page  ?? 1),
  });
  if (opts.type)        params.set("filters[content_type]", opts.type);
  if (opts.orientation) params.set("filters[orientation]",  opts.orientation);
  if (opts.color)       params.set("filters[color]",        opts.color);

  const res = await fetch(`${BASE}/resources?${params}`, {
    headers: { "x-freepik-api-key": key, Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Freepik Search ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json() as {
    data: Array<{
      id: number;
      type: string;
      title?: string;
      is_premium: boolean;
      image?: { source?: { url: string } };
      thumbnails?: Array<{ url: string }>;
    }>;
  };

  return data.data.map(r => ({
    id:      String(r.id),
    url:     r.image?.source?.url ?? "",
    thumb:   r.thumbnails?.[0]?.url ?? "",
    title:   r.title ?? "",
    premium: r.is_premium,
    type:    r.type,
  }));
}

// ─── CATÁLOGO DINÁMICO DE ENGINES ────────────────────────────────────────────
// Freepik agrega motores de terceros — devuelve la lista completa de engines
// disponibles en la cuenta (sin hardcodear).

export async function getFreepikEngines(): Promise<FreepikEngine[]> {
  const key = getKey();
  try {
    const res = await fetch(`${BASE}/ai/engines`, {
      headers: { "x-freepik-api-key": key, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json() as { data?: FreepikEngine[] };
      if (Array.isArray(data.data) && data.data.length > 0) return data.data;
    }
  } catch {
    // fallback silencioso
  }

  // Fallback: engines conocidos como base — se actualizará con el sistema de inteligencia
  return [
    { id: "freepik-mystic",      name: "Mystic",                    category: "image",   provider: "freepik",         cost_tier: "economy",  capabilities: ["t2i", "style-control"],                   api_endpoint: "/ai/text-to-image" },
    { id: "freepik-flux-dev",    name: "Flux Dev",                  category: "image",   provider: "black-forest-labs", cost_tier: "balanced", capabilities: ["t2i", "high-quality"],                  api_endpoint: "/ai/text-to-image" },
    { id: "freepik-upscaler",    name: "AI Upscaler 4×",            category: "upscale", provider: "freepik",         cost_tier: "economy",  capabilities: ["upscale-4x"],                             api_endpoint: "/ai/image-upscaler" },
    { id: "freepik-recolor",     name: "AI Recolor",                category: "edit",    provider: "freepik",         cost_tier: "economy",  capabilities: ["recolor", "color-palette"],                api_endpoint: "/ai/recolor" },
    { id: "freepik-bg-removal",  name: "Background Removal",        category: "edit",    provider: "freepik",         cost_tier: "economy",  capabilities: ["background-removal", "transparent-png"],   api_endpoint: "/ai/background-removal" },
    { id: "freepik-expand",      name: "Image Expand / Outpaint",   category: "edit",    provider: "freepik",         cost_tier: "economy",  capabilities: ["outpainting", "expand"],                   api_endpoint: "/ai/image-expand" },
    { id: "freepik-i2i",         name: "Image to Image",            category: "image",   provider: "freepik",         cost_tier: "balanced", capabilities: ["i2i", "style-transfer"],                   api_endpoint: "/ai/image-to-image" },
    { id: "freepik-virtual-model", name: "Virtual Fashion Model",   category: "image",   provider: "freepik",         cost_tier: "quality",  capabilities: ["virtual-tryon", "fashion", "avatar"],      api_endpoint: "/ai/virtual-model" },
    { id: "freepik-t2v-kling",   name: "Text to Video · Kling",     category: "video",   provider: "kling",           cost_tier: "quality",  capabilities: ["t2v", "kling", "character-reference"],     api_endpoint: "/ai/text-to-video" },
    { id: "freepik-i2v-kling",   name: "Image to Video · Kling",    category: "video",   provider: "kling",           cost_tier: "quality",  capabilities: ["i2v", "kling"],                            api_endpoint: "/ai/image-to-video" },
    { id: "freepik-t2v-hailuo",  name: "Text to Video · Hailuo",    category: "video",   provider: "hailuo",          cost_tier: "quality",  capabilities: ["t2v", "hailuo", "minimax"],                api_endpoint: "/ai/text-to-video" },
    { id: "freepik-i2v-hailuo",  name: "Image to Video · Hailuo",   category: "video",   provider: "hailuo",          cost_tier: "quality",  capabilities: ["i2v", "hailuo"],                           api_endpoint: "/ai/image-to-video" },
    { id: "freepik-search",      name: "Stock Search (Freepik lib)", category: "search",  provider: "freepik",         cost_tier: "economy",  capabilities: ["photo", "vector", "psd", "icon", "video"], api_endpoint: "/resources" },
  ];
}

export function isFreepikAvailable(): boolean {
  return !!process.env.FREEPIK_API_KEY;
}
