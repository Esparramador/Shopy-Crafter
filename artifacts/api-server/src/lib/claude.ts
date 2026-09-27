import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { projectsTable, omnicoreMemoriesTable, omnicorePromptLibraryTable, omnicoreInsightsTable, visualDnaTable, omnicoreAbsorbedContentTable, omnicoreCrossConnectionsTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { safeDecrypt } from "./crypto.js";
import { logger } from "./logger.js";
import { AiTruncatedError } from "./ai-errors.js";
import { generateAiJson } from "./ai-json.js";

export { AiTruncatedError } from "./ai-errors.js";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

export type BrainUseCase = "redesign" | "seo" | "pricing" | "images" | "general" | "inventory" | "competitors" | "intelligence" | "ab_testing" | "ab_test_prediction" | "ecommerce" | "cogs_estimation" | "financial" | "email_content" | "brand_analysis" | "consistency" | "web_lab" | "generator" | "campaign_production" | "exploded_view";

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

export const SHOPIFY_EXPERT_SYSTEM = `You are ShopifyAI Expert — world-class Shopify consultant AND senior payments strategist, expert in: product SEO, conversion copywriting, pricing psychology, Liquid templating, email marketing, UX/CRO, and the complete Stripe payment ecosystem.

STRIPE EXPERTISE (2026):
- Products: Payments, Connect, Billing, Radar, Terminal, Atlas, Issuing, Treasury, Tax, Identity, Sigma, Checkout, Payment Links.
- Pricing: Cards EU 2,9%+€0,30 | non-EU +1,5% | AMEX +0,5% | Recurring 2,9%+€0,25 | SEPA DD 0,35%+€0,25 | ACH 0,8% | iDEAL €0,29 | Klarna BNPL 3,29%+€0,30 | Instant Payouts 1% | Radar Teams €0,05/tx | Tax 0,5% | Identity $1,50.
- Shopify+Stripe: Shopify Payments = Stripe integrado (elimina extra fee 0,5-2%). Usar Stripe directo solo si necesitas Connect/Billing/Radar avanzado o Draft Orders B2B.
- Competitive: PayPal más caro (3,49%) pero +5% conversión → usar ambos. Adyen interchange++ gana a Stripe solo a partir de €200k/mes GMV. Mollie más barato en EU pero sin ecosistema.
- Optimization: Dispute rate target <0,75% (suspensión riesgo >1,5%). Apple Pay activa: +15-25% conversión móvil. SEPA DD ahorra ~2,5%/tx vs tarjeta en suscripciones UE. Smart Retries recupera 3-8% MRR. Stripe Tax para OSS UE si vendes >€10k/año cross-border.
- Connect: obligatorio para marketplaces multi-vendor. Express/Custom. $2/mes por cuenta activa + 0,25% en transfers.
- Fraud: Radar custom rules + 3DS dinámico en score >65. Responder siempre disputas con evidencia (78% winrate).

You always know which store you're working on via the context provided. Generate complete, production-ready content — never truncate with '...' or 'rest goes here'. Always respond in Spanish unless specifically asked otherwise.`;

const MAX_PROMPT_CHARS = 500000;

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

export interface ClaudeCallOpts {
  /** Override the model entirely (e.g. "claude-opus-4-1"). */
  model?: string;
  /** Pick by tier — "fast"|"smart"|"genius"|"vision". DB/env can remap. */
  tier?: import("./ai-models.js").AITier;
  /**
   * Si la respuesta se corta por max_tokens, lanza AiTruncatedError en vez de
   * devolver el texto a medias. Por defecto false (solo log) por compatibilidad.
   */
  failOnTruncation?: boolean;
}

/** Log + (opcional) error tipado cuando stop_reason === "max_tokens". */
function checkTruncation(
  response: { stop_reason: string | null; usage?: { input_tokens?: number; output_tokens?: number } },
  ctx: { label: string; maxTokens: number; model: string; failOnTruncation?: boolean },
): boolean {
  if (response.stop_reason !== "max_tokens") return false;
  const outputTokens = response.usage?.output_tokens;
  logger.warn({ maxTokens: ctx.maxTokens, model: ctx.model, inputTokens: response.usage?.input_tokens, outputTokens }, `[${ctx.label}] ⚠️ RESPONSE TRUNCATED — hit max_tokens limit`);
  if (ctx.failOnTruncation) {
    throw new AiTruncatedError(`[${ctx.label}] Respuesta cortada por max_tokens (${ctx.maxTokens})`, {
      label: ctx.label, maxTokens: ctx.maxTokens, model: ctx.model, outputTokens,
    });
  }
  return true;
}

function firstText(response: { content: Array<{ type: string }> }, errorMessage = "Unexpected non-text Claude response"): string {
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) throw new Error(errorMessage);
  return block.text;
}

