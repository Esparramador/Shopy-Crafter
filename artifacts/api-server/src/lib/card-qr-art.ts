/**
 * QR artístico — SVG propio sobre la matriz real de `qrcode` (corrección H):
 * módulos con forma (cuadrado, redondeado, puntos, rombo, "classy"), ojos con
 * marco y centro configurables, degradado lineal/radial, color de ojos y logo
 * central. Cada PNG se decodifica con jsQR para comprobar que se puede escanear;
 * `renderVerifiedQr` degrada el estilo paso a paso hasta obtener uno legible.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import QRCode from "qrcode";
import sharp, { type Sharp } from "sharp";
import jsQR from "jsqr";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { logger } from "./logger.js";

export const QR_DOT_STYLES = ["square", "rounded", "dots", "diamond", "classy"] as const;
export const QR_EYE_FRAMES = ["square", "rounded", "circle"] as const;
// Sin rombo: con marco cuadrado ZXing no lo reconoce como patrón de posición (probado).
export const QR_EYE_BALLS = ["square", "rounded", "circle"] as const;
export const QR_GRADIENTS = ["none", "linear", "radial"] as const;

export type QrStyle = {
  dots: (typeof QR_DOT_STYLES)[number];
  eyeFrame: (typeof QR_EYE_FRAMES)[number];
  eyeBall: (typeof QR_EYE_BALLS)[number];
  fg: string;
  /** Segundo color del degradado. */
  fg2: string;
  gradient: (typeof QR_GRADIENTS)[number];
  /** Ángulo del degradado lineal (grados). */
  angle: number;
  /** Color de los ojos; vacío = mismo relleno que los módulos. */
  eyeColor: string;
  /** Hex o "transparent". */
  bg: string;
  /** Logo de la tarjeta en el centro. */
  logo: boolean;
  /** Lado del logo respecto al QR (0.12–0.24). */
  logoScale: number;
  /** Zona de silencio en módulos (0–4). */
  margin: number;
};

