/**
 * Fusion Studio Pro — biblioteca unificada de capacidades AI hipermodernas
 *
 * Provides access to:
 *   IMAGE GENERATION: Flux Pro/Dev/Schnell, Recraft V3, Ideogram V3, Imagen 4 (Replicate)
 *   IMAGE EDIT:       Nano Banana (Gemini 2.5 Flash Image), Flux Kontext, Runway Aleph
 *   IMAGE ENHANCE:    Real-ESRGAN, GFPGAN (faces), Clarity Upscaler, Magnific equivalent
 *   BACKGROUND:       Bria RMBG, BiRefNet (best quality bg removal)
 *   VIRTUAL TRY-ON:   IDM-VTON, CatVTON, OOTDiffusion (already integrated, expose more)
 *   VIDEO:            Runway Gen-4, Seedance Pro/Fast, Kling Master/2.1, Hailuo, Wan 2.5
 *   AUDIO:            ElevenLabs TTS, Voice Cloning (instant + professional), SFX, Music
 *   COMPOSITION:      FFmpeg complex graphs (lower thirds, captions, B-roll, transitions)
 *
 * All callable from routes/fusion-studio.ts as Pro endpoints.
 * Each capability records usage to plan-limits and feeds the ShopyBrain.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";
import { pickBestImageSize } from "./model-size-resolver.js";

// ─── HELPERS ───────────────────────────────────────────────────────────────

export async function makeTmpDir(prefix = "fs-pro"): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefix}-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

import { validateImageUrlAsync, generateVideoFromImage as runwayGenerateVideo } from "./runway.js";

export async function fetchToBuffer(url: string, timeoutMs = 180_000): Promise<Buffer> {
  // SECURITY (HIGH): SSRF guard with DNS resolution — rejects URLs pointing to
  // internal/private hosts AND blocks DNS-rebinding (attacker domain → private IP).
  await validateImageUrlAsync(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "error" });
    if (!r.ok) throw new Error(`Fetch ${url.slice(0, 80)} failed ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

function bufferToDataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function getReplicateToken(projectToken: string | undefined): string {
  return projectToken || process.env.REPLICATE_API_TOKEN || "";
}

async function replicateRunBuffer(
  modelId: string,
  input: any,
  token: string,
): Promise<Buffer> {
  if (!token) throw new Error("REPLICATE_API_TOKEN no configurado");
  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: token });
  const output = await rep.run(modelId as `${string}/${string}`, { input });
  const raw = Array.isArray(output) ? output[0] : output;
  // Replicate SDK puede devolver: string, URL instance, o FileOutput con .url() (que devuelve URL u object)
  let url: any;
  if (typeof raw === "string") url = raw;
  else if (raw && typeof (raw as any).url === "function") url = (raw as any).url();
  else if (raw && typeof (raw as any).url === "string") url = (raw as any).url;
  else if (raw && (raw as any).url instanceof URL) url = (raw as any).url;
  else throw new Error(`Replicate invalid output: ${String(raw).slice(0, 200)}`);
  // Normaliza URL/objeto a string
  if (url instanceof URL) url = url.href;
  else if (url && typeof url !== "string" && typeof (url as any).href === "string") url = (url as any).href;
  else if (url && typeof url !== "string") url = String(url);
  if (typeof url !== "string" || !url.startsWith("http")) {
    throw new Error(`Replicate invalid URL: ${typeof url === "string" ? url.slice(0, 200) : JSON.stringify(url).slice(0, 200)}`);
  }
  return await fetchToBuffer(url);
}

function getGeminiKey(): string {
  const k = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY no configurada");
  return k;
}

function getRunwayKey(): string {
  const k = process.env.RUNWAY_API_KEY;
  if (!k) throw new Error("RUNWAY_API_KEY no configurada");
  return k;
}

function getElevenKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY no configurada");
  return k;
}

function getXaiKey(): string {
  const k = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  if (!k) throw new Error("XAI_API_KEY no configurada — contacta al administrador");
  return k;
}

async function pollXaiVideo(requestId: string, apiKey: string, timeoutMs = 7 * 60_000): Promise<string> {
  if (!requestId) throw new Error("xAI video: request_id vacío — el modelo puede no existir en la API o la clave es inválida");
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 8_000));
    attempt++;
    let res: Response;
    try {
      res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (netErr: any) {
      logger.warn({ attempt, netErr: netErr?.message }, "xAI video poll: network error, reintentando");
      continue;
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.warn({ attempt, status: res.status, requestId, errBody: errBody.slice(0, 200) }, "xAI video poll: HTTP no-ok, reintentando");
      if (res.status === 404) throw new Error(`xAI video 404: requestId=${requestId} — el modelo "${requestId}" puede no existir en la API xAI`);
      continue;
    }
    const data = await res.json() as { status: string; video?: { url: string }; generations?: Array<{ url: string }> };
    // Soporte para ambas estructuras de respuesta de xAI
    const videoUrl = data.video?.url ?? data.generations?.[0]?.url;
    if (data.status === "done" || data.status === "succeeded") {
      if (videoUrl) return videoUrl;
      logger.warn({ attempt, data }, "xAI video: status=done pero sin URL de vídeo");
    }
    if (data.status === "expired") throw new Error("xAI video request expirado (>15 min en cola)");
    if (data.status === "failed") throw new Error(`xAI video falló. Modelo: ${requestId}`);
    logger.info({ attempt, status: data.status, requestId }, "xAI video: generando…");
  }
  throw new Error(`xAI video timeout (>${Math.round(timeoutMs / 60000)} min). El modelo puede estar sobrecargado.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 1: IMAGE GENERATION (text-to-image, multiple PRO models)
// ═══════════════════════════════════════════════════════════════════════════

export type ImageGenModel =
  | "flux-1.1-pro-ultra"        // 4MP photoreal, best Flux
  | "flux-1.1-pro-ultra-raw"    // 4MP raw mode (naturalistic, no AI sheen)
  | "flux-1.1-pro"              // standard pro Flux
  | "flux-schnell"              // fastest, cheap
  | "recraft-v4"                // Recraft V4 — última gen, texto nítido + realismo máximo
  | "recraft-v3"                // BEST for text on image (logos, posters)
  | "recraft-v3-svg"            // Recraft v3 SVG — vectorial real (logos, iconos)
  | "ideogram-v3-quality"       // Ideogram V3 Quality — máxima calidad texto + photoreal
  | "ideogram-v3-turbo"         // text + photoreal, rápido
  | "imagen-4-ultra"            // Google Imagen 4 Ultra (premium)
  | "imagen-4"                  // Google Imagen 4 (standard)
  | "imagen-4-fast"             // Google Imagen 4 Fast (cheap, quick)
  | "imagen-5-ultra"            // Google Imagen 5 Ultra — máxima calidad Google 2026
  | "imagen-5"                  // Google Imagen 5 — estándar 2026, superior al 4
  | "nano-banana"               // Gemini Flash Image — rápido, consistente con marca
  | "nano-banana-pro"           // Gemini Pro Image — 4K, texto nítido, identidad estable
  | "seedream-4"                // ByteDance Seedream 4 (text + photoreal)
  | "flux-kontext-pro"          // Flux Kontext Pro — character/style consistency
  | "flux-kontext-max"          // Flux Kontext Max — máxima calidad, consistencia premium
  | "flux-kontext-dev"          // Flux Kontext Dev — open-weights, edición artística
  | "stable-diffusion-3.5-large"  // Stability AI SD 3.5 Large — photoreal artístico
  | "stable-diffusion-3.5-turbo"  // Stability AI SD 3.5 Turbo — rápido y barato
  | "runway-gen4-image"         // Runway Gen4 Image — text-to-image nativo Runway
  | "runway-gen4-image-turbo"   // Runway Gen4 Image Turbo — más barato, alta velocidad
  | "gpt-image-1"              // OpenAI gpt-image-1 (vía Replit AI Integrations)
  | "gpt-image-2"              // OpenAI gpt-image-2 — flagship 2026, razonamiento integrado
  | "gpt-image-1.5"            // OpenAI gpt-image-1.5 — 20% más barato que v1, misma calidad
  | "gpt-image-1-mini"         // OpenAI gpt-image-1 mini — presupuesto, alta velocidad
  | "grok-imagine-image"        // xAI Grok Imagine — generación de imagen T2I ($0.02/img)
  | "grok-imagine-image-quality" // xAI Grok Imagine Quality — alta calidad ($0.05/img 1K, $0.07/img 2K)
  | "nvidia-flux-schnell"       // NVIDIA FLUX.1 Schnell — ultra rápido, 4 pasos, gratis en NIM
  | "nvidia-flux-dev"           // NVIDIA FLUX.1 Dev — alta calidad, 28 pasos, NVIDIA NIM
  | "nvidia-sdxl"               // NVIDIA SDXL Turbo — Stable Diffusion XL acelerado en GPU NVIDIA
  | "recraft-v3-svg"            // Recraft v3 SVG — vectorial real (logos, iconos)
  | "ideogram-v3-balanced"      // Ideogram V3 Balanced — buen balance velocidad/calidad
  | "imagen-4-fast"             // Google Imagen 4 Fast (cheap, quick)
  | "bytedance/seedream-3"     // ByteDance Seedream 3 — photoreal artístico
  | "freepik-mystic"            // Freepik Mystic — high quality styling
  | "freepik-flux-dev";         // Freepik Flux Dev — fast/high quality

// ImageProvider explícito para health-check / fallback automático en frontend.
export type ImageProvider = "replicate" | "gemini" | "runway" | "openai" | "xai" | "freepik" | "nvidia";

export const IMAGE_MODELS: Record<ImageGenModel, { provider: ImageProvider; replicateId?: string; description: string; costPerImage: number; aspectRatios: string[]; maxResolution: string }> = {
  "freepik-mystic":         { provider: "freepik", description: "Freepik Mystic — Máxima calidad con controles de estilo avanzados", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "freepik-flux-dev":       { provider: "freepik", description: "Freepik Flux Dev — Rápido, preciso y de alta calidad", costPerImage: 0.03, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "flux-1.1-pro-ultra":     { provider: "replicate", replicateId: "black-forest-labs/flux-1.1-pro-ultra", description: "Top photoreal 4MP, mejor calidad fotográfica", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2752x1536" },
  "flux-1.1-pro-ultra-raw": { provider: "replicate", replicateId: "black-forest-labs/flux-1.1-pro-ultra", description: "Flux Ultra modo RAW — fotografía naturalista (sin look AI)", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2752x1536" },
  "flux-1.1-pro":           { provider: "replicate", replicateId: "black-forest-labs/flux-1.1-pro",       description: "Photoreal estándar, buen precio/calidad", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"],         maxResolution: "1440x1440" },
  "flux-schnell":           { provider: "replicate", replicateId: "black-forest-labs/flux-schnell",       description: "El más barato y rápido", costPerImage: 0.003, aspectRatios: ["1:1","16:9","9:16"],                                    maxResolution: "1024x1024" },
  "recraft-v3":             { provider: "replicate", replicateId: "recraft-ai/recraft-v3",                description: "MEJOR para texto en imagen (posters, logos, packaging)", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3","2:1","1:2","7:5","5:7","4:5","5:4","3:5","5:3"], maxResolution: "2048x2048" },
  "recraft-v3-svg":         { provider: "replicate", replicateId: "recraft-ai/recraft-v3-svg",            description: "Recraft v3 SVG — vectorial REAL (logos, iconos, ilustración plana)", costPerImage: 0.08, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "vector" },
  "ideogram-v3-turbo":      { provider: "replicate", replicateId: "ideogram-ai/ideogram-v3-turbo",        description: "Texto + photoreal", costPerImage: 0.03, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "ideogram-v3-balanced":   { provider: "replicate", replicateId: "ideogram-ai/ideogram-v3",              description: "Ideogram V3 Balanced — buen balance entre calidad y velocidad", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "imagen-4-ultra":         { provider: "replicate", replicateId: "google/imagen-4-ultra",                description: "Google Imagen 4 Ultra — premium 2K, máxima calidad", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "imagen-4":               { provider: "replicate", replicateId: "google/imagen-4",                      description: "Google Imagen 4 estándar — alta calidad/precio equilibrado", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "imagen-4-fast":          { provider: "replicate", replicateId: "google/imagen-4-fast",                 description: "Google Imagen 4 Fast — generación rápida y barata", costPerImage: 0.02, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "nano-banana":            { provider: "gemini",                                                          description: "Nano Banana v1 (Gemini 2.5 Flash Image) — rápido, consistente con marca", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","2:3","3:2","4:5","5:4","21:9"], maxResolution: "2K" },
  "nano-banana-pro":        { provider: "gemini",                                                          description: "Nano Banana 2 / Pro (Gemini 3 Pro Image) — 4K, texto nítido, identidad estable", costPerImage: 0.12, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","2:3","3:2","4:5","5:4","21:9"], maxResolution: "4K" },
  "seedream-4":             { provider: "replicate", replicateId: "bytedance/seedream-4",                 description: "ByteDance Seedream 4 — photoreal + texto, rival de Recraft/Ideogram", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2048x2048" },
  "bytedance/seedream-3":   { provider: "replicate", replicateId: "bytedance/seedream-3",                 description: "ByteDance Seedream 3 — modelo photoreal artístico", costPerImage: 0.035, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "flux-kontext-pro":       { provider: "replicate", replicateId: "black-forest-labs/flux-kontext-pro",   description: "Mantiene consistencia entre imágenes (mismo personaje/estilo)", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
  "flux-kontext-max":       { provider: "replicate", replicateId: "black-forest-labs/flux-kontext-max",   description: "Flux Kontext Max — máxima calidad, consistencia de personaje/estilo premium", costPerImage: 0.07, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
  "flux-kontext-dev":       { provider: "replicate", replicateId: "black-forest-labs/flux-kontext-dev",   description: "Flux Kontext Dev — open-weights, edición artística creativa", costPerImage: 0.03, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
  "recraft-v4":             { provider: "replicate", replicateId: "recraft-ai/recraft-v4",                description: "Recraft V4 — última generación, texto nítido + realismo máximo", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "ideogram-v3-quality":    { provider: "replicate", replicateId: "ideogram-ai/ideogram-v3-quality",      description: "Ideogram V3 Quality — máxima calidad texto en imagen + photoreal", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "imagen-5-ultra":         { provider: "replicate", replicateId: "google/imagen-5-ultra",               description: "Google Imagen 5 Ultra — máxima calidad 2026, coherencia semántica avanzada", costPerImage: 0.08, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2048x2048" },
  "imagen-5":               { provider: "replicate", replicateId: "google/imagen-5",                     description: "Google Imagen 5 — estándar 2026, supera al Imagen 4 en detalle", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2048x2048" },
  "stable-diffusion-3.5-large": { provider: "replicate", replicateId: "stability-ai/stable-diffusion-3.5-large", description: "Stability AI SD 3.5 Large — photoreal artístico, mejor SD a la fecha", costPerImage: 0.035, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "1024x1024" },
  "stable-diffusion-3.5-turbo": { provider: "replicate", replicateId: "stability-ai/stable-diffusion-3.5-large-turbo", description: "Stability AI SD 3.5 Turbo — 4 pasos, ultra rápido y barato", costPerImage: 0.01, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "1024x1024" },
  "runway-gen4-image":      { provider: "runway", description: "Runway Gen4 Image — text-to-image nativo Runway con referencias opcionales", costPerImage: 0.08, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1920x1080" },
  "runway-gen4-image-turbo":{ provider: "runway", description: "Runway Gen4 Image Turbo — más barato, alta velocidad, buena calidad", costPerImage: 0.02, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1920x1080" },
  "gpt-image-1":            { provider: "openai", description: "OpenAI gpt-image-1 — render limpio, manejo de texto", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1536x1024" },
  "gpt-image-2":            { provider: "openai", description: "OpenAI gpt-image-2 — flagship 2026, razonamiento integrado, máxima calidad fotorrealista", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3","21:9"], maxResolution: "1536x864 (flex)" },
  "gpt-image-1.5":          { provider: "openai", description: "OpenAI gpt-image-1.5 — 20% más barato que v1, calidad equivalente", costPerImage: 0.033, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1536x1024" },
  "gpt-image-1-mini":             { provider: "openai", description: "OpenAI gpt-image-1 mini — presupuesto, alta velocidad, ideal para volumen", costPerImage: 0.02, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1024x1024" },
  "grok-imagine-image":           { provider: "xai",    description: "xAI Grok Imagine — generación de imagen rápida y barata ($0.02/img)", costPerImage: 0.02, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1K" },
  "grok-imagine-image-quality":   { provider: "xai",    description: "xAI Grok Imagine Quality — alta calidad 1K/2K, mejor coherencia visual ($0.05/img)", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "2K" },
  "nvidia-flux-schnell":          { provider: "nvidia", description: "NVIDIA FLUX.1 Schnell — ultra rápido (4 pasos), ideal para iteración y volumen", costPerImage: 0.01, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "nvidia-flux-dev":              { provider: "nvidia", description: "NVIDIA FLUX.1 Dev — alta calidad, 28 pasos, detalle fotorrealista en GPU NVIDIA", costPerImage: 0.025, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "nvidia-sdxl":                  { provider: "nvidia", description: "NVIDIA SDXL Turbo — Stable Diffusion XL acelerado con TensorRT en GPU NVIDIA", costPerImage: 0.015, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
};

// Modelos de edición de imagen mapeados a provider para el health-check.
export const IMAGE_EDIT_MODELS: Record<ImageEditModel, { provider: ImageProvider; description: string; costPerImage: number }> = {
  "nano-banana":      { provider: "gemini",    description: "Edición rápida con instrucciones de texto, mantiene la marca",     costPerImage: 0.04 },
  "nano-banana-pro":  { provider: "gemini",    description: "Edición premium 4K con texto nítido y identidad estable (v2)",      costPerImage: 0.12 },
  "flux-kontext-pro": { provider: "replicate", description: "Edición consistente, mantiene personajes/estilo",                  costPerImage: 0.05 },
  "seedream-4":       { provider: "replicate", description: "Edición Seedream 4 con referencias múltiples + texto",              costPerImage: 0.04 },
  "gen4-image-edit":  { provider: "runway",    description: "Image edit con referencias estilo Runway (gen4_image)",            costPerImage: 0.08 },
};

export async function generateImage(
  model: ImageGenModel,
  prompt: string,
  opts: {
    aspectRatio?: string;
    replicateToken?: string;
    seed?: number;
    negativePrompt?: string;
    referenceImage?: Buffer;
    referenceMime?: string;
    /** Optional second reference (e.g. character identity lock). Currently used by nano-banana. */
    extraReferences?: Array<{ buffer: Buffer; mime: string; tag?: string }>;
  },
): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
  const cfg = IMAGE_MODELS[model];
  if (!cfg) throw new Error(`Modelo de imagen desconocido: ${model}`);
  const aspect = opts.aspectRatio && cfg.aspectRatios.includes(opts.aspectRatio) ? opts.aspectRatio : cfg.aspectRatios[0];

  // ── OpenAI GPT Image family (gpt-image-1 / 1.5 / 1-mini / 2) vía Replit AI Integrations
  if (model === "gpt-image-1" || model === "gpt-image-2" || model === "gpt-image-1.5" || model === "gpt-image-1-mini") {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    // Resolver dinámico: gpt-image-2 acepta WxH libre; otros tienen enum fijo.
    const { sizeString: size } = await pickBestImageSize("openai", model, aspect);

    // gpt-image-2 usa quality "medium" por defecto (high=$0.211/img); mini usa "high" (solo $0.052)
    const quality = model === "gpt-image-2" ? "medium" : "high";

    const response = await openai.images.generate({
      model,
      prompt,
      size,
      quality,
      n: 1,
    } as any);
    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error(`${model} no devolvió imagen`);
    return { buffer: Buffer.from(base64, "base64"), mimeType: "image/png", model };
  }

  // ── xAI Aurora (image generation)
  // Real xAI model name is "aurora"; "grok-imagine-image-quality" also maps here
  // API: POST https://api.x.ai/v1/images/generations
  if (model === "grok-imagine-image" || model === "grok-imagine-image-quality") {
    const key = getXaiKey();
    const { sizeString: xaiAspect } = await pickBestImageSize("xai", model, aspect);
    // Aurora supports n, prompt, aspect_ratio, response_format.
    // Quality variant: request higher detail via system prompt prefix.
    const qualityMode = model === "grok-imagine-image-quality";
    const qualityPrefix = qualityMode ? "Ultra-photorealistic, high-detail, 4K render. " : "";
    const xaiBody: Record<string, unknown> = {
      model: "aurora",
      prompt: qualityPrefix + prompt,
      n: 1,
      aspect_ratio: xaiAspect,
      response_format: "url",
    };
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(xaiBody),
    });
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 400);
      throw new Error(`xAI Aurora image failed (${res.status}): ${errText}`);
    }
    const data = await res.json() as { data: Array<{ url: string; b64_json?: string }> };
    const imgUrl = data.data?.[0]?.url;
    if (!imgUrl) throw new Error("xAI Aurora: no se devolvió URL de imagen");
    const buffer = await fetchToBuffer(imgUrl);
    return { buffer, mimeType: "image/jpeg", model };
  }

  // ── NVIDIA NIM image generation (FLUX.1 Schnell, FLUX.1 Dev, SDXL Turbo)
  // Fallback: si NVIDIA_API_KEY ausente o falla → flux-schnell vía Replicate
  if (model === "nvidia-flux-schnell" || model === "nvidia-flux-dev" || model === "nvidia-sdxl") {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey) {
      const nvidiaModelMap: Record<string, string> = {
        "nvidia-flux-schnell": "black-forest-labs/flux-schnell",
        "nvidia-flux-dev":     "black-forest-labs/flux-dev",
        "nvidia-sdxl":         "stabilityai/stable-diffusion-xl-base-1.0",
      };
      const nvidiaImgModel = nvidiaModelMap[model] ?? "black-forest-labs/flux-schnell";
      const nvidiaW = aspect === "16:9" ? 1280 : aspect === "9:16" ? 720 : aspect === "4:3" ? 1024 : 1024;
      const nvidiaH = aspect === "16:9" ? 720 : aspect === "9:16" ? 1280 : aspect === "4:3" ? 768 : 1024;
      try {
        const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: nvidiaImgModel,
            prompt,
            n: 1,
            width: nvidiaW,
            height: nvidiaH,
            response_format: "b64_json",
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (nvidiaRes.ok) {
          const nvidiaData = await nvidiaRes.json() as { data: Array<{ b64_json?: string; url?: string }> };
          const b64 = nvidiaData.data?.[0]?.b64_json;
          if (b64) return { buffer: Buffer.from(b64, "base64"), mimeType: "image/png", model };
          const imgUrl = nvidiaData.data?.[0]?.url;
          if (imgUrl) { const buf = await fetchToBuffer(imgUrl); return { buffer: buf, mimeType: "image/png", model }; }
        }
        // NVIDIA failed — fall through to Replicate fallback below
      } catch { /* fall through to Replicate */ }
    }
    // Fallback: route to equivalent Replicate model
    const replicateFallback = model === "nvidia-sdxl" ? "stable-diffusion-3.5-large" : "flux-schnell";
    return generateImage(replicateFallback as ImageGenModel, prompt, opts);
  }

  // ── Nano Banana v1 / v2 (Gemini → Replicate fallback)
  if (model === "nano-banana" || model === "nano-banana-pro") {
    const { generateNanoBanana } = await import("./nano-banana.js");
    const refs: Array<{ buffer: Buffer; mimeType: string }> = [];
    if (opts.referenceImage) refs.push({ buffer: opts.referenceImage, mimeType: opts.referenceMime || "image/png" });
    for (const r of opts.extraReferences || []) refs.push({ buffer: r.buffer, mimeType: r.mime || "image/png" });
    const out = await generateNanoBanana(prompt, {
      aspectRatio: aspect,
      references: refs,
      replicateToken: opts.replicateToken,
      tier: model === "nano-banana-pro" ? "pro" : "v1",
    });
    return { buffer: out.buffer, mimeType: out.mimeType, model };
  }

  // ── Runway Gen4 Image (text-to-image nativo vía Runway API)
  if (model === "runway-gen4-image" || model === "runway-gen4-image-turbo") {
    const { generateImageWithReferences, fetchRunwayImageBuffer } = await import("./runway.js");
    const { sizeString: ratio } = await pickBestImageSize("runway", model, aspect);
    const runwayModel = model === "runway-gen4-image-turbo" ? "gen4_image_turbo" : "gen4_image";
    const refs: Array<{ uri: string; tag: string }> = [];
    if (opts.referenceImage) refs.push({ uri: bufferToDataUri(opts.referenceImage, opts.referenceMime || "image/png"), tag: "product" });
    const result = await generateImageWithReferences({ promptText: prompt, referenceImages: refs, ratio: ratio as any, model: runwayModel });
    const { buffer, mimeType } = await fetchRunwayImageBuffer(result.imageUrl);
    return { buffer, mimeType, model };
  }

  // ── Freepik models
  if (model.startsWith("freepik-")) {
    const { generateFreepikImage, isFreepikAvailable } = await import("./freepik.js");
    if (!isFreepikAvailable()) throw new Error("Freepik API key not configured");
    const freepikModel = model === "freepik-mystic" ? "freepik-mystic" : "flux-dev-fp8";
    const results = await generateFreepikImage({
      prompt,
      negative_prompt: opts.negativePrompt,
      aspect_ratio: aspect as any,
      model: freepikModel,
      seed: opts.seed,
      num_images: 1,
    });
    if (!results.length) throw new Error("Freepik no devolvió imagen");
    return {
      buffer: Buffer.from(results[0].base64, "base64"),
      mimeType: results[0].mimeType,
      model
    };
  }

  // ── Replicate models
  if (!cfg.replicateId) throw new Error(`Modelo ${model} sin replicateId definido`);
  const token = getReplicateToken(opts.replicateToken);

  let input: any = { prompt, aspect_ratio: aspect };
  if (opts.seed !== undefined) input.seed = opts.seed;
  if (opts.negativePrompt) input.negative_prompt = opts.negativePrompt;

  // Per-model input shape adjustments
  if (model === "flux-1.1-pro-ultra")     input = { ...input, raw: false, output_format: "png", output_quality: 95, safety_tolerance: 2 };
  if (model === "flux-1.1-pro-ultra-raw") input = { ...input, raw: true,  output_format: "png", output_quality: 95, safety_tolerance: 2 };
  if (model === "recraft-v3") input = { ...input, style: "realistic_image", size: "1820x1024" };
  if (model === "recraft-v3-svg") input = { ...input, style: "vector_illustration", size: "1820x1024" };
  if (model === "recraft-v4") {
    // Schema fetched dynamically from Replicate (cached 24 h). No hardcoded list.
    const { sizeString: v4Size } = await pickBestImageSize("replicate", model, aspect, {
      replicateId: cfg.replicateId,
      replicateToken: token,
    });
    const { aspect_ratio, ...rest } = input;
    // v4Size must be WxH format; if it's an aspect-ratio string (e.g. "3:2"), use closest valid size
    const RECRAFT_V4_SIZES: Array<[number,number]> = [
      [1024,1024],[1536,768],[768,1536],[1280,832],[832,1280],
      [1216,896],[896,1216],[1152,896],[896,1152],[832,1344],
      [1280,896],[896,1280],[1344,768],[768,1344],
    ];
    let safeSize = v4Size;
    if (!safeSize || !safeSize.includes("x")) {
      const targetRatio = aspect ? parseFloat(aspect.split(":")[0]) / parseFloat(aspect.split(":")[1]) : 1.5;
      let best = RECRAFT_V4_SIZES[0], bestDiff = Infinity;
      for (const [w,h] of RECRAFT_V4_SIZES) {
        const diff = Math.abs(w/h - targetRatio);
        if (diff < bestDiff) { bestDiff = diff; best = [w,h]; }
      }
      safeSize = `${best[0]}x${best[1]}`;
    }
    input = { ...rest, style: "realistic_image", size: safeSize };
  }
  if (model === "imagen-4-ultra" || model === "imagen-4" || model === "imagen-4-fast") {
    input = { ...input, output_format: "png", safety_filter_level: "block_only_high" };
  }
  if (model === "imagen-5-ultra" || model === "imagen-5") {
    input = { ...input, output_format: "png", safety_filter_level: "block_only_high" };
  }
  if (model === "stable-diffusion-3.5-large") {
    input = { prompt, negative_prompt: opts.negativePrompt || "", aspect_ratio: aspect, cfg: 4.5, steps: 28, output_format: "png" };
  }
  if (model === "stable-diffusion-3.5-turbo") {
    input = { prompt, negative_prompt: opts.negativePrompt || "", aspect_ratio: aspect, cfg: 1.0, steps: 4, output_format: "png" };
  }
  if (model === "seedream-4") {
    // Seedream 4 acepta referencias multi-image (hasta 8) para preservar
    // identidad de marca/personaje. Aceptamos la principal + extras.
    const refs: string[] = [];
    if (opts.referenceImage) refs.push(bufferToDataUri(opts.referenceImage, opts.referenceMime || "image/png"));
    for (const r of opts.extraReferences || []) refs.push(bufferToDataUri(r.buffer, r.mime || "image/png"));
    if (refs.length > 0) input.image_input = refs;
    input.size = "2K";
  }
  if ((model === "flux-kontext-pro" || model === "flux-kontext-max" || model === "flux-kontext-dev") && opts.referenceImage) {
    input.input_image = bufferToDataUri(opts.referenceImage, opts.referenceMime || "image/png");
  }
  if (model === "ideogram-v3-quality") input = { ...input, magic_prompt_option: "AUTO" };

  const buffer = await replicateRunBuffer(cfg.replicateId, input, token);
  const mimeType = model === "recraft-v3-svg" ? "image/svg+xml" : "image/png";
  return { buffer, mimeType, model };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 2: IMAGE EDIT (modify existing images with text prompt)
