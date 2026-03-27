import { Router } from "express";
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicorePromptLibraryTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable, omnicoreStudySessionsTable, omnicoreCrossConnectionsTable, projectsTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import Anthropic from "@anthropic-ai/sdk";
import { loadExistingEntityKnowledge } from "./entity-research.js";
import { APP_GUIDE_KNOWLEDGE, getPageContextForRoute, detectGuideRequest } from "../lib/app-guide.js";
import { shopifyRequest, refreshToken, getShopifyHeaders, normalizeShopDomain } from "../lib/shopify.js";
import { safeDecrypt } from "../lib/crypto.js";
import { learnFromOperation, askClaudeJsonWithBrain, askClaudeWithBrain, buildBrandDnaContext, buildShopyBrainContext, SHOPIFY_EXPERT_SYSTEM as CLAUDE_EXPERT_SYSTEM } from "../lib/claude.js";
import { askGeminiWithSearch } from "../lib/gemini.js";
import { logger } from "../lib/logger.js";
import { saveToVault } from "../lib/vault.js";
import * as fs from "fs";
import * as path from "path";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function researchRealPricing(productTitle: string, productType: string, niche: string, currentPrice?: string): Promise<{
  marketPriceRange: { min: number; max: number; median: number };
  competitorPrices: Array<{ source: string; price: string; url?: string }>;
  suggestedPrice: number;
  suggestedCompareAtPrice: number;
  pricingStrategy: string;
  sources: string[];
}> {
  const defaultResult = {
    marketPriceRange: { min: 0, max: 0, median: 0 },
    competitorPrices: [],
    suggestedPrice: currentPrice ? parseFloat(currentPrice) : 0,
    suggestedCompareAtPrice: 0,
    pricingStrategy: "No se pudo investigar precios del mercado",
    sources: [],
  };

  try {
    const searchPrompt = `BUSCA PRECIOS REALES en tiendas online para este tipo de producto:

Producto: "${productTitle}"
Tipo: ${productType || "no especificado"}
Nicho/industria: ${niche}
${currentPrice ? `Precio actual: ${currentPrice}€` : ""}

INSTRUCCIONES:
1. Busca en Google Shopping, Amazon, tiendas especializadas del nicho "${niche}"
2. Encuentra AL MENOS 5-10 precios REALES de productos similares o competidores directos
3. Extrae precios concretos con decimales y la URL/fuente de cada uno
4. Calcula el rango de mercado real (mínimo, máximo, mediana)

RESPONDE con este formato JSON exacto (sin texto adicional):
{
  "competitorPrices": [
    {"source": "nombre tienda/marca", "price": "XX.XX", "url": "URL si disponible", "productName": "nombre del producto encontrado"}
  ],
  "marketPriceRange": {"min": XX.XX, "max": XX.XX, "median": XX.XX},
  "suggestedPrice": XX.XX,
  "suggestedCompareAtPrice": XX.XX,
  "pricingStrategy": "Explicación de la estrategia de pricing recomendada basada en los datos reales encontrados",
  "marketPosition": "budget|mid-range|premium|luxury"
}`;

    const geminiResult = await askGeminiWithSearch(searchPrompt,
      `You are a pricing analyst. Search for REAL current prices of similar products online. Always use Google Search to find actual prices from real stores. Return ONLY valid JSON.`
    );

    const jsonMatch = geminiResult.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return defaultResult;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      marketPriceRange: parsed.marketPriceRange ?? defaultResult.marketPriceRange,
      competitorPrices: parsed.competitorPrices ?? [],
      suggestedPrice: parsed.suggestedPrice ?? (currentPrice ? parseFloat(currentPrice) : 0),
      suggestedCompareAtPrice: parsed.suggestedCompareAtPrice ?? 0,
      pricingStrategy: parsed.pricingStrategy ?? "",
      sources: geminiResult.sources || [],
    };
  } catch (err) {
    logger.warn(err, "Price research failed, using defaults");
    return defaultResult;
  }
}

const DOMAIN_LABELS: Record<string, string> = {
  ecommerce:            "eCommerce · CRO · UX · Conversión",
  shopify_technical:    "Shopify Técnico · Liquid · APIs · Themes",
  financial_analysis:   "Finanzas · P&L · Cash Flow · Unit Economics",
  trading_markets:      "Trading · Mercados Internacionales · Tendencias",
  investment:           "Inversión · Valoración · Due Diligence · ROI",
  marketing:            "Marketing Digital · Branding · Storytelling · Funnels",
  sales:                "Ventas · Negociación · Psicología de ventas",
  design_ux:            "Diseño · UX/UI · Tipografía · Color Theory · Motion",
  merchandising:        "Merchandising Visual · Packaging · Presentación",
  seo_content:          "SEO · Contenido · Blog · Keywords · Link Building",
  logistics:            "Logística · Fulfillment · Envíos · Cadena de suministro",
  paid_media:           "Paid Media · ROAS · Google Ads · Meta Ads · TikTok",
  consumer_psychology:  "Psicología del Consumidor · Neuromarketing · Persuasión",
  pricing_science:      "Pricing Science · Elasticidad · Bundling · Anchoring",
  visual_production:    "Producción Visual · Cinematografía",
  photography:          "Fotografía de Producto · Composición · Iluminación · Estilos",
  video_content:        "Vídeo · Reels · TikTok · YouTube · UGC · Producción",
  copywriting:          "Copywriting Persuasivo · Titulares · CTAs · Fórmulas",
  social_media:         "Redes Sociales · Community · Engagement · Influencers",
  ai_technology:        "IA · Machine Learning · Automatización · Prompts · LLMs",
  legal_compliance:     "Legal · GDPR · Normativa eCommerce · Propiedad intelectual",
  sustainability:       "Sostenibilidad · Packaging eco · ESG · Economía circular",
  customer_service:     "Atención al cliente · Retención · NPS · Fidelización",
  analytics_data:       "Analytics · Data Science · Dashboards · Métricas",
  international:        "Internacionalización · Multiidioma · Cross-border",
  trends_innovation:    "Tendencias · Innovación · AR/VR · Live Shopping · Social Commerce",
  supply_chain:         "Proveedores · Sourcing · Alibaba · Fabricación · Dropshipping",
  brand_strategy:       "Estrategia de Marca · Posicionamiento · Brand Equity",
  email_automation:     "Email Marketing · Klaviyo · Segmentación · Flows",
  marketplace:          "Marketplaces · Amazon · Etsy · Omnichannel",
  taxes_accounting:     "Impuestos · Contabilidad · IVA · Facturación",
  general:              "Conocimiento General · Multidisciplinar",
  "Conversion Rate Optimization":     "CRO · Tests A/B · Funnels · Optimización de conversión",
  "Copywriting & Product Descriptions": "Copywriting · Fichas de producto · SEO Copy · Storytelling",
  "Email Marketing & Retention":       "Email Marketing · Retención · Flows · Klaviyo · Newsletters",
  "Mobile UX & Checkout":              "UX Móvil · Checkout · Responsive · App Commerce",
  "Pricing Psychology & Strategy":     "Psicología de Precios · Estrategia · Anchoring · Bundling",
  "Product Photography & Images":      "Fotografía · Imágenes de Producto · IA Visual · Composición",
  "SEO & Product Discovery":           "SEO · Descubrimiento de Producto · Keywords · Schema · SERP",
  "Social Proof & Reviews":            "Social Proof · Reviews · Testimonios · UGC · Trust",
  "Upsell & Cross-sell Strategies":    "Upsell · Cross-sell · Bundles · Estrategias de Ticket Medio",
};

export async function ensureAllKnowledgeDomains() {
  const domains = Object.keys(DOMAIN_LABELS);
  let created = 0;
  for (const domain of domains) {
    const existing = await db.select().from(omnicoreKnowledgeDomainsTable).where(eq(omnicoreKnowledgeDomainsTable.domain, domain));
    if (!existing.length) {
      await db.insert(omnicoreKnowledgeDomainsTable).values({
        id: randomBytes(12).toString("hex"),
        domain,
        knowledgeDepth: 0,
        verifiedInsights: 0,
        totalInsights: 0,
      });
      created++;
    }
  }
  return created;
}

async function ensureDomains() {
  return ensureAllKnowledgeDomains();
}

router.get("/shopybrain/status", requireAdmin, async (req, res): Promise<void> => {
  await ensureDomains();
  const memories = await db.select({ count: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
  const insights = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable);
  const domains = await db.select().from(omnicoreKnowledgeDomainsTable).orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));
  const recentSessions = await db.select().from(omnicoreStudySessionsTable).orderBy(desc(omnicoreStudySessionsTable.createdAt)).limit(5);
  const nicheProfiles = await db.select({ count: sql<number>`count(*)` }).from(omnicoreNicheProfilesTable);
  const topMemories = await db.select().from(omnicoreMemoriesTable)
    .orderBy(desc(omnicoreMemoriesTable.confidence))
    .limit(8);

  res.json({
    totalMemories: Number(memories[0]?.count ?? 0),
    totalInsights: Number(insights[0]?.count ?? 0),
    totalNicheProfiles: Number(nicheProfiles[0]?.count ?? 0),
    domains: domains.map(d => ({ ...d, label: DOMAIN_LABELS[d.domain] ?? d.domain })),
    recentSessions,
    topMemories,
    brainHealth: domains.length > 0
      ? Math.round(domains.reduce((a, d) => a + (d.knowledgeDepth ?? 0), 0) / domains.length)
      : 0,
  });
});

router.get("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  const { niche, type, minConfidence, limit = "50" } = req.query as Record<string, string>;
  let query = db.select().from(omnicoreMemoriesTable) as any;
  const conditions = [];
  if (niche) conditions.push(eq(omnicoreMemoriesTable.niche, niche));
  if (type) conditions.push(eq(omnicoreMemoriesTable.memoryType, type));
  if (minConfidence) conditions.push(gte(omnicoreMemoriesTable.confidence, parseFloat(minConfidence)));
  if (conditions.length) query = query.where(and(...conditions));
  const memories = await query.orderBy(desc(omnicoreMemoriesTable.confidence)).limit(parseInt(limit));
  res.json(memories);
});

router.post("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  const { memoryType, niche, subNiche, productType, market, title, content, confidence, tags, sourceType } = req.body;
  if (!memoryType || !title || !content) {
    res.status(400).json({ error: "memoryType, title y content son requeridos" });
    return;
  }
  const memory = {
    id: randomBytes(16).toString("hex"),
    memoryType,
    niche: niche ?? null,
    subNiche: subNiche ?? null,
    productType: productType ?? null,
    market: market ?? "es",
    title,
    content,
    confidence: confidence ?? 0.7,
    tags: tags ? JSON.stringify(tags) : null,
    sourceType: sourceType ?? "manual",
    isVerified: 1,
  };
  await db.insert(omnicoreMemoriesTable).values(memory);
  res.json(memory);
});

router.delete("/shopybrain/memories/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(omnicoreMemoriesTable).where(eq(omnicoreMemoriesTable.id, String(req.params.id)));
  res.json({ success: true });
});

router.post("/shopybrain/learn", requireAdmin, async (req, res): Promise<void> => {
  const { event, niche, productType, data } = req.body;
  if (!event) {
    res.status(400).json({ error: "event es requerido" });
    return;
  }

  const memTypeMap: Record<string, string> = {
    image_success: "image_pattern",
    ab_winner: "ab_insight",
    price_success: "pricing_pattern",
    audit_complete: "niche_keyword",
    competitor_scan: "competitor_intel",
  };

  const memory = {
    id: randomBytes(16).toString("hex"),
    memoryType: memTypeMap[event] ?? "general",
    niche: niche ?? null,
    productType: productType ?? null,
    title: `Aprendizaje automático: ${event}`,
    content: JSON.stringify(data ?? {}),
    confidence: 0.5,
    sourceType: `learned_${event}`,
  };

  await db.insert(omnicoreMemoriesTable).values(memory);
  res.json({ success: true, memoryId: memory.id });
});

