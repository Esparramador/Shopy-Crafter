/**
 * Viral Comedy Studio — backend mejorado con YouTube Knowledge Base
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /viral/trends         — tendencias del día (Gemini Search + YouTube)
 * POST /viral/script         — genera guión con motor seleccionable
 * POST /viral/score          — calcula puntuación de viralidad
 * GET  /viral/formats        — catálogo completo de formatos de vídeo
 * GET  /viral/comedy-prompts — los 3 prompts de comedia guardados
 * GET  /viral/hooks          — frameworks de hooks
 * GET  /viral/sector/:id     — estrategia por sector
 * POST /viral/log            — registra acción para aprendizaje
 * GET  /viral/log            — historial de acciones
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { askGeminiWithSearch, askGeminiChat } from "../lib/gemini.js";
import { askClaudeDetailed } from "../lib/claude.js";
import { generateAiJson, type AiJsonCaller } from "../lib/ai-json.js";
import { aiOutputErrorMessage, isAiOutputError } from "../lib/ai-errors.js";
import { lenientArray, looseString } from "../lib/ai-schema.js";
import { z } from "zod";

const viralScriptSchema = z.object({
  title: z.string().min(1),
  titleAlternatives: lenientArray(looseString),
  description: z.string().default(""),
  tags: lenientArray(looseString),
  hook: z.string().default(""),
  script: z.string().min(1),
  voiceoverText: z.string().default(""),
  visualPrompt: z.string().default(""),
  thumbnailPrompt: z.string().default(""),
  callToAction: z.string().default(""),
  contentTechniques: lenientArray(looseString),
  viralSignals: z.object({
    hasStrongHook: z.boolean().catch(false),
    hasEmotionalPeak: z.boolean().catch(false),
    hasConflict: z.boolean().catch(false),
    hasPracticalValue: z.boolean().catch(false),
    hasStoryArc: z.boolean().catch(false),
  }).optional().catch(undefined),
  shortsVersion: z.string().default(""),
  postingRecommendation: z.string().default(""),
}).passthrough();
import {
  VIDEO_FORMATS, COMEDY_PROMPTS, HOOK_FRAMEWORKS, SECTOR_STRATEGIES,
  ALGORITHM_SIGNALS, TITLE_PATTERNS, VIRALITY_SIGNALS, buildYouTubeExpertPrompt,
  CONTENT_CATEGORIES, CONTENT_TEMPLATES, buildCategoryPrompt,
  calculateViralityScore, type ViralityInput,
} from "../lib/youtube-knowledge.js";

const router = Router();

// ─── GET /viral/engines — qué motores tienen su API key configurada ──────────
router.get("/viral/engines", requireAdmin, (_req: Request, res: Response) => {
  const grokKey   = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  // Claude funciona vía Replit AI Integrations proxy (AI_INTEGRATIONS_ANTHROPIC_*)
  // O también vía ANTHROPIC_API_KEY directa — cualquiera de las dos cuenta
  const claudeKey = process.env.ANTHROPIC_API_KEY
    || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY
    || process.env.AI_INTEGRATIONS_BASE_URL; // proxy configurado = claude disponible
  const geminiKey = process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.AI_INTEGRATIONS_GEMINI_API_KEY
    || process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
  res.json({
    grok:   !!grokKey,
    claude: !!claudeKey,
    gemini: !!geminiKey,
    _debug: {
      XAI_API_KEY:       !!process.env.XAI_API_KEY,
      GROK_API_KEY:      !!process.env.GROK_API_KEY,
      ANTHROPIC_DIRECT:  !!process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_PROXY:   !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      GEMINI:            !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      GEMINI_PROXY:      !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    },
  });
});

// ─── Ensure DB table ──────────────────────────────────────────────────────────
async function ensureViralTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS viral_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (_) {}
}
ensureViralTable();

// ─── YouTube search helper ────────────────────────────────────────────────────
const YT_API_KEY = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || "";

async function searchYouTubeTrending(query: string, maxResults = 6): Promise<Array<{
  videoId: string; title: string; channelTitle: string;
  thumbnail: string; viewCount: string; watchUrl: string;
  duration?: string; publishedAt?: string;
}>> {
  const key = YT_API_KEY();
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      part: "snippet", q: query, type: "video", order: "viewCount",
      relevanceLanguage: "es", regionCode: "ES",
      maxResults: String(maxResults), key,
    });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!r.ok) return [];
    const data = await r.json() as any;
    const ids = (data.items || []).map((i: any) => i.id?.videoId).filter(Boolean).join(",");
    if (!ids) return [];
    const statsR = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${ids}&key=${key}`);
    const stats: Record<string, any> = {};
    if (statsR.ok) {
      const sd = await statsR.json() as any;
      for (const it of (sd.items || [])) stats[it.id] = it;
    }
    return (data.items || []).map((item: any) => {
      const vid = item.id?.videoId;
      const s = stats[vid] || {};
      const iso = s.contentDetails?.duration || "";
      const dur = iso.replace("PT","").replace("H","h ").replace("M","m ").replace("S","s").trim();
      return {
        videoId: vid, title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnail: item.snippet?.thumbnails?.medium?.url || "",
        viewCount: s.statistics?.viewCount || "0",
        watchUrl: `https://www.youtube.com/watch?v=${vid}`,
        duration: dur, publishedAt: item.snippet?.publishedAt || "",
      };
    }).filter((v: any) => v.videoId);
  } catch (e) {
    logger.warn({ e }, "YouTube trending search failed");
    return [];
  }
}

// ─── Sector → AI video search queries ────────────────────────────────────────
const AI_VIDEO_QUERIES: Record<string, string> = {
  general:               "vídeo generado con inteligencia artificial viral youtube 2025 2026 español",
  politica_satira:       "sátira política inteligencia artificial vídeo viral youtube 2026",
  tecnologia:            "tutorial tecnología inteligencia artificial vídeo viral youtube 2026",
  ecommerce_shopify:     "vídeo producto shopify dropshipping viral tiktok youtube 2026 IA",
  dropshipping:          "dropshipping producto ganador vídeo viral tiktok 2026",
  moda_shopify:          "vídeo moda ropa tienda online viral tiktok 2026 ugc",
  belleza_shopify:       "vídeo belleza skincare viral tiktok ugc shopify 2026",
  gadgets_shopify:       "gadget tecnología producto viral tiktok shopify 2026",
  hogar_shopify:         "producto hogar decoración viral tiktok shopify 2026",
  alimentacion_shopify:  "producto alimentación gourmet viral tiktok shopify 2026",
  fitness_salud:         "rutina fitness inteligencia artificial vídeo viral youtube 2026",
  moda_belleza:          "moda belleza inteligencia artificial vídeo viral youtube 2026",
  educacion_cursos:      "educación explicación inteligencia artificial vídeo viral youtube 2026",
};

// ─── GET /viral/trends ────────────────────────────────────────────────────────
router.get("/viral/trends", requireAdmin, async (req: Request, res: Response) => {
  const country = (req.query.country as string) || "España";
  const sector  = (req.query.sector as string)  || "general";
  try {
    const sectorStrategy = SECTOR_STRATEGIES[sector];
    const ytQuery   = sectorStrategy
      ? `${sectorStrategy.viralTriggers[0]} ${country} 2026`
      : `tendencias virales YouTube ${country} 2026`;
    const aiQuery   = AI_VIDEO_QUERIES[sector] || AI_VIDEO_QUERIES.general;

    const sectorLabel = {
      general:              "cualquier temática",
      politica_satira:      "sátira política",
      tecnologia:           "tecnología e IA",
      ecommerce_shopify:    "ecommerce y Shopify",
      dropshipping:         "dropshipping y productos ganadores",
      moda_shopify:         "moda y ropa online",
      belleza_shopify:      "belleza y skincare",
      gadgets_shopify:      "gadgets y tecnología",
      hogar_shopify:        "hogar y decoración",
      alimentacion_shopify: "alimentación y gourmet",
      fitness_salud:        "fitness y salud",
      moda_belleza:         "moda y belleza",
      educacion_cursos:     "educación y cursos",
    }[sector] || sector;

    // ── Prompts adaptados por sector ─────────────────────────────────────────
    const isEcommerce = sector === "ecommerce_shopify" || sector === "dropshipping"
      || sector === "moda_shopify" || sector === "belleza_shopify"
      || sector === "gadgets_shopify" || sector === "hogar_shopify"
      || sector === "alimentacion_shopify";

    const newsPrompt = isEcommerce
      ? `Eres un experto en ecommerce, Shopify y dropshipping en ${country}.
        Dame las 15 OPORTUNIDADES DE PRODUCTO Y NICHOS MÁS VIRALES ahora mismo para vender en una tienda Shopify en ${country}${sector !== "ecommerce_shopify" ? ` — nicho específico: ${sectorLabel}` : ""}.
        Para cada oportunidad incluye:
        - nombre del producto o nicho (titular corto, máx 80 chars)
        - por qué está explotando ahora (tendencia, viralidad TikTok, seasonal, problema que resuelve)
        - margen estimado y rango de precio de venta
        - competencia actual (baja/media/alta)
        - potencial viral para crear contenido (1-10)
        - formato de vídeo recomendado para venderlo (uno de: UGC, Demo, Short, Tutorial, Reacción, Haul, Storytelling)
        Devuelve JSON con array "news" de 15 objetos: {headline, summary, protagonists, virality, comedyScore, recommendedFormat}
        (usa protagonists para "margen estimado + precio de venta", virality para "competencia: baja/media/alta")`
      : `Dame las 15 noticias y tendencias más impactantes e importantes de hoy en ${country}${sector !== "general" ? ` sobre ${sectorLabel}` : ""}.
        Para cada una incluye:
        - titular impactante (máx 80 chars)
        - resumen de 2 líneas
        - protagonistas principales
        - por qué es viral o polémica
        - potencial cómico/satírico (1-10)
        - formato de vídeo recomendado (uno de: Short, Tutorial, Sátira, Reacción, Documental)
        Devuelve JSON con array "news" de 15 objetos: {headline, summary, protagonists, virality, comedyScore, recommendedFormat}`;

    const newsSystemPrompt = isEcommerce
      ? "Eres un experto en ecommerce, dropshipping y Shopify. Identificas productos y nichos ganadores antes de que saturen el mercado. Devuelve EXACTAMENTE 15 elementos en el array news."
      : "Eres un analista de contenido digital español especializado en detectar tendencias virales. Devuelve EXACTAMENTE 15 elementos en el array news.";

    const aiAnalysisPrompt = isEcommerce
      ? `Busca y analiza 6 vídeos reales ya publicados en YouTube, TikTok o Instagram que sean VIRALES de tiendas Shopify, dropshipping, o productos de ecommerce${sector !== "ecommerce_shopify" ? ` en el nicho de ${sectorLabel}` : ""} — especialmente vídeos de producto generados o asistidos con inteligencia artificial.

        Para cada vídeo real encontrado, desglosa en profundidad:
        1. Título exacto y canal/cuenta
        2. Views/likes aproximados
        3. Hook (primeros 3-5 segundos): qué muestra del producto, qué frase de apertura, qué emoción/necesidad activa
        4. Estructura del vídeo de producto: cómo presenta el producto (problema → solución → demo → precio → CTA)
        5. Estilo visual IA del producto: tipo de imágenes (lifestyle, 3D render, UGC real, unboxing, comparativa antes/después, texto animado)
        6. Narración: texto en pantalla, voz en off, música
        7. Por qué vendió / fue viral: triggers de compra usados (urgencia, FOMO, aspiración, prueba social, precio, exclusividad)
        8. Prompt visual replicable: escribe un prompt exacto de 2-3 frases para generar imágenes/vídeo similares con IA para vender un producto similar
        9. Script de venta replicable: hook + 3 puntos clave + CTA exacto para replicar este vídeo con cualquier producto del mismo nicho

        Devuelve JSON con array "aiVideos" de 6 objetos:
        {title, channel, estimatedViews, hook, structure, visualStyle, narration, whyViral, replicationPrompt, replicationFormula}`
      : `Busca y analiza 6 vídeos reales ya publicados en YouTube que sean VIRALES y estén generados o asistidos con inteligencia artificial en la temática de ${sectorLabel} en español.

        Para cada vídeo real encontrado, desglosa en profundidad:
        1. Título exacto del vídeo y canal
        2. Número aproximado de views
        3. Hook (primeros 3-5 segundos): qué dice exactamente, qué imagen aparece, qué emoción dispara
        4. Estructura del vídeo: cómo está construido (intro / desarrollo / giro / CTA)
        5. Estilo visual IA: qué tipo de imágenes/animaciones usa (stock realista, anime, 3D, avatares, texto animado, etc.)
        6. Narración: voz en off (cómo suena), subtítulos, música de fondo
        7. Por qué fue viral: triggers psicológicos usados (curiosidad, miedo, aspiración, humor, sorpresa, etc.)
        8. Prompt visual replicable: escribe un prompt exacto de 2-3 frases para generar imágenes/vídeo similares con IA
        9. Fórmula replicable: cómo yo podría replicar exactamente este vídeo para ${sectorLabel}

        Devuelve JSON con array "aiVideos" de 6 objetos:
        {title, channel, estimatedViews, thumbnail_desc, hook, structure, visualStyle, narration, whyViral, replicationPrompt, replicationFormula}`;

    const aiAnalysisSystemPrompt = isEcommerce
      ? "Eres un experto en ingeniería inversa de vídeos virales de producto para ecommerce y Shopify. Desmonta cada vídeo de producto para que cualquier tienda online pueda replicarlo y vender más."
      : "Eres un experto en ingeniería inversa de vídeos virales de YouTube generados con IA. Tu misión es desmontar cada vídeo capa por capa para que cualquiera pueda replicarlo.";

    const [newsResult, aiAnalysisResult, ytVideosResult, aiVideosResult] = await Promise.allSettled([
      askGeminiWithSearch(newsPrompt, newsSystemPrompt),
      askGeminiWithSearch(aiAnalysisPrompt, aiAnalysisSystemPrompt),
      // ── Vídeos trending reales en YouTube ──────────────────────────────────
      searchYouTubeTrending(ytQuery, 10),
      // ── Vídeos IA virales reales en YouTube ────────────────────────────────
      searchYouTubeTrending(aiQuery, 8),
    ]);

    let news: any[]     = [];
    let aiVideos: any[] = [];

    if (newsResult.status === "fulfilled") {
      try {
        const p = JSON.parse(newsResult.value.text.replace(/```json|```/g, "").trim());
        news = p.news || [];
      } catch (_) {}
    }
    if (aiAnalysisResult.status === "fulfilled") {
      try {
        const p = JSON.parse(aiAnalysisResult.value.text.replace(/```json|```/g, "").trim());
        aiVideos = p.aiVideos || [];
      } catch (_) {}
    }
    const ytVideos  = ytVideosResult.status  === "fulfilled" ? ytVideosResult.value  : [];
    const aiYtVideos = aiVideosResult.status === "fulfilled" ? aiVideosResult.value  : [];

    await db.execute(sql`INSERT INTO viral_log (action, data) VALUES ('trend_search', ${JSON.stringify({ country, sector, newsCount: news.length, aiVideosCount: aiVideos.length })})` );

    res.json({
      news, aiVideoAnalysis: aiVideos,
      youtubeVideos: ytVideos, aiYoutubeVideos: aiYtVideos,
      country, sector,
      algorithmSignals: ALGORITHM_SIGNALS,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error({ err }, "viral/trends failed");
    res.status(500).json({ error: err?.message || "Error obteniendo tendencias" });
  }
});

// ─── GET /viral/categories ────────────────────────────────────────────────────
router.get("/viral/categories", requireAdmin, (_req: Request, res: Response) => {
  res.json(CONTENT_CATEGORIES.map(c => ({
    id: c.id, name: c.name, emoji: c.emoji, description: c.description,
    defaultTone: c.defaultTone, defaultStyle: c.defaultStyle, defaultFormat: c.defaultFormat,
    inputLabel: c.inputLabel, inputPlaceholder: c.inputPlaceholder,
    viralTriggers: c.viralTriggers, recommendedFormats: c.recommendedFormats,
  })));
});

// ─── GET /viral/templates/:categoryId ────────────────────────────────────────
router.get("/viral/templates/:categoryId", requireAdmin, (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const templates = CONTENT_TEMPLATES.filter(t => t.categoryId === categoryId);
  res.json(templates.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, useCase: t.useCase })));
});

// ─── POST /viral/script ───────────────────────────────────────────────────────
router.post("/viral/script", requireAdmin, async (req: Request, res: Response) => {
  const {
    newsItem, tone, duration = 60, style,
    country = "España", engine = "claude",
    format, sector,
    comedyPromptId, templateId,
    category = "politica",
  } = req.body;
  if (!newsItem) { res.status(400).json({ error: "newsItem requerido" }); return; }

  // Resolve category — supports legacy politica flow + new multi-category
  const cat = CONTENT_CATEGORIES.find(c => c.id === category) || CONTENT_CATEGORIES[0];
  const resolvedTone  = tone  || cat.defaultTone;
  const resolvedStyle = style || cat.defaultStyle;
  const resolvedFormat = format || cat.defaultFormat;

  const formatKB   = VIDEO_FORMATS.find(f => f.id === resolvedFormat);
  const templateCtx = templateId
    ? CONTENT_TEMPLATES.find(t => t.id === templateId)?.prompt || ""
    : comedyPromptId
      ? (COMEDY_PROMPTS.find(p => p.id === comedyPromptId)?.prompt || "")
      : "";

  const categoryCtx = buildCategoryPrompt(category, resolvedFormat, templateId || undefined);

  const PROMPT = `${categoryCtx}

---
IDIOMA: Español (${country})
CATEGORÍA: ${cat.name} ${cat.emoji}

${templateCtx ? `PLANTILLA/ESTRUCTURA A APLICAR:\n${templateCtx}\n---` : ""}

TEMA/CONTENIDO A DESARROLLAR:
"${typeof newsItem === "object" ? JSON.stringify(newsItem) : newsItem}"

PARÁMETROS DEL VÍDEO:
- Formato: ${formatKB ? formatKB.name : resolvedStyle}
- Tono: ${resolvedTone}
- Duración objetivo: ${duration} segundos
- País/Contexto: ${country}
${formatKB ? `- Estructura recomendada: ${formatKB.structure.join(" → ")}` : ""}
${formatKB ? `- Hook framework: ${formatKB.hook}` : ""}

SEÑALES DE VIRALIDAD A INCLUIR (por orden de prioridad):
1. Hook brutal en los primeros 3 segundos — detiene el scroll
2. Pico emocional genuino (sorpresa, incredulidad, humor, asombro)
3. Statement polarizante o revelación que reencuadra todo
4. Momento de valor práctico o dato impactante
5. One-liner quotable — la frase que se comparte sola

Devuelve ÚNICAMENTE JSON válido (sin markdown, sin backticks):
{
  "title": "título viral (max 60 chars, con gancho emocional, patrón high-performing)",
  "titleAlternatives": ["3 títulos alternativos A/B test"],
  "description": "descripción SEO de 150 palabras con keywords relevantes",
  "tags": ["array de 15 tags SEO relevantes"],
  "hook": "primeros 3-5 segundos — frase gancho brutal que detiene el scroll",
  "script": "guión completo con acotaciones de dirección [PAUSA], [ÉNFASIS], [CORTE], [IMAGEN: descripción]",
  "voiceoverText": "texto limpio para TTS/narración sin corchetes ni acotaciones",
  "visualPrompt": "prompt cinematográfico en inglés para generar vídeo con IA (estilo Runway/Veo/Grok Video)",
  "thumbnailPrompt": "descripción del thumbnail ideal: composición, colores, texto, emoción facial",
  "callToAction": "CTA final para suscripción, máximo 10 palabras",
  "contentTechniques": ["técnicas narrativas usadas: ironía, hipérbole, storytelling, analogía, etc."],
  "viralSignals": {"hasStrongHook": true, "hasEmotionalPeak": true, "hasConflict": false, "hasPracticalValue": false, "hasStoryArc": true},
  "shortsVersion": "versión comprimida de 60 segundos para YouTube Shorts",
  "postingRecommendation": "mejor día y hora para publicar basado en el tema y categoría"
}`;

  try {
    let engineUsed: string = engine;
    let call: AiJsonCaller;

    if (engine === "grok") {
      const xaiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
      if (!xaiKey) { res.status(500).json({ error: "XAI_API_KEY no configurada — ve a Secrets y verifica que existe la variable XAI_API_KEY con tu clave de api.x.ai" }); return; }
      const grokModel = process.env.GROK_MODEL || "grok-3";
      engineUsed = grokModel;
      call = async ({ prompt, maxTokens }) => {
        const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
          body: JSON.stringify({
            model: grokModel, messages: [{ role: "user", content: prompt }],
            temperature: 0.9, max_tokens: maxTokens,
          }),
        });
        if (!grokRes.ok) {
          const errText = await grokRes.text().catch(() => "");
          throw new Error(`Grok API error (${grokRes.status}): ${errText.slice(0, 300)}`);
        }
        const grokData = await grokRes.json() as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
        const choice = grokData.choices?.[0];
        return { text: choice?.message?.content || "", truncated: choice?.finish_reason === "length" };
      };
    } else if (engine === "gemini") {
      // askGeminiChat usa 2048 tokens por defecto: el guion (14 campos) se cortaba.
      call = async ({ prompt, maxTokens }) => ({
        text: await askGeminiChat([{ role: "user", content: prompt }], undefined, { maxOutputTokens: maxTokens }),
        truncated: false,
      });
      engineUsed = "gemini";
    } else {
      // Antes: askClaudeJson(PROMPT), con el prompt en el lugar del projectId y sin
      // prompt: el motor por defecto fallaba siempre.
      call = async ({ prompt, maxTokens }) => {
        const r = await askClaudeDetailed(0, [{ role: "user", content: prompt }], undefined, maxTokens);
        return { text: r.text, truncated: r.truncated };
      };
      engineUsed = "claude";
    }

    // Los tres motores: extracción balanceada + esquema + un reintento (antes
    // JSON.parse directo tras quitar los ``` : cualquier texto alrededor lo rompía).
    const script = await generateAiJson({
      call,
      prompt: PROMPT,
      maxTokens: 6000,
      retryMaxTokens: 12000,
      schema: viralScriptSchema,
      expect: "object",
      label: `viral/script:${engineUsed}`,
    });

    // Auto-calculate virality score if signals present
    let viralScore: any = null;
    if (script?.viralSignals) {
      const inp: ViralityInput = {
        ...script.viralSignals,
        titleScore: script.title?.length > 20 ? 12 : 6,
        hasNumberInTitle: /\d/.test(script.title || ""),
        estimatedDurationSecs: Number(duration),
        sector,
      };
      viralScore = calculateViralityScore(inp);
    }

    await db.execute(sql`INSERT INTO viral_log (action, data) VALUES ('script_generated', ${JSON.stringify({ tone, duration, style, format, engine: engineUsed, title: script?.title || "" })})` );

    res.json({ success: true, script, engineUsed, viralScore });
  } catch (err: any) {
    logger.error({ err }, "viral/script failed");
    if (isAiOutputError(err)) { res.status(502).json({ error: aiOutputErrorMessage(err), code: err.code }); return; }
    res.status(500).json({ error: err?.message || "Error generando guión" });
  }
});

// ─── POST /viral/score ────────────────────────────────────────────────────────
router.post("/viral/score", requireAdmin, async (req: Request, res: Response) => {
  const input = req.body as ViralityInput;
  try {
    const result = calculateViralityScore(input);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ─── GET /viral/formats ───────────────────────────────────────────────────────
router.get("/viral/formats", requireAdmin, (_req: Request, res: Response) => {
  res.json({ formats: VIDEO_FORMATS, count: VIDEO_FORMATS.length });
});

// ─── GET /viral/comedy-prompts ────────────────────────────────────────────────
router.get("/viral/comedy-prompts", requireAdmin, (_req: Request, res: Response) => {
  res.json({ prompts: COMEDY_PROMPTS });
});

// ─── GET /viral/hooks ─────────────────────────────────────────────────────────
router.get("/viral/hooks", requireAdmin, (_req: Request, res: Response) => {
  res.json({ hooks: HOOK_FRAMEWORKS, titlePatterns: TITLE_PATTERNS });
});

// ─── GET /viral/sector/:id ────────────────────────────────────────────────────
router.get("/viral/sector/:id", requireAdmin, (req: Request, res: Response) => {
  const strategy = SECTOR_STRATEGIES[req.params.id as string];
  if (!strategy) {
    return res.json({ sectors: Object.keys(SECTOR_STRATEGIES), viralitySignals: VIRALITY_SIGNALS });
  }
  res.json({ sector: req.params.id as string, strategy, viralitySignals: VIRALITY_SIGNALS });
});

// ─── POST /viral/log ──────────────────────────────────────────────────────────
router.post("/viral/log", requireAdmin, async (req: Request, res: Response) => {
  const { action, data } = req.body;
  if (!action) { res.status(400).json({ error: "action requerido" }); return; }
  try {
    await db.execute(sql`INSERT INTO viral_log (action, data) VALUES (${action}, ${JSON.stringify(data || {})})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ─── GET /viral/log ───────────────────────────────────────────────────────────
router.get("/viral/log", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`SELECT id, action, data, created_at FROM viral_log ORDER BY created_at DESC LIMIT 100`);
    res.json({ log: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

export default router;
