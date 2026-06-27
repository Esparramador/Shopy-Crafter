---
name: Global requireAdmin gate in routes/index.ts
description: routes/index.ts has a global router.use(requireAdmin) that blocks ALL routes mounted after it — per-route middleware changes are silently overridden
---

# Global requireAdmin gate

**Rule:** `routes/index.ts` has `router.use(requireAdmin)` around line 127-133 that acts as a blanket security gate for ALL routes mounted after that line. Even if an individual route handler uses `requireAuth` instead of `requireAdmin`, the request is blocked by the global gate before reaching the handler.

**Why:** This was the root cause of EffectsStudio and PromptLibrary not loading prompts. `prompt-library-master` endpoint was changed to `requireAuth` (per-route) but the global gate still blocked with 403.

**How to apply:**
- If you need a route to be accessible to non-admin authenticated users (`requireAuth`), mount its router BEFORE `router.use(requireAdmin)` in `routes/index.ts`
- Routers moved before the gate MUST have explicit per-route auth on every endpoint
- `fsProRouter`, `vismeRouter`, `promptExecRouter` are now mounted before the gate (each endpoint has its own auth)
- `shopybrainRouter`, `projectsRouter`, etc. remain after the gate (rely on global protection for routes without explicit per-route auth)
- When adding new routes that need `requireAuth`, either: (a) add them to a router already before the gate, or (b) mount them before the gate explicitly
