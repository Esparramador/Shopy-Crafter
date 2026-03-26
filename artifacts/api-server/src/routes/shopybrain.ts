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
import { learnFromOperation, askClaudeJsonWithBrain, askClaudeWithBrain, SHOPIFY_EXPERT_SYSTEM as CLAUDE_EXPERT_SYSTEM } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { saveToVault } from "../lib/vault.js";
import * as fs from "fs";
import * as path from "path";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
};

async function ensureDomains() {
  const domains = Object.keys(DOMAIN_LABELS);
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
    }
  }
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

    const actionDetectionBlock = `

CAPACIDADES DE ACCIÓN DIRECTA — SHOPIFY:
Cuando el usuario pida EJECUTAR una acción (crear producto, cambiar precio, ver productos, regenerar token, etc.), debes responder con un bloque JSON de acción AL FINAL de tu respuesta, después de tu texto explicativo.

Formato del bloque de acción (pon esto al final de tu respuesta cuando detectes una acción):
:::ACTION:::{"action":"nombre_accion","params":{...}}:::END_ACTION:::

Acciones disponibles:
- store_status: Ver estado de la tienda. Params: {projectId}
- list_products: Listar productos activos. Params: {projectId, limit?}
- list_all_products: Listar TODOS los productos (active+draft+archived). Params: {projectId, limit?, statusFilter? ("any","active","draft","archived")}
- create_product: Crear producto. Params: {projectId, title, bodyHtml?, price?, tags?, productType?, vendor?, status?, aiGenerate?}
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

REGLAS:
- Si el usuario dice "busca proveedores de X", "encuentra proveedores", "proveedores para X", "suppliers", "sourcing", EJECUTA search_suppliers
- Si el usuario dice "crea un producto llamado X", EJECUTA la acción create_product
- Si dice "muéstrame los productos", EJECUTA list_products
- Si dice "muéstrame TODOS los productos" o "productos draft" o "productos ocultos" o "productos archivados", EJECUTA list_all_products con statusFilter="any" o el filtro específico
- Si dice "regenera el token", EJECUTA regenerate_token
- Si dice "cuántos productos tiene la tienda", EJECUTA store_status
- Si dice "cambia el precio de X a Y", necesitas primero buscar el producto, o si dan el ID, usa change_price
- Si dice "publica el producto X", usa publish_product o set_product_status con status="active"
- Si dice "despublica", "pon en borrador", "oculta el producto X", usa set_product_status con status="draft"
- Si dice "archiva el producto X", usa set_product_status con status="archived"
- Si dice "escanea la tienda", "audita todos los productos", "escanear tienda", "hacer auditoría", EJECUTA scan_store con statusFilter="any" para incluir TODOS los productos
- Si dice "modifica el filtro de auditoría", "cambia el filtro", "incluye productos draft en la auditoría", "filtra por draft", "filtra por archivados", EJECUTA modify_audit_filter con statusFilter apropiado
- Si dice "diagnostica la app", "audita el funcionamiento", "revisa errores de la app", "hay algún problema", "la app no funciona bien", "self-check", "autodiagnóstico", EJECUTA diagnose_app
- Si dice "muéstrame el código de X", "lee el archivo X", "inspecciona X", "revisa el código de X", "qué hace el archivo X", EJECUTA inspect_code con el filePath correspondiente
- Si dice "arregla X", "repara X", "fix X", "corrige el bug de X", "modifica la función X", "cambia el código de X", PRIMERO usa inspect_code para leer el código, LUEGO analízalo y usa fix_code para aplicar el fix
- Si dice "qué archivos tiene la app", "lista los componentes", "qué páginas hay", "muéstrame la estructura", EJECUTA list_source_files
- Si dice "analiza la página X", "busca bugs en X", "hay errores en X", "revisa X en profundidad", "analiza el componente X", EJECUTA analyze_component con el filePath
- Si dice "arregla la app", "repara errores de la app", necesitas PRIMERO ejecutar analyze_component en los archivos relevantes, y LUEGO fix_code para cada error encontrado
- Si dice "optimiza este producto", "mejora el producto X", "genera contenido para el producto X", "rellena el producto X", EJECUTA optimize_product con productId
- Si dice "optimiza todos los productos", "mejora todos", "rellena todo el catálogo", "genera contenido para todos", EJECUTA optimize_all_products
- Si dice "crea una colección", "nueva colección de X", "agrupa los productos por X", EJECUTA create_collection
- Si dice "crea las colecciones automáticamente", "organiza los productos en colecciones", "genera colecciones", EJECUTA auto_collections
- Si dice "lista las colecciones", "qué colecciones hay", "ver colecciones", EJECUTA list_collections
- Si dice "crea la página de X", "haz la página About", "diseña la página FAQ", "crea página de envíos", EJECUTA create_page con el pageType adecuado
- Si dice "diseña todas las páginas", "crea todas las páginas de la tienda", "páginas esenciales", EJECUTA design_all_pages
- Si dice "lista las páginas", "qué páginas tiene la tienda", EJECUTA list_pages
- Si dice "optimiza las imágenes", "genera alt text", "SEO de imágenes", "alt texts", EJECUTA optimize_images
- Si dice "prepara la tienda completa", "configura toda la tienda", "setup completo", ejecuta en secuencia: optimize_all_products, auto_collections, design_all_pages, optimize_images
- Para filePath: los archivos frontend están en "src/pages/..." y "src/components/...", los backend en rutas del api-server. Siempre usa rutas relativas desde la raíz del proyecto correspondiente
- Si dice "borra el producto X", usa delete_product
- Si dice "busca productos de X", usa search_product
- Si dice "ver pedidos", usa get_orders
- USA projectId del contexto si el usuario tiene un proyecto activo
- Cuando ejecutes una acción, explica brevemente qué vas a hacer ANTES del bloque :::ACTION:::
- Si no se necesita una acción, simplemente responde normalmente sin el bloque :::ACTION:::
`;

    const sysPrompt = (customSystemPrompt ?? `Eres OmniCore AI, el asistente central de la plataforma ShopyBrain para agencias Shopify.
Eres experto en Shopify, Klaviyo, email marketing, SEO, pricing y estrategia eCommerce.
Tienes acceso al conocimiento acumulado de ShopyBrain — memorias de investigaciones anteriores sobre marcas, nichos y estrategias.
Responde siempre en español, de forma directa, clara y accionable.
Cuando el usuario pida ayuda o pregunte cómo hacer algo, actúa como GUÍA INTERACTIVA: da instrucciones paso a paso con los nombres EXACTOS de botones, páginas y secciones de la app.
Si conoces la página actual del usuario, contextualiza tu respuesta a esa página.
Cuando tengas conocimiento previo sobre una entidad, úsalo activamente en tu respuesta e indica qué parte viene de tu memoria.
PUEDES EJECUTAR ACCIONES EN SHOPIFY directamente desde el chat. Cuando el usuario pida crear, editar, eliminar, publicar productos, cambiar precios, ver estado de la tienda, regenerar tokens, etc., EJECUTA la acción correspondiente.`) + actionDetectionBlock + guideBlock + pageBlock + entityKnowledgeContext + memoriesContext;

    const projectContext = req.body.activeProjectId ? `\n[CONTEXTO: El usuario tiene el proyecto activo con ID ${req.body.activeProjectId}. Úsalo como projectId en las acciones.]` : "";
    const userContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + projectContext;

    const aiRes = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: sysPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const answer = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";

    let detectedAction: { action: string; params: Record<string, unknown> } | null = null;
    const actionMatch = answer.match(/:::ACTION:::([\s\S]*?):::END_ACTION:::/);
    if (actionMatch) {
      try {
        detectedAction = JSON.parse(actionMatch[1]);
      } catch { /* invalid JSON, ignore */ }
    }

    const cleanAnswer = answer.replace(/:::ACTION:::[\s\S]*?:::END_ACTION:::/g, "").trim();

    res.json({
      answer: cleanAnswer,
      source: "claude+omnicore",
      entityKnowledgeUsed: !!entityKnowledgeContext,
      potentialEntity: potentialEntity ?? null,
      detectedAction,
    });
    return;
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

  const systemPrompt = `Eres Shopy Brain, el megacerebro de eCommerce Shopify.
Analiza y responde con datos concretos sobre: ${searchType ?? "estrategia general"}.
Nicho de mercado: ${niche ?? "general"}. 
Proporciona insights accionables y específicos.`;

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: query }],
  });

  const aiContent = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";

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

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: `Realiza sesión de estudio para dominios: ${domainsToStudy.join(", ")}` }],
    system: systemPrompt,
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

        if (params?.aiGenerate !== false) {
          try {
            const aiRes = await anthropic.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 1500,
              system: "Eres un experto en copywriting eCommerce Shopify. Genera contenido que convierta. Responde SOLO JSON válido.",
              messages: [{
                role: "user",
                content: `Genera contenido optimizado para un producto Shopify.
Título: "${title}"
Tipo: ${params?.productType || "no especificado"}
Nicho: ${project.storeNiche || "general"}
Tono: ${project.brandTone || "profesional"}

Genera JSON: {"title":"...","description":"HTML persuasiva con bullet points","tags":["tag1","tag2"],"seoTitle":"...","seoDescription":"..."}`
              }],
            });
            const text = (aiRes.content[0] as { type: string; text: string }).text;
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              finalTitle = parsed.title || title;
              finalBody = parsed.description || finalBody;
              finalTags = Array.isArray(parsed.tags) ? parsed.tags.join(", ") : finalTags;
            }
          } catch { /* use original data */ }
        }

        const shopifyProduct = {
          title: finalTitle,
          body_html: finalBody,
          tags: finalTags,
          vendor: params?.vendor || undefined,
          product_type: params?.productType || undefined,
          status: params?.status || "draft",
          variants: [{
            title: "Default",
            price: params?.price || "0.00",
            compare_at_price: params?.compareAtPrice || null,
            sku: params?.sku || null,
            requires_shipping: true,
            taxable: true,
          }],
        };

        const created = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, "/products.json",
          { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
        );

        saveToVault({
          projectId: parseInt(projectId),
          fileType: "product_card",
          category: "product_creation",
          title: `Producto: ${created.product.title}`,
          description: finalBody ? String(finalBody).replace(/<[^>]*>/g, "").slice(0, 200) : undefined,
          productId: String(created.product.id),
          productTitle: String(created.product.title),
          generatedBy: "shopybrain_voice",
          metadata: {
            price: params?.price || "0.00",
            status: created.product.status,
            tags: finalTags,
            shopifyId: created.product.id,
          },
        }).catch(() => {});

        result = {
          productId: created.product.id,
          title: created.product.title,
          status: created.product.status,
          handle: created.product.handle,
          message: `Producto "${created.product.title}" creado exitosamente en Shopify (ID: ${created.product.id}, estado: ${created.product.status})`,
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
        const syncRes = await fetch(`http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/products/sync?statusFilter=${statusFilter}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cookie": req.headers.cookie || "" },
          body: JSON.stringify({ statusFilter }),
        });

        if (!syncRes.ok) {
          const errText = await syncRes.text();
          res.status(500).json({ error: `Error escaneando: ${errText}` });
          return;
        }

        const syncData = await syncRes.json() as Record<string, unknown>;
        result = {
          ...syncData,
          statusFilter,
          message: `Escaneo completado (filtro: ${statusFilter}). ${syncData.total ?? 0} productos analizados. Nota media: ${typeof syncData.avgScore === "number" ? syncData.avgScore.toFixed(0) : "N/A"}/100`,
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

        const frontendDir = directory.startsWith("src") ? directory : `src/${directory}`.replace(/\/+/g, "/").replace(/\/$/, "");
        const frontendFiles = listDir(FRONTEND_ROOT, frontendDir, "[frontend] ");
        const backendDir = directory.startsWith("src") ? directory : `src/${directory}`.replace(/\/+/g, "/").replace(/\/$/, "");
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

        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const candidates = [
          path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer", filePath),
          path.resolve(WORKSPACE_ROOT, "artifacts/api-server", filePath),
          path.resolve(WORKSPACE_ROOT, filePath),
        ];

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
        const focusOn = params?.focusOn || "all";

        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const candidates = [
          path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer", filePath),
          path.resolve(WORKSPACE_ROOT, "artifacts/api-server", filePath),
          path.resolve(WORKSPACE_ROOT, filePath),
        ];

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

        const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
        const candidates = [
          path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer", filePath),
          path.resolve(WORKSPACE_ROOT, "artifacts/api-server", filePath),
          path.resolve(WORKSPACE_ROOT, filePath),
        ];

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

        const optimizePrompt = `Eres el mejor copywriter y experto SEO de Shopify del mundo. Optimiza este producto de manera PROFESIONAL y COMPLETA.

PRODUCTO ACTUAL:
- Título: "${currentTitle}"
- Descripción HTML actual: "${currentDesc.slice(0, 500)}"
- Vendor: "${vendor}"
- Tipo: "${productType}"
- Tags actuales: "${currentTags}"
- Precio: ${variants[0]?.price || "N/A"}€
- Imágenes: ${images.length} fotos
- Nicho de la tienda: ${project.storeNiche || "comics y cultura pop"}
- Tono de marca: ${project.brandTone || "profesional y apasionado"}

GENERA UN JSON COMPLETO con TODOS estos campos:
{
  "title": "Título optimizado SEO (40-70 chars, incluye keywords relevantes)",
  "bodyHtml": "Descripción HTML COMPLETA y profesional. Mínimo 400 palabras. Incluye: <h2> subtítulos, <ul><li> bullet points con beneficios, especificaciones técnicas, storytelling emocional sobre el producto, llamada a la acción. Usa <strong> para enfatizar. NO uses placeholder ni lorem ipsum. Contenido REAL basado en el producto.",
  "tags": ["tag1", "tag2", "..."], // Mínimo 15 tags SEO relevantes, incluye long-tail keywords, sinónimos, categorías, materiales, estilos, público objetivo
  "seoTitle": "Meta title SEO optimizado (50-60 chars con keyword principal)",
  "seoDescription": "Meta description persuasiva (140-160 chars con CTA)",
  "altTexts": ["alt text para imagen 1", "alt text para imagen 2", "..."], // Un alt text descriptivo y SEO para cada imagen (${images.length} imágenes)
  "handle": "url-handle-optimizado-seo"
}

REGLAS CRÍTICAS:
- TODO el contenido debe ser REAL, específico para este producto exacto
- La descripción debe contar una historia, no solo listar características
- Tags deben cubrir: categoría, material, estilo, público, uso, colección, tendencia
- Alt texts deben describir lo que se VE en cada imagen, no genéricos
- Responde SOLO el JSON, sin texto adicional`;

        const optimized = await askClaudeJsonWithBrain<{
          title: string;
          bodyHtml: string;
          tags: string[];
          seoTitle: string;
          seoDescription: string;
          altTexts?: string[];
          handle?: string;
        }>(parseInt(projectId), optimizePrompt, CLAUDE_EXPERT_SYSTEM, "seo", project.storeNiche || undefined, 8192);

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

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: shopifyUpdate }) }
        );

        learnFromOperation({
          operationType: "product_optimization",
          title: `Optimización IA: ${updated.product.title}`,
          content: `Producto "${currentTitle}" optimizado → "${updated.product.title}". Tags: ${optimized.tags?.length || 0}. SEO: ${optimized.seoTitle}. Desc: ${String(optimized.bodyHtml || "").length} chars.`,
          confidence: 0.9,
          tags: ["optimization", "seo", "ai_content"],
        });

        result = {
          productId: updated.product.id,
          title: updated.product.title,
          previousTitle: currentTitle,
          tagsCount: optimized.tags?.length || 0,
          descriptionLength: String(optimized.bodyHtml || "").length,
          seoTitle: optimized.seoTitle,
          altTextsGenerated: optimized.altTexts?.length || 0,
          message: `✅ Producto "${updated.product.title}" optimizado profesionalmente.\n📝 Descripción: ${String(optimized.bodyHtml || "").length} chars\n🏷 ${optimized.tags?.length || 0} tags SEO\n🔍 Meta title + description SEO\n🖼 ${optimized.altTexts?.length || 0} alt texts de imágenes`,
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

JSON: {"collections":[{"title":"Nombre","type":"smart o custom","description":"descripción HTML profesional","rules":[{"column":"tag","relation":"equals","condition":"valor"}],"productIds":[ids si es custom],"sortOrder":"best-selling"}]}`, CLAUDE_EXPERT_SYSTEM, "ecommerce", project.storeNiche || undefined, 6144);

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

        const pageContent = await askClaudeWithBrain(
          parseInt(projectId),
          [{ role: "user", content: `Diseña la página "${pageTitle}" para una tienda Shopify PROFESIONAL.

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

Responde SOLO el HTML, sin envolver en \`\`\`html.` }],
          CLAUDE_EXPERT_SYSTEM,
          "general",
          project.storeNiche || undefined,
          8192
        );

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
            const altTexts = await askClaudeJsonWithBrain<{ alts: string[] }>(
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
Genera exactamente ${images.length} alt texts.`, CLAUDE_EXPERT_SYSTEM, "images", project.storeNiche || undefined, 2048
            );

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
    res.status(500).json({ error: `Error ejecutando ${action}: ${errMsg}` });
  }
});

export default router;
