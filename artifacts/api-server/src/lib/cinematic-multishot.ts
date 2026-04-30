import { logger } from "./logger.js";
import { askClaudeJson } from "./claude.js";
import {
  generateImage,
  generateVideoFromImage,
  generateTTS,
  generateMusic,
  composeAd,
  concatVideos,
  CAMERA_PRESETS,
  type VideoModel,
  type ImageGenModel,
} from "./fusion-studio-pro.js";

export type CinematicAspect = "9:16" | "16:9" | "1:1";

export type CinematicStyle =
  | "cinematic"
  | "ugc"
  | "editorial"
  | "luxury"
  | "tech"
  | "energetic";

export interface CinematicScene {
  idx: number;
  timeStartSec: number;
  timeEndSec: number;
  sceneDescription: string;
  cameraMovement: string;
  cameraPreset?: string;
  keyframePrompt: string;
  videoPrompt: string;
  voiceoverLine: string;
}

export interface CinematicScript {
  title: string;
  hook: string;
  cta: string;
  closingLine: string;
  scenes: CinematicScene[];
}

export interface CinematicMultiShotRequest {
  projectId: number;
  productImage: Buffer;
  productMime: string;
  brand: string;
  productName: string;
  niche?: string;
  audience?: string;
  language: string;
  scenesCount: number;
  totalDurationSec: number;
  aspect: CinematicAspect;
  videoModel: VideoModel;
  imageModel?: ImageGenModel;
  style: CinematicStyle;
  customBrief?: string;
  narration?: {
    enabled: boolean;
    voiceId?: string;
    voiceModel?: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5";
    voiceVolume?: number;
  };
  music?: {
    enabled: boolean;
    prompt?: string;
    volume?: number;
  };
}

export interface CinematicMultiShotResult {
  finalVideo: Buffer;
  finalMime: string;
  durationSec: number;
  script: CinematicScript;
  keyframes: Array<{ idx: number; buffer: Buffer; mime: string }>;
  clips: Array<{ idx: number; buffer: Buffer; mime: string; durationSec: number }>;
  voiceoverBuffer?: Buffer;
  musicBuffer?: Buffer;
}

const MIN_SCENES = 2;
const MAX_SCENES = 8;
const MIN_DURATION = 6;
const MAX_DURATION = 60;

const STYLE_DIRECTIVES: Record<CinematicStyle, string> = {
  cinematic: "Cinematic 35mm look, anamorphic lens flare, shallow depth of field, golden-hour or moody key light, slow motion accents, color grade with warm shadows and teal highlights.",
  ugc: "Authentic UGC handheld feel, natural daylight, casual real-life setting, slight handheld micro-motion, real person interacting with the product, social-media native vertical look.",
  editorial: "High-fashion editorial, controlled studio lighting, geometric composition, magazine-cover aesthetic, crisp shadows, premium minimalism.",
  luxury: "Luxury campaign aesthetic, slow camera moves, pristine surfaces, reflective materials, monochrome or jewel-tone palette, hero-product reveal energy.",
  tech: "Modern tech-product launch, neon rim lights, dark background with controlled highlights, futuristic confidence, smooth gimbal movements, sleek typography vibe.",
  energetic: "Fast cuts, vibrant colors, dynamic motion, pop-energy bursts, optimistic mood, bright high-contrast key, energetic camera moves.",
};

function ratioToWH(aspect: CinematicAspect): { width: number; height: number } {
  if (aspect === "16:9") return { width: 1920, height: 1080 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 };
}

