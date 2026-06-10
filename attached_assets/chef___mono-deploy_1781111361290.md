# Mono Deploy

## Overview
Mono Deploy is an ultra-minimal, monochrome design system built for developer-facing deployment platforms. It strips away all ornamentation, relying on precise typography, stark black-and-white contrast, and calculated whitespace to communicate speed, reliability, and technical excellence. Color is used with surgical precision — only blue for links and interactive elements.

## Colors
- **Primary** (#0070F3): Links, primary buttons, active indicators, focus rings — Electric Blue
- **Primary Hover** (#0060DF): Hover/pressed state for primary actions — Deep Blue
- **Secondary** (#FFFFFF): Secondary buttons, alternate surfaces in dark mode — White
- **Neutral** (#111111): Card backgrounds in dark mode, secondary surfaces — Near Black
- **Background** (#000000): App background, full black canvas — Black
- **Surface** (#111111): Elevated cards, code blocks, panel backgrounds — Dark Surface
- **Text Primary** (#EDEDED): Primary headings and body text on dark backgrounds — Off White
- **Text Secondary** (#888888): Secondary labels, metadata, descriptions — Medium Gray
- **Border** (#333333): Subtle borders, dividers, input outlines — Dark Border
- **Success** (#50E3C2): Deployment success, ready states, build passed — Teal Green
- **Warning** (#F5A623): Build warnings, slow responses, queued states — Amber
- **Error** (#EE0000): Build failed, deployment errors, critical alerts — Pure Red

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is used at weights 400, 500, and 600 only — no bold weight for a restrained, technical tone. Display headings use 600 weight with -0.04em tight letter-spacing for a sharp, dense feel. Body text uses 400 weight at 1.6 line-height. Navigation and labels use 500 weight at 13px. Code is set in JetBrains Mono at 14px/400 with ligatures enabled, often displayed in syntax-highlighted blocks on #111111 backgrounds. Monospace is also used for deployment IDs, commit hashes, and technical identifiers inline.

Type scale: 12px (code small/metadata), 13px (nav/label), 14px (body/code), 16px (body large), 24px (h3/section), 32px (h2/page title), 48px (h1/hero headline), 64px (display/landing).

## Elevation
Mono Deploy deliberately avoids box-shadows in most contexts, preferring flat design with border-based separation. Cards and panels use 1px #333333 borders instead of shadows. The only shadow in the system is for modals and command palettes: `0 16px 70px rgba(0,0,0,0.5)`. Depth is communicated through background color shifts (#000000 -> #111111 -> #1A1A1A) rather than shadows. This flat approach reinforces the technical, no-nonsense character of the system.

## Components
- **Buttons**: Primary — #0070F3 background, white text, 500 weight, 36px height (small) / 40px (default) / 48px (large), 16px horizontal padding, 6px border-radius. Hover #0060DF with subtle `0 0 0 2px rgba(0,112,243,0.3)` glow. Secondary — transparent, 1px #333333 border, #EDEDED text, hover border lightens to #555. Ghost — transparent, no border, #888888 text, hover turns #EDEDED. All buttons 14px Inter 500.
- **Cards**: #111111 background, 1px #333333 border, 8px border-radius. No shadow. Padding 24px. Cards are used sparingly — data is often presented in clean rows and tables. Project cards show deployment status dot (colored circle), project name (16px/500), and last deployed timestamp (13px/400 #888888).
- **Inputs**: 40px height, transparent background, 1px #333333 border, 6px border-radius, 14px Inter 400, #EDEDED text, #555555 placeholder. Focus shows 1px #0070F3 border with no additional ring/glow — clean and sharp. Error state 1px #EE0000 border.
- **Chips**: 24px height, 6px border-radius, 12px font, 500 weight. Default — #1A1A1A background, #888888 text, 1px #333333 border. Active — #0070F3 background, white text, no border. Status chips: Success uses #50E3C2 text on #50E3C2/10% bg, Error uses #EE0000 text on #EE0000/10% bg.
- **Lists**: Table rows with 48px height, no visible row borders. Header row uses #888888 text, 12px/500, uppercase, 0.05em tracking. Body rows 14px/400 #EDEDED. Hover shows #111111 to #1A1A1A transition. Deployment lists show commit hash (JetBrains Mono, #888888), branch name, status dot, and relative time.
- **Checkboxes**: 16px square, 6px border-radius, 1px #333333 border, transparent background. Checked fills #0070F3 with white checkmark. Clean 100ms transition. No focus glow — only border color change on focus.
- **Tooltips**: #1A1A1A background, 1px #333333 border, #EDEDED text, 13px/400, 6px border-radius, 8px 12px padding. No shadow. Appears instantly (0ms delay), 100ms fade-in.
- **Navigation**: Top bar, 64px height, #000000 background, bottom 1px #333333 border. Logo (triangle icon) left-aligned in white. Nav links 13px/500 #888888, active state white. Team/project breadcrumb uses slashes as separators in #333333. User avatar 28px circle right-aligned. Feedback and support links in #888888.
- **Search**: Command palette (Cmd+K): centered modal, 560px width, #111111 background, 1px #333333 border, 12px border-radius, `0 16px 70px rgba(0,0,0,0.5)` shadow. Search input 48px height, no border, white text, 16px font. Results list with 40px row height, #888888 secondary text, keyboard shortcuts shown right-aligned in JetBrains Mono.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px, 128px
- Component padding: Buttons 8px 16px, cards 24px, inputs 8px 12px, chips 4px 10px
- Section spacing: 48px between sections, 24px between related groups
- Container max width: 1024px for docs/content, 1200px for dashboards (centered with generous margins)
- Card grid gap: 16px for project grids (3-column at 1024px+), 1px for stacked list rows

## Border Radius
- 0px: Inline code snippets, progress bars
- 4px: Tooltips in compact contexts
- 6px: Buttons, inputs, chips, checkboxes
- 8px: Cards, panels, dropdown menus
- 12px: Modals, command palette, large overlays
- 9999px: Status dots, avatar circles, toggle handles

## Do's and Don'ts
- Do use monochrome as the default — reserve color only for actionable elements and status indicators
- Do display technical data (commit hashes, deploy IDs) in JetBrains Mono for instant recognition
- Don't add shadows to cards; use 1px borders on #333333 for all structural separation
- Do keep animations under 150ms — the system should feel instant, not animated
- Don't use rounded corners larger than 12px; the aesthetic is sharp and precise
- Do provide keyboard shortcuts for all primary actions and surface them in the UI
- Don't use gradients, textures, or decorative elements — every pixel must serve a function
- Do use relative timestamps ("2m ago", "3h ago") instead of absolute dates in deployment lists
- Don't use color to communicate hierarchy — use size, weight, and opacity instead