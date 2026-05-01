import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, usersTable, auditLogTable, approvalsTable, messagesTable, projectsTable, platformSettingsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { encrypt, safeDecrypt } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { recordAudit } from "../lib/audit.helper.js";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";

const router = Router();
router.use(requireAdmin);

router.get("/users", async (_req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/users", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── GET /admin/projects-list — for invite modal dropdown ────────────────────
router.get("/projects-list", async (_req, res): Promise<void> => {
  try {
    const projects = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      shopDomain: projectsTable.shopDomain,
      storeNiche: projectsTable.storeNiche,
      clientId: projectsTable.clientId,
      plan: projectsTable.plan,
    }).from(projectsTable).orderBy(desc(projectsTable.createdAt));
    res.json(projects);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/invite", async (req, res): Promise<void> => {
  try {
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
  
    const replitDev = process.env.REPLIT_DEV_DOMAIN;
    const baseUrl = process.env.APP_URL
      ?? (replitDev ? `https://${replitDev}` : null)
      ?? "https://shopycrafter.com";
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
          headers: getKlaviyoHeaders(),
          body: JSON.stringify({
            data: {
              type: "event",
              attributes: {
                properties: {
                  clientName: name,
                  shopDomain: project?.shopDomain ?? "",
                  storeName: project?.name ?? "",
                  inviteUrl: inviteLink,
                  agencyName: "Shopy Crafter",
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/users/:userId/deactivate", async (req, res): Promise<void> => {
  try {
    const targetId = req.params["userId"]!;
    await db.update(usersTable).set({ isActive: 0 }).where(eq(usersTable.id, targetId));
    await recordAudit({
      userId: req.session.userId!,
      action: "deactivate_user",
      details: `Deactivated user ${targetId}`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/users/:userId/activate", async (req, res): Promise<void> => {
  try {
    const targetId = req.params["userId"]!;
    await db.update(usersTable).set({ isActive: 1 }).where(eq(usersTable.id, targetId));
    await recordAudit({
      userId: req.session.userId!,
      action: "activate_user",
      details: `Activated user ${targetId}`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/users/:userId/reset-password", async (req, res): Promise<void> => {
  try {
    const targetId = req.params["userId"]!;
    const { password } = req.body as { password: string };
    const hashed = await bcrypt.hash(password, 12);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, targetId));
    await recordAudit({
      userId: req.session.userId!,
      action: "admin_reset_password",
      details: `Admin reset password for user ${targetId}`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/impersonate/:userId", async (req, res): Promise<void> => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params["userId"]!));
    if (!user || user.role !== "client") { res.status(400).json({ error: "Invalid user" }); return; }
    req.session.impersonating = user.id;
    req.session.role = "client";
    req.session.clientId = user.clientId;
    req.session.name = user.name;
    await recordAudit({
      userId: req.session.userId!,
      action: "impersonate",
      details: `Started impersonating user ${user.id} (${user.email})`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true, clientId: user.clientId });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/audit-log", async (_req, res): Promise<void> => {
  try {
    const logs = await db.select().from(auditLogTable)
      .orderBy(desc(auditLogTable.createdAt)).limit(100);
    res.json(logs);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/approvals", async (_req, res): Promise<void> => {
  try {
    const { projectId } = _req.params;
    const items = await db.select().from(approvalsTable)
      .where(eq(approvalsTable.projectId, projectId))
      .orderBy(desc(approvalsTable.createdAt));
    res.json(items);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/approvals", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/unread-messages", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select({
      projectId: messagesTable.projectId,
      count: sql<number>`count(*)::int`,
    }).from(messagesTable)
      .where(and(eq(messagesTable.fromRole, "client"), eq(messagesTable.isRead, 0)))
      .groupBy(messagesTable.projectId);
    const total = rows.reduce((s, r) => s + r.count, 0);
    res.json({ total, byProject: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/messages", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.projectId, projectId))
      .orderBy(messagesTable.createdAt);
  
    await db.update(messagesTable).set({ isRead: 1 })
      .where(and(eq(messagesTable.projectId, projectId), eq(messagesTable.fromRole, "client")));
  
    res.json(msgs);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/messages", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { content } = req.body as { content: string };
    const id = randomBytes(16).toString("hex");
    await db.insert(messagesTable).values({
      id, projectId, fromRole: "admin", fromName: req.session.name ?? "Admin", content,
    });
    res.json({ id });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─── Shopify OAuth Platform Configuration ────────────────────────────────────
router.get("/shopify-config", async (_req, res): Promise<void> => {
  try {
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
  
    const appUrl = process.env.APP_URL ?? "https://shopycrafter.com";
    const callbackUrl = `${appUrl}/api/shopify/oauth/callback`;
  
    res.json({
      configured,
      clientIdPreview: clientId ? `${clientId.slice(0, 8)}••••••••` : null,
      callbackUrl,
      source: dbClientId ? "database" : (envClientId ? "environment" : "none"),
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.put("/shopify-config", async (req, res): Promise<void> => {
  try {
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
  
    await recordAudit({
      userId: req.session.userId!,
      action: "shopify_config_update",
      details: "Updated Shopify OAuth credentials",
      ipAddress: req.ip ?? "unknown",
    });
  
    res.json({ success: true, message: "Credenciales de Shopify OAuth guardadas correctamente" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/system-capabilities", async (_req, res): Promise<void> => {
  try {
    const has = (...keys: string[]): boolean =>
      keys.some((k) => Boolean(process.env[k] && String(process.env[k]).trim().length > 0));

    const env = (k: string): string => (process.env[k] ? "set" : "missing");

    const dbConfigured = Boolean(process.env.DATABASE_URL);
    const sessionConfigured = Boolean(process.env.SESSION_SECRET);
    const encryptionConfigured = Boolean(process.env.ENCRYPTION_KEY);

    const claudeConfigured = has("ANTHROPIC_API_KEY", "AI_INTEGRATIONS_ANTHROPIC_API_KEY");
    const geminiConfigured = has("GEMINI_API_KEY", "AI_INTEGRATIONS_GEMINI_API_KEY");
    const replicateConfigured = has("REPLICATE_API_TOKEN");
    const elevenConfigured = has("ELEVENLABS_API_KEY");
    const runwayConfigured = has("RUNWAY_API_KEY");

    let shopifyClientConfigured = has("SHOPIFY_CLIENT_ID");
    let shopifySecretConfigured = has("SHOPIFY_CLIENT_SECRET");
    let shopifySource: "environment" | "database" | "missing" = shopifyClientConfigured && shopifySecretConfigured ? "environment" : "missing";
    try {
      const dbRows = await db.select().from(platformSettingsTable);
      const dbClient = dbRows.find(r => r.key === "shopify_client_id");
      const dbSecret = dbRows.find(r => r.key === "shopify_client_secret");
      if (dbClient?.value && dbSecret?.value) {
        shopifyClientConfigured = true;
        shopifySecretConfigured = true;
        if (shopifySource === "missing") shopifySource = "database";
      }
    } catch {
      // si la tabla no existe o falla la query, mantenemos sólo el chequeo de env
    }
    const klaviyoConfigured = has("KLAVIYO_API_KEY");
    const pageSpeedConfigured = has("GOOGLE_PAGESPEED_API_KEY");
    const githubConfigured = has("GITHUB_API_TOKEN");
    const vapidConfigured = has("VAPID_PUBLIC_KEY") && has("VAPID_PRIVATE_KEY");
    const objectStoreConfigured = has("PRIVATE_OBJECT_DIR") || has("PUBLIC_OBJECT_SEARCH_PATHS");
    const chromiumConfigured = has("CHROMIUM_PATH", "PUPPETEER_EXECUTABLE_PATH");

    const claudeModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";
    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const geminiProModel = process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview";

    const categories = [
      {
        id: "ai",
        name: "Motores de Inteligencia Artificial",
        icon: "brain",
        items: [
          {
            key: "claude",
            name: "Anthropic Claude",
            badge: claudeModel,
            description: "Modelo principal de razonamiento, redacción de informes, análisis estratégico y visión.",
            envVars: ["ANTHROPIC_API_KEY", "AI_INTEGRATIONS_ANTHROPIC_API_KEY"],
            configured: claudeConfigured,
            uses: ["Auditoría", "Rediseño IA", "ShopyBrain", "Informes profesionales", "Pricing IA", "Consistencia", "Suppliers"],
          },
          {
            key: "gemini",
            name: "Google Gemini (Flash + Pro)",
            badge: `${geminiModel} / ${geminiProModel}`,
            description: "Búsqueda en tiempo real con grounding, URL context, thinking budget y generación de imágenes Nano Banana.",
            envVars: ["GEMINI_API_KEY", "AI_INTEGRATIONS_GEMINI_API_KEY"],
            configured: geminiConfigured,
            uses: ["Gemini Intelligence", "Entity Research", "Fusion Studio Pro (Nano Banana)", "AdStudio (hero images)"],
          },
          {
            key: "replicate",
            name: "Replicate (SDXL + Whisper + Motion + Lipsync)",
            badge: "multi-model",
            description: "Generación de imágenes SDXL, transcripción Whisper, motion video y sincronización labial.",
            envVars: ["REPLICATE_API_TOKEN"],
            configured: replicateConfigured,
            uses: ["Generador de imágenes", "FusionStudio", "WebLab assets", "Vídeos motion", "Lipsync"],
          },
          {
            key: "elevenlabs",
            name: "ElevenLabs Voice AI",
            badge: "voice synthesis",
            description: "Síntesis de voz multilingüe de alta fidelidad para vídeos, anuncios y dubbing.",
            envVars: ["ELEVENLABS_API_KEY"],
            configured: elevenConfigured,
            uses: ["Vídeos AdStudio", "Voiceovers para campañas", "Audio para storyboards"],
          },
          {
            key: "runway",
            name: "Runway ML Gen-3",
            badge: "video generation",
            description: "Generación de vídeo cinematográfico desde texto e imágenes para motion ads y reels.",
            envVars: ["RUNWAY_API_KEY"],
            configured: runwayConfigured,
            uses: ["AdStudio vídeos premium", "Motion ads", "Reels promocionales"],
          },
        ],
      },
      {
        id: "ecommerce",
        name: "eCommerce y Marketing",
        icon: "store",
        items: [
          {
            key: "shopify",
            name: "Shopify OAuth + Admin API",
            badge: "OAuth 2.0",
            description: "Conexión directa con tiendas Shopify (productos, pedidos, inventario, colecciones, metafields).",
            envVars: ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
            configured: shopifyClientConfigured && shopifySecretConfigured,
            uses: ["Vinculación de tiendas", "Sync productos", "Pricing dinámico", "Inventario", "Forecast"],
          },
          {
            key: "klaviyo",
            name: "Klaviyo Email Marketing",
            badge: "API v2024",
            description: "Sincronización de listas, segmentos y campañas de email automatizadas.",
            envVars: ["KLAVIYO_API_KEY"],
            configured: klaviyoConfigured,
            uses: ["Campañas email", "Segmentación clientes", "Email templates"],
          },
          {
            key: "google-mail",
            name: "Google Mail (Gmail API)",
            badge: "OAuth integration",
            description: "Envío y lectura de email transaccional vía Gmail con integración OAuth gestionada.",
            envVars: [],
            configured: true,
            uses: ["Notificaciones", "Email a clientes", "Outbound campaigns"],
          },
        ],
      },
      {
        id: "performance",
        name: "Performance, SEO y datos externos",
        icon: "gauge",
        items: [
          {
            key: "pagespeed",
            name: "Google PageSpeed Insights",
            badge: "Lighthouse v6",
            description: "Auditoría real de Core Web Vitals, performance, accesibilidad y SEO técnico.",
            envVars: ["GOOGLE_PAGESPEED_API_KEY"],
            configured: pageSpeedConfigured,
            uses: ["Auditoría SEO", "Performance reports", "Web Vitals tracking"],
          },
          {
            key: "github",
            name: "GitHub API",
            badge: "REST + GraphQL",
            description: "Lectura de repositorios para análisis de stack, dependencias y changelog automático.",
            envVars: ["GITHUB_API_TOKEN"],
            configured: githubConfigured,
            uses: ["Stack analysis", "Changelog automation", "Roadmap sync"],
          },
        ],
      },
      {
        id: "infra",
        name: "Infraestructura y plataforma",
        icon: "server",
        items: [
          {
            key: "postgres",
            name: "PostgreSQL + Drizzle ORM",
            badge: "managed",
            description: "Base de datos relacional con session store, audit log, omnicore memories e historial completo.",
            envVars: ["DATABASE_URL"],
            configured: dbConfigured,
            uses: ["Toda la persistencia", "Sessions", "Audit log", "ShopyBrain memories"],
          },
          {
            key: "session",
            name: "Session Store (PostgreSQL)",
            badge: "secure cookies",
            description: "Sesiones cifradas con SESSION_SECRET y cookies httpOnly + same-site.",
            envVars: ["SESSION_SECRET"],
            configured: sessionConfigured,
            uses: ["Login admin", "Login clientes", "Persistencia de sesión"],
          },
          {
            key: "encryption",
            name: "Cifrado de credenciales (AES-256-GCM)",
            badge: "at-rest encryption",
            description: "Encripta tokens, secrets y API keys de cliente con clave maestra.",
            envVars: ["ENCRYPTION_KEY"],
            configured: encryptionConfigured,
            uses: ["Tokens Shopify", "API keys per-project", "Secrets de cliente"],
          },
          {
            key: "vapid",
            name: "Web Push (VAPID)",
            badge: "RFC 8292",
            description: "Notificaciones push web para alertas de jobs, aprobaciones y eventos críticos.",
            envVars: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
            configured: vapidConfigured,
            uses: ["Push notifications admin", "Alertas de aprobaciones"],
          },
          {
            key: "object-storage",
            name: "Object Storage (App Storage)",
            badge: "GCS-compatible",
            description: "Almacenamiento de PDFs generados, imágenes IA, exports ZIP y assets de informes.",
            envVars: ["PRIVATE_OBJECT_DIR", "PUBLIC_OBJECT_SEARCH_PATHS"],
            configured: objectStoreConfigured,
            uses: ["PDFs de informes", "Imágenes IA", "ZIPs de export", "Brand assets"],
          },
          {
            key: "puppeteer",
            name: "Puppeteer + Chromium (PDF engine)",
            badge: "headless render",
            description: "Renderizado de PDFs profesionales para informes, brand briefs y exports.",
            envVars: ["CHROMIUM_PATH", "PUPPETEER_EXECUTABLE_PATH"],
            configured: chromiumConfigured,
            uses: ["PDFs de informes", "Brand briefs", "Exports premium"],
          },
        ],
      },
    ];

    const totalItems = categories.reduce((acc, c) => acc + c.items.length, 0);
    const configuredItems = categories.reduce(
      (acc, c) => acc + c.items.filter((i) => i.configured).length,
      0,
    );

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        total: totalItems,
        configured: configuredItems,
        missing: totalItems - configuredItems,
        coverage: Math.round((configuredItems / totalItems) * 100),
      },
      categories,
      envSnapshot: {
        ANTHROPIC_API_KEY: env("ANTHROPIC_API_KEY"),
        AI_INTEGRATIONS_ANTHROPIC_API_KEY: env("AI_INTEGRATIONS_ANTHROPIC_API_KEY"),
        GEMINI_API_KEY: env("GEMINI_API_KEY"),
        AI_INTEGRATIONS_GEMINI_API_KEY: env("AI_INTEGRATIONS_GEMINI_API_KEY"),
        REPLICATE_API_TOKEN: env("REPLICATE_API_TOKEN"),
        ELEVENLABS_API_KEY: env("ELEVENLABS_API_KEY"),
        RUNWAY_API_KEY: env("RUNWAY_API_KEY"),
        SHOPIFY_CLIENT_ID: env("SHOPIFY_CLIENT_ID"),
        SHOPIFY_CLIENT_SECRET: env("SHOPIFY_CLIENT_SECRET"),
        KLAVIYO_API_KEY: env("KLAVIYO_API_KEY"),
        GOOGLE_PAGESPEED_API_KEY: env("GOOGLE_PAGESPEED_API_KEY"),
        GITHUB_API_TOKEN: env("GITHUB_API_TOKEN"),
        DATABASE_URL: env("DATABASE_URL"),
        SESSION_SECRET: env("SESSION_SECRET"),
        ENCRYPTION_KEY: env("ENCRYPTION_KEY"),
        VAPID_PUBLIC_KEY: env("VAPID_PUBLIC_KEY"),
        VAPID_PRIVATE_KEY: env("VAPID_PRIVATE_KEY"),
        PRIVATE_OBJECT_DIR: env("PRIVATE_OBJECT_DIR"),
        PUBLIC_OBJECT_SEARCH_PATHS: env("PUBLIC_OBJECT_SEARCH_PATHS"),
        CHROMIUM_PATH: env("CHROMIUM_PATH"),
        PUPPETEER_EXECUTABLE_PATH: env("PUPPETEER_EXECUTABLE_PATH"),
      },
      runtime: {
        node: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        env: process.env.NODE_ENV || "development",
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/admin/ai-models
 * Returns the active model per provider+tier, source (db/env/default),
 * and the catalog of known models for the dropdowns. Admin only.
 */
router.get("/ai-models", async (_req, res) => {
  try {
    const { getAIModelMatrix, KNOWN_MODELS } = await import("../lib/ai-models.js");
    const matrix = await getAIModelMatrix();
    res.json({ matrix, catalog: KNOWN_MODELS });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "ai-models read failed" });
  }
});

/**
 * POST /api/admin/ai-models
 * Body: { provider: "claude"|"gemini", tier: "fast"|"smart"|"genius"|"vision", model: string|null }
 * Sets a per-tier override in platform_settings (null clears it). Admin only.
 */
router.post("/ai-models", async (req, res) => {
  try {
    const { provider, tier, model } = (req.body ?? {}) as { provider?: string; tier?: string; model?: string | null };
    if (provider !== "claude" && provider !== "gemini") {
      res.status(400).json({ error: "provider must be 'claude' or 'gemini'" });
      return;
    }
    if (tier !== "fast" && tier !== "smart" && tier !== "genius" && tier !== "vision") {
      res.status(400).json({ error: "tier must be one of fast|smart|genius|vision" });
      return;
    }
    if (model !== null && (typeof model !== "string" || model.trim().length === 0 || model.length > 200)) {
      res.status(400).json({ error: "model must be a non-empty string (≤200 chars) or null to clear" });
      return;
    }
    const { setAIModelOverride, getAIModelMatrix } = await import("../lib/ai-models.js");
    await setAIModelOverride(provider, tier, model);
    const matrix = await getAIModelMatrix();
    res.json({ ok: true, matrix });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "ai-models write failed" });
  }
});

export default router;
