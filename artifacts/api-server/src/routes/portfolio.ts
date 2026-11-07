/**
 * Portfolio de proyectos realizados (landing) + servidor de medios.
 *   GET    /api/media/:id                       — imagen subida (pública, cacheable)
 *   GET    /api/portfolio                       — proyectos publicados (público)
 *   GET    /api/admin/portfolio                 — todos (admin)
 *   POST   /api/admin/portfolio                 — crear (admin)
 *   PUT    /api/admin/portfolio/:id             — editar (admin)
 *   DELETE /api/admin/portfolio/:id             — borrar (admin; queda copia restaurable)
 *   GET    /api/admin/portfolio/deleted         — borrados y proyectos de la semilla sin confirmar (admin)
 *   POST   /api/admin/portfolio/deleted         — confirmar un borrado anterior al registro (admin, body { slug })
 *   POST   /api/admin/portfolio/deleted/:slug/restore — restaurar (admin)
 *   DELETE /api/admin/portfolio/deleted/:slug   — borrar definitivamente la copia y sus imágenes (admin)
 *   POST   /api/admin/portfolio/:id/images      — subir imágenes (admin, multipart "files")
 *   DELETE /api/admin/portfolio/:id/images      — quitar una imagen (admin, body { url })
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { saveMedia, getMedia, deleteMedia, mediaIdFromUrl } from "../lib/media-store.js";
import { checkQrArtworkAtDisplaySizes, type QrArtworkSizeCheck } from "../lib/card-qr-art.js";
import { createHash } from "node:crypto";
import {
  SEED, SEED_VERSION, PATCH_VERSION, PATCH_RENAMES, PATCH_PREVIOUS, PATCH_NEW_SLUGS, PRE_LEDGER_DELETED_SLUGS,
  removeRetiredQrPortfolioImages, seedDefaultsOf, legacySeedDefaults, mergeSeedProject, confirmedPreLedgerDeletions,
  type SeedProject, type SeedDefaults,
} from "./portfolio-seed.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 12 } });
const QR_UPLOAD_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

type QrArtworkFileCheck = {
  filename: string;
  checks: QrArtworkSizeCheck[];
  passed: boolean;
  reason?: string;
};

function safeUploadName(name: string): string {
  const basename = name.replace(/\\/g, "/").split("/").pop() ?? "imagen";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 100) || "imagen";
}

/**
 * Resultado de la verificación QR de UNA versión concreta de una imagen: la URL de /api/media es
 * inmutable y `sha256` es la huella del WebP servido. Subir otra imagen crea otra entrada sin
 * resultado; solo el servidor lo escribe (el panel no puede inventarlo ni copiarlo a otra imagen).
 */
