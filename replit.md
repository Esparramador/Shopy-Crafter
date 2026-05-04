# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform utilizing a Dual AI Engine (Gemini + Claude) named "ShopyBrain." It offers AI-driven insights, automation, product and image creation, SEO optimization, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven e-commerce solution, expanding across various platforms and providing extensive agency-level services to enhance client ROI and drive business growth through advanced AI capabilities.

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

### Cinematic Ad Templates Library + Knowledge Base
A permanent in-platform library of 6 master cinematic ad templates with structured segments and configuration lives at `artifacts/api-server/src/lib/cinematic-ad-templates.ts`. A second permanent knowledge base at `artifacts/api-server/src/lib/cinematic-knowledge-base.ts` crystallizes Tier-1 production vocabulary as typed libraries for optical techniques (50+), action tokens (18), cinematography presets (8), negative prompts (13 segments), presenter styles (5), shot vocabulary (10), continuity tokens (7), plus the expanded sections: 7-Layer Timeline System, Speed Control vocabulary (5 modes), Quality Boosters (16), Physics Detail vocabulary (13 material-specific physics), Text Overlay Patterns (7 animation types), and Lip Sync Rules (7 best practices). The system automatically enriches prompts for cinematic script composition using deterministic helpers and pre-defined knowledge.

### Advertising Playbook Knowledge Base
A strategic layer at `artifacts/api-server/src/lib/advertising-playbook-kb.ts` that sits above the cinematic knowledge base. Contains the Brand DNA 5-Pillar Framework, 6 Campaign Types (Awareness/Conversion/Launch/Retargeting/Testimonial/Educational) with narrative structures and prompt templates, UGC Archetypes for 10 industries, Master Prompt Formula (10 components), 6-Second Micro-Clip Method (8 rules), 7-Step Production Workflow, Concatenation Transitions (8 types), Video Tech Specs, and AI Video Tool rankings. Includes compose helpers: `composeCampaignBrief()` and `compose6SecClipPrompt()`. All deterministic, no AI calls. Exposed via 10 REST endpoints under `/api/fs-pro/advertising-playbook/*`.

### COGS Methodology Knowledge Base
A financial analysis methodology module at `artifacts/api-server/src/lib/cogs-methodology-kb.ts` crystallized from professional COGS/supplier guides. Contains the 7 Pillars of Logic (Transparency, Realism, Variability, Practical Utility, Scalability, Professionalism, Completeness), 12 Hidden Cost Categories with typical % ranges and calculation formulas, TCO (Total Cost of Ownership) framework with 9 weighted components, 3 Supplier Scenarios, Excel Design Rules (6 color codes + 6-sheet structure), PPTX Ideal Structure (12 slides), 9-Point Quality Checklist, 6-Step COGS Calculation methodology, and the Golden Rule. Exposed via `/api/fs-pro/cogs-methodology` and `/api/fs-pro/cogs-methodology/summary`.

### Campaign Production Knowledge Base
A comprehensive production module at `artifacts/api-server/src/lib/campaign-production-kb.ts` (~790 lines) crystallized from 7 ShopyCrafter campaign production documents (2 ZIPs). Contains: 2 CHARACTER_LOCKS (holographic AI entity + UGC creator variants with full prompt fragments), 6 VIDEO_CAMPAIGNS with dual-format prompts (9:16 + 16:9), voice-over scripts with timing, and music cues, 23 UGC_MICRO_CLIPS (6-second lip-sync clips grouped by video with dialogue and prompts), MASTER_CUT_TIMELINE (6 segments for the 2:10 brand film with transitions and clip references), 2 SUBTITLE_TRACKS with full SRT cue arrays (master cut + 6-sec female voice), 12 PRODUCTION_TIPS, 4 TECH_SPECS, 7 DELIVERABLES_CHECKLIST items, 4 AI_VIDEO_TOOLS ranked, and 10 STORYBOARD_SLIDES. Includes deterministic query helpers and Claude-powered `adaptCampaignForBrand()` with typed input validation and response schema verification. Exposed via 16 REST endpoints under `/api/fs-pro/campaign-production/*` (15 GET + 1 POST). Frontend page at `CampaignKit.tsx` provides a 6-tab UI (Videos, UGC Clips, Master Cut Timeline, Storyboard, Tools & Specs, AI Adapter) with copy-to-clipboard, expandable cards, and the AI brand adaptation form. **Fully integrated with ShopyBrain**: the `adapt-for-brand` endpoint uses `askClaudeWithBrain()` (not raw `askClaude`) to inject accumulated OmniCore knowledge + Brand DNA into every adaptation call, and calls `learnFromOperation()` after each successful adaptation so ShopyBrain learns from every brand adaptation. The `campaign_production` domain is registered in ShopyBrain's DOMAIN_LABELS (status endpoint), brain-ingester.ts DOMAIN_MAP (auto-categorization), `detectAndSaveCrossConnections` (cross-domain intelligence), and `learnFromOperation` memTypeMap (6 new operation types: campaign_adaptation, campaign_production, video_campaign, ugc_clip, storyboard, brand_adaptation).

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered professional recommendations. A centralized "Bóveda Global" stores reports, images, and research. Reports are stored as JSON metadata and rendered through `buildBrandedHtmlFromMetadata()`. Template Studio allows visual editing of custom report templates.
The platform supports generation of multi-sheet XLSX workbooks (COGS, supplier comparison, financial dashboard) and premium dark-themed PowerPoint presentations. It also includes an intelligent module for identifying seven categories of dead costs with severity, cost impact, and actionable recommendations. PDF rendering pipeline ensures consistent dark-luxury themes and A4 fitting.

