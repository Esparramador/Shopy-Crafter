import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { projectFilesTable } from "@workspace/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { askGeminiWithSearch, isGeminiAvailable } from "../lib/gemini.js";
import { askClaudeJsonWithBrain, askClaudeWithBrain } from "../lib/claude.js";
import { learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { requireAdmin } from "../lib/auth.js";
import { getReportShell } from "./exports.js";
import { generatePdfFromHtml } from "../lib/pdf-generator.js";

const router = Router();

const ADMIN_EMAIL = "craftershopy@gmail.com";

const contactRateMap = new Map<string, { count: number; resetAt: number }>();
function checkContactRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = contactRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    contactRateMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

interface LeadData {
  name: string;
  email: string;
  phone: string | null;
  storeUrl: string | null;
  niche: string | null;
  revenue: string | null;
  services: string[];
  socialMedia: string | null;
  message: string | null;
  extraInfo: string | null;
  productImageUrl: string | null;
  submittedAt: string;
  company?: string;
}

interface ProductSample {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  productType: string;
  variants?: { option: string; values: string[] }[];
  priceStrategy: string;
  improvementNotes: string;
  handle: string;
  vendor: string;
  seoKeywords: string[];
  schemaJsonLd: string;
  ogTitle: string;
  ogDescription: string;
  altText: string;
  faqItems?: { question: string; answer: string }[];
  generatedImagePrompt?: string;
}

function sanitizeAiHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<input[\s\S]*?>/gi, "")
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/<base[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "data-blocked:")
    .replace(/vbscript\s*:/gi, "");
}

async function structureResearchWithClaude(
  lead: LeadData,
  research: { business: string; market: string; seo: string },
): Promise<{ business: string; market: string; seo: string }> {
  const niche = lead.niche || "ecommerce general";
  const entityName = lead.storeUrl || lead.name;

  const structurePrompt = (sectionTitle: string, sectionIcon: string, rawText: string, specificInstructions: string) => `Eres el consultor estratégico senior de Shopy Crafter, agencia de optimización IA para e-commerce.

TIENES datos de investigación REALES sobre el negocio "${entityName}" (nicho: ${niche}).
Tu trabajo es REESTRUCTURAR estos datos en un informe de consultoría PROFESIONAL con HTML formateado.

DATOS DE INVESTIGACIÓN EN BRUTO:
${rawText.slice(0, 25000)}

${specificInstructions}

GENERA HTML profesional con EXACTAMENTE esta estructura (NO JSON, devuelve HTML directo):

<div class="ai-analysis">
  <div class="ai-diagnosis">
    <h3>${sectionIcon} ${sectionTitle} — Resumen Ejecutivo</h3>
    <p>[2-3 párrafos CONCISOS resumiendo los hallazgos clave. Usa datos CONCRETOS encontrados en la investigación. Menciona nombres reales de empresas, productos, URLs cuando los haya. Explica en lenguaje claro que cualquier persona entienda.]</p>
  </div>

  <div class="ai-actions">
    <h3>🎯 Hallazgos Clave y Oportunidades</h3>
    [GENERA 3-5 hallazgos, cada uno así:]
    <div class="action-item">
      <div class="action-header">
        <strong>[Hallazgo específico con datos concretos]</strong>
        <span class="action-impact">[CRÍTICO/ALTO/MEDIO]</span>
      </div>
      <p>[Explicación detallada del hallazgo con datos reales de la investigación]</p>
      <div class="ai-deliverable">
        [Recomendación concreta y accionable basada en este hallazgo — qué hacer exactamente]
      </div>
    </div>
  </div>

  <div class="ai-quick-wins">
    <h3>⚡ Oportunidades Inmediatas Detectadas</h3>
    <ol>
      <li><strong>[Oportunidad 1]:</strong> [Descripción concreta con datos]</li>
      <li><strong>[Oportunidad 2]:</strong> [Descripción concreta con datos]</li>
      <li><strong>[Oportunidad 3]:</strong> [Descripción concreta con datos]</li>
    </ol>
  </div>
</div>

REGLAS:
- USA SOLO datos REALES de la investigación proporcionada — NO inventes datos
- Mantén TODOS los nombres de empresas, URLs, cifras y datos concretos del texto original
- ESTRUCTURA la información — no la pierdas
- Usa las clases CSS exactas indicadas (action-item, action-header, action-impact, ai-deliverable, ai-diagnosis, ai-quick-wins)
- Responde en español
- NO incluyas texto fuera de las etiquetas HTML
- NO uses markdown, SOLO HTML con las clases indicadas`;

  const [businessResult, marketResult, seoResult] = await Promise.allSettled([
    askClaudeWithBrain(
      0,
      [{ role: "user", content: structurePrompt(
        "Análisis del Negocio", "🏢",
        research.business,
        `FOCO: Analiza la presencia online, productos, precios, tecnología, reputación y fortalezas/debilidades del negocio "${entityName}".`
      )}],
      "Eres un consultor de inteligencia empresarial de Shopy Crafter. Reestructuras datos de investigación en informes profesionales con HTML formateado. Responde SOLO con HTML usando las clases CSS indicadas.",
      "general",
      niche,
      16000,
    ),
    askClaudeWithBrain(
      0,
      [{ role: "user", content: structurePrompt(
        "Análisis de Mercado y Competencia", "📊",
        research.market,
        `FOCO: Analiza competidores, tendencias del mercado, oportunidades, pricing del sector y posicionamiento competitivo en el nicho "${niche}".`
      )}],
      "Eres un analista de mercado y competencia de Shopy Crafter. Reestructuras datos de investigación en informes profesionales con HTML formateado. Responde SOLO con HTML usando las clases CSS indicadas.",
      "general",
      niche,
      16000,
    ),
    askClaudeWithBrain(
      0,
      [{ role: "user", content: structurePrompt(
        "Auditoría SEO y Presencia Digital", "🔍",
        research.seo,
        `FOCO: Analiza posicionamiento SEO, keywords, velocidad de carga, indexación, backlinks, Core Web Vitals y oportunidades de contenido para "${entityName}".`
      )}],
      "Eres un experto SEO técnico de Shopy Crafter. Reestructuras datos de investigación en informes profesionales con HTML formateado. Responde SOLO con HTML usando las clases CSS indicadas.",
      "seo",
      niche,
      16000,
    ),
  ]);

  const extractHtml = (result: PromiseSettledResult<string>, fallbackText: string): string => {
    if (result.status !== "fulfilled" || !result.value) return fallbackText;
    const sanitized = sanitizeAiHtml(result.value);
    const match = sanitized.match(/<div class="ai-analysis">[\s\S]*$/);
    return match ? match[0] : `<div class="ai-analysis">${sanitized}</div>`;
  };

  return {
    business: extractHtml(businessResult, research.business),
    market: extractHtml(marketResult, research.market),
    seo: extractHtml(seoResult, research.seo),
  };
}

