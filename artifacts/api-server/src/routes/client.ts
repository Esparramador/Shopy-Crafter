import { Router } from "express";
import { randomBytes } from "crypto";
import { db, approvalsTable, messagesTable, productsTable, auditLogTable, projectFilesTable, projectsTable, brandDnaTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { msgUpload, msgUploadMulti } from "../lib/msg-uploads.js";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import { logger } from "../lib/logger.js";
import { askClaude, learnFromOperation } from "../lib/claude.js";
import { askGeminiChat } from "../lib/gemini.js";
import { buildClientPlatformContext } from "../lib/platform-knowledge.js";
import {
  loadClientProfile,
  extractAndLearnFromChat,
  teachClientAdvisor,
  deleteClientKnowledge,
  KNOWLEDGE_CATEGORIES,
} from "../lib/client-advisor.js";
import { db as _db, clientKnowledgeTable } from "@workspace/db";
import { eq as _eq, desc as _desc } from "drizzle-orm";
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
      db.select({ id: projectsTable.id, name: projectsTable.name, shopDomain: projectsTable.shopDomain, platformType: (projectsTable as any).platformType })
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
      platformType: (project[0] as any)?.platformType ?? "shopify",
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

router.get("/brand-dna", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const pid = parseInt(projectId);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid projectId" }); return; }
    const rows = await db.execute(
      sql`SELECT tone_of_voice, target_audience, brand_personality, sector, company_description,
                 unique_value_proposition, taglines, brand_archetype, primary_colors,
                 content_pillars, website_url, extraction_status, extracted_at
          FROM brand_dna WHERE project_id = ${pid} ORDER BY extracted_at DESC LIMIT 1`
    );
    const row = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : null);
    if (!row) { res.json({ ok: true, brandDna: null }); return; }
    res.json({ ok: true, brandDna: row });
  } catch (err: any) {
    logger.error({ err: err?.message }, "client brand-dna error");
    res.status(500).json({ error: "Internal server error" });
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

    const {
      message = "",
      history = [],
      attachedFiles = [],
      forwardToAdmin = false,
      intentHints = {},
    } = req.body as {
      message?: string;
      history?: Array<{ role: string; content: string }>;
      attachedFiles?: Array<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }>;
      forwardToAdmin?: boolean;
      intentHints?: { listFiles?: boolean; listProducts?: boolean; forward?: boolean };
    };

    const msg = message?.trim() ?? "";
    const hasFiles = attachedFiles.length > 0;
    if (!msg && !hasFiles) { res.status(400).json({ error: "Message or files required" }); return; }

    // ── Intent detection ────────────────────────────────────────────
    const msgLower = msg.toLowerCase();
    const isForward = forwardToAdmin || intentHints.forward ||
      (/\b(manda|envía|envíale|pasa|comparte|dile|mándalo|mándale|reenvía)\b/.test(msgLower) &&
       /\b(joan|shopy|agencia|equipo|admin|vosotros|os)\b/.test(msgLower));

    const [products, recentActivity] = await Promise.all([
      db.select({
        id: productsTable.id, title: productsTable.title,
        price: productsTable.price, auditScore: productsTable.auditScore, auditGrade: productsTable.auditGrade,
      }).from(productsTable).where(eq(productsTable.projectId, pid)).limit(25),
      db.select({
        action: auditLogTable.action, details: auditLogTable.details, createdAt: auditLogTable.createdAt,
      }).from(auditLogTable).where(eq(auditLogTable.projectId, projectId)).orderBy(desc(auditLogTable.createdAt)).limit(10),
    ]);

    const scored = products.filter(p => p.auditScore !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length) : null;
    const avgGrade = avgScore !== null ? (avgScore >= 80 ? "A" : avgScore >= 65 ? "B" : avgScore >= 50 ? "C" : "D") : null;
    const lowScoreProducts = scored.filter(p => (p.auditScore ?? 0) < 50);
    const highScoreProducts = scored.filter(p => (p.auditScore ?? 0) >= 80);
    const unaudi = products.length - scored.length;
    const storeHealth = avgScore === null ? "sin datos" : avgScore >= 75 ? "buena" : avgScore >= 55 ? "media" : "crítica";

    // ── Vault files (for list_files intent or as context) ───────────
    let vaultFiles: any[] | undefined;
    if (intentHints.listFiles) {
      try {
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

        vaultFiles = files.map(f => ({
          id: f.id,
          title: f.title,
          fileType: f.fileType,
          category: f.category,
          description: f.description,
          createdAt: f.createdAt,
          downloadUrl: (f.objectPath || f.hasContent)
            ? `/api/projects/${pid}/vault/${f.id}/download`
            : null,
        })).filter(f => f.downloadUrl);
      } catch {}
    }

    // ── Forward to admin ─────────────────────────────────────────────
    let forwarded = false;
    let forwardedId: string | undefined;
    if (isForward && (msg || hasFiles)) {
      try {
        const senderName = (req.session as any).name ?? "Cliente";
        const id = randomBytes(16).toString("hex");
        const filesJson = hasFiles ? JSON.stringify(attachedFiles) : null;
        await db.execute(sql`
          INSERT INTO messages (id, project_id, from_role, from_name, content, files_json)
          VALUES (${id}, ${projectId}, 'client', ${senderName},
            ${msg || `📎 ${attachedFiles.length} archivo(s) adjunto(s)`},
            ${filesJson}::jsonb)
        `);
        const preview = msg.length > 80 ? msg.slice(0, 77) + "…" : msg || `📎 ${attachedFiles.length} archivo(s)`;
        sendPushToAdmins(`💬 ${senderName} te envía: ${preview}`, `Nuevo mensaje con ${hasFiles ? `${attachedFiles.length} archivo(s)` : "texto"}`, "/admin/messages").catch(() => {});
        forwarded = true;
        forwardedId = id;
      } catch (err: any) {
        logger.error({ err: err.message }, "client ai-chat: forward to admin failed");
      }
    }

    // ── Load accumulated client profile ─────────────────────────────
    const [filesContext, clientProfile] = await Promise.all([
      Promise.resolve(hasFiles
        ? `\n\nARCHIVOS QUE HA ENVIADO EL CLIENTE:\n${attachedFiles.map(f => `· ${f.fileName} (${f.fileType}, ${Math.round(f.fileSize / 1024)}KB)`).join("\n")}`
        : ""),
      loadClientProfile(pid),
    ]);

    // ── Build system prompt ──────────────────────────────────────────
    const systemPrompt = `Eres el asesor personal de negocio IA del cliente en Shopy Crafter. Conoces su empresa en profundidad y actúas como un socio estratégico de confianza — no como un chatbot genérico. Hablas siempre en español.

MISIÓN PRINCIPAL:
• Ser el asesor más informado sobre el negocio del cliente: su sector, competidores, objetivos, retos y oportunidades
• Aprender y recordar todo lo que el cliente te comparte — cada dato que te dan lo incorporas a tu conocimiento de su empresa
• Detectar oportunidades que el cliente no está aprovechando basándote en lo que sabes de su sector
• Dar consejos hiperpersonalizados basados en su perfil real, no respuestas genéricas

CAPACIDADES:
• Analizar catálogo, scores SEO y actividad de la tienda con datos reales
• Incorporar información nueva del cliente: datos de empresa, sector, competidores, objetivos, archivos
• Sugerir estrategias de monetización y productos específicos para su nicho
• Comparar con empresas similares del mismo sector y detectar brechas competitivas
• Reenviar archivos/mensajes al equipo de Shopy Crafter (Joan)

${clientProfile ? clientProfile + "\n" : ""}══ DATOS REALES DE LA TIENDA ══
Salud: ${storeHealth.toUpperCase()}${avgScore !== null ? ` · Score medio: ${avgScore}/100 (${avgGrade})` : ""}
Catálogo: ${products.length} productos — ${scored.length} auditados, ${unaudi} sin auditar
${lowScoreProducts.length > 0 ? `🔴 URGENTE: ${lowScoreProducts.length} producto(s) con score <50` : ""}
${highScoreProducts.length > 0 ? `🟢 ${highScoreProducts.length} bien optimizados (≥80 pts)` : ""}
${products.length > 0 ? `PRODUCTOS:\n${products.slice(0, 12).map(p => {
  const flag = !p.auditScore ? "⬜" : p.auditScore < 50 ? "🔴" : p.auditScore < 70 ? "🟡" : "🟢";
  return `${flag} ${p.title}: €${p.price ?? "?"} — ${p.auditScore ?? "?"}pts (${p.auditGrade ?? "?"})`;
}).join("\n")}` : ""}

${recentActivity.length > 0 ? `ACTIVIDAD:\n${recentActivity.slice(0, 5).map(a => `· ${a.action}: ${a.details}`).join("\n")}` : ""}
${filesContext}

${buildClientPlatformContext()}

REGLAS:
• Respuesta máx 220 palabras. Nunca inventes métricas.
• Termina siempre con UNA acción concreta que el cliente puede hacer ahora.
• Si el cliente comparte datos de su empresa → acúsalo recibo ("Anoto que…") y úsalos en tu respuesta.
• Si detectas que el cliente NO usa una capacidad clave para su sector → señálalo proactivamente.
• Sé directo, cálido, estratégico. Varía el inicio de cada respuesta.`;

    const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.slice(-8)
        .filter(m => m.content)
        .map(m => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
      { role: "user", content: msg || `[Cliente adjuntó ${attachedFiles.length} archivo(s)]` },
    ];

    let reply: string;
    try {
      reply = await askGeminiChat(chatMessages, systemPrompt, { maxOutputTokens: 600 });
      if (!reply) throw new Error("empty");
    } catch {
      reply = await askClaude(isNaN(pid) ? 0 : pid, chatMessages, systemPrompt, 400, 12000);
    }

    // ── Learn from this conversation (fire-and-forget) ───────────────
    if (msg) {
      extractAndLearnFromChat({
        projectId: pid,
        niche: null,
        userMessage: msg,
        aiReply: reply,
      });
    }

    res.json({ reply, vaultFiles, forwarded, forwardedId });
  } catch (err: any) {
    logger.error({ err: err.message }, "client ai-chat error");
    res.status(500).json({ error: "Error al procesar tu consulta. Por favor inténtalo de nuevo." });
  }
});