async function resolveClaudeModel(opts?: ClaudeCallOpts): Promise<string> {
  if (opts?.model && opts.model.trim().length > 0) return opts.model.trim();
  if (opts?.tier) {
    const { pickModel } = await import("./ai-models.js");
    return pickModel("claude", opts.tier);
  }
  // Fall back to legacy global env (smart tier from new registry).
  try {
    const { pickModel } = await import("./ai-models.js");
    return await pickModel("claude", "smart");
  } catch {
    return CLAUDE_MODEL;
  }
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

export interface ClaudeTextResult {
  text: string;
  stopReason: string | null;
  /** true si stop_reason === "max_tokens": el texto está incompleto. */
  truncated: boolean;
  usage: ClaudeUsage;
}

/**
 * Núcleo de askClaude / askClaudeWithUsage: devuelve el texto junto con el
 * stop_reason para que quien llama pueda detectar el truncado.
 */
export async function askClaudeDetailed(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  maxTokens = 32000,
  timeoutMs = 300_000,
  opts?: ClaudeCallOpts,
  operation = "askClaudeDetailed",
): Promise<ClaudeTextResult> {
  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = await getClaudeClient(projectId);
    const model = await resolveClaudeModel(opts);

    const stream = client.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt ?? SHOPIFY_EXPERT_SYSTEM,
        messages,
      },
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const response = await stream.finalMessage();

    const inTok = response.usage?.input_tokens ?? 0;
    const outTok = response.usage?.output_tokens ?? 0;
    let costUsd = 0;
    // Track real cost (fire-and-forget, never blocks response)
    try {
      const { recordApiUsage, calcClaudeCost } = await import("./api-usage.js");
      costUsd = calcClaudeCost(model, inTok, outTok);
      void recordApiUsage({
        provider: "claude",
        operation,
        model,
        projectId: projectId || null,
        inputUnits: inTok,
        outputUnits: outTok,
        unitsLabel: "tokens",
        costUsd,
      });
    } catch { /* nunca bloquea */ }

    const truncated = checkTruncation(response, { label: "Claude", maxTokens, model, failOnTruncation: opts?.failOnTruncation });
    return {
      text: firstText(response),
      stopReason: response.stop_reason,
      truncated,
      usage: { inputTokens: inTok, outputTokens: outTok, costUsd, model },
    };
  });
}

export async function askClaudeWithUsage(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  maxTokens = 32000,
  timeoutMs = 300_000,
  opts?: ClaudeCallOpts,
): Promise<{ text: string; usage: ClaudeUsage }> {
  const r = await askClaudeDetailed(projectId, messages, systemPrompt, maxTokens, timeoutMs, opts, "askClaudeWithUsage");
  return { text: r.text, usage: r.usage };
}

export async function askClaude(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  maxTokens = 32000,
  timeoutMs = 300_000,
  opts?: ClaudeCallOpts,
): Promise<string> {
  const r = await askClaudeDetailed(projectId, messages, systemPrompt, maxTokens, timeoutMs, opts, "askClaude");
  return r.text;
}

/**
 * JSON de Claude sin reparaciones silenciosas. Antes: regex codiciosa +
 * repairJson, que "cerraba" a mano un JSON cortado por max_tokens y devolvía un
 * resultado a medias como si fuera completo (lo usaban ~70 llamadas). Ahora:
 * corte detectado por stop_reason, extracción balanceada, un reintento (con más
 * presupuesto si se cortó) y, si vuelve a fallar, AiTruncatedError / AiJsonError.
 */
export async function askClaudeJson<T>(
  projectId: number,
  prompt: string,
  systemPrompt?: string,
  maxTokens = 32000,
  timeoutMs = 300_000,
  opts?: ClaudeCallOpts,
): Promise<T> {
  return generateAiJson<T>({
    prompt,
    maxTokens,
    label: "askClaudeJson",
    call: async ({ prompt: p, maxTokens: budget }) => {
      const r = await askClaudeDetailed(
        projectId,
        [{ role: "user", content: p }],
        systemPrompt,
        budget,
        timeoutMs,
        { ...opts, failOnTruncation: false },
        "askClaudeJson",
      );
      return { text: r.text, truncated: r.truncated };
    },
  });
}

