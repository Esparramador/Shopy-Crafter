# Design System Inspired by Blackbox AI

## 1. Visual Theme & Atmosphere

The Blackbox AI design system embodies a **dark, technical, and cutting-edge aesthetic** tailored for enterprise AI infrastructure and autonomous coding agents. The visual language prioritizes clarity, efficiency, and developer focus through a predominantly black and neutral palette punctuated by bold accent colors—particularly a vibrant orange that signals action and innovation. The design eschews decorative elements in favor of precision, utilizing high-contrast typography, minimal shadows, and clean geometry to create an interface that feels both powerful and approachable. This is a design system for builders: it emphasizes functionality, readability in low-light environments, and rapid task execution. The sparse use of color creates visual hierarchy and draws attention to critical interactive elements, while the monospaced font usage in code contexts reinforces the technical DNA of the platform.

**Key Characteristics**
- Deep dark backgrounds (#000000, #0A0A0A, #1A1A1A) that reduce cognitive load and support 24/7 operations
- Stark contrast between neutral grays and white for maximum text legibility
- Strategic use of orange (#F05100) and cyan (#009588) accents for critical actions and status signals
- Minimal, almost invisible shadows and borders that defer to typography and spacing for hierarchy
- Monospaced fonts (Geist Mono) for code, technical labels, and system output
- Large, bold headline typography (144px, 96px) for dramatic visual presence
- Clean, rectilinear component design with pill-shaped buttons as the primary interactive pattern
- Color-coded semantic states (warning yellows, error reds, success teals) for rapid status comprehension

## 2. Color Palette & Roles

### Primary
- **Orange Accent** (`#F05100`): Primary call-to-action, button highlights, and accent branding; conveys energy and forward momentum in the agent deployment context
- **Primary Blue** (`#1447E6`): Secondary emphasis, interactive states, and technical highlights

### Accent Colors
- **Cyan/Teal** (`#009588`): Success states, status indicators, and positive system feedback
- **Dark Teal** (`#104E64`): Muted secondary information and subtle status contexts

### Interactive
- **Link Color** (`#1447E6`): Hyperlink text and interactive text elements; inherited from primary blue
- **Button Ghost Text** (`#FFFFFF`): Text on transparent or ghost buttons for clear hierarchy
- **Button Secondary** (`#FFFFFF` on dark backgrounds): Secondary action text with 60% opacity for subtle interactions

### Neutral Scale
- **Pure Black** (`#000000`): Primary text on light surfaces; used sparingly
- **Near-Black** (`#0A0A0A`): Darkest background layer, creating depth in nested UI
- **Deep Gray** (`#1A1A1A`): Primary dark background, surfaces, and containers
- **Medium Gray** (`#333333`): Inferred secondary background and subtle dividers
- **Gray** (`#555555`): Tertiary text and disabled states with reduced emphasis
- **Light Gray** (`#666666`): Body text, descriptions, and secondary content (most frequently used)
- **Lighter Gray** (`#999999`): Muted labels, hints, and de-emphasized information
- **Off-White** (`#FAFAFA`): Subtle light backgrounds or very light surfaces
- **Pure White** (`#FFFFFF`): Maximum contrast, primary headings, and critical text on dark backgrounds

### Surface & Borders
- **Surface Glass** (`rgba(152.4, 152.4, 152.4, 0.05)`): Near-transparent overlay on surfaces for depth without visual weight
- **Border Subtle** (`#333333`): Minimal borders for card and container separation; inferred from design tokens
- **Border Emphasis** (`#666666`): Stronger borders for distinct sections and input fields

### Semantic / Status
- **Warning** (`#F99C00`): Warning states and cautionary alerts
- **Warning Alternate** (`#FCBB00`): Alternative warning state for high-visibility alerts
- **Error/Danger** (`#E40014`): Critical errors, destructive actions, and system failures
- **Success** (`#009588`): Positive confirmations, completed tasks, and healthy system states

### Shadow Colors
- **Elevation Shadow** (`oklab(0.705008 0.143597 0.157306 / 0.3)`): Subtle shadow for button elevation and depth; used with 1px blur for minimal visual weight

## 3. Typography Rules

### Font Family
**Primary (UI):** `ui-sans-serif` (system sans-serif stack)
- Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`

**Secondary (Code/Technical):** `Geist Mono` (monospace)
- Fallback: `"Courier New", monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|------------|---------------|----|
| Display / H1 | ui-sans-serif | 144px | 700 | 129.6px | 0px | Hero headlines; extreme contrast for homepage hero sections |
| Display / H2 | ui-sans-serif | 96px | 700 | 91.2px | 0px | Major section headings; subdued hero text |
| Heading / H3 | ui-sans-serif | 14px | 600 | 20px | 0px | Card titles, section headers, button labels |
| Body / Paragraph | ui-sans-serif | 16px | 400 | 24px | 0px | Primary body text, descriptions, and narrative content |
| Body / Small | Geist Mono | 12px | 400 | 16px | 0px | List items, code blocks, technical annotations; monospace for developer context |
| Link / Monospace | Geist Mono | 11px | 600 | 16.5px | 0px | Terminal-style links, code references, technical commands |
| Button / Primary | ui-sans-serif | 16px | 400 | 24px | 0px | Primary action buttons; maintains readable weight at button scale |
| Button / Secondary | ui-sans-serif | 11px | 500 | 16.5px | 0px | Secondary actions and tertiary navigation |
| Button / Mono | Geist Mono | 10px | 400 | 15px | 0px | Code output, tags, badges with monospace treatment |
| Caption / Label | ui-sans-serif | 12px | 400 | 16px | 0px | Form labels, captions, and secondary metadata |

### Principles
- **Contrast First:** All text achieves WCAG AAA contrast ratios on dark backgrounds; white or near-white text (#FFFFFF, #FAFAFA) on deep backgrounds (#000000, #1A1A1A)
- **Monospace for Technical:** Code snippets, terminal output, command references, and technical identifiers use Geist Mono to signal machine-readable content
- **Weight Progression:** Typography weight increases intentionally (400 for body, 500 for secondary buttons, 600 for headers, 700 for display) to guide visual hierarchy without color alone
- **Generous Line Height:** All typography maintains at least 1.5x font size for line height to ensure readability in low-light environments and reduce eye strain during extended development sessions
- **No Letter Spacing Tweaks:** Letter spacing is uniform across the system (0px) to maintain consistency; overriding letter spacing only for display sizes if needed for premium feel

## 4. Component Stylings

### Buttons

#### Primary Button
- **Background:** `#F05100` (orange accent)
- **Text Color:** `#FFFFFF` (white)
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `12px 24px`
- **Border Radius:** `3355440px` (pill-shaped)
- **Border:** None
- **Height:** `40px`
- **Line Height:** `24px`
- **Box Shadow:** None (flat design)
- **Hover State:** Darken background to `#D94600`; opacity increase on text to full `#FFFFFF`
- **Active State:** Further darken to `#B83A00`
- **Disabled State:** Background `#555555`; text `#999999` at 50% opacity

#### Secondary Button
- **Background:** `rgba(250, 250, 250, 0.1)` (light gray with 10% opacity)
- **Text Color:** `#FFFFFF` (white)
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `12px 24px`
- **Border Radius:** `3355440px` (pill-shaped)
- **Border:** `1px solid #333333` (subtle border)
- **Height:** `40px`
- **Line Height:** `24px`
- **Box Shadow:** None
- **Hover State:** Background `rgba(250, 250, 250, 0.15)`; text stays `#FFFFFF`
- **Active State:** Background `rgba(250, 250, 250, 0.2)`

#### Ghost Button
- **Background:** `transparent`
- **Text Color:** `#FFFFFF` (white) at 70% opacity
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `0px`
- **Border Radius:** `0px`
- **Border:** None
- **Height:** `24px`
- **Line Height:** `24px`
- **Box Shadow:** None
- **Hover State:** Text color to `#FFFFFF` at 100% opacity
- **Active State:** Text color to `#F05100`

#### Pill Badge / Tag Button
- **Background:** `oklab(0.705008 0.143597 0.157306 / 0.15)` (orange with 15% opacity)
- **Text Color:** `#F05100` (orange text)
- **Font Size:** `10px`
- **Font Weight:** `400`
- **Font Family:** `Geist Mono` (monospace for technical tagging)
- **Padding:** `6px 12px`
- **Border Radius:** `3355440px` (full pill)
- **Border:** `1px solid oklab(0.705008 0.143597 0.157306 / 0.3)` (orange border at 30% opacity)
- **Height:** `auto` (min 20px)
- **Line Height:** `15px`
- **Box Shadow:** `oklab(0.705008 0.143597 0.157306 / 0.3) 0px 0px 0px 1px` (subtle inset border effect)

#### Icon Button
- **Background:** `transparent`
- **Text Color:** `#FFFFFF` at 60% opacity
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `0px`
- **Border Radius:** `0px`
- **Border:** None
- **Height:** `24px`
- **Width:** `24px`
- **Line Height:** `24px`
- **Box Shadow:** None
- **Hover State:** Text color to `#FFFFFF` at 100%

### Cards & Containers

#### Default Card
- **Background:** `rgba(250, 250, 250, 0.05)` (near-transparent white overlay on dark)
- **Text Color:** `#FFFFFF` (white)
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `32px 24px` (inferred from layout patterns)
- **Border Radius:** `8px`
- **Border:** `1px solid rgba(255, 255, 255, 0.08)` (subtle light border)
- **Box Shadow:** None (flat, minimalist approach)
- **Min Height:** `200px`

#### Dark Container
- **Background:** `#0A0A0A` (near-black for nested content)
- **Text Color:** `#FFFFFF`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `24px`
- **Border Radius:** `0px` (sharp corners for code/terminal contexts)
- **Border:** `1px solid #333333`
- **Box Shadow:** None

#### Section Container
- **Background:** `#1A1A1A` (deep gray base)
- **Text Color:** `#FFFFFF`
- **Padding:** `96px 40px` (large hero sections) to `60px 24px` (content sections)
- **Border Radius:** `0px`
- **Border:** None

### Inputs & Forms

#### Text Input Default
- **Background:** `rgba(0, 0, 0, 0.3)` (semi-transparent dark overlay)
- **Text Color:** `#FFFFFF` at 70% opacity
- **Font Size:** `12px`
- **Font Weight:** `400`
- **Font Family:** `Geist Mono` (code context)
- **Padding:** `8px 12px`
- **Border Radius:** `4px`
- **Border:** `1px solid #333333`
- **Height:** `32px`
- **Line Height:** `16px`
- **Box Shadow:** None
- **Placeholder Color:** `#666666` at 50% opacity

#### Text Input Focus
- **Border Color:** `#F05100` (orange highlight)
- **Border Width:** `2px`
- **Text Color:** `#FFFFFF` at 100%
- **Box Shadow:** `0 0 0 2px rgba(240, 81, 0, 0.1)` (soft orange glow)

#### Text Input Disabled
- **Background:** `#0A0A0A`
- **Text Color:** `#666666` at 50% opacity
- **Border Color:** `#333333`
- **Cursor:** `not-allowed`

### Navigation

#### Header Navigation
- **Background:** `transparent` (overlaid on dark)
- **Text Color:** `#FFFFFF`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Padding:** `16px 24px` (inline items)
- **Border Radius:** `0px`
- **Border:** None
- **Height:** `auto`
- **Line Height:** `24px`

#### Navigation Link (Default)
- **Text Color:** `#FFFFFF` at 70% opacity
- **Font Size:** `12px`
- **Font Weight:** `500`
- **Hover State:** Text color to `#FFFFFF` at 100%; optional underline `#F05100`
- **Active State:** Text color to `#F05100`; bottom border `2px solid #F05100`

#### Navigation Link (Secondary)
- **Text Color:** `#999999`
- **Font Size:** `11px`
- **Font Weight:** `400`
- **Hover State:** Text color to `#FFFFFF`

## 5. Layout Principles

### Spacing System

**Base Unit:** `8px`

**Spacing Scale:**
- `4px` — Micro spacing for gaps between tightly related elements (badge internal gaps, tight component pairs)
- `8px` — Tight padding for form inputs, small buttons, and compact list items
- `12px` — Padding for medium-density components and section gaps
- `16px` — Standard padding for cards, containers, and modal interiors; default vertical rhythm
- `20px` — Comfortable padding for feature sections and relaxed components
- `24px` — Large gap between major sections and padding for prominent cards
- `32px` — Extra-large margin between distinct content zones
- `40px` — Padding for full-width hero sections and main container sides
- `60px` — Large padding for hero sections and top-level container spacing
- `96px` — Maximum padding for full-screen hero backgrounds and page-level sections

**Usage Context:**
- Form inputs and tight UI: `8px`
- Card padding: `16px` to `24px`
- Section gaps: `24px` to `32px`
- Hero padding: `60px` to `96px`

### Grid & Container

**Max Width:** `1400px` (inferred from Blackbox design; full-width sections with contained inner content)

**Column Strategy:** 
- Desktop (1200px+): 12-column grid with `24px` gutters
- Tablet (768px–1199px): 8-column grid with `16px` gutters
- Mobile (< 768px): 4-column grid with `12px` gutters

**Section Patterns:**
- Full-width hero with centered content container
- Multi-column feature sections (3 columns on desktop, 2 on tablet, 1 on mobile)
- Sidebar + main content (25% / 75% split on desktop)
- Stacked card layouts with uniform width on grid

### Whitespace Philosophy

The design system prioritizes **breathing room** and **visual clarity** through deliberate whitespace. Large, uncluttered backgrounds (#1A1A1A, #000000) provide cognitive rest between interactive elements. Padding and margins follow the `8px` base scale to create rhythm without feeling sparse. Typography size and weight substitutes for decorative elements; blank space is leveraged to draw focus rather than borders or background colors. This minimalist approach supports the 24/7 operational context of the platform—users can sustain attention without visual fatigue.

### Border Radius Scale

- `0px` — Terminal windows, code blocks, sharp-cornered technical containers, and structural dividers
- `3px` — Input fields and small form elements (inferred minimal radius)
- `4px` — Standard form inputs, small cards, and tertiary containers
- `8px` — Medium cards, tooltips, and dropdown menus
- `3355440px` (pill-shaped, infinity radius) — All buttons (primary, secondary, ghost, tags) and badge elements; signals interactivity and forward momentum

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (L0) | No shadow; transparent or minimal background | Primary background surfaces, body text areas |
| Subtle (L1) | `0px 1px 2px rgba(0, 0, 0, 0.1)` | Input fields, small buttons, tertiary components |
| Raised (L2) | `0px 2px 8px rgba(0, 0, 0, 0.2)` | Cards, modals, popovers, dropdown menus |
| Floating (L3) | `0px 8px 24px rgba(0, 0, 0, 0.3)` | Top-level modals, floating action buttons, prominent overlays |
| Deep (L4) | `0px 12px 32px rgba(0, 0, 0, 0.4)` | Full-screen dialogs, deepest overlays, contextual help panels |

**Shadow Philosophy:**

The design system employs **minimal, almost invisible shadows** to maintain the dark, technical aesthetic while preserving depth hierarchy. Shadows use pure black with opacity scaling (10%–40%) rather than colored shadows, which would introduce visual noise into the dark interface. The primary elevation technique is **background color differentiation**—layering dark tones (#0A0A0A on #1A1A1A on #000000) rather than relying on shadows. This approach preserves the flat, modern look while allowing users to quickly distinguish interactive surfaces. Buttons and badges use a **1px border shadow** (`oklab(0.705008 0.143597 0.157306 / 0.3) 0px 0px 0px 1px`) to create a subtle inset effect without traditional shadows, signaling interactivity without visual clutter.

## 7. Do's and Don'ts

### Do
- **Use orange (#F05100) sparingly for primary actions only.** Every button and call-to-action should feel intentional and high-stakes.
- **Leverage monospace (Geist Mono) for all code, terminal output, and technical labels.** This creates a visual distinction between human-readable text and machine-readable content.
- **Maintain pure white (#FFFFFF) or off-white (#FAFAFA) text on dark backgrounds for maximum accessibility.** Test contrast ratios to ensure WCAG AAA compliance.
- **Apply the 8px spacing scale consistently.** Use multiples of 8px for padding, margins, and gaps to maintain visual rhythm.
- **Use pill-shaped buttons (3355440px radius) for all interactive buttons.** This signals forward momentum and aligns with the Blackbox brand.
- **Pair status colors (green #009588, yellow #FCBB00, red #E40014) with icons or text labels.** Never rely on color alone for status indication.
- **Preserve the dark background hierarchy:** #000000 (deepest) → #0A0A0A → #1A1A1A → #333333 (lightest dark).
- **Use semantic color names** (Warning, Error, Success) when implementing. Map these to hex values for consistency.
- **Keep borders minimal and subtle.** Use `#333333` or `rgba(255, 255, 255, 0.08)` instead of high-contrast strokes.
- **Reserve large typography (144px, 96px) for hero headings only.** Excessive use dilutes impact.

### Don't
- **Don't use red (#E40014) for non-critical states.** Reserve error red for genuine failures and destructive actions only.
- **Don't apply multiple shadow layers.** One shadow per elevation level; multiple shadows create visual noise.
- **Don't mix sans-serif and monospace arbitrarily.** Use sans-serif for UI copy; reserve monospace for code and technical content.
- **Don't use gray text (#666666) for primary headings or CTAs.** Gray is for secondary, tertiary, or disabled content.
- **Don't break the 8px spacing scale.** Irregular spacing values (e.g., 13px, 18px) fragment the visual grid.
- **Don't use light backgrounds (#FAFAFA) without careful contrast testing.** Ensure text remains legible against any background.
- **Don't apply border radius to code blocks or terminal windows.** Sharp corners (#0px radius) reinforce technical, machine contexts.
- **Don't add decorative elements (gradients, patterns, illustrations) to the dark interface.** The typography and color are the decoration.
- **Don't use more than 3 accent colors per page.** Limit to orange (#F05100) for primary actions, cyan (#009588) for success, and red (#E40014) for errors.
- **Don't shrink button hit targets below 40px height.** Maintain minimum 40px for all primary interactive elements to support touch and mouse users.

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | < 480px | Single-column layouts; 4px–8px padding; typography size reduced by 1 step; buttons full-width; hero padding 32px |
| Tablet Small | 480px–767px | 2-column grid; 12px padding; 16px body text; compact navigation with hamburger menu; hero padding 48px |
| Tablet | 768px–1023px | 8-column grid; 16px padding; standard typography; sidebar navigation collapses; section gaps 20px |
| Laptop | 1024px–1279px | 12-column grid with 24px gutters; full navigation; 3-column feature grids; standard spacing |
| Desktop | 1280px+ | Max-width 1400px container; full-width hero sections; expanded card layouts; maximum 96px padding |
| Large Display | 1920px+ | Optional full-screen displays; 120px padding on hero sections; 4+ column grids |

### Touch Targets

- **Minimum Size:** `44px × 44px` (mobile navigation buttons, action buttons)
- **Recommended Size:** `48px × 48px` (primary CTAs on mobile)
- **Button Height:** `40px` minimum on desktop; `44px` on mobile
- **Link Padding:** `12px` vertical and horizontal for increased touch area
- **Spacing Between Targets:** Minimum `8px` gap to prevent accidental taps
- **Form Input Height:** `40px` on mobile; `32px` acceptable on desktop with sufficient padding

### Collapsing Strategy

- **Hero Typography:** Display headings (144px, 96px) scale down to 64px on tablet, 48px on mobile; body text remains 16px minimum for readability
- **Multi-Column to Single:** Feature sections and card grids collapse from 3 columns (desktop) → 2 columns (tablet) → 1 column (mobile)
- **Navigation:** Horizontal header navigation collapses to hamburger menu icon on tablets; full menu re-expands on landscape tablet
- **Padding & Spacing:** Hero padding scales from 96px (desktop) → 60px (tablet) → 32px (mobile); section gaps reduce from 32px to 24px on tablet, 16px on mobile
- **Sidebar Layout:** Sidebar + main content switches to stacked layout below 1024px; sidebar appears above or below main content depending on context
- **Card Widths:** Cards expand to full container width on mobile; maintain max-width 400px on tablet for readability
- **Typography Sizes:** Invert scale on mobile for prominence: H1 48px → 40px on mobile; body 16px → 14px on mobile; labels 12px → 11px on mobile

## 9. Agent Prompt Guide

### Quick Color Reference

Use this condensed mapping for rapid implementation:

- **Primary CTA:** Orange (`#F05100`) — applies to all primary buttons, hero accents, active navigation
- **Secondary CTA:** Blue (`#1447E6`) — applies to secondary links and emphasis
- **Success/Positive:** Cyan (`#009588`) — applies to success badges, positive status indicators
- **Warning:** Yellow (`#F99C00` or `#FCBB00`) — applies to caution states and warnings
- **Error/Critical:** Red (`#E40014`) — applies to errors, destructive actions, failures only
- **Heading Text:** White (`#FFFFFF`) — all headings on dark backgrounds
- **Body Text:** Gray (`#666666`) — primary body copy and descriptions
- **Secondary Text:** Light Gray (`#999999`) — muted labels, hints, and de-emphasized content
- **Background (Primary):** Deep Gray (`#1A1A1A`) — main surface background
- **Background (Nested):** Near-Black (`#0A0A0A`) — code blocks, terminal windows, nested containers
- **Background (Hero):** Pure Black (`#000000`) — maximum contrast for hero sections
- **Borders:** Subtle Gray (`#333333`) — minimal, understated borders; use sparingly
- **Disabled State:** Medium Gray (`#555555`) text on dark background; reduce opacity to 50%

### Iteration Guide

Follow these rules in order of precedence for consistent implementation:

1. **All buttons are pill-shaped** (border-radius: 3355440px). Primary buttons use orange (#F05100) background. Secondary buttons use transparent background with light border. Ghost buttons are text-only with white text at reduced opacity.

2. **Monospace font (Geist Mono) signals technical content.** Use for code snippets, terminal output, command examples, and technical labels. Use sans-serif (ui-sans-serif) for all UI copy, headings, and prose.

3. **Maintain the dark background hierarchy:** #000000 (hero backgrounds) > #0A0A0A (code/terminal) > #1A1A1A (primary surfaces) > #333333 (subtle dividers). Never invert this order.

4. **Typography follows strict scale:** 144px / 96px (display) → 32px (large heading) → 24px (medium heading) → 16px (body) → 12px (caption/small) → 10px (micro/badge). Do not add intermediate sizes.

5. **Spacing uses 8px base unit.** All padding, margins, and gaps must be multiples of 8px (8, 16, 24, 32, 40, 60, 96). Never use odd values like 13px, 18px, or 27px.

6. **Status colors require icons or text labels.** Never communicate status (success, warning, error) through color alone. Pair green (#009588), yellow (#F99C00), or red (#E40014) with a glyph or text descriptor.

7. **Borders are minimal and use 1px width.** Border color is either `#333333` (strong) or `rgba(255, 255, 255, 0.08)` (subtle). Never use high-contrast strokes like white (#FFFFFF) on black.

8. **Shadows are nearly invisible.** Use black with opacity (`rgba(0, 0, 0, 0.1–0.3)`) rather than colored shadows. For buttons and badges, prefer a 1px border effect (`oklab(0.705008 0.143597 0.157306 / 0.3) 0px 0px 0px 1px`) over traditional shadows.

9. **Form inputs use compact styling:** 32px height, 8px internal padding, `rgba(0, 0, 0, 0.3)` background, 1px `#333333` border, Geist Mono font at 12px. Focus state adds 2px orange (#F05100) border with soft glow.

10. **White text (#FFFFFF) on all dark backgrounds.** Test contrast; aim for WCAG AAA (7:1 ratio minimum). Reduce opacity to 70% for secondary text, 50% for disabled states, 30% for placeholders.

11. **Hero sections use extreme typography** (144px–96px headings) with large padding (60px–96px) on dark backgrounds. Reserve this scale for primary messaging only; do not repeat on secondary pages.

12. **Cards and containers use subtle 5% opacity overlays** (`rgba(250, 250, 250, 0.05)`) to create visual separation from background. Add minimal 1px border (`rgba(255, 255, 255, 0.08)`) if needed for clarity.