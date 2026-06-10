# Pastel Transfer

## Overview
Pastel Transfer is an art-forward design system that celebrates simplicity and creative expression. Built around rotating pastel backgrounds and minimal UI chrome, it creates a canvas-like experience where the interface nearly disappears. The aesthetic is calm, inviting, and deliberately unhurried — every interaction is designed to feel effortless and beautiful.

## Colors
- **Primary** (#406AFF): Primary CTAs, links, active file indicators — Electric Periwinkle
- **Primary Hover** (#3358E0): Hover/pressed state for primary interactions — Deep Periwinkle
- **Secondary** (#1A1A1A): Secondary buttons, header text, strong labels — Near Black
- **Neutral** (#F5F5F0): Default background when no pastel wallpaper active — Warm White
- **Background** (#FCEADD): Default pastel background (rotates) — Peach Blush
- **Surface** (#FFFFFF): Upload cards, modal backgrounds, content panels — White
- **Text Primary** (#1A1A1A): Headlines, labels, file names — Near Black
- **Text Secondary** (#767676): Descriptions, metadata, helper text — Warm Gray
- **Border** (#E5E5E0): Subtle dividers, input borders, card outlines — Light Warm Gray
- **Success** (#00C48C): Upload complete, transfer delivered — Mint Green
- **Warning** (#FFB84D): File expiring soon, large transfer notice — Soft Amber
- **Error** (#FF5252): Upload failed, expired transfer, invalid file — Coral Red

### Rotating Pastel Backgrounds
The background color rotates on each visit or interaction. The palette of backgrounds includes:
- Peach Blush (#FCEADD)
- Lavender Mist (#E8E0F0)
- Seafoam (#D4EFE6)
- Butter (#FFF3D4)
- Rose (#F5DDE0)
- Sky (#D6E8F5)
- Lilac (#E6D8F0)
- Mint Cream (#DFF5EC)

All UI elements are designed to work seamlessly on any of these backgrounds. Text maintains WCAG AA contrast on all variants.

## Typography
- **Display Font**: DM Sans — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

DM Sans provides a clean geometric voice that recedes behind the content and pastel aesthetic. Display headings use 700 weight with -0.02em letter-spacing. Body text uses 400 weight at 1.5 line-height. CTAs and labels use 500 weight. File names and technical details (file size, transfer ID) use 500 weight at 14px. DM Sans at 400 weight renders with open, friendly letterforms that complement the soft palette. The system avoids heavy typography — the largest display text tops at 48px, and most UI operates between 13-16px.

Type scale: 12px (file metadata/caption), 13px (small body/label), 14px (body), 16px (body large/card title), 20px (h4/section header), 28px (h3/page title), 36px (h2/feature), 48px (h1/hero message).

## Elevation
Elevation is soft and diffused to match the gentle pastel palette. Level 1 uses `0 2px 8px rgba(0,0,0,0.04)` for cards resting on pastel backgrounds. Level 2 uses `0 8px 24px rgba(0,0,0,0.06)` for the upload zone and floating panels. Level 3 uses `0 16px 48px rgba(0,0,0,0.08)` for modals. Shadows are deliberately low-opacity to avoid harsh contrast against the soft backgrounds. The white upload card (#FFFFFF) floats on the pastel surface with Level 2 shadow, creating the illusion of a paper card on a colored desk. No dark shadows appear anywhere in the system.

## Components
- **Buttons**: Primary — #406AFF background, white text, 500 weight, 44px height (default) / 52px (large), 20px horizontal padding, 10px border-radius. Hover #3358E0 with `0 4px 12px rgba(64,106,255,0.2)` shadow. Secondary — white background, 1px #E5E5E0 border, #1A1A1A text, hover slight gray tint. Ghost — transparent, #767676 text, hover #1A1A1A. Large CTA (hero): 56px height, 24px padding, 16px/500 text. All buttons use 14px DM Sans 500.
- **Cards**: White (#FFFFFF) background, no border, `0 2px 8px rgba(0,0,0,0.04)` shadow, 16px border-radius. Generous 32px padding. Upload card is the hero element: centered, 480px max-width, 16px border-radius, Level 2 shadow, contains dashed upload zone with 2px dashed #E5E5E0 border (drag state: 2px dashed #406AFF). File cards show icon, name (14px/500), size (13px #767676), and progress bar.
- **Inputs**: 48px height, white background, 1px #E5E5E0 border, 10px border-radius, 14px DM Sans 400, #1A1A1A text, #767676 placeholder. Focus shows 2px #406AFF border with `0 0 0 4px rgba(64,106,255,0.08)` ring. Email input for transfer recipients uses tag-style multi-input. Message textarea uses 120px min-height.
- **Chips**: 28px height, 8px border-radius, 13px font, 500 weight. Recipient — white background, 1px #E5E5E0 border, #1A1A1A text, small "x" dismiss icon. File type — #F5F5F0 background, #767676 text. Active state — #406AFF background, white text.
- **Lists**: File lists use 56px row height with generous spacing. Each row: file type icon (24px, colored by type), file name (14px/500 #1A1A1A), file size (13px #767676), progress bar or status. No visible borders — whitespace separates rows. Upload progress uses a 4px height bar with #406AFF fill on #E5E5E0 track, 8px border-radius.
- **Checkboxes**: 20px square, 8px border-radius (rounded square), 1px #E5E5E0 border, white background. Checked fills #406AFF with white checkmark. Soft 200ms transition. Focus ring uses blue at 8% opacity.
- **Tooltips**: White background, `0 4px 12px rgba(0,0,0,0.06)` shadow, #1A1A1A text, 13px/400, 8px border-radius, 8px 14px padding. No border. Appears with 150ms fade-in and 4px upward translate.
- **Navigation**: Minimal top bar, 64px height, transparent background (shows pastel). Logo left-aligned in #1A1A1A. Two-three nav links (14px/500 #767676, hover #1A1A1A). Transfer CTA right-aligned as a primary button. On scroll, nav background transitions to white with Level 1 shadow. Mobile: hamburger menu opening full-screen white overlay.
- **Search**: Not a primary pattern. Transfer lookup uses a single centered input (48px, 400px max-width) with "Enter your transfer link" placeholder. No complex search infrastructure needed.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px, 80px, 120px
- Component padding: Buttons 12px 20px, cards 32px, inputs 12px 16px, chips 6px 12px
- Section spacing: 64px between major sections on landing, 32px between form groups
- Container max width: 480px for upload card (centered), 960px for content pages, 1200px for landing grid
- Card grid gap: 24px between feature cards, 12px between file list items

## Border Radius
- 4px: Progress bars, inline badges
- 8px: Chips, checkboxes, small buttons, tooltips
- 10px: Buttons, inputs, dropdown menus
- 16px: Cards, modals, upload zones, feature panels
- 9999px: Avatar circles, file type dots, toggle switches

## Do's and Don'ts
- Do ensure all text maintains WCAG AA contrast on every pastel background variant
- Do use generous padding and whitespace — the design should feel spacious and unhurried
- Don't add more than one primary blue element per view; the interface should be mostly neutral with a single focal point
- Do use the rotating pastel backgrounds to create variety and delight across sessions
- Don't use sharp corners anywhere; the consistent rounding (8-16px) is essential to the soft aesthetic
- Do keep the upload flow to 3 steps maximum: add files, add recipients, send
- Don't use dense layouts or small components; minimum touch target is 44px
- Do use subtle animations (200-300ms ease-out) for uploads, state changes, and page transitions
- Don't introduce dark mode; the pastel-on-white palette is the core brand identity
- Do treat the background as part of the design — it is not decoration but an integral part of the visual experience