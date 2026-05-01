import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { projectFilesTable } from "@workspace/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import multer from "multer";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { askGeminiWithSearch, isGeminiAvailable } from "../lib/gemini.js";
import { askClaudeJsonWithBrain, askClaudeWithBrain, askClaudeVisionWithBrain } from "../lib/claude.js";
import { learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { requireAdmin } from "../lib/auth.js";
import { getReportShell } from "./exports.js";
import { generatePdfFromHtml } from "../lib/pdf-generator.js";
import juice from "juice";
import { enableLongRunning } from "../lib/long-running.js";
import { safeDownloadReplicateImageAsDataUri } from "../lib/safe-image-fetch.js";

const router = Router();
const contactUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

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

/**
 * Genera una foto profesional REAL del producto/servicio para el pre-informe
 * de la landing pública usando Replicate (Flux 1.1 Pro — calidad fotográfica
 * premium, ~$0.04/img).
 *
 * Best-effort: si REPLICATE_API_TOKEN no está, si Replicate falla, o si el
 * prompt está vacío → devuelve null y el HTML del pre-informe cae al
 * placeholder con emoji que ya existía. NUNCA lanza para no romper /api/contact.
 *
 * Cascada de modelos: flux-1.1-pro (premium) → flux-schnell (rápido y barato)
 * → nano-banana (último recurso). Esto reproduce la estrategia de la chatbot
 * tools y garantiza una imagen incluso bajo carga/quotas.
 */
async function generateProductPhotoFromPrompt(prompt: string | null | undefined): Promise<string | null> {
  if (!prompt || typeof prompt !== "string") return null;
  const cleaned = prompt.trim();
  if (cleaned.length < 20) return null;

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    logger.warn({}, "[contact] REPLICATE_API_TOKEN no configurado — pre-informe sin imagen IA");
    return null;
  }

  function extractUrl(val: unknown): string | null {
    if (!val) return null;
    if (typeof val === "string" && val.startsWith("http")) return val;
    if (Array.isArray(val) && val.length > 0) return extractUrl(val[0]);
    if (typeof val === "object") {
      const o = val as Record<string, unknown>;
      if (typeof o.url === "function") {
        try { const u = (val as { url: () => { href: string } }).url(); return u?.href ?? String(u); } catch { /* ignore */ }
      }
      if (typeof o.url === "string" && (o.url as string).startsWith("http")) return o.url as string;
      const s = String(val);
      if (s.startsWith("http")) return s;
    }
    return null;
  }

  const cascade: Array<{ model: `${string}/${string}`; input: Record<string, unknown> }> = [
    { model: "black-forest-labs/flux-1.1-pro", input: { prompt: cleaned, width: 1024, height: 1024, num_outputs: 1, output_format: "jpg", output_quality: 92 } },
    { model: "black-forest-labs/flux-schnell", input: { prompt: cleaned, num_outputs: 1, aspect_ratio: "1:1", output_format: "jpg", output_quality: 90, num_inference_steps: 4 } },
    { model: "google/nano-banana", input: { prompt: cleaned, output_format: "jpg" } },
  ];

  // El hardening anti-SSRF / MIME / size / timeout / redirects vive ahora en
  // el helper compartido `safeDownloadReplicateImageAsDataUri`. Lo reusan tanto
  // este endpoint público (contact.ts) como el motor principal de imágenes
  // (images.ts), garantizando que CUALQUIER imagen que descarguemos de
  // Replicate pasa por las mismas validaciones de producción.
  try {
    const Replicate = (await import("replicate")).default;
    const replicate = new Replicate({ auth: token });

    for (const step of cascade) {
      // Cancelación REAL de la inferencia (architect-PASS): el SDK de Replicate
      // acepta `signal` que llama internamente a `predictions.cancel(id)` si el
      // controller aborta. Esto evita "jobs zombies" y coste residual cuando
      // expiramos por timeout en lugar de abandonar la promesa silenciosamente.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new Error(`Timeout ${step.model} 75s`)), 75_000);
      try {
        const out = await replicate.run(step.model, { input: step.input, signal: ctrl.signal });
        const url = extractUrl(out);
        if (!url) {
          logger.warn({ model: step.model }, "[contact] no URL extraída — fallback al siguiente modelo");
          continue;
        }

        // Descarga validada + data:URI. El helper aplica TODA la cadena de
        // hardening (allowlist host, manual redirects, MIME allowlist, cap
        // 4MB con cutoff, timeout 25s).
        try {
          const r = await safeDownloadReplicateImageAsDataUri(url, { tag: "[contact]", maxBytes: 4 * 1024 * 1024 });
          logger.info({ model: step.model, sizeKB: r.sizeKB, mime: r.mime }, "[contact] ✅ pre-informe product photo generated (embedded as data URI)");
          return r.dataUri;
        } catch (embedErr: any) {
          // Si no podemos embeber con seguridad, mejor devolver null que
          // arriesgar inyectar HTML/contenido no validado en email del admin.
          // El placeholder emoji 🛍️ es preferible a un payload sospechoso.
          logger.warn({ model: step.model, err: embedErr?.message }, "[contact] embed bloqueado por validación — descartado");
          continue;
        }
      } catch (err: any) {
        logger.warn({ model: step.model, err: err?.message, aborted: ctrl.signal.aborted }, "[contact] modelo falló — siguiente cascada");
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "[contact] generateProductPhotoFromPrompt totalmente falló");
  }
  return null;
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

async function analyzeProductImageWithVision(imageDataUrl: string, niche: string): Promise<string> {
  try {
    const match = imageDataUrl.match(/^data:image\/([\w+]+);base64,(.+)$/);
    if (!match) return "";
    const rawType = match[1] === "jpg" ? "jpeg" : match[1];
    const mediaType = `image/${rawType}` as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    const base64 = match[2];

    const visionResult = await askClaudeVisionWithBrain(
      0,
      `Analiza esta imagen de producto con PRECISIÓN TOTAL. Extrae:
1. TIPO: ¿Qué es exactamente? (comida, ropa, tech, joyería, cosmética, etc.)
2. COMPONENTES: Nombra CADA parte/ingrediente visible
3. MATERIALES: Material de fabricación de cada componente
4. CALIDAD: ¿Premium, artesanal, industrial, luxury?
5. PRECIO ESTIMADO: Basado en materiales y calidad, ¿cuánto debería costar en el mercado?
6. CONTEXTO: ¿Para qué se usa? ¿Quién lo compra?
7. Si es COMIDA: tipo de cocina, ingredientes exactos, técnica de cocción, emplatado
8. Si es MODA: tipo de prenda, tejido, corte, temporada
9. Si es TECH: especificaciones técnicas visibles
10. FOTOGRAFÍA: calidad de la foto, iluminación, estilo

Responde en texto estructurado, no JSON.`,
      [{ base64, mediaType }],
      "Eres un experto analista visual de productos para eCommerce. Tu análisis se usa para crear fichas de producto perfectas.",
      "general",
      niche,
      4000,
    );
    return visionResult;
  } catch (err) {
    logger.warn({ err }, "Vision analysis for product image failed (non-critical)");
    return "";
  }
}

async function generateProductSample(lead: LeadData): Promise<ProductSample | null> {
  if (!lead.productImageUrl && !lead.storeUrl) return null;
  try {
    const nicheInfo = lead.niche || "ecommerce general";
    const extraContext = lead.extraInfo ? `\nInformacion extra del negocio: ${lead.extraInfo}` : "";

    let visionAnalysis = "";
    if (lead.productImageUrl?.startsWith("data:image/")) {
      visionAnalysis = await analyzeProductImageWithVision(lead.productImageUrl, nicheInfo);
    }

    const imageContext = visionAnalysis
      ? `ANÁLISIS VISUAL DEL PRODUCTO (extraído por IA de la foto):\n${visionAnalysis}\n\nUsa TODA esta información para crear un producto perfecto.`
      : lead.productImageUrl
        ? `El cliente ha proporcionado una imagen de producto.`
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
  ]
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .filter((url: string) => !url.includes("vertexaisearch.cloud.google.com") && !url.includes("grounding-api-redirect") && url.length < 300)
    .slice(0, 15);

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

  const stripGroundingUrls = (text: string): string =>
    text
      .replace(/\[?\(?\s*https?:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s)\]<>]+\s*\)?\]?/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const rawBusiness = stripGroundingUrls((businessResearch as any)?.text || "");
  const rawMarket = stripGroundingUrls((marketResearch as any)?.text || "");
  const rawSeo = stripGroundingUrls((seoResearch as any)?.text || "");

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

  return await buildReportHtml(lead, {
    business: structuredResearch.business,
    market: structuredResearch.market,
    seo: structuredResearch.seo,
    sources: allSources,
    productSample,
    isStructuredHtml: !!(rawBusiness || rawMarket || rawSeo),
  });
}

