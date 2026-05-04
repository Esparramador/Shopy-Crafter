import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, abTestsTable, trackEventsTable, cogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude";
import { enableLongRunning } from "../lib/long-running.js";
import { safeDecrypt } from "../lib/crypto.js";
import { requireProjectAccess } from "../lib/access.js";

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
        testType: t.testType,
        imageType: t.imageType,
        hypothesis: t.hypothesis,
        variantAPrice: t.variantAPrice,
        variantBPrice: t.variantBPrice,
        aiPrediction: t.aiPrediction,
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
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const statusFilter = req.query.status as string | undefined;
  
    let tests = await db
      .select()
      .from(abTestsTable)
      .where(eq(abTestsTable.projectId, projectId));
  
    if (statusFilter) {
      tests = tests.filter((t) => t.status === statusFilter);
    }
  
    res.json(tests.map((t) => {
      const { confidence: liveConfidence, winner: calcWinner } = calculateSignificance(
        t.variantAConversions, t.variantAVisitors,
        t.variantBConversions, t.variantBVisitors
      );
      return {
        id: String(t.id),
        projectId: t.projectId,
        productId: t.shopifyProductId,
        productTitle: t.productTitle,
        testType: t.testType,
        imageType: t.imageType,
        hypothesis: t.hypothesis,
        variantAUrl: t.variantAUrl,
        variantBUrl: t.variantBUrl,
        variantAPrice: t.variantAPrice,
        variantBPrice: t.variantBPrice,
        aiPrediction: t.aiPrediction,
        variantAVisitors: t.variantAVisitors,
        variantBVisitors: t.variantBVisitors,
        variantAConversions: t.variantAConversions,
        variantBConversions: t.variantBConversions,
        variantARevenue: t.variantARevenue,
        variantBRevenue: t.variantBRevenue,
        confidence: liveConfidence,
        winner: t.winner ?? (liveConfidence >= 95 ? calcWinner : null),
        status: t.status,
        targetMetric: t.targetMetric,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate?.toISOString() ?? null,
      };
    }));
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/ab-tests", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const { productId, imageType, hypothesis, targetMetric, testType, variantAPrice, variantBPrice } = req.body as {
      productId: string; imageType: string; hypothesis: string;
      variantAImageId?: string; variantBImageId?: string; targetMetric: string;
      testType?: string; variantAPrice?: string; variantBPrice?: string;
    };
  
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
  
    const effectiveTestType = testType || "image";
  
    let aiPrediction = null;
    if (effectiveTestType === "price" && variantAPrice && variantBPrice) {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      const [cogs] = await db.select().from(cogsTable).where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, productId)));
  
      try {
        aiPrediction = await askClaudeJsonWithBrain<{
          predictedConversionChangeA: string;
          predictedConversionChangeB: string;
          predictedRevenueImpactA: string;
          predictedRevenueImpactB: string;
          predictedMarginA: number;
          predictedMarginB: number;
          salesVolumeImpact: string;
          visualImpact: string;
          economicImpact: string;
          recommendation: string;
          riskLevel: string;
          priceElasticity: string;
        }>(
          projectId,
          `Predice el impacto de un test A/B de PRECIO para el producto "${product?.title ?? productId}".
  
  Hipótesis: ${hypothesis}
  Variante A (Control): €${variantAPrice} (precio actual)
  Variante B (Challenger): €${variantBPrice} (precio sugerido)
  COGS por unidad: €${cogs?.totalCogs ?? "desconocido"}
  Margen actual: ${cogs?.totalCogs ? `${((parseFloat(variantAPrice) - cogs.totalCogs) / parseFloat(variantAPrice) * 100).toFixed(1)}%` : "desconocido"}
  Nicho: ${project?.storeNiche ?? "e-commerce"}
  Audiencia: ${project?.targetAudience ?? "general"}
  
  Analiza y predice:
  1. Cómo afectará el cambio de precio a la tasa de conversión (para AMBAS variantes)
  2. Impacto estimado en revenue mensual (para AMBAS variantes)
  3. Margen de beneficio con cada precio
  4. Impacto en volumen de ventas
  5. Impacto visual en la percepción del cliente
  6. Impacto económico global del cambio
  7. Elasticidad de precio estimada para este tipo de producto
  8. Nivel de riesgo del cambio
  9. Recomendación: ¿vale la pena el test?
  
  Devuelve JSON:
  {
    "predictedConversionChangeA": "0% (baseline)",
    "predictedConversionChangeB": "+X% o -X%",
    "predictedRevenueImpactA": "€XXX/mes (baseline)",
    "predictedRevenueImpactB": "€XXX/mes estimado",
    "predictedMarginA": XX.X,
    "predictedMarginB": XX.X,
    "salesVolumeImpact": "Descripción del impacto en volumen",
    "visualImpact": "Cómo percibe el cliente el cambio de precio",
    "economicImpact": "Análisis económico completo",
    "recommendation": "Recomendación clara y accionable",
    "riskLevel": "bajo|medio|alto",
    "priceElasticity": "Elasticidad estimada para este nicho"
  }`,
          `You are a senior pricing strategist and behavioral economist. Analyze A/B price test scenarios with data-driven predictions. Respond in Spanish.`,
          "ab_test_prediction",
          project?.storeNiche ?? undefined
        );
      } catch {
        aiPrediction = null;
      }
    }
  
    const [test] = await db.insert(abTestsTable).values({
      projectId,
      shopifyProductId: productId,
      productTitle: product?.title ?? productId,
      testType: effectiveTestType,
      imageType: imageType || effectiveTestType,
      hypothesis,
      targetMetric: targetMetric || "conversion",
      variantAPrice: variantAPrice ?? null,
      variantBPrice: variantBPrice ?? null,
      aiPrediction: aiPrediction as Record<string, unknown> | null,
      status: "running",
      startDate: new Date(),
    }).returning();
  
    res.status(201).json({
      id: String(test.id),
      projectId: test.projectId,
      productId: test.shopifyProductId,
      productTitle: test.productTitle,
      testType: test.testType,
      imageType: test.imageType,
      hypothesis: test.hypothesis,
      variantAUrl: test.variantAUrl,
      variantBUrl: test.variantBUrl,
      variantAPrice: test.variantAPrice,
      variantBPrice: test.variantBPrice,
      aiPrediction: test.aiPrediction,
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/ab-tests/:testId", async (req, res): Promise<void> => {
  try {
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
  
    const { confidence } = calculateSignificance(
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/ab-tests/:testId/declare-winner", requireProjectAccess, async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const testId = parseInt(Array.isArray(req.params.testId) ? req.params.testId[0] : req.params.testId, 10);
    const { winner, applyToShopify } = req.body as { winner: string; applyToShopify?: boolean };
  
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

    // Apply winner real a Shopify: añade la imagen ganadora al producto
    // como imagen principal. Sólo si applyToShopify=true y hay creds.
    let appliedToShopify: { ok: boolean; message: string; imageId?: number | null } = { ok: false, message: "Sin aplicar (applyToShopify=false)" };
    if (applyToShopify) {
      try {
        const winnerUrl = winner === "B" ? test.variantBUrl : test.variantAUrl;
        if (!winnerUrl) {
          appliedToShopify = { ok: false, message: "La variante ganadora no tiene URL de imagen." };
        } else {
          const [proj] = await db
            .select({ accessToken: projectsTable.accessToken, shopDomain: projectsTable.shopDomain })
            .from(projectsTable)
            .where(eq(projectsTable.id, projectId));
          let adminToken = proj?.accessToken ? (safeDecrypt(proj.accessToken) || proj.accessToken) : (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "");
          let shopDomain = proj?.shopDomain || (process.env.SHOP_DOMAIN ?? "");
          if (!adminToken || !shopDomain) {
            appliedToShopify = { ok: false, message: "Faltan credenciales Shopify del proyecto." };
          } else if (!test.shopifyProductId) {
            appliedToShopify = { ok: false, message: "El test no tiene producto Shopify asociado." };
          } else {
            const adminDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
            const apiBase = `https://${adminDomain}/admin/api/2024-10`;
            const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken };
            // Extrae numeric id del GID si llega como gid://shopify/Product/123456
            const numericProductId = String(test.shopifyProductId).replace(/^.*\//, "");
            const r = await fetch(`${apiBase}/products/${numericProductId}/images.json`, {
              method: "POST",
              headers,
              body: JSON.stringify({ image: { src: winnerUrl, alt: `A/B Winner ${winner} · ${test.imageType ?? "image"}`, position: 1 } }),
            });
            if (r.ok) {
              const j: any = await r.json().catch(() => ({}));
              appliedToShopify = { ok: true, message: `Imagen ganadora ${winner} aplicada como imagen principal en Shopify.`, imageId: j?.image?.id ?? null };
            } else {
              const errText = await r.text().catch(() => "");
              appliedToShopify = { ok: false, message: `Shopify rechazó la actualización (${r.status}): ${errText.slice(0, 160)}` };
            }
          }
        }
      } catch (applyErr: any) {
        appliedToShopify = { ok: false, message: `Error aplicando a Shopify: ${applyErr?.message ?? String(applyErr)}` };
      }
    }
  
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
      appliedToShopify,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.get("/projects/:projectId/ab-dashboard", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/track", async (req, res): Promise<void> => {
  try {
    const { testId, variant, eventType, productId, sessionId, revenue } = req.body;
  
    await db.insert(trackEventsTable).values({
      testId: String(testId),
      variant,
      eventType,
      shopifyProductId: String(productId),
      sessionId,
      revenue: revenue ?? null,
    });
  
    const testIdNum = parseInt(String(testId), 10);
    if (!isNaN(testIdNum)) {
      const [test] = await db.select().from(abTestsTable).where(eq(abTestsTable.id, testIdNum));
      if (test && test.status === "running") {
        const isVisit = eventType === "visit";
        const isConversion = eventType === "conversion";
        if (variant === "A") {
          await db.update(abTestsTable).set({
            variantAVisitors: isVisit ? test.variantAVisitors + 1 : test.variantAVisitors,
            variantAConversions: isConversion ? test.variantAConversions + 1 : test.variantAConversions,
            variantARevenue: isConversion ? test.variantARevenue + (revenue ?? 0) : test.variantARevenue,
          }).where(eq(abTestsTable.id, testIdNum));
        } else {
          await db.update(abTestsTable).set({
            variantBVisitors: isVisit ? test.variantBVisitors + 1 : test.variantBVisitors,
            variantBConversions: isConversion ? test.variantBConversions + 1 : test.variantBConversions,
            variantBRevenue: isConversion ? test.variantBRevenue + (revenue ?? 0) : test.variantBRevenue,
          }).where(eq(abTestsTable.id, testIdNum));
        }
        const updatedA = variant === "A" ? test.variantAConversions + (isConversion ? 1 : 0) : test.variantAConversions;
        const updatedAv = variant === "A" && isVisit ? test.variantAVisitors + 1 : test.variantAVisitors;
        const updatedB = variant === "B" ? test.variantBConversions + (isConversion ? 1 : 0) : test.variantBConversions;
        const updatedBv = variant === "B" && isVisit ? test.variantBVisitors + 1 : test.variantBVisitors;
        const sig = calculateSignificance(updatedA, updatedAv, updatedB, updatedBv);
        if (sig.confidence > (test.confidence ?? 0)) {
          await db.update(abTestsTable).set({ confidence: sig.confidence }).where(eq(abTestsTable.id, testIdNum));
        }
      }
    }
  
    res.json({ success: true, message: "Event tracked" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
