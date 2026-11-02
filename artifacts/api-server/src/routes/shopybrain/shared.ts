// Helpers compartidos del cerebro (ShopyBrain): rutas, acciones y utilidades.
// Extraídos de routes/shopybrain.ts sin cambios de lógica.
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicoreKnowledgeDomainsTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { ShopifyAuthError } from "../../lib/shopify.js";
import { learnFromOperation } from "../../lib/claude.js";
import { askGeminiWithSearch } from "../../lib/gemini.js";
import { logger } from "../../lib/logger.js";
import { aiOutputErrorMessage, isAiOutputError } from "../../lib/ai-errors.js";
import { lenientArray, looseNumber, looseString, optionalLooseNumber, parseResearchJson } from "../../lib/ai-schema.js";
import { z } from "zod";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { uploadRejected } from "../../lib/upload-errors.js";


export function handleRouteError(res: any, err: any): void {
  if (err instanceof ShopifyAuthError) {
    const isUninstalled = String(err.message).includes("app_not_installed");
    const isUnavailable = String(err.message).includes("store unavailable") || String(err.message).includes("Token generation failed (404)");
    const userMsg = isUninstalled
      ? "La app de Shopify fue desinstalada. Ve a tu panel de Shopify y reinstala la app, luego reconecta la tienda."
      : isUnavailable
        ? "La tienda de Shopify no está disponible. Verifica el estado de tu tienda en el panel de Shopify."
        : "La conexión con Shopify expiró. Reconecta tu tienda en Configuración.";
    res.status(422).json({ error: userMsg, shopify_auth_error: true });
    return;
  }
  if (isAiOutputError(err)) {
    res.status(502).json({ error: aiOutputErrorMessage(err), code: err.code });
    return;
  }
  const msg = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: msg });
}

export type ReportTemplate = "classic" | "elegance" | "prestige";
export const VALID_TEMPLATES = new Set<ReportTemplate>(["classic", "elegance", "prestige"]);
export function parseTemplate(val: unknown): ReportTemplate {
  if (typeof val === "string" && VALID_TEMPLATES.has(val as ReportTemplate)) return val as ReportTemplate;
  return "prestige";
}

export function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.env.REPL_HOME || "/home/runner/workspace";
}
export const WORKSPACE_ROOT = findWorkspaceRoot();
export const FRONTEND_ROOT = path.resolve(WORKSPACE_ROOT, "artifacts/shopify-optimizer");
export const BACKEND_ROOT = path.resolve(WORKSPACE_ROOT, "artifacts/api-server");
export const FRONTEND_SRC = path.resolve(FRONTEND_ROOT, "src");

export const UPLOADS_DIR = path.resolve(BACKEND_ROOT, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|pdf|csv|xlsx|xls|json|txt|md|html|css|xml|zip)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(uploadRejected("Tipo de archivo no permitido"));
  },
});

export function isPublicUrl(urlStr: string): boolean {
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

export function isInsideWorkspace(candidate: string): boolean {
  try {
    const real = fs.realpathSync(candidate);
    const rel = path.relative(WORKSPACE_ROOT, real);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  } catch {
    const rel = path.relative(WORKSPACE_ROOT, candidate);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  }
}

export function resolveFilePath(filePath: string): string | null {
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


// modify_ui: cambios de código propuestos por la IA.
export const uiChangesSchema = z.object({
  files: z.array(z.object({
    filePath: z.string().min(1),
    changes: z.array(z.object({
      oldCode: z.string().min(1),
      newCode: z.string(),
      description: z.string().optional().catch(undefined),
    })).min(1),
  })).min(1),
  summary: z.string().optional().catch(undefined),
});

// Sesión de estudio (/shopybrain/study).
export const scoreField = (fallback: number) => optionalLooseNumber.transform(n => Math.max(0, Math.min(1, n ?? fallback)));
export const studySessionSchema = z.object({
  insights: lenientArray(z.object({
    domain: z.string().min(1).optional().catch(undefined),
    insightType: z.string().min(1).catch("principle"),
    title: z.string().min(1),
    insight: z.string().min(1),
    evidence: z.string().optional().catch(undefined),
    confidence: scoreField(0.6),
    impactScore: scoreField(0.5),
    relatedDomains: lenientArray(looseString),
  })).refine(a => a.length > 0, { message: "sin insights válidos" }),
  summary: z.string().optional().catch(undefined),
  keyDiscoveries: lenientArray(looseString),
});

// Brand book (execute-action generate_brand_book). Lo mínimo para no renderizar un
// manual vacío; el resto de secciones pasan tal cual y el render ya tolera que falten.
export const brandBookSchema = z.object({
  brandName: z.string().min(1),
  tagline: z.string().default(""),
  mission: z.string().min(1),
  vision: z.string().default(""),
  brandStory: z.string().min(1),
  values: z.array(z.object({
    name: z.string(),
    description: z.string().default(""),
    icon: z.string().default(""),
  }).passthrough()).min(1),
  colorPalette: z.array(z.object({
    name: z.string(),
    hex: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "hex inválido"),
    usage: z.string().default(""),
    psychology: z.string().default(""),
  }).passthrough()).min(1),
}).passthrough();

// Precio de mercado con Gemini + búsqueda. Antes se usaba sin validar: un
// "suggestedPrice" en texto ("29,99") hacía fallar el .toFixed() de quien lo usa.
export const realPricingSchema = z.object({
  competitorPrices: lenientArray(z.object({
    source: looseString,
    price: looseNumber.transform(String),
    url: z.string().optional().catch(undefined),
  })),
  marketPriceRange: z.object({ min: looseNumber, max: looseNumber, median: looseNumber }).optional().catch(undefined),
  suggestedPrice: optionalLooseNumber,
  suggestedCompareAtPrice: optionalLooseNumber,
  pricingStrategy: z.string().optional().catch(undefined),
});

export async function researchRealPricing(productTitle: string, productType: string, niche: string, currentPrice?: string): Promise<{
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

    const parsed = parseResearchJson(geminiResult.text, realPricingSchema, "shopybrain/researchRealPricing");
    if (!parsed) return defaultResult;
    const result = {
      marketPriceRange: parsed.marketPriceRange ?? defaultResult.marketPriceRange,
      competitorPrices: parsed.competitorPrices,
      suggestedPrice: parsed.suggestedPrice ?? defaultResult.suggestedPrice,
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

export const DOMAIN_LABELS: Record<string, string> = {
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
  stripe_payments:      "Stripe · Pagos · Pasarelas · Connect · Billing · Radar · Fraud",
  payment_orchestration:"Orquestación de Pagos · Multi-gateway · 3DS · SCA · PSD2 · Settlement",
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
  campaign_production:                 "Campaign Production · Video Campaigns · UGC · Storyboard · Lip Sync · Voice-Over · Master Cut · Narrative Flow (7-step: UGC→Deconstrucción→Exploded→Assembly→Try-on→Macro→CTA)",
  exploded_view:                       "Exploded View Studio · Product Deconstruction · Assembly · Parallel Prompts · Seedance Pro · Kling v2.1 · Runway Gen-4 · Veo 3 · Hailuo 02 · Clip-Type Prompt Templates",
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

export async function ensureDomains() {
  return ensureAllKnowledgeDomains();
}
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

export function learnFromConversation(userQuery: string, aiResponse: string, niche?: string, detectedActionName?: string): void {
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

export function buildEnrichedLearningContent(action: string, params: Record<string, unknown>, result: Record<string, unknown>): { title: string; content: string; confidence: number; extraTags: string[] } {
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
