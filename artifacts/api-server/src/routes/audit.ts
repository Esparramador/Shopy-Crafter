import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, auditResultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { formatScrapingForPrompt, validateAuditUrl } from "../lib/web-scraper.js";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";
import { UniversalAuditConnector } from "../lib/connectors/universal.js";
import { enableLongRunning } from "../lib/long-running.js";
import { requireProjectAccess } from "../lib/access.js";

const router = Router();

const AUDIT_SYSTEM = `Eres un auditor web profesional y experto en SEO, rendimiento web, accesibilidad y mejores prácticas. Analizas sitios web de cualquier plataforma y generas informes detallados con recomendaciones accionables priorizadas por impacto. Siempre respondes en español.`;

interface AuditAiAnalysis {
  overallScore: number;
  categories: {
    technicalSeo: { score: number; summary: string };
    contentQuality: { score: number; summary: string };
    performance: { score: number; summary: string };
    mobileFriendliness: { score: number; summary: string };
    accessibility: { score: number; summary: string };
  };
  issues: Array<{
    title: string;
    description: string;
    severity: "critical" | "warning" | "info";
    category: string;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    category: string;
  }>;
  seoChecklist: Array<{
    item: string;
    passed: boolean;
    details: string;
  }>;
  competitiveKeywords: string[];
  summary: string;
}

