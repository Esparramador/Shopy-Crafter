# 🔬 AUDITORÍA EXHAUSTIVA — Shopy Crafter
**Fecha:** 29 abril 2026  
**Patches analizados:** 46 archivos en 30 ZIPs (BLOQUE A/B/C/D/E + Quick Wins + Tier-1)  
**Origen:** Auditoría Claude Opus 4.7 (BLOQUE_A_shopybrain_audit.md, BLOQUE_B_frontend_audit.md, BLOQUE_CDE_backend_audit.md)

---

## ✅ APLICADO YA EN ESTA SESIÓN

| # | Patch | Archivo | Resultado |
|---|---|---|---|
| 1 | TS error `urlBase64ToUint8Array` | `use-push-subscription.tsx` | Fixed (cast as BufferSource) |
| 2 | TS error userId integer→text | `report-templates.ts` schema | Fixed + db:push aplicado |
| 3 | Informes Vault con imagen visual | `vault.ts` (12 callers) | Embebida base64 inline |
| 4 | Schema Drizzle faltante | `express_rate_limits.ts` | Creado con default(0) + index |
| 5 | **BE-5** Timing attack en /login | `auth.ts:routes` | DUMMY_BCRYPT_HASH constante |

**TypeCheck final:** `pnpm tsc --noEmit` → **CERO errores** en api-server + lib/db + shopify-optimizer.

---

## 🔶 PARCIALMENTE APLICADO (existe en repo, ZIP propone mejoras)

Comparación línea-a-línea de los 16 archivos clave:

| Archivo | Estado actual | Estado ZIP | Diff | Prioridad |
|---|---|---|---|---|
| `shopybrain-helpers.ts` (lib) | 278L (ya tiene 6 helpers + 2 extra) | 342L | 106L | 🟡 BAJA — actual incluye más helpers (`validateFixCodePath`, `normalizeListDirectory`) |
| `crypto.ts` (lib) | 72L (fail-fast funciona) | 111L | 75L | 🟢 NULA — el actual ya hace fail-fast en prod, solo cambia mensaje cosmético |
| `auth.ts` (route) | 451L tras fix BE-5 | 516L | resto = rate-limit dual + password complexity | 🟡 MEDIA — las protecciones extra ya están (rate-limit dual sí, validatePassword no) |
| `billing.ts` (route) | 144L | 127L | 271L | 🟠 ALTA — añade bloqueo Enterprise plan free |
| `fs-pro.ts` (route) | 587L | 574L | 15L | 🟢 BAJA — mejora pequeña |
| `fusion-studio-pro.ts` (lib) | 650L | 644L | 8L | 🟢 BAJA |
| `FusionStudio.tsx` | 1240L | 1188L | 130L | 🔴 NO TOCAR — el actual tiene la unificación Studio/Pro reciente |
| `FusionStudioPro.tsx` | 818L | 810L | 12L | 🟡 MEDIA |
| `AppLayout.tsx` | 528L | 532L | 4L | 🟢 BAJA |
| `ErrorBoundary.tsx` | 127L | 176L | 89L | 🟠 ALTA — ZIP añade Sentry-like reporting |
| `api.ts` (frontend lib) | 153L (apiGet/Post/Put/Delete) | 133L (apiFetch/apiJson) | 258L | 🔴 NO TOCAR — son arquitecturas distintas, romper haría cascada |
| `use-draft-persistence.ts` | 161L | 195L | 74L | 🟠 ALTA — ZIP añade flag `sensitive` (no persistir secretos) |

---

## 🆕 ARCHIVOS NUEVOS QUE NO EXISTEN (proponer crear)

