import { describe, it, expect, vi } from "vitest";
import { activeChatModel, copyText } from "./active-model";

const picks = { claudeModel: "claude-sonnet-4-6", gptModel: "gpt-4.1-mini", nvidiaModel: "meta/llama-3.3-70b-instruct" };
const matrix = { gemini: { fast: { current: "gemini-3.5-flash" } }, xai: { genius: { current: "grok-4.3" } } };

describe("activeChatModel", () => {
  it("usa el modelo elegido en el chat para Claude, GPT y NVIDIA", () => {
    expect(activeChatModel("claude", picks, null).id).toBe("claude-sonnet-4-6");
    expect(activeChatModel("gpt", picks, null).id).toBe("gpt-4.1-mini");
    expect(activeChatModel("nvidia", picks, null).id).toBe("meta/llama-3.3-70b-instruct");
  });

  it("lee Gemini (tier fast) y Grok (tier genius) del backend", () => {
    expect(activeChatModel("gemini", picks, matrix).id).toBe("gemini-3.5-flash");
    expect(activeChatModel("grok", picks, matrix).id).toBe("grok-4.3");
  });

  it("no inventa un ID mientras no llega la configuración", () => {
    expect(activeChatModel("gemini", picks, null)).toEqual({ id: null, label: "Gemini (leyendo modelo…)" });
    expect(activeChatModel("auto", picks, matrix).id).toBeNull();
    expect(activeChatModel("brain_only", picks, matrix).id).toBeNull();
  });
});

describe("copyText", () => {
  it("escribe en el portapapeles", async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyText("gemini-3.5-flash", { clipboard: { writeText } } as unknown as Navigator)).toBe(true);
    expect(writeText).toHaveBeenCalledWith("gemini-3.5-flash");
  });

  it("devuelve false si no hay portapapeles o lo deniegan", async () => {
    expect(await copyText("x", undefined)).toBe(false);
    const writeText = vi.fn(async () => { throw new Error("denied"); });
    expect(await copyText("x", { clipboard: { writeText } } as unknown as Navigator)).toBe(false);
  });
});
