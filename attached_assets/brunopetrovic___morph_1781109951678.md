# Design System Inspired by Morph

## 1. Visual Theme & Atmosphere

Morph's design system embodies a cutting-edge, developer-focused aesthetic with a bold dark theme optimized for extended viewing and reduced eye strain. The visual language combines deep charcoal backgrounds with vibrant lime-green accents that evoke energy, precision, and technological sophistication. The system emphasizes clarity through high contrast, clean geometry, and purposeful use of negative space. A sophisticated interplay of monospace and geometric sans-serif typefaces reinforces the brand's technical credentials while maintaining accessibility. The overall atmosphere is premium yet approachable—conveying power and innovation without coldness, grounded in practical usability for complex AI engineering workflows.

**Key Characteristics**
- Deep dark backgrounds (`#0A0A0A`, `#111827`) with strategic lime-green accents (`#99D52A`, `#80EE64`)
- High-contrast, legible hierarchy supporting developer workflows
- Minimal, geometric component design with subtle depth through layered shadows
- Monospace and structured typography reinforcing technical authenticity
- Generous whitespace and breathing room between sections
- Subtle gradient glows and accent lighting emphasizing key interactions
- Premium feel through restrained color palette and intentional elevation

## 2. Color Palette & Roles

### Primary
- **Lime Accent** (`#99D52A`): Primary call-to-action buttons, highlighted text, brand emphasis, interactive state indicators
- **Bright Lime** (`#80EE64`): Secondary accent for supporting text, subtle highlights, hover states on interactive elements
- **Blue Accent** (`#3B82F6`): Tertiary interactive elements, secondary CTAs, information links

### Accent Colors
- **Sage Green** (`#ACC3A7`): Muted accent for supporting UI, secondary borders, disabled states
- **Soft Green** (`#C4E8C2`): Light accent for hover backgrounds, subtle highlights, accessibility overlays
- **Muted Olive** (`#7A8A7A`): Subdued text, tertiary accents, secondary metadata

### Interactive
- **Deep Black** (`#0A0A0A`): Interactive element backgrounds, button fills, dark container bases
- **Charcoal Dark** (`#111827`): Alternative dark background, semantic container backgrounds
- **True Black** (`#000000`): Maximum contrast text, strongest emphasis

### Neutral Scale
- **Off-White** (`#FAFAFA`): Primary text color, high-contrast body content, light interface text
- **Pure White** (`#FFFFFF`): Bright text overlay, maximum contrast elements, light accents
- **Light Gray** (`#E5E5E5`): Subtle dividers, minimal borders, low-emphasis separators

### Surface & Borders
- **Surface** (`#27272A`): Primary container backgrounds, card surfaces, content panels
- **Border Subtle** (`rgba(255, 255, 255, 0.08)`): Minimal card borders, container edges, subtle divisions
- **Border Dark** (`rgb(64, 64, 64)`): Secondary button borders, outlined elements

## 3. Typography Rules

### Font Family
**Primary: GeistPixelCircle** — Display and large headings; fallback: `'GeistPixelCircle', 'Courier New', monospace`

**Secondary: Instrument Sans** — Navigation, body text, ui labels; fallback: `'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

**Tertiary: Goga Font** — Buttons, input text, interactive elements; fallback: `'gogaFont', 'Instrument Sans', sans-serif`

**Code: ui-monospace** — Code blocks and technical content; fallback: `ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display 1 | GeistPixelCircle | 60px | 500 | 60px | 0px | Hero headlines, page titles |
| Display 2 | GeistPixelCircle | 48px | 500 | 48px | 0px | Major section headings |
| Heading 3 | Instrument Sans | 16px | 600 | 24px | 0px | Subsection headers, card titles |
| Body Large | Instrument Sans | 16px | 400 | 24px | 0px | Primary body text, links |
| Body Regular | Instrument Sans | 12px | 500 | 16px | 0px | Secondary body, descriptions |
| Button | Goga Font | 16px | 400 | 24px | 0px | Button labels, interactive text |
| Input | Goga Font | 18px | 400 | 28px | 0px | Form inputs, search fields |
| Code | ui-monospace | 12px | 400 | 16px | 0px | Code blocks, technical snippets |
| Label | Instrument Sans | 12px | 600 | 16px | 0px | Form labels, captions |
| Span Highlight | Morph Font | 18px | 600 | 28px | 0px | Emphasized inline content |

