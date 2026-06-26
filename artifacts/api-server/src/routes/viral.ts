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
import { askClaudeJson } from "../lib/claude.js";
import {
  VIDEO_FORMATS, COMEDY_PROMPTS, HOOK_FRAMEWORKS, SECTOR_STRATEGIES,
  ALGORITHM_SIGNALS, TITLE_PATTERNS, VIRALITY_SIGNALS, buildYouTubeExpertPrompt,
  CONTENT_CATEGORIES, CONTENT_TEMPLATES, buildCategoryPrompt,
  calculateViralityScore, type ViralityInput,
} from "../lib/youtube-knowledge.js";

const router = Router();

// ─── GET /viral/engines — qué motores tienen su API key configurada ──────────
router.get("/viral/engines", requireAdmin, (_req: Request, res: Response) => {
  const grokKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  res.json({
    grok:   !!grokKey,
    claude: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    _debug: {
      XAI_API_KEY:    !!process.env.XAI_API_KEY,
      GROK_API_KEY:   !!process.env.GROK_API_KEY,
      ANTHROPIC:      !!process.env.ANTHROPIC_API_KEY,
      GEMINI:         !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
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

// ─── GET /viral/trends ────────────────────────────────────────────────────────
router.get("/viral/trends", requireAdmin, async (req: Request, res: Response) => {
  const country = (req.query.country as string) || "España";
  const sector  = (req.query.sector as string)  || "general";
  try {
    const sectorStrategy = SECTOR_STRATEGIES[sector];
    const ytQuery = sectorStrategy
      ? `${sectorStrategy.viralTriggers[0]} ${country} 2026`
      : `tendencias virales YouTube ${country} 2026`;

    const [newsResult, viralFormats, ytVideosResult] = await Promise.allSettled([
      askGeminiWithSearch(
        `Dame las 8 noticias más impactantes e importantes de hoy en ${country}${sector !== "general" ? ` sobre el sector ${sector}` : ""}.
        Para cada una incluye:
        - titular impactante (máx 80 chars)
        - resumen de 2 líneas
        - protagonistas principales
        - por qué es viral o polémica
        - potencial cómico/satírico (1-10)
        - formato de vídeo recomendado (uno de: Short, Tutorial, Sátira, Reacción, Documental)
        Devuelve JSON con array "news" de objetos: {headline, summary, protagonists, virality, comedyScore, recommendedFormat}`,
        "Eres un analista de contenido digital español especializado en detectar tendencias virales.",
      ),
      askGeminiWithSearch(
        `Analiza los 5 formatos de vídeo más virales en YouTube, TikTok e Instagram en ${country} esta semana${sector !== "general" ? ` para el sector ${sector}` : ""}.
        Para cada formato: nombre, descripción breve, duración media, engagement típico, por qué funciona ahora.
        Devuelve JSON con array "formats": {name, description, avgDuration, engagement, whyWorks, exampleChannel}`,
        "Eres experto en marketing de contenidos y análisis de tendencias virales en habla hispana.",
      ),
      searchYouTubeTrending(ytQuery, 6),
    ]);

    let news: any[] = [];
    let formats: any[] = [];
    if (newsResult.status === "fulfilled") {
      try { const p = JSON.parse(newsResult.value.text.replace(/```json|```/g, "").trim()); news = p.news || []; } catch (_) {}
    }
    if (viralFormats.status === "fulfilled") {
      try { const p = JSON.parse(viralFormats.value.text.replace(/```json|```/g, "").trim()); formats = p.formats || []; } catch (_) {}
    }
    const ytVideos = ytVideosResult.status === "fulfilled" ? ytVideosResult.value : [];

    await db.execute(sql`INSERT INTO viral_log (action, data) VALUES ('trend_search', ${JSON.stringify({ country, sector, newsCount: news.length })})` );

    res.json({
      news, formats, youtubeVideos: ytVideos, country, sector,
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
    let script: any = null;
    let engineUsed = engine;

    if (engine === "grok") {
      const xaiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
      if (!xaiKey) { res.status(500).json({ error: "XAI_API_KEY no configurada — ve a Secrets y verifica que existe la variable XAI_API_KEY con tu clave de api.x.ai" }); return; }
      const grokModel = process.env.GROK_MODEL || "grok-3";
      const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
        body: JSON.stringify({
          model: grokModel, messages: [{ role: "user", content: PROMPT }],
          temperature: 0.9, max_tokens: 5000,
        }),
      });
      if (!grokRes.ok) {
        const errText = await grokRes.text().catch(() => "");
        throw new Error(`Grok API error (${grokRes.status}): ${errText.slice(0, 300)}`);
      }
      const grokData = await grokRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      const raw = grokData.choices?.[0]?.message?.content || "";
      script = JSON.parse(raw.replace(/```json|```/g, "").trim());
      engineUsed = grokModel;

    } else if (engine === "gemini") {
      const result = await askGeminiChat([{ role: "user", content: PROMPT }]);
      const raw = typeof result === "string" ? result : (result as any).text || "";
      script = JSON.parse(raw.replace(/```json|```/g, "").trim());
      engineUsed = "gemini";

    } else {
      script = await askClaudeJson<any>(PROMPT);
      engineUsed = "claude";
    }

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
  const strategy = SECTOR_STRATEGIES[req.params.id];
  if (!strategy) {
    return res.json({ sectors: Object.keys(SECTOR_STRATEGIES), viralitySignals: VIRALITY_SIGNALS });
  }
  res.json({ sector: req.params.id, strategy, viralitySignals: VIRALITY_SIGNALS });
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
