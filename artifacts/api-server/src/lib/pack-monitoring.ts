/**
 * Trabajo programado que cada pack promete (lib/plan-catalog.ts):
 *  - Tiendas: PageSpeed móvil y escritorio de la portada y fichas, con su cadencia y su número
 *    de páginas, aviso si la nota de rendimiento cae; informe de resultados al portal.
 *  - Stripe: informe financiero (cobros, ingresos recurrentes, reembolsos, comisiones) con la
 *    conciliación de payouts cuando el pack la incluye; aviso diario de pagos fallidos y disputas.
 *
 * Solo para proyectos activos con cliente (users.client_id) y pack del catálogo. Cada trabajo
 * guarda cuándo se hizo (pack_jobs), así un reinicio o una doble ejecución no lo repite antes de
 * tiempo. Los informes van al repositorio del proyecto (categoría «reports»), que el cliente ve
 * en Reportes, con aviso push y por email.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { logger } from "./logger.js";
import { catalogPlan, isStorePlan, isStripePlan, CADENCE_LABEL, type Cadence, type StorePlan, type StripePlan } from "./plan-catalog.js";
import { packUsageSummary } from "./pack-quotas.js";

const HOUR = 3600_000;
/** Margen para que el cron diario no se salte un día por unos minutos. */
const DUE_AFTER: Record<Cadence, number> = {
  daily: 20 * HOUR,
  weekly: 6 * 24 * HOUR + 20 * HOUR,
  biweekly: 13 * 24 * HOUR + 20 * HOUR,
  monthly: 27 * 24 * HOUR,
};
const PERIOD_DAYS: Record<Cadence, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
/** Caída de la nota de rendimiento (0–100) que dispara el aviso. */
export const PAGESPEED_DROP_ALERT = 10;

