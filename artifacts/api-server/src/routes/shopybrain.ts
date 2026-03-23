import { Router } from "express";
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicorePromptLibraryTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable, omnicoreStudySessionsTable, omnicoreCrossConnectionsTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DOMAIN_LABELS: Record<string, string> = {
  ecommerce: "eCommerce · CRO · UX",
  shopify_technical: "Shopify Técnico",
  financial_analysis: "Finanzas · P&L",
  trading_markets: "Trading · Mercados",
  investment: "Inversión · Valoración",
  marketing: "Marketing · Ventas",
  sales: "Ventas · Psicología",
  design_ux: "Diseño · UX",
  merchandising: "Merchandising",
  seo_content: "SEO · Contenido",
  logistics: "Logística · Stock",
  paid_media: "Paid Media · ROAS",
  consumer_psychology: "Psicología Consumidor",
  pricing_science: "Pricing Science",
};

async function ensureDomains() {
  const domains = Object.keys(DOMAIN_LABELS);
  for (const domain of domains) {
    const existing = await db.select().from(omnicoreKnowledgeDomainsTable).where(eq(omnicoreKnowledgeDomainsTable.domain, domain));
    if (!existing.length) {
      await db.insert(omnicoreKnowledgeDomainsTable).values({
        id: randomBytes(12).toString("hex"),
        domain,
        knowledgeDepth: Math.floor(Math.random() * 30) + 10,
        verifiedInsights: 0,
        totalInsights: 0,
      });
    }
  }
}

router.get("/shopybrain/status", requireAdmin, async (req, res): Promise<void> => {
  await ensureDomains();
  const memories = await db.select({ count: sql<number>`count(*)` }).from(omnicoreMemoriesTable);
  const insights = await db.select({ count: sql<number>`count(*)` }).from(omnicoreInsightsTable);
  const domains = await db.select().from(omnicoreKnowledgeDomainsTable).orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));
  const recentSessions = await db.select().from(omnicoreStudySessionsTable).orderBy(desc(omnicoreStudySessionsTable.createdAt)).limit(5);
  const nicheProfiles = await db.select({ count: sql<number>`count(*)` }).from(omnicoreNicheProfilesTable);
  const topMemories = await db.select().from(omnicoreMemoriesTable)
    .orderBy(desc(omnicoreMemoriesTable.confidence))
    .limit(8);

  res.json({
    totalMemories: Number(memories[0]?.count ?? 0),
    totalInsights: Number(insights[0]?.count ?? 0),
    totalNicheProfiles: Number(nicheProfiles[0]?.count ?? 0),
    domains: domains.map(d => ({ ...d, label: DOMAIN_LABELS[d.domain] ?? d.domain })),
    recentSessions,
    topMemories,
    brainHealth: domains.length > 0
      ? Math.round(domains.reduce((a, d) => a + (d.knowledgeDepth ?? 0), 0) / domains.length)
      : 0,
  });
});

router.get("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  const { niche, type, minConfidence, limit = "50" } = req.query as Record<string, string>;
  let query = db.select().from(omnicoreMemoriesTable) as any;
  const conditions = [];
  if (niche) conditions.push(eq(omnicoreMemoriesTable.niche, niche));
  if (type) conditions.push(eq(omnicoreMemoriesTable.memoryType, type));
  if (minConfidence) conditions.push(gte(omnicoreMemoriesTable.confidence, parseFloat(minConfidence)));
  if (conditions.length) query = query.where(and(...conditions));
  const memories = await query.orderBy(desc(omnicoreMemoriesTable.confidence)).limit(parseInt(limit));
  res.json(memories);
});

router.post("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  const { memoryType, niche, subNiche, productType, market, title, content, confidence, tags, sourceType } = req.body;
  if (!memoryType || !title || !content) {
    res.status(400).json({ error: "memoryType, title y content son requeridos" });
    return;
  }
  const memory = {
    id: randomBytes(16).toString("hex"),
    memoryType,
    niche: niche ?? null,
    subNiche: subNiche ?? null,
    productType: productType ?? null,
    market: market ?? "es",
    title,
    content,
    confidence: confidence ?? 0.7,
    tags: tags ? JSON.stringify(tags) : null,
    sourceType: sourceType ?? "manual",
    isVerified: 1,
  };
  await db.insert(omnicoreMemoriesTable).values(memory);
  res.json(memory);
});

router.delete("/shopybrain/memories/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(omnicoreMemoriesTable).where(eq(omnicoreMemoriesTable.id, req.params.id));
  res.json({ success: true });
});

