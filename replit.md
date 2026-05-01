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
A premium dark theme with custom color variables, typography, and a fixed layout featuring a gold gradient topline, sidebar, and topbar. The design is responsive across Desktop, Tablet, and Mobile, with an adaptive admin panel. The landing page includes 7 sections with a fullpage scroll-snap engine on desktop and native scrolling on tablet/mobile.

### Multi-Platform Connector Architecture
An extensible `IPlatformConnector` abstraction layer supports Shopify, PrestaShop, WooCommerce, and Universal Web Audit, with a `ConnectorFactory` for dynamic selection.

### AI Stack (Single Brain Architecture — MEGA-BRAIN)
"ShopyBrain" is the central mega-brain that receives, distributes, and stores all requests and knowledge, injecting accumulated intelligence into every AI call. It's a Dual AI Engine (Claude, Gemini) integrating with Replicate and OpenAI gpt-image-1 for image generation. It contains over 46,000 knowledge insights and 135+ chatbot actions. Token limits, anti-truncation mechanisms, and robust rate-limit retry logic are in place. Critical actions like code fixes and UI modifications validate path whitelists, block sensitive files, and require explicit confirmation. Destructive actions are guarded by a centralized confirmation system.

### Product Intelligence & Optimization
AI-driven Product Enrichment for SEO meta generation and Shopify Standard Product Taxonomy. A Comprehensive Product Audit System performs 7-criteria weighted scoring. COGS estimation and optimal pricing calculation use Gemini with Google Search. Fusion Studio provides AI-powered product photography with Brand Intelligence, Product Analysis, Generation Config, and Gallery features.

### Report Generation & Vault System
Reports follow a "PRODUCE, NOT RECOMMEND" philosophy, delivering complete, ready-to-use content with Claude-powered professional recommendations. A centralized "Bóveda Global" stores reports, images, and research. Reports are stored as JSON metadata and rendered through `buildBrandedHtmlFromMetadata()` for consistent branded output. Template Studio allows visual editing of custom report templates.

### Chatbot Capabilities
The OmniChatbot supports over 140 action types, including Shopify store management, code editing, UI modification, CMS management, Shopify theme editing, and full store setup automation.

### Universal Search & Web Audit
A standalone search and audit tool for any URL, Shopify store, Instagram account, or brand, performing deep AI research and saving results to the vault. Audits any website using Google PageSpeed Insights API, an internal web scraper, and Claude AI for analysis, including deep web design analysis.

### Content Generation
The Universal Generator provides a comprehensive content generation tool with 41 types across 9 categories. Every generation produces downloadable content, saves to Vault, and triggers `learnFromOperation`.

### Security
Employs AES-256-GCM encryption, audit logging, database-backed rate limiting, AI API concurrency queues, admin route protection, CORS, secure session management, SVG/HTML sanitization (DOMPurify), PostMessage origin validation, and robust input validation. `validateEncryptionKey()` enforces key presence in production. PDF generation includes timeout, external resource blocking, and content limits. Image fetching includes size limits and pre-checks. Project-scoped ACL is centralized in `lib/access.ts` (admin or owning client only) and applied to vault and all 27 export endpoints to prevent cross-tenant data leaks.

### Database
PostgreSQL with Drizzle ORM manages over 45 tables, including `platform_type` for platform specificity.

### Super Ad Studio
A feature for generic brand ad creation, porting the `hanakaze-v2-super` script. It includes an async worker pipeline for video clips (image-to-video/text-to-video), ElevenLabs TTS and music integration, and MP4 concatenation. State is persisted in `bulk_jobs`. The UI provides a 5-step wizard for brief, references, editable storyboard generation (Claude), voice/music selection, and final generation with live polling and download.

