import { describe, expect, it } from "vitest";
import { describeActionResult, humanizeAction, normalizeBrainAnswer } from "./brain-ask";

describe("normalizeBrainAnswer", () => {
  it("junta detectedAction y detectedActions y conserva la entidad propuesta", () => {
    expect(normalizeBrainAnswer({
      answer: "Te lo preparo.", source: "auto→claude", potentialEntity: " zara.com ", entityKnowledgeUsed: true,
      detectedAction: { action: "generate_video", params: { prompt: "x" } },
    })).toEqual({
      answer: "Te lo preparo.", source: "auto→claude", potentialEntity: "zara.com", entityKnowledgeUsed: true,
      actions: [{ action: "generate_video", params: { prompt: "x" } }],
    });
    const many = normalizeBrainAnswer({ answer: "", detectedAction: { action: "a" }, detectedActions: [{ action: "a" }, { action: "b", params: null }, { nope: 1 }] });
    expect(many.actions).toEqual([{ action: "a", params: {} }, { action: "b", params: {} }]);
  });

  it("aguanta respuestas vacías o de recuperación", () => {
    expect(normalizeBrainAnswer(null)).toEqual({ answer: "", source: null, actions: [], potentialEntity: null, entityKnowledgeUsed: false });
    expect(normalizeBrainAnswer({ answer: "Lo siento", source: "error_recovery", detectedAction: null, potentialEntity: "ab" }).potentialEntity).toBeNull();
  });
});

describe("describeActionResult", () => {
  it("éxito, error, confirmación cancelada", () => {
    expect(describeActionResult("create_product", 200, { success: true, message: "Producto creado" })).toEqual({ ok: true, cancelled: false, message: "Producto creado" });
    expect(describeActionResult("create_product", 200, { success: true })).toEqual({ ok: true, cancelled: false, message: "Create product: hecho." });
    expect(describeActionResult("x", 403, { error: "La acción x no está permitida aquí." })).toMatchObject({ ok: false, message: "La acción x no está permitida aquí." });
    expect(describeActionResult("delete_product", 200, { error: true, cancelled: true, message: "Acción cancelada" })).toEqual({ ok: false, cancelled: true, message: "Acción cancelada" });
  });

  it("humanizeAction", () => {
    expect(humanizeAction("create_brand_ad")).toBe("Create brand ad");
  });
});