let ready: Promise<void> | null = null;
export function ensurePackMonitoringTables(): Promise<void> {
  ready ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pack_jobs (
        project_id INTEGER NOT NULL,
        job TEXT NOT NULL,
        last_run_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (project_id, job)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pack_pagespeed (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        strategy TEXT NOT NULL,
        performance INTEGER,
        seo INTEGER,
        accessibility INTEGER,
        best_practices INTEGER,
        lcp_ms REAL,
        cls REAL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pack_pagespeed_lookup ON pack_pagespeed (project_id, url, strategy, created_at DESC)`);
  })().catch(err => { ready = null; throw err; });
  return ready;
}

// ── Utilidades ───────────────────────────────────────────────────────────────

interface MonitoredProject {
  id: number; name: string; plan: string; platform: string; shopDomain: string;
  emails: string[];
}

async function monitoredProjects(): Promise<MonitoredProject[]> {
  const r = await db.execute(sql`
    SELECT p.id, p.name, p.plan, p.platform_type, p.shop_domain, p.client_contact_email,
           COALESCE(array_agg(u.email) FILTER (WHERE u.email IS NOT NULL), '{}') AS emails
    FROM projects p
    JOIN users u ON u.client_id = p.id::text
    WHERE p.status = 'active'
    GROUP BY p.id
  `);
  return (r.rows as Array<Record<string, unknown>>)
    .filter(row => catalogPlan(String(row.plan)))
    .map(row => {
      const emails = new Set<string>((row.emails as string[] | null) ?? []);
      if (row.client_contact_email) emails.add(String(row.client_contact_email));
      return {
        id: Number(row.id), name: String(row.name ?? ""), plan: String(row.plan),
        platform: String(row.platform_type ?? "shopify"), shopDomain: String(row.shop_domain ?? ""),
        emails: [...emails].filter(e => /@/.test(e)),
      };
    });
}

async function lastRun(projectId: number, job: string): Promise<Date | null> {
  const r = await db.execute(sql`SELECT last_run_at FROM pack_jobs WHERE project_id = ${projectId} AND job = ${job}`);
  const v = (r.rows[0] as { last_run_at?: string | Date } | undefined)?.last_run_at;
  return v ? new Date(v) : null;
}

async function markRun(projectId: number, job: string, at = new Date()): Promise<void> {
  await db.execute(sql`
    INSERT INTO pack_jobs (project_id, job, last_run_at) VALUES (${projectId}, ${job}, ${at.toISOString()})
    ON CONFLICT (project_id, job) DO UPDATE SET last_run_at = EXCLUDED.last_run_at
  `);
}

function isDue(last: Date | null, cadence: Cadence, now = new Date()): boolean {
  return !last || now.getTime() - last.getTime() >= DUE_AFTER[cadence];
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function day(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
}

async function notify(p: MonitoredProject, title: string, body: string, html: string | null, url: string): Promise<void> {
  try {
    const { sendPushToClientByProject, sendPushToAdmins } = await import("./push-helper.js");
    await sendPushToClientByProject(String(p.id), title, body, url);
    await sendPushToAdmins(`${p.name}: ${title}`, body, "/admin/clients");
  } catch (err) {
    logger.warn({ err, projectId: p.id }, "pack-monitoring: push fallido");
  }
  if (!html || p.emails.length === 0) return;
  try {
    const { sendEmail } = await import("./gmail.js");
    for (const to of p.emails) await sendEmail(to, title, html);
  } catch (err) {
    logger.warn({ err, projectId: p.id }, "pack-monitoring: email fallido");
  }
}

function shell(title: string, subtitle: string, inner: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#0d0d1a;font-family:Segoe UI,Arial,sans-serif;color:#e8e6df">
<div style="max-width:760px;margin:0 auto;padding:32px 20px">
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a961">Shopy Crafter</div>
<h1 style="font-size:24px;margin:8px 0 4px;color:#fff">${esc(title)}</h1>
<p style="margin:0 0 24px;color:#9a98a6;font-size:13px">${esc(subtitle)}</p>
${inner}
<p style="margin-top:32px;color:#6b6b80;font-size:11px">Informe generado automáticamente con los datos reales de tu cuenta. Si algo no cuadra, escríbenos desde el portal.</p>
</div></body></html>`;
}

function table(headers: string[], rows: Array<Array<string | number>>): string {
  if (rows.length === 0) return `<p style="color:#9a98a6;font-size:13px">Sin datos en este periodo.</p>`;
  const th = headers.map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #2a2a3a;color:#c9a961;font-size:12px;font-weight:600">${esc(h)}</th>`).join("");
  const tr = rows.map(r => `<tr>${r.map(c => `<td style="padding:8px 10px;border-bottom:1px solid #1d1d2b;font-size:13px">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;background:#13131f;border-radius:10px;overflow:hidden;margin-bottom:20px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function section(title: string): string {
  return `<h2 style="font-size:16px;color:#fff;margin:28px 0 10px">${esc(title)}</h2>`;
}

async function saveReport(projectId: number, title: string, description: string, html: string, kind: string): Promise<void> {
  const { saveToVault } = await import("./vault.js");
  await saveToVault({
    projectId, fileType: "html", category: "reports", title, description,
    mimeType: "text/html", fileSizeBytes: Buffer.byteLength(html), generatedBy: `pack_${kind}`, content: html,
  });
}

// ── Tiendas: PageSpeed ───────────────────────────────────────────────────────

function baseUrl(domain: string): string | null {
  const d = domain.trim().replace(/\/+$/, "");
  if (!d) return null;
  return /^https?:\/\//i.test(d) ? d : `https://${d}`;
}

/** Portada + fichas publicadas que responden 200, hasta `limit` páginas. */
async function pagesToMeasure(p: MonitoredProject, limit: number): Promise<string[]> {
  const base = baseUrl(p.shopDomain);
  if (!base) return [];
  const urls = [base];
  if (limit <= 1) return urls;
  const r = await db.execute(sql`
    SELECT shopify_product_id, handle FROM products
    WHERE project_id = ${p.id} AND status = 'active' AND handle <> ''
    ORDER BY audit_score ASC NULLS LAST, id ASC
    LIMIT ${Math.min(80, limit * 3)}
  `);
  const { safeFetch } = await import("./web-scraper.js");
  for (const row of r.rows as Array<{ shopify_product_id: string; handle: string }>) {
    if (urls.length >= limit) break;
    const handle = encodeURIComponent(row.handle);
    const candidate = p.platform === "woocommerce" ? `${base}/product/${handle}/`
      : p.platform === "prestashop" ? `${base}/${encodeURIComponent(row.shopify_product_id)}-${handle}.html`
      : `${base}/products/${handle}`;
    try {
      const resp = await safeFetch(candidate, { method: "GET", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "ShopyCrafter-Monitor/1.0" } });
      if (resp.ok) urls.push(candidate);
      await resp.body?.cancel().catch(() => {});
    } catch { /* ficha no accesible: no se mide */ }
  }
  return urls;
}

interface PsRow { url: string; strategy: string; performance: number | null; seo: number | null; accessibility: number | null; best_practices: number | null; lcp_ms: number | null; cls: number | null }

async function previousScore(projectId: number, url: string, strategy: string): Promise<number | null> {
  const r = await db.execute(sql`
    SELECT performance FROM pack_pagespeed WHERE project_id = ${projectId} AND url = ${url} AND strategy = ${strategy}
    ORDER BY created_at DESC LIMIT 1
  `);
  const v = (r.rows[0] as { performance?: number | null } | undefined)?.performance;
  return v === undefined || v === null ? null : Number(v);
}

export async function runPageSpeedFor(p: MonitoredProject, plan: StorePlan): Promise<{ measured: number; drops: string[] }> {
  const cfg = plan.quotas.pagespeed;
  if (!cfg) return { measured: 0, drops: [] };
  const { runPageSpeedAudit } = await import("./pagespeed.js");
  const urls = await pagesToMeasure(p, cfg.urls);
  const drops: string[] = [];
  let measured = 0;
  for (const url of urls) {
    for (const strategy of ["mobile", "desktop"] as const) {
      try {
        const before = await previousScore(p.id, url, strategy);
        const r = await runPageSpeedAudit(url, strategy);
        const perf = r.performanceScore;
        await db.execute(sql`
          INSERT INTO pack_pagespeed (project_id, url, strategy, performance, seo, accessibility, best_practices, lcp_ms, cls)
          VALUES (${p.id}, ${url}, ${strategy}, ${perf}, ${r.seoScore}, ${r.accessibilityScore}, ${r.bestPracticesScore},
                  ${r.coreWebVitals.lcp.value}, ${r.coreWebVitals.cls.value})
        `);
        measured++;
        if (before !== null && perf !== null && before - perf >= PAGESPEED_DROP_ALERT) {
          drops.push(`${url} (${strategy === "mobile" ? "móvil" : "escritorio"}): ${before} → ${perf}`);
        }
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : err, url, strategy, projectId: p.id }, "pack-monitoring: PageSpeed fallido");
      }
    }
  }
  if (drops.length > 0) {
    const html = shell("La velocidad de tu tienda ha bajado", `${p.name} · ${day(new Date())}`,
      `<p style="font-size:14px">La nota de rendimiento de Google PageSpeed ha bajado ${PAGESPEED_DROP_ALERT} puntos o más en estas páginas desde la última medición. Ya lo estamos revisando.</p>
       <ul style="font-size:14px">${drops.map(d => `<li>${esc(d)}</li>`).join("")}</ul>`);
    await notify(p, "La velocidad de tu tienda ha bajado", `${drops.length} ${drops.length === 1 ? "página" : "páginas"} con la nota de PageSpeed más baja`, html, "/client/reports");
  }
  return { measured, drops };
}

