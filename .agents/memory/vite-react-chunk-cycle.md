---
name: Vite manualChunks React circular dependency (production black screen)
description: Why splitting scheduler out of the react chunk causes a production-only blank/black screen, and the bundling invariant that prevents it.
---

# Vite manualChunks → React circular chunk dependency → production black screen

**Symptom:** Production (static-served Vite build) shows a blank/near-black screen
(the SSR/loading shell stays). Dev works fine. ErrorBoundary never fires and no
client error-report logs appear. Console shows
`Cannot set properties of undefined (setting 'Children')` originating from the
`vendor-react-*.js` chunk.

**Root cause:** A `manualChunks()` allowlist that captures only
`node_modules/react/` + `node_modules/react-dom/` lets React's runtime deps
(notably `scheduler`) fall into the catch-all `vendor-misc` chunk. Then
`vendor-react` imports `scheduler` back from `vendor-misc`, while `vendor-misc`
(any lib that does `import React`) imports react from `vendor-react`. That
two-way edge is a **circular ESM chunk dependency**. In the bundled production
output the cycle evaluates with `React` still undefined → React's own module
init throws → `createRoot` never runs → loading shell is never replaced → black
screen. The failure is *before* any component renders, which is why the
app-level ErrorBoundary never catches it.

**Why dev hides it:** Vite dev serves unbundled ES modules in dependency order;
`manualChunks` only applies to the production `vite build`. So this class of bug
is strictly production-only.

**Fix / invariant:** The React runtime family MUST live in ONE chunk so the react
chunk has **no back-edge import** into the catch-all chunk. Group together:
`react`, `react-dom`, `scheduler`, `react-is`, `use-sync-external-store`.
After building, verify: `vendor-react-*.js` must import from NO other local chunk
(`grep 'from"\./' vendor-react-*.js` → empty); `vendor-misc → vendor-react` is a
fine one-way edge.

**How to apply:** Any time you edit `manualChunks` (or add a React-adjacent
runtime dep), re-check that the react chunk is self-contained. Confirm a real fix
with a headless browser load of `vite preview`, not just a successful build — the
build succeeds even when the runtime cycle is present.