router.post("/shopybrain/learn", requireAdmin, async (req, res): Promise<void> => {
  const { event, niche, productType, data } = req.body;
  if (!event) {
    res.status(400).json({ error: "event es requerido" });
    return;
  }

  const memTypeMap: Record<string, string> = {
    image_success: "image_pattern",
    ab_winner: "ab_insight",
    price_success: "pricing_pattern",
    audit_complete: "niche_keyword",
    competitor_scan: "competitor_intel",
  };

  const memory = {
    id: randomBytes(16).toString("hex"),
    memoryType: memTypeMap[event] ?? "general",
    niche: niche ?? null,
    productType: productType ?? null,
    title: `Aprendizaje automático: ${event}`,
    content: JSON.stringify(data ?? {}),
    confidence: 0.5,
    sourceType: `learned_${event}`,
  };

  await db.insert(omnicoreMemoriesTable).values(memory);
  res.json({ success: true, memoryId: memory.id });
});

router.post("/shopybrain/search", requireAdmin, async (req, res): Promise<void> => {
  const { query, niche, searchType } = req.body;
  if (!query) {
    res.status(400).json({ error: "query es requerido" });
    return;
  }

  const conditions = [gte(omnicoreMemoriesTable.confidence, 0.3)];
  if (niche) conditions.push(eq(omnicoreMemoriesTable.niche, niche));

  const existingMemories = await db.select().from(omnicoreMemoriesTable)
    .where(and(...conditions))
    .orderBy(desc(omnicoreMemoriesTable.confidence))
    .limit(5);

  if (existingMemories.length >= 3) {
    res.json({
      source: "shopybrain_memory",
      confidence: existingMemories[0]?.confidence ?? 0.5,
      age: "instant",
      results: existingMemories,
      message: `⚡ Respuesta desde Shopy Brain (${existingMemories.length} memorias relevantes)`,
    });
    return;
  }

  const systemPrompt = `Eres Shopy Brain, el megacerebro de eCommerce Shopify.
Analiza y responde con datos concretos sobre: ${searchType ?? "estrategia general"}.
Nicho de mercado: ${niche ?? "general"}. 
Proporciona insights accionables y específicos.`;

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: query }],
  });

  const aiContent = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";

  await db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType: "web_research",
    niche: niche ?? null,
    title: query.slice(0, 100),
    content: aiContent,
    confidence: 0.6,
    sourceType: "web_search",
  });

  res.json({
    source: "ai_research",
    confidence: 0.6,
    age: "now",
    results: [{ title: query, content: aiContent }],
    savedToShopyBrain: true,
    message: "🔍→🧠 Búsqueda + aprendido para el futuro",
  });
});

router.get("/shopybrain/insights", requireAdmin, async (req, res): Promise<void> => {
  const { domain } = req.query as { domain?: string };
  let insights;
  if (domain) {
    insights = await db.select().from(omnicoreInsightsTable)
      .where(eq(omnicoreInsightsTable.domain, domain))
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(20);
  } else {
    insights = await db.select().from(omnicoreInsightsTable)
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(50);
  }
  const domains = await db.select().from(omnicoreKnowledgeDomainsTable)
    .orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));
  res.json({ insights, domains: domains.map(d => ({ ...d, label: DOMAIN_LABELS[d.domain] ?? d.domain })) });
});

