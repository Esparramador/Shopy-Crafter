import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { catalogPlan, TRIAL } from "./plan-catalog.js";
import { currentAiContext } from "./ai-context.js";
import { logger } from "./logger.js";

/**
 * Tope de gasto de IA (texto, visión, búsqueda) por proyecto y mes, para que
 * ningún plan cueste más de lo que cobra. Las imágenes y vídeos ya tienen su
 * cuota propia (créditos); aquí se cubre todo lo demás que se registra en
 * api_usage_log: rediseños, SEO, auditorías, asistente, webs…
 *
 * Presupuesto = AI_BUDGET_SHARE (30 % por defecto) de lo que el cliente paga ese
 * mes: plan (precio anual / 12, el menor de los dos) + servicios mensuales activos
 * + servicios de pago único del mes; más 1 € por crédito de producto de packs.
 * Prueba: 3 €.
 */
const DEFAULT_SHARE = 0.3;
const TRIAL_BUDGET_EUR = 3;
const EUR_PER_PACK_PRODUCT = 1;

export class AiBudgetExceededError extends Error {
  readonly status = 402;
  readonly code = "AI_BUDGET_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "AiBudgetExceededError";
  }
}

function share(): number {
  const v = Number(process.env.AI_BUDGET_SHARE);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : DEFAULT_SHARE;
}

/** Presupuesto mensual de IA en € (Infinity = sin tope). servicesEur = servicios pagados este mes. */
export function planAiBudgetEur(plan: string | null | undefined, creditsProducts = 0, servicesEur = 0): number {
  if (plan === "admin") return Infinity;
  const extra = Math.max(0, creditsProducts) * EUR_PER_PACK_PRODUCT + Math.max(0, servicesEur) * share();
  if (plan === "trial") return Math.round((TRIAL_BUDGET_EUR + extra) * 100) / 100;
  const cat = catalogPlan(plan ?? "starter") ?? catalogPlan("starter")!;
  return Math.round(((cat.priceAnnual / 12) * share() + extra) * 100) / 100;
}

/** Servicios pagados por el proyecto este mes (mensuales activos + pagos únicos del mes), en €. */
async function servicesRevenueEur(projectId: number): Promise<number> {
  try {
    const r = await db.execute(sql`
      SELECT
        (SELECT COALESCE(SUM(amount_cents), 0) FROM service_subscriptions
          WHERE project_id = ${projectId} AND status IN ('active', 'past_due'))
        + (SELECT COALESCE(SUM(amount_cents), 0) FROM service_orders
          WHERE project_id = ${projectId} AND status = 'paid' AND created_at >= date_trunc('month', NOW())) AS cents
    `);
    return (Number((r.rows[0] as { cents?: number } | undefined)?.cents) || 0) / 100;
  } catch {
    return 0; // tablas aún sin crear (Stripe no configurado)
  }
}

export interface ProjectAiSpend {
  projectId: number;
  plan: string;
  /** Tiene un usuario cliente vinculado (proyecto de pago, no interno de la agencia). */
  hasClient: boolean;
  budgetEur: number;
  spentEur: number;
  remainingEur: number;
}

const CACHE_MS = 30_000;
const cache = new Map<number, { at: number; value: ProjectAiSpend }>();

