---
name: Deployment image size limit
description: Cloud Run 8 GiB image limit causes build failures; gitignore alone does not exclude files from the Repl layer; two required fixes for production builds.
---

# Deployment Image Size Limit

## The rule
The Replit Cloud Run deployment has an **8 GiB image size limit**. Exceeding it causes the build to fail at the "Pushing Repl layer" step with: `error: image size is over the limit of 8 GiB`.

**Why:** The "Repl layer" in the Docker image packages the entire workspace filesystem — including gitignored files. `.gitignore` only affects git tracking, NOT what gets packaged into the deployment image.

## Known large items in this repo (gitignored but present on disk)
- `artifacts/shopify-optimizer/public/assets/3d/` — ~1.7 GB of GLB animation files
- `attached_assets/` — ~806 MB of generated videos/images

## Fix applied
Two changes required together:

**1. `artifacts/shopify-optimizer/package.json` build script** — extend the cleanup node command to also delete source dirs when `NODE_ENV=production`:
```js
const isProd = process.env.NODE_ENV === 'production';
const paths = ['dist/public/assets/3d'];
if (isProd) { paths.push('public/assets/3d', '../../attached_assets'); }
paths.forEach(p => { try { fs.rmSync(p, {recursive:true,force:true}); } catch(e) {} });
```

**2. `artifacts/shopify-optimizer/.replit-artifact/artifact.toml`** — pass `NODE_ENV=production` to the production build (converted from inline `build = [...]` to table format):
```toml
[services.production.build]
args = [ "pnpm", "--filter", "@workspace/shopify-optimizer", "run", "build" ]

[services.production.build.env]
NODE_ENV = "production"
```

**Why:** The cleanup runs inside the deployment build container (a copy of the workspace), so it does not delete files from the actual dev environment. The `NODE_ENV=production` gate ensures local `pnpm build` runs (without that env var) do NOT delete the source GLBs.

## Other required production secret
`ENCRYPTION_KEY` — must be set as a secret (64-char hex, 32 bytes). The API server calls `validateEncryptionKey()` synchronously at startup; in `NODE_ENV=production` it throws if this secret is missing, crashing the server before the health check can respond.
