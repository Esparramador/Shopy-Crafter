import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = new Map<string, string>();
let spendRows: Array<{ provider: string; costUsd: number }> = [];
const T = (name: string) => new Proxy({ __t: name }, { get: (t, k) => (k === "__t" ? name : { col: String(k) }) });
const platformSettingsTable = T("settings");
const apiUsageLogTable = T("usage");

let likeMode = false;
function chain(table: string): any {
  const result = () => {
    if (table !== "settings") return spendRows;
    const all = [...settings].map(([key, value]) => ({ key, value }));
    return likeMode ? all.filter(r => /^ai_cost_alert_threshold_.+_usd$/.test(r.key)) : all;
  };
  const c: any = {
    where: (cond: any) => { likeMode = cond === "LIKE"; return c; },
    orderBy: () => c, groupBy: () => c, leftJoin: () => c,
    then: (ok: any, ko: any) => Promise.resolve(result()).then(ok, ko),
  };
  return c;
}
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: (t: any) => chain(t.__t) }),
    insert: () => ({ values: (v: any) => ({ onConflictDoUpdate: async () => { settings.set(v.key, v.value); } }) }),
    delete: () => ({ where: async (cond: any) => { settings.delete(cond.key); } }),
  },
  platformSettingsTable, projectsTable: T("projects"),
}));
vi.mock("@workspace/db/schema", () => ({ apiUsageLogTable }));
vi.mock("drizzle-orm", () => {
  const sql: any = (strings: TemplateStringsArray, ...vals: unknown[]) =>
    strings[0].length === 0 && vals.length === 2 ? { key: vals[1] } : { as: () => ({}) };
  return { and: () => null, desc: () => null, eq: () => null, gte: () => null, lte: () => null, inArray: () => null, like: () => "LIKE", sql };
});
vi.mock("./logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const sendEmail = vi.fn(async (..._a: unknown[]) => true);
let gmail = true;
vi.mock("./gmail.js", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  sendEmailWithAttachment: vi.fn(async () => true),
  isGmailAvailable: () => gmail,
}));

const A = await import("./ai-cost-alert");

const NOW = new Date("2026-11-07T07:00:00Z"); // 8:00 en Madrid
const NEXT_DAY = new Date("2026-11-08T07:00:00Z");

beforeEach(() => {
  settings.clear();
  spendRows = [];
  gmail = true;
  sendEmail.mockClear();
});

describe("evaluateAlerts", () => {
  const base = { totalSpentUsd: 0, spentByProvider: {}, thresholdUsd: 10, providerThresholds: {}, warnPct: 80, state: {}, today: "2026-11-07" };

  it("por debajo del % de aviso no hay nada", () => {
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 7.9 })).toEqual([]);
  });
  it("al 80 % avisa (#60)", () => {
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 8 })).toMatchObject([{ scope: "total", level: "warn" }]);
  });
  it("el aviso no se repite en el mismo mes, sí al mes siguiente", () => {
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 9, state: { "warn:total": "2026-11" } })).toEqual([]);
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 9, state: { "warn:total": "2026-10" } })).toHaveLength(1);
  });
  it("superado: alerta una vez al día", () => {
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 12 })).toMatchObject([{ level: "over" }]);
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 12, state: { "over:total": "2026-11-07" } })).toEqual([]);
  });
  it("warnPct 0 desactiva el aviso previo", () => {
    expect(A.evaluateAlerts({ ...base, totalSpentUsd: 9.5, warnPct: 0 })).toEqual([]);
  });
  it("cada proveedor con su propio umbral (#61)", () => {
    const hits = A.evaluateAlerts({
      ...base, thresholdUsd: 0, totalSpentUsd: 30,
      spentByProvider: { runway: 6, claude: 17, gemini: 50 },
      providerThresholds: { runway: 5, claude: 20 },
    });
    expect(hits.map(h => `${h.level}:${h.scope}`)).toEqual(["over:runway", "warn:claude"]);
  });
});

