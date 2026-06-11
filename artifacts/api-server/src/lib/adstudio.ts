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
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";
import { generateNanoBanana } from "./nano-banana.js";

// ─── CONFIG ──────────────────────────────────────────────────────────────

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";

/**
 * Resolve the ffmpeg binary path. We prefer `ffmpeg-static` (bundled binary),
 * but fall back to the system `ffmpeg` (provided by Nix runtime path) when the
 * static path is missing or invalid — this happens when esbuild bundles the
 * server and `__dirname` inside `ffmpeg-static/index.js` resolves to `dist/`
 * instead of the original `node_modules/ffmpeg-static/` directory.
 */
let _resolvedFfmpegPath: string | null = null;
async function resolveFfmpegPath(): Promise<string> {
  if (_resolvedFfmpegPath) return _resolvedFfmpegPath;
  try {
    const staticPath = (await import("ffmpeg-static")).default as unknown as string;
    if (staticPath && typeof staticPath === "string" && existsSync(staticPath)) {
      _resolvedFfmpegPath = staticPath;
      return staticPath;
    }
  } catch {
    // ignore — fall through to system ffmpeg
  }
  _resolvedFfmpegPath = "ffmpeg";
  return "ffmpeg";
}

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

export type VideoProvider =
  | "runway-gen4.5"
  | "runway-gen4-turbo"
  | "replicate-seedance-pro"
  | "replicate-seedance-fast"
  | "replicate-seedance-lite"
  | "replicate-kling-master"
  | "replicate-kling-2.5-turbo"
  | "replicate-kling"
  | "replicate-hailuo"
  | "replicate-wan-2.5";
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
  /** Optional curated genre template (key from AD_TEMPLATES). Pre-loads
   *  copySystemAddon, heroStyle, cameraPreset, voiceProfile, musicBrief,
   *  transitionPreset, recommendLipSync, burnSubsByDefault. */
  template?: string;
  /** Force burn subtitles into the final MP4 (overrides template default). */
  burnSubs?: boolean;
  /** Subtitle language (ISO 639-1) for Whisper. Defaults to "auto". */
  subsLanguage?: string;
  /** Render deterministic brand-name + CTA text via FFmpeg drawtext after compose.
   *  When true (default), the AI video model is instructed NOT to render text,
   *  and the brand label + CTA are burned in with crisp DejaVu Sans Bold. */
  renderBrandOverlay?: boolean;
  /** Optional explicit brand overlay text (defaults to input.brandName). */
  brandOverlayText?: string;
  /** Optional explicit CTA overlay text (defaults to copy.cta per variant). */
  ctaOverlayText?: string;
}

// ─── DETERMINISTIC TEXT OVERLAY (FFmpeg drawtext) ────────────────────────
//
// The AI video models (Runway Gen-4, Kling, Seedance, Hailuo, etc.) routinely
// hallucinate misspelled text, garbled brand names, and incoherent captions
// when asked to render typography. To deliver production-grade ads we follow
// the same rule used by all production-grade video ad pipelines:
//   1) instruct the model to render ABSOLUTELY NO text/logos/captions
//   2) burn the brand label and CTA in afterwards with FFmpeg drawtext using
//      DejaVu Sans Bold so spelling is guaranteed and typography is crisp.

const DEJAVU_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

/** Strict instruction we append to every video-model prompt to suppress text
 *  hallucinations and design drift. */
const ANTI_TEXT_AND_FIDELITY = [
  "STRICT DESIGN FIDELITY: every garment, product and surface is a solid",
  "rigid object that never deconstructs, recolors, morphs, melts or redraws",
  "mid-frame. The exact design from the input image is preserved frame-by-frame.",
  "Consistent shape, consistent color palette, consistent print, consistent logo position.",
  "ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LOGOS, NO BRAND NAMES,",
  "NO CAPTIONS, NO SUBTITLES, NO WATERMARKS, NO TYPOGRAPHY, NO WRITING OF ANY KIND",
  "on any surface, garment, product, wall, sign, screen or background.",
  "Photorealistic motion, smooth camera, no flicker, no warping, no artifacts.",
].join(" ");

/** Negative prompt sent to every Replicate video model that supports it. */
const VIDEO_NEGATIVE_PROMPT = [
  "text, words, letters, captions, subtitles, watermark, logo, brand name,",
  "typography, writing, sign, label, garbled text, misspelled letters,",
  "deconstruction, melting, morphing, color shift, design change, flicker, warping,",
  "low quality, blurry, distorted, artifact, deformed, ugly, glitch",
].join(" ");

