# Shopy Crafter Agency Platform

## Overview
Shopy Crafter is a multi-user Shopify AI optimization agency platform utilizing a Dual AI Engine (Gemini + Claude), named "ShopyBrain," for comprehensive e-commerce optimization. It offers AI-driven insights, automation, product creation, image generation, SEO optimization, financial analysis, and a Universal Web Audit system. The platform's vision is to be a leading AI-driven solution for e-commerce, expanding across various platforms and providing extensive agency-level services to enhance client ROI.

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

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
"ShopyBrain" is the central mega-brain that receives, distributes, and stores all requests and knowledge, injecting accumulated intelligence into every AI call. It's a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. Token limits and anti-truncation mechanisms are in place, along with robust rate-limit retry logic for Claude and Gemini. Critical actions such as `fix_code` and `modify_ui` validate path whitelists, block sensitive files, and require explicit confirmation. Destructive actions are guarded by a centralized confirmation system.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, and Gallery features.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content. All reports include Claude-powered professional recommendations. A centralized "Bóveda Global" stores reports, images, and research from projects and external entities. Reports stored as JSON metadata are rendered through `buildBrandedHtmlFromMetadata()` for consistent branded output. Template Studio allows visual editing of custom report templates.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, and full store setup automation.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis. Lab Web offers deep web design analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting (per IP and email for login), AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation for critical actions and user data. `validateEncryptionKey()` enforces key presence in production. PDF generation includes timeout, external resource blocking, and content limits. Image fetching includes size limits and pre-checks. **Project-scoped ACL is centralized in `lib/access.ts` (`canAccessProject` + `requireProjectAccess` middleware) — admin or owning client only**; applied to vault and all 27 export endpoints to prevent cross-tenant data leaks.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Anthropic Claude**: AI model.
- **Replicate**: For image generation (text-to-image).
- **OpenAI gpt-image-1**: For reference-based product image generation/editing.
- **Shopify**: Storefront API and Admin API.
- **Klaviyo**: For email flow integration and lead form notifications.
- **Gmail (Replit Integration)**: For sending all emails from `craftershopy@gmail.com`.
- **@google/genai**: For direct Gemini API integration.
- **Runway**: For video generation.
- **ElevenLabs**: For voice synthesis and cloning.
## 2026-04-29 — E2E real verification + bug fixes

End-to-end practical test of `/fs-pro/concat` (generated 2 dummy MP4s with
ffmpeg, inserted into vault, called concat endpoint, downloaded, verified with
ffprobe). Surfaced **4 real bugs** that smoke tests had missed:

1. **`ffmpeg-static` resolved to a non-existent path** in pnpm runtime
   (`node_modules/.pnpm/.../ffmpeg` not present after install). Affected both
   `composeAd` and `concatVideos`. Fix: new `loadFfmpeg()` helper in
   `lib/fusion-studio-pro.ts` that tries `ffmpeg-static`/`ffprobe-static` first
   and falls back to system `ffmpeg`/`ffprobe` via PATH (Replit Nix runtime
   provides both).
2. **Duplicate import** of `requireProjectAccess` in `routes/exports.ts` (one
   from `lib/access.js`, one stale from `lib/auth.js`). Removed the stale one.
3. **`req.params.projectId` typed as `string | string[]`** in 6 export handlers
   when an extra middleware is added (TS overload inference quirk). Fixed
   with `parseInt(String(req.params.projectId), 10)`.
