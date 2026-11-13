/**
 * brainExecute(): ejecuta una acción del catálogo para una puerta.
 *
 * Es lo que hacía POST /shopybrain/execute-action (validar ids, resolver el
 * proyecto, confirmación de las destructivas, token de Shopify, runner, aprender
 * y guardar en el Vault) más la comprobación de la puerta EN EL SERVIDOR.
 *
 * Cómo llamarla:
 *  - admin (panel, con sesión): pasa `req` y `res`. Muchos runners llaman a
 *    endpoints de admin reenviando la cookie de `req`, y algunos responden ellos
 *    mismos por `res` (resultado { kind: "responded" }). Las destructivas piden
 *    confirmación con token guardado en `req.session`.
 *  - client / public (rutas de cliente, landing, webhooks de voz, workers): SIN
 *    `req` ni `res`. Solo se ejecutan las acciones de GATE_ALLOWLIST de esa puerta,
 *    que no dependen de la cookie de admin (catalog.test.ts lo comprueba). En
 *    client, `projectId` es el de la sesión del cliente y SUSTITUYE al que venga
 *    en params: un cliente nunca actúa sobre otro proyecto. Si a una acción
 *    permitida le hiciera falta la cookie, recibiría una petición vacía (sin
 *    cookie ni sesión) y el endpoint de admin la rechazaría: falla, no escala.
 *
 *    const out = await brainExecute({ action, params, gate: "client", channel: "client_chat",
 *                                     projectId: req.session.clientId, userId, userName });
 *    res.status(out.status).json(out.body);   // kind === "result" siempre sin res
 */
import type { Request, Response } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { learnFromOperation } from "../claude.js";
import { IDEMPOTENCY_KEY_REUSED, type ContactLeadData } from "../contact-idempotency.js";
import { acceptContactLead } from "../contact-lead.js";
import { logger } from "../logger.js";
import { sendPushToAdmins } from "../push-helper.js";
import { requireConfirmation, DESTRUCTIVE_ACTIONS, type ConfirmSession } from "../shopybrain-helpers.js";
import { saveToVault } from "../vault.js";
import { dispatchBrainAction, NOT_HANDLED } from "../../routes/shopybrain/dispatch.js";
import { buildEnrichedLearningContent } from "../../routes/shopybrain/shared.js";
import { isActionAllowed, isNativeAction, type BrainGate, type NativeAction } from "./catalog.js";
import { recordBrainEvent } from "./events.js";

export interface BrainExecuteInput {
  action: string;
  params?: Record<string, unknown> | null;
  gate: BrainGate;
  channel?: string;
  userId?: string | number | null;
  /** Nombre visible de quien pide (mensajes al equipo). */
  userName?: string | null;
  /** client: el proyecto de la sesión (obligatorio y manda sobre params.projectId). */
  projectId?: string | number | null;
  /** public: IP del visitante (límite de leads por IP). */
  ip?: string | null;
  /** Solo admin. */
  req?: Request;
  res?: Response;
}

export type BrainExecuteResult =
  | { kind: "result"; status: number; body: Record<string, unknown> }
  /** El runner ya respondió por `res` (solo admin). */
  | { kind: "responded" };

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "accessToken", "clientSecret", "inviteToken", "apiKey"]);

const SHOPIFY_API_ACTIONS = new Set([
  "store_status", "list_products", "list_all_products", "create_product", "update_product",
  "delete_product", "scan_store", "optimize_product", "optimize_all_products", "redesign_product",
  "bulk_redesign", "change_price", "set_product_status", "list_themes", "audit_theme",
  "read_theme_file", "edit_theme_file", "edit_theme_css", "edit_theme_settings",
  "create_theme_section", "list_theme_files", "generate_all_metas", "fix_all_alt_texts",
  "generate_schemas", "seo_full_audit", "list_collections", "create_collection",
  "auto_collections", "edit_collection", "delete_collection", "get_collection_products",
  "remove_from_collection", "list_pages", "create_page", "design_all_pages", "get_orders",
  "update_product_price", "bulk_update_prices", "update_stock", "bulk_update_stock",
  "sync_catalog_prices", "price_audit", "list_products_with_prices",
  "list_variants", "add_variant", "edit_variant", "delete_variant",
  "inventory_sync", "inventory_sync_orders", "inventory_alerts",
  "bulk_generate_images", "optimize_images", "generate_sitemap",
  "setup_full_store", "copyright_audit", "regenerate_token",
  "fusion_create_product", "audit_page_speed",
]);

