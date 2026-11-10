import { eq } from "drizzle-orm";
import { db, auditLogTable, contactPrereportJobsTable } from "@workspace/db";
import {
  claimContactSubmission,
  type ContactLeadData,
  type ContactSubmissionClaim,
  type ContactSubmissionRecord,
} from "./contact-idempotency.js";
import { createContactRateLimiter } from "./contact-rate-limit.js";
import { PgRateLimitStore } from "./pg-rate-limit-store.js";

// Un solo límite por IP para el formulario y para los leads que abre ShopyBrain
// desde la landing: el mismo almacén "contact".
const checkContactRateLimit = createContactRateLimiter(new PgRateLimitStore("contact"));

/**
 * Registra un lead público: fila en audit_log + trabajo del Pre-Informe en la
 * misma transacción (el worker de contact.ts lo recoge). Idempotente por clave
 * y limitado por IP. Lo usan POST /contact y la acción `create_lead` del cerebro.
 */
export async function acceptContactLead(
  leadData: ContactLeadData,
  opts: { idempotencyKey: string; ip: string },
): Promise<ContactSubmissionClaim> {
  return claimContactSubmission(
    opts.idempotencyKey,
    leadData,
    {
      find: async id => {
        const [existing] = await db.select({
          action: auditLogTable.action,
          details: auditLogTable.details,
        }).from(auditLogTable).where(eq(auditLogTable.id, id)).limit(1);
        return existing as ContactSubmissionRecord | undefined;
      },
      insert: async record => {
        return db.transaction(async tx => {
          const [inserted] = await tx.insert(auditLogTable).values({
            id: record.id,
            userId: "public",
            action: record.action,
            details: record.details,
            ipAddress: opts.ip,
          }).onConflictDoNothing().returning({ id: auditLogTable.id });
          if (!inserted) return false;
          await tx.insert(contactPrereportJobsTable).values({ submissionId: record.id });
          return true;
        });
      },
    },
    () => checkContactRateLimit(opts.ip),
  );
}
