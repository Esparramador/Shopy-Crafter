/**
 * Portfolio de proyectos realizados (landing) + servidor de medios.
 *   GET    /api/media/:id                       — imagen subida (pública, cacheable)
 *   GET    /api/portfolio                       — proyectos publicados (público)
 *   GET    /api/admin/portfolio                 — todos (admin)
 *   POST   /api/admin/portfolio                 — crear (admin)
 *   PUT    /api/admin/portfolio/:id             — editar (admin)
 *   DELETE /api/admin/portfolio/:id             — borrar (admin)
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

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 12 } });

export interface PortfolioImage { url: string; alt: string }
export interface PortfolioProject {
  id: number; slug: string; title: string; client: string | null; category: string;
  summary: string; description: string; tech: string[]; liveUrl: string | null; appUrl: string | null;
  images: PortfolioImage[]; sortOrder: number; published: boolean;
}

/**
 * Proyectos con los que arranca el portfolio. Los textos se limitan a lo que el
 * propio equipo describe (sin cifras ni resultados inventados); las imágenes se
 * suben desde el panel (Admin → Portfolio).
 */
const SEED: Array<Omit<PortfolioProject, "id" | "images" | "published">> = [
  { slug: "warriors-hardcore", title: "Warriors Hardcore", client: "Warriors Hardcore", category: "Web y app", summary: "Landing y aplicación propia de la marca.", description: "Diseño y desarrollo de la landing de la marca y de su aplicación.", tech: ["Landing", "App"], liveUrl: null, appUrl: null, sortOrder: 0 },
  { slug: "crafter-eventos", title: "Crafter Eventos", client: "Crafter Eventos", category: "Web y app", summary: "Web y sistema para la gestión de eventos.", description: "Proyecto completo para Crafter Eventos.", tech: ["Web"], liveUrl: null, appUrl: null, sortOrder: 1 },
  { slug: "brasas-y-paellas", title: "Sistema para brasas y paellas", client: null, category: "Sistema a medida", summary: "Asistente conversacional, registro de clientes y aplicación con CRM.", description: "Sistema completo para un negocio de brasas y paellas: asistente conversacional para atender a los clientes, registro y una aplicación con CRM para gestionarlos.", tech: ["Asistente IA", "CRM", "App"], liveUrl: null, appUrl: null, sortOrder: 2 },
  { slug: "rastalo-tpv", title: "Rastalo TPV", client: "Rastalo", category: "Sistema a medida", summary: "Sistema TPV (punto de venta).", description: "Terminal punto de venta desarrollado a medida.", tech: ["TPV"], liveUrl: null, appUrl: null, sortOrder: 3 },
  { slug: "agente-j-bond", title: "Agente J-Bond", client: null, category: "Plataforma IA", summary: "Plataforma con interfaz diseñada a medida.", description: "Plataforma del agente J-Bond con interfaz y flujos diseñados a medida.", tech: ["Agente IA", "Plataforma"], liveUrl: null, appUrl: null, sortOrder: 4 },
  { slug: "bots-trading", title: "Bots de trading", client: null, category: "Automatización", summary: "Bots de trading automatizado.", description: "Desarrollo de bots que ejecutan estrategias de trading de forma automática.", tech: ["Automatización", "Trading"], liveUrl: null, appUrl: null, sortOrder: 5 },
  { slug: "qr-artisticos-3d", title: "QR artísticos 3D", client: null, category: "Diseño", summary: "Códigos QR artísticos en 3D que siguen siendo escaneables.", description: "Diseño de códigos QR artísticos y en 3D para marcas.", tech: ["QR", "3D"], liveUrl: null, appUrl: null, sortOrder: 6 },
  { slug: "pequenos-genios", title: "Pequeños Genios", client: null, category: "App", summary: "35 minijuegos educativos para niños de 4 a 12 años.", description: "Juegos de matemáticas, lengua, ciencias, historia, tecnología y destreza con dificultad adaptada a la edad, progreso guardado en el dispositivo y modo sin cuenta. App Android con Capacitor.", tech: ["React", "Capacitor", "Android"], liveUrl: null, appUrl: null, sortOrder: 7 },
];

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
    const count = await db.execute(sql`SELECT COUNT(*)::int AS n FROM portfolio_projects`);
    if (Number((count.rows[0] as { n: number }).n) === 0) {
      for (const p of SEED) {
        await db.execute(sql`
          INSERT INTO portfolio_projects (slug, title, client, category, summary, description, tech, live_url, app_url, sort_order)
          VALUES (${p.slug}, ${p.title}, ${p.client}, ${p.category}, ${p.summary}, ${p.description}, ${JSON.stringify(p.tech)}::jsonb, ${p.liveUrl}, ${p.appUrl}, ${p.sortOrder})
          ON CONFLICT (slug) DO NOTHING
        `);
      }
    }
  })().catch(err => { ready = null; throw err; });
  return ready;
}

