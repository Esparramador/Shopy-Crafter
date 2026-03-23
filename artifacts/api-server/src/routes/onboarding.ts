import { Router } from "express";
import { db } from "@workspace/db";
import { onboardingProgressTable, achievementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const ACHIEVEMENTS_CATALOG = [
  { key: "first_audit", title: "Primer Análisis", description: "Completaste tu primera auditoría IA", icon: "🔍", xp: 100 },
  { key: "first_image", title: "Artista IA", description: "Generaste tu primera imagen con IA", icon: "🎨", xp: 150 },
  { key: "first_abtest", title: "Científico de Datos", description: "Lanzaste tu primer test A/B", icon: "📊", xp: 200 },
  { key: "first_price", title: "Estratega de Precios", description: "Optimizaste precios por primera vez", icon: "💰", xp: 150 },
  { key: "first_seo", title: "Maestro SEO", description: "Aplicaste optimización SEO", icon: "🔍", xp: 150 },
  { key: "first_client", title: "Agencia Pro", description: "Invitaste a tu primer cliente", icon: "👥", xp: 300 },
  { key: "onboarding_complete", title: "Setup Completo", description: "Completaste el proceso de setup", icon: "⚡", xp: 500 },
  { key: "revenue_1k", title: "€1K Atribuido", description: "Generaste €1,000 de revenue atribuido", icon: "💎", xp: 1000 },
  { key: "products_10", title: "Escala Máxima", description: "Optimizaste 10+ productos", icon: "🚀", xp: 500 },
  { key: "boost_masivo", title: "Boost Master", description: "Activaste Boost Masivo", icon: "⚡", xp: 250 },
];

router.get("/onboarding/progress", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [progress] = await db.select().from(onboardingProgressTable)
    .where(eq(onboardingProgressTable.userId, userId));

  if (!progress) {
    const [created] = await db.insert(onboardingProgressTable).values({ userId }).returning();
    res.json({ progress: created, achievements: [] });
    return;
  }

  const achievements = await db.select().from(achievementsTable)
    .where(eq(achievementsTable.userId, userId));

  res.json({ progress, achievements });
});

router.post("/onboarding/step", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { step, projectId } = req.body;
  const validSteps: Record<string, string> = {
    store_connected: "stepStoreConnected",
    audit_run: "stepAuditRun",
    image_generated: "stepImageGenerated",
    price_optimized: "stepPriceOptimized",
    ab_test_active: "stepAbTestActive",
    seo_applied: "stepSeoApplied",
    client_invited: "stepClientInvited",
  };

  const field = validSteps[step];
  if (!field) { res.status(400).json({ error: "Invalid step" }); return; }

  const existing = await db.select().from(onboardingProgressTable)
    .where(eq(onboardingProgressTable.userId, userId));

  let progress;
  if (existing.length === 0) {
    [progress] = await db.insert(onboardingProgressTable).values({
      userId, projectId, [field]: 1,
    }).returning();
  } else {
    [progress] = await db.update(onboardingProgressTable)
      .set({ [field]: 1, projectId, updatedAt: new Date() })
      .where(eq(onboardingProgressTable.userId, userId))
      .returning();
  }

  const steps = ["stepStoreConnected", "stepAuditRun", "stepImageGenerated",
    "stepPriceOptimized", "stepAbTestActive", "stepSeoApplied", "stepClientInvited"];
  const completed = steps.filter(s => (progress as any)[s] === 1).length;
  const completionPct = Math.round((completed / steps.length) * 100);

  await db.update(onboardingProgressTable)
    .set({ completionPct, onboardingCompleted: completionPct === 100 ? 1 : 0 })
    .where(eq(onboardingProgressTable.userId, userId));

  const achievementMap: Record<string, string> = {
    audit_run: "first_audit",
    image_generated: "first_image",
    ab_test_active: "first_abtest",
    price_optimized: "first_price",
    seo_applied: "first_seo",
    client_invited: "first_client",
  };

  let newAchievement = null;
  const achievementKey = achievementMap[step];
  if (achievementKey) {
    const exists = await db.select().from(achievementsTable)
      .where(eq(achievementsTable.achievementKey, achievementKey));
    if (exists.length === 0) {
      await db.insert(achievementsTable).values({ id: randomUUID(), userId, achievementKey });
      newAchievement = ACHIEVEMENTS_CATALOG.find(a => a.key === achievementKey);
    }
  }

  res.json({ progress: { ...progress, completionPct }, newAchievement, completionPct });
});

router.get("/onboarding/achievements-catalog", async (_req, res): Promise<void> => {
  res.json(ACHIEVEMENTS_CATALOG);
});

router.get("/achievements", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const unlocked = await db.select().from(achievementsTable)
    .where(eq(achievementsTable.userId, userId));

  const unlockedKeys = new Set(unlocked.map(a => a.achievementKey));
  const catalog = ACHIEVEMENTS_CATALOG.map(a => ({
    ...a,
    unlocked: unlockedKeys.has(a.key),
    unlockedAt: unlocked.find(u => u.achievementKey === a.key)?.unlockedAt ?? null,
  }));

  const totalXp = catalog.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0);
  res.json({ achievements: catalog, totalXp, unlocked: unlocked.length, total: ACHIEVEMENTS_CATALOG.length });
});

export default router;
