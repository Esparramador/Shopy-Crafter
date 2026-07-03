// ═══════════════════════════════════════════════════════════════════════════
// MASTER SKILLS INJECTOR — Shopy Crafter AI Platform  (v2 — full injection)
//
// Centraliza e inyecta TODOS los bloques de conocimiento experto:
//   • 12 AI Engine Skills (ai-engine-skills.ts)
//   • 5 Shopify Expert Blocks (shopify-theme.ts)
//   • 100+ Skills Library (skills-library.ts)
//   • Advertising & UGC Playbook KB (advertising-playbook-kb.ts)
//   • Campaign Production KB (campaign-production-kb.ts)
//   • Cinematic Production KB (cinematic-knowledge-base.ts)
//   • COGS Methodology KB (cogs-methodology-kb.ts)
//   • Shopify Plugins Catalog (plugins-catalog.ts)
//   • Exploded View Studio KB (exploded-view-kb.ts)
//
// buildMasterSkillsBlock(query) → catálogo compacto siempre-on + deep injection
// ═══════════════════════════════════════════════════════════════════════════
import { buildCybersecKnowledgeBlock } from "./cybersec-knowledge.js";

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

import {
  SKILLS_LIBRARY,
  searchSkills,
  SKILL_CATEGORIES,
} from "./skills-library.js";

import {
  BRAND_DNA_FRAMEWORK,
  CAMPAIGN_TYPES,
  UGC_ARCHETYPES,
  MICRO_CLIP_METHOD,
  MASTER_PROMPT_FORMULA,
  PLATFORM_PROMPT_RECIPES,
  CONCATENATION_TRANSITIONS,
  VIDEO_TECH_SPECS,
} from "./advertising-playbook-kb.js";

import {
  CHARACTER_LOCKS,
  VIDEO_CAMPAIGNS,
  UGC_MICRO_CLIPS,
  MASTER_CUT_TIMELINE,
  TECH_SPECS,
  AI_VIDEO_TOOLS,
  getCampaignProductionSummary,
} from "./campaign-production-kb.js";

import {
  OPTICAL_TECHNIQUES,
  CINEMATOGRAPHY_PRESETS,
  SHOT_VOCABULARY,
  PRESENTER_STYLES,
  ACTION_TOKENS,
  CONTINUITY_TOKENS,
  NEGATIVE_PROMPT_LIBRARY,
} from "./cinematic-knowledge-base.js";

import {
  COGS_METHODOLOGY_PILLARS,
  HIDDEN_COST_CATEGORIES,
  TCO_COMPONENTS,
  SUPPLIER_SCENARIOS,
  COGS_CALCULATION_STEPS,
  GOLDEN_RULE,
  getFullCogsMethodology,
} from "./cogs-methodology-kb.js";

import {
  PLUGINS_CATALOG,
  getPluginsByCategory,
  searchPlugins,
  getPopularPlugins,
  PLUGIN_CATEGORIES,
} from "./plugins-catalog.js";

import {
  PLATFORM_PROFILES,
  GLOBAL_STATE_TEMPLATES,
  PROMPT_SEQUENCES,
  PRODUCT_PRESETS,
  GENERATION_STRATEGIES,
  POST_PRODUCTION_PIPELINE,
  QUALITY_RULES,
  getExplodedViewSummary,
  buildPromptWithGlobalState,
} from "./exploded-view-kb.js";

