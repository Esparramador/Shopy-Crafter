import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const DIST = "dist/public";
// SSR build may output with a hash (e.g. dist/server/assets/entry-server-abc123.js)
// or directly as dist/server/entry-server.js — find whichever exists.
function findServerBundle() {
  const direct = "dist/server/entry-server.js";
  if (existsSync(direct)) return direct;
  const assetsDir = "dist/server/assets";
  if (existsSync(assetsDir)) {
    const files = readdirSync(assetsDir).filter(f => f.startsWith("entry-server") && f.endsWith(".js"));
    if (files.length > 0) return join(assetsDir, files[0]);
  }
  return direct; // fallback — existsSync will return false and we'll warn
}
const SERVER_BUNDLE = findServerBundle();
const DOMAIN = "https://shopycrafter.com";
const DEFAULT_IMAGE = `${DOMAIN}/opengraph.jpg`;

let render = null;
let getRoutes = null;

if (existsSync(SERVER_BUNDLE)) {
  try {
    const serverModule = await import(`./${SERVER_BUNDLE}`);
    render = serverModule.render ?? null;
    getRoutes = serverModule.getRoutes ?? null;
    console.log("  SSR bundle loaded from", SERVER_BUNDLE);
  } catch (e) {
    console.error("  ERROR: Could not load SSR bundle:", e.message);
    process.exit(1);
  }
} else {
  console.error("  ERROR: SSR bundle not found at", SERVER_BUNDLE);
  process.exit(1);
}

if (!render || !getRoutes) {
  console.error("  ERROR: SSR bundle does not export render() and/or getRoutes(). Check entry-server.tsx.");
  process.exit(1);
}

const ROUTES = getRoutes();
console.log(`  Loaded ${ROUTES.length} routes from SSR bundle.`);

const baseHtml = readFileSync(join(DIST, "index.html"), "utf-8");

function stripExistingPerRouteTags(html) {
  return html
    .replace(/<link rel="canonical"[^>]*\/?>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
}

let count = 0;
let ssrCount = 0;
const ssrFailures = [];

for (const route of ROUTES) {
  const url = `${DOMAIN}${route.path}`;

  let appHtml = "";
  if (route.ssr) {
    try {
      appHtml = render(route.path);
      if (!appHtml) {
        ssrFailures.push(route.path);
        console.error(`  ERROR: SSR render returned empty string for ${route.path}`);
      }
    } catch (e) {
      console.error(`  ERROR: SSR threw for ${route.path}:`, e.message);
      process.exit(1);
    }
  }

  const ogBlock = [
    `  <link rel="canonical" href="${url}" />`,
    `  <meta property="og:title" content="${route.title}" />`,
    `  <meta property="og:description" content="${route.description}" />`,
    `  <meta property="og:url" content="${url}" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:image" content="${DEFAULT_IMAGE}" />`,
    `  <meta property="og:site_name" content="Shopy Crafter" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${route.title}" />`,
    `  <meta name="twitter:description" content="${route.description}" />`,
    `  <meta name="twitter:image" content="${DEFAULT_IMAGE}" />`,
  ].join("\n");

  let html = stripExistingPerRouteTags(baseHtml)
    .replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${route.description}" />`)
    .replace("</head>", `${ogBlock}\n</head>`);

  if (appHtml) {
    html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
    ssrCount++;
  }

  const dir = route.path === "/" ? DIST : join(DIST, route.path.replace(/^\//, ""));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  console.log(`  ✓ ${route.path}${appHtml ? " (SSR)" : " (metadata only — no SSR component)"}`);
  count++;
}

if (ssrFailures.length > 0) {
  console.error(`\n  FATAL: ${ssrFailures.length} ssr:true route(s) produced empty HTML:`);
  ssrFailures.forEach(p => console.error(`    - ${p}`));
  process.exit(1);
}

console.log(`\nPrerendered ${count} routes (${ssrCount} with full body content, ${count - ssrCount} metadata-only).`);