router.post("/shopybrain/search", requireAdmin, async (req, res): Promise<void> => {
  const { query, niche, searchType, returnRaw, systemPrompt: customSystemPrompt, conversationHistory, currentRoute } = req.body;
  if (!query) {
    res.status(400).json({ error: "query es requerido" });
    return;
  }

  if (returnRaw) {
   try {
    let entityKnowledgeContext = "";
    const entityMatches = query.match(/[@]([a-zA-Z0-9_.]+)|(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]{3,})\.[a-zA-Z]{2,}|(?:sobre|investigar?|analiza|dame información de|qué sabes de|qué tienes sobre)\s+([^\?\.]+)/i);
    const potentialEntity = entityMatches?.[1] ?? entityMatches?.[2] ?? entityMatches?.[3]?.trim();

    if (potentialEntity && potentialEntity.length > 2) {
      try {
        const entityKnowledge = await loadExistingEntityKnowledge(potentialEntity);
        if (entityKnowledge.hasKnowledge) {
          entityKnowledgeContext = `\n\n═══ CONOCIMIENTO ACUMULADO EN SHOPYBRAIN SOBRE "${potentialEntity.toUpperCase()}" ═══
[${entityKnowledge.memories.length} memorias · ${entityKnowledge.dimensions.join(", ")} · última actualización: ${entityKnowledge.knowledgeAge}]

${entityKnowledge.summary.slice(0, 3000)}
═══ FIN DE CONOCIMIENTO PREVIO ═══

INSTRUCCIÓN: Usa este conocimiento guardado como base para tu respuesta. Es información real ya investigada y verificada por ShopyBrain. Complementa con tu propio conocimiento si es necesario.`;
        }
      } catch {
      }
    }

    const relevantMemories = await db.select()
      .from(omnicoreMemoriesTable)
      .where(gte(omnicoreMemoriesTable.confidence, 0.6))
      .orderBy(desc(omnicoreMemoriesTable.updatedAt))
      .limit(5);

    const memoriesContext = relevantMemories.length > 0
      ? `\n\nCONOCIMIENTO RECIENTE EN SHOPYBRAIN:\n${relevantMemories.map(m => `• ${m.title}: ${(m.content ?? "").slice(0, 200)}`).join("\n")}`
      : "";

    const isGuideRequest = detectGuideRequest(query);
    const pageContext = currentRoute ? getPageContextForRoute(currentRoute) : "";
    const guideBlock = isGuideRequest ? `\n\n${APP_GUIDE_KNOWLEDGE}` : "";
    const pageBlock = pageContext ? `\n\nPÁGINA ACTUAL DEL USUARIO: ${pageContext}\nRuta: ${currentRoute}\nINSTRUCCIÓN: Si el usuario pregunta algo, ten en cuenta que está en esta página. Si pide ayuda, guíale con los botones y opciones EXACTOS de esta página. Sé muy específico con nombres de botones, ubicaciones y orden de pasos.` : "";

    let brandDnaBlock = "";
    const activeProjectId = req.body.activeProjectId;
    if (activeProjectId) {
      try {
        const [brandDna, brainContext] = await Promise.all([
          buildBrandDnaContext(parseInt(activeProjectId)),
          buildShopyBrainContext(niche, "general"),
        ]);
        brandDnaBlock = (brainContext || "") + (brandDna || "");
      } catch {}
    }

    const actionDetectionBlock = `

CAPACIDADES DE ACCIÓN DIRECTA — SHOPIFY:
Cuando el usuario pida EJECUTAR una acción (crear producto, cambiar precio, ver productos, regenerar token, etc.), debes responder con un bloque JSON de acción AL FINAL de tu respuesta, después de tu texto explicativo.

Formato del bloque de acción (pon esto al final de tu respuesta cuando detectes una acción):
:::ACTION:::{"action":"nombre_accion","params":{...}}:::END_ACTION:::

Acciones disponibles:
- store_status: Ver estado de la tienda. Params: {projectId}
- list_products: Listar productos activos. Params: {projectId, limit?}
- list_all_products: Listar TODOS los productos (active+draft+archived). Params: {projectId, limit?, statusFilter? ("any","active","draft","archived")}
- create_product: Crear producto COMPLETO con IA (título SEO, descripción 400+ palabras, tags, precio real del mercado, meta tags SEO, e imágenes generadas con IA según plan). Params: {projectId, title, bodyHtml?, price?, tags?, productType?, vendor?, status?, aiGenerate?, skipImages?}
- edit_product: Editar producto. Params: {projectId, productId, title?, bodyHtml?, tags?, status?, price?, vendor?}
- change_price: Cambiar precio. Params: {projectId, productId, price, compareAtPrice?}
- set_product_status: Cambiar estado de producto (publicar/despublicar/archivar). Params: {projectId, productId, status ("active","draft","archived")}
- scan_store: Escanear/auditar TODOS los productos de la tienda (incluye draft, archived). Params: {projectId, statusFilter? ("any","active","draft","archived")}
- regenerate_token: Regenerar token Shopify. Params: {projectId}
- get_scopes: Ver permisos/scopes. Params: {projectId}
- delete_product: Eliminar producto. Params: {projectId, productId}
- search_product: Buscar producto por nombre. Params: {projectId, query}
- publish_product: Publicar producto (draft→active). Params: {projectId, productId}
- get_orders: Ver pedidos recientes. Params: {projectId, limit?}
- search_suppliers: Buscar proveedores de un producto. Params: {productName, productCategory?, materials?, targetMarket?, qualityTier?, budget?, country?}
- modify_audit_filter: Cambiar el filtro de auditoría para incluir/excluir productos por estado. Params: {projectId, statusFilter ("any","active","draft","archived"), autoScan? (boolean, default true)}
- diagnose_app: Auditar el funcionamiento interno de la app, detectar errores y repararlos. Params: {projectId, checks? ("all","token","sync","products","connectivity")}
- optimize_product: Optimizar un producto con IA (título, descripción, tags, SEO, alt texts). Params: {projectId, productId}
- optimize_all_products: Optimizar TODOS los productos con IA profesional. Params: {projectId, limit? (default 10, max 25)}
- create_collection: Crear colección Shopify. Params: {projectId, title, type? ("custom"|"smart"), bodyHtml?, rules? (para smart), productIds? (para custom), sortOrder?, aiGenerate? (default true)}
- list_collections: Listar colecciones. Params: {projectId, limit?}
- auto_collections: Analizar productos y crear colecciones inteligentes automáticamente. Params: {projectId}
- create_page: Crear página Shopify con contenido IA. Params: {projectId, title?, pageType? ("about"|"contact"|"faq"|"shipping"|"returns"|"privacy"|"terms"|"size_guide")}
- list_pages: Listar páginas de la tienda. Params: {projectId}
- design_all_pages: Diseñar TODAS las páginas esenciales de la tienda. Params: {projectId, pageTypes? (default ["about","faq","shipping","returns","contact"])}
- optimize_images: Generar alt texts SEO para imágenes. Params: {projectId, productId? (si no se da, optimiza todos)}
- inspect_code: Leer y analizar un archivo de código fuente de la app. Params: {filePath (ej: "src/pages/projects/Audit.tsx"), analyze? (boolean, default true)}
- fix_code: Aplicar una corrección a un archivo de código fuente. Params: {filePath, oldCode (texto exacto a reemplazar), newCode (código corregido), description (descripción del fix)}
- list_source_files: Listar archivos del código fuente de la app. Params: {directory? (ej: "src/pages", "src/components"), pattern? (ej: ".tsx", ".ts")}
- analyze_component: Analizar un componente/página en profundidad buscando bugs, problemas de UX, errores lógicos. Params: {filePath, focusOn? ("bugs","ux","performance","logic","all")}
- read_cms: Leer contenido actual del CMS. Params: {section? (ej: "hero", "pricing.plans", "adminPanel.sidebarLabels")} — sin section devuelve lista de secciones
- update_cms: Editar UN campo del CMS. Params: {path (ej: "hero.headline"), value (nuevo valor)}
- update_cms_batch: Editar MÚLTIPLES campos del CMS de una vez. Params: {changes: [{path, value}, ...]}
- reset_cms: Resetear TODO el CMS a valores por defecto. Params: {} (sin params)
- generate_competitive_pricing: Investigar mercado real, generar catálogo de precios competitivos, actualizar CMS Y crear productos en Shopify. Params: {projectId? (para sync con Shopify), numPlans? (3-8, default 6), industry? (default "Shopify agency / eCommerce SaaS"), syncToShopify? (default true)}
- audit_app_offerings: Auditar la oferta de la app, features, pricing actual, y generar recomendaciones. Params: {} (sin params)
- modify_ui: Aplicar cambios visuales/UI/CSS/layout a la app (scroll horizontal, animaciones, responsive, colores, etc.). Params: {target (qué cambiar, ej: "pricing carousel", "hero section", "sidebar"), change (qué hacer, ej: "hacer scroll horizontal en móvil", "añadir animación fade-in")}

CMS PATHS (usa update_cms/update_cms_batch, N=índice):
  site.name|tagline|primaryColor|accentColor|favicon|logo.type|logo.value|logo.imageUrl|font_heading|font_body
  nav.links.N.label|href, nav.ctaPrimary|ctaSecondary.label|href
  hero.pill.text|visible, hero.headline|headlineHighlight|subheadline|ctaPrimary.label|ctaSecondary.label|ctaApk.label|trustItems|scrollHint
  features.pill|headline|subheadline, features.items.N.title|description|icon|stats.N.label|value
  pricing.plans.N.name|price|currency|period|featured|badge|features.N.text|included|cta.label|style
  calculator.pill|headline|subheadline|disclaimer|oneTimeServices.N.name|price|recurringServices.N.name|price
  results.pill|headline|stats.N.num|label|prefix|suffix, contact.pill|headline|buttonLabel
  backgrounds.SECTION.type|videoUrl|particleColor (SECTION=hero|features|pricing|how|results|calculator|contact)
  footer.tagline|copyright, adminPanel.sidebarLabels.*, clientPanel.sidebar.*
  ADMIN BACK LABEL: adminBackLabel
  APK LABELS: apkLabels.idle, apkLabels.checking, apkLabels.downloading, apkLabels.building, apkLabels.unavailable
  ERROR MESSAGES: errorMessages.sendFail, errorMessages.unexpected
  HERO DEMO TITLES: heroDemoTitles.storeHealth, heroDemoTitles.recentActivity
  NOTA: Para editar arrays enteros (como trustItems, sectionNav, nicheOptions), pasa el array completo como value. Para editar items de arrays por índice, usa N (ej: pricing.plans.0.price = "99")

REGLAS DE DETECCIÓN DE ACCIONES (detecta la intención y ejecuta la acción correcta):
- Proveedores/suppliers → search_suppliers
- Crear producto → create_product (genera todo automáticamente: SEO, descripción, precio, imágenes)
- Ver/listar productos → list_products; TODOS/draft/archivados → list_all_products con statusFilter
- Estado tienda → store_status; Regenerar token → regenerate_token
- Cambiar precio → change_price; Publicar → set_product_status(active); Despublicar → set_product_status(draft); Archivar → set_product_status(archived)
- Escanear/auditar tienda → scan_store; Diagnosticar app → diagnose_app
- Ver/inspeccionar código → inspect_code; Arreglar código → inspect_code + fix_code
- Listar archivos → list_source_files; Analizar componente → analyze_component
- Optimizar producto → optimize_product; Optimizar todos → optimize_all_products
- Colecciones → create_collection / list_collections / auto_collections
- Páginas → create_page / list_pages / design_all_pages
- Imágenes/alt text → optimize_images
- Borrar producto → delete_product; Buscar → search_product; Pedidos → get_orders
- Editar CMS (textos, landing, admin) → update_cms o update_cms_batch; Leer CMS → read_cms; Resetear → reset_cms
- Generar/comparar precios → generate_competitive_pricing; Auditar oferta → audit_app_offerings
- Preguntar nuestros precios/catálogo → responde directamente con TODOS los precios de memoria, SIN ejecutar acción
- Crear productos de suscripción en Shopify → create_product por cada plan (múltiples :::ACTION:::)
- Cambiar diseño/UI/CSS → modify_ui
- Setup completo → optimize_all_products + auto_collections + design_all_pages + optimize_images en secuencia
- USA projectId del contexto si hay proyecto activo
- Explica brevemente qué vas a hacer ANTES del bloque :::ACTION:::
- Si no necesitas acción, responde normalmente sin :::ACTION:::
- SIGUE la conversación: comprende el contexto previo y lo que el usuario ya pidió. No repitas ni ignores instrucciones anteriores.
`;

    const agencyPricingKnowledge = `

CONOCIMIENTO DE NEGOCIO — CATÁLOGO COMPLETO DE SERVICIOS ShopyBrain (Shopy Crafter):

MODELO DE NEGOCIO: Agencia Shopify con servicios puntuales (one-time) + retainers mensuales (recurring). Pagos por Shopify (NO Stripe). La plataforma ShopyBrain es el motor IA que impulsa la agencia "Shopy Crafter".

4 PLANES DE SUSCRIPCIÓN (retainer mensual + setup único):
1. Starter — €49/mes + €297 setup único. Hasta 3 tiendas Shopify. Incluye: auditoría automática, M1 generación de imágenes (100/mes), M5 pricing COGS básico, M6 SEO técnico. NO incluye: OmniCore Brain, A/B Testing, portal cliente.
2. Agency Pro — €149/mes + €597 setup. Hasta 15 tiendas. Los 6 motores completos + 500 imágenes/mes + OmniCore Brain (memoria acumulada) + A/B Testing con pixel + Portal cliente. Badge "Más popular".
3. Enterprise — €399/mes + €1.497 setup. Tiendas ilimitadas, imágenes ilimitadas. White-label, API access, SLA, account manager dedicado por Slack.
4. One-Shot Audit — €197 pago único (sin retainer). 1 auditoría completa + 30 redesigns + informe SEO + análisis COGS.

9 SERVICIOS PUNTUALES (one-time, precio por unidad — escalables):
1. Auditoría completa de tienda — €197/tienda
2. Rediseño IA por producto — €9/producto (título, descripción 400+ palabras, tags SEO)
3. Imagen IA profesional — €3/imagen (Hero, Lifestyle, Detalle)
4. Informe pricing y márgenes — €97/informe
5. Optimización SEO por producto — €7/producto (meta tags, keywords, Schema JSON-LD)
6. Informe de competencia — €97/informe
7. Investigación de proveedores — €97/investigación
8. Setup email marketing — €197
9. Proyección de ventas — €127/informe
PACKS SUGERIDOS: 30 productos redesign = 30×9€ = 270€. 30 imágenes = 30×3€ = 90€. SEO 30 productos = 30×7€ = 210€.

3 SERVICIOS RECURRENTES (mensuales):
1. Mantenimiento básico — €49/mes
2. Gestión activa — €149/mes
3. Premium ilimitado — €399/mes

CAPACIDADES REALES DE LA PLATAFORMA (para justificar precios):
- 6 motores IA: M1 Imágenes (Replicate Flux+Recraft), M2 Consistencia Visual, M3 A/B Testing (pixel tracking), M4 Auto-Pilot 24/7 (cron jobs), M5 Pricing Financiero (P&L, COGS, márgenes), M6 SEO Técnico (Schema, meta tags, alt texts)
- OmniCore Brain: 37 acciones Shopify + investigación de entidades + memoria permanente + 12 cron jobs de aprendizaje continuo
- Investigación de mercado REAL con Google Search Grounding (Gemini)
- Generación de imágenes profesionales con IA (Replicate)
- Análisis financiero con Claude (pricing, unit economics, cash flow)
- Email marketing con templates IA + Klaviyo integration
- Sistema de proveedores con investigación IA
- Encriptación AES-256, RGPD compliant
- Panel admin completo + panel cliente read-only
- Exportación de reportes en PDF

CUANDO TE PREGUNTEN SOBRE PRECIOS:
- Siempre conoces los precios exactos. No digas "no sé" o "comprueba la landing".
- Si te piden comparar precios con la competencia, EJECUTA generate_competitive_pricing para investigar en REAL TIME con Google Search.
- Si te piden auditar la oferta actual, EJECUTA audit_app_offerings.
- Si te piden crear productos de suscripción en Shopify, usa create_product con los datos del plan correspondiente.
- Sugiere proactivamente ajustes de precio cuando detectes oportunidades.
- Usa psicología de precios: precios acabados en 7 o 9, anclaje con el plan Enterprise, badge "Más popular" en el mid-tier.

PARA CREAR PRODUCTOS DE SUSCRIPCIÓN EN SHOPIFY:
Cuando el usuario pida crear productos de servicios/suscripciones en Shopify, crea productos con:
- Título profesional del servicio
- Descripción detallada HTML con beneficios y qué incluye
- Precio del servicio
- Tags: "servicio", "suscripcion" o "one-time", "shopybrain"
- productType: "Service" o "Subscription"
- vendor: "Shopy Crafter"
Ejemplo: create_product con title="Plan Agency Pro — Gestión Shopify IA", price="149.00", bodyHtml="<h2>Plan Agency Pro</h2><p>Gestión completa de hasta 15 tiendas...</p>", tags="servicio, suscripcion, mensual, shopybrain"
`;

    const sysPrompt = (customSystemPrompt ?? `Eres OmniCore AI, el asistente central de la plataforma ShopyBrain para agencias Shopify.
Eres experto en Shopify, Klaviyo, email marketing, SEO, pricing y estrategia eCommerce.
Eres el CFO y estratega de precios de la agencia Shopy Crafter. Conoces TODOS los servicios y precios de memoria.
Tienes acceso al conocimiento acumulado de ShopyBrain — memorias de investigaciones anteriores sobre marcas, nichos y estrategias.
Responde siempre en español, de forma directa, clara y accionable.
Cuando el usuario pida ayuda o pregunte cómo hacer algo, actúa como GUÍA INTERACTIVA: da instrucciones paso a paso con los nombres EXACTOS de botones, páginas y secciones de la app.
Si conoces la página actual del usuario, contextualiza tu respuesta a esa página.
Cuando tengas conocimiento previo sobre una entidad, úsalo activamente en tu respuesta e indica qué parte viene de tu memoria.
PUEDES EJECUTAR ACCIONES EN SHOPIFY directamente desde el chat. Cuando el usuario pida crear, editar, eliminar, publicar productos, cambiar precios, ver estado de la tienda, regenerar tokens, etc., EJECUTA la acción correspondiente.
IMPORTANTE: Cuando ejecutes acciones largas (auditoría, pricing competitivo, investigación), NO digas "dame 10 segundos". Ejecuta la acción directamente con :::ACTION::: y el sistema mostrará progreso automáticamente.`) + agencyPricingKnowledge + actionDetectionBlock + guideBlock + pageBlock + entityKnowledgeContext + memoriesContext + brandDnaBlock;

    const projectContext = req.body.activeProjectId ? `\n[CONTEXTO: El usuario tiene el proyecto activo con ID ${req.body.activeProjectId}. Úsalo como projectId en las acciones.]` : "";
    const userContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + projectContext;

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-20250404",
      max_tokens: 1500,
      system: sysPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const answer = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";

    let detectedAction: { action: string; params: Record<string, unknown> } | null = null;
    const detectedActions: { action: string; params: Record<string, unknown> }[] = [];
    const actionRegex = /:::ACTION:::([\s\S]*?):::END_ACTION:::/g;
    let actionMatch;
    while ((actionMatch = actionRegex.exec(answer)) !== null) {
      try {
        detectedActions.push(JSON.parse(actionMatch[1]));
      } catch { /* invalid JSON, skip */ }
    }
    if (detectedActions.length > 0) {
      detectedAction = detectedActions[0];
    }

    const cleanAnswer = answer.replace(/:::ACTION:::[\s\S]*?:::END_ACTION:::/g, "").trim();

    res.json({
      answer: cleanAnswer,
      source: "claude+omnicore",
      entityKnowledgeUsed: !!entityKnowledgeContext,
      potentialEntity: potentialEntity ?? null,
      detectedAction,
      detectedActions: detectedActions.length > 1 ? detectedActions : undefined,
    });
    return;
   } catch (searchErr) {
    const errStr = searchErr instanceof Error ? searchErr.message : String(searchErr);
    logger.error({ error: searchErr, query }, "ShopyBrain search error");

    let recoveryMsg = "Lo siento, hubo un problema procesando tu solicitud. Intenta reformular tu pregunta de forma más corta y directa.";
    if (errStr.includes("credit balance is too low") || errStr.includes("insufficient_quota")) {
      recoveryMsg = "⚠️ **Créditos de IA agotados** — La API de Claude no tiene saldo suficiente. Recarga tus créditos en console.anthropic.com para seguir chateando.";
    } else if (errStr.includes("rate_limit") || errStr.includes("Too many requests")) {
      recoveryMsg = "⏳ Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.";
    } else if (errStr.includes("overloaded")) {
      recoveryMsg = "🔄 El servicio de IA está sobrecargado temporalmente. Inténtalo en 1-2 minutos.";
    }

    res.status(200).json({
      answer: recoveryMsg,
      source: "error_recovery",
      detectedAction: null,
    });
    return;
   }
  }

  const conditions = [gte(omnicoreMemoriesTable.confidence, 0.3)];
  if (niche) conditions.push(eq(omnicoreMemoriesTable.niche, niche));

  const existingMemories = await db.select().from(omnicoreMemoriesTable)
    .where(and(...conditions))
    .orderBy(desc(omnicoreMemoriesTable.confidence))
    .limit(5);

  if (existingMemories.length >= 3) {
    res.json({
      source: "shopybrain_memory",
      confidence: existingMemories[0]?.confidence ?? 0.5,
      age: "instant",
      results: existingMemories,
      message: `⚡ Respuesta desde Shopy Brain (${existingMemories.length} memorias relevantes)`,
    });
    return;
  }

  const activeProjectId = req.body.activeProjectId;
  const researchSystemPrompt = `Eres Shopy Brain, el megacerebro de eCommerce Shopify con acceso a todo el conocimiento acumulado de la plataforma.
Analiza y responde con datos concretos sobre: ${searchType ?? "estrategia general"}.
Nicho de mercado: ${niche ?? "general"}.
Proporciona insights accionables y específicos basados en tu experiencia real con tiendas Shopify.
Incluye datos de pricing, competencia, tendencias y estrategias probadas.`;

  let aiContent = "";
  try {
    if (activeProjectId) {
      aiContent = await askClaudeWithBrain(
        parseInt(activeProjectId),
        [{ role: "user", content: query }],
        researchSystemPrompt,
        "general",
        niche || undefined,
        1024
      );
    } else {
      const brainCtx = await buildShopyBrainContext(niche || undefined, "general");
      const aiRes = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: researchSystemPrompt + (brainCtx || ""),
        messages: [{ role: "user", content: query }],
      });
      aiContent = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";
    }
  } catch (aiErr) {
    const errStr = aiErr instanceof Error ? aiErr.message : String(aiErr);
    logger.error({ error: aiErr, query }, "ShopyBrain research AI error");

    let msg = "Error al procesar la investigación. Inténtalo de nuevo.";
    if (errStr.includes("credit balance is too low") || errStr.includes("insufficient_quota")) {
      msg = "⚠️ Créditos de IA agotados — Recarga en console.anthropic.com para continuar.";
    } else if (errStr.includes("rate_limit") || errStr.includes("Too many requests")) {
      msg = "⏳ Demasiadas peticiones. Espera unos segundos.";
    } else if (errStr.includes("overloaded")) {
      msg = "🔄 Servicio de IA sobrecargado temporalmente. Inténtalo en 1-2 minutos.";
    }

    res.json({ source: "error_recovery", confidence: 0, results: [], message: msg });
    return;
  }

  await db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType: "web_research",
    niche: niche ?? null,
    title: query.slice(0, 100),
    content: aiContent,
    confidence: 0.6,
    sourceType: "web_search",
  });

  res.json({
    source: "ai_research",
    confidence: 0.6,
    age: "now",
    results: [{ title: query, content: aiContent }],
    savedToShopyBrain: true,
    message: "🔍→🧠 Búsqueda + aprendido para el futuro",
  });
});

