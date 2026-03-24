import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { geminiConversations } from "./conversations";

export const geminiMessages = pgTable("gemini_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => geminiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(geminiMessages).omit({
  id: true,
  createdAt: true,
});

export type GeminiMessage = typeof geminiMessages.$inferSelect;
export type InsertGeminiMessage = z.infer<typeof insertMessageSchema>;
