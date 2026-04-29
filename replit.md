# Shopy Crafter Agency Platform

## Recent Changes (Apr 2026 — Auditoría Claude Opus 4.7)

**Fase 7 — CRIT-6 + sesión final (29 abr)** — cierre de los hallazgos pendientes del audit con guard centralizado:
- **CRIT-6 (`shopybrain.ts` línea 1761)**: añadido guard centralizado `requireConfirmation(params, action, {...})` antes del `switch (action)` — cubre los 24 cases catastróficos del `DESTRUCTIVE_ACTIONS` set (delete_*, bulk_*, optimize_all_products, deactivate_user, reset_*, edit_theme_*, sync_store_theme, setup_full_store, fix_code, modify_ui) en una sola edición sin tocar cada case individual. Si la action está en el set y `params.confirmed !== true`, devuelve JSON `{requiresConfirmation:true, action, preview, message}` y no ejecuta nada.
- **OmniChatbot global handler**: `formatActionResult()` ahora detecta `result.requiresConfirmation === true` AL INICIO y devuelve `result.message` directamente para cualquier action — antes solo `delete_product` lo manejaba, otras destructivas mostraban `✅` falsamente.
- **`/error-report` IP detection**: cambia `req.headers["x-forwarded-for"]` (spoofable) por `req.ip` (respeta `app.set("trust proxy", 1)` ya configurado en `app.ts`).
- **`lib/sanitize.ts`** (FE-A7): nuevo módulo con `cleanHtml`, `cleanSvg`, `cleanMarkdownLite` (DOMPurify endurecido — sin script/style/iframe, sin handlers inline, URI restringidas).
- **`validateEncryptionKey()` en startup** (`app.ts` línea 21): invocado tras imports → fallo duro en producción si falta `ENCRYPTION_KEY`.
- **`/error-report` endpoint** (`health.ts`): rate limit 30/min/IP en memoria, sanitización de payload por truncado.
- **Android backup hardening**: `allowBackup="false"` + `dataExtractionRules` referenciado en `AndroidManifest.xml` + nuevo `res/xml/data_extraction_rules.xml` (excluye sesiones, tokens, cifrado).
- **`Billing.tsx` rebuilt** (250→442L): react-query (`useQuery`/`useMutation`/invalidations), `apiGet/apiPost` del wrapper centralizado, redirect a Shopify Billing (`confirmationUrl`/`checkoutUrl` → `window.top.location.href`), responsive.
- **Verificado YA APLICADO** (sesiones previas): CRIT-1 `validateFixCodePath` (línea 4238 + 6752), CRIT-3 hardcoded `|| 2` (0 ocurrencias), CRIT-4 `fetchImageWithSizeLimit` en fusion_analyze/fusion_create_product (líneas 5773 + 5806), CRIT-5 `normalizeListDirectory` en list_source_files (4065-4066), schema `express_rate_limits.ts`, schemas approvals/audit_log/messages/rate_limits en users.ts.

