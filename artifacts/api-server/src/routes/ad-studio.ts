import { Router, type Request, type Response } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { enableLongRunning } from "../lib/long-running.js";
import { saveToVault } from "../lib/vault.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { learnFromOperation } from "../lib/claude.js";
import { runAdCampaign, AD_CREDIT_COST, type AdCampaignInput } from "../lib/adstudio.js";
import { listTemplates, AD_TEMPLATES, type AdTemplateKey } from "../lib/ad-templates.js";
import { analyzeViralVideo, briefToCampaignInput } from "../lib/viral-clone.js";
import { fetchToBuffer } from "../lib/fusion-studio-pro.js";
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

// ─── GET /api/ad-studio/providers — video providers catalog ──────────────
router.get("/ad-studio/providers", requireAdmin, async (_req, res): Promise<void> => {
  res.json({
    videoProviders: [
      // ── Premium (top calidad) ──
      { key: "runway-gen4-turbo",     label: "Runway Gen-4 Turbo",     tier: "premium",  costPerAd: 0.60, quality: 10, description: "Calidad cine, máximo control" },
      // ── Standard ──
      { key: "runway-gen3",           label: "Runway Gen-3 Alpha",     tier: "standard", costPerAd: 0.40, quality: 8,  description: "Mejor precio que Gen-4" },
      { key: "replicate-kling",       label: "Kling 2.1",              tier: "standard", costPerAd: 0.90, quality: 9,  description: "1080p motion realista hasta 10s" },
      // ── Economy ──
      { key: "replicate-seedance-fast", label: "Seedance Fast",        tier: "economy",  costPerAd: 0.25, quality: 7,  description: "El más rápido a buen precio" },
      { key: "replicate-hailuo",      label: "Hailuo 02",              tier: "economy",  costPerAd: 0.30, quality: 7,  description: "Motion suave, balance velocidad/calidad" },
    ],
    aspects: ["9:16", "16:9", "1:1", "4:5"],
    durations: [3, 5, 6, 8, 10],
    objectives: ["awareness", "conversion", "retargeting", "ugc", "story"],
    creditCostPerAd: AD_CREDIT_COST,
  });
});

