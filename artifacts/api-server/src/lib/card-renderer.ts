/**
 * Card renderer — Puppeteer renderiza HTML+CSS de la tarjeta a PNG con
 * texto VECTORIAL perfecto a 300 DPI usando posicionamiento ABSOLUTO por
 * elemento. Cada elemento puede llevar overrides (editor visual) y un
 * "plate" de contraste para garantizar legibilidad sobre fondos IA.
 *
 * Modos:
 *   - transparent: capa de texto/QR sobre fondo transparente (Sharp compone luego)
 *   - full       : tarjeta completa (fondo CSS + elementos) en una sola pasada
 */
import { logger } from "./logger.js";
import type { CardTemplate, CardPalette, CardFonts } from "./card-templates.js";
import {
  CARD_W, CARD_H,
  defaultFrontElements, defaultBackElements,
  applyOverrides, extrasToRender,
  type CardData, type LayoutOverrides, type RenderElement,
} from "./card-elements.js";

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

export const CARD_WIDTH_PX = CARD_W;
export const CARD_HEIGHT_PX = CARD_H;
export const CARD_BLEED_PX = 36;
export const CARD_SAFE_ZONE_PX = 84;

export type { CardData } from "./card-elements.js";

export type RenderOptions = {
  side: "front" | "back";
  transparent: boolean;
  palette?: Partial<CardPalette>;
  fonts?: Partial<CardFonts>;
  qrPngBase64?: string;
  logoDataUri?: string;
  /** Overrides del editor visual (posiciones / textos / extras). */
  overrides?: LayoutOverrides;
  /**
   * Indica si el FONDO efectivo (resuelto en card-studio) es generado por IA.
   * Activa plates de contraste, vignette y text-shadow. Si se omite, se infiere
   * de `template.background.kind` (cubre uso directo del renderer sin overrides).
   */
  isAiBackground?: boolean;
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
  process.on("beforeExit", async () => {
    try { const b = await _browserPromise; if (b) await b.close(); } catch {}
  });
  return _browserPromise;
}

export async function renderCardSide(
  template: CardTemplate,
  data: CardData,
  opts: RenderOptions,
): Promise<Buffer> {
  const palette: CardPalette = { ...template.palette, ...(opts.palette || {}) };
  const fonts: CardFonts = { ...template.fonts, ...(opts.fonts || {}) };

  // Preferimos el flag explícito (resuelto en card-studio sobre el bg final)
  // y solo caemos al template si no se proporciona.
  const isAiBg = opts.isAiBackground ?? (template.background.kind === "ai-texture");

  // 1. Construir defaults según layout
  const defaults = opts.side === "front"
    ? defaultFrontElements({ side: "front", layout: template.layout, data, palette, fonts, isAiBg, logoDataUri: opts.logoDataUri })
    : defaultBackElements ({ side: "back",  layout: template.layout, data, palette, fonts, isAiBg, qrPngBase64: opts.qrPngBase64 });

  // 2. Aplicar overrides + concatenar extras del lado correspondiente
  const sideOverrides = opts.side === "front" ? opts.overrides?.front : opts.overrides?.back;
  const withOverrides = applyOverrides(defaults, sideOverrides);
  const extras = extrasToRender(opts.overrides?.extras, opts.side);
  const elements = [...withOverrides, ...extras].filter((e) => !e.hidden);

  // 3. Construir HTML
  const html = buildHtml({ template, palette, fonts, opts, elements });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    // Espera fonts
    await page.evaluate(async () => {
      try {
        // @ts-ignore (browser ctx)
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      } catch {}
    });
    // Auto-shrink: si algún texto desborda su caja, reduce font-size hasta encajar.
    // El cuerpo se ejecuta en el contexto del navegador (Puppeteer); por eso usamos
    // un string fn evitando que TS resuelva los símbolos DOM en el server.
    await page.evaluate(`(${(function autoShrink() {
      // @ts-ignore browser-only globals
      const nodes = document.querySelectorAll("[data-autoshrink='1']");
      // @ts-ignore
      nodes.forEach((el) => {
        // @ts-ignore
        let size = parseFloat(getComputedStyle(el).fontSize);
        let safety = 30;
        while ((el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) && size > 8 && safety-- > 0) {
          size -= 1.5;
          el.style.fontSize = size + "px";
        }
      });
    }).toString()})()`);

    const buf = (await page.screenshot({
      type: "png",
      omitBackground: opts.transparent,
      clip: { x: 0, y: 0, width: CARD_W, height: CARD_H },
    })) as Buffer;
    logger.info(
      { templateId: template.id, side: opts.side, transparent: opts.transparent, els: elements.length, bytes: buf.length },
      "card-renderer: side rendered",
    );
    return buf;
  } finally {
    try { await page.close(); } catch {}
  }
}

export async function closeRendererBrowser(): Promise<void> {
  if (!_browserPromise) return;
  try { const b = await _browserPromise; if (b) await b.close(); } catch {}
  _browserPromise = null;
}

// ── HTML builder ───────────────────────────────────────────────────────────