### AI Model Tier System (configurable, no hardcoding)
Centralized model registry that lets the admin change which Claude/Gemini model powers each task tier without code changes:
- **Library** (`lib/ai-models.ts`): exposes `pickModel(provider, tier, override?)` and `pickModelSync(provider, tier)`. Override chain: explicit arg → DB (`platform_settings`) → ENV → hard default.
- **Tiers**: `fast` (Haiku 4.5 / Gemini 2.5 Flash), `smart` (Sonnet 4.5 / Gemini 2.5 Pro — default), `genius` (Opus 4.1 / Gemini 3.1 Pro Preview), `vision` (Sonnet 4.5 / Gemini 2.5 Pro).
- **Refactor**: `askClaude`, `askClaudeJson` and `askClaudeWithVision` accept an `opts: { tier?, model? }` last argument. Backward compatible — old callsites keep working and resolve to "smart" via the registry. `askClaudeWithVision` defaults to `vision` tier and now records cost via `recordApiUsage`.
- **Admin endpoints** (`/api/admin/ai-models`): GET returns the active matrix (`current`, `default`, `envKey`, `settingsKey`, `source: db|env|default`) plus the `KNOWN_MODELS` catalog for dropdowns. POST `{ provider, tier, model | null }` upserts/clears the override in `platform_settings` (cache invalidated immediately, 60s TTL).
- **Chatbot tools**: `get_ai_models` (read) and `set_ai_model` (write — destructive, requires `confirmed: true`).
- **Wired by default**: `cinematic-director.ts` uses `tier: "genius"` for arcs ≥30 scenes or ≥180s (Sonnet for shorter), and `product-dna.ts` uses `tier: "vision"` explicitly. New code should call `askClaude*({ tier: ... })` instead of relying on the global `CLAUDE_MODEL`.
- **Pending audit (~150 callsites)**: existing routes still rely on the legacy `CLAUDE_MODEL` global. They keep working but need a sweep to opt into specific tiers (e.g. SEO copy → smart, classification/extraction → fast, deep market analysis → genius). Same sweep applies to Gemini callsites once a `gemini.ts` refactor mirrors the Claude pattern.

### Cinematic Long-Form Ads (3–20 min)
Professional long-form trailer/explainer/discourse ad pipeline:
- **No hard caps**: up to 240 scenes / 1800s (30 min). API server `timeout=60min`, headersTimeout=61min.
- **Parallelism**: keyframes generated with concurrency=4, video clips with concurrency=5 (3 for runway), retry=2 with exponential backoff per scene (`runWithConcurrency` + `retry` helpers in `cinematic-multishot.ts`).
- **Multi-block music**: when totalSec>45, `generateMusicLong` produces 8 sectional blocks (intro→outro) and concatenates them with FFmpeg `acrossfade` (1.5s crossfade) for seamless 5-min+ tracks (`fusion-studio-pro.ts`).
- **Cinematic Director** (`lib/cinematic-director.ts`): plans a narrative arc matching the requested duration (3 acts ≤90s, 5 acts ≤300s, 8 acts >300s). Distributes scenes across acts proportionally to act weight. Builds a single coherent voiceover that flows scene-to-scene. Anchors character + product identity in every prompt.
- **Composition modes** (`compositionMode`):
  - `narrative` — free cinematic camera/scene shifts (default, also for short ads).
  - `explainer-locked` — host anchored center-frame, only the BACKGROUND composition shifts (deconstructions, blueprints, exploded views in BG). Ideal for Apple-style explainer discourse.
  - `composite-pro` — director outputs `[FOREGROUND]/[BACKGROUND]` sub-blocks per scene for FFmpeg chroma-key composition in post.
