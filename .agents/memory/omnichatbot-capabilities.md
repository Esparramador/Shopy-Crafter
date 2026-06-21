---
name: OmniChatbot / ShopyBrain capability boundary
description: What the admin AI agent can and cannot actually do — and the honest limit to state to the user.
---

The admin chatbot (frontend `OmniChatbot.tsx`, backend `routes/shopybrain.ts`)
is a privileged agent, NOT just an LLM text chat. It already performs real
side-effects:

- **Platform actions** via `POST /api/shopybrain/execute-action`: Shopify
  create/delete/change_price/publish products, collections/pages,
  regenerate_token, diagnose_app.
- **Code**: list_source_files, inspect_code, analyze_component, and `fix_code`
  which directly edits source files (with backups).
- **Scrape/research**: real-time web research via Gemini search
  (researchRealPricing, research-entity-sync).
- **Media**: image/video/ad generation (Flux/Runway/Kling via Replicate).
- Destructive ops gated by a `requireConfirmation` guard.
- Engines: Claude / Gemini / Grok + Replicate models.

**Honest boundary to always state:** a browser-based web app CANNOT control
arbitrary remote computers that the admin logs in from. There is no installed
local agent, and browsers sandbox this. "Total control of any computer" is not
achievable; "total control of the platform/server actions" already is.

**Why:** the user repeatedly asks for the chatbot to "control any computer
where I log in as admin." Do not over-promise — scope it to platform/server
control plus what an installed companion agent would require (out of current
scope).
