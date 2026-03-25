# ShopyBrain Agency Platform

## Overview
ShopyBrain is a multi-user Shopify AI optimization agency platform designed to enhance e-commerce operations. It operates with two primary roles: `admin` (full access across all stores and AI engines) and `client` (read-only, per-store access with approval workflows). The platform uses real data exclusively, with no simulations.

Its core purpose is to leverage advanced AI models (Gemini, Claude, OmniCore) for in-depth market research, competitor analysis, product trend identification, and content generation, all integrated with Shopify's ecosystem. ShopyBrain aims to provide comprehensive business intelligence and automation for Shopify stores, driving optimization and strategic growth for agencies and their clients.

## User Preferences
- Admin credentials: `sadiagiljoan@gmail.com` / `ShopyAdmin2026!`
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

### Database
PostgreSQL with Drizzle ORM, featuring over 42 tables, including: `users`, `projects`, `products`, `omnicore_memories`, `omnicore_insights`, `omnicore_knowledge_domains`, `omnicore_niche_profiles`, `omnicore_prompt_library`, `omnicore_study_sessions`, `omnicore_cross_connections`, `service_catalog`, `agency_cost_structure`, `revenue_snapshots`, `email_flows`, `user_sessions`, `cms_content`, `competitors`, `inventory_tracking`, `ab_tests`, `forecasts`, `project_files`, `achievements`.

### Security
- AES-256-GCM encryption for all credentials using `ENCRYPTION_KEY`.
- Admin routes are protected by `requireAdmin` middleware.
- CORS allows both `APP_URL` (custom domain `shopycrafter.com`) and `REPLIT_DOMAINS` in production.
- Session management uses `httpOnly`, `sameSite: strict`, `secure: true` in production.
- SVG content from AI is sanitized to remove scripts.

### AI Stack — OmniCore (ShopyBrain) + Gemini Research
A three-model pipeline: Gemini → Claude → OmniCore, with integrations for image generation.
- **Gemini (`gemini-3.1-pro-preview`, `gemini-2.5-flash`)**: Primarily for research, market intelligence, competitor analysis, and product trends.
- **Claude (`claude-sonnet-4-5`)**: Used for strategic analysis, content generation, and incorporating ShopyBrain context.
- **Replicate (Flux, Recraft)**: For generating product and lifestyle images.
- **OmniCore**: The central "brain" for permanent memory, absorbing all AI outputs and analysis into `omnicore_memories` or `omnicore_absorbed_content`.

### OmniCore Floating AI Chatbot (with Shopify Action Execution)
A universal, multi-model chatbot accessible from all admin pages, capable of absorbing/analyzing content AND executing Shopify operations:
- **Shopify Actions via Chat**: Create/edit/delete/publish products, change prices, regenerate tokens, list products/orders, view scopes — all through natural language commands. Claude detects action intents and returns `:::ACTION:::` blocks that the frontend auto-executes via `/api/shopybrain/execute-action`.
- **Voice Commands**: VoiceButton uses SpeechRecognition → backend intent parsing → action execution → speech synthesis response.
- **Command Center**: Dedicated page at `/admin/command-center` with buttons for all Shopify operations + free-text command input.
- **Images/Videos**: Analyzed by Claude Opus Vision and Gemini for composition, style, brand, and eCommerce signals.
- **URLs (Websites, Social Media)**: Fetched and analyzed by Gemini for content, brand identity, marketing strategy, and audience engagement.
- **Text**: Analyzed by Gemini for themes and insights.
All findings are permanently stored in `omnicore_absorbed_content` for ShopyBrain's memory.

### Entity Research Engine
A deep absorption engine for brands, competitors, or influencers triggered via the chatbot. It follows an 8-phase flow:
1. Entity detection.
2. Loading existing knowledge.
3. Parallel Google Search Grounding across 8 categories.
4. Gemini identifies knowledge gaps.
5. Claude synthesizes structured JSON profiles.
6. Upserting entity memories and absorbed content.
7. Responding with `knowledgeReuse` metrics.

