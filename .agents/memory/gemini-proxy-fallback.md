---
name: Gemini direct-key-blocked → AI Integrations proxy fallback
description: How lib/gemini.ts routes text generation between the direct GEMINI_API_KEY and the Replit AI Integrations proxy when the direct key is blocked
---

# Gemini direct-key-blocked → AI Integrations proxy fallback

`lib/gemini.ts` has two independent Gemini credential paths that can both be configured at once: the direct `GEMINI_API_KEY` (personal GCP project, subject to that project's own billing status) and the Replit AI Integrations proxy (`AI_INTEGRATIONS_GEMINI_API_KEY` + `AI_INTEGRATIONS_GEMINI_BASE_URL`, billed to Replit credits, unaffected by the direct project's billing state).

**Why:** `getGeminiClient()` unconditionally preferred the direct key whenever it was set, even when that key was hard-blocked (e.g. GCP billing/dunning hold returning 403 permission-denied on every call). That silently degraded every "Gemini" call straight to the Claude fallback, even though a working Gemini path (the proxy) was available and configured.

**How to apply:**
- Text-generation entry points (`askGeminiChat`, `askGeminiJson`, `askGeminiStream`) use `getGenerationClient()`, which returns the proxy client instead of the direct client whenever the generation circuit breaker is open (i.e. a recent 403 was seen from the direct key). On a *fresh* 403 mid-request, the catch block retries the same request via the proxy client before ever falling back to Claude.
- Search/grounding-only codepaths intentionally keep using the direct client (`getGeminiDirectClient()`) — the AI Integrations proxy's supported API surface is `generateContent`/`generateContentStream` only, with no guaranteed support for Google Search grounding tools.
- The proxy only serves a fixed model allowlist (see `ai-integrations-gemini` skill). `mapModelForProxy(model, isProxy)` remaps whatever tier model was resolved (which may be a newer/unsupported alias like `gemini-3.5-flash`) onto the nearest proxy-supported model (`gemini-3.1-pro-preview` for pro-ish names, `gemini-3-flash-preview` otherwise) — only when actually routing through the proxy.
- Net effect: a blocked direct key degrades to "real Gemini via proxy" first, and only falls to Claude if the proxy is unconfigured or also fails — instead of jumping straight to Claude.
