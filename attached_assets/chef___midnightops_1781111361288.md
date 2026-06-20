# MidnightOps Design System

## Overview

MidnightOps is a pitch-dark, multi-layered design system engineered for OLED screens and night-shift productivity. Starting from pure black (#000000), it builds elevation through incremental surface layers, creating depth without light. Designed for dark-mode-first productivity tools, it uses blue, green, and amber as functional signal colors against an ink-black canvas. Every pixel of brightness is earned and intentional.

---

## Colors

- **Blue** (#3B82F6): Primary actions, links
- **Green** (#22C55E): Success, active, online
- **Amber** (#F59E0B): Warnings, starred, important
- **Surface 0** (#000000): OLED base background
- **Surface 1** (#0A0A0A): Slightly raised panels
- **Surface 2** (#141414): Cards, sidebars
- **Surface 3** (#1E1E1E): Modals, dropdowns
- **Surface 4** (#282828): Hover states, tooltips
- **Success** (#22C55E): Active, online, complete
- **Warning** (#F59E0B): Due soon, starred
- **Error** (#EF4444): Failed, offline, overdue
- **Info** (#3B82F6): Informational

## Typography

- **Headline Font**: Albert Sans
- **Body Font**: DM Sans
- **Mono Font**: JetBrains Mono

- **h1**: Albert Sans 28px bold, 1.2 line height
- **h2**: Albert Sans 24px semibold, 1.25 line height
- **h3**: Albert Sans 20px semibold, 1.3 line height
- **h4**: Albert Sans 16px medium, 1.35 line height
- **body**: DM Sans 14px regular, 1.6 line height
- **small**: DM Sans 12px regular, 1.5 line height
- **tiny**: DM Sans 11px medium, 1.4 line height
- **mono**: JetBrains Mono 13px regular, 1.5 line height

---

## Spacing

Base unit: 4px (compact)
- **sp-1**: 2px
- **sp-2**: 4px
- **sp-3**: 8px
- **sp-4**: 12px
- **sp-5**: 16px
- **sp-6**: 24px
- **sp-7**: 32px
- **sp-8**: 48px

## Border Radius

- **radius-sm** (4px): Chips, badges
- **radius-md** (8px): Cards, inputs, buttons
- **radius-lg** (12px): Modals
- **radius-pill** (9999px): Status dots, tags

## Elevation (Dark Layered Surfaces)

MidnightOps does not use traditional box-shadows. Elevation is expressed through the layered surface system: surface-0 (0dp) through surface-4 (4dp). Each step adds `#0A` of brightness.
- **surface-0**: surface-0. Page background.
- **surface-1**: surface-1. Sidebars, navbars.
- **surface-2**: surface-2. Cards, list groups.
- **surface-3**: surface-3. Modals, popovers.
- **surface-4**: surface-4. Tooltips, hover fills.

## Components

### Buttons
#### Primary (Blue)
blue (#3B82F6) fill, #FFFFFF text, no border, radius-md (8px) corners. Hover: background #2563EB. Active: background #1D4ED8.
#### Secondary
surface-2 (#141414) fill, content-primary text, 1px border-strong border, radius-md corners. Hover: background surface-3.
#### Ghost
transparent, content-secondary text, no border. Hover: background surface-2.
#### Destructive
error (#EF4444) fill, #FFFFFF text, no border. Hover: background #DC2626.
#### Sizes
Sizes: Small (4px 10px, 12px, 28px), Medium (6px 14px, 13px, 34px), Large (8px 20px, 14px, 40px).
#### Disabled State
0.3 opacity.
- disabled cursor
---

### Cards
#### Default
surface-2 (#141414) fill, 1px border-default border, radius-md (8px) corners. sp-5/(16px) padding.
#### Elevated
surface-3 (#1E1E1E) fill, 1px border-strong border, radius-md corners. sp-5 padding.
---

### Inputs
surface-1 (#0A0A0A) fill, content-primary text, 1px border-default border, radius-md (8px) corners. DM Sans 14px regular. 6px/12px padding.
- **Default**: border-default border color.
- **Hover**: border-strong border color.
- **Focus**: border-blue border color, ring: 1px ring #3B82F6 other.
- **Error**: error border color, ring: 1px ring #EF4444 other.
- **Disabled**: border-default border color, 30% opacity other.
#### Label
content-secondary text. DM Sans 12px medium. 4px margin-bottom.
#### Helper Text
content-tertiary (default) | error (error state) text. DM Sans 11px regular. 2px margin-top.
---

### Chips
#### Filter Chip
surface-2 fill, content-secondary text, 1px border-default border, radius-pill corners. 2px/10px padding. Active: background blue, text #FFFFFF, border transparent.
#### Status Chip
radius-pill corners. 11px medium. 2px/8px padding.
- **Online**: #22C55E at 15% fill, #22C55E text.
- **Away**: #F59E0B at 15% fill, #F59E0B text.
- **Offline**: #EF4444 at 15% fill, #EF4444 text.
- **Busy**: #3B82F6 at 15% fill, #3B82F6 text.
---

### Lists
transparent, content-secondary, 14px text. 1px border-default divider, 8px 12px item padding, status dots, timestamps, chevrons trailing elements. Hover: background surface-2. Active: background surface-3.
---

### Checkboxes
16px x 16px, 1px border-strong border, 4px corners. surface-1 unchecked background, blue checked background, #FFFFFF, 2px stroke checkmark. Focus: 1px ring #3B82F6. Disabled: 30% opacity.
---

### Radio Buttons
16px x 16px, 1px border-strong border. circle shape. Unchecked: surface-1 fill. Selected: blue border, inner dot 6px blue. Focus: 1px ring #3B82F6. Disabled: 30% opacity.
---

### Tooltips
surface-4 (#282828) fill, content-primary, 12px text, radius-sm (4px) corners, 1px border-strong border. 4px/8px padding, 4px, matching background arrow, 200px max width, 200ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use pure black (#000000) as the base -- this is designed for OLED screens where black pixels are truly off.
2. **Don't** skip surface layers; always step through `surface-0` to `surface-4` sequentially for logical elevation.
3. **Do** keep components compact; this is a productivity system where information density matters.
4. **Don't** use colored backgrounds on large areas; color is reserved for small functional indicators.
5. **Do** use content-primary (#E5E5E5) instead of pure white for text to reduce eye strain.
6. **Don't** use shadows or glows; the layered surface system handles all elevation.
7. **Do** support keyboard navigation with visible blue focus rings on every interactive element.
8. **Do** use amber for "important" and "starred" items consistently throughout the interface.
9. **Don't** mix green-for-success and green-for-online in the same view without clear context labels.
10. **Do** test all surfaces on OLED displays to verify that #000000 base renders as true black.