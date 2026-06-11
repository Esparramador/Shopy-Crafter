import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, affiliatesTable, referralTrackingTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

const PLANS: Record<string, {
  name: string; price: number; storesLimit: number; imagesIncluded: number; features: string[];
  periodDays: number;
}> = {
  trial: {
    name: "Trial", price: 0, storesLimit: 1, imagesIncluded: 100, periodDays: 14,
    features: ["1 tienda", "100 imágenes IA", "Auditoría básica"],
  },
  starter: {
    name: "Starter", price: 97, storesLimit: 3, imagesIncluded: 500, periodDays: 30,
    features: ["3 tiendas", "500 imágenes IA", "Todas las funciones", "Soporte email"],
  },
  pro: {
    name: "Pro", price: 297, storesLimit: 10, imagesIncluded: 2000, periodDays: 30,
    features: ["10 tiendas", "2000 imágenes IA", "API access", "Soporte prioritario", "Afiliados"],
  },
  agency: {
    name: "Agency", price: 697, storesLimit: -1, imagesIncluded: -1, periodDays: 30,
    features: ["Tiendas ilimitadas", "Imágenes ilimitadas", "White label", "Soporte dedicado", "Revenue sharing"],
  },
};

router.get("/billing/subscription", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

    if (!sub) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const [created] = await db.insert(subscriptionsTable).values({
        userId,
        plan: "trial",
        status: "trialing",
        trialEndsAt: trialEnd,
        storesLimit: 1,
        imagesIncluded: 100,
      }).returning();
      res.json({ subscription: created, plan: PLANS.trial, daysRemaining: 14 });
      return;
    }

    const plan = PLANS[sub.plan as keyof typeof PLANS] ?? PLANS.trial;
    const daysRemaining = sub.trialEndsAt
      ? Math.max(0, Math.floor((sub.trialEndsAt.getTime() - Date.now()) / 86400000))
      : null;

    res.json({ subscription: sub, plan, daysRemaining });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/plans", async (_req, res): Promise<void> => {
  try {
    res.json(Object.entries(PLANS).map(([id, plan]) => ({ id, ...plan })));
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/billing/upgrade", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    const role = (req.session as any).role;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { plan: planId } = req.body as { plan: string };
    if (!planId || !PLANS[planId]) {
      res.status(400).json({ error: "Plan no válido", validPlans: Object.keys(PLANS) });
      return;
    }

    const plan = PLANS[planId];

    const existingSub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const currentPlan = existingSub[0]?.plan ?? "trial";

    if (currentPlan === planId) {
      res.status(400).json({ error: "Ya estás en este plan." });
      return;
    }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const isAdmin = role === "admin";
    const isFreeDowngrade = plan.price === 0;

    if (isAdmin || isFreeDowngrade) {
      const updates = {
        plan: planId,
        status: planId === "trial" ? "trialing" : "active",
        storesLimit: plan.storesLimit,
        imagesIncluded: plan.imagesIncluded,
        currentPeriodEnd: isFreeDowngrade ? null : periodEnd,
        trialEndsAt: planId === "trial" ? periodEnd : null,
        cancelAtPeriodEnd: 0,
      };

      if (existingSub.length > 0) {
        const [updated] = await db.update(subscriptionsTable)
          .set(updates)
          .where(eq(subscriptionsTable.userId, userId))
          .returning();
        logger.info({ userId, plan: planId, role }, "✅ Plan actualizado");
        res.json({ subscription: updated, plan, message: `Plan actualizado a ${plan.name}` });
      } else {
        const [created] = await db.insert(subscriptionsTable)
          .values({ userId, ...updates })
          .returning();
        logger.info({ userId, plan: planId, role }, "✅ Suscripción creada");
        res.json({ subscription: created, plan, message: `Plan activado: ${plan.name}` });
      }
      return;
    }

    const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
    const APP_URL = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

    if (SHOPIFY_CLIENT_ID) {
      const returnUrl = `${APP_URL}/api/billing/shopify/callback`;
      const confirmationUrl = `https://accounts.shopify.com/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=&redirect_uri=${encodeURIComponent(returnUrl)}&state=${planId}_${userId}`;
      res.json({
        requiresPayment: true,
        confirmationUrl,
        plan,
        message: `Serás redirigido a Shopify para confirmar el pago de ${plan.name} (€${plan.price}/mes)`,
      });
      return;
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "craftershopy@gmail.com";
    const subject = encodeURIComponent(`Solicitud de upgrade al plan ${plan.name}`);
    const body = encodeURIComponent(
      `Hola,\n\nQuiero actualizar mi plan a ${plan.name} (€${plan.price}/mes).\n\n` +
      `Mi ID de usuario: ${userId}\n\nGracias.`
    );
    const mailtoUrl = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;

    res.json({
      requiresManualPayment: true,
      checkoutUrl: mailtoUrl,
      plan,
      message: `Para activar el plan ${plan.name} (€${plan.price}/mes), contacta con soporte. Se generará un link de pago personalizado.`,
      contactEmail: ADMIN_EMAIL,
      price: plan.price,
      planName: plan.name,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err: msg }, "billing/upgrade error");
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/shopify/callback", async (req, res): Promise<void> => {
  try {
    const { state, code } = req.query as { state?: string; code?: string };
    if (!state) { res.status(400).json({ error: "Estado inválido" }); return; }

    const [planId, userId] = state.split("_");
    const plan = PLANS[planId];
    if (!plan || !userId) { res.status(400).json({ error: "Parámetros inválidos" }); return; }

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const updates = {
      plan: planId,
      status: "active",
      storesLimit: plan.storesLimit,
      imagesIncluded: plan.imagesIncluded,
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      cancelAtPeriodEnd: 0,
    };

    if (existing.length > 0) {
      await db.update(subscriptionsTable).set(updates).where(eq(subscriptionsTable.userId, userId));
    } else {
      await db.insert(subscriptionsTable).values({ userId, ...updates });
    }

    logger.info({ userId, planId, code }, "✅ Shopify billing callback processed");
    const APP_URL = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    res.redirect(`${APP_URL}/#billing?success=1&plan=${planId}`);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/affiliate", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, userId));
    if (!affiliate) { res.json({ affiliate: null }); return; }

    const referrals = await db.select().from(referralTrackingTable)
      .where(eq(referralTrackingTable.affiliateId, affiliate.id));

    res.json({ affiliate, referrals });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/billing/affiliate/join", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const existing = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, userId));
    if (existing.length > 0) { res.json({ affiliate: existing[0] }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const code = (user?.name || "user").toLowerCase().replace(/\s+/, "") + Math.random().toString(36).slice(2, 6);

    const [affiliate] = await db.insert(affiliatesTable).values({
      id: randomUUID(), userId, referralCode: code,
    }).returning();

    res.json({ affiliate, message: "¡Bienvenido al programa de afiliados!" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/invoices", async (req, res): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (!sub) { res.json([]); return; }

    const plan = PLANS[sub.plan as keyof typeof PLANS] ?? PLANS.trial;
    const invoices = [];
    if (sub.status === "active" && sub.currentPeriodEnd) {
      const months = Math.min(6, Math.max(1, Math.round((Date.now() - (sub.createdAt?.getTime?.() ?? Date.now())) / 2592000000) + 1));
      for (let i = 0; i < months; i++) {
        const date = new Date(Date.now() - i * 2592000000);
        invoices.push({
          id: `INV-${String(i + 1).padStart(3, "0")}`,
          date: date.toISOString(),
          amount: plan.price,
          plan: plan.name,
          status: "paid",
        });
      }
    }
    res.json(invoices);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/billing/admin/upgrade-user", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { userId, plan: planId, reason } = req.body as { userId: string; plan: string; reason?: string };

    if (!userId) { res.status(400).json({ error: "userId requerido" }); return; }
    if (!planId || !PLANS[planId]) {
      res.status(400).json({ error: "Plan no válido", validPlans: Object.keys(PLANS) });
      return;
    }

    const plan = PLANS[planId];
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + plan.periodDays);

    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const updates = {
      plan: planId,
      status: planId === "trial" ? "trialing" : "active",
      storesLimit: plan.storesLimit,
      imagesIncluded: plan.imagesIncluded,
      currentPeriodEnd: planId === "trial" ? null : periodEnd,
      trialEndsAt: planId === "trial" ? periodEnd : null,
      cancelAtPeriodEnd: 0,
    };

    if (existing.length > 0) {
      const [updated] = await db.update(subscriptionsTable)
        .set(updates)
        .where(eq(subscriptionsTable.userId, userId))
        .returning();
      logger.info({ targetUserId: userId, planId, reason }, "👑 Admin: plan actualizado manualmente");
      res.json({ subscription: updated, plan, message: `Usuario actualizado a ${plan.name}` });
    } else {
      const [created] = await db.insert(subscriptionsTable)
        .values({ userId, ...updates })
        .returning();
      logger.info({ targetUserId: userId, planId, reason }, "👑 Admin: suscripción creada manualmente");
      res.json({ subscription: created, plan, message: `Suscripción ${plan.name} creada para el usuario` });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/billing/admin/subscriptions", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const subs = await db.select({
      userId: subscriptionsTable.userId,
      plan: subscriptionsTable.plan,
      status: subscriptionsTable.status,
      trialEndsAt: subscriptionsTable.trialEndsAt,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      storesLimit: subscriptionsTable.storesLimit,
      imagesIncluded: subscriptionsTable.imagesIncluded,
      imagesUsed: subscriptionsTable.imagesUsed,
      createdAt: subscriptionsTable.createdAt,
      email: usersTable.email,
      name: usersTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
    .orderBy(subscriptionsTable.createdAt);

    res.json(subs);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
