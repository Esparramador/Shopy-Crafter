# ⛔ INSTRUCCIÓN PARA REPLIT — AUDIT PROFUNDO OBLIGATORIO

**Lee este documento ENTERO antes de hacer nada. Es la instrucción maestra que gobierna TODO lo que debes implementar y verificar.**

---

## CONTEXTO

Esta app (ShopyCrafter) tiene 96,211 líneas de código, 282 archivos, 348 rutas backend, 56 páginas frontend. Ha sido auditada exhaustivamente por Claude y se han identificado mejoras concretas. Tu trabajo es:

1. Implementar CADA mejora sin romper NADA de lo que ya funciona
2. Después de CADA cambio, verificar que compila y funciona
3. Al final, ejecutar un audit profundo de toda la app

**REGLA ABSOLUTA: Si un cambio rompe algo que antes funcionaba, REVERTIRLO inmediatamente y rehacerlo de otra forma. La app existente NUNCA debe degradarse.**

---

## FASE 1: IMPLEMENTAR (en este orden exacto)

### 1.1 — app.ts (3 bloques de código)

**Añadir ANTES del router, en este orden:**

A) Middleware de sanitización de input — strip __proto__/constructor/prototype de req.body
B) Middleware anti-502 — detecta rutas IA por regex pattern, envía flushHeaders + X-Accel-Buffering: no

**Añadir DESPUÉS del router:**

C) Error handler global — captura TODOS los errores no manejados, devuelve JSON limpio

**Verificación inmediata:**
```
npm run build
```
Si falla → revertir y corregir antes de continuar.

**Test funcional:**
- Hacer una request a una ruta que no existe → debe devolver `{ "error": "...", "code": 404 }` en vez de HTML de error
- Hacer POST a `/api/shopybrain/search` → verificar que los response headers incluyen `X-Accel-Buffering: no`

### 1.2 — claude.ts (3 números)

Cambiar los defaults:
- `askClaude`: `maxTokens = 4096` → `8192`
- `askClaudeJson`: `maxTokens = 4096` → `8192`  
- `askClaudeWithVision`: `maxTokens = 2048` → `8192`

**Verificación:** `npm run build` + buscar en el archivo que NO quede ningún `= 2048` ni `= 4096` en parámetros default de funciones askClaude*.

### 1.3 — VoiceButton.tsx (7 fixes)

**Implementar EN ESTE ORDEN, probando después de cada uno:**

1. `recognition.onerror` → añadir mapeo de 6 tipos de error con `(e: any)` y `e.error`
2. `EXECUTABLE_ACTIONS` → expandir de 11 a 23 acciones (lista exacta en el documento de fixes)
3. Animación → cambiar `"pulse 1s infinite"` por `"pulseGold 1.5s ease-in-out infinite"`
4. Botón sin soporte → cambiar `if (!supported) return null` por botón gris disabled con tooltip
5. Bubble timeout → cambiar 8000 a 12000 + no ocultar si acción en curso
6. Alt+V shortcut → añadir addEventListener("keydown") con useRef para tracking de listening
7. Voz española → añadir getVoices() + buscar voz es-ES + speechSynthesis.onvoiceschanged

**⚠️ CUIDADO con el fix 6 (Alt+V):**
El estado `listening` dentro del keydown handler será stale (closure de JS). DEBES usar un `useRef` sincronizado:
```typescript
const listeningRef = useRef(listening);
useEffect(() => { listeningRef.current = listening; }, [listening]);
// En el handler: if (listeningRef.current) { stop } else { start }
```

**⚠️ CUIDADO con el fix 7 (voz española):**
Chrome carga voces de forma ASÍNCRONA. getVoices() puede devolver array vacío la primera vez. DEBES añadir:
```typescript
speechSynthesis.onvoiceschanged = () => { /* voces cargadas */ };
```

**Verificación:** Abrir Chrome → verificar botón 🎙 visible → pulsar → hablar → verificar que responde en español.

### 1.4 — CMS Enhancement (Landing.tsx + CMSEditor.tsx + CmsContext.tsx)

**⚠️ ESTA ES LA PARTE MÁS DELICADA. Implementar con máximo cuidado:**

**A) En Landing.tsx — contentEditable en cmsProps():**

Añadir `contentEditable: true` + `suppressContentEditableWarning: true` + `onBlur` handler.