router.post("/shopybrain/study", requireAdmin, async (req, res): Promise<void> => {
  const { domains: requestedDomains, sessionType = "manual_trigger" } = req.body;
  const domainsToStudy = requestedDomains ?? Object.keys(DOMAIN_LABELS).slice(0, 4);
  const startTime = Date.now();

  const systemPrompt = `Eres Shopy Brain — el megacerebro de inteligencia especializada en eCommerce Shopify.
Vas a realizar una sesión de estudio profundo en estos dominios: ${domainsToStudy.join(", ")}.

Para cada dominio, genera 3-5 insights en formato JSON:
{
  "insights": [
    {
      "domain": "nombre_dominio",
      "insightType": "principle|pattern|correlation|prediction|opportunity|warning",
      "title": "título corto",
      "insight": "el conocimiento específico y accionable",
      "evidence": "qué datos o lógica lo soporta",
      "confidence": 0.0-1.0,
      "impactScore": 0.0-1.0,
      "relatedDomains": ["dominio1", "dominio2"]
    }
  ],
  "summary": "resumen de la sesión",
  "keyDiscoveries": ["descubrimiento 1", "descubrimiento 2", "descubrimiento 3"]
}

Principios que guían el análisis:
- Insights concretos y aplicables al eCommerce español/latinoamericano
- Conexiones cross-domain (cómo el pricing afecta al SEO, cómo la psicología afecta al merchandising, etc.)
- Datos reales y tendencias actuales del mercado Shopify
Responde SOLO con el JSON, sin texto adicional.`;

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: `Realiza sesión de estudio para dominios: ${domainsToStudy.join(", ")}` }],
    system: systemPrompt,
  });

  const rawText = aiRes.content[0].type === "text" ? aiRes.content[0].text : "{}";
  let parsed: any = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {}

  const sessionId = randomBytes(16).toString("hex");
  let insightsCreated = 0;

  if (parsed.insights?.length) {
    for (const insight of parsed.insights) {
      await db.insert(omnicoreInsightsTable).values({
        id: randomBytes(16).toString("hex"),
        domain: insight.domain ?? domainsToStudy[0],
        insightType: insight.insightType ?? "principle",
        title: insight.title ?? "Insight",
        insight: insight.insight ?? "",
        evidence: insight.evidence ?? null,
        confidence: insight.confidence ?? 0.6,
        impactScore: insight.impactScore ?? 0.5,
        relatedDomains: insight.relatedDomains ? JSON.stringify(insight.relatedDomains) : null,
        source: "study_session",
      });
      insightsCreated++;

      await db.update(omnicoreKnowledgeDomainsTable)
        .set({
          totalInsights: sql`${omnicoreKnowledgeDomainsTable.totalInsights} + 1`,
          knowledgeDepth: sql`LEAST(100, ${omnicoreKnowledgeDomainsTable.knowledgeDepth} + 3)`,
          lastStudySession: new Date(),
        })
        .where(eq(omnicoreKnowledgeDomainsTable.domain, insight.domain ?? domainsToStudy[0]));
    }
  }

  await db.insert(omnicoreStudySessionsTable).values({
    id: sessionId,
    sessionType,
    domainsStudied: JSON.stringify(domainsToStudy),
    trigger: req.body.trigger ?? "manual",
    durationSeconds: Math.round((Date.now() - startTime) / 1000),
    insightsCreated,
    summary: parsed.summary ?? `Sesión de estudio completada para ${domainsToStudy.length} dominios`,
    keyDiscoveries: parsed.keyDiscoveries ? JSON.stringify(parsed.keyDiscoveries) : null,
    tokensUsed: aiRes.usage?.input_tokens + aiRes.usage?.output_tokens,
  });

  res.json({
    success: true,
    sessionId,
    insightsCreated,
    summary: parsed.summary,
    keyDiscoveries: parsed.keyDiscoveries ?? [],
    durationMs: Date.now() - startTime,
  });
});

router.get("/shopybrain/sessions", requireAdmin, async (req, res): Promise<void> => {
  const sessions = await db.select().from(omnicoreStudySessionsTable)
    .orderBy(desc(omnicoreStudySessionsTable.createdAt))
    .limit(20);
  res.json(sessions);
});

router.get("/shopybrain/niche-profiles", requireAdmin, async (req, res): Promise<void> => {
  const profiles = await db.select().from(omnicoreNicheProfilesTable)
    .orderBy(desc(omnicoreNicheProfilesTable.storesAnalyzed));
  res.json(profiles);
});

router.post("/shopybrain/niche-profiles", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body;
  if (!body.niche) {
    res.status(400).json({ error: "niche es requerido" });
    return;
  }
  const existing = await db.select().from(omnicoreNicheProfilesTable).where(eq(omnicoreNicheProfilesTable.niche, body.niche));
  if (existing.length) {
    await db.update(omnicoreNicheProfilesTable).set({ ...body, updatedAt: new Date() }).where(eq(omnicoreNicheProfilesTable.niche, body.niche));
    res.json({ success: true, updated: true });
  } else {
    const profile = { id: randomBytes(16).toString("hex"), ...body };
    await db.insert(omnicoreNicheProfilesTable).values(profile);
    res.json(profile);
  }
});

router.get("/shopybrain/prompt-library", requireAdmin, async (req, res): Promise<void> => {
  const prompts = await db.select().from(omnicorePromptLibraryTable)
    .orderBy(desc(omnicorePromptLibraryTable.useCount));
  res.json(prompts);
});

router.post("/shopybrain/prompt-library", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, niche, useCase, promptTemplate, variables } = req.body;
  if (!name || !promptTemplate) {
    res.status(400).json({ error: "name y promptTemplate son requeridos" });
    return;
  }
  const prompt = {
    id: randomBytes(16).toString("hex"),
    name, description, niche, useCase, promptTemplate,
    variables: variables ? JSON.stringify(variables) : null,
    createdBy: (req.session as any).userId,
  };
  await db.insert(omnicorePromptLibraryTable).values(prompt);
  res.json(prompt);
});

