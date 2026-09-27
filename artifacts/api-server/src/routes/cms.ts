import { Router, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { cmsContent, cmsVersions, cmsPages } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { DEFAULT_CMS_CONTENT } from "../lib/cms-defaults.js";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude.js";
import { askClaudeJsonValidated } from "../lib/ai-json.js";
import { aiOutputErrorMessage, isAiOutputError } from "../lib/ai-errors.js";
import { lenientArray } from "../lib/ai-schema.js";
import { z } from "zod";
import { cached, invalidateCache } from "../lib/cache.js";
import { enableLongRunning } from "../lib/long-running.js";
import { writeSiteThemeToCss, SiteTheme } from "../lib/theme-css-writer.js";

const router = Router();

const MEDIA_DIR = path.join(process.cwd(), "../../artifacts/shopify-optimizer/public/media");
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const sseClients: Set<Response> = new Set();

function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); } catch { sseClients.delete(res); }
  });
}

function mergeNavArrays(defaults: any[], stored: any[], keyField: string): any[] {
  if (!Array.isArray(stored) || stored.length === 0) return Array.isArray(defaults) ? defaults : [];
  if (!Array.isArray(defaults)) return stored;
  const result = [...stored];
  const existingKeys = new Set(stored.map((item: any) => item[keyField]));
  for (const item of defaults) {
    if (!existingKeys.has(item[keyField])) {
      result.push(item);
    }
  }
  return result;
}

function deepMergeDefaults(defaults: Record<string, unknown>, stored: Record<string, unknown>): Record<string, unknown> {
  const result = { ...stored };
  for (const key of Object.keys(defaults)) {
    if (!(key in result) || result[key] == null) {
      result[key] = defaults[key];
    } else if (
      defaults[key] && typeof defaults[key] === "object" && !Array.isArray(defaults[key]) &&
      result[key] && typeof result[key] === "object" && !Array.isArray(result[key])
    ) {
      result[key] = deepMergeDefaults(defaults[key] as Record<string, unknown>, result[key] as Record<string, unknown>);
    }
  }
  return result;
}

/**
 * Auto-heal del footer: detecta la "forma legacy completa" (footer que aún
 * tiene MAYORÍA de hrefs rotos típicos de los defaults antiguos) y la
 * reemplaza por los defaults nuevos. Es CONSERVADOR: sólo dispara si la
 * proporción de hrefs rotos es alta, para no destruir personalizaciones
 * legítimas que casualmente usen alguno de esos hrefs.
 *
 * Idempotente: una vez sustituido, los hrefs nuevos no contienen los
 * patrones legacy y el heal no vuelve a dispararse.
 */