### OmniCore Chatbot Guide Assistant
The OmniChatbot has full app-guide knowledge injected (via `app-guide.ts`). It detects the current page route (`useLocation` from wouter) and sends it to the backend. When users ask help questions (detected by `detectGuideRequest`), the full APP_GUIDE_KNOWLEDGE is injected into Claude's system prompt along with PAGE_CONTEXT for the current route. This makes the chatbot a context-aware assistant that guides users step-by-step with exact button names and locations.

### ShopyBrain Cron Jobs (10 total)
Automated tasks for continuous learning, consolidation, cross-synthesis, revenue snapshots, data integration, competitor scans (6am daily with auto-alerts), inventory sync, and weekly mega-synthesis.

### Price Simulator & P&L Forecast
- **Price Simulator**: `POST /projects/:id/products/:pid/price-simulator` — simulates 3 scenarios (pessimistic/base/optimistic) with break-even and margin analysis.
- **Price Elasticity**: `GET /projects/:id/products/:pid/price-elasticity` — uses `price_history` table + Shopify orders (90d) to calculate elasticity coefficient.
- **P&L Forecast**: `POST /projects/:id/financial-forecast` — 3/6/12-month forecast with 3 scenarios based on current revenue/orders/COGS.
- **Financial Dashboard Fix**: Uses real Shopify order data to calculate per-product units sold (no more hardcoded values). Total COGS computed from actual units × per-unit COGS.

### Comprehensive COGS System (30+ fields)
The `cogs` table supports real-world cost structures for any business type with 9 categories:
1. **Producción**: unitCost, materialCost, fabricCost, printingCost, screenPrintingCost, moldAmortization, assemblyCost, laborCostPerUnit, qualityControlCost
2. **Embalaje**: packagingCost, labelCost
3. **Logística**: shippingCostDomestic, shippingCostInternational, fulfillmentFee, warehouseCostPerUnit, customsDuty, insuranceCost
4. **Devoluciones**: returnRate, returnProcessingCost (computed as rate × cost)
5. **Plataforma**: shopifyPaymentFee (% of price), shopifyPlanCostPerOrder, paymentProcessingFee, platformCommission
6. **Marketing**: cac, affiliateFee, digitalMarketingCost, influencerCostPerUnit, seoCostPerUnit
7. **Impuestos/Legal**: vatRate (default 21% IVA España), corporateTaxRate, consultingFee, legalCostPerUnit
8. **Tech/IA**: aiApiCostPerUnit, designCostPerUnit
9. **Overhead**: overheadPerUnit
- **customCosts**: JSONB array for unlimited custom cost lines (name + cost)
- **Computed**: totalCogs, totalCogsWithVat, breakEvenPrice, breakEvenPriceWithVat, minimumViablePrice (+15%)
- Frontend: Accordion-based CogsModal with collapsible categories, live subtotal, IVA calculation, margin display, and category breakdown bars.

### BrandDNA Auto-Injection
The `visualDnaTable` stores extracted visual identity (background style, lighting, colors, mood, composition). `buildBrandDnaContext()` in claude.ts auto-injects this DNA into all `askClaudeWithBrain` and `askClaudeJsonWithBrain` calls, ensuring brand consistency across redesign, images, SEO, and email generation.

### Pricing Model
A multi-tiered pricing structure (Starter, Agency Pro, Enterprise, One-Shot Audit) with monthly retainers and one-time setup fees, visible on the landing page and managed through the CMS.

### CMS Editor (`/admin/cms`)
Full visual content editor for the landing page with live iframe preview.
- **Field types**: text, textarea, color, boolean, url, image (drag & drop upload)
- **Image upload**: `/api/cms/media/upload` with Sharp → WebP, 5MB limit, stored in `public/media/`
- **Sections**: Sitio (logo image + emoji), Hero (image), Motores (per-engine images), Estadísticas, Cómo funciona, Precios, Testimonios (avatar images), CTA Final, Footer
- **Preview mode**: Iframe loads `/landing?preview=true` — suppresses admin UI, shows public nav; supports `postMessage` for section navigation from editor
- **AI Copywriting**: Each text field has IA button for Claude-powered copy improvement
- **Version history**: Up to 30 versions, restore any version, batch save

