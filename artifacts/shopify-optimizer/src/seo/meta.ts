/**
 * Metadatos SEO de las páginas estáticas (ligero: sin el contenido del blog).
 * Lo usan <PageMeta> y el registro completo de routes.ts (prerender + sitemap).
 */

export const SITE_URL = "https://shopycrafter.com";
export const SITE_NAME = "Shopy Crafter";
export const CONTACT_EMAIL = "craftershopy@gmail.com";

export type ChangeFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  /** Encabezado y texto del HTML estático (lo que ve un rastreador sin ejecutar JS). */
  h1: string;
  intro: string;
  /** Contenido HTML adicional del prerender (p. ej. el cuerpo de un artículo). */
  bodyHtml?: string;
  priority: number;
  changefreq: ChangeFreq;
  lastmod?: string;
  /** false = no va al sitemap (duplicados, login…). */
  inSitemap: boolean;
  noindex?: boolean;
  /** Canonical distinta de la propia ruta (duplicados como /landing o /preguntas-frecuentes). */
  canonicalPath?: string;
}

export const HOME_TITLE = "Shopy Crafter — IA para Shopify, WooCommerce, PrestaShop y Stripe · Diseño web y apps";
export const HOME_DESCRIPTION =
  "Automatizamos tiendas Shopify, WooCommerce y PrestaShop con IA: auditoría, SEO, imágenes de producto, precios con COGS real e inventario. Gestión de Stripe, diseño web 3D y apps nativas.";

export const STATIC_ROUTES: SeoRoute[] = [
  {
    path: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    h1: "Automatización con IA para tiendas Shopify, WooCommerce y PrestaShop",
    intro: "Shopy Crafter conecta tu tienda por API y aplica IA a tu catálogo, tus precios y tus pedidos: auditoría de productos, SEO, imágenes, pricing con COGS real, A/B testing e inventario. Gestionamos también pagos con Stripe, diseñamos webs con 3D y animación, y desarrollamos apps nativas.",
    priority: 1.0, changefreq: "weekly", inSitemap: true,
  },
  {
    path: "/portfolio",
    title: "Portfolio de diseño web: 30 demos interactivas con 3D y animación — Shopy Crafter",
    description: "30 demos web interactivas: 3D con Three.js, scroll inmersivo con GSAP y Lenis, shaders, partículas, bento grids y visores de producto. Además, nuestra app nativa Android.",
    h1: "Portfolio: diseño web, 3D y apps",
    intro: "Demos interactivas de diseño web que puedes abrir en tu navegador, y nuestra propia app Android construida con Capacitor.",
    priority: 0.8, changefreq: "monthly", inSitemap: true,
  },
  {
    path: "/sobre-nosotros",
    title: "Sobre Nosotros — Shopy Crafter",
    description: "Conoce al equipo detrás de Shopy Crafter: ingenieros de IA y operadores de eCommerce que automatizamos el trabajo pesado para que tú crezcas.",
    h1: "Sobre Shopy Crafter",
    intro: "Quiénes somos y cómo trabajamos con tiendas online y marcas.",
    priority: 0.6, changefreq: "monthly", inSitemap: true,
  },
  {
    path: "/faq",
    title: "Preguntas Frecuentes — Shopy Crafter",
    description: "Dudas sobre integraciones con Shopify, WooCommerce, PrestaShop y Stripe, precios, seguridad de datos y cómo trabajamos en Shopy Crafter.",
    h1: "Preguntas frecuentes",
    intro: "Integraciones, precios, seguridad y forma de trabajo.",
    priority: 0.7, changefreq: "monthly", inSitemap: true,
  },
  {
    path: "/preguntas-frecuentes",
    title: "Preguntas Frecuentes — Shopy Crafter",
    description: "Dudas sobre integraciones con Shopify, WooCommerce, PrestaShop y Stripe, precios, seguridad de datos y cómo trabajamos en Shopy Crafter.",
    h1: "Preguntas frecuentes",
    intro: "Integraciones, precios, seguridad y forma de trabajo.",
    priority: 0.1, changefreq: "monthly", inSitemap: false, canonicalPath: "/faq",
  },
  {
    path: "/blog",
    title: "Blog de Shopy Crafter — eCommerce, SEO e IA para tiendas online",
    description: "Guías sobre Shopify, WooCommerce, PrestaShop y Stripe: SEO de producto, migraciones, pagos, pricing y automatización con IA.",
    h1: "Blog de Shopy Crafter",
    intro: "Guías prácticas de eCommerce, SEO e inteligencia artificial.",
    priority: 0.8, changefreq: "weekly", inSitemap: true,
  },
  {
    path: "/changelog",
    title: "Changelog — Novedades de Shopy Crafter",
    description: "Historial de actualizaciones, nuevas funciones y mejoras de la plataforma Shopy Crafter.",
    h1: "Novedades de la plataforma",
    intro: "Versiones y cambios publicados.",
    priority: 0.4, changefreq: "monthly", inSitemap: true,
  },
  {
    path: "/contacto",
    title: "Contacto — Shopy Crafter",
    description: "Cuéntanos tu proyecto de tienda online, web o app y te respondemos con una propuesta personalizada.",
    h1: "Contacto",
    intro: `Escríbenos a ${CONTACT_EMAIL} o usa el formulario.`,
    priority: 0.7, changefreq: "monthly", inSitemap: true,
  },
  {
    path: "/programa-de-afiliados",
    title: "Programa de Afiliados — Shopy Crafter",
    description: "Recomienda Shopy Crafter y gana comisión recurrente. Para agencias, freelancers y consultores de eCommerce.",
    h1: "Programa de afiliados",
    intro: "Recomienda Shopy Crafter a otras tiendas y agencias.",
    priority: 0.4, changefreq: "monthly", inSitemap: true,
  },
  {
    path: "/casos-de-exito",
    title: "Casos de Éxito — Shopy Crafter",
    description: "Casos de tiendas que trabajan con Shopy Crafter.",
    h1: "Casos de éxito",
    intro: "Casos de tiendas que trabajan con Shopy Crafter.",
    // Cifras sin verificar: fuera del índice hasta que el propietario las confirme.
    priority: 0.1, changefreq: "monthly", inSitemap: false, noindex: true,
  },
  {
    path: "/privacidad",
    title: "Política de Privacidad — Shopy Crafter",
    description: "Cómo Shopy Crafter recopila, usa y protege tus datos personales. Cumplimiento RGPD.",
    h1: "Política de privacidad",
    intro: "Tratamiento de datos personales conforme al RGPD.",
    priority: 0.2, changefreq: "yearly", inSitemap: true,
  },
  {
    path: "/terminos",
    title: "Términos y Condiciones — Shopy Crafter",
    description: "Condiciones de uso de la plataforma Shopy Crafter: planes, pagos, propiedad intelectual y cancelación.",
    h1: "Términos y condiciones",
    intro: "Condiciones de uso de la plataforma.",
    priority: 0.2, changefreq: "yearly", inSitemap: true,
  },
  {
    path: "/cookies",
    title: "Política de Cookies — Shopy Crafter",
    description: "Información sobre las cookies que usa Shopy Crafter: técnicas, de preferencia y de medición.",
    h1: "Política de cookies",
    intro: "Qué cookies usamos y para qué.",
    priority: 0.2, changefreq: "yearly", inSitemap: true,
  },
  {
    path: "/landing",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    h1: "Automatización con IA para tiendas Shopify, WooCommerce y PrestaShop",
    intro: "Página principal de Shopy Crafter.",
    priority: 0.1, changefreq: "weekly", inSitemap: false, canonicalPath: "/",
  },
  {
    path: "/login",
    title: "Acceso de clientes — Shopy Crafter",
    description: "Acceso al panel de Shopy Crafter para clientes invitados.",
    h1: "Acceso de clientes",
    intro: "Panel privado para clientes invitados.",
    priority: 0.1, changefreq: "yearly", inSitemap: false, noindex: true,
  },
  {
    path: "/forgot-password",
    title: "Recuperar contraseña — Shopy Crafter",
    description: "Recupera el acceso a tu cuenta de Shopy Crafter.",
    h1: "Recuperar contraseña",
    intro: "Te enviaremos un enlace para restablecer tu contraseña.",
    priority: 0.1, changefreq: "yearly", inSitemap: false, noindex: true,
  },
];

