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
  /** Imágenes ya resueltas de los extras (QR generados/subidos), clave "extra-<id>". */
  extraAssets?: Record<string, string>;
  /** Texto bajo el QR del reverso. */
  qrLabel?: string;
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
    : defaultBackElements ({ side: "back",  layout: template.layout, data, palette, fonts, isAiBg, qrPngBase64: opts.qrPngBase64, qrLabel: opts.qrLabel });

  // 2. Aplicar overrides + concatenar extras del lado correspondiente
  const sideOverrides = opts.side === "front" ? opts.overrides?.front : opts.overrides?.back;
  const withOverrides = applyOverrides(defaults, sideOverrides);
  const extras = extrasToRender(opts.overrides?.extras, opts.side, opts.extraAssets);
  const elements = [...withOverrides, ...extras].filter((e) => !e.hidden).map(sanitizeElement);

  // 3. Construir HTML
  const html = buildHtml({ template, palette, fonts, opts, elements });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Solo se permiten data: URIs y Google Fonts: un valor manipulado en la tarjeta
    // no puede hacer que el servidor pida URLs internas o externas (SSRF).
    await page.setRequestInterception(true);
    page.on("request", (r: any) => {
      const u: string = r.url();
      if (u.startsWith("data:") || u.startsWith("about:") || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) r.continue();
      else r.abort();
    });
    await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // puppeteer 25: setContent ya no admite networkidle0; se espera a que no queden peticiones (fuentes, imágenes).
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 });
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
          (el as HTMLElement).style.fontSize = size + "px";
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
  const { template, opts, elements } = args;
  const palette = sanitizePalette(args.palette);
  const fonts = { ...args.fonts, heading: safeFont(args.fonts.heading, "Inter"), body: safeFont(args.fonts.body, "Inter") };

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
  .el svg { display: block; width: 100%; height: 100%; overflow: visible; }
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
    ${el.opacity !== undefined && el.opacity < 1 ? `opacity:${el.opacity};` : ""}
  `;

  if (el.type === "image" && el.imgSrc) {
    return `<div class="el" style="${baseStyle}"><img src="${escapeAttr(el.imgSrc)}" alt="" /></div>`;
  }

  if (el.type === "shape") {
    const fill = el.fill ?? "rgba(212,175,55,0.18)", stroke = el.stroke ?? "rgba(212,175,55,0.9)", sw = el.strokeWidth ?? 2;
    const w = el.width, h = el.height, i = sw / 2;
    const shape = el.shapeType === "circle"
      ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${Math.max(0, w / 2 - i)}" ry="${Math.max(0, h / 2 - i)}"/>`
      : el.shapeType === "triangle"
        ? `<polygon points="${w / 2},${i} ${w - i},${h - i} ${i},${h - i}"/>`
        : `<rect x="${i}" y="${i}" width="${Math.max(0, w - sw)}" height="${Math.max(0, h - sw)}" rx="8" ry="8"/>`;
    return `<div class="el" style="${baseStyle}"><svg viewBox="0 0 ${w} ${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}">${shape}</svg></div>`;
  }

  if (el.type === "bubble") {
    const bw = el.width, tail = 36, bh = Math.max(40, el.height - tail);
    const d = `M 20 0 L ${bw - 20} 0 Q ${bw} 0 ${bw} 20 L ${bw} ${bh - 20} Q ${bw} ${bh} ${bw - 20} ${bh} L 80 ${bh} L 54 ${bh + tail} L 44 ${bh} L 20 ${bh} Q 0 ${bh} 0 ${bh - 20} L 0 20 Q 0 0 20 0 Z`;
    return `<div class="el" style="${baseStyle}"><svg viewBox="0 0 ${bw} ${bh + tail}" fill="${el.fill ?? "rgba(255,255,255,0.92)"}" stroke="${el.stroke ?? "#222"}" stroke-width="${el.strokeWidth ?? 2}"><path d="${d}"/></svg></div>`;
  }

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
      font-style:${el.italic ? "italic" : "normal"};
      color:${color};
      text-align:${align};
      max-height:100%;
      overflow:hidden;
    ">${text}</div>
  </div>`;
}

// ── Saneado: todo valor que acaba en el HTML de Chromium pasa por aquí ─────────

const CSS_COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/+-]+\)|[a-z]{3,20})$/i;
const IMG_DATA_URI = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

function safeColor(v: unknown, fallback?: string): string | undefined {
  return typeof v === "string" && CSS_COLOR.test(v.trim()) ? v.trim() : fallback;
}
/** Nombres de Google Fonts: letras, números, espacios y guiones. */
function safeFont(v: unknown, fallback: string): string {
  return typeof v === "string" && /^[\p{L}\p{N} \-]{1,60}$/u.test(v.replace(/'/g, "").trim()) ? v.replace(/'/g, "").trim() : fallback;
}
function num(v: unknown, def: number, min = -5000, max = 5000): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function optNum(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}

function sanitizePalette(p: CardPalette): CardPalette {
  return {
    bg: safeColor(p.bg, "#111111")!, primary: safeColor(p.primary, "#ffffff")!, secondary: safeColor(p.secondary, "#cccccc")!,
    accent: safeColor(p.accent, "#c9a961")!, text: safeColor(p.text, "#ffffff")!,
  };
}

function sanitizeElement(el: RenderElement): RenderElement {
  const plate = el.plate && typeof el.plate === "object"
    ? {
        color: safeColor(el.plate.color, "#000000")!, opacity: num(el.plate.opacity, 0.5, 0, 1),
        padding: num(el.plate.padding, 12, 0, 80), radius: num(el.plate.radius, 8, 0, 80),
      }
    : null;
  const align = el.align === "center" || el.align === "right" ? el.align : el.align === "left" ? "left" : undefined;
  return {
    ...el,
    x: num(el.x, 0), y: num(el.y, 0),
    width: num(el.width, 100, 0, 4000), height: num(el.height, 40, 0, 4000),
    rotate: optNum(el.rotate, -360, 360),
    opacity: optNum(el.opacity, 0, 1),
    fontSize: optNum(el.fontSize, 4, 400),
    fontWeight: optNum(el.fontWeight, 100, 900),
    letterSpacing: optNum(el.letterSpacing, -20, 60),
    lineHeight: optNum(el.lineHeight, 0.5, 4),
    strokeWidth: optNum(el.strokeWidth, 0, 40),
    color: safeColor(el.color),
    fill: safeColor(el.fill),
    stroke: safeColor(el.stroke),
    fontFamily: el.fontFamily ? safeFont(el.fontFamily, "Inter") : undefined,
    textTransform: el.textTransform === "uppercase" ? "uppercase" : "none",
    align,
    plate,
    shapeType: el.shapeType === "circle" || el.shapeType === "triangle" ? el.shapeType : el.shapeType ? "rect" : undefined,
    qrSrc: el.qrSrc && IMG_DATA_URI.test(el.qrSrc) ? el.qrSrc : undefined,
    // Logos antiguos pueden ser SVG: dentro de <img> no ejecutan scripts y la red está bloqueada.
    logoSrc: el.logoSrc && (IMG_DATA_URI.test(el.logoSrc) || /^data:image\/svg\+xml;base64,[a-z0-9+/=]+$/i.test(el.logoSrc)) ? el.logoSrc : undefined,
    imgSrc: el.imgSrc && IMG_DATA_URI.test(el.imgSrc) ? el.imgSrc : undefined,
    text: typeof el.text === "string" ? el.text.slice(0, 600) : undefined,
  };
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
