# ⛔ CHECKLIST OBLIGATORIO — NADA SE PUEDE OMITIR
## Cada punto tiene verificación. NO marcar como hecho si no pasa la verificación.
## Si Replit omite UN SOLO punto, la app tendrá fallos en producción.

---

# REGLA ABSOLUTA PARA REPLIT:

**Lee TODOS los puntos ANTES de empezar. No empieces a implementar hasta haber leído todo el documento. Cada punto depende de los anteriores. Si omites uno, los siguientes pueden fallar.**

**Después de CADA cambio, ejecuta `npm run build` (o `tsc --noEmit`). Si hay error de compilación, NO avances al siguiente punto — arréglalo primero.**

---

# BLOQUE A — ESTABILIDAD (app.ts + claude.ts)
## Si este bloque no se hace COMPLETO, la app crasheará en producción.

### A1. Middleware de sanitización de input
- [ ] **Archivo:** `api-server/src/app.ts`
- [ ] **Ubicación:** ANTES de la línea que registra el router (`app.use(router)`)
- [ ] **Qué hace:** Strip `__proto__`, `constructor`, `prototype` de req.body + limit 10MB
- [ ] **Código exacto:** Ver `FIXES_COMPLETOS_SHOPYCRAFTER.md` → FIX 4
- [ ] **Verificación:** `npm run build` sin errores

### A2. Middleware anti-502 para rutas IA
- [ ] **Archivo:** `api-server/src/app.ts`
- [ ] **Ubicación:** ANTES de la línea que registra el router, DESPUÉS de A1
- [ ] **Qué hace:** Detecta 30+ patrones de rutas IA con regex y envía `flushHeaders()` + `X-Accel-Buffering: no`
- [ ] **Código exacto:** Ver `FIXES_COMPLETOS_SHOPYCRAFTER.md` → FIX 2
- [ ] **CRÍTICO:** Los regex patterns deben incluir TODOS estos prefijos:
  - `/shopybrain/` (absorb, create-product, supplier, research, audit, search, study, execute, chat)
  - `/fusion-studio/`
  - `/agency/` (analyze, quote, budget, proposal)
  - `/research/`
  - `/intelligence/`
  - `/competitors/` (scan, auto-discover)
  - `/web-lab/`
  - `/generator/run`
  - `/email-templates/generate`
  - `/emails/` (generate, flows)
  - `/enrichment/`
  - `/klaviyo-ai/`
  - `/reference/analyze`
  - `/inventory/restock-email`
  - `/voice/command`
  - Y los patterns de proyecto: `/audit/run`, `/visual-dna`, `/repair-consistency`, `/seo/generate`, `/seo/keyword`, `/seo/blog`, `/seo/fix-alt`, `/seo/generate-schemas`, `/products/create`, `/catalog-opportunities`, `/financial-forecast`, `/analyze-competitors`, `/calculate-optimal-price`, `/ai-estimate-cogs`, `/bulk-redesign`, `/images/generate`, `/exports/generate`, `/exports/run-full`, `/redesign`, `/apply-redesign`, `/enrich-batch`, `/build-image-prompt`, `/plan/check`
- [ ] **Verificación:** `npm run build` sin errores

### A3. Error handler global
- [ ] **Archivo:** `api-server/src/app.ts`
- [ ] **Ubicación:** DESPUÉS de la línea que registra el router
- [ ] **Qué hace:** Captura CUALQUIER error no manejado, devuelve JSON limpio con código HTTP correcto
- [ ] **CRÍTICO:** Debe manejar estos casos específicos:
  - Status 429 → "Límite de solicitudes alcanzado"
  - Status 413 → "El contenido es demasiado grande"
  - Status 401 → "No autenticado"
  - Status 403 → "No autorizado"
  - Status >= 500 → "Error interno del servidor" (sin exponer detalles)
  - `headersSent` → no intentar enviar respuesta
- [ ] **Código exacto:** Ver `FIXES_COMPLETOS_SHOPYCRAFTER.md` → FIX 1
- [ ] **Verificación:** `npm run build` sin errores

