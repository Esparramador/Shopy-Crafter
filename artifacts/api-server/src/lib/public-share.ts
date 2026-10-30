import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ensureFileStore, putFile } from "./file-store.js";
import { publicAppUrl } from "./account-tokens.js";
import { logger } from "./logger.js";

/**
 * Enlaces públicos temporales para que un proveedor externo (Replicate, D-ID…)
 * descargue un archivo que generamos (audio, foto de referencia). Antes se
 * copiaba a shopify-optimizer/public y se pasaba la URL del dominio de
 * desarrollo: en producción esa URL no existe.
 *
 * El nombre es aleatorio (128 bits) y caduca: nadie puede listarlos ni adivinarlos.
 */
export const SHARE_NS = "share";
export const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

const EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4",
};

/** Guarda el archivo y devuelve su URL pública absoluta (o null si no hay dominio público configurado). */
export async function sharePublicly(bytes: Buffer, mime: string): Promise<string | null> {
  const base = publicAppUrl();
  if (!base) return null;
  const key = `${randomBytes(16).toString("hex")}.${EXT_BY_MIME[mime] ?? "bin"}`;
  await putFile(SHARE_NS, key, bytes, mime);
  return `${base}/api/share/${key}`;
}

export function isShareExpired(createdAt: Date, now = Date.now()): boolean {
  return now - createdAt.getTime() > SHARE_TTL_MS;
}

export async function purgeExpiredShares(): Promise<number> {
  await ensureFileStore();
  const r = await db.execute(sql`
    DELETE FROM stored_files WHERE namespace = ${SHARE_NS} AND created_at < NOW() - INTERVAL '24 hours'
  `);
  const n = r.rowCount ?? 0;
  if (n) logger.info({ n }, "[share] enlaces caducados borrados");
  return n;
}
