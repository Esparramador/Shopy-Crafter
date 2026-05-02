import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db, projectsTable, projectFilesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { enableLongRunning } from "../lib/long-running.js";
import { saveToVault } from "../lib/vault.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { learnFromOperation } from "../lib/claude.js";
import { ObjectStorageService, signObjectURL, objectStorageClient } from "../lib/objectStorage.js";
import { safeDecrypt } from "../lib/crypto.js";
import { checkTtsQuota } from "./voice.js";
import {
  IMAGE_MODELS, IMAGE_EDIT_MODELS, VIDEO_MODELS,
  generateImage, editImage, removeBackground, replaceBackground,
  upscaleImage, clarityUpscale, enhanceFaces,
  cloneVoice, deleteCloneVoice, generateTTS, generateSFX, generateMusic,
  generateVideoFromImage, composeAd, concatVideos, packAssetsAsZip,
  fetchToBuffer,
  CAMERA_PRESETS, TRANSITION_PRESETS,
  lipSyncVideoToAudio, transcribeAudioToSrt, burnSubtitlesIntoVideo,
  transferMotionToImage,
  type ImageGenModel, type ImageEditModel, type VideoModel,
} from "../lib/fusion-studio-pro.js";
import { getAllProvidersHealth, invalidateProviderHealthCache, type ProviderId } from "../lib/provider-health.js";
import { buildProPrompt, getPromptCatalog, type BuildPromptOptions } from "../lib/prompt-templates.js";
import { enhancePrompt, type EnhanceIntent } from "../lib/prompt-enhance.js";
import { ensureSeedsExist, PROMPT_LIBRARY_SEEDS } from "../lib/prompt-library-seeds.js";
import { db as _dbForLibrary, omnicorePromptLibraryTable } from "@workspace/db";
import { eq as _eqLib, desc as _descLib, sql as _sqlLib } from "drizzle-orm";
import { listTemplates } from "../lib/ad-templates.js";
import {
  generateCinematicMultiShot,
  generateCinematicScript,
  persistCinematicScript,
  loadCinematicScript,
  listCinematicScripts,
  deleteCinematicScript,
  toggleCinematicScriptFavorite,
  updateCinematicScript,
  type CinematicAspect, type CinematicStyle, type CinematicScript,
} from "../lib/cinematic-multishot.js";
import {
  AVATAR_LIBRARY, listAvatarsByNiche, findAvatar,
  generateTalkingAvatar, generateProductAvatar, generateMimicMotion,
} from "../lib/avatar-studio.js";
import { planCampaign, type CampaignBudget, type ShotRequest } from "../lib/campaign-planner.js";

const router = Router();
// 500MB — admite vídeo 4K vertical hasta ~2min con CRF 14. Multer usa memoryStorage,
// así que mantenemos el techo razonable para evitar OOM (admin-only, pero protege accidentes).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

// ─── HELPERS ───────────────────────────────────────────────────────────────

let _storage: ObjectStorageService | null = null;
function getStorage(): ObjectStorageService {
  if (!_storage) _storage = new ObjectStorageService();
  return _storage;
}

// Lee y desencripta el token de Replicate del proyecto (campo cifrado en DB).
// El bug histórico: el código leía `replicateApiKey` que NO EXISTE en el schema
// (la columna real es `replicate_api_token` → `replicateApiToken`). Por eso
// siempre caía al env REPLICATE_API_TOKEN, ignorando el token por proyecto.
function getProjectReplicateToken(project: any): string | undefined {
  const enc = project?.replicateApiToken;
  if (!enc) return undefined;
  try { return safeDecrypt(enc) || enc; } catch { return enc; }
}

// Smart vault save: uploads large files to Object Storage instead of inline base64.
// Files >2MB (raw bytes, ~2.7MB base64) → Object Storage; smaller → content field.
// Keeps things efficient and avoids the 50MB Express body limit on subsequent reads.
// Throws on failure so caller's try/catch handles the response (no silent null).
export async function saveToVaultSmart(params: {
  projectId: number;
  fileType: string;
  category: string;
  title: string;
  mimeType: string;
  generatedBy: string;
  buffer: Buffer;
}): Promise<number> {
  const RAW_THRESHOLD = 2 * 1024 * 1024; // 2MB raw → preferimos Object Storage
  // saveToVault corta a metadata-only si content > 50MB (vídeo) o > 10MB (resto).
  // Si Object Storage cae y caemos a base64, estos tamaños provocarían pérdida
  // SILENCIOSA del binario. Calculamos el tope real para fallback seguro.
  const isVideo = params.mimeType.startsWith("video/");
  const FALLBACK_MAX = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

  if (params.buffer.length === 0) {
    throw new Error(`saveToVaultSmart: buffer vacío (${params.fileType})`);
  }

  if (params.buffer.length > RAW_THRESHOLD) {
    // Subida a Object Storage (preferida para todo lo que pese >2MB).
    const safeTitle = params.title.replace(/[^a-z0-9-_]/gi, "_").slice(0, 50);
    const ext = params.mimeType.split("/")[1] || "bin";
    const objectPath = `projects/${params.projectId}/${params.fileType}/${safeTitle}_${Date.now()}.${ext}`;
    let uploadedFileRef: any = null;
    try {
      uploadedFileRef = await getStorage().getObjectEntityFile(objectPath);
      await getStorage().uploadObject(uploadedFileRef, params.buffer, params.mimeType);
      const vaultId = await saveToVault({
        projectId: params.projectId,
        fileType: params.fileType,
        category: params.category,
        title: params.title,
        mimeType: params.mimeType,
        generatedBy: params.generatedBy,
        objectPath,
        fileSizeBytes: params.buffer.length,
      });
      if (vaultId === null) throw new Error("saveToVault returned null after objectStorage upload");
      logger.info({ vaultId, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2), storage: "objectStorage" }, "fs-pro: asset guardado");
      return vaultId;
    } catch (err) {
      // ROLLBACK: si subimos a Object Storage pero la inserción en DB falló,
      // borramos el blob para no dejar orphans (cuestan dinero y se acumulan).
      if (uploadedFileRef) {
        try {
          await getStorage().deleteObject(uploadedFileRef);
          logger.info({ objectPath, fileType: params.fileType }, "fs-pro: rollback OK — orphan blob borrado de Object Storage");
        } catch (delErr) {
          logger.error({ delErr, objectPath, fileType: params.fileType }, "fs-pro: ⚠ rollback FAILED — orphan blob quedó en Object Storage");
        }
      }
      // Si el archivo es demasiado grande para caber en `content` después del
      // fallo de Object Storage, fallamos rápido en vez de devolver un vaultId
      // que el endpoint de preview no podrá servir (vault.ts truncaría a meta).
      if (params.buffer.length > FALLBACK_MAX) {
        logger.error({ err, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2) }, "fs-pro: Object Storage falló y el archivo es demasiado grande para fallback base64");
        throw new Error(`No se pudo guardar el archivo (${(params.buffer.length / 1024 / 1024).toFixed(1)}MB): Object Storage no disponible y excede el límite de DB`);
      }
      logger.warn({ err, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2) }, "fs-pro: Object Storage upload failed, fallback a base64 en DB");
      // Fall through to content base64 (sólo si cabe en el límite real)
    }
  }
  const vaultId = await saveToVault({
    projectId: params.projectId,
    fileType: params.fileType,
    category: params.category,
    title: params.title,
    mimeType: params.mimeType,
    generatedBy: params.generatedBy,
    content: params.buffer.toString("base64"),
    fileSizeBytes: params.buffer.length,
  });
  if (vaultId === null) throw new Error("saveToVault returned null (DB insert failed)");
  logger.info({ vaultId, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2), storage: "db-base64" }, "fs-pro: asset guardado");
  return vaultId;
}

// ─── CAPABILITY CATALOG ───────────────────────────────────────────────────
router.get("/fs-pro/capabilities", requireAdmin, async (_req, res) => {
  res.json({
    imageGeneration: Object.entries(IMAGE_MODELS).map(([k, v]) => ({
      key: k, label: prettyLabel(k), ...v,
    })),
    videoGeneration: Object.entries(VIDEO_MODELS).map(([k, v]) => ({
      key: k, label: prettyLabel(k), ...v,
    })),
    imageEdit: Object.entries(IMAGE_EDIT_MODELS).map(([k, v]) => ({
      key: k, label: prettyLabel(k), ...v,
    })),
    enhance: [
      { key: "real-esrgan", label: "Real-ESRGAN x2/x4", description: "Upscale general con preservación de detalle" },
      { key: "clarity-upscaler", label: "Clarity Upscaler", description: "Tipo Magnific, añade detalle creativo" },
      { key: "gfpgan-faces", label: "GFPGAN", description: "Mejora caras y retratos" },
    ],
    background: [
      { key: "remove-bg", label: "Eliminar fondo (Bria RMBG)", description: "Quita el fondo dejando producto recortado" },
      { key: "replace-bg", label: "Reemplazar fondo (Flux Inpaint)", description: "Coloca producto en escena nueva" },
    ],
    audio: [
      { key: "tts", label: "Text-to-Speech (ElevenLabs)", description: "Voz natural en 30+ idiomas" },
      { key: "voice-clone", label: "Voice Cloning", description: "Clona voz de marca con muestra de 30s" },
      { key: "sfx", label: "Sound Effects", description: "Efectos de sonido ambientales" },
      { key: "music", label: "Music Generation (Stable Audio)", description: "Música original libre de derechos" },
    ],
    composition: [
      { key: "compose", label: "Composición FFmpeg", description: "Mezcla video + voz + música + texto overlay en MP4 final" },
    ],
    voiceModels: [
      { key: "eleven_v3", label: "Eleven v3 (latest)", description: "Más expresivo y natural" },
      { key: "eleven_multilingual_v2", label: "Multilingual v2", description: "30+ idiomas, estable" },
      { key: "eleven_turbo_v2_5", label: "Turbo v2.5", description: "Más rápido, calidad alta" },
      { key: "eleven_flash_v2_5", label: "Flash v2.5", description: "El más rápido, baja latencia" },
    ],
    cameraPresets: Object.entries(CAMERA_PRESETS).map(([k, v]) => ({
      key: k, label: v.label, description: v.promptPrefix,
    })),
    transitionPresets: Object.entries(TRANSITION_PRESETS).map(([k, v]) => ({
      key: k, label: v.label, xfade: v.xfade, defaultDurationSec: v.defaultDurationSec,
    })),
    pollopaParity: [
      { key: "lip-sync", label: "Lip-sync (video↔audio)", description: "Sincronización labial sobre video existente" },
      { key: "burn-subs", label: "Subtítulos quemados (Whisper + FFmpeg)", description: "Transcribe el audio y quema los subs en el video" },
      { key: "transcribe", label: "Transcripción a SRT", description: "Genera SRT desde audio (Whisper)" },
      { key: "motion-transfer", label: "Motion transfer", description: "Anima imagen estática con movimiento de un video referencia" },
    ],
    adTemplates: listTemplates().map((t) => ({
      key: t.key, label: t.label, description: t.description,
      cameraPreset: t.cameraPreset, transitionPreset: t.transitionPreset,
      defaultAspect: t.defaultAspect, defaultDurationSec: t.defaultDurationSec,
    })),
    cinematicMultiShot: {
      description: "Genera anuncios multi-shot cinematográficos al estilo Pollo Seedance 2.0: guion por escenas + keyframes + clips concatenados con crossfade + voz + música.",
      styles: [
        { key: "cinematic",  label: "Cinematic 35mm", description: "Look anamórfico, golden hour, slow motion" },
        { key: "ugc",        label: "UGC handheld",   description: "Estilo creador, daylight, vertical nativo" },
        { key: "editorial",  label: "Editorial",      description: "Magazine cover, geometría, minimalismo" },
        { key: "luxury",     label: "Luxury",         description: "Hero reveal, monocromo, materiales premium" },
        { key: "tech",       label: "Tech launch",    description: "Neon, gimbal, futurista" },
        { key: "energetic",  label: "Energetic",      description: "Cortes rápidos, colores vibrantes, energía pop" },
      ],
      scenesRange: { min: 2, max: 24 },
      durationRange: { min: 6, max: 240 },
      aspects: ["9:16", "16:9", "1:1"],
    },
    longAd: {
      description: "Anuncios largos 60s-30min (3-20 min recomendado) con director cinematográfico inteligente, arco narrativo y Character Lock. productId opcional (anuncios brand admiten solo customNotes + characterId).",
      scenesRange: { min: 3, max: 240 },
      durationRange: { min: 60, max: 1800 },
      compositionModes: ["narrative", "explainer-locked", "composite-pro", "locked-shot"],
      aspects: ["9:16", "16:9", "1:1"],
    },
    avatarStudio: {
      description: "Pollo Avatar Studio: talking heads por nicho, product avatars y mimic motion. 15+ presets stock + soporte para foto custom.",
      niches: ["beauty", "health", "fashion", "tech", "food", "home", "fitness", "finance"],
      avatars: AVATAR_LIBRARY.map((a) => ({
        id: a.id, name: a.name, niche: a.niche, gender: a.gender,
        defaultLanguage: a.defaultLanguage, defaultVoiceId: a.defaultVoiceId,
        personaPrompt: a.personaPrompt,
      })),
    },
  });
});

