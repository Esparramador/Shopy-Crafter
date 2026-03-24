import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";

let _ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!_ai) {
    // Prefer direct API key (user's own key), fallback to Replit AI Integrations proxy
    const directKey = process.env.GEMINI_API_KEY;
    const proxyKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const proxyUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

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

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_PRO_MODEL = "gemini-2.5-pro";

async function askGemini(prompt: string, systemInstruction?: string, useProModel = false): Promise<string> {
  const ai = getGeminiClient();
  const model = useProModel ? GEMINI_PRO_MODEL : GEMINI_MODEL;
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemInstruction ?? "You are a precise business intelligence analyst. Always respond with structured, actionable data. Be concise and factual.",
      maxOutputTokens: 8192,
    },
  });
  return response.text ?? "";
}

async function askGeminiJson<T = unknown>(prompt: string, systemInstruction?: string, useProModel = false): Promise<T> {
  const ai = getGeminiClient();
  const model = useProModel ? GEMINI_PRO_MODEL : GEMINI_MODEL;
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemInstruction ?? "You are a precise business intelligence analyst. Always respond with valid JSON only, no markdown.",
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });
  const text = response.text ?? "{}";
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    return JSON.parse(match ? match[1] : text.replace(/```[\s\S]*?```/g, "").trim()) as T;
  }
}

export interface BusinessProfile {
  name: string;
  domain: string;
  industry: string;
  size: string;
  description: string;
  mainProducts: string[];
  targetAudience: string;
  priceRange: string;
  strengths: string[];
  weaknesses: string[];
  socialPresence: string[];
  estimatedRevenue: string;
  marketPosition: string;
  seoStrength: string;
  opportunities: string[];
  threats: string[];
  keyFindings: string;
}

export interface CompetitorIntelligence {
  domain: string;
  positioningStrategy: string;
  pricingStrategy: string;
  contentStrategy: string;
  topKeywords: string[];
  uniqueSellingPoints: string[];
  weaknesses: string[];
  estimatedTraffic: string;
  productCount: string;
  avgProductPrice: string;
  conversionTactics: string[];
  opportunities: string[];
}

export interface MarketIntelligence {
  niche: string;
  market: string;
  marketSize: string;
  growthRate: string;
  topPlayers: string[];
  avgPriceRange: { min: number; max: number; sweet: number };
  topKeywords: string[];
  seasonalPeaks: string[];
  buyerPersona: string;
  purchaseDrivers: string[];
  mainBarriers: string[];
  emergingTrends: string[];
  opportunities: string[];
  saturationLevel: string;
  recommendedPositioning: string;
}

export interface ProductTrendAnalysis {
  productType: string;
  market: string;
  demandLevel: string;
  trendDirection: string;
  searchVolumeTrend: string;
  topCompetitors: string[];
  avgPrice: number;
  priceRange: { min: number; max: number };
  keyFeatures: string[];
  winningDescriptionPatterns: string[];
  topImageTypes: string[];
  ctasThatConvert: string[];
  seasonality: string;
  recommendations: string[];
}

const INTELLIGENCE_SYSTEM = `You are OmniCore Intelligence — an elite eCommerce market research AI.
You analyze businesses, markets, and competitors for Shopify optimization agencies.
You provide structured, actionable intelligence based on your training knowledge about eCommerce, 
digital marketing, pricing psychology, SEO, and consumer behavior.
Always respond in the language matching the market (Spanish for 'es', English for 'en', etc).
Be specific, data-driven, and actionable. Never use placeholders like "N/A" — always provide best estimates.`;

