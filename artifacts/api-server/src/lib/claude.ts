import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { projectsTable, omnicoreMemoriesTable, omnicorePromptLibraryTable, omnicoreInsightsTable, visualDnaTable, omnicoreAbsorbedContentTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { safeDecrypt } from "./crypto.js";

const platformTypeCache = new Map<number, { value: string; ts: number }>();

async function resolvePlatformType(projectId: number): Promise<string | undefined> {
  const cached = platformTypeCache.get(projectId);
  if (cached && Date.now() - cached.ts < 300_000) return cached.value;
  try {
    const [row] = await db.select({ platformType: projectsTable.platformType }).from(projectsTable).where(eq(projectsTable.id, projectId));
    const val = row?.platformType ?? "shopify";
    platformTypeCache.set(projectId, { value: val, ts: Date.now() });
    return val;
  } catch {
    return undefined;
  }
}

let defaultClient: Anthropic | null = null;

function getDefaultClient(): Anthropic {
  if (!defaultClient) {
    if (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      defaultClient = new Anthropic({
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      });
    } else {
      defaultClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }
  return defaultClient;
}

export async function getClaudeClient(projectId: number): Promise<Anthropic> {
  const [project] = await db
    .select({ anthropicApiKey: projectsTable.anthropicApiKey })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (project?.anthropicApiKey) {
    const plainKey = safeDecrypt(project.anthropicApiKey) || project.anthropicApiKey;
    return new Anthropic({ apiKey: plainKey });
  }
  return getDefaultClient();
}

export const SHOPIFY_EXPERT_SYSTEM = `You are ShopifyAI Expert — world-class Shopify consultant, expert in: product SEO, conversion copywriting, pricing psychology, Liquid templating, email marketing, UX/CRO. You always know which store you're working on via the context provided. Generate complete, production-ready content — never truncate with '...' or 'rest goes here'. Always respond in Spanish unless specifically asked otherwise.`;

const MAX_PROMPT_CHARS = 180000;

function enforcePromptBudget(systemPrompt: string, userContent: string, reserveForOutput = 16000): { system: string; user: string } {
  const charsPerToken = 3.5;
  const maxInputChars = MAX_PROMPT_CHARS - (reserveForOutput * charsPerToken);
  const totalChars = systemPrompt.length + userContent.length;

  if (totalChars <= maxInputChars) {
    return { system: systemPrompt, user: userContent };
  }

  const systemBudget = Math.floor(maxInputChars * 0.35);
  const userBudget = Math.floor(maxInputChars * 0.65);

  const trimmedSystem = systemPrompt.length > systemBudget
    ? systemPrompt.slice(0, systemBudget) + "\n[... context trimmed for token budget]"
    : systemPrompt;

  const trimmedUser = userContent.length > userBudget
    ? userContent.slice(0, Math.floor(userBudget * 0.7)) + "\n\n[... middle section trimmed ...]\n\n" + userContent.slice(-Math.floor(userBudget * 0.3))
    : userContent;

  return { system: trimmedSystem, user: trimmedUser };
}

export async function askClaude(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  maxTokens = 4096
): Promise<string> {
  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = await getClaudeClient(projectId);

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        system: systemPrompt ?? SHOPIFY_EXPERT_SYSTEM,
        messages,
      },
      { signal: AbortSignal.timeout(120_000) }
    );

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected non-text Claude response");
    return content.text;
  });
}

export async function askClaudeJson<T>(
  projectId: number,
  prompt: string,
  systemPrompt?: string,
  maxTokens = 4096
): Promise<T> {
  const text = await askClaude(
    projectId,
    [{ role: "user", content: prompt }],
    systemPrompt,
    maxTokens
  );

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    return JSON.parse(text) as T;
  }
  return JSON.parse(jsonMatch[1]) as T;
}

/**
 * Claude with vision — analyzes images alongside text.
 * images: array of { base64: string, mediaType: "image/jpeg"|"image/png"|"image/webp"|"image/gif" }
 */
