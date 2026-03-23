import { Router } from "express";
import { createRequire } from "module";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

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
  const projectId = parseInt(req.params.projectId);
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
  const projectId = parseInt(req.params.projectId);
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
  const projectId = parseInt(req.params.projectId);
  const fileId = parseInt(req.params.fileId);
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
      if (response.ok && response.body) {
        response.body.pipe(res as any);
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
  const projectId = parseInt(req.params.projectId);
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
  const projectId = parseInt(req.params.projectId);
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

  const projectId = parseInt(req.params.projectId);
  const fileId = parseInt(req.params.fileId);

  const [file] = await db.select().from(projectFilesTable)
    .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId))).limit(1);

  if (!file) { res.status(404).json({ error: "Archivo no encontrado" }); return; }

  await db.delete(projectFilesTable)
    .where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)));

  res.json({ success: true });
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png",
    "image/gif": "gif", "application/json": "json", "text/html": "html",
    "text/plain": "txt", "application/pdf": "pdf",
    "application/octet-stream": "bin",
  };
  return map[mimeType] ?? "bin";
}

export default router;
