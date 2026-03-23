# Shopify AI Optimizer

## Overview
Shopify AI Optimizer is a multi-user agency platform designed for optimizing Shopify stores using AI. It supports two roles: an **admin** with full access to all stores and 7 AI engines, and **clients** with read-only access to their specific store metrics and approval workflows. The platform focuses on enhancing various aspects of e-commerce, including product auditing, AI-driven redesigns, image generation, visual brand consistency, A/B testing, pricing optimization, and SEO. It aims to provide a comprehensive solution for agencies to manage and optimize multiple Shopify stores efficiently.

The project's vision is to empower e-commerce businesses with advanced AI tools to boost sales, improve customer engagement, and streamline operations, ultimately increasing market potential through data-driven decisions and automated optimizations.

## User Preferences
Not specified.

## System Architecture

The platform is built as a pnpm workspace monorepo using TypeScript, Node.js 24, and pnpm.

**UI/UX Decisions:**
A premium gold/black/jade design system is applied across all internal application pages.
- **Color Palette**: `--ink:#080810` (background), `--gold:#c8a84b` (accent), `--jade:#2dd49f` (success), `--crim:#e84558` (error).
- **Typography**: Instrument Serif (headings, italic), Geist (body), Geist Mono (code).
- **Layout**: Fixed `2px` gold gradient line at the top of the viewport. App shell features a 220px sidebar, a main content area with a topbar.
- **Responsiveness**: Utilizes CSS grid utilities (`.grid-r4`, `.grid-r3`, `.grid-r2`), page container (`.page-inner`), and mobile-specific patterns for email pages and CMS editor.
- **Landing Page**: Features a full-page scroll-snap experience with 7 sections, including a hero section, AI engines overview, demo, results, pricing, testimonials, and a CTA. It incorporates custom cursor, SVG grid, floating orbs, marquee technologies, animated progress bars, and a dynamic section counter.
- **Accessibility**: Includes `:focus-visible` gold rings, `aria-labels`, `aria-current`, and `role` attributes.
- **Theming**: Dark/Light mode toggle.

**Technical Implementations:**
- **API Framework**: Express 5.
- **Database**: PostgreSQL with Drizzle ORM for data persistence.
- **Validation**: Zod for schema validation.
- **API Codegen**: Orval generates API clients and Zod schemas from an OpenAPI spec.
- **Frontend**: React 19 with Vite, TailwindCSS, Framer Motion, and Recharts.
- **AI Models**: Anthropic Claude (`claude-sonnet-4-5`) for text generation (redesign, SEO, pricing) and Replicate (Flux, Recraft) for image generation.
- **Image Processing**: Sharp for post-processing generated images.
- **Authentication**: Session-based with `bcryptjs` for passwords and AES-256-GCM for encrypting sensitive credentials. Supports `admin` and `client` roles with row-level security and admin impersonation.
- **CMS**: A visual CMS with a split-panel editor for admins to manage public landing page content, supporting various field types and AI-driven content improvement. Content is versioned and stored in PostgreSQL.
- **Shopy Brain**: An "OmniCore Memory Engine" designed for knowledge ingestion, storage, and retrieval, enabling bidirectional learning from AI operations. It includes a Reference Intelligence Engine for image and video analysis, and an OmniCore Pricing Intelligence CFO module for agency pricing and service catalog management.
- **Email Flow Builder**: Integrates with Klaviyo, allowing admins to design, generate (via OmniCore), and push email flows.
- **Scheduled Jobs**: Cron jobs for daily revenue snapshots, market research, competitor price scans, and inventory sync.
- **Feature Modules**:
    1.  **Revenue Intelligence 360°**: Attribution dashboard, event tracking, AI analysis of Shopify order data.
    2.  **Intelligent Inventory Engine**: Stock monitoring, critical alerts, AI-generated restock emails.
    3.  **Onboarding + Achievement System**: Tracks user progress and awards achievements.
    4.  **Competitor Intelligence**: Manages competitors, performs AI-powered scans, and generates alerts.
    5.  **Stripe Billing + Affiliate Program**: Manages subscriptions, plans, and an affiliate system (demo mode).
    6.  **ML Predictive Engine**: Forecasts key metrics with confidence intervals.
    7.  **Voice Interface**: Claude interprets Spanish commands for platform actions.
    8.  **Mobile PWA**: Progressive Web App features for mobile access.
    9.  **Final Polish**: Includes a command palette, notification center, and enhanced accessibility.

## External Dependencies
- **Database**: PostgreSQL
- **AI Services**:
    - Anthropic Claude (`claude-sonnet-4-5`)
    - Replicate (Flux, Recraft)
- **E-commerce Platform**: Shopify (OAuth, Storefront API, Admin API)
- **Email Marketing**: Klaviyo
- **Payment Gateway**: Stripe (for billing, currently in demo mode)
- **Other Libraries/Tools**:
    - `bcryptjs`
    - `express-session`
    - `connect-pg-simple`
    - `sharp` (for image processing)
    - `axios` (for HTTP requests)
    - `vite`
    - `tailwindcss`
    - `framer-motion`
    - `recharts`
    - `zod`
    - `drizzle-orm`
    - `orval`
    - `pino` (for logging)