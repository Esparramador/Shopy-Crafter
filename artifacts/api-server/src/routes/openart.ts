/**
 * OpenArt Engine Routes
 * GET  /api/openart/styles          — todos los presets de estilo
 * GET  /api/openart/models          — catálogo de modelos con routing inteligente
 * GET  /api/openart/templates       — biblioteca de plantillas
 * GET  /api/openart/prompt-book     — libro de prompts / técnicas
 * POST /api/openart/build-prompt    — construye prompt desde bloques
 * POST /api/openart/enhance-prompt  — mejora cualquier prompt con IA
 */

import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  STYLE_PRESETS,
  MODEL_CATALOG,
  PROMPT_TEMPLATES,
  PROMPT_BOOK_CHAPTERS,
  PROMPT_BLOCKS,
  buildStructuredPrompt,
  getStylesByCategory,
  getTemplatesByCategory,
  recommendModels,
} from "../lib/openart-engine.js";
import { askClaude } from "../lib/claude.js";

const router = Router();

// ─── GET /api/openart/styles ──────────────────────────────────────────────────
router.get("/api/openart/styles", requireAuth, (req, res) => {
  const { category, tag, q } = req.query as Record<string, string>;
  let styles = STYLE_PRESETS;
  if (category) styles = styles.filter(s => s.category.toLowerCase() === category.toLowerCase());
  if (tag)      styles = styles.filter(s => s.tags.includes(tag.toLowerCase()));
  if (q)        styles = styles.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.description.toLowerCase().includes(q.toLowerCase()) ||
    s.tags.some(t => t.includes(q.toLowerCase()))
  );
  res.json({ styles, byCategory: getStylesByCategory(), total: STYLE_PRESETS.length });
});

// ─── GET /api/openart/models ──────────────────────────────────────────────────
router.get("/api/openart/models", requireAuth, (req, res) => {
  const { type, quality, styleId, useCase } = req.query as Record<string, string>;
  const task = (type === "video" ? "video" : "image") as "image" | "video";
  const recommended = recommendModels(task, styleId, useCase);
  const filtered = quality ? recommended.filter(m => m.quality === quality) : recommended;
  res.json({ models: filtered, total: MODEL_CATALOG.length });
});

// ─── GET /api/openart/templates ───────────────────────────────────────────────
router.get("/api/openart/templates", requireAuth, (req, res) => {
  const { category, tag, q } = req.query as Record<string, string>;
  let templates = PROMPT_TEMPLATES;
  if (category) templates = templates.filter(t => t.category.toLowerCase() === category.toLowerCase());
  if (tag)      templates = templates.filter(t => t.tags.includes(tag.toLowerCase()));
  if (q)        templates = templates.filter(t =>
    t.name.toLowerCase().includes(q.toLowerCase()) ||
    t.prompt.toLowerCase().includes(q.toLowerCase()) ||
    t.tags.some(x => x.includes(q.toLowerCase()))
  );
  res.json({ templates, byCategory: getTemplatesByCategory(), total: PROMPT_TEMPLATES.length });
});

// ─── GET /api/openart/prompt-book ────────────────────────────────────────────
router.get("/api/openart/prompt-book", requireAuth, (req, res) => {
  const { chapter } = req.query as Record<string, string>;
  if (chapter) {
    const ch = PROMPT_BOOK_CHAPTERS.find(c => c.id === chapter);
    if (!ch) return res.status(404).json({ error: "Capítulo no encontrado" });
    return res.json(ch);
  }
  res.json({ chapters: PROMPT_BOOK_CHAPTERS, blocks: PROMPT_BLOCKS });
});

// ─── GET /api/openart/blocks ──────────────────────────────────────────────────
router.get("/api/openart/blocks", requireAuth, (req, res) => {
  res.json(PROMPT_BLOCKS);
});