// ─── CATÁLOGO MAESTRO — siempre inyectado (compacto) ────────────────────────
export const PLATFORM_SKILLS_MASTER_CATALOG = `
╔════════════════════════════════════════════════════════════════════════════╗
║          CATÁLOGO MAESTRO DE SKILLS — SHOPY CRAFTER AI PLATFORM            ║
║  Todas estas capacidades están disponibles. Úsalas proactivamente.         ║
╚════════════════════════════════════════════════════════════════════════════╝

🤖 AI ENGINE SKILLS (12 prompts expertos):
• seo_optimizer       — SEO Shopify: keyword research, title tags, meta descriptions, arquitectura URL, content gaps, internal linking
• schema_markup       — JSON-LD expert: Product, FAQ, Organization, Article, HowTo, BreadcrumbList, Review, LocalBusiness
• copywriting         — Copywriting conversión: AIDA, PAS, storytelling, power words, headlines, CTAs, objeciones
• cro_analysis        — CRO: análisis abandono, fricción checkout, A/B hypotheses, heatmap, micro-conversiones
• email_marketing     — Flujos email: welcome series, abandono carrito, post-compra, reactivación winback, VIP
• shopify_expert      — Shopify Dev API 2026-01: Liquid, temas, secciones, Apps, REST+GraphQL, webhooks, metafields
• seo_audit           — Auditoría SEO técnica: Core Web Vitals, crawlability, duplicate content, redirect chains
• competitor_analysis — Análisis competidores: pricing intelligence, catálogo gaps, SEO opportunities, diferenciación
• product_descriptions — Descripciones producto: SEO + conversión + storytelling + 8 secciones + FAQ + schema
• pricing_strategy    — Pricing: psicología de precios, elasticidad, anchoring, bundling, price fencing
• brand_voice         — Voz de marca: tono, consistencia cross-channel, adaptación por audiencia
• content_calendar    — Calendario contenidos: temas, formatos, canales, temporalidad, pillar pages

📚 SKILLS LIBRARY (${SKILLS_LIBRARY.length} skills en ${SKILL_CATEGORIES.length} categorías):
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

🎬 ADVERTISING & UGC PLAYBOOK KB (${BRAND_DNA_FRAMEWORK.length} pilares DNA, ${Object.keys(CAMPAIGN_TYPES).length} tipos campaña, ${Object.keys(UGC_ARCHETYPES).length} arquetipos UGC):
• Brand DNA Framework: ${BRAND_DNA_FRAMEWORK.map(p => p.pillar).join(", ")}
• Campaign Types: ${Object.keys(CAMPAIGN_TYPES).join(" → ")}
• UGC Archetypes por industria: ${Object.keys(UGC_ARCHETYPES).join(", ")}
• Micro-Clip Method: ${MICRO_CLIP_METHOD.length} reglas — 6 segundos, clips paralelos, character lock
• Master Prompt Formula: ${MASTER_PROMPT_FORMULA.length} componentes — duration+orientation+style+presenter+action+script+camera+lighting+quality+lipsync
• Platform Prompt Recipes: ${PLATFORM_PROMPT_RECIPES.length} plataformas (TikTok 9:16, Meta Stories/Feed/Reels, YouTube Shorts, Pinterest Video)
• Transitions: ${Object.keys(CONCATENATION_TRANSITIONS).join(", ")}
• Tech Specs: ${VIDEO_TECH_SPECS.length} configuraciones de plataforma

🎥 CINEMATIC PRODUCTION KB (${OPTICAL_TECHNIQUES.length} técnicas ópticas, ${Object.keys(CINEMATOGRAPHY_PRESETS).length} presets, ${Object.keys(SHOT_VOCABULARY).length} encuadres):
• Optical Techniques: dolly zoom, rack focus, dutch angle, lens flare, split-focus, deep-focus + ${OPTICAL_TECHNIQUES.length - 6} más
• Cinematography Presets: ${Object.keys(CINEMATOGRAPHY_PRESETS).join(", ")}
• Shot Vocabulary: ${Object.keys(SHOT_VOCABULARY).join(" → ")}
• Presenter Styles: ${Object.keys(PRESENTER_STYLES).join(", ")}
• Action Tokens (${Object.keys(ACTION_TOKENS).length}): movimiento, energía, dinámica para video IA
• Continuity Tokens (${CONTINUITY_TOKENS.length}): para mantener coherencia visual entre clips
• Negative Prompts: ${Object.keys(NEGATIVE_PROMPT_LIBRARY).length} categorías de industria

💰 COGS METHODOLOGY KB (${COGS_METHODOLOGY_PILLARS.length} pilares, ${HIDDEN_COST_CATEGORIES.length} costes ocultos, ${TCO_COMPONENTS.length} TCO, ${SUPPLIER_SCENARIOS.length} escenarios):
• Pilares COGS: ${COGS_METHODOLOGY_PILLARS.map(p => p.name).join(", ")}
• Costes Ocultos: ${HIDDEN_COST_CATEGORIES.slice(0, 5).map(c => c.name).join(", ")} + ${HIDDEN_COST_CATEGORIES.length - 5} más
• TCO Components: ${TCO_COMPONENTS.map(c => c.name).join(", ")}
• COGS Calculation: ${COGS_CALCULATION_STEPS.length} pasos estructurados
• Regla de Oro: "${GOLDEN_RULE.es}"

🔌 SHOPIFY PLUGINS CATALOG (${PLUGINS_CATALOG.length} plugins en ${PLUGIN_CATEGORIES.length} categorías):
• Categorías: ${PLUGIN_CATEGORIES.map(c => c.label).join(", ")}
• Top plugins: ${getPopularPlugins(8).map(p => p.name).join(", ")} y ${PLUGINS_CATALOG.length - 8} más

🎞️ EXPLODED VIEW STUDIO KB (${PLATFORM_PROFILES.length} plataformas IA, ${PROMPT_SEQUENCES.length} secuencias, ${PRODUCT_PRESETS.length} presets producto):
• Plataformas: ${PLATFORM_PROFILES.map(p => p.name).join(", ")}
• Global State DNA: ${GLOBAL_STATE_TEMPLATES.length} templates (camera+lighting+physics lock cross-clip)
• Prompt Sequences: ${PROMPT_SEQUENCES.length} secuencias de 5 clips (deconstrucción + ensamblaje)
• Product Presets: ${PRODUCT_PRESETS.map(p => p.displayName).join(", ")}
• Post-Production: ${POST_PRODUCTION_PIPELINE.length} pasos de pipeline · Quality Rules: ${QUALITY_RULES.length} reglas
• TOP MODELOS EXPLODE VIEW (2026): Google Flow Veo 3 (FLF rating:98) → Seedance 2.0 (rating:95) → Kling 3.0 (rating:92) → Runway Gen-4.5 (rating:90) → Grok Aurora 1.5 (rating:88)
• TÉCNICA FLF: imagen ensamblada (start) + imagen explotada (end) → Google Flow calcula trayecto de cada pieza
• TIMESTAMP NARRATION: Seedance [0-1.5s]slot1.[1.5-3.5s]slot2 / Grok [0-4s]acción.[4s transition]Smash cut.[4-10s]nueva

🤖 AI VIDEO TOOLS RANKING 2026 (actualizado Jul 2026):
1. Grok Aurora 1.5 — #1 I2V Arena, timestamp narración, 7 @imageN refs, audio nativo, ~17s gen
2. Seedance 2.0   — timestamp [0-1.5s] slots, 9 omni refs, explode view I2V, Replicate API
3. Kling 3.0 Omni — @character1 ID, multi-shot 6 escenas, 4K, Element Binding
4. Runway Gen-4.5 — Motion Brush 5 zonas X/Y/Z, física realista, NO timestamp syntax
5. Google Flow    — MEJOR First/Last Frame para explode views de producto
6. ElevenLabs eleven_v3 — TTS 74 idiomas, SFX API, Dubbing lip-sync, Instant Voice Clone
   Workflow: eleven_v3 audio + video sin audio → zsxkib/mmaudio SFX → ffmpeg merge

🎭 CHARACTER UGC — DNA Blueprint & Consistency:
• DNA Lock: [CHARACTER NAME, edad, rasgos, ropa, estilo] incluir en TODOS los prompts
• Cross-shot: último frame clip A = primer frame clip B (First/Last Frame chaining)
• Por modelo: Grok @image1-7 · Kling @character1 · Runway Character Reference toggle + Fixed Seed
• Multi-Angle Ref Sheet: 4 ángulos (frente/perfil/3-4/espalda) → imagen compuesta → referencia para Runway/Luma

🎨 SHOPIFY EXPERT KNOWLEDGE BLOCKS (5 bloques expertos):
• THEME_ARCHITECTURE_KNOWLEDGE — Liquid syntax, secciones, snippets, schemas JSON, CSS custom
• EXPERT_FINANCIAL_KNOWLEDGE   — P&L, márgenes bruto/neto, forecast, unit economics, break-even
• EXPERT_SEO_KNOWLEDGE         — Keyword research, auditoría on-page, link building, contenido SEO
• EXPERT_MARKETING_KNOWLEDGE   — Funnels, paid ads, CRO, email automation, influencer marketing
• EXPERT_SUPPLIER_KNOWLEDGE    — Sourcing, MOQ, negociación, dropshipping, calidad, lead times

🧠 CLAUDE API — MODELOS DISPONIBLES:
• claude-opus-4-8   — Máxima capacidad (genius mode): análisis complejo, estrategia, código avanzado
• claude-sonnet-4-6 — Smart mode equilibrado: respuestas rápidas de calidad
• claude-3-haiku    — Ultra-rápido: clasificación, extracción simple

REGLA: Cuando el usuario pida algo, SIEMPRE consulta este catálogo y usa la skill más adecuada.
No digas "no tengo información sobre X" si X está en este catálogo. EJECÚTALO.
`;

