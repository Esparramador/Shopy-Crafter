import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { askGeminiWithSearch, isGeminiAvailable } from "../lib/gemini.js";
import { askClaudeJsonWithBrain } from "../lib/claude.js";
import { learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const ADMIN_EMAIL = "craftershopy@gmail.com";

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
}

async function generateProductSample(lead: LeadData): Promise<ProductSample | null> {
  if (!lead.productImageUrl && !lead.storeUrl) return null;
  try {
    const nicheInfo = lead.niche || "ecommerce general";
    const extraContext = lead.extraInfo ? `\nInformacion extra del negocio: ${lead.extraInfo}` : "";
    const imageContext = lead.productImageUrl
      ? `El cliente ha proporcionado una imagen de producto: ${lead.productImageUrl}`
      : `Analiza la tienda ${lead.storeUrl} y elige un producto representativo para optimizar.`;

    const sample = await askClaudeJsonWithBrain(
      2,
      `${imageContext}
Nicho: ${nicheInfo}. Facturacion: ${lead.revenue || "No especificada"}.${extraContext}

Genera un producto de muestra COMPLETAMENTE OPTIMIZADO para esta tienda. Incluye:
- title: Titulo SEO optimizado (60-70 chars, keywords naturales)
- description: Descripcion de venta persuasiva (150-300 palabras con beneficios, caracteristicas tecnicas, materiales, casos de uso)
- seoTitle: Meta title para Google (max 60 chars)
- seoDescription: Meta description para Google (max 155 chars, con CTA)
- tags: Array de 8-12 tags relevantes (incluir nicho, material, uso, estilo, temporada)
- productType: Tipo de producto
- variants: Array de variantes relevantes segun el nicho. Para ROPA incluir [{option:"Talla",values:["XS","S","M","L","XL","XXL"]},{option:"Color",values:["Negro","Blanco","Azul Marino"]},{option:"Material",values:["Algodon organico","Poliester reciclado"]}]. Para CALZADO incluir tallas de pie (36-46). Para JOYERIA incluir tallas de anillo, tipo de metal. Para ALIMENTACION incluir peso/formato. Adaptar 100% al nicho real.
- priceStrategy: Estrategia de precio recomendada con margen estimado
- improvementNotes: 3-5 mejoras concretas que aplicariamos con datos de impacto estimado en ventas

Responde SOLO con JSON valido.`,
      `Eres ShopyBrain, el motor de inteligencia artificial de Shopy Crafter. Generas productos Shopify optimizados profesionalmente. Cada campo debe ser de calidad profesional lista para publicar. Los variantes deben ser especificos del nicho (tallas para ropa, numeros de pie para calzado, colores reales, materiales reales, pesos para alimentacion, etc). Responde en espanol.`,
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
        content: ((businessResearch as any).text as string).slice(0, 2000),
        confidence: 0.82,
        tags: ["lead_research", "business_intel", lead.niche || "general", entityName],
      });
    }

    if (marketResearch && (marketResearch as any)?.text) {
      learnFromOperation({
        operationType: "lead_market_intel",
        niche: lead.niche || undefined,
        title: `Intel mercado: nicho ${lead.niche || "general"} — fuentes lead ${lead.name}`,
        content: ((marketResearch as any).text as string).slice(0, 2000),
        confidence: 0.82,
        tags: ["lead_research", "market_intel", lead.niche || "general"],
      });
    }

    if (seoResearch && (seoResearch as any)?.text) {
      learnFromOperation({
        operationType: "seo",
        niche: lead.niche || undefined,
        title: `SEO audit lead: ${entityName} (${lead.storeUrl || "sin URL"})`,
        content: ((seoResearch as any).text as string).slice(0, 2000),
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

  return buildReportHtml(lead, {
    business: (businessResearch as any)?.text || "No se pudo investigar la empresa (Gemini no disponible).",
    market: (marketResearch as any)?.text || "No se pudo analizar el mercado.",
    seo: (seoResearch as any)?.text || "No se pudo realizar la auditoria SEO.",
    sources: allSources,
    productSample,
  });
}

function buildReportHtml(
  lead: LeadData,
  research: { business: string; market: string; seo: string; sources: string[]; productSample?: ProductSample | null },
): string {
  const esc = sanitizeHtml;

  function safeUrl(url: string): string {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return u.href;
    } catch {}
    return "#";
  }

  const servicesHtml = lead.services.length > 0
    ? lead.services.map(s => `<span style="display:inline-block;background:rgba(200,168,75,.06);color:#c8a84b;padding:4px 12px;border-radius:6px;font-size:12px;margin:2px 4px;border:1px solid rgba(200,168,75,.15);font-weight:600;">${esc(s)}</span>`).join("")
    : '<span style="color:#6b6b80;">No especificados</span>';

  const sourcesHtml = research.sources.length > 0
    ? research.sources.map(s => `<li style="margin-bottom:4px;"><a href="${safeUrl(s)}" style="color:#4a9eff;font-size:12px;word-break:break-all;">${esc(s)}</a></li>`).join("")
    : "<li>Sin fuentes verificadas</li>";

  function mdToHtml(text: string): string {
    const escaped = esc(text);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, '<h4 style="color:#e6c668;margin:16px 0 8px;">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="color:#e6c668;margin:20px 0 10px;">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 style="color:#e6c668;margin:24px 0 12px;">$1</h2>')
      .replace(/^- (.+)$/gm, '<li style="margin-bottom:4px;">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul style="margin:8px 0;padding-left:20px;">${match}</ul>`)
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");
  }

  const storeLink = lead.storeUrl
    ? `<a href="${safeUrl(lead.storeUrl)}" style="color:#4a9eff;text-decoration:none;">${esc(lead.storeUrl)}</a>`
    : "—";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#08080e;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#08080e;padding:24px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="background:#101018;border-radius:16px;overflow:hidden;">

<!-- HEADER -->
<tr><td style="background:linear-gradient(160deg,#0e0e18,#12121f,#0a0a14);padding:40px 48px 36px;position:relative;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="44" valign="top"><div style="width:40px;height:40px;background:linear-gradient(135deg,#c8a84b,#8b6914);border-radius:10px;text-align:center;line-height:40px;font-size:20px;font-weight:900;color:#0a0a0f;">S</div></td>
    <td style="padding-left:12px;" valign="middle"><span style="font-size:20px;font-weight:800;color:#c8a84b;letter-spacing:-0.3px;">Shopy Crafter</span></td>
    <td align="right" valign="top">
      <div style="background:#16161f;border:1px solid #24243a;border-radius:8px;padding:8px 16px;display:inline-block;">
        <div style="font-size:9px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;">Pre-Informe AI</div>
        <div style="font-size:12px;color:#f0f0f5;font-weight:600;margin-top:2px;">${new Date().toLocaleString("es-ES", { dateStyle: "long" })}</div>
      </div>
    </td>
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td>
    <h1 style="color:#f0f0f5;font-size:26px;font-weight:900;margin:0 0 4px;letter-spacing:-0.5px;">Nuevo Lead: ${esc(lead.name)}</h1>
    <p style="color:#9494a8;font-size:14px;margin:0;">${esc(lead.company || lead.niche || "Shopify Store")}</p>
  </td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>
    <td><span style="font-size:11px;color:#6b6b80;">&#9679; Generado por IA</span></td>
    <td><span style="font-size:11px;color:#6b6b80;">&#9679; Datos verificados</span></td>
    <td><span style="font-size:11px;color:#6b6b80;">&#9679; Confidencial</span></td>
  </tr></table>
</td></tr>

<!-- LEAD DATA CARD -->
<tr><td style="padding:32px 48px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td>
    <div style="display:inline-block;width:28px;height:28px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);border-radius:7px;text-align:center;line-height:28px;font-size:14px;vertical-align:middle;">&#128100;</div>
    <span style="font-size:16px;font-weight:700;color:#f0f0f5;vertical-align:middle;margin-left:10px;">Datos del Lead</span>
  </td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#16161f;border:1px solid #1a1a28;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;width:130px;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Nombre</td>
      <td style="color:#f0f0f5;font-size:14px;font-weight:600;padding:14px 20px;border-bottom:1px solid #1a1a28;">${esc(lead.name)}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Email</td>
      <td style="padding:14px 20px;border-bottom:1px solid #1a1a28;"><a href="mailto:${esc(lead.email)}" style="color:#3b82f6;text-decoration:none;font-size:14px;font-weight:500;">${esc(lead.email)}</a></td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Telefono</td>
      <td style="color:#f0f0f5;font-size:14px;padding:14px 20px;border-bottom:1px solid #1a1a28;">${esc(lead.phone || "—")}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Tienda</td>
      <td style="padding:14px 20px;border-bottom:1px solid #1a1a28;">${storeLink}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Nicho</td>
      <td style="color:#f0f0f5;font-size:14px;padding:14px 20px;border-bottom:1px solid #1a1a28;">${esc(lead.niche || "—")}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Facturacion</td>
      <td style="color:#f0f0f5;font-size:14px;padding:14px 20px;border-bottom:1px solid #1a1a28;">${esc(lead.revenue || "—")}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Redes</td>
      <td style="color:#f0f0f5;font-size:14px;padding:14px 20px;border-bottom:1px solid #1a1a28;">${esc(lead.socialMedia || "—")}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-bottom:1px solid #1a1a28;">Servicios</td>
      <td style="padding:14px 20px;border-bottom:1px solid #1a1a28;">${servicesHtml}</td>
    </tr>
    <tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;">Mensaje</td>
      <td style="color:#9494a8;font-size:14px;padding:14px 20px;line-height:1.6;font-style:italic;">"${esc(lead.message || "—")}"</td>
    </tr>
    ${lead.extraInfo ? `<tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-top:1px solid #1a1a28;">Info Extra</td>
      <td style="color:#d0d0dd;font-size:13px;padding:14px 20px;line-height:1.6;border-top:1px solid #1a1a28;">${esc(lead.extraInfo)}</td>
    </tr>` : ""}
    ${lead.productImageUrl ? `<tr>
      <td style="color:#6b6b80;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding:14px 20px;vertical-align:top;border-top:1px solid #1a1a28;">Img Producto</td>
      <td style="padding:14px 20px;border-top:1px solid #1a1a28;"><a href="${safeUrl(lead.productImageUrl)}" style="color:#3b82f6;font-size:12px;word-break:break-all;">${esc(lead.productImageUrl)}</a></td>
    </tr>` : ""}
  </table>
</td></tr>

<!-- SECTION 1: Business Research -->
<tr><td style="padding:32px 48px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td>
    <div style="display:inline-block;width:28px;height:28px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:7px;text-align:center;line-height:28px;font-size:14px;vertical-align:middle;">&#128269;</div>
    <span style="font-size:16px;font-weight:700;color:#f0f0f5;vertical-align:middle;margin-left:10px;">1. Investigacion del Negocio</span>
  </td></tr></table>
  <div style="background:#101018;border:1px solid #1a1a28;border-radius:12px;padding:28px 28px;">
    <div style="color:#d0d0dd;font-size:14px;line-height:1.8;">${mdToHtml(research.business)}</div>
  </div>
</td></tr>

<!-- SECTION 2: Market Analysis -->
<tr><td style="padding:28px 48px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td>
    <div style="display:inline-block;width:28px;height:28px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:7px;text-align:center;line-height:28px;font-size:14px;vertical-align:middle;">&#128200;</div>
    <span style="font-size:16px;font-weight:700;color:#f0f0f5;vertical-align:middle;margin-left:10px;">2. Analisis de Mercado y Competencia</span>
  </td></tr></table>
  <div style="background:#101018;border:1px solid #1a1a28;border-radius:12px;padding:28px 28px;">
    <div style="color:#d0d0dd;font-size:14px;line-height:1.8;">${mdToHtml(research.market)}</div>
  </div>
</td></tr>

<!-- SECTION 3: SEO Audit -->
<tr><td style="padding:28px 48px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td>
    <div style="display:inline-block;width:28px;height:28px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);border-radius:7px;text-align:center;line-height:28px;font-size:14px;vertical-align:middle;">&#128640;</div>
    <span style="font-size:16px;font-weight:700;color:#f0f0f5;vertical-align:middle;margin-left:10px;">3. Auditoria SEO y Presencia Digital</span>
  </td></tr></table>
  <div style="background:#101018;border:1px solid #1a1a28;border-radius:12px;padding:28px 28px;">
    <div style="color:#d0d0dd;font-size:14px;line-height:1.8;">${mdToHtml(research.seo)}</div>
  </div>
</td></tr>

${research.productSample ? `
<!-- SECTION 4: Product Sample by ShopyBrain -->
<tr><td style="padding:28px 48px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td>
    <div style="display:inline-block;width:28px;height:28px;background:rgba(200,168,75,.15);border:1px solid rgba(200,168,75,.3);border-radius:7px;text-align:center;line-height:28px;font-size:14px;vertical-align:middle;">&#10024;</div>
    <span style="font-size:16px;font-weight:700;color:#f0f0f5;vertical-align:middle;margin-left:10px;">4. Producto Optimizado por Shopy Crafter (Muestra)</span>
  </td></tr></table>
  <div style="background:linear-gradient(135deg,#101018,#14141f);border:1px solid rgba(200,168,75,.2);border-radius:12px;padding:28px;overflow:hidden;">
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(200,168,75,.1);">
      <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Titulo optimizado</div>
      <div style="font-size:18px;font-weight:700;color:#f0f0f5;line-height:1.3;">${esc(research.productSample.title)}</div>
    </div>
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(200,168,75,.1);">
      <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Descripcion de venta</div>
      <div style="font-size:14px;color:#d0d0dd;line-height:1.7;">${esc(research.productSample.description)}</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(52,211,153,.05);border:1px solid rgba(52,211,153,.15);border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid rgba(52,211,153,.1);">
          <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1px;">SEO Title (Google)</div>
          <div style="font-size:13px;color:#34d399;font-weight:600;margin-top:4px;">${esc(research.productSample.seoTitle)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1px;">SEO Description (Google)</div>
          <div style="font-size:13px;color:#34d399;margin-top:4px;">${esc(research.productSample.seoDescription)}</div>
        </td>
      </tr>
    </table>
    ${research.productSample.variants && research.productSample.variants.length > 0 ? `
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(200,168,75,.1);">
      <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Variantes configuradas</div>
      ${research.productSample.variants.map(v => `
        <div style="margin-bottom:8px;">
          <span style="display:inline-block;background:rgba(200,168,75,.1);color:#e6c668;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;margin-right:8px;border:1px solid rgba(200,168,75,.2);">${esc(v.option)}</span>
          <span style="font-size:12px;color:#9494a8;">${v.values.map(val => esc(val)).join(" | ")}</span>
        </div>
      `).join("")}
    </div>
    ` : ""}
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(200,168,75,.1);">
      <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Tags SEO</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${(research.productSample.tags || []).map(t => `<span style="display:inline-block;background:rgba(74,158,221,.08);color:#4a9eff;padding:3px 10px;border-radius:12px;font-size:11px;border:1px solid rgba(74,158,221,.15);">${esc(t)}</span>`).join("")}
      </div>
    </div>
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(200,168,75,.1);">
      <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Estrategia de precio</div>
      <div style="font-size:13px;color:#d0d0dd;line-height:1.6;">${esc(research.productSample.priceStrategy)}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#6b6b80;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Mejoras que aplicariamos (impacto estimado)</div>
      <div style="font-size:13px;color:#d0d0dd;line-height:1.7;">${esc(research.productSample.improvementNotes)}</div>
    </div>
    <div style="margin-top:20px;background:rgba(200,168,75,.06);border:1px solid rgba(200,168,75,.15);border-radius:8px;padding:14px;text-align:center;">
      <div style="font-size:11px;color:#c8a84b;font-weight:600;">Este es solo 1 producto de muestra. Con Shopy Crafter, optimizamos TODO tu catalogo automaticamente.</div>
    </div>
  </div>
</td></tr>
` : ""}

<!-- SOURCES -->
<tr><td style="padding:28px 48px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td>
    <div style="display:inline-block;width:28px;height:28px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);border-radius:7px;text-align:center;line-height:28px;font-size:14px;vertical-align:middle;">&#128279;</div>
    <span style="font-size:16px;font-weight:700;color:#f0f0f5;vertical-align:middle;margin-left:10px;">Fuentes Verificadas</span>
  </td></tr></table>
  <div style="background:#101018;border:1px solid #1a1a28;border-radius:12px;padding:20px 28px;">
    <ul style="margin:0;padding-left:16px;list-style:none;">${research.sources.length > 0
      ? research.sources.map(s => `<li style="margin-bottom:6px;padding:4px 0;"><span style="color:#c8a84b;margin-right:8px;">&#8594;</span><a href="${safeUrl(s)}" style="color:#3b82f6;font-size:12px;word-break:break-all;text-decoration:none;">${esc(s)}</a></li>`).join("")
      : '<li style="color:#6b6b80;">Sin fuentes verificadas</li>'}</ul>
  </div>
</td></tr>

<!-- AI BADGE -->
<tr><td style="padding:32px 48px;">
  <div style="background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.15);border-radius:12px;padding:24px;text-align:center;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#c8a84b,#8b6914);border-radius:8px;margin:0 auto 12px;text-align:center;line-height:36px;font-size:18px;font-weight:900;color:#0a0a0f;">S</div>
    <p style="color:#c8a84b;font-size:14px;font-weight:700;margin:0 0 4px;">Pre-informe generado por Shopy Crafter AI</p>
    <p style="color:#6b6b80;font-size:11px;margin:0;">Dual AI Engine (Gemini + Claude) &middot; Datos reales verificados</p>
  </div>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#0c0c14;padding:24px 48px;border-top:1px solid #1a1a28;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="color:#c8a84b;font-size:12px;font-weight:700;">Shopy Crafter</span></td>
    <td align="right"><span style="color:#6b6b80;font-size:10px;">&copy; ${new Date().getFullYear()} &middot; Confidencial</span></td>
  </tr></table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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

export default router;
