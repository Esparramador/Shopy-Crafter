# Shopy Crafter — Guía del proyecto (CLAUDE.md)

Plataforma SaaS multi-tenant para optimización de tiendas Shopify con IA.
Stack: React + Vite (frontend) · Node.js/Express (API) · PostgreSQL/Drizzle · pnpm workspace.
UI: tema oscuro dorado/negro/jade — español.

## Reglas duras (NO negociables)

1. **NADA STUB NI MOCK / PLACEHOLDER.** Todo debe ser ejecutable end-to-end 100% real.
2. **No hardcodear NADA.** Toda clave/secret va por `process.env.NOMBRE` o Replit Secrets.
   El hook `secret-scanner` bloquea automáticamente cualquier secret hardcodeado.
3. **Aislamiento multi-tenant.** Cada proyecto pertenece a un `userId` — siempre filtrar por `projectId` + autenticación.
4. **pnpm workspace.** Siempre usar `pnpm --filter @workspace/XXX` o `pnpm add -w` para instalar en raíz.
5. **No editar `artifact.toml` ni `.replit` directamente** — usar skills de artefactos.
6. **Drizzle ORM primero.** Para schema changes usar `db.execute(sql\`...\`)` con `ensureMigration()` idempotente.

## Arquitectura monorepo

```
artifacts/
├── api-server/          → Express API (puerto 8080), src/routes/, src/lib/
├── shopify-optimizer/   → React+Vite frontend (puerto 19080)
└── mockup-sandbox/      → Vite preview server para componentes
packages/
└── db/                  → Drizzle schema compartido
```

## Rutas principales del API

| Prefijo | Qué hace |
|---------|----------|
| `/api/web-designer/*` | Claude Designer Studio — generación HTML streaming, sesiones, demos |
| `/api/web-lab/*` | Web Lab — DNA extractor, brand research, AI redesign |
| `/api/effects/*` / `/api/visme/*` | Effects Engine — 30 snippets + 594 Visme templates |
| `/api/fs-pro/*` | Master Prompt Library — 6,677 templates en 38 librerías |
| `/api/stitch/*` | Google Stitch MCP — generación UI/UX |
| `/api/projects/*` | CRUD proyectos, Brand DNA, vault |
| `/api/admin/*` | Panel admin, MCP Manager, CMS |

## Patrones de código

- **Streaming SSE:** `res.setHeader("Content-Type","text/event-stream")` + `res.write("data: ...\n\n")` + `res.end()`
- **Long-running requests:** `enableLongRunning(res)` antes de operaciones >30s
- **AI calls:** `askClaudeJsonWithBrain()` / `streamHtml()` / `askGeminiWithSearch()`
- **Vault:** `saveToVault(projectId, title, content, category)` para persistir artefactos
- **Plan limits:** `checkProductionLimit()` + `recordUsage()` en endpoints de generación
- **DB raw:** `db.execute(sql\`...\`)` para migraciones, `drizzle-orm` para queries

## Frontend (React + Vite)

- **BASE_URL:** `import.meta.env.BASE_URL.replace(/\/$/, "") + "/api"` — nunca URLs hardcodeadas
- **Router:** Wouter con `<Route>` — no React Router
- **Tema:** gold `#c9a961`, dark `#0d0d1a`, jade `#2a7a4b`, surface `#13131f`
- **Componentes UI:** Tailwind + shadcn/ui en `/src/components/ui/`
- **Auth:** JWT en localStorage — `useAuth()` hook

## Claude Designer Studio

Rutas activas: `/web-designer` (3-panel: Chat | Preview | Code), `/effects-studio`, `/web-lab`
- Lib: `artifacts/api-server/src/lib/web-designer.ts` — DESIGN_SYSTEM_PROMPT + DESIGNER_TEMPLATES
- 26 demos HTML: `artifacts/shopify-optimizer/public/web-demos/01-*.html` ... `26-*.html`
- Genera HTML completo con Three.js, GSAP, SplitType — streaming en tiempo real

## Seguridad activa (hooks en `.claude/hooks/`)

| Hook | Evento | Qué hace |
|------|--------|----------|
| `secret-scanner` | Write/Edit/MultiEdit | Bloquea API keys hardcodeadas (30+ proveedores) |
| `dangerous-command-blocker` | Bash | Bloquea rm -rf, DROP DATABASE, fork bomb, etc. |
| `env-file-protection` | Bash | Impide cat/curl de ficheros `.env` |

## Master Prompt Library

- Archivo: `artifacts/api-server/src/lib/master-prompt-library.json` (6MB+, 6,677 templates, 38 librerías)
- **NUNCA leer entero.** Editar con Python tail-inject (offset `file_size - 8` bytes)
- `getMasterLib()` en `fs-pro.ts` — reconstruye `_meta.libraries` dinámicamente

## Antes de dar algo por terminado

- Build del API: `pnpm --filter @workspace/api-server run build` (debe completar sin errores)
- TypeScript check: sin `any` innecesarios, importaciones correctas
- Cada `fetch()` del frontend debe apuntar a un endpoint que exista en el API
- Verifica que las rutas estén registradas en `artifacts/api-server/src/index.ts`
