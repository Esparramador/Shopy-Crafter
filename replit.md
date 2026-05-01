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