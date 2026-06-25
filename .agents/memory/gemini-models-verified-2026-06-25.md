---
name: Gemini Models Verified 2026-06-25
description: Real Gemini model IDs confirmed via GET /v1beta/models + HTTP 200 smoke tests on June 25 2026; HARD_DEFAULTS and KNOWN_MODELS in ai-models.ts updated accordingly.
---

# Gemini Models — Verified 2026-06-25

## How verified
- `curl "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=$GEMINI_API_KEY"` — direct API
- HTTP 200 smoke test with `generateContent` on each tier default

## HARD_DEFAULTS (ai-models.ts)
| Tier   | Model                  | Status     |
|--------|------------------------|------------|
| fast   | gemini-3.5-flash       | HTTP 200 ✅ |
| smart  | gemini-3.1-pro-preview | HTTP 200 ✅ |
| genius | gemini-3.1-pro-preview | HTTP 200 ✅ |
| vision | gemini-2.5-flash       | HTTP 200 ✅ |

## Image generation fallback chain (askGeminiGenerateImage in gemini.ts)
1. `gemini-3.1-flash-image` (Nano Banana 2) — latest
2. `gemini-2.5-flash-image` (Nano Banana) — reliable fallback
3. `gemini-3-pro-image` (Nano Banana Pro) — last resort

**Why:** Only `-image` suffix models support `responseModalities: ["IMAGE"]`. Using the vision tier model (gemini-2.5-flash) as first candidate was wasteful — it always failed since it's a text/multimodal model.

## Full model list available (generateContent)
- gemini-3.5-flash ✅
- gemini-3.1-pro-preview ✅
- gemini-3.1-pro-preview-customtools ✅
- gemini-3.1-flash-lite ✅
- gemini-3.1-flash-lite-preview ✅
- gemini-3-pro-preview ✅
- gemini-3-flash-preview ✅
- gemini-2.5-pro ✅
- gemini-2.5-flash ✅
- gemini-2.5-flash-lite ✅
- gemini-2.5-computer-use-preview-10-2025 ✅
- gemini-2.0-flash ✅
- gemini-2.0-flash-001 ✅ (pinned stable)
- gemini-2.0-flash-lite ✅
- gemini-2.0-flash-lite-001 ✅ (pinned stable)
- gemini-flash-latest / gemini-flash-lite-latest / gemini-pro-latest (aliases) ✅

## Image-only models (responseModalities IMAGE)
- gemini-3.1-flash-image (Nano Banana 2) ✅
- gemini-3.1-flash-image-preview ✅
- gemini-3-pro-image (Nano Banana Pro) ✅
- gemini-3-pro-image-preview ✅
- gemini-2.5-flash-image (Nano Banana) ✅

## TTS-only models (audio output, NOT text chat)
- gemini-3.1-flash-tts-preview
- gemini-2.5-flash-preview-tts
- gemini-2.5-pro-preview-tts

## bidiGenerateContent only (NOT usable for standard generateContent)
- gemini-3.5-live-translate-preview
- gemini-3.1-flash-live-preview
- gemini-2.5-flash-native-audio-* variants

## NOT in the API (invented / stale — do not use)
All models currently in KNOWN_MODELS were confirmed real as of 2026-06-25.
Previously HARD_DEFAULTS used gemini-2.5-flash (fast) and gemini-2.5-pro (smart/genius) — both real but older than the current best options.
