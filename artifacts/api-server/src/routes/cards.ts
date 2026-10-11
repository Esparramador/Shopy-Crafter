/**
 * Cards routes — Card Studio (tarjetas de presentación profesionales).
 *
 * Endpoints (admin):
 *   GET    /cards/templates                                → catálogo de plantillas
 *   POST   /cards/auto-design                              → Claude propone template+paleta+fonts
 *   GET    /projects/:projectId/cards                      → lista
 *   POST   /projects/:projectId/cards                      → crear (config, no genera)
 *   GET    /cards/:id                                      → detalle
 *   PATCH  /cards/:id                                      → actualizar config
 *   DELETE /cards/:id                                      → borrar
 *   POST   /cards/:id/generate                             → ejecuta pipeline 5 capas
 *   POST   /cards/:id/upload-logo                          → multipart logo
 *   GET    /cards/:id/preview?side=front|back              → preview rápido (regenera fallback)
 *   GET    /cards/:id/export?format=png|pdf|svg&side=...   → descarga
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db, businessCardsTable, projectsTable, projectFilesTable } from "@workspace/db";
import { eq, and, ne, desc, inArray, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import {
  generateBusinessCard,
  generatePrintablePdf,
  generateCardBackground,
  autoDesignCard,
  type GenerateCardInput,
} from "../lib/card-studio.js";
import { listTemplates, getTemplate } from "../lib/card-templates.js";
import { buildVCard } from "../lib/card-qr.js";
import { renderVerifiedQr, sanitizeQrStyle, decodeQrImage, type QrStyle } from "../lib/card-qr-art.js";
import { qrLabelFor, type ExtraElement, type LayoutOverrides } from "../lib/card-elements.js";
import sharp from "sharp";
import { enableLongRunning } from "../lib/long-running.js";
import { learnFromOperation } from "../lib/claude.js";
import { uploadRejected } from "../lib/upload-errors.js";

/** Añade qr_type y qr_content_url si no existen (idempotente). */
async function ensureCardQrColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE business_cards
        ADD COLUMN IF NOT EXISTS qr_type        text NOT NULL DEFAULT 'vcard',
        ADD COLUMN IF NOT EXISTS qr_content_url text;
    `);
    logger.info("card-qr columns ensured");
  } catch (err: any) {
    logger.warn({ err: err?.message }, "ensureCardQrColumns: non-fatal");
  }
}
ensureCardQrColumns();

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // SVG bloqueado en uploads de logo: el SVG se renderiza luego en Puppeteer
    // dentro de <img src="data:image/svg+xml;base64,..."> y un SVG malicioso podría
    // forzar fetches a recursos externos/internos (SSRF) durante el render.
    // Solo aceptamos formatos rasterizados.
    if (/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(uploadRejected(`Tipo no permitido: ${file.mimetype}. Solo PNG, JPG o WEBP.`) as any, false);
  },
});

function s(v: unknown, max = 500): string | undefined {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function safeJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || !v.trim()) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

type CardRow = typeof businessCardsTable.$inferSelect;

/** URL pública del QR dinámico (vídeo / imagen / animación). */
function publicQrUrl(req: Request, id: number): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.get("host") || "localhost:8080";
  return `${proto}://${host}/api/public/qr/${id}`;
}

/** Destino del QR del reverso según su tipo; undefined = vCard con los datos de la tarjeta. */
function cardQrTarget(row: CardRow, req: Request): string | undefined {
  const qrType: string = row.qrType || "vcard";
  const qrContentUrl: string | null = row.qrContentUrl || null;
  if (qrType === "url" && qrContentUrl) return qrContentUrl;
  if (qrType === "vcard") return undefined;
  if (["video", "image", "animation"].includes(qrType)) return publicQrUrl(req, row.id);
  return row.qrUrl ?? undefined;
}

function cardQrData(row: CardRow, req: Request): string {
  return cardQrTarget(row, req) ?? buildVCard({
    fullName: row.fullName,
    jobTitle: row.jobTitle ?? undefined,
    organization: row.companyName ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
  });
}

/** Estilo base del QR: colores y margen de la plantilla. */
function qrStyleBase(templateId: string): Partial<QrStyle> {
  const tpl = getTemplate(templateId);
  const fg = tpl?.qrStyle.fgColor || "#000000";
  return { fg, fg2: fg, bg: tpl?.qrStyle.bgColor || "#ffffff", margin: tpl?.qrStyle.margin ?? 1 };
}

/** Logo de la tarjeta como data URI (solo si pertenece al mismo proyecto). */
async function cardLogoDataUri(row: CardRow): Promise<string | undefined> {
  if (!row.logoVaultFileId) return undefined;
  const [lf] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, row.logoVaultFileId));
  if (!lf?.content || lf.projectId !== row.projectId) return undefined;
  const mime = /^image\/(png|jpeg|webp|svg\+xml)$/i.test(lf.mimeType || "") ? lf.mimeType : "image/png";
  return `data:${mime};base64,${lf.content}`;
}

function setQrHeaders(res: Response, r: { verified: boolean; warnings: string[]; style: QrStyle }) {
  res.setHeader("X-Qr-Verified", r.verified ? "1" : "0");
  res.setHeader("X-Qr-Warnings", encodeURIComponent(JSON.stringify(r.warnings)));
  res.setHeader("X-Qr-Style", encodeURIComponent(JSON.stringify(r.style)));
  res.setHeader("Cache-Control", "no-store");
}

/** Estilo pedido en ?style=<json>; null si viene mal formado. */
function styleFromQuery(v: unknown): unknown | null {
  if (typeof v !== "string" || !v) return undefined;
  if (v.length > 2000) return null;
  try { return JSON.parse(v); } catch { return null; }
}