function prettyLabel(key: string): string {
  return key.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join(" ");
}

// ─── PROVIDER HEALTH (selector de API + fallback automático) ─────────────
// GET /api/fs-pro/providers/health  → estado de Replicate / Runway / Gemini / ElevenLabs
//   ?fresh=1 fuerza refresco (sin cache de 60s)
router.get("/fs-pro/providers/health", requireAdmin, async (req, res) => {
  try {
    const fresh = req.query.fresh === "1" || req.query.fresh === "true";
    const data = await getAllProvidersHealth(fresh);
    res.json({ providers: data, fetchedAt: Date.now() });
  } catch (e: any) {
    logger.error({ err: e?.message }, "[fs-pro] providers/health failed");
    res.status(500).json({ error: e?.message || "health check failed" });
  }
});

// POST /api/fs-pro/providers/refresh-cache  → invalida cache (tras 402/429)
router.post("/fs-pro/providers/refresh-cache", requireAdmin, async (_req, res) => {
  invalidateProviderHealthCache();
  res.json({ ok: true });
});

// ─── PROMPT BUILDER (estilo pollo.ai) ─────────────────────────────────────
// GET /api/fs-pro/prompt/catalog → presets disponibles (style, lens, lighting...)
router.get("/fs-pro/prompt/catalog", requireAdmin, (_req, res) => {
  res.json(getPromptCatalog());
});

// POST /api/fs-pro/prompt/enhance → toma el baseline y lo refina con Claude
//   según el intent (ad / image / video / infographic / email / landing / seo /
//   brand / ugc / multishot). Devuelve { enhanced, negativePrompt, breakdown,
//   intent, model }. Si Claude falla, devuelve el baseline.
router.post("/fs-pro/prompt/enhance", requireAdmin, async (req, res) => {
  try {
    const body = req.body as Partial<{
      intent: EnhanceIntent;
      baselinePrompt: string;
      subject: string;
      brand: string | null;
      language: "es" | "en";
      extraContext: string;
      projectId: number;
    }>;
    if (!body || typeof body.subject !== "string" || body.subject.trim().length < 3) {
      res.status(400).json({ error: "subject (min 3 chars) requerido" });
      return;
    }
    if (!body.baselinePrompt || typeof body.baselinePrompt !== "string") {
      res.status(400).json({ error: "baselinePrompt requerido (usa /prompt/build primero)" });
      return;
    }
    const ALLOWED_INTENTS: EnhanceIntent[] = [
      "ad_cinematic", "image_hero_product", "ad_copy_meta", "infographic_html",
      "seo_product_100", "brand_kit_ocr", "email_marketing", "landing_hero",
      "ugc_video", "multishot_director", "image", "video",
    ];
    const intent: EnhanceIntent = ALLOWED_INTENTS.includes(body.intent as EnhanceIntent) ? body.intent! : "image";

    const result = await enhancePrompt({
      intent,
      baselinePrompt: String(body.baselinePrompt).slice(0, 8000),
      subject: String(body.subject).trim().slice(0, 1500),
      brand: body.brand ? String(body.brand).trim().slice(0, 120) : null,
      language: body.language === "en" ? "en" : "es",
      extraContext: body.extraContext ? String(body.extraContext).slice(0, 1500) : undefined,
      projectId: typeof body.projectId === "number" ? body.projectId : 0,
    });
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt enhance failed" });
  }
});