### Backend nuevos
| Archivo ZIP | Destino propuesto | Función | Riesgo |
|---|---|---|---|
| `sanitize.ts` (99L) | `artifacts/api-server/src/lib/sanitize.ts` | DOMPurify whitelist server-side | 🟢 BAJO |
| `oauth-state.ts` (146L) | `artifacts/api-server/src/lib/oauth-state.ts` | Estado OAuth firmado | 🟢 BAJO |
| `formatters.ts` (253L) | `artifacts/api-server/src/lib/formatters.ts` | Formateo común | 🟢 BAJO |
| `claude-telemetry.ts` (333L) | `artifacts/api-server/src/lib/claude-telemetry.ts` | Tracking tokens Claude | 🟡 MEDIO — necesita revisar imports |
| `gemini-key-rotation.ts` (270L) | `artifacts/api-server/src/lib/gemini-key-rotation.ts` | Rotación de claves | 🟡 MEDIO |
| `shopify-circuit-breaker.ts` (282L) | `artifacts/api-server/src/lib/shopify-circuit-breaker.ts` | Circuit breaker Shopify | 🟠 ALTO — afecta a TODA llamada Shopify |
| `routes/approvals.ts` (29L) | `artifacts/api-server/src/routes/approvals.ts` | Sistema de aprobaciones | 🟢 BAJO (es snippet, no route completa) |
| `routes/queries.ts` (154L) | `artifacts/api-server/src/routes/queries.ts` | Query SQL de admin | 🔴 ALTO RIESGO — exponer queries ad-hoc |
| `routes/connectors.ts` | `artifacts/api-server/src/routes/connectors.ts` | Connectors HTTP | 🟡 MEDIO |
| `routes/error-report.ts` (117L) | `artifacts/api-server/src/routes/error-report.ts` | Endpoint para errors frontend | 🟢 BAJO |
| `services/pdf-generator.ts` | `artifacts/api-server/src/services/pdf-generator.ts` | Generador PDF aislado | 🟡 MEDIO |
| `services/report-cover.ts` | `artifacts/api-server/src/services/report-cover.ts` | Portada de informe | 🟢 BAJO |

### Frontend nuevos
| Archivo ZIP | Destino propuesto | Función |
|---|---|---|
| `lib/custom-fetch.ts` | `artifacts/shopify-optimizer/src/lib/custom-fetch.ts` | Wrapper fetch con whitelist orígenes |
| `lib/formatters.ts` | `artifacts/shopify-optimizer/src/lib/formatters.ts` | Formateo cliente |
| `lib/types.ts` | `artifacts/shopify-optimizer/src/lib/types.ts` | Tipos compartidos |
| `useShopyChat.ts` | `artifacts/shopify-optimizer/src/hooks/useShopyChat.ts` | Hook chat |
| `responsive.css` | (CSS global del frontend) | Mejoras responsive |

### Schemas DB faltantes (todos OPCIONALES si no se usan)
| Schema | Existe tabla en prod? | Acción |
|---|---|---|
| `express_rate_limits.ts` | ✅ sí | ✅ Ya creado |
| `audit_log.ts` (zip 21L) | A verificar | 🟡 Comprobar duplicado |
| `chat_messages.ts` (zip 33L) | A verificar | 🟡 Comprobar duplicado |
| `rate_limits.ts` (zip 13L) | A verificar | 🟡 Comprobar duplicado |
| `users.ts` (zip 110L) | ✅ sí | ⚠️ NO REEMPLAZAR — el actual tiene tipos correctos |

---

## 🚨 BLOQUE A — shopybrain.ts (route principal, 9.661 LOC)

El ZIP `shopybrain-VERIFIED-patches.ts` contiene **25 patches puntuales** sobre el archivo real, NO un reemplazo. Hay que aplicarlos uno-a-uno con `edit`.

### Críticos (6) — pendientes de aplicar
| # | Patch | Línea aprox | Descripción |
|---|---|---|---|
| CRIT-1 | RCE en `fix_code` / `modify_ui` | L4205 | Whitelist de paths editables (`isFileEditAllowed`) |
| CRIT-2 | Hardcoded projectId=2 en varias acciones | varios | Usar `getSessionProjectId(req, params)` |
| CRIT-3 | Mismo problema en otras 4 acciones | varios | Mismo helper |
| CRIT-4 | Bomba de imágenes en `extract_image_url` | ~L7800 | `fetchImageWithSizeLimit` (límite 8MB) |
| CRIT-5 | Self-password reset sin verificación | L8200 | `preventSelfPasswordReset` |
| CRIT-6 | Acciones destructivas sin confirmación | varios | `requireConfirmation` |

