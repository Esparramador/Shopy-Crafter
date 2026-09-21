---
name: ConvAI health check semantics
description: Why GET /voice/convai/health is read-only with a "drift" state, and why reset-agents must respect the single-flight + env-pinned admin agent.
---

**Rule:** the ConvAI health GET only reads from ElevenLabs (voice lookup + agent read-back). It never PATCHes or creates agents. Config drift (`agent_config_mismatch`) is reported as `drift` (amber), not `error`, and the in-memory agent-id cache is invalidated so the next call re-syncs before issuing a signed URL. Red is reserved for cases a call cannot repair (voice rejected by plan, agent deleted in the dashboard, API down).

**Why:** a first version ran sync+verify inside the GET; the reviewer flagged that opening a tab silently PATCHed three provider agents and could overwrite dashboard edits. Verify-only alone gave false reds (a cold call would have repaired the drift), hence the three-way status.

**How to apply:** any explicit repair belongs to `POST /voice/convai/reset-agents`. That route must (1) await `_agentResolveInFlight[type]` and publish its own work there so concurrent calls wait instead of auto-creating duplicates, and (2) sync the `ELEVEN_CONVAI_DEFAULT_AGENT_ID` admin agent in place — deleting it leaves startup pointing at a dead ID.
