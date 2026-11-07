import { db, projectsTable, platformSettingsTable } from "@workspace/db";
import { apiUsageLogTable } from "@workspace/db/schema";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { sendEmailWithAttachment, isGmailAvailable } from "./gmail.js";
import { sanitizeHtml } from "./html-escape.js";
import { businessDayStart, businessYmd } from "./tz.js";
import { logger } from "./logger.js";

/**
 * Informe de costes IA: CSV + email con totales y desglose por proyecto.
 * Lo usan el botón «Enviar por email» del panel, la exportación CSV y el envío
 * automático del día 1 (mes anterior completo).
 */

export const DEFAULT_REPORT_EMAIL = process.env.ADMIN_EMAIL || "craftershopy@gmail.com";

export const REPORT_KEYS = {
  email: "ai_cost_report_email",
  monthly: "ai_cost_report_monthly_enabled",
  lastMonth: "ai_cost_report_last_month",
} as const;

// ─── Ajustes en platform_settings ────────────────────────────────────────────

export async function readSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db.select().from(platformSettingsTable).where(inArray(platformSettingsTable.key, keys));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await db.insert(platformSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } });
}

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export interface ReportSettings {
  email: string;
  /** Interruptor del panel. */
  monthlyEnabled: boolean;
  /** MONTHLY_COST_REPORT del entorno: "true"/"false" manda sobre el panel; vacío = lo decide el panel. */
  envOverride: boolean | null;
  /** Lo que de verdad va a pasar el día 1. */
  monthlyEffective: boolean;
  lastMonthSent: string | null;
}

function envMonthly(): boolean | null {
  const v = (process.env.MONTHLY_COST_REPORT ?? "").trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
}

export async function getReportSettings(): Promise<ReportSettings> {
  const s = await readSettings([REPORT_KEYS.email, REPORT_KEYS.monthly, REPORT_KEYS.lastMonth]);
  const monthlyEnabled = s[REPORT_KEYS.monthly] === "true";
  const envOverride = envMonthly();
  return {
    email: s[REPORT_KEYS.email]?.trim() || DEFAULT_REPORT_EMAIL,
    monthlyEnabled,
    envOverride,
    monthlyEffective: envOverride ?? monthlyEnabled,
    lastMonthSent: s[REPORT_KEYS.lastMonth] ?? null,
  };
}

// ─── Datos ───────────────────────────────────────────────────────────────────

export interface UsageFilter {
  from: Date;
  to: Date;
  provider?: string | null;
  projectId?: number | null;
}

export interface UsageRow {
  createdAt: Date | string;
  projectId: number | null;
  projectName: string | null;
  shopDomain: string | null;
  provider: string;
  model: string | null;
  operation: string;
  inputUnits: number | null;
  outputUnits: number | null;
  costUsd: number | null;
  costEur: number | null;
  success: number | null;
}

