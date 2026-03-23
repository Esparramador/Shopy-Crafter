import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, revenueSnapshotsTable, forecastsTable, projectsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { claude } from "../lib/claude.js";

const router = Router();

router.get("/intelligence/events", async (req, res): Promise<void> => {
  const { projectId, limit = "50" } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const events = await db.select().from(eventsTable)
    .where(eq(eventsTable.projectId, projectId))
    .orderBy(desc(eventsTable.createdAt))
    .limit(parseInt(limit));
  res.json(events);
});

router.post("/intelligence/events", async (req, res): Promise<void> => {
  const { projectId, eventType, productId, payload, revenueDelta } = req.body;
  if (!projectId || !eventType) { res.status(400).json({ error: "projectId and eventType required" }); return; }
  const [event] = await db.insert(eventsTable).values({
    id: randomUUID(),
    projectId,
    eventType,
    productId: productId ?? null,
    payload: payload ? JSON.stringify(payload) : null,
    revenueDelta: revenueDelta ?? null,
    attributedRevenue: revenueDelta ?? 0,
  }).returning();
  res.json(event);
});

router.get("/intelligence/snapshots", async (req, res): Promise<void> => {
  const { projectId, days = "30" } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const snapshots = await db.select().from(revenueSnapshotsTable)
    .where(eq(revenueSnapshotsTable.projectId, projectId))
    .orderBy(desc(revenueSnapshotsTable.date))
    .limit(parseInt(days));
  res.json(snapshots);
});

router.post("/intelligence/snapshots", async (req, res): Promise<void> => {
  const { projectId, date, revenue, orders, conversionRate, aov, grossMargin } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const [snap] = await db.insert(revenueSnapshotsTable).values({
    id: randomUUID(),
    projectId, date, revenue, orders, conversionRate, aov, grossMargin,
  }).returning();
  res.json(snap);
});

router.get("/intelligence/summary", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  const recentEvents = await db.select().from(eventsTable)
    .where(eq(eventsTable.projectId, projectId))
    .orderBy(desc(eventsTable.createdAt)).limit(20);
  const snapshots = await db.select().from(revenueSnapshotsTable)
    .where(eq(revenueSnapshotsTable.projectId, projectId))
    .orderBy(desc(revenueSnapshotsTable.date)).limit(30);

  const totalAttributed = recentEvents.reduce((s, e) => s + (e.attributedRevenue ?? 0), 0);
  const byType: Record<string, number> = {};
  recentEvents.forEach(e => { byType[e.eventType] = (byType[e.eventType] || 0) + 1; });

  res.json({
    storeName: project?.name || "Unknown",
    totalEvents: recentEvents.length,
    totalAttributedRevenue: totalAttributed,
    eventBreakdown: byType,
    recentSnapshots: snapshots.slice(0, 7),
    trend: snapshots.length >= 2
      ? ((snapshots[0]?.revenue ?? 0) - (snapshots[1]?.revenue ?? 0)) / Math.max(snapshots[1]?.revenue ?? 1, 1) * 100
      : 0,
  });
});

router.post("/intelligence/analyze", async (req, res): Promise<void> => {
  const { projectId, timeframe = "30d" } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  const events = await db.select().from(eventsTable)
    .where(eq(eventsTable.projectId, projectId))
    .orderBy(desc(eventsTable.createdAt)).limit(50);
  const snapshots = await db.select().from(revenueSnapshotsTable)
    .where(eq(revenueSnapshotsTable.projectId, projectId))
    .orderBy(desc(revenueSnapshotsTable.date)).limit(30);

  const prompt = `You are a Shopify revenue analyst. Analyze this data for store "${project?.name}":

Events (last 50): ${JSON.stringify(events.slice(0, 20))}
Revenue snapshots: ${JSON.stringify(snapshots.slice(0, 14))}
Timeframe: ${timeframe}

Return JSON:
{
  "topInsights": ["insight1", "insight2", "insight3"],
  "attributionBreakdown": {"seo": 30, "pricing": 25, "abTest": 20, "images": 15, "other": 10},
  "revenueImpact": {"total": 0, "byChannel": {}},
  "recommendations": [{"priority": "high", "action": "...", "impact": "..."}],
  "summary": "2-3 sentence executive summary"
}`;

  try {
    const text = await claude(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    const analysis = match ? JSON.parse(match[0]) : { summary: text, topInsights: [], recommendations: [] };
    res.json({ analysis, projectId, analyzedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
