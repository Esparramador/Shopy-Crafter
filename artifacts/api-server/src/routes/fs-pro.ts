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
import { ObjectStorageService } from "../lib/objectStorage.js";
import { checkTtsQuota } from "./voice.js";
import {
  IMAGE_MODELS, VIDEO_MODELS,
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
import { listTemplates } from "../lib/ad-templates.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// ─── HELPERS ───────────────────────────────────────────────────────────────

let _storage: ObjectStorageService | null = null;
function getStorage(): ObjectStorageService {
  if (!_storage) _storage = new ObjectStorageService();
  return _storage;
}

// Smart vault save: uploads large files to Object Storage instead of inline base64.
// Files >2MB (raw bytes, ~2.7MB base64) → Object Storage; smaller → content field.
// Keeps things efficient and avoids the 50MB Express body limit on subsequent reads.
// Throws on failure so caller's try/catch handles the response (no silent null).
async function saveToVaultSmart(params: {
  projectId: number;
  fileType: string;
  category: string;
  title: string;
  mimeType: string;
  generatedBy: string;
  buffer: Buffer;
}): Promise<number> {
  const RAW_THRESHOLD = 2 * 1024 * 1024; // 2MB raw

  if (params.buffer.length > RAW_THRESHOLD) {
    // Upload to Object Storage
    const safeTitle = params.title.replace(/[^a-z0-9-_]/gi, "_").slice(0, 50);
    const ext = params.mimeType.split("/")[1] || "bin";
    const objectPath = `projects/${params.projectId}/${params.fileType}/${safeTitle}_${Date.now()}.${ext}`;
    try {
      const gcsFile = await getStorage().getObjectEntityFile(objectPath);
      await getStorage().uploadObject(gcsFile, params.buffer, params.mimeType);
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
      return vaultId;
    } catch (err) {
      logger.warn({ err, fileType: params.fileType }, "fs-pro: object storage upload failed, falling back to base64 content");
      // Fall through to content base64
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
    imageEdit: [
      { key: "nano-banana", label: "Nano Banana (Gemini)", description: "Edición rápida con instrucciones de texto, mantiene la marca" },
      { key: "flux-kontext-pro", label: "Flux Kontext Pro", description: "Edición consistente, mantiene personajes/estilo" },
      { key: "gen4-image-edit", label: "Runway Gen-4 Image", description: "Image edit con referencias estilo Runway" },
    ],
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
  });
});

function prettyLabel(key: string): string {
  return key.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join(" ");
}

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
      replicateToken: (project as any).replicateApiKey || undefined,
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
      aspectRatio, replicateToken: (project as any).replicateApiKey || undefined,
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

    const out = await removeBackground(buf, mime, (project as any).replicateApiKey || undefined);
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

    const out = await replaceBackground(buf, mime, scenePrompt, (project as any).replicateApiKey || undefined);
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
    if (mode === "clarity") out = await clarityUpscale(buf, mime, prompt || "high detail photograph", sc, (project as any).replicateApiKey || undefined);
    else if (mode === "faces") out = await enhanceFaces(buf, mime, (project as any).replicateApiKey || undefined);
    else out = await upscaleImage(buf, mime, sc, (project as any).replicateApiKey || undefined);

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

    let buf: Buffer; let mime: string;
    if (f) { buf = f.buffer; mime = f.mimetype; }
    else if (sourceImageUrl) { buf = await fetchToBuffer(sourceImageUrl); mime = "image/png"; }
    else { res.status(400).json({ error: "Imagen origen requerida" }); return; }

    const out = await generateVideoFromImage(model as VideoModel, buf, mime, prompt, {
      duration: parseInt(duration || "5"),
      aspect: aspect || "9:16",
      replicateToken: (project as any).replicateApiKey || undefined,
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

    const buf = await generateMusic(prompt, parseInt(duration || "30"), (project as any).replicateApiKey || undefined);
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
      replicateToken: (project as any).replicateApiKey || undefined,
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
      replicateToken: (project as any).replicateApiKey || undefined,
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
        replicateToken: (project as any).replicateApiKey || undefined,
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
        replicateToken: (project as any).replicateApiKey || undefined,
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

// Shared helper: read vault content from URL → objectStorage → base64 content
async function readVaultContent(file: any): Promise<Buffer | undefined> {
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
