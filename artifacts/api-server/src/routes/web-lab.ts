import { Router, type Request, type Response } from "express";
import { enableLongRunning } from "../lib/long-running.js";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { scrapeWebsite, validateUrlWithDnsCheck } from "../lib/web-scraper.js";
import { runPageSpeedAudit } from "../lib/pagespeed.js";
import { askGeminiWithSearch, isGeminiSearchBlocked } from "../lib/gemini.js";
import { saveToVault } from "../lib/vault.js";
import { getReportShell, type ReportTemplate } from "./exports.js";
import { db, projectsTable, projectFilesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { checkProductionLimit, recordUsage } from "../lib/plan-limits.js";
import { setupZipStream } from "../lib/zip-stream.js";
import archiver from "archiver";

const router = Router();

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const VALID_TEMPLATES = new Set<ReportTemplate>(["classic", "elegance", "prestige"]);

interface ExtractedWebContent {
  html: string;
  css: string;
  stylesheetUrls: string[];
  designSignals: DesignSignals;
}

interface DesignSignals {
  fontFamilies: Array<{ family: string; uses: number }>;
  fontFaces: Array<{ family: string; src: string }>;
  palette: Array<{ color: string; uses: number }>;
  cssVars: Array<{ name: string; value: string }>;
  googleFonts: string[];
}

// Extrae señales cuantitativas del CSS (paleta con frecuencia, fuentes
// realmente usadas, @font-face, custom properties). Damos a la IA atajos
// numéricos en vez de obligarla a inferirlos del CSS bruto, que muchas veces
// viene minificado y truncado.
function extractDesignSignals(html: string, css: string): DesignSignals {
  const fontUses = new Map<string, number>();
  const familyRegex = /font-family\s*:\s*([^;}\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = familyRegex.exec(css)) !== null) {
    const list = m[1].split(",").map(s => s.trim().replace(/['"]/g, "")).filter(Boolean);
    if (list.length) {
      const primary = list[0];
      if (primary && primary.length < 80 && !/^var\(/i.test(primary)) {
        fontUses.set(primary, (fontUses.get(primary) || 0) + 1);
      }
    }
  }

  const fontFaces: Array<{ family: string; src: string }> = [];
  const faceRegex = /@font-face\s*\{([^}]+)\}/gi;
  while ((m = faceRegex.exec(css)) !== null) {
    const block = m[1];
    const fam = /font-family\s*:\s*['"]?([^;'"\n]+)['"]?/i.exec(block)?.[1]?.trim();
    const src = /src\s*:\s*([^;]+);/i.exec(block)?.[1]?.trim().slice(0, 200);
    if (fam) fontFaces.push({ family: fam, src: src || "" });
  }

  const colorUses = new Map<string, number>();
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
  while ((m = hexRegex.exec(css)) !== null) {
    let hex = m[1].toLowerCase();
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    if (hex.length === 6 || hex.length === 8) {
      const norm = "#" + hex.slice(0, 6);
      colorUses.set(norm, (colorUses.get(norm) || 0) + 1);
    }
  }
  const rgbRegex = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
  while ((m = rgbRegex.exec(css)) !== null) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    if ([r, g, b].every(v => v >= 0 && v <= 255)) {
      const norm = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
      colorUses.set(norm, (colorUses.get(norm) || 0) + 1);
    }
  }

  const cssVars: Array<{ name: string; value: string }> = [];
  const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
  const seenVar = new Set<string>();
  while ((m = varRegex.exec(css)) !== null) {
    const name = `--${m[1]}`;
    if (seenVar.has(name)) continue;
    seenVar.add(name);
    cssVars.push({ name, value: m[2].trim().slice(0, 80) });
    if (cssVars.length >= 40) break;
  }

  const googleFonts: string[] = [];
  // Captura cada parámetro family= dentro de URLs de fonts.googleapis.com
  // (las URLs Google Fonts v2 pueden encadenar varios family= con &).
  const gfUrlRegex = /fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi;
  while ((m = gfUrlRegex.exec(html)) !== null) {
    const query = m[1].replace(/&amp;/g, "&");
    const famRegex = /family=([^&]+)/gi;
    let fm: RegExpExecArray | null;
    while ((fm = famRegex.exec(query)) !== null) {
      const fam = decodeURIComponent(fm[1]).split(":")[0].replace(/\+/g, " ").trim();
      if (fam && !googleFonts.includes(fam)) googleFonts.push(fam);
    }
  }

  return {
    fontFamilies: [...fontUses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([family, uses]) => ({ family, uses })),
    fontFaces: fontFaces.slice(0, 12),
    palette: [...colorUses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([color, uses]) => ({ color, uses })),
    cssVars,
    googleFonts: googleFonts.slice(0, 10),
  };
}

async function extractFullWebContent(url: string): Promise<ExtractedWebContent> {
  let currentUrl = url;
  let resp: globalThis.Response | null = null;
  for (let hops = 0; hops < 5; hops++) {
    await validateUrlWithDnsCheck(currentUrl);
    resp = await fetch(currentUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    break;
  }
  if (!resp) throw new Error("No response received");
  const finalUrl = currentUrl;

  const html = await resp.text();

  const inlineStyles: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(html)) !== null) {
    if (match[1].trim()) inlineStyles.push(match[1].trim());
  }

  const linkRegex = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const linkRegex2 = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  const stylesheetUrls: string[] = [];
  const seen = new Set<string>();

  for (const re of [linkRegex, linkRegex2]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let href = m[1];
      const resolveBase = finalUrl || url;
      if (href.startsWith("//")) href = "https:" + href;
      else if (href.startsWith("/")) {
        const base = new URL(resolveBase);
        href = base.origin + href;
      } else if (!href.startsWith("http")) {
        try {
          href = new URL(href, resolveBase).toString();
        } catch { continue; }
      }
      if (!seen.has(href)) {
        seen.add(href);
        stylesheetUrls.push(href);
      }
    }
  }

  const externalCss: string[] = [];
  const fetchPromises = stylesheetUrls.slice(0, 15).map(async (cssUrl) => {
    try {
      await validateUrlWithDnsCheck(cssUrl);
      const cssResp = await fetch(cssUrl, {
        headers: { "User-Agent": BROWSER_UA },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (cssResp.ok) {
        const text = await cssResp.text();
        return `/* === ${escapeHtml(cssUrl)} === */\n${text}`;
      }
    } catch {}
    return "";
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) externalCss.push(r.value);
  }

  const allCss = [...inlineStyles, ...externalCss].join("\n\n");
  const designSignals = extractDesignSignals(html, allCss);

  return {
    html: html.substring(0, 200_000),
    css: allCss.substring(0, 120_000),
    stylesheetUrls,
    designSignals,
  };
}

function formatDesignSignals(s: DesignSignals): string {
  const lines: string[] = [];
  lines.push("--- SEÑALES DE DISEÑO EXTRAÍDAS DEL CSS REAL ---");
  if (s.fontFamilies.length) {
    lines.push(`Fuentes (por frecuencia): ${s.fontFamilies.map(f => `${f.family}(${f.uses})`).join(", ")}`);
  }
  if (s.fontFaces.length) {
    lines.push(`@font-face declarados: ${s.fontFaces.map(f => f.family).join(", ")}`);
  }
  if (s.googleFonts.length) {
    lines.push(`Google Fonts cargados: ${s.googleFonts.join(", ")}`);
  }
  if (s.palette.length) {
    lines.push(`Paleta cuantitativa (color → usos): ${s.palette.slice(0, 10).map(p => `${p.color}(${p.uses})`).join(" · ")}`);
  }
  if (s.cssVars.length) {
    lines.push(`Custom properties detectadas: ${s.cssVars.slice(0, 16).map(v => `${v.name}=${v.value}`).join(" · ")}`);
  }
  return lines.join("\n");
}

interface WebLabAnalysis {
  overallScore: number;
  categories: {
    design: number;
    ux: number;
    responsive: number;
    accessibility: number;
    performance: number;
    consistency: number;
  };
  colorPalette: {
    current: string[];
    improved: string[];
  };
  typography: {
    current: string[];
    improved: string[];
  };
  structure: Array<{ section: string; element: string; issues: number }>;
  issues: Array<{
    selector: string;
    property: string;
    current: string;
    improved: string;
    severity: "critical" | "high" | "medium" | "low";
    reason: string;
  }>;
  improvedCss: string;
  improvedHtmlFragments: Array<{
    section: string;
    original: string;
    improved: string;
  }>;
  summary: string;
}

const WEB_DESIGN_SYSTEM = `Eres un experto mundial en diseño web, UX/UI, accesibilidad WCAG 2.1, CSS profesional y responsive design.
Tu trabajo es analizar el código real (HTML y CSS) de una página web y producir un REDISEÑO COMPLETO con CSS profesional específico para esa marca.

REGLAS CRÍTICAS:
- Analiza el código REAL que recibes, no inventes nada
- El "improvedCss" DEBE ser un archivo CSS COMPLETO de mínimo 200 líneas, profesional, listo para producción
- El CSS mejorado NO puede ser genérico — debe usar los colores EXACTOS de la marca, sus tipografías, su estilo visual
- Incluye: CSS custom properties (--brand-primary, --brand-secondary, etc), reset, tipografía, layout, componentes, responsive breakpoints, hover states, transitions, sombras, gradients
- Incluye SIEMPRE: @import de Google Fonts específicas para la marca
- El CSS debe cubrir: header, nav, hero, sections, cards, botones, footer, formularios, grid/flexbox layouts, animaciones sutiles
- Cada issue debe incluir el selector CSS exacto, la propiedad, el valor actual y el mejorado
- El score debe ser objetivo y basado en estándares reales (WCAG, Core Web Vitals)
- Los fragmentos HTML mejorados deben ser semánticos, accesibles y modernos
- La paleta mejorada debe POTENCIAR la identidad de marca, no reemplazarla

PROHIBIDO ABSOLUTAMENTE (rechazaremos la respuesta y la regeneraremos):
- Texto "Lorem ipsum" o cualquier variante latina de relleno
- Las palabras "placeholder", "[placeholder]", "TODO", "FIXME", "TBD", "Insert text here", "Add content here" en HTML o CSS
- Clases CSS genéricas tipo .class1, .div1, .section1, .untitled, .foo, .bar
- Selectores genéricos como .container-default, .generic-button, .default-card
- Valores hardcodeados sin sentido (#000, #fff sólo, font-family: Arial sólo) — usa la paleta y tipografía REALES de la marca
- HTML con texto en inglés genérico ("Welcome to our website", "Lorem ipsum dolor sit amet…") cuando la marca es de habla hispana
- Repetir literalmente el HTML/CSS original sin cambios — el "improved" tiene que ser distinto y mejor
- Generar una respuesta donde "improved" === "original" (haz un trabajo real, propón cambios concretos)

REGLA DE UNICIDAD POR MARCA:
- El nombre y los valores hex de --brand-primary, --brand-secondary, --brand-accent deben coincidir con la paleta REAL detectada para esta marca, no copiar valores de un análisis anterior
- Las Google Fonts importadas deben razonarse a partir del estilo de la marca (sector, tono, estética del Instagram), no usar siempre Inter+Playfair
- Los textos del HTML mejorado deben referirse a productos/servicios reales de la marca cuando se conozcan

CATEGORÍAS DE SCORE (0-100):
- design: Estética visual, espaciado, jerarquía, modernidad
- ux: Navegación, CTAs, flujo de usuario, micro-interacciones
- responsive: Adaptación móvil, breakpoints, flexbox/grid
- accessibility: Contraste, alt texts, ARIA, semántica HTML
- performance: CSS optimizado, selectores eficientes, carga
- consistency: Coherencia visual, sistema de diseño, tokens

CSS MEJORADO — REQUISITOS MÍNIMOS:
1. Custom properties (variables CSS) con los colores y fuentes de la marca
2. Reset/normalize básico
3. Sistema tipográfico completo (h1-h6, p, a, small, blockquote)
4. Layout con CSS Grid y/o Flexbox
5. Componentes: botones (primary, secondary, outline), cards, badges, alerts
6. Header/nav responsive con hamburger menu
7. Hero section con gradients/overlay
8. Footer profesional multi-columna
9. Responsive: min 3 breakpoints (mobile 480px, tablet 768px, desktop 1024px)
10. Micro-interacciones: hover, focus, active states con transitions
11. Sombras, border-radius consistentes
12. Dark mode support si aplica

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "overallScore": number,
  "categories": { "design": number, "ux": number, "responsive": number, "accessibility": number, "performance": number, "consistency": number },
  "colorPalette": { "current": ["#hex", ...], "improved": ["#hex", ...] },
  "typography": { "current": ["Font Name", ...], "improved": ["Font Name", ...] },
  "structure": [{ "section": "header|hero|nav|main|footer|sidebar|...", "element": "tag", "issues": number }],
  "issues": [{ "selector": ".class", "property": "prop", "current": "val", "improved": "val", "severity": "critical|high|medium|low", "reason": "..." }],
  "improvedCss": "/* CSS COMPLETO — mínimo 200 líneas, específico para la marca */",
  "improvedHtmlFragments": [{ "section": "nombre", "original": "<code>", "improved": "<code>" }],
  "summary": "Resumen ejecutivo del análisis en español"
}`;

router.post("/web-lab/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, projectId, template, brandName, instagram } = req.body as {
      url: string;
      projectId?: number;
      template?: ReportTemplate;
      brandName?: string;
      instagram?: string;
    };

    if (!url) { res.status(400).json({ error: "URL requerida" }); return; }

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    // FIX 502 Lab Web (parte 2): forzar flush de headers ANTES del trabajo
    // pesado. enableLongRunning() programa heartbeats cada 25s pero solo
    // escribe si res.headersSent===true. Antes de este flush, el primer
    // heartbeat se ignoraba porque headersSent quedaba en false hasta el
    // res.end() final, momento en que el proxy ya había cortado a los 60s.
    // Comprometemos status 200 + Content-Type aquí; los caminos de error
    // posteriores ya usan res.end(JSON.stringify({error})) en el catch.
    res.status(200);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    enableLongRunning(res);
    if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
      (res as unknown as { flushHeaders: () => void }).flushHeaders();
    }

    // FIX 502 Lab Web (parte 1): paralelizar PageSpeed mobile + desktop
    // (antes desktop corría secuencialmente añadiendo 30-90s extra). Junto al
    // heartbeat HTTP del enableLongRunning evita que el proxy corte a 60s.
    const [extraction, pageSpeed, pageSpeedDesktop, scraperData] = await Promise.all([
      extractFullWebContent(normalizedUrl),
      runPageSpeedAudit(normalizedUrl, "mobile").catch(() => null),
      runPageSpeedAudit(normalizedUrl, "desktop").catch(() => null),
      scrapeWebsite(normalizedUrl).catch(() => null),
    ]);

    const pid = projectId ?? 0;
    let projectName = "Análisis externo";
    if (projectId) {
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (proj) projectName = proj.name ?? projectName;
    }

    const htmlForClaude = extraction.html.length > 40_000
      ? `${extraction.html.slice(0, 25_000)}\n<!-- ...CONTENT TRIMMED FOR ANALYSIS... -->\n${extraction.html.slice(-15_000)}`
      : extraction.html;
    const cssForClaude = extraction.css.length > 30_000
      ? `${extraction.css.slice(0, 20_000)}\n/* ...CSS TRIMMED FOR ANALYSIS... */\n${extraction.css.slice(-10_000)}`
      : extraction.css;

    let brandResearch: {
      brandInfo: Record<string, unknown> | null;
      instagramInfo: Record<string, unknown> | null;
      competitorDesign: Record<string, unknown> | null;
      sectorDesign: Record<string, unknown> | null;
      encyclopedia: Record<string, unknown> | null;
      googleReviews: Record<string, unknown> | null;
      serpPositioning: { text: string; sources: string[] } | null;
    } = {
      brandInfo: null,
      instagramInfo: null,
      competitorDesign: null,
      sectorDesign: null,
      encyclopedia: null,
      googleReviews: null,
      serpPositioning: null,
    };

    // Detect analytics/tracking from extracted HTML
    const htmlForAnalytics = extraction.html.slice(0, 60_000);
    const analyticsDetection = {
      hasGoogleAnalytics: /gtag\s*\(|google-analytics\.com|G-[A-Z0-9]{4,}|UA-\d{4,}/i.test(htmlForAnalytics),
      hasGTM: /googletagmanager\.com|GTM-[A-Z0-9]+/i.test(htmlForAnalytics),
      hasFbPixel: /connect\.facebook\.net|fbq\s*\(/i.test(htmlForAnalytics),
      hasTikTokPixel: /analytics\.tiktok\.com|ttq\s*\./i.test(htmlForAnalytics),
      hasPinterest: /ct\.pinterest\.com|pintrk\s*\(/i.test(htmlForAnalytics),
      hasHotjar: /hotjar\.com|hj\s*\(|hjSettings/i.test(htmlForAnalytics),
      hasCookieBanner: /cookieconsent|cookie-banner|gdpr|consent-manager|cookiebot|axeptio/i.test(htmlForAnalytics),
      hasChatWidget: /intercom|zendesk|freshchat|tawk\.to|tidio|crisp\.chat/i.test(htmlForAnalytics),
    };

    const parsedUrl = new URL(normalizedUrl);
    const domain = parsedUrl.hostname.replace("www.", "");
    const searchName = brandName || domain.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

    logger.info({ searchName, instagram, domain }, "🔍 Web Lab: Starting brand research");

    try {
      const multiSourceHint = "Cruza información de MÚLTIPLES fuentes (Google, Bing, DuckDuckGo, Wikipedia, Trustpilot, Crunchbase, LinkedIn, Instagram, prensa local). Cita 'sources' con URLs reales encontradas. Si dos fuentes se contradicen, usa la más reciente o la oficial.";
      const [brandResult, igResult, competitorResult, sectorResult, encyclopediaResult, reviewsResult, serpResult] = await Promise.allSettled([
        askGeminiWithSearch(
          `Investiga "${searchName}" (${url}). ${multiSourceHint} Qué es, qué vende, sector/nicho, público objetivo (edad, género, poder adquisitivo), estilo de marca (luxury, streetwear, corporate, artesanal, tech, minimal, bold...), colores que usa, valores de marca, rango de precios. SOLO JSON: { "name": "", "sector": "", "audience": "", "style": "", "colors": [], "values": [], "priceRange": "", "luxuryLevel": 0, "designAdjectives": [], "sources": [] }`,
          "Brand analyst riguroso. Return ONLY valid JSON. Cruza Google, Bing, DuckDuckGo y fuentes oficiales antes de afirmar nada."
        ),
        instagram
          ? askGeminiWithSearch(
              `Analiza @${instagram} en Instagram: estilo visual, colores dominantes, tipo de fotos, engagement, estética general, filtros, tipo de producto mostrado. JSON: { "handle": "", "followers": "", "aesthetic": "", "colors": [], "photoStyle": "", "contentTypes": [], "mood": "" }`,
              "Instagram visual analyst. Return ONLY JSON."
            )
          : askGeminiWithSearch(
              `Busca la cuenta oficial de Instagram de "${searchName}" (${url}) en Google, Bing y DuckDuckGo. Si la encuentras, analiza su estilo visual. JSON: { "handle": "", "found": false, "aesthetic": "", "colors": [] }`,
              "Social media researcher. Return ONLY JSON."
            ),
        askGeminiWithSearch(
          `Busca 3 webs de competidores DIRECTOS de "${searchName}" y analiza su DISEÑO WEB. ${multiSourceHint} Patrones de diseño, colores, tipografías, estilo de layout, estilo de fotos. JSON: { "competitors": [{ "name": "", "url": "", "designStyle": "", "colors": [], "fonts": [], "highlights": "" }] }`,
          "Competitive design analyst. Return ONLY JSON."
        ),
        askGeminiWithSearch(
          `What are the best web design trends for ${searchName}'s sector in 2026? Find 3 award-winning websites (Awwwards, CSSDA, FWA) in the same industry. JSON: { "trends": [], "awardWinningExamples": [{ "url": "", "why": "" }], "recommendedFonts": [], "colorTrends": [] }`,
          "Web design trend analyst. Return ONLY JSON."
        ),
        askGeminiWithSearch(
          `Busca a "${searchName}" en Wikipedia (es y en) y en bases enciclopédicas/empresariales (Crunchbase, LinkedIn, OpenCorporates). ${multiSourceHint} Devuelve JSON: { "wikipediaUrl": "", "summary": "", "founded": "", "headquarters": "", "founders": [], "categoryTags": [], "knownFor": [], "sources": [] }`,
          "Encyclopedic researcher. Return ONLY JSON. Si nada concluyente, devuelve campos vacíos pero NO inventes."
        ),
        askGeminiWithSearch(
          `Search Google for reviews and reputation of "${searchName}" (${url}). Find: 1) Google Business reviews (rating and count if available), 2) Trustpilot rating if exists, 3) Reviews on Yelp, Sitejabber, or other review platforms, 4) Social media sentiment (positive/negative), 5) Any complaints or praises on forums or Reddit. Return JSON: { "googleRating": null, "googleReviewCount": null, "trustpilotRating": null, "trustpilotReviewCount": null, "otherRatings": [], "overallSentiment": "positive|neutral|negative", "keyPraises": [], "keyComplaints": [], "sources": [] }`,
          "Online reputation analyst. Search Google for REAL review data. Return ONLY valid JSON with actual data found."
        ),
        askGeminiWithSearch(
          `Search Google for the website ${domain} (brand: "${searchName}"). Find real SERP data: 1) How many pages indexed (use site:${domain}), 2) What keywords does it rank for in Google top 10? 3) Does it appear in Google Shopping? 4) Estimated domain authority or page authority, 5) Any featured snippets or rich results. Report specific URLs and rankings you found.`,
          "SEO SERP analyst. Search Google and return REAL ranking data for this website. Report specific page URLs and keyword rankings found."
        ),
      ]);

      const parseSafe = (r: PromiseSettledResult<{ text: string; sources: string[]; queries: string[] }>): Record<string, unknown> | null => {
        if (r.status !== "fulfilled") return null;
        try {
          const text = r.value?.text ?? "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          return jsonMatch ? JSON.parse(jsonMatch[0]) as Record<string, unknown> : null;
        } catch { return null; }
      };

      brandResearch.brandInfo = parseSafe(brandResult);
      brandResearch.instagramInfo = parseSafe(igResult);
      brandResearch.competitorDesign = parseSafe(competitorResult);
      brandResearch.sectorDesign = parseSafe(sectorResult);
      brandResearch.encyclopedia = parseSafe(encyclopediaResult);
      brandResearch.googleReviews = parseSafe(reviewsResult);
      brandResearch.serpPositioning = serpResult.status === "fulfilled"
        ? { text: serpResult.value?.text?.slice(0, 3000) ?? "", sources: serpResult.value?.sources?.slice(0, 10) ?? [] }
        : null;

      logger.info({
        hasBrand: !!brandResearch.brandInfo,
        hasIg: !!brandResearch.instagramInfo,
        hasCompetitors: !!brandResearch.competitorDesign,
        hasTrends: !!brandResearch.sectorDesign,
        hasReviews: !!brandResearch.googleReviews,
        hasSerp: !!brandResearch.serpPositioning,
      }, "✅ Brand research complete");
    } catch (err) {
      logger.warn({ err }, "Brand research partially failed — continuing with available data");
    }

    const brandContextBlock = `
═══ INTELIGENCIA DE MARCA (investigación en tiempo real) ═══
${brandResearch.brandInfo ? `MARCA: ${JSON.stringify(brandResearch.brandInfo)}` : "Marca: No se encontró información — genera CSS basado en análisis del HTML/CSS actual."}
${brandResearch.instagramInfo ? `INSTAGRAM: ${JSON.stringify(brandResearch.instagramInfo)}\nINSTRUCCIÓN: El CSS DEBE reflejar la estética de su Instagram.` : ""}
${brandResearch.competitorDesign ? `COMPETIDORES (diseño web): ${JSON.stringify(brandResearch.competitorDesign)}\nINSTRUCCIÓN: El CSS mejorado debe ser MEJOR que el de los competidores.` : ""}
${brandResearch.sectorDesign ? `TENDENCIAS DEL SECTOR: ${JSON.stringify(brandResearch.sectorDesign)}` : ""}
${brandResearch.encyclopedia ? `ENCICLOPEDIA / FUENTES OFICIALES: ${JSON.stringify(brandResearch.encyclopedia)}` : ""}
REGLA CRÍTICA: NO generes CSS genérico. El CSS debe sentirse EXACTAMENTE como la marca "${searchName}".
═══ FIN INTELIGENCIA DE MARCA ═══
`;

    let contextParts: string[] = [];
    contextParts.push(brandContextBlock);
    contextParts.push(`URL ANALIZADA: ${url}`);
    contextParts.push(`\n--- HTML REAL DE LA PÁGINA (${htmlForClaude.length} chars) ---\n${htmlForClaude}`);
    contextParts.push(`\n${formatDesignSignals(extraction.designSignals)}`);
    contextParts.push(`\n--- CSS REAL (inline + ${extraction.stylesheetUrls.length} archivos externos, ${cssForClaude.length} chars) ---\n${cssForClaude}`);

    if (pageSpeed) {
      contextParts.push(`\n--- PAGESPEED MOBILE ---\nPerformance: ${pageSpeed.performanceScore}/100 | SEO: ${pageSpeed.seoScore}/100 | Accessibility: ${pageSpeed.accessibilityScore}/100 | Best Practices: ${pageSpeed.bestPracticesScore}/100`);
      if (pageSpeed.coreWebVitals) {
        const cwv = pageSpeed.coreWebVitals;
        contextParts.push(`Core Web Vitals — LCP: ${cwv.lcp?.value}${cwv.lcp?.unit} (${cwv.lcp?.status}) | CLS: ${cwv.cls?.value} (${cwv.cls?.status}) | FCP: ${cwv.fcp?.value}${cwv.fcp?.unit} (${cwv.fcp?.status})`);
      }
    }
    if (pageSpeedDesktop) {
      contextParts.push(`\n--- PAGESPEED DESKTOP ---\nPerformance: ${pageSpeedDesktop.performanceScore}/100 | SEO: ${pageSpeedDesktop.seoScore}/100 | Accessibility: ${pageSpeedDesktop.accessibilityScore}/100`);
    }

    if (scraperData) {
      contextParts.push(`\n--- SCRAPER DATA ---\nTitle: ${scraperData.title}\nMeta Description: ${scraperData.metaDescription}\nH1s: ${scraperData.headings?.h1?.join(", ")}\nTotal Images: ${scraperData.images?.total} | Missing Alt: ${scraperData.images?.withoutAlt ?? 0}\nInternal Links: ${scraperData.links?.internal} | External Links: ${scraperData.links?.external}`);
    }

    const userPrompt = `Analiza en profundidad esta página web. Tienes el HTML y CSS REALES extraídos directamente del sitio.\n\n${contextParts.join("\n")}`;

    const analysis = await askClaudeJsonWithBrain<WebLabAnalysis>(
      pid, userPrompt, WEB_DESIGN_SYSTEM, "general", undefined, 16000, 300_000
    );

    if (!analysis.improvedCss) analysis.improvedCss = "/* No se generaron mejoras CSS */";
    if (!analysis.issues) analysis.issues = [];
    if (!analysis.categories) {
      analysis.categories = { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 };
    }

    // ── T004: Auditoría de calidad / uniqueness ──
    // Severos (CSS < 200 líneas, placeholder/lorem detectados) → rechazamos.
    // Resto → loguear y seguir.
    const audit = auditWebLabAnalysis(analysis, searchName);
    if (audit.warnings.length > 0) {
      logger.warn({ url, brand: searchName, warnings: audit.warnings, severe: audit.severeWarnings, cssLines: audit.cssLines }, "⚠ Web Lab — análisis con avisos de calidad");
    }
    if (audit.severeWarnings.length > 0) {
      logger.error({ url, brand: searchName, severe: audit.severeWarnings, cssLines: audit.cssLines }, "✗ Web Lab — análisis rechazado por calidad insuficiente");
      res.end(JSON.stringify({
        error: "El diseño generado no cumple los mínimos de calidad. Por favor reintenta o concreta más la marca/URL.",
        details: audit.severeWarnings,
      }));
      return;
    }
    if (pid > 0) {
      learnFromOperation({
        operationType: "web_lab_quality_audit",
        title: `Auditoría calidad Lab Web — ${searchName}`,
        content: `URL: ${url}. CSS: ${audit.cssLines} líneas. Fragments: ${analysis.improvedHtmlFragments?.length ?? 0}. Avisos: ${audit.warnings.join("; ") || "ninguno"}.`,
        confidence: audit.warnings.length === 0 ? 0.9 : 0.5,
        tags: ["web-lab", "quality-audit", searchName],
      });
    }
    if (!analysis.overallScore) {
      const cats = analysis.categories;
      analysis.overallScore = Math.round((cats.design + cats.ux + cats.responsive + cats.accessibility + cats.performance + cats.consistency) / 6);
    }

    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

    const tpl: ReportTemplate = (template && VALID_TEMPLATES.has(template)) ? template : "prestige";
    const reportBody = buildReportBody(analysis, url, pageSpeed, pageSpeedDesktop, scraperData);
    const reportHtml = getReportShell(tpl)(
      "Lab Web — Análisis de Diseño",
      `${projectName} — ${url}`,
      reportBody,
      date,
      projectName
    );

    let vaultReportId: number | null = null;
    let vaultCssId: number | null = null;
    let vaultHtmlId: number | null = null;

    if (pid > 0) {
      const tags = [url, "web-lab", "diseño", `score-${analysis.overallScore}`];

      [vaultReportId, vaultCssId, vaultHtmlId] = await Promise.all([
        saveToVault({
          projectId: pid,
          fileType: "web-lab-report",
          category: "web-lab",
          title: `Lab Web — ${url}`,
          description: analysis.summary,
          originalUrl: url,
          mimeType: "text/html",
          generatedBy: "web-lab",
          content: reportHtml,
          metadata: { url, score: analysis.overallScore, categories: analysis.categories, template: tpl, tags, analysis: JSON.stringify(analysis) },
        }),
        saveToVault({
          projectId: pid,
          fileType: "web-lab-css",
          category: "web-lab",
          title: `CSS Mejorado — ${url}`,
          description: `CSS profesional mejorado para ${url} — Score: ${analysis.overallScore}/100`,
          originalUrl: url,
          mimeType: "text/css",
          generatedBy: "web-lab",
          content: analysis.improvedCss,
          metadata: { url, score: analysis.overallScore, tags },
        }),
        saveToVault({
          projectId: pid,
          fileType: "web-lab-html",
          category: "web-lab",
          title: `HTML Mejorado — ${url}`,
          description: `Fragmentos HTML mejorados para ${url}`,
          originalUrl: url,
          mimeType: "text/html",
          generatedBy: "web-lab",
          content: (analysis.improvedHtmlFragments ?? []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
          metadata: { url, score: analysis.overallScore, fragments: analysis.improvedHtmlFragments?.length ?? 0, tags },
        }),
      ]);

      learnFromOperation({
        operationType: "web_lab_design_analysis",
        title: `Análisis diseño web: ${url} — Score ${analysis.overallScore}/100`,
        content: `Análisis de ${url}. Score general: ${analysis.overallScore}/100. Categorías: Diseño ${analysis.categories.design}, UX ${analysis.categories.ux}, Responsive ${analysis.categories.responsive}, Accesibilidad ${analysis.categories.accessibility}, Performance ${analysis.categories.performance}, Consistencia ${analysis.categories.consistency}. Issues encontrados: ${analysis.issues.length}. Resumen: ${analysis.summary}`,
        confidence: 0.85,
        tags: ["web-lab", "design-analysis", url],
      });

      learnFromOperation({
        operationType: "web_lab_css_patterns",
        title: `Patrones CSS detectados en ${url}`,
        content: `Paleta actual: ${analysis.colorPalette?.current?.join(", ")}. Paleta mejorada: ${analysis.colorPalette?.improved?.join(", ")}. Tipografía actual: ${analysis.typography?.current?.join(", ")}. Recomendada: ${analysis.typography?.improved?.join(", ")}. Issues CSS principales: ${analysis.issues.slice(0, 5).map(i => `${i.selector} → ${i.property}: ${i.current} → ${i.improved}`).join("; ")}`,
        confidence: 0.8,
        tags: ["web-lab", "css-patterns", "design-tokens"],
      });

      learnFromOperation({
        operationType: "web_lab_ux_insights",
        title: `UX/Accesibilidad insights: ${url}`,
        content: `UX Score: ${analysis.categories.ux}/100. Accesibilidad: ${analysis.categories.accessibility}/100. Responsive: ${analysis.categories.responsive}/100. Issues UX/a11y: ${analysis.issues.filter(i => ["accessibility", "ux", "responsive"].some(k => i.property?.toLowerCase().includes(k) || i.selector?.toLowerCase().includes(k))).length}. Resumen: ${analysis.summary}`,
        confidence: 0.8,
        tags: ["web-lab", "ux-insights", "accessibility"],
      });
    }

    if (brandResearch.brandInfo) {
      learnFromOperation({
        operationType: "web_lab_brand_intelligence",
        title: `Brand intelligence: ${searchName} — ${url}`,
        content: `Marca: ${JSON.stringify(brandResearch.brandInfo)}. Instagram: ${JSON.stringify(brandResearch.instagramInfo)}. Competidores: ${JSON.stringify(brandResearch.competitorDesign)}. Sector design trends: ${JSON.stringify(brandResearch.sectorDesign)}. Enciclopedia: ${JSON.stringify(brandResearch.encyclopedia)}.`,
        confidence: 0.85,
        tags: ["web-lab", "brand-intelligence", searchName, url],
      });
    }

    const result = JSON.stringify({
      success: true,
      analysis,
      brandResearch,
      reportHtml: pid === 0 ? reportHtml : undefined,
      vaultIds: { report: vaultReportId, css: vaultCssId, html: vaultHtmlId },
      pageSpeed: pageSpeed ? {
        mobile: { performance: pageSpeed.performanceScore, seo: pageSpeed.seoScore, accessibility: pageSpeed.accessibilityScore, bestPractices: pageSpeed.bestPracticesScore },
        desktop: pageSpeedDesktop ? { performance: pageSpeedDesktop.performanceScore, seo: pageSpeedDesktop.seoScore, accessibility: pageSpeedDesktop.accessibilityScore } : null,
        coreWebVitals: pageSpeed.coreWebVitals,
      } : null,
      scraperData: scraperData ? {
        title: scraperData.title,
        metaDescription: scraperData.metaDescription,
        h1s: scraperData.headings?.h1,
        totalImages: scraperData.images?.total,
        imagesMissingAlt: scraperData.images?.withoutAlt ?? 0,
      } : null,
      analyticsDetection,
      googleReviews: brandResearch.googleReviews,
      serpPositioning: brandResearch.serpPositioning,
      url,
      template: tpl,
    });
    res.end(result);
  } catch (err: any) {
    logger.error({ err }, "Web Lab analysis failed");
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Error en el análisis" });
    } else {
      try { res.end(JSON.stringify({ error: err.message || "Error en el análisis" })); } catch {}
    }
  }
});

router.get("/web-lab/history/:projectId", async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(String(req.params.projectId));
    if (isNaN(projectId)) { res.status(400).json({ error: "projectId requerido" }); return; }
    if (projectId === 0) { res.json({ items: [] }); return; }

    const items = await db
      .select()
      .from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.projectId, projectId),
        eq(projectFilesTable.category, "web-lab"),
        eq(projectFilesTable.fileType, "web-lab-report"),
      ))
      .orderBy(desc(projectFilesTable.createdAt))
      .limit(30);

    res.json({ items });
  } catch (err: any) {
    logger.error({ err }, "Web Lab history failed");
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/result/:vaultId", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultId = parseInt(String(req.params.vaultId));
    if (!vaultId) { res.status(400).json({ error: "vaultId requerido" }); return; }

    const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, vaultId));
    if (!file) { res.status(404).json({ error: "No encontrado" }); return; }

    res.json({ file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-css/:vaultId", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultId = parseInt(String(req.params.vaultId));
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-css"))
    );
    if (!file?.content) { res.status(404).json({ error: "CSS no encontrado" }); return; }

    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="improved-styles.css"`);
    res.send(file.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-html/:vaultId", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultId = parseInt(String(req.params.vaultId));
    const [htmlFile] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-html"))
    );
    if (!htmlFile?.content) { res.status(404).json({ error: "HTML no encontrado" }); return; }

    const cssFiles = await db.select().from(projectFilesTable).where(
      and(
        eq(projectFilesTable.projectId, htmlFile.projectId as number),
        eq(projectFilesTable.fileType, "web-lab-css"),
        eq(projectFilesTable.originalUrl, htmlFile.originalUrl ?? ""),
      )
    ).orderBy(desc(projectFilesTable.id));
    const cssContent = cssFiles.length > 0 ? cssFiles[0].content ?? "" : "";

    const fullHtml = buildStandalonePreviewHtml(htmlFile.content, cssContent, htmlFile.originalUrl ?? "URL desconocida");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="improved-preview.html"`);
    res.send(fullHtml);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-report/:vaultId", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultId = parseInt(String(req.params.vaultId));
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-report"))
    );
    if (!file?.content) { res.status(404).json({ error: "Informe no encontrado" }); return; }

    const requestedTpl = req.query.template;
    if (requestedTpl && VALID_TEMPLATES.has(requestedTpl as ReportTemplate)) {
      let meta: any = {};
      try { meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : (file.metadata ?? {}); } catch { meta = {}; }
      const storedTpl = meta?.template ?? "prestige";
      if (requestedTpl !== storedTpl && meta?.url) {
        const projectId = file.projectId;
        let projectName = "Análisis externo";
        if (projectId) {
          const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
          if (proj) projectName = proj.name ?? projectName;
        }
        const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
        const tpl = requestedTpl as ReportTemplate;

        let analysis: WebLabAnalysis;
        try { analysis = meta.analysis ? (typeof meta.analysis === "string" ? JSON.parse(meta.analysis) : meta.analysis) : null; } catch { analysis = null as any; }
        if (!analysis) analysis = { overallScore: meta.score ?? 50, categories: meta.categories ?? { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 }, summary: file.description ?? "", issues: [], improvedCss: "", improvedHtmlFragments: [], colorPalette: { current: [], improved: [] }, typography: { current: [], improved: [] }, structure: [] } as WebLabAnalysis;

        const reportBody = buildReportBody(analysis, meta.url, null, null, null);
        const reportHtml = getReportShell(tpl)(
          "Lab Web — Análisis de Diseño",
          `${projectName} — ${meta.url}`,
          reportBody,
          date,
          projectName
        );

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="web-lab-report-${tpl}.html"`);
        res.send(reportHtml);
        return;
      }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="web-lab-report.html"`);
    res.send(file.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/web-lab/download-report", async (req: Request, res: Response): Promise<void> => {
  try {
    const { vaultId, template: rawTemplate } = req.body;
    if (!vaultId) { res.status(400).json({ error: "vaultId requerido" }); return; }

    const tpl: ReportTemplate = VALID_TEMPLATES.has(rawTemplate) ? rawTemplate : "prestige";
    const vid = parseInt(String(vaultId));
    const [file] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vid), eq(projectFilesTable.fileType, "web-lab-report"))
    );
    if (!file?.content) { res.status(404).json({ error: "Informe no encontrado" }); return; }

    let meta: any = {};
    try { meta = typeof file.metadata === "string" ? JSON.parse(file.metadata) : (file.metadata ?? {}); } catch { meta = {}; }
    const storedTpl = meta?.template ?? "prestige";

    if (tpl === storedTpl) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="web-lab-report-${tpl}.html"`);
      res.send(file.content);
      return;
    }

    const projectId = file.projectId;
    let projectName = "Análisis externo";
    if (projectId) {
      const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (proj) projectName = proj.name ?? projectName;
    }

    const url = meta?.url ?? "URL desconocida";
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

    let analysis: WebLabAnalysis;
    try { analysis = meta?.analysis ? (typeof meta.analysis === "string" ? JSON.parse(meta.analysis) : meta.analysis) : null; } catch { analysis = null as any; }
    if (!analysis) analysis = { overallScore: meta?.score ?? 50, categories: meta?.categories ?? { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 }, summary: file.description ?? "", issues: [], improvedCss: "", improvedHtmlFragments: [], colorPalette: { current: [], improved: [] }, typography: { current: [], improved: [] }, structure: [] } as WebLabAnalysis;

    const reportBody = buildReportBody(analysis, url, null, null, null);
    const reportHtml = getReportShell(tpl)(
      "Lab Web — Análisis de Diseño",
      `${projectName} — ${url}`,
      reportBody,
      date,
      projectName
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="web-lab-report-${tpl}.html"`);
    res.send(reportHtml);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/web-lab/download-pack/:vaultId", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultId = parseInt(String(req.params.vaultId));
    const [reportFile] = await db.select().from(projectFilesTable).where(
      and(eq(projectFilesTable.id, vaultId), eq(projectFilesTable.fileType, "web-lab-report"))
    );
    if (!reportFile) { res.status(404).json({ error: "Análisis no encontrado" }); return; }

    const projectId = reportFile.projectId;
    let meta: any = {};
    try { meta = typeof reportFile.metadata === "string" ? JSON.parse(reportFile.metadata) : (reportFile.metadata ?? {}); } catch { meta = {}; }
    const targetUrl = meta?.url || "unknown";

    const relatedFiles = await db.select().from(projectFilesTable).where(
      and(
        eq(projectFilesTable.projectId, projectId as number),
        eq(projectFilesTable.category, "web-lab"),
        eq(projectFilesTable.originalUrl, targetUrl),
      )
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="web-lab-pack.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 }, forceUTF8: true } as any);
    const { isClientGone, markFinalizing } = setupZipStream(req, res, archive);
    archive.pipe(res);

    for (const f of relatedFiles) {
      if (isClientGone()) break;
      if (!f.content) continue;
      if (f.fileType === "web-lab-report") {
        archive.append(f.content, { name: "informe-web-lab.html" });
      } else if (f.fileType === "web-lab-css") {
        archive.append(f.content, { name: "improved-styles.css" });
      } else if (f.fileType === "web-lab-html") {
        archive.append(f.content, { name: "improved-fragments.html" });
      }
    }

    let cssContent = "";
    let htmlFragments = "";
    for (const f of [...relatedFiles].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
      if (f.fileType === "web-lab-css" && f.content) cssContent = f.content;
      if (f.fileType === "web-lab-html" && f.content) htmlFragments = f.content;
    }

    if (cssContent || htmlFragments) {
      const previewHtml = buildStandalonePreviewHtml(htmlFragments, cssContent, targetUrl);
      archive.append(previewHtml, { name: "preview-visual.html" });
    }

    const readme = `# Web Lab — Pack de Análisis\n\nURL analizada: ${targetUrl}\nFecha: ${new Date().toLocaleDateString("es-ES")}\n\n## Archivos incluidos\n\n- **preview-visual.html** — Abre en el navegador para ver cómo se ve el CSS aplicado visualmente.\n- **informe-web-lab.html** — Informe profesional completo con scores, issues y recomendaciones.\n- **improved-styles.css** — CSS mejorado listo para copiar/pegar en tu proyecto.\n- **improved-fragments.html** — Fragmentos HTML mejorados como referencia.\n\n## Instrucciones para el equipo de desarrollo\n\n1. Abre preview-visual.html en el navegador para ver los estilos aplicados\n2. Abre el informe HTML para ver el análisis completo\n3. Copia el contenido de improved-styles.css en tu archivo de estilos\n4. Revisa los fragmentos HTML para aplicar las mejoras estructurales\n5. Testea en móvil y escritorio antes de publicar\n\nGenerado por Shopy Crafter — shopycrafter.com`;

    archive.append(readme, { name: "README.md" });
    markFinalizing();
    await archive.finalize();
  } catch (err: any) {
    logger.error({ err }, "Web Lab download pack failed");
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// T004 — Auditoría de calidad / uniqueness post-generación
// Detecta señales de respuesta genérica o con placeholders.
// No bloquea al usuario; sólo emite avisos para auditar.
// ─────────────────────────────────────────────────────────────
function auditWebLabAnalysis(analysis: WebLabAnalysis, brand: string): { warnings: string[]; severeWarnings: string[]; cssLines: number } {
  const warnings: string[] = [];
  const severeWarnings: string[] = [];
  const css = (analysis.improvedCss || "").toString();
  const cssLines = css.split("\n").length;

  // ── SEVERO: CSS demasiado corto (no entrega valor real al cliente) ──
  if (cssLines < 200) {
    severeWarnings.push(`CSS demasiado corto (${cssLines} líneas; mínimo 200)`);
  }

  // T004 — Lista ampliada de tokens prohibidos (ES + EN, con y sin variantes)
  const FORBIDDEN_TOKENS = [
    "lorem ipsum", "lorem-ipsum", "lorem,",
    "[placeholder]", "{placeholder}", "(placeholder)",
    "todo:", "to-do:", "to do:", "fixme", "tbd",
    "insert text here", "add content here", "add text here",
    "your text here", "your title here", "your content here", "your name here",
    "sample text", "sample content", "sample copy",
    "dummy text", "dummy content", "dummy copy",
    "example content", "example text", "example copy",
    "texto de ejemplo", "contenido de ejemplo", "texto de muestra",
    "aquí va el texto", "aquí va tu texto", "rellenar aquí", "completar aquí",
    "xxx_", "xxxxx",
  ];
  const cssLower = css.toLowerCase();
  const fragmentsBlob = (analysis.improvedHtmlFragments || []).map(f => `${f.improved}`).join("\n").toLowerCase();
  // ── SEVERO: cualquier token de placeholder rompe la entrega ──
  for (const tok of FORBIDDEN_TOKENS) {
    if (cssLower.includes(tok)) severeWarnings.push(`CSS contiene token prohibido: "${tok}"`);
    if (fragmentsBlob.includes(tok)) severeWarnings.push(`HTML contiene token prohibido: "${tok}"`);
  }
  // ── SEVERO: regex para variantes de "placeholder" / "lorem" / "TODO" sueltos ──
  const FORBIDDEN_REGEXES: Array<{ re: RegExp; label: string }> = [
    { re: /\bplaceholder\b(?!-|:|=|")/i, label: "placeholder" },
    { re: /\blorem\b/i, label: "lorem" },
    { re: /\bTODO\b(?!\s*:?\s*[A-Za-z])/, label: "TODO" },
    { re: /\bdummy\b/i, label: "dummy" },
    { re: /\bcontent goes here\b/i, label: "content goes here" },
    { re: /\bnombre del producto\b/i, label: "nombre del producto (genérico)" },
    { re: /\btitulo aqui\b/i, label: "titulo aqui" },
  ];
  // Sólo aplicamos las regex sobre fragments HTML (en CSS "placeholder" puede ser pseudo-clase válida)
  for (const { re, label } of FORBIDDEN_REGEXES) {
    if (re.test(fragmentsBlob)) severeWarnings.push(`HTML contiene patrón prohibido: ${label}`);
  }
  // T004 — Validación CSS más estricta:
  // Rechazamos placeholder usado fuera de la pseudo-clase ::placeholder o
  // de la propiedad placeholder-shown. También cazamos comentarios con TODO/FIXME
  // y selectores genéricos (que delatan plantilla LLM sin esfuerzo).
  // Quitamos ::placeholder y :placeholder-shown del CSS antes de buscar
  // el token suelto "placeholder" para evitar falsos positivos legítimos.
  const cssSinPseudo = css
    .replace(/::placeholder\b/gi, "::__valid_pseudo__")
    .replace(/:placeholder-shown\b/gi, ":__valid_pseudo__")
    .replace(/\bplaceholder-shown\b/gi, "__valid_pseudo__");
  if (/\bplaceholder\b/i.test(cssSinPseudo)) {
    severeWarnings.push(`CSS contiene "placeholder" fuera de ::placeholder/:placeholder-shown`);
  }
  if (/\blorem\b/i.test(cssLower)) {
    severeWarnings.push(`CSS contiene patrón prohibido (lorem)`);
  }
  // Comentarios CSS con TODO/FIXME/PLACEHOLDER → severe (no entregamos código a medio terminar)
  const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
  const cssComments = (css.match(CSS_COMMENT_RE) || []).join(" ");
  if (/\b(TODO|FIXME|TBD|XXX|HACK|PLACEHOLDER)\b/i.test(cssComments)) {
    severeWarnings.push("CSS contiene comentarios TODO/FIXME/TBD/HACK/PLACEHOLDER");
  }

  // SEVERO: Selectores genéricos que delatan respuesta plantilla del LLM.
  // Antes era un warning suave; el session plan T004 pide rechazo explícito de
  // "clases genéricas" → ascendido a severeWarnings.
  const GENERIC_SELECTORS = [/\.class1\b/, /\.div1\b/, /\.section1\b/, /\.div\d+\b/, /\.untitled\b/, /\.foo\b/, /\.bar\b/];
  for (const re of GENERIC_SELECTORS) {
    if (re.test(css)) severeWarnings.push(`CSS usa selector genérico prohibido: ${re.source}`);
  }

  // INFO: Fragmentos donde improved === original — el modelo no mejoró
  const lazyFragments = (analysis.improvedHtmlFragments || []).filter(f =>
    f.improved && f.original && f.improved.trim() === f.original.trim()
  );
  if (lazyFragments.length > 0) {
    warnings.push(`${lazyFragments.length} fragmento(s) HTML idénticos al original`);
  }

  // INFO: Ausencia total de variables CSS de marca
  if (!/--brand-/i.test(css) && !/--color-/i.test(css)) {
    warnings.push("CSS no define variables de marca (--brand-* / --color-*)");
  }

  // Mención mínima de la marca en el CSS o fragments (señal débil de uniqueness)
  if (brand && brand.length > 2) {
    const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (brandSlug.length > 2 && !cssLower.includes(brandSlug) && !fragmentsBlob.includes(brandSlug)) {
      // Esto es sólo una señal; no siempre es problema (algunas marcas no aparecen como clase)
      // pero ayuda a auditar.
    }
  }

  // Los warnings retornados incluyen también los severos (compatibilidad con código previo)
  return { warnings: [...severeWarnings, ...warnings], severeWarnings, cssLines };
}

// ─────────────────────────────────────────────────────────────
// T003 — Iteración: refinar el diseño ya generado con un cambio
// pedido en lenguaje natural. Toma el CSS y los fragments
// "improved" como punto de partida y genera una nueva versión.
// ─────────────────────────────────────────────────────────────
const WEB_DESIGN_ITERATE_SYSTEM = `Eres un experto en diseño web. Recibes un CSS y unos fragmentos HTML que YA generaste anteriormente para una marca,
junto con una petición concreta de cambio del cliente. Tu trabajo es producir una NUEVA versión del CSS y de los fragmentos
aplicando ese cambio sin romper el resto.

REGLAS:
- Mantén las variables CSS de marca y la coherencia visual del diseño actual
- Aplica el cambio pedido de forma visible y concreta
- Devuelve el CSS COMPLETO (no parches), listo para reemplazar el anterior — mínimo 200 líneas
- Devuelve los fragmentos HTML COMPLETOS, no diffs
- Prohibido: lorem ipsum, placeholder, TODO, FIXME, clases genéricas .class1/.div1, repetir literalmente la versión anterior sin aplicar el cambio
- Si el cambio pedido es ambiguo, interprétalo razonablemente y explica en "summary" qué decisiones tomaste
- NO inventes secciones que no existían; si el cliente pide algo nuevo, añade un fragmento extra coherente

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "improvedCss": "/* CSS COMPLETO actualizado */",
  "improvedHtmlFragments": [{ "section": "nombre", "original": "<código previo>", "improved": "<código nuevo>" }],
  "summary": "Qué cambios aplicaste y por qué, en español"
}`;

router.post("/web-lab/iterate", async (req: Request, res: Response): Promise<void> => {
  try {
    // brandContext es el nombre canónico documentado en el session plan;
    // brandName se mantiene como alias retro-compatible.
    const { projectId, url, previousCss, previousFragments, changeRequest, brandContext, brandName } = req.body as {
      projectId?: number;
      url?: string;
      previousCss?: string;
      previousFragments?: Array<{ section: string; original: string; improved: string }>;
      changeRequest?: string;
      brandContext?: string;
      brandName?: string;
    };
    const effectiveBrand = (brandContext ?? brandName ?? "").toString();

    if (!changeRequest || !changeRequest.trim()) {
      res.status(400).json({ error: "Falta el cambio a aplicar (changeRequest)" });
      return;
    }
    if (changeRequest.length > 4_000) {
      res.status(400).json({ error: "El cambio pedido es demasiado largo (máx 4000 caracteres)" });
      return;
    }
    if (!previousCss || previousCss.length < 50) {
      res.status(400).json({ error: "Falta el CSS previo (previousCss)" });
      return;
    }
    if (previousCss.length > 200_000) {
      res.status(400).json({ error: "El CSS previo es demasiado grande (máx 200KB)" });
      return;
    }
    if (previousFragments && Array.isArray(previousFragments) && previousFragments.length > 50) {
      res.status(400).json({ error: "Demasiados fragmentos previos (máx 50)" });
      return;
    }

    const pid = projectId ?? 0;
    const brand = effectiveBrand.trim() || (url ? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "");

    // T003 — Comprobación de créditos ANTES de flushHeaders.
    // Una iteración consume el equivalente a una llamada Claude pesada → 1 crédito de tipo "image".
    // Si el proyecto no tiene saldo, devolvemos 402 real con detalle del plan.
    if (pid > 0) {
      try {
        const limit = await checkProductionLimit(pid, "image", 1);
        if (!limit.allowed) {
          res.status(402).json({
            error: limit.reason || "Sin créditos suficientes para iterar el diseño.",
            planLimit: true,
            planLabel: limit.planLabel,
            remaining: limit.remaining,
          });
          return;
        }
      } catch (limitErr) {
        logger.warn({ err: limitErr, pid }, "Web Lab iterate — checkProductionLimit failed (continuando sin bloquear)");
      }
    }

    res.status(200);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    enableLongRunning(res);
    if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
      (res as unknown as { flushHeaders: () => void }).flushHeaders();
    }

    // Recortamos lo que enviamos al modelo para no explotar el contexto
    const cssTrim = previousCss.length > 60_000
      ? `${previousCss.slice(0, 40_000)}\n/* …CSS previo recortado… */\n${previousCss.slice(-15_000)}`
      : previousCss;
    const fragsTrim = (previousFragments || [])
      .slice(0, 12)
      .map(f => `=== ${f.section} ===\n--- ORIGINAL ---\n${(f.original || "").slice(0, 4_000)}\n--- IMPROVED PREVIO ---\n${(f.improved || "").slice(0, 4_000)}`)
      .join("\n\n");

    const userPrompt = `MARCA: ${brand || "(no especificada)"}
URL DE REFERENCIA: ${url || "(n/a)"}

CAMBIO QUE PIDE EL CLIENTE:
"${changeRequest.trim()}"

CSS PREVIO (versión que estamos iterando):
${cssTrim}

FRAGMENTOS HTML PREVIOS:
${fragsTrim || "(sin fragmentos previos)"}

Devuelve la nueva versión completa con el cambio aplicado en JSON válido según el contrato del system prompt.`;

    type IterateResult = {
      improvedCss: string;
      improvedHtmlFragments: Array<{ section: string; original: string; improved: string }>;
      summary: string;
    };

    const result = await askClaudeJsonWithBrain<IterateResult>(
      pid, userPrompt, WEB_DESIGN_ITERATE_SYSTEM, "general", undefined, 12000, 240_000
    );

    if (!result.improvedCss || result.improvedCss.length < 100) {
      res.end(JSON.stringify({ error: "La iteración no devolvió un CSS válido. Inténtalo con una petición más concreta." }));
      return;
    }
    if (!Array.isArray(result.improvedHtmlFragments)) {
      result.improvedHtmlFragments = previousFragments || [];
    }

    // Audit calidad de la iteración (mismo criterio severo que en /analyze)
    const audit = auditWebLabAnalysis(
      { ...({} as WebLabAnalysis), improvedCss: result.improvedCss, improvedHtmlFragments: result.improvedHtmlFragments } as WebLabAnalysis,
      brand,
    );
    if (audit.warnings.length > 0) {
      logger.warn({ url, brand, warnings: audit.warnings, severe: audit.severeWarnings, cssLines: audit.cssLines }, "⚠ Web Lab iterate — avisos de calidad");
    }
    if (audit.severeWarnings.length > 0) {
      logger.error({ url, brand, severe: audit.severeWarnings, cssLines: audit.cssLines }, "✗ Web Lab iterate — iteración rechazada por calidad insuficiente");
      res.end(JSON.stringify({
        error: "La iteración no cumple los mínimos de calidad. Concreta más el cambio o vuelve a intentarlo.",
        details: audit.severeWarnings,
      }));
      return;
    }

    // Guarda nueva versión en el vault si hay proyecto
    if (pid > 0) {
      try {
        await Promise.all([
          saveToVault({
            projectId: pid,
            fileType: "web-lab-css",
            category: "web-lab",
            title: `CSS iterado — ${brand || url || "Lab Web"}`,
            description: `Iteración: ${changeRequest.trim().slice(0, 140)}`,
            originalUrl: url || "",
            mimeType: "text/css",
            generatedBy: "web-lab-iterate",
            content: result.improvedCss,
            metadata: { url, brand, changeRequest, iteratedAt: new Date().toISOString(), tags: ["web-lab", "iteration", brand].filter(Boolean) },
          }),
          saveToVault({
            projectId: pid,
            fileType: "web-lab-html",
            category: "web-lab",
            title: `HTML iterado — ${brand || url || "Lab Web"}`,
            description: `Iteración: ${changeRequest.trim().slice(0, 140)}`,
            originalUrl: url || "",
            mimeType: "text/html",
            generatedBy: "web-lab-iterate",
            content: (result.improvedHtmlFragments || []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
            metadata: { url, brand, changeRequest, iteratedAt: new Date().toISOString(), tags: ["web-lab", "iteration", brand].filter(Boolean) },
          }),
        ]);
      } catch (e) {
        logger.warn({ err: e }, "Web Lab iterate — vault save failed");
      }

      learnFromOperation({
        operationType: "web_lab_iteration",
        title: `Iteración Lab Web — ${brand || url}`,
        content: `Cambio pedido: "${changeRequest.trim()}". Resumen del modelo: ${result.summary}. Avisos: ${audit.warnings.join("; ") || "ninguno"}.`,
        confidence: audit.warnings.length === 0 ? 0.85 : 0.6,
        tags: ["web-lab", "iteration", brand || ""].filter(Boolean),
      });

      // BUG FIX (auditoría): consumimos el crédito SOLO si la iteración terminó OK
      // (audit pasó, vault guardado). Antes el endpoint validaba límite con
      // checkProductionLimit pero nunca llamaba a recordUsage → cliente con
      // saldo iteraba gratis. Tipo "image" para alinear con la validación previa.
      try {
        await recordUsage(pid, "image", 1);
      } catch (usageErr) {
        logger.warn({ err: usageErr, pid }, "Web Lab iterate — recordUsage failed (no bloquea respuesta)");
      }
    }

    res.end(JSON.stringify({
      success: true,
      improvedCss: result.improvedCss,
      improvedHtmlFragments: result.improvedHtmlFragments,
      summary: result.summary || `Cambios aplicados: ${changeRequest.trim()}`,
      audit: { cssLines: audit.cssLines, warnings: audit.warnings },
    }));
  } catch (err: any) {
    logger.error({ err }, "Web Lab iterate failed");
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Error en la iteración" });
    } else {
      try { res.end(JSON.stringify({ error: err.message || "Error en la iteración" })); } catch {}
    }
  }
});

export async function runWebLabAnalysis(url: string, projectId: number, template?: ReportTemplate): Promise<{
  analysis: WebLabAnalysis;
  vaultIds: { report: number | null; css: number | null; html: number | null };
}> {
  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  const [extraction, pageSpeed, pageSpeedDesktop, scraperData] = await Promise.all([
    extractFullWebContent(normalizedUrl),
    runPageSpeedAudit(normalizedUrl, "mobile").catch(() => null),
    runPageSpeedAudit(normalizedUrl, "desktop").catch(() => null),
    scrapeWebsite(normalizedUrl).catch(() => null),
  ]);

  let projectName = "Análisis externo";
  if (projectId) {
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (proj) projectName = proj.name ?? projectName;
  }

  const htmlForClaude = extraction.html.length > 40_000
    ? `${extraction.html.slice(0, 25_000)}\n<!-- ...CONTENT TRIMMED FOR ANALYSIS... -->\n${extraction.html.slice(-15_000)}`
    : extraction.html;
  const cssForClaude = extraction.css.length > 30_000
    ? `${extraction.css.slice(0, 20_000)}\n/* ...CSS TRIMMED FOR ANALYSIS... */\n${extraction.css.slice(-10_000)}`
    : extraction.css;

  let contextParts: string[] = [];
  contextParts.push(`URL ANALIZADA: ${url}`);
  contextParts.push(`\n--- HTML REAL (${htmlForClaude.length} chars) ---\n${htmlForClaude}`);
  contextParts.push(`\n${formatDesignSignals(extraction.designSignals)}`);
  contextParts.push(`\n--- CSS REAL (${extraction.stylesheetUrls.length} archivos, ${cssForClaude.length} chars) ---\n${cssForClaude}`);

  if (pageSpeed) {
    contextParts.push(`\n--- PAGESPEED MOBILE ---\nPerformance: ${pageSpeed.performanceScore}/100 | SEO: ${pageSpeed.seoScore}/100 | Accessibility: ${pageSpeed.accessibilityScore}/100`);
  }
  if (pageSpeedDesktop) {
    contextParts.push(`\n--- PAGESPEED DESKTOP ---\nPerformance: ${pageSpeedDesktop.performanceScore}/100 | SEO: ${pageSpeedDesktop.seoScore}/100 | Accessibility: ${pageSpeedDesktop.accessibilityScore}/100`);
  }
  if (scraperData) {
    contextParts.push(`\n--- SCRAPER ---\nTitle: ${scraperData.title}\nH1s: ${scraperData.headings?.h1?.join(", ")}\nImages: ${scraperData.images?.total}`);
  }

  const userPrompt = `Analiza en profundidad esta página web. Tienes el HTML y CSS REALES.\n\n${contextParts.join("\n")}`;

  const analysis = await askClaudeJsonWithBrain<WebLabAnalysis>(
    projectId, userPrompt, WEB_DESIGN_SYSTEM, "general", undefined, 16000, 300_000
  );

  if (!analysis.improvedCss) analysis.improvedCss = "/* No se generaron mejoras CSS */";
  if (!analysis.issues) analysis.issues = [];
  if (!analysis.categories) {
    analysis.categories = { design: 50, ux: 50, responsive: 50, accessibility: 50, performance: 50, consistency: 50 };
  }
  if (!analysis.overallScore) {
    const cats = analysis.categories;
    analysis.overallScore = Math.round((cats.design + cats.ux + cats.responsive + cats.accessibility + cats.performance + cats.consistency) / 6);
  }

  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const tpl: ReportTemplate = (template && VALID_TEMPLATES.has(template)) ? template : "prestige";
  const reportBody = buildReportBody(analysis, url, pageSpeed, pageSpeedDesktop, scraperData);
  const reportHtml = getReportShell(tpl)(
    "Lab Web — Análisis de Diseño",
    `${projectName} — ${url}`,
    reportBody,
    date,
    projectName
  );

  const tags = [url, "web-lab", "diseño", `score-${analysis.overallScore}`];
  const [vaultReportId, vaultCssId, vaultHtmlId] = await Promise.all([
    saveToVault({
      projectId,
      fileType: "web-lab-report",
      category: "web-lab",
      title: `Lab Web — ${url}`,
      description: analysis.summary,
      originalUrl: url,
      mimeType: "text/html",
      generatedBy: "web-lab",
      content: reportHtml,
      metadata: { url, score: analysis.overallScore, categories: analysis.categories, template: tpl, tags, analysis: JSON.stringify(analysis) },
    }),
    saveToVault({
      projectId,
      fileType: "web-lab-css",
      category: "web-lab",
      title: `CSS Mejorado — ${url}`,
      description: `CSS profesional mejorado — Score: ${analysis.overallScore}/100`,
      originalUrl: url,
      mimeType: "text/css",
      generatedBy: "web-lab",
      content: analysis.improvedCss,
      metadata: { url, score: analysis.overallScore, tags },
    }),
    saveToVault({
      projectId,
      fileType: "web-lab-html",
      category: "web-lab",
      title: `HTML Mejorado — ${url}`,
      description: `Fragmentos HTML mejorados`,
      originalUrl: url,
      mimeType: "text/html",
      generatedBy: "web-lab",
      content: (analysis.improvedHtmlFragments ?? []).map(f => `<!-- ${f.section} -->\n${f.improved}`).join("\n\n"),
      metadata: { url, score: analysis.overallScore, tags },
    }),
  ]);

  learnFromOperation({
    operationType: "web_lab_design_analysis",
    title: `Análisis diseño web: ${url} — Score ${analysis.overallScore}/100`,
    content: `Score: ${analysis.overallScore}/100. Categorías: Diseño ${analysis.categories.design}, UX ${analysis.categories.ux}, Responsive ${analysis.categories.responsive}, Accesibilidad ${analysis.categories.accessibility}, Performance ${analysis.categories.performance}, Consistencia ${analysis.categories.consistency}. Issues: ${analysis.issues.length}. ${analysis.summary}`,
    confidence: 0.85,
    tags: ["web-lab", "design-analysis", url],
  });

  learnFromOperation({
    operationType: "web_lab_css_patterns",
    title: `Patrones CSS detectados en ${url}`,
    content: `Paleta actual: ${analysis.colorPalette?.current?.join(", ")}. Paleta mejorada: ${analysis.colorPalette?.improved?.join(", ")}. Tipografía actual: ${analysis.typography?.current?.join(", ")}. Recomendada: ${analysis.typography?.improved?.join(", ")}. Issues CSS principales: ${analysis.issues.slice(0, 5).map(i => `${i.selector} → ${i.property}: ${i.current} → ${i.improved}`).join("; ")}`,
    confidence: 0.8,
    tags: ["web-lab", "css-patterns", "design-tokens"],
  });

  learnFromOperation({
    operationType: "web_lab_ux_insights",
    title: `UX/Accesibilidad insights: ${url}`,
    content: `UX Score: ${analysis.categories.ux}/100. Accesibilidad: ${analysis.categories.accessibility}/100. Responsive: ${analysis.categories.responsive}/100. Issues UX/a11y: ${analysis.issues.filter(i => ["accessibility", "ux", "responsive"].some(k => i.property?.toLowerCase().includes(k) || i.selector?.toLowerCase().includes(k))).length}. Resumen: ${analysis.summary}`,
    confidence: 0.8,
    tags: ["web-lab", "ux-insights", "accessibility"],
  });

  return {
    analysis,
    vaultIds: { report: vaultReportId, css: vaultCssId, html: vaultHtmlId },
  };
}

function buildStandalonePreviewHtml(htmlFragments: string, cssContent: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Visual — ${escapeHtml(url)}</title>
  <style>
${cssContent}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

.shopy-preview-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%);
  border-top: 2px solid #d4a843;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #ccc;
  font-size: 12px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
}
.shopy-preview-toolbar a {
  color: #d4a843;
  text-decoration: none;
  font-weight: 600;
}
.shopy-preview-toolbar .shopy-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}
.shopy-preview-toolbar .shopy-badge span {
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, #d4a843, #b8860b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@media (max-width: 480px) {
  .shopy-preview-toolbar {
    flex-direction: column;
    gap: 6px;
    text-align: center;
    padding: 8px 12px;
  }
}
  </style>
