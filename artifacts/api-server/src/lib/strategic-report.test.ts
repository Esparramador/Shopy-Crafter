import { describe, expect, it } from "vitest";
import {
  assembleStrategicReport,
  groupSchema,
  planStrategicReport,
  STRATEGIC_SECTIONS,
  type StrategicReportInput,
  type StrategicSection,
  type StrategicSectionKey,
} from "./strategic-report";

function input(overrides: { products?: number; orders?: number; cogs?: number; competitors?: string[] } = {}): StrategicReportInput {
  const products = overrides.products ?? 0;
  return {
    project: {
      name: "Casa Pepa", shopDomain: null, platformType: "universal", storeNiche: "restaurante",
      brandTone: null, targetAudience: null, storeMarkets: null, projectDescription: "Restaurante de cocina catalana",
    },
    catalog: {
      total: products, active: products, draft: 0, archived: 0, pricedCount: products,
      avgPrice: products ? 20 : 0, minPrice: products ? 10 : 0, maxPrice: products ? 30 : 0, medianPrice: products ? 20 : 0,
      productTypes: products ? ["Camisetas"] : [],
      productLines: Array.from({ length: products }, (_, i) => `- "Camiseta ${i + 1}" | 20.00€ | active`),
    },
    seo: {
      avgScore: 40, grade: "F", withMetaTitle: 0, withMetaDesc: 0, withSchema: 0, withAltTexts: 0,
      withCleanHandle: 0, withLongDesc: 0, worstLines: [], bestLines: [],
    },
    financial: {
      catalogValue: products * 20, cogsTotal: 0, cogsCount: overrides.cogs ?? 0, avgMarginPct: null,
      revenue90d: (overrides.orders ?? 0) * 35, orders90d: overrides.orders ?? 0,
    },
    abTests: { total: 0, running: 0, completed: 0 },
    competitors: overrides.competitors ?? [],
    visualDna: null,
  };
}

const okSection: StrategicSection = { status: "ok", paragraphs: ["Texto"], items: [], missingData: [] };

describe("planStrategicReport", () => {
  it("negocio sin catálogo: no pide a la IA secciones de catálogo, pricing ni proyección", () => {
    const plan = planStrategicReport(input());
    const asked = plan.groups.flatMap(g => g.keys);
    expect(asked).toEqual(expect.arrayContaining(["executiveSummary", "brandAnalysis", "competitivePosition", "actionPlan30Days"]));
    for (const k of ["seoDeepAnalysis", "pricingStrategy", "financialAnalysis", "productMixStrategy", "revenueProjection"]) {
      expect(asked).not.toContain(k);
      expect(plan.missingSections.map(m => m.key)).toContain(k);
    }
    const prompt = plan.groups.map(g => g.prompt).join("\n");
    expect(prompt).toContain("Negocio SIN catálogo");
    expect(prompt).not.toContain("Precio medio");
    expect(prompt).toContain("NO nombres ninguno");
  });

  it("tienda con catálogo y ventas: pide las 9 secciones en 3 bloques", () => {
    const plan = planStrategicReport(input({ products: 5, orders: 12, competitors: ["- Rival (rival.com)"] }));
    expect(plan.groups.map(g => g.group)).toEqual([1, 2, 3]);
    expect(plan.groups.flatMap(g => g.keys).sort()).toEqual(STRATEGIC_SECTIONS.map(s => s.key).sort());
    expect(plan.missingSections).toEqual([]);
    expect(plan.groups[1].prompt).toContain("Camiseta 5");
  });
});

describe("groupSchema", () => {
  it("normaliza effort y rellena items/missingData opcionales", () => {
    const r = groupSchema(["actionPlan30Days"]).safeParse({
      sections: { actionPlan30Days: { status: "ok", paragraphs: ["Intro"], items: [{ title: "A", effort: "Medio" }, { title: "B", effort: "medio-alto" }] } },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const s = r.data.sections.actionPlan30Days;
      expect(s.items.map(i => i.effort)).toEqual(["medio", null]);
      expect(s.missingData).toEqual([]);
    }
  });

  it("rechaza que falte una sección pedida", () => {
    expect(groupSchema(["executiveSummary", "brandAnalysis"]).safeParse({ sections: { executiveSummary: okSection } }).success).toBe(false);
  });
});

describe("assembleStrategicReport", () => {
  it("escapa el HTML de la IA, respeta **negrita** y lista los datos que faltan", () => {
    const plan = planStrategicReport(input());
    const generated: Partial<Record<StrategicSectionKey, StrategicSection>> = {
      executiveSummary: { status: "ok", paragraphs: ["Hay **0 productos** <script>alert(1)</script>"], items: [], missingData: [] },
      brandAnalysis: { status: "sin_datos", paragraphs: ["Sin tono definido."], items: [], missingData: ["Tono de marca"] },
      competitivePosition: okSection,
      actionPlan30Days: { status: "ok", paragraphs: ["Plan"], items: [{ title: "Sincronizar carta", detail: "", effort: "bajo" }], missingData: [] },
    };
    const report = assembleStrategicReport(plan, generated);
    expect(Object.keys(report)).toEqual(STRATEGIC_SECTIONS.map(s => s.key));
    expect(report.executiveSummary).toContain("<strong>0 productos</strong>");
    expect(report.executiveSummary).not.toContain("<script>");
    expect(report.brandAnalysis).toContain("Tono de marca");
    expect(report.actionPlan30Days).toContain("<ol>");
    expect(report.pricingStrategy).toContain("No hay datos suficientes");
    expect(report.revenueProjection).toContain("0 pedidos");
  });

  it("falla de forma explícita si falta una sección que debía generar la IA", () => {
    const plan = planStrategicReport(input());
    expect(() => assembleStrategicReport(plan, {})).toThrow(/executiveSummary/);
  });
});
