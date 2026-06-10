import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const priceHistoryTable = pgTable("price_history", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  oldPrice: real("old_price"),
  newPrice: real("new_price").notNull(),
  changeSource: text("change_source").default("sync"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandDnaTable = pgTable("brand_dna", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  primaryColors: text("primary_colors").array(),
  typographyStyle: text("typography_style"),
  layoutPattern: text("layout_pattern"),
  visualDensity: text("visual_density"),
  toneOfVoice: text("tone_of_voice"),
  valuePropositions: text("value_propositions").array(),
  urgencyTactics: text("urgency_tactics").array(),
  targetAudience: text("target_audience"),
  photographyStyle: text("photography_style"),
  brandPersonality: text("brand_personality"),
  competitivePosition: text("competitive_position"),
  extractedFromUrl: text("extracted_from_url"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
  sector: text("sector"),
  companyDescription: text("company_description"),
  services: text("services").array(),
  brandValues: text("brand_values").array(),
  brandArchetype: text("brand_archetype"),
  socialHandles: text("social_handles").array(),
  uniqueValueProposition: text("unique_value_proposition"),
  taglines: text("taglines").array(),
  contentPillars: text("content_pillars").array(),
  websiteUrl: text("website_url"),
  fullProfileJson: text("full_profile_json"),
  extractionStatus: text("extraction_status"),
});
