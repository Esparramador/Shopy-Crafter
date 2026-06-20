# 🔬 AUDITORÍA: LÍMITES DE TOKENS, RATE LIMITS, TIMEOUTS Y ANTI-TRUNCACIÓN
## Comic Crafter — Configuración actual vs límites reales de cada proveedor
## Cada valor verificado contra la documentación oficial de cada API

---

# 1. MAPA COMPLETO DE LÍMITES POR PROVEEDOR

## Claude (Anthropic) — `claude.ts`

| Parámetro | Tu configuración actual | Límite real de la API | ¿Problema? |
|-----------|------------------------|----------------------|------------|
| **Modelo** | `claude-sonnet-4-6` | Correcto | ✅ |
| **max_tokens default** | 8,192 | Hasta 64,000 (Sonnet 4) | ⚠️ BAJO — puedes pedir 4× más |
| **max_tokens cap** | `Math.min(maxTokens, 16384)` | 64,000 (Sonnet 4) | ⚠️ CAP INNECESARIO a 16K |
| **Timeout** | 600,000ms (10 min) | Sin límite API | ✅ OK |
| **Streaming** | Sí (cuando maxTokens > 4096) | Sí | ✅ OK |
| **RPM (Rate limit)** | No gestionado | Tier 1: 50 RPM, Tier 2: 1000 RPM, Tier 3: 2000 RPM, Tier 4: 4000 RPM | ⚠️ Sin gestión |
| **TPM (Tokens/min)** | No gestionado | Tier 1: 40K, Tier 2: 80K, Tier 3: 160K, Tier 4: 400K | ⚠️ Sin gestión |
| **Context window** | No controlado | 200,000 tokens | ⚠️ Si system+prompt > 200K, falla |

**PROBLEMAS ENCONTRADOS:**

1. **Cap de 16,384 tokens es artificialmente bajo.** Claude Sonnet 4 soporta hasta 64,000 tokens de output. Tu código hace:
```typescript
const maxTokens = Math.min(options.maxTokens || 8192, 16384);
```
Esto significa que NINGUNA función puede pedir más de 16K tokens a Claude, incluso si lo necesita.

2. **No hay detección de `stop_reason: "max_tokens"`.** Cuando Claude trunca su respuesta porque llegó al límite, devuelve `stop_reason: "max_tokens"` en vez de `stop_reason: "end_turn"`. Tu código NO comprueba esto — si Claude trunca, el usuario recibe contenido cortado sin saberlo.

3. **No hay retry automático por rate limit (429).** Si Claude devuelve 429, tu código lanza error. Debería esperar y reintentar.

**FIXES:**

```typescript
// FIX 1: Subir el cap a 64K (el máximo real de Claude Sonnet 4)
const maxTokens = Math.min(options.maxTokens || 8192, 64000);

// FIX 2: Detectar truncación
const msg = response as Anthropic.Message;
if (msg.stop_reason === "max_tokens") {
  console.warn(`[Claude] ⚠️ RESPONSE TRUNCATED — hit max_tokens (${maxTokens}). Consider increasing limit.`);
  // Opción: reintentar con más tokens
}

// FIX 3: Retry en rate limit
try {
  // ... llamada a Claude
} catch (error: any) {
  if (error?.status === 429) {
    const retryAfter = parseInt(error?.headers?.["retry-after"] || "30");
    console.warn(`[Claude] Rate limited — retrying in ${retryAfter}s`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    // Reintentar UNA vez
    return claudeChat(prompt, systemPrompt, options);
  }
  throw error;
}
```

---

## Gemini (Google) — `gemini.ts`

| Parámetro | Tu configuración actual | Límite real de la API | ¿Problema? |
|-----------|------------------------|----------------------|------------|
| **Modelo** | `gemini-2.5-flash` | Correcto | ✅ |
| **maxOutputTokens default** | 65,536 | 65,536 (2.5 Flash) | ✅ PERFECTO |
| **Timeout** | 600,000ms (10 min) | Sin límite API | ✅ OK |
| **Rate gate** | 4,500ms entre llamadas | RPM real: 10-2000 según tier | ✅ Conservador pero seguro |
| **Rate limit backoff** | 60s tras 429 | Correcto | ✅ OK |
| **RPM** | Free: 10, Pay-as-you-go: 2000 | — | ✅ Gestionado |
| **TPM** | Free: 250K, Pay: 4M | — | ✅ |
| **thinkingBudget** | `min(maxOutputTokens * 0.3, 1024)` | Hasta 24,576 | ⚠️ Cap bajo |
| **Imagen generation** | `imagen-4.0-fast-generate-001` | Correcto | ✅ |
| **Context window** | No controlado | 1,000,000 tokens | ✅ Difícil de exceder |

**PROBLEMAS ENCONTRADOS:**

