---
name: API Model Catalog June 2026
description: All AI model identifiers verified live as of June 10, 2026 — Claude, Gemini, ElevenLabs, Runway, Replicate
---

## Anthropic Claude (verified live)
- Smart tier default: `claude-sonnet-4-6` (was claude-3-5-sonnet)
- Genius/heavy tier default: `claude-opus-4-8` (was claude-opus-3)
- Fable (narrative): `claude-fable-5`
- API version stays `anthropic-version: 2023-06-01` — unchanged
- SDK `@anthropic-ai/sdk ^0.81.0` — newer versions blocked by pnpm minimumReleaseAge at time of update

## ElevenLabs TTS
- New flagship: `eleven_v3` — 74 languages, most expressive. Now the default across ALL services.
- Legacy allowed: `eleven_multilingual_v2`, `eleven_turbo_v2_5`, `eleven_flash_v2_5`
- Files updated: `elevenlabs.ts` (type + default), `voice.ts` ALLOWED_TTS_MODELS, `fusion-studio-pro.ts` generateTTS default, `avatar-studio.ts` (2 interfaces + 2 defaults), `cinematic-multishot.ts`, `adstudio.ts`

## Runway (verified live)
- New models: `gen4.5`, `seedance2`, `seedance2_fast` (available in tier)
- Endpoint: `api.dev.runwayml.com/v1` (see runway-api-config.md)
- `FSP_MODEL_MAP` keys: `runway_gen45`, `runway_seedance2`, `runway_seedance2_fast`

## Replicate Image Models (all HTTP 200 confirmed)
- `recraft-ai/recraft-v4` (replaces recraft-v3)
- `black-forest-labs/flux-kontext-max` (premium, replaces flux-kontext-pro)
- `black-forest-labs/flux-kontext-dev` (dev tier)
- `ideogram-ai/ideogram-v3-quality` (replaces ideogram-v3-turbo in FSP)

## Replicate Video Models (all HTTP 200 confirmed)
- `bytedance/seedance-1-lite` — added to FSP + FSP_MODEL_MAP (`seedance_1_lite`)
- `wan-ai/wan-2.5-t2v` — text-to-video variant, added to FSP + FSP_MODEL_MAP (`wan_25_t2v`)

## Google Gemini
- SDK `@google/genai ^1.46.0` (was pinned wrong; actual latest 1.x = 1.46.0)
- Model IDs unchanged from prior session

**Why:** Verified before implementing — live API calls returned HTTP 200 for each model before adding to code. No mocks.

**How to apply:** When adding new AI models, always verify live via curl/fetch before updating code. Check pnpm minimumReleaseAge before bumping SDK major versions.