function buildHtml(args: {
  template: CardTemplate;
  palette: CardPalette;
  fonts: CardFonts;
  opts: RenderOptions;
  elements: RenderElement[];
}): string {
  const { template, palette, fonts, opts, elements } = args;

  // Fonts a precargar (todas las heading/body + las usadas por extras)
  const fontFamilies = new Set<string>([fonts.heading, fonts.body]);
  for (const el of elements) if (el.fontFamily) fontFamilies.add(el.fontFamily);
  const fontsParam = Array.from(fontFamilies)
    .filter(Boolean)
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800&display=block`)
    .join("&");
  const fontsLink = `https://fonts.googleapis.com/css2?${fontsParam}`;

  // Fondo
  let bgCss = palette.bg;
  if (opts.transparent || template.background.kind === "ai-texture") {
    bgCss = "transparent";
  } else if (template.background.kind === "gradient") {
    const angle = template.background.gradientAngle ?? 135;
    bgCss = `linear-gradient(${angle}deg, ${palette.bg} 0%, ${palette.accent} 100%)`;
  }

  // Vignette sutil para fondos IA (mejora legibilidad sin tapar el fondo)
  const isAi = opts.isAiBackground ?? (template.background.kind === "ai-texture");
  const vignette = isAi
    ? `<div class="vignette"></div>`
    : "";

  const elementsHtml = elements.map((el) => renderElementHtml(el, isAi)).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsLink}" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${CARD_W}px; height: ${CARD_H}px;
    background: ${bgCss};
    color: ${palette.text};
    font-family: '${fonts.body}', -apple-system, "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
    overflow: hidden; position: relative;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
  }
  .card { position: absolute; inset: 0; }
  .vignette {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 120% 80% at 50% 0%, rgba(0,0,0,0.22) 0%, transparent 55%),
      radial-gradient(ellipse 120% 80% at 50% 100%, rgba(0,0,0,0.28) 0%, transparent 55%),
      radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.12) 100%);
    z-index: 1;
  }
  .el {
    position: absolute;
    display: flex;
    align-items: center;
    overflow: visible;
    z-index: 2;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .el .plate {
    position: absolute; inset: 0; z-index: -1;
  }
  .el .text-inner {
    width: 100%;
    word-break: break-word;
    hyphens: none;
    ${isAi ? `
    text-shadow:
      0 1px 0 rgba(0,0,0,0.9),
      0 2px 6px rgba(0,0,0,0.92),
      0 4px 16px rgba(0,0,0,0.78),
      0 8px 32px rgba(0,0,0,0.55),
      0 0 60px rgba(0,0,0,0.35);
    paint-order: stroke fill;
    ` : "text-shadow: none;"}
  }
  .el img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .el .line { width: 100%; height: 100%; border-radius: 2px; }
</style>
</head>
<body>
  <div class="card">
    ${vignette}
    ${elementsHtml}
  </div>
</body>
</html>`;
}

function renderElementHtml(el: RenderElement, isAi: boolean): string {
  const baseStyle = `
    left:${el.x}px; top:${el.y}px;
    width:${el.width}px; height:${el.height}px;
    ${el.rotate ? `transform: rotate(${el.rotate}deg); transform-origin: center center;` : ""}
  `;

  if (el.type === "qr" && el.qrSrc) {
    return `<div class="el" style="${baseStyle}"><img src="${escapeAttr(el.qrSrc)}" alt="QR" /></div>`;
  }

  if (el.type === "logo" && el.logoSrc) {
    return `<div class="el" style="${baseStyle}"><img src="${escapeAttr(el.logoSrc)}" alt="logo" /></div>`;
  }

  if (el.type === "line") {
    const c = el.color || "#fff";
    return `<div class="el" style="${baseStyle}"><div class="line" style="background:${c}"></div></div>`;
  }

  // text
  const text = escapeHtml(el.text || "");
  if (!text) return "";
  const align = el.align || "left";
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const fontFamily = el.fontFamily ? `'${el.fontFamily}'` : "inherit";
  const fs = el.fontSize ?? 22;
  const fw = el.fontWeight ?? 400;
  const ls = el.letterSpacing ?? 0;
  const lh = el.lineHeight ?? 1.3;
  const tt = el.textTransform === "uppercase" ? "uppercase" : "none";
  const color = el.color || "#fff";

  // Solo usa plates si están explícitamente definidos en el elemento
  // (no se añaden cajas automáticas a fondos IA — el text-shadow provee la legibilidad)
  const plate = el.plate;
  const plateHtml = plate
    ? `<div class="plate" style="background:${plate.color}; opacity:${plate.opacity}; left:${-plate.padding}px; right:${-plate.padding}px; top:${-plate.padding/2}px; bottom:${-plate.padding/2}px; border-radius:${plate.radius}px;"></div>`
    : "";

  return `<div class="el" style="${baseStyle} justify-content:${justify};">
    ${plateHtml}
    <div class="text-inner" data-autoshrink="1" style="
      font-family:${fontFamily};
      font-size:${fs}px;
      font-weight:${fw};
      letter-spacing:${ls}px;
      line-height:${lh};
      text-transform:${tt};
      color:${color};
      text-align:${align};
      max-height:100%;
      overflow:hidden;
    ">${text}</div>
  </div>`;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
