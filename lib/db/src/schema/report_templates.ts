import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";

export const reportTemplatesTable = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),

  logoBase64: text("logo_base64"),
  companyName: varchar("company_name", { length: 200 }),
  tagline: varchar("tagline", { length: 300 }),

  primaryColor: varchar("primary_color", { length: 9 }).default("#c8a84b"),
  secondaryColor: varchar("secondary_color", { length: 9 }).default("#08080e"),
  accentColor: varchar("accent_color", { length: 9 }).default("#44cc88"),
  textColor: varchar("text_color", { length: 9 }).default("#f0f0f5"),
  bgColor: varchar("bg_color", { length: 9 }).default("#08080e"),
  cardBg: varchar("card_bg", { length: 9 }).default("#12121a"),
  borderColor: varchar("border_color", { length: 9 }).default("#1a1a22"),

  headingFont: varchar("heading_font", { length: 100 }).default("Helvetica Neue"),
  bodyFont: varchar("body_font", { length: 100 }).default("Helvetica Neue"),
  headingWeight: varchar("heading_weight", { length: 10 }).default("700"),

  coverStyle: varchar("cover_style", { length: 20 }).default("centered"),
  sectionStyle: varchar("section_style", { length: 20 }).default("card"),

  footerText: varchar("footer_text", { length: 300 }),
  showPageNumbers: boolean("show_page_numbers").default(true),

  isPublic: boolean("is_public").default(false),
  shareToken: varchar("share_token", { length: 64 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
