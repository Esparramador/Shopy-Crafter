---
name: E2E for microphone/WebSocket voice flows
description: Durable lessons for browser-testing the ConvAI voice call (fake mic) — which harness works and what "understands the user" must mean.
---

**Rule 1:** flows needing `getUserMedia` cannot be delegated to the Playwright testing subagent (its browser dies as soon as microphone permission is granted). Drive the workspace's own `playwright` + Nix `chromium` from a plain `node` script instead (`e2e:voice-call` in shopify-optimizer).

**Rule 2:** "the agent hears the user" is only proven by injecting a known phrase into the fake mic (`--use-file-for-fake-audio-capture=<wav>%noloop`, with leading silence so the agent's first_message finishes) and asserting a `user_transcript` containing it followed by an `agent_response` + audio. First audio + "speaking" state alone is satisfied by the agent's automatic greeting even when ASR is broken — a reviewer rejected exactly that.

**Why:** ElevenLabs event payloads are nested (`user_transcription_event.user_transcript`, `agent_response_event.agent_response`); the modal parsed the flat shape for months and the transcript never rendered without anyone noticing, because nothing checked the user's side of the conversation.

**How to apply:** a spare api-server for env-override paths (e.g. cloned voice → 503) must be launched as a background task, not `nohup … &` in a one-off shell. The session cookie only sticks on the https dev domain, not `http://localhost`.

**Rule 3 (client mode):** run `E2E_MODE=client` (script `e2e:voice-call:client`) for the client-panel path. It creates a throwaway client user via the admin users API (nanoid email under `@e2e.invalid`), drives the client chatbot's own voice entry point, and asserts `GET /voice/convai/health` reports the `client` agent `ok` afterwards. There is no user DELETE route, so cleanup deactivates the user.

**Why:** `VoiceCallModal` had a `mode="client"` branch for months that no client could ever reach — the admin OmniChatbot is mounted only for `role === "admin"`. A mode branch inside a component is not an entry point; verify a role can actually open the modal before testing it.

**How to apply:** any element with an infinite CSS animation (client FAB, pulsing "Colgar") needs `click({ force: true })` after an explicit visibility wait; Playwright's stability check never passes.
