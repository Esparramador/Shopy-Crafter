/**
 * Skills Library — 100+ reusable design/content/seo/commerce skills
 * Cada skill tiene un prompt_template con {{VARIABLES}} para resolución via Brand DNA.
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: "design" | "content" | "seo" | "social" | "email" | "video" | "analytics" | "commerce" | "3d" | "code";
  icon: string;
  promptTemplate: string;
  variables: string[];
  tags: string[];
  outputType: "text" | "html" | "json" | "code" | "markdown";
  preferredModel?: string;
  estimatedTokens: number;
  isPremium: boolean;
}

export const SKILLS_LIBRARY: Skill[] = [

  // ────────────────────────────────────────────────────────────────────────────
  // DESIGN (15 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "design-hero-section",
    name: "Hero Section Perfecto",
    description: "Genera código HTML/CSS para una sección hero con impacto máximo, animaciones y CTA optimizado.",
    category: "design",
    icon: "🦸",
    promptTemplate: `Genera una hero section HTML completa para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Propuesta de valor: {{UVP}}.
Paleta: primario {{PRIMARY_COLOR}}, fondo oscuro.
Incluye: headline poderoso, subheadline, CTA doble, imagen/video background con overlay, animación de entrada con GSAP.
Output: HTML + CSS inline + JS de animación. Sin dependencias externas salvo CDN GSAP.`,
    variables: ["BRAND_NAME", "SECTOR", "UVP", "PRIMARY_COLOR"],
    tags: ["hero", "landing", "conversion", "animation"],
    outputType: "html",
    preferredModel: "claude-sonnet",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "design-product-card",
    name: "Product Card Premium",
    description: "Tarjeta de producto con hover 3D, badge de oferta, rating y botón de compra animado.",
    category: "design",
    icon: "🃏",
    promptTemplate: `Crea una product card HTML premium para {{BRAND_NAME}} ({{SECTOR}}).
Nombre producto: {{PRODUCT_NAME}}. Precio: {{PRICE}}.
Estilo: {{DESIGN_STYLE}}. Color primario: {{PRIMARY_COLOR}}.
Incluye: hover 3D transform, badge "{{BADGE_TEXT}}", rating stars, add-to-cart animado, skeleton loading state.
Output: HTML + CSS (variables CSS) + JS micro-interactions.`,
    variables: ["BRAND_NAME", "SECTOR", "PRODUCT_NAME", "PRICE", "DESIGN_STYLE", "PRIMARY_COLOR", "BADGE_TEXT"],
    tags: ["product", "card", "ecommerce", "hover"],
    outputType: "html",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "design-feature-grid",
    name: "Feature Grid con Iconos",
    description: "Grid de características con iconos SVG animados, descripciones y stats impresionantes.",
    category: "design",
    icon: "⚡",
    promptTemplate: `Diseña un feature grid HTML para {{BRAND_NAME}}.
Features clave: {{FEATURES_LIST}}.
Estilo: {{DESIGN_STYLE}}. Colores: {{PRIMARY_COLOR}}, {{SECONDARY_COLOR}}.
Incluye: iconos SVG inline únicos, contadores animados para stats, hover cards con depth, responsive grid (1→2→3 col).
Output: HTML semántico + CSS Grid + Intersection Observer JS.`,
    variables: ["BRAND_NAME", "FEATURES_LIST", "DESIGN_STYLE", "PRIMARY_COLOR", "SECONDARY_COLOR"],
    tags: ["features", "grid", "icons", "stats"],
    outputType: "html",
    estimatedTokens: 2200,
    isPremium: false,
  },
  {
    id: "design-testimonials",
    name: "Sección de Testimonios",
    description: "Carrusel de testimonios con avatares, ratings, logos de empresa y animación fluida.",
    category: "design",
    icon: "💬",
    promptTemplate: `Crea una sección de testimonios HTML para {{BRAND_NAME}}.
Genera 6 testimonios ficticios realistas de clientes en el sector {{SECTOR}}.
Estilo: {{DESIGN_STYLE}}. Color: {{PRIMARY_COLOR}}.
Incluye: carrusel auto-play con pausa en hover, avatares generados con iniciales coloridas, rating 5⭐, empresa y cargo, animación fade/slide.`,
    variables: ["BRAND_NAME", "SECTOR", "DESIGN_STYLE", "PRIMARY_COLOR"],
    tags: ["testimonials", "social-proof", "carousel"],
    outputType: "html",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "design-pricing-table",
    name: "Tabla de Precios SaaS",
    description: "Tabla de precios con toggle mensual/anual, badges, feature lists y CTA destacado.",
    category: "design",
    icon: "💰",
    promptTemplate: `Diseña una tabla de precios HTML para {{BRAND_NAME}}.
Planes: {{PLANS_INFO}}.
Estilo: {{DESIGN_STYLE}}. Colores: {{PRIMARY_COLOR}}, {{ACCENT_COLOR}}.
Incluye: toggle mensual/anual con descuento animado, plan destacado con glow, tooltips en features, CTA diferenciados, badge "Más popular".`,
    variables: ["BRAND_NAME", "PLANS_INFO", "DESIGN_STYLE", "PRIMARY_COLOR", "ACCENT_COLOR"],
    tags: ["pricing", "saas", "conversion", "toggle"],
    outputType: "html",
    estimatedTokens: 2800,
    isPremium: false,
  },
  {
    id: "design-navbar",
    name: "Navbar Sticky Premium",
    description: "Barra de navegación sticky con blur, mega-menu, notificaciones y dark/light toggle.",
    category: "design",
    icon: "🧭",
    promptTemplate: `Crea una navbar HTML completa para {{BRAND_NAME}}.
Secciones: {{NAV_ITEMS}}.
Logo: {{LOGO_TEXT}}. Color primario: {{PRIMARY_COLOR}}.
Incluye: glassmorphism blur al hacer scroll, mega-menu animado, hamburger mobile con transform, CTA "{{CTA_TEXT}}" destacado, smooth scroll, active state detection.`,
    variables: ["BRAND_NAME", "NAV_ITEMS", "LOGO_TEXT", "PRIMARY_COLOR", "CTA_TEXT"],
    tags: ["navbar", "navigation", "sticky", "responsive"],
    outputType: "html",
    estimatedTokens: 2200,
    isPremium: false,
  },
  {
    id: "design-footer",
    name: "Footer Completo Corporativo",
    description: "Footer con newsletter, links organizados, redes sociales animadas y legales.",
    category: "design",
    icon: "🏗️",
    promptTemplate: `Diseña un footer HTML completo para {{BRAND_NAME}}.
Categorías de links: {{FOOTER_SECTIONS}}.
Email: {{CONTACT_EMAIL}}. Redes: {{SOCIAL_NETWORKS}}.
Estilo: {{DESIGN_STYLE}}. Color: {{PRIMARY_COLOR}}.
Incluye: newsletter con validación, links organizados en grid, íconos redes sociales SVG con hover color, mapa mini o dirección, copyright dinámico con año JS.`,
    variables: ["BRAND_NAME", "FOOTER_SECTIONS", "CONTACT_EMAIL", "SOCIAL_NETWORKS", "DESIGN_STYLE", "PRIMARY_COLOR"],
    tags: ["footer", "newsletter", "social", "links"],
    outputType: "html",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "design-modal",
    name: "Modal de Conversión",
    description: "Modal con overlay, animación de entrada, formulario y gestión de estado.",
    category: "design",
    icon: "🪟",
    promptTemplate: `Crea un modal de conversión HTML para {{BRAND_NAME}}.
Objetivo: {{MODAL_GOAL}}. CTA: {{CTA_TEXT}}.
Estilo: {{DESIGN_STYLE}}. Color: {{PRIMARY_COLOR}}.
Incluye: overlay blur animado, entrada scale+fade, formulario con validación real-time, botón submit con loading state, cierre con Escape, focus trap accesible.`,
    variables: ["BRAND_NAME", "MODAL_GOAL", "CTA_TEXT", "DESIGN_STYLE", "PRIMARY_COLOR"],
    tags: ["modal", "conversion", "form", "accessibility"],
    outputType: "html",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "design-dashboard",
    name: "Dashboard Analytics",
    description: "Panel de analytics con KPIs, gráficos Chart.js, tabla de datos y filtros.",
    category: "design",
    icon: "📊",
    promptTemplate: `Diseña un dashboard analytics HTML para {{BRAND_NAME}}.
KPIs a mostrar: {{KPIS_LIST}}.
Estilo: dark theme. Color primario: {{PRIMARY_COLOR}}.
Incluye: KPI cards con tendencia (↑↓), gráfico de líneas Chart.js con datos simulados, tabla de datos con sorting, filtros de fecha, skeleton loading, responsive sidebar.
Usa Chart.js CDN. Datos simulados realistas para {{SECTOR}}.`,
    variables: ["BRAND_NAME", "KPIS_LIST", "PRIMARY_COLOR", "SECTOR"],
    tags: ["dashboard", "analytics", "charts", "kpi"],
    outputType: "html",
    preferredModel: "claude-sonnet",
    estimatedTokens: 3500,
    isPremium: true,
  },
  {
    id: "design-cta-section",
    name: "CTA Sección Impacto",
    description: "Sección Call-to-Action con gradiente, contador urgencia, y botones A/B.",
    category: "design",
    icon: "🎯",
    promptTemplate: `Crea una sección CTA de alto impacto para {{BRAND_NAME}}.
Oferta: {{OFFER_TEXT}}. Urgencia: {{URGENCY_TEXT}}.
Color primario: {{PRIMARY_COLOR}}. Estilo: {{DESIGN_STYLE}}.
Incluye: gradiente dramático background, headline con efecto typewriter, contador regresivo en JS, dos variantes de botón CTA con tracking GA4 simulado, partículas o confetti al hacer click.`,
    variables: ["BRAND_NAME", "OFFER_TEXT", "URGENCY_TEXT", "PRIMARY_COLOR", "DESIGN_STYLE"],
    tags: ["cta", "urgency", "conversion", "countdown"],
    outputType: "html",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "design-404-page",
    name: "Página 404 Creativa",
    description: "Página 404 con ilustración animada, mensaje de marca y links de recuperación.",
    category: "design",
    icon: "🔍",
    promptTemplate: `Diseña una página 404 creativa para {{BRAND_NAME}} ({{SECTOR}}).
Voz de marca: {{BRAND_VOICE}}. Color primario: {{PRIMARY_COLOR}}.
Incluye: ilustración SVG animada (personaje o escena relacionada con la marca), mensaje de error en tono de marca, barra de búsqueda, links a páginas populares, animación CSS sin frameworks.`,
    variables: ["BRAND_NAME", "SECTOR", "BRAND_VOICE", "PRIMARY_COLOR"],
    tags: ["404", "error", "creative", "illustration"],
    outputType: "html",
    estimatedTokens: 2200,
    isPremium: false,
  },
  {
    id: "design-form-checkout",
    name: "Formulario Checkout",
    description: "Formulario de pago en pasos con validación, resumen de pedido y progress bar.",
    category: "design",
    icon: "💳",
    promptTemplate: `Crea un formulario de checkout multi-step HTML para {{BRAND_NAME}}.
Pasos: dirección → pago → confirmación. Moneda: {{CURRENCY}}.
Color primario: {{PRIMARY_COLOR}}. Estilo: {{DESIGN_STYLE}}.
Incluye: progress bar animado, validación en tiempo real, formato de tarjeta auto, resumen de pedido sticky, animación entre pasos, estado de éxito con confetti.`,
    variables: ["BRAND_NAME", "CURRENCY", "PRIMARY_COLOR", "DESIGN_STYLE"],
    tags: ["checkout", "form", "payment", "multi-step"],
    outputType: "html",
    estimatedTokens: 3000,
    isPremium: true,
  },
  {
    id: "design-notification-system",
    name: "Sistema de Notificaciones",
    description: "Toast notifications con tipos (success/error/warning/info), animaciones y stack.",
    category: "design",
    icon: "🔔",
    promptTemplate: `Crea un sistema de notificaciones toast HTML/JS para {{BRAND_NAME}}.
Color primario: {{PRIMARY_COLOR}}. Posición: top-right.
Incluye: 4 tipos (success✅, error❌, warning⚠️, info ℹ️), animación slide-in/out, auto-dismiss configurable, stack máximo 5, botón cerrar manual, progress bar de tiempo restante.
Output: HTML demo + CSS + JS sistema completo reutilizable.`,
    variables: ["BRAND_NAME", "PRIMARY_COLOR"],
    tags: ["toast", "notifications", "ui", "feedback"],
    outputType: "html",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "design-image-gallery",
    name: "Galería de Imágenes Masonry",
    description: "Galería masonry con lightbox, filtros por categoría y lazy loading.",
    category: "design",
    icon: "🖼️",
    promptTemplate: `Diseña una galería de imágenes masonry HTML para {{BRAND_NAME}}.
Categorías: {{GALLERY_CATEGORIES}}.
Color primario: {{PRIMARY_COLOR}}. Estilo: {{DESIGN_STYLE}}.
Incluye: layout masonry CSS puro, filtros animados isotope-like, lightbox con navegación teclado, lazy loading con blur-up, zoom hover suave, download button. Usa placeholder.com para imágenes demo.`,
    variables: ["BRAND_NAME", "GALLERY_CATEGORIES", "PRIMARY_COLOR", "DESIGN_STYLE"],
    tags: ["gallery", "masonry", "lightbox", "images"],
    outputType: "html",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "design-landing-complete",
    name: "Landing Page Completa",
    description: "Landing page completa con todas las secciones: hero, features, testimonios, precios y footer.",
    category: "design",
    icon: "🚀",
    promptTemplate: `Genera una landing page completa y profesional para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Propuesta de valor: {{UVP}}.
Colores: primario {{PRIMARY_COLOR}}, secundario {{SECONDARY_COLOR}}.
Tipografía: {{FONT_HEADING}} para títulos, {{FONT_BODY}} para cuerpo.
Voz: {{BRAND_VOICE}}.
Incluye todas las secciones: navbar sticky, hero con video bg, social proof, features 3-col, how-it-works, testimonios, precios, FAQ, CTA final, footer.
Stack: HTML + CSS (variables) + GSAP para animaciones + ScrollTrigger. Sin frameworks externos salvo CDN GSAP.`,
    variables: ["BRAND_NAME", "SECTOR", "UVP", "PRIMARY_COLOR", "SECONDARY_COLOR", "FONT_HEADING", "FONT_BODY", "BRAND_VOICE"],
    tags: ["landing", "complete", "full-page", "conversion"],
    outputType: "html",
    preferredModel: "claude-opus",
    estimatedTokens: 6000,
    isPremium: true,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CONTENT (15 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "content-product-description",
    name: "Descripción de Producto SEO",
    description: "Descripción de producto optimizada para SEO y conversión con estructura PAS/AIDA.",
    category: "content",
    icon: "📝",
    promptTemplate: `Escribe una descripción de producto optimizada para SEO y conversión.
Marca: {{BRAND_NAME}}. Producto: {{PRODUCT_NAME}}.
Sector: {{SECTOR}}. Voz de marca: {{BRAND_VOICE}}.
Keyword principal: {{MAIN_KEYWORD}}.
Estructura: headline (<h1>), párrafo gancho 2-3 frases (beneficio clave), características con bullets (<ul>), especificaciones técnicas, FAQs 3 preguntas, CTA.
Longitud: 300-500 palabras. Incluir keyword natural 3-4 veces. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "SECTOR", "BRAND_VOICE", "MAIN_KEYWORD", "LANGUAGE"],
    tags: ["product", "description", "seo", "copywriting"],
    outputType: "markdown",
    estimatedTokens: 800,
    isPremium: false,
  },
  {
    id: "content-blog-post",
    name: "Blog Post Completo",
    description: "Artículo de blog SEO-optimizado con estructura H1-H3, intro gancho y conclusión CTA.",
    category: "content",
    icon: "✍️",
    promptTemplate: `Escribe un blog post completo y optimizado para SEO.
Marca: {{BRAND_NAME}}. Sector: {{SECTOR}}.
Tema: {{BLOG_TOPIC}}. Keyword principal: {{MAIN_KEYWORD}}.
Keywords secundarias: {{SECONDARY_KEYWORDS}}.
Audiencia: {{TARGET_AUDIENCE}}. Voz: {{BRAND_VOICE}}.
Estructura: título SEO (<h1>), intro con gancho estadística/pregunta, 5-7 secciones H2 con contenido sustancial, conclusión + CTA, meta description 155 chars.
Longitud: 1200-1800 palabras. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BLOG_TOPIC", "MAIN_KEYWORD", "SECONDARY_KEYWORDS", "TARGET_AUDIENCE", "BRAND_VOICE", "LANGUAGE"],
    tags: ["blog", "seo", "content-marketing", "article"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "content-brand-story",
    name: "Historia de Marca",
    description: "Narrativa de marca auténtica que conecta emocionalmente con el cliente ideal.",
    category: "content",
    icon: "📖",
    promptTemplate: `Escribe la historia de marca de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Fundación: {{FOUNDED_YEAR}}.
Misión: {{BRAND_MISSION}}. Valores: {{BRAND_VALUES}}.
Audiencia objetivo: {{TARGET_AUDIENCE}}. Voz: {{BRAND_VOICE}}.
Estructura: el problema que viste, el momento "aha", la solución que creaste, el impacto hasta hoy, la visión del futuro.
Tono: auténtico, humano, inspirador. Sin corporativismo. 300-400 palabras. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "FOUNDED_YEAR", "BRAND_MISSION", "BRAND_VALUES", "TARGET_AUDIENCE", "BRAND_VOICE", "LANGUAGE"],
    tags: ["brand-story", "narrative", "about-us", "authentic"],
    outputType: "markdown",
    estimatedTokens: 700,
    isPremium: false,
  },
  {
    id: "content-usp-variants",
    name: "Variantes de USP",
    description: "10 variantes de propuesta de valor única para tests A/B en headlines y taglines.",
    category: "content",
    icon: "💡",
    promptTemplate: `Genera 10 variantes de USP (Unique Selling Proposition) para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Producto/servicio: {{PRODUCT_SERVICE}}.
Beneficio clave: {{KEY_BENEFIT}}. Audiencia: {{TARGET_AUDIENCE}}.
Competencia: {{MAIN_COMPETITOR}}.
Para cada variante: tagline corto (máx 10 palabras) + versión expandida (1-2 frases).
Formatos: emocional, racional, urgencia, social proof, FOMO, sorpresa, humor, autoridad, transformación, negación.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "PRODUCT_SERVICE", "KEY_BENEFIT", "TARGET_AUDIENCE", "MAIN_COMPETITOR", "LANGUAGE"],
    tags: ["usp", "tagline", "headline", "a/b-testing"],
    outputType: "markdown",
    estimatedTokens: 900,
    isPremium: false,
  },
  {
    id: "content-faq",
    name: "FAQ Completo SEO",
    description: "Preguntas frecuentes optimizadas para featured snippets y schema FAQ.",
    category: "content",
    icon: "❓",
    promptTemplate: `Genera un FAQ completo y optimizado para SEO de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Producto: {{PRODUCT_NAME}}.
Keyword principal: {{MAIN_KEYWORD}}.
Genera 15 preguntas reales que hace la gente en Google + respuestas completas (100-150 palabras).
Incluye schema FAQ markup JSON-LD al final.
Cubre: dudas pre-compra, post-compra, técnicas, políticas y comparativas con competencia.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "PRODUCT_NAME", "MAIN_KEYWORD", "LANGUAGE"],
    tags: ["faq", "schema", "featured-snippet", "seo"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "content-case-study",
    name: "Caso de Éxito",
    description: "Case study con métricas reales, estructura problema-solución-resultado.",
    category: "content",
    icon: "🏆",
    promptTemplate: `Escribe un caso de éxito para {{BRAND_NAME}}.
Cliente: {{CLIENT_NAME}}. Sector cliente: {{CLIENT_SECTOR}}.
Problema inicial: {{PROBLEM_DESCRIPTION}}.
Solución aplicada: {{SOLUTION_APPLIED}}.
Resultados: {{RESULTS_METRICS}}.
Estructura: resumen ejecutivo, contexto del cliente, desafíos, la solución, resultados con métricas, cita del cliente, próximos pasos.
Tono: profesional, basado en datos, convincente. 600-800 palabras. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "CLIENT_NAME", "CLIENT_SECTOR", "PROBLEM_DESCRIPTION", "SOLUTION_APPLIED", "RESULTS_METRICS", "LANGUAGE"],
    tags: ["case-study", "social-proof", "results", "b2b"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "content-press-release",
    name: "Nota de Prensa",
    description: "Comunicado de prensa profesional con estructura AP style y quotes ejecutivos.",
    category: "content",
    icon: "📰",
    promptTemplate: `Escribe una nota de prensa profesional para {{BRAND_NAME}}.
Noticia: {{NEWS_HEADLINE}}.
Detalles: {{NEWS_DETAILS}}.
Portavoz: {{SPOKESPERSON_NAME}}, {{SPOKESPERSON_TITLE}}.
Ciudad, fecha: {{CITY}}, {{DATE}}.
Estructura AP: titular impactante, dateline, lead (5Ws), desarrollo en 3-4 párrafos, cita del portavoz, boilerplate de empresa, contacto de prensa.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "NEWS_HEADLINE", "NEWS_DETAILS", "SPOKESPERSON_NAME", "SPOKESPERSON_TITLE", "CITY", "DATE", "LANGUAGE"],
    tags: ["press-release", "pr", "media", "announcement"],
    outputType: "markdown",
    estimatedTokens: 900,
    isPremium: false,
  },
  {
    id: "content-email-sequence",
    name: "Secuencia de Emails (5 emails)",
    description: "Secuencia de 5 emails de nurturing con asuntos optimizados y storytelling.",
    category: "content",
    icon: "📧",
    promptTemplate: `Crea una secuencia de 5 emails de nurturing para {{BRAND_NAME}}.
Producto/servicio: {{PRODUCT_SERVICE}}. Sector: {{SECTOR}}.
Audiencia: {{TARGET_AUDIENCE}}. Voz: {{BRAND_VOICE}}.
Secuencia: Day 1 bienvenida + valor, Day 3 problema+solución, Day 5 caso de éxito, Day 7 objeción principal, Day 10 oferta especial + urgencia.
Para cada email: asunto principal + 2 variantes A/B, preview text, cuerpo completo, CTA claro.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_SERVICE", "SECTOR", "TARGET_AUDIENCE", "BRAND_VOICE", "LANGUAGE"],
    tags: ["email-sequence", "nurturing", "drip", "conversion"],
    outputType: "markdown",
    estimatedTokens: 3000,
    isPremium: true,
  },
  {
    id: "content-ad-copy",
    name: "Copy para Anuncios",
    description: "Copys para Meta Ads, Google Ads y TikTok con múltiples variantes por formato.",
    category: "content",
    icon: "📺",
    promptTemplate: `Genera copys de publicidad para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Oferta: {{OFFER_TEXT}}.
Audiencia: {{TARGET_AUDIENCE}}. Sector: {{SECTOR}}.
Para cada plataforma:
META ADS: 3 headlines (30 chars), 3 textos primarios (125 chars), 2 descripciones (25 chars)
GOOGLE ADS: 5 headlines (30 chars), 4 descripciones (90 chars), keywords negativas sugeridas
TIKTOK: 3 hooks (primeras 3 segundos texto), 3 scripts cortos (15-30s)
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "OFFER_TEXT", "TARGET_AUDIENCE", "SECTOR", "LANGUAGE"],
    tags: ["ads", "meta", "google", "tiktok", "paid"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "content-social-bio",
    name: "Bio Redes Sociales",
    description: "Bios optimizadas para Instagram, Twitter/X, LinkedIn, TikTok y Pinterest.",
    category: "content",
    icon: "👤",
    promptTemplate: `Escribe bios optimizadas para {{BRAND_NAME}} en todas las plataformas.
Sector: {{SECTOR}}. Voz: {{BRAND_VOICE}}.
USP: {{UVP}}. CTA principal: {{CTA_TEXT}}.
Para cada plataforma: Instagram (150 chars + emojis + hashtags + CTA link), Twitter/X (160 chars), LinkedIn (220 chars, profesional), TikTok (80 chars + emojis), Pinterest (500 chars, keywords).
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BRAND_VOICE", "UVP", "CTA_TEXT", "LANGUAGE"],
    tags: ["bio", "social-media", "profile", "instagram"],
    outputType: "markdown",
    estimatedTokens: 700,
    isPremium: false,
  },
  {
    id: "content-mission-vision-values",
    name: "Misión, Visión y Valores",
    description: "Declaraciones de misión, visión y 5 valores de marca con explicación.",
    category: "content",
    icon: "🌟",
    promptTemplate: `Crea las declaraciones de misión, visión y valores para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Fundadores: {{FOUNDERS}}.
Lo que hacemos: {{WHAT_WE_DO}}. Para quién: {{TARGET_AUDIENCE}}.
Impacto deseado: {{DESIRED_IMPACT}}.
MISIÓN: qué hacemos, para quién, cómo (1-2 frases directas)
VISIÓN: el mundo que queremos crear en 10 años (1 frase inspiradora)
VALORES: 5 valores con nombre, emoji, definición 2-3 frases y ejemplo concreto.
Tono: auténtico, sin corporativismo. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "FOUNDERS", "WHAT_WE_DO", "TARGET_AUDIENCE", "DESIRED_IMPACT", "LANGUAGE"],
    tags: ["mission", "vision", "values", "brand-identity"],
    outputType: "markdown",
    estimatedTokens: 900,
    isPremium: false,
  },
  {
    id: "content-product-launch",
    name: "Plan de Lanzamiento de Producto",
    description: "Plan completo de lanzamiento con pre-launch, launch day y post-launch.",
    category: "content",
    icon: "🚀",
    promptTemplate: `Crea un plan de lanzamiento de producto para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Precio: {{PRICE}}.
Fecha de lanzamiento: {{LAUNCH_DATE}}. Presupuesto: {{BUDGET}}.
Audiencia: {{TARGET_AUDIENCE}}. Canales: {{CHANNELS}}.
Plan semana a semana (4 semanas):
Pre-launch (sem 1-2): lista de espera, teasers, influencers
Launch week: email blast, redes sociales, PR, ads
Post-launch (sem 4): reviews, UGC, segunda ola de ads
KPIs y métricas de éxito. Copy para cada pieza. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "PRICE", "LAUNCH_DATE", "BUDGET", "TARGET_AUDIENCE", "CHANNELS", "LANGUAGE"],
    tags: ["launch", "go-to-market", "campaign", "strategy"],
    outputType: "markdown",
    estimatedTokens: 2500,
    isPremium: true,
  },
  {
    id: "content-comparison-page",
    name: "Página de Comparación vs Competencia",
    description: "Página SEO de comparación marca vs competidor con tabla y argumentos de venta.",
    category: "content",
    icon: "⚖️",
    promptTemplate: `Escribe una página de comparación para {{BRAND_NAME}} vs {{COMPETITOR_NAME}}.
Sector: {{SECTOR}}. Nuestro diferenciador: {{DIFFERENTIATOR}}.
Keyword: "{{BRAND_NAME}} vs {{COMPETITOR_NAME}}".
Estructura: intro objetiva, tabla comparativa 10+ criterios, por qué elegirnos (3 razones), casos de uso ideales para cada uno, conclusión con CTA, FAQ de la comparación.
Tono: honesto pero convincente a nuestro favor. 800-1000 palabras. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "COMPETITOR_NAME", "SECTOR", "DIFFERENTIATOR", "LANGUAGE"],
    tags: ["comparison", "competitor", "seo", "landing"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "content-size-guide",
    name: "Guía de Tallas / Sizing Guide",
    description: "Guía de tallas completa con medidas, conversiones y consejos para elegir.",
    category: "content",
    icon: "📏",
    promptTemplate: `Crea una guía de tallas completa para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Sector: moda/{{SECTOR}}.
Países principales de venta: {{COUNTRIES}}.
Incluye: tabla de medidas (cm/pulgadas), conversiones EU/UK/US, instrucciones para medirse, consejos para elegir talla, política de cambio, FAQ de tallas.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "SECTOR", "COUNTRIES", "LANGUAGE"],
    tags: ["size-guide", "ecommerce", "fashion", "conversion"],
    outputType: "markdown",
    estimatedTokens: 1000,
    isPremium: false,
  },
  {
    id: "content-about-page",
    name: "Página About Us",
    description: "Página Sobre Nosotros con historia, equipo, misión y timeline de hitos.",
    category: "content",
    icon: "🏢",
    promptTemplate: `Escribe la página Sobre Nosotros completa para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Fundación: {{FOUNDED_YEAR}}. Ciudad: {{CITY}}.
Fundadores: {{FOUNDERS}}. Misión: {{BRAND_MISSION}}.
Hitos clave: {{KEY_MILESTONES}}.
Secciones: headline impactante, párrafo de misión, historia de origen (storytelling), hitos en timeline visual (texto), equipo fundador con bios breves, números de impacto, valores, CTA final.
Tono: {{BRAND_VOICE}}. 700-900 palabras. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "FOUNDED_YEAR", "CITY", "FOUNDERS", "BRAND_MISSION", "KEY_MILESTONES", "BRAND_VOICE", "LANGUAGE"],
    tags: ["about-us", "company", "team", "story"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // SEO (15 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "seo-title-optimizer",
    name: "Optimizador de Títulos SEO",
    description: "Genera 10 variantes de título SEO con power words, emojis y length optimizado.",
    category: "seo",
    icon: "🏷️",
    promptTemplate: `Genera 10 variantes de título SEO para la página de {{PAGE_TYPE}} de {{BRAND_NAME}}.
Keyword principal: {{MAIN_KEYWORD}}. Sector: {{SECTOR}}.
Para cada variante: el título (50-60 chars), su score estimado (1-10), por qué funciona.
Incluye variantes: con número, con pregunta, con año, con emoji, con power word, con beneficio, con urgencia, con comparativa, con localización, estándar.
Idioma: {{LANGUAGE}}.`,
    variables: ["PAGE_TYPE", "BRAND_NAME", "MAIN_KEYWORD", "SECTOR", "LANGUAGE"],
    tags: ["title-tag", "seo", "serp", "click-through"],
    outputType: "markdown",
    estimatedTokens: 700,
    isPremium: false,
  },
  {
    id: "seo-meta-descriptions",
    name: "Meta Descriptions (10 variantes)",
    description: "Meta descriptions optimizadas con CTA, keyword y 150-160 caracteres exactos.",
    category: "seo",
    icon: "📋",
    promptTemplate: `Genera 10 meta descriptions para {{BRAND_NAME}} - {{PAGE_TYPE}}.
Keyword: {{MAIN_KEYWORD}}. Sector: {{SECTOR}}. CTA deseado: {{CTA_TEXT}}.
Cada meta: exactamente 150-160 caracteres, incluye keyword, incluye CTA, cada una con enfoque diferente.
Enfoques: beneficio directo, urgencia, social proof, pregunta, estadística, comparativa, promesa, oferta, exclusividad, personalización.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PAGE_TYPE", "MAIN_KEYWORD", "SECTOR", "CTA_TEXT", "LANGUAGE"],
    tags: ["meta-description", "seo", "serp", "ctr"],
    outputType: "markdown",
    estimatedTokens: 600,
    isPremium: false,
  },
  {
    id: "seo-schema-markup",
    name: "Schema Markup JSON-LD",
    description: "Schema.org JSON-LD completo para Product, Organization, FAQ, Breadcrumb y más.",
    category: "seo",
    icon: "🔖",
    promptTemplate: `Genera schema markup JSON-LD completo para {{BRAND_NAME}}.
URL del sitio: {{SITE_URL}}. Tipo de página: {{PAGE_TYPE}}.
Sector: {{SECTOR}}.
Incluye schemas relevantes: Organization, WebSite con SearchAction, {{PAGE_TYPE}} específico (Product/FAQ/Article/LocalBusiness/BreadcrumbList según corresponda).
Para Product incluye: name, description, image, sku, brand, offers (price, currency, availability), aggregateRating.
Añade comentarios HTML explicando cada schema. Output: solo código JSON-LD listo para copiar.`,
    variables: ["BRAND_NAME", "SITE_URL", "PAGE_TYPE", "SECTOR"],
    tags: ["schema", "json-ld", "structured-data", "rich-snippets"],
    outputType: "code",
    estimatedTokens: 1000,
    isPremium: false,
  },
  {
    id: "seo-keyword-cluster",
    name: "Clúster de Keywords",
    description: "Investigación de keywords con intención de búsqueda, volumen estimado y prioridad.",
    category: "seo",
    icon: "🔍",
    promptTemplate: `Crea un clúster de keywords para {{BRAND_NAME}}.
Keyword semilla: {{SEED_KEYWORD}}. Sector: {{SECTOR}}. País: {{TARGET_COUNTRY}}.
Genera 30 keywords organizadas en clúster:
- 5 head terms (alto volumen, alta competencia)
- 10 keywords de cuerpo (volumen medio)
- 15 long-tail (volumen bajo, alta conversión)
Para cada keyword: keyword, intención (informacional/transaccional/navegacional/comercial), dificultad estimada (1-10), volumen estimado, prioridad.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SEED_KEYWORD", "SECTOR", "TARGET_COUNTRY", "LANGUAGE"],
    tags: ["keywords", "research", "cluster", "intent"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "seo-content-brief",
    name: "Brief de Contenido SEO",
    description: "Brief completo para escritores con estructura, keywords, competitors y word count.",
    category: "seo",
    icon: "📄",
    promptTemplate: `Genera un brief de contenido SEO para {{BRAND_NAME}}.
Tema: {{CONTENT_TOPIC}}. Keyword principal: {{MAIN_KEYWORD}}.
Keywords secundarias: {{SECONDARY_KEYWORDS}}. Audiencia: {{TARGET_AUDIENCE}}.
Includes: objetivo del contenido, audiencia target, keyword strategy, estructura de headings (H1-H3), puntos a cubrir en cada sección, palabra clave density recomendada, word count objetivo, ejemplos de competidores a superar, internal links sugeridos, meta datos.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "CONTENT_TOPIC", "MAIN_KEYWORD", "SECONDARY_KEYWORDS", "TARGET_AUDIENCE", "LANGUAGE"],
    tags: ["content-brief", "seo", "editorial", "writing"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "seo-technical-audit",
    name: "Auditoría SEO Técnica",
    description: "Checklist de auditoría técnica SEO con priorización y recomendaciones.",
    category: "seo",
    icon: "🔧",
    promptTemplate: `Genera una auditoría SEO técnica para {{SITE_URL}} de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Plataforma: {{PLATFORM}}.
Revisa y puntúa (1-10) con recomendaciones de mejora:
Core Web Vitals (LCP/CLS/FID), mobile-friendliness, velocidad de carga, HTTPS/seguridad, estructura URLs, robots.txt, sitemap XML, canonical tags, hreflang, datos estructurados, arquitectura de links, crawlability.
Prioriza: CRÍTICO / ALTO / MEDIO / BAJO.
Output: checklist con estado, puntuación y acción correctiva específica.`,
    variables: ["SITE_URL", "BRAND_NAME", "SECTOR", "PLATFORM"],
    tags: ["technical-seo", "audit", "core-web-vitals", "crawl"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "seo-local",
    name: "SEO Local Completo",
    description: "Estrategia SEO local con Google Business Profile, citations y keywords geo.",
    category: "seo",
    icon: "📍",
    promptTemplate: `Crea una estrategia de SEO local completa para {{BRAND_NAME}}.
Negocio: {{BUSINESS_TYPE}}. Ciudad: {{CITY}}. Zona: {{SERVICE_AREA}}.
Keyword base: {{MAIN_KEYWORD}}.
Incluye: optimización Google Business Profile (categorías, descripción, posts), keywords geo-modificadas (20 variantes), estrategia de citations locales (top 20 directorios), schema LocalBusiness, contenido local (guías, páginas de zona), gestión de reseñas, link building local.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "BUSINESS_TYPE", "CITY", "SERVICE_AREA", "MAIN_KEYWORD", "LANGUAGE"],
    tags: ["local-seo", "google-business", "citations", "geo"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "seo-alt-text-bulk",
    name: "Alt Text para Imágenes (Bulk)",
    description: "Genera alt text SEO-optimizado para lote de imágenes de producto.",
    category: "seo",
    icon: "🖼️",
    promptTemplate: `Genera alt text SEO optimizado para imágenes de {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Keyword: {{MAIN_KEYWORD}}. Sector: {{SECTOR}}.
Para cada tipo de imagen (genera 5 por tipo):
- Imagen principal producto: incluye keyword, color, material, ángulo
- Imagen lifestyle: escena, beneficio, emoción
- Imagen detalle: característica específica
- Imagen empaquetado: unboxing, presentación
- Imagen grupal: colección, colores disponibles
Formato: máx 125 chars, descriptivo, sin "imagen de". Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "MAIN_KEYWORD", "SECTOR", "LANGUAGE"],
    tags: ["alt-text", "images", "accessibility", "seo"],
    outputType: "markdown",
    estimatedTokens: 800,
    isPremium: false,
  },
  {
    id: "seo-link-building",
    name: "Estrategia Link Building",
    description: "Plan de link building con targets, anchor texts y estrategias de outreach.",
    category: "seo",
    icon: "🔗",
    promptTemplate: `Crea una estrategia de link building para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Domain Authority actual: {{CURRENT_DA}}.
Keywords target: {{TARGET_KEYWORDS}}.
Plan a 90 días:
- 20 sitios target para guest posting (con justificación)
- 10 sitios para broken link building
- 5 estrategias de link earning (contenido linkable)
- Plantilla de email outreach (3 variantes)
- Anchor text strategy (branded 40%, exact 10%, LSI 50%)
- KPIs de seguimiento.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "CURRENT_DA", "TARGET_KEYWORDS", "LANGUAGE"],
    tags: ["link-building", "outreach", "backlinks", "off-page"],
    outputType: "markdown",
    estimatedTokens: 1800,
    isPremium: true,
  },
  {
    id: "seo-pillar-cluster",
    name: "Arquitectura Pillar-Cluster",
    description: "Arquitectura de contenido con página pilar y 8-10 cluster pages interconectadas.",
    category: "seo",
    icon: "🏛️",
    promptTemplate: `Diseña una arquitectura de contenido pillar-cluster para {{BRAND_NAME}}.
Tema pilar: {{PILLAR_TOPIC}}. Sector: {{SECTOR}}.
Audiencia: {{TARGET_AUDIENCE}}.
Entrega: 1 página pilar (keyword, H1, outline completo 2000+ palabras, internal links plan), 8 cluster pages (keyword, H1, outline 800 palabras, relación con pilar), mapa de internal linking, plan de publicación 3 meses.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PILLAR_TOPIC", "SECTOR", "TARGET_AUDIENCE", "LANGUAGE"],
    tags: ["pillar", "cluster", "content-architecture", "topical-authority"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: true,
  },
  {
    id: "seo-url-slugs",
    name: "URL Slugs Optimizados",
    description: "Genera URL slugs SEO-optimizados para catálogo de productos o páginas.",
    category: "seo",
    icon: "🔗",
    promptTemplate: `Genera URL slugs SEO-optimizados para {{BRAND_NAME}}.
Tipo de páginas: {{PAGE_TYPES}}.
Keyword base: {{SEED_KEYWORD}}. Idioma/Mercado: {{LANGUAGE}}.
Para cada URL: slug optimizado (max 60 chars, sin stopwords, separado por guiones), keyword principal, intención de búsqueda.
Incluye estructura de directorios recomendada (/categoria/subcategoria/producto).
Genera 20 ejemplos concretos. Evita: caracteres especiales, mayúsculas, fechas en URL de páginas evergreen.`,
    variables: ["BRAND_NAME", "PAGE_TYPES", "SEED_KEYWORD", "LANGUAGE"],
    tags: ["url-structure", "slugs", "permalink", "taxonomy"],
    outputType: "markdown",
    estimatedTokens: 700,
    isPremium: false,
  },
  {
    id: "seo-competitor-analysis",
    name: "Análisis SEO de Competidores",
    description: "Análisis de gaps de keywords, backlinks y contenido vs principales competidores.",
    category: "seo",
    icon: "🎯",
    promptTemplate: `Realiza un análisis SEO competitivo para {{BRAND_NAME}}.
Nuestro dominio: {{OUR_DOMAIN}}. Sector: {{SECTOR}}.
Competidores principales: {{COMPETITORS}}.
Analiza: gap de keywords (dónde ranquean ellos y nosotros no), temas de contenido que les funcionan, tipos de backlinks que consiguen, estructura de sitio, velocidad y UX. Identifica 10 quick wins en keywords y contenido. Plan de acción priorizado.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "OUR_DOMAIN", "SECTOR", "COMPETITORS", "LANGUAGE"],
    tags: ["competitor-analysis", "gap-analysis", "seo-strategy"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "seo-ecommerce-category",
    name: "SEO para Páginas de Categoría",
    description: "Optimización completa de páginas de categoría ecommerce con texto SEO.",
    category: "seo",
    icon: "🏪",
    promptTemplate: `Optimiza la página de categoría "{{CATEGORY_NAME}}" de {{BRAND_NAME}}.
URL: {{CATEGORY_URL}}. Keyword: {{MAIN_KEYWORD}}.
Incluye: H1 optimizado, texto SEO 300 palabras para encabezado de categoría (no bloqueante UX), texto pie de página SEO 200 palabras, meta title, meta description, breadcrumb schema, FAQ de la categoría (5 preguntas), sub-categorías sugeridas con anchor texts.
Idioma: {{LANGUAGE}}.`,
    variables: ["CATEGORY_NAME", "BRAND_NAME", "CATEGORY_URL", "MAIN_KEYWORD", "LANGUAGE"],
    tags: ["category-page", "ecommerce-seo", "taxonomy", "faceted"],
    outputType: "markdown",
    estimatedTokens: 1000,
    isPremium: false,
  },
  {
    id: "seo-voice-search",
    name: "Optimización Voice Search",
    description: "Contenido optimizado para búsqueda por voz con preguntas conversacionales.",
    category: "seo",
    icon: "🎙️",
    promptTemplate: `Optimiza el contenido de {{BRAND_NAME}} para búsqueda por voz.
Sector: {{SECTOR}}. Ciudad/Región: {{LOCATION}}.
Keyword base: {{SEED_KEYWORD}}.
Genera: 20 queries conversacionales "¿Cómo...?/¿Qué...?/¿Cuándo...?/¿Dónde...?" que la gente pregunta por voz, respuestas directas de 40-50 palabras (formato featured snippet), contenido de página FAQ adaptado para voice search, schema speakable markup.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "LOCATION", "SEED_KEYWORD", "LANGUAGE"],
    tags: ["voice-search", "featured-snippet", "conversational", "alexa"],
    outputType: "markdown",
    estimatedTokens: 1000,
    isPremium: false,
  },
  {
    id: "seo-international",
    name: "SEO Internacional / Hreflang",
    description: "Estrategia SEO internacional con hreflang, URL structure y contenido localizado.",
    category: "seo",
    icon: "🌍",
    promptTemplate: `Crea la estrategia SEO internacional para {{BRAND_NAME}}.
Mercados target: {{TARGET_MARKETS}}.
URL base: {{BASE_URL}}. Plataforma: {{PLATFORM}}.
Incluye: estructura de URL recomendada (ccTLD vs subdominio vs subdirectorio), implementación hreflang completa (código HTML para cada mercado), consideraciones de contenido localizado vs traducido, keywords por mercado (principales 5), hoja de ruta de implementación por fases.
Idioma del informe: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "TARGET_MARKETS", "BASE_URL", "PLATFORM", "LANGUAGE"],
    tags: ["international-seo", "hreflang", "multilingual", "global"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: true,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // SOCIAL MEDIA (10 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "social-instagram-pack",
    name: "Pack Instagram (7 días)",
    description: "7 publicaciones Instagram con caption, hashtags, call-to-action y tipo de contenido.",
    category: "social",
    icon: "📸",
    promptTemplate: `Crea un pack de 7 publicaciones de Instagram para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Voz: {{BRAND_VOICE}}. Producto estrella: {{HERO_PRODUCT}}.
Para cada post: tipo de contenido (foto/video/carrusel/Reel), caption completa (150-220 chars), CTA específico, hashtags (15: 5 grandes + 5 medios + 5 nicho), emojis apropiados, descripción visual de la imagen/video.
Días: lunes (motivacional), martes (producto), miércoles (educativo), jueves (UGC/comunidad), viernes (oferta), sábado (behind-the-scenes), domingo (lifestyle).
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BRAND_VOICE", "HERO_PRODUCT", "LANGUAGE"],
    tags: ["instagram", "social-calendar", "content-plan", "hashtags"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "social-linkedin-thought-leadership",
    name: "LinkedIn Thought Leadership",
    description: "5 posts de liderazgo de opinión para LinkedIn con formato optimizado.",
    category: "social",
    icon: "💼",
    promptTemplate: `Escribe 5 posts de thought leadership para LinkedIn en nombre de {{AUTHOR_NAME}}, {{AUTHOR_TITLE}} de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Temas: {{TOPICS}}.
Cada post: gancho primera línea (para expandir), narrativa personal o insight, takeaway accionable, pregunta para engagement, hashtags (3-5), longitud 150-300 palabras.
Estilos: personal story, dato controversal, lista numerada, lección aprendida, predicción.
Idioma: {{LANGUAGE}}.`,
    variables: ["AUTHOR_NAME", "AUTHOR_TITLE", "BRAND_NAME", "SECTOR", "TOPICS", "LANGUAGE"],
    tags: ["linkedin", "thought-leadership", "b2b", "personal-brand"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "social-tiktok-scripts",
    name: "Scripts para TikTok/Reels",
    description: "5 scripts de videos cortos con hooks, estructura y CTA para máximo engagement.",
    category: "social",
    icon: "🎵",
    promptTemplate: `Escribe 5 scripts para TikTok/Reels de {{BRAND_NAME}}.
Producto/tema: {{PRODUCT_TOPIC}}. Sector: {{SECTOR}}. Audiencia: {{TARGET_AUDIENCE}}.
Para cada video (15-60 segundos):
- HOOK (primeros 3s): frase de apertura que para el scroll
- CUERPO: guión por escena con timing
- CTA: acción específica final
- On-screen text: textos para overlay
- Tendencia/audio sugerido
- Tipo: educativo/entretenimiento/demostración/UGC/trending.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_TOPIC", "SECTOR", "TARGET_AUDIENCE", "LANGUAGE"],
    tags: ["tiktok", "reels", "short-video", "script"],
    outputType: "markdown",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "social-twitter-thread",
    name: "Twitter/X Thread Viral",
    description: "Thread de 10-15 tweets con estructura narrativa, datos y alto potencial viral.",
    category: "social",
    icon: "🐦",
    promptTemplate: `Escribe un thread de Twitter/X para {{BRAND_NAME}}.
Tema: {{THREAD_TOPIC}}. Sector: {{SECTOR}}. Audiencia: {{TARGET_AUDIENCE}}.
Estructura: Tweet 1 (gancho + promesa), tweets 2-13 (desarrollo con datos, ejemplos, insights), tweet final (resumen + CTA).
Cada tweet: máx 280 chars, numerado (1/N), emojis estratégicos, sin "Hilo sobre...".
Incluye 2-3 tweets con estadísticas impactantes que generen RT.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "THREAD_TOPIC", "SECTOR", "TARGET_AUDIENCE", "LANGUAGE"],
    tags: ["twitter", "thread", "viral", "engagement"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "social-youtube-seo",
    name: "SEO para YouTube",
    description: "Título, descripción, tags y chapters optimizados para YouTube SEO.",
    category: "social",
    icon: "▶️",
    promptTemplate: `Optimiza el SEO de un video YouTube para {{BRAND_NAME}}.
Tema del video: {{VIDEO_TOPIC}}. Duración: {{VIDEO_DURATION}}.
Sector: {{SECTOR}}. Keyword principal: {{MAIN_KEYWORD}}.
Entrega: 5 variantes de título (máx 70 chars con keyword), descripción completa (800-1000 chars: párrafo intro con keyword, timestamps/chapters, links, hashtags, subscribe CTA), 15 tags relevantes, thumbnail text sugerido, capítulos con timestamps simulados.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "VIDEO_TOPIC", "VIDEO_DURATION", "SECTOR", "MAIN_KEYWORD", "LANGUAGE"],
    tags: ["youtube", "video-seo", "thumbnail", "chapters"],
    outputType: "markdown",
    estimatedTokens: 1000,
    isPremium: false,
  },
  {
    id: "social-community-engagement",
    name: "Plantillas de Engagement",
    description: "Respuestas de comunidad para comentarios positivos, negativos y preguntas.",
    category: "social",
    icon: "💬",
    promptTemplate: `Crea plantillas de respuesta de comunidad para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Voz de marca: {{BRAND_VOICE}}.
Genera 5 plantillas para cada tipo:
- Comentario positivo/elogio (variadas, no robóticas)
- Pregunta sobre producto (informativa + CTA)
- Queja o crítica (empática + solución)
- Solicitud de colaboración/gifting (elegante rechazo o aceptación)
- Spam/bot (breve, neutral)
Incluye variables [NOMBRE], [PRODUCTO], [SOLUCIÓN] en plantillas.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BRAND_VOICE", "LANGUAGE"],
    tags: ["community-management", "comments", "customer-service", "social"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "social-influencer-brief",
    name: "Brief para Influencers",
    description: "Brief profesional para colaboraciones con influencers, incluyendo dos, fechas y KPIs.",
    category: "social",
    icon: "⭐",
    promptTemplate: `Crea un brief profesional de colaboración para influencers de {{BRAND_NAME}}.
Producto a promover: {{PRODUCT_NAME}}. Precio del producto: {{PRICE}}.
Compensación: {{COMPENSATION}}. Plataforma: {{PLATFORM}}.
Incluye: descripción de la marca (2 párrafos), detalles del producto, objetivos de la campaña, deliverables requeridos (formatos, cantidad, timeline), guía de dos y no dos (mensajes clave, restricciones), hashtags obligatorios, proceso de aprobación de contenido, métricas de éxito, términos de pago.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "PRICE", "COMPENSATION", "PLATFORM", "LANGUAGE"],
    tags: ["influencer", "brief", "ugc", "collaboration"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "social-hashtag-strategy",
    name: "Estrategia de Hashtags",
    description: "Investigación de hashtags por plataforma con categorías, volumen y rotación.",
    category: "social",
    icon: "#️⃣",
    promptTemplate: `Crea una estrategia de hashtags para {{BRAND_NAME}}.
Sector: {{SECTOR}}. País/idioma: {{TARGET_COUNTRY}}/{{LANGUAGE}}.
Plataforma principal: {{PLATFORM}}.
Entrega:
- Hashtag de marca propio (sugerencias + formato)
- 10 hashtags mega (>1M posts) con evaluación
- 15 hashtags grandes (500k-1M)
- 20 hashtags medianos (100k-500k)
- 15 hashtags nicho (<100k, alta conversión)
- 5 hashtags de campaña
- Sets de rotación semanal (5 sets diferentes)
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "TARGET_COUNTRY", "PLATFORM", "LANGUAGE"],
    tags: ["hashtags", "reach", "discovery", "instagram"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "social-ugc-campaign",
    name: "Campaña UGC (User Generated Content)",
    description: "Estrategia UGC completa con hashtag de campaña, mecánica y premios.",
    category: "social",
    icon: "📷",
    promptTemplate: `Diseña una campaña UGC para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Presupuesto campaña: {{BUDGET}}.
Plataformas: {{PLATFORMS}}. Duración: {{DURATION}}.
Incluye: nombre y hashtag de campaña, mecánica clara de participación, premios/incentivos, cómo y quién seleccionará ganadores, copy de lanzamiento (email + social), plantillas de repost con crédito, métricas de éxito, timeline semana a semana, términos y condiciones básicos.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "BUDGET", "PLATFORMS", "DURATION", "LANGUAGE"],
    tags: ["ugc", "campaign", "contest", "community"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: true,
  },
  {
    id: "social-pinterest-strategy",
    name: "Estrategia Pinterest",
    description: "Boards, pins, keywords y estrategia de contenido para Pinterest.",
    category: "social",
    icon: "📌",
    promptTemplate: `Crea una estrategia de Pinterest para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Producto estrella: {{HERO_PRODUCT}}.
Incluye: nombre de perfil y bio optimizada (500 chars + keywords), 8 boards sugeridos con nombres SEO-optimizados y descripciones, tipos de pins que mejor funcionan en {{SECTOR}}, calendario de pinning (veces/día), keywords para Rich Pins, estrategia de Idea Pins, colaboraciones y group boards, pins estacionales para los próximos 3 meses.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "HERO_PRODUCT", "LANGUAGE"],
    tags: ["pinterest", "visual-search", "pins", "boards"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // ANALYTICS (10 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "analytics-kpi-framework",
    name: "Framework de KPIs",
    description: "Sistema de KPIs por departamento con fórmulas, benchmarks y frecuencia de reporte.",
    category: "analytics",
    icon: "📈",
    promptTemplate: `Crea un framework de KPIs para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Etapa del negocio: {{BUSINESS_STAGE}}.
Ventas mensuales actuales: {{MONTHLY_REVENUE}}.
Para cada departamento (Marketing, Ventas, Producto, Operaciones, Finanzas):
- 5 KPIs principales con fórmula de cálculo
- Benchmark del sector
- Objetivo a 3 meses
- Frecuencia de medición (diario/semanal/mensual)
- Responsable y fuente de datos
Incluye North Star Metric del negocio. Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BUSINESS_STAGE", "MONTHLY_REVENUE", "LANGUAGE"],
    tags: ["kpis", "metrics", "measurement", "reporting"],
    outputType: "markdown",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "analytics-ab-test-design",
    name: "Diseño de Test A/B",
    description: "Diseño estadístico de A/B test con hipótesis, muestra, duración y análisis.",
    category: "analytics",
    icon: "🔬",
    promptTemplate: `Diseña un A/B test para {{BRAND_NAME}}.
Elemento a testar: {{TEST_ELEMENT}} (ej: "botón CTA de checkout").
Hipótesis: {{HYPOTHESIS}}.
Tráfico mensual actual: {{MONTHLY_TRAFFIC}}. Conversión actual: {{CURRENT_CONVERSION_RATE}}.
Entrega: hipótesis formal (si...entonces...porque...), cálculo de tamaño de muestra estadísticamente significativo (95% confianza, 80% poder), duración recomendada, cómo implementar la variante B, métricas primaria y secundarias, criterios de victoria/pausa, análisis de segmentos, qué hacer con resultados.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "TEST_ELEMENT", "HYPOTHESIS", "MONTHLY_TRAFFIC", "CURRENT_CONVERSION_RATE", "LANGUAGE"],
    tags: ["ab-test", "cro", "statistics", "experimentation"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "analytics-funnel-analysis",
    name: "Análisis de Embudo",
    description: "Análisis del funnel de conversión con tasas por etapa e identificación de cuellos.",
    category: "analytics",
    icon: "📉",
    promptTemplate: `Analiza el embudo de conversión de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Tipo de negocio: {{BUSINESS_TYPE}}.
Datos actuales del funnel: {{FUNNEL_DATA}}.
Genera: visualización del funnel con tasas de conversión entre etapas, benchmarks del sector por etapa, identificación de los 3 mayores cuellos de botella, causas probables por etapa (análisis UX, copy, técnico), 10 recomendaciones de mejora priorizadas por impacto/esfuerzo, proyección de impacto si mejoras X% en etapa Y.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BUSINESS_TYPE", "FUNNEL_DATA", "LANGUAGE"],
    tags: ["funnel", "conversion", "ux-analysis", "bottleneck"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "analytics-cohort-report",
    name: "Análisis de Cohortes",
    description: "Plantilla de análisis de cohortes con retención, LTV y churn por período.",
    category: "analytics",
    icon: "👥",
    promptTemplate: `Crea un framework de análisis de cohortes para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Tipo de negocio: {{BUSINESS_TYPE}}.
Datos a analizar: {{DATA_AVAILABLE}}.
Entrega: definición de cohortes relevantes para el negocio, tabla de retención (template con fórmulas), cálculo de LTV por cohorte, tasa de churn por período, identificación de mejores cohortes de adquisición, señales de riesgo de churn, acciones de retención por etapa de ciclo de vida.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "BUSINESS_TYPE", "DATA_AVAILABLE", "LANGUAGE"],
    tags: ["cohort", "retention", "ltv", "churn"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: true,
  },
  {
    id: "analytics-revenue-forecast",
    name: "Pronóstico de Revenue",
    description: "Modelo de pronóstico de ingresos a 12 meses con escenarios conservador/base/optimista.",
    category: "analytics",
    icon: "🔮",
    promptTemplate: `Crea un modelo de pronóstico de revenue para {{BRAND_NAME}}.
Revenue actual: {{CURRENT_REVENUE}}. Crecimiento histórico: {{HISTORICAL_GROWTH}}.
Canales: {{REVENUE_CHANNELS}}. Sector: {{SECTOR}}.
Genera: modelo de 12 meses con 3 escenarios (conservador -20%, base, optimista +30%), desglose por canal de ingresos, supuestos clave para cada escenario, métricas motoras del crecimiento (drivers), puntos de inflexión identificados, recomendaciones para alcanzar escenario optimista.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "CURRENT_REVENUE", "HISTORICAL_GROWTH", "REVENUE_CHANNELS", "SECTOR", "LANGUAGE"],
    tags: ["forecast", "revenue", "financial-model", "scenarios"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: true,
  },
  {
    id: "analytics-attribution-model",
    name: "Modelo de Atribución",
    description: "Framework de atribución multicanal con distribución de crédito y análisis.",
    category: "analytics",
    icon: "🗺️",
    promptTemplate: `Diseña un modelo de atribución para {{BRAND_NAME}}.
Canales activos: {{ACTIVE_CHANNELS}}.
Ticket promedio: {{AOV}}. Ciclo de compra: {{PURCHASE_CYCLE}}.
Entrega: comparativa de modelos (last-click, first-click, linear, time-decay, data-driven), recomendación del modelo más adecuado para tu negocio con justificación, cómo implementarlo en GA4, distribución de budget recomendada por canal basada en atribución, métricas de evaluación por canal.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "ACTIVE_CHANNELS", "AOV", "PURCHASE_CYCLE", "LANGUAGE"],
    tags: ["attribution", "multi-channel", "budget-allocation", "ga4"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "analytics-customer-segmentation",
    name: "Segmentación de Clientes RFM",
    description: "Segmentación RFM (Recency/Frequency/Monetary) con estrategias por segmento.",
    category: "analytics",
    icon: "🎯",
    promptTemplate: `Crea un sistema de segmentación RFM para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Base de clientes: {{CUSTOMER_BASE_SIZE}}.
AOV: {{AOV}}. Frecuencia de compra promedio: {{AVG_FREQUENCY}}.
Entrega: definición de las 3 dimensiones RFM con rangos específicos para tu negocio, matriz de segmentos (Champions, Loyal, At-Risk, Can't Lose, Lost etc.), tamaño estimado de cada segmento, estrategia de marketing específica por segmento, métricas a trackear por segmento, SQL/pseudo-código para calcular el score.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "CUSTOMER_BASE_SIZE", "AOV", "AVG_FREQUENCY", "LANGUAGE"],
    tags: ["rfm", "segmentation", "customer-lifetime", "personalization"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: true,
  },
  {
    id: "analytics-ga4-setup",
    name: "Configuración GA4 Completa",
    description: "Plan de implementación GA4 con eventos, conversiones, audiencias y reportes.",
    category: "analytics",
    icon: "📊",
    promptTemplate: `Crea un plan de implementación de Google Analytics 4 para {{BRAND_NAME}}.
Plataforma: {{PLATFORM}} (Shopify/WooCommerce/custom).
Objetivos de negocio: {{BUSINESS_GOALS}}.
Entrega: eventos recomendados con parámetros (enhanced ecommerce: view_item, add_to_cart, begin_checkout, purchase + eventos custom), conversiones clave a configurar, audiencias de remarketing a crear, reportes personalizados recomendados, dashboard de Looker Studio sugerido, integración Google Ads, checklist de verificación post-implementación.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PLATFORM", "BUSINESS_GOALS", "LANGUAGE"],
    tags: ["ga4", "google-analytics", "tracking", "events"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "analytics-cro-audit",
    name: "Auditoría CRO",
    description: "Auditoría de optimización de conversiones con quick wins y roadmap de mejoras.",
    category: "analytics",
    icon: "⚡",
    promptTemplate: `Realiza una auditoría CRO para {{SITE_URL}} de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Conversión actual: {{CURRENT_CR}}.
Tráfico mensual: {{MONTHLY_TRAFFIC}}. Plataforma: {{PLATFORM}}.
Analiza y puntúa (1-10): credibilidad y trust signals, claridad del value proposition, fricción en checkout, velocidad y UX mobile, copy y CTAs, social proof, urgencia/escasez, navegación y arquitectura, imágenes de producto, proceso de devolución.
Para cada área: score actual, benchmark sector, 3 acciones de mejora priorizadas (impacto/esfuerzo).
Idioma: {{LANGUAGE}}.`,
    variables: ["SITE_URL", "BRAND_NAME", "SECTOR", "CURRENT_CR", "MONTHLY_TRAFFIC", "PLATFORM", "LANGUAGE"],
    tags: ["cro", "conversion-rate", "audit", "ux"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "analytics-competitive-benchmark",
    name: "Benchmark Competitivo",
    description: "Benchmarking de métricas clave vs competidores con gaps y oportunidades.",
    category: "analytics",
    icon: "🏆",
    promptTemplate: `Realiza un benchmark competitivo para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Competidores: {{COMPETITORS}}.
Métricas a comparar: {{METRICS_TO_COMPARE}}.
Entrega: tabla comparativa de KPIs clave del sector (tráfico, CR%, AOV, LTV, CAC, NPS), posicionamiento de {{BRAND_NAME}} vs competidores, gaps identificados, fortalezas diferenciales, oportunidades de mercado, estrategias de competidores que deberías adoptar/evitar.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "COMPETITORS", "METRICS_TO_COMPARE", "LANGUAGE"],
    tags: ["benchmarking", "competitive-intelligence", "industry-metrics"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // COMMERCE (10 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "commerce-bundle-strategy",
    name: "Estrategia de Bundles",
    description: "Diseño de bundles y packs con pricing psychology y presentación.",
    category: "commerce",
    icon: "🎁",
    promptTemplate: `Crea una estrategia de bundles para {{BRAND_NAME}}.
Catálogo: {{PRODUCT_CATALOG}}. AOV actual: {{CURRENT_AOV}}. Sector: {{SECTOR}}.
Diseña: 5 bundles específicos (nombre + productos incluidos + precio bundle vs individual + savings %), anclas de precio para cada bundle, copy de presentación de cada bundle (nombre evocador + tagline + bullets de beneficios), reglas de exclusión (qué NO juntar), estrategia de display (PDP vs carrito vs checkout), test A/B sugerido para naming.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_CATALOG", "CURRENT_AOV", "SECTOR", "LANGUAGE"],
    tags: ["bundles", "upsell", "aov", "packaging"],
    outputType: "markdown",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "commerce-pricing-psychology",
    name: "Psicología de Precios",
    description: "Análisis y recomendación de estrategia de precios con técnicas de psicología.",
    category: "commerce",
    icon: "🧠",
    promptTemplate: `Aplica psicología de precios a {{BRAND_NAME}}.
Producto principal: {{PRODUCT_NAME}}. Precio actual: {{CURRENT_PRICE}}.
Competencia: {{COMPETITOR_PRICES}}. Sector: {{SECTOR}}.
Analiza y recomienda: precio charm (terminación óptima), efecto ancla (precio de referencia), opción señuelo (decoy pricing), bundling psicológico, descuentos como porcentaje vs monto, comunicación de "ahorro", framing temporal del precio, posicionamiento premium vs value.
Para cada técnica: implementación específica + impacto estimado en conversión.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "CURRENT_PRICE", "COMPETITOR_PRICES", "SECTOR", "LANGUAGE"],
    tags: ["pricing", "psychology", "conversion", "anchoring"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "commerce-loyalty-program",
    name: "Programa de Fidelización",
    description: "Diseño completo de programa de puntos/niveles con mecánicas de gamificación.",
    category: "commerce",
    icon: "⭐",
    promptTemplate: `Diseña un programa de fidelización para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Ticket promedio: {{AOV}}. Frecuencia de compra: {{PURCHASE_FREQUENCY}}.
Diseña: nombre del programa + mascota/identidad visual, estructura de niveles (4 niveles con nombres creativos + requisitos + beneficios), sistema de puntos (ratio ganancia/canje), beneficios exclusivos por nivel, mecánicas de gamificación (challenges, bonuses, streaks), programa de referidos integrado, comunicación de onboarding al programa (email + notificación).
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "AOV", "PURCHASE_FREQUENCY", "LANGUAGE"],
    tags: ["loyalty", "gamification", "retention", "points"],
    outputType: "markdown",
    estimatedTokens: 1800,
    isPremium: true,
  },
  {
    id: "commerce-abandoned-cart-recovery",
    name: "Recuperación de Carritos",
    description: "Secuencia completa de recuperación de carritos con timing y personalización.",
    category: "commerce",
    icon: "🛒",
    promptTemplate: `Crea una estrategia de recuperación de carritos para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Ticket promedio: {{AOV}}. Tasa de abandono actual: {{ABANDONMENT_RATE}}.
Diseña: secuencia de 3 emails (1h, 24h, 72h) + secuencia SMS si aplica, asunto y preview text para cada email, copy completo de cada email personalizado con producto, timing óptimo basado en datos del sector, descuento progresivo (si/cuándo), variante con urgencia (stock limitado), segmentación por valor del carrito, métricas de éxito.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "AOV", "ABANDONMENT_RATE", "LANGUAGE"],
    tags: ["abandoned-cart", "email", "recovery", "automation"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "commerce-flash-sale",
    name: "Plan de Flash Sale",
    description: "Campaña completa de flash sale con countdown, urgencia y comunicación multicanal.",
    category: "commerce",
    icon: "⚡",
    promptTemplate: `Crea un plan de flash sale para {{BRAND_NAME}}.
Duración: {{SALE_DURATION}}. Descuento: {{DISCOUNT_PERCENTAGE}}.
Productos en oferta: {{SALE_PRODUCTS}}. Fecha: {{SALE_DATE}}.
Incluye: nombre creativo de la campaña, countdown page HTML (con timer), secuencia de email (teaser 48h antes + inicio + 6h antes de cerrar + última hora), posts redes sociales (Instagram, Twitter, LinkedIn), SMS template, push notification copy, extensión de urgencia si no se alcanza objetivo.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SALE_DURATION", "DISCOUNT_PERCENTAGE", "SALE_PRODUCTS", "SALE_DATE", "LANGUAGE"],
    tags: ["flash-sale", "urgency", "countdown", "promotion"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "commerce-product-page-optimization",
    name: "Optimización PDP (Product Detail Page)",
    description: "Auditoría y reescritura completa de página de producto para máxima conversión.",
    category: "commerce",
    icon: "📦",
    promptTemplate: `Optimiza la página de producto de {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. URL actual: {{PRODUCT_URL}}.
Competencia: {{COMPETITOR_PRODUCT_URL}}. Sector: {{SECTOR}}.
Entrega: reescritura del título (3 variantes SEO), descripción corta (above the fold, 80 palabras, beneficio), descripción larga (con storytelling, especificaciones, FAQ inline), bullets de beneficios (6-8 bullet points persuasivos), trust badges sugeridos, sección de reviews (instrucciones para aumentar UGC), upsells y cross-sells recomendados, sticky add-to-cart copy.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "PRODUCT_URL", "COMPETITOR_PRODUCT_URL", "SECTOR", "LANGUAGE"],
    tags: ["pdp", "product-page", "conversion", "ecommerce"],
    outputType: "markdown",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "commerce-seasonal-calendar",
    name: "Calendario Comercial Anual",
    description: "Calendario de campañas comerciales para todo el año con oportunidades por mes.",
    category: "commerce",
    icon: "📅",
    promptTemplate: `Crea el calendario comercial anual de {{BRAND_NAME}}.
Sector: {{SECTOR}}. País principal: {{TARGET_COUNTRY}}.
Para cada mes: fechas comerciales relevantes (nacionales + internacionales + del sector), tipo de campaña recomendada, mensaje/tema central, canales prioritarios, tip de timing (cuándo comunicar vs cuándo activar la oferta).
Incluye: top 5 fechas del año para este negocio, temporada baja y cómo activarla, eventos propios de marca recomendados.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "TARGET_COUNTRY", "LANGUAGE"],
    tags: ["calendar", "seasonal", "campaigns", "planning"],
    outputType: "markdown",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "commerce-checkout-optimization",
    name: "Optimización del Checkout",
    description: "Análisis y mejoras del proceso de checkout para reducir abandono.",
    category: "commerce",
    icon: "💳",
    promptTemplate: `Optimiza el proceso de checkout de {{BRAND_NAME}}.
Plataforma: {{PLATFORM}}. Tasa de abandono checkout: {{CHECKOUT_ABANDONMENT}}.
País principal: {{TARGET_COUNTRY}}. Sector: {{SECTOR}}.
Analiza y recomienda: número óptimo de pasos, campos obligatorios vs opcionales, métodos de pago esenciales para {{TARGET_COUNTRY}}, trust signals en checkout, copys de botones de pago (5 variantes), mensajes de error amigables, confirmación de pedido que aumente NPS, upsell de último momento en checkout.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PLATFORM", "CHECKOUT_ABANDONMENT", "TARGET_COUNTRY", "SECTOR", "LANGUAGE"],
    tags: ["checkout", "payment", "abandonment", "conversion"],
    outputType: "markdown",
    estimatedTokens: 1200,
    isPremium: false,
  },
  {
    id: "commerce-subscription-model",
    name: "Modelo de Suscripción",
    description: "Diseño de modelo de negocio por suscripción con planes, precios y valor.",
    category: "commerce",
    icon: "🔄",
    promptTemplate: `Diseña un modelo de suscripción para {{BRAND_NAME}}.
Producto/servicio: {{PRODUCT_SERVICE}}. Precio compra única: {{ONE_TIME_PRICE}}.
Sector: {{SECTOR}}. Competencia: {{COMPETITORS}}.
Diseña: estructura de planes (mensual/trimestral/anual), precio de cada plan con descuentos vs pago único, beneficios exclusivos de suscriptores, onboarding experience, gestión de upgrades/downgrades, estrategia de recuperación de churners, métricas clave MRR/Churn/LTV, comunicación de lanzamiento.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_SERVICE", "ONE_TIME_PRICE", "SECTOR", "COMPETITORS", "LANGUAGE"],
    tags: ["subscription", "recurring-revenue", "saas", "membership"],
    outputType: "markdown",
    estimatedTokens: 1800,
    isPremium: true,
  },
  {
    id: "commerce-returns-policy",
    name: "Política de Devoluciones",
    description: "Política de devoluciones clara, convincente y optimizada para conversión.",
    category: "commerce",
    icon: "↩️",
    promptTemplate: `Crea la política de devoluciones de {{BRAND_NAME}}.
Sector: {{SECTOR}}. País: {{TARGET_COUNTRY}}.
Cobertura legal mínima: {{LEGAL_REQUIREMENTS}}.
Escribe: política completa legalmente válida pero en lenguaje humano, versión corta para PDP (50 palabras con trust badge), respuestas a las 5 objeciones más comunes sobre devoluciones, instrucciones paso a paso para solicitar devolución, condiciones claras sin letra pequeña, cómo comunicar la política para que sea ventaja competitiva.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "SECTOR", "TARGET_COUNTRY", "LEGAL_REQUIREMENTS", "LANGUAGE"],
    tags: ["returns", "policy", "trust", "legal"],
    outputType: "markdown",
    estimatedTokens: 1000,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 3D & VISUAL (5 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "3d-product-viewer",
    name: "Visor 3D de Producto",
    description: "Visor 360° de producto con Three.js, controles de órbita y hotspots.",
    category: "3d",
    icon: "🧊",
    promptTemplate: `Crea un visor 3D de producto para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Forma base: {{PRODUCT_SHAPE}}.
Color: {{PRIMARY_COLOR}}. Estilo: {{DESIGN_STYLE}}.
Genera un visor 3D completo usando Three.js CDN: geometría 3D representativa del producto, material PBR (MeshStandardMaterial) con color de marca, OrbitControls para rotación 360°, iluminación de tres puntos profesional (key/fill/back), post-processing FXAA, hotspots de características (3 puntos con tooltips), botón de captura de imagen. Output: HTML completo autocontenido.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "PRODUCT_SHAPE", "PRIMARY_COLOR", "DESIGN_STYLE"],
    tags: ["3d", "threejs", "product-viewer", "360"],
    outputType: "html",
    preferredModel: "claude-sonnet",
    estimatedTokens: 3000,
    isPremium: true,
  },
  {
    id: "3d-ar-concept",
    name: "Concepto AR Try-On",
    description: "Especificación técnica y prototipo HTML de experiencia AR para producto.",
    category: "3d",
    icon: "🔮",
    promptTemplate: `Diseña el concepto AR try-on para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Sector: {{SECTOR}}.
Entrega: especificación técnica de la experiencia AR (WebXR / model-viewer), componente HTML con Google Model Viewer para vista 3D + botón AR, descripción de los assets 3D necesarios (formato GLB, polígonos, texturas), flujo de usuario paso a paso, mensajes de UX para cada etapa, alternativa fallback para dispositivos sin AR.
Idioma: {{LANGUAGE}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "SECTOR", "LANGUAGE"],
    tags: ["ar", "augmented-reality", "3d", "try-on"],
    outputType: "html",
    estimatedTokens: 2000,
    isPremium: true,
  },
  {
    id: "3d-particle-background",
    name: "Fondo de Partículas 3D",
    description: "Fondo animado con partículas Three.js reactivas al cursor para hero sections.",
    category: "3d",
    icon: "✨",
    promptTemplate: `Crea un fondo de partículas 3D con Three.js para {{BRAND_NAME}}.
Paleta: {{PRIMARY_COLOR}}, {{SECONDARY_COLOR}}, fondo {{BG_COLOR}}.
Comportamiento: {{PARTICLE_STYLE}} (lluvia/nebulosa/campo estelar/red-conectada/galaxy-spin).
Genera HTML completo: sistema de partículas Three.js con 2000+ puntos, reacción al movimiento del mouse (repulsión suave), animación continua con requestAnimationFrame, responsive (resize handler), performance optimizado (frustum culling), pausa cuando pestaña inactiva.
Overlay con texto {{HEADLINE_TEXT}} centrado sobre las partículas.`,
    variables: ["BRAND_NAME", "PRIMARY_COLOR", "SECONDARY_COLOR", "BG_COLOR", "PARTICLE_STYLE", "HEADLINE_TEXT"],
    tags: ["particles", "threejs", "animation", "hero-background"],
    outputType: "html",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "3d-interactive-configurator",
    name: "Configurador de Producto 3D",
    description: "Configurador interactivo de producto con variantes de color y material en Three.js.",
    category: "3d",
    icon: "🎨",
    promptTemplate: `Crea un configurador de producto 3D interactivo para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Variantes de color: {{COLOR_VARIANTS}}.
Genera HTML con Three.js: modelo 3D representativo del producto, panel lateral con swatches de colores/materiales, animación suave de cambio de material (THREE.MeshStandardMaterial), rotación auto con pausa en interacción, preset de iluminación estudio, botón "Añadir al carrito" que muestra configuración seleccionada, exportar captura PNG.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "COLOR_VARIANTS"],
    tags: ["configurator", "3d", "product", "customization"],
    outputType: "html",
    preferredModel: "claude-opus",
    estimatedTokens: 3500,
    isPremium: true,
  },
  {
    id: "3d-data-visualization",
    name: "Visualización de Datos 3D",
    description: "Gráfico de datos en 3D con barras, animaciones y tooltips interactivos.",
    category: "3d",
    icon: "📊",
    promptTemplate: `Crea una visualización de datos 3D para {{BRAND_NAME}}.
Tipo de gráfico: {{CHART_TYPE}} (barras 3D / scatter plot 3D / globo terráqueo / red de nodos).
Datos: {{DATA_DESCRIPTION}}. Color primario: {{PRIMARY_COLOR}}.
Genera HTML con Three.js: datos simulados realistas para {{SECTOR}}, barras/esferas 3D con altura/tamaño proporcional al dato, etiquetas 2D flotantes (CSS2DRenderer), tooltips en hover con Raycaster, animación de entrada escalonada, controles de órbita, leyenda, opciones de exportar imagen.`,
    variables: ["BRAND_NAME", "CHART_TYPE", "DATA_DESCRIPTION", "PRIMARY_COLOR", "SECTOR"],
    tags: ["data-viz", "3d", "charts", "threejs"],
    outputType: "html",
    estimatedTokens: 3000,
    isPremium: true,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CODE (5 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "code-shopify-liquid",
    name: "Sección Shopify Liquid",
    description: "Sección Liquid personalizada para Shopify con schema, settings y CSS modular.",
    category: "code",
    icon: "💧",
    promptTemplate: `Crea una sección Shopify Liquid para {{BRAND_NAME}}.
Nombre de la sección: {{SECTION_NAME}}.
Funcionalidad: {{SECTION_FUNCTIONALITY}}.
Requisitos: {{REQUIREMENTS}}.
Genera: archivo .liquid completo con schema JSON (settings configurables), HTML semántico con clases BEM, CSS modular (sin conflictos con tema), JavaScript mínimo si necesario, presets de section, soporte para bloques si aplica, comentarios en el código.
Compatibilidad: Shopify 2.0 themes.`,
    variables: ["BRAND_NAME", "SECTION_NAME", "SECTION_FUNCTIONALITY", "REQUIREMENTS"],
    tags: ["shopify", "liquid", "theme", "section"],
    outputType: "code",
    preferredModel: "claude-sonnet",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "code-react-component",
    name: "Componente React + TypeScript",
    description: "Componente React con TypeScript, props tipadas, hooks y tests unitarios.",
    category: "code",
    icon: "⚛️",
    promptTemplate: `Crea un componente React + TypeScript para {{COMPONENT_NAME}}.
Propósito: {{COMPONENT_PURPOSE}}.
Props necesarias: {{PROPS_DESCRIPTION}}.
Stack: React 18, TypeScript, Tailwind CSS.
Genera: componente principal con tipos completos, variantes con cva (class-variance-authority), estados (loading/error/empty), custom hook si hay lógica, test unitario con Vitest, Storybook story básica, README de uso con ejemplos.
Nombre de archivo: {{COMPONENT_NAME}}.tsx`,
    variables: ["COMPONENT_NAME", "COMPONENT_PURPOSE", "PROPS_DESCRIPTION"],
    tags: ["react", "typescript", "component", "tailwind"],
    outputType: "code",
    preferredModel: "gpt-4.1",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "code-api-endpoint",
    name: "Endpoint REST API",
    description: "Endpoint Express/Node.js con validación Zod, manejo de errores y tests.",
    category: "code",
    icon: "🔌",
    promptTemplate: `Crea un endpoint REST API para {{ENDPOINT_PURPOSE}}.
Framework: Express/Node.js + TypeScript.
Método HTTP: {{HTTP_METHOD}}. Ruta: {{ROUTE_PATH}}.
Input esperado: {{INPUT_SCHEMA}}.
Genera: router de Express con la ruta completa, validación con Zod, lógica de negocio bien separada, manejo de errores con tipos de error específicos, middleware de autenticación si aplica, documentación JSDoc, test de integración con supertest, tipos TypeScript para request/response.`,
    variables: ["ENDPOINT_PURPOSE", "HTTP_METHOD", "ROUTE_PATH", "INPUT_SCHEMA"],
    tags: ["api", "rest", "express", "nodejs"],
    outputType: "code",
    preferredModel: "gpt-4.1",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "code-database-schema",
    name: "Schema de Base de Datos",
    description: "Schema SQL/Drizzle con relaciones, índices, migrations y seed data.",
    category: "code",
    icon: "🗄️",
    promptTemplate: `Diseña el schema de base de datos para {{SYSTEM_NAME}}.
Entidades principales: {{ENTITIES}}.
Base de datos: {{DB_TYPE}} (PostgreSQL/MySQL/SQLite).
ORM: {{ORM}} (Drizzle/Prisma/raw SQL).
Genera: definición de todas las tablas con tipos correctos, relaciones (FK, índices), constraints de integridad, esquema de Drizzle/Prisma si aplica, migration SQL, seed data de ejemplo, queries comunes pre-escritas, diagrama ERD en texto.`,
    variables: ["SYSTEM_NAME", "ENTITIES", "DB_TYPE", "ORM"],
    tags: ["database", "schema", "sql", "drizzle"],
    outputType: "code",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "code-automation-script",
    name: "Script de Automatización",
    description: "Script Node.js para automatizar tareas repetitivas con logging y manejo de errores.",
    category: "code",
    icon: "🤖",
    promptTemplate: `Crea un script de automatización en Node.js/TypeScript.
Tarea a automatizar: {{TASK_DESCRIPTION}}.
Input: {{INPUT_SOURCE}}.
Output: {{OUTPUT_DESTINATION}}.
Genera: script completo con manejo de errores robusto, logging con pino/winston, progress bar si aplica, retry logic para operaciones de red, dry-run mode, variables de entorno documentadas, README de uso, tests básicos.
Ejecutable con: {{RUNTIME}} (node/bun/tsx).`,
    variables: ["TASK_DESCRIPTION", "INPUT_SOURCE", "OUTPUT_DESTINATION", "RUNTIME"],
    tags: ["automation", "script", "nodejs", "cli"],
    outputType: "code",
    preferredModel: "gpt-4.1",
    estimatedTokens: 2000,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // EMAIL (12 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "email-welcome-sequence",
    name: "Secuencia de Bienvenida (5 emails)",
    description: "Serie de 5 emails onboarding para nuevos suscriptores con storytelling y conversión.",
    category: "email",
    icon: "📧",
    promptTemplate: `Crea una secuencia de 5 emails de bienvenida para {{BRAND_NAME}} ({{SECTOR}}).
Propuesta de valor: {{UVP}}.
Voz de marca: {{BRAND_VOICE}}.
Email 1 (día 0): Bienvenida emocional + acceso rápido + historia del fundador.
Email 2 (día 2): El problema que resuelves — agitar el dolor.
Email 3 (día 4): Tu solución única — caso de éxito real.
Email 4 (día 6): Objeciones más frecuentes — responderlas con empatía.
Email 5 (día 9): CTA directo con oferta de tiempo limitado.
Para cada email: asunto (A/B), preview text, cuerpo HTML + texto plano, CTA.`,
    variables: ["BRAND_NAME", "SECTOR", "UVP", "BRAND_VOICE"],
    tags: ["email", "onboarding", "sequence", "nurture"],
    outputType: "text",
    estimatedTokens: 4000,
    isPremium: true,
  },
  {
    id: "email-abandoned-cart",
    name: "Recuperación de Carrito Abandonado",
    description: "Secuencia de 3 emails para recuperar carritos abandonados en e-commerce.",
    category: "email",
    icon: "🛒",
    promptTemplate: `Crea secuencia de 3 emails para recuperar carrito abandonado de {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}} (€{{PRICE}}).
Sector: {{SECTOR}}. Voz: {{BRAND_VOICE}}.
Email 1 (1h): Recordatorio suave + social proof + botón CTA.
Email 2 (24h): Urgencia leve + beneficios clave + FAQ corta.
Email 3 (72h): Oferta especial final (descuento o bonus) con countdown.
Incluye: asunto, preview text, HTML listo para Klaviyo/Mailchimp, variables de personalización {{nombre}}, {{producto}}, {{precio}}.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "PRICE", "SECTOR", "BRAND_VOICE"],
    tags: ["email", "cart", "recovery", "ecommerce"],
    outputType: "html",
    estimatedTokens: 3000,
    isPremium: false,
  },
  {
    id: "email-newsletter-template",
    name: "Newsletter Semanal (Template Maestro)",
    description: "Template HTML de newsletter semanal reutilizable con secciones modulares.",
    category: "email",
    icon: "📰",
    promptTemplate: `Diseña un template HTML de newsletter para {{BRAND_NAME}}.
Frecuencia: semanal. Sector: {{SECTOR}}.
Color primario: {{PRIMARY_COLOR}}. Tipografía: {{FONT_HEADING}}.
Secciones (modulares, reemplazables): header con logo, titular semana, artículo principal, 3 noticias breves, producto destacado, tip de la semana, CTA final, footer unsubscribe.
Requisitos técnicos: tablas para compatibilidad email, inline CSS, dark mode support, mobile-first (max-width 600px), preheader text, UTM params en todos los links.`,
    variables: ["BRAND_NAME", "SECTOR", "PRIMARY_COLOR", "FONT_HEADING"],
    tags: ["email", "newsletter", "template", "html"],
    outputType: "html",
    estimatedTokens: 3500,
    isPremium: false,
  },
  {
    id: "email-reengagement",
    name: "Reactivación de Inactivos",
    description: "Campaña de 3 emails para reactivar suscriptores inactivos (más de 90 días).",
    category: "email",
    icon: "💤",
    promptTemplate: `Crea 3 emails de reactivación para {{BRAND_NAME}}.
Sector: {{SECTOR}}. Inactivo desde: más de 90 días.
Email 1: "¿Sigues ahí?" — tono conversacional, resumen de lo que se perdieron.
Email 2: Propuesta de valor renovada + novedad reciente de {{BRAND_NAME}}.
Email 3: "Este es tu último email" — FOMO + oferta exclusiva de reactivación.
Incluye: asuntos con emojis, preview text, segmento de limpieza post-campaña.`,
    variables: ["BRAND_NAME", "SECTOR"],
    tags: ["email", "reengagement", "reactivation", "list"],
    outputType: "text",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "email-launch-sequence",
    name: "Secuencia de Lanzamiento de Producto",
    description: "7 emails de lanzamiento de producto desde anticipación hasta cierre de carrito.",
    category: "email",
    icon: "🚀",
    promptTemplate: `Crea secuencia de lanzamiento de 7 emails para {{PRODUCT_NAME}} de {{BRAND_NAME}}.
Precio: {{PRICE}}. Sector: {{SECTOR}}. Fecha apertura: {{LAUNCH_DATE}}.
Email 1 (-7d): Teaser misterioso.
Email 2 (-5d): El problema que resuelve.
Email 3 (-3d): La solución revelada.
Email 4 (-1d): Testimonios + social proof.
Email 5 (día 0): Apertura de carrito — primera oportunidad.
Email 6 (+2d): Objeciones y FAQ.
Email 7 (cierre): Última hora — urgencia máxima.
Cada email: asunto, preview, cuerpo completo, CTA.`,
    variables: ["PRODUCT_NAME", "BRAND_NAME", "PRICE", "SECTOR", "LAUNCH_DATE"],
    tags: ["email", "launch", "product", "sequence"],
    outputType: "text",
    estimatedTokens: 5000,
    isPremium: true,
  },
  {
    id: "email-transactional-templates",
    name: "Pack Emails Transaccionales",
    description: "6 templates HTML transaccionales: confirmación, envío, entrega, review, factura, soporte.",
    category: "email",
    icon: "📋",
    promptTemplate: `Diseña 6 emails transaccionales HTML para {{BRAND_NAME}} ({{SECTOR}}).
Color primario: {{PRIMARY_COLOR}}.
1. Confirmación de pedido: resumen, número, ETA.
2. Pedido enviado: tracking link, mapa progreso.
3. Pedido entregado: CTA dejar review, cross-sell.
4. Solicitud de review: incentivo, estrellas click-to-rate.
5. Factura/recibo: tabla itemizada, datos fiscales.
6. Respuesta soporte: número ticket, tiempo respuesta, FAQ links.
Todos: inline CSS, mobile-first, branding consistente.`,
    variables: ["BRAND_NAME", "SECTOR", "PRIMARY_COLOR"],
    tags: ["email", "transactional", "order", "shipping"],
    outputType: "html",
    estimatedTokens: 4000,
    isPremium: false,
  },
  {
    id: "email-black-friday-campaign",
    name: "Campaña Black Friday / Eventos",
    description: "Campaña completa de 5 emails para Black Friday, Navidad o eventos de venta.",
    category: "email",
    icon: "🔥",
    promptTemplate: `Crea campaña de email para {{EVENT_NAME}} de {{BRAND_NAME}}.
Descuento: {{DISCOUNT}}%. Fechas: {{START_DATE}} – {{END_DATE}}.
Sector: {{SECTOR}}. Voz: {{BRAND_VOICE}}.
Email 1 (-3d): "Early access" para suscriptores VIP.
Email 2 (día 0 mañana): Apertura oficial — todos los deals.
Email 3 (mediodía): Los más vendidos — urgencia media.
Email 4 (-1h cierre): Última hora — últimas unidades.
Email 5 (post-venta): Gracias + próxima acción (review, referral).
FOMO, social proof, countdown en cada email.`,
    variables: ["EVENT_NAME", "BRAND_NAME", "DISCOUNT", "START_DATE", "END_DATE", "SECTOR", "BRAND_VOICE"],
    tags: ["email", "blackfriday", "campaign", "sales"],
    outputType: "text",
    estimatedTokens: 3500,
    isPremium: false,
  },
  {
    id: "email-referral-program",
    name: "Email Programa de Referidos",
    description: "Emails para lanzar y mantener un programa de referidos activo.",
    category: "email",
    icon: "🤝",
    promptTemplate: `Crea emails para el programa de referidos de {{BRAND_NAME}}.
Incentivo: {{REFERRAL_REWARD}} por referido. Sector: {{SECTOR}}.
Email 1 — Anuncio del programa: mecánica, beneficio, CTA "Obtener mi link".
Email 2 — Recordatorio (1 semana): cuántos han referido ya, leaderboard ficticio.
Email 3 — Celebración de primer referido: gracias + próximo reto.
Incluye: asunto, preview text, diseño HTML con botón de compartir, textos para copiar-pegar en WhatsApp/Instagram.`,
    variables: ["BRAND_NAME", "REFERRAL_REWARD", "SECTOR"],
    tags: ["email", "referral", "viral", "program"],
    outputType: "html",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "email-winback-discount",
    name: "Win-back con Oferta Personalizada",
    description: "Email único de win-back con descuento personalizado para clientes perdidos.",
    category: "email",
    icon: "💝",
    promptTemplate: `Crea un email de win-back premium para {{BRAND_NAME}}.
Producto más comprado: {{TOP_PRODUCT}}. Sector: {{SECTOR}}.
Oferta: {{DISCOUNT}}% solo para este cliente durante 48h.
Tono: íntimo, personal, desde el fundador.
Incluye: asunto tipo "una cosa más antes de irte", preview text de misterio, cuerpo en primera persona del fundador, historia breve, oferta con código único, countdown 48h, PS poderoso.`,
    variables: ["BRAND_NAME", "TOP_PRODUCT", "SECTOR", "DISCOUNT"],
    tags: ["email", "winback", "churn", "personalization"],
    outputType: "text",
    estimatedTokens: 1500,
    isPremium: false,
  },
  {
    id: "email-post-purchase-upsell",
    name: "Post-Compra: Upsell y Review",
    description: "Flujo de 3 emails post-compra para maximizar LTV: review + upsell + loyalty.",
    category: "email",
    icon: "⬆️",
    promptTemplate: `Diseña flujo post-compra de 3 emails para {{BRAND_NAME}}.
Producto comprado: {{PRODUCT_NAME}}. Upsell natural: {{UPSELL_PRODUCT}}.
Email 1 (+3d entrega): Onboarding del producto, tips de uso, soporte.
Email 2 (+7d): Solicitud de review + descuento próxima compra.
Email 3 (+14d): Upsell {{UPSELL_PRODUCT}} con lógica "perfecto para quienes tienen {{PRODUCT_NAME}}".
Todos con asunto, preview, HTML mobile-first.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "UPSELL_PRODUCT"],
    tags: ["email", "post-purchase", "upsell", "ltv"],
    outputType: "html",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "email-saas-trial-nurture",
    name: "Nurture de Trial SaaS",
    description: "Secuencia de 7 emails para convertir usuarios de trial en clientes de pago.",
    category: "email",
    icon: "⚡",
    promptTemplate: `Crea secuencia de 7 emails para convertir trials de {{SAAS_NAME}}.
Duración del trial: {{TRIAL_DAYS}} días. Precio plan principal: {{PRICE}}.
Funcionalidad clave: {{KEY_FEATURE}}. Sector: {{SECTOR}}.
Día 0: Bienvenida + Quick Win (primera victoria en 5 min).
Día 2: Feature destacada + cómo usarla.
Día 4: Caso de éxito de cliente real.
Día 7: "Estás a mitad del trial" + progreso del usuario.
Día 10: Objeciones + FAQ precios.
Día 13: "Mañana termina el trial" + oferta especial.
Día 14: Último día — conversión o pausa.`,
    variables: ["SAAS_NAME", "TRIAL_DAYS", "PRICE", "KEY_FEATURE", "SECTOR"],
    tags: ["email", "saas", "trial", "conversion"],
    outputType: "text",
    estimatedTokens: 4000,
    isPremium: true,
  },
  {
    id: "email-cold-outreach-b2b",
    name: "Cold Outreach B2B (Secuencia 4 emails)",
    description: "Secuencia de prospección en frío para ventas B2B con personalización y seguimientos.",
    category: "email",
    icon: "🎯",
    promptTemplate: `Crea secuencia de 4 emails de cold outreach B2B para {{BRAND_NAME}}.
Sector objetivo: {{TARGET_SECTOR}}. Cargo objetivo: {{TARGET_ROLE}}.
Propuesta de valor: {{UVP}}.
Email 1: Apertura con problema específico del sector, sin pitch.
Email 2 (+3d): Follow-up con caso de éxito relevante + pregunta de calificación.
Email 3 (+6d): Ángulo diferente — ROI o dato de la industria.
Email 4 (+10d): Cierre suave "Romper el hielo" — ¿Tiene sentido charlar 15 min?
Asuntos: <5 palabras, personalizables con {{nombre}} y {{empresa}}.`,
    variables: ["BRAND_NAME", "TARGET_SECTOR", "TARGET_ROLE", "UVP"],
    tags: ["email", "b2b", "cold-outreach", "sales"],
    outputType: "text",
    estimatedTokens: 2500,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // VIDEO (10 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "video-ugc-script",
    name: "Script UGC (User Generated Content)",
    description: "Guion para vídeo UGC auténtico — creador de contenido hablando a cámara.",
    category: "video",
    icon: "🎥",
    promptTemplate: `Crea un script UGC para {{BRAND_NAME}} ({{SECTOR}}).
Producto: {{PRODUCT_NAME}}. Duración objetivo: {{DURATION}} segundos.
Tipo de creador: {{CREATOR_TYPE}} (lifestyle, review, tutorial, testimonio).
Hook (primeros 3s): problema o pregunta que engancha.
Desarrollo: historia personal de descubrimiento del producto.
Demostración: mostrar el producto en uso real.
Resultado: antes/después emocional.
CTA: natural, no forzado.
Incluye: notas de dirección, tono de voz, 3 variantes de hook para A/B test.`,
    variables: ["BRAND_NAME", "SECTOR", "PRODUCT_NAME", "DURATION", "CREATOR_TYPE"],
    tags: ["video", "ugc", "script", "creator"],
    outputType: "text",
    estimatedTokens: 1800,
    isPremium: false,
  },
  {
    id: "video-reels-hooks",
    name: "30 Hooks Virales para Reels/TikTok",
    description: "30 hooks de apertura de vídeo diseñados para máxima retención en primeros 3 segundos.",
    category: "video",
    icon: "🎣",
    promptTemplate: `Genera 30 hooks virales para vídeos de {{BRAND_NAME}} ({{SECTOR}}).
Audiencia: {{TARGET_AUDIENCE}}. Tono: {{BRAND_VOICE}}.
Categorías (6 hooks cada una):
1. Hooks de problema/dolor: empiezan con la frustración del cliente.
2. Hooks de curiosidad: preguntas que no pueden no contestar.
3. Hooks de revelación: "Nadie te dice que..."
4. Hooks de resultado: "Cómo conseguí X en Y días".
5. Hooks de controversia: opiniones contrarias al mainstream.
Para cada hook: texto de pantalla + voz en off (si difieren).`,
    variables: ["BRAND_NAME", "SECTOR", "TARGET_AUDIENCE", "BRAND_VOICE"],
    tags: ["video", "hooks", "reels", "tiktok"],
    outputType: "text",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "video-youtube-script-long",
    name: "Script YouTube Long-Form",
    description: "Guion completo para vídeo YouTube de 10-15 minutos con SEO y retención optimizada.",
    category: "video",
    icon: "▶️",
    promptTemplate: `Crea un script completo de YouTube (10-15 min) para {{BRAND_NAME}}.
Tema: {{VIDEO_TOPIC}}. Keyword SEO: {{KEYWORD}}.
Audiencia: {{TARGET_AUDIENCE}}. Tono: {{BRAND_VOICE}}.
Incluye: hook 0-30s (patrón), intro con promesa, capítulos con timestamp, CTA de suscripción natural, mid-roll CTA, outro con siguiente vídeo.
Técnicas: pacing rápido, loops abiertos, callbacks, patrones 3-partite.
También: título SEO optimizado (3 opciones), descripción con keywords, tags, thumbnail concept.`,
    variables: ["BRAND_NAME", "VIDEO_TOPIC", "KEYWORD", "TARGET_AUDIENCE", "BRAND_VOICE"],
    tags: ["video", "youtube", "longform", "seo"],
    outputType: "text",
    estimatedTokens: 4000,
    isPremium: true,
  },
  {
    id: "video-ad-30s",
    name: "Guion Anuncio en Vídeo 30s",
    description: "Guion de anuncio de 30 segundos para Meta Ads, YouTube o TikTok.",
    category: "video",
    icon: "📺",
    promptTemplate: `Crea 3 variantes de guion de anuncio de 30 segundos para {{BRAND_NAME}}.
Producto: {{PRODUCT_NAME}}. Oferta: {{OFFER}}.
Audiencia: {{TARGET_AUDIENCE}}. Plataforma: {{PLATFORM}}.
Variante 1 — Pain/Solution: problema → agitación → solución → CTA.
Variante 2 — Social Proof: testimonio → resultado → oferta → CTA.
Variante 3 — Curiosidad/Reveal: hook misterioso → revelación → demo → CTA.
Para cada variante: texto en pantalla, voz en off, descripción visual escena a escena, notas de producción.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "OFFER", "TARGET_AUDIENCE", "PLATFORM"],
    tags: ["video", "ad", "script", "30s"],
    outputType: "text",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "video-tutorial-script",
    name: "Tutorial / How-To Video",
    description: "Guion estructurado para vídeo tutorial de producto o servicio.",
    category: "video",
    icon: "🎓",
    promptTemplate: `Crea un guion tutorial de {{BRAND_NAME}} sobre {{TUTORIAL_TOPIC}}.
Audiencia: {{TARGET_AUDIENCE}}. Duración: {{DURATION}} minutos.
Nivel: {{SKILL_LEVEL}} (principiante/intermedio/avanzado).
Estructura: problema que resuelve el tutorial, requisitos previos, pasos numerados con timestamps, resultado final demostrado, troubleshooting de errores comunes, CTA al producto.
Incluye: intro de 30s con promesa clara, transiciones entre pasos, recapitulación al 50% y al final.`,
    variables: ["BRAND_NAME", "TUTORIAL_TOPIC", "TARGET_AUDIENCE", "DURATION", "SKILL_LEVEL"],
    tags: ["video", "tutorial", "howto", "education"],
    outputType: "text",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "video-shorts-batch",
    name: "Batch de 10 Shorts/Reels",
    description: "10 guiones de vídeos cortos (30-60s) para un mismo tema o producto.",
    category: "video",
    icon: "⚡",
    promptTemplate: `Genera 10 guiones de Shorts/Reels para {{BRAND_NAME}} ({{SECTOR}}).
Tema base: {{CONTENT_PILLAR}}. Duración: 30-60s cada uno.
Audiencia: {{TARGET_AUDIENCE}}.
Formato para cada vídeo: número, hook (3s), desarrollo (25-50s), CTA (5s), hashtags (8).
Varía los formatos: tip rápido, mito vs realidad, antes/después, pregunta respuesta, detrás de escenas, dato sorprendente, tutorial express, testimonial reenacted.`,
    variables: ["BRAND_NAME", "SECTOR", "CONTENT_PILLAR", "TARGET_AUDIENCE"],
    tags: ["video", "shorts", "reels", "batch"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: false,
  },
  {
    id: "video-seedance-prompt",
    name: "Prompt Generación Vídeo IA (Seedance/Kling)",
    description: "Prompts optimizados para generación de vídeo con Seedance 2, Kling 2.1 u otros modelos.",
    category: "video",
    icon: "🤖",
    promptTemplate: `Genera 10 prompts optimizados para generación de vídeo IA de {{BRAND_NAME}} ({{SECTOR}}).
Modelo objetivo: {{VIDEO_MODEL}} (Seedance 2 / Kling 2.1 / Hailuo / Veo 3).
Estilo visual: {{VISUAL_STYLE}}.
Para cada prompt:
- Descripción de escena (sujeto, acción, entorno, iluminación, cámara).
- Tipo de movimiento de cámara (rack focus, dolly, steadicam, etc.).
- Paleta de colores y mood.
- Duración sugerida (5s / 10s / 15s).
- Negative prompt sugerido.
Variedad: producto, lifestyle, modelo, naturaleza, abstract brand.`,
    variables: ["BRAND_NAME", "SECTOR", "VIDEO_MODEL", "VISUAL_STYLE"],
    tags: ["video", "ai", "seedance", "prompt"],
    outputType: "text",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "video-testimonial-interview",
    name: "Guion Entrevista/Testimonial",
    description: "Preguntas y guion para grabar un testimonio de cliente convincente.",
    category: "video",
    icon: "🎤",
    promptTemplate: `Crea guion de entrevista/testimonial para cliente de {{BRAND_NAME}}.
Producto/servicio: {{PRODUCT_NAME}}. Sector del cliente: {{CLIENT_SECTOR}}.
Resultado obtenido: {{KEY_RESULT}}.
Incluye:
- 12 preguntas que llevan al cliente a contar una historia natural (antes → durante → después).
- Frases de transición para el entrevistador.
- Errores comunes a evitar en la grabación.
- Guion de apertura y cierre del vídeo.
- Textos para gráficos de pantalla (nombre, empresa, resultado).
- Ideas de edición: cortes, música, lower thirds.`,
    variables: ["BRAND_NAME", "PRODUCT_NAME", "CLIENT_SECTOR", "KEY_RESULT"],
    tags: ["video", "testimonial", "interview", "social-proof"],
    outputType: "text",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "video-vsls-sales",
    name: "VSL (Video Sales Letter) Completo",
    description: "Guion completo de carta de ventas en vídeo de 20-30 minutos para alta conversión.",
    category: "video",
    icon: "💰",
    promptTemplate: `Crea un VSL completo para {{PRODUCT_NAME}} de {{BRAND_NAME}}.
Precio: {{PRICE}}. Audiencia: {{TARGET_AUDIENCE}}. Sector: {{SECTOR}}.
Estructura probada de VSL:
1. Hook + promesa (2 min): resultado extraordinario en tiempo récord.
2. Historia de credibilidad (3 min): de dónde vengo, por qué me importa.
3. Agitación del problema (4 min): el dolor en detalle.
4. Revelación de la solución (5 min): el mecanismo único.
5. Social proof (4 min): 3 casos de éxito detallados.
6. Presentación de la oferta (5 min): qué incluye, valor vs precio.
7. Garantía + cierre (3 min): sin riesgo, últimas objeciones.
8. CTA urgencia (2 min): bonus por acción inmediata.`,
    variables: ["PRODUCT_NAME", "BRAND_NAME", "PRICE", "TARGET_AUDIENCE", "SECTOR"],
    tags: ["video", "vsl", "sales", "conversion"],
    outputType: "text",
    estimatedTokens: 6000,
    isPremium: true,
  },
  {
    id: "video-podcast-repurpose",
    name: "Repurposing de Podcast a Vídeo",
    description: "Transforma un episodio de podcast en 10 clips de vídeo para redes sociales.",
    category: "video",
    icon: "🎙️",
    promptTemplate: `Transforma el siguiente fragmento de podcast de {{BRAND_NAME}} en contenido de vídeo.
Tema del episodio: {{EPISODE_TOPIC}}. Invitado: {{GUEST_NAME}}.
Fragmento o resumen: {{TRANSCRIPT_SUMMARY}}.
Genera:
1. 10 clips de 30-60s con: timestamp sugerido, gancho para pantalla, caption para redes.
2. 3 titulares para Shorts/Reels.
3. Descripción de YouTube del episodio completo (800 palabras, SEO).
4. 5 tweets/hilos de X con las mejores ideas.
5. Post de LinkedIn (400 palabras, formato carrusel).`,
    variables: ["BRAND_NAME", "EPISODE_TOPIC", "GUEST_NAME", "TRANSCRIPT_SUMMARY"],
    tags: ["video", "podcast", "repurpose", "content"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // AGENCIA & SAAS (10 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "agencia-propuesta-comercial",
    name: "Propuesta Comercial de Agencia",
    description: "Propuesta completa de agencia con diagnóstico, solución, plan y precios.",
    category: "commerce",
    icon: "📄",
    promptTemplate: `Crea una propuesta comercial profesional para {{AGENCY_NAME}} dirigida a {{CLIENT_NAME}} ({{CLIENT_SECTOR}}).
Servicio propuesto: {{SERVICE}}.
Precio: {{PRICE}}.
Incluye: executive summary (1 párrafo), diagnóstico de la situación actual del cliente, propuesta de solución con metodología, fases del proyecto con timeline, equipo asignado, case studies relevantes, paquetes de precios (3 opciones), garantías, próximos pasos con CTA urgente.
Formato: estructura clara, lenguaje ejecutivo, métricas de éxito definidas.`,
    variables: ["AGENCY_NAME", "CLIENT_NAME", "CLIENT_SECTOR", "SERVICE", "PRICE"],
    tags: ["agencia", "propuesta", "comercial", "b2b"],
    outputType: "text",
    estimatedTokens: 3500,
    isPremium: false,
  },
  {
    id: "saas-onboarding-flow",
    name: "Flujo de Onboarding SaaS",
    description: "Diseño completo del onboarding de un SaaS: pasos, mensajes, tooltips y métricas.",
    category: "code",
    icon: "🗺️",
    promptTemplate: `Diseña el flujo de onboarding completo para {{SAAS_NAME}}.
Feature central: {{KEY_FEATURE}}. Tipo de usuario: {{USER_TYPE}}.
Precio: {{PRICE_PLAN}}.
Entrega:
1. Mapa de pasos del onboarding (máx. 7 pasos, cada uno con objetivo).
2. Textos de cada pantalla: título, subtítulo, CTA, tooltip.
3. Email de activación del primer paso.
4. In-app messages para días 1, 3, 7 del trial.
5. Definición del "Aha! Moment" y cómo acelerarlo.
6. Métricas de onboarding: completion rate, time-to-value, activation rate.
7. Checklist de quick wins para el usuario nuevo.`,
    variables: ["SAAS_NAME", "KEY_FEATURE", "USER_TYPE", "PRICE_PLAN"],
    tags: ["saas", "onboarding", "ux", "activation"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: true,
  },
  {
    id: "saas-pricing-strategy",
    name: "Estrategia de Precios SaaS",
    description: "Análisis y propuesta de estructura de precios para un SaaS con 3 planes.",
    category: "analytics",
    icon: "💎",
    promptTemplate: `Define la estrategia de precios para {{SAAS_NAME}}.
Coste por usuario: {{COGS}}. Competidores: {{COMPETITORS}}.
Segmentos objetivo: {{SEGMENTS}}.
Genera:
1. Análisis de 3 modelos de pricing (freemium, trial, demo).
2. Propuesta de 3 planes con nombre, precio, features y límites.
3. Tabla comparativa de features por plan.
4. Estrategia de upsell: triggers para upgrade natural.
5. Página de precios copywriting completa.
6. Psicología de precios aplicada (anchoring, decoy, charm).
7. Proyección de ARPU y LTV por plan.`,
    variables: ["SAAS_NAME", "COGS", "COMPETITORS", "SEGMENTS"],
    tags: ["saas", "pricing", "strategy", "revenue"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: true,
  },
  {
    id: "saas-landing-page",
    name: "Landing Page SaaS Completa",
    description: "Landing page HTML completa para SaaS con todas las secciones de conversión.",
    category: "design",
    icon: "🖥️",
    promptTemplate: `Crea una landing page HTML/CSS/JS completa para {{SAAS_NAME}}.
UVP: {{UVP}}. Precio desde: {{PRICE}}. Sector: {{SECTOR}}.
Colores: {{PRIMARY_COLOR}}, {{SECONDARY_COLOR}}. Font: {{FONT}}.
Secciones obligatorias:
- Hero: headline impactante + sub + CTA + hero image/mockup.
- Social proof: logos clientes + número usuarios.
- Features: 6 features con icono, título, descripción.
- How it works: 3 pasos visuales.
- Testimonios: 3 con foto, nombre, empresa, resultado.
- Pricing: 3 planes con toggle mensual/anual.
- FAQ: 6 preguntas.
- CTA final: urgencia + garantía.
Stack: HTML puro + CSS variables + JS vanilla + GSAP CDN.`,
    variables: ["SAAS_NAME", "UVP", "PRICE", "SECTOR", "PRIMARY_COLOR", "SECONDARY_COLOR", "FONT"],
    tags: ["saas", "landing", "conversion", "html"],
    outputType: "html",
    preferredModel: "claude-opus",
    estimatedTokens: 7000,
    isPremium: true,
  },
  {
    id: "agencia-auditoria-digital",
    name: "Auditoría Digital Completa",
    description: "Informe de auditoría digital para presentar a un cliente potencial.",
    category: "analytics",
    icon: "🔍",
    promptTemplate: `Crea el template de auditoría digital de {{AGENCY_NAME}} para {{CLIENT_NAME}}.
URL del cliente: {{CLIENT_URL}}. Sector: {{SECTOR}}.
Secciones del informe:
1. Resumen ejecutivo (semáforo: rojo/amarillo/verde).
2. Presencia web: velocidad, mobile, UX, CRO.
3. SEO: on-page, off-page, técnico, keywords.
4. Redes sociales: presencia, engagement, frecuencia.
5. Publicidad pagada: activos detectados, estimación de gasto.
6. Email marketing: formularios, secuencias detectadas.
7. Plan de acción: 3 quick wins + 5 acciones a 90 días.
8. Propuesta de servicio de {{AGENCY_NAME}}.
Formato visual con tablas, puntuaciones 1-10, semáforos.`,
    variables: ["AGENCY_NAME", "CLIENT_NAME", "CLIENT_URL", "SECTOR"],
    tags: ["agencia", "auditoria", "digital", "report"],
    outputType: "text",
    estimatedTokens: 4000,
    isPremium: false,
  },
  {
    id: "agencia-case-study",
    name: "Case Study de Agencia",
    description: "Case study narrativo de resultado de cliente para captar leads B2B.",
    category: "content",
    icon: "📈",
    promptTemplate: `Crea un case study de {{AGENCY_NAME}} sobre el cliente {{CLIENT_NAME}} ({{SECTOR}}).
Resultado conseguido: {{KEY_RESULT}}.
Duración del proyecto: {{DURATION}}.
Estructura:
1. Titular con métrica del resultado (Cómo [Cliente] consiguió [Resultado] en [Tiempo]).
2. El desafío: situación inicial con datos.
3. Nuestra solución: metodología y herramientas.
4. Implementación: fases, timeline, equipo.
5. Resultados: métricas antes/después con gráficos descriptivos.
6. Cita del cliente (testimonial).
7. Conclusión + CTA "¿Quieres los mismos resultados?".
Versión larga (blog) + versión corta (PDF 1 página) + LinkedIn post.`,
    variables: ["AGENCY_NAME", "CLIENT_NAME", "SECTOR", "KEY_RESULT", "DURATION"],
    tags: ["agencia", "case-study", "b2b", "proof"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: false,
  },
  {
    id: "saas-product-roadmap",
    name: "Product Roadmap & PRD",
    description: "Documento de requisitos de producto (PRD) y roadmap trimestral para SaaS.",
    category: "code",
    icon: "🗓️",
    promptTemplate: `Crea el PRD y roadmap para {{SAAS_NAME}}.
Feature a diseñar: {{FEATURE_NAME}}.
Usuarios que lo solicitan: {{USER_TYPE}}. Impacto esperado: {{EXPECTED_IMPACT}}.
PRD incluye: problema que resuelve, usuarios afectados, user stories (formato Gherkin), criterios de aceptación, wireframe en texto, métricas de éxito (KPIs), dependencias técnicas, estimación de esfuerzo, riesgos.
Roadmap trimestral: Now (este sprint), Next (próximo mes), Later (Q3-Q4), Backlog.
Formato: Notion-ready con tablas y headers.`,
    variables: ["SAAS_NAME", "FEATURE_NAME", "USER_TYPE", "EXPECTED_IMPACT"],
    tags: ["saas", "product", "roadmap", "prd"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: false,
  },
  {
    id: "agencia-onboarding-cliente",
    name: "Onboarding de Nuevo Cliente (Agencia)",
    description: "Kit completo de onboarding para nuevos clientes de agencia: docs, kick-off, Q&A.",
    category: "commerce",
    icon: "🤝",
    promptTemplate: `Crea el kit de onboarding de cliente para {{AGENCY_NAME}}.
Servicio: {{SERVICE}}. Duración del proyecto: {{DURATION}}.
Incluye:
1. Email de bienvenida (tono cálido, profesional).
2. Cuestionario de kick-off (20 preguntas clave para entender al cliente).
3. Agenda de reunión de kick-off (60 min).
4. Documento de expectativas y entregables firmado.
5. Guía de "Cómo trabajamos" (canales de comunicación, tiempos de respuesta, flujo de aprobaciones).
6. Checklist de información necesaria del cliente.
7. Celebración de hitos: qué comunicar y cuándo.`,
    variables: ["AGENCY_NAME", "SERVICE", "DURATION"],
    tags: ["agencia", "onboarding", "cliente", "proceso"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: false,
  },
  {
    id: "tpv-guion-ventas",
    name: "Guión de Ventas Punto de Venta (TPV)",
    description: "Guión de ventas para comercios físicos: bienvenida, needs, objeciones y cierre.",
    category: "commerce",
    icon: "🏪",
    promptTemplate: `Crea un guión de ventas para el personal de {{BRAND_NAME}} ({{SECTOR}}).
Ticket medio: {{AVG_TICKET}}. Producto estrella: {{HERO_PRODUCT}}.
Fases del guión:
1. Saludo y bienvenida (sin presionar): 3 variantes de apertura.
2. Descubrimiento de necesidades: 5 preguntas de diagnóstico.
3. Presentación del producto: estructura beneficio → evidencia → invitación.
4. Manejo de las 5 objeciones más comunes (precio, lo pienso, lo encuentro más barato).
5. Técnicas de cierre: alternativa, urgencia, resumen de beneficios.
6. Upsell y cross-sell: cómo proponer complementos de forma natural.
7. Fidelización: cómo capturar datos para email/WhatsApp.`,
    variables: ["BRAND_NAME", "SECTOR", "AVG_TICKET", "HERO_PRODUCT"],
    tags: ["tpv", "ventas", "guion", "retail"],
    outputType: "text",
    estimatedTokens: 3000,
    isPremium: false,
  },
  {
    id: "legal-politica-privacidad",
    name: "Política de Privacidad & Cookies (RGPD)",
    description: "Política de privacidad y cookies compliant con RGPD para web española/europea.",
    category: "content",
    icon: "⚖️",
    promptTemplate: `Genera la política de privacidad y cookies RGPD-compliant para {{BRAND_NAME}}.
Dominio: {{WEBSITE_URL}}. CIF/NIF: {{TAX_ID}}. País: {{COUNTRY}}.
Email de contacto DPD: {{DPO_EMAIL}}.
Datos recogidos: {{DATA_COLLECTED}} (ej: nombre, email, IP, cookies analytics).
Finalidades: {{PURPOSES}} (marketing, analítica, mejora servicio).
Terceros: {{THIRD_PARTIES}} (Google Analytics, Meta Pixel, Mailchimp).
Incluye: política de privacidad completa, política de cookies (categorías necesarias/funcionales/analíticas/marketing), banner de consentimiento con textos, período de conservación, derechos ARCO-POL, mecanismo de reclamación a AEPD.`,
    variables: ["BRAND_NAME", "WEBSITE_URL", "TAX_ID", "COUNTRY", "DPO_EMAIL", "DATA_COLLECTED", "PURPOSES", "THIRD_PARTIES"],
    tags: ["legal", "rgpd", "privacidad", "cookies"],
    outputType: "text",
    estimatedTokens: 4000,
    isPremium: false,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // UGC & REDES SOCIALES (8 skills)
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "social-ugc-brief",
    name: "Brief para Creadores UGC",
    description: "Brief profesional para contratar creadores de contenido UGC para tu marca.",
    category: "social",
    icon: "📝",
    promptTemplate: `Crea un brief para creadores UGC de {{BRAND_NAME}} ({{SECTOR}}).
Producto: {{PRODUCT_NAME}}. Presupuesto por vídeo: {{BUDGET}}.
Plataforma objetivo: {{PLATFORM}} (TikTok/Instagram/YouTube Shorts).
El brief incluye:
1. Descripción de la marca y el producto (2 párrafos).
2. El tono y la personalidad buscada en el creador.
3. Requisitos técnicos del vídeo (duración, formato, calidad).
4. Estructura obligatoria: hook, demo, CTA.
5. Elementos a incluir y a evitar (do's & don'ts).
6. Claims permitidos y prohibidos (sin exageraciones).
7. Proceso de aprobación y revisiones.
8. Derechos de uso y exclusividad.`,
    variables: ["BRAND_NAME", "SECTOR", "PRODUCT_NAME", "BUDGET", "PLATFORM"],
    tags: ["ugc", "creator", "brief", "social"],
    outputType: "text",
    estimatedTokens: 2000,
    isPremium: false,
  },
  {
    id: "social-content-calendar",
    name: "Calendario de Contenidos (30 días)",
    description: "Calendario editorial completo de 30 días para redes sociales de una marca.",
    category: "social",
    icon: "📅",
    promptTemplate: `Crea un calendario de contenidos de 30 días para {{BRAND_NAME}} ({{SECTOR}}).
Plataformas: {{PLATFORMS}}. Frecuencia: {{FREQUENCY}} publicaciones/semana.
Pilares de contenido: {{CONTENT_PILLARS}}.
Para cada publicación: día, plataforma, pilar, tipo de contenido (reel/carrusel/story/post), idea desarrollada, caption completo con CTA, hashtags (15), nota visual o referencia.
Distribuye: 40% educativo, 30% entretenimiento, 20% social proof, 10% venta directa.
Incluye: 4 posts virales tipo lista/ranking, 2 behind-the-scenes, 2 colaboraciones propuestas.`,
    variables: ["BRAND_NAME", "SECTOR", "PLATFORMS", "FREQUENCY", "CONTENT_PILLARS"],
    tags: ["social", "calendar", "content", "planning"],
    outputType: "text",
    estimatedTokens: 5000,
    isPremium: true,
  },
  {
    id: "social-instagram-captions-batch",
    name: "Batch 30 Captions de Instagram",
    description: "30 captions optimizadas para Instagram con emojis, CTA y hashtags por sector.",
    category: "social",
    icon: "📸",
    promptTemplate: `Genera 30 captions para Instagram de {{BRAND_NAME}} ({{SECTOR}}).
Voz de marca: {{BRAND_VOICE}}. CTA recurrente: {{CTA_TEXT}}.
Distribuye en 6 tonos (5 de cada): inspiracional, educativo, humor, venta suave, historia, pregunta.
Cada caption: 3-5 líneas máximo, emojis estratégicos, salto de línea antes del CTA, 15 hashtags (mix popular + nicho + marca), variación del CTA.
Las 10 mejores: versión con hook de historia de 8-10 líneas.`,
    variables: ["BRAND_NAME", "SECTOR", "BRAND_VOICE", "CTA_TEXT"],
    tags: ["social", "instagram", "captions", "batch"],
    outputType: "text",
    estimatedTokens: 4000,
    isPremium: false,
  },
  {
    id: "social-linkedin-thought-leadership-10",
    name: "Thought Leadership LinkedIn — 10 Posts CEO",
    description: "10 posts de LinkedIn para posicionar al fundador/CEO como referente del sector.",
    category: "social",
    icon: "💼",
    promptTemplate: `Crea 10 posts de LinkedIn para {{AUTHOR_NAME}}, {{AUTHOR_ROLE}} de {{BRAND_NAME}}.
Sector: {{SECTOR}}. Expertise: {{EXPERTISE_AREAS}}.
Cada post: 800-1200 caracteres, hook de 1 línea brutal, historia o dato sorprendente, insight accionable, CTA suave (sin vender).
Formatos variados: opinión controversial, lección aprendida, error cometido, predicción de sector, historia de cliente, detrás de escenas, dato vs. mito, hilo narrativo.
Incluir: emojis estratégicos, espaciado visual, hashtags de nicho (3-5).`,
    variables: ["AUTHOR_NAME", "AUTHOR_ROLE", "BRAND_NAME", "SECTOR", "EXPERTISE_AREAS"],
    tags: ["linkedin", "thought-leadership", "b2b", "personal-brand"],
    outputType: "text",
    estimatedTokens: 3500,
    isPremium: false,
  },
  {
    id: "social-tiktok-strategy",
    name: "Estrategia TikTok 90 días",
    description: "Plan estratégico de TikTok de 90 días con nichos, formatos y métricas.",
    category: "social",
    icon: "🎵",
    promptTemplate: `Crea una estrategia TikTok de 90 días para {{BRAND_NAME}} ({{SECTOR}}).
Objetivo: {{GOAL}} (awareness/ventas/comunidad). Audiencia: {{TARGET_AUDIENCE}}.
Plan incluye:
Fase 1 (0-30d): Test de 10 formatos distintos, análisis de hooks, benchmark de competidores.
Fase 2 (30-60d): Doblar lo que funciona, eliminar lo que no, primera colaboración con creador.
Fase 3 (60-90d): Escalar formatos ganadores, campaña de hashtag, estrategia de duets/stitches.
También: 20 ideas de vídeo para el mes 1, guía de trending sounds, estructura de perfil optimizada, métricas de éxito por fase.`,
    variables: ["BRAND_NAME", "SECTOR", "GOAL", "TARGET_AUDIENCE"],
    tags: ["tiktok", "strategy", "social", "90days"],
    outputType: "text",
    estimatedTokens: 3500,
    isPremium: true,
  },
  {
    id: "social-viral-giveaway",
    name: "Sorteo/Giveaway Viral",
    description: "Estrategia completa para un sorteo viral en redes: mecánica, posts, emails.",
    category: "social",
    icon: "🎁",
    promptTemplate: `Diseña un giveaway viral para {{BRAND_NAME}} ({{SECTOR}}).
Premio: {{PRIZE}} (valor {{PRIZE_VALUE}}€). Plataforma: {{PLATFORM}}.
Duración: {{DURATION}} días.
Incluye:
1. Mecánica de participación (seguir, etiquetar, compartir, UGC).
2. Post de anuncio completo con caption e imagen concept.
3. 3 posts de recordatorio durante el giveaway.
4. Post de ganador y cierre.
5. Email a participantes (no ganadores) con consolation offer.
6. Métricas a trackear: nuevos seguidores, alcance, UGC generado.
7. FAQ del giveaway + términos simplificados.`,
    variables: ["BRAND_NAME", "SECTOR", "PRIZE", "PRIZE_VALUE", "PLATFORM", "DURATION"],
    tags: ["social", "giveaway", "viral", "community"],
    outputType: "text",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "social-whatsapp-broadcast",
    name: "Secuencia WhatsApp Business",
    description: "10 mensajes de broadcast para WhatsApp Business: welcome, nurture y ventas.",
    category: "social",
    icon: "💬",
    promptTemplate: `Crea 10 mensajes de WhatsApp Business para {{BRAND_NAME}} ({{SECTOR}}).
CTA final: {{CTA_GOAL}}. Voz: {{BRAND_VOICE}}.
Mensajes: bienvenida inmediata, valor día 1, historia de cliente día 3, tip exclusivo día 5, pregunta de calificación día 7, oferta especial día 9, recordatorio día 11, bonus día 13, urgencia día 14, cierre.
Cada mensaje: máx. 160 caracteres para preview, emojis coherentes, 1 solo CTA, link trackeado, horario sugerido de envío.
Incluye: plantilla de respuestas automáticas para FAQs + flujo de respuesta humana.`,
    variables: ["BRAND_NAME", "SECTOR", "CTA_GOAL", "BRAND_VOICE"],
    tags: ["whatsapp", "broadcast", "social", "nurture"],
    outputType: "text",
    estimatedTokens: 2500,
    isPremium: false,
  },
  {
    id: "social-community-management",
    name: "Manual de Community Management",
    description: "Manual completo de CM: tono, respuestas, crisis, métricas y procesos.",
    category: "social",
    icon: "🌐",
    promptTemplate: `Crea el manual de community management para {{BRAND_NAME}} ({{SECTOR}}).
Redes activas: {{PLATFORMS}}. Tamaño comunidad: {{COMMUNITY_SIZE}}.
Incluye:
1. Guía de tono y voz en redes (con ejemplos correcto/incorrecto).
2. Banco de respuestas: 20 comentarios frecuentes + respuesta modelo.
3. Protocolo de gestión de crisis (trolls, quejas públicas, errores de marca).
4. Plantilla de reporte semanal de comunidad.
5. Proceso de identificación y fidelización de brand advocates.
6. Reglas de la comunidad (para grupos/discord/foros).
7. Métricas de CM: engagement rate, sentiment, response time.`,
    variables: ["BRAND_NAME", "SECTOR", "PLATFORMS", "COMMUNITY_SIZE"],
    tags: ["social", "community", "management", "guide"],
    outputType: "text",
    estimatedTokens: 3500,
    isPremium: false,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getSkillById(id: string): Skill | undefined {
  return SKILLS_LIBRARY.find(s => s.id === id);
}

export function getSkillsByCategory(category: Skill["category"]): Skill[] {
  return SKILLS_LIBRARY.filter(s => s.category === category);
}

export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase();
  return SKILLS_LIBRARY.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some(t => t.includes(q)) ||
    s.category.includes(q)
  );
}

export function resolveTemplate(skill: Skill, variables: Record<string, string>): string {
  let prompt = skill.promptTemplate;
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }
  return prompt;
}

export const SKILL_CATEGORIES = [
  { id: "design",    label: "Diseño Web",      icon: "🎨", count: getSkillsByCategory("design").length },
  { id: "content",   label: "Contenido",        icon: "✍️", count: getSkillsByCategory("content").length },
  { id: "seo",       label: "SEO",              icon: "🔍", count: getSkillsByCategory("seo").length },
  { id: "social",    label: "Social Media",     icon: "📱", count: getSkillsByCategory("social").length },
  { id: "email",     label: "Email Marketing",  icon: "📧", count: getSkillsByCategory("email").length },
  { id: "video",     label: "Vídeo & UGC",      icon: "🎥", count: getSkillsByCategory("video").length },
  { id: "analytics", label: "Analytics",        icon: "📊", count: getSkillsByCategory("analytics").length },
  { id: "commerce",  label: "Comercio",         icon: "🛒", count: getSkillsByCategory("commerce").length },
  { id: "3d",        label: "3D & Visual",      icon: "🧊", count: getSkillsByCategory("3d").length },
  { id: "code",      label: "Código",           icon: "💻", count: getSkillsByCategory("code").length },
];
