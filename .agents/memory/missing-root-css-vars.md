---
name: Missing :root CSS variables
description: design-system.css had empty ROOT VARIABLES section; dark mode vars were never defined
---

## The rule
The `design-system.css` `:root { }` block (lines 17-71) contains ALL dark-mode CSS variables. If this block is ever lost/emptied, the entire app reverts to white backgrounds everywhere (body, login, etc.).

**Why:** `body { background: var(--ink) }` resolves to transparent/white if `--ink` is not defined. The variables ONLY existed in `[data-theme="light"]` (light mode overrides). Dark mode (default) had NO definition.

**How to apply:** Any future CSS merge/refactor MUST preserve the `:root { }` block at the very beginning of design-system.css (after the section comment, before `/* ── BASE ── */`). The block has two groups:
1. App tokens: `--ink/--ink2-5`, `--t/t2-4`, `--gold/gold2/3`, `--jade/jade2`, `--sky`, `--crim`, `--bdr/bdr2`, `--sh/sh2`, `--r/r2/r4`, `--fh/fb/fm`
2. Tailwind HSL tokens: `--background`, `--foreground`, `--card*`, `--primary*`, `--muted*`, `--border`, `--input`, `--ring`, `--sidebar*`

Light mode overrides live in `[data-theme="light"] { }` block (~line 1135).
