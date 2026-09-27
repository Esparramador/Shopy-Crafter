/**
 * Respuestas JSON (y HTML largo) de la IA sin sorpresas.
 *
 * Sustituye al patrón `text.match(/\{[\s\S]*\}/)` + `JSON.parse` + "si falla, mete
 * el texto crudo en un campo", que es lo que hacía salir los informes con el JSON
 * roto dentro del "Resumen ejecutivo". Reglas:
 *   - Extracción: bloque ```json, o el primer objeto/array balanceado respetando
 *     cadenas y escapes (no la regex codiciosa, que se traga el texto de alrededor).
 *   - Nunca se "cierra" a mano un JSON truncado: un informe a medias no es un informe.
 *   - Si falla (truncado, sin JSON, JSON inválido o no cumple el esquema): UN
 *     reintento — con más presupuesto si se cortó, o pidiendo reparar si no — y si
 *     vuelve a fallar, error tipado (AiTruncatedError / AiJsonError).
 *
 * La parte pura (extractJson, parseAiJson, generateAiJson, generateCompleteText)
 * recibe el cliente de IA inyectado, así se testea sin llamar a Anthropic.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { AiJsonError, AiTruncatedError, type AiJsonErrorCode } from "./ai-errors.js";
import { logger } from "./logger.js";

export { AiJsonError, AiTruncatedError } from "./ai-errors.js";

/** Lo mínimo que necesitamos de la respuesta del modelo. */
export interface AiRawResponse {
  text: string;
  /** stop_reason === "max_tokens" (o equivalente del proveedor). */
  truncated: boolean;
}

export type AiJsonCaller = (req: { prompt: string; maxTokens: number; attempt: 1 | 2 }) => Promise<AiRawResponse>;
export type AiTextCaller = (messages: Array<{ role: "user" | "assistant"; content: string }>) => Promise<AiRawResponse>;

/** Compatible con los esquemas de zod (`schema.safeParse`). */
export interface AiJsonSchema<T> {
  safeParse(data: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> } };
}

export type JsonRoot = "object" | "array";

// ─── Extracción ──────────────────────────────────────────────────────────────

type ScanResult = { end: number } | { reason: "unterminated" | "mismatch" };

/** Busca el cierre del valor que empieza en `start`, ignorando llaves dentro de cadenas. */
function scanBalanced(text: string, start: number): ScanResult {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      if (stack.pop() !== c) return { reason: "mismatch" };
      if (stack.length === 0) return { end: i };
    }
  }
  return { reason: "unterminated" };
}

/**
 * Reparaciones seguras que NO inventan contenido: saltos de línea/tabuladores
 * literales dentro de cadenas (muy habitual con HTML) y comas finales.
 */
function sanitizeJsonText(s: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) { escape = false; out += c; continue; }
      if (c === "\\") { escape = true; out += c; continue; }
      if (c === '"') { inString = false; out += c; continue; }
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      if (c < " ") { out += " "; continue; }
      out += c;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === "}" || s[j] === "]") continue;
    }
    out += c;
  }
  return out;
}

function tryParse(candidate: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (firstErr) {
    try {
      return { ok: true, value: JSON.parse(sanitizeJsonText(candidate)) };
    } catch {
      return { ok: false, error: firstErr instanceof Error ? firstErr.message : String(firstErr) };
    }
  }
}

