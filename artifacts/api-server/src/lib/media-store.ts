import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Imágenes subidas desde el panel (CMS, portfolio). Se guardan en PostgreSQL y
 * se sirven por /api/media/:id. Antes se escribían en
 * shopify-optimizer/public/media del disco del API, pero en producción el
 * frontend se sirve como estático desde dist/public: esas URLs daban 404 y el
 * disco del despliegue no persiste.
 */

let ready: Promise<void> | null = null;
export function ensureMediaTable(): Promise<void> {
  ready ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      bytes BYTEA NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      original_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => undefined).catch(err => { ready = null; throw err; });
  return ready;
}

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "video/mp4": "mp4", "video/webm": "webm" };

export async function saveMedia(buf: Buffer, mime: string, meta: { width?: number; height?: number; originalName?: string } = {}): Promise<{ id: string; url: string }> {
  await ensureMediaTable();
  const id = `${randomBytes(12).toString("hex")}.${EXT[mime] ?? "bin"}`;
  await db.execute(sql`
    INSERT INTO media_files (id, mime, bytes, size, width, height, original_name)
    VALUES (${id}, ${mime}, ${buf}, ${buf.length}, ${meta.width ?? null}, ${meta.height ?? null}, ${meta.originalName ?? null})
  `);
  return { id, url: `/api/media/${id}` };
}

export async function getMedia(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^[a-f0-9]{24}\.[a-z0-9]{2,4}$/.test(id)) return null;
  await ensureMediaTable();
  const r = await db.execute(sql`SELECT mime, bytes FROM media_files WHERE id = ${id}`);
  const row = r.rows[0] as { mime: string; bytes: Buffer | Uint8Array } | undefined;
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes) } : null;
}

export async function deleteMedia(id: string): Promise<void> {
  await ensureMediaTable();
  await db.execute(sql`DELETE FROM media_files WHERE id = ${id}`);
}

/** id a partir de una URL /api/media/<id> (o null si es otra URL). */
export function mediaIdFromUrl(url: string): string | null {
  const m = /\/api\/media\/([a-f0-9]{24}\.[a-z0-9]{2,4})$/.exec(url);
  return m ? m[1] : null;
}
