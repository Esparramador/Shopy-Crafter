import { Router } from "express";
import { logger } from "../lib/logger.js";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { projectsTable, productsTable, cogsTable, priceHistoryTable, abTestsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude";
import { askGeminiWithSearch, isGeminiSearchBlocked } from "../lib/gemini.js";
import { updateCogsBenchmark } from "../lib/cogs-benchmarks.js";
import { enableLongRunning } from "../lib/long-running.js";
import { getProjectConnector } from "../lib/platform-helper.js";
import { fetchOrdersInWindow, isCountableOrder } from "../lib/orders.js";
import { z } from "zod";
import { lenientArray, looseNumber, looseString, optionalLooseNumber, parseResearchJson } from "../lib/ai-schema.js";

const router = Router();

// Respuestas de Gemini con búsqueda. Antes se mezclaban sin validar
// ({ ...defaults, ...JSON.parse }): un campo que no fuera lista rompía el .map
// y un precio "12,50 €" acababa como NaN en los cálculos.
const marketRangeSchema = z.object({ min: looseNumber, max: looseNumber, median: looseNumber });
const competitorResearchSchema = z.object({
  competitorPrices: lenientArray(z.object({
    source: looseString,
    price: looseNumber.transform(String),
    url: z.string().optional(),
    productName: z.string().optional(),
  })),
  marketPriceRange: marketRangeSchema.optional().catch(undefined),
  marketPosition: z.string().optional().catch(undefined),
  pricingStrategy: z.string().optional().catch(undefined),
});
const supplierPriceResearchSchema = z.object({
  supplierPrices: lenientArray(z.object({
    supplier: looseString,
    priceRange: looseString,
    moq: looseString.optional().catch(undefined),
    origin: z.string().optional().catch(undefined),
  })),
  avgSupplierCost: optionalLooseNumber,
  supplierInsight: z.string().optional().catch(undefined),
});
const materialResearchSchema = z.object({
  materials: lenientArray(z.object({ material: looseString, priceRange: looseString, source: looseString.default(""), url: z.string().optional().catch(undefined) })),
  avgMaterialCost: optionalLooseNumber,
  insight: z.string().optional().catch(undefined),
});
const shippingResearchSchema = z.object({
  carriers: lenientArray(z.object({ carrier: looseString, domestic: looseString, international: looseString.default(""), source: looseString.default("") })),
  insight: z.string().optional().catch(undefined),
});
const cogsSupplierResearchSchema = z.object({
  suppliers: lenientArray(z.object({ supplier: looseString, priceRange: looseString, moq: looseString.optional().catch(undefined), origin: z.string().optional().catch(undefined), url: z.string().optional().catch(undefined) })),
  avgCost: optionalLooseNumber,
  insight: z.string().optional().catch(undefined),
});
const packagingResearchSchema = z.object({
  items: lenientArray(z.object({ item: looseString, pricePerUnit: looseNumber, source: looseString.default("") })),
  totalPackagingCost: optionalLooseNumber,
  insight: z.string().optional().catch(undefined),
});

/** Quita las claves `undefined` para que no pisen los valores por defecto al mezclar. */
function definedOnly<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const FINANCIAL_ANALYST_SYSTEM = `You are a senior financial analyst and pricing strategist with 20 years experience in e-commerce and retail economics. You combine:

ECONOMICS: Price elasticity, supply/demand curves, market equilibrium, consumer surplus, willingness-to-pay theory.
FINANCE: Contribution margin, gross margin, EBITDA, break-even analysis, unit economics, LTV/CAC ratio.
STRATEGY: Porter's Five Forces applied to pricing, competitive moats, price positioning.
PSYCHOLOGY: Anchoring effect, charm pricing, decoy pricing, bundle psychology, perceived value, scarcity pricing.
SHOPIFY SPECIFICS: Shopify fee structures, payment processor margins, return rate benchmarks, seasonal pricing patterns.

Always show your reasoning with specific numbers. Never give vague advice. Respond in Spanish.`;

function calculateCogs(data: Record<string, any>): {
  totalCogs: number; totalCogsWithVat: number;
  breakEvenPrice: number; breakEvenPriceWithVat: number;
  minimumViablePrice: number;
} {
  const n = (k: string) => parseFloat(data[k]) || 0;
  const price = n("finalPrice");

  const production = n("unitCost") + n("materialCost") + n("fabricCost") + n("printingCost")
    + n("screenPrintingCost") + n("moldAmortization") + n("assemblyCost")
    + n("laborCostPerUnit") + n("qualityControlCost");

  const packaging = n("packagingCost") + n("labelCost");

  const logistics = n("shippingCostDomestic") + n("shippingCostInternational")
    + n("fulfillmentFee") + n("warehouseCostPerUnit") + n("customsDuty") + n("insuranceCost");

  const returns = n("returnRate") * (n("returnProcessingCost") + n("returnShippingCost") + n("returnRestockingCost"));

  const platform = (price * n("shopifyPaymentFee")) + n("shopifyPlanCostPerOrder")
    + n("paymentProcessingFee") + n("platformCommission");

  const marketing = n("cac") + n("affiliateFee") + n("digitalMarketingCost")
    + n("influencerCostPerUnit") + n("seoCostPerUnit");

  const professional = n("consultingFee") + n("legalCostPerUnit")
    + n("aiApiCostPerUnit") + n("designCostPerUnit");

  const overhead = n("overheadPerUnit");

  const customItems = Array.isArray(data.customCosts)
    ? data.customCosts.reduce((sum: number, item: any) => sum + (parseFloat(item?.cost) || 0), 0)
    : 0;

  const totalCogs = production + packaging + logistics + returns + platform + marketing + professional + overhead + customItems;

  const vatRate = data.vatRate != null ? n("vatRate") : 0.21;
  const totalCogsWithVat = totalCogs * (1 + vatRate);

  return {
    totalCogs: Math.round(totalCogs * 100) / 100,
    totalCogsWithVat: Math.round(totalCogsWithVat * 100) / 100,
    breakEvenPrice: Math.round(totalCogs * 100) / 100,
    breakEvenPriceWithVat: Math.round(totalCogsWithVat * 100) / 100,
    minimumViablePrice: Math.round(totalCogs * 1.15 * 100) / 100,
  };
}

function _psychologicalPrice(price: number): number {
  if (price < 10) return Math.floor(price) - 0.01 + 1;
  if (price < 20) return Math.floor(price) + 0.95;
  if (price < 50) return Math.round(price / 5) * 5 - 0.05;
  if (price < 100) return Math.round(price / 10) * 10 - 0.01;
  if (price < 500) return Math.round(price / 10) * 10 - 1;
  return Math.round(price / 50) * 50 - 1;
}

router.get("/projects/:projectId/products/:productId/cogs", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const [cogs] = await db
      .select()
      .from(cogsTable)
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  
    if (!cogs) {
      res.json({ productId: shopifyProductId, totalCogs: 0, totalCogsWithVat: 0, breakEvenPrice: 0, breakEvenPriceWithVat: 0, minimumViablePrice: 0 });
      return;
    }
  
    const { id, createdAt, updatedAt, lastCompetitorAnalysis, lastPricingRecommendation, ...rest } = cogs;
    res.json({ productId: cogs.shopifyProductId, ...rest });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/products/:productId/cogs", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const input = req.body;
    const calc = calculateCogs(input);
    const n = (k: string) => parseFloat(input[k]) || 0;
  
    const values = {
      projectId, shopifyProductId,
      unitCost: n("unitCost"), packagingCost: n("packagingCost"), labelCost: n("labelCost"),
      shippingCostDomestic: n("shippingCostDomestic"), shippingCostInternational: n("shippingCostInternational"),
      fulfillmentFee: n("fulfillmentFee"), returnRate: input.returnRate != null ? n("returnRate") : 0.08,
      returnProcessingCost: n("returnProcessingCost"), shopifyPaymentFee: input.shopifyPaymentFee != null ? n("shopifyPaymentFee") : 0.015,
      shopifyPlanCostPerOrder: n("shopifyPlanCostPerOrder"),
      cac: n("cac"), affiliateFee: n("affiliateFee"), overheadPerUnit: n("overheadPerUnit"),
      materialCost: n("materialCost"), fabricCost: n("fabricCost"),
      printingCost: n("printingCost"), screenPrintingCost: n("screenPrintingCost"),
      moldAmortization: n("moldAmortization"), assemblyCost: n("assemblyCost"),
      laborCostPerUnit: n("laborCostPerUnit"), qualityControlCost: n("qualityControlCost"),
      warehouseCostPerUnit: n("warehouseCostPerUnit"), customsDuty: n("customsDuty"),
      insuranceCost: n("insuranceCost"), paymentProcessingFee: n("paymentProcessingFee"),
      platformCommission: n("platformCommission"),
      digitalMarketingCost: n("digitalMarketingCost"), influencerCostPerUnit: n("influencerCostPerUnit"),
      seoCostPerUnit: n("seoCostPerUnit"),
      vatRate: input.vatRate != null ? n("vatRate") : 0.21, corporateTaxRate: n("corporateTaxRate"),
      consultingFee: n("consultingFee"), legalCostPerUnit: n("legalCostPerUnit"),
      aiApiCostPerUnit: n("aiApiCostPerUnit"), designCostPerUnit: n("designCostPerUnit"),
      customCosts: Array.isArray(input.customCosts) ? input.customCosts : [],
      notes: input.notes ?? null,
      totalCogs: calc.totalCogs, totalCogsWithVat: calc.totalCogsWithVat,
      breakEvenPrice: calc.breakEvenPrice, breakEvenPriceWithVat: calc.breakEvenPriceWithVat,
      minimumViablePrice: calc.minimumViablePrice,
    };
  
    const [existing] = await db.select({ id: cogsTable.id }).from(cogsTable)
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  
    if (existing) {
      await db.update(cogsTable).set(values)
        .where(eq(cogsTable.id, existing.id));
    } else {
      await db.insert(cogsTable).values(values);
    }
  
    res.json({ productId: shopifyProductId, ...values });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

async function fetchRealCompetitorData(url: string): Promise<{
  url: string;
  price: number | null;
  brand: string | null;
  htmlSnippet: string | null;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.5",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { url, price: null, brand: null, htmlSnippet: `HTTP ${res.status}` };
    const html = await res.text();

    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[0].slice(0, 600)).join("\n").slice(0, 1500);
    const metaPrices = (html.match(/<meta[^>]+(og:price:amount|itemprop="price"|product:price:amount)[^>]*>/gi) ?? []).join("\n");
    const priceSpans = (html.match(/<[^>]*(class|id)="[^"]*price[^"]*"[^>]*>[^<]{1,30}<\/[^>]+>/gi) ?? []).slice(0, 5).join("\n");

    const htmlSnippet = [jsonLdBlocks, metaPrices, priceSpans].filter(Boolean).join("\n---\n").slice(0, 2000) || null;

    const pricePatterns = [
      /"price":\s*"?(\d+(?:[.,]\d{1,2})?)"?/,
      /content="(\d+(?:\.\d{1,2})?)"[^>]*(?:og:price:amount|itemprop="price")/i,
      /(?:og:price:amount|itemprop="price")[^>]*content="(\d+(?:\.\d{1,2})?)"/i,
      /"amount":\s*"(\d+(?:\.\d{1,2})?)"/,
      /"price":\s*(\d+(?:\.\d{1,2})?)\s*[,}]/,
    ];
    let price: number | null = null;
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        const raw = parseFloat(m[1].replace(",", "."));
        price = raw > 500 ? raw / 100 : raw;
        break;
      }
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const brand = titleMatch ? titleMatch[1].split(/[|\-–·]/)[0].trim().slice(0, 60) : null;
    return { url, price, brand, htmlSnippet };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "timeout";
    return { url, price: null, brand: null, htmlSnippet: `Error: ${msg}` };
  }
}

