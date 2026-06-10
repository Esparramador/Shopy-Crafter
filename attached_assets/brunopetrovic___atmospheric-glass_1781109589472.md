# Atmospheric Glass Design System

## Overview

Atmospheric Glass is a glassmorphism-driven weather application design system built to make meteorological data feel calm, premium, and readable. It combines a vibrant abstract gradient backdrop with frosted translucent interface layers so dense information still feels light and spacious.

This document consolidates the design intent from the project README, the core design guidance from `DESIGN.md`, and the implementation primitives defined in the Tailwind theme and design token JSON.

## Brand and visual direction

The system uses an ethereal, high-fidelity glass aesthetic. The background carries the visual energy through deep blue, purple, and pink gradients, while interface layers behave like crystalline panes that sit above the canvas.

The intended emotional tone is serene, modern, and slightly futuristic. Transparency, blur, soft borders, and subtle shadows create a sense of physical depth without making the UI heavy.

## Design principles

- Prefer translucency over opaque fills.
- Let the background provide color; keep interface surfaces mostly monochrome.
- Preserve strong contrast for readability on top of shifting gradients.
- Use spacing generously so each panel feels like a floating object.
- Create depth through blur, edge highlights, and soft diffuse shadows instead of dark stacking.

## Color system

### Core palette

| Token | Value | Role |
|---|---|---|
| `background` | `#0b1326` | Base dark atmospheric canvas |
| `surface` | `#0b1326` | Primary dark surface reference |
| `surface-container` | `#171f33` | Main contained panel background |
| `surface-container-high` | `#222a3d` | Elevated panel layer |
| `surface-container-highest` | `#2d3449` | Highest static dark surface |
| `primary` | `#ffffff` | Main foreground and high-contrast action color |
| `on-primary` | `#2f3131` | Text on white controls |
| `secondary` | `#adc9eb` | Cool accent for secondary emphasis |
| `on-surface` | `#dae2fd` | Primary text on dark glass |
| `on-surface-variant` | `#c4c7c8` | Secondary labels and metadata |
| `outline` | `#8e9192` | Edge and border guidance |
| `outline-variant` | `#444748` | Lower emphasis dividers |
| `error` | `#ffb4ab` | Error state |
| `background gradient reference` | `#1E3A8A`, `#7E22CE`, `#DB2777` | Hero/background atmospheric blend |

### Color usage

UI surfaces should rarely be fully opaque. Standard glass layers use white with low alpha, such as `rgba(255, 255, 255, 0.1)`, while elevated layers can move to `rgba(255, 255, 255, 0.2)`.

Text should remain bright and clean, usually white or high-tint silver. Semantic accents can be used for weather conditions, but they should stay translucent enough to preserve the glass effect.

## Typography

Inter is the primary typeface across display, headline, body, and label roles. The system increases weight slightly on frosted surfaces to maintain clarity against blurred and colorful backgrounds.

### Type scale

| Token | Font | Size | Weight | Line height | Letter spacing | Usage |
|---|---|---:|---:|---:|---|---|
| `display-lg` | Inter | 84px | 700 | 90px | -0.04em | Large weather readings and hero focal values |
| `headline-lg` | Inter | 32px | 600 | 40px | -0.02em | Section-leading titles |
| `headline-md` | Inter | 24px | 500 | 32px | normal | Secondary headings |
| `body-lg` | Inter | 18px | 400 | 28px | normal | Prominent body copy |
| `body-md` | Inter | 16px | 400 | 24px | normal | Standard body text |
| `label-sm` | Inter | 12px | 600 | 16px | 0.05em | Metrics, small labels, uppercase metadata |

### Type treatment

- Large numeric values should act as the main visual anchor.
- Smaller labels may use a subtle text shadow such as `0px 2px 4px rgba(0,0,0,0.15)` for contrast.
- Secondary metadata should use `on-surface-variant` rather than pure white.

## Layout and spacing

The layout follows an 8px base grid and uses floating glass containers inside generous safe areas. Space is not decorative only; it is part of the illusion that panels are suspended above the background.

### Spacing tokens

