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
  autoDesignCard,
  type GenerateCardInput,
} from "../lib/card-studio.js";
import { listTemplates, getTemplate } from "../lib/card-templates.js";
import { generateQrSvg, buildVCard } from "../lib/card-qr.js";
import { enableLongRunning } from "../lib/long-running.js";
import { learnFromOperation } from "../lib/claude.js";

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
    else cb(new Error(`Tipo no permitido: ${file.mimetype}. Solo PNG, JPG o WEBP.`) as any, false);
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
      ? `/api/projects/${row.projectId}/files/${row.frontImageVaultFileId}/preview`
      : null,
    backUrl: row.backImageVaultFileId
      ? `/api/projects/${row.projectId}/files/${row.backImageVaultFileId}/preview`
      : null,
    pdfUrl: row.pdfVaultFileId
      ? `/api/projects/${row.projectId}/files/${row.pdfVaultFileId}/preview`
      : null,
    logoUrl: row.logoVaultFileId
      ? `/api/projects/${row.projectId}/files/${row.logoVaultFileId}/preview`
      : null,
    layoutOverrides: safeJson(row.layoutOverrides, {}),
    backgroundImageUrl: (() => {
      const bg = safeJson(row.backgroundConfig, {}) as any;
      return bg?.kind === "custom-image" && bg?.vaultFileId
        ? `/api/projects/${row.projectId}/files/${bg.vaultFileId}/preview`
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
      patch.layoutOverrides = JSON.stringify(req.body.layoutOverrides);
    }
    // Acepta tanto `background` como `backgroundConfig` (FE usa el segundo)
    if (req.body?.background && typeof req.body.background === "object") {
      patch.backgroundConfig = JSON.stringify(req.body.background);
    } else if (req.body?.backgroundConfig && typeof req.body.backgroundConfig === "object") {
      patch.backgroundConfig = JSON.stringify(req.body.backgroundConfig);
    }

    // Extra columns (qrType/qrContentUrl) — persisted via raw SQL since not in drizzle schema
    const newQrType: string | undefined = typeof req.body?.qrType === "string" ? req.body.qrType : undefined;
    const newQrContentUrl: string | null | undefined = req.body?.qrContentUrl === null ? null
      : typeof req.body?.qrContentUrl === "string" ? (req.body.qrContentUrl.trim() || null) : undefined;

    const hasExtra = newQrType !== undefined || newQrContentUrl !== undefined;

    let updatedRow: any = existing;
    if (Object.keys(patch).length > 0) {
      const [r] = await db
        .update(businessCardsTable)
        .set(patch)
        .where(eq(businessCardsTable.id, id))
        .returning();
      updatedRow = r;
    }
    if (hasExtra) {
      const qt = newQrType ?? (existing as any).qrType ?? "vcard";
      const qcu = newQrContentUrl !== undefined ? newQrContentUrl : ((existing as any).qrContentUrl ?? null);
      await db.execute(sql`
        UPDATE business_cards SET qr_type = ${qt}, qr_content_url = ${qcu} WHERE id = ${id}
      `);
      updatedRow = { ...updatedRow, qrType: qt, qrContentUrl: qcu };
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
      qrUrl: (() => {
        const qrType: string = (row as any).qrType || "vcard";
        const qrContentUrl: string | null = (row as any).qrContentUrl || null;
        if (qrType === "url" && qrContentUrl) return qrContentUrl;
        if (qrType === "vcard") return undefined;
        if (["video", "image", "animation"].includes(qrType)) {
          const proto = (req.headers["x-forwarded-proto"] as string | undefined) || req.protocol || "https";
          const host = req.get("host") || "localhost:8080";
          return `${proto}://${host}/api/public/qr/${id}`;
        }
        return row.qrUrl ?? undefined;
      })(),
      logoBuffer,
      logoMime,
      backgroundImageBuffer,
      backgroundImageMime,
      overrides: safeJson(row.layoutOverrides, {}) as any,
    };

    const result = await generateBusinessCard(input);

    // Persistir front + back + PDF en vault
    const tpl = getTemplate(row.templateId);
    const safeName = (row.name || `card-${id}`).replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);

    const [frontVaultId, backVaultId] = await Promise.all([
      saveToVault({
        projectId: row.projectId,
        fileType: "card-front",
        category: "card_front",
        title: `${row.name} · Frente`,
        description: `Tarjeta ${tpl?.name || row.templateId} — frente`,
        mimeType: "image/png",
        content: result.frontPng.toString("base64"),
        fileSizeBytes: result.frontPng.length,
        generatedBy: "card-studio",
        metadata: { cardId: id, side: "front", ...result.meta },
      }),
      saveToVault({
        projectId: row.projectId,
        fileType: "card-back",
        category: "card_back",
        title: `${row.name} · Reverso`,
        description: `Tarjeta ${tpl?.name || row.templateId} — reverso`,
        mimeType: "image/png",
        content: result.backPng.toString("base64"),
        fileSizeBytes: result.backPng.length,
        generatedBy: "card-studio",
        metadata: { cardId: id, side: "back", ...result.meta },
      }),
    ]);

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
        metadata: JSON.stringify({ ...safeJson(row.metadata, {}) as any, lastGeneration: result.meta }),
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
      : defaultBackElements ({ side: "back",  layout, data, palette, fonts, isAiBg, qrPngBase64 });
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

// ─── Export SVG QR (vectorial) ──────────────────────────────────────────────
router.get("/cards/:id/qr.svg", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) { res.status(404).send("not found"); return; }
    const tpl = getTemplate(row.templateId);
    const data = (row.qrUrl && row.qrUrl.trim())
      ? row.qrUrl.trim()
      : buildVCard({
          fullName: row.fullName,
          jobTitle: row.jobTitle ?? undefined,
          organization: row.companyName ?? undefined,
          email: row.email ?? undefined,
          phone: row.phone ?? undefined,
          website: row.website ?? undefined,
          address: row.address ?? undefined,
        });
    const svg = await generateQrSvg(data, {
      fgColor: tpl?.qrStyle.fgColor || "#000",
      bgColor: tpl?.qrStyle.bgColor || "#fff",
      margin: tpl?.qrStyle.margin ?? 1,
    });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (err: any) {
    logger.error({ err: err?.message }, "cards qr.svg failed");
    res.status(500).send(err?.message || "error");
  }
});

export default router;