router.post("/projects/:projectId/audit/run", requireProjectAccess, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
  
    const url = project.shopDomain.startsWith("http") ? project.shopDomain : `https://${project.shopDomain}`;
  
    const urlError = validateAuditUrl(url);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }
  
    res.json({ status: "running", message: "Auditoría iniciada. Los resultados estarán disponibles en unos momentos." });
  
    try {
      const connector = new UniversalAuditConnector(project);
      const auditData = await connector.runFullAudit();
  
      const psLines: string[] = [];
      if (auditData.pageSpeedMobile || auditData.pageSpeedDesktop) {
        psLines.push(auditData.pageSpeedSummary);
      } else {
        psLines.push("⚠️ No se pudieron obtener datos de PageSpeed Insights.");
      }
  
      const scrapeLines = auditData.scraping ? formatScrapingForPrompt(auditData.scraping) : "⚠️ No se pudo analizar el HTML del sitio.";
  
      const prompt = `Analiza los siguientes datos de auditoría web para "${project.name}" (${url}).
  
  === DATOS DE GOOGLE PAGESPEED INSIGHTS ===
  ${psLines.join("\n")}
  
  === ANÁLISIS HTML / SCRAPING ===
  ${scrapeLines}
  
  Genera un análisis JSON completo con la siguiente estructura exacta:
  {
    "overallScore": <número 0-100>,
    "categories": {
      "technicalSeo": { "score": <0-100>, "summary": "<resumen>" },
      "contentQuality": { "score": <0-100>, "summary": "<resumen>" },
      "performance": { "score": <0-100>, "summary": "<resumen>" },
      "mobileFriendliness": { "score": <0-100>, "summary": "<resumen>" },
      "accessibility": { "score": <0-100>, "summary": "<resumen>" }
    },
    "issues": [{ "title": "", "description": "", "severity": "critical|warning|info", "category": "" }],
    "recommendations": [{ "title": "", "description": "", "impact": "high|medium|low", "effort": "low|medium|high", "category": "" }],
    "seoChecklist": [{ "item": "", "passed": true/false, "details": "" }],
    "competitiveKeywords": ["keyword1", "keyword2"],
    "summary": "<resumen ejecutivo de 2-3 frases>"
  }
  
  IMPORTANTE:
  - Las puntuaciones deben reflejar los datos REALES de PageSpeed y el scraping
  - Ordena las recomendaciones por impacto (high primero)
  - Incluye al menos 5 items en el SEO checklist
  - Incluye al menos 3 recomendaciones accionables
  - Sé específico con los problemas encontrados`;
  
      const aiAnalysis = await askClaudeJsonWithBrain<AuditAiAnalysis>(
        projectId,
        prompt,
        AUDIT_SYSTEM,
        "seo",
        project.storeNiche ?? undefined,
        8192
      );
  
      const [auditResult] = await db.insert(auditResultsTable).values({
        projectId,
        url,
        overallScore: aiAnalysis.overallScore,
        performanceScore: auditData.pageSpeedMobile?.performanceScore ?? auditData.pageSpeedDesktop?.performanceScore ?? null,
        seoScore: auditData.pageSpeedMobile?.seoScore ?? auditData.pageSpeedDesktop?.seoScore ?? null,
        accessibilityScore: auditData.pageSpeedMobile?.accessibilityScore ?? auditData.pageSpeedDesktop?.accessibilityScore ?? null,
        bestPracticesScore: auditData.pageSpeedMobile?.bestPracticesScore ?? auditData.pageSpeedDesktop?.bestPracticesScore ?? null,
        contentQualityScore: aiAnalysis.categories.contentQuality.score,
        mobileFriendlinessScore: aiAnalysis.categories.mobileFriendliness.score,
        technicalSeoScore: aiAnalysis.categories.technicalSeo.score,
        pageSpeedMobile: auditData.pageSpeedMobile ?? null,
        pageSpeedDesktop: auditData.pageSpeedDesktop ?? null,
        scrapingResult: auditData.scraping ?? null,
        aiAnalysis: aiAnalysis,
        issues: aiAnalysis.issues,
        recommendations: aiAnalysis.recommendations,
      }).returning();
  
      await db.update(projectsTable)
        .set({ avgAuditScore: aiAnalysis.overallScore })
        .where(eq(projectsTable.id, projectId));
  
      const domain = new URL(url).hostname;
  
      learnFromOperation({
        operationType: "web_audit",
        niche: project.storeNiche ?? null,
        title: `Web Audit: ${domain} — Score ${aiAnalysis.overallScore}/100`,
        content: `Auditoría web completa de ${domain}. Score general: ${aiAnalysis.overallScore}/100. SEO Técnico: ${aiAnalysis.categories.technicalSeo.score}. Contenido: ${aiAnalysis.categories.contentQuality.score}. Rendimiento: ${aiAnalysis.categories.performance.score}. Mobile: ${aiAnalysis.categories.mobileFriendliness.score}. Accesibilidad: ${aiAnalysis.categories.accessibility.score}. Issues críticos: ${aiAnalysis.issues.filter(i => i.severity === "critical").length}. Warnings: ${aiAnalysis.issues.filter(i => i.severity === "warning").length}. Resumen: ${aiAnalysis.summary}`,
        confidence: 0.85,
        tags: ["audit", "seo", "web_audit", domain],
      });
  
      learnFromOperation({
        operationType: "performance_audit",
        niche: project.storeNiche ?? null,
        title: `Performance: ${domain}`,
        content: `Core Web Vitals de ${domain}: Performance ${auditData.pageSpeedMobile?.performanceScore ?? "N/A"}/100 (mobile), ${auditData.pageSpeedDesktop?.performanceScore ?? "N/A"}/100 (desktop). LCP: ${auditData.pageSpeedMobile?.coreWebVitals.lcp.value ?? "N/A"}s. CLS: ${auditData.pageSpeedMobile?.coreWebVitals.cls.value ?? "N/A"}. INP: ${auditData.pageSpeedMobile?.coreWebVitals.inp.value ?? "N/A"}ms. Oportunidades: ${auditData.pageSpeedMobile?.opportunities.map(o => o.title).join(", ") ?? "ninguna"}`,
        confidence: 0.9,
        tags: ["audit", "performance", "pagespeed", domain],
      });
  
      learnFromOperation({
        operationType: "content_audit",
        niche: project.storeNiche ?? null,
        title: `Content Audit: ${domain}`,
        content: `Calidad de contenido de ${domain}: Score ${aiAnalysis.categories.contentQuality.score}/100. ${aiAnalysis.categories.contentQuality.summary}. Palabras: ${auditData.scraping?.wordCount ?? "N/A"}. H1: ${auditData.scraping?.headings.h1Count ?? "N/A"}. Imágenes sin alt: ${auditData.scraping?.images.withoutAlt ?? "N/A"}/${auditData.scraping?.images.total ?? "N/A"}. Meta desc: ${auditData.scraping?.metaDescriptionLength ?? 0} chars. OG tags: ${auditData.scraping?.ogTags.title ? "sí" : "no"}.`,
        confidence: 0.8,
        tags: ["audit", "content", domain],
      });
  
      learnFromOperation({
        operationType: "competitor_analysis",
        niche: project.storeNiche ?? null,
        title: `Competitive Keywords: ${domain}`,
        content: `Keywords competitivas para ${domain}: ${aiAnalysis.competitiveKeywords.join(", ")}. SEO checklist: ${aiAnalysis.seoChecklist.filter(c => c.passed).length}/${aiAnalysis.seoChecklist.length} pasados. Issues por categoría: ${[...new Set(aiAnalysis.issues.map(i => i.category))].join(", ")}.`,
        confidence: 0.85,
        tags: ["audit", "keywords", "competitive", domain],
      });
  
      learnFromOperation({
        operationType: "strategic_learning",
        niche: project.storeNiche ?? null,
        title: `AI Recommendations: ${domain}`,
        content: `Recomendaciones para ${domain}: ${aiAnalysis.recommendations.map(r => `[${r.impact}] ${r.title}: ${r.description}`).join(". ")}`,
        confidence: 0.85,
        tags: ["audit", "recommendations", domain],
      });
  
      try {
        const { ingestToShopyBrain } = await import("../lib/brain-ingester.js");
        ingestToShopyBrain({
          sourceType: "audit_result",
          rawIntelligence: `Auditoría web de ${domain} (${url}). Score: ${aiAnalysis.overallScore}/100. SEO técnico: ${aiAnalysis.categories.technicalSeo.score}. Contenido: ${aiAnalysis.categories.contentQuality.score}. Performance: ${aiAnalysis.categories.performance.score}. Mobile: ${aiAnalysis.categories.mobileFriendliness.score}. Accesibilidad: ${aiAnalysis.categories.accessibility.score}. Issues: ${aiAnalysis.issues.map(i => `[${i.severity}] ${i.title}`).join("; ")}. Recomendaciones: ${aiAnalysis.recommendations.map(r => `[${r.impact}] ${r.title}`).join("; ")}. Keywords: ${aiAnalysis.competitiveKeywords.join(", ")}. Resumen: ${aiAnalysis.summary}`,
          niche: project.storeNiche ?? undefined,
          title: `Universal Audit: ${domain} — ${aiAnalysis.overallScore}/100`,
          confidence: 0.85,
        });
      } catch {}
  
      try {
        await saveToVault({
          projectId,
          fileType: "audit_report",
          category: "web_audit",
          title: `Auditoría Web — ${domain} · Score ${aiAnalysis.overallScore}/100 · ${new Date().toLocaleDateString("es-ES")}`,
          description: `Auditoría completa: SEO ${aiAnalysis.categories.technicalSeo.score}, Contenido ${aiAnalysis.categories.contentQuality.score}, Performance ${aiAnalysis.categories.performance.score}`,
          mimeType: "application/json",
          generatedBy: "universal_audit",
          metadata: { auditId: auditResult.id, ...aiAnalysis },
        });
      } catch {}
  
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error desconocido";
      try {
        await db.insert(auditResultsTable).values({
          projectId,
          url,
          overallScore: 0,
          aiAnalysis: { error: errMsg },
          issues: [{ title: "Error en la auditoría", description: errMsg, severity: "critical", category: "system" }],
          recommendations: [],
        });
      } catch {}
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/audit/results", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
  
    const [latest] = await db.select()
      .from(auditResultsTable)
      .where(eq(auditResultsTable.projectId, projectId))
      .orderBy(desc(auditResultsTable.auditedAt))
      .limit(1);
  
    if (!latest) {
      res.json({ hasResults: false, result: null });
      return;
    }
  
    res.json({ hasResults: true, result: latest });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/audit/history", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
  
    const history = await db.select({
      id: auditResultsTable.id,
      url: auditResultsTable.url,
      overallScore: auditResultsTable.overallScore,
      performanceScore: auditResultsTable.performanceScore,
      seoScore: auditResultsTable.seoScore,
      accessibilityScore: auditResultsTable.accessibilityScore,
      bestPracticesScore: auditResultsTable.bestPracticesScore,
      auditedAt: auditResultsTable.auditedAt,
    })
      .from(auditResultsTable)
      .where(eq(auditResultsTable.projectId, projectId))
      .orderBy(desc(auditResultsTable.auditedAt))
      .limit(20);
  
    res.json(history);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
