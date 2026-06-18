---
name: VismeFormHero — Video Background + Animated Form Section
description: Fullscreen landing section with a video background character + right-side multi-step form that builds itself in sync with a video action at a configurable timestamp. Fully adaptable to any client, video, form fields, and brand colors.
version: 1.0
project_origin: shopify-optimizer / Shopy Crafter
---

# VismeFormHero — Template & Prompt

## What it is

A fullscreen `fp-section` (fullPage.js-compatible) that:
- Plays a **portrait/character video** as the background (object-fit: cover, centered-left)
- Applies a **gradient overlay** (horizontal desktop / vertical mobile) to keep character visible
- At a configurable **video timestamp (TRIGGER_TIME)**, the form panel builds itself in phases
- The form is a **multi-step React form** that submits to `/api/contact`
- On mobile, layout collapses to vertical with video as backdrop and form below

---

## Variables to replace per client

| Variable | Shopify Crafter value | Replace with |
|---|---|---|
| `VIDEO_SRC` | `/assets/videos/alec_landing.mp4` | Client's character video path |
| `POSTER_SRC` | `/assets/videos/alec_poster.jpg` | First frame thumbnail |
| `TRIGGER_TIME` | `4.5` (seconds) | Timestamp in video when key action happens |
| `PILL_TEXT` | `"TRABAJA CON NOSOTROS"` | CTA label text |
| `HEADLINE_1` | `"Cuéntanos sobre"` | Hero headline line 1 |
| `HEADLINE_2` | `"tu negocio."` | Hero headline line 2 (italic/gold) |
| `SUBTITLE` | `"Análisis de tu tienda... — 100% gratis."` | Subheadline |
| `NICHES` | Array of product niches | Client's industry options |
| `REVENUES` | Array of revenue ranges | Adapt to client's market |
| `SERVICES` | Array of service checkboxes | Client's service offering |
| `BUTTON_TEXT` | `"Siguiente →"` | CTA button copy |
| `BRAND_GOLD` | `#d4a843` / `#e6c668` | Client primary brand color |
| `BRAND_BG` | `rgba(10,8,4,.88)` | Panel background (dark) |
| `API_ENDPOINT` | `/api/contact` | Backend contact endpoint |
| `FORM_FIELDS` | name, email, phone, storeUrl, niche... | Client's required fields |

---

## Architecture

```
VismeFormHero
│
├── <style> — 12 keyframe animations (all prefixed vfh-)
│     ├── vfhBlink      — typewriter cursor
│     ├── vfhSlideIn    — panel slides in from right
│     ├── vfhRiseIn     — fields fade up
│     ├── vfhSpringIn   — button spring bounce
│     ├── vfhInputGlow  — gold border glow on field appear
│     └── vfhBob        — waiting hint bob
│
├── <video> — full section absolute, object-fit cover, object-position left center
│     ├── IntersectionObserver (threshold 0.15) — play/pause on visibility
│     ├── timeupdate → setFormReady(true) at TRIGGER_TIME
│     └── ended → freeze on last frame (currentTime = duration - 0.05)
│
├── Gradient overlay div — linear-gradient to darken right 45%
│
├── Waiting hint (shown before formReady)
│     └── "Observa cómo [character] sale del cuadro..." with bob animation
│
└── Form panel (shown after formReady)
      ├── Build phases (0..5 via setTimeout cascade):
      │     Phase 1 +0ms     — panel slides in + TypewriterText heading
      │     Phase 2 +1450ms  — first fields appear (vfh-input-glow)
      │     Phase 3 +2150ms  — second fields
      │     Phase 4 +2800ms  — submit button (spring)
      │     Phase 5 +3300ms  — progress dots
      │
      └── Multi-step form (step 0..N via useState)
            Step 0 — Basic info (name, email, phone)
            Step 1 — Business details (niche, revenue, store URL)
            Step 2 — Services checkboxes + message
            Step N — Submit → POST /api/contact
```

---

## CSS Layout rules

```css
/* Section fills the full fp-section */
.fp-contact-visme {
  position: absolute !important;
  inset: 0 !important;
  max-width: none !important;
  width: 100% !important;
  display: flex;
  align-items: center;
}

/* Video fills from behind */
.vfh-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
}

/* Overlay darkens right side for form readability */
.vfh-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 25%, rgba(4,3,2,.6) 55%, rgba(4,3,2,.92) 100%);
}

/* Form panel — right-aligned */
.vfh-panel {
  position: relative;
  z-index: 2;
  margin-left: auto;
  width: clamp(280px, 32vw, 400px);
  margin-right: clamp(24px, 5vw, 80px);
}
```

