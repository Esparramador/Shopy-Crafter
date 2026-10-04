import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@workspace/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
vi.mock("./logger.js", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { planAiBudgetEur, assertAiBudget, AiBudgetExceededError, _resetAiBudgetCache } = await import("./ai-budget");
const { runWithAiContext } = await import("./ai-context");
const { PLAN_CATALOG } = await import("./plan-catalog");

function projectRow(plan: string, spent: number, hasClient = true) {
  return { rows: [{ plan, credits_products: 0, has_client: hasClient, spent }] };
}

describe("presupuesto de IA por plan", () => {
  beforeEach(() => { execute.mockReset(); _resetAiBudgetCache(); delete process.env.AI_BUDGET_SHARE; });

  it("es el 30 % del ingreso mensual (anual / 12) y nunca supera el precio", () => {
    for (const p of PLAN_CATALOG) {
      const b = planAiBudgetEur(p.id);
      expect(b).toBeCloseTo((p.priceAnnual / 12) * 0.3, 1);
      expect(b).toBeLessThan(p.priceMonthly);
    }
    expect(planAiBudgetEur("admin")).toBe(Infinity);
    expect(planAiBudgetEur("trial")).toBe(1.5);
  });

  it("bloquea al cliente que ya consumió su IA del mes", async () => {
    execute.mockResolvedValueOnce(projectRow("emprendedor", 4.8));
    await expect(runWithAiContext({ projectId: 7, actor: "client" }, () => assertAiBudget()))
      .rejects.toBeInstanceOf(AiBudgetExceededError);
  });

  it("deja pasar mientras queda presupuesto", async () => {
    execute.mockResolvedValueOnce(projectRow("starter", 3));
    await expect(runWithAiContext({ projectId: 7, actor: "client" }, () => assertAiBudget())).resolves.toBeUndefined();
  });

  it("aplica el tope al equipo cuando el proyecto tiene cliente, no en proyectos internos", async () => {
    execute.mockResolvedValueOnce(projectRow("starter", 50, true));
    await expect(runWithAiContext({ projectId: 9, actor: "admin" }, () => assertAiBudget()))
      .rejects.toBeInstanceOf(AiBudgetExceededError);
    _resetAiBudgetCache();
    execute.mockResolvedValueOnce(projectRow("starter", 50, false));
    await expect(runWithAiContext({ projectId: 9, actor: "admin" }, () => assertAiBudget())).resolves.toBeUndefined();
  });

  it("corta la IA anónima al superar el tope diario público", async () => {
    process.env.PUBLIC_AI_DAILY_BUDGET_EUR = "5";
    execute.mockResolvedValueOnce({ rows: [{ spent: 5.2 }] });
    await expect(runWithAiContext({ projectId: null, actor: "public" }, () => assertAiBudget()))
      .rejects.toBeInstanceOf(AiBudgetExceededError);
  });

  it("si la BD falla no tumba la IA", async () => {
    execute.mockRejectedValueOnce(new Error("db down"));
    await expect(runWithAiContext({ projectId: 3, actor: "client" }, () => assertAiBudget())).resolves.toBeUndefined();
  });
});
