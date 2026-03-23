import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { projectsTable, omnicoreMemoriesTable, omnicorePromptLibraryTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
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
  const client = await getClaudeClient(projectId);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemPrompt ?? SHOPIFY_EXPERT_SYSTEM,
    messages,
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected non-text Claude response");
  return content.text;
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

export async function claude(prompt: string, maxTokens = 2048): Promise<string> {
  const client = getDefaultClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected non-text response");
  return content.text;
}

/**
 * Builds a ShopyBrain context block to inject into Claude system prompts.
 * Queries the OmniCore memory engine for relevant accumulated knowledge.
 */
export async function buildShopyBrainContext(
  niche?: string,
  useCase?: "redesign" | "seo" | "pricing" | "images" | "general"
): Promise<string> {
  try {
    const minConfidence = 0.6;

    const memoriesQuery = db
      .select({
        memoryType: omnicoreMemoriesTable.memoryType,
        niche: omnicoreMemoriesTable.niche,
        content: omnicoreMemoriesTable.content,
        confidence: omnicoreMemoriesTable.confidence,
      })
      .from(omnicoreMemoriesTable)
      .where(gte(omnicoreMemoriesTable.confidence, minConfidence))
      .orderBy(desc(omnicoreMemoriesTable.confidence))
      .limit(12);

    const promptsQuery = db
      .select({
        useCase: omnicorePromptLibraryTable.useCase,
        promptTemplate: omnicorePromptLibraryTable.promptTemplate,
        avgQualityScore: omnicorePromptLibraryTable.avgQualityScore,
      })
      .from(omnicorePromptLibraryTable)
      .orderBy(desc(omnicorePromptLibraryTable.avgQualityScore))
      .limit(5);

    const [memories, prompts] = await Promise.all([memoriesQuery, promptsQuery]);

    if (memories.length === 0 && prompts.length === 0) return "";

    const lines: string[] = ["", "--- OMNICORE BRAIN CONTEXT (accumulated agency knowledge) ---"];

    if (niche) lines.push(`Active niche: ${niche}`);
    if (useCase) lines.push(`Task context: ${useCase}`);

    const nicheMemories = niche
      ? memories.filter(m => m.niche && m.niche.toLowerCase().includes(niche.toLowerCase()))
      : [];
    const generalMemories = memories.filter(m => !nicheMemories.includes(m));

    if (nicheMemories.length > 0) {
      lines.push(`\nNiche-specific knowledge (${niche}):`);
      for (const m of nicheMemories.slice(0, 6)) {
        lines.push(`  [${m.memoryType}] ${m.content} (confidence: ${m.confidence})`);
      }
    }

    if (generalMemories.length > 0) {
      lines.push("\nGeneral agency knowledge:");
      for (const m of generalMemories.slice(0, 6)) {
        const nicheTag = m.niche ? ` [${m.niche}]` : "";
        lines.push(`  [${m.memoryType}${nicheTag}] ${m.content}`);
      }
    }

    const useCasePrompts = useCase
      ? prompts.filter(p => p.useCase === useCase || p.useCase === "general")
      : prompts;

    if (useCasePrompts.length > 0) {
      lines.push("\nProven prompt patterns:");
      for (const p of useCasePrompts.slice(0, 3)) {
        lines.push(`  [${p.useCase}] ${p.promptTemplate.slice(0, 200)}...`);
      }
    }

    lines.push("--- END OMNICORE CONTEXT ---");
    return lines.join("\n");
  } catch {
    return "";
  }
}

/**
 * askClaude enhanced with ShopyBrain context injection (returns raw string).
 */
export async function askClaudeWithBrain(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  useCase: "redesign" | "seo" | "pricing" | "images" | "general" = "general",
  niche?: string,
  maxTokens = 4096
): Promise<string> {
  const brainContext = await buildShopyBrainContext(niche, useCase);
  const base = systemPrompt ?? SHOPIFY_EXPERT_SYSTEM;
  const enrichedSystem = brainContext ? base + brainContext : base;
  return askClaude(projectId, messages, enrichedSystem, maxTokens);
}

/**
 * askClaudeJson enhanced with ShopyBrain context injection.
 */
export async function askClaudeJsonWithBrain<T>(
  projectId: number,
  prompt: string,
  systemPrompt: string,
  useCase: "redesign" | "seo" | "pricing" | "images" | "general",
  niche?: string,
  maxTokens = 4096
): Promise<T> {
  const brainContext = await buildShopyBrainContext(niche, useCase);
  const enrichedSystem = brainContext ? systemPrompt + brainContext : systemPrompt;
  return askClaudeJson<T>(projectId, prompt, enrichedSystem, maxTokens);
}

/**
 * learnFromOperation — fire-and-forget learning after every successful AI operation.
 * Saves the result as a ShopyBrain memory so future prompts benefit from past successes.
 * Never throws — completely non-blocking.
 */
export function learnFromOperation(params: {
  operationType: "redesign" | "seo" | "pricing" | "images" | "ab_winner" | "consistency";
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
    pricing: "pricing_pattern",
    images: "image_pattern",
    ab_winner: "ab_insight",
    consistency: "image_pattern",
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
  }).then(() => {
    db.update(omnicoreMemoriesTable)
      .set({ useCount: sql`use_count + 1`, successCount: sql`success_count + 1` })
      .where(and(
        eq(omnicoreMemoriesTable.memoryType, memoryType),
        gte(omnicoreMemoriesTable.confidence, 0.7),
      ))
      .catch(() => {});
  }).catch(() => {});
}
