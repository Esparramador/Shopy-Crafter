# Prestige Purple

## Overview
Prestige Purple embodies the cinematic grandeur and premium positioning of high-end streaming. Deep purples and rich blacks create an atmosphere of exclusivity, while careful typography and generous spacing communicate quality. Every design decision reinforces the feeling that the content — and the viewer — are extraordinary.

## Colors
- **Primary** (#B4AFF2): Primary interactive elements, featured badges, selected states — Soft Lavender
- **Primary Hover** (#9C96E8): Hover/pressed state for primary actions — Deep Lavender
- **Secondary** (#5822B4): Secondary accents, gradients, brand moments — Royal Purple
- **Neutral** (#1E1E2A): Card backgrounds, secondary surfaces — Dark Plum
- **Background** (#0A0A12): App background, cinematic dark canvas — Near Black Blue
- **Surface** (#141420): Elevated cards, modals, navigation panels — Dark Surface
- **Text Primary** (#FFFFFF): Headings, titles, primary content — White
- **Text Secondary** (#9A9AB0): Descriptions, metadata, secondary copy — Muted Lavender Gray
- **Border** (#2A2A3C): Subtle dividers, card edges, input borders
- **Success** (#3DD68C): Subscription confirmations, download complete — Emerald
- **Warning** (#F5A623): Content warnings, expiring titles — Gold
- **Error** (#EF4444): Playback errors, cancellation confirmations — Crimson

## Typography
- **Display Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Body Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Plus Jakarta Sans is a geometric sans-serif that balances approachability with sophistication. Display headings use 800 weight with -0.03em letter-spacing for bold cinematic impact. Body text uses 400 weight at 1.6 line-height for comfortable reading. UI elements use 500-600 weight. Subtitle and metadata text uses 500 weight with 0.02em tracking in uppercase for a refined editorial feel. The font pairs precision with warmth, avoiding the coldness of purely geometric typefaces.

Type scale: 11px (overline/label uppercase), 13px (caption), 14px (body small), 16px (body), 20px (h4/card title), 28px (h3/section header), 40px (h2/page title), 56px (h1/hero cinematic display).

## Elevation
Shadows in Prestige Purple are deep and dramatic, reinforcing the cinematic atmosphere. Level 1 uses `0 2px 8px rgba(0,0,0,0.3)` for subtle card lift. Level 2 uses `0 8px 32px rgba(0,0,0,0.5)` for dropdowns and popovers. Level 3 uses `0 16px 48px rgba(0,0,0,0.6)` for modals and full-screen overlays. A purple glow (`0 0 40px rgba(88,34,180,0.15)`) accents hero sections and featured content. Background gradients from #5822B4 to transparent at 10% opacity add atmospheric depth behind featured titles.

## Components
- **Buttons**: Primary — linear-gradient(135deg, #5822B4, #B4AFF2) background, white text, 800 weight, 44px height, 20px horizontal padding, 10px border-radius. Hover intensifies gradient saturation. Secondary — transparent with 1px #B4AFF2 border, #B4AFF2 text, hover fills #B4AFF2 at 10% opacity. Ghost — no border, #9A9AB0 text, hover turns white. All buttons 14px Plus Jakarta Sans 600.
- **Cards**: #141420 background, 12px border-radius, no border by default. Content poster fills top with 12px top radius. Body has 20px padding. Hover lifts with `0 12px 40px rgba(0,0,0,0.5)` and a 1px #B4AFF2 border at 20% opacity fades in. Title is 18px/700 white, metadata is 13px/500 #9A9AB0.
- **Inputs**: 48px height, #141420 background, 1px #2A2A3C border, 10px border-radius, 14px Plus Jakarta Sans 400, white text, #9A9AB0 placeholder. Focus reveals 1px #B4AFF2 border with `0 0 0 4px rgba(180,175,242,0.1)` ring.
- **Chips**: 30px height, 8px border-radius, 12px font, 600 weight, 0.02em tracking. Default — #1E1E2A background, #9A9AB0 text. Active — #5822B4 background, white text. Used for genre and content type filters.
- **Lists**: Rows with 52px height, 16px horizontal padding, 1px #2A2A3C bottom border. Hover shows #1E1E2A background. Selected rows show left 3px #B4AFF2 border accent.
- **Checkboxes**: 18px square, 4px border-radius, 1px #2A2A3C border, transparent background. Checked fills with linear-gradient(135deg, #5822B4, #B4AFF2) and white checkmark. Smooth 150ms transition.
- **Tooltips**: #1E1E2A background, 1px #2A2A3C border, white text, 12px/500, 8px border-radius, 8px 14px padding. `0 8px 24px rgba(0,0,0,0.4)` shadow. 200ms fade-in with 4px upward translate.
- **Navigation**: Side rail on desktop (72px collapsed, 240px expanded), #0A0A12 background with right 1px #2A2A3C border. Nav icons 24px in #9A9AB0, active turns #B4AFF2 with left 3px purple accent bar. Top bar on mobile, 56px height.
- **Search**: Full-width search bar in hero section, 56px height, #141420 background, 12px border-radius, 16px font. Magnifying glass icon in #9A9AB0. Results overlay uses #141420 with `0 16px 48px rgba(0,0,0,0.6)` shadow.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 40px, 56px, 72px, 96px
- Component padding: Buttons 12px 20px, cards 20px body, inputs 12px 16px, chips 6px 14px
- Section spacing: 56px between major sections, 32px between subsections
- Container max width: 1440px with 32px horizontal padding (mobile 16px)
- Card grid gap: 20px on mobile, 28px on desktop. Poster grid uses 4-column layout at 1200px+

## Border Radius
- 4px: Checkboxes, inline badges, small indicators
- 8px: Chips, tooltips, small buttons
- 10px: Buttons, inputs, dropdown menus
- 12px: Cards, modals, featured panels
- 9999px: Avatar circles, pill badges, progress indicators

## Do's and Don'ts
- Do use the purple gradient for hero moments and primary CTAs to create a premium feel
- Do maintain generous whitespace around content — premium design breathes
- Don't overuse the soft lavender (#B4AFF2) as body text; reserve it for interactive elements
- Do use cinematic aspect ratios (16:9 or wider) for content imagery
- Don't use bright or saturated colors outside the defined palette — they undermine the premium tone
- Do employ subtle animations (200-300ms ease-out) for state transitions to feel polished
- Don't use borders heavily; prefer elevation and background shifts for separation
- Do use uppercase 11px/600 tracking for overlines and category labels to convey editorial authority
- Don't mix warm and cool tones — the palette is intentionally cool and controlled