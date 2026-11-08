import { db, platformSettingsTable } from "@workspace/db";
import { apiUsageLogTable } from "@workspace/db/schema";
import { desc, gte, like, sql } from "drizzle-orm";
import { sendEmail, isGmailAvailable } from "./gmail.js";
import { sanitizeHtml } from "./html-escape.js";
import { businessDayStart, businessYmd } from "./tz.js";
import { readSettings, writeSetting, DEFAULT_REPORT_EMAIL } from "./api-usage-report.js";
import { logger } from "./logger.js";

/**
 * Alerta de presupuesto de IA (revisión diaria a las 8:00):
 *  - aviso previo al llegar al % configurado (80 % por defecto), una vez al mes por ámbito;
 *  - alerta al superar el umbral, como mucho una vez al día por ámbito;
 *  - ámbitos: el total mensual y, si se configuran, cada proveedor por separado.
 */

export const ALERT_KEYS = {
  threshold: "ai_cost_alert_threshold_usd",
  email: "ai_cost_alert_email",
  enabled: "ai_cost_alert_enabled",
  lastSent: "ai_cost_alert_last_sent",
  warnPct: "ai_cost_alert_warn_pct",
  state: "ai_cost_alert_state",
} as const;

const PROVIDER_PREFIX = "ai_cost_alert_threshold_";
const PROVIDER_SUFFIX = "_usd";
export const DEFAULT_WARN_PCT = 80;

export const providerThresholdKey = (provider: string) => `${PROVIDER_PREFIX}${provider}${PROVIDER_SUFFIX}`;
export const isValidProviderName = (p: string) => /^[a-z0-9-]{1,32}$/.test(p);

export interface AlertSettings {
  thresholdUsd: number;
  alertEmail: string;
  enabled: boolean;
  lastSent: string | null;
  /** 0 = sin aviso previo. */
  warnPct: number;
  providerThresholds: Record<string, number>;
  /** Marcas de envío por ámbito: "over:total" → "YYYY-MM-DD", "warn:claude" → "YYYY-MM". */
  state: Record<string, string>;
}

export function normalizeWarnPct(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_WARN_PCT;
  return Math.min(99, Math.max(0, Math.round(n)));
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const s = await readSettings(Object.values(ALERT_KEYS));
  const providerRows = await db.select().from(platformSettingsTable)
    .where(like(platformSettingsTable.key, `${PROVIDER_PREFIX}%${PROVIDER_SUFFIX}`));
  const providerThresholds: Record<string, number> = {};
  for (const r of providerRows) {
    if (r.key === ALERT_KEYS.threshold) continue;
    const provider = r.key.slice(PROVIDER_PREFIX.length, -PROVIDER_SUFFIX.length);
    const v = parseFloat(r.value);
    if (isValidProviderName(provider) && v > 0) providerThresholds[provider] = v;
  }
  let state: Record<string, string> = {};
  try { state = JSON.parse(s[ALERT_KEYS.state] ?? "{}") ?? {}; } catch { state = {}; }
  return {
    thresholdUsd: parseFloat(s[ALERT_KEYS.threshold] ?? "0") || 0,
    alertEmail: s[ALERT_KEYS.email]?.trim() || DEFAULT_REPORT_EMAIL,
    enabled: s[ALERT_KEYS.enabled] !== "false",
    lastSent: s[ALERT_KEYS.lastSent] ?? null,
    warnPct: s[ALERT_KEYS.warnPct] === undefined ? DEFAULT_WARN_PCT : normalizeWarnPct(s[ALERT_KEYS.warnPct]),
    providerThresholds,
    state,
  };
}

export async function saveProviderThresholds(map: Record<string, unknown>): Promise<void> {
  for (const [provider, raw] of Object.entries(map)) {
    if (!isValidProviderName(provider)) continue;
    const v = Number(raw);
    const key = providerThresholdKey(provider);
    if (raw === null || raw === "" || !Number.isFinite(v) || v <= 0) {
      await db.delete(platformSettingsTable).where(sql`${platformSettingsTable.key} = ${key}`);
    } else {
      await writeSetting(key, String(v));
    }
  }
}

// ─── Evaluación (pura) ───────────────────────────────────────────────────────

export interface AlertHit {
  /** "total" o el nombre del proveedor. */
  scope: string;
  level: "warn" | "over";
  spentUsd: number;
  thresholdUsd: number;
  pct: number;
}

