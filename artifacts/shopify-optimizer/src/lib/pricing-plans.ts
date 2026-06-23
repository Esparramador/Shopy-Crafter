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

export const CANONICAL_PLANS: CanonicalPlan[] = [
  {
    id: "emprendedor",
    name: "Emprendedor",
    priceMonthly: 19,
    priceAnnual: 190,
    currency: "€",
    featured: false,
    badge: null,
    features: [
      { text: "5 productos/mes", included: true },
      { text: "10 imágenes IA/mes", included: true },
      { text: "Auditoría de tienda Shopify", included: true },
      { text: "Chatbot IA de atención", included: true },
      { text: "SEO básico automático", included: true },
      { text: "Soporte por email", included: true },
      { text: "A/B Testing", included: false },
      { text: "API Access", included: false },
    ],
    cta: { label: "Empezar →", style: "ghost", href: "#fp-contact" },
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    priceAnnual: 490,
    currency: "€",
    featured: false,
    badge: null,
    features: [
      { text: "15 productos/mes", included: true },
      { text: "45 imágenes IA/mes", included: true },
      { text: "Todos los módulos de IA", included: true },
      { text: "SEO técnico automático", included: true },
      { text: "Pricing dinámico con IA", included: true },
      { text: "Soporte prioritario", included: true },
      { text: "A/B Testing", included: false },
      { text: "API Access", included: false },
    ],
    cta: { label: "Solicitar acceso →", style: "ghost", href: "#fp-contact" },
  },
  {
    id: "agency_pro",
    name: "Growth",
    priceMonthly: 149,
    priceAnnual: 1490,
    currency: "€",
    featured: true,
    badge: "Más popular",
    features: [
      { text: "60 productos/mes", included: true },
      { text: "300 imágenes IA/mes", included: true },
      { text: "Todos los módulos de IA", included: true },
      { text: "A/B Testing (hasta 10 activos)", included: true },
      { text: "Informes Pro mensuales", included: true },
      { text: "Análisis de competidores en vivo", included: true },
      { text: "API Access + Webhooks", included: true },
      { text: "Soporte prioritario 12h", included: true },
    ],
    cta: { label: "Empezar ahora →", style: "gold", href: "#fp-contact" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 399,
    priceAnnual: 3990,
    currency: "€",
    featured: false,
    badge: null,
    features: [
      { text: "200 productos/mes", included: true },
      { text: "1.200 imágenes IA/mes", included: true },
      { text: "A/B Testing ilimitado", included: true },
      { text: "Informes ejecutivos semanales", included: true },
      { text: "White-label & Multi-tienda", included: true },
      { text: "Account Manager dedicado", included: true },
      { text: "API privada + acceso prioritario", included: true },
      { text: "Soporte 24/7 dedicado", included: true },
    ],
    cta: { label: "Hablar con ventas →", style: "ghost", href: "#fp-contact" },
  },
];