</head>
<body>
${htmlFragments}
<div class="shopy-preview-toolbar">
  <div class="shopy-badge">
    <span>Shopy Crafter</span>
    <span style="font-size:11px;font-weight:400;color:#888;">Preview Visual — CSS Mejorado</span>
  </div>
  <div>
    <span style="color:#888;">Fuente: ${escapeHtml(url)}</span>
    &nbsp;·&nbsp;
    <a href="https://shopycrafter.com" target="_blank">shopycrafter.com</a>
  </div>
</div>
</body>
</html>`;
}

function buildReportBody(
  analysis: WebLabAnalysis,
  url: string,
  pageSpeedMobile: any,
  pageSpeedDesktop: any,
  scraperData: any,
): string {
  const cats = analysis.categories;
  const scoreColor = (s: number) => s >= 80 ? "#22c55e" : s >= 60 ? "#eab308" : s >= 40 ? "#f97316" : "#ef4444";

  let html = `
<div class="ai-deliverable">
  <h2 style="text-align:center;margin-bottom:8px;">Análisis de Diseño Web</h2>
  <p style="text-align:center;color:#888;margin-bottom:32px;">${escapeHtml(url)}</p>

  <div style="text-align:center;margin-bottom:40px;">
    <div style="display:inline-block;width:140px;height:140px;border-radius:50%;border:6px solid ${scoreColor(analysis.overallScore)};position:relative;">
      <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:42px;font-weight:800;color:${scoreColor(analysis.overallScore)};">${analysis.overallScore}</span>
    </div>
    <p style="margin-top:12px;font-size:14px;color:#aaa;">Score General /100</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:40px;">
    ${Object.entries(cats).map(([key, val]) => {
      const labels: Record<string, string> = { design: "Diseño", ux: "UX", responsive: "Responsive", accessibility: "Accesibilidad", performance: "Performance", consistency: "Consistencia" };
      return `<div style="background:#1a1a2e;padding:16px;border-radius:12px;text-align:center;border:1px solid ${scoreColor(val as number)}33;">
        <div style="font-size:28px;font-weight:700;color:${scoreColor(val as number)};">${val}</div>
        <div style="font-size:12px;color:#aaa;margin-top:4px;">${labels[key] || key}</div>
      </div>`;
    }).join("")}
  </div>

  <h3 style="margin-bottom:12px;">📋 Resumen Ejecutivo</h3>
  <p style="color:#ccc;line-height:1.7;margin-bottom:32px;">${escapeHtml(analysis.summary || "")}</p>`;

  if (analysis.colorPalette) {
    html += `
  <h3 style="margin-bottom:12px;">🎨 Paleta de Colores</h3>
  <div style="display:flex;gap:24px;margin-bottom:32px;">
    <div>
      <p style="font-size:12px;color:#888;margin-bottom:8px;">Actual</p>
      <div style="display:flex;gap:4px;">${(analysis.colorPalette.current || []).map(c => { const sc = escapeHtml(c); return `<div style="width:40px;height:40px;border-radius:8px;background:${sc};border:1px solid #333;" title="${sc}"></div>`; }).join("")}</div>
    </div>
    <div>
      <p style="font-size:12px;color:#888;margin-bottom:8px;">Mejorada</p>
      <div style="display:flex;gap:4px;">${(analysis.colorPalette.improved || []).map(c => { const sc = escapeHtml(c); return `<div style="width:40px;height:40px;border-radius:8px;background:${sc};border:1px solid #333;" title="${sc}"></div>`; }).join("")}</div>
    </div>
  </div>`;
  }

  if (analysis.typography) {
    html += `
  <h3 style="margin-bottom:12px;">🔤 Tipografía</h3>
  <div style="display:flex;gap:24px;margin-bottom:32px;">
    <div><p style="font-size:12px;color:#888;">Actual:</p><p style="color:#ccc;">${escapeHtml((analysis.typography.current || []).join(", "))}</p></div>
    <div><p style="font-size:12px;color:#888;">Recomendada:</p><p style="color:#ccc;">${escapeHtml((analysis.typography.improved || []).join(", "))}</p></div>
  </div>`;
  }

  if (analysis.issues?.length > 0) {
    const sevColors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };
    html += `
  <h3 style="margin-bottom:12px;">⚠️ Problemas Detectados (${analysis.issues.length})</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;font-size:13px;">
    <thead><tr style="border-bottom:1px solid #333;">
      <th style="text-align:left;padding:8px;color:#888;">Severidad</th>
      <th style="text-align:left;padding:8px;color:#888;">Selector</th>
      <th style="text-align:left;padding:8px;color:#888;">Propiedad</th>
      <th style="text-align:left;padding:8px;color:#888;">Actual</th>
      <th style="text-align:left;padding:8px;color:#888;">Mejorado</th>
    </tr></thead>
    <tbody>${analysis.issues.map(i => `<tr style="border-bottom:1px solid #222;">
      <td style="padding:8px;"><span style="background:${sevColors[i.severity] || "#888"}22;color:${sevColors[i.severity] || "#888"};padding:2px 8px;border-radius:4px;font-size:11px;">${escapeHtml(i.severity)}</span></td>
      <td style="padding:8px;font-family:monospace;font-size:12px;color:#e0e0e0;">${escapeHtml(i.selector)}</td>
      <td style="padding:8px;color:#ccc;">${escapeHtml(i.property)}</td>
      <td style="padding:8px;font-family:monospace;color:#f87171;">${escapeHtml(i.current)}</td>
      <td style="padding:8px;font-family:monospace;color:#4ade80;">${escapeHtml(i.improved)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
  }

  if (analysis.improvedCss) {
    html += `
  <h3 style="margin-bottom:12px;">💻 CSS Mejorado (Listo para Producción)</h3>
  <p style="font-size:12px;color:#888;margin-bottom:8px;">Copia este código y pégalo en tu archivo de estilos. Compatible con Shopify, WooCommerce y cualquier CMS.</p>
  <pre style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;overflow-x:auto;font-size:12px;line-height:1.6;color:#c9d1d9;max-height:600px;overflow-y:auto;"><code>${escapeHtml(analysis.improvedCss)}</code></pre>`;
  }

  if (analysis.improvedHtmlFragments?.length > 0) {
    html += `
  <h3 style="margin-top:32px;margin-bottom:12px;">🏗️ Fragmentos HTML Mejorados</h3>`;
    for (const frag of analysis.improvedHtmlFragments) {
      html += `
  <div style="margin-bottom:24px;">
    <h4 style="color:#eab308;margin-bottom:8px;">📌 ${escapeHtml(frag.section)}</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <p style="font-size:11px;color:#ef4444;margin-bottom:4px;">❌ Original</p>
        <pre style="background:#1a0000;border:1px solid #4a1111;border-radius:6px;padding:12px;font-size:11px;overflow-x:auto;color:#fca5a5;max-height:300px;overflow-y:auto;"><code>${escapeHtml(frag.original)}</code></pre>
      </div>
      <div>
        <p style="font-size:11px;color:#22c55e;margin-bottom:4px;">✅ Mejorado</p>
        <pre style="background:#001a00;border:1px solid #114a11;border-radius:6px;padding:12px;font-size:11px;overflow-x:auto;color:#86efac;max-height:300px;overflow-y:auto;"><code>${escapeHtml(frag.improved)}</code></pre>
      </div>
    </div>
  </div>`;
    }
  }

  if (pageSpeedMobile) {
    html += `
  <h3 style="margin-top:32px;margin-bottom:12px;">⚡ PageSpeed Insights</h3>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.performanceScore)};">${pageSpeedMobile.performanceScore}</div>
      <div style="font-size:11px;color:#888;">Performance</div>
    </div>
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.seoScore)};">${pageSpeedMobile.seoScore}</div>
      <div style="font-size:11px;color:#888;">SEO</div>
    </div>
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.accessibilityScore)};">${pageSpeedMobile.accessibilityScore}</div>
      <div style="font-size:11px;color:#888;">Accesibilidad</div>
    </div>
    <div style="background:#1a1a2e;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${scoreColor(pageSpeedMobile.bestPracticesScore)};">${pageSpeedMobile.bestPracticesScore}</div>
      <div style="font-size:11px;color:#888;">Best Practices</div>
    </div>
  </div>`;
  }

  html += `
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #333;text-align:center;">
    <p style="font-size:11px;color:#666;">Generado por Shopy Crafter — Lab Web</p>
    <p style="font-size:11px;color:#555;">shopycrafter.com</p>
  </div>
</div>`;

  return html;
}

