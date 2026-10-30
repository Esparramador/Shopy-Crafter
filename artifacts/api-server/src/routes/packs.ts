/**
 * Packs: uso del mes y trabajo programado bajo demanda.
 *  - GET  /admin/packs/:projectId/usage   uso del mes del proyecto (admin)
 *  - POST /admin/packs/:projectId/run     ejecuta ya PageSpeed, informe y/o avisos de Stripe (admin)
 *  - GET  /client/pack-usage              uso del mes del proyecto del cliente (su sesión)
 */
import { Router, type Request, type Response } from "express";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { packUsageSummary } from "../lib/pack-quotas.js";
import { runPackJobsForProject, type PackJob } from "../lib/pack-monitoring.js";

const router = Router();
const JOBS: PackJob[] = ["pagespeed", "report", "stripe_alerts"];

function projectIdOf(req: Request): number {
  const n = parseInt(String(req.params.projectId), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

router.get("/admin/packs/:projectId/usage", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const pid = projectIdOf(req);
  if (!pid) { res.status(400).json({ error: "Proyecto no válido" }); return; }
  try {
    res.json({ usage: await packUsageSummary(pid) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/admin/packs/:projectId/run", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const pid = projectIdOf(req);
  if (!pid) { res.status(400).json({ error: "Proyecto no válido" }); return; }
  const asked = (req.body as { jobs?: unknown } | undefined)?.jobs;
  const jobs = Array.isArray(asked) ? JOBS.filter(j => asked.includes(j)) : JOBS;
  if (jobs.length === 0) { res.status(400).json({ error: `jobs debe incluir alguno de: ${JOBS.join(", ")}` }); return; }
  try {
    const done = await runPackJobsForProject(pid, jobs);
    res.json({ ok: true, done });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, pid }, "packs/run error");
    res.status(400).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/client/pack-usage", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const s = req.session as { clientId?: string | number | null; role?: string };
  const pid = s.clientId ? parseInt(String(s.clientId), 10) : (s.role === "admin" ? parseInt(String(req.query.pid ?? ""), 10) : 0);
  if (!Number.isFinite(pid) || pid <= 0) { res.status(400).json({ error: "No project linked" }); return; }
  try {
    res.json({ usage: await packUsageSummary(pid) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

export default router;