export async function askClaudeWithVision(
  projectId: number,
  prompt: string,
  images: Array<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }>,
  systemPrompt?: string,
  maxTokens = 2048
): Promise<string> {
  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = await getClaudeClient(projectId);

    const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.base64,
      },
    }));

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        system: systemPrompt ?? SHOPIFY_EXPERT_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              ...imageBlocks,
              { type: "text", text: prompt },
            ],
          },
        ],
      },
      { signal: AbortSignal.timeout(120_000) }
    );

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected non-text Claude response");
    return content.text;
  });
}

export async function claude(prompt: string, maxTokens = 2048): Promise<string> {
  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = getDefaultClient();
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(120_000) }
    );
    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected non-text response");
    return content.text;
  });
}

/**
 * Builds a ShopyBrain context block to inject into Claude system prompts.
 * Pulls from ALL OmniCore knowledge: memories (including visual references),
 * top insights (cross-domain including visual_production), and proven prompt patterns.
 *
 * The brain is bidirectional: every analysis enriches it, and every generation
 * benefits from everything the brain has learned.
 */
export async function buildShopyBrainContext(
  niche?: string,
  useCase?: "redesign" | "seo" | "pricing" | "images" | "general" | "inventory" | "competitors" | "intelligence" | "ab_testing" | "ecommerce",
  userQuery?: string,
  platformType?: string,
): Promise<string> {
  try {
    const minConfidence = 0.6;
    const isVisualTask = useCase === "images" || useCase === "redesign";

    const { searchRelevantKnowledge, searchDomainKnowledge, formatKnowledgeContext, getOmniCorePrompts } = await import("./knowledge-search.js");

    const [memories, prompts, topInsights, visualInsights, omniQueryResults, omniDomainResults, omniPrompts, recentAbsorbed] = await Promise.all([
      db
        .select({
          memoryType: omnicoreMemoriesTable.memoryType,
          niche: omnicoreMemoriesTable.niche,
          content: omnicoreMemoriesTable.content,
          confidence: omnicoreMemoriesTable.confidence,
          title: omnicoreMemoriesTable.title,
        })
        .from(omnicoreMemoriesTable)
        .where(gte(omnicoreMemoriesTable.confidence, minConfidence))
        .orderBy(desc(omnicoreMemoriesTable.confidence))
        .limit(15),

      db
        .select({
          useCase: omnicorePromptLibraryTable.useCase,
          promptTemplate: omnicorePromptLibraryTable.promptTemplate,
          avgQualityScore: omnicorePromptLibraryTable.avgQualityScore,
        })
        .from(omnicorePromptLibraryTable)
        .orderBy(desc(omnicorePromptLibraryTable.avgQualityScore))
        .limit(5),

      db
        .select({
          domain: omnicoreInsightsTable.domain,
          title: omnicoreInsightsTable.title,
          insight: omnicoreInsightsTable.insight,
          confidence: omnicoreInsightsTable.confidence,
        })
        .from(omnicoreInsightsTable)
        .where(and(
          gte(omnicoreInsightsTable.confidence, 0.75),
        ))
        .orderBy(desc(omnicoreInsightsTable.confidence))
        .limit(10),

      db
        .select({
          title: omnicoreInsightsTable.title,
          insight: omnicoreInsightsTable.insight,
          confidence: omnicoreInsightsTable.confidence,
        })
        .from(omnicoreInsightsTable)
        .where(and(
          eq(omnicoreInsightsTable.domain, "visual_production"),
          gte(omnicoreInsightsTable.confidence, 0.65),
        ))
        .orderBy(desc(omnicoreInsightsTable.confidence))
        .limit(isVisualTask ? 6 : 2),

      userQuery
        ? searchRelevantKnowledge(userQuery, { useCase: useCase || "general", niche, maxResults: 12, minConfidence: 0.5 })
        : Promise.resolve([]),

      searchDomainKnowledge(useCase || "general", 8, 0.7),

      getOmniCorePrompts(),

      db
        .select({
          sourceType: omnicoreAbsorbedContentTable.sourceType,
          sourceLabel: omnicoreAbsorbedContentTable.sourceLabel,
          sourceUrl: omnicoreAbsorbedContentTable.sourceUrl,
          mainThemes: omnicoreAbsorbedContentTable.mainThemes,
          ecommerceInsights: omnicoreAbsorbedContentTable.ecommerceInsights,
          niche: omnicoreAbsorbedContentTable.niche,
        })
        .from(omnicoreAbsorbedContentTable)
        .where(gte(omnicoreAbsorbedContentTable.confidence, 0.7))
        .orderBy(desc(omnicoreAbsorbedContentTable.createdAt))
        .limit(8),
    ]);

    const hasAnyData = memories.length > 0 || prompts.length > 0 || topInsights.length > 0 || visualInsights.length > 0 || omniQueryResults.length > 0 || omniDomainResults.length > 0 || recentAbsorbed.length > 0;
    if (!hasAnyData) return "";

    const lines: string[] = ["", "━━━ SHOPYBRAIN OMNICORE — INTELIGENCIA ACUMULADA (46,000+ insights) ━━━"];

    if (platformType && platformType !== "shopify") {
      const platformNotes: Record<string, string> = {
        woocommerce: "Platform: WooCommerce (WordPress). Uses WC REST API v3 with HTTP Basic Auth. SEO via Yoast SEO plugin (yoast_head_json). Product types: simple/variable/grouped/external. Status mapping: publish=active, draft=draft, private=archived. Images via src URLs. Variations require parent product attributes with variation:true.",
        prestashop: "Platform: PrestaShop. Uses PrestaShop Webservice API with XML/JSON. SEO via native meta fields.",
      };
      lines.push(`🔧 Plataforma: ${platformType.toUpperCase()}`);
      if (platformNotes[platformType]) lines.push(platformNotes[platformType]);
    }
    if (niche) lines.push(`Nicho activo: ${niche}`);
    if (useCase) lines.push(`Contexto de tarea: ${useCase}`);

    const seenTitles = new Set<string>();
    const omniMerged = [...omniQueryResults, ...omniDomainResults].filter(r => {
      if (seenTitles.has(r.title)) return false;
      seenTitles.add(r.title);
      return true;
    });

    if (omniMerged.length > 0) {
      lines.push(formatKnowledgeContext(omniMerged.slice(0, 15), "CONOCIMIENTO OMNICORE INYECTADO"));
    }

    if (omniPrompts.length > 0) {
      const relevantOmniPrompts = omniPrompts.filter(p => {
        const name = p.name.toLowerCase();
        if (useCase === "pricing" && name.includes("economist")) return true;
        if (useCase === "seo" && name.includes("shopify")) return true;
        if ((useCase === "redesign" || useCase === "images") && name.includes("product")) return true;
        if (name.includes("identity")) return true;
        if (name.includes("research") && (useCase === "competitors" || useCase === "intelligence")) return true;
        return false;
      });
      if (relevantOmniPrompts.length > 0) {
        lines.push("\n🔮 Protocolos OmniCore activos:");
        for (const p of relevantOmniPrompts.slice(0, 2)) {
          lines.push(`  [${p.name}]: ${p.promptTemplate.slice(0, 300)}…`);
        }
      }
    }

    const nonVisualInsights = topInsights.filter(i => i.domain !== "visual_production");
    if (nonVisualInsights.length > 0) {
      lines.push("\n🧠 Insights estratégicos (aprendizaje continuo):");
      for (const ins of nonVisualInsights.slice(0, 5)) {
        lines.push(`  [${ins.domain ?? "general"}] ${ins.title}: ${(ins.insight ?? "").slice(0, 180)} (conf: ${ins.confidence})`);
      }
    }

    if (visualInsights.length > 0) {
      lines.push(`\n🎬 Inteligencia visual absorbida de referencias${isVisualTask ? " (alta prioridad)" : ""}:`);
      for (const v of visualInsights) {
        lines.push(`  ${v.title}: ${(v.insight ?? "").slice(0, 200)} (conf: ${v.confidence})`);
      }
    }

    if (recentAbsorbed.length > 0) {
      const nicheAbsorbed = niche
        ? recentAbsorbed.filter(a => a.niche && a.niche.toLowerCase().includes(niche.toLowerCase()))
        : recentAbsorbed;
      const absorbedToShow = (nicheAbsorbed.length > 0 ? nicheAbsorbed : recentAbsorbed).slice(0, 5);
      lines.push("\n🔗 Contenido absorbido reciente (URLs, marcas, investigaciones):");
      for (const a of absorbedToShow) {
        let themes = "";
        try {
          const parsed = a.mainThemes ? JSON.parse(a.mainThemes as string) : [];
          themes = Array.isArray(parsed) ? parsed.slice(0, 3).join(", ") : "";
        } catch { /* malformed mainThemes — skip */ }
        lines.push(`  [${a.sourceType}] ${a.sourceLabel ?? a.sourceUrl ?? "?"}: ${themes}`);
      }
    }

    const nicheMemories = niche
      ? memories.filter(m => m.niche && m.niche.toLowerCase().includes(niche.toLowerCase()))
      : [];

    const imagePatternMemories = isVisualTask
      ? memories.filter(m => m.memoryType === "image_pattern" && !nicheMemories.includes(m))
      : [];

    const generalMemories = memories.filter(m =>
      !nicheMemories.includes(m) && !imagePatternMemories.includes(m)
    );

    if (nicheMemories.length > 0) {
      lines.push(`\n📌 Conocimiento específico del nicho (${niche}):`);
      for (const m of nicheMemories.slice(0, 10)) {
        lines.push(`  [${m.memoryType}] ${m.title ?? ""}: ${(m.content ?? "").slice(0, 2000)}`);
      }
    }

    if (imagePatternMemories.length > 0) {
      lines.push("\n🖼 Patrones visuales de referencias analizadas:");
      for (const m of imagePatternMemories.slice(0, 8)) {
        lines.push(`  ${m.title ?? ""}: ${(m.content ?? "").slice(0, 2000)}`);
      }
    }

    if (generalMemories.length > 0) {
      lines.push("\n💡 Memorias y patrones de la agencia:");
      for (const m of generalMemories.slice(0, 12)) {
        const nicheTag = m.niche ? ` [${m.niche}]` : "";
        lines.push(`  [${m.memoryType}${nicheTag}] ${(m.content ?? "").slice(0, 2000)}`);
      }
    }

    const useCasePrompts = useCase
      ? prompts.filter(p => p.useCase === useCase || p.useCase === "general")
      : prompts;

    if (useCasePrompts.length > 0) {
      lines.push("\n✅ Patrones de prompt probados:");
      for (const p of useCasePrompts.slice(0, 5)) {
        lines.push(`  [${p.useCase}] ${p.promptTemplate.slice(0, 500)}...`);
      }
    }

    lines.push("━━━ FIN CONTEXTO SHOPYBRAIN (base: 46,000+ insights OmniCore) ━━━");
    return lines.join("\n");
  } catch {
    return "";
  }
}