async function generateProductSample(lead: LeadData): Promise<ProductSample | null> {
  if (!lead.productImageUrl && !lead.storeUrl) return null;
  try {
    const nicheInfo = lead.niche || "ecommerce general";
    const extraContext = lead.extraInfo ? `\nInformacion extra del negocio: ${lead.extraInfo}` : "";
    const imageContext = lead.productImageUrl
      ? `El cliente ha proporcionado una imagen de producto: ${lead.productImageUrl}`
      : `Analiza la tienda ${lead.storeUrl} y elige un producto representativo para optimizar.`;

    const isServiceBusiness = !lead.productImageUrl && (
      nicheInfo.toLowerCase().includes("servicio") ||
      nicheInfo.toLowerCase().includes("consultor") ||
      nicheInfo.toLowerCase().includes("agencia") ||
      nicheInfo.toLowerCase().includes("coaching") ||
      nicheInfo.toLowerCase().includes("formacion") ||
      nicheInfo.toLowerCase().includes("software") ||
      nicheInfo.toLowerCase().includes("saas") ||
      nicheInfo.toLowerCase().includes("digital") ||
      nicheInfo.toLowerCase().includes("marketing") ||
      nicheInfo.toLowerCase().includes("diseno") ||
      nicheInfo.toLowerCase().includes("fotograf") ||
      nicheInfo.toLowerCase().includes("limpieza") ||
      nicheInfo.toLowerCase().includes("reparacion") ||
      nicheInfo.toLowerCase().includes("salud") ||
      nicheInfo.toLowerCase().includes("belleza") ||
      nicheInfo.toLowerCase().includes("peluquer") ||
      nicheInfo.toLowerCase().includes("fitness") ||
      nicheInfo.toLowerCase().includes("yoga") ||
      nicheInfo.toLowerCase().includes("clinica") ||
      nicheInfo.toLowerCase().includes("abogad") ||
      nicheInfo.toLowerCase().includes("legal") ||
      nicheInfo.toLowerCase().includes("contab") ||
      nicheInfo.toLowerCase().includes("inmobiliar")
    );

    const imageGenInstruction = isServiceBusiness
      ? `\n- generatedImagePrompt: Prompt DETALLADO en ingles (100-150 palabras) para generar una imagen profesional de marketing que represente este servicio/negocio. Incluir: estilo fotografico (profesional, minimalista, corporativo), elementos visuales clave, paleta de colores sugerida, composicion, ambiente. Ejemplo: "Professional minimalist photograph of a modern coworking space with natural lighting, clean white desks, laptop computers, potted plants, soft warm tones, bokeh background, corporate branding style, high-end commercial photography"`
      : `\n- generatedImagePrompt: Prompt DETALLADO en ingles (100-150 palabras) para generar una imagen de producto profesional para ecommerce. Incluir: tipo de fotografia (producto aislado, lifestyle, flatlay), fondo, iluminacion, angulo, estilo visual. Ejemplo: "Professional product photography of premium organic cotton t-shirt, clean white background, studio lighting, 45-degree angle, folded neatly, lifestyle elements, high-end ecommerce style"`;

    const sample = await askClaudeJsonWithBrain(
      0,
      `${imageContext}
Nicho: ${nicheInfo}. Facturacion: ${lead.revenue || "No especificada"}.${extraContext}
${isServiceBusiness ? "IMPORTANTE: Este negocio vende SERVICIOS, no productos fisicos. Adapta el producto como un 'paquete de servicio' o 'plan' con estructura profesional de pricing." : ""}

Genera un producto/servicio de muestra COMPLETAMENTE OPTIMIZADO para Shopify con TODOS los campos SEO al 100%. Incluye:
- title: Titulo SEO optimizado (50-65 chars, keywords naturales, incluir marca si aplica)
- description: Descripcion de venta persuasiva (200-400 palabras con beneficios, caracteristicas, materiales/metodologia, casos de uso, storytelling, bullet points HTML)
- seoTitle: Meta title para Google (max 60 chars, keyword principal al inicio, marca al final)
- seoDescription: Meta description para Google (max 155 chars, con CTA, keyword, beneficio principal)
- handle: URL slug optimizado SEO (kebab-case, sin acentos, keywords, max 60 chars). Ejemplo: "camiseta-algodon-organico-premium"
- vendor: Nombre de marca/empresa del lead
- tags: Array de 10-15 tags relevantes (nicho, material, uso, estilo, temporada, ubicacion, tipo)
- productType: Tipo de producto/servicio
- seoKeywords: Array de 8-10 keywords de cola larga que deberia posicionar este producto (con volumen estimado)
- variants: Array de variantes segun nicho. ROPA: [{option:"Talla",values:["XS","S","M","L","XL","XXL"]},{option:"Color",values:["Negro","Blanco","Azul Marino"]}]. CALZADO: tallas 36-46. SERVICIOS: [{option:"Plan",values:["Basico","Profesional","Premium"]},{option:"Duracion",values:["1 mes","3 meses","6 meses"]}]
- priceStrategy: Estrategia de precio con margen estimado, pricing psicologico, y comparativa sector
- improvementNotes: 5 mejoras concretas con impacto estimado en conversion/ventas
- schemaJsonLd: Codigo Schema.org JSON-LD COMPLETO para este producto (Product o Service schema con name, description, offers, aggregateRating, brand, sku). Devuelve como STRING.
- ogTitle: Titulo Open Graph para redes sociales (max 65 chars, atractivo, con emoji si aplica)
- ogDescription: Descripcion Open Graph (max 200 chars, con CTA y beneficio)
- altText: Alt text optimizado para la imagen principal (descriptivo, con keyword, max 125 chars)
- faqItems: Array de 3-5 preguntas frecuentes [{question:"...", answer:"..."}] relevantes para este producto/servicio (para FAQ Schema)${imageGenInstruction}

Responde SOLO con JSON valido.`,
      `Eres el motor de inteligencia artificial de Shopy Crafter. Generas productos Shopify optimizados profesionalmente al 100/100 en SEO score. Cada campo debe ser de calidad profesional lista para publicar. Incluye TODOS los campos de metadatos SEO de Shopify: meta title, meta description, handle, Schema JSON-LD, Open Graph, alt texts, FAQ schema. Los variantes deben ser especificos del nicho. Para negocios de SERVICIOS, crea paquetes/planes con pricing estructurado. Responde en espanol.`,
      "general",
      nicheInfo,
    );
    return sample as ProductSample;
  } catch (err) {
    logger.warn({ err }, "Product sample generation failed (non-critical)");
    return null;
  }
}

