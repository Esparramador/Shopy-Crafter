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

// ─── HELPERS ───────────────────────────────────────────────────────────────

export async function makeTmpDir(prefix = "fs-pro"): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefix}-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

import { validateImageUrlAsync } from "./runway.js";

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
  | "nano-banana"               // Gemini 2.5 Flash Image (v1)
  | "nano-banana-pro"           // Gemini 3 Pro Image (v2, 4K, top-tier)
  | "seedream-4"                // ByteDance Seedream 4 (text + photoreal)
  | "flux-kontext-pro"          // Flux Kontext Pro — character/style consistency
  | "flux-kontext-max"          // Flux Kontext Max — máxima calidad, consistencia premium
  | "flux-kontext-dev"          // Flux Kontext Dev — open-weights, edición artística
  | "gpt-image-1"              // OpenAI gpt-image-1 (vía Replit AI Integrations)
  | "gpt-image-2"              // OpenAI gpt-image-2 — flagship abril 2026, razonamiento integrado
  | "gpt-image-1.5"            // OpenAI gpt-image-1.5 — 20% más barato que v1, misma calidad
  | "gpt-image-1-mini";        // OpenAI gpt-image-1 mini — presupuesto, alta velocidad

// ImageProvider explícito para health-check / fallback automático en frontend.
export type ImageProvider = "replicate" | "gemini" | "runway" | "openai";

