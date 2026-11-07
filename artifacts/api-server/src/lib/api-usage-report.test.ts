import { beforeEach, describe, expect, it, vi } from "vitest";

// BD falsa: platform_settings en un Map; api_usage_log devuelve `usageRows`.
const settings = new Map<string, string>();
let usageRows: any[] = [];
const T = (name: string) => new Proxy({ __t: name }, { get: (t, k) => (k === "__t" ? name : { col: String(k) }) });
const platformSettingsTable = T("settings");
const apiUsageLogTable = T("usage");
const projectsTable = T("projects");

function chain(table: string): any {
  const result = () => (table === "settings" ? [...settings].map(([key, value]) => ({ key, value })) : usageRows);
  const c: any = {
    leftJoin: () => c, where: () => c, orderBy: () => c, groupBy: () => c, limit: () => c,
    then: (ok: any, ko: any) => Promise.resolve(result()).then(ok, ko),
  };
  return c;
}
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: (t: any) => chain(t.__t) }),
    insert: () => ({
      values: (v: { key: string; value: string }) => ({
        onConflictDoUpdate: async () => { settings.set(v.key, v.value); },
      }),
    }),
  },
  platformSettingsTable, projectsTable,
}));
vi.mock("@workspace/db/schema", () => ({ apiUsageLogTable }));
vi.mock("drizzle-orm", () => {
  const sql: any = () => ({ as: () => ({}) });
  return { and: () => null, desc: () => null, eq: () => null, gte: () => null, lte: () => null, inArray: () => null, like: () => null, sql };
});
vi.mock("./logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const sendEmailWithAttachment = vi.fn(async () => true);
let gmail = true;
vi.mock("./gmail.js", () => ({
  sendEmailWithAttachment: (...a: unknown[]) => (sendEmailWithAttachment as any)(...a),
  sendEmail: vi.fn(async () => true),
  isGmailAvailable: () => gmail,
}));

const R = await import("./api-usage-report");

const row = (projectId: number | null, name: string | null, provider: string, costUsd: number) => ({
  createdAt: new Date("2026-10-10T10:00:00Z"), projectId, projectName: name, shopDomain: null,
  provider, model: null, operation: "op", inputUnits: 1, outputUnits: 1, costUsd, costEur: costUsd * 0.92, success: 1,
});

beforeEach(() => {
  settings.clear();
  usageRows = [];
  gmail = true;
  sendEmailWithAttachment.mockClear();
  delete process.env.MONTHLY_COST_REPORT;
});

describe("summarizeByProject (#55)", () => {
  it("ordena por coste, saca el motor principal y el % del total", () => {
    const s = R.summarizeByProject([
      row(1, "Tienda A", "claude", 1), row(1, "Tienda A", "gemini", 0.5), row(1, "Tienda A", "claude", 1),
      row(2, "Tienda B", "runway", 7.5),
    ]);
    expect(s.map(p => p.name)).toEqual(["Tienda B", "Tienda A"]);
    expect(s[1]).toMatchObject({ mainProvider: "claude", calls: 3, costUsd: 2.5 });
    expect(s[0].pct).toBeCloseTo(75);
  });

  it("a partir de 10 proyectos agrupa el resto en «Otros»", () => {
    const rows = Array.from({ length: 13 }, (_, i) => row(i + 1, `P${i + 1}`, "claude", 13 - i));
    const s = R.summarizeByProject(rows, 10);
    expect(s).toHaveLength(11);
    expect(s[10].name).toBe("Otros (3 proyectos)");
    expect(s[10].costUsd).toBe(3 + 2 + 1);
  });

  it("la tabla del email escapa nombres y lleva las 5 columnas", () => {
    const html = R.buildCostReportHtml({ fromLabel: "2026-10-01", toLabel: "2026-10-31", rows: [row(1, "<b>x</b>", "claude", 1)] });
    expect(html).toContain("Motor principal");
    expect(html).toContain("% del total");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});

describe("CSV (#62)", () => {
  it("nombre con el proyecto y BOM al principio", () => {
    expect(R.csvFilename("2026-11-01", "2026-11-07", { id: 12, name: "Café Ñandú" })).toBe("costes-ia-proyecto-12-cafe-nandu-2026-11-01_2026-11-07.csv");
    expect(R.csvFilename("a", "b")).toBe("costes-ia-a_b.csv");
    const csv = R.buildCostCsv([row(1, 'Di "hola"', "claude", 1)]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Di ""hola"""');
  });

  it("una fecha final sola incluye ese día entero", () => {
    const end = R.parseRangeEnd("2026-11-07");
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([7, 23, 59]);
    expect(R.parseRangeEnd("2026-11-07T10:00:00Z").toISOString()).toBe("2026-11-07T10:00:00.000Z");
  });

  it("parseProjectId solo acepta enteros positivos", () => {
    expect(R.parseProjectId("7")).toBe(7);
    expect(R.parseProjectId("0")).toBeNull();
    expect(R.parseProjectId("abc")).toBeNull();
    expect(R.parseProjectId(undefined)).toBeNull();
  });
});

describe("previousMonthRange (#53)", () => {
  it("el día 1 a las 8:00 de Madrid cubre el mes anterior completo", () => {
    const r = R.previousMonthRange(new Date("2026-11-01T07:00:00Z"));
    expect(r).toMatchObject({ fromLabel: "2026-10-01", toLabel: "2026-10-31", month: "2026-10" });
    expect(r.from.toISOString()).toBe("2026-09-30T22:00:00.000Z"); // 00:00 CEST
    expect(r.to.toISOString()).toBe("2026-10-31T22:59:59.999Z");   // 23:59:59 CET
  });
  it("en enero vuelve a diciembre del año anterior", () => {
    expect(R.previousMonthRange(new Date("2027-01-01T08:00:00Z"))).toMatchObject({ fromLabel: "2026-12-01", toLabel: "2026-12-31" });
  });
});

describe("runMonthlyCostReport (#53/#54)", () => {
  const nov1 = new Date("2026-11-01T07:00:00Z");

  it("no envía si está desactivado", async () => {
    expect(await R.runMonthlyCostReport(nov1)).toBe("disabled");
    expect(sendEmailWithAttachment).not.toHaveBeenCalled();
  });

  it("con MONTHLY_COST_REPORT=true envía el mes anterior al email del panel, una sola vez", async () => {
    process.env.MONTHLY_COST_REPORT = "true";
    settings.set(R.REPORT_KEYS.email, "jefe@ejemplo.com");
    usageRows = [row(1, "Tienda A", "claude", 2)];
    expect(await R.runMonthlyCostReport(nov1)).toBe("sent");
    const [to, subject, html, att] = sendEmailWithAttachment.mock.calls[0] as any[];
    expect(to).toBe("jefe@ejemplo.com");
    expect(subject).toContain("2026-10-01 a 2026-10-31");
    expect(html).toContain("Tienda A");
    expect(att[0].filename).toBe("costes-ia-2026-10-01_2026-10-31.csv");
    expect(settings.get(R.REPORT_KEYS.lastMonth)).toBe("2026-10");
    expect(await R.runMonthlyCostReport(nov1)).toBe("already-sent");
    expect(sendEmailWithAttachment).toHaveBeenCalledTimes(1);
  });

  it("el interruptor del panel también lo activa; el entorno en false manda", async () => {
    settings.set(R.REPORT_KEYS.monthly, "true");
    expect((await R.getReportSettings()).monthlyEffective).toBe(true);
    process.env.MONTHLY_COST_REPORT = "false";
    expect(await R.runMonthlyCostReport(nov1)).toBe("disabled");
  });

  it("sin Gmail no marca el mes (lo reintenta otro día)", async () => {
    process.env.MONTHLY_COST_REPORT = "true";
    gmail = false;
    expect(await R.runMonthlyCostReport(nov1)).toBe("no-gmail");
    expect(settings.has(R.REPORT_KEYS.lastMonth)).toBe(false);
  });

  it("sin email configurado usa el del admin por defecto", async () => {
    expect((await R.getReportSettings()).email).toBe(R.DEFAULT_REPORT_EMAIL);
  });
});
