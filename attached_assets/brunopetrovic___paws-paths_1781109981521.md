# Paws & Paths Design System

## Overview

Paws & Paths is a warm, friendly design system for a dog-walking and pet care platform. It combines a premium service feel with an approachable personality, using Golden Retriever orange for action, Sky Walk blue for trust, and generous whitespace for calm, focused user flows.

This document consolidates the project overview, structured tokens, component definitions, and Tailwind-ready implementation primitives into one reference.

## Brand direction

The brand should feel optimistic, trustworthy, active, and human. Its visual style is modern corporate, but softened with pet-friendly warmth so the product feels reliable without becoming sterile.

The interface should stay light and airy. Use soft tonal layers, rounded geometry, and subtle ambient shadows instead of heavy borders or dense visual treatments.

## Design principles

- Prioritize clarity for busy pet owners.
- Use warm action colors and cool supporting colors in balance.
- Maintain generous whitespace and avoid crowding.
- Keep interaction feedback soft, tactile, and polished.
- Favor rounded forms that reinforce safety and friendliness.

## Color system

### Core palette

| Token | Value | Role |
|---|---|---|
| `background` | `#f9f9ff` | Main page background |
| `surface` | `#f9f9ff` | Primary surface tone |
| `surface-container-lowest` | `#ffffff` | White card surface |
| `surface-container-low` | `#f0f3ff` | Soft input and low-emphasis surface |
| `surface-container` | `#e7eefe` | Neutral panel background |
| `surface-container-high` | `#e2e8f8` | Hover and elevated tonal layer |
| `on-surface` | `#151c27` | Primary text |
| `on-surface-variant` | `#534434` | Secondary text and metadata |
| `primary` | `#855300` | Main action color |
| `primary-container` | `#f59e0b` | Hover and highlighted primary state |
| `secondary` | `#0058be` | Trust, navigation, and supporting emphasis |
| `secondary-container` | `#2170e4` | Strong blue data or stat surfaces |
| `tertiary` | `#00658b` | Supporting accent |
| `tertiary-container` | `#1abdff` | Badge and tertiary emphasis surface |
| `error` | `#ba1a1a` | Error state |
| `outline` | `#867461` | Border and outline tone |
| `outline-variant` | `#d8c3ad` | Subtle dividers |

### Color usage

Golden Retriever orange should drive calls to action, active states, and moments of energy. Sky Walk blue should support wayfinding, trust indicators, scheduling, and data-oriented elements.

Neutral surfaces should stay bright and premium, with deep charcoal text for legibility. Avoid overusing saturated colors in large areas; keep most layouts grounded in soft light neutrals.

## Typography

Plus Jakarta Sans is the system typeface across all roles. It brings rounded terminals, strong readability, and a more approachable character than a stricter geometric sans.

### Type scale

| Token | Font | Size | Weight | Line height | Letter spacing | Usage |
|---|---|---:|---:|---:|---|---|
| `display` | Plus Jakarta Sans | 44px | 800 | 52px | -0.02em | Major hero values and key headlines |
| `headline-lg` | Plus Jakarta Sans | 32px | 700 | 40px | -0.01em | Primary section headings |
| `headline-md` | Plus Jakarta Sans | 24px | 700 | 32px | normal | Secondary headings |
| `title-lg` | Plus Jakarta Sans | 20px | 600 | 28px | normal | Card and section titles |
| `body-lg` | Plus Jakarta Sans | 18px | 400 | 28px | normal | Large body copy |
| `body-md` | Plus Jakarta Sans | 16px | 400 | 24px | normal | Standard body copy |
| `label-md` | Plus Jakarta Sans | 14px | 600 | 20px | 0.01em | Buttons and emphasized labels |
| `label-sm` | Plus Jakarta Sans | 12px | 500 | 16px | normal | Small metadata and badges |

### Typography guidance

- Use bold headlines to guide the eye quickly.
- Keep body text spacious to preserve the premium feel.
- Use label weights for controls and compact metadata so small UI stays clear.

## Layout and spacing

The layout follows a mobile-first fixed grid, especially suited to a 4-column handheld structure. Content should stay centered and intentional, with consistent rhythm based on an 8px scale.