### A4. Orden correcto en app.ts
- [ ] **Verificar que el orden es exactamente:**
  1. Security (helmet, cors)
  2. Body parsing (express.json)
  3. Session
  4. Rate limiting existente
  5. **A1: Sanitización** ← NUEVO
  6. **A2: Anti-502** ← NUEVO
  7. `app.use(router)` ← YA EXISTE
  8. **A3: Error handler** ← NUEVO
- [ ] **Si A1, A2 van DESPUÉS del router o A3 va ANTES del router → NO FUNCIONA**

### A5. Token limits en claude.ts
- [ ] **Archivo:** `api-server/src/lib/claude.ts`
- [ ] **Cambio 1:** `askClaude` función → `maxTokens = 4096` cambiar a `maxTokens = 8192`
- [ ] **Cambio 2:** `askClaudeJson` función → `maxTokens = 4096` cambiar a `maxTokens = 8192`
- [ ] **Cambio 3:** `askClaudeWithVision` función → `maxTokens = 2048` cambiar a `maxTokens = 8192`
- [ ] **SOLO cambiar el valor default del parámetro, NO cambiar nada más de la función**
- [ ] **Verificación:** `npm run build` sin errores
- [ ] **Verificación 2:** buscar en el archivo — NO debe quedar ningún `maxTokens = 2048` ni `maxTokens = 4096` en funciones que sean `askClaude`, `askClaudeJson` o `askClaudeWithVision`

---

# BLOQUE B — VOZ (VoiceButton.tsx)
## 7 cambios puntuales. NO reescribir el archivo completo.

### B1. Error handler con mensajes específicos
- [ ] **Buscar:** `recognition.onerror = () => {`
- [ ] **Reemplazar por:** versión con `(e: any)` y mapeo de 6 errores (not-allowed, no-speech, audio-capture, network, aborted, service-not-allowed)
- [ ] **Verificación:** El parámetro `e` se usa → `e.error`

### B2. EXECUTABLE_ACTIONS completo
- [ ] **Buscar:** `const EXECUTABLE_ACTIONS = [`
- [ ] **Reemplazar:** array de 11 elementos por array de 23 elementos
- [ ] **CRÍTICO:** Verificar que CADA una de estas acciones está en el nuevo array:
  - `store_status` ✓
  - `list_products` ✓
  - `list_all_products` ✓ (NUEVA)
  - `create_product` ✓
  - `edit_product` ✓
  - `change_price` ✓
  - `set_product_status` ✓ (NUEVA)
  - `regenerate_token` ✓
  - `get_scopes` ✓
  - `delete_product` ✓
  - `search_product` ✓
  - `publish_product` ✓
  - `get_orders` ✓
  - `scan_store` ✓ (NUEVA)
  - `search_suppliers` ✓ (NUEVA)
  - `modify_audit_filter` ✓ (NUEVA)
  - `diagnose_app` ✓ (NUEVA)
  - `inspect_code` ✓ (NUEVA)
  - `fix_code` ✓ (NUEVA)
  - `list_source_files` ✓ (NUEVA)
  - `analyze_component` ✓ (NUEVA)

### B3. Keyboard shortcut Alt+V
- [ ] **Añadir** `useEffect` con `addEventListener("keydown")` que detecta `e.altKey && e.key === "v"`
- [ ] **Añadir** `useRef` para tracking del estado `listening` dentro del handler
- [ ] **Añadir** cleanup `return () => removeEventListener`
- [ ] **Verificación:** Pulsar Alt+V en el navegador activa/desactiva el micrófono

### B4. Animación pulse → pulseGold
- [ ] **Buscar:** `animation: listening ? "pulse 1s infinite" : "none"`
- [ ] **Reemplazar por:** `animation: listening ? "pulseGold 1.5s ease-in-out infinite" : "none"`
- [ ] **NO crear nuevo @keyframes** — `pulseGold` ya existe en el código

