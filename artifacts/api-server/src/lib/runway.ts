import { logger } from "./logger.js";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 6 * 60_000;
const MAX_PROMPT_LENGTH = 1000;

export type RunwayModel = "gen3a_turbo" | "gen4_turbo";
export type RunwayRatio =
  | "1280:768"
  | "768:1280"
  | "1104:832"
  | "832:1104"
  | "960:960"
  | "1584:672";
export type RunwayDuration = 5 | 10;

export interface RunwayVideoRequest {
  promptImage: string;
  promptText: string;
  model?: RunwayModel;
  ratio?: RunwayRatio;
  duration?: RunwayDuration;
  seed?: number;
}

export interface RunwayVideoResult {
  taskId: string;
  videoUrl: string;
  durationSec: number;
  model: RunwayModel;
  cost: number;
}

const COST_PER_SECOND: Record<RunwayModel, number> = {
  gen3a_turbo: 0.05,
  gen4_turbo: 0.05,
};

function getApiKey(): string {
  const key = process.env.RUNWAY_API_KEY;
  if (!key || key.trim().length < 10) {
    throw new Error("RUNWAY_API_KEY no configurado");
  }
  return key.trim();
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
    host === "0.0.0.0" ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    // IPv4 privadas + loopback + link-local + carrier-grade NAT
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^127\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    // IPv6 loopback / unique-local / link-local
    host === "::1" ||
    host === "::" ||
    /^fc[0-9a-f]{2}:/.test(host) ||
    /^fd[0-9a-f]{2}:/.test(host) ||
    /^fe[89ab][0-9a-f]:/.test(host) ||
    // IPv4-mapped IPv6 a privadas
    /^::ffff:(10|127|169\.254|192\.168)\./.test(host) ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("promptImage no puede apuntar a hosts internos/privados");
  }
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

  const model: RunwayModel = req.model === "gen4_turbo" ? "gen4_turbo" : "gen3a_turbo";
  const duration: RunwayDuration = req.duration === 10 ? 10 : 5;
  const ratio: RunwayRatio = req.ratio ?? "1280:768";

  const body: Record<string, unknown> = {
    promptImage: req.promptImage,
    promptText,
    model,
    duration,
    ratio,
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
      logger.info({ taskId, videoUrl: videoUrl.slice(0, 80), cost }, "Runway: video listo");
      return { taskId, videoUrl, durationSec: duration, model, cost };
    }

    if (data.status === "FAILED" || data.status === "CANCELLED") {
      const reason = data.failure || data.failureCode || data.status;
      throw new Error(`Runway task ${data.status}: ${reason}`);
    }
  }

  throw new Error(`Runway: timeout tras ${POLL_TIMEOUT_MS / 1000}s esperando taskId=${taskId}`);
}