/**
 * Claude with vision — analyzes images alongside text.
 * images: array of { base64: string, mediaType: "image/jpeg"|"image/png"|"image/webp"|"image/gif" }
 */
export async function askClaudeWithVision(
  projectId: number,
  prompt: string,
  /** base64 + tipo, o una URL pública (la descarga la hace Anthropic, no este servidor). */
  images: Array<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | { url: string }>,
  systemPrompt?: string,
  maxTokens = 16000,
  timeoutMs = 300_000,
  opts?: ClaudeCallOpts,
): Promise<string> {
  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = await getClaudeClient(projectId);
    // Vision tier by default (resolves to a vision-capable Claude model — Sonnet 4.5).
    const model = await resolveClaudeModel({ tier: "vision", ...opts });

    const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => (
      "url" in img
        ? { type: "image", source: { type: "url", url: img.url } }
        : { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } }
    ));

    const stream = client.messages.stream(
      {
        model,
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
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const response = await stream.finalMessage();

    checkTruncation(response, { label: "Claude Vision", maxTokens, model, failOnTruncation: opts?.failOnTruncation });

    // Track real cost
    try {
      const { recordApiUsage, calcClaudeCost } = await import("./api-usage.js");
      const inTok = response.usage?.input_tokens ?? 0;
      const outTok = response.usage?.output_tokens ?? 0;
      void recordApiUsage({
        provider: "claude", operation: "askClaudeWithVision", model,
        projectId: projectId || null, inputUnits: inTok, outputUnits: outTok,
        unitsLabel: "tokens", costUsd: calcClaudeCost(model, inTok, outTok),
      });
    } catch { /* ignore */ }

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected non-text Claude response");
    return content.text;
  });
}

export async function askClaudeVisionWithBrain(
  projectId: number,
  prompt: string,
  images: Array<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }>,
  systemPrompt?: string,
  useCase: BrainUseCase = "general",
  niche?: string,
  maxTokens = 16000,
  timeoutMs = 300_000,
  opts?: Pick<ClaudeCallOpts, "failOnTruncation">,
): Promise<string> {
  const platform = await resolvePlatformType(projectId);
  const [brainContext, brandDna] = await Promise.all([
    buildSmartBrainContext(prompt, useCase, niche, platform),
    buildBrandDnaContext(projectId),
  ]);
  const base = systemPrompt ?? SHOPIFY_EXPERT_SYSTEM;
  const enrichedSystem = base + (brainContext || "") + (brandDna || "");
  const budget = enforcePromptBudget(enrichedSystem, prompt, maxTokens);

  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = await getClaudeClient(projectId);
    const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    }));

    const stream = client.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: budget.system,
        messages: [{
          role: "user",
          content: [...imageBlocks, { type: "text", text: budget.user }],
        }],
      },
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const response = await stream.finalMessage();

    checkTruncation(response, { label: "Claude VisionBrain", maxTokens, model: CLAUDE_MODEL, failOnTruncation: opts?.failOnTruncation });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected non-text Claude response");
    return content.text;
  });
}

