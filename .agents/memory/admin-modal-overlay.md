---
name: Admin modal overlay convention
description: Why admin-panel modals must go through the shared ModalOverlay/useModalLock instead of raising z-index.
---
Rule: an admin or project-page modal, drawer or fullscreen sheet never gets its own `position: fixed` backdrop with a hand-picked z-index. It wraps in the shared ModalOverlay (or, for animated motion roots, calls the modal-lock hook and takes the `.modal-overlay` class). Layout variants are done with style overrides on the overlay, not by dropping it.

**Why:** the floating widgets (assistant FAB, voice button, Setup panel) live at very high z-indexes, so a z-index race is unwinnable and inconsistent across pages; the lock attribute on `<body>` is the only thing that reliably hides them. A previous round only converted "the obvious" pages and review found a dozen more overlays (calendar, Stripe hub, project wizards, lightboxes), so the audit has to be by grep for fixed/inset-0 backdrops across pages AND shared components, not by page list.

**How to apply:** when adding a modal, use the shared overlay; when reviewing, grep for `fixed inset-0` / `position: "fixed", inset: 0` outside client pages. Add each new page to the overlay E2E's PAGES list (route + opener button text; `:id` routes resolve to the admin's first project). Ignore the decorative mouse-following avatar cursor — it is not a widget. Click-away dropdown backdrops and toasts are not modals and stay as they are.
