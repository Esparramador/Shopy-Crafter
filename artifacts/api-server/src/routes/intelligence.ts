import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, revenueSnapshotsTable, forecastsTable, projectsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { claude } from "../lib/claude.js";
import { shopifyRequest } from "../lib/shopify.js";

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

// ─── ON-DEMAND SHOPIFY REVENUE SYNC ────────────────────────────────────────
// Pulls real orders from Shopify for the last N days and stores as snapshots.
// Called immediately when a project is connected or on user demand.
router.post("/intelligence/sync-revenue", async (req, res): Promise<void> => {
  const { projectId, days = 90 } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (!project.accessToken) { res.status(400).json({ error: "No Shopify token — connect your store first" }); return; }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let page = 1;
    const dailyMap: Record<string, { revenue: number; orders: number; total_price_sum: number }> = {};
    let hasMore = true;
    let pageInfo: string | null = null;

    // Fetch all paid orders page by page (max 250/page)
    while (hasMore) {
      const url = pageInfo
        ? `/orders.json?status=any&financial_status=paid&limit=250&page_info=${pageInfo}`
        : `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`;

      const data = await shopifyRequest<{
        orders: Array<{ id: number; created_at: string; total_price: string; subtotal_price: string }>;
        link?: string;
      }>(parseInt(projectId), project.shopDomain, url);

      for (const order of data.orders) {
        const date = order.created_at.split("T")[0];
        if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0, total_price_sum: 0 };
        dailyMap[date].revenue += parseFloat(order.total_price || "0");
        dailyMap[date].orders += 1;
      }

      // Shopify pagination — stop when no more pages
      hasMore = data.orders.length === 250 && page < 10;
      page++;
      pageInfo = null; // simple pagination by page count
    }

    let inserted = 0;
    for (const [date, vals] of Object.entries(dailyMap)) {
      const aov = vals.orders > 0 ? vals.revenue / vals.orders : 0;
      // Check if snapshot already exists for this date+project
      const existing = await db.select({ id: revenueSnapshotsTable.id })
        .from(revenueSnapshotsTable)
        .where(and(eq(revenueSnapshotsTable.projectId, String(projectId)), eq(revenueSnapshotsTable.date, date)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(revenueSnapshotsTable)
          .set({ revenue: vals.revenue, orders: vals.orders, aov })
          .where(eq(revenueSnapshotsTable.id, existing[0].id));
      } else {
        await db.insert(revenueSnapshotsTable).values({
          id: randomUUID(),
          projectId: String(projectId),
          date,
          revenue: vals.revenue,
          orders: vals.orders,
          aov,
        });
      }
      inserted++;
    }

    const totalRevenue = Object.values(dailyMap).reduce((s, v) => s + v.revenue, 0);
    const totalOrders = Object.values(dailyMap).reduce((s, v) => s + v.orders, 0);

    res.json({
      ok: true,
      daysLoaded: inserted,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      storeName: project.name,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Shopify sync failed" });
  }
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
