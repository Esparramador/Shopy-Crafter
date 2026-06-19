// ═══════════════════════════════════════════════════════════════════════════
// MASTER SKILLS INJECTOR — Shopy Crafter AI Platform
//
// Centraliza TODOS los bloques de conocimiento experto de la plataforma:
//   • 12 AI Engine Skills (GitHub: davila7/claude-code-templates, adaptados)
//   • 5 Shopify Expert Blocks (theme, financial, SEO, marketing, supplier)
//   • 100+ Skills Library catalog (design, content, SEO, social, email, video...)
//   • Advertising & Video Production KB
//   • Cinematic Production KB
//   • COGS Methodology KB
//   • Shopify Plugins Catalog (50+)
//
// USO: buildMasterSkillsBlock(query) → always-on catalog + intent-based deep injection
// ═══════════════════════════════════════════════════════════════════════════

import {
  SEO_OPTIMIZER_PROMPT,
  SCHEMA_MARKUP_PROMPT,
  COPYWRITING_PROMPT,
  CRO_ANALYSIS_PROMPT,
  EMAIL_MARKETING_PROMPT,
  SHOPIFY_EXPERT_PROMPT,
  SEO_AUDIT_PROMPT,
  COMPETITOR_ANALYSIS_PROMPT,
  PRODUCT_DESCRIPTIONS_PROMPT,
  PRICING_STRATEGY_PROMPT,
  BRAND_VOICE_PROMPT,
  CONTENT_CALENDAR_PROMPT,
} from "./ai-engine-skills.js";

import {
  THEME_ARCHITECTURE_KNOWLEDGE,
  EXPERT_FINANCIAL_KNOWLEDGE,
  EXPERT_SEO_KNOWLEDGE,
  EXPERT_MARKETING_KNOWLEDGE,
  EXPERT_SUPPLIER_KNOWLEDGE,
} from "./shopify-theme.js";

