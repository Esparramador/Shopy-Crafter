# Orange Forum

## Overview
Orange Forum is a community-driven design system inspired by the internet's front page. It prioritizes content density, threaded conversation, and the democratic upvote/downvote mechanic. The aesthetic is utilitarian and unpretentious — designed to handle massive amounts of user-generated content with clear hierarchy, readable typography, and that iconic burst of orange that signals engagement and participation.

## Colors
- **Primary** (#FF4500): Upvotes, key CTAs, brand moments, join/subscribe buttons — OrangeRed
- **Primary Hover** (#E03D00): Hovered upvote arrows and primary action buttons
- **Secondary** (#0079D3): Links, community badges, secondary actions — Reddit Blue
- **Neutral** (#878A8C): Metadata text, timestamps, vote counts, muted icons
- **Background** (#DAE0E6): Page background, the cool gray canvas behind all content
- **Surface** (#FFFFFF): Post cards, comment containers, sidebar panels, modal backgrounds
- **Text Primary** (#1C1C1C): Post titles, comment body text, headings
- **Text Secondary** (#7C7C7C): Flair text, moderator notes, secondary descriptions
- **Border** (#EDEFF1): Card borders, dividers between comments, section separators
- **Success** (#46D160): Awarded posts, successful actions, online status indicators
- **Warning** (#FFB000): Gilded/awarded content, NSFW tags, caution states
- **Error** (#FF585B): Downvote active state, removal notices, error messages

## Typography
- **Display Font**: IBM Plex Sans — loaded from Google Fonts
- **Body Font**: IBM Plex Sans — loaded from Google Fonts
- **Code Font**: IBM Plex Mono — loaded from Google Fonts

IBM Plex Sans is used at weights 400, 500, and 700 throughout the interface. Post titles use 500 or 700 weight depending on prominence, with default letter-spacing to maximize scannability in dense feeds. Body text (comments, descriptions, sidebar content) uses 400 weight at 14px for compact readability. Metadata lines (posted by, time ago, comment count) use 12px at 400 weight in #878A8C. IBM Plex Mono is used for code blocks in technical subreddits. The type scale optimizes for scanning: 12px (metadata/flair), 14px (body/comments), 16px (post titles in card view), 18px (post titles in classic view), 22px (community names), 28px (page titles).

## Elevation
Cards float above the #DAE0E6 background using a 0 2px 4px rgba(0, 0, 0, 0.05) shadow combined with a 1px solid #EDEFF1 border. Dropdowns and popovers use 0 4px 12px rgba(0, 0, 0, 0.1) for clear separation. Modals employ 0 8px 24px rgba(0, 0, 0, 0.15) with a rgba(0, 0, 0, 0.4) backdrop overlay. Hover on post cards increases shadow to 0 2px 8px rgba(0, 0, 0, 0.08). The overall approach is subtle and functional — elevation clarifies layering without drawing attention to itself.

## Components
- **Buttons**: Primary uses #FF4500 background with #FFFFFF text, 9999px radius (fully rounded pill), 14px 24px padding, 700 weight, 32px height. Secondary uses #0079D3. Outline variant uses transparent background with 1px border matching text color. Subscribe/Join button is prominently rounded with #0079D3 fill.
- **Cards**: #FFFFFF background, 1px solid #EDEFF1 border, 4px radius, 8px padding. Post cards include a left vote column (40px wide) with upvote/downvote arrows and score. Hover state adds subtle shadow lift. Classic view uses compact rows with no card separation.
- **Inputs**: #FFFFFF background, 1px solid #EDEFF1 border, 4px radius, 10px 16px padding, 14px font. Focus state applies 1px solid #0079D3 border. The post creation input mimics a card with avatar + "Create a post" placeholder, full-width, clickable to expand.
- **Chips**: Flair chips use custom community colors with 4px radius, 4px 8px padding, 12px font, 500 weight. Filter chips (Hot, New, Rising, Top) use pill shape (9999px radius), 24px height, #EDEFF1 background, #1C1C1C text. Active filter uses #0079D3 background with white text.
- **Lists**: Comment threads use left-border indentation — each nesting level indents 22px with a 2px left border in #EDEFF1 (hoverable to collapse). Flat lists of posts use 1px bottom border #EDEFF1. Community lists in sidebar use 32px rows with community icon + name.
- **Checkboxes**: Used in settings and mod tools. 18x18px, #FFFFFF background, 2px solid #878A8C border, 2px radius. Checked state fills #0079D3 with white checkmark.
- **Tooltips**: #1C1C1C background, #FFFFFF text, 4px radius, 6px 10px padding, 12px font. Used for vote counts, award descriptions, and user karma breakdowns. Arrow positioned below trigger.
- **Navigation**: Top nav is #FFFFFF with 1px bottom border #EDEFF1, 48px height. Features centered search bar with #F6F7F8 background, logo on left, user actions on right. Subreddit tabs use pill-shaped selectors. Left sidebar lists subscribed communities with icons.
- **Search**: Full-width search bar in top nav, #F6F7F8 background, 9999px radius, 36px height. Typeahead dropdown shows communities, users, and trending topics grouped in sections. Active/focused state has #EDEFF1 border.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px
- Component padding: Buttons 14px 24px, post cards 8px, comments 8px 16px, inputs 10px 16px
- Section spacing: 8px between post cards in feed, 16px between sidebar sections
- Container max width: 1200px with sidebar (740px content + 312px sidebar + gap)
- Card grid gap: 8px between post cards in card view, 0px in classic view

## Border Radius
- 2px: Checkboxes, code blocks, flair badges
- 4px: Cards, inputs, dropdowns, comment containers, modals
- 8px: Image previews, embedded media, community icons (square)
- 20px: Community banner images, profile headers
- 9999px: Buttons, filter pills, search bar, avatar images, notification badges

## Do's and Don'ts
- Do use #FF4500 sparingly — reserve it for upvote arrows, key CTAs, and brand accents only
- Do maintain high content density — users come to scan many posts quickly
- Do support nested threading with clear visual indentation and collapsible branches
- Do use pill-shaped (9999px radius) buttons for all primary actions
- Don't let any single post card exceed the viewport height — truncate with "read more"
- Don't use heavy shadows — the light gray background (#DAE0E6) provides enough card separation
- Don't override community flair colors — they are user/mod customized and sacred
- Don't use the primary orange for text links — links should always be #0079D3 blue