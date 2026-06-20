# ComplianceOne Design System

## Overview

ComplianceOne is a strict, audit-trail-aware design system purpose-built for regulatory compliance and audit management platforms. Every design decision favors clarity, traceability, and zero ambiguity. The flat, borderless aesthetic with sharp corners reinforces the seriousness of compliance workflows while keeping dense regulatory data accessible.

---

## Colors

- **Primary** (#1E40AF): Primary actions, navigation
- **Secondary** (#DC2626): Violations, non-compliance
- **Tertiary** (#059669): Compliant, passed, approved
- **Background** (#FFFFFF): Page background
- **Surface** (#FFFFFF): Cards, panels
- **Success** (#059669): Compliant, audit passed
- **Warning** (#D97706): Pending review, at risk
- **Error** (#DC2626): Non-compliant, violation
- **Info** (#2563EB): Policy references, notes

## Typography

- **Headline Font**: Zilla Slab
- **Body Font**: Inter
- **Mono Font**: Fira Code

- **h1**: 28px bold, 36px line height. Page titles.
- **h2**: 22px semibold, 28px line height. Section headings.
- **h3**: 18px semibold, 24px line height. Card headings.
- **h4**: 15px semibold, 20px line height. Subsection labels.
- **body**: 14px regular, 22px line height. General content.
- **small**: 12px regular, 18px line height. Footnotes, timestamps.
- **mono**: 13px regular, 20px line height. Regulation codes, IDs.

---

## Spacing

Base unit: **4px**
- **xs**: 4px — Tight gaps, inline icons
- **sm**: 8px — Form field gaps
- **md**: 12px — Component internal padding
- **lg**: 16px — Card padding
- **xl**: 24px — Section gaps
- **2xl**: 32px — Panel spacing
- **3xl**: 48px — Layout margins

## Border Radius

- **None** (0px): All components (default)
- **sm** (0px): Not used — sharp corners
- **md** (0px): Not used — sharp corners
- **full** (9999px): Status dots only
All interactive elements use **0px border-radius** to reinforce the strict, no-nonsense visual language.

## Elevation

Flat with borders is the primary elevation model. Shadows are reserved for overlays only.
- **sm**: 1px offset, 2px blur, #000000 at 4%. Dropdown menus.
- **md**: 2px offset, 6px blur, #000000 at 6%. Popovers.
- **lg**: 4px offset, 16px blur, #000000 at 10%. Modals only.
- **focus**: 2px ring #1E40AF at 30%. Focus ring.

## Components

### Buttons
#### Variants
- ****Primary****: #1E40AF fill, #FFFFFF text, no border, #1E3A8A fill.
- ****Secondary****: Transparent fill, #1E40AF text, 1.5px #1E40AF border, #EFF6FF fill.
- ****Ghost****: Transparent fill, #475569 text, no border, #F1F5F9 fill.
- ****Destructive****: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: sm (4px 10px, 12px, 28px), md (6px 14px, 14px, 36px), lg (8px 20px, 14px, 44px).
#### Disabled State
0.4 opacity, disabled cursor.
- No hover, focus, or active states

### Cards
- ****Default****: #FFFFFF fill, 1.5px #E2E8F0 border, no shadow, square.
- ****Elevated****: #FFFFFF fill, 1.5px #CBD5E1 border, sm shadow, square.
16px padding, Zilla Slab 600, bottom border 1.5px #E2E8F0 header.

### Inputs
- **Default**: #CBD5E1 border, #FFFFFF fill, no shadow.
- **Hover**: #94A3B8 border, #FFFFFF fill, no shadow.
- **Focus**: #1E40AF border, #FFFFFF fill, focus` ring shadow.
- **Error**: #DC2626 border, #FEF2F2 fill, no shadow.
- **Disabled**: #E2E8F0 border, #F8FAFC fill, no shadow.
36px, padding: 6px 12px, radius: 0px tall, Inter 600, 12px, `text-primary`, uppercase, tracking 0.5px, 4px bottom margin **label**, Inter 400, 12px, `text-tertiary`, 4px margin-top; errors use `error` color with icon prefix **helper text**.

### Chips
- ****Filter****: #F1F5F9 fill, #0F172A text, 1px #E2E8F0 border, square.
- ****Status****: varies fill, varies text, no border, square.
Status chip semantic mapping:
bg #DCFCE7, text #059669 compliant, bg #FEF3C7, text #D97706 at risk, bg #FEE2E2, text #DC2626 non-compliant, bg #DBEAFE, text #2563EB under review.

### Lists
Inter 400 14px. 44px row height, 10px/16px padding, 1px #E2E8F0 divider. Hover: background #F8FAFC. Selected: background #EFF6FF, left border 3px #1E40AF.

### Checkboxes
16px square, radius: 0px. Unchecked: border 1.5px #CBD5E1, background white. Checked: background #1E40AF, border #1E40AF, white checkmark. Indeterminate: background #1E40AF, white dash. Disabled: 40% opacity. Labels in 8px gap Inter 400 14px.

### Radio Buttons
16px circle. Unchecked: border 1.5px #CBD5E1, background white. Selected: border 2px #1E40AF, inner dot 8px #1E40AF. Disabled: 40% opacity. Labels in 8px gap Inter 400 14px.

### Tooltips
#0F172A fill, #FFFFFF, Inter 400, 12px text, square, `md` shadow. 6px/10px padding, 5px arrow, 280px max width.
---

## Do's and Don'ts

1. **Do** use monospace font for all regulation codes, policy IDs, and audit reference numbers.
2. **Do** keep sharp 0px corners consistently across every component — no exceptions.
3. **Don't** use decorative colors or gradients; compliance interfaces demand clarity over aesthetics.
4. **Do** include timestamps and user attribution on every state change for audit trail integrity.
5. **Don't** auto-dismiss error or warning banners — users must explicitly acknowledge compliance issues.
6. **Do** use strong contrast ratios (minimum WCAG AAA) for all critical compliance text.
7. **Don't** combine secondary red and tertiary green without icons — always pair color with a supporting icon for accessibility.
8. **Do** present regulatory citations in monospace with clear reference links.
9. **Don't** allow bulk actions on compliance items without a confirmation step.
10. **Do** design every form with required field indicators and inline validation.