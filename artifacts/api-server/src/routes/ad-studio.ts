import { Router, type Request, type Response } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { enableLongRunning } from "../lib/long-running.js";
import { saveToVault } from "../lib/vault.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { learnFromOperation } from "../lib/claude.js";
import { runAdCampaign, type AdCampaignInput, type AdAssetPaths, type AdCopyVariant } from "../lib/adstudio.js";
import { resolveAdVideoProvider, listAdVideoProviders, adCredits, effectiveDuration } from "../lib/ad-video-providers.js";
import { IMAGE_UNIT_COST_EUR } from "../lib/ai-budget.js";
import { listTemplates, AD_TEMPLATES, type AdTemplateKey } from "../lib/ad-templates.js";
import { analyzeViralVideo, briefToCampaignInput } from "../lib/viral-clone.js";
import { fetchToBuffer } from "../lib/fusion-studio-pro.js";
import { safeDecrypt } from "../lib/crypto.js";
import multer from "multer";
import fs from "node:fs/promises";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024 } });

const router = Router();

// ─── GET /api/ad-studio/voices — list available ElevenLabs voices ────────
router.get("/ad-studio/voices", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) { res.status(503).json({ error: "ELEVENLABS_API_KEY not configured" }); return; }

    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!r.ok) { res.status(r.status).json({ error: "ElevenLabs API error" }); return; }
    const data = await r.json() as { voices: any[] };
    // Simplify: just what the UI needs
    const voices = (data.voices || []).map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      labels: v.labels || {},
      preview_url: v.preview_url,
      category: v.category,
    })).slice(0, 50);
    res.json({ voices });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

// ─── GET /api/ad-studio/providers — catálogo verificado con coste real ─────
// ?duration=6&imageMode=scene|photo|ai → precio y créditos por anuncio para esa duración.
router.get("/ad-studio/providers", requireAdmin, async (req, res): Promise<void> => {
  const duration = Math.min(Math.max(Number(req.query.duration) || 6, 3), 10);
  const images = req.query.imageMode === "photo" ? 0 : 1;
  res.json({
    videoProviders: listAdVideoProviders(duration, IMAGE_UNIT_COST_EUR, images),
    aspects: ["9:16", "16:9", "1:1", "4:5"],
    objectives: ["awareness", "conversion", "retargeting", "ugc", "story"],
  });
});

/** Créditos de imagen por anuncio según proveedor, duración y uso de la foto real. */
function creditsPerAd(input: Pick<AdCampaignInput, "videoProvider" | "videoDurationSec" | "sourceImageUrl" | "heroMode">): number | null {
  const p = resolveAdVideoProvider(input.videoProvider);
  if (!p) return null;
  const images = input.sourceImageUrl && input.heroMode === "photo" ? 0 : 1;
  return adCredits(p, input.videoDurationSec, IMAGE_UNIT_COST_EUR, { images });
}

/** Guarda en la Bóveda el MP4, la imagen y la voz de cada variante. */
async function persistVariants(
  projectId: number,
  input: AdCampaignInput,
  variants: Array<{ copy: AdCopyVariant; assets: AdAssetPaths }>,
  titlePrefix = "AdStudio",
) {
  return Promise.all(variants.map(async (v, idx) => {
    const saved: any = {
      copy: v.copy,
      variantIndex: idx,
      error: v.assets.error,
      overlayApplied: v.assets.overlayApplied,
      overlayError: v.assets.overlayError,
      heroImageProvider: v.assets.heroImageProvider,
      productSource: v.assets.productSource,
    };
    try {
      if (v.assets.finalMp4Path) {
        const buf = await fs.readFile(v.assets.finalMp4Path);
        saved.finalMp4VaultId = await saveToVault({
          projectId, fileType: "ad-studio-video", category: "ad-studio",
          title: `${titlePrefix}: ${v.copy.hook}`,
          mimeType: "video/mp4", generatedBy: `ad-studio:${input.videoProvider}`,
          content: buf.toString("base64"), fileSizeBytes: buf.length,
          metadata: { productTitle: input.productTitle, aspect: input.aspect, productSource: v.assets.productSource },
        });
      }
      if (v.assets.heroImagePath) {
        const buf = await fs.readFile(v.assets.heroImagePath);
        saved.heroImageVaultId = await saveToVault({
          projectId, fileType: "ad-studio-hero", category: "ad-studio",
          title: `${titlePrefix} imagen: ${v.copy.hook}`,
          mimeType: "image/png", generatedBy: "ad-studio:hero",
          content: buf.toString("base64"),
        });
      }
      if (v.assets.voicePath) {
        const buf = await fs.readFile(v.assets.voicePath);
        saved.voiceVaultId = await saveToVault({
          projectId, fileType: "ad-studio-voice", category: "ad-studio",
          title: `${titlePrefix} voz: ${v.copy.hook}`,
          mimeType: "audio/mpeg", generatedBy: "ad-studio:elevenlabs",
          content: buf.toString("base64"),
        });
      }
    } catch (saveErr: any) {
      logger.error({ err: saveErr, idx }, "ad-studio: vault save failed");
      saved.saveError = saveErr?.message;
    }
    return saved;
  }));
}