export interface PortfolioQrCheck {
  checks: QrArtworkSizeCheck[]; passed: boolean; checkedAt: string; sha256: string;
}
export interface PortfolioImage { url: string; alt: string; w?: number; h?: number; qrCheck?: PortfolioQrCheck }
export interface PortfolioProject {
  id: number; slug: string; title: string; client: string | null; category: string;
  summary: string; description: string; tech: string[]; liveUrl: string | null; appUrl: string | null;
  images: PortfolioImage[]; sortOrder: number; published: boolean;
  /** Qué hace el proyecto, punto por punto (lo que la landing enseña como lista). */
  features: string[];
  /** Estado: «En producción», «Entregado», «En desarrollo»… */
  status: string;
  /** Versiones del proyecto para clientes distintos (carrusel lateral de la tarjeta). */
  variants: PortfolioVariant[];
}
export interface PortfolioVariant {
  name: string; client: string; status: string; summary: string; description: string;
  features: string[]; tech: string[]; images: PortfolioImage[];
}

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portfolio_projects (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        client TEXT,
        category TEXT NOT NULL DEFAULT 'Proyecto',
        summary TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        tech JSONB NOT NULL DEFAULT '[]'::jsonb,
        live_url TEXT,
        app_url TEXT,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 0,
        published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS portfolio_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portfolio_deleted_projects (
        slug TEXT PRIMARY KEY,
        deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS seed_defaults JSONB`);
    await db.execute(sql`ALTER TABLE portfolio_deleted_projects ADD COLUMN IF NOT EXISTS project JSONB`);
    await backfillPreLedgerDeletions();
    await applySeed();
    await applyPatches();
    await recordMissingSeedDefaults();
  })().catch(err => { ready = null; throw err; });
  return ready;
}

function rowState(row: Record<string, unknown>): SeedDefaults {
  const p = toProject(row);
  return {
    title: p.title, client: p.client, category: p.category, status: p.status, summary: p.summary,
    description: p.description, features: p.features, tech: p.tech, liveUrl: p.liveUrl, appUrl: p.appUrl,
    images: p.images, sortOrder: p.sortOrder, variants: p.variants,
  };
}

async function insertSeedProject(p: SeedProject): Promise<void> {
  await db.execute(sql`
    INSERT INTO portfolio_projects (slug, title, client, category, summary, description, tech, features, status, live_url, app_url, images, variants, sort_order, seed_defaults)
    VALUES (${p.slug}, ${p.title}, ${p.client}, ${p.category}, ${p.summary}, ${p.description}, ${JSON.stringify(p.tech)}::jsonb,
            ${JSON.stringify(p.features)}::jsonb, ${p.status}, ${p.liveUrl}, ${p.appUrl}, ${JSON.stringify(p.images)}::jsonb,
            ${JSON.stringify(p.variants)}::jsonb, ${p.sortOrder}, ${JSON.stringify(seedDefaultsOf(p))}::jsonb)
    ON CONFLICT (slug) DO NOTHING
  `);
}

/**
 * Aplica la lista de proyectos reales UNA vez por versión (portfolio_meta.seed_version):
 *  - proyecto que no existe → se crea;
 *  - proyecto existente → cada campo (y cada campo de cada versión) que siga con el valor que la
 *    semilla escribió la vez anterior (seed_defaults) recibe el nuevo; lo editado desde el panel
 *    se conserva campo a campo;
 *  - proyectos borrados desde el panel quedan registrados y no se recrean.
 */
export async function applySeed(): Promise<void> {
  const meta = await db.execute(sql`SELECT value FROM portfolio_meta WHERE key = 'seed_version'`);
  const applied = Number((meta.rows[0] as { value?: string } | undefined)?.value ?? 0);
  if (applied >= SEED_VERSION) return;
  const deletedRows = await db.execute(sql`SELECT slug FROM portfolio_deleted_projects`);
  const deletedSlugs = new Set((deletedRows.rows as { slug: string }[]).map(row => row.slug));
  for (const p of SEED) {
    if (deletedSlugs.has(p.slug)) continue;
    const cur = await db.execute(sql`SELECT * FROM portfolio_projects WHERE slug = ${p.slug}`);
    const row = cur.rows[0] as Record<string, unknown> | undefined;
    if (!row) { await insertSeedProject(p); continue; }
    const previous = (row.seed_defaults as Partial<SeedDefaults> | null | undefined) ?? legacySeedDefaults(p.slug);
    const next = mergeSeedProject(rowState(row), p, previous);
    await db.execute(sql`
      UPDATE portfolio_projects SET title = ${next.title}, client = ${next.client}, category = ${next.category},
        summary = ${next.summary}, description = ${next.description}, status = ${next.status},
        tech = ${JSON.stringify(next.tech)}::jsonb, features = ${JSON.stringify(next.features)}::jsonb,
        live_url = ${next.liveUrl}, app_url = ${next.appUrl}, images = ${JSON.stringify(next.images)}::jsonb,
        variants = ${JSON.stringify(next.variants)}::jsonb, sort_order = ${next.sortOrder},
        seed_defaults = ${JSON.stringify(seedDefaultsOf(p))}::jsonb, updated_at = NOW()
      WHERE id = ${Number(row.id)}
    `);
  }
  await db.execute(sql`
    INSERT INTO portfolio_meta (key, value) VALUES ('seed_version', ${String(SEED_VERSION)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  logger.info({ version: SEED_VERSION }, "portfolio: lista de proyectos aplicada");
}

/**
 * Filas de la semilla anteriores a seed_defaults: la base ya refleja la semilla actual (seed y
 * patches aplicados), así que lo que la semilla ofrece hoy es su valor por defecto de referencia.
 */
export async function recordMissingSeedDefaults(): Promise<void> {
  for (const p of SEED) {
    await db.execute(sql`
      UPDATE portfolio_projects SET seed_defaults = ${JSON.stringify(seedDefaultsOf(p))}::jsonb
      WHERE slug = ${p.slug} AND seed_defaults IS NULL
    `);
  }
}

/** Anota en el registro de borrados los proyectos de la semilla que el dueño confirmó haber borrado antes de él. */
export async function backfillPreLedgerDeletions(confirmed: readonly string[] = PRE_LEDGER_DELETED_SLUGS): Promise<string[]> {
  if (!confirmed.length) return [];
  const existing = await db.execute(sql`SELECT slug FROM portfolio_projects`);
  const slugs = confirmedPreLedgerDeletions(confirmed, new Set((existing.rows as { slug: string }[]).map(r => r.slug)));
  for (const slug of slugs) {
    await db.execute(sql`INSERT INTO portfolio_deleted_projects (slug) VALUES (${slug}) ON CONFLICT (slug) DO NOTHING`);
  }
  if (slugs.length) logger.info({ slugs }, "portfolio: borrados anteriores al registro anotados");
  return slugs;
}

function renamed(text: string): string {
  return PATCH_RENAMES.reduce((t, [from, to]) => t.split(from).join(to), text);
}

/** Recorre un valor JSON y aplica los renombres a todos sus textos. */
function renamedDeep<T>(v: T): T {
  if (typeof v === "string") return renamed(v) as T;
  if (Array.isArray(v)) return v.map(renamedDeep) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, renamedDeep(x)])) as T;
  }
  return v;
}

