import { describe, expect, it, vi } from "vitest";
import type { ContactLeadData } from "./contact-idempotency.js";
import {
  processNextContactPrereportJob,
  type ClaimedContactPrereportJob,
  type ContactDeliveryChannel,
  type ContactDeliveryOutcome,
  type ContactPrereportStore,
  type ContactPrereportServices,
} from "./contact-prereport-worker.js";

const lead: ContactLeadData = {
  name: "Test Lead",
  email: "test@example.invalid",
  phone: null,
  storeUrl: null,
  niche: "retail",
  revenue: null,
  services: [],
  socialMedia: null,
  message: null,
  extraInfo: null,
  productImageUrl: null,
  suppliers: null,
  submittedAt: "2026-11-05T00:00:00.000Z",
};

type DeliveryStatus = "pending" | "attempting" | ContactDeliveryOutcome;

class FakeContactPrereportStore implements ContactPrereportStore {
  status: "pending" | "processing" | "completed" | "needs_review" | "failed" = "pending";
  reportStatus: ClaimedContactPrereportJob["reportStatus"] = "pending";
  emailStatus: DeliveryStatus = "pending";
  klaviyoStatus: DeliveryStatus = "pending";
  reportAttempts = 0;
  reportFileId: number | null = null;
  reportFiles = new Map<number, string>();
  leaseToken = "";
  claimCount = 0;
  simulateLostSaveAcknowledgement = false;
  leaseExpired = false;

  async claimNext(): Promise<ClaimedContactPrereportJob | null> {
    if (this.status === "processing" && this.leaseExpired) {
      if (this.reportStatus === "generating") this.reportStatus = "pending";
      if (this.emailStatus === "attempting") this.emailStatus = "unknown";
      if (this.klaviyoStatus === "attempting") this.klaviyoStatus = "unknown";
      this.status = "pending";
      this.leaseExpired = false;
    }
    if (this.status !== "pending") return null;
    if (![this.reportStatus, this.emailStatus, this.klaviyoStatus].includes("pending")) return null;

    this.status = "processing";
    this.claimCount++;
    this.leaseToken = `lease-${this.claimCount}`;
    if (this.reportStatus === "pending") {
      this.reportStatus = "generating";
      this.reportAttempts++;
    }
    return this.job();
  }

  async renewLease(job: ClaimedContactPrereportJob): Promise<boolean> {
    return this.isCurrent(job);
  }

  async loadLead(): Promise<ContactLeadData> {
    return lead;
  }

  async loadReport(reportFileId: number): Promise<string | null> {
    return this.reportFiles.get(reportFileId) ?? null;
  }

  async saveReport(
    job: ClaimedContactPrereportJob,
    _lead: ContactLeadData,
    html: string,
  ): Promise<number | null> {
    if (!this.isCurrent(job)) return null;
    this.reportStatus = "completed";
    this.reportFileId ??= 1;
    this.reportFiles.set(this.reportFileId, html);
    if (this.simulateLostSaveAcknowledgement) {
      this.simulateLostSaveAcknowledgement = false;
      throw new Error("Simulated database acknowledgement loss");
    }
    return this.reportFileId;
  }

  async beginDeliveryAttempt(job: ClaimedContactPrereportJob, channel: ContactDeliveryChannel): Promise<boolean> {
    if (!this.isCurrent(job)) return false;
    if (channel === "email") {
      if (this.emailStatus !== "pending") return false;
      this.emailStatus = "attempting";
    } else {
      if (this.klaviyoStatus !== "pending") return false;
      this.klaviyoStatus = "attempting";
    }
    return true;
  }

  async finishDeliveryAttempt(
    job: ClaimedContactPrereportJob,
    channel: ContactDeliveryChannel,
    outcome: ContactDeliveryOutcome,
  ): Promise<boolean> {
    if (!this.isCurrent(job)) return false;
    if (channel === "email") this.emailStatus = outcome;
    else this.klaviyoStatus = outcome;
    return true;
  }

  async failReport(job: ClaimedContactPrereportJob): Promise<"retry" | "failed" | "lease_lost"> {
    if (!this.isCurrent(job) || this.reportStatus !== "generating") return "lease_lost";
    this.reportStatus = this.reportAttempts < 3 ? "pending" : "failed";
    if (this.emailStatus === "attempting") this.emailStatus = "unknown";
    if (this.klaviyoStatus === "attempting") this.klaviyoStatus = "unknown";
    this.status = this.reportStatus === "pending"
      ? "pending"
      : [this.emailStatus, this.klaviyoStatus].some(state => state === "unknown" || state === "failed")
        ? "needs_review"
        : "failed";
    return this.status === "pending" ? "retry" : "failed";
  }

