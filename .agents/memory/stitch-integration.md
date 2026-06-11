---
name: Google Stitch MCP Integration
description: Stitch AI UI/UX generator integrated into ShopyBrain — 14 tools, backend routes, Gemini CLI extension.
---

## Setup
- Secret: `STITCH_API_KEY` (format: `AQ.xxxxx`, from stitch.withgoogle.com → Settings → API Keys)
- MCP endpoint: `https://stitch.googleapis.com/mcp` (HTTP MCP, auth via `X-Goog-Api-Key` header)
- Gemini CLI extension: `.gemini/extensions/Stitch/gemini-extension.json`
- Local proxy script: `scripts/stitch-mcp-proxy.mjs` (port 4123)
- MCP config file: `mcp.json` (workspace root)

## Backend Routes (all require admin auth)
- `GET /api/stitch/status` — check if configured
- `GET /api/stitch/tools` — list all 14 Stitch tools
- `GET /api/stitch/projects` — list projects
- `POST /api/stitch/projects` — create project `{name, description}`
- `GET /api/stitch/projects/:id` — get project
- `GET /api/stitch/projects/:id/screens` — list screens
- `GET /api/stitch/projects/:id/screens/:sid` — get screen
- `POST /api/stitch/projects/:id/screens/:sid/edit` — edit screen with prompt
- `POST /api/stitch/projects/:id/screens/:sid/variants` — generate variants
- `GET /api/stitch/projects/:id/design-systems` — list design systems
- `POST /api/stitch/projects/:id/design-systems` — create design system
- `POST /api/stitch/generate` — generate screen `{prompt, projectId, model}`
- `POST /api/stitch/generate/shopify-product` — generate Shopify product page `{product, projectId}`

## Actual MCP Tool Names (IMPORTANT — no "stitch." prefix)
`create_project`, `get_project`, `list_projects`, `list_screens`, `get_screen`,
`generate_screen_from_text`, `edit_screens`, `generate_variants`,
`upload_design_md`, `create_design_system`, `create_design_system_from_design_md`,
`update_design_system`, `list_design_systems`, `apply_design_system`

**Why:** First version used `stitch.` prefix (wrong); actual tools/list returns bare names. Always verify with `tools/list` before calling.

## Models available
- `gemini-2.5-flash` (fast, default)
- `gemini-2.5-pro` (quality, use for Shopify product pages)

## Workflow
1. Create a project first (`create_project`)
2. Generate screens (`generate_screen_from_text`) — requires `project_id`
3. Iterate with `edit_screens` or `generate_variants`
4. Apply design system with `apply_design_system`
