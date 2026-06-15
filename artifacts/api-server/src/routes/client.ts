import { Router } from "express";
import { randomBytes } from "crypto";
import { db, approvalsTable, messagesTable, productsTable, auditLogTable, projectFilesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import { logger } from "../lib/logger.js";
import { askClaude } from "../lib/claude.js";
import { sendPushToAdmins } from "../lib/push-helper.js";

const router = Router();
router.use(requireAuth);

function getClientProjectId(req: import("express").Request): string {
  if (req.session.clientId) return String(req.session.clientId);
  if (req.session.role === "admin" && req.query.pid) return String(req.query.pid);
  return "";
}

router.get("/dashboard", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  
    const products = await db.select({
      id: productsTable.id,
      title: productsTable.title,
      auditScore: productsTable.auditScore,
      price: productsTable.price,
    }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));
  
    const scored = products.filter((p) => p.auditScore !== null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
      : null;
  
    const pendingApprovals = await db.select({ id: approvalsTable.id })
      .from(approvalsTable)
      .where(and(eq(approvalsTable.projectId, projectId), eq(approvalsTable.status, "pending")));
  
    const recentActivity = await db.select().from(auditLogTable)
      .where(eq(auditLogTable.projectId, projectId))
      .orderBy(desc(auditLogTable.createdAt)).limit(20);
  
    res.json({
      totalProducts: products.length,
      avgScore,
      pendingApprovals: pendingApprovals.length,
      recentActivity,
      enginesActive: 6,
      lastOptimized: recentActivity[0]?.createdAt ?? null,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/approvals", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const items = await db.select().from(approvalsTable)
      .where(eq(approvalsTable.projectId, projectId))
      .orderBy(desc(approvalsTable.createdAt));
    res.json(items);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/approvals/:id/approve", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const [item] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, req.params["id"]!));
    if (!item || item.projectId !== projectId) { res.status(403).json({ error: "Access denied" }); return; }
  
    await db.update(approvalsTable).set({ status: "approved", reviewedAt: new Date() })
      .where(eq(approvalsTable.id, req.params["id"]!));
  
    await db.insert(auditLogTable).values({
      id: randomBytes(8).toString("hex"),
      userId: req.session.userId!,
      projectId,
      action: "approve_item",
      details: `Approved: ${item.title}`,
    });
  
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/approvals/:id/reject", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const [item] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, req.params["id"]!));
    if (!item || item.projectId !== projectId) { res.status(403).json({ error: "Access denied" }); return; }
  
    const { comment } = req.body as { comment?: string };
    await db.update(approvalsTable).set({
      status: "rejected", reviewedAt: new Date(), clientComment: comment,
    }).where(eq(approvalsTable.id, req.params["id"]!));
  
    await db.insert(auditLogTable).values({
      id: randomBytes(8).toString("hex"),
      userId: req.session.userId!,
      projectId,
      action: "reject_item",
      details: `Rejected: ${item.title}. Comment: ${comment ?? ""}`,
    });
  
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/messages", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.projectId, projectId))
      .orderBy(messagesTable.createdAt);
  
    await db.update(messagesTable).set({ isRead: 1 })
      .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.fromRole, "admin")));
  
    res.json(msgs);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/messages", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const { content } = req.body as { content: string };
    const id = randomBytes(16).toString("hex");
    const clientName = req.session.name ?? "Cliente";
    await db.insert(messagesTable).values({
      id, projectId, fromRole: "client", fromName: clientName, content,
    });
    sendPushToAdmins(
      `💬 Nuevo mensaje de ${clientName}`,
      content.length > 80 ? content.slice(0, 77) + "…" : content,
      "/admin/clients"
    ).catch(() => {});
    res.json({ id });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/unread-count", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.json({ count: 0 }); return; }
    const rows = await db.select({ count: messagesTable.id })
      .from(messagesTable)
      .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.fromRole, "admin"), eq(messagesTable.isRead, 0)));
    res.json({ count: rows.length });
  } catch {
    res.json({ count: 0 });
  }
});

