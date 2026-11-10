import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool, auditLogTable, contactPrereportJobsTable } from "@workspace/db";
import { projectFilesTable } from "@workspace/db/schema";
import type { ContactLeadData } from "./contact-idempotency.js";
import {
  parseContactPrereportEngineAttribution,
  type GeneratedContactPrereport,
  type ContactPrereportEngineAttribution,
} from "./contact-prereport-attribution.js";
import type {
  ClaimedContactPrereportJob,
  ContactDeliveryChannel,
  ContactDeliveryOutcome,
  ContactPrereportStore,
} from "./contact-prereport-worker.js";

const LEASE_SECONDS = 90;
const MAX_REPORT_ATTEMPTS = 3;
const REPORT_RETRY_SECONDS = [30, 300];

interface ContactJobRow {
  submission_id: string;
  report_status: ClaimedContactPrereportJob["reportStatus"];
  email_status: ClaimedContactPrereportJob["emailStatus"];
  klaviyo_status: ClaimedContactPrereportJob["klaviyoStatus"];
  report_attempts: number;
  report_file_id: number | null;
  lease_token: string;
}

function mapJob(row: ContactJobRow): ClaimedContactPrereportJob {
  return {
    submissionId: row.submission_id,
    leaseToken: row.lease_token,
    reportStatus: row.report_status,
    emailStatus: row.email_status,
    klaviyoStatus: row.klaviyo_status,
    reportAttempts: Number(row.report_attempts),
    reportFileId: row.report_file_id === null ? null : Number(row.report_file_id),
  };
}

export class PostgresContactPrereportStore implements ContactPrereportStore {
  async claimNext(): Promise<ClaimedContactPrereportJob | null> {
    await pool.query(`
      UPDATE contact_prereport_jobs
      SET report_status = CASE
            WHEN report_status = 'generating' THEN 'pending'
            ELSE report_status
          END,
          email_status = CASE
            WHEN email_status = 'attempting' THEN 'unknown'
            ELSE email_status
          END,
          klaviyo_status = CASE
            WHEN klaviyo_status = 'attempting' THEN 'unknown'
            ELSE klaviyo_status
          END,
          status = CASE
            WHEN report_status IN ('pending', 'generating')
              OR email_status = 'pending'
              OR klaviyo_status = 'pending' THEN 'pending'
            WHEN report_status = 'failed' THEN 'failed'
            WHEN email_status IN ('attempting', 'unknown', 'failed')
              OR klaviyo_status IN ('attempting', 'unknown', 'failed') THEN 'needs_review'
            ELSE 'completed'
          END,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE status = 'processing'
        AND lease_expires_at <= NOW()
    `);

    const leaseToken = randomUUID();
    const result = await pool.query<ContactJobRow>(`
      WITH next_job AS (
        SELECT submission_id
        FROM contact_prereport_jobs
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
          AND (
            report_status = 'pending'
            OR email_status = 'pending'
            OR klaviyo_status = 'pending'
          )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE contact_prereport_jobs AS job
      SET status = 'processing',
          report_status = CASE
            WHEN job.report_status = 'pending' THEN 'generating'
            ELSE job.report_status
          END,
          report_attempts = job.report_attempts +
            CASE WHEN job.report_status = 'pending' THEN 1 ELSE 0 END,
          claim_attempts = job.claim_attempts + 1,
          lease_token = $1,
          lease_expires_at = NOW() + ($2 * INTERVAL '1 second'),
          updated_at = NOW()
      FROM next_job
      WHERE job.submission_id = next_job.submission_id
      RETURNING
        job.submission_id,
        job.report_status,
        job.email_status,
        job.klaviyo_status,
        job.report_attempts,
        job.report_file_id,
        job.lease_token
    `, [leaseToken, LEASE_SECONDS]);

    return result.rows[0] ? mapJob(result.rows[0]) : null;
  }

  async renewLease(job: ClaimedContactPrereportJob): Promise<boolean> {
    const updated = await pool.query(`
      UPDATE contact_prereport_jobs
      SET lease_expires_at = NOW() + ($3 * INTERVAL '1 second'),
          updated_at = NOW()
      WHERE submission_id = $1
        AND lease_token = $2
        AND status = 'processing'
      RETURNING submission_id
    `, [job.submissionId, job.leaseToken, LEASE_SECONDS]);
    return updated.rowCount === 1;
  }

