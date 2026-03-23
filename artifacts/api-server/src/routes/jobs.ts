import { Router } from "express";
import { db } from "@workspace/db";
import { bulkJobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/projects/:projectId/jobs/:jobId", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

  const [job] = await db
    .select()
    .from(bulkJobsTable)
    .where(and(eq(bulkJobsTable.jobId, jobId), eq(bulkJobsTable.projectId, projectId)));

  if (!job) {
    res.status(404).json({ error: "Job no encontrado" });
    return;
  }

  const progress = job.totalItems > 0
    ? Math.round(((job.completedItems + job.failedItems) / job.totalItems) * 100)
    : 0;

  res.json({
    jobId: job.jobId,
    status: job.status,
    progress,
    total: job.totalItems,
    completed: job.completedItems,
    failed: job.failedItems,
    log: job.log ?? [],
    result: job.result ?? null,
  });
});

export default router;
