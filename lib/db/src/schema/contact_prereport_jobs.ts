import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { auditLogTable } from "./users";
import { projectFilesTable } from "./project_files";

export type ContactPrereportJobStatus = "pending" | "processing" | "completed" | "needs_review" | "failed";
export type ContactPrereportReportStatus = "pending" | "generating" | "completed" | "failed";
export type ContactPrereportDeliveryStatus = "pending" | "attempting" | "sent" | "skipped" | "unknown" | "failed";

export const contactPrereportJobsTable = pgTable("contact_prereport_jobs", {
  submissionId: text("submission_id")
    .primaryKey()
    .references(() => auditLogTable.id, { onDelete: "cascade" }),
  status: text("status").$type<ContactPrereportJobStatus>().notNull().default("pending"),
  reportStatus: text("report_status").$type<ContactPrereportReportStatus>().notNull().default("pending"),
  emailStatus: text("email_status").$type<ContactPrereportDeliveryStatus>().notNull().default("pending"),
  klaviyoStatus: text("klaviyo_status").$type<ContactPrereportDeliveryStatus>().notNull().default("pending"),
  reportAttempts: integer("report_attempts").notNull().default(0),
  claimAttempts: integer("claim_attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leaseToken: text("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  reportFileId: integer("report_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("contact_prereport_jobs_status_due_idx").on(table.status, table.nextAttemptAt, table.createdAt),
  index("contact_prereport_jobs_status_lease_idx").on(table.status, table.leaseExpiresAt),
]);

export type ContactPrereportJob = typeof contactPrereportJobsTable.$inferSelect;
