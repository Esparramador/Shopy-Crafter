import { Router, Request, Response } from "express";
import {
  isGeminiAvailable,
  researchBusiness,
  analyzeCompetitor,
  gatherMarketIntelligence,
  analyzeProductTrends,
  researchPersonOrBrand,
} from "../lib/gemini.js";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
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

router.post("/research/business", async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessName, domain, niche, market = "es" } = req.body as {
      businessName: string; domain: string; niche: string; market?: string;
    };
    if (!businessName || !domain || !niche) { res.status(400).json({ error: "businessName, domain and niche are required" }); return; }

    const profile = await researchBusiness(businessName, domain, niche, market);

    const claudeEnhancement = await askClaudeWithBrain(
      0,
      [{ role: "user", content: `Based on this Gemini intelligence report about ${businessName}:\n\n${JSON.stringify(profile, null, 2)}\n\nProvide a strategic action plan (3-5 specific recommendations) for how a Shopify optimization agency could:\n1. Identify their biggest conversion/revenue opportunities\n2. Position against their weaknesses\n3. The one most impactful optimization to apply first\n\nBe specific and actionable. 2-3 sentences per recommendation.` }],
      undefined,
      "general",
      niche,
      4096
    );

    learnFromOperation({
      operationType: "business_research",
      title: `Business research: ${businessName} (${domain})`,
      content: `Business research in ${niche}. Strategic plan generated with ${typeof claudeEnhancement === "string" ? claudeEnhancement.length : 0} chars.`,
      niche,
    });

    res.json({ profile, strategicPlan: claudeEnhancement, source: "gemini+claude" });
  } catch (err) {
    logger.error(err, "Gemini business research failed");
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    res.status(isTimeout ? 504 : isQuota ? 429 : 500).json({
      error: isTimeout
        ? "La investigación tardó demasiado. Intenta de nuevo en unos segundos."
        : isQuota
        ? "Límite de uso de Gemini alcanzado. Espera unos minutos e intenta de nuevo."
        : "Error en la investigación de negocio. Verifica la conexión con Gemini.",
      retryable: isTimeout || isQuota,
    });
  }
});

router.post("/research/competitor", async (req: Request, res: Response): Promise<void> => {
  try {
    const { domain, niche, market = "es" } = req.body as { domain: string; niche: string; market?: string };
    if (!domain || !niche) { res.status(400).json({ error: "domain and niche are required" }); return; }

    const intel = await analyzeCompetitor(domain, niche, market);

    const gaps = await askClaudeJsonWithBrain<{ quickWins: string[]; contentGaps: string[]; pricingOpportunity: string; seoGap: string }>(
      0,
      `Based on this competitor intelligence for ${domain}:\n${JSON.stringify(intel, null, 2)}\n\nIdentify specific opportunities for a competing Shopify store to win:\nReturn JSON: { "quickWins": ["3 immediate actions"], "contentGaps": ["content they lack"], "pricingOpportunity": "string", "seoGap": "string" }`,
      "You are a competitive analysis expert for e-commerce stores.",
      "general",
      niche
    );

    learnFromOperation({
      operationType: "competitor_analysis",
      title: `Competitor analysis: ${domain}`,
      content: `Competitor analysis in ${niche}. Quick wins: ${(gaps as any)?.quickWins?.length ?? 0}, pricing opportunity: ${(gaps as any)?.pricingOpportunity ?? "none"}.`,
      niche,
    });

    res.json({ competitor: intel, gaps, source: "gemini+claude" });
  } catch (err) {
    logger.error(err, "Gemini competitor analysis failed");
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    res.status(isTimeout ? 504 : isQuota ? 429 : 500).json({
      error: isTimeout
        ? "El análisis de competencia tardó demasiado. Intenta de nuevo."
        : isQuota
        ? "Límite de uso de Gemini alcanzado. Espera unos minutos."
        : "Error en el análisis de competencia.",
      retryable: isTimeout || isQuota,
    });
  }
});

