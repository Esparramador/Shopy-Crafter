import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { reportTemplatesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger.js";
import { enableLongRunning } from "../lib/long-running.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
function sanitizeHex(val: unknown, fallback: string): string {
  if (typeof val !== "string") return fallback;
  return HEX_RE.test(val) ? val : fallback;
}
function sanitizeStr(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  return val.slice(0, maxLen) || null;
}
const ALLOWED_COVER = ["centered", "left-aligned", "minimal"];
const ALLOWED_SECTION = ["card", "accent-bar", "minimal"];

router.get("/report-templates", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId;
    if (!userId) { res.json([]); return; }
    const templates = await db.select().from(reportTemplatesTable)
      .where(eq(reportTemplatesTable.userId, userId))
      .orderBy(desc(reportTemplatesTable.updatedAt));
    res.json(templates);
  } catch (err) {
    logger.error({ err }, "Error listing report templates");
    res.status(500).json({ error: "Error cargando plantillas" });
  }
});

router.get("/report-templates/:idOrToken", async (req: Request, res: Response): Promise<void> => {
  try {
    const param = String(req.params.idOrToken);
    const id = parseInt(param);
    let template;
    if (!isNaN(id)) {
      [template] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.id, id));
    } else {
      if (!/^[a-f0-9]{64}$/.test(param)) { res.status(400).json({ error: "Token inválido" }); return; }
      [template] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.shareToken, param));
    }
    if (!template) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    const userId = req.session.userId;
    if (template.userId !== userId && !template.isPublic) { res.status(403).json({ error: "Sin acceso" }); return; }
    res.json(template);
  } catch (err) {
    logger.error({ err }, "Error loading report template");
    res.status(500).json({ error: "Error cargando plantilla" });
  }
});

router.post("/report-templates", upload.single("logo"), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
    const b = req.body;
    const name = sanitizeStr(b.name, 200);
    if (!name) { res.status(400).json({ error: "Nombre requerido" }); return; }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) + "-" + Date.now().toString(36);
    const shareToken = randomBytes(32).toString("hex");

    let logoBase64: string | null = null;
    if (req.file) {
      if (req.file.size > 2 * 1024 * 1024) { res.status(400).json({ error: "Logo máximo 2MB" }); return; }
      if (!req.file.mimetype.startsWith("image/")) { res.status(400).json({ error: "Solo imágenes" }); return; }
      logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } else if (typeof b.logoBase64 === "string" && b.logoBase64.startsWith("data:image/")) {
      if (b.logoBase64.length > 3 * 1024 * 1024) { res.status(400).json({ error: "Logo base64 demasiado grande" }); return; }
      logoBase64 = b.logoBase64;
    }

    const [template] = await db.insert(reportTemplatesTable).values({
      userId, name, slug, shareToken, logoBase64,
      companyName: sanitizeStr(b.companyName, 200),
      tagline: sanitizeStr(b.tagline, 300),
      primaryColor: sanitizeHex(b.primaryColor, "#c8a84b"),
      secondaryColor: sanitizeHex(b.secondaryColor, "#08080e"),
      accentColor: sanitizeHex(b.accentColor, "#44cc88"),
      textColor: sanitizeHex(b.textColor, "#f0f0f5"),
      bgColor: sanitizeHex(b.bgColor, "#08080e"),
      cardBg: sanitizeHex(b.cardBg, "#12121a"),
      borderColor: sanitizeHex(b.borderColor, "#1a1a22"),
      headingFont: sanitizeStr(b.headingFont, 100) || "Helvetica Neue",
      bodyFont: sanitizeStr(b.bodyFont, 100) || "Helvetica Neue",
      headingWeight: sanitizeStr(b.headingWeight, 10) || "700",
      coverStyle: ALLOWED_COVER.includes(b.coverStyle) ? b.coverStyle : "centered",
      sectionStyle: ALLOWED_SECTION.includes(b.sectionStyle) ? b.sectionStyle : "card",
      footerText: sanitizeStr(b.footerText, 300),
      showPageNumbers: b.showPageNumbers !== false && b.showPageNumbers !== "false",
      isPublic: b.isPublic === true || b.isPublic === "true",
    }).returning();

    res.json({ success: true, template });
  } catch (err) {
    logger.error({ err }, "Error creating report template");
    res.status(500).json({ error: "Error creando plantilla" });
  }
});

