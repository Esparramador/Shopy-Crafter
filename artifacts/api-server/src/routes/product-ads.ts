/**
 * Product Ads Smart Routes — anuncios profesionales auto-generados desde el
 * catálogo Shopify del proyecto.
 *
 * Endpoints (todos requieren auth admin):
 *   POST /projects/:projectId/products/:productId/ads/smart-quick
 *        → AdStudio campaign (hero + voz + video corto, 1 variante)
 *   POST /projects/:projectId/products/:productId/ads/smart-cinematic
 *        → MultiShot cinemático (4-6 escenas + voz + música, premium)
 *   POST /projects/:projectId/products/:productId/videos/tryon-video
 *        → Virtual try-on en VIDEO con efectos cinematográficos
 *
 * Coherencia voz↔personaje: el género de la voz seleccionada se propaga
 * automáticamente al `characterGender` del try-on cuando se solicitan juntos.
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db, projectsTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { persistAdVideoToVault } from "../lib/ad-video-persistence.js";
import { readFile } from "node:fs/promises";
import { logger } from "../lib/logger.js";
import { enableLongRunning } from "../lib/long-running.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { requireAdmin } from "../lib/auth.js";
import { runAdCampaign, type AdCampaignInput } from "../lib/adstudio.js";
import { resolveAdVideoProvider, effectiveDuration, adCredits, creditsForUsd } from "../lib/ad-video-providers.js";
import { IMAGE_UNIT_COST_EUR } from "../lib/ai-budget.js";
import { recommendVoiceForProduct, type VoiceLanguage, type VoiceGenderPref } from "../lib/voice-recommender.js";
import {
  generateTryonVideo, type TryonProvider, type EffectStyle, type CharacterGender,
} from "../lib/video-tryon.js";
import { learnFromOperation } from "../lib/claude.js";
import {
  fetchToBuffer, generateTTS, composeAd, lipSyncVideoToAudio, VIDEO_MODELS, type VideoModel,
} from "../lib/fusion-studio-pro.js";
import { generateCinematicMultiShot, type CinematicAspect, type CinematicStyle } from "../lib/cinematic-multishot.js";
import { askClaudeJsonWithBrain } from "../lib/claude.js";
import { loadCharacter, buildIdentityLockPrompt } from "../lib/character-loader.js";
import { uploadRejected } from "../lib/upload-errors.js";
import {
  createProductAdJob,
  getLatestProductAdJob,
  getProductAdJob,
  updateProductAdJob,
} from "../lib/product-ad-jobs.js";

const router = Router();

const tryonVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(uploadRejected(`Tipo de imagen no permitido: ${file.mimetype}`) as any, false);
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────
async function loadProjectAndProduct(projectId: number, shopifyProductId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  return { project, product };
}

function getFirstProductImageUrl(product: any): string | null {
  const j = product?.imagesJson;
  if (Array.isArray(j) && j.length > 0) return j[0]?.src || j[0]?.url || null;
  const legacy: any = product?.images;
  if (Array.isArray(legacy) && legacy.length > 0) return legacy[0]?.src || legacy[0]?.url || null;
  if (typeof legacy === "string" && legacy.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(legacy);
      if (Array.isArray(arr) && arr.length > 0) return arr[0]?.src || arr[0]?.url || null;
    } catch { /* ignore */ }
  }
  return product?.featuredImage || null;
}

function stripHtml(s: string | null | undefined): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function respondWithUnstoredAdVideo(
  req: Request,
  res: Response,
  video: Buffer,
  code: string,
  message: string,
): void {
  if (req.get("x-ad-recovery-mode") === "download" && video.length > 0) {
    res.status(503);
    res.setHeader("X-Ad-Recovery", "download");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'attachment; filename="ad-recovery.mp4"');
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(video.length));
    res.end(video);
    return;
  }

  res.status(503).json({
    success: false,
    vaultSaved: false,
    error: message,
    code,
  });
}

// ─── COMMON BODY ────────────────────────────────────────────────────────────
interface SmartAdBody {
  language?: VoiceLanguage;
  voiceGender?: VoiceGenderPref;
  voiceId?: string;                  // override voice picker
  characterGender?: CharacterGender; // for try-on coherence (auto-derived from voice)
  ctaText?: string;
  durationSec?: number;
  aspect?: "9:16" | "16:9" | "1:1" | "4:5";
  customNotes?: string;
  addMusic?: boolean;
}

function clampDuration(d: any, def: number, max = 60): number {
  const n = Number(d);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.max(3, Math.min(max, Math.floor(n)));
}

router.get(
  "/projects/:projectId/products/:productId/ads/jobs/latest",
  requireAdmin,
  async (req, res) => {
    const projectId = Number.parseInt(String(req.params.projectId), 10);
    const productId = String(req.params.productId);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "projectId no válido" });
      return;
    }
    const { project, product } = await loadProjectAndProduct(projectId, productId);
    if (!project || !product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    const job = await getLatestProductAdJob(projectId, product.shopifyProductId);
    res.json({ job });
  },
);

router.get(
  "/projects/:projectId/products/:productId/ads/jobs/:jobId",
  requireAdmin,
  async (req, res) => {
    const projectId = Number.parseInt(String(req.params.projectId), 10);
    const productId = String(req.params.productId);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "projectId no válido" });
      return;
    }
    const { project, product } = await loadProjectAndProduct(projectId, productId);
    if (!project || !product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
    const job = await getProductAdJob(String(req.params.jobId), projectId, product.shopifyProductId);
    if (!job) {
      res.status(404).json({ error: "Generación no encontrada" });
      return;
    }
    res.json({ job });
  },
);