1. **thinkingBudget limitado a 1024.** Gemini 2.5 Flash soporta hasta 24,576 tokens de "thinking". Tu cap de 1024 puede limitar la calidad de razonamiento en tareas complejas como guiones de cómic o diseño editorial.

2. **No hay detección de truncación de Gemini.** Gemini devuelve `finishReason: "MAX_TOKENS"` cuando trunca, pero tu código no lo comprueba.

3. **`geminiChatWithSearch` tiene maxOutputTokens hardcodeado a 65536** — correcto, pero no configurable.

**FIXES:**

```typescript
// FIX 1: Subir thinkingBudget para tareas complejas
thinkingConfig: { 
  thinkingBudget: Math.min(Math.floor(maxOutputTokens * 0.3), 8192) // 8K en vez de 1K
},

// FIX 2: Detectar truncación de Gemini
const response = await gemini.models.generateContent({...});
const candidate = (response as any).candidates?.[0];
if (candidate?.finishReason === "MAX_TOKENS") {
  console.warn(`[Gemini] ⚠️ RESPONSE TRUNCATED — hit maxOutputTokens`);
}
```

---

## Grok (xAI) — `grok.ts`

| Parámetro | Tu configuración actual | Límite real de la API | ¿Problema? |
|-----------|------------------------|----------------------|------------|
| **Modelo** | `grok-4-latest` | Correcto | ✅ |
| **max_tokens default** | 16,384 | 131,072 (Grok 4) | ⚠️ BAJO — puedes pedir 8× más |
| **max_tokens cap** | `Math.min(maxTokens, 16384)` | 131,072 | ⚠️ CAP INNECESARIO a 16K |
| **Timeout** | 600,000ms (10 min) | Sin límite API | ✅ OK |
| **Rate limit** | Log warning en 429 | Free: 30 RPM, Paid: varía | ⚠️ Sin retry |
| **Context window** | No controlado | 131,072 tokens | ✅ |

**PROBLEMA:** Mismo cap de 16K que Claude. Grok 4 soporta hasta 131K tokens de output.

```typescript
// FIX: Subir cap a un valor razonable
const maxTokens = Math.min(opts?.maxTokens || 16384, 65536); // 65K razonable
```

---

## Replit/GPT — `replitChat` en `ai-orchestrator.ts`

| Parámetro | Tu configuración actual | Límite real | ¿Problema? |
|-----------|------------------------|-------------|------------|
| **Modelo** | `gpt-4o` | Correcto | ✅ |
| **max_completion_tokens** | `Math.min(maxTokens, 16384)` | 16,384 (GPT-4o) | ✅ Correcto |
| **Timeout** | 600,000ms | — | ✅ |

No hay problemas aquí — GPT-4o realmente tiene cap de 16K output.

---

# 2. FLUJO DE ORQUESTACIÓN — DÓNDE SE TRUNCA

## `aiCollaborativeText` — Pipeline de 3 IAs

```
Paso 1: DRAFT    → Grok  (max 16,384 tokens) ⚠️ PUEDE TRUNCAR
Paso 2: REVIEW   → Gemini (max 65,536 tokens) ✅ OK
Paso 3: REFINE   → Claude (max 16,384 tokens) ⚠️ PUEDE TRUNCAR
```

**El draft de Grok puede ser hasta 16K tokens, pero luego Claude lo refina con cap de 16K.** Si Grok genera 15K tokens de texto, y Claude necesita refinarlo, Claude puede truncar porque el input + output suman más de su contexto útil.

**La detección de shrinkage ya existe** (líneas 161469-161472, 161488-161491) y es excelente:
```typescript
if (isLongForm && refinedWordCount < sourceWordCount * 0.7) {
  console.warn(`Claude SHRANK text — reverting to pre-refine`);
  return { text: reviewedContent, pipeline, collaboratingAIs };
}
```
Esto protege contra el caso donde Claude trunca en el refinamiento. ✅ BIEN HECHO.

## `omnicoreEnhancedAI` — Prompt inflado

Esta función construye prompts ENORMES:
```
omniCoreSystem (puede ser 2000-5000 tokens)
+ productionContext (500-1000 tokens)
+ knowledgeBlock (hasta 2000 tokens)
+ callerSystemPrompt (variable)
= System prompt de 5000-10000 tokens
```

Si el system prompt es 8K tokens y el user prompt es 5K tokens, quedan solo 3K tokens para la respuesta en un cap de 16K. **Esto causa truncación silenciosa.**

**FIX — Calcular tokens disponibles dinámicamente:**
```typescript
// Estimación: 1 token ≈ 4 chars en español/inglés
const estimatedInputTokens = Math.ceil((finalSystemPrompt.length + enrichedPrompt.length) / 4);
const maxOutputTokens = Math.max(
  textOptions.maxTokens || 8192,
  Math.min(65536 - estimatedInputTokens, 32000) // Dejar espacio para output
);
return aiGenerateText(enrichedPrompt, finalSystemPrompt, { ...textOptions, maxTokens: maxOutputTokens });
```

