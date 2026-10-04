/**
 * Catálogo único de planes: precio, cuotas que el sistema APLICA de verdad
 * (lib/plan-limits.ts → checkProductionLimit) y textos comerciales.
 *
 * Regla: ningún texto de un plan puede prometer algo que el código no haga o
 * que no dependa de este catálogo. Las cuotas mensuales son lo único que
 * diferencia un plan de otro; los módulos están disponibles en todos.
 *
 * Precios (sin IVA) fijados frente al mercado (sept. 2026):
 *  - Herramientas sueltas que cubren una parte: Plug in SEO 29,99–99,99 $/mes,
 *    Pebblely 19–39 $/mes, Photoroom Pro 12,99 $/mes, Prisync desde 99 $/mes,
 *    Intelligems desde 79 $/mes (precio desde 499 $), Hypotenuse e-commerce desde 150 $/mes.
 *  - Agencias en España: mantenimiento 57–199 €/mes; SEO e-commerce 800–3.000 €/mes.
 *  - Coste de IA propio: ~0,04 $ por imagen (flux-1.1-pro) + céntimos de texto por producto.
 * El anual cobra 10 mensualidades (2 meses gratis).
 */

export type CatalogPlanId = "emprendedor" | "starter" | "agency_pro" | "enterprise";

export interface CatalogPlan {
  id: CatalogPlanId;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  productsPerMonth: number;
  imagesPerMonth: number;
  summary: string;
  featured: boolean;
  badge: string | null;
  ctaLabel: string;
  sortOrder: number;
}

export const PLAN_CATALOG: CatalogPlan[] = [
  {
    id: "emprendedor", name: "Emprendedor", priceMonthly: 19, priceAnnual: 190,
    productsPerMonth: 5, imagesPerMonth: 10,
    summary: "Para empezar con una tienda pequeña.",
    featured: false, badge: null, ctaLabel: "Empezar", sortOrder: 0,
  },
  {
    id: "starter", name: "Starter", priceMonthly: 49, priceAnnual: 490,
    productsPerMonth: 15, imagesPerMonth: 45,
    summary: "Para catálogos que crecen cada mes.",
    featured: false, badge: null, ctaLabel: "Elegir Starter", sortOrder: 1,
  },
  {
    id: "agency_pro", name: "Growth", priceMonthly: 149, priceAnnual: 1490,
    productsPerMonth: 60, imagesPerMonth: 300,
    summary: "Para tiendas con rotación de producto constante.",
    featured: true, badge: "Recomendado", ctaLabel: "Elegir Growth", sortOrder: 2,
  },
  {
    id: "enterprise", name: "Enterprise", priceMonthly: 399, priceAnnual: 3990,
    productsPerMonth: 200, imagesPerMonth: 1200,
    summary: "Para catálogos grandes.",
    featured: false, badge: null, ctaLabel: "Elegir Enterprise", sortOrder: 3,
  },
];

/** Lo que incluyen todos los planes (disponible hoy en la plataforma, sin límite por plan). */
export const INCLUDED_IN_ALL_PLANS = [
  "1 tienda conectada: Shopify, WooCommerce o PrestaShop",
  "Auditoría y rediseño de fichas con IA",
  "SEO técnico de producto",
  "Pricing con COGS y análisis de competencia",
  "A/B testing de imagen y precio (tiendas Shopify)",
  "Portal de cliente: aprobaciones, mensajes e informes",
  "Asistente IA de tu tienda",
];

/** Periodo de prueba al activar la cuenta. */
export const TRIAL = { days: 14, productsPerMonth: 3, imagesPerMonth: 6 };

export function catalogPlan(id: string | null | undefined): CatalogPlan | undefined {
  return PLAN_CATALOG.find(p => p.id === id);
}

const fmt = (n: number) => n.toLocaleString("es-ES");

/** Lista de características de un plan: sus cuotas + lo común. Solo hechos. */
export function planFeatures(p: CatalogPlan): { text: string; included: boolean }[] {
  return [
    { text: `${fmt(p.productsPerMonth)} productos optimizados al mes`, included: true },
    { text: `${fmt(p.imagesPerMonth)} imágenes IA al mes`, included: true },
    ...INCLUDED_IN_ALL_PLANS.map(text => ({ text, included: true })),
  ];
}