### Mobile overrides (≤900px / ≤768px)

```css
@media (max-width: 780px) {
  .vfh-overlay {
    /* Switch to vertical fade — character visible at top, form below */
    background: linear-gradient(180deg,
      rgba(4,3,2,.18) 0%,
      rgba(4,3,2,.55) 35%,
      rgba(4,3,2,.88) 60%,
      rgba(4,3,2,.96) 100%
    );
  }
  .vfh-panel {
    position: absolute;
    top: 36%;
    left: 0; right: 0;
    margin: 0 auto;
    width: min(92vw, 430px);
  }
  .vfh-panel h2 { font-size: clamp(15px, 4vw, 18px); }
}
```

---

## Form submission — generic backend contract

```typescript
POST /api/contact
Content-Type: application/json  (or multipart/form-data if refFile attached)

Body: {
  name: string
  email: string
  phone: string
  // ... any additional client fields
  services: string[]   // JSON array of selected service IDs
}

Response 200: { ok: true }
Response 4xx: { error: string }
```

---

## Video sync timing guide

| Video action | Recommended TRIGGER_TIME |
|---|---|
| Character completes main gesture | gesture_end + 0.2s |
| Object thrown / tipped | throw_frame + 0.5s |
| Character looks at camera | eye_contact_frame + 0.3s |
| Character walks off screen | walk_exit_frame + 0.1s |
| Text card shown on screen | card_appear_frame |

Measure the timestamp using: `videoElement.currentTime` in browser devtools.

---

## Effect variants (future)

### Variant A (current): Slide in from right
Panel slides in from `translateX(38px)` at `TRIGGER_TIME`.

### Variant B: "From the bag" / object reveal
- Set transform-origin to the video object's screen position
- Start: `scale(0.04) skewX(18deg) skewY(22deg)` + `border-radius:50%` + `blur(6px)`
- Animate to: `scale(1) skewX(0) skewY(0)` + `border-radius:16px`
- Add particles/emojis flying from origin point
- See `BagFormEffect.tsx` in mockup-sandbox for live demo

### Variant C: Typewriter only
- No slide, form is already in position
- Each field reveals itself via TypewriterText
- Simpler, works for any video

### Variant D: Portal / warp-in
- Form starts with `perspective(400px) rotateY(90deg)` (flat)
- Animates to `perspective(400px) rotateY(0)` with spring easing
- Creates a "door opening" / portal reveal effect

---

## Prompt to replicate for a new client

```
Create a VismeFormHero component based on the template at .agents/templates/visme-form-hero-template.md.

Client details:
- Video: [PATH_TO_VIDEO]
- Poster (first frame): [PATH_TO_POSTER]
- Video trigger timestamp: [X.X] seconds (action: "[DESCRIBE ACTION]")
- Brand primary color: [HEX]
- Brand background (dark): [HEX with alpha]
- Headline: "[LINE 1]" / "[LINE 2 — italic/brand-color]"
- Subtitle: "[SUBTITLE TEXT]"
- Pill text: "[CTA PILL]"
- Waiting hint: "[DESCRIBE what happens in the video before trigger]"
- Form fields: [LIST_FIELDS with types and validation rules]
- Form steps: [STEP_1_FIELDS] / [STEP_2_FIELDS] / [STEP_3_FIELDS]
- Niches / options: [LIST if applicable]
- Submit endpoint: [ENDPOINT]
- Effect variant: [A: slide-right | B: object-reveal | C: typewriter | D: portal]

If variant B: specify the screen % position (x, y) of the video object that "releases" the form.
```

---

## Files involved

| File | Role |
|---|---|
| `src/components/VismeFormHero.tsx` | Main component |
| `src/pages/landing.css` | `.fp-contact-visme`, `.vfh-*` mobile overrides |
| `src/pages/Landing.tsx` | Mounts as `<section id="fp-contact">` |
| `public/assets/videos/[name].mp4` | Character video |
| `public/assets/videos/[name].jpg` | Poster image |
| `server/routes/contact.ts` | Form submission API |
