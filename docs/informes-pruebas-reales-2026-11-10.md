# Informe de pruebas reales — 10 de noviembre de 2026

Entorno: desarrollo. No se publicó la aplicación. No se borraron agentes de ElevenLabs ni se modificó código de la aplicación. Los ajustes de voz se cambiaron temporalmente para las pruebas y se restauraron.

## 1. Vista previa de agentes ConvAI huérfanos

`GET /api/voice/convai/orphans` respondió HTTP 200. Se consultó la vista previa; no se llamó al endpoint de borrado. La respuesta marcó estos cinco agentes como huérfanos:

| ID | Nombre | Creado (UTC) | Agente en uso con el mismo nombre |
|---|---|---|---|
| `agent_6001m38en1dqemgsnczrx8qe03rb` | Arturo — Secretario del CEO de Shopy Crafter | 2026-09-24 00:57:08 | `agent_2701kwy2xhn9f9498qdhmqphhse9` (admin) |
| `agent_1901m32hjs51ey5an4by92sqs2p3` | Arturo — Secretario de Shopy Crafter | 2026-09-21 17:52:52 | `agent_0501m32jt5tbfqwa8w4p8c54kfgk` (cliente) |
| `agent_1901kwyfkr7gf5jv4cet7tdm2s2s` | Arturo — Secretario de Shopy Crafter | 2026-07-07 14:27:17 | `agent_0501m32jt5tbfqwa8w4p8c54kfgk` (cliente) y `agent_0201kwyfs8a8eqe9v0tx7v67r7da` (landing) |
| `agent_4701kwwmzd6ef9wawmqrp0xctt82` | Arturo — Secretario de Shopy Crafter | 2026-07-06 21:22:33 | `agent_0501m32jt5tbfqwa8w4p8c54kfgk` (cliente) y `agent_0201kwyfs8a8eqe9v0tx7v67r7da` (landing) |
| `agent_7901kwwcsehtfzm9wytya0mmy75z` | ShopyBrain — Asistente Admin | 2026-07-06 18:59:29 | Ninguno con ese nombre |

## 2. Modelos de Replicate

Consultas autenticadas de lectura al endpoint de modelo; no se crearon predicciones.

| Modelo | HTTP | Resultado |
|---|---:|---|
| `google/imagen-5` | 404 | `{"detail":"Model not found."}` |
| `google/imagen-5-ultra` | 404 | `{"detail":"Model not found."}` |
| `google/imagen-4` | 200 | Público; nombre `imagen-4`; última versión `238bcc930d7acb8dfbcd9b4363df1fc4746c1cdb6c3fc657d63df4749ea89471` (creada 2026-10-01 14:35:21 UTC). |

## 3. Correo de prueba del aviso de salud

