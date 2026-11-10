/**
 * Lo que necesita el panel «Cerebro» para leer brain_events
 * (GET /api/shopybrain/events y /events/channels): tipos, URL con filtros y
 * cursor, y cómo se nombra cada cosa en pantalla.
 */
export type BrainGate = "admin" | "client" | "public";
export type BrainEventKind = "answer" | "action" | "handoff" | "execute";
export type BrainEventStatus = "ok" | "error" | "denied" | "needs_confirmation" | "failed";
export type Tone = "gold" | "sky" | "jade" | "crim" | "gray";

export interface BrainActionRef { action: string; params?: Record<string, unknown> }

export interface BrainEvent {
  id: number;
  createdAt: string;
  gate: BrainGate | string;
  channel: string;
  userId: string | null;
  projectId: number | null;
  input: string | null;
  kind: BrainEventKind | string;
  engine: string | null;
  model: string | null;
  actions: BrainActionRef[] | null;
  droppedActions: BrainActionRef[] | null;
  status: BrainEventStatus | string;
  detail: string | null;
  durationMs: number | null;
}

export interface BrainChannel { channel: string; gate: string; count: number }

export const GATE_INFO: Record<BrainGate, { label: string; tone: Tone; hint: string }> = {
  admin: { label: "Admin", tone: "gold", hint: "El dueño: chat, paleta, buscador, estudios" },
  client: { label: "Cliente", tone: "sky", hint: "Un cliente con sesión, sobre su tienda" },
  public: { label: "Público", tone: "jade", hint: "Visitantes de la landing y formularios" },
};

export const KIND_INFO: Record<BrainEventKind, { label: string; tone: Tone }> = {
  answer: { label: "Respuesta", tone: "sky" },
  action: { label: "Acción", tone: "gold" },
  handoff: { label: "Derivación", tone: "jade" },
  execute: { label: "Ejecución", tone: "gold" },
};

export const STATUS_INFO: Record<BrainEventStatus, { label: string; tone: Tone }> = {
  ok: { label: "Correcto", tone: "jade" },
  error: { label: "Error", tone: "crim" },
  failed: { label: "Falló", tone: "crim" },
  denied: { label: "Denegado", tone: "crim" },
  needs_confirmation: { label: "Pide confirmación", tone: "gold" },
};

export function gateInfo(g: string) { return GATE_INFO[g as BrainGate] ?? { label: g, tone: "gray" as Tone, hint: "" }; }
export function kindInfo(k: string) { return KIND_INFO[k as BrainEventKind] ?? { label: k, tone: "gray" as Tone }; }
export function statusInfo(s: string) { return STATUS_INFO[s as BrainEventStatus] ?? { label: s, tone: "gray" as Tone }; }

export function buildEventsUrl(base: string, f: { gate?: string; channel?: string; before?: number | null; limit?: number }): string {
  const q = new URLSearchParams();
  if (f.gate) q.set("gate", f.gate);
  if (f.channel) q.set("channel", f.channel);
  q.set("limit", String(f.limit ?? 40));
  if (f.before) q.set("before", String(f.before));
  return `${base}/api/shopybrain/events?${q.toString()}`;
}

/** 840 → "840 ms", 12_400 → "12,4 s", 185_000 → "3 min 5 s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** "hace 5 min", "hace 3 h", o la fecha si es de otro día. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.max(0, now.getTime() - d.getTime());
  if (diff < 45_000) return "ahora";
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000 && d.getDate() === now.getDate()) return `hace ${Math.round(diff / 3_600_000)} h`;
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export interface EventsSummary { total: number; actions: number; dropped: number; failures: number; avgMs: number | null }

/** Cifras de lo cargado en pantalla. */
export function summarizeEvents(events: BrainEvent[]): EventsSummary {
  const timed = events.filter(e => typeof e.durationMs === "number");
  return {
    total: events.length,
    actions: events.reduce((n, e) => n + (e.actions?.length ?? 0), 0),
    dropped: events.reduce((n, e) => n + (e.droppedActions?.length ?? 0), 0),
    failures: events.filter(e => ["error", "failed", "denied"].includes(e.status)).length,
    avgMs: timed.length ? Math.round(timed.reduce((n, e) => n + (e.durationMs ?? 0), 0) / timed.length) : null,
  };
}

/** Canales para el filtro: los de la puerta elegida, sin repetir, el más usado primero. */
export function channelsForGate(list: BrainChannel[], gate: string): Array<{ channel: string; count: number }> {
  const acc = new Map<string, number>();
  for (const c of list) {
    if (gate && c.gate !== gate) continue;
    acc.set(c.channel, (acc.get(c.channel) ?? 0) + c.count);
  }
  return [...acc.entries()].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));
}
