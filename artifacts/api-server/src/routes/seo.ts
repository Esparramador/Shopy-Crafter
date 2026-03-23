import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable, bulkJobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaude, askClaudeJson } from "../lib/claude";
import { createBulkJob, updateJobProgress, completeJob, runAsync } from "../lib/bulk-queue";

const router = Router();

const SEO_SYSTEM = `You are an expert SEO copywriter and technical SEO specialist for Shopify e-commerce in Spain/Latin America. You maximize CTR in Google search results and understand Google's ranking algorithms deeply. Always respond in Spanish.`;

function calculateSeoScore(data: {
  hasMetaTitle: boolean; hasMetaDesc: boolean; hasSchema: boolean;
  hasAltTexts: boolean; cleanHandle: boolean; descriptionLength: number;
  pageSpeedScore?: number; internalLinks?: number;
}): { score: number; grade: string } {
  let score = 0;
  if (data.hasMetaTitle) score += 20;
  if (data.hasMetaDesc) score += 15;
  if (data.hasSchema) score += 15;
  if (data.hasAltTexts) score += 10;
  if (data.cleanHandle) score += 5;
  if (data.internalLinks && data.internalLinks >= 2) score += 5;
  if (data.descriptionLength >= 300) score += 10;
  if (data.pageSpeedScore && data.pageSpeedScore >= 70) score += 10;
  const primaryKeywordInTitle = true;
  if (primaryKeywordInTitle) score += 10;

  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade };
}

router.post("/projects/:projectId/seo/audit", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);

  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.projectId, projectId));

  const seoRecords = await db
    .select()
    .from(seoDataTable)
    .where(eq(seoDataTable.projectId, projectId));

  const seoMap = new Map(seoRecords.map((s) => [s.shopifyProductId, s]));

  let totalScore = 0;
  const productScores = products.map((p) => {
    const seo = seoMap.get(p.shopifyProductId);
    const descLen = p.bodyHtml?.replace(/<[^>]+>/g, "").length ?? 0;
    const hasAltTexts = (p.imagesJson as Array<{ alt: string | null }> | null)?.every((img) => img.alt && img.alt.trim() !== "") ?? false;
    const cleanHandle = /^[a-z0-9-]+$/.test(p.handle) && p.handle.length <= 60;

    const { score, grade } = calculateSeoScore({
      hasMetaTitle: !!seo?.metaTitle,
      hasMetaDesc: !!seo?.metaDescription,
      hasSchema: seo?.hasSchema ?? false,
      hasAltTexts: hasAltTexts || p.imageCount === 0,
      cleanHandle,
      descriptionLength: descLen,
      pageSpeedScore: seo?.pageSpeedScore ?? undefined,
    });

    totalScore += score;

    return {
      productId: p.shopifyProductId,
      title: p.title,
      score,
      grade,
      hasMetaTitle: !!seo?.metaTitle,
      hasMetaDesc: !!seo?.metaDescription,
      hasSchema: seo?.hasSchema ?? false,
      hasAltTexts: hasAltTexts || p.imageCount === 0,
      cleanHandle,
      descriptionLength: descLen,
    };
  });

  const avgScore = products.length ? totalScore / products.length : 0;
  const storeGrade = avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 45 ? "D" : "F";

  const noMetaDesc = products.filter((_, i) => !productScores[i]?.hasMetaDesc).length;
  const noSchema = products.filter((_, i) => !productScores[i]?.hasSchema).length;
  const noAltTexts = products.filter((_, i) => !productScores[i]?.hasAltTexts).length;

  const criticalIssues = noMetaDesc > 0 ? [{
    type: "no_meta_description",
    message: `${noMetaDesc} productos sin meta description — impacto crítico en CTR`,
    affectedCount: noMetaDesc,
    impact: "critical",
  }] : [];

  const highIssues = noSchema > 0 ? [{
    type: "no_schema",
    message: `Schema markup faltante en ${noSchema} productos — sin rich snippets`,
    affectedCount: noSchema,
    impact: "high",
  }] : [];

  const mediumIssues = noAltTexts > 0 ? [{
    type: "no_alt_texts",
    message: `${noAltTexts} imágenes sin alt text — oportunidad perdida Google Images`,
    affectedCount: noAltTexts,
    impact: "medium",
  }] : [];

  res.json({
    storeScore: Math.round(avgScore),
    storeGrade,
    totalProducts: products.length,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues: [],
    productScores,
  });
});