function healFooterColumns(merged: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  try {
    const footer = merged.footer as { columns?: Array<{ title?: string; links?: Array<{ label?: string; href?: string }> }> } | undefined;
    if (!footer?.columns || !Array.isArray(footer.columns)) return merged;

    const allLinks = footer.columns.flatMap(col => col.links ?? []);
    if (allLinks.length === 0) return merged;

    // Los defaults antiguos rotos eran exactamente estos hrefs:
    //   Producto: #features, #pricing, #, #, #
    //   Empresa:  # # # # #
    //   Legal:    # # # # #
    // Sólo reemplazamos si MÁS DE LA MITAD de los links siguen siendo
    // exactamente "#" o uno de los anclas legacy planos. Eso es muy
    // improbable en una personalización del usuario.
    const LEGACY_HREFS = new Set(["#", "#features", "#pricing"]);
    const brokenCount = allLinks.filter(l => LEGACY_HREFS.has((l.href || "").trim())).length;
    const ratio = brokenCount / allLinks.length;

    // Umbral conservador: > 50% de hrefs son legacy → casi seguro defaults antiguos.
    if (ratio > 0.5) {
      const defaultsFooter = defaults.footer as { columns?: unknown };
      if (defaultsFooter?.columns) {
        return {
          ...merged,
          footer: { ...footer, columns: defaultsFooter.columns },
        };
      }
    }

    // ── HEAL adicional: añadir columnas que existen en defaults pero NO en stored.
    // Esto cubre el caso "el cliente ya migró su footer pero nosotros añadimos
    // una nueva columna como 'Recursos' después" — sin pisar personalizaciones.
    // Sólo añade las columnas faltantes por title (case-insensitive); el resto
    // se conserva tal cual.
    const defaultsFooter = defaults.footer as { columns?: Array<{ title?: string; links?: unknown }> } | undefined;
    if (defaultsFooter?.columns && Array.isArray(defaultsFooter.columns)) {
      const storedTitles = new Set(footer.columns.map(c => (c.title || "").trim().toLowerCase()));
      const missing = defaultsFooter.columns.filter(c => {
        const t = (c.title || "").trim().toLowerCase();
        return t && !storedTitles.has(t);
      });
      if (missing.length > 0) {
        // Insertamos las nuevas en la misma posición relativa que tienen en defaults.
        const newColumns: typeof footer.columns = [];
        const storedByTitle = new Map(footer.columns.map(c => [(c.title || "").trim().toLowerCase(), c]));
        for (const defCol of defaultsFooter.columns) {
          const t = (defCol.title || "").trim().toLowerCase();
          const existing = storedByTitle.get(t);
          if (existing) newColumns.push(existing);
          else newColumns.push(defCol as { title?: string; links?: Array<{ label?: string; href?: string }> });
        }
        // Conservamos también cualquier columna 100% custom que el cliente
        // haya añadido (no viene del default) al final.
        const defaultTitlesLower = new Set(defaultsFooter.columns.map(c => (c.title || "").trim().toLowerCase()));
        for (const col of footer.columns) {
          const t = (col.title || "").trim().toLowerCase();
          if (t && !defaultTitlesLower.has(t)) newColumns.push(col);
        }
        return { ...merged, footer: { ...footer, columns: newColumns } };
      }
    }

    return merged;
  } catch {
    return merged;
  }
}

function applyRealisticPatch(content: Record<string, unknown>): { patched: Record<string, unknown>; changed: boolean } {
  let changed = false;
  const c = JSON.parse(JSON.stringify(content)) as Record<string, any>;

  // Parche 1: Eliminar métricas inventadas en stats ("↑340%", "+2.8K", "99.9% Uptime garantizado")
  const stats = c.stats as any[] | undefined;
  if (Array.isArray(stats) && stats.some((s: any) => s.num === "↑340%" || s.num === "+2.8K")) {
    c.stats = (DEFAULT_CMS_CONTENT as any).stats;
    changed = true;
  }

  // Parche 2: Eliminar testimonios inventados ("María González", "Miguel Rodríguez" con +128% inventado)
  const testimonialItems = (c.testimonials as any)?.items;
  if (Array.isArray(testimonialItems) && testimonialItems.some((t: any) =>
    t.author === "María González" || (t.author === "Miguel Rodríguez" && t.metric === "↑ +128% conversión en 3 semanas")
  )) {
    (c.testimonials as any).items = [];
    changed = true;
  }

  // Parche 3: Eliminar promesas falsas en hero.trustItems
  const trustItems = (c.hero as any)?.trustItems;
  if (Array.isArray(trustItems) && (trustItems.includes("Sin tarjeta de crédito") || trustItems.includes("Cancela cuando quieras"))) {
    (c.hero as any).trustItems = ["Setup en menos de 48h", "IA real con API Shopify", "RGPD compliant"];
    changed = true;
  }

  // Parche 4: Eliminar "Imágenes IA ilimitadas" de planes de precios
  const plans = (c.pricing as any)?.plans;
  if (Array.isArray(plans)) {
    for (const plan of plans) {
      if (Array.isArray(plan.features)) {
        for (const feat of plan.features) {
          if (feat.text === "Imágenes IA ilimitadas") {
            feat.text = "Imágenes IA (~€0.25 por imagen, coste real API)";
            changed = true;
          }
        }
      }
    }
  }

  // Parche 5: CTA sin promesas falsas
  const cta = c.cta as any | undefined;
  if (cta?.finePrint === "Sin tarjeta de crédito · Cancela cuando quieras") {
    cta.finePrint = "Sin spam. Solo te contactamos para hablar de tu proyecto.";
    changed = true;
  }
  if (typeof cta?.subheadline === "string" && cta.subheadline.includes("200 tiendas")) {
    cta.subheadline = "Cuéntanos tu caso y te preparamos una propuesta personalizada sin compromiso.";
    changed = true;
  }

  return { patched: c, changed };
}

