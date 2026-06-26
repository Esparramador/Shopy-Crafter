import { Router } from "express";
import { db, projectsTable, platformSettingsTable } from "@workspace/db";
import { apiUsageLogTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { sendEmailWithAttachment, isGmailAvailable } from "../lib/gmail.js";

const router = Router();

router.get("/api-usage/stats", async (req, res): Promise<void> => {
  try {
    const { from, to, provider, projectId } = req.query as Record<string, string>;

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
    const { from, to, provider, page, projectId } = req.query as Record<string, string>;
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
    if (projectId) {
      conditions.push(eq(apiUsageLogTable.projectId, parseInt(projectId, 10)));
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
    const { from, to, provider } = req.query as Record<string, string>;

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

    const rows = await db
      .select({
        createdAt:   apiUsageLogTable.createdAt,
        projectName: projectsTable.name,
        shopDomain:  projectsTable.shopDomain,
        provider:    apiUsageLogTable.provider,
        model:       apiUsageLogTable.model,
        operation:   apiUsageLogTable.operation,
        inputUnits:  apiUsageLogTable.inputUnits,
        outputUnits: apiUsageLogTable.outputUnits,
        costUsd:     apiUsageLogTable.costUsd,
        costEur:     apiUsageLogTable.costEur,
        success:     apiUsageLogTable.success,
      })
      .from(apiUsageLogTable)
      .leftJoin(projectsTable, eq(apiUsageLogTable.projectId, projectsTable.id))
      .where(and(...conditions))
      .orderBy(desc(apiUsageLogTable.createdAt));

    const HEADERS = ["Fecha", "Proyecto", "Tienda", "Motor", "Modelo", "Operacion", "Tokens Entrada", "Tokens Salida", "Coste USD", "Coste EUR", "Estado"];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvLines = [
      HEADERS.map(escape).join(","),
      ...rows.map(r => [
        new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19),
        r.projectName ?? "",
        r.shopDomain  ?? "",
        r.provider,
        r.model       ?? "",
        r.operation,
        String(r.inputUnits  ?? 0),
        String(r.outputUnits ?? 0),
        Number(r.costUsd ?? 0).toFixed(6),
        Number(r.costEur ?? 0).toFixed(6),
        r.success === 1 ? "OK" : "Error",
      ].map(escape).join(",")),
    ];

    const fromLabel = (from ?? rangeFrom.toISOString().slice(0, 10));
    const toLabel   = (to   ?? rangeTo.toISOString().slice(0, 10));
    const filename  = `costes-ia-${fromLabel}_${toLabel}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csvLines.join("\n"));
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
    const rangeTo   = to   ? new Date(to)   : now;

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

    const ADMIN_EMAIL = "craftershopy@gmail.com";
    const recipient = email?.trim() || ADMIN_EMAIL;

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

    const rows = await db
      .select({
        createdAt:   apiUsageLogTable.createdAt,
        projectName: projectsTable.name,
        shopDomain:  projectsTable.shopDomain,
        provider:    apiUsageLogTable.provider,
        model:       apiUsageLogTable.model,
        operation:   apiUsageLogTable.operation,
        inputUnits:  apiUsageLogTable.inputUnits,
        outputUnits: apiUsageLogTable.outputUnits,
        costUsd:     apiUsageLogTable.costUsd,
        costEur:     apiUsageLogTable.costEur,
        success:     apiUsageLogTable.success,
      })
      .from(apiUsageLogTable)
      .leftJoin(projectsTable, eq(apiUsageLogTable.projectId, projectsTable.id))
      .where(and(...conditions))
      .orderBy(desc(apiUsageLogTable.createdAt));

    const [totals] = await db
      .select({
        costUsd:  sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
        costEur:  sql<number>`coalesce(sum(${apiUsageLogTable.costEur}),0)`,
        calls:    sql<number>`count(*)`,
      })
      .from(apiUsageLogTable)
      .where(and(...conditions));

    const HEADERS = ["Fecha", "Proyecto", "Tienda", "Motor", "Modelo", "Operacion", "Tokens Entrada", "Tokens Salida", "Coste USD", "Coste EUR", "Estado"];
    const escape  = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvContent = [
      HEADERS.map(escape).join(","),
      ...rows.map(r => [
        new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19),
        r.projectName ?? "",
        r.shopDomain  ?? "",
        r.provider,
        r.model       ?? "",
        r.operation,
        String(r.inputUnits  ?? 0),
        String(r.outputUnits ?? 0),
        Number(r.costUsd ?? 0).toFixed(6),
        Number(r.costEur ?? 0).toFixed(6),
        r.success === 1 ? "OK" : "Error",
      ].map(escape).join(",")),
    ].join("\n");

    const fromLabel = from ?? rangeFrom.toISOString().slice(0, 10);
    const toLabel   = to   ?? rangeTo.toISOString().slice(0, 10);
    const filename  = `costes-ia-${fromLabel}_${toLabel}.csv`;
    const subject   = `Informe costes IA — ${fromLabel} a ${toLabel}`;

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#e8e0cc;padding:24px;border-radius:12px;">
  <div style="border-bottom:1px solid rgba(200,168,75,0.3);padding-bottom:16px;margin-bottom:20px;">
    <h1 style="margin:0;font-size:20px;color:#c8a84b;">💸 Informe de Costes IA</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#888;">Período: <strong style="color:#e8e0cc;">${fromLabel}</strong> → <strong style="color:#e8e0cc;">${toLabel}</strong>${provider && provider !== "all" ? ` · Motor: <strong style="color:#e8e0cc;">${provider}</strong>` : ""}</p>
  </div>
  <div style="display:flex;gap:24px;margin-bottom:24px;flex-wrap:wrap;">
    <div style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:8px;padding:14px 20px;min-width:140px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Coste Total</div>
      <div style="font-size:22px;font-weight:700;color:#c8a84b;">$${Number(totals.costUsd).toFixed(4)}</div>
      <div style="font-size:12px;color:#888;">€${Number(totals.costEur).toFixed(4)} EUR</div>
    </div>
    <div style="background:rgba(45,212,159,0.06);border:1px solid rgba(45,212,159,0.15);border-radius:8px;padding:14px 20px;min-width:140px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Llamadas API</div>
      <div style="font-size:22px;font-weight:700;color:#2dd49f;">${Number(totals.calls).toLocaleString("es-ES")}</div>
      <div style="font-size:12px;color:#888;">${rows.length} registros exportados</div>
    </div>
  </div>
  <p style="font-size:12px;color:#666;margin:0;">El CSV completo con todos los registros está adjunto a este email.</p>
  <p style="font-size:11px;color:#444;margin:16px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">Powered by Shopy Crafter · craftershopy@gmail.com</p>
</div>`;

    const sent = await sendEmailWithAttachment(
      recipient,
      subject,
      htmlBody,
      [{ filename, content: "\uFEFF" + csvContent, mimeType: "text/csv" }],
    );

    if (!sent) {
      res.status(500).json({ error: "No se pudo enviar el email. Verifica la integración de Gmail." });
      return;
    }

    res.json({ ok: true, recipient, rows: rows.length, filename });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});


// ─── ALERT SETTINGS ──────────────────────────────────────────────────────────

router.get("/api-usage/alert-settings", async (_req, res): Promise<void> => {
  try {
    const keys = ["ai_cost_alert_threshold_usd", "ai_cost_alert_email", "ai_cost_alert_enabled", "ai_cost_alert_last_sent"];
    const rows = await db.select().from(platformSettingsTable)
      .where(inArray(platformSettingsTable.key, keys));

    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;

    res.json({
      thresholdUsd:  parseFloat(settings["ai_cost_alert_threshold_usd"] ?? "0") || 0,
      alertEmail:    settings["ai_cost_alert_email"] ?? "craftershopy@gmail.com",
      enabled:       settings["ai_cost_alert_enabled"] !== "false",
      lastSent:      settings["ai_cost_alert_last_sent"] ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

router.put("/api-usage/alert-settings", async (req, res): Promise<void> => {
  try {
    const { thresholdUsd, alertEmail, enabled } = req.body as {
      thresholdUsd?: number; alertEmail?: string; enabled?: boolean;
    };

    const upsert = async (key: string, value: string) => {
      await db.insert(platformSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } });
    };

    if (thresholdUsd !== undefined) await upsert("ai_cost_alert_threshold_usd", String(Math.max(0, Number(thresholdUsd))));
    if (alertEmail !== undefined)   await upsert("ai_cost_alert_email",           alertEmail.trim());
    if (enabled !== undefined)      await upsert("ai_cost_alert_enabled",         String(enabled));

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error interno" });
  }
});

export default router;
