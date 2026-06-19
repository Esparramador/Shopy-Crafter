import { logger } from "./logger.js";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 6 * 60_000;
const MAX_PROMPT_LENGTH = 1000;

export type RunwayModel =
  | "gen3a_turbo"
  | "gen4_turbo"
  | "gen4.5"          // Jun-2026: nueva generación, mejor motion y detalle
  | "gen4.5-turbo"    // Jun-2026: versión rápida de 4.5
  | "seedance2"       // Seedance 2 vía Runway, calidad cinematográfica
  | "seedance2_fast"; // Seedance 2 Fast vía Runway, rápido

export type RunwayRatio =
  | "1280:768"
  | "768:1280"
  | "1104:832"
  | "832:1104"
  | "960:960"
  | "1584:672"
  | "1920:1080"      // Nuevos ratios para 4K y Cine
  | "1080:1920"
  | "3840:2160"      // 4K Ultra Wide
  | "2160:3840";

export type RunwayDuration = 5 | 10 | 15; // Soporte para 15s en modelos premium

export interface RunwayVideoRequest {
  promptImage: string;
  promptText: string;
  model?: RunwayModel;
  ratio?: RunwayRatio;
  duration?: RunwayDuration;
  seed?: number;
  supportsAudio?: boolean; // Nuevo: Runway Gen 4.5 soporta audio nativo
  motionBrushRegions?: {
    x: number;
    y: number;
    width: number;
    height: number;
    direction: { x: number; y: number };
  }[];
}

export interface RunwayVideoResult {
  taskId: string;
  videoUrl: string;
  durationSec: number;
  model: RunwayModel;
  cost: number;
  resolution?: string;     // Nuevo: información de resolución
  hasAudio?: boolean;      // Nuevo: confirmación de audio
}

const COST_PER_SECOND: Record<RunwayModel, number> = {
  gen3a_turbo:  0.03,      // Precio reducido por legacy
  gen4_turbo:   0.05,
  "gen4.5":     0.07,      // Premium 4.5
  "gen4.5-turbo": 0.05,    // Fast 4.5
  seedance2:    0.10,
  seedance2_fast: 0.06,
};

const MODEL_SPECS: Record<RunwayModel, { maxDuration: number, maxResolution: string, supportsAudio: boolean }> = {
  "gen3a_turbo": { maxDuration: 10, maxResolution: "1280x768", supportsAudio: false },
  "gen4_turbo":  { maxDuration: 10, maxResolution: "1920x1080", supportsAudio: true },
  "gen4.5":      { maxDuration: 15, maxResolution: "3840x2160", supportsAudio: true },
  "gen4.5-turbo": { maxDuration: 10, maxResolution: "1920x1080", supportsAudio: true },
  "seedance2":   { maxDuration: 10, maxResolution: "2048x2048", supportsAudio: false },
  "seedance2_fast": { maxDuration: 10, maxResolution: "1024x1024", supportsAudio: false },
};

function getApiKey(): string {
  const key = process.env.RUNWAY_API_KEY;
  if (!key || key.trim().length < 10) {
    throw new Error("RUNWAY_API_KEY no configurado");
  }
  return key.trim();
}

function isPrivateOrReservedIp(ip: string): boolean {
  const host = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    // IPv4 loopback / private / link-local / carrier-grade NAT / multicast / reserved
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^127\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    /^22[4-9]\./.test(host) || /^23\d\./.test(host) || /^24\d\./.test(host) || /^25[0-5]\./.test(host) ||
    // IPv6 loopback / unique-local / link-local
    host === "::1" ||
    host === "::" ||
    /^fc[0-9a-f]{2}:/.test(host) ||
    /^fd[0-9a-f]{2}:/.test(host) ||
    /^fe[89ab][0-9a-f]:/.test(host) ||
    // IPv4-mapped IPv6 a privadas
    /^::ffff:(10|127|169\.254|192\.168)\./.test(host) ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export function validateImageUrl(url: string): void {
  if (!url || typeof url !== "string") {
    throw new Error("promptImage requerido");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("promptImage debe ser una URL válida");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("promptImage debe usar HTTPS");
  }
  // Strip IPv6 brackets si los hay
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    isPrivateOrReservedIp(host) ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  ) {
    throw new Error("promptImage no puede apuntar a hosts internos/privados");
  }
}

