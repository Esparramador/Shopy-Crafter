import { Router } from "express";
import {
  db,
  omnicoreMemoriesTable,
  omnicoreInsightsTable,
  omnicoreKnowledgeDomainsTable,
  omnicorePromptLibraryTable,
  omnicoreNicheProfilesTable,
  omnicoreCrossConnectionsTable,
  projectsTable,
} from "@workspace/db";
import { sql, count, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { shopifyRequest } from "../lib/shopify.js";
import crypto from "crypto";

const router = Router();

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|::1|\[::1\])/i;

function validateSyncUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, error: "Solo se permiten URLs http/https" };
    }
    if (BLOCKED_HOSTS.test(parsed.hostname)) {
      return { valid: false, error: "No se permiten URLs a redes internas/privadas" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "URL inválida" };
  }
}

export interface BrainImportData {
  memories?: Record<string, unknown>[];
  insights?: Record<string, unknown>[];
  domains?: Record<string, unknown>[];
  prompts?: Record<string, unknown>[];
  nicheProfiles?: Record<string, unknown>[];
  crossConnections?: Record<string, unknown>[];
  source?: string;
}

export interface BrainImportStats {
  memoriesImported: number;
  insightsImported: number;
  domainsImported: number;
  promptsImported: number;
  nicheProfilesImported: number;
  crossConnectionsImported: number;
  duplicatesSkipped: number;
  errors: number;
}

export async function importBrainData(data: BrainImportData): Promise<{ success: boolean; message: string; stats: BrainImportStats }> {
  const { memories, insights, domains, prompts, nicheProfiles, crossConnections, source } = data;
  const stats: BrainImportStats = { memoriesImported: 0, insightsImported: 0, domainsImported: 0, promptsImported: 0, nicheProfilesImported: 0, crossConnectionsImported: 0, duplicatesSkipped: 0, errors: 0 };
  const sourceLabel = source || "external-import";

  if (memories?.length) {
    for (const m of memories) {
      try {
        const id = (m.id as string) || `imp-${crypto.randomUUID()}`;
        const result = await db.insert(omnicoreMemoriesTable).values({
          id,
          memoryType: (m.memoryType || m.memory_type || m.type || "general") as string,
          niche: (m.niche as string) || null,
          subNiche: (m.subNiche || m.sub_niche || null) as string | null,
          productType: (m.productType || m.product_type || null) as string | null,
          market: (m.market as string) || "es",
          title: (m.title || m.name || "Imported memory") as string,
          content: (m.content || m.insight || m.text || JSON.stringify(m)) as string,
          confidence: (m.confidence as number) ?? 0.7,
          sourceType: `import:${sourceLabel}`,
          tags: m.tags ? (typeof m.tags === "string" ? m.tags as string : JSON.stringify(m.tags)) : null,
          isVerified: 0,
        }).onConflictDoNothing();
        if (result.rowCount && result.rowCount > 0) stats.memoriesImported++;
        else stats.duplicatesSkipped++;
      } catch { stats.errors++; }
    }
  }

  if (insights?.length) {
    for (const i of insights) {
      try {
        const id = (i.id as string) || `imp-ins-${crypto.randomUUID()}`;
        const result = await db.insert(omnicoreInsightsTable).values({
          id,
          domain: (i.domain as string) || "general",
          subDomain: (i.subDomain || i.sub_domain || null) as string | null,
          insightType: (i.insightType || i.insight_type || i.type || "imported") as string,
          title: (i.title as string) || "Imported insight",
          insight: (i.insight || i.content || i.text || JSON.stringify(i)) as string,
          evidence: (i.evidence as string) || null,
          confidence: (i.confidence as number) ?? 0.7,
          impactScore: ((i.impactScore || i.impact_score) as number) ?? 0.5,
          relatedDomains: (i.relatedDomains || i.related_domains || null) as string | null,
          source: `import:${sourceLabel}`,
        }).onConflictDoNothing();
        if (result.rowCount && result.rowCount > 0) stats.insightsImported++;
        else stats.duplicatesSkipped++;
      } catch { stats.errors++; }
    }
  }

  if (domains?.length) {
    for (const d of domains) {
      try {
        const id = (d.id as string) || `imp-dom-${crypto.randomUUID()}`;
        const result = await db.insert(omnicoreKnowledgeDomainsTable).values({
          id,
          domain: (d.domain || d.name) as string,
          knowledgeDepth: (d.knowledgeDepth || d.knowledge_depth || 0) as number,
          verifiedInsights: (d.verifiedInsights || d.verified_insights || 0) as number,
          totalInsights: (d.totalInsights || d.total_insights || 0) as number,
          specialtyPrompt: (d.specialtyPrompt || d.specialty_prompt || null) as string | null,
          corePrinciples: (d.corePrinciples || d.core_principles || null) as string | null,
          bestPractices: (d.bestPractices || d.best_practices || null) as string | null,
          commonMistakes: (d.commonMistakes || d.common_mistakes || null) as string | null,
        }).onConflictDoNothing();
        if (result.rowCount && result.rowCount > 0) stats.domainsImported++;
        else stats.duplicatesSkipped++;
      } catch { stats.errors++; }
    }
  }

  if (prompts?.length) {
    for (const p of prompts) {
      try {
        const id = (p.id as string) || `imp-pmt-${crypto.randomUUID()}`;
        const result = await db.insert(omnicorePromptLibraryTable).values({
          id,
          name: (p.name as string) || "Imported prompt",
          description: (p.description as string) || null,
          niche: (p.niche as string) || null,
          useCase: (p.useCase || p.use_case || null) as string | null,
          promptTemplate: (p.promptTemplate || p.prompt_template || p.template || p.content || "") as string,
          variables: (p.variables as string) || null,
          avgQualityScore: ((p.avgQualityScore || p.avg_quality_score) as number) ?? 0,
          createdBy: `import:${sourceLabel}`,
        }).onConflictDoNothing();
        if (result.rowCount && result.rowCount > 0) stats.promptsImported++;
        else stats.duplicatesSkipped++;
      } catch { stats.errors++; }
    }
  }

  if (nicheProfiles?.length) {
    for (const n of nicheProfiles) {
      try {
        const id = (n.id as string) || `imp-np-${crypto.randomUUID()}`;
        const result = await db.insert(omnicoreNicheProfilesTable).values({
          id,
          niche: n.niche as string,
          subNiches: (n.subNiches || n.sub_niches || null) as string | null,
          avgPriceSweetSpot: (n.avgPriceSweetSpot || n.avg_price_sweet_spot || null) as number | null,
          typicalMarginPct: (n.typicalMarginPct || n.typical_margin_pct || null) as number | null,
          topKeywords: (n.topKeywords || n.top_keywords || null) as string | null,
          toneDescription: (n.toneDescription || n.tone_description || null) as string | null,
          pricingPsychology: (n.pricingPsychology || n.pricing_psychology || null) as string | null,
        }).onConflictDoNothing();
        if (result.rowCount && result.rowCount > 0) stats.nicheProfilesImported++;
        else stats.duplicatesSkipped++;
      } catch { stats.errors++; }
    }
  }

  if (crossConnections?.length) {
    for (const c of crossConnections) {
      try {
        const id = (c.id as string) || `imp-cc-${crypto.randomUUID()}`;
        const result = await db.insert(omnicoreCrossConnectionsTable).values({
          id,
          insightA: (c.insightA || c.insight_a || "") as string,
          insightB: (c.insightB || c.insight_b || "") as string,
          connectionType: (c.connectionType || c.connection_type || null) as string | null,
          connectionStrength: ((c.connectionStrength || c.connection_strength) as number) ?? 0.5,
        }).onConflictDoNothing();
        if (result.rowCount && result.rowCount > 0) stats.crossConnectionsImported++;
        else stats.duplicatesSkipped++;
      } catch { stats.errors++; }
    }
  }

  logger.info({ stats, source: sourceLabel }, "Brain import completed");
  return { success: true, message: `✅ Importación completada desde "${sourceLabel}"`, stats };
}

