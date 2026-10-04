import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import { db, usersTable, auditLogTable, approvalsTable, messagesTable, projectsTable, platformSettingsTable, productsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { encrypt, safeDecrypt } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { recordAudit } from "../lib/audit.helper.js";
import { deleteClientUser } from "../lib/user-deletion.js";
import { cancelClientSubscription } from "../lib/subscription-cancel.js";
import { getKlaviyoHeaders } from "../lib/klaviyo-headers.js";
import { askClaudeDetailed } from "../lib/claude.js";
import { generateAiJson } from "../lib/ai-json.js";
import { aiOutputErrorMessage, isAiOutputError } from "../lib/ai-errors.js";
import { z } from "zod";
import { newAccountToken, publicAppUrl } from "../lib/account-tokens.js";
import { sendEmail, isGmailAvailable } from "../lib/gmail.js";
import { sanitizeHtml } from "../lib/html-escape.js";

// Propuestas de mejora (ai-suggest). Antes: 900 tokens para 4 propuestas detalladas
// (se cortaba) y cualquier fallo devolvía [], que el panel mostraba como "no hay
// productos, sincroniza la tienda".
const aiSuggestionsSchema = z.object({
  suggestions: z.array(z.object({
    type: z.enum(["seo_update", "price_change", "product_update", "strategy"]).catch("strategy"),
    title: z.string().min(1),
    description: z.string().min(1),
    beforeValue: z.string().default(""),
    afterValue: z.string().default(""),
    reasoning: z.string().default(""),
    estimatedImpact: z.string().default(""),
  })).min(1),
});
import { sendPushToClientByProject } from "../lib/push-helper.js";
import { checkMessageAttachments, msgUpload, msgUploadMulti } from "../lib/msg-uploads.js";

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

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120),
  clientId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[1-9]\d*$/)).optional(),
  password: z.string().min(8).max(200).optional(),
});

router.post("/users", async (req, res): Promise<void> => {
  try {
    const parsed = createUserSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Email válido, nombre y contraseña de 8+ caracteres (si se indica) son obligatorios" });
      return;
    }
    const { email, name, clientId, password } = parsed.data;
  
    // Solo se puede crear el rol "client" desde aquí (antes un role ausente o
    // arbitrario llegaba tal cual a la BD).
    const safeRole = "client" as const;
    if (clientId) {
      const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, Number(clientId)));
      if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    }
  
    const [dup] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (dup) { res.status(409).json({ error: "Ya existe un usuario con ese email" }); return; }

    const id = randomBytes(16).toString("hex");
    const hashed = await bcrypt.hash(password ?? randomBytes(16).toString("hex"), 12);
  
    await db.insert(usersTable).values({
      id, email, password: hashed, name, role: safeRole,
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
      platformType: projectsTable.platformType,
    }).from(projectsTable).orderBy(desc(projectsTable.createdAt));
    res.json(projects);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120),
});

function inviteEmailHtml(p: { name: string; storeName: string; shopDomain: string; link: string }): string {
  const e = sanitizeHtml;
  const store = p.storeName || p.shopDomain;
  return `<!doctype html><html><body style="margin:0;background:#0d0d1a;font-family:Arial,sans-serif;color:#e8e6e1">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#13131f;border:1px solid #2a2a3a;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:22px;color:#c9a961">Hola ${e(p.name)},</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Te han invitado a acceder al portal de Shopy Crafter${store ? ` para la tienda <strong>${e(store)}</strong>` : ""}.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">Pulsa el botón para crear tu contraseña y entrar. El enlace caduca en 48 horas y solo puede usarse una vez.</p>
<p style="text-align:center;margin:0 0 24px"><a href="${e(p.link)}" style="display:inline-block;background:#c9a961;color:#0d0d1a;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px">Activar mi cuenta</a></p>
<p style="font-size:12px;color:#8a8898;line-height:1.5;margin:0">Si el botón no funciona, copia este enlace en el navegador:<br><span style="word-break:break-all">${e(p.link)}</span></p>
<p style="font-size:12px;color:#8a8898;margin:16px 0 0">Si no esperabas esta invitación, ignora este correo.</p>
</td></tr></table></td></tr></table></body></html>`;
}

