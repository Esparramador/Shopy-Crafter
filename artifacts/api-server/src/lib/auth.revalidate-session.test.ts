import { beforeEach, describe, expect, it, vi } from "vitest";

// Estado de la tabla users que verá el middleware (id → isActive).
let usersInDb: Record<string, number> = {};
const selectSpy = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          selectSpy();
          return Object.entries(usersInDb).map(([id, isActive]) => ({ id, isActive }));
        },
      }),
    }),
  },
  projectsTable: {},
  usersTable: { id: "id", isActive: "is_active" },
}));

import { requireAdmin, requireAuth, revalidateSession } from "./auth";

type Sess = Record<string, unknown> & { regenerate: (cb: (err?: unknown) => void) => void };

function makeReq(session: Record<string, unknown>) {
  const regenerate = vi.fn((cb: (err?: unknown) => void) => {
    // express-session: la sesión vieja se borra del store y req.session pasa a
    // ser una sesión nueva vacía (mismo comportamiento que simulamos aquí).
    for (const k of Object.keys(req.session)) if (k !== "regenerate") delete (req.session as Record<string, unknown>)[k];
    cb();
  });
  const req = { session: { ...session, regenerate } as Sess } as any;
  return req;
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

async function run(req: any) {
  const res = makeRes();
  const next = vi.fn();
  await revalidateSession(req, res, next);
  return { res, next };
}

beforeEach(() => { usersInDb = {}; selectSpy.mockClear(); });

describe("revalidateSession", () => {
  it("deja pasar peticiones anónimas sin consultar la BD", async () => {
    const req = makeReq({});
    const { next } = await run(req);
    expect(next).toHaveBeenCalledOnce();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("mantiene la sesión de un usuario existente y activo", async () => {
    usersInDb = { u1: 1 };
    const req = makeReq({ userId: "u1", role: "client" });
    const { next } = await run(req);
    expect(next).toHaveBeenCalledOnce();
    expect(req.session.regenerate).not.toHaveBeenCalled();
    expect(req.session.userId).toBe("u1");
  });

  it("carrera login/borrado: una sesión guardada tras el DELETE queda inválida en la siguiente petición", async () => {
    // El login leyó el usuario antes del DELETE y persistió la sesión después:
    // la cookie existe pero el usuario ya no. Debe responder 401 en requireAuth.
    const req = makeReq({ userId: "deleted", role: "client", clientId: "42" });
    const { next } = await run(req);
    expect(next).toHaveBeenCalledOnce();
    expect(req.session.regenerate).toHaveBeenCalledOnce();
    expect(req.session.userId).toBeUndefined();

    const res = makeRes();
    const after = vi.fn();
    requireAuth(req, res, after);
    expect(after).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("un usuario desactivado también pierde la sesión (403 en rutas admin)", async () => {
    usersInDb = { u2: 0 };
    const req = makeReq({ userId: "u2", role: "admin" });
    await run(req);
    expect(req.session.userId).toBeUndefined();
    const res = makeRes();
    requireAdmin(req, res, vi.fn());
    expect(res.statusCode).toBe(403);
  });

  it("con impersonación (ambos endpoints /api/admin/impersonate y /api/auth/impersonate guardan el id del cliente suplantado), si ese cliente fue borrado la sesión entera se invalida", async () => {
    usersInDb = { admin1: 1 }; // el cliente "gone" ya no existe
    const req = makeReq({ userId: "admin1", role: "client", impersonating: "gone", clientId: "7" });
    await run(req);
    expect(req.session.regenerate).toHaveBeenCalledOnce();
    expect(req.session.userId).toBeUndefined();
  });

  it("si la BD falla no deja pasar la petición como válida", async () => {
    const boom = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = await import("@workspace/db");
    const orig = db.select;
    (db as any).select = () => ({ from: () => ({ where: async () => { throw new Error("db down"); } }) });
    const req = makeReq({ userId: "u1", role: "client" });
    const { res, next } = await run(req);
    (db as any).select = orig;
    boom.mockRestore();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });
});