// ─── POST /api/ad-studio/generate-campaign — run full pipeline ───────────
// Streams progress via SSE if Accept: text/event-stream, else waits and returns JSON
router.post("/ad-studio/generate-campaign", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);

  const body = req.body as Partial<AdCampaignInput>;
  const projectId = typeof body.projectId === "number" ? body.projectId : parseInt(String(body.projectId ?? "0"), 10);
  if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  // Validate required inputs
  if (!body.productTitle || !body.productCategory || !body.objective || !body.aspect || !body.videoProvider) {
    res.status(400).json({ error: "Campos requeridos: productTitle, productCategory, objective, aspect, videoProvider" });
    return;
  }

  // Check plan: each variant = AD_CREDIT_COST (6) credits
  const variantsCount = Math.min(Math.max(body.variantsCount || 1, 1), 5);
  const totalCredits = AD_CREDIT_COST * variantsCount;
  const limitCheck = await checkProductionLimit(projectId, "image", totalCredits);
  if (!limitCheck.allowed) {
    res.status(402).json({ error: limitCheck.reason || "Límite de plan alcanzado", planLabel: limitCheck.planLabel });
    return;
  }

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
    videoProvider: body.videoProvider,
    videoDurationSec: Math.min(Math.max(body.videoDurationSec || 5, 3), 10),
    voiceId: body.voiceId,
    voiceStability: body.voiceStability,
    voiceStyle: body.voiceStyle,
    addMusic: body.addMusic ?? true,
    variantsCount,
    customPrompt: body.customPrompt,
    sourceImageUrl: body.sourceImageUrl,
    template: body.template,
    burnSubs: body.burnSubs,
    subsLanguage: body.subsLanguage,
  };

  const replicateToken = (project as any).replicateApiKey || process.env.REPLICATE_API_TOKEN || undefined;
  if (input.videoProvider.startsWith("replicate-") && !replicateToken) {
    res.status(400).json({ error: "REPLICATE_API_TOKEN requerido para proveedor Replicate" });
    return;
  }

  // Detect SSE client
  const wantsSSE = String(req.headers.accept || "").includes("text/event-stream");

  if (wantsSSE) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const emit = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { variants, errors } = await runAdCampaign(input, replicateToken, (ev) => emit("progress", ev));

      // Persist assets to vault and build response
      const savedVariants = await Promise.all(variants.map(async (v, idx) => {
        const saved: any = { copy: v.copy, variantIndex: idx, error: v.assets.error };
        try {
          if (v.assets.finalMp4Path) {
            const buf = await fs.readFile(v.assets.finalMp4Path);
            const vaultId = await saveToVault({
              projectId, fileType: "ad-studio-video", category: "ad-studio",
              title: `AdStudio: ${v.copy.hook}`,
              mimeType: "video/mp4", generatedBy: `ad-studio:${input.videoProvider}`,
              content: buf.toString("base64"),
            });
            saved.finalMp4VaultId = vaultId;
          }
          if (v.assets.heroImagePath) {
            const buf = await fs.readFile(v.assets.heroImagePath);
            const vaultId = await saveToVault({
              projectId, fileType: "ad-studio-hero", category: "ad-studio",
              title: `AdStudio hero: ${v.copy.hook}`,
              mimeType: "image/png", generatedBy: "ad-studio:nano-banana",
              content: buf.toString("base64"),
            });
            saved.heroImageVaultId = vaultId;
          }
          if (v.assets.voicePath) {
            const buf = await fs.readFile(v.assets.voicePath);
            const vaultId = await saveToVault({
              projectId, fileType: "ad-studio-voice", category: "ad-studio",
              title: `AdStudio voice: ${v.copy.hook}`,
              mimeType: "audio/mpeg", generatedBy: "ad-studio:elevenlabs",
              content: buf.toString("base64"),
            });
            saved.voiceVaultId = vaultId;
          }
        } catch (saveErr: any) {
          logger.error({ err: saveErr, idx }, "ad-studio: vault save failed");
          saved.saveError = saveErr?.message;
        }
        return saved;
      }));

      // Record usage proportional to successful variants only (no charge if all failed)
      const successCount = savedVariants.filter(v => v.finalMp4VaultId).length;
      const actualCredits = AD_CREDIT_COST * successCount;
      if (actualCredits > 0) await recordUsage(projectId, "image", actualCredits);

      // Feed brain
      learnFromOperation({
        operationType: "ad_studio_campaign",
        niche: input.niche ?? null,
        title: `AdStudio: ${input.productTitle}`,
        content: `Generated ${variants.length} ad variants for "${input.productTitle}" (${input.objective}, ${input.aspect}, ${input.videoDurationSec}s). Provider: ${input.videoProvider}. Hooks: ${variants.map(v => v.copy.hook).join(" | ")}`,
        confidence: 0.9,
        tags: ["ad-studio", "advertising", input.objective, input.videoProvider],
      });

      emit("complete", {
        success: successCount > 0,
        creditsCharged: actualCredits,
        variants: savedVariants,
        errors,
        creditsUsed: totalCredits,
      });
      res.end();
    } catch (err: any) {
      emit("error", { error: err?.message || "Campaign failed" });
      res.end();
    }
    return;
  }

  // Non-SSE fallback: plain JSON (long poll)
  try {
    const { variants, errors } = await runAdCampaign(input, replicateToken);

    const savedVariants = await Promise.all(variants.map(async (v, idx) => {
      const saved: any = { copy: v.copy, variantIndex: idx, error: v.assets.error };
      try {
        if (v.assets.finalMp4Path) {
          const buf = await fs.readFile(v.assets.finalMp4Path);
          const vaultId = await saveToVault({
            projectId, fileType: "ad-studio-video", category: "ad-studio",
            title: `AdStudio: ${v.copy.hook}`,
            mimeType: "video/mp4", generatedBy: `ad-studio:${input.videoProvider}`,
            content: buf.toString("base64"),
          });
          saved.finalMp4VaultId = vaultId;
        }
      } catch (e: any) {
        saved.saveError = e?.message;
      }
      return saved;
    }));

    const successCount = savedVariants.filter(v => v.finalMp4VaultId).length;
    const actualCredits = AD_CREDIT_COST * successCount;
    if (actualCredits > 0) await recordUsage(projectId, "image", actualCredits);
    learnFromOperation({
      operationType: "ad_studio_campaign",
      niche: input.niche ?? null,
      title: `AdStudio: ${input.productTitle}`,
      content: `Generated ${variants.length} ad variants`,
      confidence: 0.9,
      tags: ["ad-studio", "advertising"],
    });

    res.json({ success: successCount > 0, variants: savedVariants, errors, creditsCharged: actualCredits, creditsUsed: totalCredits });
  } catch (err: any) {
    logger.error({ err }, "ad-studio: generation failed");
    res.status(500).json({ error: err?.message || "Generation failed" });
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

      const replicateToken = (project as any).replicateApiKey || process.env.REPLICATE_API_TOKEN || undefined;

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

      const totalCredits = AD_CREDIT_COST; // 1 variant
      const limitCheck = await checkProductionLimit(projectId, "image", totalCredits);
      if (!limitCheck.allowed) {
        res.status(402).json({ error: limitCheck.reason || "Límite de plan alcanzado", brief });
        return;
      }

      const provider = (body.videoProvider as AdCampaignInput["videoProvider"]) || "runway-gen4-turbo";
      if (provider.startsWith("replicate-") && !replicateToken) {
        res.status(400).json({ error: "REPLICATE_API_TOKEN requerido para proveedor Replicate", brief });
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
        videoProvider: provider,
        voiceId: body.voiceId,
        objective: (body.objective as AdCampaignInput["objective"]) || "awareness",
      });

      // Persist viral video to vault for traceability
      const viralVaultId = await saveToVault({
        projectId, fileType: "viral-source", category: "ad-studio",
        title: `Viral source: ${brief.template} (${brief.aspect})`,
        mimeType: f?.mimetype || "video/mp4",
        generatedBy: "ad-studio:clone-viral",
        content: viralBuf.toString("base64"),
        fileSizeBytes: viralBuf.length,
      });

      const variants: any[] = [];
      const errors: string[] = [];
      const result = await runAdCampaign(campaignInput, replicateToken);
      for (const v of result.variants) {
        try {
          const finalBuf = await fs.readFile(v.assets.finalMp4Path!);
          const vaultId = await saveToVault({
            projectId, fileType: "ad-final", category: "ad-studio",
            title: `Viral clone: ${body.productTitle}`,
            mimeType: "video/mp4", generatedBy: "ad-studio:clone-viral",
            content: finalBuf.toString("base64"),
            fileSizeBytes: finalBuf.length,
          });
          variants.push({ vaultId, copy: v.copy });
        } catch (err: any) {
          errors.push(err?.message || "save failed");
        }
      }
      errors.push(...result.errors);

      const successCount = variants.length;
      const actualCredits = AD_CREDIT_COST * successCount;
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