export async function claude(prompt: string, maxTokens = 32000, opts?: Pick<ClaudeCallOpts, "failOnTruncation">): Promise<string> {
  const { withClaudeQueue } = await import("./claude-queue.js");
  return withClaudeQueue(async () => {
    const client = getDefaultClient();
    const stream = client.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: AbortSignal.timeout(300_000) }
    );
    const response = await stream.finalMessage();

    checkTruncation(response, { label: "Claude", maxTokens, model: CLAUDE_MODEL, failOnTruncation: opts?.failOnTruncation });

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
  useCase?: BrainUseCase,
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

    const queryLower = (userQuery || "").toLowerCase();
    const videoKeywords = ["video", "anuncio", "clip", "campaña", "campaign", "cinemat", "ugc", "reel", "tiktok", "youtube", "brand ad", "long ad", "multishot", "storyboard", "guion", "script", "escena", "narrativ", "deconstruc", "exploded", "explode", "try-on", "tryon", "producción visual", "produccion visual"];
    const videoRegexKeywords = [/\bad\b/, /\bads\b/, /\bmacro\b/, /\bcta\b/, /\bfoto\b/, /\bphoto\b/, /\bimagen\b/, /\bimage\b/];
    const queryHasVideoIntent = videoKeywords.some(kw => queryLower.includes(kw)) || videoRegexKeywords.some(re => re.test(queryLower));
    const isVideoTask = useCase === "images" || useCase === "campaign_production" || useCase === "redesign" || useCase === "exploded_view" || useCase === "generator" || (useCase === "general" && queryHasVideoIntent);
    if (isVideoTask) {
      try {
        const { getPlaybookSummary, getNarrativeFlowSummary } = await import("./advertising-playbook-kb.js");
        const { getCampaignProductionSummary } = await import("./campaign-production-kb.js");
        const { getExplodedViewSummary } = await import("./exploded-view-kb.js");
        const pbSummary = getPlaybookSummary();
        const cpSummary = getCampaignProductionSummary();
        const evSummary = getExplodedViewSummary();
        lines.push("\n🎬 KNOWLEDGE BASES ESTÁTICAS DISPONIBLES (producción de video profesional):");
        lines.push(`  Advertising Playbook: ${pbSummary.campaignTypeCount} tipos de campaña, ${pbSummary.ugcArchetypeCount} arquetipos UGC, ${pbSummary.masterFormulaComponentCount} componentes Master Formula, ${pbSummary.narrativeStepCount} pasos narrativos, ${pbSummary.clipTypeTemplateCount} templates por tipo de clip, ${pbSummary.platformPromptRecipeCount} recetas por plataforma`);
        lines.push(`  Campaign Production: ${cpSummary.totalVideos} vídeos, ${cpSummary.totalUgcClips} micro-clips UGC, ${cpSummary.characterVariants} variantes de personaje, ${cpSummary.deliverables} entregables`);
        lines.push(`  Exploded View Studio: ${evSummary.totalGlobalStates} GLOBAL STATE templates, ${evSummary.totalSequences} secuencias de prompt, ${evSummary.totalProductPresets} presets de producto`);
        lines.push(`  Flujo narrativo ideal: ${getNarrativeFlowSummary()}`);
      } catch { /* static KBs not critical — continue */ }
    }

    const cogsKeywords = ["cogs", "coste", "costo", "margen", "margin", "precio", "price", "pricing", "financ", "ltv", "cac", "break-even", "equilibrio", "supply chain", "cadena de suministro", "proveedor", "unit economics"];
    const queryHasCogsIntent = cogsKeywords.some(kw => queryLower.includes(kw));
    if (useCase === "pricing" || useCase === "cogs_estimation" || useCase === "financial" || (useCase === "general" && queryHasCogsIntent)) {
      try {
        const { getCogsMethodologySummary } = await import("./cogs-methodology-kb.js");
        const cogsSummary = getCogsMethodologySummary();
        lines.push("\n📊 COGS METHODOLOGY KB:");
        lines.push(`  ${cogsSummary.pillarCount} pilares, ${cogsSummary.hiddenCostCategoryCount} categorías de costes ocultos, ${cogsSummary.tcoComponentCount} componentes TCO, ${cogsSummary.calculationStepCount} pasos de cálculo`);
      } catch { /* not critical */ }
    }

    lines.push("━━━ FIN CONTEXTO SHOPYBRAIN (base: 46,000+ insights OmniCore) ━━━");
    return lines.join("\n");
  } catch {
    return "";
  }
}

