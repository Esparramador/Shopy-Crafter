# Neon Scroll

## Overview
Neon Scroll is a bold, high-energy design system built for vertical content consumption on dark canvases. Electric aqua and vibrant pink collide against deep blacks, creating a neon-lit atmosphere that pulses with youth culture and creative expression. Every element is designed for full-screen, thumb-driven interaction — bold at a glance, effortless in motion.

## Colors
- **Primary** (#FE2C55): Primary CTAs, like hearts, notification badges, and key accents — TikTok Pink
- **Primary Hover** (#E5284D): Hover and pressed state for primary pink elements — Deep Rose
- **Secondary** (#25F4EE): Follow buttons, secondary accents, creator indicators — Electric Aqua
- **Neutral** (#8A8B91): Muted text, timestamps, inactive icons — Slate
- **Background** (#000000): Full-screen video backdrop, primary background — True Black
- **Surface** (#121212): Bottom sheets, overlays, comment panels, side menus — Onyx
- **Text Primary** (#FFFFFF): All primary text in dark mode, usernames, captions — White
- **Text Secondary** (#8A8B91): Timestamps, view counts, secondary metadata — Slate
- **Border** (#2F2F2F): Subtle dividers, input borders within dark surfaces — Charcoal Line
- **Success** (#2FCC71): Upload complete, verified creator badges — Neon Green
- **Warning** (#FFD21E): Content advisories, pending reviews — Electric Yellow
- **Error** (#FE2C55): Error states (shared with primary to maintain brand intensity) — TikTok Pink

## Typography
- **Display Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Body Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Plus Jakarta Sans delivers the modern geometric punch needed for bold overlays on video content. Display text uses weight 800 at 28px+ for maximum impact on dark backgrounds. Usernames use weight 700 at 16px. Body text and captions use weight 400 at 14px with 1.3 line-height for compact mobile layouts. Hashtags and mentions use weight 600. All text must maintain high contrast against black or video backgrounds — white is the default with no intermediate gray for primary text.

Type scale: 12px (micro/timestamp) / 14px (body/caption) / 16px (username) / 20px (section title) / 28px (effect text) / 36px (hero/splash)

## Elevation
In a dark-mode-first system, elevation is achieved through surface brightness rather than shadows. The base background is #000000, rising to #121212 for bottom sheets, #1A1A1A for modals, and #222222 for elevated cards. Shadows are rarely used since dark surfaces don't benefit from them. Instead, separation comes from brightness steps and subtle 1px #2F2F2F borders. The full-screen content scrim uses `linear-gradient(transparent 60%, rgba(0, 0, 0, 0.8))` from bottom for text readability over video.

## Components
- **Buttons**: Primary buttons have #FE2C55 background, white text, 4px border-radius, height 44px, padding 0 24px, font-weight 700, font-size 16px. Follow buttons use #FE2C55 initially then switch to #2F2F2F outline once followed. Secondary action buttons are transparent with 1px white border. Icon-only buttons on video overlay are 48px circular with no background (just white icons with drop-shadow for video contrast).
- **Cards**: Video cards are full-screen (100vh x 100vw) with snap-scroll behavior. No border-radius on feed view. Creator info overlays bottom-left with text-shadow for legibility. Action sidebar floats right with stacked circular icons (48px) for like, comment, share, and save. Discover page uses a 2-column grid with 4px gap, 4px border-radius, aspect ratio 9:16.
- **Inputs**: Comment input sits in a bottom bar, 40px height, #2F2F2F background, 20px border-radius, white placeholder text at 14px. Focus state adds 1px #8A8B91 border. Search input has #1A1A1A background, 8px border-radius, 44px height with magnifying glass icon in #8A8B91.
- **Chips**: Hashtag chips use #2F2F2F background, white text, 4px border-radius, 14px weight 600, padding 6px 12px. Trending chips add a tiny flame or chart icon prefix. Sound chips show a music note icon with scrolling text, 32px height, rounded.
- **Lists**: Comment list items have 36px circular avatars, username at weight 700, comment text at 14px weight 400, timestamp at 12px #8A8B91. Reply indent is 40px. Creator lists in search show 48px avatars with username, follower count, and follow button inline.
- **Checkboxes**: Custom 22px circular checkboxes (not square — matching the platform's rounded aesthetic). Unchecked shows 2px #8A8B91 border. Checked fills #FE2C55 with white checkmark. Used in privacy settings and content preferences.
- **Tooltips**: #2F2F2F background, white text, 8px border-radius, padding 8px 12px, font-size 13px. Arrow 5px. Used sparingly — most guidance is through onboarding overlays instead. Delay 200ms.
- **Navigation**: Bottom tab bar, 5 icons (Home, Discover, Create, Inbox, Profile), 56px height, #000000 background with 1px top border #2F2F2F. Active icon is white, inactive is #8A8B91. Center "Create" button is a special 48px wide pill with gradient or pink accent. No top nav bar in feed view — content is truly full-screen.
- **Search**: Discover search is top-positioned, 44px height, #1A1A1A background, 8px border-radius, with trending searches below as a scrollable tag row. Search results tab between Top, Users, Videos, Sounds, and Hashtags with horizontal pills as filters.

## Spacing
- Base unit: 4px
- Scale: 4px / 8px / 12px / 16px / 20px / 24px / 32px / 48px / 64px
- Component padding: Video overlay text 16px from edges, bottom sheets 16px 20px
- Section spacing: 0px between feed videos (snap scroll), 4px in discover grid
- Container max width: 480px (mobile-first, single column), 690px (desktop video)
- Card grid gap: 4px in discover grid, 0px in for-you feed

## Border Radius
- 2px: Micro badges, tiny indicators
- 4px: Standard buttons, discover grid thumbnails, hashtag chips
- 8px: Search inputs, bottom sheet tops, modals
- 16px: Large bottom sheets, share panels
- 9999px: Avatars, follow buttons, comment input, pill navigation, circular icon buttons

## Do's and Don'ts
- Do design for full-screen vertical video as the primary canvas — all UI overlays on content
- Do use text-shadow (0 1px 3px rgba(0, 0, 0, 0.6)) on all text overlaid on video
- Don't use light backgrounds; this is a dark-mode-only system
- Do keep the aqua (#25F4EE) and pink (#FE2C55) in tension — they create the brand's neon energy together
- Don't overuse both neon colors simultaneously; use pink for primary actions and aqua for secondary/follow states
- Do design all interactive targets at minimum 44px for thumb-driven mobile use
- Don't add heavy UI chrome — every pixel of chrome takes away from content
- Do use snap-scroll for vertical video feeds with exactly one video per viewport
- Don't use subtle or muted color choices; in a neon system, boldness is clarity
- Do animate aggressively — bouncing hearts, spinning music discs, sliding panels — motion is part of the personality