export function evaluateAlerts(o: {
  totalSpentUsd: number;
  spentByProvider: Record<string, number>;
  thresholdUsd: number;
  providerThresholds: Record<string, number>;
  warnPct: number;
  state: Record<string, string>;
  today: string; // YYYY-MM-DD
}): AlertHit[] {
  const month = o.today.slice(0, 7);
  const scopes: Array<{ scope: string; spent: number; threshold: number }> = [];
  if (o.thresholdUsd > 0) scopes.push({ scope: "total", spent: o.totalSpentUsd, threshold: o.thresholdUsd });
  for (const [provider, threshold] of Object.entries(o.providerThresholds)) {
    if (threshold > 0) scopes.push({ scope: provider, spent: o.spentByProvider[provider] ?? 0, threshold });
  }
  const hits: AlertHit[] = [];
  for (const { scope, spent, threshold } of scopes) {
    const pct = (spent / threshold) * 100;
    if (spent >= threshold) {
      if (o.state[`over:${scope}`] !== o.today) hits.push({ scope, level: "over", spentUsd: spent, thresholdUsd: threshold, pct });
    } else if (o.warnPct > 0 && pct >= o.warnPct) {
      if (o.state[`warn:${scope}`] !== month) hits.push({ scope, level: "warn", spentUsd: spent, thresholdUsd: threshold, pct });
    }
  }
  return hits;
}

export function markSent(state: Record<string, string>, hits: AlertHit[], today: string): Record<string, string> {
  const next = { ...state };
  for (const h of hits) next[`${h.level}:${h.scope}`] = h.level === "over" ? today : today.slice(0, 7);
  return next;
}

// ─── Email ───────────────────────────────────────────────────────────────────

const scopeLabel = (scope: string) => (scope === "total" ? "Gasto total" : `Motor ${scope}`);