const MAX_QR_DATA = 1800;
const QR_TYPES = new Set(["vcard", "url", "video", "image", "animation"]);
function isHttpUrl(v: string): boolean {
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

const EXTRA_TYPES = new Set(["text", "line", "emoji", "shape", "bubble", "qr", "qr-image"]);
const NUM_FIELDS = ["x", "y", "width", "height", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "rotate", "opacity", "strokeWidth"] as const;
const STR_FIELDS = ["text", "fontFamily", "color", "align", "textTransform", "shapeType", "fill", "stroke", "qrUrl", "qrFg", "qrBg", "decodedText"] as const;

/** Copia solo campos conocidos: números finitos y textos acotados. */
function cleanFields(src: Record<string, unknown>, out: Record<string, unknown>) {
  for (const k of NUM_FIELDS) {
    if (src[k] === undefined || src[k] === null) continue;
    const n = Number(src[k]);
    if (Number.isFinite(n)) out[k] = Math.max(-5000, Math.min(5000, n));
  }
  for (const k of STR_FIELDS) {
    if (typeof src[k] === "string") out[k] = (src[k] as string).slice(0, k === "text" ? 600 : k === "qrUrl" ? MAX_QR_DATA : 200);
  }
  if (typeof src.hidden === "boolean") out.hidden = src.hidden;
  if (typeof src.italic === "boolean") out.italic = src.italic;
  if (src.plate === null || (src.plate && typeof src.plate === "object")) out.plate = src.plate;
}

/**
 * Normaliza el diseño del editor antes de guardarlo: tipos y números válidos,
 * textos acotados, estilo de QR saneado y QR subidos solo del propio proyecto
 * (con su URL de vista previa canónica).
 */
async function normalizeOverrides(raw: any, projectId: number): Promise<LayoutOverrides> {
  const out: LayoutOverrides = {};
  for (const side of ["front", "back"] as const) {
    const src = raw?.[side];
    if (!src || typeof src !== "object") continue;
    const sideOut: Record<string, any> = {};
    for (const [id, ov] of Object.entries(src).slice(0, 80)) {
      if (!/^[\w-]{1,40}$/.test(id) || !ov || typeof ov !== "object") continue;
      const o: Record<string, unknown> = {};
      cleanFields(ov as Record<string, unknown>, o);
      sideOut[id] = o;
    }
    out[side] = sideOut;
  }
  const extras: ExtraElement[] = [];
  const list = Array.isArray(raw?.extras) ? raw.extras.slice(0, 120) : [];
  const vaultIds = list.filter((e: any) => e?.type === "qr-image" && Number.isInteger(e?.vaultFileId)).map((e: any) => e.vaultFileId as number);
  const owned = new Set<number>();
  if (vaultIds.length) {
    const rows = await db.select({ id: projectFilesTable.id, projectId: projectFilesTable.projectId })
      .from(projectFilesTable).where(inArray(projectFilesTable.id, vaultIds));
    for (const r of rows) if (r.projectId === projectId) owned.add(r.id);
  }
  for (const e of list) {
    if (!e || typeof e !== "object" || !EXTRA_TYPES.has(e.type)) continue;
    if (typeof e.id !== "string" || !/^[\w-]{1,40}$/.test(e.id)) continue;
    const x: Record<string, unknown> = { id: e.id, side: e.side === "back" ? "back" : "front", type: e.type };
    cleanFields(e, x);
    if (x.x === undefined || x.y === undefined || x.width === undefined) continue;
    if (e.type === "qr" && e.qrStyle && typeof e.qrStyle === "object") x.qrStyle = sanitizeQrStyle(e.qrStyle);
    if (e.type === "qr-image") {
      if (!owned.has(e.vaultFileId)) continue;
      x.vaultFileId = e.vaultFileId;
      x.imageUrl = `/api/projects/${projectId}/vault/${e.vaultFileId}/preview`;
    }
    extras.push(x as unknown as ExtraElement);
  }
  out.extras = extras;
  return out;
} // por encima el QR (corrección H) es ilegible en tarjeta o no cabe

/**
 * Imágenes de los extras QR para el render del servidor: QR generados (con su
 * estilo, verificados) y QR subidos (solo del mismo proyecto).
 */
async function resolveExtraAssets(row: CardRow, extras: ExtraElement[] | undefined, logoDataUri?: string): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  for (const ex of (extras ?? []).slice(0, 60)) {
    try {
      if (ex.type === "qr") {
        const data = String(ex.qrUrl || "").trim() || "https://shopycrafter.com";
        if (data.length > MAX_QR_DATA) continue;
        const fg = /^#[0-9a-f]{6}$/i.test(ex.qrFg || "") ? ex.qrFg! : "#000000";
        const bg = /^#[0-9a-f]{6}$/i.test(ex.qrBg || "") ? ex.qrBg! : "#ffffff";
        const r = await renderVerifiedQr(data, sanitizeQrStyle(ex.qrStyle, { fg, fg2: fg, bg, margin: 1 }), { size: 800, logoDataUri });
        assets[`extra-${ex.id}`] = `data:image/png;base64,${r.png.toString("base64")}`;
      } else if (ex.type === "qr-image" && Number.isInteger(ex.vaultFileId)) {
        const [f] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, ex.vaultFileId!));
        if (f?.content && f.projectId === row.projectId && /^image\/(png|jpeg|webp)$/i.test(f.mimeType || "")) {
          assets[`extra-${ex.id}`] = `data:${f.mimeType};base64,${f.content}`;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, cardId: row.id, extra: ex.id }, "cards: extra QR no resuelto");
    }
  }
  return assets;
}

/** Fondos propios de cada cara guardados desde el editor (solo ficheros del mismo proyecto). */
async function loadSideBackgrounds(row: CardRow): Promise<{ front?: Buffer; back?: Buffer }> {
  const meta = safeJson(row.metadata, {}) as Record<string, any>;
  const out: { front?: Buffer; back?: Buffer } = {};
  for (const [side, key] of [["front", "bgFrontVaultFileId"], ["back", "bgBackVaultFileId"]] as const) {
    const fid = Number(meta[key]);
    if (!Number.isInteger(fid) || fid <= 0) continue;
    const [f] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, fid));
    if (f?.content && f.projectId === row.projectId) out[side] = Buffer.from(f.content, "base64");
  }
  return out;
}

