import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { projectFilesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { buildProductCardsSection, type ProductCardData } from "../lib/product-card.js";
import archiver from "archiver";

const router = Router();

const BRAND = {
  gold: "#c8a84b", goldLight: "#e6d9a8", goldDark: "#8b6914",
  dark: "#08080e", darkAlt: "#0c0c14", card: "#101018", cardHover: "#141420",
  surface: "#16161f", muted: "#6b6b80", mutedLight: "#9494a8",
  jade: "#34d399", jadeBg: "rgba(52,211,153,.08)",
  red: "#f43f5e", redBg: "rgba(244,63,94,.08)",
  orange: "#f59e0b", orangeBg: "rgba(245,158,11,.08)",
  blue: "#3b82f6", blueBg: "rgba(59,130,246,.08)",
  white: "#f0f0f5", border: "#1a1a28", borderLight: "#24243a",
};

function extractMetricBlocks(text: string): { metrics: Array<{ value: string; label: string }>; cleanText: string } {
  const metrics: Array<{ value: string; label: string }> = [];
  const metricPatterns = [
    /(\d+[\.,]?\d*)\s*(?:productos?|items?)/gi,
    /(?:score|puntuaci[oó]n)[:\s]*(\d+)\/100/gi,
    /(?:grade|grado)[:\s]*([A-F][+\-]?)/gi,
    /(\d+[\.,]?\d*)\s*€/g,
    /(\d+[\.,]?\d*)\s*%/g,
  ];

  const lines = text.split('\n');
  for (const line of lines) {
    const scoreMatch = line.match(/(?:score|puntuaci[oó]n|nota)[:\s]*(\d+)(?:\/100)?/i);
    if (scoreMatch) metrics.push({ value: scoreMatch[1] + "/100", label: "Score" });
    const gradeMatch = line.match(/(?:grade|grado|calificaci[oó]n)[:\s]*([A-F][+\-]?)/i);
    if (gradeMatch) metrics.push({ value: gradeMatch[1], label: "Grade" });
    const prodMatch = line.match(/(\d+)\s*productos?\s*(?:activos?|totales?|analizados?|auditados?)/i);
    if (prodMatch) metrics.push({ value: prodMatch[1], label: "Productos" });
    const revenueMatch = line.match(/(?:revenue|ingresos?|facturaci[oó]n)[:\s]*(\d+[\.,]?\d*)\s*€/i);
    if (revenueMatch) metrics.push({ value: revenueMatch[1] + "€", label: "Revenue" });
    const marginMatch = line.match(/(?:margen|margin)[:\s]*(\d+[\.,]?\d*)\s*%/i);
    if (marginMatch) metrics.push({ value: marginMatch[1] + "%", label: "Margen" });
  }

  const unique = metrics.filter((m, i, a) => a.findIndex(x => x.label === m.label) === i).slice(0, 6);
  return { metrics: unique, cleanText: text };
}

function extractProductCards(rawData: unknown): string {
  if (!rawData || typeof rawData !== "object") return "";
  const d = rawData as Record<string, unknown>;
  const products = d.products as Array<Record<string, unknown>> | undefined;
  if (!products || !Array.isArray(products) || products.length === 0) return "";

  const cards: ProductCardData[] = products.map(p => ({
    title: String(p.title || ""),
    status: String(p.status || "unknown"),
    price: String(p.price || "0"),
    compareAtPrice: p.compareAtPrice as string | null,
    imageUrl: (p.imageUrl as string) || null,
    imageCount: (p.imageCount as number) ?? 0,
    descriptionLength: (p.descriptionLength as number) ?? (p.descLength as number) ?? 0,
    tagsCount: (p.tagsCount as number) ?? 0,
    variantCount: (p.variantCount as number) ?? 1,
    published: !!p.published,
    auditScore: (p.auditScore as number) ?? (p.score as number) ?? 0,
    auditGrade: String(p.auditGrade || p.grade || "D"),
    hasComparePrice: !!(p.hasComparePrice ?? p.hasCompare),
    hasMetaTitle: p.hasMetaTitle !== undefined ? !!p.hasMetaTitle : undefined,
    hasMetaDesc: p.hasMetaDesc !== undefined ? !!p.hasMetaDesc : undefined,
    hasSchema: p.hasSchema !== undefined ? !!p.hasSchema : undefined,
    hasAltTexts: p.hasAltTexts !== undefined ? !!p.hasAltTexts : undefined,
    cleanHandle: p.cleanHandle !== undefined ? !!p.cleanHandle : undefined,
    issues: (p.issues as string[]) || undefined,
  }));

  return buildProductCardsSection(cards, `Productos (${cards.length})`);
}

function buildProfessionalHtml(title: string, content: string, actionName: string, rawData?: unknown): string {
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const year = new Date().getFullYear();

  const { metrics } = extractMetricBlocks(content);

  const sections: Array<{ heading: string; body: string }> = [];
  const lines = content.split('\n');
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const hMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (hMatch) {
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n') });
      }
      currentHeading = hMatch[1];
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n') });
  }

  function mdToHtml(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.gold};font-weight:700;">$1</strong>`)
      .replace(/^[-•]\s+(.+)$/gm, (_, item) => `<div style="display:flex;align-items:flex-start;gap:10px;margin:6px 0;padding:8px 14px;background:${BRAND.surface};border-radius:8px;border:1px solid ${BRAND.border};"><span style="color:${BRAND.gold};font-size:16px;line-height:1;margin-top:1px;">&#8250;</span><span style="color:${BRAND.white};font-size:13px;line-height:1.7;">${item}</span></div>`)
      .replace(/^(\d+)\.\s+(.+)$/gm, (_, num, item) => `<div style="display:flex;align-items:flex-start;gap:12px;margin:8px 0;padding:10px 16px;background:${BRAND.surface};border-radius:10px;border:1px solid ${BRAND.border};border-left:3px solid ${BRAND.gold};"><span style="width:28px;height:28px;flex-shrink:0;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${BRAND.gold};">${num}</span><span style="color:${BRAND.white};font-size:13px;line-height:1.7;">${item}</span></div>`)
      .replace(/✅/g, `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:${BRAND.jadeBg};border:1px solid rgba(52,211,153,.2);border-radius:5px;font-size:12px;color:${BRAND.jade};">&#10003;</span>`)
      .replace(/❌/g, `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:${BRAND.redBg};border:1px solid rgba(244,63,94,.2);border-radius:5px;font-size:12px;color:${BRAND.red};">&#10007;</span>`)
      .replace(/⚠️/g, `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:${BRAND.orangeBg};border:1px solid rgba(245,158,11,.2);border-radius:5px;font-size:12px;color:${BRAND.orange};">&#9888;</span>`)
      .replace(/📦|📊|🏪|🔑|📝|📁|📢|🛒|🆔|💰|🎯|📈|🔍|🧠|⚡|🚀|💡|🎨|📋|🔗|📌|🏷️|💎|🌟|📉|🔄|📅|🗂️|🤖|🛡️|🎪|💼/g, (m) => `<span>${m}</span>`)
      .replace(/\n{2,}/g, `</p><p style="margin:12px 0;color:${BRAND.white};font-size:14px;line-height:1.8;">`)
      .replace(/\n/g, '<br>');
  }

  const sectionIcons = ["&#9733;", "&#128200;", "&#128270;", "&#128176;", "&#127912;", "&#9879;", "&#128202;", "&#128161;", "&#129504;", "&#128203;"];
  const sectionColors = ["section-icon-gold", "section-icon-jade", "section-icon-blue", "section-icon-orange", "section-icon-gold", "section-icon-blue", "section-icon-jade", "section-icon-gold", "section-icon-blue", "section-icon-orange"];

  let bodyHtml = "";

  if (metrics.length > 0) {
    let metricCards = "";
    for (const m of metrics) {
      const isGrade = /^[A-F][+\-]?$/.test(m.value);
      const gradeClass = isGrade ? (m.value.startsWith("A") ? `color:${BRAND.jade}` : m.value.startsWith("B") ? `color:${BRAND.gold}` : m.value.startsWith("C") ? `color:${BRAND.orange}` : `color:${BRAND.red}`) : `color:${BRAND.gold}`;
      metricCards += `<div style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;text-align:center;position:relative;overflow:hidden;flex:1;min-width:120px;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${BRAND.gold}33,transparent);"></div>
        <div style="font-size:28px;font-weight:900;${gradeClass};letter-spacing:-0.5px;line-height:1.1;">${sanitizeHtml(m.value)}</div>
        <div style="font-size:10px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:1px;margin-top:6px;font-weight:600;">${sanitizeHtml(m.label)}</div>
      </div>`;
    }
    bodyHtml += `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">${metricCards}</div>`;
  }

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const icon = sectionIcons[i % sectionIcons.length];
    const colorClass = sectionColors[i % sectionColors.length];
    const iconBg = colorClass === "section-icon-gold" ? "rgba(200,168,75,.1)" :
      colorClass === "section-icon-jade" ? BRAND.jadeBg :
      colorClass === "section-icon-blue" ? BRAND.blueBg : BRAND.orangeBg;
    const iconBorder = colorClass === "section-icon-gold" ? "rgba(200,168,75,.2)" :
      colorClass === "section-icon-jade" ? "rgba(52,211,153,.2)" :
      colorClass === "section-icon-blue" ? "rgba(59,130,246,.2)" : "rgba(245,158,11,.2)";

    if (s.heading) {
      bodyHtml += `<div style="margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid ${BRAND.border};">
          <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:${iconBg};border:1px solid ${iconBorder};">${icon}</div>
          <div style="font-size:18px;font-weight:700;color:${BRAND.white};letter-spacing:-0.3px;">${sanitizeHtml(s.heading)}</div>
        </div>
        <div style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:24px;">
          <p style="margin:0;color:${BRAND.white};font-size:14px;line-height:1.8;">${mdToHtml(s.body.trim())}</p>
        </div>
      </div>`;
    } else if (s.body.trim()) {
      bodyHtml += `<div style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:24px;margin-bottom:24px;">
        <p style="margin:0;color:${BRAND.white};font-size:14px;line-height:1.8;">${mdToHtml(s.body.trim())}</p>
      </div>`;
    }
  }

  const productCardsHtml = extractProductCards(rawData);
  if (productCardsHtml) {
    bodyHtml += productCardsHtml;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sanitizeHtml(title)} — Shopy Crafter</title>
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
  .footer { padding: 32px 56px; border-top: 1px solid ${BRAND.border}; background: ${BRAND.darkAlt}; text-align: center; }
  .footer-brand { font-size: 14px; font-weight: 700; color: ${BRAND.gold}; }
  .footer-sub { font-size: 11px; color: ${BRAND.muted}; margin-top: 6px; }
  .footer-line { width: 40px; height: 2px; background: ${BRAND.gold}; margin: 12px auto; border-radius: 1px; }
  @media print {
    body { background: white; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
    .cover { background: #f8f7f4; padding: 32px; }
    .cover-title h1 { color: #1a1a1a; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <div class="cover-top">
      <div class="cover-logo">
        <div class="cover-logo-icon">SC</div>
        <div class="cover-logo-text">Shopy Crafter</div>
      </div>
      <div class="cover-badge">
        <div class="cover-badge-label">Documento</div>
        <div class="cover-badge-value">${safeTag(actionName)}</div>
      </div>
    </div>
    <div class="cover-title">
      <h1>${sanitizeHtml(title)}</h1>
      <div class="subtitle">Generado por ShopyBrain AI Engine</div>
    </div>
    <div class="cover-meta">
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>${safeTag(actionName)}</div>
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>${safeTag(date)} &middot; ${safeTag(time)}</div>
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>Shopy Crafter AI</div>
    </div>
  </div>
  <div class="body-content">
    ${bodyHtml}
  </div>
  <div class="footer">
    <div class="footer-line"></div>
    <div class="footer-brand">Shopy Crafter</div>
    <div class="footer-sub">ShopyBrain AI Engine &mdash; shopycrafter.com</div>
    <div class="footer-sub">&copy; ${year} Shopy Crafter. Todos los derechos reservados.</div>
    <div class="footer-sub" style="margin-top:4px;">DOCUMENTO CONFIDENCIAL</div>
  </div>
</div>
</body>
</html>`;
}

function safeTag(s: string): string {
  return sanitizeHtml(s);
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    store_status: "Estado de la Tienda",
    list_products: "Listado de Productos",
    audit_store: "Auditoría de Tienda",
    optimize_product: "Optimización de Producto",
    create_product: "Creación de Producto",
    edit_product: "Edición de Producto",
    search_suppliers: "Investigación de Proveedores",
    generate_proposal: "Propuesta Comercial",
    generate_budget: "Presupuesto",
    generate_email: "Email Profesional",
    seo_audit: "Auditoría SEO",
    financial_forecast: "Forecast Financiero",
    revenue_analysis: "Análisis de Revenue",
    competitor_scan: "Escaneo de Competidores",
    inventory_sync: "Sincronización de Inventario",
    inventory_alerts: "Alertas de Inventario",
    brand_brief: "Brand Brief",
    ab_test: "Test A/B",
    redesign_product: "Rediseño de Producto",
    bulk_optimize: "Optimización Masiva",
    analyze_external_store: "Análisis de Tienda Externa",
    keyword_research: "Investigación de Keywords",
    blog_strategy: "Estrategia de Blog",
    write_blog_post: "Artículo de Blog",
    setup_store: "Configuración de Tienda",
    price_optimization: "Optimización de Precios",
    full_audit: "Auditoría Completa",
  };
  return labels[action] || action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

router.post("/projects/:projectId/actions/send", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const { actionName, title, content, recipientEmail, rawData } = req.body as {
    actionName: string; title: string; content: string; recipientEmail?: string; rawData?: unknown;
  };

  if (!actionName || !content) {
    res.status(400).json({ error: "Se requiere actionName y content" });
    return;
  }

  if (!isGmailAvailable()) {
    res.status(503).json({ error: "Gmail no configurado. Configura la integración de Google Mail." });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const projectName = project?.name || "Proyecto";

  const label = actionLabel(actionName);
  const emailTitle = title || `${label} — ${projectName}`;
  const htmlBody = buildProfessionalHtml(emailTitle, content, label, rawData);

  const to = recipientEmail || "sadiagiljoan@gmail.com";
  const subject = `📊 ${emailTitle} | Shopy Crafter`;

  const sent = await sendEmail(to, subject, htmlBody);
  if (sent) {
    logger.info({ projectId, actionName, to }, "Action result sent via Gmail");
    res.json({ success: true, message: `Enviado a ${to}`, to, subject: emailTitle });
  } else {
    res.status(500).json({ error: "Error al enviar el email. Intenta de nuevo." });
  }
});

router.post("/projects/:projectId/actions/save", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const { actionName, title, content, rawData } = req.body as {
    actionName: string; title: string; content: string; rawData?: unknown;
  };

  if (!actionName || !content) {
    res.status(400).json({ error: "Se requiere actionName y content" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const label = actionLabel(actionName);
  const reportTitle = title || `${label} — ${project.name}`;
  const htmlContent = buildProfessionalHtml(reportTitle, content, label, rawData);

  const fileId = await saveToVault({
    projectId,
    fileType: "report",
    category: `chatbot_${actionName}`,
    title: reportTitle,
    description: `Resultado guardado desde chatbot: ${label}`,
    mimeType: "text/html",
    fileSizeBytes: Buffer.from(htmlContent).length,
    generatedBy: "chatbot_action_save",
    content: htmlContent,
    metadata: {
      actionName,
      savedAt: new Date().toISOString(),
      hasRawData: !!rawData,
    },
  });

  if (rawData) {
    const jsonContent = JSON.stringify(rawData, null, 2);
    await saveToVault({
      projectId,
      fileType: "data",
      category: `chatbot_${actionName}_data`,
      title: `${reportTitle} — Datos`,
      description: `Datos JSON del resultado: ${label}`,
      mimeType: "application/json",
      fileSizeBytes: Buffer.from(jsonContent).length,
      generatedBy: "chatbot_action_save",
      content: jsonContent,
      metadata: { actionName, savedAt: new Date().toISOString() },
    });
  }

  logger.info({ projectId, actionName, fileId }, "Action result saved to vault");
  res.json({ success: true, message: "Guardado en el vault del proyecto", fileId });
});

router.post("/projects/:projectId/actions/download", async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId), 10);
  const { actionName, title, content, rawData, downloadType } = req.body as {
    actionName: string; title: string; content: string; rawData?: unknown; downloadType?: "pdf" | "zip";
  };

  if (!actionName || !content) {
    res.status(400).json({ error: "Se requiere actionName y content" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const projectName = project?.name || "Proyecto";

  const label = actionLabel(actionName);
  const reportTitle = title || `${label} — ${projectName}`;
  const htmlContent = buildProfessionalHtml(reportTitle, content, label, rawData);
  const safeName = reportTitle.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").replace(/\s+/g, "_").slice(0, 80);
  const dateStr = new Date().toISOString().split("T")[0];

  if (downloadType === "zip") {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${dateStr}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err: any) => {
      logger.error({ err, projectId }, "ZIP archive error");
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);

    archive.append(htmlContent, { name: `${safeName}.html` });

    if (rawData) {
      archive.append(JSON.stringify(rawData, null, 2), { name: `${safeName}_datos.json` });
    }

    const baseUrl = `http://localhost:${process.env.PORT || 8080}/api/projects/${projectId}/exports`;
    const cookieHeader = req.headers.cookie || "";
    const fetchOpts = { headers: { Cookie: cookieHeader }, signal: AbortSignal.timeout(15000) };
    const reportEndpoints = [
      { name: "Informe_Completo", path: "complete-report" },
      { name: "SEO_Audit", path: "seo-audit" },
      { name: "Catalogo_Productos", path: "product-catalog" },
      { name: "Informe_Financiero", path: "financial" },
      { name: "Brand_Brief", path: "brand-brief" },
      { name: "Competidores", path: "competitors" },
      { name: "Consistencia_BrandDNA", path: "consistency" },
      { name: "Inventario", path: "inventory" },
      { name: "Revenue_Forecast", path: "revenue" },
      { name: "ShopyBrain_Intel", path: "shopybrain" },
    ];

    for (const rpt of reportEndpoints) {
      try {
        const response = await fetch(`${baseUrl}/${rpt.path}`, fetchOpts);
        if (response.ok) {
          const html = await response.text();
          archive.append(html, { name: `informes/${rpt.name}_${dateStr}.html` });
        }
      } catch {}
    }

    try {
      const csvRes = await fetch(`${baseUrl}/csv/products`, fetchOpts);
      if (csvRes.ok) {
        const csv = await csvRes.text();
        archive.append(csv, { name: `datos/Productos_${dateStr}.csv` });
      }
    } catch {}

    try {
      const jsonRes = await fetch(`${baseUrl}/json/full`, fetchOpts);
      if (jsonRes.ok) {
        const json = await jsonRes.text();
        archive.append(json, { name: `datos/Exportacion_Completa_${dateStr}.json` });
      }
    } catch {}

    const vaultImages = await db.select().from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        eq(projectFilesTable.fileType, "image"),
      ));

    for (const img of vaultImages) {
      if (img.originalUrl) {
        try {
          const imgRes = await fetch(img.originalUrl, { signal: AbortSignal.timeout(10000) });
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const ext = img.mimeType?.includes("png") ? "png" : img.mimeType?.includes("webp") ? "webp" : "jpg";
            const imgName = (img.productTitle || img.title || `imagen_${img.id}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
            archive.append(buffer, { name: `imagenes/${imgName}.${ext}` });
          }
        } catch {}
      }
    }

    archive.append(`# Exportación Completa — ${projectName}
Fecha: ${dateStr}
Generado por: Shopy Crafter (ShopyBrain AI)

## Contenido
- Resultado del chatbot: ${label}
- ${reportEndpoints.length} informes HTML profesionales
- Datos en CSV y JSON
- Imágenes generadas por IA
- Abrir archivos .html en navegador → Ctrl+P para convertir a PDF
`, { name: "LEEME.txt" });

    await archive.finalize();
    logger.info({ projectId, actionName, type: "zip" }, "Full ZIP download generated");
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_${dateStr}.html"`);
    res.send(htmlContent);
    logger.info({ projectId, actionName, type: "html" }, "HTML download generated");
  }
});

export default router;
