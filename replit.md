# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform (shopycrafter.com) for `admin` and `client` roles. It utilizes a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for market research, competitor analysis, product trend identification, and content generation. The platform integrates with Shopify to provide AI-driven insights and automation, aiming to boost ROI for Shopify stores. Its capabilities include AI-powered product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The project aims to be a leading AI-driven solution for e-commerce optimization, expanding its reach to various platforms and offering comprehensive agency-level services.

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
A premium dark theme is applied using specific color variables (`--ink`, `--gold`, `--jade`, `--crim`), custom typography (Instrument Serif, Geist), and a fixed layout featuring a gold gradient topline, sidebar, and topbar. A custom "SCCursor" component provides a branded cursor. The design is responsive across Desktop, Tablet, and Mobile breakpoints, with an adaptive admin panel. The landing page is structured into 7 key sections including Hero, Engines, Demo, Results, Pricing, Calculator, and Contact.

### Multi-Platform Connector Architecture
The platform features an extensible connector abstraction layer (`IPlatformConnector`) to support various e-commerce platforms.
- **Supported Platforms**: Shopify, PrestaShop, WooCommerce, Universal Web Audit. WordPress is planned.
- **ConnectorFactory**: Dynamically provides the correct connector based on the project's `platformType`.
- **Implementations**: Dedicated connectors exist for Shopify (wrapping existing functions), PrestaShop (XML/JSON, HTTP Basic Auth, SEO, stock, combinations), WooCommerce (WC REST API v3, variations, orders, Yoast SEO), and Universal Audit (PageSpeed Insights API + HTML scraping + Claude AI for read-only analysis).

### Product Enrichment System
This system enriches products with AI-generated SEO meta titles and descriptions, Shopify Standard Product Taxonomy categories, custom metafields (e.g., delivery_format, target_audience), and manages inventory for digital products. It supports batch enrichment and ensures comprehensive product data.

### Chatbot Capabilities
The chatbot leverages a `maxTokens` of 16384 for extensive AI responses and supports file uploads of various types (images, videos, documents). It includes a document absorption feature where Claude analyzes uploaded content for ShopyBrain memory. Display truncations have been removed or increased across the platform. Three report templates (classic, elegance, prestige) are available for all exports.

### Error Handling
The system includes professional branded 404 and 500 error pages. Backend error handling provides specific JSON responses for 404, 504, 503, and 429 status codes.

### Global Vault (Bóveda Global)
A centralized repository for reports, images, and research from both registered projects and external entities. It uses a `project_files` database table and provides API routes for listing, saving, downloading, and deleting files. A dedicated frontend page (`/admin/vault`) allows navigation and management of vault content.

### Universal Web Audit System
This system audits any website using Google PageSpeed Insights API, an internal web scraper for HTML content, and Claude AI for analysis. It stores detailed audit results in the `audit_results` table, including PageSpeed scores, scraping data, AI analysis, issues, and recommendations. Each audit contributes to the ShopyBrain's learning via `learnFromOperation()` calls.

### Database
PostgreSQL with Drizzle ORM is used, managing over 44 tables for core platform data and extensive AI-related information. The `projects` table includes a `platform_type` column for platform specificity.

### AI Stack (Single Brain Architecture)
A Dual AI Engine (Claude and Gemini) powered by "ShopyBrain" acts as the central intelligence, integrating also with Replicate and OpenAI gpt-image-1 for image generation. ShopyBrain incorporates over 46,000 knowledge insights and 79+ chatbot actions covering various e-commerce operations like Shopify CRUD, product redesign, A/B testing, and SEO. All AI interactions pass through ShopyBrain to facilitate continuous learning via `learnFromOperation` and `learnFromConversation`. It includes a knowledge search engine for context building, a brain sync system, and a retroactive learning mechanism. A landing page pre-report system generates AI reports for new leads.

### Key Features
- **Client Portal**: Provides KPI summaries and activity timelines.
- **CMS Editor**: A visual click-to-edit editor with 35+ elements, AI copywriting, version history, and live iframe preview.
- **Global CMS Context**: Manages all user-visible strings via `CmsProvider` and `useCmsSection`.
- **Client Invite Flow**: Secure, token-based onboarding.
- **Professional Budget/Invoice Generator**: AI-powered tool.
- **Shopify Product Creation (Full AI Pipeline)**: Automates product creation with AI-generated content, pricing, SEO, images, and variants, utilizing reference image URLs for AI image generation.
- **AI Creative Director Image System**: Uses Claude to generate specialized prompts for unique product images.
- **Reference Image Generation System**: Leverages OpenAI gpt-image-1 to create professional product photos from reference images.
- **Virtual Try-On / OOTD System**: Uses GPT Image-1 for multi-image editing, guided by Claude, for virtual fashion applications.
- **Audit-First Brain Actions**: Integrates audit fields into core Shopify actions and introduces bulk actions for store auditing and product fixes.
- **Page and Theme Management**: Comprehensive CRUD operations for Shopify pages and themes, including AI content generation and full theme file/settings editing.
- **Purchase Protection**: A theme-level script intercepts checkout for non-logged-in users, redirecting them to login.
- **CMS Store Theme Section & Chatbot Sync**: Allows editing all Shopify store theme elements via CMS, synced by the `sync_store_theme` chatbot action.
- **Deep Inventory & Sales Control System**: Professional stock management with chatbot actions.
- **Supplier Research System**: AI-driven intelligence.
- **PDF Commercial Report**: Generates a 17-page branded PDF report.
- **Universal Export System**: Produces comprehensive audit reports with AI analysis and saves all report types to the vault.
- **Vault Professional Download System**: Supports multi-tier downloads with unified branding.
- **Universal Action Buttons**: Provides options to email, save, or download chatbot results.
- **Unified Report Branding System**: All document outputs share SC branding with three selectable templates (Prestige, Elegance, Classic).
- **Quality Standards**: Integrates Semrush-inspired SEO intelligence and applies a "100/100 Quality Standard."
- **AI Economist**: Calculates optimal prices using AI market research.
- **A/B Testing**: Supports image and price variant tests with AI predictions.
- **Price Simulator & P&L Forecast**: Financial analysis tools.
- **Comprehensive COGS System**: AI-estimated cost of goods sold tracking.
- **Partial Redesign**: Allows AI-driven redesign of specific product attributes, including Shopify taxonomy categories and comprehensive metafields.
- **Automated Cron Jobs**: Twelve tasks for continuous learning.
- **Copyright Audit System**: Detects trademark/IP risks and suggests alternatives.

### Security
The platform employs AES-256-GCM encryption for sensitive credentials, includes a migration for token encryption, masks raw tokens in API responses, and provides `safeDecrypt()` for legacy values. It features comprehensive audit logging, database-backed rate limiting, AI API concurrency queues with exponential backoff, admin route protection, CORS, secure session management, SVG sanitization, PostMessage origin validation, and HTML escaping for XSS protection.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.