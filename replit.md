# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform that uses a Dual AI Engine (Gemini + Claude) called "ShopyBrain" for comprehensive e-commerce optimization. It provides AI-driven insights, automation, product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven solution for e-commerce, expanding across various platforms and offering extensive agency-level services to improve client ROI.

## User Preferences
- Admin email: via `ADMIN_EMAIL` env var (default: sadiagiljoan@gmail.com)
- Admin password: via `ADMIN_PASSWORD` secret (no hardcoded fallback; generates random in dev if unset)
- Design: gold/black/jade premium dark theme
- Language: Spanish (UI), code in English
- Zero mocked data — all real
- Shopify billing (not Stripe) — generates checkout links per service/client
- Landing-first routing: unauthenticated → `/` (landing); clients only via `/invite/:token`

## System Architecture
The project is a pnpm workspace monorepo built with TypeScript and Node.js 24, structured into `api-server`, `shopify-optimizer` (React+Vite), and `mockup-sandbox`.

### Design System
A premium dark theme with custom color variables, typography, and a fixed layout featuring a gold gradient topline, sidebar, and topbar. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page includes 7 sections with a fullpage scroll-snap engine on desktop and native scrolling on tablet/mobile.

### Multi-Platform Connector Architecture
An extensible `IPlatformConnector` abstraction layer supports Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with a `ConnectorFactory` for dynamic selection.

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
"ShopyBrain" is the central mega-brain that receives, distributes, and stores all requests and knowledge, injecting accumulated intelligence into every AI call. It's a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. Token limits, anti-truncation mechanisms, and robust rate-limit retry logic are in place. Critical actions like code fixes and UI modifications validate path whitelists, block sensitive files, and require explicit confirmation. Destructive actions are guarded by a centralized confirmation system.

### AI Model Tier System
A centralized model registry allows administrators to change which Claude/Gemini model powers each task tier without code changes. Tiers include `fast`, `smart` (default), `genius`, and `vision`.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, and Gallery features.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered professional recommendations. A centralized "Bóveda Global" stores reports, images, and research. Reports are stored as JSON metadata and rendered through `buildBrandedHtmlFromMetadata()` for consistent branded output. Template Studio allows visual editing of custom report templates.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, and full store setup automation. It also enables launching brand ad campaigns directly from chat.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, including deep web design analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation. ACL is project-scoped and centralized in `lib/access.ts` to prevent cross-tenant data leaks.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Super Ad Studio
A feature for generic brand ad creation, porting the `hanakaze-v2-super` script. It includes an async worker pipeline for video clips (image-to-video/text-to-video), ElevenLabs TTS and music integration, and MP4 concatenation. The UI provides a 5-step wizard for brief, references, editable storyboard generation (Claude), voice/music selection, and final generation with live polling and download. It supports cinematic long-form ads up to 30 minutes with parallel processing, multi-block music, and a Cinematic Director for narrative planning. Product DNA extraction ensures consistent branding across scenes.

