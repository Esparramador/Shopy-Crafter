/**
 * Viral Comedy Studio — backend
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /viral/trends         — tendencias políticas del día (Gemini Search + YouTube)
 * POST /viral/script         — genera guión satírico con Claude
 * POST /viral/log            — registra acción para aprendizaje del chatbot
 * GET  /viral/log            — historial de acciones (chatbot y UI)
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { askGeminiWithSearch } from "../lib/gemini.js";
import { askClaudeJson } from "../lib/claude.js";

const router = Router();

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
      part: "snippet",
      q: query,
      type: "video",
      order: "viewCount",
      relevanceLanguage: "es",
      regionCode: "ES",
      maxResults: String(maxResults),
      key,
    });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!r.ok) return [];
    const data = await r.json() as any;
    const ids = (data.items || []).map((i: any) => i.id?.videoId).filter(Boolean).join(",");
    if (!ids) return [];
    // Get stats
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
      const dur = iso.replace("PT", "").replace("H", "h ").replace("M", "m ").replace("S", "s").trim();
      return {
        videoId: vid,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnail: item.snippet?.thumbnails?.medium?.url || "",
        viewCount: s.statistics?.viewCount || "0",
        watchUrl: `https://www.youtube.com/watch?v=${vid}`,
        duration: dur,
        publishedAt: item.snippet?.publishedAt || "",
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
  try {
    const [newsResult, viralFormats, ytVideosResult] = await Promise.allSettled([
      askGeminiWithSearch(
        `Dame las 8 noticias políticas más impactantes e importantes de hoy en ${country}.
        Para cada una incluye:
        - titular impactante
        - resumen de 2 líneas
        - protagonistas principales
        - por qué es viral o polémica
        - potencial cómico/satírico (1-10)
        Devuelve JSON con array "news" de objetos: {headline, summary, protagonists, virality, comedyScore}`,
        "Eres un analista de noticias políticas español especializado en detectar contenido viral.",
      ),
      askGeminiWithSearch(
        `Analiza los formatos de vídeo de humor político más virales en YouTube, TikTok e Instagram en ${country} actualmente.
        Dame los 5 formatos más efectivos con: nombre, descripción, duración media, tasa de engagement típica, por qué funciona.
        Devuelve JSON con array "formats": {name, description, avgDuration, engagement, whyWorks}`,
        "Eres experto en marketing de contenidos y análisis de tendencias virales.",
      ),
      searchYouTubeTrending("sátira política humor España 2025", 6),
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

    await db.execute(sql`INSERT INTO viral_log (action, data) VALUES ('trend_search', ${JSON.stringify({ country, newsCount: news.length, formatsCount: formats.length, ytCount: ytVideos.length })})`);

    res.json({ news, formats, youtubeVideos: ytVideos, country, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error({ err }, "viral/trends failed");
    res.status(500).json({ error: err?.message || "Error obteniendo tendencias" });
  }
});

// ─── POST /viral/script ───────────────────────────────────────────────────────
router.post("/viral/script", requireAdmin, async (req: Request, res: Response) => {
  const { newsItem, tone = "ácido", duration = 60, style = "monólogo", country = "España" } = req.body;
  if (!newsItem) { res.status(400).json({ error: "newsItem requerido" }); return; }

  try {
    const script = await askClaudeJson<{
      title: string; description: string; tags: string[];
      hook: string; script: string; voiceoverText: string;
      visualPrompt: string; callToAction: string;
      comedyTechniques: string[];
    }>(
      `Eres el mejor guionista de comedia política de ${country}. Tu estilo mezcla El Intermedio, Wyoming, La Resistencia y el humor absurdo de Facu Díaz.

Noticia a satirizar:
"${typeof newsItem === "object" ? JSON.stringify(newsItem) : newsItem}"

Parámetros del vídeo:
- Tono: ${tone} (opciones: ácido, absurdo, irónico, sarcástico, tierno)
- Duración objetivo: ${duration} segundos
- Formato: ${style} (opciones: monólogo, sketch, reportaje falso, entrevista imaginaria)

Genera un guión satírico completo devolviendo JSON con:
{
  "title": "título viral para YouTube (max 60 chars, con gancho emocional)",
  "description": "descripción SEO de 150 palabras con keywords políticas relevantes",
  "tags": ["array", "de", "15", "tags", "relevantes"],
  "hook": "primeros 5 segundos — frase gancho brutal que para el scroll",
  "script": "guión completo con indicaciones de tono, pausa, énfasis [PAUSA], [ÉNFASIS], [TONO IRÓNICO]",
  "voiceoverText": "texto limpio para TTS sin corchetes ni acotaciones",
  "visualPrompt": "descripción visual cinematográfica para generar vídeo con IA (en inglés, estilo Midjourney/Runway)",
  "callToAction": "CTA final para que se suscriban, máximo 10 palabras",
  "comedyTechniques": ["lista de técnicas cómicas usadas (absurdo, hipérbole, etc.)"]
}`,
    );

    await db.execute(sql`INSERT INTO viral_log (action, data) VALUES ('script_generated', ${JSON.stringify({ tone, duration, style, title: script?.title || "" })})`);

    res.json({ success: true, script });
  } catch (err: any) {
    logger.error({ err }, "viral/script failed");
    res.status(500).json({ error: err?.message || "Error generando guión" });
  }
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
    const rows = await db.execute(sql`SELECT id, action, data, created_at FROM viral_log ORDER BY created_at DESC LIMIT 50`);
    res.json({ log: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

export default router;
