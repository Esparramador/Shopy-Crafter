import type { Request, Response, NextFunction } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Middleware: requires that the request's `:projectId` (or `:id`) param
 * corresponds to a project owned by the currently logged-in client.
 * Admin role is always allowed. Verifica project.clientId vs session.clientId.
 */
export async function requireProjectAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.session.role === "admin") {
    next();
    return;
  }
  if (req.session.role !== "client") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const projectIdRaw = req.params["projectId"] || req.params["id"];
  if (!projectIdRaw) {
    res.status(400).json({ error: "Missing project ID" });
    return;
  }
  const projectId = parseInt(String(projectIdRaw), 10);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }
  try {
    const [project] = await db.select({ clientId: projectsTable.clientId })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (project.clientId !== req.session.clientId) {
      res.status(403).json({ error: "Access denied to this project" });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Project access check failed" });
  }
}


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