function toCardDto(row: any) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    templateId: row.templateId,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    companyName: row.companyName,
    tagline: row.tagline,
    email: row.email,
    phone: row.phone,
    website: row.website,
    socialHandle: row.socialHandle,
    address: row.address,
    qrUrl: row.qrUrl,
    qrType: row.qrType || "vcard",
    qrContentUrl: row.qrContentUrl || null,
    palette: safeJson(row.palette, {}),
    fonts: safeJson(row.fonts, {}),
    layout: row.layout,
    backgroundConfig: safeJson(row.backgroundConfig, {}),
    logoVaultFileId: row.logoVaultFileId,
    frontImageVaultFileId: row.frontImageVaultFileId,
    backImageVaultFileId: row.backImageVaultFileId,
    pdfVaultFileId: row.pdfVaultFileId,
    svgVaultFileId: row.svgVaultFileId,
    status: row.status,
    lastError: row.lastError,
    generationCost: row.generationCost,
    metadata: safeJson(row.metadata, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    frontUrl: row.frontImageVaultFileId
      ? `/api/projects/${row.projectId}/vault/${row.frontImageVaultFileId}/preview`
      : null,
    backUrl: row.backImageVaultFileId
      ? `/api/projects/${row.projectId}/vault/${row.backImageVaultFileId}/preview`
      : null,
    pdfUrl: row.pdfVaultFileId
      ? `/api/projects/${row.projectId}/vault/${row.pdfVaultFileId}/preview`
      : null,
    logoUrl: row.logoVaultFileId
      ? `/api/projects/${row.projectId}/vault/${row.logoVaultFileId}/preview`
      : null,
    bgUrl: (() => {
      const meta = safeJson(row.metadata, {}) as any;
      return meta?.bgVaultFileId
        ? `/api/projects/${row.projectId}/vault/${meta.bgVaultFileId}/preview`
        : null;
    })(),
    bgFrontUrl: (() => {
      const meta = safeJson(row.metadata, {}) as any;
      return meta?.bgFrontVaultFileId
        ? `/api/projects/${row.projectId}/vault/${meta.bgFrontVaultFileId}/preview`
        : null;
    })(),
    bgBackUrl: (() => {
      const meta = safeJson(row.metadata, {}) as any;
      return meta?.bgBackVaultFileId
        ? `/api/projects/${row.projectId}/vault/${meta.bgBackVaultFileId}/preview`
        : null;
    })(),
    layoutOverrides: safeJson(row.layoutOverrides, {}),
    backgroundImageUrl: (() => {
      const bg = safeJson(row.backgroundConfig, {}) as any;
      return bg?.kind === "custom-image" && bg?.vaultFileId
        ? `/api/projects/${row.projectId}/vault/${bg.vaultFileId}/preview`
        : null;
    })(),
  };
}

// ─── Templates catalog (público dentro del admin scope) ────────────────────
router.get("/cards/templates", requireAdmin, async (_req, res) => {
  res.json({ templates: listTemplates() });
});

// ─── Auto-design ────────────────────────────────────────────────────────────
router.post("/cards/auto-design", requireAdmin, async (req, res) => {
  try {
    const input = {
      industry: s(req.body?.industry),
      vibe: s(req.body?.vibe),
      preferredColor: s(req.body?.preferredColor),
      brandName: s(req.body?.brandName),
    };
    const result = await autoDesignCard(input);

    learnFromOperation({
      operationType: "card_auto_design",
      title: `Auto-diseño tarjeta: ${input.brandName || input.industry || "genérico"}`,
      content: `Auto-diseño de tarjeta de visita. Industria: ${input.industry || "general"}. Vibe: ${input.vibe || "profesional"}. Color preferido: ${input.preferredColor || "auto"}. Marca: ${input.brandName || "sin nombre"}. Template elegido: ${(result as any)?.templateId || "auto"}`,
      confidence: 0.8,
      tags: ["cards", "auto_design", input.industry, input.vibe].filter(Boolean) as string[],
    });

    res.json(result);
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards/auto-design failed");
    res.status(500).json({ error: err?.message || "Error en auto-design" });
  }
});

// ─── List by project ────────────────────────────────────────────────────────
router.get("/projects/:projectId/cards", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (!Number.isFinite(projectId)) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }
    const rows = await db
      .select()
      .from(businessCardsTable)
      .where(eq(businessCardsTable.projectId, projectId))
      .orderBy(desc(businessCardsTable.updatedAt));
    res.json({ cards: rows.map(toCardDto), total: rows.length });
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards list failed");
    res.status(500).json({ error: err?.message || "Error listando tarjetas" });
  }
});

// ─── Create ─────────────────────────────────────────────────────────────────
router.post("/projects/:projectId/cards", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const templateId = s(req.body?.templateId) || "elite-executive";
    const tpl = getTemplate(templateId);
    if (!tpl) { res.status(400).json({ error: `Template inválido: ${templateId}` }); return; }

    const fullName = s(req.body?.fullName);
    if (!fullName) { res.status(400).json({ error: "fullName es obligatorio" }); return; }

    const palette = req.body?.palette && typeof req.body.palette === "object"
      ? JSON.stringify(req.body.palette)
      : JSON.stringify(tpl.palette);
    const fonts = req.body?.fonts && typeof req.body.fonts === "object"
      ? JSON.stringify(req.body.fonts)
      : JSON.stringify(tpl.fonts);
    // Acepta tanto `background` como `backgroundConfig` (frontend usa el segundo)
    const bgInput = (req.body?.background && typeof req.body.background === "object")
      ? req.body.background
      : (req.body?.backgroundConfig && typeof req.body.backgroundConfig === "object")
        ? req.body.backgroundConfig
        : null;
    const backgroundConfig = bgInput
      ? JSON.stringify(bgInput)
      : JSON.stringify(tpl.background);

    const [created] = await db
      .insert(businessCardsTable)
      .values({
        projectId,
        name: s(req.body?.name) || `Tarjeta de ${fullName}`,
        templateId,
        fullName,
        jobTitle: s(req.body?.jobTitle),
        companyName: s(req.body?.companyName),
        tagline: s(req.body?.tagline, 240),
        email: s(req.body?.email),
        phone: s(req.body?.phone),
        website: s(req.body?.website),
        socialHandle: s(req.body?.socialHandle),
        address: s(req.body?.address, 240),
        qrUrl: s(req.body?.qrUrl, 1024),
        qrType: QR_TYPES.has(req.body?.qrType) ? req.body.qrType : "vcard",
        qrContentUrl: typeof req.body?.qrContentUrl === "string" && isHttpUrl(req.body.qrContentUrl.trim())
          ? req.body.qrContentUrl.trim().slice(0, MAX_QR_DATA) : null,
        palette,
        fonts,
        layout: s(req.body?.layout) || tpl.layout,
        backgroundConfig,
        status: "draft",
      })
      .returning();
    res.json(toCardDto(created));
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards create failed");
    res.status(500).json({ error: err?.message || "Error creando tarjeta" });
  }
});

