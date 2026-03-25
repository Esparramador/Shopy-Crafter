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
import { db } from "@workspace/db";
import { omnicoreMemoriesTable, omnicoreAbsorbedContentTable, projectsTable } from "@workspace/db/schema";
import { askGeminiJson, askGeminiWithSearch } from "../lib/gemini.js";
import { getClaudeClient } from "../lib/claude.js";
import { shopifyRequest } from "../lib/shopify.js";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";

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

// ─── VISION PROMPT — extracts EVERYTHING ─────────────────────────────────────
const VISION_MASTER_PROMPT = `You are ShopyBrain's Universal Vision & Intelligence Engine. Analyze this content with MAXIMUM DEPTH across ALL dimensions.

Extract and document EVERYTHING you can perceive:

1. VISUAL COMPOSITION
   - Layout structure, visual hierarchy, rule of thirds, golden ratio
   - Focal points, depth of field, perspective, camera angle
   - Spatial relationships, proportions, symmetry/asymmetry

2. COLORS & PALETTE
   - Exact color values (hex/RGB), color psychology
   - Color harmony type (complementary/analogous/triadic)
   - Dominant vs accent colors, light/shadow dynamics

3. TEXTURES & SURFACES
   - Surface finish (matte/glossy/satin/rough/smooth/metallic)
   - Material properties (fabric type, grain, weave, porosity)
   - Tactile descriptors that translate to marketing copy

4. TOPOLOGY & GEOMETRY
   - 3D structure, silhouette, edge types (sharp/rounded/organic)
   - Geometric patterns, repeating elements, grid systems
   - Structural integrity, weight distribution, balance points

5. RENDERING & PRODUCTION TECHNIQUE
   - Photography vs CGI vs illustration vs mixed
   - Lighting setup (softbox/ring/natural/rim/dramatic)
   - Post-processing style (clean/moody/editorial/commercial)
   - Depth of field, motion blur, special effects

6. TECHNICAL & CHEMICAL COMPOSITION (for products)
   - Material identification (polymer, metal alloy, natural fiber, ceramic, etc.)
   - Manufacturing process indicators (injection molded, hand-crafted, 3D printed, cast, woven)
   - Estimated material properties (density, flexibility, durability signals)
   - Formula/composition clues for beauty/food/cosmetic products

7. BRAND & MARKETING INTELLIGENCE
   - Brand identity elements (logo, colors, typography, tone)
   - Target audience signals, aspirational positioning
   - Price positioning clues (premium/mid-range/budget)
   - Competitive category and differentiation factors

8. ECOMMERCE CONVERSION SIGNALS
   - What makes this compelling for online shoppers
   - Product presentation quality score (1-10)
   - Trust signals visible, social proof elements
   - Recommended marketing angles (top 5)
   - Suggested Shopify product title and description style

9. EMOTIONAL & PSYCHOLOGICAL IMPACT
   - Primary emotion evoked
   - Aspirational triggers
   - Fear/desire balance
   - Brand archetype (Hero/Sage/Explorer/Creator/etc.)

10. ACTIONABLE INSIGHTS FOR SHOPIFY STORE
    - How to replicate this quality/style
    - Keyword opportunities
    - Pricing recommendations based on visual quality
    - A/B test hypotheses suggested by the visual

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
function classifyUrl(url: string): "social_instagram" | "social_facebook" | "social_x" | "youtube" | "url" {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "social_instagram";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "social_facebook";
  if (u.includes("twitter.com") || u.includes("x.com")) return "social_x";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return "url";
}

// ─── HELPER: Fetch URL content ────────────────────────────────────────────────
async function fetchUrlContent(url: string): Promise<{ text: string; title: string; description: string; imageUrls: string[] }> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; ShopyBrainBot/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
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
    .slice(0, 8000); // Cap at 8000 chars
  
  // Extract image URLs
  const imgMatches = html.matchAll(/<img[^>]+src="([^"]+)"/gi);
  const imageUrls = [ogImage, ...[...imgMatches].map(m => m[1]).filter(s => s.startsWith("http"))].filter(Boolean).slice(0, 5);
  
  return {
    text: cleanText,
    title: ogTitle || title,
    description,
    imageUrls,
  };
}

// ─── HELPER: Analyze image with Claude Vision ──────────────────────────────────
async function analyzeImageWithClaude(
  imageData: Buffer | string,
  mediaType: string = "image/jpeg",
  isUrl = false
): Promise<Record<string, unknown>> {
  const anthropic = await getClaudeClient(0);
  
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
  
  const res = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: [
        imageBlock,
        {
          type: "text",
          text: VISION_MASTER_PROMPT + "\n\nReturn ONLY valid JSON. No markdown, no explanation.",
        },
      ],
    }],
  });
  
  const text = res.content[0].type === "text" ? res.content[0].text : "{}";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    return { raw: text };
  }
}

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
    
    if (urlType === "youtube") {
      // Gemini can understand YouTube
      analysis = await analyzeWithGemini(url, "video_url");
      rawContent = `YouTube video: ${url}`;
      title = (analysis.title as string) ?? `YouTube: ${url}`;
    } else {
      // Fetch URL content
      const fetched = await fetchUrlContent(url);
      rawContent = fetched.text;
      title = label ?? fetched.title;
      
      // Analyze with Gemini
      const textAnalysis = await analyzeWithGemini(
        `URL: ${url}\nTitle: ${fetched.title}\nDescription: ${fetched.description}\nContent: ${fetched.text}`,
        urlType.startsWith("social") ? "social" : "url_content"
      );
      
      analysis = textAnalysis;
      
      // If there are images, also analyze them with Claude Vision
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
      rawContent: rawContent.slice(0, 5000),
      mainThemes: JSON.stringify(analysis.main_themes ?? analysis.content_themes ?? []),
      ecommerceInsights: JSON.stringify(analysis.ecommerce_insights ?? analysis.ecommerceInsights ?? {}),
      marketingAngles: JSON.stringify(analysis.marketing_angles ?? analysis.marketingAngles ?? []),
      competitiveData: JSON.stringify(analysis.competitive_data ?? analysis.competitiveData ?? {}),
      audienceSignals: JSON.stringify(analysis.audience_signals ?? analysis.audienceSignals ?? {}),
      brandElements: JSON.stringify(analysis.brand_elements ?? analysis.brandElements ?? {}),
      visualComposition: JSON.stringify((analysis as any).visual_composition ?? (analysis as any).visual_from_page?.visual_composition ?? null),
      fullAnalysis: analysis,
      niche: niche ?? null,
      confidence: 0.75,
      processingModel: "gemini+claude",
      createdAt: new Date(),
    });
    
    // Save core memory to ShopyBrain
    const summaryContent = `SOURCE: ${url}\nTYPE: ${urlType}\n\n${JSON.stringify(analysis, null, 2)}`;
    memoryId = await saveToShopyBrain({
      title: `[${urlType.toUpperCase()}] ${title}`,
      content: summaryContent.slice(0, 10000),
      memoryType: "absorbed_content",
      niche,
      sourceType: urlType,
      sourceUrl: url,
      confidence: 0.75,
      tags: [urlType, "absorbed", "url", niche ?? "general"],
    });
    
    // Update absorbed record with memory ID
    await db.update(omnicoreAbsorbedContentTable)
      .set({ absorbedToMemory: 1, memoryIds: memoryId })
      .where(eq(omnicoreAbsorbedContentTable.id, absorbId));
    
    res.json({
      success: true,
      absorbId,
      memoryId,
      urlType,
      title,
      analysis,
      message: `✅ ${urlType} absorbido al ShopyBrain. Conocimiento guardado permanentemente.`,
    });
  } catch (err) {
    logger.error(err, "ShopyBrain URL absorb failed");
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/shopybrain/absorb-image ────────────────────────────────────────
router.post("/shopybrain/absorb-image",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
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
        content: memoryContent.slice(0, 10000),
        memoryType: "visual_intelligence",
        niche,
        sourceType,
        confidence: 0.85,
        tags: [sourceType, "vision", "absorbed", "visual_analysis", niche ?? "general"],
      });
      
      await db.update(omnicoreAbsorbedContentTable)
        .set({ absorbedToMemory: 1, memoryIds: memoryId })
        .where(eq(omnicoreAbsorbedContentTable.id, absorbId));
      
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
        message: `✅ ${sourceType === "image" ? "Imagen" : "Vídeo"} absorbido al ShopyBrain con análisis completo de composición, texturas, topología y señales eCommerce.`,
      });
    } catch (err) {
      logger.error(err, "ShopyBrain image/video absorb failed");
      res.status(500).json({ error: String(err) });
    }
  }
);

// ─── POST /api/shopybrain/absorb-text ─────────────────────────────────────────
router.post("/shopybrain/absorb-text", requireAdmin, async (req: Request, res: Response): Promise<void> => {
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
      content: `ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nORIGINAL:\n${text.slice(0, 3000)}`,
      memoryType: "absorbed_content",
      niche,
      sourceType,
      confidence: 0.7,
      tags: ["text", "absorbed", niche ?? "general"],
    });
    
    res.json({ success: true, memoryId, analysis, message: "✅ Texto absorbido al ShopyBrain." });
  } catch (err) {
    logger.error(err, "ShopyBrain text absorb failed");
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/shopybrain/create-product-from-image ────────────────────────────
router.post("/shopybrain/create-product-from-image",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
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

      const anthropic = await getClaudeClient(0);

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

      const visionRes = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: [
            imageBlock,
            {
              type: "text",
              text: `You are ShopyBrain's Product Intelligence Engine. Analyze this product image with MAXIMUM DEPTH.

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
            },
          ],
        }],
      });

      const visionText = (visionRes.content[0] as { type: string; text: string }).text;
      const visionMatch = visionText.match(/\{[\s\S]*\}/);
      const productAnalysis = visionMatch ? JSON.parse(visionMatch[0]) : {};

      logger.info({ product: productAnalysis.productName, category: productAnalysis.productCategory }, "Vision analysis complete");

      const searchKeywords = productAnalysis.searchKeywords?.slice(0, 5)?.join(", ") || productAnalysis.productName;
      const comparables = productAnalysis.comparableProducts?.map((p: { name: string; brand: string; priceRange: string }) =>
        `${p.brand} ${p.name}: ${p.priceRange}`).join(", ") || "";

      const pricingPrompt = `MISIÓN CRÍTICA: Investigar precios REALES y ACTUALES del mercado para este producto.

PRODUCTO: ${productAnalysis.productName || "producto de la imagen"}
CATEGORÍA: ${productAnalysis.productCategory || "general"}
MATERIALES: ${(productAnalysis.materials || []).join(", ")}
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

      let pricingData: Record<string, unknown> = {};
      try {
        const pricingMatch = pricingResult.text.match(/\{[\s\S]*\}/);
        if (pricingMatch) pricingData = JSON.parse(pricingMatch[0]);
      } catch {
        logger.warn("Could not parse pricing JSON, using vision estimate");
      }

      const recommendedPrice = (pricingData.recommendedPrice as number) || 0;
      const compareAtPrice = (pricingData.compareAtPrice as number) || 0;
      const priceSources = (pricingData.researchedPrices as Array<{ source: string; product: string; price: number }>) || [];

      logger.info({
        recommendedPrice,
        compareAtPrice,
        sourcesFound: priceSources.length,
        geminiSources: pricingResult.sources?.length
      }, "Pricing research complete");

      const copyRes = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: `Eres un experto en copywriting eCommerce Shopify. Genera contenido que CONVIERTA.