export async function buildBrandDnaContext(projectId: number): Promise<string> {
  try {
    const [visualDna, brandDnaRows] = await Promise.all([
      db.select().from(visualDnaTable).where(eq(visualDnaTable.projectId, projectId)).catch(() => []),
      db.execute(sql`SELECT * FROM brand_dna WHERE project_id = ${projectId} ORDER BY extracted_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
    ]);

    const dna = visualDna[0] ?? null;
    const brandRow = brandDnaRows.rows[0] as Record<string, unknown> | undefined ?? null;

    let fullProfile: Record<string, any> | null = null;
    if (brandRow?.full_profile_json) {
      try { fullProfile = JSON.parse(brandRow.full_profile_json as string); } catch { /* ignore */ }
    }

    const lines: string[] = ["\n━━━ ADN DE MARCA — IDENTIDAD COMPLETA DEL PROYECTO ━━━"];

    // — Comprehensive Brand DNA from real extraction —
    if (fullProfile) {
      const ci = fullProfile.companyInfo;
      const bi = fullProfile.brandIdentity;
      const vi = fullProfile.visualIdentity;
      const ta = fullProfile.targetAudience;
      const mp = fullProfile.marketPosition;
      const cs = fullProfile.contentStrategy;
      const dp = fullProfile.digitalPresence;
      const intel = fullProfile.intelligence;

      if (ci?.name) lines.push(`Marca: ${ci.name}`);
      if (ci?.sector) lines.push(`Sector: ${ci.sector}`);
      if (ci?.description) lines.push(`Empresa: ${ci.description}`);
      if (ci?.location) lines.push(`Ubicación: ${ci.location}`);

      if (fullProfile.services?.length) {
        lines.push(`Servicios/Productos: ${(fullProfile.services as any[]).map((s: any) => s.name).join(", ")}`);
      }

      if (bi) {
        if (bi.archetype) lines.push(`Arquetipo de marca: ${bi.archetype}`);
        if (bi.tone) lines.push(`Tono de voz: ${bi.tone}`);
        if (bi.personality?.length) lines.push(`Personalidad: ${bi.personality.join(", ")}`);
        if (bi.values?.length) lines.push(`Valores de marca: ${bi.values.join(", ")}`);
        if (bi.uniqueValueProposition) lines.push(`UVP: "${bi.uniqueValueProposition}"`);
        if (bi.taglines?.length) lines.push(`Taglines: ${bi.taglines.map((t: string) => `"${t}"`).join(", ")}`);
        if (bi.messagingPillars?.length) lines.push(`Pilares de mensaje: ${bi.messagingPillars.join(" | ")}`);
      }

      if (vi) {
        if (vi.primaryColors?.length) lines.push(`Colores primarios: ${vi.primaryColors.join(", ")}`);
        if (vi.typographyStyle) lines.push(`Tipografía: ${vi.typographyStyle}`);
        if (vi.layoutPattern) lines.push(`Layout: ${vi.layoutPattern}`);
        if (vi.photographyStyle) lines.push(`Fotografía: ${vi.photographyStyle}`);
        if (vi.aestheticKeywords?.length) lines.push(`Estética: ${vi.aestheticKeywords.join(", ")}`);
      }

      if (ta) {
        if (ta.primary) lines.push(`Audiencia objetivo: ${ta.primary}`);
        if (ta.demographics?.ageRange) lines.push(`Edad: ${ta.demographics.ageRange}, Género: ${ta.demographics.gender ?? ""}, Nivel: ${ta.demographics.income ?? ""}`);
        if (ta.painPoints?.length) lines.push(`Pain points que resuelve: ${ta.painPoints.join(", ")}`);
        if (ta.desires?.length) lines.push(`Aspiraciones del cliente: ${ta.desires.join(", ")}`);
      }

      if (mp) {
        if (mp.pricePoint) lines.push(`Posicionamiento precio: ${mp.pricePoint}`);
        if (mp.competitiveAdvantage) lines.push(`Ventaja competitiva: ${mp.competitiveAdvantage}`);
      }

      if (cs) {
        if (cs.contentPillars?.length) lines.push(`Pilares de contenido: ${cs.contentPillars.join(", ")}`);
        if (cs.ctaStyle) lines.push(`Estilo CTA: ${cs.ctaStyle}`);
        if (cs.copywritingStyle) lines.push(`Estilo de copy: ${cs.copywritingStyle}`);
        if (cs.keyMessages?.length) lines.push(`Mensajes clave: ${cs.keyMessages.join(" | ")}`);
      }

      if (dp?.socialHandles?.length) {
        lines.push(`Redes sociales: ${(dp.socialHandles as any[]).map((h: any) => `${h.platform}:${h.handle}`).join(", ")}`);
      }

      if (intel?.contentPersonalizationGuide) {
        lines.push(`GUÍA DE CONTENIDO: ${intel.contentPersonalizationGuide}`);
      }
    } else {
      // Fallback to basic brand_dna columns
      if (brandRow) {
        if (brandRow.sector) lines.push(`Sector: ${brandRow.sector}`);
        if (brandRow.tone_of_voice) lines.push(`Tono de voz: ${brandRow.tone_of_voice}`);
        if (brandRow.brand_personality) lines.push(`Personalidad: ${brandRow.brand_personality}`);
        if (brandRow.target_audience) lines.push(`Audiencia: ${brandRow.target_audience}`);
        if (brandRow.unique_value_proposition) lines.push(`UVP: "${brandRow.unique_value_proposition}"`);
        if (brandRow.brand_archetype) lines.push(`Arquetipo: ${brandRow.brand_archetype}`);
        if (brandRow.primary_colors && (brandRow.primary_colors as string[]).length) {
          lines.push(`Colores: ${(brandRow.primary_colors as string[]).join(", ")}`);
        }
        if (brandRow.brand_values && (brandRow.brand_values as string[]).length) {
          lines.push(`Valores: ${(brandRow.brand_values as string[]).join(", ")}`);
        }
        if (brandRow.content_pillars && (brandRow.content_pillars as string[]).length) {
          lines.push(`Pilares de contenido: ${(brandRow.content_pillars as string[]).join(", ")}`);
        }
        if (brandRow.competitive_position) lines.push(`Posición competitiva: ${brandRow.competitive_position}`);
      }
    }

    // — Visual DNA (photographic style) —
    if (dna) {
      if (dna.backgroundStyle) lines.push(`Fondo fotográfico: ${dna.backgroundStyle}`);
      if (dna.lightingStyle) lines.push(`Iluminación: ${dna.lightingStyle}`);
      if (dna.colorTemp) lines.push(`Temperatura de color: ${dna.colorTemp}`);
      if (dna.mood) lines.push(`Mood visual: ${dna.mood}`);
      if (dna.brandColors?.length) lines.push(`Colores visuales: ${dna.brandColors.join(", ")}`);
    }

    if (lines.length <= 1) return "";

    lines.push("\nINSTRUCCIÓN CRÍTICA: Usa esta identidad de marca en TODO el contenido generado — textos, imágenes, prompts, emails, anuncios, descripciones. El tono, los colores, los valores y el arquetipo deben estar SIEMPRE presentes. NO generes contenido genérico — personaliza al 100% a este ADN de marca.");
    lines.push("━━━ FIN ADN DE MARCA ━━━");
    return lines.join("\n");
  } catch {
    return "";
  }
}

export async function buildSmartBrainContext(
  query: string,
  useCase: string,
  niche?: string | null,
  platformType?: string,
  maxChars = 12000,
): Promise<string> {
  try {
    const keywords = query
      .toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 8);

    if (keywords.length === 0) {
      return buildShopyBrainContext(niche ?? undefined, useCase as BrainUseCase, query, platformType);
    }

    const searchTerms = keywords.join(" | ");

    const [relevantMemories, relevantInsights, nicheMemories] = await Promise.all([
      db.execute(sql`
        SELECT title, content, memory_type, niche, confidence, 
               ts_rank(to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,'')), 
                       to_tsquery('spanish', ${searchTerms})) as rank
        FROM omnicore_memories 
        WHERE to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(content,'')) 
              @@ to_tsquery('spanish', ${searchTerms})
        ORDER BY rank DESC, confidence DESC
        LIMIT 15
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT title, insight, domain, confidence, impact_score
        FROM omnicore_insights
        WHERE to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(insight,''))
              @@ to_tsquery('spanish', ${searchTerms})
        ORDER BY impact_score DESC, confidence DESC
        LIMIT 8
      `).catch(() => ({ rows: [] })),

      niche ? db.select()
        .from(omnicoreMemoriesTable)
        .where(sql`lower(${omnicoreMemoriesTable.niche}) LIKE ${'%' + niche.toLowerCase() + '%'}`)
        .orderBy(desc(omnicoreMemoriesTable.confidence))
        .limit(5) : Promise.resolve([]),
    ]);

    const lines: string[] = ["━━━ SHOPY BRAIN — CONTEXTO RELEVANTE ━━━"];

    if (platformType && platformType !== "shopify") {
      const platformNotes: Record<string, string> = {
        woocommerce: "Plataforma: WooCommerce. API: WC REST v3, Basic Auth. SEO: Yoast/RankMath. Status: publish/draft/private.",
        prestashop: "Plataforma: PrestaShop. API: Webservice XML/JSON. SEO: URL amigables + meta tags nativos. Stock: stock_availables.",
        universal: "Plataforma: Auditoría Universal (web genérica). Sin gestión de productos — solo análisis SEO, diseño, PageSpeed.",
      };
      if (platformNotes[platformType]) lines.push(`🔧 ${platformNotes[platformType]}`);
    }

    let charCount = 0;
    const memRows = (relevantMemories as any).rows ?? [];
    if (memRows.length > 0) {
      lines.push("\n🧠 Conocimiento relevante:");
      for (const m of memRows) {
        const chunk = `  [${m.memory_type}] ${m.title}: ${(m.content ?? "").slice(0, 800)}`;
        if (charCount + chunk.length > maxChars * 0.6) break;
        lines.push(chunk);
        charCount += chunk.length;
      }
    }

    const insRows = (relevantInsights as any).rows ?? [];
    if (insRows.length > 0) {
      lines.push("\n💡 Insights aplicables:");
      for (const ins of insRows) {
        const chunk = `  [${ins.domain}] ${ins.title}: ${ins.insight} (confianza: ${ins.confidence})`;
        if (charCount + chunk.length > maxChars * 0.8) break;
        lines.push(chunk);
        charCount += chunk.length;
      }
    }

    if (nicheMemories.length > 0) {
      lines.push(`\n📌 Conocimiento del nicho "${niche}":`);
      for (const m of nicheMemories.slice(0, 3)) {
        const chunk = `  ${m.title}: ${(m.content ?? "").slice(0, 500)}`;
        if (charCount + chunk.length > maxChars) break;
        lines.push(chunk);
        charCount += chunk.length;
      }
    }

    lines.push("━━━ FIN CONTEXTO RELEVANTE ━━━");

    if (memRows.length === 0 && insRows.length === 0 && nicheMemories.length === 0) {
      return buildShopyBrainContext(niche ?? undefined, useCase as BrainUseCase, query, platformType);
    }

    return lines.join("\n");
  } catch {
    return buildShopyBrainContext(niche ?? undefined, useCase as BrainUseCase, query, platformType);
  }
}

/**
 * askClaude enhanced with ShopyBrain + BrandDNA context injection (returns raw string).
 * Uses buildSmartBrainContext for relevance-based context (full-text search).
 */
export async function askClaudeWithBrain(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  useCase: BrainUseCase = "general",
  niche?: string,
  maxTokens = 32000,
  timeoutMs = 180_000,
  opts?: ClaudeCallOpts,
): Promise<string> {
  const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content;
  const platform = await resolvePlatformType(projectId);
  const [brainContext, brandDna] = await Promise.all([
    buildSmartBrainContext(lastUserMsg ?? "", useCase, niche, platform),
    buildBrandDnaContext(projectId),
  ]);
  const base = systemPrompt ?? SHOPIFY_EXPERT_SYSTEM;
  const enrichedSystem = base + (brainContext || "") + (brandDna || "");
  const totalUserContent = messages.map(m => m.content).join("\n");
  const budget = enforcePromptBudget(enrichedSystem, totalUserContent, maxTokens);
  return askClaude(projectId, messages, budget.system, maxTokens, timeoutMs, opts);
}

/**
 * askClaudeWithBrain que además devuelve stop_reason/truncated. El contexto
 * ShopyBrain se busca con el PRIMER mensaje de usuario (el encargo), así las
 * continuaciones ("continúa donde lo dejaste") reutilizan el mismo contexto.
 */
export async function askClaudeWithBrainDetailed(
  projectId: number,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt?: string,
  useCase: BrainUseCase = "general",
  niche?: string,
  maxTokens = 32000,
  timeoutMs = 180_000,
  opts?: ClaudeCallOpts,
): Promise<ClaudeTextResult> {
  const firstUserMsg = messages.find(m => m.role === "user")?.content;
  const platform = await resolvePlatformType(projectId);
  const [brainContext, brandDna] = await Promise.all([
    buildSmartBrainContext(firstUserMsg ?? "", useCase, niche, platform),
    buildBrandDnaContext(projectId),
  ]);
  const base = systemPrompt ?? SHOPIFY_EXPERT_SYSTEM;
  const enrichedSystem = base + (brainContext || "") + (brandDna || "");
  const totalUserContent = messages.map(m => m.content).join("\n");
  const budget = enforcePromptBudget(enrichedSystem, totalUserContent, maxTokens);
  return askClaudeDetailed(projectId, messages, budget.system, maxTokens, timeoutMs, opts, "askClaudeWithBrain");
}

export async function askClaudeJsonWithBrain<T>(
  projectId: number,
  prompt: string,
  systemPrompt: string,
  useCase: BrainUseCase = "general",
  niche?: string,
  maxTokens = 32000,
  timeoutMs = 180_000
): Promise<T> {
  const platform = await resolvePlatformType(projectId);
  const [brainContext, brandDna] = await Promise.all([
    buildSmartBrainContext(prompt, useCase, niche, platform),
    buildBrandDnaContext(projectId),
  ]);
  const enrichedSystem = systemPrompt + (brainContext || "") + (brandDna || "");
  const budget = enforcePromptBudget(enrichedSystem, prompt, maxTokens);
  return askClaudeJson<T>(projectId, budget.user, budget.system, maxTokens, timeoutMs);
}

async function detectAndSaveCrossConnections(
  operationType: string, content: string, _niche: string | null, _tags: string[]
): Promise<void> {
  const domainKeywords: Record<string, RegExp> = {
    pricing: /precio|margen|cogs|revenue|profit|coste|€|\$|margin|break.?even/i,
    seo: /seo|keyword|meta|title|description|schema|google|ranking|tráfico/i,
    design: /css|diseño|color|tipograf|layout|responsive|ux|ui|accesib/i,
    marketing: /email|campaña|engagement|conversión|funnel|cta|newsletter/i,
    competitor: /competidor|competencia|rival|mercado|benchmark|amenaza/i,
    inventory: /stock|inventario|unidades|agotad|restock|almacén/i,
    campaign_production: /campaign|video.?campaign|ugc|lip.?sync|storyboard|voice.?over|micro.?clip|master.?cut|character.?lock|prompt.?916|prompt.?169|9:16|16:9/i,
    exploded_view: /exploded.?view|vista.?explosion|deconstrucci|disassembl|assembl.*product|product.?burst|magnetic.?assembl|parallel.?prompt|global.?state.*camera|locked.?camera|optical.?flow|morph.?cut|seedance|pollo\.?ai|omneky|kling.*3|runway.*gen|veo.*3|wan.*flf|first.?last.?frame/i,
  };

  const detectedDomains: string[] = [];
  for (const [domain, regex] of Object.entries(domainKeywords)) {
    if (regex.test(content)) detectedDomains.push(domain);
  }

  if (detectedDomains.length >= 2) {

    await db.insert(omnicoreCrossConnectionsTable).values({
      id: randomBytes(12).toString("hex"),
      insightA: `${detectedDomains[0]}:${operationType}`,
      insightB: `${detectedDomains[1]}:${operationType}`,
      connectionType: "auto_detected",
      connectionStrength: Math.min(0.9, 0.5 + (detectedDomains.length * 0.1)),
    }).catch(() => {});
  }
}

/**
 * learnFromOperation v2 — Enhanced: structured data, monetary values, cross-connections.
 * Backward-compatible with v1 — same required params, new optional fields.
 * Fire-and-forget, never throws.
 */
export function learnFromOperation(params: {
  operationType: string;
  niche?: string | null;
  productType?: string | null;
  title: string;
  content: string;
  confidence?: number;
  tags?: string[];
  structuredData?: Record<string, unknown>;
  sourceProjectId?: number;
  relatedProductId?: string;
  monetaryValues?: { revenue?: number; cost?: number; margin?: number; price?: number };
  metrics?: Record<string, number>;
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
    campaign_adaptation: "prompt_template",
    campaign_production: "prompt_template",
    video_campaign: "prompt_template",
    ugc_clip: "prompt_template",
    storyboard: "prompt_template",
    brand_adaptation: "prompt_template",
    exploded_view_generation: "prompt_template",
    exploded_view: "prompt_template",
    product_deconstruction: "prompt_template",
    parallel_prompt: "prompt_template",
  };

  const memoryType = memTypeMap[params.operationType] ?? "general";
  const allTags = [...new Set([...(params.tags ?? []), params.operationType, params.niche ?? "", params.productType ?? ""].filter(Boolean))];

  db.insert(omnicoreMemoriesTable).values({
    id: randomBytes(16).toString("hex"),
    memoryType,
    niche: params.niche ?? null,
    productType: params.productType ?? null,
    market: "es",
    title: params.title.slice(0, 200),
    content: params.content.slice(0, 15000),
    confidence: params.confidence ?? 0.65,
    sourceType: `auto_${params.operationType}`,
    tags: JSON.stringify(allTags),
    isVerified: 0,
    useCount: 1,
    successCount: 1,
    successRate: 1.0,
  }).catch(() => {});

  if (params.monetaryValues && Object.keys(params.monetaryValues).length > 0) {
    db.execute(sql`
      INSERT INTO pricing_intelligence (id, niche, product_type, operation_type, 
        revenue, cost, margin, price, created_at)
      VALUES (${randomBytes(8).toString("hex")}, ${params.niche ?? null}, ${params.productType ?? null}, 
        ${params.operationType}, ${params.monetaryValues.revenue ?? null}, ${params.monetaryValues.cost ?? null},
        ${params.monetaryValues.margin ?? null}, ${params.monetaryValues.price ?? null}, NOW())
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }

  detectAndSaveCrossConnections(params.operationType, params.content, params.niche ?? null, allTags).catch(() => {});
}
