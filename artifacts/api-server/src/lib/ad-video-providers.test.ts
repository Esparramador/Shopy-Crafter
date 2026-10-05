import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("./logger.js", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import {
  AD_VIDEO_PROVIDERS, resolveAdVideoProvider, effectiveDuration, videoCostUsd, adCostUsd, adCredits,
  replicateInput, centerCropFor, generationAspect, listAdVideoProviders, creditsForUsd,
} from "./ad-video-providers";
import { IMAGE_UNIT_COST_EUR } from "./ai-budget";

const all = Object.values(AD_VIDEO_PROVIDERS);

describe("proveedores de vídeo del Ad Studio", () => {
  it("solo usa IDs de modelo verificados", () => {
    expect(all.map(p => p.modelId).sort()).toEqual([
      "gen4.5", "gen4_turbo", "kwaivgi/kling-v3-video", "kwaivgi/kling-v3-video",
      "minimax/hailuo-2.3", "minimax/hailuo-2.3-fast",
    ].sort());
  });

  it("acepta claves antiguas equivalentes y rechaza las que no existen", () => {
    expect(resolveAdVideoProvider("replicate-kling-master")?.key).toBe("kling-v3-pro");
    expect(resolveAdVideoProvider("replicate-hailuo")?.key).toBe("hailuo-2.3");
    expect(resolveAdVideoProvider("veo-4")).toBeNull();
    expect(resolveAdVideoProvider("replicate-seedance-fast")).toBeNull();
  });

  it("ajusta la duración a una que la API acepta", () => {
    const hailuo = AD_VIDEO_PROVIDERS["hailuo-2.3"];
    expect(effectiveDuration(hailuo, 5)).toBe(6);
    expect(effectiveDuration(hailuo, 9)).toBe(10);
    expect(effectiveDuration(AD_VIDEO_PROVIDERS["runway-gen4-turbo"], 8)).toBe(10);
  });

  it("Hailuo: 1080p solo en 6 s y sin parámetros que no admite", () => {
    const six = replicateInput(AD_VIDEO_PROVIDERS["hailuo-2.3"], { prompt: "p", negativePrompt: "n", imageDataUri: "data:x", requestedSec: 6, aspect: "9:16" });
    expect(six).toMatchObject({ duration: 6, resolution: "1080p", first_frame_image: "data:x" });
    expect(six).not.toHaveProperty("negative_prompt");
    const ten = replicateInput(AD_VIDEO_PROVIDERS["hailuo-2.3-fast"], { prompt: "p", negativePrompt: "n", imageDataUri: "data:x", requestedSec: 10, aspect: "9:16" });
    expect(ten).toMatchObject({ duration: 10, resolution: "768p" });
  });

  it("Kling: modo pro/standard, sin audio del modelo y solo formatos nativos", () => {
    const pro = replicateInput(AD_VIDEO_PROVIDERS["kling-v3-pro"], { prompt: "p", negativePrompt: "n", imageDataUri: "data:x", requestedSec: 5, aspect: "4:5" });
    expect(pro).toMatchObject({ mode: "pro", start_image: "data:x", generate_audio: false, aspect_ratio: "9:16" });
    const std = replicateInput(AD_VIDEO_PROVIDERS["kling-v3-std"], { prompt: "p", negativePrompt: "n", imageDataUri: "data:x", requestedSec: 5, aspect: "16:9" });
    expect(std).toMatchObject({ mode: "standard", aspect_ratio: "16:9" });
  });

  it("4:5 se genera en el formato nativo más cercano y se recorta al centro", () => {
    expect(generationAspect(AD_VIDEO_PROVIDERS["runway-gen4.5"], "4:5")).toBe("9:16");
    expect(generationAspect(AD_VIDEO_PROVIDERS["hailuo-2.3"], "4:5")).toBe("4:5");
    const c = centerCropFor(720, 1280, "4:5")!;
    expect(c.w / c.h).toBeCloseTo(0.8, 2);
    expect(c.w % 2 + c.h % 2).toBe(0);
    expect(c.y).toBe(Math.floor((1280 - c.h) / 2));
    expect(centerCropFor(1280, 720, "16:9")).toBeNull();
  });

  it("precios verificados", () => {
    expect(videoCostUsd(AD_VIDEO_PROVIDERS["runway-gen4.5"], 10)).toBeCloseTo(1.2);
    expect(videoCostUsd(AD_VIDEO_PROVIDERS["runway-gen4-turbo"], 5)).toBeCloseTo(0.25);
    expect(videoCostUsd(AD_VIDEO_PROVIDERS["hailuo-2.3"], 6)).toBeCloseTo(0.49);
    expect(videoCostUsd(AD_VIDEO_PROVIDERS["hailuo-2.3-fast"], 10)).toBeCloseTo(0.32);
  });

  it("los créditos cobrados cubren siempre el coste real (ningún plan pierde dinero)", () => {
    for (const p of all) {
      for (const d of [3, 5, 6, 8, 10]) {
        for (const images of [0, 1]) {
          const credits = adCredits(p, d, IMAGE_UNIT_COST_EUR, { images });
          const costEur = adCostUsd(p, d, { images }) * 0.92;
          expect(credits * IMAGE_UNIT_COST_EUR).toBeGreaterThanOrEqual(costEur - 1e-9);
        }
      }
    }
    expect(creditsForUsd(0.001, IMAGE_UNIT_COST_EUR)).toBe(1);
  });

  it("el catálogo de la UI coincide con lo que se cobra", () => {
    const list = listAdVideoProviders(6, IMAGE_UNIT_COST_EUR);
    expect(list).toHaveLength(all.length);
    const h = list.find(p => p.key === "hailuo-2.3")!;
    expect(h.effectiveDurationSec).toBe(6);
    expect(h.creditsPerAd).toBe(adCredits(AD_VIDEO_PROVIDERS["hailuo-2.3"], 6, IMAGE_UNIT_COST_EUR));
  });
});
