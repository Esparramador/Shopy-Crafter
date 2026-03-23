import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    return new Anthropic({ apiKey: project.anthropicApiKey });
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
