import { Router } from "express";
import { db, projectsTable, suppliersResearchTable, supplierEntriesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { askGeminiWithSearch, isGeminiSearchBlocked, resetGeminiCircuitBreakers, getGeminiStatus } from "../lib/gemini.js";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";
import { recordApiUsage } from "../lib/api-usage.js";
import { enableLongRunning } from "../lib/long-running.js";
import { requireProjectAccess } from "../lib/access.js";
import { getReportShell } from "./exports.js";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    // tolerate www.domain.tld without scheme
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
      try {
        const u2 = new URL(`https://${trimmed}`);
        return u2.toString();
      } catch { return null; }
    }
    return null;
  }
}

function parseProjectId(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}

function safeJsonParse<T = unknown>(text: string): T | null {
  if (!text) return null;
  // Try to find a fenced JSON block
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : text.trim();
  // Try direct parse
  try { return JSON.parse(candidate) as T; } catch {}
  // Try to extract first JSON array or object
  const arr = candidate.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]) as T; } catch {} }
  const obj = candidate.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]) as T; } catch {} }
  return null;
}

interface SupplierJson {
  name: string;
  category?: string;
  country?: string;
  region?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  productsOffered?: string[] | string;
  priceRangeMin?: number | null;
  priceRangeMax?: number | null;
  currency?: string;
  moq?: string;
  leadDays?: string;
  paymentTerms?: string;
  shipsInternationally?: boolean;
  certifications?: string;
  score?: number;
  notes?: string;
  sourceUrl?: string;
}

