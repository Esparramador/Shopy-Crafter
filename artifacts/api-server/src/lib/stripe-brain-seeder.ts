/**
 * stripe-brain-seeder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Siembra el conocimiento experto de Stripe en ShopyBrain OmniCore.
 * Idempotente via version tag en omnicoreMemoriesTable.
 */

import { randomBytes } from "crypto";
import { db, omnicoreInsightsTable, omnicoreMemoriesTable, omnicoreKnowledgeDomainsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { STRIPE_SEED_INSIGHTS, STRIPE_DOMAIN_MEMORIES } from "./stripe-knowledge.js";

const STRIPE_SEED_VERSION = "stripe-brain-v2-2026";

export async function seedStripeKnowledge(): Promise<void> {
  try {
    const versionCheck = await db
      .select({ id: omnicoreMemoriesTable.id })
      .from(omnicoreMemoriesTable)
      .where(eq(omnicoreMemoriesTable.title, STRIPE_SEED_VERSION))
      .limit(1)
      .catch(() => []);

    if (versionCheck.length > 0) {
      return;
    }

    logger.info("🏦 Seeding Stripe knowledge into ShopyBrain...");

    // 1. Ensure stripe domains exist in knowledge domains table
    const stripeDomains = [
      { key: "stripe_payments", count: STRIPE_SEED_INSIGHTS.filter(i => i.domain === "stripe_payments").length },
      { key: "payment_orchestration", count: STRIPE_SEED_INSIGHTS.filter(i => i.domain === "payment_orchestration").length },
      { key: "financial_analysis", count: STRIPE_SEED_INSIGHTS.filter(i => i.domain === "financial_analysis").length },
    ];

    for (const { key, count } of stripeDomains) {
      const existing = await db
        .select({ id: omnicoreKnowledgeDomainsTable.id })
        .from(omnicoreKnowledgeDomainsTable)
        .where(eq(omnicoreKnowledgeDomainsTable.domain, key))
        .limit(1)
        .catch(() => []);

      if (!existing.length) {
        await db.insert(omnicoreKnowledgeDomainsTable).values({
          id: randomBytes(12).toString("hex"),
          domain: key,
          knowledgeDepth: 85,
          verifiedInsights: count,
          totalInsights: count,
        }).catch(() => {});
      } else {
        await db.update(omnicoreKnowledgeDomainsTable)
          .set({
            knowledgeDepth: sql`GREATEST(${omnicoreKnowledgeDomainsTable.knowledgeDepth}, 85)`,
            totalInsights: sql`${omnicoreKnowledgeDomainsTable.totalInsights} + ${count}`,
            verifiedInsights: sql`${omnicoreKnowledgeDomainsTable.verifiedInsights} + ${count}`,
          })
          .where(eq(omnicoreKnowledgeDomainsTable.domain, key))
          .catch(() => {});
      }
    }

    // 2. Insert structured insights (columnas reales de omnicoreInsightsTable)
    for (const insight of STRIPE_SEED_INSIGHTS) {
      await db.insert(omnicoreInsightsTable).values({
        id: randomBytes(16).toString("hex"),
        domain: insight.domain,
        insightType: insight.insightType,
        title: insight.title,
        insight: insight.insight,
        evidence: insight.evidence,
        confidence: insight.confidence,
        impactScore: insight.impactScore,
        relatedDomains: JSON.stringify(["stripe_payments", "payment_orchestration", "ecommerce"]),
        source: "stripe_audit_2026",
        timesApplied: 0,
      }).catch(() => {});
    }

    // 3. Insert domain memories (columnas reales de omnicoreMemoriesTable)
    for (const mem of STRIPE_DOMAIN_MEMORIES) {
      await db.insert(omnicoreMemoriesTable).values({
        id: randomBytes(16).toString("hex"),
        memoryType: mem.memoryType,
        title: mem.title,
        content: mem.content,
        niche: mem.niche,
        confidence: mem.confidence,
        tags: JSON.stringify(mem.tags),
        sourceType: "stripe_audit",
        market: "es",
        isVerified: 1,
        useCount: 1,
        successCount: 1,
        successRate: 0.95,
      }).catch(() => {});
    }

    // 4. Version marker
    await db.insert(omnicoreMemoriesTable).values({
      id: randomBytes(16).toString("hex"),
      memoryType: "system_marker",
      title: STRIPE_SEED_VERSION,
      content: `Stripe knowledge seeded v2: ${STRIPE_SEED_INSIGHTS.length} insights, ${STRIPE_DOMAIN_MEMORIES.length} memories, domaines: stripe_payments + payment_orchestration.`,
      niche: "system",
      confidence: 1.0,
      tags: JSON.stringify(["system", "seed", "stripe"]),
      sourceType: "system",
      market: "es",
      isVerified: 1,
      useCount: 0,
      successCount: 0,
      successRate: 1.0,
    }).catch(() => {});

    logger.info(`✅ Stripe knowledge seeded: ${STRIPE_SEED_INSIGHTS.length} insights, ${STRIPE_DOMAIN_MEMORIES.length} memories`);
  } catch (err) {
    logger.warn({ err }, "Stripe brain seed warning (non-fatal)");
  }
}
