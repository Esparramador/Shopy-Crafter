import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, abTestsTable, trackEventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify";
import { askClaudeWithBrain, learnFromOperation } from "../lib/claude";

const router = Router();

function calculateSignificance(
  aConversions: number, aVisitors: number,
  bConversions: number, bVisitors: number
): { confidence: number; winner: string } {
  if (aVisitors === 0 || bVisitors === 0) return { confidence: 0, winner: "" };

  const pA = aConversions / aVisitors;
  const pB = bConversions / bVisitors;
  const pPool = (aConversions + bConversions) / (aVisitors + bVisitors);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / aVisitors + 1 / bVisitors));

  if (se === 0) return { confidence: 0, winner: "" };

  const z = Math.abs(pA - pB) / se;
  const confidence = Math.min(99.9, (1 - 2 * (1 - normalCDF(z))) * 100);
  const winner = pB > pA ? "B" : "A";
  return { confidence: Math.round(confidence * 10) / 10, winner };
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-(z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

router.get("/admin/all-ab-tests", async (req, res): Promise<void> => {
  try {
    const projectFilter = req.query.projectId ? parseInt(req.query.projectId as string, 10) : null;
    const statusFilter = req.query.status as string | undefined;

    if (projectFilter !== null && isNaN(projectFilter)) {
      res.status(400).json({ error: "projectId inválido" });
      return;
    }
    if (statusFilter && !["running", "completed", "paused", "cancelled"].includes(statusFilter)) {
      res.status(400).json({ error: "status inválido" });
      return;
    }

    let tests;
    if (projectFilter) {
      tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectFilter));
    } else {
      tests = await db.select().from(abTestsTable);
    }

    if (statusFilter) {
      tests = tests.filter(t => t.status === statusFilter);
    }

    const projects = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable);
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    const mapped = tests.map(t => {
      const { confidence, winner: calcWinner } = calculateSignificance(
        t.variantAConversions, t.variantAVisitors,
        t.variantBConversions, t.variantBVisitors
      );
      return {
        id: String(t.id),
        projectId: t.projectId,
        projectName: projectMap.get(t.projectId) ?? "Unknown",
        productId: t.shopifyProductId,
        productTitle: t.productTitle,
        imageType: t.imageType,
        hypothesis: t.hypothesis,
        variantAVisitors: t.variantAVisitors,
        variantBVisitors: t.variantBVisitors,
        variantAConversions: t.variantAConversions,
        variantBConversions: t.variantBConversions,
        variantARevenue: t.variantARevenue,
        variantBRevenue: t.variantBRevenue,
        confidence,
        winner: t.winner ?? (confidence >= 95 ? calcWinner : null),
        status: t.status,
        targetMetric: t.targetMetric,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate?.toISOString() ?? null,
      };
    });

    res.json({
      tests: mapped,
      projects: projects.map(p => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    res.status(500).json({ error: "Error al cargar tests A/B" });
  }
});

router.get("/projects/:projectId/ab-tests", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const statusFilter = req.query.status as string | undefined;

  let tests = await db
    .select()
    .from(abTestsTable)
    .where(eq(abTestsTable.projectId, projectId));

  if (statusFilter) {
    tests = tests.filter((t) => t.status === statusFilter);
  }

  res.json(tests.map((t) => ({
    id: String(t.id),
    projectId: t.projectId,
    productId: t.shopifyProductId,
    productTitle: t.productTitle,
    imageType: t.imageType,
    hypothesis: t.hypothesis,
    variantAUrl: t.variantAUrl,
    variantBUrl: t.variantBUrl,
    variantAVisitors: t.variantAVisitors,
    variantBVisitors: t.variantBVisitors,
    variantAConversions: t.variantAConversions,
    variantBConversions: t.variantBConversions,
    variantARevenue: t.variantARevenue,
    variantBRevenue: t.variantBRevenue,
    confidence: t.confidence,
    winner: t.winner,
    status: t.status,
    targetMetric: t.targetMetric,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate?.toISOString() ?? null,
  })));
});

