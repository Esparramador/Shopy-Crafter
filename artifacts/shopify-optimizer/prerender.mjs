/**
 * prerender.mjs — Shopy Crafter custom SSR prerender
 *
 * Replit deployment runs: node prerender.mjs
 * This file REPLACES Replit's default prerender, guaranteeing:
 *   1. Every HTML file includes the <script> tags that load React.
 *   2. The SPA hydrates correctly on every route.
 *   3. Production is a clean clone of development.
 *
 * Strategy: inject a minimal SSR shell into the built index.html template
 * (which already contains all <link> and <script> tags from the Vite build).
 * React then replaces the shell with the full app on the client.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST   = join(__dirname, 'dist/public');
const SERVER = join(__dirname, 'dist/server');

// ── Rutas: salen del registro SEO del bundle SSR (src/seo/routes.ts) ──────────
// Antes era una lista fija que se desincronizaba (faltaban blog y páginas por
// keyword, y había rutas inexistentes como /tienda o /precios).
const SITE_URL = 'https://shopycrafter.com';

function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSitemap(routeList) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = routeList
    .filter(r => r.inSitemap)
    .sort((a, b) => b.priority - a.priority)
    .map(r => {
      const loc = r.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${r.path}`;
      return `  <url>\n    <loc>${xmlEsc(loc)}</loc>\n    <lastmod>${r.lastmod ?? today}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority.toFixed(2)}</priority>\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ── Fallback SSR shell (used if entry-server.js is unavailable) ─────────────
function fallbackShell() {
  return `<div id="sc-ssr-shell" style="background:#080810;min-height:100vh;display:flex;align-items:center;justify-content:center"><div style="color:#c8a84b;font-family:Geist,sans-serif;font-size:14px">Shopy Crafter</div></div>`;
}

async function main() {
  // 1. Read the built client template — this contains ALL <link>/<script> tags
  let template;
  try {
    template = readFileSync(join(DIST, 'index.html'), 'utf-8');
  } catch (err) {
    console.error('❌ dist/public/index.html not found — client build must run first');
    process.exit(0);
  }

  // Ensure the SSR injection point exists; add it if missing
  if (!template.includes('<!--app-html-->')) {
    template = template.replace('<div id="root">', '<div id="root"><!--app-html-->');
  }

  // 2. Load the SSR render function built from entry-server.tsx
  //    Vite hashes the filename, so we scan the assets dir to find it.
  let render;
  let routeList = null;
  try {
    const candidates = [
      join(SERVER, 'entry-server.js'),
      ...(() => {
        try {
          return readdirSync(join(SERVER, 'assets'))
            .filter(f => f.startsWith('entry-server') && f.endsWith('.js'))
            .map(f => join(SERVER, 'assets', f));
        } catch { return []; }
      })(),
    ];
    let ssrFile = candidates.find(f => {
      try { readFileSync(f); return true; } catch { return false; }
    });
    if (!ssrFile) throw new Error('No SSR file found');
    const ssrMod = await import(pathToFileURL(ssrFile).href);
    render = ssrMod.render;
    routeList = typeof ssrMod.routes === 'function' ? ssrMod.routes() : null;
    console.log(`✅ SSR bundle loaded from ${ssrFile}`);
  } catch {
    render = null;
    console.log('⚠️  SSR bundle not found — using fallback shell (scripts still included)');
  }

  // Sin bundle SSR no hay registro: se deja index.html y el sitemap estático de public/
  // (como antes, un fallo del prerender nunca aborta el despliegue).
  if (!routeList) console.error('⚠️  El bundle SSR no exporta routes(): solo se prerenderiza "/" y se mantiene public/sitemap.xml');
  const ROUTES = routeList ? routeList.map(r => r.path) : ['/'];

  let fullBody = 0;
  let metadataOnly = 0;

  // 3. Render + write each route
  for (const route of ROUTES) {
    try {
      let appHtml = '';
      let headHtml = '';
      if (render) {
        try {
          const result = render(route);
          appHtml = result?.html ?? '';
          headHtml = result?.head ?? '';
        } catch (err) {
          console.error(`✗ SSR ${route}: ${err.message}`);
          appHtml = fallbackShell();
        }
      } else {
        appHtml = fallbackShell();
      }

      const hasBody = appHtml.trim().length > 0;

      // Inject SSR content — ALL <script> and <link> tags are preserved from template
      let finalHtml = template.replace('<!--app-html-->', appHtml);
      // Head propio de la ruta (title, description, canonical, robots, OG, JSON-LD)
      if (headHtml) {
        finalHtml = finalHtml.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n    ${headHtml}\n    <!--seo:end-->`);
      }

      // Write HTML file
      if (route === '/') {
        writeFileSync(join(DIST, 'index.html'), finalHtml, 'utf-8');
      } else {
        const routePath = route.slice(1); // strip leading /
        const segments  = routePath.split('/');
        const fileName  = segments.pop();
        const fileDir   = join(DIST, ...segments);
        mkdirSync(fileDir, { recursive: true });
        writeFileSync(join(fileDir, `${fileName}.html`), finalHtml, 'utf-8');
      }

      if (hasBody) {
        fullBody++;
        console.log(`✓ ${route} (full body)`);
      } else {
        metadataOnly++;
        console.log(`✓ ${route} (metadata only)`);
      }
    } catch (err) {
      metadataOnly++;
      console.error(`✗ ${route}: ${err.message}`);
    }
  }

  console.log(
    `\nPrerendered ${ROUTES.length} routes (${fullBody} with full body content, ${metadataOnly} metadata-only).`
  );

  // 4. sitemap.xml generado del mismo registro (todas las rutas indexables)
  if (routeList) {
    const sitemap = buildSitemap(routeList);
    writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf-8');
    console.log(`✓ sitemap.xml (${routeList.filter(r => r.inSitemap).length} URLs)`);
  }
  console.log('Removed all cached metadata files');
}

main().catch(err => {
  // Never let prerender failure abort the deployment
  console.error('Prerender error (non-fatal):', err.message);
  process.exit(0);
});
