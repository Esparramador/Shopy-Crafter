---
name: Streaming AI helpers need their own fallback, not just the non-streaming sibling's
description: Why the landing chatbot silently went blank ("no responde") even though a working non-streaming fallback path already existed
---

# Streaming AI helpers need their own fallback

When a provider (e.g. Gemini) has a non-streaming helper with a solid circuit-breaker + fallback-to-alternate-provider pattern, do not assume the streaming sibling (e.g. an SSE-based `*Stream` generator) inherits that safety net. They are separate code paths and must each independently check the circuit breaker and each independently fall back on error.

**Why:** The landing chatbot's `/stream` SSE route called `askGeminiStream`, which had no fallback at all — on a provider error (e.g. a persistent account/billing block causing 403s) it just yielded a raw `{error}` event. The frontend's SSE handler updated internal state on that error event but never called `setMessages`, so the user saw a permanently blank chat bubble forever with no visible error — reported by users as "the chatbot doesn't respond." Meanwhile the non-streaming helper for the same provider already had a working fallback, so `curl`-testing the non-streaming JSON endpoint looked fine and masked the bug.

**How to apply:**
- When one call path (streaming) wraps/duplicates logic from another (non-streaming), diff their error handling explicitly — don't assume parity.
- Any SSE/stream consumer on the frontend must have an explicit code path for every server-sent event type, including error events; an event handler that mutates state but never flushes it to the render (e.g., forgetting `setMessages`) produces a UI that looks "hung" rather than erroring visibly. Treat "sets a variable but never calls the corresponding React state setter" as a first suspect for "silently stuck" UI bugs.
- A provider-level circuit breaker (module-scoped, e.g. `_generationCircuitOpen` timestamp + cooldown) must be checked at the very top of every generation entry point that hits that provider (streaming and non-streaming), not just one of them.
