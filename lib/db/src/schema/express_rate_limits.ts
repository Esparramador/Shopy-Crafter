import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const expressRateLimitsTable = pgTable("express_rate_limits", {
  key: text("key").primaryKey(),
  totalHits: integer("total_hits").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
