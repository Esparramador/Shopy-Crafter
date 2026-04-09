# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform (shopycrafter.com) designed for `admin` and `client` roles. It leverages a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for comprehensive e-commerce optimization, including market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify to deliver AI-driven insights, automation, and advanced features such as AI-powered product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The project aims to become a leading AI-driven solution for e-commerce, expanding to various platforms and offering extensive agency-level services to boost client ROI.

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
A premium dark theme is implemented with custom color variables (`--ink`, `--gold`, `--jade`, `--crim`), specific typography (Instrument Serif, Geist), and a fixed layout featuring a gold gradient topline, sidebar, and topbar. A custom "SCCursor" component provides a branded cursor. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page comprises 7 sections: Hero, Engines, Demo, Results, Pricing, Calculator, and Contact.

### Multi-Platform Connector Architecture
An extensible connector abstraction layer (`IPlatformConnector`) supports various e-commerce platforms including Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with WordPress planned. A `ConnectorFactory` dynamically selects the appropriate connector based on the project's `platformType`.

### Product Enrichment and Audit Systems
The platform includes a Product Enrichment System that uses AI to generate SEO meta titles/descriptions, assign Shopify Standard Product Taxonomy categories, and manage custom metafields and digital product inventory. A Comprehensive Product Audit System fetches all product data via GraphQL and performs a 7-criteria weighted scoring (Title, Description, Price, Images, SEO, Content Quality, Trust). All product-related code paths ensure SEO metafields are passed and audited.

### AI-Powered Report Recommendations — "Produce, Not Recommend" Philosophy
All 6 individual reports (SEO, Financial, Consistency, Inventory, Redesigns, Revenue) include Claude-powered professional recommendations via `generateAiRecommendations()` in `exports.ts` (16000 max tokens). Reports follow a "PRODUCE, NOT RECOMMEND" philosophy: instead of suggesting "write a better description", reports PRODUCE the complete description ready to copy and paste. Deliverables include: complete product descriptions, meta titles/descriptions, CSS code with hex colors and typography, JSON-LD Schema markup, full marketing emails (subject + body + CTA), social media posts, photography briefs, brand style guides (color palette, fonts, spacing), landing page designs, and inventory management emails to suppliers. Each action includes a `<div class="ai-deliverable">` section with the finished work product. AI sections have dedicated CSS in all 3 report shells (Classic/gold, Elegance/silver, Prestige/copper) including `.ai-deliverable`, `.ai-glossary`, `.ai-team-briefs` styling. If AI fails, reports generate gracefully without the AI section.

### Chatbot Capabilities
The OmniChatbot supports 140+ action types covering: Shopify store management (CRUD products/collections/pages/variants/stock), code editing (fix_code, inspect_code, analyze_component), UI modification (modify_ui scans frontend src + public CSS + backend .ts files), CMS management (update_cms, update_cms_batch), Shopify theme editing (read/edit/create theme files, CSS, settings), brand generation (CSS, guide, kit), SEO (audit, schemas, metas, alt texts, keywords, blog), pricing (COGS with real Google Search data, simulator, competitive), email marketing (Klaviyo flows, templates), inventory management, competitor analysis + auto-discovery via Google Search, virtual try-on, user management, and full store setup automation. The `modify_ui` action uses Claude to analyze the codebase and generate exact code changes, applying them directly to files with backup creation. maxTokens: 16384. File uploads: images, videos, documents. Three report templates: classic, elegance, prestige.

### COGS & Pricing Intelligence
The COGS estimation system (`estimate_cogs`) uses a two-phase approach: (1) Gemini with Google Search performs 3 parallel real-time searches for material prices, shipping rates, and supplier costs, (2) Claude analyzes the real market data and calculates detailed cost breakdowns for two scenarios (own equipment vs external service). The `calculate_optimal_price` system also uses Gemini Search for competitor prices and supplier costs. All research includes `researchWarnings` for transparency when data is partial. SSRF protection via `isSafePublicUrl()` blocks internal/private IPs. The `apply-price` endpoint uses the multi-platform connector (falls back to Shopify direct API). Psychological pricing algorithm uses proper bracket-based rounding. Return cost calculation includes return shipping and restocking costs.

### Competitor Auto-Discovery
The `discover_competitors` action uses Gemini with Google Search to automatically find 8-12 real competitors in the same niche without user input. Discovered competitors are automatically registered in `competitorsTable` and can be scanned individually. SSRF protection enforced on all competitor URLs before fetch. Endpoint: `POST /api/competitors/auto-discover`.