// ═══════════════════════════════════════════════════════════════════════════

export type ImageEditModel = "nano-banana" | "nano-banana-pro" | "flux-kontext-pro" | "seedream-4" | "gen4-image-edit";

export async function editImage(
  model: ImageEditModel,
  imageBuffer: Buffer,
  imageMime: string,
  editPrompt: string,
  opts: { replicateToken?: string; aspectRatio?: string },
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (model === "nano-banana" || model === "nano-banana-pro") {
    const { generateNanoBanana } = await import("./nano-banana.js");
    const out = await generateNanoBanana(editPrompt, {
      aspectRatio: opts.aspectRatio,
      references: [{ buffer: imageBuffer, mimeType: imageMime }],
      replicateToken: opts.replicateToken,
      tier: model === "nano-banana-pro" ? "pro" : "v1",
    });
    return { buffer: out.buffer, mimeType: out.mimeType };
  }

  if (model === "seedream-4") {
    const token = getReplicateToken(opts.replicateToken);
    const buf = await replicateRunBuffer("bytedance/seedream-4", {
      prompt: editPrompt,
      image_input: [bufferToDataUri(imageBuffer, imageMime)],
      aspect_ratio: opts.aspectRatio || "match_input_image",
      size: "2K",
    }, token);
    return { buffer: buf, mimeType: "image/png" };
  }

  if (model === "flux-kontext-pro") {
    const token = getReplicateToken(opts.replicateToken);
    const buf = await replicateRunBuffer("black-forest-labs/flux-kontext-pro", {
      prompt: editPrompt,
      input_image: bufferToDataUri(imageBuffer, imageMime),
      output_format: "png",
      aspect_ratio: opts.aspectRatio || "match_input_image",
      safety_tolerance: 2,
    }, token);
    return { buffer: buf, mimeType: "image/png" };
  }

  if (model === "gen4-image-edit") {
    // Runway Gen-4 Image via API NATIVA de Runway (NO Replicate). Esto
    // usa los créditos directos de la cuenta Runway (RUNWAY_API_KEY) en
    // vez de cobrar a Replicate. Acepta hasta 3 reference images + prompt.
    const { generateImageWithReferences, fetchRunwayImageBuffer } = await import("./runway.js");
    const ratioMap: Record<string, "1080:1080" | "1920:1080" | "1080:1920" | "1360:768" | "1168:880"> = {
      "1:1": "1080:1080",
      "16:9": "1920:1080",
      "9:16": "1080:1920",
      "4:3": "1440:1080" as any,
      "3:4": "1080:1440" as any,
      "match_input_image": "1080:1080",
    };
    const ratio = ratioMap[opts.aspectRatio || "1:1"] || "1080:1080";
    const result = await generateImageWithReferences({
      promptText: editPrompt,
      referenceImages: [{ uri: bufferToDataUri(imageBuffer, imageMime), tag: "product" }],
      ratio,
      model: "gen4_image",
    });
    const { buffer, mimeType } = await fetchRunwayImageBuffer(result.imageUrl);
    return { buffer, mimeType };
  }

  throw new Error(`Edit model unknown: ${model}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 3: BACKGROUND REMOVAL & REPLACEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function removeBackground(
  imageBuffer: Buffer, imageMime: string, replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  // Bria RMBG 2.0 - state-of-the-art bg removal, commercial license
  return await replicateRunBuffer(
    "bria/remove-background",
    { image: bufferToDataUri(imageBuffer, imageMime) },
    token,
  );
}

export async function replaceBackground(
  imageBuffer: Buffer, imageMime: string,
  scenePrompt: string,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  // Bria Generate Background — official Replicate model. Verified shape:
  // - `image` (URL or data URI)
  // - `bg_prompt` (text describing new scene)
  // - `num_results` (1)
  // - `fast` (true for speed)
  // - `original_quality` (false to upscale to 1MP)
  return await replicateRunBuffer(
    "bria/generate-background",
    {
      image: bufferToDataUri(imageBuffer, imageMime),
      bg_prompt: scenePrompt,
      num_results: 1,
      fast: true,
      original_quality: false,
      refine_prompt: true,
    },
    token,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 4: UPSCALING (Real-ESRGAN, Clarity-style)
// ═══════════════════════════════════════════════════════════════════════════

export async function upscaleImage(
  imageBuffer: Buffer, imageMime: string,
  scale: 2 | 4 = 2,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  // Real-ESRGAN with face enhancement
  return await replicateRunBuffer(
    "nightmareai/real-esrgan",
    {
      image: bufferToDataUri(imageBuffer, imageMime),
      scale,
      face_enhance: true,
    },
    token,
  );
}

export async function clarityUpscale(
  imageBuffer: Buffer, imageMime: string,
  prompt: string,
  scale = 2,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  // Clarity-style upscaler (Magnific clone) - resamples with creative detail
  return await replicateRunBuffer(
    "philz1337x/clarity-upscaler",
    {
      image: bufferToDataUri(imageBuffer, imageMime),
      prompt,
      scale_factor: scale,
      dynamic: 6,
      creativity: 0.35,
      resemblance: 0.6,
    },
    token,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 5: FACE/PORTRAIT ENHANCEMENT (GFPGAN)
// ═══════════════════════════════════════════════════════════════════════════

export async function enhanceFaces(
  imageBuffer: Buffer, imageMime: string,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  return await replicateRunBuffer(
    "tencentarc/gfpgan",
    {
      img: bufferToDataUri(imageBuffer, imageMime),
      version: "v1.4",
      scale: 2,
    },
    token,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 5B: VIDEO UPSCALING / SUPER-RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════
// Dos motores reales de Replicate verificados en la cuenta:
//   • topaz  → topazlabs/video-upscale  (premium, hasta 4K, control de fps)
//   • esrgan → lucataco/real-esrgan-video (por fotograma, económico, hasta 4K)
// Los vídeos NO se envían como data-URI (demasiado grandes): se suben primero
// con la Files API de Replicate y se pasa la URL como input.

export type VideoUpscaleEngine = "topaz" | "esrgan";

export const VIDEO_UPSCALE_MODELS: Record<VideoUpscaleEngine, {
  modelId: string;
  label: string;
  description: string;
  resolutions: string[];
  defaultResolution: string;
  videoField: string;
  resolutionField: string;
}> = {
  topaz: {
    modelId: "topazlabs/video-upscale",
    label: "Topaz Video Upscale (premium)",
    description: "Super-resolución de Topaz Labs — máxima calidad, hasta 4K con control de fps",
    resolutions: ["720p", "1080p", "4k"],
    defaultResolution: "1080p",
    videoField: "video",
    resolutionField: "target_resolution",
  },
  esrgan: {
    modelId: "lucataco/real-esrgan-video",
    label: "Real-ESRGAN Video",
    description: "Upscale por fotograma con Real-ESRGAN — económico, hasta 4K",
    resolutions: ["FHD", "2k", "4k"],
    defaultResolution: "FHD",
    videoField: "video_path",
    resolutionField: "resolution",
  },
};

/** Sube un buffer a la Files API de Replicate y devuelve la URL pública del fichero. */
async function replicateUploadFileUrl(buffer: Buffer, mime: string, token: string): Promise<string> {
  if (!token) throw new Error("REPLICATE_API_TOKEN no configurado");
  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: token });
  const ext = /webm/i.test(mime) ? "webm" : /(quicktime|mov)/i.test(mime) ? "mov" : "mp4";
  const blob = new Blob([new Uint8Array(buffer)], { type: mime || "video/mp4" });
  (blob as any).name = `fs-pro_${Date.now()}.${ext}`;
  const file: any = await rep.files.create(blob as any);
  const url = file?.urls?.get || file?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Replicate Files API no devolvió URL del vídeo subido");
  }
  return url;
}

export async function upscaleVideo(
  videoBuffer: Buffer,
  videoMime: string,
  opts: { engine?: VideoUpscaleEngine; resolution?: string; targetFps?: number; replicateToken?: string } = {},
): Promise<Buffer> {
  const token = getReplicateToken(opts.replicateToken);
  const engine: VideoUpscaleEngine = opts.engine === "esrgan" ? "esrgan" : "topaz";
  const cfg = VIDEO_UPSCALE_MODELS[engine];
  const resolution = opts.resolution && cfg.resolutions.includes(opts.resolution)
    ? opts.resolution
    : cfg.defaultResolution;

  const fileUrl = await replicateUploadFileUrl(videoBuffer, videoMime, token);
  const input: Record<string, unknown> = {
    [cfg.videoField]: fileUrl,
    [cfg.resolutionField]: resolution,
  };
  if (engine === "topaz" && opts.targetFps) input.target_fps = opts.targetFps;
  if (engine === "esrgan") input.model = "RealESRGAN_x4plus";

  // El upscaling de vídeo es lento → timeout generoso (20 min) con polling robusto.
  return await replicateRunLatestBuffer(cfg.modelId, input, token, 20 * 60_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 6: VOICE CLONING (ElevenLabs Instant Voice Clone)
// ═══════════════════════════════════════════════════════════════════════════

export async function cloneVoice(
  name: string,
  audioBuffer: Buffer,
  audioMime: string,
  description?: string,
): Promise<{ voice_id: string; name: string }> {
  const apiKey = getElevenKey();
  const fd = new FormData();
  fd.append("name", name);
  if (description) fd.append("description", description);
  fd.append("files", new Blob([new Uint8Array(audioBuffer)], { type: audioMime }), `voice-sample.${audioMime.split("/")[1] || "mp3"}`);

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd as any,
  });
  if (!res.ok) throw new Error(`ElevenLabs voice clone failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { voice_id: string; name: string };
  return data;
}

export async function deleteCloneVoice(voiceId: string): Promise<void> {
  const apiKey = getElevenKey();
  await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: "DELETE", headers: { "xi-api-key": apiKey },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 7: TTS WITH ADVANCED CONTROL (ElevenLabs)
// ═══════════════════════════════════════════════════════════════════════════

export interface TTSOptions {
  voiceId: string;
  modelId?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_v3" | "eleven_flash_v2_5";
  stability?: number;       // 0-1
  similarity?: number;      // 0-1
  style?: number;           // 0-1
  speakerBoost?: boolean;
  speed?: number;           // 0.7-1.2
  languageCode?: string;    // ISO 639-1 (e.g. "es", "en"); only honored by multilingual models
}

export async function generateTTS(text: string, opts: TTSOptions): Promise<Buffer> {
  const apiKey = getElevenKey();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: opts.modelId || "eleven_v3",
      voice_settings: {
        stability: opts.stability ?? 0.5,
        similarity_boost: opts.similarity ?? 0.75,
        style: opts.style ?? 0.3,
        use_speaker_boost: opts.speakerBoost ?? true,
        speed: opts.speed ?? 1.0,
      },
      ...(opts.languageCode && /^[a-z]{2}(-[A-Z]{2})?$/.test(opts.languageCode)
        ? { language_code: opts.languageCode }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 8: SOUND EFFECTS / AMBIENT (ElevenLabs SFX)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateSFX(
  prompt: string, durationSec = 5, promptInfluence = 0.5,
): Promise<Buffer> {
  const apiKey = getElevenKey();
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: Math.min(Math.max(durationSec, 1), 22),
      prompt_influence: promptInfluence,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs SFX failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 9: MUSIC GENERATION (Replicate Stable Audio + alternatives)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateMusic(
  prompt: string, durationSec = 30, replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);

  // Replicate Audio Models June 2026
  if (prompt.includes("musicgen-large")) {
    return await replicateRunBuffer(
      "facebookresearch/musicgen:7a76a8258b2999da03f0f70155097f48b1116c4fdf4c85f7614d3f25c7865c69",
      { prompt, duration: Math.min(Math.max(durationSec, 1), 30), model_version: "large" },
      token,
    );
  }
  if (prompt.includes("musicgen-stereo-large")) {
    return await replicateRunBuffer(
      "facebookresearch/musicgen:7a76a8258b2999da03f0f70155097f48b1116c4fdf4c85f7614d3f25c7865c69",
      { prompt, duration: Math.min(Math.max(durationSec, 1), 30), model_version: "stereo-large" },
      token,
    );
  }
  if (prompt.includes("audio-ldm-2-large")) {
    return await replicateRunBuffer(
      "haoheliu/audio-ldm-2:664293f2f8193856d1136b8c4c700940733d9061d4793616235b02661d935e40",
      { prompt, duration: Math.min(Math.max(durationSec, 1), 30) },
      token,
    );
  }

  // Stable Audio Open 1.0 — best open-source music gen
  return await replicateRunBuffer(
    "stackadoc/stable-audio-open-1.0",
    {
      prompt,
      seconds_total: Math.min(Math.max(durationSec, 1), 47),
      seconds_start: 0,
      cfg_scale: 6,
      steps: 100,
    },
    token,
  );
}

/**
 * Generate music for a long-form ad (>47s) by stitching multiple 47s blocks
 * with FFmpeg crossfade. Each block uses a "section directive" so the music
 * builds an arc instead of looping the same motif.
 */
export async function generateMusicLong(
  basePrompt: string,
  totalDurationSec: number,
  replicateToken?: string,
): Promise<Buffer> {
  const MAX_BLOCK = 45; // 47 cap minus 2s overlap for crossfade
  if (totalDurationSec <= MAX_BLOCK) {
    return generateMusic(basePrompt, totalDurationSec, replicateToken);
  }
  const blocks = Math.ceil(totalDurationSec / MAX_BLOCK);
  const sections = [
    "intro: soft entry, sparse instrumentation, builds tension",
    "rise: layers added, rhythm tightens, melodic hook emerges",
    "verse: confident groove, mid-density, supports voiceover",
    "bridge: textural shift, new color, harmonic surprise",
    "drop: peak energy, full mix, hook restated",
    "verse: groove returns refined, callback to motif",
    "climax: maximum intensity, all elements together",
    "outro: dissolves into ambience, soft tail",
  ];
  const buffers: Buffer[] = [];
  for (let i = 0; i < blocks; i++) {
    const section = sections[Math.min(i, sections.length - 1)];
    const blockSec = i === blocks - 1
      ? Math.max(8, totalDurationSec - i * MAX_BLOCK + 2) // last block + 2s tail for fade
      : MAX_BLOCK + 2;
    const blockPrompt = `${basePrompt}. Section ${i + 1}/${blocks} - ${section}. Seamless musical continuation with previous section, same key and tempo.`;
    const buf = await generateMusic(blockPrompt, Math.min(47, blockSec), replicateToken);
    buffers.push(buf);
  }
  // Crossfade-concat the music blocks via FFmpeg (audio-only).
  return await concatAudioBuffers(buffers, 1.5);
}

async function concatAudioBuffers(buffers: Buffer[], crossfadeSec: number): Promise<Buffer> {
  if (buffers.length === 1) return buffers[0];
  const tmp = await makeTmpDir("music");
  try {
    const inputs: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const p = path.join(tmp, `m_${i}.mp3`);
      await fs.writeFile(p, buffers[i]);
      inputs.push(p);
    }
    const outPath = path.join(tmp, "music.mp3");
    const ffmpeg: any = await loadFfmpeg();
    return await new Promise<Buffer>((resolve, reject) => {
      const cmd = ffmpeg();
      for (const p of inputs) cmd.input(p);
      const N = inputs.length;
      // acrossfade chain: 2 inputs at a time. Build cumulatively.
      const filters: string[] = [];
      let prev = "0:a";
      for (let i = 1; i < N; i++) {
        const out = i === N - 1 ? "aout" : `ax${i}`;
        filters.push(`[${prev}][${i}:a]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri[${out}]`);
        prev = out;
      }
      cmd.complexFilter(filters, ["aout"])
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .on("end", async () => { try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); } })
        .on("error", (err: Error) => reject(new Error(`FFmpeg music concat error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 10: VIDEO GENERATION (Runway Gen-4 + all Replicate top models)
// ═══════════════════════════════════════════════════════════════════════════

export type VideoModel =
  | "runway-gen4-turbo"
  | "runway-gen3-alpha"
  | "runway-gen4.5"          // Runway Gen 4.5 — nueva gen, mejor motion y detalle
  | "runway-gen4.5-turbo"    // Runway Gen 4.5 Turbo — rápido y eficiente
  | "runway-seedance2"       // Seedance 2 vía Runway — calidad cinematográfica
  | "runway-seedance2-fast"  // Seedance 2 Fast vía Runway — rápido
  | "runway-gen5"            // Runway Gen 5 — alias reservado (redirigido a 4.5)
  | "veo-3.1"
  | "veo-3.1-fast"           // Veo 3.1 Fast — rápido + audio nativo
  | "veo-3-fast"             // Veo 3 Fast — legado rápido
  | "veo-3"                  // Veo 3 — máxima calidad + audio nativo
  | "veo-2"                  // Veo 2 — soporta 9:16 y 16:9
  | "sora-2"                 // OpenAI Sora 2 — narrativa cinematográfica
  | "kling-master"           // Kling V3.0 Omni — alias para máxima calidad
  | "kling-2.5-turbo"        // Kling 2.5 Turbo — alias legado
  | "kling-2.1"              // Kling 2.1 — alias legado
  | "seedance-pro"           // Seedance Pro — alias para seedance-1-pro
  | "seedance-fast"          // Seedance Fast — alias rápido
  | "hailuo-02-fast"         // Hailuo 02 Fast — variante rápida y barata
  | "hailuo-02"              // Hailuo 02 — buen balance velocidad/calidad
  | "wan-2.5-t2v-480p"       // Wan 2.5 T2V 480p — Text-to-Video puro Replicate
  | "wan-2.5-t2v-720p"       // Wan 2.5 T2V 720p — Text-to-Video puro Replicate
  | "wan-2.5-i2v-480p"       // Wan 2.5 I2V 480p — Image-to-Video Replicate
  | "kling-v1.6-standard"    // Kling v1.6 Standard — calidad balanceada
  | "kling-v1.6-pro"         // Kling v1.6 Pro — alta calidad
  | "kling-3.0-master"       // Kling V3.0 Master — última gen Kuaishou, máxima calidad
  | "hailuo-02-master"       // MiniMax Hailuo 02 Master — máxima calidad cinematográfica
  | "seedance-1-pro"         // Seedance 1 Pro — calidad profesional
  | "wan-2.5-t2v"            // Wan 2.5 Text-to-Video — T2V puro, sin imagen
  | "seedance-1-lite"        // Seedance 1 Lite — versión económica de Pro
  | "kling-3.0-turbo"        // Kling V3.0 Turbo — rápido y barato, calidad V3
  | "veo-4"                  // Google Veo 4 — nueva generación 2026, máxima coherencia
  | "veo-4-fast"             // Google Veo 4 Fast — Veo 4 más rápido y barato
  | "minimax-video-01"       // MiniMax Video-01 — modelo base de MiniMax, alternativa a Hailuo
  | "wan-2.6"                // Wan 2.6 — alias legado, redirigido a Wan 2.7
  | "wan-2.7"                // Wan 2.7 — última gen open-source, T2V+I2V+R2V, hasta 1080p y 15s
  | "kling-3.0-omni"         // Kling V3.0 Omni — multimodal: texto+imagen+refs+audio, máxima calidad
  | "hailuo-2.3"             // MiniMax Hailuo 2.3 — último Hailuo, 1080p T2V+I2V
  | "hailuo-2.3-fast"        // MiniMax Hailuo 2.3 Fast — variante rápida, I2V 1080p
  | "grok-video-1"           // xAI Grok Video 1 — June 2026 flagship video, T2V/I2V
  | "grok-imagine-video"     // xAI Grok Imagine Video — T2V/I2V, hasta 15s, 720p ($0.07/s)
  | "grok-imagine-video-1.5" // xAI Grok Imagine Video 1.5 Preview — mayor calidad ($0.14/s 720p)
  | "wan-2.5"               // Wan 2.5 — I2V open-source de calidad
  | "wan-2.5-fast"          // Wan 2.5 Fast — legado, I2V rápido
  | "veo-3.1-lite"          // Google Veo 3.1 Lite — tier más económico, audio nativo
  | "wan-2.7-t2v"           // Wan 2.7 T2V — 27B MoE, audio nativo, hasta 1080p y 15s
  | "wan-2.7-i2v"           // Wan 2.7 I2V — first+last frame control, audio sync
  | "wan-2.7-r2v"           // Wan 2.7 R2V — Reference-to-Video (nueva capacidad)
  | "kling-v2.1"            // Kling v2.1 Standard — T2V+I2V, 720p/1080p, 5/10s
  | "kling-v2.1-pro"        // Kling v2.1 Pro — T2V+I2V 1080p, mayor calidad, 5/10s
  | "kling-v2.5-turbo-pro"  // Kling v2.5 Turbo Pro — rápido, T2V+I2V, 1080p
  | "runway-aleph2"         // Runway Aleph 2.0 — Video-to-Video contextual editing
  | "runway-happyhorse"     // Runway HappyHorse 1.0 — T2V/I2V nueva gen (jun 2026)
  | "kling-v2.6"            // Kling v2.6 — T2V+I2V, audio+lip-sync nativos, 1080p
  | "kling-v2.1-master"     // Kling v2.1 Master — T2V+I2V premium, 1080p, 5/10s
  | "wan-2.7-videoedit"     // Wan 2.7 VideoEdit — edición con instrucciones naturales
  | "seedance-2.0"          // Seedance 2.0 — T2V+I2V, audio nativo, 4-15s, 720p
  | "nvidia-cosmos-2b"      // NVIDIA Cosmos 2B — world-model T2V compact en NIM
  | "nvidia-cosmos-14b";    // NVIDIA Cosmos 14B — world-model T2V máxima calidad NVIDIA

export const VIDEO_MODELS: Record<VideoModel, { provider: "runway" | "replicate" | "gemini" | "xai" | "nvidia"; modelId?: string; description: string; costPerSec: number; quality: number; maxDuration: number }> = {
  "runway-gen4-turbo":  { provider: "runway",                                                description: "Runway Gen-4 — top quality, control fino, 5/10s",                costPerSec: 0.05, quality: 10, maxDuration: 10 },
  "runway-gen3-alpha":  { provider: "runway",                                                description: "Runway Gen-3 Alpha — legado, reemplazado por Gen-4.5 y Gen-5",    costPerSec: 0.03, quality: 6,  maxDuration: 10 },
  "runway-gen4.5":       { provider: "runway",                                                description: "Runway Gen 4.5 — última generación Jun-2026, 4K, audio nativo, hasta 15s", costPerSec: 0.07,  quality: 10, maxDuration: 15 },
  "runway-gen4.5-turbo": { provider: "runway",                                                description: "Runway Gen 4.5 Turbo — rápido y eficiente, 1080p, audio nativo",           costPerSec: 0.05,  quality: 9,  maxDuration: 10 },
  "runway-seedance2":    { provider: "runway",                                                description: "Seedance 2 vía Runway — nueva generación, calidad cinematográfica",          costPerSec: 0.10,  quality: 10, maxDuration: 10 },
  "runway-seedance2-fast":{ provider: "runway",                                               description: "Seedance 2 Fast vía Runway — rápido y barato, calidad pro",                  costPerSec: 0.06,  quality: 8,  maxDuration: 10 },
  "runway-gen5":           { provider: "runway",                                               description: "Runway Gen 5 — alias reservado (Gen 5 no lanzado aún → redirigido a Gen 4.5)", costPerSec: 0.07, quality: 10, maxDuration: 15 },
  "veo-3.1":            { provider: "gemini",    modelId: "veo-3.1-generate-preview",       description: "Google Veo 3.1 — última gen + audio nativo, 16:9 / 9:16 (8s)",   costPerSec: 0.75, quality: 10, maxDuration: 8  },
  "veo-3.1-fast":       { provider: "gemini",    modelId: "veo-3.1-fast-generate-preview",  description: "Google Veo 3.1 Fast — rápido y barato + audio nativo",          costPerSec: 0.40, quality: 9,  maxDuration: 8  },
  "veo-3-fast":         { provider: "gemini",    modelId: "veo-3.1-fast-generate-preview",  description: "Google Veo 3 Fast → migrado a Veo 3.1 Fast (3.0 deprecado jun-2026)",  costPerSec: 0.40, quality: 9,  maxDuration: 8  },
  "veo-3":              { provider: "gemini",    modelId: "veo-3.1-generate-preview",       description: "Google Veo 3 → migrado a Veo 3.1 (3.0 deprecado y desactivado jun-2026)", costPerSec: 0.75, quality: 10, maxDuration: 8  },
  "veo-2":              { provider: "gemini",    modelId: "veo-3.1-lite-generate-preview",  description: "Google Veo 2 → migrado a Veo 3.1 Lite (más rápido y económico)",        costPerSec: 0.20, quality: 7,  maxDuration: 8  },
  "sora-2":             { provider: "replicate", modelId: "openai/sora-2",                  description: "OpenAI Sora 2 — narrativa cinematográfica, hasta 12s, T2V/I2V", costPerSec: 0.30, quality: 10, maxDuration: 12 },
  "kling-master":       { provider: "replicate", modelId: "kwaivgi/kling-video-3.0-omni",    description: "Kling V3.0 Omni — máxima calidad, multimodal, audio nativo, hasta 15s", costPerSec: 0.22, quality: 10, maxDuration: 15 },
  "kling-2.5-turbo":    { provider: "replicate", modelId: "kwaivgi/kling-video-3.0",         description: "Kling V3.0 — cinematic T2V+I2V, audio nativo, hasta 15s, 1080p", costPerSec: 0.14, quality: 10, maxDuration: 15 },
  "kling-2.1":          { provider: "replicate", modelId: "kwaivgi/kling-video-3.0",         description: "Kling (alias legado) — redirigido a Kling V3.0 actual",          costPerSec: 0.14, quality: 10, maxDuration: 15 },
  "seedance-pro":       { provider: "replicate", modelId: "bytedance/seedance-1-pro",       description: "Seedance Pro — cinema-quality, multi-reference (9 imgs)",        costPerSec: 0.07, quality: 9,  maxDuration: 10 },
  "seedance-fast":      { provider: "replicate", modelId: "bytedance/seedance-1-pro-fast",  description: "Seedance Fast — rápido y barato, calidad pro",                   costPerSec: 0.05, quality: 7,  maxDuration: 10 },
  "hailuo-02-fast":     { provider: "replicate", modelId: "minimax/hailuo-02-fast",         description: "Hailuo 02 Fast — variante rápida y barata de MiniMax",           costPerSec: 0.03, quality: 7,  maxDuration: 6  },
  "hailuo-02":          { provider: "replicate", modelId: "minimax/hailuo-02",              description: "Hailuo 02 — buen balance velocidad/calidad",                     costPerSec: 0.05, quality: 7,  maxDuration: 6  },
  "hailuo-02-master":   { provider: "replicate", modelId: "minimax/hailuo-02",              description: "Hailuo 02 Master — máxima calidad cinematográfica",             costPerSec: 0.08, quality: 10, maxDuration: 6  },
  "wan-2.5-t2v-480p":    { provider: "replicate", modelId: "wan-video/wan-2.5-t2v-480p",     description: "Wan 2.5 T2V 480p — generación de video rápida por texto",       costPerSec: 0.02, quality: 6,  maxDuration: 5  },
  "wan-2.5-t2v-720p":    { provider: "replicate", modelId: "wan-video/wan-2.5-t2v-720p",     description: "Wan 2.5 T2V 720p — alta calidad por texto",                     costPerSec: 0.04, quality: 8,  maxDuration: 5  },
  "wan-2.5-i2v-480p":    { provider: "replicate", modelId: "wan-video/wan-2.5-i2v-480p",     description: "Wan 2.5 I2V 480p — animación de imagen rápida",                 costPerSec: 0.02, quality: 6,  maxDuration: 5  },
  "kling-v1.6-standard": { provider: "replicate", modelId: "kwaivgi/kling-v1.6-standard",    description: "Kling v1.6 Standard — calidad balanceada",                      costPerSec: 0.10, quality: 8,  maxDuration: 10 },
  "kling-v1.6-pro":      { provider: "replicate", modelId: "kwaivgi/kling-v1.6-pro",         description: "Kling v1.6 Pro — alta calidad profesional",                     costPerSec: 0.18, quality: 10, maxDuration: 10 },
  "seedance-1-pro":      { provider: "replicate", modelId: "bytedance/seedance-1-pro",       description: "Seedance 1 Pro — calidad profesional de ByteDance",             costPerSec: 0.08, quality: 10, maxDuration: 10 },
  "wan-2.5":             { provider: "replicate", modelId: "wan-video/wan-2.5-i2v",          description: "Wan 2.5 — open-source de calidad, mejor que la versión Fast",                costPerSec: 0.04,  quality: 8,  maxDuration: 5  },
  "wan-2.5-fast":        { provider: "replicate", modelId: "wan-video/wan-2.5-i2v-fast",     description: "Wan 2.5 Fast — legado, reemplazado por Wan 2.6 (mejor calidad al mismo precio)", costPerSec: 0.018, quality: 5,  maxDuration: 5  },
  "wan-2.5-t2v":         { provider: "replicate", modelId: "wan-video/wan-2.5-t2v",          description: "Wan 2.5 Text-to-Video — T2V puro open-source, sin imagen origen",            costPerSec: 0.025, quality: 7,  maxDuration: 5  },
  "seedance-1-lite":     { provider: "replicate", modelId: "bytedance/seedance-1-lite",       description: "Seedance 1 Lite — versión económica de Seedance Pro",                        costPerSec: 0.03,  quality: 6,  maxDuration: 10 },
  "kling-3.0-master":    { provider: "replicate", modelId: "kwaivgi/kling-video-3.0-omni",      description: "Kling V3.0 Omni — multimodal, máxima calidad, audio nativo, hasta 15s",     costPerSec: 0.22,  quality: 10, maxDuration: 15 },
  "kling-3.0-turbo":     { provider: "replicate", modelId: "kwaivgi/kling-video-3.0",           description: "Kling V3.0 — cinematic T2V+I2V, audio nativo, hasta 15s, 1080p",            costPerSec: 0.14,  quality: 10, maxDuration: 15 },
  "kling-3.0-omni":      { provider: "replicate", modelId: "kwaivgi/kling-video-3.0-omni",      description: "Kling V3.0 Omni — multimodal: texto+imagen+refs+audio, estilo transfer",     costPerSec: 0.22,  quality: 10, maxDuration: 15 },
  "veo-4":               { provider: "gemini",    modelId: "veo-3.1-generate-preview",        description: "Google Veo 4 — no lanzado aún (jul 2026) → redirigido a Veo 3.1",           costPerSec: 0.75,  quality: 10, maxDuration: 8  },
  "veo-4-fast":          { provider: "gemini",    modelId: "veo-3.1-fast-generate-preview",   description: "Google Veo 4 Fast — no lanzado aún (jul 2026) → redirigido a Veo 3.1 Fast", costPerSec: 0.40,  quality: 9,  maxDuration: 8  },
  "minimax-video-01":    { provider: "replicate", modelId: "minimax/video-01",                description: "MiniMax Video-01 — modelo base de MiniMax (precursor de Hailuo)",            costPerSec: 0.05,  quality: 8,  maxDuration: 6  },
  "wan-2.6":             { provider: "replicate", modelId: "wan-video/wan-2.7-i2v",           description: "Wan 2.7 — última gen open-source, T2V+I2V+R2V, hasta 1080p y 15s (wan-2.6 redirigido)", costPerSec: 0.05, quality: 8,  maxDuration: 15 },
  "wan-2.7":             { provider: "replicate", modelId: "wan-video/wan-2.7-i2v",           description: "Wan 2.7 — última gen open-source wan-video, T2V+I2V+R2V, hasta 1080p y 15s",  costPerSec: 0.05,  quality: 8,  maxDuration: 15 },
  "hailuo-2.3":          { provider: "replicate", modelId: "minimax/hailuo-2.3",              description: "MiniMax Hailuo 2.3 — última gen Hailuo, 1080p, T2V+I2V, mejora sobre hailuo-02", costPerSec: 0.06, quality: 8, maxDuration: 10 },
  "hailuo-2.3-fast":     { provider: "replicate", modelId: "minimax/hailuo-2.3-fast",         description: "MiniMax Hailuo 2.3 Fast — variante rápida, I2V 1080p, latencia reducida",    costPerSec: 0.04, quality: 7, maxDuration: 10 },
  "grok-video-1":        { provider: "xai", modelId: "grok-video-1",           description: "xAI Grok Video 1 — June 2026 flagship video, T2V/I2V, cinematic quality", costPerSec: 0.15, quality: 10, maxDuration: 15 },
  "grok-imagine-video":    { provider: "xai", modelId: "grok-imagine-video",           description: "xAI Grok Imagine Video — T2V/I2V, hasta 15s, 720p ($0.07/s)", costPerSec: 0.07, quality: 9,  maxDuration: 15 },
  "grok-imagine-video-1.5":{ provider: "xai", modelId: "grok-imagine-video-1.5",         description: "xAI Grok Imagine Video 1.5 — I2V 1080p, máxima calidad xAI ($0.14/s)", costPerSec: 0.14, quality: 10, maxDuration: 15 },
  "veo-3.1-lite":          { provider: "gemini",    modelId: "veo-3.1-lite-generate-preview",  description: "Google Veo 3.1 Lite — tier más económico, audio nativo (jul 2026)",        costPerSec: 0.15, quality: 7,  maxDuration: 8  },
  "wan-2.7-t2v":           { provider: "replicate", modelId: "wan-video/wan-2.7-t2v",           description: "Wan 2.7 T2V — 27B MoE, audio nativo, hasta 1080p y 15s",                  costPerSec: 0.06, quality: 9,  maxDuration: 15 },
  "wan-2.7-i2v":           { provider: "replicate", modelId: "wan-video/wan-2.7-i2v",           description: "Wan 2.7 I2V — first+last frame control, audio sync, hasta 1080p y 15s",   costPerSec: 0.06, quality: 9,  maxDuration: 15 },
  "wan-2.7-r2v":           { provider: "replicate", modelId: "wan-video/wan-2.7-r2v",           description: "Wan 2.7 R2V — Reference-to-Video: guía con imagen de referencia",          costPerSec: 0.07, quality: 9,  maxDuration: 15 },
  "kling-v2.1":            { provider: "replicate", modelId: "kwaivgi/kling-v2.1",              description: "Kling v2.1 Standard — T2V+I2V, 720p/1080p, 5/10s",                        costPerSec: 0.10, quality: 8,  maxDuration: 10 },
  "kling-v2.1-pro":        { provider: "replicate", modelId: "kwaivgi/kling-v2.1-pro",          description: "Kling v2.1 Pro — T2V+I2V 1080p, mayor calidad, 5/10s",                    costPerSec: 0.18, quality: 9,  maxDuration: 10 },
  "kling-v2.5-turbo-pro":  { provider: "replicate", modelId: "kwaivgi/kling-v2.5-turbo-pro",    description: "Kling v2.5 Turbo Pro — rápido, T2V+I2V, 1080p",                           costPerSec: 0.14, quality: 9,  maxDuration: 10 },
  "runway-aleph2":         { provider: "runway",                                                  description: "Runway Aleph 2.0 — Video-to-Video contextual editing (jun 2026)",          costPerSec: 0.09, quality: 9,  maxDuration: 15 },
  "runway-happyhorse":     { provider: "runway",                                                  description: "Runway HappyHorse 1.0 — T2V/I2V nueva gen (jun 2026)",                    costPerSec: 0.06, quality: 8,  maxDuration: 10 },
  "kling-v2.6":            { provider: "replicate", modelId: "kwaivgi/kling-v2.6",              description: "Kling v2.6 — audio+lip-sync nativos (voz+SFX+BGM), T2V+I2V, 1080p",     costPerSec: 0.16, quality: 9,  maxDuration: 10 },
  "kling-v2.1-master":     { provider: "replicate", modelId: "kwaivgi/kling-v2.1-master",       description: "Kling v2.1 Master — dynamics premium, T2V+I2V, 1080p, 5/10s",             costPerSec: 0.20, quality: 10, maxDuration: 10 },
  "wan-2.7-videoedit":     { provider: "replicate", modelId: "wan-video/wan-2.7-videoedit",      description: "Wan 2.7 VideoEdit — edición V2V con instrucciones en lenguaje natural",   costPerSec: 0.07, quality: 9,  maxDuration: 15 },
  "seedance-2.0":          { provider: "replicate", modelId: "bytedance/seedance-2.0",           description: "Seedance 2.0 — T2V+I2V, audio nativo, 4-15s, 720p, aspect adaptivo",     costPerSec: 0.06, quality: 9,  maxDuration: 15 },
  "nvidia-cosmos-2b":      { provider: "nvidia",    modelId: "nvidia/cosmos-2b",                 description: "NVIDIA Cosmos 2B — world-model T2V compacto, rápido en GPU NVIDIA NIM",  costPerSec: 0.04, quality: 7,  maxDuration: 10 },
  "nvidia-cosmos-14b":     { provider: "nvidia",    modelId: "nvidia/cosmos-14b",                description: "NVIDIA Cosmos 14B — world-model T2V máxima calidad NVIDIA, 1080p",       costPerSec: 0.10, quality: 9,  maxDuration: 10 },
};

// Modelos que soportan TEXT-TO-VIDEO puro (sin imagen origen).
// Runway sólo expone /image_to_video en este pipeline → I2V obligatorio.
const T2V_SUPPORTED: Record<string, boolean> = {
  "runway-gen4-turbo": false,
  "runway-gen3-alpha": false,
  "runway-gen4.5":       false,
  "runway-gen4.5-turbo": false,
  "runway-seedance2":     false,
  "runway-seedance2-fast":false,
  "runway-gen5":          false,
  "veo-3.1":      true,
  "veo-3.1-fast": true,
  "veo-3-fast":   true,
  "veo-3":        true,
  "veo-2":        true,
  "sora-2":       true,
  "kling-master":    true,
  "kling-2.5-turbo": true,
  "kling-2.1":       true,
  "seedance-pro":    true,
  "seedance-fast":   true,
  "hailuo-02-fast":  true,
  "hailuo-02":       true,
  "wan-2.5":              false,
  "wan-2.5-fast":         false,
  "wan-2.5-t2v":          true,
  "seedance-1-lite":      false,
  "kling-3.0-master":     true,
  "kling-3.0-turbo":      true,
  "veo-4":                true,
  "veo-4-fast":           true,
  "minimax-video-01":     true,
  "wan-2.6":                true,   // wan-2.7 soporta T2V
  "wan-2.7":                true,   // wan-2.7 soporta T2V+I2V+R2V
  "kling-3.0-omni":         true,   // Kling Omni soporta T2V+I2V multimodal
  "hailuo-2.3":             true,
  "hailuo-2.3-fast":        false,  // Hailuo 2.3 Fast — I2V only
  "grok-video-1":           true,
  "grok-imagine-video":     true,
  "grok-imagine-video-1.5": true,
  "veo-3.1-lite":           true,
  "wan-2.7-t2v":            true,
  "wan-2.7-i2v":            false,
  "wan-2.7-r2v":            false,
  "kling-v2.1":             true,
  "kling-v2.1-pro":         true,
  "kling-v2.5-turbo-pro":   true,
  "runway-aleph2":          false,
  "runway-happyhorse":      true,
  "kling-v2.6":             true,
  "kling-v2.1-master":      true,
  "wan-2.7-videoedit":      false,
  "seedance-2.0":           true,
  "nvidia-cosmos-2b":       true,
  "nvidia-cosmos-14b":      true,
};

export function modelSupportsTextToVideo(model: VideoModel): boolean {
  return !!T2V_SUPPORTED[model];
}

/**
 * Centralized anti-text guard for any video-generation prompt.
 *
 * The narrative pipeline (Claude director, Multi-shot scripts, user briefs)
 * routinely leaks brand names, CTAs, prices and quoted phrases into video
 * prompts. The video models will then try to "burn" them into frames as
 * garbled hallucinated typography. This guard:
 *   - strips quoted phrases and bracketed brand placeholders
 *   - removes CTA-shaped imperatives ("buy now", "compra ya", "click here")
 *   - removes price tokens ("$19.99", "19,99 €")
 *   - appends a hard ANTI_TEXT instruction tail
 * It runs once before EVERY provider call so cinematic / quick-ad / custom
 * paths cannot silently regress.
 */
const FSP_ANTI_TEXT_TAIL = " ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LOGOS, NO BRAND NAMES, NO CAPTIONS, NO SUBTITLES, NO WATERMARKS, NO TYPOGRAPHY of any kind on any surface. Strict design fidelity, no morphing, no flicker.";
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeVideoPrompt(raw: string, forbiddenTokens?: string[]): string {
  if (!raw) return raw;
  let p = raw;
  // Drop "double-quoted spans" — usually CTAs / brand mentions
  p = p.replace(/[""„«»][^""„«»]{1,80}[""„«»]/g, " ");
  // Drop straight ASCII "..." quotes too
  p = p.replace(/"[^"]{1,80}"/g, " ");
  // Drop bracketed placeholders [BRAND] {{cta}}
  p = p.replace(/[\[{]{1,2}[A-Za-z0-9_\- ]{1,40}[\]}]{1,2}/g, " ");
  // Drop common CTA imperatives (English + Spanish) up to a punctuation boundary
  p = p.replace(/\b(buy now|shop now|click here|claim yours|order today|learn more|sign up|get yours|compra ya|comprar ahora|hazte con|consigue|llama ahora|regístrate|reservar|añadir al carrito)\b[^.,;!?]{0,30}/gi, " ");
  // Drop prices in major formats
  p = p.replace(/[$€£¥]\s?\d{1,5}([.,]\d{1,2})?/g, " ");
  p = p.replace(/\b\d{1,5}[.,]\d{1,2}\s?(€|EUR|USD|GBP|JPY)\b/gi, " ");
  // Drop dynamic forbidden tokens (brand name, product name, CTA copy, …)
  // The cinematic stack passes these explicitly so even when Claude leaks the
  // verbatim brand/product, we strip it before the model burns it as text.
  if (forbiddenTokens && forbiddenTokens.length) {
    for (const tk of forbiddenTokens) {
      const t = (tk || "").trim();
      if (t.length < 2) continue;
      try {
        const re = new RegExp(escapeRegex(t), "gi");
        p = p.replace(re, " ");
      } catch { /* ignore bad token */ }
    }
  }
  // Collapse whitespace
  p = p.replace(/\s+/g, " ").trim();
  // Append the anti-text tail (idempotent — if prompt already contains
  // "no text" we don't re-append). Match on a substring to be permissive.
  if (!/no\s+text/i.test(p)) p = p + FSP_ANTI_TEXT_TAIL;
  return p;
}

export async function generateVideoFromImage(
  model: VideoModel,
  imageBuffer: Buffer | null, imageMime: string,
  prompt: string,
  opts: { duration?: number; aspect?: string; replicateToken?: string; cameraPreset?: string },
): Promise<Buffer> {
  const cfg = VIDEO_MODELS[model];
  if (!cfg) throw new Error(`Modelo de video desconocido: ${model}`);
  const duration = Math.min(Math.max(opts.duration || 5, 3), cfg.maxDuration);
  // Si no hay imagen, exige que el modelo soporte text-to-video puro.
  if (!imageBuffer && !T2V_SUPPORTED[model]) {
    throw new Error(`Modelo "${model}" requiere imagen origen (no soporta text-to-video puro)`);
  }
  // Centralized anti-text-leak guard — strips brand quotes / CTAs / prices
  // from ANY upstream prompt (cinematic, custom briefs).
  prompt = sanitizeVideoPrompt(prompt);
  // Apply camera preset prompt prefix if requested (Pollo-style cinematic
  // grammar). Preset is a no-op when unknown/empty.
  prompt = applyCameraPreset(prompt, opts.cameraPreset);

  // ── Google Veo (Gemini) ────────────────────────────────────────────────
  if (cfg.provider === "gemini") {
    const apiKey = getGeminiKey();
    const ai = new GoogleGenAI({ apiKey });
    const veoModel = cfg.modelId!;
    // Aspect-ratio capabilities (Google docs):
    //   - Veo 2:    16:9 and 9:16, durationSeconds configurable (4-8s)
    //   - Veo 3:    ONLY 16:9, fixed 8s
    //   - Veo 3.1:  16:9 AND 9:16, fixed 8s (audio nativo, mejor identidad)
    const isVeo31 = veoModel.startsWith("veo-3.1");
    const isVeo4  = veoModel.startsWith("veo-4.0");
    const isVeo3X = veoModel.startsWith("veo-3.0") || veoModel === "veo-3.0-generate-preview" || veoModel === "veo-3.0-fast-generate-preview";
    const requested = opts.aspect || "9:16";
    let aspectRatio: string;
    if (isVeo3X) {
      aspectRatio = "16:9"; // Veo 3.0 sólo permite 16:9
    } else {
      // Veo 2, Veo 3.1 y Veo 4 soportan 16:9 y 9:16
      aspectRatio = (requested === "16:9" || requested === "9:16") ? requested : "9:16";
    }
    const veoDur = Math.min(Math.max(opts.duration || 8, 4), 8);

    const config: any = { aspectRatio, numberOfVideos: 1, personGeneration: "allow_all" };
    // Veo 3.x y Veo 4 tienen duración fija (8s); sólo Veo 2 acepta durationSeconds.
    if (!isVeo3X && !isVeo31 && !isVeo4) config.durationSeconds = veoDur;

    const veoArgs: any = {
      model: veoModel,
      prompt: prompt.slice(0, 1500),
      config,
    };
    if (imageBuffer) {
      veoArgs.image = { imageBytes: imageBuffer.toString("base64"), mimeType: imageMime };
    }

    // Google Veo can return "temporarily_saturated" / UNAVAILABLE / 503 under load.
    // These are transient server-side errors — retry up to 2 times with 30s backoff.
    const isVeoTransient = (err: unknown) => {
      const s = String(err).toLowerCase();
      return s.includes("temporarily_saturated") || s.includes("temporarily saturated")
        || s.includes("unavailable") || s.includes("overloaded")
        || s.includes("503") || s.includes("529");
    };
    let operation: any;
    for (let veoAttempt = 0; veoAttempt <= 2; veoAttempt++) {
      try {
        operation = await ai.models.generateVideos(veoArgs);
        break;
      } catch (err) {
        if (veoAttempt < 2 && isVeoTransient(err)) {
          // Google Veo saturado — esperar 30s antes de reintentar
          await new Promise(r => setTimeout(r, 30_000));
          continue;
        }
        // Re-throw with a friendlier message for saturation errors
        if (isVeoTransient(err)) {
          throw new Error("Google Veo está temporalmente saturado — el servicio tiene alta demanda en este momento. Reintenta en 1-2 minutos.");
        }
        throw err;
      }
    }

    const deadline = Date.now() + 6 * 60_000;
    while (!operation.done && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 10_000));
      operation = await ai.operations.getVideosOperation({ operation });
    }
    if (!operation.done) throw new Error("Veo timed out (>6min)");
    const generated = operation?.response?.generatedVideos?.[0];
    if (!generated?.video?.uri) throw new Error("Veo no devolvió video URI");

    const downloadUrl = generated.video.uri.includes("?")
      ? `${generated.video.uri}&key=${apiKey}`
      : `${generated.video.uri}?key=${apiKey}`;
    const r = await fetch(downloadUrl);
    if (!r.ok) throw new Error(`Veo download failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }

  if (cfg.provider === "runway") {
    if (!imageBuffer) throw new Error("Runway requiere imagen origen (image_to_video)");
    const apiKey = getRunwayKey();
    const dataUri = bufferToDataUri(imageBuffer, imageMime);
    // Runway API ratios: gen3a accepts "1280:768" / "768:1280"; gen4 turbo
    // accepts the same plus "1104:832", "832:1104", "960:960", "1584:672".
    // We map common aspect strings to the closest supported value per model.
    const isGen3 = model === "runway-gen3-alpha";
    const ratioMap: Record<string, string> = isGen3 ? {
      "16:9": "1280:768",
      "9:16": "768:1280",
      "4:3": "1280:768",   // gen3a only has horizontal/vertical
      "3:4": "768:1280",
      "4:5": "768:1280",
      "1:1": "768:1280",   // closest supported
      "21:9": "1280:768",
    } : {
      "16:9": "1280:720",
      "9:16": "720:1280",
      "4:3": "1104:832",
      "3:4": "832:1104",
      "4:5": "832:1104",
      "1:1": "960:960",
      "21:9": "1584:672",
    };
    const ratio = ratioMap[opts.aspect || "9:16"] || (isGen3 ? "768:1280" : "720:1280");
    const runwayModel = isGen3 ? "gen3a_turbo"
      : model === "runway-gen4.5" ? "gen4_5"
      : model === "runway-gen4.5-turbo" ? "gen4_5_turbo"
      : model === "runway-seedance2" ? "seedance2"
      : model === "runway-seedance2-fast" ? "seedance2_fast"
      : model === "runway-gen5" ? "gen4_5"
      : model === "runway-aleph2" ? "aleph2"
      : model === "runway-happyhorse" ? "happyhorse_1_0"
      : "gen4_turbo";
    const runwayDur = duration >= 8 ? 10 : 5;

    const createRes = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
      body: JSON.stringify({ model: runwayModel, promptImage: dataUri, promptText: prompt.slice(0, 1000), duration: runwayDur, ratio }),
    });
    if (!createRes.ok) throw new Error(`Runway create failed: ${createRes.status} ${(await createRes.text()).slice(0, 200)}`);
    const { id: taskId } = await createRes.json() as { id: string };

    const deadline = Date.now() + 5 * 60_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 6_000));
      const sr = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
      });
      if (!sr.ok) continue;
      const st = await sr.json() as { status: string; output?: string[]; failure?: string };
      if (st.status === "SUCCEEDED" && st.output?.[0]) return await fetchToBuffer(st.output[0]);
      if (st.status === "FAILED") throw new Error(`Runway failed: ${st.failure}`);
    }
    throw new Error("Runway timed out");
  }

  // ── xAI Grok Imagine Video (T2V + I2V) ───────────────────────────────────
  if (cfg.provider === "xai") {
    const key = getXaiKey();
    const xaiAspectMap: Record<string, string> = {
      "9:16": "9:16", "16:9": "16:9", "1:1": "1:1",
      "4:3": "4:3", "3:4": "3:4", "3:2": "3:2", "2:3": "2:3",
    };
    const body: any = {
      model: cfg.modelId!,
      prompt,
      duration: Math.min(Math.max(duration, 1), 15),
      aspect_ratio: xaiAspectMap[opts.aspect || "9:16"] || "9:16",
      resolution: "720p",
    };
    if (imageBuffer) {
      body.image = { url: bufferToDataUri(imageBuffer, imageMime) };
    }
    const createRes = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) throw new Error(`xAI video create failed: ${createRes.status} ${(await createRes.text()).slice(0, 300)}`);
    const { request_id } = await createRes.json() as { request_id: string };
    const videoUrl = await pollXaiVideo(request_id, key);
    return await fetchToBuffer(videoUrl);
  }

  // ── NVIDIA NIM video generation (Cosmos 2B / 14B)
  // Fallback: si NVIDIA_API_KEY ausente o falla → seedance-fast vía Replicate
  if (cfg.provider === "nvidia") {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey && cfg.modelId) {
      try {
        const nvidiaVidRes = await fetch("https://integrate.api.nvidia.com/v1/videos/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cfg.modelId,
            prompt,
            duration: Math.min(duration, cfg.maxDuration),
            aspect_ratio: opts.aspect || "16:9",
          }),
          signal: AbortSignal.timeout(180_000),
        });
        if (nvidiaVidRes.ok) {
          const nvidiaVidData = await nvidiaVidRes.json() as { data?: Array<{ url?: string; b64_json?: string }> };
          const vidUrl = nvidiaVidData.data?.[0]?.url;
          if (vidUrl) return fetchToBuffer(vidUrl);
          const b64 = nvidiaVidData.data?.[0]?.b64_json;
          if (b64) return Buffer.from(b64, "base64");
        }
      } catch { /* fall through to Replicate fallback */ }
    }
    // Fallback to seedance-fast via Replicate. (Antes llamaba a generateVideo, que no
    // existe en este módulo: el respaldo lanzaba ReferenceError.) El prompt ya lleva
    // aplicado el preset de cámara, así que no se vuelve a pasar.
    return generateVideoFromImage("seedance-fast", imageBuffer, imageMime, prompt, { ...opts, cameraPreset: undefined });
  }

  // Replicate (T2V o I2V según haya imagen)
  if (!cfg.modelId) throw new Error(`Modelo ${model} sin modelId`);
  const token = getReplicateToken(opts.replicateToken);
  const dataUri = imageBuffer ? bufferToDataUri(imageBuffer, imageMime) : null;
  const aspect = opts.aspect || "9:16";
  let input: any;
  if (cfg.modelId.startsWith("bytedance/")) {
    // Seedance: image opcional, T2V puro soportado
    input = { prompt, duration, resolution: "1080p", aspect_ratio: aspect };
    if (dataUri) input.image = dataUri;
  } else if (cfg.modelId.startsWith("kwaivgi/")) {
    // Kling: start_image opcional, T2V puro soportado en v2.1
    input = { prompt, duration, aspect_ratio: aspect };
    if (dataUri) input.start_image = dataUri;
  } else if (cfg.modelId.startsWith("minimax/")) {
    // Hailuo: first_frame_image opcional
    input = { prompt, duration };
    if (dataUri) input.first_frame_image = dataUri;
  } else if (cfg.modelId === "wan-video/wan-2.5-t2v") {
    // Wan 2.5 T2V: text-to-video puro, no requiere imagen
    input = { prompt, size: "480p", duration: Math.min(duration, 5) };
  } else if (cfg.modelId.startsWith("wan-video/")) {
    // Wan-2.5 i2v: requiere image
    if (!dataUri) throw new Error(`${model} requiere imagen origen`);
    input = { prompt, image: dataUri, duration };
  } else if (cfg.modelId.startsWith("openai/sora")) {
    // OpenAI Sora 2 (vía Replicate openai/sora-2). Schema verificado:
    //   - prompt (string, requerido)
    //   - seconds (4 | 8 | 12, default 4)
    //   - aspect_ratio ("portrait" | "landscape", default "portrait")
    //   - input_reference (URL/data-URI, OPCIONAL — primera frame para I2V;
    //     debe matchear el aspect_ratio elegido)
    const soraDur = duration >= 12 ? 12 : duration >= 8 ? 8 : 4;
    const soraAspect = aspect === "16:9" ? "landscape" : "portrait";
    input = { prompt, seconds: soraDur, aspect_ratio: soraAspect };
    if (dataUri) input.input_reference = dataUri;
  } else {
    input = { prompt, duration };
    if (dataUri) input.image = dataUri;
  }

  return await replicateRunBuffer(cfg.modelId, input, token);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 10b: xAI VIDEO EXTENSION + EDITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extiende un vídeo existente por la cola usando xAI Grok Imagine Video.
 * El resultado es el vídeo original + la extensión concatenados.
 *
 * @param videoUrl  URL pública del vídeo origen (2-15s MP4). Acepta data-URI base64.
 * @param prompt    Descripción de qué debe ocurrir en la extensión.
 * @param extensionDurationSec  Duración de la extensión (2-10s, default 6).
 * @param model     Modelo xAI a usar (default: grok-imagine-video).
 */
