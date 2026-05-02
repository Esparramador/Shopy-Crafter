/**
 * Card renderer — usa Puppeteer para renderizar HTML+CSS de la tarjeta a PNG
 * con texto VECTORIAL perfecto a 300 DPI.
 *
 * Modo "transparent": renderiza solo la capa de texto+QR sobre fondo transparente
 * para luego componer encima de un fondo IA con Sharp.
 *
 * Modo "full": renderiza la tarjeta completa (fondo CSS + texto + QR) en una
 * sola pasada — usado cuando el background es solid/gradient (sin IA).
 */
import { logger } from "./logger.js";
import { CARD_TEMPLATES, type CardTemplate, type CardPalette, type CardFonts } from "./card-templates.js";

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

// Tamaño físico estándar EU: 85mm × 55mm @ 300 DPI = 1004 × 650 px
// Con bleed 3mm: 91mm × 61mm = 1075 × 720 px
export const CARD_WIDTH_PX = 1080;
export const CARD_HEIGHT_PX = 720;
export const CARD_BLEED_PX = 36; // 3mm @ 300 DPI ≈ 35.4 px
export const CARD_SAFE_ZONE_PX = 84; // 7mm desde el borde sangrado

export type CardData = {
  fullName: string;
  jobTitle?: string | null;
  companyName?: string | null;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  socialHandle?: string | null;
  address?: string | null;
};

export type RenderOptions = {
  /** "front" o "back" — define el contenido renderizado */
  side: "front" | "back";
  /** Si true, fondo transparente (para componer sobre fondo IA después) */
  transparent: boolean;
  /** Override de paleta del template */
  palette?: Partial<CardPalette>;
  /** Override de fuentes del template */
  fonts?: Partial<CardFonts>;
  /** PNG buffer del QR a embeber (back) — si null/undefined no se muestra */
  qrPngBase64?: string;
  /** Logo opcional como data URI */
  logoDataUri?: string;
};

let _browserPromise: Promise<any> | null = null;

async function getBrowser(): Promise<any> {
  if (_browserPromise) return _browserPromise;
  _browserPromise = (async () => {
    const puppeteer = await import("puppeteer-core");
    return puppeteer.default.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
        "--force-color-profile=srgb",
      ],
    });
  })();
  // Cierre limpio cuando el proceso termine
  process.on("beforeExit", async () => {
    try {
      const b = await _browserPromise;
      if (b) await b.close();
    } catch {}
  });
  return _browserPromise;
}

/**
 * Renderiza un lado de la tarjeta (front o back) y devuelve un PNG buffer.
 */
export async function renderCardSide(
  template: CardTemplate,
  data: CardData,
  opts: RenderOptions,
): Promise<Buffer> {
  const palette: CardPalette = { ...template.palette, ...(opts.palette || {}) };
  const fonts: CardFonts = { ...template.fonts, ...(opts.fonts || {}) };
  const html = buildHtml({ template, palette, fonts, data, opts });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
      deviceScaleFactor: 1,
    });

    // Para transparencia
    if (opts.transparent) {
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    }

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    // Espera explícita a que las Google Fonts se hayan cargado
    await page.evaluate(async () => {
      try {
        // @ts-ignore — corre en contexto del browser (chromium), no del runtime Node
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      } catch {}
    });

    const buf = (await page.screenshot({
      type: "png",
      omitBackground: opts.transparent,
      clip: { x: 0, y: 0, width: CARD_WIDTH_PX, height: CARD_HEIGHT_PX },
    })) as Buffer;

    logger.info(
      { templateId: template.id, side: opts.side, transparent: opts.transparent, bytes: buf.length },
      "card-renderer: side rendered",
    );
    return buf;
  } finally {
    try { await page.close(); } catch {}
  }
}

/**
 * Cierra el navegador (llamar al hacer shutdown limpio o tests).
 */
export async function closeRendererBrowser(): Promise<void> {
  if (!_browserPromise) return;
  try {
    const b = await _browserPromise;
    if (b) await b.close();
  } catch {}
  _browserPromise = null;
}

// ──────────────────────────────────────────────────────────────────────────
// HTML builder
// ──────────────────────────────────────────────────────────────────────────

