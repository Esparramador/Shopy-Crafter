/**
 * platform-knowledge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for all platform-facing knowledge used by chatbots.
 *
 * Add/edit plans here → both the landing chatbot AND ShopyBrain client chatbot
 * automatically pick up the changes on the next request (no restart needed).
 *
 * Add/edit modules here → all chatbot system prompts reflect the change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════════════════════
// PLANS — edit here when prices, limits or features change
// ══════════════════════════════════════════════════════════════════════════════

export interface PlatformPlan {
  id: string;
  name: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  currency: string;
  popular?: boolean;
  productsPerMonth: number | null;
  imagesPerMonth: number | null;
  features: string[];
  note?: string;
}

export const PLATFORM_PLANS: PlatformPlan[] = [
  {
    id: "emprendedor",
    name: "Emprendedor",
    priceMonthly: 19,
    priceAnnual: 190,
    currency: "€",
    productsPerMonth: 5,
    imagesPerMonth: 10,
    features: [
      "5 productos/mes",
      "10 imágenes IA/mes",
      "Auditoría de tienda Shopify",
      "Chatbot IA de atención al cliente",
      "SEO básico automático",
      "Soporte por email",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    priceAnnual: 490,
    currency: "€",
    productsPerMonth: 15,
    imagesPerMonth: 45,
    features: [
      "15 productos/mes",
      "45 imágenes IA/mes",
      "Todos los módulos de IA",
      "SEO técnico automático",
      "Pricing dinámico con IA",
      "Soporte prioritario",
    ],
  },
  {
    id: "agency_pro",
    name: "Growth",
    priceMonthly: 149,
    priceAnnual: 1490,
    currency: "€",
    popular: true,
    productsPerMonth: 60,
    imagesPerMonth: 300,
    features: [
      "60 productos/mes",
      "300 imágenes IA/mes",
      "Todos los módulos de IA",
      "A/B Testing (hasta 10 activos)",
      "Informes Pro mensuales",
      "Análisis de competidores en vivo",
      "API access + webhooks",
      "Soporte prioritario 12h",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 399,
    priceAnnual: 3990,
    currency: "€",
    productsPerMonth: 200,
    imagesPerMonth: 1200,
    features: [
      "200 productos/mes",
      "1.200 imágenes IA/mes",
      "A/B Testing ilimitado",
      "Informes ejecutivos semanales",
      "White-label y multi-tienda",
      "Account Manager dedicado",
      "API privada + acceso prioritario",
      "Soporte 24/7 dedicado",
    ],
  },
  {
    id: "personalizado",
    name: "A medida",
    priceMonthly: null,
    priceAnnual: null,
    currency: "€",
    productsPerMonth: null,
    imagesPerMonth: null,
    features: [
      "Productos y tiendas ilimitadas",
      "Imágenes IA ilimitadas",
      "Integración personalizada",
      "SLA contractual garantizado",
      "Onboarding dedicado",
      "Formación al equipo",
      "Facturación flexible",
      "Acceso prioritario a nuevos motores",
    ],
    note: "Precio personalizado — contactar ventas",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// MODULES — edit here when new modules are added or capabilities change
// ══════════════════════════════════════════════════════════════════════════════

export interface PlatformModule {
  id: string;
  name: string;
  description: string;
  bullets: string[];
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "shopify-optimization",
    name: "OPTIMIZACIÓN SHOPIFY (los motores clásicos)",
    description: "Conectas tu tienda Shopify (OAuth seguro, 5 minutos) y los motores trabajan 24/7:",
    bullets: [
      "Motor SEO: keyword research, títulos, meta descripciones, schemas JSON-LD (Product/FAQ/Review/BreadcrumbList), alt texts, arquitectura URL, internal linking",
      "Motor Pricing: precios de mercado en tiempo real, price anchoring, elasticidad, compare_at_price automático, bundling, psicología de precios",
      "Motor Imágenes IA: fotos de producto profesionales (fondo blanco, lifestyle, banners), optimización de imágenes, alt texts SEO automáticos",
      "Motor Copywriting: descripciones con storytelling, AIDA/PAS, benefits-first, FAQ integrada, keywords long-tail",
      "Motor A/B Testing: tests automáticos de precios, títulos e imágenes para maximizar conversión real",
      "Motor Email Marketing: flujos Klaviyo completos (bienvenida, carrito abandonado, post-compra, winback VIP) con HTML listo para importar",
      "Auditoría completa: score de optimización 0-100 (grado A/B/C/D/F) por producto con recomendaciones priorizadas",
    ],
  },
  {
    id: "lab-web",
    name: "LAB WEB (análisis de rendimiento web)",
    description: "El Lab Web SÍ EXISTE y es una herramienta potente en la plataforma:",
    bullets: [
      "Análisis PageSpeed / Google Lighthouse integrado directamente",
      "Core Web Vitals: LCP, FID, CLS, INP, FCP, TTFB",
      "Diagnósticos con ahorros reales en bytes y milisegundos por problema",
      "Detecta: imágenes sin optimizar, JS bloqueante, CSS no utilizado, redirect chains",
      "Disponible desde el panel de cada proyecto Shopify conectado",
      "Genera recomendaciones accionables priorizadas por impacto",
    ],
  },
  {
    id: "fusion-studio-pro",
    name: "FUSION STUDIO PRO (estudio de IA generativa multimedia)",
    description: "Estudio creativo completo con los mejores modelos de IA del mercado:",
    bullets: [
      "Imágenes IA: genera con FLUX, Recraft, Ideogram, Gemini. Face swap, inpainting, outpainting, variaciones, upscaling",
      "Video IA: Text-to-Video e Image-to-Video con Kling, Seedance, Hailuo, Veo, Runway Gen 4.5. Extensión de video, video-to-video, edición con IA",
      "Audio IA: Text-to-Speech con ElevenLabs (74 idiomas), efectos de sonido, mezcla de audio",
      "Todo desde una sola interfaz integrada en la plataforma",
    ],
  },
  {
    id: "prompt-library",
    name: "LIBRERÍA DE PROMPTS (más de 6.677 templates)",
    description: "La mayor librería de prompts de marketing en español:",
    bullets: [
      "Más de 6.677 templates organizados en 38 categorías",
      "Categorías: copywriting, SEO, email marketing, redes sociales, descripciones de producto, anuncios, scripts de video UGC, estrategia de marca, blog, landing pages...",
      "Modo DNA: conecta tus prompts con el perfil de tu marca y productos reales",
      "Ejecución directa con Claude Sonnet — output listo para usar en segundos",
      "Búsqueda por palabra clave + filtro por categoría",
    ],
  },
  {
    id: "effects-studio",
    name: "EFFECTS STUDIO (efectos y animaciones web)",
    description: "",
    bullets: [
      "30 efectos CSS/JS de animación para páginas web (parallax, glassmorphism, partículas, carousel, etc.)",
      "594 templates Visme listos para personalizar e integrar",
      "Web Designer integrado para aplicar efectos directamente al código de tu tienda",
    ],
  },
  {
    id: "web-designer",
    name: "WEB DESIGNER IA (diseño web con Claude)",
    description: "",
    bullets: [
      "Diseñador web potenciado por Claude AI",
      "26 demos interactivos de referencia incluidos",
      "Genera secciones, landing pages, componentes con HTML/CSS/JS + Liquid para Shopify",
      "Describe lo que necesitas en lenguaje natural y obtienes código real listo para tu tienda",
    ],
  },
  {
    id: "ad-studio",
    name: "AD STUDIO (producción de anuncios con IA)",
    description: "",
    bullets: [
      "Crea anuncios de video con avatares IA y personajes digitales",
      "UGC (User Generated Content) sintético con portavoces de IA",
      "Face swap para videos de producto",
      "Scripts optimizados por plataforma: TikTok (9:16), Meta Reels, YouTube Shorts",
      "Brand DNA integrado para coherencia de marca en todos los anuncios",
    ],
  },
  {
    id: "campaign-kit",
    name: "CAMPAIGN KIT (kit completo de campaña)",
    description: "",
    bullets: [
      "Producción completa de campañas de marketing de principio a fin",
      "Clips UGC, master cut, timeline, overlays de subtítulos",
      "Character locks para coherencia de personaje entre clips",
      "Tech specs por plataforma (resolución, fps, codec, duración máxima)",
      "Plantillas de storyboard y briefing de producción",
    ],
  },
  {
    id: "tripo3d",
    name: "TRIPO3D STUDIO (modelos 3D con IA)",
    description: "",
    bullets: [
      "Genera modelos 3D de producto desde texto o imagen",
      "Exporta en GLB/FBX/OBJ — listo para web, AR o impresión 3D",
      "Retexturizado, rigging, stylize y conversión de formato",
      "Ideal para visualización de producto interactiva en tu tienda",
    ],
  },
  {
    id: "meshy3d",
    name: "MESHY 3D (modelos con animaciones)",
    description: "",
    bullets: [
      "Generación de modelos 3D animados con 134 animaciones disponibles",
      "Catálogo completo: idle, walk, dance, fight, celebrate, correr, saltar...",
      "Avatares 3D de marca con movimiento realista",
      "Exportación GLB lista para integrar en web con Three.js",
    ],
  },
  {
    id: "exploded-view",
    name: "EXPLODED VIEW STUDIO (vistas explosionadas de producto)",
    description: "",
    bullets: [
      "Vistas explosionadas de producto para marketing y presentación",
      "Deconstrucción visual de componentes del producto en 5 clips",
      "Animaciones de ensamblaje para mostrar la calidad del producto",
      "Múltiples plataformas de IA video soportadas",
    ],
  },
  {
    id: "card-studio",
    name: "CARD STUDIO (diseñador de tarjetas de presentación)",
    description: "",
    bullets: [
      "Editor visual de tarjetas de presentación con Fabric.js",
      "12 temas con diseño IA incluidos",
      "Añade formas, emojis, bocadillos, códigos QR",
      "Exporta como imagen o PDF de alta calidad",
    ],
  },
  {
    id: "brand-dna",
    name: "BRAND DNA (extracción del ADN de marca)",
    description: "",
    bullets: [
      "Extrae el perfil completo de tu marca desde tu web (crawler de hasta 25 páginas)",
      "Integra Google Reviews, detección de tech stack, análisis de competidores",
      "Genera: propuesta de valor única, arquetipos de marca, pilares de contenido, handles sociales, taglines",
      "El Brand DNA alimenta automáticamente todos los demás módulos para coherencia de marca total",
    ],
  },
  {
    id: "omnichatbot",
    name: "OMNICHATBOT (chatbot IA para tu tienda)",
    description: "",
    bullets: [
      "Chatbot de atención al cliente para tiendas Shopify",
      "5 motores intercambiables: Auto, Claude, Gemini, Grok, Brain Only",
      "24 slash-skills especializadas en ventas, soporte y marketing",
      "Conocimiento del catálogo, pedidos, precios y política de la tienda",
      "Se entrena con el contenido real de tu tienda",
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// BUILDERS — called at request time so changes are always reflected
// ══════════════════════════════════════════════════════════════════════════════

/** Generates the PLANES Y PRECIOS block for chatbot system prompts. */
export function buildPricingBlock(): string {
  const lines: string[] = [
    "== PLANES Y PRECIOS (NO hay plan gratuito permanente; todos son de pago) ==",
  ];

  for (const plan of PLATFORM_PLANS) {
    const price =
      plan.priceMonthly !== null
        ? `${plan.priceMonthly}${plan.currency}/mes`
        : plan.note ?? "Precio a consultar";
    const label = plan.popular ? `${plan.name} (${price}) — EL MÁS POPULAR` : `${plan.name} (${price})`;
    const featStr = plan.features.join(", ");
    lines.push(`- ${label}: ${featStr}`);
  }

  lines.push(
    "Todos los planes incluyen 14 días de prueba gratuita (no requiere tarjeta de crédito para probar, pero el servicio no es gratuito de forma permanente). Sin permanencia — cancela cuando quieras.",
  );

  return lines.join("\n");
}

