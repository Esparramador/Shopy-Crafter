# AUDIT_REPORT — ShopifyAI Pro Platform
**Fecha:** 23 Mar 2026 | **Auditor:** OmniCore Deep Scan

---

## RESUMEN EJECUTIVO

| Capa | Estado | Puntuación |
|------|--------|-----------|
| Fundación (DB, Auth, Security) | ⚠️ Gaps de seguridad | 7.8/10 |
| Motores IA (M1–M7) | ✅ Funcionales | 8.0/10 |
| Inteligencia (OmniCore, Revenue, Competitors) | ⚠️ Sin crons | 7.2/10 |
| Producto (Landing, CMS, Billing, PWA) | ⚠️ Billing mock | 7.5/10 |
| Crecimiento (Onboarding, Forecast) | ⚠️ Parcial | 7.0/10 |
| **Gaps críticos** | ❌ Email, Crons, Encriptación | — |

---

## ═══ FUNDACIÓN ═══

### Base de Datos — 40 tablas PostgreSQL
| Tabla | Estado |
|-------|--------|
| users, projects, products, redesigns | ✅ |
| ab_tests, cogs, visual_dna, seo_data | ✅ |
| bulk_jobs, cms_content, cms_versions | ✅ |
| events, revenue_snapshots, forecasts | ✅ |
| inventory_tracking, restock_orders | ✅ |
| competitors, competitor_snapshots, competitor_alerts | ✅ |
| onboarding_progress, achievements | ✅ |
| omnicore_memories, omnicore_insights, omnicore_study_sessions | ✅ |
| omnicore_niche_profiles, omnicore_prompt_library, omnicore_cross_connections | ✅ |
| omnicore_knowledge_domains | ✅ |
| agency_cost_structure, service_catalog, pricing_decisions, pricing_rules | ✅ |
| subscriptions, affiliates, referral_tracking | ✅ |
| approvals, messages, track_events, audit_log | ✅ |
| **sessions** (persistida) | ❌ In-memory, no persiste en reinicios |
| **project_credentials** (tabla separada) | ❌ accessToken en plain text en projects |
| **omnicore_search_cache** | ❌ No existe |
| **omnicore_retroactive_log** | ❌ No existe |

### Seguridad
- ✅ bcrypt password hashing (rounds=12)
- ✅ requireAuth middleware en todas las rutas protegidas
- ✅ requireAdmin middleware en rutas admin
- ✅ requireClientAccess con row-level isolation
- ✅ Rate limiting auth (5 intentos, in-memory Map)
- ❌ **AES-256-GCM encryption en credenciales Shopify** — accessToken almacenado en PLAIN TEXT
- ❌ Audit log parcialmente implementado (solo create_user, invite_client)
- ❌ Rate limiting no persistido (se resetea en cada reinicio)

### Auth
- ✅ POST /auth/login
- ✅ POST /auth/logout
- ✅ GET /auth/me
- ✅ Invite token system (/auth/invite/:token)
- ✅ Impersonación admin (/auth/impersonate/:userId, /auth/stop-impersonate)
- ✅ Admin redirect → /admin, Client → /client
- ❌ **Forgot password** — NO implementado
- ❌ **Reset password** — NO implementado
- ❌ Setup/first-run page — NO existe
- ❌ Email real en invitaciones (genera link pero no envía email)

---

