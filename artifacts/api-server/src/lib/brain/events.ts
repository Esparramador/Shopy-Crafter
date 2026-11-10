/**
 * Registro de lo que pasa por el cerebro (tabla brain_events).
 *
 * recordBrainEvent() nunca rompe la petición: si la BD falla, se cuenta y se
 * escribe en el log. La tabla tiene techo: pruneBrainEvents() borra lo anterior a
 * BRAIN_EVENTS_RETENTION_DAYS (al arrancar y cada 6 h, en index.ts).
 */
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, brainEventsTable, type BrainEvent, type BrainEventKind, type BrainEventStatus } from "@workspace/db";
import { logger } from "../logger.js";
import type { BrainGate } from "./catalog.js";

export const BRAIN_EVENTS_RETENTION_DAYS = 90;
const MAX_INPUT_CHARS = 2000;
const MAX_DETAIL_CHARS = 1000;
const MAX_ACTIONS = 20;

const SENSITIVE_KEYS = /pass(word)?|token|secret|api[-_]?key|authorization|cookie/i;

export interface BrainActionRef {
  action: string;
  params?: Record<string, unknown>;
}

export interface BrainEventInput {
  gate: BrainGate;
  channel: string;
  userId?: string | number | null;
  projectId?: number | null;
  input?: string | null;
  kind: BrainEventKind;
  engine?: string | null;
  model?: string | null;
  actions?: BrainActionRef[];
  droppedActions?: BrainActionRef[];
  status: BrainEventStatus;
  detail?: string | null;
  durationMs?: number | null;
}

/** Parámetros sin secretos y sin textos enormes (data URIs, HTML…). */
function safeActions(list: BrainActionRef[] | undefined): BrainActionRef[] | null {
  if (!list?.length) return null;
  return list.slice(0, MAX_ACTIONS).map(({ action, params }) => ({
    action: String(action).slice(0, 80),
    params: params && typeof params === "object"
      ? Object.fromEntries(Object.entries(params).map(([k, v]) => [
          k,
          SENSITIVE_KEYS.test(k) ? "***" : typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v,
        ]))
      : undefined,
  }));
}

let failures = 0;
/** Escrituras de eventos que fallaron desde que arrancó el proceso. */
export function brainEventFailures(): number { return failures; }

export async function recordBrainEvent(ev: BrainEventInput): Promise<number | null> {
  try {
    const [row] = await db.insert(brainEventsTable).values({
      gate: ev.gate,
      channel: ev.channel.slice(0, 60),
      userId: ev.userId === null || ev.userId === undefined ? null : String(ev.userId).slice(0, 120),
      projectId: ev.projectId && Number.isFinite(ev.projectId) ? ev.projectId : null,
      input: ev.input ? ev.input.slice(0, MAX_INPUT_CHARS) : null,
      kind: ev.kind,
      engine: ev.engine ?? null,
      model: ev.model ?? null,
      actions: safeActions(ev.actions),
      droppedActions: safeActions(ev.droppedActions),
      status: ev.status,
      detail: ev.detail ? ev.detail.slice(0, MAX_DETAIL_CHARS) : null,
      durationMs: ev.durationMs === null || ev.durationMs === undefined ? null : Math.round(ev.durationMs),
    }).returning({ id: brainEventsTable.id });
    return row?.id ?? null;
  } catch (err) {
    failures++;
    logger.warn({ err: err instanceof Error ? err.message : String(err), failures, gate: ev.gate, channel: ev.channel }, "brain_events: no se pudo registrar el evento");
    return null;
  }
}

export async function listBrainEvents(opts: { gate?: BrainGate; limit?: number; before?: number }): Promise<{ events: BrainEvent[]; nextBefore: number | null }> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50) || 50, 1), 200);
  const conds = [];
  if (opts.gate) conds.push(eq(brainEventsTable.gate, opts.gate));
  if (opts.before && opts.before > 0) conds.push(lt(brainEventsTable.id, opts.before));
  const events = await db.select().from(brainEventsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(brainEventsTable.id))
    .limit(limit);
  return { events, nextBefore: events.length === limit ? events[events.length - 1]!.id : null };
}

/** Idempotente: la tabla y sus índices (mismo patrón que client_knowledge). */
export async function ensureBrainEventsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS brain_events (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gate TEXT NOT NULL,
      channel TEXT NOT NULL,
      user_id TEXT,
      project_id INTEGER,
      input TEXT,
      kind TEXT NOT NULL,
      engine TEXT,
      model TEXT,
      actions JSONB,
      dropped_actions JSONB,
      status TEXT NOT NULL,
      detail TEXT,
      duration_ms INTEGER
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS brain_events_created_idx ON brain_events (created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS brain_events_gate_created_idx ON brain_events (gate, created_at)`);
}

export async function pruneBrainEvents(): Promise<number> {
  const r = await db.execute(sql`
    DELETE FROM brain_events WHERE created_at < NOW() - make_interval(days => ${BRAIN_EVENTS_RETENTION_DAYS})
  `);
  return Number((r as { rowCount?: number | null }).rowCount ?? 0);
}