// ─── Detail ─────────────────────────────────────────────────────────────────
router.get("/cards/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    res.json(toCardDto(row));
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards detail failed");
    res.status(500).json({ error: err?.message || "Error" });
  }
});

// ─── Update ─────────────────────────────────────────────────────────────────
router.patch("/cards/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [existing] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }

    const patch: Record<string, any> = {};
    const stringFields = [
      "name", "templateId", "fullName", "jobTitle", "companyName",
      "tagline", "email", "phone", "website", "socialHandle", "address", "qrUrl", "layout",
    ];
    for (const f of stringFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, f)) {
        patch[f] = req.body[f] === null ? null : s(req.body[f], f === "tagline" || f === "address" ? 240 : 500); // nosemgrep: remote-property-injection
      }
    }
    if (req.body?.palette && typeof req.body.palette === "object") patch.palette = JSON.stringify(req.body.palette);
    if (req.body?.fonts && typeof req.body.fonts === "object") patch.fonts = JSON.stringify(req.body.fonts);
    if (req.body?.layoutOverrides && typeof req.body.layoutOverrides === "object") {
      if (JSON.stringify(req.body.layoutOverrides).length > 400_000) {
        res.status(413).json({ error: "El diseño tiene demasiados elementos." }); return;
      }
      patch.layoutOverrides = JSON.stringify(await normalizeOverrides(req.body.layoutOverrides, existing.projectId));
    }
    // Estilo del QR principal (se guarda saneado en metadata.qrStyle; null = volver al de la plantilla)
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "qrStyle")) {
      const meta = safeJson(existing.metadata, {}) as Record<string, unknown>;
      if (req.body.qrStyle && typeof req.body.qrStyle === "object") {
        meta.qrStyle = sanitizeQrStyle(req.body.qrStyle, qrStyleBase(String(req.body?.templateId || existing.templateId)));
      } else {
        delete meta.qrStyle;
      }
      patch.metadata = JSON.stringify(meta);
    }
    // Acepta tanto `background` como `backgroundConfig` (FE usa el segundo)
    if (req.body?.background && typeof req.body.background === "object") {
      patch.backgroundConfig = JSON.stringify(req.body.background);
    } else if (req.body?.backgroundConfig && typeof req.body.backgroundConfig === "object") {
      patch.backgroundConfig = JSON.stringify(req.body.backgroundConfig);
    }

    // Destino del QR
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "qrType")) {
      if (!QR_TYPES.has(req.body.qrType)) { res.status(400).json({ error: "Tipo de QR no válido" }); return; }
      patch.qrType = req.body.qrType;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "qrContentUrl")) {
      const v = req.body.qrContentUrl;
      if (v === null || (typeof v === "string" && !v.trim())) patch.qrContentUrl = null;
      else if (typeof v === "string" && isHttpUrl(v.trim())) patch.qrContentUrl = v.trim().slice(0, MAX_QR_DATA);
      else { res.status(400).json({ error: "La URL del QR debe empezar por http:// o https://" }); return; }
    }

    let updatedRow: CardRow = existing;
    if (Object.keys(patch).length > 0) {
      const [r] = await db
        .update(businessCardsTable)
        .set(patch)
        .where(eq(businessCardsTable.id, id))
        .returning();
      updatedRow = r;
    }
    res.json(toCardDto(updatedRow));
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards update failed");
    res.status(500).json({ error: err?.message || "Error" });
  }
});

// ─── Delete ─────────────────────────────────────────────────────────────────
router.delete("/cards/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(businessCardsTable).where(eq(businessCardsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards delete failed");
    res.status(500).json({ error: err?.message || "Error" });
  }
});

// ─── Upload logo ────────────────────────────────────────────────────────────
router.post(
  "/cards/:id/upload-logo",
  requireAdmin,
  upload.single("logo"),
  async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
      if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
      if (!req.file) { res.status(400).json({ error: "Falta archivo logo" }); return; }

      const vaultId = await saveToVault({
        projectId: row.projectId,
        fileType: "card-logo",
        category: "card_logo",
        title: `Logo · ${row.name}`,
        description: `Logo de tarjeta ${row.name}`,
        mimeType: req.file.mimetype,
        content: req.file.buffer.toString("base64"),
        fileSizeBytes: req.file.buffer.length,
        generatedBy: "card-studio",
        metadata: { cardId: id },
      });

      if (!vaultId) { res.status(500).json({ error: "No se pudo guardar logo en vault" }); return; }

      const [updated] = await db
        .update(businessCardsTable)
        .set({ logoVaultFileId: vaultId })
        .where(eq(businessCardsTable.id, id))
        .returning();

      res.json(toCardDto(updated));
    } catch (err: any) {
      logger.error({ err: err?.message }, "cards upload-logo failed");
      res.status(500).json({ error: err?.message || "Error subiendo logo" });
    }
  },
);

// ─── Upload background photo ─────────────────────────────────────────────────
router.post(
  "/cards/:id/upload-background",
  requireAdmin,
  upload.single("background"),
  async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
      if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
      if (!req.file) { res.status(400).json({ error: "Falta archivo de fondo" }); return; }

      const vaultId = await saveToVault({
        projectId: row.projectId,
        fileType: "card-background",
        category: "card_background",
        title: `Fondo · ${row.name}`,
        description: `Foto de fondo tarjeta ${row.name}`,
        mimeType: req.file.mimetype,
        content: req.file.buffer.toString("base64"),
        fileSizeBytes: req.file.buffer.length,
        generatedBy: "card-studio",
        metadata: { cardId: id },
      });

      if (!vaultId) { res.status(500).json({ error: "No se pudo guardar fondo en vault" }); return; }

      const existingBg = safeJson(row.backgroundConfig, {}) as any;
      const newBgConfig = { ...existingBg, kind: "custom-image", vaultFileId: vaultId };

      const [updated] = await db
        .update(businessCardsTable)
        .set({ backgroundConfig: newBgConfig as any })
        .where(eq(businessCardsTable.id, id))
        .returning();

      res.json(toCardDto(updated));
    } catch (err: any) {
      logger.error({ err: err?.message }, "cards upload-background failed");
      res.status(500).json({ error: err?.message || "Error subiendo foto de fondo" });
    }
  },
);

