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
- CORS is restricted to `REPLIT_DOMAINS` in production.
- Session management uses `httpOnly`, `sameSite: strict`, `secure: true` in production.
- SVG content from AI is sanitized to remove scripts.

### AI Stack — OmniCore (ShopyBrain) + Gemini Research
A three-model pipeline: Gemini → Claude → OmniCore, with integrations for image generation.
- **Gemini (`gemini-3.1-pro-preview`, `gemini-2.5-flash`)**: Primarily for research, market intelligence, competitor analysis, and product trends.
- **Claude (`claude-sonnet-4-5`)**: Used for strategic analysis, content generation, and incorporating ShopyBrain context.
- **Replicate (Flux, Recraft)**: For generating product and lifestyle images.
- **OmniCore**: The central "brain" for permanent memory, absorbing all AI outputs and analysis into `omnicore_memories` or `omnicore_absorbed_content`.

### OmniCore Floating AI Chatbot
A universal, multi-model chatbot accessible from all admin pages, capable of absorbing and analyzing various content types:
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

### Shopify Billing Flow
Admins can generate Shopify checkout links for services, linking directly to Shopify product variants configured in the CFO dashboard.

### Store Disconnect / Reconnect
Provides functionality to disconnect a Shopify store without data loss and to reconnect with new credentials, or to fully delete a project and its associated data.

### Shopify Product Creation
Admin can create new products directly in any connected Shopify store via the Audit page ("Crear Producto" button). Features:
- Full product form: title, price, compare-at-price, vendor, product type, tags, SKU, weight, inventory, shipping, status (draft/active).
- AI-powered content generation: When "ShopyBrain genera el contenido" toggle is enabled (default), Claude generates optimized title, HTML description, tags, SEO title, and meta description using the store's niche, brand tone, and accumulated OmniCore knowledge.
- Variant support: Up to 3 options (e.g., Size, Color) with automatic Cartesian variant generation (100-variant Shopify limit enforced).
- Auto-audit: Created products are immediately audited and scored (A-F grade) and stored in the local database.
- Success screen shows audit score, Shopify admin link, and option to create another product.
- Endpoint: `POST /projects/:projectId/products/create`

### Shopify Pagination
Utilizes cursor-based pagination (`page_info` from `Link` header) for all Shopify product listings.

### Landing Page Sections
8 core sections: Hero, Engines, Demo, Results, Pricing, Clients, Contact (with lead form integration), and CTA.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model for analysis and content generation.
- **Replicate**: For image generation (Flux, Recraft).
- **Shopify**: Storefront API for checkout links and Admin API for product creation.
- **Klaviyo**: For email flow integration and lead form notifications.
- **connect-pg-simple**: PostgreSQL session store.
- **express-session**, **bcryptjs**, **sharp**, **pino**, **zod**, **drizzle-orm**, **orval**: Core libraries and utilities.
- **@google/genai**: For direct Gemini API integration.