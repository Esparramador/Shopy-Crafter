import type { Request, Response } from "express";
import { logger } from "./logger.js";
import { enableLongRunning } from "./long-running.js";

/* eslint-disable @typescript-eslint/no-require-imports */
const archiver = require("archiver");

// ─────────────────────────────────────────────────────────────────────────────
//  setupZipStream — handler de aborts CON marca de finalización.
//  Antes: `req.on("close")` podía dispararse por race-condition mientras
//  archive.finalize() estaba escribiendo el central directory → ZIP truncado
//  → "Windows no puede abrir la carpeta".
//  Ahora: una vez markFinalizing() se llama, los aborts son IGNORADOS — el
//  central directory se garantiza escribir.
// ─────────────────────────────────────────────────────────────────────────────
export interface ZipStreamControl {
  ac: AbortController;
  isClientGone: () => boolean;
  markFinalizing: () => void;
}

export function setupZipStream(
  req: Request,
  res: Response,
  archive: any,
): ZipStreamControl {
  enableLongRunning(res);
  const ac = new AbortController();
  let clientGone = false;
  let finalizing = false;

  const onAbort = (reason: string) => {
    if (clientGone || finalizing) return;
    clientGone = true;
    logger.warn({ reason, url: req.originalUrl }, "ZIP stream aborted by client");
    try { ac.abort(); } catch {}
    try { archive.destroy(); } catch {}
  };

  req.on("close", () => {
    if (!res.writableEnded && !finalizing) onAbort("req-close");
  });
  req.on("aborted", () => onAbort("req-aborted"));
  res.on("error", (err) => {
    if (finalizing) return;
    onAbort(`res-error:${err?.message ?? err}`);
  });

  archive.on("error", (err: any) => {
    logger.error({ err: err?.message, code: err?.code, url: req.originalUrl }, "ZIP archive error");
    if (!res.headersSent) {
      try { res.status(500).json({ error: "Error generando ZIP" }); } catch {}
    } else {
      try { res.destroy(); } catch {}
    }
  });
  archive.on("warning", (err: any) => {
    if (err?.code === "ENOENT") logger.warn({ err: err?.message }, "ZIP warning (skipped entry)");
    else logger.warn({ err: err?.message, code: err?.code }, "ZIP warning");
  });

  return {
    ac,
    isClientGone: () => clientGone,
    markFinalizing: () => { finalizing = true; },
  };
}

