import { db, projectFilesTable } from "@workspace/db";
import { logger } from "./logger.js";

interface VaultFileParams {
  projectId: number;
  fileType: string;
  category?: string;
  title: string;
  description?: string;
  originalUrl?: string;   // URL de origen (Replicate CDN, etc.)
  objectPath?: string;    // Ruta GCS si ya fue subido a object storage
  mimeType?: string;
  fileSizeBytes?: number;
  productId?: string;
  productTitle?: string;
  generatedBy?: string;
  metadata?: Record<string, unknown>;
}

// Registra un archivo generado en el vault del proyecto
// Retorna el ID del registro creado (o null si falla silenciosamente)
export async function saveToVault(params: VaultFileParams): Promise<number | null> {
  try {
    const [file] = await db.insert(projectFilesTable).values({
      projectId: params.projectId,
      fileType: params.fileType,
      category: params.category ?? null,
      title: params.title,
      description: params.description ?? null,
      objectPath: params.objectPath ?? null,
      originalUrl: params.originalUrl ?? null,
      mimeType: params.mimeType ?? null,
      fileSizeBytes: params.fileSizeBytes ?? null,
      productId: params.productId ?? null,
      productTitle: params.productTitle ?? null,
      generatedBy: params.generatedBy ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    }).returning({ id: projectFilesTable.id });

    logger.info({ fileId: file?.id, projectId: params.projectId, fileType: params.fileType }, "File saved to vault");
    return file?.id ?? null;
  } catch (err) {
    logger.warn({ err, projectId: params.projectId, fileType: params.fileType }, "Failed to save file to vault (non-fatal)");
    return null;
  }
}
