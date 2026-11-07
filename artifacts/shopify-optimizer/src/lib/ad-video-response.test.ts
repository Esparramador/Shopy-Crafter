import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAdVideoResponse } from "./ad-video-response";

describe("respuesta de generación de vídeo de anuncios", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("solo marca como guardado una respuesta con ID de Vault y URL", async () => {
    const result = await parseAdVideoResponse(new Response(JSON.stringify({
      success: true,
      vaultId: 17,
      videoUrl: "/api/projects/3/vault/17/download",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    expect(result).toMatchObject({
      savedToVault: true,
      vaultId: 17,
      url: "/api/projects/3/vault/17/download",
    });
  });

  it("no confía en success sin un archivo recuperable", async () => {
    await expect(parseAdVideoResponse(new Response(JSON.stringify({
      success: true,
      result: { vaultId: null, finalVideoUrl: undefined },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))).rejects.toThrow("no confirma que el vídeo esté guardado");
  });

  it("conserva el MP4 descargable cuando el Vault falla", async () => {
    const result = await parseAdVideoResponse(new Response(new Blob(["mp4-bytes"], { type: "video/mp4" }), {
      status: 503,
      headers: {
        "Content-Type": "video/mp4",
        "X-Ad-Recovery": "download",
      },
    }));

    expect(result.savedToVault).toBe(false);
    expect(result.vaultId).toBeNull();
    expect(result.url.startsWith("blob:")).toBe(true);
    URL.revokeObjectURL(result.url);
  });

  it("no interpreta como descarga un error JSON", async () => {
    await expect(parseAdVideoResponse(new Response(JSON.stringify({
      success: false,
      error: "El proveedor no terminó el vídeo.",
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }))).rejects.toThrow("El proveedor no terminó el vídeo.");
  });
});