/**
 * Stronger SSRF protection: validates the URL literal AND resolves the
 * hostname via DNS to ensure no record points to a private/reserved IP.
 * This blocks DNS-rebinding attacks (attacker-controlled domain that
 * resolves to 169.254.169.254 etc.).
 *
 * Use before any user-supplied URL fetch.
 */
export async function validateImageUrlAsync(url: string): Promise<void> {
  validateImageUrl(url); // sync literal checks first
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // If literal IP, sync check already covered it
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return;
  let records: Array<{ address: string; family: number }>;
  try {
    const dns = await import("node:dns/promises");
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("No se pudo resolver el host de la URL");
  }
  if (!records || records.length === 0) {
    throw new Error("Host no resolvible");
  }
  for (const r of records) {
    if (isPrivateOrReservedIp(r.address)) {
      throw new Error(`URL resuelve a IP no permitida (${r.address})`);
    }
  }
}

export type RunwayImageRatio =
  | "1920:1080" | "1080:1920" | "1024:1024" | "1360:768" | "1080:1080"
  | "1168:880" | "1440:1080" | "1080:1440" | "1808:768" | "2112:912";

export interface RunwayImageRequest {
  promptText: string;
  referenceImages?: Array<{ uri: string; tag?: string }>;
  ratio?: RunwayImageRatio;
  seed?: number;
  model?: "gen4_image" | "gen4_image_turbo";
}

export interface RunwayImageResult {
  taskId: string;
  imageUrl: string;
  model: string;
  cost: number;
}

const IMAGE_COST: Record<string, number> = {
  gen4_image: 0.08,
  gen4_image_turbo: 0.02,
};

export async function generateImageWithReferences(
  req: RunwayImageRequest
): Promise<RunwayImageResult> {
  const apiKey = getApiKey();
  const promptText = (req.promptText ?? "").trim();
  if (!promptText) throw new Error("promptText requerido");
  if (promptText.length > MAX_PROMPT_LENGTH) {
    throw new Error(`promptText excede ${MAX_PROMPT_LENGTH} caracteres`);
  }

  const model = req.model ?? "gen4_image";
  const ratio: RunwayImageRatio = req.ratio ?? "1080:1080";

  const refs = (req.referenceImages ?? []).slice(0, 3);
  for (const r of refs) {
    if (!r.uri) throw new Error("referenceImages[].uri requerido");
    if (r.uri.startsWith("https://")) {
      validateImageUrl(r.uri);
    } else if (!r.uri.startsWith("data:image/")) {
      throw new Error("referenceImages[].uri debe ser https:// o data:image/...");
    }
  }

  const body: Record<string, unknown> = {
    model,
    promptText,
    ratio,
    referenceImages: refs.map((r) => ({ uri: r.uri, ...(r.tag ? { tag: r.tag } : {}) })),
  };
  if (typeof req.seed === "number" && Number.isFinite(req.seed)) {
    body.seed = Math.floor(req.seed);
  }

  logger.info({ model, ratio, refs: refs.length, promptLength: promptText.length }, "Runway: enqueue text_to_image");

  const enqueueRes = await fetch(`${RUNWAY_BASE}/text_to_image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!enqueueRes.ok) {
    const errText = await enqueueRes.text().catch(() => "");
    throw new Error(`Runway text_to_image enqueue ${enqueueRes.status}: ${errText.slice(0, 300)}`);
  }
  const enqueueData = (await enqueueRes.json()) as { id?: string };
  const taskId = enqueueData.id;
  if (!taskId) throw new Error("Runway text_to_image: respuesta sin id");

  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const taskRes = await fetch(`${RUNWAY_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": RUNWAY_VERSION },
      signal: AbortSignal.timeout(15_000),
    });
    if (!taskRes.ok) continue;
    const data = (await taskRes.json()) as { status?: string; output?: string[]; failure?: string; failureCode?: string };
    if (data.status === "SUCCEEDED") {
      const imageUrl = Array.isArray(data.output) ? data.output[0] : null;
      if (!imageUrl || !imageUrl.startsWith("https://")) throw new Error("Runway image: SUCCEEDED sin URL válida");
      const cost = IMAGE_COST[model] ?? 0.08;
      try {
        const { recordApiUsage } = await import("./api-usage.js");
        void recordApiUsage({ provider: "runway", operation: "generateImage", model, inputUnits: 1, unitsLabel: "images", costUsd: cost });
      } catch { /* no bloquea */ }
      return { taskId, imageUrl, model, cost };
    }
    if (data.status === "FAILED" || data.status === "CANCELLED") {
      throw new Error(`Runway image task ${data.status}: ${data.failure || data.failureCode || data.status}`);
    }
  }
  throw new Error(`Runway image: timeout tras ${POLL_TIMEOUT_MS / 1000}s esperando taskId=${taskId}`);
}

