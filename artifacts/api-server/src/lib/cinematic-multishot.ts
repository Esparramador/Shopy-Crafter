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
  generateMusicLong,
  composeAd,
  concatVideos,
  sanitizeVideoPrompt,
  extractLastFrame,
  applyPerSceneLipSync,
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
  /**
   * Type of shot. "presenter" → host face on camera, requires character lock.
   * "b_roll" / "product" → product-only shot, character lock should be DISABLED
   * for that scene so the product can be the only subject.
   * Default (undefined) preserves legacy behavior (apply character globally).
   */
  shotType?: "presenter" | "b_roll" | "product";
  /**
   * Per-scene override for character lock injection. When false, both the
   * identity prefix and the character image reference are skipped for this
   * scene only. When undefined, falls back to global behavior (character is
   * applied if req.character is provided).
   */
  useCharacter?: boolean;
}

export interface CinematicScript {
  title: string;
  hook: string;
  cta: string;
  closingLine: string;
  scenes: CinematicScene[];
  /** OPTIONAL: when set, applied to every per-scene image generation. */
  negativePrompt?: string;
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
    voiceModel?: "eleven_v3" | "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5";
    voiceVolume?: number;
  };
  /**
   * INTELLIGENT PER-SCENE LIP-SYNC (UGC contract):
   *  - Scenes tagged shotType='presenter' → Replicate lip-sync applied (mouth
   *    moves with the speaker's words for that scene's slot).
   *  - Scenes tagged 'b_roll'/'product'  → clip kept as-is (the SAME continuous
   *    voiceover plays over them as voice-over of the same speaker).
   *  Default: ON when narration is enabled AND at least one scene is a presenter.
   *  Set to false to disable explicitly (e.g. ad with no humans at all).
   */
  intelligentLipSync?: boolean;
  music?: {
    enabled: boolean;
    prompt?: string;
    volume?: number;
  };
  /** OPTIONAL Character Lock: ensures the same person appears across every scene. */
  character?: {
    name: string;
    image: Buffer;
    mime: string;
    /** Identity-lock prompt block (built via buildIdentityLockPrompt). */
    identityPrompt: string;
  };
  /**
   * LONG-FORM mode: when true, uses the cinematic-director (narrative arc +
   * Product DNA + composition modes) instead of the simple per-scene script
   * generator. Recommended for any totalDurationSec > 60.
   */
  longForm?: boolean;
  /**
   * Composition mode (only effective when longForm=true):
   *  - "narrative":         free cinematic camera/scene shifts (default)
   *  - "explainer-locked":  host fixed center-frame, only background changes
   *  - "composite-pro":     two layers (host + bg) for FFmpeg chroma-key compose
   */
  compositionMode?: "narrative" | "explainer-locked" | "composite-pro" | "locked-shot";
  /** Optional CTA text injected into the director prompt. */
  ctaText?: string;
  /**
   * Optional pre-built ProductDNA. If not provided AND longForm=true, the
   * director will build one on-the-fly from req.productImage + req.productName.
   */
  productDNA?: import("./product-dna.js").ProductDNA;
  /** Audience description (forwarded to director). */
  audienceText?: string;
  /** Extra product reference images (additional angles for richer DNA). */
  extraProductImages?: Array<{ buffer: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" }>;
  /** Plain-text product description (used by product-dna and director). */
  productDescription?: string;
  /**
   * DETERMINISTIC BRAND OVERLAY — burned into the final video AFTER the AI
   * pipeline finishes. AI video models (Kling, Runway, Veo, Hailuo, Seedance)
   * cannot render readable text or accurate logos; this overlay fixes that
   * by burning brand text + logo + social handles + URL with FFmpeg drawtext
   * + overlay (DejaVu Sans Bold, byte-perfect spelling, crisp typography).
   *
   * Pass either `brandOverlay` (full BrandOverlayConfig — pixel control) OR
   * `brandKit` (we auto-build a sensible 3-segment overlay: intro brand
   * reveal + persistent footer with handles/URL + outro CTA + logo).
   */
  brandOverlay?: import("./brand-overlay.js").BrandOverlayConfig;
  brandKit?: {
    brandName?: string;
    tagline?: string;
    socialHandles?: Array<{ platform: string; handle: string }>;
    url?: string;
    /** Logo PNG/JPG/WEBP buffer + mime. Composited as RGBA via Sharp. */
    logo?: { buffer: Buffer; mimeType?: string };
    /** Hex accent color for the CTA layer. */
    accentHex?: string;
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

// LONG-FORM AD CAPS (raised for trailers / explainers / company speeches up to 20 min).
// Provider clips remain 5-10s; the engine concatenates dozens of them.
const MIN_SCENES = 2;
const MAX_SCENES = 240;       // 240 * 5s = 1200s = 20 min upper safety net
const MIN_DURATION = 6;
const MAX_DURATION = 1800;    // 30 min ceiling (admin only realistically uses 5-10 min)

/**
 * Run an array of async tasks with bounded concurrency.
 * Preserves return order via task index. Throws on first unrecovered error
 * (after retry budget is exhausted upstream).
 */
async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Retry an async operation N times with exponential backoff. Provider APIs
 * (Kling, Runway, Veo, Replicate) occasionally return transient 5xx or
 * timeouts — one or two retries dramatically improve the success rate of
 * long-form jobs that need 30-60 clips to all succeed.
 */
async function retry<T>(fn: () => Promise<T>, attempts: number, label: string): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isLast = i === attempts;
      logger.warn({ err: err?.message, attempt: i + 1, of: attempts + 1, label }, isLast ? "🎬 retry exhausted" : "🎬 retry");
      if (isLast) break;
      await new Promise((r) => setTimeout(r, 2_000 * Math.pow(2, i))); // 2s, 4s, 8s...
    }
  }
  throw lastErr;
}

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
  let v = Math.max(MIN_SCENES, Math.min(MAX_SCENES, Math.floor(n)));
  // Each scene is capped at 10s by provider; ensure we have ENOUGH scenes to
  // actually reach totalSec (otherwise a long-form 1800s ad with 5 scenes
  // would render as ~50s). Floor at ceil(totalSec/10).
  const minByDuration = Math.max(MIN_SCENES, Math.ceil(totalSec / 10));
  if (v < minByDuration) v = Math.min(MAX_SCENES, minByDuration);
  // Each scene needs at least ~3s of video; cap accordingly.
  const maxByDuration = Math.max(MIN_SCENES, Math.floor(totalSec / 3));
  return Math.min(v, maxByDuration);
}