#### Deterministic Brand & CTA Overlay (Ad Studio Pro)
Ad Studio Pro generations route brand name and CTA text through an `applyBrandOverlay()` ffmpeg `drawtext` post-processing step (DejaVu Sans Bold, gold #C8A84B for CTA, white for brand, both with black outline + soft shadow), instead of asking the video model to render text in-frame. This eliminates IA typography glitches (garbled letters, melting glyphs).
- **Anti-text prompt guards** (`ANTI_TEXT_AND_FIDELITY` constant) appended to Runway, Kling, Hailuo, and Seedance prompts; Kling additionally receives a `negative_prompt` blocking text/letters/watermarks; Hailuo gets `prompt_optimizer:false`; Replicate model wrapper accepts `URL` objects (not only strings) from the SDK and falls back to the system `ffmpeg` if `ffmpeg-static`'s bundled path is unreachable (esbuild dist resolution).
- **Auto-fit fontsize**: `fitFontSize(text, base)` uses a DejaVu Bold glyph-width coefficient of 0.70 and the probed video width to shrink fontsize so brand and CTA never spill past the 4% lateral safety margin (verified on 1088×1920).
- **UI control**: Step 3 of the AdStudio wizard exposes a `renderBrandOverlay` checkbox (default ON) with a clear safety note. The Step 4 summary badge shows "Sí FFmpeg" / "No riesgo IA" so the user knows whether brand text will be deterministic.
- **Validated end-to-end**: e2e from the SSE endpoint (project Hanakaze, seedance-fast 5s 9:16) produced vault id 1341 with ortografía perfecta of "Hanakaze" intro and "Claim your number now" outro.

#### Brutal Anti-Text-Leak Audit (May 2026 — pre-publish hardening)
After observing IA-rendered "noise text" persisting in finished ads despite the FFmpeg overlay, a full audit identified that the upstream Claude/Gemini prompts were **double-dipping**: feeding brand name, CTA, body copy and prices into the visual video prompt, so the video model would still try to burn that text into frames *underneath* the clean FFmpeg overlay. Fixes shipped:
- **`adstudio.ts` → `buildVisualVideoPrompt(input, copy, cameraLine)`**: new helper that builds the Runway/Replicate video prompt from category, tone and camera line ONLY — `copy.body`, `copy.hook`, `copy.cta`, `brandName`, `productTitle` and price are explicitly excluded. Appends a strong `VIDEO_NEGATIVE_PROMPT` constant ("no text, no letters, no logos, no brand names, no captions, no typography of any kind"). The hero image (Nano Banana) keeps full brand DNA — overlays are post.
- **Telemetry**: every video generation now logs `videoPromptHead` (first 200 chars of the actual prompt sent to the model) plus `brandLeakDetected: boolean` (regex check against brandName/productTitle/cta) so silent regressions surface in `pino` immediately.
- **`product-ads.ts`**: `ctaText` and `price` are no longer concatenated into `customPrompt`; they flow through `ctaOverlayText`/`brandOverlayText` with `renderBrandOverlay:true` instead.
- **`cinematic-multishot.ts`**: the JSON schema description for `keyframePrompt` and `videoPrompt` now says explicitly *"PROHIBIDO mencionar nombres de marca, letras, palabras o CTA"*; "REGLAS DURAS" block enforces ANTI-TEXTO ESTRICTO and per-scene visual continuity (palette/lighting/subject inheritance) so transitions feel cinematic instead of jump-cut.
- **`cinematic-director.ts`**: the BRIEF block re-labels `ctaText` as *"SOLO para voiceoverLine de la última escena, NUNCA para keyframePrompt ni videoPrompt"* and the REGLAS DURAS block adds the same ANTI-TEXTO ESTRICTO + transition-continuity rules.
- **`fusion-studio-pro.ts` → `sanitizeVideoPrompt(raw)`** (exported): centralized regex guard called at the top of `generateVideoFromImage` for **every** provider (Veo, Runway, Replicate). Strips quoted spans, `[BRAND]`/`{{cta}}` placeholders, CTA imperatives (EN+ES: buy now, compra ya, claim yours, hazte con, …), and price tokens (`$19.99`, `19,99 €`); appends an idempotent ANTI_TEXT tail. Belt-and-suspenders so cinematic, hanakaze and ad-hoc briefs cannot regress regardless of upstream changes.
- **`applyBrandOverlay` fail-loud**: throws if the DejaVu font is missing instead of silently shipping an unbranded video. `runAdCampaign` no longer catches and swallows overlay errors — they bubble up as a variant failure with a clear message ("Brand overlay font not installed: …" or "both brandOverlayText and ctaOverlayText sanitized to empty") so the operator never publishes a naked video by mistake.
- **Cinematic-stack hardening (Director + MultiShot)**:
  - `cinematic-director.ts` — replaced "preserva ORTOGRAFÍA exacta" Product DNA leak with a "describe by shape and position, never write the literal text" formulation; the repair prompt for incomplete scenes now embeds the full ANTI-TEXTO ESTRICTO block dynamically with the actual brand and product name; `generateDirectedScript()` ends with a runtime regex scrub that strips quoted spans + `req.brand`, `req.productDNA.productName`, `req.ctaText`, `script.title/cta/hook` from EVERY keyframePrompt and videoPrompt and appends an idempotent anti-text tail (logs `scenesScrubbed` and `forbiddenTokenCount`).
  - `cinematic-multishot.ts` — forbiddenTokens now includes `req.brand + req.productName + req.ctaText + script.title/cta/hook/closingLine` (the original list missed `productName`/`ctaText` for the non-director / preset-script path). Every keyframe call (`generateImage(... cleanKeyframe ...)`) and every video clip call (`generateVideoFromImage(... cleanVideoPrompt ...)`) now passes through `sanitizeVideoPrompt(prompt, forbiddenTokens)` and logs the cleaned `keyframePromptHead`/`videoPromptHead`.
  - `fusion-studio-pro.sanitizeVideoPrompt(raw, forbiddenTokens?)` — exported helper now accepts dynamic forbidden tokens (escaped via internal `escapeRegex`) on top of the static guards (quoted spans, `[BRAND]`/`{{cta}}` placeholders, EN+ES CTA imperatives, prices in $/€/£/¥). Called once inside `generateVideoFromImage` for every provider (Veo, Runway, Replicate) so even ad-hoc / Hanakaze-script prompts are sanitized.
  - `adstudio.buildVisualVideoPrompt()` — now scrubs `productCategory` against the full forbidden list (brandName, productTitle, brandOverlayText, ctaOverlayText, copy.cta/hook/body), scrubs the assembled prompt a second time, and **FAIL-CLOSED** throws "Anti-text-leak gate: forbidden token X survived sanitization" if any token (length >= 3) leaks into the prompt head.
- **Worst-case e2e validated**: input `productCategory="Hanakaze Sakura streetwear premium t-shirt"` (brand stuffed inside category — adversarial). Server log: `videoPromptHead="Cinematic product advertising shot of a Sakura streetwear premium t-shirt. Professional studio lighting, urgent atmosphere, photorealistic."`, `brandLeakDetected:false`, `forbiddenTokenCount:7` — "Hanakaze" stripped before Runway. Result: vault **1349** (1.16 MB, 720×1280 h264+aac, 5.04s) with crisp FFmpeg-drawn brand + CTA overlay and zero hallucinated typography in any frame. Architect re-review: GO for production publish, residual risk LOW–MEDIUM (only short-token semantic edges remain).
- **Round 4 — broadcast-grade legibility for overlays**: The previous overlay relied only on outline + drop shadow, which can fail on bright/high-contrast backgrounds (white shirt, sunlit scenes). `applyBrandOverlay` now adds a **semi-transparent dark backplate** behind every text line using `drawtext box=1 boxcolor=black@0.55 boxborderw=...` for the brand and `box=1 boxcolor=black@0.65 boxborderw=...` for the CTA — same technique used by Reels/Shorts captions, Apple Keynote lower-thirds and Netflix subtitles. Padding scales with font size (`Math.max(8, brandFs*0.35)` / `Math.max(10, ctaFs*0.4)`) so the plate always hugs the text proportionally. Border thickness raised to 3-4 px black @0.9-0.95. Combined effect: legible on any background (dark, bright, busy motion). E2E validated with vault **1350** (54s, 9:16 720×1280) on a black-and-red Sakura ad — both the white "Hanakaze" up top and the gold "Compra ya" lower-third stay crisp and readable through every frame.
- **Audit findings (production go/no-go)**:
  - **Voz/TTS**: ✅ ElevenLabs (`eleven_multilingual_v2`) recibe `hook + body + cta` SIN scrubbing → la voz pronuncia marca y producto verbalmente como debe (en cinematic-multishot recibe los `voiceoverLine` por escena en orden). El anti-leak SOLO afecta a los prompts visuales para que el modelo de video no intente quemar texto en los frames.
  - **Lip-sync**: ✅ Real, vía `cudanexus/lipsync-v2` en Replicate (con fallback `lucataco/wav2lip` y `bytedance/sync-2.0` por env). Wired en AvatarStudio (`generateTalkingAvatar` / `generateProductAvatar`), product-ads `tryon-video` con flag `applyLipSync`, y herramienta manual `POST /fs-pro/lip-sync` desde la UI Fusion Studio Pro tab "Lip-sync".
  - **"Seedance 2.0"**: ⚠️→✅ NO existe como modelo de Bytedance — era una etiqueta de marketing en la UI. Renombrado a "orquestador propio sobre Seedance Pro / Kling / Veo" en el tab Multi-shot. El modelo real bajo el capó es `bytedance/seedance-1-pro` (o `seedance-1-pro-fast` para variantes baratas).
  - **Try-on imagen**: ✅ Real con `cuuupid/idm-vton` (state-of-the-art) para ropa (`upper_body` / `lower_body` / `dresses`). Vía `POST /fusion-studio/generate-photos`.
  - **Try-on video**: ✅ Real para ropa con Kling 2.1 / Kling Master / Hailuo-02 / Runway Gen-4 (4 estilos: `natural_wear`, `magical_dress`, `multishot_outfit_change` exclusivo Kling Master, `lifestyle_use` para cosméticos). Vía `POST /fs-pro/video-tryon`. Para accesorios no-fashion (relojes, gafas, joyería) cae a generación FLUX 1.1 Pro de "modelo sosteniendo/usando el producto" — esto NO es un try-on real sino composición fotorrealista; documentado para evitar over-promise.

#### Nano Banana Multi-Provider (Gemini → Replicate fallback)
- **Single source of truth**: `lib/nano-banana.ts` exports `generateNanoBanana(prompt, opts)` with cascade: tries Google Gemini direct (`gemini-2.5-flash-image`) first; on retryable failures (403 PERMISSION_DENIED, 429 quota, 5xx, network, missing API key) automatically falls back to Replicate's `google/nano-banana` (uses `REPLICATE_API_TOKEN`, accepts `image_input` array for editing/fusion). Safety blocks are NOT retried (legitimate content failures).
- **Refactored call sites**: `lib/adstudio.ts` (Ad Studio Pro hero generation) and `lib/fusion-studio-pro.ts` (Super Ad Studio `generateImage` + `editImage` for `model="nano-banana"`) now both delegate to the helper. The cinematic-multishot pipeline picks up the fallback through fusion-studio-pro automatically.
- **Provider surfaced in API + UI**: `AdAssetPaths.heroImageProvider` ("gemini" | "replicate") and propagated in `/api/ad-studio/generate-campaign` SSE response. The UI shows a small grey badge "Imagen vía Replicate (fallback Nano Banana)" when Gemini failed silently — surfaces a hidden GEMINI_API_KEY problem.
- **Real-world validation**: Discovered the workspace has both `GOOGLE_API_KEY` and `GEMINI_API_KEY` set; Gemini SDK prioritises `GOOGLE_API_KEY` which is invalid (`API_KEY_INVALID`) — this was the root cause of the 403 in the previous e2e. The cascade now transparently routes to Replicate so the pipeline never falls because of this.
- **Circuit breaker**: After a `permission_denied` from Gemini, the helper opens a circuit for 10 min — subsequent calls skip Gemini entirely (saving ~200ms each) and go straight to Replicate. Quota/network/5xx failures are NOT cached (they're transient).
- **Boot warning**: First call logs a `WARN` if both `GOOGLE_API_KEY` and `GEMINI_API_KEY` are set, or if neither is set, surfacing the configuration mistake on day one instead of waiting for the first 403 in production.
- **Project-scoped Replicate token**: `generateHeroImage()` now accepts `projectReplicateToken` so per-project Replicate accounts (used by some clients) can serve as the fallback target without leaking cost to the workspace global token.

### Hanakaze Cascade v3 (final ad)
- Pipeline `scripts/run-hanakaze-v3-cascada.mjs` generates 8-clip 60s vertical 9:16 ad: c01 intro, c02 reveal, c03 deconstruction, c04/c05 try-on, c06 perchero, c07 cascade, c08 outro. Plus voice-off + 60s music. Memoize via `logs/hanakaze-v3-state.json`. Anti-orphan inFlight tracking + PID lock prevents double-spend on Replicate. Admin password is read from `HANAKAZE_ADMIN_PASSWORD` env var (never hardcoded).
- Strict prompt fidelity rules added for try-on clips (c04, c05) and floating-garment clip (c06): garments are described as solid rigid objects that never deconstruct/recolor/redraw mid-frame, eliminating IA distortions of the print and color.
- Text overlay post-processing: `scripts/add-final-text-overlay.mjs` downloads the concat from vault, applies ffmpeg `drawtext` (DejaVu Sans Bold) on intro (3-5s) and outro (last 5s) to render brand text, Instagram handle and tagline as crisp typography — replaces the illegible IA-generated text.
- **Maximum quality encode**: libx264 high@5.1, **crf=14 preset=veryslow** (visually lossless), x264 tunings ref=6 bframes=4 b-adapt=2 rc-lookahead=60 me=umh subme=9 trellis=2 aq-mode=3, audio `-c:a copy` (preserves source AAC bit-perfect when input has aac/mp3, else re-encodes at AAC 320k/48kHz). Optional `UPSCALE_RES=3840` env enables 4K UHD vertical upscale via lanczos+accurate_rnd+full_chroma_int (no detail added — only anti-aliased scaling). Override via `CRF`, `PRESET`, `UPSCALE_RES` env vars.
- **Backend upload limits**: `fs-pro` multer `fileSize` is **500MB** (was 30MB) — supports 4K vertical ~2min at CRF 14. Express body parsers stay at **50MB** to avoid memory-DoS via JSON/urlencoded bombs (large media must use multipart routes only). Drawtext `x` is clamped to `max(margin, min(w-text_w-margin, (w-text_w)/2))` with margin=4% to guarantee text never spills outside the frame.
- Final result: **vault=1340** (60s, 1080x1920, 46MB, CRF 14 visually lossless, audio bit-perfect copy) — clips 1334/1315/1317/1332/1333/1335/1326/1336, voice=1328, music=1329, raw concat=1337, intermediate overlay 1339, **MASTER FHD=1340**.

### Premium Image Endpoints
Specialized endpoints offer infographic generation with AI or overlay text rendering modes, ensuring perfect spelling. A universal virtual try-on feature fuses model and product images using Gemini, preserving identity and product appearance.

### Vault & Web Lab Hardening
Ensures reliable storage and download of content in the vault. The Web Lab module allows users to edit and generate HTML/CSS from scratch with secure iframe previews and enriched design signal extraction. Multi-source research enhances context for generation.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image) and video generation.
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.
- **Runway**: For video generation.
- **ElevenLabs**: For voice synthesis and music generation.