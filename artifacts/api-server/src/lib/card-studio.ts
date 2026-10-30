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
} from "./card-renderer.js";
import type { CardData, LayoutOverrides } from "./card-elements.js";
import { buildVCard } from "./card-qr.js";
import { renderVerifiedQr, sanitizeQrStyle } from "./card-qr-art.js";
import { generateImage, type ImageGenModel } from "./fusion-studio-pro.js";
import { generatePdfFromHtml } from "./pdf-generator.js";
import { guardHeadlessPage } from "./headless-guard.js";

export type GenerateCardInput = {
  templateId: string;
  data: CardData;
  /** Override de paleta del template (parcial) */
  palette?: Partial<CardPalette>;
  /** Override de fuentes (parcial) */
  fonts?: Partial<CardFonts>;
  /** Config de fondo opcional (override) */
  background?: {
    kind: "solid" | "gradient" | "ai-texture" | "custom-image";
    prompt?: string;
    hex?: string;
    vaultFileId?: number;
  };
  /** Buffer de imagen para fondos custom-image (foto subida por el usuario) */
  backgroundImageBuffer?: Buffer;
  backgroundImageMime?: string;
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
  /** Overrides del editor visual (posiciones / extras) */
  overrides?: LayoutOverrides;
  /** Estilo del QR principal (sin validar: se sanea aquí sobre los colores de la plantilla). */
  qrStyle?: unknown;
  /** Texto bajo el QR del reverso. */
  qrLabel?: string;
  /** Imágenes ya resueltas de los extras (QR generados/subidos), clave "extra-<id>". */
  extraAssets?: Record<string, string>;
  /** Fondo propio de cada cara (diseño o IA del editor); sustituye al fondo general en esa cara. */
  sideBackgrounds?: { front?: Buffer; back?: Buffer };
};

export type GenerateCardResult = {
  frontPng: Buffer;
  backPng: Buffer;
  /** Solo el fondo (sin texto/QR/logo) — para el editor visual */
  backgroundPng?: Buffer;
  /** QR PNG generado */
  qrPng?: Buffer;
  /** Coste estimado en USD */
  cost: number;
  meta: {
    templateId: string;
    backgroundKind: string;
    backgroundModel?: string;
    bgGenFailed?: boolean;
    bgGenError?: string;
    qrSource: "url" | "vcard";
    qrData: string;
    /** El QR del reverso se ha leído y coincide con su contenido. */
    qrVerified: boolean;
    qrWarnings: string[];
    width: number;
    height: number;
  };
};

