import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";

// Motor mockeado: ningún test llama a APIs de pago. Los catálogos de skills SÍ
// son los reales (se leen de disco), igual que en producción.
const askClaudeDetailed = vi.fn();
const askClaudeJson = vi.fn();
const askClaudeWithVision = vi.fn();
const askGeminiWithSearch = vi.fn();
const geminiAvailable = vi.fn(() => false);
const safeFetch = vi.fn();
const saveToVault = vi.fn(async () => 77);

vi.mock("../lib/claude.js", () => ({ askClaudeDetailed, askClaudeJson, askClaudeWithVision }));
vi.mock("../lib/gemini.js", () => ({ askGeminiWithSearch, isGeminiAvailable: () => geminiAvailable() }));
vi.mock("../lib/web-scraper.js", () => ({ safeFetch }));
vi.mock("../lib/vault.js", () => ({ saveToVault }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const claudeOk = (text: string) => ({ text, stopReason: "end_turn", truncated: false, usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.01, model: "claude-test" } });

let server: Server;
let base: string;

beforeAll(async () => {
  const { default: skillsRouter } = await import("./web-lab-skills");
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", skillsRouter);
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => { server.close(); });

beforeEach(() => {
  vi.clearAllMocks();
  geminiAvailable.mockReturnValue(false);
  process.env.ANTHROPIC_API_KEY = "test-key";
});

const post = (body: unknown) => fetch(`${base}/web-lab/skills/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("catálogo de skills del Web Lab", () => {
  it("lista las skills reales de disco con motivo en cada no ejecutable", async () => {
    const r = await fetch(`${base}/web-lab/skills`);
    expect(r.status).toBe(200);
    const j = await r.json() as { total: number; executable: number; skills: Array<{ id: string; executable: boolean; reason?: string; inputs: unknown[] }> };
    expect(j.total).toBeGreaterThan(850); // 82 de agencia + 817 de ciberseguridad
    expect(j.executable).toBeGreaterThan(600);
    for (const s of j.skills) {
      if (!s.executable) expect(s.reason, s.id).toBeTruthy();
      expect(s.inputs.length, s.id).toBeGreaterThan(0);
    }
    const byId = new Map(j.skills.map(s => [s.id, s]));
    expect(byId.get("agency:copywriting")?.executable).toBe(true);
    expect(byId.get("agency:docx")?.executable).toBe(true);
    expect(byId.get("agency:video-editing")?.executable).toBe(false);
    expect(byId.get("agency:video-editing")?.reason).toMatch(/FFmpeg/);
    expect(byId.get("cybersec:performing-security-headers-audit")?.executable).toBe(true);
    expect(byId.get("cybersec:abusing-dpapi-for-credential-access")?.executable).toBe(false);
  });

  it("sin clave de Anthropic nada que dependa de Claude se marca ejecutable", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    const j = await (await fetch(`${base}/web-lab/skills`)).json() as { executable: number; skills: Array<{ id: string; reason?: string }> };
    expect(j.executable).toBe(0);
    expect(j.skills.find(s => s.id === "agency:copywriting")?.reason).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("el detalle devuelve el SKILL.md real", async () => {
    const r = await fetch(`${base}/web-lab/skills/${encodeURIComponent("cybersec:performing-security-headers-audit")}`);
    const j = await r.json() as { skillMd: string };
    expect(j.skillMd).toMatch(/Security Headers Audit/);
  });
});

describe("POST /web-lab/skills/run", () => {
  it("ejecuta una skill de ciberseguridad sobre una URL leída en pasivo", async () => {
    safeFetch.mockResolvedValue(new Response("<html><head><title>Hola</title></head><body>ok</body></html>", {
      status: 200, headers: { "content-type": "text/html", server: "nginx", "x-powered-by": "PHP/7.4" },
    }));
    askClaudeDetailed.mockResolvedValue(claudeOk("## Informe\n- Falta HSTS"));
    const r = await post({ id: "cybersec:performing-security-headers-audit", inputs: { url: "ejemplo.com" } });
    expect(r.status).toBe(200);
    const j = await r.json() as { output: { kind: string; text: string }; fetched: { url: string; status: number }; engine: { model: string } };
    expect(j.output).toEqual({ kind: "markdown", text: "## Informe\n- Falta HSTS" });
    expect(j.fetched).toMatchObject({ url: "https://ejemplo.com", status: 200 });
    expect(j.engine.model).toBe("claude-test");
    const [, messages, system] = askClaudeDetailed.mock.calls[0];
    expect(system).toMatch(/Performing Security Headers Audit/); // el SKILL.md real va al motor
    expect(system).toMatch(/DEFENSIVO/);
    expect(messages[0].content).toMatch(/x-powered-by: PHP\/7\.4/);
  });

  it("una skill de documento produce un .docx real", async () => {
    askClaudeJson.mockResolvedValue({ title: "Factura 001", sections: [{ heading: "Conceptos", table: { headers: ["Concepto", "Importe"], rows: [["Web", "900 €"]] } }] });
    const r = await post({ id: "agency:invoice-generator", inputs: { text: "Factura de una web por 900 €", format: "docx" }, projectId: 5 });
    expect(r.status).toBe(200);
    const j = await r.json() as { output: { kind: string; file: { name: string; base64: string; vaultId: number } } };
    expect(j.output.kind).toBe("document");
    expect(j.output.file.name).toBe("Factura 001.docx");
    expect(Buffer.from(j.output.file.base64, "base64").subarray(0, 2).toString()).toBe("PK"); // zip OOXML
    expect(j.output.file.vaultId).toBe(77);
    expect(saveToVault).toHaveBeenCalledWith(expect.objectContaining({ projectId: 5, fileType: "agent_skill_docx" }));
  });

  it("una skill visual devuelve la página HTML", async () => {
    askClaudeDetailed.mockResolvedValue(claudeOk("```html\n<!DOCTYPE html><html><body>Infografía</body></html>\n```\nDecisión: paleta cálida."));
    const r = await post({ id: "agency:infographic-builder", inputs: { text: "Infografía de 3 pasos" } });
    const j = await r.json() as { output: { kind: string; html: string; text: string } };
    expect(j.output.kind).toBe("html");
    expect(j.output.html).toBe("<!DOCTYPE html><html><body>Infografía</body></html>");
    expect(j.output.text).toMatch(/paleta cálida/);
  });

  it("investigación: usa Gemini con búsqueda si está, y Claude con aviso si no", async () => {
    geminiAvailable.mockReturnValue(true);
    askGeminiWithSearch.mockResolvedValue({ text: "Competidores: A, B", sources: ["https://a.com"], queries: [], usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, model: "gemini-test" } });
    let j = await (await post({ id: "agency:competitive-analysis", inputs: { text: "Panaderías en Valencia" } })).json() as { engine: { provider: string; fallbackNote?: string }; sources: string[] };
    expect(j.engine.provider).toBe("gemini");
    expect(j.sources).toEqual(["https://a.com"]);

    geminiAvailable.mockReturnValue(false);
    askClaudeDetailed.mockResolvedValue(claudeOk("Análisis"));
    j = await (await post({ id: "agency:competitive-analysis", inputs: { text: "Panaderías en Valencia" } })).json() as typeof j;
    expect(j.engine.provider).toBe("claude");
    expect(j.engine.fallbackNote).toMatch(/Sin búsqueda web/);
  });

  it("errores legibles: no ejecutable, inexistente, sin datos, URL caída y clave mala", async () => {
    let r = await post({ id: "agency:video-editing", inputs: { text: "corta" } });
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toMatch(/FFmpeg/);

    r = await post({ id: "agency:no-existe", inputs: { text: "x" } });
    expect(r.status).toBe(404);

    r = await post({ id: "agency:copywriting", inputs: {} });
    expect(r.status).toBe(400);

    safeFetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND nada.invalid"));
    r = await post({ id: "agency:seo-audit", inputs: { url: "nada.invalid" } });
    expect(r.status).toBe(422);
    expect((await r.json() as { error: string }).error).toMatch(/No se pudo leer https:\/\/nada\.invalid/);

    askClaudeDetailed.mockRejectedValue(Object.assign(new Error("invalid x-api-key"), { status: 401 }));
    r = await post({ id: "agency:copywriting", inputs: { text: "Titular para una panadería" } });
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ code: "AI_AUTH" });
    expect(askClaudeDetailed).toHaveBeenCalledTimes(1);
  });
});