// ─── GET /api/client/platform-data ───────────────────────────────────────────
// Returns real financial analytics for any CMS (Shopify, WooCommerce, PrestaShop, Stripe)
router.get("/platform-data", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }

    const pid = parseInt(projectId);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, pid)).limit(1);
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const platformType: string = ((project as any).platformType as string) ?? "shopify";

    // Last 30 days revenue snapshots
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString().split("T")[0];
    const snapshots = await db.execute(sql`
      SELECT date, revenue, orders, aov
      FROM revenue_snapshots
      WHERE project_id = ${String(pid)} AND date >= ${thirtyDaysAgo}
      ORDER BY date ASC
    `).catch(() => ({ rows: [] }));
    const rows = (snapshots.rows ?? []) as Array<{ date: string; revenue: number; orders: number; aov: number }>;

    // Prior 30 days for comparison
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600_000).toISOString().split("T")[0];
    const priorRows = await db.execute(sql`
      SELECT SUM(revenue) as total_revenue, SUM(orders) as total_orders
      FROM revenue_snapshots
      WHERE project_id = ${String(pid)} AND date >= ${sixtyDaysAgo} AND date < ${thirtyDaysAgo}
    `).catch(() => ({ rows: [{ total_revenue: 0, total_orders: 0 }] }));
    const prior = (priorRows.rows?.[0] ?? { total_revenue: 0, total_orders: 0 }) as { total_revenue: number; total_orders: number };

    const currentRevenue = rows.reduce((s, r) => s + parseFloat(String(r.revenue ?? 0)), 0);
    const currentOrders = rows.reduce((s, r) => s + parseInt(String(r.orders ?? 0)), 0);
    const avgAov = currentOrders > 0 ? currentRevenue / currentOrders : 0;
    const priorRevenue = parseFloat(String(prior.total_revenue ?? 0));
    const revenueTrend = priorRevenue > 0 ? ((currentRevenue - priorRevenue) / priorRevenue) * 100 : 0;

    // Top products by audit score
    const topProducts = await db.execute(sql`
      SELECT title, price, audit_score, audit_grade, handle
      FROM products
      WHERE project_id = ${pid} AND audit_score IS NOT NULL
      ORDER BY audit_score DESC LIMIT 5
    `).catch(() => ({ rows: [] }));

    // Recent events
    const events = await db.execute(sql`
      SELECT event_type, payload, created_at
      FROM events
      WHERE project_id = ${String(pid)}
      ORDER BY created_at DESC LIMIT 15
    `).catch(() => ({ rows: [] }));

    // Inventory alerts
    const invAlerts = await db.execute(sql`
      SELECT product_title, variant_title, current_stock, days_remaining, status, sku
      FROM inventory_tracking
      WHERE project_id = ${String(pid)} AND status IN ('critical','warning')
      ORDER BY days_remaining ASC NULLS LAST LIMIT 8
    `).catch(() => ({ rows: [] }));

    // COGS data
    const cogsData = await db.execute(sql`
      SELECT p.title, c.total_cogs, c.unit_cost, c.shopify_payment_fee, c.shipping_cost_domestic
      FROM cogs c
      JOIN products p ON p.id = c.product_id
      WHERE p.project_id = ${pid}
      ORDER BY c.total_cogs DESC LIMIT 8
    `).catch(() => ({ rows: [] }));

    res.json({
      platformType,
      revenue: {
        total30d: parseFloat(currentRevenue.toFixed(2)),
        orders30d: currentOrders,
        aov: parseFloat(avgAov.toFixed(2)),
        trend: parseFloat(revenueTrend.toFixed(1)),
        dailyChart: rows.map(r => ({ date: r.date, revenue: parseFloat(String(r.revenue ?? 0)), orders: parseInt(String(r.orders ?? 0)) })),
      },
      topProducts: (topProducts.rows ?? []),
      events: (events.rows ?? []),
      inventoryAlerts: (invAlerts.rows ?? []),
      cogsData: (cogsData.rows ?? []),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "GET /client/platform-data error");
    res.status(500).json({ error: "Error al cargar datos de plataforma" });
  }
});

