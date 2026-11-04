/**
 * Entrada SSR del prerender (node prerender.mjs).
 *
 * Por cada ruta pública genera:
 *   - head: <title>, description, canonical, robots, Open Graph, Twitter y
 *     JSON-LD propios de la ruta (antes todas las páginas compartían los del
 *     index.html: mismo título y canonical en todo el sitio);
 *   - html: contenido semántico real (h1, texto, artículo y enlaces internos)
 *     para que un rastreador lo lea sin ejecutar JavaScript. React lo
 *     sustituye al montar la app en el cliente.
 *
 * Sin imports de navegador: solo datos puros.
 */
import { FAQ_FLAT } from "./lib/faq-data";
import {
  getSeoRoutes, seoFor, canonicalUrl, SITE_URL, SITE_NAME, CONTACT_EMAIL,
  SITE_LINK_GROUPS, type SeoRoute,
} from "./seo/routes";

const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** JSON dentro de <script>: sin "</" para no cerrar la etiqueta. */
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icons/icon-512.png`,
  email: CONTACT_EMAIL,
  areaServed: ["ES", "MX", "AR", "CO", "CL", "PE"],
  knowsAbout: [
    "Shopify", "WooCommerce", "PrestaShop", "Stripe", "SEO para eCommerce",
    "Automatización de tiendas online", "Inteligencia artificial", "Diseño web", "Aplicaciones móviles",
  ],
};

const SERVICES: [string, string][] = [
  ["Automatización de tiendas Shopify con IA", "/automatizacion-shopify-ia"],
  ["Automatización de tiendas WooCommerce con IA", "/automatizacion-woocommerce-ia"],
  ["Automatización de tiendas PrestaShop con IA", "/automatizacion-prestashop-ia"],
  ["Gestión de pagos con Stripe", "/gestion-stripe-ia"],
  ["Diseño y desarrollo web", "/diseno-web-profesional"],
  ["Desarrollo de apps nativas Android e iOS", "/desarrollo-apps-nativas"],
];

function structuredData(route: SeoRoute): string {
  const url = canonicalUrl(route);
  if (route.path === "/") {
    return jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        ORGANIZATION,
        { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_NAME, inLanguage: "es", publisher: { "@id": `${SITE_URL}/#organization` } },
        ...SERVICES.map(([name, path]) => ({
          "@type": "Service",
          name,
          url: `${SITE_URL}${path}`,
          provider: { "@id": `${SITE_URL}/#organization` },
          areaServed: "ES",
        })),
      ],
    });
  }
  if (route.path.startsWith("/blog/")) {
    return jsonLd({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: route.h1,
      description: route.description,
      datePublished: route.lastmod,
      inLanguage: "es",
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
      publisher: ORGANIZATION,
      image: OG_IMAGE,
    });
  }
  if (route.product) {
    const pr = route.product;
    const price = (pr.fromCents / 100).toFixed(2);
    const offers = pr.fromCents > 0
      ? { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: price, offerCount: 1, availability: "https://schema.org/InStock", url }
      : undefined;
    const common = {
      "@type": pr.kind === "quote" || pr.kind === "digital" ? "Service" : "Product",
      "@id": `${url}#item`,
      name: pr.name,
      description: route.description,
      url,
      image: pr.images.map(i => `${SITE_URL}${i}`),
      category: pr.category,
      ...(pr.kind === "physical"
        ? { brand: { "@type": "Brand", name: SITE_NAME }, ...(offers ? { offers: { ...offers, "@type": "Offer", price } } : {}) }
        : { provider: { "@id": `${SITE_URL}/#organization` }, areaServed: "ES", ...(offers ? { offers } : {}) }),
    };
    return jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        common,
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Tienda", item: `${SITE_URL}/tienda` },
          { "@type": "ListItem", position: 3, name: pr.name, item: url },
        ] },
      ],
    });
  }
  if (route.path === "/faq") {
    return jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: "es", mainEntity: FAQ_FLAT.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Preguntas frecuentes", item: url },
        ] },
      ],
    });
  }
  if (route.path === "/tienda") {
    const items = getSeoRoutes().filter(r => r.product).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.h1, url: canonicalUrl(r) }));
    return jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", "@id": `${url}#page`, name: route.title, url, description: route.description, inLanguage: "es", isPartOf: { "@id": `${SITE_URL}/#website` } },
        { "@type": "ItemList", itemListElement: items },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Tienda", item: url },
        ] },
      ],
    });
  }
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: route.h1, item: url },
    ],
  });
}

