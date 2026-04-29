# Shopy Crafter Agency Platform

## Recent Changes (Apr 2026 — Auditoría Claude Opus 4.7)

**Hardening de seguridad Tier-1 + Bloque A (shopybrain CRIT/HIGH)**:
- **Frontend** (`shopify-optimizer`): añadido `credentials:'include'` a 7 fetch() de cross-origin (Pricing, CMSEditor, ForgotPassword, ResetPassword, Landing, CmsContext) para evitar pérdida de sesión.
- **XSS**: `Redesign.tsx` (HTML rich) e `Images.tsx` (SVG) ahora sanitizan con DOMPurify allowlist en lugar de regex casero. Instalado `dompurify` + `@types/dompurify`.
- **Backend hardenings** (`api-server/src/lib`):
  - `pdf-generator.ts`: timeout 60s, bloqueo de scripts/CSS/fonts externos vía request interception, max HTML 5MB, sin `--disable-web-security`.
  - `vault.ts`: límite 10MB por contenido, helper `getVaultContent(fileId, projectId)` con ACL anti-IDOR.
  - `report-cover.ts`: escape HTML en `companyName`, regex de TOC permisivo (`div|h1-6` + fallback a `h2`), escape de títulos.
  - `connectors/prestashop.ts`: 3 ubicaciones fuerzan `https://` rechazando HTTP plano.
  - `billing.ts`: `/upgrade` devuelve 503 `PAYMENT_SYSTEM_PENDING` (Stripe pendiente) — bloquea upgrades free a Enterprise.
  - `hooks/use-draft-persistence.ts`: nuevas opciones `sensitive` (no persiste) y `storage:'session'` (SSR-safe).
- **shopybrain.ts** (`api-server/src/routes`): nuevo `lib/shopybrain-helpers.ts` con helpers críticos:
  - **CRIT-1**: `fix_code` + `modify_ui` ahora validan whitelist de paths (solo `src/pages|components|routes|lib...`), bloquean `package.json`, `.env`, `drizzle.config`, etc., extensión limitada (`.ts|.tsx|.css|.md`), confirmación obligatoria con `params.confirmed`.
  - **CRIT-2/CRIT-3**: 4 `parseInt(params?.projectId) || 2` hardcoded → `getSessionProjectId(req, params)` (sin fallback peligroso).
  - **CRIT-4**: `fusion_analyze` y `fusion_create_product` usan `fetchImageWithSizeLimit(url, 15MB)` con HEAD precheck + streaming reader (anti-DoS).
  - **CRIT-5**: `list_source_files` rechaza `..`, `/` absoluto, NUL y normaliza paths con `resolve+startsWith` dentro de `src/`.
  - **HIGH-1**: `modify_ui` parsea JSON de Claude en cascada (`JSON.parse` → match `{...}` → strip code fences → error claro).

**Skipped intencionalmente** (riesgo > beneficio):
- Migraciones SQL manuales 0001-0015 (este repo usa Drizzle `db:push`, NUNCA SQL manual).
- Cambio de tipos PK (`users.id=text`, `projects.id=serial`).
- Sustitución wholesale de schemas TS existentes.
- Particionado de `events` (prematuro: max 3.190 filas).
- Refactor split shopybrain.ts en 7 módulos (opcional, 14h).

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform that uses a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for comprehensive e-commerce optimization. It offers AI-driven insights, automation, product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The platform aims to be a leading AI-driven solution for e-commerce, expanding across various platforms and providing extensive agency-level services to enhance client ROI.

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
A premium dark theme with custom color variables, typography, and a fixed layout featuring a gold gradient topline, sidebar, and topbar. A custom "SCCursor" component provides a branded cursor. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page includes 7 sections with a fullpage scroll-snap engine on desktop and native scrolling on tablet/mobile.

### Multi-Platform Connector Architecture
An extensible `IPlatformConnector` abstraction layer supports Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with a `ConnectorFactory` for dynamic selection.

### Product Enrichment and Audit Systems
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring on product data.

### AI-Powered Report Recommendations
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content such as product descriptions, meta tags, and marketing materials. All 6 individual reports (SEO, Financial, Consistency, Inventory, Redesigns, Revenue) include Claude-powered professional recommendations.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, and full store setup automation. The `modify_ui` action uses Claude to analyze and apply code changes directly to files.

### COGS & Pricing Intelligence
COGS estimation and optimal pricing calculation use Gemini with Google Search for real-time market data and competitive analysis.

### Competitor Auto-Discovery
The `discover_competitors` action uses Gemini with Google Search to identify 8-12 real competitors in the same niche.

### Global Vault
A centralized "Bóveda Global" stores reports, images, and research from projects and external entities, managed via a `project_files` database table. Both project and global vaults support inline preview (opens in new tab with CSP protection) and multi-format download (HTML/PDF/Word). Reports stored as JSON metadata are rendered through `buildBrandedHtmlFromMetadata()` for consistent branded output across all endpoints (download, preview, ZIP export). Preview endpoints: `/api/projects/:id/vault/:fileId/preview` and `/api/vault/global/:fileId/preview`.

### Universal Search
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand name, performing deep AI research and saving results to the vault.

### Universal Web Audit System
Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis.

### Template Studio
A visual editor for creating custom report templates with brand identity, featuring a 7-color design system, typography selection, logo upload, layout styles, live preview, and AI-powered brand analysis.

### Performance Optimizations
Includes lazy loading for page components, backend caching, shared utilities, `useDebounce` hook, `React.memo` for components, and cleanup of unused imports.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
"ShopyBrain" is the central mega-brain that receives, distributes, and stores all requests and knowledge, injecting accumulated intelligence into every AI call. It's a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. Token limits and anti-truncation mechanisms are in place, along with robust rate-limit retry logic for Claude and Gemini.

### Lab Web
A deep web design analysis tool that extracts HTML+CSS from any URL, runs PageSpeed + scraper analysis, and sends the code to Claude for design review, outputting improved CSS, HTML fragments, and reports.

### Universal Generator
A comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Fusion Studio (Product Intelligence Engine + Real Image Generation)
An AI-powered product photography engine with 4 phases: Brand Intelligence, Product Analysis (Claude Vision), Generation Config (16+ photo modes, 10 lighting, 10 backgrounds, 10 perspectives), and Gallery (AI-generated images via Replicate and IDM-VTON for virtual try-on).

### File Upload System
A universal file processor with multer integration, supporting various text files, images, spreadsheets, and PDFs up to 20MB.

### Brand CSS & Kit System
Generates personalized CSS files, brand identity guides (HTML/PDF), and complete brand kits (ZIP).

### Pre-Informe System
When a lead submits the contact form, the system generates a professional AI pre-informe, researching the business and generating a Shopify SEO product sample or service packs.

### Key Features
Includes Client Portal, visual CMS Editor with AI copywriting, secure Client Invite Flow, AI-powered Budget/Invoice Generator, AI Pipeline for Shopify Product Creation, AI Creative Director Image System, Reference Image Generation, Virtual Try-On, Audit-First Brain Actions, Page and Theme Management, Purchase Protection, Deep Inventory & Sales Control, Sales Report by Product/Variant, Supplier Research, PDF Commercial Reports, Universal Export/Download systems, AI Economist for optimal pricing, A/B Testing, Price Simulator & P&L Forecast, Comprehensive COGS System, Partial Redesign capabilities, Automated Cron Jobs, and a Copyright Audit System.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG sanitization, PostMessage origin validation, and HTML escaping for XSS protection.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.