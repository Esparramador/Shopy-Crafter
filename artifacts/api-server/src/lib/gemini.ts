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
let _aiDirect: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!_ai) {
    const directKey = process.env.GEMINI_API_KEY;
    const proxyKey  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const proxyUrl  = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

    if (directKey) {
      const savedGoogleKey = process.env.GOOGLE_API_KEY;
      if (savedGoogleKey && savedGoogleKey !== directKey) {
        delete process.env.GOOGLE_API_KEY;
      }
      _ai = new GoogleGenAI({ apiKey: directKey });
      if (savedGoogleKey) {
        process.env.GOOGLE_API_KEY = savedGoogleKey;
      }
    } else if (proxyKey && proxyUrl) {
      _ai = new GoogleGenAI({ apiKey: proxyKey, httpOptions: { apiVersion: "", baseUrl: proxyUrl } });
    } else {
      throw new Error("Gemini not configured: set GEMINI_API_KEY or Replit AI Integrations");
    }
  }
  return _ai;
}

function getGeminiDirectClient(): GoogleGenAI | null {
  const directKey = process.env.GEMINI_API_KEY;
  if (!directKey) return null;
  if (!_aiDirect) {
    const savedGoogleKey = process.env.GOOGLE_API_KEY;
    if (savedGoogleKey) delete process.env.GOOGLE_API_KEY;
    _aiDirect = new GoogleGenAI({ apiKey: directKey });
    if (savedGoogleKey) process.env.GOOGLE_API_KEY = savedGoogleKey;
  }
  return _aiDirect;
}

export function isGeminiAvailable(): boolean {
  return !!(process.env.GEMINI_API_KEY || (process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY));
}

const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;
let _searchCircuitOpen = 0;
let _generationCircuitOpen = 0;

function isPermissionDenied(err: unknown): boolean {
  const s = String(err);
  return s.includes("403") || s.includes("PERMISSION_DENIED") || s.includes("denied access") || s.includes("PermissionDenied");
}

export function isGeminiSearchBlocked(): boolean {
  return _searchCircuitOpen > 0 && Date.now() - _searchCircuitOpen < CIRCUIT_BREAKER_COOLDOWN_MS;
}

function isGeminiGenerationBlocked(): boolean {
  return _generationCircuitOpen > 0 && Date.now() - _generationCircuitOpen < CIRCUIT_BREAKER_COOLDOWN_MS;
}

export function resetGeminiCircuitBreakers(): { search: boolean; generation: boolean } {
  const searchWasOpen = _searchCircuitOpen > 0;
  const genWasOpen = _generationCircuitOpen > 0;
  _searchCircuitOpen = 0;
  _generationCircuitOpen = 0;
  _ai = null;
  logger.info("[Gemini Circuit Breaker] RESET manual — search & generation desbloqueados, cliente recreado");
  return { search: searchWasOpen, generation: genWasOpen };
}

export function getGeminiStatus(): { searchBlocked: boolean; generationBlocked: boolean; cooldownMs: number; searchBlockedSecsAgo: number; generationBlockedSecsAgo: number } {
  return {
    searchBlocked: isGeminiSearchBlocked(),
    generationBlocked: isGeminiGenerationBlocked(),
    cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
    searchBlockedSecsAgo: _searchCircuitOpen > 0 ? Math.round((Date.now() - _searchCircuitOpen) / 1000) : 0,
    generationBlockedSecsAgo: _generationCircuitOpen > 0 ? Math.round((Date.now() - _generationCircuitOpen) / 1000) : 0,
  };
}

function tripSearchCircuit(): void {
  _searchCircuitOpen = Date.now();
  logger.error(`[Gemini Circuit Breaker] Search grounding BLOCKED (403). Cooldown ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`);
}

function tripGenerationCircuit(): void {
  _generationCircuitOpen = Date.now();
  logger.error(`[Gemini Circuit Breaker] Generation BLOCKED (403). Cooldown ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`);
}

// ─── Model selection (resolved through the AI registry) ──────────────────────
// IMPORTANT: do NOT hardcode model names here. The registry (`lib/ai-models.ts`)
// resolves the active model via override → DB (`platform_settings`) → ENV →
// hard default, so admins can swap models live from the admin UI / chatbot
// (`set_ai_model`) without redeploys.
import { pickModelSync, pickModel } from "./ai-models.js";

/** Fast tier (default Gemini 2.5 Flash). Sync — uses ENV/defaults only. */
function geminiFast(): string { return pickModelSync("gemini", "fast"); }
/** Smart/Pro tier (default Gemini 2.5 Pro). Sync — uses ENV/defaults only. */
function geminiPro(): string { return pickModelSync("gemini", "smart"); }
/** Async resolver — also reads DB overrides (60s cached). Use in non-hot paths. */
export async function resolveGeminiModel(tier: "fast" | "smart" | "genius" | "vision" = "fast"): Promise<string> {
  return pickModel("gemini", tier);
}

