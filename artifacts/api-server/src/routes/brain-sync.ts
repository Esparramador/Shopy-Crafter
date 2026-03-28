import { Router } from "express";
import {
  db,
  omnicoreMemoriesTable,
  omnicoreInsightsTable,
  omnicoreKnowledgeDomainsTable,
  omnicorePromptLibraryTable,
  omnicoreNicheProfilesTable,
  omnicoreCrossConnectionsTable,
} from "@workspace/db";
import { sql, count } from "drizzle-orm";
import { logger } from "../lib/logger.js";
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

export default router;
