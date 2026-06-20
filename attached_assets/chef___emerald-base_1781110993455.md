# Emerald Base

## Overview
Emerald Base is a developer-centric design system for backend-as-a-service platforms. Its signature green-on-dark palette signals an open-source ethos and technical credibility. The aesthetic balances approachability with depth — friendly enough for newcomers to backend development, yet information-dense enough for experienced developers managing production databases and edge functions.

## Colors
- **Primary** (#3ECF8E): Primary CTAs, active states, success indicators, brand accent — Supabase Green
- **Primary Hover** (#30B97A): Hover/pressed state for primary actions — Deep Green
- **Secondary** (#1C1C1C): Secondary surfaces, code block backgrounds — Dark Gray
- **Neutral** (#171717): Sidebar backgrounds, card surfaces — Near Black
- **Background** (#121212): App background, base canvas — Rich Black
- **Surface** (#1C1C1C): Elevated cards, panels, modal backgrounds — Dark Surface
- **Text Primary** (#EDEDED): Headings, primary content, code output — Off White
- **Text Secondary** (#707070): Descriptions, secondary labels, timestamps — Medium Gray
- **Border** (#2E2E2E): Dividers, card borders, input outlines — Dark Border
- **Success** (#3ECF8E): Reuses primary green for success states
- **Warning** (#F5C542): Rate limit warnings, schema warnings — Gold Yellow
- **Error** (#F56565): Query errors, connection failures, destructive actions — Soft Red

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: Fira Code — loaded from Google Fonts

Inter serves all UI text at weights 400, 500, and 600. Display headings use 600 weight with -0.02em letter-spacing. Body text uses 400 weight at 1.6 line-height. Navigation items use 500 weight at 13px. Fira Code is used extensively — SQL queries, API responses, table names, function code, and terminal output all render in Fira Code at 13px/400 with ligatures enabled. Code blocks use 13px with 1.7 line-height for readability. Inline code uses 13px Fira Code with a #1C1C1C background and 4px horizontal padding within a 3px border-radius container.

Type scale: 11px (badge/overline), 12px (table metadata/caption), 13px (body small/code/nav), 14px (body), 16px (h5/card title), 20px (h4/section header), 24px (h3/page title), 32px (h2/feature), 48px (h1/landing hero).

## Elevation
Dark interfaces minimize shadow usage. Level 0 is the base background (#121212). Level 1 (#171717) lifts the sidebar and secondary panels. Level 2 (#1C1C1C) is for cards, code editors, and table panels. Level 3 (#222222) is for dropdowns and nested popovers. Modals use `0 16px 40px rgba(0,0,0,0.5)` shadow with a semi-transparent (#121212 at 60% opacity) backdrop overlay. The green accent appears as a subtle glow (`0 0 30px rgba(62,207,142,0.1)`) on hero sections and primary CTA buttons on hover. Code editor panels use no shadow — they are distinguished by their monospace font and syntax highlighting alone.

## Components
- **Buttons**: Primary — #3ECF8E background, #121212 text, 500 weight, 34px height (small) / 38px (default) / 44px (large), 14px horizontal padding, 4px border-radius. Hover #30B97A. Secondary — transparent, 1px #2E2E2E border, #EDEDED text, hover border #3ECF8E. Ghost — transparent, #707070 text, hover #EDEDED. Destructive — transparent, 1px #F56565 border, #F56565 text, hover fills #F56565 with white text. All buttons 13px Inter 500.
- **Cards**: #1C1C1C background, 1px #2E2E2E border, 4px border-radius. Card header 14px 16px padding with bottom 1px #2E2E2E border. Card body 16px padding. Dashboard stat cards show metric in 28px/600 #EDEDED, label in 12px/400 #707070, with optional green sparkline. SQL editor cards use full-width Fira Code content with no padding on the code area.
- **Inputs**: 38px height, #1C1C1C background, 1px #2E2E2E border, 4px border-radius, 14px Inter 400, #EDEDED text, #707070 placeholder. Focus shows 1px #3ECF8E border with `0 0 0 3px rgba(62,207,142,0.1)` ring. SQL input uses Fira Code font. Textarea variant grows vertically with content.
- **Chips**: 22px height, 3px border-radius, 12px font, 500 weight. Default — #2E2E2E background, #EDEDED text. Status: Active (#3ECF8E/15% bg, #3ECF8E text), Paused (#F5C542/15% bg, #F5C542 text), Error (#F56565/15% bg, #F56565 text). Tech chips (Postgres, Edge Functions) use 11px Fira Code.
- **Lists**: Table rows are the primary list pattern. 40px row height, 1px #2E2E2E bottom border. Header: #171717 background, 11px/600 uppercase #707070, 0.05em tracking. Row: 13px/400 #EDEDED. Table names and column names rendered in Fira Code. Hover #222222 background. Alternating row colors not used — clean consistent rows.
- **Checkboxes**: 16px square, 3px border-radius, 1px #2E2E2E border, transparent background. Checked fills #3ECF8E with #121212 checkmark. Disabled uses #2E2E2E fill with #707070 checkmark.
- **Tooltips**: #222222 background, 1px #2E2E2E border, #EDEDED text, 12px/400, 4px border-radius, 6px 10px padding. Code values in tooltips use Fira Code. 100ms fade-in, 200ms delay.
- **Navigation**: Left sidebar, 240px width (collapsible), #171717 background, right 1px #2E2E2E border. Organization/project switcher at top with dropdown. Nav sections: Database, Auth, Storage, Edge Functions, SQL Editor — each with 16px icon and 13px/500 label. Items 34px height, 6px border-radius. Hover #1C1C1C. Active #3ECF8E/10% background with #3ECF8E text and icon.
- **Search**: Inline search in sidebar, 32px height, #1C1C1C background, 1px #2E2E2E border, 4px border-radius. Command palette (Cmd+K): 520px wide, #1C1C1C background, 1px #2E2E2E border, 8px border-radius, `0 16px 40px rgba(0,0,0,0.5)` shadow. Results include table names, functions, and docs — all searchable.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 96px
- Component padding: Buttons 6px 14px, cards 16px body, inputs 8px 12px, chips 3px 8px
- Section spacing: 32px between dashboard sections, 24px between form fields
- Container max width: Full viewport width for app (sidebar 240px + content fills remaining), 1100px for docs/marketing
- Card grid gap: 16px for dashboard metric cards (3-4 column), 12px for settings panels

## Border Radius
- 3px: Checkboxes, inline code, chips, small tags
- 4px: Buttons, inputs, cards, tooltips, dropdowns
- 6px: Sidebar nav items, table container
- 8px: Modals, command palette, large dialogs
- 9999px: Status dots, avatar circles, toggle switches

## Do's and Don'ts
- Do use Fira Code for all database-related content (table names, column names, SQL, API responses)
- Do keep the green accent reserved for primary actions and active navigation — not decorative use
- Don't use light mode in the core app; the dark theme is integral to the developer identity
- Do provide copy-to-clipboard on all code snippets, connection strings, and API keys
- Don't add excessive rounding; the 4px default border-radius conveys a technical, structured feel
- Do use real-time feedback for database operations (row counts, query execution time, connection status)
- Don't use the green for error states; maintain clear semantic color separation
- Do display technical metrics (latency, row count, payload size) prominently — developers expect them
- Don't hide complexity behind abstractions; expose configuration with sensible defaults instead