async function getOrInitContent() {
  const rows = await db.select().from(cmsContent).limit(1);
  if (rows.length > 0) {
    const merged = deepMergeDefaults(DEFAULT_CMS_CONTENT as Record<string, unknown>, rows[0].content as Record<string, unknown>);
    const healed = healFooterColumns(merged, DEFAULT_CMS_CONTENT as Record<string, unknown>);

    // Aplicar parche de contenido realista (elimina métricas inventadas y promesas falsas)
    const { patched, changed: patchChanged } = applyRealisticPatch(healed as Record<string, unknown>);
    const final = patchChanged ? patched : healed;

    // Si hubo healing o patch, persistimos para que los próximos reads no necesiten reparar otra vez.
    if (healed !== merged || patchChanged) {
      try {
        const newVersion = rows[0].version + 1;
        await db.update(cmsContent)
          .set({ content: final, version: newVersion, updatedAt: new Date() })
          .where(eq(cmsContent.id, rows[0].id));
        try { invalidateCache("cms-"); broadcast("content_updated", { path: "_auto_patch", value: null, version: newVersion, source: "realistic-patch" }); } catch {}
      } catch {}
      return { ...rows[0], content: final };
    }
    return { ...rows[0], content: merged };
  }
  const [row] = await db.insert(cmsContent).values({ content: DEFAULT_CMS_CONTENT, version: 1 }).returning();
  return row;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
  if (keys.some(k => BLOCKED.has(k))) throw new Error("Invalid path");
  const result = JSON.parse(JSON.stringify(obj));
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (BLOCKED.has(k)) throw new Error("Invalid path");
    if (!(k in current) || typeof current[k] !== "object") current[k] = {};
    current = current[k] as Record<string, unknown>; // nosemgrep: prototype-pollution-loop
  }
  const lastKey = keys[keys.length - 1];
  if (BLOCKED.has(lastKey)) throw new Error("Invalid path");
  current[lastKey] = value;
  return result;
}

async function saveVersion(content: unknown, version: number, savedBy: string) {
  await db.insert(cmsVersions).values({ content: content as Record<string, unknown>, version, savedBy, label: `v${version}` });
  const old = await db.select({ id: cmsVersions.id }).from(cmsVersions).orderBy(desc(cmsVersions.savedAt));
  if (old.length > 30) {
    const toDelete = old.slice(30);
    for (const v of toDelete) {
      await db.delete(cmsVersions).where(eq(cmsVersions.id, v.id));
    }
  }
}

router.get("/content", async (_req: Request, res: Response) => {
  try {
    const row = await cached("cms-content", 60_000, () => getOrInitContent());
    res.json(row.content);
  } catch (e) {
    res.status(500).json({ error: "Failed to load content" });
  }
});

function extractSiteTheme(content: Record<string, unknown>): SiteTheme {
  const site = (content.site || {}) as Record<string, unknown>;
  return {
    primaryColor: site.primaryColor as string | undefined,
    accentColor: site.accentColor as string | undefined,
    font_heading: site.font_heading as string | undefined,
    font_body: site.font_body as string | undefined,
  };
}

