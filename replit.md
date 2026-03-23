# Workspace

## Overview

Shopify AI Optimizer — **Multi-user agency platform** for Shopify AI optimization. Two roles: **admin** (full access, all stores, all 7 AI engines) and **client** (read-only access to their own store metrics and approvals). Session-based auth with bcrypt passwords + AES-256-GCM encrypted credentials. Each project = one client's isolated Shopify store.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React 19 + Vite + TailwindCSS + Framer Motion + Recharts
- **AI**: Anthropic Claude (`claude-sonnet-4-5`) + Replicate (Flux, Recraft)
- **Image processing**: Sharp (post-process generated images)

## Design System

Premium gold/black/jade design system applied to ALL internal app pages.

- **Design system CSS**: `artifacts/shopify-optimizer/public/css/design-system.css` (loaded globally via index.html)
- **Fonts**: Instrument Serif (headings, italic) + Geist (body) + Geist Mono (code) via Google Fonts
- **Gold line**: `position:fixed; top:0; height:2px` gold gradient — always visible across all pages
- **App shell structure**: `.app-shell` → `.sidebar` (220px) → `.main-area` → `.topbar` → `.main-content`
- **Colors**: `--ink:#080810` bg, `--gold:#c8a84b` accent, `--jade:#2dd49f` success, `--crim:#e84558` error
- **Key classes**: `.app-shell`, `.sidebar`, `.topbar`, `.main-content`, `.card`, `.metric-card`, `.btn-gold`, `.nav-item`, `.client-pill`, `.module-tab`, `.badge-*`
- All Tailwind CSS still active alongside the design system for inner page components

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/             # Express API server (port 8080)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── shopify.ts  # Shopify OAuth + API client
│   │       │   ├── claude.ts   # Anthropic Claude client
│   │       │   ├── audit.ts    # Product scoring algorithm
│   │       │   ├── bulk-queue.ts # Background job management
│   │       │   └── logger.ts   # Pino structured logging
│   │       └── routes/
│   │           ├── projects.ts     # Project CRUD + token management
│   │           ├── products.ts     # Product sync + audit
│   │           ├── redesign.ts     # AI redesign + bulk redesign
│   │           ├── images.ts       # AI image generation + upload
│   │           ├── pricing.ts      # COGS + pricing calculator
│   │           ├── seo.ts          # SEO audit + generation
│   │           ├── ab-testing.ts   # A/B test management + tracking
│   │           └── jobs.ts         # Bulk job status polling
│   ├── shopify-optimizer/      # React+Vite frontend (port 19080)
│   │   └── src/
│   │       ├── pages/projects/ # Audit, Redesign, Images, Consistency, ABTesting, Pricing, SEO, Settings
│   │       ├── components/ui/  # GlassCard, GradeBadge
│   │       └── components/layout/ # AppLayout
│   └── mockup-sandbox/         # Component preview server (port 8081)
├── lib/
│   ├── api-spec/               # OpenAPI spec + Orval codegen config
│   ├── api-client-react/       # Generated React Query hooks
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           ├── projects.ts         # Store project + OAuth tokens
│           ├── products.ts         # Shopify product cache + audit scores
│           ├── redesigns.ts        # AI redesign results
│           ├── generation_jobs.ts  # Image generation job tracking
│           ├── ab_tests.ts         # A/B tests + tracking events
│           ├── cogs.ts             # Cost of goods sold data
│           ├── visual_dna.ts       # Visual brand DNA profiles
│           ├── seo_data.ts         # SEO meta data + scores
│           └── bulk_jobs.ts        # Bulk operation tracking
├── scripts/                    # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Modules (Frontend Tabs per Project)

1. **Auditoría** — Product audit with A-F scoring (5 axes: title/desc/price/images/seo)
2. **Rediseño IA** — Claude AI product title/description/price redesign, apply to Shopify
3. **Imágenes** — Replicate AI image generation (8 types: hero/lifestyle/detail/packaging/ugc/scale/bundle/infographic)
4. **Consistencia** — Visual brand DNA extraction + store consistency scoring
5. **A/B Testing** — Image variant A/B testing with z-test statistical significance
6. **Pricing** — COGS calculator + Claude pricing optimization + margin waterfall
7. **SEO** — Meta generation, schema markup, alt texts, keyword intelligence, blog strategy

## Landing Page & Visual CMS

