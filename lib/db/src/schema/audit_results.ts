import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const auditResultsTable = pgTable("audit_results", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  overallScore: real("overall_score"),
  performanceScore: real("performance_score"),
  seoScore: real("seo_score"),
  accessibilityScore: real("accessibility_score"),
  bestPracticesScore: real("best_practices_score"),
  contentQualityScore: real("content_quality_score"),
  mobileFriendlinessScore: real("mobile_friendliness_score"),
  technicalSeoScore: real("technical_seo_score"),
  pageSpeedMobile: jsonb("pagespeed_mobile"),
  pageSpeedDesktop: jsonb("pagespeed_desktop"),
  scrapingResult: jsonb("scraping_result"),
  aiAnalysis: jsonb("ai_analysis"),
  issues: jsonb("issues"),
  recommendations: jsonb("recommendations"),
  auditedAt: timestamp("audited_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditResult = typeof auditResultsTable.$inferSelect;
