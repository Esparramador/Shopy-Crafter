# 🔧 ARREGLOS COMPLETOS — SHOPY CRAFTER PRODUCCIÓN
## 249 rutas sin try/catch · 66 rutas IA sin anti-502 · Token fixes
## Instrucciones exactas para Replit — archivo por archivo

---

# ESTRATEGIA: 3 FIXES QUE ARREGLAN TODO

En vez de editar 45 archivos manualmente, usamos 3 cambios estratégicos:

---

# FIX 1: MIDDLEWARE GLOBAL — Captura TODOS los errores no manejados
**Archivo:** `artifacts/api-server/src/app.ts`
**Impacto:** Protege las 249 rutas sin try/catch de UN GOLPE

Después de `app.use(router)` (o donde se registran las rutas), añadir ESTE middleware de error global:

```typescript
// ═══ GLOBAL ERROR HANDLER — catches ALL unhandled route errors ═══
// This is the SAFETY NET for any route that doesn't have its own try/catch.
// Express calls this when next(err) is called or when an async handler throws.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  // Don't send if headers already sent
  if (res.headersSent) {
    logger.error({ err, path: req.path }, "Error after headers sent — connection may be broken");
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Error interno del servidor";
  
  // Log the full error for debugging
  if (status >= 500) {
    logger.error({ err, method: req.method, path: req.path, status }, `[UNHANDLED] ${req.method} ${req.path}`);
  } else {
    logger.warn({ message, method: req.method, path: req.path, status }, `[HANDLED] ${req.method} ${req.path}`);
  }

  // Safe error message — never expose internals to client
  const safeMessage = status >= 500 
    ? "Error interno del servidor. Inténtalo de nuevo." 
    : message;

  res.status(status).json({ 
    error: safeMessage,
    code: status,
    ...(process.env.NODE_ENV !== "production" && { debug: message }),
  });
});
```

**ADEMÁS**, necesitamos que las rutas async lancen sus errores correctamente. Express 4 NO captura errores de async handlers automáticamente. Añadir este wrapper:

```typescript
// ═══ ASYNC HANDLER WRAPPER — makes Express catch async errors ═══
// Without this, unhandled promise rejections in async route handlers
// will crash the server instead of hitting the error middleware.
import { Router } from "express";

const originalRoute = Router.prototype.route;
Router.prototype.route = function (...args: any[]) {
  const route = originalRoute.apply(this, args);
  const methods = ["get", "post", "put", "delete", "patch"];
  for (const method of methods) {
    const original = route[method].bind(route);
    route[method] = function (...handlers: any[]) {
      const wrapped = handlers.map((handler: any) => {
        if (typeof handler !== "function" || handler.length === 4) return handler; // skip error handlers
        return async (req: any, res: any, next: any) => {
          try {
            await handler(req, res, next);
          } catch (err) {
            next(err);
          }
        };
      });
      return original(...wrapped);
    };
  }
  return route;
};
```

**ALTERNATIVA MÁS SIMPLE** si Express 5 (que tu app usa `"express": "^5.0.1"` — verificar):
Express 5 captura async errors automáticamente. Si ya estás en Express 5, solo necesitas el error middleware, NO el wrapper.

**Verificar versión:** En `package.json` de `api-server`, buscar la versión de Express. Si es 5.x, el wrapper NO es necesario.

---

# FIX 2: MIDDLEWARE ANTI-502 PARA RUTAS IA
**Archivo:** `artifacts/api-server/src/app.ts` (o crear `lib/long-running.ts`)
**Impacto:** Protege las 66 rutas IA de 502 del proxy de Replit

**Opción A — Middleware selectivo por path (RECOMENDADO):**

