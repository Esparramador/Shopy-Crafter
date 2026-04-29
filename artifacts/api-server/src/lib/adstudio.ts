/**
 * AdStudio Engine — anuncios publicitarios IA end-to-end
 *
 * Pipeline:
 *   1. Copy generation (Claude, ya existente vía learnFromOperation)
 *   2. Hero image (Nano Banana = gemini-2.5-flash-image-preview)
 *   3. Video (Runway Gen-4 Turbo, o fallback a Replicate Seedance)
 *   4. Voiceover (ElevenLabs TTS)
 *   5. SFX (ElevenLabs Sound Effects)
 *   6. Compose final MP4 (FFmpeg: mux video + audio, opcional overlay)
 *
 * Cada paso es independiente — si un proveedor falla, el flujo puede continuar
 * o devolver parcial. Cada paso alimenta el ShopyBrain.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";

// ─── CONFIG ──────────────────────────────────────────────────────────────

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";

const NANO_BANANA_MODEL = "gemini-2.5-flash-image";

// Pricing rough estimates (€ per unit) — conservative upper-bound for credit deduction
export const AD_PRICING = {
  copy: 0.02,           // Claude ~2 cents per variant set
  image: 0.04,          // Nano Banana ~4 cents per image
  voiceover: 0.08,      // ElevenLabs ~8 cents per 30s
  sfx: 0.02,            // ElevenLabs SFX ~2 cents per clip
  videoRunway: 0.50,    // Runway Gen-4 Turbo ~€0.50 for 5s
  videoReplicate: 0.25, // Replicate Seedance fast ~€0.25 for 5s
  compose: 0.01,        // FFmpeg local (~free, overhead)
};

// Credits charged per ad (covers video + image + voice + copy + sfx + compose)
export const AD_CREDIT_COST = 6;

// ─── TYPES ───────────────────────────────────────────────────────────────

export type VideoProvider = "runway-gen4-turbo" | "runway-gen3" | "replicate-seedance-fast" | "replicate-kling" | "replicate-hailuo";
export type AdObjective = "awareness" | "conversion" | "retargeting" | "ugc" | "story";
export type AdAspect = "9:16" | "16:9" | "1:1" | "4:5";

export interface AdCopyVariant {
  hook: string;
  body: string;
  cta: string;
  tone: string;
}

export interface AdCampaignInput {
  projectId: number;
  productTitle: string;
  productCategory: string;
  brandName?: string;
  brandTone?: string;
  niche?: string;
  objective: AdObjective;
  targetAudience?: string;
  aspect: AdAspect;
  videoProvider: VideoProvider;
  videoDurationSec: number;        // 3-10
  voiceId?: string;                // ElevenLabs voice id (optional)
  voiceStability?: number;         // 0-1
  voiceStyle?: number;             // 0-1
  addMusic?: boolean;              // generate SFX/ambient
  variantsCount: number;           // 1-5
  customPrompt?: string;           // extra user instruction
  sourceImageUrl?: string;         // base image for video/hero (optional: if absent, we generate with Nano Banana first)
}

export interface AdAssetPaths {
  copyVariantIndex: number;
  heroImagePath?: string;   // local tmp path
  heroImageUrl?: string;    // public URL after vault save
  videoPath?: string;
  videoUrl?: string;
  voicePath?: string;
  voiceUrl?: string;
  sfxPath?: string;
  sfxUrl?: string;
  finalMp4Path?: string;
  finalMp4Url?: string;
  error?: string;
}

export interface AdGenerationResult {
  success: boolean;
  campaignId: string;
  variants: Array<{
    copy: AdCopyVariant;
    assets: AdAssetPaths;
  }>;
  totalCostEstimate: number;
  errors?: string[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

function getElevenLabsKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY not configured");
  return k;
}

function getRunwayKey(): string {
  const k = process.env.RUNWAY_API_KEY;
  if (!k) throw new Error("RUNWAY_API_KEY not configured");
  return k;
}

function getGeminiKey(): string {
  const k = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not configured");
  return k;
}

async function makeTmpDir(prefix = "adstudio"): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefix}-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function fetchToBuffer(url: string, timeoutMs = 120_000): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Fetch ${url} failed ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

// ─── STEP 1: COPY GENERATION (Claude, reuses existing askClaudeJsonWithBrain) ──

export async function generateAdCopy(input: AdCampaignInput, variants: number): Promise<AdCopyVariant[]> {
  const { askClaudeJsonWithBrain } = await import("./claude.js");

  const toneHint = input.brandTone ? ` Brand tone: ${input.brandTone}.` : "";
  const audienceHint = input.targetAudience ? ` Target audience: ${input.targetAudience}.` : "";
  const extraHint = input.customPrompt ? ` Additional context: ${input.customPrompt}.` : "";

  const sys = `You are an elite advertising copywriter specialized in e-commerce video ads (Meta, TikTok, YouTube Shorts). You write hooks that stop the scroll, bodies that build desire, and CTAs that convert.`;

  const prompt = `Generate ${variants} distinct ad copy variants for this product:

Product: ${input.productTitle}
Category: ${input.productCategory}
Brand: ${input.brandName || "Unnamed"}
Niche: ${input.niche || "general e-commerce"}
Objective: ${input.objective}
Aspect: ${input.aspect} (${input.aspect === "9:16" ? "vertical Reels/TikTok" : input.aspect === "16:9" ? "horizontal YouTube" : "square feed"})
Duration: ${input.videoDurationSec}s${toneHint}${audienceHint}${extraHint}

Each variant MUST be strategically different (different angle: benefit vs problem vs social proof vs curiosity vs urgency).

Output JSON array of exactly ${variants} objects:
[{
  "hook": "3-7 word attention-grabber for first 1-2 seconds",
  "body": "15-25 word main selling message",
  "cta": "3-5 word call-to-action",
  "tone": "one word: bold|warm|luxurious|urgent|playful|authoritative"
}]

Each hook must STOP THE SCROLL. Avoid generic phrases like "check this out" or "you won't believe". Be specific and provocative.`;

  const raw = await askClaudeJsonWithBrain<AdCopyVariant[] | { variants: AdCopyVariant[] }>(
    input.projectId,
    prompt,
    sys,
    "general",
    input.niche ?? undefined,
    2000,
  );

  const list = Array.isArray(raw) ? raw : raw.variants;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("Copy generation returned no variants");
  }
  return list.slice(0, variants);
}

// ─── STEP 2: HERO IMAGE via Nano Banana (Gemini 2.5 Flash Image) ───────────

export async function generateHeroImage(
  input: AdCampaignInput,
  copy: AdCopyVariant,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey: getGeminiKey() });

  const aspectHint = input.aspect === "9:16" ? "vertical portrait (9:16 aspect)"
    : input.aspect === "16:9" ? "cinematic wide (16:9 aspect)"
    : input.aspect === "4:5" ? "portrait (4:5 aspect)"
    : "square (1:1 aspect)";

  const prompt = `Ultra-premium product hero shot for advertising.

Product: ${input.productTitle}, ${input.productCategory}
Brand tone: ${input.brandTone || "premium modern"}
Campaign hook: "${copy.hook}"
Mood: ${copy.tone}
Aspect: ${aspectHint}

Requirements:
- Professional commercial photography quality
- Soft cinematic lighting with rim light
- Clean composition, negative space for text overlay
- Photorealistic, magazine-grade
- Colors that match the brand (premium, saturated but tasteful)
- NO text, NO logos, NO watermarks in the image`;

  let result;
  try {
    result = await ai.models.generateContent({
      model: NANO_BANANA_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: input.aspect },
      } as any,
    });
  } catch (err: any) {
    logger.error({ err }, "adstudio: Nano Banana image generation failed");
    throw new Error(`Hero image generation failed: ${err.message}`);
  }

  // Nano Banana returns inline binary data in parts
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inlineData = (part as any).inlineData || (part as any).inline_data;
    if (inlineData?.data) {
      const data = inlineData.data as string;
      const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
      return { buffer: Buffer.from(data, "base64"), mimeType };
    }
  }
  throw new Error("Nano Banana returned no image data");
}

// ─── STEP 3: VIDEO (Runway Gen-4 Turbo or Replicate fallback) ──────────────

async function generateVideoRunway(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  imageBuffer: Buffer,
  imageMime: string,
): Promise<Buffer> {
  const apiKey = getRunwayKey();

  // Runway requires image URL or data URI
  const dataUri = `data:${imageMime};base64,${imageBuffer.toString("base64")}`;

  const model = input.videoProvider === "runway-gen3" ? "gen3a_turbo" : "gen4_turbo";
  // Per Runway 2024-11-06: ratio is a specific resolution string.
  // Note: Runway does NOT support 4:5 aspect. We map 4:5 → 3:4 (832:1104) as closest.
  const ratioMap: Record<string, string> = {
    "16:9": "1280:720",
    "9:16": "720:1280",
    "4:3": "1104:832",
    "3:4": "832:1104",
    "4:5": "832:1104",  // Runway doesn't support 4:5, use closest 3:4
    "1:1": "960:960",
  };
  const ratio = ratioMap[input.aspect] || "720:1280";

  // Duration: Runway supports 5 or 10
  const duration = input.videoDurationSec >= 8 ? 10 : 5;

  const runwayPrompt = `${copy.body}. Cinematic product advertising shot. Smooth camera movement, professional lighting, ${copy.tone} atmosphere.`;

  // 1. Create task
  const createRes = await fetch(`${RUNWAY_BASE}/image_to_video`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model,
      promptImage: dataUri,
      promptText: runwayPrompt.slice(0, 1000),
      duration,
      ratio,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Runway create failed: ${createRes.status} ${err.slice(0, 300)}`);
  }
  const { id: taskId } = await createRes.json() as { id: string };

  // 2. Poll until complete (max 5 minutes)
  const deadline = Date.now() + 5 * 60_000;
  let videoUrl: string | null = null;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 6_000));
    const statusRes = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!statusRes.ok) continue;
    const status = await statusRes.json() as { status: string; output?: string[]; failure?: string };
    if (status.status === "SUCCEEDED" && status.output?.[0]) {
      videoUrl = status.output[0];
      break;
    }
    if (status.status === "FAILED") {
      throw new Error(`Runway task failed: ${status.failure || "unknown"}`);
    }
  }
  if (!videoUrl) throw new Error("Runway timed out after 5 minutes");

  return await fetchToBuffer(videoUrl);
}

async function generateVideoReplicate(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  imageBuffer: Buffer,
  imageMime: string,
  replicateToken: string,
): Promise<Buffer> {
  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: replicateToken });

  const dataUri = `data:${imageMime};base64,${imageBuffer.toString("base64")}`;

  const modelMap: Record<string, string> = {
    "replicate-seedance-fast": "bytedance/seedance-1-pro-fast",
    "replicate-kling": "kwaivgi/kling-v2.1",
    "replicate-hailuo": "minimax/hailuo-02",
  };
  const modelId = modelMap[input.videoProvider] || modelMap["replicate-seedance-fast"];

  const prompt = `${copy.body}. Cinematic product advertising, professional lighting, ${copy.tone} mood, smooth camera.`;

  const input_params: any = modelId.startsWith("bytedance/")
    ? { prompt, image: dataUri, duration: input.videoDurationSec, resolution: "1080p" }
    : modelId.startsWith("kwaivgi/")
    ? { prompt, start_image: dataUri, duration: input.videoDurationSec, aspect_ratio: input.aspect }
    : { prompt, first_frame_image: dataUri, duration: input.videoDurationSec };

  const output = await rep.run(modelId as `${string}/${string}`, { input: input_params });
  const raw = Array.isArray(output) ? output[0] : output;
  let videoUrl: string;
  if (typeof raw === "string") videoUrl = raw;
  else if (raw && typeof (raw as any).url === "function") videoUrl = (raw as any).url();
  else if (raw && typeof (raw as any).url === "string") videoUrl = (raw as any).url;
  else throw new Error(`Replicate invalid output: ${String(raw).slice(0, 200)}`);

  if (!videoUrl?.startsWith("http")) throw new Error(`Replicate invalid URL: ${videoUrl?.slice(0, 200)}`);
  return await fetchToBuffer(videoUrl);
}

export async function generateVideo(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  imageBuffer: Buffer,
  imageMime: string,
  projectReplicateToken?: string,
): Promise<Buffer> {
  if (input.videoProvider.startsWith("runway-")) {
    return await generateVideoRunway(input, copy, imageBuffer, imageMime);
  }
  if (!projectReplicateToken) throw new Error("REPLICATE_API_TOKEN requerido para proveedor Replicate");
  return await generateVideoReplicate(input, copy, imageBuffer, imageMime, projectReplicateToken);
}

// ─── STEP 4: VOICEOVER via ElevenLabs ────────────────────────────────────

const DEFAULT_VOICES = {
  es_male_warm: "onwK4e9ZLuTAKqWW03F9",      // "Daniel" (ES compatible)
  es_female_clear: "21m00Tcm4TlvDq8ikWAM",    // "Rachel"
  es_male_deep: "pNInz6obpgDQGcFmaJgB",       // "Adam"
  es_female_young: "AZnzlk1XvdvUeBnXmlld",    // "Domi"
};

export async function generateVoiceover(
  input: AdCampaignInput,
  copy: AdCopyVariant,
): Promise<Buffer> {
  const apiKey = getElevenLabsKey();

  // Compose what the voice says: hook + body + CTA
  const text = `${copy.hook}. ${copy.body}. ${copy.cta}.`;

  const voiceId = input.voiceId || DEFAULT_VOICES.es_female_clear;

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: input.voiceStability ?? 0.5,
        similarity_boost: 0.75,
        style: input.voiceStyle ?? 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${err.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ─── STEP 5: SFX / AMBIENT via ElevenLabs Sound Effects ──────────────────

export async function generateSfx(
  input: AdCampaignInput,
  copy: AdCopyVariant,
): Promise<Buffer | null> {
  const apiKey = getElevenLabsKey();

  // Compose SFX prompt based on tone
  const sfxPromptMap: Record<string, string> = {
    bold: "Powerful cinematic riser with impact, confident atmosphere, advertising trailer style",
    warm: "Gentle uplifting ambient with soft strings, warm inviting mood, lifestyle commercial",
    luxurious: "Elegant ambient pad with subtle sparkle, premium luxury brand feel",
    urgent: "Fast-paced rhythmic pulse with tension, energetic urgent commercial",
    playful: "Fun bouncy upbeat groove, playful whimsical commercial",
    authoritative: "Serious powerful orchestral motif, professional corporate advertising",
  };
  const sfxPrompt = sfxPromptMap[copy.tone] || sfxPromptMap.warm;

  const res = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text: sfxPrompt,
      duration_seconds: Math.min(input.videoDurationSec, 10),
      prompt_influence: 0.5,
    }),
  });

  if (!res.ok) {
    logger.warn({ status: res.status }, "adstudio: SFX generation failed, continuing without music");
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

// ─── STEP 6: FFmpeg COMPOSE (mux video + voice + music) ──────────────────

export async function composeFinalAd(
  videoBuffer: Buffer,
  voiceBuffer: Buffer,
  sfxBuffer: Buffer | null,
): Promise<Buffer> {
  const tmp = await makeTmpDir("compose");
  try {
    const videoPath = path.join(tmp, "video.mp4");
    const voicePath = path.join(tmp, "voice.mp3");
    const outPath = path.join(tmp, "final.mp4");
    await fs.writeFile(videoPath, videoBuffer);
    await fs.writeFile(voicePath, voiceBuffer);

    let sfxPath: string | null = null;
    if (sfxBuffer) {
      sfxPath = path.join(tmp, "sfx.mp3");
      await fs.writeFile(sfxPath, sfxBuffer);
    }

    // Lazy-load fluent-ffmpeg + ffmpeg-static so the server still starts if they're missing
    let ffmpeg: any;
    let ffmpegPath: string;
    try {
      ffmpeg = (await import("fluent-ffmpeg")).default;
      ffmpegPath = (await import("ffmpeg-static")).default as unknown as string;
      ffmpeg.setFfmpegPath(ffmpegPath);
    } catch (err) {
      throw new Error("FFmpeg not installed. Run: pnpm add fluent-ffmpeg ffmpeg-static @types/fluent-ffmpeg");
    }

    return await new Promise<Buffer>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(videoPath)
        .input(voicePath);

      if (sfxPath) cmd.input(sfxPath);

      if (sfxPath) {
        // Mix voice (louder) + sfx (background) over video
        cmd.complexFilter([
          "[1:a]volume=1.0[voice]",
          "[2:a]volume=0.25[music]",
          "[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[aout]",
        ], ["aout"]);
      } else {
        // Just voice
        cmd.audioCodec("aac");
      }

      cmd.videoCodec("libx264")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-shortest",
        ])
        .on("end", async () => {
          try {
            const buf = await fs.readFile(outPath);
            resolve(buf);
          } catch (e) { reject(e); }
        })
        .on("error", (err: Error) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    // Cleanup tmp
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────

export async function runAdCampaign(
  input: AdCampaignInput,
  projectReplicateToken: string | undefined,
  onProgress?: (event: { stage: string; variantIndex?: number; message: string }) => void,
): Promise<{ variants: Array<{ copy: AdCopyVariant; assets: AdAssetPaths }>; errors: string[] }> {
  const errors: string[] = [];
  const variants: Array<{ copy: AdCopyVariant; assets: AdAssetPaths }> = [];

  // STEP 1: copy generation (single batch for all variants)
  onProgress?.({ stage: "copy", message: "Generando ángulos publicitarios con Claude..." });
  let copies: AdCopyVariant[];
  try {
    copies = await generateAdCopy(input, input.variantsCount);
  } catch (err: any) {
    throw new Error(`Copy generation failed: ${err.message}`);
  }

  // STEPS 2-6: per variant, in sequence (parallel would multiply API rate limits)
  for (let i = 0; i < copies.length; i++) {
    const copy = copies[i];
    const assets: AdAssetPaths = { copyVariantIndex: i };

    try {
      // STEP 2: Hero image (or reuse sourceImageUrl)
      onProgress?.({ stage: "image", variantIndex: i, message: `[${i + 1}/${copies.length}] Generando imagen hero con Nano Banana...` });
      let imgBuf: Buffer; let imgMime: string;
      if (input.sourceImageUrl) {
        imgBuf = await fetchToBuffer(input.sourceImageUrl);
        imgMime = "image/jpeg";
      } else {
        const hero = await generateHeroImage(input, copy);
        imgBuf = hero.buffer; imgMime = hero.mimeType;
      }

      // STEP 3: Video
      onProgress?.({ stage: "video", variantIndex: i, message: `[${i + 1}/${copies.length}] Generando video con ${input.videoProvider}... (1-3 min)` });
      const videoBuf = await generateVideo(input, copy, imgBuf, imgMime, projectReplicateToken);

      // STEP 4: Voiceover (parallel with SFX)
      onProgress?.({ stage: "voice", variantIndex: i, message: `[${i + 1}/${copies.length}] Generando voz con ElevenLabs...` });
      const [voiceBuf, sfxBuf] = await Promise.all([
        generateVoiceover(input, copy),
        input.addMusic ? generateSfx(input, copy) : Promise.resolve(null),
      ]);

      // STEP 6: Compose
      onProgress?.({ stage: "compose", variantIndex: i, message: `[${i + 1}/${copies.length}] Componiendo video final con FFmpeg...` });
      const finalMp4 = await composeFinalAd(videoBuf, voiceBuf, sfxBuf);

      // Save to tmp for caller to persist
      const tmp = await makeTmpDir(`final-${i}`);
      const finalPath = path.join(tmp, `ad-variant-${i}.mp4`);
      await fs.writeFile(finalPath, finalMp4);
      assets.finalMp4Path = finalPath;

      // Also save intermediate assets for debugging / per-asset download
      const imgPath = path.join(tmp, `hero-${i}.${imgMime.split("/")[1] || "png"}`);
      await fs.writeFile(imgPath, imgBuf);
      assets.heroImagePath = imgPath;

      const voicePath = path.join(tmp, `voice-${i}.mp3`);
      await fs.writeFile(voicePath, voiceBuf);
      assets.voicePath = voicePath;

      if (sfxBuf) {
        const sfxPath = path.join(tmp, `sfx-${i}.mp3`);
        await fs.writeFile(sfxPath, sfxBuf);
        assets.sfxPath = sfxPath;
      }
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      assets.error = msg;
      errors.push(`Variant ${i + 1}: ${msg}`);
      logger.error({ err, variant: i }, "adstudio: variant failed");
    }

    variants.push({ copy, assets });
  }

  return { variants, errors };
}