// ─── PROMPT LIBRARY (biblioteca persistente de plantillas reutilizables) ──
// GET /api/fs-pro/prompt-library?useCase=...  → lista (auto-seed si vacía)
router.get("/fs-pro/prompt-library", requireAdmin, async (req, res) => {
  try {
    await ensureSeedsExist();
    const useCase = typeof req.query.useCase === "string" ? req.query.useCase : null;
    let rows;
    if (useCase) {
      rows = await _dbForLibrary
        .select()
        .from(omnicorePromptLibraryTable)
        .where(_eqLib(omnicorePromptLibraryTable.useCase, useCase))
        .orderBy(_descLib(omnicorePromptLibraryTable.useCount), _descLib(omnicorePromptLibraryTable.avgQualityScore));
    } else {
      rows = await _dbForLibrary
        .select()
        .from(omnicorePromptLibraryTable)
        .orderBy(_descLib(omnicorePromptLibraryTable.useCount), _descLib(omnicorePromptLibraryTable.avgQualityScore));
    }
    // Parse promptTemplate (we stored seeds as { systemPrompt, userTemplate })
    // and variables as JSON array. Be defensive against legacy rows that stored
    // the prompt as a raw string.
    const items = rows.map(r => {
      let template: any = r.promptTemplate;
      try {
        const parsed = JSON.parse(String(r.promptTemplate));
        if (parsed && typeof parsed === "object") template = parsed;
      } catch { /* keep as string */ }
      let vars: any = [];
      try { vars = r.variables ? JSON.parse(r.variables) : []; } catch { /* keep [] */ }
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        useCase: r.useCase,
        niche: r.niche,
        promptTemplate: template,
        variables: vars,
        avgQualityScore: r.avgQualityScore,
        useCount: r.useCount,
        createdBy: r.createdBy,
        isPublic: r.isPublic,
        isSeed: typeof r.id === "string" && r.id.startsWith("seed:"),
      };
    });
    res.json({ ok: true, items, total: items.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt-library list failed" });
  }
});

// POST /api/fs-pro/prompt-library  → crear plantilla custom del usuario
router.post("/fs-pro/prompt-library", requireAdmin, async (req, res) => {
  try {
    const { name, description, useCase, niche, systemPrompt, userTemplate, variables } = req.body as Record<string, any>;
    if (!name || typeof name !== "string" || name.trim().length < 3) {
      res.status(400).json({ error: "name (min 3 chars) requerido" }); return;
    }
    if (!userTemplate || typeof userTemplate !== "string" || userTemplate.trim().length < 10) {
      res.status(400).json({ error: "userTemplate (min 10 chars) requerido" }); return;
    }
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await _dbForLibrary.insert(omnicorePromptLibraryTable).values({
      id,
      name: String(name).trim().slice(0, 200),
      description: description ? String(description).slice(0, 500) : null,
      niche: niche ? String(niche).slice(0, 80) : null,
      useCase: useCase ? String(useCase).slice(0, 80) : "user_custom",
      promptTemplate: JSON.stringify({
        systemPrompt: systemPrompt ? String(systemPrompt).slice(0, 8000) : "",
        userTemplate: String(userTemplate).slice(0, 12000),
      }),
      variables: Array.isArray(variables) ? JSON.stringify(variables.slice(0, 30).map(String)) : "[]",
      avgQualityScore: 0.5,
      useCount: 0,
      createdBy: ((req as any).session?.userId ? `user:${(req as any).session.userId}` : "user:unknown"),
      isPublic: 1,
    });
    res.json({ ok: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt-library create failed" });
  }
});

// DELETE /api/fs-pro/prompt-library/:id  → solo plantillas user-* (no seeds)
router.delete("/fs-pro/prompt-library/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (id.startsWith("seed:")) {
      res.status(403).json({ error: "Las plantillas pre-cargadas (seeds) no se pueden eliminar." }); return;
    }
    await _dbForLibrary.delete(omnicorePromptLibraryTable).where(_eqLib(omnicorePromptLibraryTable.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt-library delete failed" });
  }
});

// POST /api/fs-pro/prompt-library/:id/use  → incrementa contador de uso
router.post("/fs-pro/prompt-library/:id/use", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    await _dbForLibrary.update(omnicorePromptLibraryTable)
      .set({ useCount: _sqlLib`COALESCE(${omnicorePromptLibraryTable.useCount}, 0) + 1` })
      .where(_eqLib(omnicorePromptLibraryTable.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt-library use failed" });
  }
});

// POST /api/fs-pro/prompt-library/seed  → fuerza re-sembrado (idempotente)
router.post("/fs-pro/prompt-library/seed", requireAdmin, async (_req, res) => {
  try {
    const { seedPromptLibrary } = await import("../lib/prompt-library-seeds.js");
    const r = await seedPromptLibrary();
    res.json({ ok: true, ...r, availableSeeds: PROMPT_LIBRARY_SEEDS.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt-library seed failed" });
  }
});

// POST /api/fs-pro/prompt/build → combina presets en un prompt cinematográfico
//   body: BuildPromptOptions  →  { prompt, negativePrompt, breakdown }
router.post("/fs-pro/prompt/build", requireAdmin, (req, res) => {
  try {
    const body = req.body as Partial<BuildPromptOptions> & { picks?: Record<string, string>; brand?: string; apps?: string };
    if (!body || typeof body.subject !== "string" || body.subject.trim().length < 3) {
      res.status(400).json({ error: "subject (min 3 chars) requerido" });
      return;
    }
    if (body.kind !== "image" && body.kind !== "video") {
      res.status(400).json({ error: "kind debe ser 'image' o 'video'" });
      return;
    }
    // Si llega `picks` anidado (forma frontend), aplanar al formato BuildPromptOptions
    // y validar contra el catálogo (allowlist) para evitar valores arbitrarios.
    const catalog = getPromptCatalog();
    const validKeys = (cat: keyof typeof catalog) =>
      new Set(catalog[cat].map((it: any) => it.key));
    const pickAllowed = (cat: keyof typeof catalog, val: any): string | undefined =>
      typeof val === "string" && val && validKeys(cat).has(val) ? val : undefined;

    const picks = (body.picks && typeof body.picks === "object") ? body.picks : {};

    // Normalizar transitions: añadirlo como brandKeyword adicional ya que BuildPromptOptions no lo soporta
    const transitionVal = pickAllowed("transitions", picks.transitions);
    const transitionLine = transitionVal
      ? (catalog.transitions.find((t: any) => t.key === transitionVal)?.description || "")
      : "";

    // Brand string → brandKeywords array
    let brandKw: string[] | undefined;
    if (typeof body.brand === "string" && body.brand.trim()) {
      brandKw = [body.brand.trim().slice(0, 80)];
    } else if (Array.isArray(body.brandKeywords)) {
      brandKw = body.brandKeywords.slice(0, 8).map(s => String(s).slice(0, 80));
    }
    if (transitionLine) {
      brandKw = [...(brandKw || []), transitionLine.slice(0, 200)];
    }

    const safe: BuildPromptOptions = {
      kind: body.kind,
      subject: String(body.subject).trim().slice(0, 1500),
      style:          (pickAllowed("style", picks.style) ?? body.style) as any,
      lens:           (pickAllowed("lens", picks.lens) ?? body.lens) as any,
      lighting:       (pickAllowed("lighting", picks.lighting) ?? body.lighting) as any,
      palette:        (pickAllowed("palette", picks.palette) ?? body.palette) as any,
      mood:           (pickAllowed("mood", picks.mood) ?? body.mood) as any,
      composition:    (pickAllowed("composition", picks.composition) ?? body.composition) as any,
      cameraMovement: body.kind === "video" ? (pickAllowed("cameraMovement", picks.cameraMovement) ?? body.cameraMovement) as any : undefined,
      app:            (pickAllowed("apps", picks.apps ?? (body as any).app) ?? body.app) as any,
      brandKeywords:  brandKw,
      negativeHints:  Array.isArray(body.negativeHints) ? body.negativeHints.slice(0, 12).map(s => String(s).slice(0, 60)) : undefined,
      language:       body.language === "en" ? "en" : "es",
    };
    const result = buildProPrompt(safe);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "prompt build failed" });
  }
});

// ─── IMAGE GENERATION ─────────────────────────────────────────────────────
router.post("/fs-pro/generate-image", requireAdmin, async (req: Request, res: Response) => {
  enableLongRunning(res);
  try {
    const { projectId, model, prompt, aspectRatio, seed, negativePrompt, referenceImageUrl } = req.body as {
      projectId: number; model: ImageGenModel; prompt: string; aspectRatio?: string;
      seed?: number; negativePrompt?: string; referenceImageUrl?: string;
    };
    if (!projectId || !model || !prompt) { res.status(400).json({ error: "projectId, model, prompt requeridos" }); return; }
    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    let referenceImage: Buffer | undefined;
    let referenceMime: string | undefined;
    if (referenceImageUrl) {
      referenceImage = await fetchToBuffer(referenceImageUrl);
      referenceMime = "image/png";
    }

    const { buffer, mimeType } = await generateImage(model, prompt, {
      aspectRatio, seed, negativePrompt, referenceImage, referenceMime,
      replicateToken: getProjectReplicateToken(project),
    });

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-image", category: "fusion-studio-pro",
      title: `FS Pro: ${prompt.slice(0, 60)}`,
      mimeType, generatedBy: `fs-pro:${model}`,
      buffer,
    });
    await recordUsage(projectId, "image", 1);
    learnFromOperation({
      operationType: "fs_pro_generate_image", niche: project.storeNiche ?? null,
      title: `FS Pro image: ${prompt.slice(0, 80)}`,
      content: `Generated image with ${model}. Prompt: ${prompt.slice(0, 200)}.`,
      confidence: 0.85, tags: ["fusion-studio-pro", "image", model],
    });

    res.json({ success: true, vaultId, model, dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}` });
  } catch (err: any) {
    logger.error({ err }, "fs-pro generate-image failed");
    res.status(500).json({ error: err?.message || "Error generando imagen" });
  }
});

// ─── IMAGE EDIT ───────────────────────────────────────────────────────────
router.post("/fs-pro/edit-image", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { projectId: pidStr, model, prompt, aspectRatio, sourceImageUrl } = req.body;
    const projectId = parseInt(pidStr || "0", 10);
    if (!projectId || !model || !prompt) { res.status(400).json({ error: "projectId, model, prompt requeridos" }); return; }
    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    let imgBuf: Buffer; let imgMime: string;
    if (f) { imgBuf = f.buffer; imgMime = f.mimetype; }
    else if (sourceImageUrl) { imgBuf = await fetchToBuffer(sourceImageUrl); imgMime = "image/png"; }
    else { res.status(400).json({ error: "Imagen requerida (file o sourceImageUrl)" }); return; }

    const { buffer, mimeType } = await editImage(model as ImageEditModel, imgBuf, imgMime, prompt, {
      aspectRatio, replicateToken: getProjectReplicateToken(project),
    });

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-image-edit", category: "fusion-studio-pro",
      title: `FS Pro Edit: ${prompt.slice(0, 60)}`,
      mimeType, generatedBy: `fs-pro-edit:${model}`,
      buffer,
    });
    await recordUsage(projectId, "image", 1);

    res.json({ success: true, vaultId, model, dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}` });
  } catch (err: any) {
    logger.error({ err }, "fs-pro edit-image failed");
    res.status(500).json({ error: err?.message || "Error editando imagen" });
  }
});

// ─── BACKGROUND REMOVE / REPLACE ──────────────────────────────────────────
router.post("/fs-pro/remove-bg", requireAdmin, upload.single("image"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { projectId: pidStr, sourceImageUrl } = req.body;
    const projectId = parseInt(pidStr || "0", 10);
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    let buf: Buffer; let mime: string;
    if (f) { buf = f.buffer; mime = f.mimetype; }
    else if (sourceImageUrl) { buf = await fetchToBuffer(sourceImageUrl); mime = "image/png"; }
    else { res.status(400).json({ error: "Imagen requerida" }); return; }

    const out = await removeBackground(buf, mime, getProjectReplicateToken(project));
    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-bg-removed", category: "fusion-studio-pro",
      title: `FS Pro: BG removido`, mimeType: "image/png", generatedBy: "fs-pro:bria-rmbg",
      buffer: out,
    });
    await recordUsage(projectId, "image", 1);
    res.json({ success: true, vaultId, dataUrl: `data:image/png;base64,${out.toString("base64")}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error eliminando fondo" });
  }
});

router.post("/fs-pro/replace-bg", requireAdmin, upload.single("image"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { projectId: pidStr, sourceImageUrl, scenePrompt } = req.body;
    const projectId = parseInt(pidStr || "0", 10);
    if (!projectId || !scenePrompt) { res.status(400).json({ error: "projectId + scenePrompt requeridos" }); return; }
    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    let buf: Buffer; let mime: string;
    if (f) { buf = f.buffer; mime = f.mimetype; }
    else if (sourceImageUrl) { buf = await fetchToBuffer(sourceImageUrl); mime = "image/png"; }
    else { res.status(400).json({ error: "Imagen requerida" }); return; }

    const out = await replaceBackground(buf, mime, scenePrompt, getProjectReplicateToken(project));
    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-bg-replaced", category: "fusion-studio-pro",
      title: `FS Pro: BG reemplazado - ${scenePrompt.slice(0, 50)}`,
      mimeType: "image/png", generatedBy: "fs-pro:bria-bg-gen",
      buffer: out,
    });
    await recordUsage(projectId, "image", 1);
    res.json({ success: true, vaultId, dataUrl: `data:image/png;base64,${out.toString("base64")}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error reemplazando fondo" });
  }
});

