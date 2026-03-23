import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const visualDnaTable = pgTable("visual_dna", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  backgroundStyle: text("background_style"),
  lightingStyle: text("lighting_style"),
  colorTemp: text("color_temp"),
  composition: text("composition"),
  mood: text("mood"),
  props: text("props").array(),
  humanPresence: text("human_presence"),
  consistencyScore: real("consistency_score"),
  brandColors: text("brand_colors").array(),
  extractedAt: timestamp("extracted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVisualDnaSchema = createInsertSchema(visualDnaTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVisualDna = z.infer<typeof insertVisualDnaSchema>;
export type VisualDna = typeof visualDnaTable.$inferSelect;
