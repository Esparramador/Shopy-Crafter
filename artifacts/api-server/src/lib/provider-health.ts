// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER HEALTH CHECK
// Verifica disponibilidad y saldo de cada API (Replicate, Runway, Gemini,
// ElevenLabs, xAI) sin gastar créditos. Usa endpoints de cuenta/usuario que
// son gratuitos y devuelven 200 si la API key es válida y la cuenta está activa.
// ═══════════════════════════════════════════════════════════════════════════

export type ProviderId = "replicate" | "runway" | "gemini" | "elevenlabs" | "xai";

export type ProviderStatus = "ok" | "missing_key" | "out_of_credits" | "rate_limited" | "down" | "unknown";

export interface ProviderHealth {
  provider: ProviderId;
  status: ProviderStatus;
  hasKey: boolean;
  detail?: string;
  checkedAt: number;
}

const TIMEOUT_MS = 6000;

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally { clearTimeout(t); }
}

async function checkReplicate(): Promise<ProviderHealth> {
  const key = process.env.REPLICATE_API_TOKEN;
  const checkedAt = Date.now();
  if (!key) return { provider: "replicate", status: "missing_key", hasKey: false, checkedAt };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) return { provider: "replicate", status: "missing_key", hasKey: true, detail: `auth ${res.status}`, checkedAt };
    if (res.status === 402)                       return { provider: "replicate", status: "out_of_credits", hasKey: true, detail: "402 sin saldo", checkedAt };
    if (res.status === 429)                       return { provider: "replicate", status: "rate_limited", hasKey: true, detail: "429 rate limit", checkedAt };
    if (!res.ok)                                  return { provider: "replicate", status: "down", hasKey: true, detail: `HTTP ${res.status}`, checkedAt };
    return { provider: "replicate", status: "ok", hasKey: true, checkedAt };
  } catch (e: any) {
    return { provider: "replicate", status: "down", hasKey: true, detail: e?.message || "fetch error", checkedAt };
  }
}

async function checkRunway(): Promise<ProviderHealth> {
  const key = process.env.RUNWAY_API_KEY;
  const checkedAt = Date.now();
  if (!key) return { provider: "runway", status: "missing_key", hasKey: false, checkedAt };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch("https://api.dev.runwayml.com/v1/organization", {
      headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) return { provider: "runway", status: "missing_key", hasKey: true, detail: `auth ${res.status}`, checkedAt };
    if (res.status === 402)                       return { provider: "runway", status: "out_of_credits", hasKey: true, detail: "402 sin saldo", checkedAt };
    if (res.status === 429)                       return { provider: "runway", status: "rate_limited", hasKey: true, detail: "429 rate limit", checkedAt };
    if (!res.ok)                                  return { provider: "runway", status: "down", hasKey: true, detail: `HTTP ${res.status}`, checkedAt };
    let detail: string | undefined;
    try {
      const j: any = await res.json();
      const credits = j?.credits ?? j?.creditBalance ?? j?.usage?.remaining;
      if (typeof credits === "number") detail = `${credits} créditos`;
    } catch { /* ignore */ }
    return { provider: "runway", status: "ok", hasKey: true, detail, checkedAt };
  } catch (e: any) {
    return { provider: "runway", status: "down", hasKey: true, detail: e?.message || "fetch error", checkedAt };
  }
}

async function checkGemini(): Promise<ProviderHealth> {
  const key = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const checkedAt = Date.now();
  if (!key) return { provider: "gemini", status: "missing_key", hasKey: false, checkedAt };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) return { provider: "gemini", status: "missing_key", hasKey: true, detail: `auth ${res.status}`, checkedAt };
    if (res.status === 429)                       return { provider: "gemini", status: "rate_limited", hasKey: true, detail: "429 cuota agotada — upgrading a Tier 1 resuelve esto", checkedAt };
    if (!res.ok)                                  return { provider: "gemini", status: "down", hasKey: true, detail: `HTTP ${res.status}`, checkedAt };
    let detail: string | undefined;
    try {
      const j: any = await res.json();
      const models: any[] = j?.models ?? [];
      const geminiModels = models.filter((m: any) => String(m.name ?? "").includes("gemini"));
      const count = geminiModels.length;
      // Tier 1+ keys can access 20+ Gemini models including 3.x Pro variants.
      // Free (Tier 0) keys typically return ≤8 models and lack gemini-3.x-pro.
      const hasProModels = geminiModels.some((m: any) => /gemini-3\.\d-pro|gemini-3-pro/i.test(m.name ?? ""));
      const tier = count >= 15 && hasProModels ? "Tier 1 (Standard)" : count > 0 ? "Tier 0 (Free)" : "unknown";
      detail = `${count} modelos disponibles · ${tier}`;
    } catch { /* ignore — key is valid, just couldn't parse model list */ }
    return { provider: "gemini", status: "ok", hasKey: true, detail, checkedAt };
  } catch (e: any) {
    return { provider: "gemini", status: "down", hasKey: true, detail: e?.message || "fetch error", checkedAt };
  }
}

