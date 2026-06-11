---
name: Master Prompt Library
description: Estructura, tamaño y convenciones del master-prompt-library.json y cómo editarlo eficientemente.
---

## Archivo
`artifacts/api-server/src/lib/master-prompt-library.json` (~7MB, 111k+ líneas, Junio 2026)

## Estado actual — 6,230 templates en 21+ librerías
Librerías incluidas (muestra):
- stitch_bulk_v3/v2, stitch_effects, stitch_design_system, typegpu_advanced/effects
- visme_templates (579), 3d_mining (3414), 21st_dev_*, crafter_methodology
- desktop_commander (73), external_ui_libs (395), video_prompts, effects_catalog (213)
- cinematic_ad_templates, visme_form_effects (35), **tripo3d_animations (63)**

## Estructura JSON
```json
{
  "_meta": { "total_templates": 6230, ... },
  "libraries": {
    "<library_id>": {
      "_meta": { "library_id": "...", "name": "...", "total": N },
      "templates": [{ "id": "...", "name": "...", "prompt": "...", ... }]
    }
  }
}
```

## DNA Variables en templates internos
`{{CLIENT_NAME}}`, `{{CLIENT_BRAND}}`, `{{CLIENT_NICHE}}`, `{{CLIENT_URL}}`, `{{CLIENT_INDUSTRY}}`, `{{CLIENT_PRODUCT}}`, `{{CLIENT_AUDIENCE}}`, `{{CLIENT_TONE}}`, `{{CLIENT_COLORS}}`, `{{CLIENT_LANGUAGE}}`

## API Endpoint
`GET /api/fs-pro/prompt-library-master`
- `?indexOnly=1` → índice de librerías con counts
- `?library=KEY` → filtra por librería
- `?search=TEXT` → búsqueda por nombre/descripción/categoría
- `?limit=20&offset=0` → paginación (max 100/página)

## ⚠️ Cómo editar SIN leer el archivo entero (111k líneas agotan contexto)
Usar Python para inyectar una nueva sección:
```python
# Confirmar cierre con: tail -5 → debe terminar en \n    }\n  }\n}
closing = '    }\n  }\n}'
new_section_json = json.dumps(section_dict, ensure_ascii=False, indent=4)
replacement = f'    }},\n    "nueva_seccion": {new_section_json[1:]}\n  }}\n}}'
new_content = content.replace(closing, replacement, 1)
# Actualizar contador:
new_content = new_content.replace('"total_templates": N', '"total_templates": N+M', 1)
```

**Why:** El archivo es demasiado grande para read tool sin paginación. Python lo procesa en RAM en segundos. El tail siempre sigue el patrón `    }\n  }\n}` (cierre: último template → templates[] → sección → libraries → root).

## UI
En `FusionStudioPro.tsx` → `PromptLabTab` → panel "🏛 Biblioteca Maestra" con selector de librería, búsqueda, paginación y botón 📥 para cargar al editor.
