---
name: Tripo3D Integration
description: Integración completa de Tripo3D 3D model generation API — backend, frontend, prompt library, nav.
---

# Tripo3D Integration

## Archivos clave
- `artifacts/api-server/src/routes/tripo3d.ts` — 10 endpoints, SSE streaming, TRIPO_ANIMATIONS array (58 presets)
- `artifacts/shopify-optimizer/src/pages/projects/Tripo3DStudio.tsx` — UI con 6 tabs
- Ruta: `/projects/:id/tripo3d` — registrada en App.tsx y AppLayout.tsx
- Prompt library: sección `tripo3d_animations` con 63 templates (6 guías + 57 animaciones)

## API Tripo3D
- Base URL: `https://api.tripo3d.ai/v2/openapi`
- Auth: `Authorization: Bearer TRIPO_API_KEY`
- Task types confirmados: text_to_model, image_to_model, multiview_to_model, refine_model, animate_prerigcheck, animate_rig, animate_retarget, stylize_model, convert_model
- Polling: GET `/task/{task_id}` → status: queued/running/success/failed/cancelled + progress 0-100
- Upload: POST `/upload` con FormData → devuelve `image_token`
- `animation` en animate_retarget es string plain (ej: "walk", "hip_hop_dance")

## Endpoints backend (todos con requireAdmin vía index.ts)
- GET  /api/tripo3d/animations — lista presets con metadatos (no requiere API call)
- GET  /api/tripo3d/balance — saldo de la cuenta
- GET  /api/tripo3d/task/:taskId — poll individual
- POST /api/tripo3d/text-to-model — SSE streaming, prompt → GLB
- POST /api/tripo3d/image-to-model — multer single, SSE
- POST /api/tripo3d/multiview-to-model — multer fields (front/left/back/right), SSE
- POST /api/tripo3d/refine — refine_model, SSE
- POST /api/tripo3d/prerig — animate_prerigcheck, síncrono (rápido)
- POST /api/tripo3d/rig — animate_rig, SSE
- POST /api/tripo3d/retarget — animate_retarget + animation preset + out_format, SSE
- POST /api/tripo3d/batch — hasta 10 imágenes paralelas, SSE con progreso por item
- POST /api/tripo3d/convert — convert_model, síncrono
- POST /api/tripo3d/stylize — stylize_model, SSE

## Presets de animación (58 total)
Categorías: locomotion, idle, gesture, dance, emote, combat, sit, activity
El array TRIPO_ANIMATIONS está en tripo3d.ts con id/label/category/description/looping/tags.
Los presets son nombres simples: "walk", "run", "hip_hop_dance", "angry", etc.

**Why:** Los preset IDs no están documentados como lista en la API pública — se conocen por conocimiento del platform. El endpoint GET /api/tripo3d/animations devuelve la lista estática sin necesitar API call.

## Nav
- AppLayout.tsx DEFAULT_MODULE_NAV: `{ id: "tripo3d", label: "Tripo 3D Studio", icon: "🧊" }`
- App.tsx lazy: `const Tripo3DStudio = lazy(() => import("@/pages/projects/Tripo3DStudio"))`
- App.tsx route: `/projects/:id/tripo3d` envuelta en RequireAdmin→AdminWrapper→AppLayout

## Prompt Library
- Sección `tripo3d_animations` añadida al final de libraries en master-prompt-library.json
- 63 templates: 6 guías (workflow, prompting, imagen, batch, animación, stylize, AR) + 57 animaciones individuales
- Total actualizado: 6,230 templates
