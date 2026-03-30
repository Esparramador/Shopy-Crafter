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
- **OmniCore (SINGLE BRAIN)**: The ONE central AI "brain" — ALL AI calls in ALL routes use `askClaudeWithBrain`/`askClaudeJsonWithBrain` (zero direct `askClaude` calls). Every operation passes through ShopyBrain context first (46K+ insights injected), then executes, then learns via `learnFromOperation`. No parallel brains exist. **46,000+ knowledge insights** imported from ComicCrafter OmniCore Brain + 5 expert system prompts + original ShopyBrain insights. It includes **79 chatbot actions** covering: Shopify CRUD (products, collections, pages, themes), product redesign (single/bulk with 100/100 quality), A/B testing (create/list/declare winner), SEO intelligence (16-criteria audit, keyword research, blog strategy, blog posts, schemas, meta tags, alt texts, sitemap, PageSpeed), pricing intelligence (optimal price, COGS estimation, price simulator, financial forecast, financial dashboard), image generation (single/bulk with 8 types), email marketing (flow generation, individual emails via Klaviyo AI), competitor analysis (scan/compare), inventory management (sync/alerts), agency tools (quotes/proposals), full store setup from zero, app diagnostics, source code editing, CMS editing, UI modification, supplier research, and Brain Sync (brain_sync/stats/export). All actions use verified API contracts with `resp.ok` error checking. Voice input and Entity Research Engine also included.
- **Knowledge Search Engine** (`lib/knowledge-search.ts`): Smart keyword-based relevance search across 46K+ insights. Maps use-cases to priority domains (redesign→design_ux/creative-arts, seo→seo_content/programming, pricing→pricing_science/financial_analysis, etc.). Extracts keywords from user queries, scores by domain relevance + confidence + niche match. Used by `buildShopyBrainContext()`, `buildFullKnowledgeContext()`, and injected into every AI call (chatbot, dual-ai, emails, intelligence, scheduler).
- **Brain Sync System** (`routes/brain-sync.ts`): Full brain import/export/sync infrastructure. Export: `/api/admin/brain-export/knowledge` (paginated, JSON/NDJSON, domain filter), `/api/admin/brain-export/domains`, `/api/admin/brain-export/prompts`. Import: `/api/admin/brain-import` (JSON bulk), `/api/admin/brain-import/ndjson`. Sync: `/api/admin/brain-sync` (pull from external brain URL with auth). Stats: `/api/admin/brain-stats`. Self-Knowledge: `/api/admin/brain-inject-self-knowledge` (injects platform identity, pricing, capabilities into OmniCore). Shopify Services: `/api/admin/create-shopify-services` (creates service products in Shopify store with direct cart checkout URLs).
- **Retroactive Learning (Deep)**: Every chatbot action triggers `learnFromOperation()` through `buildEnrichedLearningContent()` — an intelligent extraction function that categorizes results by domain (SEO, pricing, product, image, competitor, theme, marketing, catalog) and extracts rich structured data (scores, prices, margins, product titles, tags, competitor intel) instead of raw JSON dumps. Every conversation feeds the brain via `learnFromConversation()` — detecting explicit instructions ("aprende", "recuerda"), strategic decisions ("estrategia", "plan", "objetivo"), and general insights. Four new chatbot actions: `learn_from_url` (absorbs any webpage/video), `learn_from_content` (absorbs pasted text), `recall_knowledge` (searches memory by relevance), `brain_status` (full brain stats). The `memTypeMap` in `learnFromOperation` now covers all 79+ action types with proper categorization. Twelve scheduled cron jobs ensure continuous learning and consolidation. Universal content absorber (`absorber.ts`) handles images, videos, URLs, social profiles, and text with Claude Vision analysis.

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
- **PDF Commercial Report** (`.gen-pdf-v2.js`): 17-page A4 dark-theme PDFKit report for Comic Crafter. Data-consistent: global score 46/100 = weighted avg of 7 dimensions (Desc=35, Imgs=24, Trust=20, SEO=50, Pricing=66, Titles=68, Quality=70). Grade distribution B=1,C=8,D=10,F=10=29. Compound multiplier ×3.0-4.5 with overlap note. AOV €38-42. **Critical rules**: margin:0 always, NO doc.save()/restore(), NO pageAdded event, NO emoji chars, DejaVuSans only.
- **Universal Export System**: For various reports and data exports. Includes `complete-report` endpoint generating a **9-page paginated** comprehensive audit with page-break CSS, page headers, and table of contents: (1) Executive Summary + Health Score + KPIs + TOC, (2) Brand Identity + Price Distribution Waterfall, (3) **Real-Time SEO Audit** — live score calculation per product (meta titles, descriptions, schema, alt texts, handle, description length), (4) Financial/COGS Analysis with detailed cost breakdown table, (5) Sales Analysis with daily revenue/orders/AOV (when Shopify data exists), (6) A/B Testing + **Price Optimization Suggestions** (psychological pricing, margin-critical alerts, premium anchoring, compare-at-price recommendations per product), (7) **AI Economist Analysis** — market positioning, margin waterfall distribution, catalog visual health, top/bottom products, bundle/upsell suggestions, revenue projections, (8) Strategic Recommendations (prioritized successes + issues), (9) Full Product Catalog Table. Also includes `POST /projects/:id/exports/run-full-audit` endpoint that executes real SEO audit on all products, syncs Shopify revenue with variant-level line_items, and persists results to DB. Premium dark-theme HTML with print-ready CSS, XSS-safe escaping, and URL protocol validation. **AI Deep Analysis**: `POST /projects/:id/exports/generate-ai-report` calls Claude (max_tokens=8192) with all store data to generate exhaustive analysis across 9 sections (executiveSummary, brandAnalysis, seoDeepAnalysis, pricingStrategy, financialAnalysis, productMixStrategy, competitivePosition, actionPlan30Days, revenueProjection). Stored in `projects.aiReportJson`; complete-report embeds sanitized AI blocks in each section. **In-App Report Viewer**: ExportCenter includes iframe modal for viewing complete report inline with Print/Download toolbar. AI HTML is sanitized server-side (strips scripts, events, dangerous URLs) and iframe uses restrictive sandbox.
- **100/100 Quality Standard + Semrush SEO Intelligence**: All systems upgraded with Semrush-inspired methodology. **SEO Scoring**: 16 weighted criteria including keyword consistency (title keywords in body + prominence in first paragraph), content readability (sentence length analysis), structured data depth (Product/FAQ schema), FAQ optimization, social meta readiness, internal linking, plus all original criteria. Weighted average system for granular accuracy. **Product Audit**: 7 weighted dimensions with readability analysis (avg sentence length 10-25 words), keyword consistency checks (title→body→tags alignment), enhanced trust score with FAQ and specs signals. **AI Prompts**: Semrush methodology integrated — keyword density 1.5-2.5%, keyword prominence (keyword in first paragraph), LSI/semantic keywords (5-8 distributed), FAQ schema-ready format for Google Rich Snippets, readability targets (15-25 word sentences, 2-4 line paragraphs, active voice), transactional search intent tags. **Image Plans**: agency_pro+ = 8 types (hero, lifestyle, detail, packaging, ugc, scale, process, variant).
- **AI Economist with Market Research**: Calculates optimal prices using parallel Gemini searches and Claude analysis.
- **A/B Testing (Image + Price)**: Supports image and price variant tests with AI-generated impact predictions.
- **Price Simulator & P&L Forecast**: Tools for financial analysis and scenario simulation.
- **Comprehensive COGS System**: Detailed cost of goods sold tracking with AI auto-estimation.
- **Partial Redesign**: Allows users to select specific product attributes for AI-driven redesign.
- **Knowledge Graph Visualization**: Interactive D3.js graph.
- **Automated Cron Jobs**: Twelve tasks for continuous learning and intelligence.

