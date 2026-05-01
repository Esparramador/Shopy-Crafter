import crypto from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, omnicorePromptLibraryTable, projectsTable, projectFilesTable } from "@workspace/db";
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
  /** Id of the omnicore_prompt_library row that stores this script (auto-saved). */
  savedPromptId?: string;
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
 * Builds a short paragraph of "project context" extracted from the DB so Claude
 * tailors the script to what THIS project is actually about (real brand voice,
 * past assets, niche profile). 100% real data — never hardcoded.
 */
async function buildProjectContextSnippet(projectId: number): Promise<string> {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) return "";
    const lines: string[] = [];
    if (project.brandTone) lines.push(`Brand tone: ${String(project.brandTone).slice(0, 320)}`);
    if (project.name) lines.push(`Project: ${project.name}`);
    if (project.shopDomain) lines.push(`Store: ${project.shopDomain}`);
    if (project.storeNiche) lines.push(`Niche: ${project.storeNiche}`);
    if (project.targetAudience) lines.push(`Audience: ${project.targetAudience}`);
    if (project.storeMarkets) lines.push(`Markets: ${project.storeMarkets}`);

    // Sample of recent vault image titles (helps Claude understand product world)
    const recent = await db.select({ title: projectFilesTable.title, category: projectFilesTable.category })
      .from(projectFilesTable)
      .where(and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.fileType, "image")))
      .orderBy(desc(projectFilesTable.createdAt))
      .limit(8);
    if (recent.length) {
      lines.push("Recent vault assets: " + recent.map((r) => `${r.category || "?"}/${r.title}`.slice(0, 80)).join(" | "));
    }
    return lines.join("\n");
  } catch (err: any) {
    logger.warn({ err: err?.message, projectId }, "buildProjectContextSnippet failed (non-fatal)");
    return "";
  }
}

/**
 * Persist the generated script to omnicore_prompt_library so it can be
 * reloaded, edited, or used as starting point for next renders.
 * Returns the row id.
 */
