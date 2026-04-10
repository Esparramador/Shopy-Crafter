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
import { enableLongRunning } from "../lib/long-running.js";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { omnicoreMemoriesTable, omnicoreAbsorbedContentTable } from "@workspace/db/schema";
import { deepEntityResearch, askGeminiWithSearch, askGeminiJson } from "../lib/gemini.js";
import { learnFromOperation, askClaudeJsonWithBrain } from "../lib/claude.js";
import { runDualPageSpeed, formatPageSpeedForPrompt } from "../lib/pagespeed.js";
import { randomUUID } from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { saveToVault } from "../lib/vault.js";

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
// 25s timeout — Gemini's urlContext handles the heavy lifting; this is only for
// quick metadata extraction (title, og:description) when needed as fallback
async function safeFetch(url: string): Promise<{ text: string; title: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopyBrainBot/1.0; +https://shopybrain.ai)" },
      signal: AbortSignal.timeout(25_000),  // 25s — generous for slow servers
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
    content: params.content,
    confidence: params.confidence ?? 0.8,
    sourceType: params.sourceType ?? "entity_research",
    tags: params.tags ? JSON.stringify(params.tags) : null,
    isVerified: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

// ─── HELPER: Load ALL existing ShopyBrain knowledge about an entity ───────────
// This is Phase 0 — always run before any research to avoid redundant searches
export async function loadExistingEntityKnowledge(entityName: string): Promise<{
  memories: typeof omnicoreMemoriesTable.$inferSelect[];
  absorbed: typeof omnicoreAbsorbedContentTable.$inferSelect[];
  summary: string;
  knowledgeAge: string | null;
  hasKnowledge: boolean;
  dimensions: string[];
}> {
  const searchTerm = entityName.toLowerCase().split(/\s+/)[0]; // Use first word for broader match

  // Search all memories mentioning this entity
  const memories = await db.select()
    .from(omnicoreMemoriesTable)
    .where(sql`lower(${omnicoreMemoriesTable.title}) like ${'%' + searchTerm + '%'} 
              OR lower(${omnicoreMemoriesTable.content}) like ${'%' + searchTerm + '%'}`)
    .orderBy(desc(omnicoreMemoriesTable.updatedAt))
    .limit(20);

  // Search absorbed content records
  const absorbed = await db.select()
    .from(omnicoreAbsorbedContentTable)
    .where(sql`lower(${omnicoreAbsorbedContentTable.sourceLabel}) like ${'%' + searchTerm + '%'}
              OR lower(${omnicoreAbsorbedContentTable.sourceUrl}) like ${'%' + searchTerm + '%'}`)
    .orderBy(desc(omnicoreAbsorbedContentTable.createdAt))
    .limit(5);

  if (memories.length === 0 && absorbed.length === 0) {
    return { memories: [], absorbed: [], summary: "", knowledgeAge: null, hasKnowledge: false, dimensions: [] };
  }

  // Build dimensions known
  const dimensions = [...new Set(memories.map(m => m.memoryType).filter(Boolean))] as string[];

  // Calculate knowledge age
  const mostRecent = memories[0]?.updatedAt ?? absorbed[0]?.createdAt ?? null;
  const ageMs = mostRecent ? Date.now() - new Date(mostRecent).getTime() : null;
  const knowledgeAge = ageMs !== null
    ? ageMs < 3600000 ? "< 1 hora"
    : ageMs < 86400000 ? `${Math.round(ageMs / 3600000)}h`
    : `${Math.round(ageMs / 86400000)} días`
    : null;

  // Build a rich summary for Gemini context injection
  const memorySummary = memories
    .slice(0, 8)
    .map(m => `[${m.memoryType ?? "memoria"}] ${m.title}:\n${(m.content ?? "").slice(0, 2000)}`)
    .join("\n\n---\n\n");

  const absorbedSummary = absorbed
    .map(a => `[absorbido: ${a.sourceType}] ${a.sourceLabel ?? a.sourceUrl}\n${JSON.stringify(a.fullAnalysis ?? {}).slice(0, 2000)}`)
    .join("\n\n");

  const summary = `ShopyBrain tiene ${memories.length} memorias y ${absorbed.length} registros absorbidos sobre "${entityName}".
Conocimiento de: ${dimensions.join(", ") || "varios dominios"}.
Última actualización: ${knowledgeAge ?? "desconocida"}.

MEMORIAS EXISTENTES:
${memorySummary}

${absorbed.length > 0 ? `CONTENIDO ABSORBIDO:\n${absorbedSummary}` : ""}`;

  return { memories, absorbed, summary, knowledgeAge, hasKnowledge: true, dimensions };
}

// ─── HELPER: Enrich or update existing memory (avoid duplicates) ───────────────
async function upsertEntityMemory(params: {
  entityName: string; title: string; content: string; memoryType: string;
  niche?: string; sourceType?: string; confidence?: number; tags?: string[];
}): Promise<{ id: string; action: "created" | "updated" }> {
  // Check if we already have a memory of this type for this entity
  const existing = await db.select({ id: omnicoreMemoriesTable.id })
    .from(omnicoreMemoriesTable)
    .where(sql`lower(${omnicoreMemoriesTable.title}) like ${'%' + params.entityName.toLowerCase().slice(0, 20) + '%'}
              AND ${omnicoreMemoriesTable.memoryType} = ${params.memoryType}`)
    .orderBy(desc(omnicoreMemoriesTable.updatedAt))
    .limit(1);

  if (existing[0]) {
    // UPDATE the existing memory with enriched content
    await db.update(omnicoreMemoriesTable)
      .set({
        title: params.title.slice(0, 200),
        content: params.content,
        confidence: params.confidence ?? 0.85,
        updatedAt: new Date(),
        tags: params.tags ? JSON.stringify(params.tags) : null,
      })
      .where(eq(omnicoreMemoriesTable.id, existing[0].id));
    return { id: existing[0].id, action: "updated" };
  }

  // CREATE new memory
  const id = await saveMemory(params);
  return { id, action: "created" };
}

const asyncResearchJobs = new Map<string, { status: "running" | "completed" | "failed"; entity: any; result?: any; error?: string; startedAt: number; completedAt?: number }>();

setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [id, job] of asyncResearchJobs) {
    if (job.startedAt < cutoff) asyncResearchJobs.delete(id);
  }
}, 600_000);

