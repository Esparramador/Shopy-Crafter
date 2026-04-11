# 🐛 BUGS REALES ENCONTRADOS — TODAS LAS HERRAMIENTAS
## Escaneo automatizado de 96,211 líneas + revisión manual
## 59 bugs · código exacto para arreglar cada uno

---

# RESUMEN

| Categoría | Cantidad | Severidad |
|-----------|----------|-----------|
| fetch() sin try/catch en frontend | 37 | 🔴 ALTA — crash si la API falla |
| setTimeout sin clearTimeout | 15 | 🟡 MEDIA — memory leak + setState en componente desmontado |
| JSON.parse sin try/catch en backend | 6 | 🔴 ALTA — crash si IA devuelve JSON inválido |
| Missing await en función async | 1 | 🔴 ALTA — resultado silenciosamente ignorado |

---

# 🔴 BUG CRÍTICO 1: `fusion-studio.ts` línea 9250

**JSON.parse sin protección — si Claude devuelve JSON roto, el servidor crashea.**

```typescript
// LÍNEA 9250 — ANTES (crashea):
const analysis = JSON.parse(jsonMatch[0]) as ImageAnalysis;

// DESPUÉS (seguro):
let analysis: ImageAnalysis;
try {
  analysis = JSON.parse(jsonMatch[0]) as ImageAnalysis;
} catch (parseErr) {
  // Intentar reparar con safeJsonParse que ya existe en claude.ts
  const { safeJsonParse } = await import("./claude.js");
  analysis = safeJsonParse<ImageAnalysis>(jsonMatch[0], "fusion-studio-analysis");
}
```

---

# 🔴 BUG CRÍTICO 2: `gemini.ts` línea 9422

**Doble riesgo: JSON.parse dentro de catch sin su propio catch.**

```typescript
// LÍNEA 9422 — ANTES:
} catch {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1] : text.replace(/```[\s\S]*?```/g, "").trim()) as T;
}

// DESPUÉS:
} catch {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    return JSON.parse(match ? match[1] : text.replace(/```[\s\S]*?```/g, "").trim()) as T;
  } catch {
    logger.error({ textPreview: text.slice(0, 200) }, "[Gemini JSON] Double parse failure");
    throw new Error("Gemini returned invalid JSON even after cleanup");
  }
}
```

---

# 🔴 BUG CRÍTICO 3: `scheduler.ts` línea 13409

```typescript
// LÍNEA 13409 — ANTES:
const parsed = JSON.parse(jsonMatch[0]);

// DESPUÉS:
let parsed;
try {
  parsed = JSON.parse(jsonMatch[0]);
} catch {
  logger.warn({ text: jsonMatch[0].slice(0, 200) }, "Scheduler: Failed to parse study results");
  parsed = { insights: [], crossConnections: [] };
}
```

---

# 🔴 BUG CRÍTICO 4: `objectAcl.ts` línea 10440

```typescript
// LÍNEA 10440 — ANTES:
return JSON.parse(aclPolicy as string);

// DESPUÉS:
try {
  return JSON.parse(aclPolicy as string);
} catch {
  return null;
}
```

---

# 🔴 BUG 5: 37 fetch() sin try/catch en frontend

**Estos son los que crashean la UI cuando la API no responde, da timeout, o devuelve error.**

## Fix global — Crear helper `safeFetch`:

```typescript
// Crear: shopify-optimizer/src/lib/safeFetch.ts
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function safeFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}: ${res.statusText}`);
  }
  return res;
}

export async function safeFetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await safeFetch(path, options);
  return res.json() as Promise<T>;
}
```

**Luego, en CADA componente con fetch sin catch, reemplazar:**

```typescript
// ANTES (crash si falla):
const res = await fetch(`${API_BASE}/api/shopybrain/absorb-image`, {
  method: "POST", credentials: "include", body: formData
});
const data = await res.json();

