import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable, bulkJobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaude, askClaudeJson, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude";
import { askGeminiWithSearch } from "../lib/gemini";
import { createBulkJob, updateJobProgress, completeJob, runAsync } from "../lib/bulk-queue";
import { saveToVault } from "../lib/vault.js";

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

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  learnFromOperation({
    operationType: "seo_audit",
    niche: project?.storeNiche ?? null,
    title: `SEO Audit — ${project?.storeName ?? project?.shopDomain ?? "store"}: ${storeGrade} (${Math.round(avgScore)}/100)`,
    content: `Auditoría SEO: ${products.length} productos. Score medio: ${Math.round(avgScore)}. Grade: ${storeGrade}. Críticos: ${criticalIssues.length} (${noMetaDesc} sin meta desc). Altos: ${highIssues.length} (${noSchema} sin schema). Medios: ${mediumIssues.length} (${noAltTexts} sin alt texts).`,
    confidence: 0.8,
    tags: ["seo", "audit", "store_health"],
  });

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

        const result = await askClaudeJsonWithBrain<{ metaTitle: string; metaDescription: string }>(projectId, prompt, SEO_SYSTEM, "seo", project?.storeNiche ?? undefined);

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

        // ShopyBrain aprende del SEO generado (fire-and-forget)
        learnFromOperation({
          operationType: "seo",
          niche: project?.storeNiche ?? null,
          productType: product.productType ?? null,
          title: `SEO: ${result.metaTitle}`,
          content: `Meta title: ${result.metaTitle}\nMeta description: ${result.metaDescription}\nProducto: ${product.title}\nNicho: ${project?.storeNiche ?? "general"}`,
          confidence: 0.68,
          tags: ["seo", "meta_tags", project?.storeNiche ?? "ecommerce"].filter(Boolean),
        });

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

    // Auto-guardar reporte SEO completo en vault
    if (completed > 0) {
      try {
        const allSeoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
        const seoReport = {
          projectId,
          generatedAt: new Date().toISOString(),
          totalProducts: products.length,
          completed,
          failed,
          appliedToShopify: applyToShopify ?? false,
          products: allSeoData.map(s => ({
            shopifyProductId: s.shopifyProductId,
            metaTitle: s.metaTitle,
            metaDescription: s.metaDescription,
            seoScore: s.seoScore,
            lastAuditedAt: s.lastAuditedAt,
          })),
        };
        await saveToVault({
          projectId,
          fileType: "seo_report",
          category: "bulk_seo",
          title: `Reporte SEO — ${completed} productos · ${new Date().toLocaleDateString("es-ES")}`,
          description: `${completed} meta tags generados · ${failed} fallidos · ${applyToShopify ? "Aplicado a Shopify" : "Solo guardado"}`,
          mimeType: "application/json",
          generatedBy: "seo_engine",
          metadata: seoReport,
        });
      } catch {}
    }
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
  const { url, strategy = "mobile" } = req.body as { url: string; strategy?: "mobile" | "desktop" };

  try {
    const { runPageSpeedAudit } = await import("../lib/pagespeed.js");
    const result = await runPageSpeedAudit(url, strategy);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      url,
      strategy,
      performanceScore: null,
      seoScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      coreWebVitals: null,
      fieldData: null,
      issues: [`No se pudo obtener datos de PageSpeed: ${err instanceof Error ? err.message : "URL no accesible"}`],
      fixes: [],
      opportunities: [],
    });
  }
});

