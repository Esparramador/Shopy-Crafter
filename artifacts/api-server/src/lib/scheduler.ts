import cron from "node-cron";
import { db } from "@workspace/db";
import {
  projectsTable, eventsTable, revenueSnapshotsTable,
  inventoryTrackingTable, competitorsTable, competitorSnapshotsTable, competitorAlertsTable,
  omnicoreMemoriesTable, omnicoreStudySessionsTable, omnicoreKnowledgeDomainsTable,
  omnicoreInsightsTable, omnicoreCrossConnectionsTable, platformSettingsTable,
} from "@workspace/db";
import { desc, eq, gte, sql, and, inArray } from "drizzle-orm";
import { businessDayBounds, businessYmd, previousBusinessYmd } from "./tz.js";
import { toLooseNumber } from "./ai-schema.js";
import { refreshToken, rotateToken, validateToken, shopifyRequest } from "./shopify.js";
import { safeDecrypt } from "./crypto.js";
import { askClaudeWithBrainDetailed, buildShopyBrainContext, type BrainUseCase } from "./claude.js";
import { generateAiJson } from "./ai-json.js";
import { isAiOutputError } from "./ai-errors.js";
import { askGeminiWithSearch } from "./gemini.js";
import { logger } from "./logger.js";
import { z } from "zod";
import { lenientArray, looseString, optionalLooseNumber } from "./ai-schema.js";
import { randomBytes } from "crypto";
import { sendEmail, isGmailAvailable } from "./gmail.js";
import { apiUsageLogTable } from "@workspace/db/schema";

// Fallback temporal a Gemini: antes un solo 429/"overloaded" pasajero dejaba
// TODOS los jobs en Gemini hasta reiniciar. Ahora caduca (1 h; 12 h si es falta
// de crédito, que no se arregla sola).
let geminiOnlyUntil = 0;
const isGeminiOnly = () => Date.now() < geminiOnlyUntil;

const selfEvaluationSchema = z.object({
  report: z.object({
    summary: z.string().min(1),
    keyMetrics: lenientArray(looseString),
    strengths: lenientArray(looseString),
    weaknesses: lenientArray(looseString),
    recommendations: lenientArray(looseString),
    knowledgeGaps: lenientArray(looseString),
    overallScore: optionalLooseNumber,
  }).passthrough(),
});
type SelfEvaluationReport = z.output<typeof selfEvaluationSchema>["report"];

type AiGenerateOpts = { system: string; prompt: string; maxTokens: number; timeoutMs?: number; useCase?: BrainUseCase; niche?: string };

/** Claude con ShopyBrain y, si Anthropic se queda sin crédito, Gemini. Devuelve si se cortó. */
async function aiGenerateDetailed(opts: AiGenerateOpts): Promise<{ text: string; truncated: boolean }> {
  if (!isGeminiOnly()) {
    try {
      const r = await askClaudeWithBrainDetailed(
        0,
        [{ role: "user", content: opts.prompt }],
        opts.system,
        opts.useCase ?? "general",
        opts.niche,
        opts.maxTokens,
        opts.timeoutMs ?? 120_000,
      );
      return { text: r.text, truncated: r.truncated };
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? err ?? "");
      if (msg.includes("credit balance") || msg.includes("billing") || msg.includes("overloaded") || (err as { status?: number })?.status === 429) {
        const creditIssue = msg.includes("credit balance") || msg.includes("billing");
        geminiOnlyUntil = Date.now() + (creditIssue ? 12 : 1) * 60 * 60 * 1000;
        log("ai-fallback", `⚠️ Anthropic ${creditIssue ? "sin crédito" : "saturado/429"} — jobs de IA en Gemini hasta ${new Date(geminiOnlyUntil).toISOString()}`);
      } else {
        throw err;
      }
    }
  }

  const result = await askGeminiWithSearch(opts.prompt, opts.system);
  log("ai-fallback", "📊 Gemini fallback used");
  return { text: result?.text ?? "", truncated: false };
}

/**
 * JSON validado para los crons de OmniCore. Antes: regex codiciosa + "reparaciones"
 * con replace (que tocaban también el contenido de las cadenas) y campos sin validar
 * (un newConfidence en texto guardaba NaN; un insight sin texto rompía el INSERT).
 * Ahora: extracción balanceada, esquema, un reintento y error tipado.
 */
async function aiGenerateJson<T>(opts: AiGenerateOpts, schema: z.ZodType<T, z.ZodTypeDef, unknown>, label: string): Promise<T> {
  return generateAiJson<T>({
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
    retryMaxTokens: opts.maxTokens * 2,
    schema,
    expect: "object",
    label: `scheduler/${label}`,
    call: ({ prompt, maxTokens }) => aiGenerateDetailed({ ...opts, prompt, maxTokens }),
  });
}

const confidence = optionalLooseNumber.transform(n => (n === undefined ? undefined : Math.max(0.1, Math.min(1, n))));
const studyInsightsSchema = z.object({
  insights: lenientArray(z.object({
    title: z.string().min(1),
    insight: z.string().min(1),
    confidence,
    memoryType: z.string().optional().catch(undefined),
    tags: lenientArray(looseString),
    domains: lenientArray(looseString),
    priority: z.string().optional().catch(undefined),
  })).refine(a => a.length > 0, { message: "sin insights válidos" }),
});
const crossConnectionsSchema = z.object({
  connections: lenientArray(z.object({
    fromDomain: z.string().min(1),
    toDomain: z.string().min(1),
    insight: z.string().min(1),
    synergy: z.string().default(""),
    confidence,
  })).refine(a => a.length > 0, { message: "sin conexiones válidas" }),
});
const retroEvaluationsSchema = z.object({
  evaluations: lenientArray(z.object({
    index: z.preprocess(v => (typeof v === "string" ? Number(v) : v), z.number().int().positive()),
    newConfidence: z.preprocess(v => (typeof v === "string" ? Number(v) : v), z.number().finite().min(0).max(1)),
    stillValid: z.boolean().optional().catch(undefined),
    notes: z.string().default(""),
  })).refine(a => a.length > 0, { message: "sin evaluaciones válidas" }),
});
const adaptiveStudySchema = z.object({
  insights: lenientArray(z.object({
    domain: z.string().min(1).catch("general"),
    content: z.string().min(1),
    confidence,
    tags: lenientArray(looseString),
    connectionTo: z.string().optional().catch(undefined),
  })).refine(a => a.length > 0, { message: "sin insights válidos" }),
});

function log(job: string, msg: string) {
  logger.info({ job }, msg);
}

function uid() { return randomBytes(8).toString("hex"); }

const ALL_DOMAINS: Record<string, string> = {
  ecommerce:            "eCommerce · CRO · UX · Conversión · Experiencia de compra",
  shopify_technical:    "Shopify Técnico · Liquid · APIs · Themes · Checkout · Metafields",
  financial_analysis:   "Finanzas · P&L · Cash Flow · Unit Economics · Break-even · KPIs financieros",
  trading_markets:      "Trading · Mercados Internacionales · Divisas · Tendencias Globales",
  investment:           "Inversión · Valoración de Negocios · Due Diligence · ROI · Capital",
  marketing:            "Marketing Digital · Branding · Storytelling · Funnels · Email · Estrategia de marca",
  sales:                "Ventas · Negociación · Psicología de ventas · Objeciones · Cierre",
  design_ux:            "Diseño · UX/UI · Tipografía · Color Theory · Layout · Accesibilidad · Motion Design",
  merchandising:        "Merchandising Visual · Producto · Packaging · Presentación · Escaparatismo",
  seo_content:          "SEO · Contenido · Copywriting · Blog · Arquitectura web · Schema · Keywords · Link Building",
  logistics:            "Logística · Stock · Fulfillment · Envíos · Cadena de suministro · Warehousing",
  paid_media:           "Paid Media · ROAS · Google Ads · Meta Ads · TikTok Ads · Retargeting · Attribution",
  consumer_psychology:  "Psicología del Consumidor · Neuromarketing · Behavioral Economics · Persuasión · Sesgos cognitivos",
  pricing_science:      "Pricing Science · Estrategias de precio · Elasticidad · Bundling · Descuentos · Anchoring",
  photography:          "Fotografía de Producto · Composición · Iluminación · Estilos · Props · Post-producción · Food Photography · Moda",
  video_content:        "Vídeo · Reels · TikTok · YouTube · UGC · Producción · Guiones · Storytelling visual",
  copywriting:          "Copywriting Persuasivo · Titulares · Descripciones · CTAs · Fórmulas (AIDA, PAS, BAB) · Tono de voz",
  social_media:         "Redes Sociales · Community Management · Calendario editorial · Engagement · Influencers · Virality",
  ai_technology:        "IA · Machine Learning · Automatización · Prompts · Generación de contenido · Computer Vision · LLMs",
  legal_compliance:     "Legal · GDPR · Cookies · Términos y condiciones · Propiedad intelectual · Normativa eCommerce",
  sustainability:       "Sostenibilidad · Packaging eco · Certificaciones · ESG · Comercio justo · Economía circular",
  customer_service:     "Atención al cliente · Chatbots · Retención · NPS · Fidelización · Post-venta · Reviews",
  analytics_data:       "Analytics · Google Analytics · Data Science · Dashboards · Métricas · Cohorts · Attribution",
  international:        "Internacionalización · Multiidioma · Multi-moneda · Localización · Mercados emergentes · Cross-border",
  trends_innovation:    "Tendencias · Innovación · Web3 · AR/VR · Live Shopping · Voice Commerce · Social Commerce",
  supply_chain:         "Proveedores · Sourcing · Alibaba · AliExpress · Fabricación · MOQ · Negociación con proveedores · Dropshipping",
  brand_strategy:       "Estrategia de Marca · Posicionamiento · Diferenciación · Propuesta de valor · Arquitectura de marca · Brand Equity",
  email_automation:     "Email Marketing · Automatización · Klaviyo · Segmentación · A/B Testing · Flows · Deliverability",
  marketplace:          "Marketplaces · Amazon · Etsy · eBay · Multi-canal · Omnichannel · Comparadores",
  taxes_accounting:     "Impuestos · Contabilidad · IVA · Facturación · Autónomos · SII · Modelos fiscales",
  "Conversion Rate Optimization":     "CRO · Tests A/B · Funnels · Optimización de conversión",
  "Copywriting & Product Descriptions": "Copywriting · Fichas de producto · SEO Copy · Storytelling comercial",
  "Email Marketing & Retention":       "Email Marketing · Retención · Flows · Klaviyo · Newsletters · Segmentación",
  "Mobile UX & Checkout":              "UX Móvil · Checkout · Responsive · App Commerce · PWA",
  "Pricing Psychology & Strategy":     "Psicología de Precios · Estrategia · Anchoring · Bundling · Descuentos",
  "Product Photography & Images":      "Fotografía · Imágenes de Producto · IA Visual · Composición · Lighting",
  "SEO & Product Discovery":           "SEO · Descubrimiento de Producto · Keywords · Schema · SERP · Google Shopping",
  "Social Proof & Reviews":            "Social Proof · Reviews · Testimonios · UGC · Trust · Ratings",
  "Upsell & Cross-sell Strategies":    "Upsell · Cross-sell · Bundles · AOV · Estrategias de Ticket Medio",
};