export async function getBrainStats() {
  const [memCount] = await db.select({ total: count() }).from(omnicoreMemoriesTable);
  const [insCount] = await db.select({ total: count() }).from(omnicoreInsightsTable);
  const [domCount] = await db.select({ total: count() }).from(omnicoreKnowledgeDomainsTable);
  const [prmCount] = await db.select({ total: count() }).from(omnicorePromptLibraryTable);
  const [npCount] = await db.select({ total: count() }).from(omnicoreNicheProfilesTable);
  const [ccCount] = await db.select({ total: count() }).from(omnicoreCrossConnectionsTable);

  const memorySources = await db
    .select({ source: omnicoreMemoriesTable.sourceType, total: count() })
    .from(omnicoreMemoriesTable)
    .groupBy(omnicoreMemoriesTable.sourceType);

  const insightDomains = await db
    .select({ domain: omnicoreInsightsTable.domain, total: count() })
    .from(omnicoreInsightsTable)
    .groupBy(omnicoreInsightsTable.domain);

  return {
    totalMemories: memCount?.total ?? 0,
    totalInsights: insCount?.total ?? 0,
    totalDomains: domCount?.total ?? 0,
    totalPrompts: prmCount?.total ?? 0,
    totalNicheProfiles: npCount?.total ?? 0,
    totalCrossConnections: ccCount?.total ?? 0,
    memorySources: Object.fromEntries(memorySources.map((s) => [s.source, s.total])),
    insightsByDomain: Object.fromEntries(insightDomains.map((d) => [d.domain, d.total])),
  };
}

export async function getExportData(options?: { domain?: string; page?: number; limit?: number }) {
  const domain = options?.domain;
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 500, 2000);
  const offset = (page - 1) * limit;

  let memoriesQuery = db.select().from(omnicoreMemoriesTable);
  let insightsQuery = db.select().from(omnicoreInsightsTable);

  if (domain) {
    memoriesQuery = memoriesQuery.where(sql`${omnicoreMemoriesTable.memoryType} = ${domain} OR ${omnicoreMemoriesTable.niche} = ${domain}`) as typeof memoriesQuery;
    insightsQuery = insightsQuery.where(sql`${omnicoreInsightsTable.domain} = ${domain}`) as typeof insightsQuery;
  }

  const [memories, insights, domains, prompts, nicheProfiles, crossConnections] = await Promise.all([
    memoriesQuery.limit(limit).offset(offset),
    insightsQuery.limit(limit).offset(offset),
    db.select().from(omnicoreKnowledgeDomainsTable),
    db.select().from(omnicorePromptLibraryTable),
    db.select().from(omnicoreNicheProfilesTable),
    db.select().from(omnicoreCrossConnectionsTable).limit(500),
  ]);

  const [memCount] = await db.select({ total: count() }).from(omnicoreMemoriesTable);
  const [insCount] = await db.select({ total: count() }).from(omnicoreInsightsTable);

  return {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    source: "ShopyBrain OmniCore",
    stats: {
      totalMemories: memCount?.total ?? 0,
      totalInsights: insCount?.total ?? 0,
      totalDomains: domains.length,
      totalPrompts: prompts.length,
      totalNicheProfiles: nicheProfiles.length,
      totalCrossConnections: crossConnections.length,
      page,
      limit,
      hasMore: memories.length === limit || insights.length === limit,
    },
    memories,
    insights,
    domains,
    prompts,
    nicheProfiles,
    crossConnections,
  };
}

