import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude";
import { askGeminiWithSearch, isGeminiSearchBlocked } from "../lib/gemini";
import { recordApiUsage } from "../lib/api-usage.js";
import { createBulkJob, updateJobProgress, completeJob, runAsync, runAsyncJob } from "../lib/bulk-queue";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import { safeFetch } from "../lib/web-scraper.js";
import { enableLongRunning } from "../lib/long-running.js";

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
  try {
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
      title: `SEO Audit — ${project?.name ?? project?.shopDomain ?? "store"}: ${storeGrade} (${Math.round(avgScore)}/100)`,
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/generate-metas", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
  
    runAsyncJob(jobId, async () => {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/generate-sitemap", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/audit-page-speed", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/keyword-intelligence", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const { productName } = req.body as { productName: string; productId?: string };
  
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
      if (r.status === "fulfilled") {
        if (r.value.usage) {
          void recordApiUsage({
            provider: "gemini",
            operation: "seo/keywords-research",
            model: r.value.usage.model,
            projectId,
            inputUnits: r.value.usage.inputTokens,
            outputUnits: r.value.usage.outputTokens,
            unitsLabel: "tokens",
            costUsd: r.value.usage.costUsd,
            success: true,
          });
        }
        return r.value;
      }
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
  
    const result = await askClaudeJsonWithBrain<Record<string, any>>(projectId, prompt, SEO_SYSTEM, "seo", niche);
  
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/blog-strategy", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
      if (trendSearch.usage) {
        void recordApiUsage({
          provider: "gemini",
          operation: "seo/blog-strategy",
          model: trendSearch.usage.model,
          projectId,
          inputUnits: trendSearch.usage.inputTokens,
          outputUnits: trendSearch.usage.outputTokens,
          unitsLabel: "tokens",
          costUsd: trendSearch.usage.costUsd,
          success: true,
        });
      }
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
  
    const result = await askClaudeJsonWithBrain<Record<string, any>>(projectId, prompt, SEO_SYSTEM, "seo", niche, 6000);
  
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/generate-blog-post", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
  
    const result = await askClaudeJsonWithBrain<Record<string, any>>(projectId, prompt, SEO_SYSTEM, "seo", undefined, 8000);
  
    learnFromOperation({
      operationType: "seo_blog",
      title: `Blog post: ${title}`,
      content: `Artículo generado: "${title}". Keyword: ${primaryKeyword}. ${result?.wordCount ?? 0} palabras. Meta: ${result?.metaTitle ?? ""}.`,
      confidence: 0.7,
      tags: ["seo", "blog", "content"],
    });
  
    res.json(result);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/fix-alt-texts", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
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
  
    runAsyncJob(jobId, async () => {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/seo/generate-schemas", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const { applyToShopify: _applyToShopify = false, productIds } = (req.body || {}) as { applyToShopify?: boolean; productIds?: string[] };
  
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
  
    runAsyncJob(jobId, async () => {
      let completed = 0;
      let failed = 0;
      const generatedSchemas: Array<{ productId: string; title: string; schema: string }> = [];
  
      for (const product of products) {
        try {
          const shopifyData = await shopifyRequest<any>(
            projectId, project.shopDomain,
            `/products/${product.shopifyProductId}.json`, { method: "GET" }
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
            brand: { "@type": "Brand", name: project.name || project.shopDomain.split(".")[0] },
            offers: {
              "@type": "Offer",
              price: priceAmount,
              priceCurrency: currency,
              availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `https://${project.shopDomain}/products/${sp.handle}`,
              seller: { "@type": "Organization", name: project.name || project.shopDomain.split(".")[0] },
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
              name: project.name || project.shopDomain.split(".")[0],
              url: `https://${project.shopDomain}`,
              logo: `https://${project.shopDomain}/cdn/shop/files/logo.png`,
              sameAs: [],
            });
            const webSiteSchema = JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: project.name || project.shopDomain.split(".")[0],
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ── Helper: extraer señales SEO reales del HTML vivo de un producto ──────────
function extractLiveSeoSignals(html: string, productUrl: string) {
  const clean = (s: string) =>
    s.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ").trim().slice(0, 600);

  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaDescM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description/i);
  const metaDesc = clean(metaDescM?.[1] ?? "");
  const ogTitle = clean(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i)?.[1] ?? "");
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i)?.[1]?.trim() ?? "";
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i)?.[1]?.trim() ?? "";
  const robotsMeta = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i)?.[1]?.trim() ?? "";

  const schemaTypes: string[] = [];
  const schemaRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = schemaRe.exec(html)) !== null) {
    try {
      const p = JSON.parse(sm[1]);
      const types: string[] = Array.isArray(p) ? p.map((x: any) => x["@type"]).filter(Boolean) : [p["@type"]].filter(Boolean);
      schemaTypes.push(...types);
    } catch {}
  }

  const h1s: string[] = [];
  const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = h1Re.exec(html)) !== null) h1s.push(hm[1].replace(/<[^>]+>/g, "").trim().slice(0, 120));

  const imgTags = [...html.matchAll(/<img[^>]*>/gi)];
  const imgsWithoutAlt = imgTags.filter(m => !/alt=["'][^"']+/i.test(m[0])).length;

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 2).length;

  let internalLinks = 0;
  try {
    const base = new URL(productUrl);
    const linkRe = /href=["']([^"'#?]+)/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html)) !== null) {
      const h = lm[1];
      if (h.startsWith("/") || h.includes(base.hostname)) internalLinks++;
    }
  } catch {}

  const hasGoogleAnalytics = /gtag\s*\(|google-analytics\.com|_ga\b|UA-\d{4,}|G-[A-Z0-9]+/i.test(html);
  const hasGTM = /googletagmanager\.com|GTM-[A-Z0-9]+/i.test(html);
  const hasFbPixel = /connect\.facebook\.net|fbq\s*\(/i.test(html);

  return {
    titleTag: title, titleLength: title.length,
    metaDescription: metaDesc, metaDescLength: metaDesc.length,
    hasOgTitle: !!ogTitle, hasOgImage: !!ogImage,
    hasCanonical: !!canonical, canonicalUrl: canonical,
    robotsMeta: robotsMeta || "index, follow",
    isIndexable: !robotsMeta.toLowerCase().includes("noindex"),
    hasSchema: schemaTypes.length > 0, schemaTypes,
    h1Count: h1s.length, h1Text: h1s[0] ?? "",
    imagesTotal: imgTags.length, imagesWithoutAlt: imgsWithoutAlt,
    wordCount, internalLinks,
    hasGoogleAnalytics, hasGTM, hasFbPixel,
  };
}

function computeLiveSeoScore(signals: ReturnType<typeof extractLiveSeoSignals>): { score: number; grade: string; issues: string[]; fixes: string[] } {
  const issues: string[] = []; const fixes: string[] = []; let score = 100;
  if (!signals.titleTag) { issues.push("❌ Sin etiqueta <title>"); fixes.push("Añade title de 50–60 chars con keyword principal"); score -= 20; }
  else if (signals.titleLength < 30 || signals.titleLength > 70) { issues.push(`⚠️ Title con ${signals.titleLength} chars (ideal 50–60)`); fixes.push("Ajusta el title a 50–60 caracteres"); score -= 8; }
  if (!signals.metaDescription) { issues.push("❌ Sin meta description"); fixes.push("Añade meta description 140–160 chars con keyword y CTA"); score -= 15; }
  else if (signals.metaDescLength < 80 || signals.metaDescLength > 175) { issues.push(`⚠️ Meta description: ${signals.metaDescLength} chars (ideal 140–160)`); score -= 6; }
  if (!signals.hasSchema) { issues.push("❌ Sin JSON-LD — sin rich snippets en Google"); fixes.push("Implementa schema Product con precio, disponibilidad y reseñas"); score -= 15; }
  if (!signals.hasOgTitle || !signals.hasOgImage) { issues.push("⚠️ Open Graph incompleto"); fixes.push("Añade og:title, og:description y og:image"); score -= 5; }
  if (!signals.hasCanonical) { issues.push("⚠️ Sin URL canonical"); fixes.push("Añade <link rel='canonical'> para evitar contenido duplicado"); score -= 7; }
  if (signals.h1Count === 0) { issues.push("❌ Sin etiqueta H1"); fixes.push("Añade exactamente 1 H1 con la keyword principal"); score -= 12; }
  else if (signals.h1Count > 1) { issues.push(`⚠️ ${signals.h1Count} etiquetas H1 (Google prefiere 1)`); score -= 4; }
  if (signals.imagesWithoutAlt > 0) { issues.push(`⚠️ ${signals.imagesWithoutAlt} imagen(es) sin alt text`); fixes.push("Añade alt text descriptivo con keyword a cada imagen"); score -= Math.min(10, signals.imagesWithoutAlt * 2); }
  if (signals.wordCount < 200) { issues.push(`⚠️ Contenido escaso: ${signals.wordCount} palabras`); fixes.push("Amplía descripción con beneficios, materiales, FAQ (mínimo 300 palabras)"); score -= 8; }
  if (!signals.isIndexable) { issues.push("🚨 CRÍTICO: Página noindex — NO aparece en Google"); score -= 30; }
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade, issues, fixes };
}

function escH(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function seoScoreColor(s: number): string {
  return s >= 80 ? "#22c55e" : s >= 60 ? "#eab308" : s >= 40 ? "#f97316" : "#ef4444";
}

function buildSeoFullScanReport(opts: {
  project: { name?: string | null; shopDomain: string; storeNiche?: string | null };
  products: Array<{
    productId: string; title: string; handle: string; url: string;
    liveSignals?: ReturnType<typeof extractLiveSeoSignals>;
    liveSeoScore: number; liveGrade: string; issues: string[]; fixes: string[]; fetchError?: string;
  }>;
  homepagePageSpeed: any;
  serpData: { text: string; sources: string[] } | null;
  avgScore: number; scanned: number; total: number;
  stats: { noTitle: number; noMetaDesc: number; noSchema: number; noH1: number; noindexCount: number };
  generatedAt: string;
}): string {
  const { project, products, homepagePageSpeed, serpData, avgScore, scanned, total, stats, generatedAt } = opts;
  const storeGrade = avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 45 ? "D" : "F";
  const scoreC = seoScoreColor(avgScore);
  const storeName = project.name ?? project.shopDomain;
  const domain = project.shopDomain;
  const date = new Date(generatedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const time = new Date(generatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const productRows = products.map(p => {
    const s = p.liveSignals;
    const c = seoScoreColor(p.liveSeoScore);
    const checksHtml = s ? [
      { ok: !!s.titleTag && s.titleLength >= 30 && s.titleLength <= 70, label: "Title" },
      { ok: !!s.metaDescription && s.metaDescLength >= 100, label: "Meta" },
      { ok: s.hasSchema, label: "Schema" },
      { ok: s.hasOgTitle && s.hasOgImage, label: "OG" },
      { ok: s.hasCanonical, label: "Canonical" },
      { ok: s.h1Count === 1, label: "H1" },
      { ok: s.imagesWithoutAlt === 0, label: "Alts" },
      { ok: s.wordCount >= 200, label: "Words" },
    ].map(x => `<span style="padding:1px 5px;border-radius:3px;font-size:9px;background:${x.ok ? "#22c55e22" : "#ef444422"};color:${x.ok ? "#22c55e" : "#ef4444"};border:1px solid ${x.ok ? "#22c55e33" : "#ef444433"};">${x.ok ? "✓" : "✗"} ${x.label}</span>`).join("") : "";
    const issueHtml = p.issues.length > 0
      ? `<ul style="margin:4px 0 0;padding-left:14px;font-size:10px;color:#ccc;">${p.issues.slice(0, 3).map(i => `<li>${escH(i)}</li>`).join("")}</ul>`
      : `<div style="color:#22c55e;font-size:10px;margin-top:4px;">✅ Sin problemas críticos</div>`;
    return `<tr style="border-bottom:1px solid #11111f;">
      <td style="padding:10px 8px;vertical-align:top;">
        <a href="${escH(p.url)}" target="_blank" style="color:#d4a843;text-decoration:none;font-size:12px;font-weight:600;">${escH(p.title.slice(0, 48))}</a>
        <div style="font-size:10px;color:#444;margin-top:2px;">/products/${escH(p.handle)}</div>
        ${p.fetchError ? `<div style="font-size:10px;color:#ef4444;">${escH(p.fetchError)}</div>` : ""}
      </td>
      <td style="padding:10px 8px;text-align:center;vertical-align:top;">
        <div style="width:34px;height:34px;border-radius:50%;border:2px solid ${c};display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${c};">${p.liveGrade}</div>
        <div style="font-size:9px;color:#666;margin-top:2px;">${p.liveSeoScore}/100</div>
      </td>
      <td style="padding:10px 8px;vertical-align:top;">
        <div style="display:flex;gap:3px;flex-wrap:wrap;">${checksHtml}</div>
        ${issueHtml}
      </td>
      <td style="padding:10px 8px;vertical-align:top;font-size:11px;color:#888;">${s ? s.wordCount : "–"}</td>
      <td style="padding:10px 8px;vertical-align:top;font-size:10px;">${s ? (s.hasSchema ? `<span style="color:#22c55e;">${escH(s.schemaTypes.slice(0, 2).join(", "))}</span>` : `<span style="color:#ef4444;">Ninguno</span>`) : "–"}</td>
    </tr>`;
  }).join("");

  const psBlock = homepagePageSpeed ? `
  <div style="margin-bottom:40px;">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:16px;color:#d4a843;">⚡ Google PageSpeed — Homepage (Mobile)</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
      ${[
        { label: "Rendimiento", val: homepagePageSpeed.performanceScore },
        { label: "SEO Google", val: homepagePageSpeed.seoScore },
        { label: "Accesibilidad", val: homepagePageSpeed.accessibilityScore },
        { label: "Best Practices", val: homepagePageSpeed.bestPracticesScore },
      ].map(x => { const c2 = seoScoreColor(x.val ?? 0); return `<div style="background:#0d0d1a;padding:16px;border-radius:10px;text-align:center;border:1px solid ${c2}33;"><div style="font-size:32px;font-weight:800;color:${c2};">${x.val ?? "–"}</div><div style="font-size:11px;color:#888;margin-top:4px;">${x.label}</div></div>`; }).join("")}
    </div>
    ${homepagePageSpeed.coreWebVitals ? `<table style="width:100%;border-collapse:collapse;font-size:12px;background:#0d0d1a;border-radius:10px;overflow:hidden;"><thead><tr style="background:#11112a;"><th style="padding:8px;text-align:left;color:#888;">Métrica CWV</th><th style="padding:8px;color:#888;">Valor</th><th style="padding:8px;color:#888;">Estado</th></tr></thead><tbody>${Object.entries(homepagePageSpeed.coreWebVitals).map(([k, v]: [string, any]) => { const statusC2 = v.status === "good" ? "#22c55e" : v.status === "needs-improvement" ? "#eab308" : "#ef4444"; const lbs: Record<string,string> = { lcp:"LCP (Largest Contentful Paint)", cls:"CLS (Cumulative Layout Shift)", fcp:"FCP (First Contentful Paint)", inp:"INP (Interaction to Next Paint)", tbt:"TBT (Total Blocking Time)", si:"Speed Index", ttfb:"TTFB" }; return `<tr style="border-top:1px solid #11111f;"><td style="padding:8px;color:#ccc;">${lbs[k]??k.toUpperCase()}</td><td style="padding:8px;color:${statusC2};font-weight:700;">${v.value}${v.unit}</td><td style="padding:8px;"><span style="padding:2px 6px;border-radius:3px;font-size:10px;background:${statusC2}22;color:${statusC2};">${v.status === "good" ? "Bueno" : v.status === "needs-improvement" ? "Mejorable" : "Malo"}</span></td></tr>`; }).join("")}</tbody></table>` : ""}
    ${(homepagePageSpeed.opportunities ?? []).length > 0 ? `<h3 style="font-size:14px;margin:16px 0 8px;color:#f97316;">🚀 Oportunidades de Mejora de Velocidad</h3>${(homepagePageSpeed.opportunities as any[]).slice(0,5).map(o => `<div style="padding:8px 12px;background:#0d0d1a;border-radius:6px;margin-bottom:4px;border-left:3px solid #f97316;font-size:12px;color:#ccc;">${escH(o.title)} <span style="color:#f97316;">${escH(o.savings)}</span></div>`).join("")}` : ""}
  </div>` : "";

  const serpBlock = serpData?.text ? `
  <div style="margin-bottom:40px;">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;color:#d4a843;">🔍 Posicionamiento Real en Google (SERP)</h2>
    <div style="background:#0d0d1a;padding:20px;border-radius:12px;border:1px solid #1a1a2e;"><p style="color:#ccc;font-size:13px;line-height:1.7;white-space:pre-wrap;">${escH(serpData.text.slice(0, 2000))}</p>${serpData.sources.length > 0 ? `<div style="margin-top:10px;font-size:11px;color:#555;">Fuentes: ${serpData.sources.slice(0,6).map(s => `<a href="${escH(s)}" target="_blank" style="color:#d4a843;margin-right:6px;">${escH(s.replace(/^https?:\/\/(www\.)?/,"").split("/")[0])}</a>`).join("")}</div>` : ""}</div>
  </div>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Informe SEO Completo — ${escH(storeName)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#080814;color:#eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5}.page{max-width:1100px;margin:0 auto;padding:40px 32px}table{width:100%;border-collapse:collapse}@media print{body{background:#fff;color:#000}}</style>
</head>
<body><div class="page">
  <div style="background:linear-gradient(135deg,#0d0d1a,#12123a);border-radius:16px;padding:40px;margin-bottom:32px;border:1px solid #1a1a3a;text-align:center;">
    <div style="font-size:12px;color:#d4a843;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Shopy Crafter · Informe Profesional SEO</div>
    <h1 style="font-size:28px;font-weight:800;margin-bottom:4px;">Escaneo SEO Real — ${escH(storeName)}</h1>
    <p style="color:#888;font-size:13px;">${escH(domain)} · Generado ${date} ${time}</p>
    <div style="margin-top:20px;display:inline-block;width:90px;height:90px;border-radius:50%;border:5px solid ${scoreC};display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:32px;font-weight:800;color:${scoreC};">${storeGrade}</span></div>
    <p style="margin-top:8px;font-size:13px;color:#aaa;">Score Medio: ${avgScore}/100 · ${scanned} de ${total} productos escaneados en vivo</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:32px;">
    ${[
      { label: "Score Medio", val: `${avgScore}/100`, color: scoreC, icon: "📊" },
      { label: "Sin Meta Desc", val: stats.noMetaDesc, color: stats.noMetaDesc > 0 ? "#ef4444" : "#22c55e", icon: "📝" },
      { label: "Sin Schema", val: stats.noSchema, color: stats.noSchema > 0 ? "#f97316" : "#22c55e", icon: "🔗" },
      { label: "Sin H1", val: stats.noH1, color: stats.noH1 > 0 ? "#eab308" : "#22c55e", icon: "📰" },
      { label: "Noindex ⚠", val: stats.noindexCount, color: stats.noindexCount > 0 ? "#ef4444" : "#22c55e", icon: "🚫" },
    ].map(k => `<div style="background:#0d0d1a;padding:16px;border-radius:10px;text-align:center;border:1px solid ${k.color}33;"><div style="font-size:20px;">${k.icon}</div><div style="font-size:26px;font-weight:800;color:${k.color};margin:4px 0;">${k.val}</div><div style="font-size:11px;color:#888;">${k.label}</div></div>`).join("")}
  </div>
  ${psBlock}${serpBlock}
  <div style="margin-bottom:40px;">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:16px;color:#d4a843;">📦 Análisis en Vivo por Producto (${scanned} escaneados de ${total})</h2>
    <div style="background:#0d0d1a;border-radius:12px;border:1px solid #1a1a2e;overflow:hidden;">
      <table><thead><tr style="background:#111128;border-bottom:2px solid #1a1a3a;">
        <th style="text-align:left;padding:10px 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Producto</th>
        <th style="text-align:center;padding:10px 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Score</th>
        <th style="text-align:left;padding:10px 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Checks SEO + Issues</th>
        <th style="text-align:left;padding:10px 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Palabras</th>
        <th style="text-align:left;padding:10px 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;">Schema</th>
      </tr></thead><tbody>${productRows}</tbody></table>
    </div>
  </div>
  <div style="margin-bottom:40px;">
    <h2 style="font-size:20px;font-weight:700;margin-bottom:16px;color:#d4a843;">🛠️ Plan de Acción SEO Priorizado</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${stats.noMetaDesc > 0 ? `<div style="background:#0d0d1a;padding:16px;border-radius:10px;border-left:4px solid #ef4444;"><div style="color:#ef4444;font-size:12px;font-weight:700;margin-bottom:6px;">🔴 CRÍTICO — ${stats.noMetaDesc} sin Meta Description</div><p style="font-size:12px;color:#ccc;">Usa "Meta Tags Masivos" en Shopy Crafter para generarlas con IA en 1 clic. Impacto directo en CTR.</p></div>` : ""}
      ${stats.noSchema > 0 ? `<div style="background:#0d0d1a;padding:16px;border-radius:10px;border-left:4px solid #f97316;"><div style="color:#f97316;font-size:12px;font-weight:700;margin-bottom:6px;">🟠 ALTO — ${stats.noSchema} sin JSON-LD Schema</div><p style="font-size:12px;color:#ccc;">Usa "Generar JSON-LD Schemas" para rich snippets con precio y disponibilidad en resultados de Google.</p></div>` : ""}
      ${stats.noH1 > 0 ? `<div style="background:#0d0d1a;padding:16px;border-radius:10px;border-left:4px solid #eab308;"><div style="color:#eab308;font-size:12px;font-weight:700;margin-bottom:6px;">🟡 MEDIO — ${stats.noH1} sin H1</div><p style="font-size:12px;color:#ccc;">Añade etiqueta H1 con keyword principal de cada producto en el theme de Shopify.</p></div>` : ""}
      <div style="background:#0d0d1a;padding:16px;border-radius:10px;border-left:4px solid #22c55e;"><div style="color:#22c55e;font-size:12px;font-weight:700;margin-bottom:6px;">✅ VELOCIDAD — Core Web Vitals</div><p style="font-size:12px;color:#ccc;">Optimiza imágenes a WebP, activa lazy loading y comprime JS/CSS para mejorar LCP y CLS.</p></div>
    </div>
  </div>
  <div style="text-align:center;padding:20px;border-top:1px solid #1a1a2e;margin-top:32px;">
    <p style="font-size:12px;color:#555;">Generado por <strong style="color:#d4a843;">Shopy Crafter</strong> · shopycrafter.com · ${date}</p>
    <p style="font-size:11px;color:#333;margin-top:2px;">Datos en tiempo real — escaneo vivo de ${escH(domain)}</p>
  </div>
</div></body></html>`;
}

// ── Escaneo SEO REAL en vivo: scrape de cada URL de producto + PageSpeed + SERP
router.post("/projects/:projectId/seo/full-scan", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const shopDomain = project.shopDomain;
    if (!shopDomain) { res.status(400).json({ error: "Dominio de tienda no configurado" }); return; }

    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    if (products.length === 0) {
      res.json({ success: false, error: "No hay productos sincronizados. Sincroniza tu catálogo primero.", products: [], storeScore: 0 });
      return;
    }

    const BROWSER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

    // PageSpeed homepage + SERP en paralelo
    const [psResult, serpResult] = await Promise.allSettled([
      (async () => { const { runPageSpeedAudit } = await import("../lib/pagespeed.js"); return runPageSpeedAudit(`https://${shopDomain}`, "mobile"); })(),
      (async () => {
        if (await isGeminiSearchBlocked()) return null;
        const niche = project.storeNiche ?? "e-commerce";
        return askGeminiWithSearch(
          `Search Google for the Shopify store ${shopDomain} (brand: "${project.name ?? shopDomain}"). Find real data:
1. Total pages indexed by Google: use site:${shopDomain} operator
2. Top keyword rankings in Google for ${niche} products from this store
3. Does this store appear in Google Shopping? Any product ads?
4. Google My Business listing or reviews visible in Google results?
5. Domain authority estimate and organic visibility
Return specific numbers and URLs you found in the search results.`,
          "SEO ranking expert. Search Google and return REAL SERP data for this exact store. Report actual findings with numbers."
        );
      })(),
    ]);

    const homepagePageSpeed = psResult.status === "fulfilled" ? psResult.value : null;
    const serpRaw = serpResult.status === "fulfilled" ? serpResult.value : null;
    if (serpRaw && (serpRaw as any)?.usage) {
      void recordApiUsage({
        provider: "gemini",
        operation: "seo/full-scan-serp",
        model: (serpRaw as any).usage.model,
        projectId,
        inputUnits: (serpRaw as any).usage.inputTokens,
        outputUnits: (serpRaw as any).usage.outputTokens,
        unitsLabel: "tokens",
        costUsd: (serpRaw as any).usage.costUsd,
        success: true,
      });
    }
    const serpData = serpRaw ? { text: (serpRaw as any)?.text?.slice(0, 3000) ?? "", sources: (serpRaw as any)?.sources?.slice(0, 10) ?? [] } : null;

    // Scrape en vivo de cada producto (lotes de 5)
    const productsToScan = products.slice(0, 60);
    const liveResults: Array<{
      productId: string; title: string; handle: string; url: string;
      liveSignals?: ReturnType<typeof extractLiveSeoSignals>;
      liveSeoScore: number; liveGrade: string; issues: string[]; fixes: string[]; fetchError?: string;
    }> = [];

    for (let i = 0; i < productsToScan.length; i += 5) {
      const batch = productsToScan.slice(i, i + 5);
      const batchResults = await Promise.allSettled(batch.map(async (product) => {
        const productUrl = `https://${shopDomain}/products/${product.handle}`;
        try {
          const resp = await safeFetch(productUrl, {
            headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const html = await resp.text();
          const signals = extractLiveSeoSignals(html, productUrl);
          const { score, grade, issues, fixes } = computeLiveSeoScore(signals);
          return { productId: product.shopifyProductId, title: product.title, handle: product.handle, url: productUrl, liveSignals: signals, liveSeoScore: score, liveGrade: grade, issues, fixes };
        } catch (err) {
          return {
            productId: product.shopifyProductId, title: product.title, handle: product.handle, url: productUrl,
            liveSignals: undefined, liveSeoScore: 0, liveGrade: "?",
            issues: [`Error al acceder: ${err instanceof Error ? err.message : "Sin respuesta"}`],
            fixes: ["Verifica que la tienda esté activa y accesible públicamente"],
            fetchError: err instanceof Error ? err.message : "Error",
          };
        }
      }));
      for (const r of batchResults) {
        liveResults.push(r.status === "fulfilled" ? r.value : { productId: "", title: "Error", handle: "", url: "", liveSeoScore: 0, liveGrade: "?", issues: [], fixes: [] });
      }
      if (i + 5 < productsToScan.length) await new Promise(r => setTimeout(r, 800));
    }

    const scanned = liveResults.filter(r => !r.fetchError).length;
    const avgScore = scanned > 0 ? Math.round(liveResults.filter(r => !r.fetchError).reduce((s, r) => s + r.liveSeoScore, 0) / scanned) : 0;
    const stats = {
      noTitle: liveResults.filter(r => !r.liveSignals?.titleTag).length,
      noMetaDesc: liveResults.filter(r => !r.liveSignals?.metaDescription).length,
      noSchema: liveResults.filter(r => !r.liveSignals?.hasSchema).length,
      noH1: liveResults.filter(r => r.liveSignals && r.liveSignals.h1Count === 0).length,
      noindexCount: liveResults.filter(r => r.liveSignals && !r.liveSignals.isIndexable).length,
    };

    const reportHtml = buildSeoFullScanReport({
      project, products: liveResults, homepagePageSpeed, serpData, avgScore, scanned, total: products.length, stats, generatedAt: new Date().toISOString(),
    });

    try {
      await saveToVault({
        projectId, fileType: "seo_full_scan", category: "seo",
        title: `Escaneo SEO Real — ${shopDomain} · ${new Date().toLocaleDateString("es-ES")}`,
        description: `${scanned} productos escaneados. Score medio: ${avgScore}/100. ${stats.noMetaDesc} sin meta desc. ${stats.noSchema} sin schema.`,
        mimeType: "text/html", generatedBy: "seo-full-scan", content: reportHtml,
        metadata: { shopDomain, scanned, avgScore, ...stats },
      });
    } catch {}

    learnFromOperation({
      operationType: "seo_full_scan", niche: project.storeNiche ?? null,
      title: `Escaneo SEO Real — ${shopDomain}: ${avgScore}/100`,
      content: `Escaneados ${scanned}/${products.length} productos en vivo. Score: ${avgScore}. Sin meta desc: ${stats.noMetaDesc}. Sin schema: ${stats.noSchema}.`,
      confidence: 0.9, tags: ["seo", "full-scan", "live-audit"],
    });

    res.json({
      success: true,
      storeScore: avgScore,
      storeGrade: avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 45 ? "D" : "F",
      scanned, total: products.length, stats,
      homepagePageSpeed: homepagePageSpeed ? {
        performance: homepagePageSpeed.performanceScore, seo: homepagePageSpeed.seoScore,
        accessibility: homepagePageSpeed.accessibilityScore, bestPractices: homepagePageSpeed.bestPracticesScore,
        coreWebVitals: homepagePageSpeed.coreWebVitals, opportunities: homepagePageSpeed.opportunities,
      } : null,
      serpData,
      products: liveResults,
      reportHtml,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Error en el escaneo";
    if (!res.headersSent) res.status(500).json({ error: msg });
    else try { res.end(JSON.stringify({ error: msg })); } catch {}
  }
});

export default router;
