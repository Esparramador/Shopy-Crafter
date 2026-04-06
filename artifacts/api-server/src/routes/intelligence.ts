import { Router } from "express";
import { db, eventsTable, revenueSnapshotsTable, projectsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, buildShopyBrainContext, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { shopifyRequest } from "../lib/shopify.js";

// ─── INTELLIGENCE EXTRACTION ENGINE ─────────────────────────────────────────
// ShopyBrain Universal Input Extractor — takes ANY input and extracts max intelligence

async function scrapeUrl(url: string): Promise<{ html: string; title: string; description: string; keywords: string; jsonLd: string }> {
  try {
    // Normalize URL
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.5",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { html: "", title: "", description: "", keywords: "", jsonLd: "" };
    const html = await res.text();

    const title = (html.match(/<title[^>]*>([^<]{1,150})<\/title>/i) ?? [])[1]?.trim() ?? "";
    const description = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]{1,300})"/i)
      ?? html.match(/<meta[^>]*content="([^"]{1,300})"[^>]*name="description"/i) ?? [])[1]?.trim() ?? "";
    const keywords = (html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]{1,300})"/i)
      ?? html.match(/<meta[^>]*content="([^"]{1,300})"[^>]*name="keywords"/i) ?? [])[1]?.trim() ?? "";

    // Extract JSON-LD structured data
    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1].trim().slice(0, 800)).join("\n").slice(0, 2500);

    // Extract visible text content (headings, paragraphs)
    const headings = [...html.matchAll(/<h[1-3][^>]*>([^<]{3,120})<\/h[1-3]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 15).join(" | ");
    const ogTitle = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]{1,150})"/i) ?? [])[1] ?? "";
    const ogDesc = (html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]{1,300})"/i) ?? [])[1] ?? "";

    const richContent = [
      title && `Title: ${title}`,
      ogTitle && ogTitle !== title && `OG Title: ${ogTitle}`,
      description && `Description: ${description}`,
      ogDesc && ogDesc !== description && `OG Description: ${ogDesc}`,
      keywords && `Keywords: ${keywords}`,
      headings && `Headings: ${headings}`,
      jsonLdBlocks && `Structured Data: ${jsonLdBlocks}`,
    ].filter(Boolean).join("\n");

    return { html: richContent.slice(0, 4000), title, description, keywords, jsonLd: jsonLdBlocks };
  } catch {
    return { html: "", title: "", description: "", keywords: "", jsonLd: "" };
  }
}

function detectInputType(input: string): "url" | "domain" | "company" | "text" {
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return "url";
  if (/^[a-zA-Z0-9-]+\.(com|es|net|org|io|shop|store|co|eu|mx|ar|cl|pe|myshopify\.com)$/i.test(trimmed)) return "domain";
  if (trimmed.split(" ").length <= 4 && /^[A-ZÁÉÍÓÚÑ]/.test(trimmed)) return "company";
  return "text";
}

const router = Router();

