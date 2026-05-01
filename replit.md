# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform utilizing a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for comprehensive e-commerce optimization. It offers AI-driven insights, automation, product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The platform's vision is to be a leading AI-driven solution for e-commerce, expanding across various platforms and providing extensive agency-level services to enhance client ROI.

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

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, and Gallery features.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered professional recommendations. A centralized "Bóveda Global" stores reports, images, and research. Reports are stored as JSON metadata and rendered through `buildBrandedHtmlFromMetadata()` for consistent branded output. Template Studio allows visual editing of custom report templates.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, and full store setup automation.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, including deep web design analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation. `validateEncryptionKey()` enforces key presence in production. PDF generation includes timeout, external resource blocking, and content limits. Image fetching includes size limits and pre-checks. Project-scoped ACL is centralized in `lib/access.ts` (admin or owning client only) and applied to vault and all 27 export endpoints to prevent cross-tenant data leaks.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Super Ad Studio
A feature for generic brand ad creation, porting the `hanakaze-v2-super` script. It includes an async worker pipeline for video clips (image-to-video/text-to-video), ElevenLabs TTS and music integration, and MP4 concatenation. State is persisted in `bulk_jobs`. The UI provides a 5-step wizard for brief, references, editable storyboard generation (Claude), voice/music selection, and final generation with live polling and download.

### Premium Image Endpoints
Two specialized endpoints in `routes/images.ts` complement the 8 classic generation modes:
- `POST /api/projects/:projectId/products/:productId/images/generate-infographic-premium` — Claude extracts only literal product data (no inference of specs/origin/materials), builds an English Ideogram v3 prompt with quoted text for verbatim rendering. **Anti-hallucination guard** post-validates every quoted string against the product corpus (title+description+tags+price+productType) and strips any non-literal invention before generation. Default model `ideogram-v3-turbo` with automatic fallback to `nano-banana` (Gemini 2.5 Flash Image) on quota/billing errors (402). Persists to vault.
- `POST /api/projects/:projectId/products/:productId/images/tryon-quick` — Universal virtual try-on (clothing, cosmetics, accessories, any product). Multipart upload of model image + scene preset + aspect ratio. Downloads product image via SSRF-safe `fetchToBuffer` (DNS validation, private-IP/localhost blocked, no redirects), enforces 15MB max payload, validates magic bytes (PNG/JPEG/WEBP only). Fuses model + product via `gemini-2.5-flash-image` preserving identity and product appearance. Persists to vault.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.
- **Runway**: For video generation.
- **ElevenLabs**: For voice synthesis and cloning.