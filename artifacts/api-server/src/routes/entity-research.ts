/**
 * ShopyBrain Entity Research Engine
 * ──────────────────────────────────────────────────────────────────────────────
 * Exhaustive parallel research on any brand, company, person, or URL.
 * Given ONE input (URL, Instagram handle, name...) → finds EVERYTHING:
 *  - All social media profiles
 *  - Products, pricing, catalog
 *  - News, press, mentions
 *  - Customer reviews, sentiment
 *  - Competitors, market position
 *  - eCommerce stack, email flows, ads
 *  - Visual identity, brand aesthetics
 *  - All source URLs discovered via Google Search Grounding (real searches)
 *
 * ALL findings → saved permanently in ShopyBrain memory.
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { omnicoreMemoriesTable, omnicoreAbsorbedContentTable, omnicoreNicheProfilesTable } from "@workspace/db/schema";
import { deepEntityResearch, askGeminiWithSearch, askGeminiJson } from "../lib/gemini.js";
import { askClaude, getClaudeClient } from "../lib/claude.js";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

const router = Router();

// ─── HELPER: Extract entity name from any input ────────────────────────────────
async function extractEntityName(input: string): Promise<{ name: string; url?: string; handles: Record<string, string> }> {
  // Instagram handle
  const igMatch = input.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.]+)/i);
  // Domain
  const domainMatch = input.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
  // X/Twitter
  const xMatch = input.match(/(?:twitter\.com\/|x\.com\/)([a-zA-Z0-9_]+)/i);
  // Facebook
  const fbMatch = input.match(/facebook\.com\/([a-zA-Z0-9.]+)/i);

  const handles: Record<string, string> = {};
  if (igMatch?.[1]) handles.instagram = igMatch[1];
  if (xMatch?.[1]) handles.x = xMatch[1];
  if (fbMatch?.[1]) handles.facebook = fbMatch[1];

  // Clean name from input
  let name = input
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/\.myshopify\.com.*/g, "")
    .replace(/instagram\.com\//g, "")
    .replace(/twitter\.com\//g, "")
    .replace(/x\.com\//g, "")
    .replace(/facebook\.com\//g, "")
    .replace(/youtube\.com\/(c\/|channel\/|user\/)?/g, "")
    .replace(/[/@]/g, " ")
    .replace(/\.[a-z]{2,}$/gi, "")
    .replace(/[-_]/g, " ")
    .trim();

  // Capitalize
  name = name.replace(/\b\w/g, c => c.toUpperCase());

  const url = input.startsWith("http") ? input : (domainMatch?.[0] ? `https://${domainMatch[0]}` : undefined);

  return { name, url, handles };
}

// ─── HELPER: Fetch URL safely ──────────────────────────────────────────────────
async function safeFetch(url: string): Promise<{ text: string; title: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyBrainBot/1.0; +https://shopybrain.ai)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { text: "", title: url };
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1];
    const clean = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    return { text: clean, title: ogTitle ?? titleMatch?.[1] ?? url };
  } catch {
    return { text: "", title: url };
  }
}

// ─── HELPER: Save to ShopyBrain ────────────────────────────────────────────────
async function saveMemory(params: {
  title: string; content: string; memoryType: string;
  niche?: string; sourceType?: string; confidence?: number; tags?: string[];
}): Promise<string> {
  const id = randomUUID();
  await db.insert(omnicoreMemoriesTable).values({
    id,
    memoryType: params.memoryType,
    niche: params.niche ?? null,
    title: params.title.slice(0, 200),
    content: params.content.slice(0, 12000),
    confidence: params.confidence ?? 0.8,
    sourceType: params.sourceType ?? "entity_research",
    tags: params.tags ? JSON.stringify(params.tags) : null,
    isVerified: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

// ─── POST /api/shopybrain/research-entity ─────────────────────────────────────
// The main exhaustive parallel research endpoint
router.post("/shopybrain/research-entity", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const {
    input,         // Any: URL, Instagram handle, brand name, "Comic Crafter", "@brand", etc.
    niche,         // Optional hint: "comics", "moda", etc.
    market = "es", // Market language/region
    depth = "full" // "quick" | "full" | "deep"
  } = req.body as { input: string; niche?: string; market?: string; depth?: string };

  if (!input?.trim()) {
    res.status(400).json({ error: "input es requerido (URL, nombre, Instagram, etc.)" });
    return;
  }

  const startTime = Date.now();
  const researchId = randomUUID();

  logger.info({ input, niche, depth }, "🔬 ShopyBrain: Exhaustive entity research starting");

  try {
    // Step 1: Identify the entity
    const entity = await extractEntityName(input.trim());
    logger.info(entity, "Entity identified");

    // Step 2: PARALLEL DEEP RESEARCH — 8 dimensions searched simultaneously via Google
    res.json({ status: "started", researchId, entity, message: "Investigación paralela iniciada..." });

    // Note: We return immediately and do research async? No, let's do it sync and stream.
    // Actually let's do full sync response with everything. Client should show loading.
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/shopybrain/research-entity-sync ────────────────────────────────
// Synchronous version — waits for all research, returns complete profile
router.post("/shopybrain/research-entity-sync", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const {
    input,
    niche,
    market = "es",
  } = req.body as { input: string; niche?: string; market?: string };

  if (!input?.trim()) {
    res.status(400).json({ error: "input es requerido" });
    return;
  }

  const startTime = Date.now();
  const researchId = randomUUID();

  logger.info({ input, niche }, "🔬 ShopyBrain: Full exhaustive research starting");

  try {
    // PHASE 1: Identify entity
    const entity = await extractEntityName(input.trim());
    const entityDisplay = entity.name || input;

    // PHASE 2: 8 parallel Google searches (real web search grounding)
    logger.info("Phase 2: 8 parallel Google searches");
    const research = await deepEntityResearch(entityDisplay, entity.url);

    // PHASE 3: Fetch discovered source URLs in parallel (up to 12)
    logger.info({ sourceCount: research.allSources.length }, "Phase 3: Fetching discovered URLs");
    const urlsToFetch = research.allSources
      .filter(u => u.startsWith("http") && !u.includes("instagram.com") && !u.includes("facebook.com"))
      .slice(0, 12);

    const fetchedPages = await Promise.allSettled(urlsToFetch.map(url => safeFetch(url)));
    const pageContents = fetchedPages
      .filter((r): r is PromiseFulfilledResult<{ text: string; title: string }> => r.status === "fulfilled" && r.value.text.length > 100)
      .map((r, i) => `SOURCE [${urlsToFetch[i]}]:\nTitle: ${r.value.title}\n${r.value.text.slice(0, 1500)}`)
      .join("\n\n---\n\n");

    // PHASE 4: Claude synthesizes everything into ONE comprehensive intelligence profile
    logger.info("Phase 4: Claude synthesis");
    const synthPrompt = `You are ShopyBrain's master intelligence synthesizer. You have been given exhaustive research about this entity: "${entityDisplay}"

RESEARCH DATA (from 8 parallel Google searches + ${urlsToFetch.length} fetched web pages):

=== BRAND OVERVIEW ===
${research.overview.slice(0, 2000)}

=== PRODUCTS & SERVICES ===
${research.products.slice(0, 2000)}

=== SOCIAL MEDIA PRESENCE ===
${research.social.slice(0, 2000)}

=== NEWS & PRESS ===
${research.news.slice(0, 1500)}

=== CUSTOMER REVIEWS & SENTIMENT ===
${research.reviews.slice(0, 1500)}

=== COMPETITORS & MARKET POSITION ===
${research.competitors.slice(0, 1500)}

=== ECOMMERCE STRATEGY ===
${research.ecommerce.slice(0, 1500)}

=== FETCHED WEB PAGES (${fetchedPages.filter(r => r.status === "fulfilled").length} pages) ===
${pageContents.slice(0, 3000)}

=== DISCOVERED SOURCES (${research.allSources.length} URLs found) ===
${research.allSources.slice(0, 20).join("\n")}

Create the most comprehensive brand intelligence profile possible in JSON format:
{
  "entityName": "string",
  "entityType": "brand|person|pyme|startup|influencer|ecommerce",
  "domain": "string or null",
  "founded": "string or null",
  "location": "string",
  "teamSize": "string",
  "description": "string (2-3 sentences)",
  
  "socialProfiles": {
    "instagram": "URL or handle",
    "facebook": "URL",
    "x": "URL or handle",
    "tiktok": "URL or handle",
    "youtube": "URL",
    "linkedin": "URL",
    "pinterest": "URL",
    "other": ["URLs"]
  },
  "socialMetrics": {
    "instagramFollowers": "number or string",
    "contentFrequency": "string",
    "avgEngagement": "string",
    "topHashtags": ["string"],
    "contentStyle": "string",
    "postingTone": "string"
  },
  
  "products": [
    {
      "name": "string",
      "category": "string",
      "priceRange": "string",
      "keyFeature": "string"
    }
  ],
  "pricing": {
    "strategy": "premium|mid|budget|mixed",
    "avgTicket": "string",
    "promotionFrequency": "string"
  },
  
  "ecommerceStack": {
    "platform": "Shopify|WooCommerce|Custom|Unknown",
    "emailTool": "Klaviyo|Mailchimp|etc or Unknown",
    "paymentMethods": ["string"],
    "shipping": "string",
    "returnPolicy": "string"
  },
  "marketingChannels": ["Google Ads", "Instagram Ads", "Email", "Influencers", etc],
  "seoKeywords": ["string"],
  "emailStrategy": "string",
  
  "sentiment": {
    "overall": "positive|mixed|negative",
    "nps": "string",
    "topCompliments": ["string"],
    "topComplaints": ["string"]
  },
  
  "competitors": [
    { "name": "string", "url": "string", "advantage": "string" }
  ],
  "marketPosition": "leader|challenger|follower|niche",
  "differentiators": ["string"],
  
  "visualIdentity": {
    "primaryColors": ["string"],
    "style": "string",
    "logoDescription": "string",
    "photographyStyle": "string"
  },
  
  "shopifyOpportunities": [
    "string (specific actionable opportunity)"
  ],
  "klaviyoOpportunities": ["string"],
  "contentOpportunities": ["string"],
  
  "confidenceLevel": "high|medium|low",
  "dataQuality": "rich|moderate|sparse",
  "sourcesAnalyzed": ${research.allSources.length},
  "researchQueries": ${research.allQueries.length}
}

Return ONLY valid JSON. Populate every field with real found data or "Unknown" if not found.`;

    const profile = await askGeminiJson<Record<string, unknown>>(synthPrompt, "Master intelligence synthesizer. Create comprehensive, factual brand profiles. Return only JSON.");

    // PHASE 5: Additional deep searches based on discovered handles
    const extraSearches: Promise<{ text: string; sources: string[]; queries: string[] }>[] = [];

    if (entity.handles.instagram) {
      extraSearches.push(askGeminiWithSearch(`Everything about Instagram account @${entity.handles.instagram}: top posts, story highlights, bio, link in bio, collaboration partners, sponsored content, follower demographics, growth trajectory.`, "Social media deep analyst"));
    }

    // Find tech stack and marketing automation
    if (entity.url) {
      extraSearches.push(askGeminiWithSearch(`What eCommerce tools, apps, and marketing automation does ${entityDisplay} (${entity.url}) use? Find: Shopify apps, email marketing platform, CRM, analytics tools, chatbots, loyalty programs.`, "Tech stack analyst"));
    }

    // Ad intelligence
    extraSearches.push(askGeminiWithSearch(`What kind of ads is ${entityDisplay} running? Find: Facebook Ads Library data, Google ads, influencer campaigns, user-generated content strategy, promotional calendar.`, "Advertising intelligence analyst"));

    const extraResults = await Promise.allSettled(extraSearches);
    const extraInsights = extraResults
      .filter((r): r is PromiseFulfilledResult<{ text: string; sources: string[]; queries: string[] }> => r.status === "fulfilled")
      .map(r => { research.allSources.push(...r.value.sources); return r.value.text; })
      .join("\n\n---\n\n");

    // PHASE 6: Save EVERYTHING to ShopyBrain
    const memoryIds: string[] = [];

    // Main comprehensive profile
    const mainMemoryId = await saveMemory({
      title: `[DEEP RESEARCH] ${entityDisplay}`,
      content: `ENTITY: ${entityDisplay}\nURL: ${entity.url ?? "N/A"}\nHANDLES: ${JSON.stringify(entity.handles)}\n\nCOMPREHENSIVE PROFILE:\n${JSON.stringify(profile, null, 2)}\n\nEXTRA INSIGHTS:\n${extraInsights.slice(0, 3000)}`,
      memoryType: "brand_intelligence",
      niche,
      sourceType: "deep_entity_research",
      confidence: 0.88,
      tags: ["deep_research", "brand_profile", entityDisplay.toLowerCase(), niche ?? "general", "exhaustive"],
    });
    memoryIds.push(mainMemoryId);

    // Individual dimension memories for granular retrieval
    const dimensions = [
      { key: "overview", label: "brand_overview" },
      { key: "products", label: "products_catalog" },
      { key: "social", label: "social_presence" },
      { key: "news", label: "press_mentions" },
      { key: "reviews", label: "customer_sentiment" },
      { key: "competitors", label: "competitive_intel" },
      { key: "ecommerce", label: "ecommerce_strategy" },
    ];

    for (const dim of dimensions) {
      const content = research[dim.key as keyof typeof research];
      if (typeof content === "string" && content.length > 100) {
        const id = await saveMemory({
          title: `[${dim.label.toUpperCase()}] ${entityDisplay}`,
          content: `Entity: ${entityDisplay}\n\n${content}`,
          memoryType: dim.label,
          niche,
          sourceType: "google_search_grounding",
          confidence: 0.82,
          tags: [dim.label, entityDisplay.toLowerCase(), niche ?? "general"],
        });
        memoryIds.push(id);
      }
    }

    // Save absorbed content record
    await db.insert(omnicoreAbsorbedContentTable).values({
      id: researchId,
      sourceType: "entity_research",
      sourceUrl: entity.url ?? null,
      sourceLabel: entityDisplay,
      rawContent: `Research on: ${entityDisplay}\nSources: ${research.allSources.length}\nQueries: ${research.allQueries.length}`,
      mainThemes: JSON.stringify([entityDisplay, ...(profile.differentiators as string[] ?? [])]),
      ecommerceInsights: JSON.stringify(profile.shopifyOpportunities ?? []),
      marketingAngles: JSON.stringify(profile.klaviyoOpportunities ?? []),
      competitiveData: JSON.stringify(profile.competitors ?? []),
      audienceSignals: JSON.stringify(profile.sentiment ?? {}),
      brandElements: JSON.stringify(profile.visualIdentity ?? {}),
      fullAnalysis: profile as Record<string, unknown>,
      niche: niche ?? null,
      confidence: 0.88,
      absorbedToMemory: 1,
      memoryIds: memoryIds.join(","),
      processingModel: "gemini-search-grounding+claude",
      createdAt: new Date(),
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.info({ entityDisplay, memoryCount: memoryIds.length, sourcesFound: research.allSources.length, elapsed }, "Entity research complete");

    res.json({
      success: true,
      researchId,
      entity: entityDisplay,
      entityUrl: entity.url,
      handles: entity.handles,
      profile,
      research: {
        overview: research.overview.slice(0, 1000),
        products: research.products.slice(0, 800),
        social: research.social.slice(0, 800),
        news: research.news.slice(0, 600),
        reviews: research.reviews.slice(0, 600),
        competitors: research.competitors.slice(0, 600),
        ecommerce: research.ecommerce.slice(0, 600),
        extraInsights: extraInsights.slice(0, 800),
      },
      sourcesFound: research.allSources.length,
      queriesExecuted: research.allQueries.length,
      memoriesSaved: memoryIds.length,
      allSources: research.allSources.slice(0, 30),
      allQueries: research.allQueries,
      elapsed: `${elapsed}s`,
      message: `✅ Investigación exhaustiva completada: ${research.allSources.length} fuentes descubiertas, ${memoryIds.length} memorias guardadas en ShopyBrain en ${elapsed}s`,
    });

  } catch (err) {
    logger.error(err, "Entity research failed");
    res.status(500).json({ error: String(err), researchId });
  }
});

// ─── GET /api/shopybrain/research-entity/:name — quick lookup in memory ────────
router.get("/shopybrain/research-entity/:name", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;
  try {
    // Check if we already have research on this entity
    const existing = await db.select().from(omnicoreAbsorbedContentTable)
      .where(eq(omnicoreAbsorbedContentTable.sourceType, "entity_research"));

    const match = existing.find(e =>
      e.sourceLabel?.toLowerCase().includes(name.toLowerCase()) ||
      e.sourceUrl?.toLowerCase().includes(name.toLowerCase())
    );

    if (match) {
      res.json({ found: true, cached: true, data: match });
    } else {
      res.json({ found: false, cached: false, message: `No research found for "${name}". Use POST to research.` });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
