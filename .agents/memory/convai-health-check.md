---
name: ConvAI health check semantics
description: Why GET /voice/convai/health is read-only with a "drift" state, and why reset-agents must respect the single-flight + env-pinned admin agent.
---

**Rule:** the ConvAI health GET only reads from ElevenLabs (voice lookup + agent read-back). It never PATCHes or creates agents. Config drift (`agent_config_mismatch`) is reported as `drift` (amber), not `error`, and the in-memory agent-id cache is invalidated so the next call re-syncs before issuing a signed URL. Red is reserved for cases a call cannot repair (voice rejected by plan, agent deleted in the dashboard, API down).

**Why:** a first version ran sync+verify inside the GET; the reviewer flagged that opening a tab silently PATCHed three provider agents and could overwrite dashboard edits. Verify-only alone gave false reds (a cold call would have repaired the drift), hence the three-way status.

**How to apply:** keep health GET read-only. For saved voice-tuning changes, use the non-destructive apply action: it PATCHes and verifies existing admin/client/landing agents in place, shares `_agentResolveInFlight[type]`, and preserves the `ELEVEN_CONVAI_DEFAULT_AGENT_ID` admin agent. Use `POST /voice/convai/reset-agents` only when recreation is explicitly intended; publish its promise in the shared single-flight slot before any await, including when syncing the env-pinned admin in place, and never delete or recreate that pinned agent.

**Why:** changing TTS values does not require replacing agents; recreation risks changing IDs or leaving startup pointed at a deleted admin agent.

**Why:** an env-pinned reset used to sync outside the shared flight, allowing a concurrent call or apply to bypass verification. A reset must own the flight for its entire verification, just like create/recreate.
