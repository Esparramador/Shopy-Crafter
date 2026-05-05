# Pipeline de vídeo publicitario "Hanakaze v3 Cascada" — conocimiento operativo

> Este documento destila la metodología desarrollada en los scripts `run-hanakaze-v3-cascada.mjs`, `run-hanakaze-v2-super.mjs`, `run-hanakaze-campaign.mjs` y `add-final-text-overlay.mjs`. Los scripts originales se archivan en esta misma carpeta como `*.mjs.txt` (de sólo lectura, no ejecutables) por si Shopy Brain necesita inspeccionar la implementación exacta.
>
> El workflow runtime fue eliminado el 2026-05-05 porque dependía de una credencial de admin (`HANAKAZE_ADMIN_PASSWORD`) y no era invocable desde la app. La inteligencia operativa, sin embargo, es directamente reutilizable por Shopy Brain para producir cualquier campaña de vídeo de 30-60 s.

## 1. Arquitectura del pipeline

```
[1] Imágenes base   → Card Studio / Fusion Studio (recraft / nano-banana / flux)
[2] Image-to-Video  → Replicate (kling-master, seedance-pro, hailuo, wan-2.5)
[3] Voz off ES      → ElevenLabs (eleven_multilingual_v2, voice_id 21m00Tcm4TlvDq8ikWAM)
[4] Música stock    → ElevenLabs music endpoint (stable-audio-style)
[5] Concat MP4      → ffmpeg local con crossfade 0.35 s
[6] Texto nítido    → ffmpeg drawtext overlay (sustituye texto IA basura)
[7] Subida final    → vault del proyecto como asset video MP4 9:16
```

## 2. Receta de coste/calidad para anuncio premium 60 s vertical 9:16

8 clips × ~7-8 s = ~60 s tras crossfade 0.35 s. Mix de motores:

| Cantidad | Motor | $/s | Por qué se elige |
|---|---|---|---|
| 6 × | `kling-master` | $0.18 | Calidad 10, audio nativo, motion top, character lock natural |
| 2 × | `seedance-pro` | $0.07 | Multi-ref hasta 9 imágenes — único capaz de mantener 2 modelos + N prendas en frame |

Coste total estimado: **$10-12** (vídeo + voz + música).

Cuándo usar cada motor:

- **kling-master** → planos hero, retrato/character, deconstrucción VFX, tipografía limpia, físicas de tela. Cuando hay 1 sujeto o 0 sujetos y necesitas movimiento orgánico + audio ambiente nativo.
- **seedance-pro** → planos donde necesitas **identidad real múltiple** (varias personas + varios productos + transiciones entre ellos). Multi-ref es su killer feature.
- **hailuo** / **wan-2.5** → alternativas más baratas para tomas de relleno o campañas de presupuesto bajo.

## 3. Estructura narrativa probada (8 clips)

Pauta que funcionó en producción real para una marca de serigrafía/moda:

1. **c01 — intro** (5 s, kling-master, audio nativo): hook visual marca + producto.
2. **c02 — beauty shot producto** (5 s, seedance-pro): plano cerrado de la prenda con identidad de marca.
3. **c03 — deconstrucción** (10 s, kling-master): VFX hero con partículas/hilos/ink, sonido textil. Crea "wow".
4. **c04 — virtual try-on real** (10 s, kling-master): persona se materializa la prenda mediante fade-in mágico. Reglas estrictas: el estampado **debe pre-existir** en la imagen de referencia y aparecer ya impreso, NO dibujado en frame.
5. **c05 — motion biológico** (10 s, kling-master): mariposa/mascota/elemento natural moviéndose con física realista.
6. **c06 — física de tela** (10 s, kling-master): perchero/colgador con prendas reaccionando al viento.
7. **c07 — cascada de colección** (5 s, seedance-pro): 4 prendas distintas se materializan en cascada vertical (multi-ref obligatorio).
8. **c08 — outro** (5 s, kling-master): logo + tipografía + audio cierre.

## 4. Reglas duras de prompting (lecciones aprendidas)

Estas reglas evitan los modos de fallo más caros:

