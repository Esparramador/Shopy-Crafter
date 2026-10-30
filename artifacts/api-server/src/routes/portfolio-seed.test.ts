import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeQrImage } from "../lib/card-qr-art.js";
import { isRetiredQrPortfolioImage, SEED } from "./portfolio-seed.js";

// El slug y los nombres de archivo antiguos son identificadores estables, no texto promocional.
const qr = SEED.find(project => project.slug === "qr-artisticos-3d")!;

describe("oferta pública de QR artísticos", () => {
  it("no vuelve a anunciar QR en 3D ni sus tecnologías", () => {
    expect(qr).toBeDefined();
    const publicText = [
      qr.title, qr.summary, qr.description, qr.category,
      ...qr.features, ...qr.tech, ...qr.images.map(image => image.alt),
      ...qr.variants.flatMap(variant => [
        variant.name, variant.summary, variant.description, ...variant.features, ...variant.tech,
      ]),
    ].join("\n");
    expect(qr.title).toContain("QR artísticos");
    expect(publicText).not.toMatch(/\b3\s*-?\s*d\b|\bwebgl\b|\bthree\.?js\b|tridimensional/i);
  });

  it("solo destaca muestras artísticas verificables, conservando los originales fuera de la selección", () => {
    expect(qr.images).toHaveLength(4);
    expect(qr.images.every(image => !isRetiredQrPortfolioImage(image.url))).toBe(true);
    for (const number of [1, 2, 3, 4, 5, 9]) {
      expect(isRetiredQrPortfolioImage(`/portfolio/qr-artisticos-3d-${number}.webp`)).toBe(true);
    }
    expect(isRetiredQrPortfolioImage("/api/media/qr-personalizado.webp")).toBe(false);
    expect(isRetiredQrPortfolioImage("/portfolio/qr-personalizado.webp")).toBe(false);
  });
});

describe("lectura de los QR destacados después de redimensionar", () => {
  it.each(qr.images)("$alt", async image => {
    const asset = new URL(`../../../shopify-optimizer/public${image.url}`, import.meta.url);
    const original = await readFile(asset);
    const expected = await decodeQrImage(original);
    expect(Boolean(expected), "El original debe contener un QR legible").toBe(true);
    for (const width of [128, 160, 192, 256, 320, 512]) {
      const resized = await sharp(original).resize(width, width, { fit: "inside" }).png().toBuffer();
      const decoded = await decodeQrImage(resized);
      // No se imprimen los destinos de los QR en los logs de las pruebas.
      expect(Boolean(decoded) && decoded === expected, `Lectura fiel a ${width}px`).toBe(true);
    }
  }, 30_000);
});
