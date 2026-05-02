/**
 * Card Studio — orchestrator del pipeline de generación de tarjetas.
 *
 * Pipeline (5 capas):
 *  1. Fondo: IA (Recraft v3 / Imagen 4) o sólido/degradado vía CSS
 *  2. Logo: opcional (Sharp overlay)
 *  3. Texto vectorial: HTML+Puppeteer renderiza capa transparente
 *  4. QR funcional: npm `qrcode`
 *  5. Composición: Sharp combina capas a 300 DPI, exporta PNG/PDF
 */
import sharp from "sharp";
import { logger } from "./logger.js";
import { CARD_TEMPLATES, getTemplate, type CardTemplate, type CardPalette, type CardFonts } from "./card-templates.js";
import {
  renderCardSide,
  CARD_WIDTH_PX,
  CARD_HEIGHT_PX,
  type CardData,
} from "./card-renderer.js";
import { generateQrPng, buildVCard } from "./card-qr.js";
import { generateImage, type ImageGenModel } from "./fusion-studio-pro.js";
import { generatePdfFromHtml } from "./pdf-generator.js";

export type GenerateCardInput = {
  templateId: string;
  data: CardData;
  /** Override de paleta del template (parcial) */
  palette?: Partial<CardPalette>;
  /** Override de fuentes (parcial) */
  fonts?: Partial<CardFonts>;
  /** Config de fondo opcional (override) */
  background?: {
    kind: "solid" | "gradient" | "ai-texture";
    prompt?: string;
    hex?: string;
  };
  /** Modelo IA para fondo cuando kind === "ai-texture" */
  backgroundModel?: ImageGenModel;
  /** Override de layout del template (centered / left / grid) */
  layout?: "centered" | "left" | "grid";
  /** URL para QR (si no se provee, se genera vCard con email/phone) */
  qrUrl?: string;
  /** Logo PNG buffer opcional */
  logoBuffer?: Buffer;
  logoMime?: string;
  /** Token Replicate (override) */
  replicateToken?: string;
};

export type GenerateCardResult = {
  frontPng: Buffer;
  backPng: Buffer;
  /** Coste estimado en USD */
  cost: number;
  meta: {
    templateId: string;
    backgroundKind: string;
    backgroundModel?: string;
    qrSource: "url" | "vcard";
    qrData: string;
    width: number;
    height: number;
  };
};

const DEFAULT_BG_MODEL: ImageGenModel = "recraft-v3";

