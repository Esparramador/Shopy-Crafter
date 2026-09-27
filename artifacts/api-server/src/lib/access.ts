import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Returns true if the session can access the given project.
 * Admin (role='admin') can always access. A client can only access the project
 * it was invited to: `users.client_id` (→ `session.clientId`) holds that
 * project's id.
 *
 * Ojo: `projects.client_id` NO identifica al cliente — es el client_id OAuth de
 * Shopify / consumer key de WooCommerce. Compararlo con la sesión (como se hacía)
 * negaba el acceso a todo cliente invitado.
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
  if (sessionRole !== "client") return false;
  if (!clientOwnsProjectId(sessionClientId, projectId)) return false;
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  return !!project;
}

/** `session.clientId` de un cliente es el id del proyecto al que fue invitado. */
export function clientOwnsProjectId(
  sessionClientId: string | number | null | undefined,
  projectId: number,
): boolean {
  if (sessionClientId === null || sessionClientId === undefined || sessionClientId === "") return false;
  const assigned = Number(sessionClientId);
  return Number.isInteger(assigned) && assigned > 0 && assigned === projectId;
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
  if (isNaN(projectId) || projectId < 0) {
    res.status(400).json({ error: "projectId inválido" });
    return;
  }
  if (projectId === 0) {
    next();
    return;
  }
  const ok = await canAccessProject(session.role, session.clientId, projectId);
  if (!ok) {
    res.status(403).json({ error: "Sin acceso a este proyecto" });
    return;
  }
  next();
};
