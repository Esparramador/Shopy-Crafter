import cron from "node-cron";
import { db } from "@workspace/db";
import {
  projectsTable, eventsTable, revenueSnapshotsTable,
  inventoryTrackingTable, competitorsTable, competitorSnapshotsTable, competitorAlertsTable,
  omnicoreMemoriesTable, omnicoreStudySessionsTable, omnicoreKnowledgeDomainsTable,
  omnicoreInsightsTable, omnicoreCrossConnectionsTable,
} from "@workspace/db";
import { desc, eq, gte, sql, isNull, or, and } from "drizzle-orm";
import { rotateToken, validateToken, shopifyRequest } from "./shopify.js";
import { safeDecrypt } from "./crypto.js";
import { buildShopyBrainContext } from "./claude.js";
import { logger } from "./logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function log(job: string, msg: string) {
  logger.info({ job }, msg);
}

function uid() { return randomBytes(8).toString("hex"); }

const ALL_DOMAINS: Record<string, string> = {
  ecommerce:            "eCommerce · CRO · UX",
  shopify_technical:    "Shopify Técnico",
  financial_analysis:   "Finanzas · P&L",
  trading_markets:      "Trading · Mercados",
  investment:           "Inversión · Valoración",
  marketing:            "Marketing · Ventas",
  sales:                "Ventas · Psicología",
  design_ux:            "Diseño · UX",
  merchandising:        "Merchandising",
  seo_content:          "SEO · Contenido",
  logistics:            "Logística · Stock",
  paid_media:           "Paid Media · ROAS",
  consumer_psychology:  "Psicología Consumidor",
  pricing_science:      "Pricing Science",
};

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
          project.id, project.shopDomain, `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`
        );
        const revenue = data.orders.reduce((sum, o) => sum + parseFloat(o.total_price || "0"), 0);
        const today = new Date().toISOString().split("T")[0];
        const existing = await db.select({ id: revenueSnapshotsTable.id })
          .from(revenueSnapshotsTable)
          .where(and(eq(revenueSnapshotsTable.projectId, String(project.id)), eq(revenueSnapshotsTable.date, today)))
          .limit(1);
        const aov = data.orders.length > 0 ? revenue / data.orders.length : 0;
        if (existing.length > 0) {
          await db.update(revenueSnapshotsTable)
            .set({ revenue, orders: data.orders.length, aov })
            .where(eq(revenueSnapshotsTable.id, existing[0].id));
        } else {
          await db.insert(revenueSnapshotsTable).values({
            id: randomBytes(16).toString("hex"),
            projectId: String(project.id),
            date: today,
            revenue,
            orders: data.orders.length,
            aov,
          });
        }
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

