/**
 * Catálogo único de packs: precio, cuotas que el sistema APLICA de verdad y textos comerciales.
 *
 * Regla: ningún texto de un pack puede prometer algo que el código no haga o que no dependa
 * de este catálogo. Las cuotas mensuales se aplican en:
 *  - productos e imágenes → lib/plan-limits.ts (checkProductionLimit)
 *  - el resto (auditorías SEO, competencia, A/B, blog, facturas, cupones, suscripciones)
 *    → lib/pack-quotas.ts (checkPackQuota), en cada endpoint que hace ese trabajo
 *  - PageSpeed, informes y alertas → lib/pack-monitoring.ts (tareas programadas)
 *
 * Cada cliente elige su plataforma y ve 4 packs:
 *  - Shopify, WooCommerce y PrestaShop comparten packs y precio (mismo trabajo, otro conector).
 *  - Stripe lleva packs propios: el trabajo es de cobros y finanzas, no de catálogo.
 *  - «A medida» (presupuesto) está en las cuatro.
 * Emprendedor queda como plan heredado: no se vende, pero quien lo tiene sigue con sus cuotas.
 *
 * Precios (sin IVA) fijados frente al mercado (oct. 2026): mantenimiento de agencia en España
 * 19–200 €/mes según nivel; planes mensuales de agencia Shopify 500–1.500 €/mes.
 * El anual cobra 10 mensualidades (2 meses gratis).
 *
 * Regla de rentabilidad (plan-catalog.test.ts): cada pack de tienda incluye al menos
 * 3 imágenes por producto y el coste máximo del mes queda por debajo del ingreso.
 */

export type StorePlatform = "shopify" | "woocommerce" | "prestashop";
export type PackPlatform = StorePlatform | "stripe";
export const STORE_PLATFORMS: StorePlatform[] = ["shopify", "woocommerce", "prestashop"];
export const PACK_PLATFORMS: PackPlatform[] = [...STORE_PLATFORMS, "stripe"];

export type CatalogPlanId =
  | "emprendedor" | "starter" | "agency_pro" | "enterprise"
  | "stripe_starter" | "stripe_growth" | "stripe_enterprise";

export type Cadence = "daily" | "weekly" | "biweekly" | "monthly";

/** Cuotas que se cuentan por mes en pack_usage (lib/pack-quotas.ts). */
export type QuotaMetric =
  | "seo_audits" | "competitor_scans" | "ab_tests" | "blog_posts"
  | "stripe_invoices" | "stripe_coupons" | "stripe_subscriptions";

export interface StoreQuotas {
  seoAudits: number;
  /** Análisis de competencia con IA al mes (escaneo, descubrimiento o análisis completo). */
  competitorAnalyses: number;
  /** Tests A/B nuevos al mes (solo tiendas Shopify). */
  abTests: number;
  blogPosts: number;
  pagespeed: { cadence: Cadence; urls: number } | null;
  report: Cadence;
}

export interface StripeQuotas {
  /** Facturas y links de pago que creamos al mes. */
  invoices: number;
  coupons: number;
  /** Altas, cambios y bajas de suscripciones al mes. */
  subscriptionChanges: number;
  report: Cadence;
  /** Conciliación de payouts dentro del informe (null = no incluida). */
  payouts: Cadence | null;
}

interface CatalogPlanBase {
  id: CatalogPlanId;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  summary: string;
  featured: boolean;
  badge: string | null;
  ctaLabel: string;
  sortOrder: number;
  /** false = plan heredado: no se muestra ni se vende; sus cuotas siguen aplicándose. */
  sellable: boolean;
  /** Minutos de videollamada de seguimiento al mes (0 = sin llamada). */
  callMinutes: number;
  /** Plazo de respuesta en el portal, en horas laborables. */
  responseHours: number;
}

export interface StorePlan extends CatalogPlanBase {
  family: "store";
  productsPerMonth: number;
  imagesPerMonth: number;
  quotas: StoreQuotas;
}

export interface StripePlan extends CatalogPlanBase {
  family: "stripe";
  productsPerMonth: 0;
  imagesPerMonth: 0;
  quotas: StripeQuotas;
}

export type CatalogPlan = StorePlan | StripePlan;

