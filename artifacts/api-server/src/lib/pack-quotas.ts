/**
 * Cuotas mensuales de los packs que no son productos ni imágenes (esas siguen en plan-limits):
 * auditorías SEO, productos de competencia, tests A/B, artículos de blog y, en los packs de
 * Stripe, facturas/links de pago, cupones y cambios de suscripción.
 *
 * El cupo se RESERVA antes de hacer el trabajo, con un solo UPDATE condicional: dos peticiones
 * a la vez no pueden pasarse del límite. Si el trabajo falla, releasePackQuota lo devuelve.
 * El mes es el de la zona de negocio (Europe/Madrid).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { businessYmd } from "./tz.js";
import { catalogPlan, quotaFor, type QuotaMetric } from "./plan-catalog.js";

export const METRIC_LABEL: Record<QuotaMetric, string> = {
  seo_audits: "auditorías SEO",
  competitor_scans: "análisis de competencia con IA",
  ab_tests: "tests A/B",
  blog_posts: "artículos de blog",
  stripe_invoices: "facturas o links de pago",
  stripe_coupons: "cupones",
  stripe_subscriptions: "cambios de suscripción",
};

let ready: Promise<void> | null = null;
export function ensurePackUsageTable(): Promise<void> {
  ready ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS pack_usage (
      project_id INTEGER NOT NULL,
      metric TEXT NOT NULL,
      period TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, metric, period)
    )
  `).then(() => undefined).catch(err => { ready = null; throw err; });
  return ready;
}

/** "YYYY-MM" del mes de negocio actual. */
export function currentPeriod(now = new Date()): string {
  return businessYmd(now).slice(0, 7);
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  reason?: string;
}

async function projectPlan(projectId: number): Promise<{ plan: string | null; platform: string | null }> {
  const r = await db.execute(sql`SELECT plan, platform_type FROM projects WHERE id = ${projectId} LIMIT 1`);
  const row = r.rows[0] as { plan?: string; platform_type?: string } | undefined;
  return { plan: row?.plan ?? null, platform: row?.platform_type ?? null };
}

/**
 * Cupo del mes de un proyecto. Las métricas de Stripe solo se cuentan en proyectos de
 * plataforma Stripe: a una tienda que además cobra con Stripe no se le vende ese trabajo
 * por cupo (se gestiona como hasta ahora).
 */
function limitFor(p: { plan: string | null; platform: string | null }, metric: QuotaMetric): number {
  if (metric.startsWith("stripe_") && p.platform !== "stripe") return Infinity;
  return quotaFor(p.plan, metric);
}

function planName(plan: string | null): string {
  if (plan === "admin") return "Admin";
  return catalogPlan(plan)?.name ?? "Prueba";
}

