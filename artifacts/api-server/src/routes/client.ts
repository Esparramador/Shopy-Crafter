import { Router } from "express";
import { randomBytes } from "crypto";
import { db, approvalsTable, messagesTable, productsTable, auditLogTable, projectFilesTable, projectsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { msgUpload, msgUploadMulti } from "../lib/msg-uploads.js";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import { logger } from "../lib/logger.js";
import { askClaude } from "../lib/claude.js";
import { sendPushToAdmins, sendPushToClientByProject } from "../lib/push-helper.js";

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
  
    const [project, products, pendingApprovals, recentActivity] = await Promise.all([
      db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain })
        .from(projectsTable).where(eq(projectsTable.id, parseInt(projectId))).limit(1),
      db.select({
        id: productsTable.id,
        title: productsTable.title,
        auditScore: productsTable.auditScore,
        price: productsTable.price,
      }).from(productsTable).where(eq(productsTable.projectId, parseInt(projectId))),
      db.select({ id: approvalsTable.id })
        .from(approvalsTable)
        .where(and(eq(approvalsTable.projectId, projectId), eq(approvalsTable.status, "pending"))),
      db.select().from(auditLogTable)
        .where(eq(auditLogTable.projectId, projectId))
        .orderBy(desc(auditLogTable.createdAt)).limit(20),
    ]);
  
    const scored = products.filter((p) => p.auditScore !== null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length)
      : null;
  
    res.json({
      totalProducts: products.length,
      avgScore,
      pendingApprovals: pendingApprovals.length,
      recentActivity,
      enginesActive: 6,
      lastOptimized: recentActivity[0]?.createdAt ?? null,
      projectName: project[0]?.name ?? null,
      shopDomain: project[0]?.shopDomain ?? null,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/project-info", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.json({ name: null, shopDomain: null }); return; }
    const [project] = await db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain })
      .from(projectsTable).where(eq(projectsTable.id, parseInt(projectId))).limit(1);
    res.json(project ?? { name: null, shopDomain: null });
  } catch {
    res.json({ name: null, shopDomain: null });
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
    const result = await db.execute(sql`
      SELECT id,
             project_id    AS "projectId",
             from_role     AS "fromRole",
             from_name     AS "fromName",
             content,
             is_read       AS "isRead",
             created_at    AS "createdAt",
             file_url      AS "fileUrl",
             file_name     AS "fileName",
             file_type     AS "fileType",
             file_size     AS "fileSize",
             files_json    AS "filesJson"
      FROM messages
      WHERE project_id = ${projectId}
      ORDER BY created_at ASC
    `);
    await db.execute(sql`
      UPDATE messages SET is_read = 1
      WHERE project_id = ${projectId} AND from_role = 'admin'
    `);
    res.json((result as any).rows ?? result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/products", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.json([]); return; }
    const [projectRows, prods] = await Promise.all([
      db.select({ shopDomain: projectsTable.shopDomain })
        .from(projectsTable).where(eq(projectsTable.id, parseInt(projectId))).limit(1),
      db.select({
        id: productsTable.id,
        title: productsTable.title,
        price: productsTable.price,
        auditScore: productsTable.auditScore,
        auditGrade: productsTable.auditGrade,
        handle: productsTable.handle,
        imagesJson: productsTable.imagesJson,
        bodyHtml: productsTable.bodyHtml,
        vendor: productsTable.vendor,
      }).from(productsTable)
        .where(eq(productsTable.projectId, parseInt(projectId)))
        .orderBy(desc(productsTable.auditScore)),
    ]);
    const shopDomain = projectRows[0]?.shopDomain ?? null;
    const products = prods.map(p => {
      const rawImages = Array.isArray(p.imagesJson) ? p.imagesJson : (typeof p.imagesJson === "string" ? JSON.parse(p.imagesJson) : []);
      const images: string[] = (rawImages as any[]).map((img: any) => typeof img === "string" ? img : (img.src ?? img.url ?? "")).filter(Boolean);
      const imageUrl = images[0] ?? null;
      return { id: p.id, title: p.title, price: p.price, auditScore: p.auditScore, auditGrade: p.auditGrade, handle: p.handle, images, imageUrl, bodyHtml: p.bodyHtml, vendor: p.vendor, shopDomain };
    });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/messages/upload", msgUpload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    const { originalname, mimetype, size, filename } = req.file;
    res.json({
      fileUrl: `/api/msg-uploads/${filename}`,
      fileName: originalname,
      fileType: mimetype,
      fileSize: size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/messages/upload-multi", msgUploadMulti.array("files", 20), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) { res.status(400).json({ error: "No files provided" }); return; }
    const result = files.map(f => ({
      fileUrl: `/api/msg-uploads/${f.filename}`,
      fileName: f.originalname,
      fileType: f.mimetype,
      fileSize: f.size,
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/messages", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const { content, fileUrl, fileName, fileType, fileSize, filesJson } = req.body as {
      content?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number;
      filesJson?: Array<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }> | null;
    };
    const hasFiles = !!(fileUrl || (filesJson && filesJson.length > 0));
    if (!content?.trim() && !hasFiles) { res.status(400).json({ error: "Content or file required" }); return; }
    const id = randomBytes(16).toString("hex");
    const senderName = req.session.name ?? "Cliente";
    const filesJsonVal = filesJson && filesJson.length > 0 ? JSON.stringify(filesJson) : null;
    await db.execute(sql`
      INSERT INTO messages (id, project_id, from_role, from_name, content, file_url, file_name, file_type, file_size, files_json)
      VALUES (
        ${id}, ${projectId}, 'client', ${senderName},
        ${content ?? null}, ${fileUrl ?? null}, ${fileName ?? null}, ${fileType ?? null}, ${fileSize ?? null},
        ${filesJsonVal}::jsonb
      )
    `);
    const preview = content?.trim()
      ? (content.length > 80 ? content.slice(0, 77) + "…" : content)
      : `📎 ${fileName ?? "Archivo adjunto"}`;
    sendPushToAdmins(`💬 Nuevo mensaje de ${senderName}`, preview, "/admin/messages").catch(() => {});
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
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

    const avgGrade = avgScore !== null ? (avgScore >= 80 ? "A" : avgScore >= 65 ? "B" : avgScore >= 50 ? "C" : "D") : null;

    // Detectar situación crítica de la tienda para contexto proactivo
    const lowScoreProducts = scored.filter(p => (p.auditScore ?? 0) < 50);
    const highScoreProducts = scored.filter(p => (p.auditScore ?? 0) >= 80);
    const unaudi = products.length - scored.length;
    const storeHealth = avgScore === null ? "sin datos"
      : avgScore >= 75 ? "buena" : avgScore >= 55 ? "media" : "crítica";

    const systemPrompt = `Eres el asistente personal de Shopy Crafter para este cliente. Tu objetivo: ayudarle a entender su tienda, resolver dudas y guiarle siempre hacia la acción de mayor impacto basada en sus datos reales.

══ DATOS REALES DE LA TIENDA ══
Estado de salud: ${storeHealth.toUpperCase()}${avgScore !== null ? ` (score medio ${avgScore}/100, grado ${avgGrade})` : ""}
Catálogo: ${products.length} productos totales — ${scored.length} auditados, ${unaudi} sin auditar
${lowScoreProducts.length > 0 ? `⚠️ CRÍTICO: ${lowScoreProducts.length} producto(s) con score <50 pts (acción urgente)` : ""}
${highScoreProducts.length > 0 ? `✅ ${highScoreProducts.length} producto(s) con score ≥80 pts (bien optimizados)` : ""}
Motores IA disponibles: Auditoría, Rediseño, Imágenes IA, A/B Testing, SEO, Precios, Email Marketing

${products.length > 0 ? `MUESTRA DE PRODUCTOS (ordenados por relevancia):
${products.slice(0, 10).map(p => {
  const grade = p.auditGrade ?? "?";
  const flag = !p.auditScore ? "⬜ sin auditar" : (p.auditScore < 50 ? "🔴 urgente" : p.auditScore < 70 ? "🟡 mejorar" : "🟢 ok");
  return `· ${p.title}: €${p.price ?? "?"} — ${p.auditScore ?? "?"}pts (${grade}) ${flag}`;
}).join("\n")}` : ""}

${recentActivity.length > 0 ? `ACTIVIDAD RECIENTE:
${recentActivity.slice(0, 5).map(a => `· ${a.action}: ${a.details}`).join("\n")}` : ""}

══ INTENCIÓN DEL USUARIO — detecta y responde apropiadamente ══
• Pregunta sobre score/calidad → explica con el dato exacto y qué mejorar primero
• Pregunta "qué debo hacer" → prioriza por impacto: empieza con los 🔴 urgentes
• Pregunta sobre un producto específico → busca en la muestra y da feedback detallado
• Pide comparar → compara con los datos reales disponibles
• Frustración / "no funciona" → empatía primero, solución directa, escalar si persiste
• Pregunta fuera de alcance → di qué no puedes hacer, ofrece alternativa dentro de Shopy Crafter

══ REGLAS DE COMUNICACIÓN ══
• Varía el inicio de cada respuesta — no empieces siempre igual
• Usa los datos REALES que tienes — nunca inventes métricas
• Si no tienes datos suficientes, dilo y sugiere cómo obtenerlos (p.ej., "ejecuta la auditoría primero")
• Termina SIEMPRE con una acción concreta y específica que el cliente puede hacer ahora mismo en la plataforma
• Máximo 200 palabras. Responde siempre en español.`;

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
