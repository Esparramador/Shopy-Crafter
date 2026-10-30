import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { decodeQrImageAtNativeSize } from "../lib/card-qr-art.js";
import {
  isRetiredQrPortfolioImage, mergeGenericSeedCopy, removeRetiredQrPortfolioImages,
  PATCH_PREVIOUS, PATCH_VERSION, SEED, SEED_VERSION,
} from "./portfolio-seed.js";

const migrationState = vi.hoisted(() => ({
  meta: {} as Record<string, string>,
  projects: [] as Array<Record<string, unknown>>,
  writes: [] as string[],
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: async (query: { text?: string; values?: unknown[] }) => {
      const text = query.text ?? "";
      const values = query.values ?? [];
      if (text.includes("SELECT value FROM portfolio_meta")) {
        const key = text.includes("seed_version") ? "seed_version" : "patch_version";
        const value = migrationState.meta[key];
        return { rows: value === undefined ? [] : [{ value }] };
      }
      if (text.includes("SELECT id") && text.includes("FROM portfolio_projects WHERE slug")) {
        const project = migrationState.projects.find(row => row.slug === values[0]);
        return { rows: project ? [project] : [] };
      }
      if (text.includes("INSERT INTO portfolio_projects")) {
        const [slug, title, client, category, summary, description, tech, features, status, liveUrl, appUrl, images, variants, sortOrder] = values;
        if (!migrationState.projects.some(row => row.slug === slug)) {
          migrationState.projects.push({
            id: migrationState.projects.length + 1,
            slug, title, client, category, summary, description,
            tech: JSON.parse(String(tech)), features: JSON.parse(String(features)), status, liveUrl, appUrl,
            images: JSON.parse(String(images)), variants: JSON.parse(String(variants)), sortOrder,
          });
        }
        migrationState.writes.push(text);
        return { rows: [] };
      }
      if (text.includes("UPDATE portfolio_projects SET")) {
        const [title, client, category, summary, description, status, features, tech, images, variants, id] = values;
        const project = migrationState.projects.find(row => row.id === id);
        if (!project) throw new Error(`Portfolio project not found for update: ${String(id)}`);
        Object.assign(project, {
          title, client, category, summary, description, status,
          features: JSON.parse(String(features)), tech: JSON.parse(String(tech)),
          images: JSON.parse(String(images)), variants: JSON.parse(String(variants)),
        });
        migrationState.writes.push(text);
        return { rows: [] };
      }
      if (text.includes("INSERT INTO portfolio_meta")) {
        const key = text.includes("patch_version") ? "patch_version" : "seed_version";
        const value = values.at(-1);
        migrationState.meta[key] = String(value);
        migrationState.writes.push(text);
        return { rows: [] };
      }
      migrationState.writes.push(text);
      throw new Error(`Unexpected portfolio migration write: ${text}`);
    },
  },
}));
vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }),
    { raw: () => ({}) },
  ),
}));
vi.mock("../lib/auth.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../lib/media-store.js", () => ({
  saveMedia: vi.fn(), getMedia: vi.fn(), deleteMedia: vi.fn(), mediaIdFromUrl: vi.fn(),
}));

const { applySeed, applyPatches } = await import("./portfolio.js");

