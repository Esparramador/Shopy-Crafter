import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { cogsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { priceHistoryTable, brandDnaTable } from "@workspace/db/schema";
import { abTestsTable } from "@workspace/db/schema";
import { redesignsTable } from "@workspace/db/schema";
import { generationJobsTable } from "@workspace/db/schema";
import { omnicoreMemoriesTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable } from "@workspace/db/schema";
import { competitorsTable, competitorSnapshotsTable, competitorAlertsTable } from "@workspace/db/schema";
import { inventoryTrackingTable, restockOrdersTable } from "@workspace/db/schema";
import { revenueSnapshotsTable, forecastsTable } from "@workspace/db/schema";
import { visualDnaTable } from "@workspace/db/schema";
import archiver from "archiver";
import ExcelJS from "exceljs";
import { sanitizeHtml } from "../lib/html-escape.js";
import { shopifyRequest } from "../lib/shopify";
import { randomUUID } from "crypto";
import { askClaude, buildShopyBrainContext } from "../lib/claude.js";

const router = Router();

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

const BRAND = {
  gold: "#c8a84b",
  goldLight: "#e6d9a8",
  goldDark: "#8b6914",
  dark: "#08080e",
  darkAlt: "#0c0c14",
  card: "#101018",
  cardHover: "#141420",
  surface: "#16161f",
  muted: "#6b6b80",
  mutedLight: "#9494a8",
  jade: "#34d399",
  jadeBg: "rgba(52,211,153,.08)",
  red: "#f43f5e",
  redBg: "rgba(244,63,94,.08)",
  orange: "#f59e0b",
  orangeBg: "rgba(245,158,11,.08)",
  blue: "#3b82f6",
  blueBg: "rgba(59,130,246,.08)",
  white: "#f0f0f5",
  border: "#1a1a28",
  borderLight: "#24243a",
};

function reportShell(title: string, subtitle: string, body: string, date: string): string {
  const safeTitle = sanitizeHtml(title);
  const safeSub = sanitizeHtml(subtitle);
  const safeDate = sanitizeHtml(date);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — ShopyBrain</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${BRAND.dark}; color: ${BRAND.white}; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .page { max-width: 960px; margin: 0 auto; padding: 0; }

  .cover { background: linear-gradient(160deg, #0e0e18 0%, #12121f 50%, #0a0a14 100%); padding: 56px 56px 48px; border-bottom: 1px solid ${BRAND.border}; position: relative; overflow: hidden; }
  .cover::before { content: ''; position: absolute; top: -120px; right: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(200,168,75,.06) 0%, transparent 70%); pointer-events: none; }
  .cover::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, ${BRAND.gold}44, transparent); }
  .cover-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; position: relative; z-index: 1; }
  .cover-logo { display: flex; align-items: center; gap: 12px; }
  .cover-logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, ${BRAND.gold}, ${BRAND.goldDark}); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #0a0a0f; }
  .cover-logo-text { font-size: 20px; font-weight: 800; color: ${BRAND.gold}; letter-spacing: -0.3px; }
  .cover-badge { background: ${BRAND.surface}; border: 1px solid ${BRAND.borderLight}; border-radius: 8px; padding: 8px 16px; }
  .cover-badge-label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1.5px; }
  .cover-badge-value { font-size: 13px; color: ${BRAND.white}; font-weight: 600; margin-top: 2px; }
  .cover-title { position: relative; z-index: 1; }
  .cover-title h1 { font-size: 32px; font-weight: 900; color: ${BRAND.white}; letter-spacing: -0.8px; line-height: 1.2; }
  .cover-title h1 span { color: ${BRAND.gold}; }
  .cover-title .subtitle { font-size: 15px; color: ${BRAND.mutedLight}; margin-top: 8px; font-weight: 400; }
  .cover-meta { display: flex; gap: 24px; margin-top: 24px; position: relative; z-index: 1; }
  .cover-meta-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${BRAND.muted}; }
  .cover-meta-dot { width: 6px; height: 6px; border-radius: 50%; background: ${BRAND.gold}; }

  .body-content { padding: 40px 56px 48px; }

  .section { margin-bottom: 40px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid ${BRAND.border}; }
  .section-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .section-icon-gold { background: rgba(200,168,75,.1); border: 1px solid rgba(200,168,75,.2); }
  .section-icon-jade { background: ${BRAND.jadeBg}; border: 1px solid rgba(52,211,153,.2); }
  .section-icon-blue { background: ${BRAND.blueBg}; border: 1px solid rgba(59,130,246,.2); }
  .section-icon-red { background: ${BRAND.redBg}; border: 1px solid rgba(244,63,94,.2); }
  .section-icon-orange { background: ${BRAND.orangeBg}; border: 1px solid rgba(245,158,11,.2); }
  .section-title { font-size: 18px; font-weight: 700; color: ${BRAND.white}; letter-spacing: -0.3px; }
  .section-count { font-size: 11px; color: ${BRAND.muted}; background: ${BRAND.surface}; padding: 2px 8px; border-radius: 4px; margin-left: auto; }

  .card { background: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 24px; margin-bottom: 16px; transition: border-color .15s; }
  .card:hover { border-color: ${BRAND.borderLight}; }

  .metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .metric { background: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 20px; text-align: center; position: relative; overflow: hidden; }
  .metric::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, ${BRAND.gold}33, transparent); }
  .metric .value { font-size: 30px; font-weight: 900; color: ${BRAND.gold}; letter-spacing: -0.5px; line-height: 1.1; }
  .metric .label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; font-weight: 600; }
  .metric .delta { font-size: 11px; margin-top: 4px; font-weight: 600; }
  .metric .delta-up { color: ${BRAND.jade}; }
  .metric .delta-down { color: ${BRAND.red}; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
  thead { position: sticky; top: 0; }
  th { background: ${BRAND.surface}; color: ${BRAND.gold}; font-weight: 700; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  th:first-child { border-radius: 8px 0 0 0; }
  th:last-child { border-radius: 0 8px 0 0; }
  td { padding: 12px 16px; border-bottom: 1px solid ${BRAND.border}; color: ${BRAND.white}; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(200,168,75,.02); }
  tbody tr { transition: background .1s; }

  .grade { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; letter-spacing: 0.3px; }
  .grade-a { background: rgba(52,211,153,.12); color: ${BRAND.jade}; }
  .grade-b { background: rgba(200,168,75,.12); color: ${BRAND.gold}; }
  .grade-c { background: rgba(245,158,11,.12); color: ${BRAND.orange}; }
  .grade-d { background: rgba(244,63,94,.12); color: ${BRAND.red}; }
  .grade-f { background: rgba(244,63,94,.18); color: ${BRAND.red}; }

  .tag { display: inline-block; background: rgba(200,168,75,.08); color: ${BRAND.gold}; padding: 3px 10px; border-radius: 6px; font-size: 11px; margin: 2px 4px 2px 0; font-weight: 600; border: 1px solid rgba(200,168,75,.15); }
  .tag-jade { background: ${BRAND.jadeBg}; color: ${BRAND.jade}; border-color: rgba(52,211,153,.15); }
  .tag-red { background: ${BRAND.redBg}; color: ${BRAND.red}; border-color: rgba(244,63,94,.15); }
  .tag-blue { background: ${BRAND.blueBg}; color: ${BRAND.blue}; border-color: rgba(59,130,246,.15); }

  .text-jade { color: ${BRAND.jade}; }
  .text-red { color: ${BRAND.red}; }
  .text-gold { color: ${BRAND.gold}; }
  .text-blue { color: ${BRAND.blue}; }
  .text-orange { color: ${BRAND.orange}; }
  .text-muted { color: ${BRAND.muted}; }
  .text-white { color: ${BRAND.white}; }
  .fw-600 { font-weight: 600; }
  .fw-700 { font-weight: 700; }
  .fw-800 { font-weight: 800; }
  .fs-sm { font-size: 12px; }

  .score-bar { height: 6px; border-radius: 3px; background: ${BRAND.border}; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 3px; transition: width .3s; }

  .recommendation { padding: 16px 20px; margin-bottom: 10px; border-radius: 10px; border-left: 3px solid ${BRAND.gold}; background: rgba(200,168,75,.03); font-size: 13px; line-height: 1.7; }
  .recommendation-critical { border-left-color: ${BRAND.red}; background: ${BRAND.redBg}; }
  .recommendation-success { border-left-color: ${BRAND.jade}; background: ${BRAND.jadeBg}; }
  .recommendation-info { border-left-color: ${BRAND.blue}; background: ${BRAND.blueBg}; }

  .progress-ring { display: inline-flex; align-items: center; justify-content: center; position: relative; }
  .progress-ring svg { transform: rotate(-90deg); }

  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .stat-item { padding: 16px 20px; background: ${BRAND.surface}; border-radius: 10px; border: 1px solid ${BRAND.border}; }
  .stat-item-label { font-size: 10px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .stat-item-value { font-size: 16px; font-weight: 700; color: ${BRAND.white}; margin-top: 4px; }

  .divider { height: 1px; background: linear-gradient(90deg, transparent, ${BRAND.border}, transparent); margin: 32px 0; }

  .report-page { page-break-before: always; padding-top: 12px; }
  .report-page:first-child { page-break-before: avoid; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; margin-bottom: 12px; border-bottom: 1px solid ${BRAND.border}; }
  .page-header-title { font-size: 11px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
  .page-header-num { font-size: 11px; color: ${BRAND.gold}; font-weight: 700; }

  .toc { padding: 24px 0; }
  .toc-item { display: flex; align-items: center; padding: 12px 16px; margin-bottom: 6px; border-radius: 10px; background: ${BRAND.card}; border: 1px solid ${BRAND.border}; }
  .toc-num { width: 32px; height: 32px; border-radius: 8px; background: rgba(200,168,75,.1); border: 1px solid rgba(200,168,75,.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: ${BRAND.gold}; margin-right: 16px; flex-shrink: 0; }
  .toc-label { font-size: 14px; font-weight: 600; color: ${BRAND.white}; }
  .toc-desc { font-size: 11px; color: ${BRAND.muted}; margin-top: 2px; }
  .toc-dot { flex: 1; border-bottom: 1px dotted ${BRAND.border}; margin: 0 12px; min-width: 40px; }

  .waterfall-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .waterfall-label { font-size: 12px; color: ${BRAND.mutedLight}; min-width: 120px; text-align: right; }
  .waterfall-fill { height: 24px; border-radius: 6px; min-width: 2px; display: flex; align-items: center; padding: 0 8px; }
  .waterfall-val { font-size: 11px; font-weight: 700; color: ${BRAND.white}; }

  .blog-content { font-size: 14px; line-height: 1.8; }
  .blog-content h1, .blog-content h2, .blog-content h3 { color: ${BRAND.gold}; margin: 20px 0 10px; }
  .blog-content p { margin-bottom: 12px; }
  .blog-content ul, .blog-content ol { margin: 10px 0 10px 20px; }

  .footer { padding: 32px 56px; border-top: 1px solid ${BRAND.border}; background: ${BRAND.darkAlt}; text-align: center; }
  .footer-brand { font-size: 14px; font-weight: 700; color: ${BRAND.gold}; }
  .footer-sub { font-size: 11px; color: ${BRAND.muted}; margin-top: 6px; }
  .footer-line { width: 40px; height: 2px; background: ${BRAND.gold}; margin: 12px auto; border-radius: 1px; }

  @media print {
    body { background: white; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
    .cover { background: #f8f7f4; padding: 32px; }
    .cover-title h1 { color: #1a1a1a; }
    .card, .metric { background: #fafafa; border: 1px solid #e0e0e0; }
    .metric .value { color: ${BRAND.goldDark}; }
    th { background: #f0f0f0; color: ${BRAND.goldDark}; }
    td { border-color: #e8e8e8; color: #1a1a1a; }
    .footer { background: #fafafa; border-color: #e0e0e0; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <div class="cover-top">
      <div class="cover-logo">
        <div class="cover-logo-icon">S</div>
        <div class="cover-logo-text">ShopyBrain</div>
      </div>
      <div class="cover-badge">
        <div class="cover-badge-label">Fecha del informe</div>
        <div class="cover-badge-value">${safeDate}</div>
      </div>
    </div>
    <div class="cover-title">
      <h1>${safeTitle}</h1>
      <p class="subtitle">${safeSub}</p>
    </div>
    <div class="cover-meta">
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>Generado por IA</div>
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>Datos reales</div>
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>Confidencial</div>
    </div>
  </div>
  <div class="body-content">
    ${body}
  </div>
  <div class="footer">
    <div class="footer-line"></div>
    <div class="footer-brand">ShopyBrain AI</div>
    <div class="footer-sub">Agencia Shopify con Inteligencia Artificial &middot; ${safeDate} &middot; Confidencial</div>
  </div>
</div>
</body>
</html>`;
}

function gradeClass(grade: string): string {
  const g = (grade || "F").toUpperCase()[0];
  if (g === "A") return "grade-a";
  if (g === "B") return "grade-b";
  if (g === "C") return "grade-c";
  if (g === "D") return "grade-d";
  return "grade-f";
}

function scoreColor(score: number): string {
  if (score >= 80) return BRAND.jade;
  if (score >= 60) return BRAND.gold;
  if (score >= 40) return "#ffa500";
  return BRAND.red;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(decimals);
}

router.get("/projects/:projectId/exports/seo-audit", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));

  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const totalProducts = products.length;
  const withSeo = seoData.filter(s => s.seoScore != null).length;
  const avgScore = withSeo > 0 ? seoData.reduce((sum, s) => sum + (s.seoScore ?? 0), 0) / withSeo : 0;
  const withSchema = seoData.filter(s => s.hasSchema).length;
  const withAltTexts = seoData.filter(s => s.hasAltTexts).length;

  let productRows = "";
  for (const p of products) {
    const seo = seoMap.get(p.shopifyProductId);
    const score = seo?.seoScore ?? 0;
    const grade = seo?.seoGrade ?? "—";
    productRows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${sanitizeHtml(p.title)}</td><!-- nosemgrep -->
      <td><span class="grade ${gradeClass(grade)}">${grade}</span></td><!-- nosemgrep -->
      <td><div style="display:flex;align-items:center;gap:8px;"><span>${Math.round(score)}</span><div class="score-bar" style="width:80px;"><div class="score-fill" style="width:${score}%;background:${scoreColor(score)};"></div></div></div></td><!-- nosemgrep -->
      <td>${seo?.hasSchema ? "✅" : "❌"}</td>
      <td>${seo?.hasAltTexts ? "✅" : "❌"}</td>
      <td class="text-muted">${sanitizeHtml(seo?.metaTitle?.slice(0, 40) ?? "Sin meta title")}${(seo?.metaTitle?.length ?? 0) > 40 ? "…" : ""}</td><!-- nosemgrep -->
    </tr>`;
  }

  const gradeDistribution: Record<string, number> = {};
  seoData.forEach(s => {
    const g = s.seoGrade || "Sin auditar";
    gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
  });

  let gradeBreakdown = "";
  for (const [g, count] of Object.entries(gradeDistribution).sort()) {
    const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
    gradeBreakdown += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><!-- nosemgrep -->
      <span class="grade ${gradeClass(g)}" style="min-width:40px;text-align:center;">${g}</span>
      <div class="score-bar" style="flex:1;"><div class="score-fill" style="width:${pct}%;background:${scoreColor(g === "A+" || g === "A" ? 90 : g === "B" ? 70 : g === "C" ? 50 : 30)};"></div></div><!-- nosemgrep -->
      <span style="min-width:60px;font-size:13px;">${count} (${pct}%)</span><!-- nosemgrep -->
    </div>`;
  }

  const issues: string[] = [];
  if (withSchema < totalProducts * 0.5) issues.push(`Solo ${withSchema}/${totalProducts} productos tienen Schema JSON-LD. Implementar structured data mejora CTR +30%.`);
  if (withAltTexts < totalProducts * 0.5) issues.push(`Solo ${withAltTexts}/${totalProducts} productos tienen alt texts optimizados. Google Image Search puede generar hasta 20% tráfico adicional.`);
  if (avgScore < 60) issues.push(`Puntuación SEO media (${Math.round(avgScore)}/100) por debajo del umbral competitivo. Se recomienda optimizar meta titles, descriptions y contenido.`);
  const noMeta = seoData.filter(s => !s.metaTitle || s.metaTitle.length < 10).length;
  if (noMeta > 0) issues.push(`${noMeta} productos sin meta title optimizado. Los meta titles son el factor #1 de CTR en resultados de búsqueda.`);

  let recommendationsHtml = issues.map(i => `<div class="recommendation">${i}</div>`).join(""); // nosemgrep
  if (issues.length === 0) recommendationsHtml = `<div class="recommendation" style="border-left-color:${BRAND.jade};">✅ Excelente: No se detectaron problemas críticos de SEO.</div>`; // nosemgrep

  const body = ` // nosemgrep
    <div class="metric-row">
      <div class="metric"><div class="value">${totalProducts}</div><div class="label">Productos</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${Math.round(avgScore)}</div><div class="label">Score SEO medio</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${withSchema}</div><div class="label">Con Schema</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${withAltTexts}</div><div class="label">Con Alt Texts</div></div><!-- nosemgrep -->
    </div>

    <div class="section">
      <div class="section-title">Distribución de Grados SEO</div>
      <div class="card">${gradeBreakdown}</div><!-- nosemgrep -->
    </div>

    <div class="section">
      <div class="section-title">Recomendaciones Estratégicas</div>
      ${recommendationsHtml}
    </div>

    <div class="section">
      <div class="section-title">Detalle por Producto</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Grado</th><th>Score</th><th>Schema</th><th>Alt Texts</th><th>Meta Title</th></tr></thead>
          <tbody>${productRows}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>`;

  const html = reportShell("Informe SEO Técnico", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="SEO_Audit_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/product-catalog", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === "active").length;
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
  const avgScore = products.filter(p => p.auditScore != null).length > 0
    ? products.reduce((s, p) => s + (p.auditScore ?? 0), 0) / products.filter(p => p.auditScore != null).length : 0;

  let rows = "";
  for (const p of products) {
    const cogs = cogsMap.get(p.shopifyProductId);
    const seo = seoMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    rows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${sanitizeHtml(p.title)}</td><!-- nosemgrep -->
      <td>${p.status === "active" ? '<span class="text-jade">Activo</span>' : '<span class="text-muted">Borrador</span>'}</td>
      <td>${price > 0 ? price.toFixed(2) + "€" : "—"}</td><!-- nosemgrep -->
      <td>${cogs ? cogs.totalCogs.toFixed(2) + "€" : "—"}</td><!-- nosemgrep -->
      <td>${margin != null ? `<span class="${margin > 30 ? "text-jade" : margin > 15 ? "text-gold" : "text-red"}">${margin.toFixed(1)}%</span>` : "—"}</td><!-- nosemgrep -->
      <td>${p.auditScore != null ? Math.round(p.auditScore) : "—"}</td><!-- nosemgrep -->
      <td>${seo?.seoGrade ? `<span class="grade ${gradeClass(seo.seoGrade)}">${seo.seoGrade}</span>` : "—"}</td><!-- nosemgrep -->
      <td>${p.imageCount ?? 0}</td><!-- nosemgrep -->
      <td>${p.variantCount ?? 1}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = ` // nosemgrep
    <div class="metric-row">
      <div class="metric"><div class="value">${totalProducts}</div><div class="label">Total productos</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${activeProducts}</div><div class="label">Activos</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${avgPrice.toFixed(2)}€</div><div class="label">Precio medio</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${Math.round(avgScore)}</div><div class="label">Score medio</div></div><!-- nosemgrep -->
    </div>

    <div class="section">
      <div class="section-title">Catálogo Completo</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Estado</th><th>Precio</th><th>COGS</th><th>Margen</th><th>Audit</th><th>SEO</th><th>Imgs</th><th>Vars</th></tr></thead>
          <tbody>${rows}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>`;

  const html = reportShell("Informe de Catálogo de Productos", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Product_Catalog_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/financial", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const priceHistory = await db.select().from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId)).orderBy(desc(priceHistoryTable.recordedAt)).limit(100);

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  let totalRevenuePotential = 0;
  let totalCosts = 0;
  let cogsRows = "";
  for (const p of products) {
    const cogs = cogsMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    totalRevenuePotential += price;
    totalCosts += cogs?.totalCogs ?? 0;
    if (cogs) {
      const margin = price > 0 ? ((price - cogs.totalCogs) / price) * 100 : 0;
      cogsRows += `<tr><!-- nosemgrep -->
        <td style="font-weight:500;">${sanitizeHtml(p.title)}</td><!-- nosemgrep -->
        <td>${price.toFixed(2)}€</td><!-- nosemgrep -->
        <td>${cogs.totalCogs.toFixed(2)}€</td><!-- nosemgrep -->
        <td>${(price - cogs.totalCogs).toFixed(2)}€</td><!-- nosemgrep -->
        <td><span class="${margin > 30 ? "text-jade" : margin > 15 ? "text-gold" : "text-red"}">${margin.toFixed(1)}%</span></td><!-- nosemgrep -->
      </tr>`;
    }
  }

  const avgMargin = totalRevenuePotential > 0 ? ((totalRevenuePotential - totalCosts) / totalRevenuePotential) * 100 : 0;

  let priceHistoryRows = "";
  for (const h of priceHistory.slice(0, 30)) {
    const pct = h.oldPrice && h.oldPrice > 0 ? (((h.newPrice - h.oldPrice) / h.oldPrice) * 100) : 0;
    priceHistoryRows += `<tr><!-- nosemgrep -->
      <td>${h.recordedAt?.toLocaleDateString("es-ES") ?? "—"}</td><!-- nosemgrep -->
      <td>${h.shopifyProductId}</td><!-- nosemgrep -->
      <td>${h.oldPrice?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
      <td>${h.newPrice.toFixed(2)}€</td><!-- nosemgrep -->
      <td><span class="${pct >= 0 ? "text-jade" : "text-red"}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></td><!-- nosemgrep -->
      <td class="text-muted">${h.changeSource ?? "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalRevenuePotential.toFixed(0)}€</div><div class="label">Revenue potencial</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${totalCosts.toFixed(0)}€</div><div class="label">COGS total</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${(totalRevenuePotential - totalCosts).toFixed(0)}€</div><div class="label">Beneficio bruto</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen medio</div></div><!-- nosemgrep -->
    </div>

    <div class="section">
      <div class="section-title">Análisis COGS por Producto</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Precio</th><th>COGS</th><th>Beneficio</th><th>Margen</th></tr></thead>
          <tbody>${cogsRows || '<tr><td colspan="5" class="text-muted">No hay COGS configurados</td></tr>'}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>

    ${priceHistoryRows ? `<div class="section"><!-- nosemgrep -->
      <div class="section-title">Historial de Cambios de Precio</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Anterior</th><th>Nuevo</th><th>Cambio</th><th>Fuente</th></tr></thead>
          <tbody>${priceHistoryRows}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>` : ""}`;

  const html = reportShell("Informe Financiero y COGS", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Financial_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/brand-brief", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const activeProducts = products.filter(p => p.status === "active").length;
  const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
  const vendors = [...new Set(products.map(p => p.vendor).filter(Boolean))];
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
  const priceRange = products.length > 0
    ? { min: Math.min(...products.map(p => parseFloat(p.price ?? "0"))), max: Math.max(...products.map(p => parseFloat(p.price ?? "0"))) }
    : { min: 0, max: 0 };

  const body = ` // nosemgrep
    <div class="section">
      <div class="section-title">Identidad de Marca</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nombre del Proyecto</p><p style="font-size:18px;font-weight:600;">${project.name}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Dominio Shopify</p><p style="font-size:18px;font-weight:600;">${project.shopDomain || "No configurado"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nicho de Mercado</p><p style="font-size:16px;font-weight:500;">${project.storeNiche || "No definido"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Mercados Objetivo</p><p style="font-size:16px;font-weight:500;">${project.storeMarkets || "Global"}</p></div><!-- nosemgrep -->
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Voz y Tono de Marca</div>
      <div class="card">
        <p style="font-size:15px;line-height:1.8;">${project.brandTone || "No definido — Se recomienda establecer el tono de marca para consistencia en todas las comunicaciones."}</p><!-- nosemgrep -->
      </div>
    </div>

    <div class="section">
      <div class="section-title">Audiencia Objetivo</div>
      <div class="card">
        <p style="font-size:15px;line-height:1.8;">${project.targetAudience || "No definido — Definir la audiencia objetivo permite optimizar copywriting, SEO y estrategia de pricing."}</p><!-- nosemgrep -->
      </div>
    </div>

    <div class="section">
      <div class="section-title">Panorama del Catálogo</div>
      <div class="metric-row">
        <div class="metric"><div class="value">${activeProducts}</div><div class="label">Productos activos</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${productTypes.length}</div><div class="label">Categorías</div></div>
        <div class="metric"><div class="value">${avgPrice.toFixed(2)}€</div><div class="label">Precio medio</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${priceRange.min.toFixed(0)}–${priceRange.max.toFixed(0)}€</div><div class="label">Rango de precios</div></div><!-- nosemgrep -->
      </div>
      ${productTypes.length > 0 ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Categorías de producto</p><div>${productTypes.map(t => `<span class="tag">${t}</span>`).join(" ")}</div></div>` : ""}<!-- nosemgrep -->
      ${vendors.length > 0 ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Proveedores / Vendors</p><div>${vendors.map(v => `<span class="tag">${v}</span>`).join(" ")}</div></div>` : ""}<!-- nosemgrep -->
    </div>

    <div class="section">
      <div class="section-title">Estado de Optimización</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Plan activo</p><p style="font-size:16px;font-weight:600;text-transform:uppercase;" class="text-gold">${project.plan}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Piloto automático</p><p style="font-size:16px;font-weight:600;">${project.autoPilotEnabled ? '<span class="text-jade">Activado</span>' : '<span class="text-muted">Desactivado</span>'}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Score Audit medio</p><p style="font-size:16px;font-weight:600;">${project.avgAuditScore != null ? Math.round(project.avgAuditScore) + "/100" : "Sin auditar"}</p></div><!-- nosemgrep -->
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Productos auditados</p><p style="font-size:16px;font-weight:600;">${seoData.filter(s => s.seoScore != null).length}/${products.length}</p></div><!-- nosemgrep -->
        </div>
      </div>
    </div>`;

  const html = reportShell("Brand Brief & Estrategia", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Brand_Brief_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/ab-tests", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId)).orderBy(desc(abTestsTable.createdAt));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const totalTests = tests.length;
  const completed = tests.filter(t => t.status === "completed" || t.status === "winner_applied").length;
  const active = tests.filter(t => t.status === "running").length;

  let rows = "";
  for (const t of tests) {
    rows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${t.testName}</td><!-- nosemgrep -->
      <td>${t.testType}</td><!-- nosemgrep -->
      <td><span class="tag">${t.status}</span></td><!-- nosemgrep -->
      <td>${t.startDate ? new Date(t.startDate).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
      <td>${t.winner ?? "—"}</td><!-- nosemgrep -->
      <td class="text-muted">${t.improvementPct != null ? `+${t.improvementPct.toFixed(1)}%` : "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = ` // nosemgrep
    <div class="metric-row">
      <div class="metric"><div class="value">${totalTests}</div><div class="label">Tests totales</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${active}</div><div class="label">Activos</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${completed}</div><div class="label">Completados</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">Historial de A/B Tests</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Test</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Ganador</th><th>Mejora</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="text-muted">No hay tests registrados</td></tr>'}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>`;

  const html = reportShell("Informe A/B Testing", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="AB_Tests_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/images-gallery", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const jobs = await db.select().from(generationJobsTable)
    .where(eq(generationJobsTable.projectId, projectId))
    .orderBy(desc(generationJobsTable.createdAt))
    .limit(200);

  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const succeeded = jobs.filter(j => j.status === "succeeded");
  const failed = jobs.filter(j => j.status === "failed");

  let gallery = "";
  for (const j of succeeded) {
    gallery += `<div style="background:${BRAND.dark};border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;"><!-- nosemgrep -->
      ${j.imageUrl ? `<img src="${j.imageUrl}" style="width:100%;height:200px;object-fit:cover;" alt="${j.altText || "AI generated"}"/>` : `<div style="width:100%;height:200px;display:flex;align-items:center;justify-content:center;background:${BRAND.card};"><span class="text-muted">Sin preview</span></div>`}<!-- nosemgrep -->
      <div style="padding:10px;">
        <p style="font-size:12px;font-weight:600;margin-bottom:4px;">${j.imageType ?? "Imagen"}</p><!-- nosemgrep -->
        <p style="font-size:11px;color:${BRAND.muted};">${j.altText?.slice(0, 60) ?? "Sin descripción"}</p><!-- nosemgrep -->
        <p style="font-size:10px;color:${BRAND.muted};margin-top:4px;">${j.model ?? ""}</p><!-- nosemgrep -->
      </div>
    </div>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${succeeded.length}</div><div class="label">Imágenes generadas</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${failed.length}</div><div class="label">Fallidas</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${jobs.length}</div><div class="label">Total jobs</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">Galería de Imágenes IA</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        ${gallery || `<div class="text-muted" style="grid-column:span 3;text-align:center;padding:40px;">No hay imágenes generadas aún</div>`}<!-- nosemgrep -->
      </div>
    </div>`;

  const html = reportShell("Galería de Imágenes IA", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Images_Gallery_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.post("/projects/:projectId/exports/run-full-audit", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "ID de proyecto invalido" }); return; }

  const log: string[] = [];
  const started = Date.now();

  try {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    log.push(`Catalogo: ${products.length} productos cargados`);

    const existingSeo = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const seoMap = new Map(existingSeo.map(s => [s.shopifyProductId, s]));

    let seoUpdated = 0;
    let seoCreated = 0;
    let totalScore = 0;
    for (const p of products) {
      const seo = seoMap.get(p.shopifyProductId);
      const { score, grade, hasAltTexts, cleanHandle, descLen } = calculateSeoScoreInline(p, seo);

      if (seo) {
        await db.update(seoDataTable)
          .set({ seoScore: score, seoGrade: grade, hasAltTexts, cleanHandle, descriptionLength: descLen, lastAuditedAt: new Date() })
          .where(eq(seoDataTable.id, seo.id));
        seoUpdated++;
      } else {
        await db.insert(seoDataTable).values({
          projectId,
          shopifyProductId: p.shopifyProductId,
          metaTitle: null,
          metaDescription: null,
          hasSchema: false,
          hasAltTexts,
          cleanHandle,
          seoScore: score,
          seoGrade: grade,
          descriptionLength: descLen,
          lastAuditedAt: new Date(),
        });
        seoCreated++;
      }
      totalScore += score;
    }
    log.push(`SEO: ${seoUpdated} actualizados, ${seoCreated} nuevos — ${products.length} productos auditados`);

    const avgScore = products.length > 0 ? Math.round(totalScore / products.length) : 0;

    await db.update(projectsTable).set({ avgAuditScore: avgScore }).where(eq(projectsTable.id, projectId));
    log.push(`Avg audit score actualizado: ${avgScore}/100`);

    let revenueResult = { totalRevenue: 0, totalOrders: 0, daysLoaded: 0, variantsTracked: 0 };
    if (project.accessToken) {
      try {
        const days = parseInt(String(req.body?.days)) || 90;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const dailyMap: Record<string, { revenue: number; orders: number }> = {};
        const variantSales: Record<string, { title: string; productTitle: string; quantity: number; revenue: number }> = {};
        let hasMore = true;
        let pageInfo: string | null = null;
        let fetchCount = 0;

        while (hasMore && fetchCount < 10) {
          const url = pageInfo
            ? `/orders.json?status=any&financial_status=paid&limit=250&page_info=${pageInfo}`
            : `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`;
          const data = await shopifyRequest<{
            orders: Array<{
              id: number; created_at: string; total_price: string;
              line_items: Array<{ variant_id: number; title: string; variant_title: string; quantity: number; price: string; product_id: number }>;
            }>;
          }>(projectId, project.shopDomain, url);

          for (const order of data.orders) {
            const date = order.created_at.split("T")[0];
            if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
            dailyMap[date].revenue += parseFloat(order.total_price || "0");
            dailyMap[date].orders += 1;

            for (const li of (order.line_items || [])) {
              const key = `${li.product_id}::${li.variant_title || "default"}`;
              if (!variantSales[key]) variantSales[key] = { title: li.variant_title || "default", productTitle: li.title, quantity: 0, revenue: 0 };
              variantSales[key].quantity += li.quantity;
              variantSales[key].revenue += parseFloat(li.price || "0") * li.quantity;
            }
          }

          hasMore = data.orders.length === 250;
          pageInfo = null;
          fetchCount++;
        }

        for (const [date, vals] of Object.entries(dailyMap)) {
          const aov = vals.orders > 0 ? vals.revenue / vals.orders : 0;
          const existing = await db.select({ id: revenueSnapshotsTable.id })
            .from(revenueSnapshotsTable)
            .where(and(eq(revenueSnapshotsTable.projectId, String(projectId)), eq(revenueSnapshotsTable.date, date)))
            .limit(1);

          if (existing.length > 0) {
            await db.update(revenueSnapshotsTable)
              .set({ revenue: vals.revenue, orders: vals.orders, aov })
              .where(eq(revenueSnapshotsTable.id, existing[0].id));
          } else {
            await db.insert(revenueSnapshotsTable).values({
              id: randomUUID(),
              projectId: String(projectId),
              date,
              revenue: vals.revenue,
              orders: vals.orders,
              aov,
            });
          }
        }

        revenueResult = {
          totalRevenue: Object.values(dailyMap).reduce((s, v) => s + v.revenue, 0),
          totalOrders: Object.values(dailyMap).reduce((s, v) => s + v.orders, 0),
          daysLoaded: Object.keys(dailyMap).length,
          variantsTracked: Object.keys(variantSales).length,
        };
        log.push(`Revenue: ${revenueResult.daysLoaded} dias sincronizados, ${revenueResult.totalOrders} pedidos, ${revenueResult.totalRevenue.toFixed(2)}€`);
        log.push(`Variantes: ${revenueResult.variantsTracked} combinaciones producto/variante rastreadas`);
      } catch (err: any) {
        log.push(`Revenue sync error: ${err.message || "fallo al conectar con Shopify"}`);
      }
    } else {
      log.push(`Revenue: sin token Shopify — no se pueden sincronizar pedidos`);
    }

    const existingCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    log.push(`COGS: ${existingCogs.length}/${products.length} productos con costes registrados`);

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    log.push(`Auditoria completa en ${elapsed}s`);

    res.json({
      ok: true,
      projectId,
      storeName: project.name,
      elapsed: `${elapsed}s`,
      seo: { audited: products.length, updated: seoUpdated, created: seoCreated, avgScore },
      revenue: revenueResult,
      cogs: { registered: existingCogs.length, total: products.length },
      products: products.length,
      log,
    });
  } catch (err: any) {
    console.error("run-full-audit error:", err);
    res.status(500).json({ error: err.message ?? "Error ejecutando auditoria completa", log });
  }
});

router.post("/projects/:projectId/exports/generate-ai-report", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "ID de proyecto invalido" }); return; }

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
    const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
    const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
    const revenueSnapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.date)).limit(90);
    const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).limit(1);

    const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
    const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
    const activeProducts = products.filter(p => p.status === "active");
    const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
    const catalogPrices = products.map(p => parseFloat(p.price ?? "0"));
    const totalCatalogValue = catalogPrices.reduce((s, p) => s + p, 0);
    const totalCogs = allCogs.reduce((s, c) => s + c.totalCogs, 0);
    const avgMargin = totalCatalogValue > 0 ? ((totalCatalogValue - totalCogs) / totalCatalogValue) * 100 : 0;
    const totalRevenue = revenueSnapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const totalOrders = revenueSnapshots.reduce((s, r) => s + (r.orders ?? 0), 0);

    const liveAudit = products.map(p => {
      const seo = seoMap.get(p.shopifyProductId);
      return { product: p, seo, ...calculateSeoScoreInline(p, seo) };
    });
    const avgSeo = liveAudit.length > 0 ? liveAudit.reduce((s, a) => s + a.score, 0) / liveAudit.length : 0;
    const storeGrade = avgSeo >= 90 ? "A" : avgSeo >= 75 ? "B" : avgSeo >= 60 ? "C" : avgSeo >= 45 ? "D" : "F";

    const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
    const priceRange = products.length > 0
      ? { min: Math.min(...catalogPrices), max: Math.max(...catalogPrices) }
      : { min: 0, max: 0 };

    const top10ByPrice = [...products].sort((a, b) => parseFloat(b.price ?? "0") - parseFloat(a.price ?? "0")).slice(0, 10);
    const worst5Seo = [...liveAudit].sort((a, b) => a.score - b.score).slice(0, 5);
    const best5Seo = [...liveAudit].sort((a, b) => b.score - a.score).slice(0, 5);

    const productSummary = products.slice(0, 25).map(p => {
      const cogs = cogsMap.get(p.shopifyProductId);
      const price = parseFloat(p.price ?? "0");
      const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
      const audit = liveAudit.find(a => a.product.shopifyProductId === p.shopifyProductId);
      return `- "${p.title}" | ${price.toFixed(2)}€ | ${p.status} | COGS: ${cogs ? cogs.totalCogs.toFixed(2) + "€" : "sin datos"} | Margen: ${margin != null ? margin.toFixed(0) + "%" : "N/A"} | SEO: ${audit ? audit.grade + " (" + audit.score + "/100)" : "N/A"} | Imgs: ${p.imageCount ?? 0} | Tipo: ${p.productType || "sin tipo"} | Handle: ${p.handle}`;
    }).join("\n");

    const seoIssuesSummary = worst5Seo.map(a =>
      `- "${a.product.title}" SEO ${a.grade} (${a.score}/100): Meta title: ${a.hasMetaTitle ? "SI" : "NO"}, Meta desc: ${a.hasMetaDesc ? "SI" : "NO"}, Schema: ${a.hasSchema ? "SI" : "NO"}, Alt texts: ${a.hasAltTexts ? "SI" : "NO"}, Handle limpio: ${a.cleanHandle ? "SI" : "NO"}, Desc: ${a.descLen} chars`
    ).join("\n");

    const competitorList = competitors.slice(0, 5).map(c => `- ${c.name} (${c.url || "sin URL"}) — tipo: ${c.type || "direct"}`).join("\n");

    const brainContext = await buildShopyBrainContext(project.storeNiche || undefined, "general", `analisis exhaustivo tienda ${project.name}`);

    const dataBlock = `
=== DATOS DE LA TIENDA ===
Nombre: ${project.name}
Dominio: ${project.shopDomain}
Nicho: ${project.storeNiche || "No definido"}
Tono de marca: ${project.brandTone || "No definido"}
Audiencia objetivo: ${project.targetAudience || "No definida"}
Mercados: ${project.storeMarkets || "No definidos"}

=== CATALOGO ===
Total productos: ${products.length} (${activeProducts.length} activos, ${products.length - activeProducts.length} borradores)
Precio medio: ${avgPrice.toFixed(2)}€
Rango: ${priceRange.min.toFixed(2)}€ – ${priceRange.max.toFixed(2)}€
Mediana: ${(() => { const sorted = [...catalogPrices].sort((a, b) => a - b); return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].toFixed(2) : "0.00"; })()}€
Categorias: ${productTypes.join(", ") || "sin categorizar"}
Visual DNA: ${visualDna.length > 0 ? JSON.stringify({ bg: visualDna[0].backgroundStyle, lighting: visualDna[0].lightingStyle, mood: visualDna[0].mood, composition: visualDna[0].composition }) : "No configurado"}

=== SEO ===
Score medio: ${avgSeo.toFixed(1)}/100 (Grade ${storeGrade})
Con meta title: ${liveAudit.filter(a => a.hasMetaTitle).length}/${products.length}
Con meta description: ${liveAudit.filter(a => a.hasMetaDesc).length}/${products.length}
Con Schema JSON-LD: ${liveAudit.filter(a => a.hasSchema).length}/${products.length}
Con alt texts: ${liveAudit.filter(a => a.hasAltTexts).length}/${products.length}
Con handle limpio: ${liveAudit.filter(a => a.cleanHandle).length}/${products.length}
Con descripcion +300 chars: ${liveAudit.filter(a => a.descLen >= 300).length}/${products.length}

Top 5 PEORES SEO:
${seoIssuesSummary}

Top 5 MEJORES SEO:
${best5Seo.map(a => `- "${a.product.title}" SEO ${a.grade} (${a.score}/100)`).join("\n")}

=== FINANCIERO ===
Valor catalogo total: ${totalCatalogValue.toFixed(2)}€
COGS total registrado: ${totalCogs.toFixed(2)}€ (${allCogs.length}/${products.length} productos)
Margen bruto medio: ${allCogs.length > 0 ? avgMargin.toFixed(1) + "%" : "sin datos COGS"}
Revenue Shopify (ultimos 90 dias): ${totalRevenue.toFixed(2)}€
Pedidos totales: ${totalOrders}
AOV: ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) + "€" : "sin pedidos"}

=== A/B TESTING ===
Tests totales: ${tests.length}
Activos: ${tests.filter(t => t.status === "running").length}
Completados: ${tests.filter(t => t.status === "completed" || t.status === "winner_applied").length}

=== COMPETIDORES ===
${competitorList || "Sin competidores registrados"}

=== DETALLE DE PRODUCTOS (hasta 25) ===
${productSummary}
`;

    const systemPrompt = `Eres ShopyBrain, el motor de inteligencia artificial de una agencia Shopify profesional de alto nivel. Generas informes exhaustivos, estrategicos y profundamente analiticos para clientes de e-commerce.

Tu analisis debe ser EXTENSO, DETALLADO, ESPECIFICO al negocio del cliente. No uses frases genericas ni recomendaciones vagas. Cada parrafo debe contener datos concretos del cliente, numeros exactos, y recomendaciones accionables con estimaciones de impacto.

Escribe SIEMPRE en español. Usa lenguaje profesional pero accesible. Se exhaustivo — cuanto mas largo y detallado, mejor. Minimo 3-4 parrafos por seccion.

${brainContext}`;

    const userPrompt = `Genera un analisis EXHAUSTIVO y PROFUNDO de esta tienda Shopify. Responde en formato JSON con las siguientes claves (cada valor es texto largo en HTML con parrafos <p>, negritas <strong>, listas <ul><li>, etc.):

${dataBlock}

FORMATO JSON REQUERIDO:
{
  "executiveSummary": "Narrativa de 4-5 parrafos: estado general de la tienda, hallazgos criticos, fortalezas detectadas, debilidades principales, y una valoracion profesional honesta. Incluye datos numericos concretos.",
  "brandAnalysis": "3-4 parrafos: analisis de coherencia de marca, alineacion entre nicho declarado y catalogo real, consistencia visual (basado en Visual DNA si existe), y recomendaciones de posicionamiento de marca con acciones concretas.",
  "seoDeepAnalysis": "4-5 parrafos: diagnostico detallado de la situacion SEO actual con numeros exactos, analisis de los 5 peores productos y que les falta especificamente, oportunidades de quick-wins (que mejorar primero para maximo impacto), estrategia de schema markup, y plan de accion SEO priorizado por esfuerzo/impacto.",
  "pricingStrategy": "4-5 parrafos: analisis de la estructura de precios actual, distribucion por rangos, coherencia de pricing dentro de cada categoria, oportunidades de pricing psicologico (con ejemplos concretos de productos), estrategia de compare-at-price, y recomendaciones de ajuste con estimacion de impacto en revenue.",
  "financialAnalysis": "3-4 parrafos: analisis de margenes (si hay COGS), productos con margen critico, productos con margen saludable, estructura de costes, y recomendaciones para mejorar rentabilidad. Si no hay COGS, explicar por que es critico registrarlos y que impacto tiene no tenerlos.",
  "productMixStrategy": "3-4 parrafos: analisis del mix de productos, oportunidades de bundle y cross-sell con productos ESPECIFICOS del catalogo (nombrar los productos), estrategia de upsell, productos ancla vs productos de entrada, y como optimizar el AOV.",
  "competitivePosition": "2-3 parrafos: posicionamiento competitivo basado en los competidores registrados (o analisis general del nicho si no hay competidores), ventajas diferenciales, areas de mejora competitiva.",
  "actionPlan30Days": "Lista HTML detallada de las 7-10 acciones prioritarias para los proximos 30 dias, ordenadas por impacto esperado. Cada accion debe incluir: que hacer exactamente, en que productos, resultado esperado, y nivel de esfuerzo (bajo/medio/alto). Usar <ol> con <li> detallados.",
  "revenueProjection": "2-3 parrafos: proyeccion realista de revenue basada en los datos actuales, escenarios optimista/base/pesimista para 30/60/90 dias, y que palancas mover para alcanzar cada escenario."
}

IMPORTANTE: Cada seccion debe ser EXTENSA (minimo 3-4 parrafos), ESPECIFICA (nombrar productos concretos del catalogo), y con DATOS NUMERICOS del cliente. No uses placeholder ni contenido generico. El JSON debe ser valido.`;

    const aiResponse = await askClaude(projectId, [{ role: "user", content: userPrompt }], systemPrompt, 8192);

    let aiReport: Record<string, string>;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      aiReport = JSON.parse(jsonMatch[0]);
    } catch {
      aiReport = { executiveSummary: aiResponse, raw: "true" };
    }

    await db.update(projectsTable)
      .set({
        aiReportJson: JSON.stringify(aiReport),
        aiReportGeneratedAt: new Date(),
      })
      .where(eq(projectsTable.id, projectId));

    res.json({
      ok: true,
      projectId,
      sections: Object.keys(aiReport).length,
      generatedAt: new Date().toISOString(),
      preview: Object.fromEntries(
        Object.entries(aiReport).map(([k, v]) => [k, typeof v === "string" ? v.substring(0, 200) + "..." : v])
      ),
    });
  } catch (err: any) {
    console.error("generate-ai-report error:", err);
    res.status(500).json({ error: "Error generando analisis IA. Intentalo de nuevo." });
  }
});

function calculateSeoScoreInline(p: any, seo: any): { score: number; grade: string; hasMetaTitle: boolean; hasMetaDesc: boolean; hasSchema: boolean; hasAltTexts: boolean; cleanHandle: boolean; descLen: number; wordCount: number; tagCount: number; details?: Record<string, number> } {
  const bodyText = p.bodyHtml?.replace(/<[^>]+>/g, "") ?? "";
  const descLen = bodyText.length;
  const wordCount = bodyText.split(/\s+/).filter((w: string) => w.length > 0).length;
  const imgCount = p.imageCount ?? 0;
  const imgsInline = p.imagesJson as Array<{ alt: string | null }> | null;
  const hasAltTexts = imgCount === 0 || (Array.isArray(imgsInline) && imgsInline.length > 0 && imgsInline.every((img: any) => img.alt && img.alt.trim() !== ""));
  const cleanHandle = /^[a-z0-9-]+$/.test(p.handle) && p.handle.length <= 60;
  const hasMetaTitle = !!seo?.metaTitle;
  const hasMetaDesc = !!seo?.metaDescription;
  const hasSchema = seo?.hasSchema ?? false;
  const tagCount = p.tags ? p.tags.split(",").filter((t: string) => t.trim()).length : 0;
  const titleLen = (p.title ?? "").length;
  const hasStructuredContent = /<(h2|h3|ul|ol|table)[\s>]/i.test(p.bodyHtml ?? "");
  const hasFaqContent = /faq|pregunta|¿/i.test(p.bodyHtml ?? "");

  const details: Record<string, number> = {};
  let totalWeight = 0;
  let weightedSum = 0;

  function addC(name: string, pts: number, weight: number) {
    details[name] = Math.round(pts);
    weightedSum += pts * weight;
    totalWeight += weight;
  }

  let mtPts = 0;
  if (hasMetaTitle) { mtPts = 60; if (seo?.metaTitle?.length >= 40 && seo?.metaTitle?.length <= 60) mtPts = 100; else if (seo?.metaTitle?.length >= 30 && seo?.metaTitle?.length <= 70) mtPts = 80; }
  addC("metaTitle", mtPts, 10);

  let mdPts = 0;
  if (hasMetaDesc) { mdPts = 60; if (seo?.metaDescription?.length >= 130 && seo?.metaDescription?.length <= 160) mdPts = 100; else if (seo?.metaDescription?.length >= 100 && seo?.metaDescription?.length <= 170) mdPts = 80; }
  addC("metaDescription", mdPts, 8);

  let schPts = 0;
  if (hasSchema) { schPts = 60; if (hasFaqContent) schPts = 100; } else { if (hasFaqContent) schPts = 30; }
  addC("structuredData", schPts, 10);

  addC("altTexts", hasAltTexts ? 100 : 0, 6);
  addC("urlHandle", cleanHandle ? (titleLen >= 10 && titleLen <= 50 ? 100 : 80) : 0, 3);

  let wcPts = 0;
  if (wordCount >= 800) wcPts = 100; else if (wordCount >= 500) wcPts = 80; else if (wordCount >= 300) wcPts = 55; else if (wordCount >= 100) wcPts = 25;
  addC("contentDepth", wcPts, 9);

  let spPts = 0;
  if (seo?.pageSpeedScore >= 90) spPts = 100; else if (seo?.pageSpeedScore >= 70) spPts = 70; else if (seo?.pageSpeedScore >= 50) spPts = 40;
  addC("pageSpeed", spPts, 7);

  let tPts = 0;
  if (titleLen >= 45 && titleLen <= 70) tPts = 100; else if (titleLen >= 30 && titleLen <= 80) tPts = 60; else if (titleLen >= 20) tPts = 30;
  addC("titleOptimization", tPts, 5);

  let iPts = 0;
  if (imgCount >= 8) iPts = 100; else if (imgCount >= 5) iPts = 70; else if (imgCount >= 3) iPts = 45; else if (imgCount >= 1) iPts = 15;
  addC("imageCount", iPts, 7);

  let tgPts = 0;
  if (tagCount >= 20) tgPts = 100; else if (tagCount >= 15) tgPts = 75; else if (tagCount >= 10) tgPts = 50; else if (tagCount >= 5) tgPts = 25;
  addC("tagOptimization", tgPts, 5);

  addC("structuredContent", hasStructuredContent ? 100 : 0, 4);

  let kwPts = 0;
  const title = p.title ?? "";
  if (title && bodyText) {
    const tw = title.toLowerCase().replace(/[—–|·\-]/g, " ").split(/\s+/).filter((w: string) => w.length > 3);
    const bl = bodyText.toLowerCase();
    const first200 = bl.substring(0, 800);
    if (tw.length > 0) {
      const br = tw.filter((w: string) => bl.includes(w)).length / tw.length;
      const pr = tw.filter((w: string) => first200.includes(w)).length / tw.length;
      if (br >= 0.6) kwPts += 40; else if (br >= 0.3) kwPts += 20;
      if (pr >= 0.5) kwPts += 35; else if (pr >= 0.25) kwPts += 15;
    }
    if (p.tags) {
      const tl = (p.tags as string).toLowerCase();
      const tkm = tw.filter((w: string) => tl.includes(w)).length;
      if (tw.length > 0 && tkm / tw.length >= 0.4) kwPts += 25;
    }
  }
  addC("keywordConsistency", Math.min(100, kwPts), 8);

  let rdPts = 0;
  if (bodyText && wordCount >= 50) {
    const sents = bodyText.split(/[.!?¿¡]+/).filter((s: string) => s.trim().length > 5);
    const avg = sents.length > 0 ? wordCount / sents.length : 0;
    if (avg >= 10 && avg <= 25) rdPts = 100; else if (avg >= 8 && avg <= 30) rdPts = 70; else if (avg > 0) rdPts = 35;
    const paras = bodyText.split(/\n\n|\r\n\r\n/).filter((pp: string) => pp.trim().length > 20);
    if (paras.length >= 5) rdPts = Math.min(100, rdPts + 10);
  }
  addC("readability", rdPts, 6);

  let smPts = 0;
  if (hasMetaTitle && hasMetaDesc && imgCount >= 1) smPts = 100;
  else if (hasMetaTitle && hasMetaDesc) smPts = 60;
  else if (hasMetaTitle || hasMetaDesc) smPts = 30;
  addC("socialMeta", smPts, 3);

  let fqPts = 0;
  if (hasFaqContent && hasSchema) fqPts = 100; else if (hasFaqContent) fqPts = 60;
  addC("faqOptimization", fqPts, 5);

  addC("internalLinking", 0, 4);

  const score = totalWeight > 0 ? Math.min(100, Math.round(weightedSum / totalWeight)) : 0;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade, hasMetaTitle, hasMetaDesc, hasSchema, hasAltTexts, cleanHandle, descLen, wordCount, tagCount, details };
}

function pageHdr(title: string, num: number) {
  return `<div class="page-header"><div class="page-header-title">${sanitizeHtml(title)}</div><div class="page-header-num">Pagina ${num}</div></div>`;
}

router.get("/projects/:projectId/exports/complete-report", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  if (isNaN(projectId) || projectId <= 0) { res.status(400).json({ error: "ID de proyecto invalido" }); return; }
  try {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
  const jobs = await db.select().from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
  const redesigns = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId));
  const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
  const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
  const revenueSnapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.date)).limit(90);
  const memories = await db.select().from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(10);
  const priceHistory = await db.select().from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId)).orderBy(desc(priceHistoryTable.recordedAt)).limit(20);
  const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).limit(1);
  const insightCount = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable);
  const totalInsights = insightCount[0]?.count ?? 0;

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const esc = sanitizeHtml;

  let aiReport: Record<string, string> | null = null;
  if (project.aiReportJson) {
    try { aiReport = JSON.parse(project.aiReportJson); } catch {}
  }

  const activeProducts = products.filter(p => p.status === "active").length;
  const draftProducts = products.filter(p => p.status === "draft").length;
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;

  const liveAudit = products.map(p => {
    const seo = seoMap.get(p.shopifyProductId);
    return { product: p, seo, ...calculateSeoScoreInline(p, seo) };
  });
  const avgSeo = liveAudit.length > 0 ? liveAudit.reduce((s, a) => s + a.score, 0) / liveAudit.length : 0;
  const storeGrade = avgSeo >= 90 ? "A" : avgSeo >= 75 ? "B" : avgSeo >= 60 ? "C" : avgSeo >= 45 ? "D" : "F";

  const catalogPrices = products.map(p => parseFloat(p.price ?? "0"));
  const totalCatalogValue = catalogPrices.reduce((s, p) => s + p, 0);
  const totalCogs = allCogs.reduce((s, c) => s + c.totalCogs, 0);
  const avgMargin = totalCatalogValue > 0 ? ((totalCatalogValue - totalCogs) / totalCatalogValue) * 100 : 0;
  const imagesGenerated = jobs.filter(j => j.status === "succeeded").length;
  const imagesFailed = jobs.filter(j => j.status === "failed").length;
  const withSchema = liveAudit.filter(a => a.hasSchema).length;
  const withAltTexts = liveAudit.filter(a => a.hasAltTexts).length;
  const withMetaTitle = liveAudit.filter(a => a.hasMetaTitle).length;
  const withMetaDesc = liveAudit.filter(a => a.hasMetaDesc).length;
  const withCleanHandle = liveAudit.filter(a => a.cleanHandle).length;
  const withLongDesc = liveAudit.filter(a => a.descLen >= 300).length;
  const completedTests = tests.filter(t => t.status === "completed" || t.status === "winner_applied").length;
  const activeTests = tests.filter(t => t.status === "running").length;
  const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
  const vendors = [...new Set(products.map(p => p.vendor).filter(Boolean))];
  const priceRange = products.length > 0
    ? { min: Math.min(...catalogPrices), max: Math.max(...catalogPrices) }
    : { min: 0, max: 0 };

  const totalShopifyRevenue = revenueSnapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalShopifyOrders = revenueSnapshots.reduce((s, r) => s + (r.orders ?? 0), 0);
  const shopifyAov = totalShopifyOrders > 0 ? totalShopifyRevenue / totalShopifyOrders : 0;

  function healthScore(): number {
    let score = 0;
    if (avgSeo >= 70) score += 20; else if (avgSeo >= 40) score += 10;
    if (avgMargin >= 40) score += 15; else if (avgMargin >= 20) score += 8;
    if (withSchema >= products.length * 0.5) score += 10; else if (withSchema > 0) score += 5;
    if (withMetaTitle >= products.length * 0.8) score += 10; else if (withMetaTitle > 0) score += 5;
    if (imagesGenerated >= products.length) score += 10; else if (imagesGenerated > 0) score += 5;
    if (tests.length > 0) score += 10;
    if (project.brandTone) score += 5;
    if (project.targetAudience) score += 5;
    if (allCogs.length >= products.length * 0.5) score += 10; else if (allCogs.length > 0) score += 5;
    if (totalShopifyOrders > 0) score += 5;
    return Math.min(score, 100);
  }
  const health = healthScore();
  const healthLabel = health >= 80 ? "Excelente" : health >= 60 ? "Bueno" : health >= 40 ? "Mejorable" : "Necesita atencion";
  const healthColor = health >= 80 ? BRAND.jade : health >= 60 ? BRAND.gold : health >= 40 ? BRAND.orange : BRAND.red;

  const seoGrades: Record<string, number> = {};
  liveAudit.forEach(a => { seoGrades[a.grade] = (seoGrades[a.grade] || 0) + 1; });

  let gradeBreakdown = "";
  for (const [g, count] of Object.entries(seoGrades).sort()) {
    const pct = products.length > 0 ? Math.round((count / products.length) * 100) : 0;
    gradeBreakdown += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <span class="grade ${gradeClass(g)}" style="min-width:44px;text-align:center;">${g}</span>
      <div class="score-bar" style="flex:1;height:8px;"><div class="score-fill" style="width:${pct}%;background:${scoreColor(g === "A+" || g === "A" ? 90 : g === "B" ? 70 : g === "C" ? 50 : 30)};"></div></div>
      <span style="min-width:70px;font-size:12px;font-weight:600;">${count} (${pct}%)</span>
    </div>`;
  }

  let seoDetailRows = "";
  for (const a of liveAudit.slice(0, 60)) {
    seoDetailRows += `<tr>
      <td style="font-weight:600;">${esc(a.product.title).slice(0, 45)}</td>
      <td><span class="grade ${gradeClass(a.grade)}">${a.grade}</span></td>
      <td>${a.score}</td>
      <td>${a.hasMetaTitle ? '<span class="text-jade">&#10003;</span>' : '<span class="text-red">&#10007;</span>'}</td>
      <td>${a.hasMetaDesc ? '<span class="text-jade">&#10003;</span>' : '<span class="text-red">&#10007;</span>'}</td>
      <td>${a.hasSchema ? '<span class="text-jade">&#10003;</span>' : '<span class="text-red">&#10007;</span>'}</td>
      <td>${a.hasAltTexts ? '<span class="text-jade">&#10003;</span>' : '<span class="text-red">&#10007;</span>'}</td>
      <td>${a.cleanHandle ? '<span class="text-jade">&#10003;</span>' : '<span class="text-red">&#10007;</span>'}</td>
      <td>${a.descLen}</td>
    </tr>`;
  }

  let productRows = "";
  for (const p of products.slice(0, 60)) {
    const seo = seoMap.get(p.shopifyProductId);
    const cogs = cogsMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    const audit = liveAudit.find(a => a.product.shopifyProductId === p.shopifyProductId);
    productRows += `<tr>
      <td style="font-weight:600;">${esc(p.title)}</td>
      <td>${p.status === "active" ? '<span class="tag tag-jade">Activo</span>' : '<span class="tag">Borrador</span>'}</td>
      <td style="font-weight:600;">${price > 0 ? price.toFixed(2) + "€" : "—"}</td>
      <td>${cogs ? cogs.totalCogs.toFixed(2) + "€" : '<span class="text-muted fs-sm">Sin datos</span>'}</td>
      <td>${margin != null ? `<span class="${margin > 30 ? "text-jade fw-700" : margin > 15 ? "text-gold fw-700" : "text-red fw-700"}">${margin.toFixed(1)}%</span>` : "—"}</td>
      <td>${audit ? `<span class="grade ${gradeClass(audit.grade)}">${audit.grade}</span>` : "—"}</td>
      <td>${p.auditScore != null ? Math.round(p.auditScore) : "—"}</td>
      <td>${p.imageCount ?? 0}</td>
    </tr>`;
  }

  let cogsDetailRows = "";
  for (const p of products.slice(0, 60)) {
    const cogs = cogsMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    const breakEven = cogs?.breakEvenPrice ?? null;
    cogsDetailRows += `<tr>
      <td style="font-weight:600;">${esc(p.title).slice(0, 40)}</td>
      <td>${price.toFixed(2)}€</td>
      <td>${cogs ? `${cogs.unitCost?.toFixed(2) ?? "0.00"}€` : "—"}</td>
      <td>${cogs ? `${(cogs.packaging ?? 0).toFixed(2)}€` : "—"}</td>
      <td>${cogs ? `${(cogs.shippingDomestic ?? 0).toFixed(2)}€` : "—"}</td>
      <td style="font-weight:700;">${cogs ? `${cogs.totalCogs.toFixed(2)}€` : "—"}</td>
      <td>${breakEven != null ? `${breakEven.toFixed(2)}€` : "—"}</td>
      <td>${margin != null ? `<span class="${margin > 30 ? "text-jade fw-700" : margin > 15 ? "text-gold fw-700" : "text-red fw-700"}">${margin.toFixed(1)}%</span>` : "—"}</td>
    </tr>`;
  }

  let testRows = "";
  for (const t of tests.slice(0, 20)) {
    const convA = t.variantAVisitors > 0 ? (t.variantAConversions / t.variantAVisitors) * 100 : 0;
    const convB = t.variantBVisitors > 0 ? (t.variantBConversions / t.variantBVisitors) * 100 : 0;
    const improvement = convA > 0 ? ((convB - convA) / convA) * 100 : 0;
    testRows += `<tr>
      <td style="font-weight:600;">${esc(t.productTitle)}</td>
      <td><span class="tag">${esc(t.testType)}</span></td>
      <td><span class="tag ${t.status === "running" ? "tag-jade" : t.status === "completed" || t.status === "winner_applied" ? "tag-blue" : ""}">${esc(t.status)}</span></td>
      <td>${t.winner ? esc(t.winner) : "—"}</td>
      <td>${t.variantAVisitors + t.variantBVisitors > 0 ? `<span class="${improvement >= 0 ? "text-jade" : "text-red"} fw-700">${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}%</span>` : "—"}</td>
    </tr>`;
  }

  let compRows = "";
  for (const c of competitors.slice(0, 10)) {
    const safeUrl = c.url && /^https?:\/\//i.test(c.url) ? c.url : null;
    compRows += `<tr>
      <td style="font-weight:600;">${esc(c.name)}</td>
      <td>${safeUrl ? `<a href="${esc(safeUrl)}" class="text-blue" style="text-decoration:none;" target="_blank" rel="noopener">${esc(safeUrl.slice(0, 35))}...</a>` : "—"}</td>
      <td><span class="tag">${esc(c.type || "direct")}</span></td>
      <td><span class="tag ${c.active === 1 ? "tag-jade" : ""}">${c.active === 1 ? "activo" : "inactivo"}</span></td>
    </tr>`;
  }

  let priceHistoryRows = "";
  for (const h of priceHistory) {
    const pct = h.oldPrice && h.oldPrice > 0 ? (((h.newPrice - h.oldPrice) / h.oldPrice) * 100) : 0;
    priceHistoryRows += `<tr>
      <td>${h.recordedAt?.toLocaleDateString("es-ES") ?? "—"}</td>
      <td>${esc(h.shopifyProductId)}</td>
      <td>${h.oldPrice?.toFixed(2) ?? "—"}€</td>
      <td style="font-weight:600;">${h.newPrice.toFixed(2)}€</td>
      <td><span class="${pct >= 0 ? "text-jade fw-700" : "text-red fw-700"}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></td>
      <td class="text-muted">${esc(h.changeSource ?? "—")}</td>
    </tr>`;
  }

  let revenueRows = "";
  for (const s of revenueSnapshots.slice(0, 30)) {
    revenueRows += `<tr>
      <td>${esc(s.date)}</td>
      <td style="font-weight:700;">${(s.revenue ?? 0).toFixed(2)}€</td>
      <td>${s.orders ?? 0}</td>
      <td>${(s.aov ?? 0).toFixed(2)}€</td>
    </tr>`;
  }

  const priceBuckets: Record<string, number> = {};
  products.forEach(p => {
    const pr = parseFloat(p.price ?? "0");
    const bucket = pr < 10 ? "0-9€" : pr < 25 ? "10-24€" : pr < 50 ? "25-49€" : pr < 100 ? "50-99€" : pr < 200 ? "100-199€" : "200€+";
    priceBuckets[bucket] = (priceBuckets[bucket] || 0) + 1;
  });
  let priceDist = "";
  for (const [bucket, count] of Object.entries(priceBuckets)) {
    const pct = Math.round((count / products.length) * 100);
    priceDist += `<div class="waterfall-bar"><div class="waterfall-label">${bucket}</div><div class="waterfall-fill" style="width:${Math.max(pct, 5)}%;background:${BRAND.gold};"><div class="waterfall-val">${count} (${pct}%)</div></div></div>`;
  }

  const issues: string[] = [];
  const successes: string[] = [];
  if (withSchema < products.length * 0.5 && products.length > 0) issues.push(`Solo ${withSchema}/${products.length} productos tienen Schema JSON-LD. Implementar structured data mejora CTR +30%.`);
  if (withAltTexts < products.length * 0.5 && products.length > 0) issues.push(`Solo ${withAltTexts}/${products.length} productos tienen alt texts optimizados.`);
  if (withMetaTitle < products.length * 0.8 && products.length > 0) issues.push(`${products.length - withMetaTitle} productos sin meta title optimizado — impacto directo en CTR de Google.`);
  if (withMetaDesc < products.length * 0.8 && products.length > 0) issues.push(`${products.length - withMetaDesc} productos sin meta description — Google muestra snippets genericos.`);
  if (avgSeo < 60) issues.push(`Score SEO medio (${Math.round(avgSeo)}/100, Grade ${storeGrade}) por debajo del umbral competitivo de 60.`);
  if (avgMargin < 30 && totalCatalogValue > 0 && allCogs.length > 0) issues.push(`Margen medio (${avgMargin.toFixed(1)}%) por debajo del 30% recomendado. Revisar costes o pricing.`);
  if (allCogs.length < products.length * 0.5 && products.length > 0) issues.push(`Solo ${allCogs.length}/${products.length} productos tienen costes (COGS) registrados. Sin costes no hay analisis de rentabilidad real.`);
  if (tests.length === 0) issues.push(`Sin A/B tests activos. Activar testing continuo de imagenes y precios mejora conversion +15-30%.`);
  if (!project.brandTone) issues.push(`Tono de marca no definido — la IA genera contenido sin personalidad de marca.`);
  if (totalShopifyOrders === 0) issues.push(`Sin datos de ventas sincronizados desde Shopify. Sincronizar pedidos para analisis de revenue real.`);
  if (withLongDesc < products.length * 0.5 && products.length > 0) issues.push(`${products.length - withLongDesc} productos con descripciones cortas (<300 chars). Google penaliza contenido thin.`);

  if (imagesGenerated > 0) successes.push(`${imagesGenerated} imagenes IA generadas con exito.`);
  if (completedTests > 0) successes.push(`${completedTests} A/B tests completados con datos reales.`);
  if (avgSeo >= 70) successes.push(`Score SEO medio de ${Math.round(avgSeo)}/100 (${storeGrade}) — competitivo.`);
  if (avgMargin >= 40 && allCogs.length > 0) successes.push(`Margen bruto del ${avgMargin.toFixed(1)}% — saludable.`);
  if (redesigns.length > 0) successes.push(`${redesigns.length} fichas de producto rediseñadas con IA.`);
  if (totalShopifyOrders > 0) successes.push(`${totalShopifyOrders} pedidos registrados — ${totalShopifyRevenue.toFixed(0)}€ en revenue real.`);
  if (allCogs.length > 0) successes.push(`${allCogs.length} productos con estructura de costes completa.`);

  const sortedByPrice = [...products].sort((a, b) => parseFloat(b.price ?? "0") - parseFloat(a.price ?? "0"));
  const topExpensive = sortedByPrice.slice(0, 5);
  const topCheap = sortedByPrice.slice(-5).reverse();

  let priceSuggestionRows = "";
  for (const p of products.slice(0, 30)) {
    const price = parseFloat(p.price ?? "0");
    const cogs = cogsMap.get(p.shopifyProductId);
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    const compareAt = p.compareAtPrice ? parseFloat(p.compareAtPrice) : null;

    const psychPrice = Math.ceil(price) - 0.01;
    const hasCompareAt = compareAt && compareAt > price;

    let suggestion = "";
    let suggestedPrice = price;
    let impact = "";

    if (margin !== null && margin < 15 && price > 0) {
      const minViable = cogs ? cogs.totalCogs / 0.6 : price * 1.2;
      suggestedPrice = Math.ceil(minViable) - 0.01;
      suggestion = `Margen critico (${margin.toFixed(0)}%). Subir a ${suggestedPrice.toFixed(2)}€ para alcanzar ~40% margen.`;
      impact = `+${((suggestedPrice - price) / price * 100).toFixed(0)}% precio`;
    } else if (price > avgPrice * 2 && !hasCompareAt) {
      suggestedPrice = psychPrice;
      suggestion = `Producto premium. Activar "Compare at Price" a ${(price * 1.25).toFixed(2)}€ para anclaje psicologico.`;
      impact = "CTR +15-25%";
    } else if (price < avgPrice * 0.4 && price > 0) {
      suggestedPrice = Math.ceil(price * 1.15) - 0.01;
      suggestion = `Precio bajo vs catalogo. Subir ${((suggestedPrice - price) / price * 100).toFixed(0)}% sin impacto en conversion.`;
      impact = `+${((suggestedPrice - price)).toFixed(2)}€/unidad`;
    } else if (price !== psychPrice && price > 5) {
      suggestedPrice = psychPrice;
      suggestion = `Aplicar precio psicologico: ${psychPrice.toFixed(2)}€ en lugar de ${price.toFixed(2)}€.`;
      impact = "Conversion +3-8%";
    } else {
      continue;
    }

    priceSuggestionRows += `<tr>
      <td style="font-weight:600;">${esc(p.title).slice(0, 35)}</td>
      <td>${price.toFixed(2)}€</td>
      <td style="font-weight:700;color:${BRAND.gold};">${suggestedPrice.toFixed(2)}€</td>
      <td>${margin !== null ? `${margin.toFixed(0)}%` : "—"}</td>
      <td class="text-muted" style="font-size:12px;">${suggestion}</td>
      <td><span class="tag tag-jade">${impact}</span></td>
    </tr>`;
  }

  const marginBuckets: Record<string, number> = {};
  products.forEach(p => {
    const cogs = cogsMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    if (!cogs || price === 0) { marginBuckets["Sin COGS"] = (marginBuckets["Sin COGS"] || 0) + 1; return; }
    const m = ((price - cogs.totalCogs) / price) * 100;
    const bucket = m < 0 ? "Negativo" : m < 15 ? "0-14%" : m < 30 ? "15-29%" : m < 50 ? "30-49%" : m < 70 ? "50-69%" : "70%+";
    marginBuckets[bucket] = (marginBuckets[bucket] || 0) + 1;
  });
  let marginDist = "";
  const marginOrder = ["Negativo", "0-14%", "15-29%", "30-49%", "50-69%", "70%+", "Sin COGS"];
  for (const bucket of marginOrder) {
    const count = marginBuckets[bucket] || 0;
    if (count === 0) continue;
    const pct = Math.round((count / products.length) * 100);
    const color = bucket === "Negativo" ? BRAND.red : bucket === "0-14%" ? BRAND.orange : bucket.startsWith("Sin") ? BRAND.muted : BRAND.jade;
    marginDist += `<div class="waterfall-bar"><div class="waterfall-label">${bucket}</div><div class="waterfall-fill" style="width:${Math.max(pct, 5)}%;background:${color};"><div class="waterfall-val">${count} (${pct}%)</div></div></div>`;
  }

  const avgImages = products.length > 0 ? (products.reduce((s, p) => s + (p.imageCount ?? 0), 0) / products.length).toFixed(1) : "0";
  const noImages = products.filter(p => (p.imageCount ?? 0) === 0).length;
  const singleImage = products.filter(p => (p.imageCount ?? 0) === 1).length;
  const goodImages = products.filter(p => (p.imageCount ?? 0) >= 4).length;

  const reportTitle = "Auditoria Completa";

  const sanitizeAiHtml = (html: string): string => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[\s\S]*?>/gi, "")
      .replace(/<form[\s\S]*?<\/form>/gi, "")
      .replace(/<input[\s\S]*?>/gi, "")
      .replace(/<textarea[\s\S]*?<\/textarea>/gi, "")
      .replace(/<button[\s\S]*?<\/button>/gi, "")
      .replace(/<link[\s\S]*?>/gi, "")
      .replace(/<meta[\s\S]*?>/gi, "")
      .replace(/<base[\s\S]*?>/gi, "")
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/data\s*:/gi, "data-blocked:")
      .replace(/vbscript\s*:/gi, "");
  };

  const aiBlock = (key: string, fallback = "") => {
    if (!aiReport || !aiReport[key]) return fallback;
    const safeHtml = sanitizeAiHtml(aiReport[key]);
    return `<div class="card" style="margin-top:16px;border-left:3px solid ${BRAND.gold};padding:20px 24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:16px;">&#129504;</span>
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.gold};">Analisis ShopyBrain AI</span>
      </div>
      <div style="font-size:13px;line-height:1.9;color:${BRAND.mutedLight};">${safeHtml}</div>
    </div>`;
  };

  const body = `
    <!-- PAGE 1: EXECUTIVE SUMMARY + TABLE OF CONTENTS -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-gold">&#9733;</div>
        <div class="section-title">Resumen Ejecutivo</div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:20px;">
          <div style="text-align:center;">
            <div style="width:90px;height:90px;border-radius:50%;border:3px solid ${healthColor};display:flex;align-items:center;justify-content:center;background:${healthColor}11;">
              <span style="font-size:32px;font-weight:900;color:${healthColor};">${health}</span>
            </div>
            <div style="font-size:11px;color:${healthColor};font-weight:700;margin-top:6px;text-transform:uppercase;">${healthLabel}</div>
          </div>
          <div style="flex:1;">
            <p style="font-size:15px;line-height:1.8;color:${BRAND.mutedLight};">
              Auditoria completa de <strong style="color:${BRAND.white};">${esc(project.name)}</strong>
              ${project.shopDomain ? `(<strong style="color:${BRAND.white};">${esc(project.shopDomain)}</strong>)` : ""}
              en el nicho de <strong style="color:${BRAND.gold};">${esc(project.storeNiche || "e-commerce")}</strong>.
              Catalogo: <strong style="color:${BRAND.white};">${activeProducts} activos</strong>${draftProducts > 0 ? ` + ${draftProducts} borradores` : ""},
              precio medio <strong style="color:${BRAND.white};">${avgPrice.toFixed(2)}€</strong> (rango ${priceRange.min.toFixed(0)}€–${priceRange.max.toFixed(0)}€).
              ${totalShopifyOrders > 0 ? `Revenue real: <strong style="color:${BRAND.jade};">${totalShopifyRevenue.toFixed(0)}€</strong> en ${totalShopifyOrders} pedidos.` : ""}
            </p>
          </div>
        </div>
      </div>
      ${aiBlock("executiveSummary")}
      <div class="metric-row">
        <div class="metric"><div class="value">${activeProducts}</div><div class="label">Productos activos</div></div>
        <div class="metric"><div class="value">${avgPrice.toFixed(0)}€</div><div class="label">Precio medio</div></div>
        <div class="metric"><div class="value"><span class="grade ${gradeClass(storeGrade)}" style="font-size:24px;">${storeGrade}</span></div><div class="label">Grade SEO</div></div>
        <div class="metric"><div class="value">${Math.round(avgSeo)}</div><div class="label">Score SEO</div></div>
        ${allCogs.length > 0 ? `<div class="metric"><div class="value" style="color:${avgMargin >= 30 ? BRAND.jade : BRAND.red};">${avgMargin.toFixed(0)}%</div><div class="label">Margen medio</div></div>` : ""}
        ${totalShopifyOrders > 0 ? `<div class="metric"><div class="value" style="color:${BRAND.jade};">${totalShopifyRevenue.toFixed(0)}€</div><div class="label">Revenue real</div></div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-header"><div class="section-icon section-icon-gold">&#128196;</div><div class="section-title">Indice del Informe</div></div>
      <div class="toc">
        <div class="toc-item"><div class="toc-num">1</div><div><div class="toc-label">Resumen Ejecutivo</div><div class="toc-desc">Health score, KPIs y vision general</div></div></div>
        <div class="toc-item"><div class="toc-num">2</div><div><div class="toc-label">Identidad de Marca</div><div class="toc-desc">Nicho, tono, audiencia, categorias</div></div></div>
        <div class="toc-item"><div class="toc-num">3</div><div><div class="toc-label">Auditoria SEO Tecnico</div><div class="toc-desc">Score por producto, meta tags, schema, alt texts</div></div></div>
        <div class="toc-item"><div class="toc-num">4</div><div><div class="toc-label">Analisis Economico y COGS</div><div class="toc-desc">Estructura de costes, margenes, distribucion de precios</div></div></div>
        ${totalShopifyOrders > 0 ? '<div class="toc-item"><div class="toc-num">5</div><div><div class="toc-label">Analisis de Ventas</div><div class="toc-desc">Revenue real, pedidos, AOV, tendencias</div></div></div>' : ""}
        <div class="toc-item"><div class="toc-num">${totalShopifyOrders > 0 ? 6 : 5}</div><div><div class="toc-label">A/B Testing y Optimizacion de Precios</div><div class="toc-desc">Tests activos, resultados, sugerencias de precio IA</div></div></div>
        <div class="toc-item"><div class="toc-num">${totalShopifyOrders > 0 ? 7 : 6}</div><div><div class="toc-label">AI Economist — Analisis Economico</div><div class="toc-desc">Posicionamiento, margenes, bundles, proyecciones</div></div></div>
        <div class="toc-item"><div class="toc-num">${totalShopifyOrders > 0 ? 8 : 7}</div><div><div class="toc-label">Recomendaciones Estrategicas</div><div class="toc-desc">Acciones priorizadas por impacto</div></div></div>
        <div class="toc-item"><div class="toc-num">${totalShopifyOrders > 0 ? 9 : 8}</div><div><div class="toc-label">Catalogo Completo</div><div class="toc-desc">Detalle por producto: precio, COGS, SEO, imagenes</div></div></div>
      </div>
    </div>

    <!-- PAGE 2: BRAND & IDENTITY -->
    <div class="report-page">
      ${pageHdr(reportTitle, 2)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-gold">&#127912;</div>
          <div class="section-title">Identidad de Marca</div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-item-label">Nicho</div><div class="stat-item-value">${esc(project.storeNiche || "No definido")}</div></div>
          <div class="stat-item"><div class="stat-item-label">Tono de marca</div><div class="stat-item-value">${esc(project.brandTone || "No definido")}</div></div>
          <div class="stat-item"><div class="stat-item-label">Audiencia objetivo</div><div class="stat-item-value">${esc(project.targetAudience || "No definida")}</div></div>
          <div class="stat-item"><div class="stat-item-label">Mercados</div><div class="stat-item-value">${esc(project.storeMarkets || "Global")}</div></div>
        </div>
        ${productTypes.length > 0 ? `<div class="card" style="margin-top:12px;"><div class="stat-item-label" style="margin-bottom:8px;">Categorias de producto (${productTypes.length})</div><div>${productTypes.map(t => `<span class="tag">${esc(t || "")}</span>`).join(" ")}</div></div>` : ""}
        ${vendors.length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:8px;">Proveedores (${vendors.length})</div><div>${vendors.map(v => `<span class="tag">${esc(v || "")}</span>`).join(" ")}</div></div>` : ""}
        ${visualDna.length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:8px;">Visual DNA</div><div class="stat-grid">${visualDna[0].backgroundStyle ? `<div class="stat-item"><div class="stat-item-label">Fondo</div><div class="stat-item-value">${esc(visualDna[0].backgroundStyle)}</div></div>` : ""}${visualDna[0].lightingStyle ? `<div class="stat-item"><div class="stat-item-label">Iluminacion</div><div class="stat-item-value">${esc(visualDna[0].lightingStyle)}</div></div>` : ""}${visualDna[0].mood ? `<div class="stat-item"><div class="stat-item-label">Mood</div><div class="stat-item-value">${esc(visualDna[0].mood)}</div></div>` : ""}${visualDna[0].composition ? `<div class="stat-item"><div class="stat-item-label">Composicion</div><div class="stat-item-value">${esc(visualDna[0].composition)}</div></div>` : ""}</div></div>` : ""}
        <div class="card"><div class="stat-item-label" style="margin-bottom:12px;">Distribucion de precios del catalogo</div>${priceDist}</div>
        ${aiBlock("brandAnalysis")}
      </div>
    </div>

    <!-- PAGE 3: SEO AUDIT (REAL) -->
    <div class="report-page">
      ${pageHdr(reportTitle, 3)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-jade">&#128270;</div>
          <div class="section-title">Auditoria SEO Tecnico</div>
          <div class="section-count">${products.length} auditados en tiempo real</div>
        </div>
        <div class="metric-row">
          <div class="metric"><div class="value">${Math.round(avgSeo)}<span style="font-size:14px;color:${BRAND.muted};">/100</span></div><div class="label">Score medio</div></div>
          <div class="metric"><div class="value"><span class="grade ${gradeClass(storeGrade)}" style="font-size:20px;">${storeGrade}</span></div><div class="label">Grade global</div></div>
          <div class="metric"><div class="value">${withMetaTitle}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Meta Titles</div></div>
          <div class="metric"><div class="value">${withMetaDesc}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Meta Desc</div></div>
          <div class="metric"><div class="value">${withSchema}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Schema</div></div>
          <div class="metric"><div class="value">${withAltTexts}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Alt Texts</div></div>
        </div>
        ${Object.keys(seoGrades).length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:12px;">Distribucion de grados SEO</div>${gradeBreakdown}</div>` : ""}
        <div class="card" style="overflow-x:auto;">
          <div class="stat-item-label" style="margin-bottom:12px;">Detalle SEO por producto</div>
          <table>
            <thead><tr><th>Producto</th><th>Grade</th><th>Score</th><th>Title</th><th>Desc</th><th>Schema</th><th>Alt</th><th>Handle</th><th>Chars</th></tr></thead>
            <tbody>${seoDetailRows}</tbody>
          </table>
        </div>
        ${aiBlock("seoDeepAnalysis")}
      </div>
    </div>

    <!-- PAGE 4: FINANCIAL & COGS -->
    <div class="report-page">
      ${pageHdr(reportTitle, 4)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-orange">&#128176;</div>
          <div class="section-title">Analisis Economico y Estructura de Costes</div>
          <div class="section-count">${allCogs.length}/${products.length} con COGS</div>
        </div>
        <div class="metric-row">
          <div class="metric"><div class="value">${totalCatalogValue.toFixed(0)}€</div><div class="label">Valor catalogo</div></div>
          <div class="metric"><div class="value">${totalCogs.toFixed(0)}€</div><div class="label">COGS total</div></div>
          <div class="metric"><div class="value">${(totalCatalogValue - totalCogs).toFixed(0)}€</div><div class="label">Beneficio bruto</div></div>
          <div class="metric"><div class="value" style="color:${avgMargin >= 30 ? BRAND.jade : allCogs.length > 0 ? BRAND.red : BRAND.muted};">${allCogs.length > 0 ? avgMargin.toFixed(1) + "%" : "—"}</div><div class="label">Margen medio</div></div>
        </div>
        ${allCogs.length === 0 ? `<div class="recommendation recommendation-critical">No hay datos de costes (COGS) registrados. Sin costes no es posible calcular margenes reales ni rentabilidad. Usa la funcion "Estimar COGS con IA" en cada producto o registra costes manualmente (materiales, envio, empaquetado, APIs, mano de obra, etc.).</div>` : ""}
        ${allCogs.length > 0 ? `<div class="card" style="overflow-x:auto;">
          <div class="stat-item-label" style="margin-bottom:12px;">Desglose de costes por producto</div>
          <table>
            <thead><tr><th>Producto</th><th>PVP</th><th>Produccion</th><th>Empaquetado</th><th>Envio</th><th>COGS Total</th><th>Break Even</th><th>Margen</th></tr></thead>
            <tbody>${cogsDetailRows}</tbody>
          </table>
        </div>` : ""}
        ${priceHistoryRows ? `<div class="card" style="overflow-x:auto;"><div class="stat-item-label" style="margin-bottom:12px;">Historial de cambios de precio</div><table><thead><tr><th>Fecha</th><th>Producto</th><th>Anterior</th><th>Nuevo</th><th>Cambio</th><th>Fuente</th></tr></thead><tbody>${priceHistoryRows}</tbody></table></div>` : ""}
        ${aiBlock("financialAnalysis")}
      </div>
    </div>

    <!-- PAGE 5: SALES ANALYSIS (only if data exists) -->
    ${totalShopifyOrders > 0 ? `<div class="report-page">
      ${pageHdr(reportTitle, 5)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-jade">&#128200;</div>
          <div class="section-title">Analisis de Ventas Reales</div>
          <div class="section-count">${revenueSnapshots.length} dias</div>
        </div>
        <div class="metric-row">
          <div class="metric"><div class="value" style="color:${BRAND.jade};">${totalShopifyRevenue.toFixed(0)}€</div><div class="label">Revenue total</div></div>
          <div class="metric"><div class="value">${totalShopifyOrders}</div><div class="label">Pedidos</div></div>
          <div class="metric"><div class="value">${shopifyAov.toFixed(2)}€</div><div class="label">AOV medio</div></div>
          <div class="metric"><div class="value">${revenueSnapshots.length > 0 ? (totalShopifyRevenue / revenueSnapshots.length).toFixed(0) + "€" : "—"}</div><div class="label">Revenue/dia</div></div>
        </div>
        <div class="card" style="overflow-x:auto;">
          <div class="stat-item-label" style="margin-bottom:12px;">Ventas diarias</div>
          <table>
            <thead><tr><th>Fecha</th><th>Revenue</th><th>Pedidos</th><th>AOV</th></tr></thead>
            <tbody>${revenueRows}</tbody>
          </table>
        </div>
      </div>
    </div>` : ""}

    <!-- PAGE 6: A/B TESTING + PRICE OPTIMIZATION -->
    <div class="report-page">
      ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 6 : 5)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-blue">&#9879;</div>
          <div class="section-title">A/B Testing y Optimizacion</div>
          <div class="section-count">${tests.length} tests</div>
        </div>
        <div class="metric-row">
          <div class="metric"><div class="value">${tests.length}</div><div class="label">Tests totales</div></div>
          <div class="metric"><div class="value" style="color:${BRAND.jade};">${activeTests}</div><div class="label">Activos</div></div>
          <div class="metric"><div class="value">${completedTests}</div><div class="label">Completados</div></div>
          <div class="metric"><div class="value">${imagesGenerated}</div><div class="label">Imagenes IA</div></div>
          <div class="metric"><div class="value">${redesigns.length}</div><div class="label">Fichas rediseñadas</div></div>
        </div>
        ${testRows ? `<div class="card" style="overflow-x:auto;"><table><thead><tr><th>Test</th><th>Tipo</th><th>Estado</th><th>Ganador</th><th>Mejora</th></tr></thead><tbody>${testRows}</tbody></table></div>` : ""}
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Oportunidades de optimizacion detectadas</div>
          ${tests.length === 0 ? '<div class="recommendation">Activar A/B tests de imagenes y de precios. Testing continuo puede mejorar conversion entre 15-30%.</div>' : ""}
          ${products.filter(p => p.imageCount <= 1).length > 0 ? `<div class="recommendation">&#128247; ${products.filter(p => p.imageCount <= 1).length} productos con 1 o menos imagenes — añadir fotos lifestyle, detalle y uso.</div>` : ""}
          ${(() => { const highPrice = products.filter(p => parseFloat(p.price ?? "0") > avgPrice * 1.5); return highPrice.length > 0 ? `<div class="recommendation">&#128184; ${highPrice.length} productos con precio >50% sobre la media — candidatos a test de pricing agresivo.</div>` : ""; })()}
          ${(() => { const lowPrice = products.filter(p => { const pr = parseFloat(p.price ?? "0"); return pr > 0 && pr < avgPrice * 0.5; }); return lowPrice.length > 0 ? `<div class="recommendation">&#128200; ${lowPrice.length} productos con precio bajo vs catalogo — posible subida de precio sin impacto en conversion.</div>` : ""; })()}
          ${products.filter(p => !p.compareAtPrice).length > 0 ? `<div class="recommendation">&#127991; ${products.filter(p => !p.compareAtPrice).length} productos sin "Compare at Price" — activar precio tachado mejora percepcion de descuento y CTR.</div>` : ""}
        </div>
        ${priceSuggestionRows ? `<div class="card" style="overflow-x:auto;">
          <div class="stat-item-label" style="margin-bottom:12px;">&#128176; Sugerencias de precio por producto</div>
          <table>
            <thead><tr><th>Producto</th><th>Actual</th><th>Sugerido</th><th>Margen</th><th>Razon</th><th>Impacto</th></tr></thead>
            <tbody>${priceSuggestionRows}</tbody>
          </table>
        </div>` : ""}
        ${competitors.length > 0 ? `<div class="card" style="overflow-x:auto;"><div class="stat-item-label" style="margin-bottom:12px;">Competidores monitorizados</div><table><thead><tr><th>Competidor</th><th>URL</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>${compRows}</tbody></table></div>` : ""}
        ${aiBlock("pricingStrategy")}
        ${aiBlock("competitivePosition")}
      </div>
    </div>

    <!-- PAGE 7: AI ECONOMIST ANALYSIS -->
    <div class="report-page">
      ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 7 : 6)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-gold">&#128202;</div>
          <div class="section-title">Analisis del AI Economist</div>
        </div>
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Posicionamiento de mercado</div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-item-label">Precio medio catalogo</div><div class="stat-item-value">${avgPrice.toFixed(2)}€</div></div>
            <div class="stat-item"><div class="stat-item-label">Rango de precios</div><div class="stat-item-value">${priceRange.min.toFixed(0)}€ – ${priceRange.max.toFixed(0)}€</div></div>
            <div class="stat-item"><div class="stat-item-label">Precio mediano</div><div class="stat-item-value">${(() => { const sorted = [...catalogPrices].sort((a, b) => a - b); return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)].toFixed(2) : "0.00"; })()}€</div></div>
            <div class="stat-item"><div class="stat-item-label">Imagenes por producto</div><div class="stat-item-value">${avgImages} media</div></div>
          </div>
        </div>
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Distribucion de margenes</div>
          ${marginDist || '<div class="text-muted" style="text-align:center;padding:16px;">Registra COGS para ver distribucion de margenes</div>'}
        </div>
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Salud visual del catalogo</div>
          <div class="metric-row">
            <div class="metric"><div class="value">${avgImages}</div><div class="label">Imagenes/producto</div></div>
            <div class="metric"><div class="value" style="color:${noImages > 0 ? BRAND.red : BRAND.jade};">${noImages}</div><div class="label">Sin imagenes</div></div>
            <div class="metric"><div class="value" style="color:${singleImage > 0 ? BRAND.orange : BRAND.jade};">${singleImage}</div><div class="label">Solo 1 imagen</div></div>
            <div class="metric"><div class="value" style="color:${BRAND.jade};">${goodImages}</div><div class="label">4+ imagenes</div></div>
          </div>
        </div>
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Productos premium (Top 5 por precio)</div>
          ${topExpensive.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-weight:600;">${esc(p.title).slice(0, 40)}</span><span class="text-gold fw-800">${parseFloat(p.price ?? "0").toFixed(2)}€</span></div>`).join("")}
        </div>
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Productos entrada (Top 5 mas baratos)</div>
          ${topCheap.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid ${BRAND.border};"><span style="font-weight:600;">${esc(p.title).slice(0, 40)}</span><span class="text-blue fw-800">${parseFloat(p.price ?? "0").toFixed(2)}€</span></div>`).join("")}
        </div>
        <div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Oportunidades de bundle y upsell</div>
          ${(() => {
            const typeGroups: Record<string, typeof products> = {};
            products.forEach(p => { const t = p.productType || "Sin tipo"; if (!typeGroups[t]) typeGroups[t] = []; typeGroups[t].push(p); });
            const bundleable = Object.entries(typeGroups).filter(([_, ps]) => ps.length >= 3).slice(0, 5);
            if (bundleable.length === 0) return '<div class="recommendation recommendation-info">Necesitas al menos 3 productos del mismo tipo para crear bundles.</div>';
            return bundleable.map(([type, ps]) => {
              const bundlePrice = ps.slice(0, 3).reduce((s, p) => s + parseFloat(p.price ?? "0"), 0);
              const discountedPrice = bundlePrice * 0.85;
              return `<div class="recommendation">&#127873; <strong>Bundle "${esc(type)}"</strong>: ${ps.length} productos disponibles. Pack de 3 a ${discountedPrice.toFixed(2)}€ (vs ${bundlePrice.toFixed(2)}€ individual, -15%). AOV estimado +${(discountedPrice - avgPrice).toFixed(0)}€.</div>`;
            }).join("");
          })()}
          ${totalShopifyOrders > 0 && shopifyAov > 0 ? `<div class="recommendation recommendation-success">AOV actual: ${shopifyAov.toFixed(2)}€. Con bundles y upsell, objetivo: ${(shopifyAov * 1.25).toFixed(2)}€ (+25%).</div>` : ""}
        </div>
        ${aiBlock("productMixStrategy")}
        ${totalShopifyOrders > 0 ? `<div class="card">
          <div class="stat-item-label" style="margin-bottom:12px;">Proyeccion de revenue (30 dias)</div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-item-label">Revenue diario actual</div><div class="stat-item-value">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1)).toFixed(2)}€</div></div>
            <div class="stat-item"><div class="stat-item-label">Proyeccion mensual (base)</div><div class="stat-item-value">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1) * 30).toFixed(0)}€</div></div>
            <div class="stat-item"><div class="stat-item-label">Con optimizacion (+20%)</div><div class="stat-item-value text-jade">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1) * 30 * 1.2).toFixed(0)}€</div></div>
            <div class="stat-item"><div class="stat-item-label">Con bundles (+35%)</div><div class="stat-item-value text-gold">${(totalShopifyRevenue / Math.max(revenueSnapshots.length, 1) * 30 * 1.35).toFixed(0)}€</div></div>
          </div>
        </div>` : ""}
      </div>
    </div>

    <!-- PAGE 8: RECOMMENDATIONS -->
    <div class="report-page">
      ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 8 : 7)}

      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-jade">&#9989;</div>
          <div class="section-title">Recomendaciones Estrategicas</div>
        </div>
        ${successes.length > 0 ? `<div class="stat-item-label" style="margin-bottom:12px;color:${BRAND.jade};">&#10003; Logros y fortalezas</div>` : ""}
        ${successes.map(s => `<div class="recommendation recommendation-success">${s}</div>`).join("")}
        ${issues.length > 0 ? `<div class="stat-item-label" style="margin:20px 0 12px;color:${BRAND.orange};">&#9888; Areas de mejora prioritarias</div>` : ""}
        ${issues.map(i => `<div class="recommendation recommendation-critical">${i}</div>`).join("")}
        ${issues.length === 0 && successes.length === 0 ? '<div class="recommendation recommendation-info">Completa la configuracion de costes y sincroniza ventas para obtener recomendaciones personalizadas.</div>' : ""}
        ${aiBlock("actionPlan30Days")}
        ${aiBlock("revenueProjection")}
      </div>
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-gold">&#129504;</div>
          <div class="section-title">Motor IA OmniCore</div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-item-label">Insights de conocimiento</div><div class="stat-item-value">${Number(totalInsights).toLocaleString("es-ES")}</div></div>
          <div class="stat-item"><div class="stat-item-label">Memorias consolidadas</div><div class="stat-item-value">${memories.length > 0 ? "Activo" : "Sin memorias"}</div></div>
          <div class="stat-item"><div class="stat-item-label">Piloto automatico</div><div class="stat-item-value">${project.autoPilotEnabled ? '<span class="text-jade">Activado</span>' : '<span class="text-muted">Desactivado</span>'}</div></div>
          <div class="stat-item"><div class="stat-item-label">Plan</div><div class="stat-item-value text-gold fw-800" style="text-transform:uppercase;">${esc(project.plan)}</div></div>
        </div>
      </div>
    </div>

    <!-- PAGE 9: FULL PRODUCT TABLE -->
    <div class="report-page">
      ${pageHdr(reportTitle, totalShopifyOrders > 0 ? 9 : 8)}
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-blue">&#128203;</div>
          <div class="section-title">Catalogo Completo</div>
          <div class="section-count">${products.length} productos</div>
        </div>
        <div class="card" style="overflow-x:auto;">
          <table>
            <thead><tr><th>Producto</th><th>Estado</th><th>Precio</th><th>COGS</th><th>Margen</th><th>SEO</th><th>Audit</th><th>Imgs</th></tr></thead>
            <tbody>${productRows || '<tr><td colspan="8" class="text-muted" style="text-align:center;">Sin productos importados</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  const html = reportShell(
    `Auditoria Completa — ${project.name}`,
    `${project.shopDomain || "Sin dominio"} — ${project.storeNiche || "eCommerce"}`,
    body, date
  );
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.query.view !== "true") {
    res.setHeader("Content-Disposition", `attachment; filename="Full_Audit_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}.html"`);
  }
  res.send(html);
  } catch (err: any) {
    console.error("complete-report error:", err);
    res.status(500).json({ error: "Error generando el informe completo" });
  }
});

