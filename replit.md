# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform that leverages a Dual AI Engine (Gemini + Claude) called "ShopyBrain." It provides AI-driven insights, automation, product and image creation, SEO, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven e-commerce solution, expanding to various platforms to offer extensive agency-level services that enhance client ROI and drive business growth through advanced AI capabilities.

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
"ShopyBrain" is a central Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains extensive knowledge insights and chatbot actions. A centralized model registry allows administrators to change which Claude/Gemini model powers each task tier. Critical actions validate path whitelists, block sensitive files, and require explicit confirmation. All routes with AI operations feed `learnFromOperation` for retroactive learning. Gemini Search Grounding errors are handled via circuit breaker with automatic Claude fallback.

### Generation Engine Catalog (Fusion Studio Pro)
Centralized in `artifacts/api-server/src/lib/fusion-studio-pro.ts`, this catalog exposes a variety of IMAGE_MODELS (e.g., flux-1.1-pro-ultra, ideogram-v3-turbo, nano-banana), IMAGE_EDIT_MODELS, and VIDEO_MODELS (e.g., runway-gen4-turbo, veo-3.1, sora-2, kling-master). Nano Banana models use direct Gemini API with automatic Replicate fallback.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Advanced Financial Intelligence provides break-even units, LTV 12-month estimation, LTV/CAC ratio, supply chain risk assessment, and defensive moat strategy, powered by Claude. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, Gallery, and Multi-Platform Video Generation.

### Ad Audio Pipeline
Voiceovers for ads are broadcast-grade, with copy length tied to duration, two-stage loudness normalization, and music ducking via sidechain compression, utilizing FFmpeg filter graphs.

### Intelligent Per-Scene Lip-Sync
The cinematic multishot renderer tags scenes (`presenter` | `b_roll` | `product`). A continuous ElevenLabs voiceover is generated and sliced per-scene. `presenter` shots are sent to Replicate `cudanexus/lipsync-v2` for lip-sync, while `b_roll` or `product` shots play the voiceover as-is. This provides organic transitions. The orchestrator (`applyPerSceneLipSync`) is fail-soft per clip.

### Long-Running Endpoint Heartbeat
The `enableLongRunning(res)` helper maintains connections for slow AI calls by sending heartbeat characters and handles `Content-Type` for JSON and binary downloads.

### Pricing Endpoints
AI-pricing endpoints for COGS estimation and optimal price calculation are optimized for speed and resilience, minimizing Claude calls and handling Gemini fallbacks.

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
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization, PostMessage origin validation, robust input validation, project-scoped ACL, and SSRF protection via URL validation.

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
Provides a backend for business card generation with 6 templates, QR code generation, and rendering via Puppeteer for high-DPI printable output. It includes an admin-only API for managing cards, an auto-design feature using Claude, and a frontend editor with live preview supporting 8 AI background engines.

**v2 — Renderer absolute-positioned + visual editor (2026-05):**
- Pipeline rewritten around `lib/card-elements.ts` (typed `RenderElement` model with reserved IDs per side: front=`logo|company|name|title|line|tagline`, back=`qr|qrLabel|brand|email|phone|web|social|address`). Layouts (`centered|left|grid`) produce defaults at 1080×720 px (= 91×61mm with 3mm bleed @ 300 DPI), 84px (~7mm) safe inset.
- `lib/card-renderer.ts` now positions every element absolutely; on `ai-texture` backgrounds it auto-applies a black contrast plate (50% opacity + 6px radius padding) plus text-shadow and a radial vignette for guaranteed legibility. Long text auto-shrinks via Puppeteer DOM-pass `data-autoshrink="1"`. AI background prompt hardened with `ABSOLUTELY NO TEXT…` clause + extended negative prompt.
- DB: `business_cards.layout_overrides text NOT NULL DEFAULT '{}'` stores `{ front?, back?, extras? }`. Routes: `PATCH /cards/:id` accepts `layoutOverrides`; `GET /cards/:id/elements?side=front|back` returns the resolved element list (defaults+overrides+extras) for the editor; `POST /cards/:id/generate` re-uses overrides automatically.
- Frontend `CardStudioEditor.tsx`: modal opened from "Editor" button on the preview panel. Drag any element on a zoomed 1080×720 stage with safe-zone outline; per-element panel for text/font-size/color/alignment/X/Y/width; "Añadir texto" creates extras; per-side reset; "Guardar" persists overrides; "Re-renderizar" saves + invokes generate.