export async function researchBusiness(
  businessName: string,
  domain: string,
  niche: string,
  market: string = "es"
): Promise<BusinessProfile> {
  logger.info({ businessName, domain }, "Gemini: researching business");
  const prompt = `Research this business and provide a comprehensive intelligence profile:

Business: ${businessName}
Domain: ${domain}
Niche: ${niche}
Market: ${market}

Based on the domain and niche, provide a detailed analysis including:
- Business description and what they sell
- Target audience and customer profile
- Estimated price range of their products
- Market position (budget/mid/premium/luxury)
- SEO strength estimate (weak/moderate/strong/very strong)
- Main strengths and weaknesses
- Social media presence indicators
- Estimated annual revenue range
- Key opportunities for a Shopify optimizer to improve their store
- Competitive threats they face

Return a JSON object with these exact fields:
{
  "name": "string",
  "domain": "string", 
  "industry": "string",
  "size": "micro|small|medium|large",
  "description": "string",
  "mainProducts": ["string"],
  "targetAudience": "string",
  "priceRange": "string (e.g. €10-€50)",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "socialPresence": ["string"],
  "estimatedRevenue": "string",
  "marketPosition": "budget|value|mid|premium|luxury",
  "seoStrength": "weak|moderate|strong|very strong",
  "opportunities": ["string"],
  "threats": ["string"],
  "keyFindings": "string (2-3 sentence executive summary)"
}`;

  return await askGeminiJson<BusinessProfile>(prompt, INTELLIGENCE_SYSTEM, true);
}

export async function analyzeCompetitor(
  domain: string,
  niche: string,
  market: string = "es"
): Promise<CompetitorIntelligence> {
  logger.info({ domain, niche }, "Gemini: analyzing competitor");
  const prompt = `Analyze this Shopify competitor store for an eCommerce optimization agency:

Domain: ${domain}
Niche: ${niche}
Market: ${market}

Provide competitive intelligence including:
- Their positioning strategy
- Pricing approach (discount-heavy, premium, value)
- Content/SEO strategy
- Top keywords they likely rank for
- Unique selling propositions
- Weaknesses an optimizer could exploit
- Estimated monthly traffic range
- Estimated product count
- Average product price
- Conversion optimization tactics they use
- Opportunities for competing stores

Return JSON with these exact fields:
{
  "domain": "string",
  "positioningStrategy": "string",
  "pricingStrategy": "string", 
  "contentStrategy": "string",
  "topKeywords": ["string"],
  "uniqueSellingPoints": ["string"],
  "weaknesses": ["string"],
  "estimatedTraffic": "string (e.g. 5K-20K/month)",
  "productCount": "string (e.g. 50-200)",
  "avgProductPrice": "string",
  "conversionTactics": ["string"],
  "opportunities": ["string"]
}`;

  return await askGeminiJson<CompetitorIntelligence>(prompt, INTELLIGENCE_SYSTEM);
}

export async function gatherMarketIntelligence(
  niche: string,
  market: string = "es"
): Promise<MarketIntelligence> {
  logger.info({ niche, market }, "Gemini: gathering market intelligence");
  const prompt = `Provide comprehensive market intelligence for a Shopify optimization agency about:

Niche: ${niche}
Market: ${market} (${market === "es" ? "Spain/Spanish market" : market === "en" ? "English-speaking market" : market})

Include:
- Market size estimate
- Growth rate (declining/stable/growing/booming)
- Top 5 players in this space
- Typical price ranges (min, max, and sweet spot)
- Top 10 search keywords
- Seasonal peaks (months)
- Buyer persona description
- Top purchase drivers (why people buy)
- Main purchase barriers (why they don't buy)
- Emerging trends to watch
- Key opportunities for optimization
- Market saturation level
- Best positioning strategy recommendation

Return JSON with these exact fields:
{
  "niche": "string",
  "market": "string",
  "marketSize": "string",
  "growthRate": "declining|stable|growing|booming",
  "topPlayers": ["string"],
  "avgPriceRange": { "min": number, "max": number, "sweet": number },
  "topKeywords": ["string"],
  "seasonalPeaks": ["string"],
  "buyerPersona": "string",
  "purchaseDrivers": ["string"],
  "mainBarriers": ["string"],
  "emergingTrends": ["string"],
  "opportunities": ["string"],
  "saturationLevel": "low|medium|high|saturated",
  "recommendedPositioning": "string"
}`;

  return await askGeminiJson<MarketIntelligence>(prompt, INTELLIGENCE_SYSTEM, true);
}

