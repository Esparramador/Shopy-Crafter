export const AI_CONFIG = {
  claude: {
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    maxTokensDefault: 4096,
    maxTokensLong: 16000,
    timeoutMs: 180_000,
  },
  gemini: {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    proModel: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
    maxOutputTokens: 65_536,
  },
};