  async loadLead(submissionId: string): Promise<ContactLeadData> {
    const [record] = await db.select({
      action: auditLogTable.action,
      details: auditLogTable.details,
    }).from(auditLogTable).where(eq(auditLogTable.id, submissionId)).limit(1);

    if (!record || record.action !== "lead_form_submitted" || !record.details) {
      throw new Error("ContactLeadUnavailable");
    }
    const lead = JSON.parse(record.details) as Partial<ContactLeadData>;
    if (typeof lead.name !== "string" || typeof lead.email !== "string" || !Array.isArray(lead.services)) {
      throw new Error("ContactLeadInvalid");
    }
    return lead as ContactLeadData;
  }

  async loadReport(reportFileId: number): Promise<GeneratedContactPrereport | null> {
    const [file] = await db.select({
      content: projectFilesTable.content,
      metadata: projectFilesTable.metadata,
    })
      .from(projectFilesTable).where(eq(projectFilesTable.id, reportFileId)).limit(1);
    if (!file?.content) return null;

    let metadata: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(file.metadata || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      // Older or malformed metadata must not prevent delivery of a saved report.
    }

    return {
      html: file.content,
      engineAttribution: parseContactPrereportEngineAttribution(metadata.engineAttribution),
    };
  }

  async saveReport(
    job: ClaimedContactPrereportJob,
    lead: ContactLeadData,
    report: GeneratedContactPrereport,
  ): Promise<number | null> {
    return db.transaction(async tx => {
      const [current] = await tx.select({
        submissionId: contactPrereportJobsTable.submissionId,
      }).from(contactPrereportJobsTable).where(and(
        eq(contactPrereportJobsTable.submissionId, job.submissionId),
        eq(contactPrereportJobsTable.leaseToken, job.leaseToken),
        eq(contactPrereportJobsTable.status, "processing"),
        eq(contactPrereportJobsTable.reportStatus, "generating"),
      )).for("update").limit(1);
      if (!current) return null;

      const content = Buffer.from(report.html, "utf-8");
      const now = new Date();
      const date = now.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
      const time = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      const [saved] = await tx.insert(projectFilesTable).values({
        projectId: null,
        fileType: "report",
        category: "lead_prereport",
        title: `Pre-Informe AI — ${lead.name} — ${lead.niche || "eCommerce"}`,
        description: `Pre-informe generado automáticamente el ${date} a las ${time} para el lead ${lead.name} (${lead.email})`,
        objectPath: null,
        originalUrl: null,
        mimeType: "text/html",
        fileSizeBytes: content.length,
        productId: null,
        productTitle: null,
        generatedBy: "lead_contact_form",
        metadata: JSON.stringify({
          submissionId: job.submissionId,
          generatedAt: now.toISOString(),
          leadEmail: lead.email,
          leadName: lead.name,
          leadNiche: lead.niche,
          leadRevenue: lead.revenue,
          leadStoreUrl: lead.storeUrl,
          leadPhone: lead.phone,
          leadServices: lead.services,
          engineAttribution: report.engineAttribution,
        }),
        content: report.html,
        isPublic: 0,
        entityName: lead.name,
        entityUrl: lead.storeUrl || lead.email,
      }).returning({ id: projectFilesTable.id });

      const updated = await tx.update(contactPrereportJobsTable).set({
        reportStatus: "completed",
        reportFileId: saved.id,
        lastErrorCode: null,
        updatedAt: now,
      }).where(and(
        eq(contactPrereportJobsTable.submissionId, job.submissionId),
        eq(contactPrereportJobsTable.leaseToken, job.leaseToken),
      )).returning({ submissionId: contactPrereportJobsTable.submissionId });

      return updated.length ? saved.id : null;
    });
  }

  async beginDeliveryAttempt(job: ClaimedContactPrereportJob, channel: ContactDeliveryChannel): Promise<boolean> {
    const column = channel === "email"
      ? contactPrereportJobsTable.emailStatus
      : contactPrereportJobsTable.klaviyoStatus;
    const updated = await db.update(contactPrereportJobsTable).set({
      [channel === "email" ? "emailStatus" : "klaviyoStatus"]: "attempting",
      updatedAt: new Date(),
    }).where(and(
      eq(contactPrereportJobsTable.submissionId, job.submissionId),
      eq(contactPrereportJobsTable.leaseToken, job.leaseToken),
      eq(contactPrereportJobsTable.status, "processing"),
      eq(column, "pending"),
    )).returning({ submissionId: contactPrereportJobsTable.submissionId });
    return updated.length > 0;
  }