// ─── Import front image (set existing image as front of card, marks as ready) ─
router.post(
  "/cards/:id/import-front",
  requireAdmin,
  upload.single("front"),
  async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
      if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
      if (!req.file) { res.status(400).json({ error: "Falta archivo de imagen" }); return; }

      const vaultId = await saveToVault({
        projectId: row.projectId,
        fileType: "card-front",
        category: "card_generated",
        title: `Frente importado · ${row.name}`,
        description: `Imagen importada como frente de tarjeta ${row.name}`,
        mimeType: req.file.mimetype,
        content: req.file.buffer.toString("base64"),
        fileSizeBytes: req.file.buffer.length,
        generatedBy: "card-studio-import",
        metadata: { cardId: id },
      });

      if (!vaultId) { res.status(500).json({ error: "No se pudo guardar imagen en vault" }); return; }

      const [updated] = await db
        .update(businessCardsTable)
        .set({ frontImageVaultFileId: vaultId, status: "ready" })
        .where(eq(businessCardsTable.id, id))
        .returning();

      res.json(toCardDto(updated));
    } catch (err: any) {
      logger.error({ err: err?.message }, "cards import-front failed");
      res.status(500).json({ error: err?.message || "Error importando imagen" });
    }
  },
);

// ─── Generate (pipeline completo, long-running) ─────────────────────────────
router.post("/cards/:id/generate", requireAdmin, async (req: Request, res: Response) => {
  enableLongRunning(res);
  const id = parseInt(String(req.params.id), 10);
  const overrideBgModel = s(req.body?.backgroundModel);

  try {
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }

    // Lock atómico: solo arrancamos la generación si el row NO está ya en "generating".
    // Evita doble pipeline concurrente (coste duplicado, last-write-wins en vault IDs)
    // si el usuario hace doble click o reintentos solapados.
    const claim = await db
      .update(businessCardsTable)
      .set({ status: "generating", lastError: null })
      .where(and(eq(businessCardsTable.id, id), ne(businessCardsTable.status, "generating")))
      .returning({ id: businessCardsTable.id });
    if (claim.length === 0) {
      res.status(409).json({ error: "Esta tarjeta ya se está generando. Espera a que termine." });
      return;
    }

    // Logo opcional
    let logoBuffer: Buffer | undefined;
    let logoMime: string | undefined;
    if (row.logoVaultFileId) {
      const [lf] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, row.logoVaultFileId));
      if (lf?.content) {
        try {
          logoBuffer = Buffer.from(lf.content, "base64");
          logoMime = lf.mimeType || "image/png";
        } catch {}
      }
    }

    // Fondo personalizado (foto subida por el usuario)
    let backgroundImageBuffer: Buffer | undefined;
    let backgroundImageMime: string | undefined;
    const bgCfgRaw = safeJson(row.backgroundConfig, {}) as any;
    if (bgCfgRaw?.kind === "custom-image" && bgCfgRaw?.vaultFileId) {
      const [bf] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, bgCfgRaw.vaultFileId));
      if (bf?.content) {
        try {
          backgroundImageBuffer = Buffer.from(bf.content, "base64");
          backgroundImageMime = bf.mimeType || "image/jpeg";
        } catch {}
      }
    }

    const palette = safeJson(row.palette, {}) as any;
    const fonts = safeJson(row.fonts, {}) as any;
    const background = safeJson(row.backgroundConfig, {}) as any;
    const overrides = safeJson(row.layoutOverrides, {}) as LayoutOverrides;

    const input: GenerateCardInput = {
      templateId: row.templateId,
      data: {
        fullName: row.fullName,
        jobTitle: row.jobTitle,
        companyName: row.companyName,
        tagline: row.tagline,
        email: row.email,
        phone: row.phone,
        website: row.website,
        socialHandle: row.socialHandle,
        address: row.address,
      },
      palette: palette && Object.keys(palette).length ? palette : undefined,
      fonts: fonts && Object.keys(fonts).length ? fonts : undefined,
      background: background && background.kind ? background : undefined,
      backgroundModel: (overrideBgModel as any) || undefined,
      layout: (row.layout === "centered" || row.layout === "left" || row.layout === "grid") ? row.layout : undefined,
      qrUrl: cardQrTarget(row, req),
      logoBuffer,
      logoMime,
      backgroundImageBuffer,
      backgroundImageMime,
      overrides,
      qrStyle: (safeJson(row.metadata, {}) as any)?.qrStyle,
      qrLabel: qrLabelFor(row.qrType),
      sideBackgrounds: await loadSideBackgrounds(row),
      extraAssets: await resolveExtraAssets(
        row, overrides.extras,
        logoBuffer ? `data:${logoMime || "image/png"};base64,${logoBuffer.toString("base64")}` : undefined,
      ),
    };

    const result = await generateBusinessCard(input);

    // Persistir front + back + PDF + background + QR en vault
    const tpl = getTemplate(row.templateId);
    const safeName = (row.name || `card-${id}`).replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);

    const vaultJobs: Promise<number | null>[] = [
      saveToVault({
        projectId: row.projectId, fileType: "card-front", category: "card_front",
        title: `${row.name} · Frente`,
        description: `Tarjeta ${tpl?.name || row.templateId} — frente`,
        mimeType: "image/png", content: result.frontPng.toString("base64"),
        fileSizeBytes: result.frontPng.length, generatedBy: "card-studio",
        metadata: { cardId: id, side: "front", ...result.meta },
      }),
      saveToVault({
        projectId: row.projectId, fileType: "card-back", category: "card_back",
        title: `${row.name} · Reverso`,
        description: `Tarjeta ${tpl?.name || row.templateId} — reverso`,
        mimeType: "image/png", content: result.backPng.toString("base64"),
        fileSizeBytes: result.backPng.length, generatedBy: "card-studio",
        metadata: { cardId: id, side: "back", ...result.meta },
      }),
    ];

    // Background puro (para el editor visual sin texto/QR encima)
    if (result.backgroundPng) {
      vaultJobs.push(saveToVault({
        projectId: row.projectId, fileType: "card-background", category: "card_bg",
        title: `${row.name} · Fondo`,
        description: `Textura de fondo para ${row.name}`,
        mimeType: "image/png", content: result.backgroundPng.toString("base64"),
        fileSizeBytes: result.backgroundPng.length, generatedBy: "card-studio",
        metadata: { cardId: id, side: "background" },
      }));
    } else {
      vaultJobs.push(Promise.resolve(null));
    }

    // QR PNG (para el editor visual)
    if (result.qrPng) {
      vaultJobs.push(saveToVault({
        projectId: row.projectId, fileType: "card-qr", category: "card_qr",
        title: `${row.name} · QR`,
        description: `Código QR para ${row.name}`,
        mimeType: "image/png", content: result.qrPng.toString("base64"),
        fileSizeBytes: result.qrPng.length, generatedBy: "card-studio",
        metadata: { cardId: id, qrData: result.meta.qrSource },
      }));
    } else {
      vaultJobs.push(Promise.resolve(null));
    }

    const [frontVaultId, backVaultId, bgVaultId, qrVaultId] = await Promise.all(vaultJobs);

    // Validación dura: si front o back no se persistieron, fallar
    if (!frontVaultId || !backVaultId) {
      throw new Error(`Fallo al guardar imágenes en repositorio (front=${frontVaultId}, back=${backVaultId})`);
    }

    // PDF imprimible
    let pdfVaultId: number | null = null;
    try {
      const pdfBuf = await generatePrintablePdf(result.frontPng, result.backPng, row.name);
      pdfVaultId = await saveToVault({
        projectId: row.projectId,
        fileType: "card-pdf",
        category: "card_pdf",
        title: `${row.name} · Print Sheet PDF`,
        description: "PDF imprimible A4 con front+back y crop marks",
        mimeType: "application/pdf",
        content: pdfBuf.toString("base64"),
        fileSizeBytes: pdfBuf.length,
        generatedBy: "card-studio",
        metadata: { cardId: id, format: "pdf-print" },
      });
    } catch (err: any) {
      logger.warn({ err: err?.message, cardId: id }, "card PDF generation failed (non-fatal)");
    }

    const [updated] = await db
      .update(businessCardsTable)
      .set({
        status: "ready",
        frontImageVaultFileId: frontVaultId ?? row.frontImageVaultFileId,
        backImageVaultFileId: backVaultId ?? row.backImageVaultFileId,
        pdfVaultFileId: pdfVaultId ?? row.pdfVaultFileId,
        generationCost: result.cost.toFixed(4),
        metadata: JSON.stringify({
          ...safeJson(row.metadata, {}) as any,
          lastGeneration: result.meta,
          bgVaultFileId: bgVaultId ?? (safeJson(row.metadata, {}) as any)?.bgVaultFileId ?? null,
          qrVaultFileId: qrVaultId ?? (safeJson(row.metadata, {}) as any)?.qrVaultFileId ?? null,
        }),
        lastError: null,
      })
      .where(eq(businessCardsTable.id, id))
      .returning();

    learnFromOperation({
      operationType: "card_generation",
      title: `Tarjeta generada: ${row.name || row.fullName} — template ${row.templateId}`,
      content: `Tarjeta de visita generada con éxito. Nombre: ${row.fullName}. Cargo: ${row.jobTitle || "N/A"}. Empresa: ${row.companyName || "N/A"}. Template: ${row.templateId}. Layout: ${row.layout || "default"}. Coste: $${result.cost.toFixed(4)}. Incluye: front PNG + back PNG${pdfVaultId ? " + PDF imprimible" : ""}. Meta: ${JSON.stringify(result.meta).slice(0, 200)}`,
      confidence: 0.85,
      tags: ["cards", "generation", row.templateId, row.layout].filter(Boolean) as string[],
    });

    res.json({
      ok: true,
      card: toCardDto(updated),
      cost: result.cost,
      meta: result.meta,
      qrVerified: result.meta.qrVerified,
      qrWarnings: result.meta.qrWarnings,
      bgGenFailed: result.meta.bgGenFailed ?? false,
      bgGenError: result.meta.bgGenError ?? null,
    });
  } catch (err: any) {
    logger.error({ err: err?.message, cardId: id }, "cards generate failed");
    try {
      await db
        .update(businessCardsTable)
        .set({ status: "failed", lastError: String(err?.message || err).slice(0, 500) })
        .where(eq(businessCardsTable.id, id));
    } catch {}
    res.status(500).json({ error: err?.message || "Error generando tarjeta" });
  }
});

