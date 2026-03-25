import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, seoDataTable } from "@workspace/db";
import { cogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { priceHistoryTable } from "@workspace/db/schema";
import { abTestsTable } from "@workspace/db/schema";
import { redesignsTable } from "@workspace/db/schema";
import { generationJobsTable } from "@workspace/db/schema";
import { omnicoreMemoriesTable } from "@workspace/db/schema";

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

export default router;
