---
name: OmniChatbot skill-wiring status
description: Which of Shopy Crafter's skill/knowledge catalogs are actually invoked by the live chatbot vs. exposed-only or agent-only
---

Five distinct "skill" sources exist; only some are wired into the conversational chatbot at runtime:

1. **Cybersec catalog (817 skills)** — genuinely executed: `security_skill` / `security_skill_search` actions in the authenticated chat route read the real `SKILL.md` off disk and return it to the LLM. Not just described in a prompt.
2. **Master knowledge blocks** (ai-engine-skills 12 prompts, skills-library 100+, advertising-playbook-kb, campaign-production-kb, cinematic-knowledge-base, cogs-methodology-kb, plugins-catalog, exploded-view-kb, shopify-theme 5 blocks) — genuinely injected into the system prompt on EVERY authenticated chat request via a single injector function, with intent-detection choosing which deep blocks to expand. Real content (names/formulas/lists), not empty placeholders.
3. **Master prompt library (6781 templates)** — real content, but NOT wired into the chatbot. Only reachable via a separate authenticated API route used by a different browsable UI feature. The chatbot never calls it. "Dormant" for conversation purposes.
4. **`.agents/skills/` (81 skills, Replit build-agent's own skills)** — now DELIBERATELY wired into the PRODUCT with an asymmetric boundary (see `agent-skills-execution-vs-knowledge.md`): the public landing bot only KNOWS them (advise/recommend, never execute), the authenticated platform bot can genuinely EXECUTE them via `agent_skill`/`agent_skill_search` + `generate_office_document` actions (`agent-skills-knowledge.ts`, `office-document-generator.ts`). This was an explicit product requirement, not an accidental leak — don't revert it thinking it's agent-only tooling.
5. **Master prompt library UI route** — see item 3, distinct from the `.agents/skills` catalog.

**Why this matters:** the public/unauthenticated landing chatbot route is a SEPARATE route from the authenticated in-app chatbot route. As of the `.agents/skills` wiring, BOTH routes now reference the same catalog, but with different privilege levels (knowledge-only vs. real execution) — verify which route + which capability level the user means.

**How to apply:** when asked "does the chatbot really know/execute skill X," check (a) is it injected as static text into a system prompt (knowledge only), (b) is it callable as a real action/function that reads real data (execution), or (c) is it only exposed via a separate API route nothing calls (dormant). All three states can coexist across different catalogs in this codebase.
