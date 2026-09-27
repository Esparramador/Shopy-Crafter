import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

export const MSG_UPLOADS_DIR = path.resolve(process.cwd(), "msg-uploads");
if (!fs.existsSync(MSG_UPLOADS_DIR)) {
  fs.mkdirSync(MSG_UPLOADS_DIR, { recursive: true });
}

(async () => {
  try {
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type TEXT`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size INTEGER`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS files_json JSONB`);
    logger.info("messages file columns ensured");
  } catch (e: any) {
    logger.warn({ err: e?.message }, "messages file columns migration non-fatal");
  }
})();

/**
 * Aislamiento por proyecto: el nombre en disco lleva el proyecto dueño
 * (`p<id>_<aleatorio><ext>`). Un cliente solo puede servir o adjuntar ficheros
 * de su proyecto; el admin, todos. Los ficheros antiguos sin prefijo solo se
 * sirven al admin o a un cliente cuyo proyecto tenga un mensaje que los cite.
 */
const NAME_RE = /^(?:p(\d+)_)?[a-f0-9]{28}(\.[A-Za-z0-9]{1,10})?$/;

export function uploadOwnerProjectId(req: { session?: any; params?: Record<string, string | undefined>; query?: Record<string, unknown> }): number | null {
  const sess = req.session ?? {};
  const raw = sess.role === "admin" ? (req.params?.["projectId"] ?? req.query?.["pid"]) : sess.clientId;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseMsgUploadName(name: string): { projectId: number | null } | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  return { projectId: m[1] ? Number(m[1]) : null };
}

/** `/api/msg-uploads/<nombre>` → nombre, si la URL es de este almacén. */
export function msgUploadNameFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = /^\/api\/msg-uploads\/([^/?#]+)$/.exec(url);
  return m && parseMsgUploadName(m[1]) ? m[1] : null;
}

/**
 * Valida los adjuntos que llegan en un mensaje: solo URLs de este almacén y,
 * para un cliente, solo ficheros de su propio proyecto. Devuelve el error o null.
 */
export function checkMessageAttachments(
  projectId: number,
  role: string | undefined,
  urls: unknown[],
): string | null {
  for (const url of urls) {
    if (url === undefined || url === null || url === "") continue;
    const name = msgUploadNameFromUrl(url);
    if (!name) return "Adjunto inválido";
    const owner = parseMsgUploadName(name)!.projectId;
    if (role !== "admin" && owner !== projectId) return "Adjunto de otro proyecto";
    if (role === "admin" && owner !== null && owner !== projectId) return "Adjunto de otro proyecto";
  }
  return null;
}

/** Tipos que se pueden mostrar en línea sin ejecutar nada; el resto se descarga. */
const INLINE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg", ".m4a", ".pdf"]);

export function msgUploadHeaders(res: { setHeader: (k: string, v: string) => void }, filePath: string): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  const ext = path.extname(filePath).toLowerCase();
  if (!INLINE_EXT.has(ext)) {
    // html/svg/xml/js… subidos por un cliente no pueden ejecutarse en el origen
    // de la app (XSS contra el admin): se fuerzan como descarga y sin scripts.
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  }
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MSG_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname) || "";
    const ext = /^\.[A-Za-z0-9]{1,10}$/.test(rawExt) ? rawExt : "";
    const owner = uploadOwnerProjectId(req as any);
    if (!owner) { cb(new Error("Sin proyecto para el adjunto"), ""); return; }
    cb(null, `p${owner}_${randomBytes(14).toString("hex")}${ext}`);
  },
});

export const msgUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

export const msgUploadMulti = multer({
  storage: diskStorage,
  limits: { fileSize: 500 * 1024 * 1024, files: 20 },
});
