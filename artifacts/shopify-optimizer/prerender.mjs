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
  return direct; // fallback – existsSync will return false and we'll warn
}
const SERVER_BUNDLE = findServerBundle();
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

  // ── Blog detail pages ────────────────────────────────────────────────────
  {
    path: "/blog/optimizar-fichas-google-shopping-2026",
    title: "Cómo optimizar fichas de producto para Google Shopping en 2026 — Blog Shopy Crafter",
    description: "Los schemas JSON-LD, las imágenes de alta calidad y las descripciones únicas son clave. Te mostramos el proceso exacto que usamos con nuestros clientes.",
    ssr: true,
  },
  {
    path: "/blog/claude-vs-gemini-ecommerce",
    title: "Claude vs Gemini: qué modelo de IA es mejor para tu eCommerce — Blog Shopy Crafter",
    description: "Hemos probado ambos modelos en 15.000+ generaciones reales. Te damos los resultados: cuándo usar cada uno y por qué no deberías elegir solo uno.",
    ssr: true,
  },
  {
    path: "/blog/guia-cogs-tiendas-online",
    title: "La guía definitiva de COGS para tiendas online — Blog Shopy Crafter",
    description: "Si no conoces tu coste real por producto, estás perdiendo dinero. Desglosamos las 9 categorías de costes que toda tienda debería trackear.",
    ssr: true,
  },
  {
    path: "/blog/ab-testing-automatizado-ia",
    title: "A/B Testing automatizado: cómo dejamos que la IA elija el ganador — Blog Shopy Crafter",
    description: "Nuestro motor de A/B testing compara imágenes, precios y descripciones con intervalos de confianza del 95%. Así funciona el auto-winner.",
    ssr: true,
  },
  {
    path: "/blog/comic-crafter-caso-exito",
    title: "Cómo Comic Crafter aumentó ventas un 340% en 90 días — Blog Shopy Crafter",
    description: "Auditoría completa + SEO automatizado + imágenes IA. El caso paso a paso de una tienda de cómics que multiplicó sus ventas sin pagar publicidad.",
    ssr: true,
  },
  {
    path: "/blog/17-motores-ia-ecommerce",
    title: "17 motores de IA para eCommerce: qué hace cada uno — Blog Shopy Crafter",
    description: "Audit, SEO, Images, A/B Testing, Pricing, WebLab, Fusion Studio... Explicamos cada motor y cuándo usarlo para sacar el máximo partido.",
    ssr: true,
  },

  // ── Case study detail pages ──────────────────────────────────────────────
  {
    path: "/casos-de-exito/comic-crafter",
    title: "Comic Crafter — Caso de éxito · Shopy Crafter",
    description: "Comic Crafter (Cómics e ilustración personalizada): 12 ventas/mes sin SEO → +340% ventas en 90 días con 47 fichas optimizadas e imágenes IA.",
    ssr: true,
  },
  {
    path: "/casos-de-exito/sakura-studio",
    title: "Sakura Studio — Caso de éxito · Shopy Crafter",
    description: "Sakura Studio (camisetas Japón-inspired): sin tráfico orgánico → Top 3 Google en 18 keywords, +210% sesiones, 4× conversión.",
    ssr: true,
  },
  {
    path: "/casos-de-exito/audit-multipart",
    title: "Audit Multipart — Caso de éxito · Shopy Crafter",
    description: "Audit Multipart (repuestos automoción B2B): 1.200 productos auto-descritos en 2 semanas, +180% leads cualificados.",
    ssr: true,
  },

  // ── Changelog release detail pages ──────────────────────────────────────
  {
    path: "/changelog/3.8.0",
    title: "Shopy Crafter v3.8.0 — ShopyBrain OmniCore v3",
    description: "La mayor actualización del motor de memoria e inteligencia acumulada. OmniCore v3 introduce aprendizaje continuo entre proyectos y sincronización multi-cuenta.",
    ssr: true,
  },
  {
    path: "/changelog/3.7.0",
    title: "Shopy Crafter v3.7.0 — Ad Studio + Campaign Kit",
    description: "Dos nuevos motores para marketing de pago: Ad Studio genera creatividades para Meta, Google y TikTok; Campaign Kit orquesta campañas completas con calendario y presupuesto.",
    ssr: true,
  },
  {
    path: "/changelog/3.6.0",
    title: "Shopy Crafter v3.6.0 — Economista IA (Pricing COGS)",
    description: "Análisis automático de costes reales de producto y fijación de precio óptimo con IA. Cubre las 9 categorías de COGS con 30+ campos de detalle.",
    ssr: true,
  },
  {
    path: "/changelog/3.5.0",
    title: "Shopy Crafter v3.5.0 — A/B Testing con predicción IA",
    description: "El motor de A/B Testing ahora predice resultados antes de ejecutar el experimento, basándose en datos históricos de tests similares en el mismo nicho.",
    ssr: true,
  },
  {
    path: "/changelog/3.4.0",
    title: "Shopy Crafter v3.4.0 — Fusion Studio + Exploded View",
    description: "Fusion Studio estrena canvas interactivo multi-capa. Exploded View introduce vistas despiece de producto generadas por IA para productos técnicos.",
    ssr: true,
  },
  {
    path: "/changelog/3.3.0",
    title: "Shopy Crafter v3.3.0 — Sistema de Logros y Gamificación",
    description: "Sistema de logros y progresión para facilitar la adopción. El roadmap 30-60-90 días guía al usuario por las acciones de mayor impacto.",
    ssr: true,
  },
  {
    path: "/changelog/3.2.0",
    title: "Shopy Crafter v3.2.0 — Command Center + Universal Search",
    description: "Rediseño del centro de operaciones: Command Center centraliza el estado de todos los motores y la búsqueda universal encuentra cualquier elemento desde cualquier pantalla.",
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
