import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  title: text("title").notNull(),
  handle: text("handle").notNull(),
  bodyHtml: text("body_html"),
  vendor: text("vendor"),
  productType: text("product_type"),
  status: text("status").notNull().default("active"),
  publishedAt: text("published_at"),
  tags: text("tags"),
  price: text("price"),
  compareAtPrice: text("compare_at_price"),
  imageCount: integer("image_count").notNull().default(0),
  variantCount: integer("variant_count").notNull().default(1),
  imagesJson: jsonb("images_json"),
  auditScore: real("audit_score"),
  auditGrade: text("audit_grade"),
  titleScore: real("title_score"),
  descriptionScore: real("description_score"),
  priceScore: real("price_score"),
  imageScore: real("image_score"),
  seoScore: real("seo_score"),
  auditProblems: text("audit_problems").array(),
  lastAuditedAt: timestamp("last_audited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