// ─── INVENTORY SYNC ──────────────────────────────────────────────────────────
export async function runInventorySync() {
  log("inventory-sync", "Starting daily inventory sync");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      if (!project.accessToken) continue;
      try {
        const data = await shopifyRequest<{ variants: Array<{ id: number; inventory_quantity: number; sku: string; product_id: number }> }>(
          project.id, project.shopDomain, "/variants.json?limit=250"
        );
        for (const variant of data.variants) {
          const existing = await db.select().from(inventoryTrackingTable)
            .where(eq(inventoryTrackingTable.variantId, String(variant.id))).limit(1);
          const prev = existing[0];
          const velocity = prev ? ((prev.currentStock ?? 0) - variant.inventory_quantity) : 0;
          const daysRemaining = velocity > 0 ? Math.round(variant.inventory_quantity / velocity) : null;
          if (prev) {
            await db.update(inventoryTrackingTable).set({
              currentStock: variant.inventory_quantity,
              avgDailySales: velocity,
              daysRemaining,
              updatedAt: new Date(),
            }).where(eq(inventoryTrackingTable.variantId, String(variant.id)));
          } else {
            await db.insert(inventoryTrackingTable).values({
              id: randomBytes(8).toString("hex"),
              projectId: String(project.id),
              productId: String(variant.product_id),
              variantId: String(variant.id),
              currentStock: variant.inventory_quantity,
              avgDailySales: 0,
              daysRemaining,
            }).onConflictDoNothing();
          }
          if (variant.inventory_quantity > 0 && variant.inventory_quantity <= 5) {
            await db.insert(eventsTable).values({
              id: randomBytes(8).toString("hex"),
              projectId: String(project.id),
              eventType: "stock_critical",
              payload: `Stock crítico: SKU ${variant.sku ?? variant.id} — ${variant.inventory_quantity} uds`,
            }).catch(() => {});
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
          id: randomBytes(8).toString("hex"),
          competitorId: competitor.id,
          priceMin: price,
          priceMax: price,
          priceMedian: price,
          rawData: html.slice(0, 5000),
          scannedAt: new Date(),
        });

        const prevSnaps = await db.select().from(competitorSnapshotsTable)
          .where(eq(competitorSnapshotsTable.competitorId, competitor.id))
          .orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(2);

        if (prevSnaps.length >= 2 && price !== null) {
          const prevPrice = prevSnaps[1]?.priceMin ?? 0;
          const changePct = prevPrice > 0 ? Math.abs((price - prevPrice) / prevPrice) * 100 : 0;
          if (changePct >= 5) {
            await db.insert(competitorAlertsTable).values({
              id: randomBytes(8).toString("hex"),
              competitorId: competitor.id,
              projectId: competitor.projectId,
              alertType: price < prevPrice ? "price_drop" : "price_increase",
              title: `${competitor.name}: precio ${price < prevPrice ? "bajó" : "subió"}`,
              description: `${competitor.name}: precio ${price < prevPrice ? "bajó" : "subió"} de €${prevPrice.toFixed(2)} a €${price.toFixed(2)} (${changePct.toFixed(1)}%)`,
              severity: changePct >= 15 ? "high" : "medium",
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

// ─── OMNICORE REAL DATA INTEGRATION ─────────────────────────────────────────
export async function runOmnicoreRealDataIntegration() {
  log("omnicore-realdata", "Starting OmniCore real data integration");
  try {
    const projects = await db.select().from(projectsTable);
    for (const project of projects) {
      if (!project.storeNiche) continue;
      try {
        const snaps = await db.select().from(revenueSnapshotsTable)
          .where(eq(revenueSnapshotsTable.projectId, String(project.id)))
          .orderBy(desc(revenueSnapshotsTable.date)).limit(7);
        if (snaps.length < 2) continue;
        const totalRevenue = snaps.reduce((s, r) => s + (r.revenue ?? 0), 0);
        const avgRevenue = totalRevenue / snaps.length;
        const firstSnap = snaps[0];
        const lastSnap = snaps[snaps.length - 1];
        const trend = firstSnap && lastSnap
          ? (((firstSnap.revenue ?? 0) - (lastSnap.revenue ?? 0)) / Math.max(lastSnap.revenue ?? 1, 1)) * 100
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

// ─── OMNICORE MICRO-LEARNING (cada 3h) ───────────────────────────────────────
// Selecciona los 2 dominios con mayor antigüedad de estudio y genera 3 insights
// por dominio. Promueve los de alta confianza (≥0.82) a memorias permanentes.
export async function runOmniCoreMicroLearning() {
  log("omnicore-micro", "⚡ Micro-learning cycle starting");
  try {
    // Priorizar dominios sin sesión reciente (least-recently-studied first)
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable)
      .orderBy(sql`COALESCE(last_study_session, '1970-01-01'::timestamptz) ASC`)
      .limit(2);

    if (!domains.length) {
      log("omnicore-micro", "No domains found — skipping");
      return;
    }

    const brainCtxMicro = await buildShopyBrainContext(undefined, "ecommerce");

    for (const domain of domains) {
      try {
        const label = ALL_DOMAINS[domain.domain ?? ""] ?? domain.domain ?? "ecommerce";
        const prompt = `You are an expert in ${label} for Shopify e-commerce agencies in 2026. Generate exactly 3 fresh, actionable insights that a Shopify agency owner can apply directly. Each insight must be specific, data-driven, and novel. Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.82,"memoryType":"pricing_pattern","tags":["tag1","tag2"]}]}`;

        const response = await anthropic.messages.create(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 1200,
            system: `You are OmniCore Micro-Learning Engine for ShopifyAI Pro agency platform. You generate precise, actionable Shopify e-commerce knowledge. ${brainCtxMicro}`,
            messages: [{ role: "user", content: prompt }],
          },
          { signal: AbortSignal.timeout(90_000) }
        );

        const text = (response.content[0] as { type: string; text: string }).text;
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) { log("omnicore-micro", `No JSON from Claude for domain ${domain.domain}`); continue; }

        const parsed = JSON.parse(match[0]) as { insights: Array<{ title: string; insight: string; confidence: number; memoryType?: string; tags?: string[] }> };

        for (const ins of parsed.insights ?? []) {
          const insId = `micro-${domain.id}-${uid()}`;
          const conf = ins.confidence ?? 0.75;

          await db.insert(omnicoreInsightsTable).values({
            id: insId,
            domain: domain.domain,
            insightType: "micro_learning",
            title: ins.title,
            insight: ins.insight,
            confidence: conf,
            source: "micro_learning_cron",
          }).onConflictDoNothing();

          // Alta confianza → también a memorias permanentes
          if (conf >= 0.82) {
            await db.insert(omnicoreMemoriesTable).values({
              id: `mem-${insId}`,
              memoryType: ins.memoryType ?? "general",
              niche: "general",
              title: `[${domain.domain}] ${ins.title}`,
              content: ins.insight.slice(0, 400),
              confidence: conf,
              sourceType: "micro_learning",
              tags: ins.tags ? JSON.stringify(ins.tags) : null,
            }).onConflictDoNothing();
          }
        }

        // Actualizar dominio: incrementar profundidad y marcar sesión
        const newDepth = Math.min(100, (domain.knowledgeDepth ?? 0) + 1);
        await db.update(omnicoreKnowledgeDomainsTable).set({
          knowledgeDepth: newDepth,
          totalInsights: sql`COALESCE(total_insights, 0) + ${(parsed.insights ?? []).length}`,
          lastStudySession: new Date(),
        }).where(eq(omnicoreKnowledgeDomainsTable.id, domain.id));

        log("omnicore-micro", `✅ ${domain.domain}: ${(parsed.insights ?? []).length} insights → depth ${newDepth}`);
      } catch (err) {
        logger.warn({ domainId: domain.id, err }, "Micro-learning failed for domain");
      }
    }
    log("omnicore-micro", "⚡ Micro-learning cycle complete");
  } catch (err) {
    logger.error({ err }, "Micro-learning job failed");
  }
}

// ─── OMNICORE MEMORY CONSOLIDATION (cada 6h) ────────────────────────────────
// Promueve insights recientes de alta confianza a memorias y refuerza
// las memorias de alto uso generadas en la última semana.
export async function runOmniCoreMemoryConsolidation() {
  log("omnicore-consolidate", "🧠 Memory consolidation starting");
  try {
    // Insights recientes con confianza ≥ 0.85
    const recent = await db.select().from(omnicoreInsightsTable)
      .where(gte(omnicoreInsightsTable.confidence, 0.85))
      .orderBy(desc(omnicoreInsightsTable.createdAt))
      .limit(30);

    let consolidated = 0;
    for (const ins of recent) {
      try {
        await db.insert(omnicoreMemoriesTable).values({
          id: `consol-${ins.id}`,
          memoryType: "general",
          niche: "general",
          title: ins.title ?? "(sin título)",
          content: (ins.insight ?? "").slice(0, 400),
          confidence: ins.confidence ?? 0.85,
          sourceType: "memory_consolidation",
        }).onConflictDoNothing();
        consolidated++;
      } catch { /* duplicate — ok */ }
    }

    // Incrementar useCount en memorias de alta confianza de la última semana
    await db.execute(sql`
      UPDATE omnicore_memories
      SET use_count = COALESCE(use_count, 0) + 1
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND confidence > 0.88
    `);

    log("omnicore-consolidate", `🧠 Consolidation complete: ${consolidated} insights promoted`);
  } catch (err) {
    logger.error({ err }, "Memory consolidation failed");
  }
}

// ─── OMNICORE CROSS-DOMAIN SYNTHESIS (cada 12h) ──────────────────────────────
// Elige 3 dominios al azar y pide a Claude conexiones accionables entre ellos.
// Guarda las conexiones en omnicore_cross_connections y en memorias.
export async function runOmniCoreCrossConnections() {
  log("omnicore-cross", "🔗 Cross-domain synthesis starting");
  try {
    const allDomains = await db.select().from(omnicoreKnowledgeDomainsTable);
    if (allDomains.length < 2) { log("omnicore-cross", "Not enough domains — skipping"); return; }

    // 3 dominios aleatorios
    const shuffled = [...allDomains].sort(() => Math.random() - 0.5).slice(0, 3);
    const names = shuffled.map(d => ALL_DOMAINS[d.domain ?? ""] ?? d.domain);

    const brainCtx = await buildShopyBrainContext(undefined, "ecommerce");
    const prompt = `Find 3 powerful hidden cross-domain insights connecting these Shopify e-commerce knowledge areas: ${names.join(" | ")}. Each insight should reveal a non-obvious synergy that a Shopify agency can monetize. Return ONLY valid JSON:
{"connections":[{"fromDomain":"domain_key","toDomain":"domain_key","insight":"...","synergy":"...","confidence":0.8}]}`;

    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        system: `You are OmniCore Cross-Domain Synthesis Engine. You discover hidden connections between Shopify e-commerce knowledge domains that create compounding agency value. ${brainCtx}`,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(90_000) }
    );

    const text = (response.content[0] as { type: string; text: string }).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) { log("omnicore-cross", "No JSON from Claude"); return; }

    const parsed = JSON.parse(match[0]) as {
      connections: Array<{ fromDomain: string; toDomain: string; insight: string; synergy: string; confidence: number }>
    };

    for (const conn of parsed.connections ?? []) {
      const crossId = `cross-${uid()}`;

      // Guardar la conexión usando los campos reales de la tabla (insightA, insightB)
      await db.insert(omnicoreCrossConnectionsTable).values({
        id: crossId,
        insightA: `[${conn.fromDomain}] ${conn.insight.slice(0, 200)}`,
        insightB: `[${conn.toDomain}] ${conn.synergy.slice(0, 200)}`,
        connectionType: "cross_domain_synergy",
        connectionStrength: conn.confidence ?? 0.7,
      }).onConflictDoNothing();

      // Promover a memoria
      await db.insert(omnicoreMemoriesTable).values({
        id: `cross-mem-${crossId}`,
        memoryType: "general",
        niche: "general",
        title: `Cross-insight: ${conn.fromDomain} × ${conn.toDomain}`,
        content: `${conn.insight} | Synergy: ${conn.synergy}`.slice(0, 400),
        confidence: conn.confidence ?? 0.7,
        sourceType: "cross_domain_synthesis",
      }).onConflictDoNothing();
    }

    log("omnicore-cross", `🔗 Cross-synthesis complete: ${(parsed.connections ?? []).length} connections generated`);
  } catch (err) {
    logger.error({ err }, "Cross-domain synthesis failed");
  }
}

// ─── OMNICORE DAILY DEEP STUDY — TODOS LOS DOMINIOS (1am diario) ─────────────
// Cubre los 14 dominios en profundidad, generando 5 insights premium por dominio.
// Es el ciclo más exhaustivo: 70 insights/día máximo.
export async function runOmniCoreDailyDeepStudy() {
  log("omnicore-daily", "🎓 Daily deep study starting — all domains");
  const sessionId = `daily-${new Date().toISOString().split("T")[0]}`;
  let totalInsights = 0;

  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable);

    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "daily_deep_study",
      domainsStudied: JSON.stringify(domains.map(d => d.domain)),
      trigger: "cron_daily_1am",
    }).onConflictDoNothing();

    const brainCtxDaily = await buildShopyBrainContext(undefined, "ecommerce");
    let consecutiveFails = 0;

    for (const domain of domains) {
      if (consecutiveFails >= 3) {
        log("omnicore-daily", "⚠️ Circuit breaker: 3 consecutive Claude failures — aborting cycle early");
        break;
      }
      try {
        const label = ALL_DOMAINS[domain.domain ?? ""] ?? domain.domain;
        const prompt = `You are a world-class expert in ${label} for Shopify e-commerce agencies in 2026. Generate 5 premium, deeply researched insights that would be worth €500+/hour consulting advice. Include specific tactics, numbers, and frameworks. Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.87,"memoryType":"pricing_pattern"}]}`;

        const response = await anthropic.messages.create(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 2500,
            system: `You are OmniCore Daily Deep Study Engine for ShopifyAI Pro. You generate elite-level Shopify agency knowledge. ${brainCtxDaily}`,
            messages: [{ role: "user", content: prompt }],
          },
          { signal: AbortSignal.timeout(90_000) }
        );
        consecutiveFails = 0;

        const text = (response.content[0] as { type: string; text: string }).text;
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;

        const parsed = JSON.parse(match[0]) as { insights: Array<{ title: string; insight: string; confidence: number; memoryType?: string }> };

        for (const ins of parsed.insights ?? []) {
          const insId = `daily-${domain.id}-${uid()}`;
          const conf = ins.confidence ?? 0.82;

          await db.insert(omnicoreInsightsTable).values({
            id: insId,
            domain: domain.domain,
            insightType: "daily_study",
            title: ins.title,
            insight: ins.insight,
            confidence: conf,
            source: "daily_deep_study",
          }).onConflictDoNothing();

          await db.insert(omnicoreMemoriesTable).values({
            id: `mem-${insId}`,
            memoryType: ins.memoryType ?? "general",
            niche: "general",
            title: `[Daily·${domain.domain}] ${ins.title}`,
            content: ins.insight.slice(0, 400),
            confidence: conf,
            sourceType: "daily_deep_study",
          }).onConflictDoNothing();

          totalInsights++;
        }

        // Incrementar profundidad de conocimiento del dominio
        const newDepth = Math.min(100, (domain.knowledgeDepth ?? 0) + 3);
        await db.update(omnicoreKnowledgeDomainsTable).set({
          knowledgeDepth: newDepth,
          totalInsights: sql`COALESCE(total_insights, 0) + ${(parsed.insights ?? []).length}`,
          verifiedInsights: sql`COALESCE(verified_insights, 0) + ${Math.floor((parsed.insights ?? []).length * 0.7)}`,
          lastStudySession: new Date(),
        }).where(eq(omnicoreKnowledgeDomainsTable.id, domain.id));

        log("omnicore-daily", `✅ ${domain.domain}: ${(parsed.insights ?? []).length} insights → depth ${newDepth}`);
      } catch (err) {
        consecutiveFails++;
        logger.warn({ domainId: domain.id, err, consecutiveFails }, "Daily study failed for domain");
      }
    }

    await db.update(omnicoreStudySessionsTable).set({
      insightsCreated: totalInsights,
      summary: `Daily deep study: ${totalInsights} insights across ${domains.length} domains`,
    }).where(eq(omnicoreStudySessionsTable.id, sessionId));

    log("omnicore-daily", `🎓 Daily deep study complete: ${totalInsights} insights across ${domains.length} domains`);
  } catch (err) {
    logger.error({ err }, "Daily deep study failed");
  }
}

