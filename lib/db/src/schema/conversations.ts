import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const geminiConversations = pgTable("gemini_conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = geminiConversations;

export const insertConversationSchema = createInsertSchema(geminiConversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof geminiConversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
