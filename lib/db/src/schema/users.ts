import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<"admin" | "client">(),
  clientId: text("client_id"),
  isActive: integer("is_active").default(1).notNull(),
  avatarColor: text("avatar_color").default("#5b4eff"),
  inviteToken: text("invite_token"),
  inviteExpires: timestamp("invite_expires"),
  resetToken: text("reset_token"),
  resetExpires: timestamp("reset_expires"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogTable = pgTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const approvalsTable = pgTable("approvals", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  beforeValue: text("before_value"),
  afterValue: text("after_value"),
  reasoning: text("reasoning"),
  estimatedImpact: text("estimated_impact"),
  status: text("status").notNull().default("pending").$type<"pending" | "approved" | "rejected">(),
  clientComment: text("client_comment"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  fromRole: text("from_role").notNull().$type<"admin" | "client">(),
  fromName: text("from_name").notNull(),
  content: text("content").notNull(),
  isRead: integer("is_read").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