// ─── POST /api/openart/build-prompt ──────────────────────────────────────────
router.post("/api/openart/build-prompt", requireAuth, async (req, res) => {
  const {
    subject,
    styleId,
    composition = "professional composition",
    lighting = "professional studio lighting",
    mood = "high quality professional",
    qualityTier = "premium",
    customSuffix,
  } = req.body;

  if (!subject?.trim()) return res.status(400).json({ error: "subject requerido" });

  try {
    const result = buildStructuredPrompt(
      subject,
      styleId || null,
      composition,
      lighting,
      mood,
      qualityTier as "standard" | "premium" | "ultra",
      customSuffix,
    );
    res.json({ prompt: result, recommendedModel: result.stylePreset?.recommendedModel || "flux-pro" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/openart/enhance-prompt ─────────────────────────────────────────
router.post("/api/openart/enhance-prompt", requireAuth, async (req, res) => {
  const { prompt, styleId, target = "image", language = "es", mode = "enhance" } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt requerido" });

  const preset = styleId ? STYLE_PRESETS.find(s => s.id === styleId) : null;
  const styleContext = preset ? `Aplica el estilo "${preset.name}": ${preset.promptSuffix}` : "";

  const modeInstructions: Record<string, string> = {
    enhance: "Mejora y amplía el prompt manteniendo la idea original. Añade detalles de iluminación, composición, calidad y estilo.",
    rewrite: "Reescribe completamente el prompt siguiendo la fórmula OpenArt: Sujeto + Estilo + Composición + Iluminación + Ánimo + Calidad.",
    translate: "Traduce el prompt al inglés perfecto manteniendo todos los conceptos.",
    variations: "Genera 3 variaciones del prompt con diferentes enfoques creativos.",
    negative: "Genera el prompt negativo perfecto para este prompt principal.",
  };

  const instruction = modeInstructions[mode] || modeInstructions.enhance;

  const systemPrompt = `Eres un experto en ingeniería de prompts para IA generativa (Stable Diffusion, FLUX, Midjourney, DALL-E).
Conoces perfectamente la fórmula OpenArt: [Sujeto] + [Estilo] + [Composición] + [Iluminación] + [Ánimo] + [Modificadores de calidad].
Los mejores prompts tienen 30-75 palabras, están en inglés, son específicos y evitan redundancias.
${styleContext}
Responde SOLO con el/los prompt(s) mejorado(s), sin explicaciones adicionales.`;

  const userMsg = `Prompt original: "${prompt}"
Tarea: ${instruction}
Target: ${target === "video" ? "generación de vídeo AI (describe movimiento y escena)" : "generación de imagen AI"}`;

  try {
    const enhanced = await (askClaude as any)(systemPrompt, userMsg, { maxTokens: 1000 });
    const negativePrompt = preset ? preset.negativePrompt : "low quality, blurry, watermark, text, logo, distorted, ugly, amateur";
    res.json({ enhanced, negativePrompt, originalPrompt: prompt, style: preset?.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/openart/analyze-prompt ────────────────────────────────────────
router.post("/api/openart/analyze-prompt", requireAuth, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt requerido" });

  const systemPrompt = `Analiza el prompt de imagen IA y devuelve un JSON con esta estructura exacta:
{
  "score": número del 1-100 (calidad estimada),
  "subject": "sujeto principal detectado o null",
  "style": "estilo artístico detectado o null",
  "lighting": "iluminación detectada o null",
  "mood": "estado de ánimo detectado o null",
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "weaknesses": ["debilidad 1", "debilidad 2"],
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"],
  "missingBlocks": ["bloque que falta 1", "bloque que falta 2"]
}`;

  try {
    const response = await (askClaude as any)(systemPrompt, `Prompt: "${prompt}"`, { maxTokens: 600 });
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON en respuesta");
    res.json(JSON.parse(match[0]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/openart/template-fill ─────────────────────────────────────────
router.post("/api/openart/template-fill", requireAuth, async (req, res) => {
  const { templateId, variables, styleId } = req.body;
  const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return res.status(404).json({ error: "Template no encontrado" });

  let filled = template.prompt;
  for (const [key, value] of Object.entries(variables || {})) {
    filled = filled.replace(new RegExp(`{{${key}}}`, "g"), String(value));
  }

  const preset = styleId ? STYLE_PRESETS.find(s => s.id === styleId) : null;
  if (preset) {
    filled = `${filled}, ${preset.promptSuffix}`;
  }

  const negative = preset?.negativePrompt || "low quality, blurry, watermark, distorted, ugly";
  res.json({ prompt: filled, negativePrompt: negative, template: template.name, style: preset?.name });
});

export default router;
