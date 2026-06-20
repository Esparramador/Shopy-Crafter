# Block Canvas

## Overview
Block Canvas is an ultra-minimal, content-first design system where typography is the interface and whitespace is the primary design material. Anchored by near-black text on a clean white canvas, it strips away visual noise to create a workspace that feels like a blank page waiting for ideas. Every element is quiet and precise, revealing functionality through subtle hover states and contextual menus rather than persistent chrome.

## Colors
- **Primary** (#2383E2): Interactive links, selected blocks, toggle accents, and active states — Notion Blue
- **Primary Hover** (#1B6EC2): Hover state for blue interactive elements — Deep Azure
- **Secondary** (#EB5757): Destructive actions, important callouts, and urgent indicators — Soft Red
- **Neutral** (#787774): Secondary text, placeholders, timestamps, and icons — Warm Gray
- **Background** (#FFFFFF): Page canvas, the primary writing surface — White
- **Surface** (#F7F6F3): Sidebar background, code block background, hover backgrounds — Warm Off-White
- **Surface Hover** (#EFEFEF): Block hover states, drag targets, and interactive backgrounds — Light Warm Gray
- **Text Primary** (#191919): Page titles, body text, all primary readable content — Near Black
- **Text Secondary** (#787774): Placeholder text, timestamps, property labels — Warm Gray
- **Text Tertiary** (#B4B4B0): Watermark text, disabled states, very low priority content — Pale Gray
- **Border** (#E3E2DF): Block dividers, table borders, card outlines — Warm Silver
- **Success** (#4DAB9A): Confirmed states, connected integrations — Sage Green
- **Warning** (#CB912F): Caution callouts, approaching limits — Amber
- **Error** (#EB5757): Failed syncs, delete confirmations — Soft Red

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is the backbone of the entire typographic system, chosen for its exceptional readability at every size and its neutral-warm character. Page titles use weight 700 at 40px with -0.02em letter-spacing and 1.2 line-height. H1 blocks use weight 700 at 30px, H2 at 24px weight 600, H3 at 20px weight 600. Body text uses weight 400 at 16px with 1.5 line-height — generous for comfortable long-form reading. Inline code uses JetBrains Mono at 14px with #F7F6F3 background and 3px border-radius. The system supports serif and mono page-level font switching for personal preference.

Type scale: 12px (caption/property) / 14px (small text/code) / 16px (body) / 20px (H3) / 24px (H2) / 30px (H1) / 40px (page title)

## Elevation
Elevation is used with extreme restraint to maintain the flat, document-like aesthetic. Pages and blocks have zero elevation — they exist on a single plane. Dropdown menus use `box-shadow: 0 0 0 1px rgba(15, 15, 15, 0.05), 0 3px 6px rgba(15, 15, 15, 0.1), 0 9px 24px rgba(15, 15, 15, 0.2)` — a triple-layer shadow that creates a refined float without feeling heavy. The slash command menu uses the same shadow. Modals overlay at rgba(15, 15, 15, 0.6) with the same card shadow. Drag-and-drop block shadows use `box-shadow: 0 4px 12px rgba(15, 15, 15, 0.1)`.

## Components
- **Buttons**: Primary buttons have #2383E2 background, white text, 4px border-radius, height 32px, padding 0 12px, font-weight 500, font-size 14px. Buttons are intentionally small and unobtrusive. Secondary buttons have transparent background, #191919 text, hover background #EFEFEF. Ghost buttons are the most common — invisible until hovered. Destructive buttons use #EB5757 background. The entire system prefers ghost/minimal buttons over prominent ones.
- **Cards**: Database cards have #FFFFFF background, 1px solid #E3E2DF border, 3px border-radius. Compact and dense: cover image at top (optional, 120px height), title at weight 600, properties listed below at 14px. Gallery view cards have 8px gap. Board view cards are minimal, showing title + 1-2 key properties. Kanban cards have grab handle on left hover.
- **Inputs**: Text inputs are borderless by default — just text cursor on the canvas. Property inputs in databases have 1px solid #E3E2DF border, 4px border-radius, height 32px, padding 0 8px, font-size 14px. Focus adds a stronger `box-shadow: 0 0 0 2px rgba(35, 131, 226, 0.3)`. Block-level inputs show a faint placeholder ("Type '/' for commands") in #B4B4B0.
- **Chips**: Tag/select chips are pill-shaped with colored backgrounds (soft pastel variants: light pink, light blue, light green, light yellow, etc.), 12px font weight 500, padding 2px 8px, 3px border-radius. Multi-select shows tags inline. Status chips use the same system with explicit semantic colors. Person chips show a small 18px avatar + name.
- **Lists**: Bulleted and numbered lists are native block types at 16px body text with 24px indent per level. Toggle lists have a small 12px triangle chevron that rotates. Database list views are tables with sortable column headers at 14px weight 600, row height 34px, alternating hover #F7F6F3. Sidebar page list shows page icon (emoji or default) + title at 14px, 28px row height.
- **Checkboxes**: Custom 16px square, 3px border-radius, 1.5px solid #D3D1CB border unchecked. Checked fills #2383E2 with white checkmark and strikes through the adjacent text with #787774 color. To-do blocks use this inline with text. Hover shows a slightly darker border.
- **Tooltips**: #191919 background, white text, 4px border-radius, padding 4px 8px, font-size 12px, max-width 300px. Arrow 4px. Delay 300ms. Includes keyboard shortcut hints (e.g., "Bold — Ctrl+B"). Used sparingly, mostly on icon-only toolbar items.
- **Navigation**: Left sidebar 240px, #F7F6F3 background, collapsible to icon-only 48px width. Top section: workspace name and switcher. Sections: Favorites, Private, Shared. Page tree with indent levels, small page icons. Hover reveals action dots ("..."). Top bar is minimal: breadcrumb path, share button, three-dot menu. No visible navigation in focus/fullscreen mode.
- **Search**: Cmd+K opens Quick Find — a centered modal, 520px wide, with a large 44px search input. Results show pages with icon + title + breadcrumb path. Filters for "In: [page]", "Created by:", "Date:". Recent pages shown by default before typing. Results update as you type with highlighted matches.

## Spacing
- Base unit: 4px
- Scale: 4px / 8px / 12px / 16px / 24px / 32px / 48px / 96px
- Component padding: Page content 96px horizontal padding (wide pages), blocks have 0 vertical margin (tight), paragraph blocks have 4px vertical margin
- Section spacing: 4px between blocks, 16px before headings, 32px for page-level sections
- Container max width: 708px (default page width), 900px (wide), full-width for tables/boards
- Card grid gap: 8px in gallery view, 6px in board view columns

## Border Radius
- 3px: Inline code, tag chips, small cards, checkboxes, buttons
- 4px: Inputs, dropdown menus, tooltips
- 6px: Database cards, callout blocks
- 8px: Modals, large dialogs, cover images
- 9999px: Avatars, page icons background, notification dots

## Do's and Don'ts
- Do let whitespace do the heavy lifting — margins and padding are the primary organizational tool
- Do use hover-reveal patterns for actions; blocks should look clean until interaction
- Don't add persistent toolbars or action bars; Notion's aesthetic is "invisible until needed"
- Do maintain 16px body text and 1.5 line-height for comfortable long-form content
- Don't use strong colors for backgrounds; all tints should be barely visible (pastel at ~15% opacity)
- Do support the slash command ("/") as the primary discovery mechanism for block types
- Don't put borders around individual blocks in page view; blocks flow as a continuous document
- Do use emoji as page icons — they are a core part of the personality and wayfinding system
- Don't make the UI feel like a traditional app; it should feel like a living document
- Do keep the sidebar page tree clean with small icons and concise titles