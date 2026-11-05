import { describe, expect, it } from "vitest";
import {
  claimContactSubmission,
  CONTACT_SUBMISSION_ACTION,
  getContactSubmissionId,
  hashContactSubmission,
  isValidContactIdempotencyKey,
  type ContactSubmissionRecord,
  type ContactSubmissionStore,
} from "./contact-idempotency.js";

function createStore() {
  const rows = new Map<string, ContactSubmissionRecord>();
  const store: ContactSubmissionStore = {
    find: async id => rows.get(id),
    insert: async record => {
      if (rows.has(record.id)) return false;
      rows.set(record.id, { action: record.action, details: record.details });
      return true;
    },
  };
  return { store, rows };
}

const lead = {
  name: "Cliente de prueba",
  email: "test@example.invalid",
  services: ["Auditoría"],
  submittedAt: "2026-11-05T12:00:00.000Z",
};

describe("idempotencia del formulario de contacto", () => {
  it("valida claves acotadas y seguras para usar en el almacenamiento", () => {
    expect(isValidContactIdempotencyKey("b8aa0d62-7e70-4c55-b50e-d437f84be375")).toBe(true);
    expect(isValidContactIdempotencyKey("too-short")).toBe(false);
    expect(isValidContactIdempotencyKey(`${"a".repeat(129)}`)).toBe(false);
    expect(isValidContactIdempotencyKey("a".repeat(20) + "; DROP TABLE audit_log")).toBe(false);
  });

  it("stores only a deterministic hash of the request key", () => {
    expect(getContactSubmissionId("same-key-for-retry-0001")).toBe(getContactSubmissionId("same-key-for-retry-0001"));
    expect(getContactSubmissionId("same-key-for-retry-0001")).not.toBe(getContactSubmissionId("different-key-00002"));
    expect(getContactSubmissionId("same-key-for-retry-0001")).not.toContain("same-key");
  });

  it("replays a lost-response request as a duplicate without creating another lead or job", async () => {
    const { store, rows } = createStore();
    let leads = 0;
    let followUpJobs = 0;
    const submit = async () => {
      const claim = await claimContactSubmission("same-key-for-retry-0001", lead, store);
      if (claim === "accepted") {
        leads++;
        followUpJobs++;
      }
      return { success: claim !== "key_reused" };
    };

    // The first response is lost after the database claim and work were created.
    await submit();
    const replayedResponse = await submit();

    expect(replayedResponse).toEqual({ success: true });
    expect(rows.size).toBe(1);
    expect(leads).toBe(1);
    expect(followUpJobs).toBe(1);
    expect([...rows.values()][0].action).toBe(CONTACT_SUBMISSION_ACTION);
  });

  it("allows one winner when two copies of the same request arrive concurrently", async () => {
    const { store, rows } = createStore();
    const claims = await Promise.all([
      claimContactSubmission("concurrent-key-00000001", lead, store),
      claimContactSubmission("concurrent-key-00000001", lead, store),
    ]);
    expect(claims.sort()).toEqual(["accepted", "duplicate"]);
    expect(rows.size).toBe(1);
  });

  it("does not silently treat changed form data as the old submission", async () => {
    const { store } = createStore();
    await claimContactSubmission("same-key-for-retry-0001", lead, store);
    const changed = await claimContactSubmission(
      "same-key-for-retry-0001",
      { ...lead, email: "new@example.invalid" },
      store,
    );
    expect(changed).toBe("key_reused");
  });

  it("does not charge a duplicate retry against the new-submission rate limit", async () => {
    const { store } = createStore();
    let rateLimitChecks = 0;
    const allowNew = () => { rateLimitChecks++; return true; };
    await claimContactSubmission("same-key-for-retry-0001", lead, store, allowNew);
    expect(await claimContactSubmission("same-key-for-retry-0001", lead, store, () => false)).toBe("duplicate");
    expect(rateLimitChecks).toBe(1);
  });

  it("ignores the per-attempt timestamp when matching retries", () => {
    expect(hashContactSubmission(lead)).toBe(
      hashContactSubmission({ ...lead, submittedAt: "2026-11-05T12:30:00.000Z" }),
    );
  });
});
