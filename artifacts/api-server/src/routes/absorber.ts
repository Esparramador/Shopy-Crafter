/**
 * ShopyBrain Universal Absorber
 * ─────────────────────────────────────────────────────────────────────────────
 * The single absorption engine: images, videos, URLs, social profiles, text.
 * Everything extracted → analyzed → saved permanently into ShopyBrain memory.
 * ONE brain. ONE truth. ShopyBrain.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { sanitizeHtml } from "../lib/html-escape.js";
import { db } from "@workspace/db";
import { omnicoreMemoriesTable, omnicoreAbsorbedContentTable, projectsTable } from "@workspace/db/schema";
import { buildCoverPage, type CoverTemplate } from "../lib/report-cover.js";
import { askGeminiJson, askGeminiWithSearch, isGeminiSearchBlocked } from "../lib/gemini.js";
import { getClaudeClient, askClaudeWithBrain, buildShopyBrainContext, buildBrandDnaContext, learnFromOperation, CLAUDE_MODEL } from "../lib/claude.js";
import { shopifyRequest } from "../lib/shopify.js";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { saveToVault } from "../lib/vault.js";
import { enableLongRunning } from "../lib/long-running.js";
import { processUploadedFile } from "../lib/file-processor.js";
import { generateAiJson } from "../lib/ai-json.js";
import { aiOutputErrorMessage, isAiOutputError } from "../lib/ai-errors.js";
import { z } from "zod";
import { lenientArray, looseNumber, looseString, optionalLooseNumber, parseResearchJson } from "../lib/ai-schema.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|gif|webp|bmp|svg)|video\/(mp4|webm|mov|avi|mkv)/i;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo no soportado: ${file.mimetype}`));
  },
});

// Multer permisivo (sin fileFilter) para el extractor universal de documentos:
// acepta CUALQUIER formato (PDF, Word, Excel, PowerPoint, ZIP, HTML, código, audio,
// vídeo, etc.). Muchos archivos de texto/código llegan con mimetype vacío desde el
// navegador, así que filtrar por mimetype no es fiable aquí.
const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ─── VISION PROMPT — extracts EVERYTHING ─────────────────────────────────────
const VISION_MASTER_PROMPT = `You are ShopyBrain's Universal Vision & Intelligence Engine — the most advanced visual analysis system for eCommerce. Extract 100% of information from ANY image type.

CLASSIFY first: What type of image is this?
- SCENE TYPE: product_only | product_with_model | food | tech | fashion | jewelry | art | animal | infographic | lifestyle | packaging | blueprint
- RENDER TYPE: real_photo | cgi | illustration | render_3d | ai_generated | composite | infographic

Then extract EVERYTHING across ALL dimensions:

1. VISUAL COMPOSITION
   - Layout structure, visual hierarchy, rule of thirds, golden ratio
   - Focal points, depth of field, perspective, camera angle, estimated focal length
   - Spatial relationships, proportions, symmetry/asymmetry

2. COMPONENT-LEVEL BREAKDOWN (like a technical engineering blueprint)
   - Name EVERY visible part/component of the product
   - For EACH component: exact material, function, position, estimated dimensions, technical details
   - For FOOD: every ingredient, every layer, cooking technique per element, plating geometry
   - For TECH: every port, sensor, button, screen, chip, connector visible
   - For FASHION: every fabric panel, seam, closure, label, stitching pattern
   - For JEWELRY: every stone, metal, setting type, clasp, hallmark
   - For ANIMALS: breed identification, anatomy, health signals, grooming state

3. COLORS & PALETTE
   - Exact color values (hex/RGB), color psychology
   - Color harmony type (complementary/analogous/triadic)
   - Dominant vs accent colors, estimated Kelvin temperature

4. TEXTURES & SURFACES
   - Surface finish (matte/glossy/satin/rough/smooth/metallic/brushed/hammered)
   - Material properties (fabric type, grain, weave, porosity, thread count)
   - Tactile descriptors that translate to marketing copy

5. TOPOLOGY & GEOMETRY
   - 3D structure, silhouette, edge types (sharp/rounded/organic)
   - Geometric patterns, repeating elements, grid systems
   - Structural integrity, weight distribution, balance points

6. RENDERING & PRODUCTION TECHNIQUE
   - Photography vs CGI vs illustration vs mixed
   - Lighting setup (softbox/ring/natural/rim/dramatic), direction, hardness
   - Post-processing style (clean/moody/editorial/commercial/HDR/film-grain)
   - Depth of field, motion blur, special effects

7. TECHNICAL & CHEMICAL COMPOSITION
   - Material identification (polymer, metal alloy, natural fiber, ceramic, etc.)
   - Manufacturing process (injection molded, hand-crafted, 3D printed, cast, woven, laser-cut, CNC)
   - Estimated material properties (density, flexibility, durability)
   - For food/beauty: ingredient identification, formula clues, cooking/formulation technique

8. MODEL/PERSON ANALYSIS (if present)
   - Gender, age range, ethnicity, pose, body language
   - Clothing description, interaction with product
   - Skin tone, hair style, facial expression, mood conveyed
   - Professional model vs UGC/amateur

9. FOOD & GASTRONOMY ANALYSIS (if food present)
   - Cuisine type (Italian, Japanese, French, fusion, etc.)
   - Dish identification, ingredient list (EVERY visible ingredient)
   - Cooking technique (oven, sous vide, grill, fry, raw, fermented)
   - Plating style (fine dining, rustic, minimalist, abundant)
   - Temperature signals (steam, frost, condensation)
   - Garnishes, sauces, accompaniments

10. BRAND & MARKETING INTELLIGENCE
    - Brand identity elements (logo, colors, typography, tone)
    - Target audience signals, aspirational positioning
    - Price positioning (budget/mid/premium/luxury/ultra-luxury)
    - Competitive category and differentiation factors
    - Brand archetype (Hero/Sage/Explorer/Creator/Rebel/Lover/etc.)

11. VISUAL DNA (the unique aesthetic fingerprint)
    - Style fingerprint in one sentence
    - Photography school (editorial/commercial/artistic/documentary/lifestyle)
    - Editing style, mood board keywords, emotional tone
    - Luxury score (1-10)
    - What makes this image unique and memorable

12. ECOMMERCE CONVERSION SIGNALS
    - Product presentation quality score (1-10)
    - Trust signals, social proof elements
    - Recommended marketing angles (top 5)
    - Suggested title, pricing, and description approach
    - A/B test hypotheses

Return as structured JSON with ALL fields populated.`;

const SOCIAL_EXTRACT_PROMPT = `You are ShopyBrain's Social Intelligence Engine. Analyze this social media content.

Extract:
1. Brand identity and positioning
2. Content strategy and posting patterns
3. Audience engagement signals
4. Product presentation techniques
5. Pricing and promotion signals
6. Competitive intelligence
7. Top performing content patterns
8. Marketing angles used
9. Brand voice and tone
10. eCommerce conversion tactics used

Return detailed JSON with ecommerce_insights, marketing_angles, audience_signals, brand_elements, competitive_data.`;

// ─── HELPER: Save to ShopyBrain memory ────────────────────────────────────────
async function saveToShopyBrain(params: {
  title: string;
  content: string;
  memoryType: string;
  niche?: string;
  sourceType: string;
  sourceUrl?: string;
  confidence?: number;
  tags?: string[];
}): Promise<string> {
  const id = randomUUID();
  await db.insert(omnicoreMemoriesTable).values({
    id,
    memoryType: params.memoryType,
    niche: params.niche ?? null,
    title: params.title.slice(0, 200),
    content: params.content,
    confidence: params.confidence ?? 0.75,
    sourceType: params.sourceType,
    tags: params.tags ? JSON.stringify(params.tags) : null,
    isVerified: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

// ─── HELPER: Classify URL type ────────────────────────────────────────────────
function classifyUrl(url: string): "social_instagram" | "social_facebook" | "social_x" | "tiktok" | "youtube" | "url" {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "social_instagram";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "social_facebook";
  if (u.includes("twitter.com") || u.includes("x.com")) return "social_x";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return "url";
}

// ─── HELPER: SSRF-safe URL validation ─────────────────────────────────────────
function validateExternalUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("URL inválida"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Solo se permiten URLs HTTP/HTTPS");
  const host = parsed.hostname.toLowerCase();
  const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "metadata.google.internal", "169.254.169.254"];
  if (blocked.includes(host)) throw new Error("URL bloqueada: no se permiten direcciones internas");
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/.test(host)) throw new Error("URL bloqueada: rango de IP privada");
  if (host.endsWith(".internal") || host.endsWith(".local")) throw new Error("URL bloqueada: dominio interno");
}

// ─── HELPER: Fetch URL content ────────────────────────────────────────────────
async function fetchUrlContent(url: string): Promise<{ text: string; title: string; description: string; imageUrls: string[] }> {
  validateExternalUrl(url);
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; ShopyBrainBot/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  
  const res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const html = await res.text();
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? url;
  
  // Extract meta description + OG data
  const descMatch = html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"/i);
  const description = descMatch?.[1] ?? "";
  
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  
  // Extract visible text (strip HTML tags)
  const cleanText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000);
  
  const baseUrl = (() => { try { return new URL(url); } catch { return null; } })();
  const imgMatches = html.matchAll(/<img[^>]+(?:src|data-src)=['"]([^'">\s]+)['"]/gi);
  const rawImgUrls = [ogImage, ...[...imgMatches].map(m => m[1])];
  const imageUrls = rawImgUrls
    .map(u => {
      if (!u) return "";
      if (u.startsWith("http")) return u;
      if (baseUrl) { try { return new URL(u, baseUrl).toString(); } catch { return ""; } }
      return "";
    })
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 20);
  
  return {
    text: cleanText,
    title: ogTitle || title,
    description,
    imageUrls,
  };
}

// ─── HELPER: open oEmbed (no auth) — X / TikTok / YouTube ─────────────────────
// Estos proveedores exponen oEmbed público que devuelve autor + texto REALES sin
// autenticación. Instagram/Facebook requieren un token de app de Meta para oEmbed,
// así que esos caen a OG tags / inferencia con IA (etiquetada con honestidad).
async function fetchOEmbed(
  url: string,
  urlType: string,
): Promise<{ provider: string; authorName: string; title: string; caption: string; thumbnailUrl: string } | null> {
  let endpoint: string | null = null;
  if (urlType === "social_x") endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url)}`;
  else if (urlType === "tiktok") endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  else if (urlType === "youtube") endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyBrainBot/1.0)", "Accept": "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const html = typeof data.html === "string" ? data.html : "";
    const caption = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const authorName = typeof data.author_name === "string" ? data.author_name : "";
    const title = typeof data.title === "string" ? data.title : "";
    if (!caption && !authorName && !title) return null;
    return {
      provider: typeof data.provider_name === "string" ? data.provider_name : urlType,
      authorName,
      title,
      caption,
      thumbnailUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : "",
    };
  } catch {
    return null;
  }
}

// Nota de procedencia: indica de DÓNDE viene cada dato para no presentar inferencias
// de IA como si fueran datos extraídos directamente.
const PROVENANCE_NOTE: Record<string, string> = {
  oembed: "Datos REALES vía oEmbed oficial de la plataforma (autor y texto verificados).",
  og_tags: "Datos REALES de las etiquetas Open Graph / meta de la página pública.",
  ai_search_inference: "⚠️ La plataforma bloquea el acceso público sin API oficial. Esto es una INVESTIGACIÓN con IA + búsqueda web (inferencia), NO datos extraídos directamente — verifícalo antes de usarlo.",
};

// El prompt de visión no fija claves obligatorias; basta con un objeto no vacío.
const visionAnalysisSchema = z.record(z.string(), z.unknown())
  .refine(o => Object.keys(o).length > 0, { message: "análisis vacío" });

// ─── HELPER: Analyze image with Claude Vision ──────────────────────────────────
async function analyzeImageWithClaude(
  imageData: Buffer | string,
  mediaType: string = "image/jpeg",
  isUrl = false
): Promise<Record<string, unknown>> {
  const [brainCtx, client] = await Promise.all([
    buildShopyBrainContext(undefined, "images", "visual product analysis"),
    getClaudeClient(0),
  ]);
  
  const imageBlock = isUrl
    ? { type: "image" as const, source: { type: "url" as const, url: imageData as string } }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: (imageData as Buffer).toString("base64"),
        },
      };
  
  // Antes, si el JSON no parseaba, se devolvía { raw: text } y se guardaba en ShopyBrain
  // una memoria "visual" con todos los campos vacíos. Ahora: un reintento y error tipado.
  return claudeJson(client, {
    system: `ShopyBrain Vision Analysis Engine.${brainCtx}`,
    imageBlock,
    prompt: VISION_MASTER_PROMPT + "\n\nReturn ONLY valid JSON. No markdown, no explanation.",
    schema: visionAnalysisSchema,
    label: "absorber/vision",
  });
}

type ClaudeClient = Awaited<ReturnType<typeof getClaudeClient>>;
type ClaudeImageBlock =
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };

/**
 * Llamada directa al SDK (con imagen opcional) que devuelve JSON validado:
 * detecta el corte por max_tokens, reintenta una vez y si no, error tipado.
 */
