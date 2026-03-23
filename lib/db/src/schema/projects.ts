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

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
