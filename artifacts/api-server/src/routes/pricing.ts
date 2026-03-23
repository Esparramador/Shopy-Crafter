import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, cogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaude, askClaudeJson, askClaudeJsonWithBrain } from "../lib/claude";

const router = Router();

const FINANCIAL_ANALYST_SYSTEM = `You are a senior financial analyst and pricing strategist with 20 years experience in e-commerce and retail economics. You combine:

ECONOMICS: Price elasticity, supply/demand curves, market equilibrium, consumer surplus, willingness-to-pay theory.
FINANCE: Contribution margin, gross margin, EBITDA, break-even analysis, unit economics, LTV/CAC ratio.
STRATEGY: Porter's Five Forces applied to pricing, competitive moats, price positioning.
PSYCHOLOGY: Anchoring effect, charm pricing, decoy pricing, bundle psychology, perceived value, scarcity pricing.
SHOPIFY SPECIFICS: Shopify fee structures, payment processor margins, return rate benchmarks, seasonal pricing patterns.

Always show your reasoning with specific numbers. Never give vague advice. Respond in Spanish.`;

function calculateCogs(data: {
  unitCost: number; packagingCost: number; labelCost: number;
  shippingCostDomestic: number; fulfillmentFee: number; returnRate: number;
  returnProcessingCost: number; shopifyPaymentFee: number; shopifyPlanCostPerOrder: number;
  cac: number; affiliateFee: number; overheadPerUnit: number; finalPrice?: number;
}): { totalCogs: number; breakEvenPrice: number; minimumViablePrice: number } {
  const price = data.finalPrice ?? 0;
  const totalCogs =
    data.unitCost + data.packagingCost + data.labelCost +
    data.shippingCostDomestic + data.fulfillmentFee +
    (data.returnRate * data.returnProcessingCost) +
    (price * data.shopifyPaymentFee) +
    data.shopifyPlanCostPerOrder + data.cac + data.affiliateFee + data.overheadPerUnit;

  return {
    totalCogs: Math.round(totalCogs * 100) / 100,
    breakEvenPrice: Math.round(totalCogs * 100) / 100,
    minimumViablePrice: Math.round(totalCogs * 1.15 * 100) / 100,
  };
}

function psychologicalPrice(price: number): number {
  if (price < 10) return Math.floor(price) + 0.99;
  if (price < 50) return Math.floor(price) + 0.95;
  if (price < 100) return Math.floor(price) + 0.90;
  if (price < 500) {
    const rounded = Math.round(price / 10) * 10;
    return rounded % 50 === 0 ? rounded - 1 : rounded + 9;
  }
  const rounded = Math.round(price / 100) * 100;
  return rounded - 1;
}

router.get("/projects/:projectId/products/:productId/cogs", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const [cogs] = await db
    .select()
    .from(cogsTable)
    .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));

  if (!cogs) {
    res.json({
      productId: shopifyProductId,
      unitCost: 0, packagingCost: 0, labelCost: 0,
      shippingCostDomestic: 0, shippingCostInternational: 0, fulfillmentFee: 0,
      returnRate: 0.08, returnProcessingCost: 0, shopifyPaymentFee: 0.015,
      shopifyPlanCostPerOrder: 0, cac: 0, affiliateFee: 0, overheadPerUnit: 0,
      totalCogs: 0, breakEvenPrice: 0, minimumViablePrice: 0,
    });
    return;
  }

  res.json({
    productId: cogs.shopifyProductId,
    unitCost: cogs.unitCost, packagingCost: cogs.packagingCost, labelCost: cogs.labelCost,
    shippingCostDomestic: cogs.shippingCostDomestic, shippingCostInternational: cogs.shippingCostInternational,
    fulfillmentFee: cogs.fulfillmentFee, returnRate: cogs.returnRate, returnProcessingCost: cogs.returnProcessingCost,
    shopifyPaymentFee: cogs.shopifyPaymentFee, shopifyPlanCostPerOrder: cogs.shopifyPlanCostPerOrder,
    cac: cogs.cac, affiliateFee: cogs.affiliateFee, overheadPerUnit: cogs.overheadPerUnit,
    totalCogs: cogs.totalCogs, breakEvenPrice: cogs.breakEvenPrice, minimumViablePrice: cogs.minimumViablePrice,
  });
});

