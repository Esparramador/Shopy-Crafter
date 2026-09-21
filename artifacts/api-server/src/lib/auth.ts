import type { Request, Response, NextFunction } from "express";
import { db, projectsTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

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
  if (projectId === 0) {
    next();
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


/**
 * Middleware global (montado justo después de express-session): una sesión solo
 * es válida mientras su usuario siga existiendo y activo. Si el usuario fue
 * borrado o desactivado — aunque la sesión se haya creado en paralelo al
 * borrado — se destruye aquí y la petición continúa como anónima, de modo que
 * requireAuth/requireAdmin responden 401/403. Con impersonación se exige lo
 * mismo del cliente suplantado.
 */
export async function revalidateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) { next(); return; }
  const ids = req.session.impersonating ? [userId, req.session.impersonating] : [userId];
  try {
    const rows = await db.select({ id: usersTable.id, isActive: usersTable.isActive })
      .from(usersTable).where(inArray(usersTable.id, ids));
    const alive = new Set(rows.filter(r => r.isActive).map(r => r.id));
    if (ids.every(id => alive.has(id))) { next(); return; }
  } catch (err) {
    res.status(500).json({ error: "Session validation failed" });
    return;
  }
  // regenerate (no destroy): borra la sesión del store y deja req.session como
  // objeto vacío, así el código posterior que lee req.session.userId no revienta.
  req.session.regenerate((err) => {
    if (err) { res.status(500).json({ error: "Session validation failed" }); return; }
    next();
  });
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