// ─── Timeout & retry config ───────────────────────────────────────────────────
// Replit proxy cuts at 300s. Server socket at 600s. We use 270s for user-facing
// requests (safe margin) and generous per-call limits so each search dimension
// has room to finish. Background/cron jobs have no proxy limit.
const GEMINI_CALL_TIMEOUT_MS   = 180_000;  // 180s per individual Gemini call
const GEMINI_SEARCH_TIMEOUT    = 180_000;  // 180s per search-grounding call
const OVERALL_RESEARCH_TIMEOUT = 270_000;  // 270s total for full entity research (safe under 5-min proxy)
const GEMINI_URL_CTX_TIMEOUT   = 180_000;  // 180s for URL context deep-dive (SDK handles URL fetching internally)

// ─── Utility: race a promise against a timeout ────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`⏱ Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Utility: retry with rate-limit-aware backoff ──────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 3_000,
  label = "call"
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isPermissionDenied(err)) {
        logger.error({ label }, `[withRetry] 403 PERMISSION_DENIED on ${label} — not retrying`);
        throw err;
      }
      if (attempt < retries) {
        const errStr = String(err);
        const isRateLimit = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("rate");
        const backoff = isRateLimit
          ? Math.min(60_000, delayMs * Math.pow(3, attempt))
          : delayMs * Math.pow(2, attempt);
        logger.warn({ label, attempt, backoff, isRateLimit, err: errStr }, `Retrying ${label} in ${backoff}ms…`);
        await new Promise(r => setTimeout(r, backoff));
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

// ─── Base generation (no search) ─────────────────────────────────────────────
async function askGemini(prompt: string, systemInstruction?: string, useProModel = false): Promise<string> {
  if (isGeminiGenerationBlocked()) {
    logger.warn("[askGemini] Circuit breaker open — falling back to Claude");
    try {
      const { askClaudeWithBrain } = await import("./claude.js");
      return await askClaudeWithBrain(0, [{ role: "user" as const, content: prompt }], systemInstruction ?? "You are a precise business intelligence analyst.", "general");
    } catch (claudeErr) {
      logger.error({ err: String(claudeErr) }, "[askGemini] Claude fallback also failed");
      return "";
    }
  }

  try {
    const ai    = getGeminiClient();
    const model = useProModel ? geminiPro() : geminiFast();

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

    const candidate = response.candidates?.[0];
    if ((candidate as any)?.finishReason === "MAX_TOKENS") {
      logger.warn({ model, maxOutputTokens: 65536 }, "[Gemini] ⚠️ RESPONSE TRUNCATED — hit maxOutputTokens limit");
    }

    try {
      const { recordApiUsage, calcGeminiCost } = await import("./api-usage.js");
      const usage = (response as any).usageMetadata ?? {};
      const inTok = Number(usage.promptTokenCount) || 0;
      const outTok = Number(usage.candidatesTokenCount) || 0;
      void recordApiUsage({
        provider: "gemini",
        operation: "askGemini",
        model,
        inputUnits: inTok,
        outputUnits: outTok,
        unitsLabel: "tokens",
        costUsd: calcGeminiCost(model, inTok, outTok),
      });
    } catch { /* nunca bloquea */ }

    return response.text ?? "";
  } catch (err) {
    if (isPermissionDenied(err)) {
      tripGenerationCircuit();
      logger.warn("[askGemini] 403 detected — falling back to Claude");
      try {
        const { askClaudeWithBrain } = await import("./claude.js");
        return await askClaudeWithBrain(0, [{ role: "user" as const, content: prompt }], systemInstruction ?? "You are a precise business intelligence analyst.", "general");
      } catch { return ""; }
    }
    throw err;
  }
}

// ─── Multi-turn conversational chat (no search) ───────────────────────────────
// For conversational assistants (e.g. the landing pre-sales bot). Maps a
// user/assistant transcript to Gemini `contents` (user/model roles), applies the
// same circuit-breaker + timeout + usage-recording + Claude-fallback patterns as
// askGemini. A modest thinkingBudget gives real reasoning while staying fast.
export interface GeminiChatMessage { role: "user" | "assistant"; content: string }

export async function askGeminiChat(
  messages: GeminiChatMessage[],
  systemInstruction?: string,
  opts: { useProModel?: boolean; maxOutputTokens?: number; thinkingBudget?: number } = {},
): Promise<string> {
  const { useProModel = false, maxOutputTokens = 2048, thinkingBudget = 1024 } = opts;

  const contents = messages
    .filter(m => m.content && (m.role === "user" || m.role === "assistant"))
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  if (contents.length === 0) return "";

  const claudeFallback = async (): Promise<string> => {
    const { askClaudeWithBrain } = await import("./claude.js");
    const claudeMsgs = messages
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }));
    return askClaudeWithBrain(0, claudeMsgs, systemInstruction ?? "Eres un asistente útil.", "general");
  };

  if (isGeminiGenerationBlocked()) {
    logger.warn("[askGeminiChat] Circuit breaker open — falling back to Claude");
    try { return await claudeFallback(); }
    catch (err) { logger.error({ err: String(err) }, "[askGeminiChat] Claude fallback also failed"); return ""; }
  }

  try {
    const ai    = getGeminiClient();
    const model = useProModel ? geminiPro() : geminiFast();

    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          maxOutputTokens,
          ...(thinkingBudget != null ? { thinkingConfig: { thinkingBudget } } : {}),
        },
      }),
      GEMINI_CALL_TIMEOUT_MS,
      `askGeminiChat(${model})`,
    );

    const candidate = response.candidates?.[0];
    if ((candidate as any)?.finishReason === "MAX_TOKENS") {
      logger.warn({ model, maxOutputTokens }, "[Gemini Chat] ⚠️ RESPONSE TRUNCATED — hit maxOutputTokens limit");
    }

    try {
      const { recordApiUsage, calcGeminiCost } = await import("./api-usage.js");
      const usage = (response as any).usageMetadata ?? {};
      const inTok = Number(usage.promptTokenCount) || 0;
      const outTok = Number(usage.candidatesTokenCount) || 0;
      void recordApiUsage({
        provider: "gemini",
        operation: "askGeminiChat",
        model,
        inputUnits: inTok,
        outputUnits: outTok,
        unitsLabel: "tokens",
        costUsd: calcGeminiCost(model, inTok, outTok),
      });
    } catch { /* nunca bloquea */ }

    const text = response.text ?? "";
    if (text.trim()) return text;

    // Empty body (e.g. thinking consumed budget) → try Claude rather than returning blank
    logger.warn("[askGeminiChat] Empty Gemini response — falling back to Claude");
    try { return await claudeFallback(); } catch { return ""; }
  } catch (err) {
    if (isPermissionDenied(err)) {
      tripGenerationCircuit();
      logger.warn("[askGeminiChat] 403 detected — falling back to Claude");
      try { return await claudeFallback(); } catch { return ""; }
    }
    throw err;
  }
}

