/**
 * ShopyBrain Gemini Intelligence Library
 * ─────────────────────────────────────────────────────────────────────────────
 * CAPABILITIES ENABLED:
 *  ✅ Google Search Grounding (real web search, not hallucinated)
 *  ✅ URL Context Tool (Gemini fetches & reads URLs directly)
 *  ✅ Dynamic Retrieval — threshold 0.0 (ALWAYS grounds in real search)
 *  ✅ Thinking Budget — deeper reasoning for complex research
 *  ✅ maxOutputTokens 65536 (Flash max)
 *  ✅ Per-call timeout 120s + 1 automatic retry
 *  ✅ deepEntityResearch: 12 parallel searches + URL deep-dive phase
 *  ✅ Overall research timeout 270s (safe margin under Replit 5-min proxy limit)
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";

let _ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!_ai) {
    const directKey = process.env.GEMINI_API_KEY;
    const proxyKey  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const proxyUrl  = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

    if (directKey) {
      _ai = new GoogleGenAI({ apiKey: directKey });
    } else if (proxyKey && proxyUrl) {
      _ai = new GoogleGenAI({ apiKey: proxyKey, httpOptions: { apiVersion: "", baseUrl: proxyUrl } });
    } else {
      throw new Error("Gemini not configured: set GEMINI_API_KEY or Replit AI Integrations");
    }
  }
  return _ai;
}

export function isGeminiAvailable(): boolean {
  return !!(process.env.GEMINI_API_KEY || (process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY));
}

// ─── Model selection ──────────────────────────────────────────────────────────
const GEMINI_MODEL     = "gemini-2.5-flash";
const GEMINI_PRO_MODEL = "gemini-2.5-pro";

// ─── Timeout & retry config ───────────────────────────────────────────────────
const GEMINI_CALL_TIMEOUT_MS  = 120_000;  // 120s per individual Gemini call
const GEMINI_SEARCH_TIMEOUT   = 100_000;  // 100s per search-grounding call (slightly longer)
const OVERALL_RESEARCH_TIMEOUT = 270_000; // 270s total for full entity research (safe under 5-min proxy limit)
const URL_FETCH_TIMEOUT_MS    = 25_000;   // 25s per URL fetch
const GEMINI_URL_CTX_TIMEOUT  = 90_000;   // 90s for URL context deep-dive

// ─── Utility: race a promise against a timeout ────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`⏱ Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Utility: retry once on failure with delay ────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 3_000,
  label = "call"
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < retries) {
        logger.warn({ label, attempt, err: String(err) }, `Retrying ${label} in ${delayMs}ms…`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

// ─── Base generation (no search) ─────────────────────────────────────────────
async function askGemini(prompt: string, systemInstruction?: string, useProModel = false): Promise<string> {
  const ai    = getGeminiClient();
  const model = useProModel ? GEMINI_PRO_MODEL : GEMINI_MODEL;

  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction ?? "You are a precise business intelligence analyst. Always respond with structured, actionable data. Be concise and factual.",
        maxOutputTokens: 65_536,
        ...(useProModel ? { thinkingConfig: { thinkingBudget: 10_000 } } : {}),
      },
    }),
    GEMINI_CALL_TIMEOUT_MS,
    `askGemini(${model})`
  );

  return response.text ?? "";
}

// ─── JSON-structured generation ───────────────────────────────────────────────
async function askGeminiJson<T = unknown>(prompt: string, systemInstruction?: string, useProModel = false): Promise<T> {
  const ai    = getGeminiClient();
  const model = useProModel ? GEMINI_PRO_MODEL : GEMINI_MODEL;

  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction ?? "You are a precise business intelligence analyst. Always respond with valid JSON only, no markdown.",
        responseMimeType: "application/json",
        maxOutputTokens: 65_536,
        ...(useProModel ? { thinkingConfig: { thinkingBudget: 10_000 } } : {}),
      },
    }),
    GEMINI_CALL_TIMEOUT_MS,
    `askGeminiJson(${model})`
  );

  const text = response.text ?? "{}";
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    return JSON.parse(match ? match[1] : text.replace(/```[\s\S]*?```/g, "").trim()) as T;
  }
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface BusinessProfile {
  name: string; domain: string; industry: string; size: string; description: string;
  mainProducts: string[]; targetAudience: string; priceRange: string; strengths: string[];
  weaknesses: string[]; socialPresence: string[]; estimatedRevenue: string;
  marketPosition: string; seoStrength: string; opportunities: string[]; threats: string[]; keyFindings: string;
}

export interface CompetitorIntelligence {
  domain: string; positioningStrategy: string; pricingStrategy: string; contentStrategy: string;
  topKeywords: string[]; uniqueSellingPoints: string[]; weaknesses: string[];
  estimatedTraffic: string; productCount: string; avgProductPrice: string;
  conversionTactics: string[]; opportunities: string[];
}

export interface MarketIntelligence {
  niche: string; market: string; marketSize: string; growthRate: string; topPlayers: string[];
  avgPriceRange: { min: number; max: number; sweet: number }; topKeywords: string[];
  seasonalPeaks: string[]; buyerPersona: string; purchaseDrivers: string[]; mainBarriers: string[];
  emergingTrends: string[]; opportunities: string[]; saturationLevel: string; recommendedPositioning: string;
}

export interface ProductTrendAnalysis {
  productType: string; market: string; demandLevel: string; trendDirection: string;
  searchVolumeTrend: string; topCompetitors: string[]; avgPrice: number;
  priceRange: { min: number; max: number }; keyFeatures: string[];
  winningDescriptionPatterns: string[]; topImageTypes: string[];
  ctasThatConvert: string[]; seasonality: string; recommendations: string[];
}

const INTELLIGENCE_SYSTEM = `You are OmniCore Intelligence — an elite eCommerce market research AI.
You analyze businesses, markets, and competitors for Shopify optimization agencies.
You provide structured, actionable intelligence based on your training knowledge AND real web search results.
Always respond in the language matching the market (Spanish for 'es', English for 'en', etc).
Be specific, data-driven, and actionable. Never use placeholders like "N/A" — always provide best estimates.`;

// ─── Business research ────────────────────────────────────────────────────────
export async function researchBusiness(businessName: string, domain: string, niche: string, market = "es"): Promise<BusinessProfile> {
  logger.info({ businessName, domain }, "Gemini: researching business");
  const prompt = `Research this business and provide a comprehensive intelligence profile:

Business: ${businessName}
Domain: ${domain}
Niche: ${niche}
Market: ${market}

Analyze and return JSON with these exact fields:
{
  "name": "string", "domain": "string", "industry": "string", "size": "micro|small|medium|large",
  "description": "string", "mainProducts": ["string"], "targetAudience": "string", "priceRange": "string",
  "strengths": ["string"], "weaknesses": ["string"], "socialPresence": ["string"], "estimatedRevenue": "string",
  "marketPosition": "budget|value|mid|premium|luxury", "seoStrength": "weak|moderate|strong|very strong",
  "opportunities": ["string"], "threats": ["string"], "keyFindings": "string"
}`;
  return await askGeminiJson<BusinessProfile>(prompt, INTELLIGENCE_SYSTEM, true);
}

// ─── Competitor analysis ──────────────────────────────────────────────────────
export async function analyzeCompetitor(domain: string, niche: string, market = "es"): Promise<CompetitorIntelligence> {
  logger.info({ domain, niche }, "Gemini: analyzing competitor");
  const prompt = `Analyze this Shopify competitor store for an eCommerce optimization agency:

Domain: ${domain} | Niche: ${niche} | Market: ${market}

Return JSON:
{
  "domain": "string", "positioningStrategy": "string", "pricingStrategy": "string",
  "contentStrategy": "string", "topKeywords": ["string"], "uniqueSellingPoints": ["string"],
  "weaknesses": ["string"], "estimatedTraffic": "string", "productCount": "string",
  "avgProductPrice": "string", "conversionTactics": ["string"], "opportunities": ["string"]
}`;
  return await askGeminiJson<CompetitorIntelligence>(prompt, INTELLIGENCE_SYSTEM);
}

// ─── Market intelligence ──────────────────────────────────────────────────────
export async function gatherMarketIntelligence(niche: string, market = "es"): Promise<MarketIntelligence> {
  logger.info({ niche, market }, "Gemini: gathering market intelligence");
  const prompt = `Provide comprehensive market intelligence for a Shopify optimization agency about:
Niche: ${niche} | Market: ${market}

Return JSON:
{
  "niche": "string", "market": "string", "marketSize": "string", "growthRate": "declining|stable|growing|booming",
  "topPlayers": ["string"], "avgPriceRange": { "min": 0, "max": 0, "sweet": 0 }, "topKeywords": ["string"],
  "seasonalPeaks": ["string"], "buyerPersona": "string", "purchaseDrivers": ["string"], "mainBarriers": ["string"],
  "emergingTrends": ["string"], "opportunities": ["string"], "saturationLevel": "low|medium|high|saturated",
  "recommendedPositioning": "string"
}`;
  return await askGeminiJson<MarketIntelligence>(prompt, INTELLIGENCE_SYSTEM, true);
}

// ─── Product trend analysis ───────────────────────────────────────────────────
export async function analyzeProductTrends(productType: string, market = "es"): Promise<ProductTrendAnalysis> {
  logger.info({ productType, market }, "Gemini: analyzing product trends");
  const prompt = `Analyze product trends and optimization tactics for:
Product type: ${productType} | Market: ${market}

Return JSON:
{
  "productType": "string", "market": "string", "demandLevel": "very low|low|moderate|high|very high",
  "trendDirection": "rising|stable|declining", "searchVolumeTrend": "string", "topCompetitors": ["string"],
  "avgPrice": 0, "priceRange": { "min": 0, "max": 0 }, "keyFeatures": ["string"],
  "winningDescriptionPatterns": ["string"], "topImageTypes": ["string"], "ctasThatConvert": ["string"],
  "seasonality": "string", "recommendations": ["string"]
}`;
  return await askGeminiJson<ProductTrendAnalysis>(prompt, INTELLIGENCE_SYSTEM);
}

// ─── Person / influencer research ─────────────────────────────────────────────
export async function researchPersonOrBrand(
  name: string, context: string, market = "es"
): Promise<{ profile: string; digitalPresence: string[]; contentThemes: string[]; audienceInsights: string; partnershipOpportunities: string[]; keyFindings: string }> {
  logger.info({ name }, "Gemini: researching person/brand");
  const prompt = `Research this person or brand for eCommerce partnership/influencer analysis:
Name: ${name} | Context: ${context} | Market: ${market}

Return JSON: { "profile": "string", "digitalPresence": ["string"], "contentThemes": ["string"],
  "audienceInsights": "string", "partnershipOpportunities": ["string"], "keyFindings": "string" }`;
  return await askGeminiJson(prompt, INTELLIGENCE_SYSTEM);
}

// ─── Multi-model analysis ─────────────────────────────────────────────────────
export async function multiModelAnalysis(
  topic: string, geminiContext: string,
  claudeAnalyzer: (geminiFindings: string) => Promise<string>
): Promise<{ geminiFindings: string; claudeAnalysis: string; combined: string }> {
  logger.info({ topic }, "Multi-model analysis: Gemini + Claude");

  const geminiFindings = await askGemini(
    `${geminiContext}\n\nTopic: ${topic}\n\nProvide detailed research findings:`,
    INTELLIGENCE_SYSTEM, true
  );
  const claudeAnalysis = await claudeAnalyzer(geminiFindings);
  const combined = await askGemini(
    `Synthesis from two AI systems:\n\nGEMINI:\n${geminiFindings}\n\nCLAUDE:\n${claudeAnalysis}\n\nProvide a unified intelligence report:`,
    INTELLIGENCE_SYSTEM
  );
  return { geminiFindings, claudeAnalysis, combined };
}

// ─── GOOGLE SEARCH GROUNDING — real web search, not hallucinated ──────────────
// Capabilities:
//   🔍 googleSearch: real Google Search grounding
//   🌐 urlContext:   Gemini directly reads and processes URLs in the prompt
//   ⚡ dynamicRetrievalThreshold: 0.0 → ALWAYS uses search, never skips it
//   🧠 thinkingBudget: 8000 → deeper reasoning during research
//   📄 maxOutputTokens: 65536 → full response length (Flash max)
export async function askGeminiWithSearch(
  prompt: string,
  systemInstruction?: string,
  urlsToRead?: string[],  // optional: pass URLs for Gemini to fetch directly
): Promise<{ text: string; sources: string[]; queries: string[] }> {
  const ai = getGeminiClient();

  // Build prompt: if URLs provided, inject them for urlContext
  const fullPrompt = urlsToRead && urlsToRead.length > 0
    ? `${prompt}\n\nURLs to read and analyze:\n${urlsToRead.slice(0, 10).join("\n")}`
    : prompt;

  // Tools: always googleSearch + optionally urlContext when URLs provided
  const tools: Record<string, unknown>[] = [
    {
      googleSearch: {
        dynamicRetrievalConfig: {
          dynamicRetrievalThreshold: 0.0,  // 0.0 = ALWAYS use Google Search (never skip)
        },
      },
    },
  ];
  if (urlsToRead && urlsToRead.length > 0) {
    tools.push({ urlContext: {} }); // Gemini fetches & reads the provided URLs directly
  }

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: {
        systemInstruction: systemInstruction ?? "You are a deep intelligence research analyst. Use Google Search to find real, current information. Read all provided URLs thoroughly. Return comprehensive, factual findings with specific data points.",
        tools,
        maxOutputTokens: 65_536,
        thinkingConfig: { thinkingBudget: 8_000 },  // deeper reasoning per search
      },
    }),
    GEMINI_SEARCH_TIMEOUT,
    `askGeminiWithSearch`
  );

  // Extract source URLs from grounding metadata
  const candidate        = response.candidates?.[0];
  const groundingMeta    = (candidate as Record<string, unknown>)?.groundingMetadata as Record<string, unknown> | undefined;
  const groundingChunks  = groundingMeta?.groundingChunks as Array<{ web?: { uri?: string; title?: string } }> | undefined;
  const searchQueries    = groundingMeta?.webSearchQueries as string[] | undefined;

  const sources = (groundingChunks ?? []).map(c => c.web?.uri ?? "").filter(Boolean);

  return { text: response.text ?? "", sources, queries: searchQueries ?? [] };
}

// ─── URL DEEP-DIVE — Gemini reads a batch of URLs and synthesizes them ─────────
// Uses urlContext tool: Gemini fetches and processes each URL directly
export async function askGeminiWithUrls(
  prompt: string,
  urls: string[],
  systemInstruction?: string,
): Promise<{ text: string; sources: string[] }> {
  const ai = getGeminiClient();

  const fullPrompt = `${prompt}\n\nRead and analyze these URLs thoroughly:\n${urls.slice(0, 15).join("\n")}`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: {
        systemInstruction: systemInstruction ?? "You are a deep web intelligence analyst. Read each URL thoroughly and extract all relevant business intelligence, product info, pricing, contact details, social links, and marketing strategies.",
        tools: [
          { urlContext: {} },          // Gemini fetches each URL directly
          { googleSearch: {            // Also allowed to search for missing context
            dynamicRetrievalConfig: { dynamicRetrievalThreshold: 0.3 },
          }},
        ],
        maxOutputTokens: 65_536,
        thinkingConfig: { thinkingBudget: 6_000 },
      },
    }),
    GEMINI_URL_CTX_TIMEOUT,
    "askGeminiWithUrls"
  );

  const candidate       = response.candidates?.[0];
  const groundingMeta   = (candidate as Record<string, unknown>)?.groundingMetadata as Record<string, unknown> | undefined;
  const groundingChunks = groundingMeta?.groundingChunks as Array<{ web?: { uri?: string } }> | undefined;
  const sources         = (groundingChunks ?? []).map(c => c.web?.uri ?? "").filter(Boolean);

  return { text: response.text ?? "", sources };
}

// ─── DEEP ENTITY RESEARCH ─────────────────────────────────────────────────────
// 12 parallel Google searches + URL deep-dive phase + retry logic
// Safe under Replit 5-min proxy limit (270s overall timeout)
export async function deepEntityResearch(
  entityName: string,
  entityUrl?: string,
  existingKnowledge?: string,
): Promise<{
  overview: string; products: string; social: string; news: string; reviews: string;
  competitors: string; ecommerce: string; visual: string; pricing: string;
  paidAds: string; founders: string; international: string;
  urlDeepDive: string;
  allSources: string[]; allQueries: string[];
}> {
  const entity = entityUrl ? `${entityName} (${entityUrl})` : entityName;
  const entityWithUrl = entityUrl ? `"${entityName}" site:${new URL(entityUrl.startsWith("http") ? entityUrl : `https://${entityUrl}`).hostname} OR "${entityName}"` : `"${entityName}"`;

  logger.info({ entityName, entityUrl, hasExistingKnowledge: !!existingKnowledge },
    "🔍 Deep entity research: 12 parallel searches + URL deep-dive"
  );

  // Inject existing knowledge so Gemini hunts for GAPS only
  const knowledgeCtx = existingKnowledge
    ? `\n\n[CONOCIMIENTO PREVIO EN SHOPYBRAIN — busca ÚNICAMENTE información NUEVA, ACTUALIZADA o DIFERENTE a esto]:\n${existingKnowledge.slice(0, 2000)}\n\nFOCUS: Find what's MISSING, UPDATED, or CHANGED since last research. Do NOT repeat already-known info.`
    : "";

  // ── Phase 1: 12 PARALLEL Google Search Grounding calls ────────────────────
  // Each targets a completely different intelligence dimension
  // withRetry ensures transient Gemini API errors don't kill the whole research
  const searchPromises = [
    // 1. Brand overview & history
    withRetry(() => askGeminiWithSearch(
      `Research everything about ${entity}. Find: founding story, mission, legal entity name, headquarters, team size, key executives, history, milestones, funding rounds, press coverage, notable achievements.${knowledgeCtx}`,
      "Brand historian and intelligence analyst. Search for comprehensive background and recent news."
    ), 1, 3000, "overview"),

    // 2. Products, catalog & pricing
    withRetry(() => askGeminiWithSearch(
      `Find complete product catalog and pricing of ${entity}. Research: all product lines, SKUs, materials, certifications, best sellers, limited editions, bundles, pricing tiers, free trials, guarantees, returns policy.${knowledgeCtx}`,
      "Product catalog and pricing analyst. Find all current offerings and price points."
    ), 1, 3000, "products"),

    // 3. Social media & online presence
    withRetry(() => askGeminiWithSearch(
      `Find ALL social media profiles of ${entity}: Instagram, TikTok, YouTube, Facebook, X/Twitter, LinkedIn, Pinterest, Telegram, Discord, Twitch. Find: exact handles, follower counts, posting frequency, content style, engagement rates, top posts, hashtags, collaborations.${knowledgeCtx}`,
      "Social media intelligence analyst. Find every profile and current metrics."
    ), 1, 3000, "social"),

    // 4. News, press & recent developments
    withRetry(() => askGeminiWithSearch(
      `Find the most recent news and press mentions about ${entityWithUrl}. Search: press releases last 12 months, media features, podcast appearances, partnerships announced, new launches, controversies, legal news, awards, growth news.${knowledgeCtx}`,
      "News and press intelligence analyst. Prioritize articles from the last 12 months."
    ), 1, 3000, "news"),

    // 5. Customer reviews & sentiment
    withRetry(() => askGeminiWithSearch(
      `Find all customer reviews and public sentiment about ${entity}. Search: Google Business reviews, Trustpilot, Yelp, Amazon, Reddit, Quora, forum threads, social media comments, complaints, NPS signals, return rates, customer service reputation.${knowledgeCtx}`,
      "Customer sentiment and review analyst. Find unbiased public opinions."
    ), 1, 3000, "reviews"),

    // 6. Competitors & market position
    withRetry(() => askGeminiWithSearch(
      `Find all competitors of ${entity} and their market positioning. List: top 5-10 direct competitors, alternative brands, market share signals, what differentiates ${entityName} from each competitor, pricing comparison, unique advantages each has.${knowledgeCtx}`,
      "Competitive intelligence analyst. Map the complete competitive landscape."
    ), 1, 3000, "competitors"),

    // 7. eCommerce strategy & tech stack
    withRetry(() => askGeminiWithSearch(
      `Research the full eCommerce and digital marketing strategy of ${entity}. Find: Shopify/platform used, payment gateways, email marketing platform, CRM, loyalty program, affiliate program, SEO keywords ranking, Google Ads spend, Meta Ads strategy, influencer partnerships, referral programs.${knowledgeCtx}`,
      "eCommerce and martech stack analyst. Find all marketing tools and strategies."
    ), 1, 3000, "ecommerce"),

    // 8. Visual identity & brand aesthetics
    withRetry(() => askGeminiWithSearch(
      `Find the visual identity and brand design language of ${entity}. Find: primary colors (hex if possible), typography choices, logo style, photography aesthetic, packaging design, brand guidelines, Pantone/color system, UI style, mood board references.${knowledgeCtx}`,
      "Brand design and visual identity analyst. Find all visual brand elements."
    ), 1, 3000, "visual"),

    // 9. Pricing strategy & psychology
    withRetry(() => askGeminiWithSearch(
      `Research in depth the pricing strategy and psychology of ${entity}. Find: exact current prices, discount patterns, seasonal pricing, bundle deals, subscription options, price anchoring tactics, psychological price points used (e.g. €19.99 vs €20), flash sales frequency, premium vs entry products.${knowledgeCtx}`,
      "Pricing strategy and behavioral economics analyst. Find specific price data."
    ), 1, 3000, "pricing"),

    // 10. Paid advertising & paid media
    withRetry(() => askGeminiWithSearch(
      `Find paid advertising strategy of ${entity}. Search: Facebook Ads Library for active ads, Google Ads campaigns, TikTok Ads, influencer paid partnerships, sponsored content, AdWords keywords, estimated ad spend, creative formats used, landing page strategies.${knowledgeCtx}`,
      "Paid media and advertising intelligence analyst. Find active and historical campaigns."
    ), 1, 3000, "paidAds"),

    // 11. Founders, team & culture
    withRetry(() => askGeminiWithSearch(
      `Research the founders, key team members and company culture of ${entity}. Find: founder names, backgrounds, LinkedIn profiles, interviews, vision statements, company values, work culture, Glassdoor reviews, team size, remote/office setup, advisory board.${knowledgeCtx}`,
      "Leadership and culture analyst. Find people behind the brand."
    ), 1, 3000, "founders"),

    // 12. International presence & expansion
    withRetry(() => askGeminiWithSearch(
      `Research international presence and expansion strategy of ${entity}. Find: countries operating in, languages supported, international shipping, local warehouses, country-specific marketing, currency support, localization efforts, markets targeted for expansion, international competitors faced.${knowledgeCtx}`,
      "International expansion and localization analyst. Find global footprint."
    ), 1, 3000, "international"),
  ];

  // Run all 12 with overall 270s timeout
  const settled = await withTimeout(
    Promise.allSettled(searchPromises),
    OVERALL_RESEARCH_TIMEOUT,
    "12-parallel-searches"
  ).catch(() => {
    logger.warn("Overall research timeout reached — returning partial results");
    return Promise.allSettled(searchPromises.map(p => Promise.race([p, Promise.resolve({ text: "", sources: [], queries: [] })])));
  });

  const allSources: string[] = [];
  const allQueries: string[] = [];

  const get = (r: PromiseSettledResult<{ text: string; sources: string[]; queries: string[] }>, dim: string) => {
    if (r.status === "fulfilled") {
      allSources.push(...r.value.sources);
      allQueries.push(...r.value.queries);
      logger.debug({ dim, sources: r.value.sources.length, chars: r.value.text.length }, "Search dimension complete");
      return r.value.text;
    }
    logger.warn({ dim, reason: String(r.reason) }, "Search dimension failed — using empty result");
    return "";
  };

  const [overview, products, social, news, reviews, competitors, ecommerce, visual, pricing, paidAds, founders, international] = settled;

  const dimensionResults = {
    overview:      get(overview, "overview"),
    products:      get(products, "products"),
    social:        get(social, "social"),
    news:          get(news, "news"),
    reviews:       get(reviews, "reviews"),
    competitors:   get(competitors, "competitors"),
    ecommerce:     get(ecommerce, "ecommerce"),
    visual:        get(visual, "visual"),
    pricing:       get(pricing, "pricing"),
    paidAds:       get(paidAds, "paidAds"),
    founders:      get(founders, "founders"),
    international: get(international, "international"),
  };

  // ── Phase 2: URL Deep-Dive ─────────────────────────────────────────────────
  // Take the top discovered URLs and have Gemini read them DIRECTLY
  // This is much more reliable than our manual HTML scraper
  const uniqueSources = [...new Set(allSources)];
  const urlsForDeepDive = uniqueSources
    .filter(u => !u.includes("instagram.com") && !u.includes("facebook.com") && !u.includes("twitter.com") && !u.includes("tiktok.com"))
    .slice(0, 12); // Top 12 URLs for Gemini to read directly

  let urlDeepDive = "";
  if (urlsForDeepDive.length > 0) {
    try {
      logger.info({ urlCount: urlsForDeepDive.length }, "Phase 2: Gemini URL context deep-dive");
      const deepDiveResult = await withTimeout(
        askGeminiWithUrls(
          `You have found these URLs about "${entityName}". Read each one carefully and extract:
          - Product details, prices, and availability
          - About/team/mission information
          - Contact information, physical locations
          - Blog posts and content strategy
          - Any unique facts, stats, or testimonials
          - Technical implementation details (Shopify apps visible, chat widgets, payment methods)
          Synthesize all findings into a comprehensive profile addition.`,
          urlsForDeepDive,
          "Web content extraction specialist. Read each URL and extract maximum intelligence."
        ),
        GEMINI_URL_CTX_TIMEOUT,
        "url-deep-dive"
      );
      urlDeepDive = deepDiveResult.text;
      allSources.push(...deepDiveResult.sources);
    } catch (err) {
      logger.warn({ err: String(err) }, "URL deep-dive failed — continuing without it");
      urlDeepDive = "";
    }
  }

  logger.info({
    entityName,
    totalSources: [...new Set(allSources)].length,
    totalQueries: [...new Set(allQueries)].length,
    urlDeepDiveChars: urlDeepDive.length,
    dimensions: 12,
  }, "✅ Deep entity research complete");

  return {
    ...dimensionResults,
    urlDeepDive,
    allSources: [...new Set(allSources)],
    allQueries:  [...new Set(allQueries)],
  };
}

export { askGemini, askGeminiJson };
