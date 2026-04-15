import { Router } from "express";
import { createRequire } from "module";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { generationJobsTable } from "@workspace/db/schema";
import { eq, and, desc, sql, isNull, isNotNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

function metadataToReportHtml(file: { title: string; metadata: string | null; fileType: string; description?: string | null; category?: string | null; productTitle?: string | null; generatedBy?: string | null; createdAt?: Date | string | null }): string {
  return buildBrandedHtmlFromMetadata({
    title: file.title,
    fileType: file.fileType ?? "report",
    category: file.category ?? null,
    productTitle: file.productTitle ?? null,
    generatedBy: file.generatedBy ?? null,
    createdAt: file.createdAt ?? null,
    metadata: file.metadata,
  }, "prestige");
}

const router = Router();
let storage: ObjectStorageService | null = null;
function getStorage() {
  if (!storage) storage = new ObjectStorageService();
  return storage;
}

// ─── ACCESS CHECK ─────────────────────────────────────────────────────────────
// Solo puede acceder: admin (role='admin') O el usuario cuyo clientId coincide
// con el client_id del proyecto
async function canAccessProject(
  sessionRole: string | undefined,
  sessionClientId: string | null | undefined,
  projectId: number
): Promise<boolean> {
  if (sessionRole === "admin") return true;
  if (!sessionClientId) return false;
  const [project] = await db.select({ clientId: projectsTable.clientId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  return project?.clientId === sessionClientId;
}

// ─── LISTAR ARCHIVOS DE UN PROYECTO ──────────────────────────────────────────
router.get("/projects/:projectId/vault", requireAuth, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
  
    const session = req.session as any;
    if (!(await canAccessProject(session.role, session.clientId, projectId))) {
      res.status(403).json({ error: "Sin acceso a este proyecto" }); return;
    }
  
    const { fileType, category, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const conditions = [eq(projectFilesTable.projectId, projectId)];
    if (fileType) conditions.push(eq(projectFilesTable.fileType, fileType));
    if (category) conditions.push(eq(projectFilesTable.category, category));
  
    const files = await db.select({
      id: projectFilesTable.id,
      projectId: projectFilesTable.projectId,
      fileType: projectFilesTable.fileType,
      category: projectFilesTable.category,
      title: projectFilesTable.title,
      description: projectFilesTable.description,
      objectPath: projectFilesTable.objectPath,
      originalUrl: projectFilesTable.originalUrl,
      mimeType: projectFilesTable.mimeType,
      fileSizeBytes: projectFilesTable.fileSizeBytes,
      productId: projectFilesTable.productId,
      productTitle: projectFilesTable.productTitle,
      generatedBy: projectFilesTable.generatedBy,
      metadata: projectFilesTable.metadata,
      hasContent: sql<boolean>`content IS NOT NULL`.as("has_content"),
      isPublic: projectFilesTable.isPublic,
      createdAt: projectFilesTable.createdAt,
    }).from(projectFilesTable)
      .where(and(...conditions))
      .orderBy(desc(projectFilesTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
  
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, projectId));
  
    const filesWithUrls = files.map(f => ({
      ...f,
      hasContent: undefined,
      downloadUrl: (f.objectPath || f.hasContent)
        ? `/api/projects/${projectId}/vault/${f.id}/download`
        : f.originalUrl ?? null,
      previewUrl: (f.objectPath || f.hasContent || f.metadata)
        ? `/api/projects/${projectId}/vault/${f.id}/preview`
        : null,
    }));
  
    res.json({ files: filesWithUrls, total: Number(count) });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── STATS DEL VAULT ─────────────────────────────────────────────────────────
router.get("/projects/:projectId/vault/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
  
    const session = req.session as any;
    if (!(await canAccessProject(session.role, session.clientId, projectId))) {
      res.status(403).json({ error: "Sin acceso" }); return;
    }
  
    const byType = await db.select({
      fileType: projectFilesTable.fileType,
      count: sql<number>`count(*)`,
      totalSize: sql<number>`sum(file_size_bytes)`,
    }).from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, projectId))
      .groupBy(projectFilesTable.fileType);
  
    const [totals] = await db.select({
      total: sql<number>`count(*)`,
      totalSize: sql<number>`sum(file_size_bytes)`,
    }).from(projectFilesTable).where(eq(projectFilesTable.projectId, projectId));
  
    res.json({
      totalFiles: Number(totals?.total ?? 0),
      totalSizeBytes: Number(totals?.totalSize ?? 0),
      byType: byType.map(r => ({ fileType: r.fileType, count: Number(r.count), sizeBytes: Number(r.totalSize ?? 0) })),
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GUARDAR INFORME PROFESIONAL EN EL VAULT ────────────────────────────────
router.post("/projects/:projectId/vault/save-report", requireAuth, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
  
    const session = req.session as any;
    if (!(await canAccessProject(session.role, session.clientId, projectId))) {
      res.status(403).json({ error: "Sin acceso" }); return;
    }
  
    const { title, content, fileType, category, productId, productTitle, metadata } = req.body;
    if (!title || !content || !fileType) {
      res.status(400).json({ error: "title, content y fileType son requeridos" }); return;
    }
  
    const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
      .where(eq(projectsTable.id, projectId)).limit(1);
  
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  
    const htmlReport = `<!DOCTYPE html>
  <html lang="es">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeHtml(title)} — ${sanitizeHtml(project?.name || "Proyecto")}</title><!-- nosemgrep -->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0f; color: #f5f5f7; line-height: 1.7; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
    .header { border-bottom: 2px solid #c8a84b; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-left h1 { font-size: 24px; font-weight: 800; color: #c8a84b; }
    .header-left p { font-size: 13px; color: #8b8b9e; margin-top: 4px; }
    .header-right { text-align: right; font-size: 12px; color: #8b8b9e; }
    .header-right .brand { font-size: 11px; color: #c8a84b; font-weight: 700; margin-bottom: 2px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { font-size: 14px; color: #d0d0d8; }
    .content h2 { font-size: 18px; font-weight: 700; color: #c8a84b; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #1e1e2e; }
    .content h3 { font-size: 15px; font-weight: 700; color: #f5f5f7; margin: 20px 0 8px; }
    .content p { margin: 8px 0; }
    .content ul, .content ol { margin: 8px 0 8px 20px; }
    .content li { margin: 4px 0; }
    .content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .content th { background: #111118; color: #c8a84b; padding: 10px 12px; text-align: left; font-weight: 700; border-bottom: 2px solid #c8a84b; }
    .content td { padding: 8px 12px; border-bottom: 1px solid #1e1e2e; }
    .content tr:hover td { background: rgba(200,168,75,0.04); }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
    .metric-card { background: #111118; border: 1px solid #1e1e2e; border-radius: 10px; padding: 16px; }
    .metric-card .label { font-size: 11px; color: #8b8b9e; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-card .value { font-size: 22px; font-weight: 800; color: #f5f5f7; margin-top: 4px; }
    .metric-card .sub { font-size: 11px; color: #2ecc71; margin-top: 2px; }
    .section { background: #111118; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1e1e2e; font-size: 11px; color: #8b8b9e; text-align: center; }
    .status-ok { color: #2ecc71; } .status-warn { color: #f39c12; } .status-bad { color: #e84558; }
    .highlight { background: rgba(200,168,75,0.08); border-left: 3px solid #c8a84b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 12px 0; }
    @media print { body { background: white; color: #111; } .page { padding: 20px; } .header { border-color: #c8a84b; } .content th { background: #f5f5f5; color: #111; } .content td { border-color: #ddd; } .section { background: #f9f9f9; border-color: #ddd; } .metric-card { background: #f5f5f5; border-color: #ddd; } .footer { color: #999; } }
  </style>
  </head>
  <body>
  ${buildCoverPage({ companyName: sanitizeHtml(project?.name || "Proyecto"), template: "classic" })}
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>${sanitizeHtml(title)}</h1><!-- nosemgrep -->
        <p>${sanitizeHtml(project?.name || "Proyecto")} — Generado por Shopy Crafter AI</p><!-- nosemgrep -->
      </div>
      <div class="header-right">
        <div class="brand">SHOPY CRAFTER</div>
        <div>${date}</div>
        <div>${time}</div>
      </div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      Shopy Crafter AI Intelligence · ${date} · Informe confidencial
    </div>
  </div>
  </body>
  </html>`;
  
    const htmlBuffer = Buffer.from(htmlReport, "utf-8");
  
    try {
      const safeName = title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").replace(/\s+/g, "_").slice(0, 80);
      const objectPath = `projects/${projectId}/${fileType}/${safeName}_${Date.now()}.html`;
  
      let savedPath: string | null = null;
      try {
        const gcsFile = await getStorage().getObjectEntityFile(objectPath);
        await getStorage().uploadObject(gcsFile, htmlBuffer, "text/html");
        savedPath = objectPath;
      } catch (uploadErr: any) {
        logger.warn({ err: uploadErr, projectId, fileType }, "Object storage upload failed for report, saving DB record only");
      }
  
      const [saved] = await db.insert(projectFilesTable).values({
        projectId,
        fileType,
        category: category || null,
        title,
        description: `Informe profesional generado el ${date} a las ${time}`,
        objectPath: savedPath,
        originalUrl: null,
        mimeType: "text/html",
        fileSizeBytes: htmlBuffer.length,
        productId: productId || null,
        productTitle: productTitle || null,
        generatedBy: "report_engine",
        metadata: metadata ? JSON.stringify(metadata) : null,
        content: savedPath ? null : htmlReport,
        isPublic: 0,
      }).returning();
  
      res.json({ success: true, fileId: saved.id, title, fileType, sizeBytes: htmlBuffer.length });
    } catch (e: any) {
      res.status(500).json({ error: `Error guardando informe: ${e.message}` });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── DESCARGAR UN ARCHIVO ────────────────────────────────────────────────────
router.get("/projects/:projectId/vault/:fileId/download", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId));
  const fileId = parseInt(String(req.params.fileId));
  if (isNaN(projectId) || isNaN(fileId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  const session = req.session as any;
  if (!(await canAccessProject(session.role, session.clientId, projectId))) {
    res.status(403).json({ error: "Sin acceso" }); return;
  }

  const [file] = await db.select().from(projectFilesTable)
    .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)))
    .limit(1);

  if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }

  const filename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.${getExtension(file.mimeType ?? "application/octet-stream")}`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", file.mimeType ?? "application/octet-stream");

  // Intentar servir desde Object Storage primero, luego desde URL original
  if (file.objectPath) {
    try {
      const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
      const response = await getStorage().downloadObject(gcsFile);
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
      return;
    } catch { /* fallback to originalUrl */ }
  }

  if (file.originalUrl) {
    try {
      const response = await fetch(file.originalUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
        return;
      }
    } catch {}
  }

  if (file.content) {
    const isJson = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
    if (isJson) {
      try {
        const parsed = JSON.parse(file.content);
        const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
        const htmlFilename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.html`;
        res.setHeader("Content-Disposition", `attachment; filename="${htmlFilename}"`);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(htmlReport);
        return;
      } catch {}
    }
    const buf = Buffer.from(file.content, "utf-8");
    res.setHeader("Content-Type", file.mimeType ?? "text/html");
    res.send(buf);
    return;
  }

  if (file.metadata) {
    try {
      const htmlReport = buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
      const htmlFilename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.html`;
      res.setHeader("Content-Disposition", `attachment; filename="${htmlFilename}"`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(htmlReport);
      return;
    } catch {}
  }

  res.status(410).json({ error: "Archivo ya no disponible en origen" });
});

// ─── PREVISUALIZAR UN ARCHIVO (inline, sin descarga) ─────────────────────────
router.get("/projects/:projectId/vault/:fileId/preview", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId));
  const fileId = parseInt(String(req.params.fileId));
  if (isNaN(projectId) || isNaN(fileId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  const session = req.session as any;
  if (!(await canAccessProject(session.role, session.clientId, projectId))) {
    res.status(403).json({ error: "Sin acceso" }); return;
  }

  const [file] = await db.select().from(projectFilesTable)
    .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)))
    .limit(1);

  if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }

  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:;");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (file.objectPath) {
    try {
      const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
      const response = await getStorage().downloadObject(gcsFile);
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
      return;
    } catch { /* fallback */ }
  }

  if (file.content) {
    const isJson = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
    if (isJson) {
      try {
        const parsed = JSON.parse(file.content);
        const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
        res.send(htmlReport);
        return;
      } catch {}
    }
    res.send(file.content);
    return;
  }

  if (file.metadata) {
    try {
      const htmlReport = buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
      res.send(htmlReport);
      return;
    } catch {}
  }

  res.status(410).json({ error: "Archivo ya no disponible" });
});

// ─── DESCARGAR TODO EL VAULT COMO ZIP ────────────────────────────────────────
router.get("/projects/:projectId/vault/download-all", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId));
  if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

  const session = req.session as any;
  if (!(await canAccessProject(session.role, session.clientId, projectId))) {
    res.status(403).json({ error: "Sin acceso" }); return;
  }

  const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
    .where(eq(projectsTable.id, projectId)).limit(1);
  const files = await db.select().from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, projectId))
    .orderBy(projectFilesTable.fileType, projectFilesTable.createdAt);

  const zipName = `${(project?.name ?? "tienda").replace(/[^a-zA-Z0-9]/g, "_")}_vault.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  let added = 0;
  for (const file of files) {
    try {
      const ext = getExtension(file.mimeType ?? "application/octet-stream");
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.fileType === "image" ? `imagenes/${file.category ?? "general"}` : file.fileType;
      const entryName = `${folder}/${safeTitle}_${file.id}.${ext}`;

      if (file.objectPath) {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        const buffer = Buffer.from(await response.arrayBuffer());
        archive.append(buffer, { name: entryName });
        added++;
      } else if (file.originalUrl) {
        const response = await fetch(file.originalUrl, { signal: AbortSignal.timeout(15000) });
        if (response.ok && response.body) {
          const buffer = Buffer.from(await response.arrayBuffer());
          archive.append(buffer, { name: entryName });
          added++;
        }
      } else if (file.content) {
        const isJsonContent = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
        if (isJsonContent) {
          try {
            const parsed = JSON.parse(file.content);
            const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
            archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
          } catch {
            archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
          }
        } else {
          archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
        }
        added++;
      } else if (file.metadata) {
        const htmlReport = buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
        archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
        added++;
      }
    } catch { /* skip failed file */ }
  }

  // Añadir índice JSON con todos los metadatos
  const indexFiles = files.map(({ content, ...rest }) => rest);
  archive.append(JSON.stringify({ project: project?.name, projectId, totalFiles: files.length, exportedFiles: added, files: indexFiles }, null, 2), {
    name: "vault_index.json",
  });

  await archive.finalize();
});

// ─── DESCARGAR ARCHIVOS SELECCIONADOS COMO ZIP ────────────────────────────────
router.post("/projects/:projectId/vault/download-selected", requireAuth, async (req, res): Promise<void> => {
  try {
  const projectId = parseInt(String(req.params.projectId));
  if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

  const session = req.session as any;
  if (!(await canAccessProject(session.role, session.clientId, projectId))) {
    res.status(403).json({ error: "Sin acceso" }); return;
  }

  const { fileIds, folderTypes } = req.body as { fileIds?: number[]; folderTypes?: string[] };

  if ((!fileIds || fileIds.length === 0) && (!folderTypes || folderTypes.length === 0)) {
    res.status(400).json({ error: "Debe especificar fileIds o folderTypes" }); return;
  }

  const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
    .where(eq(projectsTable.id, projectId)).limit(1);

  let files;
  if (folderTypes && folderTypes.length > 0) {
    files = await db.select().from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        sql`${projectFilesTable.fileType} = ANY(${folderTypes})`
      ))
      .orderBy(projectFilesTable.fileType, projectFilesTable.createdAt);
  } else {
    files = await db.select().from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        sql`${projectFilesTable.id} = ANY(${fileIds!.map(Number)})`
      ))
      .orderBy(projectFilesTable.fileType, projectFilesTable.createdAt);
  }

  if (files.length === 0) { res.status(404).json({ error: "No se encontraron archivos" }); return; }

  const label = folderTypes ? folderTypes.join("_") : `seleccion_${files.length}`;
  const zipName = `${(project?.name ?? "tienda").replace(/[^a-zA-Z0-9]/g, "_")}_${label}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  let added = 0;
  for (const file of files) {
    try {
      const ext = getExtension(file.mimeType ?? "application/octet-stream");
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.fileType === "image" ? `imagenes/${file.category ?? "general"}` : file.fileType;
      const entryName = `${folder}/${safeTitle}_${file.id}.${ext}`;

      if (file.objectPath) {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        const buffer = Buffer.from(await response.arrayBuffer());
        archive.append(buffer, { name: entryName });
        added++;
      } else if (file.originalUrl) {
        const response = await fetch(file.originalUrl, { signal: AbortSignal.timeout(15000) });
        if (response.ok && response.body) {
          const buffer = Buffer.from(await response.arrayBuffer());
          archive.append(buffer, { name: entryName });
          added++;
        }
      } else if (file.content) {
        const isJsonContent = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
        if (isJsonContent) {
          try {
            const parsed = JSON.parse(file.content);
            const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
            archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
          } catch {
            archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
          }
        } else {
          archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
        }
        added++;
      } else if (file.metadata) {
        const htmlReport = buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
        archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
        added++;
      }
    } catch { /* skip failed file */ }
  }

  archive.append(JSON.stringify({
    project: project?.name, projectId, totalFiles: files.length,
    exportedFiles: added, exportType: folderTypes ? "folder" : "selection",
    files: files.map(({ content, ...rest }) => rest),
  }, null, 2), { name: "vault_index.json" });

  await archive.finalize();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// ─── REGISTRAR ARCHIVO GENERADO (llamado internamente por los motores) ────────
router.post("/projects/:projectId/vault/register", requireAuth, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
  
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin puede registrar archivos" }); return; }
  
    const { fileType, category, title, description, objectPath, originalUrl, mimeType, fileSizeBytes, productId, productTitle, generatedBy, metadata } = req.body;
  
    if (!fileType || !title) { res.status(400).json({ error: "fileType y title son requeridos" }); return; }
  
    const [file] = await db.insert(projectFilesTable).values({
      projectId, fileType, category: category ?? null, title,
      description: description ?? null, objectPath: objectPath ?? null,
      originalUrl: originalUrl ?? null, mimeType: mimeType ?? null,
      fileSizeBytes: fileSizeBytes ?? null, productId: productId ?? null,
      productTitle: productTitle ?? null, generatedBy: generatedBy ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }).returning();
  
    res.json({ success: true, file });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── ELIMINAR ARCHIVO (solo admin) ───────────────────────────────────────────
router.delete("/projects/:projectId/vault/:fileId", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin puede eliminar archivos" }); return; }
  
    const projectId = parseInt(String(req.params.projectId));
    const fileId = parseInt(String(req.params.fileId));
  
    const [file] = await db.select().from(projectFilesTable)
      .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId))).limit(1);
  
    if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }
  
    await db.delete(projectFilesTable)
      .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)));
  
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── DESCARGAR IMAGEN EN FORMATO ESPECÍFICO (PNG/JPG/WEBP) ──────────────────
router.get("/projects/:projectId/vault/:fileId/download/:format", requireAuth, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const fileId = parseInt(String(req.params.fileId));
    const format = String(req.params.format || "png").toLowerCase();
  
    const allFormats = ["png", "jpg", "jpeg", "webp", "tiff", "avif", "pdf", "docx"];
    if (!allFormats.includes(format)) {
      res.status(400).json({ error: "Formato no soportado. Usa: png, jpg, webp, tiff, avif, pdf, docx" }); return;
    }
  
    if (isNaN(projectId) || isNaN(fileId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
  
    const session = req.session as any;
    if (!(await canAccessProject(session.role, session.clientId, projectId))) {
      res.status(403).json({ error: "Sin acceso" }); return;
    }
  
    const [file] = await db.select().from(projectFilesTable)
      .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)))
      .limit(1);
  
    if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }
  
    const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  
    if (format === "pdf" || format === "docx") {
      let htmlContent: string | null = null;
  
      if (file.objectPath) {
        try {
          const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
          const response = await getStorage().downloadObject(gcsFile);
          const buf = Buffer.from(await response.arrayBuffer());
          const text = buf.toString("utf-8");
          if (text.trim().startsWith("<") || text.trim().startsWith("<!DOCTYPE")) {
            htmlContent = text;
          }
        } catch {}
      }
  
      if (!htmlContent && file.originalUrl) {
        try {
          const response = await fetch(file.originalUrl, { signal: AbortSignal.timeout(30000) });
          if (response.ok) {
            const text = await response.text();
            if (text.trim().startsWith("<") || text.trim().startsWith("<!DOCTYPE")) {
              htmlContent = text;
            }
          }
        } catch {}
      }
  
      if (!htmlContent && file.content && (file.mimeType === "text/html" || file.content.trim().startsWith("<") || file.content.trim().startsWith("<!DOCTYPE"))) {
        htmlContent = file.content;
      } else if (!htmlContent && file.content) {
        try {
          const parsed = JSON.parse(file.content);
          htmlContent = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
        } catch {}
      }
      if (!htmlContent && file.metadata) {
        try {
          htmlContent = buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
        } catch {}
      }
  
      if (!htmlContent) {
        res.status(400).json({ error: "Este archivo no se puede convertir a " + format.toUpperCase() }); return;
      }
  
      if (format === "pdf") {
        try {
          const puppeteer = await import("puppeteer-core");
          const chromiumPath = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
          const browser = await puppeteer.default.launch({
            executablePath: chromiumPath,
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
          });
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on("request", (req: any) => {
            const rtype = req.resourceType();
            if (rtype === "script" || rtype === "xhr" || rtype === "fetch" || rtype === "websocket") {
              req.abort();
            } else {
              req.continue();
            }
          });
          await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 30000 });
          await new Promise(r => setTimeout(r, 1500));
          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "15mm", bottom: "15mm", left: "10mm", right: "10mm" },
          });
          await browser.close();
  
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
          res.setHeader("Content-Length", String(pdfBuffer.length));
          res.send(Buffer.from(pdfBuffer));
        } catch (e: any) {
          logger.error({ err: e }, "Error generating PDF");
          res.status(500).json({ error: `Error generando PDF: ${e.message}` });
        }
        return;
      }
  
      if (format === "docx") {
        try {
          const cleanHtml = htmlContent
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "");
  
          const docxHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office"
                  xmlns:w="urn:schemas-microsoft-com:office:word"
                  xmlns="http://www.w3.org/TR/REC-html40">
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #222; line-height: 1.6; max-width: 100%; }
                h1 { font-size: 22pt; color: #1a1a2e; border-bottom: 2px solid #c9a96e; padding-bottom: 8px; }
                h2 { font-size: 16pt; color: #2d2d44; margin-top: 20px; }
                h3 { font-size: 13pt; color: #444; }
                table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
                th { background: #f0ebe0; font-weight: bold; }
                img { max-width: 400px; }
                .grade-badge, .score-circle { font-weight: bold; }
              </style>
            </head>
            <body>${cleanHtml}</body>
            </html>`;
  
          const docxBuffer = Buffer.from(docxHtml, "utf-8");
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.doc"`);
          res.setHeader("Content-Length", String(docxBuffer.length));
          res.send(docxBuffer);
        } catch (e: any) {
          logger.error({ err: e }, "Error generating DOCX");
          res.status(500).json({ error: `Error generando Word: ${e.message}` });
        }
        return;
      }
    }
  
    let imageBuffer: Buffer | null = null;
  
    if (file.objectPath) {
      try {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } catch {}
    }
  
    if (!imageBuffer && file.originalUrl) {
      try {
        const response = await fetch(file.originalUrl, { signal: AbortSignal.timeout(30000) });
        if (response.ok) imageBuffer = Buffer.from(await response.arrayBuffer());
      } catch {}
    }
  
    if (!imageBuffer) { res.status(410).json({ error: "Imagen no disponible" }); return; }
  
    try {
      let pipeline = sharp(imageBuffer);
  
      const targetFormat = format === "jpeg" ? "jpg" : format;
  
      if (targetFormat === "png") {
        pipeline = pipeline.png({ quality: 100, compressionLevel: 0 });
      } else if (targetFormat === "jpg") {
        pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: "4:4:4" });
      } else if (targetFormat === "webp") {
        pipeline = pipeline.webp({ quality: 100, lossless: true });
      } else if (targetFormat === "tiff") {
        pipeline = pipeline.tiff({ quality: 100 });
      } else if (targetFormat === "avif") {
        pipeline = pipeline.avif({ quality: 100, lossless: true });
      }
  
      const outputBuffer = await pipeline.toBuffer();
      const mimeMap: Record<string, string> = {
        png: "image/png", jpg: "image/jpeg", webp: "image/webp",
        tiff: "image/tiff", avif: "image/avif",
      };
  
      res.setHeader("Content-Type", mimeMap[targetFormat] || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.${targetFormat}"`);
      res.setHeader("Content-Length", String(outputBuffer.length));
      res.send(outputBuffer); // nosemgrep
    } catch (e: any) {
      res.status(500).json({ error: `Error convirtiendo imagen: ${e.message}` });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── DESCARGAR TODAS LAS IMÁGENES EN FORMATO ESPECÍFICO (ZIP) ───────────────
router.get("/projects/:projectId/vault/download-images/:format", requireAuth, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    const format = String(req.params.format || "png").toLowerCase();
  
    if (!["png", "jpg", "jpeg", "webp", "tiff", "avif", "original"].includes(format)) {
      res.status(400).json({ error: "Formato no soportado" }); return;
    }
  
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
  
    const session = req.session as any;
    if (!(await canAccessProject(session.role, session.clientId, projectId))) {
      res.status(403).json({ error: "Sin acceso" }); return;
    }
  
    const [project] = await db.select({ name: projectsTable.name }).from(projectsTable)
      .where(eq(projectsTable.id, projectId)).limit(1);
  
    const imageFiles = await db.select().from(projectFilesTable)
      .where(and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.fileType, "image")))
      .orderBy(projectFilesTable.category, projectFilesTable.createdAt);
  
    const aiImages = await db.select().from(generationJobsTable)
      .where(and(eq(generationJobsTable.projectId, projectId), eq(generationJobsTable.status, "succeeded")));
  
    const safeName = (project?.name ?? "proyecto").replace(/[^a-zA-Z0-9]/g, "_");
    const targetFmt = format === "jpeg" ? "jpg" : format;
    const zipName = `${safeName}_imagenes_${targetFmt.toUpperCase()}_${new Date().toISOString().split("T")[0]}.zip`;
  
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
  
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);
  
    let added = 0;
  
    async function processImage(buffer: Buffer, name: string, folder: string) {
      try {
        let outputBuffer: Buffer;
        let ext: string;
  
        if (format === "original") {
          outputBuffer = buffer;
          ext = "png";
        } else {
          let pipeline = sharp(buffer);
          if (targetFmt === "png") pipeline = pipeline.png({ quality: 100, compressionLevel: 0 });
          else if (targetFmt === "jpg") pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: "4:4:4" });
          else if (targetFmt === "webp") pipeline = pipeline.webp({ quality: 100, lossless: true });
          else if (targetFmt === "tiff") pipeline = pipeline.tiff({ quality: 100 });
          else if (targetFmt === "avif") pipeline = pipeline.avif({ quality: 100, lossless: true });
          outputBuffer = await pipeline.toBuffer();
          ext = targetFmt;
        }
  
        archive.append(outputBuffer, { name: `${folder}/${name}.${ext}` });
        added++;
      } catch {}
    }
  
    for (const file of imageFiles) {
      let buffer: Buffer | null = null;
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.category ?? "general";
  
      if (file.objectPath) {
        try {
          const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
          const response = await getStorage().downloadObject(gcsFile);
          buffer = Buffer.from(await response.arrayBuffer());
        } catch {}
      }
      if (!buffer && file.originalUrl) {
        try {
          const response = await fetch(file.originalUrl, { signal: AbortSignal.timeout(20000) });
          if (response.ok) buffer = Buffer.from(await response.arrayBuffer());
        } catch {}
      }
      if (buffer) await processImage(buffer, `${safeTitle}_${file.id}`, folder);
    }
  
    for (const job of aiImages) {
      if (!job.imageUrl) continue;
      try {
        const response = await fetch(job.imageUrl, { signal: AbortSignal.timeout(20000) });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const safeTitle = (job.altText || job.imageType || `imagen_${job.id}`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
          const folder = `ia_generadas/${job.imageType ?? "general"}`;
          await processImage(buffer, `${safeTitle}_${job.id}`, folder);
        }
      } catch {}
    }
  
    archive.append(JSON.stringify({
      project: project?.name,
      format: format === "original" ? "original (sin conversión)" : targetFmt.toUpperCase(),
      quality: "Máxima (100%)",
      totalImages: added,
      exportDate: new Date().toISOString(),
    }, null, 2), { name: "info_exportacion.json" });
  
    await archive.finalize();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png",
    "image/gif": "gif", "application/json": "json", "text/html": "html",
    "text/plain": "txt", "application/pdf": "pdf",
    "application/octet-stream": "bin",
    "image/tiff": "tiff", "image/avif": "avif",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
  };
  return map[mimeType] ?? "bin";
}

