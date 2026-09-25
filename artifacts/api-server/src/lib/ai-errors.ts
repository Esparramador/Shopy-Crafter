// Errores tipados de las llamadas a la IA. Viven aparte de claude.ts para que
// se puedan importar (y testear) sin arrastrar la conexión a la base de datos.

/** La respuesta se cortó por `max_tokens` (stop_reason === "max_tokens"). */
export class AiTruncatedError extends Error {
  readonly code = "truncated" as const;
  constructor(
    message: string,
    readonly details: { label?: string; maxTokens?: number; model?: string; outputTokens?: number; partialChars?: number } = {},
  ) {
    super(message);
    this.name = "AiTruncatedError";
  }
}

export type AiJsonErrorCode = "truncated" | "no_json" | "invalid_json" | "schema";

/** La IA no devolvió un JSON utilizable ni tras el reintento. */
export class AiJsonError extends Error {
  constructor(
    readonly code: AiJsonErrorCode,
    message: string,
    readonly details: { label?: string; attempts?: number; issues?: string[]; snippet?: string } = {},
  ) {
    super(message);
    this.name = "AiJsonError";
  }
}

export function isAiOutputError(err: unknown): err is AiTruncatedError | AiJsonError {
  return err instanceof AiTruncatedError || err instanceof AiJsonError;
}

/** Mensaje en español para devolver al cliente cuando falla un informe. */
export function aiOutputErrorMessage(err: AiTruncatedError | AiJsonError): string {
  if (err.code === "truncated") {
    return "La IA devolvió una respuesta incompleta (se cortó por longitud) incluso tras reintentar. No se ha guardado ningún informe parcial. Inténtalo de nuevo en unos minutos.";
  }
  return "La IA devolvió una respuesta con formato inválido incluso tras reintentar. No se ha guardado ningún informe parcial. Inténtalo de nuevo en unos minutos.";
}