function buildHtml(args: {
  template: CardTemplate;
  palette: CardPalette;
  fonts: CardFonts;
  data: CardData;
  opts: RenderOptions;
}): string {
  const { template, palette, fonts, data, opts } = args;

  const headingFamily = `'${fonts.heading}'`;
  const bodyFamily = `'${fonts.body}'`;
  const headingWeight = fonts.weights?.heading ?? 700;
  const bodyWeight = fonts.weights?.body ?? 400;

  const fontsParam = uniqueFonts([fonts.heading, fonts.body])
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800&display=block`)
    .join("&");
  const fontsLink = `https://fonts.googleapis.com/css2?${fontsParam}`;

  // Fondo:
  //  - transparent: rgba(0,0,0,0)
  //  - solid: palette.bg
  //  - gradient: linear-gradient
  //  - ai-texture: transparent (Sharp lo compone después)
  let bgCss = palette.bg;
  if (opts.transparent || template.background.kind === "ai-texture") {
    bgCss = "transparent";
  } else if (template.background.kind === "gradient") {
    const angle = template.background.gradientAngle ?? 135;
    bgCss = `linear-gradient(${angle}deg, ${palette.bg} 0%, ${palette.accent} 100%)`;
  }

  const inner = opts.side === "front"
    ? buildFrontInner({ palette, fonts, data, template, headingFamily, bodyFamily, headingWeight, bodyWeight, logoDataUri: opts.logoDataUri })
    : buildBackInner({ palette, fonts, data, template, headingFamily, bodyFamily, headingWeight, bodyWeight, qrPngBase64: opts.qrPngBase64 });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsLink}" rel="stylesheet">
<style>
  * { box-sizing: border-box; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${CARD_WIDTH_PX}px;
    height: ${CARD_HEIGHT_PX}px;
    background: ${bgCss};
    color: ${palette.text};
    font-family: ${bodyFamily}, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-weight: ${bodyWeight};
    overflow: hidden;
    position: relative;
  }
  .card {
    position: absolute;
    inset: 0;
    padding: ${CARD_SAFE_ZONE_PX}px;
    display: flex;
    flex-direction: column;
  }
  .h-name {
    font-family: ${headingFamily}, serif;
    font-weight: ${headingWeight};
    color: ${palette.primary};
    letter-spacing: 0.5px;
    line-height: 1.05;
    margin: 0;
  }
  .h-title {
    font-family: ${bodyFamily}, sans-serif;
    font-weight: 500;
    color: ${palette.secondary};
    letter-spacing: 4px;
    text-transform: uppercase;
    margin: 0;
  }
  .h-tagline {
    font-family: ${bodyFamily}, sans-serif;
    color: ${palette.text};
    line-height: 1.4;
    margin: 0;
    opacity: 0.92;
  }
  .h-contact {
    font-family: ${bodyFamily}, sans-serif;
    color: ${palette.text};
    line-height: 1.7;
    margin: 0;
    font-size: 22px;
  }
  .h-contact a, .h-contact span {
    color: ${palette.text};
    text-decoration: none;
  }
  .accent-line {
    height: 2px;
    background: ${palette.accent};
    border-radius: 2px;
  }
  ${opts.side === "front" ? frontLayoutCss(template) : backLayoutCss(template)}
</style>
</head>
<body>
  <div class="card">
${inner}
  </div>
