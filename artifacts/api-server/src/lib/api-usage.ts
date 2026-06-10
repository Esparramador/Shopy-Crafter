import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { apiUsageLogTable } from "@workspace/db/schema";
import { logger } from "./logger.js";

const USD_TO_EUR = 0.92;

export type ApiProvider =
  | "claude"
  | "gemini"
  | "replicate"
  | "runway"
  | "elevenlabs"
  | "pagespeed"
  | "shopify"
  | "openai"
  | "other";

export interface RecordApiUsageInput {
  provider: ApiProvider;
  operation: string;
  model?: string | null;
  projectId?: number | null;
  inputUnits?: number;
  outputUnits?: number;
  unitsLabel?: string;
  costUsd?: number;
  costEur?: number;
  success?: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Inserta una fila en api_usage_log. Fire-and-forget: nunca debe lanzar
 * excepción que rompa el flujo principal. Si la BD falla, sólo loggea warn.
 */
export async function recordApiUsage(input: RecordApiUsageInput): Promise<void> {
  try {
    const costUsd = Number.isFinite(input.costUsd) ? Number(input.costUsd) : 0;
    const costEur = Number.isFinite(input.costEur)
      ? Number(input.costEur)
      : Number((costUsd * USD_TO_EUR).toFixed(6));
    await db.insert(apiUsageLogTable).values({
      id: randomBytes(12).toString("hex"),
      provider: input.provider,
      operation: input.operation.slice(0, 80),
      model: input.model ?? null,
      projectId: input.projectId ?? null,
      inputUnits: input.inputUnits ?? 0,
      outputUnits: input.outputUnits ?? 0,
      unitsLabel: input.unitsLabel ?? null,
      costUsd,
      costEur,
      success: input.success === false ? 0 : 1,
      errorMessage: input.errorMessage ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 4000) : null,
    });
  } catch (err) {
    logger.warn({ err: String(err), provider: input.provider, op: input.operation }, "recordApiUsage: insert failed");
  }
}

// ── Pricing helpers ──────────────────────────────────────────────────────────
// Precios reales por proveedor a fecha 2026-06, USD por unidad.

const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  // USD por 1M tokens (fuente: api.anthropic.com/v1/models, verificado 2026-06-10)
  "claude-opus-4-8":           { input: 15.0, output: 75.0 },
  "claude-opus-4-7":           { input: 15.0, output: 75.0 },
  "claude-fable-5":            { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6":         { input: 3.0,  output: 15.0 },
  "claude-haiku-4-5":          { input: 0.8,  output: 4.0  },
  "claude-sonnet-4-5":         { input: 3.0,  output: 15.0 },
  "claude-opus-4-1":           { input: 15.0, output: 75.0 },
  "claude-sonnet-4-20250514":  { input: 3.0,  output: 15.0 },
  "claude-3-5-sonnet-20241022":{ input: 3.0,  output: 15.0 },
  "claude-3-5-haiku-20241022": { input: 0.8,  output: 4.0  },
  "claude-3-opus-20240229":    { input: 15.0, output: 75.0 },
};

const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  // USD por 1M tokens — June 2026 current + legacy
  "gemini-3.5-flash":          { input: 0.075, output: 0.30 },
  "gemini-3.1-pro-preview":    { input: 1.25,  output: 5.0  },
  "gemini-3-pro-preview":      { input: 1.25,  output: 5.0  },
  "gemini-3.1-flash-lite":     { input: 0.02,  output: 0.08 },
  "gemini-2.5-pro":            { input: 1.25,  output: 5.0  },
  "gemini-2.5-flash":          { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-preview":  { input: 0.075, output: 0.30 },
  "gemini-2.0-flash":          { input: 0.075, output: 0.30 },
  "gemini-1.5-pro":            { input: 1.25,  output: 5.0  },
  "gemini-1.5-flash":          { input: 0.075, output: 0.30 },
};

export function calcClaudeCost(model: string, inputTokens: number, outputTokens: number): number {
  const m = Object.keys(CLAUDE_PRICING).find(k => model.includes(k)) ?? "claude-sonnet-4-6";
  const p = CLAUDE_PRICING[m];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export function calcGeminiCost(model: string, inputTokens: number, outputTokens: number): number {
  const m = Object.keys(GEMINI_PRICING).find(k => model.includes(k)) ?? "gemini-2.5-flash";
  const p = GEMINI_PRICING[m];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ElevenLabs aprox: $0.30 por 1.000 caracteres (Creator tier)
export function calcElevenLabsCost(chars: number): number {
  return (chars / 1000) * 0.30;
}
