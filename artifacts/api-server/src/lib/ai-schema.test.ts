import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { lenientArray, looseNumber, looseString, optionalLooseNumber, parseResearchJson, toLooseNumber } from "./ai-schema";
import { logger } from "./logger.js";

describe("toLooseNumber", () => {
  it("acepta números y cadenas con moneda y formato español", () => {
    expect(toLooseNumber(7)).toBe(7);
    expect(toLooseNumber("12,50 €")).toBe(12.5);
    expect(toLooseNumber("€12.50")).toBe(12.5);
    expect(toLooseNumber("1.234,56")).toBe(1234.56);
    expect(toLooseNumber("1,234.56")).toBe(1234.56);
    expect(toLooseNumber("29.99 EUR")).toBe(29.99);
    expect(toLooseNumber("-3,5")).toBe(-3.5);
    expect(toLooseNumber("4,5.")).toBe(4.5);
  });

  it("no inventa: rangos y texto sin cifras no son números", () => {
    expect(toLooseNumber("5-10")).toBeNaN();
    expect(toLooseNumber("4.5/5")).toBeNaN();
    expect(toLooseNumber("XX.XX")).toBeNaN();
    expect(toLooseNumber("desconocido")).toBeNaN();
    expect(toLooseNumber("")).toBeNaN();
  });
});

describe("esquemas tolerantes", () => {
  it("looseNumber falla con valores ilegibles en vez de poner 0", () => {
    expect(looseNumber.safeParse("9,99").success).toBe(true);
    expect(looseNumber.safeParse("n/d").success).toBe(false);
  });

  it("optionalLooseNumber deja undefined lo ilegible", () => {
    expect(optionalLooseNumber.parse("n/d")).toBeUndefined();
    expect(optionalLooseNumber.parse(null)).toBeUndefined();
    expect(optionalLooseNumber.parse("3,5")).toBe(3.5);
  });

  it("looseString convierte números a texto", () => {
    expect(looseString.parse(50)).toBe("50");
    expect(looseString.parse("50 uds")).toBe("50 uds");
  });

  it("lenientArray conserva solo los elementos válidos", () => {
    const schema = lenientArray(z.object({ name: z.string(), price: looseNumber }));
    expect(schema.parse([{ name: "A", price: "10 €" }, { name: "B" }, "basura", { name: "C", price: 3 }]))
      .toEqual([{ name: "A", price: 10 }, { name: "C", price: 3 }]);
    expect(schema.parse("no es lista")).toEqual([]);
    expect(schema.parse(undefined)).toEqual([]);
  });
});

describe("parseResearchJson", () => {
  const schema = z.object({ items: lenientArray(z.object({ n: looseNumber })), note: z.string().default("") });

  it("extrae el JSON aunque venga con prosa alrededor", () => {
    const text = 'Aquí tienes {los datos}:\n```json\n{"items":[{"n":"1,5"}]}\n```\nFin.';
    expect(parseResearchJson(text, schema, "test")).toEqual({ items: [{ n: 1.5 }], note: "" });
  });

  it("devuelve null y lo registra si no hay JSON utilizable", () => {
    vi.mocked(logger.warn).mockClear();
    expect(parseResearchJson('{"items": [', schema, "test")).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("devuelve null sin registrar si la búsqueda no devolvió nada", () => {
    vi.mocked(logger.warn).mockClear();
    expect(parseResearchJson("  ", schema, "test")).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