- Destinatario resuelto: `craftershopy@gmail.com`.
- Se ejecutó `runConvAIHealthAlert` con la comprobación real de salud, la plantilla y el sender `gmail.sendEmail` del aviso. El almacenamiento del estado se sustituyó por un adaptador en memoria para activar el envío sin escribir en PostgreSQL. El asunto se prefijó claramente con `PRUEBA`.
- Asunto: `PRUEBA ConvAI 2026-11-10T09:53:06.734Z · 🟢 Las llamadas de voz de Arturo vuelven a funcionar`.
- El sender devolvió éxito; el resultado fue `action: notified` y el log confirmó `Gmail: email sent successfully`.
- El estado persistido del aviso antes y después fue idéntico: `{"level":"ok","since":"2026-11-08T12:20:00.016Z"}`. No existe un destinatario guardado en esa tabla; se usó el configurado por el entorno.
- **ID de Gmail pendiente:** la búsqueda de solo lectura en Gmail respondió HTTP 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` / `Insufficient Permission`. No se reenvió el correo. La reconexión de Gmail con permiso de lectura está pendiente para recuperar el ID del mensaje ya enviado.

## 4. Pruebas E2E de voz

### `convai-voice-apply-partial`

- Resultado: **12 comprobaciones pasaron; 0 fallaron**.
- Comprobó el fallo parcial simulado en el navegador con sesión admin real: identifica el agente cliente fallido, conserva los resultados de admin y landing, permite reintentar solo cliente, no vuelve a guardar ni recrea agentes, persiste el informe tras recargar y gestiona el conflicto de versión al guardar.
- Es una prueba de la interfaz y el manejo de respuestas parciales; las respuestas de aplicación se simulan deliberadamente, no se modifican agentes reales en ElevenLabs.

### `convai-voice-tuning`

- Resultado: **23 comprobaciones pasaron; 1 falló**.
- La muestra real respondió HTTP 200, `audio/mpeg`, con 63.363 bytes. Guardar y aplicar devolvió HTTP 200 y reportó los tres tipos de agente.
- Fallo exacto: `Se puede volver a aplicar la configuración guardada sin cambios en los controles`.
- El script se detuvo en esa aserción, antes de su bloque final de sincronización cliente y de reinicio. No se configuró `E2E_RESTART_CMD`, así que no se intentó reiniciar el workflow desde el script.
- La comprobación separada de sincronización cliente sí pasó: guardar temporalmente `stability=0.6`, `similarityBoost=0.9`, `speed=1.1` respondió HTTP 200; login cliente, `/api/voice/client-call-url` y lectura del agente respondieron HTTP 200; el TTS del agente coincidió con esos valores.

### `convai-voice-call` en móvil

- Modo: cliente, `E2E_MOBILE=1`, viewport 375×812.
- Resultado: **13 comprobaciones pasaron; 1 falló**. Fallo exacto: `speaking llegó después de connected`.
- El orden que alcanzó a observar el sondeo fue `Preparando asistente IA... → IA respondiendo → En llamada`. La llamada real conectó con ElevenLabs: abrió WebSocket, envió 116 bloques de audio de micrófono, recibió 10 bloques de audio y transcribió «Hola, Arturo. ¿Me escuchas bien?» y «Por favor, di la palabra “melocotón”»; Arturo respondió. La prueba se detuvo en la aserción de orden de etiquetas, por lo que no ejecutó las aserciones posteriores.
- En la medición móvil, la tarjeta, el transcript y el botón «Colgar» quedaron dentro del viewport. El usuario de prueba se borró correctamente (HTTP 200).

## Restauración y cambios

- Ajustes originales capturados: `stability=0.5`, `similarityBoost=0.8`, `speed=1.2`.
- Restauración: guardar HTTP 200 y aplicar HTTP 200; admin, cliente y landing quedaron en estado `applied`. La comprobación final devolvió HTTP 200, `healthy=true`, `degraded=false`; los tres agentes estaban `ok`, y una lectura posterior confirmó los ajustes originales.
- El estado de la alerta permaneció intacto. El usuario efímero de la comprobación cliente fue eliminado. No se cambió código ni se publicó; este informe es el único archivo añadido.

## Seguimiento — sincronización, limpieza y repetición E2E

### Master de GitHub

- Se trajo `origin/master` con los PR #54 y #55. El commit remoto al sincronizar fue `2278f7a0d54d1ffa0fd0e5c13545d4133f4150d2`, merge del PR #55; también incluye el PR #54.
- Se integró sin conflictos en el historial local, conservando los commits de Replit. HEAD quedó en `21c68ad94c4861f17c2fc6d886d6491f4df79435` (`Merge remote-tracking branch 'origin/master'`). `origin/master` es antecesor de HEAD; la rama local conserva sus commits no enviados.
- `pnpm install --frozen-lockfile` terminó correctamente. Se reiniciaron API y web; `/api/healthz` respondió HTTP 200 (`{"status":"ok"}`).
- No se hizo push ni se publicó. Los cambios de código y dependencias proceden del merge solicitado; no se hicieron ediciones manuales de código.

### Eliminación controlada de agentes

- La nueva vista previa `GET /api/voice/convai/orphans` respondió HTTP 200. Los cuatro IDs autorizados seguían en estado `orphan`; por ello se llamó a `POST /api/voice/convai/orphans/delete` con `confirm: true` y exactamente esos cuatro IDs.
- El borrado respondió HTTP 200 y `success: true`; cada uno de los cuatro resultados fue `deleted`:
  - `agent_6001m38en1dqemgsnczrx8qe03rb`
  - `agent_1901m32hjs51ey5an4by92sqs2p3`
  - `agent_1901kwyfkr7gf5jv4cet7tdm2s2s`
  - `agent_4701kwwmzd6ef9wawmqrp0xctt82`
- `agent_7901kwwcsehtfzm9wytya0mmy75z` no fue enviado a la ruta de borrado y continúa listado como huérfano. La vista previa posterior confirmó que los cuatro IDs borrados ya no aparecen.
- Los agentes activos de admin (`agent_2701kwy2xhn9f9498qdhmqphhse9`), cliente (`agent_0501m32jt5tbfqwa8w4p8c54kfgk`) y landing (`agent_0201kwyfs8a8eqe9v0tx7v67r7da`) no se borraron; su salud posterior quedó `ok`.

### E2E repetidos tras el PR #55

#### `convai-voice-tuning`

- **60 comprobaciones pasaron; 0 fallaron.**
- Se completaron la previsualización de audio, guardado/aplicación, reaplicación de ajustes, verificación de concurrencia de llamada y sincronización del agente cliente tras guardar. No hubo errores de página.
- El paso de reinicio interno del E2E se omitió porque no se definió `E2E_RESTART_CMD`; el workflow de API sí se había reiniciado previamente como parte de la sincronización solicitada.
- El usuario de prueba se eliminó. El script restauró y aplicó los valores originales: `stability=0.5`, `similarityBoost=0.8`, `speed=1.2`.

#### `convai-voice-call` en móvil

- Modo cliente, `E2E_MOBILE=1`, viewport 375×812: **27 comprobaciones pasaron; 0 fallaron**.
- El WebSocket real de ElevenLabs se abrió; el navegador envió 116 bloques de audio, recibió 9 bloques, transcribió la frase de prueba y Arturo respondió. El observador registró el orden correcto: preparación → conexión → llamada → respuesta.
- La tarjeta, el transcript y «Colgar» quedaron dentro del viewport. El agente cliente permaneció en estado `ok` y el usuario efímero se eliminó correctamente.

### Verificación final

- `GET /api/voice/convai/voice-settings`: HTTP 200; `stability=0.5`, `similarityBoost=0.8`, `speed=1.2`.
- `GET /api/voice/convai/health`: HTTP 200; `healthy=true`, `degraded=false`; admin, cliente y landing en `ok`.
- `GET /api/voice/convai/orphans`: HTTP 200; los cuatro IDs borrados ausentes y el agente ShopyBrain preservado.

## Pre-Informe de contacto — prueba real en desarrollo

### Primera ejecución y causa raíz

- Se enviaron ambos formularios reales con `https://musclefactory.es`. En desarrollo, ese dominio no resolvió: `getaddrinfo ENOTFOUND musclefactory.es`. Aun sin scraping, las dos solicitudes se dieron por completadas y se enviaron por correo: A creó el informe 1513 (217.312 bytes) y B el 1514 (219.012 bytes); ambos trabajos quedaron `completed`, intento 1, `email_status=sent`, sin error guardado.
- El informe 1513 afirmó sin evidencia que había «56 productos activos sin stock» y recomendó cambiar el inventario. No se había podido consultar la tienda, así que esa afirmación no estaba respaldada. Los informes 1513 y 1514 y sus correos permanecen; no se borraron ni se pueden retirar de los buzones.
- La configuración de desarrollo del proyecto Muscle Factory indica `https://musclefactorybcn.com`. El scraper de la aplicación y una consulta pública de lectura respondieron HTTP 200. Se extrajeron 162 palabras, título `Muscle Factory BCN - Más que una tienda online`, meta description de 121 caracteres, H1 `Muscle Factory BCN`, 29 H2, 76 imágenes (21 sin `alt`), 1 JSON-LD, y presencia de `robots.txt`, sitemap y SSL.