// ─── CATÁLOGO MAESTRO — siempre inyectado (compacto) ────────────────────────
// Informa a la IA de TODAS las capacidades disponibles para que las use
export const PLATFORM_SKILLS_MASTER_CATALOG = `
╔════════════════════════════════════════════════════════════════════════════╗
║          CATÁLOGO MAESTRO DE SKILLS — SHOPY CRAFTER AI PLATFORM            ║
║  Todas estas capacidades están disponibles. Úsalas proactivamente.         ║
╚════════════════════════════════════════════════════════════════════════════╝

🤖 AI ENGINE SKILLS (12 prompts expertos | origen: GitHub davila7/claude-code-templates + adaptación Shopify):
• seo_optimizer       — SEO Shopify: keyword research, title tags, meta descriptions, arquitectura de URL, content gaps, internal linking
• schema_markup       — JSON-LD expert: Product, FAQ, Organization, Article, HowTo, BreadcrumbList, Review, LocalBusiness schemas
• copywriting         — Copywriting de conversión: AIDA, PAS, storytelling, power words, headlines, CTAs, objeciones
• cro_analysis        — CRO: análisis abandono, fricción en checkout, A/B hypotheses, heatmap interpretation, micro-conversiones
• email_marketing     — Flujos email automation: welcome series, abandono carrito, post-compra, reactivación winback, VIP segmentation
• shopify_expert      — Shopify Dev API 2026-01: Liquid templating, temas, custom sections, Apps, REST+GraphQL, webhooks, metafields
• seo_audit           — Auditoría SEO técnica: Core Web Vitals, crawlability, duplicate content, redirect chains, log analysis
• competitor_analysis — Análisis competidores: pricing intelligence, catálogo gaps, SEO opportunities, estrategia de diferenciación
• product_descriptions — Descripciones producto: SEO + conversión + storytelling + 8 secciones + FAQ integrado + schema
• pricing_strategy    — Pricing: psicología de precios, elasticidad, anchoring, bundling, price fencing, descuentos estratégicos
• brand_voice         — Voz de marca: tono, consistencia cross-channel, adaptación por audiencia, guidelines de escritura
• content_calendar    — Calendario de contenidos: temas, formatos, canales, temporalidad, pillar pages, topic clusters

📚 SKILLS LIBRARY (100+ skills en 10 categorías — disponibles para el usuario):
DESIGN (15): hero-section, product-card, feature-grid, testimonials, pricing-table, navbar-sticky, footer-corporativo, modal-conversion, dashboard-analytics, cta-section, 404-page, form-checkout, notification-system, image-gallery-masonry, landing-complete
CONTENT (22): product-description-seo, blog-post-completo, brand-story, usp-variants, faq-gen, title-variants-ab, mission-vision-values, product-launch-copy, seasonal-campaign, case-study, press-release, comparison-page, about-page, sustainability-story, newsletter-planner, content-calendar-30d, content-localizer, tone-adjuster, readability-improver, content-repurposer, seo-rewriter, glossary-builder
SEO (26): title-gen, meta-gen, schema-product, schema-faq, schema-org, schema-breadcrumb, schema-review, schema-local, schema-article, schema-howto, robots-gen, sitemap-xml, redirect-map, canonical-audit, page-speed-analyzer, keyword-density, internal-link-suggester, image-alt-gen, url-optimizer, heading-analyzer, serp-preview, hreflang-gen, featured-snippet-optimizer, duplicate-content-detector, competitor-keyword-gaps, voice-search-optimizer
SOCIAL: instagram-caption, linkedin-post, twitter-thread, tiktok-script, pinterest-description, hashtag-strategy, ugc-brief, social-calendar
EMAIL: welcome-sequence, cart-abandonment, post-purchase, winback, promotional-email, transactional-email, vip-segment
VIDEO: ugc-script, youtube-description, reel-hook, product-demo-brief, testimonial-video-brief
ANALYTICS: kpi-dashboard, cohort-analysis, funnel-analysis, attribution-model
COMMERCE: product-launch-strategy, collection-strategy, upsell-matrix, loyalty-program, returns-policy
3D: threejs-product-viewer, 360-product-scene
CODE: liquid-custom-section, shopify-app-snippet, storefront-api-query

🎬 ADVERTISING & VIDEO PRODUCTION KB (advertising-playbook-kb.ts):
• Brand DNA Framework: 6 pillars (identidad, audiencia, posicionamiento, mensaje, canales, métricas)
• Campaign Types: awareness → retargeting → conversion → retention → upsell
• UGC Archetypes por industria: lifestyle, tutorial, unboxing, testimonial, problem-solution, antes-después
• Micro-Clip Method: hook (0-3s) → problema (3-7s) → solución (7-12s) → CTA (12-15s)
• Master Prompt Formula: subject + action + environment + style + camera + lighting + mood + duration
• Platform Prompt Recipes: TikTok (vertical 9:16), Meta Stories/Feed/Reels, YouTube Shorts, Pinterest Video
• CONCATENATION_TRANSITIONS: cut, dissolve, wipe, zoom-in, spin, morph, whip-pan
• VIDEO_TECH_SPECS: resolución, FPS, bitrate, codec por plataforma

🎥 CINEMATIC PRODUCTION KB (cinematic-knowledge-base.ts):
• OPTICAL_TECHNIQUES: 15+ técnicas (dolly zoom, rack focus, dutch angle, lens flare...)
• CINEMATOGRAPHY_PRESETS: commercial, luxury, emotional, energetic, documentary, minimal, playful, premium, raw
• SHOT_VOCABULARY: extreme-close-up → close-up → medium → full → wide → extreme-wide
• PRESENTER_STYLES: authority, friendly, luxury, edgy, natural, expert, lifestyle
• LIP_SYNC_RULES: timing, phoneme mapping, mouth shape guidelines
• PRODUCT_PHOTO_RECIPES: hero-shot, lifestyle, flat-lay, texture-macro, scale-reference, before-after
• QUALITY_BOOSTERS: 12 tokens que mejoran calidad de generación (cinematográfico, photorealistic, 8K...)
• ACTION_TOKENS: 15 tokens de movimiento para video AI

💰 FINANCIAL & COGS KB (cogs-methodology-kb.ts + dead-costs.ts):
• COGS_METHODOLOGY_PILLARS: material cost, manufacturing, fulfillment, platform fees, marketing allocation
• HIDDEN_COST_CATEGORIES: storage, returns/refunds, quality control, compliance, seasonality buffers, payment processing
• TCO_COMPONENTS: acquisition + operations + growth + exit costs (Total Cost of Ownership)
• Dead Costs Analysis: slow-moving inventory, overstock, high-return rate, negative-margin products, hidden platform fees
• Severity levels: critical (>15% COGS) / high (10-15%) / medium (5-10%) / low (<5%)
• COGS Benchmarks: benchmarks reales por categoría de producto y nicho en BD (cogs_benchmarks table)

🔌 SHOPIFY PLUGINS CATALOG (50+ plugins catalogados con descripción y precio):
SEO & Content: Plug In SEO, Smart SEO, SEO Manager, Schema Plus, TinyIMG
Email Marketing: Klaviyo, Omnisend, Privy, Drip, Mailchimp
Reviews & UGC: Judge.me, Okendo, Yotpo, Loox, Stamped
CRO & Heatmaps: Hotjar, Lucky Orange, Microsoft Clarity, Convert
Live Chat: Gorgias, Tidio, Zendesk, Re:amaze
Upsell & Cross-sell: Bold Upsell, Frequently Bought Together, Rebuy, CartHook
Loyalty: Smile.io, Yotpo Loyalty, LoyaltyLion, Growave
Subscriptions: Recharge, Bold Subscriptions, Skio, Seal
Shipping: ShipStation, EasyShip, AfterShip, Parcel Panel
Inventory: Skubana, Linnworks, Brightpearl, Inventory Planner
Analytics: Triple Whale, Northbeam, Glew, BeProfit
Social Proof: Sales Pop, Fomo, Proof
Wholesale: Bold Wholesale, Wholesale Gorilla
Bundles: Bold Bundles, Bundler, Wide Bundles

🎨 SHOPIFY EXPERT KNOWLEDGE BLOCKS (5 bloques — cargados por intención):
• THEME_ARCHITECTURE_KNOWLEDGE — Liquid syntax, secciones, snippets, schemas JSON, CSS custom
• EXPERT_FINANCIAL_KNOWLEDGE   — P&L, márgenes bruto/neto, forecast, unit economics, break-even
• EXPERT_SEO_KNOWLEDGE         — Keyword research, auditoría on-page, link building, contenido SEO
• EXPERT_MARKETING_KNOWLEDGE   — Funnels, paid ads, CRO, email automation, influencer marketing
• EXPERT_SUPPLIER_KNOWLEDGE    — Sourcing, MOQ, negociación, dropshipping, calidad, lead times

🧠 CLAUDE API — MODELOS DISPONIBLES:
• claude-opus-4-8         — Máxima capacidad (genius mode): análisis complejo, estrategia, código avanzado
• claude-sonnet-4-6       — Smart mode equilibrado: respuestas rápidas de calidad
• claude-3-haiku          — Ultra-rápido: clasificación, extracción simple
Todos disponibles vía API. Se seleccionan automáticamente según complejidad de la tarea.

REGLA: Cuando el usuario pida algo, SIEMPRE consulta este catálogo y usa la skill más adecuada.
No digas "no tengo información sobre X" si X está en este catálogo. EJECÚTALO.
`;

