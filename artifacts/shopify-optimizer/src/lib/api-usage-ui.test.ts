import { describe, expect, it } from "vitest";
import { filenameFromDisposition, providerBudgetsPayload, rankProjects } from "./api-usage-ui";

describe("filenameFromDisposition (#62)", () => {
  it("usa el nombre del servidor (con el proyecto) y si no, el de reserva", () => {
    expect(filenameFromDisposition('attachment; filename="costes-ia-proyecto-7-mi-tienda-2026-11-01_2026-11-07.csv"', "x.csv"))
      .toBe("costes-ia-proyecto-7-mi-tienda-2026-11-01_2026-11-07.csv");
    expect(filenameFromDisposition(null, "x.csv")).toBe("x.csv");
  });
});

describe("providerBudgetsPayload (#61)", () => {
  it("manda todos los motores; vacío o 0 se envía como null para borrarlo", () => {
    expect(providerBudgetsPayload(["claude", "runway", "gemini"], { claude: "20", runway: "0" }))
      .toEqual({ claude: 20, runway: null, gemini: null });
  });
});

describe("rankProjects (#63)", () => {
  it("ordena, limita a 10 y calcula el % sobre el total de todos", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ projectId: i + 1, projectName: `P${i + 1}`, shopDomain: null, costUsd: String(i + 1), calls: 1 }));
    const r = rankProjects(rows);
    expect(r).toHaveLength(10);
    expect(r[0]).toMatchObject({ name: "P12", costUsd: 12 });
    expect(r[0].pct).toBeCloseTo((12 / 78) * 100);
  });
  it("sin proyecto se nombra como plataforma", () => {
    expect(rankProjects([{ projectId: null, projectName: null, shopDomain: null, costUsd: 1, calls: 1 }])[0].name).toBe("Sin proyecto (plataforma)");
  });
});
