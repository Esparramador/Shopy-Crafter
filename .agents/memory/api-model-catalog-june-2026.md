---
name: API Model Catalog June 2026
description: All AI model identifiers verified live as of June 10, 2026 — Claude, Gemini, ElevenLabs, Runway, Replicate
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

## Replicate Image Models (all HTTP 200 confirmed)
- `recraft-ai/recraft-v4`, `black-forest-labs/flux-kontext-max`, `flux-kontext-dev`, `ideogram-ai/ideogram-v3-quality`

## Replicate Video Models (all HTTP 200 confirmed)
- `bytedance/seedance-1-lite`, `wan-ai/wan-2.5-t2v` added to FSP + FSP_MODEL_MAP

## Google Gemini (verified live via SDK models.list)
- Fast tier: `gemini-3.5-flash` (new — confirmed in live models list)
- Smart/genius/vision tier: `gemini-3.1-pro-preview` (confirmed live)
- Nano-Banana v1: `gemini-2.5-flash-image` (confirmed live)
- Nano-Banana v2: `gemini-3-pro-image` (stable, upgraded from -preview)
- Also available: `gemini-3-pro-preview`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite`
- SDK `@google/genai ^1.46.0`
- config.ts: `GEMINI_MODEL=gemini-3.5-flash`, `GEMINI_PRO_MODEL=gemini-3.1-pro-preview`

## Tripo 3D
- No `TRIPO_API_KEY` or `TRIPO3D_API_KEY` found in env as of June 2026
- Not integrated — needs API key to add

**Why:** Verified before implementing — live API calls (especially `ai.models.list()`) confirmed all model IDs before use. No mocks.

**How to apply:** When adding new AI models, always call `ai.models.list()` via SDK before updating code. Check pnpm minimumReleaseAge before bumping SDK major versions.
