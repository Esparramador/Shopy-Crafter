import { createHash } from "node:crypto";

export const CONTACT_SUBMISSION_ACTION = "lead_form_submitted";
export const IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED";

export interface ContactSubmissionRecord {
  action: string;
  details: string | null;
}

export interface ContactLeadData {
  name: string;
  email: string;
  phone: string | null;
  storeUrl: string | null;
  niche: string | null;
  revenue: string | null;
  services: string[];
  socialMedia: string | null;
  message: string | null;
  extraInfo: string | null;
  productImageUrl: string | null;
  suppliers: string | null;
  submittedAt: string;
  company?: string;
}

export interface ContactSubmissionStore {
  find(id: string): Promise<ContactSubmissionRecord | undefined>;
  insert(record: { id: string; action: string; details: string }): Promise<boolean>;
}

export type ContactSubmissionClaim = "accepted" | "duplicate" | "key_reused" | "rate_limited";

export function isValidContactIdempotencyKey(key: string): boolean {
  return key.length >= 16 && key.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(key);
}

export function getContactSubmissionId(key: string): string {
  return `lead_form_${createHash("sha256").update(key).digest("hex")}`;
}

/** submittedAt is generated anew on every HTTP attempt and isn't part of the request identity. */
export function hashContactSubmission(data: object): string {
  const { submittedAt: _submittedAt, ...stableData } = data as Record<string, unknown>;
  return createHash("sha256").update(JSON.stringify(stableData)).digest("hex");
}

function isSameRequest(record: ContactSubmissionRecord, requestHash: string): boolean {
  if (record.action !== CONTACT_SUBMISSION_ACTION || !record.details) return false;
  try {
    const saved = JSON.parse(record.details) as Record<string, unknown>;
    return hashContactSubmission(saved) === requestHash;
  } catch {
    return false;
  }
}

/**
 * Claims a contact request using the audit row's unique primary key. The
 * database insert is atomic across processes; an existing matching row is a
 * duplicate, and a reused key with different input must be retried with a new
 * key instead of silently dropping that distinct lead.
 */
export async function claimContactSubmission(
  key: string,
  data: object,
  store: ContactSubmissionStore,
  allowNewRequest?: () => boolean,
): Promise<ContactSubmissionClaim> {
  const id = getContactSubmissionId(key);
  const requestHash = hashContactSubmission(data);
  const existing = await store.find(id);
  if (existing) return isSameRequest(existing, requestHash) ? "duplicate" : "key_reused";
  if (allowNewRequest && !allowNewRequest()) return "rate_limited";

  const inserted = await store.insert({
    id,
    action: CONTACT_SUBMISSION_ACTION,
    details: JSON.stringify(data),
  });
  if (inserted) return "accepted";

  // A concurrent request may have inserted the same key after our first read.
  const concurrent = await store.find(id);
  if (!concurrent) throw new Error("Could not verify the contact request idempotency record");
  return isSameRequest(concurrent, requestHash) ? "duplicate" : "key_reused";
}
