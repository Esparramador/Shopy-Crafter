# ShopyBrain Agency Platform

## Overview
ShopyBrain is a multi-user Shopify AI optimization agency platform designed to enhance e-commerce operations for `admin` and `client` roles. It leverages advanced AI models (Gemini, Claude, OmniCore) for market research, competitor analysis, product trend identification, and content generation. The platform deeply integrates with Shopify's ecosystem to provide comprehensive business intelligence and automation, driving optimization and strategic growth for agencies and their clients by maximizing ROI for Shopify stores through AI-driven insights and actions.

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
- **Custom Cursor**: SCCursor component renders a 28px gold circle with "SC" initials + trailing 44px ring.
- **Responsive Design**: Three breakpoints — Desktop (>900px), Tablet (≤900px), Mobile (≤768px). Admin panel features adaptive layouts.
- **Landing Page Sections**: 7 sections including Hero, Engines, Demo, Results, Pricing, Calculator, and Contact.

### Database
PostgreSQL with Drizzle ORM, utilizing over 42 tables for user management, project data, product information, and extensive AI-related memory and insight storage.

### AI Stack and OmniCore
A **Dual AI Engine** architecture integrates Claude and Gemini in parallel for superior output. It also integrates with Replicate for image generation.
- **Dual AI Engine**: Supports `parallel_synthesis`, `gemini_research_claude_redact`, `claude_only`, `gemini_only` modes with graceful fallback.
- **Google PageSpeed Insights**: Reusable module for performance audits, integrated into intelligence building and chatbot actions.
- **Gemini**: Primary research engine with Google Search grounding for market intelligence, competitor analysis, product trends, and SEO.
- **Claude**: Premium copywriting and strategic analysis engine for final redaction, synthesis, and content generation.
- **Replicate (Flux, Recraft)**: Used for generating product and lifestyle images.
- **OmniCore**: The central AI "brain" with **46,000+ knowledge insights** imported from ComicCrafter OmniCore Brain + 5 expert system prompts + original ShopyBrain insights. It includes **49 actions** covering Shopify CRUD operations (products, collections, pages, themes), app diagnostics, source code editing, CMS editing, strategic capabilities (competitive pricing, app offerings, UI modification, supplier research), and **Brain Sync** (brain_sync, brain_stats, brain_export — import/export/sync knowledge from external brains, view brain statistics). It also features voice input and an Entity Research Engine and Guide Assistant.
- **Knowledge Search Engine** (`lib/knowledge-search.ts`): Smart keyword-based relevance search across 46K+ insights. Maps use-cases to priority domains (redesign→design_ux/creative-arts, seo→seo_content/programming, pricing→pricing_science/financial_analysis, etc.). Extracts keywords from user queries, scores by domain relevance + confidence + niche match. Used by `buildShopyBrainContext()`, `buildFullKnowledgeContext()`, and injected into every AI call (chatbot, dual-ai, emails, intelligence, scheduler).
- **Brain Sync System** (`routes/brain-sync.ts`): Full brain import/export/sync infrastructure. Export: `/api/admin/brain-export/knowledge` (paginated, JSON/NDJSON, domain filter), `/api/admin/brain-export/domains`, `/api/admin/brain-export/prompts`. Import: `/api/admin/brain-import` (JSON bulk), `/api/admin/brain-import/ndjson`. Sync: `/api/admin/brain-sync` (pull from external brain URL with auth). Stats: `/api/admin/brain-stats`.
- **Retroactive Learning**: Every chatbot action triggers `learnFromOperation()` to save results as categorized OmniCore memories, which are then injected into future Claude prompts via `buildShopyBrainContext()`. Every AI call now receives context-relevant OmniCore knowledge (query-matched + domain-matched + OmniCore expert prompts). Twelve scheduled cron jobs ensure continuous learning and consolidation.

### Key Features
- **Client Portal**: Provides KPI summaries and activity timelines.
- **Coach Marks**: Sequential tooltip system for new admin users.
- **M4 ScriptTag Integration**: For tracking pixel management.
- **Push Notifications**: VAPID-based system.
- **CMS Editor**: Visual content editor with AI copywriting and version history, supporting all UI content, including video backgrounds.
- **AI-Powered Lead Pre-Report**: Generates detailed pre-reports for landing form submissions via Gemini.
- **Client Invite Flow**: Secure, token-based onboarding.
- **Professional Budget/Invoice Generator**: AI-powered tool.
- **Shopify Product Creation (Full AI Pipeline)**: Automates product creation with AI-generated content, pricing, SEO, and images.
- **Supplier Research System**: AI-driven intelligence.
- **Universal Export System**: For various reports and data exports. Includes `complete-report` endpoint generating a **9-page paginated** comprehensive audit with page-break CSS, page headers, and table of contents: (1) Executive Summary + Health Score + KPIs + TOC, (2) Brand Identity + Price Distribution Waterfall, (3) **Real-Time SEO Audit** — live score calculation per product (meta titles, descriptions, schema, alt texts, handle, description length), (4) Financial/COGS Analysis with detailed cost breakdown table, (5) Sales Analysis with daily revenue/orders/AOV (when Shopify data exists), (6) A/B Testing + **Price Optimization Suggestions** (psychological pricing, margin-critical alerts, premium anchoring, compare-at-price recommendations per product), (7) **AI Economist Analysis** — market positioning, margin waterfall distribution, catalog visual health, top/bottom products, bundle/upsell suggestions, revenue projections, (8) Strategic Recommendations (prioritized successes + issues), (9) Full Product Catalog Table. Also includes `POST /projects/:id/exports/run-full-audit` endpoint that executes real SEO audit on all products, syncs Shopify revenue with variant-level line_items, and persists results to DB. Premium dark-theme HTML with print-ready CSS, XSS-safe escaping, and URL protocol validation.
- **AI Economist with Market Research**: Calculates optimal prices using parallel Gemini searches and Claude analysis.
- **A/B Testing (Image + Price)**: Supports image and price variant tests with AI-generated impact predictions.
- **Price Simulator & P&L Forecast**: Tools for financial analysis and scenario simulation.
- **Comprehensive COGS System**: Detailed cost of goods sold tracking with AI auto-estimation.
- **Partial Redesign**: Allows users to select specific product attributes for AI-driven redesign.
- **Knowledge Graph Visualization**: Interactive D3.js graph.
- **Automated Cron Jobs**: Twelve tasks for continuous learning and intelligence.

### Security
- AES-256-GCM encryption for credentials.
- Comprehensive audit logging.
- Database-backed rate limiting for all endpoints.
- AI API concurrency queues and exponential backoff.
- Frontend ErrorBoundary and global error handlers.
- Admin route protection, CORS, and secure session management.
- SVG sanitization, PostMessage origin validation, HTML escaping, and protection against common web vulnerabilities.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation.
- **Archiver**: Server-side ZIP generation.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **connect-pg-simple**: PostgreSQL session store.
- **ExcelJS**: XLSX workbook generation.
- **@google/genai**: For direct Gemini API integration.