// ════════════════════════════════════════════════════════════════════════════
// 1) SMART QUICK AD  — AdStudio hero+voz+video, 1 variante (rápido, ~$0.30)
// ════════════════════════════════════════════════════════════════════════════
router.post(
  "/projects/:projectId/products/:productId/ads/smart-quick",
  requireAdmin,
  async (req, res) => {
    enableLongRunning(res);
    let adJobId: string | null = null;
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const productIdParam = String(req.params.productId);
      const body = (req.body || {}) as SmartAdBody;

      const { project, product } = await loadProjectAndProduct(projectId, productIdParam);
      if (!project || !product) {
        res.status(404).json({ error: "Producto no encontrado" });
        return;
      }

      // Proveedor verificado: el pedido, o Runway Gen-4 Turbo si hay clave, o Hailuo 2.3 Fast.
      const quickProvider = resolveAdVideoProvider(
        (body as { videoProvider?: string }).videoProvider
          || (process.env.RUNWAY_API_KEY ? "runway-gen4-turbo" : "hailuo-2.3-fast"),
      );
      if (!quickProvider) {
        res.status(400).json({ error: "Proveedor de vídeo no disponible", code: "BAD_VIDEO_PROVIDER" });
        return;
      }

      const language: VoiceLanguage = body.language || "auto";
      const aspect = (body.aspect || "9:16") as AdCampaignInput["aspect"];
      // smart-quick: un solo clip → máximo 10 s.
      // For longer ads, the client must use /ads/smart-cinematic (multi-shot).
      // We tell the user explicitly instead of silently truncating their script
      // to fit a shorter video.
      const requestedDuration = clampDuration(body.durationSec, 6, 60);
      if (requestedDuration > 10) {
        res.status(400).json({
          error: `smart-quick está limitado a 10 segundos (un solo clip Runway). Para ${requestedDuration}s, usa /ads/smart-cinematic con scenesCount=${Math.ceil(requestedDuration / 5)}.`,
          code: "DURATION_TOO_LONG_FOR_QUICK",
          maxQuickDurationSec: 10,
          suggestedEndpoint: "/api/projects/:projectId/products/:productId/ads/smart-cinematic",
          suggestedBody: { totalDurationSec: requestedDuration, scenesCount: Math.ceil(requestedDuration / 5) },
        });
        return;
      }
      const durationSec = effectiveDuration(quickProvider, requestedDuration);
      // Créditos según el coste real del clip (vídeo + escena con la foto + voz/música).
      const quickCredits = adCredits(quickProvider, durationSec, IMAGE_UNIT_COST_EUR, { images: 1 });
      const limit = await checkProductionLimit(projectId, "image", quickCredits);
      if (!limit.allowed) {
        res.status(403).json({ error: limit.reason || "Límite de imágenes/vídeos del plan alcanzado", planLimit: true, creditsNeeded: quickCredits });
        return;
      }

      // 1) Voice recommendation (coherent with niche/product/language)
      const voice = await recommendVoiceForProduct({
        projectId,
        productTitle: product.title || "Producto",
        productDescription: stripHtml(product.bodyHtml).slice(0, 600),
        productType: product.productType || undefined,
        niche: project.storeNiche || undefined,
        language,
        genderPref: body.voiceGender || "auto",
        shortFormat: true,
      });
      const finalVoiceId = body.voiceId || voice.voiceId;

      // 2) Build AdStudio input (pre-fills with Shopify product)
      const sourceImageUrl = getFirstProductImageUrl(product) || undefined;
      const replicateToken = process.env.REPLICATE_API_TOKEN || "";

      const input: AdCampaignInput = {
        projectId,
        productTitle: product.title || "Producto",
        productCategory: product.productType || "general",
        brandName: project.name || undefined,
        brandTone: voice.tone,
        niche: project.storeNiche || undefined,
        objective: "conversion",
        targetAudience: undefined,
        aspect,
        videoProvider: quickProvider.key,
        videoDurationSec: durationSec,
        voiceId: finalVoiceId,
        voiceStability: voice.stability,
        voiceStyle: voice.style,
        addMusic: body.addMusic !== false,
        variantsCount: 1,
        // customPrompt is consumed by the COPY-WRITER (Claude) only; never
        // injected verbatim into the video model's prompt. We deliberately
        // keep CTA text and price OUT of the video prompt — they go ONLY
        // into the FFmpeg overlay (ctaOverlayText below) so the AI can't
        // render them as garbled hallucinated typography.
        customPrompt: [
          body.customNotes ? `Notas extra: ${body.customNotes.slice(0, 300)}` : "",
          `Idioma del voiceover: ${language === "auto" ? "español" : language}`,
          `Descripción producto (solo para guion / voz): ${stripHtml(product.bodyHtml).slice(0, 400)}`,
        ].filter(Boolean).join(". "),
        sourceImageUrl,
        // Producto real colocado en escena (sin alterarlo); sin foto, la IA lo inventa y se marca.
        heroMode: "scene",
        // Deterministic overlay (always-on by default in runAdCampaign)
        renderBrandOverlay: true,
        brandOverlayText: project.name || product.title || "",
        ctaOverlayText: body.ctaText || undefined,
      };

      const previousJob = await getLatestProductAdJob(projectId, product.shopifyProductId);
      if (
        previousJob?.status === "running" ||
        (previousJob?.status === "interrupted" && previousJob.providerTasks.length > 0)
      ) {
        res.status(409).json({
          error: previousJob.status === "running"
            ? "Ya hay un anuncio en curso para este producto. Puedes recuperar su estado en Auditoría."
            : "El proveedor ya aceptó una generación interrumpida. Revisa el estado en Auditoría antes de iniciar otro anuncio.",
          code: previousJob.status === "running" ? "AD_JOB_IN_PROGRESS" : "AD_JOB_INTERRUPTED",
          jobId: previousJob.id,
        });
        return;
      }
      const createdAdJob = await createProductAdJob({
        projectId,
        productId: product.shopifyProductId,
        kind: "smart-quick",
      });
      const adJob = createdAdJob.job;
      if (!createdAdJob.created) {
        res.status(409).json({
          error: "Ya hay un anuncio en curso para este producto. Puedes recuperar su estado en Auditoría.",
          code: "AD_JOB_IN_PROGRESS",
          jobId: adJob.id,
        });
        return;
      }
      adJobId = adJob.id;
      await updateProductAdJob(adJob.id, { stage: "copy", message: "Preparando el anuncio rápido…" });
      const { variants, errors } = await runAdCampaign(
        input,
        replicateToken,
        (event) => {
          void updateProductAdJob(adJob.id, {
            stage: event.stage,
            message: event.message,
          }).catch((error) => logger.warn({ error: (error as Error).message, jobId: adJob.id }, "ad job progress update failed"));
        },
        async (task) => {
          try {
            await updateProductAdJob(adJob.id, {
              stage: "video",
              message: "El proveedor está generando el vídeo.",
              providerTask: {
                provider: task.provider,
                taskId: task.taskId,
                model: task.model,
                sceneIndex: task.variantIndex,
              },
            });
          } catch (error) {
            logger.error({ error: (error as Error).message, jobId: adJob.id, provider: task.provider, taskId: task.taskId }, "ad provider task id could not be persisted");
          }
        },
      );
      const v0 = variants[0];

      // FIX: runAdCampaign only writes the MP4 to a local /tmp path
      // (`finalMp4Path`). It NEVER populates `finalMp4Url`/`videoUrl` on its
      // own, so the previous guard always returned 503 — making smart-quick
      // permanently broken. We now persist the MP4 to the vault here and
      // expose a stable URL the frontend can play/download.
      if (!v0 || !v0.assets.finalMp4Path) {
        await updateProductAdJob(adJob.id, {
          status: "failed",
          stage: "failed",
          error: "AD_QUICK_FAILED",
          message: "No se pudo generar el anuncio rápido.",
        });
        res.status(503).json({
          error: `No se pudo generar el anuncio rápido con ${quickProvider.label}.`,
          code: "AD_QUICK_FAILED",
          details: errors?.slice(0, 3),
        });
        return;
      }

      let finalMp4: Buffer | null = null;
      let quickVideo: Awaited<ReturnType<typeof persistAdVideoToVault>> = null;
      try {
        finalMp4 = await readFile(v0.assets.finalMp4Path);
        quickVideo = await persistAdVideoToVault({
          projectId,
          category: "smart_quick_ad",
          title: `Anuncio rápido — ${product.title}`,
          mimeType: "video/mp4",
          buffer: finalMp4,
          productId: product.shopifyProductId,
          productTitle: product.title || undefined,
          generatedBy: `smart-quick:${input.videoProvider}`,
          metadata: {
            adJobId: adJob.id,
            durationSec: durationSec,
            voiceId: finalVoiceId,
            voiceName: voice.voiceName,
            language,
            aspect,
            overlayApplied: v0.assets.overlayApplied ?? null,
            heroImageProvider: v0.assets.heroImageProvider ?? null,
            generatedAt: new Date().toISOString(),
            tags: ["ad", "smart", "quick", project.storeNiche || "general"],
          },
        });
      } catch (e) {
        logger.warn({ err: (e as Error)?.message }, "smart-quick: no se pudo confirmar la persistencia en Vault");
      }

      if (!finalMp4) {
        await updateProductAdJob(adJob.id, {
          status: "failed",
          stage: "failed",
          error: "AD_QUICK_OUTPUT_MISSING",
          message: "El anuncio no produjo un archivo MP4 recuperable.",
        });
        res.status(500).json({
          success: false,
          error: "El anuncio no produjo un archivo MP4 recuperable.",
          code: "AD_QUICK_OUTPUT_MISSING",
          details: errors?.slice(0, 3),
        });
        return;
      }

      await recordUsage(projectId, "image", quickCredits);
      if (!quickVideo) {
        logger.error({ projectId, productId: product.shopifyProductId }, "smart-quick: MP4 generado pero no quedó persistido en Vault");
        await updateProductAdJob(adJob.id, {
          status: "failed",
          stage: "failed",
          error: "AD_QUICK_VAULT_FAILED",
          message: "El vídeo se generó, pero no se pudo confirmar su guardado en el Vault.",
        });
        respondWithUnstoredAdVideo(
          req,
          res,
          finalMp4,
          "AD_QUICK_VAULT_FAILED",
          "El vídeo se generó, pero no se pudo confirmar su guardado en el Vault.",
        );
        return;
      }

      v0.assets.finalMp4Url = quickVideo.downloadUrl;
      const recoveredResult = {
        success: true,
        vaultId: quickVideo.vaultId,
        videoUrl: quickVideo.downloadUrl,
        productTitle: product.title,
        language,
      };
      await updateProductAdJob(adJob.id, {
        status: "completed",
        stage: "completed",
        message: "Anuncio guardado en el Vault.",
        vaultId: quickVideo.vaultId,
        videoUrl: quickVideo.downloadUrl,
        result: recoveredResult,
        error: null,
      });
      learnFromOperation({
        operationType: "smart_quick_ad",
        title: `Anuncio rápido generado: ${product.title}`,
        content: `Producto ${product.title}, voz ${voice.voiceName} (${voice.gender}), idioma ${language}.`,
        confidence: 0.9,
        tags: ["ad", "smart", "quick", project.storeNiche || "general"],
      });

      res.json({
        ...recoveredResult,
        jobId: adJob.id,
        vaultId: quickVideo.vaultId,
        videoUrl: quickVideo.downloadUrl,
        variant: v0,
        voice: { id: finalVoiceId, name: voice.voiceName, gender: voice.gender, tone: voice.tone, reason: voice.reason },
        characterGender: voice.characterGender, // hint for follow-up tryon-video
        productTitle: product.title,
        language,
      });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "smart-quick ad failed");
      if (adJobId) {
        void updateProductAdJob(adJobId, {
          status: "failed",
          stage: "failed",
          message: "La generación del anuncio rápido falló.",
          error: String(err?.code || err?.name || "AD_QUICK_ERROR").slice(0, 80),
        }).catch((updateError) => logger.warn({ error: (updateError as Error).message, jobId: adJobId }, "ad job failure update failed"));
      }
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Error generando anuncio", code: "AD_QUICK_ERROR" });
      }
    }
  },
);

