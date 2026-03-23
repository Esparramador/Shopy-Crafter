# Shopify AI Optimizer — ShopyBrain Agency Platform

## Overview
Multi-user Shopify AI optimization agency platform. Admin: `sadiagiljoan@gmail.com` / `ShopyAdmin2026!` (auto-seeded on startup). Two roles: **admin** (full access, all stores, all engines) and **client** (read-only per-store, approval workflows). Zero simulation — all data is real.

### Key Names
- **UI name**: ShopyBrain (public-facing branding)
- **Internal name**: OmniCore (technical, in code)

## User Preferences
- Admin credentials: `sadiagiljoan@gmail.com` / `ShopyAdmin2026!`
- Design: gold/black/jade premium dark theme
- Language: Spanish (UI), code in English
- Zero mocked data — all real
- Shopify billing (not Stripe) — generates checkout links per service/client
- Landing-first routing: unauthenticated → `/` (landing); clients only via `/invite/:token`

## System Architecture

pnpm workspace monorepo, TypeScript, Node.js 24.

### Artifacts
| Artifact | Port | Path |
|---|---|---|
| `api-server` | 8080 | `/api/*` |
| `shopify-optimizer` (React+Vite) | 19080 | `/` |
| `mockup-sandbox` | 8081 | `/__mockup` |

### Design System
- **Colors**: `--ink:#080810`, `--gold:#c8a84b`, `--jade:#2dd49f`, `--crim:#e84558`
- **Typography**: Instrument Serif (headings), Geist (body), Geist Mono (code)
- **Layout**: Fixed 2px gold gradient topline, 220px sidebar, topbar

### Database — 42+ Tables (PostgreSQL + Drizzle ORM)
Key tables: `users`, `projects`, `products`, `omnicore_memories`, `omnicore_insights`, `omnicore_knowledge_domains`, `omnicore_niche_profiles`, `omnicore_prompt_library`, `omnicore_study_sessions`, `omnicore_cross_connections`, `service_catalog`, `agency_cost_structure`, `revenue_snapshots`, `email_flows`, `user_sessions`, `cms_content`, `competitors`, `inventory_tracking`, `ab_tests`, `forecasts`, `project_files`, `achievements`

**Important**: `email_flows` uses raw `pool.query()` (not Drizzle ORM). `user_sessions` is the connect-pg-simple session store table (created directly via SQL, not via Drizzle schema).

### Security
- AES-256-GCM encryption via `ENCRYPTION_KEY` env var (64-char hex) — `encrypt()` on write, `safeDecrypt()` on read for ALL credentials
- All admin routes behind `requireAdmin` middleware
- CORS locked to `REPLIT_DOMAINS` in production
- Session: `httpOnly`, `sameSite: strict`, `secure: true` in production
- SVG from AI sanitized (strips `<script>`, `on*`, `javascript:`)

### AI Stack — OmniCore (ShopyBrain)
- Claude `claude-sonnet-4-5` — text generation with `buildShopyBrainContext()` injection
- Replicate (Flux, Recraft) — image generation
- `learnFromOperation()` + `ingestToShopyBrain()` — always fire-and-forget, NEVER awaited
- `askClaudeJsonWithBrain()` — main Claude call (injects OmniCore context in system prompt)
- `askClaudeWithBrain()` — vision variant

### OmniCore / ShopyBrain Cron Jobs (9 total)
| Schedule | Job |
|---|---|
| Every 3h | Micro-learning (2 domains × 3 insights) |
| Every 6h | Consolidation (insights → memories) |
| Every 12h | Cross-synthesis (cross connections) |
| 1am | Deep study (14 domains × 5 insights) |
| 2am | Revenue snapshots |
| 3am | Real data integration |
| 6am | Competitor price scans |
| 7am | Inventory sync + alerts |
| Sun 0am | Weekly mega-synthesis |

### ShopyBrain Dashboard Routes
- `/admin/shopybrain` — brain overview + domain visualization
- `/admin/shopybrain/memories` — memory explorer (filter by niche/type/confidence)
- `/admin/shopybrain/insights` — 16 knowledge domains
- `/admin/shopybrain/study` — study sessions + manual trigger
- `/admin/my-pricing` — CFO dashboard (cost structure, service catalog, Shopify sync)

### Pricing Model (real — visible in landing and CMS)
| Plan | Retainer | Setup único |
|---|---|---|
| Starter | €49/mes | +€297 |
| Agency Pro | €149/mes | +€597 |
| Enterprise | €399/mes | +€1.497 |
| One-Shot Audit | €197 pago único | — |

