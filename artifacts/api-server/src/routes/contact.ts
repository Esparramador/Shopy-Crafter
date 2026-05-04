import { Router } from "express";
import { renderHtmlOrText } from "../lib/html-escape.js";
import { db, auditLogTable } from "@workspace/db";
import { projectFilesTable } from "@workspace/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import multer from "multer";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
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
import { scrapeWebsite, formatScrapingForPrompt } from "../lib/web-scraper.js";
import type { WebScrapingResult } from "../lib/web-scraper.js";

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
  suppliers: string | null;
  submittedAt: string;
  company?: string;
}

interface MarketMetrics {
  conversionRate?: number;
  avgOrderValue?: number;
  cac?: number;
  ltv?: number;
  avgMargin?: number;
  sectorGrowth?: number;
  competitorCount?: number;
  seoScore?: number;
  labels: string[];
  values: number[];
  unit: string;
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

async function structureSupplierResearch(lead: LeadData, rawText: string): Promise<string> {
  const niche = lead.niche || "ecommerce general";
  const entityName = lead.storeUrl || lead.name;
  const hasOwnSuppliers = !!lead.suppliers;

  const result = await askClaudeWithBrain(
    0,
    [{ role: "user", content: `Eres el consultor estratégico senior de Shopy Crafter, agencia de optimización IA para e-commerce.

TIENES datos de investigación REALES sobre proveedores para el negocio "${entityName}" (nicho: ${niche}).
Tu trabajo es REESTRUCTURAR estos datos en un informe de consultoría PROFESIONAL con HTML formateado.

DATOS DE INVESTIGACIÓN EN BRUTO:
${rawText.slice(0, 25000)}

${hasOwnSuppliers ? `IMPORTANTE: El cliente proporcionó sus proveedores actuales: ${lead.suppliers}. La comparativa DEBE incluir estos proveedores específicos vs alternativas.` : "El cliente NO proporcionó proveedores. Genera un landscape general del sector."}

GENERA HTML profesional con EXACTAMENTE esta estructura (NO JSON, devuelve HTML directo):

<div class="ai-analysis">
  <div class="ai-diagnosis">
    <h3>📦 Análisis de Proveedores${hasOwnSuppliers ? " y Comparativa" : ""} — Resumen Ejecutivo</h3>
    <p>[2-3 párrafos resumiendo hallazgos clave sobre proveedores, márgenes, y oportunidades]</p>
  </div>

  <div class="ai-actions">
    <h3>💰 ${hasOwnSuppliers ? "Comparativa: Tus Proveedores vs Alternativas" : "Proveedores Recomendados y Revenue Estimado"}</h3>
    [GENERA 4-6 hallazgos, cada uno así:]
    <div class="action-item">
      <div class="action-header">
        <strong>[Nombre del proveedor + tipo + margen estimado]</strong>
        <span class="action-impact">[Revenue estimado mensual]</span>
      </div>
      <p>[Análisis detallado: precios, MOQ, tiempos, ventajas/desventajas]</p>
      <div class="ai-deliverable">
        [Recomendación: usar/cambiar/complementar con este proveedor]
      </div>
    </div>
  </div>

  <div class="ai-quick-wins">
    <h3>⚡ Oportunidades de Mejora en Supply Chain</h3>
    <ol>
      <li><strong>[Oportunidad 1]:</strong> [Ahorro o mejora concreta con datos]</li>
      <li><strong>[Oportunidad 2]:</strong> [Ahorro o mejora concreta con datos]</li>
      <li><strong>[Oportunidad 3]:</strong> [Ahorro o mejora concreta con datos]</li>
    </ol>
  </div>
</div>

REGLAS:
- Usa proveedores REALES que existan — NO inventes nombres de empresas
- Los revenue estimados deben ser cálculos realistas basados en márgenes del sector
- Usa las clases CSS exactas indicadas
- Responde en español
- NO incluyas texto fuera de las etiquetas HTML` }],
    "Eres un experto en supply chain y proveedores de Shopy Crafter. Reestructuras datos de investigación en informes profesionales con HTML formateado. Responde SOLO con HTML usando las clases CSS indicadas.",
    "general",
    niche,
    16000,
  );

  const sanitized = sanitizeAiHtml(result);
  const match = sanitized.match(/<div class="ai-analysis">[\s\S]*$/);
  return match ? match[0] : `<div class="ai-analysis">${sanitized}</div>`;
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

async function extractMarketMetrics(lead: LeadData, rawMarket: string, rawBusiness: string): Promise<MarketMetrics | null> {
  const combined = `${rawMarket}\n${rawBusiness}`.slice(0, 15000);
  const nicheInfo = lead.niche || "ecommerce general";
  try {
    const result = await askClaudeJsonWithBrain(
      0,
      `Extrae métricas numéricas del siguiente análisis de mercado para el nicho "${nicheInfo}".
DATOS DE INVESTIGACIÓN:
${combined}

Devuelve un JSON con SOLO los campos que puedas ESTIMAR con datos reales del texto. Si no hay datos para un campo, NO lo incluyas. Usa números reales del sector, no inventados:
{
  "conversionRate": (tasa de conversión media del sector en %, ej: 2.5),
  "avgOrderValue": (ticket medio en EUR, ej: 45),
  "cac": (coste de adquisición de cliente en EUR, ej: 18),
  "ltv": (lifetime value en EUR, ej: 120),
  "avgMargin": (margen bruto medio del sector en %, ej: 55),
  "sectorGrowth": (crecimiento anual del sector en %, ej: 12),
  "competitorCount": (número de competidores principales identificados, ej: 5),
  "seoScore": (puntuación SEO estimada 0-100, ej: 45)
}

REGLAS: Solo números reales extraídos o estimados del texto. No inventes. Si solo puedes estimar 3 campos, devuelve solo 3. Responde SOLO con JSON válido.`,
      "Eres un analista financiero de eCommerce. Extraes métricas numéricas de investigaciones de mercado reales. Solo devuelves datos que puedas respaldar con la investigación proporcionada.",
      "general",
      nicheInfo,
    );
    if (!result || typeof result !== "object") return null;
    const m = result as Record<string, unknown>;
    const labels: string[] = [];
    const values: number[] = [];
    const fieldMap: Record<string, string> = {
      conversionRate: "Conv. Rate %",
      avgOrderValue: "AOV (€)",
      cac: "CAC (€)",
      ltv: "LTV (€)",
      avgMargin: "Margen %",
      sectorGrowth: "Crecim. %",
      competitorCount: "Competidores",
      seoScore: "SEO Score",
    };
    for (const [key, label] of Object.entries(fieldMap)) {
      const val = Number(m[key]);
      if (val && isFinite(val) && val > 0) {
        labels.push(label);
        values.push(Math.round(val * 10) / 10);
      }
    }
    if (labels.length < 2) return null;
    return {
      ...(m.conversionRate ? { conversionRate: Number(m.conversionRate) } : {}),
      ...(m.avgOrderValue ? { avgOrderValue: Number(m.avgOrderValue) } : {}),
      ...(m.cac ? { cac: Number(m.cac) } : {}),
      ...(m.ltv ? { ltv: Number(m.ltv) } : {}),
      ...(m.avgMargin ? { avgMargin: Number(m.avgMargin) } : {}),
      ...(m.sectorGrowth ? { sectorGrowth: Number(m.sectorGrowth) } : {}),
      ...(m.competitorCount ? { competitorCount: Number(m.competitorCount) } : {}),
      ...(m.seoScore ? { seoScore: Number(m.seoScore) } : {}),
      labels,
      values,
      unit: "€",
    } as MarketMetrics;
  } catch {
    return null;
  }
}

function buildSvgBarChart(metrics: MarketMetrics): string {
  const { labels, values } = metrics;
  if (labels.length < 2) return "";
  const barWidth = 52;
  const gap = 16;
  const chartW = labels.length * (barWidth + gap) + gap;
  const chartH = 180;
  const maxVal = Math.max(...values, 1);
  const bars = labels.map((label, i) => {
    const barH = Math.max(8, (values[i] / maxVal) * (chartH - 40));
    const x = gap + i * (barWidth + gap);
    const y = chartH - 30 - barH;
    const color = i % 2 === 0 ? "#c4956a" : "#34d399";
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.85"/>` +
      `<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" fill="rgba(255,255,255,.85)" font-size="11" font-weight="700">${values[i]}</text>` +
      `<text x="${x + barWidth / 2}" y="${chartH - 8}" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="9">${label}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartW} ${chartH}" width="100%" height="${chartH}" style="max-width:${chartW}px;">` +
    `<rect width="${chartW}" height="${chartH}" rx="12" fill="rgba(10,10,10,.6)"/>` +
    `<line x1="${gap}" y1="${chartH - 30}" x2="${chartW - gap}" y2="${chartH - 30}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>` +
    bars + `</svg>`;
}

function buildCapabilitiesSection(lead: LeadData): string {
  const services = (lead.services || []).filter((s): s is string => typeof s === "string");
  const niche = (lead.niche || "").toLowerCase();
  const capabilities: { icon: string; title: string; desc: string }[] = [
    { icon: "🤖", title: "Motor IA Claude (Anthropic)", desc: "Investigación de mercado con datos reales, optimización SEO 100/100, y generación de contenido profesional" },
    { icon: "📊", title: "Inteligencia Financiera Avanzada", desc: "COGS, LTV/CAC, break-even, simulación de precios, y alertas de rentabilidad automáticas" },
    { icon: "🎬", title: "Producción de Vídeo Cinematográfico", desc: "Anuncios profesionales con 11 modelos de IA, voz en off ElevenLabs, música generativa, y narrativa de 7 pasos" },
  ];
  if (niche.includes("moda") || niche.includes("ropa") || niche.includes("fashion") || niche.includes("calzado") || niche.includes("joyería") || niche.includes("accesorio")) {
    capabilities.push({ icon: "👗", title: "Virtual Try-On / Photoshoot IA", desc: "Viste modelos con tus productos automáticamente — fotos tipo campaña de moda profesional" });
  }
  if (services.some(s => s.toLowerCase().includes("seo") || s.toLowerCase().includes("posicionamiento"))) {
    capabilities.push({ icon: "🔍", title: "Auditoría SEO Semrush-Level", desc: "16 criterios, keyword intelligence con Google Search, Schema JSON-LD, Core Web Vitals, y contenido optimizado" });
  }
  if (services.some(s => s.toLowerCase().includes("email") || s.toLowerCase().includes("marketing"))) {
    capabilities.push({ icon: "📧", title: "Email Marketing Automatizado", desc: "Flujos de Welcome, Abandoned Cart, Post-Purchase con segmentación y A/B testing integrado" });
  }
  capabilities.push({ icon: "🧠", title: "ShopyBrain — 46,000+ Insights", desc: "Cerebro IA que aprende de cada operación y acumula inteligencia de mercado, competencia, y tendencias" });
  capabilities.push({ icon: "📦", title: "140+ Acciones Automatizadas", desc: "Desde crear productos hasta auditorías completas, gestión de inventario, y propuestas comerciales — todo desde el chatbot" });
  const selected = capabilities.slice(0, 6);
  const rows: string[] = [];
  for (let i = 0; i < selected.length; i += 2) {
    const c1 = selected[i];
    const c2 = selected[i + 1];
    const cell = (c: { icon: string; title: string; desc: string }) =>
      `<td width="50%" style="padding:6px;vertical-align:top;">` +
      `<div style="background:rgba(196,149,106,.04);border:1px solid rgba(196,149,106,.12);border-radius:10px;padding:16px;">` +
      `<div style="font-size:24px;margin-bottom:8px;">${c.icon}</div>` +
      `<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px;">${c.title}</div>` +
      `<div style="font-size:11px;color:rgba(255,255,255,.55);line-height:1.5;">${c.desc}</div>` +
      `</div></td>`;
    rows.push(`<tr>${cell(c1)}${c2 ? cell(c2) : '<td width="50%"></td>'}</tr>`);
  }
  return `<div class="section" style="page-break-before:always;">` +
    `<div class="section-title">Capacidades IA de Shopy Crafter para Tu Negocio</div>` +
    `<div class="card" style="padding:24px;">` +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>` +
    `<div style="margin-top:20px;text-align:center;padding:16px;background-color:rgba(196,149,106,.08);border-radius:10px;border:1px solid rgba(196,149,106,.2);">` +
    `<div style="font-size:14px;font-weight:700;color:#c4956a;">Todo esto trabajando para TU negocio, 24/7, con datos REALES.</div>` +
    `<div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:4px;">Sin plantillas genéricas — cada análisis y cada pieza de contenido está personalizada para tu nicho y tu marca.</div>` +
    `</div></div></div>`;
}

async function scrapeLeadUrl(lead: LeadData): Promise<WebScrapingResult | null> {
  if (!lead.storeUrl) return null;
  try {
    const url = lead.storeUrl.startsWith("http") ? lead.storeUrl : `https://${lead.storeUrl}`;
    return await scrapeWebsite(url);
  } catch (err) {
    logger.warn({ err, url: lead.storeUrl }, "Failed to scrape lead URL (non-critical)");
    return null;
  }
}

async function researchWithClaude(
  lead: LeadData,
  scrapedData: WebScrapingResult | null,
): Promise<{ business: string; market: string; seo: string; suppliers: string }> {
  const entityName = lead.storeUrl || lead.name;
  const nicheInfo = lead.niche || "ecommerce general";
  const extraContext = lead.extraInfo ? `\nInformación adicional del negocio: ${lead.extraInfo}` : "";
  const suppliersContext = lead.suppliers ? `\nProveedores actuales del cliente: ${lead.suppliers}` : "";

  const scrapedContext = scrapedData
    ? `\n\nDATOS REALES EXTRAÍDOS DE LA WEB DEL CLIENTE (${scrapedData.url}):\n${formatScrapingForPrompt(scrapedData)}\n\nCONTENIDO DE TEXTO DE LA PÁGINA (primeros 8000 chars):\n${scrapedData.textContent?.slice(0, 8000) || "No disponible"}`
    : `\n\n[No se proporcionó URL o no se pudo acceder a la web del cliente]`;

  const [businessResult, marketResult, seoResult, supplierResult] = await Promise.allSettled([
    askClaudeWithBrain(
      0,
      [{ role: "user", content: `Realiza un análisis EXHAUSTIVO del negocio "${entityName}" en el nicho "${nicheInfo}".
${lead.storeUrl ? `URL: ${lead.storeUrl}` : ""}
${lead.socialMedia ? `Redes sociales: ${lead.socialMedia}` : ""}${extraContext}
${scrapedContext}

ANALIZA CON DATOS REALES:
1. **Productos y catálogo**: Qué vende exactamente, rangos de precio, categorías, número de productos visible
2. **Tecnología**: Plataforma (Shopify, WooCommerce, PrestaShop...), tema, apps/plugins detectados, velocidad
3. **Marca y posicionamiento**: Propuesta de valor, público objetivo, tono de comunicación
4. **Fortalezas**: Qué hace bien la tienda
5. **Debilidades críticas**: Qué le falta o hace mal (basado en datos REALES del scraping)
6. **Presencia en redes sociales**: Análisis de sus perfiles si los proporcionó

REGLAS:
- Usa SOLO datos reales del scraping proporcionado — NO inventes datos que no estén en el análisis
- Si el scraping muestra datos concretos (título, meta description, headings, imágenes sin alt, etc.), CÍTALOS textualmente
- Incluye la URL del cliente como fuente verificada
- Responde en español con formato estructurado` }],
      "Eres un consultor senior de inteligencia empresarial de Shopy Crafter. Analizas datos REALES extraídos de la web del cliente. NUNCA inventas datos — solo usas lo que encuentras en el scraping y tu conocimiento del sector. Responde en español.",
      "general",
      nicheInfo,
      16000,
    ),

    askClaudeWithBrain(
      0,
      [{ role: "user", content: `Análisis de mercado y competencia para el nicho "${nicheInfo}" en España y mercados hispanohablantes.
${lead.storeUrl ? `La tienda del cliente es: ${lead.storeUrl}` : ""}${extraContext}
${scrapedContext}

GENERA UN ANÁLISIS DE MERCADO REAL:
1. **Competidores principales**: Nombra 5-8 competidores REALES conocidos en este nicho (tiendas que existan de verdad)
2. **Pricing del sector**: Rangos de precio típicos para productos similares
3. **Métricas financieras del sector**: 
   - CAC (Coste de Adquisición de Cliente) típico del nicho
   - LTV (Lifetime Value) estimado
   - Tasa de conversión media del sector eCommerce
   - Ticket medio
   - Margen bruto típico
4. **Tendencias**: Qué está creciendo en este nicho, estacionalidad
5. **Oportunidades sin explotar**: Nichos dentro del nicho, gaps de mercado
6. **Barreras de entrada**: Inversión necesaria, competencia, regulación

REGLAS:
- Basa tus competidores en marcas REALES y CONOCIDAS del sector
- Las métricas financieras deben ser estimaciones realistas basadas en datos del sector eCommerce
- Si el cliente proporcionó datos de facturación (${lead.revenue || "no proporcionó"}), compáralos con el sector
- Responde en español` }],
      "Eres un analista senior de mercado y competencia de Shopy Crafter. Proporcionas datos de mercado realistas basados en tu conocimiento profundo del sector eCommerce. Responde en español.",
      "general",
      nicheInfo,
      16000,
    ),

    askClaudeWithBrain(
      0,
      [{ role: "user", content: `Auditoría SEO técnica y de presencia digital para "${entityName}" en el nicho "${nicheInfo}".
${lead.storeUrl ? `URL: ${lead.storeUrl}` : ""}
${scrapedContext}

GENERA UNA AUDITORÍA SEO REAL BASADA EN LOS DATOS SCRAPEADOS:
1. **Title tag**: Analiza el título actual (${scrapedData?.title ? `"${scrapedData.title}" — ${scrapedData.titleLength} chars` : "no disponible"}). ¿Es óptimo? ¿Longitud correcta (50-60 chars)?
2. **Meta description**: Analiza (${scrapedData?.metaDescription ? `"${scrapedData.metaDescription.slice(0, 80)}..." — ${scrapedData.metaDescriptionLength} chars` : "NO TIENE — CRÍTICO"}). ¿Longitud correcta (150-160 chars)?
3. **Headings (H1-H6)**: ${scrapedData ? `H1: ${scrapedData.headings.h1Count} (${scrapedData.headings.h1.join(", ") || "ninguno"}), H2: ${scrapedData.headings.h2.length}` : "no disponible"}
4. **Imágenes sin alt text**: ${scrapedData ? `${scrapedData.images.withoutAlt} de ${scrapedData.images.total} sin alt` : "no analizado"} — impacto en accesibilidad y SEO
5. **Open Graph y Twitter Cards**: ${scrapedData ? `OG title: ${scrapedData.ogTags.title ? "✅" : "❌"}, OG image: ${scrapedData.ogTags.image ? "✅" : "❌"}, Twitter card: ${scrapedData.twitterCard.card ? "✅" : "❌"}` : "no analizado"}
6. **Schema JSON-LD**: ${scrapedData ? `${scrapedData.jsonLdSchemas.length > 0 ? `${scrapedData.jsonLdSchemas.length} esquemas` : "❌ SIN datos estructurados — OPORTUNIDAD CRÍTICA"}` : "no analizado"}
7. **robots.txt y sitemap**: ${scrapedData ? `robots.txt: ${scrapedData.robotsTxt.exists ? "✅" : "❌"}, sitemap: ${scrapedData.sitemapXml.exists ? "✅" : "❌"}` : "no analizado"}
8. **SSL**: ${scrapedData ? (scrapedData.ssl ? "✅ Activo" : "❌ NO — CRÍTICO") : "no verificado"}
9. **Keywords objetivo**: Recomienda 10-15 keywords de cola larga relevantes para el nicho con volumen estimado
10. **Oportunidades de contenido**: Blog, landing pages, FAQs que debería crear

REGLAS:
- Usa EXCLUSIVAMENTE los datos del scraping — no inventes valores que no estén ahí
- Si un dato no está disponible, di "No detectado" en vez de inventar
- Cada hallazgo debe tener impacto (CRÍTICO/ALTO/MEDIO/BAJO)
- Responde en español` }],
      "Eres un experto SEO técnico senior de Shopy Crafter. Auditas con datos REALES del scraping. No inventas métricas. Responde en español.",
      "seo",
      nicheInfo,
      16000,
    ),

    askClaudeWithBrain(
      0,
      [{ role: "user", content: `Análisis de proveedores y revenue estimado para el nicho "${nicheInfo}".
${lead.storeUrl ? `Tienda del cliente: ${lead.storeUrl}` : ""}
${lead.revenue ? `Facturación actual declarada: ${lead.revenue}` : ""}${extraContext}${suppliersContext}
${scrapedContext}

${lead.suppliers ? `El cliente usa estos proveedores: ${lead.suppliers}

GENERA UN ANÁLISIS COMPARATIVO:
1. **Análisis de los proveedores actuales del cliente** (${lead.suppliers}):
   - Tipo de proveedor (dropshipping, mayorista, fabricante, marketplace)
   - Rango de precios típico y márgenes que ofrecen
   - Ventajas y desventajas de cada uno
   - Tiempos de envío habituales
   - MOQ (Minimum Order Quantity) si aplica

2. **Proveedores alternativos recomendados** (5-8 proveedores REALES):
   - Nombre del proveedor (que exista de verdad)
   - Tipo y especialidad
   - Rango de precios y comparativa con los actuales
   - Ventajas competitivas vs los proveedores actuales del cliente

3. **Estimación de revenue por proveedor**:
   - Revenue estimado mensual si usa cada proveedor con márgenes típicos
   - Ahorro potencial al cambiar de proveedor
   - ROI estimado del cambio` : `No se proporcionaron proveedores específicos.

GENERA UN ANÁLISIS GENERAL DE PROVEEDORES PARA EL NICHO:
1. **Landscape de proveedores** para "${nicheInfo}":
   - Top 5-8 proveedores REALES y conocidos para este nicho
   - Tipo de cada uno (dropshipping, mayorista, fabricante, marketplace B2B)
   - Rango de precios típico y márgenes que ofrecen

2. **Comparativa entre proveedores**:
   - Tabla comparativa de precio, calidad, tiempos de envío, MOQ
   - Cuál es más rentable según volumen

3. **Revenue estimado por proveedor**:
   - Revenue mensual estimado con cada proveedor (asumiendo ${lead.revenue || "facturación media del nicho"})
   - Margen bruto estimado por proveedor
   - Punto de equilibrio (break-even units) estimado`}

REGLAS:
- Usa proveedores REALES que existan — no inventes nombres
- Los márgenes y precios deben ser estimaciones realistas del sector
- Incluye siempre la fuente del dato (conocimiento del sector, datos públicos, etc.)
- Responde en español con formato estructurado` }],
      "Eres un experto en supply chain y proveedores eCommerce de Shopy Crafter. Conoces proveedores reales de cada nicho. Proporcionas estimaciones de revenue realistas. Responde en español.",
      "general",
      nicheInfo,
      16000,
    ),
  ]);

  const extractText = (r: PromiseSettledResult<string>, fallback: string): string =>
    r.status === "fulfilled" && r.value ? r.value : fallback;

  return {
    business: extractText(businessResult, "No se pudo analizar el negocio."),
    market: extractText(marketResult, "No se pudo analizar el mercado."),
    seo: extractText(seoResult, "No se pudo realizar la auditoría SEO."),
    suppliers: extractText(supplierResult, "No se pudo analizar los proveedores."),
  };
}

async function generateAIPreReport(lead: LeadData): Promise<string> {
  const entityName = lead.storeUrl || lead.name;
  const nicheInfo = lead.niche || "ecommerce general";

  logger.info({ entityName, niche: nicheInfo, hasUrl: !!lead.storeUrl, hasSuppliers: !!lead.suppliers }, "Starting Claude-powered pre-report");

  const scrapedData = await scrapeLeadUrl(lead);
  if (scrapedData) {
    logger.info({ url: scrapedData.url, title: scrapedData.title, statusCode: scrapedData.statusCode, wordCount: scrapedData.wordCount, images: scrapedData.images.total }, "Successfully scraped lead URL");
  }

  const [researchResults, productSampleResult] = await Promise.allSettled([
    researchWithClaude(lead, scrapedData),
    generateProductSample(lead),
  ]);

  const research = researchResults.status === "fulfilled"
    ? researchResults.value
    : { business: "Error en la investigación.", market: "Error en el análisis de mercado.", seo: "Error en la auditoría SEO.", suppliers: "Error en el análisis de proveedores." };
  const productSample = productSampleResult.status === "fulfilled" ? (productSampleResult.value as ProductSample | null) : null;

  const allSources: string[] = [];
  if (lead.storeUrl) {
    const url = lead.storeUrl.startsWith("http") ? lead.storeUrl : `https://${lead.storeUrl}`;
    allSources.push(url);
  }
  if (scrapedData?.canonicalUrl && !allSources.includes(scrapedData.canonicalUrl)) {
    allSources.push(scrapedData.canonicalUrl);
  }
  if (scrapedData?.sitemapXml?.url) allSources.push(scrapedData.sitemapXml.url);
  if (lead.socialMedia?.startsWith("http")) allSources.push(lead.socialMedia);

  try {
    learnFromOperation({
      operationType: "lead_prereport",
      title: `Pre-informe lead: ${lead.name} (${lead.niche || "general"}) - ${lead.storeUrl || "sin URL"}`,
      content: `Lead: ${lead.name}, Email: ${lead.email}, Nicho: ${lead.niche}, Facturacion: ${lead.revenue}, Servicios: ${(lead.services || []).join(", ")}, URL: ${lead.storeUrl || "N/A"}, Redes: ${lead.socialMedia || "N/A"}, Proveedores: ${lead.suppliers || "N/A"}, Info extra: ${lead.extraInfo || "N/A"}. Motor: Claude (Anthropic). Scraping: ${scrapedData ? "OK" : "no disponible"}.`,
      confidence: 0.85,
      tags: ["lead", "prereport", "claude", lead.niche || "general"],
    });

    if (research.business && research.business.length > 100) {
      learnFromOperation({
        operationType: "lead_business_intel",
        niche: lead.niche || undefined,
        title: `Intel empresa (Claude): ${entityName} (${lead.niche || "general"})`,
        content: research.business.slice(0, 6000),
        confidence: 0.85,
        tags: ["lead_research", "business_intel", "claude", lead.niche || "general", entityName],
      });
    }

    if (research.market && research.market.length > 100) {
      learnFromOperation({
        operationType: "lead_market_intel",
        niche: lead.niche || undefined,
        title: `Intel mercado (Claude): nicho ${lead.niche || "general"} — lead ${lead.name}`,
        content: research.market.slice(0, 6000),
        confidence: 0.85,
        tags: ["lead_research", "market_intel", "claude", lead.niche || "general"],
      });
    }

    if (research.seo && research.seo.length > 100) {
      learnFromOperation({
        operationType: "seo",
        niche: lead.niche || undefined,
        title: `SEO audit (Claude): ${entityName} (${lead.storeUrl || "sin URL"})`,
        content: research.seo.slice(0, 6000),
        confidence: 0.85,
        tags: ["lead_research", "seo_audit", "claude", lead.niche || "general"],
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

  let structuredResearch: { business: string; market: string; seo: string };
  try {
    structuredResearch = await structureResearchWithClaude(lead, {
      business: research.business,
      market: research.market,
      seo: research.seo,
    });
  } catch (err) {
    logger.warn({ err }, "Claude structuring failed, using raw research text");
    structuredResearch = {
      business: research.business,
      market: research.market,
      seo: research.seo,
    };
  }

  let supplierStructured: string;
  try {
    const supplierHtml = await structureSupplierResearch(lead, research.suppliers);
    supplierStructured = supplierHtml;
  } catch (err) {
    logger.warn({ err }, "Supplier structuring failed, using raw text");
    supplierStructured = research.suppliers;
  }

  let marketMetrics: MarketMetrics | null = null;
  try {
    if (research.market || research.business) {
      marketMetrics = await extractMarketMetrics(lead, research.market, research.business);
    }
  } catch (err) {
    logger.warn({ err }, "Market metrics extraction failed (non-critical)");
  }

  return await buildReportHtml(lead, {
    business: structuredResearch.business,
    market: structuredResearch.market,
    seo: structuredResearch.seo,
    sources: allSources,
    productSample,
    isStructuredHtml: true,
    marketMetrics,
    supplierAnalysis: supplierStructured,
  });
}

async function buildReportHtml(
  lead: LeadData,
  research: { business: string; market: string; seo: string; sources: string[]; productSample?: ProductSample | null; isStructuredHtml?: boolean; marketMetrics?: MarketMetrics | null; supplierAnalysis?: string },
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
    ["Proveedores actuales", esc(lead.suppliers || "No proporcionados")],
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
              <div class="ai-field-value" style="line-height:1.8;font-size:13px;">${renderHtmlOrText(ps.description)}</div>
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

    ${research.marketMetrics ? `
    <div class="section" style="page-break-before:always;">
      <div class="section-title">Metricas Clave del Sector — Datos Reales</div>
      <div class="card" style="padding:24px;text-align:center;">
        ${buildSvgBarChart(research.marketMetrics)}
        <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:20px;">
          ${research.marketMetrics.conversionRate ? `<div style="background:rgba(196,149,106,.06);border:1px solid rgba(196,149,106,.15);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:#c4956a;">${research.marketMetrics.conversionRate}%</div><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Conv. Rate</div></div>` : ""}
          ${research.marketMetrics.avgOrderValue ? `<div style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.15);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:#34d399;">${research.marketMetrics.avgOrderValue}€</div><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Ticket Medio</div></div>` : ""}
          ${research.marketMetrics.cac ? `<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:#ef4444;">${research.marketMetrics.cac}€</div><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">CAC</div></div>` : ""}
          ${research.marketMetrics.ltv ? `<div style="background:rgba(107,168,240,.06);border:1px solid rgba(107,168,240,.15);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:#6ba8f0;">${research.marketMetrics.ltv}€</div><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">LTV 12m</div></div>` : ""}
          ${research.marketMetrics.ltv && research.marketMetrics.cac ? `<div style="background:${(research.marketMetrics.ltv / research.marketMetrics.cac) >= 3 ? 'rgba(52,211,153,.06)' : 'rgba(239,68,68,.06)'};border:1px solid ${(research.marketMetrics.ltv / research.marketMetrics.cac) >= 3 ? 'rgba(52,211,153,.15)' : 'rgba(239,68,68,.15)'};border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:${(research.marketMetrics.ltv / research.marketMetrics.cac) >= 3 ? '#34d399' : '#ef4444'};">${(research.marketMetrics.ltv / research.marketMetrics.cac).toFixed(1)}x</div><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Ratio LTV/CAC</div></div>` : ""}
          ${research.marketMetrics.avgMargin ? `<div style="background:rgba(196,149,106,.06);border:1px solid rgba(196,149,106,.15);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:#c4956a;">${research.marketMetrics.avgMargin}%</div><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Margen Bruto</div></div>` : ""}
        </div>
        <div style="margin-top:12px;font-size:10px;color:rgba(255,255,255,.3);">Métricas extraídas de la investigación de mercado real · Estimaciones basadas en datos verificados del sector</div>
      </div>
    </div>` : ""}

    ${research.supplierAnalysis ? `
    <div class="section" style="page-break-before:always;">
      <div class="section-title">Analisis de Proveedores y Revenue Estimado</div>
      <div class="card" style="padding:28px;line-height:1.85;font-size:13px;">
        ${renderContent(research.supplierAnalysis)}
      </div>
      <div style="margin-top:8px;padding:8px 16px;background:rgba(196,149,106,.04);border-radius:8px;font-size:11px;color:rgba(255,255,255,.35);">
        Analisis de proveedores por Shopy Crafter AI · ${lead.suppliers ? "Comparativa con proveedores del cliente" : "Landscape general del sector"} · Revenue estimado basado en margenes reales
      </div>
    </div>` : ""}

    ${buildCapabilitiesSection(lead)}

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
        <p class="muted" style="margin:4px 0 0;font-size:11px;">Claude (Anthropic) + Web Scraping Real &middot; Datos verificados de la web del cliente</p>
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
      socialMedia, message, extraInfo, productImageUrl, suppliers,
    } = body as {
      name: string; email: string; phone?: string; storeUrl?: string;
      niche?: string; customNiche?: string; revenue?: string;
      socialMedia?: string; message?: string; extraInfo?: string;
      productImageUrl?: string; suppliers?: string;
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
      suppliers: suppliers?.trim() ?? null,
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
        reportHtml = await generateAIPreReport(leadData);
  
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
            aiEngine: "claude-anthropic",
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