router.post("/projects/:projectId/products/:productId/cogs", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const input = req.body;
  const { totalCogs, breakEvenPrice, minimumViablePrice } = calculateCogs(input);

  const values = {
    projectId, shopifyProductId,
    unitCost: input.unitCost ?? 0, packagingCost: input.packagingCost ?? 0,
    labelCost: input.labelCost ?? 0, shippingCostDomestic: input.shippingCostDomestic ?? 0,
    shippingCostInternational: input.shippingCostInternational ?? 0, fulfillmentFee: input.fulfillmentFee ?? 0,
    returnRate: input.returnRate ?? 0.08, returnProcessingCost: input.returnProcessingCost ?? 0,
    shopifyPaymentFee: 0.015, shopifyPlanCostPerOrder: input.shopifyPlanCostPerOrder ?? 0,
    cac: input.cac ?? 0, affiliateFee: input.affiliateFee ?? 0, overheadPerUnit: input.overheadPerUnit ?? 0,
    totalCogs, breakEvenPrice, minimumViablePrice,
  };

  await db.insert(cogsTable).values(values)
    .onConflictDoNothing();

  await db.update(cogsTable).set(values)
    .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));

  res.json({ productId: shopifyProductId, ...values });
});

router.post("/projects/:projectId/products/:productId/analyze-competitors", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const { competitorUrls, searchKeywords } = req.body as { competitorUrls: string[]; searchKeywords?: string };

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  if (!product || !project) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const prompt = `Analiza la competencia de precios para el producto "${product.title}" en el nicho "${project.storeNiche ?? "e-commerce"}".
${searchKeywords ? `Keywords de búsqueda: ${searchKeywords}` : ""}
${competitorUrls.length > 0 ? `URLs de competidores a analizar: ${competitorUrls.join(", ")}` : ""}

Basándote en tu conocimiento del mercado actual en España/LATAM para este tipo de producto, proporciona:
1. Rangos de precios por tier (budget, mid, premium)
2. Precio mediano del mercado
3. Recomendación de posicionamiento para "${project.name}" (${project.brandTone ?? "profesional"})

Devuelve JSON con: budgetMin, budgetMax, midMin, midMax, premiumMin, premiumMax, medianPrice, positioningRecommendation, competitorData (array con url, price, brand).`;

  const result = await askClaudeJsonWithBrain<{
    budgetMin: number; budgetMax: number; midMin: number; midMax: number;
    premiumMin: number; premiumMax: number; medianPrice: number;
    positioningRecommendation: string;
    competitorData: Array<{ url: string; price: number | null; brand: string | null }>;
  }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "pricing", project?.storeNiche ?? undefined);

  await db.update(cogsTable)
    .set({ lastCompetitorAnalysis: result as Record<string, unknown> })
    .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));

  res.json(result);
});

