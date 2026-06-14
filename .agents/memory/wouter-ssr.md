---
name: Wouter SSR with Vite
description: How to correctly use wouter 3.9 for Vite SSR prerendering — the one prop that works
---

**Rule:** Use `<Router ssrPath={path}>` (wouter's native SSR prop). Do not use a custom hook, memoryLocation, or any other approach.

**Why:** wouter 3.9 internally imports `useSyncExternalStore` from `use-sync-external-store/shim`. This shim does NOT properly provide `getServerSnapshot` in the SSR context, causing React 18's `renderToString` to throw "Missing getServerSnapshot, which is required for server-rendered content." on any component tree that calls `useSyncExternalStore` without a server snapshot.

The `ssrPath` prop on `<Router>` works because it flows into `useBrowserLocation` → `usePathname({ ssrPath })` → `useSyncExternalStore(subscribe, getSnapshot, () => ssrPath)`. The third argument (getServerSnapshot) is provided, so React is satisfied.

**How to apply:**
- In `entry-server.tsx`, render: `<Router ssrPath={path}><PageComponent /></Router>`
- `ssrSearch` is auto-set to `""` by the Router when `ssrPath` is provided (no duplicate params needed)
- `subscribe` (which calls `addEventListener`) is NEVER called by React during `renderToString` — only `getServerSnapshot` is invoked — so no `window`/`history` errors in Node.js
- Pages that use `window.location` at component body level (outside `useEffect`) must be excluded from the SSR entry (they'll be metadata-only)
