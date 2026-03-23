import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, bulkJobsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { auditProduct, scoreToGrade } from "../lib/audit";
import { askClaudeJson, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, failJob, runAsync } from "../lib/bulk-queue";

const router = Router();

interface ShopifyProductRaw {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  handle: string;
  status: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    inventory_quantity: number | null;
    weight: number | null;
    weight_unit: string | null;
  }>;
  options: Array<{ id: number; name: string; position: number; values: string[] }>;
  images: Array<{ id: number; src: string; alt: string | null; position: number }>;
}

router.get("/projects/:projectId/products", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const gradeFilter = req.query.grade as string | undefined;

  let query = db
    .select()
    .from(productsTable)
    .where(eq(productsTable.projectId, id))
    .orderBy(desc(productsTable.auditScore));

  const allProducts = await query;
  const filtered = gradeFilter
    ? allProducts.filter((p) => p.auditGrade === gradeFilter)
    : allProducts;

  const page = parseInt(req.query.page as string ?? "1", 10);
  const limit = parseInt(req.query.limit as string ?? "50", 10);
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  allProducts.forEach((p) => {
    const g = (p.auditGrade ?? "F") as keyof typeof gradeCounts;
    if (g in gradeCounts) gradeCounts[g]++;
  });

  const avgScore = allProducts.length
    ? allProducts.reduce((sum, p) => sum + (p.auditScore ?? 0), 0) / allProducts.length
    : null;

  const mapped = paginated.map((p) => ({
    id: p.shopifyProductId,
    title: p.title,
    handle: p.handle,
    bodyHtml: p.bodyHtml,
    vendor: p.vendor,
    productType: p.productType,
    status: p.status,
    tags: p.tags ?? "",
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    imageCount: p.imageCount,
    variantCount: p.variantCount,
    images: (p.imagesJson as Array<{ id: number; src: string; alt: string | null; position: number }> | null) ?? [],
    auditScore: p.auditScore,
    auditGrade: p.auditGrade,
    auditProblems: p.auditProblems ?? [],
    titleScore: p.titleScore,
    descriptionScore: p.descriptionScore,
    priceScore: p.priceScore,
    imageScore: p.imageScore,
    seoScore: p.seoScore,
  }));

  res.json({
    products: mapped,
    total: filtered.length,
    page,
    totalPages: Math.ceil(filtered.length / limit),
    avgScore,
    gradeCounts,
  });
});