Tienda: ${project.storeName || "Shopify Store"}
Nicho: ${project.storeNiche || "general"}
Tono: ${project.brandTone || "profesional"}
El producto ha sido analizado visualmente y los precios han sido investigados con datos REALES del mercado.`,
        messages: [{
          role: "user",
          content: `Genera contenido Shopify OPTIMIZADO para este producto:

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
        }],
      });

      const copyText = (copyRes.content[0] as { type: string; text: string }).text;
      const copyMatch = copyText.match(/\{[\s\S]*\}/);
      const productCopy = copyMatch ? JSON.parse(copyMatch[0]) : {};

      const finalPrice = recommendedPrice > 0 ? recommendedPrice.toFixed(2) : "0.00";
      const finalCompareAt = compareAtPrice > recommendedPrice ? compareAtPrice.toFixed(2) : null;

      const imageBase64 = file ? file.buffer.toString("base64") : null;

      const shopifyProduct: Record<string, unknown> = {
        title: productCopy.title || productAnalysis.suggestedTitle || "Nuevo Producto",
        body_html: productCopy.bodyHtml || `<p>${productAnalysis.detailedDescription || ""}</p>`,
        tags: Array.isArray(productCopy.tags) ? productCopy.tags.join(", ") : (productAnalysis.suggestedTags || []).join(", "),
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
        `Materials: ${(productAnalysis.materials || []).join(", ")}`,
        `Quality: ${productAnalysis.qualityTier}`,
        `Pricing Sources: ${priceSources.map((s: { source: string; price: number }) => `${s.source}: €${s.price}`).join(", ")}`,
        `Justification: ${pricingData.priceJustification || "N/A"}`,
      ].join("\n");

      const memoryId = await saveToShopyBrain({
        title: `[PRODUCT] ${created.product.title}`,
        content: memoryContent.slice(0, 10000),
        memoryType: "product_creation",
        niche: project.storeNiche || undefined,
        sourceType: "image_to_product",
        confidence: 0.9,
        tags: ["product", "created", "image_analysis", "price_research"],
      });

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
      res.status(500).json({ error: String(err) });
    }
  }
);

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
