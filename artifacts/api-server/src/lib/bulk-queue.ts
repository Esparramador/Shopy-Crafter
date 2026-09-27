import { db } from "@workspace/db";
import { bulkJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";

export async function createBulkJob(
  projectId: number,
  jobType: string,
  totalItems: number
): Promise<string> {
  const jobId = randomUUID();
  await db.insert(bulkJobsTable).values({
    jobId,
    projectId,
    jobType,
    status: "running",
    totalItems,
    completedItems: 0,
    failedItems: 0,
    log: [],
  });
  return jobId;
}

export async function updateJobProgress(
  jobId: string,
  completedItems: number,
  failedItems: number,
  logEntry: string
): Promise<void> {
  const [job] = await db.select().from(bulkJobsTable).where(eq(bulkJobsTable.jobId, jobId));
  if (!job) return;

  const newLog = [...(job.log ?? []), logEntry];
  const isDone = completedItems + failedItems >= job.totalItems;

  await db
    .update(bulkJobsTable)
    .set({
      completedItems,
      failedItems,
      status: isDone ? (failedItems === job.totalItems ? "failed" : "completed") : "running",
      log: newLog,
    })
    .where(eq(bulkJobsTable.jobId, jobId));
}

export async function completeJob(jobId: string, result?: object): Promise<void> {
  // El estado final depende de lo ocurrido: antes siempre "completed", incluso
  // si fallaban todos los elementos (pisaba el "failed" de updateJobProgress).
  const [job] = await db.select().from(bulkJobsTable).where(eq(bulkJobsTable.jobId, jobId));
  const allFailed = !!job && job.totalItems > 0 && (job.completedItems ?? 0) === 0 && (job.failedItems ?? 0) > 0;
  await db
    .update(bulkJobsTable)
    .set({ status: allFailed || job?.status === "failed" ? "failed" : "completed", result: result ?? null })
    .where(eq(bulkJobsTable.jobId, jobId));
}

export async function failJob(jobId: string, error: string): Promise<void> {
  logger.error({ jobId, error }, "Bulk job failed");
  const [job] = await db.select({ log: bulkJobsTable.log }).from(bulkJobsTable).where(eq(bulkJobsTable.jobId, jobId));
  await db
    .update(bulkJobsTable)
    .set({ status: "failed", log: [...(job?.log ?? []), `✗ ${error}`] })
    .where(eq(bulkJobsTable.jobId, jobId));
}

/**
 * Ejecuta en segundo plano. Si la función lanza fuera de su propio manejo de
 * errores, el job se marca "failed" (antes quedaba "running" para siempre).
 */
export function runAsync(fn: () => Promise<void>, jobId?: string): void {
  fn().catch((err: Error) => {
    logger.error({ err: err?.message, jobId }, "Async job error");
    if (jobId) failJob(jobId, err?.message || "Error interno").catch(() => {});
  });
}

/** runAsync ligado a un bulk job: si revienta, el job queda "failed". */
export function runAsyncJob(jobId: string, fn: () => Promise<void>): void {
  runAsync(fn, jobId);
}

/** Al arrancar: los jobs que estaban "running" murieron con el proceso anterior. */
export async function failStaleBulkJobs(): Promise<number> {
  const rows = await db.update(bulkJobsTable)
    .set({ status: "failed" })
    .where(eq(bulkJobsTable.status, "running"))
    .returning({ jobId: bulkJobsTable.jobId });
  if (rows.length) logger.warn({ count: rows.length }, "bulk jobs interrumpidos por reinicio marcados como failed");
  return rows.length;
}