4. **Vault `/download` endpoint corrupted binaries < 2MB**: `saveToVaultSmart`
   stores them as base64 in `content`, but the download handler was sending
   the raw base64 string as utf-8. Fix in `routes/vault.ts`: detect binary
   mimeType (everything that isn't text/*, json, xml, javascript) and decode
   with `Buffer.from(content, "base64")`. Text-based downloads (HTML reports,
   CSV, CSS) are unaffected.

Final verification: clip 2s + 2s concat → MP4 4.000s exactos; with xfade 0.5s
→ MP4 3.500s exactos (matemáticas correctas, durations vienen de ffprobe real).

---

## Sesión 2026-04-29 (T6) — Verificación auditoría Tier-1 + CRIT-5 patch

Verificación exhaustiva del session plan "Aplicar correcciones auditoría Claude
Opus 4.7". La mayoría de patches Tier-1 ya estaban aplicados de sesiones
previas. Confirmado en código:

**Ya aplicado:** `shopybrain-helpers.ts` (8 helpers), credentials:include en
todos los fetch frontend, DOMPurify XSS en Redesign.tsx + Images.tsx (SVG),
loginLimiter dual + DUMMY_BCRYPT, billing FIX D-03 (Enterprise free 503),
exports `requireProjectAccess` 27 rutas, pdf-generator 20s timeout +
setRequestInterception external fonts, report-cover escHtml(), vault
canAccessProject en todas rutas, use-draft-persistence flag `sensitive`,
shopybrain CRIT-1 (validateFixCodePath), CRIT-2/3 (getSessionProjectId),
CRIT-4 (fetchImageWithSizeLimit 15MB), CRIT-6 (requireConfirmation +
DESTRUCTIVE_ACTIONS), schema express_rate_limits.

**Aplicado en esta sesión:**
- **shopybrain CRIT-5:** guard self-password reset en case `reset_user_password`
  (L9249). Comparación `String(sessionUserId) === String(userId)` con
  confirmación ESTRICTA `=== true || === "true"` (no truthy permisivo).
  Mensaje claro indicando usar "Mi cuenta" o flag `confirmSelfReset: true`.
  Verificado e2e que bloquea bypass por `"false"`, `"0"`, `"yes"`, `0`, `1` y
  permite confirmación válida con `true`/`"true"`.
- **Fix TS errors en `shopify-optimizer/src/lib/sanitize.ts`:** la API actual
  de `dompurify` no expone `DOMPurify.Config` como namespace y
  `DOMPurify.sanitize()` puede devolver `TrustedHTML`. Cambios:
  `import DOMPurify, { type Config } from "dompurify"` y cast `String()` en
  los retornos. Limpia los 6 errores de tsc del frontend.
- **Fix runway ratio mapping (gen3 vs gen4) en `fusion-studio-pro.ts`:**
  Runway gen3a_turbo y gen4_turbo aceptan distintas resoluciones. La API
  rechaza `720:1280` para gen3a (debe ser `768:1280`). Mapas separados por
  modelo. Detectado al intentar generar video real con Runway antes del
  bloqueo final por créditos insuficientes en la cuenta del usuario.

**Verificación final:** `pnpm tsc --noEmit` × 3 paquetes → CERO errores.
API server reinicia OK, login admin 200, e2e CRIT-5 OK.

**Pendientes (no scope de esta sesión, anotados):**
- `admin/users/:userId/reset-password` no valida que `userId` exista (devuelve
  success para fakes). Bug separado del endpoint admin.
- 3 cuentas externas vacías de saldo (Replicate 402, Gemini 429 cap mensual,
  Runway sin créditos) — requiere recarga del usuario para test e2e de
  generación real.

---

## Sesión 2026-04-29 (T7) — Fix 502 Lab Web

**Problema raíz:** `enableLongRunning(res)` programaba heartbeats cada 25s
para mantener viva la conexión, pero solo escribía si `res.headersSent ===
true`. En `/web-lab/analyze` los headers nunca se flusheaban hasta el
`res.end()` final (al cabo de 1-3 min), así que **ningún heartbeat llegaba al
proxy** y la conexión se cortaba a los 60s con 502 Bad Gateway, aunque la
paralelización de PageSpeed (mobile+desktop) ya estaba aplicada.

**Fix (3 líneas en `routes/web-lab.ts` ANTES del trabajo pesado):**
```ts
res.status(200);
res.setHeader("Content-Type", "application/json; charset=utf-8");
enableLongRunning(res);
res.flushHeaders?.();
```

Esto compromete el status/Content-Type tempranamente (lo cual es seguro
porque el handler ya usa `res.end(JSON.stringify(...))` en el camino feliz y
tiene fallback `res.end(JSON.stringify({error}))` en el catch).

**Validación e2e con `https://example.com`:**
- TTFB: **4.8 ms** (antes >60s y caía a 502)
- Total: 172.9 s (Claude askClaudeJsonWithBrain tarda 2-3 min con maxTokens
  16000, dentro de su timeout de 300s)
- HTTP **200**, Content-Type `application/json; charset=utf-8`
- 177 KB de body, **6 heartbeats** (espacios) al inicio + JSON completo
- `JSON.parse` tolera el leading whitespace por spec RFC 8259 → respuesta
  parseada OK con todas las keys: `success`, `analysis`, `brandResearch`,
  `reportHtml`, `vaultIds`, `pageSpeed`, `scraperData`, `url`
- `overallScore: 45` retornado correctamente

**No tocado (alcance limitado al endpoint reportado):** otros 32 endpoints
que también usan `enableLongRunning` heredan el mismo bug latente. Anotado
como seguimiento; aplicar el mismo patrón cuando se reporten 502 en
otras rutas largas, o refactorizar el helper para hacer flushHeaders por
defecto (cambio de mayor riesgo, requiere auditar cada handler para
asegurar que ningún `res.status(...)` vive después de enableLongRunning).

---

## 2026-05-01 · Super Ad Studio (port del script hanakaze-v2-super)

**Objetivo:** portar `scripts/run-hanakaze-v2-super.mjs` (orquestador externo
de 12 clips video + voz ElevenLabs + música ElevenLabs + concat MP4 9:16) a la
app de forma genérica para CUALQUIER marca, con UI de wizard, backend
orquestador async, persistencia en `bulk_jobs`, y aprendizaje en ShopyBrain.

**Arquitectura:**
- `artifacts/api-server/src/lib/super-ad-runner.ts` — worker async
  fire-and-forget (`setImmediate`), pipeline: clips i2v/t2v → TTS → música
  (1-2 segmentos con crossfade ffmpeg local) → concat → `learnFromOperation`.
  State persistente en `bulk_jobs.{status, completedItems, totalItems, log[],
  result jsonb}`. **CRITICAL FIXES aplicados tras code review:** `runFfmpeg`
  con stdio stdout="ignore" (evita bloqueo por buffer pipe); cleanup tmpDir
  en `finally` (no leak si ffmpeg falla).
- `artifacts/api-server/src/lib/vault-smart.ts` — extracción de
  `saveToVaultSmart`, `getProjectReplicateToken`, `fetchVaultBufferById`
  desde `routes/fs-pro.ts` (helpers privados) a lib reusable. **fs-pro.ts NO
  modificado** — sigue usando sus copias internas, sin riesgo en producción.
- `artifacts/api-server/src/routes/super-ad.ts` — 5 endpoints REST con
  `requireAdmin`:
  - `POST /super-ad/upload-ref` (multipart, guarda imagen ref en vault)
  - `POST /super-ad/storyboard` (Claude `askClaudeJsonWithBrain` genera
    storyboard editable con prompts cinemáticos en INGLÉS)
  - `POST /super-ad/run` (arranca worker async, devuelve jobId)
  - `GET /super-ad/jobs/:jobId` (estado + log + result)
  - `GET /super-ad/jobs?projectId=X` (historial)
- `artifacts/shopify-optimizer/src/pages/projects/SuperAdStudio.tsx` —
  wizard 5 pasos (Brief → Referencias drag&drop → Storyboard editable →
  Voz+Música → Generar con polling 3s + log en vivo + descarga MP4 final).
  Polling con **inflight guard + cancelled flag** + cleanup `URL.revokeObjectURL`
  al desmontar.
- Ruta registrada en `App.tsx`: `/projects/:id/super-ad`. Entrada sidebar
  añadida a `DEFAULT_MODULE_NAV` en `AppLayout.tsx` (icono 🎬 Super Ad).

**Validación:** typecheck limpio, los 5 endpoints responden 403 (admin
guard activo), Vite resuelve y recarga el wizard sin errores.
