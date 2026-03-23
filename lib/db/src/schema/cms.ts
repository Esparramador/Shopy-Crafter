import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const cmsContent = pgTable("cms_content", {
  id: serial("id").primaryKey(),
  content: jsonb("content").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
  version: integer("version").default(1).notNull(),
});

export const cmsVersions = pgTable("cms_versions", {
  id: serial("id").primaryKey(),
  content: jsonb("content").notNull(),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
  savedBy: text("saved_by"),
  version: integer("version").notNull(),
  label: text("label"),
});