  async failJob(job: ClaimedContactPrereportJob): Promise<boolean> {
    if (!this.isCurrent(job)) return false;
    this.status = "needs_review";
    return true;
  }

  async finish(job: ClaimedContactPrereportJob): Promise<"completed" | "needs_review" | "lease_lost"> {
    if (!this.isCurrent(job)) return "lease_lost";
    this.status = [this.emailStatus, this.klaviyoStatus].some(
      state => state === "attempting" || state === "unknown" || state === "failed",
    ) ? "needs_review" : "completed";
    return this.status;
  }

  private job(): ClaimedContactPrereportJob {
    return {
      submissionId: "lead_form_fake_submission",
      leaseToken: this.leaseToken,
      reportStatus: this.reportStatus,
      emailStatus: this.emailStatus,
      klaviyoStatus: this.klaviyoStatus,
      reportAttempts: this.reportAttempts,
      reportFileId: this.reportFileId,
    };
  }

  private isCurrent(job: ClaimedContactPrereportJob): boolean {
    return this.status === "processing" && job.leaseToken === this.leaseToken;
  }
}

function createServices() {
  return {
    generateReport: vi.fn(async () => "<html>one report</html>"),
    sendEmail: vi.fn(async () => "sent" as const),
    sendKlaviyo: vi.fn(async () => "sent" as const),
  } satisfies ContactPrereportServices;
}

describe("contact pre-report recovery worker", () => {
  it("reuses the saved report after a lost database acknowledgement", async () => {
    const store = new FakeContactPrereportStore();
    store.simulateLostSaveAcknowledgement = true;
    const services = createServices();

    await expect(processNextContactPrereportJob(store, services)).resolves.toBe("lease_lost");
    store.leaseExpired = true;
    await expect(processNextContactPrereportJob(store, services)).resolves.toBe("processed");

    expect(services.generateReport).toHaveBeenCalledTimes(1);
    expect(services.sendEmail).toHaveBeenCalledTimes(1);
    expect(services.sendKlaviyo).toHaveBeenCalledTimes(1);
    expect(store.reportFiles.size).toBe(1);
    expect(store.status).toBe("completed");
  });

  it("never automatically retries an email with an uncertain outcome", async () => {
    const store = new FakeContactPrereportStore();
    store.reportStatus = "completed";
    store.reportFileId = 7;
    store.reportFiles.set(7, "<html>saved report</html>");
    store.klaviyoStatus = "sent";
    const services = createServices();
    services.sendEmail.mockRejectedValueOnce(new Error("Simulated interrupted send"));

    await expect(processNextContactPrereportJob(store, services)).resolves.toBe("processed");
    await expect(processNextContactPrereportJob(store, services)).resolves.toBe("idle");

    expect(services.generateReport).not.toHaveBeenCalled();
    expect(services.sendEmail).toHaveBeenCalledTimes(1);
    expect(store.emailStatus).toBe("unknown");
    expect(store.status).toBe("needs_review");
  });

  it("does not resend a Klaviyo event after an uncertain outcome", async () => {
    const store = new FakeContactPrereportStore();
    const services = createServices();
    services.sendKlaviyo.mockRejectedValueOnce(new Error("Simulated interrupted event"));

    await expect(processNextContactPrereportJob(store, services)).resolves.toBe("processed");
    await expect(processNextContactPrereportJob(store, services)).resolves.toBe("idle");

    expect(services.sendKlaviyo).toHaveBeenCalledTimes(1);
    expect(services.generateReport).toHaveBeenCalledTimes(1);
    expect(services.sendEmail).toHaveBeenCalledTimes(1);
    expect(store.klaviyoStatus).toBe("unknown");
    expect(store.status).toBe("needs_review");
  });

  it("allows only one concurrent worker to claim a pending report", async () => {
    const store = new FakeContactPrereportStore();
    const services = createServices();

    const results = await Promise.all([
      processNextContactPrereportJob(store, services),
      processNextContactPrereportJob(store, services),
    ]);

    expect(results.sort()).toEqual(["idle", "processed"]);
    expect(store.claimCount).toBe(1);
    expect(services.generateReport).toHaveBeenCalledTimes(1);
    expect(store.reportFiles.size).toBe(1);
  });
});
