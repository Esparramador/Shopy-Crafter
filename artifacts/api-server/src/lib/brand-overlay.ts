/**
 * BRAND OVERLAY ENGINE — deterministic text + logo composite for video.
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this module exists:
 *   AI image/video models (Runway, Kling, Seedance, Hailuo, Veo) routinely
 *   hallucinate misspelled text, garbled brand names and broken logos. The
 *   ONLY reliable production pattern is to forbid text in the AI prompt and
 *   then BURN the brand layer afterwards with FFmpeg drawtext + overlay.
 *
 *   This is exactly the same separation Reels/Shorts/TikTok captions use,
 *   the same approach Apple Keynote and Netflix subtitles use, and the same
 *   approach `adstudio.ts` already uses
 *   for the brand+CTA pair. This module generalises it for ANY layer set:
 *   brand name, tagline, social handles (@instagram / @tiktok / @x / …),
 *   URL / Shopify store, custom CTA, and a logo PNG composite — each with
 *   independent timing, fade, position, color and box style.
 *
 * Inputs:
 *   - videoBuffer: the rendered video (mp4)
 *   - config.layers: array of text overlays (brand, tagline, handle, url, cta…)
 *   - config.logo: optional logo image (jpg/png/webp) to composite as PNG
 *
 * Output:
 *   - Buffer of the new mp4 with overlays burned in
 *
 * Guarantees:
 *   - Spelling is byte-perfect (text rendered by FFmpeg, never by an AI)
 *   - DejaVu Sans Bold is present at /usr/share/fonts/truetype/dejavu (Nix)
 *   - Logo is composited as RGBA PNG via Sharp → FFmpeg `overlay` filter
 *   - Auto fontsize fit so text never overflows the safe area
 *   - Time-windowed enable + fade in/out via the `alpha` expression
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger } from "./logger.js";

// ─── FONT PATHS ──────────────────────────────────────────────────────────
// DejaVu is the system default on Replit/Nix and is installed for both the
// dev container and the published deploy. We FAIL LOUD if the bold variant
// is missing because shipping an ad without legible brand text is wrong.
const DEJAVU_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const DEJAVU_REGULAR_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const DEJAVU_SERIF_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf";

export interface BrandOverlayLayer {
  /** The literal text to render. Will be normalized but NOT spell-corrected. */
  text: string;
  /** Free-form role for logging/UX. e.g. "brand" | "tagline" | "handle"
   *  | "url" | "cta" | "custom". Has no rendering side-effects. */
  role?: string;
  /** Font size in px applied to the source video resolution. If omitted we
   *  auto-fit the longest text into the safe area for the chosen position. */
  fontSize?: number;
  /** Hex color e.g. "#ffffff" | "#C8A84B". Default `#ffffff`. */
  color?: string;
  /** Vertical/horizontal anchor. Use `yRatio` for fine control. */
  position?:
    | "top" | "center" | "bottom"
    | "top-left" | "top-center" | "top-right"
    | "bottom-left" | "bottom-center" | "bottom-right";
  /** Override y as ratio of frame height [0, 1]. */
  yRatio?: number;
  /** Override x as ratio of frame width [0, 1]. */
  xRatio?: number;
  /** Time window in seconds (relative to the input video timeline). */
  start: number;
  end: number;
  /** Fade in/out durations in seconds. Default 0.4 / 0.4. */
  fadeIn?: number;
  fadeOut?: number;
  /** Backdrop box behind the text. Default true. */
  box?: boolean;
  /** Backdrop hex color, default `#000000`. */
  boxColor?: string;
  /** Backdrop opacity 0-1, default 0.55. */
  boxOpacity?: number;
  /** "bold" → DejaVu Sans Bold (default), "regular" → DejaVu Sans,
   *  "serif" → DejaVu Serif Bold. */
  fontStyle?: "bold" | "regular" | "serif";
  /** Letter-spacing emulation via padding (px). Default 0. */
  letterSpacing?: number;
}