### Principles
- **Contrast First**: All text meets WCAG AA standards on assigned backgrounds; primary body text uses `#FAFAFA` on dark surfaces
- **Developer Optimized**: Monospace typography for technical content ensures consistent character width; sans-serif for UI reduces cognitive load
- **Hierarchy Through Scale**: Five distinct size steps create clear visual priority without relying on color alone
- **Readable Line Length**: Maximum 60–80 characters per line for body text; tighter for code
- **Generous Leading**: Line heights exceed font size by 1.5× for enhanced readability in dark mode

## 4. Component Stylings

### Buttons

#### Primary Button (Brand CTA)
- **Background**: `#99D52A`
- **Text Color**: `#FAFAFA`
- **Font**: Goga Font, 16px, weight 400
- **Padding**: `10px 24px`
- **Border Radius**: `8px`
- **Border**: None
- **Height**: `44px`
- **Box Shadow**: None
- **Hover State**: Background `#80EE64`, opacity 0.9
- **Active State**: Background `#99D52A`, opacity 0.8
- **Disabled State**: Background `#7A8A7A`, cursor not-allowed

#### Secondary Button (Outlined)
- **Background**: Transparent
- **Text Color**: `#99D52A`
- **Font**: Goga Font, 16px, weight 400
- **Padding**: `10px 24px`
- **Border Radius**: `8px`
- **Border**: `1px solid #99D52A`
- **Height**: `44px`
- **Box Shadow**: None
- **Hover State**: Background `rgba(153, 213, 42, 0.1)`
- **Active State**: Background `rgba(153, 213, 42, 0.2)`

#### Tertiary Button (Ghost)
- **Background**: Transparent
- **Text Color**: `#FAFAFA`
- **Font**: Instrument Sans, 16px, weight 400
- **Padding**: `0px 12px`
- **Border Radius**: `8px`
- **Border**: `1px solid #404040`
- **Height**: `32px`
- **Box Shadow**: None
- **Hover State**: Background `rgba(255, 255, 255, 0.08)`, border `#80EE64`
- **Active State**: Background `rgba(153, 213, 42, 0.15)`

#### Text Link Button
- **Background**: Transparent
- **Text Color**: `#FAFAFA`
- **Font**: Instrument Sans, 16px, weight 400
- **Padding**: `6px 8px`
- **Border Radius**: `10px`
- **Border**: None
- **Height**: Auto
- **Box Shadow**: None
- **Hover State**: Text Color `#80EE64`, background `rgba(153, 213, 42, 0.08)`
- **Underline**: On hover, text-decoration `underline`

### Cards & Containers

#### Default Card
- **Background**: Transparent or `rgba(0, 0, 0, 0.3)`
- **Text Color**: `#FFFFFF`
- **Font**: Goga Font, 16px, weight 400
- **Padding**: `32px`
- **Border Radius**: `12px`
- **Border**: `1px solid rgba(255, 255, 255, 0.08)`
- **Box Shadow**: `rgba(0, 0, 0, 0.08) 0px 12px 32px -4px, rgba(0, 0, 0, 0.08) 0px 4px 8px -2px`
- **Hover State**: Border `rgba(255, 255, 255, 0.16)`, shadow elevated

#### Premium Card (Glowing)
- **Background**: `rgba(0, 0, 0, 0.4)`
- **Text Color**: `#FFFFFF`
- **Font**: Goga Font, 16px, weight 400
- **Padding**: `40px`
- **Border Radius**: `12px`
- **Border**: `1px solid rgba(153, 213, 42, 0.2)`
- **Box Shadow**: `rgba(150, 255, 31, 0.08) 0px 100px 191px 0px, rgba(150, 255, 31, 0.05) 0px 36px 70px 0px, rgba(150, 255, 31, 0.04) 0px 18px 34px 0px, rgba(150, 255, 31, 0.03) 0px 9px 17px 0px`
- **Hover State**: Border `rgba(153, 213, 42, 0.4)`, shadow intensified

