# Cloud Tower

## Overview
Cloud Tower is an enterprise design system built for complex data-rich applications. Anchored in trustworthy blues and clean whites, it communicates reliability, scalability, and clarity. The system is optimized for dashboards, data tables, and multi-step workflows where information density must coexist with visual clarity.

## Colors
- **Primary** (#00A1E0): Primary CTAs, links, active navigation, data highlights — Cloud Blue
- **Primary Hover** (#0088C7): Hover/pressed state for primary interactions
- **Secondary** (#032D60): Headers, hero sections, primary navigation background — Dark Navy
- **Neutral** (#F4F6F9): Page backgrounds, card containers, data table alternating rows — Cloud Gray
- **Background** (#FFFFFF): Main content area, clean white canvas — White
- **Surface** (#F4F6F9): Cards, table headers, sidebar backgrounds — Cloud Surface
- **Text Primary** (#032D60): Headings, primary labels, navigation text — Dark Navy
- **Text Secondary** (#706E6B): Body text, descriptions, helper text — Warm Gray
- **Border** (#D8DDE6): Dividers, table borders, card outlines, input borders — Silver
- **Success** (#04844B): Success states, completed stages, positive metrics — Green
- **Warning** (#FF9A3C): Alerts, attention needed, pending items — Orange
- **Error** (#C23934): Error states, failed validations, critical alerts — Red

## Typography
- **Display Font**: Nunito Sans — loaded from Google Fonts
- **Body Font**: Nunito Sans — loaded from Google Fonts
- **Code Font**: Source Code Pro — loaded from Google Fonts

Nunito Sans provides a friendly yet professional tone appropriate for enterprise software. Display headings use 700 weight with default letter-spacing. Body text uses 400 weight at 1.5 line-height for dense information layouts. Labels and metadata use 600 weight. Data table headers use 700 weight at 12px uppercase with 0.05em tracking. The system prioritizes readability at small sizes since dashboards often pack considerable information into limited space.

Type scale: 11px (table metadata/overline), 12px (table body/labels), 13px (small body), 14px (body), 16px (h5/subsection), 20px (h4/card header), 24px (h3/section title), 32px (h2/page title), 40px (h1/hero).

## Elevation
Cloud Tower uses a layered elevation system that adds structure to complex layouts. Level 0 is the flat page background (#FFFFFF). Level 1 uses `0 2px 4px rgba(0,0,0,0.07)` for cards and panels resting on the background. Level 2 uses `0 4px 14px rgba(0,0,0,0.1)` for dropdown menus and popovers. Level 3 uses `0 8px 24px rgba(0,0,0,0.12)` for modals and slide-over panels. The navigation header uses `0 2px 4px rgba(0,0,0,0.1)` for a consistent elevated bar. Cards on the cloud gray surface (#F4F6F9) use white backgrounds with Level 1 shadow to float above the surface.

## Components
- **Buttons**: Primary — #00A1E0 background, white text, 600 weight, 36px height (compact) / 40px (default) / 48px (large), 16px horizontal padding, 4px border-radius. Hover darkens to #0088C7. Destructive variant uses #C23934 background. Secondary — white background, 1px #D8DDE6 border, #032D60 text. Disabled state at 50% opacity. All buttons use 13px Nunito Sans 600.
- **Cards**: White background, 1px #D8DDE6 border, 8px border-radius, `0 2px 4px rgba(0,0,0,0.07)` shadow. Card header has 16px 20px padding with bottom 1px #D8DDE6 border. Card body has 20px padding. Optional card footer with top border. Dashboard metric cards show large 32px/700 numbers with 13px/400 labels below.
- **Inputs**: 36px height (compact) / 40px (default), white background, 1px #D8DDE6 border, 4px border-radius, 14px Nunito Sans 400, #032D60 text, #706E6B placeholder. Focus shows 1px #00A1E0 border with `0 0 0 3px rgba(0,161,224,0.15)` ring. Error state shows #C23934 border. Required fields show red asterisk. Label is 12px/600 #032D60 above input with 4px gap.
- **Chips**: 24px height, 4px border-radius, 11px font, 600 weight. Status chips — Success: #04844B/10% bg, #04844B text. Warning: #FF9A3C/10% bg, #FF9A3C text. Error: #C23934/10% bg, #C23934text. Neutral: #D8DDE6 bg, #706E6B text.
- **Lists**: Data tables are the primary list pattern. Table header: #F4F6F9 background, 12px/700 uppercase #706E6B text, 0.05em tracking. Rows: 44px height, white background, 1px #D8DDE6 bottom border. Alternating rows optionally use #F4F6F9. Hover shows #F4F6F9 on white rows.
- **Checkboxes**: 16px square, 3px border-radius, 1px #D8DDE6 border, white background. Checked fills #00A1E0 with white checkmark. Indeterminate shows horizontal dash. Focus ring uses blue glow.
- **Tooltips**: #032D60 background, white text, 12px/400, 4px border-radius, 6px 10px padding. `0 2px 8px rgba(0,0,0,0.15)` shadow. Arrow inherits dark navy background. 100ms fade-in.
- **Navigation**: Top horizontal nav bar, 56px height, #032D60 background. Logo and product name left-aligned in white. Nav items 14px/400 rgba(255,255,255,0.8), active state white with bottom 3px #00A1E0 indicator. Global search center-aligned. User avatar + org switcher right-aligned.
- **Search**: Global search bar in nav, 36px height, rgba(255,255,255,0.15) background on dark navy, 4px border-radius, white text and placeholder. Contextual search within pages uses standard input styling with magnifying glass icon prefix.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
- Component padding: Buttons 8px 16px, cards 20px body, inputs 8px 12px, chips 4px 8px
- Section spacing: 32px between dashboard sections, 24px between form groups
- Container max width: 1280px with 24px horizontal padding (full-width dashboards stretch to viewport)
- Card grid gap: 16px for metric cards, 24px for content cards. Dashboard uses 12-column grid with 16px gutters

## Border Radius
- 3px: Checkboxes, inline tags, small form elements
- 4px: Buttons, inputs, chips, tooltips, table cells
- 8px: Cards, panels, modals
- 12px: Large feature cards, hero sections
- 9999px: Avatar circles, dot indicators, toggle switches

## Do's and Don'ts
- Do use the 12-column grid system for dashboard layouts to maintain alignment across complex views
- Do use data tables with proper column alignment (numbers right-aligned, text left-aligned)
- Don't use more than 3 levels of elevation on a single screen — keep the hierarchy clear
- Do provide compact (36px) variants of buttons and inputs for data-dense views
- Don't use the dark navy (#032D60) for large body text areas; reserve it for headings and navigation
- Do use status chips consistently — green for success, orange for warning, red for error
- Don't rely solely on color to communicate status; pair with icons and labels
- Do maintain 16px minimum touch targets even in compact layouts for accessibility
- Don't use custom colors outside the palette for charts; use defined blue (#00A1E0), navy (#032D60), green (#04844B), orange (#FF9A3C), and gray (#706E6B) for data visualization