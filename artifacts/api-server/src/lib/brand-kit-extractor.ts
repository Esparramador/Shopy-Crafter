/**
 * BRAND KIT EXTRACTOR — harvest brand assets from any uploaded files.
 * ─────────────────────────────────────────────────────────────────────────────
 * Aggregates output from `lib/file-extractor` and runs Claude Vision OCR
 * over every image to capture EVERY printed letter, logo, social handle,
 * URL, hex color and font hint visible in the source material — exactly
 * what a brand designer needs to recreate the identity reliably in a video
 * overlay (text via FFmpeg drawtext, logo via FFmpeg overlay).
 *
 * Inputs:
 *   - One or more files (PDF, ZIP, PNG, JPG, WEBP, TXT, CSV, JSON, …)
 *   - Optional projectId for vision-API quota tracking
 *
 * Output: a normalised `BrandKit` ready to feed into `buildAutoBrandOverlay`
 *   from lib/brand-overlay, OR for the user to edit and persist.
 */

import { askClaudeWithVision, safeJsonParse } from "./claude.js";
import { logger } from "./logger.js";
import { extractFromBuffers, type ExtractedAsset, type ExtractedImage } from "./file-extractor.js";

export interface BrandKitSocialHandle {
  /** instagram | facebook | tiktok | x | youtube | linkedin | threads | snapchat | pinterest | shopify | other */
  platform: string;
  /** Verbatim handle ("@brand", "tiktok.com/@brand", "facebook.com/brand"). */
  handle: string;
  /** Source filename / page where this handle was found. */
  source?: string;
}

export interface BrandKitLogoCandidate {
  filename: string;
  /** PNG/JPG/WEBP buffer. */
  buffer: Buffer;
  mimeType: string;
  /** Confidence the OCR step had this is a brand logo (0-1). */
  confidence: number;
  /** Why we believe this is a logo (heuristic + vision rationale). */
  reason: string;
}

export interface BrandKit {
  /** The most likely brand name(s) found across the assets. */
  brandName?: string;
  /** Alternative spellings / DBA names. */
  brandNameAlternatives: string[];
  /** Tagline(s) / slogan(s). */
  taglines: string[];
  /** All social handles (deduplicated). */
  socialHandles: BrandKitSocialHandle[];
  /** All URLs (Shopify store, marketing site, etc). */
  urls: string[];
  /** All emails. */
  emails: string[];
  /** All phone numbers. */
  phones: string[];
  /** Hex colors detected (e.g. "#1A1A1A"). */
  hexColors: string[];
  /** Font family hints inferred by vision ("Helvetica Neue", "serif", …). */
  fonts: string[];
  /** Free-form printed text visible across the assets. */
  visibleText: string[];
  /** Logo candidates extracted from the source images. */
  logoCandidates: BrandKitLogoCandidate[];
  /** Per-source metadata (so the UI can tell the user where each came from). */
  sources: Array<{ filename: string; bytes: number; warnings: string[] }>;
  /** Soft warnings encountered during extraction. */
  warnings: string[];
}

const VISION_OCR_PROMPT = `You are a brand designer's OCR assistant. Look at the image and extract EVERYTHING printed/visible in it. Return STRICT JSON only, no prose, no fences.

Schema:
{
  "brandName": string | null,
  "brandNameAlternatives": string[],
  "taglines": string[],
  "socialHandles": [{ "platform": "instagram"|"facebook"|"tiktok"|"x"|"youtube"|"linkedin"|"threads"|"snapchat"|"pinterest"|"shopify"|"other", "handle": string }],
  "urls": string[],
  "emails": string[],
  "phones": string[],
  "hexColors": string[],
  "fonts": string[],
  "visibleText": string[],
  "looksLikeLogo": boolean,
  "logoConfidence": number,
  "logoReason": string
}

Rules:
- Extract ALL text exactly as printed (preserve casing, punctuation, accents).
- For social handles, normalize to "@handle" when the handle appears with @ or as username; use full URL when only the URL form appears (e.g. "tiktok.com/@brand").
- "looksLikeLogo": true if the image is dominated by a logo / wordmark / brand symbol on a clean background (white, transparent, brand color); false for product photos, screenshots, lifestyle photos.
- "logoConfidence": 0.0-1.0 (1.0 = clearly a logo asset).
- "logoReason": one short sentence explaining the heuristic.
- "hexColors": dominant brand colors visible (clean swatches, logo fill, brand-colored backgrounds). Skip product/scene colors.
- If a field is unknown or absent, use [] (empty array) or null.`;

interface VisionOcrResult {
  brandName: string | null;
  brandNameAlternatives: string[];
  taglines: string[];
  socialHandles: Array<{ platform: string; handle: string }>;
  urls: string[];
  emails: string[];
  phones: string[];
  hexColors: string[];
  fonts: string[];
  visibleText: string[];
  looksLikeLogo: boolean;
  logoConfidence: number;
  logoReason: string;
}

