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
import { getReportShell } from "./exports.js";

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

  const productSampleHtml = research.productSample ? `
    <div class="section">
      <div class="section-title">Producto Optimizado por Shopy Crafter (Muestra)</div>
      <div class="ai-deliverable">
        <div class="ai-deliverable-header">Ejemplo de optimizacion completa aplicada a tu nicho</div>

        <div class="ai-field">
          <div class="ai-field-label">Titulo Optimizado</div>
          <div class="ai-field-value" style="font-size:17px;font-weight:700;">${esc(research.productSample.title)}</div>
        </div>

        <div class="ai-field">
          <div class="ai-field-label">Descripcion de Venta</div>
          <div class="ai-field-value">${esc(research.productSample.description)}</div>
        </div>

        <div class="highlight-box highlight-success">
          <div class="ai-field" style="margin-bottom:12px;">
            <div class="ai-field-label">SEO Title (Google)</div>
            <div class="ai-field-value" style="font-weight:600;">${esc(research.productSample.seoTitle)}</div>
          </div>
          <div class="ai-field" style="margin-bottom:0;">
            <div class="ai-field-label">SEO Description (Google)</div>
            <div class="ai-field-value">${esc(research.productSample.seoDescription)}</div>
          </div>
        </div>

        ${research.productSample.variants && research.productSample.variants.length > 0 ? `
        <div class="ai-field">
          <div class="ai-field-label">Variantes Configuradas</div>
          <div class="ai-field-value">
            ${research.productSample.variants.map(v =>
              `<span class="tag">${esc(v.option)}</span> <span class="muted">${v.values.map(val => esc(val)).join(" | ")}</span>`
            ).join("<br/>")}
          </div>
        </div>` : ""}

        <div class="ai-field">
          <div class="ai-field-label">Tags SEO</div>
          <div class="ai-field-value">${(research.productSample.tags || []).map(t => `<span class="tag tag-blue">${esc(t)}</span>`).join(" ")}</div>
        </div>

        <div class="ai-field">
          <div class="ai-field-label">Estrategia de Precio</div>
          <div class="ai-field-value">${esc(research.productSample.priceStrategy)}</div>
        </div>

        <div class="ai-field">
          <div class="ai-field-label">Mejoras que Aplicariamos (Impacto Estimado)</div>
          <div class="ai-field-value">${esc(research.productSample.improvementNotes)}</div>
        </div>

        <div class="highlight-box highlight-gold" style="text-align:center;margin-top:16px;">
          <strong>Este es solo 1 producto de muestra.</strong> Con Shopy Crafter, optimizamos TODO tu catalogo automaticamente.
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

    <div class="section">
      <div class="section-title">Investigacion del Negocio</div>
      <div class="card ai-deliverable">
        <div class="ai-deliverable-header">Analisis automatico con IA — datos reales verificados</div>
        ${mdToHtml(research.business)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Analisis de Mercado y Competencia</div>
      <div class="card ai-deliverable">
        <div class="ai-deliverable-header">Estudio del sector y posicionamiento competitivo</div>
        ${mdToHtml(research.market)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Auditoria SEO y Presencia Digital</div>
      <div class="card ai-deliverable">
        <div class="ai-deliverable-header">Rastreo de presencia digital, indexacion y keywords</div>
        ${mdToHtml(research.seo)}
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
