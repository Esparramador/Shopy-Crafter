# 🎙️ FIXES AUDIO/VOZ + GUÍA INTEGRACIÓN REPLIT
## VoiceButton.tsx — 7 bugs encontrados + fixes exactos
## + Guía para que Replit integre TODO sin romper nada

---

# BUGS EN VOICE/AUDIO — 7 encontrados

## BUG 1: `recognition.onerror` no dice qué error ocurrió
**Línea 65777:**
```typescript
// ANTES:
recognition.onerror = () => {
  setListening(false);
  setTranscript("Error de reconocimiento");
};

// DESPUÉS:
recognition.onerror = (e: any) => {
  setListening(false);
  const errorMessages: Record<string, string> = {
    "not-allowed": "🔇 Micrófono no permitido. Actívalo en los ajustes del navegador.",
    "no-speech": "🔇 No se detectó voz. Inténtalo de nuevo.",
    "audio-capture": "🔇 No se encontró micrófono. Conecta uno.",
    "network": "🌐 Error de red. Comprueba tu conexión.",
    "aborted": "Reconocimiento cancelado.",
    "service-not-allowed": "🔇 Servicio de voz no disponible en este navegador.",
  };
  setTranscript(errorMessages[e.error] || `Error: ${e.error || "desconocido"}`);
};
```

## BUG 2: EXECUTABLE_ACTIONS incompleto — faltan 12 acciones
**Línea 65852:**
```typescript
// ANTES (solo 11 acciones):
const EXECUTABLE_ACTIONS = ["store_status", "list_products", "create_product", "edit_product", "change_price", "regenerate_token", "get_scopes", "delete_product", "search_product", "publish_product", "get_orders"];

// DESPUÉS (todas las 23 acciones del backend):
const EXECUTABLE_ACTIONS = [
  "store_status", "list_products", "list_all_products", "create_product",
  "edit_product", "change_price", "set_product_status", "regenerate_token",
  "get_scopes", "delete_product", "search_product", "publish_product",
  "get_orders", "scan_store", "search_suppliers", "modify_audit_filter",
  "diagnose_app", "inspect_code", "fix_code", "list_source_files",
  "analyze_component",
];
```

## BUG 3: Atajo de teclado Alt+V declarado pero no implementado
**El botón dice `title="Comando de voz (Alt+V)"` pero no hay listener.**

Añadir DENTRO del useEffect (después de `recognitionRef.current = recognition`):
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.altKey && e.key === "v") {
    e.preventDefault();
    if (recognitionRef.current) {
      if (listening) {
        recognitionRef.current.stop();
        setListening(false);
      } else {
        setListening(true);
        setShowBubble(true);
        setTranscript("Escuchando...");
        setResponse("");
        setActionResult("");
        recognitionRef.current.start();
      }
    }
  }
};
document.addEventListener("keydown", handleKeyDown);
return () => document.removeEventListener("keydown", handleKeyDown);
```
**NOTA:** El `listening` dentro del keydown handler necesita un ref para tener el valor actual. Añadir `const listeningRef = useRef(listening)` y actualizar con `useEffect(() => { listeningRef.current = listening; }, [listening])`.

## BUG 4: Animación `pulse` referenciada pero no definida
**Línea 65897:** `animation: listening ? "pulse 1s infinite" : "none"`

La animación `pulseGold` SÍ existe (línea 58650) pero el botón referencia `pulse` que NO existe.

**Fix:** Cambiar a `pulseGold` o añadir la definición. Lo más fácil:
```typescript
// Cambiar:
animation: listening ? "pulse 1s infinite" : "none",
// Por:
animation: listening ? "pulseGold 1.5s ease-in-out infinite" : "none",
```

## BUG 5: Bubble auto-hide en 8s mientras acción aún ejecuta
**Línea 65873:**
```typescript
// ANTES:
setTimeout(() => setShowBubble(false), 8000);

// DESPUÉS — no auto-hide si hay acción en curso:
setTimeout(() => {
  setShowBubble(prev => {
    // Solo ocultar si no hay acción ejecutándose
    if (actionResult === "Ejecutando...") return true;
    return false;
  });
}, 12000); // 12s en vez de 8s
```

## BUG 6: SpeechSynthesis no selecciona voz española
**Línea 65846:**
```typescript
// ANTES:
const utterance = new SpeechSynthesisUtterance(data.response);
utterance.lang = "es-ES";
utterance.rate = 1.0;
window.speechSynthesis.speak(utterance);

// DESPUÉS — selecciona la mejor voz española disponible:
const utterance = new SpeechSynthesisUtterance(data.response);
utterance.lang = "es-ES";
utterance.rate = 1.0;
// Intentar encontrar una voz española nativa
const voices = window.speechSynthesis.getVoices();
const spanishVoice = voices.find(v => v.lang === "es-ES" && v.localService) 
  || voices.find(v => v.lang.startsWith("es")) 
  || null;
