/**
 * AdStudio Engine — anuncios publicitarios IA end-to-end
 *
 * Pipeline:
 *   1. Copy generation (Claude, ya existente vía learnFromOperation)
 *   2. Hero image (Nano Banana = gemini-3.1-flash-image)
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
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";
import { generateNanoBanana } from "./nano-banana.js";
import {
  resolveAdVideoProvider, effectiveDuration, generationAspect, replicateInput,
  centerCropFor, RUNWAY_RATIOS, type AdVideoProvider, type AdVideoProviderKey,
} from "./ad-video-providers.js";

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

// Coste y créditos por anuncio: ver ad-video-providers.ts (adCostUsd / adCredits).

// ─── TYPES ───────────────────────────────────────────────────────────────

/** Clave del registro verificado (se aceptan alias antiguos, ver resolveAdVideoProvider). */
export type VideoProvider = AdVideoProviderKey | (string & {});
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
  sourceImageUrl?: string;         // foto REAL del producto (catálogo o URL)
  /** Cómo se usa la foto real:
   *  - "scene" (por defecto): Nano Banana coloca el producto, sin alterarlo, en una escena publicitaria.
   *  - "photo": se usa la foto tal cual (encajada al formato con fondo desenfocado).
   *  Sin foto real, la imagen la inventa la IA (el anuncio lo marca como producto no real). */
  heroMode?: "scene" | "photo";
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
const OVERLAY_FONT_FILE = "Outfit-Bold.ttf"; // OFL 1.1, incluida en src/data/fonts (cubre á, ñ, ¡, ¿, €)

/** Fuente del overlay: la incluida en el build (dist/data/fonts), en dev src/data/fonts, o DejaVu del sistema. */
async function resolveOverlayFont(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.AD_OVERLAY_FONT,
    path.join(here, "data/fonts", OVERLAY_FONT_FILE),        // bundle: dist/index.mjs → dist/data
    path.join(here, "../data/fonts", OVERLAY_FONT_FILE),     // src/lib → src/data
    path.join(process.cwd(), "src/data/fonts", OVERLAY_FONT_FILE),
    path.join(process.cwd(), "dist/data/fonts", OVERLAY_FONT_FILE),
    DEJAVU_BOLD_PATH,
  ].filter((p): p is string => !!p);
  for (const c of candidates) {
    try { await fs.access(c); return c; } catch { /* siguiente */ }
  }
  throw new Error(`No hay fuente para el texto del anuncio (buscado: ${candidates.join(", ")}). ` +
    "Se rechaza publicar un anuncio sin marca ni CTA legibles.");
}

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
   *  when the real product photo was used as-is. */
  heroImageProvider?: "gemini" | "replicate";
  /** Origen de la imagen del producto: foto real tal cual, foto real en escena IA,
   *  o producto inventado por la IA (no usar para anunciar un producto real). */
  productSource?: "photo" | "scene" | "ai-generated";
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

/** Tipo real de imagen por sus primeros bytes (la cabecera HTTP no es fiable). */
export function sniffImageMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return "image/jpeg";
}

/** Proveedor del registro verificado o error claro (nunca se cambia en silencio). */
function providerOrThrow(key: string): AdVideoProvider {
  const p = resolveAdVideoProvider(key);
  if (!p) throw new Error(`Proveedor de vídeo no disponible: "${key}". Elige uno del catálogo actual.`);
  return p;
}

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

// ─── STEP 2: HERO IMAGE via Nano Banana ─────────────────────────────────────

const ASPECT_HINT: Record<AdAspect, string> = {
  "9:16": "vertical portrait (9:16 aspect)",
  "16:9": "cinematic wide (16:9 aspect)",
  "4:5": "portrait (4:5 aspect)",
  "1:1": "square (1:1 aspect)",
};

/**
 * Imagen inicial del anuncio.
 *  - Con foto real (`productPhoto`): el producto se coloca SIN alterarlo en una
 *    escena publicitaria (Nano Banana con la foto como referencia).
 *  - Sin foto: la IA inventa el producto a partir del título (se marca como tal).
 * `aspect` es el formato en el que el modelo de vídeo va a trabajar.
 */
