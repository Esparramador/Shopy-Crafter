import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, auditLogTable, approvalsTable, messagesTable, projectsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/users", async (req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    clientId: usersTable.clientId,
    isActive: usersTable.isActive,
    avatarColor: usersTable.avatarColor,
    lastLogin: usersTable.lastLogin,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users);
});

router.post("/users", async (req, res): Promise<void> => {
  const { email, name, role, clientId, password } = req.body as {
    email: string; name: string; role: "admin" | "client";
    clientId?: string; password?: string;
  };

  // Solo se puede crear el rol "client" desde aquí — el único admin es sadiagiljoan@gmail.com
  const safeRole: "admin" | "client" = role === "admin" ? "client" : role;

  const id = randomBytes(16).toString("hex");
  const hashed = await bcrypt.hash(password ?? randomBytes(16).toString("hex"), 12);

  await db.insert(usersTable).values({
    id, email: email.toLowerCase().trim(), password: hashed, name, role: safeRole,
    clientId: clientId ?? null, isActive: 1,
  });

  await db.insert(auditLogTable).values({
    id: randomBytes(8).toString("hex"),
    userId: req.session.userId!,
    action: "create_user",
    details: `Created user ${email} (${safeRole})`,
  });

  res.json({ id, email, name, role: safeRole });
});

// ─── GET /admin/projects-list — for invite modal dropdown ────────────────────
router.get("/projects-list", async (_req, res): Promise<void> => {
  const projects = await db.select({
    id: projectsTable.id,
    name: projectsTable.name,
    shopDomain: projectsTable.shopDomain,
    storeNiche: projectsTable.storeNiche,
  }).from(projectsTable).orderBy(desc(projectsTable.createdAt));
  res.json(projects);
});

router.post("/projects/:projectId/invite", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { email, name } = req.body as { email: string; name: string };

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (existing) {
    await db.update(usersTable).set({
      clientId: projectId,
      inviteToken: token,
      inviteExpires: expires,
      isActive: 0,
    }).where(eq(usersTable.id, existing.id));
  } else {
    const id = randomBytes(16).toString("hex");
    const tempPw = await bcrypt.hash(randomBytes(16).toString("hex"), 12);
    await db.insert(usersTable).values({
      id, email: email.toLowerCase(), password: tempPw, name,
      role: "client", clientId: projectId,
      inviteToken: token, inviteExpires: expires, isActive: 0,
    });
  }

  // Fetch the project to include shop info in the response
  const [project] = await db.select({
    id: projectsTable.id,
    name: projectsTable.name,
    shopDomain: projectsTable.shopDomain,
  }).from(projectsTable).where(eq(projectsTable.id, Number(projectId)));

  const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0];
  const replitDev = process.env.REPLIT_DEV_DOMAIN;
  const baseUrl = process.env.APP_URL
    ?? (replitDomains ? `https://${replitDomains}` : null)
    ?? (replitDev ? `https://${replitDev}` : null)
    ?? "http://localhost:3000";
  const inviteLink = `${baseUrl}/invite/${token}`;

  await db.insert(auditLogTable).values({
    id: randomBytes(8).toString("hex"),
    userId: req.session.userId!,
    projectId,
    action: "invite_client",
    details: `Invited ${email} to project ${projectId} (${project?.shopDomain ?? "unknown"})`,
  });

  res.json({
    success: true,
    inviteLink,
    storeName: project?.name ?? null,
    shopDomain: project?.shopDomain ?? null,
    message: `Enlace de invitación creado para ${email} — tienda: ${project?.shopDomain ?? projectId}`,
  });
});

router.post("/users/:userId/deactivate", async (req, res): Promise<void> => {
  await db.update(usersTable).set({ isActive: 0 }).where(eq(usersTable.id, req.params["userId"]!));
  res.json({ success: true });
});

router.post("/users/:userId/activate", async (req, res): Promise<void> => {
  await db.update(usersTable).set({ isActive: 1 }).where(eq(usersTable.id, req.params["userId"]!));
  res.json({ success: true });
});

router.post("/users/:userId/reset-password", async (req, res): Promise<void> => {
  const { password } = req.body as { password: string };
  const hashed = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, req.params["userId"]!));
  res.json({ success: true });
});

router.post("/impersonate/:userId", async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params["userId"]!));
  if (!user || user.role !== "client") { res.status(400).json({ error: "Invalid user" }); return; }
  req.session.impersonating = user.id;
  req.session.role = "client";
  req.session.clientId = user.clientId;
  req.session.name = user.name;
  res.json({ success: true, clientId: user.clientId });
});

router.get("/audit-log", async (req, res): Promise<void> => {
  const logs = await db.select().from(auditLogTable)
    .orderBy(desc(auditLogTable.createdAt)).limit(100);
  res.json(logs);
});

router.get("/projects/:projectId/approvals", async (_req, res): Promise<void> => {
  const { projectId } = _req.params;
  const items = await db.select().from(approvalsTable)
    .where(eq(approvalsTable.projectId, projectId))
    .orderBy(desc(approvalsTable.createdAt));
  res.json(items);
});

router.post("/projects/:projectId/approvals", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { type, title, description, beforeValue, afterValue, reasoning, estimatedImpact } = req.body as {
    type: string; title: string; description: string;
    beforeValue?: string; afterValue?: string; reasoning?: string; estimatedImpact?: string;
  };
  const id = randomBytes(16).toString("hex");
  await db.insert(approvalsTable).values({
    id, projectId, type, title, description, beforeValue, afterValue, reasoning, estimatedImpact,
  });
  res.json({ id });
});

router.get("/projects/:projectId/messages", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.projectId, projectId))
    .orderBy(messagesTable.createdAt);
  res.json(msgs);
});

router.post("/projects/:projectId/messages", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { content } = req.body as { content: string };
  const id = randomBytes(16).toString("hex");
  await db.insert(messagesTable).values({
    id, projectId, fromRole: "admin", fromName: req.session.name ?? "Admin", content,
  });
  res.json({ id });
});

export default router;
