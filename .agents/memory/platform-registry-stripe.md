---
name: Platform capability registry + strict Stripe tenancy
description: Decisions behind per-platform UI/logic (Shopify/Woo/Presta/Stripe/…) and how Stripe projects resolve credentials; read before touching nav, client panel, or Stripe routes.
---

**Rule 1 — Two mirrored registries, not a shared package.** `platform-capabilities.ts` exists in BOTH api-server/src/lib and shopify-optimizer/src/lib with the same capability keys. Add a capability/module to both.
**Why:** a shared workspace package would have required tsconfig/build changes across artifacts; mirroring was the lower-risk path the owner accepted.
**How to apply:** new platform or new flag (e.g. `usesStoreToken`) → edit both files; first entry of `adminModules` is the project "home" (SmartProjectRedirect + sidebar links use it).

**Rule 2 — Stripe projects never silently use the Master key.** `resolveStripeForProject(pid, { strict: true })` throws `StripeNotLinkedError` (409, code STRIPE_NOT_LINKED). All admin `/admin/stripe/*` project routes and `/api/client/stripe/*` use strict; only non-tenant callers (billing/platform) keep the platform fallback.
**Why:** owner's original complaint — the hub showed the agency's own Stripe data on a client project.

**Rule 3 — Unlink must clear BOTH stores.** Deleting `stripe_accounts` alone is undone by `ensureStripeAccountForProject()` (self-heal from `projects.client_secret`). Every unlink path must also blank `projects.client_secret`.

**Rule 4 — Legacy `/stripe/accounts/:accountId/*` is mounted BEFORE the global requireAdmin gate with only requireAuth.** A `router.use("/stripe/accounts/:accountId", requireStripeAccountAccess)` guard enforces `stripe_accounts.project_id === session.clientId` for non-admins. Keep it when adding routes there.

**Rule 5 — ClientLayout remounts per page.** Platform info is cached at module level and nav is hidden until `platformKnown`, otherwise the sidebar flashes Shopify defaults on every navigation (an e2e tester flagged this as a "regression").

**Gotcha:** `const` helpers declared inside a `switch` `case` body are in TDZ for later cases (shopybrain execute-action Stripe helper crashed at runtime; tsc reports TS2454). Declare helpers before the switch.

**Gotcha:** `POST /api/admin/users` forces role=client; admin QA users need a SQL role promotion. Intentional.