// ─── JSON-structured generation ───────────────────────────────────────────────
async function askGeminiJson<T = unknown>(prompt: string, systemInstruction?: string, useProModel = false): Promise<T> {
  if (isGeminiGenerationBlocked()) {
    logger.warn("[askGeminiJson] Circuit breaker open — falling back to Claude");
    try {
      const { askClaudeJson } = await import("./claude.js");
      return await askClaudeJson<T>(0, prompt, systemInstruction ?? "You are a precise business intelligence analyst. Always respond with valid JSON only, no markdown.");
    } catch (claudeErr) {
      logger.error({ err: String(claudeErr) }, "[askGeminiJson] Claude fallback also failed");
      return {} as T;
    }
  }

  try {
    const ai    = getGeminiClient();
    const model = useProModel ? geminiPro() : geminiFast();

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

    const jsonCandidate = response.candidates?.[0];
    if ((jsonCandidate as any)?.finishReason === "MAX_TOKENS") {
      logger.warn({ model, maxOutputTokens: 65536 }, "[Gemini JSON] ⚠️ RESPONSE TRUNCATED — hit maxOutputTokens limit");
    }

    try {
      const { recordApiUsage, calcGeminiCost } = await import("./api-usage.js");
      const usage = (response as any).usageMetadata ?? {};
      const inTok = Number(usage.promptTokenCount) || 0;
      const outTok = Number(usage.candidatesTokenCount) || 0;
      void recordApiUsage({
        provider: "gemini",
        operation: "askGeminiJson",
        model,
        inputUnits: inTok,
        outputUnits: outTok,
        unitsLabel: "tokens",
        costUsd: calcGeminiCost(model, inTok, outTok),
      });
    } catch { /* nunca bloquea */ }

    const text = response.text ?? "{}";
    try {
      return JSON.parse(text) as T;
    } catch {
      try {
        const match = text.match(/```json\s*([\s\S]*?)```/);
        return JSON.parse(match ? match[1] : text.replace(/```[\s\S]*?```/g, "").trim()) as T;
      } catch {
        logger.error({ textPreview: text.slice(0, 300) }, "[Gemini JSON] Double parse failure");
        throw new Error("Gemini returned invalid JSON even after cleanup");
      }
    }
  } catch (err) {
    if (isPermissionDenied(err)) {
      tripGenerationCircuit();
      logger.warn("[askGeminiJson] 403 detected — falling back to Claude");
      try {
        const { askClaudeJson } = await import("./claude.js");
        return await askClaudeJson<T>(0, prompt, systemInstruction ?? "You are a precise business intelligence analyst.");
      } catch { return {} as T; }
    }
    throw err;
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
  urlsToRead?: string[],
): Promise<{ text: string; sources: string[]; queries: string[]; usage?: { inputTokens: number; outputTokens: number; costUsd: number; model: string } }> {
  const EMPTY = { text: "", sources: [] as string[], queries: [] as string[] };

  if (isGeminiSearchBlocked()) {
    const directClient = getGeminiDirectClient();
    if (directClient) {
      logger.info("[askGeminiWithSearch] Circuit breaker open but direct API key available — retrying with direct key");
      _searchCircuitOpen = 0;
    } else {
      logger.debug("[askGeminiWithSearch] Circuit breaker open — returning empty");
      return EMPTY;
    }
  }

  const fullPrompt = urlsToRead && urlsToRead.length > 0
    ? `${prompt}\n\nURLs to read and analyze:\n${urlsToRead.slice(0, 10).join("\n")}`
    : prompt;

  const tools: Record<string, unknown>[] = [
    {
      googleSearch: {
        dynamicRetrievalConfig: {
          dynamicRetrievalThreshold: 0.0,
        },
      },
    },
  ];
  if (urlsToRead && urlsToRead.length > 0) {
    tools.push({ urlContext: {} });
  }

  const clientsToTry: Array<{ ai: GoogleGenAI; label: string }> = [];
  const directClient = getGeminiDirectClient();
  if (directClient) clientsToTry.push({ ai: directClient, label: "direct-api-key" });
  try { clientsToTry.push({ ai: getGeminiClient(), label: "default-client" }); } catch {}
  const seen = new Set<GoogleGenAI>();
  const uniqueClients = clientsToTry.filter(c => { if (seen.has(c.ai)) return false; seen.add(c.ai); return true; });

  for (const { ai, label } of uniqueClients) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: geminiFast(),
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          config: {
            systemInstruction: systemInstruction ?? "You are a deep intelligence research analyst. Use Google Search to find real, current information. Read all provided URLs thoroughly. Return comprehensive, factual findings with specific data points.",
            tools,
            maxOutputTokens: 65_536,
            thinkingConfig: { thinkingBudget: 8_000 },
          },
        }),
        GEMINI_SEARCH_TIMEOUT,
        `askGeminiWithSearch(${label})`
      );

      const candidate = response.candidates?.[0];
      if ((candidate as any)?.finishReason === "MAX_TOKENS") {
        logger.warn({ maxOutputTokens: 65536 }, "[Gemini Search] RESPONSE TRUNCATED — hit maxOutputTokens limit");
      }

      const groundingMeta = (candidate as Record<string, unknown>)?.groundingMetadata as Record<string, unknown> | undefined;
      const groundingChunks = groundingMeta?.groundingChunks as Array<{ web?: { uri?: string; title?: string } }> | undefined;
      const searchQueries = groundingMeta?.webSearchQueries as string[] | undefined;

      const sources = (groundingChunks ?? []).map(c => c.web?.uri ?? "").filter(Boolean);

      let callUsage: { inputTokens: number; outputTokens: number; costUsd: number; model: string } | undefined;
      try {
        const { recordApiUsage, calcGeminiCost } = await import("./api-usage.js");
        const usageMeta = (response as any).usageMetadata ?? {};
        const inTok = Number(usageMeta.promptTokenCount) || 0;
        const outTok = Number(usageMeta.candidatesTokenCount) || 0;
        const cost = calcGeminiCost(geminiFast(), inTok, outTok);
        callUsage = { inputTokens: inTok, outputTokens: outTok, costUsd: cost, model: geminiFast() };
        void recordApiUsage({
          provider: "gemini",
          operation: "askGeminiWithSearch",
          model: geminiFast(),
          inputUnits: inTok,
          outputUnits: outTok,
          unitsLabel: "tokens",
          costUsd: cost,
          metadata: { sources: sources.length, queries: (searchQueries ?? []).length, client: label },
        });
      } catch {}

      _searchCircuitOpen = 0;
      logger.info({ label, sources: sources.length }, "[askGeminiWithSearch] Success");
      return { text: response.text ?? "", sources, queries: searchQueries ?? [], usage: callUsage };
    } catch (err) {
      if (isPermissionDenied(err)) {
        logger.warn({ label }, `[askGeminiWithSearch] 403 on ${label} — trying next client`);
        continue;
      }
      throw err;
    }
  }

  tripSearchCircuit();
  return EMPTY;
}

