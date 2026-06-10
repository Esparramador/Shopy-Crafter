# CodeCademy Design System

## Overview

CodeCademy is a dark, focused, and code-first design system built for coding bootcamp and developer education platforms. It treats the code editor as the hero of every screen, with a dark-mode environment that reduces eye strain during long sessions. Bright green signals success and progress, warm orange draws attention to hints and guidance, and cool blue highlights informational elements -- all against a deep slate canvas that feels like home to developers.

---

## Colors

- **Primary** (#4ADE80): Success, run, primary actions
- **Secondary** (#60A5FA): Links, info, documentation
- **Tertiary** (#FB923C): Hints, warnings, tips
- **Surface Base** (#0F172A): Page background
- **Surface Editor** (#0B1120): Dedicated editor well
- **Success** (#4ADE80): Tests passing, code compiled
- **Warning** (#FB923C): Deprecation, hints
- **Error** (#F87171): Errors, failed tests
- **Info** (#60A5FA): Documentation links, tips

## Typography

- **Headline Font**: Fira Code
- **Body Font**: Inter
- **Mono Font**: Fira Code

- **h1**: Fira Code 30px bold, 1.25 line height. Page titles.
- **h2**: Fira Code 24px bold, 1.3 line height. Section headings.
- **h3**: Fira Code 20px medium, 1.35 line height. Subsection headings.
- **h4**: Fira Code 17px medium, 1.4 line height. Card / panel titles.
- **body**: Inter 15px regular, 1.65 line height. Instruction text.
- **sm**: Inter 13px regular, 1.5 line height. Captions, metadata.
- **xs**: Inter 11px medium, 1.4 line height. Badges, line numbers.
- **mono**: Fira Code 14px regular, 1.7 line height. Code editor text.

---

## Spacing

Base unit: **4px** (compact, code-dense)
- **sp-1**: 4px — Inline gaps, code line padding
- **sp-2**: 8px — Tight padding, tag margins
- **sp-3**: 12px — Input inner padding
- **sp-4**: 16px — Panel padding
- **sp-5**: 20px — Card inner padding
- **sp-6**: 24px — Section gaps
- **sp-7**: 32px — Panel-to-panel spacing
- **sp-8**: 48px — Major section breaks

## Border Radius

- **radius-sm** (2px): Inline code, tiny elements
- **radius-md** (4px): Buttons, inputs, cards
- **radius-lg** (6px): Modals, feature panels
- **radius-pill** (9999px): Status badges, tags
- **radius-circle** (50%): Avatars, status indicators

## Elevation (Dark-Mode Glow)

- **shadow-sm**: 1px offset, 2px blur, #000000 at 40%. Subtle depth.
- **shadow-md**: 2px offset, 8px blur, #000000 at 50%. Cards, panels.
- **shadow-lg**: 4px offset, 16px blur, #000000 at 60%. Modals, overlays.
- **shadow-focus**: 2px ring #4ADE80 at 40%. Focus rings.
- **glow-success**: 12px glow #4ADE80 at 25%. Tests passing.
- **glow-error**: 12px glow #F87171 at 25%. Tests failing.
- **glow-hint**: 12px glow #FB923C at 25%. Hint highlight.

## Components

### Buttons
#### Variants
- **Primary**: #4ADE80 fill, #0F172A text, no border. Hover: #22C55E.
- **Secondary**: transparent fill, #60A5FA text, 1px #60A5FA border. Hover: #1E293B.
- **Ghost**: transparent fill, #94A3B8 text, no border. Hover: #1E293B.
- **Destructive**: #F87171 fill, #0F172A text, no border. Hover: #EF4444.
#### Sizes
Sizes: Small (4px 10px, 13px, 4px), Medium (8px 16px, 14px, 4px), Large (10px 20px, 16px, 4px).
#### Disabled State
0.35 opacity, disabled cursor.
- No hover/focus effects
- No glow applied

### Cards
#1E293B fill, 1px #334155 border, 4px radius, 20px padding, shadow-md shadow, shadow-lg hover shadow, border-color 0.15s ease transition, #475569 hover border.
Variants: **Lesson Card** (with language icon + progress bar), **Challenge Card** (difficulty badge + XP reward), **Project Card** (tech stack icons + completion ring).

### Inputs
- **Default**: #334155 border color, #0F172A fill, no shadow.
- **Hover**: #475569 border color, #0F172A fill, no shadow.
- **Focus**: #4ADE80 border color, #0F172A fill, shadow-focus shadow.
- **Error**: #F87171 border color, #1A0A0A fill, glow-error shadow.
- **Disabled**: #1E293B border color, #0B1120 fill, no shadow.
4px corners, #F1F5F9 text. Fira Code 14px. 8px/12px padding.

### Chips
#### Filter Chips
- **Default**: #1E293B fill, #94A3B8 text, 1px #334155 border.
- **Selected**: #0F2E1F fill, #4ADE80 text, 1px #4ADE80 border.
- **Hover**: #334155 fill, #F1F5F9 text, 1px #475569 border.
#### Status Chips
- **Completed**: #0F2E1F fill, #4ADE80 text.
- **In Progress**: #1E293B fill, #60A5FA text.
- **Locked**: #1E293B fill, #475569 text.
- **Error**: #2D1215 fill, #F87171 text.
radius-pill corners. 4px/10px padding, 11px, weight 500 font size, Fira Code font family.

### Lists
10px 16px row padding, 1px #1E293B divider, #1E293B hover background, #0F2E1F active background, 2px left border #4ADE80 active indicator, 14px font size.
Variants: **Lesson Sidebar** (tree-structured, collapsible), **File Explorer** (indented, with file-type icons), **Console Output** (monospaced, timestamped lines).

### Checkboxes
- **Unchecked**: #334155 border, #0F172A fill.
- **Checked**: #4ADE80 border, #4ADE80 fill, #0F172A checkmark.
- **Indeterminate**: #4ADE80 border, #4ADE80 fill, #0F172A checkmark.
- **Disabled**: #1E293B border, #0F172A fill, #334155 checkmark.
16px, 2px corners. `background 0.1s ease` transition.

### Radio Buttons
- **Unselected**: #334155 outer border, #0F172A fill.
- **Selected**: #4ADE80 outer border, #4ADE80 fill, #0F172A fill.
- **Hover**: #4ADE80 outer border, #1E293B fill.
- **Disabled**: #1E293B outer border, #334155 fill, #0F172A fill.
16px. 8px inner dot, circle shape.

### Tooltips
#334155 fill, #F1F5F9 text, 12px font size, Fira Code font family, 6px 10px padding, 4px radius, 260px max width, 5px triangle arrow, 200ms show, 50ms hide delay, shadow-md shadow.
---

## Do's and Don'ts

### Do's

1. **Use a split-pane layout** -- instructions on the left, code editor on the right (or top/bottom on mobile); the editor must always be visible during lessons.
2. **Apply syntax highlighting consistently** -- use a cohesive color scheme for keywords (#C084FC), strings (#4ADE80), numbers (#FB923C), comments (#64748B), and functions (#60A5FA).
3. **Show progress indicators everywhere** -- course completion bars, lesson checkmarks, and module progress rings keep learners oriented in lengthy curricula.
4. **Style console output carefully** -- differentiate stdout (white), stderr (red/orange), and system messages (gray) with clear typographic and color distinctions.
5. **Support keyboard-first interaction** -- developers expect shortcuts; ensure all major actions (run code, submit, next lesson, toggle hint) have keyboard bindings.

### Don'ts

1. **Don't use light backgrounds in the editor area** -- the code editor must always be dark; light-mode editors cause eye strain during extended coding sessions.
2. **Don't hide the run button** -- the ability to execute code should be the most prominent action on any lesson screen; anchor it visually with the primary green.
3. **Don't mix serif fonts into the interface** -- this is a developer tool; stick to monospace for headings and sans-serif for body to maintain a technical aesthetic.
4. **Don't auto-close brackets without user control** -- provide auto-close as an option, but never assume; some learners find it disorienting.
5. **Don't show solutions without a confirmation step** -- require a deliberate "Reveal Solution" action with a warning that it affects progress metrics.
6. **Don't neglect mobile readability** -- even on small screens, code must remain readable; use horizontal scroll for code blocks rather than wrapping lines that break indentation.