export const PLAN_CATALOG: CatalogPlan[] = [
  {
    id: "emprendedor", family: "store", name: "Emprendedor", priceMonthly: 19, priceAnnual: 190,
    productsPerMonth: 5, imagesPerMonth: 15,
    quotas: { seoAudits: 1, competitorAnalyses: 5, abTests: 0, blogPosts: 0, pagespeed: { cadence: "monthly", urls: 1 }, report: "monthly" },
    callMinutes: 0, responseHours: 48,
    summary: "Plan heredado para tiendas pequeñas.",
    featured: false, badge: null, ctaLabel: "Empezar", sortOrder: 0, sellable: false,
  },
  {
    id: "starter", family: "store", name: "Starter", priceMonthly: 49, priceAnnual: 490,
    productsPerMonth: 15, imagesPerMonth: 45,
    quotas: { seoAudits: 1, competitorAnalyses: 10, abTests: 1, blogPosts: 0, pagespeed: { cadence: "monthly", urls: 3 }, report: "monthly" },
    callMinutes: 0, responseHours: 48,
    summary: "Para catálogos que crecen cada mes.",
    featured: false, badge: null, ctaLabel: "Elegir Starter", sortOrder: 1, sellable: true,
  },
  {
    id: "agency_pro", family: "store", name: "Growth", priceMonthly: 149, priceAnnual: 1490,
    productsPerMonth: 60, imagesPerMonth: 300,
    quotas: { seoAudits: 2, competitorAnalyses: 30, abTests: 3, blogPosts: 2, pagespeed: { cadence: "weekly", urls: 10 }, report: "biweekly" },
    callMinutes: 30, responseHours: 24,
    summary: "Para tiendas con rotación de producto constante.",
    featured: true, badge: "Recomendado", ctaLabel: "Elegir Growth", sortOrder: 2, sellable: true,
  },
  {
    id: "enterprise", family: "store", name: "Enterprise", priceMonthly: 399, priceAnnual: 3990,
    productsPerMonth: 200, imagesPerMonth: 1200,
    quotas: { seoAudits: 4, competitorAnalyses: 100, abTests: 8, blogPosts: 6, pagespeed: { cadence: "daily", urls: 25 }, report: "weekly" },
    callMinutes: 60, responseHours: 8,
    summary: "Para catálogos grandes.",
    featured: false, badge: null, ctaLabel: "Elegir Enterprise", sortOrder: 3, sellable: true,
  },
  {
    id: "stripe_starter", family: "stripe", name: "Starter", priceMonthly: 39, priceAnnual: 390,
    productsPerMonth: 0, imagesPerMonth: 0,
    quotas: { invoices: 20, coupons: 2, subscriptionChanges: 0, report: "monthly", payouts: null },
    callMinutes: 0, responseHours: 48,
    summary: "Tus cobros vigilados y un informe al mes.",
    featured: false, badge: null, ctaLabel: "Elegir Starter", sortOrder: 11, sellable: true,
  },
  {
    id: "stripe_growth", family: "stripe", name: "Growth", priceMonthly: 99, priceAnnual: 990,
    productsPerMonth: 0, imagesPerMonth: 0,
    quotas: { invoices: 100, coupons: 10, subscriptionChanges: 50, report: "biweekly", payouts: "monthly" },
    callMinutes: 30, responseHours: 24,
    summary: "Llevamos tu facturación y tus suscripciones.",
    featured: true, badge: "Recomendado", ctaLabel: "Elegir Growth", sortOrder: 12, sellable: true,
  },
  {
    id: "stripe_enterprise", family: "stripe", name: "Enterprise", priceMonthly: 249, priceAnnual: 2490,
    productsPerMonth: 0, imagesPerMonth: 0,
    quotas: { invoices: 400, coupons: 40, subscriptionChanges: 300, report: "weekly", payouts: "weekly" },
    callMinutes: 60, responseHours: 8,
    summary: "Para negocios con mucho volumen de cobros.",
    featured: false, badge: null, ctaLabel: "Elegir Enterprise", sortOrder: 13, sellable: true,
  },
];

/** Packs que se pueden contratar. */
export const SELLABLE_PLANS: CatalogPlan[] = PLAN_CATALOG.filter(p => p.sellable);

/** Lo que incluyen todos los packs de tienda (disponible hoy en la plataforma, sin cuota). */
export const INCLUDED_IN_ALL_PLANS = [
  "1 tienda conectada",
  "Auditoría y rediseño de fichas con IA",
  "SEO técnico de producto",
  "Pricing con COGS",
  "Portal de cliente: aprobaciones, mensajes e informes",
  "Asistente IA de tu tienda",
];

/** Lo que incluyen todos los packs de Stripe. */
export const INCLUDED_IN_STRIPE_PLANS = [
  "1 cuenta de Stripe conectada",
  "Panel de cobros, clientes, suscripciones, facturas y payouts en tu portal",
  "Alertas de pagos fallidos y disputas",
  "Portal de cliente: mensajes e informes",
];

/** Lo propio de cada plataforma de tienda (sin coste extra, en todos sus packs). */
export const PLATFORM_EXTRAS: Record<StorePlatform, string[]> = {
  shopify: ["Tests A/B de imagen y precio", "Secciones de tema", "Avisos de pedidos y reembolsos"],
  woocommerce: ["Cupones, clientes e informes de ventas", "Precios y pedidos sincronizados"],
  prestashop: ["Categorías y SEO por producto", "Avisos de pedidos"],
};

export const PLATFORM_LABELS: Record<PackPlatform, string> = {
  shopify: "Shopify", woocommerce: "WooCommerce", prestashop: "PrestaShop", stripe: "Stripe",
};

/** Periodo de prueba al activar la cuenta. */
export const TRIAL = { days: 14, productsPerMonth: 3, imagesPerMonth: 6 };

