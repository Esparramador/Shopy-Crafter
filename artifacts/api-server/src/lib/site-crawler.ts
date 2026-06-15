/**
 * Multi-Page Site Crawler + Tech Stack Detector
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Discovers ALL pages from sitemap.xml (or sitemap index)
 * 2. Crawls up to maxPages pages in parallel
 * 3. Detects JS frameworks, CMS, eCommerce platform, analytics, and more
 * 4. Identifies page sections (hero, features, pricing, testimonials, footer)
 */

import { logger } from "./logger.js";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_OPTS = { headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.9" }, signal: AbortSignal.timeout(15_000) };

export interface TechStack {
  cms: string | null;
  ecommerce: string | null;
  framework: string | null;
  renderStrategy: "SSR" | "SSG" | "SPA" | "MPA" | "unknown";
  analytics: string[];
  chatWidgets: string[];
  emailMarketing: string[];
  cdnOrHosting: string | null;
  jsLibraries: string[];
  cssFramework: string | null;
  paymentProviders: string[];
  languages: string[];
  detected: string[];
}

export interface PageSection {
  type: "hero" | "features" | "pricing" | "testimonials" | "faq" | "cta" | "footer" | "nav" | "product" | "blog" | "contact" | "about" | "gallery" | "team";
  headline: string | null;
  subtext: string | null;
  hasCta: boolean;
}

export interface CrawledPage {
  url: string;
  label: string;
  statusCode: number;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  h3: string[];
  paragraphs: string[];
  jsonLd: string[];
  socials: string[];
  hexColors: string[];
  wordCount: number;
  content: string;
  sections: PageSection[];
  isHomepage: boolean;
}

export interface SiteCrawlResult {
  baseUrl: string;
  totalPagesDiscovered: number;
  pagesCrawled: number;
  pages: CrawledPage[];
  techStack: TechStack;
  sitemapFound: boolean;
  sitemapUrls: string[];
  allContent: string;
  socialHandles: string[];
  colorPalette: string[];
}

// ─── Tech Stack Detection ────────────────────────────────────────────────────

export function detectTechStack(html: string, responseHeaders?: Record<string, string>): TechStack {
  const h = html.toLowerCase();
  const detected: string[] = [];

  const check = (signals: string[], name: string): boolean => {
    const found = signals.some(s => h.includes(s.toLowerCase()));
    if (found) detected.push(name);
    return found;
  };

  const cms =
    check(["cdn.shopify.com", "shopify.com/s/files", "myshopify.com", "shopify.theme", "window.shopify"], "Shopify") ? "Shopify" :
    check(["wp-content/", "wp-includes/", "wp-json/", "wordpress"], "WordPress") ? "WordPress" :
    check(["wix.com", "_wix_", "wixsite.com", "wix-thunderbolt"], "Wix") ? "Wix" :
    check(["squarespace.com", "sqsp.net", "squarespace-cdn"], "Squarespace") ? "Squarespace" :
    check(["webflow.com", "webflow.io", "webflow-badge"], "Webflow") ? "Webflow" :
    check(["bigcommerce.com", "cdn11.bigcommerce"], "BigCommerce") ? "BigCommerce" :
    check(["magento", "mage/", "mage.require"], "Magento") ? "Magento" :
    check(["ghost.io", "ghost/content", "ghost-theme"], "Ghost") ? "Ghost" :
    null;

  const ecommerce =
    cms === "Shopify" ? "Shopify" :
    cms === "BigCommerce" ? "BigCommerce" :
    cms === "Magento" ? "Magento" :
    check(["woocommerce", "wc-cart", "wc-ajax", "woocommerce.min.js"], "WooCommerce") ? "WooCommerce" :
    check(["prestashop", "presta-shop", "prestashop.js"], "PrestaShop") ? "PrestaShop" :
    check(["ecwid", "ecwid.js", "ecwid-shopping-cart"], "Ecwid") ? "Ecwid" :
    null;

  const framework =
    check(["__next", "_next/", "__nextjs", "next/dist"], "Next.js") ? "Next.js" :
    check(["nuxt", "__nuxt", "_nuxt/"], "Nuxt.js") ? "Nuxt.js" :
    check(["gatsby", "gatsby-browser", "gatsby-chunk"], "Gatsby") ? "Gatsby" :
    check(["__vue_app__", "vue.min.js", "vue.esm", "vue-router"], "Vue.js") ? "Vue.js" :
    check(["angular", "ng-version", "angular.min.js", "zone.js/dist/zone"], "Angular") ? "Angular" :
    check(["data-reactroot", "__reactinternalinstance", "react.min.js", "react-dom"], "React") ? "React" :
    check(["svelte", "svelte.js", "__svelte"], "Svelte") ? "Svelte" :
    null;

  const renderStrategy: TechStack["renderStrategy"] =
    h.includes("__next_data__") || h.includes("__nuxt") ? "SSR" :
    h.includes("gatsby") ? "SSG" :
    (framework === "React" || framework === "Vue.js" || framework === "Angular" || framework === "Svelte") ? "SPA" :
    "MPA";

  const analytics: string[] = [];
  if (h.includes("google-analytics.com") || h.includes("gtag") || h.includes("ga('")) { analytics.push("Google Analytics"); detected.push("GA"); }
  if (h.includes("googletagmanager.com")) { analytics.push("Google Tag Manager"); detected.push("GTM"); }
  if (h.includes("fbq(") || h.includes("facebook.net/en_US/fbevents") || h.includes("facebook-pixel")) { analytics.push("Meta Pixel"); detected.push("Meta Pixel"); }
  if (h.includes("tiktok") && h.includes("ttq.")) { analytics.push("TikTok Pixel"); detected.push("TT Pixel"); }
  if (h.includes("hotjar") || h.includes("hj(")) { analytics.push("Hotjar"); detected.push("Hotjar"); }
  if (h.includes("clarity.ms") || h.includes("microsoft clarity")) { analytics.push("Microsoft Clarity"); }
  if (h.includes("segment.com") || h.includes("analytics.js")) { analytics.push("Segment"); }
  if (h.includes("mixpanel")) { analytics.push("Mixpanel"); }
  if (h.includes("amplitude")) { analytics.push("Amplitude"); }

  const chatWidgets: string[] = [];
  if (h.includes("intercom")) chatWidgets.push("Intercom");
  if (h.includes("drift.com") || h.includes("driftt.com")) chatWidgets.push("Drift");
  if (h.includes("tidio")) chatWidgets.push("Tidio");
  if (h.includes("crisp.chat") || h.includes("crisp-chat")) chatWidgets.push("Crisp");
  if (h.includes("zendesk")) chatWidgets.push("Zendesk");
  if (h.includes("hubspot")) chatWidgets.push("HubSpot Chat");
  if (h.includes("freshchat") || h.includes("freshdesk")) chatWidgets.push("Freshchat");
  if (h.includes("tawk.to")) chatWidgets.push("Tawk.to");

  const emailMarketing: string[] = [];
  if (h.includes("klaviyo")) emailMarketing.push("Klaviyo");
  if (h.includes("mailchimp")) emailMarketing.push("Mailchimp");
  if (h.includes("omnisend")) emailMarketing.push("Omnisend");
  if (h.includes("sendinblue") || h.includes("brevo")) emailMarketing.push("Brevo");
  if (h.includes("activecampaign")) emailMarketing.push("ActiveCampaign");

  const paymentProviders: string[] = [];
  if (h.includes("stripe.com") || h.includes("stripe.js")) paymentProviders.push("Stripe");
  if (h.includes("paypal.com") || h.includes("paypal.js")) paymentProviders.push("PayPal");
  if (h.includes("redsys") || h.includes("tpvv.lacaixa")) paymentProviders.push("Redsys (CaixaBank)");
  if (h.includes("klarna")) paymentProviders.push("Klarna");
  if (h.includes("afterpay") || h.includes("clearpay")) paymentProviders.push("Afterpay/Clearpay");
  if (h.includes("affirm")) paymentProviders.push("Affirm");
  if (h.includes("bizum")) paymentProviders.push("Bizum");
  if (h.includes("sequra")) paymentProviders.push("SeQura");

  const jsLibraries: string[] = [];
  if (h.includes("jquery")) jsLibraries.push("jQuery");
  if (h.includes("lodash") || h.includes("underscore")) jsLibraries.push("Lodash");
  if (h.includes("swiper")) jsLibraries.push("Swiper");
  if (h.includes("gsap") || h.includes("tweenmax") || h.includes("greensock")) jsLibraries.push("GSAP");
  if (h.includes("three.js") || h.includes("three.min.js")) jsLibraries.push("Three.js");
  if (h.includes("d3.js") || h.includes("d3.min.js")) jsLibraries.push("D3.js");
  if (h.includes("chart.js") || h.includes("chartjs")) jsLibraries.push("Chart.js");
  if (h.includes("leaflet")) jsLibraries.push("Leaflet");
  if (h.includes("alpinejs") || h.includes("x-data=")) jsLibraries.push("Alpine.js");
  if (h.includes("htmx")) jsLibraries.push("htmx");

  const cssFramework =
    h.includes("tailwind") ? "Tailwind CSS" :
    h.includes("bootstrap") ? "Bootstrap" :
    h.includes("bulma") ? "Bulma" :
    h.includes("foundation") ? "Foundation" :
    h.includes("materialize") ? "Materialize" :
    h.includes("chakra") ? "Chakra UI" :
    null;

  const cdnOrHosting =
    (responseHeaders?.["server"] ?? "").toLowerCase().includes("cloudflare") || h.includes("cloudflare") ? "Cloudflare" :
    h.includes("vercel") || h.includes("_vercel") ? "Vercel" :
    h.includes("netlify") ? "Netlify" :
    h.includes("amazonaws.com") || h.includes("cloudfront.net") ? "AWS" :
    null;

  const languages: string[] = [];
  const langMatches = html.matchAll(/lang=["']([a-zA-Z-]{2,10})["']/gi);
  for (const m of langMatches) {
    const lang = m[1].toLowerCase().split("-")[0];
    if (!languages.includes(lang)) languages.push(lang);
  }

  return {
    cms: cms ?? null,
    ecommerce: ecommerce ?? null,
    framework: framework ?? null,
    renderStrategy,
    analytics,
    chatWidgets,
    emailMarketing,
    cdnOrHosting,
    jsLibraries,
    cssFramework,
    paymentProviders,
    languages: languages.slice(0, 5),
    detected,
  };
}

// ─── Section Identification ──────────────────────────────────────────────────

export function identifySections(html: string): PageSection[] {
  const sections: PageSection[] = [];
  const h = html.toLowerCase();

  function extractFirstText(selector: RegExp): string | null {
    const m = html.match(selector);
    return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) : null;
  }

  const hasHero = /<(?:section|div)[^>]*(?:hero|banner|jumbotron|header-main|above-fold)[^>]*>/i.test(html) ||
    (h.includes("hero") && /<h1[^>]*>/i.test(html));
  if (hasHero) {
    sections.push({
      type: "hero",
      headline: extractFirstText(/<h1[^>]*>([\s\S]{1,200}?)<\/h1>/i),
      subtext: extractFirstText(/<(?:h2|p)[^>]*class="[^"]*(?:subtitle|subheading|tagline|lead)[^"]*"[^>]*>([\s\S]{1,300}?)<\/(?:h2|p)>/i),
      hasCta: /btn|button|cta|get-started|comprar|empezar/i.test(html),
    });
  }

  const hasFeatures = /<(?:section|div)[^>]*(?:features|benefits|servicios|ventajas|caracteristicas|how-it-works)[^>]*>/i.test(html) ||
    (h.split("features").length > 2 || h.split("beneficio").length > 2);
  if (hasFeatures) {
    sections.push({
      type: "features",
      headline: extractFirstText(/<(?:h2|h3)[^>]*>([^<]{5,100}(?:features|benefits|ventajas|beneficios|servicios)[^<]{0,100})<\/(?:h2|h3)>/i),
      subtext: null,
      hasCta: false,
    });
  }

  const hasPricing = /<(?:section|div)[^>]*(?:pricing|precios|planes|plans|tarifa)[^>]*>/i.test(html) ||
    h.includes("por mes") || h.includes("por año") || h.includes("/month") || h.includes("€/mes");
  if (hasPricing) {
    sections.push({
      type: "pricing",
      headline: extractFirstText(/<(?:h2|h3)[^>]*>([^<]{3,80}(?:precio|plan|tarifa|pricing)[^<]{0,60})<\/(?:h2|h3)>/i),
      subtext: null,
      hasCta: true,
    });
  }

  const hasTestimonials = /<(?:section|div)[^>]*(?:testimonials?|reviews?|opinion|testimonio|reseña|clientes-dicen)[^>]*>/i.test(html) ||
    h.includes("testimonial") || h.includes("review") || (h.includes("reseña") && h.includes("★"));
  if (hasTestimonials) {
    sections.push({
      type: "testimonials",
      headline: extractFirstText(/<(?:h2|h3)[^>]*>([^<]{3,80}(?:opinion|testimonial|review|reseña|cliente)[^<]{0,60})<\/(?:h2|h3)>/i),
      subtext: null,
      hasCta: false,
    });
  }

  const hasFaq = /<(?:section|div)[^>]*(?:faq|preguntas|accordion)[^>]*>/i.test(html) ||
    h.includes("frequently asked") || h.includes("preguntas frecuentes");
  if (hasFaq) {
    sections.push({ type: "faq", headline: "FAQ / Preguntas frecuentes", subtext: null, hasCta: false });
  }

  const hasBlog = /\/blog\/|\/articulo\/|\/news\/|\/noticias\//i.test(html);
  if (hasBlog) sections.push({ type: "blog", headline: null, subtext: null, hasCta: false });

  const hasTeam = /<(?:section|div)[^>]*(?:team|equipo|about-us|sobre-nosotros)[^>]*>/i.test(html);
  if (hasTeam) sections.push({ type: "team", headline: null, subtext: null, hasCta: false });

  const hasContact = /<(?:section|div|form)[^>]*(?:contact|contacto|form)[^>]*>/i.test(html) ||
    h.includes("contacta") || h.includes("contact us");
  if (hasContact) sections.push({ type: "contact", headline: null, subtext: null, hasCta: true });

  return sections;
}

// ─── Sitemap Parser ──────────────────────────────────────────────────────────

async function parseSitemapXml(xml: string, baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const isSitemapIndex = /<sitemapindex/i.test(xml);

  if (isSitemapIndex) {
    const locMatches = xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi);
    const childSitemapUrls: string[] = [];
    for (const m of locMatches) childSitemapUrls.push(m[1]);

    await Promise.allSettled(childSitemapUrls.slice(0, 5).map(async (sitemapUrl) => {
      try {
        const res = await fetch(sitemapUrl, { ...FETCH_OPTS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return;
        const childXml = await res.text();
        const childLocs = childXml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi);
        for (const m of childLocs) urls.push(m[1]);
      } catch {}
    }));
  } else {
    const locMatches = xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi);
    for (const m of locMatches) urls.push(m[1]);
  }

  const parsedBase = (() => { try { return new URL(baseUrl); } catch { return null; } })();
  return urls
    .filter(u => {
      if (!parsedBase) return true;
      try { return new URL(u).hostname === parsedBase.hostname; } catch { return false; }
    })
    .filter(u => !/\.(jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js)(\?|$)/i.test(u))
    .filter((u, i, a) => a.indexOf(u) === i);
}

// ─── Page Scraper ────────────────────────────────────────────────────────────

function scrapePageDetailed(html: string, url: string): Omit<CrawledPage, "url" | "label" | "statusCode" | "isHomepage"> {
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

  const title = (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) ?? [])[1]?.trim() ?? "";
  const desc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]{1,400})"/i) ??
    html.match(/<meta[^>]*content="([^"]{1,400})"[^>]*name="description"/i) ?? [])[1]?.trim() ?? "";
  const ogDesc = (html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]{1,400})"/i) ?? [])[1] ?? "";

  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]{2,300}?)<\/h1>/gi)]
    .map(m => stripHtml(m[1])).filter(Boolean).slice(0, 5);
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]{2,200}?)<\/h2>/gi)]
    .map(m => stripHtml(m[1])).filter(Boolean).slice(0, 12);
  const h3 = [...html.matchAll(/<h3[^>]*>([\s\S]{2,150}?)<\/h3>/gi)]
    .map(m => stripHtml(m[1])).filter(Boolean).slice(0, 10);
  const paragraphs = [...html.matchAll(/<p[^>]{0,80}>([\s\S]{20,600}?)<\/p>/gi)]
    .map(m => stripHtml(m[1])).filter(t => t.length > 20).slice(0, 15);

  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1].trim().slice(0, 500)).slice(0, 3);

  const SOCIAL_RE: Array<{ p: string; re: RegExp }> = [
    { p: "instagram", re: /instagram\.com\/(?!reel|p\/|stories|explore|reels)([\w.]{2,40})/gi },
    { p: "tiktok", re: /tiktok\.com\/@([\w.]{2,40})/gi },
    { p: "facebook", re: /facebook\.com\/(?!sharer|share|dialog|events)([\w.]{2,60})/gi },
    { p: "twitter", re: /(?:twitter|x)\.com\/([\w]{2,40})/gi },
    { p: "youtube", re: /youtube\.com\/@([\w-]{2,50})/gi },
    { p: "linkedin", re: /linkedin\.com\/company\/([\w-]{2,60})/gi },
    { p: "pinterest", re: /pinterest\.com\/([\w.]{2,40})/gi },
    { p: "threads", re: /threads\.net\/@([\w.]{2,40})/gi },
  ];
  const socials: string[] = [];
  for (const { p, re } of SOCIAL_RE) {
    for (const m of html.matchAll(re)) {
      const handle = `${p}:@${(m[1] ?? "").replace(/^\//, "")}`;
      if (!socials.includes(handle)) socials.push(handle);
    }
  }

  const hexColors = [...new Set([...html.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => `#${m[1].toUpperCase()}`))]
    .slice(0, 20);

  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = clean.split(/\s+/).filter(w => w.length > 0).length;

  const sections = identifySections(html);

  const content = [
    title && `TÍTULO: ${title}`,
    desc && `DESC: ${ogDesc || desc}`,
    h1.length && `H1: ${h1.join(" | ")}`,
    h2.length && `H2: ${h2.slice(0, 8).join(" | ")}`,
    h3.length && `H3: ${h3.slice(0, 6).join(" | ")}`,
    paragraphs.length && `PÁRRAFOS: ${paragraphs.slice(0, 6).join(" // ")}`,
    jsonLd.length && `JSON-LD: ${jsonLd.join(" | ")}`,
    socials.length && `REDES: ${[...new Set(socials)].join(", ")}`,
    hexColors.length > 4 && `COLORES: ${hexColors.slice(0, 12).join(", ")}`,
    sections.length && `SECCIONES: ${sections.map(s => s.type).join(", ")}`,
  ].filter(Boolean).join("\n");

  return { title, description: ogDesc || desc, h1, h2, h3, paragraphs, jsonLd, socials, hexColors, wordCount, content, sections };
}

