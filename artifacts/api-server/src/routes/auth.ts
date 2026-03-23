import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, auditLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const loginAttempts = new Map<string, { count: number; until: number }>();

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const ip = req.ip ?? "unknown";

  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.count >= 5 && Date.now() < attempts.until) {
    const mins = Math.ceil((attempts.until - Date.now()) / 60000);
    res.status(429).json({ error: `Demasiados intentos. Espera ${mins} minuto(s).` });
    return;
  }

  await new Promise((r) => setTimeout(r, 200));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user || !user.isActive) {
    const cur = loginAttempts.get(ip) ?? { count: 0, until: 0 };
    cur.count += 1;
    cur.until = Date.now() + 15 * 60 * 1000;
    loginAttempts.set(ip, cur);
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const cur = loginAttempts.get(ip) ?? { count: 0, until: 0 };
    cur.count += 1;
    cur.until = Date.now() + 15 * 60 * 1000;
    loginAttempts.set(ip, cur);
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  loginAttempts.delete(ip);

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.clientId = user.clientId ?? null;
  req.session.name = user.name;
  req.session.email = user.email;

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  await db.insert(auditLogTable).values({
    id: randomBytes(16).toString("hex"),
    userId: user.id,
    action: "login",
    details: `Login desde ${ip}`,
    ipAddress: ip,
  });

  res.json({ success: true, role: user.role, name: user.name, clientId: user.clientId });
});

router.post("/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    clientId: usersTable.clientId,
    avatarColor: usersTable.avatarColor,
  }).from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json({ ...user, impersonating: req.session.impersonating ?? null });
});

router.get("/invite/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.inviteToken, token));

  if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
    res.status(410).json({ error: "Enlace expirado o inválido" });
    return;
  }

  res.json({ name: user.name, email: user.email, projectId: user.clientId });
});

router.post("/invite/:token/setup", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { password } = req.body as { password: string };

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.inviteToken, token));

  if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
    res.status(410).json({ error: "Enlace expirado o inválido" });
    return;
  }

  if (!password || password.length < 8) {
    res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({
    password: hashed,
    isActive: 1,
    inviteToken: null,
    inviteExpires: null,
  }).where(eq(usersTable.id, user.id));

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.clientId = user.clientId ?? null;
  req.session.name = user.name;
  req.session.email = user.email;

  res.json({ success: true, role: user.role, clientId: user.clientId });
});

export default router;