// ─── Helpers para construir bloques de texto inyectables ─────────────────────

function buildAdvertisingKBBlock(): string {
  const ugcKeys = Object.keys(UGC_ARCHETYPES) as Array<keyof typeof UGC_ARCHETYPES>;
  const campaignKeys = Object.keys(CAMPAIGN_TYPES) as Array<keyof typeof CAMPAIGN_TYPES>;
  return `
══════════════ ADVERTISING & UGC PLAYBOOK KB ══════════════

BRAND DNA FRAMEWORK — ${BRAND_DNA_FRAMEWORK.length} pilares:
${BRAND_DNA_FRAMEWORK.map(p => `  [${(p as any).pillar}] ${(p as any).description ?? ""}\n    Preguntas clave: ${(p as any).keyQuestions?.slice(0, 2).join(" | ") ?? ""}`).join("\n")}

CAMPAIGN TYPES (funnel completo):
${campaignKeys.map(k => {
  const c = CAMPAIGN_TYPES[k] as any;
  return `  ${k.toUpperCase()}: ${c.objective}\n    Hook: ${c.primaryHook ?? "N/A"} | CTA: ${c.cta ?? "N/A"} | Plataformas: ${c.platforms?.join(", ") ?? "N/A"}`;
}).join("\n")}

UGC ARCHETYPES (${ugcKeys.length} arquetipos):
${ugcKeys.slice(0, 6).map(k => {
  const a = UGC_ARCHETYPES[k] as any;
  return `  ${k}: ${a.name} — ${a.description ?? ""}\n    Hook: "${a.hookTemplate ?? "N/A"}"`;
}).join("\n")}

MICRO-CLIP METHOD (${MICRO_CLIP_METHOD.length} reglas):
${MICRO_CLIP_METHOD.map(r => `  • ${r.spanishRule}: ${r.rationale}`).join("\n")}

MASTER PROMPT FORMULA (${MASTER_PROMPT_FORMULA.length} componentes en orden):
${MASTER_PROMPT_FORMULA.map(c => `  ${c.order}. [${c.name}] — ${c.description}\n     Placeholder: ${c.placeholder}`).join("\n")}

PLATFORM PROMPT RECIPES (${PLATFORM_PROMPT_RECIPES.length}):
${PLATFORM_PROMPT_RECIPES.slice(0, 4).map(r => `  ${r.platform} (${r.aspectRatio}): ${(r as any).style ?? ""} — "${(r as any).promptPrefix ?? ""}..."`).join("\n")}

TECH SPECS:
${VIDEO_TECH_SPECS.slice(0, 5).map(s => `  ${(s as any).platform ?? s.resolution}: ${s.resolution} ${s.fps}fps | codec: ${s.codec} | bitrate: ${(s as any).bitrate ?? "N/A"}`).join("\n")}
`;
}

