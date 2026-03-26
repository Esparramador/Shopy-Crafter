import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, auditLogTable, rateLimitsTable } from "@workspace/db";
import { eq, lt, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { recordAudit } from "../lib/audit.helper.js";
import { logger } from "../lib/logger.js";

const router = Router();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

async function getRateLimit(key: string): Promise<{ count: number; blockedUntil: Date | null }> {
  try {
    const [row] = await db.select().from(rateLimitsTable).where(eq(rateLimitsTable.key, key));
    if (!row) return { count: 0, blockedUntil: null };
    return { count: row.count, blockedUntil: row.blockedUntil };
  } catch {
    return { count: 0, blockedUntil: null };
  }
}

async function incrementRateLimit(key: string): Promise<void> {
  try {
    const blockedUntil = new Date(Date.now() + RATE_LIMIT_WINDOW_MS);
    await db.insert(rateLimitsTable)
      .values({ key, count: 1, blockedUntil, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: rateLimitsTable.key,
        set: {
          count: sql`${rateLimitsTable.count} + 1`,
          blockedUntil,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    logger.error({ err, key }, "Failed to increment rate limit");
  }
}

async function clearRateLimit(key: string): Promise<void> {
  try {
    await db.delete(rateLimitsTable).where(eq(rateLimitsTable.key, key));
  } catch {}
}

async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    await db.delete(rateLimitsTable).where(lt(rateLimitsTable.blockedUntil, new Date()));
  } catch {}
}

setInterval(() => { cleanupExpiredRateLimits().catch(() => {}); }, 5 * 60 * 1000);

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const ip = req.ip ?? "unknown";
  const rateLimitKey = `login:${ip}`;

  const limits = await getRateLimit(rateLimitKey);
  if (limits.count >= RATE_LIMIT_MAX && limits.blockedUntil && limits.blockedUntil > new Date()) {
    const mins = Math.ceil((limits.blockedUntil.getTime() - Date.now()) / 60000);
    res.status(429).json({ error: `Demasiados intentos. Espera ${mins} minuto(s).` });
    return;
  }

  await new Promise((r) => setTimeout(r, 200));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user || !user.isActive) {
    await incrementRateLimit(rateLimitKey);
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    await incrementRateLimit(rateLimitKey);
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  await clearRateLimit(rateLimitKey);

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.clientId = user.clientId ?? null;
  req.session.name = user.name;
  req.session.email = user.email;

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  await recordAudit({
    userId: user.id,
    action: "login",
    details: `Login desde ${ip}`,
    ipAddress: ip,
  });

  res.json({ success: true, role: user.role, name: user.name, clientId: user.clientId });
});

router.post("/logout", (req, res): void => {
  const userId = req.session.userId;
  const ip = req.ip ?? "unknown";
  if (userId) {
    recordAudit({ userId, action: "logout", details: `Logout desde ${ip}`, ipAddress: ip }).catch(() => {});
  }
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

  let storeName: string | null = null;
  let shopDomain: string | null = null;
  if (user.clientId) {
    try {
      const { projectsTable } = await import("@workspace/db");
      const [project] = await db.select({
        name: projectsTable.name,
        shopDomain: projectsTable.shopDomain,
      }).from(projectsTable).where(eq(projectsTable.id, Number(user.clientId)));
      storeName = project?.name ?? null;
      shopDomain = project?.shopDomain ?? null;
    } catch {}
  }

  res.json({
    name: user.name,
    email: user.email,
    projectId: user.clientId,
    storeName,
    shopDomain,
    expiresAt: user.inviteExpires,
  });
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

  await recordAudit({
    userId: user.id,
    action: "invite_setup",
    details: "Cliente configuró su cuenta via invitación",
    ipAddress: req.ip ?? "unknown",
  });

  res.json({ success: true, role: user.role, clientId: user.clientId });
});

router.post("/stop-impersonate", requireAuth, async (req, res): Promise<void> => {
  const adminId = req.session.userId!;
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, adminId));

  if (!admin || admin.role !== "admin") {
    res.status(403).json({ error: "Solo el administrador puede detener la impersonación" });
    return;
  }

  const impersonatedId = req.session.impersonating;
  req.session.role = "admin";
  req.session.clientId = null;
  req.session.name = admin.name;
  delete req.session.impersonating;

  await recordAudit({
    userId: adminId,
    action: "stop_impersonation",
    details: `Dejó de impersonar usuario ${impersonatedId}`,
    ipAddress: req.ip ?? "unknown",
  });

  res.json({ success: true });
});

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

  await recordAudit({
    userId: user.id,
    action: "password_changed",
    details: "Contraseña cambiada por el usuario",
    ipAddress: req.ip ?? "unknown",
  });

  res.json({ success: true, message: "Contraseña actualizada correctamente" });
});

router.post("/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email: string };
  if (!email) { res.status(400).json({ error: "Email requerido" }); return; }

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (user && user.isActive) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db.update(usersTable).set({
      resetToken: token,
      resetExpires: expires,
    }).where(eq(usersTable.id, user.id));

    const klaviyoKey = process.env.KLAVIYO_API_KEY;
    if (klaviyoKey) {
      const appUrl = process.env.APP_URL ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://shopycrafter.com");
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

    await recordAudit({
      userId: user.id,
      action: "forgot_password",
      details: `Solicitud de reset de contraseña para ${email}`,
      ipAddress: req.ip ?? "unknown",
    });
  }

  res.json({ success: true, message: "Si el email existe, recibirás un enlace de recuperación." });
});

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

  await recordAudit({
    userId: user.id,
    action: "password_reset",
    details: "Contraseña restablecida via token",
    ipAddress: req.ip ?? "unknown",
  });

  res.json({ success: true, message: "Contraseña actualizada correctamente" });
});

export default router;
