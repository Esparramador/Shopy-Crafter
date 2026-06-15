---
name: Claude Designer Studio (ZIP)
description: Qué había en el ZIP del clon de Claude Design y qué se integró vs qué ya existía
---

## Contenido del ZIP (claude-designer-replit.zip)

- `backend/_claude_designer.py` — 1,896 líneas: DESIGN_SYSTEM_PROMPT + templates + HTML del 3-panel UI + streaming multi-modelo (Claude/Gemini/GPT)
- `backend/_web_lab_engine.py` — 561 líneas: DNA extractor, brand research paralelo, AI redesign
- `backend/_visme_effects_engine.py` — Visme effects engine
- `admin/effects-studio.html` — Effects Studio HTML (680 líneas)
- `admin/demos/*.html` — 28 demos HTML de referencia
- `.claude/hooks/` — 3 hooks de seguridad Python
- `.claude/settings.json` — configuración de hooks + permisos
- `CLAUDE.md` — guía del proyecto
- `_agency_os_engine.py` + `agency-os.html` — Agency OS (marketplace de componentes)

## Qué ya estaba en el stack TypeScript (NO necesitó portarse)

| Componente | Archivo TS equivalente |
|---|---|
| Claude Designer 3-panel | `src/lib/web-designer.ts` + `routes/web-designer.ts` |
| Web Lab DNA extractor | `routes/web-lab.ts` (2,963 líneas) |
| Effects Engine | `lib/visme-effects.ts` + `routes/visme.ts` |
| 26 demos HTML | `public/web-demos/01-*.html … 26-*.html` |
| Effects Studio UI | `src/pages/admin/EffectsStudio.tsx` |
| Routes registradas | `routes/index.ts` lines 46, 59-60, 146, 158-159 |

## Qué se integró del ZIP (lo que faltaba)

1. `.claude/hooks/secret-scanner.py` — bloquea API keys hardcodeadas (30+ providers)
2. `.claude/hooks/dangerous-command-blocker.py` — bloquea rm -rf, DROP DATABASE, fork bomb
3. `.claude/hooks/env-file-protection.py` — impide cat/curl de .env
4. `.claude/settings.json` — conecta los 3 hooks + deny Read/Write .env
5. `CLAUDE.md` (workspace root) — guía completa del proyecto Shopy Crafter

**Why:** Los hooks de .claude son agnósticos del stack (Python puro), funcionan igual en proyectos Node.js. El resto del ZIP ya había sido portado a TypeScript en iteraciones anteriores.

## DESIGN_SYSTEM_PROMPT

Definido en `artifacts/api-server/src/lib/web-designer.ts`:
- 30 pre-built effects (particle_rain, aurora_bg, magnetic_btn, etc.)
- 12 reglas de tipo de página → tech 3D (SaaS→Three.js particles, Restaurant→video scrubbing, etc.)
- CDN stack: Three.js 0.158, GSAP 3.12.5, SplitType 0.3.4, Lenis 1.0.45
- 594 Visme categories + 30 inline snippets listados
- Models: Claude (default), Gemini, GPT-4.1 via model routing
