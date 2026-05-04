/**
 * brain-ingester.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ShopyBrain Universal Knowledge Ingestion Engine
 *
 * Every piece of intelligence that passes through the platform — reference
 * images, videos, AI generations, audit results — is automatically parsed and
 * saved back into OmniCore as structured memories + insights.
 *
 * The goal: ShopyBrain learns from EVERYTHING it processes.
 * Fire-and-forget: never throws, never blocks the main request.
 */

import { randomBytes } from "crypto";
import { db, omnicoreMemoriesTable, omnicoreInsightsTable, omnicoreKnowledgeDomainsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getClaudeClient, CLAUDE_MODEL } from "./claude.js";

// ── Domain weights for auto-categorisation ─────────────────────────────────
const DOMAIN_MAP: Record<string, string[]> = {
  visual_production: [
    "cinemat", "composici", "color grad", "iluminaci", "lut", "renderiz",
    "textur", "material", "acabado", "plano", "encuadre", "profundidad",
    "bokeh", "lente", "focal", "exposici", "contraste", "saturaci",
    "temperatura", "edici", "ritmo", "transici", "motion", "vfx",
    "animaci", "produc", "director", "fotograf", "visual",
  ],
  marketing: [
    "mensaje", "narrativa", "historia", "storytell", "cta", "llamada",
    "conversion", "engagement", "audiencia", "publico", "target",
    "propuesta de valor", "claim", "promesa",
  ],
  ecommerce: [
    "producto", "shopify", "tienda", "catalog", "precio", "compra",
    "carrito", "checkout", "ficha", "listing", "descripci",
  ],
  design_ux: [
    "diseño", "ux", "ui", "interfaz", "layout", "tipograf", "paleta",
    "color", "espaciado", "jerarqu", "grid", "branding",
  ],
  consumer_psychology: [
    "emocion", "sentimiento", "confianza", "lujo", "aspiracional",
    "tribu", "identidad", "deseo", "urgencia", "escasez", "social proof",
  ],
  seo_content: [
    "seo", "keyword", "palabra clave", "metatag", "titulo", "descripcion",
    "contenido", "blog", "articulo", "trafico",
  ],
  campaign_production: [
    "campaign", "campaña", "video campaign", "ugc", "lip sync", "lip-sync",
    "storyboard", "voice over", "voice-over", "locuci", "micro-clip",
    "master cut", "character lock", "prompt 9:16", "prompt 16:9",
    "subtitle", "subtítulo", "srt", "deliverable", "entregable",
    "holographic", "holográf", "6 segundo", "6-sec",
  ],
};

function detectDomains(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [domain, keywords] of Object.entries(DOMAIN_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) found.add(domain);
  }
  if (found.size === 0) found.add("general");
  return [...found];
}

// ── Structured insight extraction via Claude ────────────────────────────────
async function extractStructuredInsights(
  rawIntelligence: string,
  sourceLabel: string,
  niche?: string | null
): Promise<Array<{
  domain: string;
  insightType: string;
  title: string;
  insight: string;
  evidence: string;
  confidence: number;
  impactScore: number;
}>> {
  const system = `Eres el motor de aprendizaje de ShopyBrain OmniCore.
Tu tarea: extraer insights estructurados de análisis de contenido para que ShopyBrain aprenda y mejore futuras generaciones.
Responde SOLO con JSON válido, sin texto adicional.`;

  const prompt = `Del siguiente análisis de ${sourceLabel}, extrae 3-6 insights de alto valor para ShopyBrain.

ANÁLISIS:
${rawIntelligence.slice(0, 12000)}

Nicho/contexto: ${niche ?? "general ecommerce"}

Responde exactamente con este JSON:
{
  "insights": [
    {
      "domain": "visual_production|marketing|ecommerce|design_ux|consumer_psychology|seo_content",
      "insightType": "principle|pattern|correlation|opportunity|technique",
      "title": "título corto del insight (máx 80 chars)",
      "insight": "el conocimiento concreto y accionable (máx 300 chars)",
      "evidence": "qué en el análisis lo justifica (máx 150 chars)",
      "confidence": 0.65,
      "impactScore": 0.70
    }
  ]
}`;

  try {
    const client = await getClaudeClient(0);
    const stream = client.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(90_000) }
    );
    const resp = await stream.finalMessage();

    const raw = resp.content[0].type === "text" ? resp.content[0].text : "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return parsed.insights ?? [];
  } catch {
    return [];
  }
}