// POST /api/intelligence/extract-input — ShopyBrain Universal Extractor
router.post("/intelligence/extract-input", async (req, res): Promise<void> => {
  const { input, projectId, fieldContext } = req.body as {
    input: string;
    projectId?: number;
    fieldContext?: string; // e.g., "store_name", "domain", "niche", "description", "competitor_url"
  };

  if (!input?.trim()) { res.status(400).json({ error: "input requerido" }); return; }

  const inputType = detectInputType(input.trim());
  let scrapedData = { html: "", title: "", description: "", keywords: "", jsonLd: "" };

  // Scrape if URL or domain
  if (inputType === "url" || inputType === "domain") {
    scrapedData = await scrapeUrl(input.trim());
  }

  // Also try scraping if it looks like a company + ".com"
  if (inputType === "company") {
    const guessedDomain = input.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9-]/g, "") + ".com";
    const altData = await scrapeUrl(guessedDomain);
    if (altData.title) scrapedData = altData;
  }

  const prompt = `Analiza este input y extrae TODA la inteligencia posible para potenciar esta marca/negocio al máximo.

INPUT: "${input.trim()}"
TIPO DETECTADO: ${inputType}
CONTEXTO DEL CAMPO: ${fieldContext ?? "desconocido"}
${scrapedData.html ? `\nDATA EXTRAÍDA DE WEB:\n${scrapedData.html}` : ""}

Extrae y devuelve el siguiente JSON con toda la inteligencia disponible:
{
  "entityType": "marca|producto|persona|empresa|tienda|servicio",
  "brandName": "nombre comercial identificado",
  "brandDNA": {
    "essence": "propuesta de valor central en 1 frase",
    "positioning": "cómo se posiciona en el mercado",
    "tone": "tono y voz de marca (formal/casual/premium/etc)",
    "personality": ["adjetivos de personalidad de marca"],
    "colors": ["colores detectados o sugeridos"],
    "archetype": "arquetipo de marca (Héroe/Sabio/Creator/etc)"
  },
  "market": {
    "niche": "nicho específico del negocio",
    "segment": "segmento de mercado",
    "targetAudience": "descripción detallada del cliente ideal",
    "geography": ["mercados geográficos principales"],
    "pricePoint": "budget|mid|premium|luxury",
    "competitors": ["competidores detectados o probables"]
  },
  "seo": {
    "primaryKeywords": ["keywords principales detectadas"],
    "longTailKeywords": ["long-tail keywords relevantes"],
    "contentTopics": ["temas de contenido recomendados"],
    "searchIntent": "informacional|transaccional|navegacional|comercial"
  },
  "growth": {
    "opportunities": ["3-5 oportunidades de crecimiento específicas"],
    "quickWins": ["2-3 acciones inmediatas de alto impacto"],
    "scalingStrategy": "estrategia maestra de escalado",
    "revenueLevers": ["palancas de monetización identificadas"]
  },
  "shopify": {
    "productTypes": ["tipos de productos que vende o debería vender"],
    "collectionsStrategy": "cómo organizar colecciones",
    "upsellOpportunities": ["oportunidades de upsell/cross-sell"],
    "conversionOptimizations": ["optimizaciones CRO específicas"]
  },
  "intelligence": {
    "summary": "resumen ejecutivo de 3-4 frases con el potencial de esta marca",
    "uniqueInsight": "el insight más valioso y no obvio sobre este negocio",
    "confidenceScore": 0.0,
    "dataQuality": "real|inferred|estimated"
  },
  "autofill": {
    "storeNiche": "valor para campo nicho del negocio",
    "brandTone": "valor para campo tono de marca",
    "targetAudience": "valor para campo audiencia objetivo",
    "storeMarkets": "valor para campo mercados principales",
    "projectName": "nombre de proyecto sugerido"
  }
}

Si no hay datos web disponibles, usa tu conocimiento sobre la empresa/marca. Si es desconocida, infiere del nombre e industria.
Sé específico y concreto — nada de respuestas genéricas. Este análisis debe ser tan preciso como si hubieras investigado la empresa durante 10 horas.`;

  try {
    const brainCtx = await buildShopyBrainContext(undefined, "intelligence", req.body?.input || req.body?.query || req.body?.url || "brand intelligence analysis");
    const intelligenceSystem = `${SHOPIFY_EXPERT_SYSTEM} You are a master brand intelligence analyst with deep expertise in e-commerce, digital marketing, and competitive positioning. You extract maximum strategic value from any input — URLs, brand names, company names, or text.${brainCtx}`;
    const { getClaudeClient } = await import("../lib/claude.js");
    const client = await getClaudeClient(0);
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        system: intelligenceSystem,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(180_000) }
    );
    const text = (response.content[0] as { type: string; text: string }).text;
    const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const intelligence = match ? JSON.parse(match[1] ?? match[0]) : { intelligence: { summary: text } };

    // Save to OmniCore memories (fire-and-forget)
    if (intelligence.brandName && intelligence.market?.niche) {
      learnFromOperation({
        operationType: "redesign",
        niche: intelligence.market.niche,
        title: `Perfil extraído: ${intelligence.brandName}`,
        content: `Entidad: ${intelligence.entityType}\nEsencia: ${intelligence.brandDNA?.essence ?? ""}\nPosicionamiento: ${intelligence.brandDNA?.positioning ?? ""}\nAudiencia: ${intelligence.market?.targetAudience ?? ""}\nInsight: ${intelligence.intelligence?.uniqueInsight ?? ""}`,
        confidence: intelligence.intelligence?.confidenceScore ?? 0.65,
        tags: ["brand_profile", intelligence.market?.niche ?? "", intelligence.entityType ?? ""].filter(Boolean),
      });
    }

    // If projectId provided, update project with extracted context
    if (projectId && intelligence.autofill) {
      const updates: Record<string, string> = {};
      if (intelligence.autofill.storeNiche) updates.storeNiche = intelligence.autofill.storeNiche;
      if (intelligence.autofill.brandTone) updates.brandTone = intelligence.autofill.brandTone;
      if (intelligence.autofill.targetAudience) updates.targetAudience = intelligence.autofill.targetAudience;
      if (intelligence.autofill.storeMarkets) updates.storeMarkets = intelligence.autofill.storeMarkets;
      if (Object.keys(updates).length > 0) {
        await db.update(projectsTable).set(updates as any).where(eq(projectsTable.id, projectId)).catch(() => {});
      }
    }

    res.json({
      ok: true,
      inputType,
      hasWebData: !!scrapedData.html,
      webTitle: scrapedData.title,
      intelligence,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Extraction failed" });
  }
});