- **Product DNA** (`lib/product-dna.ts`): Claude vision multi-image (up to 4 angles) extraction returning materials, layers, textures, hardware, palette, branding visible-text, key features, dimensions, and 3-8 deconstruction points. Builds an `identityLockBlock` injected verbatim into every keyframe + video prompt to prevent invention/drift across scenes.
- **Endpoint**: `POST /api/projects/:projectId/products/:productId/ads/smart-cinematic` accepts `longForm: boolean`, `compositionMode`, `totalDurationSec` up to 1800. Auto-enables director mode when `totalDurationSec>60`.
- **Object Storage offload** (`lib/vault.ts`): assets that exceed in-DB inline thresholds (>50MB video, >10MB image) are uploaded to private Object Storage at `/vault/<projectId>/<uuid>.<ext>` via `objectStorageClient`. The vault row stores `objectPath` and `content=null`; download/preview routes prioritize `objectPath` over base64 content. **Sin hard cap** — cualquier tamaño se admite. Subida con resumable automático para >5MB, validación CRC32C end-to-end y reintentos exponenciales (1s → 2s → 4s, 3 intentos). Si OS falla los 3 intentos → **disk fallback** automático a `/tmp/vault-fallback/<projectId>/<uuid>.<ext>` registrado en `metadata.diskFallbackPath`+`recoveryNeeded:true`. Las 3 rutas de descarga (single, preview, ZIP) en `routes/vault.ts` leen el disk-fallback como prioridad inmediata tras `objectPath` para que el archivo NUNCA se pierda aunque el bucket esté caído. **Seguridad** (`tryDiskFallback`): valida `realpath()` y exige prefijo estricto `DISK_FALLBACK_ROOT/<projectId>/`, bloqueando LFI vía `metadata` controlado por usuario (audit architect-PASS). **Limitación**: `/tmp` es efímero (no sobrevive reinicio del contenedor); el fallback es de emergencia, no almacenamiento duradero — para recuperación garantizada operar el bucket de OS con disponibilidad alta.
- **Helper compartido `lib/safe-image-fetch.ts`** (architect-PASS): centraliza TODA la lógica de descarga segura de imágenes generadas por Replicate (allowlist anti-SSRF de hosts `*.replicate.delivery`/`*.replicate.com`, solo HTTPS, `redirect:"manual"` con 4 hops máx revalidando cada `Location`, defensa en profundidad sobre `imgRes.url` final, timeout único `dlCtrl` 25s que cubre body, validación temprana de `Content-Length`, stream con cutoff incremental + `reader.cancel()` al exceder cap configurable, MIME allowlist `image/(jpeg|png|webp|gif)` con SVG bloqueado por contener JS). Expone `safeDownloadReplicateImage(url, {tag,maxBytes,timeoutMs})` → `{buffer, mime, sizeKB}` y `safeDownloadReplicateImageAsDataUri()` para embebido inline en HTML. **Reusado por** `routes/contact.ts` (cap 4MB, embed en pre-informe lead) y `routes/images.ts runImageGeneration` (cap 15MB para Flux 1.1 Pro 1440x1440 PNG). Garantiza que CUALQUIER imagen descargada de Replicate pasa por las MISMAS validaciones de producción.
- **BUG FIX CRÍTICO `routes/images.ts runImageGeneration` (2026-05-01)**: antes guardaba `saveToVault({originalUrl: imageUrl})` SIN descargar el binario. Las URLs de Replicate caducan en ~1h, así que cualquier imagen generada con la herramienta principal (TODOS los motores: flux-1.1-pro/flux-schnell/flux-dev/recraft/ideogram/imagen/sd3.5) era invisible/no descargable después de 1h desde el vault. Ahora se descarga con `safeDownloadReplicateImage()` (cap 15MB) y se persiste como `content: base64` (Object Storage automático si excede 10MB). Si la descarga falla → degradación graceful (mantiene `originalUrl` como referencia). **Validado end-to-end** (vault 1307, 1.5MB PNG real, `file` confirma `PNG image data, 1024 x 1024, 8-bit/color RGB`).
- **BUG FIX CRÍTICO `routes/vault.ts` preview Content-Type (2026-05-01)**: antes el endpoint forzaba `Content-Type: text/html` para TODO archivo "no binario", lo que rompía la visualización de CSS/JS/JSON/SVG/XML (el navegador los interpretaba como HTML y se veían como texto sin estilos). Ahora se clasifica en 4 categorías (`binary`/`html`/`svg`/`other-text`) y se sirve con el MIME real: HTML+CSP estricta, SVG+CSP estricta, CSS como `text/css`, JS como `application/javascript`, JSON como `application/json`, etc. Aplicado en AMBOS endpoints `GET /api/projects/:projectId/vault/:fileId/preview` y `GET /api/vault/global/:fileId/preview`. El branch JSON-as-report (legacy informes con metadata) sigue funcionando: detecta `mimeType=application/json && (metadata || fileType=report)`, parsea y reescribe Content-Type a `text/html`+CSP antes de enviar el wrapper renderizado. **Validado**: pre-informe lead (1306) sigue como `text/html` con CSP, imagen PNG (1307) sirve `image/png`, CSS test sirvió `text/css; charset=utf-8`.
- **Landing pre-informe con foto IA real** (`POST /api/contact` → `generatePreReport` en `routes/contact.ts`): el visitante público envía datos de su tienda Shopify; el endpoint responde 200 inmediato y procesa el pre-informe en background. Llama a Gemini Search para investigación + `generateProductSample` (LLM) que devuelve un `ProductSample` con un `generatedImagePrompt`. Si el visitante NO adjuntó imagen propia, se ejecuta `generateProductPhotoFromPrompt` (helper privado, ~líneas 78-247): cascada Replicate `flux-1.1-pro` → `flux-schnell` → `nano-banana` usando `process.env.REPLICATE_API_TOKEN` directo (sin job/DB). La URL temporal se descarga y se embebe como `data:image/jpeg;base64,...` para que el HTML sea autocontenido (las URLs de Replicate caducan en ~1h y el informe se guarda en vault + se envía por email al admin). **Hardening de producción (architect-PASS, 2 rondas)**: (a) cancelación REAL de inferencia vía `AbortController` + `replicate.run({signal})` con timeout 75s (evita "jobs zombie" y coste residual); (b) anti-SSRF con allowlist estricta de hosts (`replicate.delivery`/`*.replicate.delivery`/`replicate.com`/`*.replicate.com`/`api.replicate.com`/`cdn.replicate.com`) + exigencia de `https:`; (c) `redirect:"manual"` con bucle de 4 saltos máximo, validando cada `Location` con `isUrlSafe()` y revalidando `imgRes.url` final tras la respuesta (evita bypass por cadena de 30x); (d) `dlCtrl` único de 25s creado ANTES del primer fetch y limpiado SOLO en el `finally` que envuelve headers+stream (timeout cubre body); (e) cap duro `MAX_IMAGE_BYTES=4MB` con validación temprana de Content-Length + stream con cutoff incremental que llama a `reader.cancel()` al exceder; (f) MIME allowlist `image/(jpeg|png|webp|gif)` con SVG bloqueado explícito (SVG puede contener JS). Si cualquier validación falla → `continue` al siguiente modelo; si toda la cascada falla → null y el HTML cae al placeholder 🛍️ original sin romper el endpoint. **Confirmado end-to-end** (2026-05-01): smoke 1 generó 185KB / vault 1304, smoke 2 generó 76KB / vault 1305, smoke 3 (con manual-redirect) generó 107KB / vault 1306; emails entregados a `craftershopy@gmail.com` en los 3 casos.
- **Chatbot tools**: `list_characters`, `get_character`, `delete_character` (destructive, requires confirmation), `create_character` (accepts `refImageUrl` or `refImageBase64`, downloads/decodes and saves to vault as `character_reference`), `update_character` (edits identity/voice/style fields without touching the image), `persist_cinematic_script` (saves a multi-shot script as a reusable template — returns `scriptId` for later `savedPromptId` reuse), `build_product_dna`, and `create_long_ad` — all registered in `shopybrain.ts execute-action` switch and documented in the system prompt registry so the LLM can discover them.