export async function analyzeProductTrends(
  productType: string,
  market: string = "es"
): Promise<ProductTrendAnalysis> {
  logger.info({ productType, market }, "Gemini: analyzing product trends");
  const prompt = `Analyze product trends and optimization tactics for:

Product type: ${productType}
Market: ${market}

Provide:
- Current demand level
- Trend direction (rising/stable/declining)
- Search volume trend
- Top competing brands/stores
- Average market price
- Price range (min/max)
- Key product features that drive conversions
- Winning description patterns and structures
- Best image types (lifestyle, white bg, infographic, etc)
- CTAs that convert well
- Seasonality patterns
- Specific optimization recommendations for Shopify

Return JSON with these exact fields:
{
  "productType": "string",
  "market": "string",
  "demandLevel": "very low|low|moderate|high|very high",
  "trendDirection": "rising|stable|declining",
  "searchVolumeTrend": "string",
  "topCompetitors": ["string"],
  "avgPrice": number,
  "priceRange": { "min": number, "max": number },
  "keyFeatures": ["string"],
  "winningDescriptionPatterns": ["string"],
  "topImageTypes": ["string"],
  "ctasThatConvert": ["string"],
  "seasonality": "string",
  "recommendations": ["string"]
}`;

  return await askGeminiJson<ProductTrendAnalysis>(prompt, INTELLIGENCE_SYSTEM);
}

export async function researchPersonOrBrand(
  name: string,
  context: string,
  market: string = "es"
): Promise<{ profile: string; digitalPresence: string[]; contentThemes: string[]; audienceInsights: string; partnershipOpportunities: string[]; keyFindings: string }> {
  logger.info({ name }, "Gemini: researching person/brand");
  const prompt = `Research this person or brand for eCommerce partnership/influencer analysis:

Name: ${name}
Context: ${context}
Market: ${market}

Analyze their:
- Profile and what they're known for
- Digital presence (platforms, estimated following)
- Content themes they cover
- Audience insights (demographics, interests)
- Partnership/collaboration opportunities for a Shopify store
- Key findings for an eCommerce agency

Return JSON:
{
  "profile": "string",
  "digitalPresence": ["string"],
  "contentThemes": ["string"],
  "audienceInsights": "string",
  "partnershipOpportunities": ["string"],
  "keyFindings": "string"
}`;

  return await askGeminiJson(prompt, INTELLIGENCE_SYSTEM);
}

export async function multiModelAnalysis(
  topic: string,
  geminiContext: string,
  claudeAnalyzer: (geminiFindings: string) => Promise<string>
): Promise<{ geminiFindings: string; claudeAnalysis: string; combined: string }> {
  logger.info({ topic }, "Multi-model analysis: Gemini + Claude");

  const geminiFindings = await askGemini(
    `${geminiContext}\n\nTopic: ${topic}\n\nProvide detailed research findings:`,
    INTELLIGENCE_SYSTEM,
    true
  );

  const claudeAnalysis = await claudeAnalyzer(geminiFindings);

  const combinedPrompt = `Based on research from two AI systems, provide a synthesis:

GEMINI RESEARCH:
${geminiFindings}

CLAUDE ANALYSIS:
${claudeAnalysis}

Provide a single cohesive combined intelligence report that takes the best insights from both analyses.`;

  const combined = await askGemini(combinedPrompt, INTELLIGENCE_SYSTEM);

  return { geminiFindings, claudeAnalysis, combined };
}

// ─── GEMINI WITH GOOGLE SEARCH GROUNDING ─────────────────────────────────────
// Uses real Google Search to find information — not hallucinated, actually searched
export async function askGeminiWithSearch(
  prompt: string,
  systemInstruction?: string,
): Promise<{ text: string; sources: string[]; queries: string[] }> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemInstruction ?? "You are a deep intelligence research analyst. Search thoroughly and return comprehensive, factual findings.",
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 8192,
    },
  });

  // Extract discovered source URLs from grounding metadata
  const candidate = response.candidates?.[0];
  const groundingMetadata = (candidate as Record<string, unknown>)?.groundingMetadata as Record<string, unknown> | undefined;
  const groundingChunks = groundingMetadata?.groundingChunks as Array<{ web?: { uri?: string; title?: string } }> | undefined;
  const searchQueries = groundingMetadata?.webSearchQueries as string[] | undefined;

  const sources = (groundingChunks ?? [])
    .map(c => c.web?.uri ?? "")
    .filter(Boolean);

  return {
    text: response.text ?? "",
    sources,
    queries: searchQueries ?? [],
  };
}

