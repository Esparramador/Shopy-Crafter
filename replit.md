# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform (shopycrafter.com) designed for `admin` and `client` roles. It leverages a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for comprehensive e-commerce optimization, including market research, competitor analysis, product trend identification, and content generation. The platform integrates deeply with Shopify to deliver AI-driven insights, automation, and advanced features such as AI-powered product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The project aims to become a leading AI-driven solution for e-commerce, expanding to various platforms and offering extensive agency-level services to boost client ROI.

## User Preferences
- Admin email: `sadiagiljoan@gmail.com` (password stored in DB, bcrypt-hashed)
- Design: gold/black/jade premium dark theme
- Language: Spanish (UI), code in English
- Zero mocked data — all real
- Shopify billing (not Stripe) — generates checkout links per service/client
- Landing-first routing: unauthenticated → `/` (landing); clients only via `/invite/:token`

## System Architecture

The project is a pnpm workspace monorepo built with TypeScript and Node.js 24, structured into `api-server`, `shopify-optimizer` (React+Vite), and `mockup-sandbox`.

### Design System
A premium dark theme is implemented with custom color variables (`--ink`, `--gold`, `--jade`, `--crim`), specific typography (Instrument Serif, Geist), and a fixed layout featuring a gold gradient topline, sidebar, and topbar. A custom "SCCursor" component provides a branded cursor. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page comprises 7 sections: Hero, Engines, Demo, Results, Pricing, Calculator, and Contact.

### Multi-Platform Connector Architecture
An extensible connector abstraction layer (`IPlatformConnector`) supports various e-commerce platforms including Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with WordPress planned. A `ConnectorFactory` dynamically selects the appropriate connector based on the project's `platformType`.

### Product Enrichment and Audit Systems
The platform includes a Product Enrichment System that uses AI to generate SEO meta titles/descriptions, assign Shopify Standard Product Taxonomy categories, and manage custom metafields and digital product inventory. A Comprehensive Product Audit System fetches all product data via GraphQL and performs a 7-criteria weighted scoring (Title, Description, Price, Images, SEO, Content Quality, Trust). All product-related code paths ensure SEO metafields are passed and audited.

### AI-Powered Report Recommendations — "Produce, Not Recommend" Philosophy
All 6 individual reports (SEO, Financial, Consistency, Inventory, Redesigns, Revenue) include Claude-powered professional recommendations via `generateAiRecommendations()` in `exports.ts` (16000 max tokens). Reports follow a "PRODUCE, NOT RECOMMEND" philosophy: instead of suggesting "write a better description", reports PRODUCE the complete description ready to copy and paste. Deliverables include: complete product descriptions, meta titles/descriptions, CSS code with hex colors and typography, JSON-LD Schema markup, full marketing emails (subject + body + CTA), social media posts, photography briefs, brand style guides (color palette, fonts, spacing), landing page designs, and inventory management emails to suppliers. Each action includes a `<div class="ai-deliverable">` section with the finished work product. AI sections have dedicated CSS in all 3 report shells (Classic/gold, Elegance/silver, Prestige/copper) including `.ai-deliverable`, `.ai-glossary`, `.ai-team-briefs` styling. If AI fails, reports generate gracefully without the AI section.

### Chatbot Capabilities
The chatbot supports extensive AI responses (`maxTokens` of 16384), file uploads (images, videos, documents), and includes a document absorption feature for ShopyBrain memory. Display truncations are removed or increased, and three report templates (classic, elegance, prestige) are available for all exports.

### Global Vault
A centralized "Bóveda Global" stores reports, images, and research from projects and external entities, managed via a `project_files` database table and accessible through API routes and a dedicated frontend page (`/admin/vault`).

### Universal Web Audit System
This system audits any website using the Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, storing detailed results in the `audit_results` table. Each audit contributes to ShopyBrain's learning via `learnFromOperation()`.

### Database
PostgreSQL with Drizzle ORM manages over 44 tables, including a `platform_type` column in the `projects` table for platform specificity.

### AI Stack (Single Brain Architecture)
The "ShopyBrain" is a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions for e-commerce operations. All AI interactions pass through ShopyBrain for continuous learning via `learnFromOperation` and `learnFromConversation`, supported by a knowledge search engine, brain sync, and retroactive learning.

### Lab Web (`/projects/:id/web-lab`)
A deep web design analysis tool that extracts real HTML+CSS from any URL (inline `<style>` + external `.css` files), runs PageSpeed + scraper analysis, and sends the actual code to Claude for professional design review. Outputs: improved CSS (copy-paste-ready .css file), improved HTML fragments, professional report with template selection (Classic/Elegance/Prestige), and before/after visual preview. Everything saves to Vault + ShopyBrain learns from each analysis. Backend: `web-lab.ts` with `extractFullWebContent()`, `runWebLabAnalysis()`. Frontend: `WebLab.tsx` with 4 tabs (Summary, CSS, HTML, Preview). Chatbot action: `analyze_web_design`. Download endpoints: CSS, HTML, report, ZIP pack.

### Universal Generator (`/projects/:id/generator`)
A comprehensive content generation tool with 41 types across 9 categories: SEO (8), Informes (7), Marca & Diseño (7), Competencia (3), Finanzas (3), Contenido (5), Datos (4), Análisis Externo (2), Agencia (2). Every generation: (1) produces professional downloadable content, (2) saves to Vault, (3) triggers `learnFromOperation` for ShopyBrain. Supports external URLs for competitive analysis. API: `POST /api/generator/run`, `GET /api/generator/types`, `GET /api/generator/history/:id`, `GET /api/generator/download/:vaultId`. Chatbot action: `run_universal_generator`. Frontend: `UniversalGenerator.tsx`.

### Brand CSS & Kit System (`brand-css-generator.ts`)
Generates personalized CSS files (700+ lines), brand identity guides (HTML/PDF), and complete brand kits (ZIP with CSS + Guide + Tokens + Liquid section). Functions: `fetchBrandProfile()`, `generateBrandCss()`, `generateBrandGuideHtml()`, `generateAiBrandCss()`, `buildBrandDnaContext()`. Endpoints: `/api/exports/brand-css/:id`, `/api/exports/brand-guide/:id`, `/api/exports/brand-kit/:id`, `/api/exports/brand-kit-full/:id`. All AI reports inject brand DNA for personalized CSS code blocks.

### Key Features
Core features include a Client Portal, a visual CMS Editor with AI copywriting, a secure Client Invite Flow, an AI-powered Professional Budget/Invoice Generator, and a full AI Pipeline for Shopify Product Creation (including AI-generated content, pricing, SEO, images, and variants). Other features encompass AI Creative Director Image System, Reference Image Generation System, Virtual Try-On / OOTD System, Audit-First Brain Actions, Page and Theme Management, Purchase Protection, Deep Inventory & Sales Control, Sales Report by Product/Variant (tallas, colores, tamaños, planes, idiomas — any option type with PDF export), Supplier Research, PDF Commercial Reports, and Universal Export/Download systems with unified branding. The platform also includes an AI Economist for optimal pricing, A/B Testing, Price Simulator & P&L Forecast, Comprehensive COGS System, Partial Redesign capabilities, Automated Cron Jobs, and a Copyright Audit System.

### Security
The platform uses AES-256-GCM encryption for sensitive credentials, audit logging, database-backed rate limiting, AI API concurrency queues with exponential backoff, admin route protection, CORS, secure session management, SVG sanitization, PostMessage origin validation, and HTML escaping for XSS protection.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.