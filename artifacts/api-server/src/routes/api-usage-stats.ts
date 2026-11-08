import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { apiUsageLogTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { isGmailAvailable } from "../lib/gmail.js";
import {
  fetchUsageRows, buildCostCsv, parseRangeEnd, csvFilename, parseProjectId, sendCostReport,
  getReportSettings, writeSetting, isValidEmail, REPORT_KEYS,
} from "../lib/api-usage-report.js";
import {
  getAlertSettings, saveProviderThresholds, normalizeWarnPct, sendTestAlert, ALERT_KEYS,
} from "../lib/ai-cost-alert.js";

const router = Router();

router.get("/api-usage/stats", async (req, res): Promise<void> => {
  try {
    const { from, to, provider, projectId } = req.query as Record<string, string>;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const rangeFrom = from ? new Date(from) : thisMonthStart;
    const rangeTo   = to   ? parseRangeEnd(to) : now;

    const conditions = [
      gte(apiUsageLogTable.createdAt, rangeFrom),
      lte(apiUsageLogTable.createdAt, rangeTo),
    ];
    if (provider && provider !== "all") {
      conditions.push(eq(apiUsageLogTable.provider, provider));
    }
    if (projectId) {
      conditions.push(eq(apiUsageLogTable.projectId, parseInt(projectId, 10)));
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
    if (projectId) {
      lastMonthConditions.push(eq(apiUsageLogTable.projectId, parseInt(projectId, 10)));
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

router.get("/api-usage/by-project", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = await db
      .select({
        projectId:   apiUsageLogTable.projectId,
        projectName: projectsTable.name,
        shopDomain:  projectsTable.shopDomain,
        costUsd:     sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
        costEur:     sql<number>`coalesce(sum(${apiUsageLogTable.costEur}),0)`,
        calls:       sql<number>`count(*)`,
      })
      .from(apiUsageLogTable)
      .leftJoin(projectsTable, eq(apiUsageLogTable.projectId, projectsTable.id))
      .where(gte(apiUsageLogTable.createdAt, monthStart))
      .groupBy(apiUsageLogTable.projectId, projectsTable.name, projectsTable.shopDomain)
      .orderBy(desc(sql`sum(${apiUsageLogTable.costUsd})`));

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.get("/api-usage/logs", async (req, res): Promise<void> => {
  try {
    const { from, to, provider, page, projectId, sessionId } = req.query as Record<string, string>;
    const PAGE_SIZE = 50;
    const pageNum   = Math.max(1, parseInt(page ?? "1", 10));
    const offset    = (pageNum - 1) * PAGE_SIZE;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    const rangeFrom = from ? new Date(from) : defaultFrom;
    const rangeTo   = to   ? parseRangeEnd(to) : now;

    const conditions = [
      gte(apiUsageLogTable.createdAt, rangeFrom),
      lte(apiUsageLogTable.createdAt, rangeTo),
    ];
    if (provider && provider !== "all") {
      conditions.push(eq(apiUsageLogTable.provider, provider));
    }
    if (projectId) {
      conditions.push(eq(apiUsageLogTable.projectId, parseInt(projectId, 10)));
    }
    if (sessionId) {
      conditions.push(eq(apiUsageLogTable.sessionId, sessionId));
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

router.get("/api-usage/export", async (req, res): Promise<void> => {
  try {
    const { from, to, provider, projectId: rawProjectId } = req.query as Record<string, string>;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeFrom = from ? new Date(from) : defaultFrom;
    const rangeTo   = to   ? parseRangeEnd(to) : now;
    const projectId = parseProjectId(rawProjectId);

    const rows = await fetchUsageRows({ from: rangeFrom, to: rangeTo, provider, projectId });

    let project: { id: number; name: string | null } | null = null;
    if (projectId) {
      const [p] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, projectId));
      project = { id: projectId, name: p?.name ?? null };
    }

    const fromLabel = (from ?? rangeFrom.toISOString().slice(0, 10));
    const toLabel   = (to   ?? rangeTo.toISOString().slice(0, 10));
    const filename  = csvFilename(fromLabel, toLabel, project);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buildCostCsv(rows));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.get("/api-usage/chat-sessions", async (req, res): Promise<void> => {
  try {
    const { from, to, projectId, page } = req.query as Record<string, string>;
    const PAGE_SIZE = 30;
    const pageNum = Math.max(1, parseInt(page ?? "1", 10));
    const offset  = (pageNum - 1) * PAGE_SIZE;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeFrom = from ? new Date(from) : defaultFrom;
    const rangeTo   = to   ? parseRangeEnd(to) : now;

    const conditions = [
      gte(apiUsageLogTable.createdAt, rangeFrom),
      lte(apiUsageLogTable.createdAt, rangeTo),
      eq(apiUsageLogTable.operation, "chat"),
    ];
    if (projectId) {
      conditions.push(eq(apiUsageLogTable.projectId, parseInt(projectId, 10)));
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(distinct coalesce(${apiUsageLogTable.sessionId}, ${apiUsageLogTable.id}))` })
      .from(apiUsageLogTable)
      .where(and(...conditions));

    const sessions = await db
      .select({
        sessionId:   sql<string>`coalesce(${apiUsageLogTable.sessionId}, ${apiUsageLogTable.id})`.as("session_id"),
        provider:    sql<string>`max(${apiUsageLogTable.provider})`.as("provider"),
        model:       sql<string>`max(${apiUsageLogTable.model})`.as("model"),
        projectId:   sql<number>`max(${apiUsageLogTable.projectId})`.as("project_id"),
        projectName: sql<string>`max(${projectsTable.name})`.as("project_name"),
        messages:    sql<number>`count(*)`.as("messages"),
        inputTokens: sql<number>`coalesce(sum(${apiUsageLogTable.inputUnits}),0)`.as("input_tokens"),
        outputTokens:sql<number>`coalesce(sum(${apiUsageLogTable.outputUnits}),0)`.as("output_tokens"),
        costUsd:     sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`.as("cost_usd"),
        costEur:     sql<number>`coalesce(sum(${apiUsageLogTable.costEur}),0)`.as("cost_eur"),
        firstAt:     sql<string>`min(${apiUsageLogTable.createdAt})`.as("first_at"),
        lastAt:      sql<string>`max(${apiUsageLogTable.createdAt})`.as("last_at"),
      })
      .from(apiUsageLogTable)
      .leftJoin(projectsTable, eq(apiUsageLogTable.projectId, projectsTable.id))
      .where(and(...conditions))
      .groupBy(sql`coalesce(${apiUsageLogTable.sessionId}, ${apiUsageLogTable.id})`)
      .orderBy(desc(sql`max(${apiUsageLogTable.createdAt})`))
      .limit(PAGE_SIZE)
      .offset(offset);

    res.json({
      sessions,
      page: pageNum,
      pageSize: PAGE_SIZE,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / PAGE_SIZE),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.get("/api-usage/chat-session/:sessionId", async (req, res): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const rows = await db
      .select({
        id:          apiUsageLogTable.id,
        model:       apiUsageLogTable.model,
        provider:    apiUsageLogTable.provider,
        inputUnits:  apiUsageLogTable.inputUnits,
        outputUnits: apiUsageLogTable.outputUnits,
        costUsd:     apiUsageLogTable.costUsd,
        costEur:     apiUsageLogTable.costEur,
        metadata:    apiUsageLogTable.metadata,
        createdAt:   apiUsageLogTable.createdAt,
      })
      .from(apiUsageLogTable)
      .where(and(
        eq(apiUsageLogTable.sessionId, sessionId),
        eq(apiUsageLogTable.operation, "chat"),
      ))
      .orderBy(apiUsageLogTable.createdAt);

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.get("/api-usage/chat-summary", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const conditions = [
      gte(apiUsageLogTable.createdAt, monthStart),
      lte(apiUsageLogTable.createdAt, now),
      eq(apiUsageLogTable.operation, "chat"),
    ];

    const [totals] = await db
      .select({
        sessions:    sql<number>`count(distinct coalesce(${apiUsageLogTable.sessionId}, ${apiUsageLogTable.id}))`,
        messages:    sql<number>`count(*)`,
        costUsd:     sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}), 0)`,
        costEur:     sql<number>`coalesce(sum(${apiUsageLogTable.costEur}), 0)`,
        inputTokens: sql<number>`coalesce(sum(${apiUsageLogTable.inputUnits}), 0)`,
        outputTokens:sql<number>`coalesce(sum(${apiUsageLogTable.outputUnits}), 0)`,
      })
      .from(apiUsageLogTable)
      .where(and(...conditions));

    const sessions    = Number(totals?.sessions    ?? 0);
    const messages    = Number(totals?.messages    ?? 0);
    const costUsd     = Number(totals?.costUsd     ?? 0);
    const costEur     = Number(totals?.costEur     ?? 0);
    const inputTok    = Number(totals?.inputTokens ?? 0);
    const outputTok   = Number(totals?.outputTokens ?? 0);
    const totalTokens = inputTok + outputTok;
    const avgTokens   = sessions > 0 ? Math.round(totalTokens / sessions) : 0;
    const avgCostEur  = sessions > 0 ? costEur / sessions : 0;

    res.json({ sessions, messages, costUsd, costEur, totalTokens, avgTokens, avgCostEur });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.post("/api-usage/send-email", async (req, res): Promise<void> => {
  try {
    if (!isGmailAvailable()) {
      res.status(503).json({ error: "Integración de Gmail no configurada en este entorno." });
      return;
    }

    const { from, to, provider, email } = req.body as {
      from?: string; to?: string; provider?: string; email?: string;
    };

    const explicit = email?.trim();
    if (explicit && !isValidEmail(explicit)) {
      res.status(400).json({ error: "Email de destino no válido." });
      return;
    }
    const recipient = explicit || (await getReportSettings()).email;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeFrom = from ? new Date(from) : defaultFrom;
    const rangeTo   = to   ? parseRangeEnd(to) : now;

    const result = await sendCostReport({
      from: rangeFrom, to: rangeTo,
      fromLabel: from ?? rangeFrom.toISOString().slice(0, 10),
      toLabel:   to   ?? rangeTo.toISOString().slice(0, 10),
      provider, recipient,
    });

    if (!result.ok) {
      res.status(500).json({ error: "No se pudo enviar el email. Verifica la integración de Gmail." });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ─── REPORT SETTINGS (destino del informe y envío mensual) ───────────────────

router.get("/api-usage/report-settings", async (_req, res): Promise<void> => {
  try {
    res.json({ ...(await getReportSettings()), gmailAvailable: isGmailAvailable() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.put("/api-usage/report-settings", async (req, res): Promise<void> => {
  try {
    const { email, monthlyEnabled } = req.body as { email?: string; monthlyEnabled?: boolean };
    if (email !== undefined) {
      const v = String(email).trim();
      if (v && !isValidEmail(v)) {
        res.status(400).json({ error: "Email de destino no válido." });
        return;
      }
      await writeSetting(REPORT_KEYS.email, v);
    }
    if (monthlyEnabled !== undefined) await writeSetting(REPORT_KEYS.monthly, String(Boolean(monthlyEnabled)));
    res.json({ ok: true, ...(await getReportSettings()) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

// ─── ALERT SETTINGS ──────────────────────────────────────────────────────────

router.get("/api-usage/alert-settings", async (_req, res): Promise<void> => {
  try {
    const s = await getAlertSettings();
    res.json({
      thresholdUsd:       s.thresholdUsd,
      alertEmail:         s.alertEmail,
      enabled:            s.enabled,
      lastSent:           s.lastSent,
      warnPct:            s.warnPct,
      providerThresholds: s.providerThresholds,
      gmailAvailable:     isGmailAvailable(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.put("/api-usage/alert-settings", async (req, res): Promise<void> => {
  try {
    const { thresholdUsd, alertEmail, enabled, warnPct, providerThresholds } = req.body as {
      thresholdUsd?: number; alertEmail?: string; enabled?: boolean; warnPct?: number;
      providerThresholds?: Record<string, number | null>;
    };

    if (alertEmail !== undefined && alertEmail.trim() && !isValidEmail(alertEmail.trim())) {
      res.status(400).json({ error: "Email de destino no válido." });
      return;
    }

    if (thresholdUsd !== undefined) await writeSetting(ALERT_KEYS.threshold, String(Math.max(0, Number(thresholdUsd) || 0)));
    if (alertEmail !== undefined)   await writeSetting(ALERT_KEYS.email,     alertEmail.trim());
    if (enabled !== undefined)      await writeSetting(ALERT_KEYS.enabled,   String(enabled));
    if (warnPct !== undefined)      await writeSetting(ALERT_KEYS.warnPct,   String(normalizeWarnPct(warnPct)));
    if (providerThresholds && typeof providerThresholds === "object") await saveProviderThresholds(providerThresholds);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.post("/api-usage/alert-settings/test", async (_req, res): Promise<void> => {
  try {
    if (!isGmailAvailable()) {
      res.status(503).json({ error: "Integración de Gmail no configurada en este entorno." });
      return;
    }
    const r = await sendTestAlert();
    if (!r.ok) {
      res.status(500).json({ error: "No se pudo enviar el email de prueba. Verifica la integración de Gmail." });
      return;
    }
    res.json({ ok: true, recipient: r.recipient });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

export default router;