router.put("/report-templates/:id", upload.single("logo"), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const userId = req.session.userId;
    const [existing] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.id, id));
    if (!existing) { res.status(404).json({ error: "No encontrada" }); return; }
    if (existing.userId !== userId) { res.status(403).json({ error: "Sin permiso" }); return; }

    const b = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (b.name !== undefined) updates.name = sanitizeStr(b.name, 200) || existing.name;
    if (b.companyName !== undefined) updates.companyName = sanitizeStr(b.companyName, 200);
    if (b.tagline !== undefined) updates.tagline = sanitizeStr(b.tagline, 300);
    if (b.primaryColor !== undefined) updates.primaryColor = sanitizeHex(b.primaryColor, existing.primaryColor!);
    if (b.secondaryColor !== undefined) updates.secondaryColor = sanitizeHex(b.secondaryColor, existing.secondaryColor!);
    if (b.accentColor !== undefined) updates.accentColor = sanitizeHex(b.accentColor, existing.accentColor!);
    if (b.textColor !== undefined) updates.textColor = sanitizeHex(b.textColor, existing.textColor!);
    if (b.bgColor !== undefined) updates.bgColor = sanitizeHex(b.bgColor, existing.bgColor!);
    if (b.cardBg !== undefined) updates.cardBg = sanitizeHex(b.cardBg, existing.cardBg!);
    if (b.borderColor !== undefined) updates.borderColor = sanitizeHex(b.borderColor, existing.borderColor!);
    if (b.headingFont !== undefined) updates.headingFont = sanitizeStr(b.headingFont, 100) || existing.headingFont;
    if (b.bodyFont !== undefined) updates.bodyFont = sanitizeStr(b.bodyFont, 100) || existing.bodyFont;
    if (b.headingWeight !== undefined) updates.headingWeight = sanitizeStr(b.headingWeight, 10) || existing.headingWeight;
    if (b.coverStyle !== undefined) updates.coverStyle = ALLOWED_COVER.includes(b.coverStyle) ? b.coverStyle : existing.coverStyle;
    if (b.sectionStyle !== undefined) updates.sectionStyle = ALLOWED_SECTION.includes(b.sectionStyle) ? b.sectionStyle : existing.sectionStyle;
    if (b.footerText !== undefined) updates.footerText = sanitizeStr(b.footerText, 300);
    if (b.showPageNumbers !== undefined) updates.showPageNumbers = b.showPageNumbers !== false && b.showPageNumbers !== "false";
    if (b.isPublic !== undefined) updates.isPublic = b.isPublic === true || b.isPublic === "true";

    if (req.file) {
      if (req.file.size > 2 * 1024 * 1024) { res.status(400).json({ error: "Logo máximo 2MB" }); return; }
      if (!req.file.mimetype.startsWith("image/")) { res.status(400).json({ error: "Solo imágenes" }); return; }
      updates.logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } else if (typeof b.logoBase64 === "string" && b.logoBase64.startsWith("data:image/")) {
      if (b.logoBase64.length > 3 * 1024 * 1024) { res.status(400).json({ error: "Logo base64 demasiado grande" }); return; }
      updates.logoBase64 = b.logoBase64;
    }

    const [template] = await db.update(reportTemplatesTable).set(updates)
      .where(eq(reportTemplatesTable.id, id)).returning();

    res.json({ success: true, template });
  } catch (err) {
    logger.error({ err }, "Error updating report template");
    res.status(500).json({ error: "Error actualizando plantilla" });
  }
});

router.delete("/report-templates/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const userId = req.session.userId;
    const [existing] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.id, id));
    if (!existing) { res.status(404).json({ error: "No encontrada" }); return; }
    if (existing.userId !== userId) { res.status(403).json({ error: "Sin permiso" }); return; }
    await db.delete(reportTemplatesTable).where(eq(reportTemplatesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting report template");
    res.status(500).json({ error: "Error eliminando plantilla" });
  }
});

router.post("/report-templates/ai-suggest", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, instagram, companyName } = req.body;
    if (!url && !instagram && !companyName) {
      res.status(400).json({ error: "Proporciona URL, Instagram o nombre" });
      return;
    }

    enableLongRunning(res);

    const { askGeminiWithSearch, isGeminiSearchBlocked } = await import("../lib/gemini.js");
    const searchName = companyName || url || instagram;

    const result = await askGeminiWithSearch(
      `Research "${searchName}" ${url ? `(${url})` : ""} ${instagram ? `@${instagram}` : ""}. 
       Analyze their brand identity and suggest a report template design.
       Return ONLY JSON: {
         "companyName": "detected name",
         "primaryColor": "#hex (brand main color)",
         "secondaryColor": "#hex (dark background)",
         "accentColor": "#hex (success/positive color)",
         "textColor": "#hex (readable on bg)",
         "bgColor": "#hex (page background)",
         "cardBg": "#hex (card background)",
         "borderColor": "#hex (subtle border)",
         "headingFont": "Google Font name for headings",
         "bodyFont": "Google Font name for body",
         "coverStyle": "centered or left-aligned",
         "sectionStyle": "card or accent-bar",
         "tagline": "suggested tagline for reports",
         "reasoning": "why these design choices match the brand"
       }`,
      "Brand design analyst. Return ONLY valid JSON. Use real hex colors from the brand."
    );

    let suggestion: Record<string, unknown> = {};
    try {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) suggestion = JSON.parse(match[0]);
    } catch { /* ignore parse errors */ }

    res.json({ success: true, suggestion });
  } catch (err) {
    logger.error({ err }, "Error in AI template suggestion");
    res.status(500).json({ error: "Error generando sugerencia IA" });
  }
});

export default router;