// ════════════════════════════════════════════════════════════════════════════
// 2) SMART CINEMATIC AD — MultiShot 4-6 escenas (premium, ~$1.50)
// ════════════════════════════════════════════════════════════════════════════
router.post(
  "/projects/:projectId/products/:productId/ads/smart-cinematic",
  requireAdmin,
  async (req, res) => {
    enableLongRunning(res);
    let adJobId: string | null = null;
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const productIdParam = String(req.params.productId);
      const body = (req.body || {}) as SmartAdBody & {
        scenesCount?: number;
        videoModel?: string;
        characterId?: string | number;
        totalDurationSec?: number;
        longForm?: boolean;
        compositionMode?: "narrative" | "explainer-locked" | "composite-pro" | "locked-shot";
        savedPromptId?: string;
      };
      const savedPromptId = typeof body.savedPromptId === "string" && body.savedPromptId.trim()
        ? body.savedPromptId.trim()
        : undefined;

      const { project, product } = await loadProjectAndProduct(projectId, productIdParam);
      if (!project || !product) {
        res.status(404).json({ error: "Producto no encontrado" });
        return;
      }
      const cineModel = (body.videoModel || "kling-3.0-turbo") as VideoModel;
      if (!VIDEO_MODELS[cineModel]) {
        res.status(400).json({ error: `Modelo de vídeo desconocido: ${body.videoModel}`, code: "BAD_VIDEO_MODEL" });
        return;
      }

      const language: VoiceLanguage = body.language || "auto";

      // ── CHARACTER LOCK (opcional) ─────────────────────────────────────────
      // Si el usuario eligió un personaje, lo cargamos del DB y forzaremos:
      //  - voz del personaje (si tiene voiceId asignado, prevalece sobre el picker)
      //  - identity-lock prompt + foto ref en cada keyframe
      let lockedCharacter: Awaited<ReturnType<typeof loadCharacter>> = null;
      const characterIdRaw = body.characterId;
      const hasCharacterIdInput =
        characterIdRaw !== undefined &&
        characterIdRaw !== null &&
        String(characterIdRaw).trim() !== "";
      if (hasCharacterIdInput) {
        const cidStr = String(characterIdRaw).trim();
        if (!/^\d+$/.test(cidStr)) {
          res.status(400).json({ error: "characterId debe ser un entero positivo", code: "BAD_CHARACTER_ID" });
          return;
        }
        const cidNum = parseInt(cidStr, 10);
        if (!Number.isFinite(cidNum) || cidNum <= 0) {
          res.status(400).json({ error: "characterId debe ser un entero positivo", code: "BAD_CHARACTER_ID" });
          return;
        }
        lockedCharacter = await loadCharacter(projectId, cidNum);
        if (!lockedCharacter) {
          res.status(404).json({ error: `Personaje ${cidNum} no encontrado en este proyecto`, code: "CHARACTER_NOT_FOUND" });
          return;
        }
      }

      const voice = await recommendVoiceForProduct({
        projectId,
        productTitle: product.title || "Producto",
        productDescription: stripHtml(product.bodyHtml).slice(0, 600),
        productType: product.productType || undefined,
        niche: project.storeNiche || undefined,
        language,
        genderPref: (lockedCharacter?.voiceGender as VoiceGenderPref) || body.voiceGender || "auto",
        shortFormat: false,
      });
      // Prioridad de voiceId: explícito en body > voz del personaje > voz recomendada
      // Character Lock prevalece sobre override manual (lock sonoro real)
      const finalVoiceId = lockedCharacter?.voiceId || body.voiceId || voice.voiceId;

      // Direct invocation of generateCinematicMultiShot — avoids HTTP loopback.
      // LONG-FORM: caps removed. Defaults stay short (5 scenes, 25s) but the user
      // can request up to 240 scenes / 1200s (20 min) for trailers, explainers,
      // company speeches, gameplay highlights, etc.
      const requestedScenes = Number(body.scenesCount) || 5;
      const requestedDuration = Number(body.totalDurationSec) || 0;
      const scenesCount = Math.max(2, Math.min(240, Math.floor(requestedScenes)));
      // If totalDurationSec explicitly given, honor it (clamped to safety ceiling).
      // Otherwise derive from scenesCount * 5s/clip.
      const totalDurationSec = requestedDuration > 0
        ? Math.max(scenesCount * 3, Math.min(1800, Math.round(requestedDuration)))
        : scenesCount * 5;

      // Créditos según coste real: clips de vídeo + un fotograma por escena + voz y música.
      const cineCredits = creditsForUsd(
        VIDEO_MODELS[cineModel].costPerSec * totalDurationSec + scenesCount * 0.04 + 0.12 + (totalDurationSec / 60) * 0.3,
        IMAGE_UNIT_COST_EUR,
      );
      const limit = await checkProductionLimit(projectId, "image", cineCredits);
      if (!limit.allowed) {
        res.status(403).json({ error: limit.reason || "Límite de imágenes/vídeos del plan alcanzado", planLimit: true, creditsNeeded: cineCredits });
        return;
      }

      const productImageUrl = getFirstProductImageUrl(product);
      if (!productImageUrl) {
        res.status(400).json({ error: "El producto no tiene imagen — no se puede generar anuncio cinematográfico", code: "NO_PRODUCT_IMAGE" });
        return;
      }
      let productImage: Buffer;
      let productMime = "image/jpeg";
      try {
        productImage = await fetchToBuffer(productImageUrl);
        const lower = productImageUrl.toLowerCase();
        if (lower.includes(".png")) productMime = "image/png";
        else if (lower.includes(".webp")) productMime = "image/webp";
      } catch (e: any) {
        res.status(502).json({ error: `No se pudo descargar la imagen del producto: ${e?.message || "fetch error"}`, code: "PRODUCT_IMAGE_FETCH_FAILED" });
        return;
      }

      // LONG-FORM: activado automáticamente si totalDurationSec > 60 o si el
      // usuario lo pide explícitamente desde el frontend.
      const isLongForm = Boolean(body.longForm) || totalDurationSec > 60;
      // NOTA: "composite-pro" emite [FOREGROUND]/[BACKGROUND] en los prompts pero
      // todavía no aplica un compositor real (chroma-key FFmpeg dual-layer).
      // Mientras esa pieza no esté en producción, degradamos a "explainer-locked"
      // que SÍ produce vídeo final coherente (host fijo, BG dinámico vía prompt).
      let compositionMode: "narrative" | "explainer-locked" | "composite-pro" | "locked-shot" =
        body.compositionMode === "explainer-locked" || body.compositionMode === "composite-pro" || body.compositionMode === "locked-shot"
          ? body.compositionMode
          : "narrative";
      if (compositionMode === "composite-pro") {
        logger.warn({ projectId }, "composite-pro requested but compositor not implemented — degrading to explainer-locked for safe output");
        compositionMode = "explainer-locked";
      }

      const previousJob = await getLatestProductAdJob(projectId, product.shopifyProductId);
      if (
        previousJob?.status === "running" ||
        (previousJob?.status === "interrupted" && previousJob.providerTasks.length > 0)
      ) {
        res.status(409).json({
          error: previousJob.status === "running"
            ? "Ya hay un anuncio en curso para este producto. Puedes recuperar su estado en Auditoría."
            : "El proveedor ya aceptó una generación interrumpida. Revisa el estado en Auditoría antes de iniciar otro anuncio.",
          code: previousJob.status === "running" ? "AD_JOB_IN_PROGRESS" : "AD_JOB_INTERRUPTED",
          jobId: previousJob.id,
        });
        return;
      }
      const createdAdJob = await createProductAdJob({
        projectId,
        productId: product.shopifyProductId,
        kind: "smart-cinematic",
      });
      const adJob = createdAdJob.job;
      if (!createdAdJob.created) {
        res.status(409).json({
          error: "Ya hay un anuncio en curso para este producto. Puedes recuperar su estado en Auditoría.",
          code: "AD_JOB_IN_PROGRESS",
          jobId: adJob.id,
        });
        return;
      }
      adJobId = adJob.id;
      await updateProductAdJob(adJob.id, {
        stage: "script",
        message: "Preparando el guion cinematográfico…",
      });

      const result = await generateCinematicMultiShot({
        projectId,
        productImage,
        productMime,
        brand: project.name || "Brand",
        productName: product.title || "Producto",
        niche: project.storeNiche || undefined,
        audience: undefined,
        audienceText: project.targetAudience || undefined,
        language: language === "auto" ? "es" : language,
        scenesCount,
        totalDurationSec,
        aspect: ((body.aspect === "4:5" ? "9:16" : (body.aspect || "9:16")) as CinematicAspect),
        videoModel: cineModel,
        style: "cinematic" as CinematicStyle,
        customBrief: [
          body.ctaText ? `CTA al final: "${body.ctaText}"` : "",
          body.customNotes ? `Notas: ${body.customNotes.slice(0, 300)}` : "",
          `Tono de voz: ${voice.tone}`,
          `Personaje: ${voice.characterGender}`,
          lockedCharacter
            ? `MUY IMPORTANTE: TODAS las escenas con personas deben mostrar al MISMO personaje "${lockedCharacter.name}" — ${lockedCharacter.identityDescription.slice(0, 200)}.`
            : "",
        ].filter(Boolean).join(". ") || undefined,
        narration: {
          enabled: true,
          voiceId: finalVoiceId,
          voiceModel: "eleven_turbo_v2_5",
          voiceVolume: 1.0,
        },
        music: body.addMusic !== false ? { enabled: true, volume: 0.22 } : undefined,
        character: lockedCharacter
          ? {
              name: lockedCharacter.name,
              image: lockedCharacter.refImage,
              mime: lockedCharacter.refMime,
              identityPrompt: buildIdentityLockPrompt(lockedCharacter),
            }
          : undefined,
        // Long-form / director-mode parameters
        longForm: isLongForm,
        compositionMode,
        ctaText: body.ctaText || undefined,
        productDescription: stripHtml(product.bodyHtml).slice(0, 1500) || undefined,
        // Reuse a previously persisted multi-shot template (chatbot persist_cinematic_script)
        savedPromptId,
        // Deterministic brand overlay (text + logo burned with FFmpeg drawtext
        // after the AI render). The caller may pass a full BrandOverlayConfig
        // OR a brandKit and we auto-build a sensible 3-segment overlay.
        brandOverlay: (body as any).brandOverlay,
        brandKit: (body as any).brandKit,
        onProgress: async (event) => {
          try {
            await updateProductAdJob(adJob.id, {
              stage: event.stage,
              message: event.message,
            });
          } catch (error) {
            logger.warn({ error: (error as Error).message, jobId: adJob.id }, "ad job progress update failed");
          }
        },
        onProviderTask: async (task) => {
          try {
            await updateProductAdJob(adJob.id, {
              stage: "video",
              message: task.sceneIndex
                ? `El proveedor está generando la escena ${task.sceneIndex}.`
                : "El proveedor está generando el vídeo.",
              providerTask: {
                provider: task.provider,
                taskId: task.taskId,
                model: task.model,
                sceneIndex: task.sceneIndex,
              },
            });
          } catch (error) {
            logger.error({ error: (error as Error).message, jobId: adJob.id, provider: task.provider, taskId: task.taskId }, "ad provider task id could not be persisted");
          }
        },
      });

      // Persist final MP4 to vault — return URL instead of base64 to keep response small.
      let cineVideo: Awaited<ReturnType<typeof persistAdVideoToVault>> = null;
      try {
        cineVideo = await persistAdVideoToVault({
          projectId,
          category: "smart_cinematic_ad",
          title: `Anuncio cinematográfico — ${product.title}`,
          mimeType: result.finalMime || "video/mp4",
          buffer: result.finalVideo,
          productId: product.shopifyProductId,
          productTitle: product.title || undefined,
          generatedBy: `smart-cinematic:${body.videoModel || "kling-3.0-turbo"}`,
          metadata: {
            adJobId: adJob.id,
            scenesCount: result.script.scenes.length,
            durationSec: result.durationSec,
            script: result.script,
            voiceId: finalVoiceId,
            voiceName: voice.voiceName,
            language,
            character: lockedCharacter ? { id: lockedCharacter.id, name: lockedCharacter.name } : null,
            generatedAt: new Date().toISOString(),
            tags: ["ad", "smart", "cinematic", ...(lockedCharacter ? ["character_locked"] : [])],
          },
        });
      } catch (e) {
        logger.warn({ err: (e as Error)?.message }, "smart-cinematic: no se pudo confirmar la persistencia en Vault");
      }

      await recordUsage(projectId, "image", cineCredits);
      if (!cineVideo) {
        logger.error({ projectId, productId: product.shopifyProductId }, "smart-cinematic: MP4 generado pero no quedó persistido en Vault");
        await updateProductAdJob(adJob.id, {
          status: "failed",
          stage: "failed",
          error: "AD_CINEMATIC_VAULT_FAILED",
          message: "El vídeo se generó, pero no se pudo confirmar su guardado en el Vault.",
        });
        respondWithUnstoredAdVideo(
          req,
          res,
          result.finalVideo,
          "AD_CINEMATIC_VAULT_FAILED",
          "El vídeo se generó, pero no se pudo confirmar su guardado en el Vault.",
        );
        return;
      }

      learnFromOperation({
        operationType: "smart_cinematic_ad",
        title: `Anuncio cinematográfico generado: ${product.title}`,
        content: `Producto ${product.title}, voz ${voice.voiceName}, ${scenesCount} escenas.`,
        confidence: 0.92,
        tags: ["ad", "smart", "cinematic", project.storeNiche || "general"],
      });

      const videoUrl = cineVideo.downloadUrl;

      const recoveredResult = {
        success: true,
        vaultId: cineVideo.vaultId,
        videoUrl,
        result: {
          finalVideoUrl: videoUrl,
          videoUrl,
          vaultId: cineVideo.vaultId,
          sizeBytes: result.finalVideo.length,
          durationSec: result.durationSec,
          scenesCount: result.script.scenes.length,
          script: result.script,
          savedPromptId: result.savedPromptId || null,
          mimeType: result.finalMime,
        },
        voice: { id: finalVoiceId, name: voice.voiceName, gender: voice.gender, tone: voice.tone, reason: voice.reason },
        characterGender: voice.characterGender,
        characterLocked: lockedCharacter
          ? { id: lockedCharacter.id, name: lockedCharacter.name }
          : null,
        productTitle: product.title,
        language,
      };
      await updateProductAdJob(adJob.id, {
        status: "completed",
        stage: "completed",
        message: "Anuncio guardado en el Vault.",
        vaultId: cineVideo.vaultId,
        videoUrl,
        result: recoveredResult,
        error: null,
      });
      res.json({ ...recoveredResult, jobId: adJob.id });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "smart-cinematic ad failed");
      if (adJobId) {
        void updateProductAdJob(adJobId, {
          status: "failed",
          stage: "failed",
          message: "La generación cinematográfica falló.",
          error: String(err?.code || err?.name || "AD_CINEMATIC_ERROR").slice(0, 80),
        }).catch((updateError) => logger.warn({ error: (updateError as Error).message, jobId: adJobId }, "ad job failure update failed"));
      }
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Error generando anuncio cinematográfico", code: "AD_CINEMATIC_ERROR" });
      }
    }
  },
);

