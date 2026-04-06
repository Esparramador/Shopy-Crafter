import { logger } from "./logger.js";
import { isGeminiAvailable } from "./gemini.js";
import { buildShopyBrainContext } from "./claude.js";

export type DualMode =
  | "parallel_synthesis"
  | "gemini_research_claude_redact"
  | "gemini_only"
  | "claude_only";

type ClaudeUseCase = "redesign" | "seo" | "pricing" | "images" | "general";
type UseCase = ClaudeUseCase | "inventory" | "competitors" | "intelligence" | "ab_testing" | "ecommerce";

const useCaseToClaudeMap: Record<string, ClaudeUseCase> = {
  redesign: "redesign", seo: "seo", pricing: "pricing", images: "images", general: "general",
  inventory: "general", competitors: "general", intelligence: "general",
  ab_testing: "general", ecommerce: "general",
};
function toClaudeUseCase(uc: UseCase): ClaudeUseCase {
  return useCaseToClaudeMap[uc] ?? "general";
}

export interface DualAIResult {
  final: string;
  claudeResult?: string;
  geminiResult?: string;
  geminiSources?: string[];
  mode: DualMode;
  timings: { claude?: number; gemini?: number; synthesis?: number; total: number };
}

export interface DualAIOpts {
  mode?: DualMode;
  systemPrompt?: string;
  geminiSystemPrompt?: string;
  claudeSystemPrompt?: string;
  geminiUseSearch?: boolean;
  maxTokens?: number;
  synthesisPrompt?: string;
  niche?: string;
  useCase?: UseCase;
}

async function callClaudeBrain(
  projectId: number,
  prompt: string,
  systemPrompt: string | undefined,
  useCase: UseCase,
  niche: string | undefined,
  maxTokens: number
): Promise<string> {
  const { askClaudeWithBrain } = await import("./claude.js");
  return askClaudeWithBrain(projectId, [{ role: "user", content: prompt }], systemPrompt, toClaudeUseCase(useCase), niche, maxTokens);
}

async function callGeminiText(
  prompt: string,
  systemPrompt: string | undefined,
  useSearch: boolean
): Promise<{ text: string; sources: string[] }> {
  if (useSearch) {
    const { askGeminiWithSearch } = await import("./gemini.js");
    const r = await askGeminiWithSearch(prompt, systemPrompt);
    return { text: r.text, sources: r.sources };
  }
  const { askGemini } = await import("./gemini.js");
  const text = await askGemini(prompt, systemPrompt);
  return { text, sources: [] };
}