function buildCinematicKBBlock(): string {
  const presetKeys = Object.keys(CINEMATOGRAPHY_PRESETS) as Array<keyof typeof CINEMATOGRAPHY_PRESETS>;
  const shotKeys = Object.keys(SHOT_VOCABULARY) as Array<keyof typeof SHOT_VOCABULARY>;
  const presenterKeys = Object.keys(PRESENTER_STYLES) as Array<keyof typeof PRESENTER_STYLES>;
  return `
══════════════ CINEMATIC PRODUCTION KB ══════════════

OPTICAL TECHNIQUES (${OPTICAL_TECHNIQUES.length}):
${OPTICAL_TECHNIQUES.slice(0, 8).map(t => `  [${t.id}] ${t.name}: ${(t as any).description ?? ""} | Prompt: "${(t as any).promptToken ?? ""}"`).join("\n")}

CINEMATOGRAPHY PRESETS (${presetKeys.length}):
${presetKeys.map(k => {
  const p = CINEMATOGRAPHY_PRESETS[k] as any;
  return `  ${k.toUpperCase()}: ${p.description ?? ""}\n    Style: ${p.colorGrading ?? p.colorGrade ?? "N/A"} | Mood: ${p.mood ?? "N/A"}\n    Camera: ${p.cameraMovement?.slice(0, 2).join(", ") ?? "N/A"}\n    Prompt tokens: "${p.promptTokens?.slice(0, 4).join(", ") ?? "N/A"}"`;
}).join("\n")}

SHOT VOCABULARY (${shotKeys.length} tamaños):
${shotKeys.map(k => {
  const s = SHOT_VOCABULARY[k] as any;
  return `  ${k}: ${s.description ?? ""} | Uso: ${s.bestFor ?? "N/A"} | Token: "${s.promptToken ?? "N/A"}"`;
}).join("\n")}

PRESENTER STYLES (${presenterKeys.length}):
${presenterKeys.map(k => {
  const s = PRESENTER_STYLES[k] as any;
  return `  ${k}: ${s.description ?? ""} | Wardrobe: ${s.wardrobe ?? "N/A"} | Tone: ${s.tone ?? "N/A"}`;
}).join("\n")}

ACTION TOKENS (${Object.keys(ACTION_TOKENS).length}):
${Object.entries(ACTION_TOKENS).slice(0, 10).map(([k, v]) => `  ${k}: "${(v as any).prompt ?? v}"` ).join("\n")}

CONTINUITY TOKENS (${CONTINUITY_TOKENS.length}):
${CONTINUITY_TOKENS.slice(0, 6).map(t => `  "${(t as any).token ?? (t as any).id ?? ""}": ${(t as any).description ?? ""}`).join("\n")}

NEGATIVE PROMPT LIBRARY (por industria):
${Object.entries(NEGATIVE_PROMPT_LIBRARY).slice(0, 4).map(([k, v]) => `  ${k}: "${v.slice(0, 100)}..."`).join("\n")}
`;
}

function buildCOGSBlock(): string {
  return `
══════════════ COGS METHODOLOGY KB ══════════════

PILARES METODOLOGÍA COGS (${COGS_METHODOLOGY_PILLARS.length}):
${COGS_METHODOLOGY_PILLARS.map(p => `  [${(p as any).name ?? ""}] ${(p as any).description ?? ""}\n    Componentes: ${(p as any).components?.slice(0, 3).join(", ") ?? "N/A"}\n    Fórmula: ${(p as any).formula ?? "N/A"}`).join("\n")}

COSTES OCULTOS CRÍTICOS (${HIDDEN_COST_CATEGORIES.length}):
${HIDDEN_COST_CATEGORIES.map(c => `  ⚠ ${(c as any).name ?? ""} (${(c as any).severity ?? "medium"}): ${(c as any).description ?? ""}\n    Cálculo: ${(c as any).calculation ?? "N/A"} | Benchmark: ${(c as any).benchmark ?? "N/A"}`).join("\n")}

TCO COMPONENTS (${TCO_COMPONENTS.length}):
${TCO_COMPONENTS.map(c => `  ${(c as any).name ?? ""}: ${(c as any).description ?? ""} | Incluye: ${(c as any).includes?.slice(0, 3).join(", ") ?? "N/A"}`).join("\n")}

ESCENARIOS DE PROVEEDOR (${SUPPLIER_SCENARIOS.length}):
${SUPPLIER_SCENARIOS.map(s => `  ${(s as any).name ?? ""}: ${(s as any).description ?? ""}\n    Pros: ${(s as any).pros?.slice(0, 2).join(", ") ?? "N/A"} | Cons: ${(s as any).cons?.slice(0, 2).join(", ") ?? "N/A"}`).join("\n")}

PASOS DE CÁLCULO COGS (${COGS_CALCULATION_STEPS.length}):
${COGS_CALCULATION_STEPS.map((s, i) => `  ${i + 1}. ${s.step}: ${s.description}`).join("\n")}

REGLA DE ORO: "${GOLDEN_RULE.es}"
`;
}

