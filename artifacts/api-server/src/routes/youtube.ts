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

// ─── PUBLIC: YouTube Search ───────────────────────────────────────────────────
router.get("/youtube/search", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const maxResults = Math.min(Number(req.query.max) || 5, 10);
    if (!q) return res.status(400).json({ error: "Query requerida" });

    const apiKey = YT_API_KEY();
    if (!apiKey) {
      return res.json({
        results: [],
        fallbackUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        message: "YOUTUBE_API_KEY no configurada — abre YouTube directamente",
      });
    }

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=${maxResults}&key=${apiKey}&relevanceLanguage=es`;
    const ytRes = await fetch(url);
    if (!ytRes.ok) {
      const err = await ytRes.text();
      logger.warn("YouTube search error:", err);
      return res.json({
        results: [],
        fallbackUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
        message: "Error en búsqueda — abre YouTube directamente",
      });
    }
    const data = await ytRes.json();
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

export default router;
