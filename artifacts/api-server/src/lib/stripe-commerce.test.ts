import { describe, expect, it } from "vitest";
import {
  toMinorUnits, fromMinorUnits, sanitizeMetadata, associationMetadata, normalizePrice, normalizeImages,
  planPaymentLink, monthlyAmount, normalizeCoupon, normalizePromoCode, StripeRuleError, type LinkPrice,
} from "./stripe-commerce";

const price = (id: string, over: Partial<LinkPrice> = {}): LinkPrice => ({ id, currency: "eur", active: true, recurring: null, ...over });
const map = (...ps: LinkPrice[]) => new Map(ps.map(p => [p.id, p]));

describe("importes en unidades mínimas", () => {
  it("2 decimales, sin errores de coma flotante", () => {
    expect(toMinorUnits("19.99", "eur")).toBe(1999);
    expect(toMinorUnits("0,10", "EUR")).toBe(10);
    expect(toMinorUnits(1.005, "usd")).toBe(101);
  });
  it("monedas sin decimales y de 3 decimales (múltiplo de 10)", () => {
    expect(toMinorUnits("1500", "jpy")).toBe(1500);
    expect(toMinorUnits("1500", "clp")).toBe(1500);
    expect(toMinorUnits("1.234", "kwd")).toBe(1230);
    expect(fromMinorUnits(1500, "jpy")).toBe(1500);
  });
  it("rechaza importes no numéricos o negativos", () => {
    expect(() => toMinorUnits("abc", "eur")).toThrow(StripeRuleError);
    expect(() => toMinorUnits(-1, "eur")).toThrow(StripeRuleError);
  });
});

