---
name: OmniChatbot skill-wiring status
description: Which of Shopy Crafter's skill/knowledge catalogs are actually invoked by the live chatbot vs. exposed-only or agent-only
---

Four distinct "skill" sources exist; only some are wired into the conversational chatbot at runtime:

1. **Cybersec catalog (817 skills)** — genuinely executed: `security_skill` / `security_skill_search` actions in the authenticated chat route read the real `SKILL.md` off disk and return it to the LLM. Not just described in a prompt.
2. **Master knowledge blocks** (ai-engine-skills 12 prompts, skills-library 100+, advertising-playbook-kb, campaign-production-kb, cinematic-knowledge-base, cogs-methodology-kb, plugins-catalog, exploded-view-kb, shopify-theme 5 blocks) — genuinely injected into the system prompt on EVERY authenticated chat request via a single injector function, with intent-detection choosing which deep blocks to expand. Real content (names/formulas/lists), not empty placeholders.
3. **Master prompt library (6781 templates)** — real content, but NOT wired into the chatbot. Only reachable via a separate authenticated API route used by a different browsable UI feature. The chatbot never calls it. "Dormant" for conversation purposes.
4. **`.agents/skills/` (81 skills)** — these belong to the Replit build-agent (me), completely unrelated to the end-user product/chatbot. Never wired into any app code, and shouldn't be — different audience.

**Why this matters:** the public/unauthenticated landing chatbot route is a SEPARATE route from the authenticated in-app chatbot route, and does NOT have the master knowledge injector wired in at all — only the authenticated in-app chatbot gets the full injection. Don't assume "the chatbot" is singular; verify which route the user means.

**How to apply:** when asked "does the chatbot really know/execute skill X," check (a) is it injected as static text into a system prompt (knowledge only), (b) is it callable as a real action/function that reads real data (execution), or (c) is it only exposed via a separate API route nothing calls (dormant). All three states can coexist across different catalogs in this codebase.