export async function dualAI(
  projectId: number,
  prompt: string,
  opts: DualAIOpts = {}
): Promise<DualAIResult> {
  const start = Date.now();
  const mode = opts.mode ?? "parallel_synthesis";
  const maxTokens = opts.maxTokens ?? 16384;
  const useCase = opts.useCase ?? "general";
  const niche = opts.niche;
  const geminiAvailable = isGeminiAvailable();

  if (mode === "claude_only" || !geminiAvailable) {
    const t0 = Date.now();
    const claudeResult = await callClaudeBrain(projectId, prompt, opts.claudeSystemPrompt ?? opts.systemPrompt, useCase, niche, maxTokens);
    return { final: claudeResult, claudeResult, mode: "claude_only", timings: { claude: Date.now() - t0, total: Date.now() - start } };
  }

  if (mode === "gemini_only") {
    const t0 = Date.now();
    const g = await callGeminiText(prompt, opts.geminiSystemPrompt ?? opts.systemPrompt, opts.geminiUseSearch ?? false);
    return { final: g.text, geminiResult: g.text, geminiSources: g.sources, mode: "gemini_only", timings: { gemini: Date.now() - t0, total: Date.now() - start } };
  }

  if (mode === "gemini_research_claude_redact") {
    let geminiText = "";
    let geminiSrcList: string[] = [];
    let geminiTime = 0;
    try {
      const t0g = Date.now();
      const g = await callGeminiText(
        prompt,
        opts.geminiSystemPrompt ?? "Eres un analista de inteligencia de negocio. Investiga a fondo usando búsqueda web real. Recopila datos, cifras, tendencias, competidores y hechos verificables. Sé exhaustivo y factual. Responde en español.",
        true
      );
      geminiTime = Date.now() - t0g;
      geminiText = g.text;
      geminiSrcList = g.sources;
    } catch (err) {
      logger.warn({ err: String(err) }, "Dual AI: Gemini research failed, falling back to Claude only");
    }

    const sourcesBlock = geminiSrcList.length > 0
      ? `\n\nFuentes verificadas por Gemini:\n${geminiSrcList.slice(0, 10).map(s => `• ${s}`).join("\n")}`
      : "";

    const claudePrompt = geminiText
      ? `INVESTIGACIÓN PREVIA (datos reales de búsqueda web por Gemini AI):\n${geminiText.slice(0, 30000)}${sourcesBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nUsando esa investigación como base factual, ${prompt}\n\nINSTRUCCIONES:\n- Usa los datos de la investigación como fuente factual verificada\n- Añade tu expertise en redacción, copywriting y estrategia\n- Genera contenido profesional, completo y listo para producción\n- No inventes datos — usa los que se investigaron\n- Enriquece con insights estratégicos y recomendaciones de experto`
      : prompt;

    const t0c = Date.now();
    const claudeResult = await callClaudeBrain(projectId, claudePrompt, opts.claudeSystemPrompt ?? opts.systemPrompt, useCase, niche, maxTokens);
    const claudeTime = Date.now() - t0c;

    return {
      final: claudeResult,
      claudeResult,
      geminiResult: geminiText || undefined,
      geminiSources: geminiSrcList.length > 0 ? geminiSrcList : undefined,
      mode: "gemini_research_claude_redact",
      timings: { gemini: geminiTime || undefined, claude: claudeTime, total: Date.now() - start },
    };
  }

  const brainCtx = await buildShopyBrainContext(niche, useCase, prompt);
  const geminiPromptText = opts.geminiSystemPrompt
    ? prompt
    : `${prompt}\n\nContexto del cerebro de la agencia (46,000+ insights):\n${brainCtx.slice(0, 10000)}`;

  const [claudeSettled, geminiSettled] = await Promise.allSettled([
    (async () => {
      const t = Date.now();
      const result = await callClaudeBrain(projectId, prompt, opts.claudeSystemPrompt ?? opts.systemPrompt, useCase, niche, maxTokens);
      return { result, time: Date.now() - t };
    })(),
    (async () => {
      const t = Date.now();
      const g = await callGeminiText(geminiPromptText, opts.geminiSystemPrompt ?? opts.systemPrompt, opts.geminiUseSearch ?? false);
      return { result: g.text, sources: g.sources, time: Date.now() - t };
    })(),
  ]);

  const claudeOk = claudeSettled.status === "fulfilled";
  const geminiOk = geminiSettled.status === "fulfilled";

  if (!claudeOk && !geminiOk) {
    throw new Error("Ambos motores IA fallaron. Inténtalo de nuevo.");
  }

  const claudeResult = claudeOk ? claudeSettled.value.result : undefined;
  const geminiResult = geminiOk ? geminiSettled.value.result : undefined;
  const geminiSources = geminiOk ? geminiSettled.value.sources : undefined;
  const claudeTime = claudeOk ? claudeSettled.value.time : undefined;
  const geminiTime = geminiOk ? geminiSettled.value.time : undefined;

  if (!claudeOk) {
    logger.warn({ err: String((claudeSettled as PromiseRejectedResult).reason) }, "Dual AI: Claude failed, using Gemini only");
    return { final: geminiResult!, geminiResult, geminiSources, mode: "parallel_synthesis", timings: { gemini: geminiTime, total: Date.now() - start } };
  }
  if (!geminiOk) {
    logger.warn({ err: String((geminiSettled as PromiseRejectedResult).reason) }, "Dual AI: Gemini failed, using Claude only");
    return { final: claudeResult!, claudeResult, mode: "parallel_synthesis", timings: { claude: claudeTime, total: Date.now() - start } };
  }

  const sourcesRef = geminiSources && geminiSources.length > 0
    ? `\n\nFuentes web consultadas:\n${geminiSources.slice(0, 8).map(s => `• ${s}`).join("\n")}`
    : "";

  const synthPrompt = opts.synthesisPrompt ??
    `Eres el Director Estratégico de ShopyBrain. Tienes DOS análisis independientes del mismo tema, uno de cada motor de IA. Tu misión: sintetizar lo MEJOR de ambos en un resultado SUPERIOR a cualquiera por separado.

ANÁLISIS A (Claude — expertise en redacción, copywriting y estrategia):
${claudeResult!.slice(0, 20000)}

ANÁLISIS B (Gemini — expertise en datos, búsqueda web y análisis de mercado):
${geminiResult!.slice(0, 20000)}${sourcesRef}

INSTRUCCIONES DE SÍNTESIS:
1. Combina los datos factuales de ambos análisis
2. Donde ambos coincidan → marca como "alta confianza" (consenso de 2 IAs)
3. Donde difieran → incluye ambas perspectivas con matices explicados
4. Prioriza datos verificables y con fuentes sobre opiniones
5. Mantén la calidad de redacción premium de Claude enriquecida con los datos de Gemini
6. El resultado final debe ser notablemente MÁS completo que cualquiera por separado
7. Si hay fuentes web, referenciarlas para credibilidad
8. Responde en español, tono profesional de agencia premium`;

  const t0s = Date.now();
  let synthesis: string;
  let synthTime: number;
  try {
    synthesis = await callClaudeBrain(projectId, synthPrompt, opts.claudeSystemPrompt ?? opts.systemPrompt, useCase, niche, Math.min(Math.round(maxTokens * 1.5), 16000));
    synthTime = Date.now() - t0s;
  } catch (synthErr) {
    logger.warn({ err: String(synthErr) }, "Dual AI: Synthesis failed, falling back to Claude result");
    synthesis = claudeResult!;
    synthTime = Date.now() - t0s;
  }

  return {
    final: synthesis,
    claudeResult,
    geminiResult,
    geminiSources,
    mode: "parallel_synthesis",
    timings: { claude: claudeTime, gemini: geminiTime, synthesis: synthTime, total: Date.now() - start },
  };
}