const NON_LEARNABLE = new Set([
  "reset_user_password", "create_user", "list_users", "deactivate_user",
  "activate_user", "audit_log", "unread_messages",
]);

const NON_SAVEABLE = new Set([
  "delete_product", "regenerate_token", "get_scopes",
  "read_cms", "update_cms", "update_cms_batch", "reset_cms",
  "inspect_code", "fix_code", "list_source_files",
  "edit_theme_file", "edit_theme_css", "edit_theme_settings",
  "brain_sync", "brain_export",
  "list_users", "reset_user_password", "audit_log", "unread_messages",
  "list_messages", "list_approvals", "list_automations", "list_email_flows",
]);

const redactParams = (p: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!p) return {};
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    safe[k] = SENSITIVE_KEYS.has(k) ? "***REDACTED***" : v;
  }
  return safe;
};

/**
 * Petición «vacía» para runners llamados fuera del panel: sin cookie ni sesión, y
 * una respuesta que no se puede usar (una acción permitida a client/public nunca
 * debe responder por su cuenta).
 */
function detachedHttp(): { req: Request; res: Response } {
  const req = { headers: {}, session: {}, body: {}, query: {}, params: {} } as unknown as Request;
  const unusable = () => { throw new Error("Esta acción solo puede ejecutarse desde el panel de admin"); };
  const res = new Proxy({}, { get: (_t, k) => (k === "headersSent" ? false : unusable) }) as unknown as Response;
  return { req, res };
}

function friendlyErrorFor(action: string, errMsg: string): string {
  if (errMsg.includes("credit balance is too low") || errMsg.includes("insufficient_quota") || errMsg.includes("billing")) {
    return `⚠️ Créditos de IA agotados — La API de Claude (Anthropic) no tiene saldo. Recarga créditos en console.anthropic.com para seguir usando ${action}.`;
  } else if (errMsg.includes("rate_limit") || errMsg.includes("Too many requests")) {
    return `⏳ Límite de velocidad alcanzado — Espera unos segundos e inténtalo de nuevo.`;
  } else if (errMsg.includes("Could not verify API key") || errMsg.includes("authentication_error")) {
    return `🔑 Error de autenticación con la API de Claude — Verifica ANTHROPIC_API_KEY en la configuración.`;
  } else if (errMsg.includes("overloaded") || errMsg.includes("529")) {
    return `🔄 El servicio de IA está sobrecargado temporalmente. Inténtalo de nuevo en 1-2 minutos.`;
  }
  return `Error en ${action}: ${errMsg.slice(0, 200)}`;
}

/** Acciones propias de client/public: no usan runners ni la cookie de admin. */
async function runNativeAction(action: NativeAction, params: Record<string, unknown>, input: BrainExecuteInput): Promise<{ status: number; body: Record<string, unknown> }> {
  if (action === "request_team") {
    const projectId = String(params.projectId ?? "");
    const content = typeof params.content === "string" ? params.content.trim().slice(0, 4000) : "";
    if (!projectId || !content) return { status: 400, body: { error: "Falta el texto de la petición" } };
    const title = typeof params.title === "string" && params.title.trim() ? params.title.trim().slice(0, 120) : null;
    const text = `📨 Petición al equipo (vía ShopyBrain)${title ? `: ${title}` : ""}\n\n${content}`;
    const senderName = (input.userName ?? "Cliente").slice(0, 120);
    const id = randomBytes(16).toString("hex");
    // Mismo mensaje que POST /client/messages: lo ve el equipo en Mensajes del proyecto.
    await db.execute(sql`
      INSERT INTO messages (id, project_id, from_role, from_name, content)
      VALUES (${id}, ${projectId}, 'client', ${senderName}, ${text})
    `);
    sendPushToAdmins(`📨 Petición de ${senderName}`, title ?? content.slice(0, 77), "/admin/messages").catch(() => {});
    return { status: 200, body: { success: true, messageId: id, message: "✅ He pasado tu petición al equipo. Te responderán en Mensajes." } };
  }

  // create_lead
  const name = typeof params.name === "string" ? params.name.trim().slice(0, 120) : "";
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase().slice(0, 200) : "";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, body: { error: "Necesito tu nombre y un email válido para abrir la solicitud." } };
  }
  const str = (k: string, max = 2000) => typeof params[k] === "string" && (params[k] as string).trim() ? (params[k] as string).trim().slice(0, max) : null;
  const leadData: ContactLeadData = {
    name,
    email,
    phone: str("phone", 40),
    storeUrl: str("storeUrl", 300),
    niche: str("niche", 120),
    revenue: null,
    services: Array.isArray(params.services) ? params.services.filter((s): s is string => typeof s === "string").slice(0, 20).map(s => s.slice(0, 120)) : [],
    socialMedia: null,
    message: str("message"),
    extraInfo: `Abierta por ShopyBrain (${input.channel ?? "public"})`,
    productImageUrl: null,
    suppliers: null,
    submittedAt: new Date().toISOString(),
  };
  const claim = await acceptContactLead(leadData, { idempotencyKey: randomUUID(), ip: input.ip ?? "brain" });
  if (claim === "rate_limited") return { status: 429, body: { error: "Demasiadas solicitudes. Inténtalo de nuevo más tarde." } };
  if (claim === "key_reused") return { status: 409, body: { code: IDEMPOTENCY_KEY_REUSED, error: "No se pudo registrar la solicitud. Inténtalo de nuevo." } };
  return { status: 200, body: { success: true, message: "✅ Solicitud recibida. El equipo te escribirá y estamos preparando tu Pre-Informe." } };
}