async function generateAIPreReport(lead: LeadData): Promise<string> {
  const entityName = lead.storeUrl || lead.name;
  const nicheInfo = lead.niche || "ecommerce general";
  const extraContext = lead.extraInfo ? `\nInformacion adicional del negocio: ${lead.extraInfo}` : "";

  const searches = await Promise.allSettled([
    askGeminiWithSearch(
      `Investiga a fondo esta empresa/tienda online: "${entityName}".
Busca: que vende, productos principales, precios, aspecto de la web, tecnologia que usa, presencia en redes sociales, reputacion online, resenas de clientes, trafico estimado, posicion SEO.
${lead.storeUrl ? `URL: ${lead.storeUrl}` : ""}
${lead.socialMedia ? `Redes: ${lead.socialMedia}` : ""}${extraContext}
Si es una tienda de ropa/moda, investiga: tallas disponibles, colores, materiales, politica de devoluciones, tabla de tallas, shipping.
Si es alimentacion: certificaciones, ingredientes, formatos, peso, alergenos.
Si es joyeria: materiales, piedras, certificaciones, personalizacion.
Proporciona datos reales, concretos y verificables.`,
      "Eres un analista de inteligencia empresarial experto en eCommerce. Investiga usando Google Search real. Devuelve datos concretos, URLs verificables, cifras reales. Analiza los atributos de producto especificos del nicho (tallas, colores, materiales, pesos, etc). Responde en espanol.",
      lead.storeUrl ? [lead.storeUrl.startsWith("http") ? lead.storeUrl : `https://${lead.storeUrl}`] : undefined,
    ),

    askGeminiWithSearch(
      `Analisis de competencia y mercado para el nicho "${nicheInfo}" en Espana.
Busca: principales competidores en este nicho en Shopify y eCommerce, sus precios, estrategias, volumen de busqueda de keywords principales, tendencias del mercado, oportunidades sin explotar, barreras de entrada, estacionalidad.
${lead.storeUrl ? `La tienda del cliente es: ${lead.storeUrl}` : ""}${extraContext}
Dame datos concretos con fuentes verificables.
Incluye analisis de: pricing medio del sector, margenes tipicos, coste de adquisicion de cliente (CAC), lifetime value (LTV), tasa de conversion media del sector.`,
      "Eres un analista de mercado y competencia eCommerce. Usa Google Search real. Devuelve datos de mercado actuales, nombres de competidores reales, precios reales, tendencias verificables. Incluye metricas financieras del sector. Responde en espanol.",
    ),

    askGeminiWithSearch(
      `Auditoria SEO y presencia digital del negocio "${entityName}" en el nicho "${nicheInfo}".
Busca: keywords por las que posiciona, posiciones en Google, velocidad de carga, estado de indexacion, presencia en directorios, backlinks relevantes, estrategia de contenidos, blog, landing pages.
${lead.storeUrl ? `URL: ${lead.storeUrl}` : ""}
Proporciona recomendaciones SEO concretas y practicas.
Incluye: schema markup recomendado, Core Web Vitals estimados, oportunidades de contenido, keywords de cola larga con volumen estimado.`,
      "Eres un experto SEO tecnico y de contenidos para eCommerce. Usa Google Search para investigar la presencia real de este negocio en internet. Incluye datos tecnicos como schema markup, Core Web Vitals y oportunidades de keywords. Responde en espanol.",
      lead.storeUrl ? [lead.storeUrl.startsWith("http") ? lead.storeUrl : `https://${lead.storeUrl}`] : undefined,
    ),

    generateProductSample(lead),
  ]);

  const businessResearch = searches[0].status === "fulfilled" ? searches[0].value : null;
  const marketResearch = searches[1].status === "fulfilled" ? searches[1].value : null;
  const seoResearch = searches[2].status === "fulfilled" ? searches[2].value : null;
  const productSample = searches[3].status === "fulfilled" ? (searches[3].value as ProductSample | null) : null;

  const allSources = [
    ...((businessResearch as any)?.sources || []),
    ...((marketResearch as any)?.sources || []),
    ...((seoResearch as any)?.sources || []),
  ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).slice(0, 20);

  try {
    learnFromOperation({
      operationType: "lead_prereport",
      title: `Pre-informe lead: ${lead.name} (${lead.niche || "general"}) - ${lead.storeUrl || "sin URL"}`,
      content: `Lead: ${lead.name}, Email: ${lead.email}, Nicho: ${lead.niche}, Facturacion: ${lead.revenue}, Servicios: ${(lead.services || []).join(", ")}, URL: ${lead.storeUrl || "N/A"}, Redes: ${lead.socialMedia || "N/A"}, Info extra: ${lead.extraInfo || "N/A"}`,
      confidence: 0.8,
      tags: ["lead", "prereport", lead.niche || "general"],
    });

    if (businessResearch && (businessResearch as any)?.text) {
      learnFromOperation({
        operationType: "lead_business_intel",
        niche: lead.niche || undefined,
        title: `Intel empresa: ${entityName} (${lead.niche || "general"})`,
        content: ((businessResearch as any).text as string).slice(0, 6000),
        confidence: 0.82,
        tags: ["lead_research", "business_intel", lead.niche || "general", entityName],
      });
    }

    if (marketResearch && (marketResearch as any)?.text) {
      learnFromOperation({
        operationType: "lead_market_intel",
        niche: lead.niche || undefined,
        title: `Intel mercado: nicho ${lead.niche || "general"} — fuentes lead ${lead.name}`,
        content: ((marketResearch as any).text as string).slice(0, 6000),
        confidence: 0.82,
        tags: ["lead_research", "market_intel", lead.niche || "general"],
      });
    }

    if (seoResearch && (seoResearch as any)?.text) {
      learnFromOperation({
        operationType: "seo",
        niche: lead.niche || undefined,
        title: `SEO audit lead: ${entityName} (${lead.storeUrl || "sin URL"})`,
        content: ((seoResearch as any).text as string).slice(0, 6000),
        confidence: 0.80,
        tags: ["lead_research", "seo_audit", lead.niche || "general"],
      });
    }

    if (lead.socialMedia?.trim()) {
      learnFromOperation({
        operationType: "lead_social_intel",
        niche: lead.niche || undefined,
        title: `Social media lead: ${lead.name} — ${lead.socialMedia.slice(0, 80)}`,
        content: `Lead ${lead.name} proporcionó redes sociales: ${lead.socialMedia}. Nicho: ${lead.niche || "general"}. URL tienda: ${lead.storeUrl || "N/A"}. Facturación: ${lead.revenue || "N/A"}.`,
        confidence: 0.75,
        tags: ["lead", "social_media", lead.niche || "general"],
      });
    }
  } catch {};

  const rawBusiness = (businessResearch as any)?.text || "";
  const rawMarket = (marketResearch as any)?.text || "";
  const rawSeo = (seoResearch as any)?.text || "";

  let structuredResearch: { business: string; market: string; seo: string };
  try {
    if (rawBusiness || rawMarket || rawSeo) {
      structuredResearch = await structureResearchWithClaude(lead, {
        business: rawBusiness || "No se pudo investigar la empresa.",
        market: rawMarket || "No se pudo analizar el mercado.",
        seo: rawSeo || "No se pudo realizar la auditoría SEO.",
      });
    } else {
      structuredResearch = {
        business: "No se pudo investigar la empresa (Gemini no disponible).",
        market: "No se pudo analizar el mercado.",
        seo: "No se pudo realizar la auditoría SEO.",
      };
    }
  } catch (err) {
    logger.warn({ err }, "Claude restructuring failed, using raw Gemini text");
    structuredResearch = {
      business: rawBusiness || "No se pudo investigar la empresa.",
      market: rawMarket || "No se pudo analizar el mercado.",
      seo: rawSeo || "No se pudo realizar la auditoría SEO.",
    };
  }

  return buildReportHtml(lead, {
    business: structuredResearch.business,
    market: structuredResearch.market,
    seo: structuredResearch.seo,
    sources: allSources,
    productSample,
    isStructuredHtml: !!(rawBusiness || rawMarket || rawSeo),
  });
}

