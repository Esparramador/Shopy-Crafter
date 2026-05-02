/**
 * Card QR generator — usa npm `qrcode` para generar QR codes FUNCIONALES
 * (escaneables de verdad, no imágenes IA falsas).
 *
 * Soporta:
 *  - PNG buffer (para componer con Sharp)
 *  - SVG string (para export vectorial)
 *  - Customización de colores y márgenes
 *  - Niveles de error correction altos para resistir overlays/logos
 */
import QRCode from "qrcode";
import { logger } from "./logger.js";

export type QrOptions = {
  fgColor?: string;
  bgColor?: string;
  margin?: number;
  /** Tamaño del PNG generado en píxeles (lado). Default 512 para máxima nitidez. */
  size?: number;
  /** Error correction level. H = 30% redundancia, soporta logos overlay. */
  errorLevel?: "L" | "M" | "Q" | "H";
};

export async function generateQrPng(
  data: string,
  opts: QrOptions = {},
): Promise<Buffer> {
  if (!data || typeof data !== "string" || data.trim().length === 0) {
    throw new Error("QR data vacía");
  }
  const size = Math.max(128, Math.min(2048, opts.size ?? 512));
  try {
    const buf = await QRCode.toBuffer(data, {
      type: "png",
      errorCorrectionLevel: opts.errorLevel ?? "H",
      margin: opts.margin ?? 1,
      width: size,
      color: {
        dark: opts.fgColor ?? "#000000",
        light: opts.bgColor ?? "#ffffff",
      },
    });
    logger.info({ dataLen: data.length, size, bytes: buf.length }, "card-qr: PNG generated");
    return buf;
  } catch (err: any) {
    logger.error({ err: err?.message, dataLen: data.length }, "card-qr: PNG generation failed");
    throw new Error(`No se pudo generar QR: ${err?.message ?? err}`);
  }
}

export async function generateQrSvg(
  data: string,
  opts: QrOptions = {},
): Promise<string> {
  if (!data) throw new Error("QR data vacía");
  try {
    return await QRCode.toString(data, {
      type: "svg",
      errorCorrectionLevel: opts.errorLevel ?? "H",
      margin: opts.margin ?? 1,
      width: opts.size ?? 512,
      color: {
        dark: opts.fgColor ?? "#000000",
        light: opts.bgColor ?? "#ffffff",
      },
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "card-qr: SVG generation failed");
    throw new Error(`No se pudo generar QR SVG: ${err?.message ?? err}`);
  }
}

/**
 * Genera vCard estándar (RFC 6350) para QR de "guardar contacto".
 * Mucho más útil que un email plano: el escáner ofrece directamente
 * añadir el contacto a la agenda.
 */
export function buildVCard(params: {
  fullName: string;
  jobTitle?: string;
  organization?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  if (params.fullName) lines.push(`FN:${escVcard(params.fullName)}`);
  if (params.fullName) {
    const parts = params.fullName.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : "";
    const first = parts.join(" ");
    lines.push(`N:${escVcard(last || "")};${escVcard(first)};;;`);
  }
  if (params.organization) lines.push(`ORG:${escVcard(params.organization)}`);
  if (params.jobTitle) lines.push(`TITLE:${escVcard(params.jobTitle)}`);
  if (params.email) lines.push(`EMAIL;TYPE=INTERNET:${escVcard(params.email)}`);
  if (params.phone) lines.push(`TEL;TYPE=CELL:${escVcard(params.phone)}`);
  if (params.website) lines.push(`URL:${escVcard(params.website)}`);
  if (params.address) lines.push(`ADR;TYPE=WORK:;;${escVcard(params.address)};;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function escVcard(s: string): string {
  return s.replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n");
}
