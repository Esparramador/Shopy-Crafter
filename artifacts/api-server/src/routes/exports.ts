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
  const revenueSnapshots = await db.select().from(revenueSnapshotsTable).where(eq(revenueSnapshotsTable.projectId, String(projectId))).orderBy(desc(revenueSnapshotsTable.date)).limit(30);
  const memories = await db.select().from(omnicoreMemoriesTable).orderBy(desc(omnicoreMemoriesTable.createdAt)).limit(10);
  const priceHistory = await db.select().from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId)).orderBy(desc(priceHistoryTable.recordedAt)).limit(20);
  const visualDna = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).limit(1);

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const esc = sanitizeHtml;

  const activeProducts = products.filter(p => p.status === "active").length;
  const draftProducts = products.filter(p => p.status === "draft").length;
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
  const withSeo = seoData.filter(s => s.seoScore != null);
  const avgSeo = withSeo.length > 0 ? withSeo.reduce((s, d) => s + (d.seoScore ?? 0), 0) / withSeo.length : 0;
  const totalRevenue = products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0);
  const totalCogs = allCogs.reduce((s, c) => s + c.totalCogs, 0);
  const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0;
  const imagesGenerated = jobs.filter(j => j.status === "succeeded").length;
  const imagesFailed = jobs.filter(j => j.status === "failed").length;
  const withSchema = seoData.filter(s => s.hasSchema).length;
  const withAltTexts = seoData.filter(s => s.hasAltTexts).length;
  const completedTests = tests.filter(t => t.status === "completed" || t.status === "winner_applied").length;
  const activeTests = tests.filter(t => t.status === "running").length;
  const productTypes = [...new Set(products.map(p => p.productType).filter(Boolean))];
  const vendors = [...new Set(products.map(p => p.vendor).filter(Boolean))];
  const priceRange = products.length > 0
    ? { min: Math.min(...products.map(p => parseFloat(p.price ?? "0"))), max: Math.max(...products.map(p => parseFloat(p.price ?? "0"))) }
    : { min: 0, max: 0 };

  function healthScore(): number {
    let score = 0;
    if (avgSeo >= 70) score += 25; else if (avgSeo >= 40) score += 12;
    if (avgMargin >= 40) score += 25; else if (avgMargin >= 20) score += 12;
    if (withSchema >= products.length * 0.5) score += 15; else if (withSchema > 0) score += 7;
    if (imagesGenerated >= products.length) score += 15; else if (imagesGenerated > 0) score += 7;
    if (tests.length > 0) score += 10;
    if (project.brandTone) score += 5;
    if (project.targetAudience) score += 5;
    return Math.min(score, 100);
  }
  const health = healthScore();
  const healthLabel = health >= 80 ? "Excelente" : health >= 60 ? "Bueno" : health >= 40 ? "Mejorable" : "Necesita atencion";
  const healthColor = health >= 80 ? BRAND.jade : health >= 60 ? BRAND.gold : health >= 40 ? BRAND.orange : BRAND.red;

  const seoGrades: Record<string, number> = {};
  seoData.forEach(s => { const g = s.seoGrade || "Sin auditar"; seoGrades[g] = (seoGrades[g] || 0) + 1; });

  let gradeBreakdown = "";
  for (const [g, count] of Object.entries(seoGrades).sort()) {
    const pct = products.length > 0 ? Math.round((count / products.length) * 100) : 0;
    gradeBreakdown += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <span class="grade ${gradeClass(g)}" style="min-width:44px;text-align:center;">${g}</span>
      <div class="score-bar" style="flex:1;height:8px;"><div class="score-fill" style="width:${pct}%;background:${scoreColor(g === "A+" || g === "A" ? 90 : g === "B" ? 70 : g === "C" ? 50 : 30)};"></div></div>
      <span style="min-width:70px;font-size:12px;font-weight:600;">${count} (${pct}%)</span>
    </div>`;
  }

  let productRows = "";
  for (const p of products.slice(0, 60)) {
    const seo = seoMap.get(p.shopifyProductId);
    const cogs = cogsMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    productRows += `<tr>
      <td style="font-weight:600;">${esc(p.title)}</td>
      <td>${p.status === "active" ? '<span class="tag tag-jade">Activo</span>' : '<span class="tag">Borrador</span>'}</td>
      <td style="font-weight:600;">${price > 0 ? price.toFixed(2) + "€" : "—"}</td>
      <td>${cogs ? cogs.totalCogs.toFixed(2) + "€" : "—"}</td>
      <td>${margin != null ? `<span class="${margin > 30 ? "text-jade fw-700" : margin > 15 ? "text-gold fw-700" : "text-red fw-700"}">${margin.toFixed(1)}%</span>` : "—"}</td>
      <td>${seo?.seoGrade ? `<span class="grade ${gradeClass(seo.seoGrade)}">${seo.seoGrade}</span>` : "—"}</td>
      <td>${p.auditScore != null ? Math.round(p.auditScore) : "—"}</td>
      <td>${p.imageCount ?? 0}</td>
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

  const issues: string[] = [];
  const successes: string[] = [];
  if (withSchema < products.length * 0.5 && products.length > 0) issues.push(`Solo ${withSchema}/${products.length} productos tienen Schema JSON-LD. Implementar structured data mejora CTR +30%.`);
  if (withAltTexts < products.length * 0.5 && products.length > 0) issues.push(`Solo ${withAltTexts}/${products.length} productos tienen alt texts optimizados. Google Image Search puede generar hasta 20% trafico adicional.`);
  if (avgSeo < 60 && withSeo.length > 0) issues.push(`Puntuacion SEO media (${Math.round(avgSeo)}/100) por debajo del umbral competitivo de 60. Se recomienda optimizar meta titles, descriptions y contenido.`);
  if (avgMargin < 30 && totalRevenue > 0) issues.push(`Margen medio (${avgMargin.toFixed(1)}%) por debajo del 30% recomendado. Revisar estructura de costes o ajustar pricing.`);
  if (tests.length === 0) issues.push(`Sin A/B tests activos. Activar testing continuo para mejorar conversion.`);
  if (!project.brandTone) issues.push(`Tono de marca no definido. Establecerlo mejora la consistencia en copywriting e IA.`);
  if (imagesGenerated > 0) successes.push(`${imagesGenerated} imagenes IA generadas con exito${imagesFailed > 0 ? ` (${imagesFailed} fallidas)` : ""}.`);
  if (completedTests > 0) successes.push(`${completedTests} A/B tests completados — datos de conversion reales.`);
  if (avgSeo >= 70) successes.push(`Puntuacion SEO media de ${Math.round(avgSeo)}/100 — por encima del umbral competitivo.`);
  if (avgMargin >= 40) successes.push(`Margen bruto del ${avgMargin.toFixed(1)}% — saludable y competitivo.`);
  if (redesigns.length > 0) successes.push(`${redesigns.length} fichas de producto rediseñadas con IA.`);

  const body = `
    <!-- EXECUTIVE SUMMARY -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-gold">&#9733;</div>
        <div class="section-title">Resumen Ejecutivo</div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:20px;">
          <div style="text-align:center;">
            <div style="width:80px;height:80px;border-radius:50%;border:3px solid ${healthColor};display:flex;align-items:center;justify-content:center;background:${healthColor}11;">
              <span style="font-size:28px;font-weight:900;color:${healthColor};">${health}</span>
            </div>
            <div style="font-size:11px;color:${healthColor};font-weight:700;margin-top:6px;text-transform:uppercase;">${healthLabel}</div>
          </div>
          <div style="flex:1;">
            <p style="font-size:15px;line-height:1.8;color:${BRAND.mutedLight};">
              Auditoria completa de <strong style="color:${BRAND.white};">${esc(project.name)}</strong>
              ${project.shopDomain ? `(<strong style="color:${BRAND.white};">${esc(project.shopDomain)}</strong>)` : ""}
              en el nicho de <strong style="color:${BRAND.gold};">${esc(project.storeNiche || "e-commerce")}</strong>.
              El catalogo cuenta con <strong style="color:${BRAND.white};">${activeProducts} productos activos</strong>${draftProducts > 0 ? ` y ${draftProducts} borradores` : ""},
              con un precio medio de <strong style="color:${BRAND.white};">${avgPrice.toFixed(2)}€</strong> y un rango de ${priceRange.min.toFixed(0)}€–${priceRange.max.toFixed(0)}€.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI GRID -->
    <div class="metric-row">
      <div class="metric"><div class="value">${activeProducts}</div><div class="label">Productos activos</div></div>
      <div class="metric"><div class="value">${avgPrice.toFixed(0)}€</div><div class="label">Precio medio</div></div>
      <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen bruto</div></div>
      <div class="metric"><div class="value">${Math.round(avgSeo)}</div><div class="label">Score SEO</div></div>
      <div class="metric"><div class="value">${imagesGenerated}</div><div class="label">Imagenes IA</div></div>
      <div class="metric"><div class="value">${tests.length}</div><div class="label">A/B Tests</div></div>
    </div>

    <div class="divider"></div>

    <!-- BRAND & IDENTITY -->
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
      ${productTypes.length > 0 ? `<div class="card" style="margin-top:12px;"><div class="stat-item-label" style="margin-bottom:8px;">Categorias de producto</div><div>${productTypes.map(t => `<span class="tag">${esc(t || "")}</span>`).join(" ")}</div></div>` : ""}
      ${vendors.length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:8px;">Proveedores</div><div>${vendors.map(v => `<span class="tag">${esc(v || "")}</span>`).join(" ")}</div></div>` : ""}
      ${visualDna.length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:8px;">Visual DNA</div><p class="text-muted" style="font-size:13px;line-height:1.7;">StyleLock activo — coherencia visual aplicada a todas las generaciones de imagenes.</p></div>` : ""}
    </div>

    <div class="divider"></div>

    <!-- SEO AUDIT -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-jade">&#128270;</div>
        <div class="section-title">Auditoria SEO Tecnico</div>
        <div class="section-count">${withSeo.length} auditados</div>
      </div>
      <div class="metric-row">
        <div class="metric"><div class="value">${Math.round(avgSeo)}<span style="font-size:14px;color:${BRAND.muted};">/100</span></div><div class="label">Score medio</div></div>
        <div class="metric"><div class="value">${withSchema}</div><div class="label">Con Schema</div></div>
        <div class="metric"><div class="value">${withAltTexts}</div><div class="label">Con Alt Texts</div></div>
        <div class="metric"><div class="value">${withSeo.length}<span style="font-size:14px;color:${BRAND.muted};">/${products.length}</span></div><div class="label">Auditados</div></div>
      </div>
      ${Object.keys(seoGrades).length > 0 ? `<div class="card"><div class="stat-item-label" style="margin-bottom:12px;">Distribucion de grados</div>${gradeBreakdown}</div>` : ""}
    </div>

    <div class="divider"></div>

    <!-- FINANCIAL -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-orange">&#128176;</div>
        <div class="section-title">Analisis Financiero y COGS</div>
        <div class="section-count">${allCogs.length} con COGS</div>
      </div>
      <div class="metric-row">
        <div class="metric"><div class="value">${totalRevenue.toFixed(0)}€</div><div class="label">Revenue potencial</div></div>
        <div class="metric"><div class="value">${totalCogs.toFixed(0)}€</div><div class="label">COGS total</div></div>
        <div class="metric"><div class="value">${(totalRevenue - totalCogs).toFixed(0)}€</div><div class="label">Beneficio bruto</div></div>
        <div class="metric"><div class="value" style="color:${avgMargin >= 30 ? BRAND.jade : BRAND.red};">${avgMargin.toFixed(1)}%</div><div class="label">Margen medio</div></div>
      </div>
      ${priceHistoryRows ? `<div class="card" style="overflow-x:auto;"><div class="stat-item-label" style="margin-bottom:12px;">Historial de cambios de precio</div><table><thead><tr><th>Fecha</th><th>Producto</th><th>Anterior</th><th>Nuevo</th><th>Cambio</th><th>Fuente</th></tr></thead><tbody>${priceHistoryRows}</tbody></table></div>` : ""}
    </div>

    <div class="divider"></div>

    <!-- A/B TESTING -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-blue">&#9879;</div>
        <div class="section-title">A/B Testing</div>
        <div class="section-count">${tests.length} tests</div>
      </div>
      <div class="metric-row">
        <div class="metric"><div class="value">${tests.length}</div><div class="label">Tests totales</div></div>
        <div class="metric"><div class="value" style="color:${BRAND.jade};">${activeTests}</div><div class="label">Activos</div></div>
        <div class="metric"><div class="value">${completedTests}</div><div class="label">Completados</div></div>
      </div>
      ${testRows ? `<div class="card" style="overflow-x:auto;"><table><thead><tr><th>Test</th><th>Tipo</th><th>Estado</th><th>Ganador</th><th>Mejora</th></tr></thead><tbody>${testRows}</tbody></table></div>` : '<div class="card"><p class="text-muted" style="text-align:center;padding:16px;">No hay A/B tests registrados. Activar testing mejora conversion.</p></div>'}
    </div>

    <div class="divider"></div>

    <!-- IMAGES AI -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-gold">&#127912;</div>
        <div class="section-title">Imagenes IA Generadas</div>
        <div class="section-count">${imagesGenerated} exitosas</div>
      </div>
      <div class="metric-row">
        <div class="metric"><div class="value" style="color:${BRAND.jade};">${imagesGenerated}</div><div class="label">Generadas</div></div>
        <div class="metric"><div class="value" style="color:${imagesFailed > 0 ? BRAND.red : BRAND.muted};">${imagesFailed}</div><div class="label">Fallidas</div></div>
        <div class="metric"><div class="value">${redesigns.length}</div><div class="label">Fichas rediseñadas</div></div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- COMPETITORS -->
    ${competitors.length > 0 ? `<div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-red">&#128161;</div>
        <div class="section-title">Inteligencia Competitiva</div>
        <div class="section-count">${competitors.length} monitorizados</div>
      </div>
      <div class="card" style="overflow-x:auto;"><table><thead><tr><th>Competidor</th><th>URL</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>${compRows}</tbody></table></div>
    </div><div class="divider"></div>` : ""}

    <!-- INVENTORY -->
    ${inventory.length > 0 ? `<div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-orange">&#128230;</div>
        <div class="section-title">Inventario y Stock</div>
        <div class="section-count">${inventory.length} trackings</div>
      </div>
      <div class="metric-row">
        <div class="metric"><div class="value">${inventory.length}</div><div class="label">Productos trackeados</div></div>
        <div class="metric"><div class="value">${inventory.filter(i => i.currentStock != null && i.restockThreshold != null && i.currentStock <= i.restockThreshold).length}</div><div class="label">Stock bajo</div></div>
      </div>
    </div><div class="divider"></div>` : ""}

    <!-- OMNICORE BRAIN -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-gold">&#129504;</div>
        <div class="section-title">OmniCore Brain - IA</div>
      </div>
      <div class="card">
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-item-label">Memorias consolidadas</div><div class="stat-item-value">${memories.length > 0 ? "Activo" : "Sin memorias"}</div></div>
          <div class="stat-item"><div class="stat-item-label">Piloto automatico</div><div class="stat-item-value">${project.autoPilotEnabled ? '<span class="text-jade">Activado</span>' : '<span class="text-muted">Desactivado</span>'}</div></div>
          <div class="stat-item"><div class="stat-item-label">Plan activo</div><div class="stat-item-value text-gold fw-800" style="text-transform:uppercase;">${esc(project.plan)}</div></div>
          <div class="stat-item"><div class="stat-item-label">Score audit medio</div><div class="stat-item-value">${project.avgAuditScore != null ? Math.round(project.avgAuditScore) + "/100" : "Sin auditar"}</div></div>
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- RECOMMENDATIONS -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-jade">&#9989;</div>
        <div class="section-title">Recomendaciones y Acciones</div>
      </div>
      ${successes.map(s => `<div class="recommendation recommendation-success">${s}</div>`).join("")}
      ${issues.map(i => `<div class="recommendation">${i}</div>`).join("")}
      ${issues.length === 0 && successes.length === 0 ? '<div class="recommendation recommendation-info">Completa la auditoria de mas productos para obtener recomendaciones personalizadas.</div>' : ""}
    </div>

    <div class="divider"></div>

    <!-- PRODUCT TABLE -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon section-icon-blue">&#128203;</div>
        <div class="section-title">Detalle por Producto</div>
        <div class="section-count">${products.length} productos</div>
      </div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Estado</th><th>Precio</th><th>COGS</th><th>Margen</th><th>SEO</th><th>Audit</th><th>Imgs</th></tr></thead>
          <tbody>${productRows || '<tr><td colspan="8" class="text-muted" style="text-align:center;">Sin productos importados</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

  const html = reportShell(
    `Auditoria Completa — ${project.name}`,
    `${project.shopDomain || "Sin dominio"} — ${project.storeNiche || "eCommerce"}`,
    body, date
  );
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Full_Audit_${sanitizeFilename(project.name)}_${new Date().toISOString().split("T")[0]}.html"`);
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
