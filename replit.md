# ShopyBrain Agency Platform

## Overview
ShopyBrain is a multi-user Shopify AI optimization agency platform designed to enhance e-commerce operations. It supports `admin` and `client` roles, leveraging advanced AI models (Gemini, Claude, OmniCore) for market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify's ecosystem to provide comprehensive business intelligence and automation, driving optimization and strategic growth for agencies and their clients. Its core purpose is to maximize ROI for Shopify stores through AI-driven insights and actions.

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
- **Responsive Design**: Utilizes `minmax` for flexible grids, mobile-specific layouts for sidebar/topbar/chatbot, and accessibility features like `focus-visible` and `aria-label`.

### Database
PostgreSQL with Drizzle ORM, utilizing over 42 tables for various functionalities including user management, project data, product information, and extensive AI-related memory and insight storage.

### AI Stack and OmniCore
A three-model pipeline (Gemini → Claude → OmniCore) integrated with image generation.
- **Gemini**: Primarily for research, market intelligence, competitor analysis, product trends, and SEO keyword intelligence, with Google Search grounding (threshold 0.0 = always real search) for real market pricing and keyword data.
- **Claude**: Used for strategic analysis, content generation, and incorporating ShopyBrain context, with BrandDNA and OmniCore knowledge injection for consistency.
- **Replicate (Flux, Recraft)**: For generating product and lifestyle images.
- **OmniCore**: The central "brain" for permanent memory, storing all AI outputs and analysis, and acting as a floating AI chatbot for natural language commands and Shopify action execution (e.g., `optimize_product`, `create_product`, `auto_collections`, `design_all_pages`, `diagnose_app`). It also powers an Entity Research Engine and a context-aware Guide Assistant.

### Key Features
- **Client Portal**: Provides KPI summaries, activity timelines, and export options.
- **Coach Marks**: Sequential tooltip system for first-time admin users.
- **M4 ScriptTag Integration**: For installing and managing tracking pixels.
- **Push Notifications**: VAPID-based system for user notifications.
- **CMS Editor**: Visual content editor for landing pages with AI copywriting and version history.
- **Email Template Studio**: AI-powered editor for professional email templates with brand identity integration and Klaviyo push.
- **AI-Powered Lead Pre-Report**: Landing form submissions trigger 3 parallel Gemini searches (business, market/competition, SEO) and send a detailed HTML pre-report email to craftershopy@gmail.com via Gmail API. Background processing — doesn't block form response.
- **Client Invite Flow**: Secure, token-based system for client onboarding.
- **Professional Budget/Invoice Generator**: AI-powered tool for generating detailed budgets and invoices.
- **Shopify Product Creation (Full AI Pipeline)**: Automates product creation with AI-generated content, real price research, SEO metafields, and AI-generated images. Supports image-to-product creation via chat.
- **Supplier Research System**: AI-driven intelligence for supplier identification and cost analysis.
- **Universal Export System**: Comprehensive hub for various report types and data exports.
- **Price Simulator & P&L Forecast**: Tools for financial analysis, including scenario simulation, price elasticity calculation, and multi-month forecasts.
- **Comprehensive COGS System**: Detailed cost of goods sold tracking across multiple categories.
- **Knowledge Graph Visualization**: Interactive D3.js graph to visualize knowledge domains and insights.
- **Automated Cron Jobs**: Twelve tasks for continuous learning, data consolidation, and operational intelligence, with AI fallback.

### Security
- AES-256-GCM encryption for credentials.
- Comprehensive audit logging for all critical actions.
- Database-backed rate limiting for auth endpoints.
- AI API concurrency queues and exponential backoff for retries.
- Frontend ErrorBoundary and global error handlers.
- Admin route protection, CORS configuration, and secure session management.
- SVG sanitization, PostMessage origin validation, HTML escaping, prototype pollution, path traversal, and dynamic method access protection.
- SAST scan compliance with minimal findings.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model for analysis and content generation.
- **Replicate**: For image generation (Flux, Recraft).
- **Archiver**: Server-side ZIP generation.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: OAuth-based Gmail API for sending real emails (lead pre-reports to craftershopy@gmail.com).
- **connect-pg-simple**: PostgreSQL session store.
- **ExcelJS**: XLSX workbook generation.
- **@google/genai**: For direct Gemini API integration.