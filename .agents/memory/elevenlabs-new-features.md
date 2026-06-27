---
name: ElevenLabs 4 New Features (June 2026)
description: Speech-to-Text, Audio Isolation, ConvAI Agents, Pronunciation Dictionaries — implementation details and gotchas.
---

## Features added to elevenlabs.ts + voice.ts routes

### 1. Speech-to-Text — `transcribeAudio()`
- Model: `scribe_v1` (only model for STT in ElevenLabs Jun 2026)
- Endpoint: `POST /v1/speech-to-text` (multipart, field: `file`)
- Returns: `{ text, language_code, language_probability, words[] }` with word timestamps
- Route: `POST /api/voice/transcribe` (requireAdmin, multer `audioUpload` 100MB)
- Accepts: mp3, wav, m4a, ogg, flac, webm, mp4, mov, mkv

### 2. Audio Isolation — `isolateAudio()`
- Endpoint: `POST /v1/audio-isolation` (multipart, field: `audio`)
- Returns: raw audio Buffer (mp3), streamed directly to client
- Route: `POST /api/voice/audio-isolation` (requireAdmin)
- `OPTIONS /v1/audio-isolation` returns 200 but POST needs audio file (422 without it — this is correct)

### 3. ConvAI Agents — `createConvAIAgent()` etc.
- Create endpoint: `POST /v1/convai/agents/create` (NOT `/agents` — different path!)
- List: `GET /v1/convai/agents` → `{ agents: [] }`
- Delete: `DELETE /v1/convai/agents/:id`
- Signed URL (for web widget): `GET /v1/convai/conversation/get_signed_url?agent_id=...`
- Conversations: `GET /v1/convai/conversations?agent_id=...`
- Routes: `GET|POST /api/voice/convai/agents`, `DELETE /api/voice/convai/agents/:id`, `GET /api/voice/convai/signed-url`, `GET /api/voice/convai/conversations`

### 4. Pronunciation Dictionaries — PLS/XML format
- Create: `POST /v1/pronunciation-dictionaries/add-from-file` (multipart, field: `file`, XML PLS)
- NOT via JSON — ElevenLabs requires PLS/XML file upload, not raw rules JSON
- Add rules: `POST /v1/pronunciation-dictionaries/:id/add-rules` (JSON, rules array)
- Remove rules: `POST /v1/pronunciation-dictionaries/:id/remove-rules` (JSON, rule_strings array)
- Delete: `DELETE /v1/pronunciation-dictionaries/:id`
- Routes: `GET|POST /api/voice/pronunciation-dicts`, `POST /api/voice/pronunciation-dicts/:id/add-rules`, `POST /api/voice/pronunciation-dicts/:id/remove-rules`, `DELETE /api/voice/pronunciation-dicts/:id`

## Clarification: Seedance is NOT in ElevenLabs
- Seedance = ByteDance video generation model (not audio)
- ElevenLabs `/v1/video` and `/v1/video-generation` → 404 (does not exist)
- ElevenLabs is exclusively audio/voice: TTS, STS, SFX, Dubbing, STT, Audio Isolation, ConvAI

## Frontend
- New `AudioToolsTab` component added to FusionStudioPro.tsx (between AudioTab and ComposeTab)
- 4 sub-tabs: Transcripción / Aislar voz / ConvAI Agents / Pronunciación
- Tab ID: `"audiotools"`, label: "Audio AI Tools", icon: FileText

## multer instances in voice.ts
- `cloneUpload`: 25MB, 10 files, audio only — for voice cloning
- `audioUpload`: 100MB, 1 file, audio+video — for transcribe + audio isolation