function escapeHtml(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Manual edit save: persist user-edited HTML/CSS as a NEW vault version ──
// El frontend pasa html y css editados; los guardamos como nueva entrada con
// fileType "web-lab-edited-html" / "web-lab-edited-css", referenciando la URL
// original. Permite descargar y versionar libremente sin perder el original.
router.post("/web-lab/save-edit", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, url, html, css, label, parentVaultId } = req.body as {
      projectId: number;
      url?: string;
      html?: string;
      css?: string;
      label?: string;
      parentVaultId?: number;
    };
    if (projectId === undefined || projectId === null || (!html && !css)) {
      res.status(400).json({ error: "projectId y al menos html o css son requeridos" });
      return;
    }

    const ts = new Date().toISOString();
    const labelTxt = label?.trim() || `Edición ${new Date().toLocaleString("es-ES")}`;
    const ids: { htmlId?: number; cssId?: number } = {};

    // OJO: NO pasamos `originalUrl` porque el endpoint de descarga del vault
    // intentaría re-fetchar esa URL en vez de servir nuestro `content` editado.
    // La URL queda referenciada en metadata para trazabilidad.
    if (html && html.trim()) {
      const id = await saveToVault({
        projectId,
        fileType: "web-lab-edited-html",
        category: "web-lab",
        title: `${labelTxt} — HTML${url ? ` (${url})` : ""}`,
        description: `Edición manual de HTML${url ? ` para ${url}` : ""}.`,
        mimeType: "text/html",
        generatedBy: "web-lab-edit",
        content: html,
        metadata: { url, parentVaultId, editedAt: ts, label: labelTxt, kind: "html" },
      });
      if (id) ids.htmlId = id;
    }
    if (css && css.trim()) {
      const id = await saveToVault({
        projectId,
        fileType: "web-lab-edited-css",
        category: "web-lab",
        title: `${labelTxt} — CSS${url ? ` (${url})` : ""}`,
        description: `Edición manual de CSS${url ? ` para ${url}` : ""}.`,
        mimeType: "text/css",
        generatedBy: "web-lab-edit",
        content: css,
        metadata: { url, parentVaultId, editedAt: ts, label: labelTxt, kind: "css" },
      });
      if (id) ids.cssId = id;
    }

    res.json({ ok: true, ...ids });
  } catch (err: any) {
    logger.error({ err: err?.message }, "POST /web-lab/save-edit failed");
    res.status(500).json({ error: err?.message || "Save failed" });
  }
});