// ─── POST /api/ad-studio/generate-campaign — run full pipeline ───────────
// Streams progress via SSE if Accept: text/event-stream, else waits and returns JSON
router.post("/ad-studio/generate-campaign", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);

  const body = req.body as Partial<AdCampaignInput>;
  const projectId = typeof body.projectId === "number" ? body.projectId : parseInt(String(body.projectId ?? ""), 10);
  if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "Elige un proyecto (projectId requerido)" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  if (!body.productTitle || !body.productCategory || !body.objective || !body.aspect || !body.videoProvider) {
    res.status(400).json({ error: "Campos requeridos: productTitle, productCategory, objective, aspect, videoProvider" });
    return;
  }
  const provider = resolveAdVideoProvider(body.videoProvider);
  if (!provider) {
    res.status(400).json({ error: `Proveedor de vídeo no disponible: "${body.videoProvider}". Recarga la página para ver el catálogo actual.` });
    return;
  }

  const variantsCount = Math.min(Math.max(body.variantsCount || 1, 1), 5);
  const input: AdCampaignInput = {
    projectId,
    productTitle: body.productTitle,
    productCategory: body.productCategory,
    brandName: body.brandName,
    brandTone: body.brandTone,
    niche: body.niche ?? project.storeNiche ?? undefined,
    objective: body.objective,
    targetAudience: body.targetAudience,
    aspect: body.aspect,
    videoProvider: provider.key,
    videoDurationSec: effectiveDuration(provider, Math.min(Math.max(body.videoDurationSec || 6, 3), 10)),
    voiceId: body.voiceId,
    voiceStability: body.voiceStability,
    voiceStyle: body.voiceStyle,
    addMusic: body.addMusic ?? true,
    variantsCount,
    customPrompt: body.customPrompt,
    sourceImageUrl: body.sourceImageUrl,
    heroMode: body.heroMode === "photo" ? "photo" : "scene",
    template: body.template,
    burnSubs: body.burnSubs,
    subsLanguage: body.subsLanguage,
    // Marca + CTA con tipografía real (FFmpeg) en vez de texto inventado por el modelo.
    renderBrandOverlay: body.renderBrandOverlay !== false,
    brandOverlayText: body.brandOverlayText,
    ctaOverlayText: body.ctaOverlayText,
  };

  // Créditos según el coste real del proveedor (vídeo + imagen + voz/música).
  const perAd = creditsPerAd(input)!;
  const totalCredits = perAd * variantsCount;
  const limitCheck = await checkProductionLimit(projectId, "image", totalCredits);
  if (!limitCheck.allowed) {
    res.status(402).json({ error: limitCheck.reason || "Límite de plan alcanzado", planLabel: limitCheck.planLabel, creditsNeeded: totalCredits });
    return;
  }

  const replicateToken = (() => {
    const enc = (project as any)?.replicateApiToken;
    if (!enc) return process.env.REPLICATE_API_TOKEN || undefined;
    try { return safeDecrypt(enc) || enc; } catch { return enc; }
  })();
  if (provider.vendor === "replicate" && !replicateToken) {
    res.status(400).json({ error: `REPLICATE_API_TOKEN requerido para ${provider.label}` });
    return;
  }
  if (provider.vendor === "runway" && !process.env.RUNWAY_API_KEY) {
    res.status(400).json({ error: `RUNWAY_API_KEY requerido para ${provider.label}` });
    return;
  }

  const wantsSSE = String(req.headers.accept || "").includes("text/event-stream");
  let clientGone = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const emit = (event: string, data: any) => {
    if (!wantsSSE || clientGone || res.writableEnded || res.destroyed) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };
  if (wantsSSE) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    req.on("close", () => { clientGone = true; });
    heartbeat = setInterval(() => {
      if (clientGone || res.writableEnded) { if (heartbeat) clearInterval(heartbeat); return; }
      try { res.write(`: ping\n\n`); } catch {}
    }, 25_000);
  }

  try {
    const { variants, errors } = await runAdCampaign(input, replicateToken, (ev) => emit("progress", ev));
    if (clientGone) logger.warn({ projectId }, "ad-studio: client disconnected — persisting results anyway");

    const savedVariants = await persistVariants(projectId, input, variants);
    // Solo se cobran las variantes que llegaron a MP4.
    const successCount = savedVariants.filter(v => v.finalMp4VaultId).length;
    const actualCredits = perAd * successCount;
    if (actualCredits > 0) await recordUsage(projectId, "image", actualCredits);

    learnFromOperation({
      operationType: "ad_studio_campaign",
      niche: input.niche ?? null,
      title: `AdStudio: ${input.productTitle}`,
      content: `Generated ${variants.length} ad variants for "${input.productTitle}" (${input.objective}, ${input.aspect}, ${input.videoDurationSec}s). Provider: ${input.videoProvider}. Hooks: ${variants.map(v => v.copy.hook).join(" | ")}`,
      confidence: 0.9,
      tags: ["ad-studio", "advertising", input.objective, input.videoProvider],
    });

    const result = { success: successCount > 0, variants: savedVariants, errors, creditsCharged: actualCredits, creditsPerAd: perAd };
    if (wantsSSE) {
      emit("complete", result);
      if (!res.writableEnded) res.end();
    } else {
      res.json(result);
    }
  } catch (err: any) {
    logger.error({ err }, "ad-studio: generation failed");
    if (wantsSSE) {
      emit("error", { error: err?.message || "Campaign failed" });
      if (!res.writableEnded) res.end();
    } else if (!res.headersSent) {
      res.status(500).json({ error: err?.message || "Generation failed" });
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
});

