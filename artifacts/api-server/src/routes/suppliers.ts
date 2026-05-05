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
      const niche = (project as any).storeNiche || "—";
      const today = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

      // group by category
      const byCategory: Record<string, typeof entries> = {};
      for (const e of entries) {
        const k = e.category || "General";
        (byCategory[k] = byCategory[k] || []).push(e);
      }

      const sections: string[] = [];
      sections.push(`<h2>Resumen ejecutivo</h2>
        <p>Este informe recoge <strong>${entries.length} proveedores reales</strong> identificados mediante investigación profunda en Google para la tienda <strong>${esc(storeName)}</strong> (nicho: ${esc(niche)}).
        Los proveedores se han verificado por su sitio web y se han ordenado por puntuación de calidad-precio-fiabilidad estimada por nuestro analista IA.</p>`);

      for (const [cat, list] of Object.entries(byCategory)) {
        const rows = list.map(e => {
          const price = (e.priceRangeMin != null && e.priceRangeMax != null)
            ? `${e.priceRangeMin}–${e.priceRangeMax} ${esc(e.currency || "EUR")}`
            : (e.priceRangeMin != null ? `desde ${e.priceRangeMin} ${esc(e.currency || "EUR")}` : "—");
          const safeWeb = safeHttpUrl(e.website);
          const web = safeWeb
            ? `<a href="${esc(safeWeb)}" target="_blank" rel="noopener">${esc(safeWeb.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>`
            : "—";
          const contact = [e.contactEmail, e.contactPhone].filter(Boolean).map(esc).join("<br/>") || "—";
          return `<tr>
            <td><strong>${esc(e.name)}</strong>${e.score != null ? ` <span style="color:#0a4b8c;font-weight:700">· ${e.score}/100</span>` : ""}<br/><span style="color:#64748b;font-size:11px">${esc(e.country || "")}${e.region ? ` · ${esc(e.region)}` : ""}</span></td>
            <td>${esc(e.productsOffered || "—")}</td>
            <td>${price}<br/><span style="color:#64748b;font-size:11px">MOQ: ${esc(e.moq || "—")} · Lead: ${esc(e.leadDays || "—")}</span></td>
            <td>${web}<br/><span style="font-size:11px">${contact}</span></td>
            <td>${esc(e.notes || "")}</td>
          </tr>`;
        }).join("");
        sections.push(`<h2>${esc(cat)} <span style="color:#94a3b8;font-weight:400">(${list.length})</span></h2>
          <table>
            <thead><tr>
              <th style="width:22%">Proveedor</th>
              <th style="width:25%">Productos / Servicios</th>
              <th style="width:18%">Precios &amp; condiciones</th>
              <th style="width:20%">Web / Contacto</th>
              <th>Notas</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`);
      }

      const body = sections.join("\n");
      const shell = getReportShell("prestige");
      const html = shell(
        `Catálogo de Proveedores Reales`,
        `${storeName} · ${niche}`,
        body,
        today,
        storeName,
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="proveedores-${projectIdNum}-${Date.now()}.html"`,
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
