# Creative Crimson

## Overview
Creative Crimson is a professional creative-tools design system inspired by the company that defined digital creativity. It pairs a confident red accent with sophisticated dark panels and precise, tool-centric layouts designed for people who make things for a living. The aesthetic is refined and productive — an interface that respects its users' expertise with dense, customizable panels, precise controls, and a neutral dark chrome that lets creative work take center stage. Every pixel serves the professional workflow.

## Colors
- **Primary** (#EB1000): Brand accent, CTAs, active tool indicators, notification badges — Adobe Red
- **Primary Hover** (#D40E00): Hovered red buttons and interactive accent elements
- **Secondary** (#4B9CF5): Links, secondary actions, selected items, info states — Spectrum Blue
- **Neutral** (#B3B3B3): Labels, inactive controls, descriptions, secondary text
- **Background** (#1D1D1D): Application background, the neutral dark workspace — Carbon Gray
- **Surface** (#2C2C2C): Panels, sidebars, property inspectors, dialog backgrounds
- **Text Primary** (#E3E3E3): Primary text, tool names, active labels, headings
- **Text Secondary** (#B3B3B3): Descriptions, keyboard shortcuts, secondary metadata
- **Border** (#3E3E3E): Panel dividers, input outlines, toolbar separators, card edges
- **Success** (#2D9D78): Export completed, file saved, sync successful — Seafoam Green
- **Warning** (#E68619): Missing fonts, large file warnings, compatibility notices — Amber
- **Error** (#D7373F): Missing links, failed exports, license expired, destructive confirmations

## Typography
- **Display Font**: Source Sans 3 — loaded from Google Fonts
- **Body Font**: Source Sans 3 — loaded from Google Fonts
- **Code Font**: Source Code Pro — loaded from Google Fonts

Source Sans 3 is the Adobe-native typeface — clean, humanist, and supremely legible at small sizes on dark backgrounds. It is used at weights 400, 600, and 700. Panel headers use 600 weight at 11px uppercase with 0.06em letter-spacing — the uppercase-small treatment is a signature pattern for tool panel labels. Body text uses 400 weight at 14px for documentation, tooltips, and descriptions. Page and dialog titles use 700 weight at 20px. Property labels in inspectors use 400 weight at 12px. Source Code Pro renders code snippets, file paths, shortcut keys, and expression inputs at 13px with 400 weight. The type scale is compact and professional: 11px (panel labels/uppercase), 12px (property labels/small text), 13px (code/shortcuts), 14px (body), 16px (section titles), 20px (dialog titles), 24px (page titles), 32px (marketing headlines).

## Elevation
The dark interface uses a layered panel system. The application frame sits at #1D1D1D, primary panels at #2C2C2C, nested sub-panels at #323232, and floating elements at #3A3A3A. Panel separators use 1px solid #3E3E3E borders rather than shadows. Dropdown menus use 0 4px 16px rgba(0, 0, 0, 0.3) shadow on #2C2C2C background. Modal dialogs use 0 8px 28px rgba(0, 0, 0, 0.35) with a rgba(0, 0, 0, 0.5) backdrop. Context menus use 0 2px 8px rgba(0, 0, 0, 0.25). The overall approach matches desktop application conventions — panels are docked and bordered, floating elements have stronger shadows to indicate they can be dismissed.

## Components
- **Buttons**: Primary uses #4B9CF5 background with #FFFFFF text, 4px radius, 12px 16px padding, 600 weight, 32px height. CTA/accent uses #EB1000 background with #FFFFFF text. Secondary uses #3E3E3E background with #E3E3E3 text. Quiet (tertiary) variant uses transparent background with #E3E3E3 text, no border. Disabled uses 40% opacity. All buttons use 14px font. Tool buttons in the sidebar are 32x32px icon-only with 2px radius and #2C2C2C background (4px radius, #4B9CF5 background when active).
- **Cards**: Asset cards use #2C2C2C background, 4px radius, 1px solid #3E3E3E border. Thumbnail/preview fills the top with zero radius (flush), metadata below in 12px padding. Library cards (fonts, colors, character styles) use compact 40px rows with icon + name + metadata. Creative Cloud app cards show app icon (48px), app name, and install/update button.
- **Inputs**: #2C2C2C background, 1px solid #3E3E3E border, 4px radius, 6px 8px padding, 14px font, 32px height. Focus state applies 2px solid #4B9CF5 border (blue focus, not red). Number inputs include stepper arrows right-aligned. Slider inputs use a #3E3E3E track, #4B9CF5 filled portion, and 14px circular thumb. Color inputs show a swatch preview (16x16px) before the hex value.
- **Chips**: Tag chips use #3E3E3E background, #E3E3E3 text, 4px radius, 4px 8px padding, 12px font. Removable with X icon. Status chips — "Creative Cloud" uses gradient (purple-blue-pink), "Free" uses #2D9D78 background, "Trial" uses #E68619 background. File type badges (PSD, AI, XD) use their respective app brand colors.
- **Lists**: Tree views are the primary list pattern — file layers, asset panels, font lists. 28px row height, 16px left indent per nesting level, expand/collapse arrow (6px triangle icon). Selected row uses #4B9CF5 at 20% opacity background. Hover uses #3A3A3A background. Multi-select with Shift+Click and Cmd+Click. Drag handles for reordering.
- **Checkboxes**: 14x14px (smaller than typical — professional tools favor density), #2C2C2C background, 1px solid #3E3E3E border, 2px radius. Checked state fills #4B9CF5 with white checkmark. Indeterminate state shows horizontal dash. Toggle switches are 28x16px — compact to fit in property panels.
- **Tooltips**: #1D1D1D background, 1px solid #3E3E3E border, #E3E3E3 text, 4px radius, 6px 8px padding, 12px font. Include keyboard shortcut in #B3B3B3 text after the label (e.g., "Pen Tool P"). Positioned above with arrow. 300ms delay for tool descriptions, instant for truncated text.
- **Navigation**: Application top bar (40px height) shows app name + document tabs. Left sidebar (48px, icon-only tools panel). Right sidebar (280px, properties/inspector panel). Bottom bar shows status info, zoom level, and artboard dimensions. All panels are resizable via drag handles. Panel headers use 11px uppercase #B3B3B3 text.
- **Search**: Top-right search icon opens a command palette (Cmd+F). #2C2C2C background, 4px radius, 44px input height, 480px modal width. Results grouped by type: actions, files, fonts, assets, help articles. Each result shows icon + name + keyboard shortcut. Arrow key navigation with enter to execute.

## Spacing
- Base unit: 4px
- Scale: 2px, 4px, 6px, 8px, 12px, 16px, 20px, 24px, 32px, 48px
- Component padding: Buttons 12px 16px, panel sections 12px, inputs 6px 8px, tree view rows 4px 8px
- Section spacing: 8px between property groups in inspector, 16px between panel sections, 24px between dialog sections
- Container max width: Fluid — fills available viewport. Panels have fixed/resizable widths (240-320px typical)
- Card grid gap: 8px in asset library grids, 4px in compact thumbnail grids

## Border Radius
- 2px: Tool buttons, tree view selection highlights, code blocks, small badges
- 4px: Buttons, inputs, cards, dropdowns, modals, tooltips, chips, most elements
- 6px: Dialog windows, large panels, color picker container
- 8px: Onboarding cards, marketing elements, notification toasts
- 9999px: Avatar images, status indicators, toggle switch tracks, search pills

## Do's and Don'ts
- Do use #EB1000 red sparingly — it is a brand accent for CTAs and alerts, not a dominant color
- Do use 11px uppercase letter-spaced labels for panel headers — this is the signature professional pattern
- Do support keyboard shortcuts everywhere and show them in tooltips — professional users live on the keyboard
- Do keep panels dense with compact controls (32px heights, 14x14px checkboxes) — screen real estate is premium
- Do use #4B9CF5 blue for focus states and selected items — red is too aggressive for routine interactions
- Don't use white or light backgrounds in the main workspace — the dark chrome lets creative work shine
- Don't use rounded corners larger than 4px on tool UI — the aesthetic is precise and mechanical, not playful
- Don't animate UI transitions longer than 100ms — professional tools must feel instantaneous
- Don't use the red accent for body text or large fills — it creates visual fatigue in extended work sessions
- Don't simplify controls "for beginners" — this design system respects professional expertise and density