import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("@workspace/db/schema", () => ({ projectsTable: {}, planCreditPacksTable: {} }));

const { PLAN_CATALOG, planFeatures } = await import("./plan-catalog");
const { PLAN_LIMITS } = await import("./plan-limits");

describe("catálogo de planes", () => {
  it("las cuotas que se aplican (PLAN_LIMITS) son las del catálogo que se vende", () => {
    for (const p of PLAN_CATALOG) {
      expect(PLAN_LIMITS[p.id].productsPerMonth).toBe(p.productsPerMonth);
      expect(PLAN_LIMITS[p.id].maxImagesPerMonth).toBe(p.imagesPerMonth);
      expect(PLAN_LIMITS[p.id].label).toContain(`€${p.priceMonthly}`);
    }
  });

  it("el anual cobra 10 mensualidades y los precios suben con las cuotas", () => {
    for (const p of PLAN_CATALOG) expect(p.priceAnnual).toBe(p.priceMonthly * 10);
    const sorted = [...PLAN_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].priceMonthly).toBeGreaterThan(sorted[i - 1].priceMonthly);
      expect(sorted[i].productsPerMonth).toBeGreaterThan(sorted[i - 1].productsPerMonth);
    }
  });

  it("los textos solo prometen lo que el sistema aplica (sin SLA, API, white-label ni soporte 24/7)", () => {
    const all = PLAN_CATALOG.flatMap(p => planFeatures(p).map(f => f.text)).join(" | ");
    for (const banned of ["SLA", "API", "White-label", "24/7", "ilimitad", "Account Manager"]) {
      expect(all).not.toContain(banned);
    }
  });
});

describe("conocimiento del chatbot", () => {
  it("el bloque de precios usa los precios y cuotas del catálogo", async () => {
    const { buildPricingBlock, PLATFORM_PLANS } = await import("./platform-knowledge");
    const block = buildPricingBlock();
    for (const p of PLAN_CATALOG) {
      expect(block).toContain(`${p.name} (${p.priceMonthly}€/mes + IVA`);
      expect(block).toContain(`${p.productsPerMonth} productos optimizados al mes`);
    }
    expect(PLATFORM_PLANS.map(p => p.id)).toEqual([...PLAN_CATALOG.map(p => p.id), "personalizado"]);
    for (const old of ["Growth Studio", "Performance Lab", "Photoshoot", "Starter Free"]) expect(block).not.toContain(old);
  });

  it("la calculadora ofrece como recurrentes solo planes y servicios mensuales reales", async () => {
    const { CALC_RECURRING_SERVICES } = await import("./cms-defaults");
    const { SERVICE_CATALOG } = await import("./service-catalog");
    const monthly = SERVICE_CATALOG.filter(s => s.interval === "month");
    expect(CALC_RECURRING_SERVICES).toHaveLength(PLAN_CATALOG.length + monthly.length);
    for (const r of CALC_RECURRING_SERVICES) expect(r.description).not.toMatch(/ilimitad|24\/7/i);
  });
});
