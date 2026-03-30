import { Router } from "express";
import { createRequire } from "module";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { generationJobsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

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
  }));

  res.json({ files: filesWithUrls, total: Number(count) });
});

// ─── STATS DEL VAULT ─────────────────────────────────────────────────────────
router.get("/projects/:projectId/vault/stats", requireAuth, async (req, res): Promise<void> => {
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
});

// ─── GUARDAR INFORME PROFESIONAL EN EL VAULT ────────────────────────────────
router.post("/projects/:projectId/vault/save-report", requireAuth, async (req, res): Promise<void> => {
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
    const buf = Buffer.from(file.content, "utf-8");
    res.setHeader("Content-Type", file.mimeType ?? "text/html");
    res.send(buf);
    return;
  }

  // Para archivos solo-metadata (rediseños, reportes SEO, etc.) — servir metadata como JSON
  if (file.metadata) {
    try {
      const meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : file.metadata;
      const jsonFilename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${jsonFilename}"`);
      res.setHeader("Content-Type", "application/json");
      res.json({
        title: file.title,
        fileType: file.fileType,
        category: file.category,
        productTitle: file.productTitle,
        generatedBy: file.generatedBy,
        createdAt: file.createdAt,
        data: meta,
      });
      return;
    } catch {}
  }

  res.status(410).json({ error: "Archivo ya no disponible en origen" });
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
        const htmlName = `${folder}/${safeTitle}_${file.id}.html`;
        archive.append(file.content, { name: htmlName });
        added++;
      } else if (file.metadata) {
        // Archivos solo-metadata (rediseños, reportes SEO): serializar como JSON
        const meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : file.metadata;
        const jsonContent = JSON.stringify({
          title: file.title,
          fileType: file.fileType,
          category: file.category,
          productTitle: file.productTitle,
          generatedBy: file.generatedBy,
          createdAt: file.createdAt,
          data: meta,
        }, null, 2);
        const jsonName = `${file.fileType}/${safeTitle}_${file.id}.json`;
        archive.append(jsonContent, { name: jsonName });
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
        const htmlName = `${folder}/${safeTitle}_${file.id}.html`;
        archive.append(file.content, { name: htmlName });
        added++;
      } else if (file.metadata) {
        const meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : file.metadata;
        const jsonContent = JSON.stringify({
          title: file.title, fileType: file.fileType, category: file.category,
          productTitle: file.productTitle, generatedBy: file.generatedBy,
          createdAt: file.createdAt, data: meta,
        }, null, 2);
        const jsonName = `${file.fileType}/${safeTitle}_${file.id}.json`;
        archive.append(jsonContent, { name: jsonName });
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
});

// ─── REGISTRAR ARCHIVO GENERADO (llamado internamente por los motores) ────────
router.post("/projects/:projectId/vault/register", requireAuth, async (req, res): Promise<void> => {
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
});

// ─── ELIMINAR ARCHIVO (solo admin) ───────────────────────────────────────────
router.delete("/projects/:projectId/vault/:fileId", requireAuth, async (req, res): Promise<void> => {
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
});

// ─── DESCARGAR IMAGEN EN FORMATO ESPECÍFICO (PNG/JPG/WEBP) ──────────────────
router.get("/projects/:projectId/vault/:fileId/download/:format", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId));
  const fileId = parseInt(String(req.params.fileId));
  const format = (req.params.format || "png").toLowerCase();

  if (!["png", "jpg", "jpeg", "webp", "tiff", "avif"].includes(format)) {
    res.status(400).json({ error: "Formato no soportado. Usa: png, jpg, webp, tiff, avif" }); return;
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
    const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

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
});

// ─── DESCARGAR TODAS LAS IMÁGENES EN FORMATO ESPECÍFICO (ZIP) ───────────────
router.get("/projects/:projectId/vault/download-images/:format", requireAuth, async (req, res): Promise<void> => {
  const projectId = parseInt(String(req.params.projectId));
  const format = (req.params.format || "png").toLowerCase();

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
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png",
    "image/gif": "gif", "application/json": "json", "text/html": "html",
    "text/plain": "txt", "application/pdf": "pdf",
    "application/octet-stream": "bin",
    "image/tiff": "tiff", "image/avif": "avif",
  };
  return map[mimeType] ?? "bin";
}

export default router;
