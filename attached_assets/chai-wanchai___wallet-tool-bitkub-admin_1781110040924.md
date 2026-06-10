# Wallet Tool Design System

An internal admin dashboard for Bitkub's wallet operations. Built on Material UI v7 + Tailwind CSS with full light/dark theme support. The aesthetic is professional and data-dense — optimised for operators who live in tables, dialogs, and forms all day.

---

## Brand

**Product:** Wallet Tool (Bitkub internal admin)
**Brand color:** `#009EF6` (light) / `#3699FF` (dark)
**Font:** Inter, Helvetica, sans-serif
**Logo:** Bitkub animated logo (Lottie)

---

## Color Palette

### Primary

| Token | Light | Dark |
|---|---|---|
| primary | `#009EF6` | `#3699FF` |

### Neutral

| Token | Light | Dark |
|---|---|---|
| neutral-1 | `#FFFFFF` | `#1E1E2D` |
| neutral-2 | `#F5F8FA` | `#262639` |
| neutral-3 | `#EFF2F5` | `#2B2B40` |
| neutral-4 | `#E4E6EF` | `#323248` |
| neutral-5 | `#B5B5C3` | `#474761` |
| neutral-6 | `#A1A5B7` | `#4C4C66` |
| neutral-7 | `#7E8299` | `#6D6D80` |
| neutral-8 | `#5E6278` | `#9A9AB0` |
| neutral-9 | `#282D4B` | `#AAAAC2` |
| neutral-10 | `#181C32` | `#FFFFFF` |

### Sky (Brand Blue)

| Variant | Light | Dark |
|---|---|---|
| base | `#009EF6` | `#187DE4` |
| light | `#ECF8FF` | `#212E48` |
| dark | `#0081C9` | `#4BAEFF` |

### Green (Success)

| Variant | Light | Dark |
|---|---|---|
| base | `#50CD89` | `#04AA77` |
| light | `#E8FFF3` | `#1C3238` |
| dark | `#47BE7D` | `#04AA77` |

### Red (Danger)

| Variant | Light | Dark |
|---|---|---|
| base | `#F1416C` | `#F1416C` |
| light | `#FFF5F8` | `#3A2434` |
| light-2 | `#FFE2E5` | — |
| dark | `#D9214E` | `#EE2D41` |

### Orange (Warning)

| Variant | Light | Dark |
|---|---|---|
| base | `#FFA621` | `#FF9D00` |
| light | `#FFF0D9` | `#392F28` |
| dark | `#E98C00` | `#FF9D00` |

### Yellow

| Variant | Light |
|---|---|
| base | `#FFC700` |
| light | `#FFF8DD` |
| dark | `#F1BC00` |

### Purple

| Variant | Light | Dark |
|---|---|---|
| base | `#7239EA` | `#8950FC` |
| light | `#F8F5FF` | `#2F264F` |
| dark | `#5014D0` | `#7239EA` |

### Deep Purple

| Variant | Light |
|---|---|
| base | `#5F5CF1` |
| light | `#F0EFFF` |
| dark | `#3F3CE1` |

### Teal (Blue-Green)

| Variant | Light |
|---|---|
| base | `#04C8C8` |
| light | `#DCFDFD` |
| dark | `#00AFAF` |

### Mint

| Variant | Light |
|---|---|
| base | `#4AB58E` |
| light | `#DFF1EB` |
| dark | `#2BA579` |

### Blue

| Variant | Light |
|---|---|
| base | `#366CF9` |
| light | `#F1F5FF` |
| dark | `#4A7DFF` |

### Indigo

| Variant | Light |
|---|---|
| base | `#3445E5` |
| light | `#F1F3FF` |
| dark | `#1B2CCF` |

### Custom (Sidebar/Nav)

| Token | Value |
|---|---|
| custom-1 | `#80808F` |
| custom-2 | `#494B74` |
| custom-3 | `#1D1D30` |
| custom-4 | `#1A1A27` |
| custom-5 | `#1B1B28` |

---

## Typography

**Family:** `Inter, Helvetica, sans-serif`
**CSS Variable:** `--font-inter`

| Style | Weight | Size | Line Height | Usage |
|---|---|---|---|---|
| h1 | 700 | 40px | 48px | Page titles |
| h2 | 700 | 32px | 40px | Section headings |
| h3 | 700 | 28px | 32px | Sub-sections |
| h4 | 700 | 24px | 32px | Card headings |
| h5 | 700 | 20px | 24px | Dialog titles |
| h6 | 700 | 18px | 24px | Widget titles |
| title | 600 | 16px | 24px | Table column headers |
| body1semibold | 600 | 14px | 20px | Emphasized body |
| body1 | 400 | 14px | 24px | Default body text |
| body2semibold | 600 | 12px | 16px | Labels, chips |
| body2 | 400 | 13px | 16px | Secondary text |
| button1semibold | 600 | 14px | 16px | Primary buttons |
| button1 | 400 | 14px | 16px | Secondary buttons |
| button2semibold | 600 | 12px | 16px | Small primary buttons |
| button2 | 400 | 12px | 16px | Small secondary buttons |
| caption | 400 | 10px | 16px | Timestamps, meta |
| hyperlink | 400 | 10px | 8px | Inline links |
| remark | 400 | 8px | 8px | Fine print |