### B5. Selección de voz española
- [ ] **Buscar:** las 2 instancias de `new SpeechSynthesisUtterance`
- [ ] **En AMBAS:** añadir búsqueda de voz española con `getVoices().find(v => v.lang === "es-ES")`
- [ ] **Añadir** en el useEffect inicial: `window.speechSynthesis.getVoices()` para pre-cargar voces
- [ ] **VERIFICAR:** Que se aplica en LAS DOS utterances (respuesta + resultado de acción)

### B6. Botón visible cuando no hay soporte
- [ ] **Buscar:** `if (!supported) return null;`
- [ ] **Reemplazar por:** botón gris deshabilitado con `title="Comando de voz no disponible en este navegador"`
- [ ] **El botón debe tener:** `disabled`, `opacity: 0.3`, `cursor: "not-allowed"`

### B7. Bubble timeout inteligente
- [ ] **Buscar:** `setTimeout(() => setShowBubble(false), 8000)`
- [ ] **Cambiar** 8000 a 12000
- [ ] **Añadir** condición: no ocultar si `actionResult === "Ejecutando..."`

### B-FINAL. Verificación del bloque B completo
- [ ] `npm run build` sin errores
- [ ] Abrir la app en Chrome
- [ ] Verificar que el botón 🎙 aparece (abajo derecha)
- [ ] Pulsar Alt+V → debe activarse
- [ ] Decir "estado de la tienda" → debe responder en español
- [ ] Si no hay micrófono → debe decir qué error específico

---

# BLOQUE C — CMS ENHANCEMENT (Landing.tsx + CMSEditor.tsx)
## Edición inline + actualización sin recarga

### C1. contentEditable en cmsProps (Landing.tsx)
- [ ] **Buscar:** la función `cmsProps` en Landing.tsx
- [ ] **Añadir** a los props retornados: `contentEditable: true`, `suppressContentEditableWarning: true`
- [ ] **Añadir** handler `onBlur` que envía `postMessage({ type: "cms-inline-edit", path, value: e.currentTarget.innerText })`
- [ ] **SOLO para elementos de texto** (h1, h2, p, span) — NO para imágenes o botones
- [ ] **VERIFICAR:** Solo se activa en modo preview (`isPreview === true`)

### C2. Handler de inline-edit en CMSEditor.tsx
- [ ] **Buscar:** el `useEffect` que escucha `window.addEventListener("message", handler)`
- [ ] **Dentro del handler**, añadir condición para `e.data?.type === "cms-inline-edit"`
- [ ] **Cuando recibe:** actualizar el campo en el estado local con `handleFieldChange` o equivalente
- [ ] **VERIFICAR:** El campo en el sidebar se actualiza cuando editas texto en el preview

### C3. Actualización sin recarga del iframe
- [ ] **En CMSEditor.tsx:** cuando se cambia un campo, enviar `postMessage({ type: "cms-update-field", path, value })` al iframe
- [ ] **En Landing.tsx:** escuchar `cms-update-field` y actualizar el DOM element con `document.querySelector([data-cms-path="${path}"])`
- [ ] **VERIFICAR:** Al cambiar un color en el sidebar, el preview se actualiza SIN parpadeo ni recarga

### C-FINAL. Verificación del bloque C completo
- [ ] `npm run build` sin errores
- [ ] Abrir CMS Editor → verificar que el iframe de preview carga
- [ ] Hacer click en un título del preview → verificar que puedes escribir directamente
- [ ] Cambiar un color en el sidebar → verificar que el preview se actualiza sin recargar
- [ ] Cambiar texto en el sidebar → verificar que el preview se actualiza sin recargar

---

# BLOQUE D — FUSION STUDIO (nuevo)
## Ver documento: `IMPLEMENTACION_FUSION_STUDIO_SHOPYCRAFTER.md`

### D1. Backend lib
- [ ] **Añadir** `researchBrandForFusion()` en `lib/fusion-studio.ts`
- [ ] **Añadir** `autoSuggestPhotoSettings()` en `lib/fusion-studio.ts`
- [ ] **Verificación:** `npm run build` — las funciones exportan correctamente

