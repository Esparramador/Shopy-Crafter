/**
 * Super Ad Studio — endpoints REST que exponen el orquestador super-ad-runner.
 *
 *   POST   /super-ad/upload-ref            (multipart) → guarda imagen ref en vault
 *   POST   /super-ad/storyboard            JSON → Claude genera storyboard editable
 *   POST   /super-ad/run                   JSON storyboard → arranca job, devuelve jobId
 *   GET    /super-ad/jobs/:jobId           estado + log + result
 *   GET    /super-ad/jobs?projectId=X      historial
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { eq, desc, and } from "drizzle-orm";
import { db, bulkJobsTable, projectsTable, projectFilesTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { saveToVaultSmart } from "../lib/vault-smart.js";
import { askClaudeJsonWithBrain } from "../lib/claude.js";
import { createSuperAdJob, type SuperAdStoryboard, type ClipSpec } from "../lib/super-ad-runner.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── 1) Upload referencia ─────────────────────────────────────────────────────
router.post("/super-ad/upload-ref", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  try {
    const f = req.file;
    const projectId = parseInt(String(req.body.projectId || "0"), 10);
    const refKey = String(req.body.refKey || `ref-${Date.now()}`).slice(0, 50);
    if (!f || !projectId) { res.status(400).json({ error: "file + projectId requeridos" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const vaultId = await saveToVaultSmart({
      projectId,
      fileType: "super-ad-ref",
      category: "super-ad",
      title: `Super Ad ref: ${refKey} (${f.originalname})`,
      mimeType: f.mimetype,
      generatedBy: "super-ad:upload",
      buffer: f.buffer,
    });
    res.json({ success: true, vaultId, refKey, sizeBytes: f.buffer.length, mimeType: f.mimetype });
  } catch (err: any) {
    logger.error({ err }, "super-ad upload-ref failed");
    res.status(500).json({ error: err?.message || "Error subiendo referencia" });
  }
});

// ─── 2) Generar storyboard con Claude ─────────────────────────────────────────
router.post("/super-ad/storyboard", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId, brand, niche, productDescription, objective, language = "es",
      totalDurationSec = 75, clipCount = 12, aspect = "9:16",
      refs = [], voiceId, brandTone,
    } = req.body as {
      projectId: number;
      brand: string;
      niche?: string;
      productDescription: string;
      objective: string;
      language?: string;
      totalDurationSec?: number;
      clipCount?: number;
      aspect?: "9:16" | "16:9" | "1:1";
      refs?: Array<{ refKey: string; vaultId: number; description?: string }>;
      voiceId?: string;
      brandTone?: string;
    };

    if (!projectId || !brand || !productDescription) {
      res.status(400).json({ error: "projectId, brand, productDescription requeridos" });
      return;
    }

    const safeClipCount = Math.max(3, Math.min(15, clipCount));
    const refsBlock = refs.length
      ? "REFERENCIAS DISPONIBLES (puedes asociar cada una a un clip vía refKey):\n" +
        refs.map(r => `  - ${r.refKey}${r.description ? ` — ${r.description}` : ""}`).join("\n")
      : "Sin referencias visuales (text-to-video puro)";

    const systemPrompt = `Eres director creativo experto en anuncios cortos verticales para Instagram/TikTok/YouTube Shorts.
Generas storyboards profesionales tipo Pollo.ai/Omneky con narrativa cinemática, aprovechando hand-printed/cinematic/UGC styles según la marca.

REGLAS:
- Devuelves SOLO JSON válido, sin texto fuera del JSON.
- Cada clip tiene un prompt SUPER detallado en INGLÉS para el modelo de video (mínimo 60 palabras): describe escena, encuadre, modelo, ropa, colores exactos, iluminación, composición, estilo cinematográfico.
- Si la marca tiene referencias visuales reales (refs), úsalas vía refKey para image-to-video y describe que el resultado debe preservar exactamente esa imagen.
- Distribuye la duración total entre los clips (5-8s cada uno típicamente).
- Estructura narrativa: intro/branding (1-2 clips) → presentación de producto (varios clips) → proceso/diferenciador (1-2 clips) → social proof / lifestyle (varios clips) → CTA outro (1 clip).
- voiceText: guion en ${language === "es" ? "español" : language} natural, ~175 palabras por minuto, fiel al producto. Cierre con CTA y URL si aplica.
- musicPrompts: usa "intro" + "body" para mejor narrativa (intro ambient/cinematic, body con emoción/drums). Ambos en INGLÉS, describiendo género, instrumentos, BPM y mood.
- voiceModelId: usa "eleven_multilingual_v2" por defecto.`;

    const userPrompt = `Genera storyboard para anuncio profesional 9:16:

MARCA: ${brand}
NICHO: ${niche || "no especificado"}
PRODUCTO/COLECCIÓN: ${productDescription}
OBJETIVO: ${objective}
TONO DE MARCA: ${brandTone || "profesional, auténtico"}
DURACIÓN TOTAL: ${totalDurationSec}s
NÚMERO DE CLIPS: ${safeClipCount}
ASPECT: ${aspect}
IDIOMA VOZ: ${language}

${refsBlock}

VOICE_ID DEFAULT (no lo cambies salvo que la marca pida algo específico): ${voiceId || "21m00Tcm4TlvDq8ikWAM"}

Devuelve EXACTAMENTE este JSON:
{
  "brand": "${brand}",
  "niche": "${niche || ""}",
  "language": "${language}",
  "voiceId": "${voiceId || "21m00Tcm4TlvDq8ikWAM"}",
  "voiceModelId": "eleven_multilingual_v2",
  "voiceText": "...",
  "musicPrompts": { "intro": "...", "body": "..." },
  "voiceVolume": 1.0,
  "musicVolume": 0.18,
  "width": 1080, "height": 1920, "fps": 30, "crossfadeSec": 0.35,
  "clips": [
    { "key": "c01-...", "model": "seedance-pro", "duration": 5, "aspect": "${aspect}", "prompt": "...", "refKey": "modelo1" }
  ]
}`;

    const storyboard = await askClaudeJsonWithBrain<SuperAdStoryboard & { clips: Array<ClipSpec & { refKey?: string }> }>(
      projectId, userPrompt, systemPrompt, "general", niche, 16000, 180_000,
    );

    // Mapear refKey → refVaultId
    const refMap = new Map(refs.map(r => [r.refKey, r.vaultId]));
    storyboard.clips = storyboard.clips.map(c => {
      const out: ClipSpec = {
        key: c.key,
        model: c.model || "seedance-pro",
        duration: typeof c.duration === "number" ? c.duration : 5,
        aspect: (c.aspect as any) || aspect,
        prompt: c.prompt,
      };
      const refKey = (c as any).refKey;
      if (refKey && refMap.has(refKey)) out.refVaultId = refMap.get(refKey);
      return out;
    });

    res.json({ success: true, storyboard });
  } catch (err: any) {
    logger.error({ err }, "super-ad storyboard failed");
    res.status(500).json({ error: err?.message || "Error generando storyboard" });
  }
});

// ─── 3) Run super ad job ──────────────────────────────────────────────────────
router.post("/super-ad/run", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, storyboard } = req.body as { projectId: number; storyboard: SuperAdStoryboard };
    if (!projectId || !storyboard?.clips?.length) {
      res.status(400).json({ error: "projectId + storyboard.clips[] requeridos" });
      return;
    }
    if (!storyboard.voiceId || !storyboard.voiceText) {
      res.status(400).json({ error: "storyboard.voiceId + voiceText requeridos" });
      return;
    }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const jobId = await createSuperAdJob(projectId, storyboard);
    res.json({ success: true, jobId, totalSteps: storyboard.clips.length + 1 + (storyboard.musicPrompts.intro && storyboard.musicPrompts.body ? 3 : (storyboard.musicPrompts.single ? 1 : 0)) + 1 });
  } catch (err: any) {
    logger.error({ err }, "super-ad run failed");
    res.status(500).json({ error: err?.message || "Error arrancando job" });
  }
});

// ─── 4) GET job by id ─────────────────────────────────────────────────────────
router.get("/super-ad/jobs/:jobId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.jobId);
    const [job] = await db.select().from(bulkJobsTable).where(eq(bulkJobsTable.jobId, jobId));
    if (!job) { res.status(404).json({ error: "Job no encontrado" }); return; }
    res.json({
      jobId: job.jobId,
      projectId: job.projectId,
      status: job.status,
      totalItems: job.totalItems,
      completedItems: job.completedItems,
      failedItems: job.failedItems,
      log: job.log || [],
      result: job.result,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error" });
  }
});

// ─── 5) GET jobs lista ────────────────────────────────────────────────────────
router.get("/super-ad/jobs", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.query.projectId || "0"), 10);
    if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
    const rows = await db.select({
      jobId: bulkJobsTable.jobId,
      status: bulkJobsTable.status,
      totalItems: bulkJobsTable.totalItems,
      completedItems: bulkJobsTable.completedItems,
      result: bulkJobsTable.result,
      createdAt: bulkJobsTable.createdAt,
      updatedAt: bulkJobsTable.updatedAt,
    })
      .from(bulkJobsTable)
      .where(and(eq(bulkJobsTable.projectId, projectId), eq(bulkJobsTable.jobType, "super-ad")))
      .orderBy(desc(bulkJobsTable.createdAt))
      .limit(50);
    res.json({ jobs: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error" });
  }
});

export default router;