export async function dualAIJson<T>(
  projectId: number,
  prompt: string,
  opts: Omit<DualAIOpts, "synthesisPrompt"> = {}
): Promise<{ data: T; sources: { claude?: unknown; gemini?: unknown }; mode: DualMode; timings: DualAIResult["timings"] }> {
  const start = Date.now();
  const mode = opts.mode ?? "parallel_synthesis";
  const useCase = opts.useCase ?? "general";
  const geminiAvailable = isGeminiAvailable();

  if (mode === "claude_only" || !geminiAvailable) {
    const { askClaudeJsonWithBrain } = await import("./claude.js");
    const t0 = Date.now();
    const data = await askClaudeJsonWithBrain<T>(projectId, prompt, opts.claudeSystemPrompt ?? opts.systemPrompt ?? "", toClaudeUseCase(useCase), opts.niche, opts.maxTokens ?? 16384);
    return { data, sources: { claude: data }, mode: "claude_only", timings: { claude: Date.now() - t0, total: Date.now() - start } };
  }

  if (mode === "gemini_only") {
    const { askGeminiJson } = await import("./gemini.js");
    const t0 = Date.now();
    const data = await askGeminiJson<T>(prompt, opts.geminiSystemPrompt ?? opts.systemPrompt);
    return { data, sources: { gemini: data }, mode: "gemini_only", timings: { gemini: Date.now() - t0, total: Date.now() - start } };
  }

  if (mode === "gemini_research_claude_redact") {
    let geminiText = "";
    let geminiSources: string[] = [];
    let geminiTime = 0;
    try {
      const t0g = Date.now();
      const g = await callGeminiText(
        prompt,
        opts.geminiSystemPrompt ?? "Investiga a fondo usando búsqueda web real. Devuelve datos factuales en formato JSON.",
        true
      );
      geminiTime = Date.now() - t0g;
      geminiText = g.text;
      geminiSources = g.sources;
    } catch (err) {
      logger.warn({ err: String(err) }, "DualAI JSON: Gemini research failed, falling back to Claude only");
    }

    const { askClaudeJsonWithBrain } = await import("./claude.js");
    const t0c = Date.now();
    const claudePrompt = geminiText
      ? `INVESTIGACIÓN PREVIA (datos reales de Gemini):\n${geminiText.slice(0, 25000)}\n\nFuentes: ${geminiSources.slice(0, 15).join(", ")}\n\n━━━━━━━━━━━━\n\nUsando esa investigación, ${prompt}`
      : prompt;
    const data = await askClaudeJsonWithBrain<T>(
      projectId,
      claudePrompt,
      opts.claudeSystemPrompt ?? opts.systemPrompt ?? "",
      toClaudeUseCase(useCase),
      opts.niche,
      opts.maxTokens ?? 16384
    );
    const claudeTime = Date.now() - t0c;

    return { data, sources: { claude: data, gemini: geminiText || undefined }, mode: "gemini_research_claude_redact", timings: { gemini: geminiTime || undefined, claude: claudeTime, total: Date.now() - start } };
  }

  const { askClaudeJsonWithBrain } = await import("./claude.js");
  const { askGeminiJson } = await import("./gemini.js");

  const [claudeSettled, geminiSettled] = await Promise.allSettled([
    (async () => {
      const t = Date.now();
      const data = await askClaudeJsonWithBrain<T>(projectId, prompt, opts.claudeSystemPrompt ?? opts.systemPrompt ?? "", toClaudeUseCase(useCase), opts.niche, opts.maxTokens ?? 16384);
      return { data, time: Date.now() - t };
    })(),
    (async () => {
      const t = Date.now();
      const data = await askGeminiJson<T>(prompt, opts.geminiSystemPrompt ?? opts.systemPrompt);
      return { data, time: Date.now() - t };
    })(),
  ]);

  const claudeOk = claudeSettled.status === "fulfilled";
  const geminiOk = geminiSettled.status === "fulfilled";

  if (!claudeOk && !geminiOk) throw new Error("Ambos motores IA fallaron para JSON");

  if (!claudeOk) {
    logger.warn("DualAI JSON: Claude failed, using Gemini");
    const gv = (geminiSettled as PromiseFulfilledResult<{ data: T; time: number }>).value;
    return { data: gv.data, sources: { gemini: gv.data }, mode, timings: { gemini: gv.time, total: Date.now() - start } };
  }
  if (!geminiOk) {
    logger.warn("DualAI JSON: Gemini failed, using Claude");
    const cv = (claudeSettled as PromiseFulfilledResult<{ data: T; time: number }>).value;
    return { data: cv.data, sources: { claude: cv.data }, mode, timings: { claude: cv.time, total: Date.now() - start } };
  }

  const cv = (claudeSettled as PromiseFulfilledResult<{ data: T; time: number }>).value;
  const gv = (geminiSettled as PromiseFulfilledResult<{ data: T; time: number }>).value;

  return {
    data: cv.data,
    sources: { claude: cv.data, gemini: gv.data },
    mode,
    timings: { claude: cv.time, gemini: gv.time, total: Date.now() - start },
  };
}
