import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  QR_DOT_STYLES, QR_EYE_FRAMES, QR_EYE_BALLS,
  buildArtQrSvg, checkQrArtworkAtDisplaySizes, decodeQrImage, qrMinContrast, renderVerifiedQr, sanitizeQrStyle,
} from "./card-qr-art.js";

const URL_DATA = "https://shopycrafter.com/r/abc123";
const VCARD = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ana Pérez\r\nORG:Crafter Eventos\r\nEMAIL;TYPE=INTERNET:ana@example.com\r\nTEL;TYPE=CELL:+34 600 000 000\r\nEND:VCARD";

describe("sanitizeQrStyle", () => {
  it("descarta valores desconocidos o con inyección y aplica rangos", () => {
    const s = sanitizeQrStyle({
      dots: "<script>", eyeFrame: "circle", fg: "red;background:url(x)", bg: "#FFFFFF",
      logoScale: 9, margin: -3, angle: "90", eyeColor: "javascript:", gradient: "linear",
    });
    expect(s.dots).toBe("square");
    expect(s.eyeFrame).toBe("circle");
    expect(s.fg).toBe("#000000");
    expect(s.bg).toBe("#ffffff");
    expect(s.logoScale).toBe(0.24);
    expect(s.margin).toBe(0);
    expect(s.angle).toBe(90);
    expect(s.gradient).toBe("linear");
  });

  it("el SVG solo contiene colores hex validados", () => {
    const svg = buildArtQrSvg(URL_DATA, sanitizeQrStyle({ fg: "#123456", bg: "transparent" }));
    expect(svg).toContain('fill="#123456"');
    expect(svg).not.toMatch(/url\(http|<script/i);
  });
});

describe("renderVerifiedQr", () => {
  it("todas las formas se leen con su contenido exacto", async () => {
    for (const dots of QR_DOT_STYLES) {
      for (const eyeFrame of QR_EYE_FRAMES) {
        for (const eyeBall of QR_EYE_BALLS) {
          const style = sanitizeQrStyle({ dots, eyeFrame, eyeBall, fg: "#1a1a2e", fg2: "#2a7a4b", gradient: "linear" });
          const r = await renderVerifiedQr(VCARD, style, { size: 480 });
          expect(r.verified, `${dots}/${eyeFrame}/${eyeBall}`).toBe(true);
          expect(r.style.dots).toBe(dots);
        }
      }
    }
  }, 120_000);

  it("con logo central sigue siendo legible", async () => {
    const logo = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#c9a961" } }).png().toBuffer();
    const r = await renderVerifiedQr(URL_DATA, sanitizeQrStyle({ dots: "dots", logo: true }), {
      size: 480, logoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
    });
    expect(r.verified).toBe(true);
    expect(await decodeQrImage(r.png)).toBe(URL_DATA);
  }, 60_000);

  it("colores sin contraste para imprimir se sustituyen por unos legibles y se avisa", async () => {
    const style = sanitizeQrStyle({ fg: "#1a1a2e", bg: "#0a0a0a" });
    expect(qrMinContrast(style)).toBeLessThan(2.5);
    const r = await renderVerifiedQr(URL_DATA, style, { size: 400 });
    expect(r.verified).toBe(true);
    expect(qrMinContrast(r.style)).toBeGreaterThanOrEqual(2.5);
    expect(r.warnings.join(" ")).toMatch(/poco contraste/);
  }, 60_000);
});

describe("checkQrArtworkAtDisplaySizes", () => {
  it("confirma el mismo destino en cada tamaño WebP público", async () => {
    const qr = await renderVerifiedQr(URL_DATA, sanitizeQrStyle({ dots: "square", fg: "#000000", bg: "#ffffff" }), { size: 760 });
    const checks = await checkQrArtworkAtDisplaySizes(qr.png);
    expect(checks.map(check => check.sizePx)).toEqual([320, 256, 192, 160, 128]);
    expect(checks.every(check => check.passed)).toBe(true);
  });

  it("rechaza una imagen sin QR y una imagen demasiado pequeña", async () => {
    const blank = await sharp({ create: { width: 500, height: 500, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const checks = await checkQrArtworkAtDisplaySizes(blank);
    expect(checks.map(check => check.sizePx)).toEqual([320, 256, 192, 160, 128]);
    expect(checks.every(check => !check.passed)).toBe(true);

    const tiny = await sharp({ create: { width: 96, height: 96, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const tinyChecks = await checkQrArtworkAtDisplaySizes(tiny);
    expect(tinyChecks).toEqual([{ sizePx: 96, passed: false }]);
  });
});

describe("decodeQrImage", () => {
  it("devuelve null si no hay QR", async () => {
    const blank = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await decodeQrImage(blank)).toBeNull();
  }, 30_000);

  it("lee un QR fotografiado (girado, con ruido, en JPG)", async () => {
    const { png } = await renderVerifiedQr(URL_DATA, sanitizeQrStyle({}), { size: 600 });
    const photo = await sharp(png)
      .extend({ top: 120, bottom: 120, left: 120, right: 120, background: "#f3efe6" })
      .rotate(8, { background: "#f3efe6" })
      .modulate({ brightness: 0.92 })
      .jpeg({ quality: 55 })
      .toBuffer();
    expect(await decodeQrImage(photo)).toBe(URL_DATA);
  }, 30_000);
});
