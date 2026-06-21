---
name: shopify-optimizer frontend typecheck & API base conventions
description: How the Vite frontend handles TS errors, the fabric ambient typing, and the API/API_BASE prefix convention (avoids false "disconnected endpoint" diagnoses).
---

# shopify-optimizer frontend

## Typecheck vs build
- The Vite build does NOT run `tsc`. Type errors do NOT block builds. Run `pnpm --filter @workspace/shopify-optimizer run typecheck` explicitly to surface them; `pnpm --filter @workspace/api-server run typecheck` for the backend.

## API base prefix convention (IMPORTANT — prevents false-positive endpoint debugging)
- Two different frontend constants exist across pages:
  - `const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api"` → **already includes `/api`**. So `${API}/admin/...` resolves to `/api/admin/...`. Calls like `${API}/client/ai-chat` are correct.
  - `const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "")` → **no `/api`**. These pages write the full path themselves: `${API_BASE}/api/admin/all-products`.
- **Why this matters:** a naive scan sees `${API}/admin/...` and thinks the `/api` prefix is missing — it is NOT. Always check whether the local constant already appends `/api` before concluding an endpoint is disconnected.
- Backend mounting: in api-server `app.ts` the main router is `app.use("/api", router)`. In `routes/index.ts`, `adminRouter` is mounted at `/admin` but `productsRouter`/`abTestingRouter`/`brainSyncRouter` are mounted with NO prefix and define their own `/admin/...` paths (e.g. `router.get("/admin/all-products")`). So `/api/admin/all-products`, `/api/admin/all-ab-tests`, `/api/admin/brain-stats|brain-export/*|brain-import*` all resolve correctly.

## fabric.js typing (v5.5.2, no @types available)
- `import { fabric } from "fabric"` is used both as value (`new fabric.Canvas`, `fabric.Image.fromURL`) and as type (`fabric.Canvas`, `fabric.Rect`, `fabric.Textbox`, etc.).
- Fix: ambient decl at `src/types/fabric.d.ts` — `declare module "fabric" { export const fabric: any; export namespace fabric { type Canvas = any; ... } }`. The plain `declare module "fabric";` shorthand does NOT work because type-position usages (`fabric.Canvas`) need namespace members.
- Callback params chaining off fabric (`(o)`, `(img)`) still need explicit `: any` annotations under noImplicitAny.