// ─── Reglas de intención → inyección de skill ───────────────────────────────
interface IntentFlags {
  seoAudit: boolean;
  seo: boolean;
  schema: boolean;
  copywriting: boolean;
  cro: boolean;
  email: boolean;
  shopifyDev: boolean;
  competitor: boolean;
  productDesc: boolean;
  pricing: boolean;
  brand: boolean;
  content: boolean;
  financial: boolean;
  supplier: boolean;
  theme: boolean;
  advertising: boolean;
}

function detectIntents(query: string): IntentFlags {
  const q = query.toLowerCase();
  return {
    seoAudit:    /auditoría.*seo|seo.*audit|technical.*seo|seo.*técnico|core.*web|cwv|page.*speed|pagespeed|crawl.*error|redirect.*chain/.test(q),
    seo:         /\bseo\b|keyword|palabras.*clave|posicionamiento|google.*ranking|meta.*desc|title.*tag|on.page|sitemap|robots\.txt|alt.*text|rich.*snippet/.test(q),
    schema:      /schema|json.ld|structured.*data|datos.*estructurados|rich.*snippet|markup.*producto|faq.*schema/.test(q),
    copywriting: /copywriting|copy|headline|titular.*product|descripción.*product|texto.*ven|storytelling|\bpas\b|\baida\b|power.*word/.test(q),
    cro:         /\bcro\b|conversión|tasa.*conv|abandono.*carrito|cart.*abandon|checkout.*friction|fricción|a\/b.*test|split.*test/.test(q),
    email:       /\bemail\b|correo.*marketing|klaviyo|omnisend|flujo.*email|welcome.*email|abandono.*carrito|post.compra|reactivación|winback|newsletter|secuencia.*email/.test(q),
    shopifyDev:  /\bliquid\b|theme.*edit|edit.*theme|código.*shopify|shopify.*snippet|create.*section|shopify.*api|webhook|graphql|metafield|app.*develop/.test(q),
    competitor:  /competidor|competitor|análisis.*competencia|escanear.*competidor|rival|benchmark.*competidor|spy|watchdog/.test(q),
    productDesc: /descripción.*producto|product.*description|redactar.*producto|crear.*producto|redesign.*product|optimiz.*product|bulk.*redesign/.test(q),
    pricing:     /estrategia.*precio|pricing.*strategy|precio.*psicol|psicolog.*precio|elasticidad|anchoring|price.*bundle|descuento.*estrateg/.test(q),
    brand:       /voz.*marca|brand.*voice|tono.*marca|brand.*guide|identidad.*marca|brand.*consistency/.test(q),
    content:     /calendario.*contenidos|content.*calendar|estrategia.*contenidos|blog.*strategy|plan.*contenidos|pilar.*content|topic.*cluster/.test(q),
    financial:   /financiero|financial|\bmargen\b|\bcogs\b|coste.*unit|p&l|forecast.*ventas|presupuesto.*tienda|unit.*econom|break.*even|dead.*cost/.test(q),
    supplier:    /proveedor|supplier|fabricante|manufacturer|dropshipping|sourcing|alibaba|mayorista|wholesale|\bmoq\b|lead.*time/.test(q),
    theme:       /edit.*css|theme.*css|tema.*shopify|diseño.*tienda|sección.*shopify|custom.*section|shopify.*css|header.*shopify|footer.*shopify/.test(q),
    advertising: /anuncio|publicidad|\bads\b|\bugc\b|tiktok.*ad|meta.*ad|campaña.*video|\breel\b|short.*video|micro.*clip|ad.*creativ/.test(q),
  };
}

