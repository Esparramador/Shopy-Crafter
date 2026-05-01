import { Router } from "express";
import { createRequire } from "module";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { generationJobsTable } from "@workspace/db/schema";
import { eq, and, desc, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { canAccessProject } from "../lib/access.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { logger } from "../lib/logger.js";
import { setupZipStream, isBinaryMime, isAlreadyCompressed, extForMime, sniffMimeFromMagic } from "../lib/zip-stream.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import { readFile, stat, realpath } from "fs/promises";
import path from "path";
import os from "os";
import sharp from "sharp";

// Mismo directorio raíz que `vault.ts` usa para escribir los fallbacks.
// MANTENER SINCRONIZADO con `lib/vault.ts::DISK_FALLBACK_DIR`.
const DISK_FALLBACK_ROOT = path.join(os.tmpdir(), "vault-fallback");

/**
 * Recupera la ruta del disk-fallback registrada por saveToVault cuando OS
 * estuvo caído. Devuelve { buffer, mime } o null si no existe / no se puede leer.
 *
 * SEGURIDAD CRÍTICA: el campo `metadata` de un proyecto puede contener input
 * controlado por el usuario (p.ej. `save-report` lo acepta de req.body). Por
 * eso validamos:
 *  1) La ruta resuelta (realpath) debe vivir bajo `DISK_FALLBACK_ROOT/<projectId>/`.
 *  2) Sin esto, un usuario podría inyectar `diskFallbackPath:"/etc/passwd"` y
 *     usar este endpoint como LFI arbitrario.
 *
 * Usado como prioridad inmediatamente después de objectPath en TODAS las rutas
 * de descarga (single, preview, ZIP) para garantizar que ningún asset se pierda.
 */
async function tryDiskFallback(
  metadataRaw: string | null,
  projectId: number | null | undefined,
  fallbackMime?: string | null,
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!metadataRaw || projectId == null || !Number.isFinite(projectId)) return null;
  try {
    const meta = JSON.parse(metadataRaw) as Record<string, unknown>;
    const claimed = typeof meta?.diskFallbackPath === "string" ? meta.diskFallbackPath : null;
    if (!claimed) return null;

    // Whitelist estricta: la ruta canónica DEBE vivir bajo
    // /tmp/vault-fallback/<projectId>/...  Si no, abortamos.
    const allowedRoot = path.resolve(DISK_FALLBACK_ROOT, String(projectId)) + path.sep;
    let real: string;
    try {
      real = await realpath(claimed);
    } catch {
      return null; // ruta no existe — no la inventamos
    }
    if (!real.startsWith(allowedRoot)) {
      logger.error(
        { claimed, real, allowedRoot, projectId },
        "🚨 diskFallback path traversal attempt blocked",
      );
      return null;
    }
    const st = await stat(real);
    if (!st.isFile()) return null;
    const buf = await readFile(real);
    return { buffer: buf, mime: fallbackMime || "application/octet-stream" };
  } catch (err: any) {
    logger.warn({ err: err?.message, projectId }, "diskFallback read failed");
    return null;
  }
}

const require = createRequire(import.meta.url);
const archiver = require("archiver");

