import { recordApiUsage, calcElevenLabsCost, type ApiProvider } from "./api-usage.js";
import { assertAiBudget } from "./ai-budget.js";
import { logger } from "./logger.js";

/**
 * Coste de proveedores que cobran por créditos o por petición (Meshy, Tripo3D,
 * Freepik, Replicate, Stitch…). Antes no dejaban rastro en api_usage_log: el
 * margen por proyecto y el tope de IA del mes no los veían.
 *
 * - Antes de lanzar la tarea: comprueba el presupuesto de IA del proyecto.
 * - Créditos (Meshy, Tripo3D): se mide el saldo antes y después de crear la
 *   tarea (lo descuentan al crearla), así el coste es el real de esa llamada.
 * - Precio por petición: solo si está configurado (PROVIDER_EUR_PER_REQUEST_<X>);
 *   sin precio verificado se registra la llamada con coste 0 y `priceKnown: false`.
 */

/** USD por crédito (tarifa pública): Meshy Pro 20 $ / 1.000 créditos; Tripo3D 0,01 $ por crédito. */
const DEFAULT_USD_PER_CREDIT: Record<string, number> = { meshy: 0.02, tripo3d: 0.01 };

export function usdPerCredit(provider: string): number {
  const v = Number(process.env[`${provider.toUpperCase()}_USD_PER_CREDIT`]);
  return Number.isFinite(v) && v >= 0 ? v : (DEFAULT_USD_PER_CREDIT[provider] ?? 0);
}

/** € por petición configurado para un proveedor/operación (o null si no hay precio). */
export function eurPerRequest(provider: string, operation: string): number | null {
  const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  for (const name of [`PROVIDER_EUR_PER_REQUEST_${key(provider)}_${key(operation)}`, `PROVIDER_EUR_PER_REQUEST_${key(provider)}`]) {
    const v = Number(process.env[name]);
    if (process.env[name] !== undefined && Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}

/** Créditos gastados entre dos lecturas de saldo (null si alguna lectura falló). */
export function creditsSpent(before: number | null, after: number | null): number | null {
  if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after)) return null;
  return Math.max(0, Math.round((before - after) * 100) / 100);
}

interface CreditMeterOptions<T> {
  provider: ApiProvider;
  operation: string;
  readBalance: () => Promise<number | null>;
  run: () => Promise<T>;
  projectId?: number | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

/** Ejecuta una llamada que consume créditos y registra los créditos gastados. */
export async function meterCredits<T>(opts: CreditMeterOptions<T>): Promise<T> {
  await assertAiBudget(opts.projectId ?? null);
  const safeBalance = () => opts.readBalance().catch(err => {
    logger.warn({ err: String(err), provider: opts.provider }, "[provider-meter] no se pudo leer el saldo");
    return null;
  });
  const before = await safeBalance();
  let result: T;
  try {
    result = await opts.run();
  } catch (err) {
    void recordApiUsage({
      provider: opts.provider, operation: opts.operation, model: opts.model, projectId: opts.projectId,
      success: false, errorMessage: String((err as Error)?.message ?? err).slice(0, 300), metadata: opts.metadata,
    });
    throw err;
  }
  const credits = creditsSpent(before, await safeBalance());
  const costUsd = credits == null ? 0 : credits * usdPerCredit(opts.provider);
  void recordApiUsage({
    provider: opts.provider, operation: opts.operation, model: opts.model, projectId: opts.projectId,
    inputUnits: credits ?? 0, unitsLabel: "credits", costUsd,
    metadata: { ...opts.metadata, priceKnown: credits != null },
  });
  return result;
}

interface RequestMeterOptions<T> {
  provider: ApiProvider;
  operation: string;
  run: () => Promise<T>;
  projectId?: number | null;
  model?: string | null;
  units?: number;
  metadata?: Record<string, unknown>;
}

/** Ejecuta una llamada facturada por petición y la registra (con su precio si está configurado). */
export async function meterRequest<T>(opts: RequestMeterOptions<T>): Promise<T> {
  await assertAiBudget(opts.projectId ?? null);
  const units = opts.units ?? 1;
  try {
    const result = await opts.run();
    const unit = eurPerRequest(opts.provider, opts.operation);
    void recordApiUsage({
      provider: opts.provider, operation: opts.operation, model: opts.model, projectId: opts.projectId,
      inputUnits: units, unitsLabel: "requests", costEur: unit == null ? 0 : unit * units,
      metadata: { ...opts.metadata, priceKnown: unit != null },
    });
    return result;
  } catch (err) {
    void recordApiUsage({
      provider: opts.provider, operation: opts.operation, model: opts.model, projectId: opts.projectId,
      success: false, errorMessage: String((err as Error)?.message ?? err).slice(0, 300), metadata: opts.metadata,
    });
    throw err;
  }
}

/**
 * fetch() para llamadas directas a Replicate y ElevenLabs (estudio "modelo" de
 * YouTube). Registra solo las que facturan: crear predicción en Replicate y
 * TTS / speech-to-speech / doblaje en ElevenLabs. El resto pasa sin más.
 */
export async function meteredFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const billing = method === "POST" ? classifyBillable(url, init.body) : null;
  if (!billing) return fetch(url, init);
  await assertAiBudget();
  const res = await fetch(url, init);
  void recordApiUsage({
    provider: billing.provider, operation: billing.operation, model: billing.model,
    inputUnits: billing.units, unitsLabel: billing.unitsLabel,
    ...(billing.costUsd != null ? { costUsd: billing.costUsd } : { costEur: eurPerRequest(billing.provider, billing.operation) ?? 0 }),
    success: res.ok, errorMessage: res.ok ? null : `HTTP ${res.status}`,
    metadata: { priceKnown: billing.costUsd != null || eurPerRequest(billing.provider, billing.operation) != null },
  });
  return res;
}

