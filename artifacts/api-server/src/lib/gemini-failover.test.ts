import { beforeEach, describe, expect, it, vi } from "vitest";

// Cada cliente GoogleGenAI responde según su clave: "proxy" = Replit AI Integrations, "direct" = GEMINI_API_KEY.
const behaviour: Record<string, () => Promise<unknown>> = {};
const calls: string[] = [];
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    key: string;
    constructor(opts: { apiKey: string }) { this.key = opts.apiKey; }
    models = {
      generateContent: async (req: { model: string }) => {
        calls.push(`${this.key}:${req.model}`);
        return behaviour[this.key]();
      },
      generateContentStream: async () => {
        calls.push(`${this.key}:stream`);
        const r = (await behaviour[this.key]()) as { text: string };
        return (async function* () { yield { text: r.text }; })();
      },
    };
  },
}));
vi.mock("@workspace/db", () => ({ db: {}, platformSettingsTable: {} }));
vi.mock("./ai-budget.js", () => ({ assertAiBudget: async () => {} }));
vi.mock("./ai-models.js", () => ({ pickModelSync: () => "gemini-2.5-flash", pickModel: async () => "gemini-2.5-flash" }));
vi.mock("./api-usage.js", () => ({ recordApiUsage: async () => {}, calcGeminiCost: () => 0 }));
const claudeCalls: string[] = [];
vi.mock("./claude.js", () => ({ askClaudeWithBrain: async () => { claudeCalls.push("claude"); return "respuesta de Claude"; } }));

const ok = (text: string) => async () => ({ text, candidates: [{}], usageMetadata: {} });
const fail = (msg: string) => async () => { throw new Error(msg); };

beforeEach(async () => {
  vi.resetModules();
  calls.length = 0; claudeCalls.length = 0;
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "proxy";
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = "https://replit.example/gemini";
  process.env.GEMINI_API_KEY = "direct";
  delete process.env.AI_PREFER_REPLIT;
});

const chat = async () => (await import("./gemini")).askGeminiChat([{ role: "user", content: "hola" }], "sys");

describe("Gemini: Replit AI Integrations primero", () => {
  it("usa Replit y no toca la clave directa", async () => {
    behaviour.proxy = ok("desde Replit"); behaviour.direct = ok("directa");
    expect(await chat()).toBe("desde Replit");
    expect(calls).toEqual(["proxy:gemini-2.5-flash"]);
  });

  it("si Replit falla (503) pasa a la clave directa", async () => {
    behaviour.proxy = fail("503 UNAVAILABLE"); behaviour.direct = ok("directa");
    expect(await chat()).toBe("directa");
    expect(calls).toEqual(["proxy:gemini-2.5-flash", "direct:gemini-2.5-flash"]);
  });

  it("solo usa Claude si fallan las dos vías", async () => {
    behaviour.proxy = fail("429 RESOURCE_EXHAUSTED"); behaviour.direct = fail("403 PERMISSION_DENIED");
    expect(await chat()).toBe("respuesta de Claude");
    expect(claudeCalls).toEqual(["claude"]);
  });

  it("un error de la petición (400) no cambia de vía ni gasta Claude", async () => {
    behaviour.proxy = fail("400 INVALID_ARGUMENT"); behaviour.direct = ok("directa");
    await expect(chat()).rejects.toThrow(/400/);
    expect(calls).toHaveLength(1);
    expect(claudeCalls).toHaveLength(0);
  });

  it("AI_PREFER_REPLIT=0 vuelve a la clave directa primero", async () => {
    process.env.AI_PREFER_REPLIT = "0";
    behaviour.proxy = ok("desde Replit"); behaviour.direct = ok("directa");
    expect(await chat()).toBe("directa");
  });

  it("sin clave directa funciona solo con Replit", async () => {
    delete process.env.GEMINI_API_KEY;
    behaviour.proxy = ok("desde Replit");
    expect(await chat()).toBe("desde Replit");
  });

  it("stream: con búsqueda usa la clave directa (el grounding va por ahí); sin búsqueda, Replit", async () => {
    behaviour.proxy = ok("replit"); behaviour.direct = ok("directa");
    const { askGeminiStream } = await import("./gemini");
    const read = async (useSearch: boolean) => {
      let t = "";
      for await (const c of askGeminiStream([{ role: "user", content: "hola" }], "sys", { useSearch })) if (c.text) t += c.text;
      return t;
    };
    expect(await read(false)).toBe("replit");
    expect(await read(true)).toBe("directa");
  });

  it("stream: si Replit falla antes de escribir nada, sigue por la clave directa", async () => {
    behaviour.proxy = fail("502 Bad Gateway"); behaviour.direct = ok("directa");
    const { askGeminiStream } = await import("./gemini");
    let t = "";
    for await (const c of askGeminiStream([{ role: "user", content: "hola" }], "sys")) if (c.text) t += c.text;
    expect(t).toBe("directa");
  });
});
