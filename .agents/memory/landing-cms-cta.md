---
name: Landing hero CTAs are CMS-driven
description: How hero buttons resolve their destination and how to change them
---
Hero CTA buttons on the public Landing are driven by CMS, NOT hardcoded.
- Field: `hero.ctaPrimary` / `hero.ctaSecondary` = `{ href, label }` (NOT `hero.n`).
- Landing.tsx `resolveSectionId(href)` maps an href/alias → a real section id in
  `FP_SECTION_IDS` (fp-hero, fp-engines, fp-demo, fp-results, fp-pricing,
  fp-calculator, fp-contact). Aliases: contact/contacto/#cta→fp-contact,
  planes/precios→fp-pricing, how/cómo→fp-demo, etc. `goToHref()` also handles
  absolute URLs (new tab) and internal "/..." paths (assign).
- To change a CTA destination at runtime: PATCH `/api/cms/content` with
  `{ "path": "hero.ctaPrimary.href", "value": "#contact" }` (admin session).
**Why:** CTAs used to be hardcoded to goToSection(4)=pricing, ignoring the CMS
href — the "go to plans instead of contact" bug. Honor the href instead.