// ─── URL DEEP-DIVE — Gemini reads a batch of URLs and synthesizes them ─────────
// Uses urlContext tool: Gemini fetches and processes each URL directly
export async function askGeminiWithUrls(
  prompt: string,
  urls: string[],
  systemInstruction?: string,
): Promise<{ text: string; sources: string[] }> {
  const EMPTY = { text: "", sources: [] as string[] };

  if (isGeminiSearchBlocked()) {
    logger.debug("[askGeminiWithUrls] Circuit breaker open — returning empty");
    return EMPTY;
  }

  try {
    const ai = getGeminiClient();

    const fullPrompt = `${prompt}\n\nRead and analyze these URLs thoroughly:\n${urls.slice(0, 15).join("\n")}`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: geminiFast(),
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          systemInstruction: systemInstruction ?? "You are a deep web intelligence analyst. Read each URL thoroughly and extract all relevant business intelligence, product info, pricing, contact details, social links, and marketing strategies.",
          tools: [
            { urlContext: {} },
            { googleSearch: { dynamicRetrievalConfig: { dynamicRetrievalThreshold: 0.3 } } } as any,
          ],
          maxOutputTokens: 65_536,
          thinkingConfig: { thinkingBudget: 6_000 },
        },
      }),
      GEMINI_URL_CTX_TIMEOUT,
      "askGeminiWithUrls"
    );

    const candidate       = response.candidates?.[0];
    if ((candidate as any)?.finishReason === "MAX_TOKENS") {
      logger.warn({ maxOutputTokens: 65536 }, "[Gemini URLs] RESPONSE TRUNCATED — hit maxOutputTokens limit");
    }

    const groundingMeta   = (candidate as Record<string, unknown>)?.groundingMetadata as Record<string, unknown> | undefined;
    const groundingChunks = groundingMeta?.groundingChunks as Array<{ web?: { uri?: string } }> | undefined;
    const sources         = (groundingChunks ?? []).map(c => c.web?.uri ?? "").filter(Boolean);

    try {
      const { recordApiUsage, calcGeminiCost } = await import("./api-usage.js");
      const usage = (response as any).usageMetadata ?? {};
      const inTok = Number(usage.promptTokenCount) || 0;
      const outTok = Number(usage.candidatesTokenCount) || 0;
      void recordApiUsage({
        provider: "gemini",
        operation: "askGeminiWithUrls",
        model: geminiFast(),
        inputUnits: inTok,
        outputUnits: outTok,
        unitsLabel: "tokens",
        costUsd: calcGeminiCost(geminiFast(), inTok, outTok),
        metadata: { urls: urls.length, sources: sources.length },
      });
    } catch { /* nunca bloquea */ }

    return { text: response.text ?? "", sources };
  } catch (err) {
    if (isPermissionDenied(err)) {
      tripSearchCircuit();
      return EMPTY;
    }
    throw err;
  }
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
  instagramDeep: string; socialExtended: string; financials: string;
  urlDeepDive: string;
  allSources: string[]; allQueries: string[];
}> {
  const entity = entityUrl ? `${entityName} (${entityUrl})` : entityName;
  const entityWithUrl = entityUrl ? `"${entityName}" site:${new URL(entityUrl.startsWith("http") ? entityUrl : `https://${entityUrl}`).hostname} OR "${entityName}"` : `"${entityName}"`;

  logger.info({ entityName, entityUrl, hasExistingKnowledge: !!existingKnowledge },
    "🔍 Deep entity research: 15 parallel searches + URL deep-dive"
  );

  // Inject existing knowledge so Gemini hunts for GAPS only — with SPECIFIC instructions
  // on what dimensions are already covered vs what's weak/missing
  let knowledgeCtx = "";
  if (existingKnowledge) {
    knowledgeCtx = `\n\n[⚠️ CONOCIMIENTO PREVIO EN SHOPYBRAIN — LEE CON ATENCIÓN]:\n${existingKnowledge.slice(0, 12000)}\n\n🎯 INSTRUCCIONES CRÍTICAS:
- NO repitas información que ya aparece arriba — ShopyBrain ya lo sabe.
- Busca ÚNICAMENTE datos NUEVOS, MÁS RECIENTES, o desde FUENTES DIFERENTES.
- Si ya tenemos precios de una fuente, busca precios en OTRA fuente o tienda para comparar.
- Si ya tenemos redes sociales, busca métricas ACTUALIZADAS o perfiles que falten.
- Si ya tenemos competidores, busca competidores DIFERENTES o información nueva sobre los ya conocidos.
- Prioriza: datos numéricos concretos, URLs verificables, fechas recientes, citas textuales.
- NUNCA digas "según investigación anterior" — aporta solo VALOR NUEVO.`;
  }

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

    // 13. Instagram deep-dive — content strategy & aesthetics
    withRetry(() => askGeminiWithSearch(
      `Deep-dive into the Instagram strategy of ${entity}. Find: exact @handle, bio text, link in bio destination, follower/following count, avg likes/comments per post, posting frequency, Reels vs Carousel vs Static ratio, Story highlights, branded hashtags, UGC hashtags, influencer collaborations, aesthetic (colors, filters, grid layout pattern), recent campaign themes, shopping tags enabled, Instagram Shop products, giveaway frequency.${knowledgeCtx}`,
      "Instagram marketing analyst specialized in visual commerce brands. Extract every measurable metric."
    ), 1, 3000, "instagramDeep"),

    // 14. Extended social & community — TikTok, YouTube, Discord, forums
    withRetry(() => askGeminiWithSearch(
      `Research the extended social and community presence of ${entity} BEYOND Instagram. Find: TikTok @handle, video count, avg views, viral videos, YouTube subscribers, video count, avg views, Shorts usage, Discord/Slack community size, Reddit mentions (r/ subreddits), Quora answers, niche forums, WhatsApp/Telegram groups, podcast appearances, Clubhouse/Twitter Spaces, community engagement programs, ambassador programs, loyalty programs.${knowledgeCtx}`,
      "Community and social intelligence analyst. Map presence across ALL platforms beyond Instagram."
    ), 1, 3000, "socialExtended"),

    // 15. Financial signals & unit economics
    withRetry(() => askGeminiWithSearch(
      `Research financial signals and unit economics of ${entity}. Find: estimated annual revenue, revenue growth rate, number of employees (LinkedIn, Glassdoor), estimated AOV (average order value), estimated order volume, funding rounds and amounts, investor names, profitability signals, warehouse/logistics partners, fulfillment model (in-house/3PL), estimated CAC from ad library, estimated LTV signals from subscription/repeat purchase data, Crunchbase/PitchBook data, company registry filings.${knowledgeCtx}`,
      "Financial intelligence and unit economics analyst. Find revenue signals, funding data, and operational metrics."
    ), 1, 3000, "financials"),
  ];

  // Run all 15 with overall 270s timeout
  const settled = await withTimeout(
    Promise.allSettled(searchPromises),
    OVERALL_RESEARCH_TIMEOUT,
    "15-parallel-searches"
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

  const [overview, products, social, news, reviews, competitors, ecommerce, visual, pricing, paidAds, founders, international, instagramDeep, socialExtended, financials] = settled;

  const dimensionResults = {
    overview:       get(overview, "overview"),
    products:       get(products, "products"),
    social:         get(social, "social"),
    news:           get(news, "news"),
    reviews:        get(reviews, "reviews"),
    competitors:    get(competitors, "competitors"),
    ecommerce:      get(ecommerce, "ecommerce"),
    visual:         get(visual, "visual"),
    pricing:        get(pricing, "pricing"),
    paidAds:        get(paidAds, "paidAds"),
    founders:       get(founders, "founders"),
    international:  get(international, "international"),
    instagramDeep:  get(instagramDeep, "instagramDeep"),
    socialExtended: get(socialExtended, "socialExtended"),
    financials:     get(financials, "financials"),
  };

  // ── Phase 2: URL Deep-Dive ─────────────────────────────────────────────────
  // Take the top discovered URLs and have Gemini read them DIRECTLY
  // This is much more reliable than our manual HTML scraper
  const uniqueSources = [...new Set(allSources)];
  const urlsForDeepDive = uniqueSources
    .filter(u => !u.includes("instagram.com") && !u.includes("facebook.com") && !u.includes("twitter.com") && !u.includes("tiktok.com"))
    .slice(0, 15);

  let urlDeepDive = "";
  if (urlsForDeepDive.length > 0) {
    try {
      logger.info({ urlCount: urlsForDeepDive.length }, "Phase 2: Gemini URL context deep-dive (batch 1)");
      const batch1 = urlsForDeepDive.slice(0, 8);
      const batch2 = urlsForDeepDive.slice(8);

      const deepDivePromise1 = withRetry(() => withTimeout(
        askGeminiWithUrls(
          `You have found these URLs about "${entityName}". Read each one carefully and extract:
          - Product details, exact prices, availability, variants
          - About/team/mission/founding story
          - Contact information, physical locations, opening hours
          - Blog posts, content strategy, publication frequency
          - Unique facts, stats, testimonials, case studies
          - Technical details (Shopify apps, chat widgets, payment methods, shipping info)
          - Legal info (terms, privacy policy, business registration)
          Synthesize all findings. Be EXHAUSTIVE — every data point matters.`,
          batch1,
          "Web content extraction specialist. Read each URL thoroughly and extract EVERY piece of business intelligence."
        ),
        GEMINI_URL_CTX_TIMEOUT,
        "url-deep-dive-batch1"
      ), 1, 3000, "url-deep-dive-1");

      const deepDivePromise2 = batch2.length > 0
        ? withRetry(() => withTimeout(
            askGeminiWithUrls(
              `Read these additional URLs about "${entityName}" and extract ALL new information not covered in previous analysis. Focus on: secondary pages, blog content, FAQ, shipping details, return policy, press mentions, partner pages, career pages.`,
              batch2,
              "Secondary content analyst. Find details others miss."
            ),
            GEMINI_URL_CTX_TIMEOUT,
            "url-deep-dive-batch2"
          ), 1, 3000, "url-deep-dive-2")
        : Promise.resolve({ text: "", sources: [] as string[] });

      const [dd1, dd2] = await Promise.allSettled([deepDivePromise1, deepDivePromise2]);
      if (dd1.status === "fulfilled") { urlDeepDive += dd1.value.text; allSources.push(...dd1.value.sources); }
      if (dd2.status === "fulfilled" && dd2.value.text) { urlDeepDive += "\n\n--- ADDITIONAL URL FINDINGS ---\n" + dd2.value.text; allSources.push(...dd2.value.sources); }
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
    dimensions: 15,
  }, "✅ Deep entity research complete");

  return {
    ...dimensionResults,
    urlDeepDive,
    allSources: [...new Set(allSources)],
    allQueries:  [...new Set(allQueries)],
  };
}

