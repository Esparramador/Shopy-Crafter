import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const chatGroupsTable = pgTable("chat_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatGroupMembersTable = pgTable("chat_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => chatGroupsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMessagesTable = pgTable("group_messages", {
  id: text("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => chatGroupsTable.id, { onDelete: "cascade" }),
  projectId: text("project_id"),
  fromRole: text("from_role").notNull().$type<"admin" | "client">(),
  fromName: text("from_name").notNull(),
  content: text("content").notNull(),
  isRead: integer("is_read").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ChatGroup = typeof chatGroupsTable.$inferSelect;
export type ChatGroupMember = typeof chatGroupMembersTable.$inferSelect;
export type GroupMessage = typeof groupMessagesTable.$inferSelect;
