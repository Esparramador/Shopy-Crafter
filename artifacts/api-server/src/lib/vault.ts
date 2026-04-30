import { db, projectFilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";
import { validateImageUrlAsync } from "./runway.js";

const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10 MB hard limit (imágenes/binarios pequeños)
const MAX_VIDEO_CONTENT_BYTES = 50 * 1024 * 1024; // 50 MB para vídeos (Runway/Replicate)
const WARN_CONTENT_BYTES = 2 * 1024 * 1024; // Warn at 2 MB

// Mime types que persistimos automáticamente cuando recibimos una `originalUrl`
// pero no `content`/`objectPath`, para evitar que la URL temporal del proveedor
// expire (Replicate/Runway suelen borrar a las 24h).
const AUTO_PERSIST_PREFIXES = ["image/", "video/", "audio/"] as const;
function shouldAutoPersist(mime: string | undefined | null): boolean {
  if (!mime) return false;
  return AUTO_PERSIST_PREFIXES.some(p => mime.startsWith(p));
}
function getMaxBytesFor(mime: string | undefined | null): number {
  if (mime && mime.startsWith("video/")) return MAX_VIDEO_CONTENT_BYTES;
  return MAX_CONTENT_BYTES;
}

interface VaultFileParams {
  projectId: number;
  fileType: string;
  category?: string;
  title: string;
  description?: string;
  originalUrl?: string;
  objectPath?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  productId?: string;
  productTitle?: string;
  generatedBy?: string;
  metadata?: Record<string, unknown>;
  content?: string;
}

// Registra un archivo generado en el vault del proyecto
// Retorna el ID del registro creado (o null si falla silenciosamente)
export async function saveToVault(params: VaultFileParams): Promise<number | null> {
  try {
    // FIX CRÍTICO: si recibimos `originalUrl` con mimeType binario (image/*,
    // video/*, audio/*) y NO tenemos `content` ni `objectPath`, descargamos el
    // binario AHORA y lo guardamos como base64 en `content`. Si no, cuando expire
    // la URL temporal del proveedor (Replicate/Runway borran ficheros a ~24h) la
    // descarga/preview devolverá 410 y el usuario perderá la creación.
    //
    // SECURITY: validamos la URL contra SSRF/DNS-rebinding antes de hacer fetch.
    const sourceUrl = params.originalUrl;
    if (
      sourceUrl &&
      !params.content &&
      !params.objectPath &&
      shouldAutoPersist(params.mimeType)
    ) {
      const maxBytes = getMaxBytesFor(params.mimeType);
      const isVideo = (params.mimeType || "").startsWith("video/");
      // Vídeos pueden tardar más en descargarse (50MB).
      const fetchTimeout = isVideo ? 90_000 : 30_000;
      try {
        // Bloquea URLs que apunten a IPs privadas/reservadas o metadata de cloud.
        await validateImageUrlAsync(sourceUrl);
        const resp = await fetch(sourceUrl, { signal: AbortSignal.timeout(fetchTimeout) });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          if (buf.length > 0 && buf.length <= maxBytes) {
            params = { ...params, content: buf.toString("base64"), fileSizeBytes: buf.length };
          } else if (buf.length > maxBytes) {
            logger.warn(
              { projectId: params.projectId, bytes: buf.length, maxBytes, mime: params.mimeType },
              "Binary exceeds vault content limit — keeping originalUrl only (CONTENIDO PUEDE EXPIRAR)"
            );
          }
        } else {
          logger.warn(
            { projectId: params.projectId, status: resp.status, url: sourceUrl.slice(0, 120), mime: params.mimeType },
            "Failed to fetch binary at save time — will rely on originalUrl (CONTENIDO PUEDE EXPIRAR)"
          );
        }
      } catch (err) {
        logger.warn(
          { err, projectId: params.projectId, url: sourceUrl.slice(0, 120), mime: params.mimeType },
          "Error downloading binary at save time — will rely on originalUrl (CONTENIDO PUEDE EXPIRAR)"
        );
      }
    }

    // FIX C-09: calcular fileSizeBytes automáticamente si no se pasa
    let fileSizeBytes = params.fileSizeBytes ?? null;
    if (!fileSizeBytes && params.content) {
      fileSizeBytes = Buffer.byteLength(params.content, "utf8");
    }

    // FIX C-09: alertar y rechazar contenido excesivamente grande
    const sizeLimit = getMaxBytesFor(params.mimeType);
    if (fileSizeBytes && fileSizeBytes > sizeLimit) {
      logger.error(
        { projectId: params.projectId, fileType: params.fileType, fileSizeBytes, sizeLimit },
        `Vault content exceeds ${sizeLimit / 1024 / 1024}MB limit — storing metadata only`
      );
      const [file] = await db.insert(projectFilesTable).values({
        projectId: params.projectId,
        fileType: params.fileType,
        category: params.category ?? null,
        title: params.title,
        description: `[CONTENT TRUNCATED — too large: ${fileSizeBytes} bytes] ${params.description ?? ""}`,
        objectPath: params.objectPath ?? null,
        originalUrl: params.originalUrl ?? null,
        mimeType: params.mimeType ?? null,
        fileSizeBytes,
        productId: params.productId ?? null,
        productTitle: params.productTitle ?? null,
        generatedBy: params.generatedBy ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        content: null,
      }).returning({ id: projectFilesTable.id });
      return file?.id ?? null;
    }

    if (fileSizeBytes && fileSizeBytes > WARN_CONTENT_BYTES) {
      logger.warn(
        { projectId: params.projectId, fileType: params.fileType, fileSizeBytes },
        "Vault content is large (>2MB) — consider moving to objectStorage"
      );
    }

    const [file] = await db.insert(projectFilesTable).values({
      projectId: params.projectId,
      fileType: params.fileType,
      category: params.category ?? null,
      title: params.title,
      description: params.description ?? null,
      objectPath: params.objectPath ?? null,
      originalUrl: params.originalUrl ?? null,
      mimeType: params.mimeType ?? null,
      fileSizeBytes,
      productId: params.productId ?? null,
      productTitle: params.productTitle ?? null,
      generatedBy: params.generatedBy ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      content: params.content ?? null,
    }).returning({ id: projectFilesTable.id });

    logger.info(
      { fileId: file?.id, projectId: params.projectId, fileType: params.fileType, fileSizeBytes },
      "File saved to vault"
    );
    return file?.id ?? null;
  } catch (err) {
    logger.warn({ err, projectId: params.projectId, fileType: params.fileType }, "Failed to save file to vault (non-fatal)");
    return null;
  }
}

/**
 * Helper para recuperar contenido del vault con control de acceso por proyecto.
 * Siempre verifica que el archivo pertenece al projectId pasado, evitando IDOR.
 */
export async function getVaultContent(
  fileId: number,
  projectId: number
): Promise<{ content: string | null; mimeType: string | null; title: string } | null> {
  const [file] = await db
    .select({
      content: projectFilesTable.content,
      mimeType: projectFilesTable.mimeType,
      title: projectFilesTable.title,
      projectId: projectFilesTable.projectId,
    })
    .from(projectFilesTable)
    .where(
      and(
        eq(projectFilesTable.id, fileId),
        eq(projectFilesTable.projectId, projectId)
      )
    )
    .limit(1);

  if (!file) return null;
  return { content: file.content, mimeType: file.mimeType, title: file.title };
}