</body>
</html>`;
}

function uniqueFonts(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Layout CSS específico de FRONT por template.layout ─────────────────────
function frontLayoutCss(template: CardTemplate): string {
  switch (template.layout) {
    case "left":
      return `
        .card { justify-content: center; align-items: flex-start; gap: 18px; }
        .h-name { font-size: 78px; }
        .h-title { font-size: 18px; }
        .h-tagline { font-size: 24px; max-width: 90%; }
        .accent-line { width: 100px; }
      `;
    case "grid":
      return `
        .card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 24px; }
        .grid-main { display: flex; flex-direction: column; gap: 14px; }
        .h-name { font-size: 64px; }
        .h-title { font-size: 16px; }
        .h-tagline { font-size: 20px; max-width: 100%; }
      `;
    case "centered":
    default:
      return `
        .card { justify-content: center; align-items: center; text-align: center; gap: 16px; }
        .h-name { font-size: 88px; }
        .h-title { font-size: 20px; }
        .h-tagline { font-size: 26px; max-width: 78%; }
        .accent-line { width: 120px; margin: 4px auto; }
      `;
  }
}

function backLayoutCss(template: CardTemplate): string {
  return `
    .back-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      width: 100%;
      height: 100%;
      align-items: center;
    }
    .back-layout.qr-only {
      grid-template-columns: 1fr;
      justify-items: center;
      align-items: center;
    }
    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .qr-img {
      width: 380px;
      height: 380px;
      object-fit: contain;
      display: block;
      border-radius: ${template.qrStyle.cornerRadius ?? 0}px;
    }
    .qr-label {
      font-family: ${template.fonts.body}, sans-serif;
      font-size: 14px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: ${template.palette.secondary};
    }
    .contact-block {
      display: flex;
      flex-direction: column;
      gap: 14px;
      justify-content: center;
    }
    .contact-block .row {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      color: ${template.palette.text};
      line-height: 1.4;
    }
    .contact-block .icon {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: ${template.palette.accent};
      flex-shrink: 0;
      font-size: 22px;
    }
    .back-brand {
      font-family: ${template.fonts.heading}, serif;
      font-weight: ${template.fonts.weights?.heading ?? 700};
      color: ${template.palette.primary};
      font-size: 32px;
      margin-bottom: 8px;
    }
  `;
}

function buildFrontInner(args: {
  palette: CardPalette;
  fonts: CardFonts;
  data: CardData;
  template: CardTemplate;
  headingFamily: string;
  bodyFamily: string;
  headingWeight: number;
  bodyWeight: number;
  logoDataUri?: string;
}): string {
  const { data, template } = args;
  const company = escapeHtml(data.companyName);
  const name = escapeHtml(data.fullName);
  const role = escapeHtml(data.jobTitle);
  const tagline = escapeHtml(data.tagline);

  if (template.layout === "grid") {
    return `
      <div class="grid-main">
        ${company ? `<div class="back-brand">${company}</div>` : ""}
        <h1 class="h-name">${name}</h1>
        ${role ? `<div class="h-title">${role}</div>` : ""}
        <div class="accent-line"></div>
        ${tagline ? `<p class="h-tagline">${tagline}</p>` : ""}
      </div>
      ${args.logoDataUri ? `<div><img src="${args.logoDataUri}" alt="logo" style="max-width:140px;max-height:140px;object-fit:contain;opacity:0.9"/></div>` : ""}
    `;
  }

  return `
    ${args.logoDataUri ? `<img src="${args.logoDataUri}" alt="logo" style="max-width:120px;max-height:120px;object-fit:contain;opacity:0.95;margin-bottom:8px"/>` : ""}
    ${company && template.layout !== "centered" ? `<div class="back-brand">${company}</div>` : ""}
    ${company && template.layout === "centered" ? `<div class="back-brand" style="font-size:28px;letter-spacing:2px;text-transform:uppercase;opacity:0.8">${company}</div>` : ""}
    <h1 class="h-name">${name}</h1>
    ${role ? `<div class="h-title">${role}</div>` : ""}
    <div class="accent-line"></div>
    ${tagline ? `<p class="h-tagline">${tagline}</p>` : ""}
  `;
}

function buildBackInner(args: {
  palette: CardPalette;
  fonts: CardFonts;
  data: CardData;
  template: CardTemplate;
  headingFamily: string;
  bodyFamily: string;
  headingWeight: number;
  bodyWeight: number;
  qrPngBase64?: string;
}): string {
  const { data, qrPngBase64 } = args;
  const hasContact = !!(data.email || data.phone || data.website || data.socialHandle || data.address);
  const layoutClass = !hasContact ? "qr-only" : "";
  const company = escapeHtml(data.companyName);

  const qrBlock = qrPngBase64
    ? `
      <div class="qr-wrap">
        <img src="data:image/png;base64,${qrPngBase64}" alt="QR" class="qr-img" />
        <div class="qr-label">Escanear · vCard</div>
      </div>
    `
    : `<div class="qr-wrap"><div class="qr-label">— sin QR —</div></div>`;

  const contactBlock = hasContact
    ? `
      <div class="contact-block">
        ${company ? `<div class="back-brand">${company}</div>` : ""}
        ${data.email ? `<div class="row"><span class="icon">✉</span><span>${escapeHtml(data.email)}</span></div>` : ""}
        ${data.phone ? `<div class="row"><span class="icon">☏</span><span>${escapeHtml(data.phone)}</span></div>` : ""}
        ${data.website ? `<div class="row"><span class="icon">⌘</span><span>${escapeHtml(data.website)}</span></div>` : ""}
        ${data.socialHandle ? `<div class="row"><span class="icon">@</span><span>${escapeHtml(data.socialHandle)}</span></div>` : ""}
        ${data.address ? `<div class="row"><span class="icon">⌂</span><span>${escapeHtml(data.address)}</span></div>` : ""}
      </div>
    `
    : "";

  return `
    <div class="back-layout ${layoutClass}">
      ${qrBlock}
      ${contactBlock}
    </div>
  `;
}