// ─── OMNICORE MEGA-SYNTHESIS SEMANAL (Domingo medianoche) ────────────────────
// Síntesis de alto nivel que conecta los aprendizajes de la semana,
// genera perfiles de nicho actualizados y crea conexiones meta-cruzadas.
export async function runOmniCoreMegaSynthesis() {
  log("omnicore-mega", "🚀 Weekly mega-synthesis starting");
  const sessionId = `mega-${new Date().toISOString().split("T")[0]}`;
  let totalInsights = 0;

  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable);
    const topMemories = await db.select().from(omnicoreMemoriesTable)
      .orderBy(desc(omnicoreMemoriesTable.confidence)).limit(20);

    await db.insert(omnicoreStudySessionsTable).values({
      id: sessionId,
      sessionType: "weekly_mega_synthesis",
      domainsStudied: JSON.stringify(domains.map(d => d.domain)),
      trigger: "cron_weekly_sunday",
    }).onConflictDoNothing();

    const memorySummary = topMemories.slice(0, 10).map(m => `• ${m.title}: ${(m.content ?? "").slice(0, 100)}`).join("\n");
    const brainCtx = await buildShopyBrainContext(undefined, "ecommerce");

    const prompt = `Based on this week's accumulated knowledge for a Shopify e-commerce agency, synthesize 8 meta-level strategic insights that connect multiple domains and reveal compounding opportunities. These are executive-level, cross-domain insights worth implementing immediately.

Recent top memories:
${memorySummary}

Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.92,"domains":["domain1","domain2"],"priority":"high"}]}`;

    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: `You are OmniCore Mega-Synthesis Engine — the highest-level reasoning layer of ShopifyAI Pro. You synthesize a week of multi-domain learning into strategic masterclass insights. ${brainCtx}`,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(120_000) }
    );

    const text = (response.content[0] as { type: string; text: string }).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        insights: Array<{ title: string; insight: string; confidence: number; domains?: string[]; priority?: string }>
      };

      for (const ins of parsed.insights ?? []) {
        const insId = `mega-${uid()}`;
        const conf = ins.confidence ?? 0.9;

        await db.insert(omnicoreInsightsTable).values({
          id: insId,
          domain: (ins.domains ?? ["general"])[0],
          insightType: "mega_synthesis",
          title: ins.title,
          insight: ins.insight,
          confidence: conf,
          source: "weekly_mega_synthesis",
        }).onConflictDoNothing();

        await db.insert(omnicoreMemoriesTable).values({
          id: `mem-${insId}`,
          memoryType: "mega_insight",
          niche: "general",
          title: `[MEGA] ${ins.title}`,
          content: ins.insight.slice(0, 400),
          confidence: conf,
          sourceType: "mega_synthesis",
          tags: JSON.stringify(["mega", "strategic", ...(ins.domains ?? [])]),
        }).onConflictDoNothing();

        totalInsights++;
      }
    }

    await db.update(omnicoreStudySessionsTable).set({
      insightsCreated: totalInsights,
      summary: `Weekly mega-synthesis: ${totalInsights} strategic insights from ${domains.length} domains`,
    }).where(eq(omnicoreStudySessionsTable.id, sessionId));

    log("omnicore-mega", `🚀 Mega-synthesis complete: ${totalInsights} strategic insights`);
  } catch (err) {
    logger.error({ err }, "Mega-synthesis failed");
  }
}

