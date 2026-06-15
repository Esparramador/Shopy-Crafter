import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DIST = "dist/public";
const SERVER_BUNDLE = "dist/server/entry-server.js";
const DOMAIN = "https://shopycrafter.com";
const DEFAULT_IMAGE = `${DOMAIN}/opengraph.jpg`;

const ROUTES = [
  {
    path: "/",
    title: "Shopy Crafter — Optimización IA para tiendas Shopify",
    description: "7 motores de IA para mejorar SEO, imágenes y conversión en tu tienda Shopify. Sin conocimientos técnicos. Prueba gratis 14 días.",
    ssr: true,
  },
  {
    path: "/landing",
    title: "Shopy Crafter — Plataforma IA para eCommerce Shopify",
    description: "Descubre los 7 motores de IA que automatizan SEO, imágenes, emails y estrategias de crecimiento para tu tienda Shopify.",
    ssr: true,
  },
  {
    path: "/sobre-nosotros",
    title: "Sobre Nosotros — Shopy Crafter",
    description: "Conoce al equipo detrás de Shopy Crafter: ingenieros de IA y operadores de eCommerce que automatizamos el trabajo pesado para que tú crezcas.",
    ssr: true,
  },
  {
    path: "/casos-de-exito",
    title: "Casos de Éxito — Shopy Crafter",
    description: "Resultados reales de tiendas que ya usan Shopy Crafter. Cifras verificadas: más tráfico orgánico, mejor conversión y menos horas manuales.",
    ssr: true,
  },
  {
    path: "/programa-de-afiliados",
    title: "Programa de Afiliados — Shopy Crafter",
    description: "Recomienda Shopy Crafter y gana un 30% de comisión recurrente. Ideal para agencias, freelancers y consultores de eCommerce.",
    ssr: true,
  },
  {
    path: "/faq",
    title: "Preguntas Frecuentes — Shopy Crafter",
    description: "Resuelve dudas sobre precios, integraciones, seguridad y resultados de Shopy Crafter para eCommerce Shopify.",
    ssr: true,
  },
  {
    path: "/blog",
    title: "Blog de Shopy Crafter — Estrategias eCommerce con IA",
    description: "Artículos, tutoriales y casos reales para hacer crecer tu tienda Shopify con inteligencia artificial.",
    ssr: true,
  },
  {
    path: "/changelog",
    title: "Changelog — Novedades de Shopy Crafter",
    description: "Historial de actualizaciones, nuevas funciones y mejoras de la plataforma Shopy Crafter.",
    ssr: true,
  },
  {
    path: "/privacidad",
    title: "Política de Privacidad — Shopy Crafter",
    description: "Cómo Shopy Crafter recopila, usa y protege tus datos personales. Cumplimiento RGPD.",
    ssr: true,
  },
  {
    path: "/terminos",
    title: "Términos y Condiciones — Shopy Crafter",
    description: "Condiciones de uso de la plataforma Shopy Crafter: planes, pagos, propiedad intelectual y cancelación.",
    ssr: true,
  },
  {
    path: "/cookies",
    title: "Política de Cookies — Shopy Crafter",
    description: "Información sobre las cookies que usa Shopy Crafter: técnicas, de preferencia y de medición.",
    ssr: true,
  },
  {
    path: "/contacto",
    title: "Contacto — Shopy Crafter",
    description: "Contacta con el equipo de Shopy Crafter. Respondemos en menos de 24 horas para resolver tus dudas sobre eCommerce e IA.",
    ssr: true,
  },
];

let render = null;
if (existsSync(SERVER_BUNDLE)) {
  try {
    const serverModule = await import(`./${SERVER_BUNDLE}`);
    render = serverModule.render;
    console.log("  SSR bundle loaded from", SERVER_BUNDLE);
  } catch (e) {
    console.warn("  Warning: Could not load SSR bundle:", e.message);
  }
} else {
  console.warn("  Warning: SSR bundle not found at", SERVER_BUNDLE, "— body content will not be prerendered.");
}

const baseHtml = readFileSync(join(DIST, "index.html"), "utf-8");

function stripExistingPerRouteTags(html) {
  return html
    .replace(/<link rel="canonical"[^>]*\/?>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
}

let count = 0;
let ssrCount = 0;

for (const route of ROUTES) {
  const url = `${DOMAIN}${route.path}`;

  let appHtml = "";
  if (route.ssr && render) {
    try {
      appHtml = render(route.path);
    } catch (e) {
      console.warn(`  Warning: SSR failed for ${route.path}:`, e.message);
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
  console.log(`  ✓ ${route.path}${appHtml ? " (SSR)" : " (metadata only)"}`);
  count++;
}

console.log(`\nPrerendered ${count} routes (${ssrCount} with full body content, ${count - ssrCount} metadata-only).`);