### Inputs & Forms

#### Text Input
- **Background**: `rgba(0, 0, 0, 0.2)`
- **Text Color**: `#E5E5E5`
- **Font**: Goga Font, 18px, weight 400
- **Padding**: `12px 16px`
- **Border Radius**: `8px`
- **Border**: `1px solid rgba(255, 255, 255, 0.08)`
- **Height**: `44px`
- **Line Height**: `28px`
- **Box Shadow**: None
- **Focus State**: Border `#99D52A`, box-shadow `0 0 0 3px rgba(153, 213, 42, 0.1)`
- **Placeholder Color**: `rgba(250, 250, 250, 0.4)`

#### Input Label
- **Font**: Instrument Sans, 12px, weight 600
- **Color**: `#FAFAFA`
- **Margin Bottom**: `8px`
- **Display**: Block

### Navigation

#### Nav Link (Horizontal Menu)
- **Background**: Transparent
- **Text Color**: `#FAFAFA`
- **Font**: Instrument Sans, 16px, weight 400
- **Padding**: `6px 12px`
- **Border Radius**: `6px`
- **Border**: None
- **Height**: Auto
- **Line Height**: `24px`
- **Box Shadow**: None
- **Hover State**: Background `rgba(255, 255, 255, 0.08)`, color `#80EE64`
- **Active State**: Background `rgba(153, 213, 42, 0.15)`, color `#99D52A`, font-weight `600`

#### Nav Header Logo
- **Font**: GeistPixelCircle, 18px, weight 600
- **Color**: `#FFFFFF`
- **Hover State**: Color `#80EE64`

#### Top Navigation Bar
- **Background**: `rgba(0, 0, 0, 0.4)` with backdrop filter blur `8px`
- **Height**: `64px`
- **Padding**: `16px 32px`
- **Border Bottom**: `1px solid rgba(255, 255, 255, 0.08)`
- **Box Shadow**: `rgba(0, 0, 0, 0.08) 0px 12px 32px -4px, rgba(0, 0, 0, 0.08) 0px 4px 8px -2px`

## 5. Layout Principles

### Spacing System
**Base Unit**: `4px`

**Scale**:
- `4px` — Micro gaps, icon spacing, tight inline spacing
- `8px` — Small padding, tight component spacing
- `12px` — Component padding, form field margins
- `16px` — Standard padding, section margins
- `20px` — Medium margins, subsection spacing
- `24px` — Gap between feature blocks, moderate section spacing
- `32px` — Large section margins, major container padding
- `40px` — Premium component padding, featured sections
- `48px` — Major gap between content sections
- `80px` — Hero section spacing, page-level margins
- `96px` — Large section dividers
- `128px` — Maximum spacing between major page sections

**Context**:
- Micro spacing (`4px–8px`): Icon padding, compact lists, tight layouts
- Comfortable spacing (`16px–24px`): Default UI component spacing, readable lists
- Generous spacing (`32px–48px`): Section dividers, feature blocks, breathing room
- Premium spacing (`80px–128px`): Hero sections, page-level hierarchy

### Grid & Container
**Max Width**: `1280px` for content areas; `100vw` for full-bleed hero sections

**Column Strategy**: 12-column fluid grid on desktop; 2–4 columns on tablet; single column on mobile

**Section Pattern**:
- Full-width hero with centered max-width content (`1280px`)
- Alternating left–right content blocks with `96px` vertical spacing
- 3–4 column card grids on desktop, 2 columns on tablet, 1 on mobile
- Sidebar layouts use 2-column split: 70% content, 30% sidebar (desktop only)

### Whitespace Philosophy
Whitespace is treated as an active design element rather than passive emptiness. Generous margins between sections (`48px–96px`) create visual hierarchy and reduce cognitive load. Vertical rhythm is maintained through consistent spacing multiples. Negative space around text prevents crowding and improves readability. Compact components (`32px` height buttons) contrast with open layouts to guide focus.

