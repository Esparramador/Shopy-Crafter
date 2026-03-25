import { Router } from "express";
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicorePromptLibraryTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable, omnicoreStudySessionsTable, omnicoreCrossConnectionsTable, projectsTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import Anthropic from "@anthropic-ai/sdk";
import { loadExistingEntityKnowledge } from "./entity-research.js";
import { APP_GUIDE_KNOWLEDGE, getPageContextForRoute, detectGuideRequest } from "../lib/app-guide.js";
import { shopifyRequest, refreshToken } from "../lib/shopify.js";
import { safeDecrypt } from "../lib/crypto.js";
import { learnFromOperation } from "../lib/claude.js";
import { logger } from "../lib/logger.js";

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
  visual_production: "Producción Visual · Cinematografía",
  general: "Conocimiento General",
};

async function ensureDomains() {
  const domains = Object.keys(DOMAIN_LABELS);
  for (const domain of domains) {
    const existing = await db.select().from(omnicoreKnowledgeDomainsTable).where(eq(omnicoreKnowledgeDomainsTable.domain, domain));
    if (!existing.length) {
      await db.insert(omnicoreKnowledgeDomainsTable).values({
        id: randomBytes(12).toString("hex"),
        domain,
        knowledgeDepth: 0,
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
  await db.delete(omnicoreMemoriesTable).where(eq(omnicoreMemoriesTable.id, String(req.params.id)));
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
  const { query, niche, searchType, returnRaw, systemPrompt: customSystemPrompt, conversationHistory, currentRoute } = req.body;
  if (!query) {
    res.status(400).json({ error: "query es requerido" });
    return;
  }

  if (returnRaw) {
    let entityKnowledgeContext = "";
    const entityMatches = query.match(/[@]([a-zA-Z0-9_.]+)|(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]{3,})\.[a-zA-Z]{2,}|(?:sobre|investigar?|analiza|dame información de|qué sabes de|qué tienes sobre)\s+([^\?\.]+)/i);
    const potentialEntity = entityMatches?.[1] ?? entityMatches?.[2] ?? entityMatches?.[3]?.trim();

    if (potentialEntity && potentialEntity.length > 2) {
      try {
        const entityKnowledge = await loadExistingEntityKnowledge(potentialEntity);
        if (entityKnowledge.hasKnowledge) {
          entityKnowledgeContext = `\n\n═══ CONOCIMIENTO ACUMULADO EN SHOPYBRAIN SOBRE "${potentialEntity.toUpperCase()}" ═══
[${entityKnowledge.memories.length} memorias · ${entityKnowledge.dimensions.join(", ")} · última actualización: ${entityKnowledge.knowledgeAge}]

${entityKnowledge.summary.slice(0, 3000)}
═══ FIN DE CONOCIMIENTO PREVIO ═══

INSTRUCCIÓN: Usa este conocimiento guardado como base para tu respuesta. Es información real ya investigada y verificada por ShopyBrain. Complementa con tu propio conocimiento si es necesario.`;
        }
      } catch {
      }
    }

    const relevantMemories = await db.select()
      .from(omnicoreMemoriesTable)
      .where(gte(omnicoreMemoriesTable.confidence, 0.6))
      .orderBy(desc(omnicoreMemoriesTable.updatedAt))
      .limit(5);

    const memoriesContext = relevantMemories.length > 0
      ? `\n\nCONOCIMIENTO RECIENTE EN SHOPYBRAIN:\n${relevantMemories.map(m => `• ${m.title}: ${(m.content ?? "").slice(0, 200)}`).join("\n")}`
      : "";

    const isGuideRequest = detectGuideRequest(query);
    const pageContext = currentRoute ? getPageContextForRoute(currentRoute) : "";
    const guideBlock = isGuideRequest ? `\n\n${APP_GUIDE_KNOWLEDGE}` : "";
    const pageBlock = pageContext ? `\n\nPÁGINA ACTUAL DEL USUARIO: ${pageContext}\nRuta: ${currentRoute}\nINSTRUCCIÓN: Si el usuario pregunta algo, ten en cuenta que está en esta página. Si pide ayuda, guíale con los botones y opciones EXACTOS de esta página. Sé muy específico con nombres de botones, ubicaciones y orden de pasos.` : "";

    const actionDetectionBlock = `

CAPACIDADES DE ACCIÓN DIRECTA — SHOPIFY:
Cuando el usuario pida EJECUTAR una acción (crear producto, cambiar precio, ver productos, regenerar token, etc.), debes responder con un bloque JSON de acción AL FINAL de tu respuesta, después de tu texto explicativo.

Formato del bloque de acción (pon esto al final de tu respuesta cuando detectes una acción):
:::ACTION:::{"action":"nombre_accion","params":{...}}:::END_ACTION:::

Acciones disponibles:
- store_status: Ver estado de la tienda. Params: {projectId}
- list_products: Listar productos. Params: {projectId, limit?}
- create_product: Crear producto. Params: {projectId, title, bodyHtml?, price?, tags?, productType?, vendor?, status?, aiGenerate?}
- edit_product: Editar producto. Params: {projectId, productId, title?, bodyHtml?, tags?, status?, price?, vendor?}
- change_price: Cambiar precio. Params: {projectId, productId, price, compareAtPrice?}
- regenerate_token: Regenerar token Shopify. Params: {projectId}
- get_scopes: Ver permisos/scopes. Params: {projectId}
- delete_product: Eliminar producto. Params: {projectId, productId}
- search_product: Buscar producto por nombre. Params: {projectId, query}
- publish_product: Publicar producto (draft→active). Params: {projectId, productId}
- get_orders: Ver pedidos recientes. Params: {projectId, limit?}

REGLAS:
- Si el usuario dice "crea un producto llamado X", EJECUTA la acción create_product
- Si dice "muéstrame los productos", EJECUTA list_products
- Si dice "regenera el token", EJECUTA regenerate_token
- Si dice "cuántos productos tiene la tienda", EJECUTA store_status
- Si dice "cambia el precio de X a Y", necesitas primero buscar el producto, o si dan el ID, usa change_price
- Si dice "publica el producto X", usa publish_product
- Si dice "borra el producto X", usa delete_product
- Si dice "busca productos de X", usa search_product
- Si dice "ver pedidos", usa get_orders
- USA projectId del contexto si el usuario tiene un proyecto activo
- Cuando ejecutes una acción, explica brevemente qué vas a hacer ANTES del bloque :::ACTION:::
- Si no se necesita una acción, simplemente responde normalmente sin el bloque :::ACTION:::
`;

    const sysPrompt = (customSystemPrompt ?? `Eres OmniCore AI, el asistente central de la plataforma ShopyBrain para agencias Shopify.
Eres experto en Shopify, Klaviyo, email marketing, SEO, pricing y estrategia eCommerce.
Tienes acceso al conocimiento acumulado de ShopyBrain — memorias de investigaciones anteriores sobre marcas, nichos y estrategias.
Responde siempre en español, de forma directa, clara y accionable.
Cuando el usuario pida ayuda o pregunte cómo hacer algo, actúa como GUÍA INTERACTIVA: da instrucciones paso a paso con los nombres EXACTOS de botones, páginas y secciones de la app.
Si conoces la página actual del usuario, contextualiza tu respuesta a esa página.
Cuando tengas conocimiento previo sobre una entidad, úsalo activamente en tu respuesta e indica qué parte viene de tu memoria.
PUEDES EJECUTAR ACCIONES EN SHOPIFY directamente desde el chat. Cuando el usuario pida crear, editar, eliminar, publicar productos, cambiar precios, ver estado de la tienda, regenerar tokens, etc., EJECUTA la acción correspondiente.`) + actionDetectionBlock + guideBlock + pageBlock + entityKnowledgeContext + memoriesContext;

    const projectContext = req.body.activeProjectId ? `\n[CONTEXTO: El usuario tiene el proyecto activo con ID ${req.body.activeProjectId}. Úsalo como projectId en las acciones.]` : "";
    const userContent = (conversationHistory ? `Conversación previa:\n${conversationHistory}\n\nUsuario: ${query}` : query) + projectContext;

    const aiRes = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: sysPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const answer = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";

    let detectedAction: { action: string; params: Record<string, unknown> } | null = null;
    const actionMatch = answer.match(/:::ACTION:::([\s\S]*?):::END_ACTION:::/);
    if (actionMatch) {
      try {
        detectedAction = JSON.parse(actionMatch[1]);
      } catch { /* invalid JSON, ignore */ }
    }

    const cleanAnswer = answer.replace(/:::ACTION:::[\s\S]*?:::END_ACTION:::/g, "").trim();

    res.json({
      answer: cleanAnswer,
      source: "claude+omnicore",
      entityKnowledgeUsed: !!entityKnowledgeContext,
      potentialEntity: potentialEntity ?? null,
      detectedAction,
    });
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

router.post("/shopybrain/execute-action", requireAdmin, async (req, res): Promise<void> => {
  const { action, params } = req.body;
  if (!action) { res.status(400).json({ error: "action requerida" }); return; }

  try {
    let result: Record<string, unknown> = {};

    switch (action) {
      case "store_status": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const shop = await shopifyRequest<{ shop: Record<string, unknown> }>(parseInt(projectId), project.shopDomain, "/shop.json");
        const productsCount = await shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/products/count.json");
        const ordersCount = await shopifyRequest<{ count: number }>(parseInt(projectId), project.shopDomain, "/orders/count.json?status=any");

        const tokenExpiry = project.tokenExpiresAt;
        const tokenValid = tokenExpiry ? new Date(tokenExpiry) > new Date() : false;
        const tokenHoursLeft = tokenExpiry ? Math.max(0, Math.round((new Date(tokenExpiry).getTime() - Date.now()) / 3600000 * 10) / 10) : 0;

        result = {
          storeName: shop.shop?.name ?? project.name,
          domain: project.shopDomain,
          plan: (shop.shop as Record<string, unknown>)?.plan_name,
          currency: (shop.shop as Record<string, unknown>)?.currency,
          productsCount: productsCount.count,
          ordersCount: ordersCount.count,
          tokenStatus: tokenValid ? "valid" : "expired",
          tokenHoursLeft,
          tokenExpiresAt: tokenExpiry,
          message: `Tienda: ${shop.shop?.name ?? project.name} | ${productsCount.count} productos | ${ordersCount.count} pedidos | Token: ${tokenValid ? `válido (${tokenHoursLeft}h restantes)` : "EXPIRADO"}`,
        };
        break;
      }

      case "list_products": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const limit = Math.min(params?.limit ?? 10, 50);
        const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, `/products.json?limit=${limit}&fields=id,title,status,variants,images,tags`
        );

        result = {
          products: data.products.map((p: Record<string, unknown>) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            price: (p.variants as Array<Record<string, string>>)?.[0]?.price ?? "0.00",
            imageCount: (p.images as unknown[])?.length ?? 0,
            tags: p.tags,
          })),
          total: data.products.length,
          message: `${data.products.length} productos encontrados`,
        };
        break;
      }

      case "create_product": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const title = params?.title;
        if (!title) { res.status(400).json({ error: "title requerido" }); return; }

        let finalTitle = title;
        let finalBody = params?.bodyHtml ?? "";
        let finalTags = params?.tags ?? "";

        if (params?.aiGenerate !== false) {
          try {
            const aiRes = await anthropic.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 1500,
              system: "Eres un experto en copywriting eCommerce Shopify. Genera contenido que convierta. Responde SOLO JSON válido.",
              messages: [{
                role: "user",
                content: `Genera contenido optimizado para un producto Shopify.
Título: "${title}"
Tipo: ${params?.productType || "no especificado"}
Nicho: ${project.storeNiche || "general"}
Tono: ${project.brandTone || "profesional"}

Genera JSON: {"title":"...","description":"HTML persuasiva con bullet points","tags":["tag1","tag2"],"seoTitle":"...","seoDescription":"..."}`
              }],
            });
            const text = (aiRes.content[0] as { type: string; text: string }).text;
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              finalTitle = parsed.title || title;
              finalBody = parsed.description || finalBody;
              finalTags = Array.isArray(parsed.tags) ? parsed.tags.join(", ") : finalTags;
            }
          } catch { /* use original data */ }
        }

        const shopifyProduct = {
          title: finalTitle,
          body_html: finalBody,
          tags: finalTags,
          vendor: params?.vendor || undefined,
          product_type: params?.productType || undefined,
          status: params?.status || "draft",
          variants: [{
            title: "Default",
            price: params?.price || "0.00",
            compare_at_price: params?.compareAtPrice || null,
            sku: params?.sku || null,
            requires_shipping: true,
            taxable: true,
          }],
        };

        const created = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, "/products.json",
          { method: "POST", body: JSON.stringify({ product: shopifyProduct }) }
        );

        result = {
          productId: created.product.id,
          title: created.product.title,
          status: created.product.status,
          handle: created.product.handle,
          message: `Producto "${created.product.title}" creado exitosamente en Shopify (ID: ${created.product.id}, estado: ${created.product.status})`,
        };
        break;
      }

      case "edit_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const updates: Record<string, unknown> = {};
        if (params?.title) updates.title = params.title;
        if (params?.bodyHtml) updates.body_html = params.bodyHtml;
        if (params?.tags) updates.tags = params.tags;
        if (params?.status) updates.status = params.status;
        if (params?.vendor) updates.vendor = params.vendor;
        if (params?.productType) updates.product_type = params.productType;

        if (params?.price) {
          updates.variants = [{ id: params.variantId, price: params.price }];
        }

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: updates }) }
        );

        result = {
          productId: updated.product.id,
          title: updated.product.title,
          message: `Producto "${updated.product.title}" actualizado en Shopify`,
        };
        break;
      }

      case "change_price": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        const newPrice = params?.price;
        if (!projectId || !productId || !newPrice) { res.status(400).json({ error: "projectId, productId y price requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const current = await shopifyRequest<{ product: { variants: Array<{ id: number; price: string }> } }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json?fields=id,title,variants`
        );
        const variantId = current.product.variants?.[0]?.id;
        if (!variantId) { res.status(404).json({ error: "No se encontró variante" }); return; }

        await shopifyRequest(
          parseInt(projectId), project.shopDomain, `/variants/${variantId}.json`,
          { method: "PUT", body: JSON.stringify({ variant: { id: variantId, price: String(newPrice), compare_at_price: params?.compareAtPrice || null } }) }
        );

        result = {
          productId,
          oldPrice: current.product.variants[0].price,
          newPrice: String(newPrice),
          message: `Precio actualizado: ${current.product.variants[0].price}€ → ${newPrice}€`,
        };
        break;
      }

      case "regenerate_token": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
        const newToken = await refreshToken(parseInt(projectId), project.shopDomain, project.clientId, plainSecret);
        const [updated] = await db.select({ tokenExpiresAt: projectsTable.tokenExpiresAt }).from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));

        result = {
          success: true,
          tokenValid: !!newToken,
          expiresAt: updated?.tokenExpiresAt,
          hoursRemaining: updated?.tokenExpiresAt ? Math.round((new Date(updated.tokenExpiresAt).getTime() - Date.now()) / 3600000 * 10) / 10 : 0,
          message: `Token regenerado exitosamente. Válido por ${updated?.tokenExpiresAt ? Math.round((new Date(updated.tokenExpiresAt).getTime() - Date.now()) / 3600000) : 24} horas.`,
        };
        break;
      }

      case "get_scopes": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        try {
          const scopesData = await shopifyRequest<{ access_scopes: Array<{ handle: string }> }>(
            parseInt(projectId), project.shopDomain, "/../oauth/access_scopes.json"
          );
          const scopes = scopesData.access_scopes?.map(s => s.handle) ?? [];
          result = {
            scopes,
            total: scopes.length,
            hasWriteProducts: scopes.includes("write_products"),
            hasWriteInventory: scopes.includes("write_inventory"),
            hasWriteContent: scopes.includes("write_content"),
            hasReadOrders: scopes.includes("read_orders"),
            message: `${scopes.length} scopes activos: ${scopes.join(", ")}`,
          };
        } catch (e) {
          result = {
            scopes: ["read_products", "write_products", "read_orders", "read_customers", "read_analytics", "read_inventory", "write_inventory", "read_price_rules", "write_price_rules", "read_content", "write_content", "read_themes"],
            total: 12,
            message: "Scopes configurados en OAuth (no se pudo verificar en vivo): read/write_products, orders, customers, analytics, inventory, price_rules, content, themes",
            note: "Error consultando scopes en vivo, mostrando scopes configurados",
          };
        }
        break;
      }

      case "delete_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        await shopifyRequest(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "DELETE" }
        );

        result = { productId, message: `Producto ${productId} eliminado de Shopify` };
        break;
      }

      case "search_product": {
        const projectId = params?.projectId;
        const query = params?.query;
        if (!projectId || !query) { res.status(400).json({ error: "projectId y query requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const data = await shopifyRequest<{ products: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, `/products.json?title=${encodeURIComponent(query)}&limit=10&fields=id,title,status,variants,images`
        );

        result = {
          products: data.products.map((p: Record<string, unknown>) => ({
            id: p.id, title: p.title, status: p.status,
            price: (p.variants as Array<Record<string, string>>)?.[0]?.price,
            imageCount: (p.images as unknown[])?.length ?? 0,
          })),
          total: data.products.length,
          message: `${data.products.length} productos encontrados para "${query}"`,
        };
        break;
      }

      case "publish_product": {
        const projectId = params?.projectId;
        const productId = params?.productId;
        if (!projectId || !productId) { res.status(400).json({ error: "projectId y productId requeridos" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const updated = await shopifyRequest<{ product: Record<string, unknown> }>(
          parseInt(projectId), project.shopDomain, `/products/${productId}.json`,
          { method: "PUT", body: JSON.stringify({ product: { id: productId, status: "active" } }) }
        );

        result = { productId, title: updated.product.title, status: "active", message: `Producto "${updated.product.title}" publicado (active)` };
        break;
      }

      case "get_orders": {
        const projectId = params?.projectId;
        if (!projectId) { res.status(400).json({ error: "projectId requerido" }); return; }
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
        if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

        const limit = Math.min(params?.limit ?? 10, 50);
        const data = await shopifyRequest<{ orders: Array<Record<string, unknown>> }>(
          parseInt(projectId), project.shopDomain, `/orders.json?limit=${limit}&status=any&fields=id,name,total_price,financial_status,fulfillment_status,created_at,customer`
        );

        result = {
          orders: data.orders.map((o: Record<string, unknown>) => ({
            id: o.id, name: o.name, total: o.total_price,
            financial: o.financial_status, fulfillment: o.fulfillment_status,
            date: o.created_at,
            customer: (o.customer as Record<string, string>)?.first_name ? `${(o.customer as Record<string, string>).first_name} ${(o.customer as Record<string, string>).last_name}` : "Anónimo",
          })),
          total: data.orders.length,
          message: `${data.orders.length} pedidos recientes`,
        };
        break;
      }

      default:
        res.status(400).json({ error: `Acción desconocida: ${action}` });
        return;
    }

    learnFromOperation({
      operationType: `chatbot_action_${action}`,
      title: `Chatbot ejecutó: ${action}`,
      content: `Acción: ${action}. Params: ${JSON.stringify(params).slice(0, 300)}. Resultado: ${(result as Record<string, unknown>).message ?? "OK"}`,
      confidence: 0.8,
      tags: ["chatbot", "action", action],
    });

    res.json({ success: true, action, ...result });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error({ action, params, error: errMsg }, "Chatbot action failed");
    res.status(500).json({ error: `Error ejecutando ${action}: ${errMsg}` });
  }
});

export default router;
