# Gradient Story

## Overview
Gradient Story is a vibrant, visual-first design system inspired by the warmth and energy of photo-sharing culture. It embraces bold gradient accents that flow from deep purple through hot pink to sunset orange, creating an atmosphere of creativity, self-expression, and connection. Every element is designed to recede behind visual content, letting images and stories take center stage.

## Colors
- **Primary** (#E1306C): Main actions, like buttons, active states, and key interactive elements — Rosetta Pink
- **Primary Hover** (#C13584): Hovered or pressed state for primary actions — Deep Orchid
- **Secondary** (#833AB4): Secondary accents, gradient start points, and story ring highlights — Royal Purple
- **Accent** (#F77737): Gradient endpoint, notification badges, and warm highlight moments — Sunset Orange
- **Neutral** (#8E8E8E): Secondary text, timestamps, and inactive icons — Pewter Gray
- **Background** (#FFFFFF): Main app background, feed canvas — White
- **Surface** (#FAFAFA): Card backgrounds, story tray, comment sections — Alabaster
- **Text Primary** (#262626): Usernames, captions, primary readable text — Near Black
- **Text Secondary** (#8E8E8E): Timestamps, follower counts, secondary labels — Pewter Gray
- **Border** (#DBDBDB): Dividers, input borders, card outlines — Silver Edge
- **Success** (#58C322): Verified badges, successful uploads, confirmation states — Lime Success
- **Warning** (#FDCB6E): Content warnings, pending states — Marigold
- **Error** (#ED4956): Delete confirmations, error states, heart animations — Coral Red

## Typography
- **Display Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Body Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Plus Jakarta Sans is used throughout for its geometric warmth and modern personality. Display headings use weight 700 with -0.02em letter-spacing for a tight, confident feel. Body text uses weight 400 at 14px for comfortable reading in feed contexts, and weight 600 for usernames and interactive labels. Caption text sits at 12px weight 400. The type scale is intentionally compact to maximize space for visual content.

Type scale: 12px (caption) / 14px (body) / 16px (subtitle) / 20px (title) / 24px (section heading) / 32px (page heading)

## Elevation
Elevation is used sparingly to keep the interface flat and content-focused. The primary elevation is a subtle bottom border (#DBDBDB) rather than shadows. Modals and overlays use `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)` for a gentle lift. Story viewer overlays use a full black scrim at 65% opacity. Dropdown menus use `box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.0975)` for a barely-there float. The design philosophy avoids heavy shadows in favor of border-based separation.

## Components
- **Buttons**: Primary buttons use a gradient background (`linear-gradient(45deg, #F77737, #E1306C, #833AB4)`) with white text, 8px border-radius, height 44px, font-weight 600, font-size 14px. Secondary buttons are outlined with 1px border #DBDBDB, transparent background. Follow buttons are compact at height 32px, font-size 13px. Disabled state reduces opacity to 0.3.
- **Cards**: Feed cards have no border-radius, full-width on mobile. White background, separated by 1px solid #DBDBDB top and bottom. Header section has 14px padding with 32px avatar, username at weight 600, and three-dot menu. Image area is square (1:1) or 4:5 aspect ratio. Action bar sits below with 24px icon targets and 12px padding.
- **Inputs**: Search inputs have #EFEFEF background, 8px border-radius, height 36px, centered placeholder text at 14px weight 300. Comment inputs are borderless with just a bottom 1px #DBDBDB divider, placeholder "Add a comment..." at 14px. Focus state adds a subtle #E1306C bottom border.
- **Chips**: Story highlight covers use 56px circles with 2px gradient border ring (`linear-gradient(45deg, #F77737, #E1306C, #833AB4)`). Category chips are pill-shaped with #EFEFEF background, 14px padding horizontal, font-size 13px, weight 600.
- **Lists**: Notification list items are 60px height with 44px avatars, left-aligned. Activity text uses mixed weights (600 for usernames, 400 for actions). Unread items have #FAFAFA background tint. Suggestion lists display in horizontal scroll with 64px avatar circles.
- **Checkboxes**: Custom circular checkboxes, 24px diameter, unchecked shows 2px #DBDBDB border. Checked fills with gradient and shows white checkmark. Used primarily in multi-select photo picking.
- **Tooltips**: Dark tooltips with #262626 background, white text, 6px border-radius, 8px 12px padding, font-size 12px. Arrow indicator at 6px. Appears on hover after 400ms delay.
- **Navigation**: Bottom tab bar with 5 icons (Home, Search, Create, Reels, Profile), 48px height, icons at 24px. Active icon fills solid #262626, inactive is outlined #262626. Top nav bar is 44px height with centered logo and action icons right-aligned.
- **Search**: Explore search has full-width input with magnifying glass icon, #EFEFEF background, 10px border-radius. Results show in a grid of recent searches with X to clear. Trending tags display as a vertical list with hashtag icon prefix.

## Spacing
- Base unit: 4px
- Scale: 4px / 8px / 12px / 16px / 20px / 24px / 32px / 44px / 64px
- Component padding: Cards 0px horizontal (full-bleed), 12px internal padding for text areas
- Section spacing: 24px between feed cards, 16px between UI sections
- Container max width: 470px (feed), 935px (profile grid), 100% mobile
- Card grid gap: 3px (profile grid), 2px (explore grid)

## Border Radius
- 0px: Feed cards on mobile, full-bleed images
- 4px: Comment bubbles, minor UI elements
- 8px: Buttons, search inputs, dropdown menus
- 12px: Modals, dialog boxes, share sheets
- 9999px: Avatars, story rings, pill chips, follow buttons

## Do's and Don'ts
- Do use the gradient sparingly — reserve it for story rings, primary CTAs, and brand moments
- Do keep the interface minimal so visual content remains the hero
- Don't use heavy drop shadows; prefer flat design with subtle borders
- Do maintain square or 4:5 aspect ratios for content images
- Don't use more than two font weights in a single component
- Do use circular avatars consistently at 32px (feed), 44px (lists), 56px (stories), and 150px (profile)
- Don't place text over images without a proper gradient scrim overlay
- Do animate interactions subtly — heart pop, double-tap burst, smooth transitions under 300ms
- Don't introduce new colors outside the defined palette; the gradient is the only decoration needed