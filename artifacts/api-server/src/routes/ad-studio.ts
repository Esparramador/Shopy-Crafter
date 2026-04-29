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
import fs from "node:fs/promises";

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
      { key: "veo-3",                 label: "Google Veo 3",           tier: "premium",  costPerAd: 6.00, quality: 10, description: "Audio nativo + máxima fidelidad (16:9, 8s)" },
      { key: "veo-3-fast",            label: "Google Veo 3 Fast",      tier: "premium",  costPerAd: 3.20, quality: 9,  description: "Veo 3 más rápido y económico (16:9, 8s)" },
      { key: "replicate-kling-master",label: "Kling Master 2.1",       tier: "premium",  costPerAd: 1.80, quality: 10, description: "Top motion, audio nativo, multi-shot" },
      // ── Standard ──
      { key: "runway-gen3",           label: "Runway Gen-3 Alpha",     tier: "standard", costPerAd: 0.40, quality: 8,  description: "Mejor precio que Gen-4" },
      { key: "veo-2",                 label: "Google Veo 2",           tier: "standard", costPerAd: 2.80, quality: 8,  description: "Soporta 9:16 y 16:9, hasta 8s" },
      { key: "replicate-kling",       label: "Kling 2.1",              tier: "standard", costPerAd: 0.90, quality: 9,  description: "1080p motion realista hasta 10s" },
      { key: "replicate-seedance-pro",label: "Seedance Pro",           tier: "standard", costPerAd: 0.70, quality: 9,  description: "Cinema quality, multi-reference (9 imgs)" },
      // ── Economy ──
      { key: "replicate-seedance-fast", label: "Seedance Fast",        tier: "economy",  costPerAd: 0.25, quality: 7,  description: "El más rápido a buen precio" },
      { key: "replicate-hailuo",      label: "Hailuo 02",              tier: "economy",  costPerAd: 0.30, quality: 7,  description: "Motion suave, balance velocidad/calidad" },
      { key: "replicate-wan-fast",    label: "Wan 2.5 Fast",           tier: "economy",  costPerAd: 0.10, quality: 6,  description: "Open-source, el más barato del mercado" },
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

      // Record usage
      await recordUsage(projectId, "image", totalCredits);

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
        success: true,
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

    await recordUsage(projectId, "image", totalCredits);
    learnFromOperation({
      operationType: "ad_studio_campaign",
      niche: input.niche ?? null,
      title: `AdStudio: ${input.productTitle}`,
      content: `Generated ${variants.length} ad variants`,
      confidence: 0.9,
      tags: ["ad-studio", "advertising"],
    });

    res.json({ success: true, variants: savedVariants, errors, creditsUsed: totalCredits });
  } catch (err: any) {
    logger.error({ err }, "ad-studio: generation failed");
    res.status(500).json({ error: err?.message || "Generation failed" });
  }
});

export default router;
