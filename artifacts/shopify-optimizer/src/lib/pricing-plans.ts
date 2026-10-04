export interface CanonicalPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  featured: boolean;
  badge: string | null;
  features: { text: string; included: boolean }[];
  cta: { label: string; style: string; href: string };
}

/**
 * Respaldo visual si el API no responde. Refleja el catálogo del servidor
 * (artifacts/api-server/src/lib/plan-catalog.ts): mismos precios y cuotas.
 */
const COMMON = [
  "1 tienda conectada: Shopify, WooCommerce o PrestaShop",
  "Auditoría y rediseño de fichas con IA",
  "SEO técnico de producto",
  "Pricing con COGS y análisis de competencia",
  "A/B testing de imagen y precio (tiendas Shopify)",
  "Portal de cliente: aprobaciones, mensajes e informes",
  "Asistente IA de tu tienda",
].map(text => ({ text, included: true }));

function plan(id: string, name: string, priceMonthly: number, products: number, images: number, featured = false, badge: string | null = null): CanonicalPlan {
  return {
    id, name, priceMonthly, priceAnnual: priceMonthly * 10, currency: "€", featured, badge,
    features: [
      { text: `${products.toLocaleString("es-ES")} productos optimizados al mes`, included: true },
      { text: `${images.toLocaleString("es-ES")} imágenes IA al mes`, included: true },
      ...COMMON,
    ],
    cta: { label: "Empezar", style: featured ? "gold" : "ghost", href: "#fp-contact" },
  };
}

export const CANONICAL_PLANS: CanonicalPlan[] = [
  plan("emprendedor", "Emprendedor", 19, 5, 10),
  plan("starter", "Starter", 49, 15, 45),
  plan("agency_pro", "Growth", 149, 60, 300, true, "Recomendado"),
  plan("enterprise", "Enterprise", 399, 200, 1200),
  {
    id: "personalizado", name: "A medida", priceMonthly: 0, priceAnnual: 0, currency: "€", featured: false, badge: null,
    features: [
      { text: "Varias tiendas en una misma cuenta", included: true },
      { text: "Cuotas de productos e imágenes a medida", included: true },
      { text: "Diseño web y apps nativas", included: true },
      { text: "Presupuesto cerrado según alcance", included: true },
    ],
    cta: { label: "Pedir presupuesto", style: "ghost", href: "#fp-contact" },
  },
];
