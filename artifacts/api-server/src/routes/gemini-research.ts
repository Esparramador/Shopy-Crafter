import { Router, Request, Response } from "express";
import {
  isGeminiAvailable,
  researchBusiness,
  analyzeCompetitor,
  gatherMarketIntelligence,
  analyzeProductTrends,
  researchPersonOrBrand,
} from "../lib/gemini.js";
import { askClaude, askClaudeJson } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { omnicoreMemoriesTable, omnicoreNicheProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

const router = Router();

router.get("/status", (_req: Request, res: Response) => {
  res.json({
    available: isGeminiAvailable(),
    model: "gemini-2.5-flash / gemini-3.1-pro-preview",
    capabilities: ["business-research", "competitor-analysis", "market-intelligence", "product-trends", "person-brand-research"],
    pipeline: "Gemini (research) → Claude (analysis) → OmniCore (learning)",
  });
});

router.post("/research/business", async (req: Request, res: Response) => {
  try {
    const { businessName, domain, niche, market = "es" } = req.body as {
      businessName: string; domain: string; niche: string; market?: string;
    };
    if (!businessName || !domain || !niche) return res.status(400).json({ error: "businessName, domain and niche are required" });

    const profile = await researchBusiness(businessName, domain, niche, market);

    const claudeEnhancement = await askClaude(
      `You are OmniCore, an elite Shopify optimization AI. Based on this Gemini intelligence report about ${businessName}:

${JSON.stringify(profile, null, 2)}

Provide a strategic action plan (3-5 specific recommendations) for how a Shopify optimization agency could:
1. Identify their biggest conversion/revenue opportunities
2. Position against their weaknesses
3. The one most impactful optimization to apply first

Be specific and actionable. 2-3 sentences per recommendation.`,
      undefined, undefined, 1500
    );

    res.json({ profile, strategicPlan: claudeEnhancement, source: "gemini+claude" });
  } catch (err) {
    logger.error(err, "Gemini business research failed");
    res.status(500).json({ error: "Research failed. Check Gemini integration." });
  }
});

router.post("/research/competitor", async (req: Request, res: Response) => {
  try {
    const { domain, niche, market = "es" } = req.body as { domain: string; niche: string; market?: string };
    if (!domain || !niche) return res.status(400).json({ error: "domain and niche are required" });

    const intel = await analyzeCompetitor(domain, niche, market);

    const gaps = await askClaudeJson<{ quickWins: string[]; contentGaps: string[]; pricingOpportunity: string; seoGap: string }>(
      `Based on this competitor intelligence for ${domain}:
${JSON.stringify(intel, null, 2)}

Identify specific opportunities for a competing Shopify store to win:
Return JSON: { "quickWins": ["3 immediate actions"], "contentGaps": ["content they lack"], "pricingOpportunity": "string", "seoGap": "string" }`
    );

    res.json({ competitor: intel, gaps, source: "gemini+claude" });
  } catch (err) {
    logger.error(err, "Gemini competitor analysis failed");
    res.status(500).json({ error: "Competitor analysis failed." });
  }
});

router.post("/research/market", async (req: Request, res: Response) => {
  try {
    const { niche, market = "es", saveToOmnicore = true } = req.body as { niche: string; market?: string; saveToOmnicore?: boolean };
    if (!niche) return res.status(400).json({ error: "niche is required" });

    const intel = await gatherMarketIntelligence(niche, market);

    if (saveToOmnicore) {
      try {
        const existing = await db.select().from(omnicoreNicheProfilesTable).where(eq(omnicoreNicheProfilesTable.niche, niche)).limit(1);

        const profileData = {
          id: existing[0]?.id ?? uuid(),
          niche,
          avgPriceMin: intel.avgPriceRange.min,
          avgPriceMax: intel.avgPriceRange.max,
          avgPriceSweetSpot: intel.avgPriceRange.sweet,
          topKeywords: JSON.stringify(intel.topKeywords),
          seasonalPeaks: JSON.stringify(intel.seasonalPeaks),
          marketSaturation: intel.saturationLevel,
          knownCompetitors: JSON.stringify(intel.topPlayers),
          toneDescription: intel.buyerPersona,
          pricingPsychology: intel.purchaseDrivers.join("; "),
          updatedAt: new Date(),
        };

        if (existing.length > 0) {
          await db.update(omnicoreNicheProfilesTable).set(profileData).where(eq(omnicoreNicheProfilesTable.niche, niche));
        } else {
          await db.insert(omnicoreNicheProfilesTable).values(profileData);
        }

        await db.insert(omnicoreMemoriesTable).values({
          id: uuid(),
          memoryType: "niche_profile",
          niche,
          market,
          title: `Market Intelligence: ${niche} (${market})`,
          content: JSON.stringify(intel),
          confidence: 0.8,
          sourceType: "gemini_research",
          tags: JSON.stringify(["market", "niche", niche, market]),
          isVerified: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbErr) {
        logger.warn(dbErr, "Failed to save market intel to OmniCore");
      }
    }

    res.json({ market: intel, savedToOmnicore: saveToOmnicore, source: "gemini" });
  } catch (err) {
    logger.error(err, "Gemini market intelligence failed");
    res.status(500).json({ error: "Market intelligence gathering failed." });
  }
});

router.post("/research/product-trends", async (req: Request, res: Response) => {
  try {
    const { productType, market = "es", saveToOmnicore = true } = req.body as { productType: string; market?: string; saveToOmnicore?: boolean };
    if (!productType) return res.status(400).json({ error: "productType is required" });

    const trends = await analyzeProductTrends(productType, market);

    if (saveToOmnicore) {
      try {
        await db.insert(omnicoreMemoriesTable).values({
          id: uuid(),
          memoryType: "product_trend",
          niche: productType,
          market,
          title: `Product Trends: ${productType} (${market})`,
          content: JSON.stringify(trends),
          confidence: 0.75,
          sourceType: "gemini_research",
          tags: JSON.stringify(["product", "trends", productType, market]),
          isVerified: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbErr) {
        logger.warn(dbErr, "Failed to save product trends to OmniCore");
      }
    }

    res.json({ trends, savedToOmnicore: saveToOmnicore, source: "gemini" });
  } catch (err) {
    logger.error(err, "Gemini product trend analysis failed");
    res.status(500).json({ error: "Product trend analysis failed." });
  }
});

router.post("/research/person-brand", async (req: Request, res: Response) => {
  try {
    const { name, context, market = "es" } = req.body as { name: string; context: string; market?: string };
    if (!name) return res.status(400).json({ error: "name is required" });

    const profile = await researchPersonOrBrand(name, context ?? "", market);

    res.json({ profile, source: "gemini" });
  } catch (err) {
    logger.error(err, "Gemini person/brand research failed");
    res.status(500).json({ error: "Person/brand research failed." });
  }
});

router.post("/research/full-audit", async (req: Request, res: Response) => {
  try {
    const { businessName, domain, niche, market = "es" } = req.body as {
      businessName: string; domain: string; niche: string; market?: string;
    };
    if (!businessName || !domain || !niche) return res.status(400).json({ error: "businessName, domain and niche are required" });

    const [businessProfile, marketIntel] = await Promise.all([
      researchBusiness(businessName, domain, niche, market),
      gatherMarketIntelligence(niche, market),
    ]);

    const synthesis = await askClaude(
      `You are OmniCore, an elite Shopify eCommerce optimization AI. 
You have performed a full intelligence audit of ${businessName} (${domain}) in the ${niche} niche for the ${market} market.

BUSINESS PROFILE (from Gemini):
${JSON.stringify(businessProfile, null, 2)}

MARKET INTELLIGENCE (from Gemini):
${JSON.stringify(marketIntel, null, 2)}

Create an executive intelligence brief with:
1. SITUATIONAL ANALYSIS — where this business stands vs market
2. TOP 3 REVENUE OPPORTUNITIES — highest-impact optimizations (with estimated % improvement)
3. COMPETITIVE POSITIONING — how to differentiate from top competitors: ${marketIntel.topPlayers.slice(0, 3).join(", ")}
4. PRICING STRATEGY — specific price point recommendations based on market data
5. 90-DAY ACTION PLAN — prioritized by ROI

Be specific, bold, and actionable. Format clearly with headers.`,
      undefined, undefined, 2000
    );

    try {
      await db.insert(omnicoreMemoriesTable).values([
        {
          id: uuid(),
          memoryType: "business_audit",
          niche,
          market,
          title: `Full Audit: ${businessName} (${domain})`,
          content: JSON.stringify({ businessProfile, marketIntel }),
          confidence: 0.85,
          sourceType: "gemini_research",
          tags: JSON.stringify(["audit", "full", businessName, niche, domain]),
          isVerified: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    } catch (dbErr) {
      logger.warn(dbErr, "Failed to save full audit to OmniCore");
    }

    res.json({ businessProfile, marketIntel, synthesis, source: "gemini+claude+omnicore" });
  } catch (err) {
    logger.error(err, "Full Gemini audit failed");
    res.status(500).json({ error: "Full audit failed." });
  }
});

export default router;