export async function buildBrandDnaContext(projectId: number): Promise<string> {
  try {
    const [dna] = await db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId));
    if (!dna) return "";

    const lines: string[] = ["\n━━━ BRAND DNA — IDENTIDAD VISUAL DEL PROYECTO ━━━"];
    if (dna.backgroundStyle) lines.push(`Estilo de fondo: ${dna.backgroundStyle}`);
    if (dna.lightingStyle) lines.push(`Iluminación: ${dna.lightingStyle}`);
    if (dna.colorTemp) lines.push(`Temperatura de color: ${dna.colorTemp}`);
    if (dna.composition) lines.push(`Composición: ${dna.composition}`);
    if (dna.mood) lines.push(`Mood de marca: ${dna.mood}`);
    if (dna.humanPresence) lines.push(`Presencia humana: ${dna.humanPresence}`);
    if (dna.brandColors && dna.brandColors.length > 0) lines.push(`Colores de marca: ${dna.brandColors.join(", ")}`);
    if (dna.props && dna.props.length > 0) lines.push(`Props/accesorios: ${dna.props.join(", ")}`);
    if (dna.consistencyScore) lines.push(`Score de consistencia: ${dna.consistencyScore}/100`);
    lines.push("INSTRUCCIÓN: Usa esta identidad visual en TODAS tus recomendaciones de diseño, imágenes, textos y emails. Mantén coherencia de marca.");
    lines.push("━━━ FIN BRAND DNA ━━━");
    return lines.join("\n");
  } catch {
    return "";
  }
}