router.get("/shopybrain/insights", requireAdmin, async (req, res): Promise<void> => {
  const { domain } = req.query as { domain?: string };
  let insights;
  if (domain) {
    insights = await db.select().from(omnicoreInsightsTable)
      .where(eq(omnicoreInsightsTable.domain, domain))
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(20);
  } else {
    insights = await db.select().from(omnicoreInsightsTable)
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(50);
  }
  const domains = await db.select().from(omnicoreKnowledgeDomainsTable)
    .orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));
  res.json({ insights, domains: domains.map(d => ({ ...d, label: DOMAIN_LABELS[d.domain] ?? d.domain })) });
});

router.post("/shopybrain/study", requireAdmin, async (req, res): Promise<void> => {
  const { domains: requestedDomains, sessionType = "manual_trigger" } = req.body;
  const domainsToStudy = requestedDomains ?? Object.keys(DOMAIN_LABELS).slice(0, 4);
  const startTime = Date.now();

  const systemPrompt = `Eres ShopyBrain — el MEGACEREBRO OMNISCIENTE que aprende de TODAS las disciplinas del conocimiento humano.
Vas a realizar una sesión de estudio profundo en estos dominios: ${domainsToStudy.join(", ")}.

Tu conocimiento NO tiene límites sectoriales. Absorbes sabiduría de: arte, ciencia, psicología, neurociencia, arquitectura, fotografía, cinematografía, diseño industrial, moda, tecnología, IA, behavioral economics, storytelling, música, antropología cultural, derecho, sostenibilidad, data science, y CUALQUIER disciplina que enriquezca el tema.

Para cada dominio, genera 3-5 insights en formato JSON:
{
  "insights": [
    {
      "domain": "nombre_dominio",
      "insightType": "principle|pattern|correlation|prediction|opportunity|warning",
      "title": "título corto",
      "insight": "el conocimiento específico, profundo y accionable — conectando múltiples disciplinas",
      "evidence": "qué datos, investigaciones, frameworks o ejemplos reales lo soportan",
      "confidence": 0.0-1.0,
      "impactScore": 0.0-1.0,
      "relatedDomains": ["dominio1", "dominio2"]
    }
  ],
  "summary": "resumen de la sesión",
  "keyDiscoveries": ["descubrimiento 1", "descubrimiento 2", "descubrimiento 3"]
}

Principios que guían el análisis:
- Insights PROFUNDOS que combinan conocimiento de MÚLTIPLES disciplinas (ej: neurociencia + fotografía de producto, arquitectura + UX, psicología conductual + pricing)
- Conexiones cross-domain NO OBVIAS que generan ventaja competitiva real
- Datos reales, investigaciones científicas, frameworks probados de CUALQUIER campo
- Ejemplos de las MEJORES prácticas mundiales, sin limitarse a un solo sector o mercado
- Todo orientado a mejorar la calidad del contenido, la estrategia y la ejecución
Responde SOLO con el JSON, sin texto adicional.`;

  const brainCtx = await buildShopyBrainContext(undefined, "general");
  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: `Realiza sesión de estudio para dominios: ${domainsToStudy.join(", ")}` }],
    system: systemPrompt + (brainCtx || ""),
  });

  const rawText = aiRes.content[0].type === "text" ? aiRes.content[0].text : "{}";
  let parsed: any = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {}

  const sessionId = randomBytes(16).toString("hex");
  let insightsCreated = 0;

  if (parsed.insights?.length) {
    for (const insight of parsed.insights) {
      await db.insert(omnicoreInsightsTable).values({
        id: randomBytes(16).toString("hex"),
        domain: insight.domain ?? domainsToStudy[0],
        insightType: insight.insightType ?? "principle",
        title: insight.title ?? "Insight",
        insight: insight.insight ?? "",
        evidence: insight.evidence ?? null,
        confidence: insight.confidence ?? 0.6,
        impactScore: insight.impactScore ?? 0.5,
        relatedDomains: insight.relatedDomains ? JSON.stringify(insight.relatedDomains) : null,
        source: "study_session",
      });
      insightsCreated++;

      await db.update(omnicoreKnowledgeDomainsTable)
        .set({
          totalInsights: sql`${omnicoreKnowledgeDomainsTable.totalInsights} + 1`,
          knowledgeDepth: sql`LEAST(100, ${omnicoreKnowledgeDomainsTable.knowledgeDepth} + 3)`,
          lastStudySession: new Date(),
        })
        .where(eq(omnicoreKnowledgeDomainsTable.domain, insight.domain ?? domainsToStudy[0]));
    }
  }

  await db.insert(omnicoreStudySessionsTable).values({
    id: sessionId,
    sessionType,
    domainsStudied: JSON.stringify(domainsToStudy),
    trigger: req.body.trigger ?? "manual",
    durationSeconds: Math.round((Date.now() - startTime) / 1000),
    insightsCreated,
    summary: parsed.summary ?? `Sesión de estudio completada para ${domainsToStudy.length} dominios`,
    keyDiscoveries: parsed.keyDiscoveries ? JSON.stringify(parsed.keyDiscoveries) : null,
    tokensUsed: aiRes.usage?.input_tokens + aiRes.usage?.output_tokens,
  });

  res.json({
    success: true,
    sessionId,
    insightsCreated,
    summary: parsed.summary,
    keyDiscoveries: parsed.keyDiscoveries ?? [],
    durationMs: Date.now() - startTime,
  });
});

router.get("/shopybrain/sessions", requireAdmin, async (req, res): Promise<void> => {
  const sessions = await db.select().from(omnicoreStudySessionsTable)
    .orderBy(desc(omnicoreStudySessionsTable.createdAt))
    .limit(20);
  res.json(sessions);
});

router.get("/shopybrain/niche-profiles", requireAdmin, async (req, res): Promise<void> => {
  const profiles = await db.select().from(omnicoreNicheProfilesTable)
    .orderBy(desc(omnicoreNicheProfilesTable.storesAnalyzed));
  res.json(profiles);
});

router.post("/shopybrain/niche-profiles", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body;
  if (!body.niche) {
    res.status(400).json({ error: "niche es requerido" });
    return;
  }
  const existing = await db.select().from(omnicoreNicheProfilesTable).where(eq(omnicoreNicheProfilesTable.niche, body.niche));
  if (existing.length) {
    await db.update(omnicoreNicheProfilesTable).set({ ...body, updatedAt: new Date() }).where(eq(omnicoreNicheProfilesTable.niche, body.niche));
    res.json({ success: true, updated: true });
  } else {
    const profile = { id: randomBytes(16).toString("hex"), ...body };
    await db.insert(omnicoreNicheProfilesTable).values(profile);
    res.json(profile);
  }
});

router.get("/shopybrain/prompt-library", requireAdmin, async (req, res): Promise<void> => {
  const prompts = await db.select().from(omnicorePromptLibraryTable)
    .orderBy(desc(omnicorePromptLibraryTable.useCount));
  res.json(prompts);
});

router.post("/shopybrain/prompt-library", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, niche, useCase, promptTemplate, variables } = req.body;
  if (!name || !promptTemplate) {
    res.status(400).json({ error: "name y promptTemplate son requeridos" });
    return;
  }
  const prompt = {
    id: randomBytes(16).toString("hex"),
    name, description, niche, useCase, promptTemplate,
    variables: variables ? JSON.stringify(variables) : null,
    createdBy: (req.session as any).userId,
  };
  await db.insert(omnicorePromptLibraryTable).values(prompt);
  res.json(prompt);
});

