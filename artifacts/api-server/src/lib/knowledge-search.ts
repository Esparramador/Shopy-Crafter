import { db, omnicoreInsightsTable, omnicorePromptLibraryTable } from "@workspace/db";
import { sql, desc, gte, or, ilike } from "drizzle-orm";
import { logger } from "./logger.js";

const USE_CASE_DOMAIN_MAP: Record<string, string[]> = {
  redesign:      ["design_ux", "creative-arts", "prompt-engineering", "ecommerce", "consumer_psychology", "merchandising", "2d-photoshop", "image-processing"],
  seo:           ["seo_content", "seo", "programming", "ecommerce", "marketing", "shopify_technical"],
  pricing:       ["pricing_science", "financial_analysis", "ecommerce", "marketing", "trained-knowledge", "investment"],
  images:        ["image-processing", "creative-arts", "2d-photoshop", "prompt-engineering", "ai-model-logic", "visual_production", "design_ux"],
  general:       ["ecommerce", "shopify_technical", "marketing", "seo_content", "programming", "trained-knowledge"],
  inventory:     ["ecommerce", "logistics", "marketing"],
  competitors:   ["ecommerce", "marketing", "pricing_science", "financial_analysis"],
  intelligence:  ["artificial-intelligence", "ai-model-logic", "trained-knowledge", "academic-research", "programming"],
  ab_testing:    ["ecommerce", "marketing", "consumer_psychology", "design_ux"],
  ecommerce:     ["ecommerce", "shopify_technical", "marketing", "seo_content", "pricing_science", "consumer_psychology"],
};

const KEYWORD_EXTRACTORS: Record<string, RegExp> = {
  shopify:   /shopif|liquid|theme|template|section|snippet|checkout|storefront|metafield|online.store/i,
  seo:       /seo|keyword|meta.?tag|schema\.org|search.engine|serp|ranking|crawl|index|sitemap/i,
  pricing:   /pric|precio|margen|margin|cogs|p&l|revenue|cost|profit|discount|bundle|upsell/i,
  design:    /design|ux|ui|color|tipogr|font|layout|responsive|accesib|wcag|css|visual/i,
  marketing: /marketing|funnel|email|klaviyo|campaign|conversion|cro|brand|advertis|social|content/i,
  images:    /image|foto|photo|visual|banner|hero|lifestyle|product.shot|render/i,
  finance:   /financ|inversion|invest|cash.?flow|break.?even|forecast|proyecto|ebitda|roi|roas/i,
  ai:        /\bai\b|artificial|machine.learn|neural|model|prompt|generat|diffusion|llm|gpt|claude|gemini/i,
  "3d":      /3d|render|mesh|texture|material|pbr|rigging|sculpt|blender|unreal|unity/i,
  comics:    /comic|manga|illustration|panel|narrative|story|art/i,
  supplier:  /proveedor|supplier|sourcing|alibaba|dropship|fulfillment|import|manufacture/i,
  video:     /video|animation|motion|vfx|edit|produc/i,
  audio:     /audio|sound|music|voice|podcast|speech/i,
};

const STOP_WORDS = new Set(["para", "como", "que", "con", "del", "los", "las", "una", "uno", "este", "esta", "todo", "toda", "más", "pero", "también", "hacer", "quiero", "necesito", "puede", "podría", "dame", "dime", "muestra", "hazme", "the", "and", "for", "with", "from", "that", "this", "have", "what", "about"]);

