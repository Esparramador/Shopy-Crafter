/**
 * Contenido de la landing. Solo hechos comprobables en el propio producto:
 * conectores que existen, módulos que existen, demos publicadas y la app
 * Android real. Sin métricas de clientes ni porcentajes de resultado.
 */

export const HERO = {
  pill: "Shopify · WooCommerce · PrestaShop · Stripe",
  headline: ["Tu tienda online,", "trabajada con IA", "y por expertos."],
  highlight: "con IA",
  sub: "Conectamos tu tienda por API y aplicamos IA a tu catálogo, tus precios y tus pedidos. Y si necesitas más, diseñamos tu web con 3D y animación y la convertimos en app nativa.",
  trust: ["Conexión nativa por API", "Tú apruebas cada cambio", "Portal privado por cliente", "RGPD"],
  facts: [
    { value: "4", label: "Conectores nativos", sub: "Shopify · WooCommerce · PrestaShop · Stripe" },
    { value: "30", label: "Demos web publicadas", sub: "3D, animación y scroll inmersivo" },
    { value: "Android", label: "App nativa propia", sub: "Capacitor · descargable" },
    { value: "+6.800", label: "Prompts especializados", sub: "Biblioteca propia de IA" },
  ],
};

export interface ServicePillar {
  id: string;
  icon: string;
  title: string;
  text: string;
  items: string[];
  href: string;
  cta: string;
  accent: string;
}

export const SERVICES: ServicePillar[] = [
  {
    id: "tiendas",
    icon: "🛍️",
    title: "Tiendas online con IA",
    text: "Trabajamos sobre los datos reales de tu tienda: cada producto auditado, cada cambio propuesto y medido.",
    items: ["Auditoría por producto", "Rediseño de fichas", "Imágenes de producto IA", "SEO técnico", "Precios con COGS real", "A/B testing (Shopify)", "Inventario y pedidos", "Competencia"],
    href: "/automatizacion-shopify-ia",
    cta: "Automatización de tiendas",
    accent: "var(--l-jade)",
  },
  {
    id: "web",
    icon: "✦",
    title: "Diseño y desarrollo web",
    text: "Webs y landings a medida a partir del ADN de tu marca, con 3D en tiempo real y animación fluida.",
    items: ["ADN de marca", "Three.js y R3F", "GSAP y Lenis", "Landings de venta", "Visores 3D de producto", "Componentes premium"],
    href: "/diseno-web-profesional",
    cta: "Diseño web",
    accent: "var(--l-gold)",
  },
  {
    id: "apps",
    icon: "📱",
    title: "Apps nativas",
    text: "Tu web o tu tienda como app para Android e iOS, desde una sola base de código.",
    items: ["Android e iOS", "Capacitor", "Notificaciones push", "Una sola base de código"],
    href: "/desarrollo-apps-nativas",
    cta: "Apps nativas",
    accent: "var(--l-sky)",
  },
  {
    id: "creatividad",
    icon: "🎬",
    title: "Contenido y creatividad IA",
    text: "Foto y vídeo de producto, anuncios y campañas generados con IA y alineados con tu marca.",
    items: ["Studio foto IA", "Studio vídeo IA", "Anuncios", "Kit de campañas", "Modelos 3D", "Voz IA"],
    href: "/ecommerce-ia-automatizacion",
    cta: "eCommerce con IA",
    accent: "#a78bfa",
  },
];

export interface PlatformCard {
  key: string;
  name: string;
  color: string;
  connection: string;
  capabilities: string[];
  href: string;
}

export const PLATFORMS: PlatformCard[] = [
  {
    key: "shopify", name: "Shopify", color: "#95bf47",
    connection: "API oficial de Shopify",
    capabilities: ["Productos y colecciones", "Temas", "Pedidos e inventario", "SEO y auditoría", "Webhooks de pedidos y reembolsos"],
    href: "/automatizacion-shopify-ia",
  },
  {
    key: "woocommerce", name: "WooCommerce", color: "#96588a",
    connection: "REST API v3 · Consumer Key/Secret",
    capabilities: ["Productos y precios", "Pedidos y clientes", "Cupones", "Inventario", "Informes de ventas"],
    href: "/automatizacion-woocommerce-ia",
  },
  {
    key: "prestashop", name: "PrestaShop", color: "#df0067",
    connection: "Webservice de PrestaShop",
    capabilities: ["Productos y categorías", "SEO por producto", "Pedidos", "Inventario", "Webhooks de pedidos"],
    href: "/automatizacion-prestashop-ia",
  },
  {
    key: "stripe", name: "Stripe", color: "#635bff",
    connection: "Stripe Connect o clave secreta cifrada",
    capabilities: ["Clientes y cobros", "Suscripciones", "Facturas y reembolsos", "Pagos a banco y balance", "Vista en tu portal"],
    href: "/gestion-stripe-ia",
  },
];

export const PROCESS = [
  { num: "01", title: "Conexión", text: "Conectamos tu tienda o tu cuenta Stripe por API. Las credenciales se guardan cifradas (AES-256-GCM)." },
  { num: "02", title: "Auditoría", text: "Puntuamos cada producto en título, descripción, SEO, imágenes y precio, con los problemas concretos de cada ficha." },
  { num: "03", title: "Propuesta y aprobación", text: "Cada cambio llega a tu portal. Lo apruebas o lo rechazas; nada se publica sin tu visto bueno." },
  { num: "04", title: "Ejecución y seguimiento", text: "Aplicamos lo aprobado y registramos a diario tus ingresos y pedidos reales para medir el efecto." },
];

export const PORTAL_FEATURES = [
  { icon: "✅", title: "Aprobaciones", text: "Revisa y decide cada propuesta." },
  { icon: "💬", title: "Mensajes y videollamada", text: "Hablas directamente con tu gestor." },
  { icon: "📈", title: "Informes", text: "Ingresos, pedidos y puntuación de tu catálogo." },
  { icon: "🗂️", title: "Archivos privados", text: "Solo tú ves los archivos de tu proyecto." },
  { icon: "🤖", title: "Asistente IA", text: "Pregunta sobre tu tienda cuando quieras." },
];

/** Demos destacadas en la landing (índices de WEB_DEMOS). */
export const FEATURED_DEMOS = [2, 10, 11, 17, 25, 29];
