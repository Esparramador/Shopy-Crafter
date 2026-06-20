# Orange Cart

## Overview
A utilitarian, high-density design system built for commerce at massive scale. Orange Cart prioritizes information density, fast scanning, and frictionless purchasing over visual elegance. The aesthetic is functional and familiar — dense grids, clear price hierarchies, prominent trust signals, and a signature orange that universally means "buy now." Every design decision serves conversion.

## Colors
- **Primary** (#FF9900): Add to Cart buttons, deals, featured highlights — Amazon Orange
- **Primary Hover** (#E88B00): Hover and active state for orange elements
- **Secondary** (#232F3E): Header, footer, primary navigation background — Amazon Navy
- **Neutral** (#565959): Body text, secondary descriptions — Dark Gray
- **Background** (#FFFFFF): Primary page background, product detail areas
- **Surface** (#F0F2F2): Section backgrounds, comparison tables, sidebar — Light Gray
- **Text Primary** (#0F1111): Product titles, prices, primary content — Near Black
- **Text Secondary** (#565959): Feature bullets, seller info, metadata
- **Border** (#D5D9D9): Card outlines, section dividers, input borders — Silver Gray
- **Success** (#067D62): In stock status, Prime badge, verified purchase — Dark Teal
- **Warning** (#CC5500): Low stock warnings ("Only 3 left"), limited deals — Dark Orange
- **Error** (#B12704): Out of stock, price increases, coupon errors — Red Brown

## Typography
- **Display Font**: Source Sans 3 — loaded from Google Fonts
- **Body Font**: Source Sans 3 — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Source Sans 3 is used throughout, matching the humanist sans-serif character of the original system. Headlines use weight 700 for product titles and price displays. Body text uses weight 400 for descriptions and weight 600 for emphasis (review counts, feature highlights). The type scale is deliberately compact — large sizes are rare. Most content lives at 13-14px for maximum information density. Line heights are tight (1.3-1.4x) to pack more content above the fold.

- **Page Title**: Source Sans 3 28px/36px, weight 700
- **Section Title**: Source Sans 3 21px/28px, weight 700
- **Product Title**: Source Sans 3 18px/24px, weight 400 (titles are normal weight for scannability)
- **Price Large**: Source Sans 3 28px/32px, weight 700
- **Price Medium**: Source Sans 3 21px/24px, weight 400
- **Body**: Source Sans 3 14px/20px, weight 400
- **Body Small**: Source Sans 3 13px/18px, weight 400
- **Label**: Source Sans 3 12px/16px, weight 700
- **Deal Badge**: Source Sans 3 14px/16px, weight 700
- **Caption**: Source Sans 3 11px/14px, weight 400
- **Code**: JetBrains Mono 13px/18px, weight 400

## Elevation
Elevation is minimal and structural. Level 0: flat, no shadow — most elements. Level 1: 0 2px 5px rgba(15,17,17,0.08) — for product cards on hover and floating action bars. Level 2: 0 0 6px rgba(15,17,17,0.15) — for dropdown menus, mega-menus, and popovers. Borders are the primary separation method, not shadows. Cards use 1px #D5D9D9 borders to define boundaries. The header casts a subtle Level 1 shadow to separate it from content. Sticky elements (buy box, Add to Cart) use Level 2 when scrolled.

## Components
- **Buttons**: Add to Cart uses #FFD814 fill (Gold), #0F1111 text, 29px height, 12px/10px padding, 8px border-radius, Source Sans 3 13px weight 400. Buy Now uses #FFA41C fill (darker gold), same specs. Outlined button has 1px #D5D9D9 border, #0F1111 text, white fill. All buttons use a slight gradient (1px lighter at top). Hover darkens by 10%. Disabled grays out to 60% opacity.
- **Cards**: White background, 1px #D5D9D9 border, 8px border-radius, 12px internal padding. Product cards display: image (square, centered, white background), title (18px, #0F1111, max 3 lines), star rating (orange stars #FF9900 + count in #007185), price (21px weight 700), Prime badge (blue checkmark + "Prime" in #007185 13px weight 700), delivery date in #0F1111. Deal cards add red "Limited time deal" badge.
- **Inputs**: 31px height, white background, 1px #888C8C border, 4px border-radius, 7px horizontal padding, Source Sans 3 13px. Focused state: 3px #C8F3FA outline (cyan glow) with 1px #007185 border. Error state: red border with error below in #B12704. Dropdown selects have #F0F2F2 background, same sizing.
- **Chips**: Rectangular with 4px border-radius, 1px #D5D9D9 border, white background, Source Sans 3 13px weight 400, 4px/8px padding. Selected: #007185 border, #F3FCFF background, #007185 text. Filter chips in left sidebar use checkbox + label pattern.
- **Lists**: Product list items are horizontal with 200px thumbnail left, details right. Bullet points use Source Sans 3 14px with #232F3E bullet dots. Feature lists are indented 18px with custom bullet. Review lists show star bar chart, reviewer name, verified badge, review text (expandable at 300 chars).
- **Checkboxes**: 15px square, 2px border-radius, 1px #888C8C border. Checked: #007185 fill with white checkmark. Focused: cyan glow ring. Label in Source Sans 3 14px at 6px gap. Used extensively in filter sidebars.
- **Tooltips**: White background, 1px #D5D9D9 border, 8px border-radius, Level 2 shadow, #0F1111 text at 13px, 8px/12px padding. Information tooltips triggered by (i) icon.
- **Navigation**: Top bar #232F3E, 60px height. Logo left, delivery location with pin icon, search bar center (flex-grow, 44px height, category dropdown left, #FEBD69 search button right), account/orders/cart right. Sub-navigation bar #37475A with department links in white 14px. Search is the most prominent element at 50%+ width.
- **Search**: Dominant element in header. 44px height, white background, 4px border-radius (right side squared for button attachment). Category dropdown left (Source Sans 3 12px, #555555, separate select). Orange search button right (#FEBD69 background, magnifying glass icon). Suggestions dropdown: white, full search bar width, categorized sections.

## Spacing
- Base unit: 4px (tighter base for high density)
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px
- Component padding: 12px standard, 16px for cards and content sections
- Section spacing: 24px between major sections, 12px between related groups
- Container max width: 1500px centered with 18px side margins (desktop), 12px (mobile)
- Card grid gap: 16px (product grids), 8px (compact deal grids)

## Border Radius
- 2px: Badges, small status pills
- 4px: Inputs, dropdowns, filter chips, small buttons
- 8px: Cards, buttons, tooltips, modals
- 12px: Image containers, large panels
- 9999px: Coupon code pills, avatar circles, rounded badges

## Do's and Don'ts
- Do prioritize information density — users are scanning, not browsing
- Do show price prominently with the largest weight in any product display
- Don't use the orange (#FF9900) for text — it fails accessibility contrast on white backgrounds
- Do use #007185 (teal) for all text links — it's the established interactive text color
- Don't add decorative whitespace — every pixel should serve commerce
- Do show social proof (ratings, review counts, "Best Seller" badges) near product titles
- Don't hide the Add to Cart button — it must be visible without scrolling on product pages
- Do use the gold gradient (#FFD814 to #FFA41C) for purchase buttons to differentiate from other CTAs
- Don't use light font weights — dense layouts require weight 400 minimum for body text readability
- Do support keyboard navigation with visible cyan focus rings on all interactive elements