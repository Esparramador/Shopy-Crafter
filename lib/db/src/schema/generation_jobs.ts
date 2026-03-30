import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  bigint,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const generationJobsTable = pgTable("generation_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  imageType: text("image_type").notNull(),
  status: text("status").notNull().default("pending"),
  prompt: text("prompt"),
  negativePrompt: text("negative_prompt"),
  model: text("model"),
  replicatePredictionId: text("replicate_prediction_id"),
  imageUrl: text("image_url"),
  shopifyImageId: bigint("shopify_image_id", { mode: "number" }),
  altText: text("alt_text"),
  estimatedCost: real("estimated_cost"),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGenerationJobSchema = createInsertSchema(generationJobsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobsTable.$inferSelect;
