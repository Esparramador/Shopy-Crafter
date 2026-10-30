---
name: ConvAI agent voice settings are flat tts.* fields
description: Agents API ignores nested tts.voice_settings; only flat stability/similarity_boost/speed persist; values now live in platform_settings_kv (panel-tunable), defaults 0.5/0.8/1.2.
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

**Where the values live (since 2026-10-30):** `platform_settings_kv` keys `convai_tts_*`,
edited from the admin panel (Fusion Studio Pro → Audio AI Tools → ConvAI → "Voz de Arturo",
with a "Escuchar muestra" TTS preview). The code defaults (0.5/0.8/1.2) apply only when
nothing is stored. Saving invalidates the in-memory agent cache, so the health check shows
`drift` (amber) until the next call or "Re-sincronizar" re-PATCHes the agents — that is
expected, not a bug. ElevenLabs rejects speed outside 0.7–1.2 (422), hence the limits.

**How to apply:** never reintroduce a `voice_settings` key on the agent config. To change
the defaults, edit the defaults constant in the voice-settings lib; to change the live
values, use the panel (or upsert the kv rows) — not code.