export function renderHead(url: string): string {
  const route = seoFor(url);
  if (!route) return "";
  const canonical = esc(canonicalUrl(route));
  const robots = route.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const t = esc(route.title);
  const d = esc(route.description);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<link rel="alternate" hreflang="es" href="${canonical}" />`,
    `<link rel="alternate" hreflang="x-default" href="${canonical}" />`,
    `<meta property="og:type" content="${route.path.startsWith("/blog/") ? "article" : "website"}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="es_ES" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${route.product?.images[0] ? `${SITE_URL}${route.product.images[0]}` : OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${route.product?.images[0] ? `${SITE_URL}${route.product.images[0]}` : OG_IMAGE}" />`,
    structuredData(route),
  ].join("\n    ");
}

function linksHtml(): string {
  return SITE_LINK_GROUPS.map(g =>
    `<nav aria-label="${esc(g.title)}"><h2 style="font-size:13px;color:#c8a84b;text-transform:uppercase;letter-spacing:.08em">${esc(g.title)}</h2><ul style="list-style:none;padding:0;margin:0">${
      g.links.map(l => `<li style="margin:6px 0"><a href="${l.href}" style="color:#9896ba;text-decoration:none">${esc(l.label)}</a></li>`).join("")
    }</ul></nav>`
  ).join("");
}

function extraForRoute(route: SeoRoute): string {
  if (route.path === "/faq") return `<article>${FAQ_FLAT.map(f => `<h2>${esc(f.q)}</h2><p>${esc(f.a)}</p>`).join("")}</article>`;
  if (route.bodyHtml) return `<article style="line-height:1.7;color:#c9c7e0">${route.bodyHtml}</article>`;
  if (route.path === "/") {
    return `<ul>${SERVICES.map(([name, path]) => `<li><a href="${path}" style="color:#e6c668">${esc(name)}</a></li>`).join("")}</ul>`;
  }
  return "";
}

export function render(url: string): { html: string; head: string } {
  const route = seoFor(url);
  if (!route) return { html: '<div id="sc-ssr-shell"></div>', head: "" };
  // Lo que ve la persona: pantalla de marca (mismo fondo que la app, sin texto en fuente de
  // sistema que luego salte). Lo que lee un rastreador: el contenido real, recortado
  // visualmente (técnica "visually hidden"), que React sustituye al montar.
  const hidden = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
  const html = `<div id="sc-ssr-shell" style="background:#080810;min-height:100vh;display:flex;align-items:center;justify-content:center">
<div aria-hidden="true" style="width:44px;height:44px;border-radius:12px;border:1px solid #c8a84b;box-shadow:0 0 32px rgba(200,168,75,.35)"></div>
<div style="${hidden}">
<header><a href="/">${SITE_NAME}</a></header>
<main>
<h1>${esc(route.h1)}</h1>
<p>${esc(route.intro)}</p>
${extraForRoute(route)}
</main>
<footer>${linksHtml()}</footer>
</div>
</div>`;
  return { html, head: renderHead(url) };
}

/** Rutas a prerenderizar y sus datos de sitemap. */
export function routes(): { path: string; inSitemap: boolean; priority: number; changefreq: string; lastmod?: string; images?: { path: string; title?: string }[] }[] {
  return getSeoRoutes().map(r => ({ path: r.path, inSitemap: r.inSitemap && !r.noindex, priority: r.priority, changefreq: r.changefreq, lastmod: r.lastmod, images: r.images }));
}
