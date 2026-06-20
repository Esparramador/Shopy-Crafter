# ArchLine Design System

## Overview

ArchLine is a geometric, precise, and blueprint-inspired design system built for architecture and industrial design portfolios. It draws on drafting traditions with sharp edges, structured grids, and a restrained palette that evokes technical precision. Every element is designed to showcase spatial work with clarity and professionalism. The system prioritizes content hierarchy through typography and whitespace rather than decorative embellishment.

---

## Colors

- **Primary** (#1E40AF): Blueprint Blue — anchors CTAs, links, key UI elements
- **Secondary** (#9CA3AF): Concrete — supporting text, dividers, metadata
- **Tertiary** (#111827): Ink — headings, primary text, high-contrast elements
- **Background** (#FFFFFF): Page background
- **Surface** (#F9FAFB): Card and panel fills
- **Success** (#16A34A): Confirmed states, valid inputs
- **Warning** (#CA8A04): Caution alerts, draft status
- **Error** (#DC2626): Validation errors, destructive
- **Info** (#2563EB): Informational banners, tips

## Typography

- **Headline Font**: Spectral
- **Body Font**: Raleway
- **Mono Font**: IBM Plex Mono

- **Display**: Spectral 48px bold, 1.1 line height, 0.02em tracking
- **Headline**: Spectral 32px semibold, 1.2 line height, 0.01em tracking
- **Subhead**: Spectral 24px semibold, 1.3 line height
- **Body Large**: Raleway 18px regular, 1.6 line height
- **Body**: Raleway 16px regular, 1.6 line height
- **Body Small**: Raleway 14px regular, 1.5 line height, 0.01em tracking
- **Caption**: Raleway 12px medium, 1.4 line height, 0.02em tracking
- **Overline**: Raleway 11px semibold, 1.4 line height, 0.08em tracking
- **Code**: IBM Plex Mono 14px regular, 1.6 line height

---

## Spacing

- **Base unit:** Fibonacci sequence
- **Scale:** `4px / 8px / 12px / 20px / 32px / 52px / 84px`
- **Component padding:** Buttons `12px 20px`, Cards 20px, Inputs `8px 12px`
- **Section spacing:** 52px between major sections, 84px for hero-to-content gaps
- **Grid gutter:** 20px standard, 32px wide

## Border Radius

- **None** (0px): All elements — sharp geometric aesthetic
- **Small** (0px): Identical to None
- **Medium** (0px): Identical to None
- **Large** (0px): Identical to None
- **XL** (0px): Identical to None
- **Full** (9999px): Reserved only for status indicators

## Elevation

ArchLine uses a flat design with borders instead of shadows for elevation.
- **Subtle**: None (use 1px #E5E7EB). Cards, containers.
- **Medium**: None (use 1px #9CA3AF). Active panels, hover states.
- **Large**: None (use 2px #1E40AF). Focus states, selected items.
- **Overlay**: 1px ring #111827 at 8%. Modal backdrop borders.
- **Blueprint**: inset 1px ring #1E40AF. Blueprint-style inset frames.

## Components

### Buttons
- **Primary**: #1E40AF fill, #FFFFFF text, 1px #1E40AF border. Hover: #1E3A8A bg.
- **Secondary**: Transparent fill, #1E40AF text, 1px #1E40AF border. Hover: #EFF6FF bg.
- **Ghost**: Transparent fill, #4B5563 text, no border. Hover: #F3F4F6 bg.
- **Destructive**: #DC2626 fill, #FFFFFF text, 1px #DC2626 border. Hover: #B91C1C bg.
- **Sizes**: Small `32px h / 12px 16px pad`, Medium `40px h / 12px 20px pad`, Large `48px h / 12px 32px pad`
- **Disabled**: 40% opacity, disabled cursor, no hover state change

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, no shadow. Hover: border-color: #9CA3AF.
- **Elevated**: #FFFFFF fill, 2px #E5E7EB border, no shadow. Hover: border-color: #1E40AF.
Padding: 20px. Internal spacing follows Fibonacci scale.

### Inputs
- **Default**: 1px #E5E7EB border, #FFFFFF fill, #4B5563 label color.
- **Hover**: 1px #9CA3AF border, #FFFFFF fill, #4B5563 label color.
- **Focus**: 2px #1E40AF border, #FFFFFF fill, #1E40AF label color.
- **Error**: 2px #DC2626 border, #FFFFFF fill, #DC2626 label color.
- **Disabled**: 1px #E5E7EB border, #F9FAFB fill, #9CA3AF label color.
** Raleway 14px/500, positioned above the input with 4px gap **label, ** Raleway 12px/400 in #6B7280, error helper in #DC2626 **helper text.

### Chips
- **Filter**: #F3F4F6 fill, #4B5563 text, 1px #E5E7EB border.
- **Status**: varies fill, varies text, 1px matching semantic color border.
Status chip backgrounds use 10% opacity of their semantic color.

### Lists
Raleway 16px/400, secondary metadata in #9CA3AF text. 48px row height, 1px #E5E7EB divider, #F9FAFB hover background, left 2px #1E40AF border accent active/selected.

### Checkboxes
18px square, 1px #9CA3AF border. 8px label gap. Checked: #1E40AF fill, white checkmark. Indeterminate: #1E40AF fill, white dash. Disabled: #F3F4F6 fill, #9CA3AF border.

### Radio Buttons
18px circle, 1px #9CA3AF border. 8px label gap. Selected: #1E40AF outer ring, #1E40AF inner dot (6px). Disabled: #F3F4F6 fill, #9CA3AF border.

### Tooltips
#111827 fill, #FFFFFF, Raleway 12px/400 text, 0px (sharp, matching system) border radius. `4px/8px` padding, 6px CSS triangle arrow, 240px max width.
---

## Do's and Don'ts

1. **Do** maintain sharp 0px radii across all elements to preserve the blueprint aesthetic.
2. **Do** use the Fibonacci spacing scale consistently for all layout decisions.
3. **Do** rely on borders rather than shadows to create visual hierarchy.
4. **Don't** introduce rounded corners; they undermine the architectural precision.
5. **Don't** use more than two font weights in a single component.
6. **Don't** override semantic colors for decorative purposes.
7. **Do** use generous whitespace to let portfolio images breathe.
8. **Don't** add gradients or decorative backgrounds; the system is deliberately flat.
9. **Do** pair Blueprint Blue with Ink for maximum contrast on key actions.
10. **Don't** mix spacing values outside the defined Fibonacci scale.