import { db } from "@workspace/db";
import { projectsTable, planCreditPacksTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import type { PlanType } from "@workspace/db/schema";
import { catalogPlan, TRIAL } from "./plan-catalog.js";

export interface PlanConfig {
  productsPerMonth: number;
  imagesPerProduct: number;
  maxImagesPerMonth: number;
  label: string;
}

function fromCatalog(id: "emprendedor" | "starter" | "agency_pro" | "enterprise", imagesPerProduct: number): PlanConfig {
  const p = catalogPlan(id)!;
  return {
    productsPerMonth: p.productsPerMonth,
    imagesPerProduct,
    maxImagesPerMonth: p.imagesPerMonth,
    label: `${p.name} €${p.priceMonthly}/mes`,
  };
}

// Cuotas y etiquetas salen del catálogo único (lib/plan-catalog.ts): antes estas
// etiquetas decían 19/49/149/399 € mientras la web cobraba 14/37/112/299 €.
export const PLAN_LIMITS: Record<PlanType, PlanConfig> = {
  admin: {
    productsPerMonth: Infinity,
    imagesPerProduct: 8,
    maxImagesPerMonth: Infinity,
    label: "Admin (Sin límites)",
  },
  enterprise: fromCatalog("enterprise", 3),
  agency_pro: fromCatalog("agency_pro", 3),
  starter: fromCatalog("starter", 3),
  emprendedor: fromCatalog("emprendedor", 3),
  trial: {
    productsPerMonth: TRIAL.productsPerMonth,
    imagesPerProduct: 2,
    maxImagesPerMonth: TRIAL.imagesPerMonth,
    label: "Prueba",
  },
};

export const PACK_DEFINITIONS: Record<string, { productsIncluded: number; imagesIncluded: number; price: number; label: string }> = {
  "pack-1": { productsIncluded: 1, imagesIncluded: 3, price: 7, label: "1 Producto" },
  "pack-5": { productsIncluded: 5, imagesIncluded: 15, price: 29, label: "Pack 5 Productos" },
  "pack-10": { productsIncluded: 10, imagesIncluded: 30, price: 49, label: "Pack 10 Productos" },
  "pack-15": { productsIncluded: 15, imagesIncluded: 60, price: 69, label: "Pack 15 Productos" },
  "pack-20": { productsIncluded: 20, imagesIncluded: 80, price: 89, label: "Pack 20 Productos" },
  "pack-30": { productsIncluded: 30, imagesIncluded: 150, price: 119, label: "Pack 30 Productos" },
};

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  remaining: {
    products: number;
    images: number;
  };
  planLabel: string;
}

export async function checkProductionLimit(
  projectId: number,
  type: "product" | "image",
  count = 1
): Promise<LimitCheckResult> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);

  if (!project) {
    return { allowed: false, reason: "Proyecto no encontrado", remaining: { products: 0, images: 0 }, planLabel: "N/A" };
  }

  const plan = (project.plan ?? "starter") as PlanType;
  const limits = PLAN_LIMITS[plan];

  if (plan === "admin") {
    return {
      allowed: true,
      remaining: { products: Infinity, images: Infinity },
      planLabel: limits.label,
    };
  }

  resetMonthlyUsageIfNeeded(project, projectId);

  const baseProducts = isFinite(limits.productsPerMonth) ? limits.productsPerMonth : 0;
  const baseImages = isFinite(limits.maxImagesPerMonth) ? limits.maxImagesPerMonth : 0;

  const totalProductQuota = baseProducts + (project.creditsProducts ?? 0);
  const totalImageQuota = baseImages + (project.creditsImages ?? 0);

  const usedProducts = project.productsUsedThisMonth ?? 0;
  const usedImages = project.imagesUsedThisMonth ?? 0;

  const remainingProducts = Math.max(0, totalProductQuota - usedProducts);
  const remainingImages = Math.max(0, totalImageQuota - usedImages);

  if (type === "product") {
    if (usedProducts + count > totalProductQuota) {
      return {
        allowed: false,
        reason: `Plan ${limits.label}: has usado ${usedProducts}/${totalProductQuota} productos este mes. Necesitas ${count} más, pero solo te quedan ${remainingProducts}. Compra un pack extra o actualiza tu plan.`,
        remaining: { products: remainingProducts, images: remainingImages },
        planLabel: limits.label,
      };
    }
  }

  if (type === "image") {
    if (usedImages + count > totalImageQuota) {
      return {
        allowed: false,
        reason: `Plan ${limits.label}: has generado ${usedImages}/${totalImageQuota} imágenes este mes. Necesitas ${count} más, pero solo te quedan ${remainingImages}. Compra un pack extra o actualiza tu plan.`,
        remaining: { products: remainingProducts, images: remainingImages },
        planLabel: limits.label,
      };
    }
  }

  return {
    allowed: true,
    remaining: { products: remainingProducts, images: remainingImages },
    planLabel: limits.label,
  };
}

