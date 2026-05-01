import type { Request, Response } from "express";
import { logger } from "./logger.js";
import { enableLongRunning } from "./long-running.js";

export function setupZipStream(
  req: Request,
  res: Response,
  archive: any,
): { ac: AbortController; isClientGone: () => boolean } {
  enableLongRunning(res);
  const ac = new AbortController();
  let clientGone = false;
  const onAbort = (reason: string) => {
    if (clientGone) return;
    clientGone = true;
    logger.warn({ reason, url: req.originalUrl }, "ZIP stream aborted by client");
    try { ac.abort(); } catch {}
    try { archive.destroy(); } catch {}
  };
  req.on("close", () => { if (!res.writableEnded) onAbort("req-close"); });
  req.on("aborted", () => onAbort("req-aborted"));
  res.on("error", (err) => onAbort(`res-error:${err?.message ?? err}`));
  archive.on("error", (err: any) => {
    logger.error({ err, url: req.originalUrl }, "ZIP archive error");
    if (!res.headersSent) {
      try { res.status(500).json({ error: "Error generando ZIP" }); } catch {}
    } else {
      try { res.destroy(); } catch {}
    }
  });
  archive.on("warning", (err: any) => {
    if (err?.code === "ENOENT") logger.warn({ err }, "ZIP warning (skipped entry)");
    else logger.error({ err }, "ZIP warning");
  });
  return { ac, isClientGone: () => clientGone };
}

export function withAbort(signal: AbortSignal, timeoutMs = 30000): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}

/**
 * Detecta si un mimeType es binario (imagen / video / audio / pdf / zip / octet).
 * Cuando GCS falla y el binario cae en `content` como base64, debemos
 * decodificar y conservar la extensión correcta — no servirlo como .html.
 */
export function isBinaryMime(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  return /^(image|video|audio)\//.test(mimeType)
      || mimeType === "application/pdf"
      || mimeType === "application/zip"
      || mimeType === "application/octet-stream";
}

/**
 * Devuelve la extensión correcta para un mimeType. Compatible con los formatos
 * que generamos (mp4/webm/jpg/png/webp/mp3/wav/pdf/json/html/...).
 */
export function extForMime(mimeType?: string | null): string {
  if (!mimeType) return "bin";
  const m = mimeType.toLowerCase();
  if (m === "video/mp4" || m === "video/quicktime") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/svg+xml") return "svg";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav") return "wav";
  if (m === "audio/ogg") return "ogg";
  if (m === "application/pdf") return "pdf";
  if (m === "application/zip") return "zip";
  if (m === "application/json") return "json";
  if (m === "text/html") return "html";
  if (m === "text/css") return "css";
  if (m === "text/plain") return "txt";
  const fallback = m.split("/")[1]?.split(";")[0]?.split("+")[0];
  return fallback || "bin";
}
