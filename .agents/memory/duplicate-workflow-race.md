---
name: Duplicate legacy workflows racing on the same dist/ dir
description: Why curl tests against a "working" port intermittently returned empty/connection-refused during debugging
---

# Duplicate legacy workflows racing on the same build output

This project has both artifact-managed workflows (e.g. `artifacts/api-server: API Server`, `artifacts/shopify-optimizer: web`) and older top-level duplicates (e.g. `API Server`, `web`) that run the *same* `pnpm --filter ... run dev` command (build-then-start) against the *same* package/dist directory, often on different hardcoded ports (one has `PORT=3000` baked into its command).

**Why:** If both are restarted/running around the same time, their builds race on the same `dist/` output — one process's build step can wipe/rewrite `dist/index.mjs` out from under the other's already-started `node dist/index.mjs`, crashing it with `MODULE_NOT_FOUND`. This produced confusing symptoms: curl against the "known" port returned instantly with no body / connection refused, while the actual live server was healthy on a different port, making a real fix look broken.

**How to apply:**
- Before debugging "server not responding," check `refresh_all_logs` for ALL workflows, not just the one you expect — look for a duplicate FAILED workflow pointing at the same package.
- Only interact with the artifact-managed workflow (find the port from its "Server listening" log line) — treat the bare-named legacy duplicates (`API Server`, `web`) as stale and avoid restarting both together for the same package.
