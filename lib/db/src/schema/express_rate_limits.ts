import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const expressRateLimitsTable = pgTable(
  "express_rate_limits",
  {
    key: text("key").primaryKey(),
    totalHits: integer("total_hits").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("idx_express_rate_limits_reset_at").on(t.resetAt)],
);

export type ExpressRateLimit = typeof expressRateLimitsTable.$inferSelect;