// ─── POST /api/shopybrain/research-entity ─────────────────────────────────────
router.post("/shopybrain/research-entity", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      input,
      niche,
      market = "es",
      depth = "full"
    } = req.body as { input: string; niche?: string; market?: string; depth?: string };
  
    if (!input?.trim()) {
      res.status(400).json({ error: "input es requerido (URL, nombre, Instagram, etc.)" });
      return;
    }
  
    const researchId = randomUUID();
  
    logger.info({ input, niche, depth }, "🔬 ShopyBrain: Async entity research starting");
  
    try {
      const entity = await extractEntityName(input.trim());
      logger.info(entity, "Entity identified");
  
      asyncResearchJobs.set(researchId, { status: "running", entity, startedAt: Date.now() });
  
      res.json({ status: "started", researchId, entity, message: "Investigación paralela iniciada en background..." });
  
      setImmediate(async () => {
        try {
          const existingKnowledge = await loadExistingEntityKnowledge(entity.name || input);
          const research = await deepEntityResearch(entity.name || input, entity.url, existingKnowledge.hasKnowledge ? existingKnowledge.summary : undefined);
  
          await upsertEntityMemory({
            entityName: entity.name || input,
            title: `[DEEP RESEARCH] ${entity.name || input}`,
            content: `ENTITY: ${entity.name}\nURL: ${entity.url ?? "N/A"}\nHANDLES: ${JSON.stringify(entity.handles)}\nFUENTES: ${research.allSources.length}\n\nOVERVIEW:\n${research.overview?.slice(0, 3000)}\n\nSOCIAL:\n${research.social?.slice(0, 2000)}\n\nPRODUCTS:\n${research.products?.slice(0, 2000)}`,
            memoryType: "brand_intelligence",
            niche,
            sourceType: "deep_entity_research",
            confidence: 0.90,
            tags: ["deep_research", "brand_profile", (entity.name || input).toLowerCase(), niche ?? "general"],
          });
  
          asyncResearchJobs.set(researchId, {
            status: "completed",
            entity,
            result: { sourcesFound: research.allSources.length, queriesExecuted: research.allQueries.length },
            startedAt: asyncResearchJobs.get(researchId)!.startedAt,
            completedAt: Date.now(),
          });
          logger.info({ researchId }, "✅ Async entity research completed");
        } catch (err) {
          asyncResearchJobs.set(researchId, {
            status: "failed",
            entity,
            error: String(err),
            startedAt: asyncResearchJobs.get(researchId)!.startedAt,
            completedAt: Date.now(),
          });
          logger.error({ err, researchId }, "❌ Async entity research failed");
        }
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/shopybrain/research-status/:researchId ──────────────────────────
router.get("/shopybrain/research-status/:researchId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { researchId } = req.params;
    const job = asyncResearchJobs.get(researchId as string);
    if (!job) {
      res.status(404).json({ error: "Research job not found or expired" });
      return;
    }
    const elapsed = ((job.completedAt ?? Date.now()) - job.startedAt) / 1000;
    res.json({ researchId, ...job, elapsedSeconds: Math.round(elapsed) });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/shopybrain/research-entity-sync ────────────────────────────────
// Synchronous version — waits for all research, returns complete profile
router.post("/shopybrain/research-entity-sync", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      input,
      niche,
      market = "es",
      projectId: rawProjectId,
    } = req.body as { input: string; niche?: string; market?: string; projectId?: string | number };
  
    if (!input?.trim()) {
      res.status(400).json({ error: "input es requerido" });
      return;
    }
  
    enableLongRunning(res);
  
    const startTime = Date.now();
    const researchId = randomUUID();
  
    logger.info({ input, niche }, "🔬 ShopyBrain: Full exhaustive research starting");
  
    try {
      // PHASE 1: Identify entity
      const entity = await extractEntityName(input.trim());
      const entityDisplay = entity.name || input;
  
      // PHASE 0: Check what ShopyBrain ALREADY KNOWS about this entity
      // ─────────────────────────────────────────────────────────────────────────
      logger.info({ entityDisplay }, "Phase 0: Consulting existing ShopyBrain knowledge");
      const existingKnowledge = await loadExistingEntityKnowledge(entityDisplay);
  
      const allPossibleDimensions = [
        "brand_intelligence", "brand_overview", "products_catalog", "social_presence",
        "press_mentions", "customer_sentiment", "competitive_intel", "ecommerce_strategy",
        "visual_identity", "pricing_strategy", "paid_advertising", "founders_team",
        "international_presence", "web_content",
      ];
  
      if (existingKnowledge.hasKnowledge) {
        const coveredDimensions = existingKnowledge.dimensions;
        const missingDimensions = allPossibleDimensions.filter(d => !coveredDimensions.includes(d));
        const weakDimensions = existingKnowledge.memories
          .filter(m => (m.content ?? "").length < 300 || (m.confidence ?? 0) < 0.7)
          .map(m => m.memoryType)
          .filter(Boolean);
  
        logger.info({
          memoriesFound: existingKnowledge.memories.length,
          absorbedFound: existingKnowledge.absorbed.length,
          coveredDimensions,
          missingDimensions,
          weakDimensions,
          age: existingKnowledge.knowledgeAge,
        }, "✅ Existing knowledge found — enriching gaps + weak dimensions");
      } else {
        logger.info("📭 No existing knowledge — full virgin research");
      }
  
      logger.info("Phase 2: 12 parallel Google searches (context-aware, gap-hunting)");
      const research = await deepEntityResearch(
        entityDisplay,
        entity.url,
        existingKnowledge.hasKnowledge ? existingKnowledge.summary : undefined
      );
  
      // PHASE 3: Gemini already did deep URL reading via urlContext in deepEntityResearch
      // safeFetch is only used here as a lightweight fallback for any remaining important URLs
      // that Gemini might have missed (e.g. brand's main website for basic metadata)
      logger.info({
        sourcesFound: research.allSources.length,
        queriesExecuted: research.allQueries.length,
        dimensions: 12,
        urlDeepDiveChars: research.urlDeepDive?.length ?? 0,
      }, "Phase 3: Gemini URL deep-dive complete (via urlContext tool)");
  
      // Light fallback: fetch the brand's main URL for metadata only if not already in urlDeepDive
      let fallbackPageContent = "";
      if (entity.url && research.urlDeepDive.length < 500) {
        try {
          const mainPage = await safeFetch(entity.url);
          if (mainPage.text.length > 200) {
            fallbackPageContent = `MAIN WEBSITE [${entity.url}]:\nTitle: ${mainPage.title}\n${mainPage.text.slice(0, 2000)}`;
          }
        } catch { /* non-critical */ }
      }
  
      // PHASE 4: Claude synthesizes everything into ONE comprehensive intelligence profile
      // Now with 12 dimensions + Gemini's direct URL reads
      logger.info("Phase 4: Claude master synthesis (15 dimensions)");
      const synthPrompt = `You are ShopyBrain's master intelligence synthesizer. You have been given exhaustive multi-source research about this entity: "${entityDisplay}"
  
  RESEARCH DATA (from 15 parallel Google Search Grounding searches + Gemini URL deep-dive + ${research.allSources.length} discovered sources):
  
  === BRAND OVERVIEW & HISTORY ===
  ${research.overview.slice(0, 5000)}
  
  === PRODUCTS, CATALOG & PRICING ===
  ${research.products.slice(0, 5000)}
  
  === SOCIAL MEDIA & ONLINE PRESENCE ===
  ${research.social.slice(0, 4000)}
  
  === NEWS & PRESS (RECENT) ===
  ${research.news.slice(0, 3000)}
  
  === CUSTOMER REVIEWS & SENTIMENT ===
  ${research.reviews.slice(0, 3000)}
  
  === COMPETITORS & MARKET POSITIONING ===
  ${research.competitors.slice(0, 4000)}
  
  === ECOMMERCE STRATEGY & TECH STACK ===
  ${research.ecommerce.slice(0, 3000)}
  
  === VISUAL IDENTITY & BRAND DESIGN ===
  ${(research as any).visual?.slice(0, 2500) ?? ""}
  
  === PRICING STRATEGY & PSYCHOLOGY ===
  ${research.pricing?.slice(0, 3000) ?? ""}
  
  === PAID ADVERTISING & CAMPAIGNS ===
  ${research.paidAds?.slice(0, 3000) ?? ""}
  
  === FOUNDERS, TEAM & CULTURE ===
  ${research.founders?.slice(0, 2500) ?? ""}
  
  === INTERNATIONAL PRESENCE ===
  ${research.international?.slice(0, 2500) ?? ""}
  
  === INSTAGRAM DEEP-DIVE (Content Strategy & Aesthetics) ===
  ${(research as any).instagramDeep?.slice(0, 3000) ?? ""}
  
  === EXTENDED SOCIAL & COMMUNITY (TikTok, YouTube, Discord, Forums) ===
  ${(research as any).socialExtended?.slice(0, 3000) ?? ""}
  
  === FINANCIAL SIGNALS & UNIT ECONOMICS ===
  ${(research as any).financials?.slice(0, 3000) ?? ""}
  
  === GEMINI URL DEEP-DIVE (Direct reading of top discovered URLs) ===
  ${research.urlDeepDive?.slice(0, 6000) ?? ""}
  
  ${fallbackPageContent ? `=== MAIN WEBSITE FALLBACK ===\n${fallbackPageContent}` : ""}
  
  === ALL DISCOVERED SOURCES (${research.allSources.length} URLs) ===
  ${research.allSources.slice(0, 40).join("\n")}
  
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
    
    "financialSignals": {
      "estimatedRevenue": "string or Unknown",
      "estimatedAOV": "string or Unknown",
      "fundingTotal": "string or Unknown",
      "teamSize": "string or Unknown",
      "growthSignals": ["string"]
    },
    "instagramDeepMetrics": {
      "handle": "string or Unknown",
      "followers": "number or string",
      "avgLikes": "number or string",
      "avgComments": "number or string",
      "reelsVsCarouselRatio": "string",
      "postingCadence": "string",
      "topPerformingContentType": "string",
      "brandedHashtags": ["string"],
      "shoppingEnabled": "boolean or Unknown"
    },
    "communityPresence": {
      "tiktokFollowers": "string or Unknown",
      "youtubeSubscribers": "string or Unknown",
      "discordMembers": "string or Unknown",
      "redditMentions": "string or Unknown",
      "communityPrograms": ["string"]
    },
    
    "scores": {
      "brandStrength": "1-10 (based on recognition, sentiment, visual consistency)",
      "digitalPresence": "1-10 (based on social reach, SEO, content quality)",
      "competitivePosition": "1-10 (based on market share signals, differentiation)",
      "growthPotential": "1-10 (based on market trends, expansion signals, funding)",
      "ecommerceMaturity": "1-10 (based on tech stack, marketing sophistication)",
      "overall": "1-10 (weighted average)"
    },
    
    "confidenceLevel": "high|medium|low",
    "dataQuality": "rich|moderate|sparse",
    "sourcesAnalyzed": ${research.allSources.length},
    "researchQueries": ${research.allQueries.length}
  }
  
  Return ONLY valid JSON. Populate every field with real found data or "Unknown" if not found.`;
  
      const profile = await askGeminiJson<Record<string, unknown>>(synthPrompt, "Master intelligence synthesizer. Create comprehensive, factual brand profiles. Populate every field. Return only valid JSON.", true);
  
      // PHASE 5: Bonus Instagram deep-dive (only if handle found and not in urlDeepDive)
      // Other extra searches are now covered by the 12 parallel searches
      let extraInsights = "";
      if (entity.handles.instagram && research.urlDeepDive.length < 1000) {
        try {
          const igRes = await askGeminiWithSearch(
            `Deep analysis of Instagram @${entity.handles.instagram}: follower count, top performing posts, story strategy, bio link, Linktree/Beacons content, brand collaborations, sponsored posts, UGC campaigns, engagement rate vs industry average, posting cadence, reel performance.`,
            "Instagram intelligence specialist."
          );
          extraInsights = igRes.text;
          research.allSources.push(...igRes.sources);
        } catch { /* non-critical */ }
      }
  
      // PHASE 6: Save/ENRICH EVERYTHING to ShopyBrain (UPSERT — never duplicates)
      const memoryIds: string[] = [];
      const upsertActions: Array<"created" | "updated"> = [];
  
      const researchIteration = existingKnowledge.hasKnowledge
        ? `ITERACIÓN ACUMULATIVA #${existingKnowledge.memories.length + 1} — ${existingKnowledge.memories.length} memorias previas enriquecidas con ${research.allSources.length} fuentes nuevas`
        : "PRIMERA INVESTIGACIÓN — 15 dimensiones + URL deep-dive completo";
  
      const mainResult = await upsertEntityMemory({
        entityName: entityDisplay,
        title: `[DEEP RESEARCH] ${entityDisplay}`,
        content: `ENTITY: ${entityDisplay}\nURL: ${entity.url ?? "N/A"}\nHANDLES: ${JSON.stringify(entity.handles)}\n${researchIteration}\nFUENTES TOTALES: ${research.allSources.length}\nQUERIES: ${research.allQueries.length}\n\nPROFILE:\n${JSON.stringify(profile, null, 2)}\n\nEXTRA (Instagram):\n${extraInsights}`,
        memoryType: "brand_intelligence",
        niche,
        sourceType: "deep_entity_research",
        confidence: existingKnowledge.hasKnowledge ? 0.95 : 0.90,
        tags: ["deep_research", "brand_profile", entityDisplay.toLowerCase(), niche ?? "general", "12_dimensions", "url_deep_dive"],
      });
      memoryIds.push(mainResult.id);
      upsertActions.push(mainResult.action);
  
      // All 12 dimension memories — each upserted individually by dimension type
      const dimensions = [
        { key: "overview",      label: "brand_overview",      confidence: 0.88 },
        { key: "products",      label: "products_catalog",     confidence: 0.88 },
        { key: "social",        label: "social_presence",      confidence: 0.85 },
        { key: "news",          label: "press_mentions",       confidence: 0.82 },
        { key: "reviews",       label: "customer_sentiment",   confidence: 0.85 },
        { key: "competitors",   label: "competitive_intel",    confidence: 0.82 },
        { key: "ecommerce",     label: "ecommerce_strategy",   confidence: 0.85 },
        { key: "visual",        label: "visual_identity",      confidence: 0.80 },
        { key: "pricing",       label: "pricing_strategy",     confidence: 0.88 },
        { key: "paidAds",       label: "paid_advertising",     confidence: 0.80 },
        { key: "founders",      label: "founders_team",        confidence: 0.82 },
        { key: "international", label: "international_presence", confidence: 0.78 },
      ];
  
      for (const dim of dimensions) {
        const content = (research as Record<string, unknown>)[dim.key];
        if (typeof content === "string" && content.length > 50) {
          const result = await upsertEntityMemory({
            entityName: entityDisplay,
            title: `[${dim.label.toUpperCase()}] ${entityDisplay}`,
            content: `Entity: ${entityDisplay}\nDimension: ${dim.label}\nSources: ${research.allSources.length} | Queries: ${research.allQueries.length}\nIteration: ${researchIteration}\n\n${content}`,
            memoryType: dim.label,
            niche,
            sourceType: "google_search_grounding",
            confidence: existingKnowledge.hasKnowledge ? Math.min(dim.confidence + 0.05, 0.98) : dim.confidence,
            tags: [dim.label, entityDisplay.toLowerCase(), niche ?? "general"],
          });
          memoryIds.push(result.id);
          upsertActions.push(result.action);
        }
      }
  
      // URL deep-dive as its own memory if substantial
      if (research.urlDeepDive && research.urlDeepDive.length > 200) {
        const urlResult = await upsertEntityMemory({
          entityName: entityDisplay,
          title: `[URL_DEEP_DIVE] ${entityDisplay} — Direct Web Reading`,
          content: `Entity: ${entityDisplay}\nSource: Gemini urlContext (direct URL reading)\n\n${research.urlDeepDive}`,
          memoryType: "web_content",
          niche,
          sourceType: "gemini_url_context",
          confidence: 0.92,
          tags: ["url_context", "direct_reading", entityDisplay.toLowerCase(), "gemini"],
        });
        memoryIds.push(urlResult.id);
        upsertActions.push(urlResult.action);
      }
  
      // Save/update absorbed content record — upsert by sourceLabel
      const existingAbsorbed = existingKnowledge.absorbed.find(a => a.sourceLabel?.toLowerCase() === entityDisplay.toLowerCase());
      if (existingAbsorbed) {
        await db.update(omnicoreAbsorbedContentTable)
          .set({
            rawContent: `Research on: ${entityDisplay}\nSources: ${research.allSources.length}\nQueries: ${research.allQueries.length}\nPrevious research: enriched`,
            fullAnalysis: profile as Record<string, unknown>,
            confidence: 0.93,
            memoryIds: memoryIds.join(","),
            processingModel: "gemini-search-grounding+claude+enriched",
          })
          .where(eq(omnicoreAbsorbedContentTable.id, existingAbsorbed.id));
      } else {
        await db.insert(omnicoreAbsorbedContentTable).values({
          id: researchId,
          sourceType: "entity_research",
          sourceUrl: entity.url ?? null,
          sourceLabel: entityDisplay,
          rawContent: `Research on: ${entityDisplay}\n12 dimensions · ${research.allSources.length} sources · ${research.allQueries.length} queries · urlDeepDive: ${research.urlDeepDive?.length ?? 0} chars`,
          mainThemes: JSON.stringify([entityDisplay, ...(profile.differentiators as string[] ?? [])]),
          ecommerceInsights: JSON.stringify(profile.shopifyOpportunities ?? []),
          marketingAngles: JSON.stringify(profile.klaviyoOpportunities ?? []),
          competitiveData: JSON.stringify(profile.competitors ?? []),
          audienceSignals: JSON.stringify(profile.sentiment ?? {}),
          brandElements: JSON.stringify(profile.visualIdentity ?? {}),
          fullAnalysis: profile as Record<string, unknown>,
          niche: niche ?? null,
          confidence: 0.90,
          absorbedToMemory: 1,
          memoryIds: memoryIds.join(","),
          processingModel: "gemini-2.5-flash-search+urlContext+thinkingBudget+claude-pro",
          createdAt: new Date(),
        });
      }
  
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const memoriesCreated = upsertActions.filter(a => a === "created").length;
      const memoriesUpdated = upsertActions.filter(a => a === "updated").length;
  
      logger.info({
        entityDisplay,
        memoryCount: memoryIds.length,
        memoriesCreated,
        memoriesUpdated,
        reusingKnowledge: existingKnowledge.hasKnowledge,
        sourcesFound: research.allSources.length,
        elapsed,
      }, "✅ Entity research + memory enrichment complete");
  
      const fullResearchContent = JSON.stringify({
        entity: entityDisplay, entityUrl: entity.url, handles: entity.handles,
        profile, research: {
          overview: research.overview, products: research.products, social: research.social,
          news: research.news, reviews: research.reviews, competitors: research.competitors,
          ecommerce: research.ecommerce, pricing: research.pricing, paidAds: research.paidAds,
          founders: research.founders, international: research.international, urlDeepDive: research.urlDeepDive,
        },
        sourcesFound: research.allSources.length, queriesExecuted: research.allQueries.length,
        memoriesSaved: memoryIds.length, elapsed: `${elapsed}s`,
      }, null, 2);
      const vaultProjectId = rawProjectId ? parseInt(String(rawProjectId)) : 0;
      if (vaultProjectId > 0) saveToVault({
        projectId: vaultProjectId,
        fileType: "research",
        category: "entity_research",
        title: `Investigación: ${entityDisplay}`,
        description: `12 dimensiones, ${research.allSources.length} fuentes, ${memoryIds.length} memorias, ${elapsed}s`,
        mimeType: "application/json",
        fileSizeBytes: Buffer.from(fullResearchContent).length,
        generatedBy: "entity_research_engine",
        content: fullResearchContent,
        metadata: { entity: entityDisplay, url: entity.url, niche, researchId, elapsed },
      }).catch(() => {});
  
      learnFromOperation({
        operationType: "entity_research",
        niche: niche ?? undefined,
        title: `Deep research: ${entityDisplay} (${research.allSources.length} fuentes, ${memoryIds.length} memorias)`,
        content: `Entidad: ${entityDisplay}. URL: ${entity.url ?? "N/A"}. Handles: ${JSON.stringify(entity.handles)}. Dimensiones: overview, products, social, news, reviews, competitors, ecommerce, pricing, paidAds, founders, international, urlDeepDive. Fuentes: ${research.allSources.length}. Memorias: ${memoriesCreated} nuevas, ${memoriesUpdated} actualizadas. Nicho: ${niche ?? "general"}. Tiempo: ${elapsed}s.`,
        confidence: 0.90,
        tags: ["entity_research", "deep_research", entityDisplay.toLowerCase(), niche ?? "general"],
      });
  
      res.json({
        success: true,
        researchId,
        entity: entityDisplay,
        entityUrl: entity.url,
        handles: entity.handles,
        profile,
        // All 12 research dimensions + URL deep-dive
        research: {
          overview:      research.overview,
          products:      research.products,
          social:        research.social,
          news:          research.news,
          reviews:       research.reviews,
          competitors:   research.competitors,
          ecommerce:     research.ecommerce,
          pricing:       research.pricing ?? "",
          paidAds:       research.paidAds ?? "",
          founders:      research.founders ?? "",
          international: research.international ?? "",
          urlDeepDive:   research.urlDeepDive ?? "",
          extraInsights: extraInsights,
        },
        sourcesFound:    research.allSources.length,
        queriesExecuted: research.allQueries.length,
        memoriesSaved:   memoryIds.length,
        memoriesCreated,
        memoriesUpdated,
        dimensionsResearched: 12,
        urlDeepDiveChars: research.urlDeepDive?.length ?? 0,
        allSources:  research.allSources.slice(0, 60),
        allQueries:  research.allQueries,
        elapsed: `${elapsed}s`,
        pipeline: "gemini-2.5-flash (15×search+urlContext+thinking) → claude-sonnet-4-5 (pro synthesis)",
        knowledgeReuse: {
          hadPreviousKnowledge: existingKnowledge.hasKnowledge,
          previousMemories:     existingKnowledge.memories.length,
          previousDimensions:   existingKnowledge.dimensions,
          knowledgeAge:         existingKnowledge.knowledgeAge,
          action: existingKnowledge.hasKnowledge ? "enriched_cumulative" : "virgin_research",
        },
        message: existingKnowledge.hasKnowledge
          ? `✅ Conocimiento enriquecido: ${existingKnowledge.memories.length} memorias previas + ${research.allSources.length} fuentes nuevas · 12 dimensiones · URL deep-dive · ${memoriesUpdated} actualizadas, ${memoriesCreated} nuevas · ${elapsed}s`
          : `✅ Primera investigación: ${research.allSources.length} fuentes · 12 dimensiones · URL deep-dive Gemini · ${memoryIds.length} memorias permanentes en ShopyBrain · ${elapsed}s`,
      });
  
    } catch (err) {
      logger.error(err, "Entity research failed");
      res.status(500).json({ error: String(err), researchId });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/shopybrain/entity-knowledge/:name ───────────────────────────────
// Returns ALL accumulated knowledge about an entity — for UI display + AI context
router.get("/shopybrain/entity-knowledge/:name", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    try {
      const knowledge = await loadExistingEntityKnowledge(decodeURIComponent(String(name)));
  
      if (!knowledge.hasKnowledge) {
        res.json({
          found: false,
          entity: name,
          message: `ShopyBrain no tiene conocimiento previo sobre "${name}". Usa POST /research-entity-sync para investigar.`,
        });
        return;
      }
  
      res.json({
        found: true,
        entity: name,
        memoriesCount: knowledge.memories.length,
        absorbedCount: knowledge.absorbed.length,
        dimensions: knowledge.dimensions,
        knowledgeAge: knowledge.knowledgeAge,
        memories: knowledge.memories.map(m => ({
          id: m.id,
          type: m.memoryType,
          title: m.title,
          content: m.content ?? "",
          confidence: m.confidence,
          updatedAt: m.updatedAt,
        })),
        absorbed: knowledge.absorbed.map(a => ({
          id: a.id,
          sourceType: a.sourceType,
          sourceLabel: a.sourceLabel,
          sourceUrl: a.sourceUrl,
          confidence: a.confidence,
          profile: a.fullAnalysis,
          createdAt: a.createdAt,
        })),
        summary: knowledge.summary,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/shopybrain/research-entity/:name — legacy quick lookup ───────────
router.get("/shopybrain/research-entity/:name", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    try {
      const knowledge = await loadExistingEntityKnowledge(String(name));
      if (knowledge.hasKnowledge) {
        res.json({ found: true, cached: true, memoriesFound: knowledge.memories.length, knowledgeAge: knowledge.knowledgeAge });
      } else {
        res.json({ found: false, cached: false, message: `No research found for "${name}". Use POST to research.` });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/shopybrain/audit-entity — Full entity audit (research + PageSpeed + synthesis) ──
router.post("/shopybrain/audit-entity", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityInput, url } = req.body;
    if (!entityInput && !url) {
      res.status(400).json({ error: "entityInput o url requerido" });
      return;
    }
  
    enableLongRunning(res);
  
    const startTime = Date.now();
    const input = entityInput ?? url;
  
    try {
      logger.info({ input }, "🔍 Starting full entity audit");
  
      const entity = await extractEntityName(input);
      const entityDisplay = entity.name || input;
      const entityUrl = url || entity.url;
  
      const existingKnowledge = await loadExistingEntityKnowledge(entityDisplay);
  
      const [research, pageSpeed] = await Promise.all([
        deepEntityResearch(entityDisplay, entityUrl, existingKnowledge.summary).catch((err: any) => {
          logger.warn({ err: String(err) }, "Entity research failed in audit");
          return null;
        }),
        entityUrl
          ? runDualPageSpeed(entityUrl.startsWith("http") ? entityUrl : `https://${entityUrl}`).catch((err: any) => {
              logger.warn({ err: String(err) }, "PageSpeed failed in audit");
              return null;
            })
          : Promise.resolve(null),
      ]);
  
      const pageSpeedStr = pageSpeed ? formatPageSpeedForPrompt(pageSpeed) : "PageSpeed no disponible (sin URL de sitio web)";
  
      const researchSummary = research
        ? [
            research.overview.slice(0, 2000),
            research.products.slice(0, 1500),
            research.social.slice(0, 1000),
            research.competitors.slice(0, 1000),
            research.ecommerce.slice(0, 1000),
            (research as any).financials?.slice(0, 1000) ?? "",
            research.pricing.slice(0, 1000),
            (research as any).instagramDeep?.slice(0, 1000) ?? "",
          ].join("\n\n")
        : "Investigación no disponible";
  
      const auditResult = await askClaudeJsonWithBrain<{
        entityName: string;
        entityType: string;
        overallScore: number;
        scores: {
          brandStrength: number;
          digitalPresence: number;
          seoPerformance: number;
          ecommerceMaturity: number;
          contentQuality: number;
          competitivePosition: number;
          growthPotential: number;
        };
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
        recommendedServices: Array<{
          service: string;
          priority: "alta" | "media" | "baja";
          estimatedImpact: string;
          reason: string;
        }>;
        executiveSummary: string;
        actionPlan: Array<{ action: string; timeline: string; expectedResult: string }>;
      }>(
        0,
        `Realiza un AUDIT COMPLETO de esta entidad y genera un pre-informe profesional.
  
  ENTIDAD: ${entityDisplay}
  ${entityUrl ? `URL: ${entityUrl}` : ""}
  
  === INVESTIGACIÓN DE MERCADO (15 dimensiones Google Search) ===
  ${researchSummary}
  
  === RENDIMIENTO WEB (PageSpeed Insights) ===
  ${pageSpeedStr}
  
  === CONOCIMIENTO PREVIO EN SHOPYBRAIN ===
  ${existingKnowledge.summary?.slice(0, 2000) ?? "Sin conocimiento previo"}
  
  Genera un JSON con el audit completo:
  {
    "entityName": "nombre",
    "entityType": "brand|pyme|startup|ecommerce|influencer",
    "overallScore": 1-100,
    "scores": {
      "brandStrength": 1-100,
      "digitalPresence": 1-100,
      "seoPerformance": 1-100,
      "ecommerceMaturity": 1-100,
      "contentQuality": 1-100,
      "competitivePosition": 1-100,
      "growthPotential": 1-100
    },
    "strengths": ["fortaleza 1", "fortaleza 2"],
    "weaknesses": ["debilidad 1", "debilidad 2"],
    "opportunities": ["oportunidad 1"],
    "threats": ["amenaza 1"],
    "recommendedServices": [
      { "service": "Rediseño Web", "priority": "alta", "estimatedImpact": "Mejora conversión +30%", "reason": "..." }
    ],
    "executiveSummary": "Resumen ejecutivo en 3-4 frases",
    "actionPlan": [
      { "action": "Optimizar velocidad web", "timeline": "2 semanas", "expectedResult": "PageSpeed +20 puntos" }
    ]
  }`,
        "You are Shopy Crafter's senior audit consultant. Produce rigorous, data-backed audits with specific scores and actionable recommendations. Respond in Spanish. Return ONLY valid JSON.",
        "intelligence",
        undefined,
        8192,
        120_000
      );
  
      learnFromOperation({
        operationType: "entity_audit",
        title: `Audit completo de ${entityDisplay}: score ${auditResult.overallScore}/100`,
        content: `${auditResult.executiveSummary}. Servicios recomendados: ${auditResult.recommendedServices.map(s => s.service).join(", ")}`,
        niche: auditResult.entityType,
        confidence: 0.85,
        tags: ["audit", "entity", entityDisplay.toLowerCase()],
        monetaryValues: {},
        structuredData: { scores: auditResult.scores, strengths: auditResult.strengths.length, weaknesses: auditResult.weaknesses.length },
      });
  
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
      res.json({
        success: true,
        entityName: auditResult.entityName || entityDisplay,
        entityType: auditResult.entityType,
        overallScore: auditResult.overallScore,
        scores: auditResult.scores,
        swot: {
          strengths: auditResult.strengths,
          weaknesses: auditResult.weaknesses,
          opportunities: auditResult.opportunities,
          threats: auditResult.threats,
        },
        recommendedServices: auditResult.recommendedServices,
        executiveSummary: auditResult.executiveSummary,
        actionPlan: auditResult.actionPlan,
        pageSpeed: pageSpeed ? { mobile: pageSpeed.mobile, desktop: pageSpeed.desktop, summary: pageSpeed.summary } : null,
        sourcesAnalyzed: research?.allSources?.length ?? 0,
        elapsed: `${elapsed}s`,
        pipeline: "entity-research(15dim) + PageSpeed + Claude synthesis",
      });
    } catch (err) {
      logger.error({ err: String(err), input }, "Audit entity failed");
      res.status(500).json({ error: String(err) });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
