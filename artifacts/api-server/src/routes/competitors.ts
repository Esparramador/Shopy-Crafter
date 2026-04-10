import { Router } from "express";
import { db } from "@workspace/db";
import { competitorsTable, competitorSnapshotsTable, competitorAlertsTable, projectsTable, productsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { askGeminiWithSearch } from "../lib/gemini.js";
import { saveToVault } from "../lib/vault.js";
import net from "net";
import { enableLongRunning } from "../lib/long-running.js";

const router = Router();

function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (net.isIP(host)) {
      const parts = host.split(".").map(Number);
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 0) return false;
    }
    return true;
  } catch { return false; }
}

router.get("/competitors", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const competitors = await db.select().from(competitorsTable)
      .where(eq(competitorsTable.projectId, projectId));
    res.json(competitors);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/competitors", async (req, res): Promise<void> => {
  try {
    const { projectId, name, url, type } = req.body;
    if (!projectId || !name || !url) { res.status(400).json({ error: "projectId, name, url required" }); return; }
    const [comp] = await db.insert(competitorsTable).values({
      id: randomUUID(), projectId, name, url, type: type ?? "direct",
    }).returning();
    res.json(comp);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.delete("/competitors/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(competitorsTable).where(eq(competitorsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/competitors/snapshots", async (req, res): Promise<void> => {
  try {
    const { competitorId } = req.query as Record<string, string>;
    if (!competitorId) { res.status(400).json({ error: "competitorId required" }); return; }
    const snapshots = await db.select().from(competitorSnapshotsTable)
      .where(eq(competitorSnapshotsTable.competitorId, competitorId))
      .orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(10);
    res.json(snapshots);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/competitors/scan", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { projectId, competitorId } = req.body;
    if (!projectId || !competitorId) { res.status(400).json({ error: "projectId and competitorId required" }); return; }
  
    const [competitor] = await db.select().from(competitorsTable)
      .where(eq(competitorsTable.id, competitorId));
    if (!competitor) { res.status(404).json({ error: "Competitor not found" }); return; }
  
    if (!isSafePublicUrl(competitor.url)) {
      res.status(400).json({ error: "URL del competidor no es válida o es una dirección interna" });
      return;
    }
  
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parseInt(projectId)));
  
    let htmlContent = "";
    let fetchError = "";
    try {
      const resp = await fetch(competitor.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopifyAI-Monitor/1.0)" },
        signal: AbortSignal.timeout(30_000),
      });
      const raw = await resp.text();
      htmlContent = raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 40000);
    } catch (e: any) {
      fetchError = e.message ?? "fetch failed";
    }
  
    const prompt = `You are a competitive intelligence analyst for a Shopify store.
  Store: ${project?.name || "Store"}
  Competitor: ${competitor.name} (${competitor.url})
  ${htmlContent ? `\nActual page content scraped:\n${htmlContent}` : `\nNote: Could not fetch page (${fetchError}). Use publicly known info about this URL/brand.`}
  
  Analyze the competitor and return competitive intelligence. Extract real prices, products, and promotions from the scraped content where available. Return JSON:
  {
    "productsFound": 0,
    "priceMin": null,
    "priceMax": null,
    "priceMedian": null,
    "newProducts": [],
    "outOfStock": [],
    "promotionsDetected": [],
    "insights": [
      {"severity": "high|medium|low", "type": "price_drop|new_product|promotion|stock|general", "title": "...", "description": "...", "action": "..."}
    ],
    "overallThreatLevel": "low|medium|high"
  }`;
  
    try {
      const niche = project?.storeNiche ?? undefined;
      const text = await askClaudeWithBrain(
        parseInt(projectId),
        [{ role: "user", content: prompt }],
        `${SHOPIFY_EXPERT_SYSTEM} You are also a world-class competitive intelligence analyst. Use your accumulated knowledge about pricing patterns, market positioning, and e-commerce trends to identify real threats and opportunities.`,
        "general",
        niche
      );
      const match = text.match(/\{[\s\S]*\}/);
      let data: any = {};
      if (match) { try { data = JSON.parse(match[0]); } catch { data = {}; } }
  
      const [snap] = await db.insert(competitorSnapshotsTable).values({
        id: randomUUID(),
        competitorId,
        productsFound: data.productsFound ?? 0,
        priceMin: data.priceMin ?? null,
        priceMax: data.priceMax ?? null,
        priceMedian: data.priceMedian ?? null,
        newProducts: JSON.stringify(data.newProducts ?? []),
        outOfStock: JSON.stringify(data.outOfStock ?? []),
        promotionsDetected: JSON.stringify(data.promotionsDetected ?? []),
        rawData: text,
      }).returning();
  
      await db.update(competitorsTable)
        .set({ lastScanned: new Date() })
        .where(eq(competitorsTable.id, competitorId));
  
      for (const insight of (data.insights ?? [])) {
        await db.insert(competitorAlertsTable).values({
          id: randomUUID(),
          projectId,
          competitorId,
          alertType: insight.type,
          severity: insight.severity,
          title: insight.title,
          description: insight.description,
          actionSuggestion: insight.action,
        });
      }
  
      learnFromOperation({
        operationType: "competitor_scan",
        title: `Competitor Scan: ${competitor.name}`,
        content: `Competitor scan: ${data.productsFound ?? 0} products found, price range €${data.priceMin ?? "?"}-€${data.priceMax ?? "?"}, threat level: ${data.overallThreatLevel ?? "unknown"}. ${(data.insights ?? []).length} insights detected.`,
        niche: niche,
        sourceProjectId: parseInt(projectId),
      });
  
      saveToVault({
        projectId: parseInt(projectId),
        fileType: "analysis",
        category: "competitor_scan",
        title: `Análisis Competidor: ${competitor.name}`,
        description: `Threat: ${data.overallThreatLevel ?? "?"}, ${data.productsFound ?? 0} productos, ${(data.insights ?? []).length} insights`,
        mimeType: "application/json",
        fileSizeBytes: Buffer.from(text).length,
        generatedBy: "competitor_scanner",
        content: JSON.stringify({ competitor: { name: competitor.name, url: competitor.url }, data, rawAnalysis: text }, null, 2),
        metadata: { competitorId, competitorName: competitor.name, threatLevel: data.overallThreatLevel },
      }).catch(() => {});
  
      res.json({ snapshot: snap, insights: data.insights ?? [], threatLevel: data.overallThreatLevel });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/competitors/alerts", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.query as Record<string, string>;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const alerts = await db.select().from(competitorAlertsTable)
      .where(eq(competitorAlertsTable.projectId, projectId))
      .orderBy(desc(competitorAlertsTable.createdAt)).limit(20);
    res.json(alerts);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/competitors/alerts/:id/dismiss", async (req, res): Promise<void> => {
  try {
    await db.update(competitorAlertsTable)
      .set({ dismissed: 1 })
      .where(eq(competitorAlertsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/competitors/auto-discover", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  
    const pid = parseInt(projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, pid));
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  
    const products = await db.select().from(productsTable).where(eq(productsTable.projectId, pid));
    const topProducts = products.slice(0, 5).map(p => p.title).join(", ");
    const niche = project.storeNiche || "e-commerce";
    const storeName = project.name || "tienda";
    const shopDomain = project.shopDomain || "";
  
    const existingCompetitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, projectId.toString()));
    const existingUrls = existingCompetitors.map(c => c.url?.toLowerCase()).filter(Boolean);
  
    let discovered: Array<{ name: string; url: string; type: string; reason: string }> = [];
  
    try {
      const result = await askGeminiWithSearch(
        `BUSCA COMPETIDORES REALES para esta tienda online Shopify:
  
  Tienda: "${storeName}"
  Dominio: ${shopDomain}
  Nicho: ${niche}
  Productos principales: ${topProducts || "no especificados"}
  
  INSTRUCCIONES:
  1. Busca en Google tiendas online que vendan productos similares en España y Europa
  2. Busca competidores DIRECTOS (mismo tipo de producto, mismo mercado)
  3. Busca competidores INDIRECTOS (productos sustitutivos o plataformas con funciones similares)
  4. Incluye tiendas Shopify, WooCommerce, PrestaShop, Amazon sellers, Etsy sellers, y tiendas propias
  5. Para cada competidor, proporciona la URL REAL de su tienda (no la página de Amazon/Etsy genérica)
  6. Busca al menos 8-12 competidores reales
  7. NO incluyas la propia tienda "${shopDomain}" como competidor
  
  ${existingUrls.length > 0 ? `EXCLUIR estos competidores ya registrados:\n${existingUrls.join("\n")}` : ""}
  
  RESPONDE con JSON exacto:
  {
    "competitors": [
      {
        "name": "Nombre de la tienda/marca",
        "url": "https://...",
        "type": "direct|indirect|substitute",
        "reason": "Por qué es competidor (qué venden similar, rango de precios, mercado objetivo)"
      }
    ],
    "marketOverview": "Resumen del panorama competitivo del nicho",
    "threatAssessment": "Nivel de competencia general: bajo/medio/alto/muy_alto"
  }`,
        `You are a competitive intelligence analyst specializing in e-commerce. Search Google thoroughly to find REAL competitor stores and marketplaces selling similar products. Focus on Spanish and European markets. Return ONLY valid JSON with real, verified URLs.`
      );
  
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let parsed: any = {};
        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = { competitors: [] }; }
        discovered = (parsed.competitors || []).filter((c: { url?: string }) => {
          if (!c.url || !isSafePublicUrl(c.url)) return false;
          try {
            const u = new URL(c.url);
            const origin = u.origin.toLowerCase();
            if (shopDomain && origin.includes(shopDomain.toLowerCase().replace(/^https?:\/\//, ""))) return false;
            return !existingUrls.includes(origin) && !existingUrls.includes(c.url.toLowerCase());
          } catch { return false; }
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      res.status(500).json({ error: `Error descubriendo competidores: ${msg}` });
      return;
    }
  
    const added: Array<{ id: string; name: string; url: string; type: string; reason: string }> = [];
    for (const comp of discovered) {
      try {
        const [inserted] = await db.insert(competitorsTable).values({
          id: randomUUID(),
          projectId: projectId.toString(),
          name: comp.name,
          url: comp.url,
          type: comp.type || "direct",
        }).returning();
        added.push({ id: inserted.id, name: inserted.name, url: inserted.url, type: inserted.type || "direct", reason: comp.reason });
      } catch {}
    }
  
    learnFromOperation({
      operationType: "competitor_auto_discovery",
      title: `Auto-Discovery: ${storeName} (${niche})`,
      content: `Auto-descubrimiento de competidores para "${storeName}" (${niche}): ${added.length} competidores encontrados y registrados. ${added.map((c: any) => `${c.name} (${c.type})`).join(", ")}`,
      niche,
      sourceProjectId: pid,
    });
  
    saveToVault({
      projectId: pid,
      fileType: "analysis",
      category: "competitor_scan",
      title: `Auto-descubrimiento de Competidores: ${storeName}`,
      description: `${added.length} competidores descubiertos automáticamente via Google Search`,
      mimeType: "application/json",
      fileSizeBytes: Buffer.from(JSON.stringify(added)).length,
      generatedBy: "competitor_auto_discovery",
      content: JSON.stringify({ discovered: added, totalFound: discovered.length, storeName, niche }, null, 2),
      metadata: { totalDiscovered: discovered.length, registered: added.length },
    }).catch(() => {});
  
    res.json({
      discovered: added,
      totalFound: discovered.length,
      alreadyRegistered: existingCompetitors.length,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
