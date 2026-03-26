import { randomBytes } from "crypto";
import { db, auditLogTable } from "@workspace/db";
import { logger } from "./logger.js";

export async function recordAudit(params: {
  userId: string;
  action: string;
  details?: string;
  projectId?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      id: randomBytes(16).toString("hex"),
      userId: params.userId,
      action: params.action,
      details: params.details ?? null,
      projectId: params.projectId ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    logger.error({ err, action: params.action }, "Failed to write audit log");
  }
}
