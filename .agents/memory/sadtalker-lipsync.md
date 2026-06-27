---
name: SadTalker lip-sync pipeline
description: Foto + audio → vídeo con lip-sync real vía Replicate lucataco/sadtalker
---

## Modelo correcto
- `lucataco/sadtalker` — 23K runs, activo en Junio 2026
- Version: `85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b`
- Endpoint: `POST /v1/predictions` con `{"version": "85c698...", "input": {...}}`
- NO usar `/v1/models/lucataco/sadtalker/predictions` → 404

## Input parameters
```json
{
  "source_image": "URL pública de la foto",
  "driven_audio": "URL pública del audio .mp3",
  "preprocess": "full",
  "still_mode": false,
  "use_enhancer": true,
  "pose_style": 0,
  "exp_scale": 1.0,
  "size": 256
}
```

## Tiempo de procesamiento
- ~22 segundos de audio → ~3-4 min de procesamiento
- Polling recomendado: cada 8s, máx 40 intentos

## Pipeline Modelo IA definitivo (youtube.ts /dub endpoint)
1. TTS naturalizado: `eleven_turbo_v2_5`, stability=0.3, similarity_boost=0.9, style=0.45
2. ffprobe → duración exacta del audio
3. Guardar TTS en public/media/sevillano/ para tener URL pública
4. SadTalker con foto Sevillano URL + audio URL → lip-sync real
5. Si SadTalker falla → Seedance I2V (bytedance/seedance-1-lite, max 10s, loop con ffmpeg)
6. Fallback final → foto estática Ken Burns + audio

**Why:** ElevenLabs dubbing necesita video CON audio para extraer speech. Seedance I2V genera videos sin audio. SadTalker es el único que acepta foto + audio directamente y genera lip-sync.

## Lo que NO funciona
- `cjwbw/sadtalker` → 404
- ElevenLabs dubbing sobre video sin audio → "Couldn't extract audio"
- Runway gen4_turbo con foto del Sevillano → INTERNAL.BAD_OUTPUT.CODE01
- Seedance I2V: máx 10s, hay que hacer loop con ffmpeg para audios más largos
