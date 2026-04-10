import { Router, type Request, type Response } from "express";
import { db, projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { brandDnaTable, visualDnaTable, competitorsTable, competitorSnapshotsTable, projectFilesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation, buildShopyBrainContext, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import { fetchBrandProfile, generateBrandCss, generateBrandGuideHtml, generateAiBrandCss, buildBrandDnaContext } from "../lib/brand-css-generator.js";
import { generatePdfFromHtml } from "../lib/pdf-generator.js";
import { buildCoverPage, buildTableOfContents } from "../lib/report-cover.js";
import { shopifyRequest } from "../lib/shopify.js";
import { getReportShell, type ReportTemplate } from "./exports.js";
import { generateLeveledReport, type LeveledReportResult } from "../lib/report-levels.js";
import { REPORT_LEVELS } from "../lib/config.js";

const router = Router();

interface GeneratorType {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  requiresProject: boolean;
  acceptsUrl: boolean;
  outputFormats: string[];
}

const GENERATOR_TYPES: GeneratorType[] = [
  { id: "seo-audit", label: "Auditoría SEO Completa", category: "seo", description: "Análisis técnico SEO con 16 criterios, meta tags, alt texts, schemas, keywords y plan de acción priorizado", icon: "🔍", requiresProject: false, acceptsUrl: true, outputFormats: ["html", "pdf"] },
  { id: "seo-metas", label: "Meta Tags Optimizados", category: "seo", description: "Genera meta titles y descriptions SEO para todos los productos con keywords investigados", icon: "🏷️", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf", "csv"] },
  { id: "seo-schemas", label: "Schema JSON-LD", category: "seo", description: "Genera schemas estructurados Product, Organization, BreadcrumbList y FAQ para todos los productos", icon: "🧩", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "json"] },
  { id: "seo-alt-texts", label: "Alt Texts IA", category: "seo", description: "Genera alt texts SEO descriptivos para todas las imágenes de la tienda", icon: "🖼️", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "csv"] },
  { id: "seo-keywords", label: "Keywords Intelligence", category: "seo", description: "Investigación de keywords con Google Trends, volumen de búsqueda, dificultad y oportunidades", icon: "🎯", requiresProject: true, acceptsUrl: true, outputFormats: ["html", "pdf"] },
  { id: "seo-sitemap", label: "Sitemap XML", category: "seo", description: "Genera sitemap.xml optimizado con prioridades y frecuencias de actualización", icon: "🗺️", requiresProject: true, acceptsUrl: false, outputFormats: ["xml"] },
  { id: "blog-strategy", label: "Estrategia de Blog", category: "seo", description: "Plan editorial 12 semanas con títulos, keywords, estructura y calendario de publicación", icon: "📝", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "blog-post", label: "Artículo de Blog", category: "seo", description: "Artículo SEO completo de 1500+ palabras con imágenes sugeridas, CTAs y schema FAQ", icon: "📰", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },

  { id: "product-catalog", label: "Catálogo de Productos", category: "informes", description: "Catálogo profesional completo con fichas, precios, variantes y estado SEO de cada producto", icon: "📦", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf", "csv", "xlsx"] },
  { id: "complete-report", label: "Informe Completo 360°", category: "informes", description: "Mega-informe con TODAS las áreas: SEO, financiero, inventario, competencia, brand, IA insights", icon: "📊", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "financial-report", label: "Informe Financiero", category: "informes", description: "Análisis márgenes, COGS, revenue forecast, waterfall de precios y proyecciones 12 meses", icon: "💰", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "inventory-report", label: "Informe de Inventario", category: "informes", description: "Stock levels, alertas de restock, rotación, dead stock, previsiones de demanda", icon: "📋", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "consistency-report", label: "Auditoría de Consistencia", category: "informes", description: "Análisis de coherencia visual, de marca y de contenido en toda la tienda", icon: "🎨", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "revenue-analysis", label: "Análisis de Revenue", category: "informes", description: "Proyecciones de ingresos, análisis de tendencias, segmentación por producto y canal", icon: "📈", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "brain-export", label: "ShopyBrain Intelligence Export", category: "informes", description: "Exporta todo el conocimiento acumulado del cerebro IA: memorias, insights, dominios, patrones", icon: "🧠", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf", "json"] },

  { id: "brand-css", label: "CSS Personalizado de Marca", category: "marca", description: "Archivo CSS completo adaptado al ADN visual: colores, tipografías, botones, responsive", icon: "🎨", requiresProject: true, acceptsUrl: false, outputFormats: ["css"] },
  { id: "brand-css-ai", label: "CSS IA Avanzado", category: "marca", description: "CSS premium generado por IA con animaciones, efectos hover, transiciones y micro-interacciones", icon: "✨", requiresProject: true, acceptsUrl: false, outputFormats: ["css"] },
  { id: "brand-guide", label: "Guía de Identidad Visual", category: "marca", description: "Manual de marca completo: paleta, tipografías, componentes, estilo fotográfico, tono de voz", icon: "📖", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "brand-kit", label: "Brand Kit Completo", category: "marca", description: "ZIP con CSS, Guía HTML, Tokens JSON, Sección Liquid para Shopify e instrucciones", icon: "📁", requiresProject: true, acceptsUrl: false, outputFormats: ["zip"] },
  { id: "brand-kit-premium", label: "Brand Kit Premium + IA", category: "marca", description: "Todo del Brand Kit + CSS IA avanzado con animaciones + sección Liquid personalizada", icon: "💎", requiresProject: true, acceptsUrl: false, outputFormats: ["zip"] },
  { id: "photo-brief", label: "Brief Fotográfico", category: "marca", description: "Brief completo para fotógrafo: especificaciones técnicas, iluminación, composición, estilo", icon: "📸", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "social-kit", label: "Kit Redes Sociales", category: "marca", description: "Templates, paleta, tipografías y guía de estilo para contenido en redes sociales", icon: "📱", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },

  { id: "competitor-scan", label: "Análisis de Competidor", category: "competencia", description: "Escaneo completo de un competidor: precios, productos, SEO, fortalezas y debilidades", icon: "🕵️", requiresProject: false, acceptsUrl: true, outputFormats: ["html", "pdf"] },
  { id: "competitor-pricing", label: "Comparativa de Precios", category: "competencia", description: "Análisis comparativo de precios vs competidores con recomendaciones de pricing", icon: "💵", requiresProject: true, acceptsUrl: true, outputFormats: ["html", "pdf"] },
  { id: "market-research", label: "Investigación de Mercado", category: "competencia", description: "Análisis del nicho de mercado: tamaño, tendencias, oportunidades, amenazas", icon: "🌐", requiresProject: false, acceptsUrl: true, outputFormats: ["html", "pdf"] },

  { id: "pricing-optimal", label: "Precio Óptimo por Producto", category: "finanzas", description: "Cálculo del precio óptimo basado en COGS, competencia, elasticidad y psicología de precios", icon: "🎯", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "margin-waterfall", label: "Waterfall de Márgenes", category: "finanzas", description: "Desglose completo de cada €1 de revenue: COGS, plataforma, marketing, margen neto", icon: "💧", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "financial-forecast", label: "Forecast Financiero 12M", category: "finanzas", description: "Proyección financiera a 12 meses con escenarios conservador, base y optimista", icon: "📊", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },

  { id: "product-redesign", label: "Rediseño de Producto IA", category: "contenido", description: "Descripción profesional 800-1200 palabras, 8 secciones, FAQ, Trust Badges, SEO optimizado", icon: "✍️", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "email-templates", label: "Templates Email Marketing", category: "contenido", description: "5 templates HTML: bienvenida, carrito abandonado, post-compra, newsletter, oferta especial", icon: "📧", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "email-flow", label: "Flujo Email Automatizado", category: "contenido", description: "Secuencia completa Klaviyo: triggers, delays, contenido, segmentación y A/B tests", icon: "🔄", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "social-posts", label: "Pack 30 Posts Redes Sociales", category: "contenido", description: "30 posts profesionales para Instagram, TikTok y Facebook con hashtags y calendario", icon: "📲", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "landing-design", label: "Diseño Landing Page", category: "contenido", description: "Landing completa: wireframe + CSS + textos + secciones lista para implementar", icon: "🖥️", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf", "css"] },

  { id: "data-csv", label: "Exportar Productos CSV", category: "datos", description: "Todos los productos con variantes, precios, SEO scores, stock en formato CSV", icon: "📄", requiresProject: true, acceptsUrl: false, outputFormats: ["csv"] },
  { id: "data-xlsx", label: "Exportar Excel Completo", category: "datos", description: "Workbook multi-hoja con productos, SEO, precios, inventario y métricas", icon: "📊", requiresProject: true, acceptsUrl: false, outputFormats: ["xlsx"] },
  { id: "data-json", label: "Exportar JSON Completo", category: "datos", description: "Dump completo del proyecto en JSON: productos, SEO, precios, redesigns, todo", icon: "🔧", requiresProject: true, acceptsUrl: false, outputFormats: ["json"] },
  { id: "data-zip", label: "Exportar Todo en ZIP", category: "datos", description: "Archivo ZIP con CSVs, JSONs, reportes HTML y PDFs de todo el proyecto", icon: "📦", requiresProject: true, acceptsUrl: false, outputFormats: ["zip"] },

  { id: "external-audit", label: "Auditoría de Tienda Externa", category: "externo", description: "Análisis completo de cualquier URL/tienda: SEO, rendimiento, UX, oportunidades de mejora", icon: "🌍", requiresProject: false, acceptsUrl: true, outputFormats: ["html", "pdf"] },
  { id: "external-competitor", label: "Informe Competidor por URL", category: "externo", description: "Escaneo detallado de cualquier tienda: productos, precios, estrategia, threat level", icon: "🔎", requiresProject: false, acceptsUrl: true, outputFormats: ["html", "pdf"] },

  { id: "agency-proposal", label: "Propuesta Comercial", category: "agencia", description: "Propuesta profesional de servicios personalizada para el cliente con presupuesto detallado", icon: "📋", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
  { id: "agency-budget", label: "Presupuesto Profesional", category: "agencia", description: "Presupuesto detallado con desglose de servicios, IVA 21%, condiciones y plazos", icon: "💼", requiresProject: true, acceptsUrl: false, outputFormats: ["html", "pdf"] },
];

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  seo: { label: "SEO & Posicionamiento", icon: "🔍" },
  informes: { label: "Informes & Auditorías", icon: "📊" },
  marca: { label: "Marca & Diseño", icon: "🎨" },
  competencia: { label: "Competencia & Mercado", icon: "🕵️" },
  finanzas: { label: "Finanzas & Pricing", icon: "💰" },
  contenido: { label: "Contenido & Marketing", icon: "✍️" },
  datos: { label: "Exportación de Datos", icon: "📦" },
  externo: { label: "Análisis Externo (cualquier URL)", icon: "🌍" },
  agencia: { label: "Agencia & Comercial", icon: "💼" },
};

router.get("/generator/levels", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, levels: REPORT_LEVELS });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/generator/types", (_req: Request, res: Response) => {
  try {
    const grouped: Record<string, { label: string; icon: string; types: GeneratorType[] }> = {};
    for (const cat of Object.keys(CATEGORIES)) {
      grouped[cat] = { ...CATEGORIES[cat], types: GENERATOR_TYPES.filter(t => t.category === cat) };
    }
    res.json({ success: true, categories: grouped, total: GENERATOR_TYPES.length });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/generator/run", async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, projectId, url, format, template, level, params: extraParams } = req.body;
    const reportLevel = Math.max(1, Math.min(5, parseInt(String(level)) || 1));
    if (!type) return res.status(400).json({ error: "Falta el tipo de generación" });
  
    const genType = GENERATOR_TYPES.find(t => t.id === type);
    if (!genType) return res.status(400).json({ error: `Tipo de generación desconocido: ${type}` });
  
    if (genType.requiresProject && !projectId) {
      return res.status(400).json({ error: "Se requiere un proyecto asociado para este tipo de generación" });
    }
    if (!genType.requiresProject && genType.acceptsUrl && !url && !projectId) {
      return res.status(400).json({ error: "Se requiere una URL o projectId" });
    }
  
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  
    const outputFormat = format || genType.outputFormats[0];
    const tpl: ReportTemplate = (["classic", "elegance", "prestige"].includes(template) ? template : "prestige") as ReportTemplate;
  
    try {
      const pid = projectId ? parseInt(String(projectId)) : undefined;
  
      const LEVEL_CAPABLE_CATEGORIES = new Set(["seo", "informes", "competencia", "finanzas", "contenido", "agencia", "externo"]);
      const isLevelCapable = LEVEL_CAPABLE_CATEGORIES.has(genType.category) && genType.outputFormats.includes("html");
      if (reportLevel > 1 && pid && isLevelCapable) {
        const project = await db.select().from(projectsTable).where(eq(projectsTable.id, pid)).then(r => r[0]);
        const products = await db.select().from(productsTable).where(eq(productsTable.projectId, pid)).limit(30);
        const productList = products.map(p => `- ${p.title} (${p.price ?? "sin precio"}, ${p.productType ?? "sin tipo"})`).join("\n");
        const dataBlock = `Proyecto: ${project?.name ?? `#${pid}`}\nDominio: ${project?.shopDomain ?? "N/A"}\nNicho: ${project?.storeNiche ?? "N/A"}\nProductos (${products.length}):\n${productList}`;
  
        const levelResult = await generateLeveledReport({
          projectId: pid,
          level: reportLevel as 1 | 2 | 3 | 4 | 5,
          reportType: type,
          reportTitle: genType.label,
          dataBlock,
          niche: project?.storeNiche ?? undefined,
          template: tpl,
        });
  
        res.json({
          success: true,
          type,
          level: reportLevel,
          levelName: levelResult.levelName,
          files: levelResult.files.map(f => ({
            type: f.type,
            title: f.title,
            vaultId: f.vaultId,
          })),
          totalFiles: levelResult.files.length,
          message: `Informe ${levelResult.levelName} generado con ${levelResult.files.length} archivos`,
          vaultSaved: true,
          brainLearned: true,
        });
        return;
      }
  
      const result = await runGenerator(type, {
        projectId: pid,
        url,
        format: outputFormat,
        template: tpl,
        extraParams: extraParams || {},
      });
  
      if (result.redirect) {
        return res.json({
          success: true,
          type,
          format: outputFormat,
          redirect: result.redirect,
          message: result.message,
          vaultId: result.vaultId ?? null,
          brainLearned: result.brainLearned ?? false,
          vaultSaved: result.vaultSaved ?? false,
        });
      }
  
      if (result.vaultId && projectId) {
        res.json({
          success: true,
          type,
          format: outputFormat,
          content: result.content ?? "",
          contentLength: result.content?.length ?? 0,
          downloadUrl: result.downloadUrl,
          vaultId: result.vaultId,
          brainLearned: result.brainLearned ?? false,
          vaultSaved: true,
          message: result.message,
        });
      } else {
        res.json({
          success: true,
          type,
          format: outputFormat,
          content: result.content ?? "",
          contentLength: result.content?.length ?? 0,
          downloadUrl: result.downloadUrl,
          brainLearned: result.brainLearned ?? false,
          vaultSaved: result.vaultSaved ?? false,
          message: result.message,
        });
      }
    } catch (err: any) {
      logger.error({ err, type, projectId }, "Generator error");
      res.status(500).json({ error: err.message || "Error en la generación" });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

interface GenResult {
  content?: string;
  downloadUrl?: string;
  redirect?: string;
  vaultId?: number | null;
  brainLearned?: boolean;
  vaultSaved?: boolean;
  message: string;
}

interface GenParams {
  projectId?: number;
  url?: string;
  format: string;
  template: ReportTemplate;
  extraParams: Record<string, any>;
}

export async function runGeneratorDirect(type: string, params: GenParams): Promise<GenResult> {
  return runGenerator(type, params);
}

async function runGenerator(type: string, params: GenParams): Promise<GenResult> {
  const { projectId, url, format, template = "prestige" } = params;
  const baseUrl = `http://localhost:${process.env.PORT || 8080}/api`;

  switch (type) {
    case "seo-audit":
    case "product-catalog":
    case "complete-report":
    case "financial-report":
    case "inventory-report":
    case "consistency-report":
    case "revenue-analysis":
    case "brain-export": {
      const reportMap: Record<string, string> = {
        "seo-audit": "seo-audit",
        "product-catalog": "product-catalog",
        "complete-report": "complete-report",
        "financial-report": "financial",
        "inventory-report": "inventory",
        "consistency-report": "consistency",
        "revenue-analysis": "revenue",
        "brain-export": "shopybrain",
      };
      const reportType = reportMap[type] || type;
      const tplParam = `template=${template}`;
      const fmtParam = format === "pdf" ? `&format=pdf` : "";
      const downloadUrl = `/api/projects/${projectId}/exports/${reportType}?${tplParam}${fmtParam}`;
      if (projectId) {
        const genLabel = GENERATOR_TYPES.find(t => t.id === type)?.label || type;
        const date = new Date().toLocaleDateString("es-ES");
        learnFromOperation({
          operationType: `generator_${type}`,
          title: `Generado informe ${type} para proyecto ${projectId}`,
          content: `Informe ${type} generado con plantilla ${template}`,
        });
        try {
          const shell = getReportShell(template);
          const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]);
          const storeName = project?.name || `Proyecto ${projectId}`;
          const vaultHtml = shell(
            genLabel,
            `${storeName} — ${project?.shopDomain || ""}`,
            `<div class="ai-deliverable"><h2>${genLabel}</h2><p>Informe generado el ${date} con plantilla <strong>${template}</strong>.</p><p>Descarga disponible en: <a href="${downloadUrl}">${downloadUrl}</a></p></div>`,
            date,
            storeName
          );
          const vaultId = await saveToVault({
            projectId,
            fileType: type,
            category: "generator",
            title: `${genLabel} [${template}] — ${date}`,
            description: `Informe generado con plantilla ${template}`,
            content: vaultHtml,
            mimeType: "text/html",
            generatedBy: "universal-generator",
          });
          return {
            redirect: downloadUrl,
            message: `📊 Informe "${genLabel}" generado con plantilla ${template}. Guardado en Vault.`,
            downloadUrl,
            vaultId,
            brainLearned: true,
            vaultSaved: true,
          };
        } catch (e) {
          logger.warn({ err: e, type }, "Could not save redirect report to vault");
        }
      }
      return {
        redirect: downloadUrl,
        message: `📊 Informe "${GENERATOR_TYPES.find(t => t.id === type)?.label}" generado con plantilla ${template}. Descarga disponible.`,
        downloadUrl,
        brainLearned: true,
        vaultSaved: false,
      };
    }

    case "seo-metas":
    case "seo-schemas":
    case "seo-alt-texts":
    case "seo-keywords":
    case "seo-sitemap":
    case "blog-strategy":
    case "blog-post": {
      if (!projectId) return { message: "❌ Requiere proyecto asociado" };
      const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]);
      if (!project) return { message: "❌ Proyecto no encontrado" };
      const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId)).limit(30);
      const brandProfile = await fetchBrandProfile(projectId);
      const brandCtx = brandProfile ? buildBrandDnaContext(brandProfile) : "";
      const brainCtx = await buildShopyBrainContext(project.storeNiche || undefined, "general", `Genera ${type} profesional`);

      const prompts: Record<string, string> = {
        "seo-metas": `Genera meta titles (máx 60 chars) y meta descriptions (máx 155 chars) SEO optimizados para CADA uno de estos ${products.length} productos de la tienda "${project.shopDomain}". Incluye keywords investigados. Formato: tabla HTML profesional con columnas: Producto | Meta Title | Meta Description | Keywords Target.\n\nProductos:\n${products.map(p => `- ${p.title} (${p.productType || "General"}) — ${p.price}€`).join("\n")}`,
        "seo-schemas": `Genera Schema JSON-LD completo para la tienda "${project.shopDomain}". Incluye:\n1. Organization schema\n2. WebSite schema con SearchAction\n3. BreadcrumbList\n4. Product schema para cada producto\n5. FAQ schema\n\nProductos: ${products.map(p => `${p.title} (${p.price}€)`).join(", ")}`,
        "seo-alt-texts": `Genera alt texts SEO descriptivos (máx 125 chars cada uno) para todas las imágenes de estos productos. Formato tabla HTML: Producto | Imagen | Alt Text sugerido.\n\nProductos: ${products.map(p => `${p.title} (imágenes: ${(p as any).images?.length || p.imageCount || 0})`).join(", ")}`,
        "seo-keywords": `Realiza una investigación de keywords completa para la tienda "${project.shopDomain}" en el nicho "${project.name}". Incluye:\n- 20 keywords principales con volumen estimado y dificultad\n- 15 long-tail keywords\n- 10 keywords de competidores\n- Oportunidades de contenido\n- Mapa de keywords por página`,
        "seo-sitemap": `Genera un sitemap.xml completo para "${project.shopDomain}" con estas URLs:\n${products.map(p => `- /products/${p.handle || p.title.toLowerCase().replace(/\s+/g, "-")}`).join("\n")}\n\nIncluye: homepage, colecciones, páginas estáticas, blog. Prioridades y changefreq optimizados.`,
        "blog-strategy": `Crea una estrategia de blog completa para "${project.name}" (${project.shopDomain}):\n- Plan editorial de 12 semanas\n- 24 títulos de artículos con keywords target\n- Estructura de cada artículo (H2s)\n- Calendario de publicación\n- Estrategia de interlinking\n- Métricas objetivo`,
        "blog-post": `Escribe un artículo de blog SEO completo de 1500+ palabras para "${project.name}". Tema: "Guía completa de ${products[0]?.productType || "productos"}". Incluye: H1, H2s, H3s, párrafos informativos, CTAs, FAQ schema, imágenes sugeridas, meta description.`,
      };

      const prompt = prompts[type] || `Genera contenido ${type} profesional para ${project.shopDomain}`;
      const aiContent = await askClaudeWithBrain(
        projectId,
        [{ role: "user" as const, content: prompt }],
        `${SHOPIFY_EXPERT_SYSTEM}\n\n${brandCtx}\n\nCONTEXTO BRAIN:\n${brainCtx}\n\nGenera contenido PROFESIONAL, TERMINADO y LISTO PARA USAR. Todo el HTML debe estar dentro de <div class="ai-deliverable">. Usa los colores y tipografías de la marca del cliente en cualquier CSS.\n\nIMPORTANTE: Para CADA mejora, explica EXACTAMENTE CÓMO implementarla en la vida real — paso a paso, con capturas de pantalla textuales de dónde hacer clic en el panel de administración, qué texto copiar y pegar, y cómo verificar que funciona. El informe debe ser 100% autosuficiente.`,
        "general",
        project.storeNiche || undefined,
        16000,
      );

      const genLabel = GENERATOR_TYPES.find(t => t.id === type)?.label || type;
      const date = new Date().toLocaleDateString("es-ES");
      const shell = getReportShell(template);
      const html = shell(genLabel, `${project.name} — ${project.shopDomain || ""}`, aiContent.includes("ai-deliverable") ? aiContent : `<div class="ai-deliverable">${aiContent}</div>`, date, project.name || undefined);

      let vaultId: number | null = null;
      if (projectId) {
        vaultId = await saveToVault({
          projectId,
          fileType: type,
          category: "generator",
          title: `${genLabel} [${template}] — ${date}`,
          description: `Generado con plantilla ${template}`,
          content: html,
          mimeType: "text/html",
          generatedBy: "universal-generator",
        });
        learnFromOperation({
          operationType: `generator_${type}`,
          title: `Generado ${type} para "${project.name}" [${template}]`,
          content: aiContent.substring(0, 8000),
        });
      }

      return {
        content: html,
        vaultId,
        brainLearned: true,
        vaultSaved: !!vaultId,
        downloadUrl: `/api/projects/${projectId}/exports/${type}`,
        message: `✅ "${GENERATOR_TYPES.find(t => t.id === type)?.label}" generado (${html.length.toLocaleString()} caracteres). Guardado en Vault.`,
      };
    }

    case "brand-css": {
      if (!projectId) return { message: "❌ Requiere proyecto" };
      const profile = await fetchBrandProfile(projectId);
      if (!profile) return { message: "❌ Proyecto no encontrado" };
      const css = generateBrandCss(profile);
      const vaultId = await saveToVault({
        projectId,
        fileType: "brand-css",
        category: "marca",
        title: `CSS Personalizado — ${profile.shopName} — ${new Date().toLocaleDateString("es-ES")}`,
        content: css,
        mimeType: "text/css",
        generatedBy: "universal-generator",
      });
      learnFromOperation({ operationType: "generator_brand_css", title: `CSS de marca generado para ${profile.shopName}`, content: `${css.split("\n").length} líneas CSS generadas` });
      return {
        content: css,
        vaultId,
        brainLearned: true,
        vaultSaved: true,
        downloadUrl: `/api/exports/brand-css/${projectId}`,
        message: `🎨 CSS personalizado generado: ${css.split("\n").length} líneas adaptadas a tu marca.`,
      };
    }

    case "brand-css-ai": {
      if (!projectId) return { message: "❌ Requiere proyecto" };
      const profile2 = await fetchBrandProfile(projectId);
      if (!profile2) return { message: "❌ Proyecto no encontrado" };
      const aiCss = await generateAiBrandCss(projectId, profile2);
      const vaultId2 = await saveToVault({
        projectId,
        fileType: "brand-css-ai",
        category: "marca",
        title: `CSS IA Avanzado — ${profile2.shopName} — ${new Date().toLocaleDateString("es-ES")}`,
        content: aiCss,
        mimeType: "text/css",
        generatedBy: "universal-generator-ai",
      });
      learnFromOperation({ operationType: "generator_brand_css_ai", title: `CSS IA avanzado para ${profile2.shopName}`, content: `CSS premium con animaciones y efectos` });
      return {
        content: aiCss,
        vaultId: vaultId2,
        brainLearned: true,
        vaultSaved: true,
        downloadUrl: `/api/exports/brand-css/${projectId}?mode=ai`,
        message: `✨ CSS IA avanzado generado con animaciones y micro-interacciones.`,
      };
    }

    case "brand-guide": {
      if (!projectId) return { message: "❌ Requiere proyecto" };
      const profile3 = await fetchBrandProfile(projectId);
      if (!profile3) return { message: "❌ Proyecto no encontrado" };
      const guideHtml = generateBrandGuideHtml(profile3);
      const vaultId3 = await saveToVault({
        projectId,
        fileType: "brand-guide",
        category: "marca",
        title: `Guía de Marca — ${profile3.shopName} — ${new Date().toLocaleDateString("es-ES")}`,
        content: guideHtml,
        mimeType: "text/html",
        generatedBy: "universal-generator",
      });
      learnFromOperation({ operationType: "generator_brand_guide", title: `Guía de marca generada para ${profile3.shopName}`, content: `Manual de identidad visual completo` });
      return {
        content: guideHtml,
        vaultId: vaultId3,
        brainLearned: true,
        vaultSaved: true,
        downloadUrl: `/api/exports/brand-guide/${projectId}`,
        message: `📖 Guía de identidad visual generada.`,
      };
    }

    case "brand-kit":
    case "brand-kit-premium": {
      if (!projectId) return { message: "❌ Requiere proyecto" };
      const endpoint = type === "brand-kit-premium" ? "brand-kit-full" : "brand-kit";
      learnFromOperation({ operationType: `generator_${type}`, title: `Brand Kit generado`, content: `ZIP con CSS, guía, tokens y sección Liquid` });
      return {
        redirect: `/api/exports/${endpoint}/${projectId}`,
        brainLearned: true,
        vaultSaved: false,
        message: `📁 ${type === "brand-kit-premium" ? "Brand Kit Premium + IA" : "Brand Kit"} listo para descargar.`,
      };
    }

    case "photo-brief":
    case "social-kit":
    case "email-templates":
    case "email-flow":
    case "social-posts":
    case "landing-design":
    case "product-redesign":
    case "pricing-optimal":
    case "margin-waterfall":
    case "financial-forecast":
    case "agency-proposal":
    case "agency-budget": {
      if (!projectId) return { message: "❌ Requiere proyecto" };
      const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).then(r => r[0]);
      if (!project) return { message: "❌ Proyecto no encontrado" };
      const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId)).limit(20);
      const brandProfile2 = await fetchBrandProfile(projectId);
      const brandCtx = brandProfile2 ? buildBrandDnaContext(brandProfile2) : "";
      const brainCtx = await buildShopyBrainContext(project.storeNiche || undefined, "general", `Genera ${type}`);

      const contentPrompts: Record<string, string> = {
        "photo-brief": `Genera un BRIEF FOTOGRÁFICO PROFESIONAL para la marca "${project.name}". Incluye:\n- Estilo visual (minimalista/lifestyle/editorial)\n- Paleta de colores de fondo\n- Tipo de iluminación (natural/estudio/dramática)\n- Ángulos de cámara recomendados\n- Props y escenografía\n- Mood board descriptivo\n- Especificaciones técnicas (resolución, ratio, formato)\n- 8 tipos de foto por producto (Hero, Lifestyle, Detalle, Escala, Proceso, UGC, Packaging, Variante)\n\nProductos a fotografiar:\n${products.map(p => `- ${p.title}`).join("\n")}`,
        "social-kit": `Genera un KIT COMPLETO PARA REDES SOCIALES para "${project.name}":\n- Paleta de colores para posts (con hex codes)\n- Tipografías recomendadas\n- 6 templates de post (formato descripción detallada)\n- Grid estético para Instagram (9 posts planificados)\n- Hashtags por categoría\n- Tono de voz y guidelines\n- Calendario semanal tipo`,
        "email-templates": `Genera 5 TEMPLATES HTML COMPLETOS de email marketing para "${project.name}":\n1. Email de Bienvenida\n2. Carrito Abandonado\n3. Post-Compra + Upsell\n4. Newsletter Mensual\n5. Oferta Especial / Flash Sale\n\nCada template debe incluir: HTML completo con CSS inline, subject line, preheader, CTAs, y estructura responsive. Usa los colores de la marca.`,
        "email-flow": `Diseña un FLUJO DE EMAIL AUTOMATIZADO completo para "${project.name}" (Klaviyo-ready):\n- Flow de Bienvenida (4 emails, timing)\n- Flow Carrito Abandonado (3 emails)\n- Flow Post-Compra (3 emails)\n- Flow Win-Back (2 emails)\n- Flow Review Request\n\nPara cada email: trigger, delay, subject, contenido resumido, segmentación y A/B test sugerido.`,
        "social-posts": `Genera 30 POSTS PROFESIONALES para redes sociales de "${project.name}":\n- 10 posts Instagram (caption + hashtags)\n- 10 posts para Stories/Reels (script + hook)\n- 10 posts TikTok/Shorts (script + trending audio sugerido)\n\nIncluye calendario de 30 días y métricas objetivo.`,
        "landing-design": `Diseña una LANDING PAGE COMPLETA para "${project.name}":\n- Wireframe detallado (secciones con medidas)\n- Hero section con headline + subheadline + CTA\n- Sección de beneficios (3-4 puntos)\n- Social proof / testimonios\n- Showcase de productos\n- FAQ section\n- Final CTA\n- CSS completo para toda la landing\n- Textos finales listos para copiar`,
        "product-redesign": `Rediseña los ${Math.min(products.length, 5)} primeros productos de "${project.name}" con calidad 100/100. Para CADA producto genera:\n1. Título SEO optimizado (máx 70 chars)\n2. Descripción HTML 800-1200 palabras con 8 secciones\n3. Meta description (máx 155 chars)\n4. 5 keywords target\n5. FAQ (3-4 preguntas)\n6. Trust badges sugeridos\n\nProductos:\n${products.slice(0, 5).map(p => `- ${p.title}: ${p.price}€`).join("\n")}`,
        "pricing-optimal": `Calcula el PRECIO ÓPTIMO para cada producto de "${project.name}". Análisis:\n- Precio actual vs precio óptimo\n- Precio psicológico recomendado\n- Margen estimado\n- Elasticidad de demanda\n- Benchmark vs competencia\n\nProductos:\n${products.map(p => `- ${p.title}: ${p.price}€ (compare: ${p.compareAtPrice || "N/A"}€)`).join("\n")}`,
        "margin-waterfall": `Genera un WATERFALL DE MÁRGENES detallado para "${project.name}". Para cada €1 de revenue, desglosa:\n- Coste de producto (COGS)\n- Comisión Shopify (2.9% + 0.30€)\n- Comisión pasarela de pago\n- Coste de envío estimado\n- Marketing (CAC estimado)\n- Costes operativos\n- Margen neto\n\nProductos:\n${products.map(p => `- ${p.title}: ${p.price}€`).join("\n")}`,
        "financial-forecast": `Genera una PROYECCIÓN FINANCIERA A 12 MESES para "${project.name}" con 3 escenarios:\n\n🟢 OPTIMISTA: +30% crecimiento mensual\n🟡 BASE: +15% crecimiento mensual\n🔴 CONSERVADOR: +5% crecimiento mensual\n\nIncluye: Revenue mensual, Costes, EBITDA, Break-even point, ROI marketing, LTV/CAC ratio.\n\nDatos actuales: ${products.length} productos, precio medio ${products.length > 0 ? (products.reduce((s, p) => s + parseFloat(String(p.price || 0)), 0) / products.length).toFixed(2) : 0}€`,
        "agency-proposal": `Genera una PROPUESTA COMERCIAL PROFESIONAL de Shopy Crafter para el cliente "${project.name}" (${project.shopDomain}). Incluye:\n- Portada corporativa\n- Resumen ejecutivo\n- Diagnóstico actual (basado en los ${products.length} productos)\n- Servicios recomendados con precios\n- Plan de trabajo (timeline 3 meses)\n- ROI estimado\n- Equipo asignado\n- Condiciones y siguiente paso\n\nUsa diseño profesional con colores corporativos de Shopy Crafter.`,
        "agency-budget": `Genera un PRESUPUESTO PROFESIONAL DETALLADO de Shopy Crafter para "${project.name}". Formato:\n- Datos del cliente y de la agencia\n- Desglose de servicios con precio unitario\n- Subtotal\n- IVA 21%\n- TOTAL\n- Condiciones de pago\n- Validez del presupuesto\n- Firma\n\nServicios recomendados basados en ${products.length} productos y el análisis de la tienda.`,
      };

      const prompt = contentPrompts[type] || `Genera contenido profesional tipo ${type}`;
      const aiContent = await askClaudeWithBrain(
        projectId,
        [{ role: "user" as const, content: prompt }],
        `${SHOPIFY_EXPERT_SYSTEM}\n\n${brandCtx}\n\nCONTEXTO BRAIN:\n${brainCtx}\n\nGenera contenido PROFESIONAL, TERMINADO y LISTO PARA USAR. Envuelve todo en <div class="ai-deliverable">. Usa los colores y tipografías de la marca del cliente.\n\nIMPORTANTE: Para CADA mejora, explica EXACTAMENTE CÓMO implementarla en la vida real — paso a paso, dónde hacer clic, qué copiar y pegar, y cómo verificar que funciona. PRODUCE el contenido terminado, no recomendaciones.`,
        "general",
        project.storeNiche || undefined,
        16000,
      );

      const genLabel2 = GENERATOR_TYPES.find(t => t.id === type)?.label || type;
      const date2 = new Date().toLocaleDateString("es-ES");
      const shell2 = getReportShell(template);
      const html = shell2(genLabel2, `${project.name} — ${project.shopDomain || ""}`, aiContent.includes("ai-deliverable") ? aiContent : `<div class="ai-deliverable">${aiContent}</div>`, date2, project.name || undefined);

      const vaultId = await saveToVault({
        projectId,
        fileType: type,
        category: "generator",
        title: `${genLabel2} [${template}] — ${date2}`,
        description: `Generado con plantilla ${template}`,
        content: html,
        mimeType: "text/html",
        generatedBy: "universal-generator",
      });
      learnFromOperation({
        operationType: `generator_${type}`,
        title: `Generado ${type} para "${project.name}" [${template}]`,
        content: aiContent.substring(0, 2000),
      });

      return {
        content: html,
        vaultId,
        brainLearned: true,
        vaultSaved: true,
        message: `✅ "${GENERATOR_TYPES.find(t => t.id === type)?.label}" generado (${html.length.toLocaleString()} chars). Guardado en Vault.`,
      };
    }

    case "data-csv":
    case "data-xlsx":
    case "data-json":
    case "data-zip": {
      if (!projectId) return { message: "❌ Requiere proyecto" };
      const dataMap: Record<string, string> = {
        "data-csv": "csv/products",
        "data-xlsx": "xlsx/products",
        "data-json": "json/full",
        "data-zip": "zip/all",
      };
      const downloadUrl = `/api/projects/${projectId}/exports/${dataMap[type]}`;
      learnFromOperation({ operationType: `generator_${type}`, title: `Export ${type}`, content: `Datos exportados` });
      return {
        redirect: downloadUrl,
        brainLearned: true,
        message: `📥 Datos listos para descargar.`,
      };
    }

    case "external-audit":
    case "external-competitor":
    case "market-research":
    case "competitor-scan":
    case "competitor-pricing": {
      const targetUrl = url || "";
      if (!targetUrl && !projectId) return { message: "❌ Se necesita una URL o proyecto" };

      const externalPrompts: Record<string, string> = {
        "external-audit": `Realiza una AUDITORÍA COMPLETA de la tienda online ${targetUrl}. Analiza:\n- SEO técnico (meta tags, velocidad, mobile)\n- UX/UI (navegación, CTAs, checkout)\n- Catálogo (organización, calidad fotos, descripciones)\n- Confianza (reviews, trust badges, políticas)\n- Oportunidades de mejora con prioridad\n\nGenera un informe profesional con scoring 0-100 por área.`,
        "external-competitor": `Analiza la tienda competidora ${targetUrl} en detalle:\n- Productos principales y rango de precios\n- Estrategia de pricing (descuentos, bundles)\n- Puntos fuertes y débiles\n- SEO visible (titles, descriptions, keywords)\n- UX/UI assessment\n- Threat level (Alto/Medio/Bajo)\n- Oportunidades para diferenciarse`,
        "market-research": `Realiza una INVESTIGACIÓN DE MERCADO para el nicho representado por ${targetUrl}:\n- Tamaño del mercado estimado\n- Tendencias principales\n- Competidores principales\n- Perfil del buyer persona\n- Oportunidades no explotadas\n- Barreras de entrada\n- Recomendaciones estratégicas`,
        "competitor-scan": `Escanea al competidor ${targetUrl} y genera un informe de inteligencia competitiva:\n- Catálogo de productos detectados\n- Rango de precios (mín/máx/media)\n- Estrategia de marketing visible\n- Fortalezas a replicar\n- Debilidades a explotar`,
        "competitor-pricing": `Compara los precios de ${targetUrl} con nuestro catálogo. Genera:\n- Tabla comparativa producto por producto\n- % diferencia en cada producto\n- Posicionamiento de precio (premium/mid-market/budget)\n- Recomendaciones de ajuste`,
      };

      const prompt = externalPrompts[type] || `Analiza ${targetUrl}`;
      const aiContent = await askClaudeWithBrain(
        projectId || 0,
        [{ role: "user" as const, content: prompt }],
        `${SHOPIFY_EXPERT_SYSTEM}\n\nEres un analista experto en e-commerce. Analiza la URL/tienda proporcionada y genera un informe PROFESIONAL y DETALLADO. Todo en HTML dentro de <div class="ai-deliverable">.\n\nIMPORTANTE: Para CADA hallazgo, explica EXACTAMENTE CÓMO implementar la mejora en la vida real — con pasos concretos, herramientas específicas, código listo para copiar, y verificación paso a paso.`,
        "general",
        undefined,
        16000,
      );

      const genLabel3 = GENERATOR_TYPES.find(t => t.id === type)?.label || type;
      const date3 = new Date().toLocaleDateString("es-ES");
      const shell3 = getReportShell(template);
      const html = shell3(genLabel3, targetUrl || "Análisis Externo", aiContent.includes("ai-deliverable") ? aiContent : `<div class="ai-deliverable">${aiContent}</div>`, date3, targetUrl || undefined);

      let vaultId: number | null = null;
      if (projectId) {
        vaultId = await saveToVault({
          projectId,
          fileType: type,
          category: "generator-external",
          title: `${genLabel3} [${template}] — ${targetUrl || "Externo"} — ${date3}`,
          description: `Análisis externo con plantilla ${template}`,
          content: html,
          mimeType: "text/html",
          generatedBy: "universal-generator",
        });
        learnFromOperation({
          operationType: `generator_${type}`,
          title: `Análisis externo de ${targetUrl} [${template}]`,
          content: aiContent.substring(0, 8000),
        });
      }

      return {
        content: html,
        vaultId,
        brainLearned: !!projectId,
        vaultSaved: !!vaultId,
        message: `✅ Análisis de "${targetUrl}" completado. ${vaultId ? "Guardado en Vault." : ""}`,
      };
    }

    default:
      return { message: `❌ Tipo de generación no implementado: ${type}` };
  }
}

