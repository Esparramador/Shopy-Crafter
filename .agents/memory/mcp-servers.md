---
name: MCP Servers June 2026
description: 6 MCP servers configured in mcp.json; 5 installed via npm at workspace root
---

## Active MCP Servers (mcp.json)

| Server | Package | Bin | Purpose |
|--------|---------|-----|---------|
| stitch | custom proxy | scripts/stitch-mcp-proxy.mjs | Google Stitch AI design |
| filesystem | @modelcontextprotocol/server-filesystem@2026.1.14 | mcp-server-filesystem | R/W workspace files |
| memory | @modelcontextprotocol/server-memory@2026.1.26 | mcp-server-memory | Persistent knowledge graph |
| context7 | @upstash/context7-mcp@3.2.1 | context7-mcp | npm package docs in context |
| ~~puppeteer~~ | (retirado: puppeteer-mcp-server abandonado con dependencias vulnerables; usar @playwright/mcp opcional) | — | — |
| everything | @modelcontextprotocol/server-everything@2026.1.26 | mcp-server-everything | MCP protocol testing |

## Install pattern
```bash
pnpm add -w [package]  # must use -w flag (workspace root)
# Find bin: cat node_modules/[pkg]/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('bin',{}))"
# Add entry to mcp.json: { "command": "node", "args": ["node_modules/[pkg]/dist/index.js"] }
```

**Why:** mcp.json lives at workspace root; bins are in node_modules/.bin/ after `pnpm add -w`.

## MCPManager UI
- Page: artifacts/shopify-optimizer/src/pages/admin/MCPManager.tsx
- Route: /admin/mcp-manager
- Nav: AppLayout.tsx DEFAULT_SHOPYBRAIN_NAV "MCP Manager 🔌"
- Shows: 6 active cards (expandable), planned servers, mcp.json viewer, install guide
