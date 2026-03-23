import cron from "node-cron";
import { db } from "@workspace/db";
import {
  projectsTable, eventsTable, revenueSnapshotsTable,
  inventoryTrackingTable, competitorsTable, competitorSnapshotsTable, competitorAlertsTable,
  omnicoreMemoriesTable, omnicoreStudySessionsTable, omnicoreKnowledgeDomainsTable,
  omnicoreInsightsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { shopifyRequest } from "./shopify.js";
import { buildShopyBrainContext } from "./claude.js";
import { logger } from "./logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function log(job: string, msg: string) {
  logger.info({ job }, msg);
}

function uid() { return randomBytes(8).toString("hex"); }

// ─── REVENUE SNAPSHOTS ───────────────────────────────────────────────────────
export async function runRevenueSnapshots() {
  log("revenue-snapshots", "Starting daily revenue snapshots");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      if (!project.accessToken) continue;
      try {
        const now = new Date();
        const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const data = await shopifyRequest<{ orders: Array<{ total_price: string }> }>(
          project.id, `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`
        );
        const revenue = data.orders.reduce((sum, o) => sum + parseFloat(o.total_price || "0"), 0);
        await db.insert(revenueSnapshotsTable).values({
          projectId: project.id,
          date: new Date().toISOString().split("T")[0],
          revenue: String(revenue),
          orderCount: data.orders.length,
          source: "shopify_api",
        }).onConflictDoNothing();
        log("revenue-snapshots", `Project ${project.id}: €${revenue.toFixed(2)}, ${data.orders.length} orders`);
      } catch (err) {
        logger.warn({ projectId: project.id, err }, "Revenue snapshot failed for project");
      }
    }
    log("revenue-snapshots", "Complete");
  } catch (err) {
    logger.error({ err }, "Revenue snapshots job failed");
  }
}

// ─── INVENTORY SYNC ───────────────────────────────────────────────────────────
export async function runInventorySync() {
  log("inventory-sync", "Starting daily inventory sync");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      if (!project.accessToken) continue;
      try {
        const data = await shopifyRequest<{ variants: Array<{ id: number; inventory_quantity: number; sku: string; product_id: number }> }>(
          project.id, "/variants.json?limit=250"
        );
        for (const variant of data.variants) {
          const existing = await db.select().from(inventoryTrackingTable)
            .where(eq(inventoryTrackingTable.shopifyVariantId, String(variant.id))).limit(1);
          const prev = existing[0];
          const velocity = prev ? ((prev.currentStock ?? 0) - variant.inventory_quantity) : 0;
          const daysRemaining = velocity > 0 ? Math.round(variant.inventory_quantity / velocity) : null;
          if (prev) {
            await db.update(inventoryTrackingTable).set({
              currentStock: variant.inventory_quantity,
              salesVelocity: String(velocity),
              daysRemaining,
              updatedAt: new Date(),
            }).where(eq(inventoryTrackingTable.shopifyVariantId, String(variant.id)));
          } else {
            await db.insert(inventoryTrackingTable).values({
              projectId: project.id,
              shopifyProductId: String(variant.product_id),
              shopifyVariantId: String(variant.id),
              sku: variant.sku ?? null,
              currentStock: variant.inventory_quantity,
              salesVelocity: "0",
              daysRemaining,
            }).onConflictDoNothing();
          }
          if (variant.inventory_quantity > 0 && variant.inventory_quantity <= 5) {
            await db.insert(eventsTable).values({
              projectId: project.id,
              motor: "M7",
              eventType: "stock_critical",
              description: `Stock crítico: SKU ${variant.sku ?? variant.id} — ${variant.inventory_quantity} uds`,
              impact: "high",
            }).onConflictDoNothing().catch(() => {});
          }
        }
      } catch (err) {
        logger.warn({ projectId: project.id, err }, "Inventory sync failed for project");
      }
    }
    log("inventory-sync", "Complete");
  } catch (err) {
    logger.error({ err }, "Inventory sync job failed");
  }
}

