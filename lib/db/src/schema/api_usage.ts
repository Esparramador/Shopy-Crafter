import { pgTable, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";

/**
 * api_usage_log: registra cada llamada a una API externa (Replicate, Claude,
 * Gemini, Runway, ElevenLabs, PageSpeed, etc.) con su coste estimado en EUR.
 * Permite que el "Mi Pricing CFO → Estructura de costes" muestre valores
 * REALES en lugar de 0 € hardcodeado.
 */
export const apiUsageLogTable = pgTable(
  "api_usage_log",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    model: text("model"),
    projectId: integer("project_id"),
    inputUnits: real("input_units").default(0),
    outputUnits: real("output_units").default(0),
    unitsLabel: text("units_label"),
    costUsd: real("cost_usd").default(0),
    costEur: real("cost_eur").default(0),
    success: integer("success").default(1),
    errorMessage: text("error_message"),
    metadata: text("metadata"),
    sessionId: text("session_id"),
    /** Quién disparó la llamada: client | admin | public (para topes de gasto). */
    actor: text("actor"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index("api_usage_provider_idx").on(t.provider),
    projectIdx: index("api_usage_project_idx").on(t.projectId),
    createdIdx: index("api_usage_created_idx").on(t.createdAt),
  }),
);

export type ApiUsageLog = typeof apiUsageLogTable.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLogTable.$inferInsert;
