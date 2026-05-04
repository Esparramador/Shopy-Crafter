# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform utilizing a Dual AI Engine (Gemini + Claude) named "ShopyBrain." It delivers AI-driven insights, automation, product and image creation, SEO, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven e-commerce solution, expanding to various platforms to offer extensive agency-level services that enhance client ROI and drive business growth through advanced AI capabilities.

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
"ShopyBrain" is the central mega-brain, a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. A centralized model registry allows administrators to change which Claude/Gemini model powers each task tier. Critical actions validate path whitelists, block sensitive files, and require explicit confirmation. All routes with AI operations feed `learnFromOperation` — suppliers research, brand-kit extraction, card generation/auto-design, character creation, and product enrichment all teach the brain retroactively.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Advanced Financial Intelligence provides break-even units, LTV 12-month estimation, LTV/CAC ratio, supply chain risk assessment, and defensive moat strategy, all powered by Claude. A/B Testing tracks visitors only on visit events. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, Gallery, and Multi-Platform Video Generation (11 models). Image generation supports 11 engines with per-generation engine selector override. AI prompt enhancement is available on all text inputs across FusionStudio and FusionStudioPro. Gemini 403 errors are handled via circuit breaker with automatic Claude fallback.

### Cinematic Ad Templates & Knowledge Bases
A permanent in-platform library of 6 master cinematic ad templates with structured segments and configuration. Five knowledge base modules cover Cinematic, Advertising Playbook, Campaign Production, Exploded View, and COGS Methodology. All KB data is exposed via REST endpoints and injected into `buildShopyBrainContext` for relevant AI tasks, with query-aware injection.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered recommendations. Landing form pre-reports include Gemini-powered business/market/SEO research, Claude-extracted MarketMetrics, a niche-aware Capabilities Section, and AI-generated product photos. Reports are emailed via Gmail integration. A centralized "Bóveda Global" stores reports, images, and research as JSON metadata and renders them through `buildBrandedHtmlFromMetadata()`. Template Studio allows visual editing of custom report templates. The platform supports multi-sheet XLSX, premium dark-themed PowerPoint, dead cost identification, and PDF rendering.

### Web Lab UX
The default tab is "💻 CSS Real Generado" with prominent CTA banner for generated CSS, direct copy/download buttons, and an updated tab order (`css → preview → edit → summary → html`).

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, full store setup automation, and launching brand ad campaigns. An Engine Selector (Auto/Claude/Gemini/Brain) lets users choose which AI engine processes their query. Multi-file upload is supported across the chatbot and `/shopybrain/upload` endpoint.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Prompt Lab (Fusion Studio Pro)
A power-user tab in Fusion Studio Pro for crafting and reusing professional prompts across 12 creation intents. It allows users to combine deterministic presets, refine prompts via Claude, edit output, and save to a persistent navigable library.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation. ACL is project-scoped and centralized.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Virtual Try-On (Fashion + Accessories)
Provides virtual try-on functionalities for fashion items using `cuuupid/idm-vton` on Replicate and for accessories using `google/nano-banana` for multi-image fusion. An auto-model feature generates a model photo if not provided.

### Super Ad Studio
A feature for generic brand ad creation, porting the `hanakaze-v2-super` script. It includes an async worker pipeline for video clips (image-to-video/text-to-video), ElevenLabs TTS and music integration, and MP4 concatenation. The UI provides a 5-step wizard for brief, references, editable storyboard generation, voice/music selection, and final generation with live polling and download. Supports cinematic long-form ads up to 30 minutes with parallel processing, multi-block music, and a Cinematic Director for narrative planning. Deterministic Brand & CTA Overlay uses FFmpeg `drawtext` for precise text rendering.

### Hanakaze Cascade v3
A pipeline for generating 8-clip 60s vertical 9:16 ads with specific intro, reveal, deconstruction, try-on, and outro segments, including voice-off and music. It includes strict prompt fidelity rules for try-on clips, text overlay post-processing via FFmpeg `drawtext`, and maximum quality encoding.

### Audio Cap, Text Preservation & Locked-Shot Mode
Ensures audio tracks precisely match video duration, preserves existing printed text/logos on products while preventing AI from generating new text, and introduces a "locked-shot" mode for byte-perfect visual continuity.

