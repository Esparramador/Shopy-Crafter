import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Returns true if the session can access the given project.
 * Admin (role='admin') can always access. Regular users can only access
 * projects belonging to their `clientId`.
 *
 * IMPORTANT: this is the canonical access check. All routes that operate on
 * a specific project MUST use either this function or the
 * `requireProjectAccess` middleware below.
 */
export async function canAccessProject(
  sessionRole: string | undefined,
  sessionClientId: string | number | null | undefined,
  projectId: number,
): Promise<boolean> {
  if (sessionRole === "admin") return true;
  if (sessionClientId === null || sessionClientId === undefined) return false;
  const [project] = await db
    .select({ clientId: projectsTable.clientId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!project) return false;
  // clientId may be number or string depending on schema; normalize to string compare
  return String(project.clientId) === String(sessionClientId);
}

/**
 * Express middleware that:
 * 1. Requires an authenticated session (`req.session.userId`).
 * 2. Extracts `projectId` from `req.params.projectId`.
 * 3. Verifies the session can access that project via `canAccessProject`.
 *
 * Use it on every route under `/projects/:projectId/*` that returns or
 * mutates project-scoped data.
 */
export const requireProjectAccess: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const session = req.session as { userId?: string; role?: string; clientId?: string | number | null } | undefined;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const raw = req.params.projectId;
  if (raw === undefined) {
    res.status(400).json({ error: "projectId requerido en la URL" });
    return;
  }
  const projectId = parseInt(String(raw), 10);
  if (isNaN(projectId) || projectId <= 0) {
    res.status(400).json({ error: "projectId inválido" });
    return;
  }
  const ok = await canAccessProject(session.role, session.clientId, projectId);
  if (!ok) {
    res.status(403).json({ error: "Sin acceso a este proyecto" });
    return;
  }
  next();
};