export interface BrandOverlayLogo {
  /** Logo image bytes (jpg/jpeg/png/webp). Will be normalised to PNG with alpha. */
  buffer: Buffer;
  /** Mime type of the input buffer. */
  mimeType?: string;
  /** Anchor position. Default "top-right". */
  position?:
    | "top-left" | "top-right" | "top-center"
    | "bottom-left" | "bottom-right" | "bottom-center"
    | "center";
  /** Logo target width in px. Default ≈ frameWidth * 0.18. */
  width?: number;
  /** Margin from the chosen edge in px. Default ≈ frameHeight * 0.05. */
  margin?: number;
  /** Logo opacity 0-1. Default 1.0. */
  opacity?: number;
  /** Time window. Default = whole video. */
  start?: number;
  end?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface BrandOverlayConfig {
  /** Text overlays. Empty array is allowed (logo only). */
  layers: BrandOverlayLayer[];
  /** Optional logo image overlay. */
  logo?: BrandOverlayLogo;
}

export interface BrandOverlayResult {
  /** The new video bytes. */
  buffer: Buffer;
  /** True if any layer/logo was actually drawn. */
  applied: boolean;
  /** Layers that were skipped because their text was empty. */
  skipped: string[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

async function makeTmpDir(prefix = "brand-overlay"): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  return dir;
}

async function resolveFfmpegPath(): Promise<string> {
  // Prefer the system ffmpeg on PATH (provided by Nix runtime); fall back to
  // ffmpeg-static so the binary is always available even if PATH is broken.
  try {
    const which = await import("node:child_process");
    return await new Promise<string>((resolve, reject) => {
      which.exec("which ffmpeg", (err, stdout) => {
        if (err || !stdout.trim()) return reject(err || new Error("no ffmpeg"));
        resolve(stdout.trim());
      });
    });
  } catch {
    const ff = (await import("ffmpeg-static")).default as unknown as string | null;
    if (!ff) throw new Error("ffmpeg binary not found (system PATH and ffmpeg-static both unavailable)");
    return ff;
  }
}

/**
 * Normalize text for FFmpeg drawtext. We write the text to a `textfile=` so
 * we don't need to escape `:`, `'`, `\`, etc. — but we still strip control
 * chars and collapse whitespace so the output reads cleanly.
 */
function normalizeText(raw: string, maxLen = 80): string {
  const cleaned = String(raw || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Escape a filesystem path for use inside an FFmpeg complex filter expression. */
function escFilterPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

/** Parse a hex color (#rrggbb / #rgb / rrggbb) → FFmpeg-acceptable `0xRRGGBB`. */
function hexToFfmpegColor(hex: string | undefined, fallback = "white"): string {
  if (!hex) return fallback;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return fallback;
  return `0x${h.toUpperCase()}`;
}

/** Build the alpha expression that handles fade-in / fade-out within a window. */
function alphaExpr(t0: number, t1: number, fIn: number, fOut: number): string {
  // Output range [0..1]. Outside [t0,t1] we explicitly enable=0 via the
  // `enable` flag, but the alpha expr also stays at 0 for safety.
  const inEnd = t0 + Math.max(0, fIn);
  const outStart = t1 - Math.max(0, fOut);
  // Piecewise: ramp up between t0..inEnd, hold 1 to outStart, ramp down to t1.
  return [
    `if(lt(t,${t0.toFixed(3)}),0,`,
    `if(lt(t,${inEnd.toFixed(3)}),(t-${t0.toFixed(3)})/${Math.max(0.0001, fIn).toFixed(3)},`,
    `if(lt(t,${outStart.toFixed(3)}),1,`,
    `if(lt(t,${t1.toFixed(3)}),1-((t-${outStart.toFixed(3)})/${Math.max(0.0001, fOut).toFixed(3)}),0))))`,
  ].join("");
}

async function probeVideoMeta(filePath: string): Promise<{ durationSec: number; width: number; height: number; fps: number }> {
  const ffmpeg = (await import("fluent-ffmpeg")).default;
  return await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: any) => {
      if (err) return reject(err);
      const v = (data?.streams || []).find((s: any) => s.codec_type === "video");
      const durationSec = Number(data?.format?.duration) || Number(v?.duration) || 0;
      const width = Number(v?.width) || 0;
      const height = Number(v?.height) || 0;
      const [num, den] = String(v?.r_frame_rate || "30/1").split("/").map(Number);
      const fps = den ? Math.round(num / den) : 30;
      if (!durationSec || !width || !height) {
        return reject(new Error(`ffprobe: invalid metadata duration=${durationSec} ${width}x${height}`));
      }
      resolve({ durationSec, width, height, fps });
    });
  });
}

/** Auto-fit fontsize so the longest line fits in `safeWidthPx`. Heuristic:
 *  DejaVu Sans Bold averages ≈ 0.55*fontSize per glyph at the rendered px
 *  height. We start from `target` and clamp to [min, target]. */
