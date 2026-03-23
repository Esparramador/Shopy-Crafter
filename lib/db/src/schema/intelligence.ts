import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  eventType: text("event_type").notNull(),
  productId: text("product_id"),
  payload: text("payload"),
  revenueBefore: real("revenue_before"),
  revenueAfter: real("revenue_after"),
  revenueDelta: real("revenue_delta"),
  attributedRevenue: real("attributed_revenue").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const revenueSnapshotsTable = pgTable("revenue_snapshots", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  date: text("date").notNull(),
  revenue: real("revenue"),
  orders: integer("orders"),
  conversionRate: real("conversion_rate"),
  aov: real("aov"),
  grossMargin: real("gross_margin"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forecastsTable = pgTable("forecasts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  forecastDate: text("forecast_date"),
  forecastType: text("forecast_type"),
  productId: text("product_id"),
  predictedValue: real("predicted_value"),
  confidenceLow: real("confidence_low"),
  confidenceHigh: real("confidence_high"),
  confidencePct: integer("confidence_pct"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow(),
});