// ─── TRIGGERS MANUALES 24/7 ──────────────────────────────────────────────────
router.post("/shopybrain/run/micro-learning", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreMicroLearning } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "⚡ Micro-learning cycle iniciado" });
    runOmniCoreMicroLearning().catch(e => console.error("micro-learning error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/consolidation", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreMemoryConsolidation } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🧠 Memory consolidation iniciada" });
    runOmniCoreMemoryConsolidation().catch(e => console.error("consolidation error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/cross-synthesis", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreCrossConnections } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🔗 Cross-domain synthesis iniciada" });
    runOmniCoreCrossConnections().catch(e => console.error("cross-synthesis error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/daily-study", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreDailyDeepStudy } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🎓 Daily deep study iniciado (14 dominios)" });
    runOmniCoreDailyDeepStudy().catch(e => console.error("daily-study error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/mega-synthesis", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreMegaSynthesis } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🚀 Mega-synthesis semanal iniciada" });
    runOmniCoreMegaSynthesis().catch(e => console.error("mega-synthesis error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── SCHEDULE INFO ────────────────────────────────────────────────────────────
router.get("/shopybrain/schedule", requireAdmin, async (_req, res): Promise<void> => {
  res.json({
    learningCycles: [
      { name: "⚡ Micro-Learning",      frequency: "Cada 3 horas",   description: "2 dominios × 3 insights (16 ciclos/día)", nextRun: "próxima hora redonda ÷ 3", trigger: "/shopybrain/run/micro-learning" },
      { name: "🧠 Memory Consolidation", frequency: "Cada 6 horas",   description: "Insights → memorias permanentes",          trigger: "/shopybrain/run/consolidation" },
      { name: "🔗 Cross-Synthesis",      frequency: "Cada 12 horas",  description: "Conexiones entre dominios",               trigger: "/shopybrain/run/cross-synthesis" },
      { name: "🎓 Daily Deep Study",     frequency: "Diario 1am",     description: "14 dominios × 5 insights = 70 insights",   trigger: "/shopybrain/run/daily-study" },
      { name: "📊 Revenue Snapshots",    frequency: "Diario 2am",     description: "Datos reales de Shopify" },
      { name: "📦 Real Data Sync",       frequency: "Diario 3am",     description: "Integración datos tiendas" },
      { name: "🔍 Competitor Scans",     frequency: "Diario 6am",     description: "Price monitoring" },
      { name: "📦 Inventory Sync",       frequency: "Diario 7am",     description: "Stock + alertas" },
      { name: "🚀 Mega-Synthesis",       frequency: "Domingo 0am",    description: "Síntesis estratégica semanal",            trigger: "/shopybrain/run/mega-synthesis" },
    ],
    stats: {
      insightsPerDay: "~120 insights/día (micro × 16 ciclos + daily 70)",
      domainsTotal: 14,
      learningHoursPerDay: 24,
      continuousLearning: true,
    },
  });
});

export async function getShopyBrainContext(niche: string | null, useCase: string): Promise<string> {
  if (!niche) return "";
  try {
    const memories = await db.select().from(omnicoreMemoriesTable)
      .where(and(
        gte(omnicoreMemoriesTable.confidence, 0.3),
        eq(omnicoreMemoriesTable.niche, niche),
      ))
      .orderBy(desc(omnicoreMemoriesTable.confidence))
      .limit(5);

    const nicheProfiles = await db.select().from(omnicoreNicheProfilesTable)
      .where(eq(omnicoreNicheProfilesTable.niche, niche))
      .limit(1);

    if (!memories.length && !nicheProfiles.length) return "";

    let ctx = `\n═══ SHOPY BRAIN — Conocimiento acumulado para "${niche}" ═══\n`;

    if (nicheProfiles.length) {
      const p = nicheProfiles[0];
      ctx += `PERFIL DEL NICHO "${niche}":\n`;
      if (p.avgPriceSweetSpot) ctx += `- Precio dulce del mercado: €${p.avgPriceSweetSpot}\n`;
      if (p.typicalMarginPct) ctx += `- Margen típico: ${p.typicalMarginPct}%\n`;
      if (p.topKeywords) ctx += `- Top keywords: ${p.topKeywords}\n`;
      if (p.toneDescription) ctx += `- Tono que funciona: ${p.toneDescription}\n`;
    }

    if (memories.length) {
      ctx += `\nMEMORIAS RELEVANTES (${useCase}):\n`;
      for (const m of memories) {
        ctx += `[${m.memoryType?.toUpperCase()}] ${m.title} (confianza: ${Math.round((m.confidence ?? 0.5) * 100)}%)\n${m.content}\n\n`;
      }
    }

    ctx += `═══ FIN SHOPY BRAIN ═══\n`;
    return ctx;
  } catch {
    return "";
  }
}

router.post("/shopybrain/execute-action", requireAdmin, async (req, res): Promise<void> => {
  const { action, params } = req.body;
  if (!action) { res.status(400).json({ error: "action requerida" }); return; }

  try {
    let result: Record<string, unknown> = {};

    switch (action) {
      case "store_status": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const shop = await shopifyRequest<{ shop: Record<string, unknown> }>(parseInt(projectId), project.shopDomain, "/shop.json");
        const productsCount = await shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json");
        const ordersCount = await shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/orders/count.json?status=any");

        const tokenExpiry = project.tokenExpiresAt;
        const tokenValid = tokenExpiry ? new Date(tokenExpiry) > new Date() : false;
        const tokenHoursLeft = tokenExpiry ? Math.max(0, Math.round((new Date(tokenExpiry).getTime() - Date.now()) / 3600000 * 10) / 10) : 0;

        result = {
          storeName: shop.shop?.name ?? project.name,
          domain: project.shopDomain,
          plan: (shop.shop as Record<string, unknown>)?.plan_name,
          currency: (shop.shop as Record<string, unknown>)?.currency,
          productsCount: productsCount.count,
          ordersCount: ordersCount.count,
          tokenStatus: tokenValid ? "valid" : "expired",
          tokenHoursLeft,
          tokenExpiresAt: tokenExpiry,
          message: `Tienda: ${shop.shop?.name ?? project.name} | ${productsCount.count} productos | ${ordersCount.count} pedidos | Token: ${tokenValid ? `válido (${tokenHoursLeft}h restantes)` : "EXPIRADO"}`,
        };
        break;
      }

      case "list_products": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const limit = Math.min(params?.limit ?? 10, 50);
        const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&fields=id,title,status,variants,images,tags`
        );

        result = {
          products: data.products.map((p: Record<string, unknown>) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            price: (p.variants as Array<Record<string, string>>)?.[0]?.price ?? "0.00",
            imageCount: (p.images as unknown[])?.length ?? 0,
            tags: p.tags,
          })),
          total: data.products.length,
          message: `${data.products.length} productos encontrados`,
        };
        break;
      }

      case "create_product": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const title = params?.title;
        if (!title) { res.status(400).json({ error: "title requerido" }); return; }

        let finalTitle = title;
        let finalBody = params?.bodyHtml ?? "";
        let finalTags = params?.tags ?? "";
        let finalPrice = params?.price || "0.00";
        let finalCompareAt = params?.compareAtPrice || null;
        let pricingInfo = "";
        let seoTitle = "";
        let seoDescription = "";

        const storeNiche = project.storeNiche || "general";
        const plan = (project.plan ?? "starter") as string;

        const IMAGE_TYPES_BY_PLAN: Record<string, string[]> = {
          trial: ["hero"],
          starter: ["hero", "lifestyle"],
          agency_pro: ["hero", "lifestyle", "detail", "packaging"],
          enterprise: ["hero", "lifestyle", "detail", "packaging", "ugc"],
          admin: ["hero", "lifestyle", "detail", "packaging", "ugc", "bundle"],
        };

        if (params?.aiGenerate !== false) {
          try {
            const [priceResearch, aiContent] = await Promise.all([
              (!params?.price || params?.price === "0.00")
                ? researchRealPricing(title, params?.productType || "", storeNiche)
                : Promise.resolve(null),
              askClaudeJsonWithBrain<{
                title?: string;
                description?: string;
                tags?: string[];
                seoTitle?: string;
                seoDescription?: string;
                suggestedPrice?: number;
                suggestedCompareAtPrice?: number;
                productType?: string;
              }>(
                parseInt(projectId),
                `Genera contenido PROFESIONAL COMPLETO optimizado para un nuevo producto Shopify.
Título base: "${title}"
Tipo de producto: ${params?.productType || "DETECTA el tipo de producto a partir del título (ej: 'taza', 'camiseta', 'poster', 'accesorio', etc.)"}
Nicho: ${storeNiche}
Tono de marca: ${project.brandTone || "profesional"}
Plan de suscripción: ${plan} (adapta la profundidad del contenido)
Precio proporcionado: ${params?.price || "NO proporcionado — investiga y sugiere un precio competitivo REAL del mercado"}

INSTRUCCIONES (contenido PREMIUM de agencia profesional):
1. Mejora el título para SEO (mantén la esencia pero hazlo irresistible, incluye keywords del nicho)
2. Genera una descripción HTML profesional de AL MENOS 400 palabras con:
   - Headline emotivo con H2
   - Párrafo de apertura con storytelling emocional que conecte con el buyer persona
   - Sección de características con bullet points (✅) — mínimo 6 beneficios
   - Especificaciones técnicas en tabla HTML si aplica (materiales, dimensiones, peso, etc.)
   - Sección "¿Para quién es?" con casos de uso
   - Sección de garantía/confianza
   - Párrafo de cierre con CTA persuasivo y urgencia sutil
   - Usa clases CSS inline para darle estilo profesional
3. Genera 20+ tags SEO relevantes (incluye long-tail keywords, variaciones, sinónimos)
4. Meta title SEO (max 60 chars, incluye keyword principal + beneficio)
5. Meta description SEO (max 155 chars, incluye CTA y keywords)
6. Si NO hay precio, sugiere precio competitivo basado en el mercado real
7. Detecta automáticamente el tipo de producto si no se proporcionó

Responde SOLO JSON válido:
{"title":"...","description":"<div>HTML completa...</div>","tags":["tag1","tag2",...],"seoTitle":"...","seoDescription":"...","suggestedPrice":XX.XX,"suggestedCompareAtPrice":XX.XX,"productType":"tipo_detectado"}`,
                `Eres un equipo ELITE de copywriting eCommerce Shopify con 15 años de experiencia trabajando para marcas premium. Generas fichas de producto que CONVIERTEN al nivel de agencias que cobran €5.000+/mes. Tu contenido es indistinguible del de una agencia top. Conoces las mejores prácticas de SEO, persuasión, storytelling y CRO (Conversion Rate Optimization). Responde SOLO JSON válido.`,
                "seo",
                storeNiche || undefined,
                4000
              ),
            ]);

            finalTitle = aiContent.title || title;
            finalBody = aiContent.description || finalBody;
            finalTags = Array.isArray(aiContent.tags) ? aiContent.tags.join(", ") : finalTags;
            seoTitle = aiContent.seoTitle || "";
            seoDescription = aiContent.seoDescription || "";

            if (aiContent.productType && !params?.productType) {
              params.productType = aiContent.productType;
            }

            if (!params?.price || params?.price === "0.00") {
              if (priceResearch && priceResearch.suggestedPrice > 0) {
                finalPrice = priceResearch.suggestedPrice.toFixed(2);
                finalCompareAt = priceResearch.suggestedCompareAtPrice > 0
                  ? priceResearch.suggestedCompareAtPrice.toFixed(2)
                  : null;
                pricingInfo = `\n💰 Precio investigado: ${finalPrice}€ (rango mercado: ${priceResearch.marketPriceRange.min}€-${priceResearch.marketPriceRange.max}€, ${priceResearch.competitorPrices.length} competidores analizados)`;
              } else if (aiContent.suggestedPrice && aiContent.suggestedPrice > 0) {
                finalPrice = aiContent.suggestedPrice.toFixed(2);
                if (aiContent.suggestedCompareAtPrice) {
                  finalCompareAt = aiContent.suggestedCompareAtPrice.toFixed(2);
                }
                pricingInfo = `\n💰 Precio sugerido por IA: ${finalPrice}€`;
              }
            }
          } catch { /* use original data */ }
        }

        const { checkProductionLimit: checkProdLimit, recordUsage: recProdUsage } = await import("../lib/plan-limits.js");
        const prodLimitCheck = await checkProdLimit(parseInt(projectId), "product", 1);
        if (!prodLimitCheck.allowed) {
          result = { error: true, message: `❌ Límite de productos alcanzado para tu plan (${prodLimitCheck.planLabel}). Quedan ${prodLimitCheck.remaining.products} productos este mes.` };
          break;
        }

        const shopifyProduct: Record<string, unknown> = {
          title: finalTitle,
          body_html: finalBody,
          tags: finalTags,
          vendor: params?.vendor || undefined,
          product_type: params?.productType || undefined,
          status: params?.status || "draft",
          variants: [{
            title: "Default",
            price: finalPrice,
            compare_at_price: finalCompareAt,
            sku: params?.sku || null,
            requires_shipping: true,
            taxable: true,
          }],
        };

        if (seoTitle) shopifyProduct.metafields_global_title_tag = seoTitle;
        if (seoDescription) shopifyProduct.metafields_global_description_tag = seoDescription;

        const created = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, "/products.json",
          { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
        );

        await recProdUsage(parseInt(projectId), "product", 1);

        const createdProductId = String(created.product.id);
        const createdTitle = String(created.product.title);
        const createdHandle = String(created.product.handle || "");

        saveToVault({
          projectId: parseInt(projectId),
          fileType: "product_card",
          category: "product_creation",
          title: `Producto: ${createdTitle}`,
          description: finalBody ? String(finalBody).replace(/<[^>]*>/g, "").slice(0, 200) : undefined,
          productId: createdProductId,
          productTitle: createdTitle,
          generatedBy: "shopybrain_voice",
          metadata: {
            price: finalPrice,
            status: created.product.status,
            tags: finalTags,
            shopifyId: created.product.id,
            seoTitle,
            seoDescription,
          },
        }).catch(() => {});

        learnFromOperation({
          operationType: "product_creation",
          niche: project.storeNiche,
          productType: params?.productType || null,
          title: `Producto creado: ${createdTitle}`,
          content: JSON.stringify({
            title: createdTitle,
            description: finalBody ? String(finalBody).slice(0, 500) : "",
            tags: finalTags,
            price: finalPrice,
            handle: createdHandle,
            seoTitle,
            seoDescription,
          }),
          confidence: 0.9,
        });

        const imageTypes = IMAGE_TYPES_BY_PLAN[plan] || IMAGE_TYPES_BY_PLAN.starter;
        let imagesGenerated = 0;
        let imagesUploaded = 0;
        const imageErrors: string[] = [];

        if (params?.aiGenerate !== false && params?.skipImages !== true) {
          try {
            const { productsTable: pTable, generationJobsTable: gjTable } = await import("@workspace/db");
            const { buildImagePrompt: buildPrompt, runImageGeneration: runGeneration, MODEL_MAP: modelMap, COST_MAP: costMap, NEGATIVE_PROMPT: negPrompt, uploadGeneratedImageToShopify: uploadImg } = await import("./images.js");
            

            await db.insert(pTable).values({
              projectId: parseInt(projectId),
              shopifyProductId: createdProductId,
              title: createdTitle,
              handle: createdHandle,
              bodyHtml: finalBody || null,
              vendor: params?.vendor || null,
              productType: params?.productType || null,
              status: (params?.status || "draft") as "active" | "draft" | "archived",
              tags: finalTags || null,
              price: finalPrice,
              compareAtPrice: finalCompareAt,
              imageCount: 0,
              variantCount: 1,
            }).onConflictDoNothing().catch(() => {});

            const limitCheck = await checkProdLimit(parseInt(projectId), "image", imageTypes.length);
            const allowedCount = limitCheck.allowed ? imageTypes.length : Math.max(0, limitCheck.remaining?.images ?? 0);

            if (allowedCount > 0) {
              const typesToGenerate = imageTypes.slice(0, allowedCount);

              let imagePosition = 0;
              const generateAndUpload = async (imageType: string): Promise<void> => {
                const position = ++imagePosition;
                try {
                  const model = modelMap[imageType] ?? modelMap.hero;
                  const estimatedCost = costMap[model] ?? 0.04;
                  const prompt = await buildPrompt(
                    parseInt(projectId), createdTitle, params?.productType || null,
                    imageType, storeNiche, project.brandTone
                  );

                  const [job] = await db.insert(gjTable).values({
                    projectId: parseInt(projectId),
                    shopifyProductId: createdProductId,
                    imageType,
                    status: "pending",
                    prompt,
                    negativePrompt: negPrompt,
                    model,
                    estimatedCost,
                  }).returning();

                  const genResult = await runGeneration({
                    job: { id: job.id },
                    projectId: parseInt(projectId),
                    shopifyProductId: createdProductId,
                    imageType,
                    finalPrompt: prompt,
                    model,
                    estimatedCost,
                    product: { title: createdTitle, productType: params?.productType || null },
                    project: { storeNiche: project.storeNiche, brandTone: project.brandTone, replicateApiToken: project.replicateApiToken },
                  });

                  if (genResult.success && genResult.imageUrl) {
                    imagesGenerated++;
                    await recProdUsage(parseInt(projectId), "image", 1);

                    const [updatedJob] = await db.select().from(gjTable).where(eq(gjTable.id, job.id));
                    const uploadResult = await uploadImg({
                      projectId: parseInt(projectId),
                      shopDomain: project.shopDomain,
                      shopifyProductId: createdProductId,
                      jobId: job.id,
                      imageUrl: genResult.imageUrl,
                      altText: updatedJob?.altText || `${createdTitle} - ${imageType}`,
                      imageType,
                      position,
                    });
                    if (uploadResult.success) imagesUploaded++;
                    else imageErrors.push(`${imageType}: upload failed`);
                  } else {
                    imageErrors.push(`${imageType}: ${genResult.error || "generation failed"}`);
                  }
                } catch (e: unknown) {
                  imageErrors.push(`${imageType}: ${e instanceof Error ? e.message : "error"}`);
                }
              };

              const heroType = typesToGenerate.find(t => t === "hero");
              const otherTypes = typesToGenerate.filter(t => t !== "hero");

              if (heroType) {
                await generateAndUpload(heroType);
              }

              if (otherTypes.length > 0) {
                const batchSize = 2;
                for (let i = 0; i < otherTypes.length; i += batchSize) {
                  const batch = otherTypes.slice(i, i + batchSize);
                  await Promise.allSettled(batch.map(t => generateAndUpload(t)));
                }
              }
            }
          } catch (imgErr: unknown) {
            logger.error({ err: imgErr }, "Error en generación de imágenes para producto nuevo");
          }
        }

        let imagesSummary = "";
        if (imagesGenerated > 0) {
          imagesSummary = `\n📸 ${imagesGenerated} imagen(es) generada(s) con IA`;
          if (imagesUploaded > 0) imagesSummary += `, ${imagesUploaded} subida(s) a Shopify`;
          if (imageErrors.length > 0) imagesSummary += ` (⚠️ ${imageErrors.length} con error: ${imageErrors.join(", ")})`;
        } else if (imageErrors.length > 0) {
          imagesSummary = `\n⚠️ Imágenes: ${imageErrors.length} error(es) — ${imageErrors.join(", ")}`;
        } else if (params?.skipImages === true) {
          imagesSummary = `\n📸 Imágenes omitidas (skipImages=true)`;
        } else if (params?.aiGenerate === false) {
          imagesSummary = "";
        } else {
          imagesSummary = `\n📸 Generación de imágenes no disponible (verifica Replicate API token)`;
        }

        let seoSummary = "";
        if (seoTitle || seoDescription) {
          seoSummary = `\n🔍 SEO: meta title y description configurados`;
        }

        result = {
          productId: created.product.id,
          title: createdTitle,
          status: created.product.status,
          handle: createdHandle,
          price: finalPrice,
          compareAtPrice: finalCompareAt,
          seoTitle,
          seoDescription,
          imagesGenerated,
          imagesUploaded,
          imageTypes: (IMAGE_TYPES_BY_PLAN[plan] || []).slice(0, imagesGenerated),
          message: `✅ Producto "${createdTitle}" creado COMPLETO en Shopify (ID: ${created.product.id})

📝 Contenido: Título SEO optimizado + descripción profesional (400+ palabras)
🏷️ Tags: ${finalTags ? finalTags.split(",").length : 0} tags SEO generados
${pricingInfo || `💰 Precio: ${finalPrice}€`}${finalCompareAt ? ` (antes: ${finalCompareAt}€)` : ""}${seoSummary}${imagesSummary}
📦 Estado: ${created.product.status}
🔗 Handle: ${createdHandle}

Plan activo: ${plan} → ${(IMAGE_TYPES_BY_PLAN[plan] || []).length} tipos de imagen disponibles`,
        };
        break;
      }

      case "edit_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const updates: Record<string, unknown> = { id: parseInt(productId) };
        if (params?.title) updates.title = params.title;
        if (params?.bodyHtml) updates.body_html = params.bodyHtml;
        if (params?.tags) updates.tags = params.tags;
        if (params?.status) updates.status = params.status;
        if (params?.vendor) updates.vendor = params.vendor;
        if (params?.productType) updates.product_type = params.productType;

        if (Object.keys(updates).length <= 1) {
          res.status(400).json({ error: "Se requiere al menos un campo a actualizar (title, bodyHtml, tags, status, price, vendor, productType)" });
          return;
        }

        if (params?.price) {
          const current = await shopifyRequest<{ product: { variants: Array<{ id: number }> } }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=variants`
          );
          const varId = params.variantId || current.product.variants?.[0]?.id;
          if (varId) {
            updates.variants = [{ id: varId, price: params.price }];
          }
        }

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: updates }) }
        );

        result = {
          productId: updated.product.id,
          title: updated.product.title,
          message: `Producto "${updated.product.title}" actualizado en Shopify`,
        };
        break;
      }

      case "change_price": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        const newPrice = params?.price;
        if (!projectId || !productId || !newPrice) { res.status(400).json({ error: "projectId, productId y price requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const current = await shopifyRequest<{ product: { variants: Array<{ id: number; price: string }> } }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,variants`
        );
        const variantId = current.product.variants?.[0]?.id;
        if (!variantId) { res.status(404).json({ error: "No se encontró variante" }); return; }

        await shopifyRequest(
          parseInt(projectId), project.shopDomain, `/variants/${variantId}.json`,
          { method: "PUT", body: JSON.stringify({ variant: { id: variantId, price: String(newPrice), compare_at_price: params?.compareAtPrice || null } }) }
        );

        result = {
          productId,
          oldPrice: current.product.variants[0].price,
          newPrice: String(newPrice),
          message: `Precio actualizado: ${current.product.variants[0].price}€ → ${newPrice}€`,
        };
        break;
      }

      case "regenerate_token": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
        const newToken = await refreshToken(parseInt(projectId), project.shopDomain, project.clientId, plainSecret);
        const [updated] = await db.select({ tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));

        result = {
          success: true,
          tokenValid: !!newToken,
          expiresAt: updated?.tokenExpiresAt,
          hoursRemaining: updated?.tokenExpiresAt ? Math.round((new Date(updated.tokenExpiresAt).getTime() - Date.now()) / 3600000 * 10) / 10 : 0,
          message: `Token regenerado exitosamente. Válido por ${updated?.tokenExpiresAt ? Math.round((new Date(updated.tokenExpiresAt).getTime() - Date.now()) / 3600000) : 24} horas.`,
        };
        break;
      }

      case "get_scopes": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        try {
          const headers = await getShopifyHeaders(parseInt(projectId));
          const domain = normalizeShopDomain(project.shopDomain);
          const scopesRes = await fetch(`https://${domain}/admin/oauth/access_scopes.json`, { headers });
          if (!scopesRes.ok) throw new Error(`Scopes request failed: ${scopesRes.status}`);
          const scopesData = await scopesRes.json() as { access_scopes: Array<{ handle: string }> };
          const scopes = scopesData.access_scopes?.map(s => s.handle) ?? [];
          result = {
            scopes,
            total: scopes.length,
            hasWriteProducts: scopes.includes("write_products"),
            hasWriteInventory: scopes.includes("write_inventory"),
            hasWriteContent: scopes.includes("write_content"),
            hasReadOrders: scopes.includes("read_orders"),
            message: `${scopes.length} scopes activos: ${scopes.join(", ")}`,
          };
        } catch (e) {
          result = {
            scopes: ["read_products", "write_products", "read_orders", "read_customers", "read_analytics", "read_inventory", "write_inventory", "read_price_rules", "write_price_rules", "read_content", "write_content", "read_themes"],
            total: 12,
            message: "Scopes configurados en OAuth (no se pudo verificar en vivo): read/write_products, orders, customers, analytics, inventory, price_rules, content, themes",
            note: "Error consultando scopes en vivo, mostrando scopes configurados",
          };
        }
        break;
      }

      case "delete_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        if (!params?.confirmed) {
          res.json({ success: false, requiresConfirmation: true, action: "delete_product", productId, message: "⚠️ ¿Estás seguro de eliminar este producto? Envía la orden de nuevo para confirmar." });
          return;
        }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        await shopifyRequest(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "DELETE" }
        );

        result = { productId, message: `Producto ${productId} eliminado de Shopify` };
        break;
      }

      case "search_product": {
        const projectId = params?.projectId;
        const query = params?.query;
        if (!projectId || !query) { res.status(400).json({ error: "projectId y query requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, `/products.json?title=${encodeURIComponent(query)}&limit=10&fields=id,title,status,variants,images`
        );

        result = {
          products: data.products.map((p: Record<string, unknown>) => ({
            id: p.id, title: p.title, status: p.status,
            price: (p.variants as Array<Record<string, string>>)?.[0]?.price,
            imageCount: (p.images as unknown[])?.length ?? 0,
          })),
          total: data.products.length,
          message: `${data.products.length} productos encontrados para "${query}"`,
        };
        break;
      }

      case "publish_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: { id: productId, status: "active" } }) }
        );

        result = { productId, title: updated.product.title, status: "active", message: `Producto "${updated.product.title}" publicado (active)` };
        break;
      }

      case "get_orders": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const limit = Math.min(params?.limit ?? 10, 50);
        const data = await shopifyRequest<{ orders: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, `/orders.json?limit=${limit}&status=any&fields=id,name,total_price,financial_status,fulfillment_status,created_at,customer`
        );

        result = {
          orders: data.orders.map((o: Record<string, unknown>) => ({
            id: o.id, name: o.name, total: o.total_price,
            financial: o.financial_status, fulfillment: o.fulfillment_status,
            date: o.created_at,
            customer: (o.customer as Record<string, string>)?.first_name ? `${(o.customer as Record<string, string>).first_name} ${(o.customer as Record<string, string>).last_name}` : "Anónimo",
          })),
          total: data.orders.length,
          message: `${data.orders.length} pedidos recientes`,
        };
        break;
      }

      case "scan_store": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const statusFilter = params?.statusFilter || "any";
        const storeUrlScan = project.shopDomain
          ? (project.shopDomain.includes("://") ? project.shopDomain : `https://${project.shopDomain}`)
          : "";

        const [syncRes, psRes] = await Promise.allSettled([
          fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync?statusFilter=${statusFilter}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
            body: JSON.stringify({ statusFilter }),
          }),
          (async () => {
            if (!storeUrlScan) return null;
            const { runDualPageSpeed } = await import("../lib/pagespeed.js");
            return runDualPageSpeed(storeUrlScan);
          })(),
        ]);

        if (syncRes.status === "rejected" || (syncRes.status === "fulfilled" && !syncRes.value.ok)) {
          const errText = syncRes.status === "fulfilled" ? await syncRes.value.text() : String(syncRes.reason);
          res.status(500).json({ error: `Error escaneando: ${errText}` });
          return;
        }

        const syncData = await syncRes.value.json() as Record<string, unknown>;
        const psData = psRes.status === "fulfilled" ? psRes.value : null;

        let psMessage = "";
        if (psData?.mobile || psData?.desktop) {
          const m = psData.mobile;
          const d = psData.desktop;
          psMessage = `\n\n📊 PageSpeed Insights:`;
          if (m) psMessage += `\n📱 Móvil: Rendimiento ${m.performanceScore}/100, SEO ${m.seoScore}/100, Accesibilidad ${m.accessibilityScore}/100`;
          if (d) psMessage += `\n🖥️ Escritorio: Rendimiento ${d.performanceScore}/100, SEO ${d.seoScore}/100, Accesibilidad ${d.accessibilityScore}/100`;
          const allIssues = [...(m?.issues ?? []), ...(d?.issues ?? [])];
          if (allIssues.length > 0) psMessage += `\n⚠️ Problemas: ${allIssues.slice(0, 3).join("; ")}`;
        }

        result = {
          ...syncData,
          statusFilter,
          pageSpeed: psData ? { mobile: psData.mobile, desktop: psData.desktop } : null,
          message: `Escaneo completado (filtro: ${statusFilter}). ${syncData.total ?? 0} productos analizados. Nota media: ${typeof syncData.avgScore === "number" ? syncData.avgScore.toFixed(0) : "N/A"}/100${psMessage}`,
        };
        break;
      }

      case "set_product_status": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        const newStatus = params?.status;
        if (!projectId || !productId || !newStatus) { res.status(400).json({ error: "projectId, productId y status (active/draft/archived) requeridos" }); return; }
        if (!["active", "draft", "archived"].includes(newStatus)) { res.status(400).json({ error: "status debe ser: active, draft o archived" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: { id: parseInt(productId), status: newStatus } }) }
        );

        result = {
          productId, title: updated.product.title, status: newStatus,
          message: `Producto "${updated.product.title}" cambiado a estado: ${newStatus}`,
        };
        break;
      }

      case "list_all_products": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const limit = Math.min(params?.limit ?? 20, 50);
        const statusFilter = params?.statusFilter || "any";
        const statusesToQuery = statusFilter === "any"
          ? ["active", "draft", "archived"]
          : [statusFilter];

        let allProds: Array<Record<string, unknown>> = [];
        for (const st of statusesToQuery) {
          const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${st}&published_status=any&fields=id,title,status,published_at,variants,images,tags`
          );
          allProds = allProds.concat(d.products || []);
        }
        if (allProds.length > limit) allProds = allProds.slice(0, limit);

        const byStatus: Record<string, number> = {};
        allProds.forEach((p: Record<string, unknown>) => {
          const s = String(p.status || "unknown");
          byStatus[s] = (byStatus[s] || 0) + 1;
        });

        const published = allProds.filter(p => !!p.published_at).length;
        const unpublished = allProds.length - published;

        result = {
          products: allProds.map((p: Record<string, unknown>) => ({
            id: p.id, title: p.title, status: p.status,
            published: !!p.published_at,
            price: (p.variants as Array<Record<string, string>>)?.[0]?.price ?? "0.00",
            imageCount: (p.images as unknown[])?.length ?? 0,
            tags: p.tags,
          })),
          total: allProds.length,
          byStatus,
          published,
          unpublished,
          statusFilter,
          message: `${allProds.length} productos (filtro: ${statusFilter}). Desglose: ${Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(", ")}. Publicados: ${published}, No publicados: ${unpublished}`,
        };
        break;
      }

      case "search_suppliers": {
        const pName = params?.productName;
        if (!pName) { res.status(400).json({ error: "productName requerido" }); return; }

        const supRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/shopybrain/supplier-research`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
          body: JSON.stringify({
            productName: pName,
            productCategory: params?.productCategory,
            materials: params?.materials,
            targetMarket: params?.targetMarket,
            qualityTier: params?.qualityTier,
            budget: params?.budget,
            country: params?.country,
          }),
        });

        if (!supRes.ok) {
          const errText = await supRes.text();
          res.status(500).json({ error: `Error buscando proveedores: ${errText}` });
          return;
        }

        const supData = await supRes.json() as Record<string, unknown>;
        const suppliersList = ((supData.suppliers as Record<string, unknown>)?.suppliers as Array<{ name: string; priceRange: string; country: string; platform: string }>) || [];
        const synth = supData.synthesis as Record<string, unknown> || {};
        const topRec = synth.topRecommendation as Record<string, string> || {};

        result = {
          productName: pName,
          suppliersFound: suppliersList.length,
          topRecommendation: topRec.supplier ? `${topRec.supplier} — ${topRec.reason || ""}` : "Sin recomendación",
          topSuppliers: suppliersList.slice(0, 5).map(s => `${s.name} (${s.country}) — ${s.priceRange} [${s.platform}]`),
          strategy: synth.strategy || "N/A",
          risks: synth.risks || [],
          nextSteps: synth.nextSteps || [],
          costBreakdown: synth.costBreakdown || {},
          sourcesAnalyzed: supData.sourcesAnalyzed,
          memoryId: supData.memoryId,
          fullData: supData,
          message: `Investigación de proveedores completada: ${suppliersList.length} proveedores encontrados para "${pName}"`,
        };
        break;
      }

      case "modify_audit_filter": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const statusFilter = params?.statusFilter || "any";
        const validFilters = ["any", "active", "draft", "archived"];
        if (!validFilters.includes(statusFilter)) {
          res.status(400).json({ error: `statusFilter debe ser: ${validFilters.join(", ")}` });
          return;
        }

        const autoScan = params?.autoScan !== false;
        let scanResult: Record<string, unknown> = {};

        if (autoScan) {
          const syncRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
            body: JSON.stringify({ statusFilter }),
          });
          if (syncRes.ok) {
            scanResult = await syncRes.json() as Record<string, unknown>;
          }
        }

        const filterLabels: Record<string, string> = {
          any: "TODOS (activos + borradores + archivados)",
          active: "Solo productos ACTIVOS (publicados)",
          draft: "Solo productos en BORRADOR",
          archived: "Solo productos ARCHIVADOS",
        };

        result = {
          filterApplied: statusFilter,
          filterDescription: filterLabels[statusFilter] || statusFilter,
          autoScanExecuted: autoScan,
          ...(autoScan ? scanResult : {}),
          message: `Filtro de auditoría cambiado a: ${filterLabels[statusFilter]}. ${autoScan ? `Se re-escanearon ${scanResult.synced ?? 0} productos con el nuevo filtro. Score medio: ${typeof scanResult.avgScore === "number" ? Math.round(scanResult.avgScore) : "N/A"}/100.` : "No se ejecutó escaneo automático."}`,
        };
        break;
      }

      case "diagnose_app": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const checksParam = params?.checks || "all";
        const issues: Array<{ component: string; status: "ok" | "warning" | "error"; detail: string; autoFixed?: boolean }> = [];
        let fixesApplied = 0;

        const runCheck = (name: string) => checksParam === "all" || checksParam === name;

        if (runCheck("token")) {
          try {
            const { validateToken: vt } = await import("../lib/shopify.js");
            const tokenValid = project.accessToken ? await vt(project.shopDomain, project.accessToken) : false;

            if (!project.accessToken) {
              issues.push({ component: "Token Shopify", status: "error", detail: "No hay token de acceso configurado. Necesitas reconectar la tienda." });
            } else if (!tokenValid) {
              const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
              try {
                await refreshToken(parseInt(projectId), project.shopDomain, project.clientId, plainSecret);
                issues.push({ component: "Token Shopify", status: "warning", detail: "Token estaba expirado — se ha regenerado automáticamente.", autoFixed: true });
                fixesApplied++;
              } catch {
                issues.push({ component: "Token Shopify", status: "error", detail: "Token expirado y no se pudo regenerar. Verifica clientId/clientSecret." });
              }
            } else {
              const hoursLeft = project.tokenExpiresAt ? Math.round((new Date(project.tokenExpiresAt).getTime() - Date.now()) / 3600000 * 10) / 10 : "desconocido";
              issues.push({ component: "Token Shopify", status: "ok", detail: `Token válido. Expira en ${hoursLeft} horas.` });
            }
          } catch (e) {
            issues.push({ component: "Token Shopify", status: "error", detail: `Error verificando token: ${e instanceof Error ? e.message : String(e)}` });
          }
        }

        if (runCheck("connectivity")) {
          try {
            const headers = await getShopifyHeaders(parseInt(projectId));
            const domain = normalizeShopDomain(project.shopDomain);
            const shopRes = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
              headers,
              signal: AbortSignal.timeout(10000),
            });
            if (shopRes.ok) {
              const shopData = await shopRes.json() as { shop: { name: string; plan_name: string; domain: string } };
              issues.push({ component: "Conexión Shopify", status: "ok", detail: `Conectado a "${shopData.shop?.name}" (plan: ${shopData.shop?.plan_name}, dominio: ${shopData.shop?.domain})` });
            } else {
              issues.push({ component: "Conexión Shopify", status: "error", detail: `Shopify devolvió error ${shopRes.status}. Posible problema de permisos o token.` });
            }
          } catch (e) {
            issues.push({ component: "Conexión Shopify", status: "error", detail: `No se pudo conectar con Shopify: ${e instanceof Error ? e.message : "timeout"}` });
          }
        }

        if (runCheck("products")) {
          try {
            const { productsTable } = await import("@workspace/db");
            const productRows = await db.select({
              total: sql<number>`count(*)`,
              avgScore: sql<number>`avg(${productsTable.auditScore})`,
              withoutScore: sql<number>`count(*) filter (where ${productsTable.auditScore} is null)`,
              active: sql<number>`count(*) filter (where ${productsTable.status} = 'active')`,
              draft: sql<number>`count(*) filter (where ${productsTable.status} = 'draft')`,
              archived: sql<number>`count(*) filter (where ${productsTable.status} = 'archived')`,
            }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));

            const stats = productRows[0];
            if (!stats || Number(stats.total) === 0) {
              issues.push({ component: "Productos en BD", status: "warning", detail: "No hay productos sincronizados. Ejecuta un escaneo de tienda para importarlos." });
            } else {
              issues.push({
                component: "Productos en BD",
                status: "ok",
                detail: `${stats.total} productos en BD (activos: ${stats.active}, borradores: ${stats.draft}, archivados: ${stats.archived}). Score medio: ${stats.avgScore ? Math.round(Number(stats.avgScore)) : "N/A"}/100. Sin score: ${stats.withoutScore}.`,
              });
            }

            if (stats && Number(stats.withoutScore) > 0) {
              issues.push({ component: "Auditoría pendiente", status: "warning", detail: `${stats.withoutScore} productos sin auditar. Re-escanea la tienda para calcular sus scores.` });
            }
          } catch (e) {
            issues.push({ component: "Productos en BD", status: "error", detail: `Error consultando productos: ${e instanceof Error ? e.message : String(e)}` });
          }
        }

        if (runCheck("sync")) {
          try {
            const headers = await getShopifyHeaders(parseInt(projectId));
            const domain = normalizeShopDomain(project.shopDomain);
            const countRes = await fetch(`https://${domain}/admin/api/2025-01/products/count.json`, {
              headers,
              signal: AbortSignal.timeout(10000),
            });
            if (countRes.ok) {
              const countData = await countRes.json() as { count: number };
              const shopifyCount = countData.count;
              const localCount = project.productCount || 0;
              const diff = Math.abs(shopifyCount - localCount);

              if (diff > 0) {
                const syncRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
                  body: JSON.stringify({ statusFilter: "any" }),
                });
                if (syncRes.ok) {
                  const syncData = await syncRes.json() as Record<string, unknown>;
                  issues.push({
                    component: "Sincronización",
                    status: "warning",
                    detail: `Había ${diff} productos desincronizados (Shopify: ${shopifyCount}, BD local: ${localCount}). Se re-sincronizaron ${syncData.synced} productos automáticamente.`,
                    autoFixed: true,
                  });
                  fixesApplied++;
                } else {
                  issues.push({ component: "Sincronización", status: "error", detail: `${diff} productos desincronizados. El re-escaneo automático falló.` });
                }
              } else {
                issues.push({ component: "Sincronización", status: "ok", detail: `BD sincronizada con Shopify (${shopifyCount} productos en ambos).` });
              }
            }
          } catch (e) {
            issues.push({ component: "Sincronización", status: "warning", detail: `No se pudo verificar sincronización: ${e instanceof Error ? e.message : String(e)}` });
          }
        }

        const errors = issues.filter(i => i.status === "error").length;
        const warnings = issues.filter(i => i.status === "warning").length;
        const oks = issues.filter(i => i.status === "ok").length;

        const statusEmoji = errors > 0 ? "🔴" : warnings > 0 ? "🟡" : "🟢";
        const overallStatus = errors > 0 ? "PROBLEMAS DETECTADOS" : warnings > 0 ? "ADVERTENCIAS" : "TODO OK";

        result = {
          overallStatus,
          issues,
          summary: { errors, warnings, ok: oks, fixesApplied },
          message: `${statusEmoji} Diagnóstico: ${overallStatus}. ${errors} errores, ${warnings} advertencias, ${oks} ok. ${fixesApplied > 0 ? `Se aplicaron ${fixesApplied} reparaciones automáticas.` : ""}
${issues.map(i => `  ${i.status === "ok" ? "✅" : i.status === "warning" ? "⚠️" : "❌"} ${i.component}: ${i.detail}${i.autoFixed ? " [AUTO-REPARADO]" : ""}`).join("\n")}`,
        };
        break;
      }

      case "list_source_files": {
        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const FRONTEND_ROOT = path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer");
        const BACKEND_ROOT = path.resolve(WORKSPACE_ROOT, "artifacts/api-server");

        const directory = params?.directory || "";
        const pattern = params?.pattern || "";

        const listDir = (root: string, dir: string, prefix: string): string[] => {
          const results: string[] = [];
          const fullPath = path.join(root, dir);
          if (!fs.existsSync(fullPath)) return results;
          try {
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
              const relPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                results.push(`📁 ${prefix}${relPath}/`);
                if (relPath.split("/").length < 4) {
                  results.push(...listDir(root, relPath, prefix));
                }
              } else if (!pattern || entry.name.endsWith(pattern)) {
                const stat = fs.statSync(path.join(root, relPath));
                const sizeKb = Math.round(stat.size / 1024);
                results.push(`📄 ${prefix}${relPath} (${sizeKb}KB)`);
              }
            }
          } catch { /* ignore */ }
          return results;
        };

        const frontendDir = directory ? (directory.startsWith("src") ? directory : `src/${directory}`.replace(/\/+/g, "/").replace(/\/$/, "")) : "src";
        const frontendFiles = listDir(FRONTEND_ROOT, frontendDir, "[frontend] ");
        const backendDir = directory ? (directory.startsWith("src") ? directory : `src/${directory}`.replace(/\/+/g, "/").replace(/\/$/, "")) : "src";
        const backendFiles = listDir(BACKEND_ROOT, backendDir, "[backend] ");

        result = {
          frontend: frontendFiles.slice(0, 60),
          backend: backendFiles.slice(0, 60),
          totalFrontend: frontendFiles.length,
          totalBackend: backendFiles.length,
          message: `📂 Estructura del código:\n\n**Frontend (${frontendFiles.length} items):**\n${frontendFiles.slice(0, 30).join("\n")}\n\n**Backend (${backendFiles.length} items):**\n${backendFiles.slice(0, 30).join("\n")}`,
        };
        break;
      }

      case "inspect_code": {
        const filePath = params?.filePath;
        if (!filePath) { res.status(400).json({ error: "filePath requerido (ej: src/pages/projects/Audit.tsx)" }); return; }
        if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }

        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const candidates = [
          path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer", filePath),
          path.resolve(WORKSPACE_ROOT, "artifacts/api-server", filePath),
          path.resolve(WORKSPACE_ROOT, filePath),
        ].filter(c => c.startsWith(WORKSPACE_ROOT));

        let resolvedPath = "";
        let fileContent = "";
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            resolvedPath = c;
            fileContent = fs.readFileSync(c, "utf-8");
            break;
          }
        }

        if (!fileContent) {
          res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
          return;
        }

        const lines = fileContent.split("\n").length;
        const truncated = fileContent.length > 15000 ? fileContent.slice(0, 15000) + "\n\n// ... [truncado, archivo demasiado largo]" : fileContent;
        let analysis = "";

        if (params?.analyze !== false) {
          try {
            const analyzeMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 2000,
              messages: [{
                role: "user",
                content: `Analiza este archivo de código fuente de una app Shopify (React+TypeScript frontend, Express+Node backend).
Identifica: bugs, errores lógicos, problemas de UX, funciones rotas, imports faltantes, handlers sin error handling, y cualquier otro problema.
Responde en español, sé concreto y directo. Para cada problema indica la línea aproximada y el fix sugerido.

Archivo: ${filePath}
\`\`\`
${truncated}
\`\`\``,
              }],
            });
            analysis = (analyzeMsg.content[0] as { text: string }).text;
          } catch {
            analysis = "No se pudo ejecutar el análisis con IA.";
          }
        }

        result = {
          filePath,
          resolvedPath: resolvedPath.replace(WORKSPACE_ROOT, ""),
          lines,
          sizeBytes: fileContent.length,
          content: truncated,
          analysis: analysis || undefined,
          message: `📄 **${filePath}** (${lines} líneas, ${Math.round(fileContent.length / 1024)}KB)\n\n${analysis ? `🔍 **Análisis:**\n${analysis}` : "Contenido leído correctamente."}`,
        };
        break;
      }

      case "analyze_component": {
        const filePath = params?.filePath;
        if (!filePath) { res.status(400).json({ error: "filePath requerido" }); return; }
        if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }
        const focusOn = params?.focusOn || "all";

        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const candidates = [
          path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer", filePath),
          path.resolve(WORKSPACE_ROOT, "artifacts/api-server", filePath),
          path.resolve(WORKSPACE_ROOT, filePath),
        ].filter(c => c.startsWith(WORKSPACE_ROOT));

        let fileContent = "";
        for (const c of candidates) {
          if (fs.existsSync(c)) { fileContent = fs.readFileSync(c, "utf-8"); break; }
        }

        if (!fileContent) {
          res.status(404).json({ error: `Archivo no encontrado: ${filePath}` });
          return;
        }

        const truncated = fileContent.length > 18000 ? fileContent.slice(0, 18000) + "\n// ... [truncado]" : fileContent;

        const focusPrompts: Record<string, string> = {
          bugs: "Busca SOLO bugs, errores de runtime, null pointer exceptions, funciones que fallan, imports rotos, variables undefined.",
          ux: "Busca SOLO problemas de UX: botones que no funcionan, feedback faltante al usuario, estados de loading no manejados, errores silenciosos sin mensaje.",
          performance: "Busca SOLO problemas de rendimiento: re-renders innecesarios, llamadas API sin cache, loops ineficientes, memory leaks.",
          logic: "Busca SOLO errores de lógica de negocio: cálculos incorrectos, condiciones mal escritas, estados inconsistentes, race conditions.",
          all: "Haz un análisis COMPLETO: bugs, errores lógicos, UX, rendimiento, seguridad. Prioriza por severidad (crítico > alto > medio > bajo).",
        };

        try {
          const analyzeMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `Eres un senior developer auditando código de producción de una app Shopify (React+Vite frontend, Express+Node backend, PostgreSQL, Drizzle ORM).

ENFOQUE: ${focusPrompts[focusOn] || focusPrompts.all}

Para CADA problema encontrado, responde con este formato exacto:
🔴 CRÍTICO / 🟡 ALTO / 🟢 MEDIO / ⚪ BAJO
**Línea ~N**: Descripción del problema
**Fix**: Código exacto para corregirlo (old → new)

Si no encuentras problemas, di "✅ Sin problemas detectados".
Responde en español.

Archivo: ${filePath}
\`\`\`typescript
${truncated}
\`\`\``,
            }],
          });

          const analysisText = (analyzeMsg.content[0] as { text: string }).text;

          const criticalCount = (analysisText.match(/🔴/g) || []).length;
          const highCount = (analysisText.match(/🟡/g) || []).length;
          const mediumCount = (analysisText.match(/🟢/g) || []).length;
          const lowCount = (analysisText.match(/⚪/g) || []).length;
          const totalIssues = criticalCount + highCount + mediumCount + lowCount;

          result = {
            filePath,
            focusOn,
            analysis: analysisText,
            issueCount: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount, total: totalIssues },
            message: `🔍 **Análisis de ${filePath}** (enfoque: ${focusOn})\n📊 ${totalIssues} problemas: ${criticalCount} críticos, ${highCount} altos, ${mediumCount} medios, ${lowCount} bajos\n\n${analysisText}`,
          };
        } catch (e) {
          result = { error: true, message: `Error analizando: ${e instanceof Error ? e.message : String(e)}` };
        }
        break;
      }

      case "fix_code": {
        const filePath = params?.filePath;
        const oldCode = params?.oldCode;
        const newCode = params?.newCode;
        const description = params?.description || "Fix aplicado por ShopyBrain";

        if (!filePath || !oldCode || newCode === undefined) {
          res.status(400).json({ error: "filePath, oldCode y newCode son requeridos" });
          return;
        }
        if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }

        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const candidates = [
          path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer", filePath),
          path.resolve(WORKSPACE_ROOT, "artifacts/api-server", filePath),
          path.resolve(WORKSPACE_ROOT, filePath),
        ].filter(c => c.startsWith(WORKSPACE_ROOT));

        let resolvedPath = "";
        let fileContent = "";
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            resolvedPath = c;
            fileContent = fs.readFileSync(c, "utf-8");
            break;
          }
        }

        if (!resolvedPath) {
          res.status(404).json({ error: `Archivo no encontrado: ${filePath}` });
          return;
        }

        if (!fileContent.includes(oldCode)) {
          result = {
            success: false,
            message: `❌ No se encontró el código a reemplazar en ${filePath}. Verifica que el texto es exacto. Usa inspect_code para ver el contenido actual del archivo.`,
          };
          break;
        }

        const backupPath = `${resolvedPath}.bak.${Date.now()}`;
        fs.writeFileSync(backupPath, fileContent, "utf-8");

        const newContent = fileContent.replace(oldCode, newCode);
        fs.writeFileSync(resolvedPath, newContent, "utf-8");

        const changedLines = newCode.split("\n").length;

        result = {
          success: true,
          filePath,
          resolvedPath: resolvedPath.replace(WORKSPACE_ROOT, ""),
          description,
          linesChanged: changedLines,
          backupCreated: backupPath.replace(WORKSPACE_ROOT, ""),
          message: `✅ **Fix aplicado en ${filePath}**\n📝 ${description}\n📊 ${changedLines} líneas modificadas\n💾 Backup creado automáticamente\n\n⚠️ **Nota:** Los cambios se aplican al código fuente. Reinicia el servidor para que tengan efecto.`,
        };
        break;
      }

      case "optimize_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const prodData = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`
        );
        const prod = prodData.product;
        const images = (prod.images as Array<Record<string, unknown>>) || [];
        const variants = (prod.variants as Array<Record<string, unknown>>) || [];
        const currentTags = String(prod.tags || "");
        const currentTitle = String(prod.title || "");
        const currentDesc = String(prod.body_html || "");
        const vendor = String(prod.vendor || "");
        const productType = String(prod.product_type || "");
        const currentPrice = String(variants[0]?.price || "0");
        const currentCompareAt = String(variants[0]?.compare_at_price || "");
        const storeNiche = project.storeNiche || "comics y cultura pop";

        const [priceResearch, _] = await Promise.all([
          researchRealPricing(currentTitle, productType, storeNiche, currentPrice),
          Promise.resolve(null),
        ]);

        const priceContextBlock = priceResearch.competitorPrices.length > 0
          ? `\n\nDATOS REALES DE MERCADO (investigados via Google Search):
Rango de mercado: ${priceResearch.marketPriceRange.min}€ - ${priceResearch.marketPriceRange.max}€ (mediana: ${priceResearch.marketPriceRange.median}€)
Precio actual del producto: ${currentPrice}€
${currentCompareAt ? `Precio de comparación actual: ${currentCompareAt}€` : ""}
Competidores encontrados:
${priceResearch.competitorPrices.slice(0, 8).map(c => `• ${c.source}: ${c.price}€${c.url ? ` (${c.url})` : ""}`).join("\n")}
Fuentes: ${priceResearch.sources.slice(0, 5).join(", ")}
Estrategia sugerida: ${priceResearch.pricingStrategy}`
          : "";

        const optimizePrompt = `Eres el mejor copywriter, experto SEO y estratega de pricing de Shopify del mundo. Optimiza este producto de manera PROFESIONAL y COMPLETA.

PRODUCTO ACTUAL:
- Título: "${currentTitle}"
- Descripción HTML actual: "${currentDesc.slice(0, 500)}"
- Vendor: "${vendor}"
- Tipo: "${productType}"
- Tags actuales: "${currentTags}"
- Precio actual: ${currentPrice}€
${currentCompareAt ? `- Precio de comparación: ${currentCompareAt}€` : ""}
- Imágenes: ${images.length} fotos
- Nicho de la tienda: ${storeNiche}
- Tono de marca: ${project.brandTone || "profesional y apasionado"}
${priceContextBlock}

GENERA UN JSON COMPLETO con TODOS estos campos:
{
  "title": "Título optimizado SEO (40-70 chars, incluye keywords relevantes)",
  "bodyHtml": "Descripción HTML COMPLETA y profesional. Mínimo 400 palabras. Incluye: <h2> subtítulos, <ul><li> bullet points con beneficios, especificaciones técnicas, storytelling emocional sobre el producto, llamada a la acción. Usa <strong> para enfatizar. NO uses placeholder ni lorem ipsum. Contenido REAL basado en el producto.",
  "tags": ["tag1", "tag2", "..."],
  "seoTitle": "Meta title SEO optimizado (50-60 chars con keyword principal)",
  "seoDescription": "Meta description persuasiva (140-160 chars con CTA)",
  "altTexts": ["alt text para imagen 1", "alt text para imagen 2", "..."],
  "handle": "url-handle-optimizado-seo",
  "pricingSuggestion": {
    "suggestedPrice": XX.XX,
    "suggestedCompareAtPrice": XX.XX,
    "reasoning": "Por qué este precio basado en datos reales del mercado",
    "marketPosition": "budget|mid-range|premium|luxury",
    "competitorsAnalyzed": N
  }
}

REGLAS CRÍTICAS:
- TODO el contenido debe ser REAL, específico para este producto exacto
- La descripción debe contar una historia, no solo listar características
- Tags: mínimo 15, cubrir categoría, material, estilo, público, uso, colección, tendencia
- Alt texts deben describir lo que se VE en cada imagen, no genéricos
- PRICING: Usa los datos REALES del mercado para sugerir un precio COMPETITIVO y RENTABLE.
  Si hay datos de competencia, el precio sugerido debe ser estratégicamente posicionado.
  Usa precios psicológicos (.99, .95). Sugiere compare_at_price para percepción de valor.
  Si NO hay datos de mercado, mantén el precio actual o sugiere ajuste basado en el nicho.
- Responde SOLO el JSON, sin texto adicional`;

        const { dualAIJson } = await import("../lib/dual-ai.js");
        const dualResult = await dualAIJson<{
          title: string;
          bodyHtml: string;
          tags: string[];
          seoTitle: string;
          seoDescription: string;
          altTexts?: string[];
          handle?: string;
          pricingSuggestion?: {
            suggestedPrice?: number;
            suggestedCompareAtPrice?: number;
            reasoning?: string;
            marketPosition?: string;
            competitorsAnalyzed?: number;
          };
        }>(parseInt(projectId), optimizePrompt, {
          mode: "parallel_synthesis",
          claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM,
          useCase: "seo",
          niche: project.storeNiche || undefined,
          maxTokens: 8192,
        });
        const optimized = dualResult.data;

        const shopifyUpdate: Record<string, unknown> = { id: parseInt(productId) };
        if (optimized.title) shopifyUpdate.title = optimized.title;
        if (optimized.bodyHtml) shopifyUpdate.body_html = optimized.bodyHtml;
        if (optimized.tags && Array.isArray(optimized.tags)) shopifyUpdate.tags = optimized.tags.join(", ");
        if (optimized.handle) shopifyUpdate.handle = optimized.handle;

        if (optimized.seoTitle) shopifyUpdate.metafields_global_title_tag = optimized.seoTitle;
        if (optimized.seoDescription) shopifyUpdate.metafields_global_description_tag = optimized.seoDescription;

        if (optimized.altTexts && images.length > 0) {
          shopifyUpdate.images = images.map((img, i) => ({
            id: img.id,
            alt: optimized.altTexts?.[i] || String(img.alt || ""),
          }));
        }

        const priceSuggestion = optimized.pricingSuggestion;
        let priceUpdateMsg = "";
        if (priceSuggestion?.suggestedPrice && priceSuggestion.suggestedPrice > 0) {
          const newPrice = priceSuggestion.suggestedPrice.toFixed(2);
          const newCompareAt = priceSuggestion.suggestedCompareAtPrice
            ? priceSuggestion.suggestedCompareAtPrice.toFixed(2)
            : null;

          if (variants.length > 0 && variants[0]?.id) {
            shopifyUpdate.variants = [{
              id: variants[0].id,
              price: newPrice,
              ...(newCompareAt ? { compare_at_price: newCompareAt } : {}),
            }];
            priceUpdateMsg = `\n💰 Precio: ${currentPrice}€ → ${newPrice}€${newCompareAt ? ` (antes ${newCompareAt}€)` : ""}`;
            priceUpdateMsg += `\n📊 ${priceSuggestion.reasoning || "Basado en análisis de mercado"}`;
            priceUpdateMsg += `\n🏪 Posición: ${priceSuggestion.marketPosition || "competitivo"}`;
            if (priceResearch.competitorPrices.length > 0) {
              priceUpdateMsg += ` (${priceResearch.competitorPrices.length} competidores analizados)`;
            }
          }
        }

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: shopifyUpdate }) }
        );

        learnFromOperation({
          operationType: "product_optimization",
          niche: storeNiche,
          productType: productType || null,
          title: `Optimización IA: ${updated.product.title}`,
          content: JSON.stringify({
            previousTitle: currentTitle,
            newTitle: updated.product.title,
            tagsCount: optimized.tags?.length || 0,
            seoTitle: optimized.seoTitle,
            descLength: String(optimized.bodyHtml || "").length,
            priceBefore: currentPrice,
            priceAfter: priceSuggestion?.suggestedPrice || currentPrice,
            marketRange: priceResearch.marketPriceRange,
            competitorsFound: priceResearch.competitorPrices.length,
          }),
          confidence: 0.9,
          tags: ["optimization", "seo", "ai_content", "pricing"],
        });

        result = {
          productId: updated.product.id,
          title: updated.product.title,
          previousTitle: currentTitle,
          tagsCount: optimized.tags?.length || 0,
          descriptionLength: String(optimized.bodyHtml || "").length,
          seoTitle: optimized.seoTitle,
          altTextsGenerated: optimized.altTexts?.length || 0,
          pricingSuggestion: priceSuggestion,
          marketData: {
            priceRange: priceResearch.marketPriceRange,
            competitorsFound: priceResearch.competitorPrices.length,
            sources: priceResearch.sources.slice(0, 5),
          },
          message: `✅ Producto "${updated.product.title}" optimizado profesionalmente.\n📝 Descripción: ${String(optimized.bodyHtml || "").length} chars\n🏷 ${optimized.tags?.length || 0} tags SEO\n🔍 Meta title + description SEO\n🖼 ${optimized.altTexts?.length || 0} alt texts de imágenes${priceUpdateMsg}`,
        };
        break;
      }

      case "optimize_all_products": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        let allProds: Array<Record<string, unknown>> = [];
        for (const st of ["active", "draft", "archived"]) {
          const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, `/products.json?limit=50&status=${st}&published_status=any&fields=id,title,body_html,vendor,product_type,tags,status,variants,images,handle`
          );
          allProds = allProds.concat(d.products || []);
        }

        const optimizeLimit = Math.min(params?.limit ?? 10, 25);
        const toOptimize = allProds.slice(0, optimizeLimit);
        const results: Array<{ id: unknown; title: string; status: string }> = [];
        const errors: string[] = [];

        for (const prod of toOptimize) {
          try {
            const images = (prod.images as Array<Record<string, unknown>>) || [];
            const variants = (prod.variants as Array<Record<string, unknown>>) || [];

            const optimizePrompt = `Optimiza este producto Shopify como experto profesional. Genera contenido REAL y COMPLETO.

PRODUCTO:
- Título: "${prod.title}"
- Descripción: "${String(prod.body_html || "").slice(0, 300)}"
- Vendor: "${prod.vendor || ""}"
- Tipo: "${prod.product_type || ""}"
- Tags: "${prod.tags || ""}"
- Precio: ${variants[0]?.price || "N/A"}€
- Imágenes: ${images.length}
- Nicho: ${project.storeNiche || "general"}

JSON RESPUESTA:
{"title":"título SEO 40-70 chars","bodyHtml":"HTML completa mín 300 palabras con <h2>, <ul><li>, <strong>, storytelling, beneficios, especificaciones, CTA","tags":["15+ tags SEO"],"seoTitle":"meta title 50-60 chars","seoDescription":"meta desc 140-160 chars","altTexts":["alt para cada imagen"],"handle":"url-seo-handle"}

SOLO JSON, contenido REAL para ESTE producto exacto.`;

            const optimized = await askClaudeJsonWithBrain<{
              title: string; bodyHtml: string; tags: string[];
              seoTitle: string; seoDescription: string; altTexts?: string[]; handle?: string;
            }>(parseInt(projectId), optimizePrompt, CLAUDE_EXPERT_SYSTEM, "seo", project.storeNiche || undefined, 6144);

            const shopifyUpdate: Record<string, unknown> = { id: prod.id };
            if (optimized.title) shopifyUpdate.title = optimized.title;
            if (optimized.bodyHtml) shopifyUpdate.body_html = optimized.bodyHtml;
            if (optimized.tags) shopifyUpdate.tags = optimized.tags.join(", ");
            if (optimized.handle) shopifyUpdate.handle = optimized.handle;
            if (optimized.seoTitle) shopifyUpdate.metafields_global_title_tag = optimized.seoTitle;
            if (optimized.seoDescription) shopifyUpdate.metafields_global_description_tag = optimized.seoDescription;
            if (optimized.altTexts && images.length > 0) {
              shopifyUpdate.images = images.map((img, i) => ({
                id: img.id, alt: optimized.altTexts?.[i] || String(img.alt || ""),
              }));
            }

            await shopifyRequest(
              parseInt(projectId), project.shopDomain, `/products/${prod.id}.json`,
              { method: "PUT", body: JSON.stringify({ product: shopifyUpdate }) }
            );

            results.push({ id: prod.id, title: optimized.title || String(prod.title), status: "optimized" });
            logger.info({ productId: prod.id, title: optimized.title }, "Product optimized by AI");
          } catch (e) {
            errors.push(`${prod.title}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        result = {
          optimized: results.length,
          failed: errors.length,
          total: toOptimize.length,
          products: results,
          errors: errors.length > 0 ? errors : undefined,
          message: `✅ Optimización masiva completada: ${results.length}/${toOptimize.length} productos optimizados profesionalmente con IA.\n${errors.length > 0 ? `⚠️ ${errors.length} errores: ${errors[0]}` : ""}`,
        };
        break;
      }

      case "create_collection": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const title = params?.title;
        if (!title) { res.status(400).json({ error: "title requerido para la colección" }); return; }

        const collectionType = params?.type || "custom";
        let bodyHtml = params?.bodyHtml || "";
        let seoTitle = params?.seoTitle || "";
        let seoDescription = params?.seoDescription || "";

        if (params?.aiGenerate !== false) {
          try {
            const aiContent = await askClaudeJsonWithBrain<{
              bodyHtml: string; seoTitle: string; seoDescription: string; sortOrder: string;
            }>(parseInt(projectId), `Genera contenido profesional para una colección Shopify.
Nombre: "${title}"
Nicho: ${project.storeNiche || "general"}
Tono: ${project.brandTone || "profesional"}

JSON: {"bodyHtml":"HTML descriptiva profesional de la colección, mín 150 palabras, con <h2>, <p>, <ul><li> explicando qué encontrará el cliente, storytelling de marca, por qué esta colección es especial","seoTitle":"meta title 50-60 chars","seoDescription":"meta description 140-160 chars con CTA","sortOrder":"best-selling"}

SOLO JSON, contenido REAL.`, CLAUDE_EXPERT_SYSTEM, "seo", project.storeNiche || undefined, 4096);

            bodyHtml = aiContent.bodyHtml || bodyHtml;
            seoTitle = aiContent.seoTitle || seoTitle;
            seoDescription = aiContent.seoDescription || seoDescription;
          } catch { /* use provided content */ }
        }

        if (collectionType === "smart") {
          const rules = params?.rules || [{ column: "tag", relation: "equals", condition: title.toLowerCase() }];
          const smartCollection = {
            title,
            body_html: bodyHtml,
            published: params?.published !== false,
            rules,
            disjunctive: params?.disjunctive || false,
            sort_order: params?.sortOrder || "best-selling",
          };

          const created = await shopifyRequest<{ smart_collection: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, "/smart_collections.json",
            { method: "POST", body: JSON.stringify({ smart_collection: smartCollection }) }
          );

          result = {
            collectionId: created.smart_collection.id,
            title: created.smart_collection.title,
            type: "smart",
            rules,
            message: `✅ Colección inteligente "${title}" creada. Los productos se añaden automáticamente según las reglas.`,
          };
        } else {
          const customCollection: Record<string, unknown> = {
            title,
            body_html: bodyHtml,
            published: params?.published !== false,
            sort_order: params?.sortOrder || "best-selling",
          };

          const created = await shopifyRequest<{ custom_collection: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, "/custom_collections.json",
            { method: "POST", body: JSON.stringify({ custom_collection: customCollection }) }
          );

          const collectionId = created.custom_collection.id;

          if (params?.productIds && Array.isArray(params.productIds)) {
            for (const pid of params.productIds) {
              try {
                await shopifyRequest(
                  parseInt(projectId), project.shopDomain, "/collects.json",
                  { method: "POST", body: JSON.stringify({ collect: { collection_id: collectionId, product_id: parseInt(pid) } }) }
                );
              } catch { /* skip failed product assignment */ }
            }
          }

          result = {
            collectionId,
            title: created.custom_collection.title,
            type: "custom",
            productsAdded: params?.productIds?.length || 0,
            message: `✅ Colección "${title}" creada${params?.productIds?.length ? ` con ${params.productIds.length} productos asignados` : ""}. Descripción y SEO generados por IA.`,
          };
        }
        break;
      }

      case "list_collections": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const limit = Math.min(params?.limit ?? 20, 50);

        const [customData, smartData] = await Promise.all([
          shopifyRequest<{ custom_collections: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, `/custom_collections.json?limit=${limit}`
          ),
          shopifyRequest<{ smart_collections: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, `/smart_collections.json?limit=${limit}`
          ),
        ]);

        const allCollections = [
          ...(customData.custom_collections || []).map(c => ({ ...c, type: "custom" })),
          ...(smartData.smart_collections || []).map(c => ({ ...c, type: "smart" })),
        ];

        result = {
          collections: allCollections.map(c => ({
            id: c.id, title: c.title, type: c.type,
            handle: c.handle, published: c.published_at != null,
            productsCount: c.products_count || 0,
            bodyLength: String(c.body_html || "").length,
          })),
          total: allCollections.length,
          message: `${allCollections.length} colecciones encontradas (${customData.custom_collections?.length || 0} manuales + ${smartData.smart_collections?.length || 0} inteligentes)`,
        };
        break;
      }

      case "auto_collections": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        let allProds: Array<Record<string, unknown>> = [];
        for (const st of ["active", "draft", "archived"]) {
          const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
            parseInt(projectId), project.shopDomain, `/products.json?limit=50&status=${st}&published_status=any&fields=id,title,product_type,vendor,tags`
          );
          allProds = allProds.concat(d.products || []);
        }

        const productSummary = allProds.map(p => ({
          id: p.id, title: p.title, type: p.product_type, vendor: p.vendor, tags: p.tags,
        }));

        const collectionsAi = await askClaudeJsonWithBrain<{
          collections: Array<{
            title: string; type: "smart" | "custom"; description: string;
            rules?: Array<{ column: string; relation: string; condition: string }>;
            productIds?: number[];
            sortOrder: string;
          }>;
        }>(parseInt(projectId), `Analiza estos ${allProds.length} productos y diseña las colecciones PERFECTAS para la tienda.

PRODUCTOS:
${JSON.stringify(productSummary, null, 1)}

Nicho: ${project.storeNiche || "general"}

Crea colecciones que:
1. Agrupen productos por categoría/tipo de forma lógica
2. Incluyan colecciones temáticas atractivas para el comprador
3. Tengan títulos SEO atractivos
4. Usen smart collections cuando sea posible (basadas en tags o product_type)

JSON: {"collections":[{"title":"Nombre","type":"smart o custom","description":"descripción HTML profesional","rules":[{"column":"tag","relation":"equals","condition":"valor"}],"productIds":[ids si es custom],"sortOrder":"best-selling"}]}`, CLAUDE_EXPERT_SYSTEM, "general", project.storeNiche || undefined, 6144);

        const created: Array<{ id: unknown; title: string; type: string }> = [];
        for (const col of collectionsAi.collections || []) {
          try {
            if (col.type === "smart" && col.rules) {
              const sc = await shopifyRequest<{ smart_collection: Record<string, unknown> }>(
                parseInt(projectId), project.shopDomain, "/smart_collections.json",
                { method: "POST", body: JSON.stringify({ smart_collection: { title: col.title, body_html: col.description, rules: col.rules, sort_order: col.sortOrder || "best-selling", published: true } }) }
              );
              created.push({ id: sc.smart_collection.id, title: String(sc.smart_collection.title), type: "smart" });
            } else {
              const cc = await shopifyRequest<{ custom_collection: Record<string, unknown> }>(
                parseInt(projectId), project.shopDomain, "/custom_collections.json",
                { method: "POST", body: JSON.stringify({ custom_collection: { title: col.title, body_html: col.description, sort_order: col.sortOrder || "best-selling", published: true } }) }
              );
              const ccId = cc.custom_collection.id;
              if (col.productIds) {
                for (const pid of col.productIds) {
                  try {
                    await shopifyRequest(parseInt(projectId), project.shopDomain, "/collects.json",
                      { method: "POST", body: JSON.stringify({ collect: { collection_id: ccId, product_id: pid } }) });
                  } catch { /* skip */ }
                }
              }
              created.push({ id: ccId, title: String(cc.custom_collection.title), type: "custom" });
            }
          } catch (e) {
            logger.warn({ collection: col.title, error: e instanceof Error ? e.message : String(e) }, "Failed to create collection");
          }
        }

        result = {
          collectionsCreated: created.length,
          collections: created,
          message: `✅ ${created.length} colecciones creadas automáticamente por IA basándose en tus ${allProds.length} productos.\n${created.map(c => `• ${c.title} (${c.type})`).join("\n")}`,
        };
        break;
      }

      case "create_page": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const title = params?.title;
        const pageType = params?.pageType || "custom";
        if (!title && !pageType) { res.status(400).json({ error: "title o pageType requerido" }); return; }

        const pageTemplates: Record<string, string> = {
          about: "Sobre Nosotros / Quiénes Somos",
          contact: "Contacto",
          faq: "Preguntas Frecuentes (FAQ)",
          shipping: "Política de Envíos",
          returns: "Política de Devoluciones",
          privacy: "Política de Privacidad",
          terms: "Términos y Condiciones",
          size_guide: "Guía de Tallas",
        };

        const pageTitle = title || pageTemplates[pageType] || pageType;

        const pagePrompt = `Diseña la página "${pageTitle}" para una tienda Shopify PROFESIONAL.

Tienda: ${project.name || "Tienda Online"}
Nicho: ${project.storeNiche || "general"}
Tono: ${project.brandTone || "profesional"}
Dominio: ${project.shopDomain}
Tipo de página: ${pageType}

GENERA HTML COMPLETO y PROFESIONAL para esta página. Incluye:
- Estructura con <h1>, <h2>, <h3> jerárquicos
- Párrafos <p> con contenido REAL y específico para esta tienda
- Listas <ul><li> donde corresponda
- Formato con <strong>, <em> para énfasis
- Si es FAQ, usa formato pregunta-respuesta claro
- Si es Sobre Nosotros, cuenta la historia de la marca
- Si es Envíos/Devoluciones/Privacidad, incluye políticas completas y profesionales
- Contenido mínimo 500 palabras
- TODO en español, profesional, listo para publicar
- NO uses placeholders, lorem ipsum ni [insertar aquí]
- Incluye CTAs relevantes

Responde SOLO el HTML, sin envolver en \`\`\`html.`;

        const { dualAI } = await import("../lib/dual-ai.js");
        const dualPage = await dualAI(parseInt(projectId), pagePrompt, {
          mode: "gemini_research_claude_redact",
          claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM,
          geminiUseSearch: true,
          maxTokens: 8192,
          useCase: "ecommerce",
          niche: project.storeNiche || undefined,
        });
        const pageContent = dualPage.final;

        const handle = params?.handle || pageTitle.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, "-").replace(/^-|-$/g, "");

        const page = {
          title: pageTitle,
          body_html: pageContent,
          handle,
          published: params?.published !== false,
        };

        const created = await shopifyRequest<{ page: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, "/pages.json",
          { method: "POST", body: JSON.stringify({ page }) }
        );

        result = {
          pageId: created.page.id,
          title: created.page.title,
          handle: created.page.handle,
          contentLength: String(pageContent).length,
          message: `✅ Página "${created.page.title}" creada y publicada en Shopify.\n📝 ${String(pageContent).length} caracteres de contenido profesional generado por IA.\n🔗 URL: /pages/${created.page.handle}`,
        };
        break;
      }

      case "list_pages": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const data = await shopifyRequest<{ pages: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, "/pages.json?limit=50"
        );

        result = {
          pages: (data.pages || []).map(p => ({
            id: p.id, title: p.title, handle: p.handle,
            published: p.published_at != null,
            contentLength: String(p.body_html || "").length,
            createdAt: p.created_at,
          })),
          total: data.pages?.length || 0,
          message: `${data.pages?.length || 0} páginas en la tienda`,
        };
        break;
      }

      case "design_all_pages": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const pageTypes = params?.pageTypes || ["about", "faq", "shipping", "returns", "contact"];
        const createdPages: Array<{ id: unknown; title: string; handle: string }> = [];
        const pageErrors: string[] = [];

        const pageTitles: Record<string, string> = {
          about: "Sobre Nosotros",
          contact: "Contacto",
          faq: "Preguntas Frecuentes",
          shipping: "Política de Envíos",
          returns: "Devoluciones y Reembolsos",
          privacy: "Política de Privacidad",
          terms: "Términos y Condiciones",
          size_guide: "Guía de Tallas",
        };

        for (const pageType of pageTypes) {
          try {
            const pageTitle = pageTitles[pageType] || pageType;
            const pageContent = await askClaudeWithBrain(
              parseInt(projectId),
              [{ role: "user", content: `Diseña la página "${pageTitle}" para la tienda Shopify "${project.name || "Tienda"}".
Nicho: ${project.storeNiche || "general"}. Tono: ${project.brandTone || "profesional"}.
Tipo: ${pageType}. Dominio: ${project.shopDomain}.

HTML COMPLETO profesional, mín 400 palabras, con <h1>,<h2>,<h3>,<p>,<ul>,<li>,<strong>. Contenido REAL, NO placeholders. En español.
${pageType === "faq" ? "Incluye mínimo 10 preguntas frecuentes reales para este tipo de tienda." : ""}
${pageType === "about" ? "Cuenta una historia de marca inspiradora y profesional." : ""}
${pageType === "shipping" ? "Incluye zonas de envío, tiempos, costes y seguimiento." : ""}
${pageType === "returns" ? "Incluye plazos, condiciones, proceso paso a paso." : ""}
${pageType === "contact" ? "Incluye formulario HTML, email, horarios de atención." : ""}
SOLO HTML.` }],
              CLAUDE_EXPERT_SYSTEM, "general", project.storeNiche || undefined, 6144
            );

            const handle = pageType.replace(/_/g, "-");
            const created = await shopifyRequest<{ page: Record<string, unknown> }>(
              parseInt(projectId), project.shopDomain, "/pages.json",
              { method: "POST", body: JSON.stringify({ page: { title: pageTitle, body_html: pageContent, handle, published: true } }) }
            );
            createdPages.push({ id: created.page.id, title: String(created.page.title), handle: String(created.page.handle) });
          } catch (e) {
            pageErrors.push(`${pageType}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        result = {
          pagesCreated: createdPages.length,
          pages: createdPages,
          errors: pageErrors.length > 0 ? pageErrors : undefined,
          message: `✅ ${createdPages.length} páginas diseñadas y publicadas por IA:\n${createdPages.map(p => `• ${p.title} → /pages/${p.handle}`).join("\n")}${pageErrors.length > 0 ? `\n⚠️ ${pageErrors.length} errores` : ""}`,
        };
        break;
      }

      case "optimize_images": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const productId = params?.productId;
        let productsToOptimize: Array<Record<string, unknown>> = [];

        if (productId) {
          const d = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,images,product_type,vendor`
          );
          productsToOptimize = [d.product];
        } else {
          for (const st of ["active", "draft"]) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=50&status=${st}&fields=id,title,images,product_type,vendor`
            );
            productsToOptimize = productsToOptimize.concat(d.products || []);
          }
        }

        let totalImages = 0;
        let optimizedImages = 0;
        const prodResults: Array<{ id: unknown; title: string; imagesOptimized: number }> = [];

        for (const prod of productsToOptimize) {
          const images = (prod.images as Array<Record<string, unknown>>) || [];
          if (images.length === 0) continue;

          const missingAlt = images.filter(img => !img.alt || String(img.alt).trim() === "");
          if (missingAlt.length === 0) {
            totalImages += images.length;
            continue;
          }

          try {
            const { dualAIJson: dualImgJson } = await import("../lib/dual-ai.js");
            const imgDual = await dualImgJson<{ alts: string[] }>(
              parseInt(projectId),
              `Genera alt texts SEO profesionales para las ${images.length} imágenes de este producto Shopify.

Producto: "${prod.title}"
Tipo: "${prod.product_type || "general"}"
Marca: "${prod.vendor || ""}"

Genera un alt text descriptivo y SEO para cada imagen. Los alt texts deben:
- Describir lo que probablemente muestra la imagen del producto
- Incluir el nombre del producto y keywords relevantes
- Ser específicos (no genéricos como "imagen del producto")
- Tener 80-125 caracteres cada uno
- Estar en español

JSON: {"alts":["alt text imagen 1","alt text imagen 2",...]}
Genera exactamente ${images.length} alt texts.`,
              { claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM, useCase: "images", niche: project.storeNiche || undefined, maxTokens: 2048 }
            );
            const altTexts = imgDual.data;

            if (altTexts.alts && altTexts.alts.length > 0) {
              const imageUpdates = images.map((img, i) => ({
                id: img.id,
                alt: altTexts.alts[i] || String(img.alt || `${prod.title} - imagen ${i + 1}`),
              }));

              await shopifyRequest(
                parseInt(projectId), project.shopDomain, `/products/${prod.id}.json`,
                { method: "PUT", body: JSON.stringify({ product: { id: prod.id, images: imageUpdates } }) }
              );

              optimizedImages += altTexts.alts.length;
              prodResults.push({ id: prod.id, title: String(prod.title), imagesOptimized: altTexts.alts.length });
            }
          } catch (e) {
            logger.warn({ productId: prod.id, error: e instanceof Error ? e.message : String(e) }, "Image alt optimization failed");
          }

          totalImages += images.length;
        }

        result = {
          productsProcessed: productsToOptimize.length,
          totalImages,
          optimizedImages,
          products: prodResults,
          message: `✅ Optimización de imágenes completada.\n🖼 ${optimizedImages} alt texts generados para ${prodResults.length} productos.\n📊 Total imágenes procesadas: ${totalImages}`,
        };
        break;
      }

      case "read_cms": {
        const cookieH = req.headers.cookie ?? "";
        const cmsReadRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content`, { headers: { "Cookie": cookieH } });
        if (!cmsReadRes.ok) { res.status(500).json({ error: "Error al leer CMS" }); return; }
        const cmsData = await cmsReadRes.json();
        const sectionToRead = params?.section;
        if (sectionToRead && typeof sectionToRead === "string") {
          const parts = sectionToRead.split(".");
          let val: unknown = cmsData;
          for (const p of parts) { val = (val as Record<string, unknown>)?.[p]; if (val === undefined) break; }
          result = { section: sectionToRead, value: val ?? null, message: `CMS sección "${sectionToRead}": ${JSON.stringify(val).slice(0, 500)}` };
        } else {
          const sections = Object.keys(cmsData).filter(k => k !== "meta");
          result = { sections, totalSections: sections.length, message: `CMS tiene ${sections.length} secciones: ${sections.join(", ")}` };
        }
        break;
      }

      case "update_cms": {
        const fieldPath = params?.path;
        const value = params?.value;
        if (!fieldPath || value === undefined) { res.status(400).json({ error: "path y value requeridos" }); return; }
        const cookieHeader = req.headers.cookie ?? "";
        const cmsRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content`, { method: "PATCH", headers: { "Content-Type": "application/json", "Cookie": cookieHeader }, body: JSON.stringify({ path: fieldPath, value }) });
        if (!cmsRes.ok) { res.status(500).json({ error: "Error al actualizar CMS" }); return; }
        result = { success: true, path: fieldPath, value, message: `CMS actualizado: ${fieldPath} = ${typeof value === "string" ? value : JSON.stringify(value)}` };
        break;
      }

      case "update_cms_batch": {
        const changes = params?.changes as Array<{ path: string; value: unknown }>;
        if (!Array.isArray(changes) || !changes.length) { res.status(400).json({ error: "changes[] requerido con {path, value}" }); return; }
        const cookieBatch = req.headers.cookie ?? "";
        const batchRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content/batch`, { method: "POST", headers: { "Content-Type": "application/json", "Cookie": cookieBatch }, body: JSON.stringify({ changes }) });
        if (!batchRes.ok) { res.status(500).json({ error: "Error al actualizar CMS batch" }); return; }
        result = { success: true, changesApplied: changes.length, paths: changes.map(c => c.path), message: `CMS batch: ${changes.length} campos actualizados (${changes.map(c => c.path).join(", ")})` };
        break;
      }

      case "reset_cms": {
        const cookieReset = req.headers.cookie ?? "";
        const resetRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content/reset`, { method: "POST", headers: { "Content-Type": "application/json", "Cookie": cookieReset }, body: JSON.stringify({}) });
        if (!resetRes.ok) { res.status(500).json({ error: "Error al resetear CMS" }); return; }
        result = { success: true, message: "CMS reseteado a valores por defecto. Todos los textos vuelven a su estado original." };
        break;
      }

      case "generate_competitive_pricing": {
        const projectId = params?.projectId;
        const numPlans = Math.min(Math.max(parseInt(String(params?.numPlans ?? 6)), 3), 8);
        const industry = params?.industry || "Shopify agency / eCommerce SaaS";
        const syncToShopify = params?.syncToShopify !== false;

        try {
          const pricingPrompt = `INVESTIGA el mercado REAL de pricing para agencias y plataformas SaaS de optimización Shopify / eCommerce en 2025-2026.

INDUSTRIA: ${industry}

BUSCA precios REALES de:
1. Agencias Shopify (servicios mensuales de optimización, SEO, imágenes, A/B testing)
2. Plataformas SaaS de eCommerce (herramientas de optimización, pricing tools, image generation)
3. Servicios de IA para eCommerce (Claude, ChatGPT wrappers, automated tools)
4. Competidores directos: Shogun, PageFly, Privy, Klaviyo, Yotpo, Bold Commerce, Nosto, etc.

Luego GENERA ${numPlans} PLANES DE PRECIO profesionales y competitivos para ShopyBrain (plataforma de agencia Shopify con 6 motores IA: imágenes, consistencia visual, A/B testing, auto-pilot, pricing financiero, SEO técnico).

REQUISITOS:
1. Los precios deben ser COMPETITIVOS con el mercado real investigado
2. Incluye planes desde entrada hasta enterprise
3. Cada plan debe tener un DIFERENCIADOR claro
4. Features deben ser REALES — basados en capacidades reales de ShopyBrain
5. Usa pricing psicológico (precios que terminan en 7 o 9)
6. Incluye al menos un plan "one-shot" o pago único
7. El plan más popular debe ser el de mejor relación calidad/precio
8. Incluye badges estratégicos ("MÁS POPULAR", "MEJOR VALOR", "SIN RETAINER", etc.)

RESPONDE SOLO JSON válido con un array "plans":
{
  "plans": [
    {
      "id": "plan-slug",
      "name": "Nombre del Plan",
      "price": "XX",
      "currency": "€",
      "period": "por mes · + €XXX setup único",
      "featured": false,
      "badge": null,
      "features": [{"text": "Feature description", "included": true}],
      "cta": {"label": "Solicitar Plan →", "style": "ghost"},
      "shopifyProductTitle": "ShopyBrain - Nombre Plan (Mensual)",
      "shopifyProductDescription": "Descripción completa para Shopify..."
    }
  ],
  "strategy": "Explicación de la estrategia de pricing elegida",
  "marketPosition": "Dónde se posiciona ShopyBrain vs competencia"
}`;

          const { dualAIJson } = await import("../lib/dual-ai.js");
          const dualPricing = await dualAIJson<{
            plans: Array<{
              id: string; name: string; price: string; currency: string; period: string;
              featured: boolean; badge: string | null;
              features: Array<{ text: string; included: boolean }>;
              cta: { label: string; style: string };
              shopifyProductTitle?: string;
              shopifyProductDescription?: string;
            }>;
            strategy?: string;
            marketPosition?: string;
          }>(projectId ? parseInt(String(projectId)) : 0, pricingPrompt, {
            mode: "gemini_research_claude_redact",
            claudeSystemPrompt: "Eres un consultor de pricing SaaS con 15 años de experiencia en agencias Shopify. Generas catálogos de precios que maximizan conversión y revenue. Responde SOLO JSON válido.",
            geminiUseSearch: true,
            useCase: "pricing",
            maxTokens: 4000,
          });
          const plansResult = dualPricing.data;

          if (!plansResult?.plans?.length) {
            result = { error: true, message: "No se pudieron generar planes de precio. Inténtalo de nuevo." };
            break;
          }

          const cookiePricing = req.headers.cookie ?? "";
          const cmsChanges: Array<{ path: string; value: unknown }> = [];

          plansResult.plans.forEach((plan, i) => {
            cmsChanges.push({ path: `pricing.plans.${i}`, value: {
              id: plan.id || `plan-${i}`,
              name: plan.name,
              price: plan.price,
              currency: plan.currency || "€",
              period: plan.period,
              featured: plan.featured || false,
              badge: plan.badge || null,
              features: plan.features,
              cta: plan.cta || { label: `Solicitar ${plan.name} →`, style: plan.featured ? "gold" : "ghost" },
            }});
          });

          const batchCmsRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cookie": cookiePricing },
            body: JSON.stringify({ changes: cmsChanges }),
          });

          let shopifyProducts: Array<{ title: string; id: string; price: string }> = [];

          if (syncToShopify && projectId) {
            try {
              const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
              if (project) {
                for (const plan of plansResult.plans) {
                  try {
                    const shopifyProduct = {
                      title: plan.shopifyProductTitle || `ShopyBrain — ${plan.name}`,
                      body_html: plan.shopifyProductDescription || `<h2>${plan.name}</h2><p>${plan.period}</p><ul>${plan.features.filter(f => f.included).map(f => `<li>✅ ${f.text}</li>`).join("")}</ul>`,
                      product_type: "Servicio SaaS",
                      tags: `shopybrain, plan, pricing, ${plan.name.toLowerCase()}, saas, agency`,
                      status: "active",
                      variants: [{
                        title: plan.name,
                        price: plan.price,
                        requires_shipping: false,
                        taxable: true,
                        sku: plan.id,
                      }],
                    };

                    const created = await shopifyRequest<{ product: Record<string, unknown> }>(
                      parseInt(String(projectId)),
                      project.shopDomain,
                      "/products.json",
                      { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
                    );

                    shopifyProducts.push({
                      title: String(created.product.title),
                      id: String(created.product.id),
                      price: plan.price,
                    });
                  } catch (shopErr) {
                    logger.warn({ plan: plan.name, error: shopErr }, "Failed to create plan in Shopify");
                  }
                }
              }
            } catch { /* Shopify sync failed, CMS still updated */ }
          }

          result = {
            success: true,
            plansGenerated: plansResult.plans.length,
            plans: plansResult.plans.map(p => ({ name: p.name, price: `${p.price}${p.currency || "€"}`, featured: p.featured, badge: p.badge })),
            cmsUpdated: batchCmsRes.ok,
            shopifyProductsCreated: shopifyProducts.length,
            shopifyProducts,
            strategy: plansResult.strategy || "",
            marketPosition: plansResult.marketPosition || "",
            dualAIMode: dualPricing.mode,
            dualAITimings: dualPricing.timings,
            message: `🎯 ${plansResult.plans.length} planes generados y guardados en CMS${shopifyProducts.length > 0 ? ` + ${shopifyProducts.length} productos creados en Shopify` : ""}.\n\n📊 Planes:\n${plansResult.plans.map((p, i) => `${i + 1}. **${p.name}** — ${p.price}${p.currency || "€"} ${p.period}${p.badge ? ` [${p.badge}]` : ""}`).join("\n")}\n\n🧠 Estrategia: ${plansResult.strategy || "Pricing competitivo basado en investigación de mercado"}`,
          };
        } catch (err) {
          result = { error: true, message: `Error generando pricing: ${err instanceof Error ? err.message : String(err)}` };
        }
        break;
      }

      case "audit_app_offerings": {
        try {
          const cookieAudit = req.headers.cookie ?? "";
          const cmsReadRes = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/cms/content`, { headers: { "Cookie": cookieAudit } });
          const cmsData = cmsReadRes.ok ? await cmsReadRes.json() : {};

          const features = (cmsData.features?.items as Array<{ title: string; description: string }>) ?? [];
          const plans = (cmsData.pricing?.plans as Array<{ name: string; price: string; features: Array<{ text: string; included: boolean }> }>) ?? [];

          const auditPrompt = `Audita la oferta de ShopyBrain basándote en lo que realmente ofrece la plataforma:

MOTORES IA (features reales):
${features.map((f, i) => `${i + 1}. ${f.title}: ${f.description}`).join("\n")}

PLANES DE PRECIO ACTUALES:
${plans.map(p => `${p.name} (${p.price}€): ${p.features?.filter(f => f.included).map(f => f.text).join(", ")}`).join("\n")}

FUNCIONALIDADES REALES DE LA APP:
- OmniCore Brain (chatbot IA con 34 acciones: gestión Shopify, CMS, código, proveedores, diagnóstico)
- 6 motores IA (imágenes, consistencia visual, A/B testing, auto-pilot, pricing financiero, SEO técnico)
- Panel de cliente read-only con dashboard, productos, aprobaciones, mensajes, reportes
- Panel admin completo con CRM, auditoría, rediseño IA, vault, exports
- Email marketing con templates IA y Klaviyo
- Sistema de proveedores con investigación IA
- Generación de imágenes con Replicate (Flux + Recraft)
- Investigación de mercado con Gemini (Google Search grounding)
- Auto-pilot 24/7 con cron jobs
- Encriptación AES-256, RGPD compliant

ANALIZA:
1. ¿El pricing refleja el valor real de la plataforma?
2. ¿Los features listados cubren todo lo que hace la app?
3. ¿Falta algo en la landing que debería estar?
4. ¿Cómo se compara con la competencia?
5. Recomendaciones específicas de mejora

Responde en español, de forma directa y accionable.`;

          const auditResult = await anthropic.messages.create({
            model: "claude-sonnet-4-5", max_tokens: 3000,
            messages: [{ role: "user", content: auditPrompt }],
            system: "Eres un consultor de negocio SaaS especializado en agencias Shopify. Auditas productos y generas recomendaciones concretas y accionables.",
          });

          const auditText = auditResult.content[0].type === "text" ? auditResult.content[0].text : "";

          result = {
            success: true,
            featuresCount: features.length,
            plansCount: plans.length,
            audit: auditText,
            message: `🔍 **Auditoría de la oferta de ShopyBrain:**\n\n${auditText}`,
          };
        } catch (err) {
          result = { error: true, message: `Error en auditoría: ${err instanceof Error ? err.message : String(err)}` };
        }
        break;
      }

      case "modify_ui": {
        const target = params?.target;
        const change = params?.change;
        if (!target || !change) { res.status(400).json({ error: "target y change requeridos (ej: target='pricing carousel', change='hacer scroll horizontal en móvil')" }); return; }
        if (String(target).includes("..") || path.isAbsolute(String(target))) { res.status(400).json({ error: "Target inválido" }); return; }

        try {
          const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
          const frontendSrc = path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer/src");

          const analyzePrompt = `Eres un experto frontend React+TypeScript+CSS. El usuario quiere hacer este cambio visual/UI:

TARGET: ${target}
CAMBIO DESEADO: ${change}

Necesito que me digas:
1. Qué archivo(s) hay que modificar (path relativo desde src/)
2. Qué código hay que buscar (oldCode exacto)
3. Qué código nuevo poner (newCode)

Si es un cambio CSS, busca en archivos .css
Si es un cambio de layout/componente, busca en archivos .tsx

Responde SOLO JSON:
{
  "files": [
    {
      "filePath": "ruta/desde/src/...",
      "changes": [
        {"oldCode": "código exacto a reemplazar", "newCode": "código nuevo", "description": "qué hace este cambio"}
      ]
    }
  ],
  "summary": "resumen del cambio"
}`;

          const uiAnalysis = await anthropic.messages.create({
            model: "claude-sonnet-4-5", max_tokens: 3000,
            messages: [{ role: "user", content: analyzePrompt }],
            system: "Eres un experto frontend senior. Responde SOLO JSON válido. Los archivos del proyecto están en artifacts/shopify-optimizer/src/.",
          });

          const uiText = uiAnalysis.content[0].type === "text" ? uiAnalysis.content[0].text : "";
          const uiJson = JSON.parse(uiText.match(/\{[\s\S]*\}/)?.[0] || "{}");

          let changesApplied = 0;
          const appliedFiles: string[] = [];

          if (uiJson.files) {
            for (const file of uiJson.files) {
              const fullPath = path.resolve(frontendSrc, file.filePath);
              if (!fullPath.startsWith(frontendSrc)) continue;
              if (!fs.existsSync(fullPath)) continue;

              let content = fs.readFileSync(fullPath, "utf-8");
              for (const change of file.changes || []) {
                if (content.includes(change.oldCode)) {
                  content = content.replace(change.oldCode, change.newCode);
                  changesApplied++;
                }
              }
              fs.writeFileSync(fullPath, content, "utf-8");
              appliedFiles.push(file.filePath);
            }
          }

          result = {
            success: changesApplied > 0,
            changesApplied,
            files: appliedFiles,
            summary: uiJson.summary || "Cambio UI aplicado",
            message: changesApplied > 0
              ? `✅ **Cambio UI aplicado:** ${uiJson.summary || change}\n📁 Archivos: ${appliedFiles.join(", ")}\n🔧 ${changesApplied} cambios aplicados\n⚠️ Recarga la página para ver los cambios.`
              : `⚠️ No se pudieron aplicar los cambios automáticamente. Usa fix_code manualmente para hacer el cambio.`,
          };
        } catch (err) {
          result = { error: true, message: `Error modificando UI: ${err instanceof Error ? err.message : String(err)}` };
        }
        break;
      }

      default:
        res.status(400).json({ error: `Acción desconocida: ${action}` });
        return;
    }

    learnFromOperation({
      operationType: `chatbot_action_${action}`,
      title: `Chatbot ejecutó: ${action}`,
      content: `Acción: ${action}. Params: ${JSON.stringify(params).slice(0, 300)}. Resultado: ${(result as Record<string, unknown>).message ?? "OK"}`,
      confidence: 0.8,
      tags: ["chatbot", "action", action],
    });

    res.json({ success: true, action, ...result });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error({ action, params, error: errMsg }, "Chatbot action failed");

    let friendlyError = `Error ejecutando ${action}`;
    if (errMsg.includes("credit balance is too low") || errMsg.includes("insufficient_quota") || errMsg.includes("billing")) {
      friendlyError = `⚠️ Créditos de IA agotados — La API de Claude (Anthropic) no tiene saldo. Recarga créditos en console.anthropic.com para seguir usando ${action}.`;
    } else if (errMsg.includes("rate_limit") || errMsg.includes("Too many requests")) {
      friendlyError = `⏳ Límite de velocidad alcanzado — Espera unos segundos e inténtalo de nuevo.`;
    } else if (errMsg.includes("Could not verify API key") || errMsg.includes("authentication_error")) {
      friendlyError = `🔑 Error de autenticación con la API de Claude — Verifica ANTHROPIC_API_KEY en la configuración.`;
    } else if (errMsg.includes("overloaded") || errMsg.includes("529")) {
      friendlyError = `🔄 El servicio de IA está sobrecargado temporalmente. Inténtalo de nuevo en 1-2 minutos.`;
    } else {
      friendlyError = `Error en ${action}: ${errMsg.slice(0, 200)}`;
    }

    res.status(500).json({ error: friendlyError });
  }
});