### Border Radius Scale
- **Sharp**: `0px` — Text inputs without focus, technical dividers
- **Subtle**: `6px` — Small UI elements, compact components
- **Standard**: `8px` — Buttons, small cards, form inputs
- **Rounded**: `10px–12px` — Large cards, prominent containers, soft appearance
- **Pill**: `9999px` — Circular badges, fully rounded buttons, avatar containers

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (0) | No shadow, transparent background | Text, icons, minimal UI |
| Raised (1) | `rgba(0, 0, 0, 0.08) 0px 4px 8px -2px` | Standard cards, navigation bars |
| Elevated (2) | `rgba(0, 0, 0, 0.08) 0px 12px 32px -4px, rgba(0, 0, 0, 0.08) 0px 4px 8px -2px` | Cards, modals, floating elements |
| Premium (3) | `rgba(150, 255, 31, 0.08) 0px 100px 191px 0px, rgba(150, 255, 31, 0.05) 0px 36px 70px 0px, rgba(150, 255, 31, 0.04) 0px 18px 34px 0px, rgba(150, 255, 31, 0.03) 0px 9px 17px 0px` | Feature highlights, brand-emphasized components |
| Deep (4) | `rgba(0, 0, 0, 0.25) 0px 25px 50px -12px` | High-priority overlays, deep modals |
| Glow (5) | `rgba(150, 255, 31, 0.06) 0px -12px 127px 0px, rgba(150, 255, 31, 0.04) 0px -4px 46px 0px` | Accent lighting, subtle glows behind elements |

**Shadow Philosophy**: Shadows employ a layered approach with multiple shadow layers at different scales to create depth without heaviness. Cool black shadows (`rgba(0, 0, 0, ...)`) ground elements; colored shadows with lime accent (`rgba(150, 255, 31, ...)`) elevate premium components and guide attention. Shadows fade away as elements move further from surfaces, creating believable light distance. The system avoids harsh drop shadows in favor of soft, atmospheric depth.

## 7. Do's and Don'ts

### Do
- **Use lime green (`#99D52A` / `#80EE64`) for all primary interactive elements** — buttons, links, important highlights — to maintain brand consistency and visual focus
- **Maintain high contrast** — pair light text (`#FAFAFA`, `#FFFFFF`) on dark backgrounds (`#0A0A0A`, `#111827`) to ensure readability and accessibility compliance
- **Apply generous spacing** — use `32px–48px` gaps between major sections to create breathing room and visual hierarchy
- **Employ subtle shadows** — use the defined elevation levels to create depth without overwhelming the interface
- **Stick to the typography hierarchy** — use GeistPixelCircle for display only, Instrument Sans for UI, Goga Font for interactive elements
- **Use semantic borders** — apply `rgba(255, 255, 255, 0.08)` for minimal, non-distracting card boundaries
- **Test on dark backgrounds** — all color choices are optimized for OLED and dark-mode displays; verify readability before shipping

### Don't
- **Avoid pure white text on dark backgrounds longer than headlines** — use `#FAFAFA` for body content to reduce eye strain in dark mode
- **Don't mix lime green with other accent colors** — the brand relies on lime's dominance; use blue (`#3B82F6`) only for secondary or tertiary interactions
- **Never use heavy, black drop shadows** — employ the defined shadow system instead; hard shadows feel dated and harsh
- **Avoid cramped spacing** — minimum `16px` gaps between distinct sections; tighter spacing feels claustrophobic in a dark theme
- **Don't apply border radius to text or code inputs unless specified** — keep these elements sharp (`0px` radius) to emphasize technical authenticity
- **Never disable the lime accent on hover states** — every interactive element must respond visibly; users expect visual feedback
- **Avoid using gray (`#ACC3A7`, `#7A8A7A`) for primary content** — reserve these muted tones for secondary metadata, disabled states, and subtle accents only
- **Don't exceed 4 distinct font families** — stick to GeistPixelCircle, Instrument Sans, Goga Font, and ui-monospace; additional typefaces dilute brand identity

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | `<640px` | Single-column layout, `16px` horizontal padding, `24px` vertical spacing, 1x button height, collapsed navigation |
| Tablet | `640px–1024px` | 2-column grids, `24px` horizontal padding, `32px` vertical spacing, hero text scales to 36px |
| Desktop | `1024px–1280px` | 3–4 column grids, `40px` horizontal padding, `48px` vertical spacing, max-width containers `1280px` |
| Wide | `>1280px` | 4–6 column grids, full spacing scale, sidebar layouts enabled, multi-column hero sections |

