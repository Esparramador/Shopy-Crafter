/**
 * Preguntar al cerebro (POST /api/shopybrain/search) desde cualquier pantalla de admin
 * y ejecutar lo que proponga (POST /api/shopybrain/execute-action, con la confirmación
 * humana de fetchBrainAction para las destructivas).
 *
 * Lo usan la paleta de comandos y el Buscador Universal; cada uno manda su `channel`
 * para que el panel «Cerebro» sepa por dónde entró la petición.
 */
import { fetchBrainAction } from "./brain-action";

const API = import.meta.env?.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, "") : "";

export interface BrainProposedAction {
  action: string;
  params?: Record<string, unknown>;
}

export interface BrainAnswer {
  answer: string;
  /** Motor que respondió (p. ej. "auto→claude+omnicore"). */
  source: string | null;
  actions: BrainProposedAction[];
  /** Marca, web o @cuenta que el cerebro ha detectado en la pregunta. */
  potentialEntity: string | null;
  entityKnowledgeUsed: boolean;
}

function asAction(v: unknown): BrainProposedAction | null {
  if (!v || typeof v !== "object") return null;
  const { action, params } = v as { action?: unknown; params?: unknown };
  if (typeof action !== "string" || !action) return null;
  return { action, params: params && typeof params === "object" ? params as Record<string, unknown> : {} };
}

/** La respuesta de /search (returnRaw) en una forma estable. */
export function normalizeBrainAnswer(data: unknown): BrainAnswer {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const list = Array.isArray(d.detectedActions) ? d.detectedActions : d.detectedAction ? [d.detectedAction] : [];
  const actions = list.map(asAction).filter((a): a is BrainProposedAction => !!a);
  const entity = typeof d.potentialEntity === "string" && d.potentialEntity.trim().length > 2 ? d.potentialEntity.trim() : null;
  return {
    answer: typeof d.answer === "string" ? d.answer : "",
    source: typeof d.source === "string" ? d.source : null,
    actions,
    potentialEntity: entity,
    entityKnowledgeUsed: d.entityKnowledgeUsed === true,
  };
}

export async function askBrain(query: string, opts: {
  channel: string;
  currentRoute?: string;
  activeProjectId?: number | string | null;
  niche?: string;
  signal?: AbortSignal;
}): Promise<BrainAnswer> {
  const res = await fetch(`${API}/api/shopybrain/search`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      query,
      returnRaw: true,
      channel: opts.channel,
      currentRoute: opts.currentRoute,
      activeProjectId: opts.activeProjectId || undefined,
      niche: opts.niche || undefined,
      engineMode: "auto",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `ShopyBrain no ha podido responder (${res.status})`);
  }
  return normalizeBrainAnswer(await res.json());
}

export interface BrainActionOutcome {
  ok: boolean;
  cancelled: boolean;
  message: string;
}

/** Lo que devuelve /execute-action, en una línea para la interfaz. */
export function describeActionResult(action: string, status: number, body: unknown): BrainActionOutcome {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.cancelled === true) return { ok: false, cancelled: true, message: String(b.message ?? "Acción cancelada.") };
  const failed = status >= 400 || b.error === true || typeof b.error === "string" || b.success === false;
  const text = typeof b.message === "string" ? b.message
    : typeof b.error === "string" ? b.error
      : failed ? `No se pudo ejecutar ${action} (${status})` : `${humanizeAction(action)}: hecho.`;
  return { ok: !failed, cancelled: false, message: text };
}

export async function runBrainAction(a: BrainProposedAction): Promise<BrainActionOutcome> {
  try {
    const res = await fetchBrainAction(`${API}/api/shopybrain/execute-action`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: a.action, params: a.params ?? {} }),
    });
    const body = await res.json().catch(() => null);
    return describeActionResult(a.action, res.status, body);
  } catch (e) {
    return { ok: false, cancelled: false, message: `Error de conexión: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** "create_brand_ad" → "Create brand ad". */
export function humanizeAction(name: string): string {
  const s = name.replace(/[_-]+/g, " ").trim();
  return s ? s[0]!.toUpperCase() + s.slice(1) : name;
}