async function metadataToReportHtml(file: { title: string; metadata: string | null; fileType: string; description?: string | null; category?: string | null; productTitle?: string | null; generatedBy?: string | null; createdAt?: Date | string | null }): Promise<string> {
  return await buildBrandedHtmlFromMetadata({
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
// canAccessProject moved to ../lib/access.ts (canonical, shared helper).

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

  // PRIORIDAD: objectPath → diskFallback → content → originalUrl → metadata
  // El contenido REAL guardado siempre gana sobre re-fetchar la URL origen
  // (evita que un análisis o una edición devuelvan la web actual del cliente
  // en vez del artefacto que el usuario guardó en su día).
  if (file.objectPath) {
    try {
      const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
      const response = await getStorage().downloadObject(gcsFile);
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
      return;
    } catch { /* fallback to diskFallback/content/originalUrl */ }
  }

  // Disk fallback: registros guardados cuando OS estaba caído.
  {
    const df = await tryDiskFallback(file.metadata, file.projectId, file.mimeType);
    if (df) { res.send(df.buffer); return; }
  }

  if (file.content) {
    const isJson = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
    if (isJson) {
      try {
        const parsed = JSON.parse(file.content);
        const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
        const htmlFilename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.html`;
        res.setHeader("Content-Disposition", `attachment; filename="${htmlFilename}"`);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(htmlReport);
        return;
      } catch {}
    }
    // FIX: binary mime types are stored as base64 in `content` by saveToVaultSmart
    // (when buffer < 2MB and object storage isn't used). Decode them properly
    // instead of sending the base64 string as utf-8 (which corrupts binaries).
    const mt = file.mimeType ?? "text/html";
    const isBinary = !mt.startsWith("text/")
      && !mt.startsWith("application/json")
      && !mt.startsWith("application/xml")
      && !mt.startsWith("application/javascript")
      && !mt.includes("+xml")
      && !mt.includes("+json");
    const buf = isBinary
      ? Buffer.from(file.content, "base64")
      : Buffer.from(file.content, "utf-8");
    res.setHeader("Content-Type", mt);
    res.send(buf);
    return;
  }

  if (file.metadata) {
    try {
      const htmlReport = await buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
      const htmlFilename = `${file.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.html`;
      res.setHeader("Content-Disposition", `attachment; filename="${htmlFilename}"`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(htmlReport);
      return;
    } catch {}
  }

  // Último recurso: si no hay objectPath, content ni metadata, intentamos
  // re-fetchar la URL original (sólo aplica a registros legacy de imágenes
  // que se referenciaban sin clonar).
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
  res.setHeader("X-Content-Type-Options", "nosniff");

  // === Clasificación correcta del Content-Type para PREVIEW ===
  // BUG previo: forzábamos `text/html` para TODO archivo "no binario", lo que
  // significaba que CSS/JS/JSON/SVG/XML se servían como HTML y el navegador los
  // interpretaba mal (CSS aparecía como texto sin estilos, etc.).
  //
  // Ahora clasificamos en 4 categorías:
  //  - "binary": image/* (no SVG), video/*, audio/*, application/pdf, application/zip, etc.
  //              → Content-Type = mime real, sin CSP.
  //  - "html":   text/html (o JSON renderizado a HTML por el branch JSON-as-report).
  //              → Content-Type = text/html, CSP estricta (defensa XSS).
  //  - "svg":    image/svg+xml. SVG puede contener <script> → CSP estricta
  //              + Content-Type real para que el navegador lo renderice.
  //  - "other-text": text/css, text/javascript, application/json, application/xml,
  //              text/plain, etc. → Content-Type = mime real (CSS aplica estilos,
  //              JS se ejecuta si se abre directo, JSON se ve formateado por el
  //              navegador). Sin CSP de "default-src 'none'" porque rompería el
  //              renderizado nativo del navegador y no es una superficie de XSS
  //              en sí misma (el origen está en CORS y same-origin policy).
  const mimeType = file.mimeType ?? null;
  const STRICT_CSP = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:;";

  type PreviewKind = "binary" | "html" | "svg" | "other-text";
  function classifyKind(mt: string | null): PreviewKind {
    if (!mt) return "binary"; // sin mime conocido → tratar como binario (octet-stream)
    if (mt === "image/svg+xml" || mt.includes("svg+xml")) return "svg";
    if (mt === "text/html" || mt.startsWith("text/html")) return "html";
    if (mt.startsWith("text/")
      || mt === "application/json" || mt === "application/xml"
      || mt === "application/javascript" || mt === "application/ecmascript"
      || mt.endsWith("+xml") || mt.endsWith("+json")) {
      return "other-text";
    }
    return "binary";
  }

  let kind: PreviewKind = classifyKind(mimeType);

  // Si es JSON con metadata legacy (informes pre-buildBrandedHtmlFromMetadata),
  // se renderizará a HTML más abajo. En ese caso forzamos kind="html" y se
  // sobreescribe el Content-Type ANTES de enviar (no antes de saber).
  // Esto se decide diferido en el branch `isJson` más abajo.

  function applyHeadersForKind(k: PreviewKind) {
    if (k === "binary") {
      res.setHeader("Content-Type", mimeType ?? "application/octet-stream");
    } else if (k === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", STRICT_CSP);
    } else if (k === "svg") {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Content-Security-Policy", STRICT_CSP);
    } else { // other-text
      res.setHeader("Content-Type", mimeType ?? "text/plain; charset=utf-8");
    }
  }
  applyHeadersForKind(kind);

  if (file.objectPath) {
    try {
      const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
      const response = await getStorage().downloadObject(gcsFile);
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
      return;
    } catch { /* fallback */ }
  }

  // Disk fallback (preview): registros guardados cuando OS estaba caído.
  {
    const df = await tryDiskFallback(file.metadata, file.projectId, file.mimeType);
    if (df) { res.send(df.buffer); return; }
  }

  if (file.content) {
    if (kind === "binary") {
      // Binarios (image/png, image/jpeg, application/pdf, etc.) se guardan como base64.
      const buf = Buffer.from(file.content, "base64");
      res.send(buf);
      return;
    }
    // JSON-as-report (legacy): solo si el JSON contiene un objeto con
    // estructura de informe. Lo detectamos por mimeType=application/json en
    // entries antiguos donde el `content` es un JSON serializable a HTML.
    const isJsonReport = (file.mimeType === "application/json")
      && (!!file.metadata || file.fileType === "report");
    if (isJsonReport) {
      try {
        const parsed = JSON.parse(file.content);
        const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
        // Reemplazar headers (eran application/json) con html+CSP.
        res.removeHeader("Content-Type");
        applyHeadersForKind("html");
        res.send(htmlReport);
        return;
      } catch { /* si el JSON no parsea, caemos al envío crudo abajo */ }
    }
    // Texto plano (CSS, JS, JSON, XML, HTML, SVG): enviamos el contenido tal cual
    // con el Content-Type correcto ya seteado en applyHeadersForKind().
    res.send(file.content);
    return;
  }

  // Fallback: intentar servir el binario desde la URL original (Replicate, etc.)
  // antes de devolver 410. Si responde, lo proxyamos con el Content-Type real.
  if (file.originalUrl) {
    try {
      const resp = await fetch(file.originalUrl, { signal: AbortSignal.timeout(15_000) });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        if (kind !== "binary" && mimeType) res.setHeader("Content-Type", mimeType);
        res.send(buf);
        return;
      }
    } catch {}
  }

  // Para imágenes/binarios sin contenido recuperable, no devolvemos HTML
  // (rompería el <img>). Devolvemos 410 y dejamos que el `onError` del frontend
  // muestre el placeholder.
  if (file.metadata && kind !== "binary") {
    try {
      const htmlReport = await buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
      // Forzamos text/html porque el report es un wrapper HTML del metadata.
      res.removeHeader("Content-Type");
      applyHeadersForKind("html");
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

  // RFC 5987: filename* permite tildes/eñes correctamente (Windows + Mac).
  const baseName = (project?.name ?? "tienda");
  const asciiName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_") + "_vault.zip";
  const utf8Name = encodeURIComponent(baseName + "_vault.zip");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);

  // forceUTF8 garantiza que nombres de entrada con tildes funcionen en Windows.
  const archive = archiver("zip", { zlib: { level: 6 }, forceUTF8: true } as any);
  const { ac, isClientGone, markFinalizing } = setupZipStream(req, res, archive);
  archive.pipe(res);

  let added = 0;
  let skipped = 0;
  for (const file of files) {
    if (isClientGone()) { logger.info({ projectId, added }, "ZIP cancelado por cliente, abortando bucle"); break; }
    try {
      const ext = getExtension(file.mimeType ?? "application/octet-stream");
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.fileType === "image" ? `imagenes/${file.category ?? "general"}` : file.fileType;
      const entryName = `${folder}/${safeTitle}_${file.id}.${ext}`;

      if (file.objectPath) {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        const buffer = Buffer.from(await response.arrayBuffer());
        // STORE para binarios ya comprimidos (jpg/png/mp4/pdf...) → ahorra
        // CPU y elimina riesgo de fallar DEFLATE sobre buffers de >100MB.
        archive.append(buffer, { name: entryName, store: isAlreadyCompressed(file.mimeType) });
        added++;
      } else if (await tryDiskFallback(file.metadata, file.projectId, file.mimeType).then(d => {
        if (!d) return false;
        archive.append(d.buffer, { name: entryName, store: isAlreadyCompressed(file.mimeType) });
        added++;
        return true;
      })) {
        // disk fallback handled inside the predicate
      } else if (file.content) {
        if (isBinaryMime(file.mimeType)) {
          try {
            const buf = Buffer.from(file.content, "base64");
            // Sniff por magic: si la base64 estaba mal y los bytes no son
            // realmente del tipo declarado, ajustamos extensión.
            const sniffed = sniffMimeFromMagic(buf);
            const realMime = sniffed ?? file.mimeType;
            const realExt = extForMime(realMime);
            archive.append(buf, { name: `${folder}/${safeTitle}_${file.id}.${realExt}`, store: isAlreadyCompressed(realMime) });
            added++;
          } catch (e: any) {
            skipped++;
            logger.warn({ fileId: file.id, err: e?.message }, "ZIP: failed to decode base64 binary");
          }
        } else {
          const isJsonContent = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
          if (isJsonContent) {
            try {
              const parsed = JSON.parse(file.content);
              const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
              archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
            } catch {
              archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
            }
          } else {
            // Mime de texto conocido → respeta su extensión (txt/csv/md/css/js/xml...)
            const textExt = extForMime(file.mimeType ?? "text/html");
            archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.${textExt}` });
          }
          added++;
        }
      } else if (file.metadata) {
        const htmlReport = await buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
        archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
        added++;
      } else if (file.originalUrl) {
        // Sólo cuando NO hay objectPath/content/metadata: re-fetchamos.
        const response = await fetch(file.originalUrl, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(30000)]) });
        if (response.ok && response.body) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const sniffed = sniffMimeFromMagic(buffer);
          const realMime = sniffed ?? file.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream";
          const realExt = sniffed ? extForMime(sniffed) : ext;
          const finalName = `${folder}/${safeTitle}_${file.id}.${realExt}`;
          archive.append(buffer, { name: finalName, store: isAlreadyCompressed(realMime) });
          added++;
        } else {
          skipped++;
          logger.warn({ fileId: file.id, status: response.status, url: file.originalUrl }, "ZIP: originalUrl no disponible");
        }
      } else {
        skipped++;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") break;
      skipped++;
      logger.warn({ err: err?.message, fileId: file.id }, "ZIP: skipped failed file");
    }
  }

  // SIEMPRE finalize (incluso si el cliente abortó) para garantizar central
  // directory bien escrito. markFinalizing() ignora aborts subsiguientes.
  const indexFiles = files.map(({ content, ...rest }) => rest);
  try {
    archive.append(JSON.stringify({
      project: project?.name, projectId,
      totalFiles: files.length, exportedFiles: added, skippedFiles: skipped,
      generatedAt: new Date().toISOString(),
      files: indexFiles,
    }, null, 2), { name: "vault_index.json" });
  } catch {}
  markFinalizing();
  try {
    await archive.finalize();
    logger.info({ projectId, added, skipped, total: files.length }, "ZIP download-all completado");
  } catch (err: any) {
    logger.error({ err: err?.message, projectId }, "ZIP download-all finalize failed");
  }
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

  // Acepta dos formatos:
  //   1) JSON body: { fileIds, folderTypes }
  //   2) form-urlencoded body: { _payload: '{"fileIds":[...]}' }
  //      ← usado por el frontend para descarga nativa sin bufferear en RAM.
  let parsedBody: { fileIds?: number[]; folderTypes?: string[] } = {};
  if (req.body && typeof req.body._payload === "string") {
    try { parsedBody = JSON.parse(req.body._payload); }
    catch { res.status(400).json({ error: "_payload inválido" }); return; }
  } else if (req.body && typeof req.body === "object") {
    parsedBody = req.body as any;
  }
  const { fileIds, folderTypes } = parsedBody;

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
        inArray(projectFilesTable.fileType, folderTypes)
      ))
      .orderBy(projectFilesTable.fileType, projectFilesTable.createdAt);
  } else {
    const numericIds = fileIds!.map(Number).filter((n) => !isNaN(n));
    if (numericIds.length === 0) { res.status(400).json({ error: "fileIds inválidos" }); return; }
    files = await db.select().from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        inArray(projectFilesTable.id, numericIds)
      ))
      .orderBy(projectFilesTable.fileType, projectFilesTable.createdAt);
  }

  if (files.length === 0) { res.status(404).json({ error: "No se encontraron archivos" }); return; }

  const label = folderTypes ? folderTypes.join("_") : `seleccion_${files.length}`;
  const baseName = `${project?.name ?? "tienda"}_${label}.zip`;
  const asciiName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const utf8Name = encodeURIComponent(baseName);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);

  const archive = archiver("zip", { zlib: { level: 6 }, forceUTF8: true } as any);
  const { ac, isClientGone, markFinalizing } = setupZipStream(req, res, archive);
  archive.pipe(res);

  let added = 0;
  let skipped = 0;
  for (const file of files) {
    if (isClientGone()) { logger.info({ projectId, added }, "ZIP cancelado por cliente"); break; }
    try {
      const ext = getExtension(file.mimeType ?? "application/octet-stream");
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.fileType === "image" ? `imagenes/${file.category ?? "general"}` : file.fileType;
      const entryName = `${folder}/${safeTitle}_${file.id}.${ext}`;

      if (file.objectPath) {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const response = await getStorage().downloadObject(gcsFile);
        const buffer = Buffer.from(await response.arrayBuffer());
        archive.append(buffer, { name: entryName, store: isAlreadyCompressed(file.mimeType) });
        added++;
      } else if (file.content) {
        if (isBinaryMime(file.mimeType)) {
          // Binario almacenado como base64 en DB (fallback cuando GCS falló).
          // Decodificamos y guardamos con la extensión real (mp4/jpg/png/...).
          try {
            const buf = Buffer.from(file.content, "base64");
            const sniffed = sniffMimeFromMagic(buf);
            const realMime = sniffed ?? file.mimeType;
            const realExt = extForMime(realMime);
            archive.append(buf, { name: `${folder}/${safeTitle}_${file.id}.${realExt}`, store: isAlreadyCompressed(realMime) });
            added++;
          } catch (e: any) {
            skipped++;
            logger.warn({ fileId: file.id, err: e?.message }, "ZIP: failed to decode base64 binary");
          }
        } else {
          const isJsonContent = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
          if (isJsonContent) {
            try {
              const parsed = JSON.parse(file.content);
              const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
              archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
            } catch {
              archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
            }
          } else {
            const textExt = extForMime(file.mimeType ?? "text/html");
            archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.${textExt}` });
          }
          added++;
        }
      } else if (file.metadata) {
        const htmlReport = await buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
        archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
        added++;
      } else if (file.originalUrl) {
        // Sólo cuando NO hay objectPath/content/metadata.
        const response = await fetch(file.originalUrl, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(30000)]) });
        if (response.ok && response.body) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const sniffed = sniffMimeFromMagic(buffer);
          const realMime = sniffed ?? file.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream";
          const realExt = sniffed ? extForMime(sniffed) : ext;
          archive.append(buffer, { name: `${folder}/${safeTitle}_${file.id}.${realExt}`, store: isAlreadyCompressed(realMime) });
          added++;
        } else {
          skipped++;
          logger.warn({ fileId: file.id, status: response.status }, "ZIP: originalUrl no disponible");
        }
      } else {
        skipped++;
      }
    } catch (e: any) {
      skipped++;
      logger.warn({ fileId: file.id, err: e?.message }, "ZIP: skipped failed file");
    }
  }

  try {
    archive.append(JSON.stringify({
      project: project?.name, projectId, totalFiles: files.length,
      exportedFiles: added, skippedFiles: skipped,
      exportType: folderTypes ? "folder" : "selection",
      generatedAt: new Date().toISOString(),
      files: files.map(({ content, ...rest }) => rest),
    }, null, 2), { name: "vault_index.json" });
  } catch {}

  markFinalizing();
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
          htmlContent = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
        } catch {}
      }
      if (!htmlContent && file.metadata) {
        try {
          htmlContent = await buildBrandedHtmlFromMetadata(file, (req.query.template as CoverTemplate) || "prestige");
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
        // FIX D-09: NO enviar HTML con MIME de Word — Word lo rechaza como "archivo dañado".
        // Mientras no se integre librería real (docx package), servimos como HTML honesto.
        try {
          const cleanHtml = htmlContent
            .replace(/<script[\s\S]*?<\/script>/gi, "");
          const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #222; line-height: 1.6; max-width: 900px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 22pt; color: #1a1a2e; border-bottom: 2px solid #c9a96e; padding-bottom: 8px; }
  h2 { font-size: 16pt; color: #2d2d44; margin-top: 20px; }
  h3 { font-size: 13pt; color: #444; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
  th { background: #f0ebe0; font-weight: bold; }
  img { max-width: 400px; }
</style>
</head><body>${cleanHtml}</body></html>`;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.html"`);
          res.send(wrappedHtml);
        } catch (e: any) {
          logger.error({ err: e }, "Error generating DOCX-as-HTML fallback");
          res.status(500).json({ error: `Error generando documento: ${e.message}` });
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
  
    const asciiZipName = zipName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const utf8ZipName = encodeURIComponent(zipName);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiZipName}"; filename*=UTF-8''${utf8ZipName}`);

    const archive = archiver("zip", { zlib: { level: 6 }, forceUTF8: true } as any);
    const { ac, isClientGone, markFinalizing } = setupZipStream(req, res, archive);
    archive.pipe(res);

    let added = 0;

    async function processImage(buffer: Buffer, name: string, folder: string) {
      try {
        let outputBuffer: Buffer;
        let ext: string;

        if (format === "original") {
          outputBuffer = buffer;
          // Sniff por magic bytes: si los bytes son JPG/PNG/WebP, usa la
          // extensión real en vez de hardcodear "png".
          const sniffed = sniffMimeFromMagic(outputBuffer);
          ext = sniffed ? extForMime(sniffed) : "png";
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

        // STORE para imágenes ya comprimidas (jpg/png/webp/avif): ahorra CPU
        // y reduce ventana de exposición a aborts en exports grandes.
        archive.append(outputBuffer, { name: `${folder}/${name}.${ext}`, store: true });
        added++;
      } catch (e: any) {
        logger.warn({ name, err: e?.message }, "ZIP download-images: skipped image");
      }
    }
  
    for (const file of imageFiles) {
      if (isClientGone()) break;
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
          const response = await fetch(file.originalUrl, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(30000)]) });
          if (response.ok) buffer = Buffer.from(await response.arrayBuffer());
        } catch (err: any) { if (err?.name === "AbortError") break; }
      }
      if (buffer) await processImage(buffer, `${safeTitle}_${file.id}`, folder);
    }
  
    for (const job of aiImages) {
      if (isClientGone()) break;
      if (!job.imageUrl) continue;
      try {
        const response = await fetch(job.imageUrl, { signal: AbortSignal.any([ac.signal, AbortSignal.timeout(30000)]) });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const safeTitle = (job.altText || job.imageType || `imagen_${job.id}`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
          const folder = `ia_generadas/${job.imageType ?? "general"}`;
          await processImage(buffer, `${safeTitle}_${job.id}`, folder);
        }
      } catch (err: any) { if (err?.name === "AbortError") break; }
    }
  
    archive.append(JSON.stringify({
      project: project?.name,
      format: format === "original" ? "original (sin conversión)" : targetFmt.toUpperCase(),
      quality: "Máxima (100%)",
      totalImages: added,
      exportDate: new Date().toISOString(),
    }, null, 2), { name: "info_exportacion.json" });

    markFinalizing();
    await archive.finalize();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    // imágenes
    "image/webp": "webp", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/png": "png", "image/gif": "gif",
    "image/tiff": "tiff", "image/avif": "avif", "image/svg+xml": "svg",
    // vídeo (CRÍTICO para entregables al cliente)
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "video/x-matroska": "mkv", "video/mpeg": "mpeg", "video/x-msvideo": "avi",
    // audio
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav",
    "audio/wave": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
    "audio/webm": "weba", "audio/aac": "aac", "audio/flac": "flac",
    "audio/mp4": "m4a", "audio/x-m4a": "m4a",
    // texto / data
    "application/json": "json", "text/html": "html", "text/plain": "txt",
    "text/csv": "csv", "text/markdown": "md",
    "application/pdf": "pdf",
    "application/octet-stream": "bin",
    "application/zip": "zip",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  };
  // 1) match exacto
  if (map[mimeType]) return map[mimeType];
  // 2) match sin parámetros (ej. "video/mp4; codecs=avc1")
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (map[base]) return map[base];
  // 3) fallback inteligente por familia
  if (base.startsWith("video/")) return base.split("/")[1] || "mp4";
  if (base.startsWith("audio/")) return base.split("/")[1] || "mp3";
  if (base.startsWith("image/")) return base.split("/")[1] || "png";
  return "bin";
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

