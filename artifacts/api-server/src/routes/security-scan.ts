import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, securityScansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireProjectAccess } from "../lib/access.js";
import { runSecurityScan } from "../lib/security-scanner.js";
import { validateAuditUrl } from "../lib/web-scraper.js";
import { enableLongRunning } from "../lib/long-running.js";
import { learnFromOperation } from "../lib/claude.js";

const router = Router();

router.post("/projects/:projectId/security-scan/run", requireProjectAccess, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    const rawUrl = (req.body?.url as string | undefined) || project.shopDomain;
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

    const urlError = validateAuditUrl(url);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }

    const result = await runSecurityScan(url);

    const [saved] = await db.insert(securityScansTable).values({
      projectId,
      url: result.url,
      score: result.score,
      findings: result.findings,
      techStack: result.techStack,
      summary: `Score ${result.score}/100 — ${result.countsBySeverity.critical} críticos, ${result.countsBySeverity.high} altos, ${result.countsBySeverity.medium} medios, ${result.countsBySeverity.low} bajos`,
    }).returning();

    try {
      learnFromOperation({
        operationType: "security_scan",
        niche: project.storeNiche ?? null,
        title: `Security Scan: ${new URL(result.url).hostname} — Score ${result.score}/100`,
        content: `Escaneo de seguridad pasivo de ${result.url}. Score: ${result.score}/100. Críticos: ${result.countsBySeverity.critical}, Altos: ${result.countsBySeverity.high}, Medios: ${result.countsBySeverity.medium}. Hallazgos: ${result.findings.map(f => `[${f.severity}] ${f.title}`).join("; ")}`,
        confidence: 0.85,
        tags: ["security", "vulnerability_scan", new URL(result.url).hostname],
      });
    } catch {}

    res.json({ id: saved.id, ...result });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/security-scan/history", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const history = await db.select({
      id: securityScansTable.id,
      url: securityScansTable.url,
      score: securityScansTable.score,
      summary: securityScansTable.summary,
      scannedAt: securityScansTable.scannedAt,
    })
      .from(securityScansTable)
      .where(eq(securityScansTable.projectId, projectId))
      .orderBy(desc(securityScansTable.scannedAt))
      .limit(20);

    res.json(history);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/security-scan/:id", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const id = parseInt(String(req.params.id), 10);
    const [scan] = await db.select()
      .from(securityScansTable)
      .where(eq(securityScansTable.id, id));

    if (!scan || scan.projectId !== projectId) {
      res.status(404).json({ error: "Escaneo no encontrado" });
      return;
    }

    res.json(scan);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
