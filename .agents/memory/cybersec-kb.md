---
name: Cybersec Knowledge Base integration
description: 817 Anthropic cybersecurity skills integrated into ShopyBrain, OmniChatbot, and Security Lab admin page
---

## Architecture

**Data layer**
- `src/data/cybersec-catalog.json` — 817 skills with name, description, subdomain, tags, mitre_attack, nist_csf, overview, when_to_use (925KB)
- `src/data/cybersec-skills/<skill-id>/SKILL.md` — full content per skill (~10KB each, 38MB total)
- `src/lib/cybersec-knowledge.ts` — cached getCybersecCatalog(), getSkillContent(), searchCybersecSkills(), getCybersecDomains(), buildCybersecKnowledgeBlock()

**Path resolution (triple fallback)**
```typescript
const DATA_DIR = existsSync(join(__dirname, "data", "cybersec-catalog.json"))
  ? join(__dirname, "data")          // dist/data/ — production (after build)
  : existsSync(join(__dirname, "../src/data", "cybersec-catalog.json"))
    ? join(__dirname, "../src/data") // src/data/ — development edge case
    : join(process.cwd(), "src/data"); // cwd fallback
```

**build.mjs** copies TWO data dirs to dist/data/:
1. `src/lib/data` — effects_prompts.json, visme_templates.json
2. `src/data` — cybersec-catalog.json + cybersec-skills/ (38MB)

**API routes** (`src/routes/cybersec.ts`, all behind requireAuth)
- `GET /api/cybersec/catalog?q=&domain=&tag=&limit=&offset=`
- `GET /api/cybersec/skill/:id` — full SKILL.md content
- `GET /api/cybersec/domains`
- `GET /api/cybersec/search?q=&limit=`

**AI injection** (`src/lib/master-skills-injector.ts`)
- `buildCybersecKnowledgeBlock()` appended to every `buildMasterSkillsBlock()` call
- Contains domain list (30 domains) + framework refs + usage instructions
- Does NOT dump full skill content (too large); provides on-demand lookup via actions

**ShopyBrain actions** (in shopybrain.ts trigger text + case switch)
- `security_skill {skillId, query?}` — reads full SKILL.md, returns content + meta
- `security_skill_search {query, domain?}` — fuzzy search, returns up to 15 results

**Frontend** (`src/pages/admin/SecurityLab.tsx`)
- Domain sidebar (30 domains, color-coded by subdomain)
- Grid/list toggle, search with 350ms debounce, pagination (60/page)
- Skill detail drawer — markdown render, MITRE/NIST/tag badges, GitHub link
- Route: `/admin/security-lab` (RequireAdmin)
- Nav: "🔐 Security Lab" in AppLayout sidebar

## Why these choices

**Why not inject all 817 skills into system prompt?**
38MB of markdown would exceed any context window and cost a fortune per request. Instead: compact domain catalog always injected, full content retrieved on demand via `security_skill` action.

**Why build.mjs copies src/data too?**
esbuild bundles everything into dist/index.mjs, so __dirname resolves to dist/. Static data files must be in dist/data/ for the bundle to find them. The copy step runs after every build.

**Subdomain grouping**
30 subdomains extracted via frontmatter. Top: cloud-security(66), threat-hunting(58), threat-intelligence(52), network-security(43), web-application-security(42).