async function fetchImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

async function buildBrandedHtmlFromMetadata(file: {
  title: string; fileType: string | null; category: string | null;
  productTitle: string | null; generatedBy: string | null;
  createdAt: Date | string | null; metadata: unknown;
  objectPath?: string | null; originalUrl?: string | null;
}, coverTemplate: CoverTemplate = "prestige"): Promise<string> {
  const date = new Date(file.createdAt ?? Date.now()).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const time = new Date(file.createdAt ?? Date.now()).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const year = new Date().getFullYear();
  let meta: Record<string, unknown> = {};
  try { meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : (file.metadata ?? {}) as Record<string, unknown>; } catch { meta = {}; }

  let imageBlockHtml = "";
  if (file.fileType === "image") {
    let imgDataUrl: string | null = null;
    if (file.objectPath) {
      try {
        const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
        const [buf] = await gcsFile.download();
        if (buf.length <= 8 * 1024 * 1024) {
          const [meta] = await gcsFile.getMetadata();
          const ct = (meta.contentType as string) || "image/jpeg";
          imgDataUrl = `data:${ct};base64,${buf.toString("base64")}`;
        }
      } catch { /* fallback below */ }
    }
    if (!imgDataUrl) imgDataUrl = await fetchImageAsDataUrl(file.originalUrl);
    if (!imgDataUrl) {
      const fromMeta = (meta as any)?.imageUrl ?? (meta as any)?.image_url ?? null;
      imgDataUrl = await fetchImageAsDataUrl(fromMeta);
    }
    if (imgDataUrl) {
      imageBlockHtml = `
      <div style="margin:0 0 24px;padding:18px;background:${B.surface};border:1px solid ${B.border};border-radius:14px;text-align:center;">
        <img src="${imgDataUrl}" alt="${sanitizeHtml(file.title)}"
          style="max-width:100%;max-height:720px;height:auto;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.35);display:inline-block;" />
        <div style="margin-top:14px;font-size:11px;color:${B.muted};letter-spacing:1px;text-transform:uppercase;">Resultado generado &middot; ${sanitizeHtml(file.category || "imagen")}</div>
      </div>`;
    } else {
      imageBlockHtml = `
      <div style="margin:0 0 24px;padding:32px;background:${B.surface};border:1px dashed ${B.border};border-radius:14px;text-align:center;color:${B.muted};font-size:13px;">
        ⚠ La imagen no pudo embeberse (URL caducada o inaccesible). Detalles t&eacute;cnicos abajo.
      </div>`;
    }
  }

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
    ${imageBlockHtml}
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
          const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
          res.send(htmlReport);
          return;
        } catch {}
      }
      res.send(file.content);
      return;
    }
  
    if (file.metadata) {
      const reportHtml = await metadataToReportHtml(file);
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
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Mismo fix que /projects/.../vault/:fileId/preview: NO forzar text/html
    // para todo. Sirvo cada tipo con su mime real (CSS como text/css, imagen
    // como image/*, etc.) para que el navegador renderice correctamente. CSP
    // estricta solo en HTML/SVG (donde hay riesgo XSS).
    const STRICT_CSP_G = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:;";
    type GKind = "binary" | "html" | "svg" | "other-text";
    const mt = file.mimeType ?? null;
    const gkind: GKind = !mt ? "binary"
      : (mt === "image/svg+xml" || mt.includes("svg+xml")) ? "svg"
      : (mt === "text/html" || mt.startsWith("text/html")) ? "html"
      : (mt.startsWith("text/") || mt === "application/json" || mt === "application/xml"
         || mt === "application/javascript" || mt === "application/ecmascript"
         || mt.endsWith("+xml") || mt.endsWith("+json")) ? "other-text"
      : "binary";

    const setKindHeaders = (k: GKind) => {
      if (k === "binary") res.setHeader("Content-Type", mt ?? "application/octet-stream");
      else if (k === "html") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Content-Security-Policy", STRICT_CSP_G); }
      else if (k === "svg") { res.setHeader("Content-Type", "image/svg+xml"); res.setHeader("Content-Security-Policy", STRICT_CSP_G); }
      else res.setHeader("Content-Type", mt ?? "text/plain; charset=utf-8");
    };
    setKindHeaders(gkind);

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
      if (gkind === "binary") {
        // Binarios persistidos como base64 (image/*, video/*, application/pdf...).
        const buf = Buffer.from(file.content, "base64");
        res.send(buf);
        return;
      }
      const isJsonReport = (file.mimeType === "application/json")
        && (!!file.metadata || file.fileType === "report");
      if (isJsonReport) {
        try {
          const parsed = JSON.parse(file.content);
          const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, (req.query.template as CoverTemplate) || "prestige");
          res.removeHeader("Content-Type");
          setKindHeaders("html");
          res.send(htmlReport);
          return;
        } catch {}
      }
      // Texto plano (HTML, CSS, JS, JSON, XML, SVG): se envía tal cual con
      // su Content-Type correcto.
      res.send(file.content);
      return;
    }

    if (file.metadata) {
      const reportHtml = await metadataToReportHtml(file);
      res.removeHeader("Content-Type");
      setKindHeaders("html");
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

    // Acepta JSON body o form-urlencoded {_payload: '{...}'} (para descarga nativa).
    let parsedBody: { fileIds?: any; entityName?: string } = {};
    if (req.body && typeof req.body._payload === "string") {
      try { parsedBody = JSON.parse(req.body._payload); }
      catch { res.status(400).json({ error: "_payload inválido" }); return; }
    } else if (req.body && typeof req.body === "object") {
      parsedBody = req.body as any;
    }
    const { fileIds, entityName } = parsedBody;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0 || fileIds.length > 500) {
      res.status(400).json({ error: "fileIds (array 1-500) es requerido" }); return;
    }
    const numericIds = fileIds.map((id: unknown) => parseInt(String(id))).filter((n: number) => !isNaN(n));
    if (numericIds.length === 0) { res.status(400).json({ error: "fileIds inválidos" }); return; }
  
    const files = await db.select().from(projectFilesTable)
      .where(sql`${projectFilesTable.id} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);
  
    if (files.length === 0) { res.status(404).json({ error: "No se encontraron archivos" }); return; }
  
    const baseName = entityName
      ? `${entityName}_vault.zip`
      : `global_vault_${Date.now()}.zip`;
    const asciiName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const utf8Name = encodeURIComponent(baseName);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);

    const archive = archiver("zip", { zlib: { level: 6 }, forceUTF8: true } as any);
    const { isClientGone, markFinalizing } = setupZipStream(req, res, archive);
    archive.pipe(res);

    for (const file of files) {
      if (isClientGone()) break;
      const safeTitle = file.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const folder = file.fileType || "otros";
      const realExt = extForMime(file.mimeType);

      if (file.objectPath) {
        try {
          const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
          const response = await getStorage().downloadObject(gcsFile);
          const buffer = Buffer.from(await response.arrayBuffer());
          const sniffed = sniffMimeFromMagic(buffer);
          const realMime = sniffed ?? file.mimeType;
          const ext = sniffed ? extForMime(sniffed) : realExt;
          archive.append(buffer, { name: `${folder}/${safeTitle}_${file.id}.${ext}`, store: isAlreadyCompressed(realMime) });
          continue;
        } catch (e: any) {
          logger.warn({ fileId: file.id, err: e?.message }, "ZIP global: GCS download failed");
        }
      }
      if (file.content) {
        if (isBinaryMime(file.mimeType)) {
          try {
            const buf = Buffer.from(file.content, "base64");
            const sniffed = sniffMimeFromMagic(buf);
            const realMime = sniffed ?? file.mimeType;
            const ext = sniffed ? extForMime(sniffed) : realExt;
            archive.append(buf, { name: `${folder}/${safeTitle}_${file.id}.${ext}`, store: isAlreadyCompressed(realMime) });
            continue;
          } catch (e: any) {
            logger.warn({ fileId: file.id, err: e?.message }, "ZIP global: failed to decode base64");
          }
        }
        const isJsonContent = (file.mimeType === "application/json") || (!file.mimeType && file.content.trim().startsWith("{"));
        if (isJsonContent) {
          try {
            const parsed = JSON.parse(file.content);
            const htmlReport = await buildBrandedHtmlFromMetadata({ ...file, metadata: parsed }, "prestige");
            archive.append(htmlReport, { name: `${folder}/${safeTitle}_${file.id}.html` });
          } catch {
            archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.html` });
          }
        } else {
          const textExt = extForMime(file.mimeType ?? "text/html");
          archive.append(file.content, { name: `${folder}/${safeTitle}_${file.id}.${textExt}` });
        }
      } else if (file.metadata) {
        const html = await metadataToReportHtml(file);
        archive.append(html, { name: `${folder}/${safeTitle}_${file.id}.html` });
      }
    }

    markFinalizing();
    await archive.finalize();
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (!res.headersSent) res.status(500).json({ error: msg });
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
