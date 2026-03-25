import { Router } from "express";
import { createRequire } from "module";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { generationJobsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
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

  const files = await db.select().from(projectFilesTable)
    .where(and(...conditions))
    .orderBy(desc(projectFilesTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, projectId));

  // Añadir URL de acceso a cada archivo
  const filesWithUrls = files.map(f => ({
    ...f,
    downloadUrl: f.objectPath
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
  archive.append(JSON.stringify({ project: project?.name, projectId, totalFiles: files.length, exportedFiles: added, files }, null, 2), {
    name: "vault_index.json",
  });

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
    res.send(outputBuffer);
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
