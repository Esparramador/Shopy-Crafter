/**
 * Registro SEO completo de las rutas públicas (páginas estáticas + keyword +
 * blog + changelog + casos). Lo usan el prerender (head único y HTML
 * rastreable por ruta) y el generador de sitemap.xml. No importar desde el
 * cliente: arrastra el contenido completo del blog.
 */
import { POSTS } from "@/lib/blog-data";
import { COMPARISON_DATA } from "@/lib/comparison-data";
import { RELEASES } from "@/lib/changelog-data";
import { CASES } from "@/lib/casos-data";
import { SHOP_SEED, SHOP_CATEGORIES } from "../../../api-server/src/lib/shop";
import { STATIC_ROUTES, type SeoRoute } from "./meta";

export * from "./meta";

/** Prioridad de las páginas por keyword (plataformas y servicios primero). */
const KEYWORD_PRIORITY: Record<string, number> = {
  "/automatizacion-shopify-ia": 0.95,
  "/automatizacion-woocommerce-ia": 0.95,
  "/automatizacion-prestashop-ia": 0.95,
  "/gestion-stripe-ia": 0.9,
  "/diseno-web-profesional": 0.9,
  "/desarrollo-apps-nativas": 0.9,
  "/ecommerce-ia-automatizacion": 0.85,
  "/agencia-shopify-ia": 0.85,
};

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Recorta en palabra completa para que el buscador no lo corte a su manera. */
const clamp = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

function keywordRoutes(): SeoRoute[] {
  return Object.values(COMPARISON_DATA).map(p => ({
    path: p.path,
    title: clamp(p.metaTitle, 60),
    description: clamp(p.metaDescription, 158),
    h1: p.h1,
    intro: p.subtitle,
    bodyHtml: p.body,
    priority: KEYWORD_PRIORITY[p.path] ?? 0.8,
    changefreq: "monthly" as const,
    inSitemap: true,
  }));
}

function blogRoutes(): SeoRoute[] {
  return POSTS.map(post => ({
    path: `/blog/${post.slug}`,
    title: clamp(post.title, 60),
    description: clamp(post.excerpt, 158),
    h1: post.title,
    intro: post.excerpt,
    bodyHtml: post.body,
    priority: 0.7,
    changefreq: "monthly" as const,
    lastmod: post.date,
    // El caso "Comic Crafter" repite cifras sin verificar: fuera del índice.
    inSitemap: post.slug !== "comic-crafter-caso-exito",
    noindex: post.slug === "comic-crafter-caso-exito" ? true : undefined,
  }));
}

function changelogRoutes(): SeoRoute[] {
  return RELEASES.map(r => ({
    path: `/changelog/${r.version}`,
    title: clamp(`v${r.version}: ${r.title}`, 60),
    description: clamp(r.description ?? r.changes.slice(0, 3).join(". "), 158),
    h1: `v${r.version} — ${r.title}`,
    intro: r.description ?? r.changes.join(". "),
    priority: 0.3,
    changefreq: "yearly" as const,
    lastmod: r.date,
    inSitemap: true,
  }));
}

function caseRoutes(): SeoRoute[] {
  return CASES.map(c => ({
    path: `/casos-de-exito/${c.slug}`,
    title: `${c.name} — Caso de éxito · Shopy Crafter`,
    description: `${c.name} (${c.niche}).`,
    h1: c.name,
    intro: c.niche,
    priority: 0.1,
    changefreq: "yearly" as const,
    inSitemap: false,
    noindex: true,
  }));
}

/** Productos y servicios de la Tienda: una página rastreable por producto, con su precio «desde» y sus imágenes. */
function shopRoutes(): SeoRoute[] {
  return SHOP_SEED.filter(p => p.visible).map(p => {
    const text = [p.description.replace(/\s+/g, " ").trim()];
    const desc = text[0].length <= 158 ? text[0] : `${text[0].slice(0, 155).replace(/\s+\S*$/, "")}…`;
    const fromCents = Math.min(...p.variants.flatMap(v => v.tiers.map(t => t.unitCents)));
    const images = p.media.map(m => (m.type === "video" ? m.poster : m.url)).filter((u): u is string => !!u);
    const priceNote = p.kind === "quote" && fromCents > 0 ? ` A partir de ${(fromCents / 100).toLocaleString("es-ES")} € (IVA incluido).` : "";
    return {
      path: `/tienda/${p.slug}`,
      title: `${p.name} — Tienda Shopy Crafter`,
      description: desc,
      h1: p.name,
      intro: `${p.tagline}${priceNote}`,
      bodyHtml: `<p>${p.description.split("\n\n").map(x => x.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("</p><p>")}</p><ul>${p.features.map(f => `<li>${f.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</li>`).join("")}</ul><p><a href="/tienda">Ver toda la tienda</a> · <a href="/contacto">Contacto</a></p>`,
      priority: p.featured ? 0.8 : 0.7,
      changefreq: "weekly" as const,
      inSitemap: true,
      images: images.map(path => ({ path, title: p.name })),
      product: { name: p.name, kind: p.kind, fromCents, category: SHOP_CATEGORIES[p.category] ?? p.category, images },
    };
  });
}

let _all: SeoRoute[] | null = null;

export function getSeoRoutes(): SeoRoute[] {
  if (!_all) _all = [...STATIC_ROUTES, ...keywordRoutes(), ...blogRoutes(), ...changelogRoutes(), ...caseRoutes(), ...shopRoutes()];
  return _all;
}

export function seoFor(path: string): SeoRoute | undefined {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return getSeoRoutes().find(r => r.path === clean);
}

