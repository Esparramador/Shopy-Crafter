# ⚡ OPTIMIZACIÓN DE RENDIMIENTO + LIMPIEZA DE CÓDIGO
## TypeScript errors · Dead code · File splitting · Lazy loading · Caching · Speed
## Instrucción para Replit: hacer la app RÁPIDA y LIMPIA

---

# DIAGNÓSTICO ACTUAL

| Métrica | Valor | Estado |
|---------|-------|--------|
| Líneas totales | 96,211 | ⚠️ Pesado |
| Backend | 51,998 líneas (54%) | Normal para la funcionalidad |
| Frontend | 41,054 líneas (42%) | ⚠️ Pesado — se carga TODO de golpe |
| Archivos | 282 | OK |
| Imports potencialmente sin usar | ~283 | ❌ Basura |
| Funciones duplicadas | 3 funciones × 3-4 copias | ❌ Basura |
| Lazy loading | **0** | ❌ CERO — toda la app se carga de golpe |
| Compression | ✅ gzip activo | OK |
| console.log en backend | 0 | ✅ Limpio (usa logger) |
| Archivos monolito (>1000 líneas) | 20 archivos | ⚠️ Necesitan split |

---

# INSTRUCCIONES PARA REPLIT

## PASO 1: ELIMINAR TYPESCRIPT ERRORS

```bash
# Ejecutar verificación de tipos ESTRICTA
npx tsc --noEmit --strict 2>&1 | head -100
```

**Reglas para arreglar TypeErrors:**
- `any` implícito → Añadir tipo explícito o `unknown` + type guard
- `possibly undefined` → Añadir `?.` optional chaining o `?? fallback`
- `unused variable` → Eliminar la variable
- `missing property` → Añadir la propiedad al tipo o usar Partial<>
- **NUNCA** usar `@ts-ignore` o `// @ts-expect-error` — arreglar el tipo real

```bash
# Después de arreglar cada archivo:
npx tsc --noEmit
# Repetir hasta 0 errores
```

---

## PASO 2: ELIMINAR IMPORTS SIN USAR (~283 detectados)

```bash
# Encontrar automáticamente:
npx eslint --rule '{"no-unused-vars": "error", "@typescript-eslint/no-unused-vars": "error"}' --ext .ts,.tsx src/

# O si no hay ESLint configurado, usar el compilador:
npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep "declared but"
```

**Eliminar CADA import que no se usa.** Esto reduce:
- El tamaño del bundle (webpack/vite tree-shakes mejor con menos imports)
- El tiempo de compilación
- La confusión al leer el código

---

## PASO 3: EXTRAER FUNCIONES DUPLICADAS A UTILS

Estas funciones están copiadas en 3-4 archivos diferentes:

### `scoreColor()` — 3 copias (líneas 11697, 26664, 93430)
```typescript
// CREAR: api-server/src/lib/utils/score-color.ts
export function scoreColor(score: number): string {
  if (score >= 80) return "#00d68f";
  if (score >= 60) return "#c8a84b";
  if (score >= 40) return "#ffa500";
  return "#ff4757";
}

// EN CADA ARCHIVO QUE LA USA: reemplazar la función local por:
import { scoreColor } from "../lib/utils/score-color.js";
```

### `timeSince()` — 4 copias en frontend (líneas 68408, 68982, 80070, 80761)
```typescript
// CREAR: shopify-optimizer/src/lib/time-utils.ts
export function timeSince(dateStr: string | null, labels?: { never?: string; today?: string; yesterday?: string }): string {
  if (!dateStr) return labels?.never ?? "Nunca";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return labels?.today ?? "Hoy";
  if (diffDays === 1) return labels?.yesterday ?? "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  return `Hace ${Math.floor(diffDays / 30)} meses`;
}

// EN CADA PÁGINA: reemplazar la función local por:
import { timeSince } from "@/lib/time-utils";
```

### `fetchProjects()` — 3 copias (líneas 72211, 72937, 77668)
```typescript
// CREAR: shopify-optimizer/src/hooks/useProjects.ts
import { useState, useEffect } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/projects`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setProjects(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { projects, loading };
}

// EN CADA PÁGINA: reemplazar fetchProjects() por:
const { projects, loading } = useProjects();
```

---

## PASO 4: LAZY LOADING — IMPACTO MÁXIMO EN VELOCIDAD

**Ahora mismo:** cuando el usuario abre la app, el navegador descarga TODAS las 56 páginas de golpe (~41,000 líneas de JS). Si el usuario solo va a /admin/shopybrain, carga igualmente Pricing, SEO, Emails, Landing, etc.

**Con lazy loading:** solo carga la página que el usuario visita. Las demás se cargan bajo demanda.

### En App.tsx — convertir TODOS los imports a lazy:

```typescript
// ANTES (carga TODO de golpe):
import Audit from "./pages/projects/Audit";
import Pricing from "./pages/projects/Pricing";
import SEO from "./pages/projects/SEO";
// ... 50 imports más

