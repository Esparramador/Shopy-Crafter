import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const onboardingProgressTable = pgTable("onboarding_progress", {
  userId: text("user_id").primaryKey(),
  projectId: text("project_id"),
  stepStoreConnected: integer("step_store_connected").default(0),
  stepAuditRun: integer("step_audit_run").default(0),
  stepImageGenerated: integer("step_image_generated").default(0),
  stepPriceOptimized: integer("step_price_optimized").default(0),
  stepAbTestActive: integer("step_ab_test_active").default(0),
  stepSeoApplied: integer("step_seo_applied").default(0),
  stepClientInvited: integer("step_client_invited").default(0),
  completionPct: integer("completion_pct").default(0),
  onboardingCompleted: integer("onboarding_completed").default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const achievementsTable = pgTable("achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});
