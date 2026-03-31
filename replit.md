# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform (shopycrafter.com) designed for `admin` and `client` roles. It leverages a Dual AI Engine (Gemini + Claude), internally named "ShopyBrain," for comprehensive market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify to deliver AI-driven insights and automation, aiming to significantly enhance ROI for Shopify stores. Key capabilities include AI-powered product creation, image generation, SEO optimization, and financial analysis.

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

### Multi-Platform Connector Architecture
The platform supports multiple e-commerce platforms via a connector abstraction layer:
- **Supported Platforms**: Shopify (fully implemented), PrestaShop (fully implemented), WooCommerce (fully implemented), Universal Web Audit (fully implemented), WordPress (planned)
- **IPlatformConnector Interface**: Standard interface for testConnection, getProducts, createProduct, updateProduct, deleteProduct, getProductCount, getSEO, updateSEO, uploadImage
- **ConnectorFactory**: `getConnector(project)` returns the appropriate connector based on `platformType` field
- **ShopifyConnector**: Wraps existing `shopify.ts` functions without modifying them (13 files depend on shopify.ts)
- **PrestaShopConnector**: Full implementation with XML writes / JSON reads, HTTP Basic Auth, multipart image upload, native SEO fields (meta_title, meta_description, link_rewrite, meta_keywords), stock management via stock_availables, combinations support
- **WooCommerceConnector**: Full implementation with HTTP Basic Auth (consumer key/secret), WC REST API v3, product CRUD, variations, orders, SEO (Yoast), inventory. Pagination via X-WP-Total/X-WP-TotalPages headers.
- **UniversalAuditConnector**: Read-only connector for auditing any website. Uses PageSpeed Insights API + HTML scraping + Claude AI analysis. No product CRUD. supportsFeature("audit") returns true.
- **Files**: `artifacts/api-server/src/lib/connectors/` (types.ts, shopify.ts, prestashop.ts, prestashop-xml.ts, woocommerce.ts, universal.ts, index.ts)
- **Schema**: `platformType` column on projectsTable (text, NOT NULL, default "shopify")
- **PrestaShop API Key**: Stored in `clientSecret` (encrypted), `clientId` left empty. Auth via HTTP Basic (key as username, empty password)

### Universal Web Audit System
Analyzes any website regardless of platform using Google PageSpeed Insights API + HTML scraping + AI analysis.
- **PageSpeed Service**: `artifacts/api-server/src/lib/pagespeed.ts` — runs dual mobile/desktop audits via Google PageSpeed Insights API
- **Web Scraper**: `artifacts/api-server/src/lib/web-scraper.ts` — extracts title, meta tags, OG tags, headings, images, links, JSON-LD, robots.txt, sitemap.xml. Includes SSRF protection.
- **Audit Routes**: `artifacts/api-server/src/routes/audit.ts` — POST run, GET results, GET history
- **DB Table**: `audit_results` stores all audit data including PageSpeed scores, scraping results, AI analysis, issues, and recommendations
- **Brain Learning**: Each audit triggers 3 `learnFromOperation()` calls (web_audit, performance_audit, strategic_learning)
- **NewProject UI**: "Auditoría Universal" mode requires only business name + URL (no API credentials)

### Database
PostgreSQL with Drizzle ORM, managing over 44 tables for user, project, product, inventory, sales, and extensive AI-related data. The `projects` table includes a `platform_type` column (text, not-null, default "shopify") supporting: shopify, woocommerce, prestashop, wordpress, universal.

### Multi-Platform Connector Architecture
A connector abstraction layer in `artifacts/api-server/src/connectors/` provides:
- `IPlatformConnector` interface (`types.ts`) — generic contract for platform operations (auth, products, orders, SEO, inventory, images)
- `ShopifyConnector` (`shopify.ts`) — wraps existing `shopify.ts` functions without modifying them
- `ConnectorFactory` (`index.ts`) — `getConnector(project)` returns the correct connector based on `project.platformType`
- `PlatformNotSupportedError` for unsupported platforms (woocommerce, prestashop, wordpress, universal — stubs only)
- All connectors must route AI calls through `askClaudeWithBrain` (no direct Claude bypasses)

### AI Stack (Single Brain Architecture)
A **Dual AI Engine** architecture integrates Claude and Gemini, also integrating with Replicate and OpenAI gpt-image-1 for image generation.
- **ShopyBrain**: The central AI "brain" for all AI calls, utilizing over 46,000 knowledge insights and 79+ chatbot actions for Shopify CRUD, product redesign, A/B testing, SEO intelligence, pricing intelligence, image generation, email marketing, competitor analysis, copyright audit, and full store setup. All operations pass through ShopyBrain context and facilitate learning via `learnFromOperation` and `learnFromConversation`.
- **Knowledge Search Engine**: Smart keyword-based relevance search for building AI contexts.
- **Brain Sync System**: Infrastructure for brain import/export/sync, self-knowledge injection, and Shopify service product creation.
- **Retroactive Learning (Deep)**: Chatbot actions trigger `learnFromOperation()` to categorize results and extract structured data. Conversations feed the brain via `learnFromConversation()`.
- **Landing Pre-Report System**: Generates AI pre-reports for leads from contact forms, including business research, market analysis, SEO audit, and product sample optimization.

