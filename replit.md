# Shopy Crafter Agency Platform

## Overview
Shopy Crafter (shopycrafter.com) is a multi-user Shopify AI optimization agency platform for `admin` and `client` roles. Public name: "Shopy Crafter"; internal AI engine: "ShopyBrain". It utilizes a Dual AI Engine (Gemini + Claude) for market research, competitor analysis, product trend identification, and content generation. The platform integrates with Shopify to provide comprehensive business intelligence and automation, aiming to maximize ROI for Shopify stores through AI-driven insights and actions.

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
PostgreSQL with Drizzle ORM, utilizing over 44 tables for user management, project data, product information, deep inventory tracking, sales analytics, and extensive AI-related memory and insight storage.

### AI Stack (Single Brain Architecture)
A **Dual AI Engine** architecture integrates Claude and Gemini for superior output and also integrates with Replicate for image generation.
- **Dual AI Engine**: Supports `parallel_synthesis`, `gemini_research_claude_redact`, `claude_only`, `gemini_only` modes with graceful fallback.
- **ShopyBrain (SINGLE BRAIN)**: The central AI "brain" for all AI calls, utilizing 46,000+ knowledge insights and 79+ chatbot actions for Shopify CRUD, product redesign, A/B testing, SEO intelligence, pricing intelligence, image generation, email marketing, competitor analysis, copyright audit, and full store setup. Every operation passes through ShopyBrain context (`askClaudeWithBrain`/`askClaudeJsonWithBrain`), executes, then learns via `learnFromOperation`. NEVER use `askClaude()` directly.
- **Knowledge Search Engine**: Smart keyword-based relevance search across insights, used to build AI contexts.
- **Brain Sync System**: Infrastructure for full brain import/export/sync, including self-knowledge injection and Shopify service product creation.
- **Retroactive Learning (Deep)**: Chatbot actions trigger `learnFromOperation()` to categorize results and extract structured data. Conversations feed the brain via `learnFromConversation()`, detecting explicit instructions and insights. Includes `learn_from_url`, `learn_from_content`, `recall_knowledge`, and `brain_status` actions.
- **Landing Pre-Report System**: Generates AI pre-reports for leads from contact form submissions, including business research, market analysis, SEO audit, and product sample optimization.

### Key Features
- **Client Portal**: Provides KPI summaries and activity timelines.
- **CMS Editor**: Visual content editor with AI copywriting and version history.
- **AI-Powered Lead Pre-Report**: Generates detailed pre-reports for landing form submissions.
- **Client Invite Flow**: Secure, token-based onboarding.
- **Professional Budget/Invoice Generator**: AI-powered tool.
- **Shopify Product Creation (Full AI Pipeline)**: Automates product creation with AI-generated content, pricing, SEO, images, and niche-specific variants with inventory. Supports `referenceImageUrl` for generating images from a real product photo.
- **Reference Image Generation System**: Uses OpenAI gpt-image-1 to generate professional product photos from a reference image. Adapts scenes by product type (ropa: modelo frontal/trasera/lateral/lifestyle/flat-lay/detalle; calzado: hero/modelo/par/suela/lifestyle/textura; joyería: elegante/modelo/escala/macro/regalo; cosmética/comida/electrónica/genérico). New chatbot action `generate_images_from_reference` + integrated into `create_product`. SSE streaming progress. Auto-uploads to Shopify.
- **Audit-First Brain Actions**: `store_status`, `list_products`, `search_product`, `edit_product`, `publish_product` all include audit fields (score, grade, issues, published status, compare_at_price). Three new bulk actions: `audit_store` (deep audit with scores/grades/critical issues), `fix_unpublished` (bulk-publish hidden products), `fix_missing_compare_prices` (auto-calculate and set compare_at_price). OmniChatbot formatters display all audit data with grade icons and warnings.
- **GraphQL Product Discovery**: `audit_store`, `fix_unpublished`, and `fix_missing_compare_prices` use Shopify GraphQL API with cursor pagination to find ALL products including those not published to Online Store channel (REST API only returns products with `published_scope=global`). Falls back to REST API on GraphQL failure. `shopifyGraphQL()` in `shopify.ts` has bounded 401 retry (single refresh attempt).
- **Deep Inventory & Sales Control System**: Professional-grade stock management with 6 chatbot actions for syncing, alerts, reporting, sales analytics, and customer history.
- **Supplier Research System**: AI-driven intelligence.
- **PDF Commercial Report**: 17-page A4 dark-theme PDFKit report with detailed analysis for Comic Crafter.
- **Universal Export System**: Generates a 9-page paginated comprehensive audit report with AI deep analysis, including executive summary, SEO audit, financial analysis, price optimization, and strategic recommendations. **Auto-Save to Vault**: All 14 report types are automatically saved to `projectFilesTable` vault on generation. **Brain Action Vault Save**: All chatbot brain actions (except destructive/config ops) auto-save their results as JSON to vault (`fileType: "brain_action"`). **External Store Analysis** (`analyze_external_store`): Full analysis of ANY store without Shopify connection. Reports queryable via `/projects/:id/vault?fileType=report|brain_action|research|analysis` with category filtering.
- **Vault Professional Download System**: Multi-tier download system in `ProjectVault.tsx` with: (1) Individual file download, (2) Multi-select mode with checkboxes to pick specific files then download as ZIP, (3) Per-folder "Descargar ZIP" button on each folder card, (4) "Descargar todo" for full vault ZIP with all files. Backend: `POST /projects/:id/vault/download-selected` accepts `{fileIds: number[]}` or `{folderTypes: string[]}`. Frontend: Sticky selection toolbar with count, "Seleccionar todos", "Descargar selección", and "Limpiar" buttons. Folder view and list view both support selection.
- **Universal Action Buttons (Enviar/Guardar/Descargar)**: Three action buttons appear below EVERY chatbot action result. **Enviar** (📧 blue): Sends result as professional HTML email via Gmail to admin. **Guardar** (💾 green): Saves result as professional HTML report + raw JSON data to vault. **Descargar** (📥 gold): Downloads as professional HTML file for single reports, or as a complete ZIP bundle for full audits (includes 10 HTML reports, CSV, JSON data exports, vault images, and README). Backend routes: `POST /api/projects/:id/actions/send|save|download`. Frontend: `ActionButtons` component in `OmniChatbot.tsx`. Files: `action-buttons.ts` (backend), `OmniChatbot.tsx` (frontend).
- **100/100 Quality Standard + Semrush SEO Intelligence**: Integrates Semrush-inspired methodology for SEO scoring (16 weighted criteria) and product auditing (7 weighted dimensions), ensuring high-quality content and optimization.
- **AI Economist with Market Research**: Calculates optimal prices using parallel Gemini searches and Claude analysis.
- **A/B Testing (Image + Price)**: Supports image and price variant tests with AI-generated impact predictions.
- **Price Simulator & P&L Forecast**: Tools for financial analysis and scenario simulation.
- **Comprehensive COGS System**: Detailed cost of goods sold tracking with AI auto-estimation.
- **Partial Redesign**: Allows users to select specific product attributes for AI-driven redesign.
- **Automated Cron Jobs**: Twelve tasks for continuous learning and intelligence.

