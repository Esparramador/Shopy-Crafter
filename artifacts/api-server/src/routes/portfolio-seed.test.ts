import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { decodeQrImageAtNativeSize } from "../lib/card-qr-art.js";
import {
  isRetiredQrPortfolioImage, mergeGenericSeedCopy, removeRetiredQrPortfolioImages, mergeSeedProject, mergeSeedVariants,
  seedDefaultsOf, confirmedPreLedgerDeletions,
  PATCH_PREVIOUS, PATCH_VERSION, SEED, SEED_VERSION, type SeedProject, type SeedVariant,
} from "./portfolio-seed.js";

const migrationState = vi.hoisted(() => ({
  meta: {} as Record<string, string>,
  projects: [] as Array<Record<string, unknown>>,
  deletedSlugs: new Set<string>(),
  snapshots: new Map<string, Record<string, unknown>>(),
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
      if (text.includes("SELECT slug FROM portfolio_deleted_projects")) {
        return { rows: Array.from(migrationState.deletedSlugs, slug => ({ slug })) };
      }
      if (text.includes("SELECT slug FROM portfolio_projects")) {
        return { rows: migrationState.projects.map(row => ({ slug: row.slug })) };
      }
      if (text.includes("SELECT project FROM portfolio_deleted_projects WHERE slug")) {
        const slug = String(values[0]);
        return { rows: migrationState.deletedSlugs.has(slug) ? [{ project: migrationState.snapshots.get(slug) ?? null }] : [] };
      }
      if (text.includes("INSERT INTO portfolio_deleted_projects (slug) VALUES")) {
        migrationState.deletedSlugs.add(String(values[0]));
        migrationState.writes.push(text);
        return { rows: [] };
      }
      if (text.includes("WITH removed AS") && text.includes("DELETE FROM portfolio_projects")) {
        const project = migrationState.projects.find(row => row.id === values[0]);
        if (!project) return { rows: [] };
        migrationState.projects = migrationState.projects.filter(row => row.id !== values[0]);
        migrationState.deletedSlugs.add(String(project.slug));
        migrationState.snapshots.set(String(project.slug), structuredClone(project));
        migrationState.writes.push(text);
        return { rows: [{ slug: project.slug }] };
      }
      if (text.includes("WITH restored AS")) {
        const [slug, title, client, category, summary, description, tech, features, status, liveUrl, appUrl, images, variants, sortOrder, published, defaults, existsSlug] = values;
        if (!migrationState.deletedSlugs.has(String(existsSlug)) || migrationState.projects.some(row => row.slug === slug)) return { rows: [] };
        const row = {
          id: 100 + migrationState.projects.length, slug, title, client, category, summary, description, status,
          tech: JSON.parse(String(tech)), features: JSON.parse(String(features)), live_url: liveUrl, app_url: appUrl,
          images: JSON.parse(String(images)), variants: JSON.parse(String(variants)), sort_order: sortOrder, published,
          seed_defaults: defaults === null ? null : JSON.parse(String(defaults)),
        };
        migrationState.projects.push(row);
        migrationState.deletedSlugs.delete(String(slug));
        migrationState.snapshots.delete(String(slug));
        migrationState.writes.push(text);
        return { rows: [row] };
      }
      if ((text.includes("SELECT id") || text.includes("SELECT *")) && text.includes("FROM portfolio_projects WHERE slug")) {
        const project = migrationState.projects.find(row => row.slug === values[0]);
        return { rows: project ? [project] : [] };
      }
      if (text.includes("INSERT INTO portfolio_projects")) {
        const [slug, title, client, category, summary, description, tech, features, status, liveUrl, appUrl, images, variants, sortOrder, defaults] = values;
        if (!migrationState.projects.some(row => row.slug === slug)) {
          migrationState.projects.push({
            id: migrationState.projects.length + 1,
            slug, title, client, category, summary, description,
            tech: JSON.parse(String(tech)), features: JSON.parse(String(features)), status, live_url: liveUrl, app_url: appUrl,
            images: JSON.parse(String(images)), variants: JSON.parse(String(variants)), sort_order: sortOrder,
            seed_defaults: JSON.parse(String(defaults)),
          });
        }
        migrationState.writes.push(text);
        return { rows: [] };
      }
      if (text.includes("SET seed_defaults =") && text.includes("seed_defaults IS NULL")) {
        const [defaults, slug] = values;
        const project = migrationState.projects.find(row => row.slug === slug);
        if (project && project.seed_defaults == null) project.seed_defaults = JSON.parse(String(defaults));
        return { rows: [] };
      }
      if (text.includes("UPDATE portfolio_projects SET") && text.includes("seed_defaults =")) {
        const [title, client, category, summary, description, status, tech, features, liveUrl, appUrl, images, variants, sortOrder, defaults, id] = values;
        const project = migrationState.projects.find(row => row.id === id);
        if (!project) throw new Error(`Portfolio project not found for seed update: ${String(id)}`);
        Object.assign(project, {
          title, client, category, summary, description, status,
          tech: JSON.parse(String(tech)), features: JSON.parse(String(features)), live_url: liveUrl, app_url: appUrl,
          images: JSON.parse(String(images)), variants: JSON.parse(String(variants)), sort_order: sortOrder,
          seed_defaults: JSON.parse(String(defaults)),
        });
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

const { applySeed, applyPatches, backfillPreLedgerDeletions, restorePortfolioProject, deletePortfolioProject } = await import("./portfolio.js");

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
    migrationState.deletedSlugs = new Set();
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

  it("registra una eliminación y evita reinsertar el proyecto en una versión seed posterior", async () => {
    const deletedSlug = SEED[0].slug;
    migrationState.meta = { seed_version: String(SEED_VERSION - 1) };
    migrationState.projects = [{
      id: 7,
      slug: deletedSlug,
      title: "Proyecto que se eliminará",
      images: [{ url: "/portfolio/deleted.webp", alt: "Imagen" }],
    }];
    migrationState.deletedSlugs = new Set();
    migrationState.writes = [];

    await expect(deletePortfolioProject(7)).resolves.toBe(true);
    expect(migrationState.projects).toEqual([]);
    expect(migrationState.deletedSlugs.has(deletedSlug)).toBe(true);

    await applySeed();

    expect(migrationState.projects.some(project => project.slug === deletedSlug)).toBe(false);
    expect(migrationState.projects.some(project => project.slug === SEED[1].slug)).toBe(true);
  });

  it("no vuelve a insertar en un patch un proyecto que ya había sido eliminado", async () => {
    const deletedSlug = "taller-laser";
    migrationState.meta = { patch_version: String(PATCH_VERSION - 1) };
    migrationState.projects = [];
    migrationState.deletedSlugs = new Set([deletedSlug]);
    migrationState.writes = [];

    await applyPatches();

    expect(migrationState.projects.some(project => project.slug === deletedSlug)).toBe(false);
    expect(migrationState.meta.patch_version).toBe(String(PATCH_VERSION));
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

const baseVariant: SeedVariant = {
  name: "Versión A", client: "Cliente A", status: "En producción", summary: "Resumen A", description: "Descripción A",
  features: ["Función A"], tech: ["Tec A"], images: [{ url: "/portfolio/a.webp", alt: "A" }],
};
const oldSeed: SeedProject = {
  slug: "proyecto-prueba", title: "Título v1", client: "Cliente v1", category: "Categoría v1", status: "Estado v1",
  summary: "Resumen v1", description: "Descripción v1", features: ["Función v1"], tech: ["Tec v1"],
  liveUrl: "https://v1.example/", appUrl: null, images: [{ url: "/portfolio/v1.webp", alt: "v1" }], sortOrder: 3,
  variants: [baseVariant, { ...baseVariant, name: "Versión retirada", description: "Retirada" }],
};
const newSeed: SeedProject = {
  ...oldSeed, title: "Título v2", client: "Cliente v2", category: "Categoría v2", status: "Estado v2",
  summary: "Resumen v2", description: "Descripción v2", features: ["Función v2"], tech: ["Tec v2"],
  liveUrl: "https://v2.example/", appUrl: "https://app.v2.example/", images: [{ url: "/portfolio/v2.webp", alt: "v2" }], sortOrder: 5,
  variants: [
    { ...baseVariant, client: "Cliente A2", summary: "Resumen A2", description: "Descripción A2", features: ["Función A2"], tech: ["Tec A2"], images: [{ url: "/portfolio/a2.webp", alt: "A2" }] },
    { ...baseVariant, name: "Versión nueva", description: "Nueva" },
  ],
};

describe("actualización de la semilla campo a campo (#133)", () => {
  it("actualiza los campos por defecto y conserva por separado los editados", () => {
    const row = {
      ...seedDefaultsOf(oldSeed),
      client: "Cliente editado", features: ["Función editada"], liveUrl: "https://editada.example/", status: "Estado editado",
    };
    const merged = mergeSeedProject(row, newSeed, seedDefaultsOf(oldSeed));
    expect(merged).toMatchObject({
      title: "Título v2", category: "Categoría v2", summary: "Resumen v2", description: "Descripción v2",
      tech: ["Tec v2"], sortOrder: 5, images: newSeed.images, appUrl: "https://app.v2.example/",
      client: "Cliente editado", features: ["Función editada"], liveUrl: "https://editada.example/", status: "Estado editado",
    });
  });

  it("sin valores anteriores conocidos no pisa nada más que lo vacío", () => {
    const row = { ...seedDefaultsOf(oldSeed), images: [], liveUrl: null };
    const merged = mergeSeedProject(row, newSeed, null);
    expect(merged).toEqual({ ...row, images: newSeed.images, liveUrl: newSeed.liveUrl, appUrl: newSeed.appUrl });
  });

  it("applySeed fusiona una fila con seed_defaults y guarda los nuevos valores por defecto", async () => {
    const seed = SEED[0];
    const defaults = { ...seedDefaultsOf(seed), category: "Categoría anterior", tech: ["Tec anterior"], client: "Cliente anterior" };
    migrationState.meta = { seed_version: String(SEED_VERSION - 1) };
    migrationState.deletedSlugs = new Set(SEED.slice(1).map(p => p.slug));
    migrationState.writes = [];
    migrationState.projects = [{
      id: 1, slug: seed.slug, title: seed.title, client: "Cliente editado por admin", category: "Categoría anterior",
      summary: seed.summary, description: seed.description, status: seed.status, features: ["Editada"], tech: ["Tec anterior"],
      live_url: seed.liveUrl, app_url: seed.appUrl, images: seed.images, variants: seed.variants, sort_order: seed.sortOrder,
      published: true, seed_defaults: defaults,
    }];
    await applySeed();
    const row = migrationState.projects[0];
    expect(row).toMatchObject({ client: "Cliente editado por admin", category: seed.category, tech: seed.tech, features: ["Editada"] });
    expect(row.seed_defaults).toEqual(seedDefaultsOf(seed));
  });
});

describe("variantes personalizadas durante la actualización de la semilla (#134)", () => {
  it("actualiza los campos por defecto de una variante y conserva los personalizados y sus imágenes", () => {
    const customImages = [{ url: "/api/media/propia", alt: "Imagen propia" }];
    const custom = { ...baseVariant, name: "Variante creada en el panel" };
    const current = [
      { ...baseVariant, summary: "Resumen editado", images: customImages },
      { ...baseVariant, name: "Versión retirada", description: "Retirada" },
      custom,
    ];
    const merged = mergeSeedVariants(current, newSeed.variants, oldSeed.variants);
    expect(merged).toEqual([
      {
        ...baseVariant, client: "Cliente A2", description: "Descripción A2", features: ["Función A2"], tech: ["Tec A2"],
        summary: "Resumen editado", images: customImages,
      },
      custom,
      newSeed.variants[1],
    ]);
  });

  it("conserva una variante retirada de la semilla si se había editado y no recrea una borrada", () => {
    const edited = { ...baseVariant, name: "Versión retirada", description: "Editada" };
    const merged = mergeSeedVariants([edited], newSeed.variants, oldSeed.variants);
    // «Versión A» estaba en la semilla anterior y ya no está en la fila: la borró el admin.
    expect(merged).toEqual([edited, newSeed.variants[1]]);
  });

  it("sin variantes anteriores conocidas no toca las de la fila", () => {
    const current = [{ ...baseVariant, summary: "Cualquiera" }];
    expect(mergeSeedVariants(current, newSeed.variants, undefined)).toBe(current);
  });
});

describe("borrados anteriores al registro (#139)", () => {
  it("solo anota slugs confirmados de la semilla que no existen ahora", () => {
    const existing = new Set([SEED[1].slug]);
    expect(confirmedPreLedgerDeletions([SEED[0].slug, SEED[1].slug, "nunca-sembrado", SEED[0].slug], existing))
      .toEqual([SEED[0].slug]);
  });

  it("el relleno registra el borrado confirmado y la semilla posterior no lo recrea", async () => {
    migrationState.meta = { seed_version: String(SEED_VERSION - 1) };
    migrationState.projects = [];
    migrationState.deletedSlugs = new Set();
    migrationState.writes = [];
    await expect(backfillPreLedgerDeletions([SEED[2].slug, "proyecto-del-panel"])).resolves.toEqual([SEED[2].slug]);
    expect([...migrationState.deletedSlugs]).toEqual([SEED[2].slug]);
    await applySeed();
    expect(migrationState.projects.some(p => p.slug === SEED[2].slug)).toBe(false);
    expect(migrationState.projects.some(p => p.slug === SEED[3].slug)).toBe(true);
  });

  it("sin confirmación no anota nada", async () => {
    migrationState.deletedSlugs = new Set();
    migrationState.writes = [];
    await expect(backfillPreLedgerDeletions([])).resolves.toEqual([]);
    expect(migrationState.writes).toEqual([]);
  });
});

describe("restaurar un proyecto borrado (#140)", () => {
  it("restaura la copia guardada con su estado de publicación y quita la marca de borrado", async () => {
    const seed = SEED[0];
    migrationState.projects = [{
      id: 9, slug: seed.slug, title: "Título editado", client: null, category: "Cat", summary: "", description: "",
      status: "", features: [], tech: [], live_url: null, app_url: null, images: [{ url: "/api/media/x", alt: "x" }],
      variants: [], sort_order: 2, published: false, seed_defaults: seedDefaultsOf(seed),
    }];
    migrationState.deletedSlugs = new Set();
    migrationState.snapshots = new Map();
    await deletePortfolioProject(9);
    expect(migrationState.deletedSlugs.has(seed.slug)).toBe(true);

    const restored = await restorePortfolioProject(seed.slug);
    expect(restored).toMatchObject({ slug: seed.slug, title: "Título editado", published: false, images: [{ url: "/api/media/x", alt: "x" }] });
    expect(migrationState.deletedSlugs.has(seed.slug)).toBe(false);
    expect(migrationState.projects.find(p => p.slug === seed.slug)?.seed_defaults).toEqual(seedDefaultsOf(seed));
  });

  it("sin copia, recrea un proyecto de la semilla; uno ajeno a la semilla no es restaurable", async () => {
    migrationState.projects = [];
    migrationState.snapshots = new Map();
    migrationState.deletedSlugs = new Set([SEED[1].slug, "proyecto-del-panel"]);
    expect(await restorePortfolioProject(SEED[1].slug)).toMatchObject({ slug: SEED[1].slug, title: SEED[1].title, published: true });
    expect(await restorePortfolioProject("proyecto-del-panel")).toBeNull();
    expect(migrationState.deletedSlugs.has("proyecto-del-panel")).toBe(true);
  });

  it("no restaura si ya existe otro proyecto con ese slug", async () => {
    migrationState.projects = [{ id: 1, slug: SEED[1].slug, title: "Nuevo" }];
    migrationState.deletedSlugs = new Set([SEED[1].slug]);
    expect(await restorePortfolioProject(SEED[1].slug)).toBeNull();
    expect(migrationState.deletedSlugs.has(SEED[1].slug)).toBe(true);
  });
});