function autoFitFontSize(text: string, safeWidthPx: number, target: number, min = 18): number {
  const len = Math.max(1, text.length);
  // `0.58` is a measured upper bound for DejaVu Sans Bold mean glyph width
  // (taller upper-case strings + numerics). Add a small safety pad so the
  // box border doesn't kiss the safe edge.
  const maxByWidth = Math.floor((safeWidthPx * 0.96) / (len * 0.58));
  return Math.max(min, Math.min(target, maxByWidth));
}

function fontPathForStyle(style: BrandOverlayLayer["fontStyle"]): string {
  if (style === "regular") return DEJAVU_REGULAR_PATH;
  if (style === "serif") return DEJAVU_SERIF_BOLD_PATH;
  return DEJAVU_BOLD_PATH;
}

function yPxForLayer(layer: BrandOverlayLayer, fontSize: number, height: number): string {
  if (typeof layer.yRatio === "number") {
    return `${Math.round(height * layer.yRatio)}`;
  }
  // box height ≈ fontSize * 1.5
  const boxH = Math.round(fontSize * 1.5);
  switch (layer.position) {
    case "top":
    case "top-left":
    case "top-center":
    case "top-right":
      return `${Math.round(height * 0.06)}`;
    case "bottom":
    case "bottom-left":
    case "bottom-center":
    case "bottom-right":
      return `${Math.round(height * 0.92) - boxH}`;
    case "center":
    default:
      return `(h-${boxH})/2`;
  }
}

function xExprForLayer(layer: BrandOverlayLayer, width: number): string {
  if (typeof layer.xRatio === "number") {
    // x is the LEFT edge of the text box; the user passes the anchor as a
    // ratio of the frame width — we approximate the anchor as the left edge.
    return `${Math.round(width * layer.xRatio)}`;
  }
  switch (layer.position) {
    case "top-left":
    case "bottom-left":
      return `${Math.round(width * 0.05)}`;
    case "top-right":
    case "bottom-right":
      return `w-text_w-${Math.round(width * 0.05)}`;
    default:
      return "(w-text_w)/2";
  }
}

function logoPositionXY(width: number, height: number, logoW: number, logoH: number, pos: BrandOverlayLogo["position"], margin: number): { x: string; y: string } {
  const m = margin;
  switch (pos) {
    case "top-left":      return { x: `${m}`,                        y: `${m}` };
    case "top-center":    return { x: `(W-w)/2`,                     y: `${m}` };
    case "top-right":     return { x: `W-w-${m}`,                    y: `${m}` };
    case "bottom-left":   return { x: `${m}`,                        y: `H-h-${m}` };
    case "bottom-center": return { x: `(W-w)/2`,                     y: `H-h-${m}` };
    case "bottom-right":  return { x: `W-w-${m}`,                    y: `H-h-${m}` };
    case "center":        return { x: `(W-w)/2`,                     y: `(H-h)/2` };
    default:              return { x: `W-w-${m}`,                    y: `${m}` };
  }
}

/**
 * Apply a brand overlay (text layers + optional logo) to a video buffer.
 *
 * The function NEVER throws on empty/no-op input — it returns the original
 * buffer with `applied=false`. It DOES throw if the font is missing, because
 * shipping an ad without legible brand text is unacceptable.
 */
