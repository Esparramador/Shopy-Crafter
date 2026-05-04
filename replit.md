# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform featuring a Dual AI Engine (Gemini + Claude) named "ShopyBrain." It provides AI-driven insights, automation, product and image creation, SEO, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven e-commerce solution, expanding to various platforms to offer extensive agency-level services that enhance client ROI and drive business growth through advanced AI capabilities.

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
"ShopyBrain" is the central mega-brain, a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. A centralized model registry allows administrators to change which Claude/Gemini model powers each task tier. Critical actions validate path whitelists, block sensitive files, and require explicit confirmation. All routes with AI operations feed `learnFromOperation`, enabling retroactive learning. Gemini 403 errors are handled via circuit breaker with automatic Claude fallback.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Advanced Financial Intelligence provides break-even units, LTV 12-month estimation, LTV/CAC ratio, supply chain risk assessment, and defensive moat strategy, all powered by Claude. A/B Testing tracks visitors only on visit events. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, Gallery, and Multi-Platform Video Generation (11 models).

### Cinematic Ad Templates & Knowledge Bases
A permanent in-platform library of 6 master cinematic ad templates with structured segments and configuration. Five knowledge base modules cover Cinematic, Advertising Playbook, Campaign Production, Exploded View, and COGS Methodology. All KB data is exposed via REST endpoints and injected into `buildShopyBrainContext` for relevant AI tasks, with query-aware injection.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered recommendations. Landing form pre-reports use Claude (Anthropic) as the sole AI engine with real web scraping of the lead's URL. Reports include Claude-extracted MarketMetrics, a niche-aware Capabilities Section, supplier analysis, and AI-generated product photos. Reports are emailed via Gmail integration. A centralized "Bóveda Global" stores reports, images, and research as JSON metadata and renders them through `buildBrandedHtmlFromMetadata()`. Template Studio allows visual editing of custom report templates. The platform supports multi-sheet XLSX, premium dark-themed PowerPoint, dead cost identification, and PDF rendering.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, full store setup automation, and launching brand ad campaigns. An Engine Selector (Auto/Claude/Gemini/Brain) lets users choose which AI engine processes their query. Multi-file upload is supported. Brain mode now synthesizes accumulated memories through Claude for intelligent, conversational responses instead of dumping raw memory text.

### Draggable Floating Buttons
All three floating UI elements (OmniChatbot button, VoiceButton, OnboardingWidget) are draggable via a shared `useDraggable` hook (`src/hooks/use-draggable.ts`). Positions persist in localStorage with keys `drag_chatbot`, `drag_voicebtn`, `drag_onboarding`. The OnboardingWidget is draggable only from its header bar to preserve scroll/click behavior in the step list. Click-vs-drag is handled via a `wasDragged` flag with 200ms timeout to prevent accidental clicks after dragging.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Prompt Lab (Fusion Studio Pro)
A power-user tab in Fusion Studio Pro for crafting and reusing professional prompts across 12 creation intents. It allows users to combine deterministic presets, refine prompts via Claude, edit output, and save to a persistent navigable library.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation. ACL is project-scoped and centralized. SSRF protection is implemented via URL validation (`isSafePublicUrl`).

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Virtual Try-On (Fashion + Accessories)
Provides virtual try-on functionalities for fashion items using `cuuupid/idm-vton` on Replicate and for accessories using `google/nano-banana` for multi-image fusion. An auto-model feature generates a model photo if not provided.

### Super Ad Studio
A feature for generic brand ad creation, porting the `hanakaze-v2-super` script. It includes an async worker pipeline for video clips (image-to-video/text-to-video), ElevenLabs TTS and music integration, and MP4 concatenation. The UI provides a 5-step wizard for brief, references, editable storyboard generation, voice/music selection, and final generation with live polling and download. Supports cinematic long-form ads up to 30 minutes with parallel processing, multi-block music, and a Cinematic Director for narrative planning. Deterministic Brand & CTA Overlay uses FFmpeg `drawtext`.

