# ShopyBrain Agency Platform

## Overview
ShopyBrain is a multi-user Shopify AI optimization agency platform designed to enhance e-commerce operations. It supports `admin` and `client` roles, leveraging advanced AI models (Gemini, Claude, OmniCore) for market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify's ecosystem to provide comprehensive business intelligence and automation, driving optimization and strategic growth for agencies and their clients. Its core purpose is to maximize ROI for Shopify stores through AI-driven insights and actions.

## User Preferences
- Admin email: `sadiagiljoan@gmail.com` (password stored in DB, bcrypt-hashed)
- Design: gold/black/jade premium dark theme
- Language: Spanish (UI), code in English
- Zero mocked data — all real
- Shopify billing (not Stripe) — generates checkout links per service/client
- Landing-first routing: unauthenticated → `/` (landing); clients only via `/invite/:token`

## System Architecture

The project is a pnpm workspace monorepo built with TypeScript and Node.js 24.

### Artifacts
- `api-server` (Port 8080, Path `/api/*`)
- `shopify-optimizer` (React+Vite, Port 19080, Path `/`)
- `mockup-sandbox` (Port 8081, Path `/__mockup`)

### Design System
- **Colors**: `--ink:#080810`, `--gold:#c8a84b`, `--jade:#2dd49f`, `--crim:#e84558`
- **Typography**: Instrument Serif (headings), Geist (body), Geist Mono (code)
- **Layout**: Fixed 2px gold gradient topline, 220px sidebar, topbar
- **Custom Cursor**: SCCursor component (`src/components/ui/SCCursor.tsx`) renders a 28px gold circle with "SC" initials + trailing 44px ring. Mounted at App root (App.tsx) so it covers all routes. CSS in `design-system.css` sets `body { cursor: none }` on desktop; `@media (max-width: 900px)` reverts to auto. JS touch detection in component skips animation on touch devices. Hover effect uses JS-driven class toggling (`sc-cursor-hover`, `sc-ring-hover`).
- **Responsive Design**: Three breakpoints — Desktop (>900px: fullpage scroll-snap with side dots), Tablet (≤900px: auto-height sections, natural scroll, centered hero), Mobile (≤768px: stacked layouts, contact form reduced padding). JS breakpoints in Landing.tsx aligned to CSS at 900px. Admin panel: sidebar off-canvas on tablet (601-1024px), horizontal nav bar on mobile (≤600px). Accessibility: `focus-visible`, `aria-label`, `prefers-reduced-motion`.
- **Landing Page Sections** (7 sections): Hero → Engines → Demo → Results → Pricing → **Calculator** → Contact (with footer). No CTA section, no testimonials section. Calculator and contact sections have `overflow-y: auto` for long content.

### Database
PostgreSQL with Drizzle ORM, utilizing over 42 tables for various functionalities including user management, project data, product information, and extensive AI-related memory and insight storage.

### AI Stack and OmniCore
A three-model pipeline (Gemini → Claude → OmniCore) integrated with image generation.
- **Gemini**: Primarily for research, market intelligence, competitor analysis, product trends, and SEO keyword intelligence, with Google Search grounding (threshold 0.0 = always real search) for real market pricing and keyword data.
- **Claude**: Used for strategic analysis, content generation, and incorporating ShopyBrain context, with BrandDNA and OmniCore knowledge injection for consistency.
- **Replicate (Flux, Recraft)**: For generating product and lifestyle images.
- **OmniCore**: The central "brain" for permanent memory, storing all AI outputs and analysis, and acting as a floating AI chatbot for natural language commands. **37 total actions**: Shopify CRUD (store_status, list/create/edit/delete/search/publish products, change_price, set_product_status, scan_store, get_orders, get_scopes, regenerate_token, optimize_product/all, create/list/auto collections, create/list/design pages, optimize_images), app diagnostics (diagnose_app, modify_audit_filter), source code editing (inspect_code, fix_code, list_source_files, analyze_component — all path-sandboxed), CMS editing (read_cms, update_cms, update_cms_batch, reset_cms — covers ALL CMS paths exhaustively), **strategic capabilities** (generate_competitive_pricing — researches real market + generates plans + updates CMS + creates products in Shopify; audit_app_offerings — full app offering audit with recommendations; modify_ui — applies CSS/layout/visual changes to the app), and supplier research. System prompt includes complete CMS path map for every editable field. It also powers an Entity Research Engine and a context-aware Guide Assistant.
- **Retroactive Learning**: Every chatbot action triggers `learnFromOperation()` (fire-and-forget) that saves results as categorized OmniCore memories. All 37 action types have explicit memory-type mappings (prompt_template, pricing_pattern, image_pattern, competitor_intel, ab_insight, niche_keyword, general). `buildShopyBrainContext()` injects top-15 memories + 5 prompt patterns + 10 strategic insights + visual insights into every Claude prompt, so future responses benefit from all past operations. 12 scheduled cron jobs handle continuous learning (micro-learning every 3h, consolidation every 6h, deep study at 1am, cross-synthesis every 12h, weekly mega-synthesis).