// ─── POST /projects/:projectId/suppliers/research ─────────────────────────────
router.post(
  "/projects/:projectId/suppliers/research",
  requireProjectAccess,
  async (req, res): Promise<void> => {
    enableLongRunning(res);
    const projectIdNum = parseProjectId(req.params.projectId);
    if (projectIdNum === null) { res.status(400).json({ error: "projectId inválido" }); return; }
    const projectIdText = String(projectIdNum);
    try {
      const { niche: nicheRaw, customQuery: customQueryRaw, country: countryRaw } = req.body ?? {};
      const niche = typeof nicheRaw === "string" ? nicheRaw.trim().slice(0, 200) : "";
      const customQuery = typeof customQueryRaw === "string" ? customQueryRaw.trim().slice(0, 500) : "";
      const country = typeof countryRaw === "string" ? countryRaw.trim().slice(0, 80) : "";

      // Load project context
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectIdNum)).limit(1);
      if (!project) { res.status(404).json({ error: "Project not found" }); return; }

      const effectiveNiche = niche || (project as any).storeNiche || "";
      const storeName = (project as any).storeName || (project as any).name || "";

      if (!effectiveNiche && !customQuery) {
        res.status(400).json({ error: "Necesitas indicar un nicho o una búsqueda personalizada" });
        return;
      }

      // Compose research prompt
      const userPrompt = `Eres un consultor de aprovisionamiento B2B con 15 años de experiencia ayudando a tiendas online a encontrar proveedores REALES.

CONTEXTO DE LA EMPRESA CLIENTE:
- Tienda: ${storeName || "(sin nombre)"}
- Nicho / Sector: ${effectiveNiche || "(no especificado)"}
${country ? `- Mercado preferente: ${country}` : "- Mercado preferente: España + Europa, alternativas globales"}

INSTRUCCIÓN:
${customQuery
  ? `El cliente ha pedido específicamente: "${customQuery}". Busca activamente en Google los mejores proveedores REALES (fabricantes, mayoristas, distribuidores, dropshippers, talleres, agencias, etc.) que cubran esa necesidad.`
  : `Busca activamente en Google los principales proveedores REALES (fabricantes, mayoristas, talleres, distribuidores, agencias) para una tienda del nicho "${effectiveNiche}". Incluye proveedores de materia prima, servicios auxiliares (serigrafía, packaging, fulfillment, fotografía, diseño, etc.) y dropshippers verificados.`}

REQUISITOS OBLIGATORIOS:
1. Devuelve entre 8 y 20 proveedores REALES, verificados por Google Search.
2. Cada proveedor debe tener un sitio web real y comprobable. Nada inventado.
3. Para cada uno, intenta extraer estos datos (omite el campo si realmente no lo encuentras, NO inventes):
   - name, category, country, region, website (https://...)
   - contactEmail, contactPhone (solo si aparece en su web)
   - productsOffered: array de 3-7 strings con productos/servicios concretos
   - priceRangeMin, priceRangeMax: números EUR aproximados por unidad o pedido típico (null si no aparece)
   - currency (EUR, USD...), moq (mínimo de pedido), leadDays (plazo entrega), paymentTerms
   - shipsInternationally: true/false
   - certifications (ISO, GOTS, BIO...)
   - score: 1-100 (calidad-precio-fiabilidad estimada)
   - notes: 1-2 frases con tu valoración honesta
   - sourceUrl: la URL exacta donde lo verificaste
4. Da prioridad a proveedores con buena reputación (reviews, certificaciones, antigüedad).
5. Mezcla precios bajos / medios / premium para que el cliente pueda comparar.

FORMATO DE RESPUESTA — SOLO UN JSON válido, sin texto adicional, sin comentarios:
{
  "summary": "1-2 frases con conclusión general del mercado de proveedores para este nicho",
  "suppliers": [ { ...campos arriba... }, ... ]
}`;

      const t0 = Date.now();
      let aiText = "";
      let sources: string[] = [];
      let queries: string[] = [];
      let searchEngine: "gemini-search" | "claude-fallback" = "gemini-search";

      if (!isGeminiSearchBlocked()) {
        const geminiResult = await askGeminiWithSearch(
          userPrompt,
          "Eres un investigador B2B. Responde SIEMPRE con JSON estricto y datos verificables. Si no encuentras un dato, omite el campo en lugar de inventarlo.",
        );
        aiText = geminiResult.text;
        sources = geminiResult.sources;
        queries = geminiResult.queries;
        if (geminiResult.usage) {
          void recordApiUsage({
            provider: "gemini",
            operation: "suppliers/research",
            model: geminiResult.usage.model,
            projectId: projectIdNum,
            inputUnits: geminiResult.usage.inputTokens,
            outputUnits: geminiResult.usage.outputTokens,
            unitsLabel: "tokens",
            costUsd: geminiResult.usage.costUsd,
            success: true,
          });
        }
      }

      const geminiParsed = safeJsonParse<{ summary?: string; suppliers?: SupplierJson[] }>(aiText);
      const geminiSuppliers = Array.isArray(geminiParsed?.suppliers) ? geminiParsed!.suppliers : [];

      if (geminiSuppliers.length === 0) {
        searchEngine = "claude-fallback";
        try {
          req.log.info("[Suppliers] Gemini sin resultados — fallback a Claude");
          const claudeResult = await askClaudeJsonWithBrain<{ summary?: string; suppliers?: SupplierJson[] }>(
            projectIdNum,
            userPrompt + `\n\nIMPORTANTE: Proporciona proveedores REALES que conozcas. Incluye empresas verificables con webs reales. Marca en "notes" que la info debe verificarse. Prioriza proveedores establecidos y conocidos del sector.`,
            "Eres un consultor B2B experto con 15 años de experiencia. Responde SOLO con JSON válido con la estructura exacta: {\"summary\":\"...\",\"suppliers\":[...]}. Proporciona proveedores reales conocidos, priorizando los más establecidos y verificables.",
            "competitors",
            effectiveNiche || undefined,
            8192,
            120_000
          );
          req.log.info({ claudeResultType: typeof claudeResult, hasSuppliers: !!(claudeResult as any)?.suppliers }, "[Suppliers] Claude respondió");
          aiText = JSON.stringify(claudeResult);
          sources = [];
          queries = [];
        } catch (claudeErr: any) {
          req.log.error({ err: claudeErr?.message || claudeErr }, "[Suppliers] Claude fallback falló");
          res.status(502).json({
            error: "Gemini bloqueado (403) y Claude también falló. Reintenta en unos segundos.",
            engine: searchEngine,
            detail: claudeErr?.message?.slice(0, 200) || "unknown",
          });
          return;
        }
      }
      const elapsedMs = Date.now() - t0;

      const parsed = safeJsonParse<{ summary?: string; suppliers?: SupplierJson[] }>(aiText);
      const suppliers = Array.isArray(parsed?.suppliers) ? parsed!.suppliers : [];

      if (suppliers.length === 0) {
        res.status(502).json({
          error: "No se encontraron proveedores válidos. Intenta una búsqueda más específica.",
          rawPreview: aiText.slice(0, 400),
          engine: searchEngine,
        });
        return;
      }

      // Save research row
      const researchId = randomUUID();
      await db.insert(suppliersResearchTable).values({
        id: researchId,
        projectId: projectIdText,
        niche: effectiveNiche || null,
        query: customQuery || null,
        status: "completed",
        totalFound: suppliers.length,
        sources: JSON.stringify({ urls: sources, queries }),
        rawResponse: aiText.slice(0, 20000),
        costEur: null,
      });

      // Save entries
      const inserts = suppliers
        .filter(s => s && typeof s.name === "string" && s.name.trim().length > 1)
        .map(s => {
          const productsOffered = Array.isArray(s.productsOffered)
            ? s.productsOffered.join(" | ")
            : (typeof s.productsOffered === "string" ? s.productsOffered : null);
          const str = (v: unknown, max: number): string | null => {
            if (v == null) return null;
            return String(v).slice(0, max) || null;
          };
          return {
            id: randomUUID(),
            researchId,
            projectId: projectIdText,
            name: String(s.name).slice(0, 180),
            category: str(s.category, 100),
            country: str(s.country, 80),
            region: str(s.region, 80),
            website: safeHttpUrl(s.website)?.slice(0, 400) ?? null,
            contactEmail: str(s.contactEmail, 200),
            contactPhone: str(s.contactPhone, 80),
            productsOffered: productsOffered?.slice(0, 1000) ?? null,
            priceRangeMin: typeof s.priceRangeMin === "number" ? s.priceRangeMin : (typeof s.priceRangeMin === "string" ? parseFloat(s.priceRangeMin) || null : null),
            priceRangeMax: typeof s.priceRangeMax === "number" ? s.priceRangeMax : (typeof s.priceRangeMax === "string" ? parseFloat(s.priceRangeMax) || null : null),
            currency: str(s.currency, 8) ?? "EUR",
            moq: str(s.moq, 80),
            leadDays: str(s.leadDays, 80),
            paymentTerms: str(s.paymentTerms, 200),
            shipsInternationally: s.shipsInternationally ? 1 : 0,
            certifications: str(s.certifications, 200),
            score: typeof s.score === "number" ? Math.max(0, Math.min(100, Math.round(s.score))) : null,
            source: searchEngine,
            sourceUrl: safeHttpUrl(s.sourceUrl)?.slice(0, 400) ?? null,
            notes: str(s.notes, 600),
            starred: 0,
          };
        });

      if (inserts.length > 0) {
        await db.insert(supplierEntriesTable).values(inserts);
      }

      // fire-and-forget tracking (askGeminiWithSearch already records its own,
      // we add a high-level operation marker for the dashboard)
      void recordApiUsage({
        provider: "gemini",
        operation: "suppliers.research",
        model: "wrapper",
        projectId: projectIdNum,
        inputUnits: 0,
        outputUnits: 0,
        unitsLabel: "tokens",
        costUsd: 0,
        metadata: { suppliers: inserts.length, elapsedMs, niche: effectiveNiche, sources: sources.length },
      });

      learnFromOperation({
        operationType: "supplier_research",
        title: `Proveedores: ${effectiveNiche || customQuery || "búsqueda"} — ${inserts.length} encontrados`,
        content: `Investigación de proveedores para nicho "${effectiveNiche}". Query: "${customQuery}". ${inserts.length} proveedores encontrados. Países: ${[...new Set(inserts.map(s => s.country).filter(Boolean))].join(", ")}. Resumen: ${parsed?.summary ?? ""}. Top proveedores: ${inserts.slice(0, 5).map(s => `${s.name} (${s.country}, score ${s.score})`).join(", ")}`,
        confidence: 0.88,
        tags: ["suppliers", "research", effectiveNiche, country].filter(Boolean) as string[],
      });

      res.json({
        ok: true,
        researchId,
        totalFound: inserts.length,
        summary: parsed?.summary ?? null,
        sources,
        queries,
        elapsedMs,
        engine: searchEngine,
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: msg });
    }
  },
);

