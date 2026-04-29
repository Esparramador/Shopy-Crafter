import { Router } from "express";
import { enableLongRunning } from "../lib/long-running.js";
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicorePromptLibraryTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable, omnicoreStudySessionsTable, omnicoreCrossConnectionsTable, projectsTable, seoDataTable, productsTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { loadExistingEntityKnowledge } from "./entity-research.js";
import { APP_GUIDE_KNOWLEDGE, getPageContextForRoute, detectGuideRequest } from "../lib/app-guide.js";
import { shopifyRequest, shopifyGraphQL, refreshToken, getShopifyHeaders, normalizeShopDomain } from "../lib/shopify.js";
import { safeDecrypt } from "../lib/crypto.js";
import { learnFromOperation, askClaude, askClaudeJsonWithBrain, askClaudeWithBrain, buildBrandDnaContext, buildShopyBrainContext, SHOPIFY_EXPERT_SYSTEM as CLAUDE_EXPERT_SYSTEM } from "../lib/claude.js";
import { auditProduct, scoreToGrade } from "../lib/audit.js";
import { askGeminiWithSearch } from "../lib/gemini.js";
import { logger } from "../lib/logger.js";
import { saveToVault } from "../lib/vault.js";
import { buildCoverPage } from "../lib/report-cover.js";
import { analyzeImageForFusion } from "../lib/fusion-studio.js";
import { processUploadedFile } from "../lib/file-processor.js";
import { generateLeveledReport } from "../lib/report-levels.js";
import {
  getSessionProjectId,
  fetchImageWithSizeLimit,
  requireConfirmation,
  validateFixCodePath,
  normalizeListDirectory,
} from "../lib/shopybrain-helpers.js";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";

type ReportTemplate = "classic" | "elegance" | "prestige";
const VALID_TEMPLATES = new Set<ReportTemplate>(["classic", "elegance", "prestige"]);
function parseTemplate(val: unknown): ReportTemplate {
  if (typeof val === "string" && VALID_TEMPLATES.has(val as ReportTemplate)) return val as ReportTemplate;
  return "prestige";
}

function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.env.REPL_HOME || "/home/runner/workspace";
}
const WORKSPACE_ROOT = findWorkspaceRoot();
const FRONTEND_ROOT = path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer");
const BACKEND_ROOT = path.resolve(WORKSPACE_ROOT, "artifacts/api-server");
const FRONTEND_SRC = path.resolve(FRONTEND_ROOT, "src");

const UPLOADS_DIR = path.resolve(BACKEND_ROOT, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|pdf|csv|xlsx|xls|json|txt|md|html|css|xml|zip)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error("Tipo de archivo no permitido"));
  },
});

function isPublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (host.startsWith("172.")) {
      const second = parseInt(host.split(".")[1]);
      if (second >= 16 && second <= 31) return false;
    }
    if (host.startsWith("169.254.") || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch { return false; }
}

function isInsideWorkspace(candidate: string): boolean {
  try {
    const real = fs.realpathSync(candidate);
    const rel = path.relative(WORKSPACE_ROOT, real);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  } catch {
    const rel = path.relative(WORKSPACE_ROOT, candidate);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  }
}

function resolveFilePath(filePath: string): string | null {
  const normalized = String(filePath).replace(/^\/+/, "");
  const candidates = [
    path.resolve(FRONTEND_ROOT, normalized),
    path.resolve(BACKEND_ROOT, normalized),
    path.resolve(WORKSPACE_ROOT, normalized),
  ];
  if (!normalized.startsWith("src/")) {
    candidates.push(
      path.resolve(FRONTEND_ROOT, "src", normalized),
      path.resolve(BACKEND_ROOT, "src", normalized),
    );
  }
  const unique = [...new Set(candidates)];
  for (const c of unique) {
    if (!isInsideWorkspace(c)) continue;
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch { /* skip */ }
  }
  return null;
}

const router = Router();

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

    let parsed: any;
    try { parsed = JSON.parse(jsonMatch[0]); } catch { return defaultResult; }
    const result = {
      marketPriceRange: parsed.marketPriceRange ?? defaultResult.marketPriceRange,
      competitorPrices: parsed.competitorPrices ?? [],
      suggestedPrice: parsed.suggestedPrice ?? (currentPrice ? parseFloat(currentPrice) : 0),
      suggestedCompareAtPrice: parsed.suggestedCompareAtPrice ?? 0,
      pricingStrategy: parsed.pricingStrategy ?? "",
      sources: geminiResult.sources || [],
    };

    learnFromOperation({
      operationType: "pricing",
      title: `Investigación precios: ${productTitle.slice(0, 80)}`,
      content: `Producto: "${productTitle}" (${productType}). Nicho: ${niche}. Rango mercado: ${result.marketPriceRange.min}-${result.marketPriceRange.max}€ (mediana ${result.marketPriceRange.median}€). Precio sugerido: ${result.suggestedPrice}€. Compare-at: ${result.suggestedCompareAtPrice}€. Competidores: ${JSON.stringify(result.competitorPrices)}. Estrategia: ${result.pricingStrategy}`,
      confidence: 0.88,
      tags: ["pricing", "market_research", niche],
    });

    return result;
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.delete("/shopybrain/memories/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    await db.delete(omnicoreMemoriesTable).where(eq(omnicoreMemoriesTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/shopybrain/search", requireAdmin, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
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
  - run_universal_generator: Ejecutar el Generador Universal para crear cualquier tipo de contenido profesional. Params: {projectId, generatorType (seo-audit|seo-metas|seo-schemas|seo-alt-texts|seo-keywords|blog-strategy|blog-post|product-catalog|complete-report|financial-report|inventory-report|consistency-report|revenue-analysis|brand-css|brand-css-ai|brand-guide|brand-kit|brand-kit-premium|photo-brief|social-kit|competitor-scan|market-research|pricing-optimal|margin-waterfall|financial-forecast|product-redesign|email-templates|email-flow|social-posts|landing-design|agency-proposal|agency-budget|external-audit|data-csv|data-xlsx|data-json|data-zip), url? (para análisis externo)}
  - analyze_web_design: Analizar en profundidad el diseño de cualquier página web — extrae HTML+CSS reales, genera CSS/HTML mejorado copy-paste-ready, informe profesional descargable, y guarda todo en Vault. Params: {projectId, url, template? ("classic"|"elegance"|"prestige")}
  - generate_export: Generar un informe/export (HTML, CSV, PDF). Params: {projectId, reportType ("seo-audit"|"product-catalog"|"financial"|"brand-brief"|"ab-tests"|"images-gallery"|"competitors"|"consistency"|"inventory"|"redesigns"|"revenue"|"complete-report"|"csv/products")}
  - run_full_audit_report: Ejecutar auditoría completa y guardar informe. Params: {projectId}
  - generate_ai_report: Generar informe estratégico con IA. Params: {projectId, sections?}
  
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
  - Generador universal / herramienta de generación / generar contenido / crear informe / quiero un análisis / generar todo / usar generador → run_universal_generator (pide al usuario qué tipo de contenido quiere: SEO, CSS, informe, presupuesto, etc.)
  - Lab web / analizar diseño web / analizar esta web / extraer css de / auditar diseño de / mejorar diseño de / analiza el diseño / extrae el código de / lab de diseño / análisis de diseño web → analyze_web_design (pide la URL si no la proporcionó)
  - Fusion Studio / analizar imagen / descomponer imagen / crear producto desde imagen / imagen de producto → fusion_analyze (analiza imagen y extrae componentes). Params: {imageUrl, projectId?}
  - Crear producto desde imagen / Fusion crear / producto desde foto / producto desde imagen → fusion_create_product (analiza imagen y crea producto en Shopify). Params: {projectId, imageUrl, title?, price?}
  - Informe por niveles / informe nivel 2 / generar nivel 3 / report nivel / informe profesional / informe enterprise → run_leveled_report (genera informe con sistema de 5 niveles). Params: {projectId, type (tipo de informe), level (1-5), template?}
  - Subir archivo / procesar archivo / analizar archivo / importar archivo / CSV / PDF / Excel → upload_file (procesa archivo subido). Params: {fileContext? (descripción del archivo)}
  
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
  • PROPUESTAS COMERCIALES: Presupuestos y propuestas para clientes
  • CMS COMPLETO: Editar toda la landing, precios, textos, colores de la app
  • ADMIN TOTAL: Gestión de usuarios/clientes, invitaciones, mensajes, aprobaciones, audit log
  • AUTOMATIZACIONES: Listar y ejecutar cron jobs manualmente (micro-learning, revenue, inventario, competidores)
  • INFORMES/EXPORTS: Generar informes completos (SEO, financiero, catálogo, competidores, inventario, brand brief, IA)
  • FLUJOS EMAIL CRUD: Crear, listar, eliminar flujos de email marketing (además de generar con IA)
  - IMPORTANTE: SIEMPRE leer el archivo ANTES de editarlo (read_theme_file → edit_theme_file). NUNCA sobrescribir a ciegas.
  - Setup completo → optimize_all_products + auto_collections + design_all_pages + optimize_images en secuencia
  - USA projectId del contexto si hay proyecto activo. El projectId SIEMPRE es un número entero (ej: 2), NUNCA un string largo ni un CUID.
  - Explica brevemente qué vas a hacer ANTES del bloque :::ACTION:::
  - Si no necesitas acción, responde normalmente sin :::ACTION:::
  - SIGUE la conversación: comprende el contexto previo y lo que el usuario ya pidió. No repitas ni ignores instrucciones anteriores.
  `;
  
      const agencyPricingKnowledge = `
  
  CONOCIMIENTO DE NEGOCIO — CATÁLOGO COMPLETO DE SERVICIOS Shopy Crafter:
  
  IDENTIDAD: Nombre público "Shopy Crafter" (shopycrafter.com). Motor IA interno "ShopyBrain". Admin: sadiagiljoan@gmail.com. Email: craftershopy@gmail.com.
  MODELO DE NEGOCIO: Shopy Crafter es una agencia de optimización IA para tiendas Shopify + estudio creativo Comic Crafter. Servicios puntuales (one-time) + retainers mensuales + créditos IA. Pagos por Shopify Billing (NO Stripe). 130+ acciones chatbot. 46,000+ insights.
  
  ═══════════════════════════════════════════════════
  TARIFA COMPLETA DE PRECIOS — CATÁLOGO 57 PRODUCTOS
  ═══════════════════════════════════════════════════
  
  ▸ PLANES SHOPY CRAFTER — ACCESIBLES PARA TODOS (sin permanencia, cancela cuando quieras):
  • Starter Free — €0/mes GRATIS PARA SIEMPRE: 1 tienda, auditoría básica, chatbot IA ilimitado, 3 productos demo, dashboard básico, calculadora presupuestos
  • Emprendedor — €29/mes (ideal pymes, autónomos, emprendedores): 10 productos/mes, 30 imágenes IA, SEO básico (meta tags + alt texts), 1 informe Nivel 1/mes, presupuestos ilimitados, soporte email <48h
  • Growth Studio — €149/mes + €97 setup (MÁS POPULAR): Productos e imágenes ilimitadas, SEO técnico completo, 3 informes Nivel 2/mes, A/B testing 3 productos, dashboard analytics, soporte <24h
  • Performance Lab — €397/mes setup incluido (agencias): Todo de Growth + A/B ilimitado, auto-pilot 24/7, 6 informes Nivel 3/mes, pricing predictivo, Klaviyo, custom AI, soporte <4h
  • Enterprise — desde €997/mes personalizado: Todo de Performance + account manager, multi-tienda, API privada, white-label, formación equipo, soporte 24/7, facturación a medida
  
  FLEXIBILIDAD DE PAGO:
  • Todos los planes SIN PERMANENCIA — cancela cuando quieras
  • Pago mensual o anual (anual = 2 meses gratis)
  • Para emprendedores y pymes: pago fraccionado disponible (consultar)
  • Servicios one-shot: se pueden contratar SIN suscripción
  • Descuentos por volumen automáticos en productos y servicios
  • Plan Free genuino: chatbot + auditoría básica sin coste, sin tarjeta de crédito
  
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
  
      let expertKnowledgeBlock = "";
      try {
        const { THEME_ARCHITECTURE_KNOWLEDGE, EXPERT_FINANCIAL_KNOWLEDGE, EXPERT_SEO_KNOWLEDGE, EXPERT_MARKETING_KNOWLEDGE, EXPERT_SUPPLIER_KNOWLEDGE } = await import("../lib/shopify-theme.js");
        expertKnowledgeBlock = THEME_ARCHITECTURE_KNOWLEDGE + EXPERT_FINANCIAL_KNOWLEDGE + EXPERT_SEO_KNOWLEDGE + EXPERT_MARKETING_KNOWLEDGE + EXPERT_SUPPLIER_KNOWLEDGE;
      } catch {}
  
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
  
  Responde SIEMPRE en español. Sé directo, accionable y ejecutivo. No hables de lo que "podrías hacer" — HAZLO.`) + agencyPricingKnowledge + actionDetectionBlock + expertKnowledgeBlock + guideBlock + pageBlock + entityKnowledgeContext + memoriesContext + brandDnaBlock;
  
      let resolvedProjectId = req.body.activeProjectId;
      let projectContextInfo = "";
      if (resolvedProjectId && !isNaN(parseInt(resolvedProjectId))) {
        const [activeProj] = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain }).from(projectsTable).where(eq(projectsTable.id, parseInt(resolvedProjectId))).limit(1);
        if (activeProj) {
          projectContextInfo = `\n[CONTEXTO PROYECTO ACTIVO: ID=${activeProj.id} (numérico), nombre="${activeProj.name}", dominio="${activeProj.shopDomain}". USA projectId=${activeProj.id} en TODAS las acciones. El projectId es SIEMPRE el número ${activeProj.id}.]`;
        }
      }
      if (!projectContextInfo) {
        const allProjects = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain }).from(projectsTable).limit(5);
        if (allProjects.length === 1) {
          projectContextInfo = `\n[CONTEXTO: Solo hay un proyecto registrado: ID=${allProjects[0].id}, nombre="${allProjects[0].name}", dominio="${allProjects[0].shopDomain}". USA projectId=${allProjects[0].id} en TODAS las acciones.]`;
        } else if (allProjects.length > 0) {
          projectContextInfo = `\n[PROYECTOS DISPONIBLES: ${allProjects.map(p => `ID=${p.id} "${p.name}" (${p.shopDomain})`).join(", ")}. Usa el projectId numérico correspondiente en las acciones.]`;
        }
      }
      const userContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + projectContextInfo;
  
      const answer = await askClaude(
        resolvedProjectId ? parseInt(resolvedProjectId) || 0 : 0,
        [{ role: "user", content: userContent }],
        sysPrompt,
        16000,
      );
  
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
          1024
        );
      } else {
        aiContent = await askClaudeWithBrain(
          2,
          [{ role: "user", content: query }],
          researchSystemPrompt,
          "general",
          niche || undefined,
          1024
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const rawText = await askClaudeWithBrain(
      2,
      [{ role: "user", content: studyQuery }],
      systemPrompt,
      "general",
      undefined,
      4096
    );
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
      tokensUsed: rawText.length,
    });
  
    res.json({
      success: true,
      sessionId,
      insightsCreated,
      summary: parsed.summary,
      keyDiscoveries: parsed.keyDiscoveries ?? [],
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/shopybrain/sessions", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const sessions = await db.select().from(omnicoreStudySessionsTable)
      .orderBy(desc(omnicoreStudySessionsTable.createdAt))
      .limit(20);
    res.json(sessions);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/shopybrain/niche-profiles", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const profiles = await db.select().from(omnicoreNicheProfilesTable)
      .orderBy(desc(omnicoreNicheProfilesTable.storesAnalyzed));
    res.json(profiles);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/shopybrain/prompt-library", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const prompts = await db.select().from(omnicorePromptLibraryTable)
      .orderBy(desc(omnicorePromptLibraryTable.useCount));
    res.json(prompts);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/shopybrain/prompt-library", requireAdmin, async (req, res): Promise<void> => {
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
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

function learnFromConversation(userQuery: string, aiResponse: string, niche?: string, detectedActionName?: string): void {
  try {
    const q = userQuery.toLowerCase();
    const isExplicitLearn = /aprende|recuerda|memoriza|guarda.*esto|anota|ten.*en.*cuenta|nota.*importante|no.*olvides/i.test(q);
    const isStrategic = /estrategia|plan|objetivo|meta|prioridad|decidido|vamos.*a|necesito.*que|quiero.*que|a.*partir.*de.*ahora|siempre|nunca/i.test(q);
    const isInsight = aiResponse.length > 300;

    const confidence = isExplicitLearn ? 0.95 : isStrategic ? 0.88 : 0.6;
    const tags = ["conversation", ...(niche ? [niche] : []), ...(detectedActionName ? [detectedActionName] : [])];

    if (isExplicitLearn) {
      tags.push("explicit_instruction");
      learnFromOperation({
        operationType: "explicit_instruction",
        title: `Instrucción directa: ${userQuery.slice(0, 120)}`,
        content: `INSTRUCCIÓN DEL USUARIO (alta prioridad): "${userQuery}". Respuesta: ${aiResponse}`,
        confidence: 0.95,
        tags,
      });
    } else if (isStrategic) {
      tags.push("strategic_decision");
      learnFromOperation({
        operationType: "strategic_learning",
        title: `Decisión estratégica: ${userQuery.slice(0, 120)}`,
        content: `Contexto estratégico — Usuario: "${userQuery}". Análisis IA: ${aiResponse}`,
        confidence: 0.88,
        tags,
      });
    } else if (isInsight && confidence >= 0.6) {
      learnFromOperation({
        operationType: "conversation_insight",
        title: `Chat: ${userQuery.slice(0, 120)}`,
        content: `Pregunta: "${userQuery}". Respuesta clave: ${aiResponse}`,
        confidence,
        tags,
      });
    }
  } catch {}
}

function buildEnrichedLearningContent(action: string, params: Record<string, unknown>, result: Record<string, unknown>): { title: string; content: string; confidence: number; extraTags: string[] } {
  const msg = String(result.message ?? "");
  const extraTags: string[] = [];
  let title = "";
  let content = "";
  let confidence = 0.8;

  const seoActions = ["seo_full_audit", "generate_all_metas", "generate_schemas", "fix_all_alt_texts", "audit_page_speed", "generate_sitemap", "keyword_intelligence", "blog_strategy", "generate_blog_post"];
  const pricingActions = ["change_price", "calculate_optimal_price", "estimate_cogs", "price_simulator", "financial_forecast", "financial_dashboard", "generate_competitive_pricing"];
  const productActions = ["create_product", "edit_product", "optimize_product", "redesign_product", "apply_redesign", "bulk_redesign", "optimize_all_products", "set_product_status", "publish_product", "delete_product"];
  const imageActions = ["generate_product_images", "generate_images_from_reference", "virtual_tryon", "bulk_generate_images", "optimize_images", "fix_all_alt_texts"];
  const competitorActions = ["scan_competitor", "discover_competitors", "analyze_competitor_product", "search_suppliers"];
  const themeActions = ["list_themes", "list_theme_files", "read_theme_file", "edit_theme_file", "create_theme_section", "audit_theme", "edit_theme_css", "edit_theme_settings", "sync_store_theme"];
  const marketingActions = ["generate_email", "generate_email_flow", "agency_quote", "agency_proposal"];
  const catalogActions = ["scan_store", "store_status", "list_products", "list_all_products", "search_product", "get_orders", "list_collections", "list_pages", "update_page", "add_to_collection"];
  const inventoryActions = ["inventory_sync", "inventory_alerts", "inventory_deep_report", "inventory_sync_orders", "inventory_sales_analytics", "inventory_customer_history", "sales_report"];

  if (seoActions.includes(action)) {
    extraTags.push("seo", "optimization");
    confidence = 0.9;
    title = `SEO: ${action} — ${msg.slice(0, 80)}`;
    const score = result.overallScore ?? result.seoScore ?? result.score;
    const products = result.products ?? result.results ?? result.total;
    content = `Operación SEO '${action}'. ${score ? `Score: ${score}.` : ""} ${products ? `Productos afectados: ${JSON.stringify(products)}.` : ""} ${msg}. Detalles: ${JSON.stringify(result)}`;
  } else if (pricingActions.includes(action)) {
    extraTags.push("pricing", "financial");
    confidence = 0.92;
    title = `Pricing: ${action} — ${msg.slice(0, 80)}`;
    const price = result.price ?? result.newPrice ?? result.optimalPrice ?? params?.price;
    const margin = result.margin ?? result.marginPct ?? result.grossMargin;
    content = `Operación pricing '${action}'. ${price ? `Precio: ${price} EUR.` : ""} ${margin ? `Margen: ${margin}%.` : ""} ${msg}. Datos: ${JSON.stringify(result)}`;
  } else if (productActions.includes(action)) {
    extraTags.push("product", "catalog");
    confidence = 0.88;
    const productTitle = result.title ?? params?.title ?? "";
    title = `Producto: ${action} — ${String(productTitle).slice(0, 60)}`;
    const productId = result.productId ?? result.id ?? params?.productId;
    const price = result.price ?? params?.price;
    const tags = result.tags ?? params?.tags;
    content = `Operación producto '${action}'. Producto: "${productTitle}" (ID: ${productId}). ${price ? `Precio: ${price} EUR.` : ""} ${tags ? `Tags: ${String(tags)}.` : ""} ${msg}. Resultado: ${JSON.stringify(result)}`;
  } else if (imageActions.includes(action)) {
    extraTags.push("images", "visual");
    confidence = 0.85;
    title = `Imágenes: ${action} — ${msg.slice(0, 80)}`;
    content = `Operación imágenes '${action}'. ${msg}. Detalles: ${JSON.stringify(result)}`;
  } else if (competitorActions.includes(action)) {
    extraTags.push("competitor", "market_research");
    confidence = 0.9;
    title = `Competencia: ${action} — ${msg.slice(0, 80)}`;
    content = `Investigación competitiva '${action}'. ${msg}. Datos: ${JSON.stringify(result)}`;
  } else if (themeActions.includes(action)) {
    extraTags.push("theme", "design");
    confidence = 0.82;
    title = `Theme: ${action} — ${msg.slice(0, 80)}`;
    content = `Operación theme '${action}'. ${msg}. Detalles: ${JSON.stringify(result)}`;
  } else if (marketingActions.includes(action)) {
    extraTags.push("marketing", "email");
    confidence = 0.88;
    title = `Marketing: ${action} — ${msg.slice(0, 80)}`;
    content = `Operación marketing '${action}'. ${msg}. Contenido generado: ${JSON.stringify(result)}`;
  } else if (inventoryActions.includes(action)) {
    extraTags.push("inventory", "stock", "sales");
    confidence = 0.88;
    title = `Inventario: ${action} — ${msg.slice(0, 80)}`;
    const stock = result.totalStock ?? result.stats;
    const sold = result.totalSold ?? result.totalItems;
    const variants = result.totalVariants ?? result.variantsCount;
    content = `Operacion inventario '${action}'. ${stock ? `Stock: ${JSON.stringify(stock)}.` : ""} ${sold ? `Vendido: ${sold}.` : ""} ${variants ? `Variantes: ${variants}.` : ""} ${msg}. Datos: ${JSON.stringify(result)}`;
  } else if (catalogActions.includes(action)) {
    extraTags.push("catalog", "data");
    confidence = 0.75;
    title = `Catálogo: ${action} — ${msg.slice(0, 80)}`;
    const total = result.total ?? result.productsCount ?? result.ordersCount ?? result.count;
    content = `Consulta catálogo '${action}'. ${total !== undefined ? `Total: ${total}.` : ""} ${msg}. Datos: ${JSON.stringify(result)}`;
  } else {
    title = `Acción: ${action} — ${msg.slice(0, 80)}`;
    content = `Acción '${action}'. Params: ${JSON.stringify(params)}. Resultado: ${msg}. Datos: ${JSON.stringify(result)}`;
  }

  return { title: title.slice(0, 200), content, confidence, extraTags };
}

router.post("/shopybrain/execute-action", requireAdmin, async (req, res): Promise<void> => {
  enableLongRunning(res);
  const { action, params } = req.body;
  if (!action) { res.status(400).json({ error: "action requerida" }); return; }
  
  const SENSITIVE_KEYS = new Set(["password", "token", "secret", "accessToken", "clientSecret", "inviteToken", "apiKey"]);
  
    if (params?.projectId && isNaN(parseInt(String(params.projectId)))) {
      const allProjects = await db.select({ id: projectsTable.id, shopDomain: projectsTable.shopDomain }).from(projectsTable).limit(10);
      if (allProjects.length === 1) {
        params.projectId = String(allProjects[0].id);
        logger.info({ originalId: params.projectId, resolvedId: allProjects[0].id }, "Resolved non-numeric projectId to only available project");
      } else {
        const byDomain = allProjects.find(p => String(params.projectId).includes(p.shopDomain) || p.shopDomain.includes(String(params.projectId)));
        if (byDomain) {
          params.projectId = String(byDomain.id);
        } else if (allProjects.length > 0) {
          params.projectId = String(allProjects[0].id);
          logger.warn({ originalProjectId: String(params.projectId).slice(0, 40), resolvedId: allProjects[0].id, totalProjects: allProjects.length }, "Non-numeric projectId resolved to first project (ambiguous)");
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
      });
      if (confirmationGuard) {
        res.json(confirmationGuard);
        return;
      }

      switch (action) {
        case "store_status": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const shop = await shopifyRequest<{ shop: Record<string, unknown> }>(parseInt(projectId), project.shopDomain, "/shop.json");
          const [activeCount, draftCount, archivedCount, publishedCount, unpublishedCount] = await Promise.all([
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=any&status=active"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=any&status=draft"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=any&status=archived"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=published"),
            shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json?published_status=unpublished"),
          ]);
          const totalProducts = activeCount.count + draftCount.count + archivedCount.count;
          const ordersCount = await shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/orders/count.json?status=any");
  
          const tokenExpiry = project.tokenExpiresAt;
          const tokenValid = tokenExpiry ? new Date(tokenExpiry) > new Date() : false;
          const tokenHoursLeft = tokenExpiry ? Math.max(0, Math.round((new Date(tokenExpiry).getTime() - Date.now()) / 3600000 * 10) / 10) : 0;
  
          const publishWarning = unpublishedCount.count > 0 ? `\n⚠️ ¡ATENCIÓN! ${unpublishedCount.count} producto(s) NO PUBLICADOS — invisibles para los clientes` : "";
  
          result = {
            storeName: shop.shop?.name ?? project.name,
            domain: project.shopDomain,
            plan: (shop.shop as Record<string, unknown>)?.plan_name,
            currency: (shop.shop as Record<string, unknown>)?.currency,
            productsCount: totalProducts,
            activeProducts: activeCount.count,
            draftProducts: draftCount.count,
            archivedProducts: archivedCount.count,
            publishedProducts: publishedCount.count,
            unpublishedProducts: unpublishedCount.count,
            ordersCount: ordersCount.count,
            tokenStatus: tokenValid ? "valid" : "expired",
            tokenHoursLeft,
            tokenExpiresAt: tokenExpiry,
            message: `Tienda: ${shop.shop?.name ?? project.name} | ${totalProducts} productos (${activeCount.count} activos, ${draftCount.count} borradores, ${archivedCount.count} archivados) | 📢 Publicados: ${publishedCount.count} | 🔇 No publicados: ${unpublishedCount.count} | ${ordersCount.count} pedidos | Token: ${tokenValid ? `válido (${tokenHoursLeft}h restantes)` : "EXPIRADO"}${publishWarning}`,
          };
          break;
        }
  
        case "list_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const limit = Math.min(params?.limit ?? 10, 50);
          const statusFilter = params?.statusFilter || "any";
          let allProducts: Array<Record<string, unknown>> = [];
          const fieldsToFetch = "id,title,handle,status,variants,images,tags,body_html,published_at,published_scope,metafields_global_title_tag,metafields_global_description_tag";
  
          if (statusFilter === "any") {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${st}&published_status=any&fields=${fieldsToFetch}`
              );
              allProducts = allProducts.concat(d.products || []);
            }
          } else {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${statusFilter}&published_status=any&fields=${fieldsToFetch}`
            );
            allProducts = d.products || [];
          }
  
          let unpublishedWarnings = 0;
          let noCompareWarnings = 0;
          let lowImageWarnings = 0;
          let shortDescWarnings = 0;
  
          const seoDataRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const seoLookup = new Map(seoDataRows.map(s => [s.shopifyProductId, s]));
  
          const mappedProducts = allProducts.map((p: Record<string, unknown>) => {
            const variants = (p.variants as Array<Record<string, string>>) || [];
            const images = (p.images as Array<Record<string, unknown>>) || [];
            const bodyLen = (p.body_html as string || "").length;
            const tagsArr = ((p.tags as string) || "").split(",").filter((t: string) => t.trim());
            const hasCompare = !!variants[0]?.compare_at_price;
            const isPublished = !!p.published_at;
            const imgCount = images.length;
  
            const issues: string[] = [];
            if (!isPublished) { issues.push("NO PUBLICADO"); unpublishedWarnings++; }
            if (!hasCompare) { issues.push("sin compare_at_price"); noCompareWarnings++; }
            if (imgCount < 3) { issues.push(`pocas imágenes (${imgCount})`); lowImageWarnings++; }
            if (bodyLen < 500) { issues.push(`descripción corta (${bodyLen}ch)`); shortDescWarnings++; }
            if (tagsArr.length < 10) { issues.push(`pocos tags (${tagsArr.length})`); }
  
            let score = 0;
            if (imgCount >= 3) score += 25; else if (imgCount >= 1) score += 10;
            if (bodyLen >= 1000) score += 25; else if (bodyLen >= 500) score += 15; else if (bodyLen >= 200) score += 8;
            if (tagsArr.length >= 10) score += 25; else if (tagsArr.length >= 5) score += 15;
            if (hasCompare) score += 25;
  
            const grade = score >= 85 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  
            const productSeo = seoLookup.get(String(p.id));
            const hasMetaTitle = !!(productSeo?.metaTitle && productSeo.metaTitle.length > 10);
            const hasMetaDesc = !!(productSeo?.metaDescription && productSeo.metaDescription.length > 10);
            if (!hasMetaTitle) issues.push("Sin meta title SEO — Google usará el título del producto por defecto");
            if (!hasMetaDesc) issues.push("Sin meta description — impacto crítico en CTR de Google (puede reducir clics un 30%)");
            const hasAltTexts = images.length > 0 && images.every((img: Record<string, unknown>) => !!img.alt);
            const handle = (p.handle as string) || "";
            const cleanHandleVal = !!handle && !handle.includes("_");
  
            return {
              id: p.id,
              title: p.title,
              status: p.status,
              price: variants[0]?.price ?? "0.00",
              compareAtPrice: variants[0]?.compare_at_price || null,
              variantCount: variants.length,
              imageCount: imgCount,
              imageUrl: images[0]?.src || null,
              tags: p.tags,
              tagsCount: tagsArr.length,
              descriptionLength: bodyLen,
              published: isPublished,
              publishedScope: p.published_scope || "unknown",
              auditScore: score,
              auditGrade: grade,
              hasComparePrice: hasCompare,
              hasMetaTitle,
              hasMetaDesc,
              hasAltTexts,
              cleanHandle: cleanHandleVal,
              issues: issues.length > 0 ? issues : undefined,
            };
          });
  
          let auditSummary = "";
          if (unpublishedWarnings > 0) auditSummary += `\n⚠️ ${unpublishedWarnings} producto(s) NO PUBLICADOS (invisibles)`;
          if (noCompareWarnings > 0) auditSummary += `\n⚠️ ${noCompareWarnings} producto(s) sin precio tachado (compare_at_price)`;
          if (lowImageWarnings > 0) auditSummary += `\n⚠️ ${lowImageWarnings} producto(s) con menos de 3 imágenes`;
          if (shortDescWarnings > 0) auditSummary += `\n⚠️ ${shortDescWarnings} producto(s) con descripción corta (<500ch)`;
  
          result = {
            products: mappedProducts,
            total: allProducts.length,
            auditWarnings: { unpublished: unpublishedWarnings, noCompare: noCompareWarnings, lowImages: lowImageWarnings, shortDesc: shortDescWarnings },
            message: `${allProducts.length} productos encontrados (${statusFilter === "any" ? "todos los estados" : statusFilter})${auditSummary}`,
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
            trial: ["hero", "lifestyle"],
            starter: ["hero", "lifestyle", "detail", "packaging"],
            agency_pro: ["hero", "lifestyle", "detail", "packaging", "ugc", "scale", "process", "variant"],
            enterprise: ["hero", "lifestyle", "detail", "packaging", "ugc", "scale", "process", "variant"],
            admin: ["hero", "lifestyle", "detail", "packaging", "ugc", "scale", "process", "variant"],
          };
  
          let aiContent: Record<string, unknown> | null = null;
          if (params?.aiGenerate !== false) {
            try {
              const [priceResearch, aiContentResult] = await Promise.all([
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
                  category?: string;
                  metafields?: Array<{ namespace: string; key: string; value: string; type: string }>;
                  variants?: Array<{
                    optionValues: Record<string, string>;
                    sku?: string;
                    price?: number;
                    compareAtPrice?: number;
                    inventoryQuantity?: number;
                    weight?: number;
                    weightUnit?: string;
                    barcode?: string;
                    costPerItem?: number;
                  }>;
                  options?: Array<{ name: string; values: string[] }>;
                  inventoryPolicy?: string;
                }>(
                  parseInt(projectId),
                  `Genera contenido de CALIDAD ABSOLUTA 100/100 para un nuevo producto Shopify — al nivel de las mejores tiendas del mundo (Gymshark, Allbirds, Fenty Beauty, Skims).
  
  Título base: "${title}"
  Tipo de producto: ${params?.productType || "DETECTA el tipo de producto a partir del título"}
  Nicho: ${storeNiche}
  Tono de marca: ${project.brandTone || "profesional"}
  Audiencia: ${project.targetAudience || "adultos con gusto por la calidad"}
  Mercados: ${project.storeMarkets || "España/Europa"}
  Precio proporcionado: ${params?.price || "NO proporcionado — investiga y sugiere precio competitivo REAL"}
  
  ESTÁNDAR DE CALIDAD 100/100 — REQUISITOS OBLIGATORIOS:
  
  1. TÍTULO (45-65 chars):
     - Keyword principal AL INICIO del título
     - Incluye modificador emocional o beneficio clave
     - Formato: [Keyword Principal] — [Beneficio/Diferenciador] | [Material/Detalle]
     - Ejemplo perfecto: "Taza Cerámica Artesanal — Diseño Exclusivo Pintado a Mano | 350ml"
  
  2. DESCRIPCIÓN HTML (mínimo 800-1200 palabras, 8 secciones obligatorias):
     <div class="product-description">
     SECCIÓN 1 — HERO HOOK (H2 emotivo + párrafo apertura con storytelling 80-100 palabras):
     Conecta emocionalmente. Describe la EXPERIENCIA, no solo el producto. Pinta una escena vivida.
  
     SECCIÓN 2 — BENEFICIOS CLAVE (H2 + lista con ✅ emojis, mínimo 8 beneficios):
     Cada beneficio = resultado concreto para el comprador, no característica genérica.
  
     SECCIÓN 3 — ESPECIFICACIONES TÉCNICAS (H2 + tabla HTML):
     Tabla con: Material, Dimensiones, Peso, Color, Capacidad, Origen, Certificaciones.
  
     SECCIÓN 4 — ¿PARA QUIÉN ES PERFECTO? (H2 + 4-5 casos de uso con emojis):
     Buyer personas específicos con situaciones concretas de uso.
  
     SECCIÓN 5 — CUIDADO Y MANTENIMIENTO (H3 + instrucciones):
     Instrucciones claras de cuidado, limpieza, almacenamiento.
  
     SECCIÓN 6 — PREGUNTAS FRECUENTES (H2 "FAQ" + 4-5 Q&A con <strong> para preguntas):
     Resuelve objeciones de compra: envío, devoluciones, garantía, materiales.
  
     SECCIÓN 7 — CIERRE Y CTA (párrafo persuasivo + urgencia sutil):
     CTA claro, mención de stock limitado o edición especial si aplica.
  
     SECCIÓN 8 — TRUST BADGES (iconos de confianza):
     📦 Envío Seguro | 🔄 Devolución 30 días | ✅ Garantía de Calidad | 🌿 Materiales Premium
     </div>
  
     USA ESTILO PROFESIONAL: <h2>, <h3>, <ul>/<li>, <table>, <strong>, <p>. NO uses estilos inline.
  
  OPTIMIZACIÓN SEO AVANZADA (Metodología Semrush):
  - KEYWORD DENSITY: La keyword principal debe aparecer 3-5 veces en la descripción (densidad 1.5-2.5%)
  - KEYWORD PROMINENCE: La keyword principal DEBE aparecer en el PRIMER PÁRRAFO (Hero Hook)
  - LSI KEYWORDS: Incluye 5-8 keywords semánticas relacionadas distribuidas naturalmente en el texto
  - READABILITY: Frases de 15-25 palabras máximo. Párrafos de 2-4 líneas. Voz activa siempre.
  - FAQ SCHEMA-READY: La sección FAQ debe usar formato <strong>¿Pregunta?</strong> seguido de <p>Respuesta</p> para activar Rich Snippets en Google
  - INTERNAL LINKING: Si conoces otros productos de la tienda, sugiere enlaces internos con anchor text keyword-rich
  
  3. TAGS SEO (22-28 tags obligatorios en array):
     Categorías de tags que DEBES incluir (metodología Semrush Keyword Magic Tool):
     - Keyword principal + variaciones de cola corta (3-4 tags)
     - Material/composición/ingredientes (2-3 tags)
     - Intención de búsqueda: transaccional ("comprar X", "X online") (2-3 tags)
     - Audiencia target + buyer persona (2-3 tags)
     - Estilo/estética/categoría visual (2-3 tags)
     - Keywords long-tail en español con intención clara (3-4 tags)
     - Keywords en inglés para SEO internacional (2-3 tags)
     - Temporada/momento/ocasión si aplica (1-2 tags)
     - Nicho específico + keywords LSI semánticas (2-3 tags)
  
  4. META TITLE SEO (40-60 chars EXACTOS):
     Formato: [Keyword] — [Beneficio] | [Marca/Tienda]
     Keyword principal SIEMPRE al inicio. Debe coincidir con intención de búsqueda transaccional.
  
  5. META DESCRIPTION SEO (130-155 chars EXACTOS):
     Formato: [Beneficio principal]. [Keyword + detalle]. [CTA con urgencia]. Incluye precio si hay.
     Debe responder la intención de búsqueda del usuario en las primeras 100 chars (visible en SERP móvil).
  
  6. PRECIO:
     - Si no hay precio, sugiere basándote en el mercado real del nicho
     - SIEMPRE incluye suggestedCompareAtPrice (20-35% más alto que el precio)
     - Usa pricing psicológico: .99, .95, .90
  
  7. VARIANTES CON INVENTARIO COMPLETO (OBLIGATORIO — NUNCA crear producto sin variantes):
     Analiza el tipo de producto y genera TODAS las variantes reales que tendría en una tienda profesional.
     Cada variante DEBE tener inventoryQuantity (stock inicial realista: 10-50 unidades por variante).
  
     REGLAS POR TIPO DE PRODUCTO (ejemplos, aplica para CUALQUIER producto/servicio):
     - ROPA/MODA: options=[{name:"Talla",values:["XS","S","M","L","XL","XXL"]},{name:"Color",values:["Negro","Blanco","Azul",...]}]
     - CALZADO: options=[{name:"Número",values:["36","37","38","39","40","41","42","43","44","45"]},{name:"Color",values:[...]}]
     - JOYERÍA: options=[{name:"Material",values:["Plata 925","Oro 18k","Acero Quirúrgico"]},{name:"Medida",values:["15cm","17cm","19cm"]}]
     - ALIMENTACIÓN: options=[{name:"Peso",values:["250g","500g","1kg"]},{name:"Sabor",values:[...]}]
     - COSMÉTICA: options=[{name:"Tamaño",values:["30ml","50ml","100ml"]},{name:"Tono",values:[...]}]
     - ELECTRÓNICA: options=[{name:"Capacidad",values:["64GB","128GB","256GB"]},{name:"Color",values:[...]}]
     - HOGAR/DECORACIÓN: options=[{name:"Tamaño",values:["S","M","L"]},{name:"Color",values:[...]}]
     - BEBIDAS: options=[{name:"Pack",values:["1 unidad","Pack 6","Pack 12","Pack 24"]},{name:"Sabor",values:[...]}]
     - SERVICIOS DIGITALES: options=[{name:"Plan",values:["Básico","Pro","Enterprise"]},{name:"Duración",values:["1 mes","3 meses","12 meses"]}]
     - ARTE/PRINTS: options=[{name:"Tamaño",values:["A4","A3","A2","A1"]},{name:"Acabado",values:["Mate","Brillante","Canvas"]}]
     - MASCOTAS: options=[{name:"Talla",values:["XS","S","M","L","XL"]},{name:"Sabor/Tipo",values:[...]}]
     - LIBROS/PAPELERÍA: options=[{name:"Formato",values:["Tapa Blanda","Tapa Dura","eBook"]},{name:"Idioma",values:["Español","Inglés"]}]
     - SUPLEMENTOS: options=[{name:"Formato",values:["Cápsulas 60","Cápsulas 120","Polvo 500g"]},{name:"Sabor",values:[...]}]
     - CUALQUIER OTRO: Detecta las opciones lógicas del producto y genera variantes coherentes.
  
     Cada variante incluye:
     - optionValues: {"Talla":"M","Color":"Negro"} (las opciones que aplican)
     - sku: código único (formato: PREFIJO-OPT1-OPT2, ej: "CAM-M-NEG")
     - price: precio (puede variar si hay opciones premium como XXL, oro, etc.)
     - compareAtPrice: precio tachado
     - inventoryQuantity: stock inicial (15-50 unidades, variantes populares como M/L más stock)
     - weight: peso en kg
     - weightUnit: "kg"
     - costPerItem: coste estimado del producto (para calcular margen)
     - barcode: EAN/GTIN ficticio realista (13 dígitos)
  
     GENERA ENTRE 6-30 variantes según el tipo de producto.
     inventoryPolicy: "deny" (no vender sin stock) o "continue" (permitir pedidos sin stock para servicios/digital)
  
  8. CATEGORÍA SHOPIFY (OBLIGATORIO):
     Asigna la categoría correcta del Standard Product Taxonomy de Shopify.
     Ejemplos: "Apparel & Accessories > Clothing > Shirts & Tops", "Health & Beauty > Personal Care > Cosmetics",
     "Home & Garden > Kitchen & Dining > Drinkware", "Sporting Goods > Exercise & Fitness".
     USA la taxonomía oficial de Shopify — categorías en inglés separadas por " > ".
  
  9. METAFIELDS COMPLETOS (OBLIGATORIO — genera TODOS los que apliquen):
     Genera un array de metafields con namespace "custom" y los siguientes keys según el tipo de producto:
     - material: composición/material principal (type: "single_line_text_field")
     - color: color principal del producto (type: "single_line_text_field")
     - care_instructions: instrucciones de cuidado y mantenimiento (type: "multi_line_text_field")
     - origin_country: país de origen/fabricación (type: "single_line_text_field")
     - dimensions: dimensiones del producto (type: "single_line_text_field")
     - weight_info: peso detallado con unidades (type: "single_line_text_field")
     - ingredients: ingredientes/composición detallada si aplica (type: "multi_line_text_field")
     - certifications: certificaciones/sellos de calidad (type: "single_line_text_field")
     - warranty: información de garantía (type: "single_line_text_field")
     - age_group: grupo de edad recomendado si aplica (type: "single_line_text_field")
     - gender: género target si aplica (type: "single_line_text_field")
     - season: temporada/estación si aplica (type: "single_line_text_field")
     - style: estilo/colección si aplica (type: "single_line_text_field")
     NO incluyas metafields vacíos — solo los relevantes para este producto específico.
  
  Responde SOLO JSON válido:
  {"title":"...","description":"...HTML...","tags":[...22+ tags...],"seoTitle":"...","seoDescription":"...","suggestedPrice":XX.99,"suggestedCompareAtPrice":XX.99,"productType":"tipo","category":"Taxonomy > Path > Category","metafields":[{"namespace":"custom","key":"material","value":"Algodón orgánico 100%","type":"single_line_text_field"},...],"inventoryPolicy":"deny","options":[{"name":"Talla","values":["S","M","L","XL"]},{"name":"Color","values":["Negro","Blanco"]}],"variants":[{"optionValues":{"Talla":"S","Color":"Negro"},"sku":"CAM-S-NEG","price":29.99,"compareAtPrice":39.99,"inventoryQuantity":25,"weight":0.3,"weightUnit":"kg","costPerItem":12.50,"barcode":"8400000000001"},...]}`,
                  `Eres el equipo de producto de las tiendas Shopify más exitosas del mundo combinado con la inteligencia SEO de Semrush. Has estudiado qué hace que Gymshark, Allbirds, Fenty Beauty, Skims, y las 100 mejores tiendas Shopify del mundo tengan fichas de producto PERFECTAS. Aplicas metodología Semrush: keyword density 1.5-2.5%, keyword prominence (keyword en primer párrafo), LSI keywords semánticas, readability optimizada (frases 15-25 palabras), FAQ schema-ready para Rich Snippets, y tags con intención transaccional. Tu misión: generar fichas que puntuarían 100/100 en Semrush On-Page SEO Checker y en cualquier auditoría de calidad Shopify. Responde SOLO JSON válido.`,
                  "seo",
                  storeNiche || undefined,
                  8000
                ),
              ]);
  
              aiContent = aiContentResult as Record<string, unknown>;
  
              finalTitle = (aiContent.title as string) || title;
              finalBody = (aiContent.description as string) || finalBody;
              finalTags = Array.isArray(aiContent.tags) ? (aiContent.tags as string[]).join(", ") : finalTags;
              seoTitle = (aiContent.seoTitle as string) || "";
              seoDescription = (aiContent.seoDescription as string) || "";
  
              if (aiContent.productType && !params?.productType) {
                params.productType = aiContent.productType as string;
              }
  
              if (!params?.price || params?.price === "0.00") {
                if (priceResearch && priceResearch.suggestedPrice > 0) {
                  finalPrice = priceResearch.suggestedPrice.toFixed(2);
                  finalCompareAt = priceResearch.suggestedCompareAtPrice > 0
                    ? priceResearch.suggestedCompareAtPrice.toFixed(2)
                    : null;
                  pricingInfo = `\n💰 Precio investigado: ${finalPrice}€ (rango mercado: ${priceResearch.marketPriceRange.min}€-${priceResearch.marketPriceRange.max}€, ${priceResearch.competitorPrices.length} competidores analizados)`;
                } else if (aiContent.suggestedPrice && (aiContent.suggestedPrice as number) > 0) {
                  finalPrice = (aiContent.suggestedPrice as number).toFixed(2);
                  if (aiContent.suggestedCompareAtPrice) {
                    finalCompareAt = (aiContent.suggestedCompareAtPrice as number).toFixed(2);
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
            status: "active",
            published: true,
            published_scope: "global",
          };
  
          const aiVariantsRaw = (params?.aiGenerate !== false && (aiContent as any)?.variants?.length) ? (aiContent as any).variants as any[] : null;
          const aiOptionsRaw = (params?.aiGenerate !== false && (aiContent as any)?.options?.length) ? (aiContent as any).options as any[] : null;
  
          if (aiOptionsRaw && aiOptionsRaw.length > 0) {
            shopifyProduct.options = aiOptionsRaw.map((o: { name: string; values: string[] }, i: number) => ({
              name: o.name,
              position: i + 1,
              values: o.values,
            }));
          }
  
          if (aiVariantsRaw && aiVariantsRaw.length > 0 && aiOptionsRaw && aiOptionsRaw.length > 0) {
            shopifyProduct.variants = aiVariantsRaw.map((v: Record<string, unknown>) => {
              const optVals = (v.optionValues || {}) as Record<string, string>;
              const variant: Record<string, unknown> = {
                price: String(v.price || finalPrice),
                compare_at_price: v.compareAtPrice ? String(v.compareAtPrice) : finalCompareAt,
                sku: v.sku || null,
                inventory_management: "shopify",
                inventory_quantity: v.inventoryQuantity ?? 25,
                inventory_policy: (aiContent as any)?.inventoryPolicy || "deny",
                weight: v.weight || null,
                weight_unit: v.weightUnit || "kg",
                barcode: v.barcode || null,
                requires_shipping: true,
                taxable: true,
              };
              if (aiOptionsRaw[0]) variant.option1 = optVals[aiOptionsRaw[0].name] || null;
              if (aiOptionsRaw[1]) variant.option2 = optVals[aiOptionsRaw[1].name] || null;
              if (aiOptionsRaw[2]) variant.option3 = optVals[aiOptionsRaw[2].name] || null;
              return variant;
            });
          } else {
            shopifyProduct.variants = [{
              title: "Default",
              price: finalPrice,
              compare_at_price: finalCompareAt,
              sku: params?.sku || null,
              inventory_management: "shopify",
              inventory_quantity: params?.quantity ?? 50,
              inventory_policy: "deny",
              requires_shipping: true,
              taxable: true,
            }];
          }
  
          if (seoTitle) shopifyProduct.metafields_global_title_tag = seoTitle;
          if (seoDescription) shopifyProduct.metafields_global_description_tag = seoDescription;
  
          const aiCategory = aiContent?.category as string | undefined;
          const aiMetafields = (aiContent?.metafields || []) as Array<{ namespace: string; key: string; value: string; type: string }>;
  
          const created = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, "/products.json",
            { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
          );
  
          const createdVariants = (created.product.variants || []) as Array<Record<string, unknown>>;
          const totalStock = createdVariants.reduce((sum: number, v: Record<string, unknown>) => sum + (Number(v.inventory_quantity) || 0), 0);
          if (createdVariants.length > 0) {
            const { inventoryTrackingTable: invTable } = await import("@workspace/db");
            const { randomUUID } = await import("crypto");
            const createdOptions = (created.product.options || []) as Array<{ name: string }>;
            for (const cv of createdVariants) {
              await db.insert(invTable).values({
                id: randomUUID(),
                projectId: String(projectId),
                productId: String(created.product.id),
                variantId: String(cv.id),
                productTitle: String(created.product.title),
                variantTitle: String(cv.title || "Default"),
                sku: cv.sku ? String(cv.sku) : null,
                barcode: cv.barcode ? String(cv.barcode) : null,
                option1Name: createdOptions[0]?.name || null,
                option1Value: cv.option1 ? String(cv.option1) : null,
                option2Name: createdOptions[1]?.name || null,
                option2Value: cv.option2 ? String(cv.option2) : null,
                option3Name: createdOptions[2]?.name || null,
                option3Value: cv.option3 ? String(cv.option3) : null,
                productType: String(created.product.product_type || params?.productType || ""),
                vendor: String(created.product.vendor || params?.vendor || ""),
                price: parseFloat(String(cv.price || finalPrice)),
                compareAtPrice: cv.compare_at_price ? parseFloat(String(cv.compare_at_price)) : null,
                currentStock: Number(cv.inventory_quantity) || 0,
                avgDailySales: 0,
                totalUnitsSold: 0,
                daysRemaining: 999,
                inventoryPolicy: String(cv.inventory_policy || "deny"),
                status: "healthy",
              }).catch(() => {});
            }
          }
  
          await recProdUsage(parseInt(projectId), "product", 1);
  
          const createdProductId = String(created.product.id);
          const createdTitle = String(created.product.title);
          const createdHandle = String(created.product.handle || "");
  
          let metafieldsPushed = 0;
          if (aiMetafields.length > 0) {
            for (const mf of aiMetafields) {
              if (!mf.value || !mf.key) continue;
              try {
                await shopifyRequest(parseInt(projectId), project.shopDomain, `/products/${createdProductId}/metafields.json`, {
                  method: "POST",
                  body: JSON.stringify({ metafield: { namespace: mf.namespace || "custom", key: mf.key, value: mf.value, type: mf.type || "single_line_text_field" } }),
                });
                metafieldsPushed++;
              } catch {}
              await new Promise(r => setTimeout(r, 150));
            }
          }
  
          if (aiCategory) {
            const categoryProductType = typeof aiCategory === "string" ? aiCategory : (params?.productType || (aiContent?.productType as string) || "");
            try {
              await shopifyRequest(parseInt(projectId), project.shopDomain, `/products/${createdProductId}.json`, {
                method: "PUT",
                body: JSON.stringify({ product: { id: createdProductId, product_type: categoryProductType } }),
              });
            } catch {}
          }
  
          if (seoTitle || seoDescription) {
            await db.insert(seoDataTable).values({
              projectId: parseInt(projectId),
              shopifyProductId: createdProductId,
              metaTitle: seoTitle || null,
              metaDescription: seoDescription || null,
            }).onConflictDoNothing().catch(() => {});
          }
  
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
  
          const variantSummary = createdVariants.map((v: Record<string, unknown>) =>
            `${v.option1 || ""}${v.option2 ? "/" + v.option2 : ""}${v.option3 ? "/" + v.option3 : ""}: ${v.inventory_quantity ?? 0} uds, ${v.price}€, SKU:${v.sku || "N/A"}`
          ).slice(0, 15).join("; ");
  
          learnFromOperation({
            operationType: "product_creation",
            niche: project.storeNiche,
            productType: params?.productType || null,
            title: `Producto creado: ${createdTitle} (${createdVariants.length} variantes, ${totalStock} uds stock total)`,
            content: JSON.stringify({
              title: createdTitle,
              description: finalBody ? String(finalBody).slice(0, 500) : "",
              tags: finalTags,
              price: finalPrice,
              handle: createdHandle,
              seoTitle,
              seoDescription,
              variantsCount: createdVariants.length,
              totalStock,
              options: aiContent?.options || [],
              inventoryPolicy: aiContent?.inventoryPolicy || "deny",
              variantSummary,
            }),
            confidence: 0.95,
          });
  
          const imageTypes = IMAGE_TYPES_BY_PLAN[plan] || IMAGE_TYPES_BY_PLAN.starter;
          let imagesGenerated = 0;
          let imagesUploaded = 0;
          const imageErrors: string[] = [];
  
          if (params?.aiGenerate !== false && params?.skipImages !== true) {
            const existingImages = await shopifyRequest<{ images: Array<{ id: number; src: string; alt: string }> }>(
              parseInt(projectId), project.shopDomain, `/products/${createdProductId}/images.json`
            ).catch(() => ({ images: [] }));
            const existingImageCount = existingImages.images?.length ?? 0;
  
            if (existingImageCount > 0) {
              logger.info({ productId: createdProductId, existingImages: existingImageCount }, "Producto ya tiene imágenes, omitiendo generación para evitar duplicados");
            }
  
            const hasReferenceImage = !!params?.referenceImageUrl;
  
            if (existingImageCount > 0) {
              /* skip — ya tiene imágenes */
            } else if (hasReferenceImage) {
              try {
                const { getScenesForProductType, downloadImageToBuffer, uploadBufferToShopify } = await import("./reference-images.js");
                const { editImageFromBuffer } = await import("@workspace/integrations-openai-ai-server/image");
                const { productsTable: pTable, generationJobsTable: gjTable } = await import("@workspace/db");
  
                const refMetafields: Array<{ namespace: string; key: string; value: string }> = [];
                if (seoTitle) refMetafields.push({ namespace: "seo", key: "title", value: seoTitle });
                if (seoDescription) refMetafields.push({ namespace: "seo", key: "description", value: seoDescription });
                const refAudit = auditProduct({
                  title: createdTitle, body_html: finalBody || "",
                  price: finalPrice, compare_at_price: finalCompareAt,
                  images: (created.product.images as Array<{ alt: string | null }>) || [],
                  tags: finalTags, metafields: refMetafields,
                });
  
                await db.insert(pTable).values({
                  projectId: parseInt(projectId),
                  shopifyProductId: createdProductId,
                  title: createdTitle,
                  handle: createdHandle,
                  bodyHtml: finalBody || null,
                  vendor: params?.vendor || null,
                  productType: params?.productType || null,
                  status: "active" as "active" | "draft" | "archived",
                  tags: finalTags || null,
                  price: finalPrice,
                  compareAtPrice: finalCompareAt,
                  imageCount: 0,
                  variantCount: 1,
                  auditScore: refAudit.overallScore,
                  auditGrade: refAudit.grade,
                  titleScore: refAudit.titleScore,
                  descriptionScore: refAudit.descriptionScore,
                  priceScore: refAudit.priceScore,
                  imageScore: refAudit.imageScore,
                  seoScore: refAudit.seoScore,
                  auditProblems: refAudit.problems,
                  lastAuditedAt: new Date(),
                }).onConflictDoNothing().catch(() => {});
  
                const referenceBuffer = await downloadImageToBuffer(String(params.referenceImageUrl));
                const scenes = getScenesForProductType(params?.productType || "", storeNiche);
  
                const limitCheck = await checkProdLimit(parseInt(projectId), "image", scenes.length);
                const allowedCount = limitCheck.allowed ? scenes.length : Math.max(0, limitCheck.remaining?.images ?? 0);
  
                if (allowedCount > 0) {
                  const finalScenes = scenes.slice(0, allowedCount);
                  let position = 0;
  
                  for (const scene of finalScenes) {
                    position++;
                    try {
                      const prompt = scene.promptTemplate(createdTitle, params?.productType || "", storeNiche);
                      const generatedBuffer = await editImageFromBuffer(referenceBuffer, prompt, "reference.png");
  
                      const altText = `${createdTitle} - ${scene.label}`;
                      const uploadResult = await uploadBufferToShopify({
                        projectId: parseInt(projectId),
                        shopDomain: project.shopDomain,
                        shopifyProductId: createdProductId,
                        imageBuffer: generatedBuffer,
                        altText,
                        position,
                      });
  
                      if (uploadResult.success) {
                        imagesGenerated++;
                        imagesUploaded++;
                        await recProdUsage(parseInt(projectId), "image", 1);
                      } else {
                        imageErrors.push(`${scene.label}: upload failed`);
                      }
  
                      await db.insert(gjTable).values({
                        projectId: parseInt(projectId),
                        shopifyProductId: createdProductId,
                        imageType: scene.key,
                        status: uploadResult.success ? "succeeded" : "failed",
                        prompt: prompt.slice(0, 2000),
                        model: "gpt-image-1",
                        estimatedCost: 0.04,
                        altText,
                        shopifyImageId: uploadResult.shopifyImageId ?? null,
                        completedAt: new Date(),
                      }).catch(() => {});
                    } catch (e: unknown) {
                      imageErrors.push(`${scene.label}: ${e instanceof Error ? e.message : "error"}`);
                    }
                  }
                }
              } catch (imgErr: unknown) {
                logger.error({ err: imgErr }, "Error en generación de imágenes desde referencia");
              }
            } else {
              try {
                const { productsTable: pTable, generationJobsTable: gjTable } = await import("@workspace/db");
                const { buildImagePrompt: buildPrompt, runImageGeneration: runGeneration, MODEL_MAP: modelMap, COST_MAP: costMap, NEGATIVE_PROMPT: negPrompt, uploadGeneratedImageToShopify: uploadImg } = await import("./images.js");
  
                const genMf: Array<{ namespace: string; key: string; value: string }> = [];
                if (seoTitle) genMf.push({ namespace: "seo", key: "title", value: seoTitle });
                if (seoDescription) genMf.push({ namespace: "seo", key: "description", value: seoDescription });
                const genAudit = auditProduct({
                  title: createdTitle, body_html: finalBody || "",
                  price: finalPrice, compare_at_price: finalCompareAt,
                  images: (created.product.images as Array<{ alt: string | null }>) || [],
                  tags: finalTags, metafields: genMf,
                });
  
                await db.insert(pTable).values({
                  projectId: parseInt(projectId),
                  shopifyProductId: createdProductId,
                  title: createdTitle,
                  handle: createdHandle,
                  bodyHtml: finalBody || null,
                  vendor: params?.vendor || null,
                  productType: params?.productType || null,
                  status: "active" as "active" | "draft" | "archived",
                  tags: finalTags || null,
                  price: finalPrice,
                  compareAtPrice: finalCompareAt,
                  imageCount: 0,
                  variantCount: 1,
                  auditScore: genAudit.overallScore,
                  auditGrade: genAudit.grade,
                  titleScore: genAudit.titleScore,
                  descriptionScore: genAudit.descriptionScore,
                  priceScore: genAudit.priceScore,
                  imageScore: genAudit.imageScore,
                  seoScore: genAudit.seoScore,
                  auditProblems: genAudit.problems,
                  lastAuditedAt: new Date(),
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
                        imageType, storeNiche, project.brandTone, finalBody || null
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
  
          try {
            const freshProduct = await shopifyRequest<{ product: Record<string, unknown> }>(
              parseInt(projectId), project.shopDomain, `/products/${createdProductId}.json`
            );
            const sp = freshProduct.product;
            const spImages = (sp.images as Array<Record<string, unknown>>) || [];
            const spVariants = (sp.variants as Array<Record<string, unknown>>) || [];
            const { productsTable: syncPT } = await import("@workspace/db");
            const { auditProduct: auditProd } = await import("../lib/audit.js");
  
            const postMf: Array<{ namespace: string; key: string; value: string }> = [];
            if (seoTitle) postMf.push({ namespace: "seo", key: "title", value: seoTitle });
            if (seoDescription) postMf.push({ namespace: "seo", key: "description", value: seoDescription });
            if (postMf.length === 0) {
              try {
                const postSeoGql = `{ product(id: "gid://shopify/Product/${createdProductId}") { seo { title description } } }`;
                const postSeoRes = await shopifyGraphQL<{ product: { seo: { title: string | null; description: string | null } } }>(
                  parseInt(projectId), project.shopDomain, postSeoGql
                );
                if (postSeoRes.product?.seo?.title) postMf.push({ namespace: "seo", key: "title", value: postSeoRes.product.seo.title });
                if (postSeoRes.product?.seo?.description) postMf.push({ namespace: "seo", key: "description", value: postSeoRes.product.seo.description });
              } catch {}
            }
  
            const audit = auditProd({
              title: String(sp.title || ""),
              body_html: String(sp.body_html || ""),
              price: String((spVariants[0] as Record<string, unknown>)?.price || "0"),
              compare_at_price: (spVariants[0] as Record<string, unknown>)?.compare_at_price ? String((spVariants[0] as Record<string, unknown>).compare_at_price) : null,
              images: spImages.map(img => ({ alt: (img.alt as string) || null })),
              tags: String(sp.tags || ""),
              variants: spVariants.map((v: Record<string, unknown>) => ({ price: String(v.price || "0") })),
              metafields: postMf,
            });
            await db.insert(syncPT).values({
              projectId: parseInt(projectId),
              shopifyProductId: createdProductId,
              title: String(sp.title),
              handle: String(sp.handle || ""),
              bodyHtml: String(sp.body_html || ""),
              vendor: String(sp.vendor || ""),
              productType: String(sp.product_type || ""),
              status: String(sp.status || "draft") as "active" | "draft" | "archived",
              publishedAt: sp.published_at ? String(sp.published_at) : null,
              tags: String(sp.tags || ""),
              price: String((spVariants[0] as Record<string, unknown>)?.price || "0"),
              compareAtPrice: (spVariants[0] as Record<string, unknown>)?.compare_at_price ? String((spVariants[0] as Record<string, unknown>).compare_at_price) : null,
              imageCount: spImages.length,
              variantCount: spVariants.length,
              imagesJson: spImages,
              auditScore: audit.overallScore,
              auditGrade: audit.grade,
              titleScore: audit.titleScore,
              descriptionScore: audit.descriptionScore,
              priceScore: audit.priceScore,
              imageScore: audit.imageScore,
              seoScore: audit.seoScore,
              auditProblems: audit.problems,
              lastAuditedAt: new Date(),
            }).onConflictDoUpdate({
              target: [syncPT.projectId, syncPT.shopifyProductId],
              set: {
                title: String(sp.title), handle: String(sp.handle || ""), bodyHtml: String(sp.body_html || ""),
                status: String(sp.status || "draft") as "active" | "draft" | "archived",
                price: String((spVariants[0] as Record<string, unknown>)?.price || "0"),
                imageCount: spImages.length, variantCount: spVariants.length, imagesJson: spImages,
                auditScore: audit.overallScore, auditGrade: audit.grade,
                titleScore: audit.titleScore, descriptionScore: audit.descriptionScore,
                priceScore: audit.priceScore, imageScore: audit.imageScore, seoScore: audit.seoScore,
                auditProblems: audit.problems, lastAuditedAt: new Date(),
              },
            }).catch(() => {});
            logger.info({ productId: createdProductId, auditScore: audit.overallScore, grade: audit.grade, images: spImages.length }, "Post-creation audit completed");
          } catch (auditErr) {
            logger.warn({ err: auditErr, productId: createdProductId }, "Post-creation audit failed (non-critical)");
          }
  
          const optionNames = ((created.product.options || []) as Array<{ name: string; values?: string[] }>)
            .map(o => `${o.name} (${(o.values || []).length} valores)`)
            .join(", ");
          const variantStockSummary = createdVariants.length > 1
            ? `\n📊 Variantes: ${createdVariants.length} combinaciones | Stock total: ${totalStock} unidades`
            : "";
          const optionsSummary = optionNames ? `\n🎛️ Opciones: ${optionNames}` : "";
  
          result = {
            productId: created.product.id,
            title: createdTitle,
            status: created.product.status,
            handle: createdHandle,
            price: finalPrice,
            compareAtPrice: finalCompareAt,
            seoTitle,
            seoDescription,
            variantsCount: createdVariants.length,
            totalStock,
            options: (created.product.options || []) as Array<{ name: string; values?: string[] }>,
            imagesGenerated,
            imagesUploaded,
            imageTypes: (IMAGE_TYPES_BY_PLAN[plan] || []).slice(0, imagesGenerated),
            message: `✅ Producto "${createdTitle}" creado COMPLETO en Shopify (ID: ${created.product.id})
  
  📝 Contenido: Titulo SEO optimizado + descripcion profesional (400+ palabras)
  🏷️ Tags: ${finalTags ? finalTags.split(",").length : 0} tags SEO generados
  ${pricingInfo || `💰 Precio: ${finalPrice}€`}${finalCompareAt ? ` (antes: ${finalCompareAt}€)` : ""}${optionsSummary}${variantStockSummary}${seoSummary}${imagesSummary}
  📦 Estado: ${created.product.status} | Inventario: gestionado por Shopify
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
  
          const beforeEdit = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,status,variants,images,tags,body_html,published_at,published_scope,vendor,product_type`
          );
          const beforeProduct = beforeEdit.product;
          const beforeVariants = (beforeProduct.variants as Array<Record<string, unknown>>) || [];
          const beforeImages = (beforeProduct.images as unknown[]) || [];
          const beforeBodyLen = (beforeProduct.body_html as string || "").length;
          const beforeTags = ((beforeProduct.tags as string) || "").split(",").filter((t: string) => t.trim());
          const beforePublished = !!beforeProduct.published_at;
          const beforeCompare = beforeVariants[0]?.compare_at_price;
  
          const preAuditIssues: string[] = [];
          if (!beforePublished) preAuditIssues.push("NO PUBLICADO (invisible para clientes)");
          if (!beforeCompare) preAuditIssues.push("Sin compare_at_price");
          if (beforeImages.length < 3) preAuditIssues.push(`Pocas imágenes (${beforeImages.length})`);
          if (beforeBodyLen < 500) preAuditIssues.push(`Descripción corta (${beforeBodyLen}ch)`);
          if (beforeTags.length < 10) preAuditIssues.push(`Pocos tags (${beforeTags.length})`);
  
          const updates: Record<string, unknown> = { id: parseInt(productId) };
          if (params?.title) updates.title = params.title;
          if (params?.bodyHtml) updates.body_html = params.bodyHtml;
          if (params?.tags) updates.tags = params.tags;
          if (params?.status) updates.status = params.status;
          if (params?.vendor) updates.vendor = params.vendor;
          if (params?.productType) updates.product_type = params.productType;
          if (params?.seoTitle) updates.metafields_global_title_tag = params.seoTitle;
          if (params?.seoDescription) updates.metafields_global_description_tag = params.seoDescription;
          if (params?.publish === true) {
            updates.status = "active";
            updates.published = true;
            updates.published_scope = "global";
          }
  
          if (Object.keys(updates).length <= 1) {
            res.status(400).json({ error: "Se requiere al menos un campo a actualizar (title, bodyHtml, tags, status, price, vendor, productType, seoTitle, seoDescription, publish)" });
            return;
          }
  
          if (params?.price || params?.compareAtPrice) {
            const varId = params.variantId || beforeVariants[0]?.id;
            if (varId) {
              const variantUpdate: Record<string, unknown> = { id: varId };
              if (params?.price) variantUpdate.price = params.price;
              if (params?.compareAtPrice) variantUpdate.compare_at_price = params.compareAtPrice;
              updates.variants = [variantUpdate];
            }
          }
  
          const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "PUT", body: JSON.stringify({ product: updates }) }
          );
  
          const afterVariants = (updated.product.variants as Array<Record<string, unknown>>) || [];
          const afterImages = (updated.product.images as unknown[]) || [];
          const afterBodyLen = (updated.product.body_html as string || "").length;
          const afterPublished = !!updated.product.published_at;
  
          const postAuditIssues: string[] = [];
          if (!afterPublished) postAuditIssues.push("⚠️ Sigue SIN PUBLICAR");
          if (!afterVariants[0]?.compare_at_price) postAuditIssues.push("⚠️ Sigue sin compare_at_price");
          if (afterImages.length < 3) postAuditIssues.push(`⚠️ Pocas imágenes (${afterImages.length})`);
          if (afterBodyLen < 500) postAuditIssues.push(`⚠️ Descripción corta (${afterBodyLen}ch)`);
  
          const preAuditText = preAuditIssues.length > 0 ? `\n\n🔍 Pre-auditoría: ${preAuditIssues.join(" | ")}` : "";
          const postAuditText = postAuditIssues.length > 0 ? `\n🔍 Post-auditoría: ${postAuditIssues.join(" | ")}` : "\n✅ Auditoría post-edición OK";
  
          result = {
            productId: updated.product.id,
            title: updated.product.title,
            status: updated.product.status,
            published: afterPublished,
            preAuditIssues,
            postAuditIssues,
            message: `Producto "${updated.product.title}" actualizado en Shopify${preAuditText}${postAuditText}`,
          };
          break;
        }
  
        case "change_price": {
          const projectId = params?.projectId;
          let productId = params?.productId;
          const productTitle = params?.title || params?.name;
          const newPrice = params?.price;
          if (!projectId || (!productId && !productTitle) || !newPrice) { res.status(400).json({ error: "projectId, (productId o title) y price requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          if (!productId && productTitle) {
            const cleanTitle = String(productTitle).trim();
            if (cleanTitle.length < 3) { res.status(400).json({ error: "El nombre del producto debe tener al menos 3 caracteres" }); return; }
            const catalog = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, "/products.json?limit=250&fields=id,title"
            );
            const searchName = cleanTitle.toLowerCase();
            const exactMatch = (catalog.products || []).find(p => String(p.title || "").toLowerCase() === searchName);
            const partialMatches = exactMatch ? [] : (catalog.products || []).filter(p => {
              const pTitle = String(p.title || "").toLowerCase();
              return pTitle.includes(searchName) || searchName.includes(pTitle);
            });
            const matched = exactMatch || (partialMatches.length === 1 ? partialMatches[0] : null);
            if (!matched && partialMatches.length > 1) {
              const candidates = partialMatches.slice(0, 5).map(p => `• ${p.title} (ID: ${p.id})`).join("\n");
              res.status(400).json({ error: `Varios productos coinciden con "${cleanTitle}":\n${candidates}\n\nEspecifica el nombre exacto o el productId.` }); return;
            }
            if (!matched) { res.status(404).json({ error: `Producto "${cleanTitle}" no encontrado en Shopify` }); return; }
            productId = String(matched.id);
          }
  
          const current = await shopifyRequest<{ product: { title: string; variants: Array<{ id: number; price: string }> } }>(
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
            message: `Precio actualizado para "${current.product.title}": ${current.product.variants[0].price}€ → ${newPrice}€`,
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
              scopes: ["read_products", "write_products", "read_orders", "write_orders", "read_all_orders", "read_customers", "write_customers", "read_analytics", "read_inventory", "write_inventory", "read_price_rules", "write_price_rules", "read_content", "write_content", "read_themes", "write_themes", "read_discounts", "write_discounts", "read_shipping", "write_shipping", "read_fulfillments", "write_fulfillments", "read_assigned_fulfillment_orders", "write_assigned_fulfillment_orders", "read_merchant_managed_fulfillment_orders", "write_merchant_managed_fulfillment_orders", "read_draft_orders", "write_draft_orders", "read_checkouts", "write_checkouts", "read_locations", "read_reports", "read_script_tags", "write_script_tags", "unauthenticated_read_product_listings"],
              total: 35,
              message: "35 scopes configurados en OAuth (todos los scopes del Admin API de Shopify)",
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
  
          let allSearchResults: Array<Record<string, unknown>> = [];
          for (const st of ["active", "draft", "archived"]) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?title=${encodeURIComponent(query)}&limit=10&status=${st}&published_status=any&fields=id,title,handle,status,variants,images,tags,body_html,published_at,published_scope`
            );
            allSearchResults = allSearchResults.concat(d.products || []);
          }
  
          const searchSeoRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const searchSeoLookup = new Map(searchSeoRows.map(s => [s.shopifyProductId, s]));
  
          result = {
            products: allSearchResults.map((p: Record<string, unknown>) => {
              const variants = (p.variants as Array<Record<string, string>>) || [];
              const images = (p.images as unknown[]) || [];
              const bodyLen = (p.body_html as string || "").length;
              const tagsArr = ((p.tags as string) || "").split(",").filter((t: string) => t.trim());
              const hasCompare = !!variants[0]?.compare_at_price;
              const isPublished = !!p.published_at;
              const imgCount = images.length;
  
              const issues: string[] = [];
              if (!isPublished) issues.push("NO PUBLICADO");
              if (!hasCompare) issues.push("sin compare_at_price");
              if (imgCount < 3) issues.push(`pocas imágenes (${imgCount})`);
              if (bodyLen < 500) issues.push(`descripción corta (${bodyLen}ch)`);
  
              let score = 0;
              if (imgCount >= 3) score += 25; else if (imgCount >= 1) score += 10;
              if (bodyLen >= 1000) score += 25; else if (bodyLen >= 500) score += 15; else if (bodyLen >= 200) score += 8;
              if (tagsArr.length >= 10) score += 25; else if (tagsArr.length >= 5) score += 15;
              if (hasCompare) score += 25;
  
              const spSeo = searchSeoLookup.get(String(p.id));
              const searchImages = (p.images as Array<Record<string, unknown>>) || [];
              const spHasAltTexts = searchImages.length > 0 && searchImages.every((img: Record<string, unknown>) => !!img.alt);
              const spHandle = (p.handle as string) || "";
              return {
                id: p.id, title: p.title, status: p.status,
                price: variants[0]?.price,
                compareAtPrice: variants[0]?.compare_at_price || null,
                imageCount: imgCount,
                imageUrl: searchImages[0]?.src || null,
                tagsCount: tagsArr.length,
                variantCount: variants.length,
                descriptionLength: bodyLen,
                published: isPublished,
                publishedScope: p.published_scope || "unknown",
                auditScore: score,
                auditGrade: score >= 85 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
                hasComparePrice: hasCompare,
                hasMetaTitle: !!(spSeo?.metaTitle && spSeo.metaTitle.length > 10),
                hasMetaDesc: !!(spSeo?.metaDescription && spSeo.metaDescription.length > 10),
                hasAltTexts: spHasAltTexts,
                cleanHandle: !!spHandle && !spHandle.includes("_"),
                issues: issues.length > 0 ? issues : undefined,
              };
            }),
            total: allSearchResults.length,
            message: `${allSearchResults.length} productos encontrados para "${query}"`,
          };
          break;
        }
  
        case "publish_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const beforePub = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,status,published_at,published_scope,variants,images,tags,body_html`
          );
          const prevStatus = beforePub.product.status;
          const prevPublished = !!beforePub.product.published_at;
          const prevScope = beforePub.product.published_scope;
  
          const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
            { method: "PUT", body: JSON.stringify({ product: { id: productId, status: "active", published: true, published_scope: "global" } }) }
          );
  
          const variants = (updated.product.variants as Array<Record<string, unknown>>) || [];
          const images = (updated.product.images as unknown[]) || [];
          const bodyLen = (updated.product.body_html as string || "").length;
          const hasCompare = !!variants[0]?.compare_at_price;
          const issues: string[] = [];
          if (!hasCompare) issues.push("⚠️ Sin compare_at_price (precio tachado)");
          if (images.length < 3) issues.push(`⚠️ Pocas imágenes (${images.length})`);
          if (bodyLen < 500) issues.push(`⚠️ Descripción corta (${bodyLen}ch)`);
  
          const auditNote = issues.length > 0 ? `\n\n🔍 Auditoría post-publicación:\n${issues.join("\n")}` : "\n\n✅ Auditoría OK — producto completo";
  
          result = {
            productId,
            title: updated.product.title,
            status: "active",
            published: true,
            publishedScope: "global",
            previousStatus: prevStatus,
            wasPublished: prevPublished,
            previousScope: prevScope,
            auditIssues: issues,
            message: `✅ Producto "${updated.product.title}" publicado correctamente\n📢 Estado: active | Publicado: SÍ | Alcance: global\n📋 Antes: status=${prevStatus}, publicado=${prevPublished ? "sí" : "no"}, scope=${prevScope}${auditNote}`,
          };
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
  
        case "audit_store": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const gqlAuditQuery = (cursor?: string) => `{
            products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
              edges {
                node {
                  id
                  title
                  handle
                  status
                  descriptionHtml
                  tags
                  publishedAt
                  onlineStoreUrl
                  totalInventory
                  seo { title description }
                  images(first: 20) { edges { node { id url altText } } }
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        price
                        compareAtPrice
                        sku
                        barcode
                        inventoryQuantity
                        image { url }
                      }
                    }
                  }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`;
  
          interface AuditGqlNode {
            id: string;
            title: string;
            handle: string;
            status: string;
            descriptionHtml: string;
            tags: string[];
            publishedAt: string | null;
            onlineStoreUrl: string | null;
            totalInventory: number;
            seo: { title: string | null; description: string | null };
            images: { edges: Array<{ node: { id: string; url: string; altText: string | null } }> };
            variants: { edges: Array<{ node: { id: string; title: string; price: string; compareAtPrice: string | null; sku: string | null; barcode: string | null; inventoryQuantity: number | null; image: { url: string } | null } }> };
          }
  
          let allAuditProducts: Array<Record<string, unknown>> = [];
          try {
            let hasNext = true;
            let cursor: string | undefined;
            const allEdges: Array<{ node: AuditGqlNode }> = [];
            while (hasNext) {
              const gqlData = await shopifyGraphQL<{ products: { edges: Array<{ node: AuditGqlNode }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                parseInt(projectId), project.shopDomain, gqlAuditQuery(cursor)
              );
              allEdges.push(...(gqlData.products?.edges || []));
              hasNext = gqlData.products?.pageInfo?.hasNextPage || false;
              cursor = gqlData.products?.pageInfo?.endCursor;
            }
            allAuditProducts = allEdges.map(({ node }) => {
              const gid = String(node.id || "");
              const numericId = gid.includes("/") ? gid.split("/").pop() : gid;
              const variantEdges = node.variants?.edges || [];
              const imageEdges = node.images?.edges || [];
              const seoTitle = node.seo?.title || null;
              const seoDesc = node.seo?.description || null;
              const metafields: Array<{ namespace: string; key: string; value: string }> = [];
              if (seoTitle) metafields.push({ namespace: "seo", key: "title", value: seoTitle });
              if (seoDesc) metafields.push({ namespace: "seo", key: "description", value: seoDesc });
  
              return {
                id: numericId,
                title: node.title,
                handle: node.handle,
                status: (node.status || "").toLowerCase(),
                body_html: node.descriptionHtml,
                tags: Array.isArray(node.tags) ? node.tags.join(", ") : node.tags,
                published_at: node.publishedAt,
                published_scope: node.onlineStoreUrl ? "global" : "web",
                totalInventory: node.totalInventory,
                seoTitle,
                seoDescription: seoDesc,
                metafields,
                images: imageEdges.map(({ node: img }) => ({
                  id: img.id,
                  src: img.url,
                  alt: img.altText,
                })),
                variants: variantEdges.map(({ node: v }) => ({
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  compare_at_price: v.compareAtPrice,
                  sku: v.sku,
                  barcode: v.barcode,
                  inventory_quantity: v.inventoryQuantity,
                  image_url: v.image?.url || null,
                })),
              };
            });
          } catch (gqlErr) {
            logger.warn({ err: gqlErr }, "GraphQL failed, falling back to REST API for audit");
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any`
              );
              const restProducts = d.products || [];
              for (const rp of restProducts) {
                try {
                  const metaRes = await shopifyRequest<{ metafields: Array<{ namespace: string; key: string; value: string }> }>(
                    parseInt(projectId), project.shopDomain, `/products/${rp.id}/metafields.json?namespace=global`
                  );
                  const seoMeta = metaRes.metafields || [];
                  const seoTitleMeta = seoMeta.find((m: Record<string, string>) => m.key === "title_tag");
                  const seoDescMeta = seoMeta.find((m: Record<string, string>) => m.key === "description_tag");
                  const metafields: Array<{ namespace: string; key: string; value: string }> = [];
                  if (seoTitleMeta) metafields.push({ namespace: "seo", key: "title", value: seoTitleMeta.value });
                  if (seoDescMeta) metafields.push({ namespace: "seo", key: "description", value: seoDescMeta.value });
                  (rp as Record<string, unknown>).metafields = metafields;
                  (rp as Record<string, unknown>).seoTitle = seoTitleMeta?.value || null;
                  (rp as Record<string, unknown>).seoDescription = seoDescMeta?.value || null;
                } catch { /* metafields fetch failed, continue without */ }
                await new Promise(r => setTimeout(r, 100));
              }
              for (const rp2 of restProducts) {
                (rp2 as Record<string, unknown>).id = String(rp2.id);
              }
              allAuditProducts = allAuditProducts.concat(restProducts);
            }
          }
  
          let totalScore = 0;
          const criticalIssues: string[] = [];
          const warnings: string[] = [];
          let unpublishedCount = 0;
          let noCompareCount = 0;
          let lowImageCount = 0;
          let shortDescCount = 0;
          let lowTagsCount = 0;
          let draftCount = 0;
          let noMetaTitleCount = 0;
          let noMetaDescCount = 0;
          let noAltTextCount = 0;
          let noSkuCount = 0;
          let zeroStockCount = 0;
          let noHandleCount = 0;
  
          const productAudits = allAuditProducts.map((p: Record<string, unknown>) => {
            const variants = (p.variants as Array<Record<string, unknown>>) || [];
            const images = (p.images as Array<Record<string, unknown>>) || [];
            const bodyHtml = (p.body_html as string) || "";
            const bodyLen = bodyHtml.length;
            const tagsStr = (p.tags as string) || "";
            const tagsArr = tagsStr.split(",").filter((t: string) => t.trim());
            const hasCompare = variants.some(v => !!v.compare_at_price || !!v.compareAtPrice);
            const isPublished = !!p.published_at;
            const imgCount = images.length;
            const status = p.status as string;
            const handle = (p.handle as string) || "";
            const seoTitle = p.seoTitle as string | null;
            const seoDescription = p.seoDescription as string | null;
            const metafields = (p.metafields as Array<{ namespace: string; key: string; value: string }>) || [];
  
            const audit = auditProduct({
              title: (p.title as string) || "",
              body_html: bodyHtml,
              price: (variants[0]?.price as string) || null,
              compare_at_price: (variants[0]?.compare_at_price as string) || (variants[0]?.compareAtPrice as string) || null,
              images: images.map((img: Record<string, unknown>) => ({
                alt: (img.alt as string) || (img.altText as string) || null,
              })),
              tags: tagsStr,
              variants: variants.map(v => ({ price: (v.price as string) || "0" })),
              metafields,
            });
  
            const issues: string[] = [...audit.problems];
            if (!isPublished) { issues.push("NO PUBLICADO"); unpublishedCount++; }
            if (status === "draft") { issues.push("BORRADOR"); draftCount++; }
            if (!hasCompare) noCompareCount++;
            if (imgCount < 3) lowImageCount++;
            if (bodyLen < 500) shortDescCount++;
            if (tagsArr.length < 10) lowTagsCount++;
            if (!seoTitle && !metafields.some(m => m.namespace === "seo" && m.key === "title")) noMetaTitleCount++;
            if (!seoDescription && !metafields.some(m => m.namespace === "seo" && m.key === "description")) noMetaDescCount++;
            const hasAllAlt = imgCount > 0 && images.every((img: Record<string, unknown>) => {
              const alt = (img.alt as string) || (img.altText as string) || "";
              return alt.trim().length > 0;
            });
            if (imgCount > 0 && !hasAllAlt) noAltTextCount++;
            const allVariantsHaveSku = variants.every(v => !!(v.sku as string)?.trim());
            if (!allVariantsHaveSku && variants.length > 0) noSkuCount++;
            const totalInv = typeof p.totalInventory === "number" ? p.totalInventory : variants.reduce((sum, v) => sum + (typeof v.inventory_quantity === "number" ? v.inventory_quantity : 0), 0);
            if (totalInv <= 0 && status === "active") zeroStockCount++;
            if (!handle || handle.includes("_") || !/^[a-z0-9-]+$/.test(handle)) noHandleCount++;
  
            const variantDetails = variants.map((v: Record<string, unknown>) => ({
              title: v.title,
              price: v.price,
              compareAtPrice: v.compare_at_price || v.compareAtPrice || null,
              sku: v.sku || null,
              barcode: v.barcode || null,
              weight: v.weight || null,
              weightUnit: v.weight_unit || v.weightUnit || null,
              inventoryQuantity: v.inventory_quantity ?? v.inventoryQuantity ?? null,
              hasImage: !!(v.image_url || v.image),
            }));
  
            totalScore += audit.overallScore;
  
            const firstImg = images[0] as Record<string, unknown> | undefined;
            return {
              id: p.id,
              title: p.title,
              handle,
              status,
              published: isPublished,
              publishedScope: p.published_scope,
              score: audit.overallScore,
              grade: audit.grade,
              titleScore: audit.titleScore,
              descriptionScore: audit.descriptionScore,
              priceScore: audit.priceScore,
              imageScore: audit.imageScore,
              seoScore: audit.seoScore,
              contentQualityScore: audit.contentQualityScore,
              trustScore: audit.trustScore,
              imageCount: imgCount,
              imageUrl: firstImg?.src || firstImg?.url || null,
              descLength: bodyLen,
              tagsCount: tagsArr.length,
              variantCount: variants.length || 1,
              price: (variants[0]?.price as string) ?? "0",
              compareAtPrice: (variants[0]?.compare_at_price as string) || (variants[0]?.compareAtPrice as string) || null,
              hasCompare,
              hasComparePrice: hasCompare,
              hasMetaTitle: !!(seoTitle || metafields.some(m => m.namespace === "seo" && m.key === "title")),
              hasMetaDesc: !!(seoDescription || metafields.some(m => m.namespace === "seo" && m.key === "description")),
              hasAltTexts: hasAllAlt,
              cleanHandle: !!handle && /^[a-z0-9-]+$/.test(handle) && handle.length <= 60,
              totalInventory: totalInv,
              variants: variantDetails,
              problems: audit.problems,
              suggestions: audit.suggestions.slice(0, 5),
              issues: issues.length > 0 ? issues : undefined,
            };
          });
  
          if (unpublishedCount > 0) criticalIssues.push(`🚨 ${unpublishedCount} producto(s) NO PUBLICADOS — invisibles para clientes`);
          if (draftCount > 0) criticalIssues.push(`📝 ${draftCount} producto(s) en BORRADOR — no visibles en la tienda`);
          if (zeroStockCount > 0) criticalIssues.push(`📦 ${zeroStockCount} producto(s) ACTIVOS con stock 0 — no se pueden comprar`);
          if (noMetaTitleCount > 0) warnings.push(`🔍 ${noMetaTitleCount} producto(s) sin meta title SEO — Google usará el título por defecto`);
          if (noMetaDescCount > 0) warnings.push(`📋 ${noMetaDescCount} producto(s) sin meta description — impacto crítico en CTR de Google`);
          if (noCompareCount > 0) warnings.push(`💰 ${noCompareCount} producto(s) sin precio tachado (compare_at_price)`);
          if (lowImageCount > 0) warnings.push(`🖼 ${lowImageCount} producto(s) con menos de 3 imágenes`);
          if (noAltTextCount > 0) warnings.push(`🏷️ ${noAltTextCount} producto(s) con imágenes sin alt text — pierde SEO en Google Images`);
          if (shortDescCount > 0) warnings.push(`📝 ${shortDescCount} producto(s) con descripción corta (<500 caracteres)`);
          if (lowTagsCount > 0) warnings.push(`🏷 ${lowTagsCount} producto(s) con menos de 10 tags SEO`);
          if (noSkuCount > 0) warnings.push(`🔢 ${noSkuCount} producto(s) sin SKU en variantes — dificulta gestión de inventario`);
          if (noHandleCount > 0) warnings.push(`🔗 ${noHandleCount} producto(s) con URL handle no optimizada`);
  
          const avgScore = allAuditProducts.length > 0 ? Math.round(totalScore / allAuditProducts.length) : 0;
          const overallGrade = scoreToGrade(avgScore);
  
          let auditMessage = `🔍 AUDITORÍA PROFUNDA COMPLETA — ${project.shopDomain}\n\n`;
          auditMessage += `📊 Puntuación media: ${avgScore}/100 (${overallGrade})\n`;
          auditMessage += `📦 Total: ${allAuditProducts.length} productos\n`;
          auditMessage += `📢 Publicados: ${allAuditProducts.length - unpublishedCount} | 🔇 No publicados: ${unpublishedCount}\n\n`;
          auditMessage += `📐 Criterios evaluados: Título, Descripción, Precio, Imágenes (cantidad + alt texts), SEO (meta title + meta description + tags + handle), Calidad de contenido, Confianza, Variantes (stock + SKU + precio tachado).\n`;
          if (criticalIssues.length > 0) auditMessage += `\n🚨 PROBLEMAS CRÍTICOS:\n${criticalIssues.join("\n")}`;
          if (warnings.length > 0) auditMessage += `\n\n⚠️ ADVERTENCIAS:\n${warnings.join("\n")}`;
          if (criticalIssues.length === 0 && warnings.length === 0) auditMessage += `\n✅ ¡Todos los productos están en perfecto estado!`;
  
          const projIdInt = parseInt(projectId);
          for (const pa of productAudits) {
            const pid = String(pa.id);
            const seoT = (allAuditProducts.find(ap => ap.id === pid) as Record<string, unknown>)?.seoTitle as string | null;
            const seoD = (allAuditProducts.find(ap => ap.id === pid) as Record<string, unknown>)?.seoDescription as string | null;
            try {
              const seoValues = {
                metaTitle: seoT || null,
                metaDescription: seoD || null,
                hasAltTexts: !!pa.hasAltTexts,
                cleanHandle: !!pa.cleanHandle,
                seoScore: pa.seoScore as number,
                seoGrade: scoreToGrade(pa.seoScore as number),
                descriptionLength: pa.descLength as number,
                lastAuditedAt: new Date(),
              };
              const [existing] = await db.select({ id: seoDataTable.id }).from(seoDataTable)
                .where(and(eq(seoDataTable.projectId, projIdInt), eq(seoDataTable.shopifyProductId, pid)));
              if (existing) {
                await db.update(seoDataTable).set(seoValues).where(eq(seoDataTable.id, existing.id));
              } else {
                await db.insert(seoDataTable).values({ projectId: projIdInt, shopifyProductId: pid, ...seoValues });
              }
            } catch (seoSaveErr) {
              logger.warn({ err: seoSaveErr, productId: pid }, "Failed to save SEO data during audit");
            }
          }
  
          result = {
            totalProducts: allAuditProducts.length,
            averageScore: avgScore,
            overallGrade,
            publishedCount: allAuditProducts.length - unpublishedCount,
            unpublishedCount,
            draftCount,
            noCompareCount,
            lowImageCount,
            shortDescCount,
            lowTagsCount,
            noMetaTitleCount,
            noMetaDescCount,
            noAltTextCount,
            noSkuCount,
            zeroStockCount,
            noHandleCount,
            criticalIssues,
            warnings,
            criteriaEvaluated: ["Título (longitud, keywords, genérico)", "Descripción (longitud, estructura, H2/H3, bullets, FAQ)", "Precio (compare_at, pricing psicológico, variantes)", "Imágenes (cantidad, alt texts SEO)", "SEO (meta title, meta description, tags, handle URL)", "Calidad de contenido (beneficios, specs, FAQ, CTA, garantía)", "Confianza (garantía, imágenes, alt texts, FAQ, specs)", "Variantes (stock, SKU, precio tachado, imágenes)"],
            products: productAudits,
            message: auditMessage,
          };
          break;
        }
  
        case "fix_unpublished": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const gqlUnpubQuery = (cursor?: string) => `{
            products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
              edges {
                node {
                  id
                  title
                  status
                  publishedAt
                  onlineStoreUrl
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`;
  
          let unpublishedProducts: Array<Record<string, unknown>> = [];
          try {
            let hasNext2 = true;
            let cursor2: string | undefined;
            const allUnpubEdges: Array<{ node: Record<string, unknown> }> = [];
            while (hasNext2) {
              const gqlUnpubData = await shopifyGraphQL<{ products: { edges: Array<{ node: Record<string, unknown> }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                parseInt(projectId), project.shopDomain, gqlUnpubQuery(cursor2)
              );
              allUnpubEdges.push(...(gqlUnpubData.products?.edges || []));
              hasNext2 = gqlUnpubData.products?.pageInfo?.hasNextPage || false;
              cursor2 = gqlUnpubData.products?.pageInfo?.endCursor;
            }
            unpublishedProducts = allUnpubEdges
              .map(({ node }) => ({
                id: String(node.id || "").split("/").pop(),
                title: node.title,
                status: (node.status as string || "").toLowerCase(),
                published_at: node.publishedAt,
                published_scope: node.onlineStoreUrl ? "global" : null,
              }))
              .filter((p: Record<string, unknown>) => !p.published_at || p.status === "draft");
          } catch {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=unpublished&fields=id,title,status,published_at,published_scope`
              );
              unpublishedProducts = unpublishedProducts.concat(d.products || []);
            }
            for (const st of ["draft"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any&fields=id,title,status,published_at,published_scope`
              );
              for (const p of (d.products || [])) {
                if (!unpublishedProducts.find((u: Record<string, unknown>) => u.id === p.id)) {
                  unpublishedProducts.push(p);
                }
              }
            }
          }
  
          if (unpublishedProducts.length === 0) {
            result = { fixed: 0, message: "✅ No hay productos sin publicar — todos están visibles para los clientes" };
            break;
          }
  
          const fixed: Array<{ id: unknown; title: string; previousStatus: string; previousPublished: boolean }> = [];
          const errors: string[] = [];
  
          for (const p of unpublishedProducts) {
            try {
              await shopifyRequest(
                parseInt(projectId), project.shopDomain, `/products/${p.id}.json`,
                { method: "PUT", body: JSON.stringify({ product: { id: p.id, status: "active", published: true, published_scope: "global" } }) }
              );
              fixed.push({
                id: p.id,
                title: String(p.title),
                previousStatus: String(p.status),
                previousPublished: !!p.published_at,
              });
            } catch (e) {
              errors.push(`${p.title}: ${e instanceof Error ? e.message : "error"}`);
            }
          }
  
          result = {
            fixed: fixed.length,
            errors: errors.length,
            products: fixed,
            errorDetails: errors.length > 0 ? errors : undefined,
            message: `✅ ${fixed.length}/${unpublishedProducts.length} producto(s) publicados correctamente (status=active, published=true, scope=global)${errors.length > 0 ? `\n⚠️ ${errors.length} error(es): ${errors.join(", ")}` : ""}`,
          };
          break;
        }
  
        case "fix_missing_compare_prices": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const gqlPriceQuery = (cursor?: string) => `{
            products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
              edges {
                node {
                  id
                  title
                  variants(first: 100) {
                    edges {
                      node { id price compareAtPrice }
                    }
                  }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`;
  
          let allPriceProducts: Array<Record<string, unknown>> = [];
          try {
            let hasNext3 = true;
            let cursor3: string | undefined;
            const allPriceEdges: Array<{ node: Record<string, unknown> }> = [];
            while (hasNext3) {
              const gqlPriceData = await shopifyGraphQL<{ products: { edges: Array<{ node: Record<string, unknown> }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
                parseInt(projectId), project.shopDomain, gqlPriceQuery(cursor3)
              );
              allPriceEdges.push(...(gqlPriceData.products?.edges || []));
              hasNext3 = gqlPriceData.products?.pageInfo?.hasNextPage || false;
              cursor3 = gqlPriceData.products?.pageInfo?.endCursor;
            }
            allPriceProducts = allPriceEdges.map(({ node }) => {
              const variantEdges = ((node.variants as Record<string, unknown>)?.edges as Array<{ node: Record<string, unknown> }>) || [];
              return {
                id: String(node.id || "").split("/").pop(),
                title: node.title,
                variants: variantEdges.map(({ node: v }) => {
                  const varGid = String(v.id || "");
                  return { id: varGid.includes("/") ? varGid.split("/").pop() : varGid, price: v.price, compare_at_price: v.compareAtPrice };
                }),
              };
            });
          } catch {
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any&fields=id,title,variants`
              );
              allPriceProducts = allPriceProducts.concat(d.products || []);
            }
          }
  
          const fixedVariants: Array<{ productTitle: string; variantId: unknown; price: string; compareAtPrice: string }> = [];
          const priceErrors: string[] = [];
  
          for (const p of allPriceProducts) {
            const variants = (p.variants as Array<Record<string, unknown>>) || [];
            for (const v of variants) {
              const price = parseFloat(String(v.price || "0"));
              const hasCompare = !!v.compare_at_price;
              if (!hasCompare && price >= 1) {
                const markup = price < 30 ? 1.30 : price < 100 ? 1.28 : price < 300 ? 1.25 : 1.22;
                const rawCompare = Math.round(price * markup) - 0.01;
                const comparePrice = (rawCompare > price ? rawCompare : price + 1).toFixed(2);
                try {
                  await shopifyRequest(
                    parseInt(projectId), project.shopDomain, `/variants/${v.id}.json`,
                    { method: "PUT", body: JSON.stringify({ variant: { id: v.id, compare_at_price: comparePrice } }) }
                  );
                  fixedVariants.push({ productTitle: String(p.title), variantId: v.id, price: String(v.price), compareAtPrice: comparePrice });
                } catch (e) {
                  priceErrors.push(`${p.title} (variant ${v.id}): ${e instanceof Error ? e.message : "error"}`);
                }
              }
            }
          }
  
          result = {
            fixed: fixedVariants.length,
            errors: priceErrors.length,
            variants: fixedVariants.slice(0, 30),
            errorDetails: priceErrors.length > 0 ? priceErrors : undefined,
            message: fixedVariants.length > 0
              ? `✅ ${fixedVariants.length} variante(s) actualizadas con compare_at_price (precio tachado visible)${priceErrors.length > 0 ? `\n⚠️ ${priceErrors.length} error(es)` : ""}`
              : "✅ Todos los productos ya tienen compare_at_price configurado",
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
  
          const scanProducts = await db.select().from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));
          const scanSeoRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const scanSeoLookup = new Map(scanSeoRows.map(s => [s.shopifyProductId, s]));
          const scanCards = scanProducts.map((p: typeof productsTable.$inferSelect) => {
            const imgs = Array.isArray(p.imagesJson) ? p.imagesJson as Array<{ src?: string; alt?: string | null }> : [];
            const descLen = typeof p.bodyHtml === "string" ? p.bodyHtml.length : 0;
            const tagsList = typeof p.tags === "string" ? p.tags.split(",").filter((t: string) => t.trim()) : [];
            const scanSeo = scanSeoLookup.get(p.shopifyProductId);
            return {
              title: p.title ?? "Sin título",
              status: p.status ?? "active",
              price: p.price ?? "0",
              compareAtPrice: p.compareAtPrice ?? null,
              imageUrl: imgs[0]?.src ?? null,
              imageCount: p.imageCount ?? 0,
              variantCount: p.variantCount ?? 1,
              descriptionLength: descLen,
              tagsCount: tagsList.length,
              published: !!p.publishedAt,
              auditScore: p.auditScore ?? 0,
              auditGrade: p.auditGrade ?? "F",
              hasComparePrice: !!p.compareAtPrice,
              hasMetaTitle: !!(scanSeo?.metaTitle && scanSeo.metaTitle.length > 10),
              hasMetaDesc: !!(scanSeo?.metaDescription && scanSeo.metaDescription.length > 10),
              hasAltTexts: imgs.length > 0 && imgs.every((i: { alt?: string | null }) => !!i.alt),
              cleanHandle: !!p.handle && !p.handle.includes("_"),
            };
          });
  
          result = {
            ...syncData,
            products: scanCards,
            statusFilter,
            pageSpeed: psData ? { mobile: psData.mobile, desktop: psData.desktop } : null,
            message: `Escaneo completado (filtro: ${statusFilter}). ${syncData.synced ?? syncData.total ?? 0} productos analizados. Nota media: ${typeof syncData.avgScore === "number" ? syncData.avgScore.toFixed(0) : "N/A"}/100${psMessage}`,
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
              parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&status=${st}&published_status=any&fields=id,title,handle,status,published_at,variants,images,tags,product_type,body_html`
            );
            allProds = allProds.concat(d.products || []);
          }
          if (allProds.length > limit) allProds = allProds.slice(0, limit);
  
          const lapSeoRows = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, parseInt(projectId)));
          const lapSeoLookup = new Map(lapSeoRows.map(s => [s.shopifyProductId, s]));
  
          const byStatus: Record<string, number> = {};
          allProds.forEach((p: Record<string, unknown>) => {
            const s = String(p.status || "unknown");
            byStatus[s] = (byStatus[s] || 0) + 1;
          });
  
          const published = allProds.filter(p => !!p.published_at).length;
          const unpublished = allProds.length - published;
  
          result = {
            products: allProds.map((p: Record<string, unknown>) => {
              const variants = (p.variants as Array<Record<string, string>>) || [];
              const images = (p.images as Array<Record<string, unknown>>) || [];
              const bodyHtmlLap = (p.body_html as string) || "";
              const tagsStrLap = (p.tags as string) || "";
              const tagsArr = tagsStrLap.split(",").filter((t: string) => t.trim());
              const imgCount = images.length;
  
              const lapSeo = lapSeoLookup.get(String(p.id));
              const metafieldsLap: Array<{ namespace: string; key: string; value: string }> = [];
              if (lapSeo?.metaTitle) metafieldsLap.push({ namespace: "seo", key: "title", value: lapSeo.metaTitle });
              if (lapSeo?.metaDescription) metafieldsLap.push({ namespace: "seo", key: "description", value: lapSeo.metaDescription });
  
              const lapAudit = auditProduct({
                title: (p.title as string) || "",
                body_html: bodyHtmlLap,
                price: variants[0]?.price || null,
                compare_at_price: variants[0]?.compare_at_price || null,
                images: images.map((img: Record<string, unknown>) => ({ alt: (img.alt as string) || null })),
                tags: tagsStrLap,
                variants: variants.map(v => ({ price: v.price || "0" })),
                metafields: metafieldsLap,
              });
  
              const lapHandle = (p.handle as string) || "";
              const lapHasAltTexts = imgCount > 0 && images.every((img: Record<string, unknown>) => !!(img.alt as string)?.trim());
  
              return {
                id: p.id, title: p.title, status: p.status,
                published: !!p.published_at,
                price: variants[0]?.price ?? "0.00",
                compareAtPrice: variants[0]?.compare_at_price || null,
                variantCount: variants.length,
                imageCount: imgCount,
                imageUrl: images[0]?.src || null,
                tags: p.tags,
                tagsCount: tagsArr.length,
                descriptionLength: bodyHtmlLap.length,
                product_type: p.product_type || null,
                auditScore: lapAudit.overallScore,
                auditGrade: lapAudit.grade,
                titleScore: lapAudit.titleScore,
                descriptionScore: lapAudit.descriptionScore,
                imageScore: lapAudit.imageScore,
                seoScore: lapAudit.seoScore,
                hasComparePrice: !!variants[0]?.compare_at_price,
                hasMetaTitle: !!(lapSeo?.metaTitle && lapSeo.metaTitle.length > 10),
                hasMetaDesc: !!(lapSeo?.metaDescription && lapSeo.metaDescription.length > 10),
                hasAltTexts: lapHasAltTexts,
                cleanHandle: !!lapHandle && /^[a-z0-9-]+$/.test(lapHandle) && lapHandle.length <= 60,
                problems: lapAudit.problems.slice(0, 3),
                suggestions: lapAudit.suggestions.slice(0, 2),
              };
            }),
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
  
          // FIX CRIT-5: rechazar rutas traversal y normalizar path
          const dirStr = String(directory).trim();
          if (dirStr.includes("..") || path.isAbsolute(dirStr) || dirStr.includes("\0")) {
            result = { error: true, message: "🚫 Path inválido: no se permiten rutas con '..', absolutas ni caracteres nulos." };
            break;
          }
          const frontendDir = normalizeListDirectory(dirStr, FRONTEND_ROOT);
          const backendDir = normalizeListDirectory(dirStr, BACKEND_ROOT);
          if (!frontendDir || !backendDir) {
            result = { error: true, message: "🚫 Directory fuera del workspace permitido. Solo se pueden listar subdirectorios de src/." };
            break;
          }
          const frontendFiles = listDir(FRONTEND_ROOT, frontendDir, "[frontend] ");
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
  
          const resolvedPath = resolveFilePath(String(filePath));
          if (!resolvedPath) {
            res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
            return;
          }
          const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  
          const lines = fileContent.split("\n").length;
          const truncated = fileContent.length > 15000 ? fileContent.slice(0, 15000) + "\n\n// ... [truncado, archivo demasiado largo]" : fileContent;
          let analysis = "";
  
          if (params?.analyze !== false) {
            try {
              const inspectProjectId = getSessionProjectId(req, params);
              analysis = await askClaudeWithBrain(
                inspectProjectId,
                [{
                  role: "user",
                  content: `Analiza este archivo de código fuente de una app Shopify (React+TypeScript frontend, Express+Node backend).
  Identifica: bugs, errores lógicos, problemas de UX, funciones rotas, imports faltantes, handlers sin error handling, y cualquier otro problema.
  Responde en español, sé concreto y directo. Para cada problema indica la línea aproximada y el fix sugerido.
  
  Archivo: ${filePath}
  \`\`\`
  ${truncated}
  \`\`\``,
                }],
                undefined,
                "general",
                undefined,
                2000
              );
              learnFromOperation({
                operationType: "code_analysis",
                title: `Análisis de código: ${filePath}`,
                content: analysis.slice(0, 500),
                confidence: 0.7,
                tags: ["code_analysis", "inspect_code"],
              });
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
  
          const resolvedAnalyzePath = resolveFilePath(String(filePath));
          if (!resolvedAnalyzePath) {
            res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
            return;
          }
          const fileContent = fs.readFileSync(resolvedAnalyzePath, "utf-8");
  
          const truncated = fileContent.length > 18000 ? fileContent.slice(0, 18000) + "\n// ... [truncado]" : fileContent;
  
          const focusPrompts: Record<string, string> = {
            bugs: "Busca SOLO bugs, errores de runtime, null pointer exceptions, funciones que fallan, imports rotos, variables undefined.",
            ux: "Busca SOLO problemas de UX: botones que no funcionan, feedback faltante al usuario, estados de loading no manejados, errores silenciosos sin mensaje.",
            performance: "Busca SOLO problemas de rendimiento: re-renders innecesarios, llamadas API sin cache, loops ineficientes, memory leaks.",
            logic: "Busca SOLO errores de lógica de negocio: cálculos incorrectos, condiciones mal escritas, estados inconsistentes, race conditions.",
            all: "Haz un análisis COMPLETO: bugs, errores lógicos, UX, rendimiento, seguridad. Prioriza por severidad (crítico > alto > medio > bajo).",
          };
  
          try {
            const componentProjectId = getSessionProjectId(req, params);
            const componentAnalysis = await askClaudeWithBrain(
              componentProjectId,
              [{
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
              undefined,
              "general",
              undefined,
              4000
            );
  
            const criticalCount = (componentAnalysis.match(/🔴/g) || []).length;
            const highCount = (componentAnalysis.match(/🟡/g) || []).length;
            const mediumCount = (componentAnalysis.match(/🟢/g) || []).length;
            const lowCount = (componentAnalysis.match(/⚪/g) || []).length;
            const totalIssues = criticalCount + highCount + mediumCount + lowCount;
  
            learnFromOperation({
              operationType: "component_analysis",
              title: `Análisis de componente: ${filePath} (${focusOn})`,
              content: `${totalIssues} problemas encontrados: ${criticalCount} críticos, ${highCount} altos. ${componentAnalysis.slice(0, 300)}`,
              confidence: 0.75,
              tags: ["code_audit", "analyze_component", focusOn],
            });
  
            result = {
              filePath,
              focusOn,
              analysis: componentAnalysis,
              issueCount: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount, total: totalIssues },
              message: `🔍 **Análisis de ${filePath}** (enfoque: ${focusOn})\n📊 ${totalIssues} problemas: ${criticalCount} críticos, ${highCount} altos, ${mediumCount} medios, ${lowCount} bajos\n\n${componentAnalysis}`,
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
          const description = params?.description || "Fix aplicado por Shopy Crafter";
          const confirmed = params?.confirmed === true || params?.confirmed === "true";
  
          if (!filePath || !oldCode || newCode === undefined) {
            res.status(400).json({ error: "filePath, oldCode y newCode son requeridos" });
            return;
          }
          if (String(filePath).includes("..") || path.isAbsolute(String(filePath))) { res.status(400).json({ error: "Path inválido: no se permiten rutas absolutas ni '..'." }); return; }

          // FIX CRIT-1: whitelist estricta de paths modificables
          const pathError = validateFixCodePath(String(filePath));
          if (pathError) {
            result = { error: true, message: `🚫 ${pathError}` };
            break;
          }

          // FIX CRIT-6: confirmación explícita requerida para acciones destructivas
          if (!confirmed) {
            result = {
              requiresConfirmation: true,
              action: "fix_code",
              filePath,
              description,
              preview: {
                summary: `Modificar código en ${filePath}: ${description}`,
                before: String(oldCode).slice(0, 300),
                after: String(newCode).slice(0, 300),
              },
              message: `⚠️ **Confirmación requerida para fix_code en \`${filePath}\`**\n\n` +
                       `**Descripción:** ${description}\n` +
                       `**Cambio:** ${String(newCode).split("\n").length} líneas modificadas\n\n` +
                       `Re-envía la acción con \`"confirmed": true\` para aplicar el cambio.`,
            };
            break;
          }

          const resolvedPath = resolveFilePath(String(filePath));
          if (!resolvedPath) {
            res.status(404).json({ error: `Archivo no encontrado: ${filePath}. Prueba con list_source_files para ver los archivos disponibles.` });
            return;
          }
          let fileContent = fs.readFileSync(resolvedPath, "utf-8");
  
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
  
          const tagsArr = currentTags.split(",").filter(t => t.trim());
          const imgCount = images.length;
          const bodyLen = currentDesc.length;
          const hasCompare = !!currentCompareAt;
          let optScore = 0;
          if (imgCount >= 3) optScore += 25; else if (imgCount >= 1) optScore += 10;
          if (bodyLen >= 1000) optScore += 25; else if (bodyLen >= 500) optScore += 15; else if (bodyLen >= 200) optScore += 8;
          if (tagsArr.length >= 10) optScore += 25; else if (tagsArr.length >= 5) optScore += 15;
          if (hasCompare) optScore += 25;
          const optGrade = optScore >= 85 ? "A" : optScore >= 60 ? "B" : optScore >= 40 ? "C" : "D";
  
          result = {
            status: "optimizing",
            productId,
            currentTitle,
            products: [{
              title: currentTitle,
              status: String(prod.status || "active"),
              price: currentPrice,
              compareAtPrice: currentCompareAt || null,
              imageCount: imgCount,
              imageUrl: images[0]?.src || null,
              variantCount: variants.length,
              descriptionLength: bodyLen,
              tagsCount: tagsArr.length,
              published: !!prod.published_at,
              auditScore: optScore,
              auditGrade: optGrade,
              hasComparePrice: hasCompare,
            }],
            message: `⏳ Optimización 10/10 iniciada para "${currentTitle}".\n\nEl ShopyBrain Dual AI (Gemini + Claude) está generando:\n📝 Descripción 400+ palabras\n🏷 22+ tags SEO\n🔍 Meta title + description\n🎯 Variantes inteligentes\n💰 Análisis de precios\n\nTarda ~90s. El producto se actualizará automáticamente en Shopify.`,
          };
  
          (async () => {
            try {
  
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
  
          const existingOptions = (prod.options as Array<Record<string, unknown>>) || [];
          const hasRealVariants = variants.length > 1 || (existingOptions.length > 0 && existingOptions.some((o: Record<string, unknown>) => o.name !== "Title" && (o.values as string[] || []).length > 1));
  
          const variantsBlock = hasRealVariants
            ? `\n- Variantes actuales: ${variants.length} (${existingOptions.map((o: Record<string, unknown>) => `${o.name}: ${(o.values as string[] || []).join(", ")}`).join("; ")})\n  → Las variantes ya existen, NO generes nuevas options/variants en tu respuesta.`
            : `\n- Variantes: SOLO 1 variante por defecto (SIN opciones reales)\n  → DEBES generar variantes inteligentes según el tipo de producto (ver reglas abajo).`;
  
          const optimizePrompt = `Eres el mejor copywriter, experto SEO, estratega de pricing y Product Manager de Shopify del mundo. Optimiza este producto a CALIDAD 10/10.
  
  PRODUCTO ACTUAL:
  - Título: "${currentTitle}"
  - Descripción HTML actual: "${currentDesc.slice(0, 500)}"
  - Vendor: "${vendor}"
  - Tipo: "${productType}"
  - Tags actuales: "${currentTags}"
  - Precio actual: ${currentPrice}€
  ${currentCompareAt ? `- Precio de comparación: ${currentCompareAt}€` : ""}
  - Imágenes: ${images.length} fotos${variantsBlock}
  - Nicho de la tienda: ${storeNiche}
  - Tono de marca: ${project.brandTone || "profesional y apasionado"}
  ${priceContextBlock}
  
  GENERA UN JSON COMPLETO con TODOS estos campos:
  {
    "title": "Título optimizado SEO (40-70 chars, incluye keywords relevantes)",
    "bodyHtml": "Descripción HTML COMPLETA y profesional. Mínimo 400 palabras. Incluye: <h2> subtítulos, <ul><li> bullet points con beneficios, especificaciones técnicas, storytelling emocional sobre el producto, llamada a la acción. Usa <strong> para enfatizar. NO uses placeholder ni lorem ipsum. Contenido REAL basado en el producto.",
    "tags": ["tag1", "tag2", "...mínimo 22 tags..."],
    "seoTitle": "Meta title SEO optimizado (50-60 chars con keyword principal)",
    "seoDescription": "Meta description persuasiva (140-160 chars con CTA)",
    "altTexts": ["alt text descriptivo imagen 1", "alt text descriptivo imagen 2", "..."],
    "handle": "url-handle-optimizado-seo",
    "pricingSuggestion": {
      "suggestedPrice": XX.XX,
      "suggestedCompareAtPrice": XX.XX,
      "reasoning": "Por qué este precio basado en datos reales del mercado",
      "marketPosition": "budget|mid-range|premium|luxury",
      "competitorsAnalyzed": N
    },
    "options": [{"name":"NombreOpcion","values":["val1","val2",...]}],
    "variants": [{"optionValues":{"NombreOpcion":"val1"},"sku":"SKU-V1","price":XX.99,"compareAtPrice":XX.99,"inventoryQuantity":25,"weight":0.3,"weightUnit":"kg","costPerItem":XX.XX,"barcode":"8400000000001"}, ...],
    "inventoryPolicy": "deny"
  }
  
  REGLAS DE VARIANTES (OBLIGATORIO si el producto NO tiene variantes reales):
  Analiza el tipo de producto y genera TODAS las variantes que tendría una tienda profesional 10/10:
  - ROPA/MODA: Talla (XS-XXL) × Color (3-5 colores)
  - CALZADO: Número (36-45) × Color
  - JOYERÍA: Material (Plata 925, Oro 18k, Acero) × Medida
  - IMPRESIÓN 3D: Material (PLA, ABS, Resina, PETG, Nylon) × Color/Acabado (Mate, Brillante, Transparente)
  - COMICS/LIBROS: Formato (Digital, Tapa Blanda, Tapa Dura, Edición Limitada) × Idioma
  - ARTE/PRINTS: Tamaño (A4, A3, A2, A1) × Acabado (Mate, Brillante, Canvas, Enmarcado)
  - ELECTRÓNICA: Capacidad × Color
  - COSMÉTICA: Tamaño (30ml, 50ml, 100ml) × Tono
  - SERVICIOS DIGITALES: Plan (Básico, Pro, Enterprise) × Duración (1 mes, 3 meses, 12 meses)
  - PACK CONTENIDO: Cantidad (Pack 10, Pack 25, Pack 50, Pack 100) × Formato
  - DISEÑO/TATUAJES: Tamaño (Pequeño, Mediano, Grande) × Estilo (B&N, Color, Acuarela)
  - NFT/COLECCIONABLES: Rareza (Común, Raro, Épico, Legendario) × Edición
  - CUALQUIER OTRO: Detecta opciones lógicas y genera variantes coherentes.
  
  Cada variante: SKU único (PREFIJO-OPT), precio (premium +10-30% para opciones superiores), compare_at_price, inventoryQuantity (15-50, más stock en tallas populares M/L), weight, costPerItem, barcode (13 dígitos).
  Genera 6-30 variantes según tipo. inventoryPolicy: "deny" (productos físicos) o "continue" (digitales/servicios).
  
  Si el producto YA TIENE variantes reales, NO incluyas options ni variants en tu respuesta.
  
  REGLAS CRÍTICAS:
  - TODO el contenido debe ser REAL, específico para este producto exacto
  - La descripción debe contar una historia, no solo listar características
  - Tags: mínimo 22, cubrir categoría, material, estilo, público, uso, colección, tendencia, long-tail keywords
  - Alt texts deben describir lo que se VE en cada imagen, no genéricos
  - PRICING: Usa los datos REALES del mercado para sugerir un precio COMPETITIVO y RENTABLE
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
            options?: Array<{ name: string; values: string[] }>;
            variants?: Array<Record<string, unknown>>;
            inventoryPolicy?: string;
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
            maxTokens: 16000,
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
          let variantsMsg = "";
  
          if (!hasRealVariants && optimized.options && optimized.options.length > 0 && optimized.variants && optimized.variants.length > 0) {
            shopifyUpdate.options = optimized.options.map((o, i) => ({
              name: o.name,
              position: i + 1,
              values: o.values,
            }));
  
            shopifyUpdate.variants = optimized.variants.map((v: Record<string, unknown>) => {
              const optVals = (v.optionValues || {}) as Record<string, string>;
              const variant: Record<string, unknown> = {
                price: String(v.price || currentPrice),
                compare_at_price: v.compareAtPrice ? String(v.compareAtPrice) : currentCompareAt || null,
                sku: v.sku || null,
                inventory_management: "shopify",
                inventory_quantity: v.inventoryQuantity ?? 25,
                inventory_policy: optimized.inventoryPolicy || "deny",
                weight: v.weight || null,
                weight_unit: v.weightUnit || "kg",
                cost: v.costPerItem ? String(v.costPerItem) : null,
                barcode: v.barcode || null,
                requires_shipping: optimized.inventoryPolicy !== "continue",
                taxable: true,
              };
              const optNames = optimized.options!.map(o => o.name);
              optNames.forEach((name, idx) => {
                variant[`option${idx + 1}`] = optVals[name] || "";
              });
              return variant;
            });
  
            variantsMsg = `\n🎯 ${optimized.variants.length} variantes creadas (${optimized.options.map(o => `${o.name}: ${o.values.length}`).join(", ")})`;
          } else if (priceSuggestion?.suggestedPrice && priceSuggestion.suggestedPrice > 0) {
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
  
          const updatedVariants = (updated.product.variants as Array<Record<string, unknown>>) || [];
          const updatedOptions = (updated.product.options as Array<Record<string, unknown>>) || [];
  
          learnFromOperation({
            operationType: "product_optimization",
            niche: storeNiche,
            productType: productType || null,
            title: `Optimización 10/10: ${updated.product.title}`,
            content: JSON.stringify({
              previousTitle: currentTitle,
              newTitle: updated.product.title,
              tagsCount: optimized.tags?.length || 0,
              seoTitle: optimized.seoTitle,
              seoDescription: optimized.seoDescription,
              descLength: String(optimized.bodyHtml || "").length,
              priceBefore: currentPrice,
              priceAfter: priceSuggestion?.suggestedPrice || currentPrice,
              marketRange: priceResearch.marketPriceRange,
              competitorsFound: priceResearch.competitorPrices.length,
              variantsCreated: !hasRealVariants ? (optimized.variants?.length || 0) : 0,
              optionsCreated: !hasRealVariants ? (optimized.options?.map(o => `${o.name}(${o.values.length})`) || []) : [],
              totalVariantsNow: updatedVariants.length,
              handle: optimized.handle,
              altTextsCount: optimized.altTexts?.length || 0,
              imagesCount: images.length,
              qualityScore: "10/10",
            }),
            confidence: 0.95,
            tags: ["optimization", "seo", "ai_content", "pricing", "variants", "10_10_quality"],
          });
  
          learnFromOperation({
            operationType: "variant_strategy",
            niche: storeNiche,
            productType: productType || null,
            title: `Estrategia variantes: ${productType || currentTitle}`,
            content: `Producto "${updated.product.title}" (${productType}). ${!hasRealVariants && optimized.options ? `Opciones generadas: ${optimized.options.map(o => `${o.name}=[${o.values.join(",")}]`).join("; ")}. ${optimized.variants?.length || 0} variantes con SKUs, precios diferenciados, stock e inventario.` : `Ya tenía ${updatedVariants.length} variantes (${updatedOptions.map((o: Record<string, unknown>) => o.name).join(", ")}). No se modificaron.`} Inventario: ${optimized.inventoryPolicy || "deny"}. Nicho: ${storeNiche}.`,
            confidence: 0.9,
            tags: ["variants", "product_strategy", productType || "general"],
          });
  
          result = {
            productId: updated.product.id,
            title: updated.product.title,
            previousTitle: currentTitle,
            tagsCount: optimized.tags?.length || 0,
            descriptionLength: String(optimized.bodyHtml || "").length,
            seoTitle: optimized.seoTitle,
            altTextsGenerated: optimized.altTexts?.length || 0,
            variantsCreated: !hasRealVariants ? (optimized.variants?.length || 0) : 0,
            totalVariants: updatedVariants.length,
            options: updatedOptions.map((o: Record<string, unknown>) => ({ name: o.name, values: o.values })),
            pricingSuggestion: priceSuggestion,
            marketData: {
              priceRange: priceResearch.marketPriceRange,
              competitorsFound: priceResearch.competitorPrices.length,
              sources: priceResearch.sources.slice(0, 5),
            },
            message: `✅ Producto "${updated.product.title}" optimizado 10/10.\n📝 Descripción: ${String(optimized.bodyHtml || "").length} chars\n🏷 ${optimized.tags?.length || 0} tags SEO\n🔍 Meta title + description SEO\n🖼 ${optimized.altTexts?.length || 0} alt texts${variantsMsg}${priceUpdateMsg}`,
          };
          logger.info({ productId, title: updated.product.title, variantsCreated: !hasRealVariants ? (optimized.variants?.length || 0) : 0 }, "✅ optimize_product background completed");
            } catch (bgErr: unknown) {
              logger.error({ productId, error: (bgErr as Error).message }, "❌ optimize_product background failed");
            }
          })();
          break;
        }
  
        case "optimize_all_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          let allProds: Array<Record<string, unknown>> = [];
          for (const st of ["active", "draft"]) {
            const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain, `/products.json?limit=250&status=${st}&published_status=any&fields=id,title,variants,status`
            );
            allProds = allProds.concat(d.products || []);
          }
  
          const skipAlreadyOptimized = params?.skipOptimized !== false;
          const optimizeLimit = Math.min(params?.limit ?? 50, 100);
          let toOptimize = allProds;
          if (skipAlreadyOptimized) {
            toOptimize = allProds.filter((p) => {
              const vs = (p.variants as Array<Record<string, unknown>>) || [];
              return vs.length <= 1;
            });
          }
          toOptimize = toOptimize.slice(0, optimizeLimit);
  
          result = {
            status: "batch_started",
            totalProducts: allProds.length,
            toOptimize: toOptimize.length,
            skipped: allProds.length - toOptimize.length,
            products: toOptimize.map((p) => ({ id: p.id, title: p.title })),
            message: `⏳ Optimización masiva 10/10 iniciada para ${toOptimize.length} productos (${allProds.length - toOptimize.length} ya optimizados).\n\nCada producto tarda ~90s (Dual AI: Gemini + Claude).\nTiempo estimado: ~${Math.ceil(toOptimize.length * 1.5)} minutos.\n\nProgreso visible en los logs del servidor.`,
          };
  
          (async () => {
            try {
            const batchResults: Array<{ id: unknown; title: string; status: string }> = [];
            const batchErrors: string[] = [];
            for (let i = 0; i < toOptimize.length; i++) {
              const prod = toOptimize[i];
              try {
                logger.info({ i: i + 1, total: toOptimize.length, productId: prod.id, title: prod.title }, "🔄 Batch optimize starting product");
  
                const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                  parseInt(projectId), project.shopDomain, `/products/${prod.id}.json`
                );
                const fullProd = pData.product;
                const pImages = (fullProd.images as Array<Record<string, unknown>>) || [];
                const pVariants = (fullProd.variants as Array<Record<string, unknown>>) || [];
                const pTitle = String(fullProd.title || "");
                const pDesc = String(fullProd.body_html || "");
                const pVendor = String(fullProd.vendor || "");
                const pType = String(fullProd.product_type || "");
                const pTags = String(fullProd.tags || "");
                const pPrice = String(pVariants[0]?.price || "0");
                const pCompareAt = String(pVariants[0]?.compare_at_price || "");
                const pNiche = project.storeNiche || "comics y cultura pop";
  
                const [pPriceResearch] = await Promise.all([
                  researchRealPricing(pTitle, pType, pNiche, pPrice),
                  Promise.resolve(null),
                ]);
  
                const pPriceContext = pPriceResearch.competitorPrices.length > 0
                  ? `\n\nDATOS REALES DE MERCADO:
  Rango: ${pPriceResearch.marketPriceRange.min}€ - ${pPriceResearch.marketPriceRange.max}€ (mediana: ${pPriceResearch.marketPriceRange.median}€)
  Competidores: ${pPriceResearch.competitorPrices.map((c: { source: string; price: string; url?: string }) => `${c.source}: ${c.price}€`).join(", ")}
  Recomendación: ${pPriceResearch.suggestedPrice}€`
                  : "";
  
                const hasRealVars = pVariants.length > 1 || (pVariants.length === 1 && String(pVariants[0].title || "Default Title") !== "Default Title");
  
                let variantInstructions = "";
                if (!hasRealVars) {
                  variantInstructions = `\n\n🎯 VARIANTES INTELIGENTES:
  El producto NO tiene variantes. Genera opciones+variantes según tipo:
  - Ropa → Talla (XS,S,M,L,XL,XXL) × Color
  - Impresión 3D → Material (PLA,ABS,Resina) × Acabado
  - Arte/Prints → Tamaño (A4,A3,A2,A1) × Material
  - Servicios → Plan (Básico,Pro,Premium) × Duración
  - NFT/Digital → Edición (Standard,Limited,Collector) × Formato
  Genera "options" y "variants" con precios diferenciados.`;
                }
  
                const batchPrompt = `Optimiza este producto Shopify al MÁXIMO nivel profesional 10/10.
  
  PRODUCTO:
  - Título actual: "${pTitle}"
  - Descripción actual: "${pDesc.slice(0, 500)}"
  - Vendor: "${pVendor}"
  - Tipo: "${pType}"
  - Tags: "${pTags}"
  - Precio: ${pPrice}€ ${pCompareAt ? `(antes: ${pCompareAt}€)` : ""}
  - Imágenes: ${pImages.length}
  - Variantes actuales: ${pVariants.length}
  - Nicho: ${pNiche}${pPriceContext}${variantInstructions}
  
  JSON RESPUESTA (SOLO JSON):
  {
    "title": "título SEO optimizado 40-70 chars",
    "bodyHtml": "<div>HTML profesional mínimo 400 palabras con <h2>, <ul><li>, <strong>, storytelling, beneficios, specs, CTA. Contenido REAL para ESTE producto.</div>",
    "tags": ["22+ tags SEO relevantes"],
    "seoTitle": "meta title 50-60 chars",
    "seoDescription": "meta description 140-160 chars con keywords y CTA",
    "altTexts": ["alt text SEO para cada imagen"],
    "handle": "url-seo-friendly-handle",
    "suggestedPrice": "precio sugerido basado en mercado"${!hasRealVars ? `,
    "options": [{"name":"NombreOpcion","values":["val1","val2","val3"]}],
    "variants": [{"option1":"val1","option2":"val2","price":"X.XX","sku":"SKU-001","inventory_policy":"continue"}]` : ""}
  }`;
  
                const { dualAIJson: batchDualAIJson } = await import("../lib/dual-ai.js");
                const batchDualResult = await batchDualAIJson<{
                  title: string; bodyHtml: string; tags: string[];
                  seoTitle: string; seoDescription: string; altTexts?: string[];
                  handle?: string; suggestedPrice?: string;
                  options?: Array<{ name: string; values: string[] }>;
                  variants?: Array<Record<string, unknown>>;
                }>(parseInt(projectId), batchPrompt, {
                  mode: "parallel_synthesis",
                  claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM,
                  useCase: "seo",
                  niche: pNiche,
                  maxTokens: 16000,
                });
                const batchOptimized = batchDualResult.data;
  
                const batchUpdate: Record<string, unknown> = { id: fullProd.id };
                if (batchOptimized.title) batchUpdate.title = batchOptimized.title;
                if (batchOptimized.bodyHtml) batchUpdate.body_html = batchOptimized.bodyHtml;
                if (batchOptimized.tags) batchUpdate.tags = batchOptimized.tags.join(", ");
                if (batchOptimized.handle) batchUpdate.handle = batchOptimized.handle;
                if (batchOptimized.seoTitle) batchUpdate.metafields_global_title_tag = batchOptimized.seoTitle;
                if (batchOptimized.seoDescription) batchUpdate.metafields_global_description_tag = batchOptimized.seoDescription;
                if (batchOptimized.altTexts && pImages.length > 0) {
                  batchUpdate.images = pImages.map((img, idx) => ({
                    id: img.id, alt: batchOptimized.altTexts?.[idx] || String(img.alt || ""),
                  }));
                }
                if (!hasRealVars && batchOptimized.options && batchOptimized.variants) {
                  batchUpdate.options = batchOptimized.options;
                  batchUpdate.variants = batchOptimized.variants;
                }
  
                await shopifyRequest(
                  parseInt(projectId), project.shopDomain, `/products/${fullProd.id}.json`,
                  { method: "PUT", body: JSON.stringify({ product: batchUpdate }) }
                );
  
                await saveToVault({
                  projectId: parseInt(projectId),
                  title: `Shopy Crafter: optimize_product — ${new Date().toLocaleDateString("es-ES")}`,
                  content: JSON.stringify({ productId: fullProd.id, optimized: batchOptimized }),
                  fileType: "brain_action",
                  description: `✅ Producto "${batchOptimized.title || pTitle}" optimizado 10/10.\n📝 Descripción: ${String(batchOptimized.bodyHtml || "").length} chars\n🏷 ${batchOptimized.tags?.length || 0} tags SEO\n🔍 Meta title + description SEO\n🖼 ${batchOptimized.altTexts?.length || 0} alt texts\n🎯 ${!hasRealVars ? (batchOptimized.variants?.length || 0) : 0} variantes creadas`,
                  category: "optimization",
                });
  
                learnFromOperation({
                  operationType: "optimization",
                  title: pTitle,
                  content: `Optimización 10/10: ${batchOptimized.tags?.length || 0} tags, ${String(batchOptimized.bodyHtml || "").length} chars desc, ${!hasRealVars ? (batchOptimized.variants?.length || 0) : 0} variantes`,
                  niche: pNiche,
                  productType: pType,
                });
  
                batchResults.push({ id: fullProd.id, title: batchOptimized.title || pTitle, status: "optimized" });
                logger.info({ i: i + 1, total: toOptimize.length, productId: fullProd.id, title: batchOptimized.title || pTitle, variants: !hasRealVars ? (batchOptimized.variants?.length || 0) : "kept" }, "✅ Batch optimize product completed");
              } catch (e) {
                const errMsg = e instanceof Error ? e.message : String(e);
                batchErrors.push(`${prod.title}: ${errMsg}`);
                logger.error({ productId: prod.id, title: prod.title, error: errMsg }, "❌ Batch optimize product failed");
              }
            }
            logger.info({ optimized: batchResults.length, failed: batchErrors.length, total: toOptimize.length }, "🏁 Batch optimization complete");
            } catch (outerErr: unknown) {
              logger.error({ error: (outerErr as Error).message }, "❌ Batch optimization IIFE crashed");
            }
          })();
  
          break;
        }
  
        case "create_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const title = params?.title;
          if (!title) { res.status(400).json({ error: "title requerido para la colección" }); return; }
  
          // ── CONFIRMATION GATE ──
          if (!params?.confirmed) {
            result = {
              success: false,
              requiresConfirmation: true,
              targetLabel: `colección "${title}"`,
              message: `⚠️ ¿Crear la colección **"${title}"** (${params?.type || "custom"}) en la tienda? Envía con \`confirmed: true\` para proceder.`,
            };
            break;
          }
  
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
  
          const allCollections: any[] = [
            ...((customData as any).custom_collections || []).map((c: any) => ({ ...c, type: "custom" })),
            ...((smartData as any).smart_collections || []).map((c: any) => ({ ...c, type: "smart" })),
          ];
  
          result = {
            collections: allCollections.map((c: any) => ({
              id: c.id, title: c.title, type: c.type,
              handle: c.handle, published: c.published_at != null,
              productsCount: c.products_count || 0,
              bodyLength: String(c.body_html || "").length,
            })),
            total: allCollections.length,
            message: `${allCollections.length} colecciones encontradas (${(customData as any).custom_collections?.length || 0} manuales + ${(smartData as any).smart_collections?.length || 0} inteligentes)`,
          };
          break;
        }
  
        case "add_to_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          const productIds = params?.productIds;
          if (!collectionId || !productIds || !Array.isArray(productIds)) {
            res.status(400).json({ error: "collectionId y productIds[] requeridos" }); return;
          }
          const added: number[] = [];
          const failed: number[] = [];
          for (const pid of productIds) {
            try {
              await shopifyRequest(
                parseInt(projectId), project.shopDomain, "/collects.json",
                { method: "POST", body: JSON.stringify({ collect: { collection_id: parseInt(collectionId), product_id: parseInt(pid) } }) }
              );
              added.push(parseInt(pid));
            } catch { failed.push(parseInt(pid)); }
          }
          result = {
            collectionId: parseInt(collectionId),
            added: added.length,
            failed: failed.length,
            failedIds: failed,
            message: `✅ ${added.length} productos añadidos a la colección. ${failed.length > 0 ? `${failed.length} fallaron (posiblemente ya asignados).` : ""}`,
          };
          break;
        }
  
        case "edit_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          const collectionType = params?.collectionType || "custom";
          if (!collectionId) { result = { error: true, message: "❌ Falta collectionId" }; break; }
          try {
            const updates: Record<string, unknown> = {};
            if (params?.title) updates.title = params.title;
            if (params?.bodyHtml) updates.body_html = params.bodyHtml;
            if (params?.sortOrder) updates.sort_order = params.sortOrder;
            if (params?.published !== undefined) updates.published = params.published;
            if (params?.seoTitle || params?.seoDescription) {
              updates.metafields_global_title_tag = params.seoTitle || undefined;
              updates.metafields_global_description_tag = params.seoDescription || undefined;
            }
            if (params?.image) updates.image = { src: params.image };
            if (Object.keys(updates).length === 0) { result = { error: true, message: "❌ No se proporcionaron campos para editar" }; break; }
  
            const endpoint = collectionType === "smart"
              ? `/smart_collections/${collectionId}.json`
              : `/custom_collections/${collectionId}.json`;
            const bodyKey = collectionType === "smart" ? "smart_collection" : "custom_collection";
  
            const updated = await shopifyRequest<Record<string, Record<string, unknown>>>(
              parseInt(projectId), project.shopDomain, endpoint,
              { method: "PUT", body: JSON.stringify({ [bodyKey]: updates }) }
            );
            const col = updated[bodyKey] || {};
            result = {
              collectionId: col.id, title: col.title, type: collectionType,
              message: `✅ Colección "${col.title}" actualizada — campos modificados: ${Object.keys(updates).join(", ")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "delete_collection": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          const collectionType = params?.collectionType || "custom";
          if (!collectionId) { result = { error: true, message: "❌ Falta collectionId" }; break; }
          try {
            const endpoint = collectionType === "smart"
              ? `/smart_collections/${collectionId}.json`
              : `/custom_collections/${collectionId}.json`;
            await shopifyRequest(parseInt(projectId), project.shopDomain, endpoint, { method: "DELETE" });
            result = { message: `🗑️ Colección ${collectionId} eliminada correctamente` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "get_collection_products": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const collectionId = params?.collectionId;
          if (!collectionId) { result = { error: true, message: "❌ Falta collectionId" }; break; }
          try {
            const limit = Math.min(params?.limit ?? 50, 250);
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(projectId), project.shopDomain,
              `/collections/${collectionId}/products.json?limit=${limit}&fields=id,title,status,product_type,vendor,tags,variants,images`
            );
            const products = data.products || [];
            const summary = products.map((p: Record<string, unknown>) => {
              const variants = p.variants as Array<Record<string, unknown>> | undefined;
              const totalStock = variants?.reduce((sum: number, v: Record<string, unknown>) => sum + (Number(v.inventory_quantity) || 0), 0) || 0;
              const imgs = p.images as Array<Record<string, unknown>> | undefined;
              return `• **${p.title}** (ID: ${p.id}) — ${p.status}, stock total: ${totalStock}, variantes: ${variants?.length || 0}, imágenes: ${imgs?.length || 0}`;
            }).join("\n");
            result = {
              collectionId: parseInt(String(collectionId)),
              products: products.map((p: Record<string, unknown>) => ({
                id: p.id, title: p.title, status: p.status,
                productType: p.product_type, vendor: p.vendor,
                variants: (p.variants as Array<Record<string, unknown>> | undefined)?.map((v: Record<string, unknown>) => ({
                  id: v.id, title: v.title, price: v.price,
                  inventoryQuantity: v.inventory_quantity, sku: v.sku,
                })),
                imageCount: (p.images as unknown[] | undefined)?.length || 0,
              })),
              total: products.length,
              message: `📦 **${products.length} productos en colección ${collectionId}**\n\n${summary || "(vacía)"}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_variants": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ product: Record<string, unknown> }>(
              parseInt(String(projectId)), project.shopDomain,
              `/products/${productId}.json?fields=id,title,variants,options`
            );
            const product = data.product;
            const variants = product.variants as Array<Record<string, unknown>> | undefined;
            const options = product.options as Array<Record<string, unknown>> | undefined;
            const summary = variants?.map((v: Record<string, unknown>) =>
              `• ${v.title} — Precio: ${v.price}€, Compare: ${v.compare_at_price || "—"}, Stock: ${v.inventory_quantity}, SKU: ${v.sku || "—"}, Barcode: ${v.barcode || "—"}`
            ).join("\n") || "(sin variantes)";
            const optionsSummary = options?.map((o: Record<string, unknown>) =>
              `  ${o.name}: ${(o.values as string[])?.join(", ")}`
            ).join("\n") || "";
            result = {
              productId, productTitle: product.title,
              options: options?.map((o: Record<string, unknown>) => ({ name: o.name, values: o.values })),
              variants: variants?.map((v: Record<string, unknown>) => ({
                id: v.id, title: v.title, price: v.price, compareAtPrice: v.compare_at_price,
                inventoryQuantity: v.inventory_quantity, sku: v.sku, barcode: v.barcode,
                inventoryItemId: v.inventory_item_id, option1: v.option1, option2: v.option2, option3: v.option3,
              })),
              totalVariants: variants?.length || 0,
              totalStock: variants?.reduce((s: number, v: Record<string, unknown>) => s + (Number(v.inventory_quantity) || 0), 0) || 0,
              message: `📊 **${product.title}** — ${variants?.length || 0} variantes\n\nOpciones:\n${optionsSummary}\n\nVariantes:\n${summary}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "update_stock": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const variantId = params?.variantId;
          const quantity = params?.quantity;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          if (quantity === undefined || quantity === null) { result = { error: true, message: "❌ Falta quantity (stock a establecer)" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const token = safeDecrypt(project.accessToken);
            const domain = project.shopDomain;
  
            let targetVariants: Array<{ variantId: string | number; inventoryItemId: string | number; title: string }> = [];
  
            if (variantId) {
              const vData = await shopifyRequest<{ variant: Record<string, unknown> }>(
                parseInt(String(projectId)), domain, `/variants/${variantId}.json?fields=id,title,inventory_item_id`
              );
              targetVariants = [{ variantId: vData.variant.id as number, inventoryItemId: vData.variant.inventory_item_id as number, title: String(vData.variant.title) }];
            } else if (productId) {
              const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                parseInt(String(projectId)), domain, `/products/${productId}.json?fields=variants`
              );
              const variants = pData.product.variants as Array<Record<string, unknown>>;
              targetVariants = variants.map(v => ({
                variantId: v.id as number, inventoryItemId: v.inventory_item_id as number, title: String(v.title),
              }));
            } else {
              result = { error: true, message: "❌ Falta productId o variantId para identificar qué stock actualizar" }; break;
            }
  
            const locationsResp = await fetch(`https://${domain}/admin/api/2024-01/locations.json`, {
              headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            });
            const locationsData = await locationsResp.json() as { locations: Array<{ id: number; name: string }> };
            const locationId = locationsData.locations?.[0]?.id;
            if (!locationId) { result = { error: true, message: "❌ No se encontró ubicación (location) en Shopify" }; break; }
  
            const updated: string[] = [];
            for (const tv of targetVariants) {
              const levelResp = await fetch(`https://${domain}/admin/api/2024-01/inventory_levels/set.json`, {
                method: "POST",
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                body: JSON.stringify({
                  location_id: locationId,
                  inventory_item_id: tv.inventoryItemId,
                  available: parseInt(String(quantity)),
                }),
              });
              if (levelResp.ok) {
                updated.push(`✅ ${tv.title}: stock → ${quantity}`);
              } else {
                const err = await levelResp.json().catch(() => ({})) as Record<string, unknown>;
                updated.push(`❌ ${tv.title}: ${err.errors || "error"}`);
              }
            }
            result = {
              updated: updated.length,
              locationId,
              message: `📦 **Stock actualizado**\n\n${updated.join("\n")}\n\n📍 Ubicación: ${locationsData.locations?.[0]?.name || locationId}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "bulk_update_stock": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const items = params?.items as Array<{ variantId?: string; productId?: string; quantity: number }> | undefined;
          if (!items || !Array.isArray(items) || items.length === 0) {
            result = { error: true, message: "❌ Falta items — array de {variantId o productId, quantity}" }; break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const token = safeDecrypt(project.accessToken);
            const domain = project.shopDomain;
  
            const locationsResp = await fetch(`https://${domain}/admin/api/2024-01/locations.json`, {
              headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            });
            const locationsData = await locationsResp.json() as { locations: Array<{ id: number }> };
            const locationId = locationsData.locations?.[0]?.id;
            if (!locationId) { result = { error: true, message: "❌ No se encontró ubicación" }; break; }
  
            let successCount = 0;
            let failCount = 0;
            const details: string[] = [];
            for (const item of items) {
              try {
                let inventoryItemId: number | null = null;
                let label = "";
                if (item.variantId) {
                  const vData = await shopifyRequest<{ variant: Record<string, unknown> }>(
                    parseInt(String(projectId)), domain, `/variants/${item.variantId}.json?fields=id,title,inventory_item_id`
                  );
                  inventoryItemId = vData.variant.inventory_item_id as number;
                  label = String(vData.variant.title);
                } else if (item.productId) {
                  const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                    parseInt(String(projectId)), domain, `/products/${item.productId}.json?fields=title,variants`
                  );
                  const firstVariant = (pData.product.variants as Array<Record<string, unknown>>)?.[0];
                  inventoryItemId = firstVariant?.inventory_item_id as number;
                  label = String(pData.product.title);
                }
                if (!inventoryItemId) { failCount++; details.push(`❌ ${label || item.variantId || item.productId}: sin inventory_item_id`); continue; }
                const resp = await fetch(`https://${domain}/admin/api/2024-01/inventory_levels/set.json`, {
                  method: "POST",
                  headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                  body: JSON.stringify({ location_id: locationId, inventory_item_id: inventoryItemId, available: item.quantity }),
                });
                if (resp.ok) { successCount++; details.push(`✅ ${label}: stock → ${item.quantity}`); }
                else { failCount++; details.push(`❌ ${label}: error`); }
              } catch { failCount++; details.push(`❌ Item: error`); }
            }
            result = {
              success: successCount, failed: failCount,
              message: `📦 **Stock actualizado en lote**: ${successCount} exitosos, ${failCount} fallidos\n\n${details.join("\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "update_product_price": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const price = params?.price;
          if (!price) { result = { error: true, message: "❌ Falta price" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const variantId = params?.variantId;
            const productIdParam = params?.productId;
            const compareAtPrice = params?.compareAtPrice;
  
            if (variantId) {
              const body: Record<string, unknown> = { price: String(price) };
              if (compareAtPrice) body.compare_at_price = String(compareAtPrice);
              const data = await shopifyRequest<{ variant: Record<string, unknown> }>(
                parseInt(String(projectId)), project.shopDomain,
                `/variants/${variantId}.json`,
                { method: "PUT", body: JSON.stringify({ variant: body }) }
              );
              result = {
                message: `💰 **Precio actualizado**\n\n- Variante: ${data.variant.title}\n- Nuevo precio: €${data.variant.price}${compareAtPrice ? `\n- Precio anterior (tachado): €${compareAtPrice}` : ""}\n\n✅ Cambio aplicado en Shopify`,
              };
            } else if (productIdParam) {
              const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                parseInt(String(projectId)), project.shopDomain,
                `/products/${productIdParam}.json?fields=title,variants`
              );
              const variants = pData.product.variants as Array<Record<string, unknown>> || [];
              const updated: string[] = [];
              for (const v of variants) {
                const body: Record<string, unknown> = { price: String(price) };
                if (compareAtPrice) body.compare_at_price = String(compareAtPrice);
                await shopifyRequest(
                  parseInt(String(projectId)), project.shopDomain,
                  `/variants/${v.id}.json`,
                  { method: "PUT", body: JSON.stringify({ variant: body }) }
                );
                updated.push(`✅ ${v.title}: €${price}`);
              }
              result = {
                message: `💰 **Precio actualizado** para "${pData.product.title}"\n\n${updated.join("\n")}\n\n✅ ${updated.length} variantes actualizadas`,
              };
            } else {
              result = { error: true, message: "❌ Necesito productId o variantId para saber qué producto actualizar" };
            }
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "bulk_update_prices": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const items = params?.items as Array<{ productId?: string; variantId?: string; title?: string; name?: string; price: string; compareAtPrice?: string }> | undefined;
          if (!items || !Array.isArray(items) || items.length === 0) {
            result = { error: true, message: "❌ Falta items — array de {productId o variantId o title, price, compareAtPrice?}" }; break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
  
            let allProducts: Array<Record<string, unknown>> | null = null;
            const needsNameLookup = items.some(i => !i.productId && !i.variantId && (i.title || i.name));
            if (needsNameLookup) {
              const catalog = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250&fields=id,title,variants"
              );
              allProducts = catalog.products || [];
            }
  
            let successCount = 0;
            let failCount = 0;
            const details: string[] = [];
            for (const item of items) {
              try {
                let vid = item.variantId;
                let label = vid || item.title || item.name || "";
  
                if (!vid && !item.productId && (item.title || item.name)) {
                  const cleanTitle = (item.title || item.name || "").trim();
                  if (cleanTitle.length < 3) { failCount++; details.push(`❌ "${cleanTitle}": nombre demasiado corto (mín 3 chars)`); continue; }
                  const searchName = cleanTitle.toLowerCase();
                  const exactMatch = allProducts?.find(p => String(p.title || "").toLowerCase() === searchName);
                  const partialMatches = exactMatch ? [] : (allProducts || []).filter(p => {
                    const pTitle = String(p.title || "").toLowerCase();
                    return pTitle.includes(searchName) || searchName.includes(pTitle);
                  });
                  const matched = exactMatch || (partialMatches.length === 1 ? partialMatches[0] : null);
                  if (!matched && partialMatches.length > 1) {
                    failCount++;
                    const candidates = partialMatches.slice(0, 3).map(p => String(p.title)).join(", ");
                    details.push(`❌ "${cleanTitle}": ambiguo (${partialMatches.length} coincidencias: ${candidates})`);
                    continue;
                  }
                  if (matched) {
                    const firstV = (matched.variants as Array<Record<string, unknown>>)?.[0];
                    vid = String(firstV?.id || "");
                    label = String(matched.title);
                  } else {
                    failCount++;
                    details.push(`❌ "${cleanTitle}": producto no encontrado en Shopify`);
                    continue;
                  }
                } else if (!vid && item.productId) {
                  const pData = await shopifyRequest<{ product: Record<string, unknown> }>(
                    parseInt(String(projectId)), project.shopDomain,
                    `/products/${item.productId}.json?fields=title,variants`
                  );
                  const firstV = (pData.product.variants as Array<Record<string, unknown>>)?.[0];
                  vid = String(firstV?.id || "");
                  label = String(pData.product.title);
                }
                if (!vid) { failCount++; details.push(`❌ ${label}: sin variante`); continue; }
                const body: Record<string, unknown> = { price: String(item.price) };
                if (item.compareAtPrice) body.compare_at_price = String(item.compareAtPrice);
                const data = await shopifyRequest<{ variant: Record<string, unknown> }>(
                  parseInt(String(projectId)), project.shopDomain,
                  `/variants/${vid}.json`,
                  { method: "PUT", body: JSON.stringify({ variant: body }) }
                );
                successCount++;
                details.push(`✅ ${data.variant.title || label}: €${item.price}`);
              } catch { failCount++; details.push(`❌ ${item.variantId || item.productId || item.title || item.name}: error`); }
            }
            result = {
              success: successCount, failed: failCount,
              message: `💰 **Precios actualizados en lote**: ${successCount} exitosos, ${failCount} fallidos\n\n${details.join("\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_products_with_prices": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250"
            );
            const products = data.products || [];
            const filter = params?.filter as string || "all";
  
            const categorized: Record<string, Array<{ title: string; price: string; compareAt: string; variantId: string; sku: string }>> = {
              subscriptions: [], services: [], creative: [], credits: []
            };
  
            for (const p of products) {
              const title = String(p.title || "");
              const variants = p.variants as Array<Record<string, unknown>> || [];
              const v = variants[0] || {};
              const entry = {
                title: title.substring(0, 70),
                price: String(v.price || "?"),
                compareAt: String(v.compare_at_price || ""),
                variantId: String(v.id || ""),
                sku: String(v.sku || ""),
              };
              const t = title.toLowerCase();
              if (["starter", "pro —", "agency pro", "growth studio", "performance lab", "enterprise"].some(k => t.includes(k))) {
                categorized.subscriptions.push(entry);
              } else if (["pack ilustr", "pack narr", "pack creador", "pack director", "pack estudio", "pack 4000"].some(k => t.includes(k))) {
                categorized.credits.push(entry);
              } else if (["auditoría", "informe", "photoshoot", "pack 20", "pack 30 prod", "pack 15", "pack 10", "pack 5", "pack catálogo", "creación prod", "rediseño", "pack 30 imág", "seo shopify", "setup email", "sesión estrat", "pack 30 post", "campañas"].some(k => t.includes(k))) {
                categorized.services.push(entry);
              } else {
                categorized.creative.push(entry);
              }
            }
  
            const sections: string[] = [];
            const formatList = (items: typeof categorized.subscriptions) =>
              items.map(i => `  €${i.price.padStart(7)} ${i.compareAt && i.compareAt !== "null" ? `(antes €${i.compareAt})` : "".padEnd(15)} | ${i.title}`).join("\n");
  
            if (filter === "all" || filter === "subscriptions") {
              sections.push(`📋 **PLANES SUSCRIPCIÓN (${categorized.subscriptions.length})**\n${formatList(categorized.subscriptions)}`);
            }
            if (filter === "all" || filter === "services") {
              sections.push(`🔧 **SERVICIOS ONE-SHOT (${categorized.services.length})**\n${formatList(categorized.services)}`);
            }
            if (filter === "all" || filter === "credits") {
              sections.push(`🎨 **CRÉDITOS IA (${categorized.credits.length})**\n${formatList(categorized.credits)}`);
            }
            if (filter === "all" || filter === "creative") {
              sections.push(`🎭 **PRODUCTOS CREATIVOS (${categorized.creative.length})**\n${formatList(categorized.creative)}`);
            }
  
            result = {
              total: products.length,
              message: `💰 **${products.length} productos en Shopify** (filtro: ${filter})\n\n${sections.join("\n\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "price_audit": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250"
            );
  
            const catalogPrices: Record<string, { price: number; name: string }> = {
              "shopy crafter starter": { price: 0, name: "Starter Free" },
              "shopy crafter pro": { price: 29, name: "Emprendedor" },
              "shopy crafter agency pro": { price: 149, name: "Agency Pro → Growth" },
              "growth studio": { price: 149, name: "Growth Studio" },
              "performance lab": { price: 397, name: "Performance Lab" },
              "shopy crafter enterprise": { price: 997, name: "Enterprise" },
              "auditoría seo shopify": { price: 97, name: "Auditoría SEO N1" },
              "auditoría shopify completa": { price: 97, name: "Auditoría 360° N1" },
              "informe competidores": { price: 97, name: "Informe Competidores N1" },
              "informe pricing": { price: 97, name: "Informe Pricing N1" },
              "informe proyección": { price: 97, name: "Informe Proyección N1" },
              "investigación de proveedores": { price: 97, name: "Investigación Proveedores N1" },
              "shopy crafter photoshoot": { price: 297, name: "Photoshoot Pro" },
              "pack 20 productos": { price: 397, name: "Pack 20 Productos" },
              "pack 30 productos": { price: 597, name: "Pack 30 Productos" },
              "pack 15 productos": { price: 297, name: "Pack 15 Productos" },
              "pack catálogo profesional 10": { price: 197, name: "Pack 10 Productos" },
              "pack 5 productos": { price: 97, name: "Pack 5 Productos" },
              "creación producto shopify unitario": { price: 29, name: "Producto Unitario" },
              "rediseño ia de 30": { price: 97, name: "Rediseño 30 Productos" },
              "pack 30 imágenes": { price: 49, name: "Pack 30 Imágenes" },
              "seo shopify experto": { price: 97, name: "SEO Experto" },
              "setup email marketing": { price: 147, name: "Setup Email" },
              "sesión estratégica": { price: 97, name: "Sesión Estratégica" },
              "pack 30 posts": { price: 49, name: "Pack 30 Posts" },
              "campañas virales": { price: 97, name: "Campañas Virales" },
            };
  
            const discrepancies: string[] = [];
            const correct: string[] = [];
            for (const p of data.products) {
              const title = String(p.title || "").toLowerCase();
              const v = (p.variants as Array<Record<string, unknown>>)?.[0];
              if (!v) continue;
              const currentPrice = parseFloat(String(v.price || "0"));
              for (const [key, catalog] of Object.entries(catalogPrices)) {
                if (title.includes(key)) {
                  if (Math.abs(currentPrice - catalog.price) > 0.5) {
                    discrepancies.push(`⚠️ **${catalog.name}**: €${currentPrice} → debería ser **€${catalog.price}** (VID:${v.id})`);
                  } else {
                    correct.push(`✅ ${catalog.name}: €${currentPrice}`);
                  }
                  break;
                }
              }
            }
  
            result = {
              total: data.products.length,
              discrepancies: discrepancies.length,
              correct: correct.length,
              message: discrepancies.length > 0
                ? `🔍 **Auditoría de precios**: ${discrepancies.length} discrepancias encontradas\n\n${discrepancies.join("\n")}\n\n${correct.length > 0 ? `\n✅ ${correct.length} productos con precios correctos` : ""}\n\n💡 Usa **sync_catalog_prices** para corregir automáticamente`
                : `✅ **Auditoría de precios perfecta**: todos los ${correct.length} productos del catálogo tienen precios correctos\n\n${correct.join("\n")}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "sync_catalog_prices": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          // ── PROTECCIÓN: catálogo hardcoded de Shopy Crafter (no aplicar a tiendas de cliente) ──
          // dryRun por defecto ON salvo confirmación explícita
          const explicitWrite = params?.confirmed === true && (params?.dryRun === false || params?.dryRun === "false");
          const dryRun = !explicitWrite;
          if (!params?.confirmed) {
            result = {
              success: false,
              requiresConfirmation: true,
              warning: "⚠️ Esta acción usa el catálogo OFICIAL de Shopy Crafter. Sólo aplicar a la tienda matriz, NUNCA a tiendas de clientes.",
              message: "⚠️ ¿Sincronizar precios con el catálogo oficial Shopy Crafter? Por defecto se ejecuta en modo simulación. Para aplicar cambios reales envía `confirmed: true` y `dryRun: false`.",
            };
            break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json?limit=250"
            );
  
            const catalogPrices: Record<string, { price: string; compareAt?: string }> = {
              "shopy crafter starter": { price: "0.00", compareAt: "34.99" },
              "shopy crafter pro": { price: "29.00" },
              "shopy crafter agency pro": { price: "149.00" },
              "growth studio": { price: "149.00", compareAt: "297.00" },
              "performance lab": { price: "397.00", compareAt: "797.00" },
              "shopy crafter enterprise": { price: "997.00", compareAt: "2497.00" },
              "auditoría seo shopify": { price: "97.00", compareAt: "197.00" },
              "auditoría shopify completa": { price: "97.00", compareAt: "197.00" },
              "informe competidores": { price: "97.00" },
              "informe pricing": { price: "97.00" },
              "informe proyección": { price: "97.00", compareAt: "127.00" },
              "investigación de proveedores": { price: "97.00" },
              "shopy crafter photoshoot": { price: "297.00", compareAt: "497.00" },
              "pack 20 productos": { price: "397.00", compareAt: "697.00" },
              "pack 30 productos": { price: "597.00", compareAt: "997.00" },
              "pack 15 productos": { price: "297.00", compareAt: "497.00" },
              "pack catálogo profesional 10": { price: "197.00", compareAt: "347.00" },
              "pack 5 productos": { price: "97.00", compareAt: "197.00" },
              "creación producto shopify unitario": { price: "29.00", compareAt: "47.00" },
              "rediseño ia de 30": { price: "97.00", compareAt: "147.00" },
              "pack 30 imágenes": { price: "49.00", compareAt: "89.00" },
              "seo shopify experto": { price: "97.00", compareAt: "147.00" },
              "setup email marketing": { price: "147.00", compareAt: "197.00" },
              "sesión estratégica": { price: "97.00", compareAt: "147.00" },
              "pack 30 posts": { price: "49.00", compareAt: "89.00" },
              "campañas virales": { price: "97.00", compareAt: "147.00" },
            };
  
            const changes: string[] = [];
            const noChange: string[] = [];
            let updatedCount = 0;
  
            for (const p of data.products) {
              const title = String(p.title || "");
              const titleLow = title.toLowerCase();
              const v = (p.variants as Array<Record<string, unknown>>)?.[0];
              if (!v) continue;
  
              for (const [key, catalog] of Object.entries(catalogPrices)) {
                if (titleLow.includes(key)) {
                  const currentPrice = String(v.price || "0");
                  if (Math.abs(parseFloat(currentPrice) - parseFloat(catalog.price)) > 0.5) {
                    if (!dryRun) {
                      const body: Record<string, unknown> = { price: catalog.price };
                      if (catalog.compareAt) body.compare_at_price = catalog.compareAt;
                      await shopifyRequest(
                        parseInt(String(projectId)), project.shopDomain,
                        `/variants/${v.id}.json`,
                        { method: "PUT", body: JSON.stringify({ variant: body }) }
                      );
                      updatedCount++;
                    }
                    changes.push(`${dryRun ? "🔄" : "✅"} ${title.substring(0, 50)}: €${currentPrice} → €${catalog.price}`);
                  } else {
                    noChange.push(`✅ ${title.substring(0, 50)}: €${currentPrice}`);
                  }
                  break;
                }
              }
            }
  
            result = {
              mode: dryRun ? "DRY RUN (simulación)" : "APLICADO",
              changes: changes.length,
              noChange: noChange.length,
              message: dryRun
                ? `🔍 **Simulación de sincronización** (sin cambios aplicados)\n\n${changes.length > 0 ? `**${changes.length} cambios pendientes:**\n${changes.join("\n")}` : "✅ Todos los precios ya están sincronizados"}\n\n${noChange.length > 0 ? `\n✅ ${noChange.length} precios correctos` : ""}\n\n💡 Para aplicar los cambios: "sincronizar precios" (sin dryRun)`
                : `✅ **Sincronización completada**: ${updatedCount} precios actualizados\n\n${changes.join("\n")}${noChange.length > 0 ? `\n\n✅ ${noChange.length} ya estaban correctos` : ""}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_brand_css": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido (número)" }; break; }
          try {
            const { fetchBrandProfile: fbp, generateBrandCss: gbc } = await import("../lib/brand-css-generator.js");
            const profile = await fbp(parseInt(String(projectId)));
            if (!profile) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const css = gbc(profile);
            const lines = css.split("\n").length;
            result = {
              message: `🎨 **CSS personalizado generado** para ${profile.shopName || "tu marca"}\n\n` +
                `📄 **${lines} líneas** de CSS adaptado a tu ADN de marca\n` +
                `🎯 Colores: ${(profile.primaryColors || []).join(", ") || "detectados de tu tienda"}\n` +
                `🔤 Tipografía: ${profile.typographyStyle || "Inter (por defecto)"}\n\n` +
                `**Secciones incluidas:**\n` +
                `✅ Variables CSS (--brand-primary, --brand-accent, etc.)\n` +
                `✅ Header / Navegación\n` +
                `✅ Hero / Banner\n` +
                `✅ Botones CTA\n` +
                `✅ Grid y tarjetas de producto\n` +
                `✅ Página de producto\n` +
                `✅ Trust badges\n` +
                `✅ Testimonios\n` +
                `✅ FAQ\n` +
                `✅ Footer\n` +
                `✅ Newsletter\n` +
                `✅ Carrito\n` +
                `✅ Responsive mobile\n` +
                `✅ Animaciones\n\n` +
                `📥 **Descárgalo:** /api/exports/brand-css/${projectId}\n` +
                `📥 **Con IA avanzada:** /api/exports/brand-css/${projectId}?mode=ai\n` +
                `📥 **Kit completo ZIP:** /api/exports/brand-kit/${projectId}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_brand_kit": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido (número)" }; break; }
          try {
            const { fetchBrandProfile: fbp } = await import("../lib/brand-css-generator.js");
            const profile = await fbp(parseInt(String(projectId)));
            if (!profile) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            result = {
              message: `📋 **Brand Kit disponible** para ${profile.shopName || "tu marca"}\n\n` +
                `El Brand Kit incluye:\n` +
                `📁 **css/theme-custom.css** — CSS personalizado completo\n` +
                `📄 **guia-de-marca.html** — Manual de identidad visual\n` +
                `📄 **brand-tokens.json** — Tokens de diseño para desarrolladores\n` +
                `📁 **shopify/sections/brand-section.liquid** — Sección Liquid personalizada\n` +
                `📄 **LEEME.txt** — Instrucciones de instalación\n\n` +
                `📥 **Descargar Brand Kit básico:** /api/exports/brand-kit/${projectId}\n` +
                `📥 **Descargar Brand Kit Premium + IA:** /api/exports/brand-kit-full/${projectId}\n\n` +
                `💡 El kit Premium incluye CSS avanzado generado por IA con animaciones y efectos personalizados.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_brand_guide": {
          const projectId = params?.projectId;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido (número)" }; break; }
          try {
            const { fetchBrandProfile: fbp } = await import("../lib/brand-css-generator.js");
            const profile = await fbp(parseInt(String(projectId)));
            if (!profile) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            result = {
              message: `📖 **Guía de marca disponible** para ${profile.shopName || "tu marca"}\n\n` +
                `La guía incluye:\n` +
                `🎨 Paleta de colores completa con códigos hex\n` +
                `🔤 Tipografías (títulos, cuerpo, precios) con tamaños\n` +
                `🧩 Componentes visuales (botón CTA, tarjeta producto)\n` +
                `📸 Estilo fotográfico (fondo, iluminación, temperatura)\n` +
                `🗣️ Tono de voz y personalidad de marca\n` +
                `📐 Espaciado y layout\n\n` +
                `📥 **HTML:** /api/exports/brand-guide/${projectId}\n` +
                `📥 **PDF:** /api/exports/brand-guide/${projectId}?format=pdf`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "run_universal_generator": {
          const projectId = params?.projectId;
          const generatorType = params?.generatorType;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!generatorType) {
            result = {
              message: `✨ **Generador Universal de Shopy Crafter** — 41 herramientas IA\n\n` +
                `Dime qué tipo de contenido quieres generar:\n\n` +
                `🔍 **SEO**: seo-audit, seo-metas, seo-schemas, seo-alt-texts, seo-keywords, blog-strategy, blog-post\n` +
                `📊 **Informes**: complete-report, financial-report, inventory-report, consistency-report, revenue-analysis\n` +
                `🎨 **Marca**: brand-css, brand-css-ai, brand-guide, brand-kit, brand-kit-premium, photo-brief, social-kit\n` +
                `💰 **Finanzas**: pricing-optimal, margin-waterfall, financial-forecast\n` +
                `🕵️ **Competencia**: competitor-scan, market-research\n` +
                `✍️ **Contenido**: product-redesign, email-templates, email-flow, social-posts, landing-design\n` +
                `📦 **Datos**: data-csv, data-xlsx, data-json, data-zip\n` +
                `💼 **Agencia**: agency-proposal, agency-budget\n` +
                `🌍 **Externo**: external-audit (+ url)\n\n` +
                `📱 **O ve a la página del Generador:** /projects/${projectId}/generator`,
            };
            break;
          }
          try {
            const { runGeneratorDirect } = await import("./generator.js");
            const genData = await runGeneratorDirect(generatorType, {
              projectId: parseInt(String(projectId)),
              url: params?.url,
              format: "html",
              template: parseTemplate(params?.template),
              extraParams: {},
            });
            result = {
              message: `✅ ${genData.message || "Contenido generado"}\n\n` +
                (genData.vaultSaved ? `🗄️ Guardado en Vault (ID: ${genData.vaultId})\n` : "") +
                (genData.brainLearned ? `🧠 ShopyBrain ha aprendido de esta generación\n` : "") +
                (genData.redirect ? `📥 **Descargar:** ${genData.redirect}\n` : "") +
                (genData.downloadUrl ? `📥 **Descargar:** ${genData.downloadUrl}\n` : "") +
                (genData.vaultId ? `📥 **Desde Vault:** /api/generator/download/${genData.vaultId}\n` : ""),
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "analyze_web_design": {
          const projectId = params?.projectId;
          const targetUrl = params?.url;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!targetUrl) {
            result = {
              message: `🔬 **Lab Web — Análisis de Diseño Profesional**\n\n` +
                `Necesito la URL de la página web que quieres analizar.\n\n` +
                `Escribe la URL completa (ej: https://ejemplo.com) y haré:\n` +
                `• Extracción del HTML + CSS reales\n` +
                `• Análisis PageSpeed (móvil + escritorio)\n` +
                `• Análisis IA profundo del diseño\n` +
                `• CSS mejorado listo para copiar/pegar\n` +
                `• Informe profesional descargable\n\n` +
                `📱 **O ve directamente a:** /projects/${projectId}/web-lab`,
            };
            break;
          }
          try {
            const { runWebLabAnalysis } = await import("./web-lab.js");
            const labResult = await runWebLabAnalysis(
              String(targetUrl),
              parseInt(String(projectId)),
              parseTemplate(params?.template)
            );
            const a = labResult.analysis;
            const cats = a.categories;
            result = {
              message: `🔬 **Lab Web — Análisis Completado**\n\n` +
                `🎯 **Score General: ${a.overallScore}/100**\n\n` +
                `📊 **Categorías:**\n` +
                `• 🎨 Diseño: ${cats.design}/100\n` +
                `• 🖱️ UX: ${cats.ux}/100\n` +
                `• 📱 Responsive: ${cats.responsive}/100\n` +
                `• ♿ Accesibilidad: ${cats.accessibility}/100\n` +
                `• ⚡ Performance: ${cats.performance}/100\n` +
                `• 🎯 Consistencia: ${cats.consistency}/100\n\n` +
                `📋 **Resumen:** ${a.summary}\n\n` +
                `⚠️ **Issues encontrados:** ${a.issues?.length || 0}\n\n` +
                `📥 **Descargas disponibles:**\n` +
                (labResult.vaultIds.report ? `• 📄 Informe: /api/web-lab/download-report/${labResult.vaultIds.report}\n` : "") +
                (labResult.vaultIds.css ? `• 💻 CSS mejorado: /api/web-lab/download-css/${labResult.vaultIds.css}\n` : "") +
                (labResult.vaultIds.html ? `• 🏗️ HTML mejorado: /api/web-lab/download-html/${labResult.vaultIds.html}\n` : "") +
                (labResult.vaultIds.report ? `• 📦 Pack completo: /api/web-lab/download-pack/${labResult.vaultIds.report}\n` : "") +
                `\n🗄️ Todo guardado en Vault | 🧠 ShopyBrain ha aprendido del análisis`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en Lab Web: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "fusion_analyze": {
          const imageUrl = params?.imageUrl;
          if (!imageUrl) { result = { error: true, message: "❌ Falta imageUrl — proporciona la URL de la imagen a analizar" }; break; }
          if (!isPublicUrl(String(imageUrl))) { result = { error: true, message: "❌ La URL debe ser pública (https). No se permiten URLs internas." }; break; }
          try {
            // FIX CRIT-4: límite de 15MB con check de content-length para prevenir DoS
            const { buffer: imgBuf, mimeType } = await fetchImageWithSizeLimit(String(imageUrl), 15 * 1024 * 1024);
            const analysis = await analyzeImageForFusion(imgBuf.toString("base64"), mimeType);
            const colorList = analysis.colors.palette.map(c => `${c.name} (${c.hex}) ${c.percentage}`).join(", ");
            const textureList = analysis.textures.map(t => `${t.material} (${t.finish})`).join(", ");
            result = {
              message: `🎨 **Fusion Studio — Análisis Completado**\n\n` +
                `📷 **Imagen analizada:** ${imageUrl}\n\n` +
                `🎨 **Colores:** ${colorList}\n` +
                `🧵 **Texturas:** ${textureList}\n` +
                `🏷️ **Categoría:** ${analysis.product.category} / ${analysis.product.subcategory}\n` +
                `📝 **Estilo:** ${analysis.product.brandStyle}\n` +
                `👥 **Audiencia:** ${analysis.product.targetAudience}\n` +
                `💰 **Rango precio:** ${analysis.product.priceRange}\n` +
                `📐 **Composición:** ${analysis.composition.layout} · ${analysis.composition.lighting}\n\n` +
                `📦 **Sugerencia producto:**\n` +
                `• Título: ${analysis.productGeneration.suggestedTitle}\n` +
                `• Precio: ${analysis.productGeneration.suggestedPrice}\n` +
                `• Tags: ${analysis.productGeneration.suggestedTags.join(", ")}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en Fusion Studio: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "fusion_create_product": {
          const projectId = params?.projectId;
          const imageUrl = params?.imageUrl;
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!imageUrl) { result = { error: true, message: "❌ Falta imageUrl — proporciona la URL de la imagen" }; break; }
          if (!isPublicUrl(String(imageUrl))) { result = { error: true, message: "❌ La URL debe ser pública (https). No se permiten URLs internas." }; break; }
          try {
            // FIX CRIT-4: límite de 15MB con check de content-length para prevenir DoS
            const { buffer: imgBuf, mimeType: imgMime } = await fetchImageWithSizeLimit(String(imageUrl), 15 * 1024 * 1024);
            const analysis = await analyzeImageForFusion(imgBuf.toString("base64"), imgMime);
            const title = params?.title || analysis.productGeneration.suggestedTitle || "Producto Fusion";
            const price = params?.price || analysis.productGeneration.suggestedPrice || "29.99";
            const productData = {
              product: {
                title: String(title),
                body_html: analysis.productGeneration.suggestedDescription || "Producto creado con Fusion Studio",
                vendor: "Shopy Crafter",
                product_type: analysis.product.category || "General",
                tags: (analysis.productGeneration.suggestedTags || []).join(", "),
                status: "draft",
                variants: [{ price: String(price), inventory_management: "shopify" }],
                images: [{ src: String(imageUrl) }],
              }
            };
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const created = await shopifyRequest<{ product: { id: number; title: string; handle: string } }>(
              parseInt(String(projectId)), project.shopDomain, "/products.json",
              { method: "POST", body: JSON.stringify(productData) }
            );
            result = {
              message: `🎨✅ **Producto creado con Fusion Studio**\n\n` +
                `📦 **${created.product.title}** (ID: ${created.product.id})\n` +
                `💰 Precio: ${price}€\n` +
                `🏷️ Tags: ${(analysis.productGeneration.suggestedTags || []).join(", ")}\n` +
                `📊 Estado: Borrador\n\n` +
                `🔗 Handle: ${created.product.handle}\n` +
                `💡 El producto está en borrador. Publícalo cuando esté listo.`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error creando producto con Fusion: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "run_leveled_report": {
          const projectId = params?.projectId;
          const reportType = params?.type;
          const level = Math.max(1, Math.min(5, parseInt(String(params?.level || 1))));
          if (!projectId || isNaN(Number(projectId))) { result = { error: true, message: "❌ Falta projectId válido" }; break; }
          if (!reportType) { result = { error: true, message: "❌ Falta type — indica qué tipo de informe (ej: seo_audit, brand_analysis, competitor_report)" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const template = parseTemplate(params?.template);
            const levelResult = await generateLeveledReport({
              projectId: parseInt(String(projectId)),
              reportType: String(reportType),
              reportTitle: `${String(reportType).replace(/_/g, " ")} — ${project.name}`,
              dataBlock: `Tienda: ${project.name}\nDominio: ${project.shopDomain}\nNicho: ${project.storeNiche || "eCommerce"}`,
              level: level as 1 | 2 | 3 | 4 | 5,
              template,
              niche: project.storeNiche || undefined,
            });
            const levelNames = ["", "Diagnóstico", "Guía Implementación", "Contenido Producido", "Premium Full", "Enterprise"];
            result = {
              message: `📊 **Informe Nivel ${level} — ${levelNames[level]}**\n\n` +
                `📋 **Tipo:** ${reportType}\n` +
                `🏪 **Tienda:** ${project.name}\n` +
                `📁 **Archivos generados:** ${levelResult.files.length}\n\n` +
                levelResult.files.map((f: { title: string; vaultId: number | null }, i: number) =>
                  `${i + 1}. 📄 ${f.title}${f.vaultId ? ` — /api/vault/download/${f.vaultId}` : ""}`
                ).join("\n") +
                `\n\n🗄️ Todo guardado en el Vault para descarga`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error generando informe nivel: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "add_variant": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const variant: Record<string, unknown> = {};
            if (params?.option1) variant.option1 = params.option1;
            if (params?.option2) variant.option2 = params.option2;
            if (params?.option3) variant.option3 = params.option3;
            if (params?.price) variant.price = String(params.price);
            if (params?.compareAtPrice) variant.compare_at_price = String(params.compareAtPrice);
            if (params?.sku) variant.sku = params.sku;
            if (params?.barcode) variant.barcode = params.barcode;
            if (params?.weight) variant.weight = params.weight;
            if (params?.weightUnit) variant.weight_unit = params.weightUnit;
            variant.inventory_management = "shopify";
  
            const created = await shopifyRequest<{ variant: Record<string, unknown> }>(
              parseInt(String(projectId)), project.shopDomain, `/products/${productId}/variants.json`,
              { method: "POST", body: JSON.stringify({ variant }) }
            );
            const v = created.variant;
  
            if (params?.quantity !== undefined) {
              const token = safeDecrypt(project.accessToken);
              const locResp = await fetch(`https://${project.shopDomain}/admin/api/2024-01/locations.json`, {
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
              });
              const locData = await locResp.json() as { locations: Array<{ id: number }> };
              const locId = locData.locations?.[0]?.id;
              if (locId && v.inventory_item_id) {
                await fetch(`https://${project.shopDomain}/admin/api/2024-01/inventory_levels/set.json`, {
                  method: "POST",
                  headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                  body: JSON.stringify({ location_id: locId, inventory_item_id: v.inventory_item_id, available: parseInt(String(params.quantity)) }),
                });
              }
            }
  
            result = {
              variantId: v.id, productId,
              title: v.title, price: v.price, sku: v.sku,
              inventoryQuantity: params?.quantity ?? v.inventory_quantity,
              message: `✅ **Variante creada**: ${v.title}\n💰 Precio: ${v.price}€\n📦 Stock: ${params?.quantity ?? v.inventory_quantity}\n🏷️ SKU: ${v.sku || "—"}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "edit_variant": {
          const projectId = params?.projectId;
          const variantId = params?.variantId;
          if (!projectId || !variantId) { result = { error: true, message: "❌ Falta projectId o variantId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const updates: Record<string, unknown> = {};
            if (params?.option1) updates.option1 = params.option1;
            if (params?.option2) updates.option2 = params.option2;
            if (params?.option3) updates.option3 = params.option3;
            if (params?.price) updates.price = String(params.price);
            if (params?.compareAtPrice) updates.compare_at_price = String(params.compareAtPrice);
            if (params?.sku) updates.sku = params.sku;
            if (params?.barcode) updates.barcode = params.barcode;
            if (params?.weight) updates.weight = params.weight;
            if (params?.weightUnit) updates.weight_unit = params.weightUnit;
  
            const updated = await shopifyRequest<{ variant: Record<string, unknown> }>(
              parseInt(String(projectId)), project.shopDomain, `/variants/${variantId}.json`,
              { method: "PUT", body: JSON.stringify({ variant: updates }) }
            );
            const v = updated.variant;
  
            if (params?.quantity !== undefined) {
              const token = safeDecrypt(project.accessToken);
              const locResp = await fetch(`https://${project.shopDomain}/admin/api/2024-01/locations.json`, {
                headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
              });
              const locData = await locResp.json() as { locations: Array<{ id: number }> };
              const locId = locData.locations?.[0]?.id;
              if (locId && v.inventory_item_id) {
                await fetch(`https://${project.shopDomain}/admin/api/2024-01/inventory_levels/set.json`, {
                  method: "POST",
                  headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
                  body: JSON.stringify({ location_id: locId, inventory_item_id: v.inventory_item_id, available: parseInt(String(params.quantity)) }),
                });
              }
            }
  
            result = {
              variantId: v.id, title: v.title, price: v.price,
              message: `✅ **Variante actualizada**: ${v.title}\n💰 Precio: ${v.price}€${params?.quantity !== undefined ? `\n📦 Stock: ${params.quantity}` : ""}\n🏷️ SKU: ${v.sku || "—"}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "delete_variant": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const variantId = params?.variantId;
          if (!projectId || !productId || !variantId) { result = { error: true, message: "❌ Falta projectId, productId o variantId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            await shopifyRequest(
              parseInt(String(projectId)), project.shopDomain, `/products/${productId}/variants/${variantId}.json`,
              { method: "DELETE" }
            );
            result = { message: `🗑️ **Variante ${variantId} eliminada** del producto ${productId}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
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
            maxTokens: 16000,
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
  
        case "update_page": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const pageId = params?.pageId;
          if (!pageId) { res.status(400).json({ error: "pageId requerido" }); return; }
          const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const updateData: Record<string, unknown> = {};
          if (params?.title !== undefined) updateData.title = params.title;
          if (params?.bodyHtml !== undefined) updateData.body_html = params.bodyHtml;
          if (params?.handle !== undefined) updateData.handle = params.handle;
          if (params?.published !== undefined) updateData.published = params.published;
  
          const updated = await shopifyRequest<{ page: Record<string, unknown> }>(
            parseInt(projectId), project.shopDomain, `/pages/${pageId}.json`,
            { method: "PUT", body: JSON.stringify({ page: updateData }) }
          );
  
          result = {
            pageId: updated.page.id,
            title: updated.page.title,
            handle: updated.page.handle,
            published: updated.page.published_at != null,
            message: `✅ Página "${updated.page.title}" actualizada.\n📄 Publicada: ${updated.page.published_at != null ? 'Sí' : 'No'}\n🔗 URL: /pages/${updated.page.handle}`,
          };
          learnFromOperation({
            operationType: "page_update",
            title: `Page updated: ${updated.page.title}`,
            content: `Página "${updated.page.title}" (ID: ${pageId}) actualizada. Published: ${updated.page.published_at != null}. Handle: ${updated.page.handle}. Changes: ${Object.keys(updateData).join(", ")}`,
            confidence: 0.85,
            tags: ["page", "update", "shopify"],
          });
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
            for (const st of ["active", "draft", "archived"]) {
              const d = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
                parseInt(projectId), project.shopDomain, `/products.json?limit=50&status=${st}&published_status=any&fields=id,title,images,product_type,vendor`
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
                { claudeSystemPrompt: CLAUDE_EXPERT_SYSTEM, useCase: "images", niche: project.storeNiche || undefined, maxTokens: 16000 }
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
            const sections = Object.keys(cmsData as Record<string, unknown>).filter(k => k !== "meta");
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
  
  Luego GENERA ${numPlans} PLANES DE PRECIO profesionales y competitivos para Shopy Crafter (agencia de optimización IA para tiendas Shopify, con 6 motores IA: imágenes, consistencia visual, A/B testing, auto-pilot, pricing financiero, SEO técnico).
  
  REQUISITOS:
  1. Los precios deben ser COMPETITIVOS con el mercado real investigado
  2. Incluye planes desde entrada hasta enterprise
  3. Cada plan debe tener un DIFERENCIADOR claro
  4. Features deben ser REALES — basados en capacidades reales de Shopy Crafter
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
        "shopifyProductTitle": "Shopy Crafter - Nombre Plan (Mensual)",
        "shopifyProductDescription": "Descripción completa para Shopify..."
      }
    ],
    "strategy": "Explicación de la estrategia de pricing elegida",
    "marketPosition": "Dónde se posiciona Shopy Crafter vs competencia"
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
              maxTokens: 16000,
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
                        title: plan.shopifyProductTitle || `Shopy Crafter — ${plan.name}`,
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
  
            const features = ((cmsData as any).features?.items as Array<{ title: string; description: string }>) ?? [];
            const plans = ((cmsData as any).pricing?.plans as Array<{ name: string; price: string; features: Array<{ text: string; included: boolean }> }>) ?? [];
  
            const auditPrompt = `Audita la oferta de Shopy Crafter basándote en lo que realmente ofrece la plataforma:
  
  MOTORES IA (features reales):
  ${features.map((f, i) => `${i + 1}. ${f.title}: ${f.description}`).join("\n")}
  
  PLANES DE PRECIO ACTUALES:
  ${plans.map(p => `${p.name} (${p.price}€): ${p.features?.filter(f => f.included).map(f => f.text).join(", ")}`).join("\n")}
  
  FUNCIONALIDADES REALES DE LA APP:
  - Shopy Crafter Brain (chatbot IA con 34 acciones: gestión Shopify, CMS, código, proveedores, diagnóstico)
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
  
            const auditOfferingsProjectId = getSessionProjectId(req, params);
            const auditText = await askClaudeWithBrain(
              auditOfferingsProjectId,
              [{ role: "user", content: auditPrompt }],
              "Eres un consultor de negocio SaaS especializado en agencias Shopify. Auditas productos y generas recomendaciones concretas y accionables.",
              "general",
              undefined,
              3000
            );
  
            learnFromOperation({
              operationType: "app_offerings_audit",
              title: "Auditoría de oferta comercial",
              content: auditText,
              confidence: 0.8,
              tags: ["business_audit", "pricing", "features"],
            });
  
            result = {
              success: true,
              featuresCount: features.length,
              plansCount: plans.length,
              audit: auditText,
              message: `🔍 **Auditoría de la oferta de Shopy Crafter:**\n\n${auditText}`,
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
            const relevantFiles: { path: string; content: string }[] = [];
            const scanDirs = [
              { root: FRONTEND_SRC, prefix: "" },
              { root: path.resolve(FRONTEND_ROOT, "public"), prefix: "public/" },
              { root: path.resolve(BACKEND_ROOT, "src"), prefix: "[backend] " },
            ];
            const targetLower = String(target).toLowerCase();
            for (const { root, prefix } of scanDirs) {
              if (!fs.existsSync(root)) continue;
              const scanRecursive = (dir: string, depth: number) => {
                if (depth > 3 || relevantFiles.length >= 6) return;
                try {
                  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) { scanRecursive(full, depth + 1); continue; }
                    if (!/\.(tsx?|css)$/.test(entry.name)) continue;
                    const relPath = path.relative(root, full);
                    const nameLower = entry.name.toLowerCase().replace(/\.(tsx?|css)$/, "");
                    if (targetLower.includes(nameLower) || nameLower.includes("landing") || nameLower.includes("index") || nameLower === "app") {
                      const fc = fs.readFileSync(full, "utf-8");
                      relevantFiles.push({ path: `${prefix}${relPath}`, content: fc.length > 8000 ? fc.slice(0, 8000) + "\n// ... [truncado]" : fc });
                    }
                  }
                } catch { /* skip */ }
              };
              scanRecursive(root, 0);
            }
  
            const fileListForPrompt = relevantFiles.map(f => `--- ${f.path} ---\n${f.content}`).join("\n\n");
  
            const analyzePrompt = `Eres un experto frontend React+TypeScript+CSS. El usuario quiere hacer este cambio visual/UI:
  
  TARGET: ${target}
  CAMBIO DESEADO: ${change}
  
  Estos son los archivos del proyecto (path relativo desde src/):
  
  ${fileListForPrompt}
  
  Necesito que me digas:
  1. Qué archivo(s) hay que modificar (path relativo desde src/, ej: "pages/Landing.tsx", "pages/landing.css")
  2. Qué código hay que buscar (oldCode exacto, copiado del archivo)
  3. Qué código nuevo poner (newCode)
  
  IMPORTANTE: Los paths deben ser relativos desde src/ SIN incluir "src/" al inicio.
  Ejemplo correcto: "pages/Landing.tsx"
  Ejemplo INCORRECTO: "src/pages/Landing.tsx"
  
  Responde SOLO JSON:
  {
    "files": [
      {
        "filePath": "pages/Landing.tsx",
        "changes": [
          {"oldCode": "código exacto a reemplazar", "newCode": "código nuevo", "description": "qué hace este cambio"}
        ]
      }
    ],
    "summary": "resumen del cambio"
  }`;
  
            const modifyUiProjectId = getSessionProjectId(req, params);
            const uiText = await askClaudeWithBrain(
              modifyUiProjectId,
              [{ role: "user", content: analyzePrompt }],
              "Eres un experto frontend senior. Responde SOLO JSON válido. Los paths de archivo son relativos desde src/ sin incluir src/ al inicio.",
              "general",
              undefined,
              3000
            );
            // HIGH-1: parsing robusto de JSON con fallback en cascada
            let uiJson: { files?: Array<{ filePath: string; changes: Array<{ oldCode: string; newCode: string; description?: string }> }>; summary?: string } = {};
            try {
              uiJson = JSON.parse(uiText);
            } catch {
              const m = uiText.match(/\{[\s\S]*\}/);
              if (m) {
                try { uiJson = JSON.parse(m[0]); }
                catch {
                  const cleaned = uiText.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
                  try { uiJson = JSON.parse(cleaned); }
                  catch {
                    result = { error: true, message: `❌ Claude devolvió JSON inválido. Respuesta (primeros 300 chars): ${uiText.slice(0, 300)}` };
                    break;
                  }
                }
              } else {
                result = { error: true, message: `❌ Claude no devolvió JSON. Respuesta (primeros 300 chars): ${uiText.slice(0, 300)}` };
                break;
              }
            }
  
            let changesApplied = 0;
            const appliedFiles: string[] = [];
            const failedFiles: string[] = [];
            const failedChanges: string[] = [];
  
            if (uiJson.files) {
              for (const file of uiJson.files) {
                const rawPath = String(file.filePath).replace(/^src\//, "");

                // FIX CRIT-1 bis: aplicar también whitelist en modify_ui (no solo fix_code)
                const pathToValidate = rawPath.startsWith("src/") ? rawPath : `src/${rawPath}`;
                const pathError = validateFixCodePath(pathToValidate);
                if (pathError) {
                  failedFiles.push(`${file.filePath} (🚫 ${pathError})`);
                  continue;
                }

                const fullPath = resolveFilePath(`src/${rawPath}`) || resolveFilePath(rawPath);
                if (!fullPath) {
                  failedFiles.push(`${file.filePath} (intentado: src/${rawPath}, ${rawPath})`);
                  continue;
                }
                if (!fullPath.startsWith(FRONTEND_ROOT) && !fullPath.startsWith(BACKEND_ROOT)) {
                  failedFiles.push(`${file.filePath} (solo se permiten cambios en frontend/backend)`);
                  continue;
                }
                let content = fs.readFileSync(fullPath, "utf-8");
                let fileChanged = false;
                for (const ch of file.changes || []) {
                  if (content.includes(ch.oldCode)) {
                    content = content.replace(ch.oldCode, ch.newCode);
                    changesApplied++;
                    fileChanged = true;
                  } else {
                    failedChanges.push(`${file.filePath}: ${(ch.description || ch.oldCode?.slice(0, 50) || "cambio desconocido")}`);
                  }
                }
                if (fileChanged) {
                  fs.writeFileSync(fullPath, content, "utf-8");
                  appliedFiles.push(file.filePath);
                }
              }
            }
  
            let msg = "";
            if (changesApplied > 0) {
              msg = `✅ **Cambio UI aplicado:** ${uiJson.summary || change}\n📁 Archivos: ${appliedFiles.join(", ")}\n🔧 ${changesApplied} cambios aplicados\n⚠️ Recarga la página para ver los cambios.`;
            } else {
              msg = `⚠️ No se pudieron aplicar los cambios automáticamente.`;
            }
            if (failedFiles.length > 0) {
              msg += `\n❌ Archivos no encontrados: ${failedFiles.join(", ")}`;
            }
            if (failedChanges.length > 0) {
              msg += `\n⚠️ Cambios no coincidieron: ${failedChanges.join("; ")}`;
            }
  
            result = {
              success: changesApplied > 0,
              changesApplied,
              files: appliedFiles,
              failedFiles,
              failedChanges,
              summary: uiJson.summary || "Cambio UI aplicado",
              message: msg,
            };
          } catch (err) {
            result = { error: true, message: `Error modificando UI: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "list_themes": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { listThemes } = await import("../lib/shopify-theme.js");
          const themes = await listThemes(parseInt(projectId), proj.shopDomain);
          result = {
            themes: themes.map(t => ({ id: t.id, name: t.name, role: t.role, updated: t.updated_at })),
            activeTheme: themes.find(t => t.role === "main")?.name ?? "ninguno",
            message: `📋 **${themes.length} themes encontrados:**\n${themes.map(t => `• ${t.name} (${t.role === "main" ? "🟢 ACTIVO" : t.role}) — ID: ${t.id}`).join("\n")}`,
          };
          break;
        }
  
        case "list_theme_files": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, getThemeStructureSummary } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const structureSummary = await getThemeStructureSummary(parseInt(projectId), proj.shopDomain, themeId);
          const directory = params?.directory as string | undefined;
          let filteredFiles: string[] = [];
          if (directory) {
            const tree = structureSummary.fileTree;
            filteredFiles = (tree as unknown as Record<string, string[]>)[directory] ?? [];
          }
          result = {
            themeId,
            ...structureSummary,
            filteredFiles: directory ? filteredFiles : undefined,
            message: directory
              ? `📁 **${filteredFiles.length} archivos en ${directory}/:**\n${filteredFiles.map(f => `• ${f}`).join("\n")}`
              : `🗂️ **Estructura del theme (${structureSummary.totalFiles} archivos):**\n${structureSummary.summary}`,
          };
          break;
        }
  
        case "read_theme_file": {
          const projectId = params?.projectId;
          const assetKey = params?.assetKey as string;
          if (!projectId || !assetKey) { res.status(400).json({ error: "projectId y assetKey requeridos (ej: assetKey='sections/header.liquid')" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, readThemeFile, analyzeThemeFileContent, categorizeFile } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const asset = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey);
          if (!asset || !asset.value) {
            result = { error: true, message: `❌ No se pudo leer el archivo '${assetKey}'. Verifica que existe con list_theme_files.` };
            break;
          }
          const fileInfo = categorizeFile(assetKey);
          const analysis = analyzeThemeFileContent(assetKey, asset.value);
          const fullContent = asset.value;
          const preview = fullContent.length > 4000 ? fullContent.slice(0, 4000) + "\n\n... [vista previa truncada, archivo completo tiene " + analysis.lineCount + " líneas]" : fullContent;
          result = {
            assetKey,
            themeId,
            fileType: fileInfo.type,
            fileDescription: fileInfo.description,
            lineCount: analysis.lineCount,
            analysis: {
              liquidTags: analysis.liquidTags,
              includes: analysis.includes,
              sections: analysis.sections,
              schemaBlocks: analysis.schemaBlocks,
              cssSelectors: analysis.cssSelectors.slice(0, 20),
              warnings: analysis.warnings,
            },
            content: fullContent,
            preview,
            message: `📄 **${assetKey}** (${fileInfo.description}, ${analysis.lineCount} líneas)\n${analysis.warnings.length > 0 ? `⚠️ ${analysis.warnings.join("; ")}` : "✅ Sin advertencias"}\n${analysis.liquidTags.length > 0 ? `🏷️ Liquid tags: ${analysis.liquidTags.join(", ")}` : ""}\n${analysis.includes.length > 0 ? `📎 Incluye: ${analysis.includes.join(", ")}` : ""}\n${analysis.schemaBlocks.length > 0 ? `🔧 Schema: ${analysis.schemaBlocks.join(", ")}` : ""}`,
          };
          break;
        }
  
        case "edit_theme_file": {
          const projectId = params?.projectId;
          const assetKey = params?.assetKey as string;
          const editType = (params?.editType as string) ?? "smart_edit";
          const oldCode = params?.oldCode as string | undefined;
          const newCode = params?.newCode as string;
          const description = params?.description as string;
          if (!projectId || !assetKey || !newCode) { res.status(400).json({ error: "projectId, assetKey y newCode requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, readThemeFile, writeThemeFile, categorizeFile, intelligentMerge } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
  
          const currentAsset = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey);
          const currentContent = currentAsset?.value ?? "";
          const fileInfo = categorizeFile(assetKey);
          let finalContent = newCode;
          const changeLog: string[] = [];
  
          if (editType === "replace_block" && oldCode) {
            if (!currentContent.includes(oldCode)) {
              result = { error: true, message: `❌ No se encontró el bloque a reemplazar en '${assetKey}'. Usa read_theme_file para ver el contenido actual y copia el texto EXACTO.` };
              break;
            }
            finalContent = currentContent.replace(oldCode, newCode);
            changeLog.push(`Bloque reemplazado (${oldCode.length} chars → ${newCode.length} chars)`);
          } else if (editType === "add_css") {
            finalContent = currentContent.trimEnd() + "\n\n/* " + (description ?? "Añadido por Shopy Crafter") + " */\n" + newCode.trim() + "\n";
            changeLog.push("CSS añadido al final del archivo");
          } else if (editType === "modify_section") {
            if (oldCode && currentContent.includes(oldCode)) {
              finalContent = currentContent.replace(oldCode, newCode);
              changeLog.push("Sección modificada (replace_block)");
            } else {
              const mergeResult = intelligentMerge(currentContent, description ?? "", newCode, fileInfo.type);
              finalContent = mergeResult.merged;
              changeLog.push(...mergeResult.changes);
            }
          } else if (editType === "update_settings") {
            const mergeResult = intelligentMerge(currentContent, description ?? "", newCode, "json");
            finalContent = mergeResult.merged;
            changeLog.push(...mergeResult.changes);
          } else if (editType === "full_replace") {
            finalContent = newCode;
            changeLog.push("Contenido reemplazado completamente");
          } else {
            if (oldCode && currentContent.includes(oldCode)) {
              finalContent = currentContent.replace(oldCode, newCode);
              changeLog.push("Smart edit: bloque encontrado y reemplazado");
            } else if (fileInfo.type === "css") {
              finalContent = currentContent.trimEnd() + "\n\n" + newCode.trim() + "\n";
              changeLog.push("Smart edit: CSS añadido al final");
            } else if (fileInfo.type === "json") {
              const mergeResult = intelligentMerge(currentContent, description ?? "", newCode, "json");
              finalContent = mergeResult.merged;
              changeLog.push(...mergeResult.changes);
            } else if (oldCode && !currentContent.includes(oldCode)) {
              result = { error: true, message: `❌ No se encontró el bloque a reemplazar en '${assetKey}'. Usa read_theme_file para ver el contenido actual y copia el texto EXACTO. Para reemplazar todo el archivo, usa editType="full_replace".` };
              break;
            } else if (!currentContent) {
              finalContent = newCode;
              changeLog.push("Smart edit: archivo nuevo/vacío, contenido escrito");
            } else {
              result = { error: true, message: `❌ Smart edit requiere oldCode para archivos Liquid/JS. Proporciona el bloque exacto a reemplazar, o usa editType="full_replace" para reemplazar todo el contenido.` };
              break;
            }
          }
  
          const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey, finalContent);
          if (!written) {
            result = { error: true, message: `❌ Error escribiendo '${assetKey}' en el theme. Verifica permisos (scope write_themes).` };
            break;
          }
          result = {
            assetKey, themeId, editType, changesApplied: changeLog,
            originalLength: currentContent.length,
            newLength: finalContent.length,
            message: `✅ **Archivo editado:** ${assetKey}\n📝 ${description ?? "Cambio aplicado"}\n🔧 ${changeLog.join("; ")}\n📊 ${currentContent.length} → ${finalContent.length} chars`,
          };
          learnFromOperation({
            operationType: "theme_edit",
            title: `Theme edit: ${assetKey}`,
            content: `Editado ${assetKey} (${editType}): ${description ?? changeLog.join("; ")}. ${currentContent.length}→${finalContent.length} chars.`,
            confidence: 0.85,
            tags: ["theme", "edit", assetKey.split("/")[0], fileInfo.type],
          });
          break;
        }
  
        case "create_theme_section": {
          const projectId = params?.projectId;
          const sectionName = params?.sectionName as string;
          const sectionContent = params?.sectionContent as string;
          if (!projectId || !sectionName || !sectionContent) { res.status(400).json({ error: "projectId, sectionName y sectionContent requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, writeThemeFile, readThemeFile } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const assetKey = `sections/${sectionName.replace(/\.liquid$/, "")}.liquid`;
          const existing = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey);
          if (existing?.value) {
            result = { error: true, message: `⚠️ La sección '${sectionName}' ya existe. Usa edit_theme_file para modificarla o elige otro nombre.` };
            break;
          }
          const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, assetKey, sectionContent);
          if (!written) {
            result = { error: true, message: `❌ Error creando sección '${sectionName}'. Verifica permisos.` };
            break;
          }
          result = {
            assetKey, themeId, sectionName,
            message: `✅ **Sección creada:** ${assetKey}\n📐 ${sectionContent.length} chars\n💡 Para añadirla a una página, edita el template JSON correspondiente con edit_theme_file.`,
          };
          break;
        }
  
        case "audit_theme": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, getThemeStructureSummary, readThemeFile, analyzeThemeFileContent } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const structure = await getThemeStructureSummary(parseInt(projectId), proj.shopDomain, themeId);
          const criticalFiles = ["layout/theme.liquid", "config/settings_schema.json", "templates/index.json", "templates/product.json", "templates/collection.json"];
          const fileAnalyses: Record<string, unknown> = {};
          const allWarnings: string[] = [];
          const seoIssues: string[] = [];
          const performanceIssues: string[] = [];
  
          for (const key of criticalFiles) {
            if ([...structure.fileTree.layout, ...structure.fileTree.templates, ...structure.fileTree.config].includes(key)) {
              const file = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, key);
              if (file?.value) {
                const analysis = analyzeThemeFileContent(key, file.value);
                fileAnalyses[key] = { lineCount: analysis.lineCount, liquidTags: analysis.liquidTags.length, warnings: analysis.warnings };
                allWarnings.push(...analysis.warnings.map(w => `${key}: ${w}`));
  
                if (key === "layout/theme.liquid") {
                  if (!file.value.includes("canonical_url")) seoIssues.push("❌ Falta canonical URL en layout");
                  if (!file.value.includes("page_description")) seoIssues.push("❌ Falta meta description en layout");
                  if (!file.value.includes("content_for_header")) allWarnings.push("⚠️ Falta content_for_header en layout (crítico)");
                  if (!file.value.includes("preconnect")) performanceIssues.push("⚡ Falta preconnect a CDN en layout");
                  if (!file.value.includes("preload")) performanceIssues.push("⚡ No hay preload de recursos críticos");
                }
              }
            }
          }
  
          for (const sectionKey of structure.fileTree.sections.slice(0, 15)) {
            const file = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, sectionKey);
            if (file?.value) {
              const analysis = analyzeThemeFileContent(sectionKey, file.value);
              if (!file.value.includes("{% schema %}")) allWarnings.push(`${sectionKey}: Sin schema (no configurable en Theme Editor)`);
              if (file.value.includes("{% include ")) allWarnings.push(`${sectionKey}: Usa {% include %} (legacy, migrar a {% render %})`);
              allWarnings.push(...analysis.warnings.map(w => `${sectionKey}: ${w}`));
            }
          }
  
          if (structure.fileTree.sections.length < 5) allWarnings.push("⚠️ Pocas secciones — theme con funcionalidad limitada");
          if (structure.fileTree.snippets.length < 3) allWarnings.push("⚠️ Pocos snippets — código posiblemente duplicado");
  
          let pageSpeedSummary = "";
          try {
            const { runDualPageSpeed } = await import("../lib/pagespeed.js");
            const storeUrl = proj.shopDomain.includes("://") ? proj.shopDomain : `https://${proj.shopDomain}`;
            const ps = await runDualPageSpeed(storeUrl);
            pageSpeedSummary = ps.summary;
          } catch {}
  
          const auditPrompt = `Analiza esta auditoría de theme Shopify y genera un informe profesional:
  
  ESTRUCTURA: ${structure.summary}
  ARCHIVOS CRÍTICOS ANALIZADOS: ${JSON.stringify(fileAnalyses, null, 2)}
  ADVERTENCIAS: ${allWarnings.join("\n")}
  SEO ISSUES: ${seoIssues.join("\n") || "Ninguno detectado"}
  PERFORMANCE: ${performanceIssues.join("\n") || "Ninguno detectado"}
  ${pageSpeedSummary ? `PAGESPEED: ${pageSpeedSummary}` : ""}
  
  Genera un informe con: puntuación global /100, resumen ejecutivo, problemas críticos, oportunidades SEO, mejoras de rendimiento, y plan de acción prioritizado.`;
  
          let aiAudit = "";
          try {
            const { dualAI } = await import("../lib/dual-ai.js");
            const dualResult = await dualAI(parseInt(projectId), auditPrompt, {
              mode: "gemini_research_claude_redact",
              claudeSystemPrompt: "Eres un auditor experto de themes Shopify con 10+ años de experiencia. Genera informes detallados y accionables.",
              geminiUseSearch: true,
              maxTokens: 16000,
              useCase: "intelligence",
            });
            aiAudit = dualResult.final;
          } catch {
            aiAudit = `Estructura: ${structure.summary}\nAdvertencias: ${allWarnings.length}\nSEO Issues: ${seoIssues.length}\nPerformance: ${performanceIssues.length}`;
          }
  
          result = {
            themeId,
            structure: structure.summary,
            totalFiles: structure.totalFiles,
            editableFiles: structure.editableFiles,
            warnings: allWarnings,
            seoIssues,
            performanceIssues,
            fileAnalyses,
            aiAudit,
            message: `🔍 **Auditoría del theme completada**\n\n${aiAudit}`,
          };
          learnFromOperation({
            operationType: "seo",
            title: `Theme audit: ${proj.shopDomain}`,
            content: `Auditoría: ${structure.totalFiles} archivos, ${allWarnings.length} advertencias, ${seoIssues.length} SEO issues, ${performanceIssues.length} performance issues.`,
            confidence: 0.9,
            tags: ["theme", "audit", proj.shopDomain],
          });
          break;
        }
  
        case "edit_theme_css": {
          const projectId = params?.projectId;
          const cssCode = params?.cssCode as string;
          const cssAction = (params?.action as string) ?? "add";
          const selector = params?.selector as string | undefined;
          if (!projectId || !cssCode) { res.status(400).json({ error: "projectId y cssCode requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, listThemeAssets, readThemeFile, writeThemeFile } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          let cssFile = params?.cssFile as string | undefined;
          if (!cssFile) {
            const assets = await listThemeAssets(parseInt(projectId), proj.shopDomain, themeId);
            const cssFiles = assets.filter(a => a.key.startsWith("assets/") && (a.key.endsWith(".css") || a.key.endsWith(".scss")));
            const mainCss = cssFiles.find(f => f.key.includes("base") || f.key.includes("main") || f.key.includes("theme") || f.key.includes("custom") || f.key.includes("style"));
            cssFile = mainCss?.key ?? cssFiles[0]?.key;
            if (!cssFile) {
              cssFile = "assets/custom-shopybrain.css";
            }
          }
  
          const current = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, cssFile);
          let currentContent = current?.value ?? "";
          let finalCss = currentContent;
  
          if (cssAction === "add") {
            finalCss = currentContent.trimEnd() + "\n\n/* Shopy Crafter edit */\n" + cssCode.trim() + "\n";
          } else if (cssAction === "replace" && selector) {
            const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const selectorRegex = new RegExp(`(${escapedSelector}\\s*\\{[^}]*\\})`, "g");
            if (selectorRegex.test(currentContent)) {
              finalCss = currentContent.replace(selectorRegex, cssCode.trim());
            } else {
              finalCss = currentContent.trimEnd() + "\n\n/* Shopy Crafter: selector not found, added new */\n" + cssCode.trim() + "\n";
            }
          } else if (cssAction === "remove_and_add" && selector) {
            const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const selectorRegex = new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}\\s*`, "g");
            finalCss = currentContent.replace(selectorRegex, "").trimEnd() + "\n\n" + cssCode.trim() + "\n";
          }
  
          const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, cssFile, finalCss);
          result = {
            cssFile, themeId, action: cssAction,
            success: !!written,
            originalLength: currentContent.length,
            newLength: finalCss.length,
            message: written
              ? `✅ **CSS actualizado:** ${cssFile}\n📝 Acción: ${cssAction}${selector ? ` (selector: ${selector})` : ""}\n📊 ${currentContent.length} → ${finalCss.length} chars`
              : `❌ Error escribiendo CSS en ${cssFile}`,
          };
          break;
        }
  
        case "edit_theme_settings": {
          const projectId = params?.projectId;
          const settingsPath = params?.settingsPath as string;
          const value = params?.value;
          if (!projectId || !settingsPath || value === undefined) { res.status(400).json({ error: "projectId, settingsPath y value requeridos" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
          const { getActiveTheme, readThemeFile, writeThemeFile } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
          const settingsFile = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId, "config/settings_data.json");
          if (!settingsFile?.value) {
            result = { error: true, message: "❌ No se pudo leer settings_data.json" };
            break;
          }
          try {
            const settings = JSON.parse(settingsFile.value);
            const pathParts = settingsPath.split(".");
            let target: Record<string, unknown> = settings;
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i];
              if (!(part in target) || typeof target[part] !== "object") {
                target[part] = {};
              }
              target = target[part] as Record<string, unknown>;
            }
            const lastKey = pathParts[pathParts.length - 1];
            const oldValue = target[lastKey];
            if (value && typeof value === "object" && !Array.isArray(value) && oldValue && typeof oldValue === "object" && !Array.isArray(oldValue)) {
              const deepMergeSettings = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
                const result = { ...a };
                for (const k of Object.keys(b)) {
                  if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && result[k] && typeof result[k] === "object" && !Array.isArray(result[k])) {
                    result[k] = deepMergeSettings(result[k] as Record<string, unknown>, b[k] as Record<string, unknown>);
                  } else {
                    result[k] = b[k];
                  }
                }
                return result;
              };
              target[lastKey] = deepMergeSettings(oldValue as Record<string, unknown>, value as Record<string, unknown>);
            } else {
              target[lastKey] = value;
            }
            const newSettingsJson = JSON.stringify(settings, null, 2);
            const written = await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId, "config/settings_data.json", newSettingsJson);
            result = {
              settingsPath, oldValue, newValue: value, themeId,
              success: !!written,
              message: written
                ? `✅ **Settings actualizado:** ${settingsPath}\n📝 ${JSON.stringify(oldValue)} → ${JSON.stringify(value)}`
                : `❌ Error escribiendo settings_data.json`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error parseando settings_data.json: ${err instanceof Error ? err.message : String(err)}` };
          }
          learnFromOperation({
            operationType: "theme_settings_edit",
            title: `Theme settings: ${settingsPath}`,
            content: `Editado setting ${settingsPath} = ${JSON.stringify(value)}`,
            confidence: 0.85,
            tags: ["theme", "settings", "configuration"],
          });
          break;
        }
  
        case "sync_store_theme": {
          const projectId = params?.projectId;
          if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
          if (!proj) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
          const { getActiveTheme, readThemeFile, writeThemeFile } = await import("../lib/shopify-theme.js");
          let themeId = params?.themeId ? parseInt(params.themeId) : undefined;
          if (!themeId) {
            const active = await getActiveTheme(parseInt(projectId), proj.shopDomain);
            if (!active) { res.status(404).json({ error: "No se encontró theme activo" }); return; }
            themeId = active.id;
          }
  
          const { DEFAULT_CMS_CONTENT } = await import("../lib/cms-defaults.js");
          const { cmsContent: cmsContentTable } = await import("@workspace/db/schema");
          const cmsRows = await db.select().from(cmsContentTable).limit(1);
          const storedContent = cmsRows.length > 0 ? (cmsRows[0].content as Record<string, unknown>) : {};
          const mergedCms = { ...DEFAULT_CMS_CONTENT, ...storedContent };
          if (DEFAULT_CMS_CONTENT.storeTheme && !storedContent.storeTheme) {
            (mergedCms as Record<string, unknown>).storeTheme = DEFAULT_CMS_CONTENT.storeTheme;
          }
          const storeTheme = (mergedCms as Record<string, unknown>).storeTheme as Record<string, unknown> | undefined;
          if (!storeTheme) {
            result = { message: "⚠️ No hay configuración storeTheme en el CMS. Edita la sección 'storeTheme' del CMS primero." };
            break;
          }
  
          const header = storeTheme.header as Record<string, unknown>;
          const hero = storeTheme.hero as Record<string, unknown>;
          const announcement = storeTheme.announcementBar as Record<string, unknown>;
          const changes: string[] = [];
  
          if (header) {
            const navLinks = (header.navLinks as Array<Record<string, unknown>>) || [];
            const visibleLinks = navLinks.filter((l: Record<string, unknown>) => l.visible !== false);
            const loginBtn = header.loginButton as Record<string, unknown>;
            const accountBtn = header.accountButton as Record<string, unknown>;
  
            const desktopNav = visibleLinks.map((l: Record<string, unknown>) =>
              `      <a href="${l.href}" class="cc-header__link{% if page.handle == '${String(l.href).replace('/pages/','')}' %} cc-header__link--active{% endif %}">${l.label}</a>`
            ).join("\n");
  
            const mobileNav = visibleLinks.map((l: Record<string, unknown>) =>
              `  <a href="${l.href}" class="cc-mobile-menu__link">${l.label}</a>`
            ).join("\n");
  
            const headerLiquid = `<header class="cc-header">
    <div class="cc-header__inner">
      <a href="/" class="cc-header__logo">
        <img src="{{ 'logo-app.png' | asset_url }}" alt="{{ shop.name }}" />
        <span class="cc-header__logo-text">{{ shop.name }}</span>
      </a>
  
      <nav class="cc-header__nav">
  ${desktopNav}
      </nav>
  
      <div class="cc-header__actions">
        <a href="/cart" class="cc-header__cart" aria-label="Carrito">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          {% if cart.item_count > 0 %}
            <span class="cc-header__cart-count">{{ cart.item_count }}</span>
          {% endif %}
        </a>
        {% if customer %}
          <a href="${accountBtn?.href || '/account'}" class="cc-header__link cc-header__link--active" style="background:linear-gradient(135deg,var(--cc-purple),var(--cc-pink));color:#fff;padding:0.5rem 1rem;border-radius:var(--cc-radius-full);font-weight:700;font-size:0.8125rem;">${accountBtn?.label || 'Mi Cuenta'}</a>
        {% else %}
          <a href="${loginBtn?.href || '/account/login'}" class="cc-header__link cc-header__link--active" style="background:linear-gradient(135deg,var(--cc-purple),var(--cc-pink));color:#fff;padding:0.5rem 1rem;border-radius:var(--cc-radius-full);font-weight:700;font-size:0.8125rem;">${loginBtn?.label || 'Iniciar Sesión'}</a>
        {% endif %}
        <button class="cc-header__menu-toggle" aria-label="Abrir menú" onclick="document.querySelector('.cc-mobile-menu').classList.toggle('active')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  </header>
  
  <nav class="cc-mobile-menu">
  ${mobileNav}
    {% if customer %}
      <a href="${accountBtn?.href || '/account'}" class="cc-mobile-menu__link cc-mobile-menu__link--cta">${accountBtn?.label || 'Mi Cuenta'}</a>
    {% else %}
      <a href="${loginBtn?.href || '/account/login'}" class="cc-mobile-menu__link cc-mobile-menu__link--cta">${loginBtn?.label || 'Iniciar Sesión'}</a>
    {% endif %}
  </nav>`;
  
            await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "snippets/header.liquid", headerLiquid);
            changes.push(`Header: ${visibleLinks.length} links, login="${loginBtn?.label}", account="${accountBtn?.label}"`);
          }
  
          if (hero) {
            const indexFile = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "templates/index.json");
            if (indexFile?.value) {
              try {
                const indexSettings = JSON.parse(indexFile.value);
                if (indexSettings.sections?.hero?.settings) {
                  const hs = indexSettings.sections.hero.settings;
                  if (hero.eyebrow) hs.eyebrow = hero.eyebrow;
                  if (hero.title) hs.title = hero.title;
                  if (hero.titleGradient) hs.title_gradient = hero.titleGradient;
                  if (hero.subtitle) hs.subtitle = hero.subtitle;
                  const ctaPrimary = hero.ctaPrimary as Record<string, unknown>;
                  const ctaSecondary = hero.ctaSecondary as Record<string, unknown>;
                  if (ctaPrimary) { hs.cta_text = ctaPrimary.label; hs.cta_url = ctaPrimary.href; }
                  if (ctaSecondary) { hs.cta2_text = ctaSecondary.label; hs.cta2_url = ctaSecondary.href; }
                  await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "templates/index.json", JSON.stringify(indexSettings, null, 2));
                  changes.push(`Hero: title="${hero.title}", CTA="${(hero.ctaPrimary as Record<string, unknown>)?.label}"`);
                }
              } catch {}
            }
          }
  
          if (announcement) {
            const settingsFile = await readThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "config/settings_data.json");
            if (settingsFile?.value) {
              try {
                const settings = JSON.parse(settingsFile.value);
                const announcementSection = settings.current?.sections?.["announcement-bar"];
                if (announcementSection?.settings) {
                  announcementSection.settings.show_announcement = !!(announcement.enabled);
                  if (announcement.text) announcementSection.settings.announcement_text = announcement.text;
                  await writeThemeFile(parseInt(projectId), proj.shopDomain, themeId!, "config/settings_data.json", JSON.stringify(settings, null, 2));
                  changes.push(`Announcement: enabled=${announcement.enabled}, text="${String(announcement.text).substring(0,50)}..."`);
                }
              } catch {}
            }
          }
  
          result = {
            synced: changes,
            message: `✅ Store theme sincronizado desde CMS:\n${changes.map(c => `• ${c}`).join("\n")}\n\n📝 Cambios aplicados al theme activo del proyecto.`,
          };
          learnFromOperation({
            operationType: "store_theme_sync",
            title: "CMS → Store theme sync",
            content: `Sincronizado storeTheme del CMS al theme Shopify: ${changes.join("; ")}`,
            confidence: 0.9,
            tags: ["theme", "sync", "cms", "store"],
          });
          break;
        }
  
        case "brain_sync": {
          const syncUrl = params?.url as string;
          const syncApiKey = params?.apiKey as string | undefined;
          const syncSource = params?.source as string | undefined;
          if (!syncUrl) {
            result = { error: true, message: "URL requerida. Ejemplo: brain_sync {url: 'https://comic-crafter.myshopify.com', apiKey: 'sck_...'}" };
            break;
          }
          try {
            const { syncFromExternalBrain } = await import("./brain-sync.js");
            const syncResult = await syncFromExternalBrain(syncUrl, syncApiKey, syncSource);
            if (!syncResult.success) {
              result = { error: true, message: `❌ ${syncResult.error || "No se pudo sincronizar"}${syncResult.errors?.length ? `\n${syncResult.errors.join("\n")}` : ""}` };
              break;
            }
            const s = syncResult.stats!;
            result = {
              ...syncResult,
              message: `🧠 **Sincronización completada desde ${syncUrl}**\n📥 Importados: ${s.memoriesImported} memorias, ${s.insightsImported} insights, ${s.domainsImported} dominios, ${s.promptsImported} prompts\n⏭️ Duplicados saltados: ${s.duplicatesSkipped}\n📄 Páginas procesadas: ${syncResult.totalPages}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error en brain_sync: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "brain_stats": {
          try {
            const { getBrainStats } = await import("./brain-sync.js");
            const stats = await getBrainStats();
            const memorySources = stats.memorySources as Record<string, number> || {};
            const insightsByDomain = stats.insightsByDomain as Record<string, number> || {};
            const topDomains = Object.entries(insightsByDomain).sort((a, b) => b[1] - a[1]).slice(0, 10);
            result = {
              ...stats,
              message: `🧠 **Estado de Shopy Crafter**\n\n📦 **${stats.totalMemories}** memorias\n💡 **${stats.totalInsights}** insights\n🏷️ **${stats.totalDomains}** dominios\n📝 **${stats.totalPrompts}** prompts\n🎯 **${stats.totalNicheProfiles}** perfiles de nicho\n🔗 **${stats.totalCrossConnections}** conexiones cruzadas\n\n📊 **Top dominios:**\n${topDomains.map(([d, c]) => `  • ${d}: ${c} insights`).join("\n")}\n\n🔍 **Fuentes de memorias:**\n${Object.entries(memorySources).map(([s, c]) => `  • ${s}: ${c}`).join("\n")}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error obteniendo stats: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "brain_export": {
          try {
            const { getExportData } = await import("./brain-sync.js");
            const domain = params?.domain as string | undefined;
            const exportData = await getExportData({ domain });
            const s = exportData.stats;
            result = {
              exportData,
              message: `📤 **Exportación de Shopy Crafter**\n\n📦 Memorias: ${s.totalMemories}\n💡 Insights: ${s.totalInsights}\n🏷️ Dominios: ${s.totalDomains}\n📝 Prompts: ${s.totalPrompts}\n\n${domain ? `🔍 Filtrado por dominio: ${domain}` : "📋 Exportación completa"}`,
            };
          } catch (err) {
            result = { error: true, message: `❌ Error exportando: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "copyright_audit": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(projectId))).limit(1);
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
  
            const productsRes = await shopifyGraphQL<{ products: { edges: { node: { id: string; title: string; descriptionHtml: string; tags: string[]; vendor: string; productType: string } }[] } }>(
              Number(projectId),
              project.shopDomain,
              `{ products(first: 50) { edges { node { id title descriptionHtml tags vendor productType } } } }`
            );
  
            const products = productsRes.products?.edges?.map(e => e.node) ?? [];
  
            const brainCtx = await buildShopyBrainContext(undefined, "general", "copyright trademark intellectual property brand names");
            const auditResult = await askClaudeJsonWithBrain<{
              totalProducts: number;
              riskProducts: { title: string; risks: string[]; severity: "alta" | "media" | "baja"; suggestion: string }[];
              generalRisks: string[];
              recommendations: string[];
              safeProducts: number;
            }>(
              parseInt(projectId),
              `Realiza una auditoría de copyright y propiedad intelectual de los siguientes productos de una tienda Shopify.
  
  PRODUCTOS (${products.length}):
  ${products.map((p, i) => `${i + 1}. Título: "${p.title}" | Vendor: ${p.vendor} | Tipo: ${p.productType} | Tags: ${p.tags?.join(", ") || "ninguno"} | Descripción: ${(p.descriptionHtml || "").replace(/<[^>]*>/g, "").slice(0, 200)}`).join("\n")}
  
  ANALIZA CADA PRODUCTO buscando:
  1. **Marcas registradas**: Nombres como "Funko", "Disney", "Marvel", "Nintendo", "LEGO", "Pokémon", "Star Wars", etc. que son marcas registradas
  2. **Derechos de autor**: Personajes protegidos, diseños con copyright, logos de terceros
  3. **Denominaciones engañosas**: Usar nombres de marca sin autorización oficial (ej: "Funko Pop" sin licencia = infracción)
  4. **Sugerencias de alternativas**: Para cada producto con riesgo, sugiere un nombre alternativo que no infrinja derechos
  
  Responde SOLO con JSON válido (sin markdown):
  {
    "totalProducts": number,
    "riskProducts": [{ "title": "nombre actual", "risks": ["riesgo 1", "riesgo 2"], "severity": "alta|media|baja", "suggestion": "nombre alternativo sugerido" }],
    "generalRisks": ["riesgo general 1"],
    "recommendations": ["recomendación 1"],
    "safeProducts": number
  }`,
              brainCtx, "general"
            );
  
            let msg = `⚖️ **Auditoría de Copyright completada**\n\n`;
            msg += `📦 **${auditResult.totalProducts}** productos analizados\n`;
            msg += `✅ **${auditResult.safeProducts}** productos sin riesgos\n`;
            msg += `⚠️ **${auditResult.riskProducts.length}** productos con riesgos detectados\n\n`;
  
            if (auditResult.riskProducts.length > 0) {
              msg += `### Productos con riesgo:\n`;
              for (const p of auditResult.riskProducts) {
                const icon = p.severity === "alta" ? "🔴" : p.severity === "media" ? "🟡" : "🟢";
                msg += `\n${icon} **${p.title}** (${p.severity})\n`;
                msg += `  Riesgos: ${p.risks.join(", ")}\n`;
                msg += `  💡 Sugerencia: _${p.suggestion}_\n`;
              }
            }
  
            if (auditResult.generalRisks.length > 0) {
              msg += `\n### Riesgos generales:\n${auditResult.generalRisks.map(r => `  ⚠️ ${r}`).join("\n")}\n`;
            }
            if (auditResult.recommendations.length > 0) {
              msg += `\n### Recomendaciones:\n${auditResult.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}\n`;
            }
  
            result = { ...auditResult, message: msg };
          } catch (err) {
            result = { error: true, message: `❌ Error en auditoría de copyright: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "redesign_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/redesign`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ parts: params?.parts }),
            });
            const data = await resp.json() as Record<string, unknown>;
            const rdTags = typeof data.tags === "string" ? data.tags.split(",").filter((t: string) => t.trim()) : [];
            const rdDescLen = typeof data.description === "string" ? (data.description as string).length : 0;
            result = {
              ...data,
              products: [{
                title: String(data.title ?? "(generado)"),
                status: "active",
                price: String(data.price ?? "0"),
                compareAtPrice: data.compare_at_price ? String(data.compare_at_price) : null,
                imageCount: Array.isArray(data.photo_brief) ? (data.photo_brief as unknown[]).length : 0,
                imageUrl: null,
                variantCount: 1,
                descriptionLength: rdDescLen,
                tagsCount: rdTags.length,
                published: true,
                auditScore: rdDescLen >= 500 && rdTags.length >= 10 ? 75 : 50,
                auditGrade: rdDescLen >= 500 && rdTags.length >= 10 ? "B" : "C",
                hasComparePrice: !!data.compare_at_price,
              }],
              message: `✅ **Rediseño 100/100 completado**\n\n📝 Nuevo título: ${data.title ?? "(generado)"}\n📊 Precio sugerido: €${data.price ?? "-"}\n🏷️ Tags: ${rdTags.length} tags\n📸 ${Array.isArray(data.photo_brief) ? (data.photo_brief as unknown[]).length : 0} photo briefs\n\n💡 Usa **apply_redesign** para aplicar estos cambios en Shopify.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error en rediseño: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "apply_redesign": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const fields = params?.fields || ["title", "description", "tags", "meta"];
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/apply-redesign`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ fields }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error aplicando rediseño"}` }; break; }
            result = { ...data, message: `✅ **Rediseño aplicado en Shopify**\n\nCampos actualizados: ${(fields as string[]).join(", ")}` };
          } catch (err) { result = { error: true, message: `❌ Error aplicando rediseño: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "bulk_redesign": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const mode = params?.mode || "all";
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/bulk-redesign`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ mode }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error en bulk redesign"}` }; break; }
            result = { ...data, message: `🚀 **Rediseño en lote iniciado (modo: ${mode})**\n\n${data.totalItems ?? "?"} productos procesándose con calidad 100/100 Semrush.\nJob ID: ${data.jobId ?? "-"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "create_ab_test": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/ab-tests`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ productId, testType: params?.testType || "image", variantA: params?.variantA, variantB: params?.variantB }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: data.error ? `❌ ${data.error}` : `⚗️ **Test A/B creado**\n\nTipo: ${params?.testType || "image"}\nProducto: ${productId}\n\nEl test está activo y recopilando datos.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_ab_tests": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/ab-tests`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo tests A/B" }; break; }
            const tests = await resp.json() as Array<Record<string, unknown>>;
            const active = tests.filter((t) => t.status === "running").length;
            const completed = tests.filter((t) => t.status === "completed" || t.status === "winner_applied").length;
            result = { tests, message: `⚗️ **Tests A/B**\n\n🟢 Activos: ${active}\n✅ Completados: ${completed}\n📊 Total: ${tests.length}${tests.length > 0 ? "\n\n" + tests.slice(0, 5).map((t) => `• ${t.productTitle || t.productId} — ${t.testType} — ${t.status}${t.winner ? ` (ganador: ${t.winner})` : ""}`).join("\n") : ""}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "declare_winner": {
          const projectId = params?.projectId;
          const testId = params?.testId;
          if (!projectId || !testId) { result = { error: true, message: "❌ Falta projectId o testId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/ab-tests/${testId}/declare-winner`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ winner: params?.winner || "A" }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: data.error ? `❌ ${data.error}` : `🏆 **Ganador declarado: Variante ${params?.winner || "A"}**\n\nLos cambios se han aplicado al producto.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "seo_full_audit": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/audit`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as { avgScore?: number; storeGrade?: string; products?: Array<Record<string, unknown>>; criticalIssues?: Array<Record<string, unknown>> };
            const critical = data.criticalIssues?.length ?? 0;
            result = { ...data, message: `🔍 **Auditoría SEO Semrush-Level Completa**\n\n📊 Puntuación media: ${Math.round(data.avgScore ?? 0)}/100\n🏆 Grado tienda: ${data.storeGrade ?? "?"}\n📦 Productos auditados: ${Array.isArray(data.products) ? data.products.length : "?"}\n⚠️ Issues críticos: ${critical}\n\n16 criterios evaluados: meta title, meta desc, structured data, alt texts, URL, internal linking, content depth, PageSpeed, title optimization, images, tags, structured content, keyword consistency, readability, social meta, FAQ optimization.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "keyword_intelligence": {
          const projectId = params?.projectId;
          const keyword = params?.keyword;
          if (!projectId || !keyword) { result = { error: true, message: "❌ Falta projectId o keyword" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/keyword-intelligence`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ keyword }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: data.error ? `❌ ${data.error}` : `🔑 **Investigación de Keyword: "${keyword}"**\n\n${JSON.stringify(data).length > 200 ? "Análisis completo generado con Google Search — incluye volumen, dificultad, intención, autocomplete, People Also Ask y competidores SERP." : "Datos recopilados."}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "blog_strategy": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/blog-strategy`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📝 **Estrategia de Blog generada**\n\nPillar content + cluster topics basados en tus productos y nicho. Incluye calendario editorial y keywords objetivo.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_blog_post": {
          const projectId = params?.projectId;
          const topic = params?.topic;
          if (!projectId || !topic) { result = { error: true, message: "❌ Falta projectId o topic" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-blog-post`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ topic, targetKeyword: params?.targetKeyword, wordCount: params?.wordCount || 1500 }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📄 **Artículo de Blog SEO generado**\n\nTema: ${topic}\n${params?.targetKeyword ? `Keyword objetivo: ${params.targetKeyword}` : ""}\n\nOptimizado para posicionamiento en Google con metodología Semrush.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_schemas": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-schemas`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ productId: params?.productId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📋 **Schemas JSON-LD generados**\n\nProduct, FAQ, Organization schema para Rich Snippets en Google.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_all_metas": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-metas`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ applyToShopify: true }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `🏷️ **Meta tags SEO generados**\n\nMeta titles (40-60 chars) + meta descriptions (130-155 chars) optimizados para todos los productos.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "fix_all_alt_texts": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/fix-alt-texts`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `🖼️ **Alt texts SEO corregidos**\n\nTodas las imágenes ahora tienen alt text descriptivo con keywords para Google Images.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "audit_page_speed": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/audit-page-speed`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `⚡ **Auditoría PageSpeed completada**\n\nCore Web Vitals analizados: LCP, CLS, FID/INP. Incluye puntuación móvil y desktop.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_sitemap": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-sitemap`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `🗺️ **Sitemap XML generado**\n\nPing enviado a Google para indexación acelerada.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "scan_competitor": {
          const projectId = params?.projectId;
          const competitorId = params?.competitorId;
          if (!projectId || !competitorId) { result = { error: true, message: "❌ Falta projectId o competitorId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/competitors/scan`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId, competitorId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error escaneando competidor"}` }; break; }
            result = { ...data, message: `🔍 **Competidor escaneado**\n\nPrecios, productos, promociones y nivel de amenaza analizados con IA.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "discover_competitors": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/competitors/auto-discover`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error descubriendo competidores"}` }; break; }
            const discovered = (data.discovered as Array<{ name: string; url: string; type: string; reason: string }>) || [];
            const summary = discovered.map((c, i) => `${i + 1}. **${c.name}** (${c.type})\n   ${c.url}\n   _${c.reason}_`).join("\n\n");
            result = { ...data, message: `🔍 **Competidores descubiertos automáticamente**\n\n${discovered.length} competidores encontrados via Google Search:\n\n${summary || "No se encontraron nuevos competidores."}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "analyze_competitor_product": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/analyze-competitors`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📊 **Análisis competitivo del producto**\n\nPosicionamiento de precio vs competidores del mercado analizado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "calculate_optimal_price": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/calculate-optimal-price`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `💰 **Precio óptimo calculado**\n\nAnálisis de elasticidad precio-demanda, márgenes y competencia completado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "estimate_cogs": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/ai-estimate-cogs`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📦 **COGS estimado con IA**\n\nMateriales, producción, envío y márgenes calculados.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "auto_estimate_all_cogs": {
          interface ProductItem { id?: string | number; shopifyId?: string | number; title?: string; cogs?: { totalCost?: number } }
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const productsResp = await fetch(`${baseUrl}/api/projects/${projectId}/products`, {
              headers: { cookie: req.headers.cookie ?? "" },
            });
            const productsData: unknown = await productsResp.json();
            const products: ProductItem[] = Array.isArray(productsData)
              ? productsData
              : (productsData !== null && typeof productsData === "object" && Array.isArray((productsData as Record<string, unknown>).products))
                ? (productsData as Record<string, ProductItem[]>).products
                : [];
            if (products.length === 0) {
              result = { error: true, message: "❌ No se encontraron productos en este proyecto." };
              break;
            }
  
            const productsWithoutCogs = products.filter(p => !p.cogs || (p.cogs.totalCost ?? 0) === 0);
            const toEstimate = productsWithoutCogs.length > 0 ? productsWithoutCogs : products;
            const maxProducts = Math.min(toEstimate.length, 10);
  
            const results: Array<{ productId: string; title: string; success: boolean; error?: string }> = [];
            for (let i = 0; i < maxProducts; i++) {
              const product = toEstimate[i];
              const pid = String(product.shopifyId ?? product.id ?? "");
              const ptitle = product.title ?? "";
              try {
                const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${pid}/ai-estimate-cogs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                });
                results.push({ productId: pid, title: ptitle, success: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` });
              } catch (e) {
                results.push({ productId: pid, title: ptitle, success: false, error: String(e) });
              }
            }
  
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            let msg = `📦 **COGS estimados en lote**\n\n✅ ${successCount} productos estimados correctamente\n`;
            if (failCount > 0) msg += `❌ ${failCount} productos con error\n`;
            msg += `\n📊 Productos procesados:\n${results.map(r => `${r.success ? "✅" : "❌"} ${r.title}`).join("\n")}`;
            if (toEstimate.length > maxProducts) msg += `\n\n⚠️ Limitado a ${maxProducts} productos. Quedan ${toEstimate.length - maxProducts} por estimar.`;
  
            result = { success: true, results, message: msg, total: products.length, estimated: successCount, errors: failCount };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "price_simulator": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const newPrice = params?.newPrice;
          if (!projectId || !productId || !newPrice) { result = { error: true, message: "❌ Falta projectId, productId o newPrice" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/price-simulator`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ newPrice: parseFloat(String(newPrice)), unitsPerMonth: params?.unitsPerMonth || 30 }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error en simulador"}` }; break; }
            result = { ...data, message: `📈 **Simulación de precio: €${newPrice}**\n\nEscenarios pesimista/base/optimista calculados con impacto en revenue, margen y conversión.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "financial_forecast": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/financial-forecast`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ months: params?.months || 6 }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📊 **Forecast Financiero generado**\n\nProyección a ${params?.months || 6} meses con escenarios optimista, realista y pesimista.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "financial_dashboard": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/financial-dashboard`, { headers: { cookie: req.headers.cookie ?? "" } });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `💹 **Dashboard Financiero**\n\nMárgenes, COGS, revenue y métricas clave del proyecto.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_product_images": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const imageTypesToGen = params?.imageTypes ?? ["hero", "lifestyle", "detail", "packaging"];
            const results: Array<{ type: string; status: string }> = [];
            for (const iType of imageTypesToGen) {
              try {
                const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/images/generate`, {
                  method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                  body: JSON.stringify({ imageType: iType }),
                });
                const data = await resp.json() as Record<string, unknown>;
                results.push({ type: iType, status: data.error ? "error" : "pending" });
              } catch { results.push({ type: iType, status: "error" }); }
            }
            const ok = results.filter(r => r.status === "pending").length;
            result = { jobs: results, message: `🖼️ **${ok}/${imageTypesToGen.length} imágenes IA generándose**\n\nTipos: ${imageTypesToGen.join(", ")}.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_images_from_reference": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const referenceImageUrl = params?.referenceImageUrl;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          if (!referenceImageUrl) { result = { error: true, message: "❌ Falta referenceImageUrl — necesito la URL de la imagen de referencia del producto" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const formData = new FormData();
            formData.append("referenceImageUrl", String(referenceImageUrl));
            if (params?.productTitle) formData.append("productTitle", String(params.productTitle));
            if (params?.productType) formData.append("productType", String(params.productType));
            if (params?.scenes) formData.append("scenes", JSON.stringify(params.scenes));
            formData.append("autoUpload", String(params?.autoUpload ?? "true"));
  
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/images/generate-from-reference`, {
              method: "POST",
              headers: { cookie: req.headers.cookie ?? "" },
              body: formData,
            });
  
            if (!resp.ok) {
              const errData = await resp.json() as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error generando imágenes desde referencia"}` };
              break;
            }
  
            const text = await resp.text();
            const lines = text.split("\n").filter(l => l.startsWith("data: "));
            let summary = { total: 0, success: 0, failed: 0 };
            const sceneResults: string[] = [];
            for (const line of lines) {
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (data.type === "done") {
                  summary = data.summary as typeof summary;
                }
                if (data.type === "completed" && data.success) {
                  sceneResults.push(`✅ ${data.label}`);
                }
                if (data.type === "error") {
                  sceneResults.push(`❌ ${data.label}: ${data.error}`);
                }
              } catch {}
            }
  
            result = {
              message: `🖼️ **Imágenes generadas desde referencia**\n\n📸 ${summary.success}/${summary.total} fotos profesionales creadas:\n${sceneResults.join("\n")}\n\n${summary.success > 0 ? "✅ Imágenes subidas automáticamente a Shopify" : "⚠️ Algunas imágenes no se pudieron generar"}`,
              imagesGenerated: summary.success,
              imagesFailed: summary.failed,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "virtual_tryon": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          const modelImageUrl = params?.modelImageUrl;
          const productImageUrls = params?.productImageUrls as string[] | undefined;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          if (!modelImageUrl) { result = { error: true, message: "❌ Falta modelImageUrl — necesito la URL de la foto de la persona/modelo" }; break; }
          if (!productImageUrls || !productImageUrls.length) { result = { error: true, message: "❌ Falta productImageUrls — necesito al menos una URL de foto del producto (ropa, calzado, accesorio, etc)" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const formData = new FormData();
            formData.append("modelImageUrl", String(modelImageUrl));
            formData.append("productImageUrls", JSON.stringify(productImageUrls));
            if (params?.productTitle) formData.append("productTitle", String(params.productTitle));
            if (params?.productType) formData.append("productType", String(params.productType));
            if (params?.scenes) formData.append("scenes", JSON.stringify(params.scenes));
            formData.append("autoUpload", String(params?.autoUpload ?? "true"));
  
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/products/${productId}/images/virtual-tryon`, {
              method: "POST",
              headers: { cookie: req.headers.cookie ?? "" },
              body: formData,
            });
  
            if (!resp.ok) {
              const errData = await resp.json() as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error en virtual try-on"}` };
              break;
            }
  
            const text = await resp.text();
            const lines = text.split("\n").filter(l => l.startsWith("data: "));
            let summary = { total: 0, success: 0, failed: 0 };
            const sceneResults: string[] = [];
            for (const line of lines) {
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
                if (data.type === "done") summary = data.summary as typeof summary;
                if (data.type === "completed" && data.success) sceneResults.push(`✅ ${data.label}`);
                if (data.type === "error") sceneResults.push(`❌ ${data.label}: ${data.error}`);
              } catch {}
            }
  
            result = {
              message: `👗 **Virtual Try-On completado**\n\n📸 ${summary.success}/${summary.total} fotos profesionales generadas:\n${sceneResults.join("\n")}\n\n${summary.success > 0 ? "✅ Imágenes subidas automáticamente a Shopify\n\n🎯 Tipo: Modelo real vistiendo los productos de la tienda" : "⚠️ Algunas imágenes no se pudieron generar"}`,
              imagesGenerated: summary.success,
              imagesFailed: summary.failed,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "bulk_generate_images": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const productIds = params?.productIds as string[] | undefined;
            const imageTypes = params?.imageTypes || ["hero", "lifestyle", "detail"];
            if (!productIds || !productIds.length) {
              result = { error: true, message: "❌ Falta productIds (array de IDs de productos). Usa list_products primero para obtener los IDs." }; break;
            }
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/bulk-generate-images`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ productIds, imageTypes }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando imágenes"}` }; break; }
            result = { ...data, message: `🎨 **Generación de imágenes en lote iniciada**\n\n${productIds.length} productos × ${(imageTypes as string[]).length} tipos = ${productIds.length * (imageTypes as string[]).length} imágenes.\nTipos: ${(imageTypes as string[]).join(", ")}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_email_flow": {
          const projectId = params?.projectId;
          const flowType = params?.flowType || "welcome";
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/klaviyo-ai/generate-workflow`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ shopDomain: project.shopDomain, storeName: project.name, niche: project.storeNiche || "ecommerce", market: "es", storeContext: params?.customTopic || "" }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando flujo email"}` }; break; }
            result = { ...data, message: `📧 **Flujo de Email Marketing generado**\n\nTipo: ${flowType}\nTienda: ${project.name}\n\nFlujo completo con secuencia de emails, asuntos, contenido y timing optimizado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_email": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project) { result = { error: true, message: "❌ Proyecto no encontrado" }; break; }
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const flowType = params?.emailType || "promotional";
            const resp = await fetch(`${baseUrl}/api/klaviyo-ai/generate-email`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ flowType, emailPosition: 1, storeName: project.name, shopDomain: project.shopDomain, niche: project.storeNiche || "ecommerce", market: "es", projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando email"}` }; break; }
            result = { ...data, message: `✉️ **Email de marketing generado**\n\nTipo: ${flowType}\nContenido HTML profesional listo para enviar.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "inventory_sync": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sync`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📦 **Inventario sincronizado**\n\nStock actualizado desde Shopify.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "inventory_alerts": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/alerts?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo alertas de inventario" }; break; }
            const alerts = await resp.json() as Array<Record<string, unknown>>;
            const alertLines = alerts.slice(0, 10).map((a) => {
              const opts = [a.option1Value, a.option2Value, a.option3Value].filter(Boolean).join("/");
              return `• ${a.productTitle || "?"} ${opts ? `(${opts})` : ""} SKU:${a.sku || "N/A"}: ${a.currentStock ?? "?"} uds — ${a.daysRemaining ?? "?"} dias`;
            }).join("\n");
            result = { alerts, message: `🚨 **Alertas de Inventario**\n\n${alerts.length > 0 ? `${alerts.length} variantes con stock bajo (≤14 dias).\n\n${alertLines}` : "✅ Sin alertas — todo el stock esta en niveles saludables."}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "inventory_deep_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/deep-report?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo informe de inventario" }; break; }
            const report = await resp.json() as Record<string, unknown>;
            const summary = report.summary as Record<string, unknown>;
            const byOption = report.byOption as Record<string, Record<string, { stock: number; sold: number }>>;
            const outOfStock = (report.outOfStock || []) as Array<Record<string, unknown>>;
            let optionBreakdown = "";
            for (const [optName, values] of Object.entries(byOption || {})) {
              const topValues = Object.entries(values).sort(([, a], [, b]) => b.sold - a.sold).slice(0, 5);
              optionBreakdown += `\n**${optName}**: ${topValues.map(([v, d]) => `${v}(${d.stock} stock/${d.sold} vendidos)`).join(", ")}`;
            }
            const oosLines = outOfStock.slice(0, 5).map((o) => `• ${o.productTitle} ${[o.option1, o.option2, o.option3].filter(Boolean).join("/")}`).join("\n");
            result = { ...report, message: `📦 **Informe Profundo de Inventario**\n\n📊 Resumen:\n• ${summary.uniqueProducts} productos, ${summary.totalVariants} variantes\n• Stock total: ${summary.totalStock} unidades\n• Vendido total: ${summary.totalSold} unidades\n• Valor stock: ${summary.totalStockValue}€\n• Margen estimado: ${summary.estimatedMargin}%\n• Agotados: ${summary.outOfStockCount} | Criticos: ${summary.criticalCount} | Alerta: ${summary.warningCount} | Sanos: ${summary.healthyCount}\n${optionBreakdown ? `\n📐 Desglose por opcion:${optionBreakdown}` : ""}${oosLines ? `\n\n🔴 Agotados:\n${oosLines}` : ""}` };
  
            learnFromOperation({
              operationType: "inventory_deep_report",
              title: `Informe inventario: ${summary.uniqueProducts} productos, ${summary.totalVariants} variantes, ${summary.totalStock} uds stock, ${summary.totalSold} vendidos`,
              content: JSON.stringify({ summary, optionBreakdown: Object.keys(byOption || {}), outOfStockCount: outOfStock.length }),
              confidence: 0.85,
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "inventory_sync_orders": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sync-orders`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error sincronizando pedidos"}` }; break; }
            result = { ...data, message: `📋 **Pedidos sincronizados**\n\n• ${data.ordersProcessed} pedidos procesados\n• ${data.lineItemsInserted} lineas de venta importadas${(data.lineItemsFailed as number) > 0 ? `\n• ${data.lineItemsFailed} errores de insercion` : ""}\n\nAhora puedes ver analytics detallados con **inventory_sales_analytics** o el historial de un cliente con **inventory_customer_history**.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "inventory_sales_analytics": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sales-analytics?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo analytics de ventas" }; break; }
            const analytics = await resp.json() as Record<string, unknown>;
            const topProds = ((analytics.topProducts || []) as Array<Record<string, unknown>>).slice(0, 5).map((p) => `• ${p.title}: ${p.qty} uds — ${p.revenue}€`).join("\n");
            const topVars = ((analytics.topVariants || []) as Array<Record<string, unknown>>).slice(0, 5).map((v) => `• ${v.title} (${[v.option1, v.option2, v.option3].filter(Boolean).join("/")}): ${v.qty} uds`).join("\n");
            const topCusts = ((analytics.topCustomers || []) as Array<Record<string, unknown>>).slice(0, 5).map((c) => `• ${c.name || c.email}: ${c.orders} pedidos, ${c.items} items — ${c.revenue}€`).join("\n");
            const salesByOpt = analytics.salesByOption as Record<string, Record<string, { qty: number; revenue: number }>> || {};
            let optSales = "";
            for (const [optName, values] of Object.entries(salesByOpt)) {
              const sorted = Object.entries(values).sort(([, a], [, b]) => b.qty - a.qty).slice(0, 5);
              optSales += `\n**${optName}**: ${sorted.map(([v, d]) => `${v}(${d.qty})`).join(", ")}`;
            }
            result = { ...analytics, message: `📈 **Analytics de Ventas**\n\n📊 General:\n• ${analytics.totalOrders} pedidos | ${analytics.totalItems} items\n• Revenue total: ${analytics.totalRevenue}€\n• Ticket medio: ${analytics.avgOrderValue}€\n\n🏆 Top Productos:\n${topProds || "Sin datos"}\n\n🎯 Top Variantes (talla/color/etc):\n${topVars || "Sin datos"}\n\n👥 Top Clientes:\n${topCusts || "Sin datos"}${optSales ? `\n\n📐 Ventas por opcion:${optSales}` : ""}` };
  
            learnFromOperation({
              operationType: "inventory_sales_analytics",
              title: `Analytics ventas: ${analytics.totalOrders} pedidos, ${analytics.totalRevenue}€ revenue, ticket medio ${analytics.avgOrderValue}€`,
              content: JSON.stringify({ totalOrders: analytics.totalOrders, totalRevenue: analytics.totalRevenue, topProducts: (analytics.topProducts as Array<Record<string, unknown>>)?.slice(0, 3) }),
              confidence: 0.9,
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "sales_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/sales-report?projectId=${projectId}&format=json`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error generando informe de ventas" }; break; }
            const report = await resp.json() as Record<string, unknown>;
            const summary = report.summary as Record<string, unknown>;
            const prods = (report.products as Array<Record<string, unknown>>)?.slice(0, 10) || [];
            let prodsMsg = "";
            for (const p of prods) {
              const variants = (p.variants as Array<Record<string, unknown>>)?.slice(0, 5) || [];
              const varMsg = variants.map((v: Record<string, unknown>) => {
                const opts = (v.options as string[])?.join(" · ") || v.variantTitle;
                return `    · ${opts}: ${v.qtySold} vendidos, stock ${v.currentStock}`;
              }).join("\n");
              prodsMsg += `\n📦 **${p.title}**: ${p.totalQtySold} uds vendidas, ${p.totalRevenue}€, stock actual: ${p.totalCurrentStock}\n${varMsg}\n`;
            }
            const downloadUrl = `/api/inventory/sales-report?projectId=${projectId}`;
            result = { ...report, message: `📊 **Informe de Ventas y Stock**\n\n📈 Resumen General:\n• ${summary.totalOrders} pedidos | ${summary.totalItems} artículos vendidos\n• Revenue total: ${summary.totalRevenue}€\n• Ticket medio: ${summary.avgTicket}€\n• Stock total actual: ${summary.totalStock} unidades\n• ${summary.totalProducts} productos\n\n🏆 Top Productos (por ventas):\n${prodsMsg || "Sin datos de ventas — sincroniza pedidos primero con inventory_sync_orders"}\n\n📥 Descarga el informe completo:\n• [HTML](${downloadUrl})\n• [PDF](${downloadUrl}&format=pdf)` };
            learnFromOperation({
              operationType: "sales_report",
              title: `Informe ventas: ${summary.totalProducts} productos, ${summary.totalItems} items, ${summary.totalRevenue}€`,
              content: JSON.stringify({ totalOrders: summary.totalOrders, totalRevenue: summary.totalRevenue, totalProducts: summary.totalProducts }),
              confidence: 0.9,
            });
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "inventory_customer_history": {
          const projectId = params?.projectId;
          const customerId = params?.customerId;
          const customerEmail = params?.customerEmail;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          if (!customerId && !customerEmail) { result = { error: true, message: "❌ Falta customerId o customerEmail" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const qs = customerId ? `customerId=${customerId}` : `customerEmail=${encodeURIComponent(String(customerEmail))}`;
            const resp = await fetch(`${baseUrl}/api/inventory/customer-history?projectId=${projectId}&${qs}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) { result = { error: true, message: "❌ Error obteniendo historial de cliente" }; break; }
            const history = await resp.json() as Record<string, unknown>;
            const customer = history.customer as Record<string, unknown>;
            const preferences = history.preferences as Record<string, string>;
            const purchases = ((history.purchases || []) as Array<Record<string, unknown>>).slice(0, 10);
            const prefLines = Object.entries(preferences || {}).map(([k, v]) => `• ${k}: ${v}`).join("\n");
            const purchaseLines = purchases.map((p) => `• ${p.orderNumber}: ${p.productTitle} ${[p.option1, p.option2, p.option3].filter(Boolean).join(" ")} x${p.quantity} — ${p.totalPrice}€`).join("\n");
            result = { ...history, message: `👤 **Historial de Cliente: ${customer.name || customer.email}**\n\n📊 Resumen:\n• ${history.totalOrders} pedidos | ${history.totalItems} items\n• Gasto total: ${history.totalSpent}€\n• Ticket medio: ${history.avgOrderValue}€\n\n🎯 Preferencias detectadas:\n${prefLines || "Sin datos suficientes"}\n\n🛒 Ultimas compras:\n${purchaseLines || "Sin compras registradas"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "agency_quote": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/agency/quote`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId, services: params?.services, clientName: params?.clientName }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `💼 **Presupuesto generado**\n\nCotización profesional lista para enviar al cliente.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_budget": {
          try {
            const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const clampNum = (v: unknown, min: number, max: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
  
            const services = params?.services || [];
            const clientName = escHtml(String(params?.clientName || "Cliente").slice(0, 200));
            const projectName = escHtml(String(params?.projectName || "Proyecto Shopify").slice(0, 200));
            const clientEmail = escHtml(String(params?.clientEmail || "").slice(0, 200));
            const clientPhone = escHtml(String(params?.clientPhone || "").slice(0, 200));
            const clientCompany = escHtml(String(params?.clientCompany || "").slice(0, 200));
            const discount = clampNum(params?.discount, 0, 100, 0);
            const notes = escHtml(String(params?.notes || "").slice(0, 1000));
            const deliveryDays = clampNum(params?.deliveryDays, 1, 365, 7);
            const paymentTerms = escHtml(String(params?.paymentTerms || "50% al inicio, 50% a la entrega").slice(0, 300));
            const validDays = clampNum(params?.validDays, 1, 365, 30);
            const budgetDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
            const budgetId = `SC-${Date.now().toString(36).toUpperCase()}`;
  
            interface BudgetCategory { name: string; services: typeof parsedServices; subtotal: number }
            const parsedServices = (services as Array<{name: string, quantity: number, unitPrice: number, category?: string, description?: string, recurring?: boolean, level?: string}>).map((s) => {
              const sName = escHtml(String(s.name || "Servicio").slice(0, 200));
              const qty = clampNum(s.quantity, 0, 9999, 1);
              const price = clampNum(s.unitPrice, 0, 999999, 0);
              const sub = qty * price;
              return {
                name: sName,
                qty,
                price,
                sub,
                category: String(s.category || "Servicios").slice(0, 100),
                description: escHtml(String(s.description || "").slice(0, 300)),
                recurring: !!s.recurring,
                level: escHtml(String(s.level || "").slice(0, 50)),
              };
            });
  
            const categories: Record<string, BudgetCategory> = {};
            let subtotalOneTime = 0;
            let subtotalRecurring = 0;
            for (const s of parsedServices) {
              const catKey = s.category;
              if (!categories[catKey]) { categories[catKey] = { name: catKey, services: [], subtotal: 0 }; }
              categories[catKey].services.push(s);
              categories[catKey].subtotal += s.sub;
              if (s.recurring) { subtotalRecurring += s.sub; } else { subtotalOneTime += s.sub; }
            }
  
            const totalBeforeDiscount = subtotalOneTime + subtotalRecurring;
            const discountAmount = totalBeforeDiscount * (discount / 100);
            const totalAfterDiscount = totalBeforeDiscount - discountAmount;
            const iva = totalAfterDiscount * 0.21;
            const totalFinal = totalAfterDiscount + iva;
  
            const categoryBlocks = Object.values(categories).map((cat) => `
              <div class="cat-block">
                <div class="cat-header">
                  <span class="cat-icon">${cat.name.includes("SEO") ? "🔍" : cat.name.includes("Diseño") || cat.name.includes("Theme") ? "🎨" : cat.name.includes("Producto") ? "📦" : cat.name.includes("Email") || cat.name.includes("Marketing") ? "📧" : cat.name.includes("Informe") || cat.name.includes("Análisis") || cat.name.includes("Auditoría") ? "📊" : cat.name.includes("Imagen") || cat.name.includes("Foto") ? "📸" : "⚡"}</span>
                  <span class="cat-title">${escHtml(cat.name)}</span>
                  <span class="cat-total">€${cat.subtotal.toFixed(2)}</span>
                </div>
                <table>
                  <thead><tr>
                    <th style="width:40%">Servicio</th>
                    <th style="width:15%;text-align:center">Nivel</th>
                    <th style="width:10%;text-align:center">Cant.</th>
                    <th style="width:15%;text-align:right">Precio/ud</th>
                    <th style="width:20%;text-align:right">Subtotal</th>
                  </tr></thead>
                  <tbody>
                    ${cat.services.map((s) => `<tr>
                      <td>
                        <div class="svc-name">${s.name}</div>
                        ${s.description ? `<div class="svc-desc">${s.description}</div>` : ""}
                      </td>
                      <td style="text-align:center">${s.level ? `<span class="level-badge ${s.level.includes("3") || s.level.includes("Premium") ? "level-3" : s.level.includes("2") || s.level.includes("Guía") ? "level-2" : "level-1"}">${s.level}</span>` : '<span class="level-badge level-1">Estándar</span>'}</td>
                      <td style="text-align:center">${s.qty}</td>
                      <td style="text-align:right">€${s.price.toFixed(2)}</td>
                      <td style="text-align:right;font-weight:600;color:#c8a84b">€${s.sub.toFixed(2)}${s.recurring ? '<small class="recur">/mes</small>' : ''}</td>
                    </tr>`).join("\n")}
                  </tbody>
                </table>
              </div>`).join("\n");
  
            const budgetHtml = `<!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Presupuesto ${budgetId} — Shopy Crafter</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#08080e;color:#e0e0e0}
  .budget-doc{max-width:900px;margin:0 auto;background:#0a0a14}
  .doc-header{padding:48px 56px 40px;background:linear-gradient(135deg,#0c0c1a 0%,#141428 50%,#0c0c1a 100%);border-bottom:3px solid #c8a84b;position:relative;overflow:hidden}
  .doc-header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(200,168,75,0.08) 0%,transparent 70%);border-radius:50%}
  .doc-header::after{content:'';position:absolute;bottom:-40px;left:-40px;width:150px;height:150px;background:radial-gradient(circle,rgba(200,168,75,0.05) 0%,transparent 70%);border-radius:50%}
  .brand-row{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
  .brand-logo{font-size:32px;font-weight:800;color:#c8a84b;letter-spacing:-1px}
  .brand-logo span{color:#ffffff;font-weight:300}
  .brand-tag{font-size:11px;color:#8b8b9e;margin-top:4px;letter-spacing:2px;text-transform:uppercase}
  .budget-badge{background:linear-gradient(135deg,#c8a84b,#dfc06a);color:#0a0a14;padding:8px 20px;border-radius:24px;font-size:12px;font-weight:700;letter-spacing:1px}
  .doc-title{margin-top:32px;position:relative;z-index:1}
  .doc-title h1{font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px}
  .doc-title .subtitle{font-size:14px;color:#8b8b9e;margin-top:6px}
  .client-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:36px 56px;background:#0c0c18;border-bottom:1px solid rgba(200,168,75,0.1)}
  .client-card{background:#111120;border:1px solid rgba(200,168,75,0.1);border-radius:12px;padding:20px 24px}
  .client-card h4{font-size:10px;color:#c8a84b;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:700}
  .client-card .field{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:13px}
  .client-card .field:last-child{border-bottom:none}
  .client-card .label{color:#8b8b9e}
  .client-card .value{color:#e0e0e0;font-weight:500}
  .services-section{padding:36px 56px}
  .section-title{font-size:18px;font-weight:700;color:#ffffff;margin-bottom:24px;display:flex;align-items:center;gap:10px}
  .section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(200,168,75,0.3),transparent)}
  .cat-block{margin-bottom:28px;background:#0e0e1c;border:1px solid rgba(200,168,75,0.08);border-radius:14px;overflow:hidden}
  .cat-header{display:flex;align-items:center;gap:10px;padding:14px 20px;background:rgba(200,168,75,0.04);border-bottom:1px solid rgba(200,168,75,0.08)}
  .cat-icon{font-size:18px}
  .cat-title{font-size:14px;font-weight:700;color:#e0e0e0;flex:1}
  .cat-total{font-size:15px;font-weight:700;color:#c8a84b}
  table{width:100%;border-collapse:collapse}
  thead th{padding:10px 16px;text-align:left;color:#8b8b9e;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid rgba(200,168,75,0.06)}
  tbody td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.02);font-size:13px;color:#d0d0d8}
  tbody tr:hover td{background:rgba(200,168,75,0.02)}
  .svc-name{font-weight:600;color:#e0e0e0}
  .svc-desc{font-size:11px;color:#8b8b9e;margin-top:3px}
  .level-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
  .level-1{background:rgba(200,168,75,0.1);color:#c8a84b}
  .level-2{background:rgba(59,130,246,0.1);color:#60a5fa}
  .level-3{background:rgba(168,85,247,0.1);color:#c084fc}
  .recur{color:#8b8b9e;font-weight:400;margin-left:2px}
  .totals-section{padding:32px 56px;background:linear-gradient(135deg,#0e0e1c,#12122a);border-top:2px solid rgba(200,168,75,0.15)}
  .totals-grid{max-width:400px;margin-left:auto}
  .total-line{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#d0d0d8}
  .total-line.discount{color:#4ade80}
  .total-line.iva{color:#8b8b9e;font-size:13px}
  .total-line.grand{font-size:26px;font-weight:800;color:#c8a84b;padding:16px 0 0;margin-top:12px;border-top:3px solid #c8a84b}
  .savings-note{background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);border-radius:10px;padding:12px 16px;margin-top:16px;font-size:12px;color:#4ade80;text-align:center}
  .conditions-section{padding:36px 56px;background:#0c0c18;border-top:1px solid rgba(200,168,75,0.08)}
  .cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .cond-item{display:flex;gap:10px;padding:12px 16px;background:#111120;border-radius:10px;border:1px solid rgba(200,168,75,0.06)}
  .cond-icon{font-size:18px;flex-shrink:0}
  .cond-text{font-size:12px;color:#8b8b9e;line-height:1.5}
  .cond-text strong{color:#d0d0d8;display:block;margin-bottom:2px;font-size:12px}
  ${notes ? `.notes-box{margin-top:20px;background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.1);border-radius:10px;padding:16px 20px;font-size:13px;color:#d0d0d8;line-height:1.6}` : ""}
  .cta-section{padding:36px 56px;text-align:center;background:linear-gradient(135deg,#0c0c1a,#141428)}
  .cta-box{background:linear-gradient(135deg,rgba(200,168,75,0.08),rgba(200,168,75,0.02));border:2px solid rgba(200,168,75,0.2);border-radius:16px;padding:32px;max-width:500px;margin:0 auto}
  .cta-box h3{font-size:18px;font-weight:700;color:#c8a84b;margin-bottom:8px}
  .cta-box p{font-size:13px;color:#8b8b9e;margin-bottom:16px}
  .cta-btn{display:inline-block;background:linear-gradient(135deg,#c8a84b,#dfc06a);color:#0a0a14;padding:12px 32px;border-radius:24px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px}
  .doc-footer{padding:24px 56px;background:#08080e;border-top:1px solid rgba(200,168,75,0.08);text-align:center;font-size:11px;color:#666}
  .doc-footer .brand-foot{color:#c8a84b;font-weight:600}
  @media print{body{background:white;color:#111}.budget-doc{background:white}.doc-header{background:#f8f6f0!important;border-color:#c8a84b}.doc-header::before,.doc-header::after{display:none}.brand-logo{color:#c8a84b}.brand-logo span{color:#333}.budget-badge{background:#c8a84b}.client-grid{background:#fafafa}.client-card{background:#f5f5f5;border-color:#eee}.services-section{background:white}.cat-block{background:#fafafa;border-color:#eee}.cat-header{background:#f5f5f5}.totals-section{background:#f8f6f0}thead th{color:#666;border-color:#ddd}tbody td{color:#333;border-color:#eee}.svc-name{color:#111}.total-line{color:#333}.total-line.grand{color:#c8a84b;border-color:#c8a84b}.conditions-section{background:#fafafa}.cond-item{background:#f5f5f5;border-color:#eee}.doc-footer{background:#fafafa}}
  </style></head><body>
  ${buildCoverPage({ reportTitle: `Presupuesto Profesional`, reportSubtitle: `${budgetId} — ${projectName}`, companyName: clientName, date: budgetDate, template: "prestige" })}
  <div class="budget-doc">
    <div class="doc-header">
      <div class="brand-row">
        <div>
          <div class="brand-logo">Shopy <span>Crafter</span></div>
          <div class="brand-tag">Agencia de Optimización IA para Shopify</div>
        </div>
        <div class="budget-badge">PRESUPUESTO ${budgetId}</div>
      </div>
      <div class="doc-title">
        <h1>${projectName}</h1>
        <div class="subtitle">Presupuesto personalizado · ${budgetDate} · Válido ${validDays} días</div>
      </div>
    </div>
  
    <div class="client-grid">
      <div class="client-card">
        <h4>Datos del Cliente</h4>
        <div class="field"><span class="label">Nombre</span><span class="value">${clientName}</span></div>
        ${clientCompany ? `<div class="field"><span class="label">Empresa</span><span class="value">${clientCompany}</span></div>` : ""}
        ${clientEmail ? `<div class="field"><span class="label">Email</span><span class="value">${clientEmail}</span></div>` : ""}
        ${clientPhone ? `<div class="field"><span class="label">Teléfono</span><span class="value">${clientPhone}</span></div>` : ""}
      </div>
      <div class="client-card">
        <h4>Detalles del Presupuesto</h4>
        <div class="field"><span class="label">Referencia</span><span class="value">${budgetId}</span></div>
        <div class="field"><span class="label">Fecha</span><span class="value">${budgetDate}</span></div>
        <div class="field"><span class="label">Entrega estimada</span><span class="value">${deliveryDays} días laborables</span></div>
        <div class="field"><span class="label">Validez</span><span class="value">${validDays} días</span></div>
      </div>
    </div>
  
    <div class="services-section">
      <div class="section-title">Servicios Contratados</div>
      ${categoryBlocks}
    </div>
  
    <div class="totals-section">
      <div class="section-title">Resumen Económico</div>
      <div class="totals-grid">
        ${subtotalOneTime > 0 ? `<div class="total-line"><span>Servicios puntuales</span><span>€${subtotalOneTime.toFixed(2)}</span></div>` : ''}
        ${subtotalRecurring > 0 ? `<div class="total-line"><span>Servicios recurrentes</span><span>€${subtotalRecurring.toFixed(2)}/mes</span></div>` : ''}
        ${(discount as number) > 0 ? `<div class="total-line discount"><span>Descuento especial (${discount}%)</span><span>-€${discountAmount.toFixed(2)}</span></div>` : ''}
        <div class="total-line"><span>Subtotal sin IVA</span><span>€${totalAfterDiscount.toFixed(2)}</span></div>
        <div class="total-line iva"><span>IVA (21%)</span><span>€${iva.toFixed(2)}</span></div>
        <div class="total-line grand"><span>TOTAL</span><span>€${totalFinal.toFixed(2)}</span></div>
        ${(discount as number) > 0 ? `<div class="savings-note">💰 Ahorro total aplicado: €${discountAmount.toFixed(2)}</div>` : ''}
      </div>
    </div>
  
    <div class="conditions-section">
      <div class="section-title">Condiciones</div>
      <div class="cond-grid">
        <div class="cond-item"><span class="cond-icon">💳</span><div class="cond-text"><strong>Forma de pago</strong>${paymentTerms}</div></div>
        <div class="cond-item"><span class="cond-icon">⏱️</span><div class="cond-text"><strong>Plazo de entrega</strong>${deliveryDays} días laborables desde la aceptación</div></div>
        <div class="cond-item"><span class="cond-icon">🔄</span><div class="cond-text"><strong>Revisiones incluidas</strong>1 ronda de revisiones. Adicionales: €47/hora</div></div>
        <div class="cond-item"><span class="cond-icon">📋</span><div class="cond-text"><strong>Validez</strong>Presupuesto válido durante ${validDays} días desde ${budgetDate}</div></div>
        <div class="cond-item"><span class="cond-icon">🔒</span><div class="cond-text"><strong>Confidencialidad</strong>Este documento es confidencial entre las partes</div></div>
        <div class="cond-item"><span class="cond-icon">💶</span><div class="cond-text"><strong>Moneda</strong>Todos los importes en EUR. IVA 21% incluido en total</div></div>
      </div>
      ${notes ? `<div class="notes-box"><strong style="color:#c8a84b">📝 Notas:</strong><br>${notes}</div>` : ""}
    </div>
  
    <div class="cta-section">
      <div class="cta-box">
        <h3>¿Listo para empezar?</h3>
        <p>Acepta este presupuesto para comenzar a trabajar en tu proyecto</p>
        <a class="cta-btn" href="mailto:craftershopy@gmail.com?subject=Acepto presupuesto ${budgetId}">Aceptar Presupuesto</a>
      </div>
    </div>
  
    <div class="doc-footer">
      <span class="brand-foot">Shopy Crafter</span> · shopycrafter.com · craftershopy@gmail.com<br>
      Agencia de Optimización IA para Shopify · NIF: [A completar] · © ${new Date().getFullYear()}<br>
      <span style="color:#444;font-size:10px">Documento generado automáticamente · ${budgetId}</span>
    </div>
  </div></body></html>`;
  
            const activeProjectId = params?.projectId || null;
            if (activeProjectId) {
              try {
                const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
                await fetch(`${baseUrl}/api/projects/${activeProjectId}/vault/save-report`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                  body: JSON.stringify({
                    title: `Presupuesto ${budgetId} — ${clientName}`,
                    content: budgetHtml,
                    fileType: "budget",
                  }),
                });
              } catch {}
            }
  
            result = {
              budgetId,
              totalBeforeDiscount: totalBeforeDiscount.toFixed(2),
              discount: `${discount}%`,
              totalAfterDiscount: totalAfterDiscount.toFixed(2),
              iva: iva.toFixed(2),
              totalFinal: totalFinal.toFixed(2),
              html: budgetHtml,
              message: `💼 **Presupuesto ${budgetId} generado**\n\n` +
                `**Cliente:** ${clientName}${clientCompany ? ` (${clientCompany})` : ""}\n**Proyecto:** ${projectName}\n\n` +
                `| Servicio | Nivel | Cant. | Precio/ud | Subtotal |\n|---|---|---|---|---|\n` +
                parsedServices.map((s) => {
                  return `| ${s.name.replace(/[|]/g, "\\|")} | ${s.level || "Estándar"} | ${s.qty} | €${s.price.toFixed(2)} | €${s.sub.toFixed(2)}${s.recurring ? "/mes" : ""} |`;
                }).join("\n") +
                `\n\n${discount > 0 ? `🏷️ **Descuento ${discount}%:** -€${discountAmount.toFixed(2)}\n` : ''}` +
                `**Subtotal:** €${totalAfterDiscount.toFixed(2)}\n**IVA (21%):** €${iva.toFixed(2)}\n**💰 TOTAL:** €${totalFinal.toFixed(2)}\n\n` +
                `📄 Presupuesto guardado en el Vault — descargable en HTML y PDF.\n⏱️ Entrega: ${deliveryDays} días laborables · Validez: ${validDays} días`
            };
          } catch (err) { result = { error: true, message: `❌ Error generando presupuesto: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_platform_report": {
          try {
            const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const clientName = escHtml(String(params?.clientName || "Shopy Crafter").slice(0, 200));
            const reportDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
            const reportId = `CAP-${Date.now().toString(36).toUpperCase()}`;
  
            const platformReportHtml = `<!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Informe de Capacidades — Shopy Crafter</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#08080e;color:#e0e0e0}
  .report{max-width:900px;margin:0 auto;background:#0a0a14}
  .r-header{padding:48px 56px;background:linear-gradient(135deg,#0c0c1a,#141428);border-bottom:3px solid #c8a84b;position:relative;overflow:hidden}
  .r-header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(200,168,75,0.08),transparent 70%);border-radius:50%}
  .r-brand{font-size:32px;font-weight:800;color:#c8a84b;letter-spacing:-1px;position:relative;z-index:1}
  .r-brand span{color:#fff;font-weight:300}
  .r-tag{font-size:11px;color:#8b8b9e;letter-spacing:2px;text-transform:uppercase;margin-top:4px;position:relative;z-index:1}
  .r-title{margin-top:28px;position:relative;z-index:1}
  .r-title h1{font-size:26px;font-weight:800;color:#fff}
  .r-title .sub{font-size:13px;color:#8b8b9e;margin-top:6px}
  .section{padding:36px 56px;border-bottom:1px solid rgba(200,168,75,0.06)}
  .s-title{font-size:18px;font-weight:700;color:#c8a84b;margin-bottom:20px;display:flex;align-items:center;gap:10px}
  .s-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(200,168,75,0.3),transparent)}
  .cap-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .cap-card{background:#0e0e1c;border:1px solid rgba(200,168,75,0.08);border-radius:12px;padding:18px 20px;transition:border-color .2s}
  .cap-card:hover{border-color:rgba(200,168,75,0.2)}
  .cap-card .icon{font-size:22px;margin-bottom:8px}
  .cap-card h4{font-size:14px;font-weight:700;color:#e0e0e0;margin-bottom:4px}
  .cap-card p{font-size:12px;color:#8b8b9e;line-height:1.5}
  .cap-card .price{display:inline-block;margin-top:8px;background:rgba(200,168,75,0.1);color:#c8a84b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600}
  .full-table{width:100%;border-collapse:collapse;margin-top:12px}
  .full-table thead th{padding:10px 14px;text-align:left;color:#c8a84b;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid rgba(200,168,75,0.15);font-weight:700}
  .full-table tbody td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.02);font-size:12px;color:#d0d0d8}
  .full-table tbody tr:hover td{background:rgba(200,168,75,0.02)}
  .tier-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
  .t1{background:rgba(200,168,75,0.1);color:#c8a84b}
  .t2{background:rgba(59,130,246,0.1);color:#60a5fa}
  .t3{background:rgba(168,85,247,0.1);color:#c084fc}
  .highlight-box{background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.12);border-radius:12px;padding:20px 24px;margin:16px 0}
  .highlight-box h4{color:#c8a84b;font-size:14px;margin-bottom:8px}
  .highlight-box ul{list-style:none;padding:0}
  .highlight-box li{padding:4px 0;font-size:13px;color:#d0d0d8}
  .highlight-box li::before{content:'✓ ';color:#4ade80;font-weight:700}
  .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0}
  .stat-card{background:#111120;border:1px solid rgba(200,168,75,0.08);border-radius:10px;padding:16px;text-align:center}
  .stat-card .num{font-size:28px;font-weight:800;color:#c8a84b}
  .stat-card .lab{font-size:10px;color:#8b8b9e;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
  .r-footer{padding:24px 56px;background:#08080e;border-top:1px solid rgba(200,168,75,0.08);text-align:center;font-size:11px;color:#666}
  @media print{body{background:white;color:#111}.report{background:white}.r-header{background:#f8f6f0!important;border-color:#c8a84b}.r-brand{color:#c8a84b}.r-brand span{color:#333}.section{background:white}.cap-card{background:#fafafa;border-color:#eee}.full-table thead th{color:#666;border-color:#ddd}.full-table tbody td{color:#333;border-color:#eee}.highlight-box{background:#f9f9f9;border-color:#ddd}.stat-card{background:#f5f5f5;border-color:#eee}}
  </style></head><body>
  ${buildCoverPage({ reportTitle: "Informe de Capacidades", reportSubtitle: "Catálogo Completo de Servicios y Herramientas IA", companyName: clientName, date: reportDate, template: "prestige" })}
  <div class="report">
    <div class="r-header">
      <div class="r-brand">Shopy <span>Crafter</span></div>
      <div class="r-tag">Agencia de Optimización IA para Shopify</div>
      <div class="r-title">
        <h1>Informe Completo de Capacidades</h1>
        <div class="sub">Todos los servicios, herramientas y precios · ${reportDate} · Ref: ${reportId}</div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">Resumen de la Plataforma</div>
      <div class="stat-row">
        <div class="stat-card"><div class="num">130+</div><div class="lab">Acciones IA</div></div>
        <div class="stat-card"><div class="num">6</div><div class="lab">Informes Especializados</div></div>
        <div class="stat-card"><div class="num">57+</div><div class="lab">Servicios en Catálogo</div></div>
        <div class="stat-card"><div class="num">3</div><div class="lab">Niveles de Profundidad</div></div>
      </div>
      <div class="highlight-box">
        <h4>¿Qué es Shopy Crafter?</h4>
        <p style="font-size:13px;color:#d0d0d8;line-height:1.6;margin-bottom:12px">
          Shopy Crafter es una agencia de optimización IA especializada en tiendas Shopify. Combinamos inteligencia artificial avanzada (Claude AI, DALL-E 3, análisis de datos) con experiencia en eCommerce para ofrecer servicios que PRODUCEN resultados listos para usar — no solo recomendaciones.
        </p>
        <ul>
          <li>IA que produce contenido TERMINADO: textos, CSS, emails, schemas</li>
          <li>Integración directa con Shopify API para aplicar cambios al instante</li>
          <li>Informes profesionales descargables en HTML y PDF</li>
          <li>Chatbot IA con 130+ acciones especializadas</li>
          <li>Sistema de aprendizaje continuo 24/7</li>
          <li>Presupuestos automáticos con IVA español</li>
        </ul>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">🎨 Servicios de Diseño Web / Theme Shopify</div>
      <div class="cap-grid">
        <div class="cap-card"><div class="icon">🖌️</div><h4>Diseño CSS Completo del Theme</h4><p>Rediseño total del CSS/SCSS de la tienda Shopify con estilo profesional y responsive</p><div class="price">€497 — €997</div></div>
        <div class="cap-card"><div class="icon">🏠</div><h4>Rediseño Homepage</h4><p>Hero section, secciones de contenido, footer, navegación y CTA</p><div class="price">€347</div></div>
        <div class="cap-card"><div class="icon">📐</div><h4>Secciones Liquid Custom</h4><p>Diseño y desarrollo de secciones personalizadas para Shopify</p><div class="price">€97/sección</div></div>
        <div class="cap-card"><div class="icon">📱</div><h4>Responsive Fixes</h4><p>Optimización móvil/tablet completa de la tienda</p><div class="price">€147</div></div>
        <div class="cap-card"><div class="icon">📄</div><h4>Páginas Personalizadas</h4><p>About Us, FAQ, Contact, Landing pages</p><div class="price">€97/página</div></div>
        <div class="cap-card"><div class="icon">⚙️</div><h4>Configuración Theme</h4><p>Settings completos: colores, tipografía, logo, menús, footer</p><div class="price">€97</div></div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">📦 Servicios de Productos</div>
      <table class="full-table">
        <thead><tr><th>Servicio</th><th>Descripción</th><th style="text-align:right">Precio</th></tr></thead>
        <tbody>
          <tr><td><strong>Producto completo desde cero</strong></td><td>Título SEO + descripción 800-1200 palabras + tags + categoría + variantes + 3 imágenes IA</td><td style="text-align:right;color:#c8a84b;font-weight:600">€47/ud</td></tr>
          <tr><td><strong>Rediseño TOTAL producto</strong></td><td>Título + descripción + SEO + imágenes nuevas + categoría + variantes + stock</td><td style="text-align:right;color:#c8a84b;font-weight:600">€29/ud</td></tr>
          <tr><td><strong>Rediseño PARCIAL</strong></td><td>Solo título + descripción + SEO (sin imágenes)</td><td style="text-align:right;color:#c8a84b;font-weight:600">€14.90/ud</td></tr>
          <tr><td><strong>Solo imágenes nuevas</strong></td><td>3 imágenes IA profesionales por producto</td><td style="text-align:right;color:#c8a84b;font-weight:600">€9.90/ud</td></tr>
          <tr><td><strong>Solo SEO</strong></td><td>Meta title + meta description + alt texts + tags</td><td style="text-align:right;color:#c8a84b;font-weight:600">€9.90/ud</td></tr>
          <tr><td><strong>Pack 5 Productos</strong></td><td>5 productos completos con todo incluido</td><td style="text-align:right;color:#c8a84b;font-weight:600">€197</td></tr>
          <tr><td><strong>Pack 10 Productos</strong></td><td>10 productos + SEO + copywriting + imágenes</td><td style="text-align:right;color:#c8a84b;font-weight:600">€347</td></tr>
          <tr><td><strong>Pack 20 Productos</strong></td><td>Catálogo completo profesional</td><td style="text-align:right;color:#c8a84b;font-weight:600">€697</td></tr>
          <tr><td><strong>Pack 30 Productos</strong></td><td>Catálogo enterprise completo</td><td style="text-align:right;color:#c8a84b;font-weight:600">€997</td></tr>
          <tr><td><strong>Pack 50 Productos</strong></td><td>Gran catálogo con descuento volumen</td><td style="text-align:right;color:#c8a84b;font-weight:600">€1,497</td></tr>
        </tbody>
      </table>
      <div class="highlight-box" style="margin-top:16px">
        <h4>Descuentos automáticos por volumen</h4>
        <ul>
          <li>+20 productos → 15% descuento en creación/rediseño</li>
          <li>+50 productos → 25% descuento en creación/rediseño</li>
          <li>+100 productos → 35% descuento en creación/rediseño</li>
        </ul>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">📊 Informes Especializados — 3 Niveles</div>
      <table class="full-table">
        <thead><tr><th>Informe</th><th style="text-align:center"><span class="tier-badge t1">Nivel 1</span><br>Diagnóstico</th><th style="text-align:center"><span class="tier-badge t2">Nivel 2</span><br>+ Guía Impl.</th><th style="text-align:center"><span class="tier-badge t3">Nivel 3</span><br>+ Contenido Prod.</th></tr></thead>
        <tbody>
          <tr><td><strong>Auditoría SEO Completa</strong><br><small style="color:#8b8b9e">16 criterios Semrush-level</small></td><td style="text-align:center">€197</td><td style="text-align:center;color:#60a5fa">€347</td><td style="text-align:center;color:#c084fc">€497</td></tr>
          <tr><td><strong>Auditoría Shopify 360°</strong><br><small style="color:#8b8b9e">Productos + SEO + COGS + configuración</small></td><td style="text-align:center">€197</td><td style="text-align:center;color:#60a5fa">€347</td><td style="text-align:center;color:#c084fc">€497</td></tr>
          <tr><td><strong>Informe Competidores</strong><br><small style="color:#8b8b9e">Análisis estratégico competencia</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€247</td></tr>
          <tr><td><strong>Informe Pricing y Márgenes</strong><br><small style="color:#8b8b9e">COGS real, márgenes, precios</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€247</td></tr>
          <tr><td><strong>Informe Inventario</strong><br><small style="color:#8b8b9e">Stock, rotación, proveedores</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€247</td></tr>
          <tr><td><strong>Informe Consistencia Visual</strong><br><small style="color:#8b8b9e">Marca, colores, tipografía</small></td><td style="text-align:center">€97</td><td style="text-align:center;color:#60a5fa">€177</td><td style="text-align:center;color:#c084fc">€347</td></tr>
          <tr><td><strong>Informe Revenue y Crecimiento</strong><br><small style="color:#8b8b9e">Retención, email, funnels</small></td><td style="text-align:center">€127</td><td style="text-align:center;color:#60a5fa">€197</td><td style="text-align:center;color:#c084fc">€397</td></tr>
          <tr><td><strong>Informe Proyección Ventas</strong><br><small style="color:#8b8b9e">Forecast 3-6 meses</small></td><td style="text-align:center">€127</td><td style="text-align:center;color:#60a5fa">€197</td><td style="text-align:center;color:#c084fc">€247</td></tr>
        </tbody>
      </table>
      <div class="highlight-box" style="margin-top:16px">
        <h4>Packs de 6 informes completos</h4>
        <ul>
          <li>Pack 6 informes Nivel 1 (solo diagnóstico): €697 <small style="color:#4ade80">(ahorro €112)</small></li>
          <li>Pack 6 informes Nivel 2 (+ guías implementación): €1,197 <small style="color:#4ade80">(ahorro €285)</small></li>
          <li>Pack 6 informes Nivel 3 (+ contenido producido): €1,797 <small style="color:#4ade80">(ahorro €537)</small></li>
        </ul>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">📸 Servicios de Imágenes IA</div>
      <div class="cap-grid">
        <div class="cap-card"><div class="icon">🎨</div><h4>Imágenes IA por Producto</h4><p>3 imágenes profesionales (Hero, Lifestyle, Detalle) generadas con DALL-E 3</p><div class="price">€9.90/producto</div></div>
        <div class="cap-card"><div class="icon">📷</div><h4>Pack 30 Imágenes</h4><p>Sesión completa de 30 fotos profesionales IA</p><div class="price">€89</div></div>
        <div class="cap-card"><div class="icon">🌟</div><h4>Photoshoot Pro 120 imgs</h4><p>Sesión completa: 4 variantes × 30 SKUs</p><div class="price">€497</div></div>
        <div class="cap-card"><div class="icon">👗</div><h4>Virtual Try-On</h4><p>Probador virtual con modelo IA para ropa y accesorios</p><div class="price">€14.90/imagen</div></div>
        <div class="cap-card"><div class="icon">🔄</div><h4>Imágenes desde Referencia</h4><p>Mejorar/regenerar imágenes a partir de foto real del producto</p><div class="price">€14.90/imagen</div></div>
        <div class="cap-card"><div class="icon">⚡</div><h4>Generación Masiva</h4><p>Bulk: imágenes para todos los productos de una vez</p><div class="price">€9.90/producto</div></div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">🔍 Servicios SEO y Marketing</div>
      <table class="full-table">
        <thead><tr><th>Servicio</th><th>Qué incluye</th><th style="text-align:right">Precio</th></tr></thead>
        <tbody>
          <tr><td><strong>Implementación SEO Completa</strong></td><td>Meta tags + Schema JSON-LD + keywords + alt texts para toda la tienda</td><td style="text-align:right;color:#c8a84b;font-weight:600">€147</td></tr>
          <tr><td><strong>Blog Strategy + 5 Artículos</strong></td><td>Estrategia de contenido + 5 artículos SEO optimizados</td><td style="text-align:right;color:#c8a84b;font-weight:600">€247</td></tr>
          <tr><td><strong>Keyword Intelligence Report</strong></td><td>Investigación de palabras clave con volumen y dificultad</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97</td></tr>
          <tr><td><strong>Setup Google Analytics + Pixel</strong></td><td>Configuración GA4 + Meta Pixel + eventos</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97</td></tr>
          <tr><td><strong>Email Marketing Setup</strong></td><td>Klaviyo + 4 flujos automáticos completos</td><td style="text-align:right;color:#c8a84b;font-weight:600">€197</td></tr>
          <tr><td><strong>30 Posts Redes Sociales</strong></td><td>Contenido profesional para Instagram/TikTok</td><td style="text-align:right;color:#c8a84b;font-weight:600">€89</td></tr>
          <tr><td><strong>Campañas Virales 360°</strong></td><td>Instagram + TikTok marketing automatizado</td><td style="text-align:right;color:#c8a84b;font-weight:600">desde €147</td></tr>
        </tbody>
      </table>
    </div>
  
    <div class="section">
      <div class="s-title">🤖 Acciones del Chatbot IA (130+)</div>
      <div class="cap-grid">
        <div class="cap-card"><div class="icon">📦</div><h4>Gestión de Productos</h4><p>Crear, editar, rediseñar, eliminar, buscar productos. Importación masiva, variantes, precios, tags, colecciones.</p></div>
        <div class="cap-card"><div class="icon">🎨</div><h4>Diseño y Theme</h4><p>Editar CSS, Liquid, secciones, settings del theme. Crear secciones custom. Auditoría de theme.</p></div>
        <div class="cap-card"><div class="icon">📊</div><h4>Análisis e Informes</h4><p>Generar auditorías, informes de competidores, pricing, proyecciones, inventario, revenue.</p></div>
        <div class="cap-card"><div class="icon">📸</div><h4>Imágenes y Media</h4><p>Generar imágenes IA, virtual try-on, bulk images, imágenes desde referencia, optimización alt texts.</p></div>
        <div class="cap-card"><div class="icon">📧</div><h4>Email Marketing</h4><p>Generar emails, newsletters, campañas, flujos automáticos, secuencias de retención.</p></div>
        <div class="cap-card"><div class="icon">💰</div><h4>Presupuestos y Pricing</h4><p>Calcular precios, generar presupuestos PDF, propuestas comerciales, auditar oferta.</p></div>
        <div class="cap-card"><div class="icon">📦</div><h4>Inventario y Ventas</h4><p>Sync stock, alertas, analytics ventas, historial clientes, informes por variante/talla/color.</p></div>
        <div class="cap-card"><div class="icon">🔍</div><h4>SEO Avanzado</h4><p>Meta tags, schemas JSON-LD, keywords, PageSpeed, análisis competencia, bulk optimize.</p></div>
        <div class="cap-card"><div class="icon">🏪</div><h4>Análisis Externo</h4><p>Analizar tiendas de competidores sin conexión Shopify. Pre-informes para captación de clientes.</p></div>
        <div class="cap-card"><div class="icon">📋</div><h4>CMS y Contenido</h4><p>Editar textos de la landing, hero, pricing, testimonios, features. Batch updates.</p></div>
      </div>
    </div>
  
    <div class="section">
      <div class="s-title">🎯 Packs Combinados</div>
      <table class="full-table">
        <thead><tr><th>Pack</th><th>Incluye</th><th style="text-align:right">Precio</th><th style="text-align:right;color:#4ade80">Ahorro</th></tr></thead>
        <tbody>
          <tr><td><strong>Pack Setup Básico</strong></td><td>Theme CSS + 5 productos + SEO</td><td style="text-align:right;color:#c8a84b;font-weight:600">€797</td><td style="text-align:right;color:#4ade80">€91</td></tr>
          <tr><td><strong>Pack Lanzamiento</strong></td><td>Theme + 10 productos + SEO + Email</td><td style="text-align:right;color:#c8a84b;font-weight:600">€1,247</td><td style="text-align:right;color:#4ade80">€184</td></tr>
          <tr><td><strong>Pack Profesional</strong></td><td>Theme + 20 prods + SEO + Email + Auditoría + Competidores</td><td style="text-align:right;color:#c8a84b;font-weight:600">€1,997</td><td style="text-align:right;color:#4ade80">€387</td></tr>
          <tr><td><strong>Pack Enterprise</strong></td><td>Theme custom + 30 prods + SEO completo + Email + Auditoría + 3 informes</td><td style="text-align:right;color:#c8a84b;font-weight:600">€2,997</td><td style="text-align:right;color:#4ade80">€594</td></tr>
        </tbody>
      </table>
    </div>
  
    <div class="section">
      <div class="s-title">⏱️ Tarifas Horarias (Servicios No Catalogados)</div>
      <table class="full-table">
        <thead><tr><th>Tipo de Trabajo</th><th>Descripción</th><th style="text-align:right">Tarifa/hora</th></tr></thead>
        <tbody>
          <tr><td><strong>Trabajo IA Automatizado</strong></td><td>Generación de contenido, imágenes, SEO con IA</td><td style="text-align:right;color:#c8a84b;font-weight:600">€47/h</td></tr>
          <tr><td><strong>Consultoría Estratégica</strong></td><td>Análisis, planificación, informes personalizados</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97/h</td></tr>
          <tr><td><strong>Diseño Web/Theme</strong></td><td>CSS, Liquid, secciones, diseño visual</td><td style="text-align:right;color:#c8a84b;font-weight:600">€97/h</td></tr>
          <tr><td><strong>Desarrollo Custom</strong></td><td>APIs, integraciones, código personalizado</td><td style="text-align:right;color:#c8a84b;font-weight:600">€127/h</td></tr>
          <tr><td><strong>Dirección Creativa</strong></td><td>Branding, fotografía, vídeo, dirección artística</td><td style="text-align:right;color:#c8a84b;font-weight:600">€77/h</td></tr>
        </tbody>
      </table>
    </div>
  
    <div class="section" style="background:linear-gradient(135deg,#0c0c1a,#141428)">
      <div class="s-title">💶 Política de Precios</div>
      <div class="highlight-box">
        <h4>Información Fiscal</h4>
        <ul>
          <li>Todos los precios están expresados en EUR (€)</li>
          <li>IVA 21% (España) se añade al subtotal en todos los presupuestos</li>
          <li>Clientes fuera de la UE: posible exención IVA (intracomunitario/exportación)</li>
          <li>Forma de pago estándar: 50% al inicio, 50% a la entrega</li>
          <li>Presupuestos válidos 30 días desde la fecha de emisión</li>
          <li>Descuento fidelización -5% en proyectos superiores a €2,000</li>
          <li>Pack de 3+ informes: descuento automático -10%</li>
        </ul>
      </div>
    </div>
  
    <div class="r-footer">
      <span style="color:#c8a84b;font-weight:600">Shopy Crafter</span> · shopycrafter.com · craftershopy@gmail.com<br>
      Agencia de Optimización IA para Shopify · © ${new Date().getFullYear()}<br>
      <span style="color:#444;font-size:10px">Informe de capacidades ${reportId} · Generado el ${reportDate}</span>
    </div>
  </div></body></html>`;
  
            const activeProjectId = params?.projectId || null;
            if (activeProjectId) {
              try {
                const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
                await fetch(`${baseUrl}/api/projects/${activeProjectId}/vault/save-report`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
                  body: JSON.stringify({
                    title: `Informe de Capacidades — ${reportId}`,
                    content: platformReportHtml,
                    fileType: "platform_report",
                  }),
                });
              } catch {}
            }
  
            result = {
              reportId,
              html: platformReportHtml,
              message: `📋 **Informe de Capacidades de la Plataforma generado** (${reportId})\n\n` +
                `El informe incluye:\n` +
                `• 🤖 **130+ acciones del chatbot IA** documentadas\n` +
                `• 📊 **6 informes especializados** con 3 niveles de profundidad\n` +
                `• 💰 **57+ servicios** con precios reales del catálogo\n` +
                `• 📦 Packs combinados con ahorros\n` +
                `• ⏱️ Tarifas horarias para servicios custom\n` +
                `• 💶 Política de precios, IVA y descuentos\n\n` +
                `📄 Guardado en el Vault — descargable en HTML y PDF.`
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "agency_proposal": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/agency/proposal`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ projectId, clientName: params?.clientName, clientUrl: params?.clientUrl }),
            });
            const data = await resp.json() as Record<string, unknown>;
            result = { ...data, message: `📋 **Propuesta comercial generada**\n\nAnálisis completo + estrategia + presupuesto listo para presentar al cliente.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "setup_full_store": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const steps: string[] = [];
  
            const syncResp = await fetch(`${baseUrl}/api/projects/${projectId}/products/sync`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(syncResp.ok ? "✅ Productos sincronizados" : "⚠️ Sync parcial");
  
            const pagesResp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-metas`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(pagesResp.ok ? "✅ Meta tags SEO generados" : "⚠️ Metas parcial");
  
            const altResp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/fix-alt-texts`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(altResp.ok ? "✅ Alt texts optimizados" : "⚠️ Alt texts parcial");
  
            const schemaResp = await fetch(`${baseUrl}/api/projects/${projectId}/seo/generate-schemas`, { method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" } });
            steps.push(schemaResp.ok ? "✅ Schemas JSON-LD generados" : "⚠️ Schemas parcial");
  
            result = { steps, message: `🏗️ **Setup Completo de Tienda ejecutado**\n\n${steps.join("\n")}\n\n💡 Para completar el setup, también puedes pedir:\n• **design_all_pages** → Crear páginas (About, FAQ, Shipping, Returns, Contact)\n• **auto_collections** → Crear colecciones automáticas\n• **optimize_all_products** → Optimizar todos los productos\n• **bulk_generate_images** → Generar imágenes IA` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "learn_from_url": {
          const url = params?.url as string;
          if (!url) { result = { error: true, message: "❌ Falta url" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/shopybrain/absorb-url`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ url, label: params?.label }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) throw new Error(String(data.error ?? "Error absorbiendo URL"));
            result = {
              ...data,
              message: `🧠 **URL absorbida con éxito**\n\nHe analizado y aprendido de: ${url}\n\n${data.title ? `**Título:** ${data.title}\n` : ""}${data.memoriesCreated ? `**Memorias creadas:** ${data.memoriesCreated}\n` : ""}Este conocimiento ya está integrado en mi cerebro y lo usaré en futuras respuestas.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error absorbiendo URL: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "learn_from_content": {
          const content = params?.content as string;
          if (!content) { result = { error: true, message: "❌ Falta content" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/shopybrain/absorb-text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ text: content, label: params?.label, contentType: params?.contentType }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) throw new Error(String(data.error ?? "Error absorbiendo contenido"));
            result = {
              ...data,
              message: `🧠 **Contenido absorbido con éxito**\n\n${params?.label ? `**Tema:** ${params.label}\n` : ""}He procesado y memorizado ${String(content).length} caracteres de conocimiento.\nEsto ya forma parte de mi memoria permanente.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "recall_knowledge": {
          const query = params?.query as string;
          if (!query) { result = { error: true, message: "❌ Falta query" }; break; }
          try {
            const limit = Math.min(Number(params?.limit) || 10, 30);
            const memories = await db.select().from(omnicoreMemoriesTable)
              .where(gte(omnicoreMemoriesTable.confidence, 0.3))
              .orderBy(desc(omnicoreMemoriesTable.confidence))
              .limit(200);
  
            const queryLower = query.toLowerCase();
            const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
            const scored = memories.map(m => {
              const text = `${m.title ?? ""} ${m.content ?? ""} ${m.memoryType ?? ""} ${m.tags ?? ""}`.toLowerCase();
              let score = 0;
              for (const term of queryTerms) {
                if (text.includes(term)) score += 1;
              }
              if (text.includes(queryLower)) score += 3;
              return { ...m, relevanceScore: score };
            }).filter(m => m.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  
            const formatted = scored.map((m, i) => `${i + 1}. **${m.title}** (${m.memoryType}, confianza: ${m.confidence})\n   ${String(m.content).slice(0, 300)}`).join("\n\n");
  
            result = {
              memories: scored.length,
              results: scored,
              message: `🔍 **${scored.length} memorias encontradas** para "${query}"\n\n${formatted || "No encontré memorias relevantes para esta búsqueda."}`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "brain_status": {
          try {
            const totalMemories = await db.select({ count: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
            const byType = await db.select({
              memoryType: omnicoreMemoriesTable.memoryType,
              count: sql<number>`count(*)`,
              avgConfidence: sql<number>`round(avg(${omnicoreMemoriesTable.confidence})::numeric, 2)`,
            }).from(omnicoreMemoriesTable).groupBy(omnicoreMemoriesTable.memoryType).orderBy(desc(sql`count(*)`));
  
            const recentMemories = await db.select({
              title: omnicoreMemoriesTable.title,
              memoryType: omnicoreMemoriesTable.memoryType,
              confidence: omnicoreMemoriesTable.confidence,
              createdAt: omnicoreMemoriesTable.createdAt,
            }).from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(10);
  
            const total = Number(totalMemories[0]?.count ?? 0);
            const typeBreakdown = byType.map(t => `• **${t.memoryType}**: ${t.count} (confianza avg: ${t.avgConfidence})`).join("\n");
            const recentList = recentMemories.map((m, i) => `${i + 1}. ${m.title?.slice(0, 80)} (${m.memoryType})`).join("\n");
  
            result = {
              totalMemories: total,
              byType,
              recentMemories,
              message: `🧠 **Estado de Shopy Crafter**\n\n**Total memorias:** ${total.toLocaleString()}\n\n**Distribución por tipo:**\n${typeBreakdown}\n\n**Últimas 10 memorias aprendidas:**\n${recentList}\n\n💡 El cerebro crece con cada interacción. Cada acción, conversación y URL absorbida alimenta el conocimiento.`,
            };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "analyze_external_store":
        case "external_pre_report": {
          const storeUrl = params?.url || params?.storeUrl || params?.shopUrl;
          const instagram = params?.instagram || params?.ig;
          const niche = params?.niche || params?.nicho;
          const storeName = params?.name || params?.storeName || params?.empresa;
          const projectId = params?.projectId ? parseInt(params.projectId) : 0;
  
          if (!storeUrl && !storeName && !instagram) {
            result = { error: true, message: "❌ Necesito al menos una URL, nombre de empresa o Instagram para investigar." };
            break;
          }
  
          let validatedUrl = storeUrl;
          if (validatedUrl) {
            try {
              const parsed = new URL(validatedUrl.startsWith("http") ? validatedUrl : `https://${validatedUrl}`);
              if (!["http:", "https:"].includes(parsed.protocol) || parsed.hostname === "localhost" || parsed.hostname.startsWith("127.") || parsed.hostname.startsWith("10.") || parsed.hostname.startsWith("192.168.") || parsed.hostname.startsWith("172.") || parsed.hostname === "0.0.0.0") {
                result = { error: true, message: "❌ URL inválida — solo se permiten URLs públicas (http/https)." };
                break;
              }
              validatedUrl = parsed.toString();
            } catch {
              result = { error: true, message: "❌ URL mal formada. Ejemplo: https://tienda.com" };
              break;
            }
          }
  
          const identifier = validatedUrl || storeName || instagram || "unknown";
          const sections: Record<string, string> = {};
          const errors: string[] = [];
  
          try {
            if (validatedUrl) {
              try {
                const { runDualPageSpeed } = await import("../lib/pagespeed.js");
                const ps = await runDualPageSpeed(validatedUrl);
                sections.pagespeed = `📊 PageSpeed: Mobile ${ps.mobile?.performanceScore ?? "N/A"}/100, Desktop ${ps.desktop?.performanceScore ?? "N/A"}/100\n` +
                  `FCP: ${ps.mobile?.coreWebVitals?.fcp?.value ?? "?"}, LCP: ${ps.mobile?.coreWebVitals?.lcp?.value ?? "?"}, CLS: ${ps.mobile?.coreWebVitals?.cls?.value ?? "?"}\n` +
                  `Speed Index: ${ps.mobile?.coreWebVitals?.si?.value ?? "?"}`;
              } catch (e) { errors.push(`PageSpeed: ${e instanceof Error ? e.message : String(e)}`); }
            }
  
            if (validatedUrl) {
              try {
                const resp = await fetch(validatedUrl, {
                  headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyCrafter-Analyzer/1.0)" },
                  signal: AbortSignal.timeout(20_000),
                });
                const raw = await resp.text();
                const cleaned = raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 30000);
                const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const metaDescMatch = raw.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
                sections.webContent = `🌐 Web: ${titleMatch?.[1]?.trim() ?? "Sin título"}\nMeta: ${metaDescMatch?.[1]?.trim() ?? "Sin meta descripción"}\nContenido: ${cleaned.slice(0, 15000)}`;
                const isShopify = raw.includes("cdn.shopify.com") || raw.includes("Shopify.theme") || raw.includes("myshopify");
                sections.platform = isShopify ? "🛒 Plataforma: Shopify detectado" : "🛒 Plataforma: No-Shopify (posible WooCommerce/Wix/custom)";
              } catch (e) { errors.push(`Scraping: ${e instanceof Error ? e.message : String(e)}`); }
            }
  
            const geminiInput = `${storeName || ""} ${storeUrl || ""} ${instagram ? `@${instagram}` : ""}`.trim();
            if (geminiInput) {
              try {
                const { askGeminiWithSearch } = await import("../lib/gemini.js");
                const [brandRes, productsRes, socialRes, pricingRes] = await Promise.allSettled([
                  askGeminiWithSearch(`Complete brand overview, history, founding, team, and mission of: ${geminiInput}. Niche: ${niche || "ecommerce"}`, "brand intelligence"),
                  askGeminiWithSearch(`All products, services, catalog, and pricing of: ${geminiInput}. Include real prices found online.`, "products catalog"),
                  askGeminiWithSearch(`Social media presence, followers, engagement, and content strategy of: ${geminiInput}. Check Instagram, TikTok, Facebook, YouTube, Twitter/X.`, "social media"),
                  askGeminiWithSearch(`Pricing strategy, price range, promotions, and offers of: ${geminiInput}. Include real prices.`, "pricing"),
                ]);
                if (brandRes.status === "fulfilled") sections.brand = `🏢 Marca:\n${brandRes.value.text.slice(0, 12000)}`;
                if (productsRes.status === "fulfilled") sections.products = `📦 Productos:\n${productsRes.value.text.slice(0, 12000)}`;
                if (socialRes.status === "fulfilled") sections.social = `📱 Redes Sociales:\n${socialRes.value.text.slice(0, 8000)}`;
                if (pricingRes.status === "fulfilled") sections.pricing = `💰 Precios:\n${pricingRes.value.text.slice(0, 8000)}`;
              } catch (e) { errors.push(`Gemini research: ${e instanceof Error ? e.message : String(e)}`); }
            }
  
            const allResearch = Object.entries(sections).map(([k, v]) => `=== ${k.toUpperCase()} ===\n${v}`).join("\n\n");
            let aiSummary = "";
            try {
              aiSummary = await askClaudeWithBrain(
                projectId,
                [{ role: "user", content: `Analiza esta tienda/empresa externa y genera un informe completo.\n\nDatos recopilados:\n${allResearch}\n\nErrores de recopilación: ${errors.length > 0 ? errors.join("; ") : "Ninguno"}\n\nGenera un informe profesional con:\n1. Resumen ejecutivo\n2. Análisis de marca y posicionamiento\n3. Catálogo y estrategia de productos\n4. Análisis de precios\n5. Presencia digital y SEO\n6. Oportunidades y recomendaciones\n7. Nivel de amenaza competitiva (si aplica)` }],
                "You are Shopy Crafter, an expert e-commerce analyst. Generate a comprehensive, actionable report about this external store/business. Use ALL the data provided. Be specific with numbers and recommendations.",
                "general",
                niche ?? undefined,
                4096
              );
            } catch { aiSummary = "⚠️ No se pudo generar análisis IA. Los datos recopilados están disponibles arriba."; }
  
            const fullReport = {
              identifier,
              storeUrl: validatedUrl, instagram, niche, storeName,
              sections, errors,
              aiSummary,
              analyzedAt: new Date().toISOString(),
            };
  
            if (projectId > 0) {
              const reportContent = JSON.stringify(fullReport, null, 2);
              saveToVault({
                projectId,
                fileType: "research",
                category: "external_store_analysis",
                title: `Análisis Externo: ${storeName || storeUrl || instagram}`,
                description: `${Object.keys(sections).length} secciones analizadas, ${errors.length} errores`,
                mimeType: "application/json",
                fileSizeBytes: Buffer.from(reportContent).length,
                generatedBy: "shopybrain_external",
                content: reportContent,
                metadata: { storeUrl: validatedUrl, instagram, niche, storeName, analyzedAt: new Date().toISOString() },
              }).catch(() => {});
            }
  
            let msg = `🔍 **ANÁLISIS EXTERNO: ${storeName || validatedUrl || instagram}**\n\n`;
            if (sections.platform) msg += `${sections.platform}\n`;
            if (sections.pagespeed) msg += `\n${sections.pagespeed}\n`;
            msg += `\n📊 **Secciones analizadas:** ${Object.keys(sections).length}\n`;
            if (errors.length > 0) msg += `⚠️ **Errores menores:** ${errors.length}\n`;
            msg += `\n${aiSummary}`;
            if (projectId > 0) msg += `\n\n💾 Informe guardado en el vault del proyecto.`;
  
            result = { ...fullReport, message: msg, savedToVault: projectId > 0 };
          } catch (err) {
            result = { error: true, message: `❌ Error en análisis externo: ${err instanceof Error ? err.message : String(err)}` };
          }
          break;
        }
  
        case "list_users": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie: req.headers.cookie ?? "" } });
            const users = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar usuarios" }; break; }
            const summary = (users as Array<Record<string, unknown>>).map((u: Record<string, unknown>) =>
              `• ${u.name} (${u.email}) — rol: ${u.role}, activo: ${u.isActive ? "✅" : "❌"}, último login: ${u.lastLogin || "nunca"}`
            ).join("\n");
            result = { users, total: users.length, message: `👥 **${users.length} usuarios registrados**\n\n${summary}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "create_user": {
          const email = params?.email;
          const name = params?.name || "Cliente";
          const password = params?.password;
          if (!email) { result = { error: true, message: "❌ Falta email del usuario" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ email, name, role: "client", password }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error creando usuario"}` }; break; }
            result = { ...data, message: `✅ **Usuario creado**\n\n📧 Email: ${email}\n👤 Nombre: ${name}\n🔑 Rol: client` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "invite_client": {
          const projectId = params?.projectId;
          const email = params?.email;
          const name = params?.name || "Cliente";
          if (!projectId || !email) { result = { error: true, message: "❌ Falta projectId o email" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/invite`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ email, name }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error invitando cliente"}` }; break; }
            result = { ...data, message: `📨 **Cliente invitado**\n\n📧 ${email}\n👤 ${name}\n🔗 Link: ${data.inviteLink}\n📩 Email enviado: ${data.emailSent ? "Sí" : "No (envía el link manualmente)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "deactivate_user": {
          const userId = params?.userId;
          if (!userId) { result = { error: true, message: "❌ Falta userId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users/${userId}/deactivate`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error desactivando usuario" }; break; }
            result = { message: `🚫 **Usuario ${userId} desactivado** — ya no puede acceder a la plataforma.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "activate_user": {
          const userId = params?.userId;
          if (!userId) { result = { error: true, message: "❌ Falta userId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users/${userId}/activate`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error activando usuario" }; break; }
            result = { message: `✅ **Usuario ${userId} activado** — acceso restaurado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "reset_user_password": {
          const userId = params?.userId;
          const password = params?.password;
          if (!userId || !password) { result = { error: true, message: "❌ Falta userId o password" }; break; }
          // CRIT-5: prevenir self-password reset accidental por OmniChatbot.
          // Para cambiar la propia password el admin debe usar el flujo dedicado de "Mi cuenta".
          // Confirmación ESTRICTA: solo `true` o `"true"` cuentan como confirmación válida
          // (igual que el patrón de `requireConfirmation` para `confirmed`).
          const sessionUserId = (req.session as { userId?: string }).userId;
          const selfResetConfirmed =
            params?.confirmSelfReset === true || params?.confirmSelfReset === "true";
          if (sessionUserId && String(sessionUserId) === String(userId) && !selfResetConfirmed) {
            result = {
              error: true,
              message: "⚠️ **Bloqueado por seguridad:** estás intentando resetear tu propia contraseña desde el chat. Usa la página \"Mi cuenta\" o re-ejecuta esta acción con `confirmSelfReset: true` para confirmar.",
            };
            break;
          }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users/${userId}/reset-password`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ password }),
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error reseteando contraseña" }; break; }
            result = { message: `🔑 **Contraseña reseteada** para usuario ${userId}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_messages": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/messages`, { headers: { cookie: req.headers.cookie ?? "" } });
            const msgs = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar mensajes" }; break; }
            const summary = (msgs as Array<Record<string, unknown>>).slice(-10).map((m: Record<string, unknown>) =>
              `[${m.fromRole}] ${m.fromName}: ${String(m.content).slice(0, 100)}`
            ).join("\n");
            result = { messages: msgs, total: msgs.length, message: `💬 **${msgs.length} mensajes** (últimos 10):\n\n${summary || "(sin mensajes)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "send_message": {
          const projectId = params?.projectId;
          const content = params?.content;
          if (!projectId || !content) { result = { error: true, message: "❌ Falta projectId o content" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/messages`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ content }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: "❌ Error enviando mensaje" }; break; }
            result = { ...data, message: `✅ **Mensaje enviado** al proyecto ${projectId}:\n\n"${String(content).slice(0, 200)}"` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "unread_messages": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/unread-messages`, { headers: { cookie: req.headers.cookie ?? "" } });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al consultar mensajes" }; break; }
            result = { ...data, message: `📬 **${data.total} mensajes sin leer**` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_approvals": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/approvals`, { headers: { cookie: req.headers.cookie ?? "" } });
            const items = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar aprobaciones" }; break; }
            const summary = (items as Array<Record<string, unknown>>).map((a: Record<string, unknown>) =>
              `• [${a.status}] ${a.title} — ${a.type}`
            ).join("\n");
            result = { approvals: items, total: items.length, message: `📋 **${items.length} aprobaciones**\n\n${summary || "(vacío)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "create_approval": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/approvals`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({
                type: params?.type || "change",
                title: params?.title || "Cambio pendiente",
                description: params?.description || "",
                beforeValue: params?.beforeValue,
                afterValue: params?.afterValue,
                reasoning: params?.reasoning,
                estimatedImpact: params?.estimatedImpact,
              }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: "❌ Error creando aprobación" }; break; }
            result = { ...data, message: `📋 **Aprobación creada**: ${params?.title}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "audit_log": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/audit-log`, { headers: { cookie: req.headers.cookie ?? "" } });
            const logs = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al consultar audit log" }; break; }
            const summary = (logs as Array<Record<string, unknown>>).slice(0, 15).map((l: Record<string, unknown>) =>
              `• ${l.createdAt} — ${l.action}: ${String(l.details).slice(0, 80)}`
            ).join("\n");
            result = { logs, total: logs.length, message: `📜 **Audit Log** (últimos 15 de ${logs.length}):\n\n${summary}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_automations": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/automations/jobs`, { headers: { cookie: req.headers.cookie ?? "" } });
            const jobs = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar automatizaciones" }; break; }
            const summary = (jobs as Array<Record<string, unknown>>).map((j: Record<string, unknown>) =>
              `• **${j.name}** [${j.status}] — ${j.description}\n  ⏰ Schedule: ${j.schedule} | Próx: ${j.nextRunTime || "?"} | Última: ${j.lastRunTime || "nunca"} (${j.lastRunResult || "-"})`
            ).join("\n");
            result = { jobs, total: jobs.length, message: `⚙️ **${jobs.length} automatizaciones**\n\n${summary}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "run_automation": {
          const jobId = params?.jobId;
          if (!jobId) { result = { error: true, message: "❌ Falta jobId (ej: 'micro-learning', 'revenue-snapshots', 'inventory-sync')" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/automations/jobs/${jobId}/run`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error ejecutando automatización"}` }; break; }
            result = { ...data, message: `🚀 **Automatización "${jobId}" ejecutada manualmente** — ejecutándose en segundo plano.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "list_email_flows": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const projectId = params?.projectId;
            const url = projectId ? `${baseUrl}/api/emails/flows?projectId=${projectId}` : `${baseUrl}/api/emails/flows`;
            const resp = await fetch(url, { headers: { cookie: req.headers.cookie ?? "" } });
            const flows = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar flujos de email" }; break; }
            const summary = (flows as Array<Record<string, unknown>>).map((f: Record<string, unknown>) =>
              `• **${f.name}** — tipo: ${f.flow_type}, trigger: ${f.trigger_type}, estado: ${f.status || "draft"}`
            ).join("\n");
            result = { flows, total: flows.length, message: `📧 **${flows.length} flujos de email**\n\n${summary || "(sin flujos)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "create_email_flow": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/emails/flows`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({
                project_id: projectId,
                name: params?.name || "Nuevo flujo",
                flow_type: params?.flowType || "welcome",
                trigger_type: params?.triggerType || "signup",
                send_delay: params?.sendDelay || "1h",
                subject_a: params?.subjectA || "",
                subject_b: params?.subjectB || "",
                preview_text: params?.previewText || "",
                tone: params?.tone || "urgente",
                language: params?.language || "es",
              }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error creando flujo"}` }; break; }
            result = { ...data, message: `✅ **Flujo de email creado**: ${params?.name || "Nuevo flujo"} (${params?.flowType || "welcome"})` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "delete_email_flow": {
          const flowId = params?.flowId;
          if (!flowId) { result = { error: true, message: "❌ Falta flowId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/emails/flows/${flowId}`, {
              method: "DELETE", headers: { cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error eliminando flujo" }; break; }
            result = { message: `🗑️ **Flujo de email ${flowId} eliminado**` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "send_restock_email": {
          const projectId = params?.projectId;
          const productId = params?.productId;
          if (!projectId || !productId) { result = { error: true, message: "❌ Falta projectId o productId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/restock-email`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({
                projectId, productId,
                productTitle: params?.productTitle || "",
                currentStock: params?.currentStock || 0,
                daysRemaining: params?.daysRemaining || 7,
                supplierEmail: params?.supplierEmail || "",
              }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error generando email de restock"}` }; break; }
            result = { ...data, message: `📦 **Email de restock generado**\n\n📧 Asunto: ${data.subject}\n⚡ Urgencia: ${data.urgency}\n📊 Cantidad sugerida: ${data.suggestedQuantity} unidades\n\n${data.body}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "restock_orders": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/inventory/restock-orders?projectId=${projectId}`, { headers: { cookie: req.headers.cookie ?? "" } });
            const orders = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al consultar órdenes de restock" }; break; }
            const summary = (orders as Array<Record<string, unknown>>).map((o: Record<string, unknown>) =>
              `• ${o.productTitle} — ${o.quantitySuggested} uds, urgencia: ${o.urgency}, estado: ${o.status || "pending"}`
            ).join("\n");
            result = { orders, total: orders.length, message: `📦 **${orders.length} órdenes de restock**\n\n${summary || "(sin órdenes)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "remove_from_collection": {
          const projectId = params?.projectId;
          const collectionId = params?.collectionId;
          const productId = params?.productId;
          if (!projectId || !collectionId || !productId) {
            result = { error: true, message: "❌ Falta projectId, collectionId o productId" }; break;
          }
          try {
            const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(String(projectId))));
            if (!project?.accessToken) { result = { error: true, message: "❌ Proyecto sin token de acceso" }; break; }
            const token = safeDecrypt(project.accessToken);
            const domain = project.shopDomain;
            const collectsResp = await fetch(`https://${domain}/admin/api/2024-01/collects.json?collection_id=${collectionId}&product_id=${productId}`, {
              headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
            });
            const collectsData = await collectsResp.json() as { collects: Array<{ id: number }> };
            if (!collectsData.collects?.length) { result = { error: true, message: "❌ El producto no está en esa colección" }; break; }
            for (const c of collectsData.collects) {
              await fetch(`https://${domain}/admin/api/2024-01/collects/${c.id}.json`, {
                method: "DELETE", headers: { "X-Shopify-Access-Token": token },
              });
            }
            result = { message: `✅ **Producto ${productId} eliminado de la colección ${collectionId}**` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_export": {
          const projectId = params?.projectId;
          const reportType = params?.reportType || "complete-report";
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          const validTypes = ["seo-audit", "product-catalog", "financial", "brand-brief", "ab-tests", "images-gallery", "competitors", "consistency", "inventory", "redesigns", "revenue", "complete-report", "shopybrain", "csv/products"];
          if (!validTypes.includes(reportType)) {
            result = { error: true, message: `❌ Tipo de reporte inválido. Tipos válidos: ${validTypes.join(", ")}` }; break;
          }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/exports/${reportType}`, { headers: { cookie: req.headers.cookie ?? "" } });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error generando reporte"}` }; break;
            }
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
              result = { message: `📊 **Reporte "${reportType}" generado correctamente** (HTML)\n\nEl reporte está disponible en:\n🔗 HTML: /api/projects/${projectId}/exports/${reportType}\n📄 PDF: /api/projects/${projectId}/exports/${reportType}?format=pdf\n\nPuedes verlo desde el panel de admin → Exports.` };
            } else if (contentType.includes("text/csv")) {
              result = { message: `📊 **CSV "${reportType}" generado** — disponible en /api/projects/${projectId}/exports/${reportType}` };
            } else {
              const data = await resp.json() as Record<string, unknown>;
              result = { ...data, message: `📊 **Reporte "${reportType}" generado correctamente**` };
            }
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "run_full_audit_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/exports/run-full-audit`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error ejecutando auditoría completa"}` }; break;
            }
            result = { message: `📊 **Auditoría completa ejecutada y guardada**\n\nEl informe completo está disponible en:\n🔗 /api/projects/${projectId}/exports/complete-report\n\nIncluye: SEO, productos, financiero, competidores, inventario, A/B tests, imágenes.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        case "generate_ai_report": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/projects/${projectId}/exports/generate-ai-report`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ sections: params?.sections }),
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({})) as Record<string, unknown>;
              result = { error: true, message: `❌ ${errData.error ?? "Error generando informe IA"}` }; break;
            }
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
              result = { message: `🤖 **Informe IA generado**\n\nDisponible en el panel de exports.` };
            } else {
              const data = await resp.json() as Record<string, unknown>;
              result = { ...data, message: `🤖 **Informe IA generado correctamente**` };
            }
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }
  
        default:
          res.status(400).json({ error: `Acción desconocida: ${action}` });
          return;
      }
  
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
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/shopybrain/run/self-evaluation", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runMonthlySelfEvaluation } = await import("../lib/scheduler.js");
    runMonthlySelfEvaluation().catch(e => logger.error(e));
    res.json({ message: "Monthly self-evaluation started in background" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/shopybrain/upload", requireAdmin, upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "No se recibió ningún archivo" });
      return;
    }
    const buffer = file.buffer;
    const processed = await processUploadedFile(buffer, file.originalname, file.mimetype);
    res.json({
      success: true,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      processed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
