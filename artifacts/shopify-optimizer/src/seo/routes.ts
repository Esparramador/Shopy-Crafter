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

function keywordRoutes(): SeoRoute[] {
  return Object.values(COMPARISON_DATA).map(p => ({
    path: p.path,
    title: p.metaTitle,
    description: p.metaDescription,
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
    title: `${post.title} — Blog de Shopy Crafter`,
    description: post.excerpt,
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
    title: `Shopy Crafter v${r.version} — ${r.title}`,
    description: r.description ?? r.changes.slice(0, 3).join(". "),
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

let _all: SeoRoute[] | null = null;

export function getSeoRoutes(): SeoRoute[] {
  if (!_all) _all = [...STATIC_ROUTES, ...keywordRoutes(), ...blogRoutes(), ...changelogRoutes(), ...caseRoutes()];
  return _all;
}

export function seoFor(path: string): SeoRoute | undefined {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return getSeoRoutes().find(r => r.path === clean);
}

