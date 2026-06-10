# Newsdesk Red

## Overview
Newsdesk Red is a high-urgency design system built for real-time news and media platforms. The bold red-on-white palette communicates immediacy and authority. Every design decision prioritizes speed of information consumption — scannable headlines, dense article grids, and prominent breaking news indicators. The system handles the full spectrum from calm browsing to breaking news alerts.

## Colors
- **Primary** (#CC0000): Breaking banners, CTAs, live indicators, brand mark — CNN Red
- **Primary Hover** (#A30000): Hover/pressed state for primary actions — Deep Red
- **Secondary** (#990000): Secondary accent, gradient endpoint, featured section headers — Dark Red
- **Neutral** (#F9F9F9): Page backgrounds, section dividers — Light Gray
- **Background** (#FFFFFF): Main content background, article body — White
- **Surface** (#F2F2F2): Card backgrounds, sidebar panels, ticker backgrounds — Cool Gray
- **Text Primary** (#121212): Headlines, body text, primary content — Near Black
- **Text Secondary** (#5C5C5C): Bylines, timestamps, secondary metadata — Dark Gray
- **Border** (#D9D9D9): Dividers between stories, section separators, card outlines
- **Success** (#008060): Positive market movement, factcheck verified — Green
- **Warning** (#E8912D): Developing story, unverified report — Amber
- **Error** (#CC0000): Reuses primary red for alerts and breaking indicators

## Typography
- **Display Font**: Roboto — loaded from Google Fonts
- **Body Font**: Roboto — loaded from Google Fonts
- **Code Font**: Roboto Mono — loaded from Google Fonts

Roboto provides a neutral, authoritative voice appropriate for news delivery. Headlines use 900 (Black) weight with -0.02em letter-spacing for maximum impact and scannability. Subheadlines use 700 weight. Body text uses 400 weight at 1.65 line-height for long-form reading comfort. Bylines and metadata use 500 weight at 12px with 0.04em tracking in uppercase. Breaking news banners use 700 weight in all-caps with 0.06em tracking. The system supports rapid scanning through strong weight contrast between headlines (900) and body (400).

Type scale: 11px (metadata uppercase), 12px (byline/timestamp), 14px (body/caption), 16px (body large), 18px (h5/card headline), 22px (h4/section headline), 28px (h3/featured headline), 36px (h2/top story), 48px (h1/breaking news hero).

## Elevation
Newsdesk Red uses minimal elevation to maintain a clean, newspaper-like flat aesthetic. Level 0 is the base white surface. Level 1 uses `0 1px 3px rgba(0,0,0,0.08)` for sticky navigation and floating elements. Level 2 uses `0 4px 12px rgba(0,0,0,0.12)` for dropdown menus and live video overlays. Modals use `0 8px 24px rgba(0,0,0,0.15)`. The breaking news banner uses no shadow but a solid #CC0000 background that commands attention through color alone. Section separators use 3px #CC0000 top borders rather than shadows.

## Components
- **Buttons**: Primary — #CC0000 background, white text, 700 weight, 36px height (small) / 44px (default), 16px horizontal padding, 2px border-radius. Hover #A30000. Secondary — white background, 1px #D9D9D9 border, #121212 text. Ghost — transparent, #CC0000 text, 700 weight, hover underline. Subscribe button uses 44px height with uppercase 12px/700 tracking. All buttons use Roboto 500.
- **Cards**: Article cards use white background with no border or shadow. Content separated by 1px #D9D9D9 bottom border or 3px #CC0000 top border for featured sections. Image fills top, 0px border-radius (sharp edges for news aesthetic). Headline 18px/700 #121212, byline 12px/500 #5C5C5C uppercase, excerpt 14px/400 #5C5C5C truncated at 3 lines. Card padding 12px 0px (padding on text content only).
- **Inputs**: 44px height, white background, 1px #D9D9D9 border, 2px border-radius, 14px Roboto 400, #121212 text, #5C5C5C placeholder. Focus shows 2px #CC0000 border. Newsletter signup input often paired inline with a primary button.
- **Chips**: 24px height, 2px border-radius, 11px font, 700 weight, uppercase, 0.04em tracking. Breaking — #CC0000 background, white text. Live — #CC0000 background, white text, with pulsing red dot. Developing — #E8912D background, white text. Category chips — #F2F2F2 background, #121212 text.
- **Lists**: Article lists are vertically stacked with 1px #D9D9D9 dividers. Each row: optional thumbnail (16:9, 120px wide), headline (16px/700), byline, timestamp. Row height varies by content. Side-by-side layout for desktop (main story large left, list right). Live ticker at bottom uses horizontal scrolling 14px/500 on #121212 background with white text.
- **Checkboxes**: 16px square, 2px border-radius, 1px #D9D9D9 border, white background. Checked fills #CC0000 with white checkmark. Used sparingly — primarily in settings and preference panels.
- **Tooltips**: #121212 background, white text, 12px/400, 2px border-radius, 4px 8px padding. No shadow. Used for share buttons and interactive data visualizations. 0ms delay for news interactives.
- **Navigation**: Top bar with two tiers. Tier 1: 48px, white background, #CC0000 logo left-aligned, search and menu icons right-aligned. Tier 2: 40px, #121212 background, horizontal scrolling section links in white 12px/700 uppercase, 0.04em tracking. Breaking news banner: full-width #CC0000 background, white text, "BREAKING NEWS" prefix in 700 weight with pulsing effect. Sticky on scroll.
- **Search**: Overlay search on mobile (full screen, white background), inline expanding search on desktop. 48px height, 2px border-radius, 1px #D9D9D9 border. Results organized by: Top Stories, Recent, Video, with timestamps. Search suggestions in 14px #5C5C5C below.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
- Component padding: Buttons 8px 16px, article text 12px 0px, inputs 10px 14px, chips 4px 8px
- Section spacing: 32px between content sections, 16px between articles in a list
- Container max width: 1200px for article layout (main 780px + sidebar 300px + 20px gap)
- Card grid gap: 16px between grid articles, 0px between list articles (use border dividers)

## Border Radius
- 0px: Images, breaking news banner, video players (sharp editorial aesthetic)
- 2px: Buttons, inputs, chips, checkboxes, tooltips
- 4px: Dropdown menus, search results overlay
- 8px: Modals, preference panels, newsletter signup cards
- 9999px: Live indicator dots, notification badges

## Do's and Don'ts
- Do use the red sparingly and purposefully — reserve it for breaking news, live states, and primary CTAs
- Do maintain strict typographic hierarchy: 900 for hero, 700 for headlines, 400 for body
- Don't round image corners; sharp edges convey journalistic authority and urgency
- Do use timestamps prominently and update them in real-time ("2m ago", "LIVE")
- Don't use decorative animations; the only motion should be functional (loading, live indicators)
- Do provide clear visual distinction between breaking/developing/regular stories
- Don't use more than 2 column layouts for article text; readability requires constrained line lengths (60-75 characters)
- Do use the dark navigation bar to create separation between global nav and content
- Don't use light gray (#F9F9F9) text on white backgrounds; maintain minimum 4.5:1 contrast