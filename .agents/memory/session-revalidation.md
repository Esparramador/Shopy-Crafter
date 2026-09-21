---
name: Session revalidation middleware
description: How deleted/deactivated users lose their session, and the express-session destroy vs regenerate gotcha
---
Rule: any account revocation (delete, deactivate) relies on the global `revalidateSession` middleware (mounted right after express-session), not on purging `user_sessions` rows — a login racing the DELETE can persist a fresh session after the purge.

**Why:** code review rejected a permanent-delete endpoint whose only revocation was deleting session rows; per-request PK lookup was accepted as the tradeoff.

**How to apply:** in a middleware, invalidate with `req.session.regenerate()`, NOT `req.session.destroy()` — destroy deletes `req.session` entirely and every later `req.session.userId` read throws. Impersonation keeps `session.userId` = admin and `session.impersonating` = client; validate both. There are no DB foreign keys to `users`; user-owned rows must be removed by hand (see the DELETE /admin/users route for the current list).
