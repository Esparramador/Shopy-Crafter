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

import { validateImageUrl } from "./runway.js";

export async function fetchToBuffer(url: string, timeoutMs = 180_000): Promise<Buffer> {
  // SECURITY (HIGH): SSRF guard — reject URLs pointing to internal/private hosts.
  // Replicate-returned URLs are public HTTPS so they always pass; user-supplied
  // referenceImageUrl / sourceImageUrl are validated here.
  validateImageUrl(url);
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
  let url: string;
  if (typeof raw === "string") url = raw;
  else if (raw && typeof (raw as any).url === "function") url = (raw as any).url();
  else if (raw && typeof (raw as any).url === "string") url = (raw as any).url;
  else throw new Error(`Replicate invalid output: ${String(raw).slice(0, 200)}`);
  if (!url?.startsWith("http")) throw new Error(`Replicate invalid URL: ${url?.slice(0, 200)}`);
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
  | "flux-1.1-pro"              // standard pro Flux
  | "flux-schnell"              // fastest, cheap
  | "recraft-v3"                // BEST for text on image (logos, posters)
  | "ideogram-v3-turbo"         // text + photoreal
  | "imagen-4-ultra"            // Google Imagen 4
  | "nano-banana"               // Gemini 2.5 Flash Image
  | "flux-kontext-pro";         // Flux Kontext for character consistency

export const IMAGE_MODELS: Record<ImageGenModel, { replicateId?: string; description: string; costPerImage: number; aspectRatios: string[]; maxResolution: string }> = {
  "flux-1.1-pro-ultra": { replicateId: "black-forest-labs/flux-1.1-pro-ultra", description: "Top photoreal 4MP, mejor calidad fotográfica", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","21:9"], maxResolution: "2752x1536" },
  "flux-1.1-pro":       { replicateId: "black-forest-labs/flux-1.1-pro",       description: "Photoreal estándar, buen precio/calidad", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"],         maxResolution: "1440x1440" },
  "flux-schnell":       { replicateId: "black-forest-labs/flux-schnell",       description: "El más barato y rápido", costPerImage: 0.003, aspectRatios: ["1:1","16:9","9:16"],                                    maxResolution: "1024x1024" },
  "recraft-v3":         { replicateId: "recraft-ai/recraft-v3",                description: "MEJOR para texto en imagen (posters, logos, packaging)", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "ideogram-v3-turbo":  { replicateId: "ideogram-ai/ideogram-v3-turbo",        description: "Texto + photoreal", costPerImage: 0.03, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1024x1024" },
  "imagen-4-ultra":     { replicateId: "google/imagen-4-ultra",                description: "Google Imagen 4 Ultra, premium", costPerImage: 0.06, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "2048x2048" },
  "nano-banana":        { description: "Gemini 2.5 Flash Image - rápido y consistente con marca", costPerImage: 0.04, aspectRatios: ["1:1","16:9","9:16","4:3","3:4","2:3","3:2","4:5","5:4","21:9"], maxResolution: "2K" },
  "flux-kontext-pro":   { replicateId: "black-forest-labs/flux-kontext-pro",   description: "Mantiene consistencia entre imágenes (mismo personaje/estilo)", costPerImage: 0.05, aspectRatios: ["1:1","16:9","9:16","4:3","3:4"], maxResolution: "1440x1440" },
};

export async function generateImage(
  model: ImageGenModel,
  prompt: string,
  opts: { aspectRatio?: string; replicateToken?: string; seed?: number; negativePrompt?: string; referenceImage?: Buffer; referenceMime?: string },
): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
  const cfg = IMAGE_MODELS[model];
  if (!cfg) throw new Error(`Modelo de imagen desconocido: ${model}`);
  const aspect = opts.aspectRatio && cfg.aspectRatios.includes(opts.aspectRatio) ? opts.aspectRatio : cfg.aspectRatios[0];

  // ── Nano Banana (Gemini)
  if (model === "nano-banana") {
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    const contents: any = opts.referenceImage
      ? [{ text: prompt }, { inlineData: { mimeType: opts.referenceMime || "image/png", data: opts.referenceImage.toString("base64") } }]
      : prompt;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents,
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } as any,
    });
    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = (part as any).inlineData || (part as any).inline_data;
      if (inline?.data) {
        return { buffer: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType || inline.mime_type || "image/png", model };
      }
    }
    throw new Error("Nano Banana no devolvió imagen");
  }

  // ── Replicate models
  if (!cfg.replicateId) throw new Error(`Modelo ${model} sin replicateId definido`);
  const token = getReplicateToken(opts.replicateToken);

  let input: any = { prompt, aspect_ratio: aspect };
  if (opts.seed !== undefined) input.seed = opts.seed;
  if (opts.negativePrompt) input.negative_prompt = opts.negativePrompt;

  // Per-model input shape adjustments
  if (model === "flux-1.1-pro-ultra") input = { ...input, raw: false, output_format: "png", output_quality: 95, safety_tolerance: 2 };
  if (model === "recraft-v3") input = { ...input, style: "realistic_image", size: "1820x1024" };
  if (model === "imagen-4-ultra") input = { ...input, output_format: "png", safety_filter_level: "block_only_high" };
  if (model === "flux-kontext-pro" && opts.referenceImage) {
    input.input_image = bufferToDataUri(opts.referenceImage, opts.referenceMime || "image/png");
  }

  const buffer = await replicateRunBuffer(cfg.replicateId, input, token);
  return { buffer, mimeType: "image/png", model };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 2: IMAGE EDIT (modify existing images with text prompt)
// ═══════════════════════════════════════════════════════════════════════════

export type ImageEditModel = "nano-banana" | "flux-kontext-pro" | "gen4-image-edit";

export async function editImage(
  model: ImageEditModel,
  imageBuffer: Buffer,
  imageMime: string,
  editPrompt: string,
  opts: { replicateToken?: string; aspectRatio?: string },
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (model === "nano-banana") {
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        { text: editPrompt },
        { inlineData: { mimeType: imageMime, data: imageBuffer.toString("base64") } } as any,
      ],
      config: { responseModalities: ["IMAGE"] } as any,
    });
    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = (part as any).inlineData || (part as any).inline_data;
      if (inline?.data) return { buffer: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType || "image/png" };
    }
    throw new Error("Nano Banana edit returned no image");
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
    // Runway Gen-4 Image via Replicate. NOTE: takes 1-3 reference images
    // (in our case, the user's input image as the only ref) + text prompt
    // describing the edit. This produces a NEW image preserving identity/style.
    // Per Replicate docs, the input shape on r8.im/runwayml/gen4-image accepts
    // `prompt` and `reference_images` array.
    const token = getReplicateToken(opts.replicateToken);
    const buf = await replicateRunBuffer("runwayml/gen4-image", {
      prompt: editPrompt,
      reference_images: [bufferToDataUri(imageBuffer, imageMime)],
      aspect_ratio: opts.aspectRatio || "1:1",
    }, token);
    return { buffer: buf, mimeType: "image/png" };
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
}

