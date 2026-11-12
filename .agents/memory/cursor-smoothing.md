---
name: Cursor smoothing across environments
description: Keep custom cursor trails responsive at both development and production frame rates.
---

Use elapsed-time easing for custom cursor trails rather than a fixed interpolation fraction per animation frame. Development previews can run at lower or more variable frame rates than production; a fixed per-frame fraction then makes the ring lag noticeably behind the pointer.

**Why:** A cursor can look correct in production but appear delayed in a development preview because the same fixed fraction advances fewer times per second.

**How to apply:** When a cursor has a trailing ring, compute the interpolation factor from the animation-frame delta time, cap unusually long frame gaps, and verify alignment after viewport resize in the development browser.