router.post("/projects/:projectId/seo/keyword-intelligence", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { productName, productId } = req.body as { productName: string; productId?: string };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const niche = project?.storeNiche ?? "e-commerce";
  const storeName = project?.name ?? "";

  const geminiSearches = await Promise.allSettled([
    askGeminiWithSearch(
      `Search Google for: best keywords to buy "${productName}" in Spain. What are the most searched terms, Google autocomplete suggestions, and "People Also Ask" questions for someone wanting to buy this type of product? Include related search terms shown at the bottom of Google results. List specific search queries with their approximate relative popularity.`,
      `You are a Google Search keyword researcher. Find REAL search terms people use on Google right now. Focus on Spanish market (Spain). Return raw findings — actual search suggestions, autocomplete terms, related searches, and PAA questions you find.`
    ),
    askGeminiWithSearch(
      `Search Google for: "${productName}" competitor products pricing in Spain ${niche}. What online stores sell similar products? What are their prices, product names, and how do they describe them in their titles and meta descriptions? Find real competitor listings.`,
      `You are a competitive SEO analyst. Search Google to find REAL competitor product listings, their titles, meta descriptions, and pricing. Focus on Spanish-language results. Return specific data from actual search results.`
    ),
    askGeminiWithSearch(
      `Search Google for: SEO difficulty and search volume trends for "${productName}" related keywords in Spanish market. What keywords have high search volume? What long-tail keywords are easier to rank for? Check Google Trends data for this product category. What are trending related searches?`,
      `You are an SEO data analyst. Research REAL search trends and keyword competition from Google. Find trending terms, seasonal patterns, and emerging search queries. Return factual data from your research.`
    ),
  ]);

  const searchResults = geminiSearches.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { text: `Search ${i + 1} failed`, sources: [], queries: [] };
  });

  const allSources = searchResults.flatMap(r => r.sources ?? []);
  const allQueries = searchResults.flatMap(r => r.queries ?? []);

  const prompt = `Crea una estrategia de keywords completa para el producto "${productName}" en la tienda "${storeName}" (nicho: ${niche}).

=== DATOS REALES DE BÚSQUEDAS EN GOOGLE (investigación actual) ===
--- Búsqueda 1: Keywords y autocompletado de Google ---
${searchResults[0].text.slice(0, 3000)}

--- Búsqueda 2: Competidores reales y sus listings ---
${searchResults[1].text.slice(0, 3000)}

--- Búsqueda 3: Tendencias y dificultad SEO ---
${searchResults[2].text.slice(0, 3000)}

=== Fuentes verificadas: ${allSources.slice(0, 10).join(", ")} ===

INSTRUCCIONES CRÍTICAS:
- Basa tus keywords en los DATOS REALES de Google de arriba, NO en suposiciones
- Las keywords deben reflejar búsquedas que la gente REALMENTE hace según los datos
- Las preguntas FAQ deben venir de las "People Also Ask" reales encontradas
- La dificultad debe basarse en los datos de competencia real encontrados
- Incluye un campo "dataSource" con valor "google_search_grounding" para indicar que los datos son reales

Devuelve JSON con:
{
  "primaryKeyword": "keyword principal transaccional con intención de compra (basada en datos reales)",
  "secondaryKeywords": ["5 keywords relacionadas long-tail encontradas en Google"],
  "semanticKeywords": ["8 términos semánticos que Google relaciona con este producto"],
  "negativeKeywords": ["términos a evitar (intención incorrecta detectada en búsquedas)"],
  "difficulty": "Fácil|Medio|Difícil (basado en competencia real encontrada)",
  "searchInsights": "resumen de 2-3 frases sobre lo que revelan las búsquedas reales",
  "competitorKeywords": ["3-5 keywords que usan los competidores reales encontrados"],
  "h1Tag": "H1 optimizado incluyendo keyword principal",
  "h2Tags": ["5 H2s para la descripción del producto con keywords secundarias"],
  "faqSchema": [{"question": "pregunta REAL de People Also Ask", "answer": "respuesta SEO-optimizada"}, ...5 preguntas],
  "urlHandle": "handle-seo-optimo-con-keyword",
  "blogPostIdea": "idea de post de blog basada en búsquedas reales detectadas",
  "sources": ["URLs de fuentes verificadas"],
  "dataSource": "google_search_grounding"
}`;

  const result = await askClaudeJsonWithBrain(projectId, prompt, SEO_SYSTEM, "seo", niche);

  if (result) {
    result.sources = allSources.slice(0, 15);
    result.searchQueries = allQueries.slice(0, 10);
    result.dataSource = "google_search_grounding";
  }

  learnFromOperation({
    operationType: "seo_keywords",
    niche: project?.storeNiche ?? null,
    title: `Keywords: ${productName} — ${result?.primaryKeyword ?? ""}`,
    content: `Keyword strategy para "${productName}" con datos reales de Google Search. Primary: ${result?.primaryKeyword ?? ""}. Secondary: ${JSON.stringify(result?.secondaryKeywords ?? []).slice(0, 300)}. Semantic: ${JSON.stringify(result?.semanticKeywords ?? []).slice(0, 300)}. Difficulty: ${result?.difficulty ?? "N/A"}. Sources: ${allSources.slice(0, 5).join(", ")}`,
    confidence: 0.85,
    tags: ["seo", "keywords", "google_grounded", project?.storeNiche ?? "ecommerce"].filter(Boolean),
  });

  res.json(result);
});

