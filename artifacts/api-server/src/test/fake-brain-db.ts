/**
 * Postgres en memoria para las pruebas de ShopyBrain (lib/brain/*): solo lo que
 * usan el cerebro y sus puertas. Las filas se guardan con las claves JS de Drizzle
 * y los `where` se aplican de verdad para las igualdades (`"tabla"."col" = $n`),
 * que es lo que separa un proyecto de otro. Lo demás (>=, orden, límites) se ignora.
 *
 * Uso en una prueba:
 *   vi.mock("@workspace/db", async (orig) => {
 *     process.env.DATABASE_URL ||= "postgres://test@127.0.0.1:9/none"; // el Pool no conecta
 *     const { fakeBrainDb } = await import("../../test/fake-brain-db.js");
 *     return { ...(await orig<object>()), db: fakeBrainDb.db };
 *   });
 */
import { getTableColumns, getTableName, type SQL, type Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

type Row = Record<string, unknown>;

const dialect = new PgDialect();

function makeFakeBrainDb() {
  const rows = new Map<string, Row[]>();
  const tables = new Map<string, Table>();
  const inserts: Array<{ table: string; values: Row }> = [];
  const executes: Array<{ sql: string; params: unknown[] }> = [];

  function filterRows(tableName: string, where?: SQL): Row[] {
    const all = rows.get(tableName) ?? [];
    if (!where) return all;
    const table = tables.get(tableName);
    const byDbName = new Map<string, string>(
      table ? Object.entries(getTableColumns(table)).map(([js, col]) => [col.name, js]) : [],
    );
    const { sql, params } = dialect.sqlToQuery(where);
    const eqs = [...sql.matchAll(/"(\w+)"\."(\w+)" = \$(\d+)/g)];
    return all.filter(r => eqs.every(([, , col, idx]) => {
      const key = byDbName.get(col!) ?? col!;
      return String(r[key]) === String(params[Number(idx) - 1]);
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => {
      const st: { table?: string; where?: SQL } = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = {
        from(t: Table) { st.table = getTableName(t); tables.set(st.table, t); return q; },
        where(w: SQL) { st.where = w; return q; },
        orderBy() { return q; },
        limit() { return q; },
        then(res: (v: Row[]) => unknown, rej?: (e: unknown) => unknown) {
          return Promise.resolve().then(() => filterRows(st.table!, st.where)).then(res, rej);
        },
        catch(rej: (e: unknown) => unknown) { return q.then((v: Row[]) => v, rej); },
      };
      return q;
    },
    insert: (t: Table) => ({
      values(v: Row | Row[]) {
        const table = getTableName(t);
        const list = (Array.isArray(v) ? v : [v]).map(r => {
          inserts.push({ table, values: r });
          return { id: inserts.length, ...r };
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = Promise.resolve(list);
        p.returning = async () => list;
        p.onConflictDoNothing = () => p;
        return p;
      },
    }),
    execute: async (q: SQL | string) => {
      const { sql, params } = typeof q === "string" ? { sql: q, params: [] } : dialect.sqlToQuery(q);
      executes.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: async (work: (tx: any) => Promise<unknown>) => work(db),
  };

  return {
    db,
    inserts,
    executes,
    /** Filas de una tabla (por su objeto Drizzle), con claves JS. */
    seed(table: Table, list: Row[]) {
      tables.set(getTableName(table), table);
      rows.set(getTableName(table), list);
    },
    insertsInto(table: string) { return inserts.filter(i => i.table === table).map(i => i.values); },
    reset() { rows.clear(); inserts.length = 0; executes.length = 0; },
  };
}

export const fakeBrainDb = makeFakeBrainDb();
