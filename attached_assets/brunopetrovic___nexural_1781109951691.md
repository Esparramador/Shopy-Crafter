---
version: "alpha"
name: "Nexus Neural Framework"
description: "Nexus Neural Background Effect is designed for delivering a visual treatment or immersive background effect. Key features include atmospheric visuals, motion depth, and flexible presentation layering. It is suitable for visual-first pages, motion studies, and atmospheric hero treatments."
colors:
  primary: "#C4F042"
  secondary: "#0C0C0C"
  tertiary: "#4EF746"
  neutral: "#0C0C0C"
  background: "#0C0C0C"
  surface: "#121212"
  text-primary: "#FFFFFF"
  text-secondary: "#A3A3A3"
  border: "#FFFFFF"
  accent: "#C4F042"
typography:
  display-lg:
    fontFamily: "System Font"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: "48px"
    letterSpacing: "-0.025em"
  body-md:
    fontFamily: "System Font"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22.75px"
  label-md:
    fontFamily: "System Font"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  md: "5px"
spacing:
  base: "6px"
  sm: "1px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  gap: "8px"
  card-padding: "9px"
  section-padding: "32px"
components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "8px"
  button-link:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "0px"
    padding: "0px"
---

## Overview

- **Composition cues:**
  - Layout: Flex
  - Content Width: Full Bleed
  - Framing: Open
  - Grid: Minimal

## Colors

The color system uses dark mode with #C4F042 as the main accent and #0C0C0C as the neutral foundation.

