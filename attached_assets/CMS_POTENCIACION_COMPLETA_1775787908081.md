# 📝 CMS — POTENCIACIÓN COMPLETA
## Para Replit: el CMS debe ser editable en TODAS las páginas, no solo la landing
## Con edición inline, actualización en vivo, y click-to-edit en TODA la app

---

# LO QUE EL CMS YA TIENE (no tocar, solo potenciar)

## Arquitectura actual:
```
CmsProvider (envuelve TODA la app)
  ↓
useCms() → { content, t(path, fallback), reload() }
useCmsSection(section) → { data, t(key, fallback) }
  ↓
Cualquier componente puede leer: t("hero.headline", "Texto por defecto")
  ↓
CMS Editor (CMSEditor.tsx) → iframe preview de /landing?preview=true
  ↓
21 secciones editables (200+ campos)
```

## Secciones que YA se editan desde el CMS:
| Sección | ID | Campos | Se aplica a |
|---------|----|---------|----|
| Sitio | `site` | nombre, tagline, logo, colores, fuentes | TODA la app |
| Fondos | `backgrounds` | tipo, color partículas, video URL | Landing |
| Navegación | `nav` | 4 links + 2 CTAs | Landing |
| Hero | `hero` | titular, subtítulo, highlight, CTAs | Landing |
| Features/Motores | `features` | 6 features con título, desc, tags, stats | Landing |
| Estadísticas | `stats` | 4 métricas con número + label | Landing |
| Cómo funciona | `how` | título, subtítulo, 4 pasos | Landing |
| Resultados | `results` | casos de éxito | Landing |
| Pricing | `pricing` | 3 planes con precios y features | Landing |
| Calculadora | `calculator` | items con precios | Landing |
| Testimonios | `testimonials` | testimonios con texto y autor | Landing |
| CTA Final | `cta` | headline, body, botón | Landing |
| Contacto | `contact` | título, campos, email destino | Landing |
| Demo Cards | `howCards` | cards de demostración | Landing |
| APK Labels | `apkLabels` | textos del APK | APK page |
| Error Messages | `errorMessages` | mensajes de error | TODA la app |
| Hero Demo | `heroDemoTitles` | títulos del demo | Landing |
| **Panel Admin UI** | `adminPanel` | sidebar labels, settings labels | **Admin pages** |
| **Panel Cliente UI** | `clientPanel` | sidebar labels, textos | **Client portal** |
| **Nav Admin** | `adminNav` | navigation items del admin | **Admin sidebar** |
| Footer | `footer` | links, texto, copyright | Landing + toda la app |

## Problema actual:
- El preview en vivo (iframe) SOLO muestra la Landing
- Las secciones adminPanel, clientPanel, adminNav SE GUARDAN pero los cambios solo se ven al recargar la app
- NO hay edición inline (click en preview → escribir directamente)
- NO hay actualización instantánea sin recarga del iframe

---

# CAMBIOS QUE REPLIT DEBE HACER

## CAMBIO 1: Edición inline en el preview de la Landing

### En Landing.tsx — modificar `cmsProps()`:

```typescript
// BUSCAR la función cmsProps (actualmente retorna onClick + title + data-cms-path)
// AÑADIR contentEditable + onBlur para elementos de texto

const cmsProps = useCallback((path: string) => {
  if (!isPreview) return {};
  return {
    onClick: (e: React.MouseEvent) => cmsNotify(path, e),
    title: `Editar: ${path}`,
    "data-cms-path": path,
    // ═══ NUEVO: edición inline ═══
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const newText = e.currentTarget.innerText;
      window.parent.postMessage({
        type: "cms-inline-edit",
        path,
        value: newText,
      }, parentOrigin || "*");
    },
  };
}, [isPreview, cmsNotify, parentOrigin]);
```

**⚠️ IMPORTANTE:** Para elementos que NO deben ser editables inline (imágenes, botones, divs contenedores), mantener `cmsData()` sin contentEditable. Solo `cmsProps()` tiene contentEditable.

### En CMSEditor.tsx — escuchar inline-edit:

```typescript
// BUSCAR el useEffect que tiene: e.data?.type === "cms-click-to-edit"
// AÑADIR DESPUÉS de ese if, dentro del mismo handler:

if (e.data?.type === "cms-inline-edit" && e.data.path && e.data.value !== undefined) {
  // Actualizar el campo en el estado local
  const path = e.data.path as string;
  const value = e.data.value as string;
  
  // Usar la misma lógica que el editor de campos usa
  setLocalContent(prev => {
    const updated = { ...prev };
    const keys = path.split(".");
    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return updated;
  });
  
  // Marcar como dirty para que se pueda guardar
  setDirty(true);
}
```

## CAMBIO 2: Actualización del preview sin recargar iframe

### En CMSEditor.tsx — cuando un campo cambia, notificar al iframe:

```typescript
// BUSCAR la función que actualiza campos (donde se hace setLocalContent o similar)
// AÑADIR al final de esa función:

// Notificar al iframe para actualización instantánea
if (iframeRef.current?.contentWindow) {
  iframeRef.current.contentWindow.postMessage({
    type: "cms-update-field",
    path: fieldPath,  // ej: "hero.headline"
    value: newValue,   // ej: "Nuevo titular"
  }, window.location.origin);
}
```