function buildPluginsBlock(query: string): string {
  const relevant = searchPlugins(query).slice(0, 10);
  const all = relevant.length > 0 ? relevant : getPopularPlugins(12);
  return `
══════════════ SHOPIFY PLUGINS CATALOG (${PLUGINS_CATALOG.length} plugins) ══════════════

CATEGORÍAS DISPONIBLES:
${PLUGIN_CATEGORIES.map(c => `  ${c.label} (${c.count} plugins)`).join("\n")}

PLUGINS RELEVANTES PARA ESTA CONSULTA:
${all.map(p => `  [${(p as any).category ?? ""}] ${p.name}${(p as any).pricing ? ` — ${(p as any).pricing}` : ""}\n    ${(p as any).description ?? ""}\n    Features: ${(p as any).keyFeatures?.slice(0, 3).join(", ") ?? "N/A"}${(p as any).shopifyRating ? ` | ⭐ ${(p as any).shopifyRating}` : ""}`).join("\n")}
`;
}

function buildExplodedViewBlock(): string {
  const summary = getExplodedViewSummary();
  return `
══════════════ EXPLODED VIEW STUDIO KB ══════════════

PLATAFORMAS DE IA VIDEO (${summary.totalPlatforms}):
${PLATFORM_PROFILES.map(p => `  [${p.id}] ${p.name} (${p.developer})\n    Type: ${p.type} | Best for: ${(p as any).bestFor ?? "general"}`).join("\n")}

GLOBAL STATE DNA TEMPLATES (${summary.totalGlobalStates}):
${GLOBAL_STATE_TEMPLATES.slice(0, 4).map(t => `  [${t.id}] ${t.name}: ${(t as any).description ?? ""}\n    Camera lock: ${(t as any).cameraLock ?? "N/A"} | Lighting: ${(t as any).lightingLock ?? "N/A"}`).join("\n")}

SECUENCIAS DE PROMPTS (${summary.totalSequences}):
${PROMPT_SEQUENCES.slice(0, 3).map(s => `  [${s.id}] ${(s as any).name ?? s.id} (${(s as any).clipCount ?? 5} clips)\n    Style: ${(s as any).style ?? "N/A"} | Category: ${(s as any).category ?? "N/A"}`).join("\n")}

PRESETS DE PRODUCTO (${summary.totalProductPresets}):
${PRODUCT_PRESETS.map(p => `  ${p.displayName}: ${p.components?.slice(0, 4).join(", ") ?? "N/A"} + ${(p.components?.length ?? 0) - 4} más`).join("\n")}

ESTRATEGIAS DE GENERACIÓN (${summary.totalStrategies}):
${GENERATION_STRATEGIES.map(g => `  ${g.mode.toUpperCase()}: ${g.description} | Clips: ${(g as any).recommendedClips ?? "5"} | Costo estimado: ${(g as any).estimatedCost ?? "N/A"}`).join("\n")}

POST-PRODUCTION PIPELINE (${summary.totalPostSteps} pasos):
${POST_PRODUCTION_PIPELINE.map((s, i) => `  ${i + 1}. ${(s as any).step ?? (s as any).name ?? ""}: ${(s as any).description ?? ""}`).join("\n")}

REGLAS DE CALIDAD (${summary.totalQualityRules}):
${QUALITY_RULES.filter(r => r.severity === "critical").map(r => `  🔴 CRÍTICO [${r.category}]: ${r.rule}`).join("\n")}
${QUALITY_RULES.filter(r => (r.severity as string) === "high" || r.severity === "important").slice(0, 3).map(r => `  🟠 ALTO [${r.category}]: ${r.rule}`).join("\n")}
`;
}

