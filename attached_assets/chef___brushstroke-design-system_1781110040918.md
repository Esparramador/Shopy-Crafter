# BrushStroke Design System

## Overview

BrushStroke is a textured, organic, and hand-made design system crafted for illustrators and fine artists. It embraces warmth and imperfection with a cream-toned canvas, earthy palette, and handwritten headline typography. Every component feels approachable and artisanal, as if sketched before being rendered. The system prioritizes the artist's work above all else, keeping the UI inviting but never competing with the art.

---

## Colors

- **Primary** (#B45309): Burnt Sienna — CTAs, links, accent elements
- **Secondary** (#65A30D): Olive — tags, success adjacent, nature tones
- **Tertiary** (#7E22CE): Plum — highlights, premium badges, creative accents
- **Background** (#FFFDF7): Warm paper-like page backdrop
- **Surface** (#FEF9EF): Card fills, content areas
- **Success** (#16A34A): Confirmed uploads, valid inputs
- **Warning** (#D97706): Draft alerts, size warnings
- **Error** (#DC2626): Validation errors, failed uploads
- **Info** (#2563EB): Tips, informational banners

## Typography

- **Headline Font**: Kalam
- **Body Font**: DM Sans
- **Mono Font**: Source Code Pro

- **Display**: Kalam 48px bold, 1.2 line height
- **Headline**: Kalam 36px bold, 1.25 line height
- **Subhead**: Kalam 24px regular, 1.3 line height
- **Body Large**: DM Sans 18px regular, 1.65 line height, 0.01em tracking
- **Body**: DM Sans 16px regular, 1.65 line height, 0.01em tracking
- **Body Small**: DM Sans 14px regular, 1.5 line height, 0.01em tracking
- **Caption**: DM Sans 12px medium, 1.4 line height, 0.02em tracking
- **Overline**: DM Sans 11px bold, 1.4 line height, 0.1em tracking
- **Code**: Source Code Pro 14px regular, 1.6 line height

---

## Spacing

- **Base unit:** 8px
- **Scale:** `4px / 8px / 16px / 24px / 32px / 48px / 64px / 96px`
- **Component padding:** Buttons `12px 24px`, Cards 24px, Inputs `10px 16px`
- **Section spacing:** 64px between sections, 96px for hero gaps
- **Grid gutter:** 24px standard

## Border Radius

- **None** (0px): Rare — only for sharp overlays
- **Small** (8px): Chips, small badges
- **Medium** (12px): Inputs, buttons
- **Large** (16px): Cards, modals, panels
- **XL** (24px): Image containers, hero cards
- **Full** (9999px): Avatars, round icons

## Elevation

- **Subtle**: 1px offset, 3px blur, #292524 at 6%. Cards at rest.
- **Medium**: 4px offset, 12px blur, #292524 at 8%. Hovered cards, dropdowns.
- **Large**: 12px offset, 32px blur, #292524 at 12%. Modals, lightbox overlays.
- **Overlay**: 9999px ring #292524 at 30%. Backdrop behind modals.
- **Brushed**: 2px 3px 0 #B45309 at 15%. Hand-drawn offset shadow effect.

## Components

### Buttons
- **Primary**: #B45309 fill, #FFFFFF text, no border. Hover: #92400E bg.
- **Secondary**: #FEF9EF fill, #B45309 text, 1px #B45309 border. Hover: #FDF4E0 bg.
- **Ghost**: Transparent fill, #57534E text, no border. Hover: #FEF9EF bg.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border. Hover: #B91C1C bg.
- **Sizes**: Small `32px h / 8px 16px pad`, Medium `40px h / 12px 24px pad`, Large `48px h / 16px 32px pad`
- **Disabled**: 45% opacity, disabled cursor, no hover state change

### Cards
- **Default**: #FEF9EF fill, 1px #E7E5E4 border, 1px offset, 3px blur, #292524 at 6% shadow. Hover: shadow transitions to Medium.
- **Elevated**: #FFFDF7 fill, no border, 4px offset, 12px blur, #292524 at 8% shadow. Hover: shadow transitions to Large.
Padding: 24px. Border radius: 16px.

### Inputs
- **Default**: 1px #E7E5E4 border, #FFFDF7 fill, #57534E label color.
- **Hover**: 1px #A8A29E border, #FFFDF7 fill, #57534E label color.
- **Focus**: 2px #B45309 border, #FFFDF7 fill, #B45309 label color.
- **Error**: 2px #DC2626 border, #FFFDF7 fill, #DC2626 label color.
- **Disabled**: 1px #E7E5E4 border, #F5F5F4 fill, #A8A29E label color.
** DM Sans 14px/500, positioned above with 4px gap **label, ** DM Sans 12px/400 in #78716C, error helper in #DC2626 **helper text.

### Chips
- **Filter**: #FDF4E0 fill, #57534E text, 1px #E7E5E4 border, 8px radius.
- **Status**: varies fill, varies text, no border, 8px radius.
Status chips use 15% opacity of their semantic color as background.

### Lists
DM Sans 16px/400, secondary metadata in #A8A29E text. 52px row height, 1px #E7E5E4 divider, #FEF9EF hover background, left 3px #B45309 accent active/selected.

### Checkboxes
20px square, 16px radius (soft square), 1px #A8A29E border. 8px label gap. Checked: #B45309 fill, white checkmark. Indeterminate: #B45309 fill, white dash. Disabled: #F5F5F4 fill, #D6D3D1 border.

### Radio Buttons
20px circle, 1px #A8A29E border. 8px label gap. Selected: #B45309 outer ring, #B45309 inner dot (8px). Disabled: #F5F5F4 fill, #D6D3D1 border.

### Tooltips
#292524 fill, #FFFDF7, DM Sans 12px/400 text, 8px border radius, 4px offset, 12px blur, #292524 at 15% shadow. `6px/12px` padding, 6px CSS triangle arrow, 260px max width.
---

## Do's and Don'ts

1. **Do** embrace the warm cream background throughout; never switch to pure white.
2. **Do** use Kalam for headlines only to preserve the hand-crafted feel without hurting readability.
3. **Do** let artwork take center stage with generous whitespace and minimal UI chrome.
4. **Don't** use sharp 0px radii; the system relies on soft, rounded corners.
5. **Don't** introduce neon or high-saturation colors that clash with the earthy palette.
6. **Don't** set body text in Kalam; it becomes unreadable at small sizes.
7. **Do** use the brushed shadow sparingly for featured or hero elements only.
8. **Don't** over-apply texture effects; one textured element per view is enough.
9. **Do** pair Burnt Sienna with Plum for visual interest on feature callouts.
10. **Don't** stack more than two shadow levels on a single component.