const B = {
  gold: "#c8a84b", goldLight: "#e6d9a8", goldDark: "#8b6914",
  dark: "#08080e", darkAlt: "#0c0c14", card: "#101018",
  surface: "#16161f", muted: "#6b6b80", mutedLight: "#9494a8",
  white: "#f0f0f5", border: "#1a1a28", borderLight: "#24243a",
  jade: "#34d399", jadeBg: "rgba(52,211,153,.08)",
  red: "#f43f5e", redBg: "rgba(244,63,94,.08)",
  orange: "#f59e0b", orangeBg: "rgba(245,158,11,.08)",
  blue: "#3b82f6", blueBg: "rgba(59,130,246,.08)",
};

function buildBrandedHtmlFromMetadata(file: {
  title: string; fileType: string | null; category: string | null;
  productTitle: string | null; generatedBy: string | null;
  createdAt: Date | string | null; metadata: unknown;
}, coverTemplate: CoverTemplate = "prestige"): string {
  const date = new Date(file.createdAt ?? Date.now()).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const time = new Date(file.createdAt ?? Date.now()).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const year = new Date().getFullYear();
  let meta: Record<string, unknown> = {};
  try { meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : (file.metadata ?? {}) as Record<string, unknown>; } catch { meta = {}; }

  function renderValue(val: unknown, depth = 0): string {
    if (val === null || val === undefined) return `<span style="color:${B.muted};">—</span>`;
    if (typeof val === "boolean") return val
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;background:${B.jadeBg};border:1px solid rgba(52,211,153,.2);border-radius:6px;font-size:12px;color:${B.jade};font-weight:600;">&#10003; S&iacute;</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;background:${B.redBg};border:1px solid rgba(244,63,94,.2);border-radius:6px;font-size:12px;color:${B.red};font-weight:600;">&#10007; No</span>`;
    if (typeof val === "number") return `<span style="color:${B.gold};font-weight:700;font-size:14px;">${val.toLocaleString("es-ES")}</span>`;
    if (typeof val === "string") {
      if (val.length > 300) return `<div style="white-space:pre-wrap;line-height:1.8;color:${B.white};font-size:13px;padding:12px 16px;background:${B.surface};border:1px solid ${B.border};border-radius:10px;margin:6px 0;">${sanitizeHtml(val)}</div>`;
      if (val.startsWith("http")) return `<a href="${sanitizeHtml(val)}" style="color:${B.gold};text-decoration:underline;font-weight:500;" target="_blank" rel="noopener">${sanitizeHtml(val.length > 80 ? val.slice(0, 77) + "..." : val)}</a>`;
      return `<span style="color:${B.white};">${sanitizeHtml(val)}</span>`;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return `<span style="color:${B.muted};font-style:italic;">vac&iacute;o</span>`;
      if (val.every(v => typeof v === "string" || typeof v === "number")) {
        return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0;">${val.map(v =>
          `<span style="display:inline-block;padding:3px 10px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.15);border-radius:6px;font-size:11px;color:${B.gold};font-weight:600;">${sanitizeHtml(String(v))}</span>`
        ).join("")}</div>`;
      }
      if (depth < 2) return val.map((item, i) => `<div style="margin:8px 0;padding:14px 16px;background:${B.surface};border:1px solid ${B.border};border-radius:10px;border-left:3px solid ${B.gold};"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="width:24px;height:24px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${B.gold};">${i + 1}</span></div>${renderObject(item, depth + 1)}</div>`).join("");
      return `<span style="color:${B.muted};">[${val.length} elementos]</span>`;
    }
    if (typeof val === "object" && depth < 3) return renderObject(val as Record<string, unknown>, depth + 1);
    return `<span style="color:${B.muted};">[objeto]</span>`;
  }

  function renderObject(obj: Record<string, unknown>, depth = 0): string {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "";
    return `<table style="width:100%;border-collapse:separate;border-spacing:0;margin:6px 0;font-size:13px;" cellpadding="0" cellspacing="0">
      ${depth === 0 ? `<thead><tr><th style="background:${B.surface};color:${B.gold};font-weight:700;text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-radius:8px 0 0 0;">Campo</th><th style="background:${B.surface};color:${B.gold};font-weight:700;text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-radius:0 8px 0 0;">Valor</th></tr></thead>` : ""}
      <tbody>${entries.map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
      return `<tr>
        <td style="padding:10px 14px;color:${B.gold};font-size:12px;font-weight:600;white-space:nowrap;vertical-align:top;width:180px;border-bottom:1px solid ${B.border};">${sanitizeHtml(label)}</td>
        <td style="padding:10px 14px;font-size:13px;color:${B.white};vertical-align:top;border-bottom:1px solid ${B.border};">${renderValue(v, depth)}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
  }

  const bodyHtml = typeof meta === "object" && !Array.isArray(meta)
    ? renderObject(meta as Record<string, unknown>)
    : renderValue(meta);

  const typeLabel = file.fileType === "report" ? "Informe" :
    file.fileType === "data" ? "Datos" :
    file.fileType === "optimization" ? "Optimizaci\u00f3n" :
    file.fileType === "seo" ? "SEO" : (file.fileType ?? "Archivo");

  const generatedByLabel = file.generatedBy === "chatbot_action_save" ? "Chatbot AI" :
    file.generatedBy === "auto_save" ? "Auto-guardado" :
    file.generatedBy === "bulk_operation" ? "Operaci\u00f3n masiva" :
    file.generatedBy ?? "Shopy Crafter AI";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sanitizeHtml(file.title)} — Shopy Crafter</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: ${B.dark}; color: ${B.white}; line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .page { max-width: 960px; margin: 0 auto; padding: 0; }
  .cover { background: linear-gradient(160deg, #0e0e18 0%, #12121f 50%, #0a0a14 100%); padding: 56px 56px 48px; border-bottom: 1px solid ${B.border}; position: relative; overflow: hidden; }
  .cover::before { content: ''; position: absolute; top: -120px; right: -80px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(200,168,75,.06) 0%, transparent 70%); pointer-events: none; }
  .cover::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, ${B.gold}44, transparent); }
  .cover-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; position: relative; z-index: 1; }
  .cover-logo { display: flex; align-items: center; gap: 12px; }
  .cover-logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, ${B.gold}, ${B.goldDark}); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #0a0a0f; }
  .cover-logo-text { font-size: 20px; font-weight: 800; color: ${B.gold}; letter-spacing: -0.3px; }
  .cover-badge { background: ${B.surface}; border: 1px solid ${B.borderLight}; border-radius: 8px; padding: 8px 16px; }
  .cover-badge-label { font-size: 10px; color: ${B.muted}; text-transform: uppercase; letter-spacing: 1.5px; }
  .cover-badge-value { font-size: 13px; color: ${B.white}; font-weight: 600; margin-top: 2px; }
  .cover-title { position: relative; z-index: 1; }
  .cover-title h1 { font-size: 28px; font-weight: 900; color: ${B.white}; letter-spacing: -0.8px; line-height: 1.2; }
  .cover-title .subtitle { font-size: 14px; color: ${B.mutedLight}; margin-top: 8px; font-weight: 400; }
  .cover-meta { display: flex; gap: 24px; margin-top: 24px; position: relative; z-index: 1; flex-wrap: wrap; }
  .cover-meta-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${B.muted}; }
  .cover-meta-dot { width: 6px; height: 6px; border-radius: 50%; background: ${B.gold}; }
  .body-content { padding: 40px 56px 48px; }
  .data-section { background: ${B.card}; border: 1px solid ${B.border}; border-radius: 14px; padding: 24px; overflow-x: auto; }
  .footer { padding: 32px 56px; border-top: 1px solid ${B.border}; background: ${B.darkAlt}; text-align: center; }
  .footer-line { width: 40px; height: 2px; background: ${B.gold}; margin: 0 auto 12px; border-radius: 1px; }
  .footer-brand { font-size: 14px; font-weight: 700; color: ${B.gold}; }
  .footer-sub { font-size: 11px; color: ${B.muted}; margin-top: 6px; }
  @media print {
    body { background: white; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
    .cover { background: #f8f7f4; padding: 32px; }
    .cover-title h1 { color: #1a1a1a; }
    .data-section { background: #fafafa; border: 1px solid #e0e0e0; }
  }
</style>
</head>
<body>
${buildCoverPage({ reportTitle: sanitizeHtml(file.title), reportSubtitle: sanitizeHtml(typeLabel), companyName: sanitizeHtml(file.title), date: date, template: coverTemplate })}
<div class="page">
  <div class="cover">
    <div class="cover-top">
      <div class="cover-logo">
        <div class="cover-logo-icon">SC</div>
        <div class="cover-logo-text">Shopy Crafter</div>
      </div>
      <div class="cover-badge">
        <div class="cover-badge-label">${sanitizeHtml(typeLabel)}</div>
        <div class="cover-badge-value">${sanitizeHtml(file.category || "General")}</div>
      </div>
    </div>
    <div class="cover-title">
      <h1>${sanitizeHtml(file.title)}</h1>
      ${file.productTitle ? `<div class="subtitle">Producto: ${sanitizeHtml(file.productTitle)}</div>` : `<div class="subtitle">Documento generado por Shopy Crafter AI</div>`}
    </div>
    <div class="cover-meta">
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>${sanitizeHtml(typeLabel)}</div>
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>${date} &middot; ${time}</div>
      <div class="cover-meta-item"><div class="cover-meta-dot"></div>${sanitizeHtml(generatedByLabel)}</div>
    </div>
  </div>
  <div class="body-content">
    <div class="data-section">
      ${bodyHtml}
    </div>
  </div>
  <div class="footer">
    <div class="footer-line"></div>
    <div class="footer-brand">Shopy Crafter</div>
    <div class="footer-sub">Shopy Crafter AI &mdash; shopycrafter.com</div>
    <div class="footer-sub">&copy; ${year} Shopy Crafter. Todos los derechos reservados.</div>
    <div class="footer-sub" style="margin-top:4px;">DOCUMENTO CONFIDENCIAL</div>
  </div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÓVEDA GLOBAL — Archivos de CUALQUIER empresa (con o sin proyecto registrado)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/vault/global/entities", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }
  
    const projectEntities = await db.select({
      entityName: projectsTable.name,
      entityUrl: projectsTable.shopDomain,
      projectId: projectsTable.id,
      fileCount: sql<number>`count(${projectFilesTable.id})`,
    })
      .from(projectsTable)
      .leftJoin(projectFilesTable, eq(projectFilesTable.projectId, projectsTable.id))
      .groupBy(projectsTable.id, projectsTable.name, projectsTable.shopDomain);
  
    const externalEntities = await db.select({
      entityName: projectFilesTable.entityName,
      entityUrl: projectFilesTable.entityUrl,
      fileCount: sql<number>`count(*)`,
      latestDate: sql<string>`max(${projectFilesTable.createdAt})`,
    })
      .from(projectFilesTable)
      .where(and(isNull(projectFilesTable.projectId), isNotNull(projectFilesTable.entityName)))
      .groupBy(projectFilesTable.entityName, projectFilesTable.entityUrl);
  
    const entities = [
      ...projectEntities.map(e => ({
        name: e.entityName,
        url: e.entityUrl,
        projectId: e.projectId,
        fileCount: Number(e.fileCount),
        source: "project" as const,
      })),
      ...externalEntities.map(e => ({
        name: e.entityName ?? "Sin nombre",
        url: e.entityUrl,
        projectId: null,
        fileCount: Number(e.fileCount),
        source: "external" as const,
        latestDate: e.latestDate,
      })),
    ].sort((a, b) => b.fileCount - a.fileCount);
  
    res.json({ entities, total: entities.length });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/vault/global", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }
  
    const { entityName, fileType, category, projectId, limit: rawLimit = "100", offset: rawOffset = "0" } = req.query as Record<string, string>;
  
    const parsedLimit = Math.min(Math.max(parseInt(rawLimit) || 100, 1), 500);
    const parsedOffset = Math.max(parseInt(rawOffset) || 0, 0);
  
    const conditions: any[] = [];
    if (entityName) {
      const parsedPid = projectId ? parseInt(projectId) : NaN;
      if (!isNaN(parsedPid)) {
        conditions.push(eq(projectFilesTable.projectId, parsedPid));
      } else {
        conditions.push(and(isNull(projectFilesTable.projectId), eq(projectFilesTable.entityName, entityName)));
      }
    }
    if (fileType) conditions.push(eq(projectFilesTable.fileType, fileType));
    if (category) conditions.push(eq(projectFilesTable.category, category));
  
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
    const files = await db.select({
      id: projectFilesTable.id,
      projectId: projectFilesTable.projectId,
      fileType: projectFilesTable.fileType,
      category: projectFilesTable.category,
      title: projectFilesTable.title,
      description: projectFilesTable.description,
      objectPath: projectFilesTable.objectPath,
      originalUrl: projectFilesTable.originalUrl,
      mimeType: projectFilesTable.mimeType,
      fileSizeBytes: projectFilesTable.fileSizeBytes,
      productId: projectFilesTable.productId,
      productTitle: projectFilesTable.productTitle,
      generatedBy: projectFilesTable.generatedBy,
      metadata: projectFilesTable.metadata,
      entityName: projectFilesTable.entityName,
      entityUrl: projectFilesTable.entityUrl,
      hasContent: sql<boolean>`${projectFilesTable.content} IS NOT NULL`.as("has_content"),
      createdAt: projectFilesTable.createdAt,
    }).from(projectFilesTable)
      .where(whereClause)
      .orderBy(desc(projectFilesTable.createdAt))
      .limit(parsedLimit)
      .offset(parsedOffset);
  
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(projectFilesTable).where(whereClause);
  
    const filesWithUrls = files.map(f => ({
      ...f,
      hasContent: undefined,
      downloadUrl: (f.objectPath || f.hasContent)
        ? (f.projectId
            ? `/api/projects/${f.projectId}/vault/${f.id}/download`
            : `/api/vault/global/${f.id}/download`)
        : f.originalUrl ?? null,
      previewUrl: (f.objectPath || f.hasContent || f.metadata)
        ? (f.projectId
            ? `/api/projects/${f.projectId}/vault/${f.id}/preview`
            : `/api/vault/global/${f.id}/preview`)
        : null,
    }));
  
    res.json({ files: filesWithUrls, total: Number(count) });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/vault/global/save", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }
  
    const { title, content, fileType, category, entityName, entityUrl, projectId, productId, productTitle, metadata, generatedBy } = req.body;
    if (!title || !content || !fileType) {
      res.status(400).json({ error: "title, content y fileType son requeridos" }); return;
    }
    if (!entityName && !projectId) {
      res.status(400).json({ error: "entityName o projectId es requerido" }); return;
    }
  
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const displayName = entityName || "Entidad";
  
    const htmlReport = generateProfessionalReport({
      title: sanitizeHtml(title), content, entityName: sanitizeHtml(displayName), date, time,
    });
  
    const htmlBuffer = Buffer.from(htmlReport, "utf-8");
    const safeName = title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").replace(/\s+/g, "_").slice(0, 80);
    const safeEntity = (entityName || "external").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
    const objectPath = projectId
      ? `projects/${projectId}/${fileType}/${safeName}_${Date.now()}.html`
      : `global/${safeEntity}/${fileType}/${safeName}_${Date.now()}.html`;
  
    let savedPath: string | null = null;
    try {
      const gcsFile = await getStorage().getObjectEntityFile(objectPath);
      await getStorage().uploadObject(gcsFile, htmlBuffer, "text/html");
      savedPath = objectPath;
    } catch (uploadErr: any) {
      logger.warn({ err: uploadErr }, "Object storage upload failed for global vault report");
    }
  
    const validProjectId = projectId ? parseInt(String(projectId)) : null;
    if (projectId && (isNaN(validProjectId!) || validProjectId! <= 0)) {
      res.status(400).json({ error: "projectId inválido" }); return;
    }
  
    const [saved] = await db.insert(projectFilesTable).values({
      projectId: validProjectId,
      fileType,
      category: category || null,
      title,
      description: `Informe guardado el ${date} a las ${time}`,
      objectPath: savedPath,
      mimeType: "text/html",
      fileSizeBytes: htmlBuffer.length,
      productId: productId || null,
      productTitle: productTitle || null,
      generatedBy: generatedBy || "manual_save",
      metadata: metadata ? JSON.stringify(metadata) : null,
      content: savedPath ? null : htmlReport,
      entityName: entityName || null,
      entityUrl: entityUrl || null,
      isPublic: 0,
    }).returning();
  
    res.json({ success: true, fileId: saved.id, title, fileType, entityName });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/vault/global/:fileId/download", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }
  
    const fileId = parseInt(String(req.params.fileId));
    if (isNaN(fileId)) { res.status(400).json({ error: "fileId inválido" }); return; }
  
    const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, fileId)).limit(1);
    if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }
  
    const filename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.html`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
  
    if (file.objectPath) {
      try {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
        return;
      } catch { /* fallback */ }
    }
  
    if (file.content) {
      const isJson = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
      if (isJson) {
        try {
          const parsed = JSON.parse(file.content);
          const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
          res.send(htmlReport);
          return;
        } catch {}
      }
      res.send(file.content);
      return;
    }
  
    if (file.metadata) {
      const reportHtml = metadataToReportHtml(file);
      res.send(reportHtml);
      return;
    }
  
    res.status(404).json({ error: "No se pudo recuperar el archivo" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/vault/global/:fileId/preview", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }

    const fileId = parseInt(String(req.params.fileId));
    if (isNaN(fileId)) { res.status(400).json({ error: "fileId inválido" }); return; }

    const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, fileId)).limit(1);
    if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }

    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:;");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (file.objectPath) {
      try {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
        return;
      } catch { /* fallback */ }
    }

    if (file.content) {
      const isJson = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
      if (isJson) {
        try {
          const parsed = JSON.parse(file.content);
          const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
          res.send(htmlReport);
          return;
        } catch {}
      }
      res.send(file.content);
      return;
    }

    if (file.metadata) {
      const reportHtml = metadataToReportHtml(file);
      res.send(reportHtml);
      return;
    }

    res.status(404).json({ error: "Archivo ya no disponible" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/vault/global/download-selected", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }
  
    const { fileIds, entityName } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0 || fileIds.length > 500) {
      res.status(400).json({ error: "fileIds (array 1-500) es requerido" }); return;
    }
    const numericIds = fileIds.map((id: unknown) => parseInt(String(id))).filter((n: number) => !isNaN(n));
    if (numericIds.length === 0) { res.status(400).json({ error: "fileIds inválidos" }); return; }
  
    const files = await db.select().from(projectFilesTable)
      .where(sql`${projectFilesTable.id} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);
  
    if (files.length === 0) { res.status(404).json({ error: "No se encontraron archivos" }); return; }
  
    const zipName = entityName
      ? `${entityName.replace(/[^a-zA-Z0-9._-]/g, "_")}_vault.zip`
      : `global_vault_${Date.now()}.zip`;
  
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    res.setHeader("Content-Type", "application/zip");
  
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);
  
    for (const file of files) {
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.fileType || "otros";

      if (file.objectPath) {
        try {
          const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
          const response = await getStorage().downloadObject(gcsFile);
          const buffer = Buffer.from(await response.arrayBuffer());
          archive.append(buffer, { name: `${folder}/${safeTitle}_${file.id}.html` });
          continue;
        } catch { /* fallback */ }
      }
      if (file.content) {
        const isJsonContent = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
        if (isJsonContent) {
          try {
            const parsed = JSON.parse(file.content);
            const htmlReport = buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, "prestige");
            archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
          } catch {
            archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
          }
        } else {
          archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
        }
      } else if (file.metadata) {
        const html = metadataToReportHtml(file);
        archive.append(html, { name: `${folder}/${safeTitle}_${file.id}.html` });
      }
    }
  
    await archive.finalize();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.delete("/vault/global/:fileId", requireAuth, async (req, res): Promise<void> => {
  try {
    const session = req.session as any;
    if (session.role !== "admin") { res.status(403).json({ error: "Solo admin" }); return; }
  
    const fileId = parseInt(String(req.params.fileId));
    if (isNaN(fileId)) { res.status(400).json({ error: "fileId inválido" }); return; }
  
    const [file] = await db.select({ id: projectFilesTable.id, objectPath: projectFilesTable.objectPath })
      .from(projectFilesTable).where(eq(projectFilesTable.id, fileId)).limit(1);
    if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }
  
    if (file.objectPath) {
      try {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        await getStorage().deleteObject(gcsFile);
      } catch { /* best effort */ }
    }
  
    await db.delete(projectFilesTable).where(eq(projectFilesTable.id, fileId));
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

function generateProfessionalReport(opts: { title: string; content: string; entityName: string; date: string; time: string }): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${sanitizeHtml(opts.title)} — ${sanitizeHtml(opts.entityName)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0f; color: #f5f5f7; line-height: 1.7; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
  .header { border-bottom: 2px solid #c8a84b; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-left h1 { font-size: 24px; font-weight: 800; color: #c8a84b; }
  .header-left p { font-size: 13px; color: #8b8b9e; margin-top: 4px; }
  .header-right { text-align: right; font-size: 12px; color: #8b8b9e; }
  .header-right .brand { font-size: 11px; color: #c8a84b; font-weight: 700; margin-bottom: 2px; }
  .content { font-size: 14px; color: #d0d0d8; }
  .content h2 { font-size: 18px; font-weight: 700; color: #c8a84b; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #1e1e2e; }
  .content h3 { font-size: 15px; font-weight: 700; color: #f5f5f7; margin: 20px 0 8px; }
  .content p { margin: 8px 0; }
  .content ul, .content ol { margin: 8px 0 8px 20px; }
  .content li { margin: 4px 0; }
  .content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  .content th { background: #111118; color: #c8a84b; padding: 10px 12px; text-align: left; font-weight: 700; border-bottom: 2px solid #c8a84b; }
  .content td { padding: 8px 12px; border-bottom: 1px solid #1e1e2e; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
  .metric-card { background: #111118; border: 1px solid #1e1e2e; border-radius: 10px; padding: 16px; }
  .metric-card .label { font-size: 11px; color: #8b8b9e; text-transform: uppercase; }
  .metric-card .value { font-size: 22px; font-weight: 800; color: #f5f5f7; margin-top: 4px; }
  .section { background: #111118; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin: 16px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1e1e2e; font-size: 11px; color: #8b8b9e; text-align: center; }
  @media print { body { background: white; color: #111; } .page { padding: 20px; } .header { border-color: #c8a84b; } .content th { background: #f5f5f5; color: #111; } .content td { border-color: #ddd; } .section { background: #f9f9f9; border-color: #ddd; } .metric-card { background: #f5f5f5; border-color: #ddd; } }
</style>
</head>
<body>
${buildCoverPage({ reportTitle: sanitizeHtml(opts.title), reportSubtitle: sanitizeHtml(opts.entityName), companyName: sanitizeHtml(opts.entityName), date: opts.date, template: "classic" })}
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>${sanitizeHtml(opts.title)}</h1>
      <p>${sanitizeHtml(opts.entityName)} — Generado por Shopy Crafter AI</p>
    </div>
    <div class="header-right">
      <div class="brand">SHOPY CRAFTER</div>
      <div>${opts.date}</div>
      <div>${opts.time}</div>
    </div>
  </div>
  <div class="content">
    ${opts.content}
  </div>
  <div class="footer">
    Shopy Crafter AI Intelligence &middot; ${opts.date} &middot; Informe confidencial<br>
    &copy; ${year} Shopy Crafter. Todos los derechos reservados.
  </div>
</div>
</body>
</html>`;
}

export default router;
