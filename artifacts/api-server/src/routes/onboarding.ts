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
  { key: "first_audit",          title: "Primer Análisis",      description: "Completaste tu primera auditoría IA",          icon: "🔍", xp: 100,  category: "audit",   target: 1 },
  { key: "audits_5",             title: "Analítico Serial",     description: "Completaste 5 auditorías IA",                  icon: "📋", xp: 300,  category: "audit",   target: 5 },
  { key: "audits_20",            title: "Experto en Análisis",  description: "Completaste 20 auditorías IA",                 icon: "🏅", xp: 750,  category: "audit",   target: 20 },
  { key: "first_image",          title: "Artista IA",           description: "Generaste tu primera imagen con IA",           icon: "🎨", xp: 150,  category: "image",   target: 1 },
  { key: "images_10",            title: "Creador Visual",       description: "Generaste 10 imágenes con IA",                 icon: "🖼️", xp: 400,  category: "image",   target: 10 },
  { key: "images_50",            title: "Estudio de Arte IA",   description: "Generaste 50 imágenes con IA",                 icon: "🎭", xp: 1000, category: "image",   target: 50 },
  { key: "first_abtest",         title: "Científico de Datos",  description: "Lanzaste tu primer test A/B",                  icon: "📊", xp: 200,  category: "abtest",  target: 1 },
  { key: "abtests_5",            title: "Optimizador",          description: "Lanzaste 5 tests A/B",                        icon: "🧪", xp: 600,  category: "abtest",  target: 5 },
  { key: "first_price",          title: "Estratega de Precios", description: "Optimizaste precios por primera vez",          icon: "💰", xp: 150,  category: "price",   target: 1 },
  { key: "prices_10",            title: "Alquimista del Precio", description: "Optimizaste precios de 10 productos",         icon: "💹", xp: 500,  category: "price",   target: 10 },
  { key: "first_seo",            title: "Maestro SEO",          description: "Aplicaste optimización SEO",                  icon: "🔎", xp: 150,  category: "seo",     target: 1 },
  { key: "seo_10",               title: "SEO Pro",              description: "Optimizaste SEO en 10 productos",             icon: "📈", xp: 450,  category: "seo",     target: 10 },
  { key: "first_client",         title: "Agencia Pro",          description: "Invitaste a tu primer cliente",               icon: "👥", xp: 300,  category: "client",  target: 1 },
  { key: "clients_5",            title: "Agencia Élite",        description: "Gestiona 5 clientes activos",                 icon: "🏢", xp: 800,  category: "client",  target: 5 },
  { key: "onboarding_complete",  title: "Setup Completo",       description: "Completaste el proceso de setup",             icon: "⚡", xp: 500,  category: "onboard", target: 7 },
  { key: "revenue_1k",           title: "€1K Atribuido",        description: "Generaste €1,000 de revenue atribuido",       icon: "💎", xp: 1000, category: "revenue", target: 1000 },
  { key: "products_10",          title: "Escala Máxima",        description: "Optimizaste 10+ productos",                   icon: "🚀", xp: 500,  category: "products",target: 10 },
  { key: "boost_masivo",         title: "Boost Master",         description: "Activaste Boost Masivo",                      icon: "⚡", xp: 250,  category: "boost",   target: 1 },
  { key: "first_competitor",     title: "Espía de Mercado",     description: "Hiciste tu primer análisis de competidor",    icon: "🕵️", xp: 200,  category: "compete", target: 1 },
  { key: "brand_dna",            title: "ADN de Marca",         description: "Extrajiste el Brand DNA de tu tienda",        icon: "🧬", xp: 350,  category: "brand",   target: 1 },
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

    // Get real activity counts for progress bars
    const projects = await db.select({ id: projectsTable.id }).from(projectsTable);
    const projectId = projects[0]?.id ?? null;

    let auditCount = 0, imageCount = 0, priceCount = 0, abCount = 0, seoCount = 0, clientCount = 0;
    let completedSteps = 0;

    if (projectId) {
      const [a] = await db.select({ c: sql<number>`count(*)::int` }).from(auditResultsTable).where(eq(auditResultsTable.projectId, projectId));
      auditCount = a?.c ?? 0;
      const [i] = await db.select({ c: sql<number>`count(*)::int` }).from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId));
      imageCount = i?.c ?? 0;
      const [p] = await db.select({ c: sql<number>`count(*)::int` }).from(priceHistoryTable).where(eq(priceHistoryTable.projectId, projectId));
      priceCount = p?.c ?? 0;
      const [ab] = await db.select({ c: sql<number>`count(*)::int` }).from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
      abCount = ab?.c ?? 0;
      const [s] = await db.select({ c: sql<number>`count(*)::int` }).from(seoDataTable).where(eq(seoDataTable.projectId, projectId));
      seoCount = s?.c ?? 0;
      if (auditCount > 0) completedSteps++;
      if (imageCount > 0) completedSteps++;
      if (priceCount > 0) completedSteps++;
      if (abCount > 0) completedSteps++;
      if (seoCount > 0) completedSteps++;
    }
    const pidStr = projectId ? String(projectId) : null;
    const [cr] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable).where(
      pidStr ? and(eq(usersTable.role, "client"), eq(usersTable.clientId, pidStr))
             : and(eq(usersTable.role, "client"), isNotNull(usersTable.clientId))
    );
    clientCount = cr?.c ?? 0;
    if (clientCount > 0) completedSteps++;
    if (projects.length > 0 && projects[0]) completedSteps++;

    const progressMap: Record<string, number> = {
      audit:    auditCount,
      image:    imageCount,
      price:    priceCount,
      abtest:   abCount,
      seo:      seoCount,
      client:   clientCount,
      onboard:  completedSteps,
      revenue:  0,
      products: auditCount,
      boost:    0,
      compete:  0,
      brand:    0,
    };

    // Auto-unlock achievements based on real progress
    const unlockedKeys = new Set(unlocked.map(a => a.achievementKey));
    for (const ach of ACHIEVEMENTS_CATALOG) {
      const current = progressMap[ach.category] ?? 0;
      if (current >= ach.target && !unlockedKeys.has(ach.key)) {
        try {
          await db.insert(achievementsTable).values({ id: randomUUID(), userId, achievementKey: ach.key });
          unlockedKeys.add(ach.key);
        } catch { /* ignore duplicate */ }
      }
    }

    const freshUnlocked = await db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId));
    const freshKeys = new Set(freshUnlocked.map(a => a.achievementKey));

    const catalog = ACHIEVEMENTS_CATALOG.map(a => {
      const current = Math.min(progressMap[a.category] ?? 0, a.target);
      const progressPct = a.target > 0 ? Math.round((current / a.target) * 100) : 0;
      return {
        ...a,
        unlocked: freshKeys.has(a.key),
        unlockedAt: freshUnlocked.find(u => u.achievementKey === a.key)?.unlockedAt ?? null,
        progress: current,
        progressPct,
      };
    });

    const totalXp = catalog.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0);
    res.json({ achievements: catalog, totalXp, unlocked: freshUnlocked.length, total: ACHIEVEMENTS_CATALOG.length });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