**Fase 6 — Cierre auditoría 21 ZIPs (29 abr)** — patches residuales aplicados tras revisión cruzada de los markdowns de cierre (`01-PATCHES-EXTRA.md`, `06-FINAL-CLOSURE.md`, `08-DEEP-AUDIT-WITH-CONTEXT.md`, `shopybrain-VERIFIED-patches.ts`):
- **A13** `lib/auth.ts`: eliminada `requireClientAccess` (dead code, 0 referencias en todo el repo).
- **A16** eliminado `routes/klaviyo.ts` + import en `routes/index.ts` (dead code; el frontend solo usa `klaviyo-ai.ts`, y `lib/klaviyo-headers.ts` se conserva).
- **shopybrain Patch 12 — `sync_catalog_prices`**: añadido confirmation gate obligatorio + warning de catálogo HARDCODED de Shopy Crafter (NO aplicar a tiendas de cliente). Por defecto ahora corre dryRun salvo `confirmed:true && dryRun:false`.
- **shopybrain Patch 12 — `create_collection`**: confirmation gate antes de crear colección Shopify (evita que la IA llene la tienda de colecciones basura).
- **M9 redirect validation** (`UniversalGenerator.tsx`): `data.redirect` solo se abre si empieza con `/`, no `//` ni `/\`, y matchea prefijo conocido (`/api/`, `/vault/`, `/generator/`, `/exports/`, `/projects/`). `window.open` con `noopener,noreferrer`.
- **`lib/api-client-react/src/index.ts`**: re-exportados `customFetch`, `ApiError`, `ResponseParseError` y tipos (`AuthTokenGetter`, `CustomFetchOptions`, `ErrorType`, `BodyType`) — desbloquea el wrapper `shopify-optimizer/src/lib/api.ts` y elimina 4 errores TS.

**Fusion Studio Pro + Ad Studio + BrainSync + Runway/ElevenLabs (29 abr)** — paquete `shopycrafter-audit.tar.gz` aplicado íntegro:
- **Vídeo (Runway)**: `lib/runway.ts` con `validateImageUrl` (HTTPS-only, bloquea localhost/RFC1918/IPv6 ULA/link-local/CGNAT/IPv4-mapped) + endpoint `/fusion-studio/generate-video` (gen3a_turbo / gen4_turbo, polling 5min, vault auto-save).
- **Voz (ElevenLabs)**: `lib/elevenlabs.ts` con `synthesizeSpeech`, voice cloning, SFX. Endpoint `/voice/tts` con rate-limit en memoria (10 req/min, 50 000 chars/h por usuario) + `recordUsage` bloqueante. **Sin filtración** del `voiceId` por header `X-Voice-Id`.
- **Fusion Studio Pro** (`lib/fusion-studio-pro.ts` + `routes/fs-pro.ts`): 12 capacidades AI (generate-image, edit, remove-bg, replace-bg, upscale, enhance-faces, video, voice clone, TTS, SFX, music, etc.). `fetchToBuffer` ahora valida URL contra SSRF reusando `validateImageUrl`. `/fs-pro/tts` comparte `checkTtsQuota` con `/voice/tts` para evitar bypass del rate-limit.
- **Ad Studio Pro** (`lib/adstudio.ts` + `routes/ad-studio.ts`): pipeline SSE multi-paso (script → voiceover → b-roll → composición ffmpeg → archive zip).
- **BrainSync admin** (`pages/admin/BrainSync.tsx`): panel para sincronizar memorias entre proyectos.
- **Push notifications** (`routes/push.ts`): web-push real con VAPID; arranque seguro (devuelve 503 si faltan claves, no panic).
- **Crypto** (`lib/crypto.ts`): hard-fail en `NODE_ENV=production` si falta `ENCRYPTION_KEY`.
- **Auth** (`lib/auth.ts`): nuevo middleware `requireProjectAccess` que verifica `project.clientId === session.clientId` (admin pasa siempre). Aplicado a `/projects/:projectId/exports`.
- **Frontend**: `App.tsx`, `AppLayout.tsx`, `FusionStudio.tsx` (acepta `generatedPhotoUrls` del paquete + mantiene flujo /generate-video), `Audit.tsx` (multi-platform), `Revenue.tsx`, `AdminClients.tsx` (PlansModal), `CMSEditor.tsx`, `capacitor.config.ts` (iOS), nuevo `lib/api.ts`, `hooks/use-push-subscription.tsx`, `public/service-worker.js`.

**Bloque D + E final (29 abr)** — fixes restantes auditoría aplicados:
- `auth.ts` (D-15): rate limit de login DUAL — ahora limita por IP **y** por email (`login_ip:` + `login_email:`), evitando bypass con IPs rotantes contra una misma cuenta.
- `admin.ts` (D-10): `/projects/:id/invite` valida email con regex y nombre ≥ 2 chars antes de tocar BD/Klaviyo.
- `admin.ts` (D-11): `/users/:id/reset-password` valida que `password` sea string ≥ 8 chars antes de `bcrypt.hash` (que crashea con `undefined`).
- `inventory.ts` (D-08): bloque Puppeteer hardcoded reemplazado por `generatePdfFromHtml` del helper centralizado (timeout 60s, bloqueo recursos externos, sin `chromiumPath` literal).
- `vault.ts` (D-09): export DOCX ya no envía HTML con MIME `wordprocessingml.document` (Word lo rechazaba como "archivo dañado") — ahora sirve `.html` honesto hasta que se integre librería `docx` real.
- `exports.ts` (E-07): eliminados `@import url('https://fonts.googleapis.com/...')` en bloques HTML que van a Puppeteer (causaban cuelgues esperando red externa); fallback a system font stack.
- `exports.ts` (E-11): `autoSaveReport()` ahora limita contenido a 5MB y deduplica por (projectId, category, día) para evitar inserts masivos en hot path.

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