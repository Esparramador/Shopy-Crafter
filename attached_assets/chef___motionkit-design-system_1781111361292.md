# MotionKit Design System

## Overview

MotionKit is a dynamic, cutting-edge design system built for motion designer and video producer portfolios. Every element conveys kinetic energy through a dark canvas, vivid gradient accents, glassmorphism panels, and colored glows. The dark background serves as a theater for content, letting video reels, animation showcases, and motion studies command the viewer's attention. Components feel fluid and alive with rounded corners, translucent layers, and smooth transitions.

---

## Colors

- **Color Primary** (#8B5CF6): Primary actions, accents
- **Color Secondary** (#22D3EE): Secondary actions, links
- **Color Tertiary** (#F472B6): Highlights, badges, callouts
- **Surface Base** (#0A0A0F): Page background
- **Surface Glass** (#151520 at 65%): Frosted glass panels
- **Color Success** (#34D399): Render complete, upload ok
- **Color Warning** (#FBBF24): Export warnings
- **Color Error** (#F87171): Render failures
- **Color Info** (#22D3EE): Informational hints

## Typography

- **Headline Font**: Sora
- **Body Font**: Work Sans
- **Mono Font**: Space Mono

- **text-hero**: Sora 72px bold, 1.0 line height
- **text-h1**: Sora 48px bold, 1.1 line height
- **text-h2**: Sora 32px semibold, 1.2 line height
- **text-h3**: Sora 22px semibold, 1.3 line height
- **text-body-lg**: Work Sans 18px regular, 1.6 line height
- **text-body**: Work Sans 16px light, 1.6 line height
- **text-caption**: Work Sans 13px medium, 1.5 line height
- **text-mono**: Space Mono 14px regular, 1.5 line height

---

## Spacing

Base unit: **8px**.
- **space-1**: 4px — Inline icon gaps
- **space-2**: 8px — Icon/label spacing
- **space-3**: 16px — Within component groups
- **space-4**: 24px — Card inner padding
- **space-5**: 32px — Between components
- **space-6**: 48px — Section internal padding
- **space-8**: 64px — Between sections
- **space-10**: 80px — Hero-level vertical rhythm

## Border Radius

- **radius-sm** (6px): Small chips, tags
- **radius-md** (12px): Buttons, inputs, cards
- **radius-lg** (20px): Feature cards, modals
- **radius-xl** (28px): Hero panels
- **radius-pill** (9999px): Pills, toggles

## Elevation (Glassmorphism + Colored Glows)

- **shadow-glass**: 8px offset, 32px blur, #000000 at 40%. Frosted panels.
- **shadow-md**: 4px offset, 16px blur, #000000 at 50%. Raised cards.
- **shadow-lg**: 12px offset, 48px blur, #000000 at 60%. Modals, popovers.
- **glow-primary**: 24px glow #8B5CF6 at 40%. Violet glow accent.
- **glow-secondary**: 24px glow #22D3EE at 35%. Cyan glow accent.
- **glow-tertiary**: 24px glow #F472B6 at 35%. Pink glow accent.
- **shadow-focus**: 3px ring #8B5CF6 at 45%. Focus ring.
Glass panels apply backdrop-filter: blur(20px)` with `border: 1px #FFFFFF at 10%.

## Components

### Buttons
Buttons use 12px corners with gradient fills for primary and smooth 200ms transitions. Hover states intensify the glow.
#### Variants
- **Primary**: linear-gradient(135deg, #8B5CF6, #7C3AED) fill, #FFFFFF text, no border.
- **Secondary**: #22D3EE fill, #0A0A0F text, no border.
- **Ghost**: transparent fill, #8B5CF6 text, 1.5px #8B5CF6 border.
- **Destructive**: #EF4444 fill, #FFFFFF text, no border.
#### Sizes
Sizes: Small (32px, 14px, 13px, 72px), Medium (40px, 20px, 14px, 100px), Large (48px, 28px, 16px, 140px).
#### Disabled State
0.35 opacity, disabled cursor.
- Glow removed
- No hover transitions

### Cards
surface-raised or surface-glass fill, 1px border-default border, 12px corners, 24px padding, shadow-glass shadow, Hover: Border shifts to #FFFFFF at 15%, glow-primary.
Glass variant: `backdrop-filter: blur(20px)`, translucent background, #FFFFFF at 10% border.

### Inputs
- **Default**: #3F3F46 border color, #151520 fill, no shadow.
- **Hover**: #52525B border color, #151520 fill, no shadow.
- **Focus**: #8B5CF6 border color, #151520 fill, shadow-focus shadow.
- **Error**: #F87171 border color, #1A1015 fill, 3px ring #F87171 at 25% shadow.
- **Disabled**: #27272A border color, #0F0F14 fill, no shadow.
1.5px - Border radius: 12px border, content-primary text. 40px tall, 14px Work Sans 400 font size.

### Chips
#### Filter Chips
- **Default**: #1E1E2A fill, #A1A1AA text, 1px #27272A border.
- **Selected**: #8B5CF6 fill, #FFFFFF text, 1px #8B5CF6 border.
- **Hover**: #27272A fill, #F4F4F5 text, 1px #3F3F46 border.
#### Status Chips
- **Rendering**: #8B5CF6 at 15% fill, #A78BFA text, Spinner indicator.
- **Complete**: #34D399 at 15% fill, #34D399 text, Check indicator.
- **Exporting**: #FBBF24 at 15% fill, #FBBF24 text, Arrow indicator.
- **Failed**: #F87171 at 15% fill, #F87171 text, X indicator.
9999px border radius. 13px Work Sans 500. 28px tall.

### Lists
44px row height, 16px horizontal padding, 1px #27272A divider, #1E1E2A hover background, #8B5CF6 at 12% active background, 12px (container) corners, 20px, 12px gap from label icon size, content-primary text.

### Checkboxes
- **Unchecked**: #151520 fill, 1.5px #3F3F46 border.
- **Checked**: #8B5CF6 fill, 1.5px #8B5CF6 border, #FFFFFF checkmark.
- **Disabled**: #0F0F14 fill, 1.5px #27272A border, #52525B checkmark.
20px, 6px border radius. shadow-focus focus ring, 200ms ease transition.

### Radio Buttons
- **Unselected**: #151520 fill, 1.5px #3F3F46 border.
- **Selected**: #151520 fill, 1.5px #22D3EE border, #22D3EE dot.
- **Disabled**: #0F0F14 fill, 1.5px #27272A border, #52525B dot.
20px. 10px dot diameter, shadow-focus focus ring.

### Tooltips
#27272A fill, #F4F4F5 text, 13px Work Sans font size, 8px 14px padding, 8px corners, 220px max width, 6px triangle arrow, 1px #3F3F46 border, 200ms show, 50ms hide delay, shadow-md shadow.
---

## Do's and Don'ts

1. **Do** use gradient accents (violet-to-cyan, violet-to-pink) to inject energy into key CTAs and hero elements.
2. **Don't** use flat, static layouts that feel inert. Every section should imply motion through staggered reveals and smooth transitions.
3. **Do** design video-first layouts where reel thumbnails, looping previews, and embedded players are the dominant content.
4. **Do** keep the dark canvas (#0A0A0F) as the foundation -- it functions as the theater screen for visual content.
5. **Don't** place light backgrounds behind video content. Dark surrounds maximize perceived contrast and vibrancy.
6. **Do** use colored glows sparingly to draw attention to primary actions and featured work.
7. **Don't** overuse glassmorphism -- limit translucent panels to navigation overlays and feature callouts, not every card.
8. **Do** implement smooth transitions (200-400ms, ease-out) for component state changes to reinforce the motion-design identity.
9. **Don't** use abrupt state changes or zero-duration transitions. Instant snaps feel out of character.
10. **Do** provide prefers-reduced-motion` fallbacks that disable animated glows and transition effects for accessibility.