// DESPUÉS (carga solo lo que se necesita):
import { lazy, Suspense } from "react";

const Audit = lazy(() => import("./pages/projects/Audit"));
const Pricing = lazy(() => import("./pages/projects/Pricing"));
const SEO = lazy(() => import("./pages/projects/SEO"));
const Images = lazy(() => import("./pages/projects/Images"));
const Redesign = lazy(() => import("./pages/projects/Redesign"));
const Consistency = lazy(() => import("./pages/projects/Consistency"));
const ABTesting = lazy(() => import("./pages/projects/ABTesting"));
const ExportCenter = lazy(() => import("./pages/projects/ExportCenter"));
const UniversalGenerator = lazy(() => import("./pages/projects/UniversalGenerator"));
const WebLab = lazy(() => import("./pages/projects/WebLab"));
const FusionStudio = lazy(() => import("./pages/projects/FusionStudio"));
const Settings = lazy(() => import("./pages/projects/Settings"));

// Admin pages
const ShopyBrain = lazy(() => import("./pages/admin/ShopyBrain"));
const CommandCenter = lazy(() => import("./pages/admin/CommandCenter"));
const Competitors = lazy(() => import("./pages/admin/Competitors"));
const Emails = lazy(() => import("./pages/admin/Emails"));
const EmailTemplates = lazy(() => import("./pages/admin/EmailTemplates"));
const CMSEditor = lazy(() => import("./pages/admin/CMSEditor"));
const GeminiIntelligence = lazy(() => import("./pages/admin/GeminiIntelligence"));
const GlobalVault = lazy(() => import("./pages/admin/GlobalVault"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const Billing = lazy(() => import("./pages/admin/Billing"));
const Revenue = lazy(() => import("./pages/admin/Revenue"));
const Forecast = lazy(() => import("./pages/admin/Forecast"));
const Intelligence = lazy(() => import("./pages/admin/Intelligence"));
const Inventory = lazy(() => import("./pages/admin/Inventory"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminABTests = lazy(() => import("./pages/admin/AdminABTests"));
const AdminAutomations = lazy(() => import("./pages/admin/AdminAutomations"));
const Achievements = lazy(() => import("./pages/admin/Achievements"));
const Roadmap = lazy(() => import("./pages/admin/Roadmap"));
const ApkManager = lazy(() => import("./pages/admin/ApkManager"));
const SystemHealth = lazy(() => import("./pages/admin/SystemHealth"));
const MyPricing = lazy(() => import("./pages/admin/MyPricing"));
const TemplateStudio = lazy(() => import("./pages/admin/TemplateStudio"));
const ProjectVault = lazy(() => import("./pages/admin/ProjectVault"));
const AdminClients = lazy(() => import("./pages/AdminClients"));

// Client pages
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const ClientProducts = lazy(() => import("./pages/client/ClientProducts"));
const ClientApprovals = lazy(() => import("./pages/client/ClientApprovals"));
const ClientMessages = lazy(() => import("./pages/client/ClientMessages"));
const ClientReports = lazy(() => import("./pages/client/ClientReports"));

// Otras
const Landing = lazy(() => import("./pages/Landing"));
const NewProject = lazy(() => import("./pages/NewProject"));
const Home = lazy(() => import("./pages/Home"));

// NO lazy (se usan siempre):
// - LoginPage, AppLayout, AuthContext, CmsContext — mantener import normal
```

### Envolver las rutas en Suspense:

```tsx
// Loading fallback global:
const PageLoader = () => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "60vh", color: "var(--t3)", fontSize: 13,
  }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 8, animation: "pulseGold 1.5s ease-in-out infinite" }}>⚡</div>
      <div>Cargando...</div>
    </div>
  </div>
);

// En cada Route:
<Route path="/projects/:id/audit">
  {(params) => (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Audit />
      </Suspense>
    </AppLayout>
  )}
