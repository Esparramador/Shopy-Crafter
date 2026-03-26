import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { projectsTable, omnicoreMemoriesTable, omnicorePromptLibraryTable, omnicoreInsightsTable, visualDnaTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { safeDecrypt } from "./crypto.js";

let defaultClient: Anthropic | null = null;

function getDefaultClient(): Anthropic {
  if (!defaultClient) {
    defaultClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
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
  useCase?: "redesign" | "seo" | "pricing" | "images" | "general" | "inventory" | "competitors" | "intelligence" | "ab_testing" | "ecommerce"
): Promise<string> {
  try {
    const minConfidence = 0.6;
    const isVisualTask = useCase === "images" || useCase === "redesign";

    const [memories, prompts, topInsights, visualInsights] = await Promise.all([
      // Standard memories (all types)
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

      // Proven prompt patterns
      db
        .select({
          useCase: omnicorePromptLibraryTable.useCase,
          promptTemplate: omnicorePromptLibraryTable.promptTemplate,
          avgQualityScore: omnicorePromptLibraryTable.avgQualityScore,
        })
        .from(omnicorePromptLibraryTable)
        .orderBy(desc(omnicorePromptLibraryTable.avgQualityScore))
        .limit(5),

      // Top cross-domain strategic insights
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

      // Visual production insights — from reference image/video analysis
      // Always included for visual tasks; lightly included for all others
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
    ]);

    if (memories.length === 0 && prompts.length === 0 && topInsights.length === 0 && visualInsights.length === 0) return "";

    const lines: string[] = ["", "━━━ SHOPYBRAIN OMNICORE — INTELIGENCIA ACUMULADA ━━━"];

    if (niche) lines.push(`Nicho activo: ${niche}`);
    if (useCase) lines.push(`Contexto de tarea: ${useCase}`);

    // Top strategic insights (cross-domain)
    const nonVisualInsights = topInsights.filter(i => i.domain !== "visual_production");
    if (nonVisualInsights.length > 0) {
      lines.push("\n🧠 Insights estratégicos (aprendizaje continuo):");
      for (const ins of nonVisualInsights.slice(0, 5)) {
        lines.push(`  [${ins.domain ?? "general"}] ${ins.title}: ${(ins.insight ?? "").slice(0, 180)} (conf: ${ins.confidence})`);
      }
    }

    // Visual production intelligence (from reference analyses)
    if (visualInsights.length > 0) {
      lines.push(`\n🎬 Inteligencia visual absorbida de referencias${isVisualTask ? " (alta prioridad)" : ""}:`);
      for (const v of visualInsights) {
        lines.push(`  ${v.title}: ${(v.insight ?? "").slice(0, 200)} (conf: ${v.confidence})`);
      }
    }

    // Niche-specific memories
    const nicheMemories = niche
      ? memories.filter(m => m.niche && m.niche.toLowerCase().includes(niche.toLowerCase()))
      : [];

    // Image pattern memories (from reference ingestion) — for visual tasks
    const imagePatternMemories = isVisualTask
      ? memories.filter(m => m.memoryType === "image_pattern" && !nicheMemories.includes(m))
      : [];

    const generalMemories = memories.filter(m =>
      !nicheMemories.includes(m) && !imagePatternMemories.includes(m)
    );

    if (nicheMemories.length > 0) {
      lines.push(`\n📌 Conocimiento específico del nicho (${niche}):`);
      for (const m of nicheMemories.slice(0, 5)) {
        lines.push(`  [${m.memoryType}] ${m.title ?? ""}: ${(m.content ?? "").slice(0, 160)}`);
      }
    }

    if (imagePatternMemories.length > 0) {
      lines.push("\n🖼 Patrones visuales de referencias analizadas:");
      for (const m of imagePatternMemories.slice(0, 4)) {
        lines.push(`  ${m.title ?? ""}: ${(m.content ?? "").slice(0, 180)}`);
      }
    }

    if (generalMemories.length > 0) {
      lines.push("\n💡 Memorias y patrones de la agencia:");
      for (const m of generalMemories.slice(0, 6)) {
        const nicheTag = m.niche ? ` [${m.niche}]` : "";
        lines.push(`  [${m.memoryType}${nicheTag}] ${(m.content ?? "").slice(0, 160)}`);
      }
    }

    // Proven prompt patterns for this use case
    const useCasePrompts = useCase
      ? prompts.filter(p => p.useCase === useCase || p.useCase === "general")
      : prompts;

    if (useCasePrompts.length > 0) {
      lines.push("\n✅ Patrones de prompt probados:");
      for (const p of useCasePrompts.slice(0, 3)) {
        lines.push(`  [${p.useCase}] ${p.promptTemplate.slice(0, 180)}...`);
      }
    }

    lines.push("━━━ FIN CONTEXTO SHOPYBRAIN ━━━");
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
  const [brainContext, brandDna] = await Promise.all([
    buildShopyBrainContext(niche, useCase),
    buildBrandDnaContext(projectId),
  ]);
  const base = systemPrompt ?? SHOPIFY_EXPERT_SYSTEM;
  const enrichedSystem = base + (brainContext || "") + (brandDna || "");
  return askClaude(projectId, messages, enrichedSystem, maxTokens);
}

/**
 * askClaudeJson enhanced with ShopyBrain + BrandDNA context injection.
 */
export async function askClaudeJsonWithBrain<T>(
  projectId: number,
  prompt: string,
  systemPrompt: string,
  useCase: "redesign" | "seo" | "pricing" | "images" | "general",
  niche?: string,
  maxTokens = 4096
): Promise<T> {
  const [brainContext, brandDna] = await Promise.all([
    buildShopyBrainContext(niche, useCase),
    buildBrandDnaContext(projectId),
  ]);
  const enrichedSystem = systemPrompt + (brainContext || "") + (brandDna || "");
  return askClaudeJson<T>(projectId, prompt, enrichedSystem, maxTokens);
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
  };

  const memoryType = memTypeMap[params.operationType] ?? "general";

  db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType,
    niche: params.niche ?? null,
    productType: params.productType ?? null,
    market: "es",
    title: params.title.slice(0, 200),
    content: params.content.slice(0, 2000),
    confidence: params.confidence ?? 0.65,
    sourceType: `auto_${params.operationType}`,
    tags: params.tags ? JSON.stringify(params.tags) : null,
    isVerified: 0,
    useCount: 1,
    successCount: 1,
    successRate: 1.0,
  }).catch(() => {});
}
