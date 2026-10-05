import { wooPricesToInternal } from "../lib/connectors/woocommerce.js";
import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { shopifyRequest, shopifyRequestPaged, shopifyGraphQL } from "../lib/shopify";
import { auditProduct, scoreToGrade } from "../lib/audit";
import { askClaudeJsonWithBrain, SHOPIFY_EXPERT_SYSTEM, learnFromOperation } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, failJob, runAsync } from "../lib/bulk-queue";
import { logger } from "../lib/logger";
import { saveToVault } from "../lib/vault";
import { getConnector } from "../lib/connectors/index";
import { WooCommerceConnector } from "../lib/connectors/woocommerce";
import type { PlatformProduct } from "../lib/connectors/types";
import { enableLongRunning } from "../lib/long-running.js";

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

router.get("/admin/all-products", async (req, res): Promise<void> => {
  try {
    const projectFilter = req.query.projectId ? parseInt(req.query.projectId as string, 10) : null;
    const gradeFilter = req.query.grade as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string ?? "50", 10) || 50));

    if (projectFilter !== null && isNaN(projectFilter)) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }
    if (gradeFilter && !["A", "B", "C", "D", "F"].includes(gradeFilter)) {
      res.status(400).json({ error: "grade inválido" });
      return;
    }

    let allProducts;
    if (projectFilter) {
      allProducts = await db.select().from(productsTable)
        .where(eq(productsTable.projectId, projectFilter))
        .orderBy(desc(productsTable.auditScore));
    } else {
      allProducts = await db.select().from(productsTable)
        .orderBy(desc(productsTable.auditScore));
    }

    const projects = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const filtered = gradeFilter
      ? allProducts.filter(p => p.auditGrade === gradeFilter)
      : allProducts;

    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    allProducts.forEach(p => {
      const g = (p.auditGrade ?? "F") as keyof typeof gradeCounts;
      if (g in gradeCounts) gradeCounts[g]++;
    });

    const mapped = paginated.map(p => ({
      id: p.shopifyProductId,
      projectId: p.projectId,
      projectName: projectMap.get(p.projectId) ?? "Unknown",
      title: p.title,
      handle: p.handle,
      vendor: p.vendor,
      productType: p.productType,
      status: p.status,
      price: p.price,
      imageCount: p.imageCount,
      variantCount: p.variantCount,
      auditScore: p.auditScore,
      auditGrade: p.auditGrade,
    }));

    res.json({
      products: mapped,
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit),
      gradeCounts,
      projects: projects.map(p => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    res.status(500).json({ error: "Error al cargar productos" });
  }
});

