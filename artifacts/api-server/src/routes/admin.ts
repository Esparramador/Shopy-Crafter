import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, auditLogTable, approvalsTable, messagesTable, projectsTable, platformSettingsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { encrypt, safeDecrypt } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

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

  let emailSent = false;
  const klaviyoKey = process.env.KLAVIYO_API_KEY;
  if (klaviyoKey) {
    try {
      const klaviyoRes = await fetch("https://a.klaviyo.com/api/events/", {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${klaviyoKey}`,
          "Content-Type": "application/json",
          "revision": "2024-02-15",
        },
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              properties: {
                clientName: name,
                shopDomain: project?.shopDomain ?? "",
                storeName: project?.name ?? "",
                inviteUrl: inviteLink,
                agencyName: "ShopyBrain",
                expiresIn: "48 horas",
              },
              metric: { data: { type: "metric", attributes: { name: "Client Invite" } } },
              profile: { data: { type: "profile", attributes: { email: email.toLowerCase(), first_name: name } } },
            },
          },
        }),
      });
      emailSent = klaviyoRes.ok;
      if (!klaviyoRes.ok) {
        logger.warn({ status: klaviyoRes.status }, "Klaviyo invite email failed — link still generated");
      }
    } catch (err) {
      logger.warn({ err }, "Klaviyo invite email error — link still generated");
    }
  }

  res.json({
    success: true,
    inviteLink,
    storeName: project?.name ?? null,
    shopDomain: project?.shopDomain ?? null,
    emailSent,
    message: emailSent
      ? `Invitación enviada por email a ${email} — tienda: ${project?.shopDomain ?? projectId}`
      : `Enlace de invitación creado para ${email} — tienda: ${project?.shopDomain ?? projectId}. Envía el enlace manualmente.`,
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

router.get("/unread-messages", async (_req, res): Promise<void> => {
  const rows = await db.select({
    projectId: messagesTable.projectId,
    count: sql<number>`count(*)::int`,
  }).from(messagesTable)
    .where(and(eq(messagesTable.fromRole, "client"), eq(messagesTable.isRead, 0)))
    .groupBy(messagesTable.projectId);
  const total = rows.reduce((s, r) => s + r.count, 0);
  res.json({ total, byProject: rows });
});

router.get("/projects/:projectId/messages", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.projectId, projectId))
    .orderBy(messagesTable.createdAt);

  await db.update(messagesTable).set({ isRead: 1 })
    .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.fromRole, "client")));

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

// ─── Shopify OAuth Platform Configuration ────────────────────────────────────
router.get("/shopify-config", async (_req, res): Promise<void> => {
  const rows = await db.select().from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, "shopify_client_id"))
    .limit(1);
  const secretRow = await db.select().from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, "shopify_client_secret"))
    .limit(1);

  const envClientId = process.env.SHOPIFY_CLIENT_ID ?? "";
  const envClientSecret = process.env.SHOPIFY_CLIENT_SECRET ?? "";

  const dbClientId = rows[0]?.value ?? "";
  const dbClientSecret = secretRow[0]?.value ? safeDecrypt(secretRow[0].value) : "";

  const clientId = dbClientId || envClientId;
  const clientSecret = dbClientSecret || envClientSecret;
  const configured = !!(clientId && clientSecret);

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const appUrl = domain ? `https://${domain}` : (process.env.APP_URL ?? "http://localhost:8080");
  const callbackUrl = `${appUrl}/api/shopify/oauth/callback`;

  res.json({
    configured,
    clientIdPreview: clientId ? `${clientId.slice(0, 8)}••••••••` : null,
    callbackUrl,
    source: dbClientId ? "database" : (envClientId ? "environment" : "none"),
  });
});

router.put("/shopify-config", async (req, res): Promise<void> => {
  const { clientId, clientSecret } = req.body as { clientId: string; clientSecret: string };
  if (!clientId || !clientSecret) {
    res.status(400).json({ error: "clientId y clientSecret son obligatorios" });
    return;
  }

  await db.insert(platformSettingsTable)
    .values({ key: "shopify_client_id", value: clientId.trim() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: clientId.trim(), updatedAt: new Date() } });

  await db.insert(platformSettingsTable)
    .values({ key: "shopify_client_secret", value: encrypt(clientSecret.trim()) })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: encrypt(clientSecret.trim()), updatedAt: new Date() } });

  res.json({ success: true, message: "Credenciales de Shopify OAuth guardadas correctamente" });
});

export default router;