**PROBLEMA CONOCIDO:** React y contentEditable tienen conflictos. Cuando React re-renderiza, puede sobrescribir lo que el usuario escribió. Para evitarlo:
- El onBlur debe enviar el nuevo texto via postMessage ANTES de que React re-renderice
- Si hay conflictos, usar `React.memo()` en el componente padre o `shouldComponentUpdate` para evitar re-renders innecesarios del elemento editable
- Probar: escribir en el preview → hacer click fuera → verificar que el texto NO se revierte

**B) En CMSEditor.tsx — escuchar cms-inline-edit:**

Añadir handler dentro del useEffect de messages existente. Cuando recibe `cms-inline-edit`, actualizar el estado local del campo.

**C) En CMSEditor.tsx — enviar cms-update-field al iframe:**

Cuando un campo cambia en el editor lateral, enviar postMessage al iframe. 

**PROBLEMA CONOCIDO:** Diferentes tipos de campo necesitan diferentes actualizaciones en el DOM:
- Texto → `element.textContent = value`
- Color → necesita cambiar CSS variable o style
- Imagen → necesita cambiar `src` attribute
- Boolean → necesita toggle de clase CSS

Replit debe verificar QUÉ tipo de campo se está actualizando y aplicar el cambio correcto. Si es demasiado complejo para todos los tipos, implementar SOLO para texto (que es el 80% de los campos) y dejar colores/imágenes con recarga.

**D) En CmsContext.tsx — SSE para actualización en vivo:**

ANTES de implementar, verificar el formato del endpoint SSE existente:
```bash
curl -N http://localhost:PORT/api/cms/events
```
Ver qué formato envía el servidor. Adaptar el listener al formato REAL, no al formato que yo asumí.

**Verificación del CMS:**
1. Abrir CMS Editor → cargar preview → hacer click en título del hero → escribir texto nuevo → hacer click fuera → verificar que el sidebar se actualizó
2. Cambiar un texto en el sidebar → verificar que el preview se actualiza SIN recargar el iframe
3. Abrir otra pestaña con la landing → editar algo en el CMS → verificar que la otra pestaña se actualiza en vivo
4. Guardar → recargar → verificar que los cambios persisten
5. Versiones → verificar que el historial sigue funcionando
6. AI improve → verificar que sigue funcionando

### 1.5 — Fusion Studio (archivos nuevos)

Crear los archivos según `IMPLEMENTACION_FUSION_STUDIO_SHOPYCRAFTER.md`. Son archivos NUEVOS que no tocan nada existente.

**Verificar:**
- Tab "Fusion Studio" aparece en los proyectos
- La página carga sin errores
- Upload de imagen funciona
- Brand research (URL/Instagram) no da 502
- Análisis de producto devuelve JSON con capas/texturas/colores

### 1.6 — Template Studio (archivos nuevos)

Crear los archivos según `TEMPLATE_STUDIO_CODIGO_COMPLETO.md`. Son archivos NUEVOS.

**Verificar:**
- Ejecutar migración DB → tabla report_templates existe
- "Template Studio" aparece en el sidebar admin
- Crear template → guardar → aparece en la lista
- AI suggest con URL → devuelve colores/fuentes
- Preview en vivo se actualiza al cambiar colores
- Los 3 templates existentes (classic/elegance/prestige) SIGUEN FUNCIONANDO

---

## FASE 2: AUDIT PROFUNDO POST-IMPLEMENTACIÓN

Después de implementar TODO, ejecutar este audit completo:

### 2.1 — Compilación
```bash
npm run build
# DEBE compilar con 0 errores
# Warnings son aceptables, errores NO
```

### 2.2 — Health check
```bash
curl http://localhost:PORT/api/healthz
# DEBE devolver OK/200
```