/** Cuotas de los proyectos sin pack de pago (prueba). */
export const TRIAL_QUOTAS: Record<QuotaMetric, number> = {
  seo_audits: 1, competitor_scans: 5, ab_tests: 0, blog_posts: 0,
  stripe_invoices: 5, stripe_coupons: 1, stripe_subscriptions: 0,
};

export function catalogPlan(id: string | null | undefined): CatalogPlan | undefined {
  return PLAN_CATALOG.find(p => p.id === id);
}

export function isStorePlan(p: CatalogPlan | undefined): p is StorePlan {
  return p?.family === "store";
}

export function isStripePlan(p: CatalogPlan | undefined): p is StripePlan {
  return p?.family === "stripe";
}

/** Packs contratables de una plataforma, en orden. */
export function plansForPlatform(platform: PackPlatform): CatalogPlan[] {
  const family = platform === "stripe" ? "stripe" : "store";
  return SELLABLE_PLANS.filter(p => p.family === family).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Plataformas en las que se vende un pack. */
export function planPlatforms(p: CatalogPlan): PackPlatform[] {
  return p.family === "stripe" ? ["stripe"] : [...STORE_PLATFORMS];
}

/** Cuota mensual de una métrica para un pack (Infinity = sin tope). */
export function quotaFor(planId: string | null | undefined, metric: QuotaMetric): number {
  if (planId === "admin") return Infinity;
  const p = catalogPlan(planId);
  if (!p) return TRIAL_QUOTAS[metric];
  if (p.family === "store") {
    const q = p.quotas;
    switch (metric) {
      case "seo_audits": return q.seoAudits;
      case "competitor_scans": return q.competitorAnalyses;
      case "ab_tests": return q.abTests;
      case "blog_posts": return q.blogPosts;
      default: return 0;
    }
  }
  const q = p.quotas;
  switch (metric) {
    case "stripe_invoices": return q.invoices;
    case "stripe_coupons": return q.coupons;
    case "stripe_subscriptions": return q.subscriptionChanges;
    default: return 0;
  }
}

const fmt = (n: number) => n.toLocaleString("es-ES");

export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "diario", weekly: "semanal", biweekly: "quincenal", monthly: "mensual",
};
const CADENCE_TITLE: Record<Cadence, string> = {
  daily: "Diario", weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual",
};

/** Lo que incluye un pack al mes, línea a línea (solo hechos que el sistema aplica). */
export function planQuotaLines(p: CatalogPlan): string[] {
  const lines: string[] = [];
  if (p.family === "store") {
    const q = p.quotas;
    lines.push(`${fmt(p.productsPerMonth)} productos optimizados al mes`);
    lines.push(`${fmt(p.imagesPerMonth)} imágenes IA al mes`);
    lines.push(`${q.seoAudits} ${q.seoAudits === 1 ? "auditoría SEO" : "auditorías SEO"} de la tienda al mes`);
    if (q.pagespeed) lines.push(`PageSpeed móvil y escritorio ${CADENCE_LABEL[q.pagespeed.cadence]} de ${q.pagespeed.urls} ${q.pagespeed.urls === 1 ? "página" : "páginas"}, con aviso si baja`);
    lines.push(`Informe de resultados ${CADENCE_LABEL[q.report]} en tu portal`);
    lines.push(`Competencia: ${fmt(q.competitorAnalyses)} análisis con IA al mes y vigilancia diaria de precios`);
    if (q.blogPosts > 0) lines.push(`${q.blogPosts} artículos de blog SEO al mes`);
  } else {
    const q = p.quotas;
    lines.push(`Informe financiero ${CADENCE_LABEL[q.report]}: cobros, ingresos recurrentes, reembolsos y comisiones`);
    if (q.payouts) lines.push(`Conciliación ${CADENCE_LABEL[q.payouts]} de payouts con tu banco`);
    lines.push(`${fmt(q.invoices)} facturas o links de pago que creamos por ti al mes`);
    lines.push(`${fmt(q.coupons)} cupones o códigos promocionales al mes`);
    if (q.subscriptionChanges > 0) lines.push(`${fmt(q.subscriptionChanges)} altas, cambios o bajas de suscripciones al mes`);
  }
  if (p.callMinutes > 0) lines.push(`Videollamada de seguimiento de ${p.callMinutes} min al mes`);
  lines.push(`Respuesta en el portal en ${p.responseHours} h laborables`);
  return lines;
}

/** Tests A/B del pack (solo se muestran en el pack de Shopify). */
export function abTestLine(p: CatalogPlan): string | null {
  return p.family === "store" && p.quotas.abTests > 0
    ? `${p.quotas.abTests} ${p.quotas.abTests === 1 ? "test A/B" : "tests A/B"} de imagen o precio al mes`
    : null;
}

/** Lista de características de un pack: sus cuotas + lo común de su familia. Solo hechos. */
export function planFeatures(p: CatalogPlan): { text: string; included: boolean }[] {
  const common = p.family === "stripe" ? INCLUDED_IN_STRIPE_PLANS : INCLUDED_IN_ALL_PLANS;
  return [...planQuotaLines(p), ...common].map(text => ({ text, included: true }));
}

export { CADENCE_TITLE };
