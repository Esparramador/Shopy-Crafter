import { Router } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { projectsTable, platformSettingsTable } from "@workspace/db";
import type { PlatformType } from "@workspace/db";
import { eq } from "drizzle-orm";
import { refreshToken, validateToken, shopifyRequest, normalizeShopDomain } from "../lib/shopify";
import { encrypt, safeDecrypt } from "../lib/crypto.js";
import { recordAudit } from "../lib/audit.helper.js";
import { getConnector, PlatformNotSupportedError } from "../lib/connectors/index";
import { learnFromOperation } from "../lib/claude";

const router = Router();

async function getShopifyCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  try {
    const rows = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "shopify_client_id")).limit(1);
    const secretRows = await db.select().from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, "shopify_client_secret")).limit(1);
    const dbId = rows[0]?.value ?? "";
    const dbSecret = secretRows[0]?.value ? safeDecrypt(secretRows[0].value) : "";
    return {
      clientId: dbId || (process.env.SHOPIFY_CLIENT_ID ?? ""),
      clientSecret: dbSecret || (process.env.SHOPIFY_CLIENT_SECRET ?? ""),
    };
  } catch {
    return {
      clientId: process.env.SHOPIFY_CLIENT_ID ?? "",
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
    };
  }
}

const OAUTH_SCOPES = [
  "read_products", "write_products",
  "read_orders", "read_customers",
  "read_analytics", "read_inventory", "write_inventory",
  "read_price_rules", "write_price_rules",
  "read_content", "write_content",
  "read_themes", "write_themes",
].join(",");

const oauthState = new Map<string, { shop: string; projectName: string; storeNiche: string; brandTone: string; targetAudience: string; storeMarkets: string; clientId: string; clientSecret: string }>();

function getAppUrl() {
  return process.env.APP_URL ?? "https://shopycrafter.com";
}