/**
 * Multimodal JSON — analyzes N images together with a prompt and forces JSON.
 * Uses the "vision" tier (Gemini 2.5 Pro by default; fully configurable from
 * the admin UI). No artificial cap on number of images: we let Gemini handle
 * up to its context limit (~3000 images on 2.5 Pro), which is exactly what the
 * "Product DNA exhaustive" use case needs.
 */
export async function askGeminiVisionJson<T = unknown>(
  prompt: string,
  images: Array<{ buffer: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" }>,
  systemInstruction?: string,
  opts?: { tier?: "smart" | "genius" | "vision"; thinkingBudget?: number },
): Promise<T> {
  const ai = getGeminiClient();
  const model = pickModelSync("gemini", opts?.tier ?? "vision");

  const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = [];
  for (const img of images) {
    parts.push({ inlineData: { data: img.buffer.toString("base64"), mimeType: img.mime } });
  }
  parts.push({ text: prompt });

  // Adaptive timeout: 90s base + 8s per image, capped at 8 min.
  // 4 images → 122s, 30 images → 330s, 100 images → 480s (cap).
  const adaptiveTimeoutMs = Math.min(
    480_000,
    90_000 + images.length * 8_000,
  );

  // 1 retry for transient 429/5xx — vision is expensive, don't spam.
  const response = await withRetry(
    () => withTimeout(
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: parts as any }],
        config: {
          systemInstruction: systemInstruction ?? "You are a forensic product analyst. Always respond with valid JSON only, no markdown, no commentary.",
          responseMimeType: "application/json",
          maxOutputTokens: 65_536,
          ...(opts?.thinkingBudget ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
        },
      }),
      adaptiveTimeoutMs,
      `askGeminiVisionJson(${model}, ${images.length} imgs)`,
    ),
    1,
    4_000,
    `askGeminiVisionJson(${model})`,
  );

  const cand = response.candidates?.[0];
  if ((cand as any)?.finishReason === "MAX_TOKENS") {
    logger.warn({ model, images: images.length }, "[Gemini Vision JSON] ⚠️ RESPONSE TRUNCATED — hit maxOutputTokens");
  }

  try {
    const { recordApiUsage, calcGeminiCost } = await import("./api-usage.js");
    const usage = (response as any).usageMetadata ?? {};
    const inTok = Number(usage.promptTokenCount) || 0;
    const outTok = Number(usage.candidatesTokenCount) || 0;
    void recordApiUsage({
      provider: "gemini",
      operation: "askGeminiVisionJson",
      model,
      inputUnits: inTok,
      outputUnits: outTok,
      unitsLabel: "tokens",
      costUsd: calcGeminiCost(model, inTok, outTok),
    });
  } catch { /* never blocks */ }

  const text = response.text ?? "{}";
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    return JSON.parse(match ? match[1] : text.replace(/```[\s\S]*?```/g, "").trim()) as T;
  }
}

