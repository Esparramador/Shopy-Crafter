import { describe, expect, it, vi } from "vitest";

vi.mock("./ai-budget.js", () => ({ assertAiBudget: vi.fn(async () => {}) }));
vi.mock("./visme-effects.js", () => ({}));

const { streamHtml, stripFences, normalizeModel } = await import("./web-designer");

describe("web designer", () => {
  it("sin key del proveedor lanza error en vez de devolver una página de relleno", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const gen = streamHtml("landing de café", "", "gpt-4.1", []);
    await expect(gen.next()).rejects.toThrow(/OPENAI_API_KEY/);
    if (saved) process.env.OPENAI_API_KEY = saved;
  });

  it("limpia vallas de código y texto previo al doctype", () => {
    expect(stripFences("Aquí tienes:\n```html\n<!DOCTYPE html><html></html>\n```")).toBe("<!DOCTYPE html><html></html>");
    expect(stripFences("<!doctype html><html></html>")).toBe("<!doctype html><html></html>");
  });

  it("resuelve modelos al proveedor correcto", () => {
    expect(normalizeModel("gemini-2.5-pro")).toEqual({ provider: "gemini", apiModel: "gemini-2.5-pro" });
    expect(normalizeModel("claude-opus-4-5").provider).toBe("claude");
    expect(normalizeModel("gpt-4.1-mini").apiModel).toBe("gpt-4.1-mini");
  });
});
