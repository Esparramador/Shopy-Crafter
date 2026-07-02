---
name: Agent skills — public vs authenticated execution boundary
description: How the two chatbots differ in what they may do with the 81 .agents/skills catalog
---

Shopy Crafter has two chatbot surfaces backed by the same `.agents/skills` catalog (81 skills), but with an intentionally different capability boundary:

- **Landing/public chatbot** (`public-chat.ts`) — injects the master catalog as a "know but never execute" knowledge block. No execute-action mechanism exists there at all. This is correct by design: unauthenticated visitors should get advice/recommendations, not real actions.
- **Authenticated platform chatbot** (`shopybrain.ts`) — has `agent_skill` / `agent_skill_search` actions that pull the REAL `SKILL.md` content off disk (`src/lib/agent-skills-knowledge.ts`, same disk-walk pattern as `cybersec-knowledge.ts`) and instruct the LLM to actually follow it, plus a `generate_office_document` action (`src/lib/office-document-generator.ts`, docx/exceljs/pptxgenjs) that produces real downloadable files saved to the Vault.

**Why:** the user explicitly distinguished "the public bot should only inform/recommend, never execute" from "the authenticated platform must really execute the skills" — conflating these two would either leak execution to anonymous users or leave the paid platform a hollow knowledge-only bot.

**How to apply:** when adding new skill-driven capabilities, always check which chatbot file you're touching. Never add an execute-action pathway to `public-chat.ts`. Any new skill wired into `shopybrain.ts` must (a) be added to the "no Shopify token required" allow-list if it doesn't call Shopify, and (b) be excluded from user-facing execution if it's a meta/build-agent-only skill (see `META_SKILL_IDS` in `agent-skills-knowledge.ts` — things like `skill-creator`, `threejs-*`, `vercel-*`).