describe("reaplicación de migraciones del portfolio", () => {
  const existingAdminEdit = {
    slug: "proyecto-editado",
    title: "Título personalizado",
    images: [],
    features: ["Contenido retirado por administración"],
  };

  function setRecordedVersion(key: "seed_version" | "patch_version", version: number) {
    migrationState.meta = { [key]: String(version) };
    migrationState.projects = [{ ...existingAdminEdit }];
    migrationState.writes = [];
  }

  it("no recrea proyectos borrados ni modifica datos si la versión seed ya está aplicada", async () => {
    setRecordedVersion("seed_version", SEED_VERSION);
    const before = structuredClone(migrationState.projects);

    await applySeed();
    await applySeed();

    expect(migrationState.projects).toEqual(before);
    expect(migrationState.projects.some(project => project.slug === SEED[0].slug)).toBe(false);
    expect(migrationState.writes).toEqual([]);
  });

  it("no recrea proyectos borrados ni repone contenido retirado si el patch ya está aplicado", async () => {
    setRecordedVersion("patch_version", PATCH_VERSION);
    const before = structuredClone(migrationState.projects);

    await applyPatches();
    await applyPatches();

    expect(migrationState.projects).toEqual(before);
    expect(migrationState.projects.some(project => project.slug === SEED[0].slug)).toBe(false);
    expect(migrationState.projects[0]).toEqual(existingAdminEdit);
    expect(migrationState.writes).toEqual([]);
  });

  it("aplica un patch nuevo solo sobre contenido intacto y conserva los cambios de administración", async () => {
    const slug = "qr-artisticos-3d";
    const seed = SEED.find(project => project.slug === slug)!;
    const previous = PATCH_PREVIOUS[slug];
    const adminImages = [
      { url: "/api/media/admin-qr-upload", alt: "Foto añadida por administración" },
      { url: "/portfolio/qr-artisticos-3d-6.webp", alt: "Muestra conservada" },
    ];
    const adminVariant = {
      name: "Versión personalizada",
      client: "Cliente editado",
      status: "En pruebas",
      summary: "Resumen de variante personalizado",
      description: "Descripción de variante personalizada",
      features: ["Función propia"],
      tech: ["Herramienta propia"],
      images: [{ url: "/api/media/admin-variant", alt: "Imagen personalizada de variante" }],
    };
    const project = {
      id: 42,
      slug,
      title: previous.fields.title,
      client: "Cliente personalizado",
      category: "Categoría personalizada",
      summary: previous.fields.summary,
      description: "Descripción personalizada por administración",
      status: "Estado personalizado",
      features: [
        "Función personalizada por administración",
        "Escenas en 3D: escena retirada",
        "Vídeo de la transformación QR",
      ],
      tech: ["Tecnología personalizada", "Three.js", "WebGL"],
      images: [
        { url: "/portfolio/qr-artisticos-3d-3.webp", alt: "Imagen retirada" },
        ...adminImages,
      ],
      variants: [adminVariant],
    };
    migrationState.meta = { patch_version: String(PATCH_VERSION - 1) };
    // apps-redes-ia fue borrado antes de esta versión; un patch solo actualiza filas existentes.
    migrationState.projects = [project];
    migrationState.writes = [];

    await applyPatches();

    expect(migrationState.projects.find(row => row.slug === slug)).toEqual({
      ...project,
      title: seed.title,
      summary: seed.summary,
      features: ["Función personalizada por administración"],
      tech: ["Tecnología personalizada"],
      images: adminImages,
      variants: [adminVariant],
    });
    expect(migrationState.projects.some(row => row.slug === "apps-redes-ia")).toBe(false);
    expect(migrationState.meta.patch_version).toBe(String(PATCH_VERSION));
  });
});

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

describe("actualización de texto genérico del portfolio", () => {
  const previous = {
    title: "Título genérico anterior",
    summary: "Resumen genérico anterior",
    description: "Descripción genérica anterior",
  };
  const nextSeed = {
    title: "Título actualizado",
    summary: "Resumen actualizado",
    description: "Descripción actualizada",
    images: [{ url: "/portfolio/nueva.webp", alt: "Imagen nueva" }],
  };

  it("actualiza los textos que todavía coinciden con la versión genérica anterior", () => {
    expect(mergeGenericSeedCopy({
      ...previous,
      images: [],
    }, nextSeed, previous)).toEqual({
      ...nextSeed,
    });
  });

  it("conserva por separado el texto e imágenes editados desde administración", () => {
    const adminImages = [{ url: "/api/media/admin-upload", alt: "Imagen personalizada" }];
    expect(mergeGenericSeedCopy({
      title: "Título escrito por administración",
      summary: "Resumen escrito por administración",
      description: "Descripción escrita por administración",
      images: adminImages,
    }, nextSeed, previous)).toEqual({
      title: "Título escrito por administración",
      summary: "Resumen escrito por administración",
      description: "Descripción escrita por administración",
      images: adminImages,
    });
  });
});

describe("lectura de los QR destacados después de redimensionar", () => {
  it.each(qr.images)("$alt", async image => {
    const asset = new URL(`../../../shopify-optimizer/public${image.url}`, import.meta.url);
    const original = await readFile(asset);
    const expected = await decodeQrImageAtNativeSize(original);
    expect(Boolean(expected), "El original debe contener un QR legible").toBe(true);
    // Raster sizes represent digital display plus 2/3/3.5/4.5 cm at 300 DPI.
    // The decoder receives each exact raster; it must not enlarge small samples.
    for (const width of [128, 160, 192, 236, 256, 295, 300, 320, 354, 384, 413, 512, 531, 600, 768, 900]) {
      const resized = await sharp(original).resize(width, width, { fit: "inside" }).png().toBuffer();
      const decoded = await decodeQrImageAtNativeSize(resized);
      // No se imprimen los destinos de los QR en los logs de las pruebas.
      expect(Boolean(decoded) && decoded === expected, `Lectura fiel a ${width}px`).toBe(true);
    }
  }, 30_000);
});