interface Billable { provider: ApiProvider; operation: string; model: string | null; units: number; unitsLabel: string; costUsd: number | null }

/** Exportado para tests. */
export function classifyBillable(url: string, body: unknown): Billable | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.hostname === "api.replicate.com") {
    const m = u.pathname.match(/^\/v1\/(?:models\/([^/]+\/[^/]+)\/)?predictions\/?$/);
    if (!m) return null;
    let model = m[1] ?? null;
    if (!model && typeof body === "string") {
      try { const v = JSON.parse(body)?.version; if (typeof v === "string") model = v.slice(0, 80); } catch { /* cuerpo no JSON */ }
    }
    return { provider: "replicate", operation: "prediction", model, units: 1, unitsLabel: "requests", costUsd: null };
  }
  if (u.hostname === "api.elevenlabs.io") {
    if (/^\/v1\/text-to-speech\//.test(u.pathname)) {
      let chars = 0;
      if (typeof body === "string") { try { chars = String(JSON.parse(body)?.text ?? "").length; } catch { /* sin texto */ } }
      return { provider: "elevenlabs", operation: "tts", model: null, units: chars, unitsLabel: "chars", costUsd: calcElevenLabsCost(chars) };
    }
    if (/^\/v1\/speech-to-speech\//.test(u.pathname)) return { provider: "elevenlabs", operation: "speech-to-speech", model: null, units: 1, unitsLabel: "requests", costUsd: null };
    if (/^\/v1\/sound-generation\/?$/.test(u.pathname)) return { provider: "elevenlabs", operation: "sound-generation", model: null, units: 1, unitsLabel: "requests", costUsd: null };
    if (/^\/v1\/audio-isolation\/?$/.test(u.pathname)) return { provider: "elevenlabs", operation: "audio-isolation", model: null, units: 1, unitsLabel: "requests", costUsd: null };
    if (/^\/v1\/speech-to-text\/?$/.test(u.pathname)) return { provider: "elevenlabs", operation: "speech-to-text", model: null, units: 1, unitsLabel: "requests", costUsd: null };
    if (/^\/v1\/dubbing\/?$/.test(u.pathname)) return { provider: "elevenlabs", operation: "dubbing", model: null, units: 1, unitsLabel: "requests", costUsd: null };
  }
  return null;
}
