import { Router } from "express";
import { db } from "@workspace/db";
import {
  onboardingProgressTable, achievementsTable,
  projectsTable, auditResultsTable, generationJobsTable,
  abTestsTable, seoDataTable, priceHistoryTable, usersTable,
} from "@workspace/db";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { cached } from "../lib/cache.js";

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
  try {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const requestedProjectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : null;

    const projects = await db.select({ id: projectsTable.id, name: projectsTable.name, accessToken: projectsTable.accessToken, shopDomain: projectsTable.shopDomain }).from(projectsTable);

    if (requestedProjectId && !projects.find(p => p.id === requestedProjectId)) {
      res.status(404).json({ error: "Project not found" }); return;
    }

    const activeProject = requestedProjectId
      ? projects.find(p => p.id === requestedProjectId)!
      : projects[0] ?? null;
    const projectId = activeProject?.id ?? null;

    const storeConnected = activeProject ? !!activeProject.accessToken : false;

    let auditDone = false, imagesDone = false, priceDone = false, abDone = false, seoDone = false, clientDone = false;
    let auditCount = 0, imageCount = 0, priceCount = 0, abCount = 0, seoCount = 0, clientCount = 0;

    if (projectId) {
      const [auditRow] = await db.select({ c: sql<number>`count(*)::int` }).from(auditResultsTable).where(eq(auditResultsTable.projectId, projectId));
      auditCount = auditRow?.c ?? 0;
      auditDone = auditCount > 0;

      const [imgRow] = await db.select({ c: sql<number>`count(*)::int` }).from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
      imageCount = imgRow?.c ?? 0;
      imagesDone = imageCount > 0;

      const [priceRow] = await db.select({ c: sql<number>`count(*)::int` }).from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId));
      priceCount = priceRow?.c ?? 0;
      priceDone = priceCount > 0;

      const [abRow] = await db.select({ c: sql<number>`count(*)::int` }).from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
      abCount = abRow?.c ?? 0;
      abDone = abCount > 0;

      const [seoRow] = await db.select({ c: sql<number>`count(*)::int` }).from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
      seoCount = seoRow?.c ?? 0;
      seoDone = seoCount > 0;
    }

    const pidStr = projectId ? String(projectId) : null;
    const [clientRow] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable).where(
      pidStr
        ? and(eq(usersTable.role, "client"), eq(usersTable.clientId, pidStr))
        : and(eq(usersTable.role, "client"), isNotNull(usersTable.clientId))
    );
    clientCount = clientRow?.c ?? 0;
    clientDone = clientCount > 0;

    const stepResults: Record<string, boolean> = {
      stepStoreConnected: storeConnected,
      stepAuditRun: auditDone,
      stepImageGenerated: imagesDone,
      stepPriceOptimized: priceDone,
      stepAbTestActive: abDone,
      stepSeoApplied: seoDone,
      stepClientInvited: clientDone,
    };

    const stepFields = Object.keys(stepResults);
    const completed = stepFields.filter(k => stepResults[k]).length;
    const completionPct = Math.round((completed / stepFields.length) * 100);

    const progress = {
      stepStoreConnected: storeConnected ? 1 : 0,
      stepAuditRun: auditDone ? 1 : 0,
      stepImageGenerated: imagesDone ? 1 : 0,
      stepPriceOptimized: priceDone ? 1 : 0,
      stepAbTestActive: abDone ? 1 : 0,
      stepSeoApplied: seoDone ? 1 : 0,
      stepClientInvited: clientDone ? 1 : 0,
      completionPct,
      onboardingCompleted: completionPct === 100 ? 1 : 0,
    };

    const details = {
      projectId,
      projectName: activeProject?.name ?? null,
      projectCount: projects.length,
      auditCount,
      imageCount,
      priceCount,
      abCount,
      seoCount,
      clientCount,
    };

    const achievements = await cached(`achievements-${userId}`, 120_000, () =>
      db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId))
    );

    const dbProgress = await db.select().from(onboardingProgressTable)
      .where(eq(onboardingProgressTable.userId, userId));
    if (dbProgress.length === 0) {
      await db.insert(onboardingProgressTable).values({ userId, ...progress }).returning();
    } else {
      await db.update(onboardingProgressTable)
        .set({ ...progress, updatedAt: new Date() })
        .where(eq(onboardingProgressTable.userId, userId));
    }

    res.json({ progress, details, achievements });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/onboarding/step", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/onboarding/achievements-catalog", async (_req, res): Promise<void> => {
  try {
    res.json(ACHIEVEMENTS_CATALOG);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/achievements", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