### Service Delivery Audit (Verified March 2026)
All 9 Shopify service products are fully deliverable via the chatbot's 79 actions:
1. **Photoshoot Pro** → bulk_generate_images (Flux/Recraft, 7 types, auto alt-text, Shopify upload)
2. **Growth Studio** → optimize_all_products + seo_full_audit + A/B testing + pricing engine + blog
3. **Performance Lab** → 6 AI engines (images, SEO, A/B, pricing, autopilot, content) + 12 cron jobs
4. **Auditoría Completa** → scan_store + seo_full_audit + audit_theme + financial_dashboard + competitors
5. **Rediseño IA 30 Productos** → bulk_redesign + apply_redesign (8 sections, keyword research)
6. **Pack 30 Imágenes IA** → bulk_generate_images (hero, lifestyle, detail, packaging, ugc, scale, bundle)
7. **SEO Completa** → generate_schemas (real JSON-LD injected into theme) + metas + alt texts + sitemap + PageSpeed
8. **Informe Precios** → financial_dashboard + calculate_optimal_price + estimate_cogs + price_simulator + forecast
9. **Email Marketing** → generate_email_flow (6 flows HTML) + generate_email + Klaviyo API draft creation
- `generate_schemas` generates real Product+FAQ+Breadcrumb+Organization+WebSite JSON-LD and injects into theme.liquid
- `formatActionResult` in OmniChatbot has 83 action handlers for user-friendly output (79 original + learn_from_url, learn_from_content, recall_knowledge, brain_status)

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