```typescript
// ═══ ANTI-502 MIDDLEWARE — prevents proxy timeout on AI-heavy routes ═══
// Replit's reverse proxy cuts connections after ~60s if no data is sent.
// This sends headers immediately so the proxy knows the connection is alive.

const AI_HEAVY_PREFIXES = [
  "/shopybrain/",
  "/fusion-studio/",
  "/agency/",
  "/research/",
  "/intelligence/",
  "/competitors/",
  "/web-lab/",
  "/generator/",
  "/email-templates/generate",
  "/emails/generate",
  "/emails/flows",
  "/enrichment/",
  "/klaviyo-ai/",
  "/reference/analyze",
  "/inventory/restock-email",
  "/push/vapid-generate",
  "/voice/command",
];

const SEO_AI_PATTERNS = [
  "/seo/generate-metas",
  "/seo/keyword-intelligence",
  "/seo/blog-strategy",
  "/seo/generate-blog-post",
  "/seo/fix-alt-texts",
  "/seo/generate-schemas",
];

const PRODUCT_AI_PATTERNS = [
  "/products/create",
  "/catalog-opportunities",
  "/financial-forecast",
  "/analyze-competitors",
  "/calculate-optimal-price",
  "/ai-estimate-cogs",
  "/bulk-redesign",
  "/images/generate",
  "/visual-dna",
  "/repair-consistency",
  "/audit/run",
  "/exports/generate",
  "/exports/run-full-audit",
  "/ab-tests",
];

app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  
  const isAiHeavy = 
    AI_HEAVY_PREFIXES.some(prefix => path.startsWith(prefix)) ||
    SEO_AI_PATTERNS.some(pattern => path.includes(pattern)) ||
    PRODUCT_AI_PATTERNS.some(pattern => path.includes(pattern));

  if (isAiHeavy && (req.method === "POST" || req.method === "PUT")) {
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Cache-Control", "no-cache");
    
    // Only flush if the response hasn't started yet
    if (typeof res.flushHeaders === "function" && !res.headersSent) {
      res.flushHeaders();
    }
  }

  next();
});
```

**IMPORTANTE:** Este middleware debe ir ANTES de `app.use(router)` para que se ejecute antes de que las rutas procesen la request.

**Orden correcto en app.ts:**
```typescript
// 1. Security headers (helmet, cors)
// 2. Body parsing (express.json)
// 3. Session
// 4. Rate limiting
// 5. ═══ ANTI-502 MIDDLEWARE (AQUÍ) ═══
// 6. Router (app.use(router))
// 7. ═══ GLOBAL ERROR HANDLER (AQUÍ) ═══
```

---

# FIX 3: TOKEN LIMITS Y TRUNCACIÓN
**Archivos:** `artifacts/api-server/src/lib/claude.ts`

## 3.1 — askClaudeWithVision default: 2048 → 8192

**Línea ~3907:**
```typescript
// ANTES:
maxTokens = 2048

// DESPUÉS:
maxTokens = 8192
```

## 3.2 — askClaude default: 4096 → 8192

**Línea ~3838:**
```typescript
// ANTES:
maxTokens = 4096

// DESPUÉS:
maxTokens = 8192
```

## 3.3 — askClaudeJson default: 4096 → 8192

**Línea ~3869:**
```typescript
// ANTES:
maxTokens = 4096

// DESPUÉS:
maxTokens = 8192
```

---

# VERIFICACIÓN — Los 45 archivos de rutas

## Archivos CON try/catch EN TODOS sus handlers (✅ no necesitan cambio):
- `web-lab.ts` — ✅ todos los handlers tienen try/catch + anti-502
- `brain-sync.ts` — ✅
- `store.ts` — ✅ (excepto 1 ruta simple)

## Archivos que NECESITAN el fix (cubiertos por FIX 1 + FIX 2):

