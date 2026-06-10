---
name: Replicate upscaling (image + video)
description: How upscaling is wired through Replicate in Fusion Studio Pro, and the non-obvious rules for adding/maintaining upscale models.
---

Upscaling lives in `fusion-studio-pro.ts` (lib) exposed via `fs-pro.ts` routes and the
EnhanceTab in `FusionStudioPro.tsx`. Image upscaling = real-esrgan / clarity-upscaler /
gfpgan. Video upscaling = topaz (premium) / lucataco real-esrgan-video.

**Rule: verify model input schemas against the live Replicate API before wiring.**
**Why:** field names differ per model and a wrong key fails silently at runtime (violates the
"real, no mocks" requirement). Image vs video upscalers use DIFFERENT field names
(e.g. video field is `video` for topaz but `video_path` for real-esrgan-video; resolution
is `target_resolution` vs `resolution`).
**How to apply:** `GET https://api.replicate.com/v1/models/{owner}/{name}` with the
`REPLICATE_API_TOKEN` env var (it IS set at env level even though not surfaced in the
secrets list; the per-project token comes from `project.replicateApiToken`). Read
`latest_version.openapi_schema.components.schemas.Input.properties`. This is read-only/free.

**Rule: run community models through `replicateRunLatestBuffer`, not `replicateRunBuffer`.**
**Why:** `replicateRunBuffer` calls `rep.run(modelId)` which, without a version, hits the
official-models prediction path — fragile for community models. `replicateRunLatestBuffer`
does `models.get` → `latest_version.id` → `predictions.create({version})` with polling +
timeout, which is reliable for community models and long jobs.
**How to apply:** new community-model integrations (esp. slow ones like video) → use the
latest-version helper with a generous timeout (video upscale uses 20 min).

**Rule: video inputs go through Replicate's Files API, never data-URI.**
**Why:** base64 data-URIs of multi-MB videos bloat the request body and can be rejected.
**How to apply:** `replicateUploadFileUrl` uploads the buffer via `rep.files.create(blob)`
(set `(blob as any).name`) and passes the returned `urls.get` URL as the model input.

Credits: video upscale is charged to the "image" usage pool (the only pools are
`product`|`image`), at 4 credits — matches the generate-video convention.