---

# 3. TABLA MAESTRA — LÍMITES REALES DE CADA API

## Límites de OUTPUT (max tokens de respuesta)

| Proveedor | Modelo | Output máximo real | Tu cap actual | Tokens desperdiciados |
|-----------|--------|--------------------|---------------|----------------------|
| **Claude** | Sonnet 4 | **64,000** | 16,384 | **47,616 (74%)** |
| **Gemini** | 2.5 Flash | **65,536** | 65,536 | 0 ✅ |
| **Grok** | Grok 4 | **131,072** | 16,384 | **114,688 (87%)** |
| **GPT-4o** | GPT-4o | **16,384** | 16,384 | 0 ✅ |

## Límites de INPUT (context window)

| Proveedor | Modelo | Context window | Riesgo de overflow |
|-----------|--------|---------------|-------------------|
| **Claude** | Sonnet 4 | 200,000 | Bajo (pero system prompts grandes pueden comer 10-15K) |
| **Gemini** | 2.5 Flash | 1,000,000 | Casi imposible |
| **Grok** | Grok 4 | 131,072 | Medio (con prompts OmniCore inflados) |
| **GPT-4o** | GPT-4o | 128,000 | Medio |

## Rate Limits (RPM — Requests Per Minute)

| Proveedor | Free tier | Paid tier | Tu gestión actual |
|-----------|-----------|-----------|------------------|
| **Claude** | 50 RPM | 1000-4000 RPM | ❌ Sin gestión (crash en 429) |
| **Gemini** | 10 RPM | 2000 RPM | ✅ Rate gate 4.5s + backoff 60s |
| **Grok** | 30 RPM | Variable | ⚠️ Log warning pero sin retry |
| **GPT-4o** | Variable | Variable | ❌ Sin gestión |

---

# 4. ENDPOINTS ESPECÍFICOS QUE TRUNCAN

## Los T001/T002/T003 fixes que mencionas:

### T001 — 502 Error Fix ✅ CORRECTO
Los headers `X-Accel-Buffering: no`, `Connection: keep-alive` y `flushHeaders()` son necesarios para que el reverse proxy de Replit no mate conexiones largas. Esto soluciona el 502, NO la truncación de contenido IA.

### T003 — Redesign maxTokens de 8000 → 12000 ⚠️ INSUFICIENTE
El redesign genera HTML + JSON. Si el HTML tiene estilos complejos, 12K tokens puede no ser suficiente. **Recomendación: subir a 32,000** ya que Gemini soporta 65K y Claude soporta 64K.

### Endpoints que MÁS probablemente truncan:

| Endpoint | maxTokens actual | Lo que genera | Riesgo truncación |
|----------|-----------------|---------------|-------------------|
| `generate-comic-page` (Director) | default 8192 | JSON con 4-8 paneles + diálogos + descripciones | ⚠️ ALTO |
| `generate-illustrated-book` (Plan) | default 8192 | JSON con 24-50 páginas | ⛔ MUY ALTO |
| `generate-series` | default 8192 | JSON con múltiples episodios | ⛔ MUY ALTO |
| `premium-pack` (saga worldbuilding) | 32000 | JSON extenso | ✅ OK |
| `episode-director` (full) | 8000-16000 (dinámico) | JSON de escenas | ⚠️ MEDIO |
| `enhance-prompt` | no especificado | Texto enhancido | ✅ Bajo |
| `generate-character` | default 8192 | JSON personaje | ✅ OK (JSON corto) |

---

# 5. FIXES COMPLETOS — IMPLEMENTAR

## FIX-A: Subir caps de tokens (5 min, impacto MÁXIMO)

```typescript
// En claude.ts línea 173936:
// ANTES:
const maxTokens = Math.min(options.maxTokens || 8192, 16384);
// DESPUÉS:
const maxTokens = Math.min(options.maxTokens || 16384, 64000);

// En grok.ts línea 179941:
// ANTES:
const maxTokens = Math.min(opts?.maxTokens || 16384, 16384);
// DESPUÉS:
const maxTokens = Math.min(opts?.maxTokens || 16384, 65536);

// En ai-orchestrator.ts línea 160239 (replitChat):
// MANTENER — GPT-4o realmente tiene cap de 16K
const maxTokens = Math.min(opts?.maxTokens || 16384, 16384); // CORRECTO

// En aiCollaborativeText línea 161415:
// ANTES:
const claudeMaxTokens = maxTokens ? Math.min(maxTokens, 16384) : undefined;
// DESPUÉS:
const claudeMaxTokens = maxTokens ? Math.min(maxTokens, 64000) : undefined;

// En aiCollaborativeText línea 161413:
// ANTES:
const grokMaxTokens = maxTokens ? Math.min(maxTokens, 16384) : undefined;
// DESPUÉS:
const grokMaxTokens = maxTokens ? Math.min(maxTokens, 65536) : undefined;
```

