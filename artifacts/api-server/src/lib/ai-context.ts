import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";

/**
 * Contexto de la petición para el gasto de IA: a qué proyecto se imputa cada
 * llamada (aunque la función de IA no reciba projectId) y quién la dispara.
 */
export interface AiRequestContext {
  projectId: number | null;
  actor: "client" | "admin" | "public";
}

const store = new AsyncLocalStorage<AiRequestContext>();

export function currentAiContext(): AiRequestContext | undefined {
  return store.getStore();
}

export function currentAiProjectId(): number | null {
  return store.getStore()?.projectId ?? null;
}

export function runWithAiContext<T>(ctx: AiRequestContext, fn: () => T): T {
  return store.run(ctx, fn);
}

function positiveInt(v: unknown): number | null {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Cliente: siempre su propio proyecto (session.clientId). Admin: el proyecto de
 * la ruta (/projects/:id/…) o el projectId del cuerpo/consulta. Sin sesión: público.
 */
export function aiContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const session = req.session as { role?: string; clientId?: unknown } | undefined;
  let ctx: AiRequestContext;
  if (session?.role === "client") {
    ctx = { projectId: positiveInt(session.clientId), actor: "client" };
  } else if (session?.role === "admin") {
    const fromPath = /\/projects\/(\d+)(?:\/|$)/.exec(req.path)?.[1];
    const body = req.body as Record<string, unknown> | undefined;
    ctx = {
      projectId: positiveInt(fromPath) ?? positiveInt(body?.projectId) ?? positiveInt((req.query as Record<string, unknown>).projectId),
      actor: "admin",
    };
  } else {
    ctx = { projectId: null, actor: "public" };
  }
  store.run(ctx, () => next());
}