function pickCameraPreset(style: CinematicStyle): string | undefined {
  const keys = Object.keys(CAMERA_PRESETS);
  if (!keys.length) return undefined;
  const map: Partial<Record<CinematicStyle, string>> = {
    cinematic: keys.find((k) => /cinema|dolly|slow|tracking/i.test(k)),
    ugc: keys.find((k) => /handheld|selfie|ugc|natural/i.test(k)),
    editorial: keys.find((k) => /static|studio|portrait/i.test(k)),
    luxury: keys.find((k) => /reveal|orbit|hero/i.test(k)),
    tech: keys.find((k) => /pan|orbit|reveal/i.test(k)),
    energetic: keys.find((k) => /push|whip|zoom/i.test(k)),
  };
  return map[style] ?? keys[0];
}

function clampScenesCount(n: number, totalSec: number): number {
  const v = Math.max(MIN_SCENES, Math.min(MAX_SCENES, Math.floor(n)));
  // Each scene needs at least ~3s of video; cap accordingly.
  const maxByDuration = Math.max(MIN_SCENES, Math.floor(totalSec / 3));
  return Math.min(v, maxByDuration);
}

function clampDuration(n: number): number {
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(n)));
}

function distributeSceneDurations(totalSec: number, scenes: number): number[] {
  // Each clip rounded to nearest 5s slot (Runway/Veo support 5/8/10s typical).
  // We use 5s clips by default; if total > 5*scenes we extend evenly.
  const baseClip = totalSec / scenes;
  const out: number[] = [];
  for (let i = 0; i < scenes; i++) {
    const target = Math.max(3, Math.min(10, Math.round(baseClip)));
    out.push(target);
  }
  return out;
}

/**
 * Ask Claude to write a cinematic multi-shot ad script in strict JSON.
 * Heavily inspired by Pollo Seedance 2.0 multi-shot prompts.
 */
async function generateCinematicScript(
  req: CinematicMultiShotRequest,
  scenesCount: number,
  sceneDurations: number[],
): Promise<CinematicScript> {
  const styleHint = STYLE_DIRECTIVES[req.style];
  const totalSec = req.totalDurationSec;
  const cumulativeStarts = sceneDurations.reduce<number[]>((acc, d) => {
    const last = acc.length ? acc[acc.length - 1] : 0;
    acc.push(last + d);
    return acc;
  }, []);

  const sceneTimings = sceneDurations.map((d, i) => {
    const start = i === 0 ? 0 : cumulativeStarts[i - 1];
    const end = cumulativeStarts[i];
    return `Escena ${i + 1}: ${start}s → ${end}s (duración ${d}s)`;
  }).join("\n");

  const sys = `Eres un director creativo experto en anuncios cinemáticos de producto al estilo Pollo.ai / Seedance 2.0. Escribes guiones multi-shot ultra-detallados con descripciones visuales que un modelo de imagen + vídeo IA puede ejecutar literalmente. Devuelves SIEMPRE JSON válido sin texto adicional.`;

  const prompt = `Genera el guion multi-shot para un anuncio de ${totalSec} segundos del producto "${req.productName}" de la marca "${req.brand}".

CONTEXTO:
- Nicho: ${req.niche || "ecommerce general"}
- Audiencia: ${req.audience || "consumidor digital"}
- Idioma del voiceover: ${req.language}
- Estilo visual: ${req.style.toUpperCase()} — ${styleHint}
- Aspecto: ${req.aspect}
- Brief adicional del usuario: ${req.customBrief || "—"}

ESTRUCTURA TEMPORAL (respeta exactamente):
${sceneTimings}

Devuelve este JSON exacto:
{
  "title": "Título del anuncio (máx 60 chars)",
  "hook": "Hook inicial impactante para los primeros 2s (en ${req.language})",
  "cta": "Call to action final (en ${req.language})",
  "closingLine": "Línea de cierre con la marca",
  "scenes": [
    {
      "idx": 1,
      "timeStartSec": 0,
      "timeEndSec": ${sceneDurations[0]},
      "sceneDescription": "Qué se ve en la escena (descripción narrativa de la acción/composición/ambiente)",
      "cameraMovement": "Movimiento de cámara concreto: dolly-in lento, orbit 360, push-in macro, whip-pan, etc.",
      "keyframePrompt": "Prompt PROFESIONAL para generar el FRAME inicial de esta escena con un modelo image. Debe describir: composición, iluminación, lente, paleta, integración del producto. ${styleHint} El producto debe estar siempre visible y consistente con la imagen de referencia.",
      "videoPrompt": "Prompt para animar el frame: describe el movimiento de cámara y el movimiento dentro de la escena en una frase fluida y cinematográfica (2-4 frases). NO repitas la composición — solo el movimiento.",
      "voiceoverLine": "Frase de voiceover en ${req.language} sincronizada con esta escena (máx ${Math.max(8, sceneDurations[0] * 3)} palabras)"
    }
    // ... una entrada por escena, exactamente ${scenesCount} escenas
  ]
}

REGLAS DURAS:
- Exactamente ${scenesCount} escenas
- timeStartSec/timeEndSec respetan EXACTAMENTE las duraciones indicadas arriba
- keyframePrompt y videoPrompt en INGLÉS (los modelos rinden mejor); voiceoverLine en ${req.language}
- Cada escena cuenta una micro-historia: presentación → demostración → emoción → CTA
- El producto siempre visible, integrado, foto-realista y reconocible
- NO inventes características que no veas en la imagen del producto
- Los voiceoverLine concatenados deben durar aproximadamente ${totalSec}s a 2.5 palabras/segundo
- Vocabulario directo, frases cortas, pensado para anuncio de social media
- NUNCA uses placeholders ni "lorem ipsum"`;

  const script = await askClaudeJson<CinematicScript>(req.projectId, prompt, sys, 4096, 120_000);

  // Defensive normalization
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("Claude no devolvió escenas en el guion");
  }
  // Trim to requested count and re-stamp timings using our computed durations
  script.scenes = script.scenes.slice(0, scenesCount).map((s, i) => {
    const start = i === 0 ? 0 : cumulativeStarts[i - 1];
    const end = cumulativeStarts[i];
    return {
      ...s,
      idx: i + 1,
      timeStartSec: start,
      timeEndSec: end,
      cameraPreset: pickCameraPreset(req.style),
    };
  });

  return script;
}