// ─── AI CHAT STREAMING (SSE) ─────────────────────────────────────────────────
const CLIENT_SEARCH_RE = /busca(r)?\s|google|internet|noticias?|tendencias?|competidore?s?|investigar|research|precio.{1,20}mercado|qué.{1,15}dicen|actualidad|mi\s+(empresa|marca|tienda)\s+en|últimas?\s+(noticias?|tendencias?)/i;

router.post("/ai-chat/stream", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    const pid = parseInt(projectId);

    const { message = "", history = [] } = req.body as {
      message?: string;
      history?: Array<{ role: string; content: string }>;
    };
    const msg = (message ?? "").trim();
    if (!msg) { res.status(400).json({ error: "Message required" }); return; }

    const [products, recentActivity, clientProfileStream] = await Promise.all([
      db.select({ id: productsTable.id, title: productsTable.title, price: productsTable.price, auditScore: productsTable.auditScore, auditGrade: productsTable.auditGrade })
        .from(productsTable).where(eq(productsTable.projectId, pid)).limit(20),
      db.select({ action: auditLogTable.action, details: auditLogTable.details })
        .from(auditLogTable).where(eq(auditLogTable.projectId, projectId)).orderBy(desc(auditLogTable.createdAt)).limit(6),
      loadClientProfile(pid),
    ]);

    const scored = products.filter(p => p.auditScore !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((s, p) => s + (p.auditScore ?? 0), 0) / scored.length) : null;
    const storeHealth = avgScore === null ? "sin datos" : avgScore >= 75 ? "buena" : avgScore >= 55 ? "media" : "crítica";
    const useSearch = CLIENT_SEARCH_RE.test(msg);

    const systemPrompt = `Eres el asesor personal de negocio IA del cliente en Shopy Crafter. Conoces su empresa en profundidad y actúas como socio estratégico de confianza. Hablas siempre en español. Tienes acceso a Google Search cuando el cliente lo necesite.

MISIÓN PRINCIPAL:
• Ser el asesor más informado sobre el negocio del cliente: sector, competidores, objetivos, retos y oportunidades
• Aprender y recordar todo lo que el cliente comparte — cada dato que dan lo incorporas a tu conocimiento
• Detectar oportunidades que el cliente no está aprovechando, basándote en su sector
• Dar consejos hiperpersonalizados, no genéricos

${clientProfileStream ? clientProfileStream + "\n" : ""}DATOS DE LA TIENDA:
Salud: ${storeHealth.toUpperCase()}${avgScore !== null ? ` · Score: ${avgScore}/100` : ""}
Catálogo: ${products.length} productos — ${scored.length} auditados

${products.length > 0 ? `PRODUCTOS:\n${products.slice(0, 10).map(p => {
  const flag = !p.auditScore ? "⬜" : p.auditScore < 50 ? "🔴" : p.auditScore < 70 ? "🟡" : "🟢";
  return `${flag} ${p.title}: €${p.price ?? "?"} (${p.auditScore ?? "?"}pts ${p.auditGrade ?? "?"})`;
}).join("\n")}` : ""}

${recentActivity.length > 0 ? `ACTIVIDAD:\n${recentActivity.map(a => `· ${a.action}: ${a.details}`).join("\n")}` : ""}

${useSearch ? `MODO DEEP RESEARCH ACTIVADO: Usa Google Search para datos reales y actualizados. Presenta hallazgos con fuentes cuando las tengas.` : ""}

${buildClientPlatformContext()}

REGLAS: Máx 220 palabras. Termina con UNA acción concreta. Si el cliente comparte datos de su empresa → acúsalo recibo y úsalos. Varía el inicio.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.slice(-8)
        .filter(m => m.content)
        .map(m => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: msg },
    ];

    const { askGeminiStream } = await import("../lib/gemini.js");
    const gen = askGeminiStream(chatMessages, systemPrompt, { useSearch, thinkingBudget: 0 });

    let fullResponse = "";
    for await (const chunk of gen) {
      if (res.destroyed) break;
      if (chunk.text) fullResponse += chunk.text;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      (res as any).flush?.();
      if (chunk.done) break;
    }
    if (!res.destroyed) res.end();

    if (fullResponse.length > 80) {
      setImmediate(() => {
        try {
          learnFromOperation({
            operationType: "client_chat_insight",
            title: `Cliente (proy:${projectId}): ${msg.slice(0, 100)}`,
            content: `Proyecto ${projectId} — El cliente preguntó: "${msg}". La IA respondió: ${fullResponse.slice(0, 600)}`,
            confidence: 0.7,
            tags: ["client_chat", `project_${projectId}`, ...(useSearch ? ["web_search", "deep_research"] : [])],
            sourceProjectId: isNaN(pid) ? undefined : pid,
          });
        } catch {}
      });
      // ── Advisor learning from stream conversation ─────────────────
      extractAndLearnFromChat({
        projectId: pid,
        niche: null,
        userMessage: msg,
        aiReply: fullResponse,
      });
    }
  } catch (err) {
    logger.error({ err }, "client ai-chat/stream error");
    if (!res.headersSent) res.status(500).json({ error: String(err) });
    else { res.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`); res.end(); }
  }
});

