const MODEL_ALIAS: Record<string, string> = {
  // Gemini
  "gemini-2.5-flash": "Gemini Flash 2.5",
  "gemini-2.5-flash-latest": "Gemini Flash 2.5",
  "gemini-2.5-pro": "Gemini Pro 2.5",
  "gemini-2.5-pro-latest": "Gemini Pro 2.5",
  "gemini-2.0-flash": "Gemini Flash 2.0",
  "gemini-2.0-flash-exp": "Gemini Flash 2.0",
  "gemini-1.5-flash": "Gemini Flash 1.5",
  "gemini-1.5-flash-latest": "Gemini Flash 1.5",
  "gemini-1.5-pro": "Gemini Pro 1.5",
  "gemini-1.5-pro-latest": "Gemini Pro 1.5",
  "gemini-3.5-flash": "Gemini Flash 3.5",
  "gemini-3.5-flash-latest": "Gemini Flash 3.5",
  // Claude / Anthropic
  "claude-opus-4-8": "Claude Opus 4",
  "claude-opus-4-5": "Claude Opus 4",
  "claude-sonnet-4-6": "Claude Sonnet 4",
  "claude-sonnet-4-5": "Claude Sonnet 4",
  "claude-3-7-sonnet-latest": "Claude Sonnet 3.7",
  "claude-3-7-sonnet-20250219": "Claude Sonnet 3.7",
  "claude-3-5-sonnet-latest": "Claude Sonnet 3.5",
  "claude-3-5-sonnet-20241022": "Claude Sonnet 3.5",
  "claude-3-5-haiku-latest": "Claude Haiku 3.5",
  "claude-3-5-haiku-20241022": "Claude Haiku 3.5",
  "claude-3-opus-latest": "Claude Opus 3",
  "claude-3-haiku-20240307": "Claude Haiku 3",
  // Grok / xAI
  "grok-4.7": "Grok 4.7",
  "grok-4.6": "Grok 4.6",
  "grok-4.5": "Grok 4.5",
  "grok-4.3": "Grok 4.3",
  "grok-4.20-0309-reasoning": "Grok 4.20 Reasoning",
  "grok-4.20-0309-non-reasoning": "Grok 4.20",
  "grok-4.20-multi-agent-0309": "Grok 4.20 Multi-Agent",
  "grok-build-0.1": "Grok Build 0.1",
  "grok-3": "Grok 3",
  "grok-3-mini": "Grok 3 Mini",
  "grok-2": "Grok 2",
  "grok-2-mini": "Grok 2 Mini",
  "grok-beta": "Grok Beta",
};

export function getModelShortName(modelId: string | null | undefined): string {
  if (!modelId) return "—";
  const key = modelId.toLowerCase();
  return MODEL_ALIAS[key] ?? MODEL_ALIAS[modelId] ?? modelId;
}
