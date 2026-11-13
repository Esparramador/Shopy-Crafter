import { Router } from "express";
import { enableLongRunning } from "../lib/long-running.js";
import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreNicheProfilesTable, omnicorePromptLibraryTable, omnicoreKnowledgeDomainsTable, omnicoreInsightsTable, omnicoreStudySessionsTable, omnicoreCrossConnectionsTable, projectsTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { askClaudeWithBrain } from "../lib/claude.js";
import { logger } from "../lib/logger.js";
import { askClaudeJsonValidated } from "../lib/ai-json.js";
import { processUploadedFile } from "../lib/file-processor.js";
import { getPlatform } from "../lib/platform-capabilities.js";
import { brainRoute, BRAIN_ENGINE_MODES, type BrainEngineMode } from "../lib/brain/router.js";
import { brainExecute } from "../lib/brain/execute.js";
import { getBrainCatalog, isBrainGate } from "../lib/brain/catalog.js";
import { listBrainEventChannels, listBrainEvents } from "../lib/brain/events.js";

import {
  handleRouteError, upload, studySessionSchema, DOMAIN_LABELS, ensureDomains
} from "./shopybrain/shared.js";
const router = Router();

// GET /shopybrain/quick-actions?route=/admin/inventory&projectId=2
// Devuelve acciones rápidas contextuales según la ruta actual del usuario.
// Reemplaza los QUICK_ACTIONS hardcodeados del frontend.
router.get("/shopybrain/quick-actions", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { route = "/", projectId } = req.query as Record<string, string>;
    const r = String(route);

    // Acciones SIEMPRE presentes (globales)
    const globalActions = [
      { icon: "❓", label: "¿Qué puedo hacer aquí?", prompt: `¿Qué puedo hacer en la página ${r}? Guíame paso a paso con los botones y opciones disponibles.` },
      { icon: "🧠", label: "Estado del sistema", prompt: "¿Qué conocimiento ha absorbido Shopy Crafter? Dame un resumen de las memorias, dominios y contenido absorbido hasta ahora." },
    ];

    // Plataforma del proyecto activo → prompts y contexto específicos (Stripe ≠ tienda)
    let platformInfo: { key: string; label: string; icon: string; color: string; entityLabel: string; capabilities: string[]; chatbotContext: string } | null = null;
    const pidNum = parseInt(String(projectId ?? ""), 10);
    if (pidNum > 0) {
      try {
        const [proj] = await db.select({ platformType: projectsTable.platformType }).from(projectsTable).where(eq(projectsTable.id, pidNum)).limit(1);
        if (proj) {
          const def = getPlatform(proj.platformType);
          platformInfo = { key: def.key, label: def.label, icon: def.icon, color: def.color, entityLabel: def.entityLabel, capabilities: def.capabilities, chatbotContext: def.chatbotContext };
        }
      } catch { /* sin plataforma → prompts por ruta */ }
    }

    // Acciones contextuales según ruta
    let contextActions: Array<{ icon: string; label: string; prompt: string; isResearch?: boolean }> = [];

    if (platformInfo && platformInfo.key !== "shopify" && r.startsWith("/projects/")) {
      // Proyecto no-Shopify: los prompts los dicta el registro de capacidades, no la ruta
      contextActions = [
        ...getPlatform(platformInfo.key).quickPrompts,
        { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
      ];
      res.json({ actions: [...globalActions, ...contextActions], platform: platformInfo });
      return;
    }

    if (r.startsWith("/admin/inventory")) {
      contextActions = [
        { icon: "🔄", label: "Sincronizar pedidos", prompt: `Sincroniza todos los pedidos de la tienda${projectId ? ` (proyecto ${projectId})` : ""} con paginación completa, incluyendo refunds.` },
        { icon: "💸", label: "Sincronizar devoluciones", prompt: `Sincroniza solo las devoluciones de la tienda${projectId ? ` (proyecto ${projectId})` : ""}.` },
        { icon: "📊", label: "Top productos vendidos", prompt: "Muéstrame los 10 productos más vendidos con cantidades y revenue real." },
        { icon: "⚠️", label: "Stock crítico", prompt: "¿Qué productos están en stock crítico (≤7 días)? Sugiere pedidos de reabastecimiento." },
      ];
    } else if (r.match(/\/projects\/\d+\/(audit|seo|redesign)/)) {
      contextActions = [
        { icon: "🔬", label: "Auditoría completa", prompt: "Realiza una auditoría completa de la tienda con análisis SEO, marca, copyright y oportunidades." },
        { icon: "✏️", label: "Rediseño masivo", prompt: "Rediseña todos los productos con la marca activa." },
        { icon: "📈", label: "Optimizar SEO", prompt: "Optimiza el SEO de todos los productos con keywords competitivas." },
      ];
    } else if (r.match(/\/projects\/\d+\/(images|fusion-studio|generator)/)) {
      contextActions = [
        { icon: "🖼", label: "Generar imágenes IA", prompt: "Genera imágenes profesionales de todos los productos con estilo lookbook." },
        { icon: "🧬", label: "Fusion: producto + escena", prompt: "Quiero fusionar un producto con una escena. Ayúdame paso a paso." },
        { icon: "🎬", label: "Video persona+producto", prompt: "Genera un video de un avatar mostrando uno de mis productos. Ayúdame a configurarlo (voy a /admin/avatar-studio)." },
      ];
    } else if (r.startsWith("/admin/clients") || r === "/" || r === "/home") {
      contextActions = [
        { icon: "🏪", label: "Estado de la tienda", prompt: "Muéstrame el estado general de las tiendas conectadas: productos, pedidos, tokens." },
        { icon: "📦", label: "Listar productos", prompt: "Lista todos los productos de la tienda principal." },
        { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
      ];
    } else if (r.startsWith("/admin/email")) {
      contextActions = [
        { icon: "📧", label: "Crear flujo Klaviyo", prompt: "Genera un workflow completo de Klaviyo con los 6 flujos esenciales." },
        { icon: "✉️", label: "Plantilla bienvenida", prompt: "Crea una plantilla de email de bienvenida en HTML profesional." },
      ];
    } else if (r.startsWith("/admin/stripe")) {
      contextActions = [
        { icon: "📊", label: "Análisis de fees", prompt: "Analiza mis costes de procesamiento en Stripe. ¿Cuál es mi tasa efectiva y cómo puedo reducirla?" },
        { icon: "🛡", label: "Auditoría de fraude", prompt: "Revisa mis métricas de disputas y fraude en Stripe. ¿Estoy por debajo del umbral del 0,75%? ¿Qué Radar rules debería activar?" },
        { icon: "💶", label: "SEPA vs tarjeta", prompt: "¿Cuánto podría ahorrar cambiando mis suscripciones UE de tarjeta a SEPA Direct Debit? Calcula el ahorro mensual." },
        { icon: "🔄", label: "Smart Retries config", prompt: "Explícame cómo configurar Smart Retries en Stripe Billing para recuperar el máximo MRR perdido por pagos fallidos." },
        { icon: "🏦", label: "Stripe vs Adyen", prompt: "¿Cuándo me convendría migrar de Stripe a Adyen? Analiza mi volumen actual vs el punto de inflexión de interchange++." },
        { icon: "🌍", label: "Métodos de pago por país", prompt: "¿Qué métodos de pago locales debería activar en Stripe según mis mercados principales? (iDEAL, Bancontact, giropay, etc.)" },
      ];
    } else if (r.startsWith("/admin/avatar-studio")) {
      contextActions = [
        { icon: "🗣", label: "Cómo grabar talking avatar", prompt: "Explícame paso a paso cómo grabar un talking avatar profesional." },
        { icon: "🛍", label: "Cómo grabar product avatar", prompt: "Explícame paso a paso cómo crear un video de avatar mostrando un producto." },
        { icon: "🎙", label: "Recomendar voz", prompt: "Recomiéndame la mejor voz de ElevenLabs para mi nicho. Pregúntame el nicho si no lo sabes." },
      ];
    } else {
      // Fallback genérico
      contextActions = [
        { icon: "📦", label: "Listar productos", prompt: "Lista todos los productos de la tienda principal." },
        { icon: "🛒", label: "Ver pedidos", prompt: "Muéstrame los últimos pedidos de la tienda." },
        { icon: "🔬", label: "Investigar marca", prompt: "__RESEARCH__", isResearch: true },
      ];
    }

    res.json({ actions: [...globalActions, ...contextActions], platform: platformInfo });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/status", requireAdmin, async (_req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { niche, type, minConfidence, limit = "50" } = req.query as Record<string, string>;
    let query = db.select().from(omnicoreMemoriesTable) as any;
    const conditions = [];
    if (niche) conditions.push(eq(omnicoreMemoriesTable.niche, niche));
    if (type) conditions.push(eq(omnicoreMemoriesTable.memoryType, type));
    if (minConfidence) conditions.push(gte(omnicoreMemoriesTable.confidence, parseFloat(minConfidence)));
    if (conditions.length) query = query.where(and(...conditions));
    const memories = await query.orderBy(desc(omnicoreMemoriesTable.confidence)).limit(parseInt(limit));
    res.json(memories);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/memories", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.delete("/shopybrain/memories/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    await db.delete(omnicoreMemoriesTable).where(eq(omnicoreMemoriesTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/learn", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// GET /shopybrain/catalog?gate=admin|client|public
// El catálogo único de acciones (lib/brain/catalog.ts) con en qué puertas se permite cada una.
router.get("/shopybrain/catalog", requireAdmin, (req, res): void => {
  const gate = isBrainGate(req.query.gate) ? req.query.gate : undefined;
  res.json({ gate: gate ?? null, actions: getBrainCatalog(gate) });
});

// GET /shopybrain/events/channels — canales con eventos (filtro del panel «Cerebro»).
router.get("/shopybrain/events/channels", requireAdmin, async (_req, res): Promise<void> => {
  try {
    res.json({ channels: await listBrainEventChannels() });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// GET /shopybrain/events?gate=public&channel=landing_chat&limit=50&before=1234
// Lo que ha entrado por cada puerta y qué decidió el cerebro (tabla brain_events), del más nuevo al más viejo.
router.get("/shopybrain/events", requireAdmin, async (req, res): Promise<void> => {
  try {
    const gate = req.query.gate === undefined || req.query.gate === "" ? undefined : req.query.gate;
    if (gate !== undefined && !isBrainGate(gate)) { res.status(400).json({ error: "gate no válida (admin, client o public)" }); return; }
    const channel = typeof req.query.channel === "string" && req.query.channel ? req.query.channel.slice(0, 60) : undefined;
    const limit = req.query.limit === undefined ? undefined : parseInt(String(req.query.limit), 10);
    const before = req.query.before === undefined ? undefined : parseInt(String(req.query.before), 10);
    res.json(await listBrainEvents({ gate, channel, limit: Number.isFinite(limit) ? limit : undefined, before: Number.isFinite(before) ? before : undefined }));
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/search", requireAdmin, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const { query, niche, searchType, returnRaw, systemPrompt: customSystemPrompt, conversationHistory, currentRoute, engineMode, chatSessionId, claudeModel: reqClaudeModel, gptModel: reqGptModel } = req.body;
    const engine: BrainEngineMode = (BRAIN_ENGINE_MODES as readonly string[]).includes(engineMode) ? engineMode : "auto";
    if (!query) {
      res.status(400).json({ error: "query es requerido" });
      return;
    }
  
    if (returnRaw) {
     try {
      const r = await brainRoute({
        text: String(query),
        gate: "admin",
        channel: typeof req.body.channel === "string" && /^[a-z_]{1,40}$/.test(req.body.channel) ? req.body.channel : "admin_chat",
        userId: (req.session as { userId?: string | number } | undefined)?.userId ?? null,
        projectId: req.body.activeProjectId,
        engineMode: engine,
        history: conversationHistory,
        currentRoute,
        niche,
        systemPrompt: typeof customSystemPrompt === "string" ? customSystemPrompt : undefined,
        models: { claude: reqClaudeModel, gpt: reqGptModel, nvidia: (req.body as { nvidiaModel?: string }).nvidiaModel },
        chatSessionId: typeof chatSessionId === "string" ? chatSessionId : null,
      });

      res.json({
        answer: r.text,
        source: r.engine,
        engine,
        usage: r.usage,
        entityKnowledgeUsed: r.entityKnowledgeUsed,
        potentialEntity: r.potentialEntity,
        detectedAction: r.actions[0] ?? null,
        detectedActions: r.actions.length > 1 ? r.actions : undefined,
      });
      return;
     } catch (searchErr) {
      const errStr = searchErr instanceof Error ? searchErr.message : String(searchErr);
      logger.error({ error: searchErr, query }, "ShopyBrain search error");
  
      let recoveryMsg = "Lo siento, hubo un problema procesando tu solicitud. Intenta reformular tu pregunta de forma más corta y directa.";
      if (errStr.includes("credit balance is too low") || errStr.includes("insufficient_quota")) {
        recoveryMsg = "⚠️ **Créditos de IA agotados** — La API de Claude no tiene saldo suficiente. Recarga tus créditos en console.anthropic.com para seguir chateando.";
      } else if (errStr.includes("rate_limit") || errStr.includes("Too many requests")) {
        recoveryMsg = "⏳ Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.";
      } else if (errStr.includes("overloaded")) {
        recoveryMsg = "🔄 El servicio de IA está sobrecargado temporalmente. Inténtalo en 1-2 minutos.";
      }
  
      res.status(200).json({
        answer: recoveryMsg,
        source: "error_recovery",
        detectedAction: null,
      });
      return;
     }
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
        message: `⚡ Respuesta desde Shopy Crafter (${existingMemories.length} memorias relevantes)`,
      });
      return;
    }
  
    const activeProjectId = req.body.activeProjectId;
    const researchSystemPrompt = `Eres Shopy Crafter, el megacerebro de eCommerce Shopify con acceso a todo el conocimiento acumulado de la plataforma.
  Analiza y responde con datos concretos sobre: ${searchType ?? "estrategia general"}.
  Nicho de mercado: ${niche ?? "general"}.
  Proporciona insights accionables y específicos basados en tu experiencia real con tiendas Shopify.
  Incluye datos de pricing, competencia, tendencias y estrategias probadas.`;
  
    let aiContent = "";
    try {
      if (activeProjectId) {
        aiContent = await askClaudeWithBrain(
          parseInt(activeProjectId),
          [{ role: "user", content: query }],
          researchSystemPrompt,
          "general",
          niche || undefined,
          16000
        );
      } else {
        // Sin proyecto activo: contexto global (0). Antes se usaba el proyecto 2 fijo,
        // con su ADN de marca y, si la tenía, su propia API key de Anthropic.
        aiContent = await askClaudeWithBrain(
          0,
          [{ role: "user", content: query }],
          researchSystemPrompt,
          "general",
          niche || undefined,
          16000
        );
      }
    } catch (aiErr) {
      const errStr = aiErr instanceof Error ? aiErr.message : String(aiErr);
      logger.error({ error: aiErr, query }, "ShopyBrain research AI error");
  
      let msg = "Error al procesar la investigación. Inténtalo de nuevo.";
      if (errStr.includes("credit balance is too low") || errStr.includes("insufficient_quota")) {
        msg = "⚠️ Créditos de IA agotados — Recarga en console.anthropic.com para continuar.";
      } else if (errStr.includes("rate_limit") || errStr.includes("Too many requests")) {
        msg = "⏳ Demasiadas peticiones. Espera unos segundos.";
      } else if (errStr.includes("overloaded")) {
        msg = "🔄 Servicio de IA sobrecargado temporalmente. Inténtalo en 1-2 minutos.";
      }
  
      res.json({ source: "error_recovery", confidence: 0, results: [], message: msg });
      return;
    }
  
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/insights", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/study", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { domains: requestedDomains, sessionType = "manual_trigger" } = req.body;
    const domainsToStudy = requestedDomains ?? Object.keys(DOMAIN_LABELS).slice(0, 4);
    const startTime = Date.now();
  
    enableLongRunning(res);
  
    const systemPrompt = `Eres Shopy Crafter — el MEGACEREBRO OMNISCIENTE que aprende de TODAS las disciplinas del conocimiento humano.
  Vas a realizar una sesión de estudio profundo en estos dominios: ${domainsToStudy.join(", ")}.
  
  Tu conocimiento NO tiene límites sectoriales. Absorbes sabiduría de: arte, ciencia, psicología, neurociencia, arquitectura, fotografía, cinematografía, diseño industrial, moda, tecnología, IA, behavioral economics, storytelling, música, antropología cultural, derecho, sostenibilidad, data science, y CUALQUIER disciplina que enriquezca el tema.
  
  Para cada dominio, genera 3-5 insights en formato JSON:
  {
    "insights": [
      {
        "domain": "nombre_dominio",
        "insightType": "principle|pattern|correlation|prediction|opportunity|warning",
        "title": "título corto",
        "insight": "el conocimiento específico, profundo y accionable — conectando múltiples disciplinas",
        "evidence": "qué datos, investigaciones, frameworks o ejemplos reales lo soportan",
        "confidence": 0.0-1.0,
        "impactScore": 0.0-1.0,
        "relatedDomains": ["dominio1", "dominio2"]
      }
    ],
    "summary": "resumen de la sesión",
    "keyDiscoveries": ["descubrimiento 1", "descubrimiento 2", "descubrimiento 3"]
  }
  
  Principios que guían el análisis:
  - Insights PROFUNDOS que combinan conocimiento de MÚLTIPLES disciplinas (ej: neurociencia + fotografía de producto, arquitectura + UX, psicología conductual + pricing)
  - Conexiones cross-domain NO OBVIAS que generan ventaja competitiva real
  - Datos reales, investigaciones científicas, frameworks probados de CUALQUIER campo
  - Ejemplos de las MEJORES prácticas mundiales, sin limitarse a un solo sector o mercado
  - Todo orientado a mejorar la calidad del contenido, la estrategia y la ejecución
  Responde SOLO con el JSON, sin texto adicional.`;
  
    const studyQuery = `Realiza sesión de estudio para dominios: ${domainsToStudy.join(", ")}`;
    // Contexto global (0), no el proyecto 2 fijo de antes. JSON validado: antes un fallo
    // de parseo registraba una sesión "completada" con 0 insights; ahora 502.
    const parsed = await askClaudeJsonValidated(0, studyQuery, systemPrompt, {
      schema: studySessionSchema,
      useCase: "general",
      maxTokens: 16000,
      label: "shopybrain/study",
    });

    const sessionId = randomBytes(16).toString("hex");
    let insightsCreated = 0;
  
    if (parsed.insights.length) {
      for (const insight of parsed.insights) {
        await db.insert(omnicoreInsightsTable).values({
          id: randomBytes(16).toString("hex"),
          domain: insight.domain ?? domainsToStudy[0],
          insightType: insight.insightType,
          title: insight.title,
          insight: insight.insight,
          evidence: insight.evidence ?? null,
          confidence: insight.confidence ?? 0.6,
          impactScore: insight.impactScore ?? 0.5,
          relatedDomains: insight.relatedDomains.length ? JSON.stringify(insight.relatedDomains) : null,
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
      keyDiscoveries: parsed.keyDiscoveries.length ? JSON.stringify(parsed.keyDiscoveries) : null,
      tokensUsed: JSON.stringify(parsed).length,
    });
  
    res.json({
      success: true,
      sessionId,
      insightsCreated,
      summary: parsed.summary,
      keyDiscoveries: parsed.keyDiscoveries,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/sessions", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const sessions = await db.select().from(omnicoreStudySessionsTable)
      .orderBy(desc(omnicoreStudySessionsTable.createdAt))
      .limit(20);
    res.json(sessions);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/niche-profiles", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const profiles = await db.select().from(omnicoreNicheProfilesTable)
      .orderBy(desc(omnicoreNicheProfilesTable.storesAnalyzed));
    res.json(profiles);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/niche-profiles", requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/prompt-library", requireAuth, async (_req, res): Promise<void> => {
  try {
    const prompts = await db.select().from(omnicorePromptLibraryTable)
      .orderBy(desc(omnicorePromptLibraryTable.useCount));
    res.json(prompts);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/prompt-library", requireAuth, async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ─── TRIGGERS MANUALES 24/7 ──────────────────────────────────────────────────
router.post("/shopybrain/run/micro-learning", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreMicroLearning } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "⚡ Micro-learning cycle iniciado" });
    runOmniCoreMicroLearning().catch(e => console.error("micro-learning error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/consolidation", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreMemoryConsolidation } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🧠 Memory consolidation iniciada" });
    runOmniCoreMemoryConsolidation().catch(e => console.error("consolidation error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/cross-synthesis", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreCrossConnections } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🔗 Cross-domain synthesis iniciada" });
    runOmniCoreCrossConnections().catch(e => console.error("cross-synthesis error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/daily-study", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runOmniCoreDailyDeepStudy } = await import("../lib/scheduler.js");
    res.json({ started: true, message: "🎓 Daily deep study iniciado (14 dominios)" });
    runOmniCoreDailyDeepStudy().catch(e => console.error("daily-study error:", e));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/shopybrain/run/mega-synthesis", requireAdmin, async (_req, res): Promise<void> => {
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
  try {
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
  } catch (err: any) {
    handleRouteError(res, err);
  }
});


router.post("/shopybrain/execute-action", requireAdmin, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const { action, params } = req.body ?? {};
    const out = await brainExecute({
      action: typeof action === "string" ? action : "",
      params: params && typeof params === "object" ? params : {},
      gate: "admin",
      channel: "admin_panel",
      userId: (req.session as { userId?: string | number } | undefined)?.userId ?? null,
      req,
      res,
    });
    if (out.kind === "responded") return; // la acción ya respondió
    res.status(out.status).json(out.body);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.get("/shopybrain/knowledge-graph", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const domains = await db.select().from(omnicoreKnowledgeDomainsTable)
      .orderBy(desc(omnicoreKnowledgeDomainsTable.knowledgeDepth));

    const insights = await db.select({
      id: omnicoreInsightsTable.id,
      domain: omnicoreInsightsTable.domain,
      title: omnicoreInsightsTable.title,
      confidence: omnicoreInsightsTable.confidence,
      insightType: omnicoreInsightsTable.insightType,
    }).from(omnicoreInsightsTable)
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(200);

    const connections = await db.select().from(omnicoreCrossConnectionsTable)
      .orderBy(desc(omnicoreCrossConnectionsTable.connectionStrength))
      .limit(100);

    const domainNodes = domains.map(d => ({
      id: `domain-${d.domain}`,
      type: "domain" as const,
      label: DOMAIN_LABELS[d.domain ?? ""] ?? d.domain,
      domain: d.domain,
      depth: d.knowledgeDepth ?? 0,
      totalInsights: d.totalInsights ?? 0,
    }));

    const insightNodes = insights.map(i => ({
      id: `insight-${i.id}`,
      type: "insight" as const,
      label: i.title ?? "",
      domain: i.domain,
      confidence: i.confidence ?? 0.5,
      insightType: i.insightType,
    }));

    const domainInsightEdges = insights.map(i => ({
      source: `domain-${i.domain}`,
      target: `insight-${i.id}`,
      strength: i.confidence ?? 0.5,
      type: "domain-insight" as const,
    }));

    const crossEdges = connections
      .filter(c => c.insightA && c.insightB)
      .map(c => ({
        source: `insight-${c.insightA}`,
        target: `insight-${c.insightB}`,
        strength: c.connectionStrength ?? 0.5,
        type: "cross-connection" as const,
      }));

    const allNodeIds = new Set([...domainNodes.map(n => n.id), ...insightNodes.map(n => n.id)]);
    const validCrossEdges = crossEdges.filter(e => allNodeIds.has(e.source) && allNodeIds.has(e.target));
    const validDomainEdges = domainInsightEdges.filter(e => allNodeIds.has(e.source) && allNodeIds.has(e.target));

    res.json({
      nodes: [...domainNodes, ...insightNodes],
      edges: [...validDomainEdges, ...validCrossEdges],
    });
  } catch (err) {
    logger.error({ err }, "Knowledge graph fetch failed");
    res.status(500).json({ error: "Failed to fetch knowledge graph" });
  }
});

router.post("/shopybrain/run/retroanalysis", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runRetroactiveReanalysis } = await import("../lib/scheduler.js");
    runRetroactiveReanalysis().catch(e => logger.error(e));
    res.json({ message: "Retroactive reanalysis started in background" });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/run/self-evaluation", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { runMonthlySelfEvaluation } = await import("../lib/scheduler.js");
    runMonthlySelfEvaluation().catch(e => logger.error(e));
    res.json({ message: "Monthly self-evaluation started in background" });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

router.post("/shopybrain/upload", requireAdmin, upload.array("file", 10), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: "No se recibió ningún archivo" });
      return;
    }
    const settled = await Promise.allSettled(
      files.map(async (file) => {
        const processed = await processUploadedFile(file.buffer, file.originalname, file.mimetype);
        return {
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          processed,
        };
      })
    );
    const results = settled.map((s, i) =>
      s.status === "fulfilled"
        ? { ...s.value, success: true }
        : { fileName: files[i].originalname, mimeType: files[i].mimetype, size: files[i].size, success: false, error: s.reason?.message || "Error procesando archivo" }
    );
    const successCount = results.filter(r => r.success).length;
    if (files.length === 1 && results[0].success) {
      const r = results[0] as { fileName: string; mimeType: string; size: number; processed: unknown; success: boolean };
      res.json({ success: true, fileName: r.fileName, mimeType: r.mimeType, size: r.size, processed: r.processed });
    } else {
      res.json({ success: successCount > 0, count: results.length, successCount, files: results });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GEMINI STREAM SSE ────────────────────────────────────────────────────────
// Endpoint para streaming real de Gemini hacia el chatbot admin.
// Emite eventos SSE: data: {"text":"..."} y data: {"done":true,"sources":[...]}
router.post("/shopybrain/gemini-stream", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { messages, systemPrompt, thinkingBudget = 0, useSearch = true, useProModel = false } = req.body as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      systemPrompt?: string;
      thinkingBudget?: number;
      useSearch?: boolean;
      useProModel?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages requerido" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const { askGeminiStream } = await import("../lib/gemini.js");
    const sysInstr = systemPrompt ?? "Eres Shopy Crafter, asistente experto de eCommerce Shopify. Responde SIEMPRE en español. Sé directo y accionable.";

    const generator = askGeminiStream(messages, sysInstr, { useProModel, thinkingBudget, useSearch });

    for await (const chunk of generator) {
      if (res.destroyed) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      (res as any).flush?.();
    }

    if (!res.destroyed) res.end();
  } catch (err) {
    logger.error({ err }, "[gemini-stream] Error");
    if (!res.headersSent) res.status(500).json({ error: String(err) });
    else {
      res.write(`data: ${JSON.stringify({ error: String(err), done: true })}\n\n`);
      res.end();
    }
  }
});

// ─── GEMINI IMAGEN NATIVA ─────────────────────────────────────────────────────
// Genera imágenes con el modelo nativo de imagen de Gemini.
router.post("/shopybrain/gemini-image", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { prompt, model } = req.body as { prompt?: string; model?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt requerido" });
      return;
    }

    const { askGeminiGenerateImage } = await import("../lib/gemini.js");
    const t0 = Date.now();
    const result = await askGeminiGenerateImage(prompt.trim(), model);
    const generationTimeMs = Date.now() - t0;

    res.json({
      success: true,
      b64_json: result.b64_json,
      mimeType: result.mimeType,
      model: result.model,
      generationTimeMs,
      dataUrl: `data:${result.mimeType};base64,${result.b64_json}`,
    });
  } catch (err) {
    logger.error({ err }, "[gemini-image] Error");
    handleRouteError(res, err);
  }
});

// ─── GEMINI CODE EXECUTION ────────────────────────────────────────────────────
// Activa la tool codeExecution de Gemini para análisis de datos con Python real.
router.post("/shopybrain/gemini-code", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { prompt, systemInstruction } = req.body as { prompt?: string; systemInstruction?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt requerido" });
      return;
    }

    const { askGeminiWithCode } = await import("../lib/gemini.js");
    const result = await askGeminiWithCode(prompt.trim(), systemInstruction);

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "[gemini-code] Error");
    handleRouteError(res, err);
  }
});

export default router;