// POST /api/projects/:projectId/intelligence/build-profile
// Build a comprehensive brand intelligence profile from all available project data
router.post("/projects/:projectId/intelligence/build-profile", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  let webData = { html: "", title: "", description: "", keywords: "", jsonLd: "" };
  const storeUrl = project.shopDomain
    ? (project.shopDomain.includes("://") ? project.shopDomain : `https://${project.shopDomain}`)
    : "";

  const [webDataResult, pageSpeedResult] = await Promise.allSettled([
    storeUrl ? scrapeUrl(storeUrl) : Promise.resolve(webData),
    (async () => {
      if (!storeUrl) return null;
      const { runDualPageSpeed } = await import("../lib/pagespeed.js");
      return runDualPageSpeed(storeUrl);
    })(),
  ]);

  if (webDataResult.status === "fulfilled") webData = webDataResult.value;
  const psData = pageSpeedResult.status === "fulfilled" ? pageSpeedResult.value : null;

  const pageSpeedBlock = psData?.summary
    ? `\n\n${psData.summary}\n`
    : "\n\n⚠️ PageSpeed: No se pudieron obtener datos (la URL puede no ser pública aún).\n";

  const prompt = `Construye un perfil de inteligencia de marca COMPLETO para esta tienda Shopify.

DATOS DEL PROYECTO:
Nombre: ${project.name}
Dominio: ${project.shopDomain}
Nicho: ${project.storeNiche ?? "no configurado"}
Tono: ${project.brandTone ?? "no configurado"}
Audiencia: ${project.targetAudience ?? "no configurada"}
Mercados: ${project.storeMarkets ?? "no configurados"}

${webData.html ? `DATOS SCRAPEADOS DE LA TIENDA:\n${webData.html}\n` : ""}
${pageSpeedBlock}

Genera un perfil exhaustivo con:
- Análisis de marca completo
- Posicionamiento competitivo
- Mapa de keywords SEO
- Estrategia de contenido
- Plan de escalado 90 días
- Oportunidades de revenue inmediatas
- Mejoras CRO prioritarias
- Análisis de rendimiento web (usa los datos reales de PageSpeed proporcionados)

Devuelve JSON estructurado con todos estos campos. Sé extremadamente específico y accionable.

{
  "brandProfile": { "name": "", "essence": "", "positioning": "", "uniqueValue": "", "archetype": "" },
  "competitiveIntel": { "tier": "budget|mid|premium", "mainCompetitors": [], "competitiveAdvantage": "", "gaps": [] },
  "seoStrategy": { "primaryKeywords": [], "contentCalendar": [], "quickWins": [] },
  "revenueOpportunities": [{ "opportunity": "", "estimatedImpact": "", "effort": "low|mid|high", "priority": 1 }],
  "cro90Days": [{ "week": 1, "action": "", "expectedLift": "" }],
  "brandDNA": { "tone": "", "personality": [], "colors": [], "messaging": "" },
  "performanceAnalysis": { "mobileScore": 0, "desktopScore": 0, "seoScore": 0, "coreWebVitals": {}, "criticalIssues": [], "quickWins": [] },
  "executiveSummary": ""
}`;

  try {
    const { dualAI } = await import("../lib/dual-ai.js");
    const dualResult = await dualAI(projectId, prompt, {
      mode: "gemini_research_claude_redact",
      claudeSystemPrompt: `${SHOPIFY_EXPERT_SYSTEM} You are a senior Shopify growth consultant building a complete strategic intelligence profile. Use all accumulated agency knowledge about market positioning, SEO, conversion optimization, and brand development to produce elite-level recommendations. When PageSpeed data is provided, integrate it into your analysis with specific performance recommendations.`,
      geminiUseSearch: true,
      maxTokens: 16000,
      niche: project.storeNiche ?? undefined,
      useCase: "intelligence",
    });
    const text = dualResult.final;
    const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const profile = match ? JSON.parse(match[1] ?? match[0]) : { executiveSummary: text };

    if (project.storeNiche) {
      learnFromOperation({
        operationType: "redesign",
        niche: project.storeNiche,
        title: `Brand DNA: ${project.name}`,
        content: `${profile.brandProfile?.essence ?? ""}\nPosición: ${profile.competitiveIntel?.competitiveAdvantage ?? ""}\n${profile.executiveSummary ?? ""}`,
        confidence: 0.88,
        tags: ["brand_dna", "profile", project.storeNiche, project.shopDomain].filter(Boolean),
      });
    }

    if (psData?.mobile || psData?.desktop) {
      learnFromOperation({
        operationType: "seo",
        niche: project.storeNiche ?? undefined,
        title: `PageSpeed: ${project.shopDomain}`,
        content: `Mobile: ${psData.mobile?.performanceScore ?? "N/A"}/100, Desktop: ${psData.desktop?.performanceScore ?? "N/A"}/100, SEO: ${psData.mobile?.seoScore ?? psData.desktop?.seoScore ?? "N/A"}/100. Issues: ${[...(psData.mobile?.issues ?? []), ...(psData.desktop?.issues ?? [])].slice(0, 5).join("; ")}`,
        confidence: 0.92,
        tags: ["pagespeed", "performance", project.shopDomain].filter(Boolean),
      });
    }

    res.json({
      ok: true,
      projectId,
      profile,
      pageSpeed: psData ? { mobile: psData.mobile, desktop: psData.desktop } : null,
      scrapedDomain: project.shopDomain,
      hadWebData: !!webData.html,
      dualAI: { mode: dualResult.mode, timings: dualResult.timings },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Profile build failed" });
  }
});

router.get("/intelligence/events", async (req, res): Promise<void> => {
  const { projectId, limit = "50" } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const events = await db.select().from(eventsTable)
    .where(eq(eventsTable.projectId, projectId))
    .orderBy(desc(eventsTable.createdAt))
    .limit(parseInt(limit));
  res.json(events);
});

router.post("/intelligence/events", async (req, res): Promise<void> => {
  const { projectId, eventType, productId, payload, revenueDelta } = req.body;
  if (!projectId || !eventType) { res.status(400).json({ error: "projectId and eventType required" }); return; }
  const [event] = await db.insert(eventsTable).values({
    id: randomUUID(),
    projectId,
    eventType,
    productId: productId ?? null,
    payload: payload ? JSON.stringify(payload) : null,
    revenueDelta: revenueDelta ?? null,
    attributedRevenue: revenueDelta ?? 0,
  }).returning();
  res.json(event);
});

router.get("/intelligence/snapshots", async (req, res): Promise<void> => {
  const { projectId, days = "30" } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const snapshots = await db.select().from(revenueSnapshotsTable)
    .where(eq(revenueSnapshotsTable.projectId, projectId))
    .orderBy(desc(revenueSnapshotsTable.date))
    .limit(parseInt(days));
  res.json(snapshots);
});

router.post("/intelligence/snapshots", async (req, res): Promise<void> => {
  const { projectId, date, revenue, orders, conversionRate, aov, grossMargin } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const [snap] = await db.insert(revenueSnapshotsTable).values({
    id: randomUUID(),
    projectId, date, revenue, orders, conversionRate, aov, grossMargin,
  }).returning();
  res.json(snap);
});

router.get("/intelligence/summary", async (req, res): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  const recentEvents = await db.select().from(eventsTable)
    .where(eq(eventsTable.projectId, projectId))
    .orderBy(desc(eventsTable.createdAt)).limit(20);
  const snapshots = await db.select().from(revenueSnapshotsTable)
    .where(eq(revenueSnapshotsTable.projectId, projectId))
    .orderBy(desc(revenueSnapshotsTable.date)).limit(30);

  const totalAttributed = recentEvents.reduce((s, e) => s + (e.attributedRevenue ?? 0), 0);
  const byType: Record<string, number> = {};
  recentEvents.forEach(e => { byType[e.eventType] = (byType[e.eventType] || 0) + 1; });

  res.json({
    storeName: project?.name || "Unknown",
    totalEvents: recentEvents.length,
    totalAttributedRevenue: totalAttributed,
    eventBreakdown: byType,
    recentSnapshots: snapshots.slice(0, 7),
    trend: snapshots.length >= 2
      ? ((snapshots[0]?.revenue ?? 0) - (snapshots[1]?.revenue ?? 0)) / Math.max(snapshots[1]?.revenue ?? 1, 1) * 100
      : 0,
  });
});

