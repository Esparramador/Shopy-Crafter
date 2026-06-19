---
name: xAI Aurora image generation fix
description: xAI image gen model name is "aurora" NOT "grok-imagine-image". API params supported.
---

## Rule
When calling `POST https://api.x.ai/v1/images/generations`, always use `model: "aurora"`.
The internal model keys `grok-imagine-image` / `grok-imagine-image-quality` must NOT be passed
directly to the xAI API — they are internal routing identifiers only.

## Supported params (June 2026)
- `model`: `"aurora"` (only image model available)
- `prompt`: string
- `n`: number (1-N)
- `aspect_ratio`: ratio string like "1:1", "16:9", "9:16" — via XAI_RATIOS mapping
- `response_format`: `"url"` | `"b64_json"`
- ❌ `resolution`: NOT supported (removed from call)

## Why
Calling with `model: "grok-imagine-image"` returned an API error because that model name
does not exist in xAI's API. The correct model is always `"aurora"`.

## Quality differentiation
grok-imagine-image-quality uses the same `aurora` model but prepends a quality system prompt:
`"Ultra-photorealistic, high-detail, 4K render. "` before the user prompt.
