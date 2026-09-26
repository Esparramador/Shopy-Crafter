# Informes IA — robustez de las respuestas (inventario)

Rama `fix/informes-ia-robustos` (ya en `master`). Estado a 26/09/2026.

## Causa raíz (confirmada en el código)

1. `POST /projects/:projectId/exports/generate-ai-report` pedía 9 secciones de 3-5 párrafos de HTML **dentro de un único JSON** con `max_tokens` 8192. El HTML escapado dentro de cadenas JSON no cabe: la respuesta se cortaba.
2. `lib/claude.ts` solo hacía `logger.warn` cuando `stop_reason === "max_tokens"`: nadie aguas arriba se enteraba del corte.
3. El JSON se extraía con `.match(/\{[\s\S]*\}/)` y, si `JSON.parse` fallaba, se guardaba `{ executiveSummary: aiResponse, raw: "true" }`: el JSON roto acababa como "Resumen ejecutivo" en el informe, en `projects.ai_report_json` y en la bóveda.
4. `askClaudeJson` "reparaba" en silencio los JSON truncados cerrando llaves (`repairJson`), de modo que un informe a medias pasaba por bueno.
5. `lib/report-levels.ts` (HTML libre, 8192–16000 tokens) tenía el mismo corte silencioso: se guardaba medio documento en la bóveda.
6. Los prompts daban por hecho una tienda Shopify con catálogo y pedían "cifras concretas" e "impacto estimado en €" siempre. Con 0 productos (restaurante, servicios) la IA rellenaba con números genéricos o inventados.

## Qué se ha cambiado