router.post("/shopify/oauth/start", async (req, res): Promise<void> => {
  const {
    shop, name, storeNiche, brandTone, targetAudience, storeMarkets,
    clientId: bodyClientId, clientSecret: bodyClientSecret,
  } = req.body as Record<string, string>;
  if (!shop) { res.status(400).json({ error: "shop es obligatorio" }); return; }

  // Per-project credentials take priority, fall back to platform/env credentials
  const platform = await getShopifyCredentials();
  const clientId = (bodyClientId ?? "").trim() || platform.clientId;
  const clientSecret = (bodyClientSecret ?? "").trim() || platform.clientSecret;

  if (!clientId || !clientSecret) {
    res.status(400).json({ error: "Se requiere el Client ID y Client Secret de Shopify. Introdúcelos en el formulario o configúralos en Ajustes." });
    return;
  }

  const shopDomain = normalizeShopDomain(shop);
  const state = crypto.randomBytes(16).toString("hex");
  oauthState.set(state, {
    shop: shopDomain,
    projectName: name ?? shopDomain.split(".")[0],
    storeNiche: storeNiche ?? "",
    brandTone: brandTone ?? "",
    targetAudience: targetAudience ?? "",
    storeMarkets: storeMarkets ?? "",
    clientId,
    clientSecret,
  });
  setTimeout(() => oauthState.delete(state), 10 * 60 * 1000);

  const redirectUri = `${getAppUrl()}/api/shopify/oauth/callback`;
  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(OAUTH_SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.json({ authUrl, state });
});

// Keep GET for backwards compatibility (uses platform credentials only)
router.get("/shopify/oauth/start", async (req, res): Promise<void> => {
  const { shop, name, storeNiche, brandTone, targetAudience, storeMarkets } = req.query as Record<string, string>;
  if (!shop) { res.status(400).json({ error: "shop es obligatorio" }); return; }

  const { clientId, clientSecret } = await getShopifyCredentials();
  if (!clientId || !clientSecret) {
    res.status(400).json({ error: "Se requiere el Client ID y Client Secret de Shopify. Introdúcelos en el formulario o configúralos en Ajustes." });
    return;
  }

  const shopDomain = normalizeShopDomain(shop);
  const state = crypto.randomBytes(16).toString("hex");
  oauthState.set(state, {
    shop: shopDomain, projectName: name ?? shopDomain.split(".")[0],
    storeNiche: storeNiche ?? "", brandTone: brandTone ?? "",
    targetAudience: targetAudience ?? "", storeMarkets: storeMarkets ?? "",
    clientId, clientSecret,
  });
  setTimeout(() => oauthState.delete(state), 10 * 60 * 1000);

  const redirectUri = `${getAppUrl()}/api/shopify/oauth/callback`;
  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(OAUTH_SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.json({ authUrl, state });
});

router.get("/shopify/oauth/callback", async (req, res): Promise<void> => {
  const { code, state, shop, hmac } = req.query as Record<string, string>;

  if (!state || !oauthState.has(state)) {
    res.status(400).send("OAuth state inválido o expirado. Vuelve a intentarlo.");
    return;
  }

  const saved = oauthState.get(state)!;
  oauthState.delete(state);

  // Use credentials that were stored in the state (per-project or platform fallback)
  const { clientId, clientSecret } = saved;

  if (hmac) {
    const params = Object.entries(req.query as Record<string, string>)
      .filter(([k]) => k !== "hmac")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const digest = crypto.createHmac("sha256", clientSecret).update(params).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac))) {
      res.status(400).send("Verificación HMAC fallida.");
      return;
    }
  }

  const shopDomain = normalizeShopDomain(shop ?? saved.shop);
  const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    res.status(400).send(`Error obteniendo token: ${text}`);
    return;
  }

  const { access_token } = await tokenRes.json() as { access_token: string };

  const existingProjects = await db.select().from(projectsTable).where(eq(projectsTable.shopDomain, shopDomain));
  let projectId: number;

  if (existingProjects.length > 0) {
    const [updated] = await db.update(projectsTable)
      .set({ accessToken: encrypt(access_token), tokenExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000) })
      .where(eq(projectsTable.shopDomain, shopDomain))
      .returning();
    projectId = updated.id;
  } else {
    const [created] = await db.insert(projectsTable).values({
      name: saved.projectName || shopDomain.split(".")[0],
      shopDomain,
      clientId,
      clientSecret: encrypt(clientSecret),
      accessToken: encrypt(access_token),
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      storeNiche: saved.storeNiche || null,
      brandTone: saved.brandTone || null,
      targetAudience: saved.targetAudience || null,
      storeMarkets: saved.storeMarkets || null,
    }).returning();
    projectId = created.id;
  }

  const appUrl = getAppUrl();
  res.redirect(`${appUrl}/oauth-success?projectId=${projectId}&shop=${encodeURIComponent(shopDomain)}`);
});

router.get("/shopify/oauth/check", async (_req, res): Promise<void> => {
  const { clientId, clientSecret } = await getShopifyCredentials();
  res.json({
    configured: !!(clientId && clientSecret),
    clientId: clientId ? clientId.slice(0, 8) + "••••••••" : null,
  });
});

