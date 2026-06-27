---
name: Comedian video pipeline — 2 correct pipelines in YouTube Studio
description: Pipeline A (Seedance parallel) and Pipeline B (reference video + TTS replace + frame face-swap) for comedian monologue videos with Sevillano voice
---

## Two correct pipelines in Modelo IA tab

### Pipeline A — Generate from scratch (no reference needed)
- 3 clips Seedance I2V in PARALLEL (bytedance/seedance-1-lite, 10s each)
- Comedy stage prompts: "Spanish stand-up comedian on dark comedy club stage, warm amber spotlight, microphone stand, animated gestures"
- Poll all 3 in parallel (Promise.all with polling every 8s)
- Concatenate with ffmpeg (loop list to cover audio duration)
- TTS Sevillano: stability=0.12, similarity_boost=0.95, style=0.72, speed=0.87
- Backend endpoint: POST /youtube/modelo/comedian-gen { script, voiceId }
- Frontend mode: modeloRefMode === "generate" (or "search")

### Pipeline B — Reference video + voice replace + face-swap
- User uploads clip (Leo Harlem, etc.) via file picker (YouTube download blocked)
- TTS Sevillano generated first (same settings as above)
- ffmpeg: replace audio on reference video with TTS (stream_loop 5 for looping)
- Frame-by-frame face-swap:
  - Extract at 4fps: `ffmpeg -i video.mp4 -vf fps=4 frame_%05d.jpg`
  - codeplugtech/face-swap version: 278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34
  - inputs: swap_image = Sevillano photo URL, input_image = frame as data URI
  - Batches of 12 in parallel, poll every 2.5s, max 18 attempts
  - Reconstruct at 4fps: `ffmpeg -framerate 4 -i swapped/frame_%05d.jpg faceswapped.mp4`
  - Merge with TTS audio
- Backend endpoint: POST /youtube/modelo/reference-pipeline { referenceVideoB64, voiceId, script, doFaceSwap }
- Frontend mode: modeloRefMode === "local"

## What ElevenLabs Dubbing ACTUALLY does
- ElevenLabs Dubbing = replaces AUDIO of a video (translates/voices-over the speech)
- Returns FULL VIDEO with new audio track (video track unchanged)
- Does NOT do face swap
- NOT used in the current pipeline (TTS + ffmpeg replace audio is simpler and works)

## Key constraints
- YouTube download is blocked by bot detection from server IPs → user must upload videos manually
- codeplugtech/face-swap is IMAGE only (no direct video face-swap model found)
- Video face-swap = frame-by-frame using image model → 4fps extraction for feasible timing
- 30s clip at 4fps = 120 frames, batches of 12 = 10 batches × ~20s = ~3-4 min total

**Why:** ElevenLabs Dubbing ≠ face-swap. User needs to provide reference video manually since YT download is blocked. The frame-by-frame approach at 4fps is the practical video face-swap solution available.