export async function recordUsage(
  projectId: number,
  type: "product" | "image",
  count = 1
): Promise<void> {
  const [project] = await db
    .select({ productsUsedThisMonth: projectsTable.productsUsedThisMonth, imagesUsedThisMonth: projectsTable.imagesUsedThisMonth, plan: projectsTable.plan })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);

  if (!project || project.plan === "admin") return;

  // Incremento atómico: dos generaciones en paralelo no pueden contar una sola.
  if (type === "product") {
    await db.update(projectsTable)
      .set({ productsUsedThisMonth: sql`COALESCE(${projectsTable.productsUsedThisMonth}, 0) + ${count}` })
      .where(eq(projectsTable.id, projectId));
  } else {
    await db.update(projectsTable)
      .set({ imagesUsedThisMonth: sql`COALESCE(${projectsTable.imagesUsedThisMonth}, 0) + ${count}` })
      .where(eq(projectsTable.id, projectId));
  }
}

export async function addPackCredits(
  projectId: number,
  packType: string,
  shopifyOrderId?: string
): Promise<{ success: boolean; error?: string }> {
  const pack = PACK_DEFINITIONS[packType];
  if (!pack) return { success: false, error: `Pack desconocido: ${packType}` };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return { success: false, error: "Proyecto no encontrado" };

  await db.update(projectsTable)
    .set({
      creditsProducts: (project.creditsProducts ?? 0) + pack.productsIncluded,
      creditsImages: (project.creditsImages ?? 0) + pack.imagesIncluded,
    })
    .where(eq(projectsTable.id, projectId));

  await db.insert(planCreditPacksTable).values({
    projectId,
    packType,
    productsIncluded: pack.productsIncluded,
    imagesIncluded: pack.imagesIncluded,
    shopifyOrderId: shopifyOrderId ?? null,
    purchasedAt: new Date(),
  });

  return { success: true };
}

export async function getPlanStatus(projectId: number) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return null;

  const plan = (project.plan ?? "starter") as PlanType;
  const limits = PLAN_LIMITS[plan];

  const baseProducts = isFinite(limits.productsPerMonth) ? limits.productsPerMonth : 999999;
  const baseImages = isFinite(limits.maxImagesPerMonth) ? limits.maxImagesPerMonth : 999999;

  const totalProductQuota = baseProducts + (project.creditsProducts ?? 0);
  const totalImageQuota = baseImages + (project.creditsImages ?? 0);
  const usedProducts = project.productsUsedThisMonth ?? 0;
  const usedImages = project.imagesUsedThisMonth ?? 0;

  return {
    plan,
    planLabel: limits.label,
    unlimited: plan === "admin",
    products: {
      limit: plan === "admin" ? null : totalProductQuota,
      used: usedProducts,
      remaining: plan === "admin" ? null : Math.max(0, totalProductQuota - usedProducts),
      extraCredits: project.creditsProducts ?? 0,
    },
    images: {
      limit: plan === "admin" ? null : totalImageQuota,
      used: usedImages,
      remaining: plan === "admin" ? null : Math.max(0, totalImageQuota - usedImages),
      extraCredits: project.creditsImages ?? 0,
      maxPerProduct: limits.imagesPerProduct,
    },
    planRenewsAt: project.planRenewsAt,
  };
}

function resetMonthlyUsageIfNeeded(project: { planRenewsAt: Date | null; id: number }, projectId: number) {
  if (!project.planRenewsAt) return;
  const now = new Date();
  if (now > project.planRenewsAt) {
    const nextRenewal = new Date(project.planRenewsAt);
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    db.update(projectsTable)
      .set({ productsUsedThisMonth: 0, imagesUsedThisMonth: 0, planRenewsAt: nextRenewal })
      .where(eq(projectsTable.id, projectId))
      .catch(() => {});
  }
}
