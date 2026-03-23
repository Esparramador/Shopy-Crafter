import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const competitorsTable = pgTable("competitors", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").default("direct"),
  lastScanned: timestamp("last_scanned"),
  active: integer("active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const competitorSnapshotsTable = pgTable("competitor_snapshots", {
  id: text("id").primaryKey(),
  competitorId: text("competitor_id").notNull(),
  scannedAt: timestamp("scanned_at").defaultNow(),
  productsFound: integer("products_found"),
  priceMin: real("price_min"),
  priceMax: real("price_max"),
  priceMedian: real("price_median"),
  newProducts: text("new_products"),
  outOfStock: text("out_of_stock"),
  promotionsDetected: text("promotions_detected"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  rawData: text("raw_data"),
});

export const competitorAlertsTable = pgTable("competitor_alerts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  competitorId: text("competitor_id").notNull(),
  alertType: text("alert_type"),
  severity: text("severity"),
  title: text("title"),
  description: text("description"),
  actionSuggestion: text("action_suggestion"),
  dismissed: integer("dismissed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