### Web Lab UX
The default tab is "💻 CSS Real Generado" with prominent CTA banner for generated CSS, direct copy/download buttons, and an updated tab order (`css → preview → edit → summary → html`).

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, full store setup automation, and launching brand ad campaigns.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, including deep web design analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Prompt Lab (Fusion Studio Pro)
A power-user tab in Fusion Studio Pro for crafting and reusing professional prompts across 12 creation intents. It allows users to combine deterministic presets, refine prompts via Claude, edit output, and save to a persistent navigable library.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation. ACL is project-scoped and centralized to prevent cross-tenant data leaks.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Virtual Try-On (Fashion + Accessories)
The platform provides virtual try-on functionalities. For fashion items, it uses `cuuupid/idm-vton` on Replicate. For accessories, `google/nano-banana` (Gemini 2.5 Flash Image) is used for multi-image fusion. An auto-model feature generates a model photo if not provided.

### Super Ad Studio
A feature for generic brand ad creation, porting the `hanakaze-v2-super` script. It includes an async worker pipeline for video clips (image-to-video/text-to-video), ElevenLabs TTS and music integration, and MP4 concatenation. The UI provides a 5-step wizard for brief, references, editable storyboard generation, voice/music selection, and final generation with live polling and download. It supports cinematic long-form ads up to 30 minutes with parallel processing, multi-block music, and a Cinematic Director for narrative planning. Deterministic Brand & CTA Overlay uses FFmpeg `drawtext` for precise text rendering, eliminating AI typography glitches, with robust anti-text-leak guards.

### Hanakaze Cascade v3
A pipeline for generating 8-clip 60s vertical 9:16 ads with specific intro, reveal, deconstruction, try-on, and outro segments, including voice-off and music. It includes strict prompt fidelity rules for try-on clips, text overlay post-processing via FFmpeg `drawtext` for crisp typography, and maximum quality encoding.

### Audio Cap, Text Preservation & Locked-Shot Mode
Ensures audio tracks precisely match video duration, preserves existing printed text/logos on products while preventing AI from generating new text, and introduces a "locked-shot" mode for byte-perfect visual continuity between clips by passing the last frame of one clip as the source for the next.

### Brand Kit Extractor + Deterministic Brand Overlay
A new `lib/brand-overlay.ts` engine applies branding after video muxing using FFmpeg `drawtext` and PNG logo overlay. `lib/brand-kit-extractor.ts` uses Claude Vision OCR to extract brand details (name, taglines, social handles, URLs, colors, fonts, logos) from uploaded files. An API allows extraction and preview of brand overlay on videos.

### Premium Image Endpoints
Specialized endpoints offer infographic generation with AI or overlay text rendering modes, ensuring perfect spelling. A universal virtual try-on feature fuses model and product images using Gemini, preserving identity and product appearance.

### Card Studio (Tarjetas profesionales 300 DPI)
Provides a backend for business card generation with 6 templates, QR code generation, and rendering via Puppeteer for high-DPI printable output. It includes an admin-only API for managing cards, an auto-design feature using Claude, and a frontend editor with live preview. AI models for background generation use negative prompts to prevent text leaks.

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