function toProject(r: Record<string, unknown>): PortfolioProject {
  return {
    id: Number(r.id), slug: String(r.slug), title: String(r.title), client: (r.client as string | null) ?? null,
    category: String(r.category ?? ""), summary: String(r.summary ?? ""), description: String(r.description ?? ""),
    tech: Array.isArray(r.tech) ? (r.tech as string[]) : [], liveUrl: (r.live_url as string | null) ?? null,
    appUrl: (r.app_url as string | null) ?? null, images: Array.isArray(r.images) ? (r.images as PortfolioImage[]) : [],
    sortOrder: Number(r.sort_order ?? 0), published: Boolean(r.published),
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
    res.json((r.rows as Record<string, unknown>[]).map(toProject));
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
      INSERT INTO portfolio_projects (slug, title, client, category, summary, description, tech, live_url, app_url, sort_order, published)
      VALUES (${slug}, ${title}, ${cleanText(b.client, 120) || null}, ${cleanText(b.category, 60) || "Proyecto"},
        ${cleanText(b.summary, 300)}, ${cleanText(b.description, 4000)},
        ${JSON.stringify(Array.isArray(b.tech) ? b.tech.map((t: unknown) => cleanText(t, 40)).filter(Boolean).slice(0, 12) : [])}::jsonb,
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
      ? (b.images as PortfolioImage[]).filter(im => p.images.some(x => x.url === im?.url)).map(im => ({ url: im.url, alt: cleanText(im.alt, 160) }))
      : p.images;
    const r = await db.execute(sql`
      UPDATE portfolio_projects SET
        title = ${"title" in b ? cleanText(b.title, 120) || p.title : p.title},
        client = ${"client" in b ? cleanText(b.client, 120) || null : p.client},
        category = ${"category" in b ? cleanText(b.category, 60) || p.category : p.category},
        summary = ${"summary" in b ? cleanText(b.summary, 300) : p.summary},
        description = ${"description" in b ? cleanText(b.description, 4000) : p.description},
        tech = ${JSON.stringify(Array.isArray(b.tech) ? b.tech.map((t: unknown) => cleanText(t, 40)).filter(Boolean).slice(0, 12) : p.tech)}::jsonb,
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
    const r = await db.execute(sql`DELETE FROM portfolio_projects WHERE id = ${Number(req.params.id)} RETURNING images`);
    const images = ((r.rows[0] as { images?: PortfolioImage[] } | undefined)?.images) ?? [];
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
    const added: PortfolioImage[] = [];
    for (const f of files) {
      if (!/^image\//.test(f.mimetype)) continue;
      // Se normaliza a WebP de hasta 2000 px: pesa poco y carga rápido en la landing.
      const out = await sharp(f.buffer).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
      const { url } = await saveMedia(out.data, "image/webp", { width: out.info.width, height: out.info.height, originalName: f.originalname });
      added.push({ url, alt: f.originalname.replace(/\.[^.]+$/, "").slice(0, 160) });
    }
    if (!added.length) { res.status(400).json({ error: "Los archivos no son imágenes" }); return; }
    const r = await db.execute(sql`
      UPDATE portfolio_projects SET images = images || ${JSON.stringify(added)}::jsonb, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `);
    if (!r.rows[0]) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    res.json(toProject(r.rows[0] as Record<string, unknown>));
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
