import { Router } from "express";
import { enableLongRunning } from "../lib/long-running.js";
import { recordApiUsage } from "../lib/api-usage.js";
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicorePromptLibraryTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable, omnicoreStudySessionsTable, omnicoreCrossConnectionsTable, projectsTable, seoDataTable, productsTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { loadExistingEntityKnowledge } from "./entity-research.js";
import { APP_GUIDE_KNOWLEDGE, getPageContextForRoute, detectGuideRequest } from "../lib/app-guide.js";
import { buildMasterSkillsBlock } from "../lib/master-skills-injector.js";
import { buildPricingBlock } from "../lib/platform-knowledge.js";
import { learnFromOperation, askClaudeWithUsage, askClaudeWithBrain, buildBrandDnaContext, buildShopyBrainContext } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { askClaudeJsonValidated } from "../lib/ai-json.js";
import { saveToVault } from "../lib/vault.js";
import { processUploadedFile } from "../lib/file-processor.js";
import {
  requireConfirmation,
  type ConfirmSession
} from "../lib/shopybrain-helpers.js";
import { getPlatform } from "../lib/platform-capabilities.js";

import {
  handleRouteError, upload, studySessionSchema, DOMAIN_LABELS, ensureDomains, learnFromConversation,
  buildEnrichedLearningContent
} from "./shopybrain/shared.js";
import { dispatchBrainAction, NOT_HANDLED } from "./shopybrain/dispatch.js";
const router = Router();

