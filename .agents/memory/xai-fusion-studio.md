---
name: xAI Grok Fusion Studio Pro integration
description: xAI API endpoints, models, polling, and ProviderId type sync requirements for Fusion Studio Pro.
---

# xAI Grok — Fusion Studio Pro Integration

## ⚠️ Secret name: GROK_API_KEY (not XAI_API_KEY)
The Replit secret is stored as **`GROK_API_KEY`**, not `XAI_API_KEY`. Always read with fallback:
```ts
const key = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
```
Fixed in (2026-06-26): `fusion-studio-pro.ts`, `provider-health.ts`, `card-studio.ts`, `studio.ts`, `tripo3d.ts`, `shopybrain.ts`, `viral.ts` — all 7 files now use this fallback pattern.

## API base
`https://api.x.ai/v1` — auth: `Authorization: Bearer $GROK_API_KEY` (env var name)

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

## ⚡ VIDEO EXTENSION — Extender desde el último frame
**Grok puede extender un vídeo ya generado partiendo de su último fotograma.**

Endpoint: `POST https://api.x.ai/v1/videos/extensions`
```json
{
  "model": "grok-imagine-video",
  "prompt": "descripción de lo que ocurre a continuación",
  "duration": 5,
  "video": { "url": "https://url-del-video-generado.mp4" }
}
```
- Returns `{request_id}` → poll with `GET /v1/videos/{request_id}`
- `duration`: 2–10 seconds per extension
- Input video: must be a public HTTPS URL (not data-URI, not localhost)
- **Use case para Muscle Factory**: extender V1 o V2 con una escena de cierre adicional sin regenerar todo desde cero
- **Rate limit**: mismo 1 req/s que generación normal — hacer secuencial

**Why this matters:** Permite iterar el final de un anuncio ya generado (ej. añadir un CTA épico de 5s al final) sin consumir un nuevo slot de 15s completo. Mucho más eficiente para refinamiento.