- **Identidad de marca**: nunca dejar que el modelo "reinterprete" el logo. Frase obligada en cada prompt: *"The stamp design, position, size, color must be IDENTICAL to the reference image at EVERY frame; no recoloring, no redrawing, no reinterpretation."*
- **No tipografía generativa**: el texto generado por IA siempre sale corrupto. Generar el clip SIN texto y añadirlo en post con `ffmpeg drawtext` (paso 6).
- **Character lock**: en clips con persona, repetir explícitamente *"face, beard, hair, skin tone, pose identical to reference"* + adjuntar reference image.
- **Aspect ratio explícito en prompt**: aunque el parámetro lo fije, escribir *"vertical 9:16"* en el texto del prompt mejora composición.
- **Timeline explícito por segundos**: dividir el prompt en bloques `0-2s … 2-4s … 4-5s …` da control real sobre los keyframes.
- **Sonido nativo**: kling-master genera audio ambiente; pedirlo explícitamente (*"Subtle ambient sound of cotton fabric"*) lo mejora muchísimo.

## 5. Robustez operativa (claves para entornos serverless tipo Replit)

Los 4 patrones que hacen el pipeline reanudable y resistente a desconexiones cliente↔server (críticos en Replit donde la conexión puede cortarse pero el server sigue procesando):

1. **Cliente HTTP raw sin timeouts** — usar `http.request` de Node con `timeout: 0`, `setKeepAlive(true, 30_000)` y `agent: false`. NO usar `fetch()` global porque undici cierra el socket a ~5 s; los endpoints de generación pueden tardar 30-60 s en mandar el primer byte.
2. **Estado persistente reanudable** — cada paso completado se guarda en `logs/<campaign>-state.json` con su `vaultId`. Re-ejecutar el script salta lo ya hecho. Variable `RESET=1` ignora estado previo. Variable `ONLY=c01,c02` regenera sólo clips concretos.
3. **Pre-flight scan del vault** — antes de empezar, escanear el vault del proyecto buscando assets cuyo nombre/fingerprint coincida con un paso ya hecho. Si los encuentra los rescata al state automáticamente (recuperación tras pérdida del JSON).
4. **Polling fallback** — si una llamada API falla o se cuelga, hacer polling al vault durante 5 min buscando el asset que el server SIGUE generando en background. Permite recuperar trabajo aunque la conexión muera.
5. **Rehidratación de URLs públicas** — para image-to-video que reutiliza assets del vault, descargar el binario y re-subirlo justo antes de la llamada para tener una URL HTTPS firmada fresca (las URLs firmadas suelen caducar a 1 h).

## 6. Concatenación final con ffmpeg

```js
// Pasar al endpoint /api/fusion-studio/concat:
{
  clips: [{ vaultId, durationSec }, ...],
  transitionPreset: "crossfade",
  crossfadeSec: 0.35,
  outputFormat: "mp4",
  aspect: "9:16",
}
```

Para **overlay de texto nítido** sustituyendo cualquier intento del modelo, usar `ffmpeg drawtext` con DejaVu Sans Bold:

```bash
ffmpeg -i input.mp4 \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:\
       text='HANAKAZE SERIGRAPHY':fontsize=64:fontcolor=white:\
       x=(w-text_w)/2:y=h-200:enable='between(t,55,60)'" \
  -c:a copy output.mp4
```

## 7. Voz off — receta ES

- **Modelo**: `eleven_multilingual_v2`
- **Voice ID por defecto**: `21m00Tcm4TlvDq8ikWAM` (voz femenina ES neutra, profesional)
- **Settings**: `stability: 0.45`, `similarity_boost: 0.75`, `style: 0.35`, `use_speaker_boost: true`
- **Texto**: ~140-160 palabras para 60 s a velocidad natural ES.
- **Mezcla**: voz a -3 dB sobre música a -18 dB; ducking suave en los picos vocales.

## 8. Cómo reutilizar este conocimiento en Shopy Brain

Cuando el usuario pida "campaña de vídeo para mi producto":

1. Aplicar la **estructura narrativa de 8 clips** (sección 3) adaptando los elementos a la marca.
2. Usar el **mix kling-master + seedance-pro** (sección 2) salvo restricción de presupuesto.
3. Aplicar las **reglas duras de prompting** (sección 4) — son no-negociables.
4. Implementar los **4 patrones de robustez** (sección 5) en cualquier orquestador nuevo.
5. Cerrar siempre con `ffmpeg drawtext` para tipografía y `ffmpeg crossfade 0.35 s` para concat.

Las APIs y modelos ya están cableados en el api-server:

- Image: `lib/fusion-studio-pro.ts` — 15 motores (Flux, Recraft, Imagen, Nano Banana, Seedream, gpt-image-1, …).
- Video: `lib/fusion-studio-pro.ts` (Replicate) + `lib/runway.ts` (Runway directa).
- Voz/música/SFX: `lib/elevenlabs.ts`.
- Concat/overlay ffmpeg: `lib/video-concat.ts` (si existe) o invocación directa con `child_process.spawn`.