### Repetición desde los formularios públicos

Se repitieron A desde `/#fp-contact` y B desde `/contacto`, usando el dominio público configurado del proyecto, el nicho `suplementación deportiva` y el correo de pruebas `prueba+prereport@shopycrafter.com`. Ambos envíos recibieron HTTP 200; no hubo errores JavaScript ni casillas obligatorias pendientes.

| Envío | Confirmación visible al visitante | Trabajo en cola | Informe guardado |
|---|---|---|---|
| A — portada | `¡Solicitud recibida!` | `completed`; 1 intento; informe `completed`; correo `sent`; sin error. ID de envío: `lead_form_dc6f25b0b36ba4bdbea70e143217bbf75ba236ecfd8b7b9b63a160d275b3a1b0`. | ID 1515; 216.336 bytes. |
| B — `/contacto` | `✅ ¡Solicitud recibida! Hemos recibido tu solicitud. Te contactaremos con una propuesta por escrito antes de empezar.` | `completed`; 1 intento; informe `completed`; correo `sent`; sin error. ID de envío: `lead_form_f00b49e4df23fa0ee3ef8812d4c7bc491c4e53ac98082224dc45f80279e0f4c2`. | ID 1516; 215.782 bytes. |

La API devolvió en ambos casos: `¡Solicitud recibida! Estamos analizando tu negocio con IA. Recibirás noticias nuestras muy pronto.`