### Shopify Billing Flow (no Stripe)
Admin goes to Clients → "Cobrar" button → selects service → `POST /api/agency/payment-link` → Shopify checkout URL → copy or send via chat.

**Prerequisite**: Map each service to a Shopify product variant in `Mi Pricing CFO → 🛍 Shopify Sync` tab FIRST.

**Required env vars for billing**:
- `SHOP_DOMAIN` — e.g. `mi-tienda.myshopify.com` (currently falls back to demo value)
- `STOREFRONT_ACCESS_TOKEN` — already set ✅
- `SHOPIFY_ADMIN_ACCESS_TOKEN` — needed for push-services-to-shopify auto-creation (MISSING)

### Landing Page Sections (8 total)
1. Inicio (fp-hero)
2. Motores (fp-engines)
3. Demo (fp-demo)
4. Resultados (fp-results)
5. Precios (fp-pricing)
6. Clientes (fp-clients)
7. **Contactar (fp-contact)** — contact form → `POST /api/contact` → audit_log + Klaviyo event
8. Empezar (fp-cta) + footer

### Public Routes (no auth required)
- `GET /api/cms/content` — landing CMS content
- `POST /api/contact` — lead form submission (saved to audit_log + Klaviyo events)
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/shopify/oauth/callback` — OAuth return

### Tienda Route
`/tienda` — immediately redirects to `https://comiccrafter.es/account/login?return_url=/collections/shopify-automatization`

### Vite Proxy (dev only)
`/api` and `/shopify` paths forwarded to `localhost:8080` in `vite.config.ts`.

### OAuth Callback URL
`https://c104008b-b6fa-4bd6-96fb-4cf699ca4074-00-1ypcyhx9r8nw8.kirk.replit.dev/api/shopify/oauth/callback`

## Key Files
| File | Purpose |
|---|---|
| `artifacts/api-server/src/routes/agency.ts` | Shopify billing: `shopify-products`, `payment-link`, `shopify-variant`, `push-services-to-shopify` |
| `artifacts/api-server/src/routes/shopybrain.ts` | Memories, insights, study, niche-profiles, prompt-library |
| `artifacts/api-server/src/routes/contact.ts` | Lead form: public `POST /api/contact` → audit_log + Klaviyo |
| `artifacts/api-server/src/lib/claude.ts` | Claude calls + `buildShopyBrainContext()` |
| `artifacts/api-server/src/lib/crypto.ts` | AES-256-GCM encrypt/safeDecrypt |
| `artifacts/api-server/src/lib/auth.ts` | requireAuth, requireAdmin, requireClientAccess |
| `artifacts/api-server/src/app.ts` | CORS, Helmet, rate limiting, session config |
| `artifacts/api-server/src/routes/index.ts` | Security gate, all route mounts |
| `artifacts/shopify-optimizer/src/pages/Landing.tsx` | Public landing (8 sections, CMS-driven, contact form) |
| `artifacts/shopify-optimizer/src/pages/Tienda.tsx` | Redirect to comiccrafter.es/collections/shopify-automatization |
| `artifacts/shopify-optimizer/src/pages/AdminClients.tsx` | PaymentLinkModal + ChatPanel with billing |
| `artifacts/shopify-optimizer/src/pages/admin/MyPricing.tsx` | CFO dashboard + Shopify Sync tab |
| `artifacts/shopify-optimizer/src/pages/admin/ShopyBrain.tsx` | OmniCore dashboard |
| `artifacts/shopify-optimizer/src/components/layout/AppLayout.tsx` | Sidebar + nav (ShopyBrain + Admin groups) |
| `lib/db/src/schema/shopybrain.ts` | All 13 OmniCore tables schema |

## External Dependencies
- **PostgreSQL** — primary DB
- **Anthropic Claude** (`claude-sonnet-4-5`)
- **Replicate** (Flux, Recraft) — image generation
- **Shopify** — Storefront API (checkout links), Admin API (product creation)
- **Klaviyo** — email flow integration + lead form notifications (`KLAVIYO_API_KEY`)
- **connect-pg-simple** — PostgreSQL session store
- **express-session**, **bcryptjs**, **sharp**, **pino**, **zod**, **drizzle-orm**, **orval**

## DB Push Command
```bash
pnpm --filter @workspace/db run push-force
```
(not `db:push` — use `push-force`)

## EADDRINUSE Recovery
```bash
pkill -f "dist/index.mjs" && sleep 2
```
Then restart the API Server workflow.
