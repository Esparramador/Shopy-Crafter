# Purple Stream

## Overview
Purple Stream is a bold, dark-mode-native design system inspired by the world's leading live streaming platform. It pulses with electric purple energy against deep black backgrounds, designed to keep viewers immersed in live content for hours. The aesthetic is gaming-adjacent and entertainment-first — high contrast, vibrant accents, and an interface that recedes behind the stream while providing dense, real-time information through chat, overlays, and interactive panels.

## Colors
- **Primary** (#9146FF): Brand moments, follow buttons, live indicators, featured badges — Twitch Purple
- **Primary Hover** (#A970FF): Hovered interactive elements, brighter purple for affordance
- **Secondary** (#BF94FF): Secondary accents, lighter purple for tags, tooltips, subtle highlights
- **Neutral** (#ADADB8): Body text, descriptions, viewer counts, secondary labels
- **Background** (#0E0E10): Page background, the deep void behind all content — Midnight Black
- **Surface** (#18181B): Cards, sidebar, chat panel, dropdown menus, modal backgrounds
- **Text Primary** (#EFEFF1): Primary text, usernames, headings, stream titles — near-white
- **Text Secondary** (#ADADB8): Descriptions, categories, view counts, timestamps
- **Border** (#2F2F35): Panel borders, dividers, input outlines, card separation
- **Success** (#00C853): Subscription events, raid notifications, successful actions
- **Warning** (#FFCA28): Moderator badges, subscriber milestones, hype train indicators
- **Error** (#EB0400): Ban actions, stream offline indicator, error states, report confirmations

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is used at weights 400, 600, and 700 throughout the interface. Stream titles use 700 weight at 18px for maximum scannability in browse directories. Channel names use 600 weight at 14px. Body text and descriptions use 400 weight at 13px — slightly smaller than typical to accommodate the dense, multi-panel layout. Chat messages use 13px at 400 weight with emotes rendered inline at 28px. Category tags use 600 weight at 12px uppercase with 0.04em letter-spacing. The type scale prioritizes density: 11px (badges/timestamps), 13px (body/chat/descriptions), 14px (channel names), 16px (section titles), 18px (stream titles), 24px (page headings), 34px (marketing hero).

## Elevation
Dark interfaces rely on surface color rather than shadow for hierarchy. The base layer is #0E0E10, panels and sidebars lift to #18181B, popovers and dropdowns to #1F1F23, and modals to #252528 with a rgba(0, 0, 0, 0.7) backdrop. The video player has no shadow — it fills its container as the visual anchor. Hover states on cards use a subtle box-shadow of 0 0 0 2px #9146FF (purple outline glow) rather than a traditional elevation shadow, creating a "selected" feel that fits the gaming aesthetic.

## Components
- **Buttons**: Primary uses #9146FF background with #FFFFFF text, 4px radius, 8px 16px padding, 600 weight, 30px height. Destructive variant uses transparent background with #EB0400 text. Follow button is a signature element — #9146FF fill, heart icon + "Follow" text. Subscribe button uses a secondary style. Hover brightens to #A970FF. All buttons use uppercase text at 13px with 0.02em letter-spacing.
- **Cards**: Stream preview cards use #18181B background, 0px border radius on the thumbnail (flush to card edges), 6px bottom radius on the info section. Thumbnail shows live viewer count badge (red #EB0400 dot + count) in top-left and stream duration in top-right. Hover reveals a purple border glow (0 0 0 2px #9146FF) and auto-plays the stream preview.
- **Inputs**: #18181B background, 1px solid #2F2F35 border, 4px radius, 8px 10px padding, 13px font. Focus state applies 2px solid #9146FF border. Chat input spans the full width of the chat panel with a 40px height and submit button integrated on the right.
- **Chips**: Category tags use #2F2F35 background, #EFEFF1 text, 4px radius, 4px 8px padding, 12px font, 600 weight. Live tags use #EB0400 background with white "LIVE" text, 2px radius, uppercase. Subscriber badges use gradient backgrounds (purple to blue) with custom emote icons.
- **Lists**: Channel recommendations in the sidebar use 42px rows with avatar (30px circle), channel name, category, and live viewer count. Active/watching channel highlights with #9146FF left border accent. Category directories use a grid of cards, not lists.
- **Checkboxes**: Used in settings panels. 18x18px, #18181B background, 2px solid #2F2F35 border, 2px radius. Checked state fills #9146FF with white checkmark. Toggle switches are preferred over checkboxes in most settings — 36x20px, #2F2F35 off state, #9146FF on state.
- **Tooltips**: #18181B background with 1px solid #2F2F35 border, #EFEFF1 text, 6px radius, 6px 10px padding, 12px font. Used extensively for icon-only toolbar buttons and user badges. Positioned above with arrow.
- **Navigation**: Top nav is #18181B with no bottom border (bleeds into content), 50px height. Left sidebar is collapsible (50px collapsed, 240px expanded), #1F1F23 background, showing followed channels with live status. Top nav features category browsing dropdown, search center, and user controls right.
- **Search**: Central search input in top nav, #18181B background, #2F2F35 border, 4px radius, 36px height. Typeahead shows live channels first (with viewer count), then categories, then past searches. Results dropdown uses #18181B background with #2F2F35 dividers.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 10px, 16px, 20px, 24px, 32px, 40px, 60px
- Component padding: Buttons 8px 16px, cards 0px (thumbnail flush) + 10px (info), chat messages 4px 10px, inputs 8px 10px
- Section spacing: 20px between directory rows, 40px between page sections
- Container max width: Fluid — content fills available space minus sidebars (left 240px, right chat 340px)
- Card grid gap: 16px horizontal, 24px vertical in stream directory grids

## Border Radius
- 2px: Live badge, small labels, code blocks
- 4px: Buttons, inputs, category tags, dropdowns
- 6px: Cards, modals, panels, tooltips
- 10px: Stream thumbnail hover preview, emote picker
- 9999px: Avatar images, notification count badges, pill-shaped filters

## Do's and Don'ts
- Do use #9146FF purple as the signature interactive color — it defines the brand identity
- Do keep the interface dark — the video stream is the brightest element on every page
- Do support dense real-time information (viewer counts, chat speed, live duration) without clutter
- Do use hover-to-preview on stream thumbnails — instant engagement is core to the browsing experience
- Do use uppercase with letter-spacing for small labels and button text for a sporty, gaming feel
- Don't use white or light backgrounds anywhere in the main interface — dark mode is mandatory
- Don't let UI elements compete with the video player for visual attention
- Don't animate slowly — all transitions should be under 100ms to feel snappy and game-like
- Don't use the primary purple for body text — it's reserved for interactive elements only