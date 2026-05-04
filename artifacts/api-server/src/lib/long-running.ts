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
  // Disable gzip/brotli for this response so heartbeat whitespace is not
  // buffered by the compression middleware (the upstream proxy needs to see
  // bytes within ~60s or it kills the socket and the client gets a 502).
  res.setHeader("X-No-Compression", "1");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");

  let stopped = false;

  const interval = setInterval(() => {
    if (stopped || res.writableEnded || res.destroyed || !res.writable) {
      clearInterval(interval);
      return;
    }
    // Skip heartbeat if the handler is sending binary content — a stray space
    // would corrupt PDFs/ZIPs/images. The proxy timeout still resets on the
    // first real chunk written, so binaries up to the proxy's idle limit work.
    if (isBinaryContentType(res.getHeader("Content-Type"))) {
      clearInterval(interval);
      return;
    }
    if (res.headersSent) {
      try {
        res.write(" ");
        const flushFn = (res as unknown as { flush?: () => void }).flush;
        if (typeof flushFn === "function") flushFn.call(res);
      } catch {
        clearInterval(interval);
      }
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