### Global Vault
A centralized "Bóveda Global" stores reports, images, and research from projects and external entities, managed via a `project_files` database table and accessible through API routes and a dedicated frontend page (`/admin/vault`). Pre-informes (lead_prereport) appear as external entities with full View/PDF/Download actions. File types: image, seo_report, seo_audit, redesign, ab_test, email, pricing_report, audit, consistency, bulk_export, product_card, research, competitor, report, lead_prereport, generator, web_lab.

### Universal Search (`/admin/search`)
A standalone search and audit tool accessible from the sidebar ("Buscador Universal"). Allows searching/analyzing any URL, Shopify store, Instagram account, or brand name without requiring a project context. Auto-detects input type (Instagram, Shopify, URL, Brand). Uses `POST /api/shopybrain/research-entity-sync` for deep AI research (8 dimensions via Google). Results saved to vault as external entities. Recent searches persisted in localStorage.

### Universal Web Audit System
This system audits any website using the Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, storing detailed results in the `audit_results` table. Each audit contributes to ShopyBrain's learning via `learnFromOperation()`.

### Database
PostgreSQL with Drizzle ORM manages over 44 tables, including a `platform_type` column in the `projects` table for platform specificity.

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
The "ShopyBrain" is the central mega-brain that receives ALL requests, distributes them, absorbs ALL knowledge, stores/updates it, and injects accumulated intelligence into every AI call. It is a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions for e-commerce operations. **CRITICAL RULE: Zero direct Anthropic client instantiation outside `claude.ts`.** All Claude calls MUST go through one of: `askClaudeWithBrain`, `askClaudeJsonWithBrain`, `askClaudeVisionWithBrain`, or `askClaude` (when brain context is already manually injected). Each of these functions resolves the proper API key per project via `getClaudeClient`, respects the Claude queue, and — for the `*WithBrain` variants — automatically injects `buildSmartBrainContext()` + `buildBrandDnaContext()` so every AI response benefits from all accumulated knowledge. The only exceptions: `brain-ingester.ts` (the learning engine itself — injecting brain context would be circular) uses `getClaudeClient(0)` directly, and `absorber.ts` vision calls use `getClaudeClient` with manual brain context injection for URL-based images. Claude model name centralized in `CLAUDE_MODEL` constant (configurable via `CLAUDE_MODEL` env var). The `BrainUseCase` type includes all valid use cases: redesign, seo, pricing, images, general, inventory, competitors, intelligence, ab_testing, ecommerce, cogs_estimation, ab_test_prediction, financial, email_content, brand_analysis, consistency, web_lab, generator.

### TypeScript Build Status
**Zero TypeScript errors** — full strict `tsc --noEmit` passes cleanly. DB column property mappings: `storeName`→`name`, `shopifyDomain`→`shopDomain`, `niche`→`storeNiche`, `shopName`→`name`, `packaging`→`packagingCost`, `shippingDomestic`→`shippingCostDomestic`. PageSpeedResult uses `performanceScore` (not `score`) and `coreWebVitals` (not `metrics`). `askClaudeJsonWithBrain` signature: `(projectId, prompt, systemPrompt, useCase, niche, maxTokens)`. `buildBrandDnaContext` takes `BrandProfile` object (not projectId number). `buildShopyBrainContext` takes `(niche?, useCase?, userQuery?, platformType?)` — all strings.

### Lab Web (`/projects/:id/web-lab`)
A deep web design analysis tool that extracts real HTML+CSS from any URL (inline `<style>` + external `.css` files), runs PageSpeed + scraper analysis, and sends the actual code to Claude for professional design review. Outputs: improved CSS (copy-paste-ready .css file), improved HTML fragments, professional report with template selection (Classic/Elegance/Prestige), and before/after visual preview. Everything saves to Vault + ShopyBrain learns from each analysis. Backend: `web-lab.ts` with `extractFullWebContent()`, `runWebLabAnalysis()`. Frontend: `WebLab.tsx` with 4 tabs (Summary, CSS, HTML, Preview). Chatbot action: `analyze_web_design`. Download endpoints: CSS, HTML, report, ZIP pack.

### Universal Generator (`/projects/:id/generator`)
A comprehensive content generation tool with 41 types across 9 categories: SEO (8), Informes (7), Marca & Diseño (7), Competencia (3), Finanzas (3), Contenido (5), Datos (4), Análisis Externo (2), Agencia (2). Every generation: (1) produces professional downloadable content, (2) saves to Vault, (3) triggers `learnFromOperation` for ShopyBrain. Supports external URLs for competitive analysis. **5-Level Report System**: Level 1 (Diagnóstico/base), Level 2 (Guía Implementación), Level 3 (Contenido Producido), Level 4 (Premium Full), Level 5 (Enterprise/Roadmap 12 meses). Levels 2-5 generate multiple vault files per report. Level selector UI with 5 buttons in the generator. Only report-capable categories (seo, informes, competencia, finanzas, contenido, agencia, externo with html output) support leveled generation; data exports and CSS remain unaffected. API: `POST /api/generator/run` (accepts `level` param), `POST /api/generator/levels`, `GET /api/generator/types`, `GET /api/generator/history/:id`. Chatbot action: `run_universal_generator`, `run_leveled_report`. Frontend: `UniversalGenerator.tsx`.