router.get("/generator/download/:vaultId", async (req: Request, res: Response): Promise<any> => {
  try {
    const vaultId = parseInt(String(req.params.vaultId));
    if (isNaN(vaultId)) return res.status(400).json({ error: "ID inválido" });
  
    const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, vaultId));
    if (!file) return res.status(404).json({ error: "Archivo no encontrado" });
  
    const content = (file as any).content || "";
    const title = (file as any).title || "documento";
    const mimeType = (file as any).mimeType || "text/html";
  
    if (mimeType === "text/css") {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.css"`);
      return res.send(content);
    }
  
    const format = (req.query.format as string || "html").toLowerCase();
    if (format === "pdf") {
      try {
        await generatePdfFromHtml(content, title.replace(/[^a-zA-Z0-9-_]/g, "_"), res);
      } catch (e: any) {
        res.status(500).json({ error: `Error PDF: ${e.message}` });
      }
      return;
    }
  
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.html"`);
    res.send(content);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/generator/history/:projectId", async (req: Request, res: Response): Promise<any> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) return res.status(400).json({ error: "ID inválido" });
  
    const files = await db.select({
      id: projectFilesTable.id,
      fileType: projectFilesTable.fileType,
      category: projectFilesTable.category,
      title: projectFilesTable.title,
      description: projectFilesTable.description,
      mimeType: projectFilesTable.mimeType,
      generatedBy: projectFilesTable.generatedBy,
      createdAt: projectFilesTable.createdAt,
    })
      .from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, projectId))
      .orderBy(desc(projectFilesTable.createdAt))
      .limit(100);
  
    const generatorFiles = files.filter(f => 
      (f.generatedBy || "").includes("generator") || 
      (f.category || "").includes("generator")
    );
  
    res.json({
      success: true,
      total: generatorFiles.length,
      files: generatorFiles,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