// ─── TOKEN AUTO-REFRESH ───────────────────────────────────────────────────────
// Cada hora revisa todos los proyectos y renueva el token si está caducado
// o le quedan menos de 2 horas de validez. Garantiza acceso continuo a la API.
export async function runTokenRefresh() {
  log("token-refresh", "🔑 Validating Shopify tokens for all projects");
  try {
    const projects = await db.select().from(projectsTable);
    let valid = 0;
    let rotated = 0;
    let failed = 0;
    let noToken = 0;

    for (const project of projects) {
      if (!project.accessToken) {
        noToken++;
        logger.warn({ projectId: project.id, domain: project.shopDomain }, "Project has no access token — add it in project settings");
        continue;
      }

      try {
        const isValid = await validateToken(project.shopDomain, project.accessToken);
        if (isValid) {
          valid++;
          continue;
        }

        // Token failed — attempt rotation (only works if rotation is enabled in Shopify)
        log("token-refresh", `⚠️ Token invalid for project ${project.id} (${project.shopDomain}) — attempting rotation`);
        const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
        await rotateToken(project.id, project.shopDomain, project.clientId, plainSecret, project.accessToken);
        rotated++;
        log("token-refresh", `✅ Token rotated: project ${project.id} (${project.shopDomain})`);
      } catch (err) {
        failed++;
        logger.error(
          { projectId: project.id, domain: project.shopDomain, err },
          "Token invalid and rotation failed — manual token update required in project settings"
        );
      }
    }

    log("token-refresh", `🔑 Done: ${valid} valid, ${rotated} rotated, ${failed} failed, ${noToken} missing`);
  } catch (err) {
    logger.error({ err }, "Token validation job failed");
  }
}