// GET /shopybrain/quick-actions?route=/admin/inventory&projectId=2
// Devuelve acciones rápidas contextuales según la ruta actual del usuario.
// Reemplaza los QUICK_ACTIONS hardcodeados del frontend.
router.get("/shopybrain/quick-actions", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { route = "/", projectId } = req.query as Record<string, string>;
    const r = String(route);

    // Acciones SIEMPRE presentes (globales)
    const globalActions = [
      { icon: "❓", label: "¿Qué puedo hacer aquí?", prompt: `¿Qué puedo hacer en la página ${r}? Guíame paso a paso con los botones y opciones disponibles.` },
      { icon: "🧠", label: "Estado del sistema", prompt: "¿Qué conocimiento ha absorbido Shopy Crafter? Dame un resumen de las memorias, dominios y contenido absorbido hasta ahora." },
    ];

    // Plataforma del proyecto activo → prompts y contexto específicos (Stripe ≠ tienda)
    let platformInfo: { key: string; label: string; icon: string; color: string; entityLabel: string; capabilities: string[]; chatbotContext: string } | null = null;
    const pidNum = parseInt(String(projectId ?? ""), 10);
    if (pidNum > 0) {
      try {
        const [proj] = await db.select({ platformType: projectsTable.platformType }).from(projectsTable).where(eq(projectsTable.id, pidNum)).limit(1);
        if (proj) {
          const def = getPlatform(proj.platformType);
          platformInfo = { key: def.key, label: def.label, icon: def.icon, color: def.color, entityLabel: def.entityLabel, capabilities: def.capabilities, chatbotContext: def.chatbotContext };
        }
      } catch { /* sin plataforma → prompts por ruta */ }
    }

    // Acciones contextuales según ruta
    let contextActions: Array<{ icon: string; label: string; prompt: string; isResearch?: boolean }> = [];

    if (platformInfo && platformInfo.key !== "shopify" && r.startsWith("/projects/")) {
      // Proyecto no-Shopify: los prompts los dicta el registro de capacidades, no la ruta
      contextActions = [
        ...getPlatform(platformInfo.key).quickPrompts,
        { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
      ];
      res.json({ actions: [...globalActions, ...contextActions], platform: platformInfo });
      return;
    }

    if (r.startsWith("/admin/inventory")) {
      contextActions = [
        { icon: "🔄", label: "Sincronizar pedidos", prompt: `Sincroniza todos los pedidos de la tienda${projectId ? ` (proyecto ${projectId})` : ""} con paginación completa, incluyendo refunds.` },
        { icon: "💸", label: "Sincronizar devoluciones", prompt: `Sincroniza solo las devoluciones de la tienda${projectId ? ` (proyecto ${projectId})` : ""}.` },
        { icon: "📊", label: "Top productos vendidos", prompt: "Muéstrame los 10 productos más vendidos con cantidades y revenue real." },
        { icon: "⚠️", label: "Stock crítico", prompt: "¿Qué productos están en stock crítico (≤7 días)? Sugiere pedidos de reabastecimiento." },
      ];
    } else if (r.match(/\/projects\/\d+\/(audit|seo|redesign)/)) {
      contextActions = [
        { icon: "🔬", label: "Auditoría completa", prompt: "Realiza una auditoría completa de la tienda con análisis SEO, marca, copyright y oportunidades." },
        { icon: "✏️", label: "Rediseño masivo", prompt: "Rediseña todos los productos con la marca activa." },
        { icon: "📈", label: "Optimizar SEO", prompt: "Optimiza el SEO de todos los productos con keywords competitivas." },
      ];
    } else if (r.match(/\/projects\/\d+\/(images|fusion-studio|generator)/)) {
      contextActions = [
        { icon: "🖼", label: "Generar imágenes IA", prompt: "Genera imágenes profesionales de todos los productos con estilo lookbook." },
        { icon: "🧬", label: "Fusion: producto + escena", prompt: "Quiero fusionar un producto con una escena. Ayúdame paso a paso." },
        { icon: "🎬", label: "Video persona+producto", prompt: "Genera un video de un avatar mostrando uno de mis productos. Ayúdame a configurarlo (voy a /admin/avatar-studio)." },
      ];
    } else if (r.startsWith("/admin/clients") || r === "/" || r === "/home") {
      contextActions = [
        { icon: "🏪", label: "Estado de la tienda", prompt: "Muéstrame el estado general de las tiendas conectadas: productos, pedidos, tokens." },
        { icon: "📦", label: "Listar productos", prompt: "Lista todos los productos de la tienda principal." },
        { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
      ];
    } else if (r.startsWith("/admin/email")) {
      contextActions = [
        { icon: "📧", label: "Crear flujo Klaviyo", prompt: "Genera un workflow completo de Klaviyo con los 6 flujos esenciales." },
        { icon: "✉️", label: "Plantilla bienvenida", prompt: "Crea una plantilla de email de bienvenida en HTML profesional." },
      ];
    } else if (r.startsWith("/admin/stripe")) {
      contextActions = [
        { icon: "📊", label: "Análisis de fees", prompt: "Analiza mis costes de procesamiento en Stripe. ¿Cuál es mi tasa efectiva y cómo puedo reducirla?" },
        { icon: "🛡", label: "Auditoría de fraude", prompt: "Revisa mis métricas de disputas y fraude en Stripe. ¿Estoy por debajo del umbral del 0,75%? ¿Qué Radar rules debería activar?" },
        { icon: "💶", label: "SEPA vs tarjeta", prompt: "¿Cuánto podría ahorrar cambiando mis suscripciones UE de tarjeta a SEPA Direct Debit? Calcula el ahorro mensual." },
        { icon: "🔄", label: "Smart Retries config", prompt: "Explícame cómo configurar Smart Retries en Stripe Billing para recuperar el máximo MRR perdido por pagos fallidos." },
        { icon: "🏦", label: "Stripe vs Adyen", prompt: "¿Cuándo me convendría migrar de Stripe a Adyen? Analiza mi volumen actual vs el punto de inflexión de interchange++." },
        { icon: "🌍", label: "Métodos de pago por país", prompt: "¿Qué métodos de pago locales debería activar en Stripe según mis mercados principales? (iDEAL, Bancontact, giropay, etc.)" },
      ];
    } else if (r.startsWith("/admin/avatar-studio")) {
      contextActions = [
        { icon: "🗣", label: "Cómo grabar talking avatar", prompt: "Explícame paso a paso cómo grabar un talking avatar profesional." },
        { icon: "🛍", label: "Cómo grabar product avatar", prompt: "Explícame paso a paso cómo crear un video de avatar mostrando un producto." },
        { icon: "🎙", label: "Recomendar voz", prompt: "Recomiéndame la mejor voz de ElevenLabs para mi nicho. Pregúntame el nicho si no lo sabes." },
      ];
    } else {
      // Fallback genérico
      contextActions = [
        { icon: "📦", label: "Listar productos", prompt: "Lista todos los productos de la tienda principal." },
        { icon: "🛒", label: "Ver pedidos", prompt: "Muéstrame los últimos pedidos de la tienda." },
        { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
      ];
    }

    res.json({ actions: [...globalActions, ...contextActions], platform: platformInfo });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/status", requireAdmin, async (_req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { niche, type, minConfidence, limit = "50" } = req.query as Record<string, string>;
    let query = db.select().from(omnicoreMemoriesTable) as any;
    const conditions = [];
    if (niche) conditions.push(eq(omnicoreMemoriesTable.niche, niche));
    if (type) conditions.push(eq(omnicoreMemoriesTable.memoryType, type));
    if (minConfidence) conditions.push(gte(omnicoreMemoriesTable.confidence, parseFloat(minConfidence)));
    if (conditions.length) query = query.where(and(...conditions));
    const memories = await query.orderBy(desc(omnicoreMemoriesTable.confidence)).limit(parseInt(limit));
    res.json(memories);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.delete("/shopybrain/memories/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    await db.delete(omnicoreMemoriesTable).where(eq(omnicoreMemoriesTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/learn", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/search", requireAdmin, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const { query, niche, searchType, returnRaw, systemPrompt: customSystemPrompt, conversationHistory, currentRoute, engineMode, chatSessionId, claudeModel: reqClaudeModel, gptModel: reqGptModel } = req.body;
    const validEngines = ["auto", "claude", "gemini", "brain_only", "grok", "gpt", "nvidia"] as const;
    type EngineMode = typeof validEngines[number];
    const engine: EngineMode = validEngines.includes(engineMode) ? engineMode : "auto";
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
  
  ${entityKnowledge.summary}
  ═══ FIN DE CONOCIMIENTO PREVIO ═══
  
  INSTRUCCIÓN: Usa este conocimiento guardado como base para tu respuesta. Es información real ya investigada y verificada por Shopy Crafter. Complementa con tu propio conocimiento si es necesario.`;
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
        ? `\n\nCONOCIMIENTO RECIENTE EN SHOPYBRAIN:\n${relevantMemories.map(m => `• ${m.title}: ${(m.content ?? "").slice(0, 1000)}`).join("\n")}`
        : "";
  
      const isGuideRequest = detectGuideRequest(query);
      const pageContext = currentRoute ? getPageContextForRoute(currentRoute) : "";
      const guideBlock = isGuideRequest ? `\n\n${APP_GUIDE_KNOWLEDGE}` : "";
      const pageBlock = pageContext ? `\n\nPÁGINA ACTUAL DEL USUARIO: ${pageContext}\nRuta: ${currentRoute}\nINSTRUCCIÓN: Si el usuario pregunta algo, ten en cuenta que está en esta página. Si pide ayuda, guíale con los botones y opciones EXACTOS de esta página. Sé muy específico con nombres de botones, ubicaciones y orden de pasos.` : "";
  
      let brandDnaBlock = "";
      const activeProjectId = req.body.activeProjectId;
      try {
        const [brandDnaResult, brainCtx] = await Promise.all([
          activeProjectId ? buildBrandDnaContext(parseInt(activeProjectId)) : Promise.resolve(""),
          buildShopyBrainContext(niche, "general", query),
        ]);
        brandDnaBlock = (brainCtx || "") + (brandDnaResult || "");
      } catch {}
  
      const actionDetectionBlock = `
  
  CAPACIDADES DE ACCIÓN DIRECTA — SHOPIFY:
  Cuando el usuario pida EJECUTAR una acción (crear producto, cambiar precio, ver productos, regenerar token, etc.), debes responder con un bloque JSON de acción AL FINAL de tu respuesta, después de tu texto explicativo.
  
  Formato del bloque de acción (pon esto al final de tu respuesta cuando detectes una acción):
  :::ACTION:::{"action":"nombre_accion","params":{...}}:::END_ACTION:::
  
  Acciones disponibles:
  - store_status: Ver estado de la tienda. Params: {projectId}
  - list_products: Listar productos activos. Params: {projectId, limit?}
  - list_all_products: Listar TODOS los productos (active+draft+archived). Params: {projectId, limit?, statusFilter? ("any","active","draft","archived")}
  - create_product: Crear producto CALIDAD 100/100 con IA (título SEO 45-65 chars, descripción 800-1200 palabras con 8 secciones: storytelling, beneficios, specs, FAQ, trust badges; 22-28 tags; precio investigado del mercado; meta tags SEO optimizados; imágenes generadas con IA). Si el usuario proporciona referenceImageUrl, las imágenes se generan desde esa referencia (modelo con producto, lifestyle, detalles, etc). Params: {projectId, title, bodyHtml?, price?, tags?, productType?, vendor?, status?, aiGenerate?, skipImages?, referenceImageUrl?}
  - edit_product: Editar producto. Params: {projectId, productId, title?, bodyHtml?, tags?, status?, price?, vendor?}
  - change_price: Cambiar precio. Params: {projectId, productId? o title (nombre del producto), price, compareAtPrice?}. Puedes usar el NOMBRE del producto en "title" y se buscará automáticamente.
  - set_product_status: Cambiar estado de producto (publicar/despublicar/archivar). Params: {projectId, productId, status ("active","draft","archived")}
  - scan_store: Escanear/auditar TODOS los productos de la tienda (incluye draft, archived). Params: {projectId, statusFilter? ("any","active","draft","archived")}
  - audit_store: Auditoría PROFUNDA de toda la tienda — scores, grades (A/B/C/D), problemas críticos, warnings, productos sin publicar, sin compare_at_price, pocas imágenes, descripción corta, pocos tags. Params: {projectId}
  - fix_unpublished: Publicar TODOS los productos que están sin publicar (draft/hidden→active+published+global). Params: {projectId}
  - fix_missing_compare_prices: Añadir compare_at_price automáticamente a todas las variantes que no lo tienen (precio tachado). Params: {projectId}
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
  - add_to_collection: Añadir productos a colección existente. Params: {projectId, collectionId, productIds[]}
  - list_collections: Listar colecciones. Params: {projectId, limit?}
  - auto_collections: Analizar productos y crear colecciones inteligentes automáticamente. Params: {projectId}
  - create_page: Crear página Shopify con contenido IA. Params: {projectId, title?, pageType? ("about"|"contact"|"faq"|"shipping"|"returns"|"privacy"|"terms"|"size_guide")}
  - update_page: Actualizar página Shopify existente. Params: {projectId, pageId, title?, bodyHtml?, published? (boolean), handle?}
  - list_pages: Listar páginas de la tienda. Params: {projectId}
  - sync_store_theme: Sincronizar configuración del CMS (sección storeTheme) al theme activo de Shopify. Aplica: header nav, hero CTAs, announcement bar, login redirect, protección de compra. Params: {projectId, themeId?}
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
  - generate_platform_report: Generar un informe COMPLETO de todas las capacidades, herramientas, acciones, informes, servicios y pricing de la plataforma Shopy Crafter. Documento profesional descargable con TODO lo que la plataforma puede hacer. Params: {projectId?, clientName? (nombre del destinatario)}
  - copyright_audit: Auditoría de copyright, marcas registradas y propiedad intelectual de todos los productos. Detecta infracciones y sugiere nombres alternativos seguros. Params: {projectId}
  - modify_ui: Aplicar cambios visuales/UI/CSS/layout a la app (scroll horizontal, animaciones, responsive, colores, etc.). Params: {target (qué cambiar, ej: "pricing carousel", "hero section", "sidebar"), change (qué hacer, ej: "hacer scroll horizontal en móvil", "añadir animación fade-in")}
  - list_themes: Listar todos los themes de la tienda Shopify. Params: {projectId}
  - list_theme_files: Listar TODOS los archivos del theme activo (o específico). Params: {projectId, themeId? (default: theme activo), directory? ("layout"|"templates"|"sections"|"snippets"|"assets"|"config"|"locales"|"blocks")}
  - read_theme_file: Leer el contenido COMPLETO de un archivo del theme. Params: {projectId, assetKey (ej: "sections/header.liquid", "assets/base.css", "config/settings_data.json"), themeId?}
  - edit_theme_file: Editar un archivo del theme de forma INTELIGENTE (lee primero, entiende estructura, aplica cambios sin sobrescribir). Params: {projectId, assetKey, editType ("replace_block"|"add_css"|"modify_section"|"update_settings"|"full_replace"|"smart_edit"), oldCode? (para replace_block), newCode (código nuevo), description (descripción del cambio), themeId?}
  - create_theme_section: Crear una nueva sección Liquid con schema completo. Params: {projectId, sectionName (sin .liquid), sectionContent (HTML+Liquid+Schema completo), themeId?}
  - audit_theme: Auditoría COMPLETA del theme (estructura, SEO, rendimiento, accesibilidad, mejores prácticas). Params: {projectId, themeId?}
  - edit_theme_css: Editar CSS del theme de forma inteligente (añadir, modificar, no borrar). Params: {projectId, cssFile? (default: primer .css en assets/), action ("add"|"replace"|"remove_and_add"), selector? (para replace), cssCode, themeId?}
  - edit_theme_settings: Editar settings del theme (settings_data.json) con deep merge. Params: {projectId, settingsPath (ej: "current.sections.header"), value (nuevo valor), themeId?}
  - brain_sync: Sincronizar/importar conocimiento desde un cerebro externo. Params: {url (URL base del cerebro externo), apiKey? (API key si requiere auth), source? (etiqueta origen)}
  - brain_stats: Ver estadísticas completas del cerebro Shopy Crafter (memorias, insights, dominios, prompts, fuentes). Sin params.
  - brain_export: Exportar todo el conocimiento del cerebro. Params: {domain? (filtrar por dominio), format? ("json"|"ndjson")}
  - redesign_product: Rediseñar producto con calidad 100/100 Semrush (título SEO, 800-1200 palabras, 22-28 tags, 8 photo briefs, pricing psicológico). Params: {projectId, productId, parts? (array: "title","bodyHtml","price","tags","metafields","photoBriefs")}
  - apply_redesign: Aplicar un rediseño previamente generado al producto en Shopify. Params: {projectId, productId, fields? (array: "title","description","tags","meta" — default: todos)}
  - bulk_redesign: Rediseñar TODOS los productos en lote con calidad profesional. Params: {projectId, mode? ("all"|"weak" — default "all")}
  - create_ab_test: Crear test A/B (imagen o precio) para un producto. Params: {projectId, productId, testType ("image"|"price"), variantA?, variantB?}
  - list_ab_tests: Ver tests A/B activos y completados. Params: {projectId}
  - declare_winner: Declarar ganador de un test A/B y aplicar. Params: {projectId, testId, winner ("A"|"B")}
  - seo_full_audit: Auditoría SEO completa Semrush-level (16 criterios, keyword consistency, readability, structured data). Params: {projectId}
  - keyword_intelligence: Investigación de keywords con Google Search (volumen, dificultad, intención, autocomplete, "People Also Ask"). Params: {projectId, keyword}
  - blog_strategy: Generar estrategia de contenido blog (pillar content + cluster topics basado en productos). Params: {projectId}
  - generate_blog_post: Generar artículo de blog SEO optimizado. Params: {projectId, topic, targetKeyword?, wordCount? (default 1500)}
  - generate_schemas: Generar JSON-LD Schema (Product, FAQ, Organization) para productos. Params: {projectId, productId? (sin id = todos)}
  - generate_all_metas: Generar meta titles + descriptions SEO para todos los productos. Params: {projectId}
  - fix_all_alt_texts: Corregir alt texts SEO de todas las imágenes. Params: {projectId}
  - audit_page_speed: Auditoría PageSpeed Insights (Core Web Vitals, LCP, CLS, FID). Params: {projectId}
  - generate_sitemap: Generar sitemap XML optimizado. Params: {projectId}
  - scan_competitor: Escanear competidor (precios, productos, promociones, nivel de amenaza). Params: {projectId, competitorId}
  - discover_competitors: Descubrir competidores automáticamente usando Google Search (no necesita que el usuario diga quiénes son). Busca tiendas y marcas competidoras en el mismo nicho. Params: {projectId}
  - analyze_competitor_product: Analizar posicionamiento de precio vs competidores. Params: {projectId, productId}
  - calculate_optimal_price: Calcular precio óptimo con IA (elasticidad, márgenes, competencia). Params: {projectId, productId}
  - estimate_cogs: Estimar COGS con IA (materiales, producción, envío). Params: {projectId, productId}
  - auto_estimate_all_cogs: Estimar COGS de TODOS los productos de un proyecto en lote (máx 10). Params: {projectId}. Útil cuando el usuario dice "estima los costes de todos mis productos" o "calcula COGS de todo el catálogo".
  - price_simulator: Simular escenarios de precio (qué pasa si subo/bajo precio). Params: {projectId, productId, newPrice (número), unitsPerMonth? (default 30)}
  - financial_forecast: Forecast financiero a 3-6 meses con escenarios. Params: {projectId, months? (default 6)}
  - financial_dashboard: Ver dashboard financiero completo (márgenes, COGS, revenue). Params: {projectId}
  - generate_product_images: Generar imágenes IA para un producto (hero, lifestyle, detalle, etc). Params: {projectId, productId, imageTypes? (array)}
  - generate_images_from_reference: Generar imágenes profesionales a partir de una IMAGEN DE REFERENCIA del producto real. El usuario proporciona una foto de su producto y el sistema genera múltiples fotos profesionales desde diferentes ángulos, con modelos, lifestyle, detalles, flat-lay, etc., manteniendo la FIDELIDAD EXACTA al producto original. Se adapta al tipo de producto: ropa (modelo frontal/trasera/lateral/lifestyle), calzado (puesto/par/suela), joyería (modelo/elegante/macro), cosmética (textura/aplicación/ingredientes), comida (apetitoso/servir/mesa), electrónica (hero/uso/ángulos), y CUALQUIER otro tipo. Params: {projectId, productId, referenceImageUrl, productTitle?, productType?, scenes? (array de keys específicos), autoUpload? (default true)}
  - virtual_tryon: VIRTUAL TRY-ON / OOTD / Photoshoot con modelo. Vestir a una persona real con los productos de la tienda. El usuario proporciona: 1) foto de una persona/modelo, 2) fotos del producto (ropa, zapatos, accesorios, cosméticos, etc). El sistema VISTE a esa persona con los productos generando fotos ultra-profesionales tipo campaña de moda (frontal, street style, editorial, lifestyle, close-up). Funciona para CUALQUIER producto físico: ropa, calzado, joyería, cosméticos, accesorios, etc. Params: {projectId, productId, modelImageUrl (URL de la foto de la persona), productImageUrls (array de URLs de fotos de productos), productTitle?, productType?, scenes? (array de keys), autoUpload? (default true)}
  - bulk_generate_images: Generar imágenes para múltiples productos. Params: {projectId, productIds (array de IDs), imageTypes? (array: "hero","lifestyle","detail","packaging","ugc","scale" — default: ["hero","lifestyle","detail"])}
  - generate_email_flow: Crear flujo de email marketing completo con IA (welcome, abandoned cart, post-purchase). Params: {projectId, flowType ("welcome"|"abandoned_cart"|"post_purchase"|"win_back"|"custom"), customTopic?}
  - generate_email: Generar un email de marketing individual con IA. Params: {projectId, emailType ("promotional"|"newsletter"|"product_launch"|"sale"), subject?, products?}
  - fusion_analyze: Analizar imagen con Fusion Studio (descomponer en componentes: colores, formas, texturas, marca, tipografía). Params: {imageUrl, projectId?}
  - fusion_create_product: Analizar imagen y crear producto completo en Shopify desde ella. Params: {projectId, imageUrl, title?, price?}
  - run_leveled_report: Generar informe con sistema de 5 niveles (1=Diagnóstico, 2=Guía, 3=Contenido Producido, 4=Premium Full, 5=Enterprise). Params: {projectId, type (tipo de informe del generador), level (1-5), template?}
  - upload_file: Procesar archivo subido por el usuario (CSV, PDF, Excel, JSON, imágenes). Params: {fileContext? (descripción)}
  - inventory_sync: Sincronizar inventario con Shopify (stock, variantes, opciones, precios). Params: {projectId}
  - inventory_alerts: Ver alertas de stock bajo. Params: {projectId}
  - inventory_deep_report: Informe profundo de inventario (por producto, por opcion/talla/color, por tipo, stock total, valor, margen, agotados). Params: {projectId}
  - inventory_sync_orders: Sincronizar pedidos de Shopify para analytics de ventas (que se vende, quien compra, que tallas/colores, cantidades). Params: {projectId}
  - inventory_sales_analytics: Analytics completo de ventas (top productos, top variantes por talla/color, top clientes, ventas por opcion, por pais). Params: {projectId}
  - sales_report: Informe completo de ventas y stock desglosado por producto y variante (talla, color, tamaño, plan, idioma, etc). Cantidades vendidas, revenue, stock actual. Descargable en HTML y PDF. Params: {projectId}
  - inventory_customer_history: Historial completo de un cliente (que ha comprado, tallas preferidas, colores, gasto total, frecuencia). Params: {projectId, customerId?, customerEmail?}
  - agency_quote: Generar presupuesto/cotización profesional para un cliente. Params: {projectId, services? (array), clientName?}
  - agency_proposal: Generar propuesta comercial completa con análisis y estrategia. Params: {projectId, clientName?, clientUrl?}
  - setup_full_store: CONFIGURACIÓN COMPLETA de una tienda en Shopify desde cero (páginas, colecciones, SEO, schemas, meta tags, alt texts). Params: {projectId}
  - learn_from_url: Absorber/aprender de una URL (página web, artículo, competidor, video YouTube). El cerebro extrae TODO el conocimiento. Params: {url, label? (descripción opcional)}
  - learn_from_content: Aprender de texto/contenido pegado directamente. Params: {content, label? (descripción), contentType? ("article"|"strategy"|"competitor"|"product"|"instruction")}
  - recall_knowledge: Buscar en la memoria del cerebro por tema/keyword. Params: {query, limit? (default 10)}
  - brain_status: Ver estado completo del cerebro (total memorias, por tipo, últimas aprendidas). Sin params.
  - list_upcoming_appointments: Ver las próximas citas del calendario CRM. Sin params.
  - check_calendar_availability: Huecos libres de un día. Params: {date (YYYY-MM-DD), duration? (minutos, 60)}
  - create_appointment: Crear una cita en el calendario CRM (se sincroniza con Google Calendar si está conectado). Params: {client_name, meeting_date (YYYY-MM-DD), meeting_time? ("HH:MM", 10:00), duration_minutes? (60), company?, email?, phone?, description?}
  - get_calendar_stats: Estadísticas del calendario CRM (próximas, completadas, pendientes, facturado). Sin params.
  - list_users: Listar todos los usuarios/clientes registrados. Sin params.
  - create_user: Crear un nuevo usuario (siempre rol client). Params: {email, name?, password?}
  - invite_client: Invitar un cliente a un proyecto (genera link de invitación + envía email). Params: {projectId, email, name?}
  - deactivate_user: Desactivar un usuario (bloquear acceso). Params: {userId}
  - activate_user: Reactivar un usuario desactivado. Params: {userId}
  - reset_user_password: Resetear contraseña de un usuario. Params: {userId, password}
  - list_messages: Listar mensajes de un proyecto. Params: {projectId}
  - send_message: Enviar mensaje a un cliente en un proyecto. Params: {projectId, content}
  - unread_messages: Ver cuántos mensajes sin leer hay. Sin params.
  - list_approvals: Listar aprobaciones pendientes de un proyecto. Params: {projectId}
  - create_approval: Crear una aprobación para que el cliente apruebe un cambio. Params: {projectId, type?, title, description?, beforeValue?, afterValue?, reasoning?, estimatedImpact?}
  - audit_log: Ver el registro de auditoría (últimas 100 acciones admin). Sin params.
  - list_automations: Listar todas las automatizaciones/cron jobs y su estado. Sin params.
  - run_automation: Ejecutar una automatización manualmente. Params: {jobId (ej: "micro-learning", "revenue-snapshots", "inventory-sync", "competitor-scans", "daily-deep-study", "mega-synthesis", "token-refresh")}
  - list_email_flows: Listar flujos de email marketing guardados. Params: {projectId?}
  - create_email_flow: Crear un flujo de email (CRUD, no generar con IA). Params: {projectId, name, flowType?, triggerType?, sendDelay?, subjectA?, subjectB?, previewText?, tone?, language?}
  - delete_email_flow: Eliminar un flujo de email. Params: {flowId}
  - send_restock_email: Generar email de restock a proveedor con IA. Params: {projectId, productId, productTitle?, currentStock?, daysRemaining?, supplierEmail?}
  - restock_orders: Ver órdenes de restock pendientes/historial. Params: {projectId}
  - edit_collection: Editar una colección existente (título, descripción HTML, SEO, imagen, orden). Params: {projectId, collectionId, collectionType? ("custom"|"smart"), title?, bodyHtml?, sortOrder?, published?, seoTitle?, seoDescription?, image? (URL)}
  - delete_collection: Eliminar una colección. Params: {projectId, collectionId, collectionType? ("custom"|"smart")}
  - get_collection_products: Ver todos los productos de una colección con stock y variantes. Params: {projectId, collectionId, limit?}
  - remove_from_collection: Quitar un producto de una colección. Params: {projectId, collectionId, productId}
  - list_variants: Ver todas las variantes de un producto con stock, precio, SKU, opciones. Params: {projectId, productId}
  - add_variant: Añadir variante a un producto con precio, stock, SKU. Params: {projectId, productId, option1?, option2?, option3?, price?, compareAtPrice?, sku?, barcode?, weight?, weightUnit?, quantity?}
  - edit_variant: Editar una variante (precio, SKU, opciones, stock). Params: {projectId, variantId, option1?, option2?, option3?, price?, compareAtPrice?, sku?, barcode?, weight?, weightUnit?, quantity?}
  - delete_variant: Eliminar una variante de un producto. Params: {projectId, productId, variantId}
  - update_stock: Actualizar stock de un producto/variante. Si se pasa productId sin variantId, actualiza TODAS las variantes. Params: {projectId, productId?, variantId?, quantity}
  - bulk_update_stock: Actualizar stock de múltiples productos/variantes a la vez. Params: {projectId, items: [{variantId? o productId?, quantity}]}
  - update_product_price: Actualizar el precio de un producto/variante en Shopify. Params: {projectId, productId?, variantId?, price, compareAtPrice?}. Si solo se da productId, actualiza TODAS las variantes.
  - bulk_update_prices: Actualizar precios de múltiples productos/variantes a la vez. Params: {projectId, items: [{productId? o variantId? o title (nombre del producto), price, compareAtPrice?}]}. IMPORTANTE: puedes pasar el NOMBRE del producto en "title" y se buscará automáticamente en Shopify.
  - sync_catalog_prices: Sincronizar TODOS los precios de los productos de Shopify con el catálogo oficial de Shopy Crafter. Analiza todos los productos, detecta discrepancias y actualiza los precios incorrectos automáticamente. Params: {projectId, dryRun? (si true, solo muestra cambios sin aplicar)}
  - price_audit: Auditar los precios de todos los productos de la tienda Shopify, comparándolos con el catálogo oficial. Genera un informe de discrepancias con recomendaciones. Params: {projectId}
  - list_products_with_prices: Listar TODOS los productos de la tienda con sus precios actuales, variantes, SKUs y compare_at_price. Params: {projectId, filter? ("all"|"subscriptions"|"services"|"creative"|"credits")}
  - generate_brand_css: Generar un archivo CSS personalizado adaptado al ADN de marca del cliente (colores, tipografías, botones, tarjetas, responsive). Params: {projectId}
  - generate_brand_kit: Generar el Brand Kit completo (CSS + Guía de marca + Tokens JSON + Sección Liquid + README). Params: {projectId}
  - generate_brand_guide: Generar la Guía de Identidad Visual de la marca (paleta colores, tipografías, componentes, estilo foto, tono de voz). Params: {projectId}
  - generate_brand_story: Generar narrativa/storytelling de marca con IA. Params: {projectId, format ("manifesto"|"founder"|"product"|"email"|"social"|"press"), productId? (shopifyProductId), language? ("es"|"en"|"fr"|"it"|"pt"|"de")}. Formatos: manifesto=brand manifesto emocional, founder=historia del fundador, product=historia del producto, email=secuencia 3 emails bienvenida, social=pack 6 posts RRSS, press=nota de prensa. Combinar con generate_office_document para DOCX descargable.
  - run_universal_generator: Ejecutar el Generador Universal para crear cualquier tipo de contenido profesional. Params: {projectId, generatorType (seo-audit|seo-metas|seo-schemas|seo-alt-texts|seo-keywords|blog-strategy|blog-post|product-catalog|complete-report|financial-report|inventory-report|consistency-report|revenue-analysis|brand-css|brand-css-ai|brand-guide|brand-kit|brand-kit-premium|photo-brief|social-kit|competitor-scan|market-research|pricing-optimal|margin-waterfall|financial-forecast|product-redesign|email-templates|email-flow|social-posts|landing-design|agency-proposal|agency-budget|external-audit|data-csv|data-xlsx|data-json|data-zip), url? (para análisis externo)}
  - analyze_web_design: Analizar en profundidad el diseño de cualquier página web — extrae HTML+CSS reales, genera CSS/HTML mejorado copy-paste-ready, informe profesional descargable, y guarda todo en Vault. Params: {projectId, url, template? ("classic"|"elegance"|"prestige")}
  - generate_export: Generar un informe/export (HTML, CSV, PDF). Params: {projectId, reportType ("seo-audit"|"product-catalog"|"financial"|"brand-brief"|"ab-tests"|"images-gallery"|"competitors"|"consistency"|"inventory"|"redesigns"|"revenue"|"complete-report"|"csv/products")}
  - run_full_audit_report: Ejecutar auditoría completa y guardar informe. Params: {projectId}
  - generate_ai_report: Generar informe estratégico con IA. Params: {projectId, sections?}
  - create_business_card: Crear tarjeta de presentación profesional con IA (Card Studio). Pipeline 5 capas: fondo IA/CSS, logo overlay, texto vectorial, QR vCard, composición Sharp 300DPI. Exporta PNG + PDF. Params: {projectId, name (nombre de la tarjeta), fullName?, jobTitle?, companyName?, tagline?, email?, phone?, website?, socialHandle?, address?, templateId? ("elite-executive"|"minimalist-mono"|"luxury-foil"|"creative-bold"|"corporate-clean"|"tech-dark"), layout? ("centered"|"left"|"grid"), backgroundModel? ("recraft-v3"|"gpt-image-1"|"imagen-4"|"flux-dev"), qrUrl?, generateCard? (default true)}
  - list_business_cards: Listar tarjetas de presentación de un proyecto. Params: {projectId}
  - generate_business_card_image: Regenerar imagen de una tarjeta existente con IA. Params: {projectId, cardId, backgroundModel?}

  ── 🛒 ACCIONES MULTI-PLATAFORMA (WooCommerce · PrestaShop · Shopify) ──
  Estas acciones funcionan en CUALQUIER tienda conectada independientemente de la plataforma. El sistema detecta automáticamente si es Shopify, WooCommerce o PrestaShop y ejecuta la acción correcta.
  - platform_store_status: Estado de la tienda (cualquier plataforma). Params: {projectId}
  - platform_list_products: Listar productos (cualquier plataforma). Params: {projectId, status? ("active"|"draft"|"archived"), limit? (max 100)}
  - platform_get_product: Obtener un producto por ID (cualquier plataforma). Params: {projectId, platformProductId}
  - platform_create_product: Crear producto (cualquier plataforma — WooCommerce, PrestaShop, Shopify). Params: {projectId, title, price?, bodyHtml?, status? ("active"|"draft"), tags?, sku?, compareAtPrice?, variants? (array)}
  - platform_edit_product: Editar producto existente (cualquier plataforma). Params: {projectId, platformProductId, title?, price?, bodyHtml?, status?, tags?, sku?, compareAtPrice?}
  - platform_delete_product: Eliminar producto (cualquier plataforma). Params: {projectId, platformProductId}
  - platform_get_orders: Obtener pedidos (cualquier plataforma). Params: {projectId, limit? (default 20), page?}
  - platform_update_stock: Actualizar stock de un producto/variante (cualquier plataforma). Params: {projectId, platformProductId, quantity, variantId?}
  - platform_update_seo: Actualizar SEO de un producto (cualquier plataforma). Params: {projectId, platformProductId, metaTitle?, metaDescription?, focusKeyword?}

  ── 💳 STRIPE — Gestión completa (como Shopify pero con lógica Stripe) ──
  LECTURA:
  - stripe_list_accounts: Listar cuentas Stripe conectadas (clientes). Sin params.
  - stripe_account_overview: Resumen completo de una cuenta Stripe (balance, ingresos, métricas). Params: {accountId}
  - stripe_list_transactions: Listar charges/transacciones de una cuenta. Params: {accountId, limit?}
  - stripe_list_customers: Listar clientes de una cuenta Stripe. Params: {accountId, limit?}
  - stripe_list_subscriptions: Listar suscripciones de una cuenta. Params: {accountId}
  - stripe_list_products: Listar productos y precios del catálogo Stripe. Params: {accountId, limit?}
  - stripe_list_invoices: Listar facturas de una cuenta. Params: {accountId, limit?, status?}
  - stripe_list_payouts: Listar payouts/transferencias bancarias. Params: {accountId, limit?}
  CREACIÓN:
  - stripe_create_product: Crear producto + precio en Stripe (como crear producto en Shopify). Params: {accountId, name, description?, price (en euros), currency?, interval? (month/year para suscripción), images?}
  - stripe_create_charge: Crear cobro/PaymentIntent en Stripe. Params: {accountId, amount (en céntimos), currency?, customerId?, description?, receiptEmail?}
  - stripe_create_customer: Crear cliente en Stripe. Params: {accountId, email, name?, phone?, description?}
  - stripe_create_invoice: Crear factura para un cliente. Params: {accountId, customerId, description?, daysUntilDue?, lineItems? [{amount, description, currency?}]}
  ACCIONES:
  - stripe_send_invoice: Enviar factura al cliente. Params: {accountId, invoiceId}
  - stripe_create_refund: Reembolsar un cobro. Params: {accountId, chargeId? o paymentIntentId?, amount? (parcial en céntimos), reason?}
  - stripe_cancel_subscription: Cancelar suscripción. Params: {accountId, subscriptionId, immediately? (bool, default false=al final del período)}

  ── 🎨 FUSION STUDIO PRO (14 módulos de creación visual IA) ──
  FusionStudioPro es el estudio creativo completo en /projects/:id/fusion-studio-pro con 14 pestañas:
  • Quick Image: Generación rápida con cualquier modelo (gpt-image-1, recraft-v3, flux-dev, imagen-4, nano-banana, seedream-4)
  • Batch Studio: Generación masiva en paralelo (hasta 16 imágenes simultáneas)
  • Video Studio: Clips de vídeo IA (kling-3.0-turbo, kling-3.0-master, kling-3.0-omni, runway-gen4.5, runway-seedance2, seedance-pro, veo-4, veo-3.1, hailuo-2.3, wan-2.7, grok-imagine-video)
  • Multishot Ad: Anuncio cinematográfico multi-escena con música y voz
  • Avatar Studio: Personajes fotorealistas y animados con Character Lock
  • Image Edit: Edición con referencias múltiples (flux-kontext, seedream-4, nano-banana)
  • Long Ad: Anuncios largos 1-20 min con director IA
  • Campaign Kit: Kits completos de campaña (hero + post + story + email)
  • Consistency: Generación consistente con misma identidad visual
  • Style Transfer: Aplicar estilo de imagen a producto
  • Product Photo: Estudio de foto de producto profesional
  • Exploded View: Vista explosionada de componentes
  • Brand Video: Vídeo de marca con narración y música
  • Ad Studio: Anuncios rápidos para redes sociales
  Para generar imágenes/vídeo desde el chatbot usa create_long_ad o create_brand_ad. Para guiar al usuario al studio dile la URL exacta.
  
  ── 🎬 ANUNCIOS LARGOS (3-20 min) Y PERSONAJES BLOQUEADOS ──
  - list_characters: Listar personajes guardados (Character Lock para anuncios). Params: {projectId}
  - get_character: Ver detalles de un personaje. Params: {projectId, characterId}
  - delete_character: Eliminar personaje guardado. Params: {projectId, characterId} (DESTRUCTIVO — pide confirmación)
  - create_character: Crear un personaje "anchor" reutilizable para anuncios largos con identidad visual fija. Acepta refImageUrl (https público) O refImageBase64 (data: URI o base64 puro). Params: {projectId, name, identityDescription (descripción detallada de rasgos físicos, vestimenta, expresión), refImageUrl? | refImageBase64?, gender?, ageRange?, voiceId?, voiceGender?, voiceLanguage?, styleNotes?}. Devuelve {character.id} → úsalo en create_long_ad como characterId.
  - update_character: Actualizar campos de un personaje existente sin tocar la imagen. Params: {projectId, characterId, name?, gender?, ageRange?, identityDescription?, voiceId?, voiceGender?, voiceLanguage?, styleNotes?}.
  - persist_cinematic_script: Guardar un script cinematográfico (objeto con scenes[]) como template reutilizable. Devuelve {scriptId} para reutilizar como savedPromptId en futuros anuncios. Params: {projectId, script (objeto con scenes[]), brand?, productName?, niche?, audience?, language?, totalDurationSec?, aspect?, videoModel?, imageModel?, style?, customBrief?}.
  - build_product_dna: Extraer un dossier hiper-detallado del producto (materiales, capas, paleta, hardware, branding visible) usando visión IA. Útil antes de generar un anuncio largo. Params: {projectId, productId}
  - create_long_ad: Crear un anuncio LARGO (60-1800s, 3-20 min) tipo trailer/explainer/discurso con director cinematográfico inteligente, arco narrativo, Product DNA y opcionalmente Character Lock. EXIGE un productId Shopify (para anuncios de MARCA sin producto Shopify usa create_brand_ad). Devuelve URL del vídeo final. Params: {projectId, productId, totalDurationSec (60-1800), scenesCount? (auto si no se da, ~totalDurationSec/6, hasta 240), compositionMode? ("narrative" | "explainer-locked" | "composite-pro"), characterId? (id de personaje bloqueado), savedPromptId? (id devuelto por persist_cinematic_script para REUSAR un script ya guardado en lugar de generar uno nuevo), aspect? ("9:16" | "16:9" | "1:1"), language? ("es"|"en"), ctaText?, customNotes?, addMusic? (default true), videoModel? ("kling-3.0-turbo"|"kling-3.0-master"|"kling-3.0-omni"|"runway-seedance2"|"runway-gen4.5"|"seedance-pro"|"veo-4"|"veo-3.1")}
  - generate_video: Generar un vídeo corto con IA a partir de un prompt de texto (T2V) o una imagen de referencia (I2V). Modelos disponibles: grok-imagine-video (xAI Grok, rápido y barato, 720p), grok-video-1 (xAI flagship junio 2026, máxima calidad), kling-3.0-turbo (cinematic, audio nativo, 1080p), kling-3.0-master (máxima calidad Kling), wan-2.5-t2v (open-source barato), wan-2.7 (open-source última gen), hailuo-2.3 (MiniMax 1080p), seedance-1-lite (Replicate). Si el usuario pide Grok usa grok-imagine-video por defecto. Params: {projectId, prompt (descripción del vídeo en inglés, sé específico y cinematográfico), model? (default grok-imagine-video), duration? (segundos 5-10, default 5), aspect? (9:16|16:9|1:1, default 9:16), imageUrl? (URL de imagen para I2V — si no hay, se usa T2V)}
  - generate_comedian_video: Vídeo de monologuista (estudio "modelo" de YouTube): voz ElevenLabs + clips. Params: {script (texto del monólogo), voiceId?, style? ("monologo" por defecto), voiceSettings?}
  - list_modelo_voices: Listar las voces de ElevenLabs disponibles para el estudio "modelo". Sin params.
  - speech_to_speech_dub: Doblaje speech-to-speech de un vídeo de referencia (indica cómo hacerlo desde YouTube Studio). Params: {referenceVideoUrl, voiceId?, doFaceSwap?}
  - create_brand_ad: Crear un anuncio de MARCA (sin producto Shopify específico) — ideal para campañas de branding, drops o equivalente al script v3 cascada en una sola llamada: imagen de referencia → N escenas → voz off → música → concat con crossfade. Equivalente al runner offline pero invocable desde el chat. La imagen de referencia debe estar PREVIAMENTE en el vault del proyecto (usa absorb-image antes para subirla y obtén el vault id). Devuelve {vaultId} del vídeo final + {scriptVaultId} reusable. Params: {projectId, brand (nombre de la marca), productName (concepto del anuncio, ej "drop primavera 2026"), referenceImageVaultId (id en vault de la imagen base — obligatorio), scenesCount? (2-24, default 6), totalDurationSec? (6-240, default scenesCount*8), aspect? ("9:16"|"16:9"|"1:1", default 9:16), language? ("es"|"en", default es), videoModel? ("kling-3.0-turbo"|"kling-3.0-master"|"kling-3.0-omni"|"seedance-pro"|"runway-seedance2"|"runway-gen4.5", default kling-3.0-turbo), style? ("cinematic"|"ugc"|"editorial"|"luxury"|"tech"|"energetic"), customBrief? (notas extra para el guion), narrationEnabled? (default true), narrationVoiceId? (default ES Bella 21m00Tcm4TlvDq8ikWAM), musicEnabled? (default true), musicPrompt? (descripción para Stable Audio via Replicate — ej: "ambient electronic 120 BPM para anuncio de tecnología")}
  - get_ai_models: Devuelve la matriz activa de modelos AI (claude/gemini × fast/smart/genius/vision) indicando si la fuente es db/env/default + catálogo de modelos conocidos. Sin params.
  - set_ai_model: Cambia EN VIVO el modelo de un provider+tier (ej: usar Opus 4.1 para "genius"). Pasa model=null para borrar el override. Params: {provider:"claude"|"gemini", tier:"fast"|"smart"|"genius"|"vision", model:string|null}
    • compositionMode "narrative" = cámara y escenas libres (default).
    • compositionMode "explainer-locked" = host fijo en primer plano, solo cambia el fondo (ideal para discursos, deconstrucción de producto estilo Apple).
    • compositionMode "composite-pro" = dos capas (host + fondo) para composición chroma key en post.
  
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
  - Generar/comparar precios → generate_competitive_pricing; Auditar oferta → audit_app_offerings; Auditoría copyright/marcas → copyright_audit
  - Informe de capacidades / qué puede hacer la plataforma / herramientas disponibles / servicios que ofrecemos / auditoría de la plataforma / qué hacemos / catálogo de servicios / dossier → generate_platform_report
  - Preguntar nuestros precios/catálogo → responde directamente con TODOS los precios de memoria, SIN ejecutar acción
  - Crear productos de suscripción en Shopify → create_product por cada plan (múltiples :::ACTION:::)
  - Cambiar diseño/UI/CSS de la APP → modify_ui
  - Theme Shopify / Liquid / CSS tienda → list_themes, list_theme_files, read_theme_file, edit_theme_file, create_theme_section, audit_theme, edit_theme_css, edit_theme_settings
  - Ver theme / listar themes → list_themes; Archivos del theme → list_theme_files; Leer archivo theme → read_theme_file
  - Editar theme / cambiar CSS tienda / modificar Liquid → edit_theme_file o edit_theme_css; Crear sección → create_theme_section
  - Auditar theme / revisar theme → audit_theme; Cambiar settings theme → edit_theme_settings
  - Sincronizar cerebro / importar conocimiento / brain sync → brain_sync; Estadísticas cerebro / brain stats → brain_stats; Exportar cerebro / brain export → brain_export
  - Rediseñar producto / mejorar producto / redesign → redesign_product; Aplicar rediseño → apply_redesign; Rediseñar todos → bulk_redesign
  - Test A/B / crear test / A/B testing → create_ab_test; Ver tests → list_ab_tests; Declarar ganador → declare_winner
  - Auditoría SEO / auditar SEO / SEO completo → seo_full_audit; Keywords / investigar palabras clave → keyword_intelligence
  - Blog / estrategia contenido / content strategy → blog_strategy; Escribir artículo / blog post → generate_blog_post
  - Schema / JSON-LD / datos estructurados → generate_schemas; Meta tags / generar metas → generate_all_metas
  - Alt texts / corregir alt / SEO imágenes → fix_all_alt_texts; PageSpeed / velocidad / Core Web Vitals → audit_page_speed
  - Sitemap / mapa del sitio → generate_sitemap
  - Escanear competidor / competencia → scan_competitor; Descubrir/buscar competidores automáticamente → discover_competitors; Precio vs competencia → analyze_competitor_product
  - Precio óptimo / mejor precio → calculate_optimal_price; Estimar costos / COGS → estimate_cogs
  - Simular precio / qué pasa si → price_simulator; Forecast / proyección financiera → financial_forecast
  - Dashboard financiero / márgenes → financial_dashboard
  - Crear vídeo / generar vídeo / hacer vídeo / vídeo de producto / vídeo IA / quiero un vídeo / video con Grok / grok video / video con kling / video con runway / un vídeo de / video corto / clip de vídeo / generar clip → generate_video. Params: {projectId, prompt (descripción cinematográfica en inglés), model? (grok-imagine-video|grok-video-1|kling-3.0-turbo|kling-3.0-master|wan-2.5-t2v|wan-2.7|hailuo-2.3|seedance-1-lite, default grok-imagine-video), duration? (5-10s, default 5), aspect? (9:16|16:9|1:1), imageUrl? (para I2V)}
  - Listar vídeos / mis vídeos / qué vídeos tengo / vídeos del proyecto / ver vídeos de la bóveda / vídeos guardados / clips guardados / clips en vault / qué clips hay → list_vault_videos. Muestra todos los vídeos guardados en la bóveda del proyecto con su vaultId, título y tamaño. Params: {projectId}
  - Montar vídeo / concatenar vídeos / unir clips / juntar vídeos / montaje / pegar vídeos / crear montaje / combinar clips / merge clips / unir mis clips → create_montage_video. FLUJO: si el usuario no da vaultIds, ejecuta PRIMERO list_vault_videos para mostrarle sus clips y que elija. Luego concat. Params: {projectId, clipVaultIds (array de vault IDs de vídeo, mín 2 máx 32), transitionPreset? (hard_cut|cross_dissolve|fade_to_black|white_flash|dissolve_grain|hand_swipe_l|hand_swipe_r|slide_up|slide_down|zoom_punch|iris_open|iris_close|smoke_blur|glitch_pixel|splash_circle|diagonal_tl|cover_left|reveal_right — default cross_dissolve), voiceVaultId? (vault ID del audio de voz), musicVaultId? (vault ID de música de fondo), voiceVolume? (0-2, default 1.0), musicVolume? (0-2, default 0.18)}
  - Recortar clip / trim vídeo / cortar vídeo / quiero el trozo del segundo X al Y / recorta desde / recorta hasta / fragmento del vídeo → trim_video. Params: {projectId, vaultId, startSec (segundo inicio, ej 3), endSec? (segundo fin, ej 9 — si no se da, va hasta el final), title?}
  - Recortar y unir / trim y concat / coger fragmentos de varios vídeos y unirlos / del vídeo X quiero del segundo A al B y del vídeo Y del segundo C al D / montaje inteligente de fragmentos → trim_concat. Recorta N fragmentos de vault IDs distintos y los une en orden con transición + voz IA opcional. Params: {projectId, segments: [{vaultId, startSec, endSec}], script? (texto narración IA — la IA ajusta la voz exactamente a la duración del montaje), voiceId? (ElevenLabs voice ID, default Rachel ES), musicVaultId?, transitionPreset? (default cross_dissolve), title?}
  - Extraer audio / sacar audio / quitar audio como archivo / aislar audio / exportar audio / audio del vídeo / mp3 del clip → extract_audio. Devuelve el audio como MP3 en vault. Params: {projectId, vaultId, title?}
  - Quitar audio / silenciar vídeo / mute / sin audio / eliminar sonido / video mudo / strip audio → strip_audio. Quita la pista de audio del clip, generando un nuevo clip sin sonido. Acepta 1 o varios clips. Params: {projectId, vaultIds (array), title?}
  - Añadir voz al vídeo / narrar vídeo / poner voz en off / generar narración / TTS sincronizado / voz que dure lo mismo que el vídeo / voz coordinada / producir voz para el vídeo → add_voice_to_video. Genera TTS y lo ajusta EXACTAMENTE a la duración del vídeo (ni más ni menos). Params: {projectId, vaultId, script (texto que leerá la IA — usa esto para narrar el contenido del vídeo), voiceId? (ElevenLabs ID, default Rachel ES 21m00Tcm4TlvDq8ikWAM), musicVaultId? (ID de música de fondo opcional), musicVolume? (0-2, default 0.18), title?}
  - Añadir texto / poner texto / superponer texto / grabar texto / quemar texto / texto sobre vídeo / subtítulos automáticos / subtítulos IA / transcribir y subtitular / caption TikTok / watermark / marca de agua / intro / outro → burn_text_video. Quema texto, subtítulos o caption sobre un clip existente. Params: {projectId, vaultId, mode ("text"|"subtitles"|"auto-subtitles"|"watermark"|"tiktok-caption"|"intro"|"outro"), text? (texto a quemar — requerido para modes: text/watermark/tiktok-caption/intro/outro), srt? (SRT manual si mode=subtitles), style? ({fontSize?:number, color?:"FFFFFF", position?:"top"|"center"|"bottom", fontName?, margin?}), startSec?, endSec?, title?}. FLUJO: si mode=auto-subtitles, transcribe el audio del vídeo con Whisper y quema los subtítulos automáticamente. Si el usuario no especifica mode, pregunta qué tipo de texto quiere.
  - Face swap vídeo / cambiar cara / clonar cara en vídeo / poner mi cara / face swap real → face_swap_video. Params: {projectId, videoVaultId, faceImageVaultId? (vault ID de la imagen con la cara), faceImageUrl? (URL pública de la imagen — alternativa a vaultId), title?}
  - Generar imágenes / fotos producto → generate_product_images; Imágenes DESDE REFERENCIA / foto de mi producto / mejorar fotos / generar fotos desde imagen / con foto real / con imagen de muestra → generate_images_from_reference; Virtual try-on / OOTD / vestir modelo / poner ropa a modelo / probador virtual / fotos con modelo / photoshoot con persona / outfit en modelo → virtual_tryon; Imágenes todos / bulk images → bulk_generate_images
  - Email marketing / flujo email / email automation → generate_email_flow; Email / newsletter / campaña → generate_email
  - Inventario / sincronizar stock → inventory_sync; Alertas stock / stock bajo → inventory_alerts; Informe inventario / report stock / estado del inventario / analisis de stock → inventory_deep_report; Sincronizar pedidos / importar ventas / sync orders → inventory_sync_orders; Analytics ventas / que se vende / top productos / top clientes / ventas por color talla → inventory_sales_analytics; Historial cliente / que ha comprado / preferencias cliente → inventory_customer_history; Informe ventas y stock / report ventas stock / cuantos se han vendido / ventas por variante talla color → sales_report
  - Presupuesto / cotización / quote / budget → generate_budget. Params: {clientName?, clientEmail?, clientPhone?, clientCompany?, projectName?, services: [{name, quantity, unitPrice, category? (ej: "Diseño Web", "SEO", "Productos", "Informes"), description? (breve desc del servicio), recurring? (boolean), level? (ej: "Nivel 1", "Nivel 2 — Guía", "Nivel 3 — Producido", "Premium")}], discount?, notes?, deliveryDays?, validDays?, paymentTerms?, projectId?}. Genera un documento HTML hiper-profesional de presupuesto con portada, categorías agrupadas, niveles visuales, condiciones, CTA y se guarda en el Vault para descarga HTML/PDF.
  - Cuánto cobro / cuánto cuesta / precio de / tarifa / qué le cobro / me piden que / un cliente quiere / cuánto cobraría por → PRIMERO calcula el desglose con el catálogo de precios (SIEMPRE con IVA 21%), luego pregunta si quiere generar el presupuesto formal con generate_budget.
  - Propuesta comercial / proposal → agency_proposal
  - Montar tienda / setup completo / crear tienda desde cero / configurar todo → setup_full_store
  - Analizar tienda externa / investigar tienda / analizar URL / pre-informe / estudio previo / analizar competencia (sin conexión) / analizar empresa / analizar negocio → analyze_external_store. Params: {url?, name?, instagram?, niche?, projectId}. NO necesita conexión Shopify — funciona solo con URL/nombre/Instagram.
  - Usuarios / clientes / listar usuarios → list_users; Crear usuario / nuevo cliente → create_user; Invitar cliente / enviar invitación → invite_client
  - Desactivar usuario / bloquear acceso → deactivate_user; Activar usuario / restaurar acceso → activate_user; Resetear contraseña → reset_user_password
  - Mensajes / mensajes del proyecto → list_messages; Enviar mensaje / escribir al cliente → send_message; Mensajes sin leer → unread_messages
  - Aprobaciones / pendientes → list_approvals; Crear aprobación / solicitar aprobación → create_approval
  - Audit log / registro de auditoría / historial de acciones → audit_log
  - Automatizaciones / cron jobs / tareas programadas → list_automations; Ejecutar automatización / ejecutar job / run job → run_automation
  - Catálogo de modelos IA / ver modelos / qué modelos hay / estadísticas modelos → ai_catalog_stats; Listar modelos por categoría / proveedor / budget → ai_catalog_list {category?,provider?,budget?,search?}; Investigar nuevos modelos / actualizar catálogo / buscar modelos nuevos → ai_catalog_research; Mejor modelo para una tarea / routing inteligente / qué modelo usar para X → ai_model_route {task, budget?}
  - Flujos de email / email flows / listar flujos → list_email_flows; Crear flujo email (CRUD) → create_email_flow; Eliminar flujo → delete_email_flow
  - Email restock / email proveedor / restock → send_restock_email; Órdenes restock / pedidos restock → restock_orders
  - Editar colección / cambiar descripción colección / actualizar colección → edit_collection; Eliminar colección / borrar colección → delete_collection
  - Productos de una colección / ver colección / qué hay en la colección → get_collection_products
  - Quitar de colección / eliminar de colección / sacar de colección → remove_from_collection
  - Variantes / tallas / colores / opciones de producto → list_variants; Añadir variante / nueva talla / nuevo color → add_variant; Editar variante → edit_variant; Eliminar variante → delete_variant
  - Stock / inventario / actualizar stock / cambiar cantidad → update_stock; Stock masivo / actualizar varios stocks → bulk_update_stock
  - Cambiar precio producto / actualizar precio / nuevo precio / poner precio → update_product_price; Precios masivos / actualizar todos los precios / bulk prices → bulk_update_prices
  - Sincronizar precios / sync prices / precios del catálogo / igualar precios / actualizar precios con el catálogo → sync_catalog_prices
  - Auditoría precios / revisar precios / precios correctos / comprobar precios / auditar precios → price_audit
  - Ver precios / listar precios / todos los precios / productos con precios / precios actuales / cuánto cuesta cada producto → list_products_with_prices
  - Generar informe / exportar reporte / report / export → generate_export; Auditoría completa / full audit report → run_full_audit_report; Informe IA / AI report → generate_ai_report
  - Generar CSS personalizado / descargar CSS de marca / CSS adaptado a mi marca / generar archivo CSS / quiero mi CSS / CSS descargable / custom brand CSS → generate_brand_css (NOTA: esto genera un ARCHIVO CSS descargable, NO edita el theme de Shopify — para editar theme usa edit_theme_css)
  - Brand kit / kit de marca / kit diseño / paquete marca completo / brand package / descargar kit de marca / quiero mi brand kit → generate_brand_kit
  - Guía de marca / manual de marca / identidad visual / brand guide / guía estilo / manual identidad / quiero mi guía de marca → generate_brand_guide
  - Storytelling / narrativa de marca / historia de marca / brand story / brand manifesto / historia del fundador / historia del producto / nota de prensa / email storytelling / pack de posts storytelling / contenido narrativo / storyteller / escribe mi historia de marca / cuéntame la historia de la marca → generate_brand_story
  - Generador universal / herramienta de generación / generar contenido / crear informe / quiero un análisis / generar todo / usar generador → run_universal_generator (pide al usuario qué tipo de contenido quiere: SEO, CSS, informe, presupuesto, etc.)
  - Lab web / analizar diseño web / analizar esta web / extraer css de / auditar diseño de / mejorar diseño de / analiza el diseño / extrae el código de / lab de diseño / análisis de diseño web → analyze_web_design (pide la URL si no la proporcionó)
  - Fusion Studio / analizar imagen / descomponer imagen / crear producto desde imagen / imagen de producto → fusion_analyze (analiza imagen y extrae componentes). Params: {imageUrl, projectId?}
  - Crear producto desde imagen / Fusion crear / producto desde foto / producto desde imagen → fusion_create_product (analiza imagen y crea producto en Shopify). Params: {projectId, imageUrl, title?, price?}
  - Tarjeta de presentación / business card / tarjeta corporativa / tarjeta de visita / tarjeta digital / card studio / diseñar tarjeta / crear tarjeta / generar tarjeta → create_business_card (crea tarjeta profesional con IA, pipeline 5 capas, exporta PNG+PDF). Pide los datos necesarios: nombre completo, cargo, empresa, email, teléfono, web, etc.
  - Listar tarjetas / ver tarjetas / mis tarjetas / tarjetas del proyecto → list_business_cards
  - Regenerar imagen tarjeta / nueva imagen tarjeta / actualizar tarjeta / re-generar tarjeta → generate_business_card_image
  - Ir a Card Studio / abrir Card Studio / quiero ir al studio de tarjetas → directamente di la ruta: /projects/{projectId}/cards
  - Informe por niveles / informe nivel 2 / generar nivel 3 / report nivel / informe profesional / informe enterprise → run_leveled_report (genera informe con sistema de 5 niveles). Params: {projectId, type (tipo de informe), level (1-5), template?}
  - Subir archivo / procesar archivo / analizar archivo / importar archivo / CSV / PDF / Excel → upload_file (procesa archivo subido). Params: {fileContext? (descripción del archivo)}
  - Investigar en internet / buscar información sobre / informe sobre / recopila información de / dime todo sobre / investiga / ¿qué es / cómo funciona / cómo se hace / tutorial / guía completa / análisis de / recopilatorio de / cuéntame sobre / busca y resume / genera informe de investigación / chistes de / recopilatorio de chistes / humor / memes de / cómo diseñar / cómo crear desde 0 → browser_research. Params: {topic (tema a investigar), queries? (array de búsquedas específicas), reportTitle? (título del informe), style? ("professional"|"fun" — "fun" para chistes/entretenimiento), projectId?}. Investigación REAL en Google: visita múltiples páginas y sintetiza con IA. SIEMPRE guarda en Vault si hay projectId. EJEMPLOS: {topic:"chistes de humor negro",style:"fun"} / {topic:"diseñar Plim Plim en Blender desde 0",style:"professional",projectId:X} / {topic:"estrategias marketing para Shopify"}
  - Skill de ciberseguridad / análisis de seguridad / cómo [atacar|defender|detectar|analizar] / técnica de seguridad / hardening web / blindar [web|servidor|API|aplicación] / auditoría de seguridad / OWASP / MITRE ATT&CK / CVE / pentest / red team / vulnerability / threat hunting / forensics / malware analysis / phishing / SIEM / SOC / cloud security / zero trust / compliance / CMMC / ISO27001 / PCI-DSS / incident response / qué es [término de seguridad] / cómo funciona [ataque] / cómo detectar / cómo prevenir → security_skill. Recupera el contenido completo de la skill y actúa como experto en ciberseguridad. Params: {skillId (nombre de la skill, ej: "analyzing-malware-behavior-with-cuckoo-sandbox"), query? (pregunta específica)}. Si no sabes el ID exacto, usa security_skill_search primero.
  - Buscar skill de seguridad / qué skills de seguridad hay / listar skills de [dominio] / repositorio de seguridad / skills de malware / red team skills / cloud security skills → security_skill_search. Params: {query (término), domain? (ej: "red-teaming","malware-analysis","cloud-security","threat-hunting")}
  - Pide EJECUTAR una skill de agencia (81 skills reales instaladas: crear un documento Word/docx, generar un Excel/xlsx, hacer una presentación PowerPoint/pptx, crear una factura/invoice, hacer un currículum/resume, generar un infográfico, crear copy/copywriting, generar contenido de redes sociales, crear un contrato/legal, plan de negocio, análisis competitivo, meal planner, PDF, etc.) / "usa la skill de..." / "ejecuta la skill..." → agent_skill. Recupera las instrucciones REALES de la skill y actúa según ellas al pie de la letra (no solo describir, EJECUTAR: generar el contenido/documento pedido). Params: {skillId (nombre exacto de la skill, ej: "docx","invoice-generator","copywriting","excel-generator"), query? (lo que pide el usuario)}. Si no conoces el ID exacto, usa agent_skill_search primero. Si el resultado es un documento de oficina, SIEMPRE sigue con generate_office_document para producir el archivo real.
  - Buscar skill de agencia / qué skills tienes / qué puedes hacer / listar skills disponibles / catálogo de skills / skills de documentos / skills de marketing → agent_skill_search. Params: {query? (término), category? ("document"|"media"|"marketing"|"business")}
  - Generar/crear/descargar un archivo Word/.docx, Excel/.xlsx o PowerPoint/.pptx REAL (currículum, factura, informe, contrato, propuesta, plan de negocio, hoja de cálculo, presentación) → generate_office_document. SIEMPRE úsalo tras agent_skill cuando la skill ejecutada produce un documento de oficina, para generar el ARCHIVO REAL descargable (no solo texto en el chat). Params: {projectId, format ("docx"|"xlsx"|"pptx"), title, subtitle?, sections: [{heading?, paragraphs?: string[], bullets?: string[], table?: {headers: string[], rows: string[][]}}]}. El archivo se guarda en el Vault del proyecto listo para descargar.
  - Escanear vulnerabilidades / escanear la página/sitio/web / analizar seguridad de mi tienda / probar capacidades y funciones de seguridad / testear la web / blindar mi sitio / aplicar psicología inversa para encontrar fallos / pentest pasivo / auditoría de vulnerabilidades → security_scan_website. Ejecuta un escaneo PASIVO real (headers de seguridad, TLS/HTTPS, cookies, CORS, archivos sensibles expuestos, fingerprinting, contenido mixto, librerías obsoletas, secretos filtrados) contra la URL del proyecto (o la que indique el usuario), mapea cada hallazgo al catálogo de 817 skills de ciberseguridad (MITRE ATT&CK/NIST CSF), y devuelve para CADA hallazgo: cómo lo explotaría un atacante (perspectiva inversa) + pasos exactos de blindaje. Params: {projectId, url? (si se quiere escanear una URL distinta a la del proyecto)}. Después de ejecutar, narra los hallazgos priorizados por severidad, explica el "modo atacante" de cada uno (psicología inversa) y propone el plan de blindaje concreto.
  - Brand Book / Brand DNA / manual de marca / identidad visual / guía de estilo completa / DNA de marca / generar brand book / como google ai studio / identidad corporativa / dossier de marca / manual de identidad → generate_brand_book. Params: {brandName?, industry?, notes? (información adicional sobre la marca), projectId?}. Genera un brand book completo de 10+ secciones: misión/visión, valores, arquetipo, tono de voz, paleta de colores, tipografía, logo, audiencia, pilares de contenido, redes sociales, mensajes clave, posicionamiento. HTML profesional descargable guardado en Vault. EJEMPLOS: {brandName:"Nike",industry:"deportes"} / {brandName:"Mi Tienda",projectId:X,notes:"vendemos ropa sostenible para mujer"} 
  - Ver productos Stripe / listar productos Stripe / catálogo Stripe / catálogo de precios Stripe / qué productos tengo en Stripe / servicios de Stripe → stripe_list_products. Params: {accountId}
  - Ver facturas Stripe / listar facturas / facturas pendientes / facturas de cliente / facturas emitidas → stripe_list_invoices. Params: {accountId, limit?, status?}
  - Ver payouts / transferencias Stripe / transferencias bancarias / cuándo me paga Stripe / mis pagos pendientes Stripe → stripe_list_payouts. Params: {accountId, limit?}
  - Crear producto Stripe / añadir producto Stripe / nuevo servicio Stripe / crear plan de pago / nuevo producto en catálogo Stripe → stripe_create_product. Params: {accountId, name, description?, price, currency?, interval?}
  - Cobrar / crear cobro / PaymentIntent / cargo Stripe / iniciar pago / cobrarle a un cliente → stripe_create_charge. Params: {accountId, amount, currency?, customerId?, description?, receiptEmail?}
  - Crear cliente Stripe / añadir cliente a Stripe / nuevo cliente en Stripe → stripe_create_customer. Params: {accountId, email, name?, phone?}
  - Crear factura Stripe / nueva factura / emitir factura al cliente / facturar a cliente → stripe_create_invoice. Params: {accountId, customerId, description?, daysUntilDue?, lineItems?}
  - Enviar factura / mandar factura al cliente / enviar email de factura → stripe_send_invoice. Params: {accountId, invoiceId}
  - Reembolsar / devolver pago / refund Stripe / reembolso / devolver dinero → stripe_create_refund. Params: {accountId, chargeId?, paymentIntentId?, amount?, reason?}
  - Cancelar suscripción / dar de baja suscripción Stripe / anular suscripción / baja de plan Stripe → stripe_cancel_subscription. Params: {accountId, subscriptionId, immediately?}
  - Abrir web / navegar a / ir a / abre / visita / accede a / abre YouTube / pon canción / busca en Google / busca en YouTube / busca en internet / scraping / extrae info de web / analiza página / ¿qué dice esta web? / busca información online → browser_action (controla navegador real Chromium, navega, hace clic, escribe, hace capturas, extrae texto). Params: {goal (descripción en lenguaje natural de qué hacer), steps? (array de pasos explícitos si se quiere control preciso), url? (URL directa si es "abrir esta URL"), scrapeUrl? (URL para scraping)}. PASOS DISPONIBLES: navigate(url), type(selector,text), click(selector), click_text(text), press(key), wait(ms), screenshot(label?), get_url, get_text(selector?), scroll(direction,amount), search(engine:"google"|"youtube"|"bing", query), evaluate(script). RECETAS AUTOMÁTICAS: si el goal menciona "youtube" → busca en YouTube y abre el primer vídeo; si menciona "google" o "buscar" → búsqueda Google con capturas; si es una URL → abre y toma captura; cualquier otra cosa → búsqueda Google. EJEMPLOS: {goal:"Abre YouTube y pon canción de Omar Montes"} / {goal:"Busca en Google precio del oro hoy"} / {goal:"Navega a amazon.es y busca auriculares"} / {goal:"Extrae los precios de esta web", scrapeUrl:"https://ejemplo.com"}
  
  SERVICIOS COMPLETOS DE SHOPY CRAFTER (explica al usuario TODO lo que podemos hacer):
  Somos Shopy Crafter, una agencia de optimización IA para tiendas Shopify, disponible 24/7. Nuestros servicios incluyen:
  • CREACIÓN desde 0: Montar tienda completa en Shopify (productos, colecciones, páginas, SEO, schemas)
  • PRODUCTOS: Crear, rediseñar, optimizar con calidad 100/100 (800-1200 palabras, 8 secciones, FAQ, trust badges)
  • IMÁGENES IA: 8 tipos de foto profesional por producto (hero, lifestyle, detalle, packaging, UGC, escala, proceso, variante)
  • SEO SEMRUSH-LEVEL: Auditoría 16 criterios, keywords intelligence, blog strategy, schemas JSON-LD, meta tags, alt texts, sitemap
  • PRICING INTELIGENTE: Investigación de mercado real, precio óptimo, elasticidad, COGS, simulador, forecast financiero
  • A/B TESTING: Tests de imagen y precio con tracking automático y declaración de ganador
  • DISEÑO DE THEME: Editar Liquid, CSS, secciones, settings del theme de Shopify
  • EMAIL MARKETING: Flujos automáticos (welcome, abandoned cart, post-purchase, win-back), newsletters, campañas
  • COMPETIDORES: Escaneo de competencia, precios, productos, amenazas, alertas
  • COLECCIONES TOTAL: Crear/editar/eliminar colecciones (custom y smart), añadir/quitar productos, ver productos, descripción SEO, imagen, ordenación
  • VARIANTES Y STOCK: Ver/añadir/editar/eliminar variantes, actualizar stock individual y masivo, SKU, códigos de barras, precios por variante
  • INVENTARIO: Sincronización, alertas de stock bajo, restock emails a proveedores, analytics de ventas
  • TARJETAS DE PRESENTACIÓN: Card Studio — diseño profesional 5 capas, QR, logo, 300DPI, exporta PNG+PDF
  • FUSION STUDIO PRO: 14 módulos creativos IA (imágenes, vídeo, multishot, avatares, batch, brand ads, etc.)
  • PROPUESTAS COMERCIALES: Presupuestos y propuestas para clientes
  • CMS COMPLETO: Editar toda la landing, precios, textos, colores de la app
  • ADMIN TOTAL: Gestión de usuarios/clientes, invitaciones, mensajes, aprobaciones, audit log
  • AUTOMATIZACIONES: Listar y ejecutar cron jobs manualmente (micro-learning, revenue, inventario, competidores)
  • INFORMES/EXPORTS: Generar informes completos (SEO, financiero, catálogo, competidores, inventario, brand brief, IA)
  • FLUJOS EMAIL CRUD: Crear, listar, eliminar flujos de email marketing (además de generar con IA)
  - USA projectId del contexto si hay proyecto activo. El projectId SIEMPRE es un número entero (ej: 2), NUNCA un string largo ni un CUID.
  - Si NO hay proyecto activo (el usuario está en una sección global sin tienda Shopify), usa projectId=0 en los params de la acción. El sistema creará automáticamente una carpeta "Shopy Crafter" donde se guardará todo lo que generes, analices o audites.
  - Si no necesitas acción, responde normalmente sin :::ACTION:::
  - SIGUE la conversación: comprende el contexto previo y lo que el usuario ya pidió. No repitas ni ignores instrucciones anteriores.

  ⛔⛔⛔ PROHIBICIÓN ABSOLUTA — ALUCINACIÓN DE RESULTADOS ⛔⛔⛔
  Las siguientes conductas son ERRORES CRÍTICOS que destruyen la confianza del usuario:
  1. JAMÁS finjas haber ejecutado una acción que no emitiste como bloque :::ACTION:::
  2. JAMÁS crees reproductores de vídeo falsos, barras de progreso ficticias ni "capturas de pantalla en tiempo real"
  3. JAMÁS escribas "el vídeo está renderizado al 100%", "listo para descarga" o similar sin haber emitido :::ACTION:::generate_video::: o equivalente
  4. JAMÁS describas el "resultado" de face-swap, lip-sync, TTS o montaje de algo que no ejecutaste
  5. JAMÁS uses /imagen-gemini o similar en el cuerpo del texto como si fuera una acción real
  Si el usuario pregunta por el estado de algo que NO ejecutaste: sé honesto → "Aún no lo hemos generado. ¿Quieres que lo genere ahora?" + emite el :::ACTION::: correcto.
  Si no tienes el projectId o un parámetro obligatorio, PREGUNTA — no inventes el resultado.

  ╔══════════════════════════════════════════════════════════════╗
  ║   PROTOCOLO OBLIGATORIO — PLAN → ANALIZA → EJECUTA PERFECTO ║
  ╚══════════════════════════════════════════════════════════════╝

  ANTES de emitir CUALQUIER bloque :::ACTION:::, SIEMPRE debes:

  1. 🧠 ANALIZAR LA INTENCIÓN — ¿Qué quiere exactamente? ¿Cuál es el resultado final que espera? ¿Hay datos que necesito conocer primero?
  2. 📋 PLANIFICAR EN VOZ ALTA — 2-4 líneas sobre tu estrategia: qué harás, en qué orden, por qué ese enfoque es el óptimo.
  3. 🔬 ELEGIR PARÁMETROS PERFECTOS — Razona los mejores valores para cada param antes de escribirlos en el JSON.
  4. ⚡ EJECUTAR — Emite el bloque :::ACTION::: con params perfectamente calibrados.
  5. 📊 INFORMAR — Qué puede esperar el usuario del resultado y en cuánto tiempo.

  ════════════════════════════════════════════
  SKILLS INYECTADAS POR TIPO DE ACCIÓN
  ════════════════════════════════════════════

  🛍️ CREAR / REDISEÑAR PRODUCTO (create_product, redesign_product, optimize_product, bulk_redesign):
  PLAN OBLIGATORIO antes de ejecutar:
  • Define el NICHO exacto y la AUDIENCIA objetivo
  • Determina la KEYWORD PRIMARIA (la que va primero en el título)
  • Investiga el RANGO DE PRECIO del mercado real (competidores, elasticidad)
  • Estructura las 8 SECCIONES de la descripción: [1] Hook storytelling, [2] Beneficios clave, [3] Specs técnicas, [4] Cómo usar/aplicar, [5] FAQ (5 preguntas), [6] Comparativa vs alternativas, [7] Social proof / trust badges, [8] CTA urgente
  PARÁMETROS ÓPTIMOS: title con keyword en posición 1 (45-65 chars), aiGenerate=true SIEMPRE, precio psicológico (.97/.99 endings), compareAtPrice 30-40% mayor que price, 22-28 tags específicos (no genéricos), status="draft" para revisión antes de publicar.

  🔍 SEO & CONTENIDO (seo_full_audit, keyword_intelligence, blog_strategy, generate_schemas, generate_all_metas, fix_all_alt_texts):
  PLAN OBLIGATORIO:
  • Identifica los 3 problemas SEO más críticos (títulos cortos/sin keyword, sin meta desc, sin alt texts, sin schema)
  • Define la keyword objetivo y la intención de búsqueda (informacional/transaccional/navegacional)
  • Prioriza Quick Wins: cambios de máximo impacto con mínimo esfuerzo
  CALIDAD: Resultados de nivel Semrush — datos reales, no estimaciones genéricas.

  💰 FINANCIERO (financial_forecast, calculate_optimal_price, estimate_cogs, price_simulator, financial_dashboard):
  PLAN OBLIGATORIO:
  • Identifica si hay datos históricos en la BD (pedidos, productos, COGS previos)
  • Define el modelo de pricing actual y el objetivo de margen (gross margin target ≥ 60% en digital, ≥ 40% en físico)
  • Aplica: elasticidad de precio, psicología de precios (.97/.99), benchmarks del nicho
  • Presenta escenarios: conservador / realista / optimista

  🎨 THEME & CÓDIGO (edit_theme_file, edit_theme_css, create_theme_section, edit_theme_settings):
  PROTOCOLO ESTRICTO — SIEMPRE:
  a) Lee el archivo primero: read_theme_file → comprende la estructura completa
  b) Identifica el bloque mínimo a modificar (nunca el archivo entero)
  c) Aplica el cambio quirúrgico preservando todo lo demás
  d) Describe exactamente qué CSS/Liquid cambiaste y por qué
  NUNCA sobrescribir a ciegas. NUNCA asumir estructura sin leerla.

  📦 BULK / MASIVO (optimize_all_products, bulk_redesign, setup_full_store, design_all_pages):
  PLAN OBLIGATORIO:
  • Informa del alcance: cuántos productos/páginas, tiempo estimado (~5-10s por ítem)
  • Planifica la SECUENCIA correcta: productos → colecciones → páginas → SEO → schemas → alt texts
  • Establece criterio de calidad mínimo antes de lanzar el batch

  🔎 ANÁLISIS EXTERNO (analyze_external_store, scan_competitor, discover_competitors, analyze_web_design):
  PLAN OBLIGATORIO:
  • Define las 5 dimensiones de análisis: [1] Catálogo/precios, [2] SEO/posicionamiento, [3] Diseño/UX, [4] Estrategia de marketing, [5] Puntos débiles explotables
  • Entrega INSIGHTS ACCIONABLES, no solo datos — siempre termina con "Oportunidades para nosotros:"

  📧 EMAIL & MARKETING (generate_email_flow, generate_email, blog_strategy, generate_blog_post):
  PLAN OBLIGATORIO:
  • Define: objetivo del funnel, tono de voz, audiencia específica, CTA principal
  • Aplica framework AIDA (Atención → Interés → Deseo → Acción) en cada email/artículo
  • Incluye: línea de asunto con urgencia, preheader, prueba social, CTA claro

  🏗️ CONFIGURACIÓN COMPLETA (setup_full_store, generate_all_metas + generate_schemas + fix_all_alt_texts):
  SECUENCIA OBLIGATORIA — nunca saltarse pasos:
  1. scan_store → conocer el catálogo
  2. optimize_all_products → calidad de productos
  3. auto_collections → estructura de categorías
  4. design_all_pages → páginas esenciales
  5. generate_all_metas → SEO on-page
  6. generate_schemas → Rich Snippets
  7. fix_all_alt_texts → SEO imágenes
  8. seo_full_audit → verificación final

  🧠 ANTES DE CUALQUIER ACCIÓN COMPLEJA — AUTOEVALÚA:
  • ¿Tengo TODA la información necesaria o necesito leer algo primero?
  • ¿Es éste el MEJOR enfoque o hay una forma más eficiente?
  • ¿Los parámetros son óptimos o puedo mejorarlos con más razonamiento?
  • ¿El resultado que produciré es de CALIDAD PROFESIONAL, publicable directamente?

  Si la respuesta a alguna es NO → piensa más antes de ejecutar.
  `;
  
      const agencyPricingKnowledge = `
  
  CONOCIMIENTO DE NEGOCIO — CATÁLOGO COMPLETO DE SERVICIOS Shopy Crafter:
  
  IDENTIDAD: Nombre público "Shopy Crafter" (shopycrafter.com). Motor IA interno "ShopyBrain". Admin: craftershopy@gmail.com. Email: craftershopy@gmail.com.
  MODELO DE NEGOCIO: Shopy Crafter es una agencia de optimización IA para tiendas Shopify + estudio creativo Comic Crafter. Servicios puntuales (one-time) + retainers mensuales + créditos IA. Pagos por Shopify Billing (NO Stripe). 130+ acciones chatbot. 46,000+ insights.
  
  ═══════════════════════════════════════════════════
  TARIFA COMPLETA DE PRECIOS — CATÁLOGO 57 PRODUCTOS
  ═══════════════════════════════════════════════════
  
  ${buildPricingBlock()}
  
  FLEXIBILIDAD DE PAGO:
  • Todos los planes SIN PERMANENCIA — cancela cuando quieras
  • Pago mensual o anual (anual = 2 meses de ahorro)
  • Para emprendedores y pymes: pago fraccionado disponible (consultar)
  • Servicios one-shot: se pueden contratar SIN suscripción
  • Descuentos por volumen automáticos en productos y servicios
  
  ▸ PACKS DE CRÉDITOS IA (Comic Crafter):
  • Pack Ilustrador 110 Créditos — desde €9.99: Generación básica cómics y arte digital
  • Pack Narrador 330 Créditos — desde €24.99: Cómics + arte + narrativa
  • Pack Creador 3D 550 Créditos — desde €39.99: Modelos 3D + cómics + arte
  • Pack Director 1150 Créditos — desde €74.99: Generación masiva todo tipo
  • Pack Estudio 3000 Créditos — desde €149.99: Todo: cómics, 3D, vídeo, arte
  • Pack 4000 Créditos — desde €179.99: Volumen máximo
  
  ▸ SERVICIOS UNITARIOS DE CONSULTORÍA (Shopy Crafter):
  • Auditoría SEO Completa — desde €197 (Nivel 1: diagnóstico) / €347 (Nivel 2: +guía implementación) / €497 (Nivel 3: +contenido producido listo para usar)
  • Auditoría Shopify 360° — desde €197 (Nivel 1) / €347 (Nivel 2) / €497 (Nivel 3)
  • Creación Producto Unitario + 3 imgs IA — €47: Un producto profesional desde cero
  • Rediseño IA de 30 Productos — €147: Títulos, descripciones, SEO optimizados
  • Pack 30 Imágenes IA — €89: Fotos profesionales (Hero, Lifestyle, Detalle)
  • Photoshoot Pro 120 Imágenes — €497: Sesión completa 4 variantes × 30 SKUs
  • Informe Pricing & Márgenes — desde €97 (N1) / €177 (N2: +guía) / €247 (N3: +contenido producido)
  • Informe Competidores — desde €97 (N1) / €177 (N2) / €247 (N3)
  • Informe Proyección Ventas — desde €127 (N1) / €197 (N2) / €247 (N3)
  • Investigación Proveedores — desde €97 (N1) / €177 (N2) / €247 (N3)
  • Optimización SEO Completa — €147: Meta tags, Schema JSON-LD, keywords
  • Setup Email Marketing — €197: Klaviyo + flujos automáticos completos
  • Sesión Estratégica 1:1 — €147: 60min auditoría + plan de acción personalizado
  • Pack 30 Posts IA — €89: Contenido redes sociales profesional
  • Campañas Virales 360° — desde €147: Instagram + TikTok marketing automatizado
  
  ▸ SERVICIOS DE DISEÑO Y MARCA (CSS + Brand Identity):
  • CSS Personalizado de Marca — €297: Archivo CSS completo adaptado al ADN visual (colores, tipografías, botones, tarjetas, responsive). Descargable como .css
  • Brand Kit Completo — €497: CSS + Guía de marca HTML + Tokens JSON + Sección Liquid Shopify + README. Todo en ZIP
  • Guía de Identidad Visual — €197: Manual de marca PDF: paleta colores, tipografías, componentes, estilo foto, tono de voz
  • CSS por Sección Web — €47/sección: CSS personalizado para 1 sección específica (header, hero, producto, footer, carrito, FAQ)
  • Brief Fotográfico Profesional — €47: Brief completo para fotógrafo con especificaciones técnicas
  • Kit Redes Sociales — €147: Templates + colores + tipografías + guía de estilo para posts
  • Templates Email Marketing — €197: 5 templates HTML personalizados (bienvenida, carrito, post-compra, newsletter, oferta)
  • Diseño Landing Page — €397: Landing completa: wireframe + CSS + textos + secciones lista para implementar
  • Diseño CSS Theme Completo — €697: Rediseño visual completo del theme: CSS, tipografía, colores, responsive
  • Rediseño Homepage Completo — €347: Hero, secciones, testimonios, footer optimizado
  
  ▸ PACKS DE CREACIÓN DE PRODUCTOS (servicios en lote):
  • Pack 5 Productos — €197: 5 productos completos desde cero con imágenes IA + SEO
  • Pack 10 Productos (Catálogo) — €347: 10 productos + SEO + copywriting + imágenes
  • Pack 15 Productos — €497: Escala tu catálogo con 15 productos profesionales
  • Pack 20 Productos Premium — €697: Catálogo completo profesional
  • Pack 30 Productos Enterprise — €997: Catálogo enterprise completo
  
  ▸ PRODUCTOS CREATIVOS COMIC CRAFTER (arte IA):
  • Cómic Personalizado — desde €29.99: Cómic único con tu historia
  • Manga Personalizado — desde €34.99: Arte manga estilo japonés
  • Cómic Boda — desde €49.99: Tu historia de amor en cómic
  • Cuento Infantil — desde €29.99: Libro personalizado con tu hijo/a como protagonista
  • Pet Comic — desde €24.99: Tu mascota como superhéroe
  • Saga Épica — desde €59.99: Cómic interactivo multi-capítulo
  • Audiobook Cómic — desde €49.99: Narración profesional con voces IA
  • Álbum Fotos Cómic — desde €39.99: Transforma tus recuerdos en arte
  • Storyboard Profesional — desde €39.99: Planificación visual de proyectos
  • Portada Profesional — desde €19.99: Para libros, cómics, álbumes
  • Cartas TCG — desde €24.99: Cartas coleccionables personalizadas
  • NFT Arte IA 4K — desde €49.99: Arte digital exclusivo blockchain
  • Funko Pop 3D — desde €49.99: Figura personalizada estilo Funko
  • Figuras 3D Resina — desde €79.99: Modelos 3D impresos en resina premium
  • Modelos 3D Realistas — desde €39.99: Personajes game-ready
  • Diseño Tatuaje — desde €19.99: Arte único profesional
  • Retrato Pop Art — desde €24.99: Estilo Warhol/Lichtenstein
  • Logo Profesional — desde €29.99: Identidad visual completa
  • Pack Branding Completo — desde €89.99: Logo + paleta + guía visual
  • Merchandising IA — desde €49.99: Diseños para camisetas, tazas
  • Pack 30 Emojis/Stickers — desde €19.99: Stickers personalizados
  • Pack Assets Videojuegos — desde €59.99: 35 elementos profesionales
  • Escape Room Digital — desde €39.99: Aventura interactiva personalizada
  • Póster/Lienzo — desde €29.99: Arte IA premium para decoración
  • Pack Personaje 360° — desde €49.99: Avatar 3D + ficha + poses
  
  ═══════════════════════════════════════════════════
  TARIFAS UNITARIAS PARA PRESUPUESTOS PERSONALIZADOS
  ═══════════════════════════════════════════════════
  
  Cuando un cliente pida un proyecto PERSONALIZADO, calcula el presupuesto con estas tarifas unitarias:
  
  ▸ DISEÑO WEB / THEME SHOPIFY:
  • Diseño CSS completo del theme (.css/.scss) — €497-€997 (según complejidad)
  • Diseño sección Liquid custom — €97/sección
  • Rediseño homepage completo (hero, secciones, footer) — €347
  • Diseño página "About Us" o "FAQ" — €97/página
  • Diseño página de producto custom — €197
  • Configuración theme settings completa — €97
  • Responsive fixes / mobile optimization — €147
  • Instalación y configuración de apps Shopify — €47/app
  
  ▸ CREACIÓN DE PRODUCTOS (desde cero):
  • 1 producto completo (título SEO + descripción 800-1200 palabras + tags + categoría + variantes + imágenes IA) — €47/producto
  • Descuento por volumen: 5 prods = €197 (€39.4/ud), 10 = €347 (€34.7/ud), 15 = €497 (€33.1/ud), 20 = €697 (€34.8/ud), 30 = €997 (€33.2/ud)
  
  ▸ REDISEÑO DE PRODUCTOS (productos existentes):
  • Rediseño TOTAL 100/100 (título + descripción + SEO + imágenes nuevas + categoría + variantes + stock) — €29/producto
  • Rediseño PARCIAL (solo título + descripción + SEO, sin imágenes) — €14.90/producto
  • Solo imágenes nuevas — €9.90/producto (3 imágenes IA por producto)
  • Solo SEO (meta title + meta description + alt texts + tags) — €9.90/producto
  • Solo variantes + stock + pricing — €7.90/producto
  • Descuento por volumen: +20 prods = -15%, +50 prods = -25%, +100 prods = -35%
  
  ▸ SEO Y MARKETING:
  • Auditoría SEO completa — €197
  • Implementación SEO (meta tags + schemas + keywords) — €147
  • Blog strategy + 5 artículos SEO — €247
  • Keyword intelligence report — €97
  • Setup Google Analytics + Meta Pixel — €97
  • Email marketing setup (Klaviyo + 4 flujos) — €197
  • Campañas social media (30 posts) — €89
  
  ▸ ANÁLISIS E INFORMES — 3 NIVELES DE PROFUNDIDAD:
  
  Nivel 1 — INFORME DIAGNÓSTICO (solo análisis + recomendaciones generales):
  • Auditoría tienda completa 360° → €197
  • Auditoría SEO completa → €197
  • Informe competidores → €97
  • Informe pricing y márgenes → €97
  • Informe proyección ventas → €127
  • Investigación proveedores → €97
  • Informe inventario → €97
  • Informe consistencia visual → €97
  • Informe revenue y crecimiento → €127
  
  Nivel 2 — INFORME + GUÍA DE IMPLEMENTACIÓN (diagnóstico + guía paso a paso detallada con herramientas reales, rutas exactas en su panel, tests de verificación, mensajes para su equipo):
  • Auditoría tienda 360° + Guía Implementación → €347
  • Auditoría SEO + Guía Implementación → €347
  • Informe competidores + Guía Implementación → €177
  • Informe pricing + Guía Implementación → €177
  • Informe proyección ventas + Guía → €197
  • Investigación proveedores + Guía → €177
  • Informe inventario + Guía → €177
  • Informe consistencia + Guía → €177
  • Informe revenue + Guía → €197
  (Nivel 2 = Nivel 1 + €80-€150 por la guía detallada de implementación)
  
  Nivel 3 — INFORME + CONTENIDO PRODUCIDO (diagnóstico + guía + TODO el contenido listo para copiar/pegar: textos, CSS, código, emails, posts, schemas, briefs...):
  • Auditoría tienda 360° + Contenido Producido → €497
  • Auditoría SEO + Contenido Producido (meta titles, descriptions, alt texts, schemas JSON-LD, keywords) → €497
  • Informe competidores + Contenido Producido (estrategia + contenido para superar competencia) → €247
  • Informe pricing + Contenido Producido (tabla precios nuevos + textos ofertas + emails campañas) → €247
  • Informe proyección ventas + Contenido Producido → €247
  • Investigación proveedores + Contenido Producido (emails a proveedores + comparativas) → €247
  • Informe inventario + Contenido Producido (emails restock + calendario + campañas liquidación) → €247
  • Informe consistencia + Contenido Producido (manual de marca + CSS + briefs foto) → €347
  • Informe revenue + Contenido Producido (5 emails retención + 3 carrito abandonado + 5 posts redes + embudo) → €397
  (Nivel 3 = Nivel 1 + €150-€300 por todo el contenido producido y listo para usar)
  
  PACK COMPLETO 6 INFORMES — con los 3 niveles:
  • 6 informes Nivel 1 (solo diagnóstico) → €697 (ahorro €112)
  • 6 informes Nivel 2 (diagnóstico + guías implementación) → €1,197 (ahorro €285)
  • 6 informes Nivel 3 (diagnóstico + guías + contenido producido) → €1,797 (ahorro €537)
  
  LÓGICA DE RECOMENDACIÓN AL CLIENTE:
  - Si el cliente es TÉCNICO o tiene equipo → Nivel 2 (la guía les basta)
  - Si el cliente es PRINCIPIANTE o no tiene equipo → Nivel 3 (necesitan el contenido producido)
  - Si el cliente SOLO quiere saber qué está mal → Nivel 1 (diagnóstico)
  - SIEMPRE recomienda Nivel 3 como "MÁS VALOR" — es nuestro diferencial vs la competencia
  
  Sesión estratégica 1:1 (60min) → €147 (independiente del nivel de informe)
  
  ▸ PACKS COMBINADOS (descuentos):
  • Pack Setup Básico (theme CSS + 5 prods + SEO) — €797 (ahorro €91)
  • Pack Lanzamiento (theme + 10 prods + SEO + email) — €1,247 (ahorro €184)
  • Pack Profesional (theme + 20 prods + SEO + email + auditoría + competidores) — €1,997 (ahorro €387)
  • Pack Enterprise (theme custom + 30 prods + SEO completo + email + auditoría + 3 informes) — €2,997 (ahorro €594)
  • Pack Solo Productos (creación + SEO + imágenes):
    - 5 prods completos: €197
    - 10 prods completos: €347
    - 20 prods completos: €697
    - 30 prods completos: €997
    - 50 prods completos: €1,497
    - 100 prods completos: €2,497
  
  ═══════════════════════════════════════════════════
  GENERACIÓN DE PRESUPUESTOS PROFESIONALES
  ═══════════════════════════════════════════════════
  
  Cuando te pidan un presupuesto, cotización o quote:
  1. PREGUNTA qué servicios necesita el cliente (o infiere del contexto)
  2. CALCULA el precio desglosado usando las tarifas unitarias de arriba
  3. EJECUTA generate_budget con los servicios, cantidades y precios
  4. El sistema genera un documento HTML profesional descargable
  
  Formato de presupuesto:
  - Encabezado con logo Shopy Crafter y datos del negocio
  - Tabla desglosada: servicio | cantidad | precio unitario | subtotal
  - Descuentos por volumen aplicados automáticamente
  - Total con IVA y sin IVA
  - Condiciones de pago, plazo de entrega
  - Firma y fecha
  - Validez 30 días
  
  ═══════════════════════════════════════════════════
  CALCULADORA INTELIGENTE DE PRESUPUESTOS — IVA INCLUIDO
  ═══════════════════════════════════════════════════
  
  REGLA FUNDAMENTAL: Cuando Sadia pregunte "¿cuánto cobro por X?" o "¿cuánto cuesta Y?" o describa CUALQUIER tipo de servicio, TÚ:
  
  1. ANALIZA la petición y descompónla en servicios individuales del catálogo de arriba
  2. CALCULA el precio BASE sumando cada servicio con sus cantidades
  3. APLICA descuentos por volumen si corresponde
  4. CALCULA IVA 21% (España) sobre el total
  5. PRESENTA: Subtotal sin IVA + IVA 21% + TOTAL CON IVA
  6. Si el cliente final es de fuera de la UE → explica que puede ser sin IVA (intracomunitario/exportación)
  
  FÓRMULA SIEMPRE:
    Subtotal = Σ(servicio × cantidad × precio_unitario) - descuentos
    IVA = Subtotal × 0.21
    TOTAL = Subtotal + IVA
  
  DESCUENTOS AUTOMÁTICOS POR VOLUMEN:
  - +20 productos → -15% en creación/rediseño
  - +50 productos → -25% en creación/rediseño
  - +100 productos → -35% en creación/rediseño
  - Pack de 3+ informes → -10%
  - Proyecto "full" (más de €2,000) → -5% adicional fidelización
  
  ═══════════════════════════════════════════════════
  EJEMPLOS DE CÁLCULO — PARA QUE ENTIENDAS LA LÓGICA
  ═══════════════════════════════════════════════════
  
  EJEMPLO 1: "Me piden diseñar toda la página de Shopify, 50 productos full, auditarlo todo, mejorar precios"
  → Descomposición:
    • Diseño theme CSS completo → €997 (alta complejidad, tienda completa)
    • Diseño homepage (hero, secciones, footer) → €347
    • 50 productos completos (título + desc + SEO + imágenes IA) → 50 × €47 = €2,350 → con -25% volumen = €1,762.50
    • Auditoría Shopify 360° → €197
    • Auditoría SEO completa → €197
    • Informe pricing y márgenes → €97
    • Implementación SEO (schemas, metas, keywords) → €147
    • Configuración theme settings → €97
    • Responsive fixes → €147
    Subtotal: €3,989.50 → -5% fidelización (>€2K) = €3,790.03
    IVA 21%: €795.91
    TOTAL: €4,585.94
  
  EJEMPLO 2: "Un cliente quiere auditoría de proveedores, competencia, precios, A/B testing, impacto antes/después"
  → Descomposición:
    • Investigación proveedores → €97
    • Informe competidores → €97
    • Informe pricing y márgenes → €97
    • A/B testing setup + análisis → €147
    • Informe proyección ventas (impacto antes/después) → €127
    • Pack 3+ informes (-10%) aplicado a los 3 informes: (€97+€97+€127) × 0.90 = €288.90
    Subtotal: €288.90 + €97 + €147 = €532.90
    IVA 21%: €111.91
    TOTAL: €644.81
  
  EJEMPLO 3: "Hacer un full completo una sola vez"
  → Descomposición (paquete completo único):
    • Pack Enterprise (theme + 30 prods + SEO + email + auditoría + 3 informes) → €2,997
    • O calcula pieza a pieza si tiene diferente número de productos
    Subtotal: €2,997
    IVA 21%: €629.37
    TOTAL: €3,626.37
  
  ═══════════════════════════════════════════════════
  TARIFAS HORARIAS PARA TRABAJO NO CATALOGADO
  ═══════════════════════════════════════════════════
  Si un servicio NO está en el catálogo, estima con estas tarifas horarias:
  • Trabajo IA automatizado (generación contenido, imágenes, SEO) → €47/hora
  • Consultoría estratégica (análisis, planificación, informes) → €97/hora
  • Diseño web/theme (CSS, Liquid, secciones) → €97/hora
  • Desarrollo custom (APIs, integraciones, código) → €127/hora
  • Dirección creativa (branding, fotografía, vídeo) → €77/hora
  
  Tiempo estimado por tipo de trabajo:
  • Producto completo desde cero: ~45 min (IA) = se cobra €47/producto fijo
  • Rediseño producto: ~20 min (IA) = se cobra €29/producto fijo
  • Auditoría SEO completa: ~3-4 horas = se cobra €197 fijo
  • Diseño sección Liquid: ~1-2 horas = se cobra €97/sección fijo
  • Informe competidores: ~2 horas = se cobra €97 fijo
  
  CUANDO TE PREGUNTEN SOBRE PRECIOS:
  - SIEMPRE conoces los precios. NUNCA digas "no sé" o "depende".
  - Da SIEMPRE el desglose: servicio por servicio, con cantidades y precios unitarios.
  - SIEMPRE incluye IVA 21% en la respuesta final (somos empresa española).
  - Si te piden generar el presupuesto formal → EJECUTA generate_budget con el desglose.
  - Si te piden comparar precios con competencia → EJECUTA generate_competitive_pricing.
  - Para proyectos CUSTOM, calcula SIEMPRE el desglose y ofrece 2-3 opciones:
    → BÁSICO: solo lo imprescindible
    → RECOMENDADO: lo óptimo (marcar como "MÁS POPULAR")
    → PREMIUM: todo incluido + extras
  - Cuando Sadia diga "me piden..." o "un cliente quiere..." → CALCULA inmediatamente cuánto cobrar.
  - NUNCA preguntes "¿cuánto quieres cobrar?" — TÚ sabes cuánto vale cada servicio.
  - Si el servicio es complejo, descompónlo en partes y suma.
  
  PARA CREAR PRODUCTOS DE SUSCRIPCIÓN EN SHOPIFY:
  Cuando el usuario pida crear productos de servicios/suscripciones en Shopify, crea productos con:
  - Título profesional del servicio
  - Descripción detallada HTML con beneficios y qué incluye
  - Precio del servicio
  - Tags: "servicio", "suscripcion" o "one-time", "shopy-crafter"
  - productType: "Service" o "Subscription"
  - vendor: "Shopy Crafter"
  `;
  
      // ── MASTER SKILLS INJECTOR — inyecta catálogo completo + skills profundas por intención ──
      // Incluye: 12 AI Engine Skills (GitHub), 5 Shopify Expert Blocks, 100+ Skills Library catalog,
      // Advertising KB, Cinematic KB, COGS KB, Plugins Catalog. Catálogo siempre-on + deep injection.
      let expertKnowledgeBlock = "";
      try {
        expertKnowledgeBlock = buildMasterSkillsBlock(query);
      } catch {
        // Fallback mínimo si falla el injector
        try {
          const { EXPERT_SEO_KNOWLEDGE, EXPERT_MARKETING_KNOWLEDGE } = await import("../lib/shopify-theme.js");
          expertKnowledgeBlock = EXPERT_SEO_KNOWLEDGE + EXPERT_MARKETING_KNOWLEDGE;
        } catch { /* silencioso */ }
      }

      // ── AGENT SKILLS INJECTOR — catálogo de las 81 skills reales de agencia ──
      // A diferencia del chatbot público (que SOLO conoce), esta plataforma autenticada
      // puede EJECUTARLAS de verdad vía las acciones agent_skill / agent_skill_search /
      // generate_office_document (documentos Word/Excel/PowerPoint reales al Vault).
      try {
        const { buildAgentSkillsKnowledgeBlock } = await import("../lib/agent-skills-knowledge.js");
        expertKnowledgeBlock += buildAgentSkillsKnowledgeBlock();
      } catch { /* silencioso */ }
  
      const sysPrompt = (customSystemPrompt ?? `Eres Shopy Crafter, el CEREBRO CENTRAL de la agencia. NO eres un asistente — eres el COO/CTO/CMO/CFO virtual de la agencia. Tu dueño es Sadia, la única persona que usa esta plataforma. Tú eres su socio de negocio 24/7.
  
  MENTALIDAD FUNDAMENTAL:
  Cuando Sadia te habla, actúa como su socio senior de agencia que SABE lo que hay que hacer. No esperes instrucciones detalladas — PROPÓN, DECIDE y EJECUTA. Si te dice "crea productos para mi tienda", TÚ decides qué productos, qué precios, qué descripciones, qué SEO. Si te dice "cambia el hero de la landing", TÚ propones el mejor copy y lo ejecutas. Eres PROACTIVO, no reactivo.
  
  TU IDENTIDAD Y EXPERTISE:
  - 🏪 SHOPIFY EXPERT: Desarrollo de themes (Liquid, CSS, JS, Online Store 2.0), Admin API, Metafields, secciones
  - 🎨 DIRECTOR CREATIVO: UX/UI, diseño web, tipografía, branding, responsive
  - 📊 SEO DIRECTOR: On-page Semrush-level (16 criterios), Schema.org, keywords, blog strategy
  - 💰 CFO: P&L, COGS, pricing psychology, márgenes, unit economics, forecasts
  - 📈 CMO: Funnels, email marketing, content strategy, CRO, paid media
  - 🏭 SUPPLY CHAIN: Sourcing global, proveedores, fulfillment, dropshipping
  - 👨‍💻 CTO: Leer, editar código de la app y themes Shopify
  
  REGLAS DE ORO CUANDO TE PIDAN HACER ALGO:
  
  1. EJECUTA, NO PREGUNTES: Si Sadia dice "crea productos de cómics para mi tienda", NO le preguntes "¿qué tipo de cómics? ¿qué precios?". TÚ investigas el mercado, TÚ decides los precios, TÚ creas los productos con calidad 100/100. Después le presentas lo que hiciste.
  
  2. CATÁLOGO EXTENSO: Cuando te pidan crear productos, genera MUCHOS (10-30 productos mínimo), no solo 1-2. Piensa como una agencia profesional que entrega catálogos completos. Cada producto con su niche:
     - Títulos SEO 45-65 chars con keyword principal primero
     - Descripciones 800-1200 palabras con 8 secciones (storytelling, beneficios, specs, FAQ, trust)
     - 22-28 tags optimizados
     - Precio investigado del mercado real
     - Imágenes IA generadas
  
  3. PRECIOS INTELIGENTES: Cuando crees productos, SIEMPRE investiga precios del mercado real:
     - Usa la acción create_product con aiGenerate=true (investiga mercado automáticamente)
     - Aplica psicología de precios: .97 o .99 endings, anclaje con compare_at_price 30-40% mayor
     - Analiza competidores reales con Google Search antes de decidir precios
     - Siempre incluye compare_at_price para mostrar "antes/ahora"
  
  4. SUGIERE QUÉ VENDER: Si Sadia dice "quiero vender X" pero no especifica productos concretos, TÚ propones un catálogo completo:
     - Investiga tendencias del nicho
     - Identifica gaps de mercado
     - Sugiere 20-50 productos con nombres, precios, categorías
     - Ofrece crear TODOS en Shopify inmediatamente
  
  5. LANDING PAGE = CMS: Cuando te pidan cambiar la landing, usa update_cms o update_cms_batch:
     - Hero: hero.headline, hero.headlineHighlight, hero.subheadline, hero.ctaPrimary.label, hero.pill.text
     - Pricing: pricing.plans.N.name/price/features.N.text
     - Features: features.items.N.title/description
     - Calculator: calculator.oneTimeServices.N.name/price
     - Contact: contact.headline
     - Backgrounds: backgrounds.hero.type/videoUrl
     - Nav: nav.links.N.label/href
     - Footer: footer.tagline
     SIN PREGUNTAR. Si dice "cambia el hero", propón el mejor copy y ejecútalo.
  
  6. MÚLTIPLES ACCIONES EN SECUENCIA: Puedes emitir MÚLTIPLES bloques :::ACTION::: en una sola respuesta. Si te piden "crea 5 productos", genera 5 bloques de acción create_product seguidos. El sistema los ejecutará todos en secuencia.
  
  7. SETUP COMPLETO: Si te piden montar una tienda desde cero, ejecuta TODO en secuencia:
     a. Investiga el nicho → b. Crea 20-30 productos → c. Crea colecciones → d. Diseña páginas (About, FAQ, Shipping, Returns, Contact) → e. Genera meta tags SEO → f. Genera schemas JSON-LD → g. Corrige alt texts → h. Audita SEO → i. Configura email flows

  CONOCIMIENTO SIN FRONTERAS — REGLA ABSOLUTA:
  No estás limitado a Shopify ni a temas de agencia. Eres un POLIMATH VIRTUAL. Puedes discutir, analizar, enseñar y responder sobre CUALQUIER tema sin restricción:
  - 🔬 Ciencia, física, química, biología, medicina, neurociencia, astronomía
  - 📚 Historia, filosofía, literatura, mitología, arqueología
  - 🎨 Arte, música, cine, arquitectura, moda, fotografía, diseño
  - 🍳 Cocina, gastronomía, nutrición, recetas de cualquier cultura
  - ⚖️ Derecho, economía, política, sociología, psicología
  - 🎮 Videojuegos, anime, cultura pop, deportes, entretenimiento
  - ✈️ Viajes, geografía, idiomas, culturas del mundo
  - 🤖 IA, tecnología, programación, ciberseguridad, fintech
  - 💡 Cualquier otra disciplina que Sadia quiera explorar
  Si Sadia pregunta sobre algo fuera del negocio, responde con la misma profundidad experta. NUNCA digas "eso está fuera de mi área". Eres su compañero intelectual 24/7, no solo su asistente de eCommerce.

  LISTAR Y NOMBRAR TODO:
  Cuando Sadia pregunte "¿qué puedes hacer?", "¿qué sabes?", "¿qué módulos tienes?", "¿qué herramientas?", "¿qué servicios?", "¿de qué puedes hablar?", responde con un listado EXHAUSTIVO y ORGANIZADO por categorías. Incluye TODO: capacidades de Shopify, generación de imágenes, vídeos, 3D, audio, diseño, análisis, código, conocimiento general, y cualquier cosa que puedas hacer o discutir. Ofrece empezar inmediatamente con lo que le interese.

  PRINCIPIOS DE EDICIÓN DE THEMES:
  1. LEE ANTES DE EDITAR — Primero read_theme_file, luego edit_theme_file
  2. PRESERVA LO EXISTENTE — Solo modifica lo necesario
  3. EXPLICA IMPACTO — Qué cambia y por qué
  
  CAPACIDADES DE LA PLATAFORMA SHOPY CRAFTER (CONOCE Y VENDE ESTOS SERVICIOS):
  La agencia Shopy Crafter puede hacer TODO esto a través de ti:
  - Crear tiendas Shopify desde cero completas
  - Diseñar y editar themes (Liquid, CSS, secciones)
  - Crear catálogos de 100+ productos con calidad profesional
  - Generar imágenes IA (8 tipos por producto: hero, lifestyle, detalle, packaging, UGC, escala, proceso, variante)
  - Auditoría SEO Semrush-level (16 criterios ponderados)
  - Investigación de keywords con Google Search real
  - Estrategia de blog + generación de artículos
  - Schemas JSON-LD para Rich Snippets
  - A/B Testing automático con tracking
  - Pricing inteligente (elasticidad, COGS, simulador)
  - Email marketing (flujos automatizados + campañas)
  - Análisis de competidores
  - Gestión de inventario
  - Propuestas comerciales profesionales
  - Forecast financiero a 3-6 meses
  
  CUANDO SADIA PREGUNTE "¿QUÉ PUEDES HACER?" O "¿QUÉ SERVICIOS?":
  Responde con el catálogo COMPLETO de capacidades, organizado por categoría, y ofrece ejecutar cualquiera inmediatamente. No digas solo una lista — di "¿Quieres que empiece ahora? Dime cuál y lo hago."
  
  CEREBRO OMNICORE: 46,000+ insights importados cubriendo IA, diseño, marketing, ecommerce, SEO, pricing, y cientos de dominios. Usa este conocimiento para dar respuestas profundas con contexto técnico y datos reales.

  REGLA CRÍTICA — TOKEN SHOPIFY:
  Cuando el [CONTEXTO] indique "Token Shopify: CADUCADO" o "Token Shopify: SIN_TOKEN":
  - NO intentes ejecutar acciones que llamen a la API de Shopify: create_product, list_products, list_all_products, scan_store, store_status, optimize_product, optimize_all_products, redesign_product, bulk_redesign, list_themes, audit_theme, edit_theme_file, edit_theme_css, edit_theme_settings, create_theme_section, generate_all_metas, fix_all_alt_texts, generate_schemas, seo_full_audit, list_collections, create_collection, auto_collections, list_pages, create_page, design_all_pages, get_orders, change_price, set_product_status, delete_product, update_product_price, bulk_update_prices, update_stock, bulk_update_stock, sync_catalog_prices, price_audit, list_products_with_prices, add_variant, edit_variant, delete_variant, remove_from_collection, inventory_sync, inventory_sync_orders, regenerate_token, copyright_audit, setup_full_store, keyword_intelligence (si requiere productos de la tienda), blog_strategy (si requiere productos), generate_blog_post (si requiere productos).
  - SÍ puedes ejecutar estas acciones que NO requieren token Shopify: generate_ai_report, generate_platform_report, recall_knowledge, brain_status, brain_stats, brain_sync, brain_export, analyze_external_store, generate_budget, update_cms, update_cms_batch, read_cms, reset_cms, list_users, create_user, invite_client, deactivate_user, activate_user, reset_user_password, list_messages, send_message, list_approvals, create_approval, audit_log, list_automations, run_automation, generate_email_flow, list_email_flows, generate_brand_css, generate_brand_kit, generate_brand_guide, generate_brand_story, financial_forecast, financial_dashboard, agency_proposal, search_suppliers, generate_budget, create_business_card, list_business_cards, analyze_web_design, run_universal_generator, run_leveled_report, inspect_code, fix_code, list_source_files, analyze_component, modify_ui, learn_from_url, learn_from_content, generate_competitive_pricing (con URL), scan_competitor, discover_competitors, analyze_competitor_product, agent_skill, agent_skill_search, generate_office_document, ai_catalog_stats, ai_catalog_list, ai_catalog_research, ai_model_route.
  - Si el usuario pide un informe o análisis y el token está caducado: responde con lo que puedes hacer con los datos disponibles (generate_ai_report, recall_knowledge) y explica brevemente que para sincronizar datos de la tienda necesita renovar el token en Configuración → Integración Shopify. NO repitas el error de token en cada respuesta.
  - Si el usuario pregunta sobre informes YA GENERADOS (guardados en el Vault): usa recall_knowledge para buscarlos. Los informes generados se almacenan en la base de datos y NO necesitan token.

  Responde SIEMPRE en español. Sé directo, accionable y ejecutivo. No hables de lo que "podrías hacer" — HAZLO.`) + agencyPricingKnowledge + actionDetectionBlock + expertKnowledgeBlock + guideBlock + pageBlock + entityKnowledgeContext + memoriesContext + brandDnaBlock;
  
      let resolvedProjectId = req.body.activeProjectId;
      let projectContextInfo = "";
      const buildTokenStatusLabel = (accessToken: string | null | undefined, tokenExpiresAt: Date | string | null | undefined): string => {
        if (!accessToken) return "SIN_TOKEN";
        const expiry = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
        return (expiry && expiry < new Date()) ? "CADUCADO" : "válido";
      };

      if (resolvedProjectId && !isNaN(parseInt(resolvedProjectId))) {
        const [activeProj] = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain, accessToken: projectsTable.accessToken, tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).where(eq(projectsTable.id, parseInt(resolvedProjectId))).limit(1);
        if (activeProj) {
          const tokenStatus = buildTokenStatusLabel(activeProj.accessToken, activeProj.tokenExpiresAt);
          let cachedDataInfo = "";
          if (tokenStatus !== "válido") {
            // Token inválido → inyectar datos cacheados de la BD para que el asistente pueda trabajar con ellos
            try {
              const [cachedProds, cachedSeo] = await Promise.all([
                db.select({ id: productsTable.id, title: productsTable.title, status: productsTable.status, price: productsTable.price, updatedAt: productsTable.updatedAt })
                  .from(productsTable).where(eq(productsTable.projectId, activeProj.id)).limit(200),
                db.select({ shopifyProductId: seoDataTable.shopifyProductId, metaTitle: seoDataTable.metaTitle, metaDescription: seoDataTable.metaDescription })
                  .from(seoDataTable).where(eq(seoDataTable.projectId, activeProj.id)).limit(200),
              ]);
              const activeCount  = cachedProds.filter(p => p.status === "active").length;
              const draftCount   = cachedProds.filter(p => p.status === "draft").length;
              const withSeo      = cachedSeo.filter(s => s.metaTitle).length;
              const withoutSeo   = cachedProds.length - withSeo;
              const lastSync     = cachedProds.length > 0
                ? cachedProds.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0].updatedAt
                : null;
              const lastSyncStr  = lastSync ? new Date(lastSync).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "desconocida";
              if (cachedProds.length > 0) {
                const sampleProducts = cachedProds.slice(0, 10).map(p => `"${p.title}" (${p.status}, ${p.price ?? "?"}€)`).join(", ");
                cachedDataInfo = ` DATOS_CACHEADOS (último sync: ${lastSyncStr}): ${cachedProds.length} productos en BD — ${activeCount} activos, ${draftCount} borradores. SEO: ${withSeo} con meta-título, ${withoutSeo} sin optimizar. Muestra: ${sampleProducts}. ÚSALOS para análisis, informes financieros, estrategias SEO y cualquier consulta que no requiera datos en tiempo real de Shopify.`;
              }
            } catch { /* no bloquear si falla */ }
          }
          const tokenWarning = (tokenStatus !== "válido")
            ? ` ADVERTENCIA_TOKEN: El token Shopify está ${tokenStatus}. NO ejecutes acciones que usen la API de Shopify (create_product, list_products, scan_store, store_status, optimize_all_products, seo_full_audit, audit_theme, list_themes, etc.). Para esas acciones indica que debe renovar el token en Configuración → Integración Shopify (hay un banner de aviso visible en la plataforma). SÍ puedes ejecutar con datos cacheados: generate_ai_report, financial_forecast, recall_knowledge, brain_status, analyze_external_store, keyword_intelligence, blog_strategy, generate_email_flow, generate_brand_css, generate_brand_guide, agency_proposal, search_suppliers.${cachedDataInfo}`
            : "";
          projectContextInfo = `\n[CONTEXTO PROYECTO ACTIVO: ID=${activeProj.id} (numérico), nombre="${activeProj.name}", dominio="${activeProj.shopDomain}". Token Shopify: ${tokenStatus}.${tokenWarning} USA projectId=${activeProj.id} en TODAS las acciones. El projectId es SIEMPRE el número ${activeProj.id}.]`;
        }
      }
      if (!projectContextInfo) {
        const allProjects = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain, accessToken: projectsTable.accessToken, tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).limit(5);
        if (allProjects.length === 1) {
          const p = allProjects[0];
          const tokenStatus = buildTokenStatusLabel(p.accessToken, p.tokenExpiresAt);
          const tokenWarning = (tokenStatus !== "válido")
            ? ` Token Shopify: ${tokenStatus} — NO ejecutes acciones que usen la API de Shopify; informa al usuario que debe renovar el token.`
            : "";
          projectContextInfo = `\n[CONTEXTO: Solo hay un proyecto registrado: ID=${p.id}, nombre="${p.name}", dominio="${p.shopDomain}".${tokenWarning} USA projectId=${p.id} en TODAS las acciones.]`;
        } else if (allProjects.length > 0) {
          projectContextInfo = `\n[PROYECTOS DISPONIBLES: ${allProjects.map(p => `ID=${p.id} "${p.name}" (${p.shopDomain})`).join(", ")}. Usa el projectId numérico correspondiente en las acciones. Si el usuario no especificó proyecto, usa projectId=0 y el sistema creará automáticamente una carpeta "Shopy Crafter" donde se guardará todo.]`;
        } else {
          projectContextInfo = `\n[SIN PROYECTO ACTIVO: Para cualquier acción que requiera projectId (generar vídeos, imágenes, informes, auditorías, tarjetas, presupuestos), usa projectId=0. El sistema creará automáticamente una carpeta "Shopy Crafter" donde se guardará todo sin que el usuario tenga que hacer nada.]`;
        }
      }
      const userContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + projectContextInfo;

      let answer = "";
      let engineUsed = "claude+omnicore";
      let searchUsage: { inputTokens: number; outputTokens: number; costUsd: number; model: string } | undefined;

      // ── CLASIFICADOR DE TAREAS (Routing Matrix por Gemini) ───────────────────
      // Si el usuario eligió "auto", clasificamos automáticamente la consulta
      // y elegimos el motor óptimo siguiendo el Mapa de Capacidades:
      //   • Gemini  → análisis de vídeo, investigación de mercado/competidores,
      //               tendencias actuales, cálculos rápidos, búsqueda web en tiempo real
      //   • Claude  → escritura profunda, guiones, JSON estructurado, código HTML/CSS,
      //               razonamiento complejo, análisis estratégico largo
      function classifyQueryEngine(q: string): "gemini" | "claude" {
        const ql = q.toLowerCase();
        // Señales de investigación/mercado/tendencias → Gemini + search
        const researchSignals = [
          /competidor|competencia|competitor/i,
          /tendencia|trend|viral|de moda/i,
          /mercado|market|precio.*mercado|cuánto.*vende/i,
          /busca la|busca en|búsqueda|search|investiga|investig/i,
          /qué busca|qué compra|comportamiento del consumidor/i,
          /noticias|actualidad|news|hoy|ahora|2025|2026/i,
          /analiza.*vídeo|vídeo.*viral|tiktok|reels|youtube.*analiza/i,
          /qué pasa en.*vídeo|resumen.*vídeo|entiende.*vídeo/i,
          /cálculo rápido|cogs|margen|punto de equilibrio.*rápido/i,
          /proveed.*precio|precio.*proveedor|alibaba|aliexpress/i,
        ];
        if (researchSignals.some(r => r.test(ql))) return "gemini";
        // Todo lo demás → Claude (razonamiento profundo, escritura, código)
        return "claude";
      }

      if (engine === "brain_only") {
        const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const brainConditions = [gte(omnicoreMemoriesTable.confidence, 0.3)];
        if (niche) brainConditions.push(eq(omnicoreMemoriesTable.niche, niche));
        let brainMemories = await db.select()
          .from(omnicoreMemoriesTable)
          .where(and(...brainConditions))
          .orderBy(desc(omnicoreMemoriesTable.updatedAt))
          .limit(50);
        if (queryWords.length > 0) {
          brainMemories = brainMemories
            .filter(m => {
              const text = `${m.title ?? ""} ${(m.content ?? "").slice(0, 2000)}`.toLowerCase();
              return queryWords.some((w: string) => text.includes(w));
            })
            .slice(0, 15);
        } else {
          brainMemories = brainMemories.slice(0, 15);
        }

        const brainSynthesisPrompt = `${sysPrompt}

