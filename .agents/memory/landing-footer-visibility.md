---
name: Landing footer visibility (SEO)
description: Why the Shopy Crafter landing footer must live outside the contact section and never be display:none on mobile
---

# Landing footer must be a standalone block, always visible

The landing page (`Landing.tsx`) uses a native-scroll fullpage engine: `.fp-container` > `.fp-wrapper` > full-height `.fp-section`s, navigated via `goToSection` (`scrollIntoView`, no CSS scroll-snap, no wheel hijack). An IntersectionObserver observes `.fp-section` only, for nav highlighting.

**Rule:** the `<footer className="fp-footer fp-footer-standalone">` must be a direct child of `.fp-wrapper`, placed AFTER `</section id="fp-contact">` — a normal-flow block, NOT nested inside the contact section.

**Why:** `#fp-contact`'s inner `.fp-contact-visme` is `position:absolute; inset:0; overflow:hidden auto` and holds a full-viewport `VismeFormHero` (`height:calc(100dvh-64px)`). A footer placed inside it only appears via an awkward internal scroll that users and crawlers rarely reach → important footer link sections effectively hidden → Google penalizes. Moving it out makes it always reachable/visible.

**Also:** mobile media queries previously set `.fp-footer-col { display: none; }` (two breakpoints), hiding the important footer link columns on small screens. Keep these `display: block` (columns stack via `.fp-footer-inner { grid-template-columns: 1fr }`). Never `display:none` footer columns — same SEO/visibility concern.

**How to apply:** if asked to restyle/move the footer, keep it a standalone sibling after the last section and keep its link columns visible on every breakpoint. Do not re-nest it into a section with clipped/absolute overflow, and do not gate it behind opacity-0 reveal classes (`fp-animate`).