router.get("/shopybrain/knowledge-graph", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable)
      .orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));

    const insights = await db.select({
      id: omnicoreInsightsTable.id,
      domain: omnicoreInsightsTable.domain,
      title: omnicoreInsightsTable.title,
      confidence: omnicoreInsightsTable.confidence,
      insightType: omnicoreInsightsTable.insightType,
    }).from(omnicoreInsightsTable)
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(200);

    const connections = await db.select().from(omnicoreCrossConnectionsTable)
      .orderBy(desc(omnicoreCrossConnectionsTable.connectionStrength))
      .limit(100);

    const domainNodes = domains.map(d => ({
      id: `domain-${d.domain}`,
      type: "domain" as const,
      label: DOMAIN_LABELS[d.domain ?? ""] ?? d.domain,
      domain: d.domain,
      depth: d.knowledgeDepth ?? 0,
      totalInsights: d.totalInsights ?? 0,
    }));

    const insightNodes = insights.map(i => ({
      id: `insight-${i.id}`,
      type: "insight" as const,
      label: i.title ?? "",
      domain: i.domain,
      confidence: i.confidence ?? 0.5,
      insightType: i.insightType,
    }));

    const domainInsightEdges = insights.map(i => ({
      source: `domain-${i.domain}`,
      target: `insight-${i.id}`,
      strength: i.confidence ?? 0.5,
      type: "domain-insight" as const,
    }));

    const crossEdges = connections
      .filter(c => c.insightA && c.insightB)
      .map(c => ({
        source: `insight-${c.insightA}`,
        target: `insight-${c.insightB}`,
        strength: c.connectionStrength ?? 0.5,
        type: "cross-connection" as const,
      }));

    const allNodeIds = new Set([...domainNodes.map(n => n.id), ...insightNodes.map(n => n.id)]);
    const validCrossEdges = crossEdges.filter(e => allNodeIds.has(e.source) && allNodeIds.has(e.target));
    const validDomainEdges = domainInsightEdges.filter(e => allNodeIds.has(e.source) && allNodeIds.has(e.target));

    res.json({
      nodes: [...domainNodes, ...insightNodes],
      edges: [...validDomainEdges, ...validCrossEdges],
    });
  } catch (err) {
    logger.error({ err }, "Knowledge graph fetch failed");
    res.status(500).json({ error: "Failed to fetch knowledge graph" });
  }
});

router.post("/shopybrain/run/retroanalysis", requireAdmin, async (_req, res): Promise<void> => {
  const { runRetroactiveReanalysis } = await import("../lib/scheduler.js");
  runRetroactiveReanalysis().catch(e => logger.error(e));
  res.json({ message: "Retroactive reanalysis started in background" });
});

router.post("/shopybrain/run/self-evaluation", requireAdmin, async (_req, res): Promise<void> => {
  const { runMonthlySelfEvaluation } = await import("../lib/scheduler.js");
  runMonthlySelfEvaluation().catch(e => logger.error(e));
  res.json({ message: "Monthly self-evaluation started in background" });
});

export default router;
