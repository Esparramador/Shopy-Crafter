import { Router } from "express";
import { db } from "@workspace/db";
import { competitorsTable, competitorSnapshotsTable, competitorAlertsTable, projectsTable, productsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askClaudeWithBrain, learnFromOperation, SHOPIFY_EXPERT_SYSTEM } from "../lib/claude.js";
import { askGeminiWithSearch, isGeminiSearchBlocked } from "../lib/gemini.js";
import { saveToVault } from "../lib/vault.js";
import { logger } from "../lib/logger.js";
import net from "net";
import { enableLongRunning } from "../lib/long-running.js";
import { getReportShell } from "./exports.js";

const router = Router();

function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
    if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".onion")) return false;
    if (host.startsWith("[")) return false;
    if (net.isIP(host)) {
      if (net.isIPv6(host)) return false;
      const parts = host.split(".").map(Number);
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 0) return false;
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;
      if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return false;
    }
    if (!host.includes(".")) return false;
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
  
    const previousSnaps = await db.select().from(competitorSnapshotsTable)
      .where(eq(competitorSnapshotsTable.competitorId, competitorId))
      .orderBy(desc(competitorSnapshotsTable.scannedAt)).limit(3);
    const historyBlock = previousSnaps.length > 0
      ? `\n\nHISTORIAL DE ESCANEOS PREVIOS (usa esto para detectar CAMBIOS):\n${previousSnaps.map(s => `- ${new Date(s.scannedAt!).toLocaleDateString("es-ES")}: ${s.productsFound ?? "?"} productos, precios ${s.priceMin ?? "?"}–${s.priceMax ?? "?"}€, promos: ${s.promotionsDetected ?? "[]"}`).join("\n")}\n\nIMPORTANTE: Compara con los datos previos y destaca CAMBIOS (nuevos productos, bajadas de precio, nuevas promociones, productos descatalogados). Busca información NUEVA que no apareciera en escaneos anteriores.`
      : "\n\nEste es el PRIMER escaneo de este competidor. Sé lo más exhaustivo posible.";

    const prompt = `You are a competitive intelligence analyst for a Shopify store.
  Store: ${project?.name || "Store"}
  Competitor: ${competitor.name} (${competitor.url})
  ${htmlContent ? `\nActual page content scraped:\n${htmlContent}` : `\nNote: Could not fetch page (${fetchError}). Use publicly known info about this URL/brand.`}
  ${historyBlock}
  
  Analyze the competitor and return competitive intelligence. Extract real prices, products, and promotions from the scraped content where available. Focus on finding NEW information not in previous scans. Return JSON:
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

    const discoverPrompt = `BUSCA COMPETIDORES REALES para esta tienda online Shopify. Necesito una LISTA EXHAUSTIVA de al menos 15-20 competidores reales y verificables.

Tienda: "${storeName}"
Dominio: ${shopDomain}
Nicho: ${niche}
Productos principales: ${topProducts || "no especificados"}

INSTRUCCIONES DETALLADAS:
1. Busca tiendas online que vendan productos similares en España, Europa y globalmente
2. DIRECTOS: mismo tipo de producto, mismo mercado, mismo rango de precio
3. INDIRECTOS: productos sustitutivos o categorías relacionadas
4. SUSTITUTOS: plataformas/marketplaces (Amazon, Etsy, Zalando, El Corte Inglés online)
5. Incluye tiendas Shopify, WooCommerce, PrestaShop, Magento y tiendas propias
6. Incluye también GRANDES competidores (marcas conocidas en el nicho)
7. Para cada uno, da la URL REAL de su tienda (nunca amazon.com genérico — busca tienda propia)
8. Busca al MENOS 15-20 competidores con URLs reales verificables
9. NO incluyas la propia tienda "${shopDomain}"
10. Incluye rango de precios estimado y nivel de amenaza real

${existingUrls.length > 0 ? `EXCLUIR estos competidores ya registrados:\n${existingUrls.join("\n")}` : ""}