export async function persistCinematicScript(args: {
  script: CinematicScript;
  config: Pick<CinematicMultiShotRequest, "projectId" | "brand" | "productName" | "niche" | "audience" | "language" | "scenesCount" | "totalDurationSec" | "aspect" | "videoModel" | "imageModel" | "style" | "customBrief" | "narration" | "music">;
  source: "draft" | "rendered" | "edited";
}): Promise<string> {
  const id = `cmsh-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const safeBrand = (args.config.brand || "brand").trim();
  const safeProduct = (args.config.productName || "product").trim();
  const date = new Date().toISOString().slice(0, 10);
  const name = `${safeBrand} · ${safeProduct} · ${args.config.style} (${date})`;

  const variables = JSON.stringify({
    projectId: args.config.projectId,
    brand: safeBrand,
    productName: safeProduct,
    niche: args.config.niche || null,
    audience: args.config.audience || null,
    language: args.config.language,
    scenesCount: args.config.scenesCount,
    totalDurationSec: args.config.totalDurationSec,
    aspect: args.config.aspect,
    videoModel: args.config.videoModel,
    imageModel: args.config.imageModel || null,
    style: args.config.style,
    customBrief: args.config.customBrief || null,
    narration: args.config.narration || null,
    music: args.config.music || null,
    source: args.source,
  });

  await db.insert(omnicorePromptLibraryTable).values({
    id,
    name,
    description: `Cinematic multi-shot ${args.script.scenes.length} escenas / ${args.config.totalDurationSec}s · ${args.script.title}`,
    niche: args.config.niche || null,
    useCase: "cinematic_multishot",
    promptTemplate: JSON.stringify(args.script),
    variables,
    avgQualityScore: args.source === "rendered" ? 1.0 : 0.5,
    useCount: args.source === "rendered" ? 1 : 0,
    createdBy: `project:${args.config.projectId}`,
    isPublic: 1,
  });
  return id;
}

export async function loadCinematicScript(id: string): Promise<{ script: CinematicScript; config: any } | null> {
  const [row] = await db.select().from(omnicorePromptLibraryTable)
    .where(and(eq(omnicorePromptLibraryTable.id, id), eq(omnicorePromptLibraryTable.useCase, "cinematic_multishot")))
    .limit(1);
  if (!row) return null;
  try {
    return {
      script: JSON.parse(row.promptTemplate) as CinematicScript,
      config: row.variables ? JSON.parse(row.variables) : {},
    };
  } catch { return null; }
}

export async function listCinematicScripts(filters: { projectId?: number; niche?: string | null; limit?: number }) {
  const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
  const projFilter = filters.projectId ? eq(omnicorePromptLibraryTable.createdBy, `project:${filters.projectId}`) : undefined;
  const nicheFilter = filters.niche ? eq(omnicorePromptLibraryTable.niche, filters.niche) : undefined;
  const where = and(
    eq(omnicorePromptLibraryTable.useCase, "cinematic_multishot"),
    ...(projFilter ? [projFilter] : []),
    ...(nicheFilter ? [nicheFilter] : []),
  );
  return db.select({
    id: omnicorePromptLibraryTable.id,
    name: omnicorePromptLibraryTable.name,
    description: omnicorePromptLibraryTable.description,
    niche: omnicorePromptLibraryTable.niche,
    avgQualityScore: omnicorePromptLibraryTable.avgQualityScore,
    useCount: omnicorePromptLibraryTable.useCount,
    isPublic: omnicorePromptLibraryTable.isPublic,
    variables: omnicorePromptLibraryTable.variables,
    createdAt: omnicorePromptLibraryTable.createdAt,
  })
    .from(omnicorePromptLibraryTable)
    .where(where)
    .orderBy(desc(omnicorePromptLibraryTable.useCount), desc(omnicorePromptLibraryTable.createdAt))
    .limit(limit);
}

export async function deleteCinematicScript(id: string): Promise<boolean> {
  const r = await db.delete(omnicorePromptLibraryTable)
    .where(and(eq(omnicorePromptLibraryTable.id, id), eq(omnicorePromptLibraryTable.useCase, "cinematic_multishot")));
  return (r.rowCount ?? 0) > 0;
}

export async function toggleCinematicScriptFavorite(id: string): Promise<{ isPublic: number } | null> {
  const [row] = await db.select({ isPublic: omnicorePromptLibraryTable.isPublic })
    .from(omnicorePromptLibraryTable)
    .where(and(eq(omnicorePromptLibraryTable.id, id), eq(omnicorePromptLibraryTable.useCase, "cinematic_multishot")))
    .limit(1);
  if (!row) return null;
  const next = (row.isPublic ?? 1) === 1 ? 0 : 1;
  await db.update(omnicorePromptLibraryTable)
    .set({ isPublic: next })
    .where(eq(omnicorePromptLibraryTable.id, id));
  return { isPublic: next };
}

export async function bumpCinematicScriptUsage(id: string): Promise<void> {
  await db.update(omnicorePromptLibraryTable)
    .set({ useCount: sql`COALESCE(${omnicorePromptLibraryTable.useCount}, 0) + 1` })
    .where(eq(omnicorePromptLibraryTable.id, id));
}

/**
 * Update an existing cinematic script in the library. Used by the UI when the
 * user edits inline and presses "Guardar plantilla" — we MUST persist the
 * exact edited JSON, not regenerate via Claude.
 */
export async function updateCinematicScript(id: string, args: {
  script?: CinematicScript;
  name?: string;
  description?: string;
}): Promise<boolean> {
  const patch: Record<string, any> = {};
  if (args.script !== undefined) patch.promptTemplate = JSON.stringify(args.script);
  if (args.name !== undefined) patch.name = args.name.slice(0, 200);
  if (args.description !== undefined) patch.description = args.description.slice(0, 500);
  if (Object.keys(patch).length === 0) return false;
  const r = await db.update(omnicorePromptLibraryTable)
    .set(patch)
    .where(and(eq(omnicorePromptLibraryTable.id, id), eq(omnicorePromptLibraryTable.useCase, "cinematic_multishot")));
  return (r.rowCount ?? 0) > 0;
}

/**
 * Re-stamps timings on an externally-supplied script using our computed
 * durations. Tolerant to extra/missing scenes (clamps to durations.length).
 */
function normalizeScriptTimings(script: CinematicScript, sceneDurations: number[], style: CinematicStyle): CinematicScript {
  const cumulativeStarts = sceneDurations.reduce<number[]>((acc, d) => {
    const last = acc.length ? acc[acc.length - 1] : 0;
    acc.push(last + d);
    return acc;
  }, []);
  const scenes = script.scenes.slice(0, sceneDurations.length).map((s, i) => {
    const start = i === 0 ? 0 : cumulativeStarts[i - 1];
    const end = cumulativeStarts[i];
    return {
      ...s,
      idx: i + 1,
      timeStartSec: start,
      timeEndSec: end,
      cameraPreset: s.cameraPreset || pickCameraPreset(style),
    };
  });
  // Defensive validation: every scene must have non-empty keyframe + video prompts.
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (!sc.keyframePrompt || String(sc.keyframePrompt).trim().length < 12) {
      throw new Error(`Escena ${i + 1}: keyframePrompt vacío o demasiado corto (mín 12 chars).`);
    }
    if (!sc.videoPrompt || String(sc.videoPrompt).trim().length < 12) {
      throw new Error(`Escena ${i + 1}: videoPrompt vacío o demasiado corto (mín 12 chars).`);
    }
  }
  // If the supplied script had fewer scenes than requested, just use what
  // we have (avoid undefined gaps).
  return { ...script, scenes };
}

/**
 * Ask Claude to write a cinematic multi-shot ad script in strict JSON.
 * Heavily inspired by Pollo Seedance 2.0 multi-shot prompts.
 */
export type CinematicScriptRequest = Omit<CinematicMultiShotRequest, "productImage" | "productMime"> & {
  productImage?: Buffer;
  productMime?: string;
};

export async function generateCinematicScript(
  req: CinematicScriptRequest,
  scenesCount?: number,
  sceneDurations?: number[],
): Promise<CinematicScript> {
  const totalSec = clampDuration(req.totalDurationSec);
  const _scenesCount = scenesCount ?? clampScenesCount(req.scenesCount, totalSec);
  const _sceneDurations = sceneDurations ?? distributeSceneDurations(totalSec, _scenesCount);
  const styleHint = STYLE_DIRECTIVES[req.style];
  const cumulativeStarts = _sceneDurations.reduce<number[]>((acc, d) => {
    const last = acc.length ? acc[acc.length - 1] : 0;
    acc.push(last + d);
    return acc;
  }, []);

  const sceneTimings = _sceneDurations.map((d, i) => {
    const start = i === 0 ? 0 : cumulativeStarts[i - 1];
    const end = cumulativeStarts[i];
    return `Escena ${i + 1}: ${start}s → ${end}s (duración ${d}s)`;
  }).join("\n");

  // ── Real project context (brand voice, niche, recent vault assets) ─────
  const projectCtx = await buildProjectContextSnippet(req.projectId);

  const sys = `Eres un director creativo y copywriter senior especializado en anuncios cinemáticos multi-shot tipo Pollo.ai / Seedance 2.0 / Runway Gen-3. Tu trabajo: escribir guiones donde cada escena ya viene "lista para producción" — un modelo image + un modelo video pueden ejecutar tus prompts LITERALMENTE sin reinterpretar nada. Devuelves SIEMPRE JSON válido sin texto fuera del JSON.`;

  const prompt = `Genera el guion multi-shot para un anuncio de ${totalSec} segundos del producto "${req.productName}" de la marca "${req.brand}".

${projectCtx ? `CONTEXTO REAL DEL PROYECTO (úsalo para alinear tono, paleta y referencias):\n${projectCtx}\n\n` : ""}BRIEF:
- Nicho: ${req.niche || "ecommerce general"}
- Audiencia objetivo: ${req.audience || "consumidor digital ${req.language}-hablante"}
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
      "timeEndSec": ${_sceneDurations[0]},
      "sceneDescription": "Qué se ve en la escena (descripción narrativa de la acción/composición/ambiente)",
      "cameraMovement": "Movimiento de cámara concreto: dolly-in lento, orbit 360, push-in macro, whip-pan, etc.",
      "keyframePrompt": "Prompt PROFESIONAL en INGLÉS para generar el FRAME inicial de esta escena con un modelo image (>=80 palabras). Debe describir, en este orden: subject → composition → camera framing & lens (e.g. 35mm, 85mm, macro) → lighting setup (key/fill/rim, color temp) → color palette (3 colores hex aproximados) → mood & texture → integración del producto (siempre visible, foto-realista, consistente con la imagen de referencia). Termina con descriptores técnicos (e.g. 'shot on RED, 8k, photorealistic, ultra detailed'). ${styleHint}",
      "videoPrompt": "Prompt en INGLÉS para animar el frame con un modelo video (40-80 palabras). Estructura: 1) movimiento de cámara con velocidad y easing (e.g. 'slow dolly-in over 4 seconds, ease-out'); 2) movimiento DENTRO del plano (subject motion, particles, light shifts); 3) atmósfera (humo, polvo, reflejos). NO redescribas la composición — confía en el keyframe.",
      "voiceoverLine": "Frase de voiceover en ${req.language} sincronizada con esta escena (máx ${Math.max(8, _sceneDurations[0] * 3)} palabras), tono coherente con el brand voice si se ha indicado."
    }
    // ... una entrada por escena, exactamente ${_scenesCount} escenas
  ]
}

