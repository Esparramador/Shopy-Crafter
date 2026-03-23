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

export const cogsTable = pgTable("cogs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  unitCost: real("unit_cost").notNull().default(0),
  packagingCost: real("packaging_cost").notNull().default(0),
  labelCost: real("label_cost").notNull().default(0),
  shippingCostDomestic: real("shipping_cost_domestic").notNull().default(0),
  shippingCostInternational: real("shipping_cost_international").notNull().default(0),
  fulfillmentFee: real("fulfillment_fee").notNull().default(0),
  returnRate: real("return_rate").notNull().default(0.08),
  returnProcessingCost: real("return_processing_cost").notNull().default(0),
  shopifyPaymentFee: real("shopify_payment_fee").notNull().default(0.015),
  shopifyPlanCostPerOrder: real("shopify_plan_cost_per_order").notNull().default(0),
  cac: real("cac").notNull().default(0),
  affiliateFee: real("affiliate_fee").notNull().default(0),
  overheadPerUnit: real("overhead_per_unit").notNull().default(0),
  totalCogs: real("total_cogs").notNull().default(0),
  breakEvenPrice: real("break_even_price").notNull().default(0),
  minimumViablePrice: real("minimum_viable_price").notNull().default(0),
  lastCompetitorAnalysis: jsonb("last_competitor_analysis"),
  lastPricingRecommendation: jsonb("last_pricing_recommendation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCogsSchema = createInsertSchema(cogsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCogs = z.infer<typeof insertCogsSchema>;
export type Cogs = typeof cogsTable.$inferSelect;
