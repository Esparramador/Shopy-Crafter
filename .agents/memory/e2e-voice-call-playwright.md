---
name: E2E for microphone/WebSocket voice flows
description: How to browser-test the ConvAI voice call (fake mic) when the testing subagent cannot; gotchas found on the first working run.
---

**Rule:** for flows that need `getUserMedia` (ConvAI voice call), do not rely on the Playwright testing subagent — run the workspace script `pnpm --filter @workspace/shopify-optimizer run e2e:voice-call` (needs `ADMIN_PASSWORD` in env; optional `E2E_ERROR_API_URL` pointing at a spare api-server started with `ELEVEN_CONVAI_VOICE_ID=<cloned voice>` on another PORT to cover the 503 path).

**Why:** the testing subagent's browser died with `ERR_INVALID_ARG_TYPE` inside `browser.newContext` as soon as microphone permission was granted (three fresh attempts, with and without custom launch args). Root `node_modules/playwright` + Nix `chromium` with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` works fine from a plain `node` script.

**How to apply:**
- Login via `page.request.post(/api/auth/login)` (shares cookies) using the https `REPLIT_DEV_DOMAIN` base — the session cookie is not stored on plain `http://localhost`.
- The "Colgar" button has an infinite CSS pulse → Playwright never sees it "stable"; click with `{ force: true }`.
- `getByRole("button",{name:"Cerrar"})` is ambiguous (3 buttons) → use `exact: true`.
- A spare api-server must be started with `run_in_background` (a `nohup … &` inside a normal shell call is killed when that call returns).
- A fresh browser profile pops the onboarding tour ("Paso 1 de 4") over the modal; the small "SC" circle in screenshots is the custom cursor at the last click position, not a bug.