function extractSearchTerms(query: string, useCase?: string): string[] {
  const terms: string[] = [];
  const lower = query.toLowerCase();

  for (const [category, regex] of Object.entries(KEYWORD_EXTRACTORS)) {
    if (regex.test(lower)) {
      terms.push(category);
    }
  }

  const words = lower
    .replace(/[^\w\sáéíóúñü-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  terms.push(...words.slice(0, 8));

  if (useCase) {
    terms.push(useCase);
  }

  return [...new Set(terms)];
}

export interface KnowledgeSearchResult {
  domain: string;
  title: string;
  insight: string;
  confidence: number;
  relevanceScore: number;
}

const MAX_RESULTS_CAP = 20;
const MIN_CONFIDENCE_FLOOR = 0.3;

export async function searchRelevantKnowledge(
  query: string,
  opts: {
    useCase?: string;
    niche?: string;
    maxResults?: number;
    minConfidence?: number;
  } = {}
): Promise<KnowledgeSearchResult[]> {
  const maxResults = Math.min(Math.max(1, opts.maxResults ?? 15), MAX_RESULTS_CAP);
  const minConfidence = Math.max(MIN_CONFIDENCE_FLOOR, Math.min(1, opts.minConfidence ?? 0.5));
  const { useCase = "general", niche } = opts;

  try {
    const searchTerms = extractSearchTerms(query, useCase);
    if (searchTerms.length === 0) return [];

    const likePatterns = searchTerms.slice(0, 10).map(t => `%${t}%`);

    const conditions = likePatterns.map(pattern =>
      or(
        ilike(omnicoreInsightsTable.title, pattern),
        ilike(omnicoreInsightsTable.insight, pattern),
        ilike(omnicoreInsightsTable.domain, pattern)
      )
    );

    const results = await db
      .select({
        domain: omnicoreInsightsTable.domain,
        title: omnicoreInsightsTable.title,
        insight: omnicoreInsightsTable.insight,
        confidence: omnicoreInsightsTable.confidence,
      })
      .from(omnicoreInsightsTable)
      .where(sql`${omnicoreInsightsTable.confidence} >= ${minConfidence} AND (${sql.join(conditions, sql` OR `)})`)
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(maxResults);

    const priorityDomains = USE_CASE_DOMAIN_MAP[useCase] || USE_CASE_DOMAIN_MAP.general;
    const nicheLC = niche?.toLowerCase();

    return results.map(r => {
      const domainLC = (r.domain || "").toLowerCase();
      let relevance = (r.confidence ?? 0) * 5;
      const domainIdx = priorityDomains.findIndex(d => domainLC.includes(d));
      if (domainIdx >= 0) relevance += 10 - domainIdx;
      if (nicheLC && ((r.insight || "").toLowerCase().includes(nicheLC) || (r.title || "").toLowerCase().includes(nicheLC))) {
        relevance += 3;
      }
      return {
        domain: r.domain || "general",
        title: r.title || "",
        insight: r.insight || "",
        confidence: r.confidence ?? 0,
        relevanceScore: relevance,
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (err) {
    logger.warn({ err }, "Knowledge search failed");
    return [];
  }
}

export async function searchDomainKnowledge(
  useCase: string,
  maxResults = 10,
  minConfidence = 0.65
): Promise<KnowledgeSearchResult[]> {
  const safeMax = Math.min(Math.max(1, maxResults), MAX_RESULTS_CAP);
  const safeConf = Math.max(MIN_CONFIDENCE_FLOOR, Math.min(1, minConfidence));

  try {
    const priorityDomains = USE_CASE_DOMAIN_MAP[useCase] || USE_CASE_DOMAIN_MAP.general;

    const domainConditions = priorityDomains.map(d =>
      ilike(omnicoreInsightsTable.domain, `%${d}%`)
    );

    const results = await db
      .select({
        domain: omnicoreInsightsTable.domain,
        title: omnicoreInsightsTable.title,
        insight: omnicoreInsightsTable.insight,
        confidence: omnicoreInsightsTable.confidence,
      })
      .from(omnicoreInsightsTable)
      .where(sql`${omnicoreInsightsTable.confidence} >= ${safeConf} AND (${sql.join(domainConditions, sql` OR `)})`)
      .orderBy(desc(omnicoreInsightsTable.confidence))
      .limit(safeMax);

    return results.map(r => ({
      domain: r.domain || "general",
      title: r.title || "",
      insight: r.insight || "",
      confidence: r.confidence ?? 0,
      relevanceScore: r.confidence ?? 0,
    }));
  } catch (err) {
    logger.warn({ err }, "Domain knowledge search failed");
    return [];
  }
}

export async function getOmniCorePrompts(): Promise<Array<{ name: string; promptTemplate: string }>> {
  try {
    const results = await db.select({
      name: omnicorePromptLibraryTable.name,
      promptTemplate: omnicorePromptLibraryTable.promptTemplate,
    })
      .from(omnicorePromptLibraryTable)
      .where(ilike(omnicorePromptLibraryTable.name, "OmniCore:%"))
      .limit(10);
    return results;
  } catch {
    return [];
  }
}

const CONTEXT_CHAR_BUDGET = 4000;

export function formatKnowledgeContext(
  results: KnowledgeSearchResult[],
  label = "CONOCIMIENTO OMNICORE RELEVANTE"
): string {
  if (results.length === 0) return "";

  const lines: string[] = [`\n━━━ 🧠 ${label} (${results.length} insights) ━━━`];

  const grouped: Record<string, KnowledgeSearchResult[]> = {};
  for (const r of results) {
    const key = r.domain.split(".")[0].split("/")[0].split(",")[0].trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  let charCount = lines[0].length;
  for (const [domain, items] of Object.entries(grouped)) {
    const header = `\n📚 ${domain}:`;
    charCount += header.length;
    if (charCount > CONTEXT_CHAR_BUDGET) break;
    lines.push(header);
    for (const item of items.slice(0, 4)) {
      const truncInsight = item.insight.length > 200 ? item.insight.slice(0, 200) + "…" : item.insight;
      const line = `  • ${item.title}: ${truncInsight}`;
      charCount += line.length;
      if (charCount > CONTEXT_CHAR_BUDGET) break;
      lines.push(line);
    }
    if (charCount > CONTEXT_CHAR_BUDGET) break;
  }

  lines.push("━━━ FIN CONOCIMIENTO OMNICORE ━━━");
  return lines.join("\n");
}
