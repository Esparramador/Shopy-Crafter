---
name: Cybersec skill catalog full audit
description: Verification methodology and result for confirming all 817 cybersec skills are real, complete, and executable.
---

When asked to verify the 817-skill cybersec catalog (`artifacts/api-server/src/data/cybersec-catalog.json` + `src/data/cybersec-skills/<id>/`) is real and not placeholder content, the check was:

1. Every skill id in the catalog has a matching directory with `SKILL.md`, `scripts/`, `references/`, `LICENSE`.
2. `SKILL.md` length >= 300 chars (not a stub).
3. `scripts/` contains at least one non-empty file.
4. Every `.py` script actually compiles (`compile(src, path, 'exec')`), not just "file exists."

Result: all 817/817 passed structural checks. Deeper syntax compilation caught 2 real bugs invisible to a surface-level check — `global X` declared after `X` was already referenced earlier in the same function (illegal in Python), and a backslash inside an f-string expression (illegal pre-3.12). Both were fixed in place under `src/data/cybersec-skills/.../scripts/`.

**Why:** structural presence checks (file exists, non-empty) are not sufficient to claim a script catalog is "executable" — only actually compiling/parsing each script surfaces real bugs. Also remember to sync fixes into `dist/data/cybersec-skills/` (or trigger a rebuild) since that's a build-copied artifact, not source of truth at runtime until rebuilt.

**How to apply:** for any future audit of a "catalog of scripts/skills" claim, always run a real syntax/compile check per language, not just file-existence checks.