// ─── STREAMING para el chatbot admin ─────────────────────────────────────────
// Devuelve un async-generator que emite { text } chunks conforme llegan.
// El evento { done: true } incluye usageMetadata (tokens + coste estimado).
// Soporta Google Search grounding y thinkingBudget.

export interface GeminiStreamUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  costUsd: number;
  model: string;
}

export async function* askGeminiStream(
  messages: GeminiChatMessage[],
  systemInstruction?: string,
  opts: { useProModel?: boolean; thinkingBudget?: number; useSearch?: boolean } = {},
): AsyncGenerator<{ text?: string; done?: boolean; sources?: string[]; error?: string; usage?: GeminiStreamUsage }> {
  const { useProModel = false, thinkingBudget = 0, useSearch = false } = opts;

  const contents = messages
    .filter(m => m.content && (m.role === "user" || m.role === "assistant"))
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  if (contents.length === 0) { yield { done: true }; return; }

  const claudeStreamFallback = async function* (): AsyncGenerator<{ text?: string; done?: boolean }> {
    try {
      const { askClaudeWithBrain } = await import("./claude.js");
      const claudeMsgs = messages
        .filter(m => m.content)
        .map(m => ({ role: m.role, content: m.content }));
      const claudeText = await askClaudeWithBrain(0, claudeMsgs, systemInstruction ?? "Eres un asistente útil.", "general");
      if (claudeText && claudeText.trim()) {
        yield { text: claudeText };
      }
    } catch (fallbackErr) {
      logger.error({ err: String(fallbackErr) }, "[askGeminiStream] Claude fallback also failed");
    }
    yield { done: true };
  };

  if (isGeminiGenerationBlocked()) {
    logger.warn("[askGeminiStream] Circuit breaker open — falling back to Claude");
    yield* claudeStreamFallback();
    return;
  }

  const ai = getGeminiClient();
  const model = useProModel ? geminiPro() : geminiFast();

  const config: Record<string, unknown> = { maxOutputTokens: 65_536 };
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (thinkingBudget > 0) config.thinkingConfig = { thinkingBudget };
  if (useSearch) {
    config.tools = [{ googleSearch: { dynamicRetrievalConfig: { dynamicRetrievalThreshold: 0.0 } } }];
  }

  try {
    const stream = await ai.models.generateContentStream({ model, contents, config });
    const allSources: string[] = [];
    let lastUsageMeta: Record<string, unknown> | null = null;

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield { text };

      // Acumular usage metadata (el último chunk tiene los totales definitivos)
      const um = (chunk as any).usageMetadata as Record<string, unknown> | undefined;
      if (um) lastUsageMeta = um;

      // Extraer sources de grounding si hay
      const cand = (chunk as any).candidates?.[0];
      const gm = cand?.groundingMetadata as Record<string, unknown> | undefined;
      const groundChunks = gm?.groundingChunks as Array<{ web?: { uri?: string } }> | undefined;
      if (groundChunks) {
        for (const c of groundChunks) { if (c.web?.uri) allSources.push(c.web.uri); }
      }
    }

    // Construir y emitir usage en el evento done
    let usage: GeminiStreamUsage | undefined;
    if (lastUsageMeta) {
      const inTok  = Number(lastUsageMeta.promptTokenCount)     || 0;
      const outTok = Number(lastUsageMeta.candidatesTokenCount) || 0;
      const thinkTok = Number(lastUsageMeta.thoughtsTokenCount) || 0;
      const totalTok = Number(lastUsageMeta.totalTokenCount)    || (inTok + outTok + thinkTok);
      try {
        const { calcGeminiCost, recordApiUsage } = await import("./api-usage.js");
        const costUsd = calcGeminiCost(model, inTok, outTok);
        usage = { inputTokens: inTok, outputTokens: outTok, thinkingTokens: thinkTok, totalTokens: totalTok, costUsd, model };
        void recordApiUsage({
          provider: "gemini",
          operation: "chatbot-stream",
          model,
          inputUnits: inTok,
          outputUnits: outTok,
          unitsLabel: "tokens",
          costUsd,
        });
      } catch { /* never blocks the stream */ }
    }

    yield { done: true, sources: [...new Set(allSources)], ...(usage ? { usage } : {}) };
  } catch (err) {
    logger.error({ err: String(err) }, "[askGeminiStream] Error");
    if (isPermissionDenied(err)) {
      tripGenerationCircuit();
      logger.warn("[askGeminiStream] 403 detected — falling back to Claude");
      yield* claudeStreamFallback();
      return;
    }
    yield { error: String(err) };
    yield { done: true };
  }
}