router.post("/research/market", async (req: Request, res: Response): Promise<void> => {
  try {
    const { niche, market = "es", saveToOmnicore = true } = req.body as { niche: string; market?: string; saveToOmnicore?: boolean };
    if (!niche) { res.status(400).json({ error: "niche is required" }); return; }

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
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    res.status(isTimeout ? 504 : isQuota ? 429 : 500).json({
      error: isTimeout
        ? "La inteligencia de mercado tardó demasiado. Intenta de nuevo."
        : isQuota
        ? "Límite de uso de Gemini alcanzado. Espera unos minutos."
        : "Error en la inteligencia de mercado.",
      retryable: isTimeout || isQuota,
    });
  }
});

router.post("/research/product-trends", async (req: Request, res: Response): Promise<void> => {
  try {
    const { productType, market = "es", saveToOmnicore = true } = req.body as { productType: string; market?: string; saveToOmnicore?: boolean };
    if (!productType) { res.status(400).json({ error: "productType is required" }); return; }

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
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    res.status(isTimeout ? 504 : isQuota ? 429 : 500).json({
      error: isTimeout
        ? "El análisis de tendencias tardó demasiado. Intenta de nuevo."
        : isQuota
        ? "Límite de uso de Gemini alcanzado. Espera unos minutos."
        : "Error en el análisis de tendencias.",
      retryable: isTimeout || isQuota,
    });
  }
});

router.post("/research/person-brand", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, context, market = "es" } = req.body as { name: string; context: string; market?: string };
    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    const profile = await researchPersonOrBrand(name, context ?? "", market);

    res.json({ profile, source: "gemini" });
  } catch (err) {
    logger.error(err, "Gemini person/brand research failed");
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    res.status(isTimeout ? 504 : isQuota ? 429 : 500).json({
      error: isTimeout
        ? "La investigación tardó demasiado. Intenta de nuevo."
        : isQuota
        ? "Límite de uso de Gemini alcanzado. Espera unos minutos."
        : "Error en la investigación de persona/marca.",
      retryable: isTimeout || isQuota,
    });
  }
});

router.post("/research/full-audit", async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessName, domain, niche, market = "es" } = req.body as {
      businessName: string; domain: string; niche: string; market?: string;
    };
    if (!businessName || !domain || !niche) { res.status(400).json({ error: "businessName, domain and niche are required" }); return; }

    const [businessProfile, marketIntel] = await Promise.all([
      researchBusiness(businessName, domain, niche, market),
      gatherMarketIntelligence(niche, market),
    ]);

    const synthesis = await askClaudeWithBrain(
      0,
      [{
        role: "user",
        content: `Full intelligence audit of ${businessName} (${domain}) in the ${niche} niche for the ${market} market.\n\nBUSINESS PROFILE (from Gemini):\n${JSON.stringify(businessProfile, null, 2)}\n\nMARKET INTELLIGENCE (from Gemini):\n${JSON.stringify(marketIntel, null, 2)}\n\nCreate an executive intelligence brief with:\n1. SITUATIONAL ANALYSIS — where this business stands vs market\n2. TOP 3 REVENUE OPPORTUNITIES — highest-impact optimizations (with estimated % improvement)\n3. COMPETITIVE POSITIONING — how to differentiate from top competitors: ${marketIntel.topPlayers.slice(0, 3).join(", ")}\n4. PRICING STRATEGY — specific price point recommendations based on market data\n5. 90-DAY ACTION PLAN — prioritized by ROI\n\nBe specific, bold, and actionable. Format clearly with headers.`,
      }],
      undefined,
      "general",
      niche,
      8192
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

    learnFromOperation({
      operationType: "full_gemini_audit",
      title: `Auditoría completa: ${businessName} (${domain}) en ${niche}`,
      content: synthesis,
      confidence: 0.85,
      tags: ["gemini_research", "business_audit", niche, domain],
    });

    res.json({ businessProfile, marketIntel, synthesis, source: "gemini+claude+omnicore" });
  } catch (err) {
    logger.error(err, "Full Gemini audit failed");
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    res.status(isTimeout ? 504 : isQuota ? 429 : 500).json({
      error: isTimeout
        ? "La auditoría completa tardó demasiado. Intenta de nuevo en unos segundos."
        : isQuota
        ? "Límite de uso de Gemini alcanzado. Espera unos minutos e intenta de nuevo."
        : "Error en la auditoría completa.",
      retryable: isTimeout || isQuota,
    });
  }
});

export default router;
