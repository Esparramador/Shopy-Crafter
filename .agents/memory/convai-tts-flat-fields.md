---
name: ConvAI agent voice settings are flat tts.* fields
description: Agents API ignores nested tts.voice_settings; only flat stability/similarity_boost/speed persist; owner chose 0.5/0.8/1.2 after listening.
---
**Rule:** In `conversation_config.tts` of a ConvAI agent, voice settings MUST be sent flat
(`tts.stability`, `tts.similarity_boost`, `tts.speed`). A nested `tts.voice_settings{...}`
block (the shape the plain `/text-to-speech` endpoint uses) is silently dropped by
create/PATCH — no error, defaults 0.5/0.8 stay persisted. `style` and `use_speaker_boost`
do not exist in the persisted agent schema at all.

**Why:** Verified live (Sept 2026) with GET /v1/convai/agents/{id}: the code had sent a
nested block for months and the agent still had 0.5/0.8. The post-sync verifier now
compares the flat values (with float tolerance) so a regression throws
`agent_config_mismatch` instead of silently sounding different.

**Owner decision (2026-09-21):** after A/B listening with Charlie + eleven_turbo_v2_5,
the owner preferred the stable pair stability 0.5 / similarity 0.8 (speed 1.2) over the
"expressive" 0.18 / 0.92. Do not swing back to low stability without asking.

**How to apply:** change the CONVAI_TTS_* constants in routes/voice.ts only; the verifier
picks them up automatically. Never reintroduce a `voice_settings` key on the agent config.