// ─── GET /api/ad-studio/templates — curated genre templates ──────────────
router.get("/ad-studio/templates", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const items = listTemplates().map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      heroStyle: t.heroStyle,
      cameraPreset: t.cameraPreset,
      transitionPreset: t.transitionPreset,
      voiceProfile: t.voiceProfile,
      musicBrief: t.musicBrief,
      defaultAspect: t.defaultAspect,
      defaultDurationSec: t.defaultDurationSec,
      recommendLipSync: t.recommendLipSync,
      burnSubsByDefault: t.burnSubsByDefault,
    }));
    res.json({ templates: items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error listando templates" });
  }
});

// ─── POST /api/ad-studio/clone-viral ──────────────────────────────────────
// Body (multipart): file `video` OR JSON { videoUrl }
//   + projectId, productTitle, productCategory, brandName?, brandTone?, niche?,
//     videoProvider?, sourceImageUrl?, voiceId?, objective?, dryRun?
// If dryRun=true, returns ONLY the viral brief without running the campaign
// (useful for the UI to preview the detected format before committing credits).
router.post(
  "/ad-studio/clone-viral",
  requireAdmin,
  upload.single("video"),
  async (req: Request, res: Response): Promise<void> => {
    enableLongRunning(res);
    try {
      const f = req.file;
      const body = req.body as {
        projectId?: string | number;
        videoUrl?: string;
        productTitle?: string;
        productCategory?: string;
        brandName?: string;
        brandTone?: string;
        niche?: string;
        videoProvider?: string;
        sourceImageUrl?: string;
        voiceId?: string;
        objective?: string;
        dryRun?: string | boolean;
      };
      const projectId = typeof body.projectId === "number" ? body.projectId : parseInt(String(body.projectId ?? "0"), 10);
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      // Resolve viral video buffer (uploaded file OR remote URL)
      let viralBuf: Buffer | undefined;
      if (f?.buffer) viralBuf = f.buffer;
      else if (body.videoUrl && /^https?:\/\//.test(body.videoUrl)) {
        try {
          viralBuf = await fetchToBuffer(body.videoUrl);
        } catch (err: any) {
          res.status(400).json({ error: `No se pudo descargar el video viral: ${err?.message || err}` });
          return;
        }
      }
      if (!viralBuf || viralBuf.length < 1024) {
        res.status(400).json({ error: "Video viral requerido (file `video` o `videoUrl` accesible públicamente)" });
        return;
      }

      const replicateToken = (() => {
        const enc = (project as any)?.replicateApiToken;
        if (!enc) return process.env.REPLICATE_API_TOKEN || undefined;
        try { return safeDecrypt(enc) || enc; } catch { return enc; }
      })();

      // STEP 1: analyze (always run, cheap-ish)
      const brief = await analyzeViralVideo(viralBuf, {
        projectId,
        niche: body.niche ?? project.storeNiche ?? undefined,
        replicateToken,
      });

      const dryRun = body.dryRun === true || body.dryRun === "true" || body.dryRun === "1";
      if (dryRun) {
        res.json({ success: true, dryRun: true, brief });
        return;
      }

      // STEP 2: campaign requires product info
      if (!body.productTitle || !body.productCategory) {
        res.status(400).json({
          error: "productTitle y productCategory requeridos para ejecutar campaña (usa dryRun=true para ver el brief sin generar)",
          brief,
        });
        return;
      }

      const provider = resolveAdVideoProvider(body.videoProvider || "hailuo-2.3");
      if (!provider) {
        res.status(400).json({ error: `Proveedor de vídeo no disponible: "${body.videoProvider}"`, brief });
        return;
      }
      if (provider.vendor === "replicate" && !replicateToken) {
        res.status(400).json({ error: `REPLICATE_API_TOKEN requerido para ${provider.label}`, brief });
        return;
      }

      const campaignInput = briefToCampaignInput(brief, {
        projectId,
        productTitle: body.productTitle,
        productCategory: body.productCategory,
        brandName: body.brandName,
        brandTone: body.brandTone,
        niche: body.niche ?? project.storeNiche ?? undefined,
        sourceImageUrl: body.sourceImageUrl,
        videoProvider: provider.key,
        voiceId: body.voiceId,
        objective: (body.objective as AdCampaignInput["objective"]) || "awareness",
      });
      campaignInput.videoDurationSec = effectiveDuration(provider, campaignInput.videoDurationSec);

      const totalCredits = creditsPerAd(campaignInput)!; // 1 variante
      const limitCheck = await checkProductionLimit(projectId, "image", totalCredits);
      if (!limitCheck.allowed) {
        res.status(402).json({ error: limitCheck.reason || "Límite de plan alcanzado", brief, creditsNeeded: totalCredits });
        return;
      }

      // Persist viral video to vault for traceability
      const viralVaultId = await saveToVault({
        projectId, fileType: "viral-source", category: "ad-studio",
        title: `Viral source: ${brief.template} (${brief.aspect})`,
        mimeType: f?.mimetype || "video/mp4",
        generatedBy: "ad-studio:clone-viral",
        content: viralBuf.toString("base64"),
        fileSizeBytes: viralBuf.length,
      });

      const result = await runAdCampaign(campaignInput, replicateToken);
      const variants = await persistVariants(projectId, campaignInput, result.variants, "Formato viral");
      const errors = [...result.errors];

      const successCount = variants.filter(v => v.finalMp4VaultId).length;
      const actualCredits = totalCredits * successCount;
      if (actualCredits > 0) await recordUsage(projectId, "image", actualCredits);
      learnFromOperation({
        operationType: "ad_studio_clone_viral",
        niche: campaignInput.niche ?? null,
        title: `Clone viral: ${body.productTitle}`,
        content: `Replicated viral format ${brief.template}`,
        confidence: 0.85,
        tags: ["ad-studio", "clone-viral", brief.template],
      });

      res.json({ success: successCount > 0, brief, viralVaultId, variants, errors, creditsCharged: actualCredits, creditsUsed: totalCredits });
    } catch (err: any) {
      logger.error({ err }, "ad-studio: clone-viral failed");
      res.status(500).json({ error: err?.message || "Error en clone viral" });
    }
  },
);

export default router;