// ─── GET /projects/:projectId/suppliers ───────────────────────────────────────
router.get(
  "/projects/:projectId/suppliers",
  requireProjectAccess,
  async (req, res): Promise<void> => {
    try {
      const projectIdNum = parseProjectId(req.params.projectId);
      if (projectIdNum === null) { res.status(400).json({ error: "projectId inválido" }); return; }
      const projectIdText = String(projectIdNum);
      const researches = await db
        .select()
        .from(suppliersResearchTable)
        .where(eq(suppliersResearchTable.projectId, projectIdText))
        .orderBy(desc(suppliersResearchTable.createdAt))
        .limit(50);

      const entries = await db
        .select()
        .from(supplierEntriesTable)
        .where(eq(supplierEntriesTable.projectId, projectIdText))
        .orderBy(desc(supplierEntriesTable.score), desc(supplierEntriesTable.createdAt));

      res.json({ researches, entries });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: msg });
    }
  },
);

// ─── DELETE /projects/:projectId/suppliers/entry/:entryId ─────────────────────
router.delete(
  "/projects/:projectId/suppliers/entry/:entryId",
  requireProjectAccess,
  async (req, res): Promise<void> => {
    try {
      const projectIdNum = parseProjectId(req.params.projectId);
      if (projectIdNum === null) { res.status(400).json({ error: "projectId inválido" }); return; }
      const projectIdText = String(projectIdNum);
      const entryId = String(req.params.entryId);
      await db.delete(supplierEntriesTable).where(
        and(
          eq(supplierEntriesTable.id, entryId),
          eq(supplierEntriesTable.projectId, projectIdText),
        ),
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Internal server error" });
    }
  },
);

// ─── PATCH /projects/:projectId/suppliers/entry/:entryId/star ────────────────
router.patch(
  "/projects/:projectId/suppliers/entry/:entryId/star",
  requireProjectAccess,
  async (req, res): Promise<void> => {
    try {
      const projectIdNum = parseProjectId(req.params.projectId);
      if (projectIdNum === null) { res.status(400).json({ error: "projectId inválido" }); return; }
      const projectIdText = String(projectIdNum);
      const entryId = String(req.params.entryId);
      const starred = req.body?.starred ? 1 : 0;
      await db.update(supplierEntriesTable)
        .set({ starred })
        .where(and(
          eq(supplierEntriesTable.id, entryId),
          eq(supplierEntriesTable.projectId, projectIdText),
        ));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Internal server error" });
    }
  },
);

// ─── POST /projects/:projectId/suppliers/report ──────────────────────────────
router.post(
  "/projects/:projectId/suppliers/report",
  requireProjectAccess,
  async (req, res): Promise<void> => {
    enableLongRunning(res);
    try {
      const projectIdNum = parseProjectId(req.params.projectId);
      if (projectIdNum === null) { res.status(400).json({ error: "projectId inválido" }); return; }
      const projectIdText = String(projectIdNum);
      const { onlyStarred } = req.body ?? {};

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectIdNum)).limit(1);
      if (!project) { res.status(404).json({ error: "Project not found" }); return; }

      const allEntries = await db
        .select()
        .from(supplierEntriesTable)
        .where(eq(supplierEntriesTable.projectId, projectIdText))
        .orderBy(desc(supplierEntriesTable.score));

      const entries = onlyStarred ? allEntries.filter(e => e.starred === 1) : allEntries;

      if (entries.length === 0) {
        res.status(400).json({ error: "No hay proveedores guardados para generar informe" });
        return;
      }

      const storeName = (project as any).storeName || (project as any).name || "Tienda";
      const niche = (project as any).storeNiche || "";
      const today = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

      // ─── COMPUTE REAL STATISTICS ────────────────────────────────────────────
      const withPrices = entries.filter(e => e.priceRangeMin != null || e.priceRangeMax != null);
      const priceAverages = withPrices.map(e => {
        const lo = e.priceRangeMin ?? e.priceRangeMax ?? 0;
        const hi = e.priceRangeMax ?? e.priceRangeMin ?? 0;
        return (lo + hi) / 2;
      });
      const avgPrice = priceAverages.length > 0 ? priceAverages.reduce((a, b) => a + b, 0) / priceAverages.length : 0;
      const minPrice = withPrices.length > 0 ? Math.min(...withPrices.map(e => e.priceRangeMin ?? e.priceRangeMax ?? 0)) : 0;
      const maxPrice = withPrices.length > 0 ? Math.max(...withPrices.map(e => e.priceRangeMax ?? e.priceRangeMin ?? 0)) : 0;

      const withScores = entries.filter(e => e.score != null);
      const avgScore = withScores.length > 0 ? Math.round(withScores.reduce((a, e) => a + (e.score ?? 0), 0) / withScores.length) : 0;
      const topScore = withScores.length > 0 ? Math.max(...withScores.map(e => e.score ?? 0)) : 0;

      const byCategory: Record<string, typeof entries> = {};
      const byCountry: Record<string, number> = {};
      for (const e of entries) {
        const k = e.category || "General";
        (byCategory[k] = byCategory[k] || []).push(e);
        if (e.country) byCountry[e.country] = (byCountry[e.country] ?? 0) + 1;
      }
      const categoryNames = Object.keys(byCategory);
      const topCountries = Object.keys(byCountry).sort((a, b) => byCountry[b] - byCountry[a]).slice(0, 5);
      const intlShipping = entries.filter(e => e.shipsInternationally === 1).length;
      const certified = entries.filter(e => (e.certifications ?? "").length > 2).length;
      const starredCount = entries.filter(e => e.starred === 1).length;

      // ─── AI DEEP ANALYSIS ────────────────────────────────────────────────────
      const suppliersForAI = entries.map(e => ({
        id: e.id,
        name: e.name,
        category: e.category,
        country: e.country,
        products: e.productsOffered,
        priceMin: e.priceRangeMin,
        priceMax: e.priceRangeMax,
        currency: e.currency ?? "EUR",
        moq: e.moq,
        leadDays: e.leadDays,
        paymentTerms: e.paymentTerms,
        shipsIntl: e.shipsInternationally === 1,
        certifications: e.certifications,
        score: e.score,
        notes: e.notes,
        starred: e.starred === 1,
      }));

      const reportPrompt = `Eres el CFO y Director de Compras de una agencia de eCommerce Shopify de primer nivel.
Analiza en profundidad los ${entries.length} proveedores encontrados para la tienda "${storeName}" (sector: ${niche || "eCommerce general"}).

DATOS COMPLETOS DE LOS ${entries.length} PROVEEDORES:
${JSON.stringify(suppliersForAI, null, 2)}

ESTADÍSTICAS CALCULADAS DEL PORTFOLIO:
- Total proveedores: ${entries.length}
- Con precios conocidos: ${withPrices.length}
- Precio medio: €${avgPrice.toFixed(2)} (rango: €${minPrice.toFixed(2)}–€${maxPrice.toFixed(2)})
- Score medio calidad: ${avgScore}/100 · Score más alto: ${topScore}/100
- Categorías: ${categoryNames.join(", ")}
- Países principales: ${topCountries.join(", ")}
- Con envío internacional: ${intlShipping} · Con certificaciones: ${certified}

Genera un análisis COMPLETO Y REAL con esta estructura JSON EXACTA (sin texto adicional fuera del JSON):
{
  "executiveSummary": "3-4 párrafos de análisis real del mercado de proveedores, situación competitiva del nicho y conclusiones estratégicas clave.",
  "marketContext": "2 párrafos sobre el panorama competitivo de aprovisionamiento para este nicho, tendencias de precios y oportunidades identificadas.",
  "topPicks": [
    {
      "rank": 1,
      "supplierName": "nombre EXACTO del proveedor de la lista",
      "supplierId": "id EXACTO del proveedor",
      "scenario": "Mejor relación calidad-precio global",
      "reason": "Justificación con datos concretos: score, precios, certificaciones, lead time.",
      "recommendedFor": "Qué productos o volúmenes de venta son ideales con este proveedor"
    }
  ],
  "supplierDeepAnalysis": [
    {
      "supplierId": "id exacto",
      "supplierName": "nombre exacto",
      "category": "categoría",
      "marginAnalysis": {
        "costAvgEur": 0.0,
        "suggestedRetailMin": 0.0,
        "suggestedRetailMax": 0.0,
        "grossMarginPct": 0,
        "revenueAt100Units": 0.0,
        "revenueAt500Units": 0.0,
        "revenueAt1000Units": 0.0,
        "note": "cómo se calculó o 'Sin datos de precio — solicitar cotización'"
      },
      "contractingPlan": {
        "starter": "Plan inicio: volúmenes, pedido mínimo inicial, inversión estimada €, plazo de prueba",
        "growth": "Plan crecimiento: volúmenes medios, negociación 6 meses, inversión y descuentos esperados",
        "scale": "Plan escala: contrato anual, volúmenes altos, mejor precio/u. y condiciones especiales"
      },
      "hiringRecommendation": "Si conviene tener personal/freelance especializado para gestionar este proveedor (ej: traductor chino, agente de compras, QC inspector)",
      "riskLevel": "low|medium|high",
      "riskFactors": ["riesgo concreto 1", "riesgo concreto 2"],
      "strengths": ["punto fuerte concreto 1", "punto fuerte concreto 2"],
      "productFit": "Qué productos específicos y situaciones son ideales para este proveedor"
    }
  ],
  "categoryComparison": [
    {
      "category": "nombre categoría",
      "suppliersInCategory": 0,
      "bestSupplier": "nombre del mejor",
      "worstSupplier": "nombre del peor o más arriesgado",
      "avgScore": 0,
      "avgPriceRange": "€X – €Y",
      "priceSpread": "diferencia % entre el más barato y el más caro",
      "recommendation": "recomendación estratégica concreta para esta categoría"
    }
  ],
  "competitiveMatrix": {
    "priceLeader": "nombre del proveedor más económico y por qué",
    "qualityLeader": "nombre del proveedor con mejor calidad/fiabilidad y por qué",
    "speedLeader": "nombre del proveedor con menor lead time y por qué",
    "bestCertified": "nombre del proveedor con mejores certificaciones",
    "bestInternational": "mejor proveedor para envío internacional"
  },
  "riskMatrix": {
    "geographic": "análisis riesgo de concentración geográfica (si todos son de un país, etc.)",
    "moq": "análisis riesgo de pedidos mínimos (si el MOQ es demasiado alto para empezar)",
    "leadTime": "análisis riesgo de plazos (si alguno tiene lead times críticos)",
    "financial": "riesgo financiero del portfolio (inversión mínima para trabajar con todos)",
    "overall": "evaluación global del riesgo del portfolio de proveedores 1-10"
  },
  "contractingPlanGeneral": {
    "starter": "Plan de inicio para la tienda: qué proveedor/es elegir primero, volúmenes, inversión inicial estimada total",
    "growth": "Plan de crecimiento a 6-12 meses: qué combinar, cómo diversificar, inversión estimada",
    "scale": "Plan de escala para alta facturación: red completa de proveedores, inversión total, estructuras de negociación"
  },
  "hiringPlan": {
    "immediate": "Qué perfil contratar/externalizar de forma inmediata para gestionar proveedores eficientemente",
    "growth": "Qué equipo construir cuando la tienda escale (buyer, QC, logística)",
    "tools": "Herramientas recomendadas (ERP, PIM, herramienta de compras) para gestionar el portfolio"
  },
  "keyRecommendations": [
    "recomendación concreta y accionable 1",
    "recomendación concreta y accionable 2",
    "recomendación concreta y accionable 3",
    "recomendación concreta y accionable 4",
    "recomendación concreta y accionable 5"
  ],
  "nextSteps": [
    "paso accionable inmediato 1 (esta semana)",
    "paso accionable a corto plazo 2 (este mes)",
    "paso accionable a medio plazo 3 (próximo trimestre)"
  ]
}

REGLAS CRÍTICAS:
1. marginAnalysis.costAvgEur SOLO si el proveedor tiene priceRangeMin o priceRangeMax. Si no, pon 0 y nota.
2. Para el margen usa markup estándar Shopify: 2.5x–3.5x (PVP = coste × 2.5 a 3.5). Margen bruto = (PVP–coste)/PVP × 100.
3. topPicks: mínimo 3 picks, máximo 5. Solo proveedores reales de la lista.
4. Cada supplierDeepAnalysis debe existir para TODOS los proveedores de la lista.
5. Devuelve SOLO JSON válido, sin explicaciones fuera del JSON.`;

      interface SupplierReportAI {
        executiveSummary?: string;
        marketContext?: string;
        topPicks?: Array<{ rank?: number; supplierName?: string; supplierId?: string; scenario?: string; reason?: string; recommendedFor?: string }>;
        supplierDeepAnalysis?: Array<{
          supplierId?: string; supplierName?: string; category?: string;
          marginAnalysis?: { costAvgEur?: number; suggestedRetailMin?: number; suggestedRetailMax?: number; grossMarginPct?: number; revenueAt100Units?: number; revenueAt500Units?: number; revenueAt1000Units?: number; note?: string };
          contractingPlan?: { starter?: string; growth?: string; scale?: string };
          hiringRecommendation?: string;
          riskLevel?: string; riskFactors?: string[]; strengths?: string[]; productFit?: string;
        }>;
        categoryComparison?: Array<{ category?: string; suppliersInCategory?: number; bestSupplier?: string; worstSupplier?: string; avgScore?: number; avgPriceRange?: string; priceSpread?: string; recommendation?: string }>;
        competitiveMatrix?: { priceLeader?: string; qualityLeader?: string; speedLeader?: string; bestCertified?: string; bestInternational?: string };
        riskMatrix?: { geographic?: string; moq?: string; leadTime?: string; financial?: string; overall?: string };
        contractingPlanGeneral?: { starter?: string; growth?: string; scale?: string };
        hiringPlan?: { immediate?: string; growth?: string; tools?: string };
        keyRecommendations?: string[];
        nextSteps?: string[];
      }

      let ai: SupplierReportAI = {};
      try {
        ai = await askClaudeJsonWithBrain<SupplierReportAI>(
          projectIdNum,
          reportPrompt,
          "Eres un CFO y consultor de aprovisionamiento de nivel C-suite. Devuelves SOLO JSON válido con análisis profundo y cifras reales derivadas de los datos del proveedor.",
          "pricing",
          niche || undefined,
          16000,
          180_000,
        ) as SupplierReportAI;
      } catch (aiErr: any) {
        console.warn("[SupplierReport] Claude AI failed:", aiErr?.message?.slice(0, 200));
      }

      // ─── STYLE HELPERS ────────────────────────────────────────────────────────
      const scoreCol = (s: number) => s >= 80 ? "#15803d" : s >= 60 ? "#1e40af" : s >= 40 ? "#b45309" : "#991b1b";
      const riskCol = (r: string) => r === "low" ? "#15803d" : r === "medium" ? "#b45309" : "#991b1b";
      const riskLbl = (r: string) => r === "low" ? "Riesgo Bajo" : r === "medium" ? "Riesgo Medio" : "Riesgo Alto";
      const fmtEur = (n: number) => `€${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fmtRev = (n: number) => `€${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

      // ─── BUILD HTML SECTIONS ─────────────────────────────────────────────────
      const sections: string[] = [];

      // 1. EXECUTIVE SUMMARY
      sections.push(`
        <div class="exec-summary">
          <h2>📋 Resumen Ejecutivo</h2>
          <p>${esc(ai.executiveSummary ?? `Este informe analiza ${entries.length} proveedores reales identificados mediante investigación IA para la tienda ${storeName} (nicho: ${niche || "eCommerce"}).`)}</p>
          ${ai.marketContext ? `<p>${esc(ai.marketContext)}</p>` : ""}
        </div>`);

      // 2. KPI DASHBOARD
      sections.push(`
        <h2>📊 Dashboard de Estadísticas Comparativas</h2>
        <div class="kpi-grid">
          <div class="kpi-card kpi-blue"><div class="kpi-num">${entries.length}</div><div class="kpi-label">Proveedores analizados</div></div>
          <div class="kpi-card kpi-green"><div class="kpi-num">${categoryNames.length}</div><div class="kpi-label">Categorías de producto</div></div>
          <div class="kpi-card kpi-purple"><div class="kpi-num">${topCountries.length > 0 ? topCountries[0] : "—"}</div><div class="kpi-label">País predominante</div></div>
          <div class="kpi-card kpi-gold"><div class="kpi-num">${avgScore}/100</div><div class="kpi-label">Score medio de calidad</div></div>
          ${avgPrice > 0 ? `<div class="kpi-card kpi-teal"><div class="kpi-num">${fmtEur(avgPrice)}</div><div class="kpi-label">Precio promedio/unidad</div></div>` : ""}
          ${withPrices.length > 1 ? `<div class="kpi-card kpi-red"><div class="kpi-num">${fmtEur(minPrice)} – ${fmtEur(maxPrice)}</div><div class="kpi-label">Rango total de precios</div></div>` : ""}
          <div class="kpi-card kpi-teal"><div class="kpi-num">${intlShipping}</div><div class="kpi-label">Con envío internacional</div></div>
          <div class="kpi-card kpi-green"><div class="kpi-num">${certified}</div><div class="kpi-label">Con certificaciones</div></div>
          <div class="kpi-card kpi-gold"><div class="kpi-num">${starredCount}</div><div class="kpi-label">Marcados como favoritos</div></div>
        </div>`);

      // 3. TOP PICKS
      const topPicks = ai.topPicks ?? [];
      if (topPicks.length > 0) {
        const pickCards = topPicks.map((p, i) => `
          <div class="pick-card">
            <div class="pick-rank">#${p.rank ?? (i + 1)}</div>
            <div class="pick-body">
              <div class="pick-name">${esc(p.supplierName ?? "—")}</div>
              <div class="pick-scenario">🎯 ${esc(p.scenario ?? "")}</div>
              <p class="pick-reason">${esc(p.reason ?? "")}</p>
              ${p.recommendedFor ? `<div class="pick-for">Ideal para: <strong>${esc(p.recommendedFor)}</strong></div>` : ""}
            </div>
          </div>`).join("");
        sections.push(`<h2>🏆 Top Picks — Proveedores Recomendados por Escenario</h2><div class="picks-grid">${pickCards}</div>`);
      }

      // 4. FULL COMPARATIVE MATRIX
      const matrixRows = entries.map(e => {
        const price = (e.priceRangeMin != null && e.priceRangeMax != null)
          ? `€${e.priceRangeMin}–€${e.priceRangeMax}`
          : e.priceRangeMin != null ? `desde €${e.priceRangeMin}` : "—";
        const sc = e.score ?? 0;
        const safeWeb = safeHttpUrl(e.website);
        const contact = [
          e.contactEmail ? `<span style="font-size:10px">${esc(e.contactEmail)}</span>` : null,
          e.contactPhone ? `<span style="font-size:10px">${esc(e.contactPhone)}</span>` : null,
        ].filter(Boolean).join("<br/>") || "—";
        return `<tr>
          <td>
            <strong>${esc(e.name)}</strong>${e.starred === 1 ? ' ⭐' : ''}
            <br/><span style="color:#64748b;font-size:10px">${esc(e.country ?? "")}${e.region ? ` · ${esc(e.region)}` : ""}</span>
          </td>
          <td>${esc(e.category ?? "—")}</td>
          <td style="text-align:center">
            <span style="background:${scoreCol(sc)};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${sc}/100</span>
          </td>
          <td>${price}<br/><span style="color:#64748b;font-size:10px">MOQ: ${esc(e.moq ?? "—")}</span></td>
          <td style="text-align:center">${esc(e.leadDays ?? "—")}</td>
          <td style="text-align:center">${e.shipsInternationally === 1 ? '<span style="color:#15803d">✅</span>' : '<span style="color:#94a3b8">—</span>'}</td>
          <td style="font-size:10px">${esc(e.certifications ?? "—")}</td>
          <td>${safeWeb ? `<a href="${esc(safeWeb)}" target="_blank" style="font-size:10px">${esc(safeWeb.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 28))}</a>` : "—"}<br/>${contact}</td>
          <td style="font-size:10px;color:#475569">${esc((e.notes ?? "").slice(0, 100))}${(e.notes ?? "").length > 100 ? "…" : ""}</td>
        </tr>`;
      }).join("");

      sections.push(`
        <h2>📋 Matriz Comparativa Completa — ${entries.length} Proveedores</h2>
        <table>
          <thead><tr>
            <th>Proveedor</th><th>Categoría</th><th style="text-align:center">Score</th>
            <th>Precio/u.</th><th style="text-align:center">Lead Time</th><th style="text-align:center">Intl</th>
            <th>Certificaciones</th><th>Web / Contacto</th><th>Notas IA</th>
          </tr></thead>
          <tbody>${matrixRows}</tbody>
        </table>`);

      // 5. MARGIN & REVENUE ANALYSIS
      const deepAnalysis = ai.supplierDeepAnalysis ?? [];
      const deepWithMargin = deepAnalysis.filter(a => (a.marginAnalysis?.costAvgEur ?? 0) > 0);
      if (deepWithMargin.length > 0) {
        const marginRows = deepAnalysis.map(a => {
          const m = a.marginAnalysis ?? {};
          const hasCost = (m.costAvgEur ?? 0) > 0;
          const mgn = m.grossMarginPct ?? 0;
          return `<tr>
            <td><strong>${esc(a.supplierName ?? "—")}</strong><br/><span style="color:#64748b;font-size:10px">${esc(a.category ?? "")}</span></td>
            <td style="text-align:right;font-weight:700">${hasCost ? fmtEur(m.costAvgEur!) : '—'}</td>
            <td style="text-align:right">${hasCost ? `${fmtEur(m.suggestedRetailMin!)} – ${fmtEur(m.suggestedRetailMax!)}` : '—'}</td>
            <td style="text-align:center">
              ${hasCost
                ? `<span style="background:${mgn >= 55 ? '#15803d' : mgn >= 40 ? '#1e40af' : mgn >= 25 ? '#b45309' : '#991b1b'};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${Math.round(mgn)}%</span>`
                : '—'}
            </td>
            <td style="text-align:right">${hasCost ? fmtRev(m.revenueAt100Units!) : '—'}</td>
            <td style="text-align:right">${hasCost ? fmtRev(m.revenueAt500Units!) : '—'}</td>
            <td style="text-align:right">${hasCost ? fmtRev(m.revenueAt1000Units!) : '—'}</td>
            <td style="font-size:10px;color:#64748b">${esc(m.note ?? (hasCost ? "" : "Solicitar cotización"))}</td>
          </tr>`;
        }).join("");

        sections.push(`
          <h2>💰 Análisis de Márgenes y Revenue Estimado por Proveedor</h2>
          <p class="note-text">* Estimaciones basadas en rangos de precio del proveedor con markup Shopify estándar (2.5×–3.5×). Revenue neto = (PVP – Coste) × Unidades/mes. Verificar con cotizaciones reales antes de comprometer presupuesto.</p>
          <table>
            <thead><tr>
              <th>Proveedor</th>
              <th style="text-align:right">Coste/u.</th>
              <th style="text-align:right">PVP sugerido</th>
              <th style="text-align:center">Margen bruto</th>
              <th style="text-align:right">Revenue 100 u/mes</th>
              <th style="text-align:right">Revenue 500 u/mes</th>
              <th style="text-align:right">Revenue 1.000 u/mes</th>
              <th>Nota</th>
            </tr></thead>
            <tbody>${marginRows}</tbody>
          </table>`);
      }

      // 6. CATEGORY COMPARISON
      const catComp = ai.categoryComparison ?? [];
      if (catComp.length > 0) {
        const catRows = catComp.map(c => `<tr>
          <td><strong>${esc(c.category ?? "—")}</strong></td>
          <td style="text-align:center">${c.suppliersInCategory ?? "—"}</td>
          <td><strong style="color:#15803d">${esc(c.bestSupplier ?? "—")}</strong></td>
          <td style="color:#991b1b">${esc(c.worstSupplier ?? "—")}</td>
          <td style="text-align:center">${c.avgScore ?? "—"}/100</td>
          <td>${esc(c.avgPriceRange ?? "—")}</td>
          <td style="font-size:11px;color:#475569">${esc(c.priceSpread ?? "—")}</td>
          <td style="font-size:11px">${esc(c.recommendation ?? "—")}</td>
        </tr>`).join("");
        sections.push(`
          <h2>🗂️ Comparativa por Categoría de Producto</h2>
          <table>
            <thead><tr>
              <th>Categoría</th><th style="text-align:center">N.º</th><th>Mejor proveedor</th><th>Mayor riesgo</th>
              <th style="text-align:center">Score medio</th><th>Rango precios</th><th>Diferencial precio</th><th>Recomendación</th>
            </tr></thead>
            <tbody>${catRows}</tbody>
          </table>`);
      }

      // 7. COMPETITIVE MATRIX
      const compMat = ai.competitiveMatrix;
      if (compMat) {
        sections.push(`
          <h2>🥇 Matriz Competitiva — Líderes por Criterio</h2>
          <table>
            <tbody>
              <tr><td class="matrix-label">💸 Líder en Precio</td><td>${esc(compMat.priceLeader ?? "—")}</td></tr>
              <tr><td class="matrix-label">⭐ Líder en Calidad</td><td>${esc(compMat.qualityLeader ?? "—")}</td></tr>
              <tr><td class="matrix-label">⚡ Líder en Velocidad</td><td>${esc(compMat.speedLeader ?? "—")}</td></tr>
              <tr><td class="matrix-label">🏅 Mejor Certificado</td><td>${esc(compMat.bestCertified ?? "—")}</td></tr>
              <tr><td class="matrix-label">🌍 Mejor Internacional</td><td>${esc(compMat.bestInternational ?? "—")}</td></tr>
            </tbody>
          </table>`);
      }

      // 8. CONTRACTING PLANS PER SUPPLIER (top 6)
      if (deepAnalysis.length > 0) {
        const planCards = deepAnalysis.slice(0, 8).map(a => {
          const plan = a.contractingPlan ?? {};
          const rl = a.riskLevel ?? "medium";
          return `
            <div class="plan-card">
              <div class="plan-header">
                <span class="plan-name">${esc(a.supplierName ?? "—")}</span>
                <span class="plan-risk" style="background:${riskCol(rl)}">${riskLbl(rl)}</span>
              </div>
              <div style="font-size:11px;color:#475569;margin-bottom:8px">${esc(a.category ?? "")}</div>
              ${a.strengths?.length ? `<div class="plan-strengths">${a.strengths.map(s => `✅ ${esc(s)}`).join(" &nbsp;·&nbsp; ")}</div>` : ""}
              ${a.riskFactors?.length ? `<div class="plan-risks">${a.riskFactors.map(s => `⚠️ ${esc(s)}`).join(" &nbsp;·&nbsp; ")}</div>` : ""}
              <table class="plan-table">
                <tr><td class="plan-tier tier-starter">🌱 Starter</td><td>${esc(plan.starter ?? "—")}</td></tr>
                <tr><td class="plan-tier tier-growth">🚀 Growth</td><td>${esc(plan.growth ?? "—")}</td></tr>
                <tr><td class="plan-tier tier-scale">⚡ Scale</td><td>${esc(plan.scale ?? "—")}</td></tr>
              </table>
              ${a.hiringRecommendation ? `<div class="plan-hiring">👥 Personal recomendado: ${esc(a.hiringRecommendation)}</div>` : ""}
              ${a.productFit ? `<div style="margin-top:8px;font-size:11px;color:#475569"><strong>Ideal para:</strong> ${esc(a.productFit)}</div>` : ""}
            </div>`;
        }).join("");
        sections.push(`<h2>📄 Planes de Contratación por Proveedor</h2><div class="plans-grid">${planCards}</div>`);
      }

      // 9. RISK MATRIX
      const riskMat = ai.riskMatrix;
      if (riskMat?.overall) {
        sections.push(`
          <h2>⚠️ Matriz de Riesgo del Portfolio de Proveedores</h2>
          <table>
            <tbody>
              <tr><td class="matrix-label">🌍 Riesgo Geográfico</td><td>${esc(riskMat.geographic ?? "—")}</td></tr>
              <tr><td class="matrix-label">📦 Riesgo MOQ</td><td>${esc(riskMat.moq ?? "—")}</td></tr>
              <tr><td class="matrix-label">⏱️ Riesgo Lead Time</td><td>${esc(riskMat.leadTime ?? "—")}</td></tr>
              <tr><td class="matrix-label">💶 Riesgo Financiero</td><td>${esc(riskMat.financial ?? "—")}</td></tr>
              <tr class="risk-overall"><td class="matrix-label">📊 Evaluación Global</td><td><strong>${esc(riskMat.overall ?? "—")}</strong></td></tr>
            </tbody>
          </table>`);
      }

      // 10. GENERAL CONTRACTING PLAN
      const genPlan = ai.contractingPlanGeneral;
      if (genPlan?.starter || genPlan?.growth || genPlan?.scale) {
        sections.push(`
          <h2>🗓️ Plan General de Contratación para ${esc(storeName)}</h2>
          <table>
            <tbody>
              <tr><td class="plan-tier tier-starter" style="width:120px">🌱 Starter</td><td>${esc(genPlan.starter ?? "—")}</td></tr>
              <tr><td class="plan-tier tier-growth">🚀 Growth</td><td>${esc(genPlan.growth ?? "—")}</td></tr>
              <tr><td class="plan-tier tier-scale">⚡ Scale</td><td>${esc(genPlan.scale ?? "—")}</td></tr>
            </tbody>
          </table>`);
      }

      // 11. HIRING PLAN
      const hiringPlan = ai.hiringPlan;
      if (hiringPlan?.immediate || hiringPlan?.growth || hiringPlan?.tools) {
        sections.push(`
          <h2>👥 Plan de Contratación y Recursos Humanos</h2>
          <table>
            <tbody>
              <tr><td class="matrix-label">🔴 Inmediato</td><td>${esc(hiringPlan.immediate ?? "—")}</td></tr>
              <tr><td class="matrix-label">🟡 Al escalar</td><td>${esc(hiringPlan.growth ?? "—")}</td></tr>
              <tr><td class="matrix-label">🛠️ Herramientas</td><td>${esc(hiringPlan.tools ?? "—")}</td></tr>
            </tbody>
          </table>`);
      }

      // 12. KEY RECOMMENDATIONS
      const recs = ai.keyRecommendations ?? [];
      if (recs.length > 0) {
        const recList = recs.map((r, i) => `<li><span class="rec-num">${i + 1}</span>${esc(r)}</li>`).join("");
        sections.push(`<h2>✅ Recomendaciones Estratégicas Clave</h2><ul class="recs-list">${recList}</ul>`);
      }

      // 13. NEXT STEPS
      const steps = ai.nextSteps ?? [];
      if (steps.length > 0) {
        const stepDivs = steps.map((s, i) => `<div class="next-step"><span class="step-num">${i + 1}</span><span>${esc(s)}</span></div>`).join("");
        sections.push(`<h2>▶️ Próximos Pasos Accionables</h2><div class="steps-list">${stepDivs}</div>`);
      }

      // 14. FULL PRODUCT CATALOGUE PER SUPPLIER (appendix)
      sections.push(`
        <h2>📑 Apéndice — Catálogo de Productos por Proveedor</h2>
        <table>
          <thead><tr>
            <th>Proveedor</th><th>País</th><th>Productos / Servicios Ofrecidos</th>
            <th>Condiciones de Pago</th><th>Certificaciones</th><th>Fuente / Contacto</th>
          </tr></thead>
          <tbody>
            ${entries.map(e => {
              const safeWeb = safeHttpUrl(e.website);
              return `<tr>
                <td><strong>${esc(e.name)}</strong><br/><span style="color:#64748b;font-size:10px">Score: ${e.score ?? "—"}/100</span></td>
                <td>${esc(e.country ?? "—")}${e.region ? `<br/><span style="font-size:10px;color:#64748b">${esc(e.region)}</span>` : ""}</td>
                <td style="font-size:11px">${esc(e.productsOffered ?? "—")}</td>
                <td style="font-size:11px">${esc(e.paymentTerms ?? "—")}</td>
                <td style="font-size:10px">${esc(e.certifications ?? "—")}</td>
                <td style="font-size:10px">
                  ${safeWeb ? `<a href="${esc(safeWeb)}" target="_blank">${esc(safeWeb.replace(/^https?:\/\//, "").slice(0, 30))}</a><br/>` : ""}
                  ${e.contactEmail ? `<span style="color:#475569">${esc(e.contactEmail)}</span><br/>` : ""}
                  ${e.contactPhone ? `<span style="color:#475569">${esc(e.contactPhone)}</span>` : ""}
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`);

      // ─── EXTRA CSS ────────────────────────────────────────────────────────────
      const extraCss = `
        .kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:16px 0 28px}
        .kpi-card{border-radius:10px;padding:16px;text-align:center;border:1px solid transparent}
        .kpi-blue{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe}.kpi-blue .kpi-num{color:#1d4ed8}
        .kpi-green{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-color:#bbf7d0}.kpi-green .kpi-num{color:#15803d}
        .kpi-purple{background:linear-gradient(135deg,#faf5ff,#ede9fe);border-color:#ddd6fe}.kpi-purple .kpi-num{color:#7c3aed}
        .kpi-gold{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fde68a}.kpi-gold .kpi-num{color:#b45309}
        .kpi-teal{background:linear-gradient(135deg,#f0fdfa,#ccfbf1);border-color:#99f6e4}.kpi-teal .kpi-num{color:#0f766e}
        .kpi-red{background:linear-gradient(135deg,#fff1f2,#ffe4e6);border-color:#fecdd3}.kpi-red .kpi-num{color:#be123c}
        .kpi-num{font-size:20px;font-weight:800;margin-bottom:4px}
        .kpi-label{font-size:11px;color:#475569}
        .exec-summary{background:#f0fdf4;border-left:4px solid #16a34a;padding:18px 22px;margin:16px 0 28px;border-radius:0 10px 10px 0}
        .exec-summary p{color:#166534;line-height:1.7;margin:0 0 10px}
        .picks-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;margin:16px 0 28px}
        .pick-card{display:flex;gap:14px;background:linear-gradient(135deg,#fefce8,#fef9c3);border:1px solid #fde68a;border-radius:12px;padding:16px}
        .pick-rank{font-size:32px;font-weight:900;color:#ca8a04;min-width:44px;text-align:center;line-height:1}
        .pick-name{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:3px}
        .pick-scenario{font-size:11px;color:#6d28d9;font-weight:600;margin-bottom:6px}
        .pick-reason{font-size:12px;color:#475569;line-height:1.5;margin:0 0 6px}
        .pick-for{font-size:11px;color:#064e3b;background:#d1fae5;padding:4px 10px;border-radius:6px;display:inline-block}
        .plans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;margin:16px 0 28px}
        .plan-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
        .plan-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .plan-name{font-size:14px;font-weight:700;color:#1e293b}
        .plan-risk{color:#fff;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700}
        .plan-strengths{font-size:11px;color:#166534;margin-bottom:4px;line-height:1.6}
        .plan-risks{font-size:11px;color:#92400e;margin-bottom:8px;line-height:1.6}
        .plan-table{font-size:11px;margin-top:10px;width:100%}
        .plan-table td{padding:4px 6px;vertical-align:top}
        .plan-tier{font-weight:700;white-space:nowrap;padding-right:10px!important}
        .tier-starter{color:#15803d}.tier-growth{color:#1e40af}.tier-scale{color:#6d28d9}
        .plan-hiring{margin-top:10px;padding:8px 12px;background:#eff6ff;border-radius:6px;font-size:11px;color:#1e40af}
        .matrix-label{font-weight:700;color:#475569;width:180px;white-space:nowrap}
        .risk-overall td{background:#fef9c3;font-size:13px}
        .recs-list{list-style:none;padding:0;margin:16px 0 28px}
        .recs-list li{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-left:3px solid #3b82f6;margin-bottom:10px;background:#eff6ff;border-radius:0 8px 8px 0;font-size:13px;color:#1e40af;line-height:1.5}
        .rec-num{width:24px;height:24px;background:#2563eb;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
        .steps-list{display:flex;flex-direction:column;gap:10px;margin:16px 0 28px}
        .next-step{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#166534;line-height:1.5}
        .step-num{width:28px;height:28px;background:#16a34a;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
        .note-text{font-size:11px;color:#64748b;font-style:italic;margin:-8px 0 16px;padding:8px 12px;background:#f8fafc;border-radius:6px}
      `;

      const body = `<style>${extraCss}</style>\n` + sections.join("\n");
      const shell = getReportShell("prestige");
      const html = shell(
        `Análisis Comparativo de Proveedores`,
        `${storeName} · ${niche || "eCommerce"} · ${entries.length} proveedores analizados · ${today}`,
        body,
        today,
        storeName,
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="analisis-comparativo-proveedores-${projectIdNum}-${Date.now()}.html"`,
      );
      res.send(html);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Internal server error" });
    }
  },
);

router.get("/gemini/status", async (_req, res): Promise<void> => {
  res.json(getGeminiStatus());
});

router.post("/gemini/reset", async (_req, res): Promise<void> => {
  const result = resetGeminiCircuitBreakers();
  res.json({ ok: true, ...result, message: "Circuit breakers reseteados. Gemini desbloqueado." });
});

export default router;