// ─── UPSCALE / ENHANCE ────────────────────────────────────────────────────
router.post("/fs-pro/upscale", requireAdmin, upload.single("image"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { projectId: pidStr, sourceImageUrl, scale, mode, prompt } = req.body;
    const projectId = parseInt(pidStr || "0", 10);
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    let buf: Buffer; let mime: string;
    if (f) { buf = f.buffer; mime = f.mimetype; }
    else if (sourceImageUrl) { buf = await fetchToBuffer(sourceImageUrl); mime = "image/png"; }
    else { res.status(400).json({ error: "Imagen requerida" }); return; }

    const sc = parseInt(scale || "2") as 2 | 4;
    let out: Buffer;
    if (mode === "clarity") out = await clarityUpscale(buf, mime, prompt || "high detail photograph", sc, getProjectReplicateToken(project));
    else if (mode === "faces") out = await enhanceFaces(buf, mime, getProjectReplicateToken(project));
    else out = await upscaleImage(buf, mime, sc, getProjectReplicateToken(project));

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-upscaled", category: "fusion-studio-pro",
      title: `FS Pro: Upscaled x${sc} (${mode || "esrgan"})`,
      mimeType: "image/png", generatedBy: `fs-pro:upscale-${mode || "esrgan"}`,
      buffer: out,
    });
    await recordUsage(projectId, "image", 1);
    res.json({ success: true, vaultId, dataUrl: `data:image/png;base64,${out.toString("base64")}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error en upscale" });
  }
});

// ─── VIDEO GENERATION ─────────────────────────────────────────────────────
router.post("/fs-pro/generate-video", requireAdmin, upload.single("image"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { projectId: pidStr, model, prompt, duration, aspect, sourceImageUrl, cameraPreset } = req.body;
    const projectId = parseInt(pidStr || "0", 10);
    if (!projectId || !model || !prompt) { res.status(400).json({ error: "projectId, model, prompt requeridos" }); return; }

    const VIDEO_CREDITS = 4;
    const limit = await checkProductionLimit(projectId, "image", VIDEO_CREDITS);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    // Imagen origen opcional → text-to-video puro permitido si el modelo lo soporta
    let buf: Buffer | null = null;
    let mime = "image/png";
    if (f) { buf = f.buffer; mime = f.mimetype; }
    else if (sourceImageUrl) { buf = await fetchToBuffer(sourceImageUrl); mime = "image/png"; }

    const out = await generateVideoFromImage(model as VideoModel, buf, mime, prompt, {
      duration: parseInt(duration || "5"),
      aspect: aspect || "9:16",
      replicateToken: getProjectReplicateToken(project),
      cameraPreset: typeof cameraPreset === "string" ? cameraPreset : undefined,
    });

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-video", category: "fusion-studio-pro",
      title: `FS Pro Video: ${prompt.slice(0, 60)}`,
      mimeType: "video/mp4", generatedBy: `fs-pro:${model}`,
      buffer: out,
    });
    await recordUsage(projectId, "image", VIDEO_CREDITS);

    res.json({ success: true, vaultId, model, sizeBytes: out.length });
  } catch (err: any) {
    logger.error({ err }, "fs-pro generate-video failed");
    res.status(500).json({ error: err?.message || "Error generando video" });
  }
});

// ─── VOICE CLONING ────────────────────────────────────────────────────────
router.post("/fs-pro/voice/clone", requireAdmin, upload.single("audio"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { name, description } = req.body;
    if (!f || !name) { res.status(400).json({ error: "audio file + name requeridos" }); return; }

    const result = await cloneVoice(name, f.buffer, f.mimetype, description);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error clonando voz" });
  }
});

router.delete("/fs-pro/voice/:voiceId", requireAdmin, async (req, res) => {
  try {
    await deleteCloneVoice(String(req.params.voiceId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error eliminando voz" });
  }
});

// ─── TTS ──────────────────────────────────────────────────────────────────
router.post("/fs-pro/tts", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, voiceId, text, modelId, stability, similarity, style, speed } = req.body;
    if (!projectId || !voiceId || !text) { res.status(400).json({ error: "projectId, voiceId, text requeridos" }); return; }

    // SECURITY (HIGH): share TTS quota across /voice/tts and /fs-pro/tts to
    // prevent rate-limit bypass through the FS Pro endpoint.
    const userId = (req.session as any)?.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
    if (typeof text !== "string" || text.length > 5000) { res.status(413).json({ error: "text excede 5000 caracteres" }); return; }
    const quota = checkTtsQuota(String(userId), text.length);
    if (!quota.ok) {
      res.setHeader("Retry-After", String(quota.retryAfter));
      res.status(429).json({ error: quota.reason });
      return;
    }

    const buf = await generateTTS(text, { voiceId, modelId, stability, similarity, style, speed });
    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-tts", category: "fusion-studio-pro",
      title: `FS Pro TTS: ${text.slice(0, 60)}`,
      mimeType: "audio/mpeg", generatedBy: `fs-pro:elevenlabs-tts`,
      buffer: buf,
    });
    res.json({ success: true, vaultId, dataUrl: `data:audio/mpeg;base64,${buf.toString("base64")}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error en TTS" });
  }
});

// ─── SFX & MUSIC ──────────────────────────────────────────────────────────
router.post("/fs-pro/sfx", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, prompt, duration, promptInfluence } = req.body;
    if (!projectId || !prompt) { res.status(400).json({ error: "projectId, prompt requeridos" }); return; }
    const buf = await generateSFX(prompt, parseInt(duration || "5"), parseFloat(promptInfluence || "0.5"));
    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-sfx", category: "fusion-studio-pro",
      title: `FS Pro SFX: ${prompt.slice(0, 60)}`,
      mimeType: "audio/mpeg", generatedBy: "fs-pro:elevenlabs-sfx",
      buffer: buf,
    });
    res.json({ success: true, vaultId, dataUrl: `data:audio/mpeg;base64,${buf.toString("base64")}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error en SFX" });
  }
});

router.post("/fs-pro/music", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, prompt, duration } = req.body;
    if (!projectId || !prompt) { res.status(400).json({ error: "projectId, prompt requeridos" }); return; }
    const limit = await checkProductionLimit(projectId, "image", 2);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const buf = await generateMusic(prompt, parseInt(duration || "30"), getProjectReplicateToken(project));
    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-music", category: "fusion-studio-pro",
      title: `FS Pro Music: ${prompt.slice(0, 60)}`,
      mimeType: "audio/wav", generatedBy: "fs-pro:stable-audio",
      buffer: buf,
    });
    await recordUsage(projectId, "image", 2);
    res.json({ success: true, vaultId, dataUrl: `data:audio/wav;base64,${buf.toString("base64")}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error generando música" });
  }
});

// ─── COMPOSE ──────────────────────────────────────────────────────────────
router.post("/fs-pro/compose", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, videoVaultId, voiceVaultId, musicVaultId, voiceVolume, musicVolume, overlayText } = req.body;
    if (!projectId || !videoVaultId) { res.status(400).json({ error: "projectId, videoVaultId requeridos" }); return; }

    // Fetch vault file rows for IDs needed
    const ids = [videoVaultId, voiceVaultId, musicVaultId].filter(Boolean) as number[];
    const files = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.projectId, projectId), inArray(projectFilesTable.id, ids)),
    );
    const map = new Map(files.map(f => [f.id, f]));
    const vidFile = map.get(videoVaultId);
    if (!vidFile) { res.status(404).json({ error: "Video vault file no encontrado" }); return; }

    // Helper that reads vault content from any of: HTTP URL, objectStorage, base64 content field
    const fetchVaultContent = async (file: any): Promise<Buffer | undefined> => {
      if (!file) return undefined;
      // 1. Try HTTP URL first (cheapest)
      if (file.originalUrl?.startsWith("http")) {
        try { return await fetchToBuffer(file.originalUrl); } catch {}
      }
      // 2. Try Replit Object Storage via objectPath
      if (file.objectPath) {
        try {
          const { ObjectStorageService } = await import("../lib/objectStorage.js");
          const svc = new ObjectStorageService();
          const gcsFile = await svc.getObjectEntityFile(file.objectPath);
          const resp = await svc.downloadObject(gcsFile);
          return Buffer.from(await resp.arrayBuffer());
        } catch (err) {
          logger.warn({ err, fileId: file.id }, "fs-pro compose: objectStorage read failed");
        }
      }
      // 3. Fallback: content field with base64 (small files only)
      if (file.content) {
        try { return Buffer.from(file.content, "base64"); } catch {}
      }
      return undefined;
    };

    const videoBuf = await fetchVaultContent(vidFile);
    const voiceBuf = voiceVaultId ? await fetchVaultContent(map.get(voiceVaultId)) : undefined;
    const musicBuf = musicVaultId ? await fetchVaultContent(map.get(musicVaultId)) : undefined;

    if (!videoBuf) { res.status(500).json({ error: "No se pudo leer el video del vault (sin URL pública, objectPath ni content)" }); return; }

    const finalBuf = await composeAd({
      videoBuffer: videoBuf,
      voiceBuffer: voiceBuf,
      musicBuffer: musicBuf,
      voiceVolume: voiceVolume ? parseFloat(voiceVolume) : undefined,
      musicVolume: musicVolume ? parseFloat(musicVolume) : undefined,
      overlayText,
    });

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-composed", category: "fusion-studio-pro",
      title: `FS Pro Compose: final MP4`,
      mimeType: "video/mp4", generatedBy: "fs-pro:ffmpeg",
      buffer: finalBuf,
    });
    res.json({ success: true, vaultId, sizeBytes: finalBuf.length });
  } catch (err: any) {
    logger.error({ err }, "fs-pro compose failed");
    res.status(500).json({ error: err?.message || "Error componiendo" });
  }
});

// ─── CONCATENATE MULTIPLE VIDEO CLIPS INTO ONE ─────────────────────────────
// POST /fs-pro/concat
// Body: { projectId, videoVaultIds: number[], voiceVaultId?, musicVaultId?,
//          width?, height?, fps?, crossfadeSec?, voiceVolume?, musicVolume? }
// Concatenates the listed vault videos in order, optionally adds voice/music
// overlay, normalizes to common w/h/fps, and saves the final MP4 back to vault.
router.post("/fs-pro/concat", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const {
      projectId, videoVaultIds, voiceVaultId, musicVaultId,
      width, height, fps, crossfadeSec, voiceVolume, musicVolume,
      transitionPreset,
    } = req.body as {
      projectId: number;
      videoVaultIds: number[];
      voiceVaultId?: number;
      musicVaultId?: number;
      width?: number;
      height?: number;
      fps?: number;
      crossfadeSec?: number;
      voiceVolume?: number;
      musicVolume?: number;
      transitionPreset?: string;
    };
    if (!projectId || !Array.isArray(videoVaultIds) || videoVaultIds.length === 0) {
      res.status(400).json({ error: "projectId + videoVaultIds[] requeridos" });
      return;
    }

    // Fetch all referenced vault rows
    const allIds = [...videoVaultIds, voiceVaultId, musicVaultId].filter((x): x is number => typeof x === "number");
    const rows = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.projectId, projectId), inArray(projectFilesTable.id, allIds)),
    );
    const rowMap = new Map(rows.map(r => [r.id, r]));

    // Helper: fetch buffer from vault row (URL → objectStorage → base64 content)
    const fetchVaultContent = async (file: any): Promise<Buffer | undefined> => {
      if (!file) return undefined;
      if (file.originalUrl?.startsWith("http")) {
        try { return await fetchToBuffer(file.originalUrl); } catch { /* fallthrough */ }
      }
      if (file.objectPath) {
        try {
          const svc = getStorage();
          const gcsFile = await svc.getObjectEntityFile(file.objectPath);
          const resp = await svc.downloadObject(gcsFile);
          return Buffer.from(await resp.arrayBuffer());
        } catch (err) {
          logger.warn({ err, fileId: file.id }, "fs-pro concat: objectStorage read failed");
        }
      }
      if (file.content) {
        try { return Buffer.from(file.content, "base64"); } catch { /* */ }
      }
      return undefined;
    };

    // Resolve clips in the requested order
    const videoBuffers: Buffer[] = [];
    for (const vid of videoVaultIds) {
      const buf = await fetchVaultContent(rowMap.get(vid));
      if (!buf) {
        res.status(404).json({ error: `Video vault id=${vid} no se pudo leer` });
        return;
      }
      videoBuffers.push(buf);
    }
    const voiceBuf = voiceVaultId ? await fetchVaultContent(rowMap.get(voiceVaultId)) : undefined;
    const musicBuf = musicVaultId ? await fetchVaultContent(rowMap.get(musicVaultId)) : undefined;

    const finalBuf = await concatVideos({
      videoBuffers,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      fps: fps ? Number(fps) : undefined,
      crossfadeSec: crossfadeSec ? Number(crossfadeSec) : undefined,
      transitionPreset: typeof transitionPreset === "string" ? transitionPreset : undefined,
      voiceBuffer: voiceBuf,
      musicBuffer: musicBuf,
      voiceVolume: voiceVolume ? parseFloat(String(voiceVolume)) : undefined,
      musicVolume: musicVolume ? parseFloat(String(musicVolume)) : undefined,
    });

    const vaultId = await saveToVaultSmart({
      projectId,
      fileType: "fs-pro-concat",
      category: "fusion-studio-pro",
      title: `FS Pro Concat: ${videoBuffers.length} clips`,
      mimeType: "video/mp4",
      generatedBy: "fs-pro:ffmpeg-concat",
      buffer: finalBuf,
    });
    res.json({ success: true, vaultId, sizeBytes: finalBuf.length, clipsCount: videoBuffers.length });
  } catch (err: any) {
    logger.error({ err }, "fs-pro concat failed");
    res.status(500).json({ error: err?.message || "Error concatenando" });
  }
});

