import { renderToString } from "react-dom/server";
import type { ComponentType } from "react";
import { Router } from "wouter";
import Blog from "./pages/public/Blog";
import BlogPost from "./pages/public/BlogPost";
import CasosDeExito from "./pages/public/CasosDeExito";
import CasoDeExitoDetail from "./pages/public/CasoDeExitoDetail";
import Changelog from "./pages/public/Changelog";
import ChangelogRelease from "./pages/public/ChangelogRelease";
import Contacto from "./pages/public/Contacto";
import Cookies from "./pages/public/Cookies";
import FAQ from "./pages/public/FAQ";
import HomepageSSR from "./pages/public/HomepageSSR";
import Privacidad from "./pages/public/Privacidad";
import ProgramaAfiliados from "./pages/public/ProgramaAfiliados";
import SobreNosotros from "./pages/public/SobreNosotros";
import Terminos from "./pages/public/Terminos";
import { POSTS } from "./lib/blog-data";
import { CASES } from "./lib/casos-data";
import { RELEASES } from "./lib/changelog-data";

const ROUTE_MAP: Record<string, ComponentType> = {
  "/": HomepageSSR,
  "/sobre-nosotros": SobreNosotros,
  "/casos-de-exito": CasosDeExito,
  "/programa-de-afiliados": ProgramaAfiliados,
  "/faq": FAQ,
  "/blog": Blog,
  "/changelog": Changelog,
  "/privacidad": Privacidad,
  "/terminos": Terminos,
  "/cookies": Cookies,
  "/contacto": Contacto,
};

function resolveComponent(path: string): ComponentType | null {
  if (ROUTE_MAP[path]) return ROUTE_MAP[path];
  if (path.startsWith("/blog/")) return BlogPost;
  if (path.startsWith("/casos-de-exito/")) return CasoDeExitoDetail;
  if (path.startsWith("/changelog/")) return ChangelogRelease;
  return null;
}

export function render(path: string): string {
  const Component = resolveComponent(path);
  if (!Component) return "";

  return renderToString(
    <Router ssrPath={path}>
      <Component />
    </Router>
  );
}

export interface RouteEntry {
  path: string;
  title: string;
  description: string;
  ssr: boolean;
}

const STATIC_ROUTES: RouteEntry[] = [
  {
    path: "/",
    title: "Shopy Crafter — Optimización IA para tiendas Shopify",
    description: "7 motores de IA para mejorar SEO, imágenes y conversión en tu tienda Shopify. Sin conocimientos técnicos. Prueba gratis 14 días.",
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

export function getRoutes(): RouteEntry[] {
  const blogRoutes: RouteEntry[] = POSTS.map(p => ({
    path: `/blog/${p.slug}`,
    title: `${p.title} — Blog Shopy Crafter`,
    description: p.excerpt,
    ssr: true,
  }));

  const caseRoutes: RouteEntry[] = CASES.map(c => ({
    path: `/casos-de-exito/${c.slug}`,
    title: `${c.name} — Caso de éxito · Shopy Crafter`,
    description: `${c.name} (${c.niche}): ${c.before}. Después: ${c.after}. En ${c.time}.`,
    ssr: true,
  }));

  const changelogRoutes: RouteEntry[] = RELEASES.map(r => ({
    path: `/changelog/${r.version}`,
    title: `Shopy Crafter v${r.version} — ${r.title}`,
    description: r.description ?? (r.changes[0] ?? `Novedades de la versión ${r.version}.`),
    ssr: true,
  }));

  return [...STATIC_ROUTES, ...blogRoutes, ...caseRoutes, ...changelogRoutes];
}