export const IMAGE_MODELS: Record<ImageGenModel, { provider: ImageProvider; replicateId?: string; description: string; costPerImage: number; aspectRatios: string[]; maxResolution: string }> = {
  "flux-1.1-pro-ultra":     { provider: "replicate", replicateId: "black-forest-labs/flux-1.1-pro-ultra", description: "Top photoreal 4MP, mejor calidad fotográfica", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2752x1536" },
  "flux-1.1-pro-ultra-raw": { provider: "replicate", replicateId: "black-forest-labs/flux-1.1-pro-ultra", description: "Flux Ultra modo RAW — fotografía naturalista (sin look AI)", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2752x1536" },
  "flux-1.1-pro":           { provider: "replicate", replicateId: "black-forest-labs/flux-1.1-pro",       description: "Photoreal estándar, buen precio/calidad", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"],         maxResolution: "1440x1440" },
  "flux-schnell":           { provider: "replicate", replicateId: "black-forest-labs/flux-schnell",       description: "El más barato y rápido", costPerImage: 0.003, aspectRatios: ["1:1","16:9","9:16"],                                    maxResolution: "1024x1024" },
  "recraft-v3":             { provider: "replicate", replicateId: "recraft-ai/recraft-v3",                description: "MEJOR para texto en imagen (posters, logos, packaging)", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "recraft-v3-svg":         { provider: "replicate", replicateId: "recraft-ai/recraft-v3-svg",            description: "Recraft v3 SVG — vectorial REAL (logos, iconos, ilustración plana)", costPerImage: 0.08, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "vector" },
  "ideogram-v3-turbo":      { provider: "replicate", replicateId: "ideogram-ai/ideogram-v3-turbo",        description: "Texto + photoreal", costPerImage: 0.03, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "imagen-4-ultra":         { provider: "replicate", replicateId: "google/imagen-4-ultra",                description: "Google Imagen 4 Ultra — premium 2K, máxima calidad", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "imagen-4":               { provider: "replicate", replicateId: "google/imagen-4",                      description: "Google Imagen 4 estándar — alta calidad/precio equilibrado", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "imagen-4-fast":          { provider: "replicate", replicateId: "google/imagen-4-fast",                 description: "Google Imagen 4 Fast — generación rápida y barata", costPerImage: 0.02, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "nano-banana":            { provider: "gemini",                                                          description: "Nano Banana v1 (Gemini 2.5 Flash Image) — rápido, consistente con marca", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","2:3","3:2","4:5","5:4","21:9"], maxResolution: "2K" },
  "nano-banana-pro":        { provider: "gemini",                                                          description: "Nano Banana 2 / Pro (Gemini 3 Pro Image) — 4K, texto nítido, identidad estable", costPerImage: 0.12, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","2:3","3:2","4:5","5:4","21:9"], maxResolution: "4K" },
  "seedream-4":             { provider: "replicate", replicateId: "bytedance/seedream-4",                 description: "ByteDance Seedream 4 — photoreal + texto, rival de Recraft/Ideogram", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2048x2048" },
  "flux-kontext-pro":       { provider: "replicate", replicateId: "black-forest-labs/flux-kontext-pro",   description: "Mantiene consistencia entre imágenes (mismo personaje/estilo)", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
  "flux-kontext-max":       { provider: "replicate", replicateId: "black-forest-labs/flux-kontext-max",   description: "Flux Kontext Max — máxima calidad, consistencia de personaje/estilo premium", costPerImage: 0.07, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
  "flux-kontext-dev":       { provider: "replicate", replicateId: "black-forest-labs/flux-kontext-dev",   description: "Flux Kontext Dev — open-weights, edición artística creativa", costPerImage: 0.03, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
  "recraft-v4":             { provider: "replicate", replicateId: "recraft-ai/recraft-v4",                description: "Recraft V4 — última generación, texto nítido + realismo máximo", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "ideogram-v3-quality":    { provider: "replicate", replicateId: "ideogram-ai/ideogram-v3-quality",      description: "Ideogram V3 Quality — máxima calidad texto en imagen + photoreal", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "gpt-image-1":            { provider: "openai", description: "OpenAI gpt-image-1 — render limpio, manejo de texto", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1536x1024" },
  "gpt-image-2":            { provider: "openai", description: "OpenAI gpt-image-2 — flagship 2026, razonamiento integrado, máxima calidad fotorrealista", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3","21:9"], maxResolution: "1536x864 (flex)" },
  "gpt-image-1.5":          { provider: "openai", description: "OpenAI gpt-image-1.5 — 20% más barato que v1, calidad equivalente", costPerImage: 0.033, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1536x1024" },
  "gpt-image-1-mini":       { provider: "openai", description: "OpenAI gpt-image-1 mini — presupuesto, alta velocidad, ideal para volumen", costPerImage: 0.02, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3"], maxResolution: "1024x1024" },
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

    // gpt-image-2 soporta tamaños flexibles (WxH divisible por 16, ratio 1:3 a 3:1)
    // gpt-image-1 / 1.5 / mini: sólo 1024x1024, 1536x1024, 1024x1536
    const gpt2SizeMap: Record<string, string> = {
      "1:1":  "1024x1024",
      "16:9": "1536x864",
      "3:2":  "1536x1024",
      "4:3":  "1280x960",
      "9:16": "864x1536",
      "2:3":  "1024x1536",
      "3:4":  "960x1280",
      "21:9": "2016x864",
    };
    const stdSizeMap: Record<string, string> = {
      "1:1":  "1024x1024",
      "16:9": "1536x1024",
      "3:2":  "1536x1024",
      "4:3":  "1536x1024",
      "9:16": "1024x1536",
      "2:3":  "1024x1536",
      "3:4":  "1024x1536",
    };
    const size = model === "gpt-image-2"
      ? (gpt2SizeMap[aspect] || "1024x1024")
      : (stdSizeMap[aspect]  || "1024x1024");

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
    const { aspect_ratio, ...rest } = input;
    input = { ...rest, style: "realistic_image", size: "1820x1024" };
  }
  if (model === "imagen-4-ultra" || model === "imagen-4" || model === "imagen-4-fast") {
    input = { ...input, output_format: "png", safety_filter_level: "block_only_high" };
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
  | "veo-3.1"
  | "veo-3.1-fast"
  | "veo-3-fast"
  | "veo-3"
  | "veo-2"
  | "sora-2"
  | "kling-master"
  | "kling-2.5-turbo"
  | "kling-2.1"
  | "seedance-pro"
  | "seedance-fast"
  | "hailuo-02-fast"
  | "hailuo-02"
  | "wan-2.5"
  | "wan-2.5-fast"
  | "runway-gen4.5"          // Runway Gen 4.5 — nueva gen, mejor motion y detalle
  | "runway-seedance2"       // Seedance 2 vía Runway — calidad cinematográfica
  | "runway-seedance2-fast"  // Seedance 2 Fast vía Runway — rápido
  | "wan-2.5-t2v"            // Wan 2.5 Text-to-Video — T2V puro, sin imagen
  | "seedance-1-lite";       // Seedance 1 Lite — versión económica de Pro

export const VIDEO_MODELS: Record<VideoModel, { provider: "runway" | "replicate" | "gemini"; modelId?: string; description: string; costPerSec: number; quality: number; maxDuration: number }> = {
  "runway-gen4-turbo":  { provider: "runway",                                                description: "Runway Gen-4 — top quality, control fino, 5/10s",                costPerSec: 0.05, quality: 10, maxDuration: 10 },
  "runway-gen3-alpha":  { provider: "runway",                                                description: "Runway Gen-3 Alpha — buena calidad, mejor precio",               costPerSec: 0.05, quality: 8,  maxDuration: 10 },
  "veo-3.1":            { provider: "gemini",    modelId: "veo-3.1-generate-preview",       description: "Google Veo 3.1 — última gen + audio nativo, 16:9 / 9:16 (8s)",   costPerSec: 0.75, quality: 10, maxDuration: 8  },
  "veo-3.1-fast":       { provider: "gemini",    modelId: "veo-3.1-fast-generate-preview",  description: "Google Veo 3.1 Fast — rápido y barato + audio nativo",          costPerSec: 0.40, quality: 9,  maxDuration: 8  },
  "veo-3-fast":         { provider: "gemini",    modelId: "veo-3.0-fast-generate-preview",  description: "Google Veo 3 Fast — rápido + audio nativo (8s, 16:9)",          costPerSec: 0.40, quality: 9,  maxDuration: 8  },
  "veo-3":              { provider: "gemini",    modelId: "veo-3.0-generate-preview",       description: "Google Veo 3 — máxima calidad + audio nativo (8s, 16:9)",        costPerSec: 0.75, quality: 10, maxDuration: 8  },
  "veo-2":              { provider: "gemini",    modelId: "veo-2.0-generate-001",           description: "Google Veo 2 — soporta 9:16 y 16:9, hasta 8s (sin audio)",       costPerSec: 0.35, quality: 8,  maxDuration: 8  },
  "sora-2":             { provider: "replicate", modelId: "openai/sora-2",                  description: "OpenAI Sora 2 — narrativa cinematográfica, hasta 12s, T2V/I2V", costPerSec: 0.30, quality: 10, maxDuration: 12 },
  "kling-master":       { provider: "replicate", modelId: "kwaivgi/kling-v2.1-master",      description: "Kling Master — top motion, audio nativo, multi-shot",            costPerSec: 0.18, quality: 10, maxDuration: 10 },
  "kling-2.5-turbo":    { provider: "replicate", modelId: "kwaivgi/kling-v2.5-turbo-pro",   description: "Kling 2.5 Turbo Pro — motion mejorado, 1080p, rápido",           costPerSec: 0.12, quality: 10, maxDuration: 10 },
  "kling-2.1":          { provider: "replicate", modelId: "kwaivgi/kling-v2.1",             description: "Kling 2.1 — 1080p motion realista hasta 10s",                    costPerSec: 0.09, quality: 9,  maxDuration: 10 },
  "seedance-pro":       { provider: "replicate", modelId: "bytedance/seedance-1-pro",       description: "Seedance Pro — cinema-quality, multi-reference (9 imgs)",        costPerSec: 0.07, quality: 9,  maxDuration: 10 },
  "seedance-fast":      { provider: "replicate", modelId: "bytedance/seedance-1-pro-fast",  description: "Seedance Fast — rápido y barato, calidad pro",                   costPerSec: 0.05, quality: 7,  maxDuration: 10 },
  "hailuo-02-fast":     { provider: "replicate", modelId: "minimax/hailuo-02-fast",         description: "Hailuo 02 Fast — variante rápida y barata de MiniMax",           costPerSec: 0.03, quality: 7,  maxDuration: 6  },
  "hailuo-02":          { provider: "replicate", modelId: "minimax/hailuo-02",              description: "Hailuo 02 — buen balance velocidad/calidad",                     costPerSec: 0.05, quality: 7,  maxDuration: 6  },
  "wan-2.5":             { provider: "replicate", modelId: "wan-video/wan-2.5-i2v",          description: "Wan 2.5 — open-source de calidad, mejor que la versión Fast",                costPerSec: 0.04,  quality: 8,  maxDuration: 5  },
  "wan-2.5-fast":        { provider: "replicate", modelId: "wan-video/wan-2.5-i2v-fast",     description: "Wan 2.5 Fast — open-source, el más barato del mercado",                      costPerSec: 0.018, quality: 6,  maxDuration: 5  },
  "runway-gen4.5":       { provider: "runway",                                                description: "Runway Gen 4.5 — nueva generación, mejor motion y detalle que Gen 4",       costPerSec: 0.06,  quality: 10, maxDuration: 10 },
  "runway-seedance2":    { provider: "runway",                                                description: "Seedance 2 vía Runway — nueva generación, calidad cinematográfica",          costPerSec: 0.10,  quality: 10, maxDuration: 10 },
  "runway-seedance2-fast":{ provider: "runway",                                               description: "Seedance 2 Fast vía Runway — rápido y barato, calidad pro",                  costPerSec: 0.06,  quality: 8,  maxDuration: 10 },
  "wan-2.5-t2v":         { provider: "replicate", modelId: "wan-video/wan-2.5-t2v",          description: "Wan 2.5 Text-to-Video — T2V puro open-source, sin imagen origen",            costPerSec: 0.025, quality: 7,  maxDuration: 5  },
  "seedance-1-lite":     { provider: "replicate", modelId: "bytedance/seedance-1-lite",       description: "Seedance 1 Lite — versión económica de Seedance Pro",                        costPerSec: 0.03,  quality: 6,  maxDuration: 10 },
};

// Modelos que soportan TEXT-TO-VIDEO puro (sin imagen origen).
// Runway sólo expone /image_to_video en este pipeline → I2V obligatorio.
const T2V_SUPPORTED: Record<VideoModel, boolean> = {
  "runway-gen4-turbo": false,
  "runway-gen3-alpha": false,
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
  "runway-gen4.5":        false,
  "runway-seedance2":     false,
  "runway-seedance2-fast":false,
  "wan-2.5-t2v":          true,
  "seedance-1-lite":      false,
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
    const isVeo3X = veoModel.startsWith("veo-3.0") || veoModel === "veo-3.0-generate-preview" || veoModel === "veo-3.0-fast-generate-preview";
    const requested = opts.aspect || "9:16";
    let aspectRatio: string;
    if (isVeo3X) {
      aspectRatio = "16:9"; // Veo 3.0 sólo permite 16:9
    } else {
      // Veo 2 y Veo 3.1 soportan 16:9 y 9:16
      aspectRatio = (requested === "16:9" || requested === "9:16") ? requested : "9:16";
    }
    const veoDur = Math.min(Math.max(opts.duration || 8, 4), 8);

    const config: any = { aspectRatio, numberOfVideos: 1, personGeneration: "allow_all" };
    // Veo 3.0 y 3.1 tienen duración fija (8s); sólo Veo 2 acepta durationSeconds.
    if (!isVeo3X && !isVeo31) config.durationSeconds = veoDur;

    const veoArgs: any = {
      model: veoModel,
      prompt: prompt.slice(0, 1500),
      config,
    };
    if (imageBuffer) {
      veoArgs.image = { imageBytes: imageBuffer.toString("base64"), mimeType: imageMime };
    }
    let operation: any = await ai.models.generateVideos(veoArgs);

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
      : model === "runway-gen4.5" ? "gen4.5"
      : model === "runway-seedance2" ? "seedance2"
      : model === "runway-seedance2-fast" ? "seedance2_fast"
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
async function loadFfmpeg(): Promise<any> {
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