/** Uso actual del mes, sin reservar nada. */
export async function packUsage(projectId: number, metric: QuotaMetric): Promise<QuotaResult> {
  await ensurePackUsageTable();
  const p = await projectPlan(projectId);
  const limit = limitFor(p, metric);
  const r = await db.execute(sql`
    SELECT used FROM pack_usage WHERE project_id = ${projectId} AND metric = ${metric} AND period = ${currentPeriod()}
  `);
  const used = Number((r.rows[0] as { used?: number } | undefined)?.used ?? 0);
  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Reserva `count` unidades del cupo del mes. allowed=false (y nada reservado) si no caben.
 * Proyecto admin = sin tope (no se registra).
 */
export async function reservePackQuota(projectId: number, metric: QuotaMetric, count = 1): Promise<QuotaResult> {
  await ensurePackUsageTable();
  const p = await projectPlan(projectId);
  const plan = p.plan;
  const limit = limitFor(p, metric);
  if (limit === Infinity) return { allowed: true, used: 0, limit, remaining: Infinity };
  const n = Math.max(1, Math.floor(count));
  const period = currentPeriod();
  const r = await db.execute(sql`
    INSERT INTO pack_usage (project_id, metric, period, used)
    SELECT ${projectId}, ${metric}, ${period}, ${n}
    WHERE ${n} <= ${limit}
    ON CONFLICT (project_id, metric, period) DO UPDATE
      SET used = pack_usage.used + EXCLUDED.used, updated_at = NOW()
      WHERE pack_usage.used + EXCLUDED.used <= ${limit}
    RETURNING used
  `);
  const row = r.rows[0] as { used?: number } | undefined;
  if (row) {
    const used = Number(row.used);
    return { allowed: true, used, limit, remaining: Math.max(0, limit - used) };
  }
  const cur = await packUsage(projectId, metric);
  const label = METRIC_LABEL[metric];
  return {
    ...cur, allowed: false,
    reason: limit === 0
      ? `El pack ${planName(plan)} no incluye ${label}. Puedes cambiar de pack o pedirlo como extra.`
      : `Pack ${planName(plan)}: este mes ya se han usado ${cur.used} de ${limit} ${label}. Necesitas ${n} y quedan ${cur.remaining}.`,
  };
}

/** Devuelve lo reservado si el trabajo no llegó a hacerse. */
export async function releasePackQuota(projectId: number, metric: QuotaMetric, count = 1): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE pack_usage SET used = GREATEST(0, used - ${Math.max(1, Math.floor(count))}), updated_at = NOW()
      WHERE project_id = ${projectId} AND metric = ${metric} AND period = ${currentPeriod()}
    `);
  } catch (err) {
    logger.warn({ err, projectId, metric }, "pack-quotas: no se pudo devolver el cupo");
  }
}

/** Uso del mes de todas las métricas de un proyecto (portal y panel). */
export async function packUsageSummary(projectId: number): Promise<Array<{ metric: QuotaMetric; label: string; used: number; limit: number | null }>> {
  await ensurePackUsageTable();
  const p = await projectPlan(projectId);
  const r = await db.execute(sql`
    SELECT metric, used FROM pack_usage WHERE project_id = ${projectId} AND period = ${currentPeriod()}
  `);
  const used = new Map((r.rows as Array<{ metric: string; used: number }>).map(x => [x.metric, Number(x.used)]));
  const metrics = Object.keys(METRIC_LABEL) as QuotaMetric[];
  return metrics
    .map(metric => {
      const limit = limitFor(p, metric);
      return { metric, label: METRIC_LABEL[metric], used: used.get(metric) ?? 0, limit: limit === Infinity ? null : limit };
    })
    .filter(m => m.limit === null || m.limit > 0 || m.used > 0);
}

/**
 * Reserva el cupo o responde 402 con el motivo (code PACK_QUOTA). Devuelve false si respondió.
 * Uso: `if (!(await takePackQuota(res, pid, "seo_audits"))) return;` y releasePackQuota si el trabajo falla.
 */
export async function takePackQuota(
  res: import("express").Response, projectId: number, metric: QuotaMetric, count = 1,
): Promise<boolean> {
  if (!Number.isFinite(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Proyecto no válido" });
    return false;
  }
  const q = await reservePackQuota(projectId, metric, count);
  if (q.allowed) return true;
  res.status(402).json({ error: q.reason, code: "PACK_QUOTA", metric, used: q.used, limit: q.limit });
  return false;
}

/**
 * Middleware: reserva 1 unidad de `metric` para el proyecto (`:projectId` o `projectId` del cuerpo) y la devuelve si la
 * respuesta termina en error (>= 400) o la conexión se corta antes de responder.
 */
export function packQuotaGuard(metric: QuotaMetric, from: "params" | "body" = "params"): import("express").RequestHandler {
  return async (req, res, next) => {
    const raw: unknown = from === "body" ? (req.body as { projectId?: unknown } | undefined)?.projectId : (req.params.projectId ?? req.params.id);
    const projectId = parseInt(Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""), 10);
    try {
      if (!(await takePackQuota(res, projectId, metric))) return;
    } catch (err) {
      next(err);
      return;
    }
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (!ok) void releasePackQuota(projectId, metric);
    };
    const failed = () => res.statusCode >= 400 || Number(res.locals.lateStatus) >= 400;
    res.on("finish", () => settle(!failed()));
    res.on("close", () => settle(res.writableFinished && !failed()));
    next();
  };
}