### Fusion Studio (Image Analysis Engine)
AI-powered image decomposition engine using Claude Vision. Analyzes images to extract: layers, color palettes (dominant/temperature/harmony), textures (material/finish), composition (layout/perspective/lighting), product metadata (category/materials/audience/price range), and product generation suggestions (title/description/tags/price/photo briefs/SEO keywords). Backend: `fusion-studio.ts` (lib) with `analyzeImageForFusion()`, `fusion-studio.ts` (route) with `/fusion-studio/analyze` and `/fusion-studio/create-product` endpoints. Chatbot actions: `fusion_analyze`, `fusion_create_product`. SSRF protection enforced on all image URLs.

### File Upload System
Universal file processor with multer integration. Supports: text files (txt, md, csv, json, xml, html, css, js, ts, etc.), images (png, jpg, gif, webp, svg), spreadsheets (xlsx, xls via ExcelJS), and PDFs. Endpoint: `POST /api/shopybrain/upload` (multipart form with `file` field). Max file size: 20MB. Backend: `file-processor.ts` with `processUploadedFile()`.

### Brand CSS & Kit System (`brand-css-generator.ts`)
Generates personalized CSS files (700+ lines), brand identity guides (HTML/PDF), and complete brand kits (ZIP with CSS + Guide + Tokens + Liquid section). Functions: `fetchBrandProfile()`, `generateBrandCss()`, `generateBrandGuideHtml()`, `generateAiBrandCss()`, `buildBrandDnaContext()`. Endpoints: `/api/exports/brand-css/:id`, `/api/exports/brand-guide/:id`, `/api/exports/brand-kit/:id`, `/api/exports/brand-kit-full/:id`. All AI reports inject brand DNA for personalized CSS code blocks.

### Pre-Informe System (Lead Contact Form)
When a lead submits the landing contact form, the system generates a professional AI pre-informe: (1) Gemini researches the business, market, and SEO, (2) Claude restructures the raw data into professional HTML with prestige CSS classes (ai-analysis, action-item, ai-deliverable, etc.), (3) Claude generates a 100/100 Shopify SEO product sample with ALL metadata fields (meta title, meta description, handle, Schema JSON-LD, Open Graph, alt text, FAQ Schema, keywords, variants), (4) For service businesses (consulting, marketing, fitness, etc.), the system adapts to generate service packs/plans instead of physical products and creates AI image generation prompts. Pre-informes are saved to the vault (`project_files` table with `projectId=null`, `category=lead_prereport`) and sent via email to `craftershopy@gmail.com`. Admin endpoints: `GET /api/lead-reports` (list all), `GET /api/lead-reports/:id/download` (HTML), `GET /api/lead-reports/:id/download?format=pdf` (PDF). Backend: `contact.ts`.

### Key Features
Core features include a Client Portal, a visual CMS Editor with AI copywriting, a secure Client Invite Flow, an AI-powered Professional Budget/Invoice Generator, and a full AI Pipeline for Shopify Product Creation (including AI-generated content, pricing, SEO, images, and variants). Other features encompass AI Creative Director Image System, Reference Image Generation System, Virtual Try-On / OOTD System, Audit-First Brain Actions, Page and Theme Management, Purchase Protection, Deep Inventory & Sales Control, Sales Report by Product/Variant (tallas, colores, tamaños, planes, idiomas — any option type with PDF export), Supplier Research, PDF Commercial Reports, and Universal Export/Download systems with unified branding. The platform also includes an AI Economist for optimal pricing, A/B Testing, Price Simulator & P&L Forecast, Comprehensive COGS System, Partial Redesign capabilities, Automated Cron Jobs, and a Copyright Audit System.

### Security
The platform uses AES-256-GCM encryption for sensitive credentials, audit logging, database-backed rate limiting, AI API concurrency queues with exponential backoff, admin route protection, CORS, secure session management, SVG sanitization, PostMessage origin validation, and HTML escaping for XSS protection. Admin credentials stored exclusively in environment variables (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`) — no hardcoded passwords in source code. WooCommerce connector includes request rate limiting (200ms min interval) with retry + backoff for 429s.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.