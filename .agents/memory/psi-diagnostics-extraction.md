---
name: PSI / Lighthouse diagnostics extraction
description: How to pull the rich PageSpeed Insights opportunities/diagnostics (savings + offenders), and the heterogeneous audit-item shapes to handle.
---

# PageSpeed Insights diagnostics extraction

The PSI API returns far more than scores + Core Web Vitals — `lighthouseResult.audits[<id>]`
holds the real opportunities/diagnostics with estimated savings and the concrete offending
resources. Web Lab previously only surfaced scores, so this data was "connected but unused."

**Where it lives:** `pagespeed.ts` → `extractDiagnostics()` builds `PageSpeedResult.diagnostics`.
`web-lab.ts` exposes `diagnostics` (mobile) + `diagnosticsDesktop`. `WebLab.tsx` renders via
the `PsiDiagnosticsList` component.

**Savings:** `audit.details.overallSavingsBytes` / `overallSavingsMs`. Impact derived from
`audit.score` (<0.5 high, <0.9 medium, else info). Skip `scoreDisplayMode` of `notApplicable`/`manual`,
and skip passing audits (score≥0.9) with no savings.

**Why item parsing is fiddly — audit `details.items[]` shapes are heterogeneous:**
- url-based (unused-js/css, modern-image-formats, render-blocking): `{url, wastedBytes, wastedMs, totalBytes, transferSize}`
- entity-based (third-party-summary): `{entity (string OR {text}), mainThreadTime, blockingTime, transferSize}`
- node-based (layout-shift-elements): `{node:{nodeLabel,snippet}, score}` — score is the per-element CLS contribution
- statistic-based (dom-size): `{statistic, value, node}`
- group-based (mainthread-work-breakdown): `{groupLabel, duration}`; bootup-time: `{url, total}`

**How to apply:** when adding/extending diagnostic IDs, the label fallback chain must cover
url → entity(.text) → node(.nodeLabel/.snippet) → statistic/groupLabel → displayValue, and the
detail line should try bytes (wasted/transfer/total) then ms (wasted/mainThread/blocking/duration/total)
then numeric `value` (dom-size) then `score` (layout-shift). Required audit set includes
`layout-shift-elements` (easy to forget — it's the CLS element offenders).
