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
A premium dark theme with custom color variables, typography, and a fixed layout featuring a gold gradient topline, sidebar, and topbar. A custom "SCCursor" component provides a branded cursor. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page includes 7 sections with a fullpage scroll-snap engine on desktop and native scrolling on tablet/mobile.

### Multi-Platform Connector Architecture
An extensible `IPlatformConnector` abstraction layer supports Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with a `ConnectorFactory` for dynamic selection.

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
"ShopyBrain" is the central mega-brain that receives, distributes, and stores all requests and knowledge, injecting accumulated intelligence into every AI call. It's a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. Token limits and anti-truncation mechanisms are in place, along with robust rate-limit retry logic for Claude and Gemini. Critical actions such as `fix_code` and `modify_ui` validate path whitelists, block sensitive files, and require explicit confirmation. Destructive actions are guarded by a centralized confirmation system.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, and Gallery features.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content. All reports include Claude-powered professional recommendations. A centralized "Bóveda Global" stores reports, images, and research from projects and external entities. Reports stored as JSON metadata are rendered through `buildBrandedHtmlFromMetadata()` for consistent branded output. Template Studio allows visual editing of custom report templates.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, and full store setup automation.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis. Lab Web offers deep web design analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting (per IP and email for login), AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation for critical actions and user data. `validateEncryptionKey()` enforces key presence in production. PDF generation includes timeout, external resource blocking, and content limits. Image fetching includes size limits and pre-checks. **Project-scoped ACL is centralized in `lib/access.ts` (`canAccessProject` + `requireProjectAccess` middleware) — admin or owning client only**; applied to vault and all 27 export endpoints to prevent cross-tenant data leaks.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

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
## 2026-04-29 — E2E real verification + bug fixes

End-to-end practical test of `/fs-pro/concat` (generated 2 dummy MP4s with
ffmpeg, inserted into vault, called concat endpoint, downloaded, verified with
ffprobe). Surfaced **4 real bugs** that smoke tests had missed:

1. **`ffmpeg-static` resolved to a non-existent path** in pnpm runtime
   (`node_modules/.pnpm/.../ffmpeg` not present after install). Affected both
   `composeAd` and `concatVideos`. Fix: new `loadFfmpeg()` helper in
   `lib/fusion-studio-pro.ts` that tries `ffmpeg-static`/`ffprobe-static` first
   and falls back to system `ffmpeg`/`ffprobe` via PATH (Replit Nix runtime
   provides both).
2. **Duplicate import** of `requireProjectAccess` in `routes/exports.ts` (one
   from `lib/access.js`, one stale from `lib/auth.js`). Removed the stale one.
3. **`req.params.projectId` typed as `string | string[]`** in 6 export handlers
   when an extra middleware is added (TS overload inference quirk). Fixed
   with `parseInt(String(req.params.projectId), 10)`.
4. **Vault `/download` endpoint corrupted binaries < 2MB**: `saveToVaultSmart`
   stores them as base64 in `content`, but the download handler was sending
   the raw base64 string as utf-8. Fix in `routes/vault.ts`: detect binary
   mimeType (everything that isn't text/*, json, xml, javascript) and decode
   with `Buffer.from(content, "base64")`. Text-based downloads (HTML reports,
   CSV, CSS) are unaffected.

Final verification: clip 2s + 2s concat → MP4 4.000s exactos; with xfade 0.5s
→ MP4 3.500s exactos (matemáticas correctas, durations vienen de ffprobe real).