router.get("/projects/:projectId/products", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const gradeFilter = req.query.grade as string | undefined;
    const searchFilter = (req.query.search as string | undefined)?.toLowerCase().trim();
  
    let query = db
      .select()
      .from(productsTable)
      .where(eq(productsTable.projectId, id))
      .orderBy(desc(productsTable.auditScore));
  
    const allProducts = await query;
    const filtered = (gradeFilter || searchFilter)
      ? allProducts.filter((p) =>
          (!gradeFilter || p.auditGrade === gradeFilter) &&
          (!searchFilter || p.handle?.toLowerCase().includes(searchFilter) || p.title?.toLowerCase().includes(searchFilter))
        )
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
  
    const statusCounts: Record<string, number> = { active: 0, draft: 0, archived: 0, unlisted: 0 };
    let publishedCount = 0;
    let lowImageCount = 0;
    allProducts.forEach((p) => {
      const s = p.status ?? "active";
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      if (p.publishedAt) publishedCount++;
      if ((p.imageCount ?? 0) < 3) lowImageCount++;
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
      // Productos con menos de 3 fotos (mínimo para una ficha que convierta).
      lowImageCount,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/products/sync", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
  
    const platformType = (project as typeof project & { platformType?: string }).platformType ?? "shopify";
  
    if (platformType === "prestashop") {
      try {
        const connector = getConnector(project);
        const requestedFilter = req.body?.statusFilter || req.query?.statusFilter || "any";
        const statusParam = requestedFilter === "any" ? undefined : requestedFilter;
  
        logger.info({ projectId: id, domain: project.shopDomain, platform: "prestashop" }, "PrestaShop sync: starting");
  
        let platformProducts: Awaited<ReturnType<typeof connector.getProducts>> = [];
        let page = 1;
        const pageSize = 100;
        // Páginas SIN filtro de estado: el conector de PrestaShop filtra en cliente
        // y una página con borradores parecía la última (se perdían páginas enteras).
        while (true) {
          const batch = await connector.getProducts({ page, limit: pageSize });
          if (batch.length === 0) break;
          platformProducts = platformProducts.concat(batch);
          if (batch.length < pageSize) break;
          page++;
          await new Promise((r) => setTimeout(r, 200));
        }
        const allPsIds = platformProducts.map((p) => p.platformId);
        if (statusParam) {
          const wanted = statusParam === "active";
          platformProducts = platformProducts.filter((p) => (p.status === "active") === wanted);
        }
  
        logger.info({ projectId: id, totalProducts: platformProducts.length }, "PrestaShop sync: all pages fetched");
  
        let auditedCount = 0;
        let totalScore = 0;
  
        for (const pp of platformProducts) {
          const audit = auditProduct({
            title: pp.title,
            body_html: pp.bodyHtml,
            price: pp.price,
            compare_at_price: pp.compareAtPrice,
            images: pp.images.map((img, i) => ({ id: i, src: img.src, alt: img.alt ?? null, position: img.position ?? i })),
            tags: pp.tags,
          });
  
          await db
            .insert(productsTable)
            .values({
              projectId: id,
              shopifyProductId: pp.platformId,
              title: pp.title,
              handle: pp.handle,
              bodyHtml: pp.bodyHtml,
              vendor: pp.vendor,
              productType: pp.productType,
              status: pp.status,
              publishedAt: pp.status === "active" ? new Date().toISOString() : null,
              tags: pp.tags,
              price: pp.price ?? null,
              compareAtPrice: pp.compareAtPrice ?? null,
              imageCount: pp.images?.length ?? 0,
              variantCount: pp.variants?.length ?? 1,
              imagesJson: pp.images ?? [],
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
                title: pp.title,
                handle: pp.handle,
                bodyHtml: pp.bodyHtml,
                vendor: pp.vendor,
                productType: pp.productType,
                status: pp.status,
                publishedAt: pp.status === "active" ? new Date().toISOString() : null,
                tags: pp.tags,
                price: pp.price ?? null,
                compareAtPrice: pp.compareAtPrice ?? null,
                imageCount: pp.images?.length ?? 0,
                variantCount: pp.variants?.length ?? 1,
                imagesJson: pp.images ?? [],
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
  
        const psIds = allPsIds;
        const localProducts = await db
          .select({ shopifyProductId: productsTable.shopifyProductId })
          .from(productsTable)
          .where(eq(productsTable.projectId, id));
        const orphanIds = localProducts.filter((lp) => !psIds.includes(lp.shopifyProductId)).map((lp) => lp.shopifyProductId);
        let removedCount = 0;
        if (orphanIds.length > 0) {
          for (const orphanId of orphanIds) {
            await db.delete(productsTable).where(and(eq(productsTable.projectId, id), eq(productsTable.shopifyProductId, orphanId)));
          }
          removedCount = orphanIds.length;
        }
  
        const avgScore = auditedCount > 0 ? totalScore / auditedCount : null;
        await db.update(projectsTable).set({ productCount: platformProducts.length, avgAuditScore: avgScore }).where(eq(projectsTable.id, id));
  
        logger.info({ projectId: id, synced: platformProducts.length, removed: removedCount }, "PrestaShop sync: complete");
  
        res.json({
          synced: platformProducts.length,
          auditedCount,
          removed: removedCount,
          avgScore,
          statusBreakdown: {
            active: platformProducts.filter((p) => p.status === "active").length,
            draft: platformProducts.filter((p) => p.status === "draft").length,
          },
          message: `${platformProducts.length} productos PrestaShop sincronizados, ${removedCount} eliminados de BD`,
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ projectId: id, error: msg }, "PrestaShop sync: failed");
        res.status(502).json({ error: `Error al sincronizar con PrestaShop: ${msg}` });
        return;
      }
    }
  
    if (platformType === "woocommerce") {
      try {
        const connector = getConnector(project) as WooCommerceConnector;
        const wcProducts = await connector.getAllProducts();
  
        logger.info({ projectId: id, totalProducts: wcProducts.length }, "WooCommerce sync: all products fetched");
  
        let auditedCount = 0;
        let totalScore = 0;
        const statusBreakdown: Record<string, number> = {};
  
        for (const wp of wcProducts) {
          const internalStatus = wp.status === "publish" ? "active" : wp.status === "private" ? "archived" : wp.status;
          statusBreakdown[internalStatus] = (statusBreakdown[internalStatus] ?? 0) + 1;
  
          const tags = (wp.tags ?? []).map((t: { name: string }) => t.name).join(", ");
          const images = wp.images ?? [];
          const { price, compareAtPrice } = wooPricesToInternal(wp);
  
          let variantCount = 1;
          if (wp.type === "variable" && wp.variations) {
            variantCount = wp.variations.length || 1;
          }
  
          const audit = auditProduct({
            title: wp.name,
            body_html: wp.description,
            price,
            compare_at_price: compareAtPrice,
            images: images.map((img: { src: string; alt?: string }, i: number) => ({ id: 0, src: img.src, alt: img.alt ?? null, position: i })),
            tags,
          });
  
          await db
            .insert(productsTable)
            .values({
              projectId: id,
              shopifyProductId: String(wp.id),
              title: wp.name,
              handle: wp.slug,
              bodyHtml: wp.description,
              vendor: "",
              productType: wp.type,
              status: internalStatus,
              publishedAt: wp.status === "publish" ? new Date().toISOString() : null,
              tags,
              price,
              compareAtPrice,
              imageCount: images.length,
              variantCount,
              imagesJson: images,
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
                title: wp.name,
                handle: wp.slug,
                bodyHtml: wp.description,
                vendor: "",
                productType: wp.type,
                status: internalStatus,
                tags,
                price,
                compareAtPrice,
                imageCount: images.length,
                variantCount,
                imagesJson: images,
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
  
        const wcIds = wcProducts.map(p => String(p.id));
        const localProducts = await db.select({ shopifyProductId: productsTable.shopifyProductId })
          .from(productsTable)
          .where(eq(productsTable.projectId, id));
        const orphanIds = localProducts
          .filter(lp => !wcIds.includes(lp.shopifyProductId))
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
        await db.update(projectsTable).set({ productCount: wcProducts.length, avgAuditScore: avgScore }).where(eq(projectsTable.id, id));
  
        const breakdownParts = Object.entries(statusBreakdown).map(([s, c]) => `${c} ${s}`);
  
        try {
          learnFromOperation({
            operationType: "product_creation",
            title: `WooCommerce sync: ${project.shopDomain}`,
            content: `WooCommerce sync completed: ${wcProducts.length} products synced from ${project.shopDomain}. Platform: WooCommerce. Status breakdown: ${breakdownParts.join(", ")}. Average audit score: ${avgScore?.toFixed(1) ?? "N/A"}. Categories/price ranges: ${wcProducts.slice(0, 10).map(p => `${p.name}: ${p.regular_price ?? p.price ?? "N/A"}`).join("; ")}.`,
            confidence: 0.9,
            tags: ["product_sync", "woocommerce"],
          });
        } catch { /* learning is best-effort */ }
  
        res.json({
          synced: wcProducts.length,
          auditedCount,
          removed: removedCount,
          avgScore,
          statusBreakdown,
          message: `${wcProducts.length} productos sincronizados desde WooCommerce (${breakdownParts.join(", ")}), ${removedCount > 0 ? `${removedCount} eliminados de BD` : "0 eliminados"}`,
        });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ projectId: id, error: msg }, "WooCommerce sync failed");
        res.status(502).json({ error: `Error al sincronizar con WooCommerce: ${msg}` });
        return;
      }
    }
  
    if (!project.accessToken) {
      res.status(400).json({ error: "No hay token de acceso. Regenera el token primero." });
      return;
    }
  
    let allProducts: ShopifyProductRaw[] = [];
    const limit = 250;
    const requestedFilter = req.body?.statusFilter || req.query?.statusFilter || "any";
  
    const statusesToFetch = requestedFilter === "any"
      ? ["active", "draft", "archived", "unlisted"]
      : [requestedFilter];
  
    logger.info({ projectId: id, domain: project.shopDomain, statusesToFetch }, "Shopify sync: starting");
  
    if (requestedFilter === "any") {
      for (const status of ["active", "draft", "archived"]) {
        let nextPageInfo: string | null = null;
        let isFirst = true;
  
        while (true) {
          const path = isFirst
            ? `/products.json?limit=${limit}&status=${status}&published_status=any`
            : `/products.json?limit=${limit}&page_info=${nextPageInfo}`;
  
          logger.info({ projectId: id, path, status, isFirst }, "Shopify sync: fetching page (all statuses)");
  
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
            productsInPage: data.products?.length ?? 0,
            hasNext: !!next,
            status,
          }, "Shopify sync: page received");
  
          isFirst = false;
          if (!data.products?.length) break;
          allProducts = allProducts.concat(data.products);
          nextPageInfo = next;
          if (!nextPageInfo) break;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } else {
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
    }
  
    const statusBreakdown: Record<string, number> = {};
    for (const sp of allProducts) {
      const s = sp.status ?? "unknown";
      statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1;
    }
  
    logger.info({ projectId: id, totalProducts: allProducts.length, statusBreakdown }, "Shopify sync: all pages fetched");
  
    let auditedCount = 0;
    let totalScore = 0;
  
    const seoGqlQuery = (cursor?: string) => `{
      products(first: 250${cursor ? `, after: "${cursor}"` : ""}) {
        edges {
          node {
            id
            seo { title description }
            images(first: 20) { edges { node { altText } } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  
    interface SyncSeoNode {
      id: string;
      seo: { title: string | null; description: string | null };
      images: { edges: Array<{ node: { altText: string | null } }> };
    }
  
    const seoLookup = new Map<string, { seoTitle: string | null; seoDesc: string | null; hasAllAlts: boolean }>();
    try {
      let seoHasNext = true;
      let seoCursor: string | undefined;
      while (seoHasNext) {
        const seoGqlData = await shopifyGraphQL<{ products: { edges: Array<{ node: SyncSeoNode }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }>(
          id, project.shopDomain, seoGqlQuery(seoCursor)
        );
        for (const { node } of (seoGqlData.products?.edges || [])) {
          const numId = String(node.id || "").includes("/") ? String(node.id).split("/").pop()! : String(node.id);
          const imgEdges = node.images?.edges || [];
          const allAlts = imgEdges.length > 0 && imgEdges.every(e => !!e.node.altText?.trim());
          seoLookup.set(numId, {
            seoTitle: node.seo?.title || null,
            seoDesc: node.seo?.description || null,
            hasAllAlts: allAlts,
          });
        }
        seoHasNext = seoGqlData.products?.pageInfo?.hasNextPage || false;
        seoCursor = seoGqlData.products?.pageInfo?.endCursor;
      }
      logger.info({ projectId: id, seoCount: seoLookup.size }, "Shopify sync: SEO data fetched via GraphQL");
    } catch (seoGqlErr) {
      logger.warn({ err: seoGqlErr }, "Shopify sync: GraphQL SEO fetch failed, audit will use REST data only");
    }
  
    for (const sp of allProducts) {
      const spId = String(sp.id);
      const seoInfo = seoLookup.get(spId);
      const metafields: Array<{ namespace: string; key: string; value: string }> = [];
      if (seoInfo?.seoTitle) metafields.push({ namespace: "seo", key: "title", value: seoInfo.seoTitle });
      if (seoInfo?.seoDesc) metafields.push({ namespace: "seo", key: "description", value: seoInfo.seoDesc });
  
      const audit = auditProduct({
        title: sp.title,
        body_html: sp.body_html,
        price: sp.variants?.[0]?.price,
        compare_at_price: sp.variants?.[0]?.compare_at_price,
        images: sp.images,
        tags: sp.tags,
        variants: sp.variants?.map(v => ({ price: v.price })),
        metafields,
      });
  
      await db
        .insert(productsTable)
        .values({
          projectId: id,
          shopifyProductId: spId,
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
  
      try {
        const hasAltTexts = seoInfo ? seoInfo.hasAllAlts : (sp.images?.length > 0 && sp.images.every((img: { alt: string | null }) => !!img.alt?.trim()));
        const cleanHandle = !!sp.handle && /^[a-z0-9-]+$/.test(sp.handle) && sp.handle.length <= 60;
        const seoValues = {
          metaTitle: seoInfo?.seoTitle || null,
          metaDescription: seoInfo?.seoDesc || null,
          hasAltTexts: !!hasAltTexts,
          cleanHandle,
          seoScore: audit.seoScore,
          seoGrade: scoreToGrade(audit.seoScore),
          descriptionLength: (sp.body_html || "").length,
          lastAuditedAt: new Date(),
        };
        const [existingSeo] = await db.select({ id: seoDataTable.id }).from(seoDataTable)
          .where(and(eq(seoDataTable.projectId, id), eq(seoDataTable.shopifyProductId, spId)));
        if (existingSeo) {
          await db.update(seoDataTable).set(seoValues).where(eq(seoDataTable.id, existingSeo.id));
        } else {
          await db.insert(seoDataTable).values({ projectId: id, shopifyProductId: spId, ...seoValues });
        }
      } catch (seoErr) {
        logger.warn({ err: seoErr, productId: spId }, "Failed to save SEO data during sync");
      }
  
      auditedCount++;
      totalScore += audit.overallScore;
    }
  
    const shopifyIds = allProducts.map(p => String(p.id));
    const localProducts = await db.select({ shopifyProductId: productsTable.shopifyProductId })
      .from(productsTable)
      .where(eq(productsTable.projectId, id));
    // Solo se borran huérfanos en un sync completo: con statusFilter (p. ej.
    // "active") se borraban de la BD todos los borradores y archivados.
    const orphanIds = requestedFilter !== "any" ? [] : localProducts
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
  
    const breakdownParts = Object.entries(statusBreakdown).map(([s, c]) => `${c} ${s}`);
  
    res.json({
      synced: allProducts.length,
      auditedCount,
      removed: removedCount,
      avgScore,
      statusBreakdown,
      message: `${allProducts.length} productos sincronizados (${breakdownParts.join(", ")}), ${removedCount > 0 ? `${removedCount} eliminados de BD` : "0 eliminados"}`,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/products/:productId", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
      const pType = (project as typeof project & { platformType?: string }).platformType ?? "shopify";
      if (pType === "prestashop") {
        try {
          const connector = getConnector(project);
          const liveProduct = await connector.getProduct(shopifyProductId);
          liveImages = liveProduct.images.map((img, i) => ({
            id: i,
            src: img.src,
            alt: img.alt ?? null,
            position: img.position ?? i,
          }));
          liveVariants = liveProduct.variants.map((v) => ({
            id: parseInt(v.platformId, 10) || 0,
            title: v.title,
            price: v.price,
            compare_at_price: v.compareAtPrice ?? null,
            sku: v.sku ?? null,
            option1: v.option1 ?? null,
            option2: v.option2 ?? null,
            option3: v.option3 ?? null,
            inventory_quantity: v.inventoryQuantity ?? null,
            weight: null,
            weight_unit: null,
          }));
        } catch {
          liveVariants = [];
        }
      } else if (pType === "woocommerce") {
        try {
          const connector = getConnector(project);
          const wcProduct = await connector.getProduct(shopifyProductId);
          liveVariants = wcProduct.variants.map(v => ({
            id: parseInt(v.platformId, 10) || 0,
            title: v.title,
            price: v.price,
            compare_at_price: v.compareAtPrice ?? null,
            sku: v.sku ?? null,
            option1: v.option1 ?? null,
            option2: v.option2 ?? null,
            option3: v.option3 ?? null,
            inventory_quantity: v.inventoryQuantity ?? null,
            weight: null,
            weight_unit: null,
          }));
          liveImages = wcProduct.images.map((img, i) => ({
            id: 0,
            src: img.src,
            alt: img.alt ?? null,
            position: img.position ?? i,
          }));
        } catch {
          liveVariants = [];
        }
      } else {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.put("/projects/:projectId/products/:productId", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const shopifyProductId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No hay campos para actualizar" });
      return;
    }
  
    const updatePlatform = (project as typeof project & { platformType?: string }).platformType ?? "shopify";
  
    if (updatePlatform === "prestashop") {
      try {
        const connector = getConnector(project);
        const productData: Partial<import("../lib/connectors/types").PlatformProduct> = {};
        if (updates.title !== undefined) productData.title = updates.title;
        if (updates.bodyHtml !== undefined) productData.bodyHtml = updates.bodyHtml;
        if (updates.vendor !== undefined) productData.vendor = updates.vendor;
        if (updates.productType !== undefined) productData.productType = updates.productType;
        if (updates.tags !== undefined) productData.tags = updates.tags;
        if (updates.status !== undefined) productData.status = updates.status;
        if (updates.handle !== undefined) productData.handle = updates.handle;
        if (updates.price !== undefined) productData.price = updates.price;
        if (updates.compareAtPrice !== undefined) productData.compareAtPrice = updates.compareAtPrice;
        if (updates.seoTitle || updates.seoDescription) {
          productData.seo = {
            metaTitle: updates.seoTitle,
            metaDescription: updates.seoDescription,
          };
        }
  
        if (updates.variants && Array.isArray(updates.variants)) {
          productData.variants = updates.variants.map((v: { id?: string; price?: string; sku?: string; inventoryQuantity?: number }) => ({
            id: v.id,
            title: "",
            price: v.price ?? "",
            sku: v.sku,
            inventoryQuantity: v.inventoryQuantity,
          }));
        }
  
        const updated = await connector.updateProduct(shopifyProductId, productData);
  
        const audit = auditProduct({
          title: updated.title,
          body_html: updated.bodyHtml,
          price: updated.price,
          compare_at_price: updated.compareAtPrice,
          images: updated.images.map((img, i) => ({ id: i, src: img.src, alt: img.alt ?? null, position: img.position ?? i })),
          tags: updated.tags,
        });
  
        await db
          .update(productsTable)
          .set({
            title: updated.title,
            handle: updated.handle,
            bodyHtml: updated.bodyHtml,
            vendor: updated.vendor,
            productType: updated.productType,
            status: updated.status,
            tags: updated.tags,
            price: updated.price ?? null,
            compareAtPrice: updated.compareAtPrice ?? null,
            imageCount: updated.images?.length ?? 0,
            variantCount: updated.variants?.length ?? 1,
            imagesJson: updated.images ?? [],
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
          .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, shopifyProductId)));
  
        learnFromOperation({
          operationType: "product_optimization",
          niche: project.storeNiche,
          productType: updated.productType ?? null,
          title: `PrestaShop product updated: ${updated.title}`,
          content: `Producto "${updated.title}" actualizado en PrestaShop ${project.shopDomain}. SEO: ${updated.seo?.metaTitle ?? "N/A"}. Price: ${updated.price ?? "N/A"}. Variants: ${updated.variants?.length ?? 0}. Score: ${audit.overallScore}/100.`,
          confidence: 0.95,
          tags: ["prestashop", "product_optimization"],
        });
  
        saveToVault({
          projectId,
          fileType: "product_data",
          category: "product_optimization",
          title: `Product updated: ${updated.title}`,
          content: JSON.stringify({
            platformId: updated.platformId,
            title: updated.title,
            seo: updated.seo,
            price: updated.price,
            auditScore: audit.overallScore,
          }),
          productId: updated.platformId,
          productTitle: updated.title,
          generatedBy: "prestashop_connector",
        });
  
        res.json({
          product: {
            id: updated.platformId,
            title: updated.title,
            handle: updated.handle,
            vendor: updated.vendor,
            productType: updated.productType,
            status: updated.status,
            tags: updated.tags,
            price: updated.price,
            imageCount: updated.images?.length ?? 0,
            variantCount: updated.variants?.length ?? 1,
            auditScore: audit.overallScore,
            auditGrade: audit.grade,
          },
          message: "Producto actualizado en PrestaShop y re-auditado",
        });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ projectId, shopifyProductId, error: msg }, "Failed to update PrestaShop product");
        res.status(502).json({ error: `Error al actualizar en PrestaShop: ${msg}` });
        return;
      }
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
  
    const pType = (project as typeof project & { platformType?: string }).platformType ?? "shopify";
  
    if (pType === "woocommerce") {
      try {
        const connector = getConnector(project);
        const wcData: Record<string, unknown> = {};
        if (updates.title !== undefined) wcData.title = updates.title;
        if (updates.bodyHtml !== undefined) wcData.bodyHtml = updates.bodyHtml;
        if (updates.tags !== undefined) wcData.tags = updates.tags;
        if (updates.status !== undefined) wcData.status = updates.status;
        if (updates.handle !== undefined) wcData.handle = updates.handle;
        if (updates.price !== undefined) wcData.price = updates.price;
        if (updates.compareAtPrice !== undefined) wcData.compareAtPrice = updates.compareAtPrice;
        if (updates.images !== undefined) wcData.images = updates.images;
  
        const updated = await connector.updateProduct(shopifyProductId, wcData as Partial<PlatformProduct>);
  
        const audit = auditProduct({
          title: updated.title,
          body_html: updated.bodyHtml,
          price: updated.price,
          compare_at_price: updated.compareAtPrice,
          images: updated.images.map((img, i) => ({ id: 0, src: img.src, alt: img.alt ?? null, position: img.position ?? i })),
          tags: updated.tags,
        });
  
        await db
          .update(productsTable)
          .set({
            title: updated.title,
            handle: updated.handle,
            bodyHtml: updated.bodyHtml,
            vendor: updated.vendor,
            productType: updated.productType,
            status: updated.status,
            tags: updated.tags,
            price: updated.price,
            compareAtPrice: updated.compareAtPrice,
            imageCount: updated.images.length,
            variantCount: updated.variants.length,
            imagesJson: updated.images,
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
  
        learnFromOperation({
          operationType: "product_optimization",
          niche: project.storeNiche,
          title: `WooCommerce product updated: ${updated.title}`,
          content: `Product "${updated.title}" updated on WooCommerce store ${project.shopDomain}. Score: ${audit.overallScore}/100 (${audit.grade}).`,
          confidence: 0.95,
          tags: ["product_optimization", "woocommerce"],
        });
  
        res.json({
          product: {
            id: updated.platformId,
            title: updated.title,
            handle: updated.handle,
            vendor: updated.vendor,
            productType: updated.productType,
            status: updated.status,
            tags: updated.tags,
            price: updated.price,
            compareAtPrice: updated.compareAtPrice,
            imageCount: updated.images.length,
            variantCount: updated.variants.length,
            auditScore: audit.overallScore,
            auditGrade: audit.grade,
          },
          message: "Producto actualizado en WooCommerce y re-auditado",
        });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ projectId, shopifyProductId, error: msg }, "Failed to update WooCommerce product");
        res.status(502).json({ error: `Error al actualizar en WooCommerce: ${msg}` });
        return;
      }
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
  
      const updMetafields: Array<{ namespace: string; key: string; value: string }> = [];
      try {
        const seoGqlSingle = `{ product(id: "gid://shopify/Product/${shopifyProductId}") { seo { title description } } }`;
        const seoGqlRes = await shopifyGraphQL<{ product: { seo: { title: string | null; description: string | null } } }>(
          projectId, project.shopDomain, seoGqlSingle
        );
        const seoT = seoGqlRes.product?.seo?.title || null;
        const seoD = seoGqlRes.product?.seo?.description || null;
        if (seoT) updMetafields.push({ namespace: "seo", key: "title", value: seoT });
        if (seoD) updMetafields.push({ namespace: "seo", key: "description", value: seoD });
  
        const updSeoVals = {
          metaTitle: seoT,
          metaDescription: seoD,
          hasAltTexts: (sp.images?.length ?? 0) > 0 && sp.images.every((img: { alt: string | null }) => !!img.alt?.trim()),
          cleanHandle: !!sp.handle && /^[a-z0-9-]+$/.test(sp.handle) && sp.handle.length <= 60,
          lastAuditedAt: new Date(),
        };
        const [existUpd] = await db.select({ id: seoDataTable.id }).from(seoDataTable)
          .where(and(eq(seoDataTable.projectId, projectId), eq(seoDataTable.shopifyProductId, shopifyProductId)));
        if (existUpd) {
          await db.update(seoDataTable).set(updSeoVals).where(eq(seoDataTable.id, existUpd.id));
        } else {
          await db.insert(seoDataTable).values({ projectId, shopifyProductId, ...updSeoVals });
        }
      } catch (seoUpdErr) {
        logger.warn({ err: seoUpdErr }, "PUT product: failed to fetch SEO via GraphQL");
      }
  
      const audit = auditProduct({
        title: sp.title,
        body_html: sp.body_html,
        price: sp.variants?.[0]?.price,
        compare_at_price: sp.variants?.[0]?.compare_at_price,
        images: sp.images,
        tags: sp.tags,
        variants: sp.variants?.map((v: { price: string }) => ({ price: v.price })),
        metafields: updMetafields,
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/audit", async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.projectId, id));
  
    const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    let totalScore = 0;
    const allIssues: string[] = [];
  
    // Solo productos auditados: uno sin auditar no es un "F" con 0 puntos.
    const audited = products.filter((p) => p.auditScore !== null && p.auditScore !== undefined);
    audited.forEach((p) => {
      const g = (p.auditGrade ?? "F") as keyof typeof gradeCounts;
      if (g in gradeCounts) gradeCounts[g]++;
      totalScore += p.auditScore ?? 0;
      allIssues.push(...(p.auditProblems ?? []));
    });
  
    const avgScore = audited.length ? totalScore / audited.length : 0;
    const needsImprovement = audited.filter((p) => (p.auditScore ?? 0) < 75).length;
    const criticalIssues = audited.filter((p) => (p.auditScore ?? 0) < 45).length;
    const notAudited = products.length - audited.length;
  
    const issueCounts: Record<string, number> = {};
    allIssues.forEach((issue) => { issueCounts[issue] = (issueCounts[issue] ?? 0) + 1; });
    const topIssues = Object.entries(issueCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => `${issue} (${count} productos)`);
  
    // Sin porcentajes inventados (antes: +15 % de conversión por producto, p. ej. +1500 %).
    const revenueImpact = audited.length === 0
      ? "Sin productos auditados todavía"
      : needsImprovement > 0
        ? `${needsImprovement} de ${audited.length} productos auditados por debajo de 75/100 (${criticalIssues} críticos)${notAudited > 0 ? ` · ${notAudited} sin auditar` : ""}`
        : `Todos los productos auditados superan 75/100${notAudited > 0 ? ` · ${notAudited} sin auditar` : ""}`;
  
    res.json({
      totalProducts: products.length,
      avgScore: Math.round(avgScore),
      gradeCounts,
      criticalIssues,
      projectedRevenueImpact: revenueImpact,
      topIssues,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/products/:productId/audit", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/catalog-opportunities", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
      title: `Catalog opportunities — ${project.name ?? project.shopDomain}`,
      content: JSON.stringify(opportunities),
      confidence: 0.7,
      tags: ["catalog", "opportunities", "trends"],
    });
  
    res.json(opportunities);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/products/create", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const createPlatform = (project as typeof project & { platformType?: string }).platformType ?? "shopify";
  
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
    let aiSuggestedVariants: Array<{ name: string; values: string[] }> = [];
  
    if (aiGenerate) {
      try {
        const aiResult = await askClaudeJsonWithBrain<{
          title: string;
          description: string;
          tags: string[];
          hashtags: string[];
          seoTitle: string;
          seoDescription: string;
          suggestedVariants: Array<{ name: string; values: string[] }>;
          recommendedImageCount: number;
          imageTypes: string[];
          brandConsistencyNotes: string;
        }>(
          projectId,
          `Genera contenido COMPLETO y PROFESIONAL para un producto Shopify de la tienda "${project.name}".
  
  Datos del producto:
  - Título original: "${title}"
  - Tipo: ${productType || "no especificado"}
  - Vendor/marca: ${vendor || "no especificado"}
  - Nicho de la tienda: ${project.storeNiche || "general"}
  - Tono de marca: ${project.brandTone || "profesional"}
  - Público objetivo: ${project.targetAudience || "general"}
  - Mercados: ${project.storeMarkets || "España"}
  
  Genera un producto SUPER PROFESIONAL como lo haría una tienda de €10M+/año:
  
  1. "title": Título optimizado para SEO y conversión (max 70 chars). Incluye keyword principal del nicho.
  2. "description": Descripción HTML persuasiva (min 200 palabras). Estructura profesional:
     - <h3> con beneficio principal
     - <p> párrafo de enganche emocional
     - <ul><li> 5-8 características/beneficios con iconos (✓, ⭐, 🔒)
     - <p> párrafo de uso/aplicación
     - <h3> especificaciones técnicas si aplica
     - <p> CTA final con urgencia sutil
     Usa <h3>, <ul>, <li>, <p>, <strong>, <em>.
  3. "tags": Array de 8-12 tags relevantes para SEO y categorización (sin #, solo palabras)
  4. "hashtags": Array de 5-8 hashtags para redes sociales (con #). Relevantes al nicho y tendencias.
  5. "seoTitle": Meta title (max 60 chars) con keyword + beneficio + marca
  6. "seoDescription": Meta description (max 155 chars) con keyword, precio indicativo, CTA
  7. "suggestedVariants": Array de opciones recomendadas [{"name": "Talla/Color/Material", "values": ["S","M","L"]}]. Solo si tiene sentido para el tipo de producto.
  8. "recommendedImageCount": Número de imágenes recomendado (mínimo 5, ideal 8-9 para tienda profesional)
  9. "imageTypes": Array de tipos de imagen necesarios (ej: ["hero", "lifestyle", "detail", "scale", "packaging", "ugc"])
  10. "brandConsistencyNotes": Notas sobre cómo mantener coherencia con el ADN de marca de la tienda
  
  REGLAS:
  - Sé COHERENTE con la estética y tono de la marca
  - NO uses lenguaje genérico — adapta todo al nicho "${project.storeNiche || "general"}"
  - Las descripciones deben vender, no solo describir
  - Los tags deben incluir long-tail keywords del nicho
  - Los hashtags deben ser los que usa la comunidad del nicho
  
  Responde SOLO JSON válido.`,
          `${SHOPIFY_EXPERT_SYSTEM} Eres experto en copywriting de eCommerce de alto nivel. Generas contenido de tienda premium que convierte. Usas el conocimiento acumulado del nicho para crear productos coherentes con la marca.`,
          "redesign",
          project.storeNiche ?? undefined,
          4096
        );
  
        if (aiResult) {
          finalTitle = aiResult.title || title;
          finalBody = aiResult.description || bodyHtml || "";
          const allTags = [
            ...(Array.isArray(aiResult.tags) ? aiResult.tags : []),
            ...(Array.isArray(aiResult.hashtags) ? aiResult.hashtags.map(h => h.replace(/^#/, "")) : []),
          ];
          finalTags = allTags.length > 0 ? allTags.join(", ") : (tags ?? "");
          seoTitle = aiResult.seoTitle || "";
          seoDescription = aiResult.seoDescription || "";
          aiSuggestedVariants = aiResult.suggestedVariants || [];
        }
      } catch (e) {
        console.error("AI generation for product failed, using original data:", e);
      }
    }
  
    if (createPlatform === "prestashop") {
      try {
        const connector = getConnector(project);
        const productData: Partial<import("../lib/connectors/types").PlatformProduct> = {
          title: finalTitle,
          bodyHtml: finalBody,
          vendor: vendor || "",
          productType: productType || "",
          tags: finalTags,
          status: status || "draft",
          price: req.body.price || variants?.[0]?.price || "0.00",
          seo: (seoTitle || seoDescription) ? { metaTitle: seoTitle, metaDescription: seoDescription } : undefined,
        };
  
        if (variants?.length) {
          productData.variants = variants.map((v: Record<string, unknown>) => ({
            platformId: "0",
            title: (v.title as string) || "Default",
            price: (v.price as string) || "0.00",
            compareAtPrice: (v.compareAtPrice as string) || null,
            sku: (v.sku as string) || "",
          }));
        }
  
        const created = await connector.createProduct(productData);
  
        if (images?.length) {
          for (const img of images as Array<{ src: string; alt?: string }>) {
            try {
              await connector.uploadImage(created.platformId, img.src, img.alt || finalTitle);
            } catch (imgErr) {
              logger.warn({ productId: created.platformId, error: imgErr instanceof Error ? imgErr.message : String(imgErr) }, "PrestaShop image upload failed (continuing)");
            }
          }
        }
  
        const finalProduct = await connector.getProduct(created.platformId);
  
        const audit = auditProduct({
          title: finalProduct.title,
          body_html: finalProduct.bodyHtml,
          price: finalProduct.price,
          compare_at_price: finalProduct.compareAtPrice,
          images: finalProduct.images.map((img, i) => ({ id: i, src: img.src, alt: img.alt ?? null, position: img.position ?? i })),
          tags: finalProduct.tags,
        });
  
        await db.insert(productsTable).values({
          projectId,
          shopifyProductId: finalProduct.platformId,
          title: finalProduct.title,
          handle: finalProduct.handle,
          bodyHtml: finalProduct.bodyHtml,
          vendor: finalProduct.vendor,
          productType: finalProduct.productType,
          status: finalProduct.status,
          tags: finalProduct.tags,
          price: finalProduct.price ?? null,
          compareAtPrice: finalProduct.compareAtPrice ?? null,
          imageCount: finalProduct.images?.length ?? 0,
          variantCount: finalProduct.variants?.length ?? 1,
          imagesJson: finalProduct.images ?? [],
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
            title: finalProduct.title,
            handle: finalProduct.handle,
            bodyHtml: finalProduct.bodyHtml,
            status: finalProduct.status,
            tags: finalProduct.tags,
            price: finalProduct.price ?? null,
            imageCount: finalProduct.images?.length ?? 0,
            variantCount: finalProduct.variants?.length ?? 1,
            imagesJson: finalProduct.images ?? [],
            auditScore: audit.overallScore,
            auditGrade: scoreToGrade(audit.overallScore),
          },
        });
  
        learnFromOperation({
          operationType: "product_creation",
          niche: project.storeNiche,
          productType: productType ?? null,
          title: `PrestaShop product created: ${finalProduct.title}`,
          content: `Producto "${finalProduct.title}" creado en PrestaShop ${project.shopDomain}. SEO: meta_title="${seoTitle}", meta_description="${seoDescription}". Tags: ${finalTags}. Score: ${audit.overallScore}/100 (${scoreToGrade(audit.overallScore)}). ${aiGenerate ? "Contenido generado con IA." : "Contenido manual."}`,
          confidence: 0.9,
          tags: ["prestashop", "product_creation", productType ?? "general"].filter(Boolean),
        });
  
        saveToVault({
          projectId,
          fileType: "product_data",
          category: "product_creation",
          title: `Product created: ${finalProduct.title}`,
          content: JSON.stringify({
            platformId: finalProduct.platformId,
            title: finalProduct.title,
            seo: { metaTitle: seoTitle, metaDescription: seoDescription },
            tags: finalTags,
            auditScore: audit.overallScore,
            aiGenerated: !!aiGenerate,
          }),
          productId: finalProduct.platformId,
          productTitle: finalProduct.title,
          generatedBy: "prestashop_connector",
        });
  
        res.json({
          success: true,
          product: {
            shopifyId: parseInt(finalProduct.platformId, 10),
            title: finalProduct.title,
            handle: finalProduct.handle,
            status: finalProduct.status,
            url: `https://${project.shopDomain}/admin/catalog/products/${finalProduct.platformId}/edit`,
            variants: finalProduct.variants?.length ?? 1,
            images: finalProduct.images?.length ?? 0,
            auditScore: audit.overallScore,
            auditGrade: scoreToGrade(audit.overallScore),
            aiGenerated: !!aiGenerate,
          },
        });
        return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: `Error creando producto en PrestaShop: ${msg}` });
        return;
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
    } else if (aiSuggestedVariants.length > 0 && !variants?.length) {
      shopifyProduct.options = aiSuggestedVariants.map((v, i) => ({
        name: v.name,
        position: i + 1,
        values: v.values,
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
  
    const createPlatformType = (project as typeof project & { platformType?: string }).platformType ?? "shopify";
  
    if (createPlatformType === "woocommerce") {
      try {
        const connector = getConnector(project);
        const wcProductData: Partial<PlatformProduct> = {
          title: finalTitle,
          bodyHtml: finalBody,
          vendor: vendor || "",
          productType: productType || "simple",
          tags: finalTags,
          status: status || "draft",
        };
  
        if (images?.length) {
          wcProductData.images = images.map((img: Record<string, unknown>, i: number) => ({
            src: img.src as string,
            alt: (img.alt as string) || finalTitle,
            position: i + 1,
          }));
        }
  
        if (variants?.length) {
          wcProductData.variants = variants.map((v: Record<string, unknown>) => ({
            platformId: "",
            title: (v.title as string) || "Default",
            price: (v.price as string) || "0.00",
            compareAtPrice: (v.compareAtPrice as string) || null,
            sku: (v.sku as string) || "",
            inventoryQuantity: (v.quantity as number) ?? 0,
            option1: v.option1 as string | undefined,
            option2: v.option2 as string | undefined,
            option3: v.option3 as string | undefined,
          }));
        } else {
          wcProductData.price = req.body.price || "0.00";
          wcProductData.compareAtPrice = req.body.compareAtPrice || null;
        }
  
        const created = await connector.createProduct(wcProductData);
  
        const audit = auditProduct({
          title: created.title,
          body_html: created.bodyHtml,
          price: created.price,
          compare_at_price: created.compareAtPrice,
          images: created.images.map((img, i) => ({ id: 0, src: img.src, alt: img.alt ?? null, position: img.position ?? i })),
          tags: created.tags,
        });
  
        await db.insert(productsTable).values({
          projectId,
          shopifyProductId: created.platformId,
          title: created.title,
          handle: created.handle,
          bodyHtml: created.bodyHtml,
          vendor: created.vendor,
          productType: created.productType,
          status: created.status,
          tags: created.tags,
          price: created.price,
          compareAtPrice: created.compareAtPrice,
          imageCount: created.images.length,
          variantCount: created.variants.length,
          imagesJson: created.images,
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
            title: created.title,
            handle: created.handle,
            bodyHtml: created.bodyHtml,
            status: created.status,
            tags: created.tags,
            price: created.price,
            imageCount: created.images.length,
            variantCount: created.variants.length,
            imagesJson: created.images,
            auditScore: audit.overallScore,
            auditGrade: scoreToGrade(audit.overallScore),
          },
        });
  
        learnFromOperation({
          operationType: "product_creation",
          niche: project.storeNiche,
          productType: created.productType ?? null,
          title: `WooCommerce product created: ${created.title}`,
          content: `Product "${created.title}" created on WooCommerce store ${project.shopDomain}. Platform: WooCommerce. Type: ${created.productType}. Tags: ${created.tags}. Handle: ${created.handle}. Variants: ${created.variants.length}. Price: ${created.price ?? "N/A"}. Score: ${audit.overallScore}/100 (${scoreToGrade(audit.overallScore)}). ${aiGenerate ? "AI-generated content." : "Manual content."}`,
          confidence: 0.9,
          tags: ["product_creation", "woocommerce"],
        });
  
        res.json({
          success: true,
          product: {
            shopifyId: parseInt(created.platformId, 10),
            title: created.title,
            handle: created.handle,
            status: created.status,
            url: `${project.shopDomain}/wp-admin/post.php?post=${created.platformId}&action=edit`,
            variants: created.variants.length,
            images: created.images.length,
            auditScore: audit.overallScore,
            auditGrade: scoreToGrade(audit.overallScore),
            aiGenerated: !!aiGenerate,
          },
        });
        return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: `Error creando producto en WooCommerce: ${msg}` });
        return;
      }
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
  
      const createMetafields: Array<{ namespace: string; key: string; value: string }> = [];
      try {
        const createSeoGql = `{ product(id: "gid://shopify/Product/${sp.id}") { seo { title description } } }`;
        const createSeoRes = await shopifyGraphQL<{ product: { seo: { title: string | null; description: string | null } } }>(
          projectId, project.shopDomain, createSeoGql
        );
        const cSeoT = createSeoRes.product?.seo?.title || null;
        const cSeoD = createSeoRes.product?.seo?.description || null;
        if (cSeoT) createMetafields.push({ namespace: "seo", key: "title", value: cSeoT });
        if (cSeoD) createMetafields.push({ namespace: "seo", key: "description", value: cSeoD });
  
        if (cSeoT || cSeoD) {
          const cSeoVals = {
            metaTitle: cSeoT,
            metaDescription: cSeoD,
            hasAltTexts: (sp.images?.length ?? 0) > 0 && sp.images.every((img: { alt: string | null }) => !!img.alt?.trim()),
            cleanHandle: !!sp.handle && /^[a-z0-9-]+$/.test(sp.handle) && sp.handle.length <= 60,
            lastAuditedAt: new Date(),
          };
          await db.insert(seoDataTable).values({ projectId, shopifyProductId: String(sp.id), ...cSeoVals }).catch(() => {});
        }
      } catch {
        logger.warn("POST create product: failed to fetch SEO via GraphQL for new product");
      }
  
      const audit = auditProduct({
        title: sp.title,
        body_html: sp.body_html,
        price: sp.variants?.[0]?.price,
        compare_at_price: sp.variants?.[0]?.compare_at_price,
        images: sp.images,
        tags: sp.tags,
        variants: sp.variants?.map((v: { price: string }) => ({ price: v.price })),
        metafields: createMetafields,
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
