/**
 * BRAND KIT ENDPOINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  POST /api/projects/:projectId/brand-kit/extract
 *      multipart/form-data with `files` (1+ uploads). Extracts text, logos,
 *      handles, URLs, hex colors and fonts from any uploaded format
 *      (PDF/ZIP/PNG/JPG/WEBP/TXT/CSV/JSON/SVG).
 *
 *  POST /api/projects/:projectId/brand-kit/preview-overlay
 *      Render a sample 5-second test video with the supplied brandKit applied
 *      so the user can preview their overlay BEFORE running an expensive
 *      cinematic ad job.
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger.js";
import { extractBrandKitFromFiles } from "../lib/brand-kit-extractor.js";
import { applyBrandOverlay, buildAutoBrandOverlay, type BrandOverlayConfig } from "../lib/brand-overlay.js";
import { fetchToBuffer } from "../lib/fusion-studio-pro.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB per file (PDFs/ZIPs of brand books)
    files: 12,
  },
});

// SSRF guard — refuse private/loopback/link-local hosts. Mirrors the helper
// already used by shopybrain.ts so the brand-kit endpoints can't be abused
// to probe internal services or cloud metadata APIs (169.254.169.254).
function isPublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (host.startsWith("172.")) {
      const second = parseInt(host.split(".")[1] || "0", 10);
      if (second >= 16 && second <= 31) return false;
    }
    if (host.startsWith("169.254.") || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch { return false; }
}

// Hard cap on logo dataUrl payload returned by /extract — prevents the
// JSON response from exploding to >100MB if many large logo candidates are
// found. Logos above this size are returned with metadata only (no dataUrl)
// and the caller can fetch them later if needed.
const MAX_LOGO_DATAURL_BYTES = 2 * 1024 * 1024; // 2 MB raw → ~2.7 MB base64
const MAX_TOTAL_LOGO_DATAURL_BYTES = 12 * 1024 * 1024; // 12 MB combined cap

// ─── EXTRACT BRAND KIT FROM FILES ────────────────────────────────────────
router.post(
  "/projects/:projectId/brand-kit/extract",
  upload.array("files", 12),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.projectId);
      if (!Number.isFinite(projectId) || projectId <= 0) {
        res.status(400).json({ error: "invalid projectId" });
        return;
      }
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        res.status(400).json({ error: "Sube al menos un archivo (PDF, ZIP, PNG, JPG, WEBP, TXT, CSV, JSON, SVG)." });
        return;
      }

      const maxOcrImages = Number(req.body?.maxOcrImages) || undefined;

      const kit = await extractBrandKitFromFiles(
        projectId,
        files.map((f) => ({ buffer: f.buffer, filename: f.originalname, mimeType: f.mimetype })),
        { maxOcrImages },
      );

      // Convert logo buffers to base64 data URIs so the JSON response is
      // self-contained (the frontend can preview them and POST one back).
      // BUT: cap per-logo and total payload size to prevent OOM / huge JSON
      // responses when many large images are flagged as logos.
      let totalLogoBytes = 0;
      const logoCandidates = kit.logoCandidates.map((l) => {
        const skipDataUrl =
          l.buffer.length > MAX_LOGO_DATAURL_BYTES ||
          totalLogoBytes + l.buffer.length > MAX_TOTAL_LOGO_DATAURL_BYTES;
        if (!skipDataUrl) totalLogoBytes += l.buffer.length;
        return {
          filename: l.filename,
          mimeType: l.mimeType,
          confidence: l.confidence,
          reason: l.reason,
          bytes: l.buffer.length,
          dataUrl: skipDataUrl ? null : `data:${l.mimeType};base64,${l.buffer.toString("base64")}`,
          dataUrlSkipped: skipDataUrl,
        };
      });

      res.json({
        ok: true,
        brandKit: {
          brandName: kit.brandName,
          brandNameAlternatives: kit.brandNameAlternatives,
          taglines: kit.taglines,
          socialHandles: kit.socialHandles,
          urls: kit.urls,
          emails: kit.emails,
          phones: kit.phones,
          hexColors: kit.hexColors,
          fonts: kit.fonts,
          visibleText: kit.visibleText,
          logoCandidates,
          sources: kit.sources,
          warnings: kit.warnings,
        },
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, "brand-kit/extract failed");
      res.status(500).json({ error: err?.message || "extract failed" });
    }
  },
);

// ─── PREVIEW THE OVERLAY ON A TEST VIDEO ─────────────────────────────────
//
// Body JSON or multipart with optional logo. Accepts EITHER:
//   { videoUrl: "https://…/test.mp4", brandKit: {...}, accentHex?: "#C8A84B", aspect?: "9:16" }
// OR a multipart with `video` (mp4 buffer) + `logo` (image buffer) + JSON body fields.
router.post(
  "/projects/:projectId/brand-kit/preview-overlay",
  upload.fields([{ name: "video", maxCount: 1 }, { name: "logo", maxCount: 1 }]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.projectId);
      if (!Number.isFinite(projectId) || projectId <= 0) {
        res.status(400).json({ error: "invalid projectId" });
        return;
      }

      // Resolve video buffer.
      let videoBuffer: Buffer | null = null;
      const fileFields = req.files as Record<string, Express.Multer.File[]> | undefined;
      if (fileFields?.video?.[0]) {
        videoBuffer = fileFields.video[0].buffer;
      } else if (typeof req.body?.videoUrl === "string" && req.body.videoUrl) {
        if (!isPublicUrl(req.body.videoUrl)) {
          res.status(400).json({ error: "videoUrl debe ser una URL pública (http/https). No se permiten hosts internos." });
          return;
        }
        videoBuffer = await fetchToBuffer(req.body.videoUrl);
      }
      if (!videoBuffer) {
        res.status(400).json({ error: "Falta el vídeo: pasa `video` (multipart) o `videoUrl`." });
        return;
      }

      // Resolve logo buffer (optional).
      let logoBuffer: Buffer | undefined;
      let logoMime: string | undefined;
      if (fileFields?.logo?.[0]) {
        logoBuffer = fileFields.logo[0].buffer;
        logoMime = fileFields.logo[0].mimetype;
      } else if (typeof req.body?.logoDataUrl === "string" && req.body.logoDataUrl.startsWith("data:")) {
        const m = req.body.logoDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (m) { logoMime = m[1]; logoBuffer = Buffer.from(m[2], "base64"); }
      }

      // Build the overlay config: caller can pass either an explicit config
      // (`brandOverlay`) OR a brandKit shape that we auto-translate.
      // Bounded JSON parse to prevent abusive payloads (>256KB) from being
      // accepted as overlay/brandKit metadata.
      const safeParse = (v: unknown, label: string): any => {
        if (typeof v !== "string") return v ?? {};
        if (v.length > 256 * 1024) throw new Error(`${label} payload demasiado grande (>256KB)`);
        try { return JSON.parse(v); } catch (e: any) { throw new Error(`${label} JSON inválido: ${e?.message || "parse error"}`); }
      };

      let config: BrandOverlayConfig;
      if (req.body?.brandOverlay) {
        const bo = safeParse(req.body.brandOverlay, "brandOverlay");
        config = bo as BrandOverlayConfig;
        if (logoBuffer && !config.logo) config.logo = { buffer: logoBuffer, mimeType: logoMime };
      } else {
        const kit = safeParse(req.body?.brandKit, "brandKit") || {};
        // Probe the video duration through ffmpeg via a thin re-use: the
        // applyBrandOverlay pipeline does its own probe, but for buildAuto
        // we need duration upfront. Use ffprobe through fluent-ffmpeg.
        // CRITICAL: temp dir cleanup MUST run even if ffprobe rejects,
        // otherwise we leak files into /tmp on every failed call.
        const fs = (await import("node:fs")).promises;
        const path = (await import("node:path")).default;
        const tmp = await fs.mkdtemp("/tmp/preview-");
        let duration: number;
        try {
          const inP = path.join(tmp, "in.mp4");
          await fs.writeFile(inP, videoBuffer);
          const ffmpeg = (await import("fluent-ffmpeg")).default;
          duration = await new Promise<number>((resolve, reject) => {
            ffmpeg.ffprobe(inP, (err: Error | null, data: any) => {
              if (err) return reject(err);
              const d = Number(data?.format?.duration) || 0;
              if (!d) return reject(new Error("could not probe duration"));
              resolve(d);
            });
          });
        } finally {
          fs.rm(tmp, { recursive: true, force: true }).catch(() => { });
        }
        config = buildAutoBrandOverlay({
          videoDurationSec: duration,
          brandName: kit.brandName,
          tagline: kit.taglines?.[0],
          socialHandles: kit.socialHandles,
          url: kit.urls?.[0],
          ctaText: req.body?.ctaText,
          accentHex: kit.hexColors?.[0] || req.body?.accentHex,
          logo: logoBuffer ? { buffer: logoBuffer, mimeType: logoMime } : undefined,
          aspect: req.body?.aspect,
        });
      }

      const result = await applyBrandOverlay(videoBuffer, config);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `inline; filename="overlay-preview.mp4"`);
      res.setHeader("X-Overlay-Applied", String(result.applied));
      if (result.skipped.length) res.setHeader("X-Overlay-Skipped", result.skipped.join(","));
      res.end(result.buffer);
    } catch (err: any) {
      logger.error({ err: err?.message }, "brand-kit/preview-overlay failed");
      res.status(500).json({ error: err?.message || "preview failed" });
    }
  },
);

export default router;