function buildReportHtml(
  lead: LeadData,
  research: { business: string; market: string; seo: string; sources: string[]; productSample?: ProductSample | null; isStructuredHtml?: boolean },
): string {
  const esc = sanitizeHtml;

  function safeUrl(url: string): string {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return u.href;
    } catch {}
    return "#";
  }

  function mdToHtml(text: string): string {
    const escaped = esc(text);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, '<h4 class="ai-sub-heading">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="ai-heading">$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="ai-list">${match}</ul>`)
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");
  }

  const renderContent = (text: string): string => {
    if (research.isStructuredHtml && text.includes('class="ai-')) {
      return text;
    }
    return mdToHtml(text);
  };

  const servicesHtml = lead.services.length > 0
    ? lead.services.map(s => `<span class="tag">${esc(s)}</span>`).join("")
    : '<span class="muted">No especificados</span>';

  const storeLink = lead.storeUrl
    ? `<a href="${safeUrl(lead.storeUrl)}" class="link">${esc(lead.storeUrl)}</a>`
    : "—";

  const leadRows = [
    ["Nombre", esc(lead.name)],
    ["Email", `<a href="mailto:${esc(lead.email)}" class="link">${esc(lead.email)}</a>`],
    ["Telefono", esc(lead.phone || "—")],
    ["Tienda", storeLink],
    ["Nicho", esc(lead.niche || "—")],
    ["Facturacion", esc(lead.revenue || "—")],
    ["Redes Sociales", esc(lead.socialMedia || "—")],
    ["Servicios Solicitados", servicesHtml],
    ["Mensaje", `<em>"${esc(lead.message || "—")}"</em>`],
  ];
  if (lead.extraInfo) leadRows.push(["Info Adicional", esc(lead.extraInfo)]);
  if (lead.productImageUrl) leadRows.push(["Imagen Producto", `<a href="${safeUrl(lead.productImageUrl)}" class="link">${esc(lead.productImageUrl)}</a>`]);

  const leadTableHtml = leadRows.map(([label, value]) =>
    `<tr><td class="table-label">${label}</td><td class="table-value">${value}</td></tr>`
  ).join("");

  const sourcesHtml = research.sources.length > 0
    ? research.sources.map(s => `<li><a href="${safeUrl(s)}" class="link" style="word-break:break-all;">${esc(s)}</a></li>`).join("")
    : "<li class=\"muted\">Sin fuentes verificadas</li>";

  const ps = research.productSample;
  const productSampleHtml = ps ? `
    <div class="section" style="page-break-before:always;">
      <div class="section-title">Producto Optimizado por Shopy Crafter — Score SEO 100/100</div>
      <div class="card" style="padding:28px;">
        <div class="ai-deliverable">
          <div class="ai-deliverable-header">Producto/Servicio de muestra optimizado al 100% para tu nicho</div>

          <div class="ai-field">
            <div class="ai-field-label">Titulo Optimizado (Shopify Title)</div>
            <div class="ai-field-value" style="font-size:17px;font-weight:700;">${esc(ps.title)}</div>
          </div>

          <div class="ai-field">
            <div class="ai-field-label">URL Handle (Slug SEO)</div>
            <div class="ai-field-value"><code style="background:rgba(196,149,106,.1);color:#c4956a;padding:4px 10px;border-radius:4px;font-size:13px;">/${esc(ps.handle || "producto-optimizado")}</code></div>
          </div>

          <div class="ai-field">
            <div class="ai-field-label">Descripcion de Venta (Shopify Body HTML)</div>
            <div class="ai-field-value" style="line-height:1.8;">${esc(ps.description)}</div>
          </div>

          <div class="highlight-box highlight-success" style="margin:16px 0;">
            <div style="font-size:11px;font-weight:700;color:#34d399;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Metadatos SEO — Google Search</div>
            <div class="ai-field" style="margin-bottom:12px;">
              <div class="ai-field-label">Meta Title (max 60 chars)</div>
              <div class="ai-field-value" style="font-weight:600;color:#34d399;">${esc(ps.seoTitle)}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;">${(ps.seoTitle || "").length} caracteres</div>
            </div>
            <div class="ai-field" style="margin-bottom:12px;">
              <div class="ai-field-label">Meta Description (max 155 chars)</div>
              <div class="ai-field-value" style="color:#34d399;">${esc(ps.seoDescription)}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;">${(ps.seoDescription || "").length} caracteres</div>
            </div>
            <div class="ai-field" style="margin-bottom:0;">
              <div class="ai-field-label">Alt Text Imagen Principal</div>
              <div class="ai-field-value" style="color:#34d399;">${esc(ps.altText || "")}</div>
            </div>
          </div>

          <div class="highlight-box" style="background:rgba(107,168,240,.06);border:1px solid rgba(107,168,240,.2);margin:16px 0;">
            <div style="font-size:11px;font-weight:700;color:#6ba8f0;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Open Graph — Redes Sociales</div>
            <div class="ai-field" style="margin-bottom:8px;">
              <div class="ai-field-label">OG Title</div>
              <div class="ai-field-value" style="color:#6ba8f0;">${esc(ps.ogTitle || ps.seoTitle || "")}</div>
            </div>
            <div class="ai-field" style="margin-bottom:0;">
              <div class="ai-field-label">OG Description</div>
              <div class="ai-field-value" style="color:#6ba8f0;">${esc(ps.ogDescription || ps.seoDescription || "")}</div>
            </div>
          </div>

          ${ps.variants && ps.variants.length > 0 ? `
          <div class="ai-field">
            <div class="ai-field-label">Variantes Configuradas (Shopify Variants)</div>
            <div class="ai-field-value">
              ${ps.variants.map(v =>
                `<span class="tag">${esc(v.option)}</span> <span class="muted">${v.values.map(val => esc(val)).join(" | ")}</span>`
              ).join("<br/>")}
            </div>
          </div>` : ""}

          <div class="ai-field">
            <div class="ai-field-label">Vendor / Marca</div>
            <div class="ai-field-value">${esc(ps.vendor || lead.name)}</div>
          </div>

          <div class="ai-field">
            <div class="ai-field-label">Product Type</div>
            <div class="ai-field-value">${esc(ps.productType)}</div>
          </div>

          <div class="ai-field">
            <div class="ai-field-label">Tags SEO (Shopify Tags)</div>
            <div class="ai-field-value">${(ps.tags || []).map(t => `<span class="tag tag-blue">${esc(t)}</span>`).join(" ")}</div>
          </div>

          ${ps.seoKeywords && ps.seoKeywords.length > 0 ? `
          <div class="ai-field">
            <div class="ai-field-label">Keywords de Cola Larga (Target SEO)</div>
            <div class="ai-field-value">${ps.seoKeywords.map(k => `<span class="tag" style="background:rgba(52,211,153,.08);color:#34d399;border-color:rgba(52,211,153,.15);">${esc(k)}</span>`).join(" ")}</div>
          </div>` : ""}

          <div class="ai-field">
            <div class="ai-field-label">Estrategia de Precio</div>
            <div class="ai-field-value">${esc(ps.priceStrategy)}</div>
          </div>

          <div class="ai-field">
            <div class="ai-field-label">Mejoras que Aplicariamos (Impacto Estimado)</div>
            <div class="ai-field-value">${esc(ps.improvementNotes)}</div>
          </div>

          ${ps.schemaJsonLd ? `
          <div class="ai-field">
            <div class="ai-field-label">Schema JSON-LD (Structured Data para Google)</div>
            <div class="ai-field-value">
              <code>${esc(typeof ps.schemaJsonLd === "string" ? ps.schemaJsonLd : JSON.stringify(ps.schemaJsonLd, null, 2))}</code>
            </div>
          </div>` : ""}

          ${ps.faqItems && ps.faqItems.length > 0 ? `
          <div class="ai-field">
            <div class="ai-field-label">FAQ Schema (Preguntas Frecuentes)</div>
            <div class="ai-field-value">
              ${ps.faqItems.map(faq => `
                <div style="margin-bottom:12px;padding:12px 16px;background:rgba(196,149,106,.04);border-radius:8px;border-left:3px solid rgba(196,149,106,.3);">
                  <div style="font-weight:600;color:rgba(255,255,255,.9);margin-bottom:4px;">Q: ${esc(faq.question)}</div>
                  <div style="color:rgba(255,255,255,.7);font-size:13px;">A: ${esc(faq.answer)}</div>
                </div>
              `).join("")}
            </div>
          </div>` : ""}

          ${ps.generatedImagePrompt ? `
          <div class="highlight-box" style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);margin-top:16px;">
            <div style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Imagen AI Generada para este Producto/Servicio</div>
            <div style="font-size:12px;color:rgba(255,255,255,.6);line-height:1.6;">Prompt de generacion: <em>"${esc(ps.generatedImagePrompt)}"</em></div>
            <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:8px;">Con Shopy Crafter generamos imagenes profesionales AI para cada producto de tu catalogo</div>
          </div>` : ""}

          <div class="highlight-box highlight-gold" style="text-align:center;margin-top:20px;">
            <strong>Este es solo 1 producto de muestra optimizado al 100/100.</strong><br/>
            <span style="font-size:12px;">Con Shopy Crafter, optimizamos TODO tu catalogo automaticamente con IA: meta titles, descriptions, Schema JSON-LD, Open Graph, alt texts, variantes y keywords.</span>
          </div>
        </div>
      </div>
    </div>` : "";

  const body = `
    <div class="metric-row">
      <div class="metric"><div class="value">${esc(lead.niche || "E-commerce")}</div><div class="label">Sector / Nicho</div></div>
      <div class="metric"><div class="value">${esc(lead.revenue || "—")}</div><div class="label">Facturacion</div></div>
      <div class="metric"><div class="value">${lead.services.length}</div><div class="label">Servicios Solicitados</div></div>
      <div class="metric"><div class="value">${research.sources.length}</div><div class="label">Fuentes Verificadas</div></div>
    </div>

    <div class="section">
      <div class="section-title">Datos del Lead</div>
      <div class="card">
        <table class="data-table" width="100%">
          ${leadTableHtml}
        </table>
      </div>
    </div>

    <div class="section" style="page-break-before:always;">
      <div class="section-title">Investigacion del Negocio</div>
      <div class="card" style="padding:28px;line-height:1.85;font-size:13px;">
        ${renderContent(research.business)}
      </div>
      <div style="margin-top:8px;padding:8px 16px;background:rgba(196,149,106,.04);border-radius:8px;font-size:11px;color:rgba(255,255,255,.35);">
        Analisis generado por Shopy Crafter AI · Datos reales verificados con fuentes publicas
      </div>
    </div>

    <div class="section" style="page-break-before:always;">
      <div class="section-title">Analisis de Mercado y Competencia</div>
      <div class="card" style="padding:28px;line-height:1.85;font-size:13px;">
        ${renderContent(research.market)}
      </div>
      <div style="margin-top:8px;padding:8px 16px;background:rgba(196,149,106,.04);border-radius:8px;font-size:11px;color:rgba(255,255,255,.35);">
        Estudio de mercado por Shopy Crafter AI · Sector y posicionamiento competitivo
      </div>
    </div>

    <div class="section" style="page-break-before:always;">
      <div class="section-title">Auditoria SEO y Presencia Digital</div>
      <div class="card" style="padding:28px;line-height:1.85;font-size:13px;">
        ${renderContent(research.seo)}
      </div>
      <div style="margin-top:8px;padding:8px 16px;background:rgba(196,149,106,.04);border-radius:8px;font-size:11px;color:rgba(255,255,255,.35);">
        Auditoria SEO por Shopy Crafter AI · Presencia digital y oportunidades de posicionamiento
      </div>
    </div>

    ${productSampleHtml}

    <div class="section">
      <div class="section-title">Fuentes Verificadas</div>
      <div class="card">
        <ul class="ai-list">${sourcesHtml}</ul>
      </div>
    </div>

    <div class="section">
      <div class="card" style="text-align:center;padding:28px;">
        <p class="muted" style="margin:0 0 4px;font-size:11px;">Generado por</p>
        <p style="margin:0;font-weight:700;font-size:15px;">Shopy Crafter AI</p>
        <p class="muted" style="margin:4px 0 0;font-size:11px;">Dual AI Engine (Gemini + Claude) &middot; Datos reales verificados</p>
      </div>
    </div>`;

  const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const shell = getReportShell("prestige");
  return shell(
    "Pre-Informe AI de Lead",
    `${esc(lead.name)} — ${esc(lead.niche || "Shopify Store")}`,
    body,
    date,
    esc(lead.name),
  );
}

