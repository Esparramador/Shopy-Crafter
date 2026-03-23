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
  await db
    .update(bulkJobsTable)
    .set({ status: "completed", result: result ?? null })
    .where(eq(bulkJobsTable.jobId, jobId));
}

export async function failJob(jobId: string, error: string): Promise<void> {
  logger.error({ jobId, error }, "Bulk job failed");
  await db
    .update(bulkJobsTable)
    .set({ status: "failed", log: [error] })
    .where(eq(bulkJobsTable.jobId, jobId));
}

export function runAsync(fn: () => Promise<void>): void {
  fn().catch((err: Error) => {
    logger.error({ err: err.message }, "Async job error");
  });
}