// ── Bump knowledge domain depth ─────────────────────────────────────────────
async function bumpDomains(domains: string[], insightCount: number): Promise<void> {
  for (const domain of domains) {
    const existing = await db
      .select({ id: omnicoreKnowledgeDomainsTable.id })
      .from(omnicoreKnowledgeDomainsTable)
      .where(eq(omnicoreKnowledgeDomainsTable.domain, domain));

    const depthIncrease = Math.min(5, insightCount);
    if (existing.length > 0) {
      await db.update(omnicoreKnowledgeDomainsTable)
        .set({
          totalInsights: sql`${omnicoreKnowledgeDomainsTable.totalInsights} + ${insightCount}`,
          knowledgeDepth: sql`LEAST(100, ${omnicoreKnowledgeDomainsTable.knowledgeDepth} + ${depthIncrease})`,
          lastStudySession: new Date(),
        })
        .where(eq(omnicoreKnowledgeDomainsTable.domain, domain));
    } else {
      await db.insert(omnicoreKnowledgeDomainsTable).values({
        id: randomBytes(12).toString("hex"),
        domain,
        knowledgeDepth: depthIncrease,
        totalInsights: insightCount,
        verifiedInsights: 0,
        lastStudySession: new Date(),
      });
    }
  }
}

// ── PUBLIC API ──────────────────────────────────────────────────────────────

export interface IngestParams {
  sourceType: "image_reference" | "video_reference" | "ai_generation" | "audit_result" | "competitor_scan" | "manual";
  rawIntelligence: string;
  niche?: string | null;
  productType?: string | null;
  title?: string;
  memoryType?: string;
  confidence?: number;
  skipStructuredExtraction?: boolean;
}

/**
 * ingestToShopyBrain
 *
 * Takes ANY intelligence string and saves it into OmniCore as:
 *  1. A raw memory (immediate, synchronous within fire-and-forget)
 *  2. 3-6 structured insights extracted by Claude (async)
 *
 * NEVER THROWS — fire-and-forget from any route.
 */
export function ingestToShopyBrain(params: IngestParams): void {
  const {
    sourceType, rawIntelligence, niche, productType, title,
    memoryType, confidence = 0.70, skipStructuredExtraction = false,
  } = params;

  const memTypeMap: Record<string, string> = {
    image_reference: "image_pattern",
    video_reference: "image_pattern",
    ai_generation: "prompt_template",
    audit_result: "niche_keyword",
    competitor_scan: "competitor_intel",
    manual: "general",
    campaign_production: "prompt_template",
    campaign_adaptation: "prompt_template",
    video_campaign: "prompt_template",
    ugc_clip: "prompt_template",
    storyboard: "prompt_template",
  };

  const resolvedMemType = memoryType ?? memTypeMap[sourceType] ?? "general";
  const resolvedTitle = (title ?? `${sourceType} — ${new Date().toISOString().slice(0, 10)}`).slice(0, 200);
  const domains = detectDomains(rawIntelligence);

  // 1. Save raw memory immediately (no await — fire and forget)
  db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType: resolvedMemType,
    niche: niche ?? null,
    productType: productType ?? null,
    market: "es",
    title: resolvedTitle,
    content: rawIntelligence.slice(0, 10000),
    confidence,
    sourceType: `ingest_${sourceType}`,
    tags: JSON.stringify(domains),
    isVerified: 0,
    useCount: 1,
    successCount: 1,
    successRate: 0.8,
  }).catch(() => {});

  // 2. Extract structured insights + bump domains (async, non-blocking)
  if (!skipStructuredExtraction && rawIntelligence.length > 200) {
    extractStructuredInsights(rawIntelligence, sourceType, niche)
      .then(async (insights) => {
        for (const ins of insights) {
          await db.insert(omnicoreInsightsTable).values({
            id: randomBytes(16).toString("hex"),
            domain: ins.domain,
            insightType: ins.insightType,
            title: ins.title,
            insight: ins.insight,
            evidence: ins.evidence,
            confidence: ins.confidence,
            impactScore: ins.impactScore,
            relatedDomains: JSON.stringify(domains),
            source: `ingest_${sourceType}`,
            timesApplied: 0,
          }).catch(() => {});
        }

        // Bump all detected domains
        const allDomains = [...new Set([...domains, ...insights.map(i => i.domain)])];
        await bumpDomains(allDomains, insights.length).catch(() => {});
      })
      .catch(() => {});
  }
}

/**
 * ingestVideoKnowledge — specialized ingester for cinematic/video analysis.
 * Extracts and saves visual production knowledge in maximum detail.
 */
export function ingestVideoKnowledge(params: {
  intelligence: string;
  niche?: string | null;
  videoUrl?: string;
  title?: string;
}): void {
  ingestToShopyBrain({
    sourceType: "video_reference",
    rawIntelligence: params.intelligence,
    niche: params.niche,
    title: params.title ?? `Video reference: ${params.videoUrl ?? "unknown"}`,
    memoryType: "image_pattern",
    confidence: 0.72,
  });
}

/**
 * ingestImageKnowledge — specialized ingester for visual/image analysis.
 */
export function ingestImageKnowledge(params: {
  intelligence: string;
  niche?: string | null;
  imageCount?: number;
  title?: string;
}): void {
  ingestToShopyBrain({
    sourceType: "image_reference",
    rawIntelligence: params.intelligence,
    niche: params.niche,
    title: params.title ?? `Image reference (${params.imageCount ?? 1} imgs)`,
    memoryType: "image_pattern",
    confidence: 0.75,
  });
}