### En Landing.tsx — escuchar updates del editor:

```typescript
// AÑADIR en el useEffect que escucha messages:

if (e.data?.type === "cms-update-field" && e.data.path) {
  const path = e.data.path as string;
  const value = e.data.value;
  
  // Actualización directa en DOM (instantáneo, sin re-render)
  const el = document.querySelector(`[data-cms-path="${path}"]`) as HTMLElement;
  if (el) {
    if (typeof value === "string") {
      el.textContent = value;
    }
  }
  
  // También actualizar el estado React para persistir entre re-renders
  setContent(prev => {
    if (!prev) return prev;
    const updated = JSON.parse(JSON.stringify(prev));
    const keys = path.split(".");
    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return prev;
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return updated;
  });
}
```

## CAMBIO 3: CMS en vivo para páginas Admin (sin iframe)

Las páginas admin ya usan `useCms()` y `useCmsSection()`. Para que los cambios se apliquen EN VIVO sin recargar:

### En CmsContext.tsx — añadir listener de Server-Sent Events:

```typescript
// BUSCAR el useEffect que llama a load()
// AÑADIR después del load():

// SSE para actualización en vivo del CMS en toda la app
const es = new EventSource(`${API_BASE}/api/cms/events`);
es.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === "content-updated" && data.content) {
      setContent(data.content);
    }
  } catch {}
};
return () => { es.close(); };
```

**VERIFICAR:** El endpoint `/api/cms/events` ya existe (línea 20991 del backend — es un SSE endpoint). Esto permitirá que cuando alguien edite en el CMS Editor, TODAS las páginas abiertas de la app se actualicen en vivo.

## CAMBIO 4: Indicador visual de elementos editables en Admin

En AppLayout.tsx, añadir un modo "CMS preview" para admin pages:

```typescript
// AÑADIR estado para modo edición
const [cmsEditMode, setCmsEditMode] = useState(false);

// En el header, junto a los otros botones, añadir toggle:
{user?.role === "admin" && (
  <button
    onClick={() => setCmsEditMode(m => !m)}
    title="Modo edición CMS"
    style={{
      padding: "6px 10px", borderRadius: 8,
      border: cmsEditMode ? "1px solid var(--gold)" : "1px solid var(--ink3)",
      background: cmsEditMode ? "rgba(200,168,75,0.1)" : "transparent",
      color: cmsEditMode ? "var(--gold)" : "var(--t4)",
      fontSize: 11, fontWeight: 600, cursor: "pointer",
    }}
  >
    {cmsEditMode ? "✏️ Editando" : "✏️ Editar UI"}
  </button>
)}
```

Cuando `cmsEditMode` está activo, los elementos que usan `t()` del CMS deberían mostrar un borde sutil al hacer hover (como en la landing). Esto se puede hacer con una clase CSS global:

```css
/* Añadir en index.css */
.cms-admin-edit [data-cms-key] {
  cursor: pointer;
  transition: outline 0.15s;
}
.cms-admin-edit [data-cms-key]:hover {
  outline: 2px dashed rgba(200,168,75,0.5);
  outline-offset: 2px;
}
```

Y en los componentes que usan `t()`, añadir el atributo `data-cms-key`:

```tsx
// Ejemplo en AppLayout donde se usa t():
<span data-cms-key="adminPanel.sidebarLabels.yourStores">
  {ap.sidebarLabels?.yourStores ?? "Tus tiendas"}
</span>
```

---

# RESUMEN — QUÉ ARCHIVOS TOCA

| Archivo | Cambio | Líneas afectadas |
|---------|--------|-----------------|
| `Landing.tsx` | Añadir contentEditable a cmsProps + listener cms-update-field | ~5 líneas nuevas en cmsProps + ~15 líneas en useEffect |
| `CMSEditor.tsx` | Añadir handler cms-inline-edit + enviar cms-update-field al cambiar campo | ~15 líneas en useEffect + ~3 líneas en handleFieldChange |
| `CmsContext.tsx` | Añadir SSE listener para actualización en vivo | ~8 líneas en useEffect |
| `AppLayout.tsx` | Añadir toggle "Editar UI" + clase cms-admin-edit | ~15 líneas |
| `index.css` | Añadir estilos .cms-admin-edit hover | ~6 líneas |

**Total: ~60 líneas de código nuevo, 0 líneas eliminadas, 0 funcionalidad rota.**

---

# VERIFICACIÓN

- [ ] Abrir CMS Editor → hacer click en un título del preview → puedo escribir directamente encima
- [ ] Al terminar de escribir (blur) → el campo en el sidebar se actualiza
- [ ] Cambiar un color en el sidebar → el preview se actualiza SIN recargar el iframe
- [ ] Cambiar un texto en el sidebar → el preview se actualiza SIN parpadeo
- [ ] Abrir una página admin → activar "Editar UI" → los textos editables muestran borde al hover
- [ ] Cambiar un texto del admin (ej: label del sidebar) en CMS Editor → la página admin se actualiza en vivo
- [ ] Las 3 plantillas de landing (classic, elegance, prestige) siguen funcionando
- [ ] El auto-save del CMS sigue funcionando
- [ ] El historial de versiones sigue funcionando
- [ ] La IA de mejora de textos sigue funcionando