/** Generates the full MÓDULOS block for chatbot system prompts. */
export function buildModulesBlock(): string {
  return PLATFORM_MODULES.map((mod, i) => {
    const num = String(i + 1).padStart(2, " ");
    const header = `== MODULO ${num.trim()}: ${mod.name} ==`;
    const desc = mod.description ? `${mod.description}\n` : "";
    const bullets = mod.bullets.map(b => `- ${b}`).join("\n");
    return `${header}\n${desc}${bullets}`;
  }).join("\n\n");
}

/** Returns both modules + pricing as a combined string for system prompts. */
export function buildFullPlatformContext(): string {
  return `${buildModulesBlock()}\n\n${buildPricingBlock()}`;
}

/**
 * Compact version for the client-panel chatbot.
 * Lists module names + key capabilities in one line each, and current plans.
 * Keeps the system prompt short since it already contains live store data.
 */
export function buildClientPlatformContext(): string {
  const moduleLines = PLATFORM_MODULES.map(
    m => `• ${m.name}: ${m.bullets[0]}${m.bullets.length > 1 ? ` (+${m.bullets.length - 1} más)` : ""}`,
  ).join("\n");

  return `== MÓDULOS DISPONIBLES EN SHOPY CRAFTER (para recomendar al cliente) ==
${moduleLines}

${buildPricingBlock()}`;
}