// ─── Resolved elements (defaults + overrides + extras) para el editor visual ──
router.get("/cards/:id/elements", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const side = String(req.query.side || "front") === "back" ? "back" : "front";
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    const tpl = getTemplate(row.templateId);
    if (!tpl) { res.status(400).json({ error: "Template inválido" }); return; }

    const palette = { ...tpl.palette, ...(safeJson(row.palette, {}) as any) };
    const fonts = { ...tpl.fonts, ...(safeJson(row.fonts, {}) as any) };
    const overrides = safeJson(row.layoutOverrides, {}) as any;
    const layout = (row.layout === "centered" || row.layout === "left" || row.layout === "grid") ? row.layout : tpl.layout;
    const isAiBg = (safeJson(row.backgroundConfig, {}) as any)?.kind === "ai-texture" || tpl.background.kind === "ai-texture";

    const data = {
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      companyName: row.companyName,
      tagline: row.tagline,
      email: row.email,
      phone: row.phone,
      website: row.website,
      socialHandle: row.socialHandle,
      address: row.address,
    };

    const { defaultFrontElements, defaultBackElements, applyOverrides, extrasToRender } = await import("../lib/card-elements.js");

    // QR placeholder (no necesitamos el bitmap exacto en el editor — usamos un cuadro visual)
    const qrPngBase64 = side === "back" ? "PLACEHOLDER" : undefined;

    const defaults = side === "front"
      ? defaultFrontElements({ side: "front", layout, data, palette, fonts, isAiBg, logoDataUri: row.logoVaultFileId ? "x" : undefined })
      : defaultBackElements ({ side: "back",  layout, data, palette, fonts, isAiBg, qrPngBase64, qrLabel: qrLabelFor(row.qrType) });
    const sideOv = side === "front" ? overrides.front : overrides.back;
    const merged = applyOverrides(defaults, sideOv);
    const extras = extrasToRender(overrides.extras, side);
    res.json({
      side,
      width: 1080,
      height: 720,
      elements: [...merged, ...extras],
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards elements failed");
    res.status(500).json({ error: err?.message || "Error" });
  }
});