// ─── Builder principal ───────────────────────────────────────────────────────
/**
 * Construye el bloque de skills completo para inyectar en el system prompt.
 * Siempre incluye el catálogo maestro (compact) + inyecta en profundidad
 * los skills expertos relevantes para la query dada.
 */
export function buildMasterSkillsBlock(query: string): string {
  const intents = detectIntents(query);
  let deepBlock = "";

  // ── AI Engine Skills (full expert prompts) ──────────────────────────────
  if (intents.seoAudit) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: SEO AUDIT TÉCNICO ────────────\n" + SEO_AUDIT_PROMPT;
  } else if (intents.seo) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: SEO OPTIMIZER ────────────\n" + SEO_OPTIMIZER_PROMPT;
  }
  if (intents.schema) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: SCHEMA MARKUP ────────────\n" + SCHEMA_MARKUP_PROMPT;
  }
  if (intents.copywriting || intents.productDesc) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: COPYWRITING + PRODUCT DESCRIPTIONS ────────────\n"
      + COPYWRITING_PROMPT + "\n\n" + PRODUCT_DESCRIPTIONS_PROMPT;
  }
  if (intents.cro) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: CRO ANALYSIS ────────────\n" + CRO_ANALYSIS_PROMPT;
  }
  if (intents.email) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: EMAIL MARKETING ────────────\n" + EMAIL_MARKETING_PROMPT;
  }
  if (intents.shopifyDev || intents.theme) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: SHOPIFY EXPERT + THEME ARCHITECTURE ────────────\n"
      + SHOPIFY_EXPERT_PROMPT + "\n\n" + THEME_ARCHITECTURE_KNOWLEDGE;
  }
  if (intents.competitor) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: COMPETITOR ANALYSIS ────────────\n" + COMPETITOR_ANALYSIS_PROMPT;
  }
  if (intents.pricing || intents.financial) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: PRICING STRATEGY + FINANCIAL EXPERT ────────────\n"
      + PRICING_STRATEGY_PROMPT + "\n\n" + EXPERT_FINANCIAL_KNOWLEDGE;
  }
  if (intents.brand) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: BRAND VOICE ────────────\n" + BRAND_VOICE_PROMPT;
  }
  if (intents.content) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: CONTENT CALENDAR + MARKETING EXPERT ────────────\n"
      + CONTENT_CALENDAR_PROMPT + "\n\n" + EXPERT_MARKETING_KNOWLEDGE;
  }
  if (intents.supplier) {
    deepBlock += "\n\n──────────── SKILL ACTIVADA: SUPPLIER EXPERT ────────────\n" + EXPERT_SUPPLIER_KNOWLEDGE;
  }

  // ── Shopify Expert Knowledge blocks (from shopify-theme.ts) ─────────────
  // Theme already handled above (shopifyDev || theme)
  if (!intents.shopifyDev && !intents.theme && (intents.seo || intents.seoAudit)) {
    deepBlock += "\n\n" + EXPERT_SEO_KNOWLEDGE;
  }
  if (!intents.content && (intents.advertising || intents.copywriting || intents.productDesc)) {
    deepBlock += "\n\n" + EXPERT_MARKETING_KNOWLEDGE;
  }

  // ── Fallback: si ningún intent específico detectado ─────────────────────
  if (!deepBlock) {
    deepBlock = "\n\n──────────── SKILLS UNIVERSALES (fallback) ────────────\n"
      + SEO_OPTIMIZER_PROMPT + "\n\n" + EXPERT_MARKETING_KNOWLEDGE;
  }

  return PLATFORM_SKILLS_MASTER_CATALOG + deepBlock;
}

// ─── Exportación de catalog para uso directo ─────────────────────────────────
export { PLATFORM_SKILLS_MASTER_CATALOG as MASTER_CATALOG };
