import { getVaultContent, saveToVault } from "./vault.js";

export interface PersistAdVideoInput {
  projectId: number;
  title: string;
  category: string;
  generatedBy: string;
  buffer: Buffer;
  productId?: string | null;
  productTitle?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  mimeType?: string;
}

export interface PersistedAdVideo {
  vaultId: number;
  downloadUrl: string;
}

/**
 * Stores a generated video and confirms that its bytes are durable before
 * callers report success. A metadata-only row or a temporary disk fallback
 * does not count as a saved Vault asset.
 */
export async function persistAdVideoToVault(input: PersistAdVideoInput): Promise<PersistedAdVideo | null> {
  if (!input.buffer.length) return null;

  const vaultId = await saveToVault({
    projectId: input.projectId,
    fileType: "video",
    category: input.category,
    title: input.title,
    description: input.description,
    mimeType: input.mimeType ?? "video/mp4",
    fileSizeBytes: input.buffer.length,
    buffer: input.buffer,
    productId: input.productId ?? undefined,
    productTitle: input.productTitle ?? undefined,
    generatedBy: input.generatedBy,
    metadata: input.metadata,
  });
  if (!vaultId) return null;

  const stored = await getVaultContent(vaultId, input.projectId);
  if (!stored || (!stored.content?.trim() && !stored.objectPath?.trim())) return null;

  return {
    vaultId,
    downloadUrl: `/api/projects/${input.projectId}/vault/${vaultId}/download`,
  };
}
