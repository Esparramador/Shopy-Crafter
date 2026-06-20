# GreenEarth Design System

## Overview

GreenEarth is an environmental design system crafted for advocacy organizations and conservation platforms. It draws from nature with forest greens, earthy browns, and sky blues while balancing environmental urgency with trustworthy calm. The system uses flat styling with visible borders to create structured, informative layouts that communicate scientific credibility alongside emotional resonance.

---

## Colors

- **Color Primary** (#166534): Primary actions, headings
- **Color Secondary** (#92400E): Earth tones, data highlights
- **Color Tertiary** (#0284C7): Links, sky-themed accents
- **Surface Base** (#F0FDF4): Page background
- **Color Success** (#16A34A): Goals met, positive
- **Color Warning** (#D97706): At risk, caution
- **Color Error** (#DC2626): Critical, endangered
- **Color Info** (#0284C7): Updates, data points

## Typography

- **Headline Font**: Merriweather
- **Body Font**: Raleway
- **Mono Font**: IBM Plex Mono

- **h1**: 40px black, 1.2 line height. Hero headlines.
- **h2**: 32px bold, 1.25 line height. Section headings.
- **h3**: 24px bold, 1.3 line height. Article titles.
- **h4**: 20px bold, 1.35 line height. Card titles.
- **body**: 16px regular, 1.6 line height. Body text.
- **small**: 14px regular, 1.5 line height. Captions, credits.
- **xs**: 12px semibold, 1.4 line height. Labels, data tags.

---

## Spacing

Base unit: **8px**.
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight padding
- **md**: 16px — Standard card padding
- **lg**: 24px — Section gaps
- **xl**: 32px — Layout margins
- **2xl**: 48px — Hero section spacing
- **3xl**: 64px — Major layout breaks

## Border Radius

- **radius-sm** (4px): Chips, tags
- **radius-md** (8px): Buttons, cards, inputs
- **radius-lg** (12px): Modals, large panels
- **radius-full** (9999px): Avatars, icon buttons

## Elevation

Flat design with borders. Shadows used minimally; borders carry the structural weight.
- **shadow-sm**: 1px offset, 2px blur, #000000 at 4%. Subtle card lift.
- **shadow-md**: 2px offset, 4px blur, #000000 at 6%. Hover state only.
- **shadow-lg**: 4px offset, 12px blur, #000000 at 8%. Modals only.
Primary hierarchy is achieved through border-default and border-strong rather than elevation.

## Components

### Buttons
#### Variants
- **Primary**: #166534 fill, #FFFFFF text, no border, #14532D fill.
- **Secondary**: #92400E fill, #FFFFFF text, no border, #78350F fill.
- **Ghost**: transparent fill, #166534 text, 2px #166534 border, #16653410 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: Small (8px 16px, 14px, 32px), Medium (10px 24px, 16px, 40px), Large (12px 32px, 18px, 48px).
#### Disabled State
0.5 opacity.
- disabled cursor
- No hover or focus effects applied

### Cards
- **Default**: #FFFFFF fill, 1px #D1FAE5 border, shadow-sm shadow. Hover: border-color #166534.
- **Elevated**: #FFFFFF fill, 2px #D1FAE5 border, shadow-sm shadow. Hover: shadow-md, border #166534.
radius-md (8px) border radius. 16px padding.

### Inputs
- **Default**: 1px #D1FAE5 border, #FFFFFF fill.
- **Hover**: 1px #86EFAC border, #FFFFFF fill.
- **Focus**: 2px #166534 border, #FFFFFF fill, 3px ring #166534 at 20% shadow.
- **Error**: 2px #DC2626 border, #FEF2F2 fill, 3px ring #DC2626 at 20% shadow.
- **Disabled**: 1px #D1FAE5 border, #F0FDF4 fill, none; 50% opacity shadow.
14px, Raleway 600, content-primary, 4px bottom margin **label**, 12px, Raleway 400, content-tertiary, 4px top margin; error helper uses color-error **helper text**, 10px/14px;/border/radius:/radius-md padding.

### Chips
- **Filter**: #16653415 fill, #166534 text, 1px #16653440 border.
- **Status**: varies by severity fill, varies text, no border.
success #DCFCE7/#166534, warning #FEF3C7/#92400E, error #FEE2E2/#991B1B status colors, 4px/12px;/font-size:/12px;/border-radius:/radius-sm padding.

### Lists
16px Raleway content-primary. 48px; padding: 0 16px row height, 1px #D1FAE5 divider. Hover: background #F0FDF4. Active: background #16653410, text color #166534, border-left 3px #166534.

### Checkboxes
20px square; border-radius: 4px. 8px; label font: 16px Raleway label gap. Unchecked: 2px #86EFAC, background #FFFFFF. Checked: background #166534, white checkmark icon. Focus: 3px ring #166534 at 20%.

### Radio Buttons
20px circle; border-radius: 50%. 8px; label font: 16px Raleway label gap. Unchecked: 2px #86EFAC, background #FFFFFF. Selected: 2px #166534, inner dot 10px #166534. Focus: 3px ring #166534 at 20%.

### Tooltips
#14532D; text: #FFFFFF; font: 12px Raleway fill. 6px/12px;/border-radius:/radius-sm padding, 6px; max-width: 240px arrow, 200ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use the forest green primary for all primary CTAs and headings to anchor the environmental theme.
2. **Do** pair data visualizations with the sky blue tertiary for charts, maps, and infographics.
3. **Do** use the earth brown secondary for data callouts and secondary interactive elements.
4. **Don't** use pure white (#FFFFFF) as the page background; always use the pale green tint (#F0FDF4).
5. **Don't** rely on shadows for hierarchy; use visible borders and background contrast instead.
6. **Do** feature impact statistics prominently with Merriweather 900 weight at large sizes.
7. **Don't** use aggressive reds for non-error content; urgency should come through layout and copy, not color.
8. **Do** maintain the nature-toned palette consistently; avoid introducing off-brand accent colors.
9. **Don't** center large blocks of body text; left-align for readability across all content sections.
10. **Do** ensure the pale green background maintains sufficient contrast with all text and border tokens.