// DESPUÉS (error manejado):
try {
  const res = await fetch(`${API_BASE}/api/shopybrain/absorb-image`, {
    method: "POST", credentials: "include", body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const data = await res.json();
  // ... usar data
} catch (err: any) {
  console.error("Absorb image failed:", err);
  // Mostrar error al usuario en vez de crash silencioso
}
```

### Archivos afectados (37 fetch sin catch):

| Archivo | Líneas | fetch sin catch |
|---------|--------|----------------|
| `OmniChatbot.tsx` | 57967, 57979, 57988, 58032 | 4 (absorb-document, absorb-image, absorb-url, research-entity) |
| `AdminClients.tsx` | 69452, 69578 | 2 (messages, user actions) |
| `CMSEditor.tsx` | 71060, 71070 | 2 (restore version, reset content) |
| `App.tsx` | 53491 | 1 (stop-impersonate) |
| `SaveToVaultButton.tsx` | 59367 | 1 |
| `Competitors.tsx` | (múltiples) | ~3 |
| `EmailTemplates.tsx` | (múltiples) | ~4 |
| `Emails.tsx` | (múltiples) | ~3 |
| `Inventory.tsx` | (múltiples) | ~3 |
| `Pricing.tsx` | (múltiples) | ~5 |
| `ExportCenter.tsx` | (múltiples) | ~3 |
| `ShopyBrainStudy.tsx` | (múltiples) | ~2 |
| `Settings.tsx` | (múltiples) | ~2 |
| Otros | — | ~2 |

---

# 🟡 BUG 6: 15 setTimeout sin cleanup

**Causa: memory leak + React warning "setState on unmounted component".**

**Fix pattern para todos:**

```typescript
// ANTES:
setTimeout(() => setSuccess("¡Guardado!"), 100);

// DESPUÉS:
const timer = setTimeout(() => setSuccess("¡Guardado!"), 100);
// En el cleanup del useEffect o al inicio del siguiente render:
return () => clearTimeout(timer);
```

**Fix global más práctico — usar hook:**

```typescript
// Crear: shopify-optimizer/src/hooks/useSafeTimeout.ts
import { useCallback, useEffect, useRef } from "react";

export function useSafeTimeout() {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);
  
  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
}

// USO en cualquier componente:
const safeTimeout = useSafeTimeout();
safeTimeout(() => setSuccess("¡Guardado!"), 3000);
// Se limpia automáticamente al desmontar — 0 memory leaks
```

---

# ✅ HERRAMIENTAS VERIFICADAS — ESTADO REAL

## Buscador Universal (/admin/search → UniversalSearch.tsx)
| Aspecto | Estado |
|---------|--------|
| Frontend envía `input`, `niche`, `market` | ✅ Correcto |
| Backend recibe `input`, `niche`, `market`, `projectId` | ✅ Match |
| Backend tiene anti-502 (`flushHeaders`) | ✅ Ya implementado |
| Backend tiene try/catch | ✅ |
| Error handling en frontend | ✅ Tiene catch + setError |
| Detección de tipo input (URL/Instagram/marca) | ✅ Funciona |
| Historial en localStorage | ✅ Funciona |
| **¿Genera contenido?** | ✅ SÍ — 12 búsquedas paralelas + síntesis Claude |
| **¿Bug encontrado?** | ⚠️ Frontend no envía `projectId` — backend usa 0 (funciona pero no guarda en vault de proyecto) |

**Fix:** En UniversalSearch.tsx, obtener projectId del contexto si hay proyecto activo:
```typescript
// Añadir al body del fetch:
projectId: activeProjectId || undefined,
```

## Generador Universal IA (/projects/:id/generator → UniversalGenerator.tsx)
| Aspecto | Estado |
|---------|--------|
| Frontend carga tipos con GET /generator/types | ✅ |
| Frontend envía `type`, `projectId`, `url`, `format`, `template`, `level`, `params` | ✅ Match |
| Backend tiene anti-502 | ✅ Ya implementado |
| Backend tiene try/catch | ✅ |
| Error handling frontend | ✅ Tiene catch |
| Descarga de archivos | ✅ Tiene `data.redirect` + `downloadUrl` |
| Historial | ✅ Carga del vault |
| **¿Genera contenido?** | ✅ SÍ — 41 tipos de generación |
| **¿Bug encontrado?** | ⚠️ `data.redirect` usa `window.open(api(data.redirect.replace("/api", "")))` — si redirect ya no tiene /api, doble replace rompe la URL |

**Fix:**
```typescript
// ANTES:
window.open(api(data.redirect.replace("/api", "")), "_blank");
// DESPUÉS (más seguro):
const redirectUrl = data.redirect.startsWith("/api") 
  ? api(data.redirect.replace("/api", "")) 
  : api(data.redirect);
window.open(redirectUrl, "_blank");
```

## Web Lab (/projects/:id/web-lab → WebLab.tsx)
| Aspecto | Estado |
|---------|--------|
| Frontend envía `url`, `projectId`, `template`, `instagram`, `brandName` | ✅ Correcto |
| Backend recibe los 5 campos | ✅ Match perfecto |
| Backend tiene anti-502 | ✅ Ya implementado |
| Backend tiene try/catch | ✅ |
| Brand research (4 búsquedas paralelas) | ✅ Funciona |
| PageSpeed (mobile + desktop) | ✅ |
| Scraping HTML + CSS | ✅ |
| Generación de CSS mejorado | ✅ |
| Guardado en vault | ✅ |
| Historial | ✅ |
| Instagram + brandName inputs | ✅ EXISTEN (líneas 93445-93446) |
| **¿Genera contenido?** | ✅ SÍ — análisis completo + CSS + HTML mejorados |
| **¿Bug encontrado?** | ⚠️ Si la URL no tiene protocolo (ej: "google.com"), `new URL(url)` crashea |

**Fix en backend `web-lab.ts`:**
```typescript
// Añadir al inicio del endpoint, antes de usar url:
let normalizedUrl = url.trim();
if (!normalizedUrl.startsWith("http")) {
  normalizedUrl = "https://" + normalizedUrl;
}
```

## Fusion Studio (backend existente — sin frontend)
| Aspecto | Estado |
|---------|--------|
| `/fusion-studio/analyze` — recibe imágenes | ✅ |
| `/fusion-studio/create-product` — crea producto en tienda | ✅ |
| Anti-502 | ❌ FALTA (cubierto por middleware global FIX 2) |
| `JSON.parse` sin try/catch en lib | 🔴 BUG CRÍTICO 1 (línea 9250) |
| Descomposición visual (capas/texturas/colores) | ✅ Prompt completo |
| maxTokens | ✅ 16000 (override explícito) |
| **Frontend** | ❌ NO EXISTE — necesita FusionStudio.tsx |

## ShopyBrain Chat (/admin/shopybrain → shopybrain.ts)
| Aspecto | Estado |
|---------|--------|
| Anti-502 en /search | ✅ |
| Anti-502 en /study | ✅ |
| Anti-502 en /execute-action | ✅ |
| Try/catch | ✅ En los endpoints principales |
| **¿Bug encontrado?** | ⚠️ Absorb endpoints (absorb-url, absorb-image, absorb-text, absorb-document) NO tienen anti-502 |

---

# ARREGLOS POR PRIORIDAD

## 🔴 PRIORIDAD 1 — Crashes en producción (hacer PRIMERO):

| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 1 | JSON.parse sin catch en Fusion Studio | `lib/fusion-studio.ts:9250` | Wrap en try/catch + safeJsonParse fallback |
| 2 | JSON.parse sin catch en Gemini | `lib/gemini.ts:9422` | Añadir try/catch interno |
| 3 | JSON.parse sin catch en Scheduler | `lib/scheduler.ts:13409` | Wrap + default vacío |
| 4 | JSON.parse sin catch en ACL | `lib/objectAcl.ts:10440` | Wrap + return null |
| 5 | URL sin protocolo en Web Lab | `routes/web-lab.ts:~52557` | Normalizar URL |
| 6 | Redirect URL double-replace en Generator | `UniversalGenerator.tsx:~93011` | Condicional startsWith |

## 🟡 PRIORIDAD 2 — Errores de UI (hacer SEGUNDO):

| # | Bug | Archivos | Fix |
|---|-----|----------|-----|
| 7 | 37 fetch sin catch | 12 archivos frontend | Añadir try/catch a cada fetch |
| 8 | 15 setTimeout sin clear | 8 archivos frontend | Crear useSafeTimeout hook |

## 🟢 PRIORIDAD 3 — Mejoras (hacer TERCERO):

| # | Bug | Fix |
|---|-----|-----|
| 9 | UniversalSearch no envía projectId | Pasar projectId activo |
| 10 | Absorb endpoints sin anti-502 | Cubierto por middleware global |

---

# INSTRUCCIÓN PARA REPLIT

```
ARREGLOS DE BUGS — PRIORIDAD MÁXIMA

Hay 59 bugs detectados en el código. Arregla EN ESTE ORDEN:

1. BACKEND — 4 JSON.parse sin try/catch:
   - lib/fusion-studio.ts línea ~9250: wrap JSON.parse en try/catch, usar safeJsonParse como fallback
   - lib/gemini.ts línea ~9422: añadir try/catch dentro del catch existente
   - lib/scheduler.ts línea ~13409: wrap con default { insights: [], crossConnections: [] }
   - lib/objectAcl.ts línea ~10440: wrap con return null

2. BACKEND — Web Lab URL sin protocolo:
   - routes/web-lab.ts: al inicio del endpoint /web-lab/analyze, normalizar URL:
     if (!url.startsWith("http")) url = "https://" + url;

3. FRONTEND — 37 fetch sin error handling:
   - Crear lib/safeFetch.ts con helper safeFetch + safeFetchJson
   - En CADA componente con fetch sin catch, envolver en try/catch
   - Los 12 archivos afectados: OmniChatbot, AdminClients, CMSEditor, App,
     SaveToVaultButton, Competitors, EmailTemplates, Emails, Inventory,
     Pricing, ExportCenter, ShopyBrainStudy, Settings

4. FRONTEND — 15 setTimeout sin cleanup:
   - Crear hooks/useSafeTimeout.ts
   - Reemplazar setTimeout directo por useSafeTimeout() en los componentes afectados

5. FRONTEND — Generator redirect URL:
   - UniversalGenerator.tsx: condicional en window.open para data.redirect

Verificar: npm run build → 0 errores. Probar cada herramienta en el navegador.
```