// ── Tiendas: informe de resultados ───────────────────────────────────────────

async function latestPageSpeed(projectId: number): Promise<PsRow[]> {
  const r = await db.execute(sql`
    SELECT DISTINCT ON (url, strategy) url, strategy, performance, seo, accessibility, best_practices, lcp_ms, cls
    FROM pack_pagespeed WHERE project_id = ${projectId}
    ORDER BY url, strategy, created_at DESC
  `);
  return r.rows as unknown as PsRow[];
}

export async function buildStoreReport(p: MonitoredProject, plan: StorePlan, since: Date, until = new Date()): Promise<string> {
  const [opt, imgs, rev, avg, usage, ps, month] = await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS n FROM products WHERE project_id = ${p.id} AND last_audited_at >= ${since.toISOString()} AND last_audited_at < ${until.toISOString()}`),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM generation_jobs WHERE project_id = ${p.id} AND status = 'succeeded' AND created_at >= ${since.toISOString()} AND created_at < ${until.toISOString()}`).catch(() => ({ rows: [{ n: 0 }] })),
    db.execute(sql`SELECT COALESCE(SUM(revenue), 0)::float AS total, COUNT(*)::int AS days FROM (
        SELECT DISTINCT ON (date) date, revenue FROM revenue_snapshots WHERE project_id = ${String(p.id)}
          AND date >= ${since.toISOString().slice(0, 10)} AND date < ${until.toISOString().slice(0, 10)}
        ORDER BY date, created_at DESC NULLS LAST) s`).catch(() => ({ rows: [{ total: 0, days: 0 }] })),
    db.execute(sql`SELECT ROUND(AVG(audit_score))::int AS audit, ROUND(AVG(seo_score))::int AS seo, COUNT(*)::int AS n FROM products WHERE project_id = ${p.id} AND audit_score IS NOT NULL`),
    packUsageSummary(p.id),
    latestPageSpeed(p.id),
    db.execute(sql`SELECT products_used_this_month AS products, images_used_this_month AS images FROM projects WHERE id = ${p.id}`),
  ]);
  const used = month.rows[0] as { products?: number; images?: number } | undefined;
  const n = (x: { rows: unknown[] }, k = "n") => Number((x.rows[0] as Record<string, unknown> | undefined)?.[k] ?? 0);
  const avgRow = avg.rows[0] as { audit?: number | null; seo?: number | null; n?: number } | undefined;
  const revDays = n(rev, "days");

  const summary = table(["Indicador", "Valor"], [
    ["Productos optimizados en el periodo", n(opt)],
    ["Imágenes IA generadas en el periodo", n(imgs)],
    ["Nota media de las fichas", avgRow?.audit ?? "—"],
    ["Nota SEO media de las fichas", avgRow?.seo ?? "—"],
    ["Ingresos registrados en el periodo", revDays > 0 ? eur(Math.round(Number((rev.rows[0] as { total?: number }).total ?? 0) * 100)) : "Sin datos de ventas"],
  ]);
  const quota = table(["Este mes", "Usado", "Incluido"], [
    ["Productos optimizados", Number(used?.products ?? 0), plan.productsPerMonth],
    ["Imágenes IA", Number(used?.images ?? 0), plan.imagesPerMonth],
    ...usage.filter(u => u.limit !== 0).map(u => [u.label, u.used, u.limit ?? "Sin tope"] as Array<string | number>),
  ]);
  const speed = table(["Página", "Dispositivo", "Rendimiento", "SEO", "LCP"], ps.map(r => [
    r.url.replace(/^https?:\/\//, ""), r.strategy === "mobile" ? "Móvil" : "Escritorio",
    r.performance ?? "—", r.seo ?? "—", r.lcp_ms !== null && r.lcp_ms !== undefined ? `${(Number(r.lcp_ms) / 1000).toFixed(1)} s` : "—",
  ]));
  return shell(`Informe ${CADENCE_LABEL[plan.quotas.report]} de ${p.name}`, `Del ${day(since)} al ${day(until)} · Pack ${plan.name}`,
    section("Resumen") + summary + section("Velocidad (Google PageSpeed)") + speed + section("Uso de tu pack") + quota);
}