// ─── COMPETITOR SCANS ────────────────────────────────────────────────────────
export async function runCompetitorScans() {
  log("competitor-scan", "Starting daily competitor scans");
  try {
    const competitors = await db.select().from(competitorsTable);
    for (const competitor of competitors) {
      try {
        const response = await fetch(competitor.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopifyAI-Monitor/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        const html = await response.text();
        const priceMatch = html.match(/["']price["']:\s*["']?([\d.,]+)["']?/i) ??
          html.match(/€\s*([\d.,]+)/) ?? html.match(/\$\s*([\d.,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null;

        await db.insert(competitorSnapshotsTable).values({
          competitorId: competitor.id,
          price: price ? String(price) : null,
          htmlSnapshot: html.slice(0, 5000),
          scannedAt: new Date(),
        });

        const prevSnaps = await db.select().from(competitorSnapshotsTable)
          .where(eq(competitorSnapshotsTable.competitorId, competitor.id))
          .orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(2);

        if (prevSnaps.length >= 2 && price !== null) {
          const prevPrice = parseFloat(prevSnaps[1]?.price ?? "0");
          const changePct = prevPrice > 0 ? Math.abs((price - prevPrice) / prevPrice) * 100 : 0;
          if (changePct >= 5) {
            await db.insert(competitorAlertsTable).values({
              competitorId: competitor.id,
              projectId: competitor.projectId,
              alertType: price < prevPrice ? "price_drop" : "price_increase",
              message: `${competitor.name}: precio ${price < prevPrice ? "bajó" : "subió"} de €${prevPrice.toFixed(2)} a €${price.toFixed(2)} (${changePct.toFixed(1)}%)`,
              severity: changePct >= 15 ? "high" : "medium",
              previousPrice: String(prevPrice),
              currentPrice: String(price),
            });
          }
        }
        log("competitor-scan", `Scanned ${competitor.name}: €${price}`);
      } catch (err) {
        logger.warn({ competitorId: competitor.id, err }, "Competitor scan failed");
      }
    }
    log("competitor-scan", "Complete");
  } catch (err) {
    logger.error({ err }, "Competitor scan job failed");
  }
}

// ─── OMNICORE REAL DATA INTEGRATION ──────────────────────────────────────────
export async function runOmnicoreRealDataIntegration() {
  log("omnicore-realdata", "Starting OmniCore real data integration");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      if (!project.storeNiche) continue;
      try {
        const snaps = await db.select().from(revenueSnapshotsTable)
          .where(eq(revenueSnapshotsTable.projectId, project.id))
          .orderBy(desc(revenueSnapshotsTable.date)).limit(7);
        if (snaps.length < 2) continue;
        const totalRevenue = snaps.reduce((s, r) => s + parseFloat(r.revenue ?? "0"), 0);
        const avgRevenue = totalRevenue / snaps.length;
        const firstSnap = snaps[0];
        const lastSnap = snaps[snaps.length - 1];
        const trend = firstSnap && lastSnap
          ? ((parseFloat(firstSnap.revenue ?? "0") - parseFloat(lastSnap.revenue ?? "0")) / Math.max(parseFloat(lastSnap.revenue ?? "1"), 1)) * 100
          : 0;
        const content = `Tienda ${project.name} (${project.storeNiche}): revenue medio €${avgRevenue.toFixed(0)}/día. Tendencia 7 días: ${trend > 0 ? "+" : ""}${trend.toFixed(1)}%. ${trend > 5 ? "Crecimiento positivo detectado." : trend < -5 ? "Caída detectada — revisar estrategia." : "Revenue estable."}`;

        await db.insert(omnicoreMemoriesTable).values({
          id: `realdata-${project.id}-${Date.now()}`,
          memoryType: "ab_insight",
          niche: project.storeNiche,
          title: `Revenue insight — ${project.storeNiche}`,
          content,
          confidence: 0.75,
          sourceType: "automated_cron",
        }).onConflictDoNothing();
      } catch (err) {
        logger.warn({ projectId: project.id, err }, "OmniCore real data integration failed for project");
      }
    }
    log("omnicore-realdata", "Complete");
  } catch (err) {
    logger.error({ err }, "OmniCore real data integration job failed");
  }
}

// ─── OMNICORE MARKET RESEARCH ─────────────────────────────────────────────────
export async function runOmnicoreMarketResearch() {
  log("omnicore-research", "Starting OmniCore market research session");
  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable).limit(3);
    for (const domain of domains) {
      try {
        const brainContext = await buildShopyBrainContext(undefined, "general");
        const prompt = `You are an expert in ${domain.domain ?? domain.id}. Generate 3 actionable insights for Shopify e-commerce stores. Return JSON: {"insights": [{"title": "...", "insight": "...", "confidence": 0.8}]}`;
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1500,
          system: `You are OmniCore market research engine. ${brainContext}`,
          messages: [{ role: "user", content: prompt }],
        });
        const text = (response.content[0] as { type: string; text: string }).text;
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;
        const { insights } = JSON.parse(match[0]) as { insights: Array<{ title: string; insight: string; confidence: number }> };
        for (const insight of insights) {
          await db.insert(omnicoreInsightsTable).values({
            id: `market-${domain.id}-${uid()}`,
            domain: domain.domain ?? domain.id,
            insightType: "market_research",
            title: insight.title,
            insight: insight.insight,
            confidence: insight.confidence ?? 0.75,
            source: "automated_cron",
          }).onConflictDoNothing();
        }
        log("omnicore-research", `Research for domain: ${domain.domain ?? domain.id}`);
      } catch (err) {
        logger.warn({ domainId: domain.id, err }, "Market research failed for domain");
      }
    }
    log("omnicore-research", "Complete");
  } catch (err) {
    logger.error({ err }, "OmniCore market research job failed");
  }
}

