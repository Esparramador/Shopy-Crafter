import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";

export type NanoBananaResult = {
  buffer: Buffer;
  mimeType: string;
  provider: "gemini" | "replicate";
};

export type NanoBananaRef = { buffer: Buffer; mimeType: string };

export type NanoBananaOpts = {
  aspectRatio?: string;
  references?: NanoBananaRef[];
  replicateToken?: string;
  outputFormat?: "png" | "jpg";
  /** Quality tier. "v1" = Gemini 2.5 Flash Image (fast/cheap, default).
   *  "pro" = Gemini 3 Pro Image / nano-banana-pro (4K, sharper, premium). */
  tier?: NanoBananaTier;
};

// ── Nano Banana v1 (Gemini 2.5 Flash Image) — fast, cheap, brand-consistent
const MODEL_GEMINI_V1 = "gemini-2.5-flash-image";
const MODEL_REPLICATE_V1 = "google/nano-banana";
// ── Nano Banana v2 / Pro (Gemini 3 Pro Image) — 4K, sharper text rendering,
//    better identity lock, top-tier reasoning. Released Nov 2025.
const MODEL_GEMINI_V2 = "gemini-3-pro-image-preview";
const MODEL_REPLICATE_V2 = "google/nano-banana-pro";

export type NanoBananaTier = "v1" | "pro";

// Circuit breaker: when Gemini fails with a configuration-level error
// (invalid key, no permission), all subsequent requests skip Gemini for
// `GEMINI_COOLDOWN_MS` to avoid wasting latency on every call. Quota / 5xx
// failures are NOT cached because they're transient.
const GEMINI_COOLDOWN_MS = 60_000;
let _geminiCooldownUntil = 0;
let _geminiCooldownReason = "";

function isGeminiCooledDown(): boolean {
  return _geminiCooldownUntil > Date.now();
}

function tripGeminiCircuit(reason: string): void {
  _geminiCooldownUntil = Date.now() + GEMINI_COOLDOWN_MS;
  _geminiCooldownReason = reason;
  logger.warn({ reason, cooldownMin: GEMINI_COOLDOWN_MS / 60_000 }, "nano-banana: Gemini circuit OPEN");
}

let _bootCheckDone = false;
function bootCheck(): void {
  if (_bootCheckDone) return;
  _bootCheckDone = true;
  const hasGoogle = !!process.env.GOOGLE_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (hasGoogle && hasGemini) {
    logger.warn(
      "nano-banana: BOTH GOOGLE_API_KEY and GEMINI_API_KEY are set. The @google/genai SDK prefers GOOGLE_API_KEY — if it is invalid, every Gemini call will 403 and silently fall back to Replicate. Verify GOOGLE_API_KEY is valid or unset it.",
    );
  } else if (!hasGoogle && !hasGemini) {
    logger.warn("nano-banana: neither GOOGLE_API_KEY nor GEMINI_API_KEY is set. All Nano Banana calls will go to Replicate.");
  }
}

function getGeminiKey(): string | null {
  bootCheck();
  return process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || null;
}

function getReplicateToken(override?: string): string | null {
  return override || process.env.REPLICATE_API_TOKEN || null;
}

function bufferToDataUri(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function fetchToBuffer(url: string, timeoutMs = 60_000): Promise<{ buffer: Buffer; mimeType: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) throw new Error(`fetch ${r.status}`);
    const ct = r.headers.get("content-type") || "image/png";
    return { buffer: Buffer.from(await r.arrayBuffer()), mimeType: ct.split(";")[0].trim() };
  } finally {
    clearTimeout(t);
  }
}

function classifyGeminiError(err: any): { retryable: boolean; reason: string } {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  if (status === 403 || msg.includes("permission_denied") || msg.includes("denied access") || msg.includes("api key")) {
    return { retryable: true, reason: "permission_denied" };
  }
  if (status === 429 || msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted")) {
    return { retryable: true, reason: "quota" };
  }
  if (status >= 500 && status < 600) return { retryable: true, reason: `gemini_5xx_${status}` };
  if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("fetch failed") || msg.includes("network")) {
    return { retryable: true, reason: "network" };
  }
  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("prohibited_content")) {
    return { retryable: false, reason: "safety" };
  }
  if (msg.includes("no devolvió imagen") || msg.includes("no image data") || msg.includes("returned no image")) {
    return { retryable: true, reason: "no_image_data" };
  }
  return { retryable: true, reason: msg.slice(0, 80) || "unknown" };
}

async function tryGemini(
  prompt: string,
  opts: NanoBananaOpts,
): Promise<NanoBananaResult> {
  const key = getGeminiKey();
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  const ai = new GoogleGenAI({ apiKey: key });
  const refs = opts.references || [];
  const contents: any =
    refs.length === 0
      ? prompt
      : [
          { text: prompt },
          ...refs.map((r) => ({
            inlineData: { mimeType: r.mimeType || "image/png", data: r.buffer.toString("base64") },
          })),
        ];

  const config: any = { responseModalities: ["IMAGE"] };
  if (opts.aspectRatio) config.imageConfig = { aspectRatio: opts.aspectRatio };

  const geminiModel = opts.tier === "pro" ? MODEL_GEMINI_V2 : MODEL_GEMINI_V1;
  const result = await ai.models.generateContent({
    model: geminiModel,
    contents,
    config,
  });

  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as any).inlineData || (part as any).inline_data;
    if (inline?.data) {
      const mimeType = inline.mimeType || inline.mime_type || "image/png";
      return { buffer: Buffer.from(inline.data as string, "base64"), mimeType, provider: "gemini" };
    }
  }
  const candidate = result?.candidates?.[0];
  const finishReason = (candidate as any)?.finishReason;
  const blockReason = (result as any)?.promptFeedback?.blockReason;
  throw new Error(`Nano Banana (Gemini) returned no image. finish=${finishReason} block=${blockReason}`);
}

