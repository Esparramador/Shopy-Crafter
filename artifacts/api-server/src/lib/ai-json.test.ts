import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  AiJsonError,
  AiTruncatedError,
  claudeMessagesJson,
  extractJson,
  generateAiJson,
  generateCompleteText,
  parseAiJson,
  stripCodeFences,
  type AiJsonCaller,
  type ClaudeMessagesClient,
  type AiRawResponse,
} from "./ai-json";

// Cliente de IA simulado: devuelve las respuestas en orden y registra las peticiones.
function fakeCaller(responses: AiRawResponse[]) {
  const calls: Array<{ prompt: string; maxTokens: number; attempt: number }> = [];
  const call: AiJsonCaller = async (req) => {
    calls.push(req);
    const next = responses.shift();
    if (!next) throw new Error("fakeCaller: no quedan respuestas");
    return next;
  };
  return { call, calls };
}

const sectionSchema = z.object({
  status: z.enum(["ok", "sin_datos"]),
  paragraphs: z.array(z.string()).min(1),
});

describe("extractJson", () => {
  it("extrae el objeto con texto alrededor (incluidas llaves en la prosa)", () => {
    const text = 'Claro, aquí tienes el análisis de {tu tienda}:\n{"a": 1, "b": {"c": [1, 2]}}\nEspero que te sirva. {fin}';
    expect(extractJson(text, "object")).toEqual({ ok: true, value: { a: 1, b: { c: [1, 2] } } });
  });

  it("no se traga el texto entre dos objetos como hacía la regex codiciosa", () => {
    const text = 'Resultado: {"ok": true} y otro ejemplo {"ok": false}';
    expect(extractJson(text, "object")).toEqual({ ok: true, value: { ok: true } });
  });

  it("usa el bloque ```json aunque haya otro JSON de ejemplo antes", () => {
    const text = 'Formato esperado: {"x": "..."}\n\n```json\n{"x": "real", "n": 3}\n```';
    // El primer bloque cercado manda sobre lo que haya fuera.
    expect(extractJson(text, "object")).toEqual({ ok: true, value: { x: "real", n: 3 } });
  });

  it("respeta llaves, corchetes y comillas escapadas dentro de cadenas", () => {
    const html = '<p class=\\"x\\">Usa {llaves} y [corchetes] y \\\\ barras</p>';
    const text = `{"executiveSummary": "${html}", "list": ["}", "]"]}`;
    const r = extractJson(text, "object");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.value as any).executiveSummary).toBe('<p class="x">Usa {llaves} y [corchetes] y \\ barras</p>');
      expect((r.value as any).list).toEqual(["}", "]"]);
    }
  });

  it("acepta saltos de línea literales dentro de cadenas (HTML multilínea)", () => {
    const text = '{"html": "<p>uno</p>\n<p>dos</p>",}';
    expect(extractJson(text, "object")).toEqual({ ok: true, value: { html: "<p>uno</p>\n<p>dos</p>" } });
  });

  it("detecta JSON truncado y NO devuelve un sub-objeto ni lo cierra a mano", () => {
    const text = '```json\n{"sections": {"a": {"status": "ok"}, "b": "texto que se cor';
    const r = extractJson(text, "object");
    expect(r).toMatchObject({ ok: false, code: "truncated" });
  });

  it("extrae un array raíz", () => {
    const text = 'Lista:\n[{"id": 1}, {"id": 2}]\nFin.';
    expect(extractJson(text, "array")).toEqual({ ok: true, value: [{ id: 1 }, { id: 2 }] });
  });

  it("devuelve no_json cuando no hay nada parecido a JSON", () => {
    expect(extractJson("Lo siento, no puedo ayudarte con eso.", "object")).toMatchObject({ ok: false, code: "no_json" });
  });

  it("devuelve invalid_json si el candidato balanceado no es JSON", () => {
    expect(extractJson('{"a": 1, "b": nope}', "object")).toMatchObject({ ok: false, code: "invalid_json" });
  });
});

