# 📋 CMS — AUDITORÍA + INSTRUCCIONES PARA REPLIT
## El CMS ya tiene click-to-edit. Aquí está lo que funciona y lo que potenciar.

---

# ✅ LO QUE TU CMS YA TIENE (y funciona)

## Click-to-edit en preview — YA IMPLEMENTADO

**Cómo funciona:**
1. La landing en modo preview (`?preview=true`) añade `data-cms-path` a cada elemento editable
2. Al hacer hover → borde dorado punteado + tooltip con el campo (ej: `hero.headline`)
3. Al hacer click → `postMessage({ type: "cms-click-to-edit", path })` al editor
4. El editor recibe el mensaje → abre la sección → scroll al campo → highlight dorado → focus en el input

**Código existente que hace esto:**
```
Landing.tsx línea 83758: window.parent.postMessage({ type: "cms-click-to-edit", path })
CMSEditor.tsx línea 70968: handler escucha "cms-click-to-edit"
landing.css línea 83233: .cms-preview-mode [data-cms-path]:hover { outline: 2px dashed gold }
```

**Funciones helper ya hechas:**
- `cmsClick(path)` — handler onClick para preview mode
- `cmsProps(path)` — devuelve { onClick, title, data-cms-path }
- `cmsData(path)` — devuelve { title, data-cms-path }

## Otras capacidades existentes:
- ✅ Preview en 3 dispositivos (desktop 100%, tablet 768px, mobile 390px)
- ✅ Edición de ~200+ campos en 15+ secciones
- ✅ Upload de imágenes y vídeos con preview
- ✅ Historial de versiones con restaurar
- ✅ IA para mejorar textos (endpoint `/cms/ai/improve`)
- ✅ Server-Sent Events para actualizaciones en vivo
- ✅ Auto-save con drafts + confirmación
- ✅ Campos: texto, textarea, color picker, boolean toggle, URL, imagen

---

# ⚠️ LO QUE FALTA — 3 mejoras para Replit

## MEJORA 1: contentEditable en el iframe (edición inline)

Ahora al clickar en el preview, el editor lateral se scrollea al campo. Pero el usuario NO puede escribir directamente en el preview.

**Lo que debe hacer Replit:**

En `Landing.tsx`, modificar `cmsProps()` para añadir `contentEditable` en modo preview:

```typescript
const cmsProps = useCallback((path: string) => {
  if (!isPreview) return {};
  return {
    onClick: (e: React.MouseEvent) => cmsNotify(path, e),
    title: `Editar: ${path}`,
    "data-cms-path": path,
    // NUEVO: permitir edición inline en preview
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      // Al terminar de editar, enviar el nuevo texto al editor
      const newText = e.currentTarget.innerText;
      window.parent.postMessage({
        type: "cms-inline-edit",
        path,
        value: newText,
      }, parentOrigin || "*");
    },
    style: { outline: "none" }, // Quitar outline azul de contentEditable
  };
}, [isPreview, cmsNotify, parentOrigin]);
```

En `CMSEditor.tsx`, añadir handler para `cms-inline-edit`:

```typescript
// Dentro del useEffect que escucha messages, añadir:
if (e.data?.type === "cms-inline-edit" && e.data.path && e.data.value !== undefined) {
  // Actualizar el campo en el editor
  handleFieldChange(e.data.path, e.data.value);
}
```

Esto permite escribir directamente en el texto del preview y que se sincronice al editor lateral.

## MEJORA 2: El preview debería actualizarse SIN recargar el iframe

Ahora cada cambio recarga el iframe entero (`setIframeKey(k => k + 1)`). Debería usar postMessage para actualizar solo el campo cambiado.

**Lo que debe hacer Replit:**

En `CMSEditor.tsx`, cuando un campo cambia, enviar postMessage al iframe:

```typescript
const handleFieldChange = (path: string, value: string) => {
  // ... lógica existente de actualización ...
  
  // NUEVO: Enviar al iframe para actualización sin recarga
  iframeRef.current?.contentWindow?.postMessage({
    type: "cms-update-field",
    path,
    value,
  }, window.location.origin);
};
```

En `Landing.tsx`, escuchar `cms-update-field`:

```typescript
// En el useEffect de messages:
if (e.data?.type === "cms-update-field" && e.data.path) {
  // Actualizar el contenido directamente en el DOM
  const el = document.querySelector(`[data-cms-path="${e.data.path}"]`);
  if (el) {
    el.textContent = e.data.value;
  }
  // También actualizar el estado local de content
  // para que los re-renders mantengan el valor
}
```

