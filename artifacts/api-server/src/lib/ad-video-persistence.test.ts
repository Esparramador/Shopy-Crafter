import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./vault.js", () => ({
  getVaultContent: vi.fn(),
  saveToVault: vi.fn(),
}));

import { getVaultContent, saveToVault } from "./vault.js";
import { persistAdVideoToVault } from "./ad-video-persistence.js";

const mockGetVaultContent = vi.mocked(getVaultContent);
const mockSaveToVault = vi.mocked(saveToVault);

describe("persistencia de vídeos de anuncios", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("solo confirma el guardado cuando el contenido está en Vault", async () => {
    mockSaveToVault.mockResolvedValue(42);
    mockGetVaultContent.mockResolvedValue({
      content: Buffer.from("mp4-bytes").toString("base64"),
      mimeType: "video/mp4",
      title: "Anuncio",
      objectPath: null,
    });

    const buffer = Buffer.from("mp4-bytes");
    const saved = await persistAdVideoToVault({
      projectId: 7,
      title: "Anuncio",
      category: "smart_quick_ad",
      generatedBy: "smart-quick:test",
      productId: "mf-product-1",
      productTitle: "Producto de Muscle Factory",
      buffer,
    });

    expect(saved).toEqual({
      vaultId: 42,
      downloadUrl: "/api/projects/7/vault/42/download",
    });
    expect(mockSaveToVault).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 7,
      fileType: "video",
      buffer,
      fileSizeBytes: buffer.length,
    }));
    expect(mockGetVaultContent).toHaveBeenCalledWith(42, 7);
  });

  it("acepta un vídeo guardado en App Storage", async () => {
    mockSaveToVault.mockResolvedValue(43);
    mockGetVaultContent.mockResolvedValue({
      content: null,
      mimeType: "video/mp4",
      title: "Anuncio",
      objectPath: "/objects/vault/7/ad.mp4",
    });

    const saved = await persistAdVideoToVault({
      projectId: 7,
      title: "Anuncio",
      category: "smart_cinematic_ad",
      generatedBy: "smart-cinematic:test",
      buffer: Buffer.from("mp4-bytes"),
    });

    expect(saved?.vaultId).toBe(43);
  });

  it("rechaza un registro de Vault sin bytes ni objeto persistido", async () => {
    mockSaveToVault.mockResolvedValue(44);
    mockGetVaultContent.mockResolvedValue({
      content: null,
      mimeType: "video/mp4",
      title: "Anuncio incompleto",
      objectPath: null,
    });

    const saved = await persistAdVideoToVault({
      projectId: 7,
      title: "Anuncio",
      category: "smart_cinematic_ad",
      generatedBy: "smart-cinematic:test",
      buffer: Buffer.from("mp4-bytes"),
    });

    expect(saved).toBeNull();
  });

  it("devuelve fallo cuando saveToVault no crea una entrada", async () => {
    mockSaveToVault.mockResolvedValue(null);

    const saved = await persistAdVideoToVault({
      projectId: 7,
      title: "Anuncio",
      category: "tryon_video",
      generatedBy: "video-tryon:test",
      buffer: Buffer.from("mp4-bytes"),
    });

    expect(saved).toBeNull();
    expect(mockGetVaultContent).not.toHaveBeenCalled();
  });

  it("no intenta guardar un vídeo vacío", async () => {
    const saved = await persistAdVideoToVault({
      projectId: 7,
      title: "Anuncio",
      category: "smart_quick_ad",
      generatedBy: "smart-quick:test",
      buffer: Buffer.alloc(0),
    });

    expect(saved).toBeNull();
    expect(mockSaveToVault).not.toHaveBeenCalled();
  });
});
