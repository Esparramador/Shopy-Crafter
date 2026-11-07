export interface AdVideoResponseResult {
  savedToVault: boolean;
  vaultId: number | null;
  url: string;
  meta: any;
}

export async function parseAdVideoResponse(response: Response): Promise<AdVideoResponseResult> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const recoveryAvailable =
    response.headers.get("x-ad-recovery") === "download" &&
    contentType.startsWith("video/");

  if (recoveryAvailable) {
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("La respuesta de recuperación no contiene un vídeo descargable.");
    }

    return {
      savedToVault: false,
      vaultId: null,
      url: URL.createObjectURL(blob),
      meta: null,
    };
  }

  const bodyText = await response.text();
  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    data = { error: bodyText.slice(0, 300) };
  }

  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error || `Error ${response.status}`);
  }

  const rawVaultId =
    data?.vaultId ??
    data?.variant?.vaultId ??
    data?.variant?.assets?.vaultId ??
    data?.result?.vaultId;
  const vaultId = Number(rawVaultId);
  const url =
    data?.videoUrl ||
    data?.finalVideoUrl ||
    data?.variant?.assets?.finalMp4Url ||
    data?.variant?.assets?.videoUrl ||
    data?.result?.finalVideoUrl ||
    data?.result?.videoUrl;

  if (!Number.isSafeInteger(vaultId) || vaultId <= 0 || typeof url !== "string" || !url.trim()) {
    throw new Error("La respuesta no confirma que el vídeo esté guardado en el Vault. No lo vuelvas a generar todavía.");
  }

  return { savedToVault: true, vaultId, url, meta: data };
}
