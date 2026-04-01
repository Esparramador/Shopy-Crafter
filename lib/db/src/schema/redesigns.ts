import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const redesignsTable = pgTable("redesigns", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  originalTitle: text("original_title").notNull(),
  originalPrice: text("original_price"),
  newTitle: text("new_title").notNull(),
  newBodyHtml: text("new_body_html").notNull(),
  newShortDescription: text("new_short_description").notNull(),
  newPrice: text("new_price").notNull(),
  newCompareAtPrice: text("new_compare_at_price").notNull(),
  newTags: text("new_tags").notNull(),
  metaTitle: text("meta_title").notNull(),
  metaDescription: text("meta_description").notNull(),
  photoBrief: text("photo_brief").array(),
  priceReasoning: text("price_reasoning"),
  newCategory: text("new_category"),
  newMetafields: jsonb("new_metafields"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  appliedFields: text("applied_fields").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRedesignSchema = createInsertSchema(redesignsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRedesign = z.infer<typeof insertRedesignSchema>;
export type Redesign = typeof redesignsTable.$inferSelect;
