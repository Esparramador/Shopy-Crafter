---
name: ConvAI voice call audio format (PCM vs MP3)
description: ElevenLabs ConvAI defaults to PCM audio which browser AudioContext cannot decode — must request mp3_44100_128
---

# ConvAI voice call — audio format

## The rule
Always request `output_format: "mp3_44100_128"` for ElevenLabs ConvAI voice calls in the browser. Set it in TWO places:
1. **Agent config** (`agentConfigFor` in voice.ts): `tts.output_format = "mp3_44100_128"` — persisted in ElevenLabs
2. **WebSocket handshake** (`conversation_initiation_client_data`) override: `{ tts: { output_format: "mp3_44100_128" } }` — per-call override

**Why:** ElevenLabs ConvAI defaults to `pcm_16000` (raw PCM, no container). `AudioContext.decodeAudioData()` cannot decode headerless PCM — it throws silently (inside `catch { /* skip */ }`), so the agent SPEAKS but the user hears NOTHING. The bug is invisible because the catch block swallows the error.

**How to apply:**
- Any new voice call component using ElevenLabs ConvAI WebSocket must always include the output_format override
- `AudioContext` should NOT have a hardcoded `sampleRate: 16000` — use `new AudioContext()` (default) so it matches whatever format is returned
- Also add `ping`/`pong` handling: ElevenLabs sends `{ type: "ping", ping_event: { event_id: N } }` and expects `{ type: "pong", event_id: N }` — without it the session may stall
- Affects: LandingChatbot.tsx VoicePanel and OmniChatbot.tsx VoiceCallModal — both fixed 2026-07-07