### D2. Backend routes
- [ ] **Añadir** `POST /fusion-studio/brand-research` con anti-502 headers
- [ ] **Añadir** `POST /fusion-studio/auto-suggest`
- [ ] **Añadir** `POST /fusion-studio/generate-photos` con anti-502 headers
- [ ] **Modificar** `POST /fusion-studio/analyze` — añadir anti-502 headers al inicio del try
- [ ] **Modificar** `POST /fusion-studio/create-product` — añadir anti-502 headers al inicio del try
- [ ] **Verificación:** `npm run build` sin errores

### D3. Frontend
- [ ] **Crear** `pages/projects/FusionStudio.tsx`
- [ ] **Incluye:** 4 fases (Marca → Producto → Generar → Galería)
- [ ] **Incluye:** URL + Instagram + nombre empresa + nicho + estilo marca
- [ ] **Incluye:** IA auto-sugiere iluminación/fondo/perspectiva
- [ ] **Incluye:** IA Guard (separación producto/modelo)
- [ ] **Incluye:** responsive (`window.innerWidth < 768` → layout vertical)

### D4. Conexiones
- [ ] **En App.tsx:** añadir `<Route path="/projects/:id/fusion-studio">`
- [ ] **En AppLayout.tsx:** añadir `{ id: "fusion-studio", label: "Fusion Studio", icon: "🔬" }` en `DEFAULT_MODULE_NAV`
- [ ] **Verificación:** Navegar a `/projects/1/fusion-studio` muestra la página

---

# BLOQUE E — TEMPLATE STUDIO (nuevo)
## Ver documento: `TEMPLATE_STUDIO_CODIGO_COMPLETO.md`

### E1. Database schema
- [ ] **Crear** `lib/db/src/schema/report_templates.ts` con tabla de 25 campos
- [ ] **Añadir** `export * from "./report_templates"` en `lib/db/src/schema/index.ts`
- [ ] **Ejecutar migración:** `npx drizzle-kit generate` + `npx drizzle-kit push`
- [ ] **Verificación:** tabla `report_templates` existe en PostgreSQL

### E2. Backend routes
- [ ] **Crear** `api-server/src/routes/report-templates.ts` con 6 endpoints (GET list, GET one, POST create, PUT update, DELETE, POST ai-suggest)
- [ ] **En routes/index.ts:** añadir `import reportTemplatesRouter` + `router.use(reportTemplatesRouter)`
- [ ] **Verificación:** `curl /api/report-templates` devuelve array vacío (no error)

### E3. Frontend
- [ ] **Crear** `pages/admin/TemplateStudio.tsx` con editor + preview en vivo
- [ ] **En App.tsx:** añadir ruta `/admin/template-studio`
- [ ] **En AppLayout.tsx:** añadir item en el sidebar nav

### E4. Conexión con exports existentes
- [ ] **Modificar** `getReportShell()` en `exports.ts` para aceptar templates custom (objetos además de strings)
- [ ] **Añadir** `buildCustomReportShell()` función
- [ ] **En cada endpoint de export:** añadir lectura de `?templateId=X` para cargar template custom
- [ ] **VERIFICAR:** Al exportar un informe SEO con `?templateId=1` usa el template custom

---

# VERIFICACIÓN FINAL — DESPUÉS DE TODOS LOS BLOQUES

- [ ] `npm run build` compila sin errores
- [ ] `/api/healthz` devuelve OK
- [ ] Todas las páginas existentes siguen cargando (audit, pricing, seo, images, etc.)
- [ ] El CMS Editor abre y el preview carga
- [ ] El chatbot ShopyBrain responde
- [ ] El botón de voz aparece y funciona
- [ ] Fusion Studio aparece como tab en los proyectos
- [ ] Template Studio aparece en el sidebar admin
- [ ] Los informes existentes (classic/elegance/prestige) siguen funcionando
- [ ] El login/logout funciona
- [ ] El portal de cliente (`/client/*`) carga

**SI ALGUNA VERIFICACIÓN FALLA → el cambio que la rompió debe revertirse y rehacerse.**
