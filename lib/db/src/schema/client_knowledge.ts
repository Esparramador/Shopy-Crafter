import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";

/**
 * client_knowledge — Persistent intelligence per client project.
 *
 * Every fact, goal, competitor, pain point, file content, or insight
 * the client shares is stored here and loaded into every chat session.
 * ShopyBrain also absorbs these entries as sector memories.
 */
export const clientKnowledgeTable = pgTable("client_knowledge", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").default("chat"),
  confidence: real("confidence").default(0.85),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