// ─── Priority URL Ranking ────────────────────────────────────────────────────

function prioritizeUrls(urls: string[], baseUrl: string): string[] {
  const HIGH_PRIORITY = ["", "/", "/about", "/about-us", "/sobre-nosotros", "/quienes-somos", "/historia",
    "/services", "/servicios", "/products", "/productos", "/contact", "/contacto",
    "/pricing", "/precios", "/blog", "/tienda", "/store", "/shop"];

  const base = baseUrl.replace(/\/$/, "");

  const highPriority = HIGH_PRIORITY.map(p => `${base}${p}`).filter(u => urls.includes(u));
  const rest = urls.filter(u => !highPriority.includes(u));

  return [...highPriority, ...rest];
}

// ─── Main Crawler ────────────────────────────────────────────────────────────

export async function crawlSiteFromSitemap(
  rawBaseUrl: string,
  maxPages = 20,
): Promise<SiteCrawlResult> {
  const baseUrl = rawBaseUrl.replace(/\/$/, "");
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  let sitemapFound = false;
  let sitemapUrls: string[] = [];
  let techStack: TechStack | null = null;

  const EMPTY: SiteCrawlResult = {
    baseUrl, totalPagesDiscovered: 0, pagesCrawled: 0,
    pages: [], techStack: detectTechStack(""), sitemapFound: false,
    sitemapUrls: [], allContent: "", socialHandles: [], colorPalette: [],
  };

  try {
    const sitemapRes = await fetch(sitemapUrl, { ...FETCH_OPTS, signal: AbortSignal.timeout(12_000) });
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      sitemapUrls = await parseSitemapXml(xml, baseUrl);
      sitemapFound = sitemapUrls.length > 0;
      logger.info({ baseUrl, urlCount: sitemapUrls.length }, "site-crawler: sitemap parsed");
    }
  } catch (e) {
    logger.warn({ e, sitemapUrl }, "site-crawler: sitemap fetch failed — falling back to heuristic paths");
  }

  let urlsToCrawl: string[];
  if (sitemapUrls.length > 0) {
    urlsToCrawl = prioritizeUrls(sitemapUrls, baseUrl);
  } else {
    urlsToCrawl = [
      baseUrl, `${baseUrl}/about`, `${baseUrl}/about-us`, `${baseUrl}/sobre-nosotros`,
      `${baseUrl}/quienes-somos`, `${baseUrl}/services`, `${baseUrl}/servicios`,
      `${baseUrl}/products`, `${baseUrl}/contact`, `${baseUrl}/contacto`,
      `${baseUrl}/pricing`, `${baseUrl}/precios`, `${baseUrl}/blog`,
    ];
  }

  urlsToCrawl = urlsToCrawl.slice(0, maxPages);

  const crawlResults = await Promise.allSettled(
    urlsToCrawl.map(async (url): Promise<CrawledPage> => {
      const res = await fetch(url, { ...FETCH_OPTS, signal: AbortSignal.timeout(15_000) });
      const html = await res.text();

      const isHomepage = url === baseUrl || url === `${baseUrl}/`;
      if (isHomepage || !techStack) {
        techStack = detectTechStack(html);
      }

      const label = url.replace(baseUrl, "").replace(/^\//, "").toUpperCase() || "HOMEPAGE";
      const details = scrapePageDetailed(html, url);

      return { url, label, statusCode: res.status, isHomepage, ...details };
    })
  );

  const pages = crawlResults
    .filter((r): r is PromiseFulfilledResult<CrawledPage> => r.status === "fulfilled" && r.value.statusCode < 400)
    .map(r => r.value);

  const allSocials = [...new Set(pages.flatMap(p => p.socials))];
  const allColors = [...new Set(pages.flatMap(p => p.hexColors))].slice(0, 30);

  const allContent = pages
    .map(p => `\n\n=== PÁGINA: ${p.label} (${p.url}) ===\n${p.content}`)
    .join("\n")
    .slice(0, 25000);

  logger.info({ baseUrl, pagesCrawled: pages.length, sitemapFound }, "site-crawler: complete");

  return {
    baseUrl,
    totalPagesDiscovered: sitemapUrls.length || urlsToCrawl.length,
    pagesCrawled: pages.length,
    pages,
    techStack: techStack ?? detectTechStack(""),
    sitemapFound,
    sitemapUrls,
    allContent,
    socialHandles: allSocials,
    colorPalette: allColors,
  };
}

