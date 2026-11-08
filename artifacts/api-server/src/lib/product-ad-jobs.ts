import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";

const processInstanceId = randomUUID();

export type ProductAdJobStatus = "running" | "completed" | "failed" | "interrupted";

export interface ProductAdProviderTask {
  provider: string;
  taskId: string;
  model?: string;
  sceneIndex?: number;
  createdAt: string;
}

export interface ProductAdJob {
  id: string;
  projectId: number;
  productId: string;
  kind: "smart-quick" | "smart-cinematic";
  status: ProductAdJobStatus;
  stage: string;
  message: string | null;
  providerTasks: ProductAdProviderTask[];
  vaultId: number | null;
  videoUrl: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductAdJobRow {
  id: string;
  project_id: number;
  product_id: string;
  kind: ProductAdJob["kind"];
  status: ProductAdJobStatus;
  stage: string;
  message: string | null;
  provider_tasks: ProductAdProviderTask[] | string | null;
  vault_id: number | null;
  video_url: string | null;
  result: Record<string, unknown> | string | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

let ensurePromise: Promise<void> | null = null;

export function ensureProductAdJobsTable(): Promise<void> {
  ensurePromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS product_ad_jobs (
      id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('smart-quick', 'smart-cinematic')),
      instance_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'interrupted')),
      stage TEXT NOT NULL DEFAULT 'starting',
      message TEXT,
      provider_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
      vault_id INTEGER,
      video_url TEXT,
      result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS product_ad_jobs_latest_idx
      ON product_ad_jobs (project_id, product_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS product_ad_jobs_one_running_idx
      ON product_ad_jobs (project_id, product_id) WHERE status = 'running';
    ALTER TABLE product_ad_jobs ADD COLUMN IF NOT EXISTS instance_id TEXT;
    UPDATE product_ad_jobs SET instance_id = 'legacy' WHERE instance_id IS NULL;
  `).then(() => undefined).catch((error) => {
    ensurePromise = null;
    throw error;
  });
  return ensurePromise;
}

function parseJson<T>(value: T | string | null): T | null {
  if (value === null) return null;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function mapJob(row: ProductAdJobRow | undefined): ProductAdJob | null {
  if (!row) return null;
  return {
    id: row.id,
    projectId: Number(row.project_id),
    productId: row.product_id,
    kind: row.kind,
    status: row.status,
    stage: row.stage,
    message: row.message,
    providerTasks: parseJson(row.provider_tasks) ?? [],
    vaultId: row.vault_id === null ? null : Number(row.vault_id),
    videoUrl: row.video_url,
    result: parseJson(row.result),
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function createProductAdJob(input: {
  projectId: number;
  productId: string;
  kind: ProductAdJob["kind"];
}): Promise<{ job: ProductAdJob; created: boolean }> {
  await ensureProductAdJobsTable();
  const id = randomUUID();
  const result = await pool.query<ProductAdJobRow>(`
    INSERT INTO product_ad_jobs (id, project_id, product_id, kind, instance_id, status, stage)
    VALUES ($1, $2, $3, $4, $5, 'running', 'starting')
    ON CONFLICT (project_id, product_id) WHERE status = 'running' DO NOTHING
    RETURNING *
  `, [id, input.projectId, input.productId, input.kind, processInstanceId]);
  if (result.rows[0]) {
    const job = mapJob(result.rows[0]);
    if (!job) throw new Error("No se pudo crear el registro de recuperación del anuncio");
    return { job, created: true };
  }
  const existingResult = await pool.query<ProductAdJobRow>(`
    SELECT * FROM product_ad_jobs
    WHERE project_id = $1 AND product_id = $2 AND status = 'running'
    ORDER BY created_at DESC
    LIMIT 1
  `, [input.projectId, input.productId]);
  const job = mapJob(existingResult.rows[0]);
  if (!job) throw new Error("No se pudo crear el registro de recuperación del anuncio");
  return { job, created: false };
}

export async function updateProductAdJob(
  id: string,
  update: {
    status?: ProductAdJobStatus;
    stage?: string;
    message?: string | null;
    providerTask?: Omit<ProductAdProviderTask, "createdAt">;
    vaultId?: number | null;
    videoUrl?: string | null;
    result?: Record<string, unknown> | null;
    error?: string | null;
  },
): Promise<void> {
  await ensureProductAdJobsTable();
  const providerTask = update.providerTask
    ? { ...update.providerTask, createdAt: new Date().toISOString() }
    : null;
  await pool.query(`
    UPDATE product_ad_jobs
    SET status = COALESCE($2, status),
        stage = COALESCE($3, stage),
        message = CASE WHEN $4::boolean THEN $5 ELSE message END,
        provider_tasks = CASE WHEN $6::jsonb IS NULL THEN provider_tasks ELSE provider_tasks || $6::jsonb END,
        vault_id = CASE WHEN $7::boolean THEN $8 ELSE vault_id END,
        video_url = CASE WHEN $9::boolean THEN $10 ELSE video_url END,
        result = CASE WHEN $11::boolean THEN $12::jsonb ELSE result END,
        error = CASE WHEN $13::boolean THEN $14 ELSE error END,
        updated_at = NOW()
    WHERE id = $1 AND status = 'running'
  `, [
    id,
    update.status ?? null,
    update.stage ?? null,
    update.message !== undefined,
    update.message ?? null,
    providerTask ? JSON.stringify([providerTask]) : null,
    update.vaultId !== undefined,
    update.vaultId ?? null,
    update.videoUrl !== undefined,
    update.videoUrl ?? null,
    update.result !== undefined,
    update.result === undefined ? null : JSON.stringify(update.result),
    update.error !== undefined,
    update.error ?? null,
  ]);
}

export async function getProductAdJob(
  id: string,
  projectId: number,
  productId: string,
): Promise<ProductAdJob | null> {
  await ensureProductAdJobsTable();
  const result = await pool.query<ProductAdJobRow>(`
    SELECT * FROM product_ad_jobs
    WHERE id = $1 AND project_id = $2 AND product_id = $3
    LIMIT 1
  `, [id, projectId, productId]);
  return mapJob(result.rows[0]);
}

export async function getLatestProductAdJob(
  projectId: number,
  productId: string,
): Promise<ProductAdJob | null> {
  await ensureProductAdJobsTable();
  const result = await pool.query<ProductAdJobRow>(`
    SELECT * FROM product_ad_jobs
    WHERE project_id = $1 AND product_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [projectId, productId]);
  return mapJob(result.rows[0]);
}

