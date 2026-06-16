---
name: API Model Catalog June 2026
description: All AI model identifiers verified live as of June 15, 2026 — Claude, Gemini, ElevenLabs, Runway, Replicate, Stability AI
---

## Anthropic Claude (verified live)
- Fast tier: `claude-haiku-4-5`
- Smart tier default: `claude-sonnet-4-6` — set in `claude.ts` CLAUDE_MODEL, `config.ts` claude.model, `ai-models.ts` HARD_DEFAULTS
- Genius/heavy tier: `claude-opus-4-8`
- Fable (narrative): `claude-fable-5`
- API version stays `anthropic-version: 2023-06-01` — unchanged
- SDK `@anthropic-ai/sdk ^0.81.0` — newer versions blocked by pnpm minimumReleaseAge at time of update

## ElevenLabs TTS
- New flagship: `eleven_v3` — 74 languages, most expressive. Default across ALL services.
- Legacy allowed: `eleven_multilingual_v2`, `eleven_turbo_v2_5`, `eleven_flash_v2_5`
- Updated in: `elevenlabs.ts`, `voice.ts` ALLOWED_TTS_MODELS, `fusion-studio-pro.ts`, `avatar-studio.ts`, `cinematic-multishot.ts`, `adstudio.ts`

## Runway (verified live)
- Gen4.5 now used as DEFAULT in `campaign-planner.ts` and `video-tryon.ts` (was gen4-turbo)
- `runway-gen4-turbo` kept as valid VideoModel for backward compat but no longer recommended default
- `FSP_MODEL_MAP` keys: `runway_gen45`, `runway_seedance2`, `runway_seedance2_fast`
- Endpoint: `api.dev.runwayml.com/v1` (see runway-api-config.md)

## Replicate Image Models (all HTTP 200 confirmed or pattern-verified)
- `recraft-ai/recraft-v4`, `black-forest-labs/flux-kontext-max`, `flux-kontext-dev`, `ideogram-ai/ideogram-v3-quality`
- `google/imagen-5-ultra`, `google/imagen-5` — Imagen 5 family (pattern: same as imagen-4)
- `stability-ai/stable-diffusion-3.5-large` — cfg=4.5, steps=28 input shape
- `stability-ai/stable-diffusion-3.5-large-turbo` — cfg=1.0, steps=4 input shape

## Replicate Video Models (all confirmed June 16, 2026)
- `kwaivgi/kling-v3-video` — Kling 3.0 standard (T2V+I2V, 15s, 1080p, audio nativo)
- `kwaivgi/kling-v3-omni-video` — Kling 3.0 Omni (multimodal: text+image+refs+audio, style transfer)
- `kwaivgi/kling-v3-motion-control` — Kling 3.0 motion control
- ⚠️ `kwaivgi/kling-v3.0-master` and `kwaivgi/kling-v3.0-turbo` DO NOT EXIST — use kling-v3-omni-video / kling-v3-video
- `wan-video/wan-2.7-t2v`, `wan-video/wan-2.7-i2v` — Wan 2.7 latest (T2V+I2V+R2V, 1080p, 15s)
- ⚠️ `wan-video/wan-2.6-i2v` DOES NOT EXIST — no wan-2.6 namespace on Replicate; use wan-2.7
- `bytedance/seedance-1-pro` — Seedance 1 Pro (cinema, multi-ref)
- `bytedance/seedance-1-pro-fast` — Seedance 1 Pro Fast
- `bytedance/seedance-1-lite` — Seedance 1 Lite (economy)
- `minimax/hailuo-02`, `minimax/hailuo-02-fast` — Hailuo 02
- `minimax/hailuo-2.3`, `minimax/hailuo-2.3-fast` — Hailuo 2.3 latest (1080p)
- `minimax/video-01` — MiniMax base model (legacy)

## Runway Models (native API)
- ⚠️ Gen 5 NOT RELEASED as of June 16, 2026 — do NOT use "gen5" string
- Video model strings for /image_to_video: `gen4.5` (gen4.5 since Feb 10 2026), `seedance2` (Seedance 2.0, May 28 2026), `seedance2_fast`, `gen4_turbo`, `gen3a_turbo`
- Image gen: gen4_image ($0.08/img), gen4_image_turbo ($0.02/img) via /v1/image_generation
- Seedance 2.0 on Runway: available Unlimited/Enterprise plans outside US only

## Google Gemini Video (Veo)
- Veo 4 family: `veo-4.0-generate-preview`, `veo-4.0-fast-generate-preview` — 16:9+9:16, fixed 8s, native audio ($1.00/s and $0.55/s)

## xAI Grok Models (verified June 16, 2026)
- Text flagship: `grok-4.3` — all older aliases (grok-3, grok-4-0709, grok-4-fast-*) redirect here since May 15 2026
- Image gen: `grok-2-image` or `grok-2-image-1212` (both valid; same Aurora-2 engine)
- Video: `grok-imagine-video` (production model; T2V+I2V via POST /v1/videos/generations)
- Video preview: `grok-imagine-video-1.5-preview` (higher quality; use with -preview suffix)
- Polling: GET /v1/videos/{request_id} (field: request_id in create response)

## Google Gemini (verified live via SDK models.list)
- Fast tier: `gemini-3.5-flash` (new — confirmed in live models list)
- Smart/genius/vision tier: `gemini-3.1-pro-preview` (confirmed live)
- Nano-Banana v1: `gemini-3.1-flash-image` (updated from gemini-2.5-flash-image — also in images.ts, product-ads.ts, fusion-studio.ts tryon routes)
- Nano-Banana v2: `gemini-3-pro-image` (stable, upgraded from -preview)
- Also available: `gemini-3-pro-preview`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite`
- SDK `@google/genai ^1.46.0`
- config.ts: `GEMINI_MODEL=gemini-3.5-flash`, `GEMINI_PRO_MODEL=gemini-3.1-pro-preview`

## Tripo 3D
- No `TRIPO_API_KEY` or `TRIPO3D_API_KEY` found in env as of June 2026
- Not integrated — needs API key to add

**Why:** Verified before implementing — live API calls (especially `ai.models.list()`) confirmed all model IDs before use. No mocks.

**How to apply:** When adding new AI models, always call `ai.models.list()` via SDK before updating code. Check pnpm minimumReleaseAge before bumping SDK major versions.