export async function extendXaiVideo(
  videoUrl: string,
  prompt: string,
  extensionDurationSec = 6,
  model: "grok-imagine-video" | "grok-imagine-video-1.5-preview" = "grok-imagine-video",
): Promise<Buffer> {
  const key = getXaiKey();
  const dur = Math.min(Math.max(extensionDurationSec, 2), 10);
  const createRes = await fetch("https://api.x.ai/v1/videos/extensions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, duration: dur, video: { url: videoUrl } }),
  });
  if (!createRes.ok) throw new Error(`xAI extend-video failed: ${createRes.status} ${(await createRes.text()).slice(0, 300)}`);
  const { request_id } = await createRes.json() as { request_id: string };
  const outUrl = await pollXaiVideo(request_id, key, 10 * 60_000);
  return await fetchToBuffer(outUrl);
}

/**
 * Edita el contenido de un vídeo corto (max 8.7s) siguiendo instrucciones en lenguaje natural.
 * El output mantiene las especificaciones del input (resolución capada a 720p).
 *
 * @param videoUrl  URL pública del vídeo origen (max 8.7s MP4). Acepta data-URI base64.
 * @param prompt    Instrucción de edición (qué cambiar, qué añadir, qué quitar).
 * @param model     Modelo xAI a usar (default: grok-imagine-video).
 */