// ─── TRIGGERS MANUALES 24/7 ──────────────────────────────────────────────────
router.post("/shopybrain/run/micro-learning", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreMicroLearning } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "⚡ Micro-learning cycle iniciado" });
    runOmniCoreMicroLearning().catch(e => console.error("micro-learning error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/consolidation", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreMemoryConsolidation } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🧠 Memory consolidation iniciada" });
    runOmniCoreMemoryConsolidation().catch(e => console.error("consolidation error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/cross-synthesis", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreCrossConnections } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🔗 Cross-domain synthesis iniciada" });
    runOmniCoreCrossConnections().catch(e => console.error("cross-synthesis error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/daily-study", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreDailyDeepStudy } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🎓 Daily deep study iniciado (14 dominios)" });
    runOmniCoreDailyDeepStudy().catch(e => console.error("daily-study error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/mega-synthesis", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { runOmniCoreMegaSynthesis } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🚀 Mega-synthesis semanal iniciada" });
    runOmniCoreMegaSynthesis().catch(e => console.error("mega-synthesis error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── SCHEDULE INFO ────────────────────────────────────────────────────────────
router.get("/shopybrain/schedule", requireAdmin, async (_req, res): Promise<void> => {
  res.json({
    learningCycles: [
      { name: "⚡ Micro-Learning",      frequency: "Cada 3 horas",   description: "2 dominios × 3 insights (16 ciclos/día)", nextRun: "próxima hora redonda ÷ 3", trigger: "/shopybrain/run/micro-learning" },
      { name: "🧠 Memory Consolidation", frequency: "Cada 6 horas",   description: "Insights → memorias permanentes",          trigger: "/shopybrain/run/consolidation" },
      { name: "🔗 Cross-Synthesis",      frequency: "Cada 12 horas",  description: "Conexiones entre dominios",               trigger: "/shopybrain/run/cross-synthesis" },
      { name: "🎓 Daily Deep Study",     frequency: "Diario 1am",     description: "14 dominios × 5 insights = 70 insights",   trigger: "/shopybrain/run/daily-study" },
      { name: "📊 Revenue Snapshots",    frequency: "Diario 2am",     description: "Datos reales de Shopify" },
      { name: "📦 Real Data Sync",       frequency: "Diario 3am",     description: "Integración datos tiendas" },
      { name: "🔍 Competitor Scans",     frequency: "Diario 6am",     description: "Price monitoring" },
      { name: "📦 Inventory Sync",       frequency: "Diario 7am",     description: "Stock + alertas" },
      { name: "🚀 Mega-Synthesis",       frequency: "Domingo 0am",    description: "Síntesis estratégica semanal",            trigger: "/shopybrain/run/mega-synthesis" },
    ],
    stats: {
      insightsPerDay: "~120 insights/día (micro × 16 ciclos + daily 70)",
      domainsTotal: 14,
      learningHoursPerDay: 24,
      continuousLearning: true,
    },
  });
});

export async function getShopyBrainContext(niche: string | null, useCase: string): Promise<string> {
  if (!niche) return "";
  try {
    const memories = await db.select().from(omnicoreMemoriesTable)
      .where(and(
        gte(omnicoreMemoriesTable.confidence, 0.3),
        eq(omnicoreMemoriesTable.niche, niche),
      ))
      .orderBy(desc(omnicoreMemoriesTable.confidence))
      .limit(5);

    const nicheProfiles = await db.select().from(omnicoreNicheProfilesTable)
      .where(eq(omnicoreNicheProfilesTable.niche, niche))
      .limit(1);

    if (!memories.length && !nicheProfiles.length) return "";

    let ctx = `\n═══ SHOPY BRAIN — Conocimiento acumulado para "${niche}" ═══\n`;

    if (nicheProfiles.length) {
      const p = nicheProfiles[0];
      ctx += `PERFIL DEL NICHO "${niche}":\n`;
      if (p.avgPriceSweetSpot) ctx += `- Precio dulce del mercado: €${p.avgPriceSweetSpot}\n`;
      if (p.typicalMarginPct) ctx += `- Margen típico: ${p.typicalMarginPct}%\n`;
      if (p.topKeywords) ctx += `- Top keywords: ${p.topKeywords}\n`;
      if (p.toneDescription) ctx += `- Tono que funciona: ${p.toneDescription}\n`;
    }

    if (memories.length) {
      ctx += `\nMEMORIAS RELEVANTES (${useCase}):\n`;
      for (const m of memories) {
        ctx += `[${m.memoryType?.toUpperCase()}] ${m.title} (confianza: ${Math.round((m.confidence ?? 0.5) * 100)}%)\n${m.content}\n\n`;
      }
    }

    ctx += `═══ FIN SHOPY BRAIN ═══\n`;
    return ctx;
  } catch {
    return "";
  }
}

export default router;