// ─── GENERACIÓN DE IMÁGENES NATIVA GEMINI ─────────────────────────────────────
// Usa el modelo de imagen nativo de Gemini (gemini-2.5-flash-image o alias del catálogo).
// Devuelve { b64_json, mimeType } compatible con el resto de la plataforma.
export async function askGeminiGenerateImage(
  prompt: string,
  modelOverride?: string,
): Promise<{ b64_json: string; mimeType: string; model: string }> {
  const ai = getGeminiClient();
  // Cadena de fallback verificada 2026-06-25 via GET /v1beta/models.
  // Sólo modelos con responseModalities IMAGE (los de texto/chat fallarían).
  const candidates = modelOverride
    ? [modelOverride]
    : ["gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-3-pro-image"];

  for (const imageModel of candidates) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: imageModel,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { responseModalities: ["IMAGE", "TEXT"] } as any,
        }),
        60_000,
        `askGeminiGenerateImage(${imageModel})`
      );

      const candidate = response.candidates?.[0];
      for (const part of (candidate?.content?.parts ?? [])) {
        const p = part as any;
        if (p.inlineData?.data) {
          logger.info({ model: imageModel }, "[Gemini Image] Generated successfully");
          return { b64_json: p.inlineData.data, mimeType: p.inlineData.mimeType || "image/png", model: imageModel };
        }
      }
      // Si no hay imagen inline, intentar con el siguiente modelo
      logger.warn({ model: imageModel }, "[Gemini Image] No inline image in response — trying next model");
    } catch (err) {
      logger.warn({ model: imageModel, err: String(err) }, "[Gemini Image] Model failed — trying next");
    }
  }
  throw new Error("Gemini no pudo generar la imagen con ninguno de los modelos disponibles");
}

