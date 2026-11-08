/**
 * Comprobación del catálogo xAI contra la API real.
 *
 * GET https://api.x.ai/v1/models (Bearer XAI_API_KEY) devuelve los modelos que
 * la clave puede usar. Aquí se cruzan con lo que la plataforma tiene en
 * KNOWN_MODELS y en los defaults por tier, para saber qué IDs existen de verdad
 * y cuáles hay que cambiar. No guarda nada: solo informa.
 *
 * Sin clave no se inventa nada: devuelve `{ ok: false, reason: "no_key" }`.
 */

export interface XaiLiveModel {
  id: string;
  created?: number;
  owned_by?: string;
}

export interface XaiCatalogCheck {
  ok: true;
  checkedAt: string;
  live: string[];
  /** IDs que usa la plataforma (catálogo + defaults) y SÍ devuelve la API. */
  confirmed: string[];
  /** IDs que usa la plataforma y la API NO devuelve: candidatos a retirar. */
  missing: string[];
  /** IDs que devuelve la API y la plataforma aún no ofrece. */
  notInCatalog: string[];
}

export type XaiCatalogResult =
  | XaiCatalogCheck
  | { ok: false; reason: "no_key" | "http_error" | "network_error"; status?: number; detail?: string };

export function xaiApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const k = (env.XAI_API_KEY ?? env.GROK_API_KEY ?? "").trim();
  return k.length > 0 ? k : null;
}

/** Cruza los IDs vivos con los de la plataforma. Pura: fácil de probar. */
export function compareXaiCatalog(live: string[], platformIds: string[], now = new Date()): XaiCatalogCheck {
  const liveSet = new Set(live);
  const platform = [...new Set(platformIds)];
  const platformSet = new Set(platform);
  return {
    ok: true,
    checkedAt: now.toISOString(),
    live: [...liveSet].sort(),
    confirmed: platform.filter(id => liveSet.has(id)).sort(),
    missing: platform.filter(id => !liveSet.has(id)).sort(),
    notInCatalog: [...liveSet].filter(id => !platformSet.has(id)).sort(),
  };
}

export async function fetchXaiModels(
  platformIds: string[],
  opts: { apiKey?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<XaiCatalogResult> {
  const apiKey = opts.apiKey === undefined ? xaiApiKey() : opts.apiKey;
  if (!apiKey) return { ok: false, reason: "no_key" };
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f("https://api.x.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, reason: "network_error", detail: String((e as Error)?.message ?? e).slice(0, 200) };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return { ok: false, reason: "http_error", status: res.status, detail };
  }
  const body = (await res.json().catch(() => ({}))) as { data?: XaiLiveModel[] };
  const live = (body.data ?? []).map(m => m?.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  return compareXaiCatalog(live, platformIds);
}
