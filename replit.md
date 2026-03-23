# Workspace

## Overview

Shopify AI Optimizer — Personal e-commerce platform management tool. Multi-client project management, no user authentication. Each client = one isolated project with per-store Shopify OAuth credentials.

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

## Design Tokens

- Background: `#08080f` (deep space dark)
- Accent: `#5b4eff` (electric violet)
- Grade colors: A=`#00d68f` B=`#00b4d8` C=`#ffd32a` D=`#ff8c42` F=`#ff4757`
- Premium dark glassmorphism panels

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
