import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DIST = "dist/public";
const DOMAIN = "https://shopycrafter.com";
const DEFAULT_IMAGE = `${DOMAIN}/opengraph.jpg`;

const ROUTES = [
  {
    path: "/",
    title: "Shopy Crafter — Optimización IA para tiendas Shopify",
    description: "7 motores de IA para mejorar SEO, imágenes y conversión en tu tienda Shopify. Sin conocimientos técnicos. Prueba gratis 14 días.",
  },
  {
    path: "/landing",
    title: "Shopy Crafter — Plataforma IA para eCommerce Shopify",
    description: "Descubre los 17 motores de IA que automatizan SEO, imágenes, emails y estrategias de crecimiento para tu tienda Shopify.",
  },
  {
    path: "/sobre-nosotros",
    title: "Sobre Nosotros — Shopy Crafter",
    description: "Conoce al equipo detrás de Shopy Crafter: ingenieros de IA y operadores de eCommerce que automatizamos el trabajo pesado para que tú crezcas.",
  },
  {
    path: "/casos-de-exito",
    title: "Casos de Éxito — Shopy Crafter",
    description: "Resultados reales de tiendas que ya usan Shopy Crafter. Cifras verificadas: más tráfico orgánico, mejor conversión y menos horas manuales.",
  },
  {
    path: "/programa-de-afiliados",
    title: "Programa de Afiliados — Shopy Crafter",
    description: "Recomienda Shopy Crafter y gana un 30% de comisión recurrente. Ideal para agencias, freelancers y consultores de eCommerce.",
  },
  {
    path: "/faq",
    title: "Preguntas Frecuentes — Shopy Crafter",
    description: "Resuelve dudas sobre precios, integraciones, seguridad y resultados de Shopy Crafter para eCommerce Shopify.",
  },
  {
    path: "/blog",
    title: "Blog de Shopy Crafter — Estrategias eCommerce con IA",
    description: "Artículos, tutoriales y casos reales para hacer crecer tu tienda Shopify con inteligencia artificial.",
  },
  {
    path: "/changelog",
    title: "Changelog — Novedades de Shopy Crafter",
    description: "Historial de actualizaciones, nuevas funciones y mejoras de la plataforma Shopy Crafter.",
  },
  {
    path: "/privacidad",
    title: "Política de Privacidad — Shopy Crafter",
    description: "Cómo Shopy Crafter recopila, usa y protege tus datos personales. Cumplimiento RGPD.",
  },
  {
    path: "/terminos",
    title: "Términos y Condiciones — Shopy Crafter",
    description: "Condiciones de uso de la plataforma Shopy Crafter: planes, pagos, propiedad intelectual y cancelación.",
  },
  {
    path: "/cookies",
    title: "Política de Cookies — Shopy Crafter",
    description: "Información sobre las cookies que usa Shopy Crafter: técnicas, de preferencia y de medición.",
  },
  {
    path: "/contacto",
    title: "Contacto — Shopy Crafter",
    description: "Contacta con el equipo de Shopy Crafter. Respondemos en menos de 24 horas para resolver tus dudas sobre eCommerce e IA.",
  },
];

const baseHtml = readFileSync(join(DIST, "index.html"), "utf-8");

let count = 0;
for (const route of ROUTES) {
  const url = `${DOMAIN}${route.path}`;

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

  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${route.description}" />`)
    .replace("</head>", `${ogBlock}\n</head>`);

  const dir = route.path === "/" ? DIST : join(DIST, route.path.replace(/^\//, ""));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  count++;
  console.log(`  ✓ ${route.path}`);
}

console.log(`\nPrerendered ${count} routes successfully.`);
