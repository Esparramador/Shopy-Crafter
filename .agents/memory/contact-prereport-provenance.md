---
name: Contact pre-report provenance
description: Engine attribution and evidence rules for public contact pre-reports.
---

Track the actual provider result per section; a helper that nominally calls one provider may silently fall back to another. Only count a website URL as a verified source after a successful HTTP response with non-empty page text. Treat form submissions as user-provided claims, and label sector figures as estimates. If scraping fails, do not infer store-specific catalog, stock, platform, SEO, or supplier facts.

**Why:** A pre-report generated after an unreachable store URL included plausible but unsupported inventory claims, and engine attribution must reflect the provider that really returned the text.

**How to apply:** For contact pre-reports and similar business analyses, carry engine metadata through retries and report generation, use only fetched content for store-specific findings, and make unavailable evidence explicit to both the model and report reader.
