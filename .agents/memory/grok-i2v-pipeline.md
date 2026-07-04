---
name: Grok Aurora I2V video pipeline
description: Key constraints and fixes for Grok xAI video generation in this project
---

## Rules

**T2V not supported on grok-imagine-video-1.5-preview**
- `grok-imagine-video-1.5-preview` is I2V ONLY — sending no image returns 400 "Text-to-video is not supported for this model"
- `grok-imagine-video` and `grok-video-1` may support T2V but are lower quality
- **Fix:** Always provide a reference image (user photo, generated image, or dark studio base)

**aurora image model not available**
- `POST /v1/images/generations` with `model:"aurora"` → 404 "does not exist or your team does not have access"
- This account cannot generate images via xAI API
- **Fix:** Use user-provided image, ffmpeg-generated base frame, or Gemini image API

**node -e inline doesn't get XAI_API_KEY**
- `node -e "process.env.XAI_API_KEY"` returns undefined in bash subshells
- Full script `node script.mjs` from workspace root DOES have the key
- **Fix:** Always write to a .mjs file and run with `node script.mjs`

**Poll must handle "done" status**
- xAI API returns `status: "done"` for success, NOT just "succeeded"/"completed"
- Missed "done" → timeout even though video was ready
- **Fix:** SUCCESS set = `["succeeded", "completed", "done", "success"]`

**Timeout: 22+ minutes per clip**
- Clip 1 took 904s (>15 min) — the default 15 min timeout is too tight
- Clips 2 and 3 can take 63s if image is smaller (frame JPEGs are smaller than original photo)
- **Fix:** Set timeoutMs = 22 * 60_000 per clip

**Recovery pattern for long pipelines**
- Check disk for existing clip before re-requesting
- Store request_id and immediately poll when recovering (status is "done" → instant URL)
- Chain clips via last frame: `ffprobe duration` → `ffmpeg -ss (dur-0.3) -frames:v 1 last.jpg`

**Why:**
Grok Aurora I2V is slow but high quality; the pipeline is brittle without proper status handling and recovery. A 35s video requires ~3 sequential I2V calls of 15+10+10s, total generation time 15-30 min.

**How to apply:**
Use `.local/generate-rolex-explode.mjs` as the reference script for any product explode-view pipeline. Swap REFERENCE_IMAGE, OBJECT_NAME, and PROMPTS. The rest is generic.