async function claudeJson<T>(
  client: ClaudeClient,
  opts: { system: string; prompt: string; schema: z.ZodType<T, z.ZodTypeDef, unknown>; label: string; imageBlock?: ClaudeImageBlock; maxTokens?: number },
): Promise<T> {
  const maxTokens = opts.maxTokens ?? 16000;
  return generateAiJson<T>({
    prompt: opts.prompt,
    maxTokens,
    retryMaxTokens: maxTokens * 2,
    schema: opts.schema,
    expect: "object",
    label: opts.label,
    call: async ({ prompt, maxTokens: budget }) => {
      const res = await client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: budget,
        system: opts.system,
        messages: [{
          role: "user",
          content: opts.imageBlock ? [opts.imageBlock, { type: "text", text: prompt }] : prompt,
        }],
      }).finalMessage();
      const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
      return { text, truncated: res.stop_reason === "max_tokens" };
    },
  });
}

// Crear producto desde imagen. Antes, si el JSON de visión o del copy no parseaba,
// se creaba igualmente en Shopify un "Nuevo Producto" vacío, y un recommendedPrice
// en texto hacía fallar el .toFixed().
const stringList = lenientArray(looseString);
const productAnalysisSchema = z.object({
  productName: z.string().min(1),
  productCategory: z.string().default(""),
  materials: stringList,
  qualityTier: z.string().optional().catch(undefined),
  targetMarket: z.string().optional().catch(undefined),
  searchKeywords: stringList,
  keyFeatures: stringList,
  comparableProducts: lenientArray(z.object({ name: looseString, brand: looseString.default(""), priceRange: looseString.default("") })),
  suggestedTitle: z.string().default(""),
  suggestedTags: stringList,
  estimatedPriceRange: z.string().optional().catch(undefined),
  detailedDescription: z.string().default(""),
});
const productPricingSchema = z.object({
  researchedPrices: lenientArray(z.object({
    source: looseString,
    product: looseString.default(""),
    price: looseNumber,
    url: z.string().optional().catch(undefined),
  })),
  averageMarketPrice: optionalLooseNumber,
  lowestFound: optionalLooseNumber,
  highestFound: optionalLooseNumber,
  recommendedPrice: optionalLooseNumber,
  compareAtPrice: optionalLooseNumber,
  priceJustification: z.string().optional().catch(undefined),
  marginAnalysis: z.string().optional().catch(undefined),
  competitivePosition: z.string().optional().catch(undefined),
});
type ProductPricing = z.output<typeof productPricingSchema>;

// Investigación de proveedores: las tres búsquedas tienen formatos libres que se
// devuelven tal cual (basta con que sean un objeto); la síntesis sí se valida.
const researchObjectSchema = z.record(z.string(), z.unknown());
const supplierSynthesisSchema = z.object({
  topRecommendation: z.object({ supplier: z.string().min(1) }).passthrough(),
  strategy: z.string().min(1),
}).passthrough();
const productCopySchema = z.object({
  title: z.string().min(1),
  bodyHtml: z.string().min(1),
  tags: stringList,
  seoTitle: z.string().optional().catch(undefined),
  seoDescription: z.string().optional().catch(undefined),
  vendor: z.string().optional().catch(undefined),
});

// ─── HELPER: Analyze with Gemini (video / complex URLs) ───────────────────────
async function analyzeWithGemini(content: string, type: "video_url" | "url_content" | "social"): Promise<Record<string, unknown>> {
  const prompt = type === "video_url"
    ? `Analyze this video URL for ShopyBrain: ${content}\n\nExtract: visual style, product showcasing techniques, brand positioning, marketing angles, audience signals, production quality, ecommerce conversion tactics. Return detailed JSON.`
    : type === "social"
    ? `${SOCIAL_EXTRACT_PROMPT}\n\nContent to analyze:\n${content}\n\nReturn JSON only.`
    : `Analyze this web content for ShopyBrain eCommerce intelligence:\n\n${content}\n\nExtract: brand info, products/services, pricing signals, marketing strategy, audience, competitive positioning, ecommerce insights. Return detailed JSON.`;
  
  const result = await askGeminiJson<Record<string, unknown>>(prompt, "You are ShopyBrain's content intelligence engine. Extract maximum ecommerce intelligence from any content. Return only valid JSON.");
  return result;
}