// ─── REVENUE SNAPSHOTS ───────────────────────────────────────────────────────
/** Pedidos que cuentan como venta (fuera cancelados, reembolsados, anulados o fallidos). */
export function isCountableOrder(status: string | undefined): boolean {
  const st = String(status ?? "").toLowerCase();
  if (/cancel|refund|void|fail|trash/.test(st)) return false;
  // PrestaShop: estados numéricos 6 cancelado, 7 reembolsado, 8 error de pago.
  if (st === "6" || st === "7" || st === "8") return false;
  return true;
}

async function fetchOrdersInWindow(
  conn: import("./connectors/types.js").IPlatformConnector, start: Date, end: Date,
): Promise<import("./connectors/types.js").PlatformOrder[]> {
  const withAll = conn as { listAllOrders?: (p: { after: string; before: string }) => Promise<import("./connectors/types.js").PlatformOrder[]> };
  if (typeof withAll.listAllOrders === "function") {
    return withAll.listAllOrders({ after: start.toISOString(), before: end.toISOString() });
  }
  const out: import("./connectors/types.js").PlatformOrder[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 200; page++) {
    // PrestaShop: su filtro de fechas no admite ISO ni doble rango → se pide
    // ordenado por fecha desc y se corta al salir de la ventana.
    const batch = conn.platformType === "prestashop"
      ? await conn.getOrders({ page, limit: pageSize })
      : await conn.getOrders({ page, limit: pageSize, after: start.toISOString(), before: end.toISOString() });
    out.push(...batch);
    if (batch.length < pageSize) break;
    // Orden descendente (PrestaShop): si ya pasamos el inicio de la ventana, parar.
    if (batch.every(o => new Date(o.createdAt).getTime() < start.getTime())) break;
  }
  return out;
}