// ─── CONCAT DE CLIPS SUBIDOS POR EL USUARIO (multipart) ──────────────────
// Permite subir directamente varios MP4 propios y concatenarlos sin pasar antes
// por la bóveda. Acepta opcionalmente voiceover y música también subidos.
const concatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 25 }, // 200MB por archivo, máx 25
  fileFilter: (_req, file, cb) => {
    const ok = /^video\/(mp4|quicktime|webm|x-matroska)$|^audio\/(mp3|mpeg|wav|ogg|x-m4a)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`) as any, false);
  },
});

router.post(
  "/fs-pro/concat-uploaded",
  requireAdmin,
  concatUpload.fields([
    { name: "clips", maxCount: 20 },
    { name: "voice", maxCount: 1 },
    { name: "music", maxCount: 1 },
  ]),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const clipFiles = (files?.clips || []).filter(f => /^video\//.test(f.mimetype));
      const voiceFile = files?.voice?.[0];
      const musicFile = files?.music?.[0];

      if (clipFiles.length < 1) {
        res.status(400).json({ error: "Sube al menos 1 clip de vídeo (campo 'clips')" });
        return;
      }
      if (clipFiles.length > 20) {
        res.status(400).json({ error: "Máximo 20 clips por concat" });
        return;
      }

      const projectId = parseInt(String(req.body.projectId || "0"), 10);
      if (!projectId) {
        res.status(400).json({ error: "projectId requerido en form-data" });
        return;
      }

      const width = req.body.width ? Number(req.body.width) : undefined;
      const height = req.body.height ? Number(req.body.height) : undefined;
      const fps = req.body.fps ? Number(req.body.fps) : undefined;
      const crossfadeSec = req.body.crossfadeSec ? Number(req.body.crossfadeSec) : undefined;
      const transitionPreset = typeof req.body.transitionPreset === "string" ? req.body.transitionPreset : undefined;
      const voiceVolume = req.body.voiceVolume ? parseFloat(String(req.body.voiceVolume)) : undefined;
      const musicVolume = req.body.musicVolume ? parseFloat(String(req.body.musicVolume)) : undefined;
      const title = (req.body.title ? String(req.body.title) : `Mis clips concatenados (${clipFiles.length})`).slice(0, 200);

      logger.info({ projectId, clipsCount: clipFiles.length, hasVoice: !!voiceFile, hasMusic: !!musicFile, transitionPreset }, "fs-pro concat-uploaded: starting");

      const finalBuf = await concatVideos({
        videoBuffers: clipFiles.map(f => f.buffer),
        width, height, fps, crossfadeSec, transitionPreset,
        voiceBuffer: voiceFile?.buffer,
        musicBuffer: musicFile?.buffer,
        voiceVolume, musicVolume,
      });

      const vaultId = await saveToVaultSmart({
        projectId,
        fileType: "fs-pro-concat",
        category: "fusion-studio-pro",
        title,
        mimeType: "video/mp4",
        generatedBy: "fs-pro:user-upload-concat",
        buffer: finalBuf,
      });

      res.json({
        success: true,
        vaultId,
        sizeBytes: finalBuf.length,
        clipsCount: clipFiles.length,
        title,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, "fs-pro concat-uploaded failed");
      const isMulter = err?.code === "LIMIT_FILE_SIZE" || /file size|too large/i.test(String(err?.message));
      res.status(isMulter ? 413 : 500).json({
        error: isMulter ? "Archivo demasiado grande (máx 200MB por clip)" : (err?.message || "Error concatenando clips subidos"),
        code: isMulter ? "FILE_TOO_LARGE" : "CONCAT_FAILED",
      });
    }
  },
);

// ─── UPLOAD ARBITRARY CLIP/AUDIO/IMAGE TO VAULT ───────────────────────────
// Permite a otros agentes (chatbot, scripts batch, ffmpeg local) guardar un
// archivo binario directamente en el vault del proyecto. Usado por el pipeline
// de montaje cuando los clips intro/outro se generan offline.
router.post("/fs-pro/save-to-vault", requireAdmin, upload.single("file"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    if (!f) { res.status(400).json({ error: "Falta archivo (campo 'file')" }); return; }
    const projectId = parseInt(String(req.body.projectId || "0"), 10);
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
    const title = String(req.body.title || `FS Pro Upload ${Date.now()}`).slice(0, 200);
    // SECURITY: Allowlist de fileType / mimeType para evitar registrar contenido inesperado
    const ALLOWED_FILETYPES = new Set([
      "fs-pro-upload", "fs-pro-intro", "fs-pro-outro", "fs-pro-clip",
      "fs-pro-video", "fs-pro-image", "fs-pro-audio", "fs-pro-tts", "fs-pro-sfx", "fs-pro-music",
    ]);
    const requestedFileType = String(req.body.fileType || "fs-pro-upload").slice(0, 64);
    const fileType = ALLOWED_FILETYPES.has(requestedFileType) ? requestedFileType : "fs-pro-upload";
    const category = "fusion-studio-pro";
    const generatedBy = String(req.body.generatedBy || "fs-pro:upload").slice(0, 64);
    const ALLOWED_MIME_PREFIX = ["video/", "audio/", "image/"];
    const mimeRaw = String(req.body.mimeType || f.mimetype || "application/octet-stream");
    if (!ALLOWED_MIME_PREFIX.some(p => mimeRaw.startsWith(p))) {
      res.status(415).json({ error: `mimeType no permitido (${mimeRaw}). Solo video/audio/image.` });
      return;
    }
    const mimeType = mimeRaw;

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const vaultId = await saveToVaultSmart({
      projectId, fileType, category, title, mimeType, generatedBy, buffer: f.buffer,
    });
    res.json({ success: true, vaultId, sizeBytes: f.buffer.length, mimeType });
  } catch (err: any) {
    logger.error({ err }, "fs-pro save-to-vault failed");
    res.status(500).json({ error: err?.message || "Error guardando en vault" });
  }
});

// ─── COST ESTIMATE / CAMPAIGN PLANNER ─────────────────────────────────────
// Calcula coste y shotlist optimizado SIN ejecutar nada. Pensado para que el
// frontend muestre presupuesto antes de quemar créditos.
// ─── UPLOAD PUBLIC ASSET (URL HTTPS firmada para usar como referenceImage) ──
// POST /fs-pro/upload-public-asset
// FormData: file (multipart) — sube el archivo al bucket público de Object Storage
// y devuelve { signedUrl, objectName, ttlSec }. La URL es HTTPS, válida 1h, y
// la aceptan motores como Runway que exigen URLs públicas (no dataURI grandes).
router.post("/fs-pro/upload-public-asset", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  try {
    const f = req.file;
    if (!f) { res.status(400).json({ error: "Falta file (multipart)" }); return; }

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) { res.status(500).json({ error: "DEFAULT_OBJECT_STORAGE_BUCKET_ID no configurado" }); return; }

    // Auto-resize si es imagen y excede 2048px (Runway/Replicate exigen ≤8000, pero
    // 2048 es óptimo para referencias: rápido y sin pérdida visual perceptible).
    let buffer = f.buffer;
    let mimeType = f.mimetype || "application/octet-stream";
    let ext = (f.originalname?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

    if (mimeType.startsWith("image/")) {
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(buffer).metadata();
        if ((meta.width || 0) > 2048 || (meta.height || 0) > 2048) {
          buffer = await sharp(buffer).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
          mimeType = "image/jpeg";
          ext = "jpg";
          logger.info({ originalSize: f.size, newSize: buffer.length, w: meta.width, h: meta.height }, "upload-public-asset: auto-resized");
        }
      } catch (e: any) {
        logger.warn({ err: e?.message }, "upload-public-asset: resize skipped");
      }
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const objectName = `public/runway-refs/${safeName}`;

    const file = objectStorageClient.bucket(bucketId).file(objectName);
    await file.save(buffer, { contentType: mimeType, resumable: false });

    const ttlSec = 3600;
    const signedUrl = await signObjectURL({ bucketName: bucketId, objectName, method: "GET", ttlSec });

    res.json({ signedUrl, objectName, ttlSec, sizeBytes: f.size, mimeType: f.mimetype });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "upload-public-asset failed");
    res.status(500).json({ error: err?.message || "upload failed" });
  }
});

// ─── RUNWAY DIRECT IMAGE GENERATION (sin pasar por Replicate) ──────────────
// POST /fs-pro/runway-image
// Body: { projectId, prompt, ratio?, model?, referenceImageUrl?, seed? }
// Genera una imagen llamando directamente a la API de Runway (gen4_image[_turbo])
// y la guarda en el vault del proyecto. Útil cuando la cuenta Replicate está
// sin saldo pero RUNWAY_API_KEY sí tiene crédito disponible.
router.post("/fs-pro/runway-image", requireAdmin, upload.single("referenceImage"), async (req, res) => {
  enableLongRunning(res);
  try {
    const f = req.file;
    const { projectId: pidRaw, prompt, ratio, model, referenceImageUrl, seed: seedRaw, referenceTag } = req.body as {
      projectId: number | string;
      prompt: string;
      ratio?: "1920:1080" | "1080:1920" | "1024:1024" | "1360:768" | "1080:1080" | "1168:880" | "1440:1080" | "1080:1440" | "1808:768" | "2112:912";
      model?: "gen4_image" | "gen4_image_turbo";
      referenceImageUrl?: string;
      seed?: number | string;
      referenceTag?: string;
    };
    const projectId = typeof pidRaw === "string" ? parseInt(pidRaw, 10) : pidRaw;
    const seed = seedRaw != null && seedRaw !== "" ? (typeof seedRaw === "string" ? parseInt(seedRaw, 10) : seedRaw) : undefined;
    if (!projectId || !prompt) { res.status(400).json({ error: "projectId, prompt requeridos" }); return; }

    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    // Build reference images: file upload (→ dataURI) or referenceImageUrl
    const referenceImages: Array<{ uri: string; tag?: string }> = [];
    if (f) {
      const dataUri = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
      referenceImages.push({ uri: dataUri, ...(referenceTag ? { tag: referenceTag } : {}) });
    } else if (referenceImageUrl) {
      referenceImages.push({ uri: referenceImageUrl, ...(referenceTag ? { tag: referenceTag } : {}) });
    }

    const { generateImageWithReferences, fetchRunwayImageBuffer } = await import("../lib/runway.js");
    const result = await generateImageWithReferences({
      promptText: prompt,
      ratio: ratio ?? "1080:1080",
      model: model ?? "gen4_image_turbo",
      referenceImages,
      seed: typeof seed === "number" && !isNaN(seed) ? seed : undefined,
    });

    const { buffer, mimeType } = await fetchRunwayImageBuffer(result.imageUrl);
    const vaultId = await saveToVaultSmart({
      projectId,
      fileType: "fs-pro-image",
      category: "fusion-studio-pro",
      title: `FS Pro Runway: ${prompt.slice(0, 60)}`,
      mimeType,
      generatedBy: `fs-pro:runway:${result.model}`,
      buffer,
    });
    await recordUsage(projectId, "image", 1);

    res.json({
      success: true,
      vaultId,
      model: result.model,
      cost: result.cost,
      runwayImageUrl: result.imageUrl,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    logger.error({ err }, "fs-pro runway-image failed");
    res.status(500).json({ error: err?.message || "Error generando imagen Runway" });
  }
});

router.post("/fs-pro/cost-estimate", requireAdmin, async (req, res) => {
  try {
    const { budget, shots } = req.body as { budget: CampaignBudget; shots: ShotRequest[] };
    if (!budget || !Array.isArray(shots) || shots.length === 0) {
      res.status(400).json({ error: "budget + shots[] requeridos" }); return;
    }
    const estimate = planCampaign(budget, shots);
    res.json({ success: true, estimate });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error en cost-estimate" });
  }
});

// ─── DOWNLOAD ALL ASSETS AS ZIP ───────────────────────────────────────────
router.post("/fs-pro/download-all", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, vaultIds } = req.body as { projectId: number; vaultIds: number[] };
    if (!projectId || !Array.isArray(vaultIds) || vaultIds.length === 0) {
      res.status(400).json({ error: "projectId + vaultIds[] requeridos" }); return;
    }
    const files = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.projectId, projectId), inArray(projectFilesTable.id, vaultIds)),
    );
    if (files.length === 0) { res.status(404).json({ error: "No se encontraron archivos" }); return; }

    // Helper that reads vault content from URL, objectStorage, or content base64
    const readVaultBuf = async (file: any): Promise<Buffer | undefined> => {
      if (file.originalUrl?.startsWith("http")) {
        try { return await fetchToBuffer(file.originalUrl); } catch {}
      }
      if (file.objectPath) {
        try {
          const { ObjectStorageService } = await import("../lib/objectStorage.js");
          const svc = new ObjectStorageService();
          const gcsFile = await svc.getObjectEntityFile(file.objectPath);
          const resp = await svc.downloadObject(gcsFile);
          return Buffer.from(await resp.arrayBuffer());
        } catch (err) {
          logger.warn({ err, fileId: file.id }, "fs-pro download-all: objectStorage read failed");
        }
      }
      if (file.content) {
        try { return Buffer.from(file.content, "base64"); } catch {}
      }
      return undefined;
    };

    const buffers: Array<{ name: string; buffer: Buffer }> = [];
    for (const f of files) {
      const buf = await readVaultBuf(f);
      if (!buf) {
        logger.warn({ fileId: f.id }, "fs-pro: skipping file in zip — could not read content");
        continue;
      }
      const ext = (f.mimeType || "").split("/")[1] || "bin";
      const safeTitle = (f.title || `file-${f.id}`).replace(/[^a-z0-9-_]/gi, "_").slice(0, 50);
      buffers.push({ name: `${safeTitle}.${ext}`, buffer: buf });
    }
    if (buffers.length === 0) { res.status(500).json({ error: "No se pudo descargar ningún archivo" }); return; }

    const zipBuf = await packAssetsAsZip(buffers);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="fusion-studio-assets-${Date.now()}.zip"`);
    res.send(zipBuf);
  } catch (err: any) {
    logger.error({ err }, "fs-pro download-all failed");
    res.status(500).json({ error: err?.message || "Error preparando ZIP" });
  }
});

