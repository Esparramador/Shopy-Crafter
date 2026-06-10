# ESportsArena Design System

## Overview

ESportsArena is an aggressive, angular, competition-fueled design system built for eSports tournament platforms and competitive gaming applications. A stark palette of red, black, and electric blue divides the visual landscape into team-coded zones and high-contrast action areas. Compact spacing and bold display typography deliver information at the speed competitive gamers demand.

---

## Colors

- **Primary Red** (#DC2626): Primary actions, Team A coding
- **Secondary Black** (#0A0A0A): Backgrounds, strong contrast
- **Tertiary Electric Blue** (#2563EB): Team B coding, secondary actions
- **Background** (#0A0A0A): Page background
- **Surface Default** (#141414): Card backgrounds
- **Success** (#22C55E): Victory, online status
- **Warning** (#F59E0B): Match starting, queue warnings
- **Error** (#DC2626): Defeat, disconnection, errors
- **Info** (#2563EB): Brackets, stats, information

## Typography

- **Headline Font**: Anton
- **Body Font**: Inter
- **Mono Font**: JetBrains Mono

- **Display**: Anton 48px regular, 1.05 line height
- **H1**: Anton 36px regular, 1.1 line height
- **H2**: Anton 28px regular, 1.15 line height
- **H3**: Anton 22px regular, 1.2 line height
- **H4**: Anton 18px regular, 1.25 line height
- **Body LG**: Inter 16px regular, 1.5 line height
- **Body**: Inter 14px regular, 1.5 line height
- **Body SM**: Inter 12px regular, 1.4 line height
- **Caption**: Inter 11px medium, 1.3 line height
- **Code**: JetBrains Mono 13px regular, 1.5 line height

---

## Spacing

Base unit: **4px** (compact)
- **xs**: 2px — Tight inline gaps
- **sm**: 4px — Minimum component padding
- **md**: 8px — Default padding
- **lg**: 16px — Card padding
- **xl**: 24px — Section gaps
- **2xl**: 32px — Layout sections
- **3xl**: 48px — Page-level spacing

## Border Radius

Subtle, angular radii for an aggressive, sharp feel.
- **sm** (2px): Badges, stat pills
- **DEFAULT** (4px): Buttons, cards, inputs
- **md** (4px): Modals, panels
- **lg** (6px): Large containers
- **full** (9999px): Player avatars, status dots

## Elevation

Colored glow shadows (red/blue) for team-coded highlights.
- **sm**: 4px glow #DC2626 at 25%. Red-glow small elements.
- **DEFAULT**: 10px glow #DC2626 at 30%. Red-glow cards.
- **md**: 20px glow #DC2626 at 40%. Red-glow elevated panels.
- **lg**: 40px glow #DC2626 at 50%. Red-glow featured/hero.
- **blue-sm**: 4px glow #2563EB at 25%. Blue-glow small elements.
- **blue-DEFAULT**: 10px glow #2563EB at 30%. Blue-glow cards.
- **blue-md**: 20px glow #2563EB at 40%. Blue-glow elevated panels.
- **blue-lg**: 40px glow #2563EB at 50%. Blue-glow featured/hero.

## Components

### Buttons
#### Variants
- **Primary**: #DC2626 fill, #FFFFFF text, no border. Hover: bg #B91C1C, glow sm.
- **Secondary**: transparent fill, #2563EB text, 1px #2563EB border. Hover: bg #2563EB15, blue-glow.
- **Ghost**: transparent fill, #A3A3A3 text, no border. Hover: bg #1E1E1E.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border. Hover: bg #991B1B, glow md.
#### Sizes
Sizes: sm (4px 10px, 12px, 28px), md (6px 16px, 14px, 36px), lg (8px 24px, 16px, 44px).
#### Disabled State
0.3 opacity.
- disabled cursor
- All glow effects removed; flat matte appearance
---

### Cards
- **Default**: #141414 fill, 1px #2E2E2E border, no shadow, 4px radius.
- **Elevated**: #1E1E1E fill, 1px #DC262640 border, DEFAULT shadow, 4px radius.
** 16px **padding, ** left border 3px in #DC2626 (red team) or #2563EB (blue team) **team coding, ** border brightens, glow shadow transitions in over 150ms **hover.
---

### Inputs
- **Default**: 1px #2E2E2E border, #141414 fill, no shadow.
- **Hover**: 1px #DC2626 border, #141414 fill, no shadow.
- **Focus**: 2px #DC2626 border, #141414 fill, 3px ring #DC2626 at 20% shadow.
- **Error**: 2px #F87171 border, #141414 fill, 3px ring #F87171 at 25% shadow.
- **Disabled**: 1px #1E1E1E border, #0A0A0A fill, no shadow.
** 36px | **Padding:** 6px 10px | **Radius:** 4px **height, ** Inter 12px/500, color #F5F5F5, bottom margin 4px, uppercase, tracking 0.5px **label, ** Inter 11px/400, color #A3A3A3, top margin 4px **helper text, ** Inter 11px/400, color #F87171, top margin 4px **error text.
---

### Chips
- **Filter**: #141414 fill, #A3A3A3 text, 1px #2E2E2E border.
- **Filter Active**: #DC2626 fill, #FFFFFF text, no border.
- **Status Success**: #22C55E20 fill, #22C55E text, no border.
- **Status Warning**: #F59E0B20 fill, #F59E0B text, no border.
- **Status Error**: #DC262620 fill, #F87171 text, no border.
** 2px 10px | **Radius:** 2px | **Font:** Inter 11px/500, uppercase, tracking 0.8px **padding.
---

### Lists
** 40px **row height, ** 6px 12px **padding, ** 1px #1E1E1E **divider, ** #1E1E1E **hover background, ** #DC26260D **active background, ** Inter 14px/400 #F5F5F5 for label, 12px/400 #A3A3A3 for description **font, ** JetBrains Mono 14px/700, color #DC2626 for top 3, #A3A3A3 otherwise **rank column.
---

### Checkboxes
** 16px x 16px | **Radius:** 2px **size, ** border 2px #2E2E2E, background #141414 **unchecked, ** background #DC2626, border none, checkmark #FFFFFF, box-shadow sm **checked, ** background #DC2626, dash #FFFFFF **indeterminate, ** 30% opacity, disabled cursor **disabled, ** 6px left of label text **label spacing.
---

### Radio Buttons
** 16px x 16px | **Radius:** full (circle) **size, ** border 2px #2E2E2E, background #141414 **unchecked, ** border 2px #DC2626, inner dot 8px #DC2626, box-shadow sm **selected, ** 30% opacity, disabled cursor **disabled, ** 6px left of label text **label spacing.
---

### Tooltips
** #1E1E1E **background, ** #F5F5F5, Inter 11px/400 **text, ** 1px #2E2E2E **border, ** 4px 10px | **Radius:** 4px **padding, ** 5px triangle matching background **arrow, ** 200px **max width, ** 100ms show, 0ms hide **delay.
---

## Do's and Don'ts

1. **Do** use Red (#DC2626) and Electric Blue (#2563EB) to code opposing teams, brackets, or factions.
2. **Do** keep layouts compact; the 4px base spacing reflects the density competitive users expect.
3. **Do** use Anton for all headings; its aggressive, condensed style embodies competitive energy.
4. **Don't** mix team colors in a single element -- a card is either red-coded or blue-coded, never both.
5. **Don't** use large border radii; the 4px maximum keeps the angular, aggressive aesthetic intact.
6. **Do** use the glow shadow system to highlight live matches, active players, and featured content.
7. **Don't** sacrifice readability for style; ensure minimum 4.5:1 contrast on all text against #0A0A0A.
8. **Do** display match timers, scores, and stats in JetBrains Mono for precision and quick scanning.
9. **Don't** slow down the interface with heavy transitions; keep animations under 150ms for responsiveness.
10. **Do** use uppercase labels with tight tracking on chips and status indicators to match the competitive tone.