REGLAS DURAS:
- Exactamente ${_scenesCount} escenas
- timeStartSec/timeEndSec respetan EXACTAMENTE las duraciones indicadas arriba
- keyframePrompt y videoPrompt en INGLÉS profesional (los modelos rinden mejor); voiceoverLine en ${req.language}
- Cada escena cuenta una micro-historia: hook → demostración → beneficio emocional → CTA
- El producto siempre visible, integrado, foto-realista y reconocible respecto a la imagen de referencia
- NO inventes características físicas que no veas en la imagen del producto
- Los voiceoverLine concatenados deben durar aproximadamente ${totalSec}s a 2.5 palabras/segundo
- Vocabulario directo, frases cortas, pensado para anuncio de social media
- NUNCA uses placeholders ni "lorem ipsum"`;

  const script = await askClaudeJson<CinematicScript>(req.projectId, prompt, sys, 4096, 120_000);

  // Defensive normalization
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("Claude no devolvió escenas en el guion");
  }
  // Trim to requested count and re-stamp timings using our computed durations
  script.scenes = script.scenes.slice(0, _scenesCount).map((s, i) => {
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
  req: CinematicMultiShotRequest & {
    /**
     * Optional pre-generated script. Skips Claude generation and uses this
     * (typically edited by the user). Timings are re-stamped from durations.
     */
    presetScript?: CinematicScript;
    /**
     * Optional saved-template id (omnicore_prompt_library row). Loaded if
     * presetScript is not provided. After successful render, useCount of this
     * template is bumped so popular ones surface first.
     */
    savedPromptId?: string;
  },
): Promise<CinematicMultiShotResult & { savedPromptId: string }> {
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
      reusingScript: Boolean(req.presetScript || req.savedPromptId),
    },
    "🎬 CinematicMultiShot: starting orchestration",
  );

  // ── 1. Script: pre-generated, loaded from library, or via Claude ─────────
  let script: CinematicScript;
  let loadedFromTemplate: string | null = null;
  if (req.presetScript && Array.isArray(req.presetScript.scenes) && req.presetScript.scenes.length > 0) {
    script = normalizeScriptTimings(req.presetScript, sceneDurations, req.style);
  } else if (req.savedPromptId) {
    const loaded = await loadCinematicScript(req.savedPromptId);
    if (!loaded) throw new Error(`Plantilla cinematic no encontrada: ${req.savedPromptId}`);
    loadedFromTemplate = req.savedPromptId;
    script = normalizeScriptTimings(loaded.script, sceneDurations, req.style);
  } else {
    script = await generateCinematicScript(req, scenesCount, sceneDurations);
  }
  logger.info({ scenes: script.scenes.length, title: script.title, loadedFromTemplate }, "🎬 CinematicMultiShot: script ready");

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

  // ── 8. Persist final script to library (or bump existing) ───────────────
  // Contract:
  //  - If savedPromptId is provided (with or without presetScript): we treat it
  //    as "this is a render of template X". We UPDATE the row with the final
  //    rendered script (preserving user edits) AND bump useCount.
  //  - If only presetScript (no savedPromptId): create a new "edited" row.
  //  - If neither: create a new "rendered" row.
  let savedPromptId: string;
  const targetTemplateId = req.savedPromptId || loadedFromTemplate || null;
  if (targetTemplateId) {
    savedPromptId = targetTemplateId;
    try {
      // Update the row with the final rendered script (overwrites prior content
      // if user edited it) so the template stays in sync with what was rendered.
      await updateCinematicScript(targetTemplateId, { script });
      await bumpCinematicScriptUsage(targetTemplateId);
      logger.info({ targetTemplateId }, "🎬 template updated + usage bumped");
    } catch (err: any) {
      logger.warn({ err: err?.message, targetTemplateId }, "🎬 template update/bump failed (non-fatal)");
    }
  } else {
    try {
      savedPromptId = await persistCinematicScript({
        script,
        config: req,
        source: req.presetScript ? "edited" : "rendered",
      });
      logger.info({ savedPromptId }, "🎬 script persisted in prompt library");
    } catch (err: any) {
      logger.warn({ err: err?.message }, "🎬 persist script failed (non-fatal)");
      savedPromptId = "";
    }
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
    savedPromptId,
  };
}
