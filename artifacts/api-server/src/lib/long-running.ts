import type { Response } from "express";

export function enableLongRunning(res: Response): void {
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Cache-Control", "no-cache");
}