### Premium Image Endpoints
Two specialized endpoints in `routes/images.ts` complement the 8 classic generation modes:
- `POST /api/projects/:projectId/products/:productId/images/generate-infographic-premium` — Two text rendering modes:
  - **`textMode: "ai"`** (Ideogram renderiza el texto): Claude extracts only literal product data, builds English Ideogram v3 prompt with quoted text. Anti-hallucination guard post-validates every quoted string against the product corpus and strips non-literal inventions. If Ideogram fails by quota, returns explicit 503 `AI_TEXT_UNAVAILABLE` (refuses fallback to nano-banana to protect text quality).
  - **`textMode: "overlay"` (default — ortografía 100% garantizada)**: Claude returns structured JSON `{headline, bullets[], priceBadge, backgroundPrompt}` in target language. Background generated *without text* via cascade fallback chain (`requested → imagen-4-ultra → flux-1.1-pro → flux-schnell → nano-banana`) with throttle backoff between attempts (2.5s + i*1.5s). Sharp composes a vector SVG overlay (headline + bullets + price badge) onto the background → perfect spelling guaranteed in any language.
  - **`language` parameter**: `auto | es | en | fr | it | pt | de | ja | zh`. Claude translates headline/bullets to target language while preserving brand names.
  - All variants persisted to vault with metadata (textMode, language, composedTexts).