export async function generateHeroImage(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  projectReplicateToken?: string,
  opts: { aspect?: AdAspect; productPhoto?: { buffer: Buffer; mimeType: string } } = {},
): Promise<{ buffer: Buffer; mimeType: string; provider: "gemini" | "replicate" }> {
  const { getTemplate } = await import("./ad-templates.js");
  const tpl = getTemplate(input.template);
  const aspect = opts.aspect ?? input.aspect;
  const styleLine = tpl ? `\nStyle (template "${tpl.label}"): ${tpl.heroStyle}` : "";

  const prompt = opts.productPhoto
    ? `Professional advertising photograph featuring the EXACT product shown in the reference image.

PRODUCT FIDELITY (mandatory): keep the product identical to the reference — same shape, proportions,
colors, materials, finish, print, label and logo placement. Do not redesign, recolor, add or remove parts.
Only the setting, lighting and camera change.

Scene: premium ${input.productCategory} commercial set that matches a "${copy.tone}" mood and brand tone
"${input.brandTone || "premium modern"}". Soft cinematic key light with rim light, realistic shadows and
reflections, shallow depth of field, clean composition with negative space. Photorealistic, magazine-grade.
Aspect: ${ASPECT_HINT[aspect]}.${styleLine}
No added text, no extra logos, no watermarks.`
    : `Ultra-premium product hero shot for advertising.

Product: ${input.productTitle}, ${input.productCategory}
Brand tone: ${input.brandTone || "premium modern"}
Campaign hook: "${copy.hook}"
Mood: ${copy.tone}
Aspect: ${ASPECT_HINT[aspect]}${styleLine}

Requirements:
- Professional commercial photography quality
- Soft cinematic lighting with rim light
- Clean composition, negative space for text overlay
- Photorealistic, magazine-grade
- Colors that match the brand (premium, saturated but tasteful)
- NO text, NO logos, NO watermarks in the image`;

  try {
    return await generateNanoBanana(prompt, {
      aspectRatio: aspect,
      replicateToken: projectReplicateToken,
      references: opts.productPhoto ? [opts.productPhoto] : undefined,
    });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "adstudio: Nano Banana hero image failed (all providers)");
    throw new Error(`Hero image generation failed: ${err.message}`);
  }
}

/** Encaja una foto en el formato con fondo de la propia foto desenfocado (sin deformar ni recortar el producto). */
export async function fitPhotoToAspect(photo: Buffer, aspect: AdAspect): Promise<Buffer> {
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  ffmpeg.setFfmpegPath(await resolveFfmpegPath());
  const [a, b] = aspect.split(":").map(Number);
  const H = 1920;
  const W = Math.round((H * a) / b / 2) * 2;
  const tmp = await makeTmpDir("fit");
  try {
    const inPath = path.join(tmp, "in.img");
    const outPath = path.join(tmp, "out.png");
    await fs.writeFile(inPath, photo);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .complexFilter([
          `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=40:2,eq=brightness=-0.08[bg]`,
          `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg]`,
          `[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`,
        ], ["out"])
        .outputOptions(["-frames:v 1"])
        .on("end", () => resolve())
        .on("error", (e: Error) => reject(new Error(`No se pudo encajar la foto al formato ${aspect}: ${e.message}`)))
        .save(outPath);
    });
    return await fs.readFile(outPath);
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── STEP 3: VIDEO (registro verificado: Runway / Kling / Hailuo) ──────────