router.patch("/content", async (req: Request, res: Response) => {
  try {
    invalidateCache("cms-");
    const { path: fieldPath, value } = req.body as { path: string; value: unknown };
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, req.session?.userId?.toString() || "admin");
    const newContent = setNestedValue(row.content as Record<string, unknown>, fieldPath, value);
    const newVersion = row.version + 1;
    await db.update(cmsContent).set({ content: newContent, version: newVersion, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    broadcast("content_updated", { path: fieldPath, value, version: newVersion });
    if (fieldPath.startsWith("site.")) {
      writeSiteThemeToCss(extractSiteTheme(newContent));
    }
    res.json({ success: true, version: newVersion });
  } catch (e) {
    res.status(500).json({ error: "Failed to update content" });
  }
});

router.post("/content/batch", async (req: Request, res: Response) => {
  try {
    invalidateCache("cms-");
    const { changes } = req.body as { changes: Array<{ path: string; value: unknown }> };
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, req.session?.userId?.toString() || "admin");
    let newContent = row.content as Record<string, unknown>;
    for (const change of changes) {
      newContent = setNestedValue(newContent, change.path, change.value);
    }
    const newVersion = row.version + 1;
    await db.update(cmsContent).set({ content: newContent, version: newVersion, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    broadcast("content_updated", { batch: true, version: newVersion });
    if (changes.some(c => c.path.startsWith("site."))) {
      writeSiteThemeToCss(extractSiteTheme(newContent));
    }
    res.json({ success: true, version: newVersion });
  } catch (e) {
    res.status(500).json({ error: "Failed to batch update" });
  }
});

router.post("/content/reset", async (_req: Request, res: Response) => {
  try {
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, "admin");
    await db.update(cmsContent).set({ content: DEFAULT_CMS_CONTENT, version: row.version + 1, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    invalidateCache("cms-");
    broadcast("content_updated", { reset: true });
    writeSiteThemeToCss(extractSiteTheme(DEFAULT_CMS_CONTENT as Record<string, unknown>));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to reset" });
  }
});

router.post("/media/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(MEDIA_DIR, filename);
    await sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 85 }).toFile(filepath);
    const meta = await sharp(filepath).metadata();
    broadcast("media_uploaded", { filename });
    res.json({ url: `/media/${filename}`, width: meta.width, height: meta.height });
  } catch (e) {
    res.status(500).json({ error: "Upload failed" });
  }
});

const videoUpload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.post("/media/upload-video", videoUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = [".mp4", ".webm", ".mov"];
    if (!allowed.includes(ext)) { res.status(400).json({ error: "Formato no soportado. Usa MP4, WebM o MOV." }); return; }
    const filename = `${uuidv4()}${ext === ".mov" ? ".mp4" : ext}`;
    const filepath = path.join(MEDIA_DIR, filename);
    fs.writeFileSync(filepath, req.file.buffer);
    broadcast("media_uploaded", { filename, type: "video" });
    res.json({ url: `/media/${filename}`, size: req.file.size, originalName: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: "Video upload failed" });
  }
});

router.delete("/media/:filename", async (req: Request, res: Response) => {
  try {
    const rawName = String(req.params.filename);
    const filename = path.basename(rawName);
    if (filename !== rawName || filename.includes("..")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const filepath = path.resolve(MEDIA_DIR, filename); // nosemgrep: path-join-resolve-traversal, express-path-join-resolve-traversal
    if (!filepath.startsWith(path.resolve(MEDIA_DIR))) {
      res.status(400).json({ error: "Path traversal detected" });
      return;
    }
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath); // nosemgrep: detect-non-literal-fs-filename
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed" });
  }
});

router.get("/versions", async (_req: Request, res: Response) => {
  try {
    const versions = await db.select({ id: cmsVersions.id, version: cmsVersions.version, savedAt: cmsVersions.savedAt, savedBy: cmsVersions.savedBy, label: cmsVersions.label }).from(cmsVersions).orderBy(desc(cmsVersions.savedAt)).limit(30);
    res.json(versions);
  } catch (e) {
    res.status(500).json({ error: "Failed to load versions" });
  }
});

