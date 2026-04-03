import { Router, type Request, type Response } from "express";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { scrapeWebsite, validateUrlWithDnsCheck } from "../lib/web-scraper.js";
import { runPageSpeedAudit } from "../lib/pagespeed.js";
import { saveToVault } from "../lib/vault.js";
import { getReportShell, type ReportTemplate } from "./exports.js";
import { db, projectsTable, projectFilesTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import archiver from "archiver";

const router = Router();

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const VALID_TEMPLATES = new Set<ReportTemplate>(["classic", "elegance", "prestige"]);

interface ExtractedWebContent {
  html: string;
  css: string;
  stylesheetUrls: string[];
}

async function extractFullWebContent(url: string): Promise<ExtractedWebContent> {
  let currentUrl = url;
  let resp: globalThis.Response | null = null;
  for (let hops = 0; hops < 5; hops++) {
    await validateUrlWithDnsCheck(currentUrl);
    resp = await fetch(currentUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    break;
  }
  if (!resp) throw new Error("No response received");
  const finalUrl = currentUrl;

  const html = await resp.text();

  const inlineStyles: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(html)) !== null) {
    if (match[1].trim()) inlineStyles.push(match[1].trim());
  }

  const linkRegex = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const linkRegex2 = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  const stylesheetUrls: string[] = [];
  const seen = new Set<string>();

  for (const re of [linkRegex, linkRegex2]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let href = m[1];
      const resolveBase = finalUrl || url;
      if (href.startsWith("//")) href = "https:" + href;
      else if (href.startsWith("/")) {
        const base = new URL(resolveBase);
        href = base.origin + href;
      } else if (!href.startsWith("http")) {
        try {
          href = new URL(href, resolveBase).toString();
        } catch { continue; }
      }
      if (!seen.has(href)) {
        seen.add(href);
        stylesheetUrls.push(href);
      }
    }
  }

  const externalCss: string[] = [];
  const fetchPromises = stylesheetUrls.slice(0, 15).map(async (cssUrl) => {
    try {
      await validateUrlWithDnsCheck(cssUrl);
      const cssResp = await fetch(cssUrl, {
        headers: { "User-Agent": BROWSER_UA },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (cssResp.ok) {
        const text = await cssResp.text();
        return `/* === ${escapeHtml(cssUrl)} === */\n${text}`;
      }
    } catch {}
    return "";
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) externalCss.push(r.value);
  }

  const allCss = [...inlineStyles, ...externalCss].join("\n\n");

  return {
    html: html.substring(0, 60_000),
    css: allCss.substring(0, 40_000),
    stylesheetUrls,
  };
}

interface WebLabAnalysis {
  overallScore: number;
  categories: {
    design: number;
    ux: number;
    responsive: number;
    accessibility: number;
    performance: number;
    consistency: number;
  };
  colorPalette: {
    current: string[];
    improved: string[];
  };
  typography: {
    current: string[];
    improved: string[];
  };
  structure: Array<{ section: string; element: string; issues: number }>;
  issues: Array<{
    selector: string;
    property: string;
    current: string;
    improved: string;
    severity: "critical" | "high" | "medium" | "low";
    reason: string;
  }>;
  improvedCss: string;
  improvedHtmlFragments: Array<{
    section: string;
    original: string;
    improved: string;
  }>;
  summary: string;
}

const WEB_DESIGN_SYSTEM = `Eres un experto mundial en diseño web, UX/UI, accesibilidad WCAG 2.1, CSS profesional y responsive design.
Tu trabajo es analizar el código real (HTML y CSS) de una página web y producir un análisis profundo con mejoras concretas y accionables.

REGLAS:
- Analiza el código REAL que recibes, no inventes nada
- El CSS mejorado debe ser COMPLETO y listo para copiar/pegar por un equipo de desarrollo
- Cada issue debe incluir el selector CSS exacto, la propiedad, el valor actual y el mejorado
- El score debe ser objetivo y basado en estándares reales (WCAG, Core Web Vitals, mejores prácticas)
- Los fragmentos HTML mejorados deben ser semánticos, accesibles y modernos
- La paleta de colores mejorada debe mantener la identidad de marca pero optimizar contraste y armonía
- Las tipografías recomendadas deben ser de Google Fonts (gratuitas y web-safe)

CATEGORÍAS DE SCORE (0-100):
- design: Estética visual, espaciado, jerarquía, modernidad
- ux: Navegación, CTAs, flujo de usuario, micro-interacciones
- responsive: Adaptación móvil, breakpoints, flexbox/grid
- accessibility: Contraste, alt texts, ARIA, semántica HTML
- performance: CSS optimizado, selectores eficientes, carga
- consistency: Coherencia visual, sistema de diseño, tokens

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "overallScore": number,
  "categories": { "design": number, "ux": number, "responsive": number, "accessibility": number, "performance": number, "consistency": number },
  "colorPalette": { "current": ["#hex", ...], "improved": ["#hex", ...] },
  "typography": { "current": ["Font Name", ...], "improved": ["Font Name", ...] },
  "structure": [{ "section": "header|hero|nav|main|footer|sidebar|...", "element": "tag", "issues": number }],
  "issues": [{ "selector": ".class", "property": "prop", "current": "val", "improved": "val", "severity": "critical|high|medium|low", "reason": "..." }],
  "improvedCss": "/* CSS completo mejorado listo para producción */",
  "improvedHtmlFragments": [{ "section": "nombre", "original": "<code>", "improved": "<code>" }],
  "summary": "Resumen ejecutivo del análisis en español"
}`;

router.post("/web-lab/analyze", async (req: Request, res: Response) => {
  try {
    const { url, projectId, template } = req.body as {
      url: string;
      projectId?: number;
      template?: ReportTemplate;
    };

    if (!url) return res.status(400).json({ error: "URL requerida" });

    const [extraction, pageSpeed, scraperData] = await Promise.all([
      extractFullWebContent(url),
      runPageSpeedAudit(url, "mobile").catch(() => null),
      scrapeWebsite(url).catch(() => null),
    ]);

    let pageSpeedDesktop = null;
    try {
      pageSpeedDesktop = await runPageSpeedAudit(url, "desktop");
    } catch {}

    const pid = projectId ?? 0;
    let projectName = "Análisis externo";
    if (projectId) {
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (proj) projectName = proj.name ?? projectName;
    }

    const htmlForClaude = extraction.html.substring(0, 30_000);
    const cssForClaude = extraction.css.substring(0, 20_000);

    let contextParts: string[] = [];
    contextParts.push(`URL ANALIZADA: ${url}`);
    contextParts.push(`\n--- HTML REAL DE LA PÁGINA (primeros ${htmlForClaude.length} chars) ---\n${htmlForClaude}`);
    contextParts.push(`\n--- CSS REAL (inline + ${extraction.stylesheetUrls.length} archivos externos, primeros ${cssForClaude.length} chars) ---\n${cssForClaude}`);

    if (pageSpeed) {
      contextParts.push(`\n--- PAGESPEED MOBILE ---\nPerformance: ${pageSpeed.performanceScore}/100 | SEO: ${pageSpeed.seoScore}/100 | Accessibility: ${pageSpeed.accessibilityScore}/100 | Best Practices: ${pageSpeed.bestPracticesScore}/100`);
      if (pageSpeed.coreWebVitals) {
        const cwv = pageSpeed.coreWebVitals;
        contextParts.push(`Core Web Vitals — LCP: ${cwv.lcp?.value}${cwv.lcp?.unit} (${cwv.lcp?.status}) | CLS: ${cwv.cls?.value} (${cwv.cls?.status}) | FCP: ${cwv.fcp?.value}${cwv.fcp?.unit} (${cwv.fcp?.status})`);
      }
    }
    if (pageSpeedDesktop) {
      contextParts.push(`\n--- PAGESPEED DESKTOP ---\nPerformance: ${pageSpeedDesktop.performanceScore}/100 | SEO: ${pageSpeedDesktop.seoScore}/100 | Accessibility: ${pageSpeedDesktop.accessibilityScore}/100`);
    }

    if (scraperData) {
      contextParts.push(`\n--- SCRAPER DATA ---\nTitle: ${scraperData.title}\nMeta Description: ${scraperData.metaDescription}\nH1s: ${scraperData.headings?.h1?.join(", ")}\nTotal Images: ${scraperData.images?.total} | Missing Alt: ${scraperData.images?.withoutAlt ?? 0}\nInternal Links: ${scraperData.links?.internal} | External Links: ${scraperData.links?.external}`);
    }

    const userPrompt = `Analiza en profundidad esta página web. Tienes el HTML y CSS REALES extraídos directamente del sitio.\n\n${contextParts.join("\n")}`;

    const analysis = await askClaudeJsonWithBrain<WebLabAnalysis>(
      pid, userPrompt, WEB_DESIGN_SYSTEM, "general", undefined, 16000
    );

    if (!analysis.improvedCss) analysis.improvedCss = "/* No se generaron mejoras CSS */";
    if (!analysis.issues) analysis.issues = [];
    if (!analysis.categories) {
      analysis.categories = { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 };
    }
    if (!analysis.overallScore) {
      const cats = analysis.categories;
      analysis.overallScore = Math.round((cats.design + cats.ux + cats.responsive + cats.accessibility + cats.performance + cats.consistency) / 6);
    }

    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

    const tpl: ReportTemplate = (template && VALID_TEMPLATES.has(template)) ? template : "prestige";
    const reportBody = buildReportBody(analysis, url, pageSpeed, pageSpeedDesktop, scraperData);
    const reportHtml = getReportShell(tpl)(
      "Lab Web — Análisis de Diseño",
      `${projectName} — ${url}`,
      reportBody,
      date,
      projectName
    );

    let vaultReportId: number | null = null;
    let vaultCssId: number | null = null;
    let vaultHtmlId: number | null = null;

    if (pid > 0) {
      const tags = [url, "web-lab", "diseño", `score-${analysis.overallScore}`];

      [vaultReportId, vaultCssId, vaultHtmlId] = await Promise.all([
        saveToVault({
          projectId: pid,
          fileType: "web-lab-report",
          category: "web-lab",
          title: `Lab Web — ${url}`,
          description: analysis.summary,
          originalUrl: url,
          mimeType: "text/html",
          generatedBy: "web-lab",
          content: reportHtml,
          metadata: { url, score: analysis.overallScore, categories: analysis.categories, template: tpl, tags, analysis: JSON.stringify(analysis) },
        }),
        saveToVault({
          projectId: pid,
          fileType: "web-lab-css",
          category: "web-lab",
          title: `CSS Mejorado — ${url}`,
          description: `CSS profesional mejorado para ${url} — Score: ${analysis.overallScore}/100`,
          originalUrl: url,
          mimeType: "text/css",
          generatedBy: "web-lab",
          content: analysis.improvedCss,
          metadata: { url, score: analysis.overallScore, tags },
        }),
        saveToVault({
          projectId: pid,
          fileType: "web-lab-html",
          category: "web-lab",
          title: `HTML Mejorado — ${url}`,
          description: `Fragmentos HTML mejorados para ${url}`,
          originalUrl: url,
          mimeType: "text/html",
          generatedBy: "web-lab",
          content: (analysis.improvedHtmlFragments ?? []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
          metadata: { url, score: analysis.overallScore, fragments: analysis.improvedHtmlFragments?.length ?? 0, tags },
        }),
      ]);

      learnFromOperation({
        operationType: "web_lab_design_analysis",
        title: `Análisis diseño web: ${url} — Score ${analysis.overallScore}/100`,
        content: `Análisis de ${url}. Score general: ${analysis.overallScore}/100. Categorías: Diseño ${analysis.categories.design}, UX ${analysis.categories.ux}, Responsive ${analysis.categories.responsive}, Accesibilidad ${analysis.categories.accessibility}, Performance ${analysis.categories.performance}, Consistencia ${analysis.categories.consistency}. Issues encontrados: ${analysis.issues.length}. Resumen: ${analysis.summary}`,
        confidence: 0.85,
        tags: ["web-lab", "design-analysis", url],
      });

      learnFromOperation({
        operationType: "web_lab_css_patterns",
        title: `Patrones CSS detectados en ${url}`,
        content: `Paleta actual: ${analysis.colorPalette?.current?.join(", ")}. Paleta mejorada: ${analysis.colorPalette?.improved?.join(", ")}. Tipografía actual: ${analysis.typography?.current?.join(", ")}. Recomendada: ${analysis.typography?.improved?.join(", ")}. Issues CSS principales: ${analysis.issues.slice(0, 5).map(i => `${i.selector} → ${i.property}: ${i.current} → ${i.improved}`).join("; ")}`,
        confidence: 0.8,
        tags: ["web-lab", "css-patterns", "design-tokens"],
      });

      learnFromOperation({
        operationType: "web_lab_ux_insights",
        title: `UX/Accesibilidad insights: ${url}`,
        content: `UX Score: ${analysis.categories.ux}/100. Accesibilidad: ${analysis.categories.accessibility}/100. Responsive: ${analysis.categories.responsive}/100. Issues UX/a11y: ${analysis.issues.filter(i => ["accessibility", "ux", "responsive"].some(k => i.property?.toLowerCase().includes(k) || i.selector?.toLowerCase().includes(k))).length}. Resumen: ${analysis.summary}`,
        confidence: 0.8,
        tags: ["web-lab", "ux-insights", "accessibility"],
      });
    }

    res.json({
      success: true,
      analysis,
      vaultIds: { report: vaultReportId, css: vaultCssId, html: vaultHtmlId },
      pageSpeed: pageSpeed ? {
        mobile: { performance: pageSpeed.performanceScore, seo: pageSpeed.seoScore, accessibility: pageSpeed.accessibilityScore, bestPractices: pageSpeed.bestPracticesScore },
        desktop: pageSpeedDesktop ? { performance: pageSpeedDesktop.performanceScore, seo: pageSpeedDesktop.seoScore, accessibility: pageSpeedDesktop.accessibilityScore } : null,
        coreWebVitals: pageSpeed.coreWebVitals,
      } : null,
      scraperData: scraperData ? {
        title: scraperData.title,
        metaDescription: scraperData.metaDescription,
        h1s: scraperData.headings?.h1,
        totalImages: scraperData.images?.total,
        imagesMissingAlt: scraperData.images?.withoutAlt ?? 0,
      } : null,
      url,
      template: tpl,
    });
  } catch (err: any) {
    logger.error({ err }, "Web Lab analysis failed");
    res.status(500).json({ error: err.message || "Error en el análisis" });
  }
});

router.get("/web-lab/history/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: "projectId requerido" });

    const items = await db
      .select()
      .from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        eq(projectFilesTable.category, "web-lab"),
        eq(projectFilesTable.fileType, "web-lab-report"),
      ))
      .orderBy(desc(projectFilesTable.createdAt))
      .limit(30);

    res.json({ items });
  } catch (err: any) {
    logger.error({ err }, "Web Lab history failed");
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/result/:vaultId", async (req: Request, res: Response) => {
  try {
    const vaultId = parseInt(req.params.vaultId);
    if (!vaultId) return res.status(400).json({ error: "vaultId requerido" });

    const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, vaultId));
    if (!file) return res.status(404).json({ error: "No encontrado" });

    res.json({ file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-css/:vaultId", async (req: Request, res: Response) => {
  try {
    const vaultId = parseInt(req.params.vaultId);
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-css"))
    );
    if (!file?.content) return res.status(404).json({ error: "CSS no encontrado" });

    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="improved-styles.css"`);
    res.send(file.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-html/:vaultId", async (req: Request, res: Response) => {
  try {
    const vaultId = parseInt(req.params.vaultId);
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-html"))
    );
    if (!file?.content) return res.status(404).json({ error: "HTML no encontrado" });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="improved-fragments.html"`);
    res.send(file.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-report/:vaultId", async (req: Request, res: Response) => {
  try {
    const vaultId = parseInt(req.params.vaultId);
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-report"))
    );
    if (!file?.content) return res.status(404).json({ error: "Informe no encontrado" });

    const requestedTpl = req.query.template;
    if (requestedTpl && VALID_TEMPLATES.has(requestedTpl as ReportTemplate)) {
      const meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : file.metadata;
      const storedTpl = meta?.template ?? "prestige";
      if (requestedTpl !== storedTpl && meta?.url) {
        const projectId = file.projectId;
        let projectName = "Análisis externo";
        if (projectId) {
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
          if (proj) projectName = proj.name ?? projectName;
        }
        const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
        const tpl = requestedTpl as ReportTemplate;

        const analysis: WebLabAnalysis = meta.analysis
          ? (typeof meta.analysis === "string" ? JSON.parse(meta.analysis) : meta.analysis)
          : { overallScore: meta.score ?? 50, categories: meta.categories ?? { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 }, summary: file.description ?? "", issues: [], improvedCss: "", improvedHtmlFragments: [], colorPalette: { current: [], improved: [] }, typography: { current: [], improved: [] } };

        const reportBody = buildReportBody(analysis, meta.url, null, null, null);
        const reportHtml = getReportShell(tpl)(
          "Lab Web — Análisis de Diseño",
          `${projectName} — ${meta.url}`,
          reportBody,
          date,
          projectName
        );

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="web-lab-report-${tpl}.html"`);
        return res.send(reportHtml);
      }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="web-lab-report.html"`);
    res.send(file.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/web-lab/download-report", async (req: Request, res: Response) => {
  try {
    const { vaultId, template: rawTemplate } = req.body;
    if (!vaultId) return res.status(400).json({ error: "vaultId requerido" });

    const tpl: ReportTemplate = VALID_TEMPLATES.has(rawTemplate) ? rawTemplate : "prestige";
    const vid = parseInt(String(vaultId));
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vid), eq(projectFilesTable.fileType, "web-lab-report"))
    );
    if (!file?.content) return res.status(404).json({ error: "Informe no encontrado" });

    const meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : file.metadata;
    const storedTpl = meta?.template ?? "prestige";

    if (tpl === storedTpl) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="web-lab-report-${tpl}.html"`);
      return res.send(file.content);
    }

    const projectId = file.projectId;
    let projectName = "Análisis externo";
    if (projectId) {
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (proj) projectName = proj.name ?? projectName;
    }

    const url = meta?.url ?? "URL desconocida";
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

    const analysis: WebLabAnalysis = meta?.analysis
      ? (typeof meta.analysis === "string" ? JSON.parse(meta.analysis) : meta.analysis)
      : { overallScore: meta?.score ?? 50, categories: meta?.categories ?? { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 }, summary: file.description ?? "", issues: [], improvedCss: "", improvedHtmlFragments: [], colorPalette: { current: [], improved: [] }, typography: { current: [], improved: [] } };

    const reportBody = buildReportBody(analysis, url, null, null, null);
    const reportHtml = getReportShell(tpl)(
      "Lab Web — Análisis de Diseño",
      `${projectName} — ${url}`,
      reportBody,
      date,
      projectName
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="web-lab-report-${tpl}.html"`);
    res.send(reportHtml);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-pack/:vaultId", async (req: Request, res: Response) => {
  try {
    const vaultId = parseInt(req.params.vaultId);
    const [reportFile] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-report"))
    );
    if (!reportFile) return res.status(404).json({ error: "Análisis no encontrado" });

    const projectId = reportFile.projectId;
    const meta = typeof reportFile.metadata === "string" ? JSON.parse(reportFile.metadata) : reportFile.metadata;
    const targetUrl = meta?.url || "unknown";

    const relatedFiles = await db.select().from(projectFilesTable).where(
      and(
        eq(projectFilesTable.projectId, projectId),
        eq(projectFilesTable.category, "web-lab"),
        eq(projectFilesTable.originalUrl, targetUrl),
      )
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="web-lab-pack.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (const f of relatedFiles) {
      if (!f.content) continue;
      if (f.fileType === "web-lab-report") {
        archive.append(f.content, { name: "informe-web-lab.html" });
      } else if (f.fileType === "web-lab-css") {
        archive.append(f.content, { name: "improved-styles.css" });
      } else if (f.fileType === "web-lab-html") {
        archive.append(f.content, { name: "improved-fragments.html" });
      }
    }

    const readme = `# Web Lab — Pack de Análisis\n\nURL analizada: ${targetUrl}\nFecha: ${new Date().toLocaleDateString("es-ES")}\n\n## Archivos incluidos\n\n- **informe-web-lab.html** — Informe profesional completo. Ábrelo en tu navegador.\n- **improved-styles.css** — CSS mejorado listo para copiar/pegar en tu proyecto.\n- **improved-fragments.html** — Fragmentos HTML mejorados como referencia.\n\n## Instrucciones para el equipo de desarrollo\n\n1. Abre el informe HTML en el navegador para ver el análisis completo\n2. Copia el contenido de improved-styles.css en tu archivo de estilos\n3. Revisa los fragmentos HTML para aplicar las mejoras estructurales\n4. Testea en móvil y escritorio antes de publicar\n\nGenerado por Shopy Crafter — shopycrafter.com`;

    archive.append(readme, { name: "README.md" });
    await archive.finalize();
  } catch (err: any) {
    logger.error({ err }, "Web Lab download pack failed");
    res.status(500).json({ error: err.message });
  }
});

