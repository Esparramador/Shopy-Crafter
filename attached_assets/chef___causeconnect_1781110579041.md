# CauseConnect Design System

## Overview

CauseConnect is a compassionate, impact-focused design system designed for charity and nonprofit fundraising websites. It pairs trustworthy greens with energizing warm orange to inspire both confidence and action. The system balances emotional warmth with clear information hierarchy, ensuring donors and supporters can engage effortlessly.

---

## Colors

- **Color Primary** (#059669): Donate buttons, primary actions
- **Color Secondary** (#EA580C): Urgency callouts, progress bars
- **Color Tertiary** (#1E3A5F): Trust anchors, headings
- **Surface Base** (#FFFFFF): Page background
- **Color Success** (#059669): Goal met, completed
- **Color Warning** (#D97706): Deadline approaching
- **Color Error** (#DC2626): Errors, failed
- **Color Info** (#2563EB): Updates, information

## Typography

- **Headline Font**: Nunito
- **Body Font**: Open Sans
- **Mono Font**: Roboto Mono

- **h1**: 40px extra-bold, 1.2 line height. Hero headlines.
- **h2**: 32px bold, 1.25 line height. Section headings.
- **h3**: 24px bold, 1.3 line height. Campaign titles.
- **h4**: 20px semibold, 1.35 line height. Card titles.
- **body**: 16px regular, 1.6 line height. Body text.
- **small**: 14px regular, 1.5 line height. Captions, metadata.
- **xs**: 12px semibold, 1.4 line height. Badges, labels.

---

## Spacing

Base unit: **8px**.
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight padding
- **md**: 16px — Card padding
- **lg**: 24px — Section gaps
- **xl**: 32px — Layout margins
- **2xl**: 48px — Hero section spacing
- **3xl**: 64px — Major layout breaks

## Border Radius

- **radius-sm** (4px): Chips, small tags
- **radius-md** (8px): Buttons, cards, inputs
- **radius-lg** (12px): Modals, panels
- **radius-full** (9999px): Avatars, icon buttons

## Elevation

Subtle shadow system for gentle depth cues.
- **shadow-sm**: 1px offset, 3px blur, #000000 at 6%. Resting cards.
- **shadow-md**: 4px offset, 8px blur, #000000 at 8%. Hovered elements.
- **shadow-lg**: 8px offset, 20px blur, #000000 at 10%. Modals, dropdowns.
- **shadow-green**: 4px offset, 12px blur, #059669 at 20%. Donate CTA glow.

## Components

### Buttons
#### Variants
- **Primary**: #059669 fill, #FFFFFF text, no border, #047857 fill.
- **Secondary**: #EA580C fill, #FFFFFF text, no border, #C2410C fill.
- **Ghost**: transparent fill, #059669 text, 2px #059669 border, #05966910 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: Small (8px 16px, 14px, 32px), Medium (10px 24px, 16px, 40px), Large (12px 32px, 18px, 48px).
#### Disabled State
0.5 opacity.
- disabled cursor
- No hover or focus effects applied

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, shadow-sm shadow. Hover: shadow-md.
- **Elevated**: #FFFFFF fill, no border, shadow-md shadow. Hover: shadow-lg.
radius-md (8px) border radius. 16px padding.

### Inputs
- **Default**: 1px #D1D5DB border, #FFFFFF fill.
- **Hover**: 1px #9CA3AF border, #FFFFFF fill.
- **Focus**: 2px #059669 border, #FFFFFF fill, 3px ring #059669 at 20% shadow.
- **Error**: 2px #DC2626 border, #FEF2F2 fill, 3px ring #DC2626 at 20% shadow.
- **Disabled**: 1px #E5E7EB border, #F9FAFB fill, none; 50% opacity shadow.
14px, Open Sans 600, content-primary, 4px bottom margin **label**, 12px, Open Sans 400, content-tertiary, 4px top margin; error helper uses color-error **helper text**, 10px/14px;/border/radius:/radius-md padding.

### Chips
- **Filter**: #05966915 fill, #059669 text, 1px #05966940 border.
- **Status**: varies by severity fill, varies text, no border.
success #DCFCE7/#166534, warning #FEF3C7/#92400E, error #FEE2E2/#991B1B status colors, 4px/12px;/font-size:/12px;/border-radius:/radius-sm padding.

### Lists
16px Open Sans content-primary. 48px; padding: 0 16px row height, 1px #E5E7EB divider. Hover: background #F9FAFB. Active: background #05966910, text color #059669.

### Checkboxes
20px square; border-radius: 4px. 8px; label font: 16px Open Sans label gap. Unchecked: 2px #D1D5DB, background #FFFFFF. Checked: background #059669, white checkmark icon. Focus: 3px ring #059669 at 20%.

### Radio Buttons
20px circle; border-radius: 50%. 8px; label font: 16px Open Sans label gap. Unchecked: 2px #D1D5DB, background #FFFFFF. Selected: 2px #059669, inner dot 10px #059669. Focus: 3px ring #059669 at 20%.

### Tooltips
#1E3A5F; text: #FFFFFF; font: 12px Open Sans fill. 6px/12px;/border-radius:/radius-sm padding, 6px; max-width: 240px arrow, 200ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use the primary green for all donation and positive-action CTAs to build trust.
2. **Do** use the secondary orange sparingly for urgency indicators like fundraising deadlines.
3. **Do** feature impact metrics prominently using large numbers with Nunito 800 weight.
4. **Don't** use the destructive red for non-error purposes; it undermines the compassionate tone.
5. **Don't** overcrowd layouts with competing CTAs; guide users toward one primary action per section.
6. **Do** pair campaign imagery with clear progress bars using the primary green.
7. **Don't** use dark themes; the light, open layout conveys transparency and trustworthiness.
8. **Do** use the tertiary navy for authoritative headings and trust-building sections like "About Us."
9. **Don't** use decorative fonts; readability and clarity are paramount for donation flows.
10. **Do** ensure all form inputs in donation flows use clear labels, visible focus states, and inline validation.