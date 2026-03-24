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

// ─── STOP IMPERSONATION ──────────────────────────────────────────────────────
router.post("/stop-impersonate", requireAuth, async (req, res): Promise<void> => {
  const adminId = req.session.userId!;
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, adminId));

  if (!admin || admin.role !== "admin") {
    res.status(403).json({ error: "Solo el administrador puede detener la impersonación" });
    return;
  }

  req.session.role = "admin";
  req.session.clientId = null;
  req.session.name = admin.name;
  delete req.session.impersonating;

  res.json({ success: true });
});

// ─── CHANGE PASSWORD (autenticado) ───────────────────────────────────────────
router.post("/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Contraseña actual y nueva son obligatorias" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    res.status(401).json({ error: "La contraseña actual no es correcta" });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));

  await db.insert(auditLogTable).values({
    id: randomBytes(16).toString("hex"),
    userId: user.id,
    action: "password_changed",
    details: "Contraseña cambiada por el usuario",
    ipAddress: req.ip ?? "unknown",
  });

  res.json({ success: true, message: "Contraseña actualizada correctamente" });
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email: string };
  if (!email) { res.status(400).json({ error: "Email requerido" }); return; }

  // Always respond OK to prevent email enumeration
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.update(usersTable).set({
      resetToken: token,
      resetExpires: expires,
    }).where(eq(usersTable.id, user.id));

    // Send via Klaviyo if available
    const klaviyoKey = process.env.KLAVIYO_API_KEY;
    if (klaviyoKey) {
      const appUrl = process.env.APP_URL ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://shopycrafter.replit.app");
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      try {
        await fetch("https://a.klaviyo.com/api/events/", {
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
                properties: { resetUrl, userName: user.name, expireMinutes: 60 },
                metric: { data: { type: "metric", attributes: { name: "Password Reset Requested" } } },
                profile: { data: { type: "profile", attributes: { email: user.email } } },
              },
            },
          }),
        });
      } catch (err) {
        req.log?.warn({ err }, "Klaviyo password reset email failed");
      }
    }

    req.log?.info({ userId: user.id }, "Password reset token generated");
  }

  res.json({ success: true, message: "Si el email existe, recibirás un enlace de recuperación." });
});

// ─── RESET PASSWORD ──────────────────────────────────────────────────────────
router.post("/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token: string; password: string };

  if (!token || !password) {
    res.status(400).json({ error: "Token y contraseña requeridos" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    return;
  }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.resetToken, token));

  if (!user || !user.resetExpires || user.resetExpires < new Date()) {
    res.status(410).json({ error: "El enlace ha expirado o no es válido" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({
    password: hashed,
    resetToken: null,
    resetExpires: null,
  }).where(eq(usersTable.id, user.id));

  await db.insert(auditLogTable).values({
    id: randomBytes(16).toString("hex"),
    userId: user.id,
    action: "password_reset",
    details: "Contraseña restablecida via token",
    ipAddress: req.ip ?? "unknown",
  });

  res.json({ success: true, message: "Contraseña actualizada correctamente" });
});

export default router;
