# ShopyBrain Agency Platform

## Overview
ShopyBrain is a multi-user Shopify AI optimization agency platform designed to enhance e-commerce operations. It supports `admin` and `client` roles, using real data to leverage advanced AI models (Gemini, Claude, OmniCore) for market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify's ecosystem to provide comprehensive business intelligence and automation, driving optimization and strategic growth for agencies and their clients.

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
PostgreSQL with Drizzle ORM, utilizing over 42 tables for various functionalities including user management, project data, product information, and extensive AI-related memory and insight storage.

### Security
- AES-256-GCM encryption for all credentials.
- Admin routes are protected.
- CORS configured for `APP_URL` and `REPLIT_DOMAINS`.
- Secure session management (`httpOnly`, `sameSite: strict`, `secure: true` in production).
- SVG content from AI is sanitized.

### AI Stack — OmniCore (ShopyBrain) + Gemini Research
A three-model pipeline: Gemini → Claude → OmniCore, with image generation integrations.
- **Gemini**: Primarily for research, market intelligence, competitor analysis, and product trends.
- **Claude**: Used for strategic analysis, content generation, and incorporating ShopyBrain context.
- **Replicate (Flux, Recraft)**: For generating product and lifestyle images.
- **OmniCore**: The central "brain" for permanent memory, storing all AI outputs and analysis.

### OmniCore Floating AI Chatbot (with Shopify Action Execution)
A universal, multi-model chatbot accessible from all admin pages, capable of absorbing/analyzing content and executing Shopify operations through natural language commands or voice commands. All findings are permanently stored in `omnicore_absorbed_content`.

**Product Management Actions**: create, edit, delete, publish, change price, set status, search, scan/audit
**AI Content Generation + Pricing Actions**:
- `optimize_product`: AI generates professional title, description (400+ words HTML), 15+ SEO tags, meta title/description, alt texts for all images, SEO handle + **real market price research via Gemini Google Search** — compares with competitor prices and suggests competitive pricing with compare_at_price — directly updates Shopify
- `create_product`: AI generates content + **researches real market prices** when no price provided — uses Gemini Search to find competitor prices and set competitive pricing automatically
- `optimize_all_products`: Batch optimize up to 25 products at once with full AI content + pricing
- `optimize_images`: Generate SEO alt texts for all product images using AI analysis
**Collections Management Actions**:
- `create_collection`: Create custom or smart collections with AI-generated descriptions and SEO
- `list_collections`: List all custom + smart collections
- `auto_collections`: AI analyzes all products and automatically creates optimal collections
**Pages Design Actions**:
- `create_page`: Create Shopify pages (About, FAQ, Shipping, Returns, Privacy, Terms, Contact) with full AI-generated professional content
- `list_pages`: List all store pages
- `design_all_pages`: Create all essential store pages in one command
**DevOps Actions**: diagnose_app, inspect_code, fix_code, list_source_files, analyze_component

### Entity Research Engine
A deep absorption engine for brands, competitors, or influencers, triggered via the chatbot. It performs parallel Google Search Grounding, identifies knowledge gaps with Gemini, synthesizes structured JSON profiles with Claude, and upserts entity memories.

### OmniCore Chatbot Guide Assistant
The OmniChatbot acts as a context-aware assistant, providing step-by-step guidance based on injected app-guide knowledge and the current page context.

### ShopyBrain Cron Jobs
Ten automated tasks for continuous learning, data consolidation, cross-synthesis, revenue snapshots, data integration, daily competitor scans with alerts, inventory sync, and weekly mega-synthesis.

### Price Simulator & P&L Forecast
- **Price Simulator**: Simulates 3 scenarios (pessimistic/base/optimistic) with break-even and margin analysis.
- **Price Elasticity**: Calculates elasticity coefficient using price history and Shopify orders.
- **P&L Forecast**: Provides 3/6/12-month forecasts with 3 scenarios based on current financial data.
- **Financial Dashboard**: Uses real Shopify order data for accurate COGS and unit sales calculations.

### Comprehensive COGS System
A `cogs` table supports real-world cost structures with over 30 fields across 9 categories (Production, Packaging, Logistics, Returns, Platform, Marketing, Taxes/Legal, Tech/AI, Overhead), plus `customCosts` for unlimited custom cost lines. It computes `totalCogs`, `breakEvenPrice`, and `minimumViablePrice`.