### 2.3 — Auth
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Sesión persiste entre páginas
- [ ] /auth/me devuelve usuario
- [ ] Rutas protegidas redirigen a login si no hay sesión
- [ ] Portal cliente (/client/*) accesible con sesión de cliente

### 2.4 — Todas las páginas cargan (sin errores de consola)
Navegar a CADA una de estas rutas y verificar que cargan sin error:

**Admin:**
- [ ] /home
- [ ] /admin/shopybrain
- [ ] /admin/command-center
- [ ] /admin/shopybrain/memories
- [ ] /admin/shopybrain/insights
- [ ] /admin/shopybrain/study
- [ ] /admin/clients
- [ ] /admin/products
- [ ] /admin/abtests
- [ ] /admin/automations
- [ ] /admin/revenue
- [ ] /admin/intelligence
- [ ] /admin/gemini-intel
- [ ] /admin/inventory
- [ ] /admin/competitors
- [ ] /admin/forecast
- [ ] /admin/emails
- [ ] /admin/email-flows
- [ ] /admin/cms
- [ ] /admin/vault
- [ ] /admin/search
- [ ] /admin/settings
- [ ] /admin/achievements
- [ ] /admin/roadmap
- [ ] /admin/system
- [ ] /admin/apk
- [ ] /admin/my-pricing
- [ ] /admin/template-studio ← NUEVO
- [ ] /landing
- [ ] /tienda

**Proyecto (usar el ID del primer proyecto):**
- [ ] /projects/{id}/audit
- [ ] /projects/{id}/redesign
- [ ] /projects/{id}/images
- [ ] /projects/{id}/consistency
- [ ] /projects/{id}/ab-testing
- [ ] /projects/{id}/pricing
- [ ] /projects/{id}/seo
- [ ] /projects/{id}/vault
- [ ] /projects/{id}/exports
- [ ] /projects/{id}/generator
- [ ] /projects/{id}/web-lab
- [ ] /projects/{id}/fusion-studio ← NUEVO
- [ ] /projects/{id}/settings

**Cliente:**
- [ ] /client (dashboard)
- [ ] /client/products
- [ ] /client/approvals
- [ ] /client/messages
- [ ] /client/reports

### 2.5 — Funcionalidades críticas
- [ ] ShopyBrain chat responde (POST /shopybrain/search)
- [ ] Generador Universal genera contenido (POST /generator/run)
- [ ] Web Lab analiza URL (POST /web-lab/analyze) — NO da 502
- [ ] Entity Research funciona (POST /shopybrain/research-entity-sync) — NO da 502
- [ ] Export de informes funciona (GET /exports/seo-audit)
- [ ] Voice command funciona (pulsar 🎙 → hablar → respuesta)
- [ ] Alt+V activa/desactiva el micrófono
- [ ] CMS Editor abre y el preview carga
- [ ] CMS click-to-edit funciona en el preview
- [ ] CMS cambios en sidebar se reflejan en preview sin recarga
- [ ] Fusion Studio: upload imagen → análisis completo
- [ ] Template Studio: crear → guardar → preview actualiza en vivo

### 2.6 — Errores que NO deben ocurrir
- [ ] Ninguna ruta devuelve 502 Bad Gateway
- [ ] Ninguna ruta devuelve 500 sin body JSON
- [ ] Ningún error de consola "TypeError" o "undefined is not a function"
- [ ] Ningún error de consola "Failed to fetch" en operaciones que antes funcionaban
- [ ] El botón de voz NO desaparece en Chrome
- [ ] Los informes con template classic/elegance/prestige siguen generándose correctamente

### 2.7 — Responsive
- [ ] Verificar /home en viewport 390px (móvil)
- [ ] Verificar /admin/shopybrain en viewport 390px
- [ ] Verificar que el sidebar se colapsa en móvil
- [ ] Verificar que los tabs de proyecto son scrollables en móvil

---

## FASE 3: SI ALGO FALLA

Si CUALQUIER punto del audit falla:

1. Identificar QUÉ cambio lo causó (git diff o revisar los cambios recientes)
2. Revertir ESE cambio específico
3. Buscar alternativa que no rompa la funcionalidad existente
4. Re-implementar con la alternativa
5. Re-ejecutar el audit desde el punto que falló

**NUNCA dejar un fallo "para después". Arreglarlo antes de continuar con el siguiente punto.**

---

## DOCUMENTOS DE REFERENCIA (código exacto de cada cambio)

| Prioridad | Documento | Qué contiene |
|-----------|-----------|-------------|
| 1 | `FIXES_COMPLETOS_SHOPYCRAFTER.md` | Middlewares app.ts + tokens claude.ts |
| 2 | `FIXES_VOICE_GUIA_REPLIT.md` | 7 fixes de VoiceButton.tsx |
| 3 | `CMS_POTENCIACION_COMPLETA.md` | 4 cambios del CMS con código exacto |
| 4 | `IMPLEMENTACION_FUSION_STUDIO_SHOPYCRAFTER.md` | Backend + frontend Fusion Studio |
| 5 | `TEMPLATE_STUDIO_CODIGO_COMPLETO.md` | DB + backend + frontend Template Studio |
| 6 | `CHECKLIST_OBLIGATORIO_REPLIT.md` | 67 puntos de verificación |
| 7 | `AUDITORIA_TOTAL_SHOPYCRAFTER.md` | Contexto completo de la app |
| 8 | `AUDITORIA_DEFINITIVA_CONEXIONES_SHOPYCRAFTER.md` | 162 conexiones frontend→backend verificadas |
