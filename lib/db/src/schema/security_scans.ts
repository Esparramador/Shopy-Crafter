import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const securityScansTable = pgTable("security_scans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  score: integer("score").notNull(),
  findings: jsonb("findings").notNull(),
  techStack: jsonb("tech_stack"),
  summary: text("summary"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SecurityScan = typeof securityScansTable.$inferSelect;
export type SecurityScanInsert = typeof securityScansTable.$inferInsert;