async function buildReportHtml(
  lead: LeadData,
  research: { business: string; market: string; seo: string; sources: string[]; productSample?: ProductSample | null; isStructuredHtml?: boolean },
): Promise<string> {
  const esc = sanitizeHtml;

  function safeUrl(url: string): string {
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(url)) return url;
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return u.href;
    } catch {}
    return "#";
  }

  function mdToHtml(text: string): string {
    const lines = text.split("\n");
    const blocks: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) { i++; continue; }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length + 1;
        const cls = level === 2 ? "ai-heading" : level === 3 ? "ai-heading" : "ai-sub-heading";
        blocks.push(`<h${level} class="${cls}">${inlineFormat(esc(headingMatch[2]))}</h${level}>`);
        i++; continue;
      }

      const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        const items: string[] = [];
        while (i < lines.length) {
          const m = lines[i].trim().match(/^\d+\.\s+(.+)$/);
          if (!m) break;
          items.push(`<li>${inlineFormat(esc(m[1]))}</li>`);
          i++;
        }
        blocks.push(`<ol class="ai-list ai-list-ordered">${items.join("")}</ol>`);
        continue;
      }

      const ulMatch = trimmed.match(/^[-•]\s+(.+)$/);
      if (ulMatch) {
        const items: string[] = [];
        while (i < lines.length) {
          const m = lines[i].trim().match(/^[-•]\s+(.+)$/);
          if (!m) break;
          items.push(`<li>${inlineFormat(esc(m[1]))}</li>`);
          i++;
        }
        blocks.push(`<ul class="ai-list">${items.join("")}</ul>`);
        continue;
      }

      const paraLines: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t || t.match(/^#{1,3}\s/) || t.match(/^\d+\.\s/) || t.match(/^[-•]\s/)) break;
        paraLines.push(inlineFormat(esc(t)));
        i++;
      }
      if (paraLines.length > 0) {
        blocks.push(`<p class="ai-paragraph">${paraLines.join("<br/>")}</p>`);
      }
    }
    return blocks.join("");

    function inlineFormat(s: string): string {
      return s
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
    }
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
  if (lead.productImageUrl) {
    const isBase64Img = lead.productImageUrl.startsWith("data:image/");
    const imgLabel = isBase64Img ? "📷 Imagen adjunta del producto" : esc(lead.productImageUrl);
    leadRows.push(["Imagen Producto", `<div class="product-img-cell"><img src="${safeUrl(lead.productImageUrl)}" alt="Producto" class="product-img-thumb" style="max-width:280px;max-height:200px;border-radius:8px;display:block;margin-bottom:8px;object-fit:contain;" onerror="this.style.display='none'" /><span class="muted" style="font-size:12px;">${imgLabel}</span></div>`]);
  }

  const leadTableHtml = leadRows.map(([label, value]) =>
    `<tr><td class="table-label">${label}</td><td class="table-value">${value}</td></tr>`
  ).join("");

  const sourcesHtml = research.sources.length > 0
    ? research.sources.map(s => `<li><a href="${safeUrl(s)}" class="link" style="word-break:break-all;">${esc(s)}</a></li>`).join("")
    : "<li class=\"muted\">Sin fuentes verificadas</li>";

  const ps = research.productSample;
  // Si el visitante NO adjuntó imagen propia, usamos el `generatedImagePrompt`
  // que el LLM acaba de inventar para producir una FOTO REAL del producto vía
  // Replicate (Flux 1.1 Pro). Antes este prompt se descartaba y el HTML caía
  // a un placeholder con emoji 🛍️ — ahora el pre-informe siempre puede mostrar
  // una imagen profesional, y los visitantes ven el producto "como en Shopify".
  let productImageUrl = lead.productImageUrl || "";
  if (!productImageUrl && ps?.generatedImagePrompt) {
    const aiUrl = await generateProductPhotoFromPrompt(ps.generatedImagePrompt);
    if (aiUrl) productImageUrl = aiUrl;
  }

  // FIX: el LLM puede devolver objetos/arrays donde esperamos string;
  // esto causaba `[object Object]` literal en el HTML del producto.
  function normalizeToText(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      return v.map(item => normalizeToText(item)).filter(Boolean).join(", ");
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      // Forma común del LLM: { keyword: "...", searchVolume: "..." } o { type: "...", value: "..." } etc.
      const candidates = [
        "keyword", "label", "name", "title", "text", "value",
        "description", "strategy", "note", "improvement", "question",
        "tag", "term",
      ];
      for (const k of candidates) {
        const val = o[k];
        if (typeof val === "string" && val.trim()) return val;
      }
      // Fallback: serializar como "k: v · k: v"
      const parts: string[] = [];
      for (const [k, val] of Object.entries(o)) {
        if (val === null || val === undefined) continue;
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          parts.push(`${k}: ${String(val)}`);
        }
      }
      return parts.slice(0, 3).join(" · ");
    }
    return "";
  }

  // Aplica esc() después de normalizar para HTML-escape seguro.
  const escN = (v: unknown) => esc(normalizeToText(v));
  const productSampleHtml = ps ? `
    <div class="section" style="page-break-before:always;">
      <div class="section-title">Producto Optimizado por Shopy Crafter — Score SEO 100/100</div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="ai-deliverable" style="padding:0;">

          ${productImageUrl ? `
          <div style="position:relative;background:#0a0a0a;text-align:center;padding:32px 20px;">
            <img src="${safeUrl(productImageUrl)}" alt="${escN(ps.altText || ps.title)}" style="max-width:100%;max-height:420px;border-radius:12px;object-fit:contain;display:inline-block;box-shadow:0 8px 32px rgba(0,0,0,.5);" onerror="this.parentElement.style.display='none'" />
            <div style="position:absolute;top:16px;right:16px;background:rgba(52,211,153,.15);color:#34d399;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;border:1px solid rgba(52,211,153,.3);">SEO 100/100</div>
          </div>` : `
          <div style="position:relative;background:linear-gradient(135deg,#1a1410 0%,#211a14 50%,#1a1410 100%);padding:64px 28px 56px;text-align:center;border-bottom:1px solid rgba(196,149,106,.18);">
            <div style="position:absolute;top:16px;right:16px;background:rgba(52,211,153,.15);color:#34d399;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;border:1px solid rgba(52,211,153,.3);">SCORE 100/100</div>
            <div style="display:inline-block;width:96px;height:96px;border-radius:50%;border:2px solid rgba(196,149,106,.35);background:rgba(196,149,106,.06);display:flex;align-items:center;justify-content:center;font-size:42px;margin-bottom:20px;line-height:96px;">🛍️</div>
            <div style="font-size:11px;color:rgba(196,149,106,.6);letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:10px;">Producto AI-Optimizado</div>
            <div style="font-size:22px;font-weight:700;color:rgba(255,255,255,.95);line-height:1.3;max-width:560px;margin:0 auto;">${escN(ps.title)}</div>
            ${ps.productType || ps.vendor ? `<div style="margin-top:14px;font-size:12px;color:rgba(255,255,255,.55);">${ps.productType ? escN(ps.productType) : ""}${ps.productType && (ps.vendor || lead.name) ? " · " : ""}${escN(ps.vendor || lead.name)}</div>` : ""}
          </div>`}

          <div style="padding:28px;">
            ${productImageUrl ? `
            <div style="margin-bottom:24px;">
              <div style="font-size:10px;font-weight:700;color:rgba(196,149,106,.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Titulo Shopify</div>
              <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,.95);line-height:1.3;">${escN(ps.title)}</div>
              <div style="margin-top:8px;">
                <span style="display:inline-block;background:rgba(196,149,106,.1);color:#c4956a;padding:4px 12px;border-radius:4px;font-size:12px;font-family:monospace;">/${escN(ps.handle || "producto-optimizado")}</span>
                <span style="display:inline-block;background:rgba(107,168,240,.08);color:#6ba8f0;padding:4px 12px;border-radius:4px;font-size:12px;margin-left:8px;">${escN(ps.productType)}</span>
                <span style="display:inline-block;background:rgba(196,149,106,.08);color:#c4956a;padding:4px 12px;border-radius:4px;font-size:12px;margin-left:8px;">${escN(ps.vendor || lead.name)}</span>
              </div>
            </div>` : `
            <div style="margin-bottom:24px;">
              <span style="display:inline-block;background:rgba(196,149,106,.1);color:#c4956a;padding:4px 12px;border-radius:4px;font-size:12px;font-family:monospace;">/${escN(ps.handle || "producto-optimizado")}</span>
            </div>`}

            <div class="ai-field" style="margin-bottom:20px;">
              <div class="ai-field-label">Descripcion de Venta</div>
              <div class="ai-field-value" style="line-height:1.8;font-size:13px;">${escN(ps.description)}</div>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                  <div style="background:rgba(52,211,153,.04);border:1px solid rgba(52,211,153,.12);border-radius:10px;padding:16px;">
                    <div style="font-size:10px;font-weight:700;color:#34d399;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Meta Title</div>
                    <div style="font-size:13px;color:rgba(255,255,255,.85);font-weight:600;">${escN(ps.seoTitle)}</div>
                    <div style="font-size:10px;color:rgba(52,211,153,.5);margin-top:4px;">${normalizeToText(ps.seoTitle).length}/60 chars</div>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                  <div style="background:rgba(52,211,153,.04);border:1px solid rgba(52,211,153,.12);border-radius:10px;padding:16px;">
                    <div style="font-size:10px;font-weight:700;color:#34d399;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Meta Description</div>
                    <div style="font-size:13px;color:rgba(255,255,255,.85);">${escN(ps.seoDescription)}</div>
                    <div style="font-size:10px;color:rgba(52,211,153,.5);margin-top:4px;">${normalizeToText(ps.seoDescription).length}/155 chars</div>
                  </div>
                </td>
              </tr>
            </table>

            <div style="background:rgba(107,168,240,.04);border:1px solid rgba(107,168,240,.12);border-radius:10px;padding:16px;margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:#6ba8f0;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Open Graph — Redes Sociales</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                    <div style="font-size:10px;color:rgba(107,168,240,.6);margin-bottom:4px;">OG Title</div>
                    <div style="font-size:13px;color:rgba(255,255,255,.85);">${escN(ps.ogTitle || ps.seoTitle || "")}</div>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                    <div style="font-size:10px;color:rgba(107,168,240,.6);margin-bottom:4px;">OG Description</div>
                    <div style="font-size:13px;color:rgba(255,255,255,.85);">${escN(ps.ogDescription || ps.seoDescription || "")}</div>
                  </td>
                </tr>
              </table>
            </div>

            ${ps.altText ? `
            <div class="ai-field" style="margin-bottom:16px;">
              <div class="ai-field-label">Alt Text Imagen Principal</div>
              <div class="ai-field-value" style="color:#34d399;font-size:13px;">${escN(ps.altText)}</div>
            </div>` : ""}

            ${ps.variants && ps.variants.length > 0 ? `
            <div style="background:rgba(196,149,106,.04);border:1px solid rgba(196,149,106,.12);border-radius:10px;padding:16px;margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:#c4956a;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Variantes Shopify</div>
              ${ps.variants.map(v =>
                `<div style="margin-bottom:8px;"><span style="font-weight:600;color:rgba(255,255,255,.8);font-size:13px;">${escN(v?.option)}:</span> <span style="color:rgba(255,255,255,.6);font-size:13px;">${(Array.isArray(v?.values) ? v.values : []).map(val => escN(val)).filter(Boolean).join(" · ")}</span></div>`
              ).join("")}
            </div>` : ""}

            ${(ps.tags && (ps.tags as unknown[]).length > 0) ? `
            <div style="margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:rgba(196,149,106,.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Tags SEO</div>
              <div>${(ps.tags as unknown[]).map(t => normalizeToText(t)).filter(Boolean).map(t => `<span style="display:inline-block;background:rgba(107,168,240,.08);color:#6ba8f0;padding:3px 10px;border-radius:12px;font-size:11px;margin:2px 4px 2px 0;border:1px solid rgba(107,168,240,.15);">${esc(t)}</span>`).join("")}</div>
            </div>` : ""}

            ${(ps.seoKeywords && (ps.seoKeywords as unknown[]).length > 0) ? `
            <div style="margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:rgba(52,211,153,.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Keywords Target</div>
              <div>${(ps.seoKeywords as unknown[]).map(k => normalizeToText(k)).filter(Boolean).map(k => `<span style="display:inline-block;background:rgba(52,211,153,.06);color:#34d399;padding:3px 10px;border-radius:12px;font-size:11px;margin:2px 4px 2px 0;border:1px solid rgba(52,211,153,.12);">${esc(k)}</span>`).join("")}</div>
            </div>` : ""}

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                  <div class="ai-field">
                    <div class="ai-field-label">Estrategia de Precio</div>
                    <div class="ai-field-value" style="font-size:13px;">${escN(ps.priceStrategy)}</div>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                  <div class="ai-field">
                    <div class="ai-field-label">Mejoras con Impacto</div>
                    <div class="ai-field-value" style="font-size:13px;">${escN(ps.improvementNotes)}</div>
                  </div>
                </td>
              </tr>
            </table>

            ${ps.faqItems && ps.faqItems.length > 0 ? `
            <div style="margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:rgba(196,149,106,.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">FAQ — Preguntas Frecuentes</div>
              ${ps.faqItems.map(faq => `
                <div style="margin-bottom:10px;padding:12px 16px;background:rgba(196,149,106,.03);border-radius:8px;border-left:3px solid rgba(196,149,106,.25);">
                  <div style="font-weight:600;color:rgba(255,255,255,.9);font-size:13px;margin-bottom:4px;">${escN(faq?.question)}</div>
                  <div style="color:rgba(255,255,255,.65);font-size:12px;">${escN(faq?.answer)}</div>
                </div>
              `).join("")}
            </div>` : ""}

            ${ps.schemaJsonLd ? `
            <div style="background:rgba(52,211,153,.04);border:1px solid rgba(52,211,153,.1);border-radius:10px;padding:14px 16px;margin-bottom:20px;">
              <div style="font-size:10px;font-weight:700;color:#34d399;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Schema JSON-LD</div>
              <div style="font-size:11px;color:rgba(52,211,153,.6);">Datos estructurados configurados correctamente para Google Rich Results</div>
            </div>` : ""}

            <div style="background:linear-gradient(135deg,rgba(196,149,106,.08),rgba(196,149,106,.03));border:1px solid rgba(196,149,106,.2);border-radius:12px;padding:20px;text-align:center;">
              <div style="font-size:14px;font-weight:700;color:#c4956a;margin-bottom:6px;">Este es solo 1 producto de muestra optimizado al 100/100.</div>
              <div style="font-size:12px;color:rgba(255,255,255,.5);line-height:1.6;">Con Shopy Crafter, optimizamos TODO tu catalogo automaticamente con IA: meta titles, descriptions, Schema JSON-LD, Open Graph, alt texts, variantes y keywords.</div>
            </div>
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

router.post("/contact", contactUpload.single("referenceImage"), async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const body = req.body ?? {};
    const {
      name, email, phone, storeUrl, niche, customNiche, revenue,
      socialMedia, message, extraInfo, productImageUrl,
    } = body as {
      name: string; email: string; phone?: string; storeUrl?: string;
      niche?: string; customNiche?: string; revenue?: string;
      socialMedia?: string; message?: string; extraInfo?: string;
      productImageUrl?: string;
    };
    let services: string[] = [];
    try {
      const raw = body.services;
      if (Array.isArray(raw)) services = raw;
      else if (typeof raw === "string") services = JSON.parse(raw);
    } catch {}
  
    const uploadedFile = (req as any).file as Express.Multer.File | undefined;
    let resolvedImageUrl = productImageUrl ?? null;
    if (uploadedFile) {
      const b64 = uploadedFile.buffer.toString("base64");
      resolvedImageUrl = `data:${uploadedFile.mimetype};base64,${b64}`;
    }
  
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
      productImageUrl: resolvedImageUrl?.trim() ?? null,
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
          reportHtml = await buildReportHtml(leadData, {
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
          let emailHtml: string;
          try {
            emailHtml = juice(reportHtml, {
              removeStyleTags: true,
              preserveMediaQueries: false,
              preserveFontFaces: false,
              applyStyleTags: true,
              insertPreservedExtraCss: false,
            });
          } catch (juiceErr) {
            logger.warn({ err: juiceErr }, "CSS inlining failed, sending raw HTML");
            emailHtml = reportHtml;
          }
          const sent = await sendEmail(ADMIN_EMAIL, subject, emailHtml);
          if (sent) {
            logger.info({ to: ADMIN_EMAIL, lead: leadData.email }, "Pre-report email sent to admin (CSS inlined)");
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/leads", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `SELECT id, details, created_at FROM audit_log WHERE action = 'lead_form_submitted' ORDER BY created_at DESC LIMIT 100`
    );
    const leads = result.rows.map((r: { id: string; details: string; created_at: string }) => {
      let details: Record<string, unknown> = {};
      try { details = JSON.parse(r.details); } catch {}
      return { id: r.id, ...details, createdAt: r.created_at };
    });
    res.json(leads);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/lead-reports", requireAdmin, async (_req, res): Promise<void> => {
  try {
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
      metadata: r.metadata ? (() => { try { return JSON.parse(r.metadata); } catch { return null; } })() : null,
      downloadUrl: `/api/lead-reports/${r.id}/download`,
      downloadPdfUrl: `/api/lead-reports/${r.id}/download?format=pdf`,
    }));
    res.json(parsed);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/lead-reports/:fileId/download", requireAdmin, async (req, res): Promise<void> => {
  try {
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
    res.setHeader("Content-Disposition", `inline; filename="${filename}.html"`);
    res.send(file.content);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
