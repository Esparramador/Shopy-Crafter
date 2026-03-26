import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, planCreditPacksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { PLAN_LIMITS, PACK_DEFINITIONS, getPlanStatus, addPackCredits, checkProductionLimit } from "../lib/plan-limits.js";
import { logger } from "../lib/logger.js";
import { recordAudit } from "../lib/audit.helper.js";

const router = Router();

// ─── GET plan definitions (public for pricing display) ────────────────────────
router.get("/plans/definitions", async (_req, res): Promise<void> => {
  res.json({
    plans: Object.entries(PLAN_LIMITS).map(([key, val]) => ({
      key,
      label: val.label,
      productsPerMonth: isFinite(val.productsPerMonth) ? val.productsPerMonth : null,
      imagesPerProduct: isFinite(val.imagesPerProduct) ? val.imagesPerProduct : null,
      maxImagesPerMonth: isFinite(val.maxImagesPerMonth) ? val.maxImagesPerMonth : null,
    })),
    packs: Object.entries(PACK_DEFINITIONS).map(([key, val]) => ({
      key,
      label: val.label,
      productsIncluded: val.productsIncluded,
      imagesIncluded: val.imagesIncluded,
      price: val.price,
    })),
  });
});

// ─── GET plan status for a project ───────────────────────────────────────────
router.get("/projects/:projectId/plan", requireAdmin, async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  try {
    const status = await getPlanStatus(projectId);
    if (!status) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    res.json(status);
  } catch (err) {
    logger.error({ err }, "Error fetching plan status");
    res.status(500).json({ error: "Error al obtener estado del plan" });
  }
});

// ─── PUT update plan for a project (admin only) ───────────────────────────────
router.put("/projects/:projectId/plan", requireAdmin, async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const { plan, planRenewsAt } = req.body as { plan: string; planRenewsAt?: string };

  const validPlans = ["admin", "starter", "agency_pro", "enterprise", "trial"];
  if (!plan || !validPlans.includes(plan)) {
    res.status(400).json({ error: `Plan inválido. Opciones: ${validPlans.join(", ")}` });
    return;
  }

  try {
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }

    await db.update(projectsTable)
      .set({
        plan: plan as "admin" | "starter" | "agency_pro" | "enterprise" | "trial",
        ...(planRenewsAt ? { planRenewsAt: new Date(planRenewsAt) } : {}),
      })
      .where(eq(projectsTable.id, projectId));

    await recordAudit({
      userId: req.session.userId!,
      action: "plan_upgrade",
      projectId: String(projectId),
      details: `Plan updated to "${plan}" for project ${projectId}`,
      ipAddress: req.ip ?? "unknown",
    });

    const status = await getPlanStatus(projectId);
    res.json({ success: true, plan, status });
  } catch (err) {
    logger.error({ err }, "Error updating plan");
    res.status(500).json({ error: "Error al actualizar plan" });
  }
});

// ─── POST reset monthly usage counters ───────────────────────────────────────
router.post("/projects/:projectId/plan/reset-usage", requireAdmin, async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  try {
    await db.update(projectsTable)
      .set({ productsUsedThisMonth: 0, imagesUsedThisMonth: 0 })
      .where(eq(projectsTable.id, projectId));
    res.json({ success: true, message: "Contadores de uso reiniciados" });
  } catch (err) {
    logger.error({ err }, "Error resetting usage");
    res.status(500).json({ error: "Error al reiniciar uso" });
  }
});

// ─── POST add extra pack credits to a project ─────────────────────────────────
router.post("/projects/:projectId/plan/credits", requireAdmin, async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const { packType, shopifyOrderId } = req.body as { packType: string; shopifyOrderId?: string };

  if (!packType || !PACK_DEFINITIONS[packType]) {
    res.status(400).json({
      error: `Pack inválido. Opciones disponibles: ${Object.keys(PACK_DEFINITIONS).join(", ")}`,
      packs: PACK_DEFINITIONS,
    });
    return;
  }

  try {
    const result = await addPackCredits(projectId, packType, shopifyOrderId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    const status = await getPlanStatus(projectId);
    const pack = PACK_DEFINITIONS[packType];
    res.json({
      success: true,
      message: `✅ ${pack.label} añadido: +${pack.productsIncluded} productos, +${pack.imagesIncluded} imágenes`,
      status,
    });
  } catch (err) {
    logger.error({ err }, "Error adding credits");
    res.status(500).json({ error: "Error al añadir créditos" });
  }
});

// ─── GET purchased packs history for a project ───────────────────────────────
router.get("/projects/:projectId/plan/packs", requireAdmin, async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  try {
    const packs = await db.select()
      .from(planCreditPacksTable)
      .where(eq(planCreditPacksTable.projectId, projectId))
      .orderBy(planCreditPacksTable.purchasedAt);
    res.json({ packs });
  } catch (err) {
    logger.error({ err }, "Error fetching packs");
    res.status(500).json({ error: "Error al obtener historial de packs" });
  }
});

// ─── POST check if an operation is allowed (pre-flight check for UI) ─────────
router.post("/projects/:projectId/plan/check", requireAdmin, async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId, 10);
  const { type, count } = req.body as { type: "product" | "image"; count?: number };

  if (!type) {
    res.status(400).json({ error: "type es requerido (product | image)" });
    return;
  }

  try {
    const result = await checkProductionLimit(projectId, type, count ?? 1);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error checking limit");
    res.status(500).json({ error: "Error al verificar límite" });
  }
});

export default router;
