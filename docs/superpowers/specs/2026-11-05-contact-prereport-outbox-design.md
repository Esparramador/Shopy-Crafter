# Durable recovery for contact pre-reports

## Goal

Ensure every newly accepted contact submission has one durable pre-report job, and that the job can be resumed after an API restart without creating duplicate report files, emails, or marketing events.

## Current behavior

The public contact route stores a lead in `audit_log`, returns success, then starts the AI report, vault save, admin email, and Klaviyo event in an untracked async function. The idempotency key prevents a retry from creating another lead or starting another copy of that function, but a process exit between the lead insert and the function completing can leave the follow-up unfinished.

The project has persistent tables for image-generation and bulk jobs, but neither models this contact-report workflow.

## Chosen approach

Use a PostgreSQL outbox row, written in the same transaction as the lead. Keep the queue in the existing database; do not introduce a hosted queue service or create tables at API startup.

### Storage and atomic acceptance

- Add a Drizzle `contact_prereport_jobs` table keyed uniquely by the deterministic contact-submission ID.
- Store job state, current stage, attempt count, retry timing, lease expiry, report-file reference, delivery-stage state, and the last safe error summary.
- Change the contact-claim storage adapter so one database transaction inserts both the lead and its pending job. A submission is not acknowledged as accepted if either insert fails.
- Keep the existing idempotency behavior: a same-key/same-payload retry returns the original success and does not create another job.
- Do not backfill older `lead_form_submitted` audit rows automatically. Before the outbox existed, a report, email, or marketing event may already have been sent even if the process stopped before writing its completion audit row.

### Worker and recovery

- A background worker polls pending jobs and claims them with a lease using PostgreSQL row locking, so multiple API instances cannot work on the same stage concurrently.
- Renew leases during long report-generation work and use a fencing token for every state change. A worker whose lease expired cannot save results after another worker has reclaimed the job.
- Expired leases for internal report-generation work can be reclaimed after a restart.
- Generate the AI report outside the claim transaction. Save the report file and mark that stage complete in one transaction, conditioned on the current fencing token, so retries cannot leave duplicate vault files.
- Persist stage transitions before moving to the next side effect. Resume only incomplete, safely repeatable work after restart.
- Expose the worker as a small service module with injectable storage and report/email/marketing adapters so tests can simulate crashes without calling AI, Gmail, Klaviyo, or any store API.

### External delivery guarantees

Gmail and the current Klaviyo event request do not provide a verified idempotency guarantee in this project. Before either request, persist an `attempting` state. If the process restarts with that state, do not automatically send again; mark the job for manual review. This prevents duplicate delivery when the external service accepted a request but the API died before saving its response. It also means that an ambiguous attempt may need a human to decide whether to resend.

If report generation succeeds remotely but the process exits before saving its result, the AI call may be repeated after the lease expires. Database persistence still permits only one saved report file per job; the repeated provider call may incur additional AI cost.

## Schema rollout

- Add the table to the Drizzle schema and normal schema-push flow.
- Apply and verify the change in development only.
- Do not add startup-time DDL, deployment-time schema mutations, or direct production DDL. Production receives the schema through Replit's normal Publish schema flow.

## Verification

- Unit-test atomic lead-plus-job creation, duplicate submission, concurrent worker claims, expired-lease recovery, and one saved report per job with an isolated store.
- Simulate a restart after each persisted stage and assert that safe unfinished work resumes once.
- Simulate an ambiguous email or Klaviyo attempt and assert that recovery marks it for review without making a second external call.
- Keep all AI, email, marketing, and store adapters mocked in the test suite.

## Out of scope

- An admin interface for reviewing or manually resending ambiguous email/marketing attempts.
- Retrofitting historical leads whose delivery state cannot be proven.
- Changing the public contact form, its validation, rate limit, or idempotency-key format.
- Publishing the app or applying any schema change to production.

## Relevant files

- `artifacts/api-server/src/routes/contact.ts`
- `artifacts/api-server/src/lib/contact-idempotency.ts`
- `artifacts/api-server/src/index.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/schema/contact_prereport_jobs.ts` (new)