### Key Features
- **Client Portal**: KPI summaries and activity timelines.
- **CMS Editor**: Visual click-to-edit editor with 35+ selectable elements, AI copywriting (askClaudeWithBrain), version history, iframe live preview with `data-cms-path` hover highlighting, and bidirectional postMessage communication.
- **Global CMS Context**: `CmsProvider` wraps entire app in `App.tsx`. `useCms()` provides raw content; `useCmsSection("labels.home")` returns `{data, t}` where `t(key, fallback)` resolves CMS strings. All pages (Home, Login, ForgotPassword, ResetPassword, InviteSetup, NewProject, AdminClients, ClientDashboard, ClientProducts, ClientApprovals, ClientMessages, ClientReports) use `useCmsSection` for every user-visible string. Comprehensive `labels` section in `cms-defaults.ts` covers 300+ keys across all pages.
- **Client Invite Flow**: Secure, token-based onboarding.
- **Professional Budget/Invoice Generator**: AI-powered tool.
- **Shopify Product Creation (Full AI Pipeline)**: Automates product creation with AI-generated content, pricing, SEO, images, and niche-specific variants. Includes a `referenceImageUrl` system for AI image generation from existing product photos.
- **AI Creative Director Image System**: `buildImagePrompt()` uses Claude as an expert creative director to generate highly specialized, unique prompts for EACH specific product, considering lens specs, lighting, color grading, composition, and model direction.
- **Reference Image Generation System**: Uses OpenAI gpt-image-1 to generate professional product photos from a reference image, adapting scenes by product type.
- **Virtual Try-On / OOTD System**: Uses GPT Image-1 multi-image editing to dress a person/model with product photos (clothing, shoes, accessories, cosmetics), with Claude as fashion director for prompt generation.
- **Audit-First Brain Actions**: `store_status`, `list_products`, `search_product`, `edit_product`, `publish_product` include audit fields. New bulk actions `audit_store`, `fix_unpublished`, and `fix_missing_compare_prices` use Shopify GraphQL API for comprehensive product management.
- **Deep Inventory & Sales Control System**: Professional-grade stock management with 6 chatbot actions.
- **Supplier Research System**: AI-driven intelligence.
- **PDF Commercial Report**: 17-page A4 dark-theme PDFKit report.
- **Universal Export System**: Generates a 9-page paginated comprehensive audit report with AI deep analysis. All 14 report types and chatbot brain action results are automatically saved to `projectFilesTable` vault. Includes "External Store Analysis" (`analyze_external_store`).
- **Vault Professional Download System**: Multi-tier download system supporting individual, multi-select, per-folder, and full vault ZIP downloads. All exported content uses the unified professional branding system.
- **Universal Action Buttons (Enviar/Guardar/Descargar)**: Three action buttons below every chatbot result to send as email, save to vault, or download as HTML/ZIP bundle.
- **Unified Report Branding System**: ALL document outputs (14 export reports via `reportShell()`, chatbot action results via `buildProfessionalHtml()`, vault downloads via `buildBrandedHtmlFromMetadata()`) share identical SC branding: Inter font, gradient cover page with SC logo, metric cards, section icons, grade badges, professional tables, print media queries, and "DOCUMENTO CONFIDENCIAL" footer. Three rendering engines for three content types, one unified brand identity.
- **100/100 Quality Standard + Semrush SEO Intelligence**: Integrates Semrush-inspired methodology for SEO scoring and product auditing.
- **AI Economist with Market Research**: Calculates optimal prices using parallel Gemini searches and Claude analysis.
- **A/B Testing (Image + Price)**: Supports image and price variant tests with AI-generated impact predictions.
- **Price Simulator & P&L Forecast**: Tools for financial analysis and scenario simulation.
- **Comprehensive COGS System**: Detailed cost of goods sold tracking with AI auto-estimation.
- **Partial Redesign**: Allows users to select specific product attributes for AI-driven redesign.
- **Automated Cron Jobs**: Twelve tasks for continuous learning and intelligence.
- **Copyright Audit System**: The `copyright_audit` brain action detects trademark/IP risks, suggests alternatives, and classifies risks by severity.

### Security
- AES-256-GCM encryption for all sensitive credentials in DB.
- Startup migration (`migrateTokenEncryption()`) automatically encrypts plaintext tokens.
- API responses mask raw tokens; `safeDecrypt()` handles encrypted and legacy plaintext values.
- Comprehensive audit logging and database-backed rate limiting.
- AI API concurrency queues and exponential backoff.
- Admin route protection, CORS, secure session management, SVG sanitization, PostMessage origin validation, and HTML escaping for XSS protection.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.