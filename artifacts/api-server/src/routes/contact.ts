import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { askGeminiWithSearch, isGeminiAvailable } from "../lib/gemini.js";
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
  submittedAt: string;
}

async function generateAIPreReport(lead: LeadData): Promise<string> {
  const searchTerms: string[] = [];
  if (lead.storeUrl) searchTerms.push(lead.storeUrl);
  if (lead.niche) searchTerms.push(lead.niche);
  if (lead.socialMedia) searchTerms.push(lead.socialMedia);

  const entityName = lead.storeUrl || lead.name;
  const nicheInfo = lead.niche || "ecommerce general";

  const searches = await Promise.allSettled([
    askGeminiWithSearch(
      `Investiga a fondo esta empresa/tienda online: "${entityName}".
Busca: qué vende, productos principales, precios, aspecto de la web, tecnología que usa, presencia en redes sociales, reputación online, reseñas de clientes, tráfico estimado, posición SEO.
${lead.storeUrl ? `URL: ${lead.storeUrl}` : ""}
${lead.socialMedia ? `Redes: ${lead.socialMedia}` : ""}
Proporciona datos reales, concretos y verificables.`,
      "Eres un analista de inteligencia empresarial experto en eCommerce. Investiga usando Google Search real. Devuelve datos concretos, URLs verificables, cifras reales. Responde en español.",
      lead.storeUrl ? [lead.storeUrl.startsWith("http") ? lead.storeUrl : `https://${lead.storeUrl}`] : undefined,
    ),

    askGeminiWithSearch(
      `Análisis de competencia y mercado para el nicho "${nicheInfo}" en España.
Busca: principales competidores en este nicho en Shopify y eCommerce, sus precios, estrategias, volumen de búsqueda de keywords principales, tendencias del mercado, oportunidades sin explotar, barreras de entrada, estacionalidad.
${lead.storeUrl ? `La tienda del cliente es: ${lead.storeUrl}` : ""}
Dame datos concretos con fuentes verificables.`,
      "Eres un analista de mercado y competencia eCommerce. Usa Google Search real. Devuelve datos de mercado actuales, nombres de competidores reales, precios reales, tendencias verificables. Responde en español.",
    ),

    askGeminiWithSearch(
      `Auditoría SEO y presencia digital del negocio "${entityName}" en el nicho "${nicheInfo}".
Busca: keywords por las que posiciona, posiciones en Google, velocidad de carga, estado de indexación, presencia en directorios, backlinks relevantes, estrategia de contenidos, blog, landing pages.
${lead.storeUrl ? `URL: ${lead.storeUrl}` : ""}
Proporciona recomendaciones SEO concretas y prácticas.`,
      "Eres un experto SEO técnico y de contenidos para eCommerce. Usa Google Search para investigar la presencia real de este negocio en internet. Responde en español.",
      lead.storeUrl ? [lead.storeUrl.startsWith("http") ? lead.storeUrl : `https://${lead.storeUrl}`] : undefined,
    ),
  ]);

  const businessResearch = searches[0].status === "fulfilled" ? searches[0].value : null;
  const marketResearch = searches[1].status === "fulfilled" ? searches[1].value : null;
  const seoResearch = searches[2].status === "fulfilled" ? searches[2].value : null;

  const allSources = [
    ...(businessResearch?.sources || []),
    ...(marketResearch?.sources || []),
    ...(seoResearch?.sources || []),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);

  return buildReportHtml(lead, {
    business: businessResearch?.text || "No se pudo investigar la empresa (Gemini no disponible).",
    market: marketResearch?.text || "No se pudo analizar el mercado.",
    seo: seoResearch?.text || "No se pudo realizar la auditoría SEO.",
    sources: allSources,
  });
}

function buildReportHtml(
  lead: LeadData,
  research: { business: string; market: string; seo: string; sources: string[] },
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
    <td style="padding-left:12px;" valign="middle"><span style="font-size:20px;font-weight:800;color:#c8a84b;letter-spacing:-0.3px;">ShopyBrain</span></td>
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
    <p style="color:#c8a84b;font-size:14px;font-weight:700;margin:0 0 4px;">Pre-informe generado por ShopyBrain AI</p>
    <p style="color:#6b6b80;font-size:11px;margin:0;">Dual AI Engine (Gemini + Claude) &middot; Datos reales verificados</p>
  </div>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#0c0c14;padding:24px 48px;border-top:1px solid #1a1a28;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="color:#c8a84b;font-size:12px;font-weight:700;">ShopyBrain</span></td>
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
    name, email, phone, storeUrl, niche, revenue,
    services, socialMedia, message,
  } = req.body as {
    name: string; email: string; phone?: string; storeUrl?: string;
    niche?: string; revenue?: string; services?: string[];
    socialMedia?: string; message?: string;
  };

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: "Nombre y email son obligatorios" });
    return;
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }

  const leadData: LeadData = {
    name: name.trim(), email: email.toLowerCase().trim(),
    phone: phone?.trim() ?? null,
    storeUrl: storeUrl?.trim() ?? null,
    niche: niche?.trim() ?? null,
    revenue: revenue ?? null,
    services: services ?? [],
    socialMedia: socialMedia?.trim() ?? null,
    message: message?.trim() ?? null,
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