### Spacing tokens

| Token | Value | Usage |
|---|---|---|
| `base` | 8px | Core spacing rhythm |
| `xs` | 4px | Tight badge or micro spacing |
| `sm` | 12px | Compact internal spacing |
| `md` | 24px | Standard component padding |
| `lg` | 40px | Major block spacing |
| `xl` | 64px | Large section separation |
| `gutter` | 16px | Grid gutter |
| `margin` | 24px | Outer content margin |

### Layout guidance

- Use `lg` and `xl` spacing for vertical section separation.
- Avoid crowded screens; whitespace is part of the premium tone.
- Maintain consistent content widths so user journeys feel focused.

## Shape and radius

Rounded shapes are central to the system and should make the interface feel safe, soft, and tactile.

| Token | Value | Usage |
|---|---|---|
| `sm` | 0.25rem | Small accents |
| `DEFAULT` | 0.5rem | Inputs and general elements |
| `md` | 0.75rem | Small cards and interactive rows |
| `lg` | 1rem | Primary buttons |
| `xl` | 1.5rem | Large cards and profile containers |
| `full` | 9999px | Pills and badges |

Buttons should feel substantial with `rounded-lg`, cards should feel soft with `rounded-xl`, and inputs should stay more structured with the default radius.

## Elevation and depth

The system uses ambient shadows and tonal layering rather than dramatic contrast. Main layouts sit on very light neutral surfaces, while interactive cards rise slightly above them using white backgrounds and soft diffused shadows.

Shadows should stay subtle, with blur in the 20px to 40px range and low opacity around 4 to 8 percent. A slight orange or blue tint in shadows can help them feel cleaner and more brand-aligned.

## Components

### Buttons

**Primary button**
- Background: `primary`
- Text: `on-primary`
- Typography: `label-md`
- Radius: `rounded.lg`
- Padding: `spacing.md`
- Hover: `primary-container` with `on-primary-container`

**Secondary button**
- Background: `secondary`
- Text: `on-secondary`
- Typography: `label-md`
- Radius: `rounded.lg`
- Padding: `spacing.md`
- Hover: `secondary-container` with `on-secondary-container`

### Cards and data surfaces

**Profile card**
- Background: `surface-container-lowest`
- Radius: `rounded.xl`
- Padding: `spacing.md`

**Walk stat card**
- Background: `secondary-container`
- Text: `on-secondary-container`
- Radius: `rounded.md`
- Padding: `spacing.sm`

### Inputs and lists

**Input field**
- Background: `surface-container-low`
- Text: `on-surface`
- Typography: `body-md`
- Radius: `rounded.DEFAULT`
- Padding: `spacing.sm`

**Walker list item**
- Background: transparent
- Radius: `rounded.md`
- Padding: `spacing.sm`
- Hover: `surface-container-high`

### Badges

**Status badge**
- Background: `tertiary-container`
- Text: `on-tertiary-container`
- Typography: `label-sm`
- Radius: `rounded.full`
- Padding: `spacing.xs`

## Interaction guidance

Interactive states should feel polished but restrained. Use subtle color shifts, hover lifts, and a 150ms ease-in-out transition for feedback rather than dramatic motion.

Touch targets should remain wide and comfortable, especially in walker lists and scheduling flows. Feedback should be clear without introducing clutter.

## Implementation alignment

The Tailwind config mirrors the design primitives for color, typography, spacing, and border radius. The design token JSON extends that foundation with component-level definitions that are portable into design and token tooling.

### Source alignment

| Source file | Contribution |
|---|---|
| `README-2.md` | Product framing and file overview |
| `DESIGN.md` | Core design language, token frontmatter, and usage guidance |
| `tailwind.config-4.js` | Tailwind theme primitives for implementation |
| `design_tokens-3.json` | Portable design tokens including components |

## Recommended use

Paws & Paths is best suited for dog-walking marketplaces, pet care dashboards, booking flows, sitter profiles, and status-heavy service apps. Any extension of the system should preserve its core balance: warm action cues, calm trust-building support tones, soft rounded forms, and generous breathing room.
