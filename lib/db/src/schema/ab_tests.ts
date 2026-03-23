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

export const abTestsTable = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  productTitle: text("product_title").notNull(),
  imageType: text("image_type").notNull(),
  hypothesis: text("hypothesis").notNull(),
  variantAUrl: text("variant_a_url"),
  variantAShopifyImageId: text("variant_a_shopify_image_id"),
  variantBUrl: text("variant_b_url"),
  variantBShopifyImageId: text("variant_b_shopify_image_id"),
  variantAVisitors: integer("variant_a_visitors").notNull().default(0),
  variantBVisitors: integer("variant_b_visitors").notNull().default(0),
  variantAConversions: integer("variant_a_conversions").notNull().default(0),
  variantBConversions: integer("variant_b_conversions").notNull().default(0),
  variantARevenue: real("variant_a_revenue").notNull().default(0),
  variantBRevenue: real("variant_b_revenue").notNull().default(0),
  confidence: real("confidence").notNull().default(0),
  winner: text("winner"),
  status: text("status").notNull().default("running"),
  targetMetric: text("target_metric").notNull().default("conversion"),
  minimumSampleSize: integer("minimum_sample_size").notNull().default(100),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const trackEventsTable = pgTable("track_events", {
  id: serial("id").primaryKey(),
  testId: text("test_id").notNull(),
  variant: text("variant").notNull(),
  eventType: text("event_type").notNull(),
  shopifyProductId: text("shopify_product_id").notNull(),
  sessionId: text("session_id").notNull(),
  revenue: real("revenue"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAbTestSchema = createInsertSchema(abTestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAbTest = z.infer<typeof insertAbTestSchema>;
export type AbTest = typeof abTestsTable.$inferSelect;