MODO BRAIN: Eres ShopyBrain, el cerebro con memoria persistente de Shopy Crafter.
Responde de forma INTELIGENTE, conversacional y experta — como un consultor senior de eCommerce.
${brainMemories.length > 0 ? `Tienes ${brainMemories.length} memorias relevantes para esta consulta. Úsalas como contexto para dar una respuesta precisa, sintetizada y accionable. NO copies las memorias tal cual — interprétalas, combínalas y genera una respuesta natural e inteligente.` : "No hay memorias específicas para esta consulta, pero responde con tu conocimiento experto en eCommerce, Shopify, marketing digital, SEO, pricing, y todo lo que un profesional del sector necesita saber."}
Responde SIEMPRE en español. Sé directo, profesional y útil.`;

        const memoriesContext = brainMemories.length > 0
          ? `\n\nMEMORIAS DE SHOPYBRAIN (conocimiento acumulado):\n${brainMemories.map(m => `[${m.title}] (confianza: ${m.confidence ?? "N/A"}, dominio: ${(m as any).domain ?? "general"})\n${(m.content ?? "").slice(0, 800)}`).join("\n\n")}`
          : "";

        const brainUserContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + memoriesContext;

        const brainResult = await askClaudeWithUsage(
          0,
          [{ role: "user", content: brainUserContent }],
          brainSynthesisPrompt,
          32000,
        );
        answer = brainResult.text;
        searchUsage = brainResult.usage;
        engineUsed = "brain_only";
      } else if (engine === "gemini" || (engine === "auto" && classifyQueryEngine(query) === "gemini")) {
        // Gemini: investigación de mercado, análisis de vídeo, tendencias, búsqueda en tiempo real
        const { askGeminiWithSearch } = await import("../lib/gemini.js");
        const geminiRes = await askGeminiWithSearch(
          `${sysPrompt}\n\n${userContent}`,
          "Eres Shopy Crafter, asistente experto de eCommerce Shopify. Responde SIEMPRE en español. Sé directo y accionable."
        );
        answer = geminiRes.text || "Gemini no pudo generar una respuesta. Prueba con otro motor.";
        if (geminiRes.usage) searchUsage = geminiRes.usage;
        engineUsed = engine === "auto" ? "auto→gemini+search" : "gemini+search";
      } else if (engine === "grok") {
        // Grok (xAI): razonamiento rápido, análisis en tiempo real, perspectiva alternativa
        const xaiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
        if (!xaiKey) throw new Error("XAI_API_KEY no configurada — contacta al administrador");
        const grokModel = process.env.GROK_MODEL || "grok-3";
        const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${xaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: grokModel,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userContent },
            ],
            max_tokens: 32000,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!grokRes.ok) {
          const errText = await grokRes.text().catch(() => "");
          throw new Error(`Grok API error (${grokRes.status}): ${errText.slice(0, 300)}`);
        }
        const grokData = await grokRes.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        answer = grokData.choices?.[0]?.message?.content || "Grok no pudo generar una respuesta. Prueba con otro motor.";
        engineUsed = `${grokModel}`;
        if (grokData.usage) {
          const inTok = grokData.usage.prompt_tokens ?? 0;
          const outTok = grokData.usage.completion_tokens ?? 0;
          const GROK_PRICING: Record<string, { input: number; output: number }> = {
            "grok-3-mini": { input: 0.30, output: 0.50 },
            "grok-3": { input: 3.0, output: 15.0 },
          };
          const grokPriceKey = Object.keys(GROK_PRICING).find(k => grokModel.includes(k)) ?? "grok-3";
          const grokPrice = GROK_PRICING[grokPriceKey];
          const costUsd = (inTok / 1_000_000) * grokPrice.input + (outTok / 1_000_000) * grokPrice.output;
          searchUsage = { inputTokens: inTok, outputTokens: outTok, costUsd, model: grokModel };
        }
      } else if (engine === "gpt") {
        // GPT (OpenAI): razonamiento avanzado, código, escritura, multimodal
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error("OPENAI_API_KEY no configurada — contacta al administrador");
        // o1-mini retirado por OpenAI (27-10-2025).
        const VALID_GPT_MODELS = ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini"] as const;
        const gptModelId = typeof reqGptModel === "string" && (VALID_GPT_MODELS as readonly string[]).includes(reqGptModel) ? reqGptModel : "gpt-4.1-mini";
        const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: gptModelId,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userContent },
            ],
            // Los modelos de razonamiento (o*) rechazan max_tokens y temperature.
            ...(/^o\d/.test(gptModelId)
              ? { max_completion_tokens: 16384 }
              : { max_tokens: 16384, temperature: 0.7 }),
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!gptRes.ok) {
          const errText = await gptRes.text().catch(() => "");
          throw new Error(`OpenAI API error (${gptRes.status}): ${errText.slice(0, 300)}`);
        }
        const gptData = await gptRes.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        answer = gptData.choices?.[0]?.message?.content || "GPT no pudo generar una respuesta. Prueba con otro motor.";
        engineUsed = gptModelId;
        if (gptData.usage) {
          const inTok = gptData.usage.prompt_tokens ?? 0;
          const outTok = gptData.usage.completion_tokens ?? 0;
          const GPT_PRICING: Record<string, { input: number; output: number }> = {
            "gpt-4.1-nano":  { input: 0.10,  output: 0.40  },
            "gpt-4.1-mini":  { input: 0.40,  output: 1.60  },
            "gpt-4.1":       { input: 2.00,  output: 8.00  },
            "gpt-4o":        { input: 2.50,  output: 10.00 },
            "gpt-4o-mini":   { input: 0.15,  output: 0.60  },
            "o1-mini":       { input: 1.10,  output: 4.40  },
            "o3-mini":       { input: 1.10,  output: 4.40  },
          };
          const priceKey = Object.keys(GPT_PRICING).find(k => gptModelId.includes(k)) ?? "gpt-4.1-mini";
          const gptPrice = GPT_PRICING[priceKey];
          const costUsd = (inTok / 1_000_000) * gptPrice.input + (outTok / 1_000_000) * gptPrice.output;
          searchUsage = { inputTokens: inTok, outputTokens: outTok, costUsd, model: gptModelId };
        }
      } else if (engine === "nvidia") {
        // NVIDIA NIM — OpenAI-compatible endpoint, access to Llama, Mistral, Qwen, Phi, VILA, Nemotron
        // Fallback: si no hay key o la llamada falla → Claude (plataforma siempre funcional)
        const nvidiaKey = process.env.NVIDIA_API_KEY;
        if (!nvidiaKey) {
          logger.warn("[shopybrain] NVIDIA_API_KEY ausente — fallback a Claude");
          const claudeFallback = await askClaudeWithUsage(
            resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
            [{ role: "user", content: userContent }],
            sysPrompt,
            32000,
            300_000,
          );
          answer = claudeFallback.text;
          searchUsage = claudeFallback.usage;
          engineUsed = "claude (nvidia-fallback: sin key)";
          // Skip the rest of the nvidia block
        } else {
        const reqNvidiaModel = (req.body as { nvidiaModel?: string }).nvidiaModel;
        const VALID_NVIDIA_MODELS = [
          // ── Flagship Nemotron ─────────────────────────────────────────
          "nvidia/llama-3.3-nemotron-super-49b-v1",
          "nvidia/llama-3.3-nemotron-super-49b-v1.5",
          "nvidia/llama-3.1-nemotron-ultra-253b-v1",
          "nvidia/nemotron-4-340b-instruct",
          "nvidia/llama-3.1-nemotron-nano-8b-v1",
          "nvidia/nvidia-nemotron-nano-9b-v2",
          "nvidia/nemotron-3-super-120b-a12b",
          "nvidia/nemotron-3-ultra-550b-a55b",
          "nvidia/nemotron-3-nano-30b-a3b",
          "nvidia/mistral-nemo-minitron-8b-8k-instruct",
          "nvidia/nemotron-mini-4b-instruct",
          // ── Meta Llama 4 / 3.x ───────────────────────────────────────
          "meta/llama-4-maverick-17b-128e-instruct",
          "meta/llama-3.3-70b-instruct",
          "meta/llama-3.1-70b-instruct",
          "meta/llama-3.1-8b-instruct",
          "meta/llama-3.1-405b-instruct",
          // ── DeepSeek ─────────────────────────────────────────────────
          "deepseek-ai/deepseek-v4-pro",
          "deepseek-ai/deepseek-v4-flash",
          // ── Mistral ──────────────────────────────────────────────────
          "mistralai/mistral-large-3-675b-instruct-2512",
          "mistralai/mistral-large-2-instruct",
          "mistralai/mistral-medium-3.5-128b",
          "mistralai/mistral-nemotron",
          "mistralai/mistral-small-4-119b-2603",
          "mistralai/mixtral-8x22b-v0.1",
          // ── Qwen ─────────────────────────────────────────────────────
          "qwen/qwen3.5-397b-a17b",
          "qwen/qwen3.5-122b-a10b",
          "qwen/qwen3-next-80b-a3b-instruct",
          // ── Microsoft ────────────────────────────────────────────────
          "microsoft/phi-4-mini-instruct",
          "microsoft/phi-3.5-moe-instruct",
          // ── Google ───────────────────────────────────────────────────
          "google/gemma-4-31b-it",
          "google/gemma-3-12b-it",
          "google/gemma-3-4b-it",
          // ── MiniMax / Kimi / ByteDance ───────────────────────────────
          "minimaxai/minimax-m3",
          "minimaxai/minimax-m2.7",
          "moonshotai/kimi-k2.6",
          "bytedance/seed-oss-36b-instruct",
          // ── Especializados ────────────────────────────────────────────
          "writer/palmyra-creative-122b",
          "writer/palmyra-fin-70b-32k",
          "writer/palmyra-med-70b",
          "nvidia/llama3-chatqa-1.5-70b",
          "ai21labs/jamba-1.5-large-instruct",
          "stepfun-ai/step-3.7-flash",
          "stepfun-ai/step-3.5-flash",
          "moonshotai/kimi-k2.6",
        ] as const;
        const nvidiaModelId = typeof reqNvidiaModel === "string" && (VALID_NVIDIA_MODELS as readonly string[]).includes(reqNvidiaModel)
          ? reqNvidiaModel
          : "nvidia/llama-3.3-nemotron-super-49b-v1";
        const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${nvidiaKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: nvidiaModelId,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userContent },
            ],
            max_tokens: 16384,
            temperature: 0.7,
            stream: false,
          }),
          signal: AbortSignal.timeout(120_000),
        });
        let nvidiaOk = false;
        if (nvidiaRes.ok) {
          const nvidiaData = await nvidiaRes.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
          answer = nvidiaData.choices?.[0]?.message?.content || "";
          if (answer) {
            nvidiaOk = true;
            engineUsed = nvidiaModelId.split("/")[1] ?? nvidiaModelId;
            if (nvidiaData.usage) {
              const inTok = nvidiaData.usage.prompt_tokens ?? 0;
              const outTok = nvidiaData.usage.completion_tokens ?? 0;
              const NVIDIA_PRICING: Record<string, { input: number; output: number }> = {
                "llama-3.3-nemotron-super-49b-v1":    { input: 0.40, output: 1.20 },
                "llama-3.3-nemotron-super-49b-v1.5":  { input: 0.40, output: 1.20 },
                "llama-3.1-nemotron-ultra-253b-v1":   { input: 1.00, output: 3.00 },
                "nemotron-4-340b-instruct":            { input: 1.50, output: 4.50 },
                "llama-3.1-nemotron-nano-8b-v1":      { input: 0.10, output: 0.10 },
                "nvidia-nemotron-nano-9b-v2":          { input: 0.10, output: 0.10 },
                "nemotron-3-super-120b-a12b":          { input: 0.60, output: 1.80 },
                "nemotron-3-ultra-550b-a55b":          { input: 2.00, output: 6.00 },
                "llama-4-maverick-17b-128e-instruct":  { input: 0.20, output: 0.60 },
                "llama-3.3-70b-instruct":              { input: 0.35, output: 0.40 },
                "llama-3.1-70b-instruct":              { input: 0.35, output: 0.40 },
                "llama-3.1-405b-instruct":             { input: 0.99, output: 2.99 },
                "deepseek-v4-pro":                     { input: 0.30, output: 0.90 },
                "deepseek-v4-flash":                   { input: 0.10, output: 0.30 },
                "mistral-large-3-675b-instruct-2512":  { input: 1.80, output: 5.40 },
                "mistral-large-2-instruct":            { input: 0.40, output: 1.20 },
                "mistral-medium-3.5-128b":             { input: 0.30, output: 0.90 },
                "mistral-nemotron":                    { input: 0.45, output: 1.35 },
                "qwen3.5-397b-a17b":                   { input: 0.80, output: 2.40 },
                "qwen3.5-122b-a10b":                   { input: 0.40, output: 1.20 },
                "palmyra-creative-122b":               { input: 0.60, output: 1.80 },
                "palmyra-fin-70b-32k":                 { input: 0.50, output: 1.50 },
                "palmyra-med-70b":                     { input: 0.50, output: 1.50 },
                "minimax-m3":                          { input: 0.40, output: 1.20 },
                "kimi-k2.6":                           { input: 0.50, output: 1.50 },
                "phi-4-mini-instruct":                 { input: 0.10, output: 0.10 },
              };
              const nvidiaShortName = nvidiaModelId.split("/")[1] ?? "";
              const nvPriceKey = Object.keys(NVIDIA_PRICING).find(k => nvidiaShortName.includes(k)) ?? "llama-3.3-nemotron-super-49b-v1";
              const nvPrice = NVIDIA_PRICING[nvPriceKey] ?? { input: 0.40, output: 1.20 };
              const costUsd = (inTok / 1_000_000) * nvPrice.input + (outTok / 1_000_000) * nvPrice.output;
              searchUsage = { inputTokens: inTok, outputTokens: outTok, costUsd, model: engineUsed };
            }
          }
        }
        if (!nvidiaOk) {
          // Fallback a Claude si NVIDIA falló o devolvió respuesta vacía
          const errStatus = nvidiaRes.ok ? "respuesta vacía" : `HTTP ${nvidiaRes.status}`;
          logger.warn({ errStatus }, "[shopybrain] NVIDIA NIM falló — fallback a Claude");
          const claudeFallback = await askClaudeWithUsage(
            resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
            [{ role: "user", content: userContent }],
            sysPrompt,
            32000,
            300_000,
          );
          answer = claudeFallback.text;
          searchUsage = claudeFallback.usage;
          engineUsed = `claude (nvidia-fallback: ${errStatus})`;
        }
        } // close else (nvidiaKey exists)
      } else {
        // Claude: escritura profunda, guiones, código, JSON estructurado, razonamiento complejo
        // "claude-haiku-3-5" y "claude-opus-4" no son IDs válidos de la API (Haiku 3.5
        // está retirado): elegir "Haiku" en el chat devolvía error siempre. Se
        // aceptan como alias de clientes antiguos y se traducen a modelos vigentes.
        const VALID_CLAUDE_MODELS = ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-sonnet-4-6", "claude-sonnet-5", "claude-opus-4-8", "claude-opus-5"] as const;
        const LEGACY_CLAUDE_ALIASES: Record<string, string> = { "claude-haiku-3-5": "claude-haiku-4-5", "claude-opus-4": "claude-opus-4-8" };
        const reqClaudeResolved = typeof reqClaudeModel === "string" ? (LEGACY_CLAUDE_ALIASES[reqClaudeModel] ?? reqClaudeModel) : undefined;
        const claudeModelOverride = reqClaudeResolved && (VALID_CLAUDE_MODELS as readonly string[]).includes(reqClaudeResolved) ? reqClaudeResolved : undefined;
        const claudeResult = await askClaudeWithUsage(
          resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
          [{ role: "user", content: userContent }],
          sysPrompt,
          32000,
          300_000,
          claudeModelOverride ? { model: claudeModelOverride } : undefined,
        );
        answer = claudeResult.text;
        searchUsage = claudeResult.usage;
        engineUsed = engine === "claude" ? (claudeModelOverride ?? "claude") : engine === "auto" ? "auto→claude+omnicore" : "claude+omnicore";
      }

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
  
      learnFromConversation(query, cleanAnswer, niche, detectedAction?.action);

      if (searchUsage) {
        const providerMap: Record<string, "claude" | "gemini" | "grok"> = {
          "gemini": "gemini",
          "gemini+search": "gemini",
          "auto→gemini+search": "gemini",
          "grok": "grok",
          "grok-3": "grok",
          "grok-3-mini": "grok",
        };
        const resolvedProvider = Object.keys(providerMap).find(k => engineUsed.includes(k))
          ? providerMap[Object.keys(providerMap).find(k => engineUsed.includes(k))!]
          : "claude";
        const resolvedProjectId = req.body.activeProjectId ? parseInt(req.body.activeProjectId) || null : null;
        recordApiUsage({
          provider: resolvedProvider,
          operation: "chat",
          model: searchUsage.model,
          projectId: resolvedProjectId,
          inputUnits: searchUsage.inputTokens,
          outputUnits: searchUsage.outputTokens,
          unitsLabel: "tokens",
          costUsd: searchUsage.costUsd,
          success: true,
          sessionId: typeof chatSessionId === "string" && chatSessionId ? chatSessionId : null,
          metadata: { engine: engineUsed, querySnippet: String(query ?? "").slice(0, 200) },
        }).catch(() => {});
      }

      res.json({
        answer: cleanAnswer,
        source: engineUsed,
        engine,
        usage: searchUsage ?? null,
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
        message: `⚡ Respuesta desde Shopy Crafter (${existingMemories.length} memorias relevantes)`,
      });
      return;
    }
  
    const activeProjectId = req.body.activeProjectId;
    const researchSystemPrompt = `Eres Shopy Crafter, el megacerebro de eCommerce Shopify con acceso a todo el conocimiento acumulado de la plataforma.
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
          16000
        );
      } else {
        // Sin proyecto activo: contexto global (0). Antes se usaba el proyecto 2 fijo,
        // con su ADN de marca y, si la tenía, su propia API key de Anthropic.
        aiContent = await askClaudeWithBrain(
          0,
          [{ role: "user", content: query }],
          researchSystemPrompt,
          "general",
          niche || undefined,
          16000
        );
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/insights", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/study", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { domains: requestedDomains, sessionType = "manual_trigger" } = req.body;
    const domainsToStudy = requestedDomains ?? Object.keys(DOMAIN_LABELS).slice(0, 4);
    const startTime = Date.now();
  
    enableLongRunning(res);
  
    const systemPrompt = `Eres Shopy Crafter — el MEGACEREBRO OMNISCIENTE que aprende de TODAS las disciplinas del conocimiento humano.
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
  
    const studyQuery = `Realiza sesión de estudio para dominios: ${domainsToStudy.join(", ")}`;
    // Contexto global (0), no el proyecto 2 fijo de antes. JSON validado: antes un fallo
    // de parseo registraba una sesión "completada" con 0 insights; ahora 502.
    const parsed = await askClaudeJsonValidated(0, studyQuery, systemPrompt, {
      schema: studySessionSchema,
      useCase: "general",
      maxTokens: 16000,
      label: "shopybrain/study",
    });

    const sessionId = randomBytes(16).toString("hex");
    let insightsCreated = 0;
  
    if (parsed.insights.length) {
      for (const insight of parsed.insights) {
        await db.insert(omnicoreInsightsTable).values({
          id: randomBytes(16).toString("hex"),
          domain: insight.domain ?? domainsToStudy[0],
          insightType: insight.insightType,
          title: insight.title,
          insight: insight.insight,
          evidence: insight.evidence ?? null,
          confidence: insight.confidence ?? 0.6,
          impactScore: insight.impactScore ?? 0.5,
          relatedDomains: insight.relatedDomains.length ? JSON.stringify(insight.relatedDomains) : null,
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
      keyDiscoveries: parsed.keyDiscoveries.length ? JSON.stringify(parsed.keyDiscoveries) : null,
      tokensUsed: JSON.stringify(parsed).length,
    });
  
    res.json({
      success: true,
      sessionId,
      insightsCreated,
      summary: parsed.summary,
      keyDiscoveries: parsed.keyDiscoveries,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/sessions", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const sessions = await db.select().from(omnicoreStudySessionsTable)
      .orderBy(desc(omnicoreStudySessionsTable.createdAt))
      .limit(20);
    res.json(sessions);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/niche-profiles", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const profiles = await db.select().from(omnicoreNicheProfilesTable)
      .orderBy(desc(omnicoreNicheProfilesTable.storesAnalyzed));
    res.json(profiles);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/niche-profiles", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/prompt-library", requireAuth, async (_req, res): Promise<void> => {
  try {
    const prompts = await db.select().from(omnicorePromptLibraryTable)
      .orderBy(desc(omnicorePromptLibraryTable.useCount));
    res.json(prompts);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/prompt-library", requireAuth, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ─── TRIGGERS MANUALES 24/7 ──────────────────────────────────────────────────
router.post("/shopybrain/run/micro-learning", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreMicroLearning } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "⚡ Micro-learning cycle iniciado" });
    runOmniCoreMicroLearning().catch(e => console.error("micro-learning error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/consolidation", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreMemoryConsolidation } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🧠 Memory consolidation iniciada" });
    runOmniCoreMemoryConsolidation().catch(e => console.error("consolidation error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/cross-synthesis", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreCrossConnections } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🔗 Cross-domain synthesis iniciada" });
    runOmniCoreCrossConnections().catch(e => console.error("cross-synthesis error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/daily-study", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreDailyDeepStudy } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🎓 Daily deep study iniciado (14 dominios)" });
    runOmniCoreDailyDeepStudy().catch(e => console.error("daily-study error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/mega-synthesis", requireAdmin, async (_req, res): Promise<void> => {
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
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});


router.post("/shopybrain/execute-action", requireAdmin, async (req, res): Promise<void> => {
  enableLongRunning(res);
  let { action, params } = req.body;
  if (!action) { res.status(400).json({ error: "action requerida" }); return; }
  
  const SENSITIVE_KEYS = new Set(["password", "token", "secret", "accessToken", "clientSecret", "inviteToken", "apiKey"]);

  // ── Auto-crear proyecto "Shopy Crafter" cuando no hay projectId ──────────────
  const missingProjectId = !params?.projectId || params.projectId === 0 || params.projectId === "0" || params.projectId === "";
  if (missingProjectId) {
    try {
      // Buscar proyecto por defecto existente
      const [existing] = await db.select({ id: projectsTable.id, name: projectsTable.name })
        .from(projectsTable)
        .where(eq(projectsTable.shopDomain, "shopycrafter.internal"))
        .limit(1);
      if (existing) {
        params = { ...(params ?? {}), projectId: String(existing.id) };
        logger.info({ resolvedId: existing.id }, "[execute-action] No projectId — using default 'Shopy Crafter' project");
      } else {
        // Crear proyecto por defecto
        const [created] = await db.insert(projectsTable).values({
          name: "Shopy Crafter",
          platformType: "universal" as const,
          shopDomain: "shopycrafter.internal",
          clientId: "",
          clientSecret: "",
          plan: "admin" as const,
          planRenewsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        }).returning();
        params = { ...(params ?? {}), projectId: String(created.id) };
        logger.info({ createdId: created.id }, "[execute-action] No projectId — created default 'Shopy Crafter' project");
      }
    } catch (autoCreateErr) {
      logger.warn({ err: autoCreateErr }, "[execute-action] Could not auto-create default project");
    }
  }

    // Muchas acciones meten ids en la ruta de llamadas internas (localhost + cookie del
    // admin). Un id con "/", "?", "#", "%" o ".." podía llevar a OTRO endpoint de admin.
    const badId = Object.entries(params ?? {}).find(([k, v]) =>
      /(^id$|Id$|Ids?$|^slug$|^handle$)/.test(k) && typeof v === "string" && /[\/?#%\\]|\.\./.test(v));
    if (badId) {
      res.status(400).json({ error: `Parámetro no válido: ${badId[0]}` });
      return;
    }

    if (params?.projectId && isNaN(parseInt(String(params.projectId)))) {
      const allProjects = await db.select({ id: projectsTable.id, shopDomain: projectsTable.shopDomain }).from(projectsTable).limit(500);
      if (allProjects.length === 1) {
        params.projectId = String(allProjects[0].id);
        logger.info({ originalId: params.projectId, resolvedId: allProjects[0].id }, "Resolved non-numeric projectId to only available project");
      } else {
        // Solo si el texto contiene el dominio completo (antes bastaba con una letra en común).
        const asked = String(params.projectId).toLowerCase();
        const byDomain = allProjects.find(p => !!p.shopDomain && asked.includes(p.shopDomain.toLowerCase()));
        if (byDomain) {
          params.projectId = String(byDomain.id);
        } else if (allProjects.length > 0) {
          // Antes se usaba el PRIMER proyecto: una acción podía caer en la tienda de otro cliente.
          res.status(400).json({ error: `No sé a qué proyecto te refieres con "${String(params.projectId).slice(0, 60)}". Indica el número de proyecto.` });
          return;
        } else {
          res.status(400).json({ error: "projectId no válido y no hay proyectos registrados" });
          return;
        }
      }
    }
  
    try {
      let result: Record<string, unknown> = {};

      // CRIT-6: Confirmación obligatoria para acciones destructivas (centralizado)
      const confirmationGuard = requireConfirmation(params, action, {
        summary:
          `Vas a ejecutar la acción \`${action}\`` +
          (params?.projectId ? ` sobre el proyecto ${params.projectId}` : "") +
          (params?.productId ? `, producto ${params.productId}` : "") +
          (params?.collectionId ? `, colección ${params.collectionId}` : "") +
          (params?.userId ? `, usuario ${params.userId}` : "") +
          ". Esta operación es destructiva o de gran alcance y no se puede deshacer fácilmente.",
      }, req.session as unknown as ConfirmSession);
      if (confirmationGuard) {
        res.json(confirmationGuard);
        return;
      }

      // Pre-check: para acciones que requieren la API de Shopify, verificar token
      const SHOPIFY_API_ACTIONS = new Set([
        "store_status", "list_products", "list_all_products", "create_product", "update_product",
        "delete_product", "scan_store", "optimize_product", "optimize_all_products", "redesign_product",
        "bulk_redesign", "change_price", "set_product_status", "list_themes", "audit_theme",
        "read_theme_file", "edit_theme_file", "edit_theme_css", "edit_theme_settings",
        "create_theme_section", "list_theme_files", "generate_all_metas", "fix_all_alt_texts",
        "generate_schemas", "seo_full_audit", "list_collections", "create_collection",
        "auto_collections", "edit_collection", "delete_collection", "get_collection_products",
        "remove_from_collection", "list_pages", "create_page", "design_all_pages", "get_orders",
        "update_product_price", "bulk_update_prices", "update_stock", "bulk_update_stock",
        "sync_catalog_prices", "price_audit", "list_products_with_prices",
        "list_variants", "add_variant", "edit_variant", "delete_variant",
        "inventory_sync", "inventory_sync_orders", "inventory_alerts",
        "bulk_generate_images", "optimize_images", "generate_sitemap",
        "setup_full_store", "copyright_audit", "regenerate_token",
        "fusion_create_product", "audit_page_speed",
      ]);

      if (SHOPIFY_API_ACTIONS.has(action) && params?.projectId) {
        const [projCheck] = await db.select({ accessToken: projectsTable.accessToken, tokenExpiresAt: projectsTable.tokenExpiresAt })
          .from(projectsTable).where(eq(projectsTable.id, parseInt(String(params.projectId)))).limit(1);
        if (projCheck) {
          const hasToken = !!projCheck.accessToken;
          const tokenExpired = hasToken && projCheck.tokenExpiresAt ? new Date(projCheck.tokenExpiresAt) < new Date() : false;
          if (!hasToken) {
            res.json({ error: true, message: `⚠️ **Token de Shopify no configurado**\n\nEsta acción (\`${action}\`) requiere conexión con tu tienda Shopify, pero no hay ningún token de acceso configurado.\n\n👉 Ve a **Configuración → Integración Shopify** para conectar tu tienda.` });
            return;
          }
          if (tokenExpired) {
            res.json({ error: true, message: `🔑 **Token de Shopify caducado**\n\nEsta acción (\`${action}\`) requiere acceso a tu tienda Shopify, pero el token ha expirado.\n\n👉 Ve a **Configuración → Integración Shopify** para renovar el token de acceso.\n\n_Las funciones que no necesitan Shopify (informes IA, análisis, gestión de usuarios, CMS, etc.) siguen funcionando normalmente._` });
            return;
          }
        }
      }

      // Stripe helper — declarado FUERA del switch: dentro de un `case` posterior quedaría en TDZ (ReferenceError en runtime)
      // Helper: auto-resolve accountId — returns first connected Stripe account if not provided
      const resolveStripeAccountId = async (rawId?: string): Promise<string | null> => {
        if (rawId && rawId !== "undefined" && rawId.length > 4) return rawId;
        const port2 = process.env.PORT || 8080;
        // Prioridad: la cuenta del proyecto activo → primera cuenta vinculada
        const pidQ = Number(params?.projectId) > 0 ? `?projectId=${Number(params.projectId)}` : "";
        try {
          const r2 = await fetch(`http://localhost:${port2}/api/stripe/accounts${pidQ}`, { headers: { cookie: req.headers.cookie || "" } });
          if (!r2.ok) return null;
          const d2 = await r2.json() as any;
          const accs: any[] = Array.isArray(d2) ? d2 : (d2.accounts || []);
          if (!accs.length) return null;
          return accs[0].accountId || accs[0].account_id || null;
        } catch { return null; }
      };

      const outcome = await dispatchBrainAction({ req, res, action, params, resolveStripeAccountId });
      if (outcome === undefined) return; // la acción ya respondió
      if (outcome === NOT_HANDLED) { res.status(400).json({ error: `Acción desconocida: ${action}` }); return; }
      result = outcome;
  
      const redactParams = (p: Record<string, unknown> | undefined): Record<string, unknown> => {
        if (!p) return {};
        const safe: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(p)) {
          safe[k] = SENSITIVE_KEYS.has(k) ? "***REDACTED***" : v;
        }
        return safe;
      };
  
      const NON_LEARNABLE = new Set([
        "reset_user_password", "create_user", "list_users", "deactivate_user",
        "activate_user", "audit_log", "unread_messages",
      ]);
  
      const r = result as Record<string, unknown>;
      if (!r.error && !NON_LEARNABLE.has(action)) {
        const safeParams = redactParams(params);
        const enrichedContent = buildEnrichedLearningContent(action, safeParams, r);
        learnFromOperation({
          operationType: `chatbot_action_${action}`,
          title: enrichedContent.title,
          content: enrichedContent.content,
          confidence: enrichedContent.confidence,
          tags: ["chatbot", "action", action, ...(enrichedContent.extraTags || [])],
        });
      }
  
      const NON_SAVEABLE = new Set([
        "delete_product", "regenerate_token", "get_scopes",
        "read_cms", "update_cms", "update_cms_batch", "reset_cms",
        "inspect_code", "fix_code", "list_source_files",
        "edit_theme_file", "edit_theme_css", "edit_theme_settings",
        "brain_sync", "brain_export",
        "list_users", "reset_user_password", "audit_log", "unread_messages",
        "list_messages", "list_approvals", "list_automations", "list_email_flows",
      ]);
      const isSaveable = !NON_SAVEABLE.has(action);
      const pId = params?.projectId ? parseInt(params.projectId) : null;
      if (pId && isSaveable && !r.error) {
        const content = JSON.stringify(result, null, 2);
        saveToVault({
          projectId: pId,
          fileType: "brain_action",
          category: action,
          title: `Shopy Crafter: ${action} — ${new Date().toLocaleDateString("es-ES")}`,
          description: r.message ? String(r.message).slice(0, 500) : `Resultado de acción ${action}`,
          mimeType: "application/json",
          fileSizeBytes: Buffer.from(content).length,
          generatedBy: "shopybrain",
          content,
          metadata: { action, params: redactParams(params), timestamp: new Date().toISOString() },
        }).catch(() => {});
      }
  
      res.json({ success: true, action, ...result });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const safeLogParams = params ? Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, SENSITIVE_KEYS.has(k) ? "***" : v])
      ) : {};
      logger.error({ action, params: safeLogParams, error: errMsg }, "Chatbot action failed");
  
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
  try {
    const { runRetroactiveReanalysis } = await import("../lib/scheduler.js");
    runRetroactiveReanalysis().catch(e => logger.error(e));
    res.json({ message: "Retroactive reanalysis started in background" });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/run/self-evaluation", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runMonthlySelfEvaluation } = await import("../lib/scheduler.js");
    runMonthlySelfEvaluation().catch(e => logger.error(e));
    res.json({ message: "Monthly self-evaluation started in background" });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/upload", requireAdmin, upload.array("file", 10), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: "No se recibió ningún archivo" });
      return;
    }
    const settled = await Promise.allSettled(
      files.map(async (file) => {
        const processed = await processUploadedFile(file.buffer, file.originalname, file.mimetype);
        return {
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          processed,
        };
      })
    );
    const results = settled.map((s, i) =>
      s.status === "fulfilled"
        ? { ...s.value, success: true }
        : { fileName: files[i].originalname, mimeType: files[i].mimetype, size: files[i].size, success: false, error: s.reason?.message || "Error procesando archivo" }
    );
    const successCount = results.filter(r => r.success).length;
    if (files.length === 1 && results[0].success) {
      const r = results[0] as { fileName: string; mimeType: string; size: number; processed: unknown; success: boolean };
      res.json({ success: true, fileName: r.fileName, mimeType: r.mimeType, size: r.size, processed: r.processed });
    } else {
      res.json({ success: successCount > 0, count: results.length, successCount, files: results });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GEMINI STREAM SSE ────────────────────────────────────────────────────────
// Endpoint para streaming real de Gemini hacia el chatbot admin.
// Emite eventos SSE: data: {"text":"..."} y data: {"done":true,"sources":[...]}
router.post("/shopybrain/gemini-stream", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { messages, systemPrompt, thinkingBudget = 0, useSearch = true, useProModel = false } = req.body as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      systemPrompt?: string;
      thinkingBudget?: number;
      useSearch?: boolean;
      useProModel?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages requerido" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const { askGeminiStream } = await import("../lib/gemini.js");
    const sysInstr = systemPrompt ?? "Eres Shopy Crafter, asistente experto de eCommerce Shopify. Responde SIEMPRE en español. Sé directo y accionable.";

    const generator = askGeminiStream(messages, sysInstr, { useProModel, thinkingBudget, useSearch });

    for await (const chunk of generator) {
      if (res.destroyed) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      (res as any).flush?.();
    }

    if (!res.destroyed) res.end();
  } catch (err) {
    logger.error({ err }, "[gemini-stream] Error");
    if (!res.headersSent) res.status(500).json({ error: String(err) });
    else {
      res.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`);
      res.end();
    }
  }
});

// ─── GEMINI IMAGEN NATIVA ─────────────────────────────────────────────────────
// Genera imágenes con el modelo nativo de imagen de Gemini.
router.post("/shopybrain/gemini-image", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { prompt, model } = req.body as { prompt?: string; model?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt requerido" });
      return;
    }

    const { askGeminiGenerateImage } = await import("../lib/gemini.js");
    const t0 = Date.now();
    const result = await askGeminiGenerateImage(prompt.trim(), model);
    const generationTimeMs = Date.now() - t0;

    res.json({
      success: true,
      b64_json: result.b64_json,
      mimeType: result.mimeType,
      model: result.model,
      generationTimeMs,
      dataUrl: `data:${result.mimeType};base64,${result.b64_json}`,
    });
  } catch (err) {
    logger.error({ err }, "[gemini-image] Error");
    handleRouteError(res, err);
  }
});

// ─── GEMINI CODE EXECUTION ────────────────────────────────────────────────────
// Activa la tool codeExecution de Gemini para análisis de datos con Python real.
router.post("/shopybrain/gemini-code", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { prompt, systemInstruction } = req.body as { prompt?: string; systemInstruction?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt requerido" });
      return;
    }

    const { askGeminiWithCode } = await import("../lib/gemini.js");
    const result = await askGeminiWithCode(prompt.trim(), systemInstruction);

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "[gemini-code] Error");
    handleRouteError(res, err);
  }
});

export default router;