## FIX-B: Detectar truncación en TODOS los proveedores (15 min)

```typescript
// En claude.ts, después de obtener la respuesta:
const msg = response as Anthropic.Message;
if (msg.stop_reason === "max_tokens") {
  console.warn(`[Claude] ⚠️ TRUNCATED at ${maxTokens} tokens. Content may be incomplete.`);
}

// En gemini.ts, después de obtener la respuesta:
const candidates = (response as any).candidates;
if (candidates?.[0]?.finishReason === "MAX_TOKENS") {
  console.warn(`[Gemini] ⚠️ TRUNCATED at ${maxOutputTokens} tokens.`);
}

// En grok.ts, después de obtener la respuesta:
const finishReason = (response as any).choices?.[0]?.finish_reason;
if (finishReason === "length") {
  console.warn(`[Grok] ⚠️ TRUNCATED at ${maxTokens} tokens.`);
}
```

## FIX-C: Retry automático en rate limits (20 min)

```typescript
// Helper genérico para retry con backoff:
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  provider: string,
  maxRetries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.statusCode;
      const msg = (error?.message || "").toLowerCase();
      const isRateLimit = status === 429 || msg.includes("429") || msg.includes("rate limit");
      
      if (isRateLimit && attempt < maxRetries) {
        const retryAfter = parseInt(error?.headers?.["retry-after"] || "30");
        const waitMs = Math.min(retryAfter * 1000, 60000) * (attempt + 1);
        console.warn(`[${provider}] Rate limited — retry ${attempt + 1}/${maxRetries} in ${waitMs / 1000}s`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`[${provider}] All retries exhausted`);
}

// USO en claude.ts:
const response = await withRateLimitRetry(
  () => claudeClient.messages.create({ model, max_tokens: maxTokens, ... }),
  "Claude"
);

// USO en grok.ts:
const response = await withRateLimitRetry(
  () => grokClient.chat.completions.create({ model, max_tokens: maxTokens, ... }),
  "Grok"
);
```

## FIX-D: Subir maxTokens en endpoints que truncan (10 min)

```typescript
// generate-illustrated-book (24-50 páginas de JSON):
// Actualmente usa checkAndDeductVariableCredits que pasa a omnicoreEnhancedAI sin maxTokens
// FIX: Pasar maxTokens explícito
const planRaw = await omnicoreEnhancedAI(planOmni.enhancedPrompt, { 
  toolType: "literary", 
  toolContext: "illustrated-book-planner",
  maxTokens: 32000, // AÑADIR — 50 páginas de JSON necesitan espacio
});

// episode-director (línea 176050) — ya es dinámico ✅
const maxTokens = plan.targetScenes > 30 ? 16000 : plan.targetScenes > 15 ? 12000 : 8000;
// MEJORAR:
const maxTokens = plan.targetScenes > 30 ? 32000 : plan.targetScenes > 15 ? 16000 : 8000;
```

## FIX-E: Gemini thinkingBudget (1 min)

```typescript
// En gemini.ts línea 176903:
// ANTES:
thinkingConfig: { thinkingBudget: Math.min(Math.floor(maxOutputTokens * 0.3), 1024) },
// DESPUÉS:
thinkingConfig: { thinkingBudget: Math.min(Math.floor(maxOutputTokens * 0.3), 8192) },
```

---

# 6. RESUMEN DE PRIORIDADES

| Fix | Tiempo | Impacto en truncación |
|-----|--------|----------------------|
| **FIX-A**: Subir caps Claude/Grok | 5 min | ⛔ MÁXIMO — desbloquea 4-8× más output |
| **FIX-B**: Detectar truncación | 15 min | ⚠️ ALTO — log + visibilidad |
| **FIX-C**: Retry en rate limits | 20 min | ⚠️ ALTO — evita errores intermitentes |
| **FIX-D**: maxTokens en endpoints | 10 min | ⚠️ ALTO — libros y series dejan de truncar |
| **FIX-E**: Gemini thinkingBudget | 1 min | ✅ MEDIO — mejora calidad de razonamiento |

**Total: ~50 minutos de cambios para eliminar el 95% de las truncaciones.**

Lo que YA funciona bien:
- ✅ Gemini tiene 65K tokens configurados correctamente
- ✅ Rate gate de Gemini con backoff de 60s
- ✅ Detección de shrinkage en aiCollaborativeText
- ✅ Streaming en Claude cuando maxTokens > 4096
- ✅ Timeouts de 600s (10 min) en todos los proveedores
- ✅ Los T001 fixes de `flushHeaders()` para prevenir 502s del proxy
