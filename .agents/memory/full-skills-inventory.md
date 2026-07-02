---
name: Full skills inventory (cybersec + prompt library)
description: How "all skills" in Shopy Crafter breaks into two very different catalogs, and how each was verified for a combined Excel inventory.
---

The project has two unrelated things both loosely called "skills":

1. **Cybersec skill catalog** — `artifacts/api-server/src/data/cybersec-catalog.json` + `src/data/cybersec-skills/<id>/`. 817 entries, each a real directory with `SKILL.md`, `scripts/` (Python/PowerShell), `references/`, `LICENSE`. These are genuinely executable — verified by compiling every `.py` file.

2. **Master prompt library** — `artifacts/api-server/src/lib/master-prompt-library.json`. 57 sub-libraries, ~6781 template entries covering design, UI components, effects/animations, video/3D, marketing/social, dev-agent prompts, and agency methodology/organización. These are NOT executable code — they are `{{VARIABLE}}`-templated prompt text fed to an LLM. `src/lib/data/visme_templates.json` and `effects_prompts.json` are raw source files already merged into this master library (don't double-count them).

**Why this distinction matters:** when a user asks for "all skills, not just the 817," they mean the master prompt library too — categories like Diseño, Efectos, Video/3D, Marketing, Desarrollo, Organización. The two catalogs need different "is this real" tests: cybersec = compiles as code; prompt library = has non-trivial content in a text field (`prompt`/`description`/`copySystemAddon`/etc., not empty).

**How to apply:** for any future "verify/export all skills" request, check both files. Field shape varies a lot per prompt-library entry (id vs key vs slug, label vs name vs title, prompt vs description vs copySystemAddon) — extract defensively across the known field name list rather than assuming one schema.

**Third catalog — `.agents/skills/`:** 81 real agent skills installed via git (e.g. `ui-ux-pro-max`, `docx`, `threejs-*`, `vercel-*-best-practices`). Each is a directory with `SKILL.md` (frontmatter `name`/`description`) and optionally `scripts/`, `references/`, `rules/`, `data/`, `assets/`. These are genuine Replit agent skills, distinct from both the cybersec catalog and the master prompt library — don't forget this third source when asked for "all skills." "Real" here = SKILL.md has substantive content (not a stub); most also ship real scripts/reference docs.
