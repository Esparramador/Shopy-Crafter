/**
 * YouTube Data API v3 Integration
 * ─────────────────────────────────────────────────────────────────────────────
 * • GET  /api/youtube/search?q=query     — búsqueda pública (API key)
 * • GET  /api/youtube/oauth/url          — genera URL OAuth para conectar canal
 * • GET  /api/youtube/oauth/callback     — callback OAuth (exchange code)
 * • GET  /api/youtube/channel            — info del canal conectado
 * • POST /api/youtube/upload             — subir vídeo al canal
 * • GET  /api/youtube/videos             — listar vídeos del canal
 * • DELETE /api/youtube/videos/:videoId  — eliminar vídeo
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 * 1024 }, // 256 MB
});

// ─── Ensure DB table exists ──────────────────────────────────────────────────
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS youtube_tokens (
        user_id VARCHAR(255) PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP,
        channel_id VARCHAR(100),
        channel_name VARCHAR(255),
        channel_thumbnail TEXT,
        channel_url TEXT,
        subscriber_count VARCHAR(50),
        video_count VARCHAR(50),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (_) {}
}
ensureTable();

// ─── Helpers ─────────────────────────────────────────────────────────────────
const YT_API_KEY = () =>
  process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || "";

const OAUTH = {
  clientId: () => process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: () => process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: () => {
    if (process.env.YOUTUBE_REDIRECT_URI) return process.env.YOUTUBE_REDIRECT_URI;
    if (process.env.NODE_ENV === "development" && process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}/api/youtube/oauth/callback`;
    }
    return `${process.env.APP_URL || "https://shopycrafter.com"}/api/youtube/oauth/callback`;
  },
};

async function getValidToken(userId: string): Promise<string | null> {
  const rows = await db.execute<{
    access_token: string; refresh_token: string | null;
    expires_at: Date | null;
  }>(sql`SELECT access_token, refresh_token, expires_at FROM youtube_tokens WHERE user_id = ${userId}`);
  if (!rows.rows.length) return null;
  const row = rows.rows[0];
  const now = new Date();
  if (row.expires_at && new Date(row.expires_at) > now) return row.access_token;
  if (!row.refresh_token) return null;
  return refreshAccessToken(userId, row.refresh_token);
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: OAUTH.clientId(),
        client_secret: OAUTH.clientSecret(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);
    await db.execute(sql`
      UPDATE youtube_tokens SET access_token = ${data.access_token}, expires_at = ${expiresAt}, updated_at = NOW()
      WHERE user_id = ${userId}
    `);
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchChannelInfo(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;
  return {
    channelId: ch.id,
    channelName: ch.snippet?.title,
    channelThumbnail: ch.snippet?.thumbnails?.default?.url,
    channelUrl: `https://www.youtube.com/channel/${ch.id}`,
    subscriberCount: ch.statistics?.subscriberCount || "0",
    videoCount: ch.statistics?.videoCount || "0",
  };
}

// ─── HELPER: YouTube search via OAuth token (preferred) or API key ────────────
async function ytSearch(q: string, maxResults: number, oauthToken?: string | null): Promise<{items: any[]} | null> {
  const qs = `part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=${maxResults}&relevanceLanguage=es&videoDuration=medium`;

  // Prefer OAuth token (user's own credentials — no need to enable YouTube Data API separately)
  if (oauthToken) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs}`, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });
    if (r.ok) return r.json();
    logger.warn("YouTube OAuth search failed:", await r.text().catch(() => "?"));
  }

  // Fallback: API key
  const apiKey = YT_API_KEY();
  if (!apiKey) return null;
  const r2 = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs}&key=${apiKey}`);
  if (r2.ok) return r2.json();
  logger.warn("YouTube API key search failed:", await r2.text().catch(() => "?"));
  return null;
}

// ─── PUBLIC: YouTube Search ───────────────────────────────────────────────────
router.get("/youtube/search", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const maxResults = Math.min(Number(req.query.max) || 5, 10);
    if (!q) return res.status(400).json({ error: "Query requerida" });

    // Try to get OAuth token from admin session (avoids needing YouTube Data API key enabled)
    let oauthToken: string | null = null;
    try { oauthToken = await getValidToken("admin"); } catch {}

    const data = await ytSearch(q, maxResults, oauthToken);
    if (!data) {
      return res.json({
        results: [],
        fallbackUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        message: "YouTube API no disponible — abre YouTube directamente",
      });
    }
    const results = (data.items || []).map((item: any) => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title,
      description: item.snippet?.description,
      thumbnail: item.snippet?.thumbnails?.medium?.url,
      channelTitle: item.snippet?.channelTitle,
      publishedAt: item.snippet?.publishedAt,
      watchUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${item.id?.videoId}`,
    }));

    return res.json({ results, query: q, total: data.pageInfo?.totalResults });
  } catch (err: any) {
    logger.error("YouTube search:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: OAuth URL ─────────────────────────────────────────────────────────
router.get("/youtube/oauth/url", requireAdmin, (req: Request, res: Response) => {
  const clientId = OAUTH.clientId();
  if (!clientId) {
    return res.status(400).json({
      error: "YOUTUBE_CLIENT_ID no configurado. Crea credenciales OAuth en Google Cloud Console.",
    });
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: OAUTH.redirectUri(),
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// ─── ADMIN: OAuth Callback ────────────────────────────────────────────────────
router.get("/youtube/oauth/callback", requireAdmin, async (req: Request, res: Response) => {
  const code = String(req.query.code || "");
  if (!code) return res.status(400).send("Sin código de autorización");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: OAUTH.clientId(),
        client_secret: OAUTH.clientSecret(),
        redirect_uri: OAUTH.redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.status(400).send(`Error al obtener tokens: ${err}`);
    }
    const tokens = await tokenRes.json();
    const userId = (req.user as any)?.id || "admin";
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);

    await db.execute(sql`
      INSERT INTO youtube_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
      VALUES (${userId}, ${tokens.access_token}, ${tokens.refresh_token || null}, ${expiresAt}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, youtube_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `);

    const channelInfo = await fetchChannelInfo(tokens.access_token);
    if (channelInfo) {
      await db.execute(sql`
        UPDATE youtube_tokens SET
          channel_id = ${channelInfo.channelId},
          channel_name = ${channelInfo.channelName},
          channel_thumbnail = ${channelInfo.channelThumbnail},
          channel_url = ${channelInfo.channelUrl},
          subscriber_count = ${channelInfo.subscriberCount},
          video_count = ${channelInfo.videoCount}
        WHERE user_id = ${userId}
      `);
    }

    const APP_URL = process.env.APP_URL || "";
    return res.redirect(`${APP_URL}/admin/youtube-studio?connected=1`);
  } catch (err: any) {
    logger.error("YouTube OAuth callback:", err);
    return res.status(500).send(`Error interno: ${err.message}`);
  }
});

// ─── ADMIN: Channel Info ──────────────────────────────────────────────────────
router.get("/youtube/channel", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || "admin";
    const rows = await db.execute<{
      channel_id: string | null; channel_name: string | null;
      channel_thumbnail: string | null; channel_url: string | null;
      subscriber_count: string | null; video_count: string | null;
    }>(sql`SELECT channel_id, channel_name, channel_thumbnail, channel_url, subscriber_count, video_count FROM youtube_tokens WHERE user_id = ${userId}`);

    if (!rows.rows.length) return res.json({ connected: false });
    const row = rows.rows[0];
    if (!row.channel_id) return res.json({ connected: false });

    return res.json({
      connected: true,
      channelId: row.channel_id,
      channelName: row.channel_name,
      channelThumbnail: row.channel_thumbnail,
      channelUrl: row.channel_url,
      subscriberCount: row.subscriber_count,
      videoCount: row.video_count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: List Channel Videos ──────────────────────────────────────────────
router.get("/youtube/videos", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || "admin";
    const token = await getValidToken(userId);
    if (!token) return res.json({ connected: false, videos: [] });

    const rows = await db.execute<{ channel_id: string | null }>(
      sql`SELECT channel_id FROM youtube_tokens WHERE user_id = ${userId}`
    );
    const channelId = rows.rows[0]?.channel_id;
    if (!channelId) return res.json({ connected: false, videos: [] });

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&key=${YT_API_KEY()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) return res.json({ connected: true, videos: [] });
    const searchData = await searchRes.json();

    const videoIds = (searchData.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
    if (!videoIds.length) return res.json({ connected: true, videos: [] });

    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${videoIds.join(",")}&key=${YT_API_KEY()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const statsData = statsRes.ok ? await statsRes.json() : { items: [] };

    const videos = (statsData.items || []).map((v: any) => ({
      videoId: v.id,
      title: v.snippet?.title,
      description: v.snippet?.description,
      thumbnail: v.snippet?.thumbnails?.medium?.url,
      publishedAt: v.snippet?.publishedAt,
      viewCount: v.statistics?.viewCount,
      likeCount: v.statistics?.likeCount,
      commentCount: v.statistics?.commentCount,
      privacy: v.status?.privacyStatus,
      watchUrl: `https://www.youtube.com/watch?v=${v.id}`,
    }));

    return res.json({ connected: true, videos });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: Upload Video ──────────────────────────────────────────────────────
router.post(
  "/youtube/upload",
  requireAdmin,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || "admin";
      const token = await getValidToken(userId);
      if (!token) {
        return res.status(401).json({ error: "Canal de YouTube no conectado. Conecta tu canal primero." });
      }

      const files = req.files as Record<string, Express.Multer.File[]>;
      const videoFile = files?.video?.[0];
      if (!videoFile) return res.status(400).json({ error: "Archivo de vídeo requerido" });

      const { title, description = "", tags = "", privacy = "public", categoryId = "22" } = req.body;
      if (!title) return res.status(400).json({ error: "Título requerido" });

      const metadata = {
        snippet: {
          title,
          description,
          tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          categoryId,
          defaultLanguage: "es",
          defaultAudioLanguage: "es",
        },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: false,
        },
      };

      const boundary = "boundary_" + Date.now();
      const metaBytes = Buffer.from(JSON.stringify(metadata), "utf8");
      const videoBytes = videoFile.buffer;

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
        metaBytes,
        Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${videoFile.mimetype}\r\n\r\n`),
        videoBytes,
        Buffer.from(`\r\n--${boundary}--`),
      ]);

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
            "Content-Length": String(body.length),
          },
          body,
        }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        logger.error("YouTube upload error:", err);
        return res.status(400).json({ error: `Error al subir vídeo: ${err}` });
      }

      const videoData = await uploadRes.json();
      const videoId = videoData.id;

      if (files?.thumbnail?.[0] && videoId) {
        try {
          const thumbRes = await fetch(
            `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": files.thumbnail[0].mimetype,
              },
              body: files.thumbnail[0].buffer,
            }
          );
          if (!thumbRes.ok) logger.warn("Thumbnail upload failed:", await thumbRes.text());
        } catch (thumbErr) {
          logger.warn("Thumbnail error:", thumbErr);
        }
      }

      await db.execute(sql`
        UPDATE youtube_tokens SET video_count = CAST(CAST(COALESCE(video_count,'0') AS INTEGER) + 1 AS VARCHAR), updated_at = NOW()
        WHERE user_id = ${userId}
      `).catch(() => {});

      return res.json({
        success: true,
        videoId,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoData.snippet?.title,
        privacy: videoData.status?.privacyStatus,
      });
    } catch (err: any) {
      logger.error("YouTube upload:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── ADMIN: Delete Video ──────────────────────────────────────────────────────
router.delete("/youtube/videos/:videoId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || "admin";
    const token = await getValidToken(userId);
    if (!token) return res.status(401).json({ error: "Canal no conectado" });

    const delRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${req.params.videoId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (!delRes.ok && delRes.status !== 204) {
      return res.status(400).json({ error: "No se pudo eliminar el vídeo" });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: Disconnect Channel ────────────────────────────────────────────────
router.delete("/youtube/channel", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id || "admin";
    await db.execute(sql`DELETE FROM youtube_tokens WHERE user_id = ${userId}`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODELO IA PIPELINE — download reference clip → ElevenLabs dubbing → face-swap
// ═══════════════════════════════════════════════════════════════════════════════

const uploadModel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 } });
const ELEVEN_KEY = () => process.env.ELEVENLABS_API_KEY || "";
const REPLICATE_TOKEN = () => process.env.REPLICATE_API_TOKEN || "";

// Content type → auto search query map
const CONTENT_TYPE_QUERIES: Record<string, string> = {
  monologo:    "monólogo humorístico español escenario",
  ugc:         "ugc creator product review español",
  podcast:     "podcast conversación español primer plano",
  educativo:   "explicación educativa cámara directa español",
  publicitario:"presentación producto publicitario español",
  entrevista:  "entrevista periodística español",
  testimonio:  "testimonio cliente satisfecho español",
  tutorial:    "tutorial paso a paso español",
};

// ── GET /youtube/modelo/suggest-query — returns best YT search for content type
router.get("/youtube/modelo/suggest-query", requireAdmin, (req: Request, res: Response) => {
  const tipo = String(req.query.tipo || "monologo");
  const q = CONTENT_TYPE_QUERIES[tipo] || CONTENT_TYPE_QUERIES.monologo;
  return res.json({ query: q, tipo });
});

// ── POST /youtube/modelo/extract-clip — download YT video + trim best segment
router.post("/youtube/modelo/extract-clip", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { videoId, startSec = 10, durationSec = 35 } = req.body;
    if (!videoId) return res.status(400).json({ error: "videoId requerido" });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "modelo-"));
    const rawPath  = path.join(tmpDir, "raw.mp4");
    const clipPath = path.join(tmpDir, "clip.mp4");

    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    // Find yt-dlp — env var, common replit path, or system PATH
    const ytdlp = process.env.YTDLP_PATH ||
      ["/home/runner/workspace/.pythonlibs/bin/yt-dlp",
       "/home/runner/.pythonlibs/bin/yt-dlp",
       "/usr/local/bin/yt-dlp"].find(p => { try { return require("fs").existsSync(p); } catch { return false; } }) ||
      "yt-dlp";
    // Find ffmpeg — env var, nix store, or system PATH
    const ffmpegBin = process.env.FFMPEG_PATH ||
      ["/nix/store/k28ypnisbhajg3x1kv5hy7h2vjbajkvy-replit-runtime-path/bin/ffmpeg",
       "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"].find(p => { try { return require("fs").existsSync(p); } catch { return false; } }) ||
      "ffmpeg";

    // Download best quality video+audio up to 720p
    execSync(
      `"${ytdlp}" -f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best" ` +
      `--merge-output-format mp4 -o "${rawPath}" "${ytUrl}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    if (!fs.existsSync(rawPath)) return res.status(500).json({ error: "No se pudo descargar el vídeo" });

    // Trim the requested segment
    execSync(
      `"${ffmpegBin}" -y -ss ${startSec} -i "${rawPath}" -t ${durationSec} ` +
      `-c:v libx264 -preset fast -crf 22 -c:a aac -movflags +faststart "${clipPath}"`,
      { timeout: 60_000, stdio: "pipe" }
    );

    const clipData = fs.readFileSync(clipPath);
    const b64 = clipData.toString("base64");
    const sizeKb = Math.round(clipData.length / 1024);

    fs.rmSync(tmpDir, { recursive: true, force: true });

    return res.json({
      success: true,
      videoId,
      startSec,
      durationSec,
      sizeKb,
      clipBase64: b64,
      mimeType: "video/mp4",
    });
  } catch (err: any) {
    logger.error("extract-clip:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 300) || "Error descargando clip" });
  }
});

// ── POST /youtube/modelo/dub — Full AI pipeline: TTS → SadTalker lip-sync (or Seedance I2V) → exact sync
// Body: { clipBase64?, voiceId, script, targetLang?, mode?: "sadtalker"|"seedance"|"merge" }
// Pipeline:
//   mode=sadtalker (default): foto + TTS audio → SadTalker → real lip-sync talking head
//   mode=seedance: foto → Seedance I2V animated → loop → merge TTS audio exact sync
//   mode=merge: clipBase64 provided → replace audio with TTS, exact sync
router.post("/youtube/modelo/dub", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clipBase64, voiceId, script, targetLang = "es", mode = "sadtalker" } = req.body;
    if (!voiceId) return res.status(400).json({ error: "voiceId requerido" });
    if (!script?.trim()) return res.status(400).json({ error: "script requerido para generar TTS" });

    const key = ELEVEN_KEY();
    if (!key) return res.status(500).json({ error: "ELEVENLABS_API_KEY no configurada" });
    const replicateToken = REPLICATE_TOKEN();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dub-"));
    const audioPath = path.join(tmpDir, "tts.mp3");
    const outPath   = path.join(tmpDir, "dubbed.mp4");

    // ── PASO 1: TTS naturalizado con ElevenLabs ──
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.3, similarity_boost: 0.9, style: 0.45, use_speaker_boost: true, speed: 0.95 },
      }),
    });
    if (!ttsRes.ok) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return res.status(ttsRes.status).json({ error: `TTS falló: ${await ttsRes.text()}` });
    }
    fs.writeFileSync(audioPath, Buffer.from(await ttsRes.arrayBuffer()));

    // ── PASO 2: Duración exacta del audio ──
    const ffprobeBin = ffmpegBin.replace("ffmpeg", "ffprobe");
    let exactDuration = "30";
    try {
      exactDuration = execSync(
        `"${ffprobeBin}" -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
        { stdio: ["pipe", "pipe", "pipe"] }
      ).toString().trim();
    } catch { /* fallback */ }
    logger.info(`TTS duration: ${exactDuration}s, mode: ${mode}`);

    // Paths to locate sevillano photo
    const photoPath = path.join(process.cwd(), "..", "shopify-optimizer", "public", "images", "sevillano-model.png");
    const altPhotoPath = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "images", "sevillano-model.png");
    const photoSrc = fs.existsSync(photoPath) ? photoPath : altPhotoPath;
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const basePublicUrl = devDomain ? `https://${devDomain}` : "";

    // ── PASO 3A: SadTalker — foto + audio → lip-sync real (modo por defecto) ──
    if ((mode === "sadtalker" || mode === "auto") && !clipBase64 && replicateToken && basePublicUrl) {
      try {
        // Save TTS audio to public for URL access
        const pubAudioDir = path.join(process.cwd(), "..", "shopify-optimizer", "public", "media", "sevillano");
        const altPubDir = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "media", "sevillano");
        const pubDir = fs.existsSync(pubAudioDir) ? pubAudioDir : altPubDir;
        fs.mkdirSync(pubDir, { recursive: true });
        const ttsFilename = `tts_${Date.now()}.mp3`;
        fs.copyFileSync(audioPath, path.join(pubDir, ttsFilename));

        const photoUrl = `${basePublicUrl}/images/sevillano-model.png`;
        const audioUrl = `${basePublicUrl}/media/sevillano/${ttsFilename}`;

        // SadTalker version
        const SADTALKER_VERSION = "85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b";
        const predRes = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: { Authorization: `Bearer ${replicateToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            version: SADTALKER_VERSION,
            input: { source_image: photoUrl, driven_audio: audioUrl, preprocess: "full", still_mode: false, use_enhancer: true, pose_style: 0, exp_scale: 1.0, size: 256 },
          }),
        });
        let pred = await predRes.json() as any;
        if (pred.id) {
          // Poll up to 5 min
          let attempts = 0;
          while (!["succeeded","failed","canceled"].includes(pred.status) && attempts < 40) {
            await new Promise(r => setTimeout(r, 8000));
            const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${replicateToken}` } });
            pred = await pollRes.json() as any;
            attempts++;
          }
          if (pred.status === "succeeded" && pred.output) {
            const videoUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
            const dlRes = await fetch(videoUrl);
            if (dlRes.ok) {
              fs.writeFileSync(outPath, Buffer.from(await dlRes.arrayBuffer()));
              logger.info(`SadTalker succeeded: ${videoUrl}`);
              // Clean up temp TTS public file
              try { fs.unlinkSync(path.join(pubDir, ttsFilename)); } catch {}
              // Fall through to PASO 4
            }
          }
        }
        if (!fs.existsSync(outPath)) throw new Error("SadTalker no generó vídeo");
      } catch (stErr: any) {
        logger.warn("SadTalker failed, falling back to Seedance/ffmpeg:", stErr.message);
      }
    }

    // ── PASO 3B: Seedance I2V → loop → merge TTS (fallback animado) ──
    if (!fs.existsSync(outPath) && !clipBase64 && replicateToken && basePublicUrl) {
      try {
        const photoUrl = `${basePublicUrl}/images/sevillano-model.png`;
        const seedRes = await fetch("https://api.replicate.com/v1/models/bytedance/seedance-1-lite/predictions", {
          method: "POST",
          headers: { Authorization: `Bearer ${replicateToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ input: { image: photoUrl, prompt: "Man speaking expressively to camera, natural head and hand movements, realistic talking, warm studio lighting", duration: 10, resolution: "720p", aspect_ratio: "9:16" } }),
        });
        let seed = await seedRes.json() as any;
        let sat = 0;
        while (!["succeeded","failed","canceled"].includes(seed.status) && sat < 20) {
          await new Promise(r => setTimeout(r, 8000));
          const sp = await fetch(`https://api.replicate.com/v1/predictions/${seed.id}`, { headers: { Authorization: `Bearer ${replicateToken}` } });
          seed = await sp.json() as any; sat++;
        }
        if (seed.status === "succeeded" && seed.output) {
          const seedUrl = Array.isArray(seed.output) ? seed.output[0] : seed.output;
          const sdl = await fetch(seedUrl);
          if (sdl.ok) {
            const seedPath = path.join(tmpDir, "seed.mp4");
            fs.writeFileSync(seedPath, Buffer.from(await sdl.arrayBuffer()));
            execSync(`"${ffmpegBin}" -y -stream_loop 3 -i "${seedPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k -t ${exactDuration} -movflags +faststart "${outPath}"`, { timeout: 120_000, stdio: "pipe" });
          }
        }
      } catch (seedErr: any) {
        logger.warn("Seedance failed, falling back to ffmpeg photo:", seedErr.message);
      }
    }

    // ── PASO 3C: clipBase64 proporcionado — reemplazar audio con TTS (exact sync) ──
    if (!fs.existsSync(outPath) && clipBase64) {
      const clipTmp = path.join(tmpDir, "clip.mp4");
      fs.writeFileSync(clipTmp, Buffer.from(clipBase64, "base64"));
      execSync(`"${ffmpegBin}" -y -i "${clipTmp}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -t ${exactDuration} -movflags +faststart "${outPath}"`, { timeout: 90_000, stdio: "pipe" });
    }

    // ── PASO 3D: Último fallback — foto estática Ken Burns + audio ──
    if (!fs.existsSync(outPath)) {
      const fps = 25;
      const totalFrames = Math.ceil(parseFloat(exactDuration) * fps);
      if (!fs.existsSync(photoSrc)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(500).json({ error: "No se encontró foto de referencia" });
      }
      execSync(
        `"${ffmpegBin}" -y -loop 1 -framerate ${fps} -i "${photoSrc}" -i "${audioPath}" ` +
        `-filter_complex "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,` +
        `zoompan=z='min(1+on/${totalFrames}*0.05,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:fps=${fps}:s=720x1280,format=yuv420p[vout]" ` +
        `-map "[vout]" -map "1:a" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k -t ${exactDuration} -movflags +faststart "${outPath}"`,
        { timeout: 120_000, stdio: "pipe" }
      );
    }

    // ── PASO 4: Guardar permanentemente (TTS+vídeo ya sincronizados) ──
    const saveDir = path.join(process.cwd(), "..", "shopify-optimizer", "public", "media", "sevillano");
    const altSaveDir = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "media", "sevillano");
    const permanentDir = fs.existsSync(path.dirname(saveDir)) ? saveDir :
                         fs.existsSync(path.dirname(altSaveDir)) ? altSaveDir :
                         path.join(os.tmpdir(), "modelo-saved");
    fs.mkdirSync(permanentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const savedFilename = `dubbed_${timestamp}.mp4`;
    const permanentPath = path.join(permanentDir, savedFilename);
    fs.copyFileSync(outPath, permanentPath);
    logger.info(`Dubbed video saved permanently: ${permanentPath} (duration: ${exactDuration}s)`);

    const b64out = fs.readFileSync(outPath).toString("base64");
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const publicUrl = permanentPath.includes("shopify-optimizer")
      ? `/media/sevillano/${savedFilename}`
      : null;

    return res.json({
      success: true,
      dubbingId: `tts-ffmpeg-${timestamp}`,
      status: "dubbed",
      dubbedBase64: b64out,
      mimeType: "video/mp4",
      savedAs: savedFilename,
      publicUrl,
      audioDuration: parseFloat(exactDuration),
    });
  } catch (err: any) {
    logger.error("dub:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /youtube/modelo/comedian-gen — Genera vídeo monologuista en escenario REAL
// 3 clips Seedance I2V en PARALELO (foto Sevillano + prompts stand-up en escenario)
// → concatena clips → merge con voz Sevillano TTS (acento andaluz máximo)
// Body: { script, voiceId }
router.post("/youtube/modelo/comedian-gen", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { script, voiceId } = req.body;
    if (!voiceId) return res.status(400).json({ error: "voiceId requerido" });
    if (!script?.trim()) return res.status(400).json({ error: "script requerido" });

    const key = ELEVEN_KEY();
    if (!key) return res.status(500).json({ error: "ELEVENLABS_API_KEY no configurada" });
    const replicateToken = REPLICATE_TOKEN();
    if (!replicateToken) return res.status(500).json({ error: "REPLICATE_API_TOKEN no configurado" });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "comedian-"));
    const audioPath = path.join(tmpDir, "tts.mp3");

    // ── PASO 1: TTS con acento andaluz máximo ──
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.12,
          similarity_boost: 0.95,
          style: 0.72,
          use_speaker_boost: true,
          speed: 0.87,
        },
      }),
    });
    if (!ttsRes.ok) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return res.status(ttsRes.status).json({ error: `TTS falló: ${await ttsRes.text()}` });
    }
    fs.writeFileSync(audioPath, Buffer.from(await ttsRes.arrayBuffer()));

    // ── PASO 2: Duración exacta ──
    const ffprobeBin = ffmpegBin.replace("ffmpeg", "ffprobe");
    let exactDuration = "30";
    try {
      exactDuration = execSync(
        `"${ffprobeBin}" -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
        { stdio: ["pipe", "pipe", "pipe"] }
      ).toString().trim();
    } catch { /* fallback */ }
    logger.info(`comedian-gen: TTS duration=${exactDuration}s`);

    // ── PASO 3: Lanzar 3 clips Seedance I2V en PARALELO ──
    const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
    const photoUrl = devDomain ? `https://${devDomain}/images/sevillano-model.png` : "";

    const comedyPrompts = [
      "Spanish stand-up comedian performing energetically on a dark comedy club stage, warm amber spotlight from above, microphone stand visible, animated expressive hand gestures telling a joke, dark audience silhouette in background, cinematic stage lighting, authentic performance",
      "Stand-up comedian on comedy club stage laughing and pointing at audience, dramatic golden spotlight from above, energetic body language, microphone in hand, professional Spanish comedy show",
      "Stand-up comedian on stage finishing punchline, exaggerated facial expressions, triumph arms raised, warm spotlight from above, authentic Spanish comedy club atmosphere, audience in background",
    ];

    logger.info("comedian-gen: launching 3 Seedance I2V clips in parallel...");
    const seedancePreds = await Promise.all(comedyPrompts.map(async (prompt, i) => {
      const r = await fetch("https://api.replicate.com/v1/models/bytedance/seedance-1-lite/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${replicateToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { image: photoUrl || undefined, prompt, duration: 10, resolution: "720p", aspect_ratio: "9:16" },
        }),
      });
      const d = await r.json() as any;
      logger.info(`comedian-gen: Seedance clip ${i + 1} launched: id=${d.id}`);
      return { id: d.id, index: i, url: null as string | null };
    }));

    // ── PASO 4: Polling paralelo de los 3 clips ──
    const results = [...seedancePreds];
    const pending = new Set(results.map((_, i) => i));
    let attempts = 0;
    while (pending.size > 0 && attempts < 50) {
      await new Promise(r => setTimeout(r, 8000));
      await Promise.all([...pending].map(async (i) => {
        const p = results[i];
        if (!p.id) { pending.delete(i); return; }
        const d = await fetch(`https://api.replicate.com/v1/predictions/${p.id}`, {
          headers: { Authorization: `Bearer ${replicateToken}` },
        }).then(r => r.json()) as any;
        if (d.status === "succeeded" && d.output) {
          results[i].url = Array.isArray(d.output) ? d.output[0] : d.output;
          pending.delete(i);
          logger.info(`comedian-gen: clip ${i + 1} ready → ${results[i].url}`);
        } else if (["failed","canceled"].includes(d.status)) {
          pending.delete(i);
          logger.warn(`comedian-gen: clip ${i + 1} failed: ${d.error}`);
        }
      }));
      attempts++;
    }

    const successClips = results.filter(c => c.url);
    if (successClips.length === 0) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return res.status(500).json({ error: "Ningún clip Seedance generó vídeo. Comprueba el token de Replicate y la foto pública." });
    }

    // ── PASO 5: Descargar clips + concatenar ──
    const clipPaths: string[] = [];
    for (const c of successClips) {
      const dlRes = await fetch(c.url!);
      if (dlRes.ok) {
        const p = path.join(tmpDir, `clip${c.index}.mp4`);
        fs.writeFileSync(p, Buffer.from(await dlRes.arrayBuffer()));
        clipPaths.push(p);
      }
    }

    const outPath = path.join(tmpDir, "comedian.mp4");
    const singleDur = 10;
    const totalClipDur = clipPaths.length * singleDur;
    const loopsNeeded = Math.ceil(parseFloat(exactDuration) / totalClipDur) + 1;
    const listFile = path.join(tmpDir, "concat.txt");
    const lines: string[] = [];
    for (let l = 0; l < loopsNeeded; l++) for (const p of clipPaths) lines.push(`file '${p.replace(/'/g,"'\\''")}' `);
    fs.writeFileSync(listFile, lines.join("\n"));
    const concatPath = path.join(tmpDir, "concat.mp4");
    execSync(`"${ffmpegBin}" -y -f concat -safe 0 -i "${listFile}" -c copy "${concatPath}"`, { timeout: 180_000, stdio: "pipe" });
    execSync(
      `"${ffmpegBin}" -y -i "${concatPath}" -i "${audioPath}" ` +
      `-map 0:v:0 -map 1:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k ` +
      `-t ${exactDuration} -movflags +faststart "${outPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    // ── PASO 6: Guardar permanentemente ──
    const saveDir = path.join(process.cwd(), "..", "shopify-optimizer", "public", "media", "sevillano");
    const altSaveDir = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "media", "sevillano");
    const permanentDir = fs.existsSync(path.dirname(saveDir)) ? saveDir :
                         fs.existsSync(path.dirname(altSaveDir)) ? altSaveDir :
                         path.join(os.tmpdir(), "modelo-saved");
    fs.mkdirSync(permanentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const savedFilename = `comedian_${timestamp}.mp4`;
    const permanentPath = path.join(permanentDir, savedFilename);
    fs.copyFileSync(outPath, permanentPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const publicUrl = permanentPath.includes("shopify-optimizer") ? `/media/sevillano/${savedFilename}` : null;
    logger.info(`comedian-gen: saved permanently as ${savedFilename} (${successClips.length} clips, ${exactDuration}s)`);

    return res.json({ success: true, savedAs: savedFilename, publicUrl, audioDuration: parseFloat(exactDuration), clipsGenerated: successClips.length });
  } catch (err: any) {
    logger.error("comedian-gen:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /youtube/modelo/reference-pipeline — Vídeo referencia + TTS Sevillano + face-swap fotograma
// Pipeline completo: vídeo Leo Harlem subido → audio Sevillano TTS → face-swap frame a frame
// Body: { referenceVideoB64, voiceId, script, doFaceSwap?: boolean }
router.post("/youtube/modelo/reference-pipeline", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { referenceVideoB64, voiceId, script, doFaceSwap = true } = req.body;
    if (!referenceVideoB64) return res.status(400).json({ error: "referenceVideoB64 requerido — sube el vídeo de referencia" });
    if (!voiceId) return res.status(400).json({ error: "voiceId requerido" });
    if (!script?.trim()) return res.status(400).json({ error: "script requerido" });

    const key = ELEVEN_KEY();
    if (!key) return res.status(500).json({ error: "ELEVENLABS_API_KEY no configurada" });
    const replicateToken = REPLICATE_TOKEN();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "refpipe-"));
    const audioPath = path.join(tmpDir, "tts.mp3");
    const refVideoPath = path.join(tmpDir, "reference.mp4");
    const mergedPath = path.join(tmpDir, "merged.mp4");
    const outPath = path.join(tmpDir, "final.mp4");

    // ── PASO 1: TTS Sevillano con acento andaluz ──
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.12, similarity_boost: 0.95, style: 0.72, use_speaker_boost: true, speed: 0.87 },
      }),
    });
    if (!ttsRes.ok) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return res.status(ttsRes.status).json({ error: `TTS falló: ${await ttsRes.text()}` });
    }
    fs.writeFileSync(audioPath, Buffer.from(await ttsRes.arrayBuffer()));

    // ── PASO 2: Duración exacta ──
    const ffprobeBin = ffmpegBin.replace("ffmpeg", "ffprobe");
    let exactDuration = "30";
    try {
      exactDuration = execSync(
        `"${ffprobeBin}" -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
        { stdio: ["pipe", "pipe", "pipe"] }
      ).toString().trim();
    } catch { /* fallback */ }
    logger.info(`reference-pipeline: TTS duration=${exactDuration}s, doFaceSwap=${doFaceSwap}`);

    // ── PASO 3: Guardar vídeo de referencia ──
    fs.writeFileSync(refVideoPath, Buffer.from(referenceVideoB64, "base64"));

    // ── PASO 4: Reemplazar audio del vídeo de referencia con TTS (loop si necesario) ──
    execSync(
      `"${ffmpegBin}" -y -stream_loop 5 -i "${refVideoPath}" -i "${audioPath}" ` +
      `-map 0:v:0 -map 1:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k ` +
      `-t ${exactDuration} -movflags +faststart "${mergedPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    // ── PASO 5: Face-swap fotograma a fotograma (codeplugtech/face-swap via Replicate) ──
    let faceSwapApplied = false;
    if (doFaceSwap && replicateToken) {
      const devDomain = process.env.REPLIT_DEV_DOMAIN || "";
      const facePhotoUrl = devDomain ? `https://${devDomain}/images/sevillano-model.png` : "";
      const FACE_SWAP_VERSION = "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34";

      const framesDir = path.join(tmpDir, "frames");
      const swappedDir = path.join(tmpDir, "swapped");
      fs.mkdirSync(framesDir, { recursive: true });
      fs.mkdirSync(swappedDir, { recursive: true });

      // Extraer fotogramas a 4fps (manejable: ~120 frames para 30s)
      execSync(
        `"${ffmpegBin}" -y -i "${mergedPath}" -vf fps=4 "${framesDir}/frame_%05d.jpg"`,
        { timeout: 60_000, stdio: "pipe" }
      );
      const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith(".jpg")).sort();
      logger.info(`reference-pipeline: face-swapping ${frameFiles.length} frames @ 4fps...`);

      // Procesar en batches de 12 en paralelo
      const BATCH_SIZE = 12;
      for (let i = 0; i < frameFiles.length; i += BATCH_SIZE) {
        const batch = frameFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (fname) => {
          const framePath = path.join(framesDir, fname);
          const swappedPath = path.join(swappedDir, fname);
          try {
            const frameB64 = fs.readFileSync(framePath).toString("base64");
            let pred = await fetch("https://api.replicate.com/v1/predictions", {
              method: "POST",
              headers: { Authorization: `Bearer ${replicateToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                version: FACE_SWAP_VERSION,
                input: { swap_image: facePhotoUrl, input_image: `data:image/jpeg;base64,${frameB64}` },
              }),
            }).then(r => r.json()) as any;

            let att = 0;
            while (!["succeeded","failed","canceled"].includes(pred.status) && att < 18) {
              await new Promise(r => setTimeout(r, 2500));
              pred = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
                headers: { Authorization: `Bearer ${replicateToken}` },
              }).then(r => r.json()) as any;
              att++;
            }
            if (pred.status === "succeeded" && pred.output) {
              const dlRes = await fetch(Array.isArray(pred.output) ? pred.output[0] : pred.output);
              if (dlRes.ok) { fs.writeFileSync(swappedPath, Buffer.from(await dlRes.arrayBuffer())); return; }
            }
          } catch { /* fallback */ }
          try { fs.copyFileSync(framePath, swappedPath); } catch {}
        }));
        logger.info(`reference-pipeline: face-swap batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(frameFiles.length/BATCH_SIZE)} done`);
      }

      // Reconstruir vídeo a 4fps y merge con audio TTS
      const faceswappedPath = path.join(tmpDir, "faceswapped.mp4");
      execSync(
        `"${ffmpegBin}" -y -framerate 4 -i "${swappedDir}/frame_%05d.jpg" ` +
        `-c:v libx264 -preset fast -crf 22 -movflags +faststart "${faceswappedPath}"`,
        { timeout: 120_000, stdio: "pipe" }
      );
      execSync(
        `"${ffmpegBin}" -y -i "${faceswappedPath}" -i "${audioPath}" ` +
        `-map 0:v:0 -map 1:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k ` +
        `-t ${exactDuration} -movflags +faststart "${outPath}"`,
        { timeout: 120_000, stdio: "pipe" }
      );
      faceSwapApplied = true;
    }

    if (!fs.existsSync(outPath)) fs.copyFileSync(mergedPath, outPath);

    // ── PASO 6: Guardar permanentemente ──
    const saveDir = path.join(process.cwd(), "..", "shopify-optimizer", "public", "media", "sevillano");
    const altSaveDir = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "media", "sevillano");
    const permanentDir = fs.existsSync(path.dirname(saveDir)) ? saveDir :
                         fs.existsSync(path.dirname(altSaveDir)) ? altSaveDir :
                         path.join(os.tmpdir(), "modelo-saved");
    fs.mkdirSync(permanentDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const savedFilename = `reference_pipeline_${timestamp}.mp4`;
    const permanentPath = path.join(permanentDir, savedFilename);
    fs.copyFileSync(outPath, permanentPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const publicUrl = permanentPath.includes("shopify-optimizer") ? `/media/sevillano/${savedFilename}` : null;
    logger.info(`reference-pipeline: saved ${savedFilename} (faceSwap=${faceSwapApplied}, duration=${exactDuration}s)`);

    return res.json({ success: true, savedAs: savedFilename, publicUrl, audioDuration: parseFloat(exactDuration), faceSwapApplied });
  } catch (err: any) {
    logger.error("reference-pipeline:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /youtube/modelo/face-swap — ElevenLabs dubbing with face reference (lip-sync + face)
// Falls back to Replicate if ElevenLabs fails
router.post("/youtube/modelo/face-swap", requireAdmin, uploadModel.fields([
  { name: "facePhoto", maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const { videoBase64, voiceId, script, targetLang = "es" } = req.body;
    const files = req.files as Record<string, Express.Multer.File[]>;
    const faceFile = files?.facePhoto?.[0];

    if (!videoBase64) return res.status(400).json({ error: "videoBase64 requerido" });
    if (!faceFile)    return res.status(400).json({ error: "facePhoto requerido" });

    const key = ELEVEN_KEY();
    if (key && voiceId) {
      // ── Usar ElevenLabs Dubbing con reference_face_image para lip-sync + face ──
      try {
        const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "faceswap-el-"));
        const inVid = path.join(tmpDir2, "input.mp4");
        fs.writeFileSync(inVid, Buffer.from(videoBase64, "base64"));

        const FormData2 = (await import("form-data")).default;
        const form2 = new FormData2();
        form2.append("file", fs.createReadStream(inVid), { filename: "input.mp4", contentType: "video/mp4" });
        form2.append("target_lang", targetLang);
        form2.append("mode", "automatic");
        form2.append("voice_id", voiceId);
        if (script) form2.append("script", script);
        form2.append("reference_face_image", faceFile.buffer, { filename: faceFile.originalname, contentType: faceFile.mimetype });

        const dubRes = await fetch("https://api.elevenlabs.io/v1/dubbing", {
          method: "POST",
          headers: { "xi-api-key": key, ...form2.getHeaders() },
          body: form2 as any,
        });
        const dubData = await dubRes.json() as any;

        if (dubRes.ok && dubData.dubbing_id) {
          const dubbingId2 = dubData.dubbing_id;
          // Poll
          let st2 = "in_progress"; let att2 = 0;
          while (st2 === "in_progress" && att2 < 36) {
            await new Promise(r => setTimeout(r, 5000));
            const sr = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbingId2}`, { headers: { "xi-api-key": key } });
            st2 = (await sr.json() as any).status; att2++;
          }
          if (st2 === "dubbed") {
            const dlR = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbingId2}/audio/${targetLang}`, { headers: { "xi-api-key": key } });
            if (dlR.ok) {
              const outBuf = Buffer.from(await dlR.arrayBuffer());
              // Save permanently
              const saveDir3 = path.join(process.cwd(), "..", "shopify-optimizer", "public", "media", "sevillano");
              const altDir3 = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "media", "sevillano");
              const permDir3 = fs.existsSync(path.dirname(saveDir3)) ? saveDir3 : altDir3;
              fs.mkdirSync(permDir3, { recursive: true });
              const ts3 = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const fname3 = `faceswap_el_${ts3}.mp4`;
              fs.writeFileSync(path.join(permDir3, fname3), outBuf);
              fs.rmSync(tmpDir2, { recursive: true, force: true });
              logger.info(`ElevenLabs face-swap saved: ${fname3}`);
              return res.json({ success: true, dubbingId: dubbingId2, provider: "elevenlabs", savedAs: fname3, publicUrl: `/media/sevillano/${fname3}`, outputUrl: `/media/sevillano/${fname3}` });
            }
          }
        }
        fs.rmSync(tmpDir2, { recursive: true, force: true });
        logger.warn("ElevenLabs face-swap failed, falling back to Replicate");
      } catch (elErr: any) {
        logger.warn("ElevenLabs face-swap error, falling back to Replicate:", elErr.message);
      }
    }

    // ── Fallback: Replicate face-swap ──
    const token = REPLICATE_TOKEN();
    if (!token) return res.status(500).json({ error: "REPLICATE_API_TOKEN no configurada" });

    // Upload face image to Replicate Files API
    const faceUpload = await fetch("https://api.replicate.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": faceFile.mimetype },
      body: faceFile.buffer,
    });
    const faceData = await faceUpload.json() as any;
    const faceUrl = faceData.urls?.get || faceData.url;
    if (!faceUrl) return res.status(500).json({ error: "No se pudo subir la foto" });

    // Upload video to Replicate Files API
    const vidBuf = Buffer.from(videoBase64, "base64");
    const vidUpload = await fetch("https://api.replicate.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4" },
      body: vidBuf,
    });
    const vidData = await vidUpload.json() as any;
    const vidUrl = vidData.urls?.get || vidData.url;
    if (!vidUrl) return res.status(500).json({ error: "No se pudo subir el vídeo" });

    // Run face-swap model (akhaliq/facefusion or deepinsight/insightface)
    const predRes = await fetch("https://api.replicate.com/v1/models/yan-ops/face-swap/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({ input: { target_video: vidUrl, source_image: faceUrl } }),
    });
    let pred = await predRes.json() as any;

    // Poll if not done
    let pollAttempts = 0;
    while (pred.status && !["succeeded", "failed", "canceled"].includes(pred.status) && pollAttempts < 60) {
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      pred = await pollRes.json() as any;
      pollAttempts++;
    }

    if (pred.status !== "succeeded") {
      return res.status(500).json({ error: pred.error || "Face-swap falló", status: pred.status });
    }

    // Save Replicate result permanently
    const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    try {
      const dlFace = await fetch(outputUrl);
      if (dlFace.ok) {
        const faceBuf = Buffer.from(await dlFace.arrayBuffer());
        const saveDir4 = path.join(process.cwd(), "..", "shopify-optimizer", "public", "media", "sevillano");
        const altDir4 = path.join(__dirname, "..", "..", "..", "shopify-optimizer", "public", "media", "sevillano");
        const permDir4 = fs.existsSync(path.dirname(saveDir4)) ? saveDir4 : altDir4;
        fs.mkdirSync(permDir4, { recursive: true });
        const ts4 = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const fname4 = `faceswap_rep_${ts4}.mp4`;
        fs.writeFileSync(path.join(permDir4, fname4), faceBuf);
        logger.info(`Replicate face-swap saved: ${fname4}`);
        return res.json({ success: true, outputUrl: `/media/sevillano/${fname4}`, publicUrl: `/media/sevillano/${fname4}`, predictionId: pred.id, provider: "replicate", savedAs: fname4 });
      }
    } catch {}

    return res.json({ success: true, outputUrl, predictionId: pred.id, provider: "replicate" });
  } catch (err: any) {
    logger.error("face-swap:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /youtube/modelo/voices — list available ElevenLabs voices
router.get("/youtube/modelo/voices", requireAdmin, async (req: Request, res: Response) => {
  try {
    const key = ELEVEN_KEY();
    if (!key) return res.json({ voices: [] });
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
    const d = await r.json() as any;
    const voices = (d.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url,
    }));
    return res.json({ voices });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /youtube/modelo/generate-reference — generate AI reference video with Kling
// Used when no YouTube reference is provided
router.post("/youtube/modelo/generate-reference", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { contentType = "monologo", prompt, durationSec = 5 } = req.body;
    const token = REPLICATE_TOKEN();
    if (!token) return res.status(500).json({ error: "REPLICATE_API_TOKEN no configurada" });

    const defaultPrompts: Record<string, string> = {
      monologo:    "A charismatic Spanish comedian on a comedy club stage, warm spotlight, gesturing with hands, expressive face, talking directly to camera, dark background with audience silhouettes, cinematic",
      ugc:         "A friendly person holding a product and talking to camera, natural home setting, good lighting, authentic and enthusiastic, close-up shot",
      podcast:     "Two people having a conversation at a podcast table with microphones, professional studio lighting, talking animatedly",
      educativo:   "A teacher explaining something enthusiastically to camera, whiteboard background, pointing and gesturing, professional setting",
      publicitario:"A confident presenter showing a product on camera, clean white background, professional lighting, smiling",
    };

    const finalPrompt = prompt || defaultPrompts[contentType] || defaultPrompts.monologo;

    const predRes = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.1-standard/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({ input: { prompt: finalPrompt, duration: durationSec, aspect_ratio: "16:9" } }),
    });
    let pred = await predRes.json() as any;

    // Poll up to 3 min
    let attempts = 0;
    while (pred.status && !["succeeded", "failed", "canceled"].includes(pred.status) && attempts < 36) {
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      pred = await pollRes.json() as any;
      attempts++;
    }

    if (pred.status !== "succeeded") {
      return res.status(500).json({ error: pred.error || "Generación falló", status: pred.status });
    }

    return res.json({ success: true, videoUrl: pred.output, predictionId: pred.id, prompt: finalPrompt });
  } catch (err: any) {
    logger.error("generate-reference:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
