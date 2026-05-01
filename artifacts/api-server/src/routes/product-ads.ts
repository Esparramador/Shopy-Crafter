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
import { Router } from "express";
import multer from "multer";
import { db, projectsTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import { enableLongRunning } from "../lib/long-running.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { requireAdmin } from "../lib/auth.js";
import { runAdCampaign, type AdCampaignInput } from "../lib/adstudio.js";
import { recommendVoiceForProduct, type VoiceLanguage, type VoiceGenderPref } from "../lib/voice-recommender.js";
import {
  generateTryonVideo, type TryonProvider, type EffectStyle, type CharacterGender,
} from "../lib/video-tryon.js";
import { learnFromOperation } from "../lib/claude.js";
import {
  fetchToBuffer, generateTTS, composeAd, lipSyncVideoToAudio,
} from "../lib/fusion-studio-pro.js";
import { generateCinematicMultiShot, type CinematicAspect, type CinematicStyle } from "../lib/cinematic-multishot.js";
import { askClaudeJsonWithBrain } from "../lib/claude.js";
import { loadCharacter, buildIdentityLockPrompt } from "../lib/character-loader.js";

const router = Router();

const tryonVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo de imagen no permitido: ${file.mimetype}`) as any, false);
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

function clampDuration(d: any, def: number, max = 10): number {
  const n = Number(d);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.max(3, Math.min(max, Math.floor(n)));
}

// ════════════════════════════════════════════════════════════════════════════
// 1) SMART QUICK AD  — AdStudio hero+voz+video, 1 variante (rápido, ~$0.30)
// ════════════════════════════════════════════════════════════════════════════
router.post(
  "/projects/:projectId/products/:productId/ads/smart-quick",
  requireAdmin,
  async (req, res) => {
    enableLongRunning(res);
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const productIdParam = String(req.params.productId);
      const body = (req.body || {}) as SmartAdBody;

      const { project, product } = await loadProjectAndProduct(projectId, productIdParam);
      if (!project || !product) {
        res.status(404).json({ error: "Producto no encontrado" });
        return;
      }

      const limit = await checkProductionLimit(projectId, "image", 1);
      if (!limit.allowed) {
        res.status(403).json({ error: "Límite de videos alcanzado para tu plan", planLimit: true });
        return;
      }

      const language: VoiceLanguage = body.language || "auto";
      const aspect = (body.aspect || "9:16") as AdCampaignInput["aspect"];
      const durationSec = clampDuration(body.durationSec, 6);

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
        videoProvider: "runway-gen4-turbo",
        videoDurationSec: durationSec,
        voiceId: finalVoiceId,
        voiceStability: voice.stability,
        voiceStyle: voice.style,
        addMusic: body.addMusic !== false,
        variantsCount: 1,
        customPrompt: [
          body.ctaText ? `CTA obligatorio al final: "${body.ctaText}"` : "",
          body.customNotes ? `Notas extra: ${body.customNotes.slice(0, 300)}` : "",
          `Idioma del voiceover: ${language === "auto" ? "español" : language}`,
          `Precio: ${product.price || "(no disponible)"} ${(project as any).currency || "EUR"}`,
          `Descripción producto: ${stripHtml(product.bodyHtml).slice(0, 400)}`,
        ].filter(Boolean).join(". "),
        sourceImageUrl,
      };

      const { variants, errors } = await runAdCampaign(input, replicateToken);
      const v0 = variants[0];

      if (!v0 || (!v0.assets.finalMp4Url && !v0.assets.videoUrl)) {
        res.status(503).json({
          error: "No se pudo generar el anuncio rápido (todos los proveedores de video sin saldo o error).",
          code: "AD_QUICK_FAILED",
          details: errors?.slice(0, 3),
        });
        return;
      }

      await recordUsage(projectId, "image", 1);
      learnFromOperation({
        operationType: "smart_quick_ad",
        title: `Anuncio rápido generado: ${product.title}`,
        content: `Producto ${product.title}, voz ${voice.voiceName} (${voice.gender}), idioma ${language}.`,
        confidence: 0.9,
        tags: ["ad", "smart", "quick", project.storeNiche || "general"],
      });

      res.json({
        success: true,
        variant: v0,
        voice: { id: finalVoiceId, name: voice.voiceName, gender: voice.gender, tone: voice.tone, reason: voice.reason },
        characterGender: voice.characterGender, // hint for follow-up tryon-video
        productTitle: product.title,
        language,
      });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "smart-quick ad failed");
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
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const productIdParam = String(req.params.productId);
      const body = (req.body || {}) as SmartAdBody & {
        scenesCount?: number;
        videoModel?: string;
        characterId?: string | number;
        totalDurationSec?: number;
        longForm?: boolean;
        compositionMode?: "narrative" | "explainer-locked" | "composite-pro";
      };

      const { project, product } = await loadProjectAndProduct(projectId, productIdParam);
      if (!project || !product) {
        res.status(404).json({ error: "Producto no encontrado" });
        return;
      }
      const limit = await checkProductionLimit(projectId, "image", 1);
      if (!limit.allowed) {
        res.status(403).json({ error: "Límite de videos alcanzado para tu plan", planLimit: true });
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
      let compositionMode: "narrative" | "explainer-locked" | "composite-pro" =
        body.compositionMode === "explainer-locked" || body.compositionMode === "composite-pro"
          ? body.compositionMode
          : "narrative";
      if (compositionMode === "composite-pro") {
        logger.warn({ projectId }, "composite-pro requested but compositor not implemented — degrading to explainer-locked for safe output");
        compositionMode = "explainer-locked";
      }

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
        videoModel: (body.videoModel || "kling-2.1") as any,
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
      });

      // Persist final MP4 to vault — return URL instead of base64 to keep response small.
      let cineVaultId: number | null = null;
      try {
        cineVaultId = await saveToVault({
          projectId,
          fileType: "video",
          category: "smart_cinematic_ad",
          title: `Anuncio cinematográfico — ${product.title}`,
          mimeType: result.finalMime || "video/mp4",
          productId: product.shopifyProductId,
          productTitle: product.title || undefined,
          generatedBy: `smart-cinematic:${body.videoModel || "kling-2.1"}`,
          content: result.finalVideo.toString("base64"),
          metadata: {
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
        logger.warn({ err: (e as Error)?.message }, "smart-cinematic: no se pudo persistir en vault (no fatal)");
      }

      await recordUsage(projectId, "image", 1);
      learnFromOperation({
        operationType: "smart_cinematic_ad",
        title: `Anuncio cinematográfico generado: ${product.title}`,
        content: `Producto ${product.title}, voz ${voice.voiceName}, ${scenesCount} escenas.`,
        confidence: 0.92,
        tags: ["ad", "smart", "cinematic", project.storeNiche || "general"],
      });

      const videoUrl = cineVaultId
        ? `/api/projects/${projectId}/vault/${cineVaultId}/raw`
        : undefined;

      res.json({
        success: true,
        result: {
          finalVideoUrl: videoUrl,
          videoUrl,
          vaultId: cineVaultId,
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
      });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "smart-cinematic ad failed");
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

      const limit = await checkProductionLimit(projectId, "image", 1);
      if (!limit.allowed) {
        res.status(403).json({ error: "Límite de videos alcanzado para tu plan", planLimit: true });
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
              model: "gemini-2.5-flash-image",
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

      let vaultId: number | null = null;
      try {
        vaultId = await saveToVault({
          projectId,
          fileType: "video",
          category: "tryon_video",
          title: `Video Try-On — ${product.title} [${effectStyle}]${withVoiceover ? " 🎙️" : ""}${lipSyncApplied ? " 👄" : ""}`,
          description: `Try-on en video con ${provider} (${result.model}). Personaje: ${characterGender}. Efecto: ${effectStyle}.${fusedFromProduct ? " Producto fusionado pre-vídeo." : ""}${withVoiceover ? ` Narración: "${(scriptUsed || "").slice(0, 100)}"` : ""}${lipSyncApplied ? " Lip-sync aplicado." : ""}`,
          mimeType: "video/mp4",
          productId: product.shopifyProductId,
          productTitle: product.title,
          generatedBy: `video-tryon:${result.model}${lipSyncApplied ? "+lipsync" : withVoiceover ? "+vo" : ""}`,
          content: finalVideo.toString("base64"),
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
        logger.warn({ err: (e as Error)?.message }, "tryon-video: no se pudo guardar en vault (no fatal)");
      }

      await recordUsage(projectId, "image", 1);
      learnFromOperation({
        operationType: "tryon_video",
        title: `Video Try-On: ${product.title}`,
        content: `Provider ${provider}, modelo ${result.model}, efecto ${effectStyle}, género ${characterGender}, producto fusionado=${fusedFromProduct}.`,
        confidence: 0.88,
        tags: ["tryon", "video", provider, effectStyle, project.storeNiche || "general"],
      });

      const videoUrl = vaultId
        ? `/api/projects/${projectId}/vault/${vaultId}/raw`
        : undefined;

      res.json({
        success: true,
        vaultId,
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
