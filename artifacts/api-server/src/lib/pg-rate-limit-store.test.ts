import { describe, expect, it, vi, beforeEach } from "vitest";

// Tabla express_rate_limits simulada: vive FUERA de las instancias del store,
// como la de Postgres. Crear un store nuevo equivale a reiniciar el API o a
// arrancar otra instancia contra la misma base de datos.
const table = new Map<string, { total_hits: number; reset_at: Date }>();
let failQueries = false;

vi.mock("@workspace/db", () => ({
  pool: {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (failQueries) throw new Error("db caída");
      if (sql.includes("INSERT INTO express_rate_limits")) {
        const [key, resetAt] = params as [string, Date];
        const row = table.get(key);
        const now = new Date();
        if (!row || row.reset_at <= now) table.set(key, { total_hits: 1, reset_at: resetAt });
        else row.total_hits++;
        return { rows: [table.get(key)] };
      }
      if (sql.includes("UPDATE express_rate_limits")) {
        const row = table.get(params[0] as string);
        if (row) row.total_hits = Math.max(row.total_hits - 1, 0);
        return { rows: [] };
      }
      return { rows: [] };
    }),
  },
}));
vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const { PgRateLimitStore } = await import("./pg-rate-limit-store.js");
const { default: rateLimit } = await import("express-rate-limit");

const HOUR = 60 * 60 * 1000;

function contactStore() {
  const store = new PgRateLimitStore("contact");
  store.init({ windowMs: HOUR } as never);
  return store;
}

describe("límite del formulario de contacto (PgRateLimitStore «contact»)", () => {
  beforeEach(() => {
    table.clear();
    failQueries = false;
  });

  it("app.ts monta el limitador de /api/contact con el store persistente y 5 por hora", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(new URL("../app.ts", import.meta.url), "utf8");
    const block = src.slice(src.indexOf("const contactLimiter"), src.indexOf("});", src.indexOf("const contactLimiter")));
    expect(block).toContain('store: new PgRateLimitStore("contact")');
    expect(block).toMatch(/max:\s*5,/);
    expect(block).toMatch(/windowMs:\s*60 \* 60 \* 1000/);
    expect(src).toContain('app.use("/api/contact", contactLimiter)');
  });

  it("el cupo sobrevive a un reinicio y se comparte entre instancias", async () => {
    const antes = contactStore();
    for (let i = 1; i <= 3; i++) expect((await antes.increment("1.2.3.4")).totalHits).toBe(i);

    const trasReinicio = contactStore();
    expect((await trasReinicio.increment("1.2.3.4")).totalHits).toBe(4);
    const otraInstancia = contactStore();
    expect((await otraInstancia.increment("1.2.3.4")).totalHits).toBe(5);
    expect((await trasReinicio.increment("1.2.3.4")).totalHits).toBe(6);

    // Otra IP y otro limitador con la misma IP no se mezclan.
    expect((await otraInstancia.increment("5.6.7.8")).totalHits).toBe(1);
    const otroPrefijo = new PgRateLimitStore("public_voice");
    otroPrefijo.init({ windowMs: HOUR } as never);
    expect((await otroPrefijo.increment("1.2.3.4")).totalHits).toBe(1);
    expect([...table.keys()]).toContain("contact:1.2.3.4");
  });

  it("express-rate-limit responde 429 en la sexta solicitud aunque se reinicie entre medias", async () => {
    const hit = async () => {
      // Cada llamada usa un limitador nuevo: simula un reinicio del proceso.
      const limiter = rateLimit({ windowMs: HOUR, max: 5, store: contactStore(), validate: false, standardHeaders: true, legacyHeaders: false });
      let status = 200;
      const req = { ip: "9.9.9.9", method: "POST", headers: {}, app: { get: () => false } } as never;
      const res = {
        headersSent: false,
        setHeader: () => undefined,
        append: () => undefined,
        status(code: number) { status = code; return this; },
        send() { return this; },
        json() { return this; },
        end() { return this; },
        on: () => undefined,
      } as never;
      await new Promise<void>(resolve => {
        const out = limiter(req, res, () => resolve());
        Promise.resolve(out).then(() => resolve());
      });
      return status;
    };
    const estados = [];
    for (let i = 0; i < 6; i++) estados.push(await hit());
    expect(estados).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("si la base de datos falla, cierra el paso (no deja envíos ilimitados)", async () => {
    failQueries = true;
    const { totalHits } = await contactStore().increment("1.2.3.4");
    expect(totalHits).toBe(Number.MAX_SAFE_INTEGER);
  });
});