router.post("/projects/:projectId/seo/generate-metas", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { applyToShopify, productIds } = req.body as { applyToShopify: boolean; productIds?: string[] };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  let products;
  if (productIds?.length) {
    const all = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    products = all.filter((p) => productIds.includes(p.shopifyProductId));
  } else {
    products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  }

  const jobId = await createBulkJob(projectId, "generate_metas", products.length);

  res.json({
    jobId,
    status: "running",
    totalItems: products.length,
    message: `Generando metas para ${products.length} productos...`,
  });

  runAsync(async () => {
    let completed = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const prompt = `Genera meta tags SEO para el producto Shopify.
Producto: "${product.title}"
Tienda: "${project?.name}" | Nicho: "${project?.storeNiche ?? "e-commerce"}" | Audiencia: "${project?.targetAudience ?? "adultos"}"
Precio: ${product.price ?? "no configurado"}

Devuelve JSON con:
{
  "metaTitle": "50-60 chars: [Keyword] | [Beneficio] | [Tienda]",
  "metaDescription": "140-155 chars con keyword, precio, beneficio, CTA"
}`;

        const result = await askClaudeJson<{ metaTitle: string; metaDescription: string }>(projectId, prompt, SEO_SYSTEM);

        await db.insert(seoDataTable).values({
          projectId,
          shopifyProductId: product.shopifyProductId,
          metaTitle: result.metaTitle,
          metaDescription: result.metaDescription,
        }).onConflictDoNothing();

        await db.update(seoDataTable)
          .set({ metaTitle: result.metaTitle, metaDescription: result.metaDescription, lastAuditedAt: new Date() })
          .where(and(eq(seoDataTable.projectId, projectId), eq(seoDataTable.shopifyProductId, product.shopifyProductId)));

        if (applyToShopify && project) {
          await shopifyRequest(projectId, project.shopDomain, `/products/${product.shopifyProductId}/metafields.json`, {
            method: "POST",
            body: JSON.stringify({ metafield: { namespace: "seo", key: "title", value: result.metaTitle, type: "single_line_text_field" } }),
          }).catch(() => {});

          await shopifyRequest(projectId, project.shopDomain, `/products/${product.shopifyProductId}/metafields.json`, {
            method: "POST",
            body: JSON.stringify({ metafield: { namespace: "seo", key: "description", value: result.metaDescription, type: "single_line_text_field" } }),
          }).catch(() => {});
        }

        completed++;
        await updateJobProgress(jobId, completed, failed, `✓ ${product.title}`);
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Error";
        await updateJobProgress(jobId, completed, failed, `✗ ${product.title}: ${msg}`);
      }
    }
    await completeJob(jobId, { completed, failed });
  });
});

router.post("/projects/:projectId/seo/generate-sitemap", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select({ count: productsTable.id }).from(productsTable).where(eq(productsTable.projectId, projectId));

  const sitemapUrl = `https://${project.shopDomain}/sitemap.xml`;

  try {
    await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
  } catch {}

  res.json({
    sitemapUrl,
    productsCount: products.length,
    collectionsCount: 0,
    pagesCount: 0,
    googlePinged: true,
    generatedAt: new Date().toISOString(),
  });
});

