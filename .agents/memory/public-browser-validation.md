---
name: Public browser readiness
description: Avoid false browser timeouts when checking public pages with persistent CMS connections.
---

Public-page checks must wait for an actual rendered element, not global network idleness.

**Why:** The CMS deliberately maintains an EventSource connection. Public pages can render correctly while `networkidle` waits until the navigation timeout.

**How to apply:** Navigate with `domcontentloaded`, then wait for the relevant visible heading or form. Still record real page errors and failed responses; do not interpret an open CMS stream as a page failure.