## MEJORA 3: Extender CMS a páginas admin (no solo landing)

El CMS actual solo edita la landing. Las páginas admin (sidebar labels, tab names, etc.) ya SE LEEN del CMS pero no se pueden editar inline.

Las secciones de admin ya existen en `cms-defaults.ts`:
- `adminPanel.sidebarLabels` — textos del sidebar
- `clientPanel.sidebar` — textos del panel cliente
- `adminPanel.settings` — textos de configuración

**Lo que debe hacer Replit:** Nada nuevo aquí — estos campos YA se pueden editar desde CMSEditor. Solo asegurarse de que las secciones `adminPanel` y `clientPanel` están visibles y editables en el editor.

---

# 🎙️ VOICE — INSTRUCCIONES PARA REPLIT

El sistema de voz tiene 7 bugs documentados en `FIXES_VOICE_GUIA_REPLIT.md`. Los más críticos:

1. **`recognition.onerror`** no dice qué error ocurrió → FIX: mapear 6 tipos de error
2. **Solo 11 de 23 acciones ejecutables** por voz → FIX: añadir las 12 que faltan
3. **Alt+V no funciona** → FIX: añadir addEventListener keydown
4. **Animación `pulse` no existe** → FIX: usar `pulseGold` que sí existe
5. **SpeechSynthesis no elige voz española** → FIX: buscar voz es-ES
6. **Botón invisible si no hay soporte** → FIX: mostrar botón gris deshabilitado
7. **Bubble desaparece a los 8s** → FIX: esperar si hay acción en curso

---

# 🎯 PROMPT EXACTO PARA REPLIT

Copia y pega esto en Replit:

```
Necesito que hagas estos cambios en mi app ShopyCrafter. Son mejoras incrementales
que NO rompen nada existente. Lee cada instrucción y aplica SOLO lo que se indica:

1. VOICE FIXES (VoiceButton.tsx):
   - recognition.onerror: mapear errores específicos (not-allowed, no-speech, audio-capture, network)
   - EXECUTABLE_ACTIONS: añadir las 12 acciones que faltan (search_suppliers, scan_store, set_product_status, diagnose_app, inspect_code, fix_code, list_source_files, analyze_component, modify_audit_filter, list_all_products)
   - Alt+V keyboard shortcut: addEventListener keydown con altKey + v
   - Animación: cambiar "pulse 1s infinite" por "pulseGold 1.5s ease-in-out infinite"
   - SpeechSynthesis: buscar voz es-ES con getVoices()
   - Botón cuando no hay soporte: mostrar gris deshabilitado con tooltip
   - Bubble timeout: subir de 8s a 12s y no ocultar si hay acción ejecutándose

2. CMS ENHANCEMENT (Landing.tsx + CMSEditor.tsx):
   - En cmsProps(): añadir contentEditable + onBlur que envía "cms-inline-edit" via postMessage
   - En CMSEditor: escuchar "cms-inline-edit" y actualizar el campo
   - En handleFieldChange: enviar "cms-update-field" al iframe para actualización sin recarga
   - En Landing: escuchar "cms-update-field" y actualizar el DOM directamente

3. ESTABILIDAD (app.ts):
   - Añadir middleware anti-502 ANTES del router (regex patterns para rutas IA)
   - Añadir error handler global DESPUÉS del router
   - Añadir sanitización de input ANTES del router

4. TOKENS (claude.ts):
   - askClaude default: 4096 → 8192
   - askClaudeJson default: 4096 → 8192
   - askClaudeWithVision default: 2048 → 8192

NO reescribas archivos enteros. Solo modifica las líneas indicadas.
Verifica que compila con npm run build después de cada cambio.
```

---

# RESULTADO ESPERADO

| Funcionalidad | Antes | Después |
|---------------|-------|---------|
| Click en preview → editar campo | ✅ Abre sidebar | ✅ Abre sidebar + edición inline |
| Preview update | Recarga iframe completo | Actualización instantánea sin recarga |
| Voice errores | "Error de reconocimiento" | Mensaje específico por tipo de error |
| Voice acciones | 11 ejecutables | 23 ejecutables |
| Alt+V | No funciona | Funciona |
| Voice en navegadores sin soporte | Botón invisible | Botón gris con tooltip |
| Voz respuesta | Voz por defecto (inglés) | Voz española seleccionada |
| Rutas sin error handling | 249 sin try/catch | 100% protegidas |
| Rutas IA sin anti-502 | 66 sin headers | 100% protegidas |
| Claude Vision tokens | 2048 (trunca) | 8192 (completo) |