## ═══ DESIGN SYSTEM ═══
- ✅ /public/css/design-system.css (27KB, completo)
- ✅ Dark theme (#080810), tokens gold/jade
- ✅ Botones .btn-gold, .btn-ghost, .btn-danger, .btn-jade
- ✅ Cards, glass-cards, sidebar con gold left-border
- ✅ Toast system (showToast global)
- ✅ Custom scrollbar gold 3px
- ✅ Noise texture overlay
- ✅ Reveal animations (IntersectionObserver)
- ✅ Aliases CSS (.btn-primary, .btn-secondary, .input-field, .form-input)
- ⚠️ Progress modals: implementados en algunos flows, no globales

---

## ═══ ADMIN PANEL ═══
- ✅ /admin/clients — tabla gestión clientes
- ✅ /admin/cms — editor CMS visual
- ✅ /admin/intelligence — Revenue Attribution 360°
- ✅ /admin/inventory — M7 stock health
- ✅ /admin/achievements — grid de logros
- ✅ /admin/roadmap — plan 30-60-90 días
- ✅ /admin/competitors — competitor cards + alerts
- ✅ /admin/billing — planes + uso
- ✅ /admin/affiliates — programa afiliados
- ✅ /admin/forecast — ML predictions
- ✅ /admin/system — system health
- ✅ /admin/shopybrain — OmniCore brain dashboard
- ✅ /admin/shopybrain/memories, /insights, /study
- ✅ /admin/my-pricing — CFO pricing advisor
- ❌ **/admin/emails** — NO existe (email flows manager)
- ❌ **/admin/automations** — NO existe
- ❌ **/admin/products** global — NO existe (solo por proyecto)
- ❌ **/admin/abtests** global — NO existe (solo por proyecto)
- ❌ **/admin/omnicore** (era /admin/shopybrain, OK)

---

## ═══ CLIENT PORTAL ═══
- ✅ /client — Dashboard KPI cards
- ✅ /client/products — listado productos
- ✅ /client/approvals — panel de aprobaciones
- ✅ /client/messages — mensajería
- ✅ Row-level isolation (requireClientAccess)
- ✅ Cliente no puede acceder a /admin
- ⚠️ /client/reports — NO existe separado (incluido en dashboard)

---

## ═══ 7 MOTORES IA ═══
- ✅ M1: Replicate imagen generation (8 tipos, StyleLock)
- ✅ M1: Auto-upload a Shopify con alt text
- ✅ M2: Visual DNA extraction, consistency score
- ✅ M3: A/B test creation, Z-test significancia estadística
- ✅ M3: Auto-winner declaration, nuevo challenger
- ✅ M4: Webhook products/create, auto-audit, cron jobs (código existe pero NO está schedulizado)
- ✅ M5: COGS calculator completo, competitor price, P&L waterfall
- ✅ M5: Psychological pricing rounding
- ✅ M6: Schema JSON-LD, meta tags batch, XML sitemap, PageSpeed API
- ✅ M6: Alt text generation
- ✅ M7: Inventory sync, days-remaining, restock alerts, dead stock
- ✅ M7: Urgency metafield when stock < threshold
- ❌ **M4: Pixel tracker Liquid** — código generado pero ScriptTag API no implementada
- ❌ **Cron jobs NO están registrados** (daily 2am, 3am, 4am, 6am, 7am, weekly, monthly) — TODO EL SCHEDULE ES MANUAL

---

## ═══ OMNICORE CONSCIOUSNESS ═══
- ✅ 11 tablas OmniCore en DB
- ✅ Study sessions (trigger manual)
- ✅ Memory CRUD + search + learn
- ✅ Knowledge domains (14 dominios)
- ✅ getShopyBrainContext() inyectado en Claude calls (redesign, seo, pricing)
- ✅ Niche profiles
- ✅ Cross-connections table
- ❌ **100 seed insights NO cargados** en inicialización
- ❌ **Crons automáticos NO implementados** (3am real-data, 4am market-research, weekly deep-study)
- ❌ **Retroactive reanalysis** — NO implementado
- ❌ **Self-evaluation session** (monthly) — NO implementado
- ❌ Insight universe graph (D3.js) — NO implementado
- ❌ OmniCore dashboard básico existe pero sin brain visualization completa

---

## ═══ REVENUE + COMPETITOR INTELLIGENCE ═══
- ✅ Events table, revenue_snapshots, forecasts
- ✅ Daily revenue snapshots (código existe)
- ✅ Attribution engine (código existe)
- ✅ Revenue waterfall chart
- ✅ Motor ROI table
- ✅ 90-day projection
- ✅ Competitor registry, snapshots, alerts
- ✅ Market position data
- ❌ **Cron jobs** para snapshots y attribution — NO schedulizados
- ❌ Daily competitor scan cron — NO schedulizado
- ❌ Weekly intelligence report (Claude) — NO schedulizado

---

## ═══ ONBOARDING + ACHIEVEMENTS ═══
- ✅ OnboardingWidget component (117 líneas)
- ✅ Onboarding progress table
- ✅ 7 steps definidos
- ✅ Floating checklist widget
- ✅ Progress % calculado
- ✅ 9 achievements definidos
- ⚠️ Achievement toast existe pero sin confetti animation
- ❌ **Confetti animation** — NO implementada
- ❌ **Coach marks** — NO implementados
- ❌ /admin/roadmap existe ✅

---

## ═══ BILLING ═══
- ✅ Subscription management (3 planes)
- ✅ Affiliate program + referral tracking
- ✅ Plan limits (storesLimit, imagesIncluded)
- ✅ Trial system (14 días)
- ❌ **Stripe SDK real** — NO conectado (modo demo)
- ❌ POST /billing/checkout — NO implementado
- ❌ POST /billing/webhook — NO implementado
- ❌ GET /billing/portal — NO implementado
- ❌ Upgrade modal al superar límite — NO implementado

---

## ═══ LANDING PAGE ═══
- ✅ Landing page completa con 7 secciones
- ✅ Hero, Features, How it works, Pricing, Testimonials, CTA
- ✅ Reveal animations IntersectionObserver
- ✅ Precios actualizados (€49/€149/€399 + setup fees)
- ❌ **Full-page scroll-snap** — NO implementado (scroll normal)
- ❌ **Side navigation dots** (right side) — NO implementados
- ❌ **Vertical progress bar** (left side) — NO implementada
- ❌ **Section counter** (bottom center) — NO implementado
- ❌ **Keyboard navigation** (arrows) — NO implementado
- ❌ **Auto-rotating testimonials** (4s) — NO implementado
- ❌ **Counter animations** en section enter — NO implementado

---

## ═══ CMS VISUAL EDITOR ═══
- ✅ /admin/cms con editor visual completo
- ✅ Section visibility toggle
- ✅ Section editor (campos + preview)
- ✅ Version history (30 snapshots)
- ✅ Restore desde version
- ✅ Media library
- ✅ AI improve button en campos de texto
- ⚠️ Drag-to-reorder: UI existe pero no persistida
- ❌ Background types avanzados (video, gallery, particles) — parciales
- ❌ Click-to-edit en landing (postMessage) — NO implementado

---

## ═══ EMAIL MARKETING ═══
- ❌ **EMAIL MARKETING: TODO NO IMPLEMENTADO**
- ❌ Klaviyo API integration (key ahora disponible)
- ❌ /admin/emails page
- ❌ Email flows engine
- ❌ Email sends table
- ❌ 8 pre-built flows (welcome, abandoned cart, etc.)
- ❌ Email analytics (open rate, click rate)
- ❌ Resend/SMTP para envío real

---

## ═══ MOBILE PWA ═══
- ✅ /public/manifest.json configurado
- ✅ /public/sw.js service worker
- ✅ Push subscription endpoint (push.ts)
- ⚠️ VAPID keys: necesitan configurarse en .env
- ⚠️ Push notifications definidas pero sin testing
- ⚠️ Mobile responsive pero no verificado a 375px

---

## ═══ VOICE INTERFACE ═══
- ✅ VoiceButton component (floating mic)
- ✅ POST /api/voice/command con Claude
- ✅ 10+ comandos disponibles
- ✅ Speech synthesis en español
- ⚠️ Web Speech API solo funciona en Chrome/Edge

---

## ═══ CRON JOBS ═══
- ❌ **NINGÚN CRON JOB ESTÁ SCHEDULIZADO**
- ❌ Daily 2am: revenue snapshots + attribution
- ❌ Daily 3am: OmniCore real data integration
- ❌ Daily 4am: OmniCore market research
- ❌ Daily 6am: competitor price scans
- ❌ Daily 7am: inventory sync + alerts
- ❌ Weekly Sunday 2am: OmniCore deep study
- ❌ Weekly Sunday 3am: retroactive reanalysis
- ❌ Monthly 1st: PDF reports
- ❌ Monthly 1st: OmniCore self-evaluation
- **node-cron NO está instalado**

---

## ═══ ERROR HANDLING ═══
- ✅ Shopify API errors traducidos
- ✅ Claude API errors con handling básico
- ✅ Empty states en vistas principales
- ✅ Loading skeletons en datos async
- ✅ 404 page (not-found.tsx)
- ✅ DB connection error handled
- ⚠️ Retry logic: básico, sin exponential backoff
- ⚠️ Rate limiting Claude: sin queue de concurrencia
- ❌ Global window.onerror handler — NO implementado

---

## PRIORIDADES DE IMPLEMENTACIÓN

### 🔴 CRÍTICO — Implementar inmediatamente
1. **Cron Jobs** (node-cron) — toda la inteligencia automática depende de esto
2. **Klaviyo Email Integration** — API key disponible, core del producto
3. **AES-256-GCM encryption** para accessTokens Shopify
4. **Forgot/Reset password** — bloqueante para usuarios reales
5. **Session persistence** (connect-pg-simple) — se pierden sesiones en reinicios

### 🟡 IMPORTANTE — Implementar pronto
6. **/admin/emails** — Email flows manager UI
7. **Landing full-page scroll-snap** — experiencia de venta premium
8. **100 seed insights** OmniCore initialization
9. **Confetti animation** en achievements
10. **Stripe webhook** real (cuando se activen pagos)

### 🟢 MEJORAS — Nice to have
11. Coach marks first visit
12. D3.js insight universe graph
13. Retroactive reanalysis engine
14. Click-to-edit en landing (postMessage)
15. Multilenguaje (es-ES, es-MX, en)
16. Marketplace de plantillas

---
*Reporte generado: 23 Mar 2026 | Total implementado: ~68% | Gaps críticos: 6*
