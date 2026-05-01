import { db, projectFilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { validateImageUrlAsync } from "./runway.js";
import { objectStorageClient } from "./objectStorage.js";

const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10 MB hard limit (imágenes/binarios pequeños)
const MAX_VIDEO_CONTENT_BYTES = 50 * 1024 * 1024; // 50 MB para vídeos (Runway/Replicate)
const WARN_CONTENT_BYTES = 2 * 1024 * 1024; // Warn at 2 MB
// Anuncios largos pueden generar vídeos hasta 500MB. Object Storage absorbe el exceso.
const MAX_OBJECT_STORAGE_BYTES = 500 * 1024 * 1024; // 500 MB hard ceiling para OS

// Nombre y subruta dentro del PRIVATE_OBJECT_DIR donde guardamos los assets
// del vault que exceden el límite que cabe en la columna `content` de Postgres.
const VAULT_OS_PREFIX = "vault";

function guessExt(mime: string | undefined | null): string {
  if (!mime) return "bin";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

/**
 * Sube un buffer binario al Object Storage privado bajo
 * `${PRIVATE_OBJECT_DIR}/vault/<projectId>/<uuid>.<ext>` y devuelve el
 * `objectPath` interno (forma `/objects/vault/<projectId>/<uuid>.<ext>`)
 * que `routes/vault.ts` ya sabe servir vía `getObjectEntityFile`.
 *
 * Devuelve null si OS no está configurado o si la subida falla.
 */
async function uploadBufferToObjectStorage(
  projectId: number,
  buffer: Buffer,
  mimeType: string | undefined | null,
): Promise<string | null> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    logger.warn(
      { projectId },
      "PRIVATE_OBJECT_DIR no configurado: no se puede subir asset grande al Object Storage",
    );
    return null;
  }
  if (buffer.length > MAX_OBJECT_STORAGE_BYTES) {
    logger.error(
      { projectId, bytes: buffer.length, max: MAX_OBJECT_STORAGE_BYTES },
      "Asset excede el límite duro de Object Storage (500MB) — no se sube",
    );
    return null;
  }
  try {
    const ext = guessExt(mimeType);
    const objectId = `${VAULT_OS_PREFIX}/${projectId}/${randomUUID()}.${ext}`;
    const fullPath = privateDir.endsWith("/")
      ? `${privateDir}${objectId}`
      : `${privateDir}/${objectId}`;
    // parseObjectPath espera ruta absoluta tipo "/bucket/.../obj"
    const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Ruta inválida para Object Storage: ${normalized}`);
    }
    const bucketName = parts[0];
    const objectName = parts.slice(1).join("/");
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, {
      contentType: mimeType || "application/octet-stream",
      resumable: false,
    });
    // Devolvemos en la forma `/objects/<entityId>` que la ruta GET reconoce.
    return `/objects/${objectId}`;
  } catch (err) {
    logger.warn(
      { err, projectId, bytes: buffer.length, mime: mimeType },
      "Falló subida a Object Storage — se mantendrá originalUrl/metadata",
    );
    return null;
  }
}

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
    // Si supera el límite de la columna `content` (10MB imagen / 50MB vídeo),
    // intentamos subirlo al Object Storage y guardar `objectPath` en su lugar.
    //
    // SECURITY: validamos la URL contra SSRF/DNS-rebinding antes de hacer fetch.
    let pendingLargeBuffer: Buffer | null = null; // buffer pendiente de subir a OS
    const sourceUrl = params.originalUrl;
    if (
      sourceUrl &&
      !params.content &&
      !params.objectPath &&
      shouldAutoPersist(params.mimeType)
    ) {
      const maxBytes = getMaxBytesFor(params.mimeType);
      const isVideo = (params.mimeType || "").startsWith("video/");
      // Vídeos pueden tardar más en descargarse (hasta 500MB en anuncios largos).
      const fetchTimeout = isVideo ? 180_000 : 30_000;
      try {
        // Bloquea URLs que apunten a IPs privadas/reservadas o metadata de cloud.
        await validateImageUrlAsync(sourceUrl);
        const resp = await fetch(sourceUrl, { signal: AbortSignal.timeout(fetchTimeout) });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          if (buf.length > 0 && buf.length <= maxBytes) {
            // Cabe en columna `content` — base64 directo
            params = { ...params, content: buf.toString("base64"), fileSizeBytes: buf.length };
          } else if (buf.length > maxBytes) {
            // Excede límite de DB — lo retenemos para subir a Object Storage abajo
            logger.info(
              { projectId: params.projectId, bytes: buf.length, maxBytes, mime: params.mimeType },
              "Binary exceeds DB content limit — uploading to Object Storage"
            );
            pendingLargeBuffer = buf;
            params = { ...params, fileSizeBytes: buf.length };
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

    // Si el caller pasó `content` directamente y excede el límite, decodificamos
    // a buffer para intentar subirlo a Object Storage en lugar de descartarlo.
    const sizeLimit = getMaxBytesFor(params.mimeType);
    if (
      !pendingLargeBuffer &&
      params.content &&
      fileSizeBytes &&
      fileSizeBytes > sizeLimit &&
      !params.objectPath
    ) {
      try {
        const decoded = Buffer.from(params.content, "base64");
        if (decoded.length > 0) {
          pendingLargeBuffer = decoded;
          // Quitamos el content para no insertarlo en DB (lo sustituye objectPath)
          params = { ...params, content: undefined };
        }
      } catch {
        /* ignore decode errors — caerá al branch metadata-only */
      }
    }

    // Si tenemos un buffer pendiente que excede el límite de DB, súbelo a OS y
    // guarda objectPath en lugar de content.
    if (pendingLargeBuffer && !params.objectPath) {
      const objectPath = await uploadBufferToObjectStorage(
        params.projectId,
        pendingLargeBuffer,
        params.mimeType,
      );
      if (objectPath) {
        params = { ...params, objectPath, content: undefined };
        logger.info(
          { projectId: params.projectId, objectPath, bytes: pendingLargeBuffer.length, mime: params.mimeType },
          "Large asset uploaded to Object Storage"
        );
      }
    }

    // Si AÚN sigue excediendo (OS falló o no configurado) → metadata only
    if (
      fileSizeBytes &&
      fileSizeBytes > sizeLimit &&
      !params.objectPath &&
      !params.content
    ) {
      logger.error(
        { projectId: params.projectId, fileType: params.fileType, fileSizeBytes, sizeLimit },
        `Vault content exceeds ${sizeLimit / 1024 / 1024}MB limit AND Object Storage upload failed — storing metadata only`
      );
      const [file] = await db.insert(projectFilesTable).values({
        projectId: params.projectId,
        fileType: params.fileType,
        category: params.category ?? null,
        title: params.title,
        description: `[CONTENT TRUNCATED — too large: ${fileSizeBytes} bytes] ${params.description ?? ""}`,
        objectPath: null,
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

    if (fileSizeBytes && fileSizeBytes > WARN_CONTENT_BYTES && !params.objectPath) {
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
): Promise<{ content: string | null; mimeType: string | null; title: string; objectPath: string | null } | null> {
  const [file] = await db
    .select({
      content: projectFilesTable.content,
      mimeType: projectFilesTable.mimeType,
      title: projectFilesTable.title,
      objectPath: projectFilesTable.objectPath,
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
  return {
    content: file.content,
    mimeType: file.mimeType,
    title: file.title,
    objectPath: file.objectPath ?? null,
  };
}