### Hanakaze Cascade v3
A pipeline for generating 8-clip 60s vertical 9:16 ads with specific intro, reveal, deconstruction, try-on, and outro segments, including voice-off and music. It includes strict prompt fidelity rules for try-on clips, text overlay post-processing via FFmpeg `drawtext`, and maximum quality encoding. Audio Cap, Text Preservation, and Locked-Shot Mode ensure audio tracks match video duration, preserve existing text/logos, and provide byte-perfect visual continuity.

### Brand Kit Extractor + Deterministic Brand Overlay
A `lib/brand-overlay.ts` engine applies branding after video muxing using FFmpeg `drawtext` and PNG logo overlay. `lib/brand-kit-extractor.ts` uses Claude Vision OCR to extract brand details from uploaded files. An API allows extraction and preview of brand overlay on videos.

### Premium Image Endpoints
Specialized endpoints offer infographic generation with AI or overlay text rendering modes, ensuring perfect spelling. A universal virtual try-on feature fuses model and product images using Gemini, preserving identity and product appearance.

### Card Studio (Tarjetas profesionales 300 DPI)
Provides a backend for business card generation with 6 templates, QR code generation, and rendering via Puppeteer for high-DPI printable output. It includes an admin-only API for managing cards, an auto-design feature using Claude, and a frontend editor with live preview.

### Standalone Module Routes (Project-Independent)
All 17 modules have standalone routes (`/audit`, `/redesign`, `/images`, etc.) that work without an active project (projectId=0). This allows full content generation, analysis, video creation, and campaign building independently of any project. Backend and frontend logic support `projectId=0` for module operations and vault saving.

### Onboarding Widget (Dynamic, Project-Aware)
The OnboardingWidget is fully dynamic, querying real tables for progress and completion status. It accepts `?projectId=X` to scope metrics and detects the active project from the URL.

### A/B Testing Auto-Declaration
When tracking events push confidence to ≥95%, the backend automatically declares the winner, sets status to "completed", and logs the result to ShopyBrain via `learnFromOperation`.

### Pricing Module (12 Backend Endpoints)
A complete pricing intelligence module at `/api/pricing/*` with 12 flat endpoints:
- `GET /products` — lists all products with ShopifyProduct format including COGS data
- `GET /kpis` — aggregated pricing KPIs (totalProducts, productsWithCOGS, avgMarginPct, etc.)
- `POST /classify-product` — AI classification of product type via Claude
- `POST /estimate-cogs` — AI-powered COGS estimation with detailed breakdown, warnings, and assumptions
- `POST /estimate-cogs/batch` — batch COGS estimation with in-memory job tracking and cancellation
- `GET /batch-progress/:jobId` — poll batch job status
- `POST /batch-cancel/:jobId` — cancel running batch job
- `PATCH /cogs/:productId` — save/update manual COGS data (Spanish field names mapped to DB English fields)
- `POST /simulate` — pure-math pricing simulation with sensitivity curve
- `POST /optimize` — AI-powered pricing optimization via Claude
- `PATCH /apply` — apply new price to Shopify via `updateStoreProduct`
- `POST /ab-test` — create A/B price test
Helper functions handle Spanish↔English field mapping (COGSData), batch job lifecycle with `finally` cleanup, and `resolveProjectId` for admin-only project context.

### Supplier Intelligence (Premium Dark Redesign)
The Suppliers page (`/projects/:id/suppliers`) uses a premium dark luxury design with:
- Dark background (#0a0e1a), card panels (#0f172a), teal accents (#14b8a6)
- "SUPPLIER INTELLIGENCE · v2.0" header badge
- Multi-source search bar with source chips (Google, Bing, DuckDuckGo, Instagram, Shopify Stores)
- 4 KPI cards with colored left borders (proveedores, precio promedio, score, búsquedas)
- Comparison table with sortable columns (score/price/name)
- Top suppliers ranking with score bars
- AI Insight panel with best supplier highlight and price range analysis
- Professional report export section (HTML active, Excel/PPT coming soon)
- Search history with persistent memory timeline

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