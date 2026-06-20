# Design Multiplay

## Overview
Design Multiplay is a playful, collaborative design system inspired by the creative tools industry. It celebrates multi-color expression through a five-color gradient system of red, orange, violet, blue, and green — each representing a facet of the design process. The aesthetic is clean and tool-oriented, balancing the precision needed for professional work with the joy of creative collaboration. Cursor-colored multiplayer presence and vibrant accents make the workspace feel alive.

## Colors
- **Primary** (#0C8CE9): Primary actions, links, selected elements, and brand default — Figma Blue
- **Primary Hover** (#0A7AD4): Hover state for primary blue interactions — Deep Sky
- **Red** (#F24E1E): Component indicators, error states, and gradient anchor — Figma Red
- **Orange** (#FF7262): Frame highlights, warm accents, and secondary attention — Figma Orange
- **Violet** (#A259FF): Plugin indicators, smart features, and creative tools — Figma Violet
- **Blue** (#1ABCFE): Selection highlights, inspection mode, and informational — Figma Cyan
- **Green** (#0ACF83): Success states, prototyping mode, and confirmation — Figma Green
- **Neutral** (#8C8C8C): Secondary text, inactive icons, and metadata — Medium Gray
- **Background** (#FFFFFF): Panel backgrounds, settings pages, community feed — White
- **Surface** (#F5F5F5): Input backgrounds, code blocks, secondary panels — Light Gray
- **Canvas** (#E5E5E5): Design canvas default background (the checkered "void") — Canvas Gray
- **Text Primary** (#333333): Panel labels, file names, headings — Dark Gray
- **Text Secondary** (#8C8C8C): Property values, secondary labels, timestamps — Medium Gray
- **Border** (#E0E0E0): Panel dividers, input borders, section separators — Silver
- **Success** (#0ACF83): Exported, saved, published, component synced — Figma Green
- **Warning** (#FFCD29): Missing fonts, detached instances, version conflicts — Bright Yellow
- **Error** (#F24E1E): Broken links, failed exports, constraint errors — Figma Red

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is the exclusive typeface, providing the neutral precision needed for a design tool where the user's own typography choices must not be confused with the UI's. Tool panels use weight 400 at 11px — intentionally small to maximize canvas space. Property labels use weight 500 at 11px. Section headers in panels use weight 600 at 11px in uppercase with 0.8px letter-spacing. File names and community content use weight 600 at 14px. Marketing and community pages use larger scales with weight 700 at 28px+ and -0.02em tracking.

Type scale: 11px (panel/tool UI) / 12px (tooltips/badges) / 13px (compact body) / 14px (standard body) / 18px (section title) / 24px (page heading) / 32px (hero heading)

## Elevation
Elevation is used functionally to separate tool panels from the infinite canvas. The canvas itself is the lowest layer. Side panels (layers, properties) sit flush with no shadow, separated by 1px #E0E0E0 border. Floating panels (color picker, font selector) use `box-shadow: 0 2px 14px rgba(0, 0, 0, 0.15)` with 8px border-radius. Dropdown menus use `box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 7px rgba(0, 0, 0, 0.15)`. Context menus use the same shadow. Modal dialogs use `box-shadow: 0 5px 40px rgba(0, 0, 0, 0.2)` with backdrop rgba(0, 0, 0, 0.3). Cursor nametags float with a slight `filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))`.

## Components
- **Buttons**: Primary buttons have #0C8CE9 background, white text, 6px border-radius, height 32px, padding 0 16px, font-weight 500, font-size 12px. Secondary buttons have transparent background, 1px solid #E0E0E0 border, #333333 text. Panel-level mini buttons are 24px height with 4px border-radius. Destructive buttons use #F24E1E. Icon-only toolbar buttons are 32px square, transparent, 6px border-radius, hover shows #F5F5F5 background.
- **Cards**: Community file cards have 8px border-radius, 1px solid #E0E0E0 border, thumbnail preview area (16:9 aspect ratio), file name at 14px weight 600, creator avatar + name at 12px, like count. Hover lifts with shadow. Plugin cards are compact with icon, name, install count. Component cards in libraries show component thumbnail in a 1:1 frame.
- **Inputs**: Property inputs in panels are 24px height, 4px border-radius, #F5F5F5 background, no border, font-size 11px, padding 0 6px. Focus adds 2px solid #0C8CE9 border. Number inputs have up/down scrub interaction. Color value inputs show a small swatch prefix. Compound inputs (X, Y, W, H) sit in a 2x2 grid. Search in panels is 28px height with magnifying glass icon.
- **Chips**: Layer type chips show tiny icons (frame, group, text, component) at 12px. Constraint chips in properties are selectable mini-buttons. Tag chips in community are pill-shaped, #F5F5F5 background, 11px weight 500, padding 2px 8px. Plugin category chips use colored variants matching the five brand colors.
- **Lists**: Layer list uses 32px row height, 16px indent per nesting level, component icon (4 diamonds for components, frame icon for frames), name at 12px. Selected layer has #E8F0FE blue highlight. Multi-select shows continuous blue highlight. Drag reordering with blue insertion line indicator. Collapsible groups show triangle chevron.
- **Checkboxes**: Custom 14px square, 3px border-radius, 1px solid #8C8C8C border unchecked. Checked fills #0C8CE9 with white checkmark. Small scale matches the compact panel UI. Toggle switches for boolean properties: 28px wide, 16px tall, #CCCCCC track unchecked, #0ACF83 checked.
- **Tooltips**: #333333 background, white text, 4px border-radius, padding 4px 8px, font-size 11px, max-width 200px. Arrow 4px. Delay 300ms. Include keyboard shortcuts displayed as separate `kbd` elements with #555555 background. Used on every toolbar icon.
- **Navigation**: Top bar 48px height, #2C2C2C dark background (design tool mode) or white (community mode). Logo left, file name center (editable inline), share/play buttons right. Left panel (layers/assets) is 240px, white, with tab switching. Right panel (properties/prototype) is 240px, white. Bottom bar shows zoom level, view options. Community uses standard white nav with horizontal links.
- **Search**: In-canvas search (Cmd+F) is a floating bar, 320px wide, anchored top-center, 36px height, white background, 8px border-radius with shadow. Asset search in left panel is 28px, full-width within panel, #F5F5F5 background. Community search is a standard 40px input. Quick actions (Cmd+/) opens a command palette similar to Block Canvas's Cmd+K.

## Spacing
- Base unit: 4px
- Scale: 2px / 4px / 8px / 12px / 16px / 24px / 32px / 48px
- Component padding: Panels 8px internal, property sections 12px vertical, community cards 16px
- Section spacing: 12px between panel sections, 1px divider between groups, 24px in community layouts
- Container max width: N/A for tool (panels are fixed width), 1200px for community pages
- Card grid gap: 16px in community file grid, 8px in plugin grid

## Border Radius
- 3px: Checkboxes, inline badges, layer icons
- 4px: Panel inputs, mini buttons, dropdown items
- 6px: Standard buttons, toolbar items, tooltips
- 8px: Cards, floating panels, modals, color picker
- 9999px: Avatars, cursor nametags, pill tabs, notification dots

## Do's and Don'ts
- Do use the five brand colors (red, orange, violet, blue, green) with intention — each maps to a function in the tool
- Do keep panel UI extremely compact (11px text, 24-32px row heights) — canvas space is sacred
- Don't use the colorful palette in panels; tool chrome should be neutral gray and white
- Do assign each collaborator cursor a unique color from a broader spectrum beyond the five brand colors
- Don't make the community/marketing pages look like the tool UI; they should feel spacious and inviting
- Do show real-time multiplayer presence (cursors, selection outlines, avatars) as a core feature
- Don't use heavy visual decoration; the user's designs are the visual content, not the UI
- Do support keyboard shortcuts for every action and display them consistently in tooltips
- Don't mix the tool's neutral UI chrome with the brand's colorful marketing palette
- Do use the canvas gray (#E5E5E5) checkerboard pattern to indicate transparency in design work