const EMPTY_OCR: VisionOcrResult = {
  brandName: null, brandNameAlternatives: [], taglines: [],
  socialHandles: [], urls: [], emails: [], phones: [],
  hexColors: [], fonts: [], visibleText: [],
  looksLikeLogo: false, logoConfidence: 0, logoReason: "",
};

async function ocrSingleImage(projectId: number, image: ExtractedImage): Promise<VisionOcrResult> {
  try {
    // Claude vision only accepts jpg/jpeg/png/webp/gif. Map anything else.
    let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/png";
    if (image.mimeType === "image/jpeg" || image.mimeType === "image/jpg") mediaType = "image/jpeg";
    else if (image.mimeType === "image/webp") mediaType = "image/webp";
    else if (image.mimeType === "image/gif") mediaType = "image/gif";
    else if (image.mimeType === "image/png") mediaType = "image/png";
    else {
      // Convert to PNG via sharp for unsupported (bmp/tiff/svg).
      try {
        const sharpMod = (await import("sharp")).default;
        const png = await sharpMod(image.buffer).png().toBuffer();
        return await ocrSingleImage(projectId, { ...image, buffer: png, mimeType: "image/png" });
      } catch {
        logger.warn({ filename: image.filename, mime: image.mimeType }, "brand-kit: unsupported mime, skip OCR");
        return EMPTY_OCR;
      }
    }

    const raw = await askClaudeWithVision(
      projectId,
      VISION_OCR_PROMPT,
      [{ base64: image.buffer.toString("base64"), mediaType }],
      "You are a precise OCR + brand-asset auditor. Always reply with strict JSON.",
      4096,
      120_000,
    );
    const parsed = safeJsonParse<VisionOcrResult>(raw, "brand-kit-ocr");
    return { ...EMPTY_OCR, ...parsed };
  } catch (err: any) {
    logger.warn({ err: err?.message, filename: image.filename }, "brand-kit: OCR failed for image");
    return EMPTY_OCR;
  }
}

// ─── REGEX HARVESTERS for raw text (PDF text layer, TXT, CSV, JSON…) ────
const RX_URL = /\b((?:https?:\/\/|www\.)[^\s<>"',]+)/gi;
const RX_EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const RX_PHONE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g;
const RX_HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
const RX_HANDLE = /@([a-zA-Z0-9._]{2,30})\b/g;
const RX_SOCIAL_URL = /(instagram|facebook|tiktok|twitter|x\.com|youtube|youtu\.be|linkedin|threads|snapchat|pinterest|myshopify|shopify)\.[a-z]{2,}\/[a-zA-Z0-9_./@-]+/gi;

function harvestFromText(text: string): Partial<VisionOcrResult> {
  const out: Partial<VisionOcrResult> = {
    urls: [], emails: [], phones: [], hexColors: [],
    socialHandles: [], visibleText: [],
  };
  for (const m of text.matchAll(RX_URL)) out.urls!.push(m[1]);
  for (const m of text.matchAll(RX_EMAIL)) out.emails!.push(m[0]);
  for (const m of text.matchAll(RX_HEX)) out.hexColors!.push(m[0]);
  // Phone regex is noisy — keep only strings with ≥7 digits (real phone heuristic).
  for (const m of text.matchAll(RX_PHONE)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) out.phones!.push(m[0].trim());
  }
  for (const m of text.matchAll(RX_HANDLE)) {
    const handle = `@${m[1]}`;
    out.socialHandles!.push({ platform: "other", handle });
  }
  for (const m of text.matchAll(RX_SOCIAL_URL)) {
    const url = m[0];
    const platform = m[1].toLowerCase().replace("x.com", "x").replace("youtu.be", "youtube").replace("myshopify", "shopify");
    out.socialHandles!.push({ platform, handle: url });
  }
  return out;
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim();
    if (!k) continue;
    const lc = k.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(k);
  }
  return out;
}

