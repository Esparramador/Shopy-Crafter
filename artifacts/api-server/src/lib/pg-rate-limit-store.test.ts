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
const { createContactRateLimiter, CONTACT_HOURLY_LIMIT } = await import("./contact-rate-limit.js");
const { claimContactSubmission } = await import("./contact-idempotency.js");

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

  it("la ruta de contacto usa el cupo persistente y app.ts ya no cuenta antes de la ruta", async () => {
    const { readFile } = await import("node:fs/promises");
    const route = await readFile(new URL("../routes/contact.ts", import.meta.url), "utf8");
    expect(route).toContain('createContactRateLimiter(new PgRateLimitStore("contact"))');
    expect(route).toContain("() => checkContactRateLimit(req.ip");
    expect(route).not.toContain("contactRateMap");
    const app = await readFile(new URL("../app.ts", import.meta.url), "utf8");
    expect(app).not.toMatch(/app\.use\("\/api\/contact"/);
    expect(CONTACT_HOURLY_LIMIT).toBe(5);
  });

  describe("formulario: solo cuentan las solicitudes nuevas", () => {
    const records = new Map<string, { action: string; details: string }>();
    const submissions = {
      find: async (id: string) => records.get(id),
      insert: async (r: { id: string; action: string; details: string }) => {
        if (records.has(r.id)) return false;
        records.set(r.id, { action: r.action, details: r.details });
        return true;
      },
    };
    const lead = (n: number) => ({ name: `Cliente ${n}`, email: `c${n}@example.invalid`, services: [] });
    // Un limitador nuevo por solicitud = el API se reinicia entre envíos.
    const submit = (key: string, n: number, ip = "1.2.3.4") =>
      claimContactSubmission(key, lead(n), submissions, () => createContactRateLimiter(new PgRateLimitStore("contact"))(ip));

    beforeEach(() => records.clear());

    it("5 nuevas pasan, la sexta da rate_limited y un reintento con la misma clave no gasta cupo", async () => {
      expect(await submit("clave-solicitud-0001", 1)).toBe("accepted");
      // Reintento idempotente de la primera: no consume.
      expect(await submit("clave-solicitud-0001", 1)).toBe("duplicate");
      for (let n = 2; n <= 5; n++) expect(await submit(`clave-solicitud-000${n}`, n)).toBe("accepted");
      expect(table.get("contact:1.2.3.4")?.total_hits).toBe(5);

      // Con el cupo agotado, un reintento confirmado sigue respondiendo como éxito...
      expect(await submit("clave-solicitud-0003", 3)).toBe("duplicate");
      expect(table.get("contact:1.2.3.4")?.total_hits).toBe(5);
      // ...y la sexta solicitud nueva se rechaza.
      expect(await submit("clave-solicitud-0006", 6)).toBe("rate_limited");
      expect(records.size).toBe(5);

      // Otra IP tiene su propio cupo.
      expect(await submit("clave-solicitud-0007", 7, "5.6.7.8")).toBe("accepted");
    });

    it("si la base de datos falla, no deja pasar una solicitud nueva", async () => {
      failQueries = true;
      expect(await submit("clave-solicitud-0001", 1)).toBe("rate_limited");
      expect(records.size).toBe(0);
    });
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
