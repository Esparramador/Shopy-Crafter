import type { ContactLeadData } from "./contact-idempotency.js";
import { logger } from "./logger.js";

export type ContactDeliveryChannel = "email" | "klaviyo";
export type ContactDeliveryOutcome = "sent" | "skipped" | "unknown" | "failed";

export interface ClaimedContactPrereportJob {
  submissionId: string;
  leaseToken: string;
  reportStatus: "pending" | "generating" | "completed" | "failed";
  emailStatus: "pending" | "attempting" | "sent" | "skipped" | "unknown" | "failed";
  klaviyoStatus: "pending" | "attempting" | "sent" | "skipped" | "unknown" | "failed";
  reportAttempts: number;
  reportFileId: number | null;
}

export interface ContactPrereportStore {
  claimNext(): Promise<ClaimedContactPrereportJob | null>;
  renewLease(job: ClaimedContactPrereportJob): Promise<boolean>;
  loadLead(submissionId: string): Promise<ContactLeadData>;
  loadReport(reportFileId: number): Promise<string | null>;
  saveReport(job: ClaimedContactPrereportJob, lead: ContactLeadData, html: string): Promise<number | null>;
  beginDeliveryAttempt(job: ClaimedContactPrereportJob, channel: ContactDeliveryChannel): Promise<boolean>;
  finishDeliveryAttempt(
    job: ClaimedContactPrereportJob,
    channel: ContactDeliveryChannel,
    outcome: ContactDeliveryOutcome,
  ): Promise<boolean>;
  failReport(job: ClaimedContactPrereportJob, errorCode: string): Promise<"retry" | "failed" | "lease_lost">;
  failJob(job: ClaimedContactPrereportJob, errorCode: string): Promise<boolean>;
  finish(job: ClaimedContactPrereportJob): Promise<"completed" | "needs_review" | "lease_lost">;
}

export interface ContactPrereportServices {
  generateReport(lead: ContactLeadData, submissionId: string): Promise<string>;
  sendEmail(lead: ContactLeadData, reportHtml: string): Promise<"sent" | "skipped" | "failed">;
  sendKlaviyo(lead: ContactLeadData): Promise<"sent" | "skipped" | "failed">;
}

export interface ContactPrereportWorkerOptions {
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
}

function safeErrorCode(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  return /^[A-Za-z][A-Za-z0-9]{0,59}$/.test(name) ? name : "UnknownError";
}

async function deliverOnce(
  store: ContactPrereportStore,
  job: ClaimedContactPrereportJob,
  channel: ContactDeliveryChannel,
  send: () => Promise<"sent" | "skipped" | "failed">,
): Promise<boolean> {
  const state = channel === "email" ? job.emailStatus : job.klaviyoStatus;
  if (state !== "pending") return true;
  if (!(await store.beginDeliveryAttempt(job, channel))) return false;

  let outcome: ContactDeliveryOutcome;
  try {
    outcome = await send();
  } catch {
    outcome = "unknown";
  }
  const saved = await store.finishDeliveryAttempt(job, channel, outcome);
  if (saved) {
    if (channel === "email") job.emailStatus = outcome;
    else job.klaviyoStatus = outcome;
  }
  return saved;
}

export async function processNextContactPrereportJob(
  store: ContactPrereportStore,
  services: ContactPrereportServices,
  options: Pick<ContactPrereportWorkerOptions, "heartbeatIntervalMs"> = {},
): Promise<"idle" | "processed" | "lease_lost"> {
  const job = await store.claimNext();
  if (!job) return "idle";

  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 20_000;
  let leaseLost = false;
  let heartbeatRunning = false;
  const heartbeat = setInterval(() => {
    if (heartbeatRunning || leaseLost) return;
    heartbeatRunning = true;
    void store.renewLease(job)
      .then(renewed => { if (!renewed) leaseLost = true; })
      .catch(() => { leaseLost = true; })
      .finally(() => { heartbeatRunning = false; });
  }, heartbeatIntervalMs);
  heartbeat.unref();

  try {
    const lead = await store.loadLead(job.submissionId);
    let reportHtml: string | null = null;

    // Keep the current fast marketing notification independent of slow report generation.
    const klaviyoSaved = await deliverOnce(store, job, "klaviyo", () => services.sendKlaviyo(lead));
    if (!klaviyoSaved) return "lease_lost";
    if (leaseLost) return "lease_lost";

    if (job.reportStatus === "generating" || job.reportStatus === "pending") {
      try {
        reportHtml = await services.generateReport(lead, job.submissionId);
        if (leaseLost) return "lease_lost";
        const reportFileId = await store.saveReport(job, lead, reportHtml);
        if (reportFileId === null) {
          leaseLost = true;
          return "lease_lost";
        }
        job.reportStatus = "completed";
        job.reportFileId = reportFileId;
      } catch (error) {
        const errorCode = safeErrorCode(error);
        const result = await store.failReport(job, errorCode).catch(() => "lease_lost" as const);
        logger.error(
          { submissionId: job.submissionId, errorCode, retrying: result === "retry" },
          "Contact pre-report generation failed",
        );
        return result === "lease_lost" ? "lease_lost" : "processed";
      }
    }

    if (leaseLost) return "lease_lost";
    if (!reportHtml && job.reportFileId !== null) reportHtml = await store.loadReport(job.reportFileId);
    if (!reportHtml) {
      const saved = await store.failJob(job, "ReportUnavailable");
      if (!saved) return "lease_lost";
      logger.error({ submissionId: job.submissionId }, "Contact pre-report file is unavailable");
      return "processed";
    }

    const emailSaved = await deliverOnce(store, job, "email", () => services.sendEmail(lead, reportHtml!));
    if (!emailSaved) return "lease_lost";
    if (leaseLost) return "lease_lost";

    const finalStatus = await store.finish(job);
    if (finalStatus === "lease_lost") return "lease_lost";
    if (finalStatus === "needs_review") {
      logger.warn({ submissionId: job.submissionId }, "Contact pre-report delivery needs manual review");
    } else {
      logger.info({ submissionId: job.submissionId }, "Contact pre-report job completed");
    }
    return "processed";
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (job.reportStatus === "generating" || job.reportStatus === "pending") {
      const result = await store.failReport(job, errorCode).catch(() => "lease_lost" as const);
      logger.error({ submissionId: job.submissionId, errorCode, retrying: result === "retry" }, "Contact pre-report job failed");
      return result === "lease_lost" ? "lease_lost" : "processed";
    }
    const saved = await store.failJob(job, errorCode).catch(() => false);
    logger.error({ submissionId: job.submissionId, errorCode, stateSaved: saved }, "Contact pre-report job failed");
    return saved ? "processed" : "lease_lost";
  } finally {
    clearInterval(heartbeat);
  }
}

export function startContactPrereportWorker(
  store: ContactPrereportStore,
  services: ContactPrereportServices,
  options: ContactPrereportWorkerOptions = {},
): () => void {
  const pollIntervalMs = options.pollIntervalMs ?? 3_000;
  let running = false;
  let stopped = false;
  let lastPollErrorAt = 0;

  const poll = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await processNextContactPrereportJob(store, services, options);
    } catch (error) {
      if (Date.now() - lastPollErrorAt > 60_000) {
        lastPollErrorAt = Date.now();
        logger.error({ errorCode: safeErrorCode(error) }, "Contact pre-report queue poll failed");
      }
    } finally {
      running = false;
    }
  };

  void poll();
  const timer = setInterval(() => { void poll(); }, pollIntervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
