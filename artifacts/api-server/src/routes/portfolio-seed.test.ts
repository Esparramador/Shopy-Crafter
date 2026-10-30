import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeQrImage } from "../lib/card-qr-art.js";
import { isRetiredQrPortfolioImage, removeRetiredQrPortfolioImages, SEED } from "./portfolio-seed.js";

// El slug y los nombres de archivo antiguos son identificadores estables, no texto promocional.
const qr = SEED.find(project => project.slug === "qr-artisticos-3d")!;

describe("oferta pública de QR artísticos", () => {
  it("mantiene el título, la descripción, las funciones y las tecnologías centradas en QR artísticos", () => {
    expect(qr).toBeDefined();
    const publicText = [
      qr.title, qr.summary, qr.description, qr.category,
      ...qr.features, ...qr.tech, ...qr.images.map(image => image.alt),
      ...qr.variants.flatMap(variant => [
        variant.name, variant.summary, variant.description, ...variant.features, ...variant.tech,
      ]),
    ].join("\n");
    expect(qr.title).toBe("QR artísticos para marcas");
    expect(qr.summary).toMatch(/QR.*arte e ilustraciones/i);
    expect(qr.description).toMatch(/códigos QR.*ilustraciones/i);
    expect(qr.features).toContain("QR integrados en ilustraciones y fotografías de la marca");
    expect(qr.features.length).toBeGreaterThan(0);
    expect(publicText).not.toMatch(/\b3\s*-?\s*d\b|\bwebgl\b|\bthree\.?js\b|tridimensional/i);
  });

  it("describe cada imagen como un QR integrado en una muestra artística", () => {
    expect(qr.images).toHaveLength(4);
    expect(qr.images.every(image => !isRetiredQrPortfolioImage(image.url))).toBe(true);
    for (const image of qr.images) {
      expect(image.alt).toMatch(/\bQR\b/i);
      expect(image.alt).toMatch(/artístic|ilustrad|composición|colores/i);
    }
    for (const number of [1, 2, 3, 4, 5, 9]) {
      expect(isRetiredQrPortfolioImage(`/portfolio/qr-artisticos-3d-${number}.webp`)).toBe(true);
    }
    expect(isRetiredQrPortfolioImage("/api/media/qr-personalizado.webp")).toBe(false);
    expect(isRetiredQrPortfolioImage("/portfolio/qr-personalizado.webp")).toBe(false);
  });
});

describe("migración de imágenes QR retiradas", () => {
  it("quita las escenas antiguas y conserva las subidas por administración", () => {
    const currentImages = [
      { url: "/portfolio/qr-artisticos-3d-3.webp", alt: "Escena QR antigua" },
      { url: "/portfolio/qr-artisticos-3d-6.webp", alt: "QR artístico destacado" },
      { url: "/api/media/admin-qr-upload", alt: "Imagen subida por administración" },
      { url: "/portfolio/otro-proyecto.webp", alt: "Imagen de otro proyecto" },
    ];

    expect(removeRetiredQrPortfolioImages(currentImages)).toEqual([
      currentImages[1],
      currentImages[2],
      currentImages[3],
    ]);
  });
});

describe("lectura de los QR destacados después de redimensionar", () => {
  it.each(qr.images)("$alt", async image => {
    const asset = new URL(`../../../shopify-optimizer/public${image.url}`, import.meta.url);
    const original = await readFile(asset);
    const expected = await decodeQrImage(original);
    expect(Boolean(expected), "El original debe contener un QR legible").toBe(true);
    // Display sizes first, then 300/600/900 px print checks (1/2/3 in at 300 DPI).
    for (const width of [128, 160, 192, 256, 300, 320, 384, 512, 600, 768, 900]) {
      const resized = await sharp(original).resize(width, width, { fit: "inside" }).png().toBuffer();
      const decoded = await decodeQrImage(resized);
      // No se imprimen los destinos de los QR en los logs de las pruebas.
      expect(Boolean(decoded) && decoded === expected, `Lectura fiel a ${width}px`).toBe(true);
    }
  }, 30_000);
});