/**
 * Correcciones de PATCH_PREVIOUS sobre filas existentes, una vez por PATCH_VERSION.
 * No crea filas: un proyecto borrado desde el panel sigue borrado.
 */
export async function applyPatches(): Promise<void> {
  const meta = await db.execute(sql`SELECT value FROM portfolio_meta WHERE key = 'patch_version'`);
  const applied = Number((meta.rows[0] as { value?: string } | undefined)?.value ?? 0);
  if (applied >= PATCH_VERSION) return;
  const deletedRows = await db.execute(sql`SELECT slug FROM portfolio_deleted_projects`);
  const deletedSlugs = new Set((deletedRows.rows as { slug: string }[]).map(row => row.slug));
  for (const slug of PATCH_NEW_SLUGS) {
    if (deletedSlugs.has(slug)) continue;
    const p = SEED.find(x => x.slug === slug);
    if (!p) continue;
    await insertSeedProject(p);
  }
  for (const [slug, prev] of Object.entries(PATCH_PREVIOUS)) {
    const seed = SEED.find(p => p.slug === slug);
    if (!seed) continue;
    const cur = await db.execute(sql`SELECT id, title, client, category, summary, description, status, features, tech, images, variants FROM portfolio_projects WHERE slug = ${slug}`);
    const row = cur.rows[0] as Record<string, unknown> | undefined;
    if (!row) continue;

    const next = (field: "title" | "client" | "category" | "summary" | "description" | "status"): string => {
      const now = String(row[field] ?? "");
      const before = prev.fields[field];
      return before !== undefined && now === before ? String(seed[field] ?? "") : renamed(now);
    };

    const rowVariants = Array.isArray(row.variants) ? (row.variants as PortfolioVariant[]) : [];
    const variants = rowVariants.map(v => {
      const old = prev.variants[v.name];
      if (old && v.description === old.description) {
        const fresh = seed.variants.find(s => s.name === old.newName);
        if (fresh) return { ...fresh, images: Array.isArray(v.images) && v.images.length > 0 ? renamedDeep(v.images) : fresh.images };
      }
      return renamedDeep(v);
    });
    let images = renamedDeep(Array.isArray(row.images) ? row.images : []) as PortfolioImage[];
    let features = Array.isArray(row.features) ? renamedDeep(row.features as string[]) : [];
    let tech = Array.isArray(row.tech) ? renamedDeep(row.tech as string[]) : [];
    if (slug === "qr-artisticos-3d") {
      // El proyecto conserva solo muestras artísticas; las escenas QR en 3D no forman parte de esta ficha.
      images = removeRetiredQrPortfolioImages(images);
      features = features.filter(f => !/^Escenas en 3D:|^Vídeo de la transformación/.test(f));
      tech = tech.filter(t => t !== "Three.js" && t !== "WebGL");
    }

    await db.execute(sql`
      UPDATE portfolio_projects SET title = ${next("title")}, client = ${next("client")}, category = ${next("category")}, summary = ${next("summary")},
        description = ${next("description")}, status = ${next("status")},
        features = ${JSON.stringify(features)}::jsonb, tech = ${JSON.stringify(tech)}::jsonb,
        images = ${JSON.stringify(images)}::jsonb, variants = ${JSON.stringify(variants)}::jsonb, updated_at = NOW()
      WHERE id = ${row.id as number}
    `);
  }
  await db.execute(sql`
    INSERT INTO portfolio_meta (key, value) VALUES ('patch_version', ${String(PATCH_VERSION)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  logger.info({ version: PATCH_VERSION }, "portfolio: correcciones aplicadas");
}

function cleanList(v: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(v) ? v.map(t => cleanText(t, maxLen)).filter(Boolean).slice(0, maxItems) : [];
}

/** Las versiones llegan del panel como JSON: se quedan solo los campos conocidos y las imágenes de la casa. */
function cleanVariants(v: unknown): PortfolioVariant[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 6).map((x: Record<string, unknown>) => ({
    name: cleanText(x?.name, 60), client: cleanText(x?.client, 120), status: cleanText(x?.status, 40),
    summary: cleanText(x?.summary, 300), description: cleanText(x?.description, 4000),
    features: cleanList(x?.features, 12, 140), tech: cleanList(x?.tech, 12, 40),
    images: (Array.isArray(x?.images) ? (x.images as PortfolioImage[]) : [])
      .filter(im => typeof im?.url === "string" && /^\/(portfolio|api\/media)\//.test(im.url)).slice(0, 12)
      .map(im => ({ url: im.url, alt: cleanText(im.alt, 160), ...(Number(im.w) > 0 && Number(im.h) > 0 ? { w: Number(im.w), h: Number(im.h) } : {}) })),
  })).filter(x => x.name);
}

function toProject(r: Record<string, unknown>): PortfolioProject {
  return {
    id: Number(r.id), slug: String(r.slug), title: String(r.title), client: (r.client as string | null) ?? null,
    category: String(r.category ?? ""), summary: String(r.summary ?? ""), description: String(r.description ?? ""),
    tech: Array.isArray(r.tech) ? (r.tech as string[]) : [], liveUrl: (r.live_url as string | null) ?? null,
    appUrl: (r.app_url as string | null) ?? null, images: Array.isArray(r.images) ? (r.images as PortfolioImage[]) : [],
    sortOrder: Number(r.sort_order ?? 0), published: Boolean(r.published),
    features: Array.isArray(r.features) ? (r.features as string[]) : [], status: String(r.status ?? ""),
    variants: Array.isArray(r.variants) ? (r.variants as PortfolioVariant[]) : [],
  };
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "proyecto";
}

function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try { const u = new URL(v.trim()); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; }
}

function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Proyecto público: sin datos internos del panel (resultado QR de cada imagen). */
function toPublicProject(r: Record<string, unknown>): PortfolioProject {
  const p = toProject(r);
  return { ...p, images: p.images.map(({ qrCheck: _qr, ...im }) => im) };
}

/**
 * Borra el proyecto y, de forma atómica, registra su slug (para que ninguna semilla lo recree) junto
 * con una copia completa de la fila, para poder restaurarlo desde el panel. Sus imágenes subidas se
 * conservan mientras exista la copia; «Borrar definitivamente» las elimina.
 */
export async function deletePortfolioProject(id: number): Promise<boolean> {
  const result = await db.execute(sql`
    WITH removed AS (
      DELETE FROM portfolio_projects WHERE id = ${id} RETURNING *
    ), recorded AS (
      INSERT INTO portfolio_deleted_projects (slug, project, deleted_at)
      SELECT r.slug, to_jsonb(r), NOW() FROM removed r
      ON CONFLICT (slug) DO UPDATE SET project = EXCLUDED.project, deleted_at = EXCLUDED.deleted_at
    )
    SELECT slug FROM removed
  `);
  return result.rows.length > 0;
}

export interface DeletedPortfolioEntry {
  slug: string; title: string; deletedAt: string | null;
  /** snapshot = copia guardada al borrar · seed = se recrea desde la semilla · null = no restaurable. */
  source: "snapshot" | "seed" | null;
  published: boolean | null; imageCount: number;
}

/** Proyectos borrados (registro) y proyectos de la semilla ausentes y sin registro (a confirmar por el dueño). */
export async function listDeletedPortfolio(): Promise<{ deleted: DeletedPortfolioEntry[]; unconfirmed: { slug: string; title: string }[] }> {
  const ledger = await db.execute(sql`SELECT slug, deleted_at, project FROM portfolio_deleted_projects ORDER BY deleted_at DESC`);
  const live = await db.execute(sql`SELECT slug FROM portfolio_projects`);
  const liveSlugs = new Set((live.rows as { slug: string }[]).map(r => r.slug));
  const deleted = (ledger.rows as { slug: string; deleted_at: unknown; project: Record<string, unknown> | null }[]).map(r => {
    const seed = SEED.find(p => p.slug === r.slug);
    const snap = r.project && typeof r.project === "object" ? toProject(r.project) : null;
    return {
      slug: r.slug,
      title: snap?.title ?? seed?.title ?? r.slug,
      deletedAt: r.deleted_at ? new Date(String(r.deleted_at)).toISOString() : null,
      source: liveSlugs.has(r.slug) ? null : snap ? "snapshot" as const : seed ? "seed" as const : null,
      published: snap ? snap.published : seed ? true : null,
      imageCount: snap ? snap.images.length : seed?.images.length ?? 0,
    };
  });
  const ledgerSlugs = new Set(deleted.map(d => d.slug));
  const unconfirmed = SEED.filter(p => !liveSlugs.has(p.slug) && !ledgerSlugs.has(p.slug)).map(p => ({ slug: p.slug, title: p.title }));
  return { deleted, unconfirmed };
}

/**
 * Restaura un proyecto borrado y quita su marca de borrado en la misma sentencia. Usa la copia
 * guardada al borrar (con su estado de publicación); si no la hay y es de la semilla, la recrea.
 * Devuelve null si no es restaurable o si ya existe otro proyecto con ese slug.
 */
export async function restorePortfolioProject(slug: string): Promise<PortfolioProject | null> {
  const cur = await db.execute(sql`SELECT project FROM portfolio_deleted_projects WHERE slug = ${slug}`);
  const entry = cur.rows[0] as { project: Record<string, unknown> | null } | undefined;
  if (!entry) return null;
  const snap = entry.project && typeof entry.project === "object" ? entry.project : null;
  const seed = SEED.find(p => p.slug === slug);
  if (!snap && !seed) return null;
  const p: PortfolioProject = snap ? toProject(snap) : {
    id: 0, slug, title: seed!.title, client: seed!.client, category: seed!.category, summary: seed!.summary,
    description: seed!.description, tech: seed!.tech, liveUrl: seed!.liveUrl, appUrl: seed!.appUrl, images: seed!.images,
    sortOrder: seed!.sortOrder, published: true, features: seed!.features, status: seed!.status, variants: seed!.variants,
  };
  const defaults = snap ? (snap.seed_defaults ?? null) : seedDefaultsOf(seed!);
  const r = await db.execute(sql`
    WITH restored AS (
      INSERT INTO portfolio_projects (slug, title, client, category, summary, description, tech, features, status, live_url, app_url, images, variants, sort_order, published, seed_defaults)
      SELECT ${slug}, ${p.title}, ${p.client}, ${p.category}, ${p.summary}, ${p.description}, ${JSON.stringify(p.tech)}::jsonb,
             ${JSON.stringify(p.features)}::jsonb, ${p.status}, ${p.liveUrl}, ${p.appUrl}, ${JSON.stringify(p.images)}::jsonb,
             ${JSON.stringify(p.variants)}::jsonb, ${p.sortOrder}, ${p.published}, ${defaults === null ? null : JSON.stringify(defaults)}::jsonb
      WHERE EXISTS (SELECT 1 FROM portfolio_deleted_projects WHERE slug = ${slug})
      ON CONFLICT (slug) DO NOTHING
      RETURNING *
    ), unmarked AS (
      DELETE FROM portfolio_deleted_projects WHERE slug IN (SELECT slug FROM restored)
    )
    SELECT * FROM restored
  `);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? toProject(row) : null;
}

/** Borra definitivamente la copia de un proyecto borrado y sus imágenes subidas. El slug sigue protegido. */
export async function purgeDeletedPortfolioProject(slug: string): Promise<PortfolioImage[] | null> {
  const r = await db.execute(sql`
    WITH old AS (SELECT project FROM portfolio_deleted_projects WHERE slug = ${slug} FOR UPDATE)
    UPDATE portfolio_deleted_projects d SET project = NULL FROM old WHERE d.slug = ${slug}
    RETURNING old.project
  `);
  const row = r.rows[0] as { project: Record<string, unknown> | null } | undefined;
  if (!row) return null;
  return row.project ? toProject(row.project).images : [];
}

// ── Público ───────────────────────────────────────────────────────────────────

router.get("/media/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const file = await getMedia(String(req.params.id));
    if (!file) { res.status(404).json({ error: "No encontrado" }); return; }
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.bytes);
  } catch (err) {
    logger.error({ err }, "GET /media");
    res.status(500).json({ error: "Error" });
  }
});

router.get("/portfolio", async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT * FROM portfolio_projects WHERE published = TRUE ORDER BY sort_order, id`);
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json((r.rows as Record<string, unknown>[]).map(toPublicProject));
  } catch (err) {
    logger.error({ err }, "GET /portfolio");
    res.status(500).json({ error: "No se pudo cargar el portfolio" });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

router.get("/admin/portfolio", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const r = await db.execute(sql`SELECT * FROM portfolio_projects ORDER BY sort_order, id`);
    res.json((r.rows as Record<string, unknown>[]).map(toProject));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/admin/portfolio", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const b = req.body ?? {};
    const title = cleanText(b.title, 120);
    if (!title) { res.status(400).json({ error: "El título es obligatorio" }); return; }
    const base = slugify(title);
    const taken = await db.execute(sql`SELECT slug FROM portfolio_projects WHERE slug LIKE ${base + "%"}`);
    const slugs = new Set((taken.rows as { slug: string }[]).map(r => r.slug));
    let slug = base; let i = 2;
    while (slugs.has(slug)) slug = `${base}-${i++}`;
    const r = await db.execute(sql`
      INSERT INTO portfolio_projects (slug, title, client, category, summary, description, tech, features, status, live_url, app_url, sort_order, published)
      VALUES (${slug}, ${title}, ${cleanText(b.client, 120) || null}, ${cleanText(b.category, 60) || "Proyecto"},
        ${cleanText(b.summary, 300)}, ${cleanText(b.description, 4000)},
        ${JSON.stringify(cleanList(b.tech, 12, 40))}::jsonb, ${JSON.stringify(cleanList(b.features, 12, 140))}::jsonb, ${cleanText(b.status, 40)},
        ${cleanUrl(b.liveUrl)}, ${cleanUrl(b.appUrl)},
        COALESCE((SELECT MAX(sort_order) + 1 FROM portfolio_projects), 0), ${b.published !== false})
      RETURNING *
    `);
    res.json(toProject(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.put("/admin/portfolio/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const cur = await db.execute(sql`SELECT * FROM portfolio_projects WHERE id = ${id}`);
    if (!cur.rows[0]) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    const p = toProject(cur.rows[0] as Record<string, unknown>);
    const images: PortfolioImage[] = Array.isArray(b.images)
      // Solo se permite reordenar/editar el texto alternativo de imágenes ya subidas.
      ? (b.images as PortfolioImage[]).filter(im => p.images.some(x => x.url === im?.url)).map(im => {
          const prev = p.images.find(x => x.url === im.url)!;      // el tamaño es el de la imagen guardada, no el que mande el navegador
          return {
            url: im.url, alt: cleanText(im.alt, 160), ...(prev.w && prev.h ? { w: prev.w, h: prev.h } : {}),
            ...(prev.qrCheck ? { qrCheck: prev.qrCheck } : {}),          // el resultado QR solo lo escribe la subida
          };
        })
      : p.images;
    const r = await db.execute(sql`
      UPDATE portfolio_projects SET
        title = ${"title" in b ? cleanText(b.title, 120) || p.title : p.title},
        client = ${"client" in b ? cleanText(b.client, 120) || null : p.client},
        category = ${"category" in b ? cleanText(b.category, 60) || p.category : p.category},
        summary = ${"summary" in b ? cleanText(b.summary, 300) : p.summary},
        description = ${"description" in b ? cleanText(b.description, 4000) : p.description},
        tech = ${JSON.stringify(Array.isArray(b.tech) ? cleanList(b.tech, 12, 40) : p.tech)}::jsonb,
        features = ${JSON.stringify(Array.isArray(b.features) ? cleanList(b.features, 12, 140) : p.features)}::jsonb,
        variants = ${JSON.stringify(Array.isArray(b.variants) ? cleanVariants(b.variants) : p.variants)}::jsonb,
        status = ${"status" in b ? cleanText(b.status, 40) : p.status},
        live_url = ${"liveUrl" in b ? cleanUrl(b.liveUrl) : p.liveUrl},
        app_url = ${"appUrl" in b ? cleanUrl(b.appUrl) : p.appUrl},
        images = ${JSON.stringify(images)}::jsonb,
        sort_order = ${Number.isInteger(b.sortOrder) ? b.sortOrder : p.sortOrder},
        published = ${typeof b.published === "boolean" ? b.published : p.published},
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `);
    res.json(toProject(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/admin/portfolio/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const removed = await deletePortfolioProject(Number(req.params.id));
    if (!removed) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/admin/portfolio/deleted", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    res.json(await listDeletedPortfolio());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

/** El dueño confirma que borró un proyecto de la semilla antes de que existiera el registro. */
router.post("/admin/portfolio/deleted", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const slug = cleanText(req.body?.slug, 60);
    const recorded = await backfillPreLedgerDeletions([slug]);
    if (!recorded.length) { res.status(400).json({ error: "Solo se puede marcar un proyecto de la semilla que no exista ahora" }); return; }
    res.json({ ok: true, slug });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/admin/portfolio/deleted/:slug/restore", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const slug = String(req.params.slug);
    const project = await restorePortfolioProject(slug);
    if (!project) {
      const taken = await db.execute(sql`SELECT id FROM portfolio_projects WHERE slug = ${slug}`);
      if (taken.rows[0]) { res.status(409).json({ error: "Ya existe un proyecto con ese identificador" }); return; }
      res.status(404).json({ error: "No hay copia restaurable de ese proyecto" });
      return;
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.delete("/admin/portfolio/deleted/:slug", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const images = await purgeDeletedPortfolioProject(String(req.params.slug));
    if (!images) { res.status(404).json({ error: "No está en la lista de borrados" }); return; }
    for (const im of images) { const mid = mediaIdFromUrl(im.url); if (mid) await deleteMedia(mid).catch(() => {}); }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/admin/portfolio/:id/images", requireAdmin, upload.array("files", 12), async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) { res.status(400).json({ error: "Sube al menos una imagen" }); return; }
    const existing = await db.execute(sql`SELECT id FROM portfolio_projects WHERE id = ${id}`);
    if (!existing.rows[0]) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const qrArtworkValue: unknown = req.body?.qrArtwork;
    if (qrArtworkValue !== undefined && qrArtworkValue !== "true" && qrArtworkValue !== "false") {
      res.status(400).json({ error: "El valor de verificación QR no es válido" });
      return;
    }
    const qrArtwork = qrArtworkValue === "true";
    const qrChecks: QrArtworkFileCheck[] = [];
    const preparedQrFiles = new Map<Express.Multer.File, { data: Buffer; width: number; height: number; checks?: QrArtworkSizeCheck[] }>();
    if (qrArtwork) {
      for (const file of files) {
        const filename = safeUploadName(file.originalname);
        if (!QR_UPLOAD_MIMES.has(file.mimetype)) {
          qrChecks.push({ filename, checks: [], passed: false, reason: "Usa una imagen PNG, JPG o WebP." });
          continue;
        }
        try {
          const metadata = await sharp(file.buffer).metadata();
          if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
            qrChecks.push({ filename, checks: [], passed: false, reason: "El contenido no es un PNG, JPG o WebP válido." });
            continue;
          }
          // Verifica exactamente el WebP optimizado que se guardará y se servirá en el portfolio.
          const optimized = await sharp(file.buffer).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
          const prepared = { data: optimized.data, width: optimized.info.width, height: optimized.info.height };
          preparedQrFiles.set(file, prepared);
          const checks = await checkQrArtworkAtDisplaySizes(prepared.data);
          preparedQrFiles.set(file, { ...prepared, checks });
          const passed = checks.length > 0 && checks.every(check => check.passed);
          qrChecks.push({
            filename,
            checks,
            passed,
            ...(passed ? {} : { reason: "El mismo QR debe poder leerse en todos los tamaños indicados." }),
          });
        } catch {
          qrChecks.push({ filename, checks: [], passed: false, reason: "No se pudo analizar la imagen." });
        }
      }
      if (qrChecks.some(check => !check.passed)) {
        res.status(422).json({
          error: "No se subió ninguna imagen: al menos un QR no supera la comprobación. Revisa los tamaños y vuelve a intentarlo.",
          qrChecks,
        });
        return;
      }
    }

    const added: PortfolioImage[] = [];
    for (const f of files) {
      if (!/^image\//.test(f.mimetype)) continue;
      // Se normaliza a WebP de hasta 2000 px: pesa poco y carga rápido en la landing.
      let out: { data: Buffer; width: number; height: number; checks?: QrArtworkSizeCheck[] } | undefined = preparedQrFiles.get(f);
      if (!out) {
        const optimized = await sharp(f.buffer).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
        out = { data: optimized.data, width: optimized.info.width, height: optimized.info.height };
      }
      const { url } = await saveMedia(out.data, "image/webp", { width: out.width, height: out.height, originalName: f.originalname });
      const qrCheck: PortfolioQrCheck | undefined = qrArtwork && out.checks ? {
        checks: out.checks, passed: true, checkedAt: new Date().toISOString(),
        sha256: createHash("sha256").update(out.data).digest("hex"),
      } : undefined;
      added.push({
        url, alt: safeUploadName(f.originalname).replace(/\.[^.]+$/, "").slice(0, 160), w: out.width, h: out.height,
        ...(qrCheck ? { qrCheck } : {}),
      });
    }
    if (!added.length) { res.status(400).json({ error: "Los archivos no son imágenes" }); return; }
    const r = await db.execute(sql`
      UPDATE portfolio_projects SET images = images || ${JSON.stringify(added)}::jsonb, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `);
    if (!r.rows[0]) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    const project = toProject(r.rows[0] as Record<string, unknown>);
    res.json(qrArtwork ? { project, qrChecks } : project);
  } catch (err) {
    logger.error({ err }, "portfolio upload");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error subiendo imágenes" });
  }
});

router.delete("/admin/portfolio/:id/images", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const url = String(req.body?.url ?? "");
    const cur = await db.execute(sql`SELECT * FROM portfolio_projects WHERE id = ${id}`);
    if (!cur.rows[0]) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    const p = toProject(cur.rows[0] as Record<string, unknown>);
    const images = p.images.filter(im => im.url !== url);
    const r = await db.execute(sql`UPDATE portfolio_projects SET images = ${JSON.stringify(images)}::jsonb, updated_at = NOW() WHERE id = ${id} RETURNING *`);
    const mid = mediaIdFromUrl(url);
    if (mid) await deleteMedia(mid).catch(() => {});
    res.json(toProject(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

export default router;