### Standalone Module Routes
All 17 modules have standalone routes that work without an active project (`projectId=0`), allowing full content generation, analysis, video creation, and campaign building independently of any project.

### Onboarding Widget
The OnboardingWidget is fully dynamic, querying real tables for progress and completion status. It accepts `?projectId=X` to scope metrics and detects the active project from the URL.

### A/B Testing Auto-Declaration
When tracking events push confidence to ≥95%, the backend automatically declares the winner, sets status to "completed", and logs the result to ShopyBrain via `learnFromOperation`.

### A/B Testing Module v2.0 (Redesigned)
This module at `/projects/:id/ab-testing` provides a real KPI dashboard, an Image Test Wizard (Claude Vision analysis, Nano-Banana generation of 4 stylistic variants), and a Price Test Wizard (competitor analysis, supplier impact, Claude price recommendations). It includes lifecycle endpoints for tests, dynamic target days, SSRF protection, performance optimizations, and real HTML report generation. Access control for reports is project-scoped.

**v2.1 hardening (forecast + first-try reliability):**
- `withRetry(fn, attempts=3, baseDelayMs=900, label)` helper in `routes/ab-testing.ts` wraps Claude calls in `/price/competitors`, `/price/recommend`, and `/price/forecast` with exponential backoff to eliminate first-try 5xx from transient Claude failures.
- `/price/supplier-impact` always returns `potentialSavingsAnnual` as a number (0 when no purchase volume) plus `annualVolumeBasis` string; frontend `SupplierPanel` shows "—" when 0.
- New endpoint `POST /api/projects/:projectId/ab-tests/price/forecast`: pulls real 90d traffic from `trackEvents` (when available) or uses category heuristic, then asks Claude (with retry, label `forecast`) for a 12-month projection comparing A vs B (monthly/annual revenue+margin per variant, delta12m, breakEvenWeeks, riskLevel, confidence, summary, assumptions, recommendation). Strict numeric input validation (`Number.isFinite` + `>0`) and per-field sanitization with deterministic elasticity=-1.2 fallback guarantee no NaN/5xx.
- PriceTestWizard step 4 ("Lanzar") auto-fetches the forecast on entry (effect gated by `!forecastError` to prevent retry loops) and renders a `ForecastBlock` card with revenue projection, margin delta, elasticity, risk/confidence badges, executive summary, recommendation, and collapsible assumptions list. All forecast hooks declared before the `if (!open) return null` early-return to comply with Rules of Hooks.

### Pricing Module
A complete pricing intelligence module at `/api/pricing/*` with 12 flat endpoints for product listing, KPIs, AI classification, COGS estimation, batch job management, manual COGS updates, pricing simulation, AI optimization, Shopify price application, and A/B test creation.

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

## Knowledge Archives
- **`docs/knowledge/hanakaze-pipeline/`** — Curated methodology for producing premium 30–60s vertical (9:16) video ad campaigns. Distills the v1→v3 Hanakaze pipeline: 8-clip narrative structure, kling-master + seedance-pro engine mix (~$10–12 per 60s spot), hard prompting rules (identity lock, no AI typography, explicit timeline blocks), and 5 robustness patterns for resumable client↔server pipelines on Replit (raw http.request without timeouts, persistent state, vault pre-flight scan, polling fallback, public URL rehydration). The original runner scripts are archived as `*.mjs.txt` (read-only reference; the runtime workflow was removed because it required project-specific admin credentials). Shopy Brain should consult `KNOWLEDGE.md` whenever the user requests a video ad campaign.