### Copyright Audit System
The `copyright_audit` brain action fetches all products via Shopify GraphQL API, then uses `askClaudeJsonWithBrain` to detect trademark/IP risks (registered brands like Funko, Disney, Marvel, etc.), suggest alternative safe names, and classify risks by severity (alta/media/baja). Available via quick action button in OmniChatbot and natural language triggers.

### Pricing Plans
Four subscription plans: Emprendedor (€19/mes, 5 products/month, 10 images), Growth Studio (€297/mes), Performance Lab (€597/mes), Enterprise (€997/mes). Plus one-time plans: Photoshoot Pro (€497), Auditoría Completa (€297), Rediseño IA (€397), Pack Imágenes (€197), SEO Completa (€347), Informe Precios (€197), Email Marketing (€297).

### Service Delivery Audit
All Shopify service products are fully deliverable via the chatbot's 79+ actions, including Photoshoot Pro, Growth Studio, Performance Lab, Auditoría Completa, Rediseño IA 30 Productos, Pack 30 Imágenes IA, SEO Completa, Informe Precios, and Email Marketing.

### Security
- AES-256-GCM encryption for ALL credentials in DB: `accessToken`, `clientSecret`, `replicateApiToken`, `anthropicApiKey` — all encrypted at rest via `encrypt()` from `lib/crypto.ts`. Uses `ENCRYPTION_KEY` env secret (64-char hex = 32 bytes).
- Startup migration (`migrateTokenEncryption()` in `index.ts`) auto-detects and encrypts any plaintext tokens.
- API responses NEVER expose raw tokens: `accessToken: undefined` in project responses, reveal-token endpoint shows only first 8 + last 4 chars masked.
- `safeDecrypt()` used in all read paths to handle both encrypted and legacy plaintext values.
- Comprehensive audit logging.
- Database-backed rate limiting for all endpoints.
- AI API concurrency queues and exponential backoff.
- Admin route protection, CORS, and secure session management.
- SVG sanitization, PostMessage origin validation, HTML escaping, and protection against common web vulnerabilities.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1 (Replit AI Integration)**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.

### Product Optimization Status (March 30, 2026)
- **Batch Optimization**: 50/50 products optimized 10/10 with ZERO errors
- **Total Description Characters**: 409,478 (avg ~8,190 per product)
- **Total SEO Tags**: 1,280 (avg ~25.6 per product)
- **Total Variants Created**: 490 intelligent variants (avg ~9.8 per product)
- **Total Alt Texts**: 178 image alt texts generated
- **Image Generation**: 76 images (19 products × 4 types) via Replicate recraft-v3
- **Async Batch System**: `optimize_all_products` action runs in background, returns immediate response, processes sequentially (~2min/product via Dual AI)
- **Brain Learning**: Each optimization triggers `learnFromOperation` + vault save