- `POST /api/projects/:projectId/products/:productId/images/tryon-quick` — Universal virtual try-on (clothing, cosmetics, accessories, any product). Multipart upload of model image + scene preset + aspect ratio. Downloads product image via SSRF-safe `fetchToBuffer` (DNS validation, private-IP/localhost blocked, no redirects), enforces 15MB max payload, validates magic bytes (PNG/JPEG/WEBP only). Fuses model + product via `gemini-2.5-flash-image` preserving identity and product appearance. Persists to vault.

### Vault & Web Lab Hardening (mayo 2026)
Auditoría completa que garantiza guardado real + descarga 100% del contenido en bóveda y profesionaliza el módulo Web Lab:
- **Vault download priority** (`routes/vault.ts`): los 3 puntos de descarga (single download, ZIP all, ZIP selected) ahora siguen el orden `objectPath → content → metadata → originalUrl`. Antes el `originalUrl` se intentaba ANTES del `content`, lo que devolvía la página live actual del cliente en vez del artefacto guardado en su día. El fallback a `originalUrl` se mantiene como último recurso para registros legacy que sólo tenían URL (imágenes externas no clonadas).
- **Vault rollback orphan** (`routes/fs-pro.ts`): si `saveToVault` falla tras `uploadObject`, ahora se llama `deleteObject` para evitar archivos huérfanos en GCS.
- **Web Lab — guardar edición manual** (`POST /api/web-lab/save-edit`): el usuario edita HTML/CSS en una pestaña con dos `textarea` + iframe preview; al guardar persiste literalmente en bóveda con tipo `web-lab-edited-html` / `web-lab-edited-css`. La descarga devuelve los bytes EXACTOS introducidos.
- **Web Lab — generar desde cero** (`POST /api/web-lab/generate-from-scratch`): pide `pageType` (landing/about/product/contact/blog/pricing) + brief + lista de secciones. Resuelve el brand profile (paleta, tipografías, voz) y construye un prompt con `buildBrandDnaContext`. Llama `askClaudeJsonWithBrain` con `maxTokens=32000` (la generación HTML+CSS profesional excede 16K). Devuelve `{html, css, summary}` y persiste ambos en vault con `web-lab-generated-html` + `web-lab-generated-css`. Ejecuta `checkProductionLimit("image", 1)` antes de flushHeaders y `recordUsage("image", 1)` tras saveToVault, igual que `/web-lab/iterate`.
- **Extracción enriquecida de design signals** (`extractDesignSignals` en `routes/web-lab.ts`): inyecta paleta cuantitativa (hex+rgb+frecuencia), `fontFamilies` con frecuencia, declaraciones `@font-face`, custom properties `--var`, fuentes Google detectadas, en los prompts de `analyze` y `reanalyze`. Esto pasa de inferencia visual a datos verificables.
- **Investigación multi-fuente**: 5ª llamada a `askGeminiWithSearch` con `multiSourceHint` (Wikipedia/Crunchbase/LinkedIn) que añade `brandResearch.encyclopedia` al `contextBlock` y a la memoria.
- **Iframe preview seguro**: los iframes del editor manual y del comparador antes/después usan `sandbox="allow-popups"` (sin `allow-scripts`, sin `allow-popups-to-escape-sandbox`). El HTML/CSS generado se renderiza visualmente sin permitir XSS.
- **JSON parser tolerante** (`lib/claude.ts askClaudeJson`): nueva rama `openfence` que recupera JSON cuando Claude truncó la respuesta sin cerrar ` ```json ` final. `repairJson` ahora cierra strings colgantes (`inString=true` al final del bucle → añade `"`).
- **Frontend WebLab.tsx**: tab "edit" con dos textarea + label + botón guardar + iframe preview con `srcDoc` actualizado vía `useEffect`. Detecta cambio de URL analizada con `lastSeededUrlRef` y pisa el editor sólo cuando es análisis de URL nueva (evita arrastrar contenido de la URL anterior). Botón "✨ Crear desde cero" abre panel con `pageType` + `brief` + `sections` y lanza `generate-from-scratch`.
- **Smoke verificado en producción**: `save-edit` devuelve bytes exactos (59B HTML + 72B CSS); `generate-from-scratch` retorna 22.5KB HTML + 36.5KB CSS en ~3min; descarga de archivo legacy con `originalUrl` (vault#1171) ahora devuelve el HTML guardado (9.6KB) en vez de la página live (18.3KB), confirmando el cambio de prioridad.

### Hanakaze v3 Cascada Premium (1 mayo 2026)
Anuncio publicitario 60s vertical 9:16 para marca @hanakaze.serigraphy generado con script offline `scripts/run-hanakaze-v3-cascada.mjs` (workflow `hanakaze-runner`).

**Mix de motores HIPER-PRO**:
- 6× `kling-master` (kwaivgi/kling-v2.1-master, $0.18/s, calidad 10 + audio nativo) → intro, deconstrucción samurái, try-on kanji, mariposa vuela, perchero levita, outro CTA
- 2× `seedance-pro` (bytedance/seedance-1-pro, $0.07/s, calidad 9 multi-ref) → reveal puesto + cascada colección (clips con identidad real de modelos/prendas)
- Voz off ES Bella `21m00Tcm4TlvDq8ikWAM` (eleven_multilingual_v2 speed 0.96, ~150 palabras encajan en ~55s)
- 1 segmento música 60s vía ElevenLabs Music API directa (shakuhachi+koto+taiko)
- Concat ffmpeg server-side: crossfade 0.35s, voz 1.0, música 0.18, 1080×1920 30fps

**Estructura 8 clips × duración estricta de Kling (5s ó 10s) = 60s exactos raw**:
- 4× clips hero VFX a 10s (deconstrucción/try-on/mariposa/perchero) + 4× clips contextuales a 5s (intro/reveal/cascada/outro)
- Cada prompt incluye `TIMELINE` interno (segundos 0-X / X-Y) coherente con la duración real del clip

**State reanudable**: `logs/hanakaze-v3-state.json` memoiza cada paso (refs subidas, vault IDs por clip, voz, música, concat). Si falla cualquier paso, relanzar el workflow continúa desde el último completado.

**Hardening tras audit architect**:
- `concatFinal` exige estricto 8/8 vault IDs (antes permitía 6/8 con `filter(Boolean)` → narrativa rota)
- Re-subida automática de refs si han pasado >50min (URLs firmadas GCS expiran a la hora; ciclo de render dura ~25-30 min)
- Polling fallback en `genVideo`/`tts`/`concat` cuando el cliente HTTP corta antes de que Replicate/ElevenLabs respondan

**Coste estimado total**: ~$10-12 por anuncio completo (vídeo $9.70 + voz $0.10 + música $0.30).

**Ejecución 1 may 17:00-17:42 — incidente, rescate y estado actual**:
- ✓ Generados y guardados en vault originales: c01 (vault 1314), c02 (vault 1315), c03 (vault 1317).
- ✗ **Bug operativo**: `restart_workflow hanakaze-runner` mientras un POST a generate-video estaba en vuelo NO mata limpiamente el child node (deja proceso huérfano contra Replicate). Tres instancias del runner se acumularon en paralelo cargando c03 → Replicate facturó 6 generaciones de c03 ($10.80) cuando solo 1 llegó al vault.
- ✓ **Lockfile aplicado**: `scripts/run-hanakaze-v3-cascada.mjs` ahora escribe `logs/hanakaze-v3.pid` al arrancar y aborta con exit 2 si el PID anterior sigue vivo. Handlers `SIGTERM`/`SIGINT`/`exit` limpian el lockfile.
- ✓ **Auditoría Replicate completa**: 13 predicciones succeeded en 16:00-17:30 = $16.22 facturado. Inventariadas todas con la API directa (`GET /v1/predictions`).
- ✓ **Rescate ejecutado**: los 5 clips huérfanos de c03 (predicciones IDs `smz733f6wxrm`, `d255v058k5rm`, `q4ztcx08rhrm`, `bb2raxpy6srm`, `83qygrxpv5rm`) descargados desde URLs `replicate.delivery` (132 MB total) y subidos al vault como variantes 1318-1322. Ningún dólar perdido — los $9 quedan como variantes alternativas del c03 reutilizables.
- ✗ c04 falló con `402 Payment Required: Insufficient credit` al agotarse el saldo del proyecto. Estado limpio en `logs/hanakaze-v3-state.json` con c01/c02/c03 + 9 refs. Para terminar c04+c05+c06+c07+c08 se necesitan ~$6.65 adicionales en Replicate.

**Procedimientos críticos**:
- NUNCA llamar `restart_workflow hanakaze-runner` mientras un POST a generate-video está en vuelo (clip generándose). El SIGTERM no aborta la prediction de Replicate y deja el clip sin escribir al vault. Esperar siempre a que el runner pasee al siguiente clip o use el lockfile.
- Para auditar gasto real Replicate sin dashboard: `node` + `fetch("https://api.replicate.com/v1/predictions", { Authorization: "Bearer $REPLICATE_API_TOKEN" })` filtrando por `created_at` y `status===succeeded`. Costes: kling-master 5s=$0.90, kling-master 10s=$1.80, seedance-pro 5s=$0.35, seedance-pro 8s=$0.56.
- Para rescatar clips huérfanos: las URLs `replicate.delivery/.../tmp*.mp4` viven ~24h. Descargar el buffer y POST a `/api/fs-pro/save-to-vault` (multipart con `projectId`, `fileType=fs-pro-video`, `mimeType=video/mp4`, `file=@...`).

**Equivalente desde la UI**: `CreateAdModal` (componente Shopy Crafter) tiene 3 tabs:
- "Rápido" → `/ads/quick` (1 clip Seedance)
- "Cinematográfico" → `/ads/smart-cinematic` (4-6 escenas con Character Lock)
- "Video Try-On" → `/videos/tryon-video` (provider kling/runway, premium, withVoice, lipSync)

La UI no permite todavía configurar mix manual de motores premium (kling-master + seedance multi-ref con timeline custom de 8 clips). Para eso se usa el script offline.

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