/**
 * FILE EXTRACTOR — pull text + images from any uploaded file.
 * ─────────────────────────────────────────────────────────────────────────────
 * Supports the formats the user listed in the request:
 *   - Images (jpg/jpeg/png/webp/gif)  → returned as-is for downstream OCR
 *   - PDF                              → text via `pdftotext`, page rasters via `pdftoppm`
 *   - ZIP                              → recursively extract every contained file
 *   - TXT / MD / CSV / JSON / SVG (text) → utf-8 decode, returned as text
 *   - Anything else                    → returned as raw bytes with mime
 *
 * The extractor NEVER calls a vision API itself — it is purely format-aware.
 * The `brand-kit-extractor` module then runs Claude Vision OCR over the
 * `imageBuffers` to harvest text/logos/handles/URLs/colors.
 *
 * Why we use system binaries (pdftotext / pdftoppm / unzip) instead of npm
 * packages: they are battle-tested, fast, ship with Replit's Nix runtime
 * (verified at /nix/store/.../bin/), and avoid pulling 30+ MB of JS deps.
 */

import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";
import { logger } from "./logger.js";

export interface ExtractedImage {
  /** Stable filename hint, e.g. "page-001.png" or original "logo.png". */
  filename: string;
  buffer: Buffer;
  mimeType: string;
  /** Source: "input" (user file), "pdf-page" (rasterized), "zip-entry". */
  source: "input" | "pdf-page" | "zip-entry";
}

export interface ExtractedTextBlock {
  filename: string;
  text: string;
  /** Encoding hint: "utf-8" by default. */
  encoding: string;
}

export interface ExtractedAsset {
  /** Original filename as uploaded. */
  filename: string;
  /** Detected mime type (best-effort). */
  mimeType: string;
  /** Raw bytes — kept so callers can re-process if needed. */
  bytes: number;
  /** Plain-text blocks pulled from this file. */
  textBlocks: ExtractedTextBlock[];
  /** Image assets (returned for OCR / logo capture). */
  images: ExtractedImage[];
  /** For ZIPs: the recursively-extracted children. */
  children?: ExtractedAsset[];
  /** Soft errors encountered during extraction (does not throw). */
  warnings: string[];
}

const TEXT_LIKE_MIMES = new Set([
  "text/plain", "text/markdown", "text/csv", "application/json",
  "application/xml", "text/xml", "image/svg+xml", "text/html",
]);

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
]);

function detectMime(filename: string, fallback?: string): string {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":  return "application/pdf";
    case ".zip":  return "application/zip";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png":  return "image/png";
    case ".webp": return "image/webp";
    case ".gif":  return "image/gif";
    case ".bmp":  return "image/bmp";
    case ".tif":
    case ".tiff": return "image/tiff";
    case ".svg":  return "image/svg+xml";
    case ".txt":  return "text/plain";
    case ".md":   return "text/markdown";
    case ".csv":  return "text/csv";
    case ".json": return "application/json";
    case ".xml":  return "application/xml";
    case ".html":
    case ".htm":  return "text/html";
    default:      return fallback || "application/octet-stream";
  }
}

async function makeTmpDir(prefix = "fx"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

function runProcess(cmd: string, args: string[], opts?: { cwd?: string; timeoutMs?: number }): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cp = spawn(cmd, args, { cwd: opts?.cwd });
    let out = ""; let err = "";
    cp.stdout?.on("data", (d) => { out += d.toString(); });
    cp.stderr?.on("data", (d) => { err += d.toString(); });
    const tHandle = opts?.timeoutMs ? setTimeout(() => { cp.kill("SIGKILL"); reject(new Error(`Timeout: ${cmd}`)); }, opts.timeoutMs) : null;
    cp.on("error", (e) => { if (tHandle) clearTimeout(tHandle); reject(e); });
    cp.on("close", (code) => { if (tHandle) clearTimeout(tHandle); resolve({ code: code ?? 1, stdout: out, stderr: err }); });
  });
}

