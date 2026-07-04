/**
 * AI Model Catalog API
 * Expone el catálogo dinámico de modelos IA, el sistema de routing inteligente,
 * y el job de investigación automática.
 */
import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import {
  ensureAmisMigration,
  runAiModelResearch,
  getBestModelForTask,
  getCatalogModels,
  getRecentUpdates,
  getCatalogStats,
  updateRoutingRule,
} from "../lib/ai-model-intelligence.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── STATS GENERALES ──────────────────────────────────────────────────────────
router.get("/ai-catalog/stats", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const stats = await getCatalogStats();
    res.json(stats);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── LISTAR MODELOS ───────────────────────────────────────────────────────────
router.get("/ai-catalog/models", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { category, provider, budget, search, limit } = req.query as Record<string, string>;
    const models = await getCatalogModels({
      category,
      provider,
      budget: budget as "economy" | "balanced" | "quality" | undefined,
      search,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ models, total: models.length });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── SMART ROUTING ────────────────────────────────────────────────────────────
router.get("/ai-catalog/route", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { task, budget = "balanced" } = req.query as Record<string, string>;
    if (!task) { res.status(400).json({ error: "task requerido (ej: product_photography, video_generation)" }); return; }

    const recommendations = await getBestModelForTask(task, budget as "economy" | "balanced" | "quality");
    res.json({
      task,
      budget,
      recommendations,
      hint: "Usar recommendations[0] para el resultado óptimo, [1] como fallback",
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── ROUTING PARA MÚLTIPLES TASKS A LA VEZ ───────────────────────────────────
router.post("/ai-catalog/route-batch", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { tasks, budget = "balanced" } = req.body as { tasks: string[]; budget?: string };
    if (!Array.isArray(tasks) || !tasks.length) { res.status(400).json({ error: "tasks[] requerido" }); return; }

    const results: Record<string, unknown> = {};
    await Promise.all(tasks.map(async task => {
      results[task] = await getBestModelForTask(task, budget as "economy" | "balanced" | "quality");
    }));
    res.json({ budget, results });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── ACTUALIZACIONES RECIENTES ────────────────────────────────────────────────
router.get("/ai-catalog/updates", requireAdmin, async (req, res): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const updates = await getRecentUpdates(limit);
    res.json({ updates, total: updates.length });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── DISPARAR INVESTIGACIÓN MANUAL ───────────────────────────────────────────
router.post("/ai-catalog/research", requireAdmin, async (req, res): Promise<void> => {
  try {
    logger.info({ req: "ai-catalog-research" }, "Investigación manual de modelos IA iniciada");
    // Ejecutar en background para no bloquear la respuesta
    runAiModelResearch()
      .then(summary => logger.info({ summary }, "Investigación completada"))
      .catch(err => logger.error({ err }, "Error en investigación de modelos"));

    res.json({
      success: true,
      message: "Investigación iniciada en background. Consulta /api/ai-catalog/stats en unos minutos.",
      started_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── RESEARCH SINCRÓNICO (ADMIN ESPERA EL RESULTADO) ─────────────────────────
router.post("/ai-catalog/research-sync", requireAdmin, async (req, res): Promise<void> => {
  try {
    logger.info({ req: "ai-catalog-research-sync" }, "Investigación síncrona de modelos IA");
    const summary = await runAiModelResearch();
    res.json({ success: true, summary });
  } catch (err: unknown) {
    logger.error({ err: (err as Error).message }, "Error en investigación síncrona");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── ACTUALIZAR REGLA DE ROUTING ─────────────────────────────────────────────
router.put("/ai-catalog/routing-rule", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { task_type, budget, model_key, fallback_model, priority } = req.body as Record<string, unknown>;
    if (!task_type || !budget || !model_key) {
      res.status(400).json({ error: "task_type, budget y model_key requeridos" }); return;
    }
    await updateRoutingRule({
      task_type:     String(task_type),
      budget:        String(budget),
      model_key:     String(model_key),
      fallback_model: fallback_model ? String(fallback_model) : undefined,
      priority:      priority != null ? Number(priority) : 0,
    });
    res.json({ success: true, message: `Regla actualizada: ${task_type} · ${budget} → ${model_key}` });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── LISTAR TIPOS DE TASK DISPONIBLES ────────────────────────────────────────
router.get("/ai-catalog/tasks", requireAdmin, async (_req, res): Promise<void> => {
  res.json({
    tasks: [
      { id: "product_photography",   label: "Fotografía de Producto",     categories: ["image"] },
      { id: "social_media_image",    label: "Imagen para Redes Sociales",  categories: ["image"] },
      { id: "logo_design",           label: "Diseño de Logo",             categories: ["image"] },
      { id: "image_editing",         label: "Edición de Imagen",          categories: ["image"] },
      { id: "image_upscaling",       label: "Upscaling de Imagen",        categories: ["upscale"] },
      { id: "background_removal",    label: "Eliminación de Fondo",       categories: ["edit"] },
      { id: "recolor",               label: "Recolorización",             categories: ["edit"] },
      { id: "expand_image",          label: "Expandir Imagen",            categories: ["edit"] },
      { id: "virtual_tryon",         label: "Probador Virtual de Moda",   categories: ["image"] },
      { id: "video_generation",      label: "Generación de Vídeo (T2V)",  categories: ["video"] },
      { id: "image_to_video",        label: "Imagen a Vídeo (I2V)",       categories: ["video"] },
      { id: "video_with_character",  label: "Vídeo con Referencia de Personaje", categories: ["video"] },
      { id: "text_to_speech",        label: "Texto a Voz (TTS)",          categories: ["audio"] },
      { id: "chat",                  label: "Chat / Generación de Texto",  categories: ["text"] },
      { id: "3d_generation",         label: "Generación 3D",              categories: ["3d"] },
    ],
    budgets: [
      { id: "economy",  label: "Económico — velocidad y coste mínimo" },
      { id: "balanced", label: "Equilibrado — relación calidad/precio" },
      { id: "quality",  label: "Calidad máxima — mejor resultado posible" },
    ],
  });
});

// ─── INIT MIGRATION ON LOAD ───────────────────────────────────────────────────
ensureAmisMigration().catch(err => logger.error({ err }, "AMIS migration error"));

export default router;