function clampDuration(n: number): number {
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(n)));
}

function distributeSceneDurations(totalSec: number, scenes: number): number[] {
  // Each clip is 3-10s (provider physical limit). We greedily fill totalSec
  // distributing the remaining seconds across clips so the SUM equals totalSec
  // (within rounding). For long-form (totalSec > 60), this ensures we hit the
  // requested total instead of shipping under-length videos.
  const out: number[] = new Array(scenes).fill(5);
  let remaining = totalSec;
  // First pass: give every scene 5s baseline
  remaining -= 5 * scenes;
  // Second pass: bump scenes to 10s as long as we have surplus
  for (let i = 0; i < scenes && remaining > 0; i++) {
    const bump = Math.min(5, remaining);
    out[i] += bump;
    remaining -= bump;
  }
  // If totalSec was tiny (< 5*scenes), shrink each clip down to 3s minimum
  if (remaining < 0) {
    for (let i = 0; i < scenes && remaining < 0; i++) {
      const shrink = Math.min(2, -remaining); // can go down to 3s
      out[i] -= shrink;
      remaining += shrink;
    }
  }
  return out.map((d) => Math.max(3, Math.min(10, d)));
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

  let narrativeFlowHint = "";
  try {
    const { getNarrativeFlowSummary } = await import("./advertising-playbook-kb.js");
    narrativeFlowHint = `\n\nFLUJO NARRATIVO IDEAL PARA VÍDEOS DE PRODUCTO (úsalo como guía para la estructura de escenas cuando el número de escenas lo permita):\n${getNarrativeFlowSummary()}\nAdapta este flujo al número de escenas solicitado — si hay menos de 7 escenas, combina o prioriza los pasos más impactantes (hook, exploded/deconstruction, try-on, CTA).`;
  } catch { /* not critical */ }

  const sys = `Eres un director creativo y copywriter senior especializado en anuncios cinemáticos multi-shot (Seedance Pro / Kling v2.1 / Runway Gen-4 / Veo 3). Tu trabajo: escribir guiones donde cada escena ya viene "lista para producción" — un modelo image + un modelo video pueden ejecutar tus prompts LITERALMENTE sin reinterpretar nada. Devuelves SIEMPRE JSON válido sin texto fuera del JSON.${narrativeFlowHint}`;

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
      "keyframePrompt": "Prompt PROFESIONAL en INGLÉS para generar el FRAME inicial de esta escena con un modelo image (>=80 palabras). Debe describir, en este orden: subject → composition → camera framing & lens (e.g. 35mm, 85mm, macro) → lighting setup (key/fill/rim, color temp) → color palette (3 colores hex aproximados) → mood & texture → integración del producto (siempre visible, foto-realista, consistente con la imagen de referencia). Termina con descriptores técnicos (e.g. 'shot on RED, 8k, photorealistic, ultra detailed'). REGLA SOBRE TEXTO: NO inventes texto/letras/números/logos NUEVOS que no existan en la imagen de referencia del producto. Las etiquetas, marcas, dial markings o cualquier texto físicamente impreso en el producto DEBEN preservarse EXACTAMENTE como aparecen en la referencia — refiérete a ellos por su forma, posición y material ('engraved logo plate at center of dial', 'embroidered woven label at inner collar'), NUNCA transcribas el texto literal. Termina SIEMPRE con: 'preserve all existing printed text, logos and brand markings on the product exactly as in the reference image; do NOT add any new text, captions, watermarks, subtitles or typography to the scene; do NOT distort or alter any letter or symbol that is part of the product's physical design'. ${styleHint}",
      "videoPrompt": "Prompt en INGLÉS para animar el frame con un modelo video (40-80 palabras). Estructura: 1) movimiento de cámara con velocidad y easing (e.g. 'slow dolly-in over 4 seconds, ease-out'); 2) movimiento DENTRO del plano (subject motion, particles, light shifts); 3) atmósfera (humo, polvo, reflejos). NO redescribas la composición — confía en el keyframe. REGLA SOBRE TEXTO: no inventes texto NUEVO; el texto/logo/etiquetas existentes en el producto deben permanecer perfectamente legibles e idénticos al keyframe durante toda la animación. Termina SIEMPRE con: 'preserve every existing letter, logo and brand marking on the product exactly as in the source frame, no warping, no morphing of letters; do NOT add any new text, captions or typography; strict design fidelity, the product never deconstructs morphs or recolors mid-frame'.",
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
- AUDIO BUDGET: los voiceoverLine concatenados, leídos en orden, deben durar EXACTAMENTE ${Math.max(2, totalSec - 2)}s a 2.5 palabras/segundo (= máximo ${Math.floor(Math.max(2, totalSec - 2) * 2.5)} palabras totales). NUNCA superes este límite — si te sobra espacio, déjalo: el último segundo del vídeo va EN SILENCIO para que la voz no se corte.
- Vocabulario directo, frases cortas, pensado para anuncio de social media
- NUNCA uses placeholders ni "lorem ipsum"
- ANTI-TEXTO ESTRICTO: NUNCA incluyas en keyframePrompt ni videoPrompt los nombres de marca,
  los nombres del producto, el CTA, precios, ni palabras que el modelo pueda intentar pintar
  como texto en la imagen. Los modelos de imagen y vídeo pintan texto deformado. La marca y el
  CTA se sobreimprimen DETERMINISTAMENTE después con FFmpeg drawtext. Tu trabajo aquí es
  describir la escena VISUALMENTE, sin un solo carácter alfanumérico que el modelo pueda usar.
- TRANSICIONES: la escena n+1 debe heredar la composición visual de la escena n (mismo sujeto
  visible, mismo ángulo aproximado, mismo lighting key) para que el corte sea continuo. NO
  cambies de set ni de paleta entre escenas consecutivas a menos que el style lo exija.`;

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
  // ── Derive scene/duration shape:
  //    • If presetScript is provided, RESPECT its segment shape (1 scene/5s
  //      templates must work; do NOT clamp to MIN_SCENES/MIN_DURATION).
  //    • Otherwise clamp to engine defaults.
  let totalSec: number;
  let scenesCount: number;
  let sceneDurations: number[];
  if (req.presetScript && Array.isArray(req.presetScript.scenes) && req.presetScript.scenes.length > 0) {
    scenesCount = req.presetScript.scenes.length;
    sceneDurations = req.presetScript.scenes.map(s => {
      const d = Math.round((s.timeEndSec ?? 0) - (s.timeStartSec ?? 0));
      return Math.min(Math.max(d || 5, 3), 10);
    });
    totalSec = sceneDurations.reduce((a, b) => a + b, 0);
  } else {
    totalSec = clampDuration(req.totalDurationSec);
    scenesCount = clampScenesCount(req.scenesCount, totalSec);
    sceneDurations = distributeSceneDurations(totalSec, scenesCount);
  }
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
  } else if (req.longForm || totalSec > 60 || (req.compositionMode && req.compositionMode !== "narrative")) {
    // ── DIRECTOR MODE (long-form / explainer-locked / composite-pro) ───────
    // Build Product DNA first (or reuse if caller already passed one), then
    // generate the directed script with full narrative arc + continuity.
    const { buildProductDNA } = await import("./product-dna.js");
    const { generateDirectedScript } = await import("./cinematic-director.js");
    const productDNA = req.productDNA ?? await buildProductDNA({
      projectId: req.projectId,
      productName: req.productName,
      brand: req.brand,
      category: req.niche,
      description: req.productDescription,
      images: [
        { buffer: req.productImage, mime: (req.productMime as any) || "image/jpeg" },
        ...(req.extraProductImages || []),
      ],
      language: req.language,
    });
    logger.info({
      projectId: req.projectId,
      materials: productDNA.materials.length,
      decoLayers: productDNA.deconstructionPoints.length,
    }, "🧬 Product DNA built");
    script = await generateDirectedScript({
      projectId: req.projectId,
      productName: req.productName,
      brand: req.brand,
      niche: req.niche,
      audience: req.audienceText || req.audience,
      language: req.language,
      totalDurationSec: totalSec,
      scenesCount,
      sceneDurations,
      aspect: req.aspect,
      style: req.style,
      customBrief: req.customBrief,
      compositionMode: req.compositionMode || "narrative",
      productDNA,
      character: req.character ? { name: req.character.name, identityPrompt: req.character.identityPrompt } : undefined,
      ctaText: req.ctaText,
    });
  } else {
    script = await generateCinematicScript(req, scenesCount, sceneDurations);
  }
  logger.info({ scenes: script.scenes.length, title: script.title, loadedFromTemplate, longForm: Boolean(req.longForm), composition: req.compositionMode }, "🎬 CinematicMultiShot: script ready");

  // ── 2. Per-scene keyframes (PARALLEL with concurrency limit) ────────────
  // Si hay Character Lock, antepondemos el bloque de identidad al prompt y pasamos
  // la foto del personaje como referencia adicional (nano-banana acepta varias).
  const characterRefExtras = req.character
    ? [{ buffer: req.character.image, mime: req.character.mime, tag: "character" }]
    : undefined;
  const identityPrefix = req.character ? `${req.character.identityPrompt}\n\n` : "";

  // Forbidden tokens for the runtime sanitization gate — these strings will be
  // surgically removed from any keyframe/video prompt before reaching the
  // provider. Belt-and-suspenders against Claude leaking brand/product/CTA
  // text that the image/video model would burn as garbled typography.
  // CRITICAL: include req.productName and req.ctaText in addition to the
  // script-derived tokens — the non-director path (saved/preset scripts) only
  // populates a subset of script.* fields, so without these two the leak
  // surface stays open.
  const forbiddenTokens = [
    req.brand,
    req.productName,
    req.ctaText,
    script.title,
    script.cta,
    script.hook,
    script.closingLine,
  ].filter((s): s is string => typeof s === "string" && s.trim().length >= 2);

  // ── LOCKED-SHOT branch: sequential last-frame chaining for "single take" feel ──
  // The user wants product-presentation videos to look like ONE continuous shot
  // (model in same pose/frame, only micro-gestures change). To achieve that we
  // generate clips SEQUENTIALLY: each new clip uses the PREVIOUS clip's last
  // frame as its source image (instead of a freshly-generated keyframe). The
  // result is byte-perfect visual continuity at clip boundaries.
  let keyframes: Array<{ idx: number; buffer: Buffer; mime: string }>;
  let clips: Array<{ idx: number; buffer: Buffer; mime: string; durationSec: number }>;

  // Helper: decide per-scene whether to apply character lock. When the scene
  // explicitly opts out (useCharacter === false) OR is a non-presenter shot
  // type (b_roll/product), we skip both the identity prefix and the character
  // image reference. This is what allows hybrid templates (presenter +
  // B-roll) to render correctly: the host appears only in presenter scenes,
  // and the product is the sole subject in B-roll scenes.
  const sceneCharacterRefs = (scene: CinematicScene) => {
    if (!req.character) return undefined;
    if (scene.useCharacter === false) return undefined;
    if (scene.shotType === "b_roll" || scene.shotType === "product") return undefined;
    return characterRefExtras;
  };
  const sceneIdentityPrefix = (scene: CinematicScene) => {
    if (!req.character) return "";
    if (scene.useCharacter === false) return "";
    if (scene.shotType === "b_roll" || scene.shotType === "product") return "";
    return identityPrefix;
  };

  if (req.compositionMode === "locked-shot") {
    keyframes = [];
    clips = [];
    let chainSource: { buffer: Buffer; mime: string } | null = null;
    const lockedCameraSuffix = ". Camera fully static lock-off, fixed tripod, no camera movement at all; only the model performs subtle natural micro-gestures within the frame";
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const dur = sceneDurations[i];
      const cleanKeyframe = sanitizeVideoPrompt(scene.keyframePrompt, forbiddenTokens);
      const refsForScene = sceneCharacterRefs(scene);
      const prefixForScene = sceneIdentityPrefix(scene);

      // 1) Source image: chain from previous last-frame, OR generate the
      //    very first keyframe normally.
      let kf: { buffer: Buffer; mime: string };
      if (chainSource) {
        kf = chainSource;
        logger.info({ sceneIdx: scene.idx, chained: true }, "🎬 locked-shot: chained from prev clip last-frame");
      } else {
        const { buffer, mimeType } = await retry(
          () => generateImage(imageModel, prefixForScene + cleanKeyframe, {
            aspectRatio: req.aspect,
            referenceImage: req.productImage,
            referenceMime: req.productMime,
            extraReferences: refsForScene,
            negativePrompt: script.negativePrompt,
          }),
          2,
          `keyframe scene ${scene.idx} (locked-shot)`,
        );
        kf = { buffer, mime: mimeType };
        logger.info({ sceneIdx: scene.idx, kfBytes: buffer.length, characterLocked: Boolean(refsForScene), shotType: scene.shotType ?? null }, "🎬 locked-shot: anchor keyframe generated");
      }
      keyframes.push({ idx: scene.idx, buffer: kf.buffer, mime: kf.mime });

      // 2) Animate the locked frame.
      const cleanVideoPrompt = sanitizeVideoPrompt(scene.videoPrompt, forbiddenTokens) + lockedCameraSuffix;
      const buf = await retry(
        () => generateVideoFromImage(req.videoModel, kf.buffer, kf.mime, cleanVideoPrompt, {
          duration: dur,
          aspect: req.aspect,
          cameraPreset: "static_lockoff",
        }),
        2,
        `video scene ${scene.idx} (locked-shot)`,
      );
      clips.push({ idx: scene.idx, buffer: buf, mime: "video/mp4", durationSec: dur });
      logger.info({ sceneIdx: scene.idx, clipBytes: buf.length, dur }, "🎬 locked-shot: clip generated");

      // 3) Extract last frame for the next iteration.
      //    CONTINUITY GUARD: only chain when the next scene shares the same
      //    character-lock state. A presenter→B-roll transition must NOT
      //    inherit the host's last frame (the product scene would then animate
      //    from a frame containing a person — "ghosting"). In that case we
      //    force `chainSource = null` so the next iteration generates a fresh
      //    product-only keyframe.
      if (i < script.scenes.length - 1) {
        const nextScene = script.scenes[i + 1];
        const currentLocked = Boolean(refsForScene);
        const nextLocked = Boolean(sceneCharacterRefs(nextScene));
        if (currentLocked !== nextLocked) {
          chainSource = null;
          logger.info({
            sceneIdx: scene.idx,
            nextSceneIdx: nextScene.idx,
            currentShotType: scene.shotType ?? null,
            nextShotType: nextScene.shotType ?? null,
            currentLocked,
            nextLocked,
          }, "🎬 locked-shot: continuity guard — character-lock state change, chainSource cleared (will generate fresh keyframe for next scene)");
        } else {
          try {
            chainSource = await extractLastFrame(buf);
          } catch (e: any) {
            logger.warn({ sceneIdx: scene.idx, err: e?.message }, "🎬 locked-shot: extractLastFrame failed; falling back to fresh keyframe for next scene");
            chainSource = null;
          }
        }
      }
    }
  } else {
    // Concurrency: 4 keyframes en paralelo (image-gen es ligero ~3-10s).
    const KF_CONCURRENCY = Math.min(4, script.scenes.length);
    keyframes = await runWithConcurrency(
      script.scenes.map((scene) => async () => {
        const cleanKeyframe = sanitizeVideoPrompt(scene.keyframePrompt, forbiddenTokens);
        const refsForScene = sceneCharacterRefs(scene);
        const prefixForScene = sceneIdentityPrefix(scene);
        const { buffer, mimeType } = await retry(
          () => generateImage(imageModel, prefixForScene + cleanKeyframe, {
            aspectRatio: req.aspect,
            referenceImage: req.productImage,
            referenceMime: req.productMime,
            extraReferences: refsForScene,
            negativePrompt: script.negativePrompt,
          }),
          2,
          `keyframe scene ${scene.idx}`,
        );
        logger.info({ sceneIdx: scene.idx, kfBytes: buffer.length, characterLocked: Boolean(refsForScene), shotType: scene.shotType ?? null, keyframePromptHead: cleanKeyframe.slice(0, 200) }, "🎬 keyframe generated");
        return { idx: scene.idx, buffer, mime: mimeType };
      }),
      KF_CONCURRENCY,
    ).then((arr) => arr.sort((a, b) => a.idx - b.idx));

    // ── 3. Per-scene videos (PARALLEL with concurrency limit + retry) ───────
    // Concurrency: 5 vídeos en paralelo (cada uno tarda 60-180s en provider).
    // Para 30 escenas: ~9 min wall-clock vs ~45 min secuencial.
    // Provider rate-limits: kling permite ~5-10 paralelos; runway 3; veo 5.
    const VIDEO_CONCURRENCY = req.videoModel.startsWith("runway") ? 3 : 5;
    clips = await runWithConcurrency(
      script.scenes.map((scene, i) => async () => {
        const dur = sceneDurations[i];
        const kf = keyframes[i];
        const cleanVideoPrompt = sanitizeVideoPrompt(scene.videoPrompt, forbiddenTokens);
        const buf = await retry(
          () => generateVideoFromImage(req.videoModel, kf.buffer, kf.mime, cleanVideoPrompt, {
            duration: dur,
            aspect: req.aspect,
            cameraPreset: scene.cameraPreset || cameraPreset,
          }),
          2,
          `video scene ${scene.idx}`,
        );
        logger.info({ sceneIdx: scene.idx, clipBytes: buf.length, dur, videoPromptHead: cleanVideoPrompt.slice(0, 200) }, "🎬 clip generated");
        return { idx: scene.idx, buffer: buf, mime: "video/mp4", durationSec: dur };
      }),
      VIDEO_CONCURRENCY,
    ).then((arr) => arr.sort((a, b) => a.idx - b.idx));
  }

  // ── 4. Voiceover (optional) — NOW RUN BEFORE CONCAT so we can slice it
  //       per-scene for intelligent lip-sync (presenter scenes get Replicate
  //       wav2lip on their slot of the voiceover; b-roll/product scenes keep
  //       their original visual and the SAME continuous voice plays as VO).
  let voiceoverBuffer: Buffer | undefined;
  if (req.narration?.enabled) {
    const fullScript = script.scenes.map((s) => s.voiceoverLine).join(" ");
    if (fullScript.trim().length > 0) {
      voiceoverBuffer = await generateTTS(fullScript, {
        voiceId: req.narration.voiceId || "21m00Tcm4TlvDq8ikWAM",
        modelId: req.narration.voiceModel || "eleven_v3",
        languageCode: req.language.length === 2 ? req.language : undefined,
      });
      logger.info({ voiceBytes: voiceoverBuffer.length }, "🎬 voiceover ready (pre-concat)");
    }
  }

  // ── 4.5. Per-scene intelligent lip-sync ─────────────────────────────────
  // Decide hasPerson per scene from shotType:
  //   - "presenter"          → person on screen → MUST lip-sync
  //   - "b_roll" | "product" → NO person on screen → voice-over (skip)
  //   - undefined (legacy)   → infer from sceneCharacterRefs (character lock
  //                            applied → assume presenter; else b_roll).
  // intelligentLipSync defaults to TRUE when narration enabled AND at least
  // one scene is a presenter. Disabled if no voice (nothing to sync) or if
  // no person ever appears (pure product ad).
  const sceneHasPerson = (s: CinematicScene): boolean => {
    if (s.shotType === "presenter") return true;
    if (s.shotType === "b_roll" || s.shotType === "product") return false;
    // Legacy fallback: presenter if character is locked into this scene.
    return Boolean(sceneCharacterRefs(s));
  };
  const presenterCount = script.scenes.reduce((n, s) => n + (sceneHasPerson(s) ? 1 : 0), 0);
  const lipSyncEnabled = (req.intelligentLipSync !== false)
    && Boolean(voiceoverBuffer)
    && presenterCount > 0;

  // CRITICAL: pass the same crossfadeSec the concat step will use. Otherwise
  // per-scene audio slices drift earlier than the spoken voice by i*crossfade
  // seconds in clip i (e.g. 4s of drift after 10 shots with 0.4s xfade).
  const lockedShotForLipSync = req.compositionMode === "locked-shot";
  const crossfadeForLipSync = lockedShotForLipSync ? 0 : (clips.length > 1 ? 0.4 : 0);
  // The FINAL video duration after concat removes (N-1) * crossfade seconds
  // of overlap from the raw sum of clip durations. We must align the voice
  // slicing to this final timeline, NOT the raw sum.
  const rawTotalSec = clips.reduce((s, c) => s + c.durationSec, 0);
  const finalConcatSec = clips.length > 1 && crossfadeForLipSync > 0
    ? Math.max(0.5, rawTotalSec - crossfadeForLipSync * (clips.length - 1))
    : rawTotalSec;

  let renderClips = clips;
  if (lipSyncEnabled && voiceoverBuffer) {
    logger.info({
      totalScenes: script.scenes.length,
      presenterScenes: presenterCount,
      voiceOverScenes: script.scenes.length - presenterCount,
      finalConcatSec,
      crossfadeSec: crossfadeForLipSync,
    }, "🎙 intelligent lip-sync: starting per-scene processing (crossfade-aware)");
    try {
      const synced = await applyPerSceneLipSync({
        clips: clips.map((c, i) => ({
          idx: c.idx,
          buffer: c.buffer,
          mime: c.mime,
          durationSec: c.durationSec,
          hasPerson: sceneHasPerson(script.scenes[i]),
        })),
        voiceBuffer: voiceoverBuffer,
        totalVideoSec: finalConcatSec,
        crossfadeSec: crossfadeForLipSync,
        concurrency: 2,
      });
      // Preserve scene metadata; only swap the buffer (lip-synced when applicable).
      renderClips = clips.map((c, i) => ({
        idx: c.idx,
        buffer: synced[i]?.buffer ?? c.buffer,
        mime: synced[i]?.mime ?? c.mime,
        durationSec: c.durationSec,
      }));
      logger.info({ syncedClips: renderClips.length }, "🎙 intelligent lip-sync: done");
    } catch (err: any) {
      // FAIL-SOFT: if per-scene lip-sync orchestration crashes, ship the
      // original clips. The voice-over will still play correctly (mux
      // happens later); only mouth animation is lost on presenter shots.
      logger.error({ err: err?.message }, "🎙 intelligent lip-sync FAILED — shipping original clips with voice-over only");
    }
  }

  // ── 5. Concat with cinematic crossfade (or hard cut for locked-shot) ────
  // locked-shot: crossfade=0 because last-frame chaining means clip[N].first ==
  // clip[N-1].last byte-for-byte → a hard cut is INVISIBLE; a crossfade would
  // actually break the illusion by blending the same frame with itself.
  const lockedShot = req.compositionMode === "locked-shot";
  const concatenated = await concatVideos({
    videoBuffers: renderClips.map((c) => c.buffer),
    width,
    height,
    fps: 30,
    crossfadeSec: lockedShot ? 0 : (renderClips.length > 1 ? 0.4 : 0),
    transitionPreset: lockedShot
      ? "hard_cut"
      : req.style === "energetic"
        ? "hard_cut"
        : req.style === "luxury"
          ? "fade_to_black"
          : req.style === "tech"
            ? "glitch_pixel"
            : "cross_dissolve",
    clipDurationsSec: renderClips.map((c) => c.durationSec),
  });
  logger.info({ concatBytes: concatenated.length }, "🎬 concat ready");

  // ── 6. Music (optional) ─────────────────────────────────────────────────
  let musicBuffer: Buffer | undefined;
  if (req.music?.enabled) {
    const musicPrompt = req.music.prompt
      || `${req.style} background music for a ${req.productName} ad, no vocals, builds energy, fits ${totalSec} seconds`;
    try {
      // Use generateMusicLong for >47s — stitches multiple Stable Audio blocks
      // with crossfade and a section-based arc (intro/rise/verse/bridge/drop/outro).
      musicBuffer = totalSec > 45
        ? await generateMusicLong(musicPrompt, totalSec)
        : await generateMusic(musicPrompt, totalSec);
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

  // ── 7.5. Brand overlay (deterministic FFmpeg drawtext + logo) ──────────
  // AI video models cannot render readable text/logos — we burn them in
  // here AFTER the mux. This is the only way to ship production-grade ads
  // with byte-perfect spelling on brand name, social handles, URL and CTA.
  if (req.brandOverlay || req.brandKit) {
    try {
      const { applyBrandOverlay, buildAutoBrandOverlay } = await import("./brand-overlay.js");
      const overlayConfig = req.brandOverlay
        ? req.brandOverlay
        : buildAutoBrandOverlay({
            videoDurationSec: totalSec,
            brandName: req.brandKit?.brandName ?? req.brand,
            tagline: req.brandKit?.tagline,
            socialHandles: req.brandKit?.socialHandles,
            url: req.brandKit?.url,
            ctaText: req.ctaText,
            accentHex: req.brandKit?.accentHex,
            logo: req.brandKit?.logo,
            aspect: req.aspect as any,
          });
      const overlayResult = await applyBrandOverlay(finalVideo, overlayConfig);
      finalVideo = overlayResult.buffer;
      logger.info({
        applied: overlayResult.applied,
        skipped: overlayResult.skipped,
        finalBytes: finalVideo.length,
      }, "🎬 brand overlay applied");
    } catch (err: any) {
      // FAIL-SOFT: if the overlay step crashes (e.g. font missing on a
      // freshly-built deploy) we still ship the underlying video instead
      // of failing the whole render. The error is logged loudly so ops
      // can fix it.
      logger.error({ err: err?.message }, "🎬 brand overlay FAILED — shipping video without overlay");
    }
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
