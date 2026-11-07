import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import express from "express";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH_VERSION, SEED_VERSION } from "./portfolio-seed.js";

/** Base de datos simulada: solo las sentencias que usan estas rutas, con el estado en memoria. */
const state = vi.hoisted(() => ({
  project: null as Record<string, unknown> | null,
  writes: [] as string[],
  saved: [] as Buffer[],
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: async (query: { text?: string; values?: unknown[] }) => {
      const text = query.text ?? "";
      const values = query.values ?? [];
      if (/^\s*(CREATE TABLE|ALTER TABLE)/.test(text)) return { rows: [] };
      if (text.includes("SELECT value FROM portfolio_meta")) {
        return { rows: [{ value: String(text.includes("seed_version") ? SEED_VERSION : PATCH_VERSION) }] };
      }
      if (text.includes("SET seed_defaults =") && text.includes("seed_defaults IS NULL")) return { rows: [] };
      const p = state.project;
      if (text.includes("SELECT id FROM portfolio_projects WHERE id") || text.includes("SELECT * FROM portfolio_projects WHERE id")) {
        return { rows: p && p.id === values[0] ? [p] : [] };
      }
      if (text.includes("SELECT * FROM portfolio_projects WHERE published = TRUE")) {
        return { rows: p?.published ? [p] : [] };
      }
      if (text.includes("SET images = images ||")) {
        state.writes.push(text);
        if (!p || p.id !== values[1]) return { rows: [] };
        p.images = [...(p.images as unknown[]), ...JSON.parse(String(values[0]))];
        return { rows: [p] };
      }
      if (text.includes("UPDATE portfolio_projects SET") && text.includes("published =")) {
        state.writes.push(text);
        const [title, client, category, summary, description, tech, features, variants, status, liveUrl, appUrl, images, sortOrder, published, id] = values;
        if (!p || p.id !== id) return { rows: [] };
        Object.assign(p, {
          title, client, category, summary, description, status, live_url: liveUrl, app_url: appUrl, sort_order: sortOrder, published,
          tech: JSON.parse(String(tech)), features: JSON.parse(String(features)), variants: JSON.parse(String(variants)), images: JSON.parse(String(images)),
        });
        return { rows: [p] };
      }
      state.writes.push(text);
      throw new Error(`Sentencia no prevista en la prueba: ${text}`);
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
  saveMedia: vi.fn(async (buf: Buffer) => { state.saved.push(buf); return { id: `m${state.saved.length}`, url: `/api/media/m${state.saved.length}` }; }),
  getMedia: vi.fn(), deleteMedia: vi.fn(), mediaIdFromUrl: vi.fn(() => null),
}));

const { default: router } = await import("./portfolio.js");

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
afterAll(() => new Promise<void>(r => server.close(() => r())));

const originalImages = [{ url: "/portfolio/existente.webp", alt: "Existente", w: 100, h: 100 }];
beforeEach(() => {
  state.project = {
    id: 5, slug: "qr-prueba", title: "QR de prueba", client: null, category: "Diseño", summary: "", description: "",
    tech: [], features: [], status: "", live_url: null, app_url: null, images: structuredClone(originalImages),
    variants: [], sort_order: 0, published: true,
  };
  state.writes = [];
  state.saved = [];
});

const readableQr = () => readFile(new URL("../../../shopify-optimizer/public/portfolio/qr-artisticos-3d-6.webp", import.meta.url));
const unreadable = () => sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer();

function form(files: { name: string; type: string; data: Buffer }[], qrArtwork?: string): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("files", new Blob([new Uint8Array(f.data)], { type: f.type }), f.name);
  if (qrArtwork !== undefined) fd.append("qrArtwork", qrArtwork);
  return fd;
}

describe("subida multipart del portfolio con verificación QR (#132)", () => {
  it("un lote con un QR ilegible devuelve 422 con los tamaños y no guarda ni modifica nada", async () => {
    const before = structuredClone(state.project);
    const r = await fetch(`${base}/admin/portfolio/5/images`, {
      method: "POST",
      body: form([
        { name: "bueno.webp", type: "image/webp", data: await readableQr() },
        { name: "malo.png", type: "image/png", data: await unreadable() },
      ], "true"),
    });
    expect(r.status).toBe(422);
    const body = await r.json() as { qrChecks: { filename: string; passed: boolean; checks: { sizePx: number; passed: boolean }[] }[] };
    expect(body.qrChecks.map(c => [c.filename, c.passed])).toEqual([["bueno.webp", true], ["malo.png", false]]);
    expect(body.qrChecks[1].checks.map(c => c.sizePx)).toEqual([320, 256, 192, 160, 128]);
    expect(body.qrChecks[1].checks.every(c => !c.passed)).toBe(true);
    expect(state.saved).toEqual([]);
    expect(state.writes).toEqual([]);
    expect(state.project).toEqual(before);
  }, 60_000);

  it("la subida normal, sin modo QR, sigue añadiendo la imagen sin comprobarla", async () => {
    const r = await fetch(`${base}/admin/portfolio/5/images`, {
      method: "POST", body: form([{ name: "captura.png", type: "image/png", data: await unreadable() }]),
    });
    expect(r.status).toBe(200);
    const project = await r.json() as { images: Record<string, unknown>[]; qrChecks?: unknown };
    expect(project.qrChecks).toBeUndefined();
    expect(state.saved).toHaveLength(1);
    expect(project.images).toHaveLength(2);
    expect(project.images[1]).toMatchObject({ url: "/api/media/m1", alt: "captura" });
    expect(project.images[1].qrCheck).toBeUndefined();
  });
});

describe("resultado QR guardado por versión de imagen (#131)", () => {
  it("guarda tamaños y huella del archivo servido, los conserva al reordenar y no los publica", async () => {
    const r = await fetch(`${base}/admin/portfolio/5/images`, {
      method: "POST", body: form([{ name: "bueno.webp", type: "image/webp", data: await readableQr() }], "true"),
    });
    expect(r.status).toBe(200);
    const { project } = await r.json() as { project: { images: { url: string; qrCheck?: { sha256: string; passed: boolean; checks: unknown[] } }[] } };
    const uploaded = project.images[1];
    expect(uploaded.qrCheck?.passed).toBe(true);
    expect(uploaded.qrCheck?.checks).toHaveLength(5);
    expect(uploaded.qrCheck?.sha256).toBe(createHash("sha256").update(state.saved[0]).digest("hex"));

    // Al volver al proyecto (o reordenar), el resultado sigue ahí; el navegador no puede inventarlo.
    const put = await fetch(`${base}/admin/portfolio/5`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ images: [
        { url: uploaded.url, alt: "Portada" },
        { url: originalImages[0].url, alt: "Existente", qrCheck: { passed: true, checks: [], checkedAt: "x", sha256: "falso" } },
      ] }),
    });
    const saved = await put.json() as { images: { url: string; qrCheck?: unknown }[] };
    expect(saved.images[0].qrCheck).toEqual(uploaded.qrCheck);
    expect(saved.images[1].qrCheck).toBeUndefined();

    const pub = await (await fetch(`${base}/portfolio`)).json() as { images: Record<string, unknown>[] }[];
    expect(pub[0].images.every(im => !("qrCheck" in im))).toBe(true);
  }, 60_000);
});