router.get("/projects", async (req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.createdAt);

  const sanitized = projects.map((p) => ({
    ...p,
    clientSecret: "••••••••",
    accessToken: undefined,
    anthropicApiKey: p.anthropicApiKey ? "••••••••" : null,
    replicateApiToken: p.replicateApiToken ? "••••••••" : null,
    hasAccessToken: !!p.accessToken,
    tokenExpiresAt: p.tokenExpiresAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  res.json(sanitized);
});

router.post("/projects", async (req, res): Promise<void> => {
  const {
    name, shopDomain, clientId, clientSecret,
    storeNiche, brandTone, targetAudience, storeMarkets,
    replicateApiToken, anthropicApiKey, plan, platformType: rawPlatformType,
  } = req.body;

  const validPlatforms: PlatformType[] = ["shopify", "woocommerce", "prestashop", "wordpress", "universal"];
  const platformType: PlatformType = validPlatforms.includes(rawPlatformType) ? rawPlatformType : "shopify";

  const isShopify = platformType === "shopify";
  const isUniversal = platformType === "universal";
  const isPrestaShop = platformType === "prestashop";

  if (!name || !shopDomain) {
    res.status(400).json({ error: "name y shopDomain (URL de la tienda) son obligatorios" });
    return;
  }

  const isWooCommerce = platformType === "woocommerce";

  if (isShopify && (!clientId || !clientSecret)) {
    res.status(400).json({ error: "name, shopDomain, clientId y clientSecret son obligatorios" });
    return;
  }

  if (isPrestaShop) {
    if (!clientSecret || clientSecret.length !== 32) {
      res.status(400).json({ error: "La clave API de PrestaShop debe tener exactamente 32 caracteres." });
      return;
    }
  }

  if (isWooCommerce) {
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: "Consumer Key y Consumer Secret son obligatorios para WooCommerce" });
      return;
    }
    if (!clientId.startsWith("ck_")) {
      res.status(400).json({ error: "El Consumer Key de WooCommerce debe empezar con 'ck_'" });
      return;
    }
    if (!clientSecret.startsWith("cs_")) {
      res.status(400).json({ error: "El Consumer Secret de WooCommerce debe empezar con 'cs_'" });
      return;
    }
    try {
      const storeUrl = new URL(shopDomain.startsWith("http") ? shopDomain : `https://${shopDomain}`);
      if (storeUrl.protocol !== "https:") {
        res.status(400).json({ error: "La URL de la tienda WooCommerce debe usar HTTPS para proteger las credenciales" });
        return;
      }
      const hostname = storeUrl.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.startsWith("10.") || hostname.startsWith("172.") || hostname.startsWith("192.168.") || hostname === "::1") {
        res.status(400).json({ error: "No se permiten URLs de red local o privada" });
        return;
      }
    } catch {
      res.status(400).json({ error: "La URL de la tienda WooCommerce no es válida" });
      return;
    }
  }

  if (!isUniversal && !isShopify && !isPrestaShop && !isWooCommerce && !clientSecret) {
    res.status(400).json({ error: "name, shopDomain y las credenciales de la plataforma son obligatorios" });
    return;
  }

  const validPlans = ["admin", "starter", "agency_pro", "enterprise", "trial"];
  const finalPlan = validPlans.includes(plan) ? plan : "starter";

  const normalizedDomain = isShopify ? normalizeShopDomain(shopDomain) : shopDomain.replace(/\/$/, "");

  const [project] = await db.insert(projectsTable).values({
    name,
    platformType,
    shopDomain: normalizedDomain,
    clientId: isPrestaShop ? "" : (isWooCommerce && clientId) ? encrypt(clientId) : (clientId ?? ""),
    clientSecret: clientSecret ? encrypt(clientSecret) : "",
    storeNiche: storeNiche ?? null,
    brandTone: brandTone ?? null,
    targetAudience: targetAudience ?? null,
    storeMarkets: storeMarkets ?? null,
    replicateApiToken: replicateApiToken ? encrypt(replicateApiToken) : null,
    anthropicApiKey: anthropicApiKey ? encrypt(anthropicApiKey) : null,
    plan: finalPlan as "admin" | "starter" | "agency_pro" | "enterprise" | "trial",
    planRenewsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  }).returning();

  if (isShopify) {
    try {
      await refreshToken(project.id, normalizedDomain, clientId, clientSecret);
    } catch (err) {
      req.log.warn({ projectId: project.id, err }, "Initial token generation failed — credentials may be incorrect");
      await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
      res.status(400).json({
        error: `No se pudo generar el token de acceso. Verifica que el Client ID y el Secret sean correctos para ${normalizedDomain}.`,
      });
      return;
    }
  } else if (isWooCommerce) {
    let wcConnectionResult: { connected: boolean; error?: string | null; errorCode?: string; storeName?: string | null; productCount?: number | null } = { connected: false };
    try {
      const connector = getConnector(project);
      const result = await connector.testConnection();
      wcConnectionResult = result;
      if (result.connected) {
        req.log.info({ projectId: project.id, storeName: result.storeName, productCount: result.productCount }, "WooCommerce connection test passed");
      } else {
        req.log.warn({ projectId: project.id, error: result.error, errorCode: result.errorCode }, "WooCommerce connection test failed — project saved for retry");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      wcConnectionResult = { connected: false, error: msg };
      req.log.warn({ projectId: project.id, err }, "WooCommerce connection test failed — project saved for retry");
    }

    const [refreshed] = await db.select().from(projectsTable).where(eq(projectsTable.id, project.id));

    await recordAudit({
      userId: req.session.userId!,
      action: "project_create",
      projectId: String(refreshed.id),
      details: `Created ${platformType} project "${name}" (${normalizedDomain}) — connection: ${wcConnectionResult.connected ? "OK" : "FAILED"}`,
      ipAddress: req.ip ?? "unknown",
    });

    try {
      if (wcConnectionResult.connected) {
        learnFromOperation({
          operationType: "connection_auth",
          title: `WooCommerce connection success: ${normalizedDomain}`,
          content: `Successfully connected to WooCommerce store "${wcConnectionResult.storeName}" at ${normalizedDomain}. Platform: WooCommerce. Product count: ${wcConnectionResult.productCount ?? "unknown"}. Authentication: HTTP Basic Auth with consumer key/secret. WooCommerce SEO requires Yoast plugin for meta title/description management.`,
          confidence: 0.9,
          tags: ["connection_success", "woocommerce", "auth"],
        });
      } else {
        learnFromOperation({
          operationType: "connection_auth",
          title: `WooCommerce connection failed: ${normalizedDomain}`,
          content: `Failed to connect to WooCommerce store at ${normalizedDomain}. Error: ${wcConnectionResult.error ?? "unknown"}. Error code: ${wcConnectionResult.errorCode ?? "unknown"}. Platform: WooCommerce. Common WooCommerce connection issues: incorrect consumer key/secret, REST API not enabled, permalink structure not set to "Post name", or SSL/HTTPS not configured. Project saved for retry.`,
          confidence: 0.7,
          tags: ["connection_failure", "woocommerce", "auth"],
        });
      }
    } catch { /* learning is best-effort */ }

    res.status(201).json({
      ...refreshed,
      clientSecret: "••••••••",
      accessToken: undefined,
      hasAccessToken: !!refreshed.accessToken,
      tokenExpiresAt: refreshed.tokenExpiresAt?.toISOString() ?? null,
      createdAt: refreshed.createdAt.toISOString(),
      updatedAt: refreshed.updatedAt.toISOString(),
      connectionTest: wcConnectionResult.connected
        ? { connected: true, storeName: wcConnectionResult.storeName, productCount: wcConnectionResult.productCount }
        : { connected: false, error: wcConnectionResult.error, errorCode: wcConnectionResult.errorCode },
    });
    return;
  } else if (isUniversal) {
    try {
      const connector = getConnector(project);
      const testResult = await connector.testConnection();
      if (!testResult.connected) {
        req.log.warn({ projectId: project.id, url: normalizedDomain, error: testResult.error }, "Universal project URL not reachable — project saved for retry");
      }
    } catch (err) {
      req.log.warn({ projectId: project.id, err }, "Universal project URL check failed — project saved for retry");
    }
  } else {
    try {
      const connector = getConnector(project);
      const testResult = await connector.testConnection();
      if (!testResult.connected) {
        req.log.warn({ projectId: project.id, platformType, error: testResult.error, errorCode: testResult.errorCode }, "Connection test failed for non-Shopify platform");
      }
    } catch (err) {
      if (err instanceof PlatformNotSupportedError) {
        req.log.info({ projectId: project.id, platformType }, "Platform not yet implemented — project saved without connection test");
      } else {
        req.log.warn({ projectId: project.id, err }, "Connection test failed for non-Shopify platform — project saved for retry");
      }
    }
  }

  const [refreshed] = await db.select().from(projectsTable).where(eq(projectsTable.id, project.id));

  await recordAudit({
    userId: req.session.userId!,
    action: "project_create",
    projectId: String(refreshed.id),
    details: `Created ${platformType} project "${name}" (${normalizedDomain})`,
    ipAddress: req.ip ?? "unknown",
  });

  res.status(201).json({
    ...refreshed,
    clientSecret: "••••••••",
    accessToken: undefined,
    hasAccessToken: !!refreshed.accessToken,
    tokenExpiresAt: refreshed.tokenExpiresAt?.toISOString() ?? null,
    createdAt: refreshed.createdAt.toISOString(),
    updatedAt: refreshed.updatedAt.toISOString(),
  });
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  res.json({
    ...project,
    clientSecret: "••••••••",
    accessToken: undefined,
    hasAccessToken: !!project.accessToken,
    tokenExpiresAt: project.tokenExpiresAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.put("/projects/:projectId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { name, shopDomain, clientId, clientSecret, storeNiche, brandTone, targetAudience, storeMarkets, replicateApiToken, anthropicApiKey, autoPilotEnabled } = req.body;

  const [existing] = await db.select({ platformType: projectsTable.platformType }).from(projectsTable).where(eq(projectsTable.id, id));
  const platform = existing?.platformType ?? "shopify";

  const updateData: Partial<typeof projectsTable.$inferInsert> = {};
  if (name !== undefined) updateData.name = name;
  if (shopDomain !== undefined) {
    updateData.shopDomain = platform === "shopify" ? normalizeShopDomain(shopDomain) : shopDomain.replace(/\/$/, "");
  }
  if (clientId !== undefined) updateData.clientId = (platform === "woocommerce" && clientId) ? encrypt(clientId) : clientId;
  if (clientSecret !== undefined) updateData.clientSecret = encrypt(clientSecret);
  if (storeNiche !== undefined) updateData.storeNiche = storeNiche;
  if (brandTone !== undefined) updateData.brandTone = brandTone;
  if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
  if (storeMarkets !== undefined) updateData.storeMarkets = storeMarkets;
  if (replicateApiToken !== undefined) updateData.replicateApiToken = replicateApiToken ? encrypt(replicateApiToken) : null;
  if (anthropicApiKey !== undefined) updateData.anthropicApiKey = anthropicApiKey ? encrypt(anthropicApiKey) : null;
  if (autoPilotEnabled !== undefined) updateData.autoPilotEnabled = autoPilotEnabled;

  const [updated] = await db
    .update(projectsTable)
    .set(updateData)
    .where(eq(projectsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  res.json({
    ...updated,
    clientSecret: "••••••••",
    accessToken: undefined,
    hasAccessToken: !!updated.accessToken,
    tokenExpiresAt: updated.tokenExpiresAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.post("/projects/:projectId/disconnect", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  await db.update(projectsTable).set({
    accessToken: null,
    clientId: "",
    clientSecret: "",
    tokenExpiresAt: null,
  }).where(eq(projectsTable.id, id));

  req.log.info({ projectId: id, domain: project.shopDomain }, "Store disconnected (credentials cleared, data preserved)");
  res.json({
    success: true,
    message: "Tienda desconectada. Las credenciales se han eliminado pero todo el trabajo generado (imágenes, rediseños, SEO, etc.) se conserva.",
  });
});

router.post("/projects/:projectId/reconnect", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  const { clientId, clientSecret, shopDomain } = req.body as { clientId?: string; clientSecret?: string; shopDomain?: string };
  if (!clientId || !clientSecret) {
    res.status(400).json({ error: "Se requieren clientId y clientSecret para reconectar." });
    return;
  }

  const rawDomain = shopDomain || project.shopDomain;
  const domain = normalizeShopDomain(rawDomain);
  if (!domain) {
    res.status(400).json({ error: "Dominio Shopify inválido." });
    return;
  }

  try {
    const encSecret = encrypt(clientSecret);
    await db.update(projectsTable).set({
      clientId,
      clientSecret: encSecret,
      shopDomain: domain,
    }).where(eq(projectsTable.id, id));

    const token = await refreshToken(id, domain, clientId, clientSecret);

    req.log.info({ projectId: id, domain }, "Store reconnected with new credentials");
    res.json({ success: true, message: "Tienda reconectada correctamente.", tokenUpdated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    res.status(400).json({ error: `No se pudo reconectar: ${message}` });
  }
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const mode = (req.query.mode as string) ?? "full";

  if (mode === "dissociate") {
    await db.update(projectsTable).set({
      accessToken: null,
      tokenExpiresAt: null,
      clientId: "",
      clientSecret: "",
      shopDomain: "",
    }).where(eq(projectsTable.id, id));
    await recordAudit({
      userId: req.session.userId!,
      action: "project_dissociate",
      projectId: String(id),
      details: `Dissociated store from project ${id}`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true, message: "Tienda desasociada. Tus productos, COGS, SEO e imágenes se conservan." });
  } else {
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    await recordAudit({
      userId: req.session.userId!,
      action: "project_delete",
      projectId: String(id),
      details: `Deleted project ${id}`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true, message: "Proyecto eliminado completamente" });
  }
});

router.get("/projects/:projectId/reveal-token", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  if (!project.accessToken) { res.status(404).json({ error: "Sin token de acceso" }); return; }
  const plainToken = safeDecrypt(project.accessToken) || project.accessToken;
  const masked = plainToken.slice(0, 8) + "••••••••••••" + plainToken.slice(-4);
  res.json({
    accessToken: masked,
    shopDomain: project.shopDomain,
    tokenValid: true,
    note: "Token enmascarado por seguridad. Usa el panel de Shopify Partners para ver el token completo.",
  });
});

router.post("/projects/:projectId/refresh-token", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.projectId), 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

  // Allow manual token update via body
  const { newAccessToken } = req.body as { newAccessToken?: string };
  if (newAccessToken) {
    const isValid = await validateToken(project.shopDomain, newAccessToken);
    if (!isValid) {
      res.status(400).json({ error: "El nuevo token no es válido para esta tienda." });
      return;
    }
    await db.update(projectsTable).set({ accessToken: encrypt(newAccessToken) }).where(eq(projectsTable.id, id));
    await recordAudit({
      userId: req.session.userId!,
      action: "shopify_token_manual_update",
      projectId: String(id),
      details: `Manual token update for project ${id}`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({ success: true, message: "Token actualizado y validado correctamente." });
    return;
  }

  // Regenerate token using client_credentials grant
  try {
    const plainSecret = safeDecrypt(project.clientSecret) || project.clientSecret;
    const newToken = await refreshToken(id, project.shopDomain, project.clientId, plainSecret);
    await recordAudit({
      userId: req.session.userId!,
      action: "shopify_token_refresh",
      projectId: String(id),
      details: `Token refreshed for project ${id} (${project.shopDomain})`,
      ipAddress: req.ip ?? "unknown",
    });
    res.json({
      success: true,
      message: "Token regenerado correctamente.",
      tokenUpdated: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    res.status(400).json({ error: message });
  }
});

router.post("/projects/test-connection-presave", async (req, res): Promise<void> => {
  const { platformType, shopDomain, clientId, clientSecret } = req.body as {
    platformType?: string;
    shopDomain?: string;
    clientId?: string;
    clientSecret?: string;
  };

  if (!platformType || !shopDomain) {
    res.status(400).json({ connected: false, error: "Plataforma y URL son obligatorios", errorCode: "MISSING_FIELDS" });
    return;
  }

  if (platformType === "universal") {
    res.json({ connected: true, storeName: shopDomain, productCount: null, platformInfo: "Auditoría Universal" });
    return;
  }

  const validPlatforms = ["shopify", "woocommerce", "prestashop"];
  if (!validPlatforms.includes(platformType)) {
    res.status(400).json({ connected: false, error: "Plataforma no válida", errorCode: "INVALID_PLATFORM" });
    return;
  }

  if (platformType === "shopify") {
    const normalized = normalizeShopDomain(shopDomain);
    if (!normalized || !normalized.includes(".myshopify.com")) {
      res.status(400).json({ connected: false, error: "El dominio debe ser un dominio .myshopify.com válido", errorCode: "STORE_NOT_FOUND" });
      return;
    }
  } else {
    try {
      const storeUrl = new URL(shopDomain.startsWith("http") ? shopDomain : `https://${shopDomain}`);
      const hostname = storeUrl.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" ||
          hostname.startsWith("10.") || hostname.startsWith("172.") || hostname.startsWith("192.168.") ||
          hostname === "::1" || hostname === "[::1]" || hostname.endsWith(".local") ||
          hostname.startsWith("169.254.") || hostname === "metadata.google.internal") {
        res.status(400).json({ connected: false, error: "No se permiten URLs de red local o privada", errorCode: "URL_UNREACHABLE" });
        return;
      }
    } catch {
      res.status(400).json({ connected: false, error: "URL no válida", errorCode: "URL_UNREACHABLE" });
      return;
    }
  }

  if (!clientSecret) {
    res.status(400).json({ connected: false, error: "Credenciales requeridas", errorCode: "AUTH_FAILED" });
    return;
  }

  const fakeProject = {
    id: 0,
    name: "test",
    shopDomain: shopDomain.replace(/\/$/, ""),
    clientId: platformType === "woocommerce" && clientId ? encrypt(clientId) : (clientId ?? ""),
    clientSecret: clientSecret ? encrypt(clientSecret) : "",
    platformType: platformType as any,
    accessToken: null,
    tokenExpiresAt: null,
    plan: "starter" as const,
    planRenewsAt: new Date(),
    storeNiche: null,
    brandTone: null,
    targetAudience: null,
    storeMarkets: null,
    replicateApiToken: null,
    anthropicApiKey: null,
    autoPilotEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const connector = getConnector(fakeProject as any);
    const result = await connector.testConnection();

    res.json({
      connected: result.connected,
      storeName: result.storeName,
      productCount: result.productCount,
      platformInfo: result.platformInfo,
      error: result.error,
      errorCode: result.errorCode ?? null,
    });
  } catch (err) {
    if (err instanceof PlatformNotSupportedError) {
      res.json({ connected: false, error: err.message, errorCode: "PLATFORM_NOT_SUPPORTED" });
      return;
    }
    const rawMsg = err instanceof Error ? err.message : "Error desconocido";
    let errorCode = "UNKNOWN";
    const msgLower = rawMsg.toLowerCase();
    if (msgLower.includes("401") || msgLower.includes("unauthorized") || msgLower.includes("invalid") || msgLower.includes("authentication")) {
      errorCode = "AUTH_FAILED";
    } else if (msgLower.includes("403") || msgLower.includes("forbidden") || msgLower.includes("permission")) {
      errorCode = "PERMISSIONS_INSUFFICIENT";
    } else if (msgLower.includes("ssl") || msgLower.includes("https") || msgLower.includes("certificate")) {
      errorCode = "SSL_REQUIRED";
    } else if (msgLower.includes("enotfound") || msgLower.includes("econnrefused") || msgLower.includes("unreachable") || msgLower.includes("getaddrinfo")) {
      errorCode = "URL_UNREACHABLE";
    } else if (msgLower.includes("timeout") || msgLower.includes("etimedout")) {
      errorCode = "TIMEOUT";
    } else if (msgLower.includes("webservice") || msgLower.includes("disabled")) {
      errorCode = "WEBSERVICE_DISABLED";
    }
    const ERROR_MESSAGES: Record<string, string> = {
      AUTH_FAILED: "Credenciales inválidas. Verifica tu API Key y Secret.",
      PERMISSIONS_INSUFFICIENT: "La clave API no tiene permisos suficientes.",
      SSL_REQUIRED: "Tu tienda necesita HTTPS para conectarse.",
      URL_UNREACHABLE: "No podemos acceder a la URL. Verifica que sea correcta y esté online.",
      TIMEOUT: "La conexión ha tardado demasiado. Inténtalo de nuevo.",
      WEBSERVICE_DISABLED: "El webservice está desactivado.",
      UNKNOWN: "Error de conexión. Verifica tus credenciales e inténtalo de nuevo.",
    };
    res.json({
      connected: false,
      storeName: null,
      productCount: null,
      error: ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.UNKNOWN,
      errorCode,
    });
  }
});

router.post("/projects/:projectId/test-connection", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  try {
    const connector = getConnector(project);
    const result = await connector.testConnection();

    const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

    res.json({
      connected: result.connected,
      storeName: result.storeName,
      planName: result.platformInfo,
      productCount: result.productCount,
      tokenValid: result.tokenValid,
      tokenExpiresAt: updated.tokenExpiresAt?.toISOString() ?? null,
      error: result.error,
      errorCode: result.errorCode ?? null,
      platformType: project.platformType ?? "shopify",
    });
  } catch (err) {
    if (err instanceof PlatformNotSupportedError) {
      res.json({
        connected: false,
        storeName: null,
        planName: null,
        productCount: null,
        tokenValid: false,
        tokenExpiresAt: null,
        error: err.message,
        platformType: project.platformType ?? "shopify",
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Error desconocido";
    const isPlatformError = err instanceof PlatformNotSupportedError;
    res.json({
      connected: false,
      storeName: null,
      planName: null,
      productCount: null,
      tokenValid: false,
      tokenExpiresAt: null,
      error: message,
      errorCode: isPlatformError ? "PLATFORM_NOT_SUPPORTED" : "UNKNOWN",
      platformType: project.platformType ?? "shopify",
    });
  }
});

export default router;
