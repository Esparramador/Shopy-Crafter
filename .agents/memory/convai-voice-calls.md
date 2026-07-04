---
name: ElevenLabs ConvAI voice calls in chat
description: How the real-time voice call feature works in OmniChatbot; endpoint and WebSocket protocol.
---

## Rule
`GET /api/voice/convai/call-url` (voice.ts) — authenticated users only (not admin-only). Reads `ELEVEN_CONVAI_DEFAULT_AGENT_ID` env var for default agent. Returns `{ signed_url, agentId }`.

The `VoiceCallModal` component in OmniChatbot.tsx:
1. Fetches signed URL from `/api/voice/convai/call-url`
2. Opens `new WebSocket(signed_url)` to ElevenLabs
3. Sends `conversation_initiation_client_data` on open
4. Streams mic audio as base64 chunks via `MediaRecorder` (250ms intervals) → `{ user_audio_chunk: base64 }`
5. Receives `{ type: "audio", audio_event: { audio_base_64 } }` → AudioContext decode + queue playback
6. Receives `{ type: "transcript" }` and `{ type: "agent_response" }` for display

**Why:** Admin `signed-url` endpoint kept for backward compat; new `call-url` endpoint for regular users.

## How to apply
- Set `ELEVEN_CONVAI_DEFAULT_AGENT_ID` in Replit secrets (get from ElevenLabs ConvAI dashboard)
- The 📞 phone button in chat opens the modal; works on all authenticated sessions
