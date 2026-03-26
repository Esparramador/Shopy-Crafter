import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, bulkJobsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { shopifyRequest, shopifyRequestPaged } from "../lib/shopify";
import { auditProduct, scoreToGrade } from "../lib/audit";
import { askClaudeJson, askClaudeJsonWithBrain, SHOPIFY_EXPERT_SYSTEM, learnFromOperation } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, failJob, runAsync } from "../lib/bulk-queue";
import { logger } from "../lib/logger";

const router = Router();

interface ShopifyProductRaw {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  handle: string;
  status: string;
  published_at: string | null;
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
    publishedAt: p.publishedAt ?? null,
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

  const statusCounts = { active: 0, draft: 0, archived: 0 };
  let publishedCount = 0;
  allProducts.forEach((p) => {
    const s = (p.status ?? "active") as keyof typeof statusCounts;
    if (s in statusCounts) statusCounts[s]++;
    if (p.publishedAt) publishedCount++;
  });

  res.json({
    products: mapped,
    total: filtered.length,
    page,
    totalPages: Math.ceil(filtered.length / limit),
    avgScore,
    gradeCounts,
    statusCounts,
    publishedCount,
    unpublishedCount: allProducts.length - publishedCount,
  });
});

router.post("/projects/:projectId/products/sync", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  const token = project.accessToken;
  if (!token) {
    res.status(400).json({ error: "No hay token de acceso. Regenera el token primero." });
    return;
  }

  let allProducts: ShopifyProductRaw[] = [];
  const limit = 250;
  const requestedFilter = req.body?.statusFilter || req.query?.statusFilter || "any";

  const statusesToFetch = requestedFilter === "any"
    ? ["active", "draft", "archived"]
    : [requestedFilter];

  logger.info({ projectId: id, domain: project.shopDomain, statusesToFetch }, "Shopify sync: starting");

  for (const status of statusesToFetch) {
    let nextPageInfo: string | null = null;
    let isFirst = true;

    while (true) {
      const path = isFirst
        ? `/products.json?limit=${limit}&status=${status}&published_status=any`
        : `/products.json?limit=${limit}&page_info=${nextPageInfo}`;

      logger.info({ projectId: id, path, status, isFirst }, "Shopify sync: fetching page");

      let pageResult: { data: { products: ShopifyProductRaw[] }; nextPageInfo: string | null };
      try {
        pageResult = await shopifyRequestPaged<{ products: ShopifyProductRaw[] }>(
          id,
          project.shopDomain,
          path
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ projectId: id, error: msg, status }, "Shopify sync: API request failed");
        res.status(502).json({ error: `Error al conectar con Shopify: ${msg}` });
        return;
      }

      const { data, nextPageInfo: next } = pageResult;

      logger.info({
        projectId: id,
        status,
        productsInPage: data.products?.length ?? 0,
        hasNext: !!next,
      }, "Shopify sync: page received");

      isFirst = false;
      if (!data.products?.length) break;
      allProducts = allProducts.concat(data.products);
      nextPageInfo = next;
      if (!nextPageInfo) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  logger.info({ projectId: id, totalProducts: allProducts.length }, "Shopify sync: all pages fetched");

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
        publishedAt: sp.published_at ?? null,
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
      .onConflictDoUpdate({
        target: [productsTable.projectId, productsTable.shopifyProductId],
        set: {
          title: sp.title,
          handle: sp.handle,
          bodyHtml: sp.body_html,
          vendor: sp.vendor,
          productType: sp.product_type,
          status: sp.status,
          publishedAt: sp.published_at ?? null,
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
        },
      });

    auditedCount++;
    totalScore += audit.overallScore;
  }

  const shopifyIds = allProducts.map(p => String(p.id));
  const localProducts = await db.select({ shopifyProductId: productsTable.shopifyProductId })
    .from(productsTable)
    .where(eq(productsTable.projectId, id));
  const orphanIds = localProducts
    .filter(lp => !shopifyIds.includes(lp.shopifyProductId))
    .map(lp => lp.shopifyProductId);
  let removedCount = 0;
  if (orphanIds.length > 0) {
    for (const orphanId of orphanIds) {
      await db.delete(productsTable).where(
        and(eq(productsTable.projectId, id), eq(productsTable.shopifyProductId, orphanId))
      );
    }
    removedCount = orphanIds.length;
  }

  const avgScore = auditedCount > 0 ? totalScore / auditedCount : null;
  await db.update(projectsTable).set({ productCount: allProducts.length, avgAuditScore: avgScore }).where(eq(projectsTable.id, id));

  res.json({
    synced: allProducts.length,
    auditedCount,
    removed: removedCount,
    avgScore,
    message: `${allProducts.length} productos sincronizados, ${removedCount > 0 ? `${removedCount} eliminados de BD` : "0 eliminados"}`,
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

router.put("/projects/:projectId/products/:productId", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const updates = req.body;
  if (!updates || Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No hay campos para actualizar" });
    return;
  }

  const shopifyPayload: Record<string, unknown> = { id: parseInt(shopifyProductId) };

  if (updates.title !== undefined) shopifyPayload.title = updates.title;
  if (updates.bodyHtml !== undefined) shopifyPayload.body_html = updates.bodyHtml;
  if (updates.vendor !== undefined) shopifyPayload.vendor = updates.vendor;
  if (updates.productType !== undefined) shopifyPayload.product_type = updates.productType;
  if (updates.tags !== undefined) shopifyPayload.tags = updates.tags;
  if (updates.status !== undefined) {
    if (!["active", "draft", "archived"].includes(updates.status)) {
      res.status(400).json({ error: "status debe ser: active, draft o archived" });
      return;
    }
    shopifyPayload.status = updates.status;
  }
  if (updates.handle !== undefined) shopifyPayload.handle = updates.handle;
  if (updates.templateSuffix !== undefined) shopifyPayload.template_suffix = updates.templateSuffix;
  if (updates.seoTitle !== undefined) {
    shopifyPayload.metafields_global_title_tag = updates.seoTitle;
  }
  if (updates.seoDescription !== undefined) {
    shopifyPayload.metafields_global_description_tag = updates.seoDescription;
  }

  if (updates.published !== undefined) {
    if (updates.published === true) {
      shopifyPayload.published = true;
    } else {
      shopifyPayload.published = false;
    }
  }

  if (updates.variants && Array.isArray(updates.variants)) {
    shopifyPayload.variants = updates.variants.map((v: Record<string, unknown>) => {
      const variant: Record<string, unknown> = {};
      if (v.id) variant.id = v.id;
      if (v.price !== undefined) variant.price = v.price;
      if (v.compareAtPrice !== undefined) variant.compare_at_price = v.compareAtPrice;
      if (v.sku !== undefined) variant.sku = v.sku;
      if (v.weight !== undefined) variant.weight = v.weight;
      if (v.weightUnit !== undefined) variant.weight_unit = v.weightUnit;
      if (v.inventoryManagement !== undefined) variant.inventory_management = v.inventoryManagement;
      if (v.option1 !== undefined) variant.option1 = v.option1;
      if (v.option2 !== undefined) variant.option2 = v.option2;
      if (v.option3 !== undefined) variant.option3 = v.option3;
      if (v.taxable !== undefined) variant.taxable = v.taxable;
      if (v.barcode !== undefined) variant.barcode = v.barcode;
      return variant;
    });
  }

  try {
    logger.info({ projectId, shopifyProductId, fields: Object.keys(shopifyPayload) }, "Updating product in Shopify");

    const result = await shopifyRequest<{ product: ShopifyProductRaw }>(
      projectId,
      project.shopDomain,
      `/products/${shopifyProductId}.json`,
      {
        method: "PUT",
        body: JSON.stringify({ product: shopifyPayload }),
      }
    );

    const sp = result.product;
    const audit = auditProduct({
      title: sp.title,
      body_html: sp.body_html,
      price: sp.variants?.[0]?.price,
      compare_at_price: sp.variants?.[0]?.compare_at_price,
      images: sp.images,
      tags: sp.tags,
    });

    await db
      .update(productsTable)
      .set({
        title: sp.title,
        handle: sp.handle,
        bodyHtml: sp.body_html,
        vendor: sp.vendor,
        productType: sp.product_type,
        status: sp.status,
        publishedAt: sp.published_at ?? null,
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
        eq(productsTable.projectId, projectId),
        eq(productsTable.shopifyProductId, shopifyProductId)
      ));

    logger.info({ projectId, shopifyProductId, newStatus: sp.status, published: !!sp.published_at }, "Product updated successfully");

    res.json({
      product: {
        id: String(sp.id),
        title: sp.title,
        handle: sp.handle,
        vendor: sp.vendor,
        productType: sp.product_type,
        status: sp.status,
        publishedAt: sp.published_at ?? null,
        tags: sp.tags,
        price: sp.variants?.[0]?.price ?? null,
        compareAtPrice: sp.variants?.[0]?.compare_at_price ?? null,
        imageCount: sp.images?.length ?? 0,
        variantCount: sp.variants?.length ?? 1,
        auditScore: audit.overallScore,
        auditGrade: audit.grade,
      },
      message: "Producto actualizado en Shopify y re-auditado",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, shopifyProductId, error: msg }, "Failed to update product");
    res.status(502).json({ error: `Error al actualizar en Shopify: ${msg}` });
  }
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

  const opportunities = await askClaudeJsonWithBrain<Array<{
    productName: string;
    estimatedPriceMin: number;
    estimatedPriceMax: number;
    whyItFits: string;
    sourcingDifficulty: string;
  }>>(
    id,
    prompt,
    `${SHOPIFY_EXPERT_SYSTEM} You are also an expert in product sourcing, market trends, and catalog expansion strategy. Use your accumulated knowledge about successful product categories and market demand to give highly targeted recommendations.`,
    "general",
    project.storeNiche ?? undefined
  );

  learnFromOperation({
    operationType: "catalog_analysis",
    niche: project.storeNiche,
    title: `Catalog opportunities — ${project.storeName ?? project.shopDomain}`,
    content: JSON.stringify(opportunities).slice(0, 1500),
    confidence: 0.7,
    tags: ["catalog", "opportunities", "trends"],
  });

  res.json(opportunities);
});

router.post("/projects/:projectId/products/create", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const {
    title, bodyHtml, vendor, productType, tags, status,
    variants, options, images, aiGenerate,
  } = req.body;

  if (!title) { res.status(400).json({ error: "El título es obligatorio" }); return; }

  let finalTitle = title;
  let finalBody = bodyHtml ?? "";
  let finalTags = tags ?? "";
  let seoTitle = "";
  let seoDescription = "";

  if (aiGenerate) {
    try {
      const aiResult = await askClaudeJsonWithBrain<{
        title: string;
        description: string;
        tags: string[];
        seoTitle: string;
        seoDescription: string;
      }>(
        projectId,
        `Genera contenido optimizado para un producto Shopify.
Datos del producto:
- Título original: "${title}"
- Tipo: ${productType || "no especificado"}
- Vendor/marca: ${vendor || "no especificado"}
- Nicho de la tienda: ${project.storeNiche || "general"}
- Tono de marca: ${project.brandTone || "profesional"}
- Público objetivo: ${project.targetAudience || "general"}

Genera:
1. "title": Título optimizado para SEO y conversión (max 70 chars)
2. "description": Descripción HTML persuasiva y profesional (min 150 palabras, con bullet points, beneficios, CTA). Usa <h3>, <ul>, <li>, <p>, <strong>.
3. "tags": Array de 5-8 tags relevantes para SEO y categorización
4. "seoTitle": Meta title optimizado (max 60 chars)
5. "seoDescription": Meta description persuasiva (max 155 chars)

Responde SOLO JSON válido.`,
        `${SHOPIFY_EXPERT_SYSTEM} Eres experto en copywriting de eCommerce. Genera contenido que convierta, usando el conocimiento acumulado del nicho.`,
        "redesign",
        project.storeNiche ?? undefined
      );

      if (aiResult) {
        finalTitle = aiResult.title || title;
        finalBody = aiResult.description || bodyHtml || "";
        finalTags = Array.isArray(aiResult.tags) ? aiResult.tags.join(", ") : (tags ?? "");
        seoTitle = aiResult.seoTitle || "";
        seoDescription = aiResult.seoDescription || "";
      }
    } catch (e) {
      console.error("AI generation for product failed, using original data:", e);
    }
  }

  const shopifyProduct: Record<string, unknown> = {
    title: finalTitle,
    body_html: finalBody,
    vendor: vendor || undefined,
    product_type: productType || undefined,
    tags: finalTags,
    status: status || "draft",
  };

  if (variants?.length) {
    shopifyProduct.variants = variants.map((v: Record<string, unknown>) => ({
      title: v.title || "Default",
      price: v.price || "0.00",
      compare_at_price: v.compareAtPrice || null,
      sku: v.sku || null,
      inventory_management: v.trackInventory ? "shopify" : null,
      inventory_quantity: v.quantity ?? null,
      option1: v.option1 || null,
      option2: v.option2 || null,
      option3: v.option3 || null,
      weight: v.weight || null,
      weight_unit: v.weightUnit || "kg",
      requires_shipping: v.requiresShipping !== false,
      taxable: v.taxable !== false,
    }));
  } else {
    shopifyProduct.variants = [{
      title: "Default",
      price: req.body.price || "0.00",
      compare_at_price: req.body.compareAtPrice || null,
      sku: req.body.sku || null,
      inventory_management: req.body.trackInventory ? "shopify" : null,
      inventory_quantity: req.body.quantity ?? null,
      weight: req.body.weight ? parseFloat(req.body.weight) : null,
      weight_unit: "kg",
      requires_shipping: req.body.requiresShipping !== false,
      taxable: req.body.taxable !== false,
    }];
  }

  if (options?.length) {
    shopifyProduct.options = options.map((o: Record<string, unknown>, i: number) => ({
      name: o.name,
      position: i + 1,
      values: o.values,
    }));
  }

  if (images?.length) {
    shopifyProduct.images = images.map((img: Record<string, unknown>, i: number) => ({
      src: img.src,
      alt: img.alt || finalTitle,
      position: i + 1,
    }));
  }

  if (seoTitle || seoDescription) {
    shopifyProduct.metafields_global_title_tag = seoTitle;
    shopifyProduct.metafields_global_description_tag = seoDescription;
  }

  try {
    const result = await shopifyRequest<{ product: ShopifyProductRaw }>(
      projectId,
      project.shopDomain,
      "/products.json",
      {
        method: "POST",
        body: JSON.stringify({ product: shopifyProduct }),
      }
    );

    const sp = result.product;
    const audit = auditProduct({
      title: sp.title,
      body_html: sp.body_html,
      price: sp.variants?.[0]?.price,
      compare_at_price: sp.variants?.[0]?.compare_at_price,
      images: sp.images,
      tags: sp.tags,
    });

    await db.insert(productsTable).values({
      projectId,
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
      auditGrade: scoreToGrade(audit.overallScore),
      auditProblems: audit.problems,
      titleScore: audit.titleScore,
      descriptionScore: audit.descriptionScore,
      priceScore: audit.priceScore,
      imageScore: audit.imageScore,
      seoScore: audit.seoScore,
    }).onConflictDoUpdate({
      target: [productsTable.projectId, productsTable.shopifyProductId],
      set: {
        title: sp.title,
        handle: sp.handle,
        bodyHtml: sp.body_html,
        status: sp.status,
        tags: sp.tags,
        price: sp.variants?.[0]?.price ?? null,
        imageCount: sp.images?.length ?? 0,
        variantCount: sp.variants?.length ?? 1,
        imagesJson: sp.images ?? [],
        auditScore: audit.overallScore,
        auditGrade: scoreToGrade(audit.overallScore),
      },
    });

    learnFromOperation({
      operationType: "product_creation",
      niche: project.storeNiche,
      productType: sp.product_type ?? null,
      title: `Product created: ${sp.title}`,
      content: `Producto "${sp.title}" creado en ${project.shopDomain}. Tipo: ${sp.product_type ?? "N/A"}. Tags: ${sp.tags ?? "N/A"}. Variantes: ${sp.variants?.length ?? 1}. Score: ${audit.overallScore}/100 (${scoreToGrade(audit.overallScore)}). ${aiGenerate ? "Contenido generado con IA." : "Contenido manual."}`,
      confidence: 0.75,
      tags: ["product_creation", sp.product_type ?? "general"].filter(Boolean),
    });

    res.json({
      success: true,
      product: {
        shopifyId: sp.id,
        title: sp.title,
        handle: sp.handle,
        status: sp.status,
        url: `https://${project.shopDomain}/admin/products/${sp.id}`,
        variants: sp.variants?.length ?? 1,
        images: sp.images?.length ?? 0,
        auditScore: audit.overallScore,
        auditGrade: scoreToGrade(audit.overallScore),
        aiGenerated: !!aiGenerate,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: `Error creando producto en Shopify: ${msg}` });
  }
});

export default router;