### Altos (5) — pendientes
HIGH-1 a HIGH-5 — ver `HIGH_1_to_5_patches.md` en el ZIP `files_(13)_1777478970173.zip`.

### Medios (14) — opcionales
MED-1 a MED-14 — mejoras de logging, validación de tipos, etc.

---

## 🚨 ERROR 502 EN LAB WEB — análisis y propuesta

### Diagnóstico
El endpoint `POST /api/web-lab/analyze` (`web-lab.ts:198-479`) ejecuta **en serie**:
1. `extractFullWebContent(url)` — fetch + parse HTML/CSS (puede tardar 5-30s en sites grandes)
2. `runPageSpeedAudit(url, "mobile")` — Google PageSpeed API (~15-30s)
3. `runPageSpeedAudit(url, "desktop")` — segunda llamada PageSpeed
4. `scrapeWebsite(url)` — otro fetch
5. `brand research` (Instagram + competidores + sector) — múltiples calls a Claude
6. Llamada principal a Claude (`claude-3-5-sonnet`) con prompt grande

**Tiempo total típico:** 60-180 segundos.

El proxy de Replit cierra conexiones tras ~60s sin respuesta → cliente recibe **502 Bad Gateway**. La línea `enableLongRunning(res)` envía `Connection: keep-alive` pero **no envía bytes intermedios**, así que el proxy no detecta actividad.

### Soluciones (recomendado #2)
1. **Reducir timeouts internos:** PageSpeed mobile + desktop en paralelo (no serie). Ahorro ~15s.
2. **Streaming SSE / heartbeat:** enviar `: keepalive\n\n` cada 10s para mantener viva la conexión. Cambio mínimo en `enableLongRunning`.
3. **Async + polling:** crear job, devolver job_id 202, frontend hace polling. Cambio grande pero arquitectura correcta.

---

## 📋 PLAN DE EJECUCIÓN RECOMENDADO

Dada la cantidad (46 archivos) y el riesgo, propongo **5 oleadas** con verificación entre cada una:

### Ola 1 — Quick wins seguros (ya hecha ✅)
- TS errors, vault con imagen, BE-5 timing attack, schema rate_limits

### Ola 2 — Backend nuevos sin acoplamiento (1-2h)
- `sanitize.ts`, `oauth-state.ts`, `formatters.ts`, `error-report.ts`, `report-cover.ts`
- Verificar imports y tsc tras cada uno

### Ola 3 — Fix 502 Lab Web (30min)
- Heartbeat SSE en `enableLongRunning` + paralelizar PageSpeed

### Ola 4 — shopybrain CRIT (2h)
- Los 6 patches CRIT-1 a CRIT-6 con `edit` puntual + verificar tras cada uno

### Ola 5 — Frontend mejoras opcionales (1-2h)
- `ErrorBoundary` con telemetry, `use-draft-persistence` con flag sensitive, `custom-fetch` con whitelist

### NO APLICAR
- ❌ Reemplazo wholesale de `FusionStudio.tsx` y `api.ts` frontend (arquitecturas evolucionadas)
- ❌ Nuevo `routes/queries.ts` (riesgo SQL ad-hoc)
- ❌ Migraciones SQL manuales (este repo usa Drizzle)
- ❌ Reemplazo de schemas TS con PK distintos (rompe DB)

---

## 📝 PRÓXIMOS PASOS

Confirma con cuál ola continúo:
- **A)** Ola 2 + Ola 3 (libs nuevas + fix 502) — recomendado, ~2h, bajo riesgo
- **B)** Solo Ola 3 (fix 502 únicamente, urgente)
- **C)** Ola 4 (shopybrain críticos) — más impacto, requiere testing
- **D)** Otra prioridad específica