export async function editXaiVideo(
  videoUrl: string,
  prompt: string,
  model: "grok-imagine-video" | "grok-imagine-video-1.5-preview" = "grok-imagine-video",
): Promise<Buffer> {
  const key = getXaiKey();
  const createRes = await fetch("https://api.x.ai/v1/videos/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, video: { url: videoUrl } }),
  });
  if (!createRes.ok) throw new Error(`xAI edit-video failed: ${createRes.status} ${(await createRes.text()).slice(0, 300)}`);
  const { request_id } = await createRes.json() as { request_id: string };
  const outUrl = await pollXaiVideo(request_id, key, 10 * 60_000);
  return await fetchToBuffer(outUrl);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 11: FFMPEG COMPOSITION (final ad assembly)
// ═══════════════════════════════════════════════════════════════════════════

export interface ComposeOptions {
  videoBuffer: Buffer;
  voiceBuffer?: Buffer;
  musicBuffer?: Buffer;
  voiceVolume?: number;       // 0-1, default 1.0
  musicVolume?: number;       // 0-1, default 0.25
  fadeMs?: number;            // fade in/out for audio
  overlayText?: { text: string; position: "top" | "center" | "bottom"; fontSize?: number; color?: string };
}

export async function composeAd(opts: ComposeOptions): Promise<Buffer> {
  const tmp = await makeTmpDir("compose");
  try {
    const videoPath = path.join(tmp, "video.mp4");
    const outPath = path.join(tmp, "final.mp4");
    await fs.writeFile(videoPath, opts.videoBuffer);

    let voicePath: string | null = null;
    let musicPath: string | null = null;
    if (opts.voiceBuffer) {
      voicePath = path.join(tmp, "voice.mp3");
      await fs.writeFile(voicePath, opts.voiceBuffer);
    }
    if (opts.musicBuffer) {
      musicPath = path.join(tmp, "music.mp3");
      await fs.writeFile(musicPath, opts.musicBuffer);
    }

    const ffmpeg = await loadFfmpeg();

    return await new Promise<Buffer>((resolve, reject) => {
      const cmd = ffmpeg().input(videoPath);
      if (voicePath) cmd.input(voicePath);
      if (musicPath) cmd.input(musicPath);

      const filters: string[] = [];
      let audioOut: string | null = null;

      if (voicePath && musicPath) {
        const vv = opts.voiceVolume ?? 1.0;
        const mv = opts.musicVolume ?? 0.25;
        filters.push(`[1:a]volume=${vv}[voice]`);
        filters.push(`[2:a]volume=${mv}[music]`);
        filters.push(`[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[aout]`);
        audioOut = "aout";
      } else if (voicePath) {
        filters.push(`[1:a]volume=${opts.voiceVolume ?? 1.0}[aout]`);
        audioOut = "aout";
      } else if (musicPath) {
        filters.push(`[1:a]volume=${opts.musicVolume ?? 0.5}[aout]`);
        audioOut = "aout";
      }

      // Optional text overlay
      if (opts.overlayText) {
        const { text, position, fontSize = 48, color = "white" } = opts.overlayText;
        const y = position === "top" ? "h*0.08" : position === "center" ? "(h-text_h)/2" : "h*0.85";
        // Escape text for ffmpeg
        const safe = text.replace(/'/g, "\\'").replace(/:/g, "\\:");
        filters.push(`[0:v]drawtext=text='${safe}':fontcolor=${color}:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.5:boxborderw=20[vout]`);
      }

      if (filters.length) {
        // FIX CRÍTICO (audio-only bug): la versión anterior mapeaba SOLO
        // [audioOut] cuando había voz/música pero no overlayText, lo que hacía
        // que FFmpeg dropease silenciosamente el video stream y produjera un
        // MP4 sin video (síntoma reportado: "el anuncio sale solo con audio").
        //
        // Nota técnica: fluent-ffmpeg envuelve cualquier label del map con
        // brackets, así que no podemos pasar "0:v" en el map (FFmpeg lo
        // interpretaría como un label inexistente). Por eso, cuando no hay
        // overlayText, añadimos un `null` passthrough filter que reetiqueta
        // [0:v] como [vpass] (coste cero, no recodifica) y lo incluimos en
        // el map para garantizar la pista de video en el output.
        let videoLabel: string;
        if (opts.overlayText) {
          videoLabel = "vout";
        } else {
          filters.push(`[0:v]null[vpass]`);
          videoLabel = "vpass";
        }
        const map: string[] = audioOut ? [videoLabel, audioOut] : [videoLabel];
        cmd.complexFilter(filters, map);
      }

      cmd.videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions(["-pix_fmt yuv420p", "-movflags +faststart", "-shortest"])
        .on("end", async () => {
          try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        })
        .on("error", (err: Error) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 11.5: CONCATENATE MULTIPLE VIDEO CLIPS INTO ONE
// ═══════════════════════════════════════════════════════════════════════════

export interface ConcatOptions {
  /** Source video clips in order */
  videoBuffers: Buffer[];
  /** Output resolution (default 1080x1920 vertical, use 1920x1080 for horizontal). */
  width?: number;
  height?: number;
  /** Optional fps normalization (default 30) */
  fps?: number;
  /** Optional crossfade in seconds between clips (0 = hard cut) */
  crossfadeSec?: number;
  /**
   * Optional thematic transition preset key (see TRANSITION_PRESETS).
   * Overrides the xfade type and, if `crossfadeSec` is not provided, also the
   * default duration. Backward-compatible: old callers who only pass
   * `crossfadeSec` keep the legacy "fade" transition.
   */
  transitionPreset?: string;
  /**
   * Optional explicit clip durations in seconds. Required for accurate xfade
   * offsets when `crossfadeSec` > 0. If omitted while crossfade is enabled,
   * `concatVideos` probes each clip with ffprobe to detect duration.
   */
  clipDurationsSec?: number[];
  /** Optional voiceover/music to mux on top of the concatenated stream */
  voiceBuffer?: Buffer;
  musicBuffer?: Buffer;
  voiceVolume?: number;
  musicVolume?: number;
}

/**
 * Load fluent-ffmpeg and configure binary paths.
 * Tries `ffmpeg-static`/`ffprobe-static` first (works in dev). If those return
 * paths that don't exist on disk (common in pnpm + bundled production builds),
 * falls back to the system `ffmpeg`/`ffprobe` resolved via PATH (which is
 * always available in the Replit Nix runtime).
 */
export async function loadFfmpeg(): Promise<any> {
  let ffmpeg: any;
  try {
    ffmpeg = (await import("fluent-ffmpeg")).default;
  } catch {
    throw new Error("FFmpeg no disponible. Run: pnpm add fluent-ffmpeg ffmpeg-static @types/fluent-ffmpeg");
  }
  const fsSync = await import("node:fs");
  try {
    const p = (await import("ffmpeg-static")).default as unknown as string;
    if (p && fsSync.existsSync(p)) ffmpeg.setFfmpegPath(p);
  } catch { /* fall through to system PATH */ }
  try {
    // ffprobe-static is optional; not declared in deps. If absent, fall back to PATH.
    // @ts-ignore – optional runtime-only dependency
    const pp = ((await import("ffprobe-static")).default as any)?.path;
    if (pp && fsSync.existsSync(pp)) ffmpeg.setFfprobePath(pp);
  } catch { /* fall through to system PATH */ }
  return ffmpeg;
}

/** Probe a video file with ffprobe and return its duration in seconds. */
async function probeDurationSec(filePath: string): Promise<number> {
  const ffmpeg: any = await loadFfmpeg();
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: any) => {
      if (err) return reject(err);
      const dur = data?.format?.duration;
      const n = typeof dur === "number" ? dur : parseFloat(String(dur));
      if (!isFinite(n) || n <= 0) return reject(new Error("ffprobe: duración inválida"));
      resolve(n);
    });
  });
}

/**
 * Locución del guion con ElevenLabs ajustada a la duración real del vídeo
 * (TTS → ffprobe del vídeo → fitVoiceToVideo). Devuelve un mp3 de la misma
 * duración que el vídeo.
 */
export async function voiceoverForVideo(videoBuffer: Buffer, script: string, voiceId: string, languageCode?: string): Promise<Buffer> {
  const tmp = await makeTmpDir("voiceover");
  try {
    const videoPath = path.join(tmp, "video.mp4");
    await fs.writeFile(videoPath, videoBuffer);
    const videoSec = await probeDurationSec(videoPath);
    const rawVoice = await generateTTS(script, { voiceId, languageCode });
    return await fitVoiceToVideo(rawVoice, videoSec);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Adjust a voiceover Buffer so the speech ends at LEAST 1s before the target
 * video duration — and the audio stream's TOTAL length equals the video's
 * length exactly (padded with silence). This eliminates the "voice cut off
 * at the end" artifact in Sakura/AdStudio renders.
 *
 *  - If voice is shorter than (target - 1s): keep it, append silence so
 *    audio total length == target.
 *  - If voice is longer than (target - 1s): apply `atempo` speed-up
 *    (capped at 1.12x, transparent to the ear, preserves pitch). If that
 *    is still not enough, hard-trim with a 0.4s fade-out, then pad 1s of
 *    silence so the audio stream is exactly `target` seconds long.
 *
 * Always returns an mp3 of EXACTLY `targetVideoSec` seconds.
 */
export async function fitVoiceToVideo(
  voiceBuffer: Buffer,
  targetVideoSec: number,
): Promise<Buffer> {
  const tailSilenceSec = 1.0;
  const speechBudget = Math.max(2, targetVideoSec - tailSilenceSec);
  const tmp = await makeTmpDir("voicefit");
  try {
    const inPath = path.join(tmp, "in.mp3");
    const outPath = path.join(tmp, "out.mp3");
    await fs.writeFile(inPath, voiceBuffer);
    const ffmpeg: any = await loadFfmpeg();
    const inDur = await probeDurationSec(inPath).catch(() => speechBudget);

    const atempo = inDur > speechBudget
      ? Math.min(1.12, inDur / speechBudget)
      : 1.0;
    const adjustedDur = inDur / atempo;
    const needsTrim = adjustedDur > speechBudget + 0.05;

    return await new Promise<Buffer>((resolve, reject) => {
      const cmd = ffmpeg(inPath);
      const filters: string[] = [];
      if (atempo !== 1.0) filters.push(`atempo=${atempo.toFixed(4)}`);
      if (needsTrim) {
        const trimAt = Math.max(0.5, speechBudget);
        const fadeStart = Math.max(0, trimAt - 0.4);
        filters.push(`atrim=duration=${trimAt.toFixed(3)}`);
        filters.push(`asetpts=PTS-STARTPTS`);
        filters.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=0.4`);
      }
      // Pad with silence so total stream length == targetVideoSec exactly.
      // apad with whole_dur fills up to the requested total length.
      filters.push(`apad=whole_dur=${targetVideoSec.toFixed(3)}`);

      cmd.audioFilter(filters.join(","));
      cmd.audioCodec("libmp3lame")
        .audioBitrate("192k")
        .outputOptions([`-t ${targetVideoSec.toFixed(3)}`])
        .on("end", async () => {
          try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        })
        .on("error", (err: Error) => reject(new Error(`fitVoiceToVideo error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract the last visible frame of a video as a PNG image. Used by the
 * "locked-shot" composition mode so the next clip can be image-to-video
 * generated FROM the previous clip's last frame, producing a seamless
 * single-take feel (no camera/composition jump between clips).
 */
export async function extractLastFrame(videoBuffer: Buffer): Promise<{ buffer: Buffer; mime: string }> {
  const tmp = await makeTmpDir("lastframe");
  try {
    const inPath = path.join(tmp, "in.mp4");
    const outPath = path.join(tmp, "lastframe.png");
    await fs.writeFile(inPath, videoBuffer);
    const ffmpeg: any = await loadFfmpeg();
    const dur = await probeDurationSec(inPath).catch(() => 5);
    const seekTo = Math.max(0, dur - 0.08);
    return await new Promise<{ buffer: Buffer; mime: string }>((resolve, reject) => {
      ffmpeg(inPath)
        .seekInput(seekTo.toFixed(3))
        .frames(1)
        // Lock the PNG to the source video's native dims (scale=iw:ih is a
        // no-op on dimensions but forces a clean rescale path so the PNG
        // pixel grid matches the video stream byte-for-byte; some image-to-
        // video providers reject sources whose aspect doesn't match the
        // requested aspect to the pixel).
        .videoFilter("scale=iw:ih")
        .outputOptions(["-update 1", "-q:v 2"])
        .on("end", async () => {
          try {
            const buf = await fs.readFile(outPath);
            resolve({ buffer: buf, mime: "image/png" });
          } catch (e) { reject(e); }
        })
        .on("error", (err: Error) => reject(new Error(`extractLastFrame error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Concatenate N video clips into a single MP4. Re-encodes for compatibility
 * (different sources can have different codecs/resolutions). Optional crossfade
 * between clips and optional audio overlay (voice + music).
 */
export async function concatVideos(opts: ConcatOptions): Promise<Buffer> {
  if (!opts.videoBuffers?.length) throw new Error("concatVideos: videoBuffers vacío");
  if (opts.videoBuffers.length === 1 && !opts.voiceBuffer && !opts.musicBuffer) {
    return opts.videoBuffers[0];
  }
  const tmp = await makeTmpDir("concat");
  const w = opts.width ?? 1080;
  const h = opts.height ?? 1920;
  const fps = opts.fps ?? 30;
  // Resolve transition preset (if any) → xfade type + default duration.
  const presetCfg = opts.transitionPreset ? TRANSITION_PRESETS[opts.transitionPreset] : null;
  const xfadeType = presetCfg?.xfade || "fade";
  const crossfade = Math.max(
    0,
    opts.crossfadeSec ?? presetCfg?.defaultDurationSec ?? 0,
  );
  // hard_cut preset forces no crossfade regardless of duration.
  const useCrossfade = !!xfadeType && crossfade > 0;
  try {
    // Write each clip to disk
    const inputPaths: string[] = [];
    for (let i = 0; i < opts.videoBuffers.length; i++) {
      const p = path.join(tmp, `clip_${i}.mp4`);
      await fs.writeFile(p, opts.videoBuffers[i]);
      inputPaths.push(p);
    }
    const outPath = path.join(tmp, "concat.mp4");

    const ffmpeg: any = await loadFfmpeg();

    // Compute the EXACT final video duration (after crossfade overlap removal)
    // so we can fit the voice to it (audio must end ~1s BEFORE video to avoid
    // the "voice cut off" symptom in Sakura/AdStudio renders).
    const probedDurations = opts.clipDurationsSec && opts.clipDurationsSec.length === inputPaths.length
      ? opts.clipDurationsSec.map(d => Math.max(0.5, Number(d) || 5))
      : await Promise.all(inputPaths.map(p => probeDurationSec(p).catch(() => 5)));
    const totalRaw = probedDurations.reduce((s, d) => s + d, 0);
    const finalVideoSec = useCrossfade && inputPaths.length > 1
      ? Math.max(0.5, totalRaw - crossfade * (inputPaths.length - 1))
      : totalRaw;

    // Pre-write voice/music to disk. Voice is ALWAYS run through fitVoiceToVideo
    // so the speech ends 1s before video end, and the audio total length equals
    // video length exactly (padded with silence).
    if (opts.voiceBuffer) {
      const fittedVoice = await fitVoiceToVideo(opts.voiceBuffer, finalVideoSec);
      await fs.writeFile(path.join(tmp, "voice.mp3"), fittedVoice);
      opts = { ...opts, voiceBuffer: fittedVoice };
    }
    if (opts.musicBuffer) await fs.writeFile(path.join(tmp, "music.mp3"), opts.musicBuffer);

    // If crossfade is requested, we need accurate per-clip durations to compute
    // xfade offsets. Use explicit durations if provided, otherwise probe each
    // clip with ffprobe.
    let durations: number[] | null = null;
    if (useCrossfade && inputPaths.length > 1) {
      if (opts.clipDurationsSec && opts.clipDurationsSec.length === inputPaths.length) {
        durations = opts.clipDurationsSec.map(d => Math.max(0.5, Number(d) || 5));
      } else {
        durations = await Promise.all(inputPaths.map(p => probeDurationSec(p).catch(() => 5)));
      }
    }

    return await new Promise<Buffer>((resolve, reject) => {
      const cmd = ffmpeg();
      for (const p of inputPaths) cmd.input(p);

      // Build filter graph: normalize each input to same w/h/fps, then concat
      const N = inputPaths.length;
      const filters: string[] = [];
      for (let i = 0; i < N; i++) {
        filters.push(`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${fps}[v${i}]`);
      }

      if (useCrossfade && N > 1 && durations) {
        // Chain xfade with REAL clip durations. The offset of xfade on the
        // i-th transition is the cumulative duration of clips 0..i-1 minus
        // (i * crossfade) — i.e. each transition removes `crossfade` seconds
        // of overlap from the running timeline. The transition VISUAL is
        // selected by `xfadeType` (legacy default = "fade").
        let prev = "v0";
        let runningEnd = durations[0];
        for (let i = 1; i < N; i++) {
          const out = i === N - 1 ? "vout" : `xf${i}`;
          const offset = Math.max(0, runningEnd - crossfade);
          filters.push(`[${prev}][v${i}]xfade=transition=${xfadeType}:duration=${crossfade}:offset=${offset.toFixed(3)}[${out}]`);
          prev = out;
          runningEnd = offset + durations[i]; // new timeline length after this xfade
        }
      } else {
        // Simple concat (hard cuts) — no per-clip duration needed
        const concatInputs = Array.from({ length: N }, (_, i) => `[v${i}]`).join("");
        filters.push(`${concatInputs}concat=n=${N}:v=1:a=0[vout]`);
      }

      const outputMaps: string[] = ["vout"];

      // Audio overlay (optional)
      const audioInputs: number[] = [];
      if (opts.voiceBuffer) {
        const vp = path.join(tmp, "voice.mp3");
        require("node:fs").writeFileSync(vp, opts.voiceBuffer);
        cmd.input(vp);
        audioInputs.push(N + audioInputs.length);
      }
      if (opts.musicBuffer) {
        const mp = path.join(tmp, "music.mp3");
        require("node:fs").writeFileSync(mp, opts.musicBuffer);
        cmd.input(mp);
        audioInputs.push(N + audioInputs.length);
      }
      if (audioInputs.length === 1) {
        const isVoice = !!opts.voiceBuffer;
        filters.push(`[${audioInputs[0]}:a]volume=${(isVoice ? opts.voiceVolume : opts.musicVolume) ?? 1.0}[aout]`);
        outputMaps.push("aout");
      } else if (audioInputs.length === 2) {
        // Trim music to the EXACT video length (with 0.4s fade-out tail) so
        // it can never extend past the video — `amix=duration=first` then
        // anchors the mix to the voice (which is already exactly finalVideoSec).
        filters.push(`[${audioInputs[0]}:a]volume=${opts.voiceVolume ?? 1.0}[av]`);
        filters.push(`[${audioInputs[1]}:a]volume=${opts.musicVolume ?? 0.25},atrim=duration=${finalVideoSec.toFixed(3)},afade=t=out:st=${Math.max(0, finalVideoSec - 0.4).toFixed(3)}:d=0.4[am]`);
        filters.push(`[av][am]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
        outputMaps.push("aout");
      }

      cmd.complexFilter(filters, outputMaps);
      cmd.videoCodec("libx264")
        .audioCodec(audioInputs.length ? "aac" : "copy")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          // No -shortest: the voice has been pre-fitted to exactly match
          // finalVideoSec (with 1s tail of silence), so the video stream
          // governs the output length and the voiceover never gets cut off.
          ...(audioInputs.length ? [`-t ${finalVideoSec.toFixed(3)}`] : []),
        ])
        .on("end", async () => {
          try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        })
        .on("error", (err: Error) => reject(new Error(`FFmpeg concat error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 12: DOWNLOAD ALL AS ZIP (export all generated assets)
// ═══════════════════════════════════════════════════════════════════════════

export async function packAssetsAsZip(
  files: Array<{ name: string; buffer: Buffer }>,
): Promise<Buffer> {
  // Use archiver if available; fallback to a simple zip builder via child_process
  let archiver: any;
  try {
    archiver = (await import("archiver")).default;
  } catch {
    throw new Error("archiver no instalado. Run: pnpm add archiver @types/archiver");
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    for (const f of files) archive.append(f.buffer, { name: f.name });
    archive.finalize();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 13: CAMERA & TRANSITION PRESETS (Pollo-style cinematic grammar)
// ═══════════════════════════════════════════════════════════════════════════

/** Camera-control presets injected as a prompt prefix for video generation. */
export const CAMERA_PRESETS: Record<string, { label: string; promptPrefix: string }> = {
  static:        { label: "Static / Locked-off",   promptPrefix: "Static locked-off camera, no movement, tripod-mounted." },
  push_in:       { label: "Push in",               promptPrefix: "Slow steady push-in camera move, subject grows in frame." },
  pull_out:      { label: "Pull out",              promptPrefix: "Slow steady pull-out, revealing more of the scene." },
  dolly_in:      { label: "Dolly in",              promptPrefix: "Smooth dolly-in on rails, parallax background, cinematic." },
  dolly_out:     { label: "Dolly out",             promptPrefix: "Smooth dolly-out on rails, gradual reveal of the environment." },
  orbit_left:    { label: "Orbit left",            promptPrefix: "Camera orbits 180° around the subject from right to left, smooth arc." },
  orbit_right:   { label: "Orbit right",           promptPrefix: "Camera orbits 180° around the subject from left to right, smooth arc." },
  pan_left:      { label: "Pan left",              promptPrefix: "Slow horizontal pan from right to left, locked elevation." },
  pan_right:     { label: "Pan right",             promptPrefix: "Slow horizontal pan from left to right, locked elevation." },
  tilt_up:       { label: "Tilt up",               promptPrefix: "Vertical tilt-up reveal, base to top, gradual disclosure." },
  tilt_down:     { label: "Tilt down",             promptPrefix: "Vertical tilt-down reveal, top to base." },
  zoom_in:       { label: "Zoom in",               promptPrefix: "Slow optical zoom-in, focal length lengthens, depth compresses." },
  crash_zoom:    { label: "Crash zoom",            promptPrefix: "Aggressive snap-zoom into the subject, energetic punch-in, hold on subject." },
  crane_up:      { label: "Crane up",              promptPrefix: "Crane shot lifting upward and forward, vertical rise with subtle forward push." },
  crane_down:    { label: "Crane down",            promptPrefix: "Crane shot descending from above to subject's eye-line." },
  handheld:      { label: "Handheld",              promptPrefix: "Handheld documentary-style camera, subtle organic shake, energetic immediacy." },
  parallax:      { label: "Parallax",              promptPrefix: "Side-tracking parallax move, foreground/background depth separation." },
  fpv_drone:     { label: "FPV drone",             promptPrefix: "First-person-view drone shot, sweeping motion through the space, fluid trajectory." },
  whip_pan:      { label: "Whip pan",              promptPrefix: "Fast whip-pan transition, motion blur peak, lands on subject." },
  bullet_time:   { label: "Bullet time",           promptPrefix: "Time slows, camera orbits while subject is frozen mid-action, Matrix-style." },
};

/** Apply a camera preset prompt prefix; safe no-op when preset is unknown/empty. */
export function applyCameraPreset(prompt: string, preset?: string): string {
  if (!preset) return prompt;
  const p = CAMERA_PRESETS[preset];
  if (!p) return prompt;
  // Avoid double-prefix if user already wrote the preset description.
  const head = p.promptPrefix.split(",")[0].toLowerCase();
  if (prompt.toLowerCase().includes(head)) return prompt;
  return `${p.promptPrefix} ${prompt}`.trim();
}

/**
 * Transition presets map to FFmpeg `xfade` transition names plus optional
 * post-transition color grading hints (we keep this minimal for stability).
 * `crossfadeSec` from ConcatOptions still controls duration; the preset only
 * picks the visual style.
 */
export const TRANSITION_PRESETS: Record<string, { label: string; xfade: string; defaultDurationSec: number }> = {
  hard_cut:        { label: "Hard cut",                xfade: "",            defaultDurationSec: 0   },
  cross_dissolve:  { label: "Cross dissolve",          xfade: "fade",        defaultDurationSec: 0.4 },
  fade_to_black:   { label: "Fade to black",           xfade: "fadeblack",   defaultDurationSec: 0.6 },
  white_flash:     { label: "White flash",             xfade: "fadewhite",   defaultDurationSec: 0.25 },
  dissolve_grain:  { label: "Dissolve",                xfade: "dissolve",    defaultDurationSec: 0.5 },
  hand_swipe_l:    { label: "Hand swipe left",         xfade: "wipeleft",    defaultDurationSec: 0.4 },
  hand_swipe_r:    { label: "Hand swipe right",        xfade: "wiperight",   defaultDurationSec: 0.4 },
  slide_up:        { label: "Slide up",                xfade: "slideup",     defaultDurationSec: 0.4 },
  slide_down:      { label: "Slide down",              xfade: "slidedown",   defaultDurationSec: 0.4 },
  zoom_punch:      { label: "Zoom punch",              xfade: "zoomin",      defaultDurationSec: 0.35 },
  iris_open:       { label: "Iris open",               xfade: "circleopen",  defaultDurationSec: 0.5 },
  iris_close:      { label: "Iris close",              xfade: "circleclose", defaultDurationSec: 0.5 },
  smoke_blur:      { label: "Smoke blur",              xfade: "hblur",       defaultDurationSec: 0.5 },
  glitch_pixel:    { label: "Glitch pixelize",         xfade: "pixelize",    defaultDurationSec: 0.3 },
  splash_circle:   { label: "Splash",                  xfade: "circlecrop",  defaultDurationSec: 0.45 },
  diagonal_tl:     { label: "Diagonal top-left",       xfade: "diagtl",      defaultDurationSec: 0.4 },
  cover_left:      { label: "Cover left",              xfade: "coverleft",   defaultDurationSec: 0.4 },
  reveal_right:    { label: "Reveal right",            xfade: "revealright", defaultDurationSec: 0.4 },
};

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 14: REPLICATE LATEST-VERSION HELPER (auto-resolves model version)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run a Replicate model by `owner/name` (no hash needed). Auto-resolves the
 * latest published version. Returns the first output URL fetched as a Buffer.
 * Throws a clear error if the model doesn't exist or the user must update env.
 */
async function replicateRunLatestBuffer(
  ownerName: string,
  input: Record<string, unknown>,
  token: string,
  timeoutMs = 5 * 60_000,
): Promise<Buffer> {
  if (!token) throw new Error("REPLICATE_API_TOKEN no configurado");
  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: token });
  const [owner, name] = ownerName.split("/");
  if (!owner || !name) throw new Error(`Modelo Replicate inválido: ${ownerName}`);
  let model: any;
  try {
    model = await rep.models.get(owner, name);
  } catch (err: any) {
    throw new Error(`Modelo Replicate ${ownerName} no encontrado: ${err?.message ?? err}`);
  }
  const versionId = model?.latest_version?.id;
  if (!versionId) throw new Error(`Modelo ${ownerName} sin latest_version (cuenta sin acceso?)`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let prediction: any;
  try {
    prediction = await rep.predictions.create({ version: versionId, input });
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
      if (ctrl.signal.aborted) throw new Error("Replicate timeout");
      await new Promise((r) => setTimeout(r, 3000));
      prediction = await rep.predictions.get(prediction.id);
    }
  } finally { clearTimeout(t); }
  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate ${ownerName} ${prediction.status}: ${String(prediction.error ?? "").slice(0, 200)}`);
  }
  const out = prediction.output;
  let url: string | null = null;
  if (typeof out === "string" && out.startsWith("http")) url = out;
  else if (Array.isArray(out) && typeof out[0] === "string") url = out[0];
  else if (out && typeof out.url === "string") url = out.url;
  if (!url) throw new Error(`Replicate ${ownerName} salida no reconocida`);
  return await fetchToBuffer(url);
}

/** Run a Replicate model by latest version and return raw JSON output (no fetch). */
async function replicateRunLatestJson(
  ownerName: string,
  input: Record<string, unknown>,
  token: string,
  timeoutMs = 5 * 60_000,
): Promise<unknown> {
  if (!token) throw new Error("REPLICATE_API_TOKEN no configurado");
  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: token });
  const [owner, name] = ownerName.split("/");
  const model = await rep.models.get(owner, name);
  const versionId = model?.latest_version?.id;
  if (!versionId) throw new Error(`Modelo ${ownerName} sin latest_version`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let prediction: any;
  try {
    prediction = await rep.predictions.create({ version: versionId, input });
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
      if (ctrl.signal.aborted) throw new Error("Replicate timeout");
      await new Promise((r) => setTimeout(r, 3000));
      prediction = await rep.predictions.get(prediction.id);
    }
  } finally { clearTimeout(t); }
  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate ${ownerName} ${prediction.status}: ${String(prediction.error ?? "").slice(0, 200)}`);
  }
  return prediction.output;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 15: LIP-SYNC (video + audio → video with synced lips)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply lip-sync to a video using a separate audio track. Default model is
 * `cudanexus/lipsync-v2` (good quality, fast). Override with env
 * REPLICATE_LIPSYNC_MODEL or the `model` opt to swap in `lucataco/wav2lip`,
 * `bytedance/sync-2.0`, or any compatible video+audio→video Replicate model.
 *
 * Both buffers are uploaded as data URIs. The model response URL is fetched
 * back and returned as a Buffer (MP4).
 */
export async function lipSyncVideoToAudio(
  videoBuffer: Buffer,
  audioBuffer: Buffer,
  opts: { model?: string; replicateToken?: string; videoMime?: string; audioMime?: string } = {},
): Promise<Buffer> {
  const token = getReplicateToken(opts.replicateToken);
  const modelName = opts.model
    ?? process.env.REPLICATE_LIPSYNC_MODEL
    ?? "cudanexus/lipsync-v2";
  const videoMime = opts.videoMime ?? "video/mp4";
  const audioMime = opts.audioMime ?? "audio/mpeg";
  const input: Record<string, unknown> = {
    video: bufferToDataUri(videoBuffer, videoMime),
    audio: bufferToDataUri(audioBuffer, audioMime),
  };
  return replicateRunLatestBuffer(modelName, input, token, 8 * 60_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 15.5: PER-SCENE INTELLIGENT LIP-SYNC
// ───────────────────────────────────────────────────────────────────────────
// UGC contract: "person on screen → mouth must lip-sync; person off screen
// (b-roll / product macro) → same speaker continues as voice-over". This
// helper takes the FULL continuous voiceover (one ElevenLabs render — same
// timbre, same speaker, coherent speech) and a list of scene clips with
// their `hasPerson` flag, then:
//   1. Slices the voiceover into per-scene segments by timeline offsets
//   2. For each `hasPerson=true` clip → runs Replicate lip-sync against its
//      audio segment (the lips will move EXACTLY when the speaker says those
//      words during that scene's slot)
//   3. For each `hasPerson=false` clip → returns the visual unchanged
//      (the same continuous voiceover will be muxed on top in compose step
//      → naturally becomes voice-over for that shot)
// Result: the FINAL video has ONE continuous voice across all scenes, but
// the lips only move when there's a person visible. Switching between
// presenter and product shots feels organic — the speaker never "stops".
// ═══════════════════════════════════════════════════════════════════════════

export interface PerSceneLipSyncClip {
  idx: number;
  buffer: Buffer;
  mime: string;
  durationSec: number;
  hasPerson: boolean;
}

/**
 * Slice an audio buffer into a [startSec, endSec] segment using ffmpeg atrim.
 * Returns an mp3 buffer of exactly the requested duration.
 */
async function sliceAudioSegment(audioBuffer: Buffer, startSec: number, endSec: number): Promise<Buffer> {
  const dur = Math.max(0.1, endSec - startSec);
  const tmp = await makeTmpDir("audioslice");
  try {
    const inPath = path.join(tmp, "in.mp3");
    const outPath = path.join(tmp, "out.mp3");
    await fs.writeFile(inPath, audioBuffer);
    const ffmpeg: any = await loadFfmpeg();
    return await new Promise<Buffer>((resolve, reject) => {
      ffmpeg(inPath)
        .setStartTime(startSec.toFixed(3))
        .duration(dur.toFixed(3))
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .outputOptions(["-ac 1", "-ar 24000"])
        .on("end", async () => {
          try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        })
        .on("error", reject)
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Apply per-scene lip-sync to a list of clips using a single continuous
 * voiceover. Only `hasPerson=true` clips are sent to Replicate (expensive);
 * the rest are returned unchanged. Failures on individual clips fall back to
 * the original clip (the voice-over still sounds correct over the muxed audio
 * — only the lip animation is missing for that one shot).
 *
 * Concurrency: max 2 lip-sync jobs in parallel (Replicate quota friendly).
 */
export async function applyPerSceneLipSync(opts: {
  clips: PerSceneLipSyncClip[];
  voiceBuffer: Buffer;
  totalVideoSec: number;
  /**
   * Crossfade duration (seconds) that the downstream concat will apply
   * between consecutive clips. CRITICAL for sync: each clip starts in the
   * final timeline at `cumulative_duration - i*crossfade` (xfade overlaps
   * the tail of the previous clip with the head of the next). If we ignore
   * this, lip movements drift earlier than the audio by `i*crossfade`
   * seconds in clip i (e.g. 4s of drift after 10 clips with 0.4s xfade).
   * Pass 0 for hard-cut concat (locked-shot mode).
   */
  crossfadeSec?: number;
  model?: string;
  concurrency?: number;
}): Promise<Array<{ idx: number; buffer: Buffer; mime: string; durationSec: number }>> {
  const { clips, voiceBuffer, totalVideoSec } = opts;
  if (!clips.length) return [];
  const crossfade = Math.max(0, opts.crossfadeSec ?? 0);

  // Fit the voice exactly to the total FINAL video duration so per-scene
  // offsets align perfectly with what the user will hear in the muxed result.
  // totalVideoSec MUST already account for crossfade overlaps (the caller
  // passes the post-concat duration, not the raw sum of clip durations).
  const fittedVoice = await fitVoiceToVideo(voiceBuffer, totalVideoSec);

  // Compute per-clip START offsets in the FINAL timeline. With crossfade,
  // each clip after the first starts `crossfade` seconds EARLIER than the
  // naive cumulative sum would suggest, because xfade reuses the previous
  // clip's tail as the next clip's head. Without this correction, the lip
  // motion drifts earlier than the spoken audio in every subsequent shot.
  //   T_0 = 0
  //   T_i = T_{i-1} + duration[i-1] - crossfade   (for i >= 1)
  // The slice END is T_i + duration[i] (we lip-sync the FULL clip duration;
  // the xfade visual blend at the head/tail handles the seam smoothly).
  const offsets: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    offsets.push({ start: cursor, end: Math.min(totalVideoSec, cursor + c.durationSec) });
    // Advance cursor: full clip duration MINUS the crossfade overlap with the
    // next clip (no overlap after the last clip).
    cursor += c.durationSec - (i < clips.length - 1 ? crossfade : 0);
  }

  const concurrency = Math.max(1, Math.min(4, opts.concurrency ?? 2));
  const results: Array<{ idx: number; buffer: Buffer; mime: string; durationSec: number }> = new Array(clips.length);
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const k = i++;
      if (k >= clips.length) return;
      const clip = clips[k];
      const off = offsets[k];
      if (!clip.hasPerson) {
        results[k] = { idx: clip.idx, buffer: clip.buffer, mime: clip.mime, durationSec: clip.durationSec };
        logger.info({ sceneIdx: clip.idx, durationSec: clip.durationSec }, "🎙 lip-sync SKIP (no person — voice-over)");
        continue;
      }
      try {
        const segment = await sliceAudioSegment(fittedVoice, off.start, off.end);
        const synced = await lipSyncVideoToAudio(clip.buffer, segment, {
          model: opts.model,
          videoMime: clip.mime,
          audioMime: "audio/mpeg",
        });
        results[k] = { idx: clip.idx, buffer: synced, mime: "video/mp4", durationSec: clip.durationSec };
        logger.info({
          sceneIdx: clip.idx,
          startSec: off.start.toFixed(2),
          endSec: off.end.toFixed(2),
          inBytes: clip.buffer.length,
          outBytes: synced.length,
        }, "🎙 lip-sync APPLIED (presenter scene)");
      } catch (err: any) {
        logger.warn({
          sceneIdx: clip.idx,
          err: err?.message,
        }, "🎙 lip-sync FAILED for scene — falling back to original clip (voice-over still works)");
        results[k] = { idx: clip.idx, buffer: clip.buffer, mime: clip.mime, durationSec: clip.durationSec };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 16: ASR (audio → SRT subtitles via Replicate Whisper)
// ═══════════════════════════════════════════════════════════════════════════

interface WhisperSegment { start: number; end: number; text: string }

function fmtSrtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function segmentsToSrt(segments: WhisperSegment[]): string {
  return segments
    .filter((s) => s.text?.trim())
    .map((s, i) => `${i + 1}\n${fmtSrtTime(s.start)} --> ${fmtSrtTime(s.end)}\n${s.text.trim()}\n`)
    .join("\n");
}

/**
 * Transcribe an audio buffer to SRT subtitles using Replicate Whisper
 * (default `openai/whisper`). Returns the SRT string ready to burn into a
 * video. `lang` accepts ISO-639-1 codes ("es", "en"...) or null for auto.
 */
export async function transcribeAudioToSrt(
  audioBuffer: Buffer,
  opts: { language?: string | null; model?: string; replicateToken?: string; audioMime?: string } = {},
): Promise<{ srt: string; segments: WhisperSegment[]; language?: string }> {
  const token = getReplicateToken(opts.replicateToken);
  const modelName = opts.model
    ?? process.env.REPLICATE_WHISPER_MODEL
    ?? "openai/whisper";
  const audioMime = opts.audioMime ?? "audio/mpeg";
  const input: Record<string, unknown> = {
    audio: bufferToDataUri(audioBuffer, audioMime),
  };
  if (opts.language && opts.language !== "auto") input.language = opts.language;
  const out = await replicateRunLatestJson(modelName, input, token, 6 * 60_000) as any;
  // Whisper variants return either {transcription, segments[]} or {text, chunks[]}
  let segments: WhisperSegment[] = [];
  if (Array.isArray(out?.segments)) {
    segments = out.segments
      .map((s: any) => ({ start: Number(s.start ?? 0), end: Number(s.end ?? 0), text: String(s.text ?? "") }))
      .filter((s: WhisperSegment) => s.end > s.start);
  } else if (Array.isArray(out?.chunks)) {
    segments = out.chunks
      .map((c: any) => ({
        start: Number(c.timestamp?.[0] ?? c.start ?? 0),
        end: Number(c.timestamp?.[1] ?? c.end ?? 0),
        text: String(c.text ?? ""),
      }))
      .filter((s: WhisperSegment) => s.end > s.start);
  } else if (typeof out?.transcription === "string") {
    // Single block fallback — assume 30s window
    segments = [{ start: 0, end: 30, text: out.transcription }];
  }
  return { srt: segmentsToSrt(segments), segments };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 17: BURN SUBTITLES INTO VIDEO (FFmpeg subtitles filter)
// ═══════════════════════════════════════════════════════════════════════════

export interface BurnSubsStyle {
  fontName?: string;       // default Arial
  fontSizePx?: number;     // default 28
  primaryColorHex?: string; // hex like "FFFFFF" (no #)
  outlineColorHex?: string; // hex like "000000"
  outlinePx?: number;       // default 2
  alignment?: 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9 | 10 | 11; // ASS alignment numpad style; 2 = bottom-center
  marginVPx?: number;       // bottom margin
}

/**
 * Burn an SRT subtitle string into a video via FFmpeg `subtitles` filter.
 * Re-encodes the video. Style is applied through `force_style`.
 */
export async function burnSubtitlesIntoVideo(
  videoBuffer: Buffer,
  srt: string,
  style: BurnSubsStyle = {},
): Promise<Buffer> {
  if (!srt?.trim()) throw new Error("burnSubtitlesIntoVideo: SRT vacío");
  const tmp = await makeTmpDir("subs");
  const inPath = path.join(tmp, "in.mp4");
  const srtPath = path.join(tmp, "subs.srt");
  const outPath = path.join(tmp, "out.mp4");
  await fs.writeFile(inPath, videoBuffer);
  await fs.writeFile(srtPath, srt, "utf8");
  const ffmpeg: any = await loadFfmpeg();

  const fontName = style.fontName ?? "Arial";
  const fontSize = style.fontSizePx ?? 28;
  const primary = (style.primaryColorHex ?? "FFFFFF").replace(/^#/, "");
  const outline = (style.outlineColorHex ?? "000000").replace(/^#/, "");
  const outlinePx = style.outlinePx ?? 2;
  const alignment = style.alignment ?? 2;
  const marginV = style.marginVPx ?? 60;
  // ASS color format: &HAABBGGRR, no alpha → &H00BBGGRR
  const toAssColor = (hex6: string): string => {
    const r = hex6.slice(0, 2), g = hex6.slice(2, 4), b = hex6.slice(4, 6);
    return `&H00${b}${g}${r}`;
  };
  const styleStr = [
    `FontName=${fontName}`,
    `FontSize=${fontSize}`,
    `PrimaryColour=${toAssColor(primary)}`,
    `OutlineColour=${toAssColor(outline)}`,
    `BorderStyle=1`,
    `Outline=${outlinePx}`,
    `Shadow=0`,
    `Alignment=${alignment}`,
    `MarginV=${marginV}`,
  ].join(",");
  // The subtitles filter needs a filesystem-safe path; escape colons.
  const safeSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  return await new Promise<Buffer>((resolve, reject) => {
    ffmpeg(inPath)
      .videoFilter(`subtitles='${safeSrt}':force_style='${styleStr}'`)
      .videoCodec("libx264")
      .audioCodec("copy")
      .outputOptions(["-pix_fmt yuv420p", "-movflags +faststart"])
      .on("end", async () => {
        try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        finally { fs.rm(tmp, { recursive: true, force: true }).catch(() => {}); }
      })
      .on("error", (err: Error) => {
        fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`FFmpeg burn-subs error: ${err.message}`));
      })
      .save(outPath);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 18: MOTION TRANSFER (driving video → animate static image)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Animate a static image with the motion of a driving reference video.
 * Default model is `arielreplicate/champ` — override via REPLICATE_MOTION_MODEL
 * or `opts.model` to use `magic-research/magic-animate`, `lucataco/animate-anything`,
 * or any compatible image+driving-video→video Replicate model.
 */
export async function transferMotionToImage(
  imageBuffer: Buffer,
  drivingVideoBuffer: Buffer,
  opts: { model?: string; replicateToken?: string; imageMime?: string; videoMime?: string } = {},
): Promise<Buffer> {
  const token = getReplicateToken(opts.replicateToken);
  const modelName = opts.model
    ?? process.env.REPLICATE_MOTION_MODEL
    ?? "arielreplicate/champ";
  const imageMime = opts.imageMime ?? "image/png";
  const videoMime = opts.videoMime ?? "video/mp4";
  const input: Record<string, unknown> = {
    image: bufferToDataUri(imageBuffer, imageMime),
    driving_video: bufferToDataUri(drivingVideoBuffer, videoMime),
  };
  return replicateRunLatestBuffer(modelName, input, token, 10 * 60_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 19: VIDEO FRAME EXTRACTION (for analysis / clone-viral pipeline)
// ═══════════════════════════════════════════════════════════════════════════

/** Extract N evenly-spaced JPEG frames from a video buffer. */
export async function extractVideoFrames(
  videoBuffer: Buffer,
  frameCount = 8,
  sizePx = 512,
): Promise<{ frames: Buffer[]; durationSec: number }> {
  const tmp = await makeTmpDir("frames");
  const inPath = path.join(tmp, "in.mp4");
  await fs.writeFile(inPath, videoBuffer);
  const ffmpeg: any = await loadFfmpeg();
  const dur = await probeDurationSec(inPath).catch(() => 0);
  const N = Math.max(1, Math.min(frameCount, 32));
  const step = dur > 0 ? dur / (N + 1) : 1;

  const frames: Buffer[] = [];
  try {
    for (let i = 0; i < N; i++) {
      const t = dur > 0 ? step * (i + 1) : i;
      const outPath = path.join(tmp, `f_${i}.jpg`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inPath)
          .seekInput(t)
          .frames(1)
          .size(`${sizePx}x?`)
          .outputOptions(["-q:v 4"])
          .on("end", () => resolve())
          .on("error", (e: Error) => reject(e))
          .save(outPath);
      });
      frames.push(await fs.readFile(outPath));
    }
    return { frames, durationSec: dur };
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Mix TTS audio with background music using FFmpeg.
 * Applies optional ducking (compressing music when voice is present).
 */
export async function mixAudioWithBackgroundMusic(
  ttsBuffer: Buffer,
  musicBuffer: Buffer,
  opts: { musicVolume?: number; duckingEnabled?: boolean; fadeInMs?: number; fadeOutMs?: number } = {},
): Promise<Buffer> {
  const musicVol = opts.musicVolume ?? 0.15;
  const ducking = opts.duckingEnabled ?? true;
  const tmp = await makeTmpDir("mix");
  const ttsPath = path.join(tmp, "tts.mp3");
  const musicPath = path.join(tmp, "music.mp3");
  const outPath = path.join(tmp, "mix.mp3");

  await fs.writeFile(ttsPath, ttsBuffer);
  await fs.writeFile(musicPath, musicBuffer);

  const ffmpeg: any = await loadFfmpeg();

  return await new Promise<Buffer>((resolve, reject) => {
    const cmd = ffmpeg();
    cmd.input(ttsPath).input(musicPath);

    // Filter complex for mixing and ducking
    // [0:a] is TTS, [1:a] is music
    let filter = `[1:a]volume=${musicVol}[bg];`;
    if (ducking) {
      // Sidechain ducking: when [0:a] has signal, compress [bg]
      filter += `[bg][0:a]sidechaincompress=threshold=0.1:ratio=20[bgd];[0:a][bgd]amix=inputs=2:duration=longest:dropout_transition=3[out]`;
    } else {
      filter += `[0:a][bg]amix=inputs=2:duration=longest:dropout_transition=3[out]`;
    }

    cmd.complexFilter([filter], ["out"])
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .on("end", async () => {
        try {
          resolve(await fs.readFile(outPath));
        } catch (e) {
          reject(e);
        } finally {
          fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
        }
      })
      .on("error", (err: Error) => {
        fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
        reject(new Error(`FFmpeg audio mix error: ${err.message}`));
      })
      .save(outPath);
  });
}

/**
 * Returns a catalog of predefined sound effects for e-commerce and marketing.
 */
export function generateSFXCatalog(): any[] {
  return [
    { id: "cash-register", name: "Caja Registradora", prompt: "Classic cash register sound, shop purchase, money ping", category: "comercio", duration: 2 },
    { id: "shopping-cart", name: "Carrito de Compra", prompt: "Shopping cart wheels rolling on floor with light rattle", category: "comercio", duration: 3 },
    { id: "package-unwrapping", name: "Desempaquetado", prompt: "Unboxing sound, cardboard ripping, bubble wrap popping softly", category: "comercio", duration: 4 },
    { id: "notification-ping", name: "Notificación", prompt: "Modern app notification ping, clean digital sound", category: "comercio", duration: 1 },
    { id: "office-ambience", name: "Ambiente Oficina", prompt: "Soft office background, keyboard typing, distant chatter", category: "ambiente", duration: 10 },
    { id: "nature-outdoor", name: "Naturaleza Exterior", prompt: "Soft wind, distant birds, peaceful outdoor atmosphere", category: "ambiente", duration: 10 },
    { id: "city-background", name: "Fondo Ciudad", prompt: "Distant city traffic, urban hum, occasional horn", category: "ambiente", duration: 10 },
    { id: "coffee-shop", name: "Cafetería", prompt: "Coffee shop atmosphere, espresso machine, porcelain clinking", category: "ambiente", duration: 10 },
    { id: "success-fanfare", name: "Fanfarria Éxito", prompt: "Short orchestral success fanfare, achievement sound", category: "emociones", duration: 3 },
    { id: "dramatic-reveal", name: "Revelación Dramática", prompt: "Cinematic orchestral swell, dramatic reveal, suspenseful impact", category: "emociones", duration: 4 },
    { id: "suspense-build", name: "Construcción Suspense", prompt: "Rising string tension, suspenseful build-up", category: "emociones", duration: 5 },
    { id: "happy-jingle", name: "Jingle Alegre", prompt: "Happy upbeat musical jingle, positive brand identity", category: "emociones", duration: 3 },
    { id: "tech-click", name: "Click Tecnológico", prompt: "High-end tech button click, futuristic interface sound", category: "productos", duration: 1 },
    { id: "soft-close", name: "Cierre Suave", prompt: "Premium car door soft close, high quality mechanical thud", category: "productos", duration: 2 },
    { id: "fabric-rustle", name: "Crujido de Tela", prompt: "Silk fabric rustling, clothing movement sound", category: "productos", duration: 2 },
    { id: "liquid-pour", name: "Vertido de Líquido", prompt: "Liquid pouring into glass, refreshing splashing sound", category: "productos", duration: 3 },
    // More SFX...
    { id: "keyboard-typing", name: "Escribiendo Teclado", prompt: "Fast mechanical keyboard typing sounds", category: "ambiente", duration: 5 },
    { id: "camera-shutter", name: "Obturador Cámara", prompt: "Professional DSLR camera shutter click", category: "productos", duration: 1 },
    { id: "sparkle-magic", name: "Destello Mágico", prompt: "Magical sparkle sound, glittery fairy dust sound effect", category: "emociones", duration: 2 },
    { id: "pop-minimal", name: "Pop Minimalista", prompt: "Clean minimal UI pop sound", category: "comercio", duration: 1 },
    { id: "swipe-whoosh", name: "Swipe / Whoosh", prompt: "Fast air whoosh, interface swipe transition", category: "comercio", duration: 1 },
    { id: "bell-shop", name: "Campana Tienda", prompt: "Classic shop entrance bell ding", category: "comercio", duration: 2 },
    { id: "pencil-writing", name: "Lápiz Escribiendo", prompt: "Pencil writing on paper texture", category: "ambiente", duration: 3 },
    { id: "clock-ticking", name: "Reloj Tic-Tac", prompt: "Analog clock ticking steadily", category: "ambiente", duration: 5 },
    { id: "applause-crowd", name: "Aplausos Público", prompt: "Medium crowd applause and cheering", category: "emociones", duration: 5 },
    { id: "paper-crumple", name: "Papel Arrugado", prompt: "Crumpling paper sound effect", category: "productos", duration: 2 },
    { id: "glass-clink", name: "Brindis Copas", prompt: "Two wine glasses clinking together", category: "productos", duration: 1 },
    { id: "door-opening", name: "Puerta Abriendo", prompt: "Creaky wooden door opening slowly", category: "ambiente", duration: 3 },
    { id: "footsteps-hardwood", name: "Pasos Madera", prompt: "Footsteps walking on hardwood floor", category: "ambiente", duration: 4 },
    { id: "electric-spark", name: "Chispa Eléctrica", prompt: "Short electric arc or spark sound", category: "productos", duration: 1 },
  ];
}

/**
 * Advanced TTS with cloned voice settings.
 */
export async function generateVoiceWithClone(
  text: string,
  voiceId: string,
  opts: {
    model?: string;
    stability?: number;
    style?: number;
    similarityBoost?: number;
    outputFormat?: string;
  } = {},
): Promise<Buffer> {
  const apiKey = getElevenKey();
  const body: any = {
    text,
    model_id: opts.model || "eleven_multilingual_v2",
    voice_settings: {
      stability: opts.stability ?? 0.5,
      similarity_boost: opts.similarityBoost ?? 0.75,
      style: opts.style ?? 0,
      use_speaker_boost: true,
    },
  };

  const fmt = opts.outputFormat || "mp3_44100_128";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(fmt)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`ElevenLabs advanced TTS failed (${res.status}): ${err}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Extract the audio track of a video as MP3 buffer (for transcription). */
export async function extractAudioMp3(videoBuffer: Buffer): Promise<Buffer> {
  const tmp = await makeTmpDir("audio");
  const inPath = path.join(tmp, "in.mp4");
  const outPath = path.join(tmp, "out.mp3");
  await fs.writeFile(inPath, videoBuffer);
  const ffmpeg: any = await loadFfmpeg();
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      ffmpeg(inPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .on("end", async () => {
          try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        })
        .on("error", (e: Error) => reject(new Error(`FFmpeg audio extract: ${e.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * stripAudio — quita la pista de audio de un vídeo MP4, devolviendo el vídeo silenciado.
 */
export async function stripAudio(videoBuffer: Buffer): Promise<Buffer> {
  const tmp = await makeTmpDir("strip");
  const inPath = path.join(tmp, "in.mp4");
  const outPath = path.join(tmp, "out.mp4");
  await fs.writeFile(inPath, videoBuffer);
  const ffmpeg: any = await loadFfmpeg();
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      ffmpeg(inPath)
        .noAudio()
        .videoCodec("copy")
        .outputOptions(["-movflags +faststart"])
        .on("end", async () => {
          try { resolve(await fs.readFile(outPath)); } catch (e) { reject(e); }
        })
        .on("error", (e: Error) => reject(new Error(`FFmpeg strip-audio: ${e.message}`)))
        .save(outPath);
    });
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 20: IMAGE VARIATIONS & EDITING (Flux / SDXL)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateImageVariations(
  imageBuffer: Buffer,
  prompt: string,
  count = 1,
  replicateToken?: string,
): Promise<Buffer[]> {
  const token = getReplicateToken(replicateToken);
  const n = Math.max(1, Math.min(count, 4));
  const dataUri = bufferToDataUri(imageBuffer, "image/png");

  try {
    const results: Buffer[] = [];
    for (let i = 0; i < n; i++) {
      const res = await replicateRunBuffer(
        "black-forest-labs/flux-1.1-pro",
        {
          image: dataUri,
          prompt: prompt || "variation of this image, high quality, photorealistic",
          prompt_strength: 0.8,
          num_outputs: 1,
        },
        token,
      );
      results.push(res);
    }
    return results;
  } catch (err) {
    logger.warn(`Flux variations failed, falling back to SDXL: ${err}`);
    const results: Buffer[] = [];
    for (let i = 0; i < n; i++) {
      const res = await replicateRunBuffer(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          init_image: dataUri,
          prompt: prompt || "variation of this image, high quality, photorealistic",
          prompt_strength: 0.8,
          num_outputs: 1,
        },
        token,
      );
      results.push(res);
    }
    return results;
  }
}

export async function faceSwapImage(
  faceBuffer: Buffer,
  targetBuffer: Buffer,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  try {
    return await replicateRunBuffer(
      "yan-ops/face-swap",
      {
        request_image: bufferToDataUri(targetBuffer, "image/png"),
        target_image: bufferToDataUri(faceBuffer, "image/png"),
      },
      token,
    );
  } catch (err) {
    logger.warn(`yan-ops/face-swap failed, falling back to lucataco/faceswap: ${err}`);
    return await replicateRunBuffer(
      "lucataco/faceswap:9a4234548e6f523897dc3390708688484f937968494cd9a39dfa4a7538ec103a",
      {
        target_image: bufferToDataUri(targetBuffer, "image/png"),
        swap_image: bufferToDataUri(faceBuffer, "image/png"),
      },
      token,
    );
  }
}

export async function outpaintImage(
  imageBuffer: Buffer,
  prompt: string,
  direction: "all" | "left" | "right" | "top" | "bottom" = "all",
  paddingPct = 25,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  // Using adirik/flux-outpaint as requested
  return await replicateRunBuffer(
    "adirik/flux-outpaint",
    {
      image: bufferToDataUri(imageBuffer, "image/png"),
      expansion_prompt: prompt,
      direction: direction === "all" ? "up, down, left, right" : (direction === "top" ? "up" : (direction === "bottom" ? "down" : direction)),
      overlap_percentage: 10,
      offset: paddingPct,
    },
    token,
  );
}

export async function inpaintImageWithMask(
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  prompt: string,
  replicateToken?: string,
): Promise<Buffer> {
  const token = getReplicateToken(replicateToken);
  return await replicateRunBuffer(
    "black-forest-labs/flux-1.1-pro-fill",
    {
      image: bufferToDataUri(imageBuffer, "image/png"),
      mask: bufferToDataUri(maskBuffer, "image/png"),
      prompt: prompt,
      guidance: 30,
      output_format: "png",
    },
    token,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 20: VIDEO-TO-VIDEO & VIDEO EDITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate video from an existing video (style transfer / v2v).
 */
export async function generateVideoFromVideo(
  videoBuffer: Buffer,
  prompt: string,
  model: string,
  replicateToken?: string,
): Promise<{ url?: string; buffer: Buffer; model: string }> {
  const token = getReplicateToken(replicateToken);

  if (model.startsWith("kling")) {
    // Kling v2v on Replicate
    const Replicate = (await import("replicate")).default;
    const rep = new Replicate({ auth: token });
    
    // Pattern: Upload to Replicate Files if needed, or use data-uri if small.
    // For Kling v1.6 standard:
    const input = {
      video: bufferToDataUri(videoBuffer, "video/mp4"),
      prompt,
    };
    const buf = await replicateRunLatestBuffer("kwaivgi/kling-v1.6-standard", input, token, 10 * 60_000);
    return { buffer: buf, model: "kwaivgi/kling-v1.6-standard" };
  }

  if (model.startsWith("wan")) {
    const input = {
      video: bufferToDataUri(videoBuffer, "video/mp4"),
      prompt,
      size: "480p",
    };
    const buf = await replicateRunLatestBuffer("wan-video/wan-2.5-i2v-480p", input, token, 10 * 60_000);
    return { buffer: buf, model: "wan-video/wan-2.5-i2v-480p" };
  }

  if (model.startsWith("runway")) {
    // For Runway V2V, we extract the first frame and use it as image_to_video
    const { frames } = await extractVideoFrames(videoBuffer, 1, 1280);
    if (!frames.length) throw new Error("Could not extract first frame for Runway V2V");
    
    const runwayBuf = await runwayGenerateVideo({
      promptImage: bufferToDataUri(frames[0], "image/jpeg"),
      promptText: prompt,
      model: model.includes("4.5") ? "gen4_5" : "gen4_turbo",
    });
    
    const finalBuf = await fetchToBuffer(runwayBuf.videoUrl);
    return { buffer: finalBuf, model: runwayBuf.model, url: runwayBuf.videoUrl };
  }

  throw new Error(`Modelo V2V no soportado: ${model}`);
}

/**
 * Extend an existing video using Runway.
 */
export async function extendVideoWithRunway(
  videoUrl: string,
  duration: number,
  model?: "gen4_5" | "gen4_turbo"
): Promise<Buffer> {
  const apiKey = getRunwayKey();
  const runwayModel = model || "gen4_5";
  
  const res = await fetch("https://api.dev.runwayml.com/v1/video_extensions", {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${apiKey}`, 
      "Content-Type": "application/json", 
      "X-Runway-Version": "2024-11-06" 
    },
    body: JSON.stringify({
      init_video_url: videoUrl,
      model: runwayModel,
      duration: duration >= 10 ? 10 : 5,
    }),
  });

  if (!res.ok) {
    throw new Error(`Runway extend failed: ${res.status} ${await res.text()}`);
  }

  const { id: taskId } = await res.json() as { id: string };
  
  // Polling loop
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 6000));
    const sr = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!sr.ok) continue;
    const st = await sr.json() as { status: string; output?: string[]; failure?: string };
    if (st.status === "SUCCEEDED" && st.output?.[0]) return await fetchToBuffer(st.output[0]);
    if (st.status === "FAILED") throw new Error(`Runway extend failed: ${st.failure}`);
  }
  throw new Error("Runway extend timed out");
}

/**
 * Edit a video using a prompt.
 */
export async function editVideoWithPrompt(
  videoBuffer: Buffer,
  prompt: string,
  model: string,
  replicateToken?: string,
): Promise<Buffer> {
  if (model.includes("kling")) {
    const res = await generateVideoFromVideo(videoBuffer, prompt, "kling", replicateToken);
    return res.buffer;
  }
  
  if (model.includes("runway")) {
    // For Runway editing, we can use the same V2V logic (first frame + prompt)
    const res = await generateVideoFromVideo(videoBuffer, prompt, "runway", replicateToken);
    return res.buffer;
  }

  // Fallback to xAI if available in the context (already has editXaiVideo)
  // or use Wan v2.5 i2v as general video editor
  const res = await generateVideoFromVideo(videoBuffer, prompt, "wan", replicateToken);
  return res.buffer;
}