### Contenido, motores y correo

- Los informes 1515 y 1516 contienen las cuatro secciones de negocio, mercado, SEO y proveedores; ninguna contiene los marcadores `Error en…`. El SEO cita datos extraídos de la página pública. No afirman que se haya leído el catálogo privado ni se haya verificado stock, ventas o métricas internas. Las métricas de mercado, márgenes y proveedores se identifican como estimaciones o recomendaciones sectoriales; B indica expresamente que el número de SKU y el stock no son verificables con la evidencia disponible.
- La atribución persistida y los registros del servidor coinciden: **Claude (`claude-anthropic`)** generó negocio, mercado, SEO y proveedores en A y B. Claude también formateó esas cuatro secciones y generó las métricas sectoriales y el producto de muestra. No hubo secciones servidas por Gemini.
- El sender del pre-informe registró `Gmail: email sent successfully`; ambos trabajos acabaron con `email_status=sent`. La búsqueda de solo lectura para recuperar los IDs de Gmail respondió HTTP 403, `Request had insufficient authentication scopes`. No se reenvió ningún correo para obtener esos IDs.
- La generación de imagen opcional del producto de muestra no tuvo crédito de Replicate: `black-forest-labs/flux-1.1-pro` y `black-forest-labs/flux-schnell` respondieron HTTP 402 `Insufficient credit`; `google/nano-banana` respondió HTTP 429 por límite de solicitudes. La ficha de muestra y los informes de texto sí se guardaron y enviaron.

### Cambios y verificación

- Se corrigió el registro del motor para guardar el proveedor que realmente respondió en cada sección, incluso cuando una función de Gemini usa Claude como respaldo. La atribución se conserva al guardar y recuperar el trabajo.
- Se reforzaron las reglas de evidencia del pre-informe: solo una página pública obtenida con HTTP exitoso y texto no vacío cuenta como fuente; no se atribuyen al negocio datos que no aparezcan en el contenido consultado; se distinguen los datos declarados, las observaciones web y las estimaciones; y el formateador no debe añadir hechos nuevos. También se evita marcar como ausente un metadato SEO cuando la web no pudo analizarse.
- Causa del fallo original: la web de prueba no resolvía y el prompt anterior no impedía afirmar inventario no observado. La prueba se repitió con el dominio real del proyecto y ambos informes corregidos terminaron y se enviaron.
- Pruebas focalizadas del worker y atribución: **8 pasaron**. El workflow del API se reconstruyó y reinició; `GET /api/healthz` respondió HTTP 200 (`{"status":"ok"}`).
- El typecheck del API sigue fallando por dos errores ajenos a estos cambios: `fusion-studio-pro.ts:1353` pasa `gen4.5` donde `RunwayModel` espera `gen4_5`, y `provider-health.ts:312` usa el identificador inexistente `checkOpenai`. No se modificaron esos archivos.
- No se tocó producción ni se publicó. Los cuatro envíos de prueba (dos iniciales y dos corregidos) crearon trabajos y enviaron correos; los dos primeros informes con la URL que no resolvía se conservan como antecedentes y no deben usarse como análisis verificado.