// ─── Generate from scratch: usa ADN visual de la tienda para generar una
//     página web profesional de cero (sin URL existente). Devuelve html+css
//     editables y los guarda en vault.
router.post("/web-lab/generate-from-scratch", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, pageType, brief, sections, language } = req.body as {
      projectId: number;
      pageType?: "landing" | "about" | "product" | "contact" | "blog" | "pricing";
      brief?: string;
      sections?: string[];
      language?: string;
    };
    if (projectId === undefined || projectId === null) { res.status(400).json({ error: "projectId requerido" }); return; }

    // Comprobación de créditos ANTES de flushHeaders.
    // Generar una página completa desde cero consume 1 crédito tipo "image"
    // (mismo coste que iterate, ya que es una llamada Claude pesada de hasta 16K tokens).
    if (projectId > 0) {
      try {
        const limit = await checkProductionLimit(projectId, "image", 1);
        if (!limit.allowed) {
          res.status(402).json({
            error: limit.reason || "Sin créditos suficientes para generar una página desde cero.",
            planLimit: true,
            planLabel: limit.planLabel,
            remaining: limit.remaining,
          });
          return;
        }
      } catch (limitErr) {
        logger.warn({ err: limitErr, projectId }, "Web Lab from-scratch — checkProductionLimit failed (continuando sin bloquear)");
      }
    }

    res.status(200);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    enableLongRunning(res);
    if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
      (res as unknown as { flushHeaders: () => void }).flushHeaders();
    }

    const [proj] = projectId > 0
      ? await db.select().from(projectsTable).where(eq(projectsTable.id, projectId))
      : [{ id: 0, name: brief ? "Mi Marca" : "Standalone", storeNiche: null, targetAudience: null, shopDomain: null, accessToken: null, clientId: null } as any];
    if (!proj) { res.end(JSON.stringify({ error: "Proyecto no encontrado" })); return; }

    const { fetchBrandProfile, generateBrandCss, buildBrandDnaContext } = await import("../lib/brand-css-generator.js");
    const brandProfile = projectId > 0 ? await fetchBrandProfile(projectId).catch(() => null) : null;
    const brandCss = brandProfile ? generateBrandCss(brandProfile) : "";
    const brandContext = brandProfile ? buildBrandDnaContext(brandProfile) : "Sin ADN de marca registrado. Usa un estilo moderno, minimalista y profesional.";

    const lang = language || "es";
    const type = pageType || "landing";
    const sectionList = (sections && sections.length ? sections : ["hero", "features", "social-proof", "pricing", "cta", "footer"]).join(", ");

    const sysPrompt = `Eres un director de arte web senior especializado en diseño de marca. Generas páginas HTML+CSS profesionales que parecen hechas a medida por un estudio premium. Nunca producción genérica, nunca Lorem ipsum, siempre lenguaje en ${lang}.`;
    const userPrompt = `Diseña una página "${type}" para la marca "${proj.name}" con secciones: ${sectionList}.

ADN de marca (úsalo literalmente para colores, tipografías, voz):
${brandContext}

${brief ? `Brief adicional del usuario:\n"""${brief.slice(0, 2000)}"""\n` : ""}

Devuelve JSON ESTRICTO:
{
  "html": "<!DOCTYPE html>...</html>  (página entera, semántica, en ${lang}, copy real para ${proj.name})",
  "css": "/* CSS completo profesional, mínimo 250 líneas, custom properties con paleta REAL de la marca, responsive 480/768/1024, hover/focus states, transitions */",
  "summary": "1-2 frases describiendo el diseño"
}

REGLAS DURAS:
- Cero placeholder, cero Lorem ipsum.
- Copy en ${lang}, contextual a "${proj.name}" y su sector.
- CSS plano profesional (NO Tailwind), con tokens :root.
- Imágenes: usa <img> con src "https://images.unsplash.com/photo-..." reales o placeholders descritos en alt.
- Footer con datos plausibles ${proj.name ? `de ${proj.name}` : ""}.`;

    // 32K tokens output: una página HTML+CSS profesional necesita ~20-25K tokens
    // (HTML ~5K + CSS ~250 líneas + summary). Con 16K se truncaba el JSON.
    const result = await askClaudeJsonWithBrain<{ html: string; css: string; summary: string }>(
      projectId, userPrompt, sysPrompt, "general", undefined, 32000, 420_000,
    );

    if (!result.html || !result.css) {
      res.end(JSON.stringify({ error: "El generador devolvió HTML/CSS vacío" }));
      return;
    }

    // Si la marca tiene CSS de tokens base, lo prependemos para reforzar identidad visual.
    const finalCss = brandCss ? `/* === BRAND TOKENS === */\n${brandCss}\n\n/* === PAGE === */\n${result.css}` : result.css;

    const tags = [proj.name || "marca", "web-lab", "from-scratch", type];
    const [htmlId, cssId] = await Promise.all([
      saveToVault({
        projectId,
        fileType: "web-lab-generated-html",
        category: "web-lab",
        title: `Página ${type} — ${proj.name}`,
        description: result.summary || `Página ${type} generada desde cero para ${proj.name}.`,
        mimeType: "text/html",
        generatedBy: "web-lab-from-scratch",
        content: result.html,
        metadata: { pageType: type, sections, tags, summary: result.summary },
      }),
      saveToVault({
        projectId,
        fileType: "web-lab-generated-css",
        category: "web-lab",
        title: `CSS página ${type} — ${proj.name}`,
        description: `CSS profesional página ${type} para ${proj.name}.`,
        mimeType: "text/css",
        generatedBy: "web-lab-from-scratch",
        content: finalCss,
        metadata: { pageType: type, sections, tags },
      }),
    ]);

    // Registramos consumo (1 crédito de tipo "image", coherente con iterate).
    if (projectId > 0) {
      try {
        await recordUsage(projectId, "image", 1);
      } catch (usageErr) {
        logger.warn({ err: usageErr, projectId }, "Web Lab from-scratch — recordUsage failed (no bloquea respuesta)");
      }
    }

    res.end(JSON.stringify({
      ok: true,
      html: result.html,
      css: finalCss,
      summary: result.summary,
      vaultIds: { htmlId, cssId },
    }));
  } catch (err: any) {
    logger.error({ err: err?.message }, "POST /web-lab/generate-from-scratch failed");
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || "Generation failed" });
    } else {
      res.end(JSON.stringify({ error: err?.message || "Generation failed" }));
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// DEEP SCAN — Security, DOM, JS, SEO, Accessibility (no AI, fast)
// ═══════════════════════════════════════════════════════════════

interface ExposedSecret {
  type: string;
  service: string;
  severity: "critical" | "high" | "medium";
  masked: string;
  raw: string;
  context: string;
  recommendation: string;
  lineNumber: number;
}

interface DeepScanResult {
  url: string;
  scannedAt: string;
  security: {
    score: number;
    headers: Array<{ name: string; present: boolean; value?: string; severity: "critical" | "high" | "medium" | "info"; description: string; recommendation: string }>;
    vulnerabilities: Array<{ type: string; severity: "critical" | "high" | "medium" | "low"; description: string; recommendation: string }>;
    https: boolean;
    mixedContent: boolean;
    serverInfo?: string;
    exposedSecrets: ExposedSecret[];
  };
  dom: {
    totalElements: number;
    maxDepth: number;
    headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
    images: { total: number; withAlt: number; withoutAlt: number; lazy: number };
    forms: number;
    inputs: number;
    links: { total: number; external: number; nofollow: number; blankTarget: number };
    scripts: { inline: number; external: number; deferred: number; asyncLoaded: number };
    iframes: number;
    tables: number;
    accessibilityIssues: Array<{ type: string; count: number; severity: "critical" | "high" | "medium" | "low"; detail: string }>;
    domSize: string;
  };
  javascript: {
    libraries: Array<{ name: string; version?: string; category: string }>;
    hasGtm: boolean;
    hasAnalytics: boolean;
    hasPixel: boolean;
    hasCookieBanner: boolean;
    hasChat: boolean;
    hasLazyLoad: boolean;
    inlineScriptCount: number;
    externalScriptCount: number;
    renderBlockingScripts: number;
  };
  seo: {
    score: number;
    title: string;
    titleLength: number;
    titleStatus: "good" | "short" | "long" | "missing";
    metaDescription: string;
    metaDescriptionLength: number;
    metaDescriptionStatus: "good" | "short" | "long" | "missing";
    h1Count: number;
    h1Status: "good" | "missing" | "multiple";
    hasCanonical: boolean;
    canonicalUrl?: string;
    metaRobots?: string;
    hasOpenGraph: boolean;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    hasTwitterCard: boolean;
    hasStructuredData: boolean;
    structuredDataTypes: string[];
    hasHreflang: boolean;
    hasViewport: boolean;
    hasCharset: boolean;
    issues: Array<{ type: string; severity: "critical" | "high" | "medium" | "low"; detail: string }>;
  };
  performance: {
    resourceCounts: { scripts: number; stylesheets: number; images: number };
    renderBlockingCss: number;
    renderBlockingJs: number;
    lazyImages: number;
    inlineCriticalCss: boolean;
    issues: Array<{ type: string; severity: "high" | "medium" | "low"; detail: string }>;
  };
}

function parseDomFromHtml(html: string): DeepScanResult["dom"] {
  const totalElements = (html.match(/<[a-zA-Z][^>]*>/g) || []).length;

  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  const h3 = (html.match(/<h3[\s>]/gi) || []).length;
  const h4 = (html.match(/<h4[\s>]/gi) || []).length;
  const h5 = (html.match(/<h5[\s>]/gi) || []).length;
  const h6 = (html.match(/<h6[\s>]/gi) || []).length;

  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imgTotal = imgTags.length;
  const imgWithAlt = imgTags.filter(t => /\balt\s*=\s*["'][^"']+["']/i.test(t)).length;
  const imgWithoutAlt = imgTags.filter(t => !/\balt\s*=/i.test(t) || /\balt\s*=\s*["']\s*["']/i.test(t)).length;
  const imgLazy = imgTags.filter(t => /loading\s*=\s*["']lazy["']/i.test(t)).length;

  const forms = (html.match(/<form[\s>]/gi) || []).length;
  const inputs = (html.match(/<input[^>]*>/gi) || []).length;

  const links = html.match(/<a\s[^>]*>/gi) || [];
  const linksTotal = links.length;
  const linksExternal = links.filter(l => /href\s*=\s*["']https?:\/\//i.test(l)).length;
  const linksNofollow = links.filter(l => /rel\s*=\s*["'][^"']*nofollow/i.test(l)).length;
  const linksBlankTarget = links.filter(l => /target\s*=\s*["']_blank["']/i.test(l)).length;

  const scriptTags = html.match(/<script[^>]*>/gi) || [];
  const scriptsInline = scriptTags.filter(t => !/\bsrc\s*=/i.test(t)).length;
  const scriptsExternal = scriptTags.filter(t => /\bsrc\s*=/i.test(t)).length;
  const scriptsDeferred = scriptTags.filter(t => /\bdefer\b/i.test(t)).length;
  const scriptsAsync = scriptTags.filter(t => /\basync\b/i.test(t)).length;

  const iframes = (html.match(/<iframe[\s>]/gi) || []).length;
  const tables = (html.match(/<table[\s>]/gi) || []).length;

  const a11yIssues: DeepScanResult["dom"]["accessibilityIssues"] = [];
  if (imgWithoutAlt > 0) a11yIssues.push({ type: "Imágenes sin alt", count: imgWithoutAlt, severity: "high", detail: `${imgWithoutAlt} imágenes carecen de atributo alt descriptivo (WCAG 1.1.1)` });
  if (!/\blang\s*=\s*["'][a-z]/i.test(html)) a11yIssues.push({ type: "Falta lang en html", count: 1, severity: "high", detail: "El elemento <html> no tiene atributo lang — lectores de pantalla no pueden identificar el idioma (WCAG 3.1.1)" });
  if (h1 === 0) a11yIssues.push({ type: "Falta H1", count: 1, severity: "high", detail: "Sin H1 la jerarquía semántica es incompleta — dificulta navegación por teclado/lector de pantalla" });
  if (linksBlankTarget > 0) {
    const withoutWarning = links.filter(l => /target\s*=\s*["']_blank["']/i.test(l) && !/rel\s*=\s*["'][^"']*(noopener|noreferrer)/i.test(l)).length;
    if (withoutWarning > 0) a11yIssues.push({ type: "Links _blank sin noopener", count: withoutWarning, severity: "medium", detail: `${withoutWarning} enlaces abren en nueva pestaña sin rel="noopener noreferrer" — riesgo de seguridad + confusión UX` });
  }
  if (forms > 0) {
    const labelsCount = (html.match(/<label[\s>]/gi) || []).length;
    if (labelsCount < inputs) a11yIssues.push({ type: "Inputs sin label", count: inputs - labelsCount, severity: "critical", detail: `${inputs} inputs detectados pero solo ${labelsCount} labels — formularios no accesibles (WCAG 1.3.1)` });
  }

  let domSizeLabel = "Óptimo";
  if (totalElements > 1500) domSizeLabel = "Grande (lento)";
  else if (totalElements > 800) domSizeLabel = "Moderado";

  const estDepth = Math.min(Math.ceil(Math.log2(totalElements + 1) * 2), 20);

  return {
    totalElements,
    maxDepth: estDepth,
    headings: { h1, h2, h3, h4, h5, h6 },
    images: { total: imgTotal, withAlt: imgWithAlt, withoutAlt: imgWithoutAlt, lazy: imgLazy },
    forms,
    inputs,
    links: { total: linksTotal, external: linksExternal, nofollow: linksNofollow, blankTarget: linksBlankTarget },
    scripts: { inline: scriptsInline, external: scriptsExternal, deferred: scriptsDeferred, asyncLoaded: scriptsAsync },
    iframes,
    tables,
    accessibilityIssues: a11yIssues,
    domSize: domSizeLabel,
  };
}

function parseJsLibraries(html: string): DeepScanResult["javascript"] {
  const KNOWN_LIBS: Array<{ name: string; pattern: RegExp; category: string; versionRe?: RegExp }> = [
    { name: "jQuery", pattern: /jquery(?:\.min)?\.js/i, category: "Framework", versionRe: /jquery[.-](\d+\.\d+\.?\d*)/i },
    { name: "jQuery UI", pattern: /jquery-ui/i, category: "UI Library" },
    { name: "React", pattern: /react(?:\.production\.min|\.development)?\.js/i, category: "Framework", versionRe: /react@(\d+\.\d+\.?\d*)/i },
    { name: "Vue.js", pattern: /vue(?:\.min)?\.js/i, category: "Framework", versionRe: /vue@(\d+\.\d+\.?\d*)/i },
    { name: "Angular", pattern: /angular(?:\.min)?\.js/i, category: "Framework" },
    { name: "Bootstrap JS", pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.js/i, category: "CSS Framework", versionRe: /bootstrap[.-](\d+\.\d+\.?\d*)/i },
    { name: "GSAP", pattern: /gsap(?:\.min)?\.js|TweenMax|TweenLite/i, category: "Animation" },
    { name: "ScrollTrigger (GSAP)", pattern: /ScrollTrigger/i, category: "Animation" },
    { name: "Three.js", pattern: /three(?:\.min)?\.js/i, category: "3D Graphics" },
    { name: "AOS", pattern: /aos(?:\.min)?\.js/i, category: "Animation" },
    { name: "Lottie", pattern: /lottie(?:\.min)?\.js|lottie-web/i, category: "Animation" },
    { name: "Swiper", pattern: /swiper(?:\.min)?\.js/i, category: "Slider" },
    { name: "Splide", pattern: /splide(?:\.min)?\.js/i, category: "Slider" },
    { name: "Slick", pattern: /slick(?:\.min)?\.js/i, category: "Slider" },
    { name: "Fancybox", pattern: /fancybox/i, category: "Lightbox" },
    { name: "GLightbox", pattern: /glightbox/i, category: "Lightbox" },
    { name: "Alpine.js", pattern: /alpinejs/i, category: "Framework" },
    { name: "Stimulus", pattern: /stimulus/i, category: "Framework" },
    { name: "Barba.js", pattern: /barba(?:\.min)?\.js/i, category: "Page Transitions" },
    { name: "Locomotive Scroll", pattern: /locomotive-scroll/i, category: "Smooth Scroll" },
    { name: "Smooth Scroll", pattern: /smoothscroll/i, category: "Smooth Scroll" },
    { name: "Masonry", pattern: /masonry(?:\.pkgd)?(?:\.min)?\.js/i, category: "Layout" },
    { name: "Isotope", pattern: /isotope(?:\.pkgd)?(?:\.min)?\.js/i, category: "Layout" },
    { name: "Chart.js", pattern: /chart(?:\.min)?\.js/i, category: "Charts" },
    { name: "D3.js", pattern: /d3(?:\.min)?\.js/i, category: "Data Viz" },
    { name: "Typed.js", pattern: /typed(?:\.min)?\.js/i, category: "Animation" },
    { name: "Parallax.js", pattern: /parallax(?:\.min)?\.js/i, category: "Animation" },
    { name: "Rellax", pattern: /rellax(?:\.min)?\.js/i, category: "Parallax" },
    { name: "ScrollReveal", pattern: /scrollreveal/i, category: "Animation" },
    { name: "WOW.js", pattern: /wow(?:\.min)?\.js/i, category: "Animation" },
    { name: "Video.js", pattern: /video(?:\.min)?\.js|video-js/i, category: "Video" },
    { name: "Shopify", pattern: /shopify\.com\/s\/files\//i, category: "E-commerce Platform" },
    { name: "WooCommerce", pattern: /woocommerce/i, category: "E-commerce Platform" },
    { name: "Wix", pattern: /wix\.com\/|wixstatic\.com/i, category: "CMS Platform" },
    { name: "WordPress", pattern: /wp-content\/|wp-includes\//i, category: "CMS Platform" },
    { name: "Webflow", pattern: /webflow\.com\//i, category: "CMS Platform" },
  ];

  const detected: DeepScanResult["javascript"]["libraries"] = [];
  const seen = new Set<string>();
  for (const lib of KNOWN_LIBS) {
    if (lib.pattern.test(html) && !seen.has(lib.name)) {
      seen.add(lib.name);
      let version: string | undefined;
      if (lib.versionRe) {
        const m = lib.versionRe.exec(html);
        if (m) version = m[1];
      }
      detected.push({ name: lib.name, version, category: lib.category });
    }
  }

  const hasGtm = /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html);
  const hasAnalytics = /google-analytics\.com|gtag\s*\(|ga\s*\(|UA-\d{6}/i.test(html);
  const hasPixel = /fbevents\.js|facebook\.net.*fbevents|_fbq\s*=/i.test(html);
  const hasCookieBanner = /cookie(?:yes|bot|consent|banner|notice|law|hub)|cookienotice|gdpr/i.test(html);
  const hasChat = /intercom\.io|zendesk\.com|crisp\.chat|tawk\.to|livechat|freshchat|drift\.com|hotjar\.com/i.test(html);
  const hasLazyLoad = /loading\s*=\s*["']lazy["']/i.test(html);

  const scriptTags = html.match(/<script[^>]*>/gi) || [];
  const inlineScriptCount = scriptTags.filter(t => !/\bsrc\s*=/i.test(t)).length;
  const externalScriptCount = scriptTags.filter(t => /\bsrc\s*=/i.test(t)).length;
  const renderBlockingScripts = scriptTags.filter(t => /\bsrc\s*=/i.test(t) && !/\b(defer|async)\b/i.test(t) && !/<script[^>]+type\s*=\s*["'][^"']*module/i.test(t)).length;

  return { libraries: detected, hasGtm, hasAnalytics, hasPixel, hasCookieBanner, hasChat, hasLazyLoad, inlineScriptCount, externalScriptCount, renderBlockingScripts };
}

function parseSeoFromHtml(html: string): DeepScanResult["seo"] {
  const titleM = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = titleM ? titleM[1].trim() : "";
  const titleLength = title.length;
  const titleStatus = !title ? "missing" : titleLength < 30 ? "short" : titleLength > 60 ? "long" : "good";

  const descM = /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)/i.exec(html)
    || /<meta[^>]+content\s*=\s*["']([^"']*)[^>]+name\s*=\s*["']description["']/i.exec(html);
  const desc = descM ? descM[1].trim() : "";
  const descLength = desc.length;
  const descStatus = !desc ? "missing" : descLength < 120 ? "short" : descLength > 160 ? "long" : "good";

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const h1Status = h1Count === 0 ? "missing" : h1Count > 1 ? "multiple" : "good";

  const canonicalM = /<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']*)/i.exec(html)
    || /<link[^>]+href\s*=\s*["']([^"']*)[^>]+rel\s*=\s*["']canonical["']/i.exec(html);
  const hasCanonical = !!canonicalM;
  const canonicalUrl = canonicalM ? canonicalM[1] : undefined;

  const robotsM = /<meta[^>]+name\s*=\s*["']robots["'][^>]+content\s*=\s*["']([^"']*)/i.exec(html);
  const metaRobots = robotsM ? robotsM[1] : undefined;

  const ogTitle = /<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']*)/i.exec(html)?.[1];
  const ogDesc = /<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']*)/i.exec(html)?.[1];
  const ogImg = /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']*)/i.exec(html)?.[1];
  const hasOpenGraph = /property\s*=\s*["']og:/i.test(html);

  const hasTwitterCard = /name\s*=\s*["']twitter:card["']/i.test(html);

  const hasStructuredData = /<script[^>]+type\s*=\s*["']application\/ld\+json["']/i.test(html);
  const structuredDataTypes: string[] = [];
  const sdMatches = html.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
  for (const m of sdMatches) {
    const t = /"@type"\s*:\s*"([^"]+)"/.exec(m)?.[1];
    if (t && !structuredDataTypes.includes(t)) structuredDataTypes.push(t);
  }

  const hasHreflang = /hreflang\s*=/i.test(html);
  const hasViewport = /name\s*=\s*["']viewport["']/i.test(html);
  const hasCharset = /<meta\s+charset/i.test(html);

  const issues: DeepScanResult["seo"]["issues"] = [];
  if (titleStatus === "missing") issues.push({ type: "Sin título", severity: "critical", detail: "La página no tiene etiqueta <title>" });
  else if (titleStatus === "short") issues.push({ type: "Título corto", severity: "medium", detail: `Título de ${titleLength} chars. Optimal: 30-60.` });
  else if (titleStatus === "long") issues.push({ type: "Título largo", severity: "low", detail: `Título de ${titleLength} chars. Optimal: 30-60. Google trunca a ~60.` });
  if (descStatus === "missing") issues.push({ type: "Sin meta description", severity: "high", detail: "Falta meta description — afecta CTR en resultados de búsqueda" });
  else if (descStatus === "short") issues.push({ type: "Meta description corta", severity: "medium", detail: `${descLength} chars. Optimal: 120-160.` });
  else if (descStatus === "long") issues.push({ type: "Meta description larga", severity: "low", detail: `${descLength} chars. Google trunca a ~160.` });
  if (h1Status === "missing") issues.push({ type: "Sin H1", severity: "high", detail: "Falta encabezado H1 — señal SEO básica para Google" });
  if (h1Status === "multiple") issues.push({ type: "Múltiples H1", severity: "medium", detail: `${h1Count} H1 encontrados. Best practice: solo 1 por página.` });
  if (!hasCanonical) issues.push({ type: "Sin canonical", severity: "medium", detail: "Falta <link rel='canonical'>. Puede causar problemas de contenido duplicado." });
  if (!hasOpenGraph) issues.push({ type: "Sin Open Graph", severity: "medium", detail: "Sin tags OG — los links compartidos en redes sociales no tendrán imagen/descripción." });
  if (!hasTwitterCard) issues.push({ type: "Sin Twitter Card", severity: "low", detail: "Sin Twitter Card meta tags." });
  if (!hasStructuredData) issues.push({ type: "Sin datos estructurados", severity: "medium", detail: "Sin JSON-LD/Schema.org — se pierde elegibilidad para rich snippets en Google." });
  if (!hasViewport) issues.push({ type: "Sin viewport", severity: "critical", detail: "Sin meta viewport — la página no es responsive en móvil." });

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 20;
    else if (issue.severity === "high") score -= 12;
    else if (issue.severity === "medium") score -= 7;
    else score -= 3;
  }
  score = Math.max(0, score);

  return { score, title, titleLength, titleStatus, metaDescription: desc, metaDescriptionLength: descLength, metaDescriptionStatus: descStatus, h1Count, h1Status, hasCanonical, canonicalUrl, metaRobots, hasOpenGraph, ogTitle, ogDescription: ogDesc, ogImage: ogImg, hasTwitterCard, hasStructuredData, structuredDataTypes, hasHreflang, hasViewport, hasCharset, issues };
}

// ── Exposed Secrets Scanner ──────────────────────────────────────────────────
function scanExposedSecrets(content: string): ExposedSecret[] {
  const PATTERNS: Array<{
    type: string; service: string; severity: "critical" | "high" | "medium";
    regex: RegExp; recommendation: string;
  }> = [
    { type: "API Key — Live Secret Key", service: "Stripe", severity: "critical", regex: /sk_live_[0-9a-zA-Z]{24,}/g, recommendation: "Revocar inmediatamente en dashboard.stripe.com → Developers → API keys" },
    { type: "API Key — Publishable Key Live", service: "Stripe", severity: "high", regex: /pk_live_[0-9a-zA-Z]{24,}/g, recommendation: "Rotar la clave live en Stripe Dashboard; nunca exponer sk_live en frontend" },
    { type: "API Key — Test Secret Key", service: "Stripe", severity: "high", regex: /sk_test_[0-9a-zA-Z]{24,}/g, recommendation: "Mover a variable de entorno servidor; nunca en código frontend" },
    { type: "API Key", service: "OpenAI", severity: "critical", regex: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{50,}/g, recommendation: "Revocar en platform.openai.com → API Keys. Crear nueva y usar solo en backend" },
    { type: "API Key", service: "Anthropic (Claude)", severity: "critical", regex: /sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}/g, recommendation: "Revocar en console.anthropic.com → API Keys. Usar solo en backend con variables de entorno" },
    { type: "API Key", service: "Google (AI/Maps/Firebase)", severity: "critical", regex: /AIza[0-9A-Za-z_-]{35}/g, recommendation: "Restringir en Google Cloud Console → APIs → Credentials. Limitar por HTTP Referrer o IP" },
    { type: "OAuth Token", service: "Google OAuth", severity: "critical", regex: /ya29\.[0-9A-Za-z\-_]{50,}/g, recommendation: "Revocar el token OAuth en myaccount.google.com → Security → Manage third-party access" },
    { type: "Access Key ID", service: "AWS", severity: "critical", regex: /AKIA[0-9A-Z]{16}/g, recommendation: "Revocar en AWS IAM Console inmediatamente. Auditar accesos con AWS CloudTrail" },
    { type: "Secret Access Key", service: "AWS", severity: "critical", regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g, recommendation: "Si es AWS Secret Key, revocar en IAM. Usar IAM Roles en lugar de claves estáticas" },
    { type: "Personal Access Token", service: "GitHub", severity: "critical", regex: /ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{82,}/g, recommendation: "Revocar en github.com → Settings → Developer settings → Personal access tokens" },
    { type: "App Token", service: "GitHub", severity: "high", regex: /ghs_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}/g, recommendation: "Revocar el OAuth/App token en GitHub Settings → Authorized OAuth Apps" },
    { type: "Private App Token", service: "Shopify", severity: "critical", regex: /shppa_[A-Za-z0-9]{32,}|shpat_[A-Za-z0-9]{32,}|shpss_[A-Za-z0-9]{32,}/g, recommendation: "Revocar en Shopify Admin → Apps → Private apps. Nunca exponer access tokens en frontend" },
    { type: "Storefront Token", service: "Shopify", severity: "high", regex: /[0-9a-fA-F]{32}(?=.*shopify|.*storefront)/g, recommendation: "El Storefront API token es público, pero limitar scopes a solo lectura en Shopify Admin" },
    { type: "API Key", service: "SendGrid", severity: "critical", regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, recommendation: "Revocar en app.sendgrid.com → Settings → API Keys. Usar solo en backend" },
    { type: "API Key", service: "Twilio", severity: "critical", regex: /SK[0-9a-f]{32}/g, recommendation: "Revocar en console.twilio.com → Account → API Keys. Rotar AccountSid y AuthToken" },
    { type: "Auth Token", service: "Twilio", severity: "critical", regex: /AC[0-9a-f]{32}/g, recommendation: "Este puede ser AccountSid de Twilio. Verificar y revocar AuthToken asociado si se expuso" },
    { type: "API Key", service: "Mailchimp", severity: "high", regex: /[0-9a-f]{32}-us[0-9]{1,2}/g, recommendation: "Revocar en Mailchimp Account → Extras → API Keys" },
    { type: "Server Key / Legacy", service: "Firebase", severity: "critical", regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/g, recommendation: "Migrar a FCM v1 API con OAuth 2.0. Revocar Legacy Server Key en Firebase Console" },
    { type: "API Key", service: "HubSpot", severity: "high", regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, recommendation: "Si es HubSpot API Key (UUID format), revocar en HubSpot → Settings → API Key" },
    { type: "Secret Key", service: "Mailgun", severity: "critical", regex: /key-[0-9a-zA-Z]{32}/g, recommendation: "Revocar en app.mailgun.com → Settings → API Keys" },
    { type: "Access Token", service: "Slack", severity: "critical", regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g, recommendation: "Revocar en api.slack.com → Your Apps → OAuth & Permissions → Revoke All Tokens" },
    { type: "Webhook URL (contiene token)", service: "Slack", severity: "high", regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g, recommendation: "Regenerar Incoming Webhook en Slack App → Incoming Webhooks" },
    { type: "Bot Token", service: "Telegram", severity: "critical", regex: /[0-9]{8,10}:[A-Za-z0-9_-]{35}/g, recommendation: "Revocar con /revoke en @BotFather de Telegram y generar nuevo token" },
    { type: "Private Key", service: "RSA/PEM", severity: "critical", regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, recommendation: "Eliminar clave privada del código. Usar gestores de secretos (AWS Secrets Manager, Vault)" },
    { type: "Password en URL", service: "Base de datos / Conexión", severity: "critical", regex: /(?:mysql|postgres|mongodb|redis|amqp):\/\/[^:]+:[^@]{4,}@/gi, recommendation: "Nunca incluir credenciales en URLs de conexión en código frontend o público" },
    { type: "Contraseña hardcodeada", service: "Genérico", severity: "high", regex: /(?:password|passwd|secret|api_secret|client_secret)\s*[=:]\s*["'][^"']{6,}["']/gi, recommendation: "Mover contraseñas/secrets a variables de entorno del servidor. Nunca en código cliente" },
    { type: "API Key genérica", service: "Genérico", severity: "medium", regex: /(?:api[_-]?key|apikey|access[_-]?token)\s*[=:]\s*["'][A-Za-z0-9_\-]{16,}["']/gi, recommendation: "Verificar si es una clave real. Si lo es, mover a variables de entorno del servidor" },
    { type: "JWT Token", service: "Autenticación", severity: "high", regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, recommendation: "JWTs hardcodeados pueden revelar datos internos. Nunca incrustar tokens de sesión en código" },
    { type: "Webhook Secret", service: "Shopify Webhook", severity: "high", regex: /[A-Fa-f0-9]{64}(?=.*webhook|.*hmac)/gi, recommendation: "Revocar el webhook secret en Shopify Admin → Settings → Notifications → Webhooks" },
  ];

  const lines = content.split("\n");
  const found: ExposedSecret[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.regex.source, pattern.regex.flags.includes("g") ? pattern.regex.flags : pattern.regex.flags + "g"));
    for (const match of matches) {
      const raw = match[0];
      const key = `${pattern.service}:${raw.slice(0, 12)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Find line number
      let lineNumber = 1;
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        pos += lines[i].length + 1;
        if (pos > (match.index ?? 0)) { lineNumber = i + 1; break; }
      }

      // Build context (surrounding 80 chars, sanitized)
      const start = Math.max(0, (match.index ?? 0) - 40);
      const end = Math.min(content.length, (match.index ?? 0) + raw.length + 40);
      const ctx = content.slice(start, end).replace(/\n/g, " ").trim();

      // Mask: show first 6 + *** + last 4 (if long enough)
      const masked = raw.length > 12
        ? raw.slice(0, 6) + "•".repeat(Math.min(raw.length - 10, 20)) + raw.slice(-4)
        : raw.slice(0, 3) + "•".repeat(raw.length - 3);

      // Skip very short AWS-style matches that are likely false positives
      if (pattern.service === "AWS" && pattern.type.includes("Secret") && raw.length < 35) continue;

      found.push({
        type: pattern.type,
        service: pattern.service,
        severity: pattern.severity,
        masked,
        raw,
        context: ctx,
        recommendation: pattern.recommendation,
        lineNumber,
      });
    }
  }

  // Sort by severity
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  return found.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
}

function parseSecurityFromHeaders(headers: Record<string, string>, url: string, html: string): DeepScanResult["security"] {
  const SECURITY_HEADERS: Array<{ name: string; headerKey: string; severity: "critical" | "high" | "medium" | "info"; description: string; recommendation: string }> = [
    { name: "Content-Security-Policy", headerKey: "content-security-policy", severity: "high", description: "Previene inyección de scripts maliciosos (XSS)", recommendation: "Añadir CSP estricta: default-src 'self'; script-src 'self' 'nonce-...';" },
    { name: "Strict-Transport-Security", headerKey: "strict-transport-security", severity: "high", description: "Fuerza HTTPS — previene ataques de downgrade", recommendation: "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" },
    { name: "X-Frame-Options", headerKey: "x-frame-options", severity: "medium", description: "Previene clickjacking embebiendo la página en un iframe", recommendation: "X-Frame-Options: DENY o SAMEORIGIN" },
    { name: "X-Content-Type-Options", headerKey: "x-content-type-options", severity: "medium", description: "Previene MIME sniffing por el navegador", recommendation: "X-Content-Type-Options: nosniff" },
    { name: "Referrer-Policy", headerKey: "referrer-policy", severity: "info", description: "Controla qué info de referrer se envía con las peticiones", recommendation: "Referrer-Policy: strict-origin-when-cross-origin" },
    { name: "Permissions-Policy", headerKey: "permissions-policy", severity: "info", description: "Controla el acceso a APIs del navegador (cámara, micrófono, etc.)", recommendation: "Permissions-Policy: geolocation=(), microphone=(), camera=()" },
    { name: "X-XSS-Protection", headerKey: "x-xss-protection", severity: "info", description: "Filtro XSS en navegadores legacy (superado por CSP)", recommendation: "X-XSS-Protection: 1; mode=block (o eliminar si tienes CSP)" },
    { name: "Cache-Control", headerKey: "cache-control", severity: "info", description: "Controla caché del navegador — crítico para datos sensibles", recommendation: "Cache-Control: no-store para páginas con datos privados" },
  ];

  const headerResults = SECURITY_HEADERS.map(h => {
    const val = headers[h.headerKey];
    return { name: h.name, present: !!val, value: val, severity: h.severity, description: h.description, recommendation: h.recommendation };
  });

  const vulnerabilities: DeepScanResult["security"]["vulnerabilities"] = [];

  const serverHeader = headers["server"] || headers["x-powered-by"];
  if (serverHeader) {
    vulnerabilities.push({ type: "Divulgación de versión del servidor", severity: "medium", description: `Server header expone: "${serverHeader}" — revela tecnología y versión al atacante`, recommendation: "Eliminar o anonimizar headers Server y X-Powered-By" });
  }

  if (!headers["content-security-policy"]) {
    vulnerabilities.push({ type: "Sin Content-Security-Policy", severity: "high", description: "Sin CSP el sitio es vulnerable a ataques XSS — scripts de terceros pueden ejecutarse sin restricción", recommendation: "Implementar CSP estricta con nonces o hashes para scripts inline" });
  }

  if (!headers["strict-transport-security"] && url.startsWith("https://")) {
    vulnerabilities.push({ type: "Sin HSTS", severity: "high", description: "Sin HSTS el navegador puede ser engañado para conectar por HTTP (downgrade attack)", recommendation: "Activar HSTS con max-age mínimo de 1 año e includeSubDomains" });
  }

  if (!headers["x-frame-options"] && !headers["content-security-policy"]?.includes("frame-ancestors")) {
    vulnerabilities.push({ type: "Vulnerable a Clickjacking", severity: "medium", description: "Sin X-Frame-Options ni CSP frame-ancestors, la página puede ser embebida en iframes maliciosos", recommendation: "Añadir X-Frame-Options: DENY o CSP frame-ancestors 'self'" });
  }

  const httpsInternalLinks = url.startsWith("https://") &&
    /<(?:img|script|link|iframe)[^>]+(?:src|href)\s*=\s*["']http:\/\//i.test(html);
  const mixedContent = httpsInternalLinks;
  if (mixedContent) {
    vulnerabilities.push({ type: "Contenido mixto (Mixed Content)", severity: "critical", description: "Recursos HTTP cargados en página HTTPS — el navegador puede bloquearlo y romperse el sitio", recommendation: "Cambiar todas las URLs de recursos a HTTPS" });
  }

  const inlineEventHandlers = (html.match(/\bon[a-z]+\s*=/gi) || []).length;
  if (inlineEventHandlers > 20) {
    vulnerabilities.push({ type: "Event handlers inline excesivos", severity: "low", description: `${inlineEventHandlers} manejadores de eventos inline (onclick, onload, etc.) — dificultan implementación de CSP estricta`, recommendation: "Mover event handlers a archivos JavaScript externos" });
  }

  if (/<input[^>]*type\s*=\s*["']password["'][^>]*autocomplete\s*=\s*["']on["']/i.test(html)) {
    vulnerabilities.push({ type: "Autocomplete activado en campos contraseña", severity: "medium", description: "Campos de contraseña con autocomplete habilitado — riesgo en equipos compartidos", recommendation: "Añadir autocomplete='off' en campos de contraseña" });
  }

  let secScore = 100;
  const missingCritical = headerResults.filter(h => !h.present && (h.severity === "critical" || h.severity === "high")).length;
  const missingMedium = headerResults.filter(h => !h.present && h.severity === "medium").length;
  secScore -= missingCritical * 18;
  secScore -= missingMedium * 8;
  secScore -= vulnerabilities.filter(v => v.severity === "critical").length * 25;
  secScore -= vulnerabilities.filter(v => v.severity === "high").length * 15;
  secScore -= vulnerabilities.filter(v => v.severity === "medium").length * 8;
  secScore = Math.max(0, secScore);

  const exposedSecrets = scanExposedSecrets(html);
  // Penalizar score por secretos expuestos
  secScore -= exposedSecrets.filter(s => s.severity === "critical").length * 30;
  secScore -= exposedSecrets.filter(s => s.severity === "high").length * 15;
  secScore -= exposedSecrets.filter(s => s.severity === "medium").length * 5;
  secScore = Math.max(0, secScore);

  // Añadir vulnerabilidades de secretos expuestos al resumen
  for (const secret of exposedSecrets) {
    vulnerabilities.push({
      type: `🔑 Secreto expuesto: ${secret.service} — ${secret.type}`,
      severity: secret.severity,
      description: `Credencial hardcodeada detectada en el código fuente: ${secret.masked} (línea ${secret.lineNumber})`,
      recommendation: secret.recommendation,
    });
  }

  return {
    score: secScore,
    headers: headerResults,
    vulnerabilities,
    https: url.startsWith("https://"),
    mixedContent,
    serverInfo: serverHeader,
    exposedSecrets,
  };
}

router.post("/web-lab/deep-scan", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, projectId } = req.body as { url?: string; projectId?: number };
    if (!url) { res.status(400).json({ error: "URL requerida" }); return; }

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = "https://" + normalizedUrl;

    await validateUrlWithDnsCheck(normalizedUrl);

    // Fetch HTML + HEAD in parallel
    const [htmlResp, headResp] = await Promise.all([
      fetch(normalizedUrl, {
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(25_000),
        redirect: "follow",
      }).catch(() => null),
      fetch(normalizedUrl, {
        method: "HEAD",
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      }).catch(() => null),
    ]);

    const html = htmlResp ? await htmlResp.text().catch(() => "") : "";
    const responseHeaders: Record<string, string> = {};
    const sourceHeaders = headResp?.headers ?? htmlResp?.headers;
    if (sourceHeaders) {
      for (const [k, v] of (sourceHeaders as any).entries?.() ?? []) {
        responseHeaders[k.toLowerCase()] = v;
      }
    }

    // Parse all dimensions in parallel
    const [domResult, jsResult, seoResult, secResult] = await Promise.all([
      Promise.resolve(parseDomFromHtml(html)),
      Promise.resolve(parseJsLibraries(html)),
      Promise.resolve(parseSeoFromHtml(html)),
      Promise.resolve(parseSecurityFromHeaders(responseHeaders, normalizedUrl, html)),
    ]);

    // Performance issues from DOM/JS data
    const perfIssues: DeepScanResult["performance"]["issues"] = [];
    if (jsResult.renderBlockingScripts > 3) perfIssues.push({ type: "Scripts render-blocking", severity: "high", detail: `${jsResult.renderBlockingScripts} scripts externos sin defer/async bloquean el renderizado inicial` });
    const cssFiles = (html.match(/<link[^>]+rel\s*=\s*["']stylesheet["']/gi) || []).length;
    if (cssFiles > 8) perfIssues.push({ type: "Demasiados CSS externos", severity: "medium", detail: `${cssFiles} hojas de estilo externas detectadas — considera consolidarlas` });
    if (domResult.images.total > 20 && domResult.images.lazy < domResult.images.total / 2) {
      perfIssues.push({ type: "Imágenes sin lazy loading", severity: "medium", detail: `${domResult.images.total - domResult.images.lazy} imágenes cargadas sin loading="lazy"` });
    }
    if (domResult.totalElements > 1500) perfIssues.push({ type: "DOM muy grande", severity: "high", detail: `${domResult.totalElements} elementos DOM — Google recomienda menos de 1500. Penaliza Core Web Vitals.` });
    const inlineCriticalCss = /<style[^>]*>[\s\S]{1000}/i.test(html);
    if (!inlineCriticalCss && cssFiles > 0) perfIssues.push({ type: "Sin CSS crítico inline", severity: "low", detail: "No se detecta CSS crítico inline — considera incluir above-the-fold CSS en <style> para mejorar FCP" });

    const result: DeepScanResult = {
      url: normalizedUrl,
      scannedAt: new Date().toISOString(),
      security: secResult,
      dom: domResult,
      javascript: jsResult,
      seo: seoResult,
      performance: {
        resourceCounts: {
          scripts: domResult.scripts.external,
          stylesheets: cssFiles,
          images: domResult.images.total,
        },
        renderBlockingCss: Math.max(0, cssFiles - 3),
        renderBlockingJs: jsResult.renderBlockingScripts,
        lazyImages: domResult.images.lazy,
        inlineCriticalCss,
        issues: perfIssues,
      },
    };

    // ── Persistir el escaneo en el vault para que aparezca en el historial ──
    let vaultId: number | null = null;
    const pid = projectId ? Number(projectId) : 0;
    if (pid && !isNaN(pid)) {
      try {
        const reportHtml = buildDeepScanReportHtml(result);
        vaultId = await saveToVault({
          projectId: pid,
          fileType: "web-lab-report",
          category: "web-lab",
          title: `🔒 Escaneo de Seguridad — ${normalizedUrl}`,
          description: `Seguridad ${result.security.score}/100 · ${result.security.vulnerabilities.length} vulnerabilidades · ${result.security.exposedSecrets.length} secretos · ${result.dom.totalElements} elementos DOM`,
          originalUrl: normalizedUrl,
          mimeType: "text/html",
          generatedBy: "web-lab-deep-scan",
          content: reportHtml,
          // OJO: usamos `scanUrl` (no `url`) para que download-report sirva el HTML
          // almacenado tal cual y no intente re-renderizar como informe de diseño.
          metadata: { kind: "deep-scan", scanUrl: normalizedUrl, score: result.security.score, scannedAt: result.scannedAt, template: "prestige" },
        });
      } catch (e) { logger.warn({ e }, "deep-scan vault save failed"); }
    }

    res.json({ success: true, result, vaultId });
  } catch (err: any) {
    logger.error({ err }, "Web Lab deep-scan failed");
    res.status(500).json({ error: err.message || "Error en el análisis profundo" });
  }
});

// ═══════════════════════════════════════════════════════════════
// GENERATE 3D EFFECTS — Ready-to-use code: GSAP, CSS3D, Three.js
// ═══════════════════════════════════════════════════════════════

const EFFECTS_3D_SYSTEM = `Eres el experto mundial en efectos web inmersivos: CSS 3D, GSAP ScrollTrigger, Three.js, Parallax y animaciones de alto impacto.

Tu trabajo es analizar el HTML/CSS/marca del cliente y generar código REAL, completo y listo para producción de 5 efectos distintos adaptados a su marca específica.

EFECTOS A GENERAR (SIEMPRE LOS 5):
1. **gsap_scroll_trigger** — Animaciones scroll-driven con GSAP ScrollTrigger: elementos que se revelan, textos que se mueven, secciones que se fijan (pin). Usa los colores y fuentes REALES de la marca.
2. **css_3d_perspective** — Secciones con perspectiva 3D CSS pura: cards que rotan (rotateY), secciones con transformPerspective, elementos flotantes con translateZ. Sin librerías.
3. **three_js_background** — Fondo Three.js interactivo: partículas flotantes O geometría 3D animada que reacciona al ratón, usando los colores de marca. Código completo con init+animate+resize.
4. **exploded_view** — Vista explosionada CSS/JS: animación de producto/servicio donde los elementos se "explotan" y vuelven a ensamblar al scroll o hover. Con timeline GSAP.
5. **parallax_immersive** — Secciones parallax multicapa inmersivas: profundidad visual con múltiples capas a distintas velocidades. Usando CSS custom properties de la marca.

REGLAS CRÍTICAS:
- Código 100% funcional y listo para copy-paste. Sin errores de sintaxis.
- Cada efecto incluye HTML+CSS+JS integrado en un <div> autónomo que puede insertarse en cualquier página.
- Usa los colores EXACTOS de la marca (hex reales del análisis).
- Incluye siempre los CDN de las librerías necesarias en los scripts de cada efecto.
- Los textos de ejemplo deben ser del sector/marca del cliente (no genéricos).
- Añade comentarios en el código explicando cómo personalizar cada efecto.
- PROHIBIDO: Lorem ipsum, placeholder, variables vacías, código incompleto.

Responde SOLO JSON válido:
{
  "brand": "nombre de la marca detectado",
  "sector": "sector de la empresa",
  "primaryColor": "#hex color primario de la marca",
  "effects": [
    {
      "id": "gsap_scroll_trigger|css_3d_perspective|three_js_background|exploded_view|parallax_immersive",
      "name": "Nombre descriptivo del efecto",
      "description": "Qué hace este efecto y por qué es ideal para esta marca",
      "complexity": "beginner|intermediate|advanced",
      "dependencies": ["GSAP + ScrollTrigger", "Three.js", "Vanilla JS"],
      "code": "<!-- Código HTML+CSS+JS COMPLETO y funcional —>",
      "cssOnly": false,
      "installInstructions": "Pasos para integrar en Shopify/WordPress/HTML"
    }
  ]
}`;

router.post("/web-lab/generate-3d-effects", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, projectId, html, css, brandInfo } = req.body as {
      url?: string;
      projectId?: number;
      html?: string;
      css?: string;
      brandInfo?: string;
    };

    if (!url && !html) { res.status(400).json({ error: "Se requiere url o html" }); return; }

    const pid = projectId ?? 0;

    res.status(200);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    enableLongRunning(res);
    if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

    let targetHtml = html || "";
    let targetCss = css || "";

    if (url && !html) {
      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = "https://" + normalizedUrl;
      try {
        await validateUrlWithDnsCheck(normalizedUrl);
        const resp = await fetch(normalizedUrl, {
          headers: { "User-Agent": BROWSER_UA },
          signal: AbortSignal.timeout(20_000),
        });
        targetHtml = (await resp.text()).substring(0, 60_000);
      } catch { /* use empty */ }
    }

    const colorPalette = (targetCss || targetHtml).match(/#[0-9a-fA-F]{6}\b/g);
    const topColors = colorPalette ? [...new Set(colorPalette)].slice(0, 8).join(", ") : "desconocido";

    const htmlSnippet = targetHtml.substring(0, 15_000);
    const cssSnippet = targetCss.substring(0, 10_000);

    const userPrompt = `Analiza este sitio web y genera 5 efectos 3D/animación REALES adaptados a su marca y sector.

URL: ${url || "HTML directo"}
${brandInfo ? `INFO DE MARCA: ${brandInfo}` : ""}

COLORES DETECTADOS EN EL CSS: ${topColors}

HTML (extracto):
${htmlSnippet}

CSS (extracto):
${cssSnippet}

INSTRUCCIÓN: Usa los colores reales detectados en los efectos. El sector y estilo de la marca deben verse reflejados.`;

    const result = await askClaudeJsonWithBrain<{
      brand: string;
      sector: string;
      primaryColor: string;
      effects: Array<{
        id: string;
        name: string;
        description: string;
        complexity: string;
        dependencies: string[];
        code: string;
        cssOnly: boolean;
        installInstructions: string;
      }>;
    }>(pid, userPrompt, EFFECTS_3D_SYSTEM, "general", undefined, 24000, 360_000);

    if (!result.effects || result.effects.length === 0) {
      res.end(JSON.stringify({ error: "No se generaron efectos" }));
      return;
    }

    if (pid > 0) {
      learnFromOperation({
        operationType: "web_lab_3d_effects",
        title: `Efectos 3D generados: ${result.brand} — ${url}`,
        content: `Marca: ${result.brand}. Sector: ${result.sector}. Efectos: ${result.effects.map(e => e.name).join(", ")}. Colores: ${topColors}.`,
        confidence: 0.85,
        tags: ["web-lab", "3d-effects", result.sector, url || ""],
      });
    }

    res.end(JSON.stringify({ success: true, ...result }));
  } catch (err: any) {
    logger.error({ err }, "Web Lab generate-3d-effects failed");
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Error generando efectos 3D" });
    } else {
      try { res.end(JSON.stringify({ error: err.message })); } catch {}
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DNA Extractor helpers (TypeScript port of _web_lab_engine.py)
// ─────────────────────────────────────────────────────────────────────────────

const TRIVIAL_COLORS = new Set([
  "#ffffff","#fff","#000000","#000","#333333","#333","#555555","#555",
  "#666666","#666","#777777","#777","#888888","#888","#999999","#999",
  "#aaaaaa","#aaa","#bbbbbb","#bbb","#cccccc","#ccc","#dddddd","#ddd",
  "#eeeeee","#eee","transparent","inherit","initial","unset",
]);

function dnaExtractPalette(css: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of css.matchAll(/--[\w-]*(?:color|primary|secondary|accent|brand|bg|background)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8})/gi)) {
    const h = m[1].slice(0, 7).toLowerCase();
    if (!TRIVIAL_COLORS.has(h) && !seen.has(h)) { seen.add(h); out.push(h); }
  }
  for (const m of css.matchAll(/(?:background|color|border|fill|stroke)[^:;{]*:\s*(#[0-9a-fA-F]{6})/gi)) {
    const h = m[1].toLowerCase();
    if (!TRIVIAL_COLORS.has(h) && !seen.has(h) && out.length < 8) { seen.add(h); out.push(h); }
  }
  return out.slice(0, 8);
}

function dnaExtractFonts(html: string): string[] {
  const fonts: string[] = [];
  for (const chunk of html.matchAll(/fonts\.googleapis\.com\/css[^"']*family=([^&"'#\s]+)/gi)) {
    for (const name of chunk[1].replace(/%7C/gi, "|").split("|")) {
      const clean = name.replace(/:[^|&\s]*/g, "").replace(/\+/g, " ").trim();
      if (clean) fonts.push(clean);
    }
  }
  const skip = new Set(["inherit","initial","unset","sans-serif","serif","monospace","cursive","fantasy","system-ui","-apple-system","arial","helvetica","georgia","times new roman","verdana","trebuchet ms","impact","comic sans ms"]);
  for (const m of html.matchAll(/font-family\s*:\s*['"]?([^,;'"}\n/]+)/gi)) {
    const clean = m[1].trim().replace(/^['"]/, "").replace(/['"]$/, "").split(",")[0].trim();
    if (!skip.has(clean.toLowerCase()) && clean.length > 2 && clean.length < 60) fonts.push(clean);
  }
  const seen = new Set<string>();
  return fonts.filter(f => { const k = f.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
}

function dnaMetaContent(html: string, prop: string): string {
  for (const pat of [
    new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, "i"),
    new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`, "i"),
    new RegExp(`<meta[^>]+name="${prop}"[^>]+content="([^"]+)"`, "i"),
    new RegExp(`<meta[^>]+content="([^"]+)"[^>]+name="${prop}"`, "i"),
  ]) {
    const m = html.match(pat);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  return "";
}

function dnaExtractFromHtml(html: string, url: string): Record<string, any> {
  const dna: Record<string, any> = { source_url: url };

  const ogSite = dnaMetaContent(html, "og:site_name");
  const appName = dnaMetaContent(html, "application-name");
  const titleM = html.match(/<title[^>]*>([^<|·–\-—·]+)/i);
  for (const c of [ogSite, appName, titleM?.[1]].filter(Boolean) as string[]) {
    const s = c.replace(/\s+/g, " ").trim();
    if (s.length > 1 && s.length < 80) { dna.name = s; break; }
  }

  for (const v of [dnaMetaContent(html, "og:description"), dnaMetaContent(html, "description"), dnaMetaContent(html, "twitter:description")].filter(Boolean)) {
    if (v.length > 8 && v.length < 300) { dna.tagline = v.slice(0, 250); break; }
  }
  if (!dna.tagline) {
    const h1 = html.match(/<h1[^>]*>([^<]{8,200})<\/h1>/i)?.[1];
    if (h1) dna.tagline = h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
  }

  for (const pat of [
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
    /<link[^>]+rel="(?:shortcut )?icon"[^>]+href="([^"]+)"/i,
    /<img[^>]+(?:class|id)="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i,
    /<img[^>]+src="([^"]*logo[^"]*\.(?:png|svg|jpg|webp))"/i,
  ]) {
    const m = html.match(pat);
    if (m) {
      let logo = m[1];
      if (!logo.startsWith("http")) { try { logo = new URL(logo, url).href; } catch {} }
      dna.logo_url = logo; break;
    }
  }

  const styles = [...html.matchAll(/<style[^>]*>(.*?)<\/style>/gsi)].map(m => m[1]).join(" ");
  const inline = [...html.matchAll(/style="([^"]+)"/gi)].map(m => m[1]).join(" ");
  const palette = dnaExtractPalette(styles + " " + inline);
  if (palette.length) {
    dna.primary_color = palette[0];
    if (palette.length > 1) dna.secondary_color = palette[1];
    if (palette.length > 2) dna.accent_color = palette[2];
    dna.palette = palette;
  }

  const fonts = dnaExtractFonts(html);
  if (fonts.length) { dna.primary_font = fonts[0]; dna.all_fonts = fonts; }

  const ctaBtns = [...html.matchAll(/<(?:button|a)[^>]*(?:class|id)="[^"]*(?:cta|btn-primary|hero|primary-btn)[^"]*"[^>]*>([\s\S]{2,60}?)<\/(?:button|a)>/gi)];
  const rawBtns = ctaBtns.length ? ctaBtns.slice(0, 3) : [...html.matchAll(/<button[^>]*>([\s\S]{3,40}?)<\/button>/gi)].slice(0, 4);
  const ctas = rawBtns.map(m => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).filter(t => t && t.length < 60);
  if (ctas.length) { dna.cta = ctas[0]; dna.cta_list = ctas; }

  const badHandles = new Set(["share","sharer","intent","dialog","login","signup","p","photo","video","posts","pages","groups","hashtag","explore","reel","stories"]);
  const social: Record<string, string> = {};
  for (const [plat, pat] of [
    ["instagram", /instagram\.com\/([a-zA-Z0-9_.]{2,40})/i],
    ["tiktok",    /tiktok\.com\/@([a-zA-Z0-9_.]{2,40})/i],
    ["twitter",   /(?:twitter|x)\.com\/([a-zA-Z0-9_]{2,40})/i],
    ["facebook",  /facebook\.com\/([a-zA-Z0-9_.]{3,60})/i],
    ["linkedin",  /linkedin\.com\/(?:company\/)?([a-zA-Z0-9_-]{3,60})/i],
    ["youtube",   /youtube\.com\/(?:@|c\/|channel\/|user\/)?([a-zA-Z0-9_-]{3,60})/i],
  ] as [string, RegExp][]) {
    const m = html.match(pat);
    if (m) { const h = m[1].replace(/\/$/, ""); if (!badHandles.has(h.toLowerCase())) social[plat] = h; }
  }
  if (Object.keys(social).length) dna.social_handles = social;

  try { dna.domain = new URL(url).hostname.replace("www.", ""); } catch {}

  const sectorKw: Record<string, string[]> = {
    restaurante: ["menu","carta","restaurante","gastronomia","reserva","plato"],
    ecommerce:   ["shop","tienda","cart","carrito","comprar","pedido","envio"],
    salud:       ["clinica","medico","salud","health","wellness","spa","tratamiento"],
    tecnologia:  ["software","saas","app","platform","dashboard","api","developer"],
    moda:        ["moda","fashion","ropa","coleccion","talla","tejido","boutique"],
    turismo:     ["hotel","viaje","turismo","travel","reserva","alojamiento","vuelo"],
    educacion:   ["curso","formacion","escuela","academia","aprender","clases","online"],
    agencia:     ["agencia","studio","branding","marketing","campana","creativo"],
  };
  const txt = html.slice(0, 10000).toLowerCase();
  let bestSector = "";
  let bestScore = 0;
  for (const [s, ks] of Object.entries(sectorKw)) {
    const score = ks.filter(k => txt.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestSector = s; }
  }
  if (bestScore > 0) dna.sector = bestSector;

  return dna;
}

async function ddgInstant(query: string): Promise<Record<string, any>> {
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(12000),
    });
    const d = await r.json() as any;
    const result: Record<string, any> = { source: "ddg_instant", query, items: [] };
    if (d.AbstractText) { result.abstract = String(d.AbstractText).slice(0, 500); result.abstract_url = d.AbstractURL || ""; }
    for (const rt of (d.RelatedTopics || []).slice(0, 5)) {
      if (rt && typeof rt === "object" && rt.Text) result.items.push({ text: String(rt.Text).slice(0, 200) });
    }
    return result;
  } catch (e: any) { return { source: "ddg_instant", query, error: e.message }; }
}

async function ddgSearch(query: string, n = 5): Promise<Record<string, any>> {
  try {
    const r = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": BROWSER_UA, "Referer": "https://duckduckgo.com/" },
      signal: AbortSignal.timeout(12000),
    });
    const html = await r.text();
    const titles   = [...html.matchAll(/class="result__a"[^>]*>([^<]+)/g)].map(m => m[1]).slice(0, n);
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)(?:<\/span>|$)/gs)].map(m => m[1]).slice(0, n);
    const items = snippets.map((s, i) => ({
      title:   titles[i]?.trim() || "",
      snippet: s.replace(/<[^>]+>/g, "").trim().slice(0, 280),
    })).filter(it => it.snippet);
    return { source: "ddg_search", query, items };
  } catch (e: any) { return { source: "ddg_search", query, error: e.message }; }
}

async function scrapeSocial(plat: string, url: string, handle: string): Promise<Record<string, any>> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(12000) });
    const html = await r.text();
    const d: Record<string, any> = { source: plat, handle, url };
    const desc = dnaMetaContent(html, "og:description");
    if (desc) d.description = desc.slice(0, 200);
    const title = dnaMetaContent(html, "og:title");
    if (title) d.display_name = title;
    if (plat === "instagram") {
      const fm = desc?.match(/([\d,.kKmM]+)\s*Followers/i);
      if (fm) d.followers = fm[1];
      const parts = desc?.split(" - ");
      if (parts && parts.length >= 2) d.bio = parts[parts.length - 1].slice(0, 200);
    }
    if (plat === "tiktok") {
      const fm = html.match(/"followerCount"\s*:\s*(\d+)/);
      if (fm) { const n = parseInt(fm[1]); d.followers = n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n); }
      const bm = html.match(/"signature"\s*:\s*"([^"]{1,300})"/);
      if (bm) d.bio = bm[1];
    }
    return d;
  } catch (e: any) { return { source: plat, handle, url, error: (e as any).message }; }
}

async function researchBrand(brand: string, domain: string, social: Record<string, string>): Promise<Record<string, any>> {
  const slug = brand.toLowerCase().replace(/\s/g, "").replace(/-/g, "").slice(0, 30);
  const ig = social.instagram || slug;
  const tt = social.tiktok    || slug;
  const fb = social.facebook  || slug;
  const li = social.linkedin  || slug;

  const [ddgGeneral, ddgAbout, ddgSocial, ddgReviews, ddgComp, instagram, tiktok, facebook, linkedin] = await Promise.allSettled([
    ddgInstant(`${brand} ${domain}`),
    ddgSearch(`"${brand}" empresa historia about`),
    ddgSearch(`"${brand}" instagram tiktok twitter redes sociales`),
    ddgSearch(`"${brand}" reviews opiniones clientes valoracion`),
    ddgSearch(`"${brand}" ${domain} competitors competencia`),
    scrapeSocial("instagram", `https://www.instagram.com/${ig}/`, ig),
    scrapeSocial("tiktok",    `https://www.tiktok.com/@${tt}`,    tt),
    scrapeSocial("facebook",  `https://www.facebook.com/${fb}`,   fb),
    scrapeSocial("linkedin",  `https://www.linkedin.com/company/${li}`, li),
  ]);

  const unwrap = (r: PromiseSettledResult<any>) => r.status === "fulfilled" ? r.value : { error: r.reason?.message };
  return {
    ddg_general:   unwrap(ddgGeneral),
    ddg_about:     unwrap(ddgAbout),
    ddg_social:    unwrap(ddgSocial),
    ddg_reviews:   unwrap(ddgReviews),
    ddg_competitors: unwrap(ddgComp),
    instagram:     unwrap(instagram),
    tiktok:        unwrap(tiktok),
    facebook:      unwrap(facebook),
    linkedin:      unwrap(linkedin),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE routes: /weblab/analyze  /weblab/improve  /weblab/proxy
// ─────────────────────────────────────────────────────────────────────────────

router.get("/weblab/proxy", async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) { res.status(400).json({ error: "url param required" }); return; }
  try {
    const r = await fetch(targetUrl, {
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,*/*" },
      signal: AbortSignal.timeout(14000),
    });
    const contentType = r.headers.get("content-type") || "text/html";
    res.set("Content-Type", contentType);
    res.set("Access-Control-Allow-Origin", "*");
    const body = await r.text();
    res.send(body);
  } catch (e: any) { res.status(502).json({ error: e.message }); }
});

router.post("/weblab/analyze", async (req: Request, res: Response): Promise<void> => {
  const { url: targetUrl, deep = true } = req.body as { url: string; deep?: boolean };
  if (!targetUrl) { res.status(400).json({ error: "url requerida" }); return; }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (obj: Record<string, any>) => {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {}
  };

  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 20000);

  try {
    send({ progress: `🌐 Descargando ${targetUrl}…`, status: "working" });

    let html = "";
    try {
      const r = await fetch(targetUrl, {
        headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,*/*" },
        signal: AbortSignal.timeout(14000),
      });
      html = await r.text();
    } catch (e: any) {
      send({ progress: `⚠ No se pudo descargar la página directamente: ${e.message}`, status: "warn" });
      try {
        const scraped = await scrapeWebsite(targetUrl);
        html = (scraped as any).html || "";
      } catch {}
    }

    if (!html) { send({ error: "No se pudo obtener el HTML de la URL proporcionada." }); res.end(); return; }
    send({ progress: `✓ HTML descargado (${Math.round(html.length / 1024)}KB)`, status: "done" });

    send({ progress: "🧬 Extrayendo DNA de la marca…", status: "working" });
    const dna = dnaExtractFromHtml(html, targetUrl);
    send({ progress: `✓ DNA extraído — Marca: ${dna.name || dna.domain || "?"} · Sector: ${dna.sector || "?"} · ${dna.palette?.length || 0} colores · ${dna.all_fonts?.length || 0} fuentes`, status: "done" });
    send({ dna });

    if (deep) {
      send({ progress: "🔍 Lanzando investigación paralela (DDG · IG · TT · FB · LinkedIn)…", status: "working" });
      const research = await researchBrand(dna.name || dna.domain || "", dna.domain || "", dna.social_handles || {});
      const sources = Object.values(research).filter((v: any) => !v.error).length;
      send({ progress: `✓ Investigación completada — ${sources}/9 fuentes con datos`, status: "done" });
      send({ research });
    }

    send({ done: true });
    res.end();
  } catch (e: any) {
    clearInterval(heartbeat);
    send({ error: e.message });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

router.post("/weblab/improve", async (req: Request, res: Response): Promise<void> => {
  const { dna = {}, research = {}, instructions } = req.body as { dna: Record<string, any>; research: Record<string, any>; instructions?: string };

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (obj: Record<string, any>) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {} };
  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 20000);

  try {
    // Summarize research into text snippets
    const lines: string[] = [];
    for (const [k, v] of Object.entries(research) as [string, any][]) {
      if (!v || v.error) continue;
      if (k === "ddg_general" && v.abstract) lines.push(`[DDG] ${v.abstract.slice(0, 350)}`);
      else if (["ddg_about","ddg_reviews","ddg_social","ddg_competitors"].includes(k)) {
        for (const it of (v.items || []).slice(0, 2)) if (it.snippet) lines.push(`[${k}] ${it.snippet.slice(0, 200)}`);
      } else if (["instagram","tiktok","facebook","linkedin"].includes(k)) {
        const parts = [`[${v.source?.toUpperCase()} @${v.handle || "?"}]`];
        if (v.followers) parts.push(`${v.followers} seguidores`);
        if (v.bio) parts.push(`bio: "${v.bio.slice(0, 120)}"`);
        if (parts.length > 1) lines.push(parts.join(" · "));
      }
    }

    const brand   = dna.name || dna.domain || "Brand";
    const palette = dna.palette || [dna.primary_color || "#6366f1"];
    const font    = dna.primary_font || "Inter";

    const systemPrompt = `Eres el mejor diseñador web del mundo. Generas HTML completo, standalone y ejecutable.

REGLAS ABSOLUTAS:
1. UN ÚNICO archivo HTML — CSS y JS inline. Funciona abriéndolo directamente en el navegador.
2. requestAnimationFrame para TODAS las animaciones.
3. will-change: transform en todos los elementos animados.
4. CSS custom properties para colores y tipografía en :root.
5. Responsive: mobile-first con media queries.
6. try/catch alrededor de cualquier librería CDN.
7. CERO placeholders, CERO "TODO" — contenido REAL de la marca.
8. Footer con links a redes sociales REALES si se proporcionan handles.
9. Meta viewport y charset correctos.`;

    const userPrompt = `Crea una landing page premium para la marca "${brand}".

═══ DNA ═══
Nombre: ${brand}
Dominio: ${dna.domain || ""}
Sector: ${dna.sector || "general"}
Tagline: ${(dna.tagline || "").slice(0, 180) || "no detectado"}
CTA: ${dna.cta || "Empezar ahora"}
Paleta: ${palette.slice(0, 6).join(", ")}
Fuente: ${font}
Logo URL: ${dna.logo_url || "no detectado — crea logotipo textual"}
Redes: ${JSON.stringify(dna.social_handles || {})}

═══ INVESTIGACIÓN ═══
${lines.slice(0, 14).join("\n") || "(sin datos de investigación)"}

═══ INSTRUCCIONES ═══
${instructions || "Diseño moderno, premium, con efectos visuales avanzados. Mantén identidad de marca pero eleva el nivel estético. Inspírate en Awwwards."}

═══ ESTRUCTURA ═══
1. HERO — animación de impacto (partículas canvas, gradiente, o Three.js mesh)
2. PROPUESTA DE VALOR — 3-4 cards glassmorphism o tilt 3D
3. SOCIAL PROOF — datos reales de redes si disponibles
4. CTA SECTION — efecto magnético (mousemove JS)
5. FOOTER — links reales a redes detectadas

Genera el HTML COMPLETO ahora:`;

    let baseURL: string | undefined;
    let apiKey: string | undefined;
    if (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
      apiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    } else {
      apiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (!apiKey) { send({ error: "API key de IA no configurada" }); res.end(); return; }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = baseURL ? new Anthropic({ baseURL, apiKey }) : new Anthropic({ apiKey });

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    send({ status: "streaming" });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send({ token: event.delta.text });
      }
    }

    send({ done: true });
    res.end();
  } catch (e: any) {
    clearInterval(heartbeat);
    send({ error: e.message });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

// ── Standalone Secrets Scanner (acepta HTML/código crudo sin URL) ──────────
router.post("/web-lab/scan-secrets", async (req: Request, res: Response): Promise<void> => {
  try {
    const { html, source, projectId, sourceUrl } = req.body as { html?: string; source?: string; projectId?: number; sourceUrl?: string };
    const content = html ?? source ?? "";
    if (!content.trim()) { res.status(400).json({ error: "Proporciona HTML, JS o código a analizar" }); return; }
    if (content.length > 5_000_000) { res.status(400).json({ error: "Contenido demasiado grande (máx 5 MB)" }); return; }

    const secrets = scanExposedSecrets(content);

    const summary = {
      total: secrets.length,
      critical: secrets.filter(s => s.severity === "critical").length,
      high: secrets.filter(s => s.severity === "high").length,
      medium: secrets.filter(s => s.severity === "medium").length,
      services: [...new Set(secrets.map(s => s.service))],
      riskScore: Math.max(0, 100
        - secrets.filter(s => s.severity === "critical").length * 30
        - secrets.filter(s => s.severity === "high").length * 15
        - secrets.filter(s => s.severity === "medium").length * 5
      ),
      scannedAt: new Date().toISOString(),
      contentLength: content.length,
    };

    // ── Persistir el escaneo de secretos en el vault (historial) ──
    let vaultId: number | null = null;
    const pid = projectId ? Number(projectId) : 0;
    if (pid && !isNaN(pid)) {
      try {
        const reportHtml = buildSecretsReportHtml(summary, secrets, sourceUrl);
        vaultId = await saveToVault({
          projectId: pid,
          fileType: "web-lab-report",
          category: "web-lab",
          title: `🕵️ Escaneo de Secretos${sourceUrl ? ` — ${sourceUrl}` : ""}`,
          description: `${summary.total} secretos expuestos (${summary.critical} críticos · ${summary.high} altos) · Riesgo ${summary.riskScore}/100`,
          originalUrl: sourceUrl || undefined,
          mimeType: "text/html",
          generatedBy: "web-lab-scan-secrets",
          content: reportHtml,
          metadata: { kind: "secrets-scan", scanUrl: sourceUrl, score: summary.riskScore, scannedAt: summary.scannedAt, template: "prestige" },
        });
      } catch (e) { logger.warn({ e }, "scan-secrets vault save failed"); }
    }

    res.json({ success: true, summary, secrets, vaultId });
  } catch (err: any) {
    logger.error({ err }, "Secrets scan failed");
    res.status(500).json({ error: err.message || "Error en el análisis de secretos" });
  }
});

// ═══════════════════════════════════════════════════════════════
// HTML REPORT BUILDERS — escaneos persistidos en el vault (historial)
// Producen un documento HTML autocontenido (tema oro/negro) que
// `download-report/:vaultId` sirve tal cual.
// ═══════════════════════════════════════════════════════════════
const SEV_COLOR: Record<string, string> = {
  critical: "#ff4d4d", high: "#ff9f40", medium: "#ffd24d", low: "#7fd4a0", info: "#8fb8ff",
};

function scanReportShell(title: string, subtitle: string, score: number, bodyHtml: string): string {
  const date = new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
  const sc = Math.max(0, Math.min(100, Math.round(score)));
  const scoreColor = sc >= 80 ? "#7fd4a0" : sc >= 50 ? "#ffd24d" : "#ff4d4d";
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0b0b0d;color:#e8e0d0;font-family:'Inter',sans-serif;line-height:1.7;font-size:14px}
  .wrap{max-width:900px;margin:0 auto;padding:48px 32px}
  .hero{text-align:center;padding:32px 0 40px;border-bottom:1px solid rgba(196,165,90,0.25);margin-bottom:32px}
  h1{font-family:'Playfair Display',serif;font-size:2rem;color:#c4a55a;margin-bottom:8px}
  .sub{color:#9a9080;font-size:13px;word-break:break-all}
  .score-badge{display:inline-flex;align-items:center;justify-content:center;width:120px;height:120px;border-radius:50%;border:4px solid ${scoreColor};margin:24px auto 8px;font-size:2.4rem;font-weight:700;color:${scoreColor};font-family:'Playfair Display',serif}
  h2{font-family:'Playfair Display',serif;font-size:1.4rem;color:#c4a55a;margin:2.2rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid rgba(196,165,90,0.25)}
  table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top}
  th{color:#c4a55a;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
  .ok{color:#7fd4a0}.no{color:#ff6b6b}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:1rem 0}
  .stat{background:rgba(196,165,90,0.06);border:1px solid rgba(196,165,90,0.18);border-radius:10px;padding:14px}
  .stat .n{font-size:1.6rem;font-weight:700;color:#e8d898;font-family:'Playfair Display',serif}
  .stat .l{font-size:11px;color:#9a9080;margin-top:2px}
  .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin:10px 0}
  .card .t{font-weight:600;color:#e8d898;margin-bottom:4px}
  .card .d{color:#c8c0b4;font-size:13px}
  .card .r{color:#9a9080;font-size:12px;margin-top:6px;font-style:italic}
  code{background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;font-size:12px;color:#d4b870;word-break:break-all}
  .empty{color:#7fd4a0;padding:14px;background:rgba(127,212,160,0.07);border-radius:10px;border:1px solid rgba(127,212,160,0.2)}
  .footer{text-align:center;color:#4a4038;font-size:12px;margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,0.05)}
  @media print{body{background:#fff;color:#000}h1,h2{color:#000}}
</style></head><body><div class="wrap">
  <div class="hero">
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">${escapeHtml(subtitle)}</div>
    <div class="score-badge">${sc}</div>
    <div class="sub">Puntuación · ${date}</div>
  </div>
  ${bodyHtml}
  <div class="footer">Generado por Shopy Crafter · Lab Web</div>
</div></body></html>`;
}

function buildDeepScanReportHtml(r: DeepScanResult): string {
  const sec = r.security;
  const dom = r.dom;
  const perf = r.performance;
  const seo = r.seo;
  const js = r.javascript;

  const headersRows = sec.headers.map(h =>
    `<tr><td>${escapeHtml(h.name)}</td>
      <td><span class="pill ${h.present ? "ok" : "no"}">${h.present ? "✓ Presente" : "✗ Ausente"}</span></td>
      <td style="color:${SEV_COLOR[h.severity] || "#aaa"}">${escapeHtml(h.severity)}</td>
      <td style="color:#9a9080">${escapeHtml(h.description)}</td></tr>`).join("");

  const vulnsHtml = sec.vulnerabilities.length
    ? sec.vulnerabilities.map(v =>
        `<div class="card"><div class="t" style="color:${SEV_COLOR[v.severity] || "#e8d898"}">${escapeHtml(v.type)} · ${escapeHtml(v.severity)}</div>
         <div class="d">${escapeHtml(v.description)}</div><div class="r">💡 ${escapeHtml(v.recommendation)}</div></div>`).join("")
    : `<div class="empty">✓ No se detectaron vulnerabilidades evidentes.</div>`;

  const secretsHtml = sec.exposedSecrets.length
    ? sec.exposedSecrets.map((s: any) =>
        `<div class="card"><div class="t" style="color:${SEV_COLOR[s.severity] || "#e8d898"}">${escapeHtml(s.service || s.type)} · ${escapeHtml(s.severity)}</div>
         <div class="d">${escapeHtml(s.description || s.match || "")}</div></div>`).join("")
    : `<div class="empty">✓ No se detectaron secretos expuestos en el HTML.</div>`;

  const perfHtml = perf.issues.length
    ? perf.issues.map(p =>
        `<div class="card"><div class="t" style="color:${SEV_COLOR[p.severity] || "#e8d898"}">${escapeHtml(p.type)} · ${escapeHtml(p.severity)}</div>
         <div class="d">${escapeHtml(p.detail)}</div></div>`).join("")
    : `<div class="empty">✓ Sin problemas de rendimiento destacables.</div>`;

  const a11yHtml = dom.accessibilityIssues.length
    ? dom.accessibilityIssues.map(a =>
        `<div class="card"><div class="t" style="color:${SEV_COLOR[a.severity] || "#e8d898"}">${escapeHtml(a.type)} (${a.count}) · ${escapeHtml(a.severity)}</div>
         <div class="d">${escapeHtml(a.detail)}</div></div>`).join("")
    : `<div class="empty">✓ Sin problemas de accesibilidad destacables.</div>`;

  const libsHtml = js.libraries.length
    ? `<div class="grid">${js.libraries.map(l => `<div class="stat"><div class="n" style="font-size:1.1rem">${escapeHtml(l.name)}${l.version ? ` <span style="font-size:.8rem;color:#9a9080">${escapeHtml(l.version)}</span>` : ""}</div><div class="l">${escapeHtml(l.category)}</div></div>`).join("")}</div>`
    : `<div class="empty">No se detectaron librerías JS conocidas.</div>`;

  const body = `
  <h2>🔒 Seguridad — ${sec.score}/100</h2>
  <div class="grid">
    <div class="stat"><div class="n">${sec.https ? "✓" : "✗"}</div><div class="l">HTTPS</div></div>
    <div class="stat"><div class="n">${sec.mixedContent ? "⚠️" : "✓"}</div><div class="l">Contenido mixto</div></div>
    <div class="stat"><div class="n">${sec.vulnerabilities.length}</div><div class="l">Vulnerabilidades</div></div>
    <div class="stat"><div class="n">${sec.exposedSecrets.length}</div><div class="l">Secretos expuestos</div></div>
  </div>
  ${sec.serverInfo ? `<p style="color:#9a9080">Servidor: <code>${escapeHtml(sec.serverInfo)}</code></p>` : ""}
  <h2>🛡️ Cabeceras de seguridad</h2>
  <table><thead><tr><th>Cabecera</th><th>Estado</th><th>Severidad</th><th>Descripción</th></tr></thead><tbody>${headersRows}</tbody></table>
  <h2>⚠️ Vulnerabilidades</h2>${vulnsHtml}
  <h2>🕵️ Secretos expuestos</h2>${secretsHtml}
  <h2>📐 DOM & Estructura</h2>
  <div class="grid">
    <div class="stat"><div class="n">${dom.totalElements}</div><div class="l">Elementos DOM</div></div>
    <div class="stat"><div class="n">${dom.maxDepth}</div><div class="l">Profundidad máx.</div></div>
    <div class="stat"><div class="n">${dom.images.withoutAlt}</div><div class="l">Imágenes sin alt</div></div>
    <div class="stat"><div class="n">${dom.links.total}</div><div class="l">Enlaces</div></div>
  </div>
  <h2>♿ Accesibilidad</h2>${a11yHtml}
  <h2>⚡ Rendimiento</h2>${perfHtml}
  <h2>🔎 SEO — ${seo.score}/100</h2>
  <div class="card"><div class="t">Título (${seo.titleLength}) · ${escapeHtml(seo.titleStatus)}</div><div class="d">${escapeHtml(seo.title || "—")}</div></div>
  <div class="card"><div class="t">Meta descripción (${seo.metaDescriptionLength}) · ${escapeHtml(seo.metaDescriptionStatus)}</div><div class="d">${escapeHtml(seo.metaDescription || "—")}</div></div>
  <h2>📚 Librerías JS</h2>${libsHtml}
  `;
  return scanReportShell(`🔒 Escaneo de Seguridad`, r.url, sec.score, body);
}

function buildSecretsReportHtml(
  summary: { total: number; critical: number; high: number; medium: number; services: string[]; riskScore: number; contentLength: number },
  secrets: Array<any>,
  sourceUrl?: string,
): string {
  const list = secrets.length
    ? secrets.map(s =>
        `<div class="card"><div class="t" style="color:${SEV_COLOR[s.severity] || "#e8d898"}">${escapeHtml(s.service || s.type || "Secreto")} · ${escapeHtml(s.severity)}</div>
         <div class="d">${escapeHtml(s.description || "")}</div>
         ${s.match ? `<div class="r">Coincidencia: <code>${escapeHtml(String(s.match).slice(0, 80))}</code></div>` : ""}
         ${s.recommendation ? `<div class="r">💡 ${escapeHtml(s.recommendation)}</div>` : ""}</div>`).join("")
    : `<div class="empty">✓ No se detectaron secretos ni credenciales expuestas en el contenido analizado.</div>`;

  const body = `
  <h2>📊 Resumen</h2>
  <div class="grid">
    <div class="stat"><div class="n">${summary.total}</div><div class="l">Secretos totales</div></div>
    <div class="stat"><div class="n" style="color:${SEV_COLOR.critical}">${summary.critical}</div><div class="l">Críticos</div></div>
    <div class="stat"><div class="n" style="color:${SEV_COLOR.high}">${summary.high}</div><div class="l">Altos</div></div>
    <div class="stat"><div class="n" style="color:${SEV_COLOR.medium}">${summary.medium}</div><div class="l">Medios</div></div>
  </div>
  ${summary.services.length ? `<p style="color:#9a9080">Servicios detectados: ${summary.services.map(s => `<code>${escapeHtml(s)}</code>`).join(" ")}</p>` : ""}
  <p style="color:#9a9080">Contenido analizado: ${summary.contentLength.toLocaleString("es-ES")} caracteres</p>
  <h2>🕵️ Hallazgos</h2>${list}
  `;
  return scanReportShell(`🕵️ Escaneo de Secretos`, sourceUrl || "Código / HTML pegado", summary.riskScore, body);
}

export default router;
