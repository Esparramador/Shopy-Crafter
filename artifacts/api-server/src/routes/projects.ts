import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { refreshToken, shopifyRequest, normalizeShopDomain } from "../lib/shopify";

const router = Router();

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
    clientSecret,
    storeNiche: storeNiche ?? null,
    brandTone: brandTone ?? null,
    targetAudience: targetAudience ?? null,
    storeMarkets: storeMarkets ?? null,
    replicateApiToken: replicateApiToken ?? null,
    anthropicApiKey: anthropicApiKey ?? null,
  }).returning();

  try {
    await refreshToken(project.id, project.shopDomain, project.clientId, project.clientSecret);
  } catch (err) {
    req.log.warn({ projectId: project.id, err }, "Initial token fetch failed — can retry later");
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
  if (clientSecret !== undefined) updateData.clientSecret = clientSecret;
  if (storeNiche !== undefined) updateData.storeNiche = storeNiche;
  if (brandTone !== undefined) updateData.brandTone = brandTone;
  if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
  if (storeMarkets !== undefined) updateData.storeMarkets = storeMarkets;
  if (replicateApiToken !== undefined) updateData.replicateApiToken = replicateApiToken;
  if (anthropicApiKey !== undefined) updateData.anthropicApiKey = anthropicApiKey;
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
