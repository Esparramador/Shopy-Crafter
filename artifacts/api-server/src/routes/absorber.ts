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
import { omnicoreMemoriesTable, omnicoreAbsorbedContentTable } from "@workspace/db/schema";
import { askGeminiJson } from "../lib/gemini.js";
import { getClaudeClient } from "../lib/claude.js";
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
  
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
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
      visualComposition: JSON.stringify(analysis.visual_composition ?? analysis.visual_from_page?.visual_composition ?? null),
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