export async function generateBusinessCard(
  input: GenerateCardInput,
): Promise<GenerateCardResult> {
  const baseTemplate = getTemplate(input.templateId);
  if (!baseTemplate) throw new Error(`Plantilla desconocida: ${input.templateId}`);

  // Aplicar override de layout (si se provee) clonando el template para no mutar el catálogo
  const template = input.layout && input.layout !== baseTemplate.layout
    ? { ...baseTemplate, layout: input.layout }
    : baseTemplate;

  const palette: CardPalette = { ...template.palette, ...(input.palette || {}) };
  const fonts: CardFonts = { ...template.fonts, ...(input.fonts || {}) };

  // ── Resolver background ─────────────────────────────────────────────
  const bgConfig = input.background ?? template.background;
  const bgModel = input.backgroundModel ?? DEFAULT_BG_MODEL;
  let backgroundPng: Buffer | null = null;
  let cost = 0;
  let bgKindUsed = bgConfig.kind;
  let bgModelUsed: string | undefined;

  if (bgConfig.kind === "ai-texture") {
    try {
      const promptToUse = bgConfig.prompt || template.background.prompt || "premium business card background, no text, photorealistic";
      logger.info({ model: bgModel, promptPreview: promptToUse.slice(0, 80) }, "card-studio: generating AI background");
      const out = await generateImage(bgModel, promptToUse, {
        aspectRatio: "3:2",
        replicateToken: input.replicateToken,
        // ANTI-TEXT: refuerzo en negative prompt
        negativePrompt: "text, letters, words, typography, watermark, logo, signature, characters, alphabet, symbols",
      });
      backgroundPng = await sharp(out.buffer)
        .resize(CARD_WIDTH_PX, CARD_HEIGHT_PX, { fit: "cover", position: "center" })
        .png()
        .toBuffer();
      bgModelUsed = out.model;
      // Coste aproximado del modelo
      const { IMAGE_MODELS } = await import("./fusion-studio-pro.js");
      cost += IMAGE_MODELS[bgModel]?.costPerImage ?? 0.05;
    } catch (err: any) {
      logger.warn({ err: err?.message, model: bgModel }, "card-studio: AI bg failed — fallback to solid");
      bgKindUsed = "solid";
      backgroundPng = await renderSolidOrGradient(palette, "solid");
    }
  } else if (bgConfig.kind === "gradient") {
    backgroundPng = await renderSolidOrGradient(palette, "gradient", template.background.gradientAngle);
  } else {
    const overrideHex = (bgConfig as { hex?: string }).hex;
    backgroundPng = await renderSolidOrGradient(palette, "solid", undefined, overrideHex);
  }

  // ── Logo opcional como data URI ─────────────────────────────────────
  let logoDataUri: string | undefined;
  if (input.logoBuffer && input.logoBuffer.length > 0) {
    const mime = input.logoMime || "image/png";
    logoDataUri = `data:${mime};base64,${input.logoBuffer.toString("base64")}`;
  }

  // ── QR data ────────────────────────────────────────────────────────
  const useUrl = !!(input.qrUrl && input.qrUrl.trim().length > 0);
  const qrData = useUrl
    ? input.qrUrl!.trim()
    : buildVCard({
        fullName: input.data.fullName,
        jobTitle: input.data.jobTitle ?? undefined,
        organization: input.data.companyName ?? undefined,
        email: input.data.email ?? undefined,
        phone: input.data.phone ?? undefined,
        website: input.data.website ?? undefined,
        address: input.data.address ?? undefined,
      });

  const qrPng = await generateQrPng(qrData, {
    fgColor: template.qrStyle.fgColor,
    bgColor: template.qrStyle.bgColor,
    margin: template.qrStyle.margin,
    size: 760,
    errorLevel: "H",
  });
  const qrPngBase64 = qrPng.toString("base64");

  // ── Renderizar capa de texto (transparente) ─────────────────────────
  const transparent = bgKindUsed === "ai-texture";
  const frontTextLayer = await renderCardSide(template, input.data, {
    side: "front",
    transparent,
    palette,
    fonts,
    logoDataUri,
  });
  const backTextLayer = await renderCardSide(template, input.data, {
    side: "back",
    transparent,
    palette,
    fonts,
    qrPngBase64,
  });

  // ── Composición Sharp ───────────────────────────────────────────────
  const frontPng = transparent && backgroundPng
    ? await composeOver(backgroundPng, frontTextLayer)
    : frontTextLayer;

  const backPng = transparent && backgroundPng
    ? await composeOver(backgroundPng, backTextLayer)
    : backTextLayer;

  return {
    frontPng,
    backPng,
    cost,
    meta: {
      templateId: template.id,
      backgroundKind: bgKindUsed,
      backgroundModel: bgModelUsed,
      qrSource: useUrl ? "url" : "vcard",
      qrData,
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function renderSolidOrGradient(
  palette: CardPalette,
  kind: "solid" | "gradient",
  angle = 135,
  overrideHex?: string,
): Promise<Buffer> {
  if (kind === "solid") {
    const color = overrideHex || palette.bg;
    const rgb = hexToRgb(color);
    return await sharp({
      create: {
        width: CARD_WIDTH_PX,
        height: CARD_HEIGHT_PX,
        channels: 4,
        background: { r: rgb.r, g: rgb.g, b: rgb.b, alpha: 1 },
      },
    }).png().toBuffer();
  }
  // gradient via SVG → PNG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH_PX}" height="${CARD_HEIGHT_PX}">
    <defs>
      <linearGradient id="g" gradientTransform="rotate(${angle},0.5,0.5)">
        <stop offset="0%" stop-color="${palette.bg}"/>
        <stop offset="100%" stop-color="${palette.accent}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function composeOver(background: Buffer, overlay: Buffer): Promise<Buffer> {
  return await sharp(background)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r: r || 0, g: g || 0, b: b || 0 };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0,
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * Genera un PDF imprimible (A4 horizontal con front+back lado a lado +
 * marcas de corte). Los buffers PNG se embeben en base64.
 */
export async function generatePrintablePdf(
  frontPng: Buffer,
  backPng: Buffer,
  title: string,
): Promise<Buffer> {
  const frontB64 = frontPng.toString("base64");
  const backB64 = backPng.toString("base64");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, sans-serif; }
  .sheet { width: 297mm; height: 210mm; padding: 12mm; box-sizing: border-box; }
  .row { display: flex; gap: 14mm; align-items: flex-start; justify-content: center; }
  .card-block { display: flex; flex-direction: column; gap: 4mm; }
  .label { font-size: 10pt; color: #666; letter-spacing: 1.2px; text-transform: uppercase; text-align: center; }
  .card-frame {
    width: 91mm; height: 61mm;
    background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%);
    background-size: 6px 6px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .card-frame img { width: 100%; height: 100%; display: block; object-fit: cover; }
  .crop-mark { position: absolute; background: #000; }
  .crop-tl-h { top: 0; left: -3mm; width: 3mm; height: 0.3mm; }
  .crop-tl-v { top: -3mm; left: 0; width: 0.3mm; height: 3mm; }
  .crop-tr-h { top: 0; right: -3mm; width: 3mm; height: 0.3mm; }
  .crop-tr-v { top: -3mm; right: 0; width: 0.3mm; height: 3mm; }
  .crop-bl-h { bottom: 0; left: -3mm; width: 3mm; height: 0.3mm; }
  .crop-bl-v { bottom: -3mm; left: 0; width: 0.3mm; height: 3mm; }
  .crop-br-h { bottom: 0; right: -3mm; width: 3mm; height: 0.3mm; }
  .crop-br-v { bottom: -3mm; right: 0; width: 0.3mm; height: 3mm; }
  .doc-title { text-align: center; font-size: 14pt; color: #333; margin-bottom: 8mm; font-weight: 600; }
  .specs { font-size: 8pt; color: #999; text-align: center; margin-top: 6mm; }
</style></head><body>
<div class="sheet">
  <div class="doc-title">${title} — Print Sheet</div>
  <div class="row">
    <div class="card-block">
      <div class="card-frame">
        <span class="crop-mark crop-tl-h"></span><span class="crop-mark crop-tl-v"></span>
        <span class="crop-mark crop-tr-h"></span><span class="crop-mark crop-tr-v"></span>
        <span class="crop-mark crop-bl-h"></span><span class="crop-mark crop-bl-v"></span>
        <span class="crop-mark crop-br-h"></span><span class="crop-mark crop-br-v"></span>
        <img src="data:image/png;base64,${frontB64}" alt="Front" />
      </div>
      <div class="label">Frente</div>
    </div>
    <div class="card-block">
      <div class="card-frame">
        <span class="crop-mark crop-tl-h"></span><span class="crop-mark crop-tl-v"></span>
        <span class="crop-mark crop-tr-h"></span><span class="crop-mark crop-tr-v"></span>
        <span class="crop-mark crop-bl-h"></span><span class="crop-mark crop-bl-v"></span>
        <span class="crop-mark crop-br-h"></span><span class="crop-mark crop-br-v"></span>
        <img src="data:image/png;base64,${backB64}" alt="Back" />
      </div>
      <div class="label">Reverso</div>
    </div>
  </div>
  <div class="specs">
    Tamaño físico: 85×55mm · Sangrado: 3mm · 300 DPI · Listo para imprenta · CMYK opcional
  </div>
</div>
</body></html>`;

  // Renderiza HTML a PDF directamente con puppeteer (no usa el response stream)
  const { default: puppeteer } = await import("puppeteer-core");
  const CHROMIUM_PATH =
    process.env.CHROMIUM_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    try { await browser.close(); } catch {}
  }
}

/**
 * Auto-design: pide a Claude que proponga template + paleta + fonts
 * a partir de inputs mínimos (industria, vibe, color preferido).
 */
export async function autoDesignCard(input: {
  industry?: string;
  vibe?: string;
  preferredColor?: string;
  brandName?: string;
}): Promise<{
  templateId: string;
  palette: CardPalette;
  fonts: CardFonts;
  background: { kind: "solid" | "gradient" | "ai-texture"; prompt?: string };
  rationale: string;
}> {
  const { askClaudeJson } = await import("./claude.js");
  const templatesList = Object.values(CARD_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
  }));

  const system = `Eres un brand designer senior especializado en tarjetas de presentación premium para ejecutivos y agencias creativas. Conoces la psicología del color, jerarquía tipográfica y los códigos visuales de cada industria. Devuelves SIEMPRE JSON válido sin markdown.`;

  const user = `INPUT:
- Industria: ${input.industry || "(no especificada)"}
- Vibe / personalidad: ${input.vibe || "(profesional)"}
- Color preferido: ${input.preferredColor || "(libre)"}
- Marca: ${input.brandName || "(sin marca)"}

TEMPLATES DISPONIBLES:
${JSON.stringify(templatesList, null, 2)}

TAREA: Elige el template más apropiado y propón override de paleta + fonts + background (kind + prompt textless si ai-texture).

REGLAS:
- Paleta: 5 colores hex (bg, primary, secondary, accent, text). Contraste WCAG AA mínimo entre bg y primary.
- Fonts: nombres exactos de Google Fonts. heading + body, weights opcional.
- Background prompt (si ai-texture): describe textura/superficie, SIN texto/letras/logos.
- Rationale: 2-3 frases en español justificando elecciones (psicología del color, fit con industria).

DEVUELVE JSON:
{
  "templateId": "elite-executive" | "minimalist-mono" | "luxury-foil" | "creative-bold" | "corporate-clean" | "tech-dark",
  "palette": { "bg": "#hex", "primary": "#hex", "secondary": "#hex", "accent": "#hex", "text": "#hex" },
  "fonts": { "heading": "GoogleFontName", "body": "GoogleFontName", "weights": { "heading": 700, "body": 400 } },
  "background": { "kind": "solid" | "gradient" | "ai-texture", "prompt": "..." },
  "rationale": "..."
}`;

  // signature: askClaudeJson(projectId, userPrompt, systemPrompt, maxTokens?, timeoutMs?, opts?)
  const out = await askClaudeJson<any>(0, user, system);
  if (!out || !out.templateId || !CARD_TEMPLATES[out.templateId]) {
    throw new Error("auto-design: respuesta IA inválida");
  }
  return out;
}