**Landing pública** (`/`) — Visible para usuarios no autenticados. Identidad visual premium:
- Tipografía: **Instrument Serif** (titulares elegantes) + **Geist** (UI técnica) + **Geist Mono** (tags)
- Paleta: dorado `#c8a84b` / `#e6c668` sobre negro profundo `#080810`
- Textura de ruido sutil (SVG filter, opacity 0.022)
- Cursor personalizado con anillo de seguimiento fluido (inercia 0.12)
- Nav transparente → glass con blur al hacer scroll
- Hero: grid SVG, orbs flotantes, gradientes radiales, dashboard preview real
- Marquee de tecnologías con fade en extremos
- 6 motores IA en grid con hover effect + top-line dorada
- Stats con números grandes en Instrument Serif con gradient dorado
- How it works con barra de progreso animada (IntersectionObserver)
- Pricing con badge "MÁS POPULAR", top-line gold, feature list check/cross
- Testimoniales con métricas de impacto y avatares
- CTA final con campo de email
- Footer 4 columnas con badges legales (RGPD, AES-256, SOC2)

**CMS Visual** (`/admin/cms`) — Editor split-panel (solo admin):
- Panel izquierdo (320px): árbol de contenido + editores de campo por tipo
- Panel derecho: iframe live preview de la landing
- Tipos de campo: texto, textarea, color picker, toggle boolean
- IA por campo: botón "✨ IA" abre popover con Claude → presets + instrucción personalizada
- Historial de versiones: 30 snapshots, restauración 1 clic
- Reset a defaults
- Auto-broadcast SSE a todas las pestañas abiertas
- Saves batch via `POST /api/cms/content/batch`

**CMS Backend** (`/api/cms/*`):
- `GET /api/cms/content` — Público, sin auth requerida
- `PATCH /api/cms/content` — Requiere admin (path + value)
- `POST /api/cms/content/batch` — Requiere admin (array de cambios)
- `POST /api/cms/content/reset` — Restaura defaults
- `POST /api/cms/media/upload` — Multipart, sharp → WebP, max 5MB
- `GET /api/cms/versions` — Historial últimas 30 versiones
- `POST /api/cms/versions/:id/restore` — Restaura versión
- `POST /api/cms/ai/improve` — Claude mejora texto con instrucción
- `GET /api/cms/events` — SSE stream de cambios en tiempo real
- Contenido almacenado en PostgreSQL (`cms_content` + `cms_versions` tables)
- Media guardada en `artifacts/shopify-optimizer/public/media/` como WebP

## 9-Phase Feature Implementation (NEW)

### Phase 1: Revenue Intelligence 360°
- **DB tables**: `events`, `revenue_snapshots`, `forecasts` (in `lib/db/src/schema/intelligence.ts`)
- **Routes**: `GET/POST /api/intelligence/events`, `GET/POST /api/intelligence/snapshots`, `GET /api/intelligence/summary`, `POST /api/intelligence/analyze`
- **Page**: `/admin/intelligence` — Attribution dashboard, event breakdown, AI analysis

### Phase 2: M7 Intelligent Inventory Engine
- **DB tables**: `inventory_tracking`, `restock_orders` (in `lib/db/src/schema/inventory.ts`)
- **Routes**: `GET/POST /api/inventory/tracking`, `GET /api/inventory/alerts`, `POST /api/inventory/restock-email`, `GET /api/inventory/restock-orders`, `POST /api/inventory/sync`
- **Page**: `/admin/inventory` — Stock monitoring, critical alerts, AI supplier email generation

### Phase 3: Onboarding + Achievement System
- **DB tables**: `onboarding_progress`, `achievements` (in `lib/db/src/schema/onboarding.ts`)
- **Routes**: `GET /api/onboarding/progress`, `POST /api/onboarding/step`, `GET /api/onboarding/achievements-catalog`, `GET /api/achievements`
- **Pages**: `/admin/achievements` (10 achievements), `/admin/roadmap` (30-60-90 day plan)
- **Widget**: `OnboardingWidget` component (fixed bottom-right, shows progress/steps, auto-dismisses at 100%)

### Phase 4: Competitor Intelligence
- **DB tables**: `competitors`, `competitor_snapshots`, `competitor_alerts` (in `lib/db/src/schema/competitors.ts`)
- **Routes**: `GET/POST /api/competitors`, `DELETE /api/competitors/:id`, `GET /api/competitors/snapshots`, `POST /api/competitors/scan`, `GET /api/competitors/alerts`, `POST /api/competitors/alerts/:id/dismiss`
- **Page**: `/admin/competitors` — Add/manage competitors, AI scan with Claude, alert management, PDF export

### Phase 5: Stripe Billing + Affiliate Program
- **DB tables**: `subscriptions`, `affiliates`, `referral_tracking` (in `lib/db/src/schema/billing.ts`)
- **Routes**: `GET /api/billing/subscription`, `GET /api/billing/plans`, `POST /api/billing/upgrade`, `GET /api/billing/affiliate`, `POST /api/billing/affiliate/join`, `GET /api/billing/invoices`
- **Pages**: `/admin/billing` (subscription + affiliate + invoices tabs), `/admin/affiliates` (alias)
- **Note**: Demo mode without live Stripe keys. Set STRIPE_SECRET_KEY for real payments.

