---
name: Cybersec skill catalog field shape inconsistency
description: mitre_attack/tags/nist_csf fields in the 817-skill cybersec-catalog.json sometimes arrive as a bare string instead of string[]; consumers must normalize defensively.
---

The 817-skill cybersec catalog (`cybersec-catalog.json`, read via `getCybersecCatalog()` in `cybersec-knowledge.ts`) was assembled from heterogeneous generated sources. Fields typed as `string[]` in `CybersecSkillMeta` (`mitre_attack`, `tags`, `nist_csf`) sometimes arrive as a single string (often `""`) instead of an array.

**Why:** Calling `.some()`/`.flatMap()` directly on these fields throws `TypeError: X.some is not a function` at runtime — this crashed `searchCybersecSkills()` and any caller (e.g. the security scanner's `enrichFinding()`).

**How to apply:** Any new code reading these catalog fields must go through a normalizer (`toStringArray`-style helper: `Array.isArray(v) ? v : v ? [v] : []`) rather than assuming the declared TS type matches runtime shape. Don't trust the interface — verify with a real catalog entry first.
