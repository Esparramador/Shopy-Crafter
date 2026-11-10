/**
 * Los estudios (Fusion Studio, Generador Universal…) informan al cerebro al terminar.
 *
 * No cambian su lógica: trackStudioRun() se engancha al principio del handler, mira
 * lo que el handler responde (res.json) y, cuando la respuesta sale, registra en
 * brain_events la entrada y el resultado con el canal `studio-<nombre>`. Así el
 * panel «Cerebro» ve también lo que se hace desde los estudios.
 */
import type { Request, Response } from "express";
import type { BrainGate } from "./catalog.js";
import { recordBrainEvent, type BrainActionRef } from "./events.js";

export interface StudioReport {
  /** Nombre corto del estudio: el canal será `studio-<studio>`. */
  studio: string;
  /** Qué se pidió (prompt, tipo de generación…), en una línea. */
  input?: string | null;
  /** La operación del estudio, p. ej. "generate-video". */
  operation: string;
  params?: Record<string, unknown>;
  ok: boolean;
  detail?: string | null;
  gate?: BrainGate;
  userId?: string | number | null;
  projectId?: number | null;
  durationMs?: number | null;
}

/** Registra en el cerebro lo que hizo un estudio. Nunca lanza (recordBrainEvent tampoco). */
export function reportToBrain(r: StudioReport): Promise<number | null> {
  const action: BrainActionRef = { action: r.operation.slice(0, 80), params: r.params };
  return recordBrainEvent({
    gate: r.gate ?? "admin",
    channel: `studio-${r.studio}`.slice(0, 60),
    userId: r.userId ?? null,
    projectId: r.projectId ?? null,
    input: r.input ?? null,
    kind: "execute",
    actions: [action],
    status: r.ok ? "ok" : "error",
    detail: r.detail ?? null,
    durationMs: r.durationMs ?? null,
  });
}

/** Resumen corto de lo que respondió el estudio (sin data URIs ni textos enormes). */
export function summarizeStudioResult(body: unknown, statusCode: number): string | null {
  if (!body || typeof body !== "object") return statusCode >= 400 ? `HTTP ${statusCode}` : null;
  const b = body as Record<string, unknown>;
  if (statusCode >= 400 || b.success === false) {
    const err = typeof b.error === "string" ? b.error : typeof b.message === "string" ? b.message : `HTTP ${statusCode}`;
    return err.slice(0, 300);
  }
  if (typeof b.message === "string") return b.message.slice(0, 300);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (k === "success") continue;
    if (Array.isArray(v)) parts.push(`${k}: ${v.length}`);
    else if (typeof v === "number" || typeof v === "boolean") parts.push(`${k}: ${v}`);
    else if (typeof v === "string" && v.length <= 80 && !v.startsWith("data:")) parts.push(`${k}: ${v}`);
    if (parts.length >= 6) break;
  }
  return parts.length ? parts.join(" · ") : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Llamar al principio del handler. Cuando la respuesta termina, informa al cerebro
 * con el código HTTP y lo que se mandó por res.json. La puerta sale de la sesión:
 * un cliente que usa el estudio queda como «client», el resto como «admin».
 */
export function trackStudioRun(req: Request, res: Response, opts: {
  studio: string;
  operation: string;
  input?: (req: Request) => string | null | undefined;
  params?: (req: Request) => Record<string, unknown> | undefined;
}): void {
  const started = Date.now();
  let body: unknown;
  const originalJson = res.json.bind(res);
  res.json = ((payload: unknown) => { body = payload; return originalJson(payload); }) as Response["json"];

  let reported = false;
  const report = (closedEarly: boolean) => {
    if (reported) return;
    reported = true;
    const session = (req.session ?? {}) as { userId?: string | number; role?: string };
    const rawProject = Number.parseInt(String((req.body as Record<string, unknown> | undefined)?.projectId ?? ""), 10);
    const ok = !closedEarly && res.statusCode < 400 && !(body && typeof body === "object" && (body as { success?: unknown }).success === false);
    let input: string | undefined;
    let params: Record<string, unknown> | undefined;
    try { input = str(opts.input?.(req) ?? undefined); } catch { input = undefined; }
    try { params = opts.params?.(req); } catch { params = undefined; }
    void reportToBrain({
      studio: opts.studio,
      operation: opts.operation,
      input,
      params,
      ok,
      detail: closedEarly ? "La conexión se cerró antes de terminar" : summarizeStudioResult(body, res.statusCode),
      gate: session.role === "client" ? "client" : "admin",
      userId: session.userId ?? null,
      projectId: Number.isFinite(rawProject) && rawProject > 0 ? rawProject : null,
      durationMs: Date.now() - started,
    });
  };
  res.once("finish", () => report(false));
  res.once("close", () => { if (!res.writableFinished) report(true); });
}