### Brand Kit Extractor + Deterministic Brand Overlay
A new `lib/brand-overlay.ts` engine applies branding after video muxing using FFmpeg `drawtext` and PNG logo overlay. `lib/brand-kit-extractor.ts` uses Claude Vision OCR to extract brand details from uploaded files. An API allows extraction and preview of brand overlay on videos.

### Premium Image Endpoints
Specialized endpoints offer infographic generation with AI or overlay text rendering modes, ensuring perfect spelling. A universal virtual try-on feature fuses model and product images using Gemini, preserving identity and product appearance.

### Card Studio (Tarjetas profesionales 300 DPI)
Provides a backend for business card generation with 6 templates, QR code generation, and rendering via Puppeteer for high-DPI printable output. It includes an admin-only API for managing cards, an auto-design feature using Claude, and a frontend editor with live preview.

### Vault & Web Lab Hardening
Ensures reliable storage and download of content in the vault. The Web Lab module allows users to edit and generate HTML/CSS from scratch with secure iframe previews and enriched design signal extraction.

### Gemini 403 Circuit Breaker & Claude Fallback
All AI endpoints that use Gemini Search grounding check `isGeminiSearchBlocked()` before calling Gemini. When blocked, they automatically switch to Claude-only mode. Affected endpoints: Competitor Auto-Discover, Comparative Reports, Intelligence Analyze. The comparative report Gemini call is wrapped in try/catch to ensure Claude fallback fires on any Gemini error.

### SSRF Protection (isSafePublicUrl)
URL validation blocks private IPv4, link-local, CGN, benchmarking, all IPv6 addresses, bracket-wrapped hosts, `.onion` domains, and single-label hostnames.

### Progressive Competitor Knowledge
Competitor scan endpoints inject `previousSnaps` history from prior snapshots into AI prompts, enabling progressive knowledge accumulation across scans.

### Navigation & CMS-Driven Sidebar (NO HARDCODES)
The CMS is the **sole source of truth** for all navigation. No merge-with-defaults or force-injection of hardcoded items. Three nav arrays in CMS (`adminNav.modules`, `adminNav.shopybrain`, `adminNav.admin`) are rendered as-is. Hardcoded defaults in `AppLayout.tsx` are used ONLY as pre-load fallbacks (before CMS data arrives); once CMS loads, its arrays are used verbatim — even empty arrays are respected. The CMSEditor provides full CRUD for all nav items (add/remove/reorder/edit) via `NavSectionEditor` components. SSE live updates via `/api/cms/events` push changes in real-time. The SSE connection is gated on `ready` state to avoid reconnect loops for unauthenticated users.

### Standalone Module Routes (Project-Independent)
ALL 17 modules have standalone routes (`/audit`, `/redesign`, `/images`, `/web-lab`, `/ad-studio`, `/campaign-kit`, etc.) that work without an active project (projectId=0). The module tabs bar is always visible — when a project is active, tabs link to `/projects/:id/{module}`, otherwise to `/{module}`. This allows full content generation, analysis, video creation, and campaign building independently of any project.

**Backend projectId=0 support**: Both `requireProjectAccess` middlewares (`lib/access.ts` and `lib/auth.ts`) allow projectId=0 through without access checks. All 9 `canAccessProject` calls in `vault.ts` have `projectId !== 0 &&` bypass. 3 image endpoints in `fs-pro.ts` use `isNaN(projectId)` instead of `!projectId`. GET/load endpoints return empty data for projectId=0. POST action endpoints (vault save-report, web-lab save-edit, generate-from-scratch) all work with projectId=0, saving to the vault with projectId=0. Frontend guards in WebLab (including "Crear desde cero" and "Historial" buttons), FusionStudio, AvatarStudio, and Suppliers use `=== undefined || === null` checks instead of falsy checks to allow 0 as a valid value.

### A/B Testing Auto-Declaration
When tracking events push confidence to ≥95%, the backend (`ab-testing.ts` track endpoint) automatically declares the winner, sets status to "completed", and logs the result to ShopyBrain via `learnFromOperation`. Manual declaration via "Gana A/B" buttons remains available for tests that haven't auto-completed.

### ProjectVault Preview
The Eye (preview) button in ProjectVault list view now shows for ALL files that have a `previewUrl`, `downloadUrl`, or `originalUrl` — not just report files. This matches GlobalVault behavior.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image and video generation.
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.
- **Runway**: For video generation.
- **ElevenLabs**: For voice synthesis and music generation. Auto-chunks text >5000 chars at sentence boundaries, concatenates audio buffers. Content-Type validation rejects non-audio API responses.