router.post("/projects/:projectId/ab-tests", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const { productId, imageType, hypothesis, targetMetric } = req.body as {
    productId: string; imageType: string; hypothesis: string;
    variantAImageId?: string; variantBImageId?: string; targetMetric: string;
  };

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));

  const [test] = await db.insert(abTestsTable).values({
    projectId,
    shopifyProductId: productId,
    productTitle: product?.title ?? productId,
    imageType,
    hypothesis,
    targetMetric,
    status: "running",
    startDate: new Date(),
  }).returning();

  res.status(201).json({
    id: String(test.id),
    projectId: test.projectId,
    productId: test.shopifyProductId,
    productTitle: test.productTitle,
    imageType: test.imageType,
    hypothesis: test.hypothesis,
    variantAUrl: test.variantAUrl,
    variantBUrl: test.variantBUrl,
    variantAVisitors: test.variantAVisitors,
    variantBVisitors: test.variantBVisitors,
    variantAConversions: test.variantAConversions,
    variantBConversions: test.variantBConversions,
    variantARevenue: test.variantARevenue,
    variantBRevenue: test.variantBRevenue,
    confidence: test.confidence,
    winner: test.winner,
    status: test.status,
    targetMetric: test.targetMetric,
    startDate: test.startDate.toISOString(),
    endDate: null,
  });
});

router.get("/projects/:projectId/ab-tests/:testId", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const testIdParam = Array.isArray(req.params.testId) ? req.params.testId[0] : req.params.testId;
  const testId = parseInt(testIdParam, 10);

  const [test] = await db
    .select()
    .from(abTestsTable)
    .where(and(eq(abTestsTable.id, testId), eq(abTestsTable.projectId, projectId)));

  if (!test) {
    res.status(404).json({ error: "Test no encontrado" });
    return;
  }

  const { confidence, winner } = calculateSignificance(
    test.variantAConversions, test.variantAVisitors,
    test.variantBConversions, test.variantBVisitors
  );

  res.json({
    id: String(test.id),
    projectId: test.projectId,
    productId: test.shopifyProductId,
    productTitle: test.productTitle,
    imageType: test.imageType,
    hypothesis: test.hypothesis,
    variantAUrl: test.variantAUrl,
    variantBUrl: test.variantBUrl,
    variantAVisitors: test.variantAVisitors,
    variantBVisitors: test.variantBVisitors,
    variantAConversions: test.variantAConversions,
    variantBConversions: test.variantBConversions,
    variantARevenue: test.variantARevenue,
    variantBRevenue: test.variantBRevenue,
    confidence,
    winner: test.winner,
    status: test.status,
    targetMetric: test.targetMetric,
    startDate: test.startDate.toISOString(),
    endDate: test.endDate?.toISOString() ?? null,
  });
});

router.post("/projects/:projectId/ab-tests/:testId/declare-winner", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
  const testId = parseInt(Array.isArray(req.params.testId) ? req.params.testId[0] : req.params.testId, 10);
  const { winner, applyToShopify } = req.body as { winner: string; applyToShopify: boolean };

  const [test] = await db
    .select()
    .from(abTestsTable)
    .where(and(eq(abTestsTable.id, testId), eq(abTestsTable.projectId, projectId)));

  if (!test) {
    res.status(404).json({ error: "Test no encontrado" });
    return;
  }

  const [updated] = await db
    .update(abTestsTable)
    .set({ winner, status: "completed", endDate: new Date() })
    .where(eq(abTestsTable.id, testId))
    .returning();

  // ShopyBrain aprende del ganador del A/B test (fire-and-forget)
  const [abProj] = await db.select({ storeNiche: projectsTable.storeNiche }).from(projectsTable).where(eq(projectsTable.id, projectId)).catch(() => [null]);
  learnFromOperation({
    operationType: "ab_winner",
    niche: abProj?.storeNiche ?? null,
    title: `A/B Winner: Variante ${winner} · ${test.productTitle}`,
    content: `Producto: ${test.productTitle}\nHipótesis: ${test.hypothesis}\nVariante ganadora: ${winner}\nTipo imagen: ${test.imageType}\nMétrica objetivo: ${test.targetMetric}\nConversiones A: ${test.variantAConversions}/${test.variantAVisitors} · B: ${test.variantBConversions}/${test.variantBVisitors}`,
    confidence: Math.min(0.95, (test.confidence ?? 50) / 100),
    tags: ["ab_test", test.imageType ?? "imagen", `winner_${winner.toLowerCase()}`],
  });

  res.json({
    id: String(updated.id),
    projectId: updated.projectId,
    productId: updated.shopifyProductId,
    productTitle: updated.productTitle,
    imageType: updated.imageType,
    hypothesis: updated.hypothesis,
    variantAUrl: updated.variantAUrl,
    variantBUrl: updated.variantBUrl,
    variantAVisitors: updated.variantAVisitors,
    variantBVisitors: updated.variantBVisitors,
    variantAConversions: updated.variantAConversions,
    variantBConversions: updated.variantBConversions,
    variantARevenue: updated.variantARevenue,
    variantBRevenue: updated.variantBRevenue,
    confidence: updated.confidence,
    winner: updated.winner,
    status: updated.status,
    targetMetric: updated.targetMetric,
    startDate: updated.startDate.toISOString(),
    endDate: updated.endDate?.toISOString() ?? null,
  });
});

