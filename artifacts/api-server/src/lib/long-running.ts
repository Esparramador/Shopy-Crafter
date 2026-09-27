import type { Request, Response, NextFunction } from "express";

const HEARTBEAT_INTERVAL_MS = 25_000;

export interface LongRunningHandle {
  stop: () => void;
}

function isBinaryContentType(value: string | number | string[] | undefined): boolean {
  if (!value) return false;
  const ct = String(Array.isArray(value) ? value[0] : value).toLowerCase();
  return (
    ct.startsWith("application/pdf") ||
    ct.startsWith("application/zip") ||
    ct.startsWith("application/octet-stream") ||
    ct.startsWith("application/vnd.openxmlformats") ||
    ct.startsWith("application/vnd.ms-") ||
    ct.startsWith("image/") ||
    ct.startsWith("audio/") ||
    ct.startsWith("video/") ||
    ct.startsWith("font/") ||
    ct.startsWith("text/csv")
  );
}

/**
 * Mark a response as long-running so the upstream proxy (Replit/nginx) does
 * not kill the socket at ~60s of inactivity. Sends a single space character
 * every 25s to keep the connection alive — JSON parsers ignore leading
 * whitespace so the final response is unaffected.
 *
 * DUAL MODE: Works as both direct call `enableLongRunning(res)` AND as
 * Express middleware `router.post("/path", enableLongRunning, handler)`.
 * Detects which mode by checking if the first argument has `setHeader`.
 *
 * IMPORTANT: Patches res.json/res.status so they work correctly even after
 * heartbeat has already sent headers (status 200 + Content-Type: application/json).
 */
export function enableLongRunning(resOrReq: Response | Request, resOrNext?: Response | NextFunction, next?: NextFunction): LongRunningHandle {
  let res: Response;
  if (typeof (resOrReq as any).setHeader === "function" && !resOrNext) {
    res = resOrReq as Response;
  } else if (resOrNext && typeof (resOrNext as any).setHeader === "function") {
    res = resOrNext as Response;
    const handle = _applyLongRunning(res);
    if (typeof next === "function") next();
    return handle;
  } else {
    res = resOrReq as Response;
  }
  return _applyLongRunning(res);
}

function _applyLongRunning(res: Response): LongRunningHandle {
  res.setHeader("X-No-Compression", "1");
  // El frontend (lib/long-running-fetch.ts) usa esta marca para recuperar el
  // código de error real cuando llega en el cuerpo (ver __httpStatus abajo).
  res.setHeader("X-Long-Running", "1");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");

  // Pre-set JSON Content-Type so heartbeat can flush " " bytes safely.
  // Routes that produce binary output MUST set their Content-Type BEFORE
  // calling enableLongRunning() so this guard skips the JSON default.
  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }

  let stopped = false;
  // Status pedido DESPUÉS del primer latido: la cabecera ya salió con 200, así
  // que el código real viaja en el cuerpo como __httpStatus (antes se perdía y
  // un error tras 25 s llegaba como éxito HTTP 200).
  let lateStatus: number | null = null;

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  (res as any).json = function patchedJson(body: any) {
    if (res.headersSent) {
      try {
        if (lateStatus !== null && lateStatus >= 400 && body && typeof body === "object" && !Array.isArray(body)) {
          body = { ...body, __httpStatus: lateStatus };
        }
        const payload = JSON.stringify(body);
        res.write(payload);
        res.end();
      } catch {
        res.end();
      }
      return res;
    }
    return originalJson(body);
  };

  (res as any).status = function patchedStatus(code: number) {
    if (res.headersSent) {
      lateStatus = code;
      return res;
    }
    return originalStatus(code);
  };

  const interval = setInterval(() => {
    if (stopped || res.writableEnded || res.destroyed || !res.writable) {
      clearInterval(interval);
      return;
    }
    const ct = res.getHeader("Content-Type");
    // Skip heartbeat for binary responses entirely (corrupts download).
    if (isBinaryContentType(ct)) {
      clearInterval(interval);
      return;
    }
    // Defer heartbeat if Content-Type isn't set yet — sending " " would
    // commit headers without proper content type. Wait for the route to
    // either set JSON CT or finish naturally.
    if (!ct) {
      return;
    }
    try {
      res.write(" ");
      const flushFn = (res as unknown as { flush?: () => void }).flush;
      if (typeof flushFn === "function") flushFn.call(res);
    } catch {
      clearInterval(interval);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
  };

  res.on("finish", stop);
  res.on("close", stop);
  res.on("error", stop);

  return { stop };
}
