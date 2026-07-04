---
name: API Model Catalog Jul 2026
description: Verified live model IDs for all AI providers — deep 20-search parallel research Jul 4 2026
---

## Runway (api.dev.runwayml.com/v1, header 2024-11-06)
- Gen4.5 API model ID: `gen4_5` (underscore) — NOT `gen4.5` (dot was wrong, causes 400)
- Gen4.5-Turbo: `gen4_5_turbo`
- Aleph 2.0: `aleph2` — V2V only (video-to-video edit), NOT T2V/I2V
- HappyHorse 1.0: `happyhorse_1_0` — T2V+I2V
- Gen4 Turbo: `gen4_turbo`; Gen3: `gen3a_turbo`

## Kling (Replicate, kwaivgi namespace)
- `kwaivgi/kling-video-3.0` — T2V+I2V, 1080p, 15s
- `kwaivgi/kling-video-3.0-omni` — multimodal (text+img+refs+audio)
- `kwaivgi/kling-v2.1` / `kling-v2.1-pro` / `kling-v2.1-master`
- `kwaivgi/kling-v2.5-turbo-pro`
- `kwaivgi/kling-v2.6` — T2V+I2V, native audio+lip-sync (speech+SFX+BGM), NEW

## Veo / Gemini
- `veo-3.1-generate-preview` / `veo-3.1-fast-generate-preview` / `veo-3.1-lite-generate-preview`
- Veo 3.0 SHUT DOWN Jun 30 2026; Veo 4 NOT released (Jul 2026)
- Accepted aspect ratios: `16:9` and `9:16` ONLY
- Supports: I2V, first+last frame, reference images

## Wan (Replicate, wan-video namespace)
- `wan-video/wan-2.7-t2v` / `wan-2.7-i2v` / `wan-2.7-r2v`
- `wan-video/wan-2.7-videoedit` — V2V instruction-based editing (NEW)

## Seedance (Replicate, bytedance namespace)
- `bytedance/seedance-1-pro` / `seedance-1-lite`
- `bytedance/seedance-2.0` — T2V+I2V, native audio, 4-15s, aspect: 16:9/9:16/4:3/3:4/1:1/21:9/adaptive (NEW)

## MiniMax Hailuo (Replicate)
- `minimax/hailuo-2.3` — T2V+I2V 1080p ACTIVE (recommended)
- `minimax/hailuo-2.3-fast` — I2V 1080p, low latency (NEW)
- `minimax/hailuo-02` / `hailuo-02-fast` — legacy (still accessible)

## xAI Grok Video
- `grok-imagine-video` — T2V+I2V+Reference+Edit+Extend, 720p
- `grok-imagine-video-1.5` — T2V+I2V, 1080p (no Reference mode)
- NO `-preview` suffix; endpoint: POST /v1/videos/generations

## Tripo3D
- Full version strings required: `v3.1-20260211`, `P1-20260311`, `v2.5-20250123`
- Default updated to `v3.1-20260211` (was shorthand `v2.5`)

## Freepik Video Endpoints (POST + GET /{path}/{taskId})
- /v1/ai/video/kling-v3-std, /v1/ai/video/kling-v3-pro
- /v1/ai/video/kling-v3-omni-std, /v1/ai/video/kling-v3-omni-pro
- /v1/ai/video/hailuo-video-02

## Meshy AI
- `meshy-6` active; `meshy-5` active; `latest` → meshy-6; meshy-4 RETIRED

**Why:** `gen4_5` bug caused 400 errors on every Runway Gen4.5 request. Freepik omni split into -pro/-std variants. 5 new models discovered (kling-v2.6, kling-v2.1-master, wan-2.7-videoedit, seedance-2.0, hailuo-2.3-fast).

**How to apply:** Runway model IDs always use underscores. Replicate models: always verify exact namespace/slug. Tripo3D: always use full date-suffixed version string.
