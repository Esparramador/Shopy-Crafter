import { describe, it, expect } from "vitest";
import { tierOptions } from "./AIModelTiersPanel";

const catalog = [{ id: "grok-4.3", label: "Grok 4.3", tierHint: "fast" as const }];

describe("tierOptions", () => {
  it("deja el catálogo tal cual si el modelo activo está en él", () => {
    expect(tierOptions(catalog, "grok-4.3", "grok-4.3").map(m => m.id)).toEqual(["grok-4.3"]);
  });

  it("añade el modelo activo y el de defecto si no están, para no perderlos al guardar", () => {
    const ids = tierOptions(catalog, "grok-custom", "grok-4.5").map(m => m.id);
    expect(ids).toEqual(["grok-4.5", "grok-custom", "grok-4.3"]);
  });
});