### Email Template Studio (`/admin/emails`)
Professional AI-powered email template editor with 26 template types across 4 categories:
- **Categories**: Agencia (welcome-client, invite, onboarding, reports, proposals), eCommerce (abandoned cart, order confirmation, post-purchase, reviews, win-back, VIP, product launch, flash sale, back-in-stock, price drop), Transaccional (shipping, password reset, account created, subscription), Campaña (seasonal, newsletter, referral, loyalty)
- **Brand-aware AI generation**: Uses `askClaudeJsonWithBrain` — injects BrandDNA + OmniCore knowledge + ShopyBrain context for professional copy
- **Brand identity panel**: Logo URL, brand name, tagline, 4-color picker (primary/accent/dark/light)
- **Professional HTML output**: Table-based responsive layout, inline CSS, 600px max, dark theme with brand colors
- **Preview system**: Desktop/mobile toggle, inbox simulation (sender, subject, preview text), live iframe
- **Subject A/B testing**: Two subject line variants generated with copywriting strategy notes
- **Klaviyo push**: Creates templates directly in Klaviyo via API
- **CRUD**: Gallery view with favorites, duplicates, categories, version tracking
- **DB**: `email_templates` table. Backend: `email-templates.ts`. Frontend: `EmailTemplates.tsx`
- **Legacy flows**: Old flow editor still accessible at `/admin/email-flows` via `Emails.tsx`

### Client Invite Flow
Unique, single-use invite links per store:
- **Token**: 64-char `randomBytes(32)`, always unique per invite
- **Expiry**: 48 hours from creation
- **Email**: Auto-sent via Klaviyo (`Client Invite` metric) with invite URL, store name, and client name; falls back to manual copy if Klaviyo fails
- **Setup**: `/invite/:token` → validates token → shows store banner → client sets password → token consumed (`inviteToken: null`) → session established as `role: client` with `clientId` → redirects to `/client` (NOT /admin)
- **Client access**: Only their project's data (dashboard, products, approvals, messages). Admin endpoints return `Forbidden`.
- **Admin view**: `AdminClients.tsx` — invite modal, client table, Chat, Propuesta, Cobrar, Activar/Revocar

### Shopify Billing Flow
Admins can generate Shopify checkout links for services, linking directly to Shopify product variants configured in the CFO dashboard.

### Store Disconnect / Reconnect
Provides functionality to disconnect a Shopify store without data loss (`?mode=dissociate` clears credentials, keeps products/COGS/SEO/images) and to reconnect with new credentials, or to fully delete a project and its associated data (`?mode=full` CASCADE deletes everything).

### Professional Export Center
Full export system at `/projects/:id/exports` with 8 report types:
- **Informe Completo**: Executive summary with all project data
- **SEO Técnico**: Grade distribution, Schema/alt-text coverage, per-product scores, strategic recommendations
- **Catálogo de Productos**: Full inventory with prices, COGS, margins, SEO grades, image counts
- **Financiero y COGS**: Per-product COGS breakdown, margin analysis, price change history
- **Brand Brief & Estrategia**: Identity document with niche, tone, audience, catalog overview
- **A/B Testing**: Test history with types, winners, improvement percentages
- **Galería de Imágenes IA**: Visual catalog of AI-generated images with models and alt texts
- **CSV Products**: Excel-compatible spreadsheet with all product data
Reports are professional HTML with gold/black branding, print-ready CSS for PDF conversion. Backend: `exports.ts`. Frontend: `ExportCenter.tsx`.

### Shopify Product Creation
Admin can create new products directly in any connected Shopify store via the Audit page ("Crear Producto" button). Features:
- Full product form: title, price, compare-at-price, vendor, product type, tags, SKU, weight, inventory, shipping, status (draft/active).
- AI-powered content generation: When "ShopyBrain genera el contenido" toggle is enabled (default), Claude generates optimized title, HTML description, tags, SEO title, and meta description using the store's niche, brand tone, and accumulated OmniCore knowledge.
- Variant support: Up to 3 options (e.g., Size, Color) with automatic Cartesian variant generation (100-variant Shopify limit enforced).
- Auto-audit: Created products are immediately audited and scored (A-F grade) and stored in the local database.
- Success screen shows audit score, Shopify admin link, and option to create another product.
- Endpoint: `POST /projects/:projectId/products/create`