router.post("/projects/:projectId/products/:productId/analyze-competitors", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const { competitorUrls = [], searchKeywords } = req.body as { competitorUrls?: string[]; searchKeywords?: string };
  
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!product || !project) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
  
    const validUrls = competitorUrls.filter((u) => {
      try { new URL(u); return true; } catch { return false; }
    });
  
    const fetchedData = validUrls.length > 0
      ? await Promise.all(validUrls.map(fetchRealCompetitorData))
      : [];
  
    const realPricesFound = fetchedData.filter((d) => d.price !== null);
    const realPricesSummary = fetchedData.map((d) =>
      `URL: ${d.url} | Precio extraído: ${d.price !== null ? `€${d.price}` : "no detectado"} | Brand: ${d.brand ?? "desconocida"}\nHTML snippet: ${d.htmlSnippet ?? "sin datos"}`
    ).join("\n\n");
  
    const prompt = `Analiza la competencia de precios para el producto "${product.title}" (precio actual: €${product.price ?? "no configurado"}) en el nicho "${project.storeNiche ?? "e-commerce"}".
  ${searchKeywords ? `Keywords de búsqueda: ${searchKeywords}` : ""}
  
  DATOS REALES EXTRAÍDOS DE LAS URLS DE COMPETIDORES (via HTTP fetch real, no inventados):
  ${realPricesSummary || "No se proporcionaron URLs de competidores."}
  
  Precios reales encontrados: ${realPricesFound.length > 0 ? realPricesFound.map((d) => `${d.brand ?? d.url}: €${d.price}`).join(", ") : "ninguno extraído automáticamente — usa los HTML snippets para determinar precios manualmente."}
  
  Con base en estos datos REALES (no inventes precios que no están en los snippets), proporciona:
  1. Rangos de precios por tier (budget, mid, premium) basados en los datos reales
  2. Precio mediano del mercado según los datos reales
  3. Recomendación de posicionamiento para "${project.name}" (tono: ${project.brandTone ?? "profesional"})
  
  IMPORTANTE: Los precios en competitorData DEBEN ser los precios reales extraídos, no estimaciones tuyas. Si no tienes el precio real de una URL, pon null.
  
  Devuelve JSON: { budgetMin, budgetMax, midMin, midMax, premiumMin, premiumMax, medianPrice, positioningRecommendation, competitorData: [{ url, price, brand }], dataQuality: "real"|"partial"|"estimated", realPricesCount: number }`;
  
    const result = await askClaudeJsonWithBrain<{
      budgetMin: number; budgetMax: number; midMin: number; midMax: number;
      premiumMin: number; premiumMax: number; medianPrice: number;
      positioningRecommendation: string;
      competitorData: Array<{ url: string; price: number | null; brand: string | null }>;
      dataQuality: string;
      realPricesCount: number;
    }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "pricing", project?.storeNiche ?? undefined);
  
    const enrichedResult = {
      ...result,
      competitorData: result.competitorData.map((cd) => {
        const fetched = fetchedData.find((f) => f.url === cd.url);
        return fetched?.price !== null && fetched
          ? { ...cd, price: fetched.price, brand: fetched.brand ?? cd.brand, verified: true }
          : { ...cd, verified: false };
      }),
      fetchedCount: fetchedData.length,
      realPricesCount: realPricesFound.length,
      dataQuality: realPricesFound.length >= fetchedData.length * 0.5 ? "real" :
        realPricesFound.length > 0 ? "partial" : "estimated",
    };
  
    await db.update(cogsTable)
      .set({ lastCompetitorAnalysis: enrichedResult as Record<string, unknown> })
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  
    // ShopyBrain aprende del análisis de competidores (fire-and-forget)
    learnFromOperation({
      operationType: "pricing",
      niche: project?.storeNiche ?? null,
      title: `Competidores: precio mediano €${enrichedResult.medianPrice} · ${enrichedResult.dataQuality}`,
      content: `Mercado: budget €${enrichedResult.budgetMin}-${enrichedResult.budgetMax} | mid €${enrichedResult.midMin}-${enrichedResult.midMax} | premium €${enrichedResult.premiumMin}-${enrichedResult.premiumMax}\nPrecio mediano: €${enrichedResult.medianPrice}\nPosicionamiento: ${enrichedResult.positioningRecommendation}\nCompetidores reales: ${enrichedResult.realPricesCount}/${enrichedResult.fetchedCount}`,
      confidence: enrichedResult.dataQuality === "real" ? 0.85 : enrichedResult.dataQuality === "partial" ? 0.65 : 0.45,
      tags: ["pricing", "competidores", project?.storeNiche ?? "ecommerce", enrichedResult.dataQuality],
    });
  
    res.json(enrichedResult);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/products/:productId/calculate-optimal-price", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const [product] = await db.select().from(productsTable).where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    let [cogs] = await db.select().from(cogsTable).where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  
    if (!product || !project) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }
  
    const niche = project.storeNiche ?? "e-commerce";
    const currentPrice = product.price ?? "0";
  
    let competitorResearch = { competitorPrices: [] as Array<{ source: string; price: string; url?: string; productName?: string }>, marketPriceRange: { min: 0, max: 0, median: 0 }, marketPosition: "", pricingStrategy: "" };
    let supplierResearch = { supplierPrices: [] as Array<{ supplier: string; priceRange: string; moq?: string; origin?: string }>, avgSupplierCost: 0, supplierInsight: "" };
  
    let researchEngine: "gemini-search" | "claude-fallback" = "gemini-search";

    if (!isGeminiSearchBlocked()) {
      try {
        const [compResult, suppResult] = await Promise.allSettled([
          askGeminiWithSearch(
            `BUSCA PRECIOS REALES en tiendas online para este tipo de producto:

Producto: "${product.title}"
Tipo: ${product.productType || "no especificado"}
Nicho/industria: ${niche}
Precio actual: ${currentPrice}€

INSTRUCCIONES:
1. Busca en Google Shopping, Amazon España, tiendas especializadas del nicho "${niche}"
2. Encuentra AL MENOS 5-10 precios REALES de productos similares o competidores directos
3. Extrae precios concretos con decimales y la URL/fuente de cada uno
4. Calcula el rango de mercado real (mínimo, máximo, mediana)
5. Determina la posición de mercado del precio actual €${currentPrice}

RESPONDE con este formato JSON exacto (sin texto adicional):
{
  "competitorPrices": [{"source": "nombre tienda", "price": "XX.XX", "url": "URL", "productName": "nombre encontrado"}],
  "marketPriceRange": {"min": XX.XX, "max": XX.XX, "median": XX.XX},
  "marketPosition": "budget|mid-range|premium|luxury",
  "pricingStrategy": "Explicación de la estrategia recomendada basada en datos reales"
}`,
            `You are a pricing analyst. Search for REAL current prices of similar products online in Spain and Europe. Always use Google Search to find actual prices from real stores. Return ONLY valid JSON.`
          ),
          askGeminiWithSearch(
            `BUSCA PRECIOS REALES DE PROVEEDORES/MAYORISTAS para fabricar o comprar al por mayor este producto:

Producto: "${product.title}"
Tipo: ${product.productType || "no especificado"}
Nicho: ${niche}

INSTRUCCIONES:
1. Busca en Alibaba, AliExpress mayorista, proveedores europeos, fabricantes del sector "${niche}"
2. Encuentra precios de coste/proveedor REALES para productos similares
3. Incluye MOQ (cantidad mínima de pedido) si está disponible
4. Indica el país de origen del proveedor

RESPONDE con este formato JSON exacto:
{
  "supplierPrices": [{"supplier": "nombre", "priceRange": "X.XX - X.XX €/ud", "moq": "50 unidades", "origin": "China/España/etc"}],
  "avgSupplierCost": XX.XX,
  "supplierInsight": "Análisis del coste de aprovisionamiento y recomendación"
}`,
            `You are a supply chain analyst. Search for REAL wholesale/supplier prices for this type of product. Use Google Search to find actual B2B prices. Return ONLY valid JSON.`
          ),
        ]);

        const comp = compResult.status === "fulfilled"
          ? parseResearchJson(compResult.value.text, competitorResearchSchema, "pricing/optimal:competidores")
          : null;
        if (comp) competitorResearch = { ...competitorResearch, ...definedOnly(comp) };
        const supp = suppResult.status === "fulfilled"
          ? parseResearchJson(suppResult.value.text, supplierPriceResearchSchema, "pricing/optimal:proveedores")
          : null;
        if (supp) supplierResearch = { ...supplierResearch, ...definedOnly(supp) };
      } catch {}
    }

    const cogsTotal = cogs?.totalCogs ?? 0;
    const cogsInfo = cogs ? `COGS total calculado: €${cogsTotal}, Precio mínimo viable: €${cogs.minimumViablePrice}, Break-even: €${cogs.breakEvenPrice}` : "COGS: no configurado — estima basándote en tu conocimiento del nicho";

    if (competitorResearch.competitorPrices.length === 0 && supplierResearch.supplierPrices.length === 0) {
      researchEngine = "claude-fallback";
    }

    const competitorDataStr = competitorResearch.competitorPrices.length > 0
      ? `PRECIOS REALES DE COMPETIDORES:\n${competitorResearch.competitorPrices.map(c => `  - ${c.source}: €${c.price} ${c.productName ? `(${c.productName})` : ""}`).join("\n")}\n  Rango: €${competitorResearch.marketPriceRange.min}-${competitorResearch.marketPriceRange.max} (mediana: €${competitorResearch.marketPriceRange.median})`
      : "";

    const supplierDataStr = supplierResearch.supplierPrices.length > 0
      ? `PROVEEDORES:\n${supplierResearch.supplierPrices.map(s => `  - ${s.supplier}: ${s.priceRange}`).join("\n")}\n  Coste medio: €${supplierResearch.avgSupplierCost}`
      : "";

    const researchBlock = researchEngine === "claude-fallback"
      ? `NO hay datos de búsqueda en tiempo real disponibles. USA tu conocimiento experto del nicho "${niche}" para:
1. Estimar al menos 5 precios de competidores similares que conozcas
2. Estimar costes de proveedores del sector
3. Indicar fuentes verificables cuando sea posible`
      : `${competitorDataStr}\n${supplierDataStr}`;

    const prompt = `Calcula el precio óptimo para "${product.title}" de "${project.name}".

${cogsInfo}

${researchBlock}

CONTEXTO: Nicho: ${niche}, Audiencia: ${project.targetAudience ?? "adultos"}, Tono: ${project.brandTone ?? "profesional"}, Mercados: ${project.storeMarkets ?? "España"}, Precio actual: €${currentPrice}

REGLAS: Precio coherente con mercado. No irrisorio ni inflado. Margen mín 30% sobre COGS.

Calcula: 1) Precio óptimo 2) Psicológico (.99/.95) 3) Compare_at_price (+30% mín) 4) Estrategia 5) Waterfall márgenes 6) Warnings 7) Bundles 8) Revenue proyectado 9) Comparativa 10) Impacto 11) Inteligencia avanzada: punto equilibrio, LTV 12m (recompra típica nicho ${niche}), LTV/CAC (${cogs ? `CAC: €${cogs.cac ?? 0}` : "estima CAC"}), riesgo cadena suministro, foso defensivo.

JSON: {optimalPrice, psychologicalPrice, compareAtPrice, recommendedStrategy(máx 200 chars), marginWaterfall:{revenue,platformFees,cogs,packaging,shipping,returns,marketing,overhead,netMargin,netMarginPct}, reasoning(máx 500 chars español), marginWarnings:[], bundleSuggestions:[], monthlyRevenueProjection, competitorAnalysis(máx 300 chars), supplierAnalysis(máx 200 chars), priceImpactEstimate:{currentPrice,suggestedPrice,expectedSalesChange,expectedRevenueChange,confidenceLevel}, inteligencia_avanzada:{punto_de_equilibrio_unidades,ltv_estimado_12_meses,ratio_ltv_cac,riesgo_cadena_suministro:"Alto|Medio|Bajo - breve",estrategia_foso_defensivo:"máx 200 chars"}}

CRÍTICO: Mantén TODOS los strings cortos y concisos. Responde SOLO JSON válido.`;

    let result;
    try {
      result = await askClaudeJsonWithBrain<{
        optimalPrice: number; psychologicalPrice: number; compareAtPrice: number;
        recommendedStrategy: string;
        marginWaterfall: { revenue: number; platformFees: number; cogs: number; packaging: number; shipping: number; returns: number; marketing: number; overhead: number; netMargin: number; netMarginPct: number };
        reasoning: string; marginWarnings: string[]; bundleSuggestions: string[];
        monthlyRevenueProjection: number | null;
        competitorAnalysis: string; supplierAnalysis: string;
        priceImpactEstimate: { currentPrice: number; suggestedPrice: number; expectedSalesChange: string; expectedRevenueChange: string; confidenceLevel: string };
        inteligencia_avanzada: {
          punto_de_equilibrio_unidades: number;
          ltv_estimado_12_meses: number;
          ratio_ltv_cac: number;
          riesgo_cadena_suministro: string;
          estrategia_foso_defensivo: string;
        };
      }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "pricing", niche, 6144);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      res.status(500).json({ error: `Error calculando precio óptimo: ${msg}` });
      return;
    }
  
    const lastCompetitorAnalysis = {
      date: new Date().toISOString(),
      competitorPrices: competitorResearch.competitorPrices,
      marketPriceRange: competitorResearch.marketPriceRange,
      marketPosition: competitorResearch.marketPosition,
      supplierPrices: supplierResearch.supplierPrices,
      avgSupplierCost: supplierResearch.avgSupplierCost,
    };
  
    if (!result.marginWarnings) result.marginWarnings = [];
    if (!result.bundleSuggestions) result.bundleSuggestions = [];

    const hasRealCompetitorData = competitorResearch.competitorPrices.length > 0;
    const hasRealSupplierData = supplierResearch.supplierPrices.length > 0;
    const searchDataQuality: "real" | "partial" | "estimated" =
      hasRealCompetitorData && hasRealSupplierData ? "real"
      : hasRealCompetitorData || hasRealSupplierData ? "partial"
      : "estimated";

    const ia = result.inteligencia_avanzada;
    const ltvCacAlert = ia?.ratio_ltv_cac != null && ia.ratio_ltv_cac < 3.0;
    if (ltvCacAlert) {
      result.marginWarnings.push(`ALERTA ROJA LTV/CAC: Ratio ${ia.ratio_ltv_cac.toFixed(1)}x (< 3.0). El coste de adquisición de cliente es demasiado alto respecto al valor que genera. Optimiza retención o reduce CAC urgentemente.`);
    }

    if (cogs) {
      await db.update(cogsTable)
        .set({ lastPricingRecommendation: result as Record<string, unknown>, lastCompetitorAnalysis: lastCompetitorAnalysis as Record<string, unknown> })
        .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
    }

    (result as any).searchDataQuality = searchDataQuality;
    (result as any).marketResearch = {
      competitorPrices: competitorResearch.competitorPrices,
      marketPriceRange: competitorResearch.marketPriceRange,
      marketPosition: competitorResearch.marketPosition,
      supplierPrices: supplierResearch.supplierPrices,
      avgSupplierCost: supplierResearch.avgSupplierCost,
      supplierInsight: supplierResearch.supplierInsight,
    };

    learnFromOperation({
      operationType: "pricing_analysis",
      niche: niche,
      productType: product.productType ?? null,
      title: `Análisis pricing: ${product.title}`,
      content: `Precio actual: €${currentPrice}. Óptimo: €${result.optimalPrice}. Psicológico: €${result.psychologicalPrice}. Mediana mercado: €${competitorResearch.marketPriceRange.median}. Competidores: ${competitorResearch.competitorPrices.length} encontrados. Proveedores: coste medio €${supplierResearch.avgSupplierCost}. Estrategia: ${result.recommendedStrategy}. Margen neto: ${result.marginWaterfall?.netMarginPct ?? "?"}%. LTV 12m: €${ia?.ltv_estimado_12_meses ?? "?"}, LTV/CAC: ${ia?.ratio_ltv_cac ?? "?"}, Break-even: ${ia?.punto_de_equilibrio_unidades ?? "?"} uds, Riesgo cadena: ${ia?.riesgo_cadena_suministro ?? "?"}, Foso: ${ia?.estrategia_foso_defensivo?.slice(0, 80) ?? "?"}`,
      confidence: competitorResearch.competitorPrices.length >= 5 ? 0.85 : 0.6,
      tags: ["pricing", "optimal_price", "competitor_analysis", "inteligencia_avanzada", product.productType ?? "general"],
    });
  
    res.json({
      ...result,
      marketResearch: {
        competitorPrices: competitorResearch.competitorPrices,
        marketPriceRange: competitorResearch.marketPriceRange,
        marketPosition: competitorResearch.marketPosition,
        supplierPrices: supplierResearch.supplierPrices,
        avgSupplierCost: supplierResearch.avgSupplierCost,
        supplierInsight: supplierResearch.supplierInsight,
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/products/:productId/apply-price", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const { price, compareAtPrice } = req.body as { price: string; compareAtPrice?: string };
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
  
    const { updateStoreProduct } = await import("../lib/platform-helper.js");
    const updateResult = await updateStoreProduct(projectId, shopifyProductId, {
      price,
      compareAtPrice: compareAtPrice ?? null,
      variants: [{ platformId: "", title: "", price, compareAtPrice: compareAtPrice || undefined }],
    });
    if (!updateResult.ok) {
      res.status(400).json({ error: updateResult.error });
      return;
    }
  
    await db.update(productsTable)
      .set({ price, compareAtPrice: compareAtPrice ?? null })
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
    const platformName = (project as any).platformType || "Shopify";
    res.json({ success: true, message: `Precio €${price} aplicado correctamente en ${platformName}` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/financial-dashboard", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
  
    // Pedidos reales de los últimos 30 días en cualquier plataforma, todas las
    // páginas y sin cancelados/reembolsados. Antes: solo Shopify, 250 pedidos
    // como máximo, contando cancelados y con 0 € silencioso si fallaba.
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    let grossRevenue = 0;
    let aov = 0;
    let orderCount = 0;
    let ordersError: string | null = null;
    const customers = new Set<string>();
    const productSales = new Map<string, { units: number; revenue: number }>();

    try {
      const connector = await getProjectConnector(projectId);
      if (!connector || !connector.supportsFeature("orders")) throw new Error("La tienda no tiene conexión de pedidos configurada");
      const orders = (await fetchOrdersInWindow(connector, start, end))
        .filter(o => isCountableOrder(o.status))
        .filter(o => { const t = new Date(o.createdAt).getTime(); return t >= start.getTime() && t < end.getTime(); });
      orderCount = orders.length;
      grossRevenue = orders.reduce((sum, o) => sum + (Number.parseFloat(o.total ?? "0") || 0), 0);
      aov = orderCount > 0 ? grossRevenue / orderCount : 0;
      for (const order of orders) {
        if (order.customerEmail) customers.add(order.customerEmail.toLowerCase());
        for (const item of order.lineItems) {
          if (!item.productId) continue;
          const pid = String(item.productId);
          const existing = productSales.get(pid) ?? { units: 0, revenue: 0 };
          existing.units += item.quantity;
          existing.revenue += item.quantity * (Number.parseFloat(item.price) || 0);
          productSales.set(pid, existing);
        }
      }
    } catch (err) {
      ordersError = err instanceof Error ? err.message : String(err);
      logger.warn({ err, projectId }, "financial-dashboard: no se pudieron leer los pedidos");
    }

    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const cogsByProduct = new Map(allCogs.map(c => [c.shopifyProductId, c]));

    // Margen solo donde hay COGS: sin coste conocido el margen no es 100 %, es desconocido.
    const allRows = products.map((p) => {
      const cogs = cogsByProduct.get(p.shopifyProductId);
      const sales = productSales.get(p.shopifyProductId);
      const unitsSold = sales?.units ?? 0;
      const revenue = sales?.revenue ?? 0;
      const hasCogs = cogs?.totalCogs != null;
      const cogsTotal = hasCogs ? (cogs!.totalCogs ?? 0) * unitsSold : 0;
      const profit = revenue - cogsTotal;
      const margin = hasCogs && revenue > 0 ? (profit / revenue) * 100 : null;
      const grade = margin === null ? "N/D" : margin >= 40 ? "A" : margin >= 20 ? "B" : margin >= 10 ? "C" : "F";
      return {
        productId: p.shopifyProductId,
        title: p.title,
        unitsSold,
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogsTotal * 100) / 100,
        grossProfit: Math.round(profit * 100) / 100,
        marginPct: margin === null ? 0 : Math.round(margin * 10) / 10,
        grade,
        hasCogs,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const withCogs = allRows.filter(r => r.hasCogs);
    const revenueWithCogs = withCogs.reduce((sum, r) => sum + r.revenue, 0);
    const totalCogsAgg = withCogs.reduce((sum, r) => sum + r.cogs, 0);
    const lineRevenue = allRows.reduce((sum, r) => sum + r.revenue, 0);
    const grossMarginPct = revenueWithCogs > 0 ? ((revenueWithCogs - totalCogsAgg) / revenueWithCogs) * 100 : 0;
    const grossProfit = grossRevenue * (grossMarginPct / 100);
    const cogsCoveragePct = lineRevenue > 0 ? Math.round((revenueWithCogs / lineRevenue) * 1000) / 10 : null;

    const cogsWithCac = allCogs.filter((c) => c.cac != null && c.cac > 0);
    const avgCac = cogsWithCac.length > 0
      ? cogsWithCac.reduce((sum, c) => sum + (c.cac ?? 0), 0) / cogsWithCac.length
      : null;

    // Margen neto: el bruto menos el coste de adquisición real (CAC × pedidos).
    // Sin CAC registrado no se resta nada inventado (antes: bruto − 10 puntos fijos).
    const acquisitionCost = avgCac ? avgCac * orderCount : 0;
    const netMarginPct = grossRevenue > 0 ? ((grossProfit - acquisitionCost) / grossRevenue) * 100 : 0;

    // Valor por cliente real de la ventana (pedidos con email); sin tasa de recompra supuesta.
    const customerValue30d = customers.size > 0 ? Math.round((grossRevenue / customers.size) * 100) / 100 : null;
    const ltvCacRatio = customerValue30d !== null && avgCac ? Math.round((customerValue30d / avgCac) * 100) / 100 : null;

    const alerts: string[] = [];
    if (ordersError) alerts.push(`No se pudieron leer los pedidos de la tienda: ${ordersError}`);
    if (cogsCoveragePct !== null && cogsCoveragePct < 100) {
      alerts.push(`Solo el ${cogsCoveragePct}% de las ventas tiene COGS registrado — los márgenes se calculan sobre esa parte`);
    }
    if (revenueWithCogs > 0 && grossMarginPct < 20) alerts.push("Margen bruto global por debajo del 20% — revisar estructura de costes");
    const lowMarginProducts = withCogs.filter((p) => p.revenue > 0 && p.marginPct < 15);
    if (lowMarginProducts.length > 0) alerts.push(`${lowMarginProducts.length} productos con margen < 15% — riesgo de pérdida con devoluciones`);
    if (ltvCacRatio !== null && ltvCacRatio < 1) {
      alerts.push(`El valor por cliente de los últimos 30 días (€${customerValue30d?.toFixed(2)}) no cubre el CAC medio (€${avgCac?.toFixed(2)})`);
    }

    const breakEvenUnits = avgCac && aov > 0 && grossMarginPct > 0
      ? Math.ceil(avgCac / (aov * (grossMarginPct / 100)))
      : null;

    res.json({
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      totalCogs: Math.round(totalCogsAgg * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      netMarginPct: Math.round(netMarginPct * 10) / 10,
      aov: Math.round(aov * 100) / 100,
      orders30d: orderCount,
      cac: avgCac ? Math.round(avgCac * 100) / 100 : null,
      ltvCacRatio,
      customerValue30d,
      cogsCoveragePct,
      breakEvenUnits,
      productProfitability: allRows.slice(0, 50).map(({ hasCogs: _h, ...r }) => r),
      alerts,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── AI COGS AUTO-ESTIMATION ────────────────────────────────────────────────────
router.post("/projects/:projectId/products/:productId/ai-estimate-cogs", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const [product] = await db.select().from(productsTable).where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!product || !project) {
      res.status(404).json({ error: "Producto o proyecto no encontrado" });
      return;
    }
  
    let shopifyDetails = "";
    try {
      const { getProjectConnector } = await import("../lib/platform-helper.js");
      const connector = await getProjectConnector(projectId);
      if (connector && connector.supportsFeature("products")) {
        const liveProduct = await connector.getProduct(shopifyProductId);
        const weight = liveProduct.variants?.[0] ? "estimado" : "desconocido";
        shopifyDetails = `
  Vendor: ${liveProduct.vendor || "desconocido"}
  Tipo de producto: ${liveProduct.productType || "sin tipo"}
  Variantes: ${liveProduct.variants?.length ?? 1} (precios: ${liveProduct.variants?.map(v => `€${v.price}`).join(", ") ?? "N/A"})
  Peso estimado: ${weight}
  `;
      }
    } catch {}
  
    const productType = product.productType || "producto general";
    const niche = project.storeNiche || "e-commerce";
  
    const researchWarnings: string[] = [];
    let productClassification = {
      category: "physical" as string,
      manufacturingMethod: "unknown" as string,
      estimatedWeight: "500g" as string,
      materialComposition: [] as string[],
      shippingCategory: "standard" as string,
    };

    let materialResearch = { materials: [] as Array<{ material: string; priceRange: string; source: string; url?: string }>, avgMaterialCost: 0, insight: "" };
    let shippingResearch = { carriers: [] as Array<{ carrier: string; domestic: string; international: string; source: string }>, insight: "" };
    let supplierResearch = { suppliers: [] as Array<{ supplier: string; priceRange: string; moq?: string; origin?: string; url?: string }>, avgCost: 0, insight: "" };
    let packagingResearch = { items: [] as Array<{ item: string; pricePerUnit: number; source: string }>, totalPackagingCost: 0, insight: "" };

    const geminiBlocked = isGeminiSearchBlocked();

    if (!geminiBlocked) {
      try {
        const searchTitle = `${product.title} ${productType}`;
        const [matResult, shipResult, suppResult, packResult] = await Promise.allSettled([
          askGeminiWithSearch(`"${searchTitle}" materiales coste producción precios España\n\nJSON: {"materials":[{"material":"","priceRange":"€","source":""}],"avgMaterialCost":0,"insight":""}`, "Supply chain cost analyst. ONLY JSON."),
          askGeminiWithSearch(`envío ecommerce España paquete tarifas SEUR Correos MRW 2025\n\nJSON: {"carriers":[{"carrier":"","domestic":"€","international":"€","source":""}],"insight":""}`, "Logistics analyst. ONLY JSON."),
          askGeminiWithSearch(`"${searchTitle}" proveedor mayorista fabricante precio\n\nJSON: {"suppliers":[{"supplier":"","priceRange":"€/ud","moq":"","origin":""}],"avgCost":0,"insight":""}`, "Sourcing analyst. ONLY JSON."),
          askGeminiWithSearch(`packaging ecommerce caja envío España precio\n\nJSON: {"items":[{"item":"","pricePerUnit":0,"source":""}],"totalPackagingCost":0,"insight":""}`, "Packaging analyst. ONLY JSON."),
        ]);

        const parseGemini = <T,>(r: PromiseSettledResult<{ text: string }>, schema: z.ZodType<T, z.ZodTypeDef, unknown>, label: string): T | null =>
          r.status === "fulfilled" ? parseResearchJson(r.value.text, schema, `pricing/cogs:${label}`) : null;
        const mat = parseGemini(matResult, materialResearchSchema, "materiales");
        if (mat) materialResearch = { ...materialResearch, ...definedOnly(mat) };
        const ship = parseGemini(shipResult, shippingResearchSchema, "envios");
        if (ship) shippingResearch = { ...shippingResearch, ...definedOnly(ship) };
        const supp = parseGemini(suppResult, cogsSupplierResearchSchema, "proveedores");
        if (supp) supplierResearch = { ...supplierResearch, ...definedOnly(supp) };
        const pack = parseGemini(packResult, packagingResearchSchema, "packaging");
        if (pack) packagingResearch = { ...packagingResearch, ...definedOnly(pack) };
      } catch {}
    }

    const allCogsEmpty = materialResearch.materials.length === 0 && shippingResearch.carriers.length === 0 && supplierResearch.suppliers.length === 0 && packagingResearch.items.length === 0;

    if (allCogsEmpty) {
      researchWarnings.push(geminiBlocked ? "Modo rápido — clasificación + investigación + estimación unificada vía Claude" : "Gemini Search falló — usando estimación unificada vía Claude");

      const unifiedPrompt = `Eres un experto en costes de producción, logística, fabricación, materiales, envíos e impuestos con 20 años de experiencia.

PRODUCTO A ANALIZAR:
- Título: "${product.title}"
- Descripción: "${(product.bodyHtml ?? "").replace(/<[^>]+>/g, " ").slice(0, 800)}"
- Precio de venta: €${product.price || "sin configurar"}
- Tipo: ${productType}
- Vendor: ${product.vendor || "sin definir"}
- Tags: ${product.tags || "ninguno"}
- Tienda: "${project.name}" (Nicho: ${niche})
- Mercados: ${project.storeMarkets || "España"}
${shopifyDetails}

TAREA: Clasifica el producto Y calcula TODOS los costes en UNA sola respuesta.

Proporciona DOS escenarios:
1. "ownEquipment" — Producción propia (taller/equipos propios)
2. "externalService" — Servicio externo (fabricación externalizada)

Para CADA escenario estima (€/unidad): unitCost, materialCost, fabricCost, printingCost, screenPrintingCost, moldAmortization, assemblyCost, laborCostPerUnit, qualityControlCost, packagingCost, labelCost, shippingCostDomestic, shippingCostInternational, fulfillmentFee, warehouseCostPerUnit, customsDuty, insuranceCost, returnRate (decimal), returnProcessingCost, shopifyPaymentFee (decimal 0.029), shopifyPlanCostPerOrder, paymentProcessingFee, platformCommission, cac, affiliateFee, digitalMarketingCost, influencerCostPerUnit, seoCostPerUnit, vatRate (0.21), corporateTaxRate (0.25), consultingFee, legalCostPerUnit, aiApiCostPerUnit, designCostPerUnit, overheadPerUnit

JSON: {
  "classification": {"category":"physical|digital|service","manufacturingMethod":"...","estimatedWeight":"Xg","materialComposition":["mat1"],"shippingCategory":"standard|fragile"},
  "ownEquipment": {todos los campos numéricos},
  "externalService": {todos los campos numéricos},
  "reasoning": "explicación detallada en español",
  "shippingBreakdown": [{"carrier":"SEUR","domestic":4.5,"international":12,"estimatedWeight":"500g"}],
  "materialBreakdown": [{"material":"x","costPerUnit":1.5,"notes":"...","source":"estimación experta"}],
  "supplierOptions": [{"name":"x","unitCost":5,"moq":"50","origin":"España"}],
  "productionMethod": "...",
  "colorComplexity": "simple|medium|complex",
  "confidenceLevel": "high|medium|low",
  "dataQuality": "estimated",
  "realSourcesCount": 0
}

Responde SOLO el JSON válido.`;

      let estimated;
      try {
        estimated = await askClaudeJsonWithBrain<{
          classification?: { category: string; manufacturingMethod: string; estimatedWeight: string; materialComposition: string[]; shippingCategory: string };
          ownEquipment: Record<string, number>;
          externalService: Record<string, number>;
          reasoning: string;
          shippingBreakdown: Array<{ carrier: string; domestic: number; international: number; estimatedWeight: string }>;
          materialBreakdown: Array<{ material: string; costPerUnit: number; notes: string; source?: string }>;
          supplierOptions: Array<{ name: string; unitCost: number; moq?: string; origin?: string }>;
          productionMethod: string;
          colorComplexity: string;
          confidenceLevel: string;
          dataQuality: string;
          realSourcesCount: number;
        }>(projectId, unifiedPrompt, FINANCIAL_ANALYST_SYSTEM, "cogs_estimation", project.storeNiche ?? undefined, 8192);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        res.status(500).json({ error: `Error al estimar costes con IA: ${msg}` });
        return;
      }

      if (estimated.classification) {
        productClassification = { ...productClassification, ...estimated.classification };
      }

      learnFromOperation({
        operationType: "cogs_estimation",
        niche: project.storeNiche ?? null,
        productType: product.productType ?? null,
        title: `COGS estimado IA (unificado): ${product.title}`,
        content: `Estimación COGS unificada para "${product.title}" (${estimated.productionMethod ?? "desconocido"}): Propio €${estimated.ownEquipment?.unitCost ?? "?"}, Externo €${estimated.externalService?.unitCost ?? "?"}. Confianza: ${estimated.confidenceLevel ?? "N/A"}.`,
        confidence: estimated.confidenceLevel === "high" ? 0.9 : estimated.confidenceLevel === "medium" ? 0.7 : 0.5,
        tags: ["cogs", "estimation", "ai", "unified", product.productType ?? "general"],
      });

      const ownEq = estimated.ownEquipment ?? {};
      updateCogsBenchmark({
        productCategory: productClassification.category,
        manufacturingMethod: productClassification.manufacturingMethod,
        niche, materialCost: ownEq.materialCost ?? 0,
        shippingDomestic: ownEq.shippingCostDomestic ?? 0, shippingInternational: ownEq.shippingCostInternational ?? 0,
        packagingCost: ownEq.packagingCost ?? 0, fulfillmentCost: ownEq.fulfillmentFee ?? 0,
        platformFeePct: ownEq.shopifyPaymentFee ?? 0.015, returnRate: ownEq.returnRate ?? 0.08, cac: ownEq.cac ?? 0,
      }).catch(() => {});

      res.json({
        productId: shopifyProductId, productTitle: product.title,
        productClassification: {
          category: productClassification.category, manufacturingMethod: productClassification.manufacturingMethod,
          estimatedWeight: productClassification.estimatedWeight, materialComposition: productClassification.materialComposition,
          shippingCategory: productClassification.shippingCategory,
        },
        ...estimated,
        marketResearch: { materials: estimated.materialBreakdown?.map(m => ({ material: m.material, priceRange: `€${m.costPerUnit}`, source: m.source ?? "Claude" })) ?? [], carriers: estimated.shippingBreakdown ?? [], suppliers: estimated.supplierOptions?.map(s => ({ supplier: s.name, priceRange: `€${s.unitCost}`, moq: s.moq, origin: s.origin })) ?? [], packaging: [] },
        researchWarnings,
      });
      return;
    }

    if (allCogsEmpty && !geminiBlocked) {
      researchWarnings.push("Gemini Search no devolvió resultados — usando estimaciones de Claude");
    }

    const materialDataStr = materialResearch.materials.length > 0
      ? `PRECIOS REALES DE MATERIALES:\n${materialResearch.materials.map(m => `  - ${m.material}: ${m.priceRange} [${m.source}]`).join("\n")}\n  Coste medio: €${materialResearch.avgMaterialCost}`
      : "Sin datos de materiales — estima basándote en conocimiento del sector";

    const shippingDataStr = shippingResearch.carriers.length > 0
      ? `TARIFAS DE ENVÍO:\n${shippingResearch.carriers.map(c => `  - ${c.carrier}: Nacional ${c.domestic}, Intl ${c.international}`).join("\n")}`
      : "Sin datos de envío — usa tarifas estándar españolas";

    const supplierDataStr2 = supplierResearch.suppliers.length > 0
      ? `PROVEEDORES:\n${supplierResearch.suppliers.map(s => `  - ${s.supplier}: ${s.priceRange} ${s.moq ? `(MOQ: ${s.moq})` : ""}`).join("\n")}`
      : "Sin datos de proveedores";

    const packagingDataStr = packagingResearch.items.length > 0
      ? `PACKAGING:\n${packagingResearch.items.map(p => `  - ${p.item}: €${p.pricePerUnit}/ud`).join("\n")}`
      : "Sin datos de packaging";

    const classificationStr = productClassification.manufacturingMethod !== "unknown"
      ? `\nCLASIFICACIÓN: ${productClassification.category}, ${productClassification.manufacturingMethod}, ${productClassification.estimatedWeight}, envío: ${productClassification.shippingCategory}`
      : "";
  
    const prompt = `Eres un experto en costes de producción, logística, fabricación, materiales, envíos e impuestos con 20 años de experiencia.

PRODUCTO: "${product.title}" — €${product.price || "sin configurar"} — ${productType} — ${product.vendor || "sin definir"}
Tienda: "${project.name}" (Nicho: ${niche}) — Mercados: ${project.storeMarkets || "España"}
${shopifyDetails}${classificationStr}

DATOS DE MERCADO:
${materialDataStr}
${shippingDataStr}
${supplierDataStr2}
${packagingDataStr}

Proporciona DOS escenarios: "ownEquipment" (producción propia) y "externalService" (externalizada).
Para CADA uno estima (€/unidad): unitCost, materialCost, fabricCost, printingCost, screenPrintingCost, moldAmortization, assemblyCost, laborCostPerUnit, qualityControlCost, packagingCost, labelCost, shippingCostDomestic, shippingCostInternational, fulfillmentFee, warehouseCostPerUnit, customsDuty, insuranceCost, returnRate, returnProcessingCost, shopifyPaymentFee (0.029), shopifyPlanCostPerOrder, paymentProcessingFee, platformCommission, cac, affiliateFee, digitalMarketingCost, influencerCostPerUnit, seoCostPerUnit, vatRate (0.21), corporateTaxRate (0.25), consultingFee, legalCostPerUnit, aiApiCostPerUnit, designCostPerUnit, overheadPerUnit

JSON: { ownEquipment:{...}, externalService:{...}, reasoning:"...", shippingBreakdown:[{carrier,domestic,international,estimatedWeight}], materialBreakdown:[{material,costPerUnit,notes,source}], supplierOptions:[{name,unitCost,moq,origin}], productionMethod:"...", colorComplexity:"...", confidenceLevel:"high|medium|low", dataQuality:"real|partial|estimated", realSourcesCount:N }

Responde SOLO JSON.`;
  
    let estimated;
    try {
      estimated = await askClaudeJsonWithBrain<{
        ownEquipment: Record<string, number>;
        externalService: Record<string, number>;
        reasoning: string;
        shippingBreakdown: Array<{ carrier: string; domestic: number; international: number; estimatedWeight: string }>;
        materialBreakdown: Array<{ material: string; costPerUnit: number; notes: string; source?: string }>;
        supplierOptions: Array<{ name: string; unitCost: number; moq?: string; origin?: string }>;
        productionMethod: string;
        colorComplexity: string;
        confidenceLevel: string;
        dataQuality: string;
        realSourcesCount: number;
      }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "cogs_estimation", project.storeNiche ?? undefined, 8192);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      res.status(500).json({ error: `Error al estimar costes con IA: ${msg}` });
      return;
    }
  
    learnFromOperation({
      operationType: "cogs_estimation",
      niche: project.storeNiche ?? null,
      productType: product.productType ?? null,
      title: `COGS estimado IA (datos reales): ${product.title}`,
      content: `Estimación COGS para "${product.title}" (${estimated.productionMethod ?? "desconocido"}): Propio €${estimated.ownEquipment?.unitCost ?? "?"}, Externo €${estimated.externalService?.unitCost ?? "?"}. Materiales reales: ${estimated.materialBreakdown?.map(m => `${m.material}: €${m.costPerUnit}${m.source ? ` [${m.source}]` : ""}`).join(", ") ?? "N/A"}. Proveedores: ${estimated.supplierOptions?.length ?? 0} encontrados. Calidad datos: ${estimated.dataQuality ?? "unknown"}. Confianza: ${estimated.confidenceLevel ?? "N/A"}.`,
      confidence: estimated.confidenceLevel === "high" ? 0.9 : estimated.confidenceLevel === "medium" ? 0.7 : 0.5,
      tags: ["cogs", "estimation", "ai", "real_data", product.productType ?? "general"],
    });
  
    const ownEq = estimated.ownEquipment ?? {};
    updateCogsBenchmark({
      productCategory: productClassification.category,
      manufacturingMethod: productClassification.manufacturingMethod,
      niche: niche,
      materialCost: ownEq.materialCost ?? 0,
      shippingDomestic: ownEq.shippingCostDomestic ?? 0,
      shippingInternational: ownEq.shippingCostInternational ?? 0,
      packagingCost: ownEq.packagingCost ?? 0,
      fulfillmentCost: ownEq.fulfillmentFee ?? 0,
      platformFeePct: ownEq.shopifyPaymentFee ?? 0.015,
      returnRate: ownEq.returnRate ?? 0.08,
      cac: ownEq.cac ?? 0,
    }).catch(() => {});
  
    res.json({
      productId: shopifyProductId,
      productTitle: product.title,
      productClassification: {
        category: productClassification.category,
        manufacturingMethod: productClassification.manufacturingMethod,
        estimatedWeight: productClassification.estimatedWeight,
        materialComposition: productClassification.materialComposition,
        shippingCategory: productClassification.shippingCategory,
      },
      ...estimated,
      marketResearch: {
        materials: materialResearch.materials,
        carriers: shippingResearch.carriers,
        suppliers: supplierResearch.suppliers,
        packaging: packagingResearch.items,
      },
      researchWarnings: researchWarnings.length > 0 ? researchWarnings : undefined,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── T001: SIMULADOR DE PRECIO ─────────────────────────────────────────────────
router.post("/projects/:projectId/products/:productId/price-simulator", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
    const rawPrice = parseFloat(req.body?.newPrice);
    const rawUnits = parseInt(req.body?.unitsPerMonth);
    const safePriceSim = isNaN(rawPrice) || rawPrice <= 0 ? null : rawPrice;
    const safeUnits = isNaN(rawUnits) || rawUnits <= 0 ? 30 : rawUnits;
  
    if (!safePriceSim) { res.status(400).json({ error: "newPrice debe ser un número positivo" }); return; }
  
    const [product] = await db.select().from(productsTable).where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
    const [cogs] = await db.select().from(cogsTable).where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  
    if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }
  
    const newPrice = safePriceSim;
    const currentPrice = parseFloat(product.price ?? "0");
    const totalCogs = cogs?.totalCogs ?? 0;
    const units = safeUnits;
    const pctChange = currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0;
  
    const scenarios = [
      { label: "Pesimista", priceMultiplier: 1, unitMultiplier: pctChange > 0 ? 0.7 : 1.1 },
      { label: "Base", priceMultiplier: 1, unitMultiplier: pctChange > 0 ? 0.85 : 1.05 },
      { label: "Optimista", priceMultiplier: 1, unitMultiplier: pctChange > 0 ? 0.95 : 1.15 },
    ].map(s => {
      const adjustedUnits = Math.round(units * s.unitMultiplier);
      const revenue = newPrice * adjustedUnits;
      const totalCost = totalCogs * adjustedUnits;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        scenario: s.label,
        price: newPrice,
        estimatedUnits: adjustedUnits,
        monthlyRevenue: Math.round(revenue * 100) / 100,
        monthlyCost: Math.round(totalCost * 100) / 100,
        monthlyProfit: Math.round(profit * 100) / 100,
        marginPct: Math.round(margin * 10) / 10,
      };
    });
  
    const currentRevenue = currentPrice * units;
    const currentProfit = (currentPrice - totalCogs) * units;
    const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
  
    const breakEvenUnits = totalCogs > 0 && newPrice > totalCogs ? Math.ceil((totalCogs * units) / (newPrice - totalCogs)) : null;
  
    learnFromOperation({
      operationType: "price_simulation",
      niche: product.productType ?? null,
      title: `Price simulation: ${product.title} (${currentPrice}→${newPrice})`,
      content: `Simulación "${product.title}": precio ${currentPrice}→${newPrice} (${pctChange > 0 ? "+" : ""}${Math.round(pctChange)}%). COGS: ${totalCogs}. Base: ${scenarios[1]?.monthlyRevenue}€ rev, ${scenarios[1]?.marginPct}% margen. Break-even: ${breakEvenUnits ?? "N/A"} unidades.`,
      confidence: 0.7,
      tags: ["pricing", "simulation"],
    });
  
    res.json({
      currentPrice,
      newPrice,
      priceChangePct: Math.round(pctChange * 10) / 10,
      currentMonthly: {
        revenue: Math.round(currentRevenue * 100) / 100,
        profit: Math.round(currentProfit * 100) / 100,
        marginPct: Math.round(currentMargin * 10) / 10,
        units,
      },
      scenarios,
      breakEvenUnits,
      cogsPerUnit: totalCogs,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── T002: ELASTICIDAD DE PRECIO (datos históricos reales) ─────────────────────
router.get("/projects/:projectId/products/:productId/price-elasticity", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const [product] = await db.select().from(productsTable).where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!product || !project) { res.status(404).json({ error: "Producto no encontrado" }); return; }
  
    const priceHistory = await db.select().from(priceHistoryTable)
      .where(and(eq(priceHistoryTable.projectId, projectId), eq(priceHistoryTable.shopifyProductId, shopifyProductId)))
      .orderBy(desc(priceHistoryTable.recordedAt))
      .limit(50);
  
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    let salesData: Array<{ date: string; units: number; revenue: number }> = [];
  
    try {
      const ordersData = await shopifyRequest<{ orders: Array<{ created_at: string; line_items: Array<{ product_id: number; quantity: number; price: string }> }> }>(
        projectId, project.shopDomain,
        `/orders.json?status=any&created_at_min=${ninetyDaysAgo}&limit=250`
      );
  
      const dailyMap = new Map<string, { units: number; revenue: number }>();
      for (const order of ordersData.orders) {
        const date = order.created_at.split("T")[0];
        for (const item of order.line_items) {
          if (String(item.product_id) === shopifyProductId) {
            const existing = dailyMap.get(date) ?? { units: 0, revenue: 0 };
            existing.units += item.quantity;
            existing.revenue += item.quantity * parseFloat(item.price);
            dailyMap.set(date, existing);
          }
        }
      }
      salesData = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));
    } catch {}
  
    let elasticityCoefficient: number | null = null;
    let elasticityLabel = "Sin datos suficientes";
  
    if (priceHistory.length >= 2 && salesData.length >= 7) {
      const priceChanges = priceHistory.filter(h => h.oldPrice && h.newPrice && h.oldPrice !== h.newPrice);
      if (priceChanges.length > 0) {
        const avgPctPriceChange = priceChanges.reduce((sum, h) => {
          const pct = ((h.newPrice - (h.oldPrice ?? h.newPrice)) / (h.oldPrice ?? h.newPrice)) * 100;
          return sum + Math.abs(pct);
        }, 0) / priceChanges.length;
  
        const totalUnits = salesData.reduce((sum, d) => sum + d.units, 0);
        const avgDailyUnits = totalUnits / salesData.length;
  
        if (avgPctPriceChange > 0 && avgDailyUnits > 0) {
          elasticityCoefficient = Math.round((avgDailyUnits / avgPctPriceChange) * 100) / 100;
          elasticityLabel = elasticityCoefficient > 1.5 ? "Muy elástico — sensible al precio"
            : elasticityCoefficient > 0.8 ? "Moderadamente elástico"
            : "Inelástico — precio poco impacta ventas";
        }
      }
    }
  
    learnFromOperation({
      operationType: "price_elasticity",
      niche: product.productType ?? null,
      title: `Elasticity: ${product.title}`,
      content: `Elasticidad "${product.title}": coeficiente ${elasticityCoefficient ?? "N/A"} (${elasticityLabel}). ${salesData.length} días de ventas, ${priceHistory.length} cambios de precio. Precio actual: ${parseFloat(product.price ?? "0")}.`,
      confidence: elasticityCoefficient != null ? 0.8 : 0.5,
      tags: ["pricing", "elasticity"],
    });
  
    res.json({
      productId: shopifyProductId,
      currentPrice: parseFloat(product.price ?? "0"),
      priceHistory: priceHistory.map(h => ({
        oldPrice: h.oldPrice,
        newPrice: h.newPrice,
        changeSource: h.changeSource,
        date: h.recordedAt.toISOString(),
      })),
      salesData,
      elasticity: {
        coefficient: elasticityCoefficient,
        label: elasticityLabel,
        dataPoints: salesData.length,
        priceChanges: priceHistory.length,
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── T003: P&L FORECAST PREDICTIVO (3/6/12 meses) ─────────────────────────────
router.post("/projects/:projectId/financial-forecast", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const { months = 12 } = req.body as { months?: number };
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let currentMonthlyRevenue = 0;
    let currentMonthlyOrders = 0;
  
    try {
      const ordersData = await shopifyRequest<{ orders: Array<{ total_price: string }> }>(
        projectId, project.shopDomain,
        `/orders.json?status=any&created_at_min=${thirtyDaysAgo}&limit=250`
      );
      currentMonthlyOrders = ordersData.orders.length;
      currentMonthlyRevenue = ordersData.orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    } catch {}
  
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const avgCogsPerOrder = allCogs.length > 0
      ? allCogs.reduce((sum, c) => sum + c.totalCogs, 0) / allCogs.length
      : currentMonthlyRevenue * 0.4;
  
    const growthRates = { pessimistic: -0.02, base: 0.05, optimistic: 0.12 };
  
    const forecast = Object.entries(growthRates).map(([scenario, rate]) => {
      const monthlyData = [];
      let cumRevenue = 0;
      let cumProfit = 0;
  
      for (let m = 1; m <= months; m++) {
        const growthFactor = Math.pow(1 + rate, m);
        const revenue = Math.round(currentMonthlyRevenue * growthFactor * 100) / 100;
        const orders = Math.round(currentMonthlyOrders * growthFactor);
        const costs = Math.round(avgCogsPerOrder * orders * 100) / 100;
        const profit = Math.round((revenue - costs) * 100) / 100;
        const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
        cumRevenue += revenue;
        cumProfit += profit;
  
        monthlyData.push({ month: m, revenue, orders, costs, profit, margin });
      }
  
      return {
        scenario,
        monthlyGrowthRate: rate,
        months: monthlyData,
        totals: {
          revenue: Math.round(cumRevenue * 100) / 100,
          profit: Math.round(cumProfit * 100) / 100,
          avgMargin: cumRevenue > 0 ? Math.round((cumProfit / cumRevenue) * 1000) / 10 : 0,
        },
      };
    });
  
    const breakEvenMonth = forecast.find(f => f.scenario === "base")?.months.findIndex(m => m.profit > 0);
  
    const baseTotals = forecast.find(f => f.scenario === "base")?.totals;
    learnFromOperation({
      operationType: "financial_forecast",
      title: `P&L Forecast ${months}m — ${project.shopDomain}`,
      content: `Forecast ${months} meses para ${project.shopDomain}. Rev mensual actual: ${Math.round(currentMonthlyRevenue)}€, ${currentMonthlyOrders} pedidos. COGS medio/pedido: ${Math.round(avgCogsPerOrder)}€. Escenario base: ${baseTotals?.revenue ?? 0}€ rev total, ${baseTotals?.avgMargin ?? 0}% margen medio. Break-even mes: ${breakEvenMonth !== undefined && breakEvenMonth >= 0 ? breakEvenMonth + 1 : "N/A"}.`,
      confidence: 0.7,
      tags: ["pricing", "forecast", "financial"],
    });
  
    res.json({
      currentMonthlyRevenue: Math.round(currentMonthlyRevenue * 100) / 100,
      currentMonthlyOrders,
      avgCogsPerOrder: Math.round(avgCogsPerOrder * 100) / 100,
      forecastMonths: months,
      forecast,
      breakEvenMonth: breakEvenMonth !== undefined && breakEvenMonth >= 0 ? breakEvenMonth + 1 : null,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FLAT PRICING MODULE ENDPOINTS — /pricing/*
// Frontend expects these at /api/pricing/* (API_BASE = '/api/pricing')
// ═══════════════════════════════════════════════════════════════════════════════

interface BatchJobState {
  status: "idle" | "running" | "completed" | "error" | "cancelled";
  current: number;
  total: number;
  message: string;
  errors: number;
  startedAt?: string;
  completedAt?: string;
  cancelled?: boolean;
}

const batchJobs = new Map<string, BatchJobState>();

async function resolveProjectId(req: any): Promise<number> {
  const qp = req.query?.projectId;
  if (qp) {
    const pid = parseInt(String(qp), 10);
    if (!isNaN(pid) && pid > 0) return pid;
  }
  const [first] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .orderBy(projectsTable.id)
    .limit(1);
  if (!first) throw new Error("No hay proyectos configurados");
  return first.id;
}

function cogsRowToFrontend(cogs: any, product: any): Record<string, any> {
  const currentPrice = parseFloat(product?.price ?? "0");
  const totalCogs = cogs?.totalCogs ?? 0;
  const margenBruto = currentPrice - totalCogs;
  const margenPct =
    currentPrice > 0 ? (margenBruto / currentPrice) * 100 : 0;

  return {
    costeUnitario: cogs?.unitCost ?? 0,
    materiales: cogs?.materialCost ?? 0,
    tejidos: cogs?.fabricCost ?? 0,
    impresionDigital: cogs?.printingCost ?? 0,
    serigrafia: cogs?.screenPrintingCost ?? 0,
    amortizacionMoldes: cogs?.moldAmortization ?? 0,
    montaje: cogs?.assemblyCost ?? 0,
    manoObra: cogs?.laborCostPerUnit ?? 0,
    controlCalidad: cogs?.qualityControlCost ?? 0,
    embalaje: cogs?.packagingCost ?? 0,
    etiquetado: cogs?.labelCost ?? 0,
    envioNacional: cogs?.shippingCostDomestic ?? 0,
    envioInternacional: cogs?.shippingCostInternational ?? 0,
    fulfillment: cogs?.fulfillmentFee ?? 0,
    almacenamiento: cogs?.warehouseCostPerUnit ?? 0,
    creditosIA: cogs?.aiApiCostPerUnit ?? 0,
    storageBandwidth: 0,
    paymentFees: cogs?.paymentProcessingFee ?? 0,
    rotura: cogs?.returnProcessingCost ?? 0,
    marketing: cogs?.digitalMarketingCost ?? 0,
    cogsTotal: totalCogs,
    cogsLow: Math.round(totalCogs * 0.85 * 100) / 100,
    cogsHigh: Math.round(totalCogs * 1.15 * 100) / 100,
    margenBruto: Math.round(margenBruto * 100) / 100,
    margenPct: Math.round(margenPct * 10) / 10,
    confidence: 0.7,
    warnings: [],
    assumptions: [],
    estimatedAt: cogs?.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function frontendToCogsValues(data: any): Record<string, any> {
  const vals: Record<string, any> = {};
  if (data.costeUnitario != null) vals.unitCost = data.costeUnitario;
  if (data.materiales != null) vals.materialCost = data.materiales;
  if (data.tejidos != null) vals.fabricCost = data.tejidos;
  if (data.impresionDigital != null) vals.printingCost = data.impresionDigital;
  if (data.serigrafia != null) vals.screenPrintingCost = data.serigrafia;
  if (data.amortizacionMoldes != null) vals.moldAmortization = data.amortizacionMoldes;
  if (data.montaje != null) vals.assemblyCost = data.montaje;
  if (data.manoObra != null) vals.laborCostPerUnit = data.manoObra;
  if (data.controlCalidad != null) vals.qualityControlCost = data.controlCalidad;
  if (data.embalaje != null) vals.packagingCost = data.embalaje;
  if (data.etiquetado != null) vals.labelCost = data.etiquetado;
  if (data.envioNacional != null) vals.shippingCostDomestic = data.envioNacional;
  if (data.envioInternacional != null) vals.shippingCostInternational = data.envioInternacional;
  if (data.fulfillment != null) vals.fulfillmentFee = data.fulfillment;
  if (data.almacenamiento != null) vals.warehouseCostPerUnit = data.almacenamiento;
  if (data.creditosIA != null) vals.aiApiCostPerUnit = data.creditosIA;
  if (data.paymentFees != null) vals.paymentProcessingFee = data.paymentFees;
  if (data.rotura != null) vals.returnProcessingCost = data.rotura;
  if (data.marketing != null) vals.digitalMarketingCost = data.marketing;
  if (data.cogsTotal != null) vals.totalCogs = data.cogsTotal;
  return vals;
}

function sumCogsFields(e: Record<string, number>): number {
  return (
    (e.costeUnitario ?? 0) + (e.materiales ?? 0) + (e.tejidos ?? 0) +
    (e.impresionDigital ?? 0) + (e.serigrafia ?? 0) + (e.amortizacionMoldes ?? 0) +
    (e.montaje ?? 0) + (e.manoObra ?? 0) + (e.controlCalidad ?? 0) +
    (e.embalaje ?? 0) + (e.etiquetado ?? 0) + (e.envioNacional ?? 0) +
    (e.envioInternacional ?? 0) + (e.fulfillment ?? 0) + (e.almacenamiento ?? 0) +
    (e.creditosIA ?? 0) + (e.storageBandwidth ?? 0) + (e.paymentFees ?? 0) +
    (e.rotura ?? 0) + (e.marketing ?? 0)
  );
}

function estimatedToCogsRow(est: Record<string, any>, projectId: number, shopifyProductId: string) {
  const cogsTotal = sumCogsFields(est);
  const finalTotal = cogsTotal > 0 ? Math.round(cogsTotal * 100) / 100 : (est.cogsTotal ?? 0);
  return {
    projectId,
    shopifyProductId,
    unitCost: est.costeUnitario ?? 0,
    materialCost: est.materiales ?? 0,
    fabricCost: est.tejidos ?? 0,
    printingCost: est.impresionDigital ?? 0,
    screenPrintingCost: est.serigrafia ?? 0,
    moldAmortization: est.amortizacionMoldes ?? 0,
    assemblyCost: est.montaje ?? 0,
    laborCostPerUnit: est.manoObra ?? 0,
    qualityControlCost: est.controlCalidad ?? 0,
    packagingCost: est.embalaje ?? 0,
    labelCost: est.etiquetado ?? 0,
    shippingCostDomestic: est.envioNacional ?? 0,
    shippingCostInternational: est.envioInternacional ?? 0,
    fulfillmentFee: est.fulfillment ?? 0,
    warehouseCostPerUnit: est.almacenamiento ?? 0,
    aiApiCostPerUnit: est.creditosIA ?? 0,
    paymentProcessingFee: est.paymentFees ?? 0,
    digitalMarketingCost: est.marketing ?? 0,
    returnProcessingCost: est.rotura ?? 0,
    totalCogs: finalTotal,
    totalCogsWithVat: Math.round(finalTotal * 1.21 * 100) / 100,
    breakEvenPrice: finalTotal,
    breakEvenPriceWithVat: Math.round(finalTotal * 1.21 * 100) / 100,
    minimumViablePrice: Math.round(finalTotal * 1.15 * 100) / 100,
  };
}

async function upsertCogsRow(values: Record<string, any>, projectId: number, shopifyProductId: string) {
  const [existing] = await db
    .select({ id: cogsTable.id })
    .from(cogsTable)
    .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));

  if (existing) {
    await db.update(cogsTable).set(values as any).where(eq(cogsTable.id, existing.id));
  } else {
    await db.insert(cogsTable).values(values as any);
  }
}

// ── 1. GET /pricing/products ─────────────────────────────────────────────────
router.get("/pricing/products", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);

    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.projectId, projectId));

    const allCogs = await db
      .select()
      .from(cogsTable)
      .where(eq(cogsTable.projectId, projectId));

    const cogsMap = new Map<string, any>();
    for (const c of allCogs) cogsMap.set(c.shopifyProductId, c);

    const result = products.map((p) => {
      const cogs = cogsMap.get(p.shopifyProductId);
      const currentPrice = parseFloat(p.price ?? "0");
      const images = p.imagesJson as any;
      const imageUrl =
        Array.isArray(images) && images.length > 0
          ? images[0]?.src ?? images[0]
          : undefined;

      return {
        id: p.shopifyProductId,
        shopifyId: parseInt(p.shopifyProductId, 10) || 0,
        title: p.title,
        imageUrl,
        currentPrice,
        compareAtPrice: p.compareAtPrice
          ? parseFloat(p.compareAtPrice)
          : undefined,
        currency: "EUR",
        imageScore: p.imageScore ?? undefined,
        grade: (p.auditGrade as any) ?? undefined,
        category: (p.productType as any) ?? undefined,
        cogsData: cogs ? cogsRowToFrontend(cogs, p) : undefined,
        lastEstimatedAt: cogs?.updatedAt?.toISOString() ?? undefined,
        hasOptimizedPrice: cogs?.lastPricingRecommendation != null,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 2. GET /pricing/kpis ─────────────────────────────────────────────────────
router.get("/pricing/kpis", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);

    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.projectId, projectId));

    const allCogs = await db
      .select()
      .from(cogsTable)
      .where(eq(cogsTable.projectId, projectId));

    const cogsMap = new Map<string, any>();
    for (const c of allCogs) cogsMap.set(c.shopifyProductId, c);

    let totalMargin = 0;
    let productsWithCOGS = 0;
    let productsLowMargin = 0;
    let productsCriticalMargin = 0;
    let totalEstimatedRevenue = 0;
    let potentialSavings = 0;

    for (const p of products) {
      const currentPrice = parseFloat(p.price ?? "0");
      totalEstimatedRevenue += currentPrice * 30;

      const cogs = cogsMap.get(p.shopifyProductId);
      if (cogs && cogs.totalCogs > 0) {
        productsWithCOGS++;
        const marginPct =
          currentPrice > 0
            ? ((currentPrice - cogs.totalCogs) / currentPrice) * 100
            : 0;
        totalMargin += marginPct;
        if (marginPct < 20) productsLowMargin++;
        if (marginPct < 15) productsCriticalMargin++;

        if (cogs.lastPricingRecommendation) {
          const rec = cogs.lastPricingRecommendation as any;
          const recPrice = rec.precioOptimo ?? rec.optimalPrice ?? 0;
          if (recPrice > currentPrice) {
            potentialSavings += (recPrice - currentPrice) * 30;
          }
        }
      }
    }

    res.json({
      totalProducts: products.length,
      productsWithCOGS,
      avgMarginPct:
        productsWithCOGS > 0
          ? Math.round((totalMargin / productsWithCOGS) * 10) / 10
          : 0,
      productsLowMargin,
      productsCriticalMargin,
      totalEstimatedRevenue: Math.round(totalEstimatedRevenue * 100) / 100,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 3. POST /pricing/classify-product ────────────────────────────────────────
router.post("/pricing/classify-product", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const { productId } = req.body as { productId: string };
    if (!productId) {
      res.status(400).json({ error: "productId requerido" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );

    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));

    const result = await askClaudeJsonWithBrain<{
      category: string;
      confidence: number;
    }>(
      projectId,
      `Clasifica este producto en una de estas categorías:
- digital_puro (software, NFTs, downloads, audiobooks, packs digitales)
- fisico (productos tangibles, envío requerido: ropa, pósters, lienzos, gadgets)
- servicio (consultoría, sesiones, coaching, cursos en vivo)
- hibrido (producto físico + digital, ej: libro + ebook)
- digital_hibrido (digital con componente físico menor, ej: curso online + material impreso)

Producto: "${product.title}"
Descripción: "${(product.bodyHtml ?? "").replace(/<[^>]+>/g, " ").slice(0, 800)}"
Tipo Shopify: "${product.productType ?? "sin tipo"}"
Vendor: "${product.vendor ?? "sin vendor"}"
Tags: "${product.tags ?? ""}"
Precio: €${product.price ?? "0"}

Responde JSON: { "category": "...", "confidence": 0.0-1.0 }`,
      "You are a product classification expert. Classify products accurately. Return ONLY valid JSON.",
      "cogs_estimation",
      project?.storeNiche ?? undefined,
      1024,
      30_000,
    );

    res.json({ category: result.category, confidence: result.confidence });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 4. POST /pricing/estimate-cogs ───────────────────────────────────────────
router.post("/pricing/estimate-cogs", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = await resolveProjectId(req);
    const { productId } = req.body as { productId: string };
    if (!productId) {
      res.status(400).json({ error: "productId requerido" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));

    if (!product || !project) {
      res.status(404).json({ error: "Producto o proyecto no encontrado" });
      return;
    }

    const niche = project.storeNiche ?? "e-commerce";
    const currentPrice = parseFloat(product.price ?? "0");

    let shopifyDetails = "";
    try {
      const { getProjectConnector } = await import("../lib/platform-helper.js");
      const connector = await getProjectConnector(projectId);
      if (connector && connector.supportsFeature("products")) {
        const liveProduct = await connector.getProduct(productId);
        shopifyDetails = `
Vendor: ${liveProduct.vendor || "desconocido"}
Tipo: ${liveProduct.productType || "sin tipo"}
Variantes: ${liveProduct.variants?.length ?? 1}
Peso: ${(liveProduct.variants?.[0] as any)?.weight ? `${(liveProduct.variants[0] as any).weight}g` : "desconocido"}
Requiere envío: ${(liveProduct.variants?.[0] as any)?.requires_shipping !== false ? "sí" : "no"}`;
      }
    } catch {}

    const prompt = `Estima los costes de producción (COGS) para este producto de e-commerce.

PRODUCTO:
- Título: "${product.title}"
- Precio actual: €${currentPrice}
- Tipo: "${product.productType ?? "sin definir"}"
- Vendor: "${product.vendor ?? "sin definir"}"
- Tags: "${product.tags ?? ""}"
- Descripción: "${(product.bodyHtml ?? "").replace(/<[^>]+>/g, " ").slice(0, 1000)}"
${shopifyDetails}

TIENDA:
- Nombre: "${project.name}"
- Nicho: "${niche}"
- Mercados: "${project.storeMarkets ?? "España"}"

INSTRUCCIONES:
Estima TODOS estos campos en euros por unidad. Sé realista y usa datos de mercado 2025-2026 para España/Europa.
Para productos digitales, los costes físicos serán 0 y los digitales (creditosIA, storageBandwidth, paymentFees) serán los relevantes.
Para productos físicos, estima materiales, envío, embalaje, etc. basándote en el tipo de producto y nicho.

Calcula:
- cogsTotal: suma de todos los costes
- cogsLow: estimación baja (-15%)
- cogsHigh: estimación alta (+15%)
- margenBruto: precio actual (€${currentPrice}) - cogsTotal
- margenPct: (margenBruto / precio actual) * 100
- confidence: 0-1 tu confianza en la estimación
- warnings: advertencias si hay riesgos
- assumptions: suposiciones que has hecho

Responde SOLO JSON con estos campos exactos:
{
  "costeUnitario": 0, "materiales": 0, "tejidos": 0, "impresionDigital": 0,
  "serigrafia": 0, "amortizacionMoldes": 0, "montaje": 0, "manoObra": 0,
  "controlCalidad": 0, "embalaje": 0, "etiquetado": 0, "envioNacional": 0,
  "envioInternacional": 0, "fulfillment": 0, "almacenamiento": 0,
  "creditosIA": 0, "storageBandwidth": 0, "paymentFees": 0,
  "rotura": 0, "marketing": 0,
  "cogsTotal": 0, "cogsLow": 0, "cogsHigh": 0,
  "margenBruto": 0, "margenPct": 0,
  "confidence": 0.7, "warnings": [], "assumptions": []
}`;

    const estimated = await askClaudeJsonWithBrain<Record<string, any>>(
      projectId,
      prompt,
      FINANCIAL_ANALYST_SYSTEM,
      "cogs_estimation",
      niche,
      4096,
      120_000,
    );

    const cogsTotal = sumCogsFields(estimated);
    const finalCogsTotal =
      cogsTotal > 0
        ? Math.round(cogsTotal * 100) / 100
        : (estimated.cogsTotal ?? 0);
    const margenBruto = Math.round((currentPrice - finalCogsTotal) * 100) / 100;
    const margenPct =
      currentPrice > 0
        ? Math.round(((currentPrice - finalCogsTotal) / currentPrice) * 1000) / 10
        : 0;

    const result = {
      ...estimated,
      cogsTotal: finalCogsTotal,
      cogsLow: Math.round(finalCogsTotal * 0.85 * 100) / 100,
      cogsHigh: Math.round(finalCogsTotal * 1.15 * 100) / 100,
      margenBruto,
      margenPct,
      estimatedAt: new Date().toISOString(),
    };

    const cogsValues = estimatedToCogsRow(estimated, projectId, productId);
    await upsertCogsRow(cogsValues, projectId, productId);

    learnFromOperation({
      operationType: "cogs_estimation",
      niche,
      title: `COGS estimado (flat): ${product.title}`,
      content: `Estimación COGS para "${product.title}": Total €${finalCogsTotal}, Margen ${margenPct}%. Confianza: ${(result as any).confidence ?? "n/a"}`,
      confidence: typeof (result as any).confidence === "number" ? (result as any).confidence : 0.7,
      tags: ["cogs", "estimation", "flat_pricing"],
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 5. POST /pricing/estimate-cogs/batch ─────────────────────────────────────
router.post("/pricing/estimate-cogs/batch", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const { productIds } = req.body as { productIds?: string[] };

    let targetProducts = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.projectId, projectId));

    if (productIds && productIds.length > 0) {
      targetProducts = targetProducts.filter((p) =>
        productIds.includes(p.shopifyProductId),
      );
    }

    if (targetProducts.length === 0) {
      res.status(400).json({ error: "No hay productos para estimar" });
      return;
    }

    const jobId = randomUUID();
    const estimatedCost = targetProducts.length * 0.03;

    const jobState: BatchJobState = {
      status: "running",
      current: 0,
      total: targetProducts.length,
      message: "Iniciando estimación batch...",
      errors: 0,
      startedAt: new Date().toISOString(),
    };
    batchJobs.set(jobId, jobState);

    (async () => {
      try {
        const [project] = await db
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, projectId));
        const niche = project?.storeNiche ?? "e-commerce";

        for (let i = 0; i < targetProducts.length; i++) {
          const job = batchJobs.get(jobId);
          if (!job || job.cancelled) {
            if (job) {
              job.status = "cancelled";
              job.message = `Cancelado en ${i}/${targetProducts.length}`;
              job.completedAt = new Date().toISOString();
            }
            return;
          }

          const product = targetProducts[i];
          job.current = i;
          job.message = `Estimando: ${product.title.slice(0, 40)}... (${i + 1}/${targetProducts.length})`;

          try {
            const currentPrice = parseFloat(product.price ?? "0");
            const prompt = `Estima COGS para: "${product.title}" (€${currentPrice}), tipo "${product.productType ?? "general"}", nicho "${niche}", mercado España/Europa.

Responde SOLO JSON: { "costeUnitario": 0, "materiales": 0, "tejidos": 0, "impresionDigital": 0, "serigrafia": 0, "amortizacionMoldes": 0, "montaje": 0, "manoObra": 0, "controlCalidad": 0, "embalaje": 0, "etiquetado": 0, "envioNacional": 0, "envioInternacional": 0, "fulfillment": 0, "almacenamiento": 0, "creditosIA": 0, "storageBandwidth": 0, "paymentFees": 0, "rotura": 0, "marketing": 0, "cogsTotal": 0, "confidence": 0.7, "warnings": [], "assumptions": [] }`;

            const estimated = await askClaudeJsonWithBrain<Record<string, any>>(
              projectId,
              prompt,
              FINANCIAL_ANALYST_SYSTEM,
              "cogs_estimation",
              niche,
              2048,
              60_000,
            );

            const cogsValues = estimatedToCogsRow(
              estimated,
              projectId,
              product.shopifyProductId,
            );
            await upsertCogsRow(
              cogsValues,
              projectId,
              product.shopifyProductId,
            );
          } catch {
            const job = batchJobs.get(jobId);
            if (job) job.errors++;
          }

          const jobAfter = batchJobs.get(jobId);
          if (jobAfter) jobAfter.current = i + 1;
        }

        const job = batchJobs.get(jobId);
        if (job && job.status !== "cancelled") {
          job.status =
            job.errors > 0 && job.errors >= job.total ? "error" : "completed";
          job.message =
            job.errors > 0
              ? `Completado con ${job.errors} errores de ${job.total}`
              : `${job.total} productos estimados correctamente`;
          job.completedAt = new Date().toISOString();
        }
      } catch (err) {
        // Sin este catch un fallo de BD dejaba el job "running" para siempre.
        logger.error({ err, jobId }, "COGS batch job failed");
        const job = batchJobs.get(jobId);
        if (job) {
          job.status = "error";
          job.message = "Error interno del lote de COGS";
          job.completedAt = new Date().toISOString();
        }
      } finally {
        setTimeout(() => batchJobs.delete(jobId), 10 * 60 * 1000);
      }
    })();

    res.json({
      jobId,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      total: targetProducts.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 6. GET /pricing/batch-progress/:jobId ────────────────────────────────────
router.get("/pricing/batch-progress/:jobId", async (req, res): Promise<void> => {
  try {
    const jobId = req.params.jobId;
    const job = batchJobs.get(jobId);

    if (!job) {
      res.json({
        status: "idle",
        current: 0,
        total: 0,
        message: "Job no encontrado o expirado",
        errors: 0,
      });
      return;
    }

    res.json({
      status: job.status,
      current: job.current,
      total: job.total,
      message: job.message,
      errors: job.errors,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 7. POST /pricing/batch-cancel/:jobId ─────────────────────────────────────
router.post("/pricing/batch-cancel/:jobId", async (req, res): Promise<void> => {
  try {
    const jobId = req.params.jobId;
    const job = batchJobs.get(jobId);

    if (!job) {
      res.json({ cancelled: false });
      return;
    }

    job.cancelled = true;
    job.status = "cancelled";
    job.message = "Cancelación solicitada...";

    res.json({ cancelled: true });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 8. PATCH /pricing/cogs/:productId ────────────────────────────────────────
router.patch("/pricing/cogs/:productId", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const shopifyProductId = req.params.productId;
    const data = req.body;

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, shopifyProductId),
        ),
      );

    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    const cogsVals = frontendToCogsValues(data);
    const total = cogsVals.totalCogs ?? 0;
    cogsVals.totalCogsWithVat = Math.round(total * 1.21 * 100) / 100;
    cogsVals.breakEvenPrice = total;
    cogsVals.breakEvenPriceWithVat = cogsVals.totalCogsWithVat;
    cogsVals.minimumViablePrice = Math.round(total * 1.15 * 100) / 100;

    await upsertCogsRow(
      { projectId, shopifyProductId, ...cogsVals },
      projectId,
      shopifyProductId,
    );

    const [updatedCogs] = await db
      .select()
      .from(cogsTable)
      .where(
        and(
          eq(cogsTable.projectId, projectId),
          eq(cogsTable.shopifyProductId, shopifyProductId),
        ),
      );

    res.json(cogsRowToFrontend(updatedCogs, product));
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 9. POST /pricing/simulate ────────────────────────────────────────────────
router.post("/pricing/simulate", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const {
      productId,
      priceVariation,
      monthlyVolume,
      conversionRate,
      customerAcquisitionCost,
    } = req.body as {
      productId: string;
      priceVariation: number;
      monthlyVolume: number;
      conversionRate: number;
      customerAcquisitionCost: number;
    };

    if (!productId) {
      res.status(400).json({ error: "productId requerido" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );
    const [cogs] = await db
      .select()
      .from(cogsTable)
      .where(
        and(
          eq(cogsTable.projectId, projectId),
          eq(cogsTable.shopifyProductId, productId),
        ),
      );

    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    const currentPrice = parseFloat(product.price ?? "0");
    const priceFactor = 1 + ((priceVariation ?? 0) / 100);
    const simulatedPrice = Math.round(currentPrice * priceFactor * 100) / 100;
    const totalCogs = cogs?.totalCogs ?? 0;
    const volume = monthlyVolume || 30;
    const cac = customerAcquisitionCost || 0;

    const projectedRevenue = Math.round(simulatedPrice * volume * 100) / 100;
    const projectedCOGS = Math.round(totalCogs * volume * 100) / 100;
    const grossProfit = Math.round((projectedRevenue - projectedCOGS) * 100) / 100;
    const totalCAC = Math.round(cac * volume * 100) / 100;
    const netProfit = Math.round((grossProfit - totalCAC) * 100) / 100;
    const breakEvenUnits =
      totalCogs > 0 && simulatedPrice > totalCogs
        ? Math.ceil(projectedCOGS / (simulatedPrice - totalCogs))
        : 0;
    const marginPct =
      projectedRevenue > 0
        ? Math.round((grossProfit / projectedRevenue) * 1000) / 10
        : 0;

    const sensitivityCurve = [];
    for (let pctChange = -30; pctChange <= 30; pctChange += 5) {
      const adjPrice = currentPrice * (1 + pctChange / 100);
      const adjRevenue = adjPrice * volume;
      const adjCogs = totalCogs * volume;
      const adjProfit = Math.round((adjRevenue - adjCogs - totalCAC) * 100) / 100;
      sensitivityCurve.push({ priceChange: pctChange, netProfit: adjProfit });
    }

    res.json({
      projectedRevenue,
      projectedCOGS,
      grossProfit,
      netProfit,
      breakEvenUnits,
      marginPct,
      sensitivityCurve,
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 10. POST /pricing/optimize ───────────────────────────────────────────────
router.post("/pricing/optimize", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = await resolveProjectId(req);
    const { productId } = req.body as { productId: string };
    if (!productId) {
      res.status(400).json({ error: "productId requerido" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    const [cogs] = await db
      .select()
      .from(cogsTable)
      .where(
        and(
          eq(cogsTable.projectId, projectId),
          eq(cogsTable.shopifyProductId, productId),
        ),
      );

    if (!product || !project) {
      res.status(404).json({ error: "Producto o proyecto no encontrado" });
      return;
    }

    const niche = project.storeNiche ?? "e-commerce";
    const currentPrice = parseFloat(product.price ?? "0");
    const totalCogs = cogs?.totalCogs ?? 0;

    const prompt = `Optimiza el precio del producto "${product.title}" para la tienda "${project.name}".

DATOS:
- Precio actual: €${currentPrice}
- COGS total: €${totalCogs}
- Margen actual: ${currentPrice > 0 ? Math.round(((currentPrice - totalCogs) / currentPrice) * 100) : 0}%
- Tipo: "${product.productType ?? "general"}"
- Nicho: "${niche}"
- Mercados: "${project.storeMarkets ?? "España"}"
- Audiencia: "${project.targetAudience ?? "adultos"}"
- Tono marca: "${project.brandTone ?? "profesional"}"
- Break-even: €${cogs?.breakEvenPrice ?? totalCogs}

REGLAS:
1. El precio óptimo DEBE ser > COGS + 30% mínimo
2. Usa psicología de precios (charm pricing, anclas, etc.)
3. Considera elasticidad típica del nicho "${niche}"
4. Precio conservador = seguro, bajo riesgo
5. Precio agresivo = máximo margen, riesgo aceptable

Responde SOLO JSON:
{
  "precioOptimo": 0,
  "precioConservador": 0,
  "precioAgresivo": 0,
  "margenObjetivo": 0,
  "justificacion": "texto en español con razonamiento detallado",
  "riesgos": ["riesgo1", "riesgo2"],
  "abTestSugerido": {
    "variantA": 0,
    "variantB": 0,
    "duracionDias": 14,
    "traficoMinimo": 500
  },
  "upsellOportunidades": ["oportunidad1", "oportunidad2"]
}`;

    const result = await askClaudeJsonWithBrain<{
      precioOptimo: number;
      precioConservador: number;
      precioAgresivo: number;
      margenObjetivo: number;
      justificacion: string;
      riesgos: string[];
      abTestSugerido: {
        variantA: number;
        variantB: number;
        duracionDias: number;
        traficoMinimo: number;
      };
      upsellOportunidades: string[];
    }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "pricing", niche, 4096, 120_000);

    if (!result.riesgos) result.riesgos = [];
    if (!result.upsellOportunidades) result.upsellOportunidades = [];
    if (!result.abTestSugerido) {
      result.abTestSugerido = {
        variantA: result.precioConservador ?? currentPrice,
        variantB: result.precioOptimo ?? currentPrice,
        duracionDias: 14,
        traficoMinimo: 500,
      };
    }

    if (cogs) {
      await db
        .update(cogsTable)
        .set({
          lastPricingRecommendation: result as Record<string, unknown>,
        })
        .where(
          and(
            eq(cogsTable.projectId, projectId),
            eq(cogsTable.shopifyProductId, productId),
          ),
        );
    }

    learnFromOperation({
      operationType: "pricing_optimization",
      niche,
      title: `Optimización precio: ${product.title}`,
      content: `Precio actual €${currentPrice} → Óptimo €${result.precioOptimo}, Conservador €${result.precioConservador}, Agresivo €${result.precioAgresivo}. Margen objetivo: ${result.margenObjetivo}%`,
      confidence: 0.8,
      tags: ["pricing", "optimization", niche],
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 11. PATCH /pricing/apply ─────────────────────────────────────────────────
router.patch("/pricing/apply", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const { productId, newPrice } = req.body as {
      productId: string;
      newPrice: number;
    };

    if (!productId || newPrice == null || isNaN(Number(newPrice)) || Number(newPrice) <= 0) {
      res.status(400).json({ error: "productId y newPrice requeridos (newPrice debe ser un número > 0)" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));

    if (!product || !project) {
      res.status(404).json({ error: "Producto o proyecto no encontrado" });
      return;
    }

    const oldPrice = parseFloat(product.price ?? "0");
    const priceStr = String(newPrice);

    try {
      const { updateStoreProduct } = await import("../lib/platform-helper.js");
      const updateResult = await updateStoreProduct(projectId, productId, {
        price: priceStr,
        compareAtPrice: null,
        variants: [
          {
            platformId: "",
            title: "",
            price: priceStr,
            compareAtPrice: undefined,
          },
        ],
      });
      if (!updateResult.ok) {
        res.status(400).json({ error: updateResult.error });
        return;
      }
    } catch (shopifyErr: any) {
      res.status(500).json({
        error: `Error actualizando en la plataforma: ${shopifyErr.message}`,
      });
      return;
    }

    await db
      .update(productsTable)
      .set({ price: priceStr })
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );

    await db.insert(priceHistoryTable).values({
      projectId,
      shopifyProductId: productId,
      oldPrice,
      newPrice,
      changeSource: "pricing_module",
    });

    learnFromOperation({
      operationType: "price_change",
      title: `Precio aplicado: ${product.title}`,
      content: `Cambio de precio: €${oldPrice} → €${newPrice} para "${product.title}"`,
      confidence: 1.0,
      tags: ["pricing", "price_change"],
    });

    res.json({ success: true, productId });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

// ── 12. POST /pricing/ab-test ────────────────────────────────────────────────
router.post("/pricing/ab-test", async (req, res): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const { productId, priceA, priceB, durationDays } = req.body as {
      productId: string;
      priceA: number;
      priceB: number;
      durationDays: number;
    };

    if (!productId || priceA == null || priceB == null || isNaN(Number(priceA)) || isNaN(Number(priceB)) || Number(priceA) < 0 || Number(priceB) < 0) {
      res.status(400).json({ error: "productId, priceA y priceB requeridos (valores numéricos >= 0)" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.projectId, projectId),
          eq(productsTable.shopifyProductId, productId),
        ),
      );

    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (durationDays || 14));

    const [inserted] = await db
      .insert(abTestsTable)
      .values({
        projectId,
        shopifyProductId: productId,
        productTitle: product.title,
        testType: "price",
        imageType: "price_test",
        hypothesis: `Test A/B de precios: €${priceA} vs €${priceB} durante ${durationDays || 14} días`,
        variantAPrice: String(priceA),
        variantBPrice: String(priceB),
        status: "running",
        targetMetric: "revenue",
        minimumSampleSize: 100,
        endDate,
      })
      .returning({ id: abTestsTable.id });

    res.json({ testId: String(inserted?.id ?? randomUUID()) });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error interno" });
  }
});

export default router;