// ── Stripe ───────────────────────────────────────────────────────────────────

async function stripeOf(projectId: number): Promise<Stripe | null> {
  try {
    const { resolveStripeForProject } = await import("./stripe-tenant.js");
    return (await resolveStripeForProject(projectId, { strict: true })).stripe;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, projectId }, "pack-monitoring: Stripe no vinculado");
    return null;
  }
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

export async function buildStripeReport(p: MonitoredProject, plan: StripePlan, stripe: Stripe, since: Date, until = new Date()): Promise<string> {
  const range = { gte: unix(since), lt: unix(until) };
  let paid = 0, paidCount = 0, failed = 0, refunded = 0;
  for await (const c of stripe.charges.list({ created: range, limit: 100 })) {
    if (c.status === "succeeded") { paid += c.amount; paidCount++; refunded += c.amount_refunded; }
    else if (c.status === "failed") failed++;
  }
  let fees = 0;
  for await (const t of stripe.balanceTransactions.list({ created: range, limit: 100 })) fees += t.fee;
  let disputes = 0;
  for await (const _d of stripe.disputes.list({ created: range, limit: 100 })) disputes++;
  const { monthlyAmount } = await import("./stripe-commerce.js");
  let mrr = 0, activeSubs = 0;
  for await (const s of stripe.subscriptions.list({ status: "active", limit: 100 })) {
    activeSubs++;
    for (const it of s.items.data) {
      mrr += monthlyAmount({
        unitAmount: it.price.unit_amount ?? null, quantity: it.quantity ?? 1,
        interval: (it.price.recurring?.interval ?? null) as "day" | "week" | "month" | "year" | null,
        intervalCount: it.price.recurring?.interval_count ?? null,
      });
    }
  }
  let html = section("Cobros") + table(["Indicador", "Valor"], [
    ["Cobrado", `${eur(paid)} (${paidCount} cobros)`],
    ["Reembolsado", eur(refunded)],
    ["Comisiones de Stripe", eur(fees)],
    ["Neto", eur(paid - refunded - fees)],
    ["Pagos fallidos", failed],
    ["Disputas abiertas en el periodo", disputes],
    ["Ingresos recurrentes mensuales (MRR)", `${eur(Math.round(mrr))} (${activeSubs} suscripciones activas)`],
  ]);

  if (plan.quotas.payouts) {
    const rows: Array<Array<string | number>> = [];
    for await (const po of stripe.payouts.list({ created: range, limit: 100 })) {
      let net = 0;
      if (po.status === "paid") {
        for await (const t of stripe.balanceTransactions.list({ payout: po.id, limit: 100 })) {
          if (t.type !== "payout") net += t.net;
        }
      }
      rows.push([
        new Date(po.arrival_date * 1000).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" }),
        eur(po.amount), po.status === "paid" ? eur(net) : "—",
        po.status !== "paid" ? (po.status === "failed" ? "Fallido" : "Pendiente") : net === po.amount ? "Cuadra" : `Diferencia ${eur(po.amount - net)}`,
      ]);
    }
    html += section("Conciliación de payouts") + table(["Llegada al banco", "Importe", "Movimientos incluidos", "Estado"], rows);
  }
  const usage = await packUsageSummary(p.id);
  html += section("Uso de tu pack") + table(["Este mes", "Usado", "Incluido"],
    usage.filter(u => u.metric.startsWith("stripe_")).map(u => [u.label, u.used, u.limit ?? "Sin tope"]));
  return shell(`Informe financiero ${CADENCE_LABEL[plan.quotas.report]} de ${p.name}`, `Del ${day(since)} al ${day(until)} · Pack ${plan.name} (Stripe)`, html);
}

