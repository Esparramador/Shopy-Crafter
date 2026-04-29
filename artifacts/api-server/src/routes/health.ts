import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

interface ErrorReportBody {
  reportId?: string;
  context?: string;
  name?: string;
  message?: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
}

const recentReports = new Map<string, number[]>();
const REPORT_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 30;

function isReportRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (recentReports.get(ip) ?? []).filter((t) => now - t < REPORT_WINDOW_MS);
  if (arr.length >= MAX_REPORTS_PER_WINDOW) {
    recentReports.set(ip, arr);
    return true;
  }
  arr.push(now);
  recentReports.set(ip, arr);
  return false;
}

router.post("/error-report", async (req, res): Promise<void> => {
  try {
    const ip =
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";

    if (isReportRateLimited(ip)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    const body = (req.body ?? {}) as ErrorReportBody;
    const sanitized = {
      reportId: String(body.reportId ?? "").slice(0, 64),
      context: String(body.context ?? "unknown").slice(0, 64),
      name: String(body.name ?? "Error").slice(0, 64),
      message: String(body.message ?? "").slice(0, 500),
      stack: String(body.stack ?? "").slice(0, 4000),
      componentStack: String(body.componentStack ?? "").slice(0, 2000),
      url: String(body.url ?? "").slice(0, 500),
      userAgent: String(body.userAgent ?? "").slice(0, 200),
      timestamp: String(body.timestamp ?? new Date().toISOString()).slice(0, 32),
      ip,
    };

    logger.error({ frontend: true, ...sanitized }, "Frontend error reported");
    res.json({ ok: true, reportId: sanitized.reportId });
  } catch (err) {
    logger.error({ err }, "Failed to record frontend error report");
    res.status(200).json({ ok: false });
  }
});

export default router;
