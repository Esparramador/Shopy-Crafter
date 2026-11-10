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