export async function applyBrandOverlay(
  videoBuffer: Buffer,
  config: BrandOverlayConfig,
): Promise<BrandOverlayResult> {
  // Sanity check: nothing to do?
  const hasLayers = (config.layers?.length ?? 0) > 0;
  const hasLogo = !!config.logo?.buffer && config.logo.buffer.length > 0;
  if (!hasLayers && !hasLogo) {
    return { buffer: videoBuffer, applied: false, skipped: [] };
  }

  // Verify font availability — fail loud.
  try {
    await fs.access(DEJAVU_BOLD_PATH);
  } catch {
    logger.error({ path: DEJAVU_BOLD_PATH }, "brand-overlay: DejaVu Bold MISSING");
    throw new Error(
      `Brand overlay font not installed: ${DEJAVU_BOLD_PATH}. ` +
      `Install with the system package fonts-dejavu-core. ` +
      `Refusing to ship a video without legible brand typography.`,
    );
  }

  const tmp = await makeTmpDir("brand-overlay");
  try {
    const inPath = path.join(tmp, "in.mp4");
    const outPath = path.join(tmp, "out.mp4");
    await fs.writeFile(inPath, videoBuffer);

    const { durationSec, width, height } = await probeVideoMeta(inPath);
    const margin = Math.round(height * 0.04);
    const safeW = Math.max(100, width - 2 * margin);

    // ─── Prepare logo as a normalized RGBA PNG (handles alpha + opacity) ──
    let logoPngPath: string | null = null;
    let logoMeta: { width: number; height: number } | null = null;
    if (hasLogo) {
      const sharpMod = (await import("sharp")).default;
      const wantW = config.logo!.width ?? Math.round(width * 0.18);
      const pipeline = sharpMod(config.logo!.buffer)
        .resize({ width: wantW, withoutEnlargement: false })
        .png({ compressionLevel: 9 });
      const out = await pipeline.toBuffer({ resolveWithObject: true });
      logoPngPath = path.join(tmp, "logo.png");
      await fs.writeFile(logoPngPath, out.data);
      logoMeta = { width: out.info.width, height: out.info.height };
    }

    // ─── Build the complex filter graph ──────────────────────────────────
    const filters: string[] = [];
    const skipped: string[] = [];

    // Stream label that the next filter consumes. Starts as `[0:v]` (the source).
    let lastV = "[0:v]";
    let stage = 0;

    // Logo composite first (so text can sit ON TOP of the logo if needed).
    if (logoPngPath && logoMeta) {
      const logoCfg = config.logo!;
      const opacity = Math.max(0, Math.min(1, logoCfg.opacity ?? 1.0));
      const lstart = Math.max(0, logoCfg.start ?? 0);
      const lend = Math.min(durationSec, logoCfg.end ?? durationSec);
      const lfIn = logoCfg.fadeIn ?? 0.4;
      const lfOut = logoCfg.fadeOut ?? 0.4;
      const lmargin = logoCfg.margin ?? Math.round(height * 0.05);
      const { x: lx, y: ly } = logoPositionXY(width, height, logoMeta.width, logoMeta.height, logoCfg.position ?? "top-right", lmargin);

      // Pre-process: format=rgba, apply global opacity via colorchannelmixer
      // and a time-windowed alpha multiplier via `format=rgba` + `setpts`
      // path is awkward; the cleanest is to use overlay's `enable=` and
      // apply opacity through a `colorchannelmixer aa=opacity`. Fade in/out
      // we emulate with an extra `fade=alpha` filter on the logo input.
      const logoChain: string[] = [
        `format=rgba`,
        `colorchannelmixer=aa=${opacity.toFixed(3)}`,
      ];
      if (lfIn > 0) logoChain.push(`fade=t=in:st=${lstart.toFixed(3)}:d=${lfIn.toFixed(3)}:alpha=1`);
      if (lfOut > 0) logoChain.push(`fade=t=out:st=${(lend - lfOut).toFixed(3)}:d=${lfOut.toFixed(3)}:alpha=1`);
      filters.push(`[1:v]${logoChain.join(",")}[lg]`);

      const nextV = `[v${++stage}]`;
      filters.push(
        `${lastV}[lg]overlay=${lx}:${ly}:enable='between(t\\,${lstart.toFixed(3)}\\,${lend.toFixed(3)})':eof_action=pass${nextV}`,
      );
      lastV = nextV;
    }

    // Text layers
    for (const rawLayer of config.layers ?? []) {
      const text = normalizeText(rawLayer.text, 80);
      if (!text) {
        skipped.push(rawLayer.role || "unnamed");
        continue;
      }

      // Default font size scales with frame HEIGHT and the role hint:
      // brand → big, tagline → mid, handle/url/cta → small-mid.
      const role = (rawLayer.role || "").toLowerCase();
      const targetFs = rawLayer.fontSize
        ?? (role === "brand" ? Math.round(height * 0.075)
            : role === "tagline" ? Math.round(height * 0.045)
            : role === "handle" || role === "url" ? Math.round(height * 0.035)
            : role === "cta" ? Math.round(height * 0.06)
            : Math.round(height * 0.05));
      const fs2 = autoFitFontSize(text, safeW, targetFs);

      const start = Math.max(0, rawLayer.start);
      const end = Math.min(durationSec, rawLayer.end);
      if (end <= start) {
        skipped.push(rawLayer.role || "unnamed");
        continue;
      }
      const fIn = rawLayer.fadeIn ?? 0.4;
      const fOut = rawLayer.fadeOut ?? 0.4;
      const color = hexToFfmpegColor(rawLayer.color, "white");
      const fontFile = fontPathForStyle(rawLayer.fontStyle);
      const fontEsc = escFilterPath(fontFile);

      // Backdrop box.
      const wantBox = rawLayer.box !== false; // default true
      const boxColor = hexToFfmpegColor(rawLayer.boxColor, "0x000000");
      const boxOpacity = Math.max(0, Math.min(1, rawLayer.boxOpacity ?? 0.55));
      const boxArgs = wantBox
        ? `:box=1:boxcolor=${boxColor}@${boxOpacity}:boxborderw=${Math.max(8, Math.round(fs2 * 0.35))}`
        : ``;

      const xExpr = xExprForLayer(rawLayer, width);
      const yExpr = yPxForLayer(rawLayer, fs2, height);
      const aExpr = alphaExpr(start, end, fIn, fOut);

      // Write the text to a file so we don't need to escape : ' \ etc.
      const textFile = path.join(tmp, `t${stage}-${(role || "x").replace(/[^a-z0-9]/gi, "")}.txt`);
      await fs.writeFile(textFile, text, "utf8");
      const textEsc = escFilterPath(textFile);

      // Letter-spacing emulation via outer borderw doubling — minor effect,
      // but keeps the API surface predictable. Most callers omit this.
      const ls = rawLayer.letterSpacing && rawLayer.letterSpacing > 0
        ? `:borderw=${Math.max(2, Math.round(fs2 * 0.05))}` : `:borderw=3`;

      const nextV = `[v${++stage}]`;
      filters.push(
        `${lastV}drawtext=fontfile='${fontEsc}':textfile='${textEsc}'` +
        `:fontsize=${fs2}:fontcolor=${color}` +
        boxArgs +
        ls +
        `:bordercolor=black@0.9` +
        `:shadowcolor=black@0.55:shadowx=0:shadowy=2` +
        `:x=${xExpr}:y=${yExpr}` +
        `:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'` +
        `:alpha='${aExpr}'` +
        `${nextV}`,
      );
      lastV = nextV;
    }

    // Did we actually emit any filter?
    if (filters.length === 0) {
      logger.warn({ skipped }, "brand-overlay: nothing to draw — returning original");
      return { buffer: videoBuffer, applied: false, skipped };
    }

    // Tag the final stream as [vout]
    const lastFilterIdx = filters.length - 1;
    filters[lastFilterIdx] = filters[lastFilterIdx].replace(lastV, "[vout]");
    lastV = "[vout]";

    // ─── Run FFmpeg ──────────────────────────────────────────────────────
    const ffmpegLib = (await import("fluent-ffmpeg")).default;
    ffmpegLib.setFfmpegPath(await resolveFfmpegPath());

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpegLib(inPath);
      if (logoPngPath) cmd.input(logoPngPath);
      cmd
        .complexFilter(filters, ["vout"])
        .videoCodec("libx264")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-map 0:a?",   // keep original audio if present
          "-c:a copy",
        ])
        .on("start", (cmdLine: string) => logger.info({ cmd: cmdLine.slice(0, 500) }, "brand-overlay: ffmpeg start"))
        .on("error", (err: Error) => reject(err))
        .on("end", () => resolve())
        .save(outPath);
    });

    const out = await fs.readFile(outPath);
    logger.info({ inBytes: videoBuffer.length, outBytes: out.length, layers: config.layers?.length ?? 0, hasLogo }, "brand-overlay: applied");
    return { buffer: out, applied: true, skipped };
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => { });
  }
}

