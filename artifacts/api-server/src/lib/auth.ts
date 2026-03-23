import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId || req.session.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requireClientAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.session.role === "admin") {
    next();
    return;
  }
  if (req.session.role === "client") {
    const projectId = req.params["projectId"] || req.params["id"];
    if (!projectId) { res.status(400).json({ error: "Missing project ID" }); return; }
    if (req.session.clientId === projectId) {
      next();
      return;
    }
    res.status(403).json({ error: "Access denied to this store" });
    return;
  }
  res.status(403).json({ error: "Forbidden" });
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "admin" | "client";
    clientId: string | null;
    name: string;
    email: string;
    impersonating?: string;
  }
}