router.get("/projects/:projectId/ab-dashboard", async (req, res): Promise<void> => {
  const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);

  const allTests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
  const activeTests = allTests.filter((t) => t.status === "running").length;
  const completedTests = allTests.filter((t) => t.status === "completed");
  const winners = completedTests.filter((t) => t.winner);
  const winRate = completedTests.length > 0 ? (winners.length / completedTests.length) * 100 : 0;

  const totalRevenueImpact = completedTests.reduce((sum, t) => {
    const lift = t.variantBConversions > t.variantAConversions ? t.variantBRevenue - t.variantARevenue : 0;
    return sum + lift;
  }, 0);

  const avgLift = completedTests.length > 0
    ? completedTests.reduce((sum, t) => {
      const pA = t.variantAVisitors > 0 ? t.variantAConversions / t.variantAVisitors : 0;
      const pB = t.variantBVisitors > 0 ? t.variantBConversions / t.variantBVisitors : 0;
      return sum + (pA > 0 ? ((pB - pA) / pA) * 100 : 0);
    }, 0) / completedTests.length
    : 0;

  const recentWinners = completedTests.slice(-5).map((t) => ({
    id: String(t.id),
    projectId: t.projectId,
    productId: t.shopifyProductId,
    productTitle: t.productTitle,
    imageType: t.imageType,
    hypothesis: t.hypothesis,
    variantAUrl: t.variantAUrl,
    variantBUrl: t.variantBUrl,
    variantAVisitors: t.variantAVisitors,
    variantBVisitors: t.variantBVisitors,
    variantAConversions: t.variantAConversions,
    variantBConversions: t.variantBConversions,
    variantARevenue: t.variantARevenue,
    variantBRevenue: t.variantBRevenue,
    confidence: t.confidence,
    winner: t.winner,
    status: t.status,
    targetMetric: t.targetMetric,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate?.toISOString() ?? null,
  }));

  res.json({
    activeTests,
    completedTests: completedTests.length,
    winRate: Math.round(winRate),
    totalRevenueImpact: Math.round(totalRevenueImpact * 100) / 100,
    avgConversionLift: Math.round(avgLift * 10) / 10,
    insight: completedTests.length > 0
      ? `Has completado ${completedTests.length} tests. La tasa de victoria es del ${Math.round(winRate)}%. Sigue generando tests para acumular datos de conversión.`
      : "Crea tu primer test A/B para empezar a medir el impacto de las imágenes en la conversión.",
    recentWinners,
  });
});

router.post("/track", async (req, res): Promise<void> => {
  const { testId, variant, eventType, productId, sessionId, revenue } = req.body;

  await db.insert(trackEventsTable).values({
    testId: String(testId),
    variant,
    eventType,
    shopifyProductId: String(productId),
    sessionId,
    revenue: revenue ?? null,
  });

  if (eventType === "conversion" || eventType === "add_to_cart") {
    const testIdNum = parseInt(String(testId), 10);
    if (!isNaN(testIdNum)) {
      const [test] = await db.select().from(abTestsTable).where(eq(abTestsTable.id, testIdNum));
      if (test) {
        if (variant === "A") {
          await db.update(abTestsTable).set({
            variantAVisitors: test.variantAVisitors + 1,
            variantAConversions: eventType === "conversion" ? test.variantAConversions + 1 : test.variantAConversions,
            variantARevenue: test.variantARevenue + (revenue ?? 0),
          }).where(eq(abTestsTable.id, testIdNum));
        } else {
          await db.update(abTestsTable).set({
            variantBVisitors: test.variantBVisitors + 1,
            variantBConversions: eventType === "conversion" ? test.variantBConversions + 1 : test.variantBConversions,
            variantBRevenue: test.variantBRevenue + (revenue ?? 0),
          }).where(eq(abTestsTable.id, testIdNum));
        }
      }
    }
  }

  res.json({ success: true, message: "Event tracked" });
});

export default router;
