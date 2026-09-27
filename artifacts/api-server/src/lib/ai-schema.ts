/**
 * Piezas de esquema zod para respuestas de IA con búsqueda web (Gemini), donde
 * el formato llega "casi bien": números como "12,50 €", listas con algún
 * elemento mal formado, campos opcionales ausentes.
 *
 * La idea es aceptar lo aprovechable y descartar lo que no lo es, sin inventar
 * nada: un número ilegible se descarta (no se pone 0), un elemento de lista
 * inválido se omite (no se rellena).
 */
import { z } from "zod";
import { parseAiJson, type AiJsonSchema } from "./ai-json.js";
import { logger } from "./logger.js";

/**
 * "12,50 €" → 12.5; "1.234,56" → 1234.56; 7 → 7. Solo si la cadena contiene UNA
 * cifra: "5-10", "4.5/5" o "XX.XX" dan NaN (ambiguo o vacío, no se adivina).
 */
export function toLooseNumber(v: unknown): unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return v;
  const tokens = v.match(/\d[\d.,]*/g);
  if (!tokens || tokens.length !== 1) return Number.NaN;
  const negative = /-\s*$/.test(v.slice(0, v.indexOf(tokens[0])));
  let s = tokens[0].replace(/[.,]$/, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Coma decimal (formato español): los puntos son de miles.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return negative ? -n : n;
}

export const looseNumber = z.preprocess(toLooseNumber, z.number().finite());

/** Número opcional: si falta o es ilegible queda `undefined` (nunca 0 inventado). */
export const optionalLooseNumber = z.preprocess(
  v => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = toLooseNumber(v);
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  },
  z.number().finite().optional(),
);

/** Texto aunque venga como número ("50" o 50). */
export const looseString = z.union([z.string(), z.number()]).transform(String);

/** Lista que conserva solo los elementos válidos; si no es un array, lista vacía. */
export function lenientArray<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    v => (Array.isArray(v) ? v : []),
    z.array(z.unknown()).transform(arr =>
      arr.flatMap(x => {
        const r = item.safeParse(x);
        return r.success ? [r.data as z.output<T>] : [];
      }),
    ),
  );
}

/**
 * Parsea el texto de una búsqueda con IA contra un esquema. Sin reintento (la
 * búsqueda es cara y el llamador tiene su propio respaldo): devuelve `null` y lo
 * deja en el registro en vez de tragarse el fallo en silencio.
 */
export function parseResearchJson<T>(text: string, schema: AiJsonSchema<T>, label: string): T | null {
  if (!text.trim()) return null;
  const r = parseAiJson<T>(text, { schema, expect: "object" });
  if (r.ok) return r.data;
  logger.warn({ label, code: r.code, reason: r.message, chars: text.length }, "[ai-schema] respuesta de investigación inutilizable");
  return null;
}