router.post("/projects/:projectId/products/sync", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  let allProducts: ShopifyProductRaw[] = [];
  let page = 1;
  const limit = 250;

  while (true) {
    const data = await shopifyRequest<{ products: ShopifyProductRaw[] }>(
      id,
      project.shopDomain,
      `/products.json?limit=${limit}&page=${page}&status=active`
    );

    if (!data.products?.length) break;
    allProducts = allProducts.concat(data.products);
    if (data.products.length < limit) break;
    page++;
    await new Promise((r) => setTimeout(r, 500));
  }

  let auditedCount = 0;
  let totalScore = 0;

  for (const sp of allProducts) {
    const audit = auditProduct({
      title: sp.title,
      body_html: sp.body_html,
      price: sp.variants?.[0]?.price,
      compare_at_price: sp.variants?.[0]?.compare_at_price,
      images: sp.images,
      tags: sp.tags,
    });

    await db
      .insert(productsTable)
      .values({
        projectId: id,
        shopifyProductId: String(sp.id),
        title: sp.title,
        handle: sp.handle,
        bodyHtml: sp.body_html,
        vendor: sp.vendor,
        productType: sp.product_type,
        status: sp.status,
        tags: sp.tags,
        price: sp.variants?.[0]?.price ?? null,
        compareAtPrice: sp.variants?.[0]?.compare_at_price ?? null,
        imageCount: sp.images?.length ?? 0,
        variantCount: sp.variants?.length ?? 1,
        imagesJson: sp.images ?? [],
        auditScore: audit.overallScore,
        auditGrade: audit.grade,
        titleScore: audit.titleScore,
        descriptionScore: audit.descriptionScore,
        priceScore: audit.priceScore,
        imageScore: audit.imageScore,
        seoScore: audit.seoScore,
        auditProblems: audit.problems,
        lastAuditedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .update(productsTable)
      .set({
        title: sp.title,
        handle: sp.handle,
        bodyHtml: sp.body_html,
        vendor: sp.vendor,
        productType: sp.product_type,
        status: sp.status,
        tags: sp.tags,
        price: sp.variants?.[0]?.price ?? null,
        compareAtPrice: sp.variants?.[0]?.compare_at_price ?? null,
        imageCount: sp.images?.length ?? 0,
        variantCount: sp.variants?.length ?? 1,
        imagesJson: sp.images ?? [],
        auditScore: audit.overallScore,
        auditGrade: audit.grade,
        titleScore: audit.titleScore,
        descriptionScore: audit.descriptionScore,
        priceScore: audit.priceScore,
        imageScore: audit.imageScore,
        seoScore: audit.seoScore,
        auditProblems: audit.problems,
        lastAuditedAt: new Date(),
      })
      .where(and(
        eq(productsTable.projectId, id),
        eq(productsTable.shopifyProductId, String(sp.id))
      ));

    auditedCount++;
    totalScore += audit.overallScore;
  }

  const avgScore = auditedCount > 0 ? totalScore / auditedCount : null;
  await db.update(projectsTable).set({ productCount: allProducts.length, avgAuditScore: avgScore }).where(eq(projectsTable.id, id));

  res.json({
    synced: allProducts.length,
    auditedCount,
    avgScore,
    message: `${allProducts.length} productos sincronizados y auditados`,
  });
});

router.get("/projects/:projectId/products/:productId", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(
      eq(productsTable.projectId, projectId),
      eq(productsTable.shopifyProductId, shopifyProductId)
    ));

  if (!product) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  let liveVariants: ShopifyProductRaw["variants"] = [];
  let liveOptions: ShopifyProductRaw["options"] = [];
  let liveImages: ShopifyProductRaw["images"] = [];

  if (project) {
    try {
      const shopifyData = await shopifyRequest<{ product: ShopifyProductRaw }>(
        projectId,
        project.shopDomain,
        `/products/${shopifyProductId}.json`
      );
      if (shopifyData?.product) {
        liveVariants = shopifyData.product.variants ?? [];
        liveOptions = shopifyData.product.options ?? [];
        liveImages = shopifyData.product.images ?? [];
      }
    } catch {
      liveVariants = [];
    }
  }

  res.json({
    product: {
      id: product.shopifyProductId,
      title: product.title,
      handle: product.handle,
      bodyHtml: product.bodyHtml,
      vendor: product.vendor,
      productType: product.productType,
      status: product.status,
      tags: product.tags ?? "",
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageCount: product.imageCount,
      variantCount: product.variantCount,
      images: liveImages.length > 0
        ? liveImages
        : (product.imagesJson as Array<{ id: number; src: string; alt: string | null; position: number }> | null) ?? [],
      auditScore: product.auditScore,
      auditGrade: product.auditGrade,
      auditProblems: product.auditProblems ?? [],
      titleScore: product.titleScore,
      descriptionScore: product.descriptionScore,
      priceScore: product.priceScore,
      imageScore: product.imageScore,
      seoScore: product.seoScore,
      variants: liveVariants.map((v) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compare_at_price,
        sku: v.sku,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        inventoryQuantity: v.inventory_quantity,
      })),
      options: liveOptions.map((o) => ({ name: o.name, values: o.values })),
    },
    auditResult: product.auditScore !== null ? {
      productId: product.shopifyProductId,
      overallScore: product.auditScore,
      grade: product.auditGrade ?? "F",
      titleScore: product.titleScore ?? 0,
      descriptionScore: product.descriptionScore ?? 0,
      priceScore: product.priceScore ?? 0,
      imageScore: product.imageScore ?? 0,
      seoScore: product.seoScore ?? 0,
      problems: product.auditProblems ?? [],
      suggestions: [],
      revenueImpact: null,
    } : null,
    redesignResult: null,
    cogsData: null,
    generatedImages: [],
  });
});

