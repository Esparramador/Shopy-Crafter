/**
 * Servicios contratables desde el portal de cliente (tienda_services).
 * Precios sin IVA. Referencias de mercado (sept. 2026): mantenimiento de tienda
 * en agencia 57–199 €/mes; SEO e-commerce en agencia 800–3.000 €/mes; auditorías
 * y puestas en marcha de agencia desde ~150–300 €. Cada entregable descrito aquí
 * es un compromiso de servicio: solo lo que el equipo entrega con la plataforma.
 */
export type ServiceInterval = "one_time" | "month" | "quote";

export interface CatalogService {
  key: string;
  name: string;
  shortDesc: string;
  description: string;
  icon: string;
  priceEur: number | null;
  interval: ServiceInterval;
  features: string[];
  ctaLabel: string;
  badge: string | null;
  color: "gold" | "jade";
  sortOrder: number;
}

export const SERVICE_CATALOG: CatalogService[] = [
  {
    key: "auditoria", name: "Auditoría completa de tienda", icon: "🔍",
    shortDesc: "Diagnóstico de todo tu catálogo",
    description: "Auditamos todos los productos de tu tienda con la plataforma y te entregamos las prioridades de mejora.",
    priceEur: 149, interval: "one_time",
    features: [
      "Puntuación de cada producto: título, descripción, SEO, imágenes y precio",
      "Lista de problemas concretos por ficha",
      "Comparativa con competidores de tu nicho",
      "Informe en tu portal",
      "Revisión de resultados por videollamada (30 min)",
    ],
    ctaLabel: "Contratar auditoría", badge: null, color: "gold", sortOrder: 0,
  },
  {
    key: "puesta-en-marcha", name: "Puesta en marcha", icon: "⚡",
    shortDesc: "Tu tienda conectada y lista",
    description: "Conectamos tu tienda, hacemos la auditoría inicial y configuramos el ADN visual de tu marca.",
    priceEur: 249, interval: "one_time",
    features: [
      "Conexión de Shopify, WooCommerce o PrestaShop",
      "Auditoría inicial del catálogo",
      "ADN visual de tu marca para las imágenes IA",
      "Formación por videollamada (1 h)",
    ],
    ctaLabel: "Contratar puesta en marcha", badge: null, color: "jade", sortOrder: 1,
  },
  {
    key: "pack-imagenes", name: "Pack 100 imágenes de producto", icon: "🖼️",
    shortDesc: "Fotos de producto con IA, hechas por nosotros",
    description: "Generamos 100 imágenes de producto con IA siguiendo el estilo de tu marca y te las entregamos en tu portal.",
    priceEur: 149, interval: "one_time",
    features: [
      "100 imágenes de producto con IA",
      "Fondos limpios y escenas lifestyle",
      "Estilo según el ADN visual de tu marca",
      "Entrega en el repositorio de tu proyecto",
    ],
    ctaLabel: "Comprar pack", badge: null, color: "gold", sortOrder: 2,
  },
  {
    key: "seo-mensual", name: "SEO de catálogo mensual", icon: "📈",
    shortDesc: "Tus fichas optimizadas cada mes",
    description: "Cada mes optimizamos fichas de tu catálogo para buscadores y te enviamos el informe.",
    priceEur: 190, interval: "month",
    features: [
      "Hasta 30 fichas optimizadas al mes (título, descripción y metadatos)",
      "Prioridad según la auditoría de tu tienda",
      "Cada cambio pasa por tus aprobaciones",
      "Informe mensual en tu portal",
      "Sin permanencia",
    ],
    ctaLabel: "Suscribirme", badge: null, color: "jade", sortOrder: 3,
  },
  {
    key: "gestion-mensual", name: "Gestión mensual de tienda", icon: "🤖",
    shortDesc: "Nuestro equipo trabaja tu tienda cada mes",
    description: "Nos ocupamos cada mes de tu catálogo: fichas, imágenes, precios y competencia, con informe y reunión.",
    priceEur: 490, interval: "month",
    features: [
      "Hasta 60 productos al mes: fichas e imágenes IA",
      "Revisión mensual de precios con COGS y competencia",
      "Informe mensual y reunión de 30 min",
      "Mensajes directos con tu gestor en el portal",
      "Sin permanencia",
    ],
    ctaLabel: "Suscribirme", badge: "Recomendado", color: "gold", sortOrder: 4,
  },
  {
    key: "web-app", name: "Web o app a medida", icon: "📱",
    shortDesc: "Diseño web 3D y apps nativas",
    description: "Diseñamos tu web o landing con 3D y animación, o convertimos tu tienda en app para Android e iOS.",
    priceEur: null, interval: "quote",
    features: [
      "Diseño a partir del ADN de tu marca",
      "3D, animación y scroll inmersivo",
      "Apps Android e iOS con una sola base de código",
      "Presupuesto cerrado antes de empezar",
    ],
    ctaLabel: "Pedir presupuesto", badge: null, color: "jade", sortOrder: 5,
  },
];

export function priceDisplay(price: number | null, interval: ServiceInterval): string {
  if (price === null || interval === "quote") return "Presupuesto a medida";
  const n = price.toLocaleString("es-ES");
  return interval === "month" ? `${n} €/mes + IVA` : `${n} € + IVA`;
}

/** Nombres de los servicios sembrados en la versión anterior (con promesas no cumplibles). */
export const LEGACY_SEEDED_SERVICE_NAMES = [
  "Auditoría Completa IA", "Setup Express 48h", "Pack 100 Imágenes IA",
  "SEO Técnico Full Pack", "A/B Testing Pro", "Gestión Mensual IA",
];