// ─── QR del reverso (PNG) — siempre al momento, con el estilo y el destino actuales ──
// ?style=<json> previsualiza un estilo sin guardarlo. Cabeceras X-Qr-Verified / X-Qr-Warnings.
router.get("/cards/:id/qr.png", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    const queryStyle = styleFromQuery(req.query.style);
    if (queryStyle === null) { res.status(400).json({ error: "Parámetro style inválido" }); return; }
    const style = sanitizeQrStyle(queryStyle ?? (safeJson(row.metadata, {}) as any)?.qrStyle, qrStyleBase(row.templateId));
    const size = Math.max(128, Math.min(2048, parseInt(String(req.query.size || "1024"), 10) || 1024));
    const r = await renderVerifiedQr(cardQrData(row, req), style, { size, logoDataUri: style.logo ? await cardLogoDataUri(row) : undefined });
    setQrHeaders(res, r);
    res.setHeader("Content-Type", "image/png");
    res.send(r.png);
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards qr.png failed");
    res.status(500).json({ error: err?.message || "Error generando QR" });
  }
});

// ─── QR del reverso (SVG vectorial para imprenta) ───────────────────────────
router.get("/cards/:id/qr.svg", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    const style = sanitizeQrStyle((safeJson(row.metadata, {}) as any)?.qrStyle, qrStyleBase(row.templateId));
    const r = await renderVerifiedQr(cardQrData(row, req), style, { size: 1024, logoDataUri: style.logo ? await cardLogoDataUri(row) : undefined });
    setQrHeaders(res, r);
    const fname = (row.name || `tarjeta-${id}`).replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", `attachment; filename="qr-${fname}.svg"`);
    res.send(r.svg);
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards qr.svg failed");
    res.status(500).json({ error: err?.message || "Error generando QR" });
  }
});

// ─── Subir un QR ya diseñado (se lee para comprobar que funciona) ─────────────
// multipart "qr" + campo opcional force=1 para aceptarlo aunque no se pueda leer.
router.post("/cards/:id/upload-qr", requireAdmin, upload.single("qr"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    if (!req.file) { res.status(400).json({ error: "Falta la imagen del QR" }); return; }

    // PNG limpio (sin EXIF), orientado y con lado máximo 2048 px
    const png = await sharp(req.file.buffer).rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .png().toBuffer();
    const meta = await sharp(png).metadata();
    const decoded = await decodeQrImage(png);
    const force = ["1", "true"].includes(String(req.body?.force || ""));
    if (!decoded && !force) {
      res.status(422).json({
        error: "No se ha encontrado un código QR legible en la imagen. Si es un QR artístico que tu móvil sí lee, puedes añadirlo igualmente.",
        canForce: true,
      });
      return;
    }

    const vaultId = await saveToVault({
      projectId: row.projectId,
      fileType: "card-qr-custom",
      category: "card_qr",
      title: `QR propio · ${row.name}`,
      description: decoded ? `QR subido — contenido: ${decoded.slice(0, 200)}` : "QR subido (no verificado)",
      mimeType: "image/png",
      content: png.toString("base64"),
      fileSizeBytes: png.length,
      generatedBy: "card-studio",
      metadata: { cardId: id, decoded, verified: !!decoded },
    });
    if (!vaultId) { res.status(500).json({ error: "No se pudo guardar el QR" }); return; }

    res.json({
      vaultFileId: vaultId,
      url: `/api/projects/${row.projectId}/vault/${vaultId}/preview`,
      decoded,
      verified: !!decoded,
      width: meta.width,
      height: meta.height,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards upload-qr failed");
    res.status(500).json({ error: err?.message || "Error subiendo el QR" });
  }
});

// ─── Export PDF desde canvas (acepta base64 PNGs del cliente) ───────────────
router.post("/cards/:id/export-pdf", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  try {
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    const { front, back } = req.body as { front?: string; back?: string };
    if (!front || !back) { res.status(400).json({ error: "Se requieren 'front' y 'back' en base64" }); return; }
    const frontPng = Buffer.from(front.replace(/^data:image\/png;base64,/, ""), "base64");
    const backPng  = Buffer.from(back.replace(/^data:image\/png;base64,/, ""), "base64");
    const pdfBuf = await generatePrintablePdf(frontPng, backPng, row.name);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${row.name.replace(/[^a-z0-9-_]/gi, "_")}-print.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards export-pdf failed");
    res.status(500).json({ error: err?.message || "Error generando PDF" });
  }
});