/**
 * Pollo.ai-style "Multi-Shot Made Easy": orchestrates Claude (script) →
 * generateImage (per-scene keyframes) → generateVideoFromImage (per-scene
 * clips) → concatVideos (with crossfade) → optional ElevenLabs voiceover and
 * music → composeAd (final mux).
 *
 * Returns the final MP4 buffer plus all intermediate assets so the caller can
 * persist them in the vault.
 */
export async function generateCinematicMultiShot(
  req: CinematicMultiShotRequest,
): Promise<CinematicMultiShotResult> {
  const totalSec = clampDuration(req.totalDurationSec);
  const scenesCount = clampScenesCount(req.scenesCount, totalSec);
  const sceneDurations = distributeSceneDurations(totalSec, scenesCount);
  const imageModel: ImageGenModel = req.imageModel || "nano-banana";
  const { width, height } = ratioToWH(req.aspect);
  const cameraPreset = pickCameraPreset(req.style);

  logger.info(
    {
      projectId: req.projectId,
      brand: req.brand,
      product: req.productName,
      scenesCount,
      totalSec,
      videoModel: req.videoModel,
      imageModel,
      aspect: req.aspect,
      style: req.style,
    },
    "🎬 CinematicMultiShot: starting orchestration",
  );

  // ── 1. Script via Claude ────────────────────────────────────────────────
  const script = await generateCinematicScript(req, scenesCount, sceneDurations);
  logger.info({ scenes: script.scenes.length, title: script.title }, "🎬 CinematicMultiShot: script ready");

  // ── 2. Per-scene keyframes (sequential to keep memory bounded) ──────────
  const keyframes: Array<{ idx: number; buffer: Buffer; mime: string }> = [];
  for (const scene of script.scenes) {
    const { buffer, mimeType } = await generateImage(imageModel, scene.keyframePrompt, {
      aspectRatio: req.aspect,
      referenceImage: req.productImage,
      referenceMime: req.productMime,
    });
    keyframes.push({ idx: scene.idx, buffer, mime: mimeType });
    logger.info({ sceneIdx: scene.idx, kfBytes: buffer.length }, "🎬 keyframe generated");
  }

  // ── 3. Per-scene videos (sequential — heavy operation) ──────────────────
  const clips: Array<{ idx: number; buffer: Buffer; mime: string; durationSec: number }> = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const dur = sceneDurations[i];
    const kf = keyframes[i];
    const buf = await generateVideoFromImage(req.videoModel, kf.buffer, kf.mime, scene.videoPrompt, {
      duration: dur,
      aspect: req.aspect,
      cameraPreset: scene.cameraPreset || cameraPreset,
    });
    clips.push({ idx: scene.idx, buffer: buf, mime: "video/mp4", durationSec: dur });
    logger.info({ sceneIdx: scene.idx, clipBytes: buf.length, dur }, "🎬 clip generated");
  }

  // ── 4. Concat with cinematic crossfade ──────────────────────────────────
  const concatenated = await concatVideos({
    videoBuffers: clips.map((c) => c.buffer),
    width,
    height,
    fps: 30,
    crossfadeSec: clips.length > 1 ? 0.4 : 0,
    transitionPreset: req.style === "energetic"
      ? "hard_cut"
      : req.style === "luxury"
        ? "fade_to_black"
        : req.style === "tech"
          ? "glitch_pixel"
          : "cross_dissolve",
    clipDurationsSec: clips.map((c) => c.durationSec),
  });
  logger.info({ concatBytes: concatenated.length }, "🎬 concat ready");

  // ── 5. Voiceover (optional) ─────────────────────────────────────────────
  let voiceoverBuffer: Buffer | undefined;
  if (req.narration?.enabled) {
    const fullScript = script.scenes.map((s) => s.voiceoverLine).join(" ");
    if (fullScript.trim().length > 0) {
      voiceoverBuffer = await generateTTS(fullScript, {
        voiceId: req.narration.voiceId || "21m00Tcm4TlvDq8ikWAM",
        modelId: req.narration.voiceModel || "eleven_multilingual_v2",
        languageCode: req.language.length === 2 ? req.language : undefined,
      });
      logger.info({ voiceBytes: voiceoverBuffer.length }, "🎬 voiceover ready");
    }
  }

  // ── 6. Music (optional) ─────────────────────────────────────────────────
  let musicBuffer: Buffer | undefined;
  if (req.music?.enabled) {
    const musicPrompt = req.music.prompt
      || `${req.style} background music for a ${req.productName} ad, no vocals, builds energy, fits ${totalSec} seconds`;
    try {
      musicBuffer = await generateMusic(musicPrompt, totalSec);
      logger.info({ musicBytes: musicBuffer.length }, "🎬 music ready");
    } catch (err) {
      logger.warn({ err }, "🎬 music generation failed, continuing without music");
    }
  }

  // ── 7. Final compose (mux) ──────────────────────────────────────────────
  let finalVideo = concatenated;
  if (voiceoverBuffer || musicBuffer) {
    finalVideo = await composeAd({
      videoBuffer: concatenated,
      voiceBuffer: voiceoverBuffer,
      musicBuffer: musicBuffer,
      voiceVolume: req.narration?.voiceVolume ?? 1.0,
      musicVolume: req.music?.volume ?? 0.22,
    });
    logger.info({ finalBytes: finalVideo.length }, "🎬 final compose ready");
  }

  return {
    finalVideo,
    finalMime: "video/mp4",
    durationSec: totalSec,
    script,
    keyframes,
    clips,
    voiceoverBuffer,
    musicBuffer,
  };
}