router.post("/projects/:projectId/seo/blog-strategy", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const products = await db.select({ title: productsTable.title }).from(productsTable).where(eq(productsTable.projectId, projectId)).limit(10);
  const niche = project?.storeNiche ?? "e-commerce";
  const productList = products.map((p) => p.title).join(", ");

  let trendData = "";
  try {
    const trendSearch = await askGeminiWithSearch(
      `Search Google for: most popular blog topics and content trends in "${niche}" Spain 2025-2026. What questions do people ask about ${productList}? What blog posts from competitors rank well? Find "People Also Ask" questions, trending topics, and content gaps in this niche. What are the most shared articles?`,
      `You are a content strategy researcher. Find REAL trending blog topics, popular questions, and high-performing content in this niche from Google Search. Return specific data from actual search results.`
    );
    trendData = trendSearch.text.slice(0, 4000);
  } catch { trendData = ""; }

  const prompt = `Crea una estrategia de contenido de blog para la tienda "${project?.name}" (nicho: ${niche}, audiencia: ${project?.targetAudience ?? "adultos"}).

Productos actuales: ${productList}

${trendData ? `=== DATOS REALES DE TENDENCIAS DE GOOGLE ===\n${trendData}\n\nINSTRUCCIONES: Basa los temas de blog en las tendencias REALES encontradas arriba. Los títulos deben responder preguntas que la gente REALMENTE busca en Google.\n` : ""}

Devuelve JSON con:
{
  "pillarPage": { "title": "...", "primaryKeyword": "...", "wordCountTarget": 3000, "h2Structure": ["..."], "internalLinks": ["..."], "sampleIntro": "primeros 200 palabras...", "funnel": "top" },
  "clusterPosts": [5 posts que apoyan el pilar, mismo formato],
  "productPosts": [1 post por producto principal, mismo formato],
  "dataSource": "google_search_grounding"
}`;

  const result = await askClaudeJsonWithBrain(projectId, prompt, SEO_SYSTEM, "seo", niche, 6000);

  if (result && trendData) {
    result.dataSource = "google_search_grounding";
  }

  learnFromOperation({
    operationType: "seo_blog",
    niche: project?.storeNiche ?? null,
    title: `Blog strategy — ${project?.name ?? project?.shopDomain ?? "store"}`,
    content: `Estrategia blog para ${project?.name} con datos reales de Google. Pilar: ${result?.pillarPage?.title ?? "N/A"}. Clusters: ${result?.clusterPosts?.length ?? 0}. Product posts: ${result?.productPosts?.length ?? 0}. Nicho: ${niche}.`,
    confidence: 0.85,
    tags: ["seo", "blog", "content_strategy", "google_grounded"],
  });

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

  const result = await askClaudeJsonWithBrain(projectId, prompt, SEO_SYSTEM, "seo", undefined, 8000);

  learnFromOperation({
    operationType: "seo_blog",
    title: `Blog post: ${title}`,
    content: `Artículo generado: "${title}". Keyword: ${primaryKeyword}. ${result?.wordCount ?? 0} palabras. Meta: ${result?.metaTitle ?? ""}.`,
    confidence: 0.7,
    tags: ["seo", "blog", "content"],
  });

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