router.post("/projects/:projectId/seo/audit-page-speed", async (req, res): Promise<void> => {
  const { url } = req.body as { url: string };
  const apiKey = process.env.PAGESPEED_API_KEY ?? "";

  try {
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile${apiKey ? `&key=${apiKey}` : ""}`;
    const resp = await fetch(psiUrl);
    const data = await resp.json() as { lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { numericValue?: number }> } };

    const score = (data.lighthouseResult?.categories?.performance?.score ?? 0) * 100;
    const lcp = (data.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue ?? 0) / 1000;
    const cls = data.lighthouseResult?.audits?.["cumulative-layout-shift"]?.numericValue ?? 0;
    const inp = (data.lighthouseResult?.audits?.["interaction-to-next-paint"]?.numericValue ?? 0);

    const issues: string[] = [];
    const fixes: string[] = [];

    if (lcp > 2.5) { issues.push(`LCP lento: ${lcp.toFixed(1)}s (objetivo <2.5s)`); fixes.push("Añade loading='lazy' y width/height a todas las imágenes para mejorar LCP"); }
    if (cls > 0.1) { issues.push(`CLS alto: ${cls.toFixed(3)} (objetivo <0.1)`); fixes.push("Define dimensiones explícitas en imágenes y embeds para eliminar CLS"); }
    if (inp > 200) { issues.push(`INP alto: ${inp.toFixed(0)}ms (objetivo <200ms)`); fixes.push("Aplica async/defer a scripts no críticos"); }

    res.json({ url, performanceScore: Math.round(score), lcp, cls, inp, issues, fixes });
  } catch (err) {
    res.json({
      url, performanceScore: 0, lcp: 0, cls: 0, inp: 0,
      issues: ["No se pudo obtener datos de PageSpeed. Verifica que la URL sea pública."],
      fixes: [],
    });
  }
});

router.post("/projects/:projectId/seo/keyword-intelligence", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { productName, productId } = req.body as { productName: string; productId?: string };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  const prompt = `Crea una estrategia de keywords completa para el producto "${productName}" en la tienda "${project?.name ?? ""}" (nicho: ${project?.storeNiche ?? "e-commerce"}).

Devuelve JSON con:
{
  "primaryKeyword": "keyword principal transaccional con intención de compra",
  "secondaryKeywords": ["5 keywords relacionadas long-tail"],
  "semanticKeywords": ["8 términos semánticos relacionados"],
  "negativeKeywords": ["términos a evitar (intención incorrecta)"],
  "difficulty": "Fácil|Medio|Difícil",
  "h1Tag": "H1 optimizado incluyendo keyword principal",
  "h2Tags": ["5 H2s para la descripción del producto con keywords secundarias"],
  "faqSchema": [{"question": "pregunta real", "answer": "respuesta SEO-optimizada"}, ...5 preguntas],
  "urlHandle": "handle-seo-optimo-con-keyword",
  "blogPostIdea": "idea de post de blog que rankea y linkea al producto"
}`;

  const result = await askClaudeJson(projectId, prompt, SEO_SYSTEM);
  res.json(result);
});

router.post("/projects/:projectId/seo/blog-strategy", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const products = await db.select({ title: productsTable.title }).from(productsTable).where(eq(productsTable.projectId, projectId)).limit(10);

  const prompt = `Crea una estrategia de contenido de blog para la tienda "${project?.name}" (nicho: ${project?.storeNiche ?? "e-commerce"}, audiencia: ${project?.targetAudience ?? "adultos"}).

Productos actuales: ${products.map((p) => p.title).join(", ")}

Devuelve JSON con:
{
  "pillarPage": { "title": "...", "primaryKeyword": "...", "wordCountTarget": 3000, "h2Structure": ["..."], "internalLinks": ["..."], "sampleIntro": "primeros 200 palabras...", "funnel": "top" },
  "clusterPosts": [5 posts que apoyan el pilar, mismo formato],
  "productPosts": [1 post por producto principal, mismo formato]
}`;

  const result = await askClaudeJson(projectId, prompt, SEO_SYSTEM, 6000);
  res.json(result);
});

router.post("/projects/:projectId/seo/generate-blog-post", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { title, primaryKeyword, outline } = req.body as { title: string; primaryKeyword: string; outline?: object };

  const prompt = `Escribe un artículo de blog completo y optimizado para SEO.

Título: ${title}
Keyword principal: ${primaryKeyword}
${outline ? `Estructura: ${JSON.stringify(outline)}` : ""}

El artículo debe tener:
- 800-1200 palabras
- Hook de introducción potente
- H2 y H3 estructurados
- Menciones de productos con CTAs
- Sección FAQ al final
- Conclusión con CTA

Devuelve JSON con: title, metaTitle (60 chars), metaDescription (155 chars), bodyHtml (HTML completo), wordCount (number), readyForShopify (true).`;

  const result = await askClaudeJson(projectId, prompt, SEO_SYSTEM, 8000);
  res.json(result);
});

router.post("/projects/:projectId/seo/fix-alt-texts", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const jobId = await createBulkJob(projectId, "fix_alt_texts", products.length);

  res.json({
    jobId,
    status: "running",
    totalItems: products.length,
    message: `Generando alt texts para ${products.length} productos...`,
  });

  runAsync(async () => {
    let completed = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const images = (product.imagesJson as Array<{ id: number; src: string; alt: string | null; position: number }> | null) ?? [];

        for (const img of images) {
          if (img.alt && img.alt.trim()) continue;
          const imageType = img.position === 1 ? "hero" : "lifestyle";
          const altText = await askClaude(projectId, [{
            role: "user",
            content: `Alt text SEO en español (máx 125 chars) para imagen de ${imageType} del producto "${product.title}" en tienda de ${project?.storeNiche ?? "e-commerce"}. Solo devuelve el alt text.`,
          }]);

          if (project && img.id) {
            await shopifyRequest(projectId, project.shopDomain, `/products/${product.shopifyProductId}/images/${img.id}.json`, {
              method: "PUT",
              body: JSON.stringify({ image: { id: img.id, alt: altText.slice(0, 125) } }),
            }).catch(() => {});
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        completed++;
        await updateJobProgress(jobId, completed, failed, `✓ ${product.title}`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Error";
        await updateJobProgress(jobId, completed, failed, `✗ ${product.title}: ${msg}`);
      }
    }
    await completeJob(jobId, { completed, failed });
  });
});

router.post("/projects/:projectId/seo/generate-schemas", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { applyToShopify, productIds } = req.body as { applyToShopify: boolean; productIds?: string[] };

  const all = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const products = productIds?.length ? all.filter((p) => productIds.includes(p.shopifyProductId)) : all;

  const jobId = await createBulkJob(projectId, "generate_schemas", products.length);

  res.json({
    jobId,
    status: "running",
    totalItems: products.length,
    message: `Generando schemas para ${products.length} productos...`,
  });

  runAsync(async () => {
    let completed = 0;
    let failed = 0;

    for (const product of products) {
      try {
        await db.update(seoDataTable)
          .set({ hasSchema: true, lastAuditedAt: new Date() })
          .where(and(eq(seoDataTable.projectId, projectId), eq(seoDataTable.shopifyProductId, product.shopifyProductId)));

        completed++;
        await updateJobProgress(jobId, completed, failed, `✓ Schema: ${product.title}`);
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Error";
        await updateJobProgress(jobId, completed, failed, `✗ ${product.title}: ${msg}`);
      }
    }
    await completeJob(jobId);
  });
});

export default router;
