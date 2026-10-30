import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Archivos que la app genera o recibe y tiene que volver a servir (adjuntos de
 * mensajes, modelos 3D, audios, informes). Antes iban al disco del API, pero el
 * despliegue es autoscale: el disco no persiste entre reinicios ni se comparte
 * entre instancias, y lo que caía en shopify-optimizer/public no lo servía nadie
 * (en producción el frontend es el build estático).
 *
 * Se guardan en PostgreSQL, como media-store y las subidas de la tienda: no hace
 * falta configurar nada y funciona igual en desarrollo y en producción.
 * Clave = (namespace, key); la key la elige quien guarda (p. ej. el nombre que ya
 * aparece en las URLs) y se valida antes de usarla.
 */

export const FILE_STORE_MAX_BYTES = 100 * 1024 * 1024;
// Se admiten subcarpetas ("models/x.glb"), nunca "..", "//" ni una barra inicial.
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,180}$/;
const NS_RE = /^[a-z][a-z0-9-]{1,30}$/;

let ready: Promise<void> | null = null;
export function ensureFileStore(): Promise<void> {
  ready ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stored_files (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        bytes BYTEA NOT NULL,
        original_name TEXT,
        project_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (namespace, key)
      )
    `);
  })().catch(err => { ready = null; throw err; });
  return ready;
}

function check(namespace: string, key: string): void {
  if (!NS_RE.test(namespace)) throw new Error(`namespace inválido: ${namespace}`);
  if (!isValidStoreKey(key)) throw new Error("Nombre de archivo inválido");
}

export function isValidStoreKey(key: string): boolean {
  return KEY_RE.test(key) && !key.includes("..") && !key.includes("//") && !key.endsWith("/");
}

export async function putFile(
  namespace: string,
  key: string,
  bytes: Buffer,
  mime: string,
  meta: { originalName?: string | null; projectId?: number | null } = {},
): Promise<void> {
  check(namespace, key);
  if (bytes.length > FILE_STORE_MAX_BYTES) throw new Error(`Archivo demasiado grande (máx. ${FILE_STORE_MAX_BYTES / 1024 / 1024} MB)`);
  await ensureFileStore();
  await db.execute(sql`
    INSERT INTO stored_files (namespace, key, mime, size, bytes, original_name, project_id)
    VALUES (${namespace}, ${key}, ${mime || "application/octet-stream"}, ${bytes.length}, ${bytes},
            ${meta.originalName?.slice(0, 200) ?? null}, ${meta.projectId ?? null})
    ON CONFLICT (namespace, key) DO UPDATE SET
      mime = EXCLUDED.mime, size = EXCLUDED.size, bytes = EXCLUDED.bytes,
      original_name = EXCLUDED.original_name, project_id = EXCLUDED.project_id, created_at = NOW()
  `);
}

export interface StoredFile { mime: string; size: number; bytes: Buffer; originalName: string | null; projectId: number | null; createdAt: Date }

export async function getFile(namespace: string, key: string): Promise<StoredFile | null> {
  if (!NS_RE.test(namespace) || !isValidStoreKey(key)) return null;
  await ensureFileStore();
  const r = await db.execute(sql`
    SELECT mime, size, bytes, original_name, project_id, created_at FROM stored_files
    WHERE namespace = ${namespace} AND key = ${key}
  `);
  const row = r.rows[0] as { mime: string; size: number; bytes: Buffer | Uint8Array; original_name: string | null; project_id: number | null; created_at: Date } | undefined;
  if (!row) return null;
  return { mime: row.mime, size: Number(row.size), bytes: Buffer.from(row.bytes), originalName: row.original_name, projectId: row.project_id, createdAt: new Date(row.created_at) };
}

export async function hasFile(namespace: string, key: string): Promise<boolean> {
  if (!NS_RE.test(namespace) || !isValidStoreKey(key)) return false;
  await ensureFileStore();
  const r = await db.execute(sql`SELECT 1 FROM stored_files WHERE namespace = ${namespace} AND key = ${key}`);
  return r.rows.length > 0;
}

export async function deleteFile(namespace: string, key: string): Promise<void> {
  if (!NS_RE.test(namespace) || !isValidStoreKey(key)) return;
  await ensureFileStore();
  await db.execute(sql`DELETE FROM stored_files WHERE namespace = ${namespace} AND key = ${key}`);
}

/** Claves de un namespace (con prefijo opcional), sin leer los bytes. */
export async function listFiles(namespace: string, prefix = ""): Promise<Array<{ key: string; mime: string; size: number; createdAt: Date }>> {
  if (!NS_RE.test(namespace)) return [];
  await ensureFileStore();
  const r = await db.execute(sql`
    SELECT key, mime, size, created_at FROM stored_files
    WHERE namespace = ${namespace} AND key LIKE ${prefix.replace(/[%_\\]/g, "\\$&") + "%"}
    ORDER BY created_at DESC
  `);
  return (r.rows as Array<{ key: string; mime: string; size: number; created_at: Date }>).map(x => ({ key: x.key, mime: x.mime, size: Number(x.size), createdAt: new Date(x.created_at) }));
}
