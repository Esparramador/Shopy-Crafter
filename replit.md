# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform utilizing a Dual AI Engine (Gemini + Claude) named "ShopyBrain." It delivers AI-driven insights, automation, product and image creation, SEO, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven e-commerce solution, expanding to various platforms to offer extensive agency-level services that enhance client ROI and drive business growth through advanced AI capabilities.

## User Preferences
- Admin email: via `ADMIN_EMAIL` env var (default: craftershopy@gmail.com)
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
"ShopyBrain" is the central mega-brain, a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. A centralized model registry allows administrators to change which Claude/Gemini model powers each task tier. Critical actions validate path whitelists, block sensitive files, and require explicit confirmation. All routes with AI operations feed `learnFromOperation`, enabling retroactive learning. Gemini Search Grounding 403 errors are handled via circuit breaker with automatic Claude fallback.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Advanced Financial Intelligence provides break-even units, LTV 12-month estimation, LTV/CAC ratio, supply chain risk assessment, and defensive moat strategy, powered by Claude. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, Gallery, and Multi-Platform Video Generation.

### Ad Audio Pipeline
Voiceovers for ads are broadcast-grade, with copy length tied to duration, two-stage loudness normalization, and music ducking via sidechain compression. FFmpeg filter graphs use `asplit` for stream reuse.

### Vault Download URLs
Final MP4s from various ad generation endpoints are persisted to the vault, with playable URLs returned via `/api/projects/:projectId/vault/:fileId/download`.

### Long-Running Endpoint Heartbeat
The `enableLongRunning(res)` helper maintains connections for slow AI calls by sending heartbeat characters. It gracefully handles `Content-Type` for JSON and binary downloads.

### Pricing Endpoints
AI-pricing endpoints (COGS estimation and optimal price calculation) are optimized for speed and resilience, minimizing Claude calls and handling Gemini fallbacks.

### Cinematic Ad Templates & Knowledge Bases
A permanent in-platform library of 6 master cinematic ad templates and five knowledge base modules covering Cinematic, Advertising Playbook, Campaign Production, Exploded View, and COGS Methodology. KB data is exposed via REST and injected into `buildShopyBrainContext` for AI tasks.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered recommendations. Reports are emailed via Gmail, stored in a centralized "Bóveda Global," and rendered through `buildBrandedHtmlFromMetadata()`. Template Studio allows visual editing of custom report templates. Supports multi-sheet XLSX, premium dark-themed PowerPoint, dead cost identification, and PDF rendering.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, full store setup automation, and launching brand ad campaigns. An Engine Selector allows users to choose the AI engine. Multi-file upload is supported, and "Brain mode" synthesizes accumulated memories for intelligent responses.

### Draggable Floating Buttons
Floating UI elements (OmniChatbot, VoiceButton, OnboardingWidget) are draggable via `useDraggable` hook, with positions persisting in localStorage.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Utilizes Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Prompt Lab (Fusion Studio Pro)
A power-user tab in Fusion Studio Pro for crafting and reusing professional prompts across 12 creation intents. It allows combining deterministic presets, refining prompts via Claude, editing output, and saving to a persistent navigable library.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization, PostMessage origin validation, and robust input validation. ACL is project-scoped and centralized. SSRF protection is implemented via URL validation (`isSafePublicUrl`).

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Virtual Try-On
Provides virtual try-on functionalities for fashion items using `cuuupid/idm-vton` on Replicate and for accessories using `google/nano-banana` for multi-image fusion. An auto-model feature generates a model photo if not provided.

### Super Ad Studio
A feature for generic brand ad creation, utilizing an async worker pipeline for video clips, ElevenLabs TTS and music integration, and MP4 concatenation. The UI provides a 5-step wizard for brief, references, editable storyboard generation, voice/music selection, and final generation with live polling and download. Supports cinematic long-form ads with parallel processing, multi-block music, and a Cinematic Director. Deterministic Brand & CTA Overlay uses FFmpeg `drawtext`.

### Hanakaze Cascade v3
A pipeline for generating 8-clip 60s vertical 9:16 ads with specific segments, including voice-off and music. It includes strict prompt fidelity rules for try-on clips, text overlay post-processing, and maximum quality encoding. Audio Cap, Text Preservation, and Locked-Shot Mode ensure audio tracks match video duration, preserve existing text/logos, and provide byte-perfect visual continuity.

### Brand Kit Extractor + Deterministic Brand Overlay
A `lib/brand-overlay.ts` engine applies branding after video muxing using FFmpeg `drawtext` and PNG logo overlay. `lib/brand-kit-extractor.ts` uses Claude Vision OCR to extract brand details from uploaded files.

