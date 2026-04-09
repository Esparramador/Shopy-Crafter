import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, cogsTable, priceHistoryTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude";
import { askGeminiWithSearch } from "../lib/gemini.js";
import { getConnector } from "../lib/connectors/index.js";
import { updateCogsBenchmark } from "../lib/cogs-benchmarks.js";

const router = Router();

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

function psychologicalPrice(price: number): number {
  if (price < 10) return Math.floor(price) - 0.01 + 1;
  if (price < 20) return Math.floor(price) + 0.95;
  if (price < 50) return Math.round(price / 5) * 5 - 0.05;
  if (price < 100) return Math.round(price / 10) * 10 - 0.01;
  if (price < 500) return Math.round(price / 10) * 10 - 1;
  return Math.round(price / 50) * 50 - 1;
}

router.get("/projects/:projectId/products/:productId/cogs", async (req, res): Promise<void> => {
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
});

router.post("/projects/:projectId/products/:productId/cogs", async (req, res): Promise<void> => {
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
});

router.post("/projects/:projectId/products/:productId/calculate-optimal-price", async (req, res): Promise<void> => {
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

    if (compResult.status === "fulfilled") {
      const jsonMatch = compResult.value.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        competitorResearch = { ...competitorResearch, ...parsed };
      }
    }
    if (suppResult.status === "fulfilled") {
      const jsonMatch = suppResult.value.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        supplierResearch = { ...supplierResearch, ...parsed };
      }
    }
  } catch {}

  const cogsTotal = cogs?.totalCogs ?? 0;
  const cogsInfo = cogs ? `COGS total calculado: €${cogsTotal}, Precio mínimo viable: €${cogs.minimumViablePrice}, Break-even: €${cogs.breakEvenPrice}` : "COGS: no configurado — usa los datos de proveedores para estimar";

  const competitorDataStr = competitorResearch.competitorPrices.length > 0
    ? `PRECIOS REALES DE COMPETIDORES (datos de mercado actual):\n${competitorResearch.competitorPrices.map(c => `  - ${c.source}: €${c.price} ${c.productName ? `(${c.productName})` : ""} ${c.url ? `[${c.url}]` : ""}`).join("\n")}\n  Rango de mercado: €${competitorResearch.marketPriceRange.min} - €${competitorResearch.marketPriceRange.max} (mediana: €${competitorResearch.marketPriceRange.median})\n  Posición actual en mercado: ${competitorResearch.marketPosition}`
    : "Sin datos de competidores disponibles — estima basándote en tu conocimiento del nicho";

  const supplierDataStr = supplierResearch.supplierPrices.length > 0
    ? `PRECIOS REALES DE PROVEEDORES:\n${supplierResearch.supplierPrices.map(s => `  - ${s.supplier}: ${s.priceRange} ${s.moq ? `(MOQ: ${s.moq})` : ""} ${s.origin ? `[${s.origin}]` : ""}`).join("\n")}\n  Coste medio proveedor: €${supplierResearch.avgSupplierCost}\n  Insight: ${supplierResearch.supplierInsight}`
    : "Sin datos de proveedores disponibles";

  const prompt = `Calcula el precio óptimo para el producto "${product.title}" de la tienda "${project.name}".

${cogsInfo}

${competitorDataStr}

${supplierDataStr}

CONTEXTO DE LA TIENDA:
Nicho: ${niche}
Audiencia: ${project.targetAudience ?? "adultos"}
Tono de marca: ${project.brandTone ?? "profesional"}
Mercados: ${project.storeMarkets ?? "España"}
Precio actual: €${currentPrice}

REGLAS CRÍTICAS DE PRICING:
- El precio DEBE ser COHERENTE con los datos reales de mercado encontrados
- NO pongas precios irrisorios (demasiado bajos destruyen percepción de valor)
- NO pongas precios inflados sin justificación (mata conversión)
- El precio debe posicionar el producto correctamente según la calidad y el nicho
- Si la mediana de mercado es €X, el precio óptimo debe estar justificado respecto a esa mediana
- Margen mínimo viable: 30% sobre COGS para cubrir operaciones
- Si el precio actual difiere mucho del mercado, explica POR QUÉ y sugiere cambio gradual

Calcula:
1. Precio matemáticamente óptimo para máximo profit (basado en datos REALES)
2. Precio psicológico para máxima conversión (charm pricing: .99, .95, etc.)
3. Compare_at_price (30% más alto mínimo, psicológico para anclar)
4. Estrategia recomendada (posicionamiento vs competencia)
5. Waterfall de márgenes (desglose de cada €1 de revenue)
6. Advertencias de margen si hay riesgo
7. Sugerencias de bundle para aumentar AOV
8. Proyección de revenue mensual estimado
9. Análisis comparativo: tu precio actual vs mediana de mercado vs precio sugerido
10. Impacto estimado del cambio de precio en ventas

Devuelve JSON con: optimalPrice (number), psychologicalPrice (number), compareAtPrice (number), recommendedStrategy (string), marginWaterfall (objeto con: revenue, platformFees, cogs, packaging, shipping, returns, marketing, overhead, netMargin, netMarginPct), reasoning (string en español detallado), marginWarnings (array strings), bundleSuggestions (array strings), monthlyRevenueProjection (number|null), competitorAnalysis (string — resumen de datos encontrados), supplierAnalysis (string — resumen de costes proveedor), priceImpactEstimate (objeto con: currentPrice, suggestedPrice, expectedSalesChange (string), expectedRevenueChange (string), confidenceLevel (string)).`;

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
    }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "pricing", niche, 8192);
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

  if (cogs) {
    await db.update(cogsTable)
      .set({ lastPricingRecommendation: result as Record<string, unknown>, lastCompetitorAnalysis: lastCompetitorAnalysis as Record<string, unknown> })
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  }

  learnFromOperation({
    operationType: "pricing_analysis",
    niche: niche,
    productType: product.productType ?? null,
    title: `Análisis pricing: ${product.title}`,
    content: `Precio actual: €${currentPrice}. Óptimo: €${result.optimalPrice}. Psicológico: €${result.psychologicalPrice}. Mediana mercado: €${competitorResearch.marketPriceRange.median}. Competidores: ${competitorResearch.competitorPrices.length} encontrados. Proveedores: coste medio €${supplierResearch.avgSupplierCost}. Estrategia: ${result.recommendedStrategy}. Margen neto: ${result.marginWaterfall?.netMarginPct ?? "?"}%.`,
    confidence: competitorResearch.competitorPrices.length >= 5 ? 0.85 : 0.6,
    tags: ["pricing", "optimal_price", "competitor_analysis", product.productType ?? "general"],
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
});