/** ¿Lo que sigue a la llave/corchete parece JSON y no prosa tipo "{nombre}"? */
function looksLikeJsonStart(text: string, start: number): boolean {
  let j = start + 1;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (j >= text.length) return true;
  const next = text[j];
  if (text[start] === "{") return next === '"' || next === "}";
  return /["{[\]\-0-9tfn]/.test(next);
}

function matchesRoot(value: unknown, expect?: JsonRoot): boolean {
  if (expect === "array") return Array.isArray(value);
  if (expect === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === "object" && value !== null;
}

export type JsonExtraction =
  | { ok: true; value: unknown }
  | { ok: false; code: "no_json" | "truncated" | "invalid_json"; message: string };

function extractFromRegion(region: string, expect?: JsonRoot): JsonExtraction {
  let invalid: string | null = null;
  let tried = 0;
  for (let i = 0; i < region.length && tried < 200; i++) {
    const c = region[i];
    if (c !== "{" && c !== "[") continue;
    if (expect === "object" && c !== "{") continue;
    if (expect === "array" && c !== "[") continue;
    if (!looksLikeJsonStart(region, i)) continue;
    tried++;
    const scan = scanBalanced(region, i);
    if ("reason" in scan) {
      // Un valor JSON que empieza y nunca se cierra = respuesta cortada. No seguimos
      // buscando dentro: devolveríamos un sub-objeto como si fuera la respuesta entera.
      if (scan.reason === "unterminated") {
        return { ok: false, code: "truncated", message: "El JSON empieza pero no se cierra (respuesta cortada)" };
      }
      continue;
    }
    const parsed = tryParse(region.slice(i, scan.end + 1));
    if (parsed.ok && matchesRoot(parsed.value, expect)) return { ok: true, value: parsed.value };
    if (!parsed.ok) {
      invalid ??= parsed.error;
      // El candidato balanceado no es JSON: saltamos por encima para no devolver un hijo suyo.
      i = scan.end;
    }
  }
  if (invalid) return { ok: false, code: "invalid_json", message: `JSON inválido: ${invalid}` };
  return { ok: false, code: "no_json", message: "La respuesta no contiene ningún JSON" };
}

/**
 * Extrae el primer valor JSON de una respuesta de IA: primero dentro de bloques
 * ```json … ```, después en el texto completo. `expect` fija la raíz esperada.
 */
export function extractJson(text: string, expect?: JsonRoot): JsonExtraction {
  const fenceRe = /```(?:json|JSON)?[ \t]*\r?\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const inner = extractFromRegion(m[1], expect);
    if (inner.ok) return inner;
  }
  const openFence = text.match(/```(?:json|JSON)?[ \t]*\r?\n([\s\S]*)$/);
  if (openFence && !openFence[1].includes("```")) {
    const inner = extractFromRegion(openFence[1], expect);
    if (inner.ok || inner.code === "truncated") return inner;
  }
  return extractFromRegion(text, expect);
}

// ─── Parseo + validación ─────────────────────────────────────────────────────

export type AiJsonParse<T> =
  | { ok: true; data: T }
  | { ok: false; code: AiJsonErrorCode; message: string; issues?: string[] };

function formatIssues(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): string[] {
  return issues.slice(0, 12).map(i => `${i.path.map(String).join(".") || "(raíz)"}: ${i.message}`);
}

/** Parseo puro de una respuesta ya recibida. Si el modelo se cortó, es "truncated" siempre. */
export function parseAiJson<T = unknown>(
  text: string,
  opts: { truncated?: boolean; schema?: AiJsonSchema<T>; expect?: JsonRoot } = {},
): AiJsonParse<T> {
  if (opts.truncated) {
    return { ok: false, code: "truncated", message: "La respuesta se cortó por max_tokens" };
  }
  const extracted = extractJson(text, opts.expect);
  if (!extracted.ok) return { ok: false, code: extracted.code, message: extracted.message };
  if (!opts.schema) return { ok: true, data: extracted.value as T };
  const checked = opts.schema.safeParse(extracted.value);
  if (checked.success) return { ok: true, data: checked.data };
  const issues = formatIssues(checked.error.issues);
  return { ok: false, code: "schema", message: `El JSON no cumple el esquema: ${issues.join("; ")}`, issues };
}

// ─── Generación con un reintento ─────────────────────────────────────────────

const MAX_RETRY_TOKENS = 64000;
const REPAIR_ECHO_LIMIT = 12000;

function buildRetryPrompt(prompt: string, failure: Exclude<AiJsonParse<unknown>, { ok: true }>, previous: string): string {
  if (failure.code === "truncated") {
    return `${prompt}

IMPORTANTE: tu respuesta anterior se cortó por longitud y no se pudo usar. Vuelve a generarla COMPLETA desde el principio, más concisa (frases más cortas, sin relleno), y asegúrate de cerrar el JSON. Responde SOLO con el JSON.`;
  }
  const echo = previous.length <= REPAIR_ECHO_LIMIT
    ? `\n\nTu respuesta anterior fue:\n<<<\n${previous}\n>>>`
    : "";
  return `${prompt}

IMPORTANTE: tu respuesta anterior no se pudo usar (${failure.message}).${echo}

Devuelve SOLO el JSON corregido y completo, con exactamente la estructura pedida, sin texto antes ni después.`;
}

export interface GenerateAiJsonOptions<T> {
  call: AiJsonCaller;
  prompt: string;
  maxTokens: number;
  /** Presupuesto del reintento si el primer intento se cortó (por defecto el doble). */
  retryMaxTokens?: number;
  schema?: AiJsonSchema<T>;
  expect?: JsonRoot;
  /** Para logs y errores (p. ej. "exports/generate-ai-report:bloque-1"). */
  label: string;
}

export async function generateAiJson<T = unknown>(opts: GenerateAiJsonOptions<T>): Promise<T> {
  const { call, prompt, maxTokens, schema, expect, label } = opts;

  const first = await call({ prompt, maxTokens, attempt: 1 });
  const r1 = parseAiJson<T>(first.text, { truncated: first.truncated, schema, expect });
  if (r1.ok) return r1.data;

  logger.warn({ label, code: r1.code, reason: r1.message, chars: first.text.length }, "[ai-json] respuesta inutilizable — reintentando una vez");

  const retryTokens = r1.code === "truncated"
    ? Math.min(opts.retryMaxTokens ?? maxTokens * 2, MAX_RETRY_TOKENS)
    : maxTokens;
  const second = await call({ prompt: buildRetryPrompt(prompt, r1, first.text), maxTokens: retryTokens, attempt: 2 });
  const r2 = parseAiJson<T>(second.text, { truncated: second.truncated, schema, expect });
  if (r2.ok) return r2.data;

  logger.error({ label, code: r2.code, reason: r2.message, chars: second.text.length }, "[ai-json] respuesta inutilizable tras el reintento");
  if (r2.code === "truncated") {
    throw new AiTruncatedError(`[${label}] La respuesta de la IA se cortó dos veces (max_tokens ${retryTokens})`, {
      label, maxTokens: retryTokens, partialChars: second.text.length,
    });
  }
  throw new AiJsonError(r2.code, `[${label}] ${r2.message}`, {
    label, attempts: 2, issues: r2.issues, snippet: second.text.slice(0, 300),
  });
}

// ─── Texto/HTML largo con continuación ───────────────────────────────────────

export const CONTINUE_INSTRUCTION = "Tu respuesta anterior se cortó por longitud. Continúa EXACTAMENTE desde el último carácter que escribiste, sin repetir nada, sin introducción ni comentarios, y termina el documento.";

/**
 * Genera texto libre (HTML de informes) y, si se corta por max_tokens, pide que
 * continúe (sin prefill de assistant: los modelos 4.6+ no lo admiten). Si tras
 * `maxContinuations` sigue cortado, lanza AiTruncatedError en vez de devolver medio informe.
 */
export async function generateCompleteText(opts: {
  call: AiTextCaller;
  prompt: string;
  label: string;
  maxContinuations?: number;
}): Promise<string> {
  const { call, prompt, label, maxContinuations = 2 } = opts;
  let res = await call([{ role: "user", content: prompt }]);
  let acc = res.text;
  let continuations = 0;
  while (res.truncated && continuations < maxContinuations) {
    continuations++;
    logger.warn({ label, continuations, chars: acc.length }, "[ai-text] respuesta cortada — pidiendo continuación");
    res = await call([
      { role: "user", content: prompt },
      { role: "assistant", content: acc.trimEnd() },
      { role: "user", content: CONTINUE_INSTRUCTION },
    ]);
    acc = joinContinuation(acc, res.text);
  }
  if (res.truncated) {
    throw new AiTruncatedError(`[${label}] La respuesta de la IA sigue cortada tras ${continuations} continuaciones`, {
      label, partialChars: acc.length,
    });
  }
  return acc;
}

/** Une la continuación quitando un posible bloque ``` que el modelo reabra. */
function joinContinuation(acc: string, next: string): string {
  const cleaned = next.replace(/^\s*```[a-zA-Z]*\s*\n/, "");
  return acc.trimEnd() + (/^\s/.test(cleaned) ? "" : "\n") + cleaned;
}

/** Quita el envoltorio ```html … ``` con el que a veces responde el modelo. */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*[ \t]*\r?\n/, "")
    .replace(/\r?\n?```\s*$/, "")
    .trim();
}

// ─── Atajos sobre Claude (ShopyBrain + ADN de marca) ─────────────────────────

export interface ClaudeJsonValidatedOptions<T> {
  schema?: AiJsonSchema<T>;
  expect?: JsonRoot;
  useCase?: import("./claude.js").BrainUseCase;
  niche?: string;
  maxTokens?: number;
  retryMaxTokens?: number;
  timeoutMs?: number;
  label: string;
}

/**
 * Como askClaudeJsonWithBrain pero sin reparaciones silenciosas: detecta el
 * truncado, valida con el esquema, reintenta una vez y si no, lanza error tipado.
 */
export async function askClaudeJsonValidated<T>(
  projectId: number,
  prompt: string,
  systemPrompt: string,
  opts: ClaudeJsonValidatedOptions<T>,
): Promise<T> {
  const { askClaudeWithBrainDetailed } = await import("./claude.js");
  return generateAiJson<T>({
    prompt,
    maxTokens: opts.maxTokens ?? 8000,
    retryMaxTokens: opts.retryMaxTokens,
    schema: opts.schema,
    expect: opts.expect ?? "object",
    label: opts.label,
    call: async ({ prompt: p, maxTokens }) => {
      const r = await askClaudeWithBrainDetailed(
        projectId, [{ role: "user", content: p }], systemPrompt,
        opts.useCase ?? "general", opts.niche, maxTokens, opts.timeoutMs,
      );
      return { text: r.text, truncated: r.truncated };
    },
  });
}

type ClaudeVisionImages = Parameters<typeof import("./claude.js").askClaudeWithVision>[2];

/**
 * Claude Vision (sin ShopyBrain) con JSON validado: si se corta por max_tokens
 * reintenta con más presupuesto; si no parsea o no cumple el esquema, reintenta
 * pidiendo repararlo; después, error tipado.
 */
export async function askClaudeVisionJsonValidated<T>(
  projectId: number,
  prompt: string,
  images: ClaudeVisionImages,
  systemPrompt: string,
  opts: { schema?: AiJsonSchema<T>; expect?: JsonRoot; maxTokens: number; timeoutMs?: number; label: string },
): Promise<T> {
  const { askClaudeWithVision } = await import("./claude.js");
  return generateAiJson<T>({
    prompt,
    maxTokens: opts.maxTokens,
    retryMaxTokens: Math.min(opts.maxTokens * 2, MAX_RETRY_TOKENS),
    schema: opts.schema,
    expect: opts.expect ?? "object",
    label: opts.label,
    call: async ({ prompt: p, maxTokens }) => {
      try {
        const text = await askClaudeWithVision(projectId, p, images, systemPrompt, maxTokens, opts.timeoutMs, { failOnTruncation: true });
        return { text, truncated: false };
      } catch (err) {
        if (err instanceof AiTruncatedError) return { text: "", truncated: true };
        throw err;
      }
    },
  });
}

/** HTML/texto largo con ShopyBrain; continúa si se corta y si no, AiTruncatedError. */
export async function askClaudeTextComplete(
  projectId: number,
  prompt: string,
  systemPrompt: string,
  opts: { useCase?: import("./claude.js").BrainUseCase; niche?: string; maxTokens: number; timeoutMs?: number; label: string; maxContinuations?: number },
): Promise<string> {
  const { askClaudeWithBrainDetailed } = await import("./claude.js");
  return generateCompleteText({
    prompt,
    label: opts.label,
    maxContinuations: opts.maxContinuations,
    call: async (messages) => {
      const r = await askClaudeWithBrainDetailed(
        projectId, messages, systemPrompt, opts.useCase ?? "general", opts.niche, opts.maxTokens, opts.timeoutMs,
      );
      return { text: r.text, truncated: r.truncated };
    },
  });
}

// ─── Llamadas directas al SDK de Anthropic ───────────────────────────────────

/** Lo mínimo del cliente de Anthropic que se usa (permite inyectar uno falso en tests). */
export type ClaudeMessagesClient = Pick<Anthropic, "messages">;

/**
 * Para el código que llama a `client.messages.stream` directamente (con su propio
 * modelo, imágenes o timeout) y necesita JSON: detecta el corte por max_tokens,
 * valida con el esquema, reintenta una vez y si no, error tipado.
 */
export async function claudeMessagesJson<T>(
  client: ClaudeMessagesClient,
  opts: {
    model: string;
    system: string;
    prompt: string;
    label: string;
    maxTokens: number;
    retryMaxTokens?: number;
    schema?: AiJsonSchema<T>;
    expect?: JsonRoot;
    images?: Anthropic.ImageBlockParam[];
    timeoutMs?: number;
  },
): Promise<T> {
  return generateAiJson<T>({
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
    retryMaxTokens: opts.retryMaxTokens ?? opts.maxTokens * 2,
    schema: opts.schema,
    expect: opts.expect ?? "object",
    label: opts.label,
    call: async ({ prompt, maxTokens }) => {
      const res = await client.messages.stream(
        {
          model: opts.model,
          max_tokens: maxTokens,
          system: opts.system,
          messages: [{
            role: "user",
            content: opts.images?.length ? [...opts.images, { type: "text", text: prompt }] : prompt,
          }],
        },
        opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : undefined,
      ).finalMessage();
      const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
      return { text, truncated: res.stop_reason === "max_tokens" };
    },
  });
}