/**
 * Extract text + page images from a PDF.
 *
 * Uses `pdftotext` (text layer extraction) and `pdftoppm` (rasterise pages).
 * If a PDF has no text layer (scanned document) we still get the page
 * images and rely on Claude Vision OCR downstream.
 */
async function extractPdf(buffer: Buffer, filename: string): Promise<ExtractedAsset> {
  const warnings: string[] = [];
  const tmp = await makeTmpDir("pdf");
  const inPath = path.join(tmp, "in.pdf");
  await fs.writeFile(inPath, buffer);

  // ── Text ──────────────────────────────────────────────────────────────
  const textBlocks: ExtractedTextBlock[] = [];
  try {
    const txtPath = path.join(tmp, "out.txt");
    const { code, stderr } = await runProcess("pdftotext", ["-layout", "-enc", "UTF-8", inPath, txtPath], { timeoutMs: 30_000 });
    if (code === 0) {
      const txt = await fs.readFile(txtPath, "utf8").catch(() => "");
      if (txt.trim()) textBlocks.push({ filename: `${filename}#text`, text: txt, encoding: "utf-8" });
    } else {
      warnings.push(`pdftotext exit=${code} stderr=${stderr.slice(0, 200)}`);
    }
  } catch (e: any) {
    warnings.push(`pdftotext failed: ${e?.message || e}`);
  }

  // ── Page images (capped at 12 pages, 150 DPI) ────────────────────────
  const images: ExtractedImage[] = [];
  try {
    const prefix = path.join(tmp, "page");
    // -r 150 = 150 DPI; -png = PNG output; -f/-l = first/last page.
    const { code, stderr } = await runProcess("pdftoppm", ["-r", "150", "-png", "-f", "1", "-l", "12", inPath, prefix], { timeoutMs: 60_000 });
    if (code === 0) {
      const entries = await fs.readdir(tmp);
      const pages = entries.filter((f) => f.startsWith("page-") && f.endsWith(".png")).sort();
      for (const p of pages) {
        const buf = await fs.readFile(path.join(tmp, p));
        images.push({ filename: `${filename}#${p}`, buffer: buf, mimeType: "image/png", source: "pdf-page" });
      }
    } else {
      warnings.push(`pdftoppm exit=${code} stderr=${stderr.slice(0, 200)}`);
    }
  } catch (e: any) {
    warnings.push(`pdftoppm failed: ${e?.message || e}`);
  }

  fs.rm(tmp, { recursive: true, force: true }).catch(() => { });
  return {
    filename, mimeType: "application/pdf", bytes: buffer.length,
    textBlocks, images, warnings,
  };
}

/** Decode a UTF-8 text-like file. */
function extractText(buffer: Buffer, filename: string, mimeType: string): ExtractedAsset {
  let text = "";
  let encoding = "utf-8";
  try {
    text = buffer.toString("utf8");
    // crude check: replacement char ratio above 1% → probably not utf-8.
    const replacements = (text.match(/\uFFFD/g) || []).length;
    if (replacements / Math.max(1, text.length) > 0.01) {
      // Try latin1 as a graceful fallback — common for legacy CSV exports.
      text = buffer.toString("latin1");
      encoding = "latin1";
    }
  } catch {
    text = "";
  }
  return {
    filename, mimeType, bytes: buffer.length,
    textBlocks: text.trim() ? [{ filename, text, encoding }] : [],
    images: [],
    warnings: [],
  };
}

