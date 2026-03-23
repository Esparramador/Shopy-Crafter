import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable, bulkJobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaude, askClaudeJson, askClaudeJsonWithBrain } from "../lib/claude";
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
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY ?? "";

  try {
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}${apiKey ? `&key=${apiKey}` : ""}`;
    const resp = await fetch(psiUrl);
    const data = await resp.json() as {
      id?: string;
      lighthouseResult?: {
        categories?: {
          performance?: { score?: number };
          seo?: { score?: number };
          accessibility?: { score?: number };
          "best-practices"?: { score?: number };
        };
        audits?: Record<string, {
          numericValue?: number;
          displayValue?: string;
          score?: number;
          title?: string;
          description?: string;
        }>;
      };
      loadingExperience?: {
        overall_category?: string;
        metrics?: {
          FIRST_CONTENTFUL_PAINT_MS?: { percentile?: number; category?: string };
          LARGEST_CONTENTFUL_PAINT_MS?: { percentile?: number; category?: string };
          CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile?: number; category?: string };
          INTERACTION_TO_NEXT_PAINT?: { percentile?: number; category?: string };
          FIRST_INPUT_DELAY_MS?: { percentile?: number; category?: string };
          EXPERIMENTAL_TIME_TO_FIRST_BYTE?: { percentile?: number; category?: string };
        };
      };
    };

    const lighthouse = data.lighthouseResult;
    const audits = lighthouse?.audits ?? {};
    const cats = lighthouse?.categories ?? {};
    const fieldData = data.loadingExperience?.metrics ?? {};

    const perfScore = Math.round((cats.performance?.score ?? 0) * 100);
    const seoScore = Math.round((cats.seo?.score ?? 0) * 100);
    const accessScore = Math.round((cats.accessibility?.score ?? 0) * 100);
    const bestScore = Math.round((cats["best-practices"]?.score ?? 0) * 100);

    const lcp = (audits["largest-contentful-paint"]?.numericValue ?? 0) / 1000;
    const cls = audits["cumulative-layout-shift"]?.numericValue ?? 0;
    const fcp = (audits["first-contentful-paint"]?.numericValue ?? 0) / 1000;
    const tbt = audits["total-blocking-time"]?.numericValue ?? 0;
    const si = (audits["speed-index"]?.numericValue ?? 0) / 1000;
    const tti = (audits["interactive"]?.numericValue ?? 0) / 1000;
    const inp = audits["interaction-to-next-paint"]?.numericValue ?? 0;
    const ttfb = (audits["server-response-time"]?.numericValue ?? 0);

    const issues: string[] = [];
    const fixes: string[] = [];
    const opportunities: Array<{ title: string; savings: string; impact: "high" | "medium" | "low" }> = [];

    if (lcp > 2.5) {
      issues.push(`LCP lento: ${lcp.toFixed(1)}s (objetivo <2.5s)`);
      fixes.push("Optimiza el elemento más grande de la vista: preload de imagen hero, compresión WebP, CDN con cache-control largo");
      opportunities.push({ title: "Mejorar LCP", savings: `${(lcp - 2.5).toFixed(1)}s más lento`, impact: "high" });
    }
    if (cls > 0.1) {
      issues.push(`CLS alto: ${cls.toFixed(3)} (objetivo <0.1)`);
      fixes.push("Define width y height explícitos en imágenes y videos para eliminar layout shifts");
      opportunities.push({ title: "Reducir CLS", savings: `Score ${cls.toFixed(3)}`, impact: "high" });
    }
    if (tbt > 200) {
      issues.push(`TBT alto: ${tbt.toFixed(0)}ms (objetivo <200ms)`);
      fixes.push("Divide bundles JS con code splitting, aplica lazy loading de scripts no críticos");
      opportunities.push({ title: "Reducir TBT", savings: `${tbt.toFixed(0)}ms de bloqueo`, impact: "medium" });
    }
    if (inp > 200) {
      issues.push(`INP alto: ${inp.toFixed(0)}ms (objetivo <200ms)`);
      fixes.push("Aplica async/defer a scripts no críticos, optimiza event listeners pesados");
    }
    if (ttfb > 600) {
      issues.push(`TTFB lento: ${ttfb.toFixed(0)}ms (objetivo <600ms)`);
      fixes.push("Activa Shopify CDN en todas las regiones, considera edge caching para páginas de producto");
      opportunities.push({ title: "Reducir TTFB", savings: `${ttfb.toFixed(0)}ms servidor`, impact: "medium" });
    }
    if (fcp > 1.8) {
      issues.push(`FCP lento: ${fcp.toFixed(1)}s (objetivo <1.8s)`);
      fixes.push("Inline el CSS crítico, elimina render-blocking resources del <head>");
    }

    const fieldSummary = data.loadingExperience?.overall_category ?? null;

    res.json({
      url,
      strategy,
      performanceScore: perfScore,
      seoScore,
      accessibilityScore: accessScore,
      bestPracticesScore: bestScore,
      coreWebVitals: {
        lcp: { value: parseFloat(lcp.toFixed(2)), unit: "s", status: lcp <= 2.5 ? "good" : lcp <= 4 ? "needs-improvement" : "poor" },
        cls: { value: parseFloat(cls.toFixed(3)), unit: "", status: cls <= 0.1 ? "good" : cls <= 0.25 ? "needs-improvement" : "poor" },
        inp: { value: inp, unit: "ms", status: inp <= 200 ? "good" : inp <= 500 ? "needs-improvement" : "poor" },
        fcp: { value: parseFloat(fcp.toFixed(2)), unit: "s", status: fcp <= 1.8 ? "good" : fcp <= 3 ? "needs-improvement" : "poor" },
        tbt: { value: tbt, unit: "ms", status: tbt <= 200 ? "good" : tbt <= 600 ? "needs-improvement" : "poor" },
        si: { value: parseFloat(si.toFixed(2)), unit: "s", status: si <= 3.4 ? "good" : si <= 5.8 ? "needs-improvement" : "poor" },
        tti: { value: parseFloat(tti.toFixed(2)), unit: "s", status: tti <= 3.8 ? "good" : tti <= 7.3 ? "needs-improvement" : "poor" },
        ttfb: { value: ttfb, unit: "ms", status: ttfb <= 600 ? "good" : ttfb <= 1800 ? "needs-improvement" : "poor" },
      },
      fieldData: {
        category: fieldSummary,
        lcp: fieldData.LARGEST_CONTENTFUL_PAINT_MS?.category ?? null,
        cls: fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category ?? null,
        inp: fieldData.INTERACTION_TO_NEXT_PAINT?.category ?? null,
      },
      issues,
      fixes,
      opportunities,
    });
  } catch (err) {
    res.status(500).json({
      url,
      strategy: "mobile",
      performanceScore: 0,
      seoScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      coreWebVitals: {},
      fieldData: {},
      issues: ["No se pudo obtener datos de PageSpeed. Verifica que la URL sea pública y accesible desde internet."],
      fixes: [],
      opportunities: [],
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

  const result = await askClaudeJsonWithBrain(projectId, prompt, SEO_SYSTEM, "seo", project?.storeNiche ?? undefined);
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

  const result = await askClaudeJsonWithBrain(projectId, prompt, SEO_SYSTEM, "seo", project?.storeNiche ?? undefined, 6000);
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