### BrandDNA + OmniCore Full Knowledge Injection
The `visualDnaTable` stores extracted visual identity, which is automatically injected into ALL Claude calls (via `askClaudeWithBrain` / `askClaudeJsonWithBrain`) to ensure brand consistency. OmniCore memories (strategic insights, niche patterns, pricing data, competitor intel) are also injected into every AI call. The main OmniCore chatbot, product creation, product optimization, email generation, research, and study sessions all receive the full accumulated knowledge of ShopyBrain.

### Real Market Pricing Research
`researchRealPricing()` function in shopybrain.ts uses Gemini with Google Search grounding (threshold 0.0 = always search) to find real competitor prices for any product. This data feeds into `optimize_product` (suggests competitive pricing) and `create_product` (auto-prices new products when no price provided). The `pricing.ts` module also scrapes competitor URLs directly for real-time price extraction.

### Pricing Model
A multi-tiered pricing structure (Starter, Agency Pro, Enterprise, One-Shot Audit) with monthly retainers and one-time setup fees, managed through the CMS.

### CMS Editor (`/admin/cms`)
A visual content editor for the landing page with live iframe preview, supporting various field types (text, image, color, boolean, url). Features include image upload, AI copywriting for text fields, and version history.

### Email Template Studio (`/admin/emails`)
A professional AI-powered email template editor with 26 template types across 4 categories (Agencia, eCommerce, Transaccional, Campaña). It uses BrandDNA and OmniCore knowledge for professional copy, offers a brand identity panel, generates professional HTML output, includes a preview system, subject A/B testing, and Klaviyo push integration.

### Client Invite Flow
A unique, single-use invite link system for clients. Each token-based invite expires in 48 hours and establishes a client session with restricted access to their project's data.

### Professional Budget/Invoice Generator
Integrated as "Presupuesto / Factura" tab in `/admin/my-pricing`. Features: full client data form (name, NIF, email, phone, address), project details (store name, niche, products, collections), editable service line-items table, IVA toggle with configurable rate, Claude-powered ultra-detailed budget generation with sections, conditions, and internal profitability analysis. Exports to printable HTML (PDF via print) and downloadable HTML. Backend: `POST /api/agency/budget` in `agency.ts`.

### Shopify Billing Flow
Admins can generate Shopify checkout links for services, directly linked to product variants configured in the CFO dashboard.

### Store Disconnect / Reconnect
Functionality to dissociate a Shopify store (clears credentials, retains data) or fully delete a project and its associated data.

### Professional Export Center
A comprehensive export system at `/projects/:id/exports` offering 8 report types, including executive summaries, SEO reports, product catalogs, financial reports, and brand briefs. Reports are professional HTML with gold/black branding, print-ready for PDF conversion.

### Shopify Product Creation
Admins can create new products directly in connected Shopify stores via the Audit page. Features include a full product form, AI-powered content generation (title, description, tags, SEO), variant support, and immediate product auditing.

### Image-to-Product Creation (Chat)
Users can drag/drop a product photo into the OmniChatbot and command it to create a product. This triggers a pipeline using Claude Vision for image analysis, Gemini for market pricing research, and Claude for SEO-optimized copywriting, ultimately creating a draft product in Shopify.

### Supplier Research System
Real-time supplier intelligence integrated into the chatbot and action execution system. It performs parallel Gemini+Search queries for supplier identification, cost analysis, and deals, synthesizing data with Claude to produce recommendations and professional HTML reports.

### Universal Export System (Centro de Exportación)
A complete export hub at `/projects/:id/exports` with 24 export options across 4 categories: a ZIP file of all reports, 13 professional HTML reports, 5 data exports (CSV, JSON, XLSX), and 5 image download options (PNG, JPG, WebP, AVIF, TIFF).

### Shopify Pagination
Utilizes cursor-based pagination for all Shopify product listings.

### Landing Page Sections
8 core sections: Hero, Engines, Demo, Results, Pricing, Clients, Contact (with lead form), and CTA.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model for analysis and content generation.
- **Replicate**: For image generation (Flux, Recraft).
- **Archiver**: Server-side ZIP generation.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **connect-pg-simple**: PostgreSQL session store.
- **ExcelJS**: XLSX workbook generation.
- **express-session**, **bcryptjs**, **sharp**, **pino**, **zod**, **drizzle-orm**, **orval**: Core libraries.
- **@google/genai**: For direct Gemini API integration.