describe("metadata y asociación", () => {
  it("aplica los límites de Stripe", () => {
    expect(sanitizeMetadata({ pedido: 123, " vacio ": "" })).toEqual({ pedido: "123", vacio: "" });
    expect(() => sanitizeMetadata({ ["k".repeat(41)]: "x" })).toThrow(/40/);
    expect(() => sanitizeMetadata({ "a[b]": "x" })).toThrow(/corchetes/);
    expect(() => sanitizeMetadata({ k: "x".repeat(501) })).toThrow(/500/);
    expect(() => sanitizeMetadata(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"])))).toThrow(/50/);
  });
  it("asociación tipada con el proyecto", () => {
    expect(associationMetadata(5, { type: "pedido", ref: " P-77 " })).toEqual({ sc_project_id: "5", sc_ref_type: "pedido", sc_ref: "P-77" });
    expect(() => associationMetadata(5, { type: "inventado" })).toThrow(StripeRuleError);
  });
});

describe("precios y productos", () => {
  it("único y recurrente", () => {
    expect(normalizePrice({ amount: "29", currency: "EUR" })).toMatchObject({ currency: "eur", unitAmount: 2900, recurring: null });
    expect(normalizePrice({ amount: 9.9, currency: "eur", interval: "month", intervalCount: 3 }).recurring).toEqual({ interval: "month", intervalCount: 3 });
  });
  it("periodo máximo de 3 años y precio > 0", () => {
    expect(() => normalizePrice({ amount: 10, currency: "eur", interval: "month", intervalCount: 37 })).toThrow(/3 años/);
    expect(() => normalizePrice({ amount: 10, currency: "eur", interval: "year", intervalCount: 4 })).toThrow();
    expect(() => normalizePrice({ amount: 0, currency: "eur" })).toThrow(/mayor que 0/);
  });
  it("máximo 8 imágenes http(s)", () => {
    expect(normalizeImages(["https://a.com/x.png"])).toEqual(["https://a.com/x.png"]);
    expect(() => normalizeImages(Array(9).fill("https://a.com/x.png"))).toThrow(/8/);
    expect(() => normalizeImages(["javascript:alert(1)"])).toThrow();
  });
});

describe("enlaces de pago", () => {
  it("pago único vs suscripción según los precios", () => {
    expect(planPaymentLink({ items: [{ priceId: "a" }] }, map(price("a")))).toEqual({ mode: "payment", currency: "eur" });
    const rec = price("r", { recurring: { interval: "month", interval_count: 1 } });
    expect(planPaymentLink({ items: [{ priceId: "a" }, { priceId: "r" }] }, map(price("a"), rec)).mode).toBe("subscription");
  });
  it("misma moneda y misma periodicidad", () => {
    expect(() => planPaymentLink({ items: [{ priceId: "a" }, { priceId: "b" }] }, map(price("a"), price("b", { currency: "usd" })))).toThrow(/moneda/);
    const m = price("m", { recurring: { interval: "month", interval_count: 1 } });
    const y = price("y", { recurring: { interval: "year", interval_count: 1 } });
    expect(() => planPaymentLink({ items: [{ priceId: "m" }, { priceId: "y" }] }, map(m, y))).toThrow(/periodicidad/);
  });
  it("opciones que solo valen en un modo", () => {
    const rec = price("r", { recurring: { interval: "month", interval_count: 1 } });
    expect(() => planPaymentLink({ items: [{ priceId: "a" }], trialDays: 7 }, map(price("a")))).toThrow(/prueba/);
    expect(() => planPaymentLink({ items: [{ priceId: "r" }], invoiceAfterPayment: true }, map(rec))).toThrow(/factura/);
    expect(() => planPaymentLink({ items: [{ priceId: "r" }], submitType: "pay" }, map(rec))).toThrow();
    expect(planPaymentLink({ items: [{ priceId: "r" }], submitType: "subscribe", trialDays: 14 }, map(rec)).mode).toBe("subscription");
    expect(() => planPaymentLink({ items: [{ priceId: "a" }], submitType: "subscribe" }, map(price("a")))).toThrow();
  });
  it("límites de líneas, cantidades y precios archivados", () => {
    expect(() => planPaymentLink({ items: [] }, map())).toThrow();
    expect(() => planPaymentLink({ items: Array.from({ length: 21 }, (_, i) => ({ priceId: `p${i}` })) }, map(...Array.from({ length: 21 }, (_, i) => price(`p${i}`))))).toThrow(/20/);
    expect(() => planPaymentLink({ items: [{ priceId: "a" }] }, map(price("a", { active: false })))).toThrow(/archivado/);
    expect(() => planPaymentLink({ items: [{ priceId: "a", quantity: 5, adjustable: { enabled: true, minimum: 1, maximum: 3 } }] }, map(price("a")))).toThrow();
    expect(() => planPaymentLink({ items: [{ priceId: "a" }, { priceId: "a" }] }, map(price("a")))).toThrow(/repitas/);
    expect(() => planPaymentLink({ items: [{ priceId: "x" }] }, map())).toThrow(/no encontrado/);
  });
});

describe("MRR", () => {
  it("normaliza cantidad e intervalo", () => {
    expect(monthlyAmount({ unitAmount: 1000, quantity: 2, interval: "month", intervalCount: 1 })).toBe(2000);
    expect(monthlyAmount({ unitAmount: 12000, quantity: 1, interval: "year", intervalCount: 1 })).toBe(1000);
    expect(monthlyAmount({ unitAmount: 3000, quantity: 1, interval: "month", intervalCount: 3 })).toBe(1000);
    expect(monthlyAmount({ unitAmount: 1200, quantity: 1, interval: "week", intervalCount: 1 })).toBeCloseTo(5200);
    expect(monthlyAmount({ unitAmount: 1000, quantity: 1, interval: null, intervalCount: null })).toBe(0);
  });
});

describe("cupones", () => {
  it("porcentaje o importe, nunca ambos", () => {
    expect(normalizeCoupon({ percentOff: 15 })).toEqual({ duration: "once", percent_off: 15 });
    expect(normalizeCoupon({ amountOff: "5", currency: "EUR", duration: "repeating", durationInMonths: 3 }))
      .toEqual({ duration: "repeating", amount_off: 500, currency: "eur", duration_in_months: 3 });
    expect(() => normalizeCoupon({ percentOff: 10, amountOff: 5, currency: "eur" })).toThrow();
    expect(() => normalizeCoupon({})).toThrow();
    expect(() => normalizeCoupon({ percentOff: 101 })).toThrow();
    expect(() => normalizeCoupon({ percentOff: 10, duration: "repeating" })).toThrow(/meses/);
  });
  it("código promocional válido", () => {
    expect(normalizePromoCode(" VERANO-25 ")).toBe("VERANO-25");
    expect(normalizePromoCode("")).toBeUndefined();
    expect(() => normalizePromoCode("con espacio")).toThrow();
  });
});