export function staticSeoFor(path: string): SeoRoute | undefined {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return STATIC_ROUTES.find(r => r.path === clean);
}

export function canonicalUrl(route: SeoRoute): string {
  const p = route.canonicalPath ?? route.path;
  return p === "/" ? `${SITE_URL}/` : `${SITE_URL}${p}`;
}

/** Enlaces internos que se repiten en el HTML estático y en los pies de página. */
export const SITE_LINK_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Plataformas",
    links: [
      { href: "/automatizacion-shopify-ia", label: "Automatización Shopify con IA" },
      { href: "/automatizacion-woocommerce-ia", label: "Automatización WooCommerce con IA" },
      { href: "/automatizacion-prestashop-ia", label: "Automatización PrestaShop con IA" },
      { href: "/gestion-stripe-ia", label: "Gestión de Stripe" },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/diseno-web-profesional", label: "Diseño web profesional" },
      { href: "/desarrollo-apps-nativas", label: "Apps nativas Android e iOS" },
      { href: "/ecommerce-ia-automatizacion", label: "eCommerce con IA" },
      { href: "/agencia-shopify-ia", label: "Para agencias" },
      { href: "/portfolio", label: "Portfolio" },
    ],
  },
  {
    title: "Guías",
    links: [
      { href: "/shopify-vs-woocommerce", label: "Shopify vs WooCommerce" },
      { href: "/shopify-vs-prestashop", label: "Shopify vs PrestaShop" },
      { href: "/migrar-woocommerce-shopify", label: "Migrar WooCommerce a Shopify" },
      { href: "/migrar-prestashop-shopify", label: "Migrar PrestaShop a Shopify" },
      { href: "/shopify-stripe-pagos", label: "Stripe + Shopify" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/sobre-nosotros", label: "Sobre nosotros" },
      { href: "/faq", label: "Preguntas frecuentes" },
      { href: "/contacto", label: "Contacto" },
      { href: "/changelog", label: "Novedades" },
      { href: "/privacidad", label: "Privacidad" },
      { href: "/terminos", label: "Términos" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