export async function fetchRunwayImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Runway download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mimeType = r.headers.get("content-type")?.split(";")[0] || "image/png";
  return { buffer: buf, mimeType };
}

export async function generateVideoFromImage(
  req: RunwayVideoRequest
): Promise<RunwayVideoResult> {
  const apiKey = getApiKey();
  validateImageUrl(req.promptImage);

  const promptText = (req.promptText ?? "").trim();
  if (!promptText) throw new Error("promptText requerido");
  if (promptText.length > MAX_PROMPT_LENGTH) {
    throw new Error(`promptText excede ${MAX_PROMPT_LENGTH} caracteres`);
  }

  const model: RunwayModel = req.model ?? "gen4.5-turbo";
  const duration: RunwayDuration = req.duration ?? 5;
  const ratio: RunwayRatio = req.ratio ?? "1920:1080";

  const body: Record<string, unknown> = {
    promptImage: req.promptImage,
    promptText,
    model,
    duration,
    ratio,
    ...(req.supportsAudio ? { supportsAudio: true } : {}),
    ...(req.motionBrushRegions ? { motion_brush_regions: req.motionBrushRegions } : {}),
  };
  if (typeof req.seed === "number" && Number.isFinite(req.seed)) {
    body.seed = Math.floor(req.seed);
  }

  logger.info({ model, duration, ratio, promptLength: promptText.length }, "Runway: enqueue image_to_video");

  const enqueueRes = await fetch(`${RUNWAY_BASE}/image_to_video`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!enqueueRes.ok) {
    const errText = await enqueueRes.text().catch(() => "");
    throw new Error(`Runway enqueue ${enqueueRes.status}: ${errText.slice(0, 300)}`);
  }
  const enqueueData = (await enqueueRes.json()) as { id?: string };
  const taskId = enqueueData.id;
  if (!taskId) {
    throw new Error("Runway enqueue: respuesta sin id");
  }

  logger.info({ taskId }, "Runway: polling task");
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const taskRes = await fetch(`${RUNWAY_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!taskRes.ok) {
      logger.warn({ taskId, status: taskRes.status }, "Runway: poll error, reintentando");
      continue;
    }

    const data = (await taskRes.json()) as {
      status?: string;
      output?: string[];
      failure?: string;
      failureCode?: string;
    };

    if (data.status === "SUCCEEDED") {
      const videoUrl = Array.isArray(data.output) ? data.output[0] : null;
      if (!videoUrl || !videoUrl.startsWith("https://")) {
        throw new Error("Runway: SUCCEEDED sin URL de video válida");
      }
      const cost = duration * (COST_PER_SECOND[model] ?? 0.05);
      const spec = MODEL_SPECS[model];
      logger.info({ taskId, videoUrl: videoUrl.slice(0, 80), cost }, "Runway: video listo");
      try {
        const { recordApiUsage } = await import("./api-usage.js");
        void recordApiUsage({
          provider: "runway",
          operation: "generateVideo",
          model,
          inputUnits: duration,
          unitsLabel: "seconds",
          costUsd: cost,
        });
      } catch { /* nunca bloquea */ }
      return { 
        taskId, 
        videoUrl, 
        durationSec: duration, 
        model, 
        cost,
        resolution: spec?.maxResolution,
        hasAudio: req.supportsAudio && spec?.supportsAudio
      };
    }

    if (data.status === "FAILED" || data.status === "CANCELLED") {
      const reason = data.failure || data.failureCode || data.status;
      throw new Error(`Runway task ${data.status}: ${reason}`);
    }
  }

  throw new Error(`Runway: timeout tras ${POLL_TIMEOUT_MS / 1000}s esperando taskId=${taskId}`);
}