// ─── LIP-SYNC (video ↔ audio) ─────────────────────────────────────────────
// POST /fs-pro/lip-sync
// Body: { projectId, videoVaultId, audioVaultId }
// Reads both buffers from vault, runs Replicate lip-sync, saves result.
router.post("/fs-pro/lip-sync", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, videoVaultId, audioVaultId } = req.body as {
      projectId: number; videoVaultId: number; audioVaultId: number;
    };
    if (!projectId || !videoVaultId || !audioVaultId) {
      res.status(400).json({ error: "projectId, videoVaultId, audioVaultId requeridos" });
      return;
    }
    const VIDEO_CREDITS = 4;
    const limit = await checkProductionLimit(projectId, "image", VIDEO_CREDITS);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const rows = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.projectId, projectId), inArray(projectFilesTable.id, [videoVaultId, audioVaultId])),
    );
    const map = new Map(rows.map(r => [r.id, r]));
    const videoBuf = await readVaultContent(map.get(videoVaultId));
    const audioBuf = await readVaultContent(map.get(audioVaultId));
    if (!videoBuf) { res.status(404).json({ error: "Video vault no se pudo leer" }); return; }
    if (!audioBuf) { res.status(404).json({ error: "Audio vault no se pudo leer" }); return; }

    const out = await lipSyncVideoToAudio(videoBuf, audioBuf, {
      replicateToken: getProjectReplicateToken(project),
    });

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-lipsync", category: "fusion-studio-pro",
      title: `FS Pro Lip-sync: ${videoVaultId} ↔ ${audioVaultId}`,
      mimeType: "video/mp4", generatedBy: "fs-pro:replicate-lipsync",
      buffer: out,
    });
    await recordUsage(projectId, "image", VIDEO_CREDITS);
    res.json({ success: true, vaultId, sizeBytes: out.length });
  } catch (err: any) {
    logger.error({ err }, "fs-pro lip-sync failed");
    res.status(500).json({ error: err?.message || "Error en lip-sync" });
  }
});

// ─── TRANSCRIBE AUDIO → SRT ───────────────────────────────────────────────
// POST /fs-pro/transcribe
// Body: { projectId, audioVaultId, language? }
router.post("/fs-pro/transcribe", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, audioVaultId, language } = req.body as {
      projectId: number; audioVaultId: number; language?: string;
    };
    if (!projectId || !audioVaultId) {
      res.status(400).json({ error: "projectId, audioVaultId requeridos" });
      return;
    }
    const limit = await checkProductionLimit(projectId, "image", 1);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const [row] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.id, audioVaultId)),
    );
    const audioBuf = await readVaultContent(row);
    if (!audioBuf) { res.status(404).json({ error: "Audio vault no se pudo leer" }); return; }

    const { srt, segments, language: detected } = await transcribeAudioToSrt(audioBuf, {
      language: language || "auto",
      replicateToken: getProjectReplicateToken(project),
      audioMime: row?.mimeType || "audio/mpeg",
    });

    // Persist SRT itself to vault as text/plain so it can be reused
    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-srt", category: "fusion-studio-pro",
      title: `FS Pro SRT: audio ${audioVaultId} (${detected || "auto"})`,
      mimeType: "text/plain", generatedBy: "fs-pro:whisper",
      buffer: Buffer.from(srt, "utf-8"),
    });
    await recordUsage(projectId, "image", 1);
    res.json({ success: true, vaultId, srt, segments, language: detected });
  } catch (err: any) {
    logger.error({ err }, "fs-pro transcribe failed");
    res.status(500).json({ error: err?.message || "Error transcribiendo" });
  }
});

// ─── BURN SUBTITLES INTO VIDEO ────────────────────────────────────────────
// POST /fs-pro/burn-subs
// Body: { projectId, videoVaultId, srt?, srtVaultId?, language?, style? }
// Provide either SRT inline OR an existing SRT vault id, OR omit both to
// auto-transcribe the video's audio with Whisper first.
router.post("/fs-pro/burn-subs", requireAdmin, async (req, res) => {
  enableLongRunning(res);
  try {
    const { projectId, videoVaultId, srt, srtVaultId, language, style } = req.body as {
      projectId: number; videoVaultId: number; srt?: string; srtVaultId?: number;
      language?: string;
      style?: {
        fontName?: string; fontSizePx?: number; primaryColorHex?: string;
        outlineColorHex?: string; outlinePx?: number; alignment?: number; marginVPx?: number;
      };
    };
    if (!projectId || !videoVaultId) {
      res.status(400).json({ error: "projectId, videoVaultId requeridos" });
      return;
    }
    const VIDEO_CREDITS = 2;
    const limit = await checkProductionLimit(projectId, "image", VIDEO_CREDITS);
    if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const ids = [videoVaultId, ...(srtVaultId ? [srtVaultId] : [])];
    const rows = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.projectId, projectId), inArray(projectFilesTable.id, ids)),
    );
    const map = new Map(rows.map(r => [r.id, r]));
    const videoBuf = await readVaultContent(map.get(videoVaultId));
    if (!videoBuf) { res.status(404).json({ error: "Video vault no se pudo leer" }); return; }

    let srtText = (srt || "").trim();
    if (!srtText && srtVaultId) {
      const srtBuf = await readVaultContent(map.get(srtVaultId));
      if (!srtBuf) { res.status(404).json({ error: "SRT vault no se pudo leer" }); return; }
      srtText = srtBuf.toString("utf-8").trim();
    }
    if (!srtText) {
      // Auto-transcribe the video's own audio
      const { extractAudioMp3 } = await import("../lib/fusion-studio-pro.js");
      const audioBuf = await extractAudioMp3(videoBuf);
      const tx = await transcribeAudioToSrt(audioBuf, {
        language: language || "auto",
        replicateToken: getProjectReplicateToken(project),
        audioMime: "audio/mpeg",
      });
      srtText = tx.srt;
    }
    if (!srtText.trim()) {
      res.status(422).json({ error: "No se pudo obtener SRT (audio sin habla detectable)" });
      return;
    }

    const out = await burnSubtitlesIntoVideo(videoBuf, srtText, (style || {}) as any);

    const vaultId = await saveToVaultSmart({
      projectId, fileType: "fs-pro-subbed", category: "fusion-studio-pro",
      title: `FS Pro Subs: video ${videoVaultId}`,
      mimeType: "video/mp4", generatedBy: "fs-pro:ffmpeg-subs",
      buffer: out,
    });
    await recordUsage(projectId, "image", VIDEO_CREDITS);
    res.json({ success: true, vaultId, sizeBytes: out.length });
  } catch (err: any) {
    logger.error({ err }, "fs-pro burn-subs failed");
    res.status(500).json({ error: err?.message || "Error quemando subtítulos" });
  }
});