async function runRevenueSnapshotsImpl() {
  log("revenue-snapshots", "Starting daily revenue snapshots");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      // Support all CMS platforms: Shopify (accessToken), WooCommerce (clientId), PrestaShop (clientSecret as apiKey)
      const p = project as Record<string, unknown>;
      if (!p.accessToken && !p.clientId && !p.clientSecret) continue;
      try {
        const { getProjectConnector } = await import("./platform-helper.js");
        const connector = await getProjectConnector(project.id);
        if (!connector || !connector.supportsFeature("orders")) continue;

        // Día CERRADO anterior en Europe/Madrid. Antes: últimas 24 h móviles
        // guardadas con la fecha UTC del día nuevo (mezclaba dos días), solo la
        // primera página y contando cancelados/reembolsados.
        const day = previousBusinessYmd();
        const { start, end } = businessDayBounds(day);
        const orders = (await fetchOrdersInWindow(connector, start, end))
          .filter(o => isCountableOrder(o.status))
          .filter(o => { const t = new Date(o.createdAt).getTime(); return t >= start.getTime() && t < end.getTime(); });
        const revenue = orders.reduce((sum, o) => sum + (Number.parseFloat(o.total ?? "0") || 0), 0);
        const data = { orders };
        const today = day;
        log("revenue-snapshots", `Project ${project.id} ${today}: €${revenue.toFixed(2)}, ${data.orders.length} orders`);
      } catch (err) {
        logger.warn({ projectId: project.id, err }, "Revenue snapshot failed for project");
      }
    }
    log("revenue-snapshots", "Complete");
  } catch (err) {
    logger.error({ err }, "Revenue snapshots job failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// Todos los productos de la tienda, paginando según la plataforma.
async function fetchAllPlatformProducts(conn: import("./connectors/types.js").IPlatformConnector): Promise<import("./connectors/types.js").PlatformProduct[]> {
  const withAll = conn as { listAllProducts?: () => Promise<import("./connectors/types.js").PlatformProduct[]> };
  if (typeof withAll.listAllProducts === "function") return withAll.listAllProducts();
  const out: import("./connectors/types.js").PlatformProduct[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 200; page++) {
    const batch = await conn.getProducts({ page, limit: pageSize });
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

// ─── INVENTORY SYNC ──────────────────────────────────────────────────────────
async function runInventorySyncImpl() {
  log("inventory-sync", "Starting daily inventory sync");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      // Support all CMS platforms: Shopify (accessToken), WooCommerce (clientId), PrestaShop (clientSecret as apiKey)
      const pInv = project as Record<string, unknown>;
      if (!pInv.accessToken && !pInv.clientId && !pInv.clientSecret) continue;
      try {
        const { getProjectConnector } = await import("./platform-helper.js");
        const invConnector = await getProjectConnector(project.id);
        if (!invConnector || !invConnector.supportsFeature("products")) continue;
        // Antes se forzaba el tipo a la forma cruda de Shopify (variant.id,
        // inventory_quantity…) sobre PlatformProduct: todo valía undefined, el
        // cálculo daba NaN y el job fallaba en todos los proyectos. Además solo
        // leía la primera página y filtraba por variantId sin proyecto.
        const allProducts = await fetchAllPlatformProducts(invConnector);
        const projectKey = String(project.id);
        for (const product of allProducts) {
          for (const variant of product.variants ?? []) {
            const variantId = String(variant.platformId);
            const qty = Number.isFinite(Number(variant.inventoryQuantity)) ? Number(variant.inventoryQuantity) : 0;
            const scope = and(eq(inventoryTrackingTable.projectId, projectKey), eq(inventoryTrackingTable.variantId, variantId));
            const [prev] = await db.select().from(inventoryTrackingTable).where(scope).limit(1);
            const velocity = prev ? Math.max(0, (prev.currentStock ?? 0) - qty) : 0;
            const newSold = (prev?.totalUnitsSold ?? 0) + velocity;
            const daysRemaining = velocity > 0 ? Math.round(qty / velocity) : null;
            const price = variant.price != null && variant.price !== "" ? Number.parseFloat(String(variant.price)) : NaN;
            const compareAt = variant.compareAtPrice ? Number.parseFloat(String(variant.compareAtPrice)) : NaN;
            const updateFields = {
              currentStock: qty,
              avgDailySales: velocity,
              totalUnitsSold: newSold,
              daysRemaining,
              productTitle: product.title,
              variantTitle: variant.title || "Default",
              sku: variant.sku || null,
              option1Value: variant.option1 || null,
              option2Value: variant.option2 || null,
              option3Value: variant.option3 || null,
              productType: product.productType || null,
              vendor: product.vendor || null,
              price: Number.isFinite(price) ? price : null,
              compareAtPrice: Number.isFinite(compareAt) ? compareAt : null,
              updatedAt: new Date(),
            };
            let status = "healthy";
            if (daysRemaining !== null && daysRemaining <= 7) status = "critical";
            else if (daysRemaining !== null && daysRemaining <= 14) status = "warning";
            if (prev) {
              await db.update(inventoryTrackingTable).set({ ...updateFields, status }).where(scope);
            } else {
              await db.insert(inventoryTrackingTable).values({
                id: randomBytes(8).toString("hex"),
                projectId: projectKey,
                productId: String(product.platformId),
                variantId,
                ...updateFields,
                status,
              }).onConflictDoNothing();
            }
            if (qty > 0 && qty <= 5) {
              const optDesc = [variant.option1, variant.option2, variant.option3].filter(Boolean).join("/");
              await db.insert(eventsTable).values({
                id: randomBytes(8).toString("hex"),
                projectId: projectKey,
                eventType: "stock_critical",
                payload: `Stock critico: ${product.title} ${optDesc ? `(${optDesc})` : ""} SKU:${variant.sku ?? variantId} — ${qty} uds`,
              }).catch(err => logger.warn({ err }, "stock_critical event insert failed"));
            }
          }
        }
      } catch (err) {
        logger.warn({ projectId: project.id, err }, "Inventory sync failed for project");
      }
    }
    log("inventory-sync", "Complete");
  } catch (err) {
    logger.error({ err }, "Inventory sync job failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── COMPETITOR SCANS ────────────────────────────────────────────────────────
async function runCompetitorScansImpl() {
  log("competitor-scan", "Starting daily competitor scans");
  try {
    const competitors = await db.select().from(competitorsTable);
    for (const competitor of competitors) {
      try {
        const { safeFetch } = await import("./web-scraper.js");
        const response = await safeFetch(competitor.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopifyAI-Monitor/1.0)" },
          signal: AbortSignal.timeout(30_000),
        });
        // Página de error/captcha: no se guarda como precio (generaba alertas falsas).
        if (!response.ok) {
          logger.warn({ competitorId: competitor.id, status: response.status }, "Competitor scan: respuesta no OK — omitido");
          continue;
        }
        const html = await response.text();
        const priceMatch = html.match(/["']price["']:\s*["']?([\d.,]+)["']?/i) ??
          html.match(/€\s*([\d.,]+)/) ?? html.match(/\$\s*([\d.,]+)/);
        // "1.299,00" y "1,299.00" → 1299 (antes 1.299 → falsas bajadas del 99 %).
        const parsed = priceMatch ? toLooseNumber(priceMatch[1]) : NaN;
        const price = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;

        await db.insert(competitorSnapshotsTable).values({
          id: randomBytes(8).toString("hex"),
          competitorId: competitor.id,
          priceMin: price,
          priceMax: price,
          priceMedian: price,
          rawData: html.slice(0, 5000),
          scannedAt: new Date(),
        });

        const prevSnaps = await db.select().from(competitorSnapshotsTable)
          .where(eq(competitorSnapshotsTable.competitorId, competitor.id))
          .orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(2);

        if (prevSnaps.length >= 2 && price !== null) {
          const prevPrice = prevSnaps[1]?.priceMin ?? 0;
          const changePct = prevPrice > 0 ? Math.abs((price - prevPrice) / prevPrice) * 100 : 0;
          if (changePct >= 5) {
            await db.insert(competitorAlertsTable).values({
              id: randomBytes(8).toString("hex"),
              competitorId: competitor.id,
              projectId: competitor.projectId,
              alertType: price < prevPrice ? "price_drop" : "price_increase",
              title: `${competitor.name}: precio ${price < prevPrice ? "bajó" : "subió"}`,
              description: `${competitor.name}: precio ${price < prevPrice ? "bajó" : "subió"} de €${prevPrice.toFixed(2)} a €${price.toFixed(2)} (${changePct.toFixed(1)}%)`,
              severity: changePct >= 15 ? "high" : "medium",
            });
          }
        }
        log("competitor-scan", `Scanned ${competitor.name}: €${price}`);
      } catch (err) {
        logger.warn({ competitorId: competitor.id, err }, "Competitor scan failed");
      }
    }
    log("competitor-scan", "Complete");
  } catch (err) {
    logger.error({ err }, "Competitor scan job failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── OMNICORE REAL DATA INTEGRATION ─────────────────────────────────────────
async function runOmnicoreRealDataIntegrationImpl() {
  log("omnicore-realdata", "Starting OmniCore real data integration");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      if (!project.storeNiche) continue;
      try {
        const snaps = await db.select().from(revenueSnapshotsTable)
          .where(eq(revenueSnapshotsTable.projectId, String(project.id)))
          .orderBy(desc(revenueSnapshotsTable.date)).limit(7);
        if (snaps.length < 2) continue;
        const totalRevenue = snaps.reduce((s, r) => s + (r.revenue ?? 0), 0);
        const avgRevenue = totalRevenue / snaps.length;
        const firstSnap = snaps[0];
        const lastSnap = snaps[snaps.length - 1];
        const trend = firstSnap && lastSnap
          ? (((firstSnap.revenue ?? 0) - (lastSnap.revenue ?? 0)) / Math.max(lastSnap.revenue ?? 1, 1)) * 100
          : 0;
        const content = `Tienda ${project.name} (${project.storeNiche}): revenue medio €${avgRevenue.toFixed(0)}/día. Tendencia 7 días: ${trend > 0 ? "+" : ""}${trend.toFixed(1)}%. ${trend > 5 ? "Crecimiento positivo detectado." : trend < -5 ? "Caída detectada — revisar estrategia." : "Revenue estable."}`;

        await db.insert(omnicoreMemoriesTable).values({
          id: `realdata-${project.id}-${Date.now()}`,
          memoryType: "ab_insight",
          niche: project.storeNiche,
          title: `Revenue insight — ${project.storeNiche}`,
          content,
          confidence: 0.75,
          sourceType: "automated_cron",
        }).onConflictDoNothing();
      } catch (err) {
        logger.warn({ projectId: project.id, err }, "OmniCore real data integration failed for project");
      }
    }
    log("omnicore-realdata", "Complete");
  } catch (err) {
    logger.error({ err }, "OmniCore real data integration job failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── OMNICORE MICRO-LEARNING (cada 3h) ───────────────────────────────────────
// Selecciona los 2 dominios con mayor antigüedad de estudio y genera 3 insights
// por dominio. Promueve los de alta confianza (≥0.82) a memorias permanentes.
async function runOmniCoreMicroLearningImpl() {
  log("omnicore-micro", "⚡ Micro-learning cycle starting");
  try {
    // Priorizar dominios sin sesión reciente (least-recently-studied first)
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable)
      .orderBy(sql`COALESCE(last_study_session, '1970-01-01'::timestamptz) ASC`)
      .limit(2);

    if (!domains.length) {
      log("omnicore-micro", "No domains found — skipping");
      return;
    }

    const brainCtxMicro = await buildShopyBrainContext(undefined, "ecommerce", "micro-learning ecommerce shopify optimization insights");

    for (const domain of domains) {
      try {
        const label = ALL_DOMAINS[domain.domain ?? ""] ?? domain.domain ?? "ecommerce";
        const prompt = `You are a world-class expert in ${label}. Your knowledge is UNIVERSAL — not limited to any single industry. Generate exactly 3 fresh, deeply researched, actionable insights that combine best practices from multiple industries and disciplines. Each insight must be specific, backed by real-world data or established frameworks, and immediately applicable to improve quality of content, strategy, or execution for an eCommerce agency managing Shopify stores. Think broadly: draw from psychology, neuroscience, art, architecture, fashion, technology, data science, behavioral economics, or ANY discipline that enriches the topic. Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.82,"memoryType":"pricing_pattern","tags":["tag1","tag2"]}]}`;

        const parsed = await aiGenerateJson({
          system: `You are OmniCore Micro-Learning Engine — an omniscient knowledge engine that learns from ALL disciplines and fields of human knowledge. Your mission is to accumulate the deepest, most actionable knowledge possible. You are NOT limited to eCommerce — you absorb wisdom from art, science, psychology, technology, design, business strategy, finance, law, marketing, photography, video, AI, data science, logistics, sustainability, and ANY other field relevant to creating exceptional content and strategy. Always connect knowledge to practical application. ${brainCtxMicro}`,
          prompt,
          maxTokens: 8192,
        }, studyInsightsSchema, `omnicore-micro:${domain.domain}`);

        for (const ins of parsed.insights ?? []) {
          const insId = `micro-${domain.id}-${uid()}`;
          const conf = ins.confidence ?? 0.75;

          await db.insert(omnicoreInsightsTable).values({
            id: insId,
            domain: domain.domain,
            insightType: "micro_learning",
            title: ins.title,
            insight: ins.insight,
            confidence: conf,
            source: "micro_learning_cron",
          }).onConflictDoNothing();

          if (conf >= 0.82) {
            await db.insert(omnicoreMemoriesTable).values({
              id: `mem-${insId}`,
              memoryType: ins.memoryType ?? "general",
              niche: "general",
              title: `[${domain.domain}] ${ins.title}`,
              content: ins.insight.slice(0, 4000),
              confidence: conf,
              sourceType: "micro_learning",
              tags: ins.tags ? JSON.stringify(ins.tags) : null,
            }).onConflictDoNothing();
          }
        }

        // Actualizar dominio: incrementar profundidad y marcar sesión
        const newDepth = Math.min(100, (domain.knowledgeDepth ?? 0) + 1);
        await db.update(omnicoreKnowledgeDomainsTable).set({
          knowledgeDepth: newDepth,
          totalInsights: sql`COALESCE(total_insights, 0) + ${(parsed.insights ?? []).length}`,
          lastStudySession: new Date(),
        }).where(eq(omnicoreKnowledgeDomainsTable.id, domain.id));

        log("omnicore-micro", `✅ ${domain.domain}: ${(parsed.insights ?? []).length} insights → depth ${newDepth}`);
      } catch (err) {
        logger.warn({ domainId: domain.id, err }, "Micro-learning failed for domain");
      }
    }
    log("omnicore-micro", "⚡ Micro-learning cycle complete");
  } catch (err) {
    logger.error({ err }, "Micro-learning job failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── OMNICORE MEMORY CONSOLIDATION (cada 6h) ────────────────────────────────
// Promueve insights recientes de alta confianza a memorias y refuerza
// las memorias de alto uso generadas en la última semana.
async function runOmniCoreMemoryConsolidationImpl() {
  log("omnicore-consolidate", "🧠 Memory consolidation starting");
  try {
    // Insights recientes con confianza ≥ 0.85
    const recent = await db.select().from(omnicoreInsightsTable)
      .where(gte(omnicoreInsightsTable.confidence, 0.85))
      .orderBy(desc(omnicoreInsightsTable.createdAt))
      .limit(30);

    let consolidated = 0;
    for (const ins of recent) {
      try {
        const inserted = await db.insert(omnicoreMemoriesTable).values({
          id: `consol-${ins.id}`,
          memoryType: "general",
          niche: "general",
          title: ins.title ?? "(sin título)",
          content: (ins.insight ?? "").slice(0, 4000),
          confidence: ins.confidence ?? 0.85,
          sourceType: "memory_consolidation",
        }).onConflictDoNothing().returning({ id: omnicoreMemoriesTable.id });
        // Solo cuenta lo realmente insertado (antes contaba también duplicados).
        if (inserted.length) consolidated++;
      } catch (err) { logger.warn({ err, insightId: ins.id }, "consolidation insert failed"); }
    }
    // Ya no se incrementa use_count desde el cron: inflaba el uso de memorias
    // nunca usadas y el estudio adaptativo las clasificaba como "fuertes".

    log("omnicore-consolidate", `🧠 Consolidation complete: ${consolidated} insights promoted`);
  } catch (err) {
    logger.error({ err }, "Memory consolidation failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── OMNICORE CROSS-DOMAIN SYNTHESIS (cada 12h) ──────────────────────────────
// Elige 3 dominios al azar y pide a Claude conexiones accionables entre ellos.
// Guarda las conexiones en omnicore_cross_connections y en memorias.
async function runOmniCoreCrossConnectionsImpl() {
  log("omnicore-cross", "🔗 Cross-domain synthesis starting");
  try {
    const allDomains = await db.select().from(omnicoreKnowledgeDomainsTable);
    if (allDomains.length < 2) { log("omnicore-cross", "Not enough domains — skipping"); return; }

    // 3 dominios aleatorios
    const shuffled = [...allDomains].sort(() => Math.random() - 0.5).slice(0, 3);
    const names = shuffled.map(d => ALL_DOMAINS[d.domain ?? ""] ?? d.domain);

    const brainCtx = await buildShopyBrainContext(undefined, "ecommerce", "shopify ecommerce optimization learning");
    const prompt = `Find 3 powerful hidden cross-domain insights connecting these knowledge areas: ${names.join(" | ")}. Each insight should reveal a non-obvious synergy — drawing from ANY discipline (neuroscience, art, architecture, behavioral economics, technology, culture, science, nature, music, etc.) that creates compounding value. The BEST cross-domain insights connect fields that nobody would think are related. Return ONLY valid JSON:
{"connections":[{"fromDomain":"domain_key","toDomain":"domain_key","insight":"...","synergy":"...","confidence":0.8}]}`;

    const parsed = await aiGenerateJson({
      system: `You are OmniCore Cross-Domain Synthesis Engine — a polymathic intelligence that discovers hidden connections between ANY knowledge domains. You draw from science, art, psychology, philosophy, technology, nature, mathematics, and the ENTIRE spectrum of human knowledge. The most valuable insights come from connecting seemingly unrelated fields. ${brainCtx}`,
      prompt,
      maxTokens: 8192,
    }, crossConnectionsSchema, "omnicore-cross");

    for (const conn of parsed.connections ?? []) {
      const crossId = `cross-${uid()}`;

      // Guardar la conexión usando los campos reales de la tabla (insightA, insightB)
      await db.insert(omnicoreCrossConnectionsTable).values({
        id: crossId,
        insightA: `[${conn.fromDomain}] ${conn.insight.slice(0, 200)}`,
        insightB: `[${conn.toDomain}] ${conn.synergy.slice(0, 200)}`,
        connectionType: "cross_domain_synergy",
        connectionStrength: conn.confidence ?? 0.7,
      }).onConflictDoNothing();

      // Promover a memoria
      await db.insert(omnicoreMemoriesTable).values({
        id: `cross-mem-${crossId}`,
        memoryType: "general",
        niche: "general",
        title: `Cross-insight: ${conn.fromDomain} × ${conn.toDomain}`,
        content: `${conn.insight} | Synergy: ${conn.synergy}`.slice(0, 4000),
        confidence: conn.confidence ?? 0.7,
        sourceType: "cross_domain_synthesis",
      }).onConflictDoNothing();
    }

    log("omnicore-cross", `🔗 Cross-synthesis complete: ${(parsed.connections ?? []).length} connections generated`);
  } catch (err) {
    logger.error({ err }, "Cross-domain synthesis failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── OMNICORE DAILY DEEP STUDY — TODOS LOS DOMINIOS (1am diario) ─────────────
// Cubre los 14 dominios en profundidad, generando 5 insights premium por dominio.
// Es el ciclo más exhaustivo: 70 insights/día máximo.
async function runOmniCoreDailyDeepStudyImpl() {
  log("omnicore-daily", "🎓 Daily deep study starting — all domains");
  // Fecha de negocio (Madrid) + sufijo único: dos ejecuciones el mismo día ya no comparten id.
  const sessionId = `daily-${businessYmd()}-${randomBytes(3).toString("hex")}`;
  let totalInsights = 0;

  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable);

    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "daily_deep_study",
      domainsStudied: JSON.stringify(domains.map(d => d.domain)),
      trigger: "cron_daily_1am",
    }).onConflictDoNothing();

    const brainCtxDaily = await buildShopyBrainContext(undefined, "ecommerce", "shopify ecommerce optimization learning");
    let consecutiveFails = 0;

    for (const domain of domains) {
      if (consecutiveFails >= 3) {
        log("omnicore-daily", "⚠️ Circuit breaker: 3 consecutive Claude failures — aborting cycle early");
        break;
      }
      try {
        const label = ALL_DOMAINS[domain.domain ?? ""] ?? domain.domain;
        const prompt = `You are a world-class authority in ${label}. Your knowledge spans ALL industries and disciplines — you draw from the BEST of every field to create the most complete understanding possible. Generate 5 premium, deeply researched insights that would be worth €500+/hour consulting advice. Each insight MUST:
1. Draw from real-world examples, scientific research, or proven frameworks from ANY field (not just eCommerce)
2. Include specific tactics, numbers, percentages, or methodologies
3. Connect cross-disciplinary knowledge (e.g., how neuroscience improves product photography, how architecture principles enhance UX, how behavioral economics shapes pricing)
4. Be immediately actionable for improving content quality, business strategy, or creative execution
Think like a polymath — combine wisdom from art, science, technology, psychology, business, design, finance, law, and culture. Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.87,"memoryType":"pricing_pattern"}]}`;

        const parsed = await aiGenerateJson({
          system: `You are OmniCore Daily Deep Study Engine — the most advanced autonomous learning system ever built. You are an OMNISCIENT POLYMATH that accumulates knowledge from EVERY discipline: art, architecture, neuroscience, behavioral economics, photography, cinematography, fashion, industrial design, data science, AI/ML, psychology, sociology, law, finance, logistics, sustainability, copywriting, storytelling, music theory, color science, material science, cultural anthropology, and more. Your mission: generate the deepest, most actionable knowledge that elevates the quality of every output — from product descriptions to pricing strategies to visual content. NEVER limit yourself to a single industry. The BEST insights come from connecting knowledge across disciplines. ${brainCtxDaily}`,
          prompt,
          maxTokens: 8192,
        }, studyInsightsSchema, `omnicore-daily:${domain.domain}`);
        consecutiveFails = 0;

        for (const ins of parsed.insights ?? []) {
          const insId = `daily-${domain.id}-${uid()}`;
          const conf = ins.confidence ?? 0.82;

          await db.insert(omnicoreInsightsTable).values({
            id: insId,
            domain: domain.domain,
            insightType: "daily_study",
            title: ins.title,
            insight: ins.insight,
            confidence: conf,
            source: "daily_deep_study",
          }).onConflictDoNothing();

          await db.insert(omnicoreMemoriesTable).values({
            id: `mem-${insId}`,
            memoryType: ins.memoryType ?? "general",
            niche: "general",
            title: `[Daily·${domain.domain}] ${ins.title}`,
            content: ins.insight.slice(0, 4000),
            confidence: conf,
            sourceType: "daily_deep_study",
          }).onConflictDoNothing();

          totalInsights++;
        }

        // Incrementar profundidad de conocimiento del dominio
        const newDepth = Math.min(100, (domain.knowledgeDepth ?? 0) + 3);
        await db.update(omnicoreKnowledgeDomainsTable).set({
          knowledgeDepth: newDepth,
          totalInsights: sql`COALESCE(total_insights, 0) + ${(parsed.insights ?? []).length}`,
          verifiedInsights: sql`COALESCE(verified_insights, 0) + ${Math.floor((parsed.insights ?? []).length * 0.7)}`,
          lastStudySession: new Date(),
        }).where(eq(omnicoreKnowledgeDomainsTable.id, domain.id));

        log("omnicore-daily", `✅ ${domain.domain}: ${(parsed.insights ?? []).length} insights → depth ${newDepth}`);
      } catch (err) {
        // Un JSON inutilizable no es un fallo de Claude: no cuenta para el circuit breaker.
        if (isAiOutputError(err)) consecutiveFails = 0;
        else consecutiveFails++;
        logger.warn({ domainId: domain.id, err, consecutiveFails }, "Daily study failed for domain");
      }
    }

    await db.update(omnicoreStudySessionsTable).set({
      insightsCreated: totalInsights,
      summary: `Daily deep study: ${totalInsights} insights across ${domains.length} domains`,
    }).where(eq(omnicoreStudySessionsTable.id, sessionId));

    log("omnicore-daily", `🎓 Daily deep study complete: ${totalInsights} insights across ${domains.length} domains`);
  } catch (err) {
    logger.error({ err }, "Daily deep study failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── OMNICORE MEGA-SYNTHESIS SEMANAL (Domingo medianoche) ────────────────────
// Síntesis de alto nivel que conecta los aprendizajes de la semana,
// genera perfiles de nicho actualizados y crea conexiones meta-cruzadas.
async function runOmniCoreMegaSynthesisImpl() {
  log("omnicore-mega", "🚀 Weekly mega-synthesis starting");
  // Fecha de negocio (Madrid) + sufijo único: dos ejecuciones el mismo día ya no comparten id.
  const sessionId = `mega-${businessYmd()}-${randomBytes(3).toString("hex")}`;
  let totalInsights = 0;

  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable);
    const topMemories = await db.select().from(omnicoreMemoriesTable)
      .orderBy(desc(omnicoreMemoriesTable.confidence)).limit(20);

    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "weekly_mega_synthesis",
      domainsStudied: JSON.stringify(domains.map(d => d.domain)),
      trigger: "cron_weekly_sunday",
    }).onConflictDoNothing();

    const memorySummary = topMemories.slice(0, 10).map(m => `• ${m.title}: ${(m.content ?? "").slice(0, 100)}`).join("\n");
    const brainCtx = await buildShopyBrainContext(undefined, "ecommerce", "shopify ecommerce optimization learning");

    const prompt = `Based on this week's accumulated knowledge across ALL domains, synthesize 8 meta-level MASTERCLASS insights that:
1. Connect knowledge from 3+ different disciplines (e.g., neuroscience + photography + pricing)
2. Reveal non-obvious compounding opportunities
3. Include specific, actionable frameworks with real numbers/percentages
4. Draw from the BEST of every field — art, science, psychology, technology, business, law, design, data
5. Are executive-level strategic insights worth implementing immediately

Recent top memories:
${memorySummary}

Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.92,"domains":["domain1","domain2"],"priority":"high"}]}`;

    let megaInsights: z.output<typeof studyInsightsSchema>["insights"] = [];
    try {
      const parsed = await aiGenerateJson({
        system: `You are OmniCore Mega-Synthesis Engine — the HIGHEST-LEVEL REASONING LAYER of the entire ShopyBrain system. You are an omniscient polymath that synthesizes an entire week of multi-domain, multi-disciplinary learning into strategic masterclass insights. You draw from EVERY field of human knowledge: science, art, psychology, technology, business, philosophy, neuroscience, behavioral economics, design, photography, cinematography, storytelling, music, architecture, material science, cultural studies, law, and beyond. Your insights are the kind that change businesses overnight. ${brainCtx}`,
        prompt,
        maxTokens: 8192,
        timeoutMs: 180_000,
      }, studyInsightsSchema, "omnicore-mega");
      megaInsights = parsed.insights;
    } catch (err) {
      if (!isAiOutputError(err)) throw err;
      log("omnicore-mega", "Respuesta de la IA inutilizable tras el reintento — sin insights esta semana");
    }

    for (const ins of megaInsights) {
      const insId = `mega-${uid()}`;
      const conf = ins.confidence ?? 0.9;

      await db.insert(omnicoreInsightsTable).values({
        id: insId,
        domain: ins.domains[0] ?? "general",
        insightType: "mega_synthesis",
        title: ins.title,
        insight: ins.insight,
        confidence: conf,
        source: "weekly_mega_synthesis",
      }).onConflictDoNothing();

      await db.insert(omnicoreMemoriesTable).values({
        id: `mem-${insId}`,
        memoryType: "mega_insight",
        niche: "general",
        title: `[MEGA] ${ins.title}`,
        content: ins.insight.slice(0, 4000),
        confidence: conf,
        sourceType: "mega_synthesis",
        tags: JSON.stringify(["mega", "strategic", ...ins.domains]),
      }).onConflictDoNothing();

      totalInsights++;
    }

    await db.update(omnicoreStudySessionsTable).set({
      insightsCreated: totalInsights,
      summary: `Weekly mega-synthesis: ${totalInsights} strategic insights from ${domains.length} domains`,
    }).where(eq(omnicoreStudySessionsTable.id, sessionId));

    log("omnicore-mega", `🚀 Mega-synthesis complete: ${totalInsights} strategic insights`);
  } catch (err) {
    logger.error({ err }, "Mega-synthesis failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── TOKEN AUTO-REFRESH ───────────────────────────────────────────────────────
// Cada hora revisa todos los proyectos y renueva el token si está caducado
// o le quedan menos de 2 horas de validez. Garantiza acceso continuo a la API.
async function runTokenRefreshImpl() {
  log("token-refresh", "🔑 Validating Shopify tokens for all projects");
  try {
    const projects = await db.select().from(projectsTable);
    let valid = 0;
    let rotated = 0;
    let failed = 0;
    let noToken = 0;

    for (const project of projects) {
      // Solo tiendas Shopify (antes se validaban también Woo/PrestaShop contra la API de Shopify).
      if (((project as { platformType?: string }).platformType ?? "shopify") !== "shopify") continue;
      if (!project.accessToken) {
        noToken++;
        logger.warn({ projectId: project.id, domain: project.shopDomain }, "Project has no access token");
        continue;
      }

      try {
        // Renovación preventiva si caduca en < 2 h (antes solo se validaba y el
        // token caducaba igualmente entre ejecuciones).
        const expiresSoon = !!project.tokenExpiresAt && new Date(project.tokenExpiresAt).getTime() < Date.now() + 2 * 3600 * 1000;
        const isValid = !expiresSoon && await validateToken(project.shopDomain, project.accessToken);
        if (isValid) {
          valid++;
          continue;
        }

        log("token-refresh", `⚠️ Token invalid for project ${project.id} (${project.shopDomain}) — attempting refresh via client_credentials`);
        const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
        try {
          await refreshToken(project.id, project.shopDomain, project.clientId, plainSecret);
          rotated++;
          log("token-refresh", `✅ Token refreshed: project ${project.id} (${project.shopDomain})`);
        } catch (refreshErr) {
          log("token-refresh", `⚠️ client_credentials failed, trying rotateToken as fallback`);
          const plainAccessToken = safeDecrypt(project.accessToken ?? "") || (project.accessToken ?? "");
          await rotateToken(project.id, project.shopDomain, project.clientId, plainSecret, plainAccessToken);
          rotated++;
          log("token-refresh", `✅ Token rotated (fallback): project ${project.id} (${project.shopDomain})`);
        }
      } catch (err) {
        failed++;
        logger.error(
          { projectId: project.id, domain: project.shopDomain, err },
          "Token invalid and rotation failed — manual update required"
        );
      }
    }

    log("token-refresh", `🔑 Done: ${valid} valid, ${rotated} rotated, ${failed} failed, ${noToken} missing`);
  } catch (err) {
    logger.error({ err }, "Token validation job failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── RETROACTIVE REANALYSIS (Domingo 3am) ────────────────────────────────────
// Re-evaluates insights older than 7 days using current knowledge context,
// updates confidence scores, and tracks retroactive versions.
async function runRetroactiveReanalysisImpl() {
  log("omnicore-retro", "🔄 Retroactive reanalysis starting");
  // Fecha de negocio (Madrid) + sufijo único: dos ejecuciones el mismo día ya no comparten id.
  const sessionId = `retro-${businessYmd()}-${randomBytes(3).toString("hex")}`;
  let updated = 0;

  try {
    const oldInsights = await db.select().from(omnicoreInsightsTable)
      .where(sql`created_at < NOW() - INTERVAL '7 days'`)
      .orderBy(sql`COALESCE(last_retroactive_update, '1970-01-01'::timestamptz) ASC`)
      .limit(30);

    if (!oldInsights.length) {
      log("omnicore-retro", "No insights older than 7 days — skipping");
      return;
    }

    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "retroactive_reanalysis",
      trigger: "cron_weekly_sunday_3am",
    }).onConflictDoNothing();

    const brainCtx = await buildShopyBrainContext(undefined, "ecommerce", "shopify ecommerce optimization learning");

    const batchSize = 10;
    for (let i = 0; i < oldInsights.length; i += batchSize) {
      const batch = oldInsights.slice(i, i + batchSize);
      const insightsSummary = batch.map((ins, idx) =>
        `${idx + 1}. [${ins.domain}] "${ins.title}" (confidence: ${ins.confidence}) — ${(ins.insight ?? "").slice(0, 200)}`
      ).join("\n");

      try {
        const parsed = await aiGenerateJson({
          system: `You are OmniCore Retroactive Analyst. You re-evaluate existing insights using the latest knowledge, data, and trends. Your job: assess if each insight is still valid, update confidence scores, and add notes on what has changed. Be rigorous and honest — lower confidence if evidence has weakened, raise it if new evidence supports it. ${brainCtx}`,
          prompt: `Re-evaluate these existing insights with your current knowledge. For each insight, determine:
1. Is it still accurate and relevant?
2. Has new evidence emerged that strengthens or weakens it?
3. What is the updated confidence score (0.0 to 1.0)?

Insights to re-evaluate:
${insightsSummary}

Return ONLY valid JSON:
{"evaluations":[{"index":1,"newConfidence":0.85,"stillValid":true,"notes":"Brief explanation of changes"}]}`,
          maxTokens: 8192,
        }, retroEvaluationsSchema, "omnicore-retro");

        for (const ev of parsed.evaluations) {
          const ins = batch[ev.index - 1];
          if (!ins) continue;

          const newConf = Math.max(0.1, Math.min(1.0, ev.newConfidence)); // validado: número 0-1 (antes podía guardar NaN)
          await db.update(omnicoreInsightsTable).set({
            confidence: newConf,
            retroactiveVersion: sql`COALESCE(retroactive_version, 0) + 1`,
            lastRetroactiveUpdate: new Date(),
            evidence: ev.notes ? `[Retro] ${ev.notes}` : ins.evidence,
            updatedAt: new Date(),
          }).where(eq(omnicoreInsightsTable.id, ins.id));

          updated++;
        }
      } catch (err) {
        logger.warn({ err }, "Retroactive reanalysis batch failed");
      }
    }

    await db.update(omnicoreStudySessionsTable).set({
      insightsUpdated: updated,
      retroactiveUpdates: updated,
      summary: `Retroactive reanalysis: ${updated} insights re-evaluated from ${oldInsights.length} candidates`,
    }).where(eq(omnicoreStudySessionsTable.id, sessionId));

    log("omnicore-retro", `🔄 Retroactive reanalysis complete: ${updated} insights updated`);
  } catch (err) {
    logger.error({ err }, "Retroactive reanalysis failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── MONTHLY SELF-EVALUATION (1st of each month) ────────────────────────────
// Aggregates learning stats, assesses prediction accuracy, identifies weak
// domains, and generates a performance report stored as a special insight.
async function runMonthlySelfEvaluationImpl() {
  log("omnicore-eval", "📊 Monthly self-evaluation starting");
  const sessionId = `eval-${new Date().toISOString().slice(0, 7)}`;

  try {
    const totalInsights = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable);
    const totalMemories = await db.select({ count: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable).orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));

    const recentInsights = await db.select().from(omnicoreInsightsTable)
      .where(sql`created_at > NOW() - INTERVAL '30 days'`)
      .orderBy(desc(omnicoreInsightsTable.createdAt));

    const avgConfidence = recentInsights.length > 0
      ? recentInsights.reduce((sum, i) => sum + (i.confidence ?? 0.5), 0) / recentInsights.length
      : 0;

    const retroUpdated = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable)
      .where(sql`last_retroactive_update > NOW() - INTERVAL '30 days'`);

    const sessions = await db.select().from(omnicoreStudySessionsTable)
      .where(sql`created_at > NOW() - INTERVAL '30 days'`);

    const totalSessionInsights = sessions.reduce((s, sess) => s + (sess.insightsCreated ?? 0), 0);

    const weakDomains = domains.filter(d => (d.knowledgeDepth ?? 0) < 30).slice(0, 5);
    const strongDomains = domains.filter(d => (d.knowledgeDepth ?? 0) >= 60).slice(0, 5);

    const crossConnections = await db.select({ count: sql<number>`count(*)` }).from(omnicoreCrossConnectionsTable);

    const stats = {
      totalInsights: Number(totalInsights[0]?.count ?? 0),
      totalMemories: Number(totalMemories[0]?.count ?? 0),
      insightsThisMonth: recentInsights.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      retroactiveUpdates: Number(retroUpdated[0]?.count ?? 0),
      studySessions: sessions.length,
      totalSessionInsights,
      crossConnections: Number(crossConnections[0]?.count ?? 0),
      weakDomains: weakDomains.map(d => d.domain),
      strongDomains: strongDomains.map(d => d.domain),
      domainCount: domains.length,
    };

    const brainCtx = await buildShopyBrainContext(undefined, "ecommerce", "shopify ecommerce optimization learning");

    let parsedEval: z.output<typeof selfEvaluationSchema> | null = null;
    try {
      parsedEval = await aiGenerateJson({
        system: `You are OmniCore Self-Evaluation Engine. You produce honest, data-driven monthly performance reports about the brain's learning progress. Be specific, use the numbers provided, and give actionable recommendations. Respond in Spanish. ${brainCtx}`,
        prompt: `Generate a monthly self-evaluation report for OmniCore Brain based on these stats:

${JSON.stringify(stats, null, 2)}

The report should include:
1. Resumen ejecutivo (2-3 frases)
2. Métricas clave del mes
3. Dominios fuertes y débiles
4. Precisión y confianza de insights
5. Áreas de mejora identificadas
6. Recomendaciones para el próximo mes

Return ONLY valid JSON:
{"report":{"summary":"...","keyMetrics":["metric1","metric2"],"strengths":["..."],"weaknesses":["..."],"recommendations":["..."],"overallScore":85,"knowledgeGaps":["..."]}}`,
        maxTokens: 8192,
      }, selfEvaluationSchema, "monthly-self-evaluation");
    } catch (err) {
      if (!isAiOutputError(err)) throw err;
      log("omnicore-eval", "Informe de la IA inutilizable tras el reintento — se guarda el resumen con las estadísticas");
    }

    // Si la IA no devuelve un informe válido se guarda solo el resumen con las
    // estadísticas reales (antes el fallo se tragaba en silencio y un campo que no
    // fuera lista rompía el spread de knowledgeGaps).
    const reportData: SelfEvaluationReport = parsedEval?.report ?? {
      summary: `Monthly stats: ${stats.insightsThisMonth} insights, ${stats.studySessions} sessions, avg confidence ${stats.avgConfidence}`,
      keyMetrics: [], strengths: [], weaknesses: [], recommendations: [], knowledgeGaps: [],
    };

    const reportInsightId = `eval-report-${sessionId}`;
    await db.insert(omnicoreInsightsTable).values({
      id: reportInsightId,
      domain: "general",
      insightType: "self_evaluation",
      title: `Auto-evaluación mensual — ${new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`,
      insight: JSON.stringify(reportData),
      confidence: 0.95,
      source: "monthly_self_evaluation",
    }).onConflictDoNothing();

    await db.insert(omnicoreMemoriesTable).values({
      id: `mem-${reportInsightId}`,
      memoryType: "self_evaluation",
      niche: "general",
      title: `[Eval] Auto-evaluación ${new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`,
      content: reportData.summary.slice(0, 4000),
      confidence: 0.95,
      sourceType: "monthly_self_evaluation",
      tags: JSON.stringify(["self_evaluation", "monthly", ...reportData.knowledgeGaps.slice(0, 3)]),
    }).onConflictDoNothing();

    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "monthly_self_evaluation",
      domainsStudied: JSON.stringify(domains.map(d => d.domain)),
      trigger: "cron_monthly_1st",
      insightsCreated: 1,
      summary: reportData.summary,
      keyDiscoveries: JSON.stringify(reportData.recommendations),
    }).onConflictDoNothing();

    log("omnicore-eval", `📊 Monthly self-evaluation complete. Score: ${reportData.overallScore ?? "N/A"}`);
  } catch (err) {
    logger.error({ err }, "Monthly self-evaluation failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── AI COST ALERT CHECK ─────────────────────────────────────────────────────
async function runAiCostAlertCheckImpl() {
  log("ai-cost-alert", "🔔 Checking monthly AI spend vs alert threshold");
  try {
    const settingKeys = [
      "ai_cost_alert_threshold_usd",
      "ai_cost_alert_email",
      "ai_cost_alert_enabled",
      "ai_cost_alert_last_sent",
    ];
    const rows = await db.select().from(platformSettingsTable)
      .where(inArray(platformSettingsTable.key, settingKeys));

    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;

    const thresholdUsd = parseFloat(s["ai_cost_alert_threshold_usd"] ?? "0") || 0;
    const alertEmail   = s["ai_cost_alert_email"] ?? "craftershopy@gmail.com";
    const enabled      = s["ai_cost_alert_enabled"] !== "false";

    if (!enabled || thresholdUsd <= 0) {
      log("ai-cost-alert", `⏭️ Skipped — enabled=${enabled}, threshold=$${thresholdUsd}`);
      return;
    }

    // Avoid sending more than once per day
    const lastSent = s["ai_cost_alert_last_sent"] ?? null;
    const today    = new Date().toISOString().slice(0, 10);
    if (lastSent === today) {
      log("ai-cost-alert", "⏭️ Already sent alert today");
      return;
    }

    // Monthly totals
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totals] = await db
      .select({
        costUsd: sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
        calls:   sql<number>`count(*)`,
      })
      .from(apiUsageLogTable)
      .where(gte(apiUsageLogTable.createdAt, monthStart));

    const spentUsd   = Number(totals.costUsd ?? 0);
    const pctUsed    = thresholdUsd > 0 ? (spentUsd / thresholdUsd) * 100 : 0;

    if (spentUsd < thresholdUsd) {
      log("ai-cost-alert", `✅ Within budget — $${spentUsd.toFixed(4)} / $${thresholdUsd} (${pctUsed.toFixed(1)}%)`);
      return;
    }

    if (!isGmailAvailable()) {
      log("ai-cost-alert", "⚠️ Gmail not available — cannot send alert");
      return;
    }

    // Most expensive provider this month
    const byProvider = await db
      .select({
        provider: apiUsageLogTable.provider,
        costUsd:  sql<number>`coalesce(sum(${apiUsageLogTable.costUsd}),0)`,
      })
      .from(apiUsageLogTable)
      .where(gte(apiUsageLogTable.createdAt, monthStart))
      .groupBy(apiUsageLogTable.provider)
      .orderBy(desc(sql`sum(${apiUsageLogTable.costUsd})`))
      .limit(5);

    const topProvider = byProvider[0];
    const monthLabel  = now.toLocaleString("es-ES", { month: "long", year: "numeric" });
    const subject     = `🚨 Alerta de presupuesto IA — ${monthLabel} superado ($${spentUsd.toFixed(2)})`;

    const providerRows = byProvider.map(p =>
      `<tr><td style="padding:7px 12px;color:#e8e0cc;">${p.provider}</td><td style="padding:7px 12px;color:#c8a84b;font-weight:700;text-align:right;">$${Number(p.costUsd).toFixed(4)}</td></tr>`
    ).join("");

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0f0f1a;color:#e8e0cc;padding:28px;border-radius:14px;">
  <div style="border-bottom:2px solid rgba(239,68,68,0.4);padding-bottom:16px;margin-bottom:22px;">
    <h1 style="margin:0;font-size:22px;color:#ef4444;">🚨 Alerta: Presupuesto IA Superado</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#888;">${monthLabel}</p>
  </div>

  <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:24px;">
    <div style="flex:1;min-width:140px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:16px 20px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Gasto Actual</div>
      <div style="font-size:26px;font-weight:700;color:#ef4444;">$${spentUsd.toFixed(4)}</div>
    </div>
    <div style="flex:1;min-width:140px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2);border-radius:10px;padding:16px 20px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Umbral Configurado</div>
      <div style="font-size:26px;font-weight:700;color:#c8a84b;">$${thresholdUsd.toFixed(2)}</div>
    </div>
    <div style="flex:1;min-width:140px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:16px 20px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">% del Umbral</div>
      <div style="font-size:26px;font-weight:700;color:#ef4444;">${pctUsed.toFixed(1)}%</div>
    </div>
  </div>

  ${topProvider ? `<p style="font-size:13px;color:#ccc;margin-bottom:12px;">Motor más caro: <strong style="color:#c8a84b;">${topProvider.provider}</strong> — $${Number(topProvider.costUsd).toFixed(4)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px;">
    <thead>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <th style="padding:7px 12px;color:#888;font-weight:600;text-align:left;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Motor</th>
        <th style="padding:7px 12px;color:#888;font-weight:600;text-align:right;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Coste USD</th>
      </tr>
    </thead>
    <tbody>${providerRows}</tbody>
  </table>

  <p style="font-size:12px;color:#666;margin:0;">Accede al panel <strong style="color:#c8a84b;">Costes IA</strong> para más detalles.</p>
  <p style="font-size:11px;color:#444;margin:16px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">Powered by Shopy Crafter · craftershopy@gmail.com</p>
</div>`;

    const sent = await sendEmail(alertEmail, subject, htmlBody);
    if (sent) {
      // Mark today as sent
      await db.insert(platformSettingsTable)
        .values({ key: "ai_cost_alert_last_sent", value: today, updatedAt: new Date() })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: today, updatedAt: new Date() } });
      log("ai-cost-alert", `✉️ Alert sent to ${alertEmail} — $${spentUsd.toFixed(4)} / $${thresholdUsd} (${pctUsed.toFixed(1)}%)`);
    } else {
      log("ai-cost-alert", "❌ Failed to send alert email");
    }
  } catch (err) {
    logger.error({ err }, "AI cost alert check failed");
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

// ─── REGISTRO DE TODOS LOS CRON JOBS ─────────────────────────────────────────
async function runAdaptiveStudyImpl() {
  log("adaptive-study", "🧠 Starting adaptive study session at 5:30am...");
  try {
    const recentMemories = await db
      .select({
        id: omnicoreMemoriesTable.id,
        content: omnicoreMemoriesTable.content,
        memoryType: omnicoreMemoriesTable.memoryType,
        niche: omnicoreMemoriesTable.niche,
        confidence: omnicoreMemoriesTable.confidence,
        tags: omnicoreMemoriesTable.tags,
        useCount: omnicoreMemoriesTable.useCount,
        createdAt: omnicoreMemoriesTable.createdAt,
      })
      .from(omnicoreMemoriesTable)
      .where(
        and(
          gte(omnicoreMemoriesTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          gte(omnicoreMemoriesTable.confidence, 0.3),
        )
      )
      .orderBy(desc(omnicoreMemoriesTable.createdAt))
      .limit(50);

    if (recentMemories.length < 3) {
      log("adaptive-study", "⏭️ Not enough recent memories for adaptive study, skipping");
      return;
    }

    const weakMemories = recentMemories.filter(m => (m.confidence ?? 0) < 0.6 || (m.useCount ?? 0) < 2);
    const strongMemories = recentMemories.filter(m => (m.confidence ?? 0) >= 0.7 && (m.useCount ?? 0) >= 3);

    const domainCounts: Record<string, number> = {};
    for (const m of recentMemories) {
      const d = m.memoryType ?? "general";
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }
    const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
    const underrepresented = sortedDomains.filter(([, c]) => c <= 2).map(([d]) => d);

    const studyFocus = weakMemories.length > strongMemories.length ? "reinforcement" : "expansion";

    const studyPrompt = `ShopyBrain Adaptive Study Session.
Focus: ${studyFocus === "reinforcement" ? "REFORZAR memorias débiles y llenar gaps" : "EXPANDIR conocimiento y buscar conexiones nuevas"}.

MEMORIAS DÉBILES (necesitan refuerzo — baja confianza o poco acceso):
${weakMemories.slice(0, 10).map(m => `- [${m.memoryType}] (conf: ${m.confidence}) ${String(m.content).slice(0, 200)}`).join("\n")}

MEMORIAS FUERTES (alto valor — buscar extensiones):
${strongMemories.slice(0, 5).map(m => `- [${m.memoryType}] ${String(m.content).slice(0, 200)}`).join("\n")}

DOMINIOS SUBREPRESENTADOS: ${underrepresented.join(", ") || "ninguno"}
DISTRIBUCIÓN POR DOMINIO: ${sortedDomains.map(([d, c]) => `${d}:${c}`).join(", ")}

TAREA: Genera exactamente 5 insights nuevos que:
1. Refuercen las memorias débiles con datos complementarios
2. Conecten memorias fuertes con dominios subrepresentados
3. Llenen gaps de conocimiento detectados
4. Cada insight debe tener valor práctico para optimizar tiendas e-commerce

Responde en JSON: { "insights": [{ "domain": "string", "content": "string", "confidence": 0.7, "tags": ["string"], "connectionTo": "string (dominio conectado)" }] }`;

    const parsed = await aiGenerateJson({
      system: "You are ShopyBrain's adaptive learning engine. Generate high-value cross-domain insights for e-commerce optimization. Always respond in Spanish. Return ONLY valid JSON.",
      prompt: studyPrompt,
      maxTokens: 4096,
      timeoutMs: 90_000,
    }, adaptiveStudySchema, "adaptive-study");
    const insights = parsed.insights;

    let savedCount = 0;
    for (const insight of insights.slice(0, 5)) {
      try {
        await db.insert(omnicoreInsightsTable).values({
          id: randomBytes(12).toString("hex"),
          domain: insight.domain ?? "general",
          insightType: "adaptive_study",
          title: `Adaptive: ${insight.content.slice(0, 80)}`,
          insight: insight.content,
          confidence: insight.confidence ?? 0.6,
          source: "adaptive_study_cron",
        });
        savedCount++;

        if (insight.connectionTo && insight.domain !== insight.connectionTo) {
          await db.insert(omnicoreCrossConnectionsTable).values({
            id: randomBytes(12).toString("hex"),
            insightA: `${insight.domain}:adaptive_study`,
            insightB: `${insight.connectionTo}:adaptive_study`,
            connectionType: "adaptive_study",
            connectionStrength: insight.confidence ?? 0.6,
          }).catch(() => {});
        }
      } catch { /* skip duplicate or error */ }
    }

    const sessionId = randomBytes(12).toString("hex");
    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "adaptive_study",
      domainsStudied: [...new Set(insights.map(i => i.domain))].join(", "),
      insightsCreated: savedCount,
      summary: `Adaptive study: focus=${studyFocus}, weak=${weakMemories.length}, strong=${strongMemories.length}, saved=${savedCount}`,
    }).catch(() => {});

    log("adaptive-study", `✅ Adaptive study complete: ${savedCount} insights saved, focus=${studyFocus}, weak=${weakMemories.length}, strong=${strongMemories.length}`);
  } catch (err) {
    log("adaptive-study", `❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    throw err; // el fallo global llega a quien lanzó el job (antes se informaba "success")
  }
}

export function registerCronJobs() {
  log("scheduler", "🕐 Registering 24/7 continuous learning jobs (timezone: Europe/Madrid)");

  // ── APRENDIZAJE CONTINUO ─────────────────────────────────────────────────
  // Cada 3 horas — Micro-learning: 2 dominios × 3 insights (16 ciclos/día)
  cron.schedule("0 */3 * * *", () => { runOmniCoreMicroLearning().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // Cada 6 horas — Memory consolidation: insights → memorias permanentes
  cron.schedule("30 */6 * * *", () => { runOmniCoreMemoryConsolidation().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // Cada 12 horas — Cross-domain synthesis: conexiones entre dominios
  cron.schedule("0 */12 * * *", () => { runOmniCoreCrossConnections().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 5:30am diario — Adaptive study: refuerza memorias débiles, conecta dominios
  cron.schedule("30 5 * * *", () => { runAdaptiveStudy().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── CICLOS DIARIOS ───────────────────────────────────────────────────────
  // 1am diario — Daily deep study: todos los dominios, 5 insights/dominio
  cron.schedule("0 1 * * *", () => { runOmniCoreDailyDeepStudy().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 2am diario — Revenue snapshots desde Shopify
  cron.schedule("0 2 * * *", () => { runRevenueSnapshots().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 3am diario — OmniCore real data integration (datos reales de tiendas)
  cron.schedule("0 3 * * *", () => { runOmnicoreRealDataIntegration().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 6am diario — Competitor price scans
  cron.schedule("0 6 * * *", () => { runCompetitorScans().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 7am diario — Inventory sync + alertas de stock crítico
  cron.schedule("0 7 * * *", () => { runInventorySync().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── SÍNTESIS SEMANAL ─────────────────────────────────────────────────────
  // Domingo 00:00 — Mega-synthesis: síntesis estratégica semanal de todos los dominios
  cron.schedule("0 0 * * 0", () => { runOmniCoreMegaSynthesis().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // Domingo 3am — Retroactive reanalysis: re-evaluate old insights
  cron.schedule("0 3 * * 0", () => { runRetroactiveReanalysis().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── EVALUACIÓN MENSUAL ────────────────────────────────────────────────────
  // 1st of each month 4am — Monthly self-evaluation report
  cron.schedule("0 4 1 * *", () => { runMonthlySelfEvaluation().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── TOKENS SHOPIFY ────────────────────────────────────────────────────────
  // Cada 20h — Renovar tokens Shopify (duran 24h, renovamos con 4h de margen)
  cron.schedule("5 */20 * * *", () => { runTokenRefresh().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // También ejecutar al arrancar para renovar tokens caducados tras reinicio
  setTimeout(() => { runTokenRefresh().catch(e => logger.error(e)); }, 10_000);

  // ── ALERTA DE PRESUPUESTO IA ──────────────────────────────────────────────
  // 8am diario — Compara gasto mensual vs umbral y envía email si lo supera
  cron.schedule("0 8 * * *", () => { runAiCostAlertCheck().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 4:30am diario — AI Model Intelligence: investiga nuevos modelos en todos los proveedores
  cron.schedule("30 4 * * *", () => {
    import("./ai-model-intelligence.js")
      .then(({ runAiModelResearch }) => runAiModelResearch())
      .catch(e => logger.error({ job: "ai-model-research" }, String(e)));
  }, { timezone: "Europe/Madrid" });

  log("scheduler", [
    "✅ 15 jobs registrados:",
    "  🔑 Tokens Shopify    → cada 20h (renovación con 4h margen)",
    "  ⚡ Micro-learning    → cada 3h  (2 dominios × 3 insights)",
    "  🧠 Consolidación     → cada 6h  (insights → memorias)",
    "  🔗 Cross-synthesis   → cada 12h (conexiones cruzadas)",
    "  🎓 Deep study        → 1am     (14 dominios × 5 insights)",
    "  📊 Revenue           → 2am     (snapshots Shopify)",
    "  📦 Real data         → 3am     (integración datos reales)",
    "  🧪 Adaptive study    → 5:30am  (refuerzo memorias + gaps)",
    "  🔍 Competidores      → 6am     (price scans)",
    "  📦 Inventario        → 7am     (sync + alertas stock)",
    "  🔔 Alerta presupuesto → 8am    (coste IA vs umbral mensual)",
    "  🤖 AI Model Research → 4:30am (investiga + actualiza catálogo modelos)",
    "  🚀 Mega-synthesis    → Dom 0am (síntesis estratégica semanal)",
    "  🔄 Retroanálisis     → Dom 3am (re-evaluar insights antiguos)",
    "  📊 Auto-evaluación   → 1º/mes  (informe mensual de rendimiento)",
  ].join("\n"));
}

// ── Ejecución única por job ──────────────────────────────────────────────────
// Cron, botones de /shopybrain/run/*, automations y el warmup de arranque
// disparan los mismos jobs sin coordinarse: un doble clic o un clic a la hora
// del cron lanzaba dos tandas de llamadas IA en paralelo (coste e insights
// duplicados). Mientras un job corre, las llamadas siguientes reciben la misma
// promesa en vez de lanzar otra ejecución.
const runningJobs = new Map<string, Promise<unknown>>();
export function singleFlight<T>(name: string, fn: () => Promise<T>): () => Promise<T> {
  return () => {
    const running = runningJobs.get(name) as Promise<T> | undefined;
    if (running) {
      log("scheduler", `${name} ya en ejecución — se reutiliza la ejecución en curso`);
      return running;
    }
    const p = fn().finally(() => runningJobs.delete(name));
    runningJobs.set(name, p);
    return p;
  };
}
export function isJobRunning(name: string): boolean {
  return runningJobs.has(name);
}

export const runRevenueSnapshots = singleFlight("runRevenueSnapshots", runRevenueSnapshotsImpl);
export const runInventorySync = singleFlight("runInventorySync", runInventorySyncImpl);
export const runCompetitorScans = singleFlight("runCompetitorScans", runCompetitorScansImpl);
export const runOmnicoreRealDataIntegration = singleFlight("runOmnicoreRealDataIntegration", runOmnicoreRealDataIntegrationImpl);
export const runOmniCoreMicroLearning = singleFlight("runOmniCoreMicroLearning", runOmniCoreMicroLearningImpl);
export const runOmniCoreMemoryConsolidation = singleFlight("runOmniCoreMemoryConsolidation", runOmniCoreMemoryConsolidationImpl);
export const runOmniCoreCrossConnections = singleFlight("runOmniCoreCrossConnections", runOmniCoreCrossConnectionsImpl);
export const runOmniCoreDailyDeepStudy = singleFlight("runOmniCoreDailyDeepStudy", runOmniCoreDailyDeepStudyImpl);
export const runOmniCoreMegaSynthesis = singleFlight("runOmniCoreMegaSynthesis", runOmniCoreMegaSynthesisImpl);
export const runTokenRefresh = singleFlight("runTokenRefresh", runTokenRefreshImpl);
export const runRetroactiveReanalysis = singleFlight("runRetroactiveReanalysis", runRetroactiveReanalysisImpl);
export const runMonthlySelfEvaluation = singleFlight("runMonthlySelfEvaluation", runMonthlySelfEvaluationImpl);
export const runAiCostAlertCheck = singleFlight("runAiCostAlertCheck", runAiCostAlertCheckImpl);
export const runAdaptiveStudy = singleFlight("runAdaptiveStudy", runAdaptiveStudyImpl);