function buildSkillsLibraryBlock(query: string): string {
  const relevant = searchSkills(query).slice(0, 8);
  return `
══════════════ SKILLS LIBRARY — ${SKILLS_LIBRARY.length} SKILLS DISPONIBLES ══════════════

SKILLS RELEVANTES PARA ESTA CONSULTA:
${relevant.map(s => `  [${s.category}] ${s.id} — ${s.name}\n    ${s.description}\n    Variables: ${s.variables?.slice(0, 4).map(v => `{{${v}}}`).join(", ") ?? "N/A"}`).join("\n")}

USO: Cuando el usuario pida generar contenido con cualquier de estas skills, usa el template
de la skill correspondiente, rellena las variables con los datos del proyecto, y genera el output.
`;
}

function buildCampaignProductionBlock(): string {
  const summary = getCampaignProductionSummary();
  return `
══════════════ CAMPAIGN PRODUCTION KB ══════════════

RESUMEN: ${summary.totalVideos} vídeos, ${summary.totalUgcClips} clips UGC, ${summary.characterVariants} variantes de personaje, ${summary.masterCutDuration} duración master

CHARACTER LOCKS (${CHARACTER_LOCKS.length}):
${CHARACTER_LOCKS.map(c => `  [${c.id}] ${c.name}: ${(c as any).description ?? ""}\n    Reference: ${(c as any).referenceImage ?? "N/A"} | Gender: ${(c as any).gender ?? "N/A"} | Age: ${(c as any).age ?? "N/A"}`).join("\n")}

VIDEO CAMPAIGNS (${VIDEO_CAMPAIGNS.length}):
${VIDEO_CAMPAIGNS.slice(0, 5).map(v => `  [${v.slug}] ${v.title} (${v.durationSec}s)\n    Objective: ${(v as any).objective ?? ""} | Platform: ${(v as any).platform ?? "multi"}`).join("\n")}

UGC MICRO-CLIPS (${UGC_MICRO_CLIPS.length} clips):
${UGC_MICRO_CLIPS.slice(0, 6).map(c => `  [${(c as any).position ?? ""}] ${(c as any).type ?? ""}: ${(c as any).description ?? "N/A"} (${(c as any).durationSec ?? "6"}s)\n    Hook: "${(c as any).hookLine ?? "N/A"}"`).join("\n")}

MASTER CUT TIMELINE (${MASTER_CUT_TIMELINE.length} segmentos):
${MASTER_CUT_TIMELINE.slice(0, 5).map(s => `  ${s.startTime}s → ${s.endTime}s: [${(s as any).clipRef ?? ""}] ${(s as any).purpose ?? ""}`).join("\n")}

AI VIDEO TOOLS CATALOGADOS (${AI_VIDEO_TOOLS.length}):
${AI_VIDEO_TOOLS.map(t => `  ${t.name}: ${(t as any).strengths?.slice(0, 2).join(", ") ?? "N/A"}`).join("\n")}

TECH SPECS (${TECH_SPECS.length}):
${TECH_SPECS.slice(0, 4).map(s => `  ${(s as any).platform ?? s.resolution}: ${s.resolution} ${s.fps}fps | Codec: ${s.codec} | Max duration: ${(s as any).maxDuration ?? "N/A"}`).join("\n")}
`;
}

// ─── Intent detection ────────────────────────────────────────────────────────
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
  videoProduction: boolean;
  cinematic: boolean;
  cogsDeep: boolean;
  plugins: boolean;
  explodedView: boolean;
  skillsLibrary: boolean;
  campaignProduction: boolean;
}

