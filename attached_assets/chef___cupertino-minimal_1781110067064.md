# Cupertino Minimal

## Overview
A design system inspired by the philosophy of radical simplicity and precision. Cupertino Minimal embraces negative space as a design element, using ultra-thin typography, frosted-glass surfaces, and a near-monochromatic palette punctuated by a single signature blue accent. Every pixel serves a purpose — if it doesn't need to be there, it isn't.

## Colors
- **Primary** (#007AFF): Interactive elements, links, active states — System Blue
- **Primary Hover** (#0066D6): Pressed and hover state for primary actions
- **Secondary** (#5856D6): Secondary actions, visited links — System Indigo
- **Neutral** (#8E8E93): Tertiary labels, placeholder text — System Gray
- **Background** (#FFFFFF): Primary background for light mode
- **Surface** (#F2F2F7): Grouped content backgrounds, cards, inset areas — System Gray 6
- **Text Primary** (#1C1C1E): Headlines, body text, primary labels — System Label
- **Text Secondary** (#3C3C43): Subheadlines, secondary descriptions at 60% opacity
- **Border** (#C6C6C8): Separators, dividers, input outlines — System Gray 4
- **Success** (#34C759): Confirmation states, positive indicators — System Green
- **Warning** (#FF9500): Caution states, attention-needed — System Orange
- **Error** (#FF3B30): Destructive actions, error states — System Red

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is used for all headlines and display text at weights 600 and 700 with tight letter-spacing (-0.02em for large titles, -0.01em for headlines). DM Sans handles body copy and UI labels at weights 400 and 500 with default letter-spacing. JetBrains Mono is used for code blocks and technical values at weight 400. The type scale favors large, bold titles that gradually reduce in weight and size for hierarchy.

- **Large Title**: Inter 34px/41px, weight 700, tracking -0.02em
- **Title 1**: Inter 28px/34px, weight 700, tracking -0.02em
- **Title 2**: Inter 22px/28px, weight 700, tracking -0.01em
- **Title 3**: Inter 20px/25px, weight 600, tracking -0.01em
- **Headline**: DM Sans 17px/22px, weight 600
- **Body**: DM Sans 17px/22px, weight 400
- **Callout**: DM Sans 16px/21px, weight 400
- **Subheadline**: DM Sans 15px/20px, weight 400
- **Footnote**: DM Sans 13px/18px, weight 400
- **Caption**: DM Sans 12px/16px, weight 400
- **Code**: JetBrains Mono 14px/20px, weight 400

## Elevation
Elevation is expressed through subtle, multi-layered shadows that simulate frosted glass depth. The system uses three levels: Level 0 (flat, no shadow — default for most surfaces), Level 1 (0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06) — for cards and floating elements), and Level 2 (0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08) — for modals, popovers, and sheets). Frosted glass effects use backdrop-filter: blur(20px) saturate(180%) with a semi-transparent white background (rgba(255,255,255,0.72)).

## Components
- **Buttons**: Primary uses #007AFF fill with white text, 12px vertical / 20px horizontal padding, 12px border-radius, font-weight 600 at 17px. Secondary is text-only in #007AFF. Destructive uses #FF3B30. All buttons have a 0.98 scale transform on press with 150ms ease-out transition. Disabled state at 40% opacity.
- **Cards**: White background on #F2F2F7 surface, 16px border-radius, 16px internal padding. Level 1 shadow. No visible border. Content uses 12px internal spacing. Group headers in uppercase DM Sans 13px, weight 600, #8E8E93, with 6px letter-spacing.
- **Inputs**: 44px minimum height (touch target), 1px #C6C6C8 border, 10px border-radius, 16px horizontal padding. Focused state replaces border with 2px #007AFF outline. Placeholder text in #8E8E93. Background #FFFFFF.
- **Chips**: Pill-shaped (9999px radius), #F2F2F7 background, DM Sans 14px weight 500, 8px/16px padding. Selected state fills with #007AFF and white text.
- **Lists**: Full-width rows, 44px minimum height, 16px horizontal padding. Separator lines are 0.5px #C6C6C8, inset 16px from leading edge. Chevron disclosure indicator in #C6C6C8 for navigation rows. Swipe actions revealed on horizontal gesture.
- **Checkboxes**: 22px circular checkmark. Unchecked: 2px #C6C6C8 border. Checked: #007AFF fill with white checkmark icon. Animated with 200ms spring ease.
- **Tooltips**: Dark (#1C1C1E) background at 90% opacity, white text, 8px border-radius, 8px/12px padding, DM Sans 13px. Backdrop blur. Arrow pointing to trigger element.
- **Navigation**: Large title pattern — 34px bold title that collapses to 17px centered title on scroll. Navigation bar is 44px height with frosted glass background. Tab bars use 49px height with SF Symbol-style icons at 25px, labels at 10px.
- **Search**: 36px height, #E5E5EA background, 10px border-radius, magnifying glass icon leading, 15px font size. Cancel button animates in from right on focus.

## Spacing
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
- Component padding: 16px standard, 20px for grouped sections
- Section spacing: 32px between major sections, 16px between related groups
- Container max width: 1024px centered with 16px side margins (mobile), 24px (tablet+)
- Card grid gap: 16px

## Border Radius
- 6px: Small elements — toggles, badges, small buttons
- 10px: Inputs, search bars, chips
- 12px: Buttons, action sheets
- 16px: Cards, modals, grouped table sections
- 9999px: Pills, avatars, segmented controls

## Do's and Don'ts
- Do use generous whitespace — let content breathe with at least 32px between sections
- Do maintain a strict visual hierarchy with no more than 3 levels of text emphasis per view
- Don't use borders when spacing alone can create separation
- Don't use more than one accent color per screen — blue is the single interactive color
- Do keep touch targets at minimum 44px height for all interactive elements
- Don't use heavy drop shadows — prefer subtle, diffused multi-layer shadows
- Do use system-standard animations (300ms ease-in-out for transitions, spring curves for gestures)
- Don't center-align body text — always left-align for readability
- Do use frosted glass (backdrop-filter blur) sparingly — only for overlays and navigation bars
- Don't add visual decoration that doesn't serve a functional purpose