function dedupeHandles(arr: BrandKitSocialHandle[]): BrandKitSocialHandle[] {
  const seen = new Set<string>();
  const out: BrandKitSocialHandle[] = [];
  for (const h of arr) {
    const k = `${h.platform.toLowerCase()}::${h.handle.toLowerCase().trim()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

function pickMostFrequent(values: Array<string | null | undefined>): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    const k = v.trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  if (!counts.size) return undefined;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Collect ALL images recursively (top-level + ZIP children) from extracted assets.
 */
function collectAllImages(assets: ExtractedAsset[]): ExtractedImage[] {
  const out: ExtractedImage[] = [];
  const walk = (a: ExtractedAsset) => {
    out.push(...a.images);
    for (const c of a.children ?? []) walk(c);
  };
  for (const a of assets) walk(a);
  return out;
}

function collectAllText(assets: ExtractedAsset[]): string {
  const parts: string[] = [];
  const walk = (a: ExtractedAsset) => {
    for (const t of a.textBlocks) parts.push(t.text);
    for (const c of a.children ?? []) walk(c);
  };
  for (const a of assets) walk(a);
  return parts.join("\n\n");
}

export interface ExtractBrandKitOptions {
  /** Cap how many images we OCR (each call ≈ $0.005-$0.02). Default 12. */
  maxOcrImages?: number;
  /** Concurrency for OCR calls. Default 3. */
  ocrConcurrency?: number;
}

/**
 * Extract a complete BrandKit from a list of files (PDF/ZIP/PNG/…).
 * The flow:
 *   1) lib/file-extractor parses each file → text blocks + image buffers
 *   2) Regex harvest URLs/emails/phones/hex/handles from raw text
 *   3) Claude Vision OCR each image (capped) → harvest text + logos
 *   4) Aggregate, deduplicate, and pick the most likely brand name
 *   5) Return BrandKit
 */
export async function extractBrandKitFromFiles(
  projectId: number,
  files: Array<{ buffer: Buffer; filename: string; mimeType?: string }>,
  options: ExtractBrandKitOptions = {},
): Promise<BrandKit> {
  const maxOcr = Math.max(1, Math.min(40, options.maxOcrImages ?? 12));
  const concurrency = Math.max(1, Math.min(6, options.ocrConcurrency ?? 3));

  // 1) Extract raw text + images
  const assets = await extractFromBuffers(files);

  // 2) Regex harvest from any plain text we found (PDF text layers, TXT, etc.)
  const rawText = collectAllText(assets);
  const textHarvest = harvestFromText(rawText);

  // 3) OCR up to N images via Claude Vision (concurrent).
  const allImages = collectAllImages(assets);
  // Heuristic: prioritise smaller files (logos are usually <200KB) so we OCR
  // logos first, then product photos.
  const ranked = [...allImages].sort((a, b) => a.buffer.length - b.buffer.length).slice(0, maxOcr);

  const ocrResults: Array<{ image: ExtractedImage; ocr: VisionOcrResult }> = new Array(ranked.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= ranked.length) return;
        const img = ranked[i];
        ocrResults[i] = { image: img, ocr: await ocrSingleImage(projectId, img) };
      }
    }),
  );

  // 4) Aggregate
  const brandName = pickMostFrequent([
    ...ocrResults.map((r) => r.ocr.brandName),
  ]);
  const brandNameAlternatives = dedupeStrings([
    ...ocrResults.flatMap((r) => r.ocr.brandNameAlternatives),
    ...ocrResults.map((r) => r.ocr.brandName).filter((b): b is string => !!b && b !== brandName),
  ]);
  const taglines = dedupeStrings(ocrResults.flatMap((r) => r.ocr.taglines));
  const visibleText = dedupeStrings(ocrResults.flatMap((r) => r.ocr.visibleText));
  const fonts = dedupeStrings(ocrResults.flatMap((r) => r.ocr.fonts));
  const hexColors = dedupeStrings([
    ...ocrResults.flatMap((r) => r.ocr.hexColors),
    ...(textHarvest.hexColors || []),
  ]).map((c) => c.toUpperCase());
  const urls = dedupeStrings([
    ...ocrResults.flatMap((r) => r.ocr.urls),
    ...(textHarvest.urls || []),
  ]);
  const emails = dedupeStrings([
    ...ocrResults.flatMap((r) => r.ocr.emails),
    ...(textHarvest.emails || []),
  ]);
  const phones = dedupeStrings([
    ...ocrResults.flatMap((r) => r.ocr.phones),
    ...(textHarvest.phones || []),
  ]);
  const socialHandles = dedupeHandles([
    ...ocrResults.flatMap((r) => r.ocr.socialHandles),
    ...(textHarvest.socialHandles || []),
  ]);

  const logoCandidates: BrandKitLogoCandidate[] = ocrResults
    .filter((r) => r.ocr.looksLikeLogo && r.ocr.logoConfidence >= 0.55)
    .map((r) => ({
      filename: r.image.filename,
      buffer: r.image.buffer,
      mimeType: r.image.mimeType,
      confidence: r.ocr.logoConfidence,
      reason: r.ocr.logoReason || "",
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const sources = assets.map((a) => ({
    filename: a.filename,
    bytes: a.bytes,
    warnings: a.warnings,
  }));

  const warnings: string[] = [];
  if (allImages.length > maxOcr) warnings.push(`Found ${allImages.length} images; only OCR'd the first ${maxOcr} (size-prioritised). Increase maxOcrImages to OCR more.`);

  logger.info({
    files: files.length, totalImages: allImages.length, ocrRan: ranked.length,
    brandName, taglines: taglines.length, urls: urls.length,
    handles: socialHandles.length, hexColors: hexColors.length, logos: logoCandidates.length,
  }, "brand-kit: extracted");

  return {
    brandName,
    brandNameAlternatives,
    taglines,
    socialHandles,
    urls,
    emails,
    phones,
    hexColors,
    fonts,
    visibleText,
    logoCandidates,
    sources,
    warnings,
  };
}