/** Proyecto por defecto «Shopy Crafter» cuando el admin no indica proyecto (como antes). */
async function resolveDefaultProject(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    // Buscar proyecto por defecto existente
    const [existing] = await db.select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable)
      .where(eq(projectsTable.shopDomain, "shopycrafter.internal"))
      .limit(1);
    if (existing) {
      logger.info({ resolvedId: existing.id }, "[execute-action] No projectId — using default 'Shopy Crafter' project");
      return { ...params, projectId: String(existing.id) };
    }
    // Crear proyecto por defecto
    const [created] = await db.insert(projectsTable).values({
      name: "Shopy Crafter",
      platformType: "universal" as const,
      shopDomain: "shopycrafter.internal",
      clientId: "",
      clientSecret: "",
      plan: "admin" as const,
      planRenewsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    }).returning();
    logger.info({ createdId: created!.id }, "[execute-action] No projectId — created default 'Shopy Crafter' project");
    return { ...params, projectId: String(created!.id) };
  } catch (autoCreateErr) {
    logger.warn({ err: autoCreateErr }, "[execute-action] Could not auto-create default project");
    return params;
  }
}

export async function brainExecute(input: BrainExecuteInput): Promise<BrainExecuteResult> {
  const started = Date.now();
  const { action, gate } = input;
  const channel = input.channel ?? gate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let params: Record<string, any> = { ...(input.params ?? {}) };
  const sessionProjectId = parseInt(String(input.projectId ?? ""), 10);

  const done = (status: number, body: Record<string, unknown>, evStatus: "ok" | "failed" | "denied" | "needs_confirmation" | "error"): BrainExecuteResult => {
    void recordBrainEvent({
      gate, channel, userId: input.userId ?? null,
      projectId: Number(params.projectId) > 0 ? Number(params.projectId) : sessionProjectId > 0 ? sessionProjectId : null,
      input: action, kind: "execute", actions: [{ action, params }], status: evStatus,
      detail: evStatus === "ok" ? null : String(body.error ?? body.message ?? "").slice(0, 500) || null,
      durationMs: Date.now() - started,
    });
    return { kind: "result", status, body };
  };

  if (!action) return { kind: "result", status: 400, body: { error: "action requerida" } };

  // ── Puerta: lista blanca en el servidor ──────────────────────────────────────
  // Admin: todo menos las acciones propias de client/public (lo desconocido lo
  // rechaza más abajo con «Acción desconocida», como siempre).
  const allowed = gate === "admin" ? !isNativeAction(action) : isActionAllowed(action, gate);
  if (!allowed) {
    logger.warn({ gate, channel, action }, "ShopyBrain: acción rechazada por permiso de la puerta");
    return done(403, { error: `La acción ${action} no está permitida aquí.` }, "denied");
  }
  if (gate !== "admin") {
    if (input.req || input.res) throw new Error("brainExecute: las puertas client/public se llaman sin req/res");
    if (DESTRUCTIVE_ACTIONS.has(action)) return done(403, { error: `La acción ${action} necesita confirmación del panel de admin.` }, "denied");
  }
  if (gate === "client") {
    if (!(sessionProjectId > 0)) return done(400, { error: "No hay un proyecto asociado a la sesión" }, "failed");
    params.projectId = String(sessionProjectId);
  }

  if (isNativeAction(action)) {
    try {
      const out = await runNativeAction(action, params, input);
      return done(out.status, out.body, out.status < 400 ? "ok" : "failed");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error({ action, gate, error: errMsg }, "ShopyBrain native action failed");
      return done(500, { error: `No se pudo completar ${action}.` }, "error");
    }
  }

  // ── Auto-crear proyecto "Shopy Crafter" cuando no hay projectId (solo admin) ──
  const missingProjectId = !params.projectId || params.projectId === 0 || params.projectId === "0" || params.projectId === "";
  if (gate === "admin" && missingProjectId) params = await resolveDefaultProject(params);

  // Muchas acciones meten ids en la ruta de llamadas internas (localhost + cookie del
  // admin). Un id con "/", "?", "#", "%" o ".." podía llevar a OTRO endpoint de admin.
  const badId = Object.entries(params).find(([k, v]) =>
    /(^id$|Id$|Ids?$|^slug$|^handle$)/.test(k) && typeof v === "string" && /[\/?#%\\]|\.\./.test(v));
  if (badId) return done(400, { error: `Parámetro no válido: ${badId[0]}` }, "failed");

  if (params.projectId && isNaN(parseInt(String(params.projectId)))) {
    const allProjects = await db.select({ id: projectsTable.id, shopDomain: projectsTable.shopDomain }).from(projectsTable).limit(500);
    if (allProjects.length === 1) {
      params.projectId = String(allProjects[0]!.id);
      logger.info({ originalId: params.projectId, resolvedId: allProjects[0]!.id }, "Resolved non-numeric projectId to only available project");
    } else {
      // Solo si el texto contiene el dominio completo (antes bastaba con una letra en común).
      const asked = String(params.projectId).toLowerCase();
      const byDomain = allProjects.find(p => !!p.shopDomain && asked.includes(p.shopDomain.toLowerCase()));
      if (byDomain) {
        params.projectId = String(byDomain.id);
      } else if (allProjects.length > 0) {
        // Antes se usaba el PRIMER proyecto: una acción podía caer en la tienda de otro cliente.
        return done(400, { error: `No sé a qué proyecto te refieres con "${String(params.projectId).slice(0, 60)}". Indica el número de proyecto.` }, "failed");
      } else {
        return done(400, { error: "projectId no válido y no hay proyectos registrados" }, "failed");
      }
    }
  }

  const { req, res } = gate === "admin" && input.req && input.res ? { req: input.req, res: input.res } : detachedHttp();

  try {
    let result: Record<string, unknown> = {};

    // CRIT-6: Confirmación obligatoria para acciones destructivas (centralizado)
    const confirmationGuard = requireConfirmation(params, action, {
      summary:
        `Vas a ejecutar la acción \`${action}\`` +
        (params?.projectId ? ` sobre el proyecto ${params.projectId}` : "") +
        (params?.productId ? `, producto ${params.productId}` : "") +
        (params?.collectionId ? `, colección ${params.collectionId}` : "") +
        (params?.userId ? `, usuario ${params.userId}` : "") +
        ". Esta operación es destructiva o de gran alcance y no se puede deshacer fácilmente.",
    }, req.session as unknown as ConfirmSession);
    if (confirmationGuard) return done(200, confirmationGuard as unknown as Record<string, unknown>, "needs_confirmation");

    // Pre-check: para acciones que requieren la API de Shopify, verificar token
    if (SHOPIFY_API_ACTIONS.has(action) && params?.projectId) {
      const [projCheck] = await db.select({ accessToken: projectsTable.accessToken, tokenExpiresAt: projectsTable.tokenExpiresAt })
        .from(projectsTable).where(eq(projectsTable.id, parseInt(String(params.projectId)))).limit(1);
      if (projCheck) {
        const hasToken = !!projCheck.accessToken;
        const tokenExpired = hasToken && projCheck.tokenExpiresAt ? new Date(projCheck.tokenExpiresAt) < new Date() : false;
        if (!hasToken) {
          return done(200, { error: true, message: `⚠️ **Token de Shopify no configurado**\n\nEsta acción (\`${action}\`) requiere conexión con tu tienda Shopify, pero no hay ningún token de acceso configurado.\n\n👉 Ve a **Configuración → Integración Shopify** para conectar tu tienda.` }, "failed");
        }
        if (tokenExpired) {
          return done(200, { error: true, message: `🔑 **Token de Shopify caducado**\n\nEsta acción (\`${action}\`) requiere acceso a tu tienda Shopify, pero el token ha expirado.\n\n👉 Ve a **Configuración → Integración Shopify** para renovar el token de acceso.\n\n_Las funciones que no necesitan Shopify (informes IA, análisis, gestión de usuarios, CMS, etc.) siguen funcionando normalmente._` }, "failed");
        }
      }
    }

    // Helper: auto-resolve accountId — returns first connected Stripe account if not provided.
    // Usa la cookie del admin: fuera del panel no resuelve nada.
    const resolveStripeAccountId = async (rawId?: string): Promise<string | null> => {
      if (rawId && rawId !== "undefined" && rawId.length > 4) return rawId;
      if (gate !== "admin") return null;
      const port2 = process.env.PORT || 8080;
      // Prioridad: la cuenta del proyecto activo → primera cuenta vinculada
      const pidQ = Number(params?.projectId) > 0 ? `?projectId=${Number(params.projectId)}` : "";
      try {
        const r2 = await fetch(`http://localhost:${port2}/api/stripe/accounts${pidQ}`, { headers: { cookie: req.headers.cookie || "" } });
        if (!r2.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d2 = await r2.json() as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accs: any[] = Array.isArray(d2) ? d2 : (d2.accounts || []);
        if (!accs.length) return null;
        return accs[0].accountId || accs[0].account_id || null;
      } catch { return null; }
    };

    const outcome = await dispatchBrainAction({ req, res, action, params, resolveStripeAccountId });
    if (outcome === undefined) {
      void recordBrainEvent({ gate, channel, userId: input.userId ?? null, projectId: Number(params.projectId) || null, input: action, kind: "execute", actions: [{ action, params }], status: "ok", detail: "respondida por la propia acción", durationMs: Date.now() - started });
      return { kind: "responded" }; // la acción ya respondió
    }
    if (outcome === NOT_HANDLED) return done(400, { error: `Acción desconocida: ${action}` }, "failed");
    result = outcome;

    const r = result as Record<string, unknown>;
    const operationSucceeded = !r.error && r.success !== false;
    // Solo el admin alimenta la memoria global y el Vault.
    if (gate === "admin" && operationSucceeded && !NON_LEARNABLE.has(action)) {
      const safeParams = redactParams(params);
      const enrichedContent = buildEnrichedLearningContent(action, safeParams, r);
      learnFromOperation({
        operationType: `chatbot_action_${action}`,
        title: enrichedContent.title,
        content: enrichedContent.content,
        confidence: enrichedContent.confidence,
        tags: ["chatbot", "action", action, ...(enrichedContent.extraTags || [])],
      });
    }

    const isSaveable = !NON_SAVEABLE.has(action);
    const pId = params?.projectId ? parseInt(params.projectId) : null;
    if (gate === "admin" && pId && isSaveable && operationSucceeded) {
      const content = JSON.stringify(result, null, 2);
      saveToVault({
        projectId: pId,
        fileType: "brain_action",
        category: action,
        title: `Shopy Crafter: ${action} — ${new Date().toLocaleDateString("es-ES")}`,
        description: r.message ? String(r.message).slice(0, 500) : `Resultado de acción ${action}`,
        mimeType: "application/json",
        fileSizeBytes: Buffer.from(content).length,
        generatedBy: "shopybrain",
        content,
        metadata: { action, params: redactParams(params), timestamp: new Date().toISOString() },
      }).catch(() => {});
    }

    return done(200, { action, ...result, success: operationSucceeded }, operationSucceeded ? "ok" : "failed");
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const safeLogParams = params ? Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, SENSITIVE_KEYS.has(k) ? "***" : v])
    ) : {};
    logger.error({ action, params: safeLogParams, error: errMsg }, "Chatbot action failed");
    return done(500, { error: friendlyErrorFor(action, errMsg) }, "error");
  }
}