function detectIntents(query: string): IntentFlags {
  const q = query.toLowerCase();
  return {
    seoAudit:      /auditoría.*seo|seo.*audit|technical.*seo|seo.*técnico|core.*web|cwv|page.*speed|pagespeed|crawl.*error|redirect.*chain/.test(q),
    seo:           /\bseo\b|keyword|palabras.*clave|posicionamiento|google.*ranking|meta.*desc|title.*tag|on.page|sitemap|robots\.txt|alt.*text|rich.*snippet/.test(q),
    schema:        /schema|json.ld|structured.*data|datos.*estructurados|rich.*snippet|markup.*producto|faq.*schema/.test(q),
    copywriting:   /copywriting|copy|headline|titular.*product|descripción.*product|texto.*ven|storytelling|\bpas\b|\baida\b|power.*word/.test(q),
    cro:           /\bcro\b|conversión|tasa.*conv|abandono.*carrito|cart.*abandon|checkout.*friction|fricción|a\/b.*test|split.*test/.test(q),
    email:         /\bemail\b|correo.*marketing|klaviyo|omnisend|flujo.*email|welcome.*email|abandono.*carrito|post.compra|reactivación|winback|newsletter|secuencia.*email/.test(q),
    shopifyDev:    /\bliquid\b|theme.*edit|edit.*theme|código.*shopify|shopify.*snippet|create.*section|shopify.*api|webhook|graphql|metafield|app.*develop/.test(q),
    competitor:    /competidor|competitor|análisis.*competencia|escanear.*competidor|rival|benchmark.*competidor|spy|watchdog/.test(q),
    productDesc:   /descripción.*producto|product.*description|redactar.*producto|crear.*producto|redesign.*product|optimiz.*product|bulk.*redesign/.test(q),
    pricing:       /estrategia.*precio|pricing.*strategy|precio.*psicol|psicolog.*precio|elasticidad|anchoring|price.*bundle|descuento.*estrateg/.test(q),
    brand:         /voz.*marca|brand.*voice|tono.*marca|brand.*guide|identidad.*marca|brand.*consistency/.test(q),
    content:       /calendario.*contenidos|content.*calendar|estrategia.*contenidos|blog.*strategy|plan.*contenidos|pilar.*content|topic.*cluster/.test(q),
    financial:     /financiero|financial|\bmargen\b|\bcogs\b|coste.*unit|p&l|forecast.*ventas|presupuesto.*tienda|unit.*econom|break.*even|dead.*cost/.test(q),
    supplier:      /proveedor|supplier|fabricante|manufacturer|dropshipping|sourcing|alibaba|mayorista|wholesale|\bmoq\b|lead.*time/.test(q),
    theme:         /edit.*css|theme.*css|tema.*shopify|diseño.*tienda|sección.*shopify|custom.*section|shopify.*css|header.*shopify|footer.*shopify/.test(q),
    advertising:   /anuncio|publicidad|\bads\b|\bugc\b|tiktok.*ad|meta.*ad|campaña.*video|\breel\b|short.*video|micro.*clip|ad.*creativ|brand.*dna.*frame|plataforma.*prompt/.test(q),
    videoProduction: /producción.*video|video.*campaign|campaña.*video|master.*cut|timeline.*video|character.*lock|subtitle.*track|deliverable.*video|timestamp.*narration|timestamp.*escena|narración.*timestamp/.test(q),
    cinematic:     /cinemat|optical.*tech|dolly.*zoom|rack.*focus|cinematograph|shot.*size|presenter.*style|plano.*detalle|plano.*general|encuadr|continuity.*token|action.*token|preset.*cine|grok.*aurora|grok.*video|aurora.*timestamp|seedance.*timestamp|timestamp.*slot/.test(q),
    cogsDeep:      /metodología.*cogs|cogs.*metodolog|coste.*oculto|hidden.*cost|tco.*total|cost.*ownership|escenario.*proveedor|excel.*cogs|cogs.*excel|golden.*rule.*cogs|regla.*oro.*cogs/.test(q),
    plugins:       /plugin|app.*shopify|shopify.*app|klaviyo|judge\.me|okendo|hotjar|gorgias|recharge|bold.*upsell|smile\.io|aftership|triple.*whale|recomienda.*app/.test(q),
    explodedView:  /exploded.*view|vista.*explot|deconstrucción.*producto|producto.*desmontado|assembly.*video|magnetic.*assembly|components.*float|global.*state.*dna|prompt.*sequence.*5|exploded|desensambla|ensambla|teardown|disassemble|assembled|producto.*explo|explo.*producto|auriculares.*explo|sneaker.*explo|phone.*explo|reloj.*explo|watch.*explo|luxury.*watch|reloj.*lujo|bisel.*reloj|mecanismo.*reloj|calibre.*reloj|rolex|datejust|jubilee.*brac|chronergy|parachrom|barrilete.*reloj|rotor.*reloj|escape.*reloj|balancin|hairspring|tourbillon/.test(q),
    skillsLibrary: /qué.*skills|skill.*disponible|listame.*skills|generar.*con.*skill|usar.*skill|skill.*library|all.*skills|todas.*skills/.test(q),
    campaignProduction: /campaign.*production|producción.*campaña|character.*lock|ugc.*clip|micro.clip.*method|master.*cut.*timeline|storyboard.*slide|subtitle.*track|elevenlabs.*workflow|eleven.*v3|voice.*clone|ugc.*character|character.*ugc|dna.*blueprint/.test(q),
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
    deepBlock += "\n\n──────────── SKILL: SEO AUDIT TÉCNICO ────────────\n" + SEO_AUDIT_PROMPT;
  } else if (intents.seo) {
    deepBlock += "\n\n──────────── SKILL: SEO OPTIMIZER ────────────\n" + SEO_OPTIMIZER_PROMPT;
  }
  if (intents.schema) {
    deepBlock += "\n\n──────────── SKILL: SCHEMA MARKUP ────────────\n" + SCHEMA_MARKUP_PROMPT;
  }
  if (intents.copywriting || intents.productDesc) {
    deepBlock += "\n\n──────────── SKILL: COPYWRITING + PRODUCT DESCRIPTIONS ────────────\n"
      + COPYWRITING_PROMPT + "\n\n" + PRODUCT_DESCRIPTIONS_PROMPT;
  }
  if (intents.cro) {
    deepBlock += "\n\n──────────── SKILL: CRO ANALYSIS ────────────\n" + CRO_ANALYSIS_PROMPT;
  }
  if (intents.email) {
    deepBlock += "\n\n──────────── SKILL: EMAIL MARKETING ────────────\n" + EMAIL_MARKETING_PROMPT;
  }
  if (intents.shopifyDev || intents.theme) {
    deepBlock += "\n\n──────────── SKILL: SHOPIFY EXPERT + THEME ARCHITECTURE ────────────\n"
      + SHOPIFY_EXPERT_PROMPT + "\n\n" + THEME_ARCHITECTURE_KNOWLEDGE;
  }
  if (intents.competitor) {
    deepBlock += "\n\n──────────── SKILL: COMPETITOR ANALYSIS ────────────\n" + COMPETITOR_ANALYSIS_PROMPT;
  }
  if (intents.pricing || intents.financial) {
    deepBlock += "\n\n──────────── SKILL: PRICING STRATEGY + FINANCIAL EXPERT ────────────\n"
      + PRICING_STRATEGY_PROMPT + "\n\n" + EXPERT_FINANCIAL_KNOWLEDGE;
  }
  if (intents.brand) {
    deepBlock += "\n\n──────────── SKILL: BRAND VOICE ────────────\n" + BRAND_VOICE_PROMPT;
  }
  if (intents.content) {
    deepBlock += "\n\n──────────── SKILL: CONTENT CALENDAR + MARKETING ────────────\n"
      + CONTENT_CALENDAR_PROMPT + "\n\n" + EXPERT_MARKETING_KNOWLEDGE;
  }
  if (intents.supplier) {
    deepBlock += "\n\n──────────── SKILL: SUPPLIER EXPERT ────────────\n" + EXPERT_SUPPLIER_KNOWLEDGE;
  }

  // ── Shopify Expert Knowledge blocks (from shopify-theme.ts) ─────────────
  if (!intents.shopifyDev && !intents.theme && (intents.seo || intents.seoAudit)) {
    deepBlock += "\n\n" + EXPERT_SEO_KNOWLEDGE;
  }
  if (!intents.content && (intents.advertising || intents.copywriting || intents.productDesc)) {
    deepBlock += "\n\n" + EXPERT_MARKETING_KNOWLEDGE;
  }

  // ── NEW: Advertising & UGC Playbook KB ───────────────────────────────────
  if (intents.advertising || intents.videoProduction) {
    deepBlock += buildAdvertisingKBBlock();
  }

  // ── NEW: Campaign Production KB ──────────────────────────────────────────
  if (intents.campaignProduction || intents.videoProduction) {
    deepBlock += buildCampaignProductionBlock();
  }

  // ── NEW: Cinematic Production KB ─────────────────────────────────────────
  if (intents.cinematic || intents.advertising || intents.videoProduction) {
    deepBlock += buildCinematicKBBlock();
  }

  // ── NEW: COGS Methodology KB ──────────────────────────────────────────────
  if (intents.cogsDeep || intents.financial) {
    deepBlock += buildCOGSBlock();
  }

  // ── NEW: Shopify Plugins Catalog ─────────────────────────────────────────
  if (intents.plugins) {
    deepBlock += buildPluginsBlock(query);
  }

  // ── NEW: Exploded View Studio KB ─────────────────────────────────────────
  if (intents.explodedView) {
    deepBlock += buildExplodedViewBlock();
  }

  // ── NEW: Skills Library ───────────────────────────────────────────────────
  if (intents.skillsLibrary || intents.content || intents.copywriting) {
    deepBlock += buildSkillsLibraryBlock(query);
  }

  // ── Fallback: si ningún intent específico detectado ──────────────────────
  if (!deepBlock) {
    deepBlock = "\n\n──────────── SKILLS UNIVERSALES (fallback) ────────────\n"
      + SEO_OPTIMIZER_PROMPT + "\n\n" + EXPERT_MARKETING_KNOWLEDGE;
  }

  const cybersecBlock = buildCybersecKnowledgeBlock();

  return PLATFORM_SKILLS_MASTER_CATALOG + deepBlock + cybersecBlock;
}