router.post("/versions/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const [ver] = await db.select().from(cmsVersions).where(eq(cmsVersions.id, id));
    if (!ver) { res.status(404).json({ error: "Version not found" }); return; }
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, "admin");
    await db.update(cmsContent).set({ content: ver.content as Record<string, unknown>, version: row.version + 1, updatedAt: new Date() }).where(eq(cmsContent.id, row.id));
    invalidateCache("cms-");
    broadcast("version_restored", { id, version: ver.version });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Restore failed" });
  }
});

router.post("/ai/improve", async (req: Request, res: Response) => {
  enableLongRunning(res);
  
  try {
    const { text, instruction, context } = req.body as { text: string; instruction: string; context?: string };
    const systemPrompt = `Eres un copywriter experto para plataformas SaaS de marketing digital en español. Recibes un texto y una instrucción, y devuelves el texto mejorado. Contexto de la marca: Shopy Crafter — plataforma independiente de optimización IA para tiendas eCommerce, con OmniCore Brain (IA acumulativa). Shopy Crafter es una marca propia e independiente. Tono: profesional, persuasivo, premium, moderno. IMPORTANTE: devuelve SOLO el texto mejorado, sin explicaciones, sin comillas extra.`;
    const userPrompt = `Texto original: "${text}"\n\nInstrucción: ${instruction}\n${context ? `\nContexto adicional: ${context}` : ""}\n\nDevuelve solo el texto mejorado:`;
    const improved = await askClaudeWithBrain(0, [{ role: "user", content: userPrompt }], systemPrompt, "general", undefined, 1024);

    learnFromOperation({
      operationType: "cms_copy_improvement",
      title: `CMS copy mejorado: ${instruction.slice(0, 80)}`,
      content: `Original: ${text.slice(0, 500)}\nMejorado: ${improved.slice(0, 500)}`,
      tags: ["cms", "copywriting", "improvement"],
    });

    res.json({ improved: improved.trim() });
  } catch (e) {
    res.status(500).json({ error: "AI improvement failed" });
  }
});

router.post("/ai/generate-section", async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    const { description, name } = req.body as { description: string; name?: string };
    if (!description || description.length < 5) {
      res.status(400).json({ error: "Descripción requerida" });
      return;
    }
    const sectionId = `custom_${Date.now()}`;
    const systemPrompt = `Eres un experto en UX y diseño web para plataformas SaaS en español. Generas configuraciones de secciones web en JSON. Responde ÚNICAMENTE con JSON válido y nada más.`;
    const userPrompt = `Crea la configuración completa de una sección web para una landing page SaaS.

Descripción del usuario: "${description}"
Nombre sugerido: "${name || "Sección personalizada"}"
ID único que debes usar: "${sectionId}"

Responde SOLO con este JSON (sin markdown, sin explicaciones):
{
  "id": "${sectionId}",
  "icon": "<emoji relevante al tipo de sección>",
  "label": "<nombre de la sección, máximo 25 caracteres>",
  "fields": [
    {"label": "<etiqueta visible en español>", "path": "${sectionId}.<clave_snake_case>", "type": "<text|textarea|color|boolean|image|url>", "placeholder": "<ejemplo realista en español>"}
  ],
  "defaultContent": {
    "<clave_snake_case>": "<valor por defecto en español realista>"
  }
}

Reglas:
- Incluye entre 5 y 12 campos relevantes
- Tipos disponibles: text (línea corta), textarea (párrafo largo), color (#hex), boolean (true/false), image (url imagen), url (enlace)
- Los valores por defecto deben ser contenido real y profesional para una agencia de marketing digital
- El icon debe ser un emoji apropiado para el tipo de sección`;

    // Campos validados: tipo permitido y path DENTRO de la sección nueva (antes un
    // path de la IA podía apuntar a cualquier otra sección del CMS).
    const sectionSchema = z.object({
      icon: z.string().default("🧩"),
      label: z.string().min(1).transform(s => s.slice(0, 25)),
      fields: lenientArray(z.object({
        label: z.string().min(1),
        path: z.string().regex(new RegExp(`^${sectionId}\\.[a-z0-9_]+$`)),
        type: z.enum(["text", "textarea", "color", "boolean", "image", "url"]),
        placeholder: z.string().default(""),
      })).refine(f => f.length > 0, { message: "sin campos válidos" }),
      defaultContent: z.record(z.string(), z.unknown()).catch({}),
    });
    const parsed = await askClaudeJsonValidated(0, userPrompt, systemPrompt, {
      schema: sectionSchema,
      useCase: "general",
      maxTokens: 2048,
      label: "cms/ai/generate-section",
    });
    const config = { id: sectionId, ...parsed };

    learnFromOperation({
      operationType: "cms_section_generated",
      title: `Nueva sección CMS: ${String(config.label || "custom")}`,
      content: `Descripción: ${description}. Campos: ${config.fields.length}`,
      tags: ["cms", "section", "ai-generated"],
    });

    res.json({ section: config });
  } catch (e) {
    if (isAiOutputError(e)) { res.status(502).json({ error: aiOutputErrorMessage(e), code: e.code }); return; }
    const msg = e instanceof Error ? e.message : "unknown";
    res.status(500).json({ error: `Section generation failed: ${msg}` });
  }
});

