---
name: Stripe resource_missing is not proof of "gone"
description: Why billing guards must fail closed on Stripe resource_missing, and how to E2E Stripe-touching admin flows without a test-mode key.
---

**Rule:** never treat a Stripe `resource_missing` as evidence that a subscription no longer bills. Verify with `retrieve` and only clear a local billing guard when Stripe authoritatively reports a non-billing status (or a `cancel` call succeeds). On `resource_missing`, fail closed and point the admin at the dashboard.

**Why:** Stripe returns the same `resource_missing` when the configured key belongs to another mode (test vs live) or another account. Failing open would delete the user and the local record while the real subscription keeps charging — the exact outcome the guard exists to prevent. A first implementation did exactly this and was rejected in review.

**How to apply:** any admin action that reconciles local billing state with Stripe should retrieve → decide → mutate, and return a distinct error for "not visible with this key". This workspace's Stripe key is not test-mode, so E2E must not create/cancel real subscriptions: seed a local row with an id Stripe cannot know and assert the fail-closed path; cover the confirmed-cancel path with unit tests via an injected Stripe client. Omit `apiVersion` when constructing the Stripe SDK — a pinned old version string fails typecheck against the installed SDK's literal type.