/**
 * Build a TEXT-FREE visual prompt for the AI video model.
 *
 * The narrative copy (`copy.body`) routinely contains the brand name, the
 * product name, the CTA, even prices — all things the video model will try
 * to "burn" into the frame as garbled hallucinated text. To stop the noise
 * we deliberately DROP `copy.body` from the video prompt and reconstruct it
 * with purely visual cues: tone (atmosphere), category (subject), template
 * camera preset (motion), aspect (framing). The ad's actual message is
 * delivered separately by (a) the voiceover, and (b) the FFmpeg drawtext
 * overlay for brand and CTA.
 */
function escapeRegexAd(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildVisualVideoPrompt(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  cameraLine: string,
): string {
  // Forbidden tokens — every brand-identifying string the operator supplied
  // PLUS the AI-generated copy fields. We will scrub these from the subject
  // line AND from the final prompt before it leaves this function. If any
  // survive (developer error / new field added), we FAIL-CLOSED with a throw
  // so the variant errors out instead of silently shipping leaked text.
  const forbidden = [
    input.brandName,
    input.productTitle,
    input.brandOverlayText,
    input.ctaOverlayText,
    copy.cta,
    copy.hook,
    copy.body,
  ].filter((s): s is string => typeof s === "string" && s.trim().length >= 2);

  // Build raw subject from category, then strip every forbidden token from it
  // (catalogs commonly stuff brand names into productCategory).
  let subject = (input.productCategory || "product").replace(/[^a-zA-Z0-9 ,.-]/g, "").slice(0, 80);
  for (const tk of forbidden) {
    try { subject = subject.replace(new RegExp(escapeRegexAd(tk), "gi"), " "); } catch { /* skip */ }
  }
  subject = subject.replace(/\s+/g, " ").trim() || "product";

  const tone = (copy.tone || "premium").replace(/[^a-zA-Z0-9 ,.-]/g, "").slice(0, 40);
  let out = [
    `Cinematic product advertising shot of a ${subject}.`,
    cameraLine.trim(),
    `Professional studio lighting, ${tone} atmosphere, photorealistic.`,
    ANTI_TEXT_AND_FIDELITY,
  ].filter(Boolean).join(" ").trim();

  // Final scrub on the assembled prompt (defense-in-depth: catches any leak
  // we might add through cameraLine or future template edits).
  for (const tk of forbidden) {
    try { out = out.replace(new RegExp(escapeRegexAd(tk), "gi"), " "); } catch { /* skip */ }
  }
  out = out.replace(/\s+/g, " ").trim();

  // Telemetry + fail-closed leak gate.
  const head = out.replace(ANTI_TEXT_AND_FIDELITY, "").trim();
  const lowerHead = head.toLowerCase();
  const leakedToken = forbidden.find((tk) => {
    const t = tk.toLowerCase().trim();
    return t.length >= 3 && lowerHead.includes(t);
  });
  if (leakedToken) {
    logger.error(
      { videoPromptHead: head.slice(0, 200), leakedToken },
      "adstudio: ANTI-TEXT LEAK DETECTED — refusing to send prompt to video provider",
    );
    throw new Error(
      `Anti-text-leak gate: forbidden token "${leakedToken}" survived sanitization in video prompt. ` +
      `This is a bug — please report. The variant has been refused to prevent shipping garbled IA typography.`,
    );
  }
  logger.info(
    { videoPromptHead: head.slice(0, 200), brandLeakDetected: false, forbiddenTokenCount: forbidden.length },
    "adstudio: built visual-only video prompt",
  );
  return out;
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
  /** True when the deterministic FFmpeg drawtext brand/CTA overlay was
   *  successfully applied. False when overlay was requested but failed
   *  (the ad still ships, but text may be absent). Undefined when overlay
   *  was not requested at all. */
  overlayApplied?: boolean;
  /** Error message from the overlay step, if it failed. */
  overlayError?: string;
  /** Which provider generated the hero image: "gemini" (Google direct) or
   *  "replicate" (fallback via google/nano-banana on Replicate). Undefined
   *  when sourceImageUrl was supplied (no AI generation). */
  heroImageProvider?: "gemini" | "replicate";
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

async function fetchToBuffer(url: string, timeoutMs = 120_000, opts: { ssrfGuard?: boolean } = {}): Promise<Buffer> {
  if (opts.ssrfGuard) {
    const { validateImageUrlAsync } = await import("./runway.js");
    await validateImageUrlAsync(url); // throws on private IP literal AND on DNS rebind
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // SSRF hardening: refuse to follow redirects when guard is active
    // (open-redirect attacks could otherwise rebound to internal hosts).
    const r = await fetch(url, {
      signal: ctrl.signal,
      ...(opts.ssrfGuard ? { redirect: "error" as const } : {}),
    });
    if (!r.ok) throw new Error(`Fetch ${url} failed ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

const SUPPORTED_VIDEO_PROVIDERS = new Set([
  "runway-gen4.5",
  "runway-gen4-turbo",
  "replicate-seedance-pro",
  "replicate-seedance-fast",
  "replicate-seedance-lite",
  "replicate-kling-master",
  "replicate-kling-2.5-turbo",
  "replicate-kling",
  "replicate-hailuo",
  "replicate-wan-2.5",
]);

// ─── STEP 1: COPY GENERATION (Claude, reuses existing askClaudeJsonWithBrain) ──

export async function generateAdCopy(input: AdCampaignInput, variants: number): Promise<AdCopyVariant[]> {
  const { askClaudeJsonWithBrain } = await import("./claude.js");
  const { getTemplate } = await import("./ad-templates.js");

  const tpl = getTemplate(input.template);
  const toneHint = input.brandTone ? ` Brand tone: ${input.brandTone}.` : "";
  const audienceHint = input.targetAudience ? ` Target audience: ${input.targetAudience}.` : "";
  const extraHint = input.customPrompt ? ` Additional context: ${input.customPrompt}.` : "";
  const tplHint = tpl ? ` Genre template: ${tpl.label}. ${tpl.copySystemAddon}` : "";

  const sys = `You are an elite advertising copywriter specialized in e-commerce video ads (Meta, TikTok, YouTube Shorts). You write hooks that stop the scroll, bodies that build desire, and CTAs that convert.${tplHint}`;

  // CRITICAL: tie copy length to video duration so the voiceover fits naturally
  // without atempo speed-up or hard-trim. Spanish narration averages ~2.5 words
  // per second; English ~2.7. We reserve ~1s of silence at the end (CTA tail)
  // and ~0.4s at the start (hook breath), so the speakable budget is
  // (duration - 1.4) seconds. We split the budget across hook/body/cta with
  // a 20/65/15 weighting. For very short ads (3-5s) the per-segment minima
  // would exceed the total budget — we skip minima and let the proportional
  // split handle it (preventing impossible "min sum > total" prompts).
  // Language detection is explicit: derived from customPrompt's "Idioma del
  // voiceover: <lang>" hint that smart-quick injects (default Spanish).
  const langHint = (input.customPrompt || "").match(/Idioma[^:]*:\s*(\w+)/i)?.[1]?.toLowerCase() || "";
  const isSpanish = langHint === "" || /^(es|esp|spanish|español|castellano)/i.test(langHint);
  const wordsPerSec = isSpanish ? 2.5 : 2.7;
  const speakableSec = Math.max(2.0, input.videoDurationSec - 1.4);
  const totalWords = Math.max(6, Math.floor(speakableSec * wordsPerSec));
  // Proportional allocation; minima only applied if total budget allows them
  // (i.e. >= 10 words). Below that, we let proportions drive everything so
  // hook+body+cta == totalWords exactly.
  const minBudget = 10;
  let hookWords: number;
  let ctaWords: number;
  let bodyWords: number;
  if (totalWords >= minBudget) {
    hookWords = Math.max(3, Math.min(8, Math.round(totalWords * 0.20)));
    ctaWords = Math.max(3, Math.min(7, Math.round(totalWords * 0.15)));
    bodyWords = Math.max(4, totalWords - hookWords - ctaWords);
  } else {
    // Tight budget (3-5s ads): no minima, proportional only
    hookWords = Math.max(2, Math.round(totalWords * 0.25));
    ctaWords = Math.max(2, Math.round(totalWords * 0.20));
    bodyWords = Math.max(2, totalWords - hookWords - ctaWords);
  }

  const prompt = `Generate ${variants} distinct ad copy variants for this product:

Product: ${input.productTitle}
Category: ${input.productCategory}
Brand: ${input.brandName || "Unnamed"}
Niche: ${input.niche || "general e-commerce"}
Objective: ${input.objective}
Aspect: ${input.aspect} (${input.aspect === "9:16" ? "vertical Reels/TikTok" : input.aspect === "16:9" ? "horizontal YouTube" : "square feed"})
Duration: ${input.videoDurationSec}s${toneHint}${audienceHint}${extraHint}

⚠️ CRITICAL TIMING CONSTRAINT (do not violate):
- The voiceover MUST fit in ${speakableSec.toFixed(1)} seconds at natural speaking pace.
- Total budget: ${totalWords} words across hook + body + cta.
- HOOK: ${hookWords} words MAX (1 short sentence, no comma).
- BODY: ${bodyWords} words MAX (1-2 short sentences).
- CTA: ${ctaWords} words MAX (imperative, urgent).
- COUNT YOUR WORDS. Going over will cause the audio to be sped up or cut off mid-sentence — DO NOT exceed the budget under any circumstance.

Each variant MUST be strategically different (different angle: benefit vs problem vs social proof vs curiosity vs urgency).

Output JSON array of exactly ${variants} objects:
[{
  "hook": "STOP-THE-SCROLL opener, ${hookWords} words MAX",
  "body": "Main selling message, ${bodyWords} words MAX, must flow naturally when spoken",
  "cta": "Action verb + benefit, ${ctaWords} words MAX",
  "tone": "one word: bold|warm|luxurious|urgent|playful|authoritative"
}]

Each hook must STOP THE SCROLL. Avoid generic phrases like "check this out" or "you won't believe". Be specific and provocative. WORD COUNTS ARE NON-NEGOTIABLE — the entire ad fails if you exceed them.`;

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
  projectReplicateToken?: string,
): Promise<{ buffer: Buffer; mimeType: string; provider: "gemini" | "replicate" }> {
  const { getTemplate } = await import("./ad-templates.js");
  const tpl = getTemplate(input.template);

  const aspectHint = input.aspect === "9:16" ? "vertical portrait (9:16 aspect)"
    : input.aspect === "16:9" ? "cinematic wide (16:9 aspect)"
    : input.aspect === "4:5" ? "portrait (4:5 aspect)"
    : "square (1:1 aspect)";
  const styleLine = tpl ? `\nStyle (template "${tpl.label}"): ${tpl.heroStyle}` : "";

  const prompt = `Ultra-premium product hero shot for advertising.

Product: ${input.productTitle}, ${input.productCategory}
Brand tone: ${input.brandTone || "premium modern"}
Campaign hook: "${copy.hook}"
Mood: ${copy.tone}
Aspect: ${aspectHint}${styleLine}

Requirements:
- Professional commercial photography quality
- Soft cinematic lighting with rim light
- Clean composition, negative space for text overlay
- Photorealistic, magazine-grade
- Colors that match the brand (premium, saturated but tasteful)
- NO text, NO logos, NO watermarks in the image`;

  try {
    const out = await generateNanoBanana(prompt, {
      aspectRatio: input.aspect,
      replicateToken: projectReplicateToken,
    });
    return out;
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "adstudio: Nano Banana hero image failed (all providers)");
    throw new Error(`Hero image generation failed: ${err.message}`);
  }
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

  const model = input.videoProvider === "runway-gen4.5" ? "gen4_5_turbo" : "gen4_turbo";
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

  const { getTemplate } = await import("./ad-templates.js");
  const { CAMERA_PRESETS } = await import("./fusion-studio-pro.js");
  const tpl = getTemplate(input.template);
  const camera = tpl ? CAMERA_PRESETS[tpl.cameraPreset] : null;
  const cameraLine = camera ? ` ${camera.promptPrefix}` : "";
  // Visual-only prompt: NEVER pass copy.body / brand / product name to the
  // video model — it would try to render them as garbled text on screen.
  const runwayPrompt = buildVisualVideoPrompt(input, copy, cameraLine);

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
    "replicate-seedance-pro":     "bytedance/seedance-1-pro",
    "replicate-seedance-fast":    "bytedance/seedance-1-pro",
    "replicate-seedance-lite":    "bytedance/seedance-1-lite",
    "replicate-kling-master":     "kwaivgi/kling-v2-master",
    "replicate-kling-2.5-turbo":  "kwaivgi/kling-v2.5-turbo",
    "replicate-kling":            "kwaivgi/kling-v2.1",
    "replicate-hailuo":           "minimax/hailuo-02",
    "replicate-wan-2.5":          "wan-ai/wan-2.5-i2v",
  };
  const modelId = modelMap[input.videoProvider] || modelMap["replicate-seedance-lite"];

  const { getTemplate } = await import("./ad-templates.js");
  const { CAMERA_PRESETS } = await import("./fusion-studio-pro.js");
  const tpl = getTemplate(input.template);
  const camera = tpl ? CAMERA_PRESETS[tpl.cameraPreset] : null;
  const cameraLine = camera ? ` ${camera.promptPrefix}` : "";
  // Visual-only prompt: NEVER pass copy.body / brand / product name to the
  // video model — it would try to render them as garbled text on screen.
  const prompt = buildVisualVideoPrompt(input, copy, cameraLine);
  const negativePrompt = VIDEO_NEGATIVE_PROMPT;

  const input_params: any = modelId.startsWith("bytedance/")
    ? { prompt, image: dataUri, duration: input.videoDurationSec, resolution: "1080p" }
    : modelId.startsWith("kwaivgi/")
    ? { prompt, negative_prompt: negativePrompt, start_image: dataUri, duration: input.videoDurationSec, aspect_ratio: input.aspect }
    : { prompt, prompt_optimizer: false, first_frame_image: dataUri, duration: input.videoDurationSec };

  const output = await rep.run(modelId as `${string}/${string}`, { input: input_params });
  const raw = Array.isArray(output) ? output[0] : output;
  let videoUrl: string;
  if (typeof raw === "string") {
    videoUrl = raw;
  } else if (raw && typeof (raw as any).url === "function") {
    const u = (raw as any).url();
    videoUrl = typeof u === "string" ? u : (u && typeof u.toString === "function" ? u.toString() : String(u));
  } else if (raw && typeof (raw as any).url === "string") {
    videoUrl = (raw as any).url;
  } else if (raw && (raw as any).url && typeof (raw as any).url.toString === "function") {
    videoUrl = (raw as any).url.toString();
  } else {
    throw new Error(`Replicate invalid output: ${String(raw).slice(0, 200)}`);
  }

  if (!videoUrl || !videoUrl.startsWith("http")) {
    throw new Error(`Replicate invalid URL: ${(videoUrl || "").slice(0, 200)}`);
  }
  return await fetchToBuffer(videoUrl);
}

export async function generateVideo(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  imageBuffer: Buffer,
  imageMime: string,
  projectReplicateToken?: string,
): Promise<Buffer> {
  if (!SUPPORTED_VIDEO_PROVIDERS.has(input.videoProvider)) {
    throw new Error(`Proveedor de video no soportado: "${input.videoProvider}". Disponibles: ${[...SUPPORTED_VIDEO_PROVIDERS].join(", ")}`);
  }
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
      model_id: "eleven_v3",
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

    // Lazy-load fluent-ffmpeg so the server still starts if it's missing
    let ffmpeg: any;
    try {
      ffmpeg = (await import("fluent-ffmpeg")).default;
      ffmpeg.setFfmpegPath(await resolveFfmpegPath());
    } catch (err) {
      throw new Error("FFmpeg not installed. Run: pnpm add fluent-ffmpeg ffmpeg-static @types/fluent-ffmpeg");
    }

    // Probe the video duration and refit the voice so speech ends 1s
    // BEFORE the video does (audio total length == video length, padded
    // with silence). This eliminates the "voice cut off at end" symptom.
    const { fitVoiceToVideo } = await import("./fusion-studio-pro.js");
    let videoDurSec = 30;
    try {
      videoDurSec = await new Promise<number>((res, rej) => {
        ffmpeg.ffprobe(videoPath, (err: Error | null, data: any) => {
          if (err) return rej(err);
          const d = data?.format?.duration;
          const n = typeof d === "number" ? d : parseFloat(String(d));
          if (!isFinite(n) || n <= 0) return rej(new Error("ffprobe: bad duration"));
          res(n);
        });
      });
    } catch { /* fallback to 30 */ }
    const fittedVoice = await fitVoiceToVideo(voiceBuffer, videoDurSec);
    await fs.writeFile(voicePath, fittedVoice);

    let sfxPath: string | null = null;
    if (sfxBuffer) {
      sfxPath = path.join(tmp, "sfx.mp3");
      await fs.writeFile(sfxPath, sfxBuffer);
    }

    return await new Promise<Buffer>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(videoPath)
        .input(voicePath);

      if (sfxPath) cmd.input(sfxPath);

      if (sfxPath) {
        // Mix voice (foreground, loudness-normalized) + music (background, ducked).
        // FIX CRÍTICO (audio-only bug): la versión anterior mapeaba SOLO ["aout"]
        // al usar complexFilter → FFmpeg dropeaba el video stream. Mantenemos el
        // passthrough [0:v]null[vpass] para preservar el video.
        //
        // FIX LOUDNESS (2026-05): el voiceover salía a -29 LUFS (muy bajo para
        // social media; estándar Reels/TikTok ≈ -14 a -16 LUFS). Aplicamos:
        //   1) loudnorm sobre la voz → llevar a -16 LUFS, TP -1.5 dBFS, LRA 11
        //   2) sidechaincompress en la música → "duck" automático cuando habla
        //      la voz (la música baja sola para que la voz se entienda)
        //   3) música base bajada de 0.25 → 0.18 (todavía audible pero menos
        //      intrusiva). El sidechain hace el resto.
        //   4) loudnorm final sobre el mix → garantiza nivel publicitario
        //      consistente independientemente del volumen original de la voz.
        // NOTE: asplit duplicates the voice stream so it can be both the
        // sidechain trigger AND the foreground signal in amix. Reusing
        // [voice] twice without asplit is a hard FFmpeg error ("Invalid
        // argument", exit 234). amix `weights` must use a quoted string
        // ("2 1") in fluent-ffmpeg's array form.
        cmd.complexFilter([
          "[0:v]null[vpass]",
          "[1:a]loudnorm=I=-16:LRA=11:TP=-1.5,volume=1.4,asplit=2[voice1][voice2]",
          "[2:a]volume=0.18[musicraw]",
          "[musicraw][voice2]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300:makeup=1[musicducked]",
          "[voice1][musicducked]amix=inputs=2:duration=first:dropout_transition=0:weights='2 1'[mixed]",
          "[mixed]loudnorm=I=-14:LRA=9:TP=-1.0[aout]",
        ], ["vpass", "aout"]);
      } else {
        // Voice only — still apply loudness normalization to hit social-media targets.
        cmd.complexFilter([
          "[0:v]null[vpass]",
          "[1:a]loudnorm=I=-14:LRA=9:TP=-1.0[aout]",
        ], ["vpass", "aout"]);
      }

      cmd.videoCodec("libx264")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          // No -shortest: voice was pre-fitted to videoDurSec exactly so
          // the muxer should track the video stream length to ensure we
          // never truncate either.
          `-t ${videoDurSec.toFixed(3)}`,
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

// ─── STEP 6.5: BRAND + CTA OVERLAY (deterministic FFmpeg drawtext) ──────
//
// Burns the brand label (intro fade-in over the first ~3.5s) and the CTA
// (outro fade-in over the last ~3.5s) into the final MP4 with crisp
// DejaVu Sans Bold typography. Spelling is guaranteed because the text is
// rendered by FFmpeg, not by the AI video model.

/** Sanitize text for use with FFmpeg drawtext via textfile (we still strip
 *  control characters and normalize whitespace; the textfile mechanism handles
 *  most special-character escaping for us). */
function sanitizeOverlayText(raw: string, maxLen: number): string {
  const cleaned = String(raw || "")
    // strip control chars that ffmpeg/libass dislike
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  // Hard truncate at word boundary if possible
  const cut = cleaned.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

async function probeVideoMeta(filePath: string): Promise<{ durationSec: number; width: number; height: number }> {
  // Use the system ffprobe (provided by Nix runtime path); fluent-ffmpeg picks
  // it up from PATH automatically. We avoid pulling an extra `ffprobe-static`
  // dep so the bundle stays slim and the OS binary is always in sync with the
  // ffmpeg we run.
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  return await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: any) => {
      if (err) return reject(err);
      const stream = (data?.streams || []).find((s: any) => s.codec_type === "video");
      const durationSec = Number(data?.format?.duration) || Number(stream?.duration) || 0;
      const width = Number(stream?.width) || 0;
      const height = Number(stream?.height) || 0;
      if (!durationSec || !width || !height) {
        return reject(new Error(`ffprobe: invalid metadata duration=${durationSec} ${width}x${height}`));
      }
      resolve({ durationSec, width, height });
    });
  });
}

export async function applyBrandOverlay(
  videoBuffer: Buffer,
  opts: {
    brandText: string;
    ctaText: string;
    aspect?: AdAspect;
  },
): Promise<Buffer> {
  const brand = sanitizeOverlayText(opts.brandText, 28);
  const cta = sanitizeOverlayText(opts.ctaText, 36);
  // If both empty, nothing to do — return original.
  if (!brand && !cta) return videoBuffer;

  // Verify font exists. FAIL LOUD (not silent): publishing an ad without
  // brand text is unacceptable — the user explicitly relies on this layer
  // to deliver the brand name and CTA after we forbid the AI from rendering
  // any text. If the font is missing the deployment is broken and must be
  // fixed at the system level (apt install fonts-dejavu-core).
  try {
    await fs.access(DEJAVU_BOLD_PATH);
  } catch {
    logger.error({ path: DEJAVU_BOLD_PATH }, "adstudio: DejaVu Bold MISSING — cannot burn deterministic brand/CTA overlay");
    throw new Error(
      `Brand overlay font not installed: ${DEJAVU_BOLD_PATH}. ` +
      `Install with: apt-get install -y fonts-dejavu-core. ` +
      `Refusing to ship an ad without legible brand/CTA typography.`,
    );
  }

  const tmp = await makeTmpDir("overlay");
  try {
    const inPath = path.join(tmp, "in.mp4");
    const outPath = path.join(tmp, "out.mp4");
    await fs.writeFile(inPath, videoBuffer);

    const { durationSec, height, width } = await probeVideoMeta(inPath);

    // Probe successful — fontsize/positioning ratios tuned to look good across
    // 9:16 (720x1280, 1080x1920), 16:9 (1280x720), 1:1, 4:5.
    const margin  = Math.round(height * 0.04);    // lateral safety margin (clamped)
    const safeW   = Math.max(100, width - 2 * margin);

    // Auto-shrink fontsize so the longest text always fits inside safeW.
    // DejaVu Sans Bold average glyph width ≈ 0.70 × fontsize for mixed case
    // (empirically measured at 1088×1920 — leaves a small visual safety margin).
    const fitFontSize = (text: string, baseSize: number): number => {
      if (!text) return baseSize;
      const estimated = text.length * 0.70;
      const maxFs = Math.floor(safeW / Math.max(1, estimated));
      return Math.max(20, Math.min(baseSize, maxFs));
    };
    const brandFs = fitFontSize(opts.brandText, Math.round(height * 0.045));
    const ctaFs   = fitFontSize(opts.ctaText,   Math.round(height * 0.062));

    // Brand intro window: 0.4s … min(4.5s, 35% of video)
    const brandStart = 0.4;
    const brandEnd = Math.max(brandStart + 1.5, Math.min(4.5, durationSec * 0.35));
    const brandFadeIn = 0.35;
    const brandFadeOut = 0.4;

    // CTA outro window: last 3.5s (or 60% of video, whichever shorter)
    const ctaWindow = Math.min(3.5, durationSec * 0.6);
    const ctaStart = Math.max(0.5, durationSec - ctaWindow);
    const ctaEnd = Math.max(ctaStart + 0.5, durationSec - 0.3);
    const ctaFadeIn = 0.35;
    const ctaFadeOut = 0.4;

    // Write text bodies to files so FFmpeg drawtext doesn't have to escape
    // arbitrary unicode/quotes/colons inside the filtergraph string.
    const brandFile = path.join(tmp, "brand.txt");
    const ctaFile = path.join(tmp, "cta.txt");
    if (brand) await fs.writeFile(brandFile, brand, "utf8");
    if (cta) await fs.writeFile(ctaFile, cta, "utf8");

    // Helper: filter chunk for one drawtext layer (escaped path is required
    // because filter syntax uses : and , as separators).
    const escFilterPath = (p: string) => p.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    const fontEsc = escFilterPath(DEJAVU_BOLD_PATH);

    // x is centered AND clamped so very long labels never run off-screen.
    const xCentered = `if(lt(text_w\\,w-2*${margin})\\,(w-text_w)/2\\,${margin})`;

    // Build alpha expressions: linear fade in, hold, fade out.
    const alphaExpr = (t0: number, t1: number, fIn: number, fOut: number) =>
      `if(lt(t\\,${t0})\\,0\\,if(lt(t\\,${t0 + fIn})\\,(t-${t0})/${fIn}\\,if(lt(t\\,${t1 - fOut})\\,1\\,if(lt(t\\,${t1})\\,(${t1}-t)/${fOut}\\,0))))`;

    const layers: string[] = [];

    // Professional legibility strategy (broadcast-grade):
    //  1. Semi-transparent dark backplate (drawtext box=1) behind every text
    //     line so the typography stays readable on bright/busy backgrounds.
    //     This is the same technique used by Reels/Shorts captions, Apple
    //     Keynote lower-thirds and Netflix subtitles.
    //  2. Strong outline (borderw 3-4 black @0.9) for hard edges.
    //  3. Soft drop shadow for depth.
    //  4. Tight padding (boxborderw) so the plate hugs the text on both axes.
    //
    // boxborderw is supported by FFmpeg drawtext since 4.2 (Replit ships 5.x).
    // Using single-value boxborderw applies same padding to all 4 sides.
    if (brand) {
      // Brand: top of frame at 8% from top, white text on dark backplate.
      const brandY = `${Math.round(height * 0.08)}`;
      const brandAlpha = alphaExpr(brandStart, brandEnd, brandFadeIn, brandFadeOut);
      // Padding scales with font size so the plate always looks proportional.
      const brandBoxPad = Math.max(8, Math.round(brandFs * 0.35));
      layers.push(
        `drawtext=fontfile='${fontEsc}':textfile='${escFilterPath(brandFile)}'` +
        `:fontsize=${brandFs}:fontcolor=white` +
        `:box=1:boxcolor=black@0.55:boxborderw=${brandBoxPad}` +
        `:borderw=3:bordercolor=black@0.9` +
        `:shadowcolor=black@0.55:shadowx=0:shadowy=2` +
        `:x=${xCentered}:y=${brandY}` +
        `:enable='between(t\\,${brandStart}\\,${brandEnd})'` +
        `:alpha='${brandAlpha}'`,
      );
    }
    if (cta) {
      // CTA: lower third (~78% from top), bold gold text on dark backplate.
      // Higher box opacity than the brand because the CTA is the conversion
      // moment — it MUST be legible no matter what is happening in the frame.
      const ctaY = `${Math.round(height * 0.78)}`;
      const ctaAlpha = alphaExpr(ctaStart, ctaEnd, ctaFadeIn, ctaFadeOut);
      const ctaBoxPad = Math.max(10, Math.round(ctaFs * 0.4));
      layers.push(
        `drawtext=fontfile='${fontEsc}':textfile='${escFilterPath(ctaFile)}'` +
        `:fontsize=${ctaFs}:fontcolor=0xC8A84B` +
        `:box=1:boxcolor=black@0.65:boxborderw=${ctaBoxPad}` +
        `:borderw=4:bordercolor=black@0.95` +
        `:shadowcolor=black@0.6:shadowx=0:shadowy=3` +
        `:x=${xCentered}:y=${ctaY}` +
        `:enable='between(t\\,${ctaStart}\\,${ctaEnd})'` +
        `:alpha='${ctaAlpha}'`,
      );
    }

    if (layers.length === 0) return videoBuffer;

    const ffmpeg = (await import("fluent-ffmpeg")).default;
    ffmpeg.setFfmpegPath(await resolveFfmpegPath());

    const vf = layers.join(",");

    return await new Promise<Buffer>((resolve, reject) => {
      ffmpeg(inPath)
        .videoFilter(vf)
        .videoCodec("libx264")
        .audioCodec("copy")
        .outputOptions([
          "-preset medium",
          "-crf 18",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .on("end", async () => {
          try {
            const buf = await fs.readFile(outPath);
            resolve(buf);
          } catch (e) { reject(e); }
        })
        .on("error", (err: Error) => reject(new Error(`drawtext overlay error: ${err.message}`)))
        .save(outPath);
    });
  } finally {
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
        imgBuf = await fetchToBuffer(input.sourceImageUrl, 120_000, { ssrfGuard: true });
        imgMime = "image/jpeg";
      } else {
        const hero = await generateHeroImage(input, copy, projectReplicateToken);
        imgBuf = hero.buffer; imgMime = hero.mimeType;
        assets.heroImageProvider = hero.provider;
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
      let finalMp4 = await composeFinalAd(videoBuf, voiceBuf, sfxBuf);

      // STEP 6.5 (always-on by default): Burn deterministic brand + CTA overlay
      // with FFmpeg drawtext. This replaces the AI-rendered text that the video
      // model used to hallucinate (misspelled brand names, garbled captions).
      // FAIL-LOUD policy: when overlay is requested explicitly we refuse to
      // ship a video without legible brand/CTA — that's the entire point of
      // the deterministic typography layer. The AI was instructed NOT to
      // render text, so without the overlay the ad has no brand on screen.
      const wantBrandOverlay = input.renderBrandOverlay !== false;
      if (wantBrandOverlay) {
        onProgress?.({ stage: "overlay", variantIndex: i, message: `[${i + 1}/${copies.length}] Sobreimponiendo marca y CTA con tipografía nítida...` });
        const brandText = (input.brandOverlayText ?? input.brandName ?? input.productTitle ?? "").toString();
        const ctaText = (input.ctaOverlayText ?? copy.cta ?? "").toString();
        const before = finalMp4;
        // Throws on missing font or drawtext failure. We let it propagate
        // so the variant fails cleanly and the UI surfaces the real error
        // ("Brand overlay font not installed: ...") instead of silently
        // shipping an unbranded ad.
        finalMp4 = await applyBrandOverlay(finalMp4, {
          brandText,
          ctaText,
          aspect: input.aspect,
        });
        assets.overlayApplied = finalMp4 !== before;
        if (!assets.overlayApplied) {
          // Returned same buffer — both texts were empty after sanitization.
          // This is a configuration problem (no brand and no CTA). Fail loud
          // so the operator notices instead of shipping a naked video.
          throw new Error(
            "Brand overlay produced no change: both brandOverlayText and ctaOverlayText sanitized to empty. " +
            "Set input.brandOverlayText (or input.brandName) and/or input.ctaOverlayText.",
          );
        }
      }

      // STEP 7 (optional): Burn auto-subtitles via Whisper + FFmpeg subtitles filter
      const { getTemplate } = await import("./ad-templates.js");
      const tplRun = getTemplate(input.template);
      const wantSubs = input.burnSubs ?? tplRun?.burnSubsByDefault ?? false;
      if (wantSubs) {
        try {
          onProgress?.({ stage: "subtitles", variantIndex: i, message: `[${i + 1}/${copies.length}] Transcribiendo y quemando subtítulos...` });
          const { transcribeAudioToSrt, burnSubtitlesIntoVideo } = await import("./fusion-studio-pro.js");
          const { srt } = await transcribeAudioToSrt(voiceBuf, {
            language: input.subsLanguage ?? "auto",
            replicateToken: projectReplicateToken,
            audioMime: "audio/mpeg",
          });
          if (srt?.trim()) {
            finalMp4 = await burnSubtitlesIntoVideo(finalMp4, srt, {
              fontName: "Arial",
              fontSizePx: input.aspect === "9:16" ? 36 : 28,
              primaryColorHex: "FFFFFF",
              outlineColorHex: "000000",
              outlinePx: 3,
              alignment: 2,
              marginVPx: input.aspect === "9:16" ? 120 : 60,
            });
          }
        } catch (subErr: any) {
          // Non-fatal: subtitles are a nice-to-have. Log and continue with the
          // un-subtitled video — caller still receives a working ad.
          logger.warn({ err: subErr, variant: i }, "adstudio: burn-subs failed, continuing");
          errors.push(`Variant ${i + 1} subs: ${subErr?.message || "unknown"}`);
        }
      }

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