/**
 * askClaude enhanced with ShopyBrain + BrandDNA context injection (returns raw string).
 */
export async function askClaudeWithBrain(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  useCase: "redesign" | "seo" | "pricing" | "images" | "general" = "general",
  niche?: string,
  maxTokens = 4096
): Promise<string> {
  const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content;
  const platform = await resolvePlatformType(projectId);
  const [brainContext, brandDna] = await Promise.all([
    buildShopyBrainContext(niche, useCase, lastUserMsg, platform),
    buildBrandDnaContext(projectId),
  ]);
  const base = systemPrompt ?? SHOPIFY_EXPERT_SYSTEM;
  const enrichedSystem = base + (brainContext || "") + (brandDna || "");
  const totalUserContent = messages.map(m => m.content).join("\n");
  const budget = enforcePromptBudget(enrichedSystem, totalUserContent, maxTokens);
  return askClaude(projectId, messages, budget.system, maxTokens);
}

export async function askClaudeJsonWithBrain<T>(
  projectId: number,
  prompt: string,
  systemPrompt: string,
  useCase: "redesign" | "seo" | "pricing" | "images" | "general",
  niche?: string,
  maxTokens = 4096
): Promise<T> {
  const platform = await resolvePlatformType(projectId);
  const [brainContext, brandDna] = await Promise.all([
    buildShopyBrainContext(niche, useCase, prompt, platform),
    buildBrandDnaContext(projectId),
  ]);
  const enrichedSystem = systemPrompt + (brainContext || "") + (brandDna || "");
  const budget = enforcePromptBudget(enrichedSystem, prompt, maxTokens);
  return askClaudeJson<T>(projectId, budget.user, budget.system, maxTokens);
}

