/**
 * Smart vault save: prefiere Object Storage para >2MB, fallback a base64 en DB.
 * Extraído de routes/fs-pro.ts para reuso desde super-ad-runner y otros workers.
 */
import { logger } from "./logger.js";
import { saveToVault } from "./vault.js";
import { ObjectStorageService } from "./objectStorage.js";
import { safeDecrypt } from "./crypto.js";

let _storage: ObjectStorageService | null = null;
function getStorage(): ObjectStorageService {
  if (!_storage) _storage = new ObjectStorageService();
  return _storage;
}

export function getProjectReplicateToken(project: any): string | undefined {
  const enc = project?.replicateApiToken;
  if (!enc) return undefined;
  try { return safeDecrypt(enc) || enc; } catch { return enc; }
}

export async function saveToVaultSmart(params: {
  projectId: number;
  fileType: string;
  category: string;
  title: string;
  mimeType: string;
  generatedBy: string;
  buffer: Buffer;
}): Promise<number> {
  const RAW_THRESHOLD = 2 * 1024 * 1024;
  const isVideo = params.mimeType.startsWith("video/");
  const FALLBACK_MAX = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

  if (params.buffer.length === 0) {
    throw new Error(`saveToVaultSmart: buffer vacío (${params.fileType})`);
  }

  if (params.buffer.length > RAW_THRESHOLD) {
    const safeTitle = params.title.replace(/[^a-z0-9-_]/gi, "_").slice(0, 50);
    const ext = params.mimeType.split("/")[1] || "bin";
    const objectPath = `projects/${params.projectId}/${params.fileType}/${safeTitle}_${Date.now()}.${ext}`;
    try {
      const gcsFile = await getStorage().getObjectEntityFile(objectPath);
      await getStorage().uploadObject(gcsFile, params.buffer, params.mimeType);
      const vaultId = await saveToVault({
        projectId: params.projectId,
        fileType: params.fileType,
        category: params.category,
        title: params.title,
        mimeType: params.mimeType,
        generatedBy: params.generatedBy,
        objectPath,
        fileSizeBytes: params.buffer.length,
      });
      if (vaultId === null) throw new Error("saveToVault returned null after objectStorage upload");
      logger.info({ vaultId, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2), storage: "objectStorage" }, "vault-smart: asset guardado");
      return vaultId;
    } catch (err) {
      if (params.buffer.length > FALLBACK_MAX) {
        logger.error({ err, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2) }, "vault-smart: Object Storage falló y archivo demasiado grande");
        throw new Error(`No se pudo guardar el archivo (${(params.buffer.length / 1024 / 1024).toFixed(1)}MB): Object Storage no disponible y excede el límite de DB`);
      }
      logger.warn({ err, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2) }, "vault-smart: Object Storage upload failed, fallback a base64");
    }
  }
  const vaultId = await saveToVault({
    projectId: params.projectId,
    fileType: params.fileType,
    category: params.category,
    title: params.title,
    mimeType: params.mimeType,
    generatedBy: params.generatedBy,
    content: params.buffer.toString("base64"),
    fileSizeBytes: params.buffer.length,
  });
  if (vaultId === null) throw new Error("saveToVault returned null (DB insert failed)");
  logger.info({ vaultId, fileType: params.fileType, sizeMB: (params.buffer.length / 1024 / 1024).toFixed(2), storage: "db-base64" }, "vault-smart: asset guardado");
  return vaultId;
}

export async function fetchVaultBufferById(projectId: number, vaultId: number): Promise<Buffer> {
  const { db, projectFilesTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, vaultId));
  if (!file || file.projectId !== projectId) throw new Error(`Vault ${vaultId} no encontrado en proyecto ${projectId}`);
  if (file.originalUrl?.startsWith("http")) {
    try {
      const r = await fetch(file.originalUrl);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* fallthrough */ }
  }
  if (file.objectPath) {
    const gcsFile = await getStorage().getObjectEntityFile(file.objectPath);
    const resp = await getStorage().downloadObject(gcsFile);
    return Buffer.from(await resp.arrayBuffer());
  }
  if (file.content) return Buffer.from(file.content, "base64");
  throw new Error(`Vault ${vaultId} no tiene contenido descargable`);
}