export async function runWebLabAnalysis(url: string, projectId: number, template?: ReportTemplate): Promise<{
  analysis: WebLabAnalysis;
  vaultIds: { report: number | null; css: number | null; html: number | null };
}> {
  const [extraction, pageSpeed, pageSpeedDesktop, scraperData] = await Promise.all([
    extractFullWebContent(url),
    runPageSpeedAudit(url, "mobile").catch(() => null),
    runPageSpeedAudit(url, "desktop").catch(() => null),
    scrapeWebsite(url).catch(() => null),
  ]);

  let projectName = "Análisis externo";
  if (projectId) {
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (proj) projectName = proj.name ?? projectName;
  }

  const htmlForClaude = extraction.html.substring(0, 30_000);
  const cssForClaude = extraction.css.substring(0, 20_000);

  let contextParts: string[] = [];
  contextParts.push(`URL ANALIZADA: ${url}`);
  contextParts.push(`\n--- HTML REAL ---\n${htmlForClaude}`);
  contextParts.push(`\n--- CSS REAL (${extraction.stylesheetUrls.length} archivos) ---\n${cssForClaude}`);

  if (pageSpeed) {
    contextParts.push(`\n--- PAGESPEED MOBILE ---\nPerformance: ${pageSpeed.performanceScore}/100 | SEO: ${pageSpeed.seoScore}/100 | Accessibility: ${pageSpeed.accessibilityScore}/100`);
  }
  if (pageSpeedDesktop) {
    contextParts.push(`\n--- PAGESPEED DESKTOP ---\nPerformance: ${pageSpeedDesktop.performanceScore}/100 | SEO: ${pageSpeedDesktop.seoScore}/100 | Accessibility: ${pageSpeedDesktop.accessibilityScore}/100`);
  }
  if (scraperData) {
    contextParts.push(`\n--- SCRAPER ---\nTitle: ${scraperData.title}\nH1s: ${scraperData.headings?.h1?.join(", ")}\nImages: ${scraperData.images?.total}`);
  }

  const userPrompt = `Analiza en profundidad esta página web. Tienes el HTML y CSS REALES.\n\n${contextParts.join("\n")}`;

  const analysis = await askClaudeJsonWithBrain<WebLabAnalysis>(
    projectId, userPrompt, WEB_DESIGN_SYSTEM, "general", undefined, 16000
  );

  if (!analysis.improvedCss) analysis.improvedCss = "/* No se generaron mejoras CSS */";
  if (!analysis.issues) analysis.issues = [];
  if (!analysis.categories) {
    analysis.categories = { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 };
  }
  if (!analysis.overallScore) {
    const cats = analysis.categories;
    analysis.overallScore = Math.round((cats.design + cats.ux + cats.responsive + cats.accessibility + cats.performance + cats.consistency) / 6);
  }

  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const tpl: ReportTemplate = (template && VALID_TEMPLATES.has(template)) ? template : "prestige";
  const reportBody = buildReportBody(analysis, url, pageSpeed, pageSpeedDesktop, scraperData);
  const reportHtml = getReportShell(tpl)(
    "Lab Web — Análisis de Diseño",
    `${projectName} — ${url}`,
    reportBody,
    date,
    projectName
  );

  const tags = [url, "web-lab", "diseño", `score-${analysis.overallScore}`];
  const [vaultReportId, vaultCssId, vaultHtmlId] = await Promise.all([
    saveToVault({
      projectId,
      fileType: "web-lab-report",
      category: "web-lab",
      title: `Lab Web — ${url}`,
      description: analysis.summary,
      originalUrl: url,
      mimeType: "text/html",
      generatedBy: "web-lab",
      content: reportHtml,
      metadata: { url, score: analysis.overallScore, categories: analysis.categories, template: tpl, tags, analysis: JSON.stringify(analysis) },
    }),
    saveToVault({
      projectId,
      fileType: "web-lab-css",
      category: "web-lab",
      title: `CSS Mejorado — ${url}`,
      description: `CSS profesional mejorado — Score: ${analysis.overallScore}/100`,
      originalUrl: url,
      mimeType: "text/css",
      generatedBy: "web-lab",
      content: analysis.improvedCss,
      metadata: { url, score: analysis.overallScore, tags },
    }),
    saveToVault({
      projectId,
      fileType: "web-lab-html",
      category: "web-lab",
      title: `HTML Mejorado — ${url}`,
      description: `Fragmentos HTML mejorados`,
      originalUrl: url,
      mimeType: "text/html",
      generatedBy: "web-lab",
      content: (analysis.improvedHtmlFragments ?? []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
      metadata: { url, score: analysis.overallScore, tags },
    }),
  ]);

  learnFromOperation({
    operationType: "web_lab_design_analysis",
    title: `Análisis diseño web: ${url} — Score ${analysis.overallScore}/100`,
    content: `Score: ${analysis.overallScore}/100. Categorías: Diseño ${analysis.categories.design}, UX ${analysis.categories.ux}, Responsive ${analysis.categories.responsive}, Accesibilidad ${analysis.categories.accessibility}, Performance ${analysis.categories.performance}, Consistencia ${analysis.categories.consistency}. Issues: ${analysis.issues.length}. ${analysis.summary}`,
    confidence: 0.85,
    tags: ["web-lab", "design-analysis", url],
  });

  learnFromOperation({
    operationType: "web_lab_css_patterns",
    title: `Patrones CSS detectados en ${url}`,
    content: `Paleta actual: ${analysis.colorPalette?.current?.join(", ")}. Paleta mejorada: ${analysis.colorPalette?.improved?.join(", ")}. Tipografía actual: ${analysis.typography?.current?.join(", ")}. Recomendada: ${analysis.typography?.improved?.join(", ")}. Issues CSS principales: ${analysis.issues.slice(0, 5).map(i => `${i.selector} → ${i.property}: ${i.current} → ${i.improved}`).join("; ")}`,
    confidence: 0.8,
    tags: ["web-lab", "css-patterns", "design-tokens"],
  });

  learnFromOperation({
    operationType: "web_lab_ux_insights",
    title: `UX/Accesibilidad insights: ${url}`,
    content: `UX Score: ${analysis.categories.ux}/100. Accesibilidad: ${analysis.categories.accessibility}/100. Responsive: ${analysis.categories.responsive}/100. Issues UX/a11y: ${analysis.issues.filter(i => ["accessibility", "ux", "responsive"].some(k => i.property?.toLowerCase().includes(k) || i.selector?.toLowerCase().includes(k))).length}. Resumen: ${analysis.summary}`,
    confidence: 0.8,
    tags: ["web-lab", "ux-insights", "accessibility"],
  });

  return {
    analysis,
    vaultIds: { report: vaultReportId, css: vaultCssId, html: vaultHtmlId },
  };
}

function buildReportBody(
  analysis: WebLabAnalysis,
  url: string,
  pageSpeedMobile: any,
  pageSpeedDesktop: any,
  scraperData: any,
): string {
  const cats = analysis.categories;
  const scoreColor = (s: number) => s >= 80 ? "#22c55e" : s >= 60 ? "#eab308" : s >= 40 ? "#f97316" : "#ef4444";

  let html = `
<div class="ai-deliverable">
  <h2 style="text-align:center;margin-bottom:8px;">Análisis de Diseño Web</h2>
  <p style="text-align:center;color:#888;margin-bottom:32px;">${escapeHtml(url)}</p>

  <div style="text-align:center;margin-bottom:40px;">
    <div style="display:inline-block;width:140px;height:140px;border-radius:50%;border:6px solid ${scoreColor(analysis.overallScore)};position:relative;">
      <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:42px;font-weight:800;color:${scoreColor(analysis.overallScore)};">${analysis.overallScore}</span>
    </div>
    <p style="margin-top:12px;font-size:14px;color:#aaa;">Score General /100</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:40px;">
    ${Object.entries(cats).map(([key, val]) => {
      const labels: Record<string, string> = { design: "Diseño", ux: "UX", responsive: "Responsive", accessibility: "Accesibilidad", performance: "Performance", consistency: "Consistencia" };
      return `<div style="background:#1a1a2e;padding:16px;border-radius:12px;text-align:center;border:1px solid ${scoreColor(val as number)}33;">
        <div style="font-size:28px;font-weight:700;color:${scoreColor(val as number)};">${val}</div>
        <div style="font-size:12px;color:#aaa;margin-top:4px;">${labels[key] || key}</div>
      </div>`;
    }).join("")}
  </div>

  <h3 style="margin-bottom:12px;">📋 Resumen Ejecutivo</h3>
  <p style="color:#ccc;line-height:1.7;margin-bottom:32px;">${escapeHtml(analysis.summary || "")}</p>`;

  if (analysis.colorPalette) {
    html += `
  <h3 style="margin-bottom:12px;">🎨 Paleta de Colores</h3>
  <div style="display:flex;gap:24px;margin-bottom:32px;">
    <div>
      <p style="font-size:12px;color:#888;margin-bottom:8px;">Actual</p>
      <div style="display:flex;gap:4px;">${(analysis.colorPalette.current || []).map(c => { const sc = escapeHtml(c); return `<div style="width:40px;height:40px;border-radius:8px;background:${sc};border:1px solid #333;" title="${sc}"></div>`; }).join("")}</div>
    </div>
    <div>
      <p style="font-size:12px;color:#888;margin-bottom:8px;">Mejorada</p>
      <div style="display:flex;gap:4px;">${(analysis.colorPalette.improved || []).map(c => { const sc = escapeHtml(c); return `<div style="width:40px;height:40px;border-radius:8px;background:${sc};border:1px solid #333;" title="${sc}"></div>`; }).join("")}</div>
    </div>
  </div>`;
  }

  if (analysis.typography) {
    html += `
  <h3 style="margin-bottom:12px;">🔤 Tipografía</h3>
  <div style="display:flex;gap:24px;margin-bottom:32px;">
    <div><p style="font-size:12px;color:#888;">Actual:</p><p style="color:#ccc;">${escapeHtml((analysis.typography.current || []).join(", "))}</p></div>
    <div><p style="font-size:12px;color:#888;">Recomendada:</p><p style="color:#ccc;">${escapeHtml((analysis.typography.improved || []).join(", "))}</p></div>
  </div>`;
  }

  if (analysis.issues?.length > 0) {
    const sevColors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };
    html += `
  <h3 style="margin-bottom:12px;">⚠️ Problemas Detectados (${analysis.issues.length})</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;font-size:13px;">
    <thead><tr style="border-bottom:1px solid #333;">
      <th style="text-align:left;padding:8px;color:#888;">Severidad</th>
      <th style="text-align:left;padding:8px;color:#888;">Selector</th>
      <th style="text-align:left;padding:8px;color:#888;">Propiedad</th>
      <th style="text-align:left;padding:8px;color:#888;">Actual</th>
      <th style="text-align:left;padding:8px;color:#888;">Mejorado</th>
    </tr></thead>
    <tbody>${analysis.issues.map(i => `<tr style="border-bottom:1px solid #222;">
      <td style="padding:8px;"><span style="background:${sevColors[i.severity] || "#888"}22;color:${sevColors[i.severity] || "#888"};padding:2px 8px;border-radius:4px;font-size:11px;">${escapeHtml(i.severity)}</span></td>
      <td style="padding:8px;font-family:monospace;font-size:12px;color:#e0e0e0;">${escapeHtml(i.selector)}</td>
      <td style="padding:8px;color:#ccc;">${escapeHtml(i.property)}</td>
      <td style="padding:8px;font-family:monospace;color:#f87171;">${escapeHtml(i.current)}</td>
      <td style="padding:8px;font-family:monospace;color:#4ade80;">${escapeHtml(i.improved)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
  }

  if (analysis.improvedCss) {
    html += `
  <h3 style="margin-bottom:12px;">💻 CSS Mejorado (Listo para Producción)</h3>
  <p style="font-size:12px;color:#888;margin-bottom:8px;">Copia este código y pégalo en tu archivo de estilos. Compatible con Shopify, WooCommerce y cualquier CMS.</p>
  <pre style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;overflow-x:auto;font-size:12px;line-height:1.6;color:#c9d1d9;max-height:600px;overflow-y:auto;"><code>${escapeHtml(analysis.improvedCss)}</code></pre>`;
  }

  if (analysis.improvedHtmlFragments?.length > 0) {
    html += `
  <h3 style="margin-top:32px;margin-bottom:12px;">🏗️ Fragmentos HTML Mejorados</h3>`;
    for (const frag of analysis.improvedHtmlFragments) {
      html += `
  <div style="margin-bottom:24px;">
    <h4 style="color:#eab308;margin-bottom:8px;">📌 ${escapeHtml(frag.section)}</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <p style="font-size:11px;color:#ef4444;margin-bottom:4px;">❌ Original</p>
        <pre style="background:#1a0000;border:1px solid #4a1111;border-radius:6px;padding:12px;font-size:11px;overflow-x:auto;color:#fca5a5;max-height:300px;overflow-y:auto;"><code>${escapeHtml(frag.original)}</code></pre>
      </div>
      <div>
        <p style="font-size:11px;color:#22c55e;margin-bottom:4px;">✅ Mejorado</p>
        <pre style="background:#001a00;border:1px solid #114a11;border-radius:6px;padding:12px;font-size:11px;overflow-x:auto;color:#86efac;max-height:300px;overflow-y:auto;"><code>${escapeHtml(frag.improved)}</code></pre>
      </div>
    </div>
  </div>`;
    }
  }

  if (pageSpeedMobile) {
    html += `
  <h3 style="margin-top:32px;margin-bottom:12px;">⚡ PageSpeed Insights</h3>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.performanceScore)};">${pageSpeedMobile.performanceScore}</div>
      <div style="font-size:11px;color:#888;">Performance</div>
    </div>
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.seoScore)};">${pageSpeedMobile.seoScore}</div>
      <div style="font-size:11px;color:#888;">SEO</div>
    </div>
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.accessibilityScore)};">${pageSpeedMobile.accessibilityScore}</div>
      <div style="font-size:11px;color:#888;">Accesibilidad</div>
    </div>
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.bestPracticesScore)};">${pageSpeedMobile.bestPracticesScore}</div>
      <div style="font-size:11px;color:#888;">Best Practices</div>
    </div>
  </div>`;
  }

  html += `
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #333;text-align:center;">
    <p style="font-size:11px;color:#666;">Generado por Shopy Crafter — Lab Web</p>
    <p style="font-size:11px;color:#555;">shopycrafter.com</p>
  </div>
</div>`;

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;