// ─── Fondo propio de una cara (diseño del editor: sólido, degradado, metálico…) ──
// multipart "background" + campo side=front|back|both. Se usa en el editor y en «Re-generar».
router.post("/cards/:id/side-background", requireAdmin, upload.single("background"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    if (!req.file) { res.status(400).json({ error: "Falta la imagen del fondo" }); return; }
    const side = String(req.body?.side || "both");
    if (!["front", "back", "both"].includes(side)) { res.status(400).json({ error: "side debe ser front, back o both" }); return; }
    const png = await sharp(req.file.buffer).resize(1080, 720, { fit: "cover", position: "center" }).png().toBuffer();
    const meta = safeJson(row.metadata, {}) as Record<string, any>;
    for (const s of side === "both" ? ["front", "back"] as const : [side as "front" | "back"]) {
      const vaultId = await saveToVault({
        projectId: row.projectId, fileType: "card-background", category: "card_bg",
        title: `${row.name} · Fondo ${s === "front" ? "Frente" : "Reverso"}`,
        description: `Fondo diseñado en el editor (${s})`,
        mimeType: "image/png", content: png.toString("base64"), fileSizeBytes: png.length,
        generatedBy: "card-studio", metadata: { cardId: id, side: `bg-${s}`, source: "editor-fill" },
      });
      if (!vaultId) { res.status(500).json({ error: "No se pudo guardar el fondo" }); return; }
      meta[s === "front" ? "bgFrontVaultFileId" : "bgBackVaultFileId"] = vaultId;
    }
    const [updated] = await db.update(businessCardsTable).set({ metadata: JSON.stringify(meta) })
      .where(eq(businessCardsTable.id, id)).returning();
    res.json(toCardDto(updated));
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards side-background failed");
    res.status(500).json({ error: err?.message || "Error guardando el fondo" });
  }
});

// Quita el fondo propio de una cara (vuelve al fondo general de la tarjeta).
router.delete("/cards/:id/side-background", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    const side = String(req.query.side || "both");
    if (!["front", "back", "both"].includes(side)) { res.status(400).json({ error: "side debe ser front, back o both" }); return; }
    const meta = safeJson(row.metadata, {}) as Record<string, any>;
    if (side !== "back") delete meta.bgFrontVaultFileId;
    if (side !== "front") delete meta.bgBackVaultFileId;
    const [updated] = await db.update(businessCardsTable).set({ metadata: JSON.stringify(meta) })
      .where(eq(businessCardsTable.id, id)).returning();
    res.json(toCardDto(updated));
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards side-background delete failed");
    res.status(500).json({ error: err?.message || "Error quitando el fondo" });
  }
});

// ─── Generar fondo por cara (sin pipeline completo) ──────────────────────────
router.post("/cards/:id/generate-bg", requireAdmin, async (req: Request, res: Response) => {
  enableLongRunning(res);
  const id = parseInt(String(req.params.id), 10);
  try {
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).json({ error: "Tarjeta no encontrada" }); return; }
    const { prompt, side, bgModel } = req.body as {
      prompt?: string; side?: "front" | "back" | "both"; bgModel?: string;
    };
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) { res.status(400).json({ error: "Se requiere 'prompt'" }); return; }
    if (prompt.length > 1000) { res.status(400).json({ error: "La descripción del fondo es demasiado larga (máx. 1000 caracteres)." }); return; }
    const { IMAGE_MODELS } = await import("../lib/fusion-studio-pro.js");
    if (bgModel && !(bgModel in IMAGE_MODELS)) { res.status(400).json({ error: `Modelo de imagen desconocido: ${bgModel}` }); return; }
    const targetSide: "front" | "back" | "both" = (side === "front" || side === "back") ? side : "both";

    const bgBuf = await generateCardBackground(prompt, bgModel as any, undefined);

    const meta = safeJson(row.metadata, {}) as any;
    const results: { side: string; url: string }[] = [];

    const saveSide = async (s: "front" | "back") => {
      const vaultId = await saveToVault({
        projectId: row.projectId,
        fileType: "card-background",
        category: "card_bg",
        title: `${row.name} · Fondo ${s === "front" ? "Frente" : "Reverso"}`,
        description: `Textura de fondo ${s} para ${row.name}`,
        mimeType: "image/png",
        content: bgBuf.toString("base64"),
        fileSizeBytes: bgBuf.length,
        generatedBy: "card-studio",
        metadata: { cardId: id, side: `bg-${s}` },
      });
      const key = s === "front" ? "bgFrontVaultFileId" : "bgBackVaultFileId";
      meta[key] = vaultId;
      const url = `/api/projects/${row.projectId}/vault/${vaultId}/preview`;
      results.push({ side: s, url });
    };

    if (targetSide === "both") {
      await saveSide("front");
      await saveSide("back");
    } else {
      await saveSide(targetSide);
    }

    await db.update(businessCardsTable)
      .set({ metadata: JSON.stringify(meta) })
      .where(eq(businessCardsTable.id, id));

    res.json({ ok: true, results });
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards generate-bg failed");
    res.status(500).json({ error: err?.message || "Error generando fondo" });
  }
});

// ─── QR genérico (elementos QR extra del editor) ────────────────────────────
// data=texto/URL · fg/bg=#RRGGBB · size=128–2048 · style=<json QrStyle> · logoCard=<id tarjeta>
router.get("/qr.png", async (req: Request, res: Response) => {
  try {
    const data = String(req.query.data || "").trim();
    if (!data) { res.status(400).json({ error: "Falta el parámetro data" }); return; }
    if (data.length > MAX_QR_DATA) { res.status(400).json({ error: `Contenido demasiado largo para un QR de tarjeta (máx. ${MAX_QR_DATA} caracteres)` }); return; }
    const fg = /^#[0-9a-f]{6}$/i.test(String(req.query.fg || "")) ? String(req.query.fg) : "#000000";
    const bg = /^#[0-9a-f]{6}$/i.test(String(req.query.bg || "")) ? String(req.query.bg) : "#ffffff";
    const size = Math.max(128, Math.min(2048, parseInt(String(req.query.size || "1200"), 10) || 1200));
    const queryStyle = styleFromQuery(req.query.style);
    if (queryStyle === null) { res.status(400).json({ error: "Parámetro style inválido" }); return; }
    const style = sanitizeQrStyle(queryStyle, { fg, fg2: fg, bg, margin: 1 });

    let logoDataUri: string | undefined;
    const logoCard = parseInt(String(req.query.logoCard || ""), 10);
    if (style.logo && Number.isFinite(logoCard)) {
      const [card] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, logoCard));
      if (card) logoDataUri = await cardLogoDataUri(card);
    }
    const r = await renderVerifiedQr(data, style, { size, logoDataUri });
    setQrHeaders(res, r);
    res.setHeader("Content-Type", "image/png");
    res.send(r.png);
  } catch (err: any) {
    logger.error({ err: err?.message }, "generic qr.png failed");
    res.status(500).json({ error: err?.message || "Error generando QR" });
  }
});

export default router;