RESPONDE con JSON exacto:
{
  "competitors": [
    {
      "name": "Nombre de la tienda/marca",
      "url": "https://...",
      "type": "direct|indirect|substitute",
      "reason": "Por qué es competidor (productos similares, rango de precios €X-€Y, mercado objetivo)",
      "threatLevel": "low|medium|high",
      "estimatedPriceRange": "€X - €Y"
    }
  ],
  "marketOverview": "Resumen detallado del panorama competitivo del nicho con datos concretos",
  "threatAssessment": "Nivel de competencia general: bajo/medio/alto/muy_alto",
  "marketSize": "Estimación del tamaño de mercado",
  "topThreats": ["Competidor1", "Competidor2", "Competidor3"]
}`;

    const parseDiscovered = (rawText: string) => {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      let parsed: any = {};
      try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = { competitors: [] }; }
      return (parsed.competitors || []).filter((c: { url?: string }) => {
        if (!c.url || !isSafePublicUrl(c.url)) return false;
        try {
          const u = new URL(c.url);
          const origin = u.origin.toLowerCase();
          if (shopDomain && origin.includes(shopDomain.toLowerCase().replace(/^https?:\/\//, ""))) return false;
          return !existingUrls.includes(origin) && !existingUrls.includes(c.url.toLowerCase());
        } catch { return false; }
      });
    };

    if (isGeminiSearchBlocked()) {
      logger.info("Competitor auto-discover: Gemini blocked, using Claude directly");
      try {
        const claudeText = await askClaudeWithBrain(
          pid,
          [{ role: "user", content: discoverPrompt }],
          `${SHOPIFY_EXPERT_SYSTEM} You are a competitive intelligence analyst specializing in e-commerce. Return ONLY valid JSON with real competitor stores. Focus on ${niche} in Spain and Europe. Include real URLs you know from your training data.`,
          "competitors",
          niche,
        );
        discovered = parseDiscovered(claudeText);
      } catch (claudeErr) {
        logger.warn({ err: claudeErr }, "Competitor auto-discover: Claude failed");
      }
    } else {
      try {
        const result = await askGeminiWithSearch(
          discoverPrompt,
          `You are a competitive intelligence analyst specializing in e-commerce. Search Google thoroughly to find REAL competitor stores and marketplaces selling similar products. Focus on Spanish and European markets. Return ONLY valid JSON with real, verified URLs.`
        );
        if (result.text) {
          discovered = parseDiscovered(result.text);
        }
        if (discovered.length === 0) {
          logger.info("Competitor auto-discover: Gemini returned empty, falling back to Claude");
          const claudeText = await askClaudeWithBrain(
            pid,
            [{ role: "user", content: discoverPrompt }],
            `${SHOPIFY_EXPERT_SYSTEM} You are a competitive intelligence analyst. Return ONLY valid JSON with real competitor stores you know. Focus on ${niche} in Spain and Europe.`,
            "competitors",
            niche,
          );
          discovered = parseDiscovered(claudeText);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        logger.warn({ err: msg }, "Competitor auto-discover: Gemini failed, trying Claude");
        try {
          const claudeText = await askClaudeWithBrain(
            pid,
            [{ role: "user", content: discoverPrompt }],
            `${SHOPIFY_EXPERT_SYSTEM} You are a competitive intelligence analyst. Return ONLY valid JSON with real competitor stores. Focus on ${niche} in Spain and Europe.`,
            "competitors",
            niche,
          );
          discovered = parseDiscovered(claudeText);
        } catch (claudeErr) {
          logger.warn({ err: claudeErr }, "Competitor auto-discover: Both AI providers failed");
        }
      }
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

// ─── POST /competitors/comparative-report ─────────────────────────────────────
// Genera informe HTML profesional comparando NUESTRA tienda contra los
// competidores registrados, en precio / producto / calidad / imagen / social.
router.post("/competitors/comparative-report", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const session = req.session as { userId?: string; role?: string; clientId?: string | number | null } | undefined;
    if (!session?.userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { projectId } = req.body ?? {};
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
    const projectIdNum = Number(projectId);
    if (!Number.isFinite(projectIdNum)) { res.status(400).json({ error: "projectId inválido" }); return; }

    // access check
    if (session.role !== "admin") {
      const [proj] = await db.select({ clientId: projectsTable.clientId }).from(projectsTable).where(eq(projectsTable.id, projectIdNum)).limit(1);
      if (!proj || String(proj.clientId) !== String(session.clientId)) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectIdNum)).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const competitors = await db.select().from(competitorsTable).where(eq(competitorsTable.projectId, String(projectIdNum)));
    if (competitors.length === 0) { res.status(400).json({ error: "Añade al menos un competidor antes de generar el informe" }); return; }

    // last snapshot per competitor
    const compIds = competitors.map(c => c.id);
    const allSnaps = await db.select().from(competitorSnapshotsTable)
      .where(inArray(competitorSnapshotsTable.competitorId, compIds))
      .orderBy(desc(competitorSnapshotsTable.scannedAt));
    const lastSnap: Record<string, typeof allSnaps[number]> = {};
    for (const s of allSnaps) { if (!lastSnap[s.competitorId]) lastSnap[s.competitorId] = s; }

    const ourProducts = await db.select().from(productsTable).where(eq(productsTable.projectId, projectIdNum)).limit(50);
    const ourPrices = ourProducts.map(p => Number((p as any).price)).filter(n => Number.isFinite(n) && n > 0);
    const ourMin = ourPrices.length ? Math.min(...ourPrices) : null;
    const ourMax = ourPrices.length ? Math.max(...ourPrices) : null;
    const ourMedian = ourPrices.length ? ourPrices.sort((a, b) => a - b)[Math.floor(ourPrices.length / 2)] : null;

    const storeName = (project as any).storeName || (project as any).name || "Tienda";
    const niche = (project as any).storeNiche || "—";
    const storeUrl = (project as any).shopifyDomain || (project as any).storeUrl || "";

    const competitorBrief = competitors.map(c => {
      const snap = lastSnap[c.id];
      return `- ${c.name} (${c.url}) [${c.type}]${snap ? ` — precios ${snap.priceMin ?? "?"}–${snap.priceMax ?? "?"}€ (mediana ${snap.priceMedian ?? "?"}), ${snap.productsFound ?? "?"} productos` : " — sin escanear"}`;
    }).join("\n");

    const aiPrompt = `Eres un consultor senior de competitive intelligence para eCommerce. Genera una comparativa REAL y útil entre la tienda del cliente y sus competidores. Usa Google Search para verificar datos actuales.