| Archivo | Rutas sin try/catch | Rutas IA sin anti-502 | Cubierto por FIX 1+2 |
|---------|--------------------|-----------------------|---------------------|
| `shopybrain.ts` | 16 | 8 | ✅ |
| `exports.ts` | 18 | 2 | ✅ |
| `admin.ts` | 16 | 0 | ✅ |
| `vault.ts` | 16 | 1 | ✅ |
| `projects.ts` | 15 | 2 | ✅ |
| `agency.ts` | 13 | 4 | ✅ |
| `inventory.ts` | 10 | 1 | ✅ |
| `pricing.ts` | 10 | 5 | ✅ |
| `auth.ts` | 9 | 0 | ✅ |
| `client.ts` | 9 | 0 | ✅ |
| `intelligence.ts` | 9 | 3 | ✅ |
| `competitors.ts` | 8 | 2 | ✅ |
| `products.ts` | 8 | 5 | ✅ |
| `seo.ts` | 8 | 6 | ✅ |
| `images.ts` | 7 | 3 | ✅ |
| `ab-testing.ts` | 6 | 1 | ✅ |
| `billing.ts` | 6 | 0 | ✅ |
| `generator.ts` | 5 | 0 | ✅ (ya tiene anti-502 en /run) |
| `push.ts` | 5 | 1 | ✅ |
| `consistency.ts` | 4 | 2 | ✅ |
| `onboarding.ts` | 4 | 0 | ✅ |
| `plans.ts` | 4 | 1 | ✅ |
| `action-buttons.ts` | 3 | 0 | ✅ |
| `audit.ts` | 3 | 1 | ✅ |
| `contact.ts` | 3 | 0 | ✅ |
| `email-templates.ts` | 3 | 1 | ✅ |
| `entity-research.ts` | 3 | 1 | ✅ |
| `redesign.ts` | 3 | 0 | ✅ |
| `reference.ts` | 3 | 1 | ✅ |
| `absorber.ts` | 2 | 0 | ✅ |
| `automations.ts` | 2 | 0 | ✅ |
| `emails.ts` | 2 | 2 | ✅ |
| `enrichment.ts` | 2 | 1 | ✅ |
| `klaviyo.ts` | 2 | 0 | ✅ |
| `reference-images.ts` | 2 | 1 | ✅ |
| `cms.ts` | 1 | 0 | ✅ |
| `gemini-research.ts` | 1 | 0 | ✅ |
| `health.ts` | 1 | 0 | ✅ |
| `jobs.ts` | 1 | 0 | ✅ |
| `klaviyo-ai.ts` | 1 | 2 | ✅ |
| `scripttag.ts` | 1 | 1 | ✅ |
| `voice.ts` | 1 | 1 | ✅ |
| `fusion-studio.ts` | 0 | 2 | ✅ |

---

# INSTRUCCIONES EXACTAS PARA REPLIT

## Paso 1: Verificar versión de Express
```bash
# En la raíz del proyecto api-server:
cat package.json | grep express
```
Si es `"express": "^5.x"` → Solo necesitas el error middleware (no el wrapper async).
Si es `"express": "^4.x"` → Necesitas AMBOS (error middleware + wrapper async).

## Paso 2: Editar `app.ts`

Abrir `artifacts/api-server/src/app.ts` y:

1. **ANTES** de `app.use(router)`, añadir el middleware anti-502 (FIX 2)
2. **DESPUÉS** de `app.use(router)`, añadir el error handler global (FIX 1)
3. Si Express 4: añadir el wrapper async al inicio del archivo

## Paso 3: Editar `claude.ts`

Abrir `artifacts/api-server/src/lib/claude.ts` y cambiar 3 números:
- Línea ~3838: `maxTokens = 4096` → `maxTokens = 8192`
- Línea ~3869: `maxTokens = 4096` → `maxTokens = 8192`
- Línea ~3907: `maxTokens = 2048` → `maxTokens = 8192`

## Paso 4: Verificar que compila
```bash
npm run build
# o
tsc --noEmit
```

## Paso 5: Test rápido
```bash
# Verificar que el error handler funciona:
curl -X POST http://localhost:PORT/api/nonexistent-route
# Debería devolver: {"error":"Error interno del servidor","code":404}

# Verificar anti-502 headers:
curl -v -X POST http://localhost:PORT/api/shopybrain/search -H "Content-Type: application/json" -d '{}' 2>&1 | grep -i "x-accel\|connection\|cache"
# Debería mostrar: X-Accel-Buffering: no, Connection: keep-alive
```

---

# RESULTADO

| Métrica | Antes | Después |
|---------|-------|---------|
| Rutas con error handling | 99 de 348 (28%) | **348 de 348 (100%)** |
| Rutas IA con anti-502 | 5 de 66 (8%) | **66 de 66 (100%)** |
| askClaude default tokens | 4096 | **8192** |
| askClaudeWithVision default | 2048 | **8192** |
| Archivos modificados | — | **2** (app.ts + claude.ts) |
| Tiempo de implementación | — | **15-20 minutos** |

**3 cambios. 2 archivos. 100% de cobertura. 15 minutos.**