// ─── PÁGINAS EXTERNAS ────────────────────────────────────────────────────────
//
// Sistema de páginas independientes (descongesta la landing).
// Cada página vive en /p/:slug y se compone de bloques.
// GET /pages y GET /pages/:slug son PÚBLICOS (filtran por status=published).
// El resto requiere admin.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

type Block = { id: string; type: string; data: Record<string, unknown> };

function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(["hero", "text", "image", "video", "cards", "cta", "html", "spacer", "embed"]);
  return input
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b, i) => ({
      id: typeof b.id === "string" ? b.id : `b${i}_${Date.now()}`,
      type: typeof b.type === "string" && allowed.has(b.type) ? b.type : "text",
      data: (b.data && typeof b.data === "object") ? (b.data as Record<string, unknown>) : {},
    }));
}

function isAdminRequest(req: Request): boolean {
  return !!(req.session?.userId && (req.session as { role?: string }).role === "admin");
}

// Lista pública de páginas publicadas (para construir nav). Admin ve todas.
router.get("/pages", async (req: Request, res: Response) => {
  try {
    const adminMode = isAdminRequest(req);
    const rows = adminMode
      ? await db.select().from(cmsPages).orderBy(desc(cmsPages.updatedAt))
      : await db.select({
          id: cmsPages.id,
          slug: cmsPages.slug,
          title: cmsPages.title,
          metaDescription: cmsPages.metaDescription,
          status: cmsPages.status,
          navOrder: cmsPages.navOrder,
          updatedAt: cmsPages.updatedAt,
        }).from(cmsPages).where(eq(cmsPages.status, "published")).orderBy(cmsPages.navOrder);
    res.json({ pages: rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to load pages" });
  }
});

router.get("/pages/:slug", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug).toLowerCase();
    if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Slug inválido" }); return; }
    const [page] = await db.select().from(cmsPages).where(eq(cmsPages.slug, slug));
    if (!page) { res.status(404).json({ error: "Página no encontrada" }); return; }
    // Solo admin puede ver borradores
    if (page.status !== "published" && !isAdminRequest(req)) {
      res.status(404).json({ error: "Página no encontrada" });
      return;
    }
    res.json(page);
  } catch (e) {
    res.status(500).json({ error: "Failed to load page" });
  }
});

