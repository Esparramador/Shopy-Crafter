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
