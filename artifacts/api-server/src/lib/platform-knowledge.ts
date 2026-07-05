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
    description: "Estudio creativo completo con los mejores modelos de IA del mercado (actualizado Jul 2026):",
    bullets: [
      "Imágenes IA: FLUX, Recraft V4, Ideogram V3, Imagen 4, Gemini. Face swap, inpainting, outpainting, variaciones, upscaling 4K",
      "Video IA: Grok Aurora 1.5 (#1 I2V Arena, timestamp narration [0-4s], 7 refs, audio nativo), Seedance 2.0 (timestamp [0-1.5s] slots, 9 omni-refs), Kling 3.0 Omni (4K, multi-shot 6 escenas), Runway Gen-4.5 (Motion Brush explode views), Hailuo, Veo 3.1. Extensión, video-to-video, edición con IA",
      "Timestamp Scene Builder: construye narración timestamp a timestamp para Seedance ([0-1.5s][1.5-3.5s][3.5-6s][6-8s]) y Grok Aurora ([0-4s][4s transition][4-10s])",
      "Explode View Studio: desensambla/ensambla productos en video — auriculares, zapatillas, smartphones, tech. Templates listos: 💥 Explode View + 🔩 Assembled",
      "Character UGC: DNA Blueprint cross-shot consistency con @imageN refs (Grok), @character1 (Kling), Character Reference (Runway)",
      "Audio IA: ElevenLabs eleven_v3 TTS (74 idiomas), Instant Voice Clone, SFX generation, Dubbing lip-sync. Workflow: audio + video → ffmpeg merge",
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
    name: "EXPLODED VIEW STUDIO (vistas explosionadas de producto — Jul 2026)",
    description: "Crea videos de despiece y ensamblaje de producto con IA — perfecto para marketing técnico y hero shots:",
    bullets: [
      "Deconstrucción en 5 clips: componentes flotan hacia afuera con física precisa — auriculares, zapatillas, smartphone, tech",
      "Ensamblaje reverso (Assembled): partes convergen y encajan con satisfying click motion",
      "MEJORES MODELOS: Google Flow Veo 3 (First/Last Frame — imagen ensamblada+explotada → IA calcula trayecto) · Seedance 2.0 I2V · Kling 3.0 Element Binding · Runway Gen-4.5 Motion Brush",
      "Runway Motion Brush: pinta hasta 5 zonas independientes con dirección X/Y/Z para forzar explosión controlada",
      "Prompts verificados: auriculares (drivers/battery/PCB float) · sneakers (outsole/midsole/carbon plate layers) · smartphone (callout lines holográficas)",
      "Global State DNA: camera+lighting+physics lock cross-clip para consistencia entre los 5 clips de la secuencia",
      "Post-producción: ffmpeg concatenación + zsxkib/mmaudio para SFX reactivos al movimiento de las piezas",
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
      "6 motores intercambiables: Auto, Claude, Gemini, Grok, GPT-4o, NVIDIA NIM",
      "24+ slash-skills especializadas en ventas, soporte y marketing",
      "Conocimiento del catálogo, pedidos, precios y política de la tienda",
      "Se entrena con el contenido real de tu tienda",
    ],
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM — 121 modelos IA de GPU (integrado Jul 2026)",
    description: "Acceso al catálogo completo de 121 modelos de IA de NVIDIA AI Inference Microservices. 9 categorías de uso: texto, código, visión, embedding, seguridad, traducción, creatividad, finanzas e imagen/vídeo.",
    bullets: [
      "TEXTO (36 modelos) — Nemotron Ultra 253B, Nemotron Super 49B, Nemotron 340B; Llama 4 Maverick, Llama 3.3 70B, Llama 3.1 405B; DeepSeek V4 Pro/Flash; Mistral Large 3 675B, Mistral Nemotron; Qwen 3.5 397B MoE; MiniMax M3 (1M ctx); Kimi K2.6; ByteDance Seed 36B; Gemma 4 31B",
      "CÓDIGO (7 modelos) — StarCoder2 15B (80+ lenguajes), Codestral 22B, CodeLlama 70B, DeepSeek Coder 6.7B, Granite 34B Code (IBM), Granite 8B Code, CodeGemma 7B. Endpoint: POST /api/nvidia/code",
      "VISIÓN / MULTIMODAL (10 modelos) — Llama 3.2 Vision 90B, Llama 3.2 Vision 11B, Phi-4 Multimodal, Phi-3 Vision 128K, Kosmos-2 (grounding), NEVA 22B, VILA (vídeo), DiffusionGemma 26B, Nemotron Nano VL 8B. Endpoint: POST /api/nvidia/vision",
      "EMBEDDING (7 modelos) — BGE-M3 (multilingüe, dense+sparse+colbert), NV-Embed v1, NV-EmbedQA Mistral v2, Arctic Embed L, Nemotron Embed 1B. Endpoint: POST /api/nvidia/embed",
      "SEGURIDAD (8 modelos) — Llama Guard 4 12B, NemoGuard Content Safety, NemoGuard Topic Control, GLiNER PII Detector, AI Synthetic Video Detector. Endpoint: POST /api/nvidia/safety",
      "TRADUCCIÓN (2 modelos) — RIVA Translate 4B v1 y v1.1 — traducción profesional en 50+ idiomas. Endpoint: POST /api/nvidia/translate",
      "ESPECIALIZADOS — Palmyra Creative 122B (copywriting premium), Palmyra Finance 70B (Wall Street), Palmyra Medical 70B (HIPAA-aware), ChatQA 1.5 70B (RAG/QA). Endpoints: POST /api/nvidia/creative, /finance",
      "IMAGEN (4 modelos difusión) — FLUX.1 Schnell (4 pasos), FLUX.1 Dev (producción), SDXL Turbo (realtime 1 paso), SD 3.5 Large (tipografía). Endpoint: POST /api/nvidia/generate-image",
      "VÍDEO (2 modelos Cosmos) — Cosmos Predict2 2B (rápido), Cosmos Predict2 14B (máxima calidad) — simulación física real T2V. Endpoint: POST /api/nvidia/generate-video",
      "Slash commands: /nvidia-analiza, /nvidia-copy, /nvidia-seo, /nvidia-email, /nvidia-producto, /nvidia-investiga, /nvidia-imagen, /nvidia-cosmos, /nvidia-codigo, /nvidia-vision, /nvidia-traducir, /nvidia-creativo, /nvidia-finanzas, /nvidia-seguridad",
      "Motor de chat: selecciona NVIDIA en OmniChatbot → elige entre 50+ modelos de texto. Catálogo completo: GET /api/nvidia/catalog",
      "API OpenAI-compatible — NVIDIA_API_KEY pre-integrada. Costes: desde $0.10/M tokens (Nano) hasta $2.00/M (Ultra 550B). Guardado automático en Vault.",
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
    "Sin permanencia — cancela cuando quieras. No hay prueba gratuita: los planes son de pago desde el primer día, pero puedes cancelar en cualquier momento sin penalización.",
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
