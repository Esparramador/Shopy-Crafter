import { Router } from "express";
import { db } from "@workspace/db";
import { competitorsTable, competitorSnapshotsTable, competitorAlertsTable, projectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";

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

  let htmlContent = "";
  let fetchError = "";
  try {
    const resp = await fetch(competitor.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopifyAI-Monitor/1.0)" },
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await resp.text();
    htmlContent = raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 40000);
  } catch (e: any) {
    fetchError = e.message ?? "fetch failed";
  }

  const prompt = `You are a competitive intelligence analyst for a Shopify store.
Store: ${project?.name || "Store"}
Competitor: ${competitor.name} (${competitor.url})
${htmlContent ? `\nActual page content scraped:\n${htmlContent}` : `\nNote: Could not fetch page (${fetchError}). Use publicly known info about this URL/brand.`}

Analyze the competitor and return competitive intelligence. Extract real prices, products, and promotions from the scraped content where available. Return JSON:
{
  "productsFound": 0,
  "priceMin": null,
  "priceMax": null,
  "priceMedian": null,
  "newProducts": [],
  "outOfStock": [],
  "promotionsDetected": [],
  "insights": [
    {"severity": "high|medium|low", "type": "price_drop|new_product|promotion|stock|general", "title": "...", "description": "...", "action": "..."}
  ],
  "overallThreatLevel": "low|medium|high"
}`;

  try {
    const niche = project?.storeNiche ?? undefined;
    const text = await askClaudeWithBrain(
      parseInt(projectId),
      [{ role: "user", content: prompt }],
      `${SHOPIFY_EXPERT_SYSTEM} You are also a world-class competitive intelligence analyst. Use your accumulated knowledge about pricing patterns, market positioning, and e-commerce trends to identify real threats and opportunities.`,
      "general",
      niche
    );
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

    learnFromOperation({
      projectId: parseInt(projectId),
      operation: "competitor_scan",
      result: `Competitor scan: ${data.productsFound ?? 0} products found, price range €${data.priceMin ?? "?"}-€${data.priceMax ?? "?"}, threat level: ${data.overallThreatLevel ?? "unknown"}. ${(data.insights ?? []).length} insights detected.`,
      niche: niche,
      category: "competitor_intel",
    });

    saveToVault({
      projectId: parseInt(projectId),
      fileType: "analysis",
      category: "competitor_scan",
      title: `Análisis Competidor: ${competitor.name}`,
      description: `Threat: ${data.overallThreatLevel ?? "?"}, ${data.productsFound ?? 0} productos, ${(data.insights ?? []).length} insights`,
      mimeType: "application/json",
      fileSizeBytes: Buffer.from(text).length,
      generatedBy: "competitor_scanner",
      content: JSON.stringify({ competitor: { name: competitor.name, url: competitor.url }, data, rawAnalysis: text }, null, 2),
      metadata: { competitorId, competitorName: competitor.name, threatLevel: data.overallThreatLevel },
    }).catch(() => {});

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
