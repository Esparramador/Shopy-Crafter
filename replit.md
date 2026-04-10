# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform (shopycrafter.com) designed for `admin` and `client` roles. It utilizes a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for comprehensive e-commerce optimization, including market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify to deliver AI-driven insights, automation, and advanced features such as AI-powered product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The project aims to become a leading AI-driven solution for e-commerce, expanding to various platforms and offering extensive agency-level services to boost client ROI.

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
A premium dark theme is implemented with custom color variables, specific typography, and a fixed layout featuring a gold gradient topline, sidebar, and topbar. A custom "SCCursor" component provides a branded cursor. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page comprises 7 sections: Hero, Engines, Demo, Results, Pricing, Calculator, and Contact. The landing uses a fullpage scroll-snap engine on desktop (>900px width AND >500px height) with section-by-section navigation via wheel/touch/keyboard events, and native vertical scrolling on tablet/mobile/landscape. Touch/wheel/keyboard event listeners are ONLY attached when `fpMode` state is true (desktop fullpage mode); on mobile they are completely removed so native browser scroll is unimpeded. `fpMode` is tracked via React state and recalculated on window resize. All animation visibility is forced on screens ≤900px width. The `.l-root::before` noise overlay is hidden on mobile to avoid potential touch interference. The app shell uses `100dvh` with `100vh` fallback for proper mobile viewport handling (accounts for browser URL bar). Mobile `.main-content` uses `flex:1; min-height:0; overflow-y:auto` pattern for reliable scroll within the app shell.

### Multi-Platform Connector Architecture
An extensible connector abstraction layer (`IPlatformConnector`) supports various e-commerce platforms including Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with WordPress planned. A `ConnectorFactory` dynamically selects the appropriate connector based on the project's `platformType`.

### Product Enrichment and Audit Systems
The platform includes an AI-driven Product Enrichment System for SEO meta generation and Shopify Standard Product Taxonomy categorization. A Comprehensive Product Audit System performs a 7-criteria weighted scoring on product data fetched via GraphQL.

### AI-Powered Report Recommendations — "Produce, Not Recommend" Philosophy
All 6 individual reports (SEO, Financial, Consistency, Inventory, Redesigns, Revenue) include Claude-powered professional recommendations. Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content such as product descriptions, meta tags, CSS code, JSON-LD Schema, marketing emails, social media posts, photography briefs, and brand style guides. Deliverables are marked with `<div class="ai-deliverable">`.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types covering Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, brand generation, SEO, pricing, email marketing, inventory management, competitor analysis, virtual try-on, user management, and full store setup automation. The `modify_ui` action uses Claude to analyze and apply code changes directly to files.

### COGS & Pricing Intelligence
The COGS estimation system uses Gemini with Google Search for real-time market data to calculate detailed cost breakdowns. The `calculate_optimal_price` system also leverages Gemini Search for competitive pricing and supplier costs. Research includes `researchWarnings` for transparency, and SSRF protection is in place.

### Competitor Auto-Discovery
The `discover_competitors` action uses Gemini with Google Search to automatically identify 8-12 real competitors in the same niche, registering them in `competitorsTable` for further analysis. SSRF protection is enforced.

### Global Vault
A centralized "Bóveda Global" stores reports, images, and research from projects and external entities, managed via a `project_files` database table and accessible through API routes and a dedicated frontend page (`/admin/vault`).

### Universal Search (`/admin/search`)
A standalone search and audit tool accessible from the sidebar. It allows searching/analyzing any URL, Shopify store, Instagram account, or brand name without project context, using `POST /api/shopybrain/research-entity-sync` for deep AI research. Results are saved to the vault as external entities.

### Universal Web Audit System
This system audits any website using the Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, storing results in the `audit_results` table. Each audit contributes to ShopyBrain's learning.

### Database
PostgreSQL with Drizzle ORM manages over 44 tables, including a `platform_type` column for platform specificity.

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
"ShopyBrain" is the central mega-brain that receives, distributes, and stores all requests and knowledge, injecting accumulated intelligence into every AI call. It's a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. All Claude calls are routed through specific brain-aware functions (`askClaudeWithBrain`, etc.) to ensure proper context injection and API key management.

**Token Limits & Anti-Truncation (April 2026):**
- Claude Brain functions (`askClaudeWithBrain`, `askClaudeJsonWithBrain`) default to 32,000 tokens (Claude Sonnet 4 supports up to 64K output).
- Gemini maxOutputTokens: 65,536 (Flash max). ThinkingBudget: 6K-10K per function.
- Dual AI synthesis cap: 32,000 tokens. Redesign: 32,000 tokens.
- All AI providers log `⚠️ RESPONSE TRUNCATED` warnings when `stop_reason`/`finishReason` indicates token limit hit.
- Claude has robust rate-limit retry via `claude-queue.ts` (4 retries, exponential backoff, detects 429/500/502/503/529/overloaded).
- Gemini has rate-limit-aware retry via `withRetry` (2 retries, aggressive backoff on 429/RESOURCE_EXHAUSTED).

### Lab Web (`/projects/:id/web-lab`)
A deep web design analysis tool that extracts HTML+CSS from any URL, runs PageSpeed + scraper analysis, and sends the code to Claude for design review. It outputs improved CSS, HTML fragments, a professional report, and before/after visual previews.

### Universal Generator (`/projects/:id/generator`)
A comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`. It features a 5-Level Report System for varied depth of analysis and output.

### Fusion Studio (Image Analysis Engine)
An AI-powered image decomposition engine using Claude Vision. It analyzes images to extract layers, color palettes, textures, composition, and product metadata, providing product generation suggestions.

### File Upload System
A universal file processor with multer integration, supporting various text files, images, spreadsheets, and PDFs up to 20MB.

### Brand CSS & Kit System (`brand-css-generator.ts`)
Generates personalized CSS files, brand identity guides (HTML/PDF), and complete brand kits (ZIP). All AI reports dynamically inject brand DNA for personalized CSS code blocks.

### Pre-Informe System (Lead Contact Form)
When a lead submits the contact form, the system generates a professional AI pre-informe. Gemini researches the business, Claude structures data into professional HTML, and Claude generates a 100/100 Shopify SEO product sample. The system adapts for service businesses, generating service packs. Pre-informes are saved to the vault and emailed.

### Key Features
Core features include a Client Portal, visual CMS Editor with AI copywriting, secure Client Invite Flow, AI-powered Budget/Invoice Generator, AI Pipeline for Shopify Product Creation, AI Creative Director Image System, Reference Image Generation, Virtual Try-On, Audit-First Brain Actions, Page and Theme Management, Purchase Protection, Deep Inventory & Sales Control, Sales Report by Product/Variant, Supplier Research, PDF Commercial Reports, Universal Export/Download systems, AI Economist for optimal pricing, A/B Testing, Price Simulator & P&L Forecast, Comprehensive COGS System, Partial Redesign capabilities, Automated Cron Jobs, and a Copyright Audit System.

### Security
The platform employs AES-256-GCM encryption for credentials, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG sanitization, PostMessage origin validation, and HTML escaping for XSS protection. Admin credentials are environment variable-based.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.