// ─── MOTION TRANSFER (anima imagen con un video referencia) ───────────────
// POST /fs-pro/motion-transfer
// Body: { projectId, refVideoVaultId, imageVaultId } OR multipart with files
router.post(
  "/fs-pro/motion-transfer",
  requireAdmin,
  upload.fields([{ name: "image", maxCount: 1 }, { name: "refVideo", maxCount: 1 }]),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const imgFile = files?.["image"]?.[0];
      const refFile = files?.["refVideo"]?.[0];
      const { projectId: pidStr, refVideoVaultId, imageVaultId } = req.body;
      const projectId = parseInt(pidStr || "0", 10);
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }

      const VIDEO_CREDITS = 6;
      const limit = await checkProductionLimit(projectId, "image", VIDEO_CREDITS);
      if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      // Resolve image
      let imgBuf: Buffer | undefined;
      let imgMime = "image/png";
      if (imgFile) { imgBuf = imgFile.buffer; imgMime = imgFile.mimetype; }
      else if (imageVaultId) {
        const [row] = await db.select().from(projectFilesTable).where(
          and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.id, parseInt(imageVaultId, 10))),
        );
        imgBuf = await readVaultContent(row);
        if (row?.mimeType) imgMime = row.mimeType;
      }
      if (!imgBuf) { res.status(400).json({ error: "Imagen requerida (file o imageVaultId)" }); return; }

      // Resolve ref video
      let refBuf: Buffer | undefined;
      if (refFile) { refBuf = refFile.buffer; }
      else if (refVideoVaultId) {
        const [row] = await db.select().from(projectFilesTable).where(
          and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.id, parseInt(refVideoVaultId, 10))),
        );
        refBuf = await readVaultContent(row);
      }
      if (!refBuf) { res.status(400).json({ error: "Video referencia requerido (file o refVideoVaultId)" }); return; }

      const out = await transferMotionToImage(imgBuf, refBuf, {
        replicateToken: getProjectReplicateToken(project),
        imageMime: imgMime,
      });

      const vaultId = await saveToVaultSmart({
        projectId, fileType: "fs-pro-motion", category: "fusion-studio-pro",
        title: `FS Pro Motion Transfer`,
        mimeType: "video/mp4", generatedBy: "fs-pro:replicate-champ",
        buffer: out,
      });
      await recordUsage(projectId, "image", VIDEO_CREDITS);
      res.json({ success: true, vaultId, sizeBytes: out.length });
    } catch (err: any) {
      logger.error({ err }, "fs-pro motion-transfer failed");
      res.status(500).json({ error: err?.message || "Error en motion transfer" });
    }
  },
);

// ─── CINEMATIC MULTI-SHOT (Pollo Seedance 2.0 style) ─────────────────────
// POST /fs-pro/cinematic-multishot
// multipart: product (image file) + JSON fields (projectId, brand, productName,
//   scenesCount, totalDurationSec, aspect, videoModel, style, narration?, music?)
router.post(
  "/fs-pro/cinematic-multishot",
  requireAdmin,
  upload.single("product"),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const f = req.file;
      const {
        projectId: pidStr, brand, productName, niche, audience, language,
        scenesCount: scStr, totalDurationSec: durStr, aspect, videoModel,
        imageModel, style, customBrief, narrationEnabled, narrationVoiceId,
        narrationVoiceModel, narrationVolume, musicEnabled, musicPrompt,
        musicVolume, productVaultId,
        savedPromptId, script: scriptJsonStr,
      } = req.body;
      const projectId = parseInt(pidStr || "0", 10);
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
      if (!brand || !productName) { res.status(400).json({ error: "brand y productName requeridos" }); return; }
      if (!videoModel) { res.status(400).json({ error: "videoModel requerido" }); return; }

      const scenesCount = parseInt(scStr || "4", 10);
      const totalDurationSec = parseInt(durStr || "16", 10);

      // Cost: ~3 credits per scene (image + video + concat overhead) + 2 base
      const SCENE_CREDITS = Math.max(2, Math.min(8, scenesCount));
      const COST = 2 + SCENE_CREDITS * 3;
      const limit = await checkProductionLimit(projectId, "image", COST);
      if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      // Resolve product image
      let productImage: Buffer | undefined;
      let productMime = "image/png";
      if (f) { productImage = f.buffer; productMime = f.mimetype; }
      else if (productVaultId) {
        const [row] = await db.select().from(projectFilesTable).where(
          and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.id, parseInt(productVaultId, 10))),
        );
        productImage = await readVaultContent(row);
        if (row?.mimeType) productMime = row.mimeType;
      }
      if (!productImage) { res.status(400).json({ error: "Imagen de producto requerida (file o productVaultId)" }); return; }

      // Optional pre-rendered/edited script
      let presetScript: CinematicScript | undefined;
      if (scriptJsonStr) {
        try {
          presetScript = typeof scriptJsonStr === "string" ? JSON.parse(scriptJsonStr) : scriptJsonStr;
        } catch (err: any) {
          res.status(400).json({ error: `script JSON inválido: ${err?.message}` }); return;
        }
      }

      const result = await generateCinematicMultiShot({
        projectId,
        productImage,
        productMime,
        brand: String(brand),
        productName: String(productName),
        niche: niche ? String(niche) : (project.storeNiche || undefined),
        audience: audience ? String(audience) : undefined,
        language: language ? String(language) : "es",
        scenesCount,
        totalDurationSec,
        aspect: ((aspect as CinematicAspect) || "9:16"),
        videoModel,
        imageModel: imageModel || undefined,
        style: ((style as CinematicStyle) || "cinematic"),
        customBrief: customBrief ? String(customBrief) : undefined,
        narration: narrationEnabled === "true" || narrationEnabled === true ? {
          enabled: true,
          voiceId: narrationVoiceId ? String(narrationVoiceId) : undefined,
          voiceModel: narrationVoiceModel || undefined,
          voiceVolume: narrationVolume ? parseFloat(narrationVolume) : 1.0,
        } : undefined,
        music: musicEnabled === "true" || musicEnabled === true ? {
          enabled: true,
          prompt: musicPrompt ? String(musicPrompt) : undefined,
          volume: musicVolume ? parseFloat(musicVolume) : 0.22,
        } : undefined,
        presetScript,
        savedPromptId: savedPromptId ? String(savedPromptId) : undefined,
      });

      const vaultId = await saveToVaultSmart({
        projectId, fileType: "fs-pro-multishot", category: "fusion-studio-pro",
        title: `FS Pro MultiShot: ${productName}`,
        mimeType: result.finalMime, generatedBy: `fs-pro:multishot:${videoModel}`,
        buffer: result.finalVideo,
      });

      // Save script as a separate vault asset for traceability
      const scriptJson = JSON.stringify(result.script, null, 2);
      const scriptVaultId = await saveToVaultSmart({
        projectId, fileType: "fs-pro-script", category: "fusion-studio-pro",
        title: `FS Pro MultiShot Script: ${productName}`,
        mimeType: "application/json", generatedBy: "fs-pro:multishot:script",
        buffer: Buffer.from(scriptJson, "utf-8"),
      });

      await recordUsage(projectId, "image", COST);
      learnFromOperation({
        operationType: "fs_pro_cinematic_multishot",
        niche: project.storeNiche ?? null,
        title: `FS Pro multishot: ${productName} (${result.script.scenes.length} shots)`,
        content: `Style ${style || "cinematic"} · ${totalDurationSec}s · ${videoModel}. Title: ${result.script.title}`,
        confidence: 0.9, tags: ["fusion-studio-pro", "multishot", videoModel, String(style || "cinematic")],
      });

      res.json({
        success: true,
        vaultId,
        scriptVaultId,
        sizeBytes: result.finalVideo.length,
        durationSec: result.durationSec,
        scenesCount: result.script.scenes.length,
        script: result.script,
        savedPromptId: result.savedPromptId || null,
      });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "fs-pro cinematic-multishot failed");
      res.status(500).json({ error: err?.message || "Error generando multi-shot cinematográfico" });
    }
  },
);

// ─── CINEMATIC PROMPT LIBRARY ────────────────────────────────────────────
// POST /fs-pro/cinematic-script (JSON body — no multipart)
//   Generates ONLY the script via Claude (no rendering) and persists it as a
//   reusable template in omnicore_prompt_library. Returns the script + savedPromptId.
router.post("/fs-pro/cinematic-script", requireAdmin, async (req, res) => {
  try {
    const {
      projectId: pidStr, brand, productName, niche, audience, language,
      scenesCount, totalDurationSec, aspect, videoModel, imageModel, style, customBrief,
      narration, music,
    } = req.body || {};
    const projectId = parseInt(String(pidStr || "0"), 10);
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
    if (!brand || !productName) { res.status(400).json({ error: "brand y productName requeridos" }); return; }
    if (!videoModel) { res.status(400).json({ error: "videoModel requerido" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const reqObj = {
      projectId,
      brand: String(brand),
      productName: String(productName),
      niche: niche ? String(niche) : (project.storeNiche || undefined),
      audience: audience ? String(audience) : undefined,
      language: language ? String(language) : "es",
      scenesCount: parseInt(String(scenesCount || 4), 10),
      totalDurationSec: parseInt(String(totalDurationSec || 16), 10),
      aspect: ((aspect as CinematicAspect) || "9:16") as CinematicAspect,
      videoModel: String(videoModel) as any,
      imageModel: imageModel || undefined,
      style: ((style as CinematicStyle) || "cinematic") as CinematicStyle,
      customBrief: customBrief ? String(customBrief) : undefined,
      narration: narration && (narration.enabled === true || narration.enabled === "true") ? {
        enabled: true,
        voiceId: narration.voiceId ? String(narration.voiceId) : undefined,
        voiceModel: narration.voiceModel || undefined,
        voiceVolume: narration.voiceVolume != null ? parseFloat(String(narration.voiceVolume)) : 1.0,
      } : undefined,
      music: music && (music.enabled === true || music.enabled === "true") ? {
        enabled: true,
        prompt: music.prompt ? String(music.prompt) : undefined,
        volume: music.volume != null ? parseFloat(String(music.volume)) : 0.22,
      } : undefined,
    };

    const script = await generateCinematicScript(reqObj);
    const savedPromptId = await persistCinematicScript({ script, config: reqObj, source: "draft" });
    res.json({ success: true, savedPromptId, script });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "fs-pro cinematic-script failed");
    res.status(500).json({ error: err?.message || "Error generando script cinemático" });
  }
});

// GET /fs-pro/cinematic-prompts?projectId&niche&limit
router.get("/fs-pro/cinematic-prompts", requireAdmin, async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(String(req.query.projectId), 10) : undefined;
    const niche = req.query.niche ? String(req.query.niche) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const items = await listCinematicScripts({ projectId, niche, limit });
    res.json({ success: true, items });
  } catch (err: any) {
    logger.error({ err: err?.message }, "list cinematic-prompts failed");
    res.status(500).json({ error: err?.message || "Error listando plantillas" });
  }
});