// ─── HIGH-LEVEL HELPER: build a sensible config from a BrandKit ──────────
//
// The BrandKit (extracted via lib/brand-kit-extractor) gives us
// brand name, taglines, social handles, URLs, palette and a logo. This
// helper builds an opinionated 3-segment overlay (intro brand reveal +
// persistent footer with handles/URL + outro CTA) so callers don't have
// to spell out every layer by hand.

export interface AutoBrandOverlayInput {
  videoDurationSec: number;
  brandName?: string;
  tagline?: string;
  /** e.g. ["@brand_ig", "tiktok.com/@brand"] — we render up to 2 lines. */
  socialHandles?: Array<{ platform: string; handle: string }>;
  url?: string;
  ctaText?: string;
  /** Logo PNG/JPG buffer + mime. */
  logo?: { buffer: Buffer; mimeType?: string };
  /** Hex accent color from the brand palette. Default `#C8A84B` (gold). */
  accentHex?: string;
  /** Aspect-aware safe positioning. "9:16" | "1:1" | "16:9" | "4:5". */
  aspect?: "9:16" | "1:1" | "16:9" | "4:5";
}

export function buildAutoBrandOverlay(input: AutoBrandOverlayInput): BrandOverlayConfig {
  const dur = Math.max(2, input.videoDurationSec);
  const introEnd = Math.min(4.5, dur * 0.35);
  const outroStart = Math.max(introEnd + 0.5, dur - 4.0);
  const outroEnd = dur - 0.1;
  const layers: BrandOverlayLayer[] = [];

  // Intro: brand name (top) + optional tagline below.
  if (input.brandName) {
    layers.push({
      text: input.brandName,
      role: "brand",
      position: "top",
      start: 0.4,
      end: introEnd,
      fadeIn: 0.6,
      fadeOut: 0.5,
      color: "#ffffff",
      boxOpacity: 0.55,
      fontStyle: "bold",
    });
  }
  if (input.tagline) {
    layers.push({
      text: input.tagline,
      role: "tagline",
      position: "top",
      yRatio: 0.18,
      start: 0.7,
      end: introEnd,
      fadeIn: 0.5,
      fadeOut: 0.4,
      color: "#ffffff",
      boxOpacity: 0.4,
      fontStyle: "regular",
    });
  }

  // Persistent footer: social handles (compact, semi-transparent).
  // We render up to 2 handle lines so the footer doesn't dominate the frame.
  const handles = (input.socialHandles ?? []).slice(0, 2);
  for (let i = 0; i < handles.length; i++) {
    const h = handles[i];
    const display = `${platformGlyph(h.platform)}  ${h.handle}`;
    layers.push({
      text: display,
      role: "handle",
      position: "bottom",
      yRatio: i === 0 ? 0.92 : 0.96,
      start: 0.4,
      end: dur - 0.1,
      fadeIn: 0.5,
      fadeOut: 0.5,
      color: "#ffffff",
      boxOpacity: 0.45,
      fontStyle: "regular",
    });
  }

  // Outro: URL + CTA (gold for the conversion moment).
  if (input.url) {
    layers.push({
      text: input.url,
      role: "url",
      position: "bottom",
      yRatio: 0.78,
      start: outroStart,
      end: outroEnd,
      fadeIn: 0.4,
      fadeOut: 0.4,
      color: "#ffffff",
      boxOpacity: 0.6,
      fontStyle: "regular",
    });
  }
  if (input.ctaText) {
    layers.push({
      text: input.ctaText,
      role: "cta",
      position: "bottom",
      yRatio: 0.7,
      start: outroStart,
      end: outroEnd,
      fadeIn: 0.4,
      fadeOut: 0.4,
      color: input.accentHex || "#C8A84B",
      boxOpacity: 0.65,
      fontStyle: "bold",
    });
  }

  const config: BrandOverlayConfig = { layers };
  if (input.logo?.buffer && input.logo.buffer.length > 0) {
    config.logo = {
      buffer: input.logo.buffer,
      mimeType: input.logo.mimeType,
      position: "top-right",
      width: undefined,    // auto = ~18% frame width
      margin: undefined,   // auto
      opacity: 0.95,
      start: 0,
      end: dur,
      fadeIn: 0.6,
      fadeOut: 0.5,
    };
  }
  return config;
}

function platformGlyph(platform: string): string {
  const p = (platform || "").toLowerCase();
  if (p.includes("insta")) return "[IG]";
  if (p.includes("tiktok") || p === "tt") return "[TT]";
  if (p.includes("twitter") || p === "x") return "[X]";
  if (p.includes("face") || p === "fb") return "[FB]";
  if (p.includes("youtu") || p === "yt") return "[YT]";
  if (p.includes("linked")) return "[IN]";
  if (p.includes("threads")) return "[TH]";
  if (p.includes("snap")) return "[SC]";
  if (p.includes("pinte")) return "[PI]";
  if (p.includes("shop")) return "[SHOP]";
  if (p.includes("web") || p.includes("url")) return "[WEB]";
  return `[${platform.slice(0, 4).toUpperCase()}]`;
}
