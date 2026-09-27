import { describe, expect, it, vi } from "vitest";
vi.mock("@workspace/db", () => ({ db: {}, projectsTable: {} }));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const { wooPricesToInternal, internalPricesToWoo } = await import("./woocommerce");

describe("precios WooCommerce ↔ modelo interno", () => {
  it("producto rebajado: price = rebajado, compareAt = original", () => {
    expect(wooPricesToInternal({ price: "40", regular_price: "50", sale_price: "40" })).toEqual({ price: "40", compareAtPrice: "50" });
  });
  it("sin rebaja: sin precio tachado", () => {
    expect(wooPricesToInternal({ price: "50", regular_price: "50", sale_price: "" })).toEqual({ price: "50", compareAtPrice: null });
  });
  it("al escribir: compareAt mayor → regular y sale; si no, se quita la rebaja", () => {
    expect(internalPricesToWoo("40", "50")).toEqual({ regular_price: "50", sale_price: "40" });
    expect(internalPricesToWoo("50", null)).toEqual({ regular_price: "50", sale_price: "" });
    expect(internalPricesToWoo(undefined, "50")).toEqual({});
  });
});