- **Primary (#C4F042):** Main accent and emphasis color.
- **Secondary (#0C0C0C):** Supporting accent for secondary emphasis.
- **Tertiary (#4EF746):** Reserved accent for supporting contrast moments.
- **Neutral (#0C0C0C):** Neutral foundation for backgrounds, surfaces, and supporting chrome.

- **Usage:** Background: #0C0C0C; Surface: #121212; Text Primary: #FFFFFF; Text Secondary: #A3A3A3; Border: #FFFFFF; Accent: #C4F042

## Typography

Typography relies on System Font across display, body, and utility text.

- **Display (`display-lg`):** System Font, 48px, weight 500, line-height 48px, letter-spacing -0.025em.
- **Body (`body-md`):** System Font, 14px, weight 400, line-height 22.75px.
- **Labels (`label-md`):** System Font, 12px, weight 500, line-height 16px.

## Layout

Layout follows a flex composition with reusable spacing tokens. Preserve the flex, full bleed structural frame before changing ornament or component styling. Use 6px as the base rhythm and let larger gaps step up from that cadence instead of introducing unrelated spacing values.

Treat the page as a flex / full bleed composition, and keep that framing stable when adding or remixing sections.

- **Layout type:** Flex
- **Content width:** Full Bleed
- **Base unit:** 6px
- **Scale:** 1px, 6px, 8px, 10px, 12px, 16px, 24px, 32px
- **Section padding:** 32px
- **Card padding:** 9px
- **Gaps:** 8px, 12px, 16px, 20px

## Elevation & Depth

Depth is communicated through elevated, border contrast, and reusable shadow or blur treatments. Keep those recipes consistent across hero panels, cards, and controls so the page reads as one material system.

Surfaces should read as elevated first, with borders, shadows, and blur only reinforcing that material choice.

- **Surface style:** Elevated
- **Borders:** 1px #FFFFFF; 1px #2A2A2A
- **Shadows:** rgba(196, 240, 66, 0.6) 0px 0px 8px 0px

## Shapes

Shapes rely on a tight radius system anchored by 5px and scaled across cards, buttons, and supporting surfaces. Icon geometry should stay compatible with that soft-to-controlled silhouette.

Use the radius family intentionally: larger surfaces can open up, but controls and badges should stay within the same rounded DNA instead of inventing sharper or pill-only exceptions.

- **Corner radii:** 5px, 6px, 9999px
- **Icon treatment:** Linear
- **Icon sets:** Solar

## Components

Anchor interactions to the detected button styles.

### Buttons
- **Primary:** background #0C0C0C, text #FFFFFF, radius 5px, padding 8px, border 0px solid rgb(229, 231, 235).
- **Links:** text #A3A3A3, radius 0px, padding 0px, border 0px solid rgb(229, 231, 235).

### Iconography
- **Treatment:** Linear.
- **Sets:** Solar.

## Do's and Don'ts

Use these constraints to keep future generations aligned with the current system instead of drifting into adjacent styles.

### Do
- Do use the primary palette as the main accent for emphasis and action states.
- Do keep spacing aligned to the detected 6px rhythm.
- Do reuse the Elevated surface treatment consistently across cards and controls.
- Do keep corner radii within the detected 5px, 6px, 9999px family.

### Don't
- Don't introduce extra accent colors outside the core palette roles unless the page needs a new semantic state.
- Don't mix unrelated shadow or blur recipes that break the current depth system.
- Don't exceed the detected moderate motion intensity without a deliberate reason.

## Motion

Motion feels controlled and interface-led across text, layout, and section transitions. Timing clusters around 150ms and 300ms. Easing favors ease and cubic-bezier(0.4. Hover behavior focuses on text and color changes. Scroll choreography uses GSAP ScrollTrigger for section reveals and pacing.

**Motion Level:** moderate

**Durations:** 150ms, 300ms, 500ms

**Easings:** ease, cubic-bezier(0.4, 0, 0.2, 1)

**Hover Patterns:** text, color

**Scroll Patterns:** gsap-scrolltrigger

## WebGL

Reconstruct the graphics as a inset 3d accent using webgl, renderer, alpha, antialias, dpr clamp, custom shaders. The effect should read as retro-futurist, technical, and meditative: dot-matrix particle field with green on black and sparse spacing. Build it from dot particles + soft depth fade so the effect reads clearly. Animate it as slow breathing pulse. Interaction can react to the pointer, but only as a subtle drift. Preserve dom fallback.

**Id:** webgl

**Label:** WebGL

**Stack:** ThreeJS, WebGL

**Insights:**
  - **Scene:**
    - **Value:** Inset 3D accent
  - **Effect:**
    - **Value:** Dot-matrix particle field
  - **Primitives:**
    - **Value:** Dot particles + soft depth fade
  - **Motion:**
    - **Value:** Slow breathing pulse
  - **Interaction:**
    - **Value:** Pointer-reactive drift
  - **Render:**
    - **Value:** WebGL, Renderer, alpha, antialias, DPR clamp, custom shaders

**Techniques:** Dot matrix, Breathing pulse, Pointer parallax, Shader gradients, DOM fallback

**Code Evidence:**
  - **HTML reference:**
    - **Language:** html
    - **Snippet:**
      ```html
      
      ```
  - **JS reference:**
    - **Language:** html
    - **Snippet:**
      ```html
      
      ```

## ThreeJS

Reconstruct the Three.js layer as a inset 3d accent with layered spatial depth that feels retro-futurist, volumetric, and technical. Use alpha, antialias, dpr clamp renderer settings, perspective, ~60deg fov, custom buffer geometry geometry, shadermaterial materials, and ambient + key + rim lighting. Motion should read as timeline-led reveals, with poster frame + dom fallback.

**Id:** threejs

**Label:** ThreeJS

**Stack:** ThreeJS, WebGL

**Insights:**
  - **Scene:**
    - **Value:** Inset 3D accent with layered spatial depth
  - **Render:**
    - **Value:** alpha, antialias, DPR clamp
  - **Camera:**
    - **Value:** Perspective, ~60deg FOV
  - **Lighting:**
    - **Value:** ambient + key + rim
  - **Materials:**
    - **Value:** ShaderMaterial
  - **Geometry:**
    - **Value:** custom buffer geometry
  - **Motion:**
    - **Value:** Timeline-led reveals

**Techniques:** Shader materials, Particle depth, Timeline beats, alpha, antialias, DPR clamp, Poster frame + DOM fallback

**Code Evidence:**
  - **HTML reference:**
    - **Language:** html
    - **Snippet:**
      ```html
      
      ```
  - **JS reference:**
    - **Language:** html
    - **Snippet:**
      ```html
      
      ```