### Phase 6: ML Predictive Engine
- **Routes**: Uses `/api/intelligence/analyze` + `/api/intelligence/snapshots`
- **Page**: `/admin/forecast` — 4 metric forecasts with confidence intervals, ML methodology explanation

### Phase 7: Voice Interface
- **Routes**: `POST /api/voice/command` — Claude interprets Spanish commands, returns action + spoken response
- **Component**: `VoiceButton` (fixed bottom-right at 88px, above onboarding widget) — Web Speech API, speech synthesis, bubble UI
- **Supported actions**: navigate, get_revenue, get_inventory_alerts, run_audit, run_boost, generate_images

### Phase 8: Mobile PWA
- **Manifest**: `/public/manifest.json` — ShopifyAI Pro PWA config, gold theme, standalone display
- **Service Worker**: `/public/sw.js` — Cache-first for static, network-first for API, push notifications handler
- **Mobile CSS**: `@media (max-width: 600px)` in design-system.css — sidebar becomes horizontal scroll nav

### Phase 9: Final Polish
- **Sidebar**: 10 admin nav items in AppLayout covering all new pages
- **Command Palette**: `CommandPalette` component — Cmd+K / Ctrl+K / ? to open, arrow keys to navigate, Enter to go
- **Dark/Light mode**: Toggle button in sidebar, data-theme="light" CSS vars override
- **Accessibility**: :focus-visible gold rings, aria-labels, aria-current, role attributes on nav/main
- **Notification center**: Topbar bell icon opens panel (persistent, grouped)
- **CSS aliases**: `.btn-primary`, `.btn-secondary`, `.glass-card`, `.input-field` added to design-system.css
- **PWA prompt**: `beforeinstallprompt` event captures install prompt, shows banner

## Auth Architecture

- **Session**: `express-session` + `connect-pg-simple` (table: `user_sessions`), 8h maxAge, httpOnly cookie
- **Passwords**: `bcryptjs` (12 rounds)
- **Credential encryption**: AES-256-GCM via `artifacts/api-server/src/lib/crypto.ts` (key: `ENCRYPTION_KEY` env var)
- **Admin credentials**: `admin@agency.com` / `admin123` (seeded in `users` table)
- **Roles**: `admin` | `client`
- **Row-level security**: Clients can only access their own `projectId` (enforced in Express middleware)
- **Impersonation**: Admin can preview client view via `/api/admin/impersonate/:userId`; red banner shown; stop at `/api/admin/stop-impersonate`
- **Client invitation**: Admin creates invite → token emailed → client sets password at `/invite/:token`
- **New DB tables**: `users`, `audit_log`, `approvals`, `messages`
- **Frontend routes**:
  - `/login` — Login page (public)
  - `/invite/:token` — Client invitation setup (public)
  - `/admin/clients` — Admin client management
  - `/client/*` — Client dashboard (read-only)
  - All other routes (`/projects/*`) — Admin only

## Shopify OAuth Flow

Projects store `clientId` + `clientSecret`. On use, POST to `https://{shopDomain}/admin/oauth/access_token` with `grant_type=client_credentials` to get a short-lived access token. Auto-refresh on 401 + manual "Refresh Token" button. Token stored in DB with `tokenExpiresAt`.

## AI Models

- **Claude**: `claude-sonnet-4-5` via `@anthropic-ai/sdk` — redesign, SEO, pricing, alt text, infographics
- **Replicate**:
  - Hero/Lifestyle/Bundle → `black-forest-labs/flux-1.1-pro`
  - Detail/Scale → `black-forest-labs/flux-dev`
  - Packaging/UGC → `recraft-ai/recraft-v3`
  - Infographic → SVG via Claude only

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`).
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@anthropic-ai/sdk`, `replicate`, `sharp`, `axios`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle

### `artifacts/shopify-optimizer` (`@workspace/shopify-optimizer`)

React 19 + Vite frontend. Multi-project sidebar layout with 7 module tabs per project.

- Entry: `src/main.tsx`
- App: `src/App.tsx` — routing + React Query setup
- Layout: `src/components/layout/AppLayout.tsx` — sidebar + project selector
- Pages: `src/pages/projects/` — one file per module
- Uses: `@workspace/api-client-react` React Query hooks

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- Exports: `.` (pool, db, schema), `./schema` (schema only)
- Schema: 9 tables (projects, products, redesigns, generation_jobs, ab_tests, track_events, cogs, visual_dna, seo_data, bulk_jobs)

Production migrations are handled by Replit when publishing. In development: `pnpm --filter @workspace/db run push`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
