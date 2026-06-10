---
name: Runway API Config
description: Confirmed Runway API endpoint and version header — non-obvious values that differ from official docs
---

## Endpoint
`https://api.dev.runwayml.com/v1` — note the `.dev.` subdomain

**NOT** `https://api.runwayml.com/v1` — that returns 404/401

## Version Header
`X-Runway-Version: 2024-11-06` — the ONLY value that returns 200

All 2025-* date strings (e.g. `2025-01-01`, `2025-06-10`) return HTTP 400.

**Why:** Discovered during live API verification June 10, 2026. The SDK and official docs point to the wrong endpoint for this Replit environment. The `.dev.` endpoint is what the API key is provisioned against.

**How to apply:** Any code calling Runway must use both the dev subdomain AND the 2024-11-06 version header. Check `artifacts/api-server/src/lib/runway.ts` for the reference implementation.