  async finishDeliveryAttempt(
    job: ClaimedContactPrereportJob,
    channel: ContactDeliveryChannel,
    outcome: ContactDeliveryOutcome,
  ): Promise<boolean> {
    const updated = await db.update(contactPrereportJobsTable).set({
      [channel === "email" ? "emailStatus" : "klaviyoStatus"]: outcome,
      updatedAt: new Date(),
    }).where(and(
      eq(contactPrereportJobsTable.submissionId, job.submissionId),
      eq(contactPrereportJobsTable.leaseToken, job.leaseToken),
      eq(contactPrereportJobsTable.status, "processing"),
      eq(channel === "email" ? contactPrereportJobsTable.emailStatus : contactPrereportJobsTable.klaviyoStatus, "attempting"),
    )).returning({ submissionId: contactPrereportJobsTable.submissionId });
    return updated.length > 0;
  }

  async failReport(job: ClaimedContactPrereportJob, errorCode: string): Promise<"retry" | "failed" | "lease_lost"> {
    const terminal = job.reportAttempts >= MAX_REPORT_ATTEMPTS;
    const delaySeconds = REPORT_RETRY_SECONDS[Math.min(job.reportAttempts - 1, REPORT_RETRY_SECONDS.length - 1)] ?? 300;
    const updated = await pool.query(`
      UPDATE contact_prereport_jobs
      SET report_status = $3,
          email_status = CASE WHEN email_status = 'attempting' THEN 'unknown' ELSE email_status END,
          klaviyo_status = CASE WHEN klaviyo_status = 'attempting' THEN 'unknown' ELSE klaviyo_status END,
          status = CASE
            WHEN $4 = 'pending' THEN 'pending'
            WHEN email_status = 'attempting' OR klaviyo_status = 'attempting' THEN 'needs_review'
            ELSE 'failed'
          END,
          last_error_code = $5,
          next_attempt_at = NOW() + ($6 * INTERVAL '1 second'),
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE submission_id = $1
        AND lease_token = $2
        AND status = 'processing'
        AND report_status = 'generating'
      RETURNING submission_id
    `, [
      job.submissionId,
      job.leaseToken,
      terminal ? "failed" : "pending",
      terminal ? "failed" : "pending",
      errorCode,
      delaySeconds,
    ]);
    if (updated.rowCount !== 1) return "lease_lost";
    return terminal ? "failed" : "retry";
  }

  async failJob(job: ClaimedContactPrereportJob, errorCode: string): Promise<boolean> {
    const updated = await db.update(contactPrereportJobsTable).set({
      status: "needs_review",
      lastErrorCode: errorCode,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(contactPrereportJobsTable.submissionId, job.submissionId),
      eq(contactPrereportJobsTable.leaseToken, job.leaseToken),
      eq(contactPrereportJobsTable.status, "processing"),
    )).returning({ submissionId: contactPrereportJobsTable.submissionId });
    return updated.length > 0;
  }

  async finish(
    job: ClaimedContactPrereportJob,
    engineAttribution: ContactPrereportEngineAttribution,
  ): Promise<"completed" | "needs_review" | "lease_lost"> {
    return db.transaction(async tx => {
      const [current] = await tx.select({
        submissionId: contactPrereportJobsTable.submissionId,
        reportStatus: contactPrereportJobsTable.reportStatus,
        emailStatus: contactPrereportJobsTable.emailStatus,
        klaviyoStatus: contactPrereportJobsTable.klaviyoStatus,
        reportFileId: contactPrereportJobsTable.reportFileId,
      }).from(contactPrereportJobsTable).where(and(
        eq(contactPrereportJobsTable.submissionId, job.submissionId),
        eq(contactPrereportJobsTable.leaseToken, job.leaseToken),
        eq(contactPrereportJobsTable.status, "processing"),
      )).for("update").limit(1);
      if (!current) return "lease_lost";

      const needsReview = [current.emailStatus, current.klaviyoStatus].some(
        state => state === "attempting" || state === "unknown" || state === "failed",
      );
      const status = needsReview ? "needs_review" : "completed";
      await tx.insert(auditLogTable).values({
        id: `lead_prereport_${job.submissionId}`,
        userId: "system",
        action: "lead_prereport_generated",
        details: JSON.stringify({
          emailSent: current.emailStatus === "sent",
          aiEngine: engineAttribution.summary.overall,
          engineAttribution,
          savedFileId: current.reportFileId,
          generatedAt: new Date().toISOString(),
        }),
        ipAddress: "system",
      }).onConflictDoNothing();

      await tx.update(contactPrereportJobsTable).set({
        status,
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: needsReview ? "DeliveryNeedsReview" : null,
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(contactPrereportJobsTable.submissionId, job.submissionId));
      return status;
    });
  }
}
