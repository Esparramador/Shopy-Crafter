import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * app_settings la crean varios módulos al arrancar (tienda, billing, shop). Si dos
 * ejecutan `CREATE TABLE IF NOT EXISTS` a la vez, PostgreSQL puede fallar con
 * `duplicate key … pg_type_typname_nsp_index` (carrera conocida). Una sola promesa
 * compartida y, si aun así otro proceso gana la carrera, se acepta.
 */
let ready: Promise<void> | null = null;

export function isConcurrentCreateError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  const code = e?.code ?? e?.cause?.code;
  return code === "23505" || code === "42P07";
}

export function ensureAppSettingsTable(): Promise<void> {
  ready ??= db
    .execute(sql`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`)
    .then(() => undefined)
    .catch(err => {
      if (isConcurrentCreateError(err)) return;
      ready = null;
      throw err;
    });
  return ready;
}