### Premium Image Endpoints
Specialized endpoints offer infographic generation with AI or overlay text rendering modes. A universal virtual try-on feature fuses model and product images using Gemini.

### Card Studio (Tarjetas profesionales 300 DPI)
Provides a backend for business card generation with 6 templates, QR code generation, and rendering via Puppeteer for high-DPI printable output. It includes an admin-only API for managing cards, an auto-design feature using Claude, and a frontend editor with live preview. Frontend supports 8 AI background engines.

### Standalone Module Routes
All 17 modules have standalone routes that work without an active project (`projectId=0`), allowing full content generation, analysis, video creation, and campaign building independently of any project.

### Onboarding Widget
The OnboardingWidget is fully dynamic, querying real tables for progress and completion status. It accepts `?projectId=X` to scope metrics and detects the active project from the URL.

### A/B Testing Auto-Declaration
When tracking events push confidence to ≥95%, the backend automatically declares the winner, sets status to "completed", and logs the result to ShopyBrain via `learnFromOperation`.

### A/B Testing Module v2.0 (Redesigned)
Located at `/projects/:id/ab-testing` (artifacts/shopify-optimizer/src/pages/projects/ab-testing/). Replaces the old hollow form with:
- **Real KPI dashboard**: active tests, completion rate, win rate, avg confidence, 30-day revenue impact (computed from `abTestsTable`).
- **Image Test Wizard**: Claude Vision analyzes the uploaded reference (scores 0-100, warnings/strengths/suggestions). Nano-Banana generates 4 stylistic variants (lifestyle/studio/context/detail) with `STYLE_PROMPTS`. Variants are returned as base64 dataURLs (no object-storage migration required); flagged as a known limitation for production payload size — to upgrade later, route through `objectStorage.ts` and persist URLs.
- **Price Test Wizard**: honest competitor analysis (`source: "ai_estimate"` with reasoning, NO fake scraping/URLs), real supplier impact from `supplierEntriesTable`, Claude price recommendations (conservative/optimal/aggressive) using real COGS and break-even.
- **Lifecycle endpoints**: start/pause/resume/cancel/stats/report on `:testId`.
- **No hardcodes**: `targetDays` derives from testType (image=14, price=21); annual sales volume in supplier-impact is extrapolated from real `track_events` purchases for tests of this product (last 90d × 4) and returned as `null` with explanatory `annualVolumeBasis` if no data exists.
- **Security**: `isPublicHttpUrl` SSRF guard blocks loopback/private/link-local hosts and forbids redirects on every outbound image fetch.
- **Performance**: `_active` batches product+COGS lookups into Maps to avoid N+1; `shapeABTest` accepts an optional context with the prefetched maps.
- **Routing fix**: the prior `GET /:testId` route now calls `next()` when the param is non-numeric or starts with `_`, so `/_kpis`, `/_active`, `/_history`, `/_products` reach their intended handlers without conflict.
- **Real HTML report generation**: `POST /:testId/report` now writes a self-contained branded HTML report to `public/reports/ab-test-<id>-<ts>.html` and returns `{ reportUrl: "/api/reports/..." }`. Uses Claude (`askClaudeJsonWithBrain`) for executive narrative with deterministic fallback if AI fails. Report is print-to-PDF ready. The "Reporte" button in `ActiveTestCard` opens the URL in a new tab and throws on empty URL or popup-block (no silent fail).
- **Per-project report ACL**: `reportAuth` middleware in `app.ts` parses the `testId` out of `ab-test-<id>-<ts>.html`, looks up its `projectId`, and gates access via `canAccessProject`. Non-AB report files keep the original login-only check so existing audits (`comic-crafter-audit-2026.html`, etc.) still work. Validated: admin sees 200, anon 403, unknown id 404.

### Pricing Module
A complete pricing intelligence module at `/api/pricing/*` with 12 flat endpoints for product listing, KPIs, AI classification, COGS estimation (single and batch), batch job management, manual COGS updates, pricing simulation, AI optimization, Shopify price application, and A/B test creation.

### Supplier Intelligence
The Suppliers page (`/projects/:id/suppliers`) features a premium dark luxury design with multi-source search, KPI cards, a comparison table, top suppliers ranking, and an AI Insight panel.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image and video generation.
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails.
- **@google/genai**: For direct Gemini API integration.
- **Runway**: For video generation.
- **ElevenLabs**: For voice synthesis and music generation.