// ─── DEEP ENTITY RESEARCH — searches EVERYTHING about a brand/person/business ─
export async function deepEntityResearch(entityName: string, entityUrl?: string): Promise<{
  overview: string;
  products: string;
  social: string;
  news: string;
  reviews: string;
  competitors: string;
  ecommerce: string;
  allSources: string[];
  allQueries: string[];
}> {
  const entity = entityUrl ? `${entityName} (${entityUrl})` : entityName;

  logger.info({ entityName, entityUrl }, "Deep parallel entity research with Google Search Grounding");

  // 8 parallel searches — each targets a different dimension of intelligence
  const [overview, products, social, news, reviews, competitors, ecommerce, visual] = await Promise.allSettled([
    askGeminiWithSearch(
      `Research everything about this brand/company/person: "${entity}". Find: founding story, mission, team, locations, size, legal name, history, key milestones, notable facts.`,
      "Deep brand intelligence analyst. Search and synthesize all public information."
    ),
    askGeminiWithSearch(
      `Find all products and services offered by "${entity}". Research: product catalog, pricing strategy, best sellers, unique selling propositions, materials used, manufacturing, certifications, quality indicators.`,
      "Product intelligence analyst. Find detailed product and service information."
    ),
    askGeminiWithSearch(
      `Find ALL social media profiles and online presence of "${entity}". Research: Instagram, Facebook, X/Twitter, TikTok, YouTube, LinkedIn, Pinterest accounts. Find follower counts, posting frequency, content style, engagement rates, hashtags used.`,
      "Social media intelligence analyst. Find all social profiles and content strategy."
    ),
    askGeminiWithSearch(
      `Find recent news, press coverage, articles, blog posts, interviews about "${entity}". Find: press releases, media mentions, partnerships announced, awards won, controversies, community presence.`,
      "News and press intelligence analyst."
    ),
    askGeminiWithSearch(
      `Find customer reviews, testimonials, and sentiment about "${entity}". Search: Google reviews, Trustpilot, social media comments, forum mentions, Reddit threads, customer complaints, NPS signals.`,
      "Customer sentiment analyst. Find reviews and public opinion."
    ),
    askGeminiWithSearch(
      `Find competitors and market positioning of "${entity}". Identify: direct competitors, indirect competitors, market share signals, competitive advantages, pricing compared to competitors, unique differentiation.`,
      "Competitive intelligence analyst."
    ),
    askGeminiWithSearch(
      `Research the eCommerce strategy, tech stack, and online marketing of "${entity}". Find: Shopify/platform used, email marketing tools, advertising channels, SEO keywords, conversion tactics, Klaviyo/email flows, influencer partnerships, discount strategies.`,
      "eCommerce strategy analyst."
    ),
    askGeminiWithSearch(
      `Find visual identity, brand aesthetics, and design language of "${entity}". Find: color palette used, logo style, photography style, packaging, brand guidelines if public, font choices, visual references.`,
      "Visual brand identity analyst."
    ),
  ]);

  // Extract results and aggregate all sources discovered
  const allSources: string[] = [];
  const allQueries: string[] = [];

  const get = (r: PromiseSettledResult<{ text: string; sources: string[]; queries: string[] }>, fallback = "") => {
    if (r.status === "fulfilled") {
      allSources.push(...r.value.sources);
      allQueries.push(...r.value.queries);
      return r.value.text;
    }
    logger.warn({ reason: r.reason }, "Entity research search failed (non-critical)");
    return fallback;
  };

  return {
    overview: get(overview),
    products: get(products),
    social: get(social),
    news: get(news),
    reviews: get(reviews),
    competitors: get(competitors),
    ecommerce: get(ecommerce),
    visual: get(visual),
    allSources: [...new Set(allSources)], // deduplicate
    allQueries: [...new Set(allQueries)],
  } as {
    overview: string; products: string; social: string; news: string;
    reviews: string; competitors: string; ecommerce: string; allSources: string[]; allQueries: string[];
  };
}

export { askGemini, askGeminiJson };