// ════════════════════════════════════════════════════════════════════════════
// 3) VIDEO TRY-ON — Spokesperson + product en movimiento, 3 providers + efectos
// ════════════════════════════════════════════════════════════════════════════
router.post(
  "/projects/:projectId/products/:productId/videos/tryon-video",
  requireAdmin,
  tryonVideoUpload.single("modelImage"),
  async (req, res) => {
    enableLongRunning(res);
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const productIdParam = String(req.params.productId);
      const file = req.file;

      // characterId opcional: si está, usamos su imagen ref del DB y NO exigimos upload
      const characterIdRawT = req.body?.characterId;
      const hasCharacterIdInputT =
        characterIdRawT !== undefined &&
        characterIdRawT !== null &&
        String(characterIdRawT).trim() !== "";
      let cidNumT: number | null = null;
      if (hasCharacterIdInputT) {
        const cidStrT = String(characterIdRawT).trim();
        if (!/^\d+$/.test(cidStrT)) {
          res.status(400).json({ error: "characterId debe ser un entero positivo", code: "BAD_CHARACTER_ID" });
          return;
        }
        const n = parseInt(cidStrT, 10);
        if (!Number.isFinite(n) || n <= 0) {
          res.status(400).json({ error: "characterId debe ser un entero positivo", code: "BAD_CHARACTER_ID" });
          return;
        }
        cidNumT = n;
      }

      if (!file && cidNumT === null) {
        res.status(400).json({ error: "Falta la imagen del modelo: sube 'modelImage' o pasa 'characterId'" });
        return;
      }

      const { project, product } = await loadProjectAndProduct(projectId, productIdParam);
      if (!project || !product) {
        res.status(404).json({ error: "Producto no encontrado" });
        return;
      }

      // Cargar character (si aplica) — su imagen sustituye al upload, su voz prevalece
      const lockedCharacter = cidNumT !== null
        ? await loadCharacter(projectId, cidNumT)
        : null;
      if (cidNumT !== null && !lockedCharacter) {
        res.status(404).json({ error: `Personaje ${cidNumT} no encontrado en este proyecto`, code: "CHARACTER_NOT_FOUND" });
        return;
      }

      // Cota superior previa (Kling 3.0 Pro 10 s + imagen + voz); se cobra el coste real al acabar.
      const tryonMaxCredits = creditsForUsd(10 * 0.168 + 0.04 + 0.12, IMAGE_UNIT_COST_EUR);
      const limit = await checkProductionLimit(projectId, "image", tryonMaxCredits);
      if (!limit.allowed) {
        res.status(403).json({ error: limit.reason || "Límite de imágenes/vídeos del plan alcanzado", planLimit: true, creditsNeeded: tryonMaxCredits });
        return;
      }

      const provider = (String(req.body?.provider || "kling") as TryonProvider);
      const effectStyle = (String(req.body?.effectStyle || "natural_wear") as EffectStyle);
      // Si hay character con gender, prevalece sobre el body
      const characterGender = (
        lockedCharacter?.gender === "male" || lockedCharacter?.gender === "female"
          ? lockedCharacter.gender
          : String(req.body?.characterGender || "female")
      ) as CharacterGender;
      const language = String(req.body?.language || "es");
      const duration = clampDuration(req.body?.duration, 5);
      const aspect = String(req.body?.aspect || "9:16") as "9:16" | "16:9" | "1:1";
      const premium = String(req.body?.premium || "false") === "true";
      const customNotes = req.body?.customNotes ? String(req.body.customNotes).slice(0, 400) : undefined;
      // NEW: voiceover + lip-sync opcionales (talking-head profesional)
      const withVoiceover = String(req.body?.withVoiceover || "false") === "true";
      const applyLipSync = String(req.body?.applyLipSync || "false") === "true";
      // Character Lock prevalece sobre override manual (lock sonoro real)
      const voiceIdReq = lockedCharacter?.voiceId
        ? lockedCharacter.voiceId
        : (req.body?.voiceId ? String(req.body.voiceId) : undefined);
      const voiceGenderPref = (
        lockedCharacter?.voiceGender
          ? lockedCharacter.voiceGender
          : (req.body?.voiceGender ? String(req.body.voiceGender) : "auto")
      ) as VoiceGenderPref;
      const ctaText = req.body?.ctaText ? String(req.body.ctaText).slice(0, 120) : undefined;

      // Imagen base: si hay character, su foto; si no, el upload del usuario
      const baseModelImage: Buffer = lockedCharacter ? lockedCharacter.refImage : file!.buffer;
      const baseModelMime: string = lockedCharacter ? lockedCharacter.refMime : (file!.mimetype || "image/png");

      if (!["kling", "hailuo", "runway"].includes(provider)) {
        res.status(400).json({ error: "Provider inválido (kling | hailuo | runway)" });
        return;
      }
      if (!["natural_wear", "magical_dress", "multishot_outfit_change", "lifestyle_use"].includes(effectStyle)) {
        res.status(400).json({ error: "effectStyle inválido" });
        return;
      }

      const replicateToken = process.env.REPLICATE_API_TOKEN || "";

      // ── PRE-FUSIÓN: combinar imagen del modelo + imagen real del producto Shopify ──
      // Pasamos al modelo de vídeo un frame donde el modelo YA lleva/sostiene el
      // producto real del catálogo. Sin esto, el video try-on no muestra el
      // producto real (solo lo describe). Si la fusión falla, caemos a usar
      // sólo la modelImage (no fatal).
      let referenceBuffer: Buffer = baseModelImage;
      let referenceMime: string = baseModelMime;
      const productImageUrl = getFirstProductImageUrl(product);
      let fusedFromProduct = false;
      if (productImageUrl) {
        try {
          const productBuf = await fetchToBuffer(productImageUrl);
          const productMime = productImageUrl.toLowerCase().includes(".png")
            ? "image/png"
            : productImageUrl.toLowerCase().includes(".webp")
              ? "image/webp"
              : "image/jpeg";
          const { GoogleGenAI } = await import("@google/genai");
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            // Si hay character, reforzamos el identity-lock dentro del prompt de fusión
            const identityBlock = lockedCharacter
              ? ` ${buildIdentityLockPrompt(lockedCharacter)} `
              : "";
            const fusionPrompt =
              `Edit the FIRST image (the model). Insert and place on the model the EXACT product shown in the SECOND image — keep the product 100% recognizable, same colors, same shape, same materials. ` +
              `Effect: ${effectStyle === "lifestyle_use" ? "the model is naturally using the product" : "the model is wearing/holding the product"}. ` +
              `Photorealistic, professional commercial lighting, ${aspect} aspect ratio. Do not invent a different product — copy the one in the SECOND image faithfully.${identityBlock}`;
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-image",
              contents: [
                { text: fusionPrompt },
                { inlineData: { mimeType: baseModelMime, data: baseModelImage.toString("base64") } } as any,
                { inlineData: { mimeType: productMime, data: productBuf.toString("base64") } } as any,
              ],
              config: { responseModalities: ["IMAGE"] } as any,
            });
            const parts = response?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              const inline = (part as any).inlineData || (part as any).inline_data;
              if (inline?.data) {
                referenceBuffer = Buffer.from(inline.data, "base64");
                referenceMime = inline.mimeType || "image/png";
                fusedFromProduct = true;
                break;
              }
            }
          }
        } catch (e) {
          logger.warn({ err: (e as Error)?.message }, "tryon-video: pre-fusión modelo+producto falló, sigo con modelImage sola");
        }
      }

      const result = await generateTryonVideo({
        provider,
        referenceImage: referenceBuffer,
        referenceImageMime: referenceMime,
        productTitle: product.title || "Producto",
        productType: product.productType || undefined,
        effectStyle,
        characterGender,
        language,
        duration,
        aspect,
        premium,
        replicateToken,
        customNotes,
      });

      // ── VOICE-OVER + LIP-SYNC (opcional) ────────────────────────────────────
      // Si el usuario activa "talking-head" generamos:
      //  1) Guión corto coherente (Claude) con CTA si lo pide.
      //  2) TTS con la voz recomendada/elegida (ElevenLabs).
      //  3) Mux audio sobre el vídeo (composeAd).
      //  4) Lip-sync sobre el resultado vía Replicate (cudanexus/lipsync-v2).
      let finalVideo: Buffer = result.buffer;
      let voiceUsed: { id: string; name: string; reason: string } | null = null;
      let lipSyncApplied = false;
      let scriptUsed: string | null = null;

      if (withVoiceover) {
        try {
          // 1) Voz inteligente
          const reco = await recommendVoiceForProduct({
            projectId,
            productTitle: product.title || "Producto",
            productDescription: stripHtml(product.bodyHtml || "").slice(0, 500),
            productType: product.productType || undefined,
            language: (language === "auto" ? "auto" : language) as VoiceLanguage,
            niche: project.storeNiche || undefined,
            genderPref: voiceGenderPref,
            shortFormat: true,
          });
          const finalVoiceId = voiceIdReq || reco.voiceId;

          // 2) Guión corto (8-22 palabras) coherente con personaje + producto
          const scriptPrompt = `Producto: "${product.title}". Tipo: ${product.productType || "n/d"}. ` +
            `Idioma: ${language === "auto" ? "es" : language}. Personaje: ${characterGender}. ` +
            `${ctaText ? `CTA obligatoria al final: "${ctaText}".` : "Acaba con un cierre potente."} ` +
            `Genera UN guión hablado de 8 a 22 palabras, natural, conversacional, coherente con el personaje. ` +
            `Devuelve JSON: {"script":"..."}.`;
          const scriptResp = await askClaudeJsonWithBrain<{ script: string }>(
            projectId,
            scriptPrompt,
            "Eres un copywriter publicitario experto. Respondes SOLO con JSON válido.",
            "general",
            project.storeNiche || undefined,
            500,
            45_000,
          );
          scriptUsed = (scriptResp?.script || "").trim();
          if (!scriptUsed) throw new Error("Guión vacío");

          // 3) TTS
          const voiceBuffer = await generateTTS(scriptUsed, {
            voiceId: finalVoiceId,
            modelId: "eleven_turbo_v2_5",
            stability: reco.stability,
            style: reco.style,
            languageCode: language === "auto" || language.length !== 2 ? undefined : language,
          });

          // 4) Mux voz (+ música baja)
          const muxed = await composeAd({
            videoBuffer: result.buffer,
            voiceBuffer,
            voiceVolume: 1.0,
          });
          finalVideo = muxed;

          // 5) Lip-sync (opcional — costoso pero profesional)
          if (applyLipSync) {
            try {
              const synced = await lipSyncVideoToAudio(finalVideo, voiceBuffer, {
                replicateToken,
                videoMime: "video/mp4",
                audioMime: "audio/mpeg",
              });
              finalVideo = synced;
              lipSyncApplied = true;
            } catch (e) {
              logger.warn({ err: (e as Error)?.message }, "tryon-video: lip-sync falló — devuelvo el muxed sin sync");
            }
          }

          voiceUsed = { id: finalVoiceId, name: reco.voiceName, reason: reco.reason };
        } catch (e) {
          logger.warn({ err: (e as Error)?.message }, "tryon-video: voiceover falló — devuelvo solo el vídeo crudo");
        }
      }

      let savedTryonVideo: Awaited<ReturnType<typeof persistAdVideoToVault>> = null;
      try {
        savedTryonVideo = await persistAdVideoToVault({
          projectId,
          category: "tryon_video",
          title: `Video Try-On — ${product.title} [${effectStyle}]${withVoiceover ? " 🎙️" : ""}${lipSyncApplied ? " 👄" : ""}`,
          description: `Try-on en video con ${provider} (${result.model}). Personaje: ${characterGender}. Efecto: ${effectStyle}.${fusedFromProduct ? " Producto fusionado pre-vídeo." : ""}${withVoiceover ? ` Narración: "${(scriptUsed || "").slice(0, 100)}"` : ""}${lipSyncApplied ? " Lip-sync aplicado." : ""}`,
          mimeType: "video/mp4",
          buffer: finalVideo,
          productId: product.shopifyProductId,
          productTitle: product.title,
          generatedBy: `video-tryon:${result.model}${lipSyncApplied ? "+lipsync" : withVoiceover ? "+vo" : ""}`,
          metadata: {
            provider, model: result.model, effectStyle, characterGender,
            language, duration: result.durationSec, aspect, premium,
            costEstimateUsd: result.costEstimateUsd,
            fusedFromProduct,
            withVoiceover,
            lipSyncApplied,
            voice: voiceUsed,
            script: scriptUsed,
            character: lockedCharacter ? { id: lockedCharacter.id, name: lockedCharacter.name } : null,
            promptUsed: result.prompt,
            generatedAt: new Date().toISOString(),
            tags: ["video", "tryon", provider, effectStyle, ...(withVoiceover ? ["voiceover"] : []), ...(lipSyncApplied ? ["lipsync"] : []), ...(lockedCharacter ? ["character_locked"] : [])],
          },
        });
      } catch (e) {
        logger.warn({ err: (e as Error)?.message }, "tryon-video: no se pudo confirmar la persistencia en Vault");
      }

      await recordUsage(projectId, "image", creditsForUsd(result.costEstimateUsd + 0.04 + (withVoiceover ? 0.12 : 0), IMAGE_UNIT_COST_EUR));
      if (!savedTryonVideo) {
        logger.error({ projectId, productId: product.shopifyProductId }, "tryon-video: MP4 generado pero no quedó persistido en Vault");
        respondWithUnstoredAdVideo(
          req,
          res,
          finalVideo,
          "TRYON_VIDEO_VAULT_FAILED",
          "El vídeo Try-On se generó, pero no se pudo confirmar su guardado en el Vault.",
        );
        return;
      }

      learnFromOperation({
        operationType: "tryon_video",
        title: `Video Try-On: ${product.title}`,
        content: `Provider ${provider}, modelo ${result.model}, efecto ${effectStyle}, género ${characterGender}, producto fusionado=${fusedFromProduct}.`,
        confidence: 0.88,
        tags: ["tryon", "video", provider, effectStyle, project.storeNiche || "general"],
      });

      const videoUrl = savedTryonVideo.downloadUrl;

      res.json({
        success: true,
        vaultId: savedTryonVideo.vaultId,
        videoUrl,
        finalVideoUrl: videoUrl,
        sizeBytes: finalVideo.length,
        durationSec: result.durationSec,
        model: result.model,
        provider,
        effectStyle,
        characterGender,
        costEstimateUsd: result.costEstimateUsd,
        fusedFromProduct,
        withVoiceover,
        lipSyncApplied,
        voice: voiceUsed,
        script: scriptUsed,
        characterLocked: lockedCharacter ? { id: lockedCharacter.id, name: lockedCharacter.name } : null,
        promptUsed: result.prompt,
      });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "tryon-video failed");
      if (!res.headersSent) {
        const msg = String(err?.message || "");
        const isQuota = /402|insufficient|quota|429|rate.?limit/i.test(msg);
        res.status(isQuota ? 503 : 500).json({
          error: err?.message || "Error generando video try-on",
          code: isQuota ? "TRYON_VIDEO_QUOTA" : "TRYON_VIDEO_ERROR",
        });
      }
    }
  },
);

export default router;