if (spanishVoice) utterance.voice = spanishVoice;
window.speechSynthesis.speak(utterance);
```

**NOTA:** `getVoices()` puede devolver array vacío la primera vez. Añadir en el useEffect:
```typescript
// Pre-cargar voces (Chrome las carga async)
if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices(); // trigger load
  window.speechSynthesis.onvoiceschanged = () => {}; // force load
}
```

## BUG 7: Si el navegador NO soporta Speech, el botón desaparece sin aviso
**Línea 65876:**
```typescript
// ANTES:
if (!supported) return null;

// DESPUÉS — mostrar botón deshabilitado con tooltip:
if (!supported) {
  return (
    <button
      title="Comando de voz no disponible en este navegador. Usa Chrome o Edge."
      disabled
      style={{
        position: "fixed", bottom: 88, right: 24, zIndex: 900,
        width: 52, height: 52, borderRadius: "50%",
        background: "var(--ink3)", border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, opacity: 0.3, cursor: "not-allowed",
      }}
    >🎙</button>
  );
}
```

---

# GUÍA PARA REPLIT — CÓMO INTEGRAR TODO SIN ROMPER NADA

## Principio fundamental:
Replit debe tratar cada documento que te he dado como un **conjunto de instrucciones aditivas** — NO reescribir archivos existentes, solo AÑADIR código nuevo y MODIFICAR líneas específicas.

## Orden de implementación:

### Paso 1: Fixes de estabilidad (app.ts + claude.ts)
**Archivo `app.ts` — 3 bloques a AÑADIR:**
1. Middleware de sanitización → ANTES del router
2. Middleware anti-502 → ANTES del router
3. Error handler global → DESPUÉS del router
**Documento:** `FIXES_COMPLETOS_SHOPYCRAFTER.md`

### Paso 2: Token limits (claude.ts)
**3 números a cambiar — nada más.**
**Documento:** `FIXES_COMPLETOS_SHOPYCRAFTER.md` FIX 3

### Paso 3: Voice fixes (VoiceButton.tsx)
**7 cambios puntuales en el archivo existente.**
**Documento:** Este archivo, sección de arriba

### Paso 4: Fusion Studio (nuevo)
**Crear archivos nuevos + 3 líneas en archivos existentes.**
**Documento:** `IMPLEMENTACION_FUSION_STUDIO_SHOPYCRAFTER.md`

### Paso 5: Template Studio (nuevo)
**Crear archivos nuevos + 3 líneas en archivos existentes.**
**Documento:** `TEMPLATE_STUDIO_CODIGO_COMPLETO.md`

### Paso 6: Verificar compilación
```bash
npm run build
# Si hay errores de tipos, son SOLO en los archivos nuevos — no afectan lo existente
```

## Lo que Replit NO debe hacer:
- ❌ NO reescribir archivos completos — solo modificar las líneas indicadas
- ❌ NO cambiar imports existentes — solo añadir nuevos
- ❌ NO mover rutas de sitio — solo añadir nuevas
- ❌ NO tocar el CMS, la landing, ni las páginas de proyecto existentes
- ❌ NO cambiar la estructura de la base de datos existente — solo añadir tablas nuevas

## Lo que Replit SÍ debe hacer:
- ✅ Copiar los bloques de código exactos de los documentos
- ✅ Respetar el orden: sanitización → anti-502 → router → error handler
- ✅ Ejecutar migración DB después de crear el schema de report_templates
- ✅ Verificar que compila antes de deployar
- ✅ Probar que `/api/health` sigue respondiendo OK

---

# RESUMEN DE TODOS LOS DOCUMENTOS GENERADOS

| # | Documento | Qué contiene |
|---|-----------|-------------|
| 1 | `AUDITORIA_TOTAL_SHOPYCRAFTER.md` | Audit completa: 348 rutas, tokens, rate limits |
| 2 | `FIXES_COMPLETOS_SHOPYCRAFTER.md` | 5 fixes: error handler + anti-502 + tokens + sanitización + Fusion |
| 3 | `AUDITORIA_DEFINITIVA_CONEXIONES_SHOPYCRAFTER.md` | 162/162 conexiones frontend→backend verificadas |
| 4 | `IMPLEMENTACION_FUSION_STUDIO_SHOPYCRAFTER.md` | Backend + frontend + conexiones Fusion Studio |
| 5 | `FusionStudioComplete.jsx` | Componente React completo de Fusion Studio |
| 6 | `TEMPLATE_STUDIO_CODIGO_COMPLETO.md` | DB + backend + frontend Template Studio |
| 7 | `AUDITORIA_TOKENS_RATELIMITS_TRUNCACION.md` | Tokens Claude/Gemini + rate limits |
| 8 | Este documento | Voice fixes + guía integración Replit |

**Total cambios: 2 archivos modificados (app.ts, claude.ts) + 1 componente modificado (VoiceButton.tsx) + 4 archivos nuevos (schema, 2 routes, 2 pages) + 3 líneas en archivos existentes (index.ts, App.tsx, AppLayout.tsx)**