// GET /fs-pro/cinematic-prompts/:id
router.get("/fs-pro/cinematic-prompts/:id", requireAdmin, async (req, res) => {
  try {
    const loaded = await loadCinematicScript(String(req.params.id));
    if (!loaded) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    res.json({ success: true, id: String(req.params.id), ...loaded });
  } catch (err: any) {
    logger.error({ err: err?.message }, "get cinematic-prompt failed");
    res.status(500).json({ error: err?.message || "Error cargando plantilla" });
  }
});

// DELETE /fs-pro/cinematic-prompts/:id
router.delete("/fs-pro/cinematic-prompts/:id", requireAdmin, async (req, res) => {
  try {
    const ok = await deleteCinematicScript(String(req.params.id));
    if (!ok) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "delete cinematic-prompt failed");
    res.status(500).json({ error: err?.message || "Error borrando plantilla" });
  }
});

// PUT /fs-pro/cinematic-prompts/:id  — persist EXACT edited script (no Claude)
router.put("/fs-pro/cinematic-prompts/:id", requireAdmin, async (req, res) => {
  try {
    const { script, name, description } = req.body || {};
    if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) {
      res.status(400).json({ error: "script con scenes[] requerido" }); return;
    }
    const ok = await updateCinematicScript(String(req.params.id), {
      script: script as CinematicScript,
      name: name ? String(name) : undefined,
      description: description ? String(description) : undefined,
    });
    if (!ok) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    res.json({ success: true, id: String(req.params.id) });
  } catch (err: any) {
    logger.error({ err: err?.message }, "update cinematic-prompt failed");
    res.status(500).json({ error: err?.message || "Error actualizando plantilla" });
  }
});

// POST /fs-pro/cinematic-prompts/:id/favorite (toggle)
router.post("/fs-pro/cinematic-prompts/:id/favorite", requireAdmin, async (req, res) => {
  try {
    const updated = await toggleCinematicScriptFavorite(String(req.params.id));
    if (!updated) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    res.json({ success: true, ...updated });
  } catch (err: any) {
    logger.error({ err: err?.message }, "toggle favorite cinematic-prompt failed");
    res.status(500).json({ error: err?.message || "Error toggling favorito" });
  }
});

// ─── AVATAR STUDIO: LIBRARY ──────────────────────────────────────────────
router.get("/fs-pro/avatars/library", requireAdmin, (_req, res) => {
  res.json({
    library: AVATAR_LIBRARY,
    grouped: listAvatarsByNiche(),
  });
});

// ─── AVATAR STUDIO: TALKING AVATAR ───────────────────────────────────────
// POST /fs-pro/avatar/talking
// multipart: customAvatar? (image) + JSON fields
router.post(
  "/fs-pro/avatar/talking",
  requireAdmin,
  upload.single("customAvatar"),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const f = req.file;
      const {
        projectId: pidStr, avatarId, script, voiceId, voiceModel,
        language, aspect, imageModel, videoModel, applyLipSync,
      } = req.body;
      const projectId = parseInt(pidStr || "0", 10);
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
      if (!script) { res.status(400).json({ error: "script requerido" }); return; }
      if (!avatarId && !f) { res.status(400).json({ error: "avatarId o customAvatar requerido" }); return; }

      // Cost: image gen (1) + video gen (5) + voice (1) + lipsync (3) ~= 10
      const COST = 10;
      const limit = await checkProductionLimit(projectId, "image", COST);
      if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      const result = await generateTalkingAvatar({
        projectId,
        avatarId: avatarId ? String(avatarId) : undefined,
        customAvatarBuffer: f?.buffer,
        customAvatarMime: f?.mimetype,
        script: String(script),
        voiceId: voiceId ? String(voiceId) : undefined,
        voiceModel: voiceModel || undefined,
        language: language ? String(language) : undefined,
        aspect: aspect || "9:16",
        imageModel: imageModel || undefined,
        videoModel: videoModel || undefined,
        applyLipSync: applyLipSync === undefined
          ? true
          : !(applyLipSync === "false" || applyLipSync === false || applyLipSync === "0" || applyLipSync === 0),
      });

      const vaultId = await saveToVaultSmart({
        projectId, fileType: "fs-pro-avatar", category: "fusion-studio-pro",
        title: `FS Pro Talking Avatar${avatarId ? `: ${avatarId}` : ""}`,
        mimeType: result.finalMime, generatedBy: "fs-pro:avatar:talking",
        buffer: result.finalVideo,
      });

      await recordUsage(projectId, "image", COST);
      res.json({
        success: true,
        vaultId,
        sizeBytes: result.finalVideo.length,
        durationSec: result.durationSec,
        avatar: result.avatar,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, "fs-pro avatar/talking failed");
      res.status(500).json({ error: err?.message || "Error generando talking avatar" });
    }
  },
);

// ─── AVATAR STUDIO: PRODUCT AVATAR ───────────────────────────────────────
// POST /fs-pro/avatar/product
// multipart: product (image required) + customPresenter? (image)
router.post(
  "/fs-pro/avatar/product",
  requireAdmin,
  upload.fields([
    { name: "product", maxCount: 1 },
    { name: "customPresenter", maxCount: 1 },
  ]),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const productFile = files?.["product"]?.[0];
      const presenterFile = files?.["customPresenter"]?.[0];
      const {
        projectId: pidStr, avatarId, script, voiceId, voiceModel,
        language, aspect, imageModel, videoModel, applyLipSync, productVaultId,
      } = req.body;
      const projectId = parseInt(pidStr || "0", 10);
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
      if (!script) { res.status(400).json({ error: "script requerido" }); return; }
      if (!avatarId && !presenterFile) { res.status(400).json({ error: "avatarId o customPresenter requerido" }); return; }

      const COST = 11;
      const limit = await checkProductionLimit(projectId, "image", COST);
      if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      // Resolve product image
      let productImage: Buffer | undefined;
      let productMime = "image/png";
      if (productFile) { productImage = productFile.buffer; productMime = productFile.mimetype; }
      else if (productVaultId) {
        const [row] = await db.select().from(projectFilesTable).where(
          and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.id, parseInt(productVaultId, 10))),
        );
        productImage = await readVaultContent(row);
        if (row?.mimeType) productMime = row.mimeType;
      }
      if (!productImage) { res.status(400).json({ error: "Imagen de producto requerida" }); return; }

      const result = await generateProductAvatar({
        projectId,
        productImage,
        productMime,
        avatarId: avatarId ? String(avatarId) : undefined,
        customPresenterBuffer: presenterFile?.buffer,
        customPresenterMime: presenterFile?.mimetype,
        script: String(script),
        voiceId: voiceId ? String(voiceId) : undefined,
        voiceModel: voiceModel || undefined,
        language: language ? String(language) : undefined,
        aspect: aspect || "9:16",
        imageModel: imageModel || undefined,
        videoModel: videoModel || undefined,
        applyLipSync: applyLipSync === undefined
          ? true
          : !(applyLipSync === "false" || applyLipSync === false || applyLipSync === "0" || applyLipSync === 0),
      });

      const vaultId = await saveToVaultSmart({
        projectId, fileType: "fs-pro-avatar", category: "fusion-studio-pro",
        title: `FS Pro Product Avatar`,
        mimeType: result.finalMime, generatedBy: "fs-pro:avatar:product",
        buffer: result.finalVideo,
      });

      await recordUsage(projectId, "image", COST);
      res.json({
        success: true,
        vaultId,
        sizeBytes: result.finalVideo.length,
        durationSec: result.durationSec,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, "fs-pro avatar/product failed");
      res.status(500).json({ error: err?.message || "Error generando product avatar" });
    }
  },
);

// ─── AVATAR STUDIO: MIMIC MOTION ─────────────────────────────────────────
// POST /fs-pro/avatar/mimic-motion
// multipart: target (image) + JSON: sourceVideoUrl
router.post(
  "/fs-pro/avatar/mimic-motion",
  requireAdmin,
  upload.single("target"),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const f = req.file;
      const { projectId: pidStr, sourceVideoUrl, targetVaultId } = req.body;
      const projectId = parseInt(pidStr || "0", 10);
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
      if (!sourceVideoUrl) { res.status(400).json({ error: "sourceVideoUrl requerido" }); return; }
      if (!f && !targetVaultId) { res.status(400).json({ error: "target image (file o targetVaultId) requerido" }); return; }

      const COST = 6;
      const limit = await checkProductionLimit(projectId, "image", COST);
      if (!limit.allowed) { res.status(402).json({ error: limit.reason }); return; }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      let targetImage: Buffer | undefined;
      let targetMime = "image/png";
      if (f) { targetImage = f.buffer; targetMime = f.mimetype; }
      else if (targetVaultId) {
        const [row] = await db.select().from(projectFilesTable).where(
          and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.id, parseInt(targetVaultId, 10))),
        );
        targetImage = await readVaultContent(row);
        if (row?.mimeType) targetMime = row.mimeType;
      }
      if (!targetImage) { res.status(400).json({ error: "Imagen target no encontrada" }); return; }

      const result = await generateMimicMotion({
        projectId,
        sourceVideoUrl: String(sourceVideoUrl),
        targetImage,
        targetMime,
      });

      const vaultId = await saveToVaultSmart({
        projectId, fileType: "fs-pro-mimic", category: "fusion-studio-pro",
        title: `FS Pro Mimic Motion`,
        mimeType: result.finalMime, generatedBy: "fs-pro:avatar:mimic",
        buffer: result.finalVideo,
      });
      await recordUsage(projectId, "image", COST);
      res.json({ success: true, vaultId, sizeBytes: result.finalVideo.length });
    } catch (err: any) {
      logger.error({ err: err?.message }, "fs-pro avatar/mimic failed");
      res.status(500).json({ error: err?.message || "Error en mimic motion" });
    }
  },
);

// Shared helper: read vault content from URL → objectStorage → base64 content
export async function readVaultContent(file: any): Promise<Buffer | undefined> {
  if (!file) return undefined;
  if (file.originalUrl?.startsWith("http")) {
    try { return await fetchToBuffer(file.originalUrl); } catch { /* fallthrough */ }
  }
  if (file.objectPath) {
    try {
      const svc = getStorage();
      const gcsFile = await svc.getObjectEntityFile(file.objectPath);
      const resp = await svc.downloadObject(gcsFile);
      return Buffer.from(await resp.arrayBuffer());
    } catch (err) {
      logger.warn({ err, fileId: file.id }, "fs-pro readVaultContent: objectStorage read failed");
    }
  }
  if (file.content) {
    try { return Buffer.from(file.content, "base64"); } catch { /* */ }
  }
  return undefined;
}

export default router;