/** Recursively unzip and extract each entry. */
async function extractZip(buffer: Buffer, filename: string, depth: number): Promise<ExtractedAsset> {
  const warnings: string[] = [];
  const children: ExtractedAsset[] = [];
  if (depth >= 3) {
    warnings.push("max zip nesting depth (3) reached; not recursing further");
    return { filename, mimeType: "application/zip", bytes: buffer.length, textBlocks: [], images: [], children, warnings };
  }
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (e: any) {
    warnings.push(`adm-zip parse failed: ${e?.message || e}`);
    return { filename, mimeType: "application/zip", bytes: buffer.length, textBlocks: [], images: [], children, warnings };
  }

  const entries = zip.getEntries();
  // Cap to first 200 entries to avoid runaway extraction.
  const capped = entries.filter((e) => !e.isDirectory).slice(0, 200);
  if (entries.length > capped.length) warnings.push(`zip had ${entries.length} entries, processed first ${capped.length}`);

  for (const entry of capped) {
    try {
      const childBuf = entry.getData();
      const childMime = detectMime(entry.entryName);
      const child = await extractFromBuffer(childBuf, entry.entryName, childMime, depth + 1);
      children.push(child);
    } catch (e: any) {
      warnings.push(`zip entry ${entry.entryName} failed: ${e?.message || e}`);
    }
  }

  // Aggregate images + text blocks from children for convenience (so callers
  // who don't want to recurse can read top-level).
  const aggImages: ExtractedImage[] = [];
  const aggText: ExtractedTextBlock[] = [];
  const collect = (asset: ExtractedAsset) => {
    aggImages.push(...asset.images);
    aggText.push(...asset.textBlocks);
    for (const c of asset.children ?? []) collect(c);
  };
  for (const c of children) collect(c);

  return {
    filename, mimeType: "application/zip", bytes: buffer.length,
    textBlocks: aggText, images: aggImages, children, warnings,
  };
}

/** Pass-through for image files (the OCR happens in brand-kit-extractor). */
function extractImage(buffer: Buffer, filename: string, mimeType: string): ExtractedAsset {
  return {
    filename, mimeType, bytes: buffer.length,
    textBlocks: [],
    images: [{ filename, buffer, mimeType, source: "input" }],
    warnings: [],
  };
}

/**
 * Main entry. Detects the format and routes to the appropriate extractor.
 * Always returns an ExtractedAsset (never throws). Soft errors are captured
 * in `.warnings`.
 */
export async function extractFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
  depth = 0,
): Promise<ExtractedAsset> {
  const mime = detectMime(filename, mimeType);

  if (mime === "application/pdf") {
    return extractPdf(buffer, filename);
  }
  if (mime === "application/zip" || filename.toLowerCase().endsWith(".zip")) {
    return extractZip(buffer, filename, depth);
  }
  if (IMAGE_MIMES.has(mime)) {
    return extractImage(buffer, filename, mime);
  }
  if (TEXT_LIKE_MIMES.has(mime) || mime.startsWith("text/")) {
    return extractText(buffer, filename, mime);
  }
  // Unknown binary — try utf8 anyway, may yield useful text (e.g. mistitled .txt).
  const asText = extractText(buffer, filename, mime);
  if (asText.textBlocks.length > 0) {
    asText.warnings.push(`unknown mime ${mime}, fell back to utf-8 text decode`);
    return asText;
  }
  return {
    filename, mimeType: mime, bytes: buffer.length,
    textBlocks: [], images: [],
    warnings: [`unsupported mime ${mime} — no extractor`],
  };
}

/** Helper: extract many files at once. */
export async function extractFromBuffers(
  files: Array<{ buffer: Buffer; filename: string; mimeType?: string }>,
): Promise<ExtractedAsset[]> {
  const out: ExtractedAsset[] = [];
  for (const f of files) {
    try {
      out.push(await extractFromBuffer(f.buffer, f.filename, f.mimeType));
    } catch (e: any) {
      logger.error({ err: e?.message || e, filename: f.filename }, "file-extractor: extract failed");
      out.push({
        filename: f.filename, mimeType: f.mimeType ?? "application/octet-stream", bytes: f.buffer.length,
        textBlocks: [], images: [],
        warnings: [`extractor crashed: ${e?.message || e}`],
      });
    }
  }
  return out;
}