export function formatTechStackForPrompt(tech: TechStack): string {
  const lines: string[] = [];
  lines.push("🛠 TECH STACK DETECTADO:");
  if (tech.cms) lines.push(`  CMS: ${tech.cms}`);
  if (tech.ecommerce) lines.push(`  eCommerce: ${tech.ecommerce}`);
  if (tech.framework) lines.push(`  Framework: ${tech.framework} (${tech.renderStrategy})`);
  if (tech.cssFramework) lines.push(`  CSS: ${tech.cssFramework}`);
  if (tech.analytics.length) lines.push(`  Analytics: ${tech.analytics.join(", ")}`);
  if (tech.chatWidgets.length) lines.push(`  Chat/CRM: ${tech.chatWidgets.join(", ")}`);
  if (tech.emailMarketing.length) lines.push(`  Email Marketing: ${tech.emailMarketing.join(", ")}`);
  if (tech.paymentProviders.length) lines.push(`  Pagos: ${tech.paymentProviders.join(", ")}`);
  if (tech.jsLibraries.length) lines.push(`  Librerías JS: ${tech.jsLibraries.join(", ")}`);
  if (tech.cdnOrHosting) lines.push(`  Hosting/CDN: ${tech.cdnOrHosting}`);
  if (tech.languages.length) lines.push(`  Idiomas: ${tech.languages.join(", ")}`);
  return lines.join("\n");
}
