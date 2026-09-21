---
name: ConvAI voice call audio format (PCM vs MP3)
description: ConvAI WebSocket audio is raw PCM16 at 16 kHz in both directions and must be encoded/decoded explicitly
---

# ConvAI voice call — audio format

## The rule
Treat the formats announced by `conversation_initiation_metadata_event` as authoritative. The verified live protocol announces `agent_output_audio_format: "pcm_16000"` and `user_input_audio_format: "pcm_16000"`.

**Why:** Raw PCM has no container, so `AudioContext.decodeAudioData()` cannot decode it. `MediaRecorder` produces WebM/Opus, which ConvAI cannot interpret as PCM mic input. This combination made the agent inaudible and unable to understand the user. A live test confirmed a working call returns PCM audio bytes after both directions use PCM16.

**How to apply:**
- Decode agent PCM16 little-endian bytes into a mono `AudioBuffer` using the announced sample rate; keep an ordered decode/playback queue.
- Capture microphone floats, downsample to 16 kHz, encode signed PCM16 little-endian, then send the base64 bytes as `user_audio_chunk`. Do not send a WebM/Opus container.
- Keep `ping`/`pong` handling: ElevenLabs sends `{ type: "ping", ping_event: { event_id: N } }` and expects `{ type: "pong", event_id: N }`.
- Do not hide decode failures; surface them to the user and log the announced format.
- Use a ConvAI-compatible premade voice on the current plan. Instant clones close the socket with a plan error, and some catalog voices marked `professional` return `voice_not_found` from Agents even though `/voices` lists them.
- Synchronize an existing agent config before returning its signed URL. Background synchronization races with the browser and can issue a call using the stale voice.

## ElevenLabs field names & pre-flight facts (verified live Sept 2026)
- The agent config field that ElevenLabs persists/announces is `conversation_config.tts.agent_output_audio_format` (NOT `output_format`, which PATCH silently ignores) and `conversation_config.asr.user_input_audio_format`. Nested `tts.voice_settings{stability,...}` is also ignored — the real keys are flat (`tts.stability`, `tts.similarity_boost`). Always GET the agent back after PATCH/create to confirm; create returns only `agent_id`.
- `GET /v1/voices/{id}` answers **400** (not 404) with `detail.status = "voice_not_found"` for unknown voices.
- `GET /v1/user/subscription` exposes `can_use_instant_voice_cloning` / `can_use_professional_voice_cloning`; a `category:"cloned"` voice on a plan without instant cloning is exactly the connected-but-mute case, so reject it before issuing a signed URL.
- Rejected voices are a configuration problem, not a transient one: return 503 with a machine-readable code from the call-url routes so the UI can explain it, and never cache a rejection (a fix must take effect at once).