// ─── ON-DEMAND SHOPIFY REVENUE SYNC ────────────────────────────────────────
// Pulls real orders from Shopify for the last N days and stores as snapshots.
// Called immediately when a project is connected or on user demand.
router.post("/intelligence/sync-revenue", async (req, res): Promise<void> => {
  const { projectId, days = 90 } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (!project.accessToken) { res.status(400).json({ error: "No Shopify token — connect your store first" }); return; }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let page = 1;
    const dailyMap: Record<string, { revenue: number; orders: number; total_price_sum: number }> = {};
    let hasMore = true;
    let pageInfo: string | null = null;

    // Fetch all paid orders page by page (max 250/page)
    while (hasMore) {
      const url = pageInfo
        ? `/orders.json?status=any&financial_status=paid&limit=250&page_info=${pageInfo}`
        : `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250`;

      const data = await shopifyRequest<{
        orders: Array<{ id: number; created_at: string; total_price: string; subtotal_price: string }>;
        link?: string;
      }>(parseInt(projectId), project.shopDomain, url);

      for (const order of data.orders) {
        const date = order.created_at.split("T")[0];
        if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0, total_price_sum: 0 };
        dailyMap[date].revenue += parseFloat(order.total_price || "0");
        dailyMap[date].orders += 1;
      }

      // Shopify pagination — stop when no more pages
      hasMore = data.orders.length === 250 && page < 10;
      page++;
      pageInfo = null; // simple pagination by page count
    }

    let inserted = 0;
    for (const [date, vals] of Object.entries(dailyMap)) {
      const aov = vals.orders > 0 ? vals.revenue / vals.orders : 0;
      // Check if snapshot already exists for this date+project
      const existing = await db.select({ id: revenueSnapshotsTable.id })
        .from(revenueSnapshotsTable)
        .where(and(eq(revenueSnapshotsTable.projectId, String(projectId)), eq(revenueSnapshotsTable.date, date)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(revenueSnapshotsTable)
          .set({ revenue: vals.revenue, orders: vals.orders, aov })
          .where(eq(revenueSnapshotsTable.id, existing[0].id));
      } else {
        await db.insert(revenueSnapshotsTable).values({
          id: randomUUID(),
          projectId: String(projectId),
          date,
          revenue: vals.revenue,
          orders: vals.orders,
          aov,
        });
      }
      inserted++;
    }

    const totalRevenue = Object.values(dailyMap).reduce((s, v) => s + v.revenue, 0);
    const totalOrders = Object.values(dailyMap).reduce((s, v) => s + v.orders, 0);

    res.json({
      ok: true,
      daysLoaded: inserted,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      storeName: project.name,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Shopify sync failed" });
  }
});

router.post("/intelligence/analyze", async (req, res): Promise<void> => {
  const { projectId, timeframe = "30d" } = req.body;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  const events = await db.select().from(eventsTable)
    .where(eq(eventsTable.projectId, projectId))
    .orderBy(desc(eventsTable.createdAt)).limit(50);
  const snapshots = await db.select().from(revenueSnapshotsTable)
    .where(eq(revenueSnapshotsTable.projectId, projectId))
    .orderBy(desc(revenueSnapshotsTable.date)).limit(30);

  const prompt = `You are a Shopify revenue analyst. Analyze this data for store "${project?.name}":

Events (last 50): ${JSON.stringify(events.slice(0, 20))}
Revenue snapshots: ${JSON.stringify(snapshots.slice(0, 14))}
Timeframe: ${timeframe}

Return JSON:
{
  "topInsights": ["insight1", "insight2", "insight3"],
  "attributionBreakdown": {"seo": 30, "pricing": 25, "abTest": 20, "images": 15, "other": 10},
  "revenueImpact": {"total": 0, "byChannel": {}},
  "recommendations": [{"priority": "high", "action": "...", "impact": "..."}],
  "summary": "2-3 sentence executive summary"
}`;

  try {
    const { dualAI: dualRevenue } = await import("../lib/dual-ai.js");
    const dualResult = await dualRevenue(parseInt(projectId), prompt, {
      mode: "parallel_synthesis",
      claudeSystemPrompt: `${SHOPIFY_EXPERT_SYSTEM} You are also a revenue attribution expert and growth analyst. Identify which AI optimizations generated the most measurable revenue impact and provide specific, data-backed recommendations.`,
      geminiUseSearch: true,
      useCase: "intelligence",
      niche: project?.storeNiche ?? undefined,
    });
    const text = dualResult.final;
    const match = text.match(/\{[\s\S]*\}/);
    const analysis = match ? JSON.parse(match[0]) : { summary: text, topInsights: [], recommendations: [] };
    res.json({ analysis, projectId, analyzedAt: new Date().toISOString(), dualAI: { mode: dualResult.mode, timings: dualResult.timings } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