/** Clientes con acceso al portal de este proyecto (para enviarles o renovar su enlace). */
router.get("/projects/:projectId/clients", async (req, res): Promise<void> => {
  try {
    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) { res.status(400).json({ error: "Proyecto inválido" }); return; }
    const rows = await db.select({
      id: usersTable.id, email: usersTable.email, name: usersTable.name,
      isActive: usersTable.isActive, lastLogin: usersTable.lastLogin, inviteExpires: usersTable.inviteExpires,
    }).from(usersTable).where(and(eq(usersTable.clientId, String(projectId)), eq(usersTable.role, "client")));
    res.json({ clients: rows, portalUrl: `${publicAppUrl() ?? `${req.protocol}://${req.get("host")}`}/login` });
  } catch (err: any) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/projects/:projectId/invite", async (req, res): Promise<void> => {
  try {
    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Proyecto inválido" });
      return;
    }
    const parsed = inviteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Email válido y nombre son obligatorios" });
      return;
    }
    const { email, name } = parsed.data;

    const [project] = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      shopDomain: projectsTable.shopDomain,
    }).from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    // Invitar el email de un administrador lo desactivaba (isActive=0) y lo
    // convertía en "cliente" de la tienda sin cambiarle el rol: bloqueo del admin.
    if (existing && existing.role !== "client") {
      res.status(409).json({ error: "Ese email pertenece a un administrador; usa otro email para el cliente" });
      return;
    }

    const { token, stored } = newAccountToken();
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    if (existing) {
      // Cliente ya existente: se le asigna esta tienda y un enlace nuevo. Si ya
      // tenía la cuenta activa la conserva (antes se le desactivaba y perdía el
      // acceso hasta volver a abrir el enlace).
      await db.update(usersTable).set({
        clientId: String(projectId),
        inviteToken: stored,
        inviteExpires: expires,
      }).where(eq(usersTable.id, existing.id));
    } else {
      const id = randomBytes(16).toString("hex");
      const tempPw = await bcrypt.hash(randomBytes(16).toString("hex"), 12);
      await db.insert(usersTable).values({
        id, email, password: tempPw, name,
        role: "client", clientId: String(projectId),
        inviteToken: stored, inviteExpires: expires, isActive: 0,
      });
    }

    const baseUrl = publicAppUrl() ?? `${req.protocol}://${req.get("host")}`;
    const inviteLink = `${baseUrl}/invite/${token}`;

    await db.insert(auditLogTable).values({
      id: randomBytes(8).toString("hex"),
      userId: req.session.userId!,
      projectId: String(projectId),
      action: "invite_client",
      details: `Invited ${email} to project ${projectId} (${project.shopDomain ?? "unknown"})`,
    });

    // Envío real por Gmail (plantilla propia). Klaviyo solo registra un evento
    // "Client Invite": el correo sale únicamente si hay un flow activo sobre esa
    // métrica, así que no se presenta como "email enviado".
    let emailSent = false;
    let klaviyoEvent = false;
    if (isGmailAvailable()) {
      emailSent = await sendEmail(
        email,
        `Tu acceso a Shopy Crafter${project.name ? ` — ${project.name}` : ""}`,
        inviteEmailHtml({ name, storeName: project.name ?? "", shopDomain: project.shopDomain ?? "", link: inviteLink }),
      );
    }
    if (!emailSent && process.env.KLAVIYO_API_KEY) {
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
                  shopDomain: project.shopDomain ?? "",
                  storeName: project.name ?? "",
                  inviteUrl: inviteLink,
                  agencyName: "Shopy Crafter",
                  expiresIn: "48 horas",
                },
                metric: { data: { type: "metric", attributes: { name: "Client Invite" } } },
                profile: { data: { type: "profile", attributes: { email, first_name: name } } },
              },
            },
          }),
        });
        klaviyoEvent = klaviyoRes.ok;
        if (!klaviyoRes.ok) {
          logger.warn({ status: klaviyoRes.status }, "Klaviyo invite event failed — link still generated");
        }
      } catch (err) {
        logger.warn({ err }, "Klaviyo invite event error — link still generated");
      }
    }

    const store = project.shopDomain ?? project.name ?? String(projectId);
    res.json({
      success: true,
      inviteLink,
      storeName: project.name ?? null,
      shopDomain: project.shopDomain ?? null,
      emailSent,
      klaviyoEvent,
      message: emailSent
        ? `Invitación enviada por email a ${email} — tienda: ${store}`
        : klaviyoEvent
          ? `Enlace creado y evento "Client Invite" enviado a Klaviyo para ${email} — el correo solo sale si tienes un flow activo sobre esa métrica. Envía el enlace manualmente si no.`
          : `Enlace de invitación creado para ${email} — tienda: ${store}. No hay email configurado: envía el enlace manualmente.`,
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

// Borrado definitivo de un usuario de rol "client" (reglas y limpieza en lib/user-deletion.ts).
router.delete("/users/:userId", async (req, res): Promise<void> => {
  try {
    const targetId = req.params["userId"]!;
    const result = await deleteClientUser(targetId, req.session.userId!);
    if (!result.ok) {
      const { ok: _ok, status, ...body } = result;
      res.status(status).json(body);
      return;
    }
    await recordAudit({
      userId: req.session.userId!,
      action: "delete_user",
      details: `Deleted user ${targetId} (${result.deleted.email})`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true, deleted: result.deleted });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// Cancela en Stripe (inmediato) la suscripción que bloquea el borrado de un cliente.
router.post("/users/:userId/cancel-subscription", async (req, res): Promise<void> => {
  try {
    const targetId = req.params["userId"]!;
    const result = await cancelClientSubscription(targetId, req.session.userId!);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, stripeDashboardUrl: result.stripeDashboardUrl });
      return;
    }
    if (result.localUpdated) {
      await recordAudit({
        userId: req.session.userId!,
        action: "cancel_subscription",
        details: `${result.alreadyCanceled ? "Confirmed canceled" : "Canceled"} Stripe subscription ${result.stripeSubscriptionId} for user ${targetId}`,
        ipAddress: req.ip ?? "unknown",
      });
    }
    res.json({ success: true, alreadyCanceled: result.alreadyCanceled, stripeSubscriptionId: result.stripeSubscriptionId, status: result.status });
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

    const parsed = await generateAiJson({
      prompt,
      maxTokens: 2500,
      schema: aiSuggestionsSchema,
      expect: "object",
      label: "admin/ai-suggest",
      call: async ({ prompt: p, maxTokens }) => {
        const r = await askClaudeDetailed(pid, [{ role: "user", content: p }], undefined, maxTokens);
        return { text: r.text, truncated: r.truncated };
      },
    });
    res.json({ suggestions: parsed.suggestions });
  } catch (err: any) {
    if (isAiOutputError(err)) { res.status(502).json({ error: aiOutputErrorMessage(err), code: err.code }); return; }
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
    if (filesJson !== undefined && filesJson !== null && !Array.isArray(filesJson)) { res.status(400).json({ error: "filesJson inválido" }); return; }
    const attachErr = checkMessageAttachments(Number(projectId), req.session.role, [fileUrl, ...(filesJson ?? []).map(f => f?.fileUrl)]);
    if (attachErr) { res.status(400).json({ error: attachErr }); return; }
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
    const githubConfigured = has("GITHUB_TOKEN") || has("GITHUB_API_TOKEN");
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
            envVars: ["GITHUB_TOKEN"],
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
        GITHUB_TOKEN: env("GITHUB_TOKEN") || env("GITHUB_API_TOKEN"),
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

// Paquetes MCP que el panel conoce (los del MCP Manager). Solo estos se pueden
// instalar desde el panel: `pnpm add` ejecuta scripts de instalación, así que
// aceptar cualquier nombre equivalía a ejecución remota de código.
const MCP_PACKAGES = [
  "@modelcontextprotocol/server-filesystem", "@modelcontextprotocol/server-memory",
  "@upstash/context7-mcp", "puppeteer-mcp-server", "@modelcontextprotocol/server-everything",
  "@octokit/mcp-server", "@notionhq/notion-mcp-server", "@hubspot/mcp-server",
  "@sentry/mcp-server", "figma-mcp", "@playwright/mcp", "mcp-server-postgres", "@slack/mcp-server",
];
const MCP_ENV_VARS = ["STITCH_API_KEY"];

/** Nombre sin versión: "@scope/pkg@1.2.3" → "@scope/pkg". */
function mcpPackageName(spec: string): string {
  const at = spec.lastIndexOf("@");
  return at > 0 ? spec.slice(0, at) : spec;
}

/** Instalado = existe node_modules/<pkg>/package.json en el cwd o un directorio padre. */
function isPackageInstalled(pkg: string): boolean {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(path.join(dir, "node_modules", pkg, "package.json"))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

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
    if (!MCP_PACKAGES.includes(mcpPackageName(npmPackage))) {
      res.status(400).json({ error: "Paquete no permitido: solo servidores MCP del catálogo" }); return;
    }
    logger.info({ npmPackage }, "MCP install requested");

    // Strip pnpm self-update banners from output (box-drawing chars + "Update available")
    function cleanPnpmOutput(raw: string): string {
      return raw.split('\n')
        .filter(line => {
          const t = line.trim();
          return (
            !t.startsWith('╭') && !t.startsWith('│') && !t.startsWith('╰') &&
            !t.includes('Update available!') &&
            !t.includes('Changelog: https://pnpm.io') &&
            !t.includes('To update run:') &&
            !t.includes('pnpm self-update')
          );
        })
        .join('\n')
        .trim();
    }

    try {
      const raw = execSync(`pnpm add -w "${npmPackage}" 2>&1`, {
        cwd: "/home/runner/workspace",
        timeout: 120_000,
        encoding: "utf8",
      });
      res.json({ ok: true, output: cleanPnpmOutput(raw).slice(0, 2000) });
    } catch (e: any) {
      const raw = (e?.stdout || e?.stderr || e?.message || "install failed");
      const cleaned = cleanPnpmOutput(String(raw));
      // If cleaning removed everything, show a generic message
      const msg = (cleaned.length > 10 ? cleaned : String(raw)).slice(0, 2000);
      res.status(500).json({ error: msg });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Internal error" });
  }
});

// GET /api/admin/mcp/status — paquetes instalados y variables de entorno presentes
router.get("/mcp/status", (_req, res): void => {
  const status: Record<string, boolean> = {};
  for (const pkg of MCP_PACKAGES) status[pkg] = isPackageInstalled(pkg);
  const env: Record<string, boolean> = {};
  for (const name of MCP_ENV_VARS) env[name] = Boolean(process.env[name]?.trim());
  res.json({ status, env });
});

export default router;
