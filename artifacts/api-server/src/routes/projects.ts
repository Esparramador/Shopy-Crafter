import { Router } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { projectsTable, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { refreshToken, shopifyRequest, normalizeShopDomain } from "../lib/shopify";
import { encrypt, safeDecrypt } from "../lib/crypto.js";

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
  "read_themes",
].join(",");

const oauthState = new Map<string, { shop: string; projectName: string; storeNiche: string; brandTone: string; targetAudience: string; storeMarkets: string; clientId: string; clientSecret: string }>();

function getAppUrl() {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : (process.env.APP_URL ?? "http://localhost:8080");
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
      .set({ accessToken: access_token, tokenExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000) })
      .where(eq(projectsTable.shopDomain, shopDomain))
      .returning();
    projectId = updated.id;
  } else {
    const [created] = await db.insert(projectsTable).values({
      name: saved.projectName || shopDomain.split(".")[0],
      shopDomain,
      clientId,
      clientSecret: encrypt(clientSecret),
      accessToken: access_token,
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
  const { name, shopDomain, clientId, clientSecret, storeNiche, brandTone, targetAudience, storeMarkets, replicateApiToken, anthropicApiKey } = req.body;

  if (!name || !shopDomain || !clientId || !clientSecret) {
    res.status(400).json({ error: "name, shopDomain, clientId y clientSecret son obligatorios" });
    return;
  }

  const [project] = await db.insert(projectsTable).values({
    name,
    shopDomain: normalizeShopDomain(shopDomain),
    clientId,
    clientSecret: encrypt(clientSecret),
    storeNiche: storeNiche ?? null,
    brandTone: brandTone ?? null,
    targetAudience: targetAudience ?? null,
    storeMarkets: storeMarkets ?? null,
    replicateApiToken: replicateApiToken ? encrypt(replicateApiToken) : null,
    anthropicApiKey: anthropicApiKey ? encrypt(anthropicApiKey) : null,
  }).returning();

  // Auto-generate access token immediately using client credentials
  try {
    await refreshToken(project.id, project.shopDomain, project.clientId, clientSecret);
  } catch (err) {
    req.log.warn({ projectId: project.id, err }, "Initial token generation failed — will retry on first API call");
  }

  const [refreshed] = await db.select().from(projectsTable).where(eq(projectsTable.id, project.id));

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

  const updateData: Partial<typeof projectsTable.$inferInsert> = {};
  if (name !== undefined) updateData.name = name;
  if (shopDomain !== undefined) updateData.shopDomain = normalizeShopDomain(shopDomain);
  if (clientId !== undefined) updateData.clientId = clientId;
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

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ success: true, message: "Proyecto eliminado" });
});

router.get("/projects/:projectId/reveal-token", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
  if (!project.accessToken) { res.status(404).json({ error: "Sin token de acceso" }); return; }
  res.json({
    accessToken: project.accessToken,
    shopDomain: project.shopDomain,
    note: "Guarda este token de forma segura. Es el Admin API access token de la tienda.",
  });
});

router.post("/projects/:projectId/refresh-token", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado" });
    return;
  }

  try {
    await refreshToken(id, project.shopDomain, project.clientId, project.clientSecret);
    const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    res.json({
      success: true,
      expiresAt: updated.tokenExpiresAt?.toISOString() ?? null,
      message: "Token renovado correctamente",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    res.status(400).json({ error: message });
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
    const data = await shopifyRequest<{ shop: { name: string; plan_name: string } }>(
      id,
      project.shopDomain,
      "/shop.json"
    );

    const countData = await shopifyRequest<{ count: number }>(
      id,
      project.shopDomain,
      "/products/count.json"
    );

    const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));

    res.json({
      connected: true,
      storeName: data.shop.name,
      planName: data.shop.plan_name,
      productCount: countData.count,
      tokenValid: true,
      tokenExpiresAt: updated.tokenExpiresAt?.toISOString() ?? null,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    res.json({
      connected: false,
      storeName: null,
      planName: null,
      productCount: null,
      tokenValid: false,
      tokenExpiresAt: null,
      error: message,
    });
  }
});

export default router;