</Route>
```

**Impacto estimado: -60% en tamaño de carga inicial.** El usuario solo descarga ~5,000 líneas en vez de ~41,000.

---

## PASO 5: SPLIT DE ARCHIVOS MONOLITO

Los 3 archivos más grandes del backend deben dividirse:

### `shopybrain.ts` (9,603 líneas, 24 rutas)
```
DIVIDIR EN:
├── shopybrain-chat.ts      → /search, /chat, /study
├── shopybrain-absorb.ts    → /absorb-url, /absorb-image, /absorb-text, /absorb-document
├── shopybrain-entity.ts    → /research-entity, /audit-entity, /entity-knowledge
├── shopybrain-actions.ts   → /execute-action (el switch gigante)
├── shopybrain-memory.ts    → /memories, /insights, /sessions, /niche-profiles
└── shopybrain-suppliers.ts → /supplier-research, /supplier-report
```

### `exports.ts` (5,038 líneas, 27 rutas)
```
DIVIDIR EN:
├── exports-seo.ts          → /seo-audit
├── exports-pricing.ts      → /pricing-report, /financial
├── exports-inventory.ts    → /inventory-report
├── exports-consistency.ts  → /consistency-report
├── exports-full.ts         → /full-audit, /generate-ai-report
├── exports-brand.ts        → /brand-kit, /brand-css
├── exports-utils.ts        → getReportShell, reportShell*, BRAND constants
└── exports-download.ts     → /download-zip, /download-excel
```

### `OmniChatbot.tsx` (2,135 líneas)
```
DIVIDIR EN:
├── OmniChatbot.tsx         → Componente principal (estado + render)
├── ChatMessageList.tsx     → Lista de mensajes
├── ChatInput.tsx           → Input + upload + send
├── ChatActions.tsx         → Botones de acción rápida
└── useChatbot.ts           → Hook con toda la lógica (fetch, actions, state)
```

**NO es obligatorio hacer esto ahora** — es una mejora de mantenibilidad que se puede hacer gradualmente. Pero reduce el tiempo que tarda el editor en abrir archivos grandes y mejora la compilación incremental.

---

## PASO 6: CACHING EN BACKEND

### Rutas que se llaman frecuentemente y devuelven datos que no cambian cada segundo:

```typescript
// CREAR: api-server/src/lib/cache.ts
const cache = new Map<string, { data: any; expires: number }>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expires > now) return Promise.resolve(entry.data as T);
  
  return fn().then(data => {
    cache.set(key, { data, expires: now + ttlMs });
    return data;
  });
}

// Limpiar cache expirado cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires < now) cache.delete(key);
  }
}, 300_000);
```

### Usar en rutas frecuentes:

```typescript
// GET /projects — se llama en CADA carga de página
// Cachear 30 segundos:
const projects = await cached(`projects-${userId}`, 30_000, () =>
  db.select().from(projectsTable).where(eq(projectsTable.userId, userId))
);

// GET /cms/content — se llama en CADA carga de la app
// Cachear 60 segundos:
const content = await cached("cms-content", 60_000, () =>
  db.select().from(cmsTable).limit(1)
);

// GET /onboarding/progress — se llama en cada Home
// Cachear 120 segundos:
const progress = await cached(`onboarding-${userId}`, 120_000, () =>
  db.select().from(onboardingTable).where(eq(onboardingTable.userId, userId))
);
```

---

## PASO 7: FRONTEND OPTIMIZATIONS

### 7.1 — Memoizar componentes pesados
```tsx
// Componentes que re-renderizan mucho sin cambiar:
const MemoizedProductCard = React.memo(ProductCard);
const MemoizedGradeChart = React.memo(GradeChart);
```

### 7.2 — Debounce en inputs de búsqueda
```tsx
// En cualquier input que haga fetch al escribir:
const [search, setSearch] = useState("");
const debouncedSearch = useDebouncedValue(search, 300); // 300ms delay

useEffect(() => {
  if (debouncedSearch) fetchResults(debouncedSearch);
}, [debouncedSearch]);
```

### 7.3 — Virtualización de listas largas
Si hay páginas que muestran 100+ productos en una lista:
```tsx
// Usar react-window o @tanstack/react-virtual
import { FixedSizeList } from "react-window";
// Solo renderiza los items visibles en pantalla
```

---

## PASO 8: ELIMINAR ARCHIVOS INNECESARIOS

```bash
# 14 archivos de .local/skills que NO forman parte de la app:
rm -rf .local/skills/ai-integrations-anthropic/
rm -rf .local/skills/ai-integrations-gemini/
rm -rf .local/skills/ai-integrations-openrouter/

# Verificar que no están importados por nada:
grep -r "ai-integrations-anthropic\|ai-integrations-gemini\|ai-integrations-openrouter" src/
# Si no hay resultados → seguro eliminar
```

---

# IMPACTO ESTIMADO

| Optimización | Impacto en velocidad | Esfuerzo |
|-------------|---------------------|----------|
| Lazy loading (PASO 4) | **-60% carga inicial** | 30 min |
| Eliminar imports muertos (PASO 2) | -10% build time | 20 min |
| Extraer duplicados (PASO 3) | -5% bundle, mejor mantenimiento | 15 min |
| TypeScript strict (PASO 1) | 0 bugs en runtime | 1-2 horas |
| Cache backend (PASO 6) | **-50% queries DB repetidas** | 20 min |
| Split monolitos (PASO 5) | Mejor DX, compilación más rápida | 1-2 horas |
| Memoize + debounce (PASO 7) | -30% re-renders innecesarios | 30 min |
| Eliminar archivos (PASO 8) | -3% tamaño proyecto | 2 min |

**Prioridad: PASO 4 (lazy loading) + PASO 6 (cache) + PASO 1 (TypeScript) = el 80% del impacto en 2 horas.**