export function parseProjectId(v: unknown): number | null {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fin de rango: una fecha sola ("2026-11-07", la que manda el panel) incluye ese día
 * entero; new Date() la tomaba como las 00:00 UTC y dejaba fuera el propio día.
 */
export function parseRangeEnd(to: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const [y, m, d] = to.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(to);
}

export async function fetchUsageRows(f: UsageFilter): Promise<UsageRow[]> {
  const conditions = [gte(apiUsageLogTable.createdAt, f.from), lte(apiUsageLogTable.createdAt, f.to)];
  if (f.provider && f.provider !== "all") conditions.push(eq(apiUsageLogTable.provider, f.provider));
  if (f.projectId) conditions.push(eq(apiUsageLogTable.projectId, f.projectId));
  return db
    .select({
      createdAt:   apiUsageLogTable.createdAt,
      projectId:   apiUsageLogTable.projectId,
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
    .orderBy(desc(apiUsageLogTable.createdAt)) as Promise<UsageRow[]>;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

const CSV_HEADERS = ["Fecha", "Proyecto", "Tienda", "Motor", "Modelo", "Operacion", "Tokens Entrada", "Tokens Salida", "Coste USD", "Coste EUR", "Estado"];

const BOM = String.fromCharCode(0xfeff);

/** CSV con BOM (Excel lo abre con acentos). */
export function buildCostCsv(rows: UsageRow[]): string {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    CSV_HEADERS.map(escape).join(","),
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
  return BOM + lines.join("\n");
}

export function slugify(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function csvFilename(fromLabel: string, toLabel: string, project?: { id: number; name?: string | null } | null): string {
  if (!project) return `costes-ia-${fromLabel}_${toLabel}.csv`;
  const slug = project.name ? slugify(project.name) : "";
  return `costes-ia-proyecto-${project.id}${slug ? `-${slug}` : ""}-${fromLabel}_${toLabel}.csv`;
}

// ─── Resumen por proyecto ────────────────────────────────────────────────────

export interface ProjectSummaryRow {
  projectId: number | null;
  name: string;
  mainProvider: string;
  calls: number;
  costUsd: number;
  pct: number;
}

/**
 * Agrupa por proyecto (equivale a GROUP BY project_id sobre las mismas filas del CSV),
 * de mayor a menor coste; a partir de `limit` filas, el resto va junto en «Otros».
 */
export function summarizeByProject(rows: UsageRow[], limit = 10): ProjectSummaryRow[] {
  const groups = new Map<string, { projectId: number | null; name: string; calls: number; costUsd: number; byProvider: Map<string, number> }>();
  let total = 0;
  for (const r of rows) {
    const key = r.projectId == null ? "none" : String(r.projectId);
    let g = groups.get(key);
    if (!g) {
      g = {
        projectId: r.projectId ?? null,
        name: r.projectName || (r.projectId == null ? "Sin proyecto (plataforma)" : `Proyecto #${r.projectId}`),
        calls: 0, costUsd: 0, byProvider: new Map(),
      };
      groups.set(key, g);
    }
    const cost = Number(r.costUsd ?? 0);
    g.calls += 1;
    g.costUsd += cost;
    g.byProvider.set(r.provider, (g.byProvider.get(r.provider) ?? 0) + cost);
    total += cost;
  }
  const mainOf = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const pctOf = (c: number) => (total > 0 ? (c / total) * 100 : 0);
  const sorted = [...groups.values()].sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls);
  const top = sorted.slice(0, limit).map(g => ({
    projectId: g.projectId, name: g.name, mainProvider: mainOf(g.byProvider),
    calls: g.calls, costUsd: g.costUsd, pct: pctOf(g.costUsd),
  }));
  const rest = sorted.slice(limit);
  if (rest.length > 0) {
    const merged = new Map<string, number>();
    for (const g of rest) for (const [p, c] of g.byProvider) merged.set(p, (merged.get(p) ?? 0) + c);
    const costUsd = rest.reduce((s, g) => s + g.costUsd, 0);
    top.push({
      projectId: null, name: `Otros (${rest.length} proyectos)`, mainProvider: mainOf(merged),
      calls: rest.reduce((s, g) => s + g.calls, 0), costUsd, pct: pctOf(costUsd),
    });
  }
  return top;
}

// ─── Email ───────────────────────────────────────────────────────────────────

export function buildCostReportHtml(o: {
  fromLabel: string; toLabel: string; provider?: string | null; projectName?: string | null;
  rows: UsageRow[]; automatic?: boolean;
}): string {
  const totalUsd = o.rows.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);
  const totalEur = o.rows.reduce((s, r) => s + Number(r.costEur ?? 0), 0);
  const projects = summarizeByProject(o.rows, 10);
  const th = "padding:7px 10px;color:#888;font-weight:600;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;";
  const td = "padding:7px 10px;border-top:1px solid rgba(255,255,255,0.06);";
  const projectTable = projects.length === 0
    ? `<p style="font-size:13px;color:#888;margin:0 0 20px;">Sin consumo registrado en el período.</p>`
    : `
  <h2 style="font-size:14px;color:#e8e0cc;margin:0 0 10px;">Costes por proyecto</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px;">
    <thead><tr>
      <th style="${th}text-align:left;">Proyecto</th>
      <th style="${th}text-align:left;">Motor principal</th>
      <th style="${th}text-align:right;">Llamadas</th>
      <th style="${th}text-align:right;">Coste USD</th>
      <th style="${th}text-align:right;">% del total</th>
    </tr></thead>
    <tbody>${projects.map(p => `
      <tr>
        <td style="${td}color:#e8e0cc;">${sanitizeHtml(p.name)}</td>
        <td style="${td}color:#ccc;">${sanitizeHtml(p.mainProvider)}</td>
        <td style="${td}color:#ccc;text-align:right;">${p.calls.toLocaleString("es-ES")}</td>
        <td style="${td}color:#c8a84b;font-weight:700;text-align:right;">$${p.costUsd.toFixed(4)}</td>
        <td style="${td}color:#ccc;text-align:right;">${p.pct.toFixed(1)}%</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
  const filters = [
    o.provider && o.provider !== "all" ? ` · Motor: <strong style="color:#e8e0cc;">${sanitizeHtml(o.provider)}</strong>` : "",
    o.projectName ? ` · Proyecto: <strong style="color:#e8e0cc;">${sanitizeHtml(o.projectName)}</strong>` : "",
  ].join("");
  return `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#0f0f1a;color:#e8e0cc;padding:24px;border-radius:12px;">
  <div style="border-bottom:1px solid rgba(200,168,75,0.3);padding-bottom:16px;margin-bottom:20px;">
    <h1 style="margin:0;font-size:20px;color:#c8a84b;">💸 Informe de Costes IA${o.automatic ? " · mensual" : ""}</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#888;">Período: <strong style="color:#e8e0cc;">${sanitizeHtml(o.fromLabel)}</strong> → <strong style="color:#e8e0cc;">${sanitizeHtml(o.toLabel)}</strong>${filters}</p>
  </div>
  <div style="display:flex;gap:24px;margin-bottom:24px;flex-wrap:wrap;">
    <div style="background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:8px;padding:14px 20px;min-width:140px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Coste Total</div>
      <div style="font-size:22px;font-weight:700;color:#c8a84b;">$${totalUsd.toFixed(4)}</div>
      <div style="font-size:12px;color:#888;">€${totalEur.toFixed(4)} EUR</div>
    </div>
    <div style="background:rgba(45,212,159,0.06);border:1px solid rgba(45,212,159,0.15);border-radius:8px;padding:14px 20px;min-width:140px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Llamadas API</div>
      <div style="font-size:22px;font-weight:700;color:#2dd49f;">${o.rows.length.toLocaleString("es-ES")}</div>
      <div style="font-size:12px;color:#888;">${o.rows.length} registros exportados</div>
    </div>
  </div>
  ${projectTable}
  <p style="font-size:12px;color:#666;margin:0;">El CSV completo con todos los registros está adjunto a este email.</p>
  <p style="font-size:11px;color:#444;margin:16px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">Powered by Shopy Crafter · craftershopy@gmail.com</p>
</div>`;
}

export interface SendReportResult { ok: boolean; recipient: string; rows: number; filename: string }

export async function sendCostReport(o: {
  from: Date; to: Date; fromLabel: string; toLabel: string;
  provider?: string | null; recipient: string; automatic?: boolean;
}): Promise<SendReportResult> {
  const rows = await fetchUsageRows({ from: o.from, to: o.to, provider: o.provider });
  const filename = csvFilename(o.fromLabel, o.toLabel);
  const subject = `Informe costes IA${o.automatic ? " (mensual)" : ""} — ${o.fromLabel} a ${o.toLabel}`;
  const html = buildCostReportHtml({ fromLabel: o.fromLabel, toLabel: o.toLabel, provider: o.provider, rows, automatic: o.automatic });
  const ok = await sendEmailWithAttachment(o.recipient, subject, html, [
    { filename, content: buildCostCsv(rows), mimeType: "text/csv" },
  ]);
  return { ok, recipient: o.recipient, rows: rows.length, filename };
}

// ─── Envío mensual automático ────────────────────────────────────────────────

/** Mes anterior completo en la zona de negocio (Europe/Madrid). */
export function previousMonthRange(now: Date = new Date()): { from: Date; to: Date; fromLabel: string; toLabel: string; month: string } {
  const [y, m] = businessYmd(now).split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromLabel = `${py}-${pad(pm)}-01`;
  const lastDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const toLabel = `${py}-${pad(pm)}-${pad(lastDay)}`;
  const from = businessDayStart(fromLabel);
  const to = new Date(businessDayStart(`${y}-${pad(m)}-01`).getTime() - 1);
  return { from, to, fromLabel, toLabel, month: `${py}-${pad(pm)}` };
}

export type MonthlyReportOutcome = "disabled" | "already-sent" | "no-gmail" | "sent" | "failed";

/**
 * Job del día 1: manda el informe del mes anterior. Se apunta el mes enviado para
 * que un reinicio o una segunda instancia no lo repitan.
 */
export async function runMonthlyCostReport(now: Date = new Date()): Promise<MonthlyReportOutcome> {
  const settings = await getReportSettings();
  if (!settings.monthlyEffective) return "disabled";
  const range = previousMonthRange(now);
  if (settings.lastMonthSent === range.month) return "already-sent";
  if (!isGmailAvailable()) {
    logger.warn("Informe mensual de costes IA: Gmail no está configurado");
    return "no-gmail";
  }
  const r = await sendCostReport({ ...range, recipient: settings.email, automatic: true });
  if (!r.ok) {
    logger.error({ month: range.month }, "Informe mensual de costes IA: no se pudo enviar");
    return "failed";
  }
  await writeSetting(REPORT_KEYS.lastMonth, range.month);
  logger.info({ month: range.month, rows: r.rows }, "Informe mensual de costes IA enviado");
  return "sent";
}
