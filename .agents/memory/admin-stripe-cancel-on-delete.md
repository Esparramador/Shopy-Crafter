---
name: Stripe resource_missing is not proof of "gone"
description: Why billing guards must fail closed on Stripe resource_missing, and how to E2E Stripe-touching admin flows without a test-mode key.
---

**Rule:** never treat a Stripe `resource_missing` as evidence that a subscription no longer bills. Verify with `retrieve` and only clear a local billing guard when Stripe authoritatively reports a non-billing status (or a `cancel` call succeeds). On `resource_missing`, fail closed and point the admin at the dashboard.

**Why:** Stripe returns the same `resource_missing` when the configured key belongs to another mode (test vs live) or another account. Failing open would delete the user and the local record while the real subscription keeps charging — the exact outcome the guard exists to prevent. A first implementation did exactly this and was rejected in review.

**How to apply:** any admin action that reconciles local billing state with Stripe should retrieve → decide → mutate, and return a distinct error for "not visible with this key". This workspace's Stripe key is not test-mode, so E2E must not create/cancel real subscriptions: seed a local row with an id Stripe cannot know and assert the fail-closed path; cover the confirmed-cancel path with unit tests via an injected Stripe client. Omit `apiVersion` when constructing the Stripe SDK — a pinned old version string fails typecheck against the installed SDK's literal type.

**Period-end variant:** the same guard applies to "cancel at period end + revoke": only mark `cancel_at_period_end=1` and set `is_active=0` after Stripe's `update()` returns `cancel_at_period_end=true` (or `retrieve` already shows it). With the installed Stripe SDK (API 2025-03+), `current_period_end` lives on `items.data[].current_period_end`, not on the subscription; when a cancellation is scheduled, `cancel_at` is the effective end date. The local row intentionally keeps blocking deletion until Stripe reports `canceled` — the admin's later "cancel now and delete" click syncs it via `retrieve` and then deletes.

**Revocation must void pending invites:** setting `is_active=0` is not enough to revoke a client — the invite-setup endpoint re-activates the user and logs them in when it consumes a still-valid invite token. Any "revoke access" path must also null `invite_token`/`invite_expires` (a review rejected the period-end flow for exactly this gap).

**"Already canceled" on mutate (race with the dashboard):** when `cancel()`/`update()` throws with an already-canceled hint (message "already been canceled", "A canceled subscription can only update…", or `resource_missing` *after* a successful retrieve), do not trust the hint: re-`retrieve` and only sync the local row to `canceled` if Stripe now reports a non-billing status; otherwise keep the 502. Same fail-closed rule, one more entry point.

**Two Stripe webhook endpoints exist:** `/api/billing/stripe/webhook` (stripe-billing `handleStripeEvent`) and the gateway `/api/webhooks/stripe` (also used for SaaS checkout). Both must mark the local `subscriptions` row `canceled` on `customer.subscription.deleted` and on `.updated` with a non-billing status, matched by `stripe_subscription_id` — a dashboard cancellation otherwise leaves the deletion guard stuck at 409. Whichever endpoint Stripe is pointed at, keep both in sync.