### Image-to-Product Creation (Chat)
Users can drag/drop or attach a product photo in the OmniChatbot and say "créame un producto con esta foto" to trigger an automated pipeline:
1. **Claude Vision** deep-analyzes the image (product identification, materials, quality tier, target market, features, comparable products)
2. **Gemini + Google Search** researches REAL market prices from actual stores (Amazon, Zalando, etc.) — never invented prices
3. **Claude Copywriting** generates SEO-optimized title, HTML description, tags using store BrandDNA
4. **Shopify API** creates the product as draft with the image attached and competitive pricing
- Intent detection: Recognizes Spanish/English create+product keywords when an image is attached
- Requires active project in URL (`/projects/:id/...`)
- Shows pricing sources, market average, justification, and competitive position in chat response
- Product saved to ShopyBrain memory for future reference
- Endpoint: `POST /api/shopybrain/create-product-from-image`
- Files: `absorber.ts` (endpoint), `OmniChatbot.tsx` (intent detection + UI)

### Supplier Research System
Real-time supplier intelligence integrated into the chatbot and action execution system:
- **Endpoint**: `POST /api/shopybrain/supplier-research` — 3 parallel Gemini+Search queries:
  1. Supplier search (Alibaba, AliExpress, DHgate, Made-in-China, European suppliers)
  2. Production/logistics costs (manufacturing, packaging, shipping, customs, warehousing)
  3. Deals/promotions (volume discounts, free samples, trade fairs)
- **Claude synthesis**: Analyzes all data to produce top recommendation, cost breakdown, strategy, risks, next steps
- **Report download**: `POST /api/shopybrain/supplier-report` — generates professional HTML report with gold/black branding, print-ready CSS
- **Chat integration**: Say "busca proveedores de X" in the OmniChatbot → automatic execution + download button for report
- **Action**: `search_suppliers` in execute-action endpoint with params: productName, productCategory, materials, targetMarket, qualityTier, budget, country
- All results saved permanently in ShopyBrain memory (type: `supplier_intelligence`)
- Files: `absorber.ts` (endpoints), `shopybrain.ts` (action), `OmniChatbot.tsx` (UI + download)

### Universal Export System (Centro de Exportación)
Complete export hub at `/projects/:id/exports` with 24 export options across 4 categories:
- **Paquete Completo**: ZIP file containing ALL 13 HTML reports + CSV + JSON data in one download
- **13 Informes Profesionales (HTML)**: Informe Completo, SEO Técnico, Catálogo Productos, Financiero/COGS, Brand Brief, Competidores, Consistencia/ADN Marca, Inventario, Rediseños IA, Revenue/Forecast, A/B Testing, Galería Imágenes IA, ShopyBrain Intelligence
- **5 Exportaciones de Datos**: CSV Productos, JSON Productos, JSON Full, Excel Productos (XLSX), Excel Completo (XLSX multi-hoja)
- **5 Descarga de Imágenes**: PNG, JPG, WebP, AVIF, TIFF — batch ZIP download with format conversion via sharp (quality 100%)
- XLSX exports use ExcelJS with conditional colors, auto-filters, multi-sheet workbooks, gold/black header styling
- All HTML reports use gold/black professional branding with print-ready CSS for PDF conversion
- ZIP endpoint uses `archiver` to bundle everything server-side
- Files: `exports.ts` (backend routes), `ExportCenter.tsx` (frontend UI), `vault.ts` (image downloads)

### Shopify Pagination
Utilizes cursor-based pagination (`page_info` from `Link` header) for all Shopify product listings.

### Landing Page Sections
8 core sections: Hero, Engines, Demo, Results, Pricing, Clients, Contact (with lead form integration), and CTA.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model for analysis and content generation.
- **Replicate**: For image generation (Flux, Recraft).
- **Archiver**: Server-side ZIP generation for universal exports.
- **Shopify**: Storefront API for checkout links and Admin API for product creation.
- **Klaviyo**: For email flow integration and lead form notifications.
- **connect-pg-simple**: PostgreSQL session store.
- **ExcelJS**: XLSX workbook generation with styling, conditional formatting, and multi-sheet support.
- **express-session**, **bcryptjs**, **sharp**, **pino**, **zod**, **drizzle-orm**, **orval**: Core libraries and utilities.
- **@google/genai**: For direct Gemini API integration.