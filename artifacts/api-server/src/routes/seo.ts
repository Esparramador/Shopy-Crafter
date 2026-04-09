import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable, bulkJobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude";
import { askGeminiWithSearch } from "../lib/gemini";
import { createBulkJob, updateJobProgress, completeJob, runAsync } from "../lib/bulk-queue";
import { saveToVault } from "../lib/vault.js";
import { getConnector } from "../lib/connectors/index";
import { logger } from "../lib/logger.js";

const router = Router();

const SEO_SYSTEM = `You are an expert SEO copywriter and technical SEO specialist for Shopify e-commerce in Spain/Latin America. You maximize CTR in Google search results and understand Google's ranking algorithms deeply. Always respond in Spanish.`;

function calculateSeoScore(data: {
  hasMetaTitle: boolean; hasMetaDesc: boolean; hasSchema: boolean;
  hasAltTexts: boolean; cleanHandle: boolean; descriptionLength: number;
  pageSpeedScore?: number; internalLinks?: number;
  metaTitleLength?: number; metaDescLength?: number;
  titleLength?: number; imageCount?: number; tagCount?: number;
  wordCount?: number; hasStructuredContent?: boolean;
  title?: string; bodyText?: string; metaTitle?: string; metaDesc?: string;
  tags?: string; schemaType?: string;
  hasOpenGraph?: boolean; hasFaqSchema?: boolean;
}): { score: number; grade: string; details?: Record<string, number> } {
  const details: Record<string, number> = {};
  let totalWeight = 0;
  let weightedSum = 0;

  function addCriterion(name: string, points: number, maxPoints: number, weight: number) {
    const normalized = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    details[name] = Math.round(normalized);
    weightedSum += normalized * weight;
    totalWeight += weight;
  }

  let metaTitlePts = 0;
  if (data.hasMetaTitle) {
    metaTitlePts = 60;
    if (data.metaTitleLength && data.metaTitleLength >= 40 && data.metaTitleLength <= 60) metaTitlePts = 100;
    else if (data.metaTitleLength && data.metaTitleLength >= 30 && data.metaTitleLength <= 70) metaTitlePts = 80;
  }
  addCriterion("metaTitle", metaTitlePts, 100, 10);

  let metaDescPts = 0;
  if (data.hasMetaDesc) {
    metaDescPts = 60;
    if (data.metaDescLength && data.metaDescLength >= 130 && data.metaDescLength <= 160) metaDescPts = 100;
    else if (data.metaDescLength && data.metaDescLength >= 100 && data.metaDescLength <= 170) metaDescPts = 80;
  }
  addCriterion("metaDescription", metaDescPts, 100, 8);

  let schemaPts = 0;
  if (data.hasSchema) {
    schemaPts = 60;
    if (data.schemaType === "Product" || data.schemaType === "product") schemaPts = 85;
    if (data.hasFaqSchema) schemaPts = 100;
  } else {
    if (data.hasFaqSchema) schemaPts = 30;
  }
  addCriterion("structuredData", schemaPts, 100, 10);

  addCriterion("altTexts", data.hasAltTexts ? 100 : 0, 100, 6);

  let handlePts = 0;
  if (data.cleanHandle) {
    handlePts = 80;
    const handleLen = data.titleLength ? Math.min(data.titleLength, 60) : 30;
    if (handleLen >= 10 && handleLen <= 50) handlePts = 100;
  }
  addCriterion("urlHandle", handlePts, 100, 3);

  let linkPts = 0;
  if (data.internalLinks && data.internalLinks >= 4) linkPts = 100;
  else if (data.internalLinks && data.internalLinks >= 2) linkPts = 60;
  else if (data.internalLinks && data.internalLinks >= 1) linkPts = 30;
  addCriterion("internalLinking", linkPts, 100, 4);

  const wc = data.wordCount ?? Math.round(data.descriptionLength / 5);
  let wcPts = 0;
  if (wc >= 800) wcPts = 100;
  else if (wc >= 500) wcPts = 80;
  else if (wc >= 300) wcPts = 55;
  else if (wc >= 100) wcPts = 25;
  addCriterion("contentDepth", wcPts, 100, 9);

  let speedPts = 0;
  if (data.pageSpeedScore && data.pageSpeedScore >= 90) speedPts = 100;
  else if (data.pageSpeedScore && data.pageSpeedScore >= 70) speedPts = 70;
  else if (data.pageSpeedScore && data.pageSpeedScore >= 50) speedPts = 40;
  addCriterion("pageSpeed", speedPts, 100, 7);

  let titlePts = 0;
  if (data.titleLength && data.titleLength >= 45 && data.titleLength <= 70) titlePts = 100;
  else if (data.titleLength && data.titleLength >= 30 && data.titleLength <= 80) titlePts = 60;
  else if (data.titleLength && data.titleLength >= 20) titlePts = 30;
  addCriterion("titleOptimization", titlePts, 100, 5);

  const ic = data.imageCount ?? 0;
  let imgPts = 0;
  if (ic >= 8) imgPts = 100;
  else if (ic >= 5) imgPts = 70;
  else if (ic >= 3) imgPts = 45;
  else if (ic >= 1) imgPts = 15;
  addCriterion("imageCount", imgPts, 100, 7);

  const tc = data.tagCount ?? 0;
  let tagPts = 0;
  if (tc >= 20) tagPts = 100;
  else if (tc >= 15) tagPts = 75;
  else if (tc >= 10) tagPts = 50;
  else if (tc >= 5) tagPts = 25;
  addCriterion("tagOptimization", tagPts, 100, 5);

  addCriterion("structuredContent", data.hasStructuredContent ? 100 : 0, 100, 4);

  let keywordPts = 0;
  if (data.title && data.bodyText) {
    const titleWords = data.title.toLowerCase().replace(/[—–|·\-]/g, " ").split(/\s+/).filter(w => w.length > 3);
    const bodyLower = data.bodyText.toLowerCase();
    const first200 = bodyLower.substring(0, Math.min(bodyLower.length, 800));
    const matchedInBody = titleWords.filter(w => bodyLower.includes(w)).length;
    const matchedInFirst = titleWords.filter(w => first200.includes(w)).length;

    if (titleWords.length > 0) {
      const bodyRatio = matchedInBody / titleWords.length;
      const prominenceRatio = matchedInFirst / titleWords.length;
      if (bodyRatio >= 0.6) keywordPts += 40;
      else if (bodyRatio >= 0.3) keywordPts += 20;
      if (prominenceRatio >= 0.5) keywordPts += 35;
      else if (prominenceRatio >= 0.25) keywordPts += 15;
    }

    if (data.tags) {
      const tagsLower = data.tags.toLowerCase();
      const tagKeywordMatch = titleWords.filter(w => tagsLower.includes(w)).length;
      if (titleWords.length > 0 && tagKeywordMatch / titleWords.length >= 0.4) keywordPts += 25;
    }
  }
  addCriterion("keywordConsistency", Math.min(100, keywordPts), 100, 8);

  let readPts = 0;
  if (data.bodyText && wc >= 50) {
    const sentences = data.bodyText.split(/[.!?¿¡]+/).filter(s => s.trim().length > 5);
    const avgSentLen = sentences.length > 0 ? wc / sentences.length : 0;
    if (avgSentLen >= 10 && avgSentLen <= 25) readPts = 100;
    else if (avgSentLen >= 8 && avgSentLen <= 30) readPts = 70;
    else if (avgSentLen > 0) readPts = 35;

    const paragraphs = data.bodyText.split(/\n\n|\r\n\r\n/).filter(p => p.trim().length > 20);
    if (paragraphs.length >= 5) readPts = Math.min(100, readPts + 10);
  }
  addCriterion("readability", readPts, 100, 6);

  let ogPts = 0;
  if (data.hasMetaTitle && data.hasMetaDesc && (data.imageCount ?? 0) >= 1) ogPts = 100;
  else if (data.hasMetaTitle && data.hasMetaDesc) ogPts = 60;
  else if (data.hasMetaTitle || data.hasMetaDesc) ogPts = 30;
  addCriterion("socialMeta", ogPts, 100, 3);

  let faqPts = 0;
  if (data.bodyText) {
    const hasFaq = /faq|pregunta|¿.*\?/i.test(data.bodyText);
    if (hasFaq && data.hasFaqSchema) faqPts = 100;
    else if (hasFaq) faqPts = 60;
    else if (data.hasFaqSchema) faqPts = 50;
  }
  addCriterion("faqOptimization", faqPts, 100, 5);

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score: Math.min(100, score), grade, details };
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
    const bodyText = p.bodyHtml?.replace(/<[^>]+>/g, "") ?? "";
    const descLen = bodyText.length;
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
    const hasAltTexts = (p.imagesJson as Array<{ alt: string | null }> | null)?.every((img) => img.alt && img.alt.trim() !== "") ?? false;
    const cleanHandle = /^[a-z0-9-]+$/.test(p.handle) && p.handle.length <= 60;
    const tagCount = p.tags ? p.tags.split(",").filter(t => t.trim()).length : 0;
    const hasStructuredContent = /<(h2|h3|ul|ol|table)[\s>]/i.test(p.bodyHtml ?? "");

    const { score, grade, details } = calculateSeoScore({
      hasMetaTitle: !!seo?.metaTitle,
      hasMetaDesc: !!seo?.metaDescription,
      hasSchema: seo?.hasSchema ?? false,
      hasAltTexts: hasAltTexts || p.imageCount === 0,
      cleanHandle,
      descriptionLength: descLen,
      pageSpeedScore: seo?.pageSpeedScore ?? undefined,
      metaTitleLength: seo?.metaTitle?.length,
      metaDescLength: seo?.metaDescription?.length,
      titleLength: p.title.length,
      imageCount: p.imageCount ?? 0,
      tagCount,
      wordCount,
      hasStructuredContent,
      title: p.title,
      bodyText: bodyText,
      metaTitle: seo?.metaTitle ?? undefined,
      metaDesc: seo?.metaDescription ?? undefined,
      tags: p.tags ?? undefined,
      schemaType: seo?.hasSchema ? "Product" : undefined,
      hasFaqSchema: /faq|pregunta/i.test(p.bodyHtml ?? ""),
    });

    totalScore += score;

    return {
      productId: p.shopifyProductId,
      title: p.title,
      score,
      grade,
      details,
      hasMetaTitle: !!seo?.metaTitle,
      hasMetaDesc: !!seo?.metaDescription,
      hasSchema: seo?.hasSchema ?? false,
      hasAltTexts: hasAltTexts || p.imageCount === 0,
      cleanHandle,
      descriptionLength: descLen,
      wordCount,
      imageCount: p.imageCount ?? 0,
      tagCount,
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
  const { applyToShopify = false, productIds } = (req.body || {}) as { applyToShopify?: boolean; productIds?: string[] };

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
          const { updateStoreSeo } = await import("../lib/platform-helper.js");
          const seoResult = await updateStoreSeo(projectId, product.shopifyProductId, {
            metaTitle: result.metaTitle,
            metaDescription: result.metaDescription,
          });
          if (!seoResult.ok) {
            logger.warn({ error: seoResult.error }, "SEO update failed — platform may not support SEO write");
          }
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
${searchResults[0].text.slice(0, 12000)}

--- Búsqueda 2: Competidores reales y sus listings ---
${searchResults[1].text.slice(0, 12000)}

--- Búsqueda 3: Tendencias y dificultad SEO ---
${searchResults[2].text.slice(0, 12000)}

=== Fuentes verificadas: ${allSources.slice(0, 20).join(", ")} ===

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
    content: `Keyword strategy para "${productName}" con datos reales de Google Search. Primary: ${result?.primaryKeyword ?? ""}. Secondary: ${JSON.stringify(result?.secondaryKeywords ?? [])}.  Semantic: ${JSON.stringify(result?.semanticKeywords ?? [])}. Difficulty: ${result?.difficulty ?? "N/A"}. Sources: ${allSources.slice(0, 10).join(", ")}. FAQ: ${JSON.stringify((result?.faqSchema ?? []).slice(0, 3))}`,
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
          const altText = await askClaudeWithBrain(projectId, [{
            role: "user",
            content: `Alt text SEO en español (máx 125 chars) para imagen de ${imageType} del producto "${product.title}" en tienda de ${project?.storeNiche ?? "e-commerce"}. Solo devuelve el alt text.`,
          }], undefined, "seo", project?.storeNiche ?? undefined, 200);

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
  const { applyToShopify = false, productIds } = (req.body || {}) as { applyToShopify?: boolean; productIds?: string[] };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const all = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const products = productIds?.length ? all.filter((p) => productIds.includes(p.shopifyProductId)) : all;

  const jobId = await createBulkJob(projectId, "generate_schemas", products.length + 1);

  res.json({
    jobId,
    status: "running",
    totalItems: products.length,
    message: `Generando schemas JSON-LD para ${products.length} productos e inyectando en theme...`,
  });

  runAsync(async () => {
    let completed = 0;
    let failed = 0;
    const generatedSchemas: Array<{ productId: string; title: string; schema: string }> = [];

    for (const product of products) {
      try {
        const shopifyData = await shopifyRequest(
          projectId, project.shopDomain,
          `/products/${product.shopifyProductId}.json`, "GET"
        );
        const sp = shopifyData?.product;
        if (!sp) { failed++; continue; }

        const priceAmount = sp.variants?.[0]?.price || "0";
        const currency = "EUR";
        const available = sp.variants?.[0]?.inventory_quantity > 0 || sp.status === "active";
        const images = sp.images || [];
        const bodyText = (sp.body_html || "").replace(/<[^>]+>/g, " ").trim();

        const faqPrompt = `Analiza este producto de Shopify y genera 3-5 preguntas frecuentes (FAQ) realistas que un comprador haría. Producto: "${sp.title}". Descripción: "${bodyText.slice(0, 500)}". 

Responde SOLO con un JSON array así:
[{"question":"...","answer":"..."},...]

Las preguntas deben ser específicas del producto, no genéricas. Respuestas concisas (1-2 frases).`;

        let faqs: Array<{ question: string; answer: string }> = [];
        try {
          const faqResult = await askClaudeJsonWithBrain(projectId, faqPrompt, SEO_SYSTEM, "seo");
          if (Array.isArray(faqResult)) faqs = faqResult;
        } catch { /* use empty FAQ */ }

        const productSchema: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: sp.title,
          description: bodyText.slice(0, 500),
          url: `https://${project.shopDomain}/products/${sp.handle}`,
          brand: { "@type": "Brand", name: project.shopName || project.shopDomain.split(".")[0] },
          offers: {
            "@type": "Offer",
            price: priceAmount,
            priceCurrency: currency,
            availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `https://${project.shopDomain}/products/${sp.handle}`,
            seller: { "@type": "Organization", name: project.shopName || project.shopDomain.split(".")[0] },
          },
        };

        if (images.length > 0) {
          productSchema.image = images.map((i: { src: string }) => i.src);
        }

        if (sp.variants?.length > 1) {
          productSchema.offers = {
            "@type": "AggregateOffer",
            lowPrice: Math.min(...sp.variants.map((v: { price: string }) => parseFloat(v.price))).toFixed(2),
            highPrice: Math.max(...sp.variants.map((v: { price: string }) => parseFloat(v.price))).toFixed(2),
            priceCurrency: currency,
            offerCount: sp.variants.length,
            availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          };
        }

        const schemas: Record<string, unknown>[] = [productSchema];

        if (faqs.length > 0) {
          schemas.push({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          });
        }

        schemas.push({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: `https://${project.shopDomain}` },
            { "@type": "ListItem", position: 2, name: sp.product_type || "Productos", item: `https://${project.shopDomain}/collections/all` },
            { "@type": "ListItem", position: 3, name: sp.title, item: `https://${project.shopDomain}/products/${sp.handle}` },
          ],
        });

        const safeJsonLd = (obj: Record<string, unknown>) => JSON.stringify(obj).replace(/<\//g, "\\u003c/");
        const schemaScripts = schemas.map((s) => `<script type="application/ld+json">${safeJsonLd(s)}</script>`).join("\n");

        generatedSchemas.push({ productId: product.shopifyProductId, title: sp.title, schema: schemaScripts });

        try {
          await shopifyRequest(
            projectId, project.shopDomain,
            `/products/${product.shopifyProductId}/metafields.json`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metafield: { namespace: "seo", key: "jsonld", value: schemaScripts, type: "multi_line_text_field" } }) }
          );
        } catch { /* metafield save is optional */ }

        await db.update(seoDataTable)
          .set({ hasSchema: true, lastAuditedAt: new Date() })
          .where(and(eq(seoDataTable.projectId, projectId), eq(seoDataTable.shopifyProductId, product.shopifyProductId)));

        completed++;
        await updateJobProgress(jobId, completed, failed, `✓ Schema JSON-LD: ${sp.title} (Product + ${faqs.length > 0 ? "FAQ + " : ""}Breadcrumb)`);
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Error";
        await updateJobProgress(jobId, completed, failed, `✗ ${product.title}: ${msg}`);
      }
    }

    try {
      const { getActiveTheme, readThemeFile, writeThemeFile } = await import("../lib/shopify-theme.js");
      const theme = await getActiveTheme(projectId, project.shopDomain);
      if (theme) {
        const layoutFile = await readThemeFile(projectId, project.shopDomain, theme.id, "layout/theme.liquid");
        if (layoutFile?.value) {
          let layoutContent = layoutFile.value;
          const orgSchema = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: project.shopName || project.shopDomain.split(".")[0],
            url: `https://${project.shopDomain}`,
            logo: `https://${project.shopDomain}/cdn/shop/files/logo.png`,
            sameAs: [],
          });
          const webSiteSchema = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: project.shopName || project.shopDomain.split(".")[0],
            url: `https://${project.shopDomain}`,
            potentialAction: {
              "@type": "SearchAction",
              target: `https://${project.shopDomain}/search?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          });

          const safeOrg = orgSchema.replace(/<\//g, "\\u003c/");
          const safeWeb = webSiteSchema.replace(/<\//g, "\\u003c/");
          const schemaBlock = `
<!-- ShopyBrain JSON-LD Schemas -->
<script type="application/ld+json">${safeOrg}</script>
<script type="application/ld+json">${safeWeb}</script>
<!-- End ShopyBrain Schemas -->`;

          const oldSchemaRegex = /<!-- ShopyBrain JSON-LD Schemas -->[\s\S]*?<!-- End ShopyBrain Schemas -->/;
          if (oldSchemaRegex.test(layoutContent)) {
            layoutContent = layoutContent.replace(oldSchemaRegex, schemaBlock.trim());
          } else {
            layoutContent = layoutContent.replace("</head>", `${schemaBlock}\n</head>`);
          }

          await writeThemeFile(projectId, project.shopDomain, theme.id, "layout/theme.liquid", layoutContent);
          await updateJobProgress(jobId, completed + 1, failed, `✓ Organization + WebSite schema inyectados en theme.liquid`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      await updateJobProgress(jobId, completed, failed + 1, `✗ Error inyectando en theme: ${msg}`);
    }

    await completeJob(jobId);

    try {
      learnFromOperation({
        operationType: "seo",
        title: `generate_schemas: ${completed} schemas JSON-LD`,
        content: `${completed} schemas JSON-LD generados (Product + FAQ + Breadcrumb + Organization + WebSite). Inyectados en theme.liquid. ${failed} fallos. Productos: ${generatedSchemas.map(s => s.title).join(", ")}`,
        confidence: 0.9,
        tags: ["seo", "schema", "json-ld", "rich-snippets"],
      });
    } catch { /* optional */ }
  });
});

export default router;