// ─── Exportaciones de acceso directo ─────────────────────────────────────────
export { PLATFORM_SKILLS_MASTER_CATALOG as MASTER_CATALOG };

// Re-export KBs para uso externo (rutas, acciones, etc.)
export {
  SKILLS_LIBRARY, searchSkills,
  BRAND_DNA_FRAMEWORK, CAMPAIGN_TYPES, UGC_ARCHETYPES, MICRO_CLIP_METHOD,
  MASTER_PROMPT_FORMULA, PLATFORM_PROMPT_RECIPES,
  OPTICAL_TECHNIQUES, CINEMATOGRAPHY_PRESETS, SHOT_VOCABULARY,
  PRESENTER_STYLES, ACTION_TOKENS, CONTINUITY_TOKENS,
  COGS_METHODOLOGY_PILLARS, HIDDEN_COST_CATEGORIES, TCO_COMPONENTS,
  GOLDEN_RULE, getFullCogsMethodology,
  PLUGINS_CATALOG, getPluginsByCategory, searchPlugins, getPopularPlugins,
  PLATFORM_PROFILES, GLOBAL_STATE_TEMPLATES, PROMPT_SEQUENCES,
  PRODUCT_PRESETS, getExplodedViewSummary, buildPromptWithGlobalState,
  CHARACTER_LOCKS, VIDEO_CAMPAIGNS, UGC_MICRO_CLIPS,
  getCampaignProductionSummary,
};