// ─── GET /api/client/profile ──────────────────────────────────────────────────
// Returns the full accumulated knowledge profile for this client project.
router.get("/profile", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }

    const rows = await _db
      .select()
      .from(clientKnowledgeTable)
      .where(_eq(clientKnowledgeTable.projectId, String(projectId)))
      .orderBy(_desc(clientKnowledgeTable.updatedAt))
      .limit(100);

    const categories = Object.entries(KNOWLEDGE_CATEGORIES).map(([key, label]) => ({
      key,
      label,
      entries: rows.filter(r => r.category === key).map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        source: r.source,
        confidence: r.confidence,
        createdAt: r.createdAt,
      })),
    })).filter(c => c.entries.length > 0);

    res.json({ total: rows.length, categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/client/teach ───────────────────────────────────────────────────
// Client explicitly teaches the advisor about their business.
// Body: { category, title, content, niche? }
router.post("/teach", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }

    const { category = "free_knowledge", title, content, niche } = req.body as {
      category?: string;
      title: string;
      content: string;
      niche?: string;
    };

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: "title y content son obligatorios" });
      return;
    }

    const result = await teachClientAdvisor({
      projectId,
      category,
      title: title.trim(),
      content: content.trim(),
      niche: niche ?? null,
      source: "teach",
    });

    res.json({ ok: true, id: result.id, message: "Conocimiento guardado y absorbido en ShopyBrain" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/client/knowledge/:id ────────────────────────────────────────
// Remove a specific knowledge entry.
router.delete("/knowledge/:id", async (req, res): Promise<void> => {
  try {
    const projectId = getClientProjectId(req);
    if (!projectId) { res.status(400).json({ error: "No project linked" }); return; }
    await deleteClientKnowledge(req.params.id, projectId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