router.post("/contact", async (req, res): Promise<void> => {
  const {
    name, email, phone, storeUrl, niche, customNiche, revenue,
    services, socialMedia, message, extraInfo, productImageUrl,
  } = req.body as {
    name: string; email: string; phone?: string; storeUrl?: string;
    niche?: string; customNiche?: string; revenue?: string; services?: string[];
    socialMedia?: string; message?: string; extraInfo?: string;
    productImageUrl?: string;
  };

  const ip = req.ip ?? "unknown";
  if (!checkContactRateLimit(ip)) {
    res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde." });
    return;
  }

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: "Nombre y email son obligatorios" });
    return;
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    res.status(400).json({ error: "Email invalido" });
    return;
  }

  const resolvedNiche = (niche === "Otro" && customNiche?.trim()) ? customNiche.trim() : (niche?.trim() ?? null);

  const leadData: LeadData = {
    name: name.trim(), email: email.toLowerCase().trim(),
    phone: phone?.trim() ?? null,
    storeUrl: storeUrl?.trim() ?? null,
    niche: resolvedNiche,
    revenue: revenue ?? null,
    services: services ?? [],
    socialMedia: socialMedia?.trim() ?? null,
    message: message?.trim() ?? null,
    extraInfo: extraInfo?.trim() ?? null,
    productImageUrl: productImageUrl?.trim() ?? null,
    submittedAt: new Date().toISOString(),
  };

  await db.insert(auditLogTable).values({
    id: randomBytes(8).toString("hex"),
    userId: "public",
    action: "lead_form_submitted",
    details: JSON.stringify(leadData),
    ipAddress: req.ip ?? "unknown",
  }).catch(() => {});

  res.json({ success: true, message: "¡Solicitud recibida! Estamos analizando tu negocio con IA. Recibirás noticias nuestras muy pronto." });

  (async () => {
    try {
      logger.info({ name: leadData.name, email: leadData.email }, "Starting AI pre-report generation for lead");

      let reportHtml: string;
      if (isGeminiAvailable()) {
        reportHtml = await generateAIPreReport(leadData);
      } else {
        reportHtml = buildReportHtml(leadData, {
          business: "Gemini no está configurado — no se pudo realizar investigación automática.",
          market: "Gemini no está configurado.",
          seo: "Gemini no está configurado.",
          sources: [],
        });
      }

      let savedFileId: number | null = null;
      try {
        const htmlBuffer = Buffer.from(reportHtml, "utf-8");
        const dateStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
        const timeStr = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
        const [saved] = await db.insert(projectFilesTable).values({
          projectId: null,
          fileType: "report",
          category: "lead_prereport",
          title: `Pre-Informe AI — ${leadData.name} — ${leadData.niche || "eCommerce"}`,
          description: `Pre-informe generado automáticamente el ${dateStr} a las ${timeStr} para el lead ${leadData.name} (${leadData.email})`,
          objectPath: null,
          originalUrl: null,
          mimeType: "text/html",
          fileSizeBytes: htmlBuffer.length,
          productId: null,
          productTitle: null,
          generatedBy: "lead_contact_form",
          metadata: JSON.stringify({
            generatedAt: new Date().toISOString(),
            leadEmail: leadData.email,
            leadName: leadData.name,
            leadNiche: leadData.niche,
            leadRevenue: leadData.revenue,
            leadStoreUrl: leadData.storeUrl,
            leadPhone: leadData.phone,
            leadServices: leadData.services,
          }),
          content: reportHtml,
          isPublic: 0,
          entityName: leadData.name,
          entityUrl: leadData.storeUrl || leadData.email,
        }).returning();
        savedFileId = saved.id;
        logger.info({ fileId: saved.id, leadName: leadData.name, sizeKB: Math.round(htmlBuffer.length / 1024) }, "Pre-report saved to vault");
      } catch (saveErr) {
        logger.error({ err: saveErr }, "Failed to save pre-report to vault (non-critical)");
      }

      if (isGmailAvailable()) {
        const subject = `Nuevo Lead: ${leadData.name} — ${leadData.niche || "eCommerce"} — Pre-Informe AI`;
        const sent = await sendEmail(ADMIN_EMAIL, subject, reportHtml);
        if (sent) {
          logger.info({ to: ADMIN_EMAIL, lead: leadData.email }, "Pre-report email sent to admin");
        } else {
          logger.error({ to: ADMIN_EMAIL }, "Failed to send pre-report email");
        }
      } else {
        logger.warn("Gmail not available — pre-report NOT sent by email");
      }

      await db.insert(auditLogTable).values({
        id: randomBytes(8).toString("hex"),
        userId: "system",
        action: "lead_prereport_generated",
        details: JSON.stringify({
          leadEmail: leadData.email,
          leadName: leadData.name,
          emailSent: isGmailAvailable(),
          geminiUsed: isGeminiAvailable(),
          savedFileId,
          generatedAt: new Date().toISOString(),
        }),
        ipAddress: "system",
      }).catch(() => {});
    } catch (err) {
      logger.error({ err, lead: leadData.email }, "Background AI pre-report generation failed");
    }
  })();

  const klaviyoKey = process.env.KLAVIYO_API_KEY;
  if (klaviyoKey) {
    try {
      await fetch("https://a.klaviyo.com/api/events/", {
        method: "POST",
        headers: getKlaviyoHeaders(),
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              properties: { ...leadData, servicesStr: (services ?? []).join(", ") },
              metric: { data: { type: "metric", attributes: { name: "Lead Form Submitted" } } },
              profile: {
                data: {
                  type: "profile",
                  attributes: {
                    email: leadData.email,
                    first_name: leadData.name.split(" ")[0],
                    last_name: leadData.name.split(" ").slice(1).join(" ") || "",
                    phone_number: leadData.phone ?? undefined,
                    properties: {
                      storeUrl: leadData.storeUrl,
                      niche: leadData.niche,
                      revenue: leadData.revenue,
                      services: Array.isArray(leadData.services) ? leadData.services.join(", ") : (leadData.services ?? ""),
                      source: "Landing Form",
                    },
                  },
                },
              },
            },
          },
        }),
      });
    } catch (err) {
      logger.warn({ err }, "Klaviyo lead event failed (non-critical)");
    }
  }
});

