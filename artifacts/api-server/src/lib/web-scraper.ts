import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface WebScrapingResult {
  url: string;
  statusCode: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaKeywords: string | null;
  ogTags: {
    title: string | null;
    description: string | null;
    image: string | null;
    type: string | null;
    url: string | null;
  };
  twitterCard: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  canonicalUrl: string | null;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
    h1Count: number;
    totalCount: number;
  };
  images: {
    total: number;
    withoutAlt: number;
    withoutAltList: string[];
  };
  links: {
    internal: number;
    external: number;
    broken: number;
  };
  jsonLdSchemas: unknown[];
  robotsTxt: { exists: boolean; content: string | null };
  sitemapXml: { exists: boolean; url: string | null };
  favicon: boolean;
  language: string | null;
  hreflangTags: string[];
  viewportMeta: boolean;
  ssl: boolean;
  wordCount: number;
  textContent: string;
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractTag(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? decodeHtmlEntities(m[1].trim()) : null;
}

function extractAllMatches(html: string, regex: RegExp): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(html)) !== null) {
    results.push(decodeHtmlEntities(m[1].trim()));
  }
  return results;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url.replace(/\/+$/, "");
}

function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

const BLOCKED_HOSTS = [
  "localhost", "127.0.0.1", "0.0.0.0", "[::1]",
  "metadata.google.internal", "169.254.169.254",
];

/**
 * IP privada, local, reservada o de metadatos. Acepta IPv6 entre corchetes (como
 * lo da URL.hostname) y direcciones IPv4 mapeadas en IPv6: antes
 * "http://[::ffff:127.0.0.1]/" (hostname "[::ffff:7f00:1]") pasaba el filtro.
 */
export function isPrivateIp(raw: string): boolean {
  let ip = raw.replace(/^\[|\]$/g, "").toLowerCase();
  const mapped = ip.match(/^::ffff:(.+)$/);
  if (mapped) {
    const rest = mapped[1];
    const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (isIP(rest) === 4) ip = rest;
    else if (hex) {
      const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
      ip = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
  }
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)   // CGNAT (redes internas de proveedores)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(ip) === 6) {
    return ip === "::" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || /^fe[89ab]/.test(ip);
  }
  return false;
}

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Solo se permiten URLs http/https");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new Error("URL no permitida: dirección interna");
  }

  if (isPrivateIp(hostname)) {
    throw new Error("URL no permitida: red privada");
  }
}

export async function validateUrlWithDnsCheck(url: string): Promise<void> {
  return validateUrlWithDns(url);
}

async function validateUrlWithDns(url: string): Promise<void> {
  validateUrl(url);

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // IP literal: ya la ha comprobado validateUrl.
  if (isIP(hostname.replace(/^\[|\]$/g, ""))) return;

  // lookup (como fetch) devuelve IPv4 e IPv6; antes resolve() solo miraba registros A.
  try {
    const addresses = await dnsLookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        throw new Error("URL no permitida: el dominio resuelve a una dirección privada");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("no permitida")) throw err;
  }
}

/**
 * fetch para URLs que vienen de usuarios: valida la URL y CADA redirección (antes
 * redirect:"follow" validaba solo la primera y un 302 podía llevar a 127.0.0.1 o
 * a 169.254.169.254).
 */
export async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await validateUrlWithDns(current);
    const resp = await fetch(current, { ...init, redirect: "manual" });
    const location = resp.status >= 300 && resp.status < 400 ? resp.headers.get("location") : null;
    if (!location) return resp;
    await resp.body?.cancel().catch(() => {});
    current = new URL(location, current).toString();
  }
  throw new Error("Demasiadas redirecciones");
}

export function validateAuditUrl(rawUrl: string): string | null {
  try {
    const url = normalizeUrl(rawUrl);
    validateUrl(url);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "URL inválida";
  }
}

