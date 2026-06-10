---
name: Social/URL ingestion provenance
description: Real-world limits of extracting content from social platforms; why "100% real scraping" is impossible for IG/FB and how to degrade honestly.
---

# Social / URL ingestion — what is actually extractable

When a user demands "100% real, no mocks" extraction from ANY social URL, the honest
engineering answer is a **provenance-labeled fallback chain**, not a promise of
universal scraping. Platform reality (verified live June 2026):

- **YouTube oEmbed** (`youtube.com/oembed?format=json&url=...`) — works, no auth. Real title/author/thumbnail.
- **TikTok oEmbed** (`tiktok.com/oembed?url=...`) — works, no auth. Real author + caption + thumbnail.
- **X/Twitter oEmbed** (`publish.twitter.com/oembed`) — UNRELIABLE: returns 404 for many/most tweets after X's API lockdown. Treat as best-effort, expect failure.
- **Instagram / Facebook oEmbed** — requires a Meta app access token. Without it there is NO public, reliable way to scrape post/profile content; pages return login walls.

**Why:** these are external platform constraints, not codebase facts — you cannot
grep them. Promising "real IG/FB scraping" without an official/paid API is a lie.

**How to apply:** degrade in this order and LABEL the source on every result
(`_provenance` + `_confidence` + `_source_note`):
1. open oEmbed (X/TikTok/YouTube) → confidence ~0.9, "oembed"
2. Open Graph / meta tags of the public page (detect login walls) → ~0.6, "og_tags"
3. AI + web search (`askGeminiWithSearch`) as **inference, not extraction** → ~0.4, "ai_search_inference"

Surface the provenance note to the user verbatim so AI inference is never presented
as scraped fact. SSRF note: oEmbed calls go to FIXED platform hosts with the user
URL only as an encoded query param — no SSRF surface. Generic page fetches still
need the existing `validateExternalUrl` guard.