describe("parseAiJson", () => {
  it("marca truncated si el modelo paró por max_tokens aunque el texto parezca completo", () => {
    expect(parseAiJson('{"a": 1}', { truncated: true })).toMatchObject({ ok: false, code: "truncated" });
  });

  it("valida con zod y lista los problemas", () => {
    const r = parseAiJson('{"status": "quizás", "paragraphs": []}', { schema: sectionSchema, expect: "object" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("schema");
      expect(r.issues?.some(i => i.startsWith("status"))).toBe(true);
      expect(r.issues?.some(i => i.startsWith("paragraphs"))).toBe(true);
    }
  });
});

describe("generateAiJson", () => {
  it("devuelve el dato a la primera sin reintentar", async () => {
    const { call, calls } = fakeCaller([{ text: '{"status": "ok", "paragraphs": ["Hola"]}', truncated: false }]);
    const data = await generateAiJson({ call, prompt: "P", maxTokens: 1000, schema: sectionSchema, expect: "object", label: "t" });
    expect(data).toEqual({ status: "ok", paragraphs: ["Hola"] });
    expect(calls).toHaveLength(1);
  });

  it("si se trunca, reintenta UNA vez con más presupuesto y aviso de concisión", async () => {
    const { call, calls } = fakeCaller([
      { text: '{"status": "ok", "paragraphs": ["muy lar', truncated: true },
      { text: '{"status": "ok", "paragraphs": ["corto"]}', truncated: false },
    ]);
    const data = await generateAiJson({ call, prompt: "P", maxTokens: 1000, schema: sectionSchema, expect: "object", label: "t" });
    expect(data.paragraphs).toEqual(["corto"]);
    expect(calls).toHaveLength(2);
    expect(calls[1].maxTokens).toBe(2000);
    expect(calls[1].attempt).toBe(2);
    expect(calls[1].prompt).toContain("se cortó por longitud");
  });

  it("si el JSON es inválido, el reintento pide repararlo e incluye la respuesta anterior", async () => {
    const { call, calls } = fakeCaller([
      { text: '{"status": "ok", "paragraphs": "no es array"}', truncated: false },
      { text: '```json\n{"status": "sin_datos", "paragraphs": ["Faltan datos de ventas"]}\n```', truncated: false },
    ]);
    const data = await generateAiJson({ call, prompt: "P", maxTokens: 1000, schema: sectionSchema, expect: "object", label: "t" });
    expect(data.status).toBe("sin_datos");
    expect(calls[1].maxTokens).toBe(1000);
    expect(calls[1].prompt).toContain("no es array");
    expect(calls[1].prompt).toContain("paragraphs");
  });

  it("lanza AiTruncatedError si se trunca también en el reintento", async () => {
    const { call } = fakeCaller([
      { text: '{"a": "x', truncated: true },
      { text: '{"a": "y', truncated: true },
    ]);
    await expect(generateAiJson({ call, prompt: "P", maxTokens: 1000, label: "t" })).rejects.toBeInstanceOf(AiTruncatedError);
  });

  it("lanza AiJsonError tipado (nunca texto crudo) si el reintento tampoco cumple", async () => {
    const { call } = fakeCaller([
      { text: "No tengo datos suficientes.", truncated: false },
      { text: "Sigo sin datos.", truncated: false },
    ]);
    const err = await generateAiJson({ call, prompt: "P", maxTokens: 1000, schema: sectionSchema, expect: "object", label: "informe" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiJsonError);
    expect((err as AiJsonError).code).toBe("no_json");
    expect((err as AiJsonError).details.attempts).toBe(2);
    expect((err as AiJsonError).message).toContain("informe");
  });

  it("propaga los errores del cliente (red, 529…) sin disfrazarlos", async () => {
    const call: AiJsonCaller = async () => { throw new Error("529 overloaded"); };
    await expect(generateAiJson({ call, prompt: "P", maxTokens: 1000, label: "t" })).rejects.toThrow("529 overloaded");
  });
});

describe("generateCompleteText", () => {
  it("pide continuación sin prefill y concatena", async () => {
    const seen: Array<Array<{ role: string; content: string }>> = [];
    const replies: AiRawResponse[] = [
      { text: "<h2>Informe</h2><p>Primera parte", truncated: true },
      { text: " y segunda parte.</p>", truncated: false },
    ];
    const html = await generateCompleteText({
      label: "t",
      prompt: "Genera el informe",
      call: async (messages) => { seen.push(messages); return replies.shift()!; },
    });
    expect(html).toBe("<h2>Informe</h2><p>Primera parte y segunda parte.</p>");
    expect(seen[1].map(m => m.role)).toEqual(["user", "assistant", "user"]);
    expect(seen[1][seen[1].length - 1].role).toBe("user");
  });

  it("lanza AiTruncatedError si sigue cortado tras las continuaciones", async () => {
    await expect(generateCompleteText({
      label: "t",
      prompt: "P",
      maxContinuations: 1,
      call: async () => ({ text: "trozo", truncated: true }),
    })).rejects.toBeInstanceOf(AiTruncatedError);
  });
});

describe("stripCodeFences", () => {
  it("quita el envoltorio ```html", () => {
    expect(stripCodeFences("```html\n<h2>Hola</h2>\n```")).toBe("<h2>Hola</h2>");
    expect(stripCodeFences("<h2>Sin fence</h2>")).toBe("<h2>Sin fence</h2>");
  });
});

describe("claudeMessagesJson", () => {
  type Req = { max_tokens: number; messages: Array<{ content: unknown }> };
  const fakeClient = (responses: Array<{ text: string; stop_reason: string }>) => {
    const requests: Req[] = [];
    const client = {
      messages: {
        stream: (body: Req) => {
          requests.push(body);
          const r = responses.shift()!;
          return { finalMessage: async () => ({ content: [{ type: "text", text: r.text }], stop_reason: r.stop_reason }) };
        },
      },
    };
    return { client: client as unknown as ClaudeMessagesClient, requests };
  };

  it("si se corta por max_tokens reintenta con más presupuesto y valida", async () => {
    const { client, requests } = fakeClient([
      { text: '{"items": [1, 2', stop_reason: "max_tokens" },
      { text: '{"items": [1, 2, 3]}', stop_reason: "end_turn" },
    ]);
    const out = await claudeMessagesJson(client, {
      model: "m", system: "s", prompt: "p", label: "t", maxTokens: 1000,
      schema: z.object({ items: z.array(z.number()) }),
    });
    expect(out).toEqual({ items: [1, 2, 3] });
    expect(requests.map(r => r.max_tokens)).toEqual([1000, 2000]);
  });

  it("incluye las imágenes antes del texto", async () => {
    const { client, requests } = fakeClient([{ text: '{"ok": true}', stop_reason: "end_turn" }]);
    const image = { type: "image" as const, source: { type: "url" as const, url: "https://x/y.png" } };
    await claudeMessagesJson(client, { model: "m", system: "s", prompt: "p", label: "t", maxTokens: 100, images: [image] });
    expect(requests[0].messages[0].content).toEqual([image, { type: "text", text: "p" }]);
  });

  it("tras dos respuestas inválidas lanza AiJsonError", async () => {
    const { client } = fakeClient([
      { text: "no hay json", stop_reason: "end_turn" },
      { text: "tampoco", stop_reason: "end_turn" },
    ]);
    await expect(claudeMessagesJson(client, { model: "m", system: "s", prompt: "p", label: "t", maxTokens: 100 }))
      .rejects.toBeInstanceOf(AiJsonError);
  });
});
