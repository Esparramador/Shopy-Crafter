---
name: Security Lab passive vulnerability scanner
description: How the passive website security scanner (security_scans table, runSecurityScan, OmniChatbot action) is wired together.
---

`runSecurityScan(url)` (api-server `lib/security-scanner.ts`) performs passive-only checks (no active exploitation): TLS/HTTPS, security headers, cookies, CORS, exposed sensitive paths, fingerprinting, mixed content, outdated JS libs, leaked secrets, directory listing.

Every finding is enriched via `enrichFinding()` → `searchCybersecSkills()` against the 817-skill catalog, returning `attackerPerspective`, `hardeningSteps`, and MITRE/NIST tags.

**Why this matters:** `searchCybersecSkills` originally required the *entire* multi-word search phrase to appear as a literal substring in a catalog field — since search terms are natural phrases like "hsts ssl stripping downgrade attack", this almost never matched anything, so every finding silently got empty `mitreAttack`/`relatedSkills` arrays with no error.

**How to apply:** The search was changed to tokenize the query (filtering stopwords) and score per-word matches summed across fields, rather than requiring a whole-phrase substring match. Any other code calling `searchCybersecSkills` with multi-word natural-language queries should expect/rely on this tokenized behavior, not phrase-exact matching.

Route layer: `routes/security-scan.ts` exposes `POST /api/projects/:projectId/security-scan/run`, `GET .../history`, `GET .../:id`, all behind `requireProjectAccess`, persisting to the `security_scans` table (jsonb `findings`/`techStack`). The OmniChatbot action `security_scan_website` in `shopybrain.ts` reuses the same `runSecurityScan` + persistence, defaulting the URL to `project.shopDomain` when not given.

Frontend: `pages/admin/SecurityLab.tsx` has a tab toggle between the original skill-catalog browser and a new `ScannerPanel` (project picker, URL input, severity-filtered findings list with expandable MITRE/NIST detail, score gauge, scan history) — calls the same three endpoints via `API_BASE` (which already excludes a trailing slash; matches the `import.meta.env.BASE_URL` convention used elsewhere in this app).
