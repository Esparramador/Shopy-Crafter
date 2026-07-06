---
name: Landing chatbot advisor mode
description: public-chat.ts upgraded to Claude Sonnet + 3-block advisor system; how it detects business context and researches companies
---

# Landing Chatbot — Advisor Mode (Claude + Research)

## Provider change
- Was: Gemini (`askGeminiChat` / `askGeminiStream`)
- Now: Claude `claude-sonnet-4-6` via `@workspace/integrations-anthropic-ai` (Replit proxy, AI_INTEGRATIONS_ANTHROPIC_BASE_URL + AI_INTEGRATIONS_ANTHROPIC_API_KEY)
- Gemini still used for `quickResearch()` (URL context + Search grounding)

**Why:** User explicitly requested Anthropic; proxy provisioned via setupReplitAIIntegrations; old memory entry "no key + zero credits" was stale.

## 3 new blocks in public-chat.ts

### Block 1 — extractClientContext()
Parses full conversation for:
- URL (https:// match) or bare domain (.com/.es/.shop/etc)
- Company name (regex patterns: "mi tienda se llama X", "somos X y", etc.)
- Facts: niche, audience, challenge, goal, currentPlatform, monthlyRevenue, location

Returns `ClientContext` with `advisorMode: boolean`, `factCount`, `hasResearchTarget`.

### Block 2 — quickResearch()
- If URL detected: `askGeminiWithUrls()` with 15s race timeout → site analysis ~200 words
- If company name detected: `askGeminiWithSearch()` with 15s race timeout → company overview
- Runs BEFORE SSE headers are set (so research result can be injected into system prompt)
- Errors/timeouts silently skipped (advisor still works without research)

### Block 3 — buildClientContextBlock() + advisor instructions
Injects into system prompt:
- "LO QUE SÉ DE SU NEGOCIO" facts block
- Instruction: every 2-3 replies ask ONE diagnostic question
- Instruction: when 3+ facts known, offer "Mini-diagnóstico gratuito" (3 problems + solutions)

## SSE format
Stream sends `{ text: "..." }` per delta and `{ done: true, _intent, _stage, _advisor }` at end.
Frontend (LandingChatbot.tsx) already parses `d.text` — compatible.

## How to apply
- Edit public-chat.ts in api-server/src/routes/
- Rebuild: `rm -rf artifacts/api-server/dist && cd artifacts/api-server && node build.mjs`
- Restart workflow `artifacts/api-server: API Server`
