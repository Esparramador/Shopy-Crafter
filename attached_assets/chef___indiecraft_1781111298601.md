# IndieCraft Design System

## Overview

IndieCraft is a pixel-art-inspired design system built for indie game studios and pixel-art game launchers. It channels chunky, 8-bit charm through bold greens, vivid purples, and warm yellows while maintaining modern usability. The system pairs the playful display font Righteous with the friendly body font Nunito to create interfaces that feel both retro and approachable.

---

## Colors

- **Color Primary** (#22C55E): Primary actions, highlights
- **Color Secondary** (#A855F7): Accents, secondary actions
- **Color Tertiary** (#FACC15): Badges, callouts, warnings
- **Surface Base** (#FAFAFA): Page background
- **Color Success** (#16A34A): Success states
- **Color Warning** (#FACC15): Warning states
- **Color Error** (#EF4444): Error states
- **Color Info** (#3B82F6): Informational states

## Typography

- **Headline Font**: Righteous
- **Body Font**: Nunito
- **Mono Font**: Roboto Mono

- **h1**: 40px regular, 1.2 line height. Page titles.
- **h2**: 32px regular, 1.25 line height. Section headings.
- **h3**: 24px regular, 1.3 line height. Sub-section heads.
- **h4**: 20px regular, 1.35 line height. Card titles.
- **body**: 16px regular, 1.5 line height. Body text.
- **small**: 14px regular, 1.5 line height. Captions, helpers.
- **xs**: 12px semibold, 1.4 line height. Badges, labels.

---

## Spacing

Base unit: **8px** (grid-aligned).
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight padding, chip gaps
- **md**: 16px — Standard card padding
- **lg**: 24px — Section gaps
- **xl**: 32px — Page-level margins
- **2xl**: 48px — Hero section spacing
- **3xl**: 64px — Major layout breaks

## Border Radius

- **radius-sm** (4px): Chips, small tags
- **radius-md** (8px): Buttons, cards, inputs
- **radius-lg** (12px): Modals, large panels
- **radius-full** (9999px): Avatars, icon buttons

## Elevation

Material shadow system with layered depth.
- **shadow-sm**: 1px offset, 2px blur, #000000 at 6%. Resting cards.
- **shadow-md**: 4px offset, 6px blur, #000000 at 10%. Hovered elements.
- **shadow-lg**: 10px offset, 20px blur, #000000 at 12%. Modals, dropdowns.
- **shadow-green**: 4px offset, 14px blur, #22C55E at 30%. Primary CTA glow.
- **shadow-purple**: 4px offset, 14px blur, #A855F7 at 30%. Secondary accents.

## Components

### Buttons
#### Variants
- **Primary**: #22C55E fill, #FFFFFF text, no border, #16A34A fill.
- **Secondary**: #A855F7 fill, #FFFFFF text, no border, #9333EA fill.
- **Ghost**: transparent fill, #22C55E text, 2px #22C55E border, #22C55E10 fill.
- **Destructive**: #EF4444 fill, #FFFFFF text, no border, #DC2626 fill.
#### Sizes
Sizes: Small (8px 16px, 14px, 32px), Medium (8px 24px, 16px, 40px), Large (12px 32px, 18px, 48px).
#### Disabled State
0.5 opacity.
- disabled cursor
- No hover or focus effects applied

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, shadow-sm shadow. Hover: border-color #22C55E.
- **Elevated**: #FFFFFF fill, no border, shadow-md shadow. Hover: shadow-lg.
radius-md (8px) border radius. 16px padding.

### Inputs
- **Default**: 1px #E5E7EB border, #FFFFFF fill.
- **Hover**: 1px #9CA3AF border, #FFFFFF fill.
- **Focus**: 2px #22C55E border, #FFFFFF fill, 3px ring #22C55E at 25% shadow.
- **Error**: 2px #EF4444 border, #FEF2F2 fill, 3px ring #EF4444 at 20% shadow.
- **Disabled**: 1px #E5E7EB border, #F3F4F6 fill, none; 60% opacity shadow.
14px, Nunito 600, content-primary, 4px bottom margin **label**, 12px, Nunito 400, content-tertiary, 4px top margin; error helper uses color-error **helper text**, 8px/12px;/border/radius:/radius-md padding.

### Chips
- **Filter**: #22C55E15 fill, #22C55E text, 1px #22C55E40 border.
- **Status**: varies by severity fill, varies text, no border.
success #DCFCE7/#166534, warning #FEF9C3/#854D0E, error #FEE2E2/#991B1B status colors, 4px/12px;/font-size:/12px;/border-radius:/radius-sm padding.

### Lists
16px Nunito content-primary. 48px; padding: 0 16px row height, 1px #E5E7EB divider. Hover: background #F9FAFB. Active: background #22C55E10, text color #22C55E.

### Checkboxes
20px square; border-radius: 4px. 8px; label font: 16px Nunito label gap. Unchecked: 2px #D1D5DB, background #FFFFFF. Checked: background #22C55E, white checkmark icon. Focus: 3px ring #22C55E at 25%.

### Radio Buttons
20px circle; border-radius: 50%. 8px; label font: 16px Nunito label gap. Unchecked: 2px #D1D5DB, background #FFFFFF. Selected: 2px #22C55E, inner dot 10px #22C55E. Focus: 3px ring #22C55E at 25%.

### Tooltips
#1A1A2E; text: #FFFFFF; font: 12px Nunito fill. 6px/12px;/border-radius:/radius-sm padding, 6px; max-width: 240px arrow, 200ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use the 8px grid strictly for all spacing and sizing to maintain pixel-aligned layouts.
2. **Do** pair Righteous headlines with Nunito body copy for a retro-yet-readable contrast.
3. **Do** use the green primary color for all primary CTAs and active states.
4. **Don't** mix serif fonts into the system; the design relies on display and sans-serif pairing.
5. **Don't** use gradients; the pixel-art aesthetic demands flat, solid color fills.
6. **Do** reserve the tertiary yellow for badges, callouts, and non-critical highlights only.
7. **Don't** apply shadows to everything; use material elevation intentionally to create hierarchy.
8. **Do** keep interactive elements at minimum 44px touch target for accessibility.
9. **Don't** use thin font weights below 400; readability on chunky UIs requires medium or bold weights.
10. **Do** use the purple secondary for accent elements like tags, progress bars, and secondary buttons.