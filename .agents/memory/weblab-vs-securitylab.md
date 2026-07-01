---
name: WebLab "Analizar Seguridad" vs admin Security Lab
description: Two separate security-audit surfaces exist; when adding cybersec-catalog enrichment, both must be updated.
---

Shopy Crafter has two independent security-audit surfaces that must not be assumed to share logic:

1. `pages/projects/WebLab.tsx` → `POST /api/web-lab/security-audit` (project-level "🔒 Analizar Seguridad" button). Findings come from a self-contained regex pattern engine (`runFullSecurityAudit` in `routes/web-lab.ts`) — secrets, code bugs, infra/DB exposure, sensitive data patterns.
2. `pages/admin/SecurityLab.tsx` → the passive scanner (`runSecurityScan` in `lib/security-scanner.ts`), which was built specifically to leverage the 817-skill cybersec catalog (`lib/cybersec-knowledge.ts` / `searchCybersecSkills`).

**Why:** these were built in separate sessions with no shared enrichment step. A user asking "does the Lab Web analysis use the new skills catalog?" was correct to suspect it didn't — WebLab's regex findings had no MITRE/NIST/skill enrichment until explicitly wired in.

**How to apply:** if enriching one audit pipeline with the cybersec skill catalog (or any other catalog-based context), check whether the *other* pipeline also needs the same treatment — they are not shared code. Enrichment was added to WebLab's `add()` finding-builder via a `enrichWithSkills()` wrapper that calls `searchCybersecSkills(category+type+title, 3)` and attaches `mitreAttack`/`nistCsf`/`relatedSkills` to each finding (surfaced in both the vault HTML report and the WebLab.tsx UI).