async function tryReplicate(
  prompt: string,
  opts: NanoBananaOpts,
): Promise<NanoBananaResult> {
  const token = getReplicateToken(opts.replicateToken);
  if (!token) throw new Error("REPLICATE_API_TOKEN no configurada");

  const Replicate = (await import("replicate")).default;
  const rep = new Replicate({ auth: token });

  const input: any = {
    prompt,
    output_format: opts.outputFormat || "png",
  };
  if (opts.aspectRatio) input.aspect_ratio = opts.aspectRatio;
  const refs = opts.references || [];
  if (refs.length > 0) {
    input.image_input = refs.map((r) => bufferToDataUri(r.buffer, r.mimeType || "image/png"));
  }

  const replicateModel = opts.tier === "pro" ? MODEL_REPLICATE_V2 : MODEL_REPLICATE_V1;
  const output = await rep.run(replicateModel as `${string}/${string}`, { input });
  const raw = Array.isArray(output) ? output[0] : output;

  let url: any;
  if (typeof raw === "string") url = raw;
  else if (raw && typeof (raw as any).url === "function") url = (raw as any).url();
  else if (raw && typeof (raw as any).url === "string") url = (raw as any).url;
  else if (raw && (raw as any).url instanceof URL) url = (raw as any).url;
  else throw new Error(`Replicate nano-banana invalid output: ${String(raw).slice(0, 200)}`);

  if (url instanceof URL) url = url.href;
  else if (url && typeof url !== "string" && typeof (url as any).href === "string") url = (url as any).href;
  else if (url && typeof url !== "string") url = String(url);

  if (typeof url !== "string" || !url.startsWith("http")) {
    throw new Error(`Replicate nano-banana invalid URL: ${typeof url === "string" ? url.slice(0, 200) : "unknown"}`);
  }

  const { buffer, mimeType } = await fetchToBuffer(url);
  return { buffer, mimeType, provider: "replicate" };
}

/**
 * Generate or edit an image with Google's Nano Banana
 * (gemini-2.5-flash-image).
 *
 * Tries the direct Gemini API first (cheaper, faster), and on failures that
 * are retryable (403 PERMISSION_DENIED, 429 quota, 5xx, network), falls back
 * to Replicate `google/nano-banana`. Safety blocks are NOT retried.
 *
 * Pass references[] to do image editing / fusion (try-on, character lock,
 * product reference). The first call uses Gemini; the fallback uses
 * Replicate's `image_input` array.
 */
export async function generateNanoBanana(
  prompt: string,
  opts: NanoBananaOpts = {},
): Promise<NanoBananaResult> {
  const errors: string[] = [];

  if (getGeminiKey() && !isGeminiCooledDown()) {
    try {
      const out = await tryGemini(prompt, opts);
      logger.info({ provider: "gemini", promptLen: prompt.length, refs: opts.references?.length || 0 }, "nano-banana: success");
      return out;
    } catch (err: any) {
      const cls = classifyGeminiError(err);
      errors.push(`gemini[${cls.reason}]: ${String(err?.message || err).slice(0, 200)}`);
      if (!cls.retryable) {
        logger.warn({ reason: cls.reason }, "nano-banana: Gemini blocked (no fallback)");
        throw new Error(`Nano Banana failed: ${errors.join(" | ")}`);
      }
      // Trip the circuit ONLY for configuration-level failures (invalid
      // key, no permission). Quota/network/5xx are transient and shouldn't
      // poison the circuit.
      if (cls.reason === "permission_denied") tripGeminiCircuit(cls.reason);
      logger.warn({ reason: cls.reason }, "nano-banana: Gemini failed, falling back to Replicate");
    }
  } else if (!getGeminiKey()) {
    errors.push("gemini[no_key]: GEMINI_API_KEY not set");
  } else {
    errors.push(`gemini[circuit_open:${_geminiCooldownReason}]: skipped`);
    logger.debug({ reason: _geminiCooldownReason }, "nano-banana: Gemini circuit open, skipping to Replicate");
  }

  if (getReplicateToken(opts.replicateToken)) {
    try {
      const out = await tryReplicate(prompt, opts);
      logger.info({ provider: "replicate", promptLen: prompt.length, refs: opts.references?.length || 0 }, "nano-banana: success (fallback)");
      return out;
    } catch (err: any) {
      errors.push(`replicate: ${String(err?.message || err).slice(0, 200)}`);
    }
  } else {
    errors.push("replicate[no_key]: REPLICATE_API_TOKEN not set");
  }

  throw new Error(`Nano Banana failed in all providers: ${errors.join(" | ")}`);
}
