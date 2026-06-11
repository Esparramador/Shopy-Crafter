---
name: Visme Effects Engine + AI Web Designer integration
description: Architecture, data paths, build quirks, and DNA variable system for the Visme/WebDesigner modules
---

## Routes (backend)
- `GET/POST /api/visme/*` — `src/routes/visme.ts` (stats, snippets, templates, generate, preview)
- `GET/POST /api/web-designer/*` — `src/routes/web-designer.ts` (templates, demos, sessions, generate, deploy)

## Libs (backend)
- `src/lib/visme-effects.ts` — EFFECT_SNIPPETS array (30 items), DNA substitution, loadVismeTemplates()
- `src/lib/web-designer.ts` — DESIGN_SYSTEM_PROMPT, 14 DESIGNER_TEMPLATES, multi-model streaming, session management

## Data files
- `src/lib/data/visme_templates.json` (809 KB, 594 templates) — structure: `{ meta, templates: [{id, name, icon, category, tags, description, prompt}] }`
- In the esbuild bundle `dist/index.mjs`, `import.meta.url` resolves to `dist/`, so data must be at `dist/data/`
- `build.mjs` copies `src/lib/data/ → dist/data/` after esbuild (uses `cp()` from `node:fs/promises`)

## Critical build quirk
- EFFECT_SNIPPETS must be ONE contiguous array literal — never insert a stray `];` mid-file
  (caused a TypeScript build error when `color_shift_bg` was placed after an early `];\n{...}` fragment)

## DNA variables
`__PRIMARY__`, `__SECONDARY__`, `__ACCENT__`, `__BG__`, `__SURFACE__`, `__TEXT__`, `__FONT__`,
`__NAME__`, `__HEADLINE__`, `__TAGLINE__`, `__CTA__`, `__SECTOR__`, `__ICON__`, `__USP_1/2/3__`
Mapped from project's brand_dna via `buildDnaFromProject()` in visme-effects.ts.

## Frontend pages
- `/web-designer` and `/projects/:id/web-designer` → `pages/admin/WebDesigner.tsx` (3-panel: sidebar | iframe preview | chat+code)
- `/effects-studio` and `/projects/:id/effects-studio` → `pages/admin/EffectsStudio.tsx` (sidebar cats | grid | detail panel)
- Both added to `AppLayout.tsx` PROJECT_MODULES nav

**Why:** Data path resolution in esbuild bundles differs from source dev; copy step is mandatory or `readFileSync` silently fails at runtime with ENOENT.