---

## Spacing & Layout

**Grid system:** 24-column Tailwind grid (`repeat(24, minmax(0, 1fr))`)
**Base unit:** 4px (Tailwind default)

Common spacing values used across components:

| Use | Value |
|---|---|
| Table cell padding (default) | 16px |
| Table cell padding (dense) | 8px |
| Table head row padding | 20px top/bottom |
| Dialog padding | 24px |
| Card body gap | 8px–16px |

---

## Elevation & Shadow

| Token | Value | Usage |
|---|---|---|
| card-body | `0px 0px 20px rgba(63,66,84,0.04)` | Data cards |
| paper | `0px 0px 30px 0px rgba(63,66,84,0.04)` | MUI Paper |
| dialog | `0px 0px 30px 0px rgba(63,66,84,0.09)` | Modal dialogs |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| standard | `6px` | Cards, Paper, inputs |
| dialog | `12px` | Modal dialogs |
| button | `6px` | All button types |

---

## Buttons

Seven semantic button variants:

| Variant | Background | Text Color | Border |
|---|---|---|---|
| PRIMARY | `#009EF6` | `#FFFFFF` | none |
| SECONDARY | `#F5F8FA` | `#5E6278` | none |
| SECONDARY_BACK_STEP | `#E4E6EF` | `#181C32` | none |
| DANGER | `#F1416C` | `#FFFFFF` | none |
| SUCCESS | `#50CD89` | `#FFFFFF` | none |
| OUTLINE_PRIMARY | `#FFFFFF` | `#009EF6` | `1px solid #009EF6` |
| OUTLINE_DANGER | `#FFF5F8` | `#F1416C` | `1px solid #F1416C` |

Hover states darken: DANGER → `#902740`, SUCCESS → `#2E855E`

---

## Component Library

42 shared UI components in `src/components/`:

**Inputs & Forms**
- Input, TextField, Select, SelectMultiple, Autocomplete
- Checkbox, Radio, BooleanRadioGroup, ToggleSwitch
- CustomDatePicker, CustomDatePickerRange, DatePicker, CustomTimePicker
- WalletToolImageInput

**Feedback & Overlay**
- Alert, Snackbar, DialogAlert
- BlockerDialog, RetryDialog, GlobalDialog, LoadingOverlay
- BitkubLoading (Lottie animated)

**Navigation & Layout**
- Tabs, SelectTab, FormStep
- Card, SelectionCard

**Data Display**
- TableColumnName, TableNoData, TableSortIcon
- CodeBlock, CustomTimeline, CustomPagination

**Controls**
- Button, ButtonMenu, MenuItem
- DropdownFilter, DropdownImage
- ParallexParticles, Question

**Value Display**
- BooleanValue, BooleanValue2

---

## Feature Modules

22 domain modules in `src/modules/`:

- accessControlManagement
- activityLog
- airdrop
- appConfigs
- assetTransfer
- auth
- blacklistWallet
- coinConfig
- coinDetail
- coinListing
- coinRecovery
- data
- diffConfig
- errors
- feeAdjustment
- listingTool
- network
- preFundMonitoring
- requestTicket
- specialBlacklist
- transactionManagement
- withdrawBucketManagement

---

## Data Table Styles

Two table density modes:

**Default Table**
- Head background: `#F5F8FA`
- Head text: `#A1A5B7`
- Cell padding: `16px`
- Row hover: subtle overlay, `0.15s` transition

**Dense Table**
- Same palette, cell padding: `8px`
- Used for high-density data grids

---

## Global Styles

- Font smoothing: `antialiased`
- Custom scrollbar: hidden on `.no-scrollbar`
- Tailwind directives: `@tailwind base / components / utilities`
- react-datepicker styles imported globally

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (Pages Router) |
| UI library | Material UI v7 |
| Utility CSS | Tailwind CSS |
| CSS-in-JS | Emotion |
| Module CSS | SCSS Modules |
| State | Redux Toolkit + Redux Saga |
| Data fetching | React Query (TanStack) |
| Forms | React Hook Form + Yup |
| Crypto math | decimal.js / mathjs |
| Date | dayjs (Asia/Bangkok TZ) |
| Auth | next-auth v4 (Okta) |
