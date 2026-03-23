import { Router } from "express";
import { db } from "@workspace/db";
import { competitorsTable, competitorSnapshotsTable, competitorAlertsTable, projectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { claude } from "../lib/claude.js";

const router = Router();

router.get("/competitors", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const competitors = await db.select().from(competitorsTable)
    .where(eq(competitorsTable.projectId, projectId));
  res.json(competitors);
});

router.post("/competitors", async (req, res): Promise<void> => {
  const { projectId, name, url, type } = req.body;
  if (!projectId || !name || !url) { res.status(400).json({ error: "projectId, name, url required" }); return; }
  const [comp] = await db.insert(competitorsTable).values({
    id: randomUUID(), projectId, name, url, type: type ?? "direct",
  }).returning();
  res.json(comp);
});

router.delete("/competitors/:id", async (req, res): Promise<void> => {
  await db.delete(competitorsTable).where(eq(competitorsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/competitors/snapshots", async (req, res): Promise<void> => {
  const { competitorId } = req.query as Record<string, string>;
  if (!competitorId) { res.status(400).json({ error: "competitorId required" }); return; }
  const snapshots = await db.select().from(competitorSnapshotsTable)
    .where(eq(competitorSnapshotsTable.competitorId, competitorId))
    .orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(10);
  res.json(snapshots);
});

router.post("/competitors/scan", async (req, res): Promise<void> => {
  const { projectId, competitorId } = req.body;
  if (!projectId || !competitorId) { res.status(400).json({ error: "projectId and competitorId required" }); return; }

  const [competitor] = await db.select().from(competitorsTable)
    .where(eq(competitorsTable.id, competitorId));
  if (!competitor) { res.status(404).json({ error: "Competitor not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));

  const prompt = `You are a competitive intelligence analyst for a Shopify store.
Store: ${project?.name || "Store"}
Competitor: ${competitor.name} (${competitor.url})

Simulate a competitive scan and return realistic competitive intelligence data. Return JSON:
{
  "productsFound": 120,
  "priceMin": 29.99,
  "priceMax": 299.99,
  "priceMedian": 89.99,
  "newProducts": ["Product A", "Product B"],
  "outOfStock": ["Product C"],
  "promotionsDetected": ["20% off summer sale", "Free shipping over €50"],
  "insights": [
    {"severity": "high", "type": "price_drop", "title": "Bajada de precios detectada", "description": "Han bajado precios un 15% en la categoría principal", "action": "Considera ajustar precios en los productos más competidos"},
    {"severity": "medium", "type": "new_product", "title": "Nuevo producto lanzado", "description": "Han añadido 2 productos nuevos esta semana", "action": "Evalúa si necesitas responder con nuevos productos"}
  ],
  "overallThreatLevel": "medium"
}`;

  try {
    const text = await claude(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    const data = match ? JSON.parse(match[0]) : {};

    const [snap] = await db.insert(competitorSnapshotsTable).values({
      id: randomUUID(),
      competitorId,
      productsFound: data.productsFound ?? 0,
      priceMin: data.priceMin ?? null,
      priceMax: data.priceMax ?? null,
      priceMedian: data.priceMedian ?? null,
      newProducts: JSON.stringify(data.newProducts ?? []),
      outOfStock: JSON.stringify(data.outOfStock ?? []),
      promotionsDetected: JSON.stringify(data.promotionsDetected ?? []),
      rawData: text,
    }).returning();

    await db.update(competitorsTable)
      .set({ lastScanned: new Date() })
      .where(eq(competitorsTable.id, competitorId));

    for (const insight of (data.insights ?? [])) {
      await db.insert(competitorAlertsTable).values({
        id: randomUUID(),
        projectId,
        competitorId,
        alertType: insight.type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        actionSuggestion: insight.action,
      });
    }

    res.json({ snapshot: snap, insights: data.insights ?? [], threatLevel: data.overallThreatLevel });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/competitors/alerts", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const alerts = await db.select().from(competitorAlertsTable)
    .where(eq(competitorAlertsTable.projectId, projectId))
    .orderBy(desc(competitorAlertsTable.createdAt)).limit(20);
  res.json(alerts);
});

router.post("/competitors/alerts/:id/dismiss", async (req, res): Promise<void> => {
  await db.update(competitorAlertsTable)
    .set({ dismissed: 1 })
    .where(eq(competitorAlertsTable.id, req.params.id));
  res.json({ ok: true });
});

export default router;