router.get("/reports", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
  
    const products = await db.select({
      id: productsTable.id,
      title: productsTable.title,
      auditScore: productsTable.auditScore,
      imagesJson: productsTable.imagesJson,
    }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));
  
    const scored = products.filter((p) => p.auditScore !== null);
    const avgSeoScore = scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
      : null;
  
    let imagesGenerated = 0;
    for (const p of products) {
      try {
        const imgs = p.imagesJson ? (typeof p.imagesJson === "string" ? JSON.parse(p.imagesJson) : p.imagesJson) : [];
        imagesGenerated += Array.isArray(imgs) ? imgs.length : 0;
      } catch {}
    }
  
    const recentActivity = await db.select().from(auditLogTable)
      .where(eq(auditLogTable.projectId, projectId))
      .orderBy(desc(auditLogTable.createdAt)).limit(20);
  
    const productsOptimized = scored.length;
    const revenueImpact = avgSeoScore != null && avgSeoScore > 60 ? `+${Math.round((avgSeoScore - 50) * 0.3)}%` : "—";
  
    res.json({
      productsOptimized,
      imagesGenerated,
      avgSeoScore,
      revenueImpact,
      timeline: recentActivity,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/reports/export", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const rawFormat = (req.query.format as string) ?? "csv";
    const format = rawFormat === "csv" ? "csv" : "txt";
  
    const products = await db.select({
      id: productsTable.id,
      title: productsTable.title,
      auditScore: productsTable.auditScore,
      price: productsTable.price,
    }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId)));
  
    if (format === "csv") {
      const header = "ID,Título,Score,Precio\n";
      const rows = products.map(p => `${p.id},"${(p.title ?? "").replace(/"/g, '""')}",${p.auditScore ?? ""},${p.price ?? ""}`).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=reporte-tienda.csv");
      res.send(header + rows);
    } else {
      const scored = products.filter(p => p.auditScore !== null);
      const avgScore = scored.length > 0
        ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
        : null;
      const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
      const productRows = products.map(p => {
        const score = p.auditScore ?? 0;
        const scoreColor = score >= 80 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f43f5e";
        return `<tr style="border-bottom:1px solid #1a1a28;">
          <td style="padding:10px 14px;color:#f0f0f5;font-size:13px;">${(p.title ?? "—").replace(/</g, "&lt;")}</td>
          <td style="padding:10px 14px;text-align:center;"><span style="color:${scoreColor};font-weight:700;font-size:14px;">${p.auditScore ?? "—"}</span></td>
          <td style="padding:10px 14px;text-align:right;color:#c8a84b;font-weight:600;font-size:13px;">${p.price ?? "—"}</td>
        </tr>`;
      }).join("");
  
      const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Tienda — Shopy Crafter</title></head>
  <body style="margin:0;padding:0;background:#08080e;font-family:'Segoe UI',Arial,sans-serif;">
  ${buildCoverPage({ reportTitle: "Reporte de Tienda", companyName: "Tienda", date, template: (req.query.template as CoverTemplate) || "elegance" })}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#08080e;padding:24px 0;"><tr><td align="center">
  <table width="720" cellpadding="0" cellspacing="0" style="background:#0c0c14;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(160deg,#0e0e18,#12121f);padding:40px 48px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="44" valign="top"><div style="width:36px;height:36px;background:linear-gradient(135deg,#c8a84b,#8b6914);border-radius:9px;text-align:center;line-height:36px;font-size:18px;font-weight:900;color:#0a0a0f;">S</div></td>
      <td style="padding-left:12px;" valign="middle"><span style="font-size:18px;font-weight:800;color:#c8a84b;">Shopy Crafter</span></td>
    </tr></table>
    <h1 style="font-size:22px;font-weight:900;color:#f0f0f5;margin:20px 0 0;">Reporte de Tienda</h1>
    <p style="font-size:11px;color:#6b6b80;margin:8px 0 0;">${date} &middot; Shopy Crafter AI</p>
  </td></tr>
  <tr><td style="padding:28px 48px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:14px;background:#101018;border:1px solid #1a1a28;border-radius:10px;text-align:center;width:33%;">
          <div style="font-size:24px;font-weight:800;color:#c8a84b;">${products.length}</div>
          <div style="font-size:11px;color:#6b6b80;margin-top:4px;">Productos</div>
        </td>
        <td width="12"></td>
        <td style="padding:14px;background:#101018;border:1px solid #1a1a28;border-radius:10px;text-align:center;width:33%;">
          <div style="font-size:24px;font-weight:800;color:#34d399;">${scored.length}</div>
          <div style="font-size:11px;color:#6b6b80;margin-top:4px;">Auditados</div>
        </td>
        <td width="12"></td>
        <td style="padding:14px;background:#101018;border:1px solid #1a1a28;border-radius:10px;text-align:center;width:33%;">
          <div style="font-size:24px;font-weight:800;color:${(avgScore ?? 0) >= 80 ? "#34d399" : (avgScore ?? 0) >= 50 ? "#f59e0b" : "#f43f5e"};">${avgScore ?? "—"}</div>
          <div style="font-size:11px;color:#6b6b80;margin-top:4px;">Score Promedio</div>
        </td>
      </tr>
    </table>
    <h2 style="font-size:15px;color:#c8a84b;margin:0 0 12px;">Detalle por Producto</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#101018;border:1px solid #1a1a28;border-radius:10px;overflow:hidden;">
      <tr style="background:#16161f;"><th style="padding:10px 14px;text-align:left;font-size:11px;color:#c8a84b;font-weight:700;">Producto</th><th style="padding:10px 14px;text-align:center;font-size:11px;color:#c8a84b;font-weight:700;">Score</th><th style="padding:10px 14px;text-align:right;font-size:11px;color:#c8a84b;font-weight:700;">Precio</th></tr>
      ${productRows}
    </table>
  </td></tr>
  <tr><td style="text-align:center;padding:20px 48px;border-top:1px solid #1a1a28;">
    <p style="color:#6b6b80;font-size:11px;margin:0;">Generado por <span style="color:#c8a84b;font-weight:600;">Shopy Crafter</span> AI</p>
    <p style="color:#6b6b80;font-size:11px;margin:4px 0 0;">&copy; ${new Date().getFullYear()} Shopy Crafter. Todos los derechos reservados.</p>
  </td></tr>
  </table></td></tr></table></body></html>`;
  
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=reporte-tienda.html");
      res.send(html);
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/products", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const rows = await db.select({
      id: productsTable.id,
      title: productsTable.title,
      price: productsTable.price,
      auditScore: productsTable.auditScore,
      auditGrade: productsTable.auditGrade,
      imagesJson: productsTable.imagesJson,
    }).from(productsTable)
      .where(eq(productsTable.projectId, parseInt(projectId)))
      .orderBy(desc(productsTable.auditScore));
    const products = rows.map((r) => {
      let images: string[] | null = null;
      try { images = r.imagesJson ? (typeof r.imagesJson === "string" ? JSON.parse(r.imagesJson) : r.imagesJson as string[]) : null; } catch {}
      return { id: r.id, title: r.title, price: r.price, auditScore: r.auditScore, auditGrade: r.auditGrade, images };
    });
    res.json(products);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/vault-files", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const pid = parseInt(projectId);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid projectId" }); return; }

    const files = await db.select({
      id: projectFilesTable.id,
      title: projectFilesTable.title,
      fileType: projectFilesTable.fileType,
      category: projectFilesTable.category,
      description: projectFilesTable.description,
      createdAt: projectFilesTable.createdAt,
      objectPath: projectFilesTable.objectPath,
      hasContent: projectFilesTable.content,
    }).from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, pid))
      .orderBy(desc(projectFilesTable.createdAt));

    const result = files.map(f => ({
      id: f.id,
      title: f.title ?? "Archivo sin título",
      fileType: f.fileType ?? "file",
      category: f.category ?? "general",
      description: f.description,
      createdAt: f.createdAt,
      downloadUrl: (f.objectPath || f.hasContent)
        ? `/api/projects/${pid}/vault/${f.id}/download`
        : undefined,
    }));

    res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, "client vault-files error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai-chat", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const pid = parseInt(projectId);

    const { message, history = [] } = req.body as { message: string; history?: Array<{ role: string; content: string }> };
    if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

    const products = await db.select({
      id: productsTable.id, title: productsTable.title,
      price: productsTable.price, auditScore: productsTable.auditScore, auditGrade: productsTable.auditGrade,
    }).from(productsTable).where(eq(productsTable.projectId, pid)).limit(20);

    const recentActivity = await db.select({
      action: auditLogTable.action, details: auditLogTable.details, createdAt: auditLogTable.createdAt,
    }).from(auditLogTable).where(eq(auditLogTable.projectId, projectId)).orderBy(desc(auditLogTable.createdAt)).limit(10);

    const scored = products.filter(p => p.auditScore !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length) : null;

    const systemPrompt = `Eres el asistente IA personal de Shopy Crafter para este cliente. Eres experto en ecommerce Shopify y optimización de tiendas online.

DATOS ACTUALES DE LA TIENDA DEL CLIENTE:
- Total de productos: ${products.length}
- Productos auditados: ${scored.length}
- Score promedio de calidad: ${avgScore ?? "Sin datos"}/100
- Motores IA activos: 7 (Auditoría, Rediseño, Imágenes, Consistencia Visual, A/B Testing, SEO, Precios)
- Última actividad: ${recentActivity[0]?.details ?? "Sin actividad reciente"}

PRODUCTOS (top 10 por score):
${products.slice(0, 10).map(p => `- ${p.title}: €${p.price ?? "?"} | Score: ${p.auditScore ?? "?"}/100 (${p.auditGrade ?? "?"})`).join("\n")}

ACTIVIDAD RECIENTE:
${recentActivity.slice(0, 5).map(a => `- ${a.action}: ${a.details}`).join("\n")}

INSTRUCCIONES:
- Responde SIEMPRE en español
- Sé conciso, amigable y profesional
- Da consejos específicos basados en los datos reales de su tienda
- Si no tienes datos suficientes, sé honesto pero proporciona asesoramiento general útil
- Anima al cliente cuando sea apropiado
- Máximo 200 palabras por respuesta`;

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.slice(-6).map(m => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];

    const reply = await askClaude(isNaN(pid) ? 0 : pid, messages, systemPrompt, 300, 12000);
    res.json({ reply });
  } catch (err: any) {
    logger.error({ err: err.message }, "client ai-chat error");
    res.status(500).json({ error: "Error al procesar tu consulta. Por favor inténtalo de nuevo." });
  }
});

export default router;