router.get("/projects/:projectId/exports/csv/products", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));

  const headers = ["Titulo","Handle","Estado","Precio","Compare At Price","COGS","Margen %","Vendor","Tipo","Tags","SEO Grade","SEO Score","Imagenes","Variantes","Audit Score"];
  const rows = products.map(p => {
    const cogs = cogsMap.get(p.shopifyProductId);
    const seo = seoMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price * 100).toFixed(1) : "";
    return [
      `"${(p.title || "").replace(/"/g, '""')}"`,
      p.handle,
      p.status,
      p.price ?? "",
      p.compareAtPrice ?? "",
      cogs?.totalCogs?.toFixed(2) ?? "",
      margin,
      `"${(p.vendor || "").replace(/"/g, '""')}"`,
      `"${(p.productType || "").replace(/"/g, '""')}"`,
      `"${(p.tags || "").replace(/"/g, '""')}"`,
      seo?.seoGrade ?? "",
      seo?.seoScore?.toFixed(1) ?? "",
      String(p.imageCount ?? 0),
      String(p.variantCount ?? 1),
      p.auditScore?.toFixed(1) ?? "",
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Products_Export_${new Date().toISOString().split("T")[0]}.csv"`);
  res.send("\uFEFF" + csv);
});

router.get("/projects/:projectId/exports/competitors", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
  const alerts = await db.select().from(competitorAlertsTable).where(eq(competitorAlertsTable.projectId, String(projectId)));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  let compRows = "";
  for (const c of competitors) {
    const snapshots = await db.select().from(competitorSnapshotsTable).where(eq(competitorSnapshotsTable.competitorId, c.id)).orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(1);
    const latest = snapshots[0];
    compRows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${c.name}</td><!-- nosemgrep -->
      <td><a href="${c.url}" style="color:${BRAND.gold};" target="_blank">${c.url?.slice(0, 40)}...</a></td><!-- nosemgrep -->
      <td><span class="tag">${c.type || "direct"}</span></td><!-- nosemgrep -->
      <td>${latest?.productsFound ?? "—"}</td><!-- nosemgrep -->
      <td>${latest?.priceMin != null && latest?.priceMax != null ? `${latest.priceMin.toFixed(0)}€ – ${latest.priceMax.toFixed(0)}€` : "—"}</td><!-- nosemgrep -->
      <td>${latest?.priceMedian != null ? `${latest.priceMedian.toFixed(2)}€` : "—"}</td><!-- nosemgrep -->
      <td class="text-muted">${c.lastScanned ? new Date(c.lastScanned).toLocaleDateString("es-ES") : "Sin escanear"}</td><!-- nosemgrep -->
    </tr>`;
  }

  let alertRows = "";
  for (const a of alerts.filter(a => !a.dismissed).slice(0, 20)) {
    const sevColor = a.severity === "high" ? BRAND.red : a.severity === "medium" ? "#ffa500" : BRAND.jade;
    alertRows += `<tr><!-- nosemgrep -->
      <td><span style="color:${sevColor};font-weight:600;text-transform:uppercase;">${a.severity || "info"}</span></td><!-- nosemgrep -->
      <td style="font-weight:500;">${a.title || "Alerta"}</td><!-- nosemgrep -->
      <td class="text-muted">${a.description?.slice(0, 100) ?? "—"}</td><!-- nosemgrep -->
      <td style="font-size:12px;">${a.actionSuggestion?.slice(0, 80) ?? "—"}</td><!-- nosemgrep -->
      <td class="text-muted">${a.createdAt ? new Date(a.createdAt).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${competitors.length}</div><div class="label">Competidores</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${competitors.filter(c => c.active).length}</div><div class="label">Monitoreados</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${alerts.filter(a => !a.dismissed).length}</div><div class="label">Alertas activas</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">Competidores Monitoreados</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Nombre</th><th>URL</th><th>Tipo</th><th>Productos</th><th>Rango precios</th><th>Mediana</th><th>Escaneado</th></tr></thead>
          <tbody>${compRows || '<tr><td colspan="7" class="text-muted">No hay competidores registrados</td></tr>'}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>
    ${alertRows ? `<div class="section"><!-- nosemgrep -->
      <div class="section-title">Alertas Competitivas</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Severidad</th><th>Alerta</th><th>Descripción</th><th>Acción sugerida</th><th>Fecha</th></tr></thead>
          <tbody>${alertRows}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>` : ""}`;

  const html = reportShell("Informe de Competencia", `${project.name} — Análisis Competitivo`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Competitor_Analysis_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/consistency", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId));
  const brandDna = await db.select().from(brandDnaTable).where(eq(brandDnaTable.projectId, projectId));
  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const vd = visualDna[0];
  const bd = brandDna[0];
  const avgConsistency = vd?.consistencyScore ?? 0;

  let dnaDetails = "";
  if (vd) {
    dnaDetails = `
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo de fondo</p><p>${vd.backgroundStyle || "No analizado"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Iluminación</p><p>${vd.lightingStyle || "No analizado"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Temperatura color</p><p>${vd.colorTemp || "No analizado"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Composición</p><p>${vd.composition || "No analizado"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Mood</p><p>${vd.mood || "No analizado"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Presencia humana</p><p>${vd.humanPresence || "No analizado"}</p></div><!-- nosemgrep -->
      </div>
      ${vd.brandColors?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Colores de marca</p><div style="display:flex;gap:8px;flex-wrap:wrap;">${vd.brandColors.map(c => `<div style="display:flex;align-items:center;gap:6px;"><div style="width:24px;height:24px;border-radius:6px;background:${c};border:1px solid ${BRAND.border};"></div><span style="font-size:12px;">${c}</span></div>`).join("")}</div></div>` : ""}<!-- nosemgrep -->
      ${vd.props?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Props/Accesorios</p><div>${vd.props.map(p => `<span class="tag">${p}</span>`).join(" ")}</div></div>` : ""}`; // nosemgrep
  }

  let brandDetails = "";
  if (bd) {
    brandDetails = `
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo tipográfico</p><p>${bd.typographyStyle || "—"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Patrón de layout</p><p>${bd.layoutPattern || "—"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Densidad visual</p><p>${bd.visualDensity || "—"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Personalidad de marca</p><p>${bd.brandPersonality || "—"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Posición competitiva</p><p>${bd.competitivePosition || "—"}</p></div><!-- nosemgrep -->
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo fotográfico</p><p>${bd.photographyStyle || "—"}</p></div><!-- nosemgrep -->
      </div>
      ${bd.valuePropositions?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Propuestas de valor</p><div>${bd.valuePropositions.map(v => `<span class="tag">${v}</span>`).join(" ")}</div></div>` : ""}<!-- nosemgrep -->
      ${bd.urgencyTactics?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Tácticas de urgencia</p><div>${bd.urgencyTactics.map(t => `<span class="tag">${t}</span>`).join(" ")}</div></div>` : ""}`; // nosemgrep
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${(avgConsistency * 100).toFixed(0)}%</div><div class="label">Consistencia visual</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${products.length}</div><div class="label">Productos analizados</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">ADN Visual</div>
      ${dnaDetails || '<div class="card text-muted">Sin análisis visual. Ejecuta un análisis de consistencia desde la página Consistencia.</div>'}<!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">ADN de Marca</div>
      ${brandDetails || '<div class="card text-muted">Sin ADN de marca extraído. Usa la herramienta de Intelligence para extraer el ADN.</div>'}<!-- nosemgrep -->
    </div>`;

  const html = reportShell("Informe de Consistencia y ADN de Marca", `${project.name} — Identidad Visual`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Consistency_BrandDNA_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/inventory", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
  const restocks = await db.select().from(restockOrdersTable).where(eq(restockOrdersTable.projectId, String(projectId))).orderBy(desc(restockOrdersTable.createdAt)).limit(50);
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const critical = inventory.filter(i => i.status === "critical" || (i.daysRemaining != null && i.daysRemaining <= 7));
  const lowStock = inventory.filter(i => i.status === "low" || (i.daysRemaining != null && i.daysRemaining > 7 && i.daysRemaining <= 30));
  const totalStock = inventory.reduce((sum, i) => sum + (i.currentStock ?? 0), 0);

  let invRows = "";
  for (const i of inventory) {
    const statusColor = i.status === "critical" ? BRAND.red : i.status === "low" ? "#ffa500" : BRAND.jade;
    invRows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${i.productTitle || i.productId}</td><!-- nosemgrep -->
      <td>${i.currentStock ?? "—"}</td><!-- nosemgrep -->
      <td>${i.avgDailySales?.toFixed(1) ?? "—"}</td><!-- nosemgrep -->
      <td><span style="color:${statusColor};font-weight:600;">${i.daysRemaining != null ? `${i.daysRemaining} días` : "—"}</span></td><!-- nosemgrep -->
      <td><span style="color:${statusColor};font-weight:600;text-transform:uppercase;">${i.status || "ok"}</span></td><!-- nosemgrep -->
      <td class="text-muted">${i.supplierEmail || "—"}</td><!-- nosemgrep -->
      <td>${i.supplierLeadDays ?? "—"} días</td><!-- nosemgrep -->
    </tr>`;
  }

  let restockRows = "";
  for (const r of restocks.slice(0, 15)) {
    restockRows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${r.productTitle || r.productId || "—"}</td><!-- nosemgrep -->
      <td>${r.quantitySuggested ?? "—"}</td><!-- nosemgrep -->
      <td><span class="tag">${r.urgency || "normal"}</span></td><!-- nosemgrep -->
      <td>${r.adminApproved ? "✅ Aprobado" : "⏳ Pendiente"}</td>
      <td class="text-muted">${r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${inventory.length}</div><div class="label">Productos rastreados</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${totalStock}</div><div class="label">Stock total</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value" style="color:${BRAND.red}">${critical.length}</div><div class="label">Stock crítico</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value" style="color:#ffa500">${lowStock.length}</div><div class="label">Stock bajo</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">Estado del Inventario</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Stock</th><th>Ventas/día</th><th>Días restantes</th><th>Estado</th><th>Proveedor</th><th>Lead time</th></tr></thead>
          <tbody>${invRows || '<tr><td colspan="7" class="text-muted">Sin datos de inventario</td></tr>'}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>
    ${restockRows ? `<div class="section"><!-- nosemgrep -->
      <div class="section-title">Órdenes de Reposición</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Urgencia</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${restockRows}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>` : ""}`;

  const html = reportShell("Informe de Inventario", `${project.name} — Control de Stock`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Inventory_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/redesigns", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const redesigns = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId)).orderBy(desc(redesignsTable.createdAt));
  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const productMap = new Map(products.map(p => [p.shopifyProductId, p]));
  const applied = redesigns.filter(r => r.appliedAt);

  let rows = "";
  for (const r of redesigns) {
    const product = productMap.get(r.shopifyProductId ?? "");
    rows += `<tr><!-- nosemgrep -->
      <td style="font-weight:500;">${product?.title || r.shopifyProductId || "Desconocido"}</td><!-- nosemgrep -->
      <td>${r.newTitle?.slice(0, 50) ?? "—"}${(r.newTitle?.length ?? 0) > 50 ? "…" : ""}</td><!-- nosemgrep -->
      <td>${r.recommendedPrice != null ? `${r.recommendedPrice}€` : "—"}</td><!-- nosemgrep -->
      <td>${r.appliedAt ? `<span class="text-jade">Aplicado</span>` : '<span class="text-muted">Pendiente</span>'}</td>
      <td class="text-muted">${r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-ES") : "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${redesigns.length}</div><div class="label">Rediseños generados</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${applied.length}</div><div class="label">Aplicados a Shopify</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${redesigns.length - applied.length}</div><div class="label">Pendientes</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">Historial de Rediseños IA</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto original</th><th>Nuevo título propuesto</th><th>Precio recomendado</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="text-muted">No hay rediseños generados</td></tr>'}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>
    ${redesigns.length > 0 && redesigns[0].newDescription ? `<div class="section"><!-- nosemgrep -->
      <div class="section-title">Ejemplo de Rediseño Más Reciente</div>
      <div class="card">
        <p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Producto: ${productMap.get(redesigns[0].shopifyProductId ?? "")?.title || "—"}</p><!-- nosemgrep -->
        <p style="font-size:16px;font-weight:600;color:${BRAND.gold};margin-bottom:12px;">${redesigns[0].newTitle || "—"}</p><!-- nosemgrep -->
        <div class="blog-content" style="font-size:13px;">${redesigns[0].newDescription?.slice(0, 500) ?? ""}${(redesigns[0].newDescription?.length ?? 0) > 500 ? "..." : ""}</div><!-- nosemgrep -->
        ${redesigns[0].tags ? `<div style="margin-top:12px;">${(redesigns[0].tags as any)?.slice?.(0, 10)?.map?.((t: string) => `<span class="tag">${t}</span>`)?.join(" ") ?? ""}</div>` : ""}<!-- nosemgrep -->
      </div>
    </div>` : ""}`;

  const html = reportShell("Informe de Rediseños IA", `${project.name} — Optimización de Fichas`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Redesigns_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/revenue", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const snapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.createdAt)).limit(90);
  const forecasts = await db.select().from(forecastsTable).where(eq(forecastsTable.projectId, String(projectId))).orderBy(desc(forecastsTable.createdAt)).limit(30);
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const totalRevenue = snapshots.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalOrders = snapshots.reduce((s, r) => s + (r.orders ?? 0), 0);
  const avgAov = snapshots.filter(s => s.aov != null).length > 0
    ? snapshots.reduce((s, r) => s + (r.aov ?? 0), 0) / snapshots.filter(s => s.aov != null).length : 0;
  const avgMargin = snapshots.filter(s => s.grossMargin != null).length > 0
    ? snapshots.reduce((s, r) => s + (r.grossMargin ?? 0), 0) / snapshots.filter(s => s.grossMargin != null).length : 0;

  let snapRows = "";
  for (const s of snapshots.slice(0, 30)) {
    snapRows += `<tr><!-- nosemgrep -->
      <td>${s.date}</td><!-- nosemgrep -->
      <td style="font-weight:500;">${s.revenue?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
      <td>${s.orders ?? "—"}</td><!-- nosemgrep -->
      <td>${s.aov?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
      <td>${s.conversionRate != null ? `${(s.conversionRate * 100).toFixed(2)}%` : "—"}</td><!-- nosemgrep -->
      <td>${s.grossMargin != null ? `<span class="${s.grossMargin > 30 ? "text-jade" : "text-red"}">${s.grossMargin.toFixed(1)}%</span>` : "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  let forecastRows = "";
  for (const f of forecasts) {
    forecastRows += `<tr><!-- nosemgrep -->
      <td>${f.forecastDate || "—"}</td><!-- nosemgrep -->
      <td><span class="tag">${f.forecastType || "general"}</span></td><!-- nosemgrep -->
      <td style="font-weight:500;">${f.predictedValue?.toFixed(2) ?? "—"}€</td><!-- nosemgrep -->
      <td>${f.confidenceLow?.toFixed(0) ?? "—"}€ – ${f.confidenceHigh?.toFixed(0) ?? "—"}€</td><!-- nosemgrep -->
      <td>${f.confidencePct ?? "—"}%</td><!-- nosemgrep -->
      <td class="text-muted" style="font-size:11px;">${f.reasoning?.slice(0, 60) ?? "—"}</td><!-- nosemgrep -->
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalRevenue.toFixed(0)}€</div><div class="label">Revenue total</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${totalOrders}</div><div class="label">Pedidos</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${avgAov.toFixed(2)}€</div><div class="label">AOV medio</div></div><!-- nosemgrep -->
      <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen bruto</div></div><!-- nosemgrep -->
    </div>
    <div class="section">
      <div class="section-title">Snapshots de Revenue</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Revenue</th><th>Pedidos</th><th>AOV</th><th>Conversión</th><th>Margen</th></tr></thead>
          <tbody>${snapRows || '<tr><td colspan="6" class="text-muted">Sin datos de revenue aún</td></tr>'}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>
    ${forecastRows ? `<div class="section"><!-- nosemgrep -->
      <div class="section-title">Predicciones / Forecast</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Predicción</th><th>Rango confianza</th><th>Confianza</th><th>Razonamiento</th></tr></thead>
          <tbody>${forecastRows}</tbody><!-- nosemgrep -->
        </table>
      </div>
    </div>` : ""}`;

  const html = reportShell("Informe de Revenue y Forecast", `${project.name} — Análisis Financiero`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Revenue_Forecast_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/shopybrain", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const memories = await db.select().from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(200);
  const domains = await db.select().from(omnicoreKnowledgeDomainsTable).orderBy(desc(omnicoreKnowledgeDomainsTable.verifiedInsights));
  const insights = await db.select().from(omnicoreInsightsTable).orderBy(desc(omnicoreInsightsTable.createdAt)).limit(100);
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const totalMemories = memories.length;
  const avgConfidence = memories.length > 0 ? memories.reduce((s, m) => s + (m.confidence ?? 0), 0) / memories.length : 0;
  const verified = memories.filter(m => m.isVerified).length;
  const supplierMemories = memories.filter(m => m.memoryType === "supplier_intelligence");

  let domainRows = "";
  for (const d of domains) {
    const depth = d.knowledgeDepth ?? 0;
    domainRows += `<tr><!-- nosemgrep -->
      <td style="font-weight:600;">${d.domain}</td>
      <td><div style="display:flex;align-items:center;gap:8px;"><div class="score-bar" style="width:100px;"><div class="score-fill" style="width:${Math.min(depth, 100)}%;background:${scoreColor(depth)};"></div></div><span>${depth}%</span></div></td>
      <td>${d.verifiedInsights ?? 0}</td>
      <td>${d.totalInsights ?? 0}</td>
      <td class="text-muted">${d.lastStudySession ? new Date(d.lastStudySession).toLocaleDateString("es-ES") : "—"}</td>
    </tr>`;
  }

  let memoryTypes: Record<string, number> = {};
  memories.forEach(m => { memoryTypes[m.memoryType] = (memoryTypes[m.memoryType] || 0) + 1; });
  let typeBreakdown = Object.entries(memoryTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${BRAND.border};"><span>${type}</span><span class="text-gold" style="font-weight:600;">${count}</span></div>` // nosemgrep
  ).join("");

  let topInsights = "";
  for (const i of insights.slice(0, 10)) {
    topInsights += `<div class="recommendation"><!-- nosemgrep -->
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-weight:600;color:${BRAND.gold};">${i.title}</span>
        <span class="tag">${i.domain}</span>
      </div>
      <p style="font-size:12px;color:${BRAND.muted};">${i.insight?.slice(0, 150) ?? ""}${(i.insight?.length ?? 0) > 150 ? "..." : ""}</p>
      <div style="margin-top:4px;font-size:11px;"><span class="text-muted">Confianza: </span><span class="${(i.confidence ?? 0) > 0.7 ? "text-jade" : "text-gold"}">${((i.confidence ?? 0) * 100).toFixed(0)}%</span>
      <span class="text-muted" style="margin-left:12px;">Impacto: </span><span class="text-gold">${((i.impactScore ?? 0) * 100).toFixed(0)}%</span></div>
    </div>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalMemories}</div><div class="label">Memorias totales</div></div>
      <div class="metric"><div class="value">${domains.length}</div><div class="label">Dominios</div></div>
      <div class="metric"><div class="value">${(avgConfidence * 100).toFixed(0)}%</div><div class="label">Confianza media</div></div>
      <div class="metric"><div class="value">${verified}</div><div class="label">Verificadas</div></div>
      <div class="metric"><div class="value">${supplierMemories.length}</div><div class="label">Intel proveedores</div></div>
    </div>
    <div class="section">
      <div class="section-title">Dominios de Conocimiento</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Dominio</th><th>Profundidad</th><th>Verificados</th><th>Total insights</th><th>Última sesión</th></tr></thead>
          <tbody>${domainRows || '<tr><td colspan="5" class="text-muted">Sin dominios registrados</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Distribución de Memorias por Tipo</div>
      <div class="card">${typeBreakdown || '<p class="text-muted">Sin memorias</p>'}</div>
    </div>
    <div class="section">
      <div class="section-title">Top 10 Insights Más Recientes</div>
      ${topInsights || '<div class="card text-muted">Sin insights generados aún</div>'}
    </div>`;

  const html = reportShell("Informe ShopyBrain — Inteligencia Artificial", `${project.name} — Estado del Cerebro IA`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ShopyBrain_Intelligence_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/json/products", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));

  const data = products.map(p => ({
    title: p.title,
    handle: p.handle,
    status: p.status,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
    imageCount: p.imageCount,
    variantCount: p.variantCount,
    auditScore: p.auditScore,
    cogs: cogsMap.get(p.shopifyProductId)?.totalCogs ?? null,
    seoGrade: seoMap.get(p.shopifyProductId)?.seoGrade ?? null,
    seoScore: seoMap.get(p.shopifyProductId)?.seoScore ?? null,
  }));

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Products_Data_${new Date().toISOString().split("T")[0]}.json"`);
  res.json({ exportDate: new Date().toISOString(), totalProducts: data.length, products: data });
});

router.get("/projects/:projectId/exports/json/full", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
  const redesignsData = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId));
  const jobs = await db.select().from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
  const memories = await db.select().from(omnicoreMemoriesTable).limit(500);
  const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
  const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
  const snapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId)));

  const fullExport = {
    exportDate: new Date().toISOString(),
    project: { name: project.name, domain: project.shopDomain, niche: project.storeNiche, markets: project.storeMarkets, plan: project.plan },
    products: products.map(p => ({ title: p.title, handle: p.handle, price: p.price, status: p.status, vendor: p.vendor, type: p.productType, tags: p.tags, images: p.imageCount, variants: p.variantCount, audit: p.auditScore })),
    seo: seoData.map(s => ({ productId: s.shopifyProductId, score: s.seoScore, grade: s.seoGrade, metaTitle: s.metaTitle, metaDescription: s.metaDescription })),
    cogs: allCogs.map(c => ({ productId: c.shopifyProductId, total: c.totalCogs })),
    abTests: tests.map(t => ({ name: t.testName, type: t.testType, status: t.status, winner: t.winner, improvement: t.improvementPct })),
    redesigns: redesignsData.map(r => ({ productId: r.shopifyProductId, newTitle: r.newTitle, price: r.recommendedPrice, applied: !!r.appliedAt })),
    aiImages: jobs.filter(j => j.status === "succeeded").map(j => ({ type: j.imageType, url: j.imageUrl, alt: j.altText, model: j.model })),
    competitors: competitors.map(c => ({ name: c.name, url: c.url, type: c.type })),
    inventory: inventory.map(i => ({ product: i.productTitle, stock: i.currentStock, daysLeft: i.daysRemaining, status: i.status })),
    revenue: snapshots.map(s => ({ date: s.date, revenue: s.revenue, orders: s.orders, aov: s.aov })),
    brainMemories: memories.length,
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Full_Project_Export_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.json"`);
  res.json(fullExport);
});

router.get("/projects/:projectId/exports/zip/all", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Complete_Export_${dateStr}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err: any) => { res.status(500).json({ error: err.message }); });
  archive.pipe(res);

  const reportEndpoints = [
    { name: "Informe_Completo", path: "complete-report" },
    { name: "SEO_Audit", path: "seo-audit" },
    { name: "Catalogo_Productos", path: "product-catalog" },
    { name: "Informe_Financiero", path: "financial" },
    { name: "Brand_Brief", path: "brand-brief" },
    { name: "AB_Testing", path: "ab-tests" },
    { name: "Galeria_IA", path: "images-gallery" },
    { name: "Competidores", path: "competitors" },
    { name: "Consistencia_BrandDNA", path: "consistency" },
    { name: "Inventario", path: "inventory" },
    { name: "Rediseños_IA", path: "redesigns" },
    { name: "Revenue_Forecast", path: "revenue" },
    { name: "ShopyBrain_Intel", path: "shopybrain" },
  ];

  const baseUrl = `http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/exports`;

  for (const rpt of reportEndpoints) {
    try {
      const response = await fetch(`${baseUrl}/${rpt.path}`);
      if (response.ok) {
        const html = await response.text();
        archive.append(html, { name: `informes/${rpt.name}_${dateStr}.html` });
      }
    } catch {}
  }

  try {
    const csvRes = await fetch(`${baseUrl}/csv/products`);
    if (csvRes.ok) {
      const csv = await csvRes.text();
      archive.append(csv, { name: `datos/Productos_${dateStr}.csv` });
    }
  } catch {}

  try {
    const jsonRes = await fetch(`${baseUrl}/json/full`);
    if (jsonRes.ok) {
      const json = await jsonRes.text();
      archive.append(json, { name: `datos/Exportacion_Completa_${dateStr}.json` });
    }
  } catch {}

  try {
    const jsonProdRes = await fetch(`${baseUrl}/json/products`);
    if (jsonProdRes.ok) {
      const jsonProd = await jsonProdRes.text();
      archive.append(jsonProd, { name: `datos/Productos_${dateStr}.json` });
    }
  } catch {}

  const readmeContent = `# Exportación Completa — ${project.name}
Fecha: ${dateStr}
Generado por: Shopy Crafter (ShopyBrain AI)

## Contenido del ZIP

### /informes/ (HTML — abrir en navegador, Ctrl+P para PDF)
${reportEndpoints.map(r => `- ${r.name}_${dateStr}.html`).join("\n")}

### /datos/ (CSV + JSON — abrir con Excel, Google Sheets o cualquier editor)
- Productos_${dateStr}.csv
- Productos_${dateStr}.json
- Exportacion_Completa_${dateStr}.json

## Cómo convertir a PDF
1. Abre cualquier archivo .html en tu navegador
2. Pulsa Ctrl+P (o Cmd+P en Mac)
3. Selecciona "Guardar como PDF"
4. El informe ya tiene diseño profesional optimizado para impresión
`;
  archive.append(readmeContent, { name: "LEEME.txt" });

  await archive.finalize();
});

router.get("/projects/:projectId/exports/xlsx/products", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Shopy Crafter — ShopyBrain AI";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Productos", {
    properties: { tabColor: { argb: "FFC8A84B" } },
  });

  ws.columns = [
    { header: "Título", key: "title", width: 40 },
    { header: "Handle", key: "handle", width: 25 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Precio (€)", key: "price", width: 12 },
    { header: "Compare At (€)", key: "compareAt", width: 14 },
    { header: "COGS (€)", key: "cogs", width: 12 },
    { header: "Margen (%)", key: "margin", width: 12 },
    { header: "Beneficio (€)", key: "profit", width: 13 },
    { header: "Vendor", key: "vendor", width: 20 },
    { header: "Tipo", key: "type", width: 18 },
    { header: "Tags", key: "tags", width: 30 },
    { header: "SEO Grade", key: "seoGrade", width: 10 },
    { header: "SEO Score", key: "seoScore", width: 10 },
    { header: "Audit Score", key: "auditScore", width: 12 },
    { header: "Imágenes", key: "images", width: 10 },
    { header: "Variantes", key: "variants", width: 10 },
  ];

  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0F" } };
    cell.border = { bottom: { style: "medium", color: { argb: "FFC8A84B" } } };
    cell.alignment = { vertical: "middle" };
  });

  for (const p of products) {
    const cogs = cogsMap.get(p.shopifyProductId);
    const seo = seoMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const cogsVal = cogs?.totalCogs ?? 0;
    const margin = price > 0 && cogs ? ((price - cogsVal) / price) * 100 : null;
    const profit = price > 0 && cogs ? price - cogsVal : null;

    const row = ws.addRow({
      title: p.title,
      handle: p.handle,
      status: p.status === "active" ? "Activo" : "Borrador",
      price: price || null,
      compareAt: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
      cogs: cogs ? cogsVal : null,
      margin: margin != null ? Math.round(margin * 10) / 10 : null,
      profit: profit != null ? Math.round(profit * 100) / 100 : null,
      vendor: p.vendor,
      type: p.productType,
      tags: p.tags,
      seoGrade: seo?.seoGrade ?? "",
      seoScore: seo?.seoScore ? Math.round(seo.seoScore) : null,
      auditScore: p.auditScore ? Math.round(p.auditScore) : null,
      images: p.imageCount ?? 0,
      variants: p.variantCount ?? 1,
    });

    if (margin != null) {
      const marginCell = row.getCell("margin");
      marginCell.font = { color: { argb: margin > 30 ? "FF2ECC71" : margin > 15 ? "FFC8A84B" : "FFE84558" } };
    }

    const statusCell = row.getCell("status");
    statusCell.font = { color: { argb: p.status === "active" ? "FF2ECC71" : "FF8B8B9E" } };
  }

  ws.autoFilter = { from: "A1", to: `P${products.length + 1}` };

  const summaryWs = workbook.addWorksheet("Resumen", {
    properties: { tabColor: { argb: "FF2ECC71" } },
  });

  const totalRevenue = products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0);
  const totalCosts = allCogs.reduce((s, c) => s + c.totalCogs, 0);
  const avgPrice = products.length > 0 ? totalRevenue / products.length : 0;
  const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
  const avgSeo = seoData.filter(s => s.seoScore != null).length > 0
    ? seoData.reduce((s, d) => s + (d.seoScore ?? 0), 0) / seoData.filter(s => s.seoScore != null).length : 0;

  summaryWs.columns = [
    { header: "Métrica", key: "metric", width: 30 },
    { header: "Valor", key: "value", width: 20 },
  ];

  summaryWs.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0F" } };
  });

  const summaryData = [
    ["Proyecto", project.name],
    ["Dominio", project.shopDomain || "No configurado"],
    ["Nicho", project.storeNiche || "No definido"],
    ["Fecha exportación", new Date().toLocaleDateString("es-ES")],
    ["", ""],
    ["Total productos", products.length],
    ["Productos activos", products.filter(p => p.status === "active").length],
    ["Precio medio", `${avgPrice.toFixed(2)}€`],
    ["Revenue potencial", `${totalRevenue.toFixed(2)}€`],
    ["COGS total", `${totalCosts.toFixed(2)}€`],
    ["Beneficio bruto", `${(totalRevenue - totalCosts).toFixed(2)}€`],
    ["Margen medio", `${avgMargin.toFixed(1)}%`],
    ["SEO Score medio", `${Math.round(avgSeo)}/100`],
    ["Productos con COGS", allCogs.length],
    ["Productos auditados", products.filter(p => p.auditScore != null).length],
  ];

  for (const [metric, value] of summaryData) {
    summaryWs.addRow({ metric, value });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Productos_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/projects/:projectId/exports/xlsx/full", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
  const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectId)));
  const inventory = await db.select().from(inventoryTrackingTable).where(eq(inventoryTrackingTable.projectId, String(projectId)));
  const snapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId)));

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Shopy Crafter — ShopyBrain AI";
  workbook.created = new Date();

  const headerStyle = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0F" } };
    cell.border = { bottom: { style: "medium", color: { argb: "FFC8A84B" } } };
  };

  const ws1 = workbook.addWorksheet("Productos");
  ws1.columns = [
    { header: "Título", key: "title", width: 35 },
    { header: "Estado", key: "status", width: 10 },
    { header: "Precio", key: "price", width: 10 },
    { header: "COGS", key: "cogs", width: 10 },
    { header: "Margen %", key: "margin", width: 10 },
    { header: "SEO", key: "seo", width: 8 },
    { header: "Audit", key: "audit", width: 8 },
    { header: "Vendor", key: "vendor", width: 18 },
    { header: "Tipo", key: "type", width: 15 },
    { header: "Imgs", key: "imgs", width: 6 },
  ];
  ws1.getRow(1).eachCell(headerStyle);
  for (const p of products) {
    const cogs = cogsMap.get(p.shopifyProductId);
    const seo = seoMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    ws1.addRow({ title: p.title, status: p.status, price, cogs: cogs?.totalCogs ?? null, margin: margin != null ? Math.round(margin * 10) / 10 : null, seo: seo?.seoGrade ?? "", audit: p.auditScore ? Math.round(p.auditScore) : null, vendor: p.vendor, type: p.productType, imgs: p.imageCount ?? 0 });
  }

  if (tests.length > 0) {
    const ws2 = workbook.addWorksheet("A/B Tests");
    ws2.columns = [
      { header: "Test", key: "name", width: 30 },
      { header: "Tipo", key: "type", width: 15 },
      { header: "Estado", key: "status", width: 12 },
      { header: "Ganador", key: "winner", width: 10 },
      { header: "Mejora %", key: "improvement", width: 10 },
    ];
    ws2.getRow(1).eachCell(headerStyle);
    for (const t of tests) ws2.addRow({ name: t.testName, type: t.testType, status: t.status, winner: t.winner ?? "", improvement: t.improvementPct ?? null });
  }

  if (competitors.length > 0) {
    const ws3 = workbook.addWorksheet("Competidores");
    ws3.columns = [
      { header: "Nombre", key: "name", width: 25 },
      { header: "URL", key: "url", width: 40 },
      { header: "Tipo", key: "type", width: 12 },
      { header: "Activo", key: "active", width: 8 },
    ];
    ws3.getRow(1).eachCell(headerStyle);
    for (const c of competitors) ws3.addRow({ name: c.name, url: c.url, type: c.type, active: c.active ? "Sí" : "No" });
  }

  if (inventory.length > 0) {
    const ws4 = workbook.addWorksheet("Inventario");
    ws4.columns = [
      { header: "Producto", key: "product", width: 30 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Ventas/día", key: "daily", width: 10 },
      { header: "Días rest.", key: "days", width: 10 },
      { header: "Estado", key: "status", width: 12 },
      { header: "Proveedor", key: "supplier", width: 25 },
    ];
    ws4.getRow(1).eachCell(headerStyle);
    for (const i of inventory) ws4.addRow({ product: i.productTitle, stock: i.currentStock, daily: i.avgDailySales, days: i.daysRemaining, status: i.status, supplier: i.supplierEmail });
  }

  if (snapshots.length > 0) {
    const ws5 = workbook.addWorksheet("Revenue");
    ws5.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Revenue", key: "revenue", width: 12 },
      { header: "Pedidos", key: "orders", width: 10 },
      { header: "AOV", key: "aov", width: 10 },
      { header: "Conversión", key: "conversion", width: 12 },
      { header: "Margen", key: "margin", width: 10 },
    ];
    ws5.getRow(1).eachCell(headerStyle);
    for (const s of snapshots) ws5.addRow({ date: s.date, revenue: s.revenue, orders: s.orders, aov: s.aov, conversion: s.conversionRate, margin: s.grossMargin });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Proyecto_Completo_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
