---
name: Video Model Selectors — Selectores hardcodeados y filtros restrictivos
description: Dos selectores de motor de video estaban incompletos; dónde están y cómo están corregidos.
---

## Problema original
1. **FusionStudioPro.tsx avatar section** (tab Avatar Studio): tenía `.filter(m => /kling|seedance|hailuo|veo/i.test(m.key))` que excluía Runway, Sora, Wan del selector de la sección de avatar.
2. **CreateAdModal.tsx**: selector hardcodeado con sólo 8 modelos (sin runway-gen4.5, kling-2.5-turbo, sora-2, veo-3.1, runway-seedance2, wan-2.5-t2v, etc.)

## Corrección
- **FusionStudioPro avatar**: eliminado el `.filter(...)` → ahora usa `caps?.videoGeneration.map(...)` sin restricciones (22 modelos con Q score).
- **CreateAdModal**: lista actualizada a 22 modelos organizados en `<optgroup>` por proveedor: Runway (5), Kling (3), Seedance (3), Google Veo (5), Sora (1), Hailuo (2), Wan (3). Fórmula de coste estimado también actualizada con costes exactos por modelo.

## Selectores YA correctos (no tocar)
- `FusionStudio.tsx` MultiShotTab: `caps?.videoGeneration.map(...)` sin filtro ✅
- `FusionStudioPro.tsx` MultiShotTab: `caps?.videoGeneration.map(...)` para video e imagen ✅
- Otros selectores que leen de `/api/fs-pro/capabilities` automáticamente ✅

**Why:** El endpoint `/api/fs-pro/capabilities` exporta `Object.entries(VIDEO_MODELS)` completo. Cualquier selector que lea de `caps.videoGeneration` tiene acceso a todos los modelos automáticamente. Sólo los hardcodeados requieren mantenimiento manual.

**How to apply:** Cuando añadas un nuevo modelo a `VIDEO_MODELS` en `fusion-studio-pro.ts`, verifica que `CreateAdModal.tsx` (hardcodeado) también lo tenga.
