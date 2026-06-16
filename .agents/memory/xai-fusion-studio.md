---
name: xAI Grok Fusion Studio Pro integration
description: xAI API endpoints, models, polling, and ProviderId type sync requirements for Fusion Studio Pro.
---

# xAI Grok — Fusion Studio Pro Integration

## API base
`https://api.x.ai/v1` — auth: `Authorization: Bearer $XAI_API_KEY`

## Endpoints used
- **Image gen**: `POST /v1/images/generations` — models `grok-imagine-image` ($0.02) / `grok-imagine-image-quality` ($0.05-0.07). Returns `{data:[{url}]}`.
- **Video T2V/I2V**: `POST /v1/videos/generations` — models `grok-imagine-video` / `grok-imagine-video-1.5-preview`. Returns `{request_id}`.
- **Video extension**: `POST /v1/videos/extensions` — body `{model, prompt, duration(2-10), video:{url}}`. Returns `{request_id}`.
- **Video editing**: `POST /v1/videos/edits` — body `{model, prompt, video:{url}}`, max 8.7s input. Returns `{request_id}`.
- **Poll**: `GET /v1/videos/{request_id}` → `{status, video:{url}}`; poll every 6s.

## Key files
- `lib/fusion-studio-pro.ts` — `getXaiKey()`, `pollXaiVideo()`, `extendXaiVideo()`, `editXaiVideo()`, xAI branches in `generateImage()` and `generateVideoFromImage()`.
- `routes/fs-pro.ts` — `POST /fs-pro/extend-video` and `POST /fs-pro/edit-video` routes.
- `FusionStudioPro.tsx` — VideoMode includes `"extend"` and `"edit-video"` modes; xAI model selector shown for those modes.

## Critical: ProviderId type sync
`ProviderId` is defined locally in `FusionStudioPro.tsx` (NOT imported from backend). When adding a new provider to backend `provider-health.ts`, must ALSO add it to the frontend type + `PROVIDER_LABEL` map + health bar array — both files must stay in sync manually.

**Why:** The frontend has its own `type ProviderId` declaration; TS doesn't share types across the monorepo boundary at runtime.

## VideoMode
- `"t2v"` / `"i2v"` → standard generate-video route (Replicate/Runway/etc.)
- `"extend"` → xAI `/fs-pro/extend-video` — requires public video URL (2-15s MP4)
- `"edit-video"` → xAI `/fs-pro/edit-video` — requires public video URL (max 8.7s MP4)
