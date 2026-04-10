import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, affiliatesTable, referralTrackingTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const PLANS = {
  trial: { name: "Trial", price: 0, storesLimit: 1, imagesIncluded: 100, features: ["1 tienda", "100 imágenes IA", "Auditoría básica"] },
  starter: { name: "Starter", price: 97, storesLimit: 3, imagesIncluded: 500, features: ["3 tiendas", "500 imágenes IA", "Todas las funciones", "Soporte email"] },
  pro: { name: "Pro", price: 297, storesLimit: 10, imagesIncluded: 2000, features: ["10 tiendas", "2000 imágenes IA", "API access", "Soporte prioritario", "Afiliados"] },
  agency: { name: "Agency", price: 697, storesLimit: -1, imagesIncluded: -1, features: ["Tiendas ilimitadas", "Imágenes ilimitadas", "White label", "Soporte dedicado", "Revenue sharing"] },
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
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  
    const { plan } = req.body;
    if (!PLANS[plan as keyof typeof PLANS]) { res.status(400).json({ error: "Invalid plan" }); return; }
  
    const planData = PLANS[plan as keyof typeof PLANS];
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  
    const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    let sub;
    if (existing.length > 0) {
      [sub] = await db.update(subscriptionsTable)
        .set({ plan, status: "active", currentPeriodEnd: periodEnd, storesLimit: planData.storesLimit, imagesIncluded: planData.imagesIncluded })
        .where(eq(subscriptionsTable.userId, userId)).returning();
    } else {
      [sub] = await db.insert(subscriptionsTable).values({
        userId, plan, status: "active", currentPeriodEnd: periodEnd,
        storesLimit: planData.storesLimit, imagesIncluded: planData.imagesIncluded,
      }).returning();
    }
  
    res.json({ subscription: sub, message: `Actualizado a ${planData.name} (modo demo — Stripe pendiente de configurar)` });
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
    const invoices = [
      { id: "INV-001", date: new Date().toISOString(), amount: 297, plan: "Pro", status: "paid" },
      { id: "INV-002", date: new Date(Date.now() - 2592000000).toISOString(), amount: 297, plan: "Pro", status: "paid" },
    ];
    res.json(invoices);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
