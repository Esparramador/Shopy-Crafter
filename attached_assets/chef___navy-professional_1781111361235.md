# Navy Professional

## Overview
Navy Professional is a structured, trust-building design system rooted in corporate communication and career advancement. Its deep navy blue anchors a palette of warm grays and clean whites, conveying authority and reliability. Every component is designed for clarity and professionalism — supporting dense informational layouts, credential displays, and networking interactions with measured confidence.

## Colors
- **Primary** (#0A66C2): Primary CTAs, links, connect buttons, and active navigation — LinkedIn Blue
- **Primary Hover** (#004182): Hovered and pressed primary elements — Deep Navy
- **Secondary** (#915907): Premium and gold-tier elements, upgrade prompts — Harvest Gold
- **Neutral** (#666666): Secondary body text, metadata, timestamps — Neutral Gray
- **Background** (#F4F2EE): Page background, feed canvas, profile surfaces — Warm Linen
- **Surface** (#FFFFFF): Cards, modals, input fields, navigation bar — White
- **Text Primary** (#191919): Headlines, names, primary content — Charcoal
- **Text Secondary** (#666666): Subtitles, timestamps, secondary metadata — Neutral Gray
- **Border** (#E0DFDC): Card borders, dividers, section separators — Warm Silver
- **Success** (#057642): Connection accepted, application submitted, endorsement confirmed — Forest Green
- **Warning** (#C37D16): Pending invitations, awaiting review — Bronze
- **Error** (#CC1016): Error states, withdrawn applications, broken links — Signal Red

## Typography
- **Display Font**: Source Sans 3 — loaded from Google Fonts
- **Body Font**: Source Sans 3 — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Source Sans 3 provides clean, humanist letterforms that balance professionalism with approachability. Display headings use weight 700 at -0.01em letter-spacing. Body text defaults to 14px weight 400 with 1.4 line-height for dense feed content. Usernames and job titles use weight 600 at 16px. Section headers use weight 700 at 20px. The type system favors size hierarchy over weight contrast, creating clear structure in information-dense layouts.

Type scale: 12px (micro/caption) / 14px (body) / 16px (subtitle) / 20px (section title) / 24px (page title) / 32px (hero heading)

## Elevation
Elevation is subtle and warm, avoiding harsh shadows. Standard cards use `box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)` combining a thin border-like shadow with a soft drop. Hover cards elevate to `box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.12)`. Modals use `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2)` with a background scrim at rgba(0, 0, 0, 0.6). The warm background color (#F4F2EE) makes white cards naturally feel elevated without heavy shadows.

## Components
- **Buttons**: Primary buttons have #0A66C2 background, white text, 16px border-radius (pill), height 40px, padding 0 24px, font-weight 600, font-size 16px. Hover darkens to #004182. Outline buttons have 1px solid #0A66C2 border, #0A66C2 text, transparent background, same pill radius. Ghost buttons have no border, #0A66C2 text. Disabled buttons show 0.4 opacity. "Connect" button has a person+ icon prefix.
- **Cards**: White background, 8px border-radius, 1px solid #E0DFDC border. Internal padding is 16px 24px. Feed post cards have a 48px avatar, name at weight 700, headline at 14px #666666, and timestamp with a dot separator. Action bar has Like, Comment, Repost, Send icons distributed evenly at 40px height.
- **Inputs**: Text inputs have 1px solid #86888A border, 4px border-radius, height 40px, padding 0 12px, font-size 14px. Focus state changes border to #0A66C2 with a subtle glow `box-shadow: 0 0 0 2px rgba(10, 102, 194, 0.15)`. Labels sit above inputs at 14px weight 600. Multi-line post composer starts at 48px height and auto-expands.
- **Chips**: Skill endorsement chips are pill-shaped with #E8E8E8 background, 14px text, weight 600, padding 4px 12px. Active/selected skills use #E7F0F9 background with #0A66C2 text. "Add skill" chip has a dashed 1px #86888A border with + icon.
- **Lists**: Experience/education list items use 48px square logos, title at weight 600, subtitle at 14px #666666, date range at 12px #666666. Items separated by 1px #E0DFDC border. Hover highlights with #F4F2EE background.
- **Checkboxes**: 18px square, 2px border-radius, 1.5px solid #86888A border unchecked. Checked fills #0A66C2 with white checkmark. Used in notification preferences and privacy settings.
- **Tooltips**: #191919 background, white text, 4px border-radius, padding 6px 10px, font-size 12px, max-width 200px. Arrow 5px. Delay 300ms. Used on icon-only buttons and profile completeness indicators.
- **Navigation**: Top bar 52px height, white background, logo left, search center, 5 icon nav items with labels below (24px icons, 10px labels). Active item shows #191919 icon with 2px bottom border in #191919. Inactive icons are #666666. Mobile uses bottom tab bar.
- **Search**: Global search input 44px height, #EEF3F8 background, 4px border-radius, with magnifying glass icon. Typeahead dropdown shows people (with avatars and headlines), companies (with logos), and keywords. Results grouped by section with "See all results" link.

## Spacing
- Base unit: 4px
- Scale: 4px / 8px / 12px / 16px / 20px / 24px / 32px / 48px / 64px
- Component padding: Cards 16px 24px, list items 12px 24px
- Section spacing: 8px between feed cards, 24px between profile sections
- Container max width: 576px (feed), 1128px (full layout with sidebars)
- Card grid gap: 8px vertical between feed posts

## Border Radius
- 2px: Checkboxes, tiny badges
- 4px: Inputs, dropdown menus, skill chips
- 8px: Cards, post containers, modals, profile banner
- 12px: Large dialogs, premium banners
- 9999px: Buttons, avatars, pill tags, search input

## Do's and Don'ts
- Do use the warm linen background (#F4F2EE) consistently — it defines the brand's warmth
- Do keep card layouts structured with clear visual hierarchy using weight contrast
- Don't use bright or playful colors; maintain corporate trust through the navy palette
- Do show professional context (job title, company) alongside every user mention
- Don't over-use the gold/premium color; reserve it exclusively for paid tier indicators
- Do maintain generous line-height (1.4+) for body text to aid scanning dense content
- Don't use rounded avatars for companies — square with 4px radius for orgs, round for people
- Do provide clear visual feedback for connection states (pending, connected, following)