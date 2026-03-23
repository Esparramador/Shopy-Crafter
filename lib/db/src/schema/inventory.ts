import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const inventoryTrackingTable = pgTable("inventory_tracking", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  productId: text("product_id").notNull(),
  variantId: text("variant_id"),
  productTitle: text("product_title"),
  currentStock: integer("current_stock"),
  avgDailySales: real("avg_daily_sales"),
  daysRemaining: integer("days_remaining"),
  restockThreshold: integer("restock_threshold").default(15),
  supplierEmail: text("supplier_email"),
  supplierLeadDays: integer("supplier_lead_days").default(14),
  lastRestockDate: text("last_restock_date"),
  status: text("status"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const restockOrdersTable = pgTable("restock_orders", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  productId: text("product_id"),
  productTitle: text("product_title"),
  quantitySuggested: integer("quantity_suggested"),
  urgency: text("urgency"),
  emailDraft: text("email_draft"),
  sentAt: timestamp("sent_at"),
  adminApproved: integer("admin_approved").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