// ─── OMNICORE WEEKLY DEEP STUDY ───────────────────────────────────────────────
export async function runOmnicoreWeeklyDeepStudy() {
  log("omnicore-study", "Starting OmniCore weekly deep study session");
  const sessionId = `weekly-${new Date().toISOString().split("T")[0]}`;
  let totalInsights = 0;
  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable).limit(5);
    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "weekly_deep_study",
      domainsStudied: JSON.stringify(domains.map(d => d.domain ?? d.id)),
      trigger: "cron_weekly",
    }).onConflictDoNothing();

    for (const domain of domains) {
      try {
        const brainContext = await buildShopyBrainContext(undefined, "general");
        const prompt = `As an expert in ${domain.domain ?? domain.id} for Shopify e-commerce, generate 5 deep insights for agency use in 2026. Return JSON: {"insights": [{"title": "...", "insight": "...", "confidence": 0.85}]}`;
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 3000,
          system: `You are OmniCore deep study engine for ShopifyAI Pro. ${brainContext}`,
          messages: [{ role: "user", content: prompt }],
        });
        const text = (response.content[0] as { type: string; text: string }).text;
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;
        const { insights } = JSON.parse(match[0]) as { insights: Array<{ title: string; insight: string; confidence: number }> };
        for (const ins of insights) {
          const insId = `study-${domain.id}-${uid()}`;
          await db.insert(omnicoreInsightsTable).values({
            id: insId,
            domain: domain.domain ?? domain.id,
            insightType: "deep_study",
            title: ins.title,
            insight: ins.insight,
            confidence: ins.confidence ?? 0.8,
            source: "weekly_deep_study",
          }).onConflictDoNothing();
          await db.insert(omnicoreMemoriesTable).values({
            id: insId,
            memoryType: "ab_insight",
            niche: "general",
            title: `[${domain.domain ?? domain.id}] ${ins.title}`,
            content: ins.insight.slice(0, 400),
            confidence: ins.confidence ?? 0.8,
            sourceType: "weekly_deep_study",
          }).onConflictDoNothing();
          totalInsights++;
        }
        log("omnicore-study", `Deep study done for ${domain.domain ?? domain.id}: ${insights.length} insights`);
      } catch (err) {
        logger.warn({ domainId: domain.id, err }, "Deep study failed for domain");
      }
    }

    await db.update(omnicoreStudySessionsTable).set({
      insightsCreated: totalInsights,
      summary: `Weekly deep study generated ${totalInsights} insights across ${domains.length} domains`,
    }).where(eq(omnicoreStudySessionsTable.id, sessionId));

    log("omnicore-study", `Complete: ${totalInsights} insights generated`);
  } catch (err) {
    logger.error({ err }, "OmniCore weekly deep study job failed");
  }
}

// ─── REGISTER ALL CRON JOBS ──────────────────────────────────────────────────
export function registerCronJobs() {
  log("scheduler", "Registering all cron jobs (timezone: Europe/Madrid)");

  // Daily 2am — Revenue snapshots
  cron.schedule("0 2 * * *", () => { runRevenueSnapshots().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // Daily 3am — OmniCore real data integration
  cron.schedule("0 3 * * *", () => { runOmnicoreRealDataIntegration().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // Daily 4am — OmniCore market research
  cron.schedule("0 4 * * *", () => { runOmnicoreMarketResearch().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // Daily 6am — Competitor price scans
  cron.schedule("0 6 * * *", () => { runCompetitorScans().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // Daily 7am — Inventory sync + alerts
  cron.schedule("0 7 * * *", () => { runInventorySync().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // Weekly Sunday 2am — OmniCore deep study
  cron.schedule("0 2 * * 0", () => { runOmnicoreWeeklyDeepStudy().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  log("scheduler", "✅ All 6 cron jobs registered: revenue@2am, omnicore-data@3am, omnicore-research@4am, competitors@6am, inventory@7am, deep-study@Sun2am");
}
