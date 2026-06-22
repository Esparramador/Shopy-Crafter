---
name: Express router.use without path intercepts ALL routes
description: router.use(middleware, handler) with no path prefix runs the middleware on every request passing through — a common footgun when adding auth-gated routers.
---

# Express router.use without path = global middleware trap

## The Rule
`router.use(requireAuth, someRouter)` **without a path prefix** applies `requireAuth` to **every request** that reaches that line, not just routes inside `someRouter`. If `requireAuth` sends 401, the request stops there and no later `router.use(billingRouter)` (or any other) ever executes.

**Why:** Express middleware chains execute top-to-bottom. `router.use(mw, r)` is equivalent to `router.use("*", mw, r)` — it matches all paths. If `mw` calls `res.status(401).json(...)` instead of `next()`, the chain halts.

**How to apply:**
- Any route that must be public must be mounted **before** any `router.use(requireAuth, ...)` line that lacks a path prefix.
- Or, give the auth-gated router a path prefix: `router.use("/meshy", requireAuth, meshyRouter)`.
- In `routes/index.ts`: billingRouter (GET /billing/plans is public) was getting 401 because `router.use(requireAuth, meshyRouter)` sat above it. Fixed by moving `router.use(billingRouter)` above the meshy/stitch lines.