| Token | Value | Usage |
|---|---|---|
| `unit` | 8px | Base rhythm |
| `container-padding` | 24px | Outer page or shell padding |
| `card-gap` | 16px | Gaps between related cards or metrics |
| `section-margin` | 40px | Separation between larger blocks |
| `glass-padding` | 20px | Internal padding for glass cards |

### Layout guidance

- Keep outer margins at 24px or more so the background remains visible.
- Group related metrics into grids or flex rows with 16px gaps.
- Use contextual floating containers instead of rigid heavy panels.

## Radius and shape

The shape language is soft and approachable, matching the fluid background.

| Token | Value | Usage |
|---|---|---|
| `sm` | 0.25rem | Small chips and compact details |
| `DEFAULT` | 0.5rem | General purpose rounding |
| `md` | 0.75rem | Interactive rows and medium elements |
| `lg` | 1rem | Standard cards |
| `xl` | 1.5rem | Buttons, inputs, larger tactile controls |
| `full` | 9999px | Pills and fully rounded elements |

Cards should generally use 1rem rounding, while buttons and search-style controls should use `rounded-xl` for a softer tactile feel.

## Elevation and glass stack

Depth is created through blur, translucency, borders, and soft shadows rather than darker fills.

### Elevation model

- **Level 1 — Background:** Dynamic gradient field with optional subtle grain.
- **Level 2 — Standard glass card:** `backdrop-filter: blur(20px)` with `rgba(255, 255, 255, 0.1)`.
- **Level 3 — Elevated card or modal:** `backdrop-filter: blur(40px)` with `rgba(255, 255, 255, 0.2)`.

### Edge and shadow treatment

- Every glass surface should use a `1px` white border at roughly `rgba(255,255,255,0.2)`.
- A secondary inner shine on the top and left edges can reinforce the refraction effect.
- Use soft, spread shadows such as `0 8px 32px 0 rgba(0, 0, 0, 0.1)` to separate layers without visual heaviness.

## Components

### Glass cards

**Glass Card Standard**
- Background: `rgba(255, 255, 255, 0.1)`
- Text color: `primary`
- Radius: `rounded.lg`
- Padding: `spacing.glass-padding`

**Glass Card Elevated**
- Background: `rgba(255, 255, 255, 0.2)`
- Text color: `primary`
- Radius: `rounded.xl`
- Padding: `spacing.glass-padding`

### Buttons

**Primary button**
- Background: `primary`
- Text: `on-primary`
- Typography: `label-sm`
- Radius: `rounded.xl`
- Height: `48px`
- Padding: `0 24px`
- Hover reference: `primary-fixed-dim`

**Ghost button**
- Background: `rgba(255, 255, 255, 0.05)`
- Text: `primary`
- Typography: `label-sm`
- Radius: `rounded.xl`

### Inputs and list items

**Input field**
- Background: `rgba(255, 255, 255, 0.1)`
- Text: `primary`
- Typography: `body-md`
- Radius: `rounded.xl`
- Padding: `20px`
- Height: `48px`

**Interactive list item**
- Default background: `transparent`
- Radius: `rounded.md`
- Padding: `12px`
- Hover background: `rgba(255, 255, 255, 0.1)`

### Content-specific roles

- `weather-display-large` uses the `display-lg` typography token for hero weather data.
- `metric-label` uses `on-surface-variant` and `label-sm` for subdued supporting information.

## Implementation alignment

The Tailwind configuration mirrors the core primitives from the design definition: colors, typography, border radius, and spacing. Component tokens live in the design token JSON, which makes the system portable to token pipelines and design tools.

### Source alignment

| Source file | Contribution |
|---|---|
| `README-2.md` | High-level product and file overview |
| `DESIGN.md` | Canonical design language, token frontmatter, and usage guidance |
| `tailwind.config-4.js` | Utility-framework implementation of colors, type, radius, and spacing |
| `design_tokens-3.json` | Interoperable token definitions including component-level tokens |

## Usage guidance

This system is best suited for premium dashboards, weather interfaces, and data-rich surfaces where a calm emotional tone matters as much as clarity. It works especially well when the background is expressive but the foreground must remain disciplined, readable, and elegant.

When extending the system, preserve the core relationship between vibrant background energy and restrained translucent foreground surfaces. That contrast is the defining behavior of Atmospheric Glass.