router.post("/projects/:projectId/products/:productId/calculate-optimal-price", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const [cogs] = await db.select().from(cogsTable).where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));

  if (!product || !project) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const cogsTotal = cogs?.totalCogs ?? 0;
  const cogsInfo = cogs ? `COGS total: €${cogsTotal}, Precio mínimo viable: €${cogs.minimumViablePrice}` : "COGS: no configurado";
  const competitorInfo = cogs?.lastCompetitorAnalysis ? `Análisis de competencia: ${JSON.stringify(cogs.lastCompetitorAnalysis)}` : "Sin análisis de competencia previo";

  const prompt = `Calcula el precio óptimo para el producto "${product.title}" de la tienda "${project.name}".

${cogsInfo}
${competitorInfo}
Nicho: ${project.storeNiche ?? "e-commerce"}
Audiencia: ${project.targetAudience ?? "adultos"}
Tono de marca: ${project.brandTone ?? "profesional"}
Precio actual: ${product.price ?? "no configurado"}

Calcula:
1. Precio matemáticamente óptimo para máximo profit
2. Precio psicológico para máxima conversión
3. Compare_at_price (30% más alto mínimo, psicológico)
4. Estrategia recomendada
5. Waterfall de márgenes (desglose de cada €1 de revenue)
6. Advertencias de margen si hay riesgo
7. Sugerencias de bundle para aumentar AOV
8. Proyección de revenue mensual estimado

Devuelve JSON con: optimalPrice (number), psychologicalPrice (number), compareAtPrice (number), recommendedStrategy (string), marginWaterfall (objeto con: revenue, platformFees, cogs, packaging, shipping, returns, marketing, overhead, netMargin, netMarginPct), reasoning (string en español), marginWarnings (array strings), bundleSuggestions (array strings), monthlyRevenueProjection (number|null).`;

  const result = await askClaudeJsonWithBrain<{
    optimalPrice: number; psychologicalPrice: number; compareAtPrice: number;
    recommendedStrategy: string;
    marginWaterfall: { revenue: number; platformFees: number; cogs: number; packaging: number; shipping: number; returns: number; marketing: number; overhead: number; netMargin: number; netMarginPct: number };
    reasoning: string; marginWarnings: string[]; bundleSuggestions: string[];
    monthlyRevenueProjection: number | null;
  }>(projectId, prompt, FINANCIAL_ANALYST_SYSTEM, "pricing", project.storeNiche ?? undefined);

  if (cogs) {
    await db.update(cogsTable)
      .set({ lastPricingRecommendation: result as Record<string, unknown> })
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, shopifyProductId)));
  }

  res.json(result);
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

  await shopifyRequest(projectId, project.shopDomain, `/products/${shopifyProductId}.json`, {
    method: "PUT",
    body: JSON.stringify({
      product: {
        variants: [{ price, compare_at_price: compareAtPrice ?? null }],
      },
    }),
  });

  await db.update(productsTable)
    .set({ price, compareAtPrice: compareAtPrice ?? null })
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));

  res.json({ success: true, message: `Precio €${price} aplicado correctamente en Shopify` });
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

  try {
    const ordersData = await shopifyRequest<{ orders: Array<{ total_price: string; line_items: Array<{ product_id: number; quantity: number; price: string }> }> }>(
      projectId,
      project.shopDomain,
      `/orders.json?status=any&created_at_min=${thirtyDaysAgo}&limit=250`
    );
    orderCount = ordersData.orders.length;
    grossRevenue = ordersData.orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    aov = orderCount > 0 ? grossRevenue / orderCount : 0;
  } catch {
    grossRevenue = 0;
    aov = 0;
  }

  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const totalCogs = allCogs.reduce((sum, c) => sum + c.totalCogs, 0);
  const grossProfit = grossRevenue - totalCogs;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));

  const productProfitability = products.slice(0, 20).map((p) => {
    const cogs = allCogs.find((c) => c.shopifyProductId === p.shopifyProductId);
    const revenue = parseFloat(p.price ?? "0") * 10;
    const cogsTotal = cogs?.totalCogs ?? 0;
    const profit = revenue - cogsTotal * 10;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const grade = margin >= 40 ? "A" : margin >= 20 ? "B" : margin >= 10 ? "C" : "F";
    return {
      productId: p.shopifyProductId,
      title: p.title,
      unitsSold: 10,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogsTotal * 10 * 100) / 100,
      grossProfit: Math.round(profit * 100) / 100,
      marginPct: Math.round(margin * 10) / 10,
      grade,
    };
  });

  const alerts: string[] = [];
  if (grossMarginPct < 20) alerts.push("⚠️ Margen bruto global por debajo del 20% — revisar estructura de costes");
  const lowMarginProducts = productProfitability.filter((p) => p.marginPct < 15);
  if (lowMarginProducts.length > 0) alerts.push(`${lowMarginProducts.length} productos con margen < 15% — riesgo de pérdida con devoluciones`);

  res.json({
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    totalCogs: Math.round(totalCogs * 100) / 100,
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

export default router;