router.post("/pages", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<{ slug: string; title: string; status: string; metaTitle: string; metaDescription: string; ogImage: string; blocks: unknown; showHeader: boolean; showFooter: boolean; themeOverrides: unknown; navOrder: number }>;
    const slug = String(body.slug || "").trim().toLowerCase();
    const title = String(body.title || "").trim();
    if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "Slug inválido (sólo a-z, 0-9, -)" }); return; }
    if (!title) { res.status(400).json({ error: "Falta título" }); return; }
    // Comprobar duplicado
    const existing = await db.select().from(cmsPages).where(eq(cmsPages.slug, slug));
    if (existing.length > 0) { res.status(409).json({ error: "Ya existe una página con ese slug" }); return; }
    const blocks = sanitizeBlocks(body.blocks);
    const userId = req.session?.userId?.toString() || "admin";
    const [created] = await db.insert(cmsPages).values({
      slug,
      title,
      status: body.status === "published" ? "published" : "draft",
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
      ogImage: body.ogImage || null,
      blocks,
      showHeader: body.showHeader !== false,
      showFooter: body.showFooter !== false,
      themeOverrides: (body.themeOverrides && typeof body.themeOverrides === "object") ? body.themeOverrides as Record<string, unknown> : null,
      navOrder: typeof body.navOrder === "number" ? body.navOrder : 0,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    invalidateCache("cms-pages");
    broadcast("page_created", { id: created.id, slug: created.slug });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: "Failed to create page" });
  }
});

router.patch("/pages/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "id inválido" }); return; }
    const [existing] = await db.select().from(cmsPages).where(eq(cmsPages.id, id));
    if (!existing) { res.status(404).json({ error: "Página no encontrada" }); return; }
    const body = req.body as Partial<{ slug: string; title: string; status: string; metaTitle: string; metaDescription: string; ogImage: string; blocks: unknown; showHeader: boolean; showFooter: boolean; themeOverrides: unknown; navOrder: number }>;
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: req.session?.userId?.toString() || "admin",
    };
    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.status === "string") updates.status = body.status === "published" ? "published" : "draft";
    if ("metaTitle" in body) updates.metaTitle = body.metaTitle || null;
    if ("metaDescription" in body) updates.metaDescription = body.metaDescription || null;
    if ("ogImage" in body) updates.ogImage = body.ogImage || null;
    if ("blocks" in body) updates.blocks = sanitizeBlocks(body.blocks);
    if (typeof body.showHeader === "boolean") updates.showHeader = body.showHeader;
    if (typeof body.showFooter === "boolean") updates.showFooter = body.showFooter;
    if ("themeOverrides" in body) updates.themeOverrides = (body.themeOverrides && typeof body.themeOverrides === "object") ? body.themeOverrides : null;
    if (typeof body.navOrder === "number") updates.navOrder = body.navOrder;
    if (typeof body.slug === "string") {
      const newSlug = body.slug.trim().toLowerCase();
      if (!SLUG_RE.test(newSlug)) { res.status(400).json({ error: "Slug inválido" }); return; }
      if (newSlug !== existing.slug) {
        const dup = await db.select().from(cmsPages).where(and(eq(cmsPages.slug, newSlug)));
        if (dup.length > 0) { res.status(409).json({ error: "Ya existe una página con ese slug" }); return; }
        updates.slug = newSlug;
      }
    }
    const [updated] = await db.update(cmsPages).set(updates).where(eq(cmsPages.id, id)).returning();
    invalidateCache("cms-pages");
    broadcast("page_updated", { id: updated.id, slug: updated.slug });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Failed to update page" });
  }
});

router.delete("/pages/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "id inválido" }); return; }
    const [existing] = await db.select().from(cmsPages).where(eq(cmsPages.id, id));
    if (!existing) { res.status(404).json({ error: "Página no encontrada" }); return; }
    await db.delete(cmsPages).where(eq(cmsPages.id, id));
    invalidateCache("cms-pages");
    broadcast("page_deleted", { id, slug: existing.slug });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete page" });
  }
});

router.get("/events", (req: Request, res: Response) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write("event: connected\ndata: {}\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