async function generateVideoRunway(p: AdVideoProvider, input: AdCampaignInput, prompt: string, imageBuffer: Buffer, imageMime: string): Promise<Buffer> {
  const apiKey = getRunwayKey();
  const dataUri = `data:${imageMime};base64,${imageBuffer.toString("base64")}`;
  const createRes = await fetch(`${RUNWAY_BASE}/image_to_video`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model: p.modelId,
      promptImage: dataUri,
      promptText: prompt.slice(0, 1000),
      duration: effectiveDuration(p, input.videoDurationSec),
      ratio: RUNWAY_RATIOS[generationAspect(p, input.aspect)],
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Runway create failed: ${createRes.status} ${err.slice(0, 300)}`);
  }
  const { id: taskId } = await createRes.json() as { id: string };

  const deadline = Date.now() + 6 * 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 6_000));
    const statusRes = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!statusRes.ok) continue;
    const status = await statusRes.json() as { status: string; output?: string[]; failure?: string };
    if (status.status === "SUCCEEDED" && status.output?.[0]) return await fetchToBuffer(status.output[0]);
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`Runway task failed: ${status.failure || status.status}`);
    }
  }
  throw new Error("Runway timed out after 6 minutes");
}

async function generateVideoReplicate(p: AdVideoProvider, input: AdCampaignInput, prompt: string, imageBuffer: Buffer, imageMime: string, replicateToken: string): Promise<Buffer> {
  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: replicateToken });
  const params = replicateInput(p, {
    prompt,
    negativePrompt: VIDEO_NEGATIVE_PROMPT,
    imageDataUri: `data:${imageMime};base64,${imageBuffer.toString("base64")}`,
    requestedSec: input.videoDurationSec,
    aspect: input.aspect,
  });
  const output = await rep.run(p.modelId as `${string}/${string}`, { input: params });
  const raw = Array.isArray(output) ? output[0] : output;
  let videoUrl: string;
  if (typeof raw === "string") {
    videoUrl = raw;
  } else if (raw && typeof (raw as any).url === "function") {
    videoUrl = String((raw as any).url());
  } else if (raw && (raw as any).url) {
    videoUrl = String((raw as any).url);
  } else {
    throw new Error(`Replicate invalid output: ${String(raw).slice(0, 200)}`);
  }
  if (!videoUrl.startsWith("http")) throw new Error(`Replicate invalid URL: ${videoUrl.slice(0, 200)}`);
  return await fetchToBuffer(videoUrl);
}

export async function generateVideo(
  input: AdCampaignInput,
  copy: AdCopyVariant,
  imageBuffer: Buffer,
  imageMime: string,
  projectReplicateToken?: string,
): Promise<Buffer> {
  const p = providerOrThrow(input.videoProvider);
  const { getTemplate } = await import("./ad-templates.js");
  const { CAMERA_PRESETS } = await import("./fusion-studio-pro.js");
  const tpl = getTemplate(input.template);
  const camera = tpl ? CAMERA_PRESETS[tpl.cameraPreset] : null;
  // Prompt solo visual: nunca marca, producto ni CTA (el modelo los escribiría mal).
  const prompt = buildVisualVideoPrompt(input, copy, camera ? ` ${camera.promptPrefix}` : "");
  if (p.vendor === "runway") return await generateVideoRunway(p, input, prompt, imageBuffer, imageMime);
  if (!projectReplicateToken) throw new Error("REPLICATE_API_TOKEN requerido para este proveedor de vídeo");
  return await generateVideoReplicate(p, input, prompt, imageBuffer, imageMime, projectReplicateToken);
}

/** Recorta al centro el vídeo si el modelo no genera el formato pedido (p. ej. 4:5). */
export async function cropVideoToAspect(videoBuffer: Buffer, aspect: AdAspect): Promise<Buffer> {
  const tmp = await makeTmpDir("crop");
  try {
    const inPath = path.join(tmp, "in.mp4");
    const outPath = path.join(tmp, "out.mp4");
    await fs.writeFile(inPath, videoBuffer);
    const { width, height } = await probeVideoMeta(inPath);
    const c = centerCropFor(width, height, aspect);
    if (!c) return videoBuffer;
    const ffmpeg = (await import("fluent-ffmpeg")).default;
    ffmpeg.setFfmpegPath(await resolveFfmpegPath());
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .videoFilter(`crop=${c.w}:${c.h}:${c.x}:${c.y}`)
        .videoCodec("libx264")
        .outputOptions(["-preset medium", "-crf 18", "-pix_fmt yuv420p", "-an"])
        .on("end", () => resolve())
        .on("error", (e: Error) => reject(new Error(`Recorte a ${aspect} falló: ${e.message}`)))
        .save(outPath);
    });
    return await fs.readFile(outPath);
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
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
        // FIX 2026-10: loudnorm remuestrea a 192 kHz; con la música a 44,1 kHz el
        // sidechain se desincronizaba y la pista terminaba al acabar la voz
        // (el CTA final quedaba en silencio). Todo se lleva a 48 kHz estéreo.
        // Colchón musical a 0,6 sin normalizar amix: con música masterizada
        // (≈ -14 LUFS) queda ~15 dB bajo la voz al hablar y audible en el cierre.
        cmd.complexFilter([
          "[0:v]null[vpass]",
          "[1:a]loudnorm=I=-16:LRA=11:TP=-1.5,aresample=48000,aformat=channel_layouts=stereo,volume=1.4,asplit=2[voice1][voice2]",
          "[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.6[musicraw]",
          "[musicraw][voice2]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300:makeup=1[musicducked]",
          "[voice1][musicducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0:weights='1 1'[mixed]",
          "[mixed]loudnorm=I=-14:LRA=9:TP=-1.0,aresample=48000[aout]",
        ], ["vpass", "aout"]);
      } else {
        // Voice only — still apply loudness normalization to hit social-media targets.
        cmd.complexFilter([
          "[0:v]null[vpass]",
          "[1:a]loudnorm=I=-14:LRA=9:TP=-1.0,aresample=48000[aout]",
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

  // Sin fuente no se publica: el modelo tiene prohibido escribir texto, así que
  // sin este paso el anuncio saldría sin marca ni CTA.
  const fontPath = await resolveOverlayFont();

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
    // Anchura media de glifo ≈ 0,70 × tamaño (medido con DejaVu Bold; Outfit es más estrecha → margen extra)
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
    const fontEsc = escFilterPath(fontPath);

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

  // Foto real del producto (una sola descarga para todas las variantes).
  let productPhoto: { buffer: Buffer; mimeType: string } | null = null;
  if (input.sourceImageUrl) {
    const buf = await fetchToBuffer(input.sourceImageUrl, 120_000, { ssrfGuard: true });
    productPhoto = { buffer: buf, mimeType: sniffImageMime(buf) };
  }

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
      // STEP 2: imagen inicial. Con foto real del producto, el producto no se altera.
      const provider = providerOrThrow(input.videoProvider);
      const genAspect = generationAspect(provider, input.aspect);
      let imgBuf: Buffer; let imgMime: string;
      if (productPhoto && input.heroMode === "photo") {
        onProgress?.({ stage: "image", variantIndex: i, message: `[${i + 1}/${copies.length}] Preparando la foto real del producto (${genAspect})...` });
        imgBuf = await fitPhotoToAspect(productPhoto.buffer, genAspect);
        imgMime = "image/png";
        assets.productSource = "photo";
      } else {
        onProgress?.({ stage: "image", variantIndex: i, message: productPhoto
          ? `[${i + 1}/${copies.length}] Colocando tu producto real en una escena publicitaria (Nano Banana)...`
          : `[${i + 1}/${copies.length}] Generando imagen del producto con IA (no hay foto real)...` });
        const hero = await generateHeroImage(input, copy, projectReplicateToken, { aspect: genAspect, productPhoto: productPhoto ?? undefined });
        imgBuf = hero.buffer; imgMime = hero.mimeType;
        assets.heroImageProvider = hero.provider;
        assets.productSource = productPhoto ? "scene" : "ai-generated";
      }

      // STEP 3: Video
      onProgress?.({ stage: "video", variantIndex: i, message: `[${i + 1}/${copies.length}] Generando vídeo con ${provider.label} (${effectiveDuration(provider, input.videoDurationSec)} s, 1-4 min)...` });
      let videoBuf = await generateVideo(input, copy, imgBuf, imgMime, projectReplicateToken);
      if (genAspect !== input.aspect) {
        onProgress?.({ stage: "video", variantIndex: i, message: `[${i + 1}/${copies.length}] Ajustando a formato ${input.aspect}...` });
        videoBuf = await cropVideoToAspect(videoBuf, input.aspect);
      }

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