router.get("/leads", requireAdmin, async (req, res): Promise<void> => {
  const { pool } = await import("@workspace/db");
  const result = await pool.query(
    `SELECT id, details, created_at FROM audit_log WHERE action = 'lead_form_submitted' ORDER BY created_at DESC LIMIT 100`
  );
  const leads = result.rows.map((r: { id: string; details: string; created_at: string }) => ({
    id: r.id,
    ...JSON.parse(r.details),
    createdAt: r.created_at,
  }));
  res.json(leads);
});

router.get("/lead-reports", requireAdmin, async (req, res): Promise<void> => {
  const reports = await db.select({
    id: projectFilesTable.id,
    title: projectFilesTable.title,
    description: projectFilesTable.description,
    fileSizeBytes: projectFilesTable.fileSizeBytes,
    entityName: projectFilesTable.entityName,
    entityUrl: projectFilesTable.entityUrl,
    metadata: projectFilesTable.metadata,
    createdAt: projectFilesTable.createdAt,
  })
    .from(projectFilesTable)
    .where(and(
      eq(projectFilesTable.category, "lead_prereport"),
      isNull(projectFilesTable.projectId),
    ))
    .orderBy(desc(projectFilesTable.createdAt))
    .limit(200);

  const parsed = reports.map(r => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    downloadUrl: `/api/lead-reports/${r.id}/download`,
    downloadPdfUrl: `/api/lead-reports/${r.id}/download?format=pdf`,
  }));
  res.json(parsed);
});

router.get("/lead-reports/:fileId/download", requireAdmin, async (req, res): Promise<void> => {
  const fileId = parseInt(String(req.params.fileId), 10);
  if (isNaN(fileId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [file] = await db.select().from(projectFilesTable)
    .where(and(
      eq(projectFilesTable.id, fileId),
      eq(projectFilesTable.category, "lead_prereport"),
      isNull(projectFilesTable.projectId),
    ))
    .limit(1);

  if (!file) { res.status(404).json({ error: "Pre-informe no encontrado" }); return; }

  if (!file.content) { res.status(410).json({ error: "Contenido no disponible" }); return; }

  const safeName = (file.entityName || "Lead").replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_").slice(0, 80);
  const dateSlug = new Date(file.createdAt || Date.now()).toISOString().split("T")[0];
  const filename = `PreInforme_${safeName}_${dateSlug}`;

  const format = (req.query.format as string || "").toLowerCase();
  if (format === "pdf") {
    try {
      await generatePdfFromHtml(file.content, filename, res);
    } catch (e: any) {
      res.status(500).json({ error: `Error generando PDF: ${e.message}` });
    }
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
  res.send(file.content);
});

export default router;
