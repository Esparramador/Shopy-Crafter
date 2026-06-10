---
name: Master Prompt Library
description: 5,582 prompt templates combinados de la agencia + seeds internos Shopy Crafter — estructura, endpoint, y UI.
---

## Archivo
`artifacts/api-server/src/lib/master-prompt-library.json` (5.6 MB, generado 2026-06-10)

## Estructura
```json
{
  "_meta": { "total_templates": 5582, "libraries": [...index...] },
  "libraries": {
    "stitch_bulk_v3": { "count": 125, "templates": [...] },
    "stitch_bulk_v2": { "count": 225 },
    "stitch_effects": { "count": 210 },
    "stitch_design_system": { "count": 52 },
    "typegpu_advanced": { "count": 78 },
    "typegpu_effects": { "count": 61 },
    "visme_templates": { "count": 579 },
    "3d_mining": { "count": 3414 },
    "21st_dev_auth_dash": { "count": 30 },
    "21st_dev_heroes_nav": { "count": 26 },
    "21st_dev_sections": { "count": 39 },
    "crafter_methodology": { "count": 5 },
    "desktop_commander": { "count": 73 },
    "external_ui_libs": { "count": 395 },
    "video_prompts": { "count": 19 },
    "effects_prompts": { "count": 24 },
    "effects_catalog": { "count": 213 },
    "agency_singles": { "count": 4 },
    "shopy_crafter_seeds": { "count": 10 }
  }
}
```

## DNA Variables
Todos los templates internos usan: {{CLIENT_NAME}}, {{CLIENT_BRAND}}, {{CLIENT_NICHE}}, {{CLIENT_URL}}, {{CLIENT_INDUSTRY}}, {{CLIENT_PRODUCT}}, {{CLIENT_AUDIENCE}}, {{CLIENT_TONE}}, {{CLIENT_COLORS}}, {{CLIENT_LANGUAGE}}

## API Endpoint
`GET /api/fs-pro/prompt-library-master`
- `?indexOnly=1` → devuelve índice de librerías con counts
- `?library=KEY` → filtra por librería
- `?search=TEXT` → búsqueda por nombre/descripción/categoría
- `?limit=20&offset=0` → paginación (max 100/página)

**Why:** La carga lazy (readFileSync en primera llamada) evita bundlear 5.6MB en el output de esbuild.

## UI
En `FusionStudioPro.tsx` → `PromptLabTab` → panel collapsible "🏛 Biblioteca Maestra de la Agencia" con selector de librería, búsqueda, paginación y botón 📥 para cargar al editor.

## Regenerar
```bash
python3 attached_assets/generate_master_lib.py  # no existe — re-ejecutar el script inline
```
El script Python está en el histórico de la sesión donde se generó. Para regenerar, combinar todos los JSONs de `attached_assets/` con el mismo patrón.
