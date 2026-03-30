import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { projectFilesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import archiver from "archiver";

const router = Router();

const BRAND = {
  gold: "#c8a84b", goldLight: "#e6d9a8", goldDark: "#8b6914",
  dark: "#08080e", darkAlt: "#0c0c14", card: "#101018",
  surface: "#16161f", muted: "#6b6b80", mutedLight: "#9494a8",
  jade: "#34d399", white: "#f0f0f5", border: "#1a1a28", borderLight: "#24243a",
};

function buildProfessionalHtml(title: string, content: string, actionName: string): string {
  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const contentHtml = content
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.gold};font-weight:700;">$1</strong>`)
    .replace(/^#{1,3}\s+(.+)$/gm, `<h3 style="color:${BRAND.gold};margin:18px 0 8px;font-size:16px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">$1</h3>`)
    .replace(/^[-•]\s+(.+)$/gm, `<li style="margin:3px 0;color:${BRAND.white};font-size:14px;">$1</li>`)
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0;">$&</ul>')
    .replace(/^(\d+)\.\s+(.+)$/gm, `<div style="margin:4px 0;color:${BRAND.white};font-size:14px;"><span style="color:${BRAND.gold};font-weight:700;">$1.</span> $2</div>`)
    .replace(/✅/g, '<span style="color:#34d399;">&#10003;</span>')
    .replace(/❌/g, '<span style="color:#f43f5e;">&#10007;</span>')
    .replace(/⚠️/g, '<span style="color:#f59e0b;">&#9888;</span>')
    .replace(/📦|📊|🏪|🔑|📝|📁|📢|🛒|🆔|💰|🎯|📈|🔍|🧠|⚡|🚀|💡|🎨|📋|🔗|📌|🏷️|💎|🌟|📉|🔄|📅|🗂️|🤖|🛡️|🎪|💼/g, (m) => `<span>${m}</span>`)
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sanitizeHtml(title)} — Shopy Crafter</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.dark};font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.dark};padding:24px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="background:${BRAND.darkAlt};border-radius:16px;overflow:hidden;">

<!-- HEADER -->
<tr><td style="background:linear-gradient(160deg,#0e0e18,#12121f,#0a0a14);padding:40px 48px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="44" valign="top">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,${BRAND.gold},${BRAND.goldDark});border-radius:9px;text-align:center;line-height:36px;font-size:18px;font-weight:900;color:#0a0a0f;">S</div>
      </td>
      <td style="padding-left:12px;" valign="middle">
        <span style="font-size:18px;font-weight:800;color:${BRAND.gold};letter-spacing:-0.3px;">Shopy Crafter</span>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr><td>
      <h1 style="font-size:24px;font-weight:900;color:${BRAND.white};letter-spacing:-0.5px;line-height:1.2;margin:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">${sanitizeHtml(title)}</h1>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    <tr>
      <td><span style="font-size:11px;color:${BRAND.muted};">&#9679; ${safeTag(actionName)}</span></td>
      <td><span style="font-size:11px;color:${BRAND.muted};">&#9679; ${safeTag(date)} &middot; ${safeTag(time)}</span></td>
      <td><span style="font-size:11px;color:${BRAND.muted};">&#9679; Shopy Crafter AI</span></td>
    </tr>
  </table>
</td></tr>

<!-- CONTENT -->
<tr><td style="padding:32px 48px 40px;">
  <div style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:28px;line-height:1.7;font-size:14px;color:${BRAND.white};">
    ${contentHtml}
  </div>
</td></tr>

<!-- FOOTER -->
<tr><td style="text-align:center;padding:24px 48px;border-top:1px solid ${BRAND.border};">
  <p style="color:${BRAND.muted};font-size:11px;margin:0;">
    Generado por <a href="https://shopycrafter.com" style="color:${BRAND.gold};text-decoration:none;">Shopy Crafter</a> &mdash; Shopy Crafter AI Engine
  </p>
  <p style="color:${BRAND.muted};font-size:11px;margin:4px 0 0;">
    &copy; ${new Date().getFullYear()} Shopy Crafter. Todos los derechos reservados.
  </p>
</td></tr>

</table>
</td></tr>
</table>
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
  const { actionName, title, content, recipientEmail } = req.body as {
    actionName: string; title: string; content: string; recipientEmail?: string;
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
  const htmlBody = buildProfessionalHtml(emailTitle, content, label);

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
  const htmlContent = buildProfessionalHtml(reportTitle, content, label);

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
  const htmlContent = buildProfessionalHtml(reportTitle, content, label);
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
