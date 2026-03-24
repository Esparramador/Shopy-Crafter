import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

export const userSessionsTable = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);