export function withAbort(signal: AbortSignal, timeoutMs = 30000): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  isBinaryMime — detección AMPLIA de tipos binarios.
//  Cubre: image/*, video/*, audio/*, font/*, pdf, zip variants, octet-stream,
//  office docs (xlsx/docx/pptx), wasm, etc. Cualquier mime no listado aquí
//  cae al branch "texto/HTML" y se corrompe si en realidad era binario.
// ─────────────────────────────────────────────────────────────────────────────
export function isBinaryMime(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const m = String(mimeType).toLowerCase().split(";")[0].trim();
  if (/^(image|video|audio|font)\//.test(m)) return true;
  if (m === "application/pdf") return true;
  if (m === "application/zip" || m === "application/x-zip-compressed" || m === "application/x-zip") return true;
  if (m === "application/octet-stream") return true;
  if (m === "application/wasm") return true;
  if (m === "application/x-rar-compressed" || m === "application/vnd.rar") return true;
  if (m === "application/x-7z-compressed") return true;
  if (m === "application/x-tar" || m === "application/gzip" || m === "application/x-gzip") return true;
  if (m.startsWith("application/vnd.openxmlformats-officedocument")) return true; // docx/xlsx/pptx
  if (m.startsWith("application/vnd.ms-")) return true; // doc/xls/ppt
  if (m === "application/vnd.oasis.opendocument.text") return true;
  if (m === "application/vnd.oasis.opendocument.spreadsheet") return true;
  if (m === "application/vnd.oasis.opendocument.presentation") return true;
  if (m === "application/x-shockwave-flash") return true;
  if (m === "application/postscript") return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  isAlreadyCompressed — devuelve true para mimes que ya vienen comprimidos
//  (jpg/png/webp/mp3/mp4/zip/pdf/...). Para esos, dentro del ZIP usamos
//  STORE en vez de DEFLATE (zlib level 0): ahorra CPU y elimina riesgos
//  de DEFLATE sobre buffers gigantes.
// ─────────────────────────────────────────────────────────────────────────────
export function isAlreadyCompressed(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const m = String(mimeType).toLowerCase().split(";")[0].trim();
  if (/^image\/(jpe?g|png|webp|gif|avif|heic|heif)$/.test(m)) return true;
  if (/^video\//.test(m)) return true;
  if (/^audio\/(mpeg|mp3|mp4|aac|ogg|webm|opus|flac)$/.test(m)) return true;
  if (m === "application/pdf") return true;
  if (m === "application/zip" || m === "application/x-zip-compressed") return true;
  if (m === "application/gzip" || m === "application/x-gzip") return true;
  if (m === "application/x-rar-compressed" || m === "application/vnd.rar") return true;
  if (m === "application/x-7z-compressed") return true;
  if (m === "font/woff" || m === "font/woff2" || m === "application/font-woff") return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  extForMime — mapa exhaustivo mime→extensión. Incluye todos los mimes que
//  generamos y los más comunes que un usuario podría subir. Si no hay match,
//  hace fallback inteligente por familia (image/* → png, video/* → mp4...).
// ─────────────────────────────────────────────────────────────────────────────
export function extForMime(mimeType?: string | null): string {
  if (!mimeType) return "bin";
  const m = String(mimeType).toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    // imágenes
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/pjpeg": "jpg",
    "image/png": "png", "image/x-png": "png",
    "image/webp": "webp", "image/gif": "gif",
    "image/avif": "avif", "image/heic": "heic", "image/heif": "heif",
    "image/svg+xml": "svg", "image/tiff": "tiff", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
    "image/bmp": "bmp",
    // vídeo
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "video/x-matroska": "mkv", "video/mpeg": "mpeg", "video/x-msvideo": "avi",
    "video/3gpp": "3gp", "video/x-flv": "flv", "video/ogg": "ogv",
    // audio
    "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav",
    "audio/ogg": "ogg", "audio/webm": "weba", "audio/aac": "aac",
    "audio/flac": "flac", "audio/x-flac": "flac",
    "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/opus": "opus",
    // texto / data
    "application/json": "json", "application/ld+json": "json",
    "text/html": "html", "application/xhtml+xml": "html",
    "text/plain": "txt", "text/csv": "csv", "text/markdown": "md",
    "text/css": "css", "text/javascript": "js", "application/javascript": "js",
    "application/xml": "xml", "text/xml": "xml",
    "text/yaml": "yaml", "application/x-yaml": "yaml",
    // documentos
    "application/pdf": "pdf",
    "application/zip": "zip", "application/x-zip-compressed": "zip", "application/x-zip": "zip",
    "application/gzip": "gz", "application/x-gzip": "gz",
    "application/x-tar": "tar",
    "application/x-rar-compressed": "rar", "application/vnd.rar": "rar",
    "application/x-7z-compressed": "7z",
    "application/octet-stream": "bin",
    "application/wasm": "wasm",
    // office
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-excel": "xls",
    "application/msword": "doc",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/vnd.oasis.opendocument.presentation": "odp",
    "application/rtf": "rtf",
    // fonts
    "font/woff": "woff", "font/woff2": "woff2", "font/ttf": "ttf", "font/otf": "otf",
    "application/font-woff": "woff", "application/font-woff2": "woff2",
    "application/x-font-ttf": "ttf", "application/x-font-otf": "otf",
  };
  if (map[m]) return map[m];
  // fallback inteligente por familia
  if (m.startsWith("video/")) return m.split("/")[1] || "mp4";
  if (m.startsWith("audio/")) return m.split("/")[1] || "mp3";
  if (m.startsWith("image/")) return m.split("/")[1] || "png";
  if (m.startsWith("font/"))  return m.split("/")[1] || "woff2";
  if (m.startsWith("text/"))  return m.split("/")[1] || "txt";
  return "bin";
}

// ─────────────────────────────────────────────────────────────────────────────
//  sniffMimeFromMagic — detecta mime por magic bytes. Útil cuando el mime
//  almacenado es genérico (octet-stream) o erróneo. Devuelve null si no
//  reconoce los primeros bytes.
// ─────────────────────────────────────────────────────────────────────────────
export function sniffMimeFromMagic(buf: Buffer): string | null {
  if (!buf || buf.length < 4) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  // WebP (RIFF....WEBP)
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  // PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  // ZIP / docx / xlsx / pptx
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return "application/zip";
  // MP4 / MOV (ftyp box at offset 4)
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video/mp4";
  // MP3 (ID3 tag)
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return "audio/mpeg";
  // MP3 (frame sync)
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg";
  // OGG
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return "audio/ogg";
  // WAV
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) return "audio/wav";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  createZipResponse — high-level helper. Configura headers UTF-8 (RFC 5987)
//  para nombres con tildes/eñes, crea archive con `forceUTF8`, instala
//  abort handlers, devuelve API simple (.appendBuffer, .appendText, .finalize).
// ─────────────────────────────────────────────────────────────────────────────
export function createZipResponse(
  req: Request,
  res: Response,
  opts: { filename: string; level?: number },
): {
  archive: any;
  ctrl: ZipStreamControl;
  appendBuffer: (buf: Buffer, name: string, mimeType?: string | null) => void;
  appendText: (text: string, name: string) => void;
  finalize: () => Promise<void>;
} {
  const safeAscii = opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "download.zip";
  const utf8 = encodeURIComponent(opts.filename).replace(/['()]/g, escape);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8}`,
  );

  const archive = archiver("zip", {
    zlib: { level: opts.level ?? 6 },
    forceUTF8: true,
    store: false,
  } as any);
  const ctrl = setupZipStream(req, res, archive);
  archive.pipe(res);

  return {
    archive,
    ctrl,
    appendBuffer: (buf, name, mimeType) => {
      try {
        archive.append(buf, { name, store: isAlreadyCompressed(mimeType) });
      } catch (e: any) {
        logger.warn({ name, err: e?.message }, "ZIP appendBuffer skipped (error)");
      }
    },
    appendText: (text, name) => {
      try { archive.append(text, { name }); }
      catch (e: any) { logger.warn({ name, err: e?.message }, "ZIP appendText skipped (error)"); }
    },
    finalize: async () => {
      ctrl.markFinalizing();
      await archive.finalize();
    },
  };
}
