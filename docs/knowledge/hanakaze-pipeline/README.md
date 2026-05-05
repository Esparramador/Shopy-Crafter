# Hanakaze Pipeline — archivo de conocimiento

Esta carpeta NO contiene código ejecutable. Es un archivo de referencia para que Shopy Brain (y cualquier agente futuro) pueda consultar la metodología completa de producción de campañas de vídeo desarrollada en la campaña Hanakaze v1 → v3.

## Cómo leerla

1. **Empieza por `KNOWLEDGE.md`** — destilado curado: arquitectura, receta de coste, estructura narrativa, reglas de prompting, patrones de robustez, recetas de voz/música/concat.
2. Si necesitas el detalle exacto de implementación (parsers de respuesta de Replicate, manejo de errores específicos, prompts completos clip por clip), consulta los `*.mjs.txt`:
   - `v3-cascada.mjs.txt` — versión final, 8 clips × 8 s, mix kling-master + seedance-pro, 60 s totales 9:16.
   - `v2-super.mjs.txt` — versión previa, 12 clips, ~75 s. Útil para campañas más largas.
   - `v1-campaign.mjs.txt` — versión inicial, pipeline completo end-to-end con vault scan, polling fallback, rehidratación de URLs. Documenta los patrones de robustez con más detalle.
   - `add-final-text-overlay.mjs.txt` — receta exacta de overlay tipográfico con `ffmpeg drawtext`.

## Por qué no son ejecutables

Los archivos llevan extensión `.txt` porque:

- Dependían de la credencial admin `HANAKAZE_ADMIN_PASSWORD` del proyecto Hanakaze específico (no reutilizable).
- El workflow `hanakaze-runner` que los invocaba fue eliminado el 2026-05-05.
- Se conservan como **documentación de patrones**, no como pipeline activo.

## Quién consume esta carpeta

- Shopy Brain, cuando el usuario pide "campaña de vídeo" / "anuncio largo" / "vídeo 60 s para mi producto".
- Cualquier agente futuro que necesite reproducir el patrón de pipeline reanudable cliente↔server resistente a desconexiones.