NUESTRA TIENDA:
- Nombre: ${storeName}
- Sector / nicho: ${niche}
- URL: ${storeUrl}
- Productos analizados: ${ourProducts.length}
- Rango de precios propios: ${ourMin ?? "?"}€ – ${ourMax ?? "?"}€ (mediana ${ourMedian ?? "?"}€)

COMPETIDORES REGISTRADOS:
${competitorBrief}

PARA CADA COMPETIDOR, investiga en Google y devuelve un análisis detallado en estos ejes:
1. PRECIO: rango y posicionamiento (premium/medio/low cost) frente a nosotros
2. PRODUCTO/SURTIDO: amplitud, profundidad, especialización
3. CALIDAD/IMAGEN: percepción de marca, fotografía, packaging
4. PRESENCIA WEB/SEO: dominio, autoridad percibida
5. PRESENCIA SOCIAL: Instagram/Facebook/TikTok (URLs reales si existen, número aprox. seguidores)
6. PUNTOS FUERTES y DÉBILES vs nuestra tienda
7. RECOMENDACIÓN ACCIONABLE (qué copiar, qué evitar, dónde diferenciarse)

DEVUELVE SOLO un JSON válido:
{
  "executiveSummary": "2-3 frases con la conclusión global",
  "ourStrengths": ["..."],
  "ourWeaknesses": ["..."],
  "marketPositioning": "1 frase sobre dónde estamos en el mercado",
  "competitors": [
    {
      "name": "...",
      "priceLevel": "premium|medio|low-cost",
      "priceRange": "X-Y €",
      "productAnalysis": "...",
      "qualityImage": "...",
      "webSeo": "...",
      "social": { "instagram": "@... | url | seguidores aprox", "facebook": "...", "tiktok": "..." },
      "strengths": ["..."],
      "weaknesses": ["..."],
      "actionable": "..."
    }
  ],
  "recommendations": ["...", "..."]
}`;

    const safeParseJson = (raw: string): any => {
      try {
        const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fence ? fence[1].trim() : raw.trim();
        try { return JSON.parse(candidate); } catch {
          const obj = candidate.match(/\{[\s\S]*\}/);
          if (obj) return JSON.parse(obj[0]);
        }
      } catch { /* */ }
      return null;
    };

    const t0 = Date.now();
    let parsed: any = null;
    let sources: string[] = [];

    if (isGeminiSearchBlocked()) {
      logger.info("Comparative report: Gemini blocked, using Claude directly");
      try {
        const claudeText = await askClaudeWithBrain(
          projectIdNum,
          [{ role: "user", content: aiPrompt }],
          `${SHOPIFY_EXPERT_SYSTEM} You are a world-class competitive intelligence consultant. Respond ONLY with valid JSON. Use your knowledge to provide realistic competitive analysis.`,
          "competitors",
          niche,
        );
        parsed = safeParseJson(claudeText);
        sources = ["Claude AI analysis"];
      } catch { /* parsed stays null */ }
    } else {
      try {
        const { text: aiText, sources: gemSources } = await askGeminiWithSearch(
          aiPrompt,
          "Eres un investigador competitivo. Verifica todo con Google. Responde SIEMPRE con JSON estricto, sin texto fuera del JSON. Si un dato no existe, omite el campo.",
        );
        sources = gemSources;
        parsed = safeParseJson(aiText);
      } catch (gemErr) {
        logger.warn({ err: String(gemErr) }, "Comparative report: Gemini threw, falling back to Claude");
      }

      if (!parsed || !Array.isArray(parsed.competitors)) {
        logger.warn("Comparative report: Gemini failed/empty, falling back to Claude");
        try {
          const claudeText = await askClaudeWithBrain(
            projectIdNum,
            [{ role: "user", content: aiPrompt }],
            `${SHOPIFY_EXPERT_SYSTEM} You are a world-class competitive intelligence consultant. Respond ONLY with valid JSON. Use your knowledge to estimate realistic data when needed.`,
            "competitors",
            niche,
          );
          parsed = safeParseJson(claudeText);
          sources = ["Claude AI analysis"];
        } catch { /* parsed stays null */ }
      }
    }
    const elapsedMs = Date.now() - t0;

    if (!parsed || !Array.isArray(parsed.competitors)) {
      res.status(502).json({ error: "No se pudo generar el informe comparativo. Intenta de nuevo." });
      return;
    }

    const esc = (s: unknown): string => String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    const today = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

    const summaryHtml = `
      <h2>Resumen ejecutivo</h2>
      <p>${esc(parsed.executiveSummary || "—")}</p>
      ${parsed.marketPositioning ? `<p><strong>Posicionamiento:</strong> ${esc(parsed.marketPositioning)}</p>` : ""}

      <h2>Nuestra tienda — Fortalezas y debilidades</h2>
      <table>
        <thead><tr><th>✅ Fortalezas</th><th>⚠️ Debilidades</th></tr></thead>
        <tbody><tr>
          <td><ul>${(parsed.ourStrengths || []).map((s: string) => `<li>${esc(s)}</li>`).join("")}</ul></td>
          <td><ul>${(parsed.ourWeaknesses || []).map((s: string) => `<li>${esc(s)}</li>`).join("")}</ul></td>
        </tr></tbody>
      </table>`;

    const compHtml = (parsed.competitors as any[]).map(c => {
      const social = c.social || {};
      return `
      <h2>${esc(c.name)}</h2>
      <table>
        <tbody>
          <tr><th style="width:25%">Nivel de precio</th><td>${esc(c.priceLevel || "—")} (${esc(c.priceRange || "—")})</td></tr>
          <tr><th>Producto / Surtido</th><td>${esc(c.productAnalysis)}</td></tr>
          <tr><th>Calidad / Imagen</th><td>${esc(c.qualityImage)}</td></tr>
          <tr><th>Web / SEO</th><td>${esc(c.webSeo)}</td></tr>
          <tr><th>Presencia social</th><td>${["instagram", "facebook", "tiktok"].map(k => social[k] ? `<strong>${k}:</strong> ${esc(social[k])}` : "").filter(Boolean).join("<br/>") || "—"}</td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr><th>✅ Sus fortalezas</th><th>⚠️ Sus debilidades</th></tr></thead>
        <tbody><tr>
          <td><ul>${(c.strengths || []).map((s: string) => `<li>${esc(s)}</li>`).join("")}</ul></td>
          <td><ul>${(c.weaknesses || []).map((s: string) => `<li>${esc(s)}</li>`).join("")}</ul></td>
        </tr></tbody>
      </table>
      ${c.actionable ? `<p><strong>🎯 Acción recomendada:</strong> ${esc(c.actionable)}</p>` : ""}`;
    }).join("");

    const recsHtml = `<h2>Recomendaciones globales</h2>
      <ul>${(parsed.recommendations || []).map((r: string) => `<li>${esc(r)}</li>`).join("")}</ul>
      <p style="font-size:11px;color:#94a3b8;margin-top:18px">Análisis basado en investigación con Google Search en tiempo real (${sources.length} fuentes verificadas, ${Math.round(elapsedMs / 1000)}s).</p>`;

    const body = summaryHtml + compHtml + recsHtml;
    const shell = getReportShell("prestige");
    const html = shell(
      "Análisis Competitivo",
      `${storeName} vs ${competitors.length} competidores`,
      body,
      today,
      storeName,
    );

    saveToVault({
      projectId: projectIdNum,
      fileType: "report",
      category: "competitor_analysis",
      title: `Análisis competitivo: ${storeName}`,
      description: `Comparativa con ${competitors.length} competidores (${sources.length} fuentes Google)`,
      mimeType: "text/html",
      fileSizeBytes: Buffer.from(html).length,
      generatedBy: "competitive_report",
      content: html,
      metadata: { competitors: competitors.length, sources: sources.length, elapsedMs },
    }).catch(() => {});

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="competidores-${projectIdNum}-${Date.now()}.html"`);
    res.send(html);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
