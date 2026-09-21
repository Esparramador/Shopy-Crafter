---
name: ElevenLabs ConvAI voice calls in chat
description: Non-obvious constraints of the real-time voice call in OmniChatbot (audio protocol, browser activation, agent sync).
---

## Rules
- Audio protocol is raw PCM16 @ 16 kHz in BOTH directions (see convai-audio-format.md). Do NOT send MediaRecorder WebM/Opus chunks and do NOT feed headerless PCM to `decodeAudioData` — both produce a silent call with no error.
- Create + resume the `AudioContext` synchronously inside the click handler, before any `await` (fetch / getUserMedia). Safari/mobile drop the user activation after the first await and the context stays suspended → silence.
- Schedule agent chunks on the `AudioContext` timeline (`nextStartTime`), not via `onended` chaining; handle the `interruption` event by stopping all scheduled sources.
- Backend syncs the agent config (voice + `pcm_16000`) synchronously before returning the signed URL, once per process per agent type, with single-flight dedupe. A background sync raced the browser connect; a per-call PATCH added ~2-3 s latency.
- Endpoints: admin `/api/voice/convai/call-url`, client `/api/voice/client-call-url`, landing `/api/voice/public-call-url` (landing UI still shows "Próximamente").

**Why:** June/July 2026 calls were mute: format mismatch + cloned voice rejected by plan + background sync race. Each cause was silent.

**How to apply:** any change to the voice pipeline — verify with a real WebSocket run (signed URL → metadata formats → audio bytes > 0) before shipping.