export const DEFAULT_QR_STYLE: QrStyle = {
  dots: "square", eyeFrame: "square", eyeBall: "square",
  fg: "#000000", fg2: "#000000", gradient: "none", angle: 45, eyeColor: "",
  bg: "#ffffff", logo: false, logoScale: 0.2, margin: 2,
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = <T extends readonly string[]>(v: unknown, list: T, def: T[number]): T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? v : def;
const hex = (v: unknown, def: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : def);
const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Valida un estilo recibido del cliente: enums, hex y rangos; lo desconocido cae al valor base. */
export function sanitizeQrStyle(input: unknown, base: Partial<QrStyle> = {}): QrStyle {
  const b: QrStyle = { ...DEFAULT_QR_STYLE, ...base };
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const fg = hex(s.fg, b.fg);
  return {
    dots: pick(s.dots, QR_DOT_STYLES, b.dots),
    eyeFrame: pick(s.eyeFrame, QR_EYE_FRAMES, b.eyeFrame),
    eyeBall: pick(s.eyeBall, QR_EYE_BALLS, b.eyeBall),
    fg,
    fg2: hex(s.fg2, fg),
    gradient: pick(s.gradient, QR_GRADIENTS, b.gradient),
    angle: Math.round(clamp(s.angle, 0, 360, b.angle)),
    eyeColor: s.eyeColor === "" ? "" : hex(s.eyeColor, b.eyeColor),
    bg: s.bg === "transparent" ? "transparent" : hex(s.bg, b.bg),
    logo: typeof s.logo === "boolean" ? s.logo : b.logo,
    logoScale: clamp(s.logoScale, 0.12, 0.24, b.logoScale),
    margin: Math.round(clamp(s.margin, 0, 4, b.margin)),
  };
}

function luminance(h: string): number {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Contraste mínimo (WCAG) entre cualquier color del QR y su fondo para darlo por imprimible. */
export const MIN_PRINT_CONTRAST = 2.5;

/** El peor contraste entre los colores del QR y su fondo (∞ si el fondo es transparente). */
export function qrMinContrast(style: QrStyle): number {
  if (style.bg === "transparent") return Infinity;
  const inks = [style.fg, style.gradient === "none" ? style.fg : style.fg2, style.eyeColor || style.fg];
  return Math.min(...inks.map((c) => contrast(c, style.bg)));
}

/** Avisos de legibilidad que la decodificación automática no detecta (lectores de móvil). */
export function qrStyleWarnings(style: QrStyle): string[] {
  const out: string[] = [];
  const bg = style.bg === "transparent" ? null : style.bg;
  const darkest = [style.fg, style.gradient === "none" ? style.fg : style.fg2, style.eyeColor || style.fg]
    .reduce((a, c) => (luminance(c) > luminance(a) ? c : a));
  if (bg) {
    if (contrast(darkest, bg) < 3) out.push("Contraste bajo entre el QR y su fondo: algunos móviles no lo leerán.");
    if (luminance(style.fg) > luminance(bg)) out.push("QR invertido (claro sobre oscuro): varios lectores antiguos no lo leen.");
  } else {
    out.push("Fondo transparente: la lectura depende del fondo de la tarjeta; deja un fondo claro detrás.");
  }
  if (style.margin < 1) out.push("Sin margen de silencio: déjalo en 1 o más si el QR va sobre un fondo con textura.");
  return out;
}

// ── SVG ──────────────────────────────────────────────────────────────────────

function eyeFramePath(x: number, y: number, kind: QrStyle["eyeFrame"]): string {
  if (kind === "circle") {
    const cx = x + 3.5, cy = y + 3.5;
    return `M${cx - 3.5},${cy}a3.5,3.5 0 1,0 7,0a3.5,3.5 0 1,0 -7,0Z` +
      `M${cx - 2.5},${cy}a2.5,2.5 0 1,1 5,0a2.5,2.5 0 1,1 -5,0Z`;
  }
  const r1 = kind === "rounded" ? 2 : 0, r2 = kind === "rounded" ? 1.2 : 0;
  return roundRect(x, y, 7, 7, r1) + roundRect(x + 1, y + 1, 5, 5, r2, true);
}

function eyeBallPath(x: number, y: number, kind: QrStyle["eyeBall"]): string {
  const bx = x + 2, by = y + 2;
  if (kind === "circle") return `M${bx},${by + 1.5}a1.5,1.5 0 1,0 3,0a1.5,1.5 0 1,0 -3,0Z`;
  return roundRect(bx, by, 3, 3, kind === "rounded" ? 0.9 : 0);
}

/** Rectángulo redondeado como subpath; `reverse` lo dibuja en sentido contrario (hueco). */
function roundRect(x: number, y: number, w: number, h: number, r: number, reverse = false): string {
  if (r <= 0) {
    return reverse
      ? `M${x},${y}V${y + h}H${x + w}V${y}Z`
      : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  }
  if (reverse) {
    return `M${x + r},${y}A${r},${r} 0 0,0 ${x},${y + r}V${y + h - r}A${r},${r} 0 0,0 ${x + r},${y + h}` +
      `H${x + w - r}A${r},${r} 0 0,0 ${x + w},${y + h - r}V${y + r}A${r},${r} 0 0,0 ${x + w - r},${y}Z`;
  }
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0,1 ${x + w},${y + r}V${y + h - r}` +
    `A${r},${r} 0 0,1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0,1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0,1 ${x + r},${y}Z`;
}

function dotPath(x: number, y: number, kind: QrStyle["dots"]): string {
  switch (kind) {
    case "dots": return `M${x + 0.07},${y + 0.5}a0.43,0.43 0 1,0 0.86,0a0.43,0.43 0 1,0 -0.86,0Z`;
    case "rounded": return roundRect(x + 0.04, y + 0.04, 0.92, 0.92, 0.3);
    case "diamond": return `M${x + 0.5},${y}L${x + 1},${y + 0.5}L${x + 0.5},${y + 1}L${x},${y + 0.5}Z`;
    case "classy":
      return `M${x + 0.5},${y}H${x + 1}V${y + 0.5}A0.5,0.5 0 0,1 ${x + 0.5},${y + 1}H${x}V${y + 0.5}A0.5,0.5 0 0,1 ${x + 0.5},${y}Z`;
    default: return `M${x},${y}h1v1h-1Z`;
  }
}

export function buildArtQrSvg(data: string, style: QrStyle, opts: { size?: number; logoDataUri?: string } = {}): string {
  if (!data || !data.trim()) throw new Error("QR data vacía");
  const qr = QRCode.create(data, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const m = style.margin;
  const total = n + m * 2;
  const size = opts.size ?? 1024;

  const inEye = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // Zona central del logo (en módulos, impar para centrar)
  const withLogo = !!(style.logo && opts.logoDataUri);
  let logoSide = 0, logoStart = 0;
  if (withLogo) {
    logoSide = Math.max(3, Math.round(n * style.logoScale));
    if (logoSide % 2 === 0) logoSide += 1;
    logoStart = Math.floor((n - logoSide) / 2);
  }
  const inLogo = (r: number, c: number) =>
    withLogo && r >= logoStart - 1 && r < logoStart + logoSide + 1 && c >= logoStart - 1 && c < logoStart + logoSide + 1;

  let dots = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!bits[r * n + c] || inEye(r, c) || inLogo(r, c)) continue;
      dots += dotPath(c + m, r + m, style.dots);
    }
  }
  let eyes = "", balls = "";
  for (const [ex, ey] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    eyes += eyeFramePath(ex + m, ey + m, style.eyeFrame);
    balls += eyeBallPath(ex + m, ey + m, style.eyeBall);
  }

  const paint = style.gradient === "none" ? style.fg : "url(#qrg)";
  const eyePaint = style.eyeColor || paint;
  const grad = style.gradient === "linear"
    ? `<linearGradient id="qrg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${total}" y2="0" gradientTransform="rotate(${style.angle} ${total / 2} ${total / 2})"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></linearGradient>`
    : style.gradient === "radial"
      ? `<radialGradient id="qrg" gradientUnits="userSpaceOnUse" cx="${total / 2}" cy="${total / 2}" r="${total * 0.62}"><stop offset="0" stop-color="${style.fg}"/><stop offset="1" stop-color="${style.fg2}"/></radialGradient>`
      : "";

  let logo = "";
  if (withLogo) {
    const lx = logoStart + m, pad = 0.6;
    const plate = style.bg === "transparent" ? "#ffffff" : style.bg;
    logo = `<rect x="${lx - 1 + pad}" y="${lx - 1 + pad}" width="${logoSide + 2 - pad * 2}" height="${logoSide + 2 - pad * 2}" rx="1" fill="${plate}"/>` +
      `<image x="${lx}" y="${lx}" width="${logoSide}" height="${logoSide}" preserveAspectRatio="xMidYMid meet" href="${opts.logoDataUri}" xlink:href="${opts.logoDataUri}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">` +
    (grad ? `<defs>${grad}</defs>` : "") +
    (style.bg === "transparent" ? "" : `<rect width="${total}" height="${total}" fill="${style.bg}"/>`) +
    `<path d="${dots}" fill="${paint}"/>` +
    `<path d="${eyes}" fill="${eyePaint}" fill-rule="evenodd"/>` +
    `<path d="${balls}" fill="${eyePaint}"/>` +
    logo +
    `</svg>`;
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/** jsQR exige RGBA; sharp devuelve 1–4 canales según la operación (gris, umbral…). */
function toRgba(data: Buffer, w: number, h: number, channels: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += channels) {
    const r = data[j], g = channels >= 3 ? data[j + 1] : r, b = channels >= 3 ? data[j + 2] : r;
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  return out;
}

// ZXing-C++ (WebAssembly): el mismo motor de lectura que usan muchas apps de escaneo.
// El .wasm se carga desde node_modules (sin descargas en tiempo de ejecución).
let zxingReady: Promise<unknown> | null = null;
function ensureZxing(): Promise<unknown> {
  if (!zxingReady) {
    zxingReady = (async () => {
      const req = createRequire(import.meta.url);
      // zxing-wasm no exporta package.json: se parte de su entrada CJS (dist/cjs/reader/index.js).
      const entry = req.resolve("zxing-wasm/reader");
      const wasm = readFileSync(path.resolve(path.dirname(entry), "..", "..", "reader", "zxing_reader.wasm"));
      return prepareZXingModule({
        overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer },
        fireImmediately: true,
      });
    })().catch((err) => { zxingReady = null; throw err; });
  }
  return zxingReady;
}

/**
 * Lee un QR de una imagen (PNG/JPG/WEBP). Primero ZXing (con inversión, rotación
 * y reescalado); si no está disponible o no lo encuentra, jsQR sobre la imagen
 * normalizada. Devuelve el texto o null.
 */
export async function decodeQrImage(input: Buffer): Promise<string | null> {
  const png = await sharp(input)
    .flatten({ background: "#ffffff" })
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  try {
    await ensureZxing();
    const results = await readBarcodes(new Uint8Array(png), {
      formats: ["QRCode"], tryHarder: true, tryInvert: true, tryRotate: true, tryDownscale: true, maxNumberOfSymbols: 1,
    });
    const hit = results.find((r) => r.isValid && r.text);
    if (hit) return hit.text;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "card-qr-art: ZXing no disponible, se usa jsQR");
  }
  const variants: Array<(img: Sharp) => Sharp> = [
    (img) => img,
    (img) => img.greyscale().normalise().threshold(128),
  ];
  for (const v of variants) {
    const { data, info } = await v(sharp(png).resize(900, 900, { fit: "inside" })).raw().toBuffer({ resolveWithObject: true });
    const hit = jsQR(toRgba(data, info.width, info.height, info.channels), info.width, info.height, { inversionAttempts: "attemptBoth" });
    if (hit?.data) return hit.data;
  }
  return null;
}

/** Decodifica sin agrandar la imagen: los checks pequeños deben medir la legibilidad real. */
async function decodeQrImageAtNativeSize(input: Buffer): Promise<string | null> {
  const png = await sharp(input).flatten({ background: "#ffffff" }).png().toBuffer();
  try {
    await ensureZxing();
    const results = await readBarcodes(new Uint8Array(png), {
      formats: ["QRCode"], tryHarder: true, tryInvert: true, tryRotate: true, tryDownscale: true, maxNumberOfSymbols: 1,
    });
    const hit = results.find(result => result.isValid && result.text);
    if (hit) return hit.text;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "card-qr-art: ZXing no disponible; check estricto con jsQR");
  }

  for (const transform of [
    (image: Sharp) => image,
    (image: Sharp) => image.greyscale().normalise().threshold(128),
  ]) {
    const { data, info } = await transform(sharp(png)).raw().toBuffer({ resolveWithObject: true });
    const hit = jsQR(toRgba(data, info.width, info.height, info.channels), info.width, info.height, { inversionAttempts: "attemptBoth" });
    if (hit?.data) return hit.data;
  }
  return null;
}

export const QR_ARTWORK_DISPLAY_SIZES = [320, 256, 192, 160, 128] as const;
export type QrArtworkSizeCheck = { sizePx: number; passed: boolean };

/** Comprueba que el mismo QR siga leyéndose en las versiones WebP que se mostrarán en la landing. */
export async function checkQrArtworkAtDisplaySizes(input: Buffer): Promise<QrArtworkSizeCheck[]> {
  const metadata = await sharp(input).metadata();
  const maxEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  if (!maxEdge) throw new Error("No se pudo determinar el tamaño de la imagen");

  const sizes = [...new Set(QR_ARTWORK_DISPLAY_SIZES.map(size => Math.min(size, maxEdge)))];
  const originalPayload = await decodeQrImage(input);
  const checks: QrArtworkSizeCheck[] = [];

  for (const sizePx of sizes) {
    const resized = await sharp(input)
      .rotate()
      .resize({ width: sizePx, height: sizePx, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    const payload = await decodeQrImageAtNativeSize(resized);
    checks.push({
      sizePx,
      passed: sizePx >= 128 && Boolean(originalPayload) && payload === originalPayload,
    });
  }

  return checks;
}

// ── PNG verificado ───────────────────────────────────────────────────────────

export type ArtQrResult = {
  png: Buffer;
  svg: string;
  /** El PNG final se ha leído y su contenido coincide con `data`. */
  verified: boolean;
  /** Estilo realmente aplicado (puede simplificarse para que sea legible). */
  style: QrStyle;
  warnings: string[];
};

async function rasterize(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer();
}

/**
 * Genera el QR con el estilo pedido y lo verifica leyéndolo. Si no se lee,
 * prueba variantes más sencillas (logo más pequeño → sin logo → módulos
 * cuadrados → blanco y negro) y devuelve la primera legible.
 */
export async function renderVerifiedQr(
  data: string,
  style: QrStyle,
  opts: { size?: number; logoDataUri?: string } = {},
): Promise<ArtQrResult> {
  const size = Math.max(128, Math.min(2048, opts.size ?? 1024));
  const attempts: Array<{ style: QrStyle; note?: string }> = [{ style }];
  if (style.logo && style.logoScale > 0.16) attempts.push({ style: { ...style, logoScale: 0.16 }, note: "Logo reducido para que el QR se lea." });
  if (style.logo) attempts.push({ style: { ...style, logo: false }, note: "Logo quitado: con él el QR no se leía." });
  if (style.dots !== "square" || style.eyeFrame !== "square" || style.eyeBall !== "square") {
    attempts.push({ style: { ...style, logo: false, dots: "square", eyeFrame: "square", eyeBall: "square" }, note: "Formas simplificadas: el estilo elegido no se leía." });
  }
  attempts.push({ style: { ...DEFAULT_QR_STYLE, margin: Math.max(2, style.margin) }, note: "Se usa un QR negro sobre blanco: el estilo elegido no se leía." });

  // El lector verifica sobre fondo blanco; un QR transparente se valida igual que impreso sobre claro.
  let last: { png: Buffer; svg: string; style: QrStyle } | null = null;
  let lowContrast = false;
  for (const a of attempts) {
    // Una imagen digital perfecta se lee aunque el contraste sea mínimo; impresa o en pantalla, no.
    if (qrMinContrast(a.style) < MIN_PRINT_CONTRAST) { lowContrast = true; continue; }
    const svg = buildArtQrSvg(data, a.style, { size, logoDataUri: opts.logoDataUri });
    const png = await rasterize(svg, size);
    last = { png, svg, style: a.style };
    const decoded = await decodeQrImage(png);
    if (decoded === data) {
      const notes = lowContrast && a.style !== style
        ? ["Los colores elegidos tenían muy poco contraste para imprimirse: se han sustituido por unos legibles."]
        : a.note ? [a.note] : [];
      return { png, svg, verified: true, style: a.style, warnings: [...notes, ...qrStyleWarnings(a.style)] };
    }
  }
  if (!last) {
    // Todas las variantes tenían poco contraste salvo la última (blanco y negro), que nunca se salta.
    throw new Error("No se pudo generar un QR legible");
  }
  return { ...last, verified: false, warnings: ["No se ha podido verificar la lectura de este QR.", ...qrStyleWarnings(last!.style)] };
}
