/**
 * Qué modelo responde de verdad en el chat admin (OmniChatbot) según el motor
 * elegido. Claude/GPT/NVIDIA los elige el propio chat; Gemini y Grok los
 * decide el backend por tier (GET /api/admin/ai-models):
 *   - Gemini → tier "fast" (askGeminiStream sin useProModel)
 *   - Grok   → tier "genius" (routes/shopybrain.ts, motor grok)
 */

export type ChatEngine = "auto" | "claude" | "gemini" | "brain_only" | "grok" | "gpt" | "nvidia";

export interface TierMatrixLite {
  gemini?: { fast?: { current: string } };
  xai?: { genius?: { current: string } };
}

export interface ActiveModel {
  /** ID técnico que se envía a la API, o null si no hay un único modelo. */
  id: string | null;
  /** Texto para el panel cuando no hay ID (auto, memoria, cargando). */
  label: string;
}

export function activeChatModel(
  engine: ChatEngine,
  picks: { claudeModel: string; gptModel: string; nvidiaModel: string },
  matrix: TierMatrixLite | null,
): ActiveModel {
  switch (engine) {
    case "claude": return { id: picks.claudeModel, label: picks.claudeModel };
    case "gpt": return { id: picks.gptModel, label: picks.gptModel };
    case "nvidia": return { id: picks.nvidiaModel, label: picks.nvidiaModel };
    case "gemini": {
      const id = matrix?.gemini?.fast?.current ?? null;
      return { id, label: id ?? "Gemini (leyendo modelo…)" };
    }
    case "grok": {
      const id = matrix?.xai?.genius?.current ?? null;
      return { id, label: id ?? "Grok (leyendo modelo…)" };
    }
    case "brain_only": return { id: null, label: "memoria ShopyBrain (sin modelo)" };
    case "auto":
    default: return { id: null, label: "automático según la pregunta" };
  }
}

/** Copia texto al portapapeles. Devuelve false si el navegador no lo permite. */
export async function copyText(text: string, nav: Pick<Navigator, "clipboard"> | undefined = globalThis.navigator): Promise<boolean> {
  try {
    if (!nav?.clipboard?.writeText) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