async function checkElevenLabs(): Promise<ProviderHealth> {
  const key = process.env.ELEVENLABS_API_KEY;
  const checkedAt = Date.now();
  if (!key) return { provider: "elevenlabs", status: "missing_key", hasKey: false, checkedAt };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": key },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) return { provider: "elevenlabs", status: "missing_key", hasKey: true, detail: `auth ${res.status}`, checkedAt };
    if (res.status === 429)                       return { provider: "elevenlabs", status: "rate_limited", hasKey: true, detail: "429 rate limit", checkedAt };
    if (!res.ok)                                  return { provider: "elevenlabs", status: "down", hasKey: true, detail: `HTTP ${res.status}`, checkedAt };
    let detail: string | undefined;
    try {
      const j: any = await res.json();
      const used = j?.subscription?.character_count;
      const total = j?.subscription?.character_limit;
      if (typeof used === "number" && typeof total === "number") {
        const remaining = total - used;
        detail = `${remaining}/${total} chars restantes`;
        if (remaining <= 0) {
          return { provider: "elevenlabs", status: "out_of_credits", hasKey: true, detail, checkedAt };
        }
      }
    } catch { /* ignore */ }
    return { provider: "elevenlabs", status: "ok", hasKey: true, detail, checkedAt };
  } catch (e: any) {
    return { provider: "elevenlabs", status: "down", hasKey: true, detail: e?.message || "fetch error", checkedAt };
  }
}

async function checkXai(): Promise<ProviderHealth> {
  const key = process.env.XAI_API_KEY;
  const checkedAt = Date.now();
  if (!key) return { provider: "xai", status: "missing_key", hasKey: false, checkedAt };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Llamada barata: listar modelos disponibles (no consume cuota de generación).
    const res = await fetch("https://api.x.ai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) return { provider: "xai", status: "missing_key", hasKey: true, detail: `auth ${res.status}`, checkedAt };
    if (res.status === 402)                       return { provider: "xai", status: "out_of_credits", hasKey: true, detail: "402 sin saldo", checkedAt };
    if (res.status === 429)                       return { provider: "xai", status: "rate_limited", hasKey: true, detail: "429 rate limit", checkedAt };
    if (!res.ok)                                  return { provider: "xai", status: "down", hasKey: true, detail: `HTTP ${res.status}`, checkedAt };
    return { provider: "xai", status: "ok", hasKey: true, checkedAt };
  } catch (e: any) {
    return { provider: "xai", status: "down", hasKey: true, detail: e?.message || "fetch error", checkedAt };
  }
}

// ── Cache 60s para evitar machacar las APIs en cada render del frontend.
let _cache: { ts: number; data: Record<ProviderId, ProviderHealth> } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getAllProvidersHealth(forceFresh = false): Promise<Record<ProviderId, ProviderHealth>> {
  if (!forceFresh && _cache && Date.now() - _cache.ts < CACHE_TTL_MS) return _cache.data;
  const [replicate, runway, gemini, elevenlabs, xai] = await Promise.all([
    checkReplicate(), checkRunway(), checkGemini(), checkElevenLabs(), checkXai(),
  ]);
  const data: Record<ProviderId, ProviderHealth> = { replicate, runway, gemini, elevenlabs, xai };
  _cache = { ts: Date.now(), data };
  return data;
}

// Helper para invalidar cache cuando una llamada de generación detecta 402/429
export function invalidateProviderHealthCache() { _cache = null; }
