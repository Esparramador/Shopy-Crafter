import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PlatformType = "shopify" | "woocommerce" | "prestashop" | "wordpress" | "universal" | "stripe";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  platformType: text("platform_type").notNull().default("shopify").$type<PlatformType>(),
  shopDomain: text("shop_domain").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  storeNiche: text("store_niche"),
  brandTone: text("brand_tone"),
  targetAudience: text("target_audience"),
  storeMarkets: text("store_markets"),
  replicateApiToken: text("replicate_api_token"),
  anthropicApiKey: text("anthropic_api_key"),
  autoPilotEnabled: boolean("auto_pilot_enabled").notNull().default(false),
  productCount: integer("product_count"),
  avgAuditScore: real("avg_audit_score"),
  webhookId: text("webhook_id"),
  aiReportJson: text("ai_report_json"),
  aiReportGeneratedAt: timestamp("ai_report_generated_at", { withTimezone: true }),
  // Plan & limits
  plan: text("plan").notNull().default("starter").$type<"admin" | "emprendedor" | "starter" | "agency_pro" | "enterprise" | "trial">(),
  productsUsedThisMonth: integer("products_used_this_month").notNull().default(0),
  imagesUsedThisMonth: integer("images_used_this_month").notNull().default(0),
  creditsProducts: integer("credits_products").notNull().default(0),
  creditsImages: integer("credits_images").notNull().default(0),
  planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
  serviceLevel: text("service_level").notNull().default("none").$type<"none" | "audit" | "managed" | "premium" | "enterprise">(),
  serviceMonthlyValue: integer("service_monthly_value").notNull().default(0),
  serviceNotes: text("service_notes"),
  clientContactName: text("client_contact_name"),
  clientContactEmail: text("client_contact_email"),
  clientContactPhone: text("client_contact_phone"),
  instagramHandle: text("instagram_handle"),
  projectDescription: text("project_description"),
  status: text("status").notNull().default("active").$type<"active" | "paused" | "churned" | "prospect">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const planCreditPacksTable = pgTable("plan_credit_packs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  packType: text("pack_type").notNull(),
  productsIncluded: integer("products_included").notNull(),
  imagesIncluded: integer("images_included").notNull(),
  shopifyProductId: text("shopify_product_id"),
  shopifyOrderId: text("shopify_order_id"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type PlanType = "admin" | "emprendedor" | "starter" | "agency_pro" | "enterprise" | "trial";