- `lib/ai-errors.ts`: errores tipados `AiTruncatedError` y `AiJsonError` (`truncated | no_json | invalid_json | schema`) y un mensaje en español para el cliente.
- `lib/ai-json.ts`: helper central.
  - `extractJson`: bloque ```json o primer objeto/array **balanceado** respetando cadenas y escapes; ignora llaves de prosa (`{nombre}`); si el JSON empieza y no se cierra, devuelve `truncated` (no un sub-objeto, no lo cierra a mano). Solo repara lo que no inventa contenido: saltos de línea literales dentro de cadenas y comas finales.
  - `parseAiJson`: extracción + validación con esquema zod (`safeParse`).
  - `generateAiJson`: un reintento (más presupuesto si se cortó, reparación con el error si no) y después error tipado.
  - `generateCompleteText`: HTML libre con continuación ("continúa donde lo dejaste", sin prefill de assistant, que los modelos 4.6+ no admiten); si sigue cortado, `AiTruncatedError`.
  - `askClaudeJsonValidated` / `askClaudeTextComplete`: atajos sobre Claude con ShopyBrain + ADN de marca.
- `lib/claude.ts` (compatible hacia atrás):
  - `askClaudeDetailed` y `askClaudeWithBrainDetailed` devuelven `{ text, stopReason, truncated, usage }`.
  - `ClaudeCallOpts.failOnTruncation` (por defecto `false`): si es `true`, `askClaude`, `askClaudeWithUsage`, `askClaudeWithVision`, `askClaudeVisionWithBrain` y `claude()` lanzan `AiTruncatedError`. Sin la opción, todo sigue devolviendo texto como antes.
  - `askClaudeWithBrain` acepta `opts` como último parámetro opcional.
- `lib/strategic-report.ts` + `generate-ai-report`: 2-3 llamadas pequeñas en paralelo (bloques de secciones), JSON corto por sección validado con zod, HTML montado y escapado en el servidor. Reglas de veracidad en el sistema ("si no hay datos, dilo; no inventes cifras"). Las secciones que dependen de datos inexistentes (catálogo, precios, COGS/ventas, histórico de pedidos) no se piden a la IA: se escribe "qué datos faltan". El prompt cambia según haya catálogo o no. Mismo contrato HTTP (`ok, projectId, sections, generatedAt, savedToVault, savedFileId, preview`) y mismo guardado en bóveda; si la IA falla tras el reintento responde 502 con mensaje claro y **no guarda nada**. Conserva `seoWriteSupported`/`seoWriteSnippet` que el conector WooCommerce guarda en `ai_report_json`.

## Modelo

`CLAUDE_MODEL` sigue siendo `claude-sonnet-4-6` por defecto y ya es configurable (env `CLAUDE_MODEL`, o `ai.claude.smart` en `platform_settings` vía `lib/ai-models.ts`). No se ha cambiado. Propuesta: probar `claude-sonnet-5` en el tier `smart` desde el panel (sin desplegar código) con un par de proyectos reales y comparar informes. Ojo: `askClaudeVisionWithBrain` y `claude()` usan `CLAUDE_MODEL` directamente y no pasan por los tiers.

## Inventario de sitios

Recuento inicial: `grep -rnF '.match(/\{[\s\S]*\}/)' artifacts/api-server/src` → **47** sitios. Migrados en esta rama: 5 de esos 47, más 12 llamadas de informes que usaban `askClaudeJsonWithBrain`/`askClaudeWithBrain` con reparación o corte silencioso. Después se migraron los dos pendientes de prioridad alta (absorber de imágenes y Brand Book). Quedan **40** sitios con la regex (más la mención en el comentario de `lib/ai-json.ts`).

"Fallback" indica qué pasa hoy si el JSON no parsea: **crudo** = el texto de la IA acaba en un campo visible (el bug del informe); **vacío** = se usa `{}`/`[]`/`null`; **defecto** = valores por defecto inventados; **error** = responde error.

### Migrados

| Fichero:línea (actual) | Qué genera | Cómo queda |
|---|---|---|
| routes/exports.ts `generate-ai-report` | Informe Estratégico IA (9 secciones) | Reescrito por bloques con `askClaudeJsonValidated` + `lib/strategic-report.ts` |
| routes/exports.ts `generateAiRecommendations` | Sección "Análisis y Recomendaciones IA" de los informes por área (HTML, 16000 tokens) | `askClaudeTextComplete` (continuación); si falla, aviso visible en el informe |
| routes/exports.ts `estimateCogsWithAI` | Estimación de costes (COGS) para negocios sin COGS | `askClaudeJsonValidated` con esquema (antes: JSON truncado "reparado" que podía romper el render) |
| lib/report-levels.ts (5 llamadas) | Informes por niveles 1-5 (principal, guía, contenido, activos, roadmap) | `askClaudeTextComplete`; el principal lanza error tipado, los secundarios se omiten y se listan en `failed` |
| routes/web-lab.ts análisis (2 llamadas) | Análisis de diseño Lab Web (JSON con CSS y fragmentos, 16000 tokens) | `askClaudeJsonValidated` con esquema; se eliminan las puntuaciones "50" inventadas cuando faltaban |
| routes/web-lab.ts `parseSafe` (antes :479) | Investigación de marca con Gemini (7 búsquedas) | `parseAiJson` (sin reintento; `null` si no hay JSON) |
| routes/competitors.ts `comparative-report` (antes :539) | Informe comparativo de competidores | Gemini → `parseAiJson` con esquema; Claude → `askClaudeJsonValidated`. El prompt de Claude ya no pide "estimar datos realistas" y el pie no dice "Google Search" cuando no lo hubo |
| routes/inventory.ts `restock-email` (antes :109) | Email de reposición al proveedor | `askClaudeJsonValidated`; antes el texto crudo se guardaba como cuerpo del email (**crudo**) |
| routes/ab-testing.ts `/ab-tests/:testId/report` | Narrativa del informe A/B | `askClaudeJsonValidated`; si falla, se mantiene la narrativa calculada con los datos reales |
| routes/intelligence.ts `/intelligence/analyze` (antes :565) | Atribución de revenue (dual AI) | `parseAiJson`; 502 en vez de meter el texto como `summary` (**crudo**) |
| routes/absorber.ts `analyzeImageWithClaude` (antes :342) | Absorber de imágenes (Claude Vision, 16000 tokens) | `generateAiJson` con detección de `max_tokens` y reintento a 32000; antes devolvía `{ raw: text }` (**crudo**) y se guardaba en ShopyBrain una memoria visual vacía. `/shopybrain/absorb-visual` responde 502 con mensaje claro; el análisis de la imagen de una URL sigue siendo no crítico |
| routes/shopybrain.ts execute-action `generate_brand_book` (antes :11742) | Brand Book renderizado a HTML y guardado en el Vault | `generateAiJson` + esquema zod (nombre, misión, historia, valores y paleta con hex válido obligatorios); 8000 tokens con reintento a 16000 (antes 4000, se cortaba). Antes, si no parseaba, se guardaba un brand book vacío con solo el nombre (**defecto**) |

### Pendientes (regex codiciosa)

Prioridad alta = fallback **crudo** o datos que llegan a un informe/cliente.

| Fichero:línea | Qué genera | Fallback hoy | Prioridad |
|---|---|---|---|
| routes/absorber.ts:885 | Crear producto desde imagen: análisis visual | vacío | media |
| routes/absorber.ts:933 | Crear producto desde imagen: investigación de precios | vacío (usa estimación visual) | media |
| routes/absorber.ts:982 | Crear producto desde imagen: copy del producto | vacío | media |
| routes/absorber.ts:1244 | Investigación de proveedores: proveedores | vacío | baja |
| routes/absorber.ts:1249 | Investigación de proveedores: costes | vacío | baja |
| routes/absorber.ts:1254 | Investigación de proveedores: ofertas | vacío | baja |
| routes/absorber.ts:1313 | Investigación de proveedores: síntesis | vacío | media |
| routes/admin.ts:410 | `/projects/:projectId/ai-suggest` sugerencias | vacío | baja |
| routes/cms.ts:461 | `/ai/generate-section` configuración de sección CMS | error | baja |
| routes/competitors.ts:163 | `/competitors/scan` snapshot de competidor | vacío (snapshot con campos nulos) | media |
| routes/competitors.ts:316 | `/competitors/auto-discover` | vacío | baja |
| routes/competitors.ts:819 | `/competitors/auto-analyze` descubrimiento | vacío | baja |
| routes/competitors.ts:897 | `/competitors/auto-analyze` análisis por competidor | vacío | media |
| routes/fs-pro.ts:1221 | Campaign production: adaptar a marca | error (usa `safeJsonParse`, repara truncados) | media |
| routes/fs-pro.ts:1476 | Exploded view: secuencia | error (repara truncados) | media |
| routes/fs-pro.ts:4262 | Explode-view: prompts de 3 clips | defecto (clips vacíos) | baja |
| routes/openart.ts:168 | Análisis de prompt OpenArt | error | baja |
| routes/pricing.ts:378 | Precio óptimo: investigación de competencia (Gemini) | vacío | media |
| routes/pricing.ts:384 | Precio óptimo: investigación de proveedores (Gemini) | vacío | media |
| routes/pricing.ts:738 | Estimación COGS por producto: materiales/envío (Gemini) | vacío | media |
| routes/report-templates.ts:212 | Sugerencia de plantilla de informe | vacío (`suggestion` nulo) | baja |
| routes/shopybrain.ts:209 | `researchRealPricing` | defecto | media |
| routes/shopybrain.ts:2131 | `/shopybrain/study` | vacío | baja |
| routes/shopybrain.ts:7967 | execute-action: generación de UI | reintento propio limpiando fences | baja |
| routes/suppliers.ts:59 | `safeJsonParse` local de proveedores | vacío (`null`) | baja |
| lib/brain-ingester.ts:150 | Extracción de insights para el Brain | vacío | baja (interno) |
| lib/client-advisor.ts:156 | Hechos aprendidos del chat del cliente | se ignora | baja (interno) |
| lib/fusion-studio.ts:42 | Detección de caras de prenda | se ignora | baja |
| lib/fusion-studio.ts:343 | Análisis de imagen para Fusion Studio | error | baja |
| lib/fusion-studio.ts:420 | Investigación de marca para Fusion | vacío (`null`) | baja |
| lib/fusion-studio.ts:492 | Ajustes de foto sugeridos | defecto | baja |
| lib/google-reviews.ts:115 | Perfil de Google Business (Gemini) | vacío (`unavailable`) | media |
| lib/product-dna.ts:189 | ADN de producto | defecto (síntesis desde texto) | baja |
| lib/scheduler.ts:373 | OmniCore micro-learning | se ignora | baja (cron interno) |
| lib/scheduler.ts:505 | OmniCore conexiones cruzadas | se ignora | baja (cron interno) |
| lib/scheduler.ts:600 | OmniCore estudio diario | se ignora | baja (cron interno) |
| lib/scheduler.ts:711 | OmniCore mega-síntesis | se ignora | baja (cron interno) |
| lib/scheduler.ts:871 | Reanálisis retroactivo | se ignora | baja (cron interno) |
| lib/scheduler.ts:984 | Autoevaluación mensual (informe) | defecto (resumen con estadísticas) | media |
| lib/scheduler.ts:1229 | Estudio adaptativo | se ignora | baja (cron interno) |

### Pendientes sin regex pero con el mismo riesgo

- `askClaudeJson` / `askClaudeJsonWithBrain` (`lib/claude.ts`) siguen reparando JSON truncados en silencio con `repairJson`. Se ha dejado así para no cambiar el comportamiento de sus ~60 llamadas; migrar cada uno a `askClaudeJsonValidated` con su esquema. Los más visibles: `routes/web-lab.ts` (:1220 iterate, :1824 rediseño HTML/CSS, :2565), `routes/ab-testing.ts` (predicción, forecasts).
- Llamadas directas al SDK fuera de `claude.ts` (p. ej. `routes/web-lab.ts`:3015 con `max_tokens: 8192`) no pasan por `checkTruncation`.
- `estimateCogsWithAI` exige "fuentes reales verificables" (Idealista, convenios…) a un modelo sin búsqueda web: el esquema garantiza la forma, no la veracidad. Conviene pasarlo por Gemini con búsqueda o rebajar la promesa del texto.

## Cómo probar

```bash
pnpm --filter @workspace/api-server run test
```

Los tests usan un cliente de IA simulado: no llaman a Anthropic.
