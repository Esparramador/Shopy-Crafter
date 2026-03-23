import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const seoDataTable = pgTable("seo_data", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  hasSchema: boolean("has_schema").notNull().default(false),
  schemaJson: text("schema_json"),
  hasAltTexts: boolean("has_alt_texts").notNull().default(false),
  cleanHandle: boolean("clean_handle").notNull().default(false),
  seoScore: real("seo_score"),
  seoGrade: text("seo_grade"),
  descriptionLength: integer("description_length").default(0),
  keywordStrategy: jsonb("keyword_strategy"),
  pageSpeedScore: real("page_speed_score"),
  lcp: real("lcp"),
  cls: real("cls"),
  inp: real("inp"),
  lastAuditedAt: timestamp("last_audited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSeoDataSchema = createInsertSchema(seoDataTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSeoData = z.infer<typeof insertSeoDataSchema>;
export type SeoData = typeof seoDataTable.$inferSelect;