export function buildAlertEmail(o: {
  hits: AlertHit[];
  monthLabel: string;
  byProvider: Array<{ provider: string; costUsd: number }>;
  test?: boolean;
}): { subject: string; html: string } {
  const over = o.hits.some(h => h.level === "over");
  const accent = over ? "#ef4444" : "#f59e0b";
  const accentBg = over ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)";
  const accentBd = over ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)";
  const title = over ? "🚨 Alerta: Presupuesto IA Superado" : "⚠️ Aviso: te acercas al presupuesto IA";
  const main = o.hits[0];
  const prefix = o.test ? "[PRUEBA] " : "";
  const subject = over
    ? `${prefix}🚨 Alerta de presupuesto IA — ${o.monthLabel} superado ($${main.spentUsd.toFixed(2)})`
    : `${prefix}⚠️ Aviso de presupuesto IA — ${o.monthLabel} al ${main.pct.toFixed(0)}% ($${main.spentUsd.toFixed(2)})`;

  const th = "padding:7px 12px;color:#888;font-weight:600;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;";
  const hitRows = o.hits.map(h => `
      <tr>
        <td style="padding:7px 12px;color:#e8e0cc;">${sanitizeHtml(scopeLabel(h.scope))}</td>
        <td style="padding:7px 12px;color:${h.level === "over" ? "#ef4444" : "#f59e0b"};font-weight:700;">${h.level === "over" ? "Superado" : "Aviso"}</td>
        <td style="padding:7px 12px;color:#e8e0cc;text-align:right;">$${h.spentUsd.toFixed(4)}</td>
        <td style="padding:7px 12px;color:#c8a84b;text-align:right;">$${h.thresholdUsd.toFixed(2)}</td>
        <td style="padding:7px 12px;color:#e8e0cc;text-align:right;">${h.pct.toFixed(1)}%</td>
      </tr>`).join("");
  const providerRows = o.byProvider.map(p =>
    `<tr><td style="padding:7px 12px;color:#e8e0cc;">${sanitizeHtml(p.provider)}</td><td style="padding:7px 12px;color:#c8a84b;font-weight:700;text-align:right;">$${Number(p.costUsd).toFixed(4)}</td></tr>`,
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#0f0f1a;color:#e8e0cc;padding:28px;border-radius:14px;">
  ${o.test ? `<div style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);color:#60a5fa;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:18px;">Esto es una <strong>prueba</strong> enviada desde el panel de Costes IA: así llegará la alerta real. Las cifras son las de este mes.</div>` : ""}
  <div style="border-bottom:2px solid ${accentBd};padding-bottom:16px;margin-bottom:22px;">
    <h1 style="margin:0;font-size:22px;color:${accent};">${title}</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#888;">${sanitizeHtml(o.monthLabel)}</p>
  </div>
  <div style="background:${accentBg};border:1px solid ${accentBd};border-radius:10px;padding:4px 0;margin-bottom:22px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr>
        <th style="${th}text-align:left;">Ámbito</th><th style="${th}text-align:left;">Estado</th>
        <th style="${th}text-align:right;">Gasto</th><th style="${th}text-align:right;">Umbral</th><th style="${th}text-align:right;">%</th>
      </tr></thead>
      <tbody>${hitRows}</tbody>
    </table>
  </div>
  ${over ? "" : `<p style="font-size:13px;color:#ccc;margin:0 0 18px;">Aún no has llegado al límite. Este aviso se envía una sola vez al mes para que puedas reaccionar a tiempo.</p>`}
  ${providerRows ? `
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px;">
    <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
      <th style="${th}text-align:left;">Motor</th><th style="${th}text-align:right;">Coste USD (mes)</th>
    </tr></thead>
    <tbody>${providerRows}</tbody>
  </table>` : ""}
  <p style="font-size:12px;color:#666;margin:0;">Accede al panel <strong style="color:#c8a84b;">Costes IA</strong> para más detalles.</p>
  <p style="font-size:11px;color:#444;margin:16px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">Powered by Shopy Crafter · craftershopy@gmail.com</p>
</div>`;
  return { subject, html };
}

// ─── Datos del mes ───────────────────────────────────────────────────────────

async function monthSpend(now: Date): Promise<{ total: number; byProvider: Array<{ provider: string; costUsd: number }> }> {
  const monthStart = businessDayStart(`${businessYmd(now).slice(0, 7)}-01`);
  const rows = await db
    .select({
      provider: apiUsageLogTable.provider,
      costUsd: sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
    })
    .from(apiUsageLogTable)
    .where(gte(apiUsageLogTable.createdAt, monthStart))
    .groupBy(apiUsageLogTable.provider)
    .orderBy(desc(sql`sum(${apiUsageLogTable.costUsd})`));
  const byProvider = rows.map(r => ({ provider: r.provider, costUsd: Number(r.costUsd ?? 0) }));
  return { total: byProvider.reduce((s, p) => s + p.costUsd, 0), byProvider };
}

const monthLabelOf = (now: Date) => now.toLocaleString("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });

/** Revisión diaria. Devuelve las alertas enviadas (vacío si no tocaba). */
export async function runAiCostAlertCheck(now: Date = new Date()): Promise<AlertHit[]> {
  const s = await getAlertSettings();
  const hasAnyThreshold = s.thresholdUsd > 0 || Object.keys(s.providerThresholds).length > 0;
  if (!s.enabled || !hasAnyThreshold) return [];

  const today = businessYmd(now);
  const spend = await monthSpend(now);
  const spentByProvider = Object.fromEntries(spend.byProvider.map(p => [p.provider, p.costUsd]));
  const hits = evaluateAlerts({
    totalSpentUsd: spend.total, spentByProvider, thresholdUsd: s.thresholdUsd,
    providerThresholds: s.providerThresholds, warnPct: s.warnPct, state: s.state, today,
  });
  if (hits.length === 0) return [];
  if (!isGmailAvailable()) {
    logger.warn({ hits: hits.length }, "Alerta de presupuesto IA: Gmail no está configurado");
    return [];
  }
  // Primero lo superado, luego los avisos.
  hits.sort((a, b) => (a.level === b.level ? b.pct - a.pct : a.level === "over" ? -1 : 1));
  const { subject, html } = buildAlertEmail({ hits, monthLabel: monthLabelOf(now), byProvider: spend.byProvider.slice(0, 8) });
  const sent = await sendEmail(s.alertEmail, subject, html);
  if (!sent) {
    logger.error("Alerta de presupuesto IA: no se pudo enviar el email");
    return [];
  }
  await writeSetting(ALERT_KEYS.state, JSON.stringify(markSent(s.state, hits, today)));
  await writeSetting(ALERT_KEYS.lastSent, today);
  logger.info({ to: s.alertEmail, hits: hits.map(h => `${h.level}:${h.scope}`) }, "Alerta de presupuesto IA enviada");
  return hits;
}

/**
 * Prueba desde el panel: manda ya la alerta con las cifras reales del mes, aunque no
 * se haya llegado al umbral. No toca las marcas de envío (la alerta real sigue igual).
 */
export async function sendTestAlert(now: Date = new Date()): Promise<{ ok: boolean; recipient: string }> {
  const s = await getAlertSettings();
  const spend = await monthSpend(now);
  const threshold = s.thresholdUsd > 0 ? s.thresholdUsd : Math.max(1, Math.ceil(spend.total));
  const pct = (spend.total / threshold) * 100;
  const hit: AlertHit = { scope: "total", level: spend.total >= threshold ? "over" : "warn", spentUsd: spend.total, thresholdUsd: threshold, pct };
  const { subject, html } = buildAlertEmail({ hits: [hit], monthLabel: monthLabelOf(now), byProvider: spend.byProvider.slice(0, 8), test: true });
  const ok = await sendEmail(s.alertEmail, subject, html);
  return { ok, recipient: s.alertEmail };
}