### Touch Targets
- **Minimum Interactive Size**: `44px × 44px` for all buttons and clickable elements
- **Comfortable Touch Area**: `48px–56px` for primary actions on mobile
- **Spacing Between Targets**: `8px` minimum to prevent accidental taps
- **Mobile Button Padding**: `10px 24px` (yields `44px` height on single-line text)
- **Desktop Button Padding**: `10px 24px` (standard across all sizes)
- **Link Hit Area**: `32px × 32px` minimum for navigation links
- **Form Inputs**: `44px` height minimum on mobile, `40px–44px` on desktop

### Collapsing Strategy
- **Hero Section**: Full-width bleed on all sizes; text scales from `60px` (desktop) → `48px` (tablet) → `32px` (mobile)
- **Card Grids**: 4 columns (desktop) → 2 columns (tablet) → 1 column (mobile) with `24px` gap shrinking to `16px` on mobile
- **Navigation**: Horizontal menu on desktop (desktop > 1024px); hamburger collapse on tablet/mobile with slide-out drawer
- **Sidebar**: Hidden on tablet/mobile; sticky on desktop (right side, 30% width)
- **Two-Column Content**: Split layout (desktop) → stacked vertically (tablet/mobile) with images flowing full-width
- **Padding Reduction**: `40px` (desktop) → `24px` (tablet) → `16px` (mobile) on major containers
- **Typography Scaling**: Scale down 1 step on tablet (e.g., h1: 60px → 48px), 2 steps on mobile (h1: 60px → 36px)
- **Spacing Compression**: Reduce `48px` gaps to `32px` on tablet, `24px` on mobile; maintain `16px` minimum

## 9. Agent Prompt Guide

### Quick Color Reference
- **Primary CTA**: Lime Accent (`#99D52A`)
- **Secondary Highlight**: Bright Lime (`#80EE64`)
- **Tertiary Interactive**: Blue Accent (`#3B82F6`)
- **Background Primary**: Deep Black (`#0A0A0A`)
- **Background Secondary**: Charcoal Dark (`#111827`)
- **Container Surface**: Surface (`#27272A`)
- **Body Text**: Off-White (`#FAFAFA`)
- **Heading Text**: Pure White (`#FFFFFF`)
- **Border Subtle**: `rgba(255, 255, 255, 0.08)`
- **Disabled / Muted**: Muted Olive (`#7A8A7A`)

### Iteration Guide

1. **All interactive elements use lime green** (`#99D52A` for fills, `#80EE64` for hover) — no exceptions for brand consistency
2. **Dark theme foundation**: Set root background to `#0A0A0A` or `#111827`; all text defaults to `#FAFAFA` or `#FFFFFF`
3. **Typography starts with 5 weights only**: Use the hierarchy table above; display = GeistPixelCircle 48–60px, UI = Instrument Sans 12–16px, interactive = Goga Font 16–18px
4. **Spacing follows the 4px scale**: Always use multiples (`4px`, `8px`, `16px`, `24px`, `32px`, `48px`, `80px`, `128px`); no arbitrary values
5. **Elevation via layered shadows**: Never use single drop shadows; apply the 6-level shadow system with multiple rgba layers
6. **Border radius: `8px` standard**, `12px` for cards/containers, `9999px` for badges only; text inputs stay `0px` to emphasize technical nature
7. **Hover states are mandatory**: Every button, link, and card must respond with background color shift or text color change; use `#80EE64` or `rgba(153, 213, 42, 0.1)` for feedback
8. **Mobile first responsive**: Start with single-column, `16px` padding, `32px` spacing; expand to grids only above `640px`; breakpoints at `640px`, `1024px`, `1280px`
9. **Contrast check**: Verify all text meets WCAG AA (`4.5:1` for body, `3:1` for large text) before shipping; default check: `#FAFAFA` on `#0A0A0A` ✓
10. **Minimal borders**: Use `1px solid rgba(255, 255, 255, 0.08)` for card/container edges; avoid `#404040` except on ghost buttons; add `rgba(153, 213, 42, 0.2)` on hover for brand emphasis