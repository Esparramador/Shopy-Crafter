# Electric Volt

## Overview
A futuristic, minimal design system inspired by automotive luxury and sustainable technology. Electric Volt pairs a signature red accent with expansive dark surfaces and clean white typography to evoke the cockpit of a high-performance vehicle. The aesthetic is stark, confident, and forward-looking — vast negative space, razor-thin lines, and monolithic layouts communicate engineering precision and understated power.

## Colors
- **Primary** (#CC0000): Primary CTAs, active indicators, critical highlights — Tesla Red
- **Primary Hover** (#E60000): Hover state, brighter and more urgent
- **Secondary** (#393C41): Interactive secondary elements, toggle backgrounds — Steel Gray
- **Neutral** (#5C5E62): Secondary text, muted icons, disabled controls — Mid Gray
- **Background** (#000000): Primary background, pure black for OLED optimization
- **Surface** (#111111): Card surfaces, input backgrounds, elevated panels
- **Text Primary** (#FFFFFF): Headlines, primary labels, key content — Pure White
- **Text Secondary** (#A0A0A0): Descriptions, specs, supporting metadata
- **Border** (#2C2C2E): Dividers, input outlines, card edges — Dark Separator
- **Success** (#17B169): Charging complete, range sufficient, order confirmed
- **Warning** (#F5A623): Low charge warnings, service reminders, scheduled alerts
- **Error** (#CC0000): Reuses red — system errors, critical warnings, connection failures

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is used exclusively, leveraging its full weight range from 200 (Thin) to 700 (Bold) to create a typographic hierarchy through weight contrast alone. Hero text uses weight 200 at extremely large sizes for an ethereal, futuristic quality. Headlines use weight 600 for authority. Body text uses weight 400. All uppercase text uses generous tracking (0.1em+) for a precision-engineered feel. The single-typeface approach reinforces the philosophy of reduction — one font, perfected.

- **Hero**: Inter 80px/88px, weight 200, tracking -0.02em
- **Display**: Inter 56px/64px, weight 300, tracking -0.01em
- **Page Title**: Inter 36px/44px, weight 600, tracking -0.01em
- **Section Title**: Inter 24px/32px, weight 600
- **Subtitle**: Inter 18px/26px, weight 500
- **Body Large**: Inter 16px/26px, weight 400
- **Body**: Inter 14px/22px, weight 400
- **Label**: Inter 12px/16px, weight 500, tracking 0.1em, uppercase
- **Spec Value**: Inter 20px/28px, weight 300 (for numerical displays)
- **Code**: JetBrains Mono 14px/22px, weight 400

## Elevation
Elevation is extremely subtle on black backgrounds. Rather than shadows, depth is communicated through surface brightness and border lines. Level 0: #000000 (background). Level 1: #111111 with 1px #2C2C2E border (cards, panels). Level 2: #1A1A1A with no border (modals, drawers). Level 3: #222222 (popovers, dropdown menus). A signature glow effect is used for primary elements: 0 0 20px rgba(204,0,0,0.15) on hover for red-accented components. For the vehicle configurator, a dramatic spotlight shadow: 0 40px 80px rgba(0,0,0,0.6) beneath the car model.

## Components
- **Buttons**: Primary uses #CC0000 fill, white text, 48px height, 32px horizontal padding, 4px border-radius, Inter 14px weight 500 tracking 0.05em uppercase. Hover adds red glow (0 0 20px rgba(204,0,0,0.2)). Secondary has transparent background, 1px #5C5E62 border, white text. Tertiary is text-only in #FFFFFF. Extra-large CTA variant is 56px height, full-width, with 16px font. All transitions 200ms ease.
- **Cards**: #111111 background, 1px #2C2C2E border, 8px border-radius, 24px internal padding. Vehicle cards are full-bleed images with gradient overlay (transparent to #000000) and text overlay at bottom. Spec cards display a single value prominently (Inter 36px weight 300) with label below (12px uppercase). Hover on interactive cards lightens border to #5C5E62.
- **Inputs**: 48px height, #111111 background, 1px #2C2C2E border, 4px border-radius, 16px horizontal padding, white text, #5C5E62 placeholder. Focused: 1px #FFFFFF border. Error: 1px #CC0000 border. Label above in 12px weight 500 tracking 0.1em uppercase #A0A0A0.
- **Chips**: 4px border-radius, 1px #2C2C2E border, transparent background, #FFFFFF text, Inter 13px weight 400, 6px/16px padding. Selected: #FFFFFF background, #000000 text. Configuration option chips are larger (40px height) with thumbnail icons.
- **Lists**: Spec rows use two-column layout — label left in #A0A0A0 14px, value right in #FFFFFF 14px weight 500. Row height 48px. Separator is 1px #2C2C2E. Hover highlights row with #111111 background. Expandable rows use disclosure chevron in #5C5E62.
- **Checkboxes**: 20px square, 2px border-radius. Unchecked: 1px #5C5E62 border. Checked: #FFFFFF fill with #000000 checkmark. Toggle switches: 48px width, 28px height, #393C41 track, #FFFFFF thumb. Active track: #CC0000.
- **Tooltips**: #222222 background, white text, 4px border-radius, 8px/12px padding, Inter 13px. Arrow in matching color. Minimal shadow: 0 4px 12px rgba(0,0,0,0.3).
- **Navigation**: Full-width top bar, 80px height, #000000 background, transparent initially over hero. Logo centered (wordmark in Inter 18px weight 700 tracking 0.15em uppercase). Nav links flanking logo in 13px weight 400 tracking 0.05em uppercase #A0A0A0, hover #FFFFFF. CTA button right. Hamburger menu on mobile slides in from right, full-height, #111111 background.
- **Search**: Not prominently featured — navigation is direct. When present: 48px height, #111111 background, 4px border-radius, 1px #2C2C2E border, magnifying glass icon in #5C5E62.

## Spacing
- Base unit: 8px
- Scale: 4px, 8px, 16px, 24px, 32px, 48px, 64px, 80px, 120px, 160px
- Component padding: 24px standard, 48px for feature sections, 80px for hero areas
- Section spacing: 120px between major sections (generous breathing room), 48px between subsections
- Container max width: 1200px centered with 64px side margins (desktop), 24px (mobile)
- Card grid gap: 24px for spec grids, 48px for feature showcase grids

## Border Radius
- 2px: Badges, small status indicators, inline tags
- 4px: Buttons, inputs, chips, dropdown menus
- 8px: Cards, panels, modals, video players
- 12px: Large feature cards, configurator panels
- 9999px: Avatar circles, rounded toggle thumbs

## Do's and Don'ts
- Do use extreme whitespace — sections separated by 120px+ create a luxury, unhurried experience
- Do use Inter weight 200 for hero text to achieve a futuristic, lightweight aesthetic
- Don't use the red for anything beyond primary CTAs and critical states — restraint is the brand
- Do use pure black (#000000) as the primary background for OLED screen optimization
- Don't use colored backgrounds or gradients — the palette is monochromatic plus one accent
- Do display spec values (miles, seconds, horsepower) in large, light-weight typography
- Don't use rounded corners beyond 12px — this is a precision system, not a playful one
- Do use uppercase tracking (0.1em) for labels and navigation for an engineered quality
- Don't add visual embellishments — if an element isn't functional, remove it