export async function syncFromExternalBrain(url: string, apiKey?: string, sourceLabel?: string) {
  const validation = validateSyncUrl(url);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const endpoints = [
    "/api/brain/export/knowledge",
    "/api/admin/brain-export/knowledge",
  ];

  let fetchedData: Record<string, unknown> | null = null;
  const triedPaths: string[] = [];
  const errors: string[] = [];

  for (const ep of endpoints) {
    try {
      const fullUrl = `${url.replace(/\/+$/, "")}${ep}?limit=2000`;
      triedPaths.push(fullUrl);
      const resp = await fetch(fullUrl, { headers });
      if (resp.ok) {
        fetchedData = await resp.json() as Record<string, unknown>;
        break;
      }
    } catch (err) {
      errors.push(`${ep}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!fetchedData) {
    return {
      success: false,
      error: `No se pudo conectar con el cerebro externo. Endpoints intentados:\n${triedPaths.join("\n")}`,
      errors,
    };
  }

  const memories = (fetchedData.memories || fetchedData.entries || fetchedData.knowledge || []) as Record<string, unknown>[];
  const insights = (fetchedData.insights || []) as Record<string, unknown>[];
  const domains = (fetchedData.domains || []) as Record<string, unknown>[];
  const prompts = (fetchedData.prompts || []) as Record<string, unknown>[];
  const src = sourceLabel || `sync:${new URL(url).hostname}`;

  const page1Result = await importBrainData({ memories, insights, domains, prompts, source: src });

  let totalPages = 1;
  const stats = fetchedData.stats as Record<string, unknown> | undefined;
  if (stats?.hasMore) {
    let page = 2;
    const limit = (stats.limit as number) || 500;
    while (page <= 200) {
      try {
        const pageUrl = `${url.replace(/\/+$/, "")}${endpoints[0]}?page=${page}&limit=${limit}`;
        const pageResp = await fetch(pageUrl, { headers });
        if (!pageResp.ok) break;
        const pageData = await pageResp.json() as Record<string, unknown>;
        const pageMems = (pageData.memories || pageData.entries || []) as Record<string, unknown>[];
        const pageIns = (pageData.insights || []) as Record<string, unknown>[];
        if (!pageMems.length && !pageIns.length) break;

        const pageResult = await importBrainData({ memories: pageMems, insights: pageIns, source: src });
        page1Result.stats.memoriesImported += pageResult.stats.memoriesImported;
        page1Result.stats.insightsImported += pageResult.stats.insightsImported;
        page1Result.stats.duplicatesSkipped += pageResult.stats.duplicatesSkipped;
        totalPages = page;

        const pageStats = (pageData.stats as Record<string, unknown>) || {};
        if (!pageStats.hasMore) break;
        page++;
      } catch { break; }
    }
  }

  return {
    success: true,
    message: `✅ Sincronización completada desde ${url}`,
    totalPages,
    stats: page1Result.stats,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ─── HTTP ROUTES ───────────────────────────────────────────────────────────────

router.get("/admin/brain-export/knowledge", async (req, res) => {
  try {
    const domain = req.query.domain as string | undefined;
    const format = (req.query.format as string) || "json";
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);

    const exportData = await getExportData({ domain, page, limit });

    if (format === "ndjson") {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="shopybrain-export-${Date.now()}.ndjson"`);
      const allEntries = [
        ...exportData.memories.map((m) => ({ type: "memory", ...m })),
        ...exportData.insights.map((i) => ({ type: "insight", ...i })),
        ...exportData.domains.map((d) => ({ type: "domain", ...d })),
        ...exportData.prompts.map((p) => ({ type: "prompt", ...p })),
        ...exportData.nicheProfiles.map((n) => ({ type: "niche_profile", ...n })),
        ...exportData.crossConnections.map((c) => ({ type: "cross_connection", ...c })),
      ];
      res.send(allEntries.map((e) => JSON.stringify(e)).join("\n"));
      return;
    }

    res.json(exportData);
  } catch (err) {
    logger.error({ err }, "Brain export failed");
    res.status(500).json({ error: "Error exportando conocimiento", details: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/admin/brain-export/domains", async (_req, res) => {
  try {
    const allDomains = await db.select().from(omnicoreKnowledgeDomainsTable);
    const insightCounts = await db
      .select({ domain: omnicoreInsightsTable.domain, total: count() })
      .from(omnicoreInsightsTable)
      .groupBy(omnicoreInsightsTable.domain);

    const memoryCounts = await db
      .select({ memoryType: omnicoreMemoriesTable.memoryType, total: count() })
      .from(omnicoreMemoriesTable)
      .groupBy(omnicoreMemoriesTable.memoryType);

    const insightMap = Object.fromEntries(insightCounts.map((i) => [i.domain, i.total]));
    const memoryMap = Object.fromEntries(memoryCounts.map((m) => [m.memoryType, m.total]));

    res.json({
      totalDomains: allDomains.length,
      totalInsights: insightCounts.reduce((s, i) => s + i.total, 0),
      totalMemories: memoryCounts.reduce((s, m) => s + m.total, 0),
      domains: allDomains.map((d) => ({
        ...d,
        insightCount: insightMap[d.domain] ?? 0,
        memoryCount: memoryMap[d.domain] ?? 0,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Brain domain export failed");
    res.status(500).json({ error: "Error exportando dominios" });
  }
});

router.get("/admin/brain-export/prompts", async (_req, res) => {
  try {
    const prompts = await db.select().from(omnicorePromptLibraryTable);
    const allDomains = await db.select().from(omnicoreKnowledgeDomainsTable);

    res.json({
      totalPrompts: prompts.length,
      prompts,
      domainSpecialties: allDomains.map((d) => ({
        domain: d.domain,
        specialtyPrompt: d.specialtyPrompt,
        corePrinciples: d.corePrinciples,
        bestPractices: d.bestPractices,
        commonMistakes: d.commonMistakes,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Brain prompts export failed");
    res.status(500).json({ error: "Error exportando prompts" });
  }
});

router.post("/admin/brain-import", async (req, res) => {
  try {
    const result = await importBrainData(req.body);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Brain import failed");
    res.status(500).json({ error: "Error importando conocimiento", details: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/admin/brain-import/ndjson", async (req, res) => {
  try {
    const source = (req.query.source as string) || "ndjson-import";
    let ndjsonText = "";
    if (typeof req.body === "string") ndjsonText = req.body;
    else if (req.body?.ndjson) ndjsonText = req.body.ndjson;
    else ndjsonText = JSON.stringify(req.body);

    const lines = ndjsonText.trim().split("\n").filter((l: string) => l.trim());
    const entries: BrainImportData = { memories: [], insights: [], domains: [], prompts: [], nicheProfiles: [], crossConnections: [], source };

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const type = obj.type || obj.entryType || "memory";
        delete obj.type;
        delete obj.entryType;

        if (type === "memory" || type === "memories") entries.memories!.push(obj);
        else if (type === "insight" || type === "insights") entries.insights!.push(obj);
        else if (type === "domain" || type === "domains") entries.domains!.push(obj);
        else if (type === "prompt" || type === "prompts") entries.prompts!.push(obj);
        else if (type === "niche_profile") entries.nicheProfiles!.push(obj);
        else if (type === "cross_connection") entries.crossConnections!.push(obj);
        else entries.memories!.push({ ...obj, memoryType: type });
      } catch { /* skip malformed */ }
    }

    const result = await importBrainData(entries);
    res.json({ ...result, linesProcessed: lines.length });
  } catch (err) {
    logger.error({ err }, "NDJSON brain import failed");
    res.status(500).json({ error: "Error importando NDJSON" });
  }
});

router.post("/admin/brain-sync", async (req, res) => {
  try {
    const { url, apiKey, source } = req.body;
    if (!url) {
      res.status(400).json({ error: "URL requerida" });
      return;
    }
    const result = await syncFromExternalBrain(url, apiKey, source);
    if (!result.success) {
      res.status(502).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Brain sync failed");
    res.status(500).json({ error: "Error sincronizando cerebro", details: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/admin/brain-stats", async (_req, res) => {
  try {
    const stats = await getBrainStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "Brain stats failed");
    res.status(500).json({ error: "Error obteniendo estadísticas del cerebro" });
  }
});

function buildPlatformSelfKnowledge(): { insights: Record<string, unknown>[]; memories: Record<string, unknown>[] } {
  const insights: Record<string, unknown>[] = [
    {
      id: "self-platform-overview",
      domain: "platform_identity",
      insightType: "self_knowledge",
      title: "Shopy Crafter — Identidad y Misión",
      insight: "Shopy Crafter (shopycrafter.com) es una agencia de optimización Shopify 100% autónoma impulsada por ShopyBrain, un motor de IA dual (Claude + Gemini) con 46,000+ insights acumulados. Nombre público: 'Shopy Crafter'. Motor IA interno: 'ShopyBrain'. Propietario/admin: craftershopy@gmail.com. Email de comunicación: craftershopy@gmail.com. La plataforma gestiona, optimiza y potencia tiendas Shopify de manera completamente autónoma con 6 motores de IA especializados. Tienda demo: comic-crafter.myshopify.com.",
      confidence: 0.99,
      impactScore: 1.0,
    },
    {
      id: "self-6-engines",
      domain: "platform_identity",
      insightType: "self_knowledge",
      title: "Los 6 Motores de IA de Shopy Crafter",
      insight: "M01 Generación de Imágenes: 8 tipos (hero, lifestyle, detalle, packaging, ugc, escala, bundle, infografía) usando Replicate flux-1.1-pro y recraft-v3, ~€0.25/producto. M02 Consistencia Visual: StyleLock + Visual DNA para coherencia de marca en cada imagen. M03 A/B Testing Automático: pixel tracker propio, z-test 95% confianza, declaración automática de ganador. M04 Auto-Pilot 24/7: webhook triggers, auditoría inmediata, generación automática sin intervención. M05 Pricing Financiero: motor COGS completo, competencia en tiempo real, economista IA, dashboard P&L. M06 SEO Técnico: Schema JSON-LD, meta tags por Claude, sitemap dinámico, Core Web Vitals, blog posts IA.",
      confidence: 0.99,
      impactScore: 1.0,
    },
    {
      id: "self-pricing-photoshoot",
      domain: "platform_pricing",
      insightType: "self_knowledge",
      title: "Plan Photoshoot Pro — €497 pago único",
      insight: "Photoshoot Pro (€497 pago único, sin retainer): 120 imágenes IA (4 variantes × 30 SKUs), consistencia visual con guía de marca, iluminación cinematográfica 5:1 Rembrandt, semantic SEO audit de 30 fichas, 1 sesión de pricing financiero, entrega en 7 días laborables, soporte email 30 días. NO incluye A/B testing, auto-pilot ni acceso a futuros motores.",
      confidence: 0.99,
      impactScore: 0.95,
    },
    {
      id: "self-pricing-growth",
      domain: "platform_pricing",
      insightType: "self_knowledge",
      title: "Plan Growth Studio — €297/mes + €197 setup",
      insight: "Growth Studio (€297/mes + €197 setup único): imágenes ilimitadas, consistencia visual automática, A/B testing visual 3 productos simultáneos, pricing financiero con elasticidad, SEO técnico 100 URLs/mes, auto-pilot básico (ganadores A/B), dashboard analytics multicanal, soporte email/chat <24h, integraciones Shopify/GA/Meta Pixel. NO incluye A/B ilimitado, custom AI training ni soporte dedicado. Prueba gratuita de 14 días.",
      confidence: 0.99,
      impactScore: 0.95,
    },
    {
      id: "self-pricing-performance",
      domain: "platform_pricing",
      insightType: "self_knowledge",
      title: "Plan Performance Lab — €797/mes + €397 setup (MÁS POPULAR)",
      insight: "Performance Lab (€797/mes + €397 setup, MÁS POPULAR): todo de Growth Studio + A/B testing visual ilimitado, auto-pilot avanzado 24/7 cross-producto, pricing predictivo con simulación, SEO ilimitado con crawling automático, recomendaciones semantic search, Algorithmic Schema Augmentation, custom AI fine-tuning, soporte prioritario chat/videollamada <4h, sesión mensual estrategia 60 min, acceso anticipado nuevos motores. NO incluye account manager dedicado.",
      confidence: 0.99,
      impactScore: 0.95,
    },
    {
      id: "self-pricing-enterprise",
      domain: "platform_pricing",
      insightType: "self_knowledge",
      title: "Plan Enterprise Omnicore — desde €2,497/mes",
      insight: "Enterprise Omnicore (€personalizado, desde €2,497/mes, setup incluido): todo de Performance Lab + account manager con SLA, custom AI development, infraestructura dedicada no multi-tenant, API privada con webhooks, integración ERPs/PIMs, white-label completo, SSO enterprise (SAML/OAuth/AD), compliance GDPR/SOC2/ISO 27001, soporte 24/7 respuesta <1h, sesiones estratégicas semanales + QBRs, training ilimitado, features custom bajo demanda.",
      confidence: 0.99,
      impactScore: 0.95,
    },
    {
      id: "self-calculator-services",
      domain: "platform_pricing",
      insightType: "self_knowledge",
      title: "Servicios à la carte — Calculadora de precios",
      insight: "Servicios pago único: Auditoría Completa €197/ud, Rediseño IA hasta 30 productos €147/ud, Pack 30 Imágenes IA €89/ud, Informe Precios y Márgenes €97/ud, Optimización SEO Completa €147/ud, Informe Competidores €97/ud, Investigación Proveedores €97/ud, Setup Email Marketing €197/ud, Informe Proyección Ventas €127/ud. Suscripciones mensuales: Mantenimiento Básico €49/mes, Gestión Activa €149/mes, Premium Ilimitado €399/mes.",
      confidence: 0.99,
      impactScore: 0.9,
    },
    {
      id: "self-79-chatbot-actions",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "79 Acciones del Chatbot ShopyBrain",
      insight: "ShopyBrain tiene 79 acciones organizadas en categorías: SHOPIFY (store_status, list_products, create_product, edit_product, change_price, set_product_status, scan_store, regenerate_token, get_scopes, delete_product, search_product, publish_product, get_orders, search_suppliers, modify_audit_filter, setup_full_store, list_all_products). SEO (optimize_product, optimize_all_products, optimize_images, seo_full_audit, keyword_intelligence, blog_strategy, generate_blog_post, generate_schemas, generate_all_metas, fix_all_alt_texts, audit_page_speed, generate_sitemap, redesign_product). COLLECTIONS/PAGES (create_collection, list_collections, auto_collections, create_page, list_pages, design_all_pages). THEME (list_themes, list_theme_files, read_theme_file, edit_theme_file, create_theme_section, audit_theme, edit_theme_css, edit_theme_settings). FINANCIAL (generate_competitive_pricing, scan_competitor, analyze_competitor_product, calculate_optimal_price, estimate_cogs, price_simulator, financial_forecast, financial_dashboard, agency_quote, agency_proposal). IMAGES (generate_product_images, bulk_generate_images, apply_redesign). MARKETING (generate_email_flow, generate_email, inventory_sync, inventory_alerts). BRAIN (brain_sync, brain_stats, brain_export, bulk_redesign, create_ab_test, list_ab_tests, declare_winner). INTERNAL (diagnose_app, inspect_code, fix_code, list_source_files, analyze_component, read_cms, update_cms, update_cms_batch, reset_cms, audit_app_offerings, modify_ui).",
      confidence: 0.99,
      impactScore: 1.0,
    },
    {
      id: "self-tech-stack",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Stack Tecnológico de Shopy Crafter",
      insight: "Arquitectura: pnpm monorepo TypeScript/Node.js 24. Frontend: React + Vite (dark theme gold/black/jade). Backend: Express API. DB: PostgreSQL + Drizzle ORM (42+ tablas). IA Dual: Claude (claude-sonnet-4-5) para copywriting/análisis + Gemini con Google Search grounding para research de mercado. Imágenes: Replicate (flux-1.1-pro, recraft-v3). Email: Gmail integration + Klaviyo. Seguridad: AES-256-GCM, bcrypt, rate limiting, CORS, audit logging. OmniCore Brain: 46,000+ insights, 5 expert prompts, learning loop continuo con 12 cron jobs. SEO: 16 criterios Semrush-level. Reportes PDF: PDFKit dark theme 17 páginas.",
      confidence: 0.99,
      impactScore: 0.9,
    },
    {
      id: "self-unique-differentiators",
      domain: "platform_identity",
      insightType: "self_knowledge",
      title: "Diferenciadores Únicos de Shopy Crafter",
      insight: "1) SINGLE BRAIN: Un solo cerebro OmniCore centralizado — todas las llamadas IA pasan por él, inyectando contexto acumulado. 2) DUAL AI ENGINE: Claude + Gemini en paralelo con síntesis para output superior. 3) LEARNING LOOP: Cada operación enseña al sistema via learnFromOperation(), mejorando con cada uso. 4) 100/100 QUALITY STANDARD: Descripciones 800-1200 palabras, SEO Semrush-level, 16 criterios. 5) GOOGLE SEARCH GROUNDING: Precios reales de competidores via Gemini. 6) SELF-HEALING: El chatbot puede inspeccionar, diagnosticar y corregir su propio código. 7) VISUAL DNA: Consistencia de marca automática en todas las generaciones. 8) 79 ACCIONES: Desde crear productos hasta editar temas Liquid y generar flujos email. 9) FACTURACIÓN SHOPIFY: Sin Stripe, billing directo vía Shopify. 10) MULTI-TENANT: Admin + clientes con portales separados y permisos granulares.",
      confidence: 0.99,
      impactScore: 1.0,
    },
    {
      id: "self-security-compliance",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Seguridad y Compliance de Shopy Crafter",
      insight: "Encriptación AES-256-GCM para todas las credenciales. Contraseñas bcrypt. Rate limiting por endpoint en base de datos. Audit logging completo. Admin route protection con sessions. CORS configurado. SVG sanitization. PostMessage origin validation. HTML escaping XSS-safe. ErrorBoundary global en frontend. Claude API concurrency queues con exponential backoff. RGPD compliant. Datos en Europa.",
      confidence: 0.95,
      impactScore: 0.85,
    },
    {
      id: "self-client-flow",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Flujo de Clientes en Shopy Crafter",
      insight: "Los clientes acceden via invitación tokenizada (/invite/:token). No hay registro público. El admin crea el cliente en el CRM, genera un token de invitación, el cliente accede y ve su portal read-only con: Dashboard KPI, Productos, Aprobaciones, Mensajes, Reportes. El admin gestiona múltiples tiendas y clientes desde un panel centralizado. Las leads llegan por el formulario de contacto del landing, que genera automáticamente un pre-report IA via Gemini con análisis de negocio, mercado y competencia.",
      confidence: 0.95,
      impactScore: 0.85,
    },
    {
      id: "self-cron-automation",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "12 Cron Jobs de Automatización",
      insight: "ShopyBrain ejecuta 12 tareas programadas: micro-learning cycles (genera insights cruzando dominios), memory consolidation (fusiona memorias similares), knowledge domain depth updates, niche profile enrichment, cross-connection discovery, auto-pilot webhooks, A/B test monitoring, inventory alerts, SEO crawling, competitor price monitoring, revenue sync, y brain health checks. Todo ejecutado de forma no-bloqueante en background.",
      confidence: 0.95,
      impactScore: 0.85,
    },
    {
      id: "self-export-reports",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Sistema Universal de Exportación y Reportes",
      insight: "Exportaciones disponibles: Informe Comercial PDF 17 páginas dark theme (PDFKit), Complete Report HTML 9 páginas paginado (executive summary, brand identity, SEO audit real-time, financial/COGS, sales analysis, A/B testing + price optimization, AI economist analysis, strategic recommendations, product catalog), AI Deep Analysis Report (Claude 8192 tokens, 9 secciones), XLSX workbooks (ExcelJS), ZIP bundles (Archiver). Todos los reportes usan scoring unificado y datos reales — nunca mocked.",
      confidence: 0.95,
      impactScore: 0.85,
    },
    {
      id: "self-how-it-works",
      domain: "platform_identity",
      insightType: "self_knowledge",
      title: "Cómo funciona Shopy Crafter — 4 pasos",
      insight: "Paso 1: Conecta tu tienda Shopify — introduce dominio y Access Token, la plataforma escanea catálogo, configuración y métricas. Paso 2: La IA audita cada producto — Claude analiza título, descripción, precio, imágenes y SEO, asigna nota A-F y genera mejoras priorizadas con impacto estimado. Paso 3: Activa los 6 motores — generan imágenes, optimizan precios, aplican SEO, inician A/B tests y configuran automatizaciones. Paso 4: Resultados compuestos cada semana — el sistema mejora solo, cada test genera el siguiente, cada precio se monitoriza.",
      confidence: 0.99,
      impactScore: 0.9,
    },
    {
      id: "self-seo-methodology",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Metodología SEO Semrush-Level de 16 Criterios",
      insight: "Shopy Crafter audita SEO con 16 criterios ponderados: meta title (length, keywords), meta description (length, call-to-action), H1 tag, URL handle optimization, image alt texts, product description length (800+ words), keyword consistency (title→body→tags), keyword density 1.5-2.5%, keyword prominence (first paragraph), LSI/semantic keywords (5-8), readability (15-25 word sentences), structured data (Product/FAQ schema), FAQ optimization, social meta (OG/Twitter), internal linking, content freshness. Scoring promedio ponderado con baseline 60 para schema.",
      confidence: 0.99,
      impactScore: 0.9,
    },
    {
      id: "self-image-generation",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Pipeline de Generación de Imágenes IA",
      insight: "8 tipos de imagen por producto (plan agency_pro+): hero (producto principal), lifestyle (contexto de uso), detail (close-up), packaging (empaque), ugc (user-generated style), scale (escala/dimensiones), process (fabricación/materiales), variant (variaciones color/tamaño). Usa Replicate flux-1.1-pro para fotorealismo y recraft-v3 para estilo. Coste ~€0.25/producto. Motor de iluminación cinematográfica con ratio 5:1 Rembrandt. Visual DNA asegura consistencia de marca en todas las generaciones. Bulk generation disponible para catálogos completos.",
      confidence: 0.99,
      impactScore: 0.9,
    },
    {
      id: "self-financial-engine",
      domain: "platform_capabilities",
      insightType: "self_knowledge",
      title: "Motor Financiero y Pricing Intelligence",
      insight: "Motor COGS completo con estimación IA, análisis de elasticidad precio-demanda, pricing psicológico (charm pricing, anchoring, premium positioning), comparación competitiva en tiempo real via Google Search grounding (Gemini), simulador de escenarios precio-volumen-margen, forecast financiero 3-6 meses, dashboard P&L en vivo, alertas de margen crítico. El AI Economist genera: market positioning, margin waterfall, catalog health, top/bottom products, bundle/upsell suggestions, revenue projections.",
      confidence: 0.99,
      impactScore: 0.9,
    },
  ];

  const memories: Record<string, unknown>[] = [
    {
      id: "self-mem-identity",
      memoryType: "general",
      title: "Identidad de Shopy Crafter",
      content: "Soy ShopyBrain, el motor de IA de Shopy Crafter (shopycrafter.com). Shopy Crafter es una agencia independiente de optimización IA para tiendas Shopify, que opera 24/7. Mis 6 motores cubren imágenes, consistencia visual, A/B testing, auto-pilot, pricing financiero y SEO técnico. Tengo 79 acciones disponibles y 46,000+ insights acumulados. Mi propietario es craftershopy@gmail.com y me comunico desde craftershopy@gmail.com. NOTA: Shopy Crafter NO es Shopify Inc. ni está afiliada a Shopify. Somos un servicio independiente que optimiza tiendas en la plataforma Shopify.",
      confidence: 0.99,
      niche: null,
    },
    {
      id: "self-mem-pricing",
      memoryType: "pricing_pattern",
      title: "Planes y Precios de Shopy Crafter",
      content: "Planes: Photoshoot Pro €497 (pago único, 120 imgs + SEO audit + pricing session), Growth Studio €297/mes (+€197 setup, imgs ilimitadas + A/B 3 productos + SEO 100 URLs), Performance Lab €797/mes (+€397 setup, MÁS POPULAR, todo ilimitado + AI fine-tuning + soporte prioritario), Enterprise Omnicore desde €2,497/mes (dedicado, white-label, SLA, custom AI). Servicios à la carte desde €89 (imágenes) hasta €197 (auditoría/email). Facturación vía Shopify, no Stripe.",
      confidence: 0.99,
      niche: null,
    },
    {
      id: "self-mem-capabilities",
      memoryType: "general",
      title: "Capacidades Completas de ShopyBrain",
      content: "Puedo: crear/editar/eliminar productos Shopify, generar imágenes IA (8 tipos), auditar SEO (16 criterios Semrush), optimizar precios con datos reales de competencia, crear A/B tests, generar schemas JSON-LD, escribir blogs SEO 1500+ palabras, diseñar páginas y colecciones, generar flujos email Klaviyo, investigar proveedores, generar presupuestos y propuestas, editar temas Liquid/CSS, diagnosticar y corregir mi propio código, y más. Todo con aprendizaje retroactivo — cada operación me hace más inteligente.",
      confidence: 0.99,
      niche: null,
    },
    {
      id: "self-mem-differentiators",
      memoryType: "general",
      title: "Por qué Shopy Crafter es diferente",
      content: "Diferenciadores: 1) Un solo cerebro OmniCore con 46K+ insights. 2) IA dual Claude+Gemini con síntesis. 3) Learning loop retroactivo. 4) Calidad 100/100 con SEO Semrush-level. 5) Precios reales de competidores via Google Search. 6) Auto-healing del propio código. 7) Visual DNA para consistencia de marca. 8) 79 acciones automatizadas. 9) Facturación Shopify nativa. 10) Multi-tenant admin+clientes. Sin tarjeta de crédito, setup en 5 minutos, cancela cuando quieras, RGPD compliant.",
      confidence: 0.99,
      niche: null,
    },
  ];

  return { insights, memories };
}

router.post("/admin/create-shopify-services", async (req, res) => {
  try {
    const projectId = parseInt(String(req.body.projectId || "2"));
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const serviceProducts = [
      {
        title: "Shopy Crafter — Photoshoot Pro (Pago Único)",
        body_html: `<h2>Photoshoot Pro — €497</h2><p>Paquete completo de imágenes profesionales con IA para tu tienda Shopify.</p><ul><li>Generación de 120 imágenes de producto con IA (4 variantes x 30 SKUs)</li><li>Consistencia visual automática aplicando tu guía de marca</li><li>Motor de iluminación cinematográfica (5:1 Rembrandt ratio)</li><li>Semantic SEO audit de 30 fichas de producto</li><li>1 sesión estratégica de pricing financiero</li><li>Entrega en 7 días laborables</li><li>Soporte por email durante 30 días post-entrega</li></ul>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, photoshoot-pro, pago-unico, imagenes-ia",
        status: "active",
        variants: [{ title: "Photoshoot Pro", price: "497.00", requires_shipping: false, taxable: true, sku: "sc-photoshoot-pro" }],
      },
      {
        title: "Shopy Crafter — Growth Studio (Mensual)",
        body_html: `<h2>Growth Studio — €297/mes</h2><p>Suscripción mensual de optimización Shopify con IA. Setup único €197.</p><ul><li>Generación ilimitada de imágenes de producto con IA</li><li>Consistencia visual automática (brand guidelines encoding)</li><li>A/B testing visual automático en 3 productos simultáneos</li><li>Motor de pricing financiero: elasticidad precio-demanda</li><li>SEO técnico automático para hasta 100 URLs/mes</li><li>Auto-pilot básico: ejecución automática de ganadores A/B</li><li>Dashboard analytics con atribución multicanal</li><li>Soporte por email y chat (respuesta &lt;24h)</li></ul>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, growth-studio, suscripcion, mensual",
        status: "active",
        options: [{ name: "Tipo" }],
        variants: [
          { title: "Mensual", option1: "Mensual", price: "297.00", requires_shipping: false, taxable: true, sku: "sc-growth-monthly" },
          { title: "Setup Único", option1: "Setup Único", price: "197.00", requires_shipping: false, taxable: true, sku: "sc-growth-setup" },
        ],
      },
      {
        title: "Shopy Crafter — Performance Lab (Mensual)",
        body_html: `<h2>Performance Lab — €797/mes (MÁS POPULAR)</h2><p>Optimización Shopify completa con IA avanzada. Setup único €397.</p><ul><li>Todo lo incluido en Growth Studio</li><li>A/B testing visual ilimitado</li><li>Auto-pilot avanzado: optimización 24/7 cross-producto</li><li>Pricing financiero predictivo con simulación de escenarios</li><li>SEO técnico automático ilimitado</li><li>Custom AI model fine-tuning con tus datos</li><li>Soporte prioritario por chat y videollamada (&lt;4h)</li><li>Sesión mensual de estrategia (60 min)</li></ul>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, performance-lab, suscripcion, mensual, popular",
        status: "active",
        options: [{ name: "Tipo" }],
        variants: [
          { title: "Mensual", option1: "Mensual", price: "797.00", requires_shipping: false, taxable: true, sku: "sc-performance-monthly" },
          { title: "Setup Único", option1: "Setup Único", price: "397.00", requires_shipping: false, taxable: true, sku: "sc-performance-setup" },
        ],
      },
      {
        title: "Shopy Crafter — Auditoría Completa",
        body_html: `<h2>Auditoría Completa — €197</h2><p>Análisis exhaustivo de tu tienda Shopify: productos, SEO, COGS y plan de acción personalizado.</p>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, auditoria, pago-unico",
        status: "active",
        variants: [{ title: "Auditoría Completa", price: "197.00", requires_shipping: false, taxable: true, sku: "sc-audit" }],
      },
      {
        title: "Shopy Crafter — Rediseño IA (30 Productos)",
        body_html: `<h2>Rediseño IA — €147</h2><p>Títulos, descripciones y SEO optimizados con IA profesional para hasta 30 productos.</p>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, rediseno, ia, pago-unico",
        status: "active",
        variants: [{ title: "Rediseño IA 30 productos", price: "147.00", requires_shipping: false, taxable: true, sku: "sc-redesign-30" }],
      },
      {
        title: "Shopy Crafter — Pack 30 Imágenes IA",
        body_html: `<h2>Pack 30 Imágenes IA — €89</h2><p>Fotos profesionales de producto generadas con IA (Hero, Lifestyle, Detalle) para 30 productos.</p>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, imagenes, ia, pago-unico",
        status: "active",
        variants: [{ title: "Pack 30 Imágenes IA", price: "89.00", requires_shipping: false, taxable: true, sku: "sc-images-30" }],
      },
      {
        title: "Shopy Crafter — Optimización SEO Completa",
        body_html: `<h2>Optimización SEO — €147</h2><p>Meta tags, keywords, Schema JSON-LD, plan de contenido para tu tienda.</p>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, seo, pago-unico",
        status: "active",
        variants: [{ title: "Optimización SEO Completa", price: "147.00", requires_shipping: false, taxable: true, sku: "sc-seo" }],
      },
      {
        title: "Shopy Crafter — Informe de Precios y Márgenes",
        body_html: `<h2>Informe Pricing — €97</h2><p>COGS real, márgenes, precios competitivos, estrategia de pricing para tu tienda.</p>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, pricing, pago-unico",
        status: "active",
        variants: [{ title: "Informe Pricing", price: "97.00", requires_shipping: false, taxable: true, sku: "sc-pricing-report" }],
      },
      {
        title: "Shopy Crafter — Setup Email Marketing",
        body_html: `<h2>Setup Email Marketing — €197</h2><p>Plantillas profesionales, flujos automatizados y configuración completa.</p>`,
        product_type: "Servicio Shopy Crafter",
        tags: "shopycrafter, servicio, email, marketing, pago-unico",
        status: "active",
        variants: [{ title: "Setup Email Marketing", price: "197.00", requires_shipping: false, taxable: true, sku: "sc-email-setup" }],
      },
    ];

    const created: Array<{ title: string; id: string; price: string; handle: string }> = [];
    const errors: string[] = [];

    for (const sp of serviceProducts) {
      try {
        const result = await shopifyRequest<{ product: Record<string, unknown> }>(
          projectId,
          project.shopDomain,
          "/products.json",
          { method: "POST", body: JSON.stringify({ product: sp }) }
        );
        created.push({
          title: String(result.product.title),
          id: String(result.product.id),
          price: sp.variants[0].price,
          handle: String(result.product.handle || ""),
        });
      } catch (err) {
        errors.push(`${sp.variants[0].sku}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info({ created: created.length, errors: errors.length }, "Shopify service products created");
    res.json({
      success: true,
      message: `${created.length} productos de servicio creados en Shopify`,
      products: created,
      errors: errors.length > 0 ? errors : undefined,
      checkoutBaseUrl: `https://${project.shopDomain}/cart/`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create Shopify service products");
    res.status(500).json({ error: "Error creando productos de servicio en Shopify" });
  }
});

router.post("/admin/brain-inject-self-knowledge", async (_req, res) => {
  try {
    const knowledge = buildPlatformSelfKnowledge();
    const result = await importBrainData({
      insights: knowledge.insights,
      memories: knowledge.memories,
      source: "platform-self-knowledge",
    });
    logger.info(result.stats, "Platform self-knowledge injected");
    res.json({
      success: true,
      message: "Conocimiento de plataforma inyectado en OmniCore Brain",
      stats: result.stats,
      totalInsights: knowledge.insights.length,
      totalMemories: knowledge.memories.length,
    });
  } catch (err) {
    logger.error({ err }, "Self-knowledge injection failed");
    res.status(500).json({ error: "Error inyectando self-knowledge" });
  }
});

router.get("/admin/shopify-products-with-prices", async (req, res) => {
  try {
    const projectId = Number(req.query.projectId) || 2;
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const allProducts: any[] = [];
    let pageInfo: string | null = null;
    for (let page = 0; page < 5; page++) {
      const url = pageInfo
        ? `/products.json?limit=250&page_info=${pageInfo}`
        : "/products.json?limit=250";
      const data = await shopifyRequest<{ products: any[] }>(projectId, project.shopDomain, url);
      allProducts.push(...data.products);
      if (data.products.length < 250) break;
    }

    const result = allProducts.map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      tags: p.tags,
      variants: (p.variants || []).map((v: any) => ({
        id: v.id,
        price: v.price,
        compare_at_price: v.compare_at_price,
        sku: v.sku,
        title: v.title,
      })),
    }));

    res.json({ total: result.length, products: result });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Shopify products with prices");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/admin/shopify-update-prices", async (req, res) => {
  try {
    const projectId = Number(req.body.projectId) || 2;
    const updates: Array<{ variantId: number | string; price: string; compareAtPrice?: string }> = req.body.updates || [];

    if (!updates.length) { res.status(400).json({ error: "No updates provided" }); return; }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const results: any[] = [];
    const errors: string[] = [];

    for (const u of updates) {
      try {
        const body: any = { variant: { price: u.price } };
        if (u.compareAtPrice) body.variant.compare_at_price = u.compareAtPrice;
        const data = await shopifyRequest<{ variant: any }>(
          projectId, project.shopDomain,
          `/variants/${u.variantId}.json`,
          { method: "PUT", body: JSON.stringify(body) }
        );
        results.push({ variantId: u.variantId, newPrice: data.variant.price, title: data.variant.title });
      } catch (err) {
        errors.push(`Variant ${u.variantId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.json({ success: true, updated: results.length, results, errors: errors.length ? errors : undefined });
  } catch (err) {
    logger.error({ err }, "Failed to update Shopify prices");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
