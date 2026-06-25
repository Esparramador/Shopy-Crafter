import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { apiUsageLogTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const router = Router();

router.get("/api-usage/stats", async (req, res): Promise<void> => {
  try {
    const { from, to, provider } = req.query as Record<string, string>;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const rangeFrom = from ? new Date(from) : thisMonthStart;
    const rangeTo   = to   ? new Date(to)   : now;

    const conditions = [
      gte(apiUsageLogTable.createdAt, rangeFrom),
      lte(apiUsageLogTable.createdAt, rangeTo),
    ];
    if (provider && provider !== "all") {
      conditions.push(eq(apiUsageLogTable.provider, provider));
    }

    const daily = await db
      .select({
        day:      sql<string>`to_char(${apiUsageLogTable.createdAt}, 'YYYY-MM-DD')`.as("day"),
        provider: apiUsageLogTable.provider,
        costUsd:  sql<number>`sum(${apiUsageLogTable.costUsd})`.as("cost_usd"),
        costEur:  sql<number>`sum(${apiUsageLogTable.costEur})`.as("cost_eur"),
        calls:    sql<number>`count(*)`.as("calls"),
      })
      .from(apiUsageLogTable)
      .where(and(...conditions))
      .groupBy(
        sql`to_char(${apiUsageLogTable.createdAt}, 'YYYY-MM-DD')`,
        apiUsageLogTable.provider,
      )
      .orderBy(sql`to_char(${apiUsageLogTable.createdAt}, 'YYYY-MM-DD')`);

    const [thisTotals] = await db
      .select({
        costUsd:      sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
        costEur:      sql<number>`coalesce(sum(${apiUsageLogTable.costEur}),0)`,
        calls:        sql<number>`count(*)`,
        inputTokens:  sql<number>`coalesce(sum(${apiUsageLogTable.inputUnits}),0)`,
        outputTokens: sql<number>`coalesce(sum(${apiUsageLogTable.outputUnits}),0)`,
      })
      .from(apiUsageLogTable)
      .where(and(...conditions));

    const lastMonthConditions = [
      gte(apiUsageLogTable.createdAt, lastMonthStart),
      lte(apiUsageLogTable.createdAt, lastMonthEnd),
    ];
    if (provider && provider !== "all") {
      lastMonthConditions.push(eq(apiUsageLogTable.provider, provider));
    }

    const [lastTotals] = await db
      .select({
        costUsd: sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
        costEur: sql<number>`coalesce(sum(${apiUsageLogTable.costEur}),0)`,
        calls:   sql<number>`count(*)`,
      })
      .from(apiUsageLogTable)
      .where(and(...lastMonthConditions));

    const byProvider = await db
      .select({
        provider: apiUsageLogTable.provider,
        costUsd:  sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
        costEur:  sql<number>`coalesce(sum(${apiUsageLogTable.costEur}),0)`,
        calls:    sql<number>`count(*)`,
      })
      .from(apiUsageLogTable)
      .where(and(...conditions))
      .groupBy(apiUsageLogTable.provider)
      .orderBy(desc(sql`sum(${apiUsageLogTable.costUsd})`));

    res.json({
      daily,
      totals: {
        current:      thisTotals,
        previousMonth: lastTotals,
        pctChange: lastTotals.costUsd > 0
          ? ((thisTotals.costUsd - lastTotals.costUsd) / lastTotals.costUsd) * 100
          : null,
      },
      byProvider,
      range: { from: rangeFrom, to: rangeTo },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.get("/api-usage/logs", async (req, res): Promise<void> => {
  try {
    const { from, to, provider, page } = req.query as Record<string, string>;
    const PAGE_SIZE = 50;
    const pageNum   = Math.max(1, parseInt(page ?? "1", 10));
    const offset    = (pageNum - 1) * PAGE_SIZE;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    const rangeFrom = from ? new Date(from) : defaultFrom;
    const rangeTo   = to   ? new Date(to)   : now;

    const conditions = [
      gte(apiUsageLogTable.createdAt, rangeFrom),
      lte(apiUsageLogTable.createdAt, rangeTo),
    ];
    if (provider && provider !== "all") {
      conditions.push(eq(apiUsageLogTable.provider, provider));
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(apiUsageLogTable)
      .where(and(...conditions));

    const rows = await db
      .select({
        id:          apiUsageLogTable.id,
        provider:    apiUsageLogTable.provider,
        operation:   apiUsageLogTable.operation,
        model:       apiUsageLogTable.model,
        projectId:   apiUsageLogTable.projectId,
        inputUnits:  apiUsageLogTable.inputUnits,
        outputUnits: apiUsageLogTable.outputUnits,
        unitsLabel:  apiUsageLogTable.unitsLabel,
        costUsd:     apiUsageLogTable.costUsd,
        costEur:     apiUsageLogTable.costEur,
        success:     apiUsageLogTable.success,
        createdAt:   apiUsageLogTable.createdAt,
        projectName: projectsTable.name,
        shopDomain:  projectsTable.shopDomain,
      })
      .from(apiUsageLogTable)
      .leftJoin(projectsTable, eq(apiUsageLogTable.projectId, projectsTable.id))
      .where(and(...conditions))
      .orderBy(desc(apiUsageLogTable.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    res.json({
      rows,
      page: pageNum,
      pageSize: PAGE_SIZE,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / PAGE_SIZE),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

export default router;
