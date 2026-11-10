import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type BrainEventKind = "answer" | "action" | "handoff" | "execute";
export type BrainEventStatus = "ok" | "error" | "denied" | "needs_confirmation" | "failed";

/**
 * brain_events — todo lo que entra por una puerta de ShopyBrain (admin, cliente,
 * landing) y lo que el cerebro decidió: responder, proponer/ejecutar una acción o
 * derivar al equipo. Lo escribe lib/brain/events.ts; se crea y se poda al arrancar.
 */
export const brainEventsTable = pgTable("brain_events", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  gate: text("gate").notNull(),
  channel: text("channel").notNull(),
  userId: text("user_id"),
  projectId: integer("project_id"),
  input: text("input"),
  kind: text("kind").$type<BrainEventKind>().notNull(),
  engine: text("engine"),
  model: text("model"),
  actions: jsonb("actions").$type<Array<{ action: string; params?: Record<string, unknown> }>>(),
  droppedActions: jsonb("dropped_actions").$type<Array<{ action: string; params?: Record<string, unknown> }>>(),
  status: text("status").$type<BrainEventStatus>().notNull(),
  detail: text("detail"),
  durationMs: integer("duration_ms"),
}, (table) => [
  index("brain_events_created_idx").on(table.createdAt),
  index("brain_events_gate_created_idx").on(table.gate, table.createdAt),
]);

export type BrainEvent = typeof brainEventsTable.$inferSelect;