### Key Features
- **Client Portal**: Provides KPI summaries, activity timelines, and export options.
- **Coach Marks**: Sequential tooltip system for first-time admin users.
- **M4 ScriptTag Integration**: For installing and managing tracking pixels.
- **Push Notifications**: VAPID-based system for user notifications.
- **CMS Editor**: Visual content editor with AI copywriting and version history. Zero hardcoded content mandate across ALL panels. Covers: site config, backgrounds, navigation, hero (pill, headline, CTAs, demo dashboard, scroll hint, APK button labels), features/motors (6 motors with stats), results (animated stats, tech badges), pricing (plans with features), **interactive price calculator** (9 one-time services + 3 recurring plans, toggle selection, real-time totals, gold=one-time / blue=recurring distinction), contact form (labels, placeholders, dropdowns, success messages), footer. Also covers: howCards (3 demo cards + impact card), sectionNav (7 landing nav labels), adminBackLabel, apkLabels (5 status states), errorMessages, heroDemoTitles, adminPanel (sidebar labels, header, user, tooltips, notifications), clientPanel (nav items, sidebar, topbar, badges, status). Admin panel sidebar/header/tooltips/notifications all CMS-driven. Client panel sidebar/topbar/nav/status all CMS-driven. OmniCore chatbot can edit CMS via `update_cms` action. Pricing cards display as horizontal scroll carousel on mobile (≤900px). CMS mutating routes protected by requireAdmin middleware. Boolean coercion and array/string tag handling in Landing. CMS defaults deep-merged with stored content so new sections (like calculator) are available without DB reset.
- **Email Template Studio**: AI-powered editor for professional email templates with brand identity integration and Klaviyo push.
- **AI-Powered Lead Pre-Report**: Landing form submissions trigger 3 parallel Gemini searches (business, market/competition, SEO) and send a detailed HTML pre-report email to craftershopy@gmail.com via Gmail API. Background processing — doesn't block form response.
- **Client Invite Flow**: Secure, token-based system for client onboarding.
- **Professional Budget/Invoice Generator**: AI-powered tool for generating detailed budgets and invoices.
- **Shopify Product Creation (Full AI Pipeline)**: Automates product creation with AI-generated content, real price research, SEO metafields, and AI-generated images. Supports image-to-product creation via chat. AI generation includes: professional hashtags for social media, suggested variants (size/color/material auto-applied), recommended image counts (5-9 for professional stores) with image type guidance (hero, lifestyle, detail, scale, packaging, UGC), and brand DNA consistency notes.
- **Supplier Research System**: AI-driven intelligence for supplier identification and cost analysis.
- **Universal Export System**: Comprehensive hub for various report types and data exports.
- **AI Economist with Market Research**: Optimal price calculation runs parallel Gemini searches (competitor prices + supplier costs) BEFORE Claude analysis. Returns real competitor prices with sources, market price ranges (min/max/median), supplier cost averages, price impact estimates (expected sales/revenue change), and margin waterfall breakdown. Frontend displays competitor badges, supplier costs, price impact estimates, and recommended strategy.
- **A/B Testing (Image + Price)**: Supports both image and price variant tests. Price tests include AI-generated impact predictions (revenue change, margin analysis, conversion rate impact, visual/economic impact, risk level). Test cards show visitors, conversion rates, and statistical confidence with significance indicator.
- **Price Simulator & P&L Forecast**: Tools for financial analysis, including scenario simulation, price elasticity calculation, and multi-month forecasts. Auto-fetches COGS via AI if none saved before simulating.
- **Comprehensive COGS System**: Detailed cost of goods sold tracking across multiple categories. AI auto-estimation via Claude (dual scenarios: own equipment vs external service) with material breakdown, shipping tariffs by carrier, production method, color complexity, and confidence level.
- **Partial Redesign**: Users can select which parts to redesign (title, description, price, tags, SEO meta, photo briefs) instead of rewriting everything. Field mapping aligns frontend keys (bodyHtml, metafields) to backend keys (description, meta) for apply-redesign.
- **Knowledge Graph Visualization**: Interactive D3.js graph to visualize knowledge domains and insights.
- **Automated Cron Jobs**: Twelve tasks for continuous learning, data consolidation, and operational intelligence, with AI fallback.

### Security
- AES-256-GCM encryption for credentials.
- Comprehensive audit logging for all critical actions.
- Database-backed rate limiting for all endpoints (PostgreSQL store for express-rate-limit with prefixed keys: auth/api/ai, plus route-level DB rate limiting for login in auth.ts).
- AI API concurrency queues and exponential backoff for retries.
- Frontend ErrorBoundary and global error handlers.
- Admin route protection, CORS configuration, and secure session management.
- SVG sanitization, PostMessage origin validation, HTML escaping, prototype pollution, path traversal, and dynamic method access protection.
- SAST scan compliance with minimal findings.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model for analysis and content generation.
- **Replicate**: For image generation (Flux, Recraft).
- **Archiver**: Server-side ZIP generation.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: OAuth-based Gmail API for sending ALL emails from `craftershopy@gmail.com` (official business email). Sender name is "Shopy Crafter" (the company) — NOT "ShopyBrain" (ShopyBrain is the AI brain engine, Shopy Crafter is the company). Direct sends via `sendEmail()` in `lib/gmail.ts` use explicit From header. Klaviyo flows default to `craftershopy@gmail.com` as from_email. Backend enforces AGENCY_EMAIL on INSERT — `from_email` is always `craftershopy@gmail.com` regardless of frontend input. Email templates generate client-branded content but with "Powered by Shopy Crafter" in footer.
- **connect-pg-simple**: PostgreSQL session store.
- **ExcelJS**: XLSX workbook generation.
- **@google/genai**: For direct Gemini API integration.