// ─── CODE EXECUTION TOOL ──────────────────────────────────────────────────────
// Activa la tool codeExecution de Gemini para ejecutar código Python real
// (análisis de datos, cálculos, gráficas). Devuelve texto, código y output.
export async function askGeminiWithCode(
  prompt: string,
  systemInstruction?: string,
): Promise<{ text: string; code: string; output: string }> {
  const ai = getGeminiClient();
  const model = geminiPro();

  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction ?? "Eres un analista de datos experto en Python. Usa code execution para resolver problemas, calcular métricas y analizar datos. Muestra siempre el código y los resultados. Responde en español.",
        tools: [{ codeExecution: {} }],
        maxOutputTokens: 65_536,
      } as any,
    }),
    GEMINI_CALL_TIMEOUT_MS,
    `askGeminiWithCode(${model})`
  );

  let text = "";
  let code = "";
  let output = "";

  const cand = response.candidates?.[0];
  for (const part of (cand?.content?.parts ?? [])) {
    const p = part as any;
    if (p.text) text += p.text;
    else if (p.executableCode?.code) code += p.executableCode.code;
    else if (p.codeExecutionResult?.output) output += p.codeExecutionResult.output;
  }

  logger.info({ model, codeLen: code.length, outputLen: output.length }, "[Gemini Code] Executed");
  return { text, code, output };
}

export { askGemini, askGeminiJson };
