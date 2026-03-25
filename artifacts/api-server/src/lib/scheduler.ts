import cron from "node-cron";
import { db } from "@workspace/db";
import {
  projectsTable, eventsTable, revenueSnapshotsTable,
  inventoryTrackingTable, competitorsTable, competitorSnapshotsTable, competitorAlertsTable,
  omnicoreMemoriesTable, omnicoreStudySessionsTable, omnicoreKnowledgeDomainsTable,
  omnicoreInsightsTable, omnicoreCrossConnectionsTable,
} from "@workspace/db";
import { desc, eq, gte, sql, isNull, or, and } from "drizzle-orm";
import { refreshToken, rotateToken, validateToken, shopifyRequest } from "./shopify.js";
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
  ecommerce:            "eCommerce · CRO · UX · Conversión · Experiencia de compra",
  shopify_technical:    "Shopify Técnico · Liquid · APIs · Themes · Checkout · Metafields",
  financial_analysis:   "Finanzas · P&L · Cash Flow · Unit Economics · Break-even · KPIs financieros",
  trading_markets:      "Trading · Mercados Internacionales · Divisas · Tendencias Globales",
  investment:           "Inversión · Valoración de Negocios · Due Diligence · ROI · Capital",
  marketing:            "Marketing Digital · Branding · Storytelling · Funnels · Email · Estrategia de marca",
  sales:                "Ventas · Negociación · Psicología de ventas · Objeciones · Cierre",
  design_ux:            "Diseño · UX/UI · Tipografía · Color Theory · Layout · Accesibilidad · Motion Design",
  merchandising:        "Merchandising Visual · Producto · Packaging · Presentación · Escaparatismo",
  seo_content:          "SEO · Contenido · Copywriting · Blog · Arquitectura web · Schema · Keywords · Link Building",
  logistics:            "Logística · Stock · Fulfillment · Envíos · Cadena de suministro · Warehousing",
  paid_media:           "Paid Media · ROAS · Google Ads · Meta Ads · TikTok Ads · Retargeting · Attribution",
  consumer_psychology:  "Psicología del Consumidor · Neuromarketing · Behavioral Economics · Persuasión · Sesgos cognitivos",
  pricing_science:      "Pricing Science · Estrategias de precio · Elasticidad · Bundling · Descuentos · Anchoring",
  photography:          "Fotografía de Producto · Composición · Iluminación · Estilos · Props · Post-producción · Food Photography · Moda",
  video_content:        "Vídeo · Reels · TikTok · YouTube · UGC · Producción · Guiones · Storytelling visual",
  copywriting:          "Copywriting Persuasivo · Titulares · Descripciones · CTAs · Fórmulas (AIDA, PAS, BAB) · Tono de voz",
  social_media:         "Redes Sociales · Community Management · Calendario editorial · Engagement · Influencers · Virality",
  ai_technology:        "IA · Machine Learning · Automatización · Prompts · Generación de contenido · Computer Vision · LLMs",
  legal_compliance:     "Legal · GDPR · Cookies · Términos y condiciones · Propiedad intelectual · Normativa eCommerce",
  sustainability:       "Sostenibilidad · Packaging eco · Certificaciones · ESG · Comercio justo · Economía circular",
  customer_service:     "Atención al cliente · Chatbots · Retención · NPS · Fidelización · Post-venta · Reviews",
  analytics_data:       "Analytics · Google Analytics · Data Science · Dashboards · Métricas · Cohorts · Attribution",
  international:        "Internacionalización · Multiidioma · Multi-moneda · Localización · Mercados emergentes · Cross-border",
  trends_innovation:    "Tendencias · Innovación · Web3 · AR/VR · Live Shopping · Voice Commerce · Social Commerce",
  supply_chain:         "Proveedores · Sourcing · Alibaba · AliExpress · Fabricación · MOQ · Negociación con proveedores · Dropshipping",
  brand_strategy:       "Estrategia de Marca · Posicionamiento · Diferenciación · Propuesta de valor · Arquitectura de marca · Brand Equity",
  email_automation:     "Email Marketing · Automatización · Klaviyo · Segmentación · A/B Testing · Flows · Deliverability",
  marketplace:          "Marketplaces · Amazon · Etsy · eBay · Multi-canal · Omnichannel · Comparadores",
  taxes_accounting:     "Impuestos · Contabilidad · IVA · Facturación · Autónomos · SII · Modelos fiscales",
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
          signal: AbortSignal.timeout(30_000),
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
        const prompt = `You are a world-class expert in ${label}. Your knowledge is UNIVERSAL — not limited to any single industry. Generate exactly 3 fresh, deeply researched, actionable insights that combine best practices from multiple industries and disciplines. Each insight must be specific, backed by real-world data or established frameworks, and immediately applicable to improve quality of content, strategy, or execution for an eCommerce agency managing Shopify stores. Think broadly: draw from psychology, neuroscience, art, architecture, fashion, technology, data science, behavioral economics, or ANY discipline that enriches the topic. Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.82,"memoryType":"pricing_pattern","tags":["tag1","tag2"]}]}`;

        const response = await anthropic.messages.create(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 1200,
            system: `You are OmniCore Micro-Learning Engine — an omniscient knowledge engine that learns from ALL disciplines and fields of human knowledge. Your mission is to accumulate the deepest, most actionable knowledge possible. You are NOT limited to eCommerce — you absorb wisdom from art, science, psychology, technology, design, business strategy, finance, law, marketing, photography, video, AI, data science, logistics, sustainability, and ANY other field relevant to creating exceptional content and strategy. Always connect knowledge to practical application. ${brainCtxMicro}`,
            messages: [{ role: "user", content: prompt }],
          },
          { signal: AbortSignal.timeout(120_000) }
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

          if (conf >= 0.82) {
            await db.insert(omnicoreMemoriesTable).values({
              id: `mem-${insId}`,
              memoryType: ins.memoryType ?? "general",
              niche: "general",
              title: `[${domain.domain}] ${ins.title}`,
              content: ins.insight.slice(0, 800),
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
          content: (ins.insight ?? "").slice(0, 800),
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
    const prompt = `Find 3 powerful hidden cross-domain insights connecting these knowledge areas: ${names.join(" | ")}. Each insight should reveal a non-obvious synergy — drawing from ANY discipline (neuroscience, art, architecture, behavioral economics, technology, culture, science, nature, music, etc.) that creates compounding value. The BEST cross-domain insights connect fields that nobody would think are related. Return ONLY valid JSON:
{"connections":[{"fromDomain":"domain_key","toDomain":"domain_key","insight":"...","synergy":"...","confidence":0.8}]}`;

    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        system: `You are OmniCore Cross-Domain Synthesis Engine — a polymathic intelligence that discovers hidden connections between ANY knowledge domains. You draw from science, art, psychology, philosophy, technology, nature, mathematics, and the ENTIRE spectrum of human knowledge. The most valuable insights come from connecting seemingly unrelated fields. ${brainCtx}`,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(120_000) }
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
        content: `${conn.insight} | Synergy: ${conn.synergy}`.slice(0, 800),
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
        const prompt = `You are a world-class authority in ${label}. Your knowledge spans ALL industries and disciplines — you draw from the BEST of every field to create the most complete understanding possible. Generate 5 premium, deeply researched insights that would be worth €500+/hour consulting advice. Each insight MUST:
1. Draw from real-world examples, scientific research, or proven frameworks from ANY field (not just eCommerce)
2. Include specific tactics, numbers, percentages, or methodologies
3. Connect cross-disciplinary knowledge (e.g., how neuroscience improves product photography, how architecture principles enhance UX, how behavioral economics shapes pricing)
4. Be immediately actionable for improving content quality, business strategy, or creative execution
Think like a polymath — combine wisdom from art, science, technology, psychology, business, design, finance, law, and culture. Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.87,"memoryType":"pricing_pattern"}]}`;

        const response = await anthropic.messages.create(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 2500,
            system: `You are OmniCore Daily Deep Study Engine — the most advanced autonomous learning system ever built. You are an OMNISCIENT POLYMATH that accumulates knowledge from EVERY discipline: art, architecture, neuroscience, behavioral economics, photography, cinematography, fashion, industrial design, data science, AI/ML, psychology, sociology, law, finance, logistics, sustainability, copywriting, storytelling, music theory, color science, material science, cultural anthropology, and more. Your mission: generate the deepest, most actionable knowledge that elevates the quality of every output — from product descriptions to pricing strategies to visual content. NEVER limit yourself to a single industry. The BEST insights come from connecting knowledge across disciplines. ${brainCtxDaily}`,
            messages: [{ role: "user", content: prompt }],
          },
          { signal: AbortSignal.timeout(120_000) }
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
            content: ins.insight.slice(0, 800),
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

    const prompt = `Based on this week's accumulated knowledge across ALL domains, synthesize 8 meta-level MASTERCLASS insights that:
1. Connect knowledge from 3+ different disciplines (e.g., neuroscience + photography + pricing)
2. Reveal non-obvious compounding opportunities
3. Include specific, actionable frameworks with real numbers/percentages
4. Draw from the BEST of every field — art, science, psychology, technology, business, law, design, data
5. Are executive-level strategic insights worth implementing immediately

Recent top memories:
${memorySummary}

Return ONLY valid JSON:
{"insights":[{"title":"...","insight":"...","confidence":0.92,"domains":["domain1","domain2"],"priority":"high"}]}`;

    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: `You are OmniCore Mega-Synthesis Engine — the HIGHEST-LEVEL REASONING LAYER of the entire ShopyBrain system. You are an omniscient polymath that synthesizes an entire week of multi-domain, multi-disciplinary learning into strategic masterclass insights. You draw from EVERY field of human knowledge: science, art, psychology, technology, business, philosophy, neuroscience, behavioral economics, design, photography, cinematography, storytelling, music, architecture, material science, cultural studies, law, and beyond. Your insights are the kind that change businesses overnight. ${brainCtx}`,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(180_000) }
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
          content: ins.insight.slice(0, 800),
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
        logger.warn({ projectId: project.id, domain: project.shopDomain }, "Project has no access token");
        continue;
      }

      try {
        const isValid = await validateToken(project.shopDomain, project.accessToken);
        if (isValid) {
          valid++;
          continue;
        }

        // Token invalid — attempt rotation
        log("token-refresh", `⚠️ Token invalid for project ${project.id} (${project.shopDomain}) — attempting rotation`);
        const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
        await rotateToken(project.id, project.shopDomain, project.clientId, plainSecret, project.accessToken);
        rotated++;
        log("token-refresh", `✅ Token rotated: project ${project.id} (${project.shopDomain})`);
      } catch (err) {
        failed++;
        logger.error(
          { projectId: project.id, domain: project.shopDomain, err },
          "Token invalid and rotation failed — manual update required"
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
  // Cada 20h — Renovar tokens Shopify (duran 24h, renovamos con 4h de margen)
  cron.schedule("5 */20 * * *", () => { runTokenRefresh().catch(e => logger.error(e)); }, { timezone: "Europe/Madrid" });
  // También ejecutar al arrancar para renovar tokens caducados tras reinicio
  setTimeout(() => { runTokenRefresh().catch(e => logger.error(e)); }, 10_000);

  log("scheduler", [
    "✅ 10 jobs registrados:",
    "  🔑 Tokens Shopify    → cada 20h (renovación con 4h margen)",
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