export async function getProjectAiSpend(projectId: number, fresh = false): Promise<ProjectAiSpend | null> {
  const hit = cache.get(projectId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const r = await db.execute(sql`
    SELECT p.plan, COALESCE(p.credits_products, 0)::int AS credits_products,
      EXISTS (SELECT 1 FROM users c WHERE c.client_id = p.id::text) AS has_client,
      (SELECT COALESCE(SUM(u.cost_eur), 0)::float FROM api_usage_log u
        WHERE u.project_id = p.id AND u.created_at >= date_trunc('month', NOW())) AS spent
    FROM projects p WHERE p.id = ${projectId}
  `);
  const row = r.rows[0] as { plan: string | null; credits_products: number; has_client: boolean; spent: number } | undefined;
  if (!row) return null;
  const budgetEur = planAiBudgetEur(row.plan, row.credits_products, await servicesRevenueEur(projectId));
  const spentEur = Number(row.spent) || 0;
  const value: ProjectAiSpend = {
    projectId, plan: row.plan ?? "starter", hasClient: Boolean(row.has_client), budgetEur, spentEur,
    remainingEur: budgetEur === Infinity ? Infinity : Math.max(0, budgetEur - spentEur),
  };
  cache.set(projectId, { at: Date.now(), value });
  return value;
}

/** Gasto anónimo (chat y voz de la landing) del día, con tope global. */
async function publicSpendTodayEur(): Promise<number> {
  const r = await db.execute(sql`
    SELECT COALESCE(SUM(cost_eur), 0)::float AS spent FROM api_usage_log
    WHERE actor = 'public' AND created_at >= date_trunc('day', NOW())
  `);
  return Number((r.rows[0] as { spent?: number } | undefined)?.spent) || 0;
}

let publicCache: { at: number; spent: number } | null = null;

/**
 * Lanza AiBudgetExceededError si el proyecto (explícito o el de la petición) ya
 * consumió su IA del mes (lo dispare el cliente o el equipo).
 */
export async function assertAiBudget(explicitProjectId?: number | null): Promise<void> {
  const ctx = currentAiContext();
  try {
    if (ctx?.actor === "public" && !explicitProjectId) {
      const cap = Number(process.env.PUBLIC_AI_DAILY_BUDGET_EUR ?? 5);
      if (!publicCache || Date.now() - publicCache.at > CACHE_MS) publicCache = { at: Date.now(), spent: await publicSpendTodayEur() };
      if (Number.isFinite(cap) && publicCache.spent >= cap) {
        throw new AiBudgetExceededError("El asistente no está disponible ahora mismo. Escríbenos desde el formulario de contacto.");
      }
      return;
    }
    const projectId = explicitProjectId && explicitProjectId > 0 ? explicitProjectId : ctx?.projectId;
    if (!projectId) return;
    const spend = await getProjectAiSpend(projectId);
    // Se aplica a lo que dispara el cliente y a lo que hace el equipo sobre proyectos
    // con cliente de pago. Proyectos internos (sin cliente) solo con AI_BUDGET_ENFORCE_ADMIN=1.
    const enforce = ctx?.actor === "client" || spend?.hasClient || process.env.AI_BUDGET_ENFORCE_ADMIN === "1";
    if (spend && enforce && spend.spentEur >= spend.budgetEur) {
      throw new AiBudgetExceededError(
        `Has usado toda la IA incluida en tu plan este mes (${spend.spentEur.toFixed(2)} € de ${spend.budgetEur.toFixed(2)} €). ` +
        "Se renueva el día 1; si lo necesitas antes, mejora tu plan o compra un pack.",
      );
    }
  } catch (err) {
    if (err instanceof AiBudgetExceededError) throw err;
    // Un fallo de BD no debe tumbar la IA: se registra y se deja pasar.
    logger.warn({ err: String(err) }, "assertAiBudget: no se pudo comprobar el presupuesto");
  }
}

/** Para tests. */
export function _resetAiBudgetCache(): void {
  cache.clear();
  publicCache = null;
}

/** Coste estimado por imagen generada (flux-1.1-pro / recraft-v3 en Replicate: 0,04 $). */
export const IMAGE_UNIT_COST_EUR = 0.037;

export interface ProjectMargin {
  projectId: number;
  name: string;
  plan: string;
  clientEmail: string | null;
  /** Ingreso del mes: plan pagado (anual / 12) + servicios mensuales activos + pagos únicos del mes. */
  revenueEur: number;
  aiSpendEur: number;
  imagesUsed: number;
  imageCostEur: number;
  productsUsed: number;
  budgetEur: number | null;
  marginEur: number;
  marginPct: number | null;
}

/**
 * Margen real del mes por proyecto con cliente: ingreso de su suscripción frente a
 * gasto de IA registrado (api_usage_log) + imágenes generadas × coste unitario.
 */
export async function projectMargins(): Promise<ProjectMargin[]> {
  const r = await db.execute(sql`
    SELECT p.id, p.name, p.plan, COALESCE(p.credits_products, 0)::int AS credits_products,
      COALESCE(p.images_used_this_month, 0)::int AS images_used,
      COALESCE(p.products_used_this_month, 0)::int AS products_used,
      u.email AS client_email,
      s.plan AS sub_plan, s.status AS sub_status, COALESCE(s.billing_interval, 'month') AS sub_interval,
      s.stripe_subscription_id,
      (SELECT COALESCE(SUM(l.cost_eur), 0)::float FROM api_usage_log l
        WHERE l.project_id = p.id AND l.created_at >= date_trunc('month', NOW())) AS ai_spend
    FROM projects p
    JOIN users u ON u.client_id = p.id::text
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE COALESCE(p.plan, '') <> 'admin'
    ORDER BY p.id
  `);
  const out: ProjectMargin[] = [];
  for (const row of r.rows as Array<Record<string, unknown>>) {
    const cat = catalogPlan(String(row.sub_plan ?? ""));
    const paying = cat && row.stripe_subscription_id && ["active", "past_due"].includes(String(row.sub_status));
    const servicesEur = await servicesRevenueEur(Number(row.id));
    const revenueEur = (paying ? (row.sub_interval === "year" ? cat.priceAnnual / 12 : cat.priceMonthly) : 0) + servicesEur;
    const aiSpendEur = Number(row.ai_spend) || 0;
    const imagesUsed = Number(row.images_used) || 0;
    const imageCostEur = imagesUsed * IMAGE_UNIT_COST_EUR;
    const marginEur = revenueEur - aiSpendEur - imageCostEur;
    const budget = planAiBudgetEur(String(row.plan ?? "starter"), Number(row.credits_products) || 0, servicesEur);
    out.push({
      projectId: Number(row.id), name: String(row.name ?? ""), plan: String(row.plan ?? "starter"),
      clientEmail: (row.client_email as string | null) ?? null,
      revenueEur: Math.round(revenueEur * 100) / 100,
      aiSpendEur: Math.round(aiSpendEur * 100) / 100,
      imagesUsed, imageCostEur: Math.round(imageCostEur * 100) / 100,
      productsUsed: Number(row.products_used) || 0,
      budgetEur: Number.isFinite(budget) ? budget : null,
      marginEur: Math.round(marginEur * 100) / 100,
      marginPct: revenueEur > 0 ? Math.round((marginEur / revenueEur) * 1000) / 10 : null,
    });
  }
  return out;
}