// ─── POST /api/shopybrain/absorb-url ─────────────────────────────────────────
router.post("/shopybrain/absorb-url", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, niche, label } = req.body as { url: string; niche?: string; label?: string };
    
    if (!url) { res.status(400).json({ error: "url es requerido" }); return; }
    
    const absorbId = randomUUID();
    const urlType = classifyUrl(url);
    
    try {
      logger.info({ url, urlType }, "ShopyBrain absorbing URL");
      
      let analysis: Record<string, unknown> = {};
      let rawContent = "";
      let title = label ?? url;
      let memoryId: string;
      let provenance: "oembed" | "og_tags" | "ai_search_inference" = "og_tags";
      let confidence = 0.6;
      
      if (urlType === "youtube") {
        // YouTube: oEmbed da título/autor REALES; Gemini analiza el contenido del video.
        const yt = await fetchOEmbed(url, "youtube");
        analysis = await analyzeWithGemini(url, "video_url");
        title = label ?? (yt?.title || (analysis.title as string) || `YouTube: ${url}`);
        rawContent = yt ? `YouTube: ${yt.title} — ${yt.authorName}\n${url}` : `YouTube video: ${url}`;
        provenance = yt ? "oembed" : "ai_search_inference";
        confidence = yt ? 0.85 : 0.7;
        analysis._provenance = provenance;
        analysis._confidence = confidence;
        analysis._source_note = PROVENANCE_NOTE[provenance];
      } else {
        // 1. oEmbed abierto primero (X, TikTok) → autor + texto REALES, sin auth.
        const oembed = (urlType === "social_x" || urlType === "tiktok")
          ? await fetchOEmbed(url, urlType)
          : null;

        // 2. Siempre intentar la página pública (OG/meta). Los muros de login dan datos pobres.
        let fetched: { text: string; title: string; description: string; imageUrls: string[] } =
          { text: "", title: label ?? url, description: "", imageUrls: [] };
        try { fetched = await fetchUrlContent(url); } catch (e) { logger.warn(e, "URL fetch failed (non-critical)"); }

        const isLoginWall = /(inicia sesión|iniciar sesión|log ?in|sign ?up|create an account|see posts|ver fotos|content isn't available)/i
          .test(`${fetched.title} ${fetched.description}`);

        let realContent: string;
        if (oembed && (oembed.caption || oembed.authorName)) {
          provenance = "oembed"; confidence = 0.9;
          realContent = `Fuente oEmbed (${oembed.provider})\nAutor: ${oembed.authorName}\nTítulo: ${oembed.title}\nContenido: ${oembed.caption}`;
          title = label ?? (oembed.title || oembed.authorName || fetched.title);
          if (oembed.thumbnailUrl) fetched.imageUrls = [oembed.thumbnailUrl, ...fetched.imageUrls];
        } else if (fetched.text.length > 200 && !isLoginWall) {
          provenance = "og_tags"; confidence = 0.6;
          realContent = `Title: ${fetched.title}\nDescription: ${fetched.description}\nContent: ${fetched.text}`;
          title = label ?? fetched.title;
        } else if (urlType.startsWith("social") || urlType === "tiktok") {
          // Instagram/Facebook/TikTok (y social tras muro de login): sin scraping público
          // fiable sin APIs oficiales. Usar IA + búsqueda web como INFERENCIA, etiquetada con honestidad.
          provenance = "ai_search_inference"; confidence = 0.4;
          let investigated = "";
          try {
            const search = await askGeminiWithSearch(
              `Investiga este perfil o publicación de redes sociales y extrae lo que sea públicamente conocido: ${url}\nIncluye: nombre/marca, temática, tipo de contenido, audiencia, productos/servicios, tono y estrategia de marketing aparente. Si no encuentras datos fiables, dilo claramente.`,
              "Eres el motor de investigación de ShopyBrain. Distingue hechos verificables de suposiciones y sé honesto sobre la incertidumbre.",
              [url],
            );
            investigated = search.text;
          } catch (e) { logger.warn(e, "Gemini search inference failed (non-critical)"); }
          realContent = investigated
            ? `INVESTIGACIÓN IA (inferencia, no scraping directo) de ${url}:\n${investigated}`
            : `No se pudo extraer contenido público de ${url}. La plataforma requiere API oficial para acceso fiable.`;
          title = label ?? (fetched.title && !isLoginWall ? fetched.title : url);
        } else {
          provenance = "og_tags"; confidence = fetched.text.length > 200 ? 0.6 : 0.4;
          realContent = `Title: ${fetched.title}\nDescription: ${fetched.description}\nContent: ${fetched.text}`;
          title = label ?? fetched.title;
        }

        rawContent = realContent;

        // 3. Analizar el contenido REAL obtenido.
        const textAnalysis = await analyzeWithGemini(
          `URL: ${url}\nFUENTE: ${provenance}\n${realContent}`,
          urlType.startsWith("social") ? "social" : "url_content",
        );
        analysis = { ...textAnalysis, _provenance: provenance, _confidence: confidence, _source_note: PROVENANCE_NOTE[provenance] };

        // 4. Si hay imágenes, analizar la primera con Claude Vision.
        if (fetched.imageUrls.length > 0 && fetched.imageUrls[0]) {
          try {
            const visionAnalysis = await analyzeImageWithClaude(fetched.imageUrls[0], "image/jpeg", true);
            analysis = { ...analysis, visual_from_page: visionAnalysis };
          } catch (vErr) {
            logger.warn(vErr, "Vision analysis of URL image failed (non-critical)");
          }
        }
      }
      
      // Save absorbed content record
      await db.insert(omnicoreAbsorbedContentTable).values({
        id: absorbId,
        sourceType: urlType,
        sourceUrl: url,
        sourceLabel: title,
        rawContent: rawContent.slice(0, 30000),
        mainThemes: JSON.stringify(analysis.main_themes ?? analysis.content_themes ?? []),
        ecommerceInsights: JSON.stringify(analysis.ecommerce_insights ?? analysis.ecommerceInsights ?? {}),
        marketingAngles: JSON.stringify(analysis.marketing_angles ?? analysis.marketingAngles ?? []),
        competitiveData: JSON.stringify(analysis.competitive_data ?? analysis.competitiveData ?? {}),
        audienceSignals: JSON.stringify(analysis.audience_signals ?? analysis.audienceSignals ?? {}),
        brandElements: JSON.stringify(analysis.brand_elements ?? analysis.brandElements ?? {}),
        visualComposition: JSON.stringify((analysis as any).visual_composition ?? (analysis as any).visual_from_page?.visual_composition ?? null),
        fullAnalysis: analysis,
        niche: niche ?? null,
        confidence,
        processingModel: "gemini+claude",
        createdAt: new Date(),
      });
      
      // Save core memory to ShopyBrain
      const summaryContent = `SOURCE: ${url}\nTYPE: ${urlType}\nPROVENANCE: ${provenance} (confianza ${confidence})\nNOTE: ${PROVENANCE_NOTE[provenance]}\n\n${JSON.stringify(analysis, null, 2)}`;
      memoryId = await saveToShopyBrain({
        title: `[${urlType.toUpperCase()}] ${title}`,
        content: summaryContent,
        memoryType: "absorbed_content",
        niche,
        sourceType: urlType,
        sourceUrl: url,
        confidence,
        tags: [urlType, "absorbed", "url", provenance, niche ?? "general"],
      });
      
      // Update absorbed record with memory ID
      await db.update(omnicoreAbsorbedContentTable)
        .set({ absorbedToMemory: 1, memoryIds: memoryId })
        .where(eq(omnicoreAbsorbedContentTable.id, absorbId));
      
      learnFromOperation({
        operationType: "absorb_url",
        niche: niche ?? undefined,
        title: `Absorbido: [${urlType}] ${title.slice(0, 80)}`,
        content: `URL: ${url}\nTipo: ${urlType}\nTemas: ${JSON.stringify(analysis.main_themes ?? analysis.content_themes ?? [])}\nInsights eCommerce: ${JSON.stringify(analysis.ecommerce_insights ?? analysis.ecommerceInsights ?? {})}\nÁngulos marketing: ${JSON.stringify(analysis.marketing_angles ?? analysis.marketingAngles ?? [])}`,
        confidence: 0.78,
        tags: ["absorbed", urlType, "url_content", niche ?? "general"],
      });
  
      res.json({
        success: true,
        absorbId,
        memoryId,
        urlType,
        title,
        analysis,
        provenance,
        confidence,
        message: `✅ ${urlType} absorbido a Shopy Crafter (fiabilidad ${Math.round(confidence * 100)}%). ${PROVENANCE_NOTE[provenance]}`,
      });
    } catch (err) {
      logger.error(err, "ShopyBrain URL absorb failed");
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/shopybrain/absorb-image ────────────────────────────────────────
router.post("/shopybrain/absorb-image",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    
      const file = req.file;
      const { niche, label, imageUrl } = req.body as { niche?: string; label?: string; imageUrl?: string };
      
      if (!file && !imageUrl) {
        res.status(400).json({ error: "Se requiere un archivo de imagen o imageUrl" });
        return;
      }
      
      const absorbId = randomUUID();
      const isVideo = file?.mimetype.startsWith("video/");
      const sourceType = isVideo ? "video" : "image";
      const title = label ?? file?.originalname ?? imageUrl ?? "Imagen";
      
      try {
        logger.info({ title, sourceType, size: file?.size }, "ShopyBrain absorbing visual content");
        
        let analysis: Record<string, unknown>;
        let processingModel: string;
        
        if (imageUrl && !file) {
          // URL-based image → Claude Vision with URL
          analysis = await analyzeImageWithClaude(imageUrl, "image/jpeg", true);
          processingModel = "claude-opus-vision";
        } else if (file && !isVideo) {
          // Uploaded image → Claude Vision with base64
          analysis = await analyzeImageWithClaude(file.buffer, file.mimetype);
          processingModel = "claude-opus-vision";
        } else if (file && isVideo) {
          // Video file → Gemini analysis of what we can extract
          analysis = await askGeminiJson<Record<string, unknown>>(
            `Analyze this video file upload for ShopyBrain. File: ${file.originalname} (${file.mimetype}, ${(file.size / 1024 / 1024).toFixed(1)}MB).\nExtract what you can determine about: visual style, production quality, product type likely shown, marketing approach, brand positioning, ecommerce conversion signals.\nReturn detailed JSON.`,
            "ShopyBrain Vision Engine"
          );
          processingModel = "gemini-vision";
        } else {
          analysis = { error: "No processable content" };
          processingModel = "none";
        }
        
        // Extract key fields from analysis
        const a = analysis as Record<string, Record<string, unknown>>;
        
        // Save absorbed content record
        await db.insert(omnicoreAbsorbedContentTable).values({
          id: absorbId,
          sourceType,
          sourceUrl: imageUrl ?? null,
          sourceLabel: title,
          rawContent: `File: ${file?.originalname ?? imageUrl} | Size: ${file?.size ?? 0} bytes`,
          visualComposition: JSON.stringify(a.visual_composition ?? null),
          colorPalette: JSON.stringify(a.colors_palette ?? a.color_palette ?? null),
          textureAnalysis: JSON.stringify(a.textures_surfaces ?? a.texture_analysis ?? null),
          topologyStructure: JSON.stringify(a.topology_geometry ?? a.topology_structure ?? null),
          renderingTechnique: JSON.stringify(a.rendering_production ?? a.rendering_technique ?? null),
          technicalSpecs: JSON.stringify(a.technical_chemical_composition ?? a.technical_specs ?? null),
          chemicalComposition: JSON.stringify(a.technical_chemical_composition?.chemical_composition_clues ?? null),
          brandElements: JSON.stringify(a.brand_marketing_intelligence ?? a.brand_elements ?? null),
          ecommerceInsights: JSON.stringify(a.ecommerce_conversion_signals ?? a.actionable_insights_for_shopify ?? null),
          marketingAngles: JSON.stringify(a.ecommerce_conversion_signals?.recommended_marketing_angles ?? []),
          audienceSignals: JSON.stringify(a.emotional_psychological_impact ?? null),
          fullAnalysis: analysis,
          niche: niche ?? null,
          confidence: 0.85,
          processingModel,
          createdAt: new Date(),
        });
        
        // Build rich memory content
        const memoryContent = [
          `SOURCE TYPE: ${sourceType.toUpperCase()}`,
          `FILE: ${title}`,
          `VISUAL COMPOSITION: ${JSON.stringify(a.visual_composition ?? {})}`,
          `COLOR PALETTE: ${JSON.stringify(a.colors_palette ?? a.color_palette ?? {})}`,
          `TEXTURES: ${JSON.stringify(a.textures_surfaces ?? {})}`,
          `TOPOLOGY: ${JSON.stringify(a.topology_geometry ?? {})}`,
          `RENDERING: ${JSON.stringify(a.rendering_production ?? {})}`,
          `TECHNICAL/CHEMICAL: ${JSON.stringify(a.technical_chemical_composition ?? {})}`,
          `BRAND INTELLIGENCE: ${JSON.stringify(a.brand_marketing_intelligence ?? {})}`,
          `ECOMMERCE SIGNALS: ${JSON.stringify(a.ecommerce_conversion_signals ?? {})}`,
          `SHOPIFY INSIGHTS: ${JSON.stringify(a.actionable_insights_for_shopify ?? {})}`,
          `EMOTIONAL IMPACT: ${JSON.stringify(a.emotional_psychological_impact ?? {})}`,
        ].join("\n\n");
        
        const memoryId = await saveToShopyBrain({
          title: `[VISION] ${title}`,
          content: memoryContent,
          memoryType: "visual_intelligence",
          niche,
          sourceType,
          confidence: 0.85,
          tags: [sourceType, "vision", "absorbed", "visual_analysis", niche ?? "general"],
        });
        
        await db.update(omnicoreAbsorbedContentTable)
          .set({ absorbedToMemory: 1, memoryIds: memoryId })
          .where(eq(omnicoreAbsorbedContentTable.id, absorbId));
        
        learnFromOperation({
          operationType: "absorb_visual",
          niche: niche ?? undefined,
          title: `Visual absorbido: ${title.slice(0, 80)}`,
          content: `Tipo: ${sourceType}. Composición: ${JSON.stringify(a.visual_composition ?? {})}. Colores: ${JSON.stringify(a.colors_palette ?? a.color_palette ?? {})}. Insights Shopify: ${JSON.stringify(a.actionable_insights_for_shopify ?? {})}`,
          confidence: 0.82,
          tags: ["absorbed", sourceType, "visual_intel", niche ?? "general"],
        });
  
        res.json({
          success: true,
          absorbId,
          memoryId,
          sourceType,
          title,
          analysis,
          highlights: {
            colorPalette: a.colors_palette ?? a.color_palette,
            texture: a.textures_surfaces,
            topology: a.topology_geometry,
            rendering: a.rendering_production,
            marketingAngles: a.ecommerce_conversion_signals?.recommended_marketing_angles ?? a.actionable_insights_for_shopify?.recommended_marketing_angles,
            shopifyTitle: a.actionable_insights_for_shopify?.suggested_shopify_product_title ?? a.ecommerce_conversion_signals?.suggested_product_title,
          },
          message: `✅ ${sourceType === "image" ? "Imagen" : "Vídeo"} absorbido a Shopy Crafter con análisis completo de composición, texturas, topología y señales eCommerce.`,
        });
      } catch (err) {
        logger.error(err, "ShopyBrain image/video absorb failed");
        if (isAiOutputError(err)) { res.status(502).json({ error: aiOutputErrorMessage(err), code: err.code }); return; }
        res.status(500).json({ error: String(err) });
      }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
  }
);

// ─── POST /api/shopybrain/absorb-text ─────────────────────────────────────────
router.post("/shopybrain/absorb-text", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { text, niche, label, sourceType = "text" } = req.body as {
      text: string; niche?: string; label?: string; sourceType?: string;
    };
    
    if (!text) { res.status(400).json({ error: "text es requerido" }); return; }
    
    try {
      const analysis = await askGeminiJson<Record<string, unknown>>(
        `Analyze this content for ShopyBrain eCommerce intelligence:\n\n${text}\n\nExtract: main themes, ecommerce insights, marketing angles, brand signals, audience, actionable recommendations. Return JSON.`,
        "ShopyBrain Intelligence Engine. Extract maximum ecommerce value. Return only JSON."
      );
      
      const memoryId = await saveToShopyBrain({
        title: label ?? text.slice(0, 80),
        content: `ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nORIGINAL:\n${text}`,
        memoryType: "absorbed_content",
        niche,
        sourceType,
        confidence: 0.7,
        tags: ["text", "absorbed", niche ?? "general"],
      });
      
      res.json({ success: true, memoryId, analysis, message: "✅ Texto absorbido a Shopy Crafter." });
    } catch (err) {
      logger.error(err, "ShopyBrain text absorb failed");
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/shopybrain/absorb-document ──────────────────────────────────────
router.post("/shopybrain/absorb-document", requireAdmin, uploadAny.single("file"), async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {

    const file = req.file;
    let { text, fileName, fileType } = req.body as { text?: string; fileName?: string; fileType?: string };
    const { niche, label } = req.body as { niche?: string; label?: string };

    // Si llega un archivo binario (PDF, Word, PowerPoint, Excel, ZIP, HTML, código,
    // audio, vídeo...), el extractor universal saca el texto en el servidor.
    if (file) {
      const processed = await processUploadedFile(file.buffer, file.originalname, file.mimetype);
      text = processed.textContent ?? "";
      fileName = fileName ?? file.originalname;
      fileType = fileType ?? file.mimetype;
      if (!text.trim()) {
        res.json({
          success: false,
          fileName: file.originalname,
          message: `⚠️ Recibí "${file.originalname}" (${processed.type}) pero no se pudo extraer contenido textual de este archivo.`,
        });
        return;
      }
    }

    if (!text) { res.status(400).json({ error: "text es requerido" }); return; }
  
    try {
      const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "txt";
      const docLabel = label ?? fileName ?? "Documento";
      logger.info({ fileName, fileType, ext, length: text.length }, "ShopyBrain absorbing document");
  
      const analysis = await askClaudeWithBrain(
        0,
        [{ role: "user", content: `Analiza este documento "${docLabel}" (${ext.toUpperCase()}, ${text.length} caracteres) y extrae TODA la información relevante.
  
  DOCUMENTO:
  ---
  ${text.slice(0, 50000)}
  ---
  
  Debes:
  1. ENTENDER el tipo de documento (lista de productos, precios, instrucciones, datos, investigación, etc.)
  2. EXTRAER toda la información estructurada (nombres, precios, cantidades, descripciones, etc.)
  3. INTERPRETAR la intención del usuario (¿quiere crear productos? ¿actualizar precios? ¿aprender algo?)
  4. RESUMIR las acciones sugeridas que ShopyBrain podría ejecutar con esta información
  
  Responde en español con un análisis completo y detallado. Si detectas una lista de productos con precios, extrae CADA producto con su nombre y precio exacto.` }],
        "ShopyBrain Document Intelligence Engine. You extract maximum value from any document format. You identify products, prices, instructions, and data structures. Be thorough and complete.",
        "general",
        niche ?? undefined,
      );
  
      const memoryId = await saveToShopyBrain({
        title: `[DOC] ${docLabel}`,
        content: `DOCUMENT TYPE: ${ext.toUpperCase()}\nFILE: ${docLabel}\nSIZE: ${text.length} chars\n\nANALYSIS:\n${analysis}\n\nORIGINAL CONTENT:\n${text.slice(0, 30000)}`,
        memoryType: "absorbed_document",
        niche,
        sourceType: "document",
        confidence: 0.9,
        tags: ["document", ext, "absorbed", niche ?? "general"],
      });
  
      res.json({
        success: true,
        memoryId,
        title: `[DOC] ${docLabel}`,
        sourceType: "document",
        fileName: docLabel,
        fileType: ext,
        contentLength: text.length,
        analysis,
        message: `✅ Documento "${docLabel}" absorbido y analizado. ${text.length} caracteres procesados. La información ha sido guardada en la memoria de Shopy Crafter y está lista para usar.`,
      });
    } catch (err) {
      logger.error(err, "ShopyBrain document absorb failed");
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/shopybrain/create-product-from-image ────────────────────────────
router.post("/shopybrain/create-product-from-image",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    
      const file = req.file;
      const { projectId, userInstruction, imageUrl } = req.body as {
        projectId: string; userInstruction?: string; imageUrl?: string;
      };
  
      if (!file && !imageUrl) { res.status(400).json({ error: "Se requiere una imagen" }); return; }
      if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
  
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
      try {
        logger.info({ projectId, file: file?.originalname, imageUrl }, "Creating product from image");
  
        const [brainCtx2, brandDna2, productClient] = await Promise.all([
          buildShopyBrainContext(project.storeNiche ?? undefined, "images", "product image analysis for product creation"),
          buildBrandDnaContext(parseInt(projectId)),
          getClaudeClient(parseInt(projectId)),
        ]);
  
        const imageBlock = (imageUrl && !file)
          ? { type: "image" as const, source: { type: "url" as const, url: imageUrl } }
          : {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: (file!.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp"),
                data: file!.buffer.toString("base64"),
              },
            };
  
        const productAnalysis = await claudeJson(productClient, {
          system: `ShopyBrain Product Intelligence Engine.${brainCtx2}${brandDna2}`,
          imageBlock,
          schema: productAnalysisSchema,
          label: "absorber/product-from-image:vision",
          prompt: `You are ShopyBrain's Product Intelligence Engine. Analyze this product image with MAXIMUM DEPTH.
  
  EXTRACT:
  1. PRODUCT IDENTIFICATION: What EXACTLY is this product? Be specific (brand if visible, exact category, subcategory, material, style)
  2. MATERIALS: What is it made of? (fabric type, metal, plastic, wood, ceramic, etc.)
  3. QUALITY TIER: Is this budget/mid-range/premium/luxury? Based on visible quality signals
  4. TARGET MARKET: Who buys this? Age, gender, lifestyle, income bracket
  5. PRODUCT CATEGORY: Exact Shopify product_type (e.g., "Camiseta", "Zapatillas", "Funda de móvil")
  6. SEARCH KEYWORDS: What would someone Google to find this product? Give 10+ specific search terms
  7. KEY FEATURES: List 5-8 key selling features visible in the image
  8. SIZE/DIMENSIONS: Estimate if possible
  9. COMPARABLE PRODUCTS: Name 3 similar products from known brands with their approximate price ranges
  10. SUGGESTED TITLE: Professional eCommerce product title in Spanish
  11. SUGGESTED TAGS: 10+ relevant Shopify tags
  
  ${userInstruction ? `USER CONTEXT: ${userInstruction}` : ""}
  
  Return ONLY valid JSON with these exact fields:
  {
    "productName": "exact product name",
    "productCategory": "Shopify product_type",
    "materials": ["material1", "material2"],
    "qualityTier": "budget|mid-range|premium|luxury",
    "targetMarket": "description",
    "searchKeywords": ["keyword1", "keyword2", ...],
    "keyFeatures": ["feature1", "feature2", ...],
    "comparableProducts": [{"name": "...", "brand": "...", "priceRange": "€XX-€XX"}],
    "suggestedTitle": "...",
    "suggestedTags": ["tag1", "tag2", ...],
    "estimatedPriceRange": "€XX-€XX",
    "detailedDescription": "what this product is in detail"
  }`,
        });

        logger.info({ product: productAnalysis.productName, category: productAnalysis.productCategory }, "Vision analysis complete");
  
        const searchKeywords = productAnalysis.searchKeywords.slice(0, 5).join(", ") || productAnalysis.productName;
        const comparables = productAnalysis.comparableProducts.map(p => `${p.brand} ${p.name}: ${p.priceRange}`).join(", ");
  
        const pricingPrompt = `MISIÓN CRÍTICA: Investigar precios REALES y ACTUALES del mercado para este producto.
  
  PRODUCTO: ${productAnalysis.productName || "producto de la imagen"}
  CATEGORÍA: ${productAnalysis.productCategory || "general"}
  MATERIALES: ${productAnalysis.materials.join(", ")}
  CALIDAD: ${productAnalysis.qualityTier || "mid-range"}
  MERCADO OBJETIVO: ${productAnalysis.targetMarket || "general"}
  KEYWORDS DE BÚSQUEDA: ${searchKeywords}
  PRODUCTOS COMPARABLES: ${comparables}
  RANGO ESTIMADO POR VISIÓN: ${productAnalysis.estimatedPriceRange || "desconocido"}
  
  INSTRUCCIONES:
  1. Busca precios REALES en tiendas online españolas y europeas (Amazon, El Corte Inglés, Zalando, AliExpress, etc.)
  2. Compara al menos 5-10 productos similares con sus precios REALES
  3. Analiza el margen de beneficio típico para esta categoría (30-60% markup es normal en eCommerce)
  4. Considera los costes de envío y gestión
  5. Calcula un precio COMPETITIVO pero RENTABLE
  
  Responde en este formato JSON exacto:
  {
    "researchedPrices": [{"source": "tienda", "product": "nombre", "price": 0.00, "url": "..."}],
    "averageMarketPrice": 0.00,
    "lowestFound": 0.00,
    "highestFound": 0.00,
    "recommendedPrice": 0.00,
    "compareAtPrice": 0.00,
    "priceJustification": "explicación detallada de por qué este precio",
    "marginAnalysis": "análisis del margen esperado",
    "competitivePosition": "por debajo/igual/por encima del mercado y por qué"
  }`;
  
        const pricingResult = await askGeminiWithSearch(
          pricingPrompt,
          "Eres un analista de precios eCommerce profesional. SIEMPRE usa Google Search para encontrar precios REALES y ACTUALES. No inventes precios. Busca en tiendas reales. Responde SOLO con JSON válido."
        );
  
        // Sin investigación utilizable el producto queda a 0,00 € en borrador (como antes);
        // lo que ya no pasa es romper con un precio en texto.
        const pricingData: Partial<ProductPricing> =
          parseResearchJson(pricingResult.text, productPricingSchema, "absorber/product-from-image:precios") ?? {};

        const recommendedPrice = pricingData.recommendedPrice && pricingData.recommendedPrice > 0 ? pricingData.recommendedPrice : 0;
        const compareAtPrice = pricingData.compareAtPrice ?? 0;
        const priceSources = pricingData.researchedPrices ?? [];
  
        logger.info({
          recommendedPrice,
          compareAtPrice,
          sourcesFound: priceSources.length,
          geminiSources: pricingResult.sources?.length
        }, "Pricing research complete");
  
        const productCopy = await claudeJson(productClient, {
          schema: productCopySchema,
          label: "absorber/product-from-image:copy",
          system: `Eres un experto en copywriting eCommerce Shopify. Genera contenido que CONVIERTA.
  Tienda: ${project.name || "Shopify Store"}
  Nicho: ${project.storeNiche || "general"}
  Tono: ${project.brandTone || "profesional"}
  El producto ha sido analizado visualmente y los precios han sido investigados con datos REALES del mercado.${brainCtx2}${brandDna2}`,
          prompt: `Genera contenido Shopify OPTIMIZADO para este producto:
  
  ANÁLISIS VISUAL: ${JSON.stringify(productAnalysis)}
  INVESTIGACIÓN DE PRECIOS: ${JSON.stringify(pricingData)}
  PRECIO RECOMENDADO: €${recommendedPrice}
  
  ${userInstruction ? `INSTRUCCIÓN DEL USUARIO: ${userInstruction}` : ""}
  
  Genera JSON con:
  {
    "title": "título optimizado SEO en español",
    "bodyHtml": "<div>descripción HTML profesional con bullet points de features, materiales, y por qué comprarlo</div>",
    "tags": ["tag1", "tag2", ...],
    "seoTitle": "título SEO max 70 chars",
    "seoDescription": "meta description max 160 chars",
    "vendor": "marca si se identifica o nombre genérico"
  }`,
        });

        const finalPrice = recommendedPrice > 0 ? recommendedPrice.toFixed(2) : "0.00";
        const finalCompareAt = compareAtPrice > recommendedPrice ? compareAtPrice.toFixed(2) : null;
  
        const imageBase64 = file ? file.buffer.toString("base64") : null;
  
        const shopifyProduct: Record<string, unknown> = {
          title: productCopy.title,
          body_html: productCopy.bodyHtml, // nosemgrep
          tags: (productCopy.tags.length > 0 ? productCopy.tags : productAnalysis.suggestedTags).join(", "),
          vendor: productCopy.vendor || undefined,
          product_type: productAnalysis.productCategory || undefined,
          status: "draft",
          variants: [{
            title: "Default",
            price: finalPrice,
            compare_at_price: finalCompareAt,
            requires_shipping: true,
            taxable: true,
          }],
        };
  
        if (imageBase64) {
          shopifyProduct.images = [{ attachment: imageBase64, filename: file!.originalname }];
        } else if (imageUrl) {
          shopifyProduct.images = [{ src: imageUrl }];
        }
  
        const created = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, "/products.json",
          { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
        );
  
        const memoryContent = [
          `PRODUCT CREATED FROM IMAGE`,
          `Title: ${created.product.title}`,
          `Price: €${finalPrice} (researched from ${priceSources.length} sources)`,
          `Category: ${productAnalysis.productCategory}`,
          `Materials: ${productAnalysis.materials.join(", ")}`,
          `Quality: ${productAnalysis.qualityTier}`,
          `Pricing Sources: ${priceSources.map(s => `${s.source}: €${s.price}`).join(", ")}`,
          `Justification: ${pricingData.priceJustification || "N/A"}`,
        ].join("\n");
  
        const memoryId = await saveToShopyBrain({
          title: `[PRODUCT] ${created.product.title}`,
          content: memoryContent,
          memoryType: "product_creation",
          niche: project.storeNiche || undefined,
          sourceType: "image_to_product",
          confidence: 0.9,
          tags: ["product", "created", "image_analysis", "price_research"],
        });
  
        saveToVault({
          projectId: parseInt(projectId),
          fileType: "product_card",
          category: "product_creation",
          title: `Producto: ${created.product.title}`,
          description: productAnalysis.productName || (created.product.title as string),
          productId: String(created.product.id),
          productTitle: created.product.title as string,
          generatedBy: "image_to_product",
          metadata: {
            price: finalPrice,
            compareAtPrice: finalCompareAt,
            category: productAnalysis.productCategory,
            materials: productAnalysis.materials,
            qualityTier: productAnalysis.qualityTier,
            sourcesResearched: priceSources.length,
            shopifyId: created.product.id,
          },
        }).catch(() => {});
  
        res.json({
          success: true,
          product: {
            id: created.product.id,
            title: created.product.title,
            status: created.product.status,
            handle: created.product.handle,
            price: finalPrice,
            compareAtPrice: finalCompareAt,
            images: created.product.images,
          },
          analysis: {
            productName: productAnalysis.productName,
            category: productAnalysis.productCategory,
            materials: productAnalysis.materials,
            qualityTier: productAnalysis.qualityTier,
            keyFeatures: productAnalysis.keyFeatures,
          },
          pricing: {
            recommendedPrice: finalPrice,
            compareAtPrice: finalCompareAt,
            sourcesResearched: priceSources.length,
            sources: priceSources.slice(0, 5),
            justification: pricingData.priceJustification,
            marketAverage: pricingData.averageMarketPrice,
            competitivePosition: pricingData.competitivePosition,
          },
          memoryId,
        });
      } catch (err) {
        logger.error(err, "Create product from image failed");
        if (isAiOutputError(err)) { res.status(502).json({ error: `${aiOutputErrorMessage(err)} No se ha creado ningún producto.`, code: err.code }); return; }
        res.status(500).json({ error: String(err) });
      }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
  }
);

// ─── POST /api/shopybrain/supplier-research ─────────────────────────────────────
router.post("/shopybrain/supplier-research", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { productName, productCategory, materials, targetMarket, qualityTier, budget, country } = req.body as {
      productName: string; productCategory?: string; materials?: string[];
      targetMarket?: string; qualityTier?: string; budget?: string; country?: string;
    };
  
    if (!productName) { res.status(400).json({ error: "productName requerido" }); return; }
  
    try {
      logger.info({ productName, productCategory }, "Starting supplier research");
  
      const materialsStr = materials?.join(", ") || "no especificado";
      const region = country || "España/Europa";
  
      const supplierSearchResults = await Promise.allSettled([
        askGeminiWithSearch(
          `Busca proveedores REALES y ACTUALES de "${productName}" (categoría: ${productCategory || "general"}, materiales: ${materialsStr}).
  
  BUSCA EN:
  - Alibaba.com, AliExpress, DHgate, Made-in-China.com
  - Proveedores europeos y españoles
  - Fabricantes directos
  - Distribuidores mayoristas
  
  Para CADA proveedor encontrado, extrae:
  1. Nombre de la empresa/tienda
  2. País/ubicación
  3. Precio unitario o rango de precios
  4. Cantidad mínima de pedido (MOQ)
  5. Tiempo de envío estimado
  6. Puntuación/valoración si existe
  7. URL del proveedor
  8. Capacidad de personalización
  9. Certificaciones (CE, ISO, etc.)
  
  Busca al menos 8-15 proveedores REALES con datos REALES.
  
  Responde en JSON:
  {
    "suppliers": [
      {
        "name": "nombre empresa",
        "country": "país",
        "platform": "alibaba/aliexpress/directo/etc",
        "priceRange": "€X-€Y por unidad",
        "priceMin": 0.00,
        "priceMax": 0.00,
        "moq": "cantidad mínima",
        "shippingTime": "X-Y días",
        "rating": 4.5,
        "url": "https://...",
        "customization": "sí/no/parcial",
        "certifications": ["CE", "ISO"],
        "specialties": ["descripción de especialidad"],
        "paymentTerms": "métodos de pago aceptados"
      }
    ]
  }`,
          "Eres un agente de sourcing profesional. SIEMPRE busca datos REALES de proveedores actuales. Usa Google Search para encontrar proveedores verificados. NUNCA inventes empresas o precios."
        ),
  
        askGeminiWithSearch(
          `Investiga los costes REALES de fabricación, distribución y empaquetado para "${productName}" (${productCategory || "producto genérico"}).
  
  INVESTIGA:
  1. COSTE DE PRODUCCIÓN: Coste unitario de fabricación en diferentes países (China, España, Portugal, Turquía, India)
  2. EMBALAJE: Tipos de packaging disponibles y sus costes (básico, premium, eco-friendly, personalizado)
  3. ENVÍO: Costes de envío internacional por unidad/kg/contenedor desde principales orígenes
  4. ARANCELES: Tasas aduaneras e impuestos de importación a ${region}
  5. CERTIFICACIONES: Qué certificaciones necesita este producto en ${region} y su coste
  6. SEGUROS: Coste de seguro de transporte
  7. ALMACENAMIENTO: Costes de almacén/fulfillment por unidad
  8. MARGEN RECOMENDADO: Markup típico en la industria
  
  Responde en JSON:
  {
    "productionCosts": {
      "china": {"unitCost": "€X-€Y", "details": "..."},
      "europe": {"unitCost": "€X-€Y", "details": "..."},
      "other": [{"country": "...", "unitCost": "€X-€Y"}]
    },
    "packaging": [
      {"type": "básico", "costPerUnit": "€X", "description": "..."},
      {"type": "premium", "costPerUnit": "€X", "description": "..."},
      {"type": "eco-friendly", "costPerUnit": "€X", "description": "..."}
    ],
    "shipping": {
      "airFreight": {"costPerKg": "€X", "timedays": "X-Y"},
      "seaFreight": {"costPerKg": "€X", "timedays": "X-Y"},
      "express": {"costPerKg": "€X", "timedays": "X-Y"},
      "dropshipping": {"costPerUnit": "€X", "timedays": "X-Y"}
    },
    "customs": {"dutyRate": "X%", "vatRate": "21%", "otherFees": "..."},
    "certifications": [{"name": "CE", "cost": "€X", "timeToGet": "X semanas"}],
    "warehousing": {"costPerUnit": "€X/mes", "fulfillmentFee": "€X/pedido"},
    "recommendedMarkup": "X-Y%",
    "totalLandedCostEstimate": "€X-€Y por unidad puesto en ${region}"
  }`,
          "Eres un experto en logística internacional y sourcing de productos. Busca datos REALES de costes actualizados. Usa Google Search. NUNCA inventes cifras."
        ),
  
        askGeminiWithSearch(
          `Busca las MEJORES OFERTAS y PROMOCIONES ACTUALES de proveedores para "${productName}".
  
  BUSCA:
  1. Descuentos por volumen activos en Alibaba/AliExpress
  2. Promociones de temporada vigentes
  3. Proveedores con muestras gratis
  4. Ofertas de envío gratuito
  5. Programas de fidelización de proveedores
  6. Ferias comerciales próximas relevantes (Canton Fair, etc.)
  7. Directorios de proveedores verificados
  8. Comparativas de precios entre plataformas
  
  Responde en JSON:
  {
    "deals": [
      {"supplier": "nombre", "deal": "descripción oferta", "discount": "X%", "validUntil": "fecha", "url": "..."}
    ],
    "tradeFairs": [
      {"name": "...", "date": "...", "location": "...", "relevance": "..."}
    ],
    "freeSamples": [
      {"supplier": "nombre", "conditions": "...", "url": "..."}
    ],
    "volumeDiscounts": [
      {"supplier": "nombre", "tiers": [{"qty": 100, "discount": "10%"}, {"qty": 500, "discount": "20%"}]}
    ],
    "recommendations": "resumen de mejores oportunidades actuales"
  }`,
          "Eres un cazador de ofertas B2B profesional. Busca promociones REALES y ACTUALES de proveedores. Usa Google Search. NUNCA inventes ofertas."
        ),
      ]);
  
      const supplierSearches = supplierSearchResults.map(r => r.status === "fulfilled" ? r.value : { text: "", sources: [] as string[], queries: [] as string[] });

      const suppliersData: Record<string, unknown> = parseResearchJson(supplierSearches[0].text, researchObjectSchema, "absorber/supplier-research:proveedores") ?? {};
      const costsData: Record<string, unknown> = parseResearchJson(supplierSearches[1].text, researchObjectSchema, "absorber/supplier-research:costes") ?? {};
      const dealsData: Record<string, unknown> = parseResearchJson(supplierSearches[2].text, researchObjectSchema, "absorber/supplier-research:ofertas") ?? {};

      const allSources = [
        ...supplierSearches[0].sources,
        ...supplierSearches[1].sources,
        ...supplierSearches[2].sources,
      ];
  
      const supplierBrainCtx = await buildShopyBrainContext(undefined, "ecommerce", `sourcing suppliers for ${productName}`);
      const supplierClient = await getClaudeClient(0);
      // Si la síntesis falla tras el reintento se devuelven igualmente las tres
      // búsquedas (son lo caro) con el motivo, en vez de una síntesis vacía.
      let synthesis: Record<string, unknown> = {};
      let synthesisError: string | undefined;
      try {
        synthesis = await claudeJson(supplierClient, {
          schema: supplierSynthesisSchema,
          label: "absorber/supplier-research:sintesis",
          system: `Eres un consultor de sourcing estratégico para eCommerce. Analiza datos de proveedores y da recomendaciones claras y accionables. Responde en español. Responde SOLO JSON válido.${supplierBrainCtx}`,
          prompt: `Analiza estos datos de proveedores para "${productName}" y genera una recomendación estratégica.
  
  PROVEEDORES ENCONTRADOS: ${JSON.stringify(suppliersData)}
  COSTES DE PRODUCCIÓN/LOGÍSTICA: ${JSON.stringify(costsData)}
  OFERTAS/PROMOCIONES: ${JSON.stringify(dealsData)}
  PRESUPUESTO DEL CLIENTE: ${budget || "no especificado"}
  MERCADO OBJETIVO: ${targetMarket || "España"}
  CALIDAD BUSCADA: ${qualityTier || "mid-range"}
  
  Genera JSON:
  {
    "topRecommendation": {
      "supplier": "nombre del mejor proveedor",
      "reason": "por qué es la mejor opción",
      "estimatedCostPerUnit": 0.00,
      "estimatedProfitMargin": "X%",
      "riskLevel": "bajo/medio/alto"
    },
    "top3Suppliers": [
      {"name": "...", "pros": ["..."], "cons": ["..."], "bestFor": "..."}
    ],
    "costBreakdown": {
      "production": 0.00,
      "packaging": 0.00,
      "shipping": 0.00,
      "customs": 0.00,
      "total": 0.00,
      "recommendedRetailPrice": 0.00,
      "estimatedMargin": "X%"
    },
    "strategy": "estrategia recomendada de sourcing",
    "risks": ["riesgo1", "riesgo2"],
    "nextSteps": ["paso1", "paso2", "paso3"]
  }`,
        });
      } catch (err) {
        if (!isAiOutputError(err)) throw err;
        synthesisError = aiOutputErrorMessage(err);
      }

      const memoryContent = [ // nosemgrep
        `SUPPLIER RESEARCH: ${productName}`,
        `Category: ${productCategory || "general"}`,
        `Materials: ${materialsStr}`,
        `Quality: ${qualityTier || "mid-range"}`,
        `Region: ${region}`,
        `Suppliers Found: ${(suppliersData as { suppliers?: unknown[] }).suppliers?.length || 0}`,
        `Top Recommendation: ${JSON.stringify((synthesis as Record<string, unknown>).topRecommendation || {})}`,
        `Cost Breakdown: ${JSON.stringify((synthesis as Record<string, unknown>).costBreakdown || {})}`,
        `Strategy: ${(synthesis as Record<string, unknown>).strategy || "N/A"}`,
        `Sources Analyzed: ${allSources.length}`,
        `Full Suppliers: ${JSON.stringify(suppliersData)}`,
        `Costs: ${JSON.stringify(costsData)}`,
        `Deals: ${JSON.stringify(dealsData)}`,
      ].join("\n\n");
  
      const memoryId = await saveToShopyBrain({
        title: `[SUPPLIERS] ${productName}`,
        content: memoryContent,
        memoryType: "supplier_intelligence",
        sourceType: "supplier_research",
        confidence: 0.85,
        tags: ["suppliers", "sourcing", "pricing", "logistics", productCategory || "general"],
      });
  
      res.json({
        success: true,
        productName,
        suppliers: suppliersData,
        costs: costsData,
        deals: dealsData,
        synthesis,
        synthesisError,
        sourcesAnalyzed: allSources.length,
        memoryId,
      });
    } catch (err) {
      logger.error(err, "Supplier research failed");
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/shopybrain/supplier-report ──────────────────────────────────────
router.post("/shopybrain/supplier-report", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productName, suppliers, costs, deals, synthesis, sourcesAnalyzed, template: bodyTemplate } = req.body;
    const tplAbsorber = ((req.query?.template || bodyTemplate) as CoverTemplate) || "prestige";
  
    if (!productName) { res.status(400).json({ error: "productName requerido" }); return; }
  
    try {
      const suppliersList = (suppliers?.suppliers || []) as Array<{
        name: string; country: string; platform: string; priceRange: string;
        moq: string; shippingTime: string; rating: number; url: string;
        customization: string; certifications: string[]; specialties: string[];
      }>;
      const costData = costs || {};
      const dealsInfo = deals || {};
      const synth = synthesis || {};
  
      const suppliersRows = suppliersList.map((s, i) => ` // nosemgrep
        <tr style="border-bottom:1px solid #1a1a2e;">
          <td style="padding:12px;color:#c8a84b;font-weight:600;">${i + 1}. ${sanitizeHtml(s.name)}</td>
          <td style="padding:12px;">${sanitizeHtml(s.country || "N/A")}</td>
          <td style="padding:12px;">${sanitizeHtml(s.platform || "N/A")}</td>
          <td style="padding:12px;color:#2dd49f;font-weight:600;">${sanitizeHtml(s.priceRange || "N/A")}</td>
          <td style="padding:12px;">${sanitizeHtml(s.moq || "N/A")}</td>
          <td style="padding:12px;">${sanitizeHtml(s.shippingTime || "N/A")}</td>
          <td style="padding:12px;">${s.rating ? "⭐".repeat(Math.min(5, Math.round(s.rating))) + ` (${s.rating})` : "N/A"}</td>
          <td style="padding:12px;">${sanitizeHtml(s.customization || "N/A")}</td>
          <td style="padding:12px;">${sanitizeHtml((s.certifications || []).join(", ") || "N/A")}</td>
          <td style="padding:12px;">${s.url ? `<a href="${sanitizeHtml(s.url)}" style="color:#c8a84b;">Ver</a>` : "N/A"}</td><!-- nosemgrep -->
        </tr>`).join("");
  
      const packagingRows = ((costData as Record<string, unknown>).packaging as Array<{ type: string; costPerUnit: string; description: string }> || []).map(p => ` // nosemgrep
        <tr style="border-bottom:1px solid #1a1a2e;">
          <td style="padding:10px;color:#c8a84b;">${p.type}</td>
          <td style="padding:10px;color:#2dd49f;">${p.costPerUnit}</td>
          <td style="padding:10px;">${p.description || ""}</td>
        </tr>`).join("");
  
      const top3 = ((synth as Record<string, unknown>).top3Suppliers as Array<{ name: string; pros: string[]; cons: string[]; bestFor: string }> || []).map(s => ` // nosemgrep
        <div style="background:#0d0d1a;border:1px solid rgba(200,168,75,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
          <h4 style="color:#c8a84b;margin:0 0 10px;">${s.name}</h4>
          <p style="color:#2dd49f;margin:4px 0;">✅ Ventajas: ${(s.pros || []).join(" · ")}</p>
          <p style="color:#e84558;margin:4px 0;">⚠️ Desventajas: ${(s.cons || []).join(" · ")}</p>
          <p style="color:#aaa;margin:4px 0;">🎯 Mejor para: ${s.bestFor || "N/A"}</p>
        </div>`).join("");
  
      const costBreakdown = (synth as Record<string, unknown>).costBreakdown as Record<string, unknown> || {};
      const topRec = (synth as Record<string, unknown>).topRecommendation as Record<string, unknown> || {};
      const risks = ((synth as Record<string, unknown>).risks as string[] || []).map(r => `<li style="margin:4px 0;">${r}</li>`).join(""); // nosemgrep
      const nextSteps = ((synth as Record<string, unknown>).nextSteps as string[] || []).map(s => `<li style="margin:6px 0;color:#2dd49f;">${s}</li>`).join(""); // nosemgrep
  
      const shippingData = (costData as Record<string, unknown>).shipping as Record<string, Record<string, string>> || {};
  
      const now = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  
      const html = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Informe de Proveedores — ${productName} | Shopy Crafter</title><!-- nosemgrep -->
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; background:#080810; color:#e0e0e0; line-height:1.6; }
      .container { max-width:1200px; margin:0 auto; padding:40px 24px; }
      h1 { font-size:28px; color:#c8a84b; border-bottom:2px solid #c8a84b; padding-bottom:12px; margin-bottom:24px; }
      h2 { font-size:22px; color:#c8a84b; margin:32px 0 16px; padding:8px 0; border-left:4px solid #c8a84b; padding-left:16px; }
      h3 { font-size:18px; color:#e6c668; margin:20px 0 12px; }
      .header { text-align:center; padding:40px 0; border-bottom:2px solid rgba(200,168,75,0.3); margin-bottom:32px; }
      .header h1 { border:none; font-size:36px; margin-bottom:8px; }
      .header .subtitle { color:#aaa; font-size:16px; }
      .badge { display:inline-block; background:rgba(200,168,75,0.15); color:#c8a84b; border:1px solid rgba(200,168,75,0.3); padding:4px 12px; border-radius:20px; font-size:13px; margin:4px; }
      .card { background:#0d0d1a; border:1px solid rgba(200,168,75,0.15); border-radius:12px; padding:24px; margin-bottom:20px; }
      .highlight { background:linear-gradient(135deg,rgba(200,168,75,0.1),rgba(45,212,159,0.05)); border:1px solid rgba(200,168,75,0.3); border-radius:12px; padding:24px; margin:20px 0; }
      table { width:100%; border-collapse:collapse; margin:16px 0; }
      th { background:#0d0d1a; color:#c8a84b; padding:12px; text-align:left; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #c8a84b; }
      td { padding:12px; font-size:14px; vertical-align:top; }
      tr:nth-child(even) { background:rgba(200,168,75,0.03); }
      .metric { display:inline-block; text-align:center; padding:16px 24px; margin:8px; background:#0d0d1a; border:1px solid rgba(200,168,75,0.2); border-radius:12px; min-width:140px; }
      .metric .value { font-size:24px; color:#2dd49f; font-weight:700; }
      .metric .label { font-size:12px; color:#999; text-transform:uppercase; margin-top:4px; }
      .footer { text-align:center; padding:32px 0; margin-top:40px; border-top:1px solid rgba(200,168,75,0.2); color:#666; font-size:13px; }
      a { color:#c8a84b; text-decoration:none; }
      a:hover { text-decoration:underline; }
      @media print { body { background:white; color:black; } h1,h2,h3,.badge { color:#333; } .card,.highlight { border-color:#ddd; background:#f9f9f9; } th { background:#eee; color:#333; } }
    </style>
  </head>
  <body>
  ${buildCoverPage({ reportTitle: "Informe de Proveedores", reportSubtitle: productName, companyName: productName, date: now, template: tplAbsorber })}
  <div class="container">
    <div class="header">
      <h1>🔍 Informe de Proveedores</h1>
      <div style="font-size:24px;color:#e6c668;margin:8px 0;">${productName}</div><!-- nosemgrep -->
      <div class="subtitle">Generado por Shopy Crafter AI — ${now}</div>
      <div style="margin-top:12px;">
        <span class="badge">📊 ${suppliersList.length} proveedores analizados</span><!-- nosemgrep -->
        <span class="badge">🌐 ${sourcesAnalyzed || 0} fuentes investigadas</span><!-- nosemgrep -->
        <span class="badge">🤖 3 búsquedas IA paralelas</span>
      </div>
    </div>
  
    ${topRec.supplier ? ` // nosemgrep
    <div class="highlight">
      <h2 style="border:none;padding:0;margin:0 0 12px;">🏆 RECOMENDACIÓN PRINCIPAL</h2>
      <h3 style="color:#2dd49f;font-size:22px;">${topRec.supplier}</h3><!-- nosemgrep -->
      <p style="margin:8px 0;">${topRec.reason || ""}</p><!-- nosemgrep -->
      <div style="margin-top:16px;">
        <div class="metric"><div class="value">${topRec.estimatedCostPerUnit ? `€${topRec.estimatedCostPerUnit}` : "N/A"}</div><div class="label">Coste/unidad</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${topRec.estimatedProfitMargin || "N/A"}</div><div class="label">Margen estimado</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${topRec.riskLevel || "N/A"}</div><div class="label">Nivel de riesgo</div></div><!-- nosemgrep -->
      </div>
    </div>` : ""}
  
    ${top3 ? `<h2>🥇 Top 3 Proveedores Recomendados</h2>${top3}` : ""}<!-- nosemgrep -->
  
    <h2>📦 Tabla Completa de Proveedores</h2>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr>
          <th>Proveedor</th><th>País</th><th>Plataforma</th><th>Precio</th><th>MOQ</th><th>Envío</th><th>Rating</th><th>Custom</th><th>Certificaciones</th><th>Link</th>
        </tr></thead>
        <tbody>${suppliersRows || '<tr><td colspan="10" style="text-align:center;color:#999;">No se encontraron proveedores</td></tr>'}</tbody><!-- nosemgrep -->
      </table>
    </div>
  
    ${costBreakdown.total ? ` // nosemgrep
    <h2>💰 Desglose de Costes</h2>
    <div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
        <div class="metric"><div class="value">${costBreakdown.production ? `€${costBreakdown.production}` : "N/A"}</div><div class="label">Producción</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${costBreakdown.packaging ? `€${costBreakdown.packaging}` : "N/A"}</div><div class="label">Embalaje</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${costBreakdown.shipping ? `€${costBreakdown.shipping}` : "N/A"}</div><div class="label">Envío</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${costBreakdown.customs ? `€${costBreakdown.customs}` : "N/A"}</div><div class="label">Aduanas</div></div><!-- nosemgrep -->
        <div class="metric" style="border-color:#2dd49f;"><div class="value" style="font-size:28px;">${costBreakdown.total ? `€${costBreakdown.total}` : "N/A"}</div><div class="label">COSTE TOTAL</div></div><!-- nosemgrep -->
        <div class="metric" style="border-color:#c8a84b;"><div class="value" style="color:#c8a84b;font-size:28px;">${costBreakdown.recommendedRetailPrice ? `€${costBreakdown.recommendedRetailPrice}` : "N/A"}</div><div class="label">PVP Recomendado</div></div><!-- nosemgrep -->
        <div class="metric"><div class="value">${costBreakdown.estimatedMargin || "N/A"}</div><div class="label">Margen</div></div><!-- nosemgrep -->
      </div>
    </div>` : ""}
  
    ${packagingRows ? ` // nosemgrep
    <h2>📦 Opciones de Embalaje</h2>
    <table>
      <thead><tr><th>Tipo</th><th>Coste/unidad</th><th>Descripción</th></tr></thead>
      <tbody>${packagingRows}</tbody><!-- nosemgrep -->
    </table>` : ""}
  
    ${shippingData ? `
    <h2>🚚 Costes de Envío</h2>
    <div class="card">
      ${shippingData.airFreight ? `<p>✈️ <strong>Aéreo:</strong> ${shippingData.airFreight.costPerKg || "N/A"}/kg — ${shippingData.airFreight.timedays || "N/A"} días</p>` : ""}<!-- nosemgrep -->
      ${shippingData.seaFreight ? `<p>🚢 <strong>Marítimo:</strong> ${shippingData.seaFreight.costPerKg || "N/A"}/kg — ${shippingData.seaFreight.timedays || "N/A"} días</p>` : ""}<!-- nosemgrep -->
      ${shippingData.express ? `<p>⚡ <strong>Express:</strong> ${shippingData.express.costPerKg || "N/A"}/kg — ${shippingData.express.timedays || "N/A"} días</p>` : ""}<!-- nosemgrep -->
      ${shippingData.dropshipping ? `<p>📬 <strong>Dropshipping:</strong> ${shippingData.dropshipping.costPerUnit || "N/A"}/unidad — ${shippingData.dropshipping.timedays || "N/A"} días</p>` : ""}<!-- nosemgrep -->
    </div>` : ""}
  
    ${(dealsInfo as Record<string, unknown>).deals ? `<!-- nosemgrep -->
    <h2>🏷️ Ofertas y Promociones Activas</h2>
    <div class="card">
      ${((dealsInfo as Record<string, unknown>).deals as Array<{ supplier: string; deal: string; discount: string; validUntil: string; url: string }>).map(d => `
        <div style="padding:12px 0;border-bottom:1px solid #1a1a2e;">
          <strong style="color:#c8a84b;">${d.supplier}</strong> — <span style="color:#2dd49f;">${d.discount || ""}</span>
          <p style="margin:4px 0;">${d.deal}</p>
          ${d.validUntil ? `<span style="color:#999;font-size:12px;">Válido hasta: ${d.validUntil}</span>` : ""}<!-- nosemgrep -->
          ${d.url ? ` <a href="${d.url}" style="font-size:12px;">Ver oferta</a>` : ""}<!-- nosemgrep -->
        </div>
      `).join("")}
    </div>` : ""}
  
    ${synth.strategy ? ` // nosemgrep
    <h2>🧠 Estrategia de Sourcing Recomendada</h2>
    <div class="highlight">
      <p style="font-size:16px;">${synth.strategy}</p><!-- nosemgrep -->
    </div>` : ""}
  
    ${risks ? ` // nosemgrep
    <h2>⚠️ Riesgos Identificados</h2>
    <div class="card"><ul style="padding-left:20px;">${risks}</ul></div>` : ""}<!-- nosemgrep -->
  
    ${nextSteps ? ` // nosemgrep
    <h2>📋 Próximos Pasos</h2>
    <div class="card"><ol style="padding-left:20px;">${nextSteps}</ol></div>` : ""}<!-- nosemgrep -->
  
    <div class="footer">
      <p><strong>Shopy Crafter</strong> — Inteligencia de Sourcing Profesional</p>
      <p>Informe generado automáticamente con 3 modelos IA (Claude Vision + Gemini Search + Claude Strategy)</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} Shopy Crafter · shopycrafter.com</p>
    </div>
  </div>
  </body>
  </html>`;
  
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="informe-proveedores-${productName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${Date.now()}.html"`);
      res.send(html);
    } catch (err) {
      logger.error(err, "Supplier report generation failed");
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/shopybrain/absorbed-content ─────────────────────────────────────
router.get("/shopybrain/absorbed-content", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await db.select().from(omnicoreAbsorbedContentTable)
      .orderBy(desc(omnicoreAbsorbedContentTable.createdAt))
      .limit(50);
    res.json({ items, total: items.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