/** Pagos fallidos y disputas desde la última comprobación → aviso al cliente y al equipo. */
export async function runStripeAlerts(p: MonitoredProject, stripe: Stripe, since: Date): Promise<number> {
  const range = { gte: unix(since) };
  const failed: string[] = [];
  for await (const c of stripe.charges.list({ created: range, limit: 100 })) {
    if (c.status === "failed") failed.push(`${eur(c.amount)} · ${c.billing_details?.email ?? c.receipt_email ?? "cliente sin email"} · ${c.failure_message ?? c.failure_code ?? "rechazado"}`);
  }
  const disputes: string[] = [];
  for await (const d of stripe.disputes.list({ created: range, limit: 100 })) {
    disputes.push(`${eur(d.amount)} · motivo: ${d.reason} · responder antes del ${d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toLocaleDateString("es-ES") : "—"}`);
  }
  const total = failed.length + disputes.length;
  if (total === 0) return 0;
  const html = shell("Avisos de tu cuenta de Stripe", `${p.name} · ${day(new Date())}`,
    (failed.length ? section(`Pagos fallidos (${failed.length})`) + `<ul style="font-size:14px">${failed.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "") +
    (disputes.length ? section(`Disputas nuevas (${disputes.length})`) + `<ul style="font-size:14px">${disputes.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""));
  await notify(p, "Avisos de tu cuenta de Stripe", `${failed.length} pagos fallidos y ${disputes.length} disputas nuevas`, html, "/client/stripe");
  return total;
}

// ── Orquestación ─────────────────────────────────────────────────────────────

export type PackJob = "pagespeed" | "report" | "stripe_alerts";

/**
 * Ejecuta lo que toque a un proyecto. `force` ignora la cadencia (botón del admin).
 * Devuelve qué se hizo, para el registro y para el admin.
 */
export async function runPackJobsFor(p: MonitoredProject, opts: { force?: PackJob[] } = {}): Promise<string[]> {
  await ensurePackMonitoringTables();
  const plan = catalogPlan(p.plan);
  const done: string[] = [];
  const now = new Date();
  const forced = (j: PackJob) => opts.force?.includes(j) ?? false;

  if (isStorePlan(plan)) {
    const cfg = plan.quotas.pagespeed;
    if (cfg && (forced("pagespeed") || isDue(await lastRun(p.id, "pagespeed"), cfg.cadence, now))) {
      try {
        const r = await runPageSpeedFor(p, plan);
        if (r.measured > 0) { await markRun(p.id, "pagespeed", now); done.push(`pagespeed:${r.measured}`); }
      } catch (err) {
        // Sin clave de PageSpeed o Google caído: el informe sale igualmente.
        logger.error({ err: err instanceof Error ? err.message : err, projectId: p.id }, "pack-monitoring: PageSpeed no disponible");
        if (forced("pagespeed")) throw err;
      }
    }
    const last = await lastRun(p.id, "report");
    if (!last && !forced("report")) {
      await markRun(p.id, "report", now); // primer informe al cumplirse el primer periodo
    } else if (forced("report") || isDue(last, plan.quotas.report, now)) {
      const since = last ?? new Date(now.getTime() - PERIOD_DAYS[plan.quotas.report] * 24 * HOUR);
      const html = await buildStoreReport(p, plan, since, now);
      const title = `Informe ${CADENCE_LABEL[plan.quotas.report]} · ${day(now)}`;
      await saveReport(p.id, title, `Resultados del ${day(since)} al ${day(now)}`, html, "report");
      await markRun(p.id, "report", now);
      await notify(p, "Tienes un informe nuevo", title, null, "/client/reports");
      done.push("report");
    }
  }

  if (isStripePlan(plan) && p.platform === "stripe") {
    const stripe = await stripeOf(p.id);
    if (stripe) {
      const lastAlert = await lastRun(p.id, "stripe_alerts");
      if (forced("stripe_alerts") || isDue(lastAlert, "daily", now)) {
        const n = await runStripeAlerts(p, stripe, lastAlert ?? new Date(now.getTime() - 24 * HOUR));
        await markRun(p.id, "stripe_alerts", now);
        done.push(`stripe_alerts:${n}`);
      }
      const last = await lastRun(p.id, "report");
      if (!last && !forced("report")) {
        await markRun(p.id, "report", now);
      } else if (forced("report") || isDue(last, plan.quotas.report, now)) {
        const since = last ?? new Date(now.getTime() - PERIOD_DAYS[plan.quotas.report] * 24 * HOUR);
        const html = await buildStripeReport(p, plan, stripe, since, now);
        const title = `Informe financiero ${CADENCE_LABEL[plan.quotas.report]} · ${day(now)}`;
        await saveReport(p.id, title, `Cobros del ${day(since)} al ${day(now)}`, html, "stripe_report");
        await markRun(p.id, "report", now);
        await notify(p, "Tienes un informe financiero nuevo", title, null, "/client/reports");
        done.push("stripe_report");
      }
    }
  }
  return done;
}

/** Cron diario: recorre todos los proyectos con pack. Un proyecto que falla no para al resto. */
export async function runPackMonitoring(): Promise<{ projects: number; actions: number }> {
  await ensurePackMonitoringTables();
  const projects = await monitoredProjects();
  let actions = 0;
  for (const p of projects) {
    try {
      const done = await runPackJobsFor(p);
      actions += done.length;
      if (done.length) logger.info({ projectId: p.id, done }, "pack-monitoring: trabajo hecho");
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : err, projectId: p.id }, "pack-monitoring: proyecto con error");
    }
  }
  return { projects: projects.length, actions };
}

/** Un proyecto concreto (botón del admin). */
export async function runPackJobsForProject(projectId: number, force: PackJob[]): Promise<string[]> {
  const p = (await monitoredProjects()).find(x => x.id === projectId);
  if (!p) throw new Error("El proyecto no tiene cliente activo con un pack del catálogo");
  return runPackJobsFor(p, { force });
}
