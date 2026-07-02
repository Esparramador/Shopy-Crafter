---
name: Landing/public chatbot AI provider
description: Which AI provider the public landing chatbot must use and why Anthropic-direct is forbidden there
---

# Landing/public chatbot AI provider

The public landing pre-sales chatbot (`routes/public-chat.ts`, endpoint `POST /api/public/landing-chat`) must use **Gemini via `askGeminiChat()`** (in `lib/gemini.ts`) as its primary engine, NOT the Anthropic SDK directly.

**Why:** `ANTHROPIC_API_KEY` is not in this project's secrets, and even the Replit/Anthropic path has a zero credit balance ("Your credit balance is too low"). Any code that does `new Anthropic({apiKey: process.env.ANTHROPIC_API_KEY})` and calls it will throw → 500 → broken chatbot. This is exactly what was broken.

**How to apply:**
- `askGeminiChat(messages, systemInstruction, opts)` is the reusable multi-turn helper: maps `user/assistant` → Gemini `user/model` contents, has circuit-breaker + timeout + usage recording, and falls back to `askClaudeWithBrain` on empty/403. As of 2026-07-02 the Claude fallback works and returns real answers (Anthropic credits/key issue from earlier was resolved) — verify current credential state before assuming it's dead.
- `askGeminiStream` (used by the `/stream` SSE route, which is what the landing widget actually calls) originally had NO fallback at all on error — it just yielded a raw error object, which the frontend silently swallowed (see `landing-chatbot-stream-fallback.md`). Any new streaming AI helper must mirror the non-streaming one's fallback+circuit-breaker pattern, not just copy the happy path.
- The "mega cerebro" injected into the system prompt is `MASTER_CATALOG` (exported from `lib/master-skills-injector.ts` as an alias of `PLATFORM_SKILLS_MASTER_CATALOG`) — the full platform capability catalog. Chosen over the heavier intent-aware `buildMasterSkillsBlock()` to keep a pre-sales tone (capabilities knowledge, not deep operational prompts).
- Important env quirk: the api-server `dev` script is `pnpm run build && pnpm run start` (runs the compiled `dist/index.mjs`, NOT tsx-watch on `src`). Source edits do nothing until you **restart the workflow** to rebuild. Don't waste time testing before a restart.
