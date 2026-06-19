import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { db, usersTable, auditLogTable, approvalsTable, messagesTable, projectsTable, platformSettingsTable, productsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { encrypt, safeDecrypt } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { recordAudit } from "../lib/audit.helper.js";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { askClaude } from "../lib/claude.js";
import { sendPushToClientByProject } from "../lib/push-helper.js";
import { msgUpload, msgUploadMulti } from "../lib/msg-uploads.js";

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
  
    // Solo se puede crear el rol "client" desde aquí — el único admin es craftershopy@gmail.com
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
    sendPushToClientByProject(
      projectId,
      "📋 Nueva propuesta de tu agencia",
      `${title} — Revísala en Aprobaciones`,
      "/client/approvals"
    ).catch(() => {});
    res.json({ id });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/ai-suggest", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const pid = parseInt(projectId);
    if (isNaN(pid)) { res.status(400).json({ error: "Invalid projectId" }); return; }

    const products = await db.select({
      id: productsTable.id,
      title: productsTable.title,
      price: productsTable.price,
      auditScore: productsTable.auditScore,
      auditGrade: productsTable.auditGrade,
    }).from(productsTable)
      .where(eq(productsTable.projectId, pid))
      .orderBy(productsTable.auditScore)
      .limit(20);

    if (!products.length) {
      res.json({ suggestions: [] });
      return;
    }

    const productList = products.slice(0, 15)
      .map(p => `- "${p.title}" | Precio: €${p.price ?? "?"} | Score: ${p.auditScore ?? "—"}${p.auditGrade ? ` (${p.auditGrade})` : ""}`)
      .join("\n");

    const prompt = `Eres un experto en optimización de tiendas Shopify. Analiza estos productos y genera exactamente 4 propuestas de mejora concretas y accionables.

PRODUCTOS DEL CLIENTE:
${productList}

Genera propuestas en formato JSON exactamente así (sin texto adicional antes o después):
{
  "suggestions": [
    {
      "type": "seo_update",
      "title": "Título conciso de la propuesta",
      "description": "Descripción detallada del cambio propuesto con ejemplos concretos",
      "beforeValue": "valor actual (texto o precio actual)",
      "afterValue": "valor propuesto (texto o precio nuevo)",
      "reasoning": "Por qué este cambio mejorará los resultados, basado en los datos",
      "estimatedImpact": "Impacto cuantificado esperado (ej: +15% clics orgánicos)"
    }
  ]
}

Tipos válidos: "seo_update", "price_change", "product_update", "strategy".
Prioriza los productos con score más bajo. Responde SOLO con el JSON.`;

    const reply = await askClaude(pid, [{ role: "user", content: prompt }], undefined, 900);
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) { res.json({ suggestions: [] }); return; }
    try {
      const parsed = JSON.parse(match[0]);
      res.json({ suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] });
    } catch {
      res.json({ suggestions: [] });
    }
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
    const result = await db.execute(sql`
      SELECT id,
             project_id    AS "projectId",
             from_role     AS "fromRole",
             from_name     AS "fromName",
             content,
             is_read       AS "isRead",
             created_at    AS "createdAt",
             file_url      AS "fileUrl",
             file_name     AS "fileName",
             file_type     AS "fileType",
             file_size     AS "fileSize",
             files_json    AS "filesJson"
      FROM messages
      WHERE project_id = ${projectId}
      ORDER BY created_at ASC
    `);
    await db.execute(sql`
      UPDATE messages SET is_read = 1
      WHERE project_id = ${projectId} AND from_role = 'client'
    `);
    res.json((result as any).rows ?? result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/messages/upload", msgUpload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    const { originalname, mimetype, size, filename } = req.file;
    res.json({
      fileUrl: `/api/msg-uploads/${filename}`,
      fileName: originalname,
      fileType: mimetype,
      fileSize: size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/messages/upload-multi", msgUploadMulti.array("files", 20), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) { res.status(400).json({ error: "No files provided" }); return; }
    const result = files.map(f => ({
      fileUrl: `/api/msg-uploads/${f.filename}`,
      fileName: f.originalname,
      fileType: f.mimetype,
      fileSize: f.size,
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/messages", async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { content, fileUrl, fileName, fileType, fileSize, filesJson } = req.body as {
      content?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number;
      filesJson?: Array<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }> | null;
    };
    const hasFiles = !!(fileUrl || (filesJson && filesJson.length > 0));
    if (!content?.trim() && !hasFiles) { res.status(400).json({ error: "Content or file required" }); return; }
    const id = randomBytes(16).toString("hex");
    const adminName = req.session.name ?? "Tu agencia";
    const filesJsonVal = filesJson && filesJson.length > 0 ? JSON.stringify(filesJson) : null;
    await db.execute(sql`
      INSERT INTO messages (id, project_id, from_role, from_name, content, file_url, file_name, file_type, file_size, files_json)
      VALUES (
        ${id}, ${projectId}, 'admin', ${adminName},
        ${content ?? null}, ${fileUrl ?? null}, ${fileName ?? null}, ${fileType ?? null}, ${fileSize ?? null},
        ${filesJsonVal}::jsonb
      )
    `);
    const preview = content?.trim()
      ? (content.length > 80 ? content.slice(0, 77) + "…" : content)
      : `📎 ${fileName ?? "Archivo adjunto"}`;
    sendPushToClientByProject(projectId, `💬 Mensaje de ${adminName}`, preview, "/client/messages").catch(() => {});
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
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
    const CHROMIUM_STATIC_PATHS = [
      process.env.CHROMIUM_PATH,
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
      "/usr/local/bin/chromium",
    ].filter(Boolean) as string[];
    const chromiumFoundInPath = (() => {
      try { execSync("which chromium-browser || which chromium || which google-chrome", { stdio: "pipe", timeout: 2000 }); return true; } catch { return false; }
    })();
    const chromiumConfigured = has("CHROMIUM_PATH", "PUPPETEER_EXECUTABLE_PATH") || CHROMIUM_STATIC_PATHS.some(p => existsSync(p)) || chromiumFoundInPath;

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

// POST /api/admin/mcp/install — install a new MCP server package
router.post("/mcp/install", async (req, res): Promise<void> => {
  try {
    const { npmPackage } = req.body as { npmPackage?: string };
    if (!npmPackage || typeof npmPackage !== "string") {
      res.status(400).json({ error: "npmPackage requerido" }); return;
    }
    // Security: only allow valid npm package names (no shell injection)
    if (!/^[@a-zA-Z0-9_\-./]+$/.test(npmPackage) || npmPackage.includes("..") || npmPackage.includes(";") || npmPackage.includes("&")) {
      res.status(400).json({ error: "Nombre de paquete inválido" }); return;
    }
    logger.info({ npmPackage }, "MCP install requested");

    try {
      const output = execSync(`pnpm add -w "${npmPackage}" 2>&1`, {
        cwd: "/home/runner/workspace",
        timeout: 120_000,
        encoding: "utf8",
      });
      res.json({ ok: true, output: output.slice(0, 2000) });
    } catch (e: any) {
      const msg = (e?.stdout || e?.stderr || e?.message || "install failed").slice(0, 2000);
      res.status(500).json({ error: msg });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

// GET /api/admin/mcp/status — check if npm packages are installed
router.get("/mcp/status", (_req, res): Promise<void> => {
  const packagesToCheck = [
    "@octokit/mcp-server", "@notionhq/notion-mcp-server", "@hubspot/mcp-server",
    "@sentry/mcp-server", "figma-mcp", "@playwright/mcp", "mcp-server-postgres", "@slack/mcp-server",
  ];
  const status: Record<string, boolean> = {};
  for (const pkg of packagesToCheck) {
    try {
      const safePkg = pkg.replace(/[^a-zA-Z0-9@/_\-.]/g, "");
      execSync(`node -e "require.resolve('${safePkg}')"`, { stdio: "pipe", timeout: 5000 });
      status[pkg] = true;
    } catch {
      status[pkg] = false;
    }
  }
  res.json({ status });
  return Promise.resolve();
});

export default router;
