---
name: ElevenLabs ConvAI voice calls in chat
description: Non-obvious constraints of the real-time voice call in OmniChatbot (audio protocol, browser activation, agent sync).
---

## Rules
- Audio protocol is raw PCM16 @ 16 kHz in BOTH directions (see convai-audio-format.md). Do NOT send MediaRecorder WebM/Opus chunks and do NOT feed headerless PCM to `decodeAudioData` — both produce a silent call with no error.
- Create + resume the `AudioContext` synchronously inside the click handler, before any `await` (fetch / getUserMedia). Safari/mobile drop the user activation after the first await and the context stays suspended → silence.
- Schedule agent chunks on the `AudioContext` timeline (`nextStartTime`), not via `onended` chaining; handle the `interruption` event by stopping all scheduled sources.
- Backend syncs the agent config (voice + `pcm_16000`) synchronously before returning the signed URL, once per process per agent type, with single-flight dedupe. A background sync raced the browser connect; a per-call PATCH added ~2-3 s latency.
- Active sync/verification must take precedence over a previously cached agent ID. Call and apply must share successful work; failed verification must never authorize a signed URL or count as applied.
- Tie every AudioContext / MediaStream / WebSocket / mic node to ONE call attempt and detach socket handlers before closing a socket yourself. "Reintentar" or "Colgar" during an await (signed URL, getUserMedia) otherwise lets the old socket's late `close` tear down the new call, or leaves the mic capturing.
- Endpoints: admin `/api/voice/convai/call-url`, client `/api/voice/client-call-url`, landing `/api/voice/public-call-url` (landing UI still shows "Próximamente").

**Why:** June/July 2026 calls were mute: format mismatch + cloned voice rejected by plan + background sync race. Each cause was silent.

**How to apply:** any change to the voice pipeline — verify with a real WebSocket run (signed URL → metadata formats → audio bytes > 0) before shipping.

## Concurrency verification
Use controlled provider barriers in route tests as well as live checks. Exercise both call-first and apply-first with a warm cache and an environment-pinned admin.

**Why:** A live call-first race alone does not exercise the cached-ID bypass; network timing can also hide which request actually owns the pending verification. Readback and expected-settings reads can both predate a save and still agree, so successful verification alone does not prove the latest save was applied.

**How to apply:** Hold PATCH/readback until the competing request arrives, then assert one sync, no creation, and no signed URL before successful verification. Also save changed settings after verification starts: revision tracking must keep the same flight owned while re-syncing current values, including invalidating late cache fills. Live E2E should separately confirm actual persisted TTS values and restore original settings.