export async function scrapeWebsite(rawUrl: string): Promise<WebScrapingResult> {
  const url = normalizeUrl(rawUrl);
  await validateUrlWithDns(url);
  const baseUrl = getBaseUrl(url);
  const ssl = url.startsWith("https://");

  const resp = await safeFetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(45_000),
  });

  const html = await resp.text();
  const statusCode = resp.status;

  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    extractTag(html, /<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i) ??
    extractTag(html, /<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*\/?>/i);
  const metaKeywords =
    extractTag(html, /<meta[^>]*name=["']keywords["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i) ??
    extractTag(html, /<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']keywords["'][^>]*\/?>/i);

  const ogTitle = extractTag(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const ogDesc = extractTag(html, /<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const ogImage = extractTag(html, /<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const ogType = extractTag(html, /<meta[^>]*property=["']og:type["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const ogUrl = extractTag(html, /<meta[^>]*property=["']og:url["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);

  const twCard = extractTag(html, /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const twTitle = extractTag(html, /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const twDesc = extractTag(html, /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);
  const twImage = extractTag(html, /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i);

  const canonicalUrl = extractTag(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([\s\S]*?)["'][^>]*\/?>/i);

  const h1 = extractAllMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripHtml);
  const h2 = extractAllMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(stripHtml);
  const h3 = extractAllMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).map(stripHtml);
  const h4 = extractAllMatches(html, /<h4[^>]*>([\s\S]*?)<\/h4>/gi).map(stripHtml);
  const h5 = extractAllMatches(html, /<h5[^>]*>([\s\S]*?)<\/h5>/gi).map(stripHtml);
  const h6 = extractAllMatches(html, /<h6[^>]*>([\s\S]*?)<\/h6>/gi).map(stripHtml);

  const imgMatches = html.matchAll(/<img[^>]*>/gi);
  const allImages: string[] = [];
  const withoutAltList: string[] = [];
  for (const im of imgMatches) {
    const tag = im[0];
    const src = tag.match(/src=["'](.*?)["']/i)?.[1] ?? "";
    allImages.push(src);
    const altMatch = tag.match(/alt=["'](.*?)["']/i);
    if (!altMatch || altMatch[1].trim() === "") {
      withoutAltList.push(src);
    }
  }

  const linkMatches = html.matchAll(/<a[^>]*href=["'](.*?)["'][^>]*>/gi);
  let internalLinks = 0;
  let externalLinks = 0;
  for (const lm of linkMatches) {
    const href = lm[1];
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (href.startsWith("/") || href.includes(new URL(url).hostname)) {
      internalLinks++;
    } else if (href.startsWith("http")) {
      externalLinks++;
    }
  }

  const jsonLdSchemas: unknown[] = [];
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const jm of jsonLdMatches) {
    try {
      jsonLdSchemas.push(JSON.parse(jm[1]));
    } catch {}
  }

  const language = extractTag(html, /<html[^>]*lang=["']([^"']*?)["']/i);
  const hreflangTags = extractAllMatches(html, /<link[^>]*hreflang=["']([^"']*?)["'][^>]*>/gi);
  const viewportMeta = /<meta[^>]*name=["']viewport["']/i.test(html);
  const favicon = /<link[^>]*rel=["'](?:shortcut )?icon["']/i.test(html) || /<link[^>]*rel=["']apple-touch-icon["']/i.test(html);

  const textContent = stripHtml(html);
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  const [robotsTxt, sitemapXml] = await Promise.all([
    fetchRobotsTxt(baseUrl),
    fetchSitemapXml(baseUrl),
  ]);

  return {
    url,
    statusCode,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    metaKeywords,
    ogTags: { title: ogTitle, description: ogDesc, image: ogImage, type: ogType, url: ogUrl },
    twitterCard: { card: twCard, title: twTitle, description: twDesc, image: twImage },
    canonicalUrl,
    headings: {
      h1, h2, h3, h4, h5, h6,
      h1Count: h1.length,
      totalCount: h1.length + h2.length + h3.length + h4.length + h5.length + h6.length,
    },
    images: { total: allImages.length, withoutAlt: withoutAltList.length, withoutAltList: withoutAltList.slice(0, 20) },
    links: { internal: internalLinks, external: externalLinks, broken: 0 },
    jsonLdSchemas,
    robotsTxt,
    sitemapXml,
    favicon,
    language,
    hreflangTags,
    viewportMeta,
    ssl,
    wordCount,
    textContent: textContent.slice(0, 25000),
  };
}

async function fetchRobotsTxt(baseUrl: string): Promise<{ exists: boolean; content: string | null }> {
  try {
    const resp = await fetch(`${baseUrl}/robots.txt`, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.ok) {
      const text = await resp.text();
      return { exists: true, content: text.slice(0, 8000) };
    }
    return { exists: false, content: null };
  } catch {
    return { exists: false, content: null };
  }
}

async function fetchSitemapXml(baseUrl: string): Promise<{ exists: boolean; url: string | null }> {
  try {
    const resp = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.ok) {
      return { exists: true, url: `${baseUrl}/sitemap.xml` };
    }
    return { exists: false, url: null };
  } catch {
    return { exists: false, url: null };
  }
}

export function formatScrapingForPrompt(result: WebScrapingResult): string {
  const lines: string[] = [];
  lines.push(`🌐 ANÁLISIS HTML DE ${result.url}`);
  lines.push(`Estado HTTP: ${result.statusCode} | SSL: ${result.ssl ? "✅" : "❌"} | Idioma: ${result.language ?? "no especificado"}`);
  lines.push("");
  lines.push(`📋 SEO ON-PAGE:`);
  lines.push(`  Title: ${result.title ?? "❌ SIN TÍTULO"} (${result.titleLength} chars)`);
  lines.push(`  Meta Desc: ${result.metaDescription?.slice(0, 100) ?? "❌ SIN META DESCRIPTION"}${result.metaDescription && result.metaDescription.length > 100 ? "..." : ""} (${result.metaDescriptionLength} chars)`);
  lines.push(`  Keywords: ${result.metaKeywords ?? "no definidas"}`);
  lines.push(`  Canonical: ${result.canonicalUrl ?? "no definida"}`);
  lines.push(`  Viewport: ${result.viewportMeta ? "✅" : "❌"} | Favicon: ${result.favicon ? "✅" : "❌"}`);
  lines.push("");
  lines.push(`📊 OPEN GRAPH:`);
  lines.push(`  og:title: ${result.ogTags.title ?? "❌"} | og:desc: ${result.ogTags.description ? "✅" : "❌"} | og:image: ${result.ogTags.image ? "✅" : "❌"}`);
  lines.push(`  Twitter Card: ${result.twitterCard.card ?? "❌"}`);
  lines.push("");
  lines.push(`📝 ESTRUCTURA DE CONTENIDO:`);
  lines.push(`  H1 (${result.headings.h1Count}): ${result.headings.h1.join(", ") || "❌ SIN H1"}`);
  lines.push(`  H2 (${result.headings.h2.length}): ${result.headings.h2.slice(0, 5).join(", ") || "ninguno"}`);
  lines.push(`  H3-H6: ${result.headings.h3.length + result.headings.h4.length + result.headings.h5.length + result.headings.h6.length} totales`);
  lines.push(`  Palabras: ${result.wordCount}`);
  lines.push("");
  lines.push(`🖼 IMÁGENES: ${result.images.total} total, ${result.images.withoutAlt} sin alt text`);
  lines.push(`🔗 ENLACES: ${result.links.internal} internos, ${result.links.external} externos`);
  lines.push(`📄 Schema.org: ${result.jsonLdSchemas.length > 0 ? `${result.jsonLdSchemas.length} esquemas encontrados` : "❌ Sin datos estructurados"}`);
  lines.push(`🤖 robots.txt: ${result.robotsTxt.exists ? "✅" : "❌"} | sitemap.xml: ${result.sitemapXml.exists ? "✅" : "❌"}`);

  if (result.hreflangTags.length > 0) {
    lines.push(`🌍 Hreflang: ${result.hreflangTags.join(", ")}`);
  }

  return lines.join("\n");
}
