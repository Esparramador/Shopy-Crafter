---
name: Session revalidation
description: Durable rules for revoking access (delete/deactivate) with express-session in this project
---
Rule: account revocation must go through the global per-request session revalidation, not through purging session rows — a login racing a delete can persist a fresh session after the purge.

**Why:** a permanent-delete endpoint that only purged `user_sessions` was rejected in review for exactly that race.

**How to apply:** invalidate with `req.session.regenerate()`, never `destroy()` in middleware (destroy removes `req.session` and later reads throw). `session.impersonating` must always hold the impersonated client's id, not the admin's. Deleting a user must refuse while a Stripe subscription still bills (409) — local rows disappearing don't stop Stripe.