/**
 * On restart, don't silently retry paid generation calls. Keep the task IDs so
 * the user can distinguish an interrupted job from one that never started.
 */
export async function markRunningProductAdJobsInterrupted(): Promise<number> {
  await ensureProductAdJobsTable();
  const result = await pool.query(`
    UPDATE product_ad_jobs
    SET status = 'interrupted',
        stage = 'interrupted',
        message = 'El servidor se reinició antes de confirmar el resultado.',
        error = COALESCE(error, 'SERVER_RESTARTED'),
        updated_at = NOW()
    WHERE status = 'running' AND instance_id <> $1
    RETURNING id
  `, [processInstanceId]);
  return result.rowCount ?? 0;
}

/**
 * Closes the small crash window after Vault has durably saved the MP4 but
 * before the job row was marked completed.
 */
export async function recoverProductAdJobsFromVault(): Promise<number> {
  await ensureProductAdJobsTable();
  const files = await pool.query<{
    id: number;
    project_id: number;
    product_id: string | null;
    category: string | null;
    metadata: string | null;
  }>(`
    SELECT id, project_id, product_id, category, metadata
    FROM project_files
    WHERE file_type = 'video'
      AND category IN ('smart_quick_ad', 'smart_cinematic_ad')
      AND metadata LIKE '%"adJobId"%'
    ORDER BY created_at DESC
  `);

  let recovered = 0;
  for (const file of files.rows) {
    if (!file.project_id || !file.metadata) continue;
    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(file.metadata) as Record<string, unknown>;
    } catch {
      continue;
    }
    const jobId = typeof metadata.adJobId === "string" ? metadata.adJobId : "";
    if (!jobId) continue;
    const videoUrl = `/api/projects/${file.project_id}/vault/${file.id}/download`;
    const jobResult = await pool.query(`
      UPDATE product_ad_jobs
      SET status = 'completed',
          stage = 'completed',
          message = 'Anuncio recuperado del Vault tras reiniciar el servidor.',
          vault_id = $2,
          video_url = $3,
          result = jsonb_build_object('success', true, 'vaultId', $2, 'videoUrl', $3),
          error = NULL,
          updated_at = NOW()
      WHERE id = $1 AND status IN ('running', 'interrupted', 'failed')
      RETURNING id
    `, [jobId, file.id, videoUrl]);
    recovered += jobResult.rowCount ?? 0;
  }
  return recovered;
}