router.post("/projects/:projectId/audit", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);

  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.projectId, id));

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let totalScore = 0;
  const allIssues: string[] = [];

  products.forEach((p) => {
    const g = (p.auditGrade ?? "F") as keyof typeof gradeCounts;
    if (g in gradeCounts) gradeCounts[g]++;
    totalScore += p.auditScore ?? 0;
    allIssues.push(...(p.auditProblems ?? []));
  });

  const avgScore = products.length ? totalScore / products.length : 0;
  const needsImprovement = products.filter((p) => (p.auditScore ?? 0) < 75).length;
  const criticalIssues = products.filter((p) => (p.auditScore ?? 0) < 45).length;

  const issueCounts: Record<string, number> = {};
  allIssues.forEach((issue) => { issueCounts[issue] = (issueCounts[issue] ?? 0) + 1; });
  const topIssues = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => `${issue} (${count} productos)`);

  const revenueImpact = needsImprovement > 0
    ? `+${(needsImprovement * 15).toFixed(0)}% conversión estimada si se mejoran ${needsImprovement} productos`
    : "Tienda bien optimizada";

  res.json({
    totalProducts: products.length,
    avgScore: Math.round(avgScore),
    gradeCounts,
    criticalIssues,
    projectedRevenueImpact: revenueImpact,
    topIssues,
  });
});

router.post("/projects/:projectId/products/:productId/audit", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(
      eq(productsTable.projectId, projectId),
      eq(productsTable.shopifyProductId, shopifyProductId)
    ));

  if (!product) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const audit = auditProduct({
    title: product.title,
    body_html: product.bodyHtml,
    price: product.price,
    compare_at_price: product.compareAtPrice,
    images: (product.imagesJson as Array<{ alt: string | null }> | null) ?? [],
    tags: product.tags,
  });

  await db
    .update(productsTable)
    .set({
      auditScore: audit.overallScore,
      auditGrade: audit.grade,
      titleScore: audit.titleScore,
      descriptionScore: audit.descriptionScore,
      priceScore: audit.priceScore,
      imageScore: audit.imageScore,
      seoScore: audit.seoScore,
      auditProblems: audit.problems,
      lastAuditedAt: new Date(),
    })
    .where(and(
      eq(productsTable.projectId, projectId),
      eq(productsTable.shopifyProductId, shopifyProductId)
    ));

  res.json({
    productId: shopifyProductId,
    ...audit,
    revenueImpact: null,
  });
});

router.post("/projects/:projectId/catalog-opportunities", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  const products = await db
    .select({ title: productsTable.title, productType: productsTable.productType })
    .from(productsTable)
    .where(eq(productsTable.projectId, id))
    .limit(30);

  const productList = products.map((p) => p.title).join(", ");

  const prompt = `Tienda: ${project.name}
Nicho: ${project.storeNiche ?? "e-commerce general"}
Audiencia objetivo: ${project.targetAudience ?? "adultos"}
Productos actuales (muestra): ${productList}

Sugiere 12 tipos de producto que NO están en la tienda pero venderían bien en este nicho.
Para cada uno incluye: productName, estimatedPriceMin, estimatedPriceMax, whyItFits, sourcingDifficulty (Fácil/Medio/Difícil).

Devuelve SOLO un JSON array con estos campos por objeto. Sin texto adicional.`;

  const opportunities = await askClaudeJson<Array<{
    productName: string;
    estimatedPriceMin: number;
    estimatedPriceMax: number;
    whyItFits: string;
    sourcingDifficulty: string;
  }>>(id, prompt);

  res.json(opportunities);
});

export default router;