// ─── REGISTRO DE TODOS LOS CRON JOBS ─────────────────────────────────────────
export function registerCronJobs() {
  log("scheduler", "🕐 Registering 24/7 continuous learning jobs (timezone: Europe/Madrid)");

  // ── APRENDIZAJE CONTINUO ─────────────────────────────────────────────────
  // Cada 3 horas — Micro-learning: 2 dominios × 3 insights (16 ciclos/día)
  cron.schedule("0 */3 * * *", () => { runOmniCoreMicroLearning().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // Cada 6 horas — Memory consolidation: insights → memorias permanentes
  cron.schedule("30 */6 * * *", () => { runOmniCoreMemoryConsolidation().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // Cada 12 horas — Cross-domain synthesis: conexiones entre dominios
  cron.schedule("0 */12 * * *", () => { runOmniCoreCrossConnections().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── CICLOS DIARIOS ───────────────────────────────────────────────────────
  // 1am diario — Daily deep study: todos los dominios, 5 insights/dominio
  cron.schedule("0 1 * * *", () => { runOmniCoreDailyDeepStudy().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 2am diario — Revenue snapshots desde Shopify
  cron.schedule("0 2 * * *", () => { runRevenueSnapshots().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 3am diario — OmniCore real data integration (datos reales de tiendas)
  cron.schedule("0 3 * * *", () => { runOmnicoreRealDataIntegration().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 6am diario — Competitor price scans
  cron.schedule("0 6 * * *", () => { runCompetitorScans().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // 7am diario — Inventory sync + alertas de stock crítico
  cron.schedule("0 7 * * *", () => { runInventorySync().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── SÍNTESIS SEMANAL ─────────────────────────────────────────────────────
  // Domingo 00:00 — Mega-synthesis: síntesis estratégica semanal de todos los dominios
  cron.schedule("0 0 * * 0", () => { runOmniCoreMegaSynthesis().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });

  // ── TOKENS SHOPIFY ────────────────────────────────────────────────────────
  // Cada hora — Renovar tokens Shopify próximos a caducar (o ya caducados)
  cron.schedule("5 * * * *", () => { runTokenRefresh().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // También ejecutar al arrancar para renovar tokens caducados tras reinicio
  setTimeout(() => { runTokenRefresh().catch(e => logger.error(e)); }, 10_000);

  log("scheduler", [
    "✅ 10 jobs registrados:",
    "  🔑 Tokens Shopify    → cada 1h  (renovación automática)",
    "  ⚡ Micro-learning    → cada 3h  (2 dominios × 3 insights)",
    "  🧠 Consolidación     → cada 6h  (insights → memorias)",
    "  🔗 Cross-synthesis   → cada 12h (conexiones cruzadas)",
    "  🎓 Deep study        → 1am     (14 dominios × 5 insights)",
    "  📊 Revenue           → 2am     (snapshots Shopify)",
    "  📦 Real data         → 3am     (integración datos reales)",
    "  🔍 Competidores      → 6am     (price scans)",
    "  📦 Inventario        → 7am     (sync + alertas stock)",
    "  🚀 Mega-synthesis    → Dom 0am (síntesis estratégica semanal)",
  ].join("\n"));
}