router.post("/projects/:projectId/products/:productId/apply-price", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const { price, compareAtPrice } = req.body as { price: string; compareAtPrice?: string };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  try {
    const connector = getConnector(project as any);
    await connector.updateProduct(shopifyProductId, {
      variants: [{ platformId: "", title: "", price, compareAtPrice: compareAtPrice ?? undefined }],
    } as any);
  } catch (connectorErr: any) {
    if (connectorErr?.name === "PlatformNotSupportedError" || connectorErr?.name === "FeatureNotSupportedError") {
      await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}.json`, {
        method: "PUT",
        body: JSON.stringify({
          product: {
            variants: [{ price, compare_at_price: compareAtPrice ?? null }],
          },
        }),
      });
    } else {
      throw connectorErr;
    }
  }

  await db.update(productsTable)
    .set({ price, compareAtPrice: compareAtPrice ?? null })
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));

  const platformName = (project as any).platformType || "Shopify";
  res.json({ success: true, message: `Precio €${price} aplicado correctamente en ${platformName}` });
});

router.get("/projects/:projectId/financial-dashboard", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let grossRevenue = 0;
  let aov = 0;
  let orderCount = 0;
  const productSales = new Map<string, { units: number; revenue: number }>();

  try {
    const ordersData = await shopifyRequest<{ orders: Array<{ total_price: string; line_items: Array<{ product_id: number; quantity: number; price: string }> }> }>(
      projectId,
      project.shopDomain,
      `/orders.json?status=any&created_at_min=${thirtyDaysAgo}&limit=250`
    );
    orderCount = ordersData.orders.length;
    grossRevenue = ordersData.orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    aov = orderCount > 0 ? grossRevenue / orderCount : 0;

    for (const order of ordersData.orders) {
      for (const item of order.line_items) {
        const pid = String(item.product_id);
        const existing = productSales.get(pid) ?? { units: 0, revenue: 0 };
        existing.units += item.quantity;
        existing.revenue += item.quantity * parseFloat(item.price);
        productSales.set(pid, existing);
      }
    }
  } catch {
    grossRevenue = 0;
    aov = 0;
  }

  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));

  const productProfitability = products.slice(0, 50).map((p) => {
    const cogs = allCogs.find((c) => c.shopifyProductId === p.shopifyProductId);
    const sales = productSales.get(p.shopifyProductId);
    const unitsSold = sales?.units ?? 0;
    const revenue = sales?.revenue ?? 0;
    const cogsTotal = cogs?.totalCogs ?? 0;
    const profit = revenue - cogsTotal * unitsSold;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const grade = margin >= 40 ? "A" : margin >= 20 ? "B" : margin >= 10 ? "C" : "F";
    return {
      productId: p.shopifyProductId,
      title: p.title,
      unitsSold,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogsTotal * unitsSold * 100) / 100,
      grossProfit: Math.round(profit * 100) / 100,
      marginPct: Math.round(margin * 10) / 10,
      grade,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalCogsAgg = productProfitability.reduce((sum, p) => sum + p.cogs, 0);
  const grossProfit = grossRevenue - totalCogsAgg;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  const alerts: string[] = [];
  if (grossMarginPct < 20) alerts.push("⚠️ Margen bruto global por debajo del 20% — revisar estructura de costes");
  const lowMarginProducts = productProfitability.filter((p) => p.marginPct < 15);
  if (lowMarginProducts.length > 0) alerts.push(`${lowMarginProducts.length} productos con margen < 15% — riesgo de pérdida con devoluciones`);

  res.json({
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    totalCogs: Math.round(totalCogsAgg * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMarginPct: Math.round(grossMarginPct * 10) / 10,
    netMarginPct: Math.round((grossMarginPct - 10) * 10) / 10,
    aov: Math.round(aov * 100) / 100,
    cac: null,
    ltvCacRatio: null,
    productProfitability,
    alerts,
  });
});

// ── AI COGS AUTO-ESTIMATION ────────────────────────────────────────────────────
router.post("/projects/:projectId/products/:productId/ai-estimate-cogs", async (req, res): Promise<void> => {
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
    const live = await shopifyRequest<{ product: Record<string, unknown> }>(
      projectId, project.shopDomain, `/products/${shopifyProductId}.json`
    );
    const p = live.product;
    const variants = (p.variants as Array<Record<string, unknown>>) || [];
    const weight = variants[0]?.weight ? `${variants[0].weight} ${variants[0].weight_unit || "g"}` : "desconocido";
    shopifyDetails = `
Peso del producto: ${weight}
SKU: ${variants[0]?.sku || "sin SKU"}
Barcode: ${variants[0]?.barcode || "sin barcode"}
Vendor: ${p.vendor || "desconocido"}
Tipo de producto: ${p.product_type || "sin tipo"}
Variantes: ${variants.length} (precios: ${variants.map((v: Record<string, unknown>) => `€${v.price}`).join(", ")})
`;
  } catch {}

  const productType = product.productType || "producto general";
  const niche = project.storeNiche || "e-commerce";

  let productClassification = {
    category: "physical" as string,
    manufacturingMethod: "unknown" as string,
    estimatedWeight: "500g" as string,
    materialComposition: [] as string[],
    shippingCategory: "standard" as string,
    searchTerms: {
      material: product.title,
      shipping: "paquete pequeño",
      supplier: product.title,
      packaging: `Packaging ecommerce para ${productType} España precios`,
    },
  };

  try {
    const classResult = await askClaudeJsonWithBrain<{
      category: string;
      manufacturingMethod: string;
      estimatedWeight: string;
      estimatedDimensions: string;
      materialComposition: string[];
      complexityLevel: string;
      isFragile: boolean;
      shippingCategory: string;
      specificSearchQueries: {
        materialSearch: string;
        shippingSearch: string;
        supplierSearch: string;
        packagingSearch: string;
      };
    }>(projectId,
      `Clasifica este producto para estimar costes de producción:
       Título: "${product.title}"
       Descripción: "${(product.bodyHtml ?? "").replace(/<[^>]+>/g, " ").slice(0, 1500)}"
       Tipo: "${productType}"
       Vendor: "${product.vendor}"
       Precio: €${product.price}
       ${shopifyDetails}
       
       RESPONDE con JSON:
       {
         "category": "physical|digital|service|subscription",
         "manufacturingMethod": "handmade|3d_printed|injection_molded|textile|assembled|wholesale_resale|dropship|print_on_demand|food|cosmetic|electronic|artisan|jewellery|paper_print",
         "estimatedWeight": "Xg o Xkg",
         "estimatedDimensions": "largo x ancho x alto cm",
         "materialComposition": ["material1", "material2"],
         "complexityLevel": "simple|medium|complex|very_complex",
         "isFragile": false,
         "shippingCategory": "standard|oversized|fragile|hazmat|cold_chain",
         "specificSearchQueries": {
           "materialSearch": "la query EXACTA para buscar en Google los materiales de este producto con precios",
           "shippingSearch": "la query EXACTA para buscar tarifas de envío para este tipo/peso de producto",
           "supplierSearch": "la query EXACTA para buscar proveedores/fabricantes de este tipo de producto",
           "packagingSearch": "la query EXACTA para buscar packaging específico para este producto"
         }
       }`,
      "You are a manufacturing and supply chain expert. Classify this product for cost estimation. Return ONLY valid JSON.",
      "cogs_estimation",
      niche,
      2048, 30_000
    );

    productClassification = {
      ...productClassification,
      ...classResult,
      searchTerms: {
        material: classResult.specificSearchQueries?.materialSearch ?? product.title,
        shipping: classResult.specificSearchQueries?.shippingSearch ?? "envío paquete ecommerce",
        supplier: classResult.specificSearchQueries?.supplierSearch ?? product.title,
        packaging: classResult.specificSearchQueries?.packagingSearch ?? `Packaging ecommerce para ${productType} España precios`,
      },
    };
  } catch (err) {
    // Classification failed — use defaults
  }

  let materialResearch = { materials: [] as Array<{ material: string; priceRange: string; source: string; url?: string }>, avgMaterialCost: 0, insight: "" };
  let shippingResearch = { carriers: [] as Array<{ carrier: string; domestic: string; international: string; source: string }>, insight: "" };
  let supplierResearch = { suppliers: [] as Array<{ supplier: string; priceRange: string; moq?: string; origin?: string; url?: string }>, avgCost: 0, insight: "" };
  let packagingResearch = { items: [] as Array<{ item: string; pricePerUnit: number; source: string }>, totalPackagingCost: 0, insight: "" };
  const researchWarnings: string[] = [];

  try {
    const [matResult, shipResult, suppResult, packResult] = await Promise.allSettled([
      askGeminiWithSearch(
        `${productClassification.searchTerms.material}

Busca PRECIOS REALES en: AliExpress, Amazon, proveedores industriales España.
Materiales necesarios: ${productClassification.materialComposition.join(", ") || "detectar del tipo de producto"}.
Método fabricación: ${productClassification.manufacturingMethod}.

JSON: { "materials": [{"material": "", "priceRange": "€", "source": "", "url": ""}], 
"avgMaterialCost": 0, "insight": "" }`,
        "Supply chain cost analyst. Search for REAL prices. ONLY JSON."
      ),
      askGeminiWithSearch(
        `${productClassification.searchTerms.shipping}

Peso estimado: ${productClassification.estimatedWeight}.
Categoría envío: ${productClassification.shippingCategory}.
Busca tarifas 2025-2026 de: Correos Express, SEUR, MRW, Nacex, GLS, DHL.
Para envío NACIONAL España y a EUROPA.

JSON: { "carriers": [{"carrier": "", "domestic": "€", "international": "€", "source": ""}], 
"insight": "", "recommendedCarrier": "" }`,
        "Logistics analyst. Current Spanish carrier rates. ONLY JSON."
      ),
      askGeminiWithSearch(
        `${productClassification.searchTerms.supplier}

Busca en Alibaba, AliExpress mayorista, fabricantes españoles de ${niche}.
Método: ${productClassification.manufacturingMethod}.

JSON: { "suppliers": [{"supplier": "", "priceRange": "€/ud", "moq": "", "origin": "", "url": ""}], 
"avgCost": 0, "insight": "" }`,
        "Manufacturing sourcing analyst. REAL supplier prices. ONLY JSON."
      ),
      askGeminiWithSearch(
        `${productClassification.searchTerms.packaging}

Busca en: rajapack.es, uline, amazon.es cajas envío, kartox.com.
Incluir: caja, relleno protector, cinta, etiqueta, bolsa.
Producto: ${productClassification.shippingCategory === "fragile" ? "FRÁGIL — necesita protección extra" : "estándar"}.

JSON: { "items": [{"item": "", "pricePerUnit": 0, "source": ""}], 
"totalPackagingCost": 0, "insight": "" }`,
        "Packaging procurement analyst. ONLY JSON."
      ),
    ]);

    if (matResult.status === "fulfilled") {
      try {
        const jsonMatch = matResult.value.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) materialResearch = { ...materialResearch, ...JSON.parse(jsonMatch[0]) };
      } catch { researchWarnings.push("Error parseando datos de materiales de Google Search"); }
    } else { researchWarnings.push("Búsqueda de materiales falló: " + (matResult.status === "rejected" ? String(matResult.reason) : "desconocido")); }

    if (shipResult.status === "fulfilled") {
      try {
        const jsonMatch = shipResult.value.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) shippingResearch = { ...shippingResearch, ...JSON.parse(jsonMatch[0]) };
      } catch { researchWarnings.push("Error parseando datos de envío de Google Search"); }
    } else { researchWarnings.push("Búsqueda de tarifas de envío falló"); }

    if (suppResult.status === "fulfilled") {
      try {
        const jsonMatch = suppResult.value.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) supplierResearch = { ...supplierResearch, ...JSON.parse(jsonMatch[0]) };
      } catch { researchWarnings.push("Error parseando datos de proveedores de Google Search"); }
    } else { researchWarnings.push("Búsqueda de proveedores falló"); }

    if (packResult.status === "fulfilled") {
      try {
        const jsonMatch = packResult.value.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) packagingResearch = { ...packagingResearch, ...JSON.parse(jsonMatch[0]) };
      } catch { researchWarnings.push("Error parseando datos de packaging de Google Search"); }
    } else { researchWarnings.push("Búsqueda de packaging falló"); }
  } catch (e) { researchWarnings.push("Error general en investigación de mercado: " + (e instanceof Error ? e.message : "desconocido")); }

  const materialDataStr = materialResearch.materials.length > 0
    ? `PRECIOS REALES DE MATERIALES (investigados via Google Search):\n${materialResearch.materials.map(m => `  - ${m.material}: ${m.priceRange} [${m.source}] ${m.url ? `(${m.url})` : ""}`).join("\n")}\n  Coste medio material: €${materialResearch.avgMaterialCost}\n  Insight: ${materialResearch.insight}`
    : "Sin datos de materiales encontrados en búsqueda — estima basándote en conocimiento del sector";

  const shippingDataStr = shippingResearch.carriers.length > 0
    ? `TARIFAS REALES DE ENVÍO (investigadas via Google Search):\n${shippingResearch.carriers.map(c => `  - ${c.carrier}: Nacional ${c.domestic}, Internacional ${c.international} [${c.source}]`).join("\n")}\n  Insight: ${shippingResearch.insight}`
    : "Sin datos de envío encontrados — usa tarifas estándar españolas";

  const supplierDataStr = supplierResearch.suppliers.length > 0
    ? `PRECIOS REALES DE PROVEEDORES/FABRICANTES (investigados via Google Search):\n${supplierResearch.suppliers.map(s => `  - ${s.supplier}: ${s.priceRange} ${s.moq ? `(MOQ: ${s.moq})` : ""} ${s.origin ? `[${s.origin}]` : ""} ${s.url ? `(${s.url})` : ""}`).join("\n")}\n  Coste medio proveedor: €${supplierResearch.avgCost}\n  Insight: ${supplierResearch.insight}`
    : "Sin datos de proveedores encontrados";

  const packagingDataStr = packagingResearch.items.length > 0
    ? `PRECIOS REALES DE PACKAGING (investigados via Google Search):\n${packagingResearch.items.map(p => `  - ${p.item}: €${p.pricePerUnit}/ud [${p.source}]`).join("\n")}\n  Coste packaging total: €${packagingResearch.totalPackagingCost}\n  Insight: ${packagingResearch.insight}`
    : "Sin datos de packaging encontrados";

  const classificationStr = productClassification.manufacturingMethod !== "unknown"
    ? `\nCLASIFICACIÓN DEL PRODUCTO (pre-análisis IA):
  - Categoría: ${productClassification.category}
  - Método fabricación: ${productClassification.manufacturingMethod}
  - Peso estimado: ${productClassification.estimatedWeight}
  - Materiales: ${productClassification.materialComposition.join(", ") || "no clasificados"}
  - Categoría envío: ${productClassification.shippingCategory}`
    : "";

  const prompt = `Eres un experto en costes de producción, logística, fabricación, materiales, envíos e impuestos con 20 años de experiencia.

PRODUCTO A ANALIZAR:
- Título: "${product.title}"
- Precio de venta: €${product.price || "sin configurar"}
- Tipo: ${product.productType || "sin definir"}
- Vendor: ${product.vendor || "sin definir"}
- Imágenes: ${product.imageCount || 0}
- Tags: ${product.tags || "ninguno"}
- Tienda: "${project.name}" (Nicho: ${niche})
- Mercados: ${project.storeMarkets || "España"}
${shopifyDetails}

=== DATOS REALES DE MERCADO (investigados con Google Search en tiempo real) ===
${classificationStr}

${materialDataStr}

${shippingDataStr}

${supplierDataStr}

${packagingDataStr}

=== FIN DATOS REALES ===

Tu tarea es CALCULAR todos los costes de producción y operación basándote en los DATOS REALES anteriores.
REGLAS CRÍTICAS:
1. USA los precios REALES de materiales/proveedores/envío encontrados arriba como BASE de tu estimación
2. Si hay datos reales, NO los ignores ni los sustituyas por estimaciones genéricas
3. Complementa con tu conocimiento SOLO los campos donde no hay datos reales
4. Los costes de plataforma Shopify son fijos: 2.9% + 0.30€ por transacción en plan Basic
5. IVA España 21%, impuesto sociedades 25%

IMPORTANTE: Proporciona DOS escenarios:
1. "ownEquipment" — Producción propia (taller/equipos propios, amortización incluida)
2. "externalService" — Servicio externo (fabricación/producción externalizada)

Para CADA escenario, estima estos campos (en euros, por unidad):
unitCost, materialCost, fabricCost, printingCost, screenPrintingCost, moldAmortization, assemblyCost, laborCostPerUnit, qualityControlCost, packagingCost, labelCost, shippingCostDomestic, shippingCostInternational, fulfillmentFee, warehouseCostPerUnit, customsDuty, insuranceCost, returnRate (decimal), returnProcessingCost, shopifyPaymentFee (decimal), shopifyPlanCostPerOrder, paymentProcessingFee, platformCommission, cac, affiliateFee, digitalMarketingCost, influencerCostPerUnit, seoCostPerUnit, vatRate (decimal), corporateTaxRate (decimal), consultingFee, legalCostPerUnit, aiApiCostPerUnit, designCostPerUnit, overheadPerUnit

También incluye:
- reasoning: explicación detallada citando las FUENTES REALES de cada dato
- shippingBreakdown: desglose por transportista { carrier, domestic, international, estimatedWeight }[]
- materialBreakdown: desglose de materiales { material, costPerUnit, notes, source }[]
- supplierOptions: opciones de proveedor encontradas { name, unitCost, moq, origin }[]
- productionMethod: método de producción identificado
- colorComplexity: complejidad de color
- dataQuality: "real" si usaste datos de Google Search, "partial" si mezclaste, "estimated" si no había datos

Devuelve JSON: { ownEquipment: {...}, externalService: {...}, reasoning, shippingBreakdown, materialBreakdown, supplierOptions, productionMethod, colorComplexity, confidenceLevel: "high"|"medium"|"low", dataQuality, realSourcesCount }

IMPORTANTE: Cita las fuentes reales en el reasoning. Responde SOLO el JSON.`;

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
});

// ── T001: SIMULADOR DE PRECIO ─────────────────────────────────────────────────
router.post("/projects/:projectId/products/:productId/price-simulator", async (req, res): Promise<void> => {
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
});

// ── T002: ELASTICIDAD DE PRECIO (datos históricos reales) ─────────────────────
router.get("/projects/:projectId/products/:productId/price-elasticity", async (req, res): Promise<void> => {
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
});

// ── T003: P&L FORECAST PREDICTIVO (3/6/12 meses) ─────────────────────────────
router.post("/projects/:projectId/financial-forecast", async (req, res): Promise<void> => {
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
});

export default router;
