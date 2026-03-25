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

const router = Router();

const BRAND = {
  gold: "#c8a84b",
  dark: "#0a0a0f",
  card: "#111118",
  muted: "#8b8b9e",
  jade: "#2ecc71",
  red: "#e84558",
  white: "#f5f5f7",
  border: "#1e1e2e",
};

function reportShell(title: string, subtitle: string, body: string, date: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: ${BRAND.dark}; color: ${BRAND.white}; line-height: 1.6; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
  .header { border-bottom: 2px solid ${BRAND.gold}; padding-bottom: 28px; margin-bottom: 36px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-left h1 { font-size: 28px; font-weight: 800; color: ${BRAND.gold}; letter-spacing: -0.5px; }
  .header-left p { font-size: 14px; color: ${BRAND.muted}; margin-top: 4px; }
  .header-right { text-align: right; }
  .header-right .logo { font-size: 18px; font-weight: 700; color: ${BRAND.gold}; }
  .header-right .date { font-size: 12px; color: ${BRAND.muted}; margin-top: 2px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 18px; font-weight: 700; color: ${BRAND.gold}; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid ${BRAND.border}; }
  .card { background: ${BRAND.card}; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .metric-row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .metric { flex: 1; min-width: 140px; background: ${BRAND.dark}; border: 1px solid ${BRAND.border}; border-radius: 10px; padding: 16px; text-align: center; }
  .metric .value { font-size: 28px; font-weight: 800; color: ${BRAND.gold}; }
  .metric .label { font-size: 11px; color: ${BRAND.muted}; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: ${BRAND.dark}; color: ${BRAND.gold}; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 2px solid ${BRAND.gold}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid ${BRAND.border}; color: ${BRAND.white}; }
  tr:hover td { background: rgba(200,168,75,.04); }
  .grade { display: inline-block; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; }
  .grade-a { background: rgba(46,204,113,.15); color: #2ecc71; }
  .grade-b { background: rgba(200,168,75,.15); color: #c8a84b; }
  .grade-c { background: rgba(255,165,0,.15); color: #ffa500; }
  .grade-d { background: rgba(232,69,88,.15); color: #e84558; }
  .grade-f { background: rgba(232,69,88,.25); color: #e84558; }
  .tag { display: inline-block; background: rgba(200,168,75,.12); color: ${BRAND.gold}; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; font-weight: 500; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid ${BRAND.border}; text-align: center; font-size: 11px; color: ${BRAND.muted}; }
  .footer .brand { color: ${BRAND.gold}; font-weight: 700; }
  .text-jade { color: ${BRAND.jade}; }
  .text-red { color: ${BRAND.red}; }
  .text-gold { color: ${BRAND.gold}; }
  .text-muted { color: ${BRAND.muted}; }
  .score-bar { height: 8px; border-radius: 4px; background: ${BRAND.border}; overflow: hidden; margin-top: 6px; }
  .score-fill { height: 100%; border-radius: 4px; }
  .recommendation { padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; border-left: 3px solid ${BRAND.gold}; background: rgba(200,168,75,.04); font-size: 13px; }
  .blog-content { font-size: 14px; line-height: 1.8; }
  .blog-content h1, .blog-content h2, .blog-content h3 { color: ${BRAND.gold}; margin: 20px 0 10px; }
  .blog-content p { margin-bottom: 12px; }
  .blog-content ul, .blog-content ol { margin: 10px 0 10px 20px; }
  @media print {
    body { background: white; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
    .card { border: 1px solid #ddd; background: #f9f9f9; }
    .metric { background: #f0f0f0; border-color: #ddd; }
    .metric .value { color: #8b6914; }
    th { background: #f0f0f0; color: #8b6914; border-color: #8b6914; }
    td { border-color: #ddd; color: #1a1a1a; }
    .footer { color: #999; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="header-right">
      <div class="logo">ShopyBrain</div>
      <div class="date">${date}</div>
    </div>
  </div>
  ${body}
  <div class="footer">
    <p>Informe generado por <span class="brand">ShopyBrain AI</span> — Agencia Shopify con Inteligencia Artificial</p>
    <p style="margin-top:4px;">Confidencial · ${date}</p>
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
    productRows += `<tr>
      <td style="font-weight:500;">${p.title}</td>
      <td><span class="grade ${gradeClass(grade)}">${grade}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px;"><span>${Math.round(score)}</span><div class="score-bar" style="width:80px;"><div class="score-fill" style="width:${score}%;background:${scoreColor(score)};"></div></div></div></td>
      <td>${seo?.hasSchema ? "✅" : "❌"}</td>
      <td>${seo?.hasAltTexts ? "✅" : "❌"}</td>
      <td class="text-muted">${seo?.metaTitle?.slice(0, 40) ?? "Sin meta title"}${(seo?.metaTitle?.length ?? 0) > 40 ? "…" : ""}</td>
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
    gradeBreakdown += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <span class="grade ${gradeClass(g)}" style="min-width:40px;text-align:center;">${g}</span>
      <div class="score-bar" style="flex:1;"><div class="score-fill" style="width:${pct}%;background:${scoreColor(g === "A+" || g === "A" ? 90 : g === "B" ? 70 : g === "C" ? 50 : 30)};"></div></div>
      <span style="min-width:60px;font-size:13px;">${count} (${pct}%)</span>
    </div>`;
  }

  const issues: string[] = [];
  if (withSchema < totalProducts * 0.5) issues.push(`Solo ${withSchema}/${totalProducts} productos tienen Schema JSON-LD. Implementar structured data mejora CTR +30%.`);
  if (withAltTexts < totalProducts * 0.5) issues.push(`Solo ${withAltTexts}/${totalProducts} productos tienen alt texts optimizados. Google Image Search puede generar hasta 20% tráfico adicional.`);
  if (avgScore < 60) issues.push(`Puntuación SEO media (${Math.round(avgScore)}/100) por debajo del umbral competitivo. Se recomienda optimizar meta titles, descriptions y contenido.`);
  const noMeta = seoData.filter(s => !s.metaTitle || s.metaTitle.length < 10).length;
  if (noMeta > 0) issues.push(`${noMeta} productos sin meta title optimizado. Los meta titles son el factor #1 de CTR en resultados de búsqueda.`);

  let recommendationsHtml = issues.map(i => `<div class="recommendation">${i}</div>`).join("");
  if (issues.length === 0) recommendationsHtml = `<div class="recommendation" style="border-left-color:${BRAND.jade};">✅ Excelente: No se detectaron problemas críticos de SEO.</div>`;

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalProducts}</div><div class="label">Productos</div></div>
      <div class="metric"><div class="value">${Math.round(avgScore)}</div><div class="label">Score SEO medio</div></div>
      <div class="metric"><div class="value">${withSchema}</div><div class="label">Con Schema</div></div>
      <div class="metric"><div class="value">${withAltTexts}</div><div class="label">Con Alt Texts</div></div>
    </div>

    <div class="section">
      <div class="section-title">Distribución de Grados SEO</div>
      <div class="card">${gradeBreakdown}</div>
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
          <tbody>${productRows}</tbody>
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
    rows += `<tr>
      <td style="font-weight:500;">${p.title}</td>
      <td>${p.status === "active" ? '<span class="text-jade">Activo</span>' : '<span class="text-muted">Borrador</span>'}</td>
      <td>${price > 0 ? price.toFixed(2) + "€" : "—"}</td>
      <td>${cogs ? cogs.totalCogs.toFixed(2) + "€" : "—"}</td>
      <td>${margin != null ? `<span class="${margin > 30 ? "text-jade" : margin > 15 ? "text-gold" : "text-red"}">${margin.toFixed(1)}%</span>` : "—"}</td>
      <td>${p.auditScore != null ? Math.round(p.auditScore) : "—"}</td>
      <td>${seo?.seoGrade ? `<span class="grade ${gradeClass(seo.seoGrade)}">${seo.seoGrade}</span>` : "—"}</td>
      <td>${p.imageCount ?? 0}</td>
      <td>${p.variantCount ?? 1}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalProducts}</div><div class="label">Total productos</div></div>
      <div class="metric"><div class="value">${activeProducts}</div><div class="label">Activos</div></div>
      <div class="metric"><div class="value">${avgPrice.toFixed(2)}€</div><div class="label">Precio medio</div></div>
      <div class="metric"><div class="value">${Math.round(avgScore)}</div><div class="label">Score medio</div></div>
    </div>

    <div class="section">
      <div class="section-title">Catálogo Completo</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Estado</th><th>Precio</th><th>COGS</th><th>Margen</th><th>Audit</th><th>SEO</th><th>Imgs</th><th>Vars</th></tr></thead>
          <tbody>${rows}</tbody>
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
      cogsRows += `<tr>
        <td style="font-weight:500;">${p.title}</td>
        <td>${price.toFixed(2)}€</td>
        <td>${cogs.totalCogs.toFixed(2)}€</td>
        <td>${(price - cogs.totalCogs).toFixed(2)}€</td>
        <td><span class="${margin > 30 ? "text-jade" : margin > 15 ? "text-gold" : "text-red"}">${margin.toFixed(1)}%</span></td>
      </tr>`;
    }
  }

  const avgMargin = totalRevenuePotential > 0 ? ((totalRevenuePotential - totalCosts) / totalRevenuePotential) * 100 : 0;

  let priceHistoryRows = "";
  for (const h of priceHistory.slice(0, 30)) {
    const pct = h.oldPrice && h.oldPrice > 0 ? (((h.newPrice - h.oldPrice) / h.oldPrice) * 100) : 0;
    priceHistoryRows += `<tr>
      <td>${h.recordedAt?.toLocaleDateString("es-ES") ?? "—"}</td>
      <td>${h.shopifyProductId}</td>
      <td>${h.oldPrice?.toFixed(2) ?? "—"}€</td>
      <td>${h.newPrice.toFixed(2)}€</td>
      <td><span class="${pct >= 0 ? "text-jade" : "text-red"}">${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span></td>
      <td class="text-muted">${h.changeSource ?? "—"}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalRevenuePotential.toFixed(0)}€</div><div class="label">Revenue potencial</div></div>
      <div class="metric"><div class="value">${totalCosts.toFixed(0)}€</div><div class="label">COGS total</div></div>
      <div class="metric"><div class="value">${(totalRevenuePotential - totalCosts).toFixed(0)}€</div><div class="label">Beneficio bruto</div></div>
      <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen medio</div></div>
    </div>

    <div class="section">
      <div class="section-title">Análisis COGS por Producto</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Precio</th><th>COGS</th><th>Beneficio</th><th>Margen</th></tr></thead>
          <tbody>${cogsRows || '<tr><td colspan="5" class="text-muted">No hay COGS configurados</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    ${priceHistoryRows ? `<div class="section">
      <div class="section-title">Historial de Cambios de Precio</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Anterior</th><th>Nuevo</th><th>Cambio</th><th>Fuente</th></tr></thead>
          <tbody>${priceHistoryRows}</tbody>
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

  const body = `
    <div class="section">
      <div class="section-title">Identidad de Marca</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nombre del Proyecto</p><p style="font-size:18px;font-weight:600;">${project.name}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Dominio Shopify</p><p style="font-size:18px;font-weight:600;">${project.shopDomain || "No configurado"}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nicho de Mercado</p><p style="font-size:16px;font-weight:500;">${project.storeNiche || "No definido"}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Mercados Objetivo</p><p style="font-size:16px;font-weight:500;">${project.storeMarkets || "Global"}</p></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Voz y Tono de Marca</div>
      <div class="card">
        <p style="font-size:15px;line-height:1.8;">${project.brandTone || "No definido — Se recomienda establecer el tono de marca para consistencia en todas las comunicaciones."}</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Audiencia Objetivo</div>
      <div class="card">
        <p style="font-size:15px;line-height:1.8;">${project.targetAudience || "No definido — Definir la audiencia objetivo permite optimizar copywriting, SEO y estrategia de pricing."}</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Panorama del Catálogo</div>
      <div class="metric-row">
        <div class="metric"><div class="value">${activeProducts}</div><div class="label">Productos activos</div></div>
        <div class="metric"><div class="value">${productTypes.length}</div><div class="label">Categorías</div></div>
        <div class="metric"><div class="value">${avgPrice.toFixed(2)}€</div><div class="label">Precio medio</div></div>
        <div class="metric"><div class="value">${priceRange.min.toFixed(0)}–${priceRange.max.toFixed(0)}€</div><div class="label">Rango de precios</div></div>
      </div>
      ${productTypes.length > 0 ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Categorías de producto</p><div>${productTypes.map(t => `<span class="tag">${t}</span>`).join(" ")}</div></div>` : ""}
      ${vendors.length > 0 ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Proveedores / Vendors</p><div>${vendors.map(v => `<span class="tag">${v}</span>`).join(" ")}</div></div>` : ""}
    </div>

    <div class="section">
      <div class="section-title">Estado de Optimización</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Plan activo</p><p style="font-size:16px;font-weight:600;text-transform:uppercase;" class="text-gold">${project.plan}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Piloto automático</p><p style="font-size:16px;font-weight:600;">${project.autoPilotEnabled ? '<span class="text-jade">Activado</span>' : '<span class="text-muted">Desactivado</span>'}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Score Audit medio</p><p style="font-size:16px;font-weight:600;">${project.avgAuditScore != null ? Math.round(project.avgAuditScore) + "/100" : "Sin auditar"}</p></div>
          <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Productos auditados</p><p style="font-size:16px;font-weight:600;">${seoData.filter(s => s.seoScore != null).length}/${products.length}</p></div>
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
    rows += `<tr>
      <td style="font-weight:500;">${t.testName}</td>
      <td>${t.testType}</td>
      <td><span class="tag">${t.status}</span></td>
      <td>${t.startDate ? new Date(t.startDate).toLocaleDateString("es-ES") : "—"}</td>
      <td>${t.winner ?? "—"}</td>
      <td class="text-muted">${t.improvementPct != null ? `+${t.improvementPct.toFixed(1)}%` : "—"}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalTests}</div><div class="label">Tests totales</div></div>
      <div class="metric"><div class="value">${active}</div><div class="label">Activos</div></div>
      <div class="metric"><div class="value">${completed}</div><div class="label">Completados</div></div>
    </div>
    <div class="section">
      <div class="section-title">Historial de A/B Tests</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Test</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Ganador</th><th>Mejora</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="text-muted">No hay tests registrados</td></tr>'}</tbody>
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
    gallery += `<div style="background:${BRAND.dark};border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;">
      ${j.imageUrl ? `<img src="${j.imageUrl}" style="width:100%;height:200px;object-fit:cover;" alt="${j.altText || "AI generated"}"/>` : `<div style="width:100%;height:200px;display:flex;align-items:center;justify-content:center;background:${BRAND.card};"><span class="text-muted">Sin preview</span></div>`}
      <div style="padding:10px;">
        <p style="font-size:12px;font-weight:600;margin-bottom:4px;">${j.imageType ?? "Imagen"}</p>
        <p style="font-size:11px;color:${BRAND.muted};">${j.altText?.slice(0, 60) ?? "Sin descripción"}</p>
        <p style="font-size:10px;color:${BRAND.muted};margin-top:4px;">${j.model ?? ""}</p>
      </div>
    </div>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${succeeded.length}</div><div class="label">Imágenes generadas</div></div>
      <div class="metric"><div class="value">${failed.length}</div><div class="label">Fallidas</div></div>
      <div class="metric"><div class="value">${jobs.length}</div><div class="label">Total jobs</div></div>
    </div>
    <div class="section">
      <div class="section-title">Galería de Imágenes IA</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        ${gallery || `<div class="text-muted" style="grid-column:span 3;text-align:center;padding:40px;">No hay imágenes generadas aún</div>`}
      </div>
    </div>`;

  const html = reportShell("Galería de Imágenes IA", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Images_Gallery_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
});

router.get("/projects/:projectId/exports/complete-report", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const products = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
  const seoData = await db.select().from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
  const allCogs = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
  const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
  const jobs = await db.select().from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
  const redesigns = await db.select().from(redesignsTable).where(eq(redesignsTable.projectId, projectId));

  const cogsMap = new Map(allCogs.map(c => [c.shopifyProductId, c]));
  const seoMap = new Map(seoData.map(s => [s.shopifyProductId, s]));
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const activeProducts = products.filter(p => p.status === "active").length;
  const avgPrice = products.length > 0 ? products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0) / products.length : 0;
  const avgSeo = seoData.filter(s => s.seoScore != null).length > 0 ? seoData.reduce((s, d) => s + (d.seoScore ?? 0), 0) / seoData.filter(s => s.seoScore != null).length : 0;
  const totalRevenue = products.reduce((s, p) => s + parseFloat(p.price ?? "0"), 0);
  const totalCogs = allCogs.reduce((s, c) => s + c.totalCogs, 0);
  const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0;
  const imagesGenerated = jobs.filter(j => j.status === "succeeded").length;

  let productSummary = "";
  for (const p of products.slice(0, 50)) {
    const seo = seoMap.get(p.shopifyProductId);
    const cogs = cogsMap.get(p.shopifyProductId);
    const price = parseFloat(p.price ?? "0");
    const margin = cogs && price > 0 ? ((price - cogs.totalCogs) / price) * 100 : null;
    productSummary += `<tr>
      <td style="font-weight:500;">${p.title}</td>
      <td>${price.toFixed(2)}€</td>
      <td>${margin != null ? `<span class="${margin > 30 ? "text-jade" : "text-red"}">${margin.toFixed(1)}%</span>` : "—"}</td>
      <td>${seo?.seoGrade ? `<span class="grade ${gradeClass(seo.seoGrade)}">${seo.seoGrade}</span>` : "—"}</td>
      <td>${p.auditScore != null ? Math.round(p.auditScore) : "—"}</td>
      <td>${p.imageCount ?? 0}</td>
    </tr>`;
  }

  const body = `
    <div class="section">
      <div class="section-title">Resumen Ejecutivo</div>
      <div class="card">
        <p style="font-size:14px;line-height:1.8;">Este informe presenta un análisis completo del proyecto <strong>${project.name}</strong> (${project.shopDomain || "sin dominio"})
        en el nicho de <strong>${project.storeNiche || "e-commerce"}</strong>. El catálogo cuenta con ${activeProducts} productos activos,
        con un precio medio de ${avgPrice.toFixed(2)}€ y un margen bruto promedio del ${avgMargin.toFixed(1)}%.
        La puntuación SEO media es ${Math.round(avgSeo)}/100. Se han generado ${imagesGenerated} imágenes IA
        y ejecutado ${tests.length} tests A/B${redesigns.length > 0 ? `, con ${redesigns.length} rediseños de fichas` : ""}.</p>
      </div>
    </div>

    <div class="metric-row">
      <div class="metric"><div class="value">${activeProducts}</div><div class="label">Productos activos</div></div>
      <div class="metric"><div class="value">${avgPrice.toFixed(0)}€</div><div class="label">Precio medio</div></div>
      <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen medio</div></div>
      <div class="metric"><div class="value">${Math.round(avgSeo)}</div><div class="label">SEO medio</div></div>
      <div class="metric"><div class="value">${imagesGenerated}</div><div class="label">Imágenes IA</div></div>
      <div class="metric"><div class="value">${tests.length}</div><div class="label">A/B Tests</div></div>
    </div>

    <div class="section">
      <div class="section-title">Identidad y Estrategia</div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Nicho</p><p>${project.storeNiche || "No definido"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Tono de marca</p><p>${project.brandTone || "No definido"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Audiencia</p><p>${project.targetAudience || "No definida"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Mercados</p><p>${project.storeMarkets || "Global"}</p></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Detalle por Producto</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Precio</th><th>Margen</th><th>SEO</th><th>Audit</th><th>Imgs</th></tr></thead>
          <tbody>${productSummary}</tbody>
        </table>
      </div>
    </div>`;

  const html = reportShell("Informe Completo del Proyecto", `${project.name} — ${project.shopDomain || "Sin dominio"}`, body, date);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="Complete_Report_${project.name.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.html"`);
  res.send(html);
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
    compRows += `<tr>
      <td style="font-weight:500;">${c.name}</td>
      <td><a href="${c.url}" style="color:${BRAND.gold};" target="_blank">${c.url?.slice(0, 40)}...</a></td>
      <td><span class="tag">${c.type || "direct"}</span></td>
      <td>${latest?.productsFound ?? "—"}</td>
      <td>${latest?.priceMin != null && latest?.priceMax != null ? `${latest.priceMin.toFixed(0)}€ – ${latest.priceMax.toFixed(0)}€` : "—"}</td>
      <td>${latest?.priceMedian != null ? `${latest.priceMedian.toFixed(2)}€` : "—"}</td>
      <td class="text-muted">${c.lastScanned ? new Date(c.lastScanned).toLocaleDateString("es-ES") : "Sin escanear"}</td>
    </tr>`;
  }

  let alertRows = "";
  for (const a of alerts.filter(a => !a.dismissed).slice(0, 20)) {
    const sevColor = a.severity === "high" ? BRAND.red : a.severity === "medium" ? "#ffa500" : BRAND.jade;
    alertRows += `<tr>
      <td><span style="color:${sevColor};font-weight:600;text-transform:uppercase;">${a.severity || "info"}</span></td>
      <td style="font-weight:500;">${a.title || "Alerta"}</td>
      <td class="text-muted">${a.description?.slice(0, 100) ?? "—"}</td>
      <td style="font-size:12px;">${a.actionSuggestion?.slice(0, 80) ?? "—"}</td>
      <td class="text-muted">${a.createdAt ? new Date(a.createdAt).toLocaleDateString("es-ES") : "—"}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${competitors.length}</div><div class="label">Competidores</div></div>
      <div class="metric"><div class="value">${competitors.filter(c => c.active).length}</div><div class="label">Monitoreados</div></div>
      <div class="metric"><div class="value">${alerts.filter(a => !a.dismissed).length}</div><div class="label">Alertas activas</div></div>
    </div>
    <div class="section">
      <div class="section-title">Competidores Monitoreados</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Nombre</th><th>URL</th><th>Tipo</th><th>Productos</th><th>Rango precios</th><th>Mediana</th><th>Escaneado</th></tr></thead>
          <tbody>${compRows || '<tr><td colspan="7" class="text-muted">No hay competidores registrados</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    ${alertRows ? `<div class="section">
      <div class="section-title">Alertas Competitivas</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Severidad</th><th>Alerta</th><th>Descripción</th><th>Acción sugerida</th><th>Fecha</th></tr></thead>
          <tbody>${alertRows}</tbody>
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
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo de fondo</p><p>${vd.backgroundStyle || "No analizado"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Iluminación</p><p>${vd.lightingStyle || "No analizado"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Temperatura color</p><p>${vd.colorTemp || "No analizado"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Composición</p><p>${vd.composition || "No analizado"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Mood</p><p>${vd.mood || "No analizado"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Presencia humana</p><p>${vd.humanPresence || "No analizado"}</p></div>
      </div>
      ${vd.brandColors?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Colores de marca</p><div style="display:flex;gap:8px;flex-wrap:wrap;">${vd.brandColors.map(c => `<div style="display:flex;align-items:center;gap:6px;"><div style="width:24px;height:24px;border-radius:6px;background:${c};border:1px solid ${BRAND.border};"></div><span style="font-size:12px;">${c}</span></div>`).join("")}</div></div>` : ""}
      ${vd.props?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Props/Accesorios</p><div>${vd.props.map(p => `<span class="tag">${p}</span>`).join(" ")}</div></div>` : ""}`;
  }

  let brandDetails = "";
  if (bd) {
    brandDetails = `
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo tipográfico</p><p>${bd.typographyStyle || "—"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Patrón de layout</p><p>${bd.layoutPattern || "—"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Densidad visual</p><p>${bd.visualDensity || "—"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Personalidad de marca</p><p>${bd.brandPersonality || "—"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Posición competitiva</p><p>${bd.competitivePosition || "—"}</p></div>
        <div><p class="text-muted" style="font-size:11px;text-transform:uppercase;">Estilo fotográfico</p><p>${bd.photographyStyle || "—"}</p></div>
      </div>
      ${bd.valuePropositions?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Propuestas de valor</p><div>${bd.valuePropositions.map(v => `<span class="tag">${v}</span>`).join(" ")}</div></div>` : ""}
      ${bd.urgencyTactics?.length ? `<div class="card"><p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Tácticas de urgencia</p><div>${bd.urgencyTactics.map(t => `<span class="tag">${t}</span>`).join(" ")}</div></div>` : ""}`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${(avgConsistency * 100).toFixed(0)}%</div><div class="label">Consistencia visual</div></div>
      <div class="metric"><div class="value">${products.length}</div><div class="label">Productos analizados</div></div>
    </div>
    <div class="section">
      <div class="section-title">ADN Visual</div>
      ${dnaDetails || '<div class="card text-muted">Sin análisis visual. Ejecuta un análisis de consistencia desde la página Consistencia.</div>'}
    </div>
    <div class="section">
      <div class="section-title">ADN de Marca</div>
      ${brandDetails || '<div class="card text-muted">Sin ADN de marca extraído. Usa la herramienta de Intelligence para extraer el ADN.</div>'}
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
    invRows += `<tr>
      <td style="font-weight:500;">${i.productTitle || i.productId}</td>
      <td>${i.currentStock ?? "—"}</td>
      <td>${i.avgDailySales?.toFixed(1) ?? "—"}</td>
      <td><span style="color:${statusColor};font-weight:600;">${i.daysRemaining != null ? `${i.daysRemaining} días` : "—"}</span></td>
      <td><span style="color:${statusColor};font-weight:600;text-transform:uppercase;">${i.status || "ok"}</span></td>
      <td class="text-muted">${i.supplierEmail || "—"}</td>
      <td>${i.supplierLeadDays ?? "—"} días</td>
    </tr>`;
  }

  let restockRows = "";
  for (const r of restocks.slice(0, 15)) {
    restockRows += `<tr>
      <td style="font-weight:500;">${r.productTitle || r.productId || "—"}</td>
      <td>${r.quantitySuggested ?? "—"}</td>
      <td><span class="tag">${r.urgency || "normal"}</span></td>
      <td>${r.adminApproved ? "✅ Aprobado" : "⏳ Pendiente"}</td>
      <td class="text-muted">${r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-ES") : "—"}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${inventory.length}</div><div class="label">Productos rastreados</div></div>
      <div class="metric"><div class="value">${totalStock}</div><div class="label">Stock total</div></div>
      <div class="metric"><div class="value" style="color:${BRAND.red}">${critical.length}</div><div class="label">Stock crítico</div></div>
      <div class="metric"><div class="value" style="color:#ffa500">${lowStock.length}</div><div class="label">Stock bajo</div></div>
    </div>
    <div class="section">
      <div class="section-title">Estado del Inventario</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Stock</th><th>Ventas/día</th><th>Días restantes</th><th>Estado</th><th>Proveedor</th><th>Lead time</th></tr></thead>
          <tbody>${invRows || '<tr><td colspan="7" class="text-muted">Sin datos de inventario</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    ${restockRows ? `<div class="section">
      <div class="section-title">Órdenes de Reposición</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Urgencia</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${restockRows}</tbody>
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
    rows += `<tr>
      <td style="font-weight:500;">${product?.title || r.shopifyProductId || "Desconocido"}</td>
      <td>${r.newTitle?.slice(0, 50) ?? "—"}${(r.newTitle?.length ?? 0) > 50 ? "…" : ""}</td>
      <td>${r.recommendedPrice != null ? `${r.recommendedPrice}€` : "—"}</td>
      <td>${r.appliedAt ? `<span class="text-jade">Aplicado</span>` : '<span class="text-muted">Pendiente</span>'}</td>
      <td class="text-muted">${r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-ES") : "—"}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${redesigns.length}</div><div class="label">Rediseños generados</div></div>
      <div class="metric"><div class="value">${applied.length}</div><div class="label">Aplicados a Shopify</div></div>
      <div class="metric"><div class="value">${redesigns.length - applied.length}</div><div class="label">Pendientes</div></div>
    </div>
    <div class="section">
      <div class="section-title">Historial de Rediseños IA</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Producto original</th><th>Nuevo título propuesto</th><th>Precio recomendado</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="text-muted">No hay rediseños generados</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    ${redesigns.length > 0 && redesigns[0].newDescription ? `<div class="section">
      <div class="section-title">Ejemplo de Rediseño Más Reciente</div>
      <div class="card">
        <p class="text-muted" style="font-size:11px;text-transform:uppercase;margin-bottom:8px;">Producto: ${productMap.get(redesigns[0].shopifyProductId ?? "")?.title || "—"}</p>
        <p style="font-size:16px;font-weight:600;color:${BRAND.gold};margin-bottom:12px;">${redesigns[0].newTitle || "—"}</p>
        <div class="blog-content" style="font-size:13px;">${redesigns[0].newDescription?.slice(0, 500) ?? ""}${(redesigns[0].newDescription?.length ?? 0) > 500 ? "..." : ""}</div>
        ${redesigns[0].tags ? `<div style="margin-top:12px;">${(redesigns[0].tags as any)?.slice?.(0, 10)?.map?.((t: string) => `<span class="tag">${t}</span>`)?.join(" ") ?? ""}</div>` : ""}
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
    snapRows += `<tr>
      <td>${s.date}</td>
      <td style="font-weight:500;">${s.revenue?.toFixed(2) ?? "—"}€</td>
      <td>${s.orders ?? "—"}</td>
      <td>${s.aov?.toFixed(2) ?? "—"}€</td>
      <td>${s.conversionRate != null ? `${(s.conversionRate * 100).toFixed(2)}%` : "—"}</td>
      <td>${s.grossMargin != null ? `<span class="${s.grossMargin > 30 ? "text-jade" : "text-red"}">${s.grossMargin.toFixed(1)}%</span>` : "—"}</td>
    </tr>`;
  }

  let forecastRows = "";
  for (const f of forecasts) {
    forecastRows += `<tr>
      <td>${f.forecastDate || "—"}</td>
      <td><span class="tag">${f.forecastType || "general"}</span></td>
      <td style="font-weight:500;">${f.predictedValue?.toFixed(2) ?? "—"}€</td>
      <td>${f.confidenceLow?.toFixed(0) ?? "—"}€ – ${f.confidenceHigh?.toFixed(0) ?? "—"}€</td>
      <td>${f.confidencePct ?? "—"}%</td>
      <td class="text-muted" style="font-size:11px;">${f.reasoning?.slice(0, 60) ?? "—"}</td>
    </tr>`;
  }

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${totalRevenue.toFixed(0)}€</div><div class="label">Revenue total</div></div>
      <div class="metric"><div class="value">${totalOrders}</div><div class="label">Pedidos</div></div>
      <div class="metric"><div class="value">${avgAov.toFixed(2)}€</div><div class="label">AOV medio</div></div>
      <div class="metric"><div class="value">${avgMargin.toFixed(1)}%</div><div class="label">Margen bruto</div></div>
    </div>
    <div class="section">
      <div class="section-title">Snapshots de Revenue</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Revenue</th><th>Pedidos</th><th>AOV</th><th>Conversión</th><th>Margen</th></tr></thead>
          <tbody>${snapRows || '<tr><td colspan="6" class="text-muted">Sin datos de revenue aún</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    ${forecastRows ? `<div class="section">
      <div class="section-title">Predicciones / Forecast</div>
      <div class="card" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Predicción</th><th>Rango confianza</th><th>Confianza</th><th>Razonamiento</th></tr></thead>
          <tbody>${forecastRows}</tbody>
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
    domainRows += `<tr>
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
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${BRAND.border};"><span>${type}</span><span class="text-gold" style="font-weight:600;">${count}</span></div>`
  ).join("");

  let topInsights = "";
  for (const i of insights.slice(0, 10)) {
    topInsights += `<div class="recommendation">
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

export default router;