export async function generateTTS(text: string, opts: TTSOptions): Promise<Buffer> {
  const apiKey = getElevenKey();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: opts.modelId || "eleven_multilingual_v2",
      voice_settings: {
        stability: opts.stability ?? 0.5,
        similarity_boost: opts.similarity ?? 0.75,
        style: opts.style ?? 0.3,
        use_speaker_boost: opts.speakerBoost ?? true,
        speed: opts.speed ?? 1.0,
      },
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

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY 10: VIDEO GENERATION (Runway Gen-4 + all Replicate top models)
// ═══════════════════════════════════════════════════════════════════════════

export type VideoModel =
  | "runway-gen4-turbo"
  | "runway-gen3-alpha"
  | "veo-3-fast"
  | "veo-3"
  | "veo-2"
  | "kling-master"
  | "kling-2.1"
  | "seedance-pro"
  | "seedance-fast"
  | "hailuo-02"
  | "wan-2.5-fast";

export const VIDEO_MODELS: Record<VideoModel, { provider: "runway" | "replicate" | "gemini"; modelId?: string; description: string; costPerSec: number; quality: number; maxDuration: number }> = {
  "runway-gen4-turbo":  { provider: "runway",                                              description: "Runway Gen-4 — top quality, control fino, 5/10s",        costPerSec: 0.10, quality: 10, maxDuration: 10 },
  "runway-gen3-alpha":  { provider: "runway",                                              description: "Runway Gen-3 Alpha — buena calidad, mejor precio",       costPerSec: 0.08, quality: 8,  maxDuration: 10 },
  "veo-3-fast":         { provider: "gemini",  modelId: "veo-3.0-fast-generate-preview",  description: "Google Veo 3 Fast — rápido + audio nativo (8s, 16:9)",  costPerSec: 0.40, quality: 9,  maxDuration: 8  },
  "veo-3":              { provider: "gemini",  modelId: "veo-3.0-generate-preview",       description: "Google Veo 3 — máxima calidad + audio nativo (8s, 16:9)",costPerSec: 0.75, quality: 10, maxDuration: 8  },
  "veo-2":              { provider: "gemini",  modelId: "veo-2.0-generate-001",           description: "Google Veo 2 — soporta 9:16 y 16:9, hasta 8s (sin audio)",costPerSec: 0.35, quality: 8,  maxDuration: 8  },
  "kling-master":       { provider: "replicate", modelId: "kwaivgi/kling-v2.1-master",     description: "Kling Master — top motion, audio nativo, multi-shot",   costPerSec: 0.18, quality: 10, maxDuration: 10 },
  "kling-2.1":          { provider: "replicate", modelId: "kwaivgi/kling-v2.1",            description: "Kling 2.1 — 1080p motion realista hasta 10s",           costPerSec: 0.09, quality: 9,  maxDuration: 10 },
  "seedance-pro":       { provider: "replicate", modelId: "bytedance/seedance-1-pro",      description: "Seedance Pro — cinema-quality, multi-reference (9 imgs)",costPerSec: 0.07, quality: 9,  maxDuration: 10 },
  "seedance-fast":      { provider: "replicate", modelId: "bytedance/seedance-1-pro-fast", description: "Seedance Fast — rápido y barato, calidad pro",          costPerSec: 0.05, quality: 7,  maxDuration: 10 },
  "hailuo-02":          { provider: "replicate", modelId: "minimax/hailuo-02",             description: "Hailuo 02 — buen balance velocidad/calidad",            costPerSec: 0.05, quality: 7,  maxDuration: 6  },
  "wan-2.5-fast":       { provider: "replicate", modelId: "wan-video/wan-2.5-i2v-fast",    description: "Wan 2.5 — open-source, el más barato del mercado",      costPerSec: 0.018, quality: 6, maxDuration: 5  },
};

export async function generateVideoFromImage(
  model: VideoModel,
  imageBuffer: Buffer, imageMime: string,
  prompt: string,
  opts: { duration?: number; aspect?: string; replicateToken?: string },
): Promise<Buffer> {
  const cfg = VIDEO_MODELS[model];
  if (!cfg) throw new Error(`Modelo de video desconocido: ${model}`);
  const duration = Math.min(Math.max(opts.duration || 5, 3), cfg.maxDuration);

  // ── Google Veo (Gemini) ────────────────────────────────────────────────
  if (cfg.provider === "gemini") {
    const apiKey = getGeminiKey();
    const ai = new GoogleGenAI({ apiKey });
    const veoModel = cfg.modelId!;
    // Veo 3 only supports 16:9; Veo 2 supports 16:9 and 9:16.
    const isVeo3 = veoModel.startsWith("veo-3");
    const requested = opts.aspect || "9:16";
    const aspectRatio = isVeo3 ? "16:9" : (requested === "16:9" || requested === "9:16" ? requested : "9:16");
    const veoDur = Math.min(Math.max(opts.duration || 8, 4), 8);

    const config: any = { aspectRatio, numberOfVideos: 1, personGeneration: "allow_all" };
    if (!isVeo3) config.durationSeconds = veoDur;

    let operation: any = await ai.models.generateVideos({
      model: veoModel,
      prompt: prompt.slice(0, 1500),
      image: { imageBytes: imageBuffer.toString("base64"), mimeType: imageMime },
      config,
    });

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
    const apiKey = getRunwayKey();
    const dataUri = bufferToDataUri(imageBuffer, imageMime);
    // Per Runway 2024-11-06: ratio must be a specific resolution string.
    // Documented values: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672
    const ratioMap: Record<string, string> = {
      "16:9": "1280:720",
      "9:16": "720:1280",
      "4:3": "1104:832",
      "3:4": "832:1104",
      "4:5": "832:1104",  // closest supported
      "1:1": "960:960",
      "21:9": "1584:672",
    };
    const ratio = ratioMap[opts.aspect || "9:16"] || "720:1280";
    const runwayModel = model === "runway-gen3-alpha" ? "gen3a_turbo" : "gen4_turbo";
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

  // Replicate
  if (!cfg.modelId) throw new Error(`Modelo ${model} sin modelId`);
  const token = getReplicateToken(opts.replicateToken);
  const dataUri = bufferToDataUri(imageBuffer, imageMime);
  let input: any;
  if (cfg.modelId.startsWith("bytedance/")) input = { prompt, image: dataUri, duration, resolution: "1080p" };
  else if (cfg.modelId.startsWith("kwaivgi/")) input = { prompt, start_image: dataUri, duration, aspect_ratio: opts.aspect || "9:16" };
  else if (cfg.modelId.startsWith("minimax/")) input = { prompt, first_frame_image: dataUri, duration };
  else input = { prompt, image: dataUri, duration };

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
        cmd.complexFilter(filters, audioOut ? (opts.overlayText ? ["vout", audioOut] : [audioOut]) : (opts.overlayText ? ["vout"] : []));
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
  const crossfade = Math.max(0, opts.crossfadeSec ?? 0);
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

    // Pre-write voice/music to disk if present (we'll add them as inputs below)
    if (opts.voiceBuffer) await fs.writeFile(path.join(tmp, "voice.mp3"), opts.voiceBuffer);
    if (opts.musicBuffer) await fs.writeFile(path.join(tmp, "music.mp3"), opts.musicBuffer);

    // If crossfade is requested, we need accurate per-clip durations to compute
    // xfade offsets. Use explicit durations if provided, otherwise probe each
    // clip with ffprobe.
    let durations: number[] | null = null;
    if (crossfade > 0 && inputPaths.length > 1) {
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

      if (crossfade > 0 && N > 1 && durations) {
        // Chain xfade with REAL clip durations. The offset of xfade on the
        // i-th transition is the cumulative duration of clips 0..i-1 minus
        // (i * crossfade) — i.e. each transition removes `crossfade` seconds
        // of overlap from the running timeline.
        let prev = "v0";
        let runningEnd = durations[0];
        for (let i = 1; i < N; i++) {
          const out = i === N - 1 ? "vout" : `xf${i}`;
          const offset = Math.max(0, runningEnd - crossfade);
          filters.push(`[${prev}][v${i}]xfade=transition=fade:duration=${crossfade}:offset=${offset.toFixed(3)}[${out}]`);
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
        filters.push(`[${audioInputs[0]}:a]volume=${opts.voiceVolume ?? 1.0}[av]`);
        filters.push(`[${audioInputs[1]}:a]volume=${opts.musicVolume ?? 0.25}[am]`);
        filters.push(`[av][am]amix=inputs=2:duration=longest:dropout_transition=0[aout]`);
        outputMaps.push("aout");
      }

      cmd.complexFilter(filters, outputMaps);
      cmd.videoCodec("libx264")
        .audioCodec(audioInputs.length ? "aac" : "copy")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          ...(audioInputs.length ? ["-shortest"] : []),
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