const DEFAULT_BG_MODEL: ImageGenModel = "recraft-v4";

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
  let bgGenFailed = false;
  let bgGenError: string | undefined;

  if (bgConfig.kind === "ai-texture") {
    try {
      const userPrompt = (bgConfig.prompt || template.background.prompt || "premium business card background").trim();
      // Potenciar el prompt con xAI para obtener texturas de fondo más sofisticadas
      const smartPrompt = await enhanceCardBackgroundPrompt(userPrompt, {
        palette,
        fonts,
        category: template.category,
        layout: template.layout,
        companyName: input.data.companyName,
        jobTitle: input.data.jobTitle,
      });
      // Refuerzo anti-texto en el prompt mismo (algunos modelos ignoran negativePrompt)
      const promptToUse = `${smartPrompt}, ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS, pure background texture only, even lighting suitable for overlay text, photorealistic, 8k`;
      logger.info({ model: bgModel, promptPreview: promptToUse.slice(0, 100) }, "card-studio: generating AI background");
      const out = await generateImage(bgModel, promptToUse, {
        aspectRatio: "3:2",
        replicateToken: input.replicateToken,
        negativePrompt: "text, letters, words, typography, watermark, logo, signature, characters, alphabet, symbols, writing, label, caption, title, lorem ipsum",
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
      bgGenFailed = true;
      bgGenError = err?.message || "Error generando fondo IA";
      backgroundPng = await renderSolidOrGradient(palette, "solid");
    }
  } else if (bgConfig.kind === "custom-image") {
    if (input.backgroundImageBuffer && input.backgroundImageBuffer.length > 0) {
      backgroundPng = await sharp(input.backgroundImageBuffer)
        .resize(CARD_WIDTH_PX, CARD_HEIGHT_PX, { fit: "cover", position: "center" })
        .png()
        .toBuffer();
    } else {
      // Si no hay buffer cae a sólido
      backgroundPng = await renderSolidOrGradient(palette, "solid");
      bgKindUsed = "solid";
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

  const qrStyle = sanitizeQrStyle(input.qrStyle, {
    fg: template.qrStyle.fgColor, fg2: template.qrStyle.fgColor,
    bg: template.qrStyle.bgColor, margin: template.qrStyle.margin,
  });
  const qr = await renderVerifiedQr(qrData, qrStyle, { size: 760, logoDataUri });
  const qrPng = qr.png;
  const qrPngBase64 = qrPng.toString("base64");

  // ── Fondos por cara (editor) ────────────────────────────────────────
  const toCardSize = (b: Buffer) => sharp(b).resize(CARD_WIDTH_PX, CARD_HEIGHT_PX, { fit: "cover", position: "center" }).png().toBuffer();
  const sideBg = {
    front: input.sideBackgrounds?.front?.length ? await toCardSize(input.sideBackgrounds.front) : null,
    back: input.sideBackgrounds?.back?.length ? await toCardSize(input.sideBackgrounds.back) : null,
  };

  // ── Renderizar capa de texto (transparente) ─────────────────────────
  const transparent = bgKindUsed === "ai-texture" || bgKindUsed === "custom-image";
  const isAiBackground = bgKindUsed === "ai-texture" || bgKindUsed === "custom-image";
  const frontTextLayer = await renderCardSide(template, input.data, {
    side: "front",
    transparent: transparent || !!sideBg.front,
    palette,
    fonts,
    logoDataUri,
    overrides: input.overrides,
    isAiBackground: isAiBackground || !!sideBg.front,
    extraAssets: input.extraAssets,
  });
  const backTextLayer = await renderCardSide(template, input.data, {
    side: "back",
    transparent: transparent || !!sideBg.back,
    palette,
    fonts,
    qrPngBase64,
    overrides: input.overrides,
    isAiBackground: isAiBackground || !!sideBg.back,
    qrLabel: input.qrLabel,
    extraAssets: input.extraAssets,
  });

  // ── Composición Sharp ───────────────────────────────────────────────
  const frontPng = sideBg.front
    ? await composeOver(sideBg.front, frontTextLayer)
    : transparent && backgroundPng ? await composeOver(backgroundPng, frontTextLayer) : frontTextLayer;

  const backPng = sideBg.back
    ? await composeOver(sideBg.back, backTextLayer)
    : transparent && backgroundPng ? await composeOver(backgroundPng, backTextLayer) : backTextLayer;

  return {
    frontPng,
    backPng,
    backgroundPng: backgroundPng ?? undefined,
    qrPng,
    cost,
    meta: {
      templateId: template.id,
      backgroundKind: bgKindUsed,
      backgroundModel: bgModelUsed,
      bgGenFailed,
      bgGenError,
      qrSource: useUrl ? "url" : "vcard",
      qrData,
      qrVerified: qr.verified,
      qrWarnings: qr.warnings,
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
    .withMetadata({ density: 300 })
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
  const safeTitle = String(title || "Tarjeta")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Marcas de corte FUERA de la imagen, alineadas con la línea de corte (3 mm dentro del sangrado).
  const marks = [
    // [left, top, width, height] en mm relativos al marco de 91×61 mm
    [-6, 3, 4.5, 0.25], [-6, 58, 4.5, 0.25], [92.5, 3, 4.5, 0.25], [92.5, 58, 4.5, 0.25],
    [3, -6, 0.25, 4.5], [88, -6, 0.25, 4.5], [3, 62.5, 0.25, 4.5], [88, 62.5, 0.25, 4.5],
  ].map(([l, t, w, h]) => `<span class="crop" style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"></span>`).join("");
  const block = (b64: string, label: string) => `
    <div class="card-block">
      <div class="card-frame">${marks}<img src="data:image/png;base64,${b64}" alt="${label}" /></div>
      <div class="label">${label}</div>
    </div>`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
  .sheet { width: 297mm; height: 210mm; padding: 16mm 12mm; box-sizing: border-box; }
  .doc-title { text-align: center; font-size: 14pt; color: #333; margin-bottom: 12mm; font-weight: 600; }
  .row { display: flex; gap: 24mm; align-items: flex-start; justify-content: center; }
  .card-block { display: flex; flex-direction: column; gap: 9mm; align-items: center; }
  .card-frame { width: 91mm; height: 61mm; position: relative; }
  .card-frame img { width: 91mm; height: 61mm; display: block; }
  .crop { position: absolute; background: #000; }
  .label { font-size: 10pt; color: #666; letter-spacing: 1.2px; text-transform: uppercase; text-align: center; }
  .specs { font-size: 8pt; color: #888; text-align: center; margin-top: 12mm; line-height: 1.6; }
</style></head><body>
<div class="sheet">
  <div class="doc-title">${safeTitle} — Hoja de impresión</div>
  <div class="row">${block(frontB64, "Frente")}${block(backB64, "Reverso")}</div>
  <div class="specs">
    Formato final 85×55 mm · Sangrado 3 mm por lado (archivo 91×61 mm) · 1080×720 px ≈ 300 ppp · RGB<br/>
    Imprimir al 100 % (sin "ajustar a página"); cortar por las marcas.
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
    await guardHeadlessPage(page);
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // puppeteer 25: setContent ya no admite networkidle0; se espera a que no queden peticiones (fuentes, imágenes).
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 });
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

/**
 * Potencia el prompt de fondo con xAI (grok-3-mini-fast) para obtener
 * texturas más sofisticadas y coherentes con el sistema de diseño de la tarjeta.
 * Si falla, devuelve el prompt original sin interrumpir el pipeline.
 */
/**
 * Genera solo la imagen de fondo (sin texto, QR ni logo).
 * Útil para el endpoint /generate-bg (per-side background change).
 */
export async function generateCardBackground(
  prompt: string,
  bgModel?: ImageGenModel,
  replicateToken?: string,
): Promise<Buffer> {
  const model: ImageGenModel = bgModel || DEFAULT_BG_MODEL;
  const promptToUse = `${prompt.trim()}, ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS, pure background texture only, even lighting suitable for overlay text, photorealistic, 8k`;
  const out = await generateImage(model, promptToUse, {
    aspectRatio: "3:2",
    replicateToken,
    negativePrompt: "text, letters, words, typography, watermark, logo, signature, characters, alphabet, symbols, writing, label, caption, title, lorem ipsum",
  });
  return await sharp(out.buffer)
    .resize(CARD_WIDTH_PX, CARD_HEIGHT_PX, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
}

async function enhanceCardBackgroundPrompt(
  userPrompt: string,
  ctx: {
    palette: CardPalette;
    fonts: CardFonts;
    category: string;
    layout: string;
    companyName?: string | null;
    jobTitle?: string | null;
  },
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  if (!apiKey) return userPrompt; // sin key → pass-through

  // Si el prompt ya es largo y descriptivo, no lo toquemos
  if (userPrompt.length > 180) return userPrompt;

  try {
    const systemMsg = `You are a professional art director specializing in premium business card backgrounds for high-end print. You transform simple user prompts into precise, cinematic texture descriptions that generate stunning backgrounds via AI image models. Return ONLY the enhanced prompt text — no explanation, no quotes, no JSON.`;

    const userMsg = `ORIGINAL PROMPT: "${userPrompt}"

CARD DESIGN CONTEXT:
- Category: ${ctx.category}
- Layout: ${ctx.layout}
- Primary color: ${ctx.palette.primary}
- Background color: ${ctx.palette.bg}
- Accent color: ${ctx.palette.accent}
- Heading font: ${ctx.fonts.heading}
${ctx.companyName ? `- Company: ${ctx.companyName}` : ""}
${ctx.jobTitle ? `- Role: ${ctx.jobTitle}` : ""}

Transform the prompt into a rich, specific texture/material description suitable as a business card background. Include: material type, lighting direction, depth, micro-details, mood. Keep it under 200 characters. Do NOT include text, letters, words, logos, or human faces.`;

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini-fast",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        max_tokens: 120,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(8000), // 8s timeout — no bloquear el pipeline
    });

    if (!res.ok) return userPrompt;
    const data = await res.json() as any;
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (enhanced && enhanced.length > 20) {
      logger.info({ original: userPrompt.slice(0, 60), enhanced: enhanced.slice(0, 80) }, "card-studio: prompt enhanced by xAI");
      return enhanced;
    }
    return userPrompt;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "card-studio: prompt enhancement failed — using original");
    return userPrompt;
  }
}