describe("buildAlertEmail", () => {
  it("el aviso tiene asunto y color distintos a la alerta (#60)", () => {
    const warn = A.buildAlertEmail({ hits: [{ scope: "total", level: "warn", spentUsd: 8, thresholdUsd: 10, pct: 80 }], monthLabel: "noviembre de 2026", byProvider: [] });
    const over = A.buildAlertEmail({ hits: [{ scope: "total", level: "over", spentUsd: 12, thresholdUsd: 10, pct: 120 }], monthLabel: "noviembre de 2026", byProvider: [] });
    expect(warn.subject).toContain("Aviso");
    expect(warn.subject).toContain("80%");
    expect(over.subject).toContain("superado");
    expect(warn.html).toContain("#f59e0b");
    expect(over.html).toContain("#ef4444");
  });
});

describe("runAiCostAlertCheck", () => {
  it("manda el aviso al 80 % una sola vez en el mes", async () => {
    settings.set(A.ALERT_KEYS.threshold, "10");
    settings.set(A.ALERT_KEYS.email, "jefe@ejemplo.com");
    spendRows = [{ provider: "claude", costUsd: 8.5 }];
    expect(await A.runAiCostAlertCheck(NOW)).toHaveLength(1);
    expect(sendEmail.mock.calls[0][0]).toBe("jefe@ejemplo.com");
    expect(String(sendEmail.mock.calls[0][1])).toContain("Aviso");
    expect(await A.runAiCostAlertCheck(NEXT_DAY)).toEqual([]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(settings.get(A.ALERT_KEYS.lastSent)).toBe("2026-11-07");
  });

  it("solo con umbral por proveedor también revisa (#61)", async () => {
    settings.set(A.providerThresholdKey("runway"), "5");
    spendRows = [{ provider: "runway", costUsd: 6 }, { provider: "claude", costUsd: 1 }];
    const hits = await A.runAiCostAlertCheck(NOW);
    expect(hits).toMatchObject([{ scope: "runway", level: "over" }]);
  });

  it("desactivada no manda nada", async () => {
    settings.set(A.ALERT_KEYS.threshold, "1");
    settings.set(A.ALERT_KEYS.enabled, "false");
    spendRows = [{ provider: "claude", costUsd: 5 }];
    expect(await A.runAiCostAlertCheck(NOW)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sin Gmail no marca nada como enviado", async () => {
    settings.set(A.ALERT_KEYS.threshold, "1");
    spendRows = [{ provider: "claude", costUsd: 5 }];
    gmail = false;
    expect(await A.runAiCostAlertCheck(NOW)).toEqual([]);
    expect(settings.has(A.ALERT_KEYS.state)).toBe(false);
  });
});

describe("ajustes", () => {
  it("guarda y lee umbrales por proveedor; 0 o vacío los borra", async () => {
    await A.saveProviderThresholds({ runway: 5, claude: "20", "MAL nombre": 3 });
    expect((await A.getAlertSettings()).providerThresholds).toEqual({ runway: 5, claude: 20 });
    await A.saveProviderThresholds({ runway: 0, claude: null });
    expect((await A.getAlertSettings()).providerThresholds).toEqual({});
  });
  it("warnPct por defecto 80 y acotado a 0..99", async () => {
    expect((await A.getAlertSettings()).warnPct).toBe(80);
    expect(A.normalizeWarnPct(150)).toBe(99);
    expect(A.normalizeWarnPct(-3)).toBe(0);
  });
});

describe("sendTestAlert (#59)", () => {
  it("manda ya un email marcado como prueba aunque no se haya llegado al umbral, sin tocar las marcas", async () => {
    settings.set(A.ALERT_KEYS.threshold, "100");
    spendRows = [{ provider: "claude", costUsd: 1 }];
    const r = await A.sendTestAlert(NOW);
    expect(r.ok).toBe(true);
    expect(String(sendEmail.mock.calls[0][1])).toMatch(/^\[PRUEBA\]/);
    expect(settings.has(A.ALERT_KEYS.state)).toBe(false);
    expect(settings.has(A.ALERT_KEYS.lastSent)).toBe(false);
  });
});