/**
 * learnFromOperation — fire-and-forget learning after every successful AI operation.
 * Saves the result as a ShopyBrain memory so future prompts benefit from past successes.
 * Never throws — completely non-blocking.
 */
export function learnFromOperation(params: {
  operationType: string;
  niche?: string | null;
  productType?: string | null;
  title: string;
  content: string;
  confidence?: number;
  tags?: string[];
}): void {
  const memTypeMap: Record<string, string> = {
    redesign: "prompt_template",
    seo: "niche_keyword",
    seo_meta: "niche_keyword",
    seo_keywords: "niche_keyword",
    seo_blog: "niche_keyword",
    seo_audit: "niche_keyword",
    pricing: "pricing_pattern",
    price_simulation: "pricing_pattern",
    price_elasticity: "pricing_pattern",
    financial_forecast: "pricing_pattern",
    images: "image_pattern",
    image_generation: "image_pattern",
    alt_text: "image_pattern",
    ab_winner: "ab_insight",
    ab_test: "ab_insight",
    consistency: "image_pattern",
    product_copy: "prompt_template",
    product_creation: "prompt_template",
    catalog_analysis: "general",
    email_flow: "prompt_template",
    email_content: "prompt_template",
    competitor_analysis: "competitor_intel",
    inventory_analysis: "general",
    voice_command: "general",
    brand_analysis: "general",
    revenue_analysis: "pricing_pattern",
    product_optimization: "prompt_template",
    chatbot_action_store_status: "general",
    chatbot_action_list_products: "general",
    chatbot_action_create_product: "prompt_template",
    chatbot_action_edit_product: "prompt_template",
    chatbot_action_change_price: "pricing_pattern",
    connection_auth: "general",
    inventory_sales_analytics: "pricing_pattern",
    chatbot_action_regenerate_token: "general",
    chatbot_action_get_scopes: "general",
    chatbot_action_delete_product: "general",
    chatbot_action_search_product: "general",
    chatbot_action_publish_product: "general",
    chatbot_action_get_orders: "pricing_pattern",
    chatbot_action_scan_store: "general",
    chatbot_action_set_product_status: "general",
    chatbot_action_list_all_products: "general",
    chatbot_action_search_suppliers: "competitor_intel",
    chatbot_action_modify_audit_filter: "general",
    web_lab_design_analysis: "general",
    web_lab_css_patterns: "general",
    web_lab_ux_insights: "general",
    chatbot_action_diagnose_app: "general",
    chatbot_action_list_source_files: "general",
    chatbot_action_inspect_code: "general",
    chatbot_action_analyze_component: "general",
    chatbot_action_fix_code: "prompt_template",
    chatbot_action_optimize_product: "prompt_template",
    chatbot_action_optimize_all_products: "prompt_template",
    chatbot_action_create_collection: "prompt_template",
    chatbot_action_list_collections: "general",
    chatbot_action_auto_collections: "prompt_template",
    chatbot_action_create_page: "prompt_template",
    chatbot_action_list_pages: "general",
    chatbot_action_design_all_pages: "prompt_template",
    chatbot_action_optimize_images: "image_pattern",
    chatbot_action_read_cms: "general",
    chatbot_action_update_cms: "general",
    chatbot_action_update_cms_batch: "general",
    chatbot_action_reset_cms: "general",
    chatbot_action_generate_competitive_pricing: "pricing_pattern",
    chatbot_action_audit_app_offerings: "general",
    chatbot_action_modify_ui: "general",
    chatbot_action_learn_from_url: "general",
    chatbot_action_learn_from_content: "general",
    chatbot_action_recall_knowledge: "general",
    chatbot_action_brain_status: "general",
    chatbot_action_brain_stats: "general",
    chatbot_action_brain_sync: "general",
    chatbot_action_brain_export: "general",
    chatbot_action_redesign_product: "prompt_template",
    chatbot_action_apply_redesign: "prompt_template",
    chatbot_action_bulk_redesign: "prompt_template",
    chatbot_action_seo_full_audit: "niche_keyword",
    chatbot_action_keyword_intelligence: "niche_keyword",
    chatbot_action_blog_strategy: "niche_keyword",
    chatbot_action_generate_blog_post: "niche_keyword",
    chatbot_action_generate_schemas: "niche_keyword",
    chatbot_action_generate_all_metas: "niche_keyword",
    chatbot_action_fix_all_alt_texts: "image_pattern",
    chatbot_action_audit_page_speed: "niche_keyword",
    chatbot_action_generate_sitemap: "niche_keyword",
    chatbot_action_scan_competitor: "competitor_intel",
    chatbot_action_analyze_competitor_product: "competitor_intel",
    chatbot_action_calculate_optimal_price: "pricing_pattern",
    chatbot_action_estimate_cogs: "pricing_pattern",
    chatbot_action_price_simulator: "pricing_pattern",
    chatbot_action_financial_forecast: "pricing_pattern",
    chatbot_action_financial_dashboard: "pricing_pattern",
    chatbot_action_generate_product_images: "image_pattern",
    chatbot_action_bulk_generate_images: "image_pattern",
    chatbot_action_generate_email_flow: "prompt_template",
    chatbot_action_generate_email: "prompt_template",
    chatbot_action_inventory_sync: "general",
    chatbot_action_inventory_alerts: "general",
    chatbot_action_inventory_deep_report: "general",
    chatbot_action_inventory_sync_orders: "general",
    chatbot_action_inventory_sales_analytics: "general",
    chatbot_action_inventory_customer_history: "general",
    chatbot_action_agency_quote: "pricing_pattern",
    chatbot_action_agency_proposal: "prompt_template",
    chatbot_action_setup_full_store: "general",
    chatbot_action_list_themes: "general",
    chatbot_action_list_theme_files: "general",
    chatbot_action_read_theme_file: "general",
    chatbot_action_edit_theme_file: "prompt_template",
    chatbot_action_create_theme_section: "prompt_template",
    chatbot_action_audit_theme: "general",
    chatbot_action_edit_theme_css: "prompt_template",
    chatbot_action_edit_theme_settings: "general",
    chatbot_action_create_ab_test: "ab_insight",
    chatbot_action_list_ab_tests: "ab_insight",
    chatbot_action_declare_winner: "ab_insight",
    cms_copy_improvement: "prompt_template",
    explicit_instruction: "general",
    strategic_learning: "general",
    conversation_insight: "general",
  };

  const memoryType = memTypeMap[params.operationType] ?? "general";

  db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType,
    niche: params.niche ?? null,
    productType: params.productType ?? null,
    market: "es",
    title: params.title.slice(0, 200),
    content: params.content,
    confidence: params.confidence ?? 0.65,
    sourceType: `auto_${params.operationType}`,
    tags: params.tags ? JSON.stringify(params.tags) : null,
    isVerified: 0,
    useCount: 1,
    successCount: 1,
    successRate: 1.0,
  }).catch(() => {});
}
