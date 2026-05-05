import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, productsTable, abTestsTable, trackEventsTable, cogsTable, supplierEntriesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { askClaudeJsonWithBrain, askClaudeWithVision, learnFromOperation, safeJsonParse } from "../lib/claude";
import { enableLongRunning } from "../lib/long-running.js";
import { safeDecrypt } from "../lib/crypto.js";
import { requireProjectAccess } from "../lib/access.js";
import { generateNanoBanana } from "../lib/nano-banana.js";
import { logger } from "../lib/logger.js";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __abFilename = fileURLToPath(import.meta.url);
const __abDirname = path.dirname(__abFilename);
const AB_REPORTS_DIR = path.join(__abDirname, "..", "public", "reports");

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function fmtPct(n: number): string { return `${(n * 100).toFixed(2)}%`; }
function fmtMoney(n: number, cur = "EUR"): string {
  try { return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur }).format(n || 0); }
  catch { return `${(n || 0).toFixed(2)} ${cur}`; }
}
function fmtNum(n: number): string { return new Intl.NumberFormat("es-ES").format(Math.round(n || 0)); }

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

router.get("/projects/:projectId/ab-tests/:testId", async (req, res, next): Promise<void> => {
  try {
    const projectId = parseInt(Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId, 10);
    const testIdParam = Array.isArray(req.params.testId) ? req.params.testId[0] : req.params.testId;
    if (testIdParam.startsWith("_") || /[^0-9]/.test(testIdParam)) { next(); return; }
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
        if (sig.confidence >= 95 && !test.winner && test.status === "running") {
          const autoWinner = sig.winner;
          if (autoWinner) {
            await db.update(abTestsTable).set({
              winner: autoWinner,
              status: "completed",
              endDate: new Date(),
              confidence: sig.confidence,
            }).where(eq(abTestsTable.id, testIdNum));
            try {
              const [abProj] = await db.select({ storeNiche: projectsTable.storeNiche }).from(projectsTable).where(eq(projectsTable.id, test.projectId));
              learnFromOperation({
                operationType: "ab_winner",
                niche: abProj?.storeNiche ?? null,
                title: `A/B Auto-Winner: Variante ${autoWinner} · ${test.productTitle}`,
                content: `Producto: ${test.productTitle}\nHipótesis: ${test.hypothesis}\nVariante ganadora (auto): ${autoWinner}\nConfianza: ${sig.confidence}%\nConversiones A: ${updatedA}/${updatedAv} · B: ${updatedB}/${updatedBv}`,
                confidence: Math.min(0.95, sig.confidence / 100),
                tags: ["ab_test", "auto_winner", `winner_${autoWinner.toLowerCase()}`],
              });
            } catch {}
          }
        }
      }
    }
  
    res.json({ success: true, message: "Event tracked" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────
// A/B TESTING v2.0 — Image wizard, price wizard, KPIs, lifecycle
// ─────────────────────────────────────────────────────────────────

const STYLE_PROMPTS: Record<string, string> = {
  lifestyle:  "professional ecommerce lifestyle photo, product naturally placed in real home setting, soft natural daylight, person interacting with product, ultra-realistic, magazine-quality composition, depth of field",
  studio:     "professional studio product photography, clean white seamless background, perfect three-point lighting, sharp focus, no shadows distractions, premium ecommerce hero shot, ultra high resolution",
  context:    "product photographed in its native usage environment, contextual storytelling, ambient cinematic lighting, professional ecommerce composition, ultra-realistic detail",
  detail:     "macro close-up product detail shot, showcasing texture and craftsmanship, dramatic studio lighting highlighting material quality, ultra sharp focus, premium ecommerce detail shot",
  minimalist: "minimalist editorial product photography, single solid pastel background, geometric composition, soft directional lighting, scandinavian aesthetic, premium clean ecommerce style",
};

function isPublicHttpUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (host.startsWith("172.")) {
      const second = parseInt(host.split(".")[1] || "0", 10);
      if (second >= 16 && second <= 31) return false;
    }
    if (host.startsWith("169.254.") || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch { return false; }
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }> {
  if (!isPublicHttpUrl(url)) throw new Error("URL no permitida (debe ser HTTP/HTTPS público)");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "error" });
    if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";
    if (ct.includes("png")) mediaType = "image/png";
    else if (ct.includes("webp")) mediaType = "image/webp";
    else if (ct.includes("gif")) mediaType = "image/gif";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error("Image too large (>8MB)");
    return { base64: buf.toString("base64"), mediaType };
  } finally {
    clearTimeout(t);
  }
}

function getProductImageUrl(product: { imagesJson: unknown } | null | undefined): string | null {
  if (!product?.imagesJson) return null;
  const arr = product.imagesJson as Array<{ src?: string; url?: string }> | null;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[0].src || arr[0].url || null;
}

function shapeProduct(p: typeof productsTable.$inferSelect, cogsRow?: typeof cogsTable.$inferSelect | null) {
  const arr = (p.imagesJson as Array<{ src?: string; url?: string }> | null) || [];
  const urls = arr.map(x => x.src || x.url).filter((x): x is string => !!x);
  const currentPrice = parseFloat(p.price || "0") || 0;
  const cogs = cogsRow?.totalCogs || 0;
  return {
    id: p.shopifyProductId,
    shopifyId: parseInt(p.shopifyProductId, 10) || 0,
    title: p.title,
    imageUrl: urls[0],
    imageUrls: urls,
    currentPrice,
    currency: "EUR",
    category: p.productType || undefined,
    cogsTotal: cogs > 0 ? cogs : undefined,
    marginPct: cogs > 0 && currentPrice > 0 ? ((currentPrice - cogs) / currentPrice) * 100 : undefined,
  };
}

async function shapeABTest(
  t: typeof abTestsTable.$inferSelect,
  ctx?: { productMap?: Map<string, typeof productsTable.$inferSelect>; cogsMap?: Map<string, typeof cogsTable.$inferSelect> },
): Promise<Record<string, unknown>> {
  let product: typeof productsTable.$inferSelect | undefined = ctx?.productMap?.get(t.shopifyProductId);
  if (!product && t.shopifyProductId && !ctx?.productMap) {
    const rows = await db.select().from(productsTable)
      .where(and(eq(productsTable.projectId, t.projectId), eq(productsTable.shopifyProductId, t.shopifyProductId)));
    product = rows[0];
  }
  let cogs: typeof cogsTable.$inferSelect | undefined = ctx?.cogsMap?.get(t.shopifyProductId);
  if (!cogs && product && !ctx?.cogsMap) {
    const rows = await db.select().from(cogsTable)
      .where(and(eq(cogsTable.projectId, t.projectId), eq(cogsTable.shopifyProductId, t.shopifyProductId)));
    cogs = rows[0];
  }

  const productShape = product ? shapeProduct(product, cogs) : {
    id: t.shopifyProductId, shopifyId: 0, title: t.productTitle,
    currentPrice: parseFloat(t.variantAPrice || "0") || 0, currency: "EUR",
  };

  const isImage = t.testType === "image";
  const config = isImage ? {
    type: "image" as const,
    productId: t.shopifyProductId,
    hypothesis: t.hypothesis,
    primaryMetric: t.targetMetric,
    secondaryMetrics: [],
    splitTraffic: 50,
    durationDays: 14,
    minVisitors: t.minimumSampleSize,
    minConfidence: 95,
    winnerStrategy: "auto_winner",
    autoApplyWinner: true,
    controlImageUrl: t.variantAUrl || "",
    challengerImageUrl: t.variantBUrl || "",
    challengerVariantId: t.variantBShopifyImageId || "",
  } : {
    type: "price" as const,
    productId: t.shopifyProductId,
    hypothesis: t.hypothesis,
    primaryMetric: t.targetMetric,
    secondaryMetrics: [],
    splitTraffic: 50,
    durationDays: 21,
    minVisitors: t.minimumSampleSize,
    minConfidence: 95,
    winnerStrategy: "manual_review",
    autoApplyWinner: false,
    controlPrice: parseFloat(t.variantAPrice || "0") || 0,
    challengerPrice: parseFloat(t.variantBPrice || "0") || 0,
    competitorContext: (t.aiPrediction as Record<string, unknown> | null)?.competitorContext || null,
    supplierContext: (t.aiPrediction as Record<string, unknown> | null)?.supplierContext || null,
  };

  const stats = computeStats(t);

  return {
    id: String(t.id),
    shopId: String(t.projectId),
    product: productShape,
    config,
    status: t.status,
    stats,
    createdAt: t.createdAt.toISOString(),
    startedAt: t.startDate.toISOString(),
    completedAt: t.endDate?.toISOString(),
    insights: (t.aiPrediction as Record<string, unknown> | null)?.insights || [],
  };
}

function computeStats(t: typeof abTestsTable.$inferSelect) {
  const aRate = t.variantAVisitors > 0 ? t.variantAConversions / t.variantAVisitors : 0;
  const bRate = t.variantBVisitors > 0 ? t.variantBConversions / t.variantBVisitors : 0;
  const aAov = t.variantAConversions > 0 ? t.variantARevenue / t.variantAConversions : 0;
  const bAov = t.variantBConversions > 0 ? t.variantBRevenue / t.variantBConversions : 0;
  const sig = calculateSignificance(t.variantAConversions, t.variantAVisitors, t.variantBConversions, t.variantBVisitors);
  const startMs = t.startDate.getTime();
  const endMs = t.endDate ? t.endDate.getTime() : Date.now();
  const daysElapsed = Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
  const targetDays = t.testType === "price" ? 21 : 14;
  return {
    variantA: {
      visitors: t.variantAVisitors, conversions: t.variantAConversions,
      conversionRate: aRate, revenue: t.variantARevenue, aov: aAov,
      addedToCart: t.variantAConversions,
    },
    variantB: {
      visitors: t.variantBVisitors, conversions: t.variantBConversions,
      conversionRate: bRate, revenue: t.variantBRevenue, aov: bAov,
      addedToCart: t.variantBConversions,
    },
    winner: t.winner as "A" | "B" | null,
    pValue: sig.confidence > 0 ? Math.max(0, (100 - sig.confidence) / 100) : 1,
    confidence: sig.confidence,
    isSignificant: sig.confidence >= 95,
    visitorsTotal: t.variantAVisitors + t.variantBVisitors,
    daysElapsed,
    daysRemaining: Math.max(0, targetDays - daysElapsed),
  };
}

// ─────── KPIs ───────
router.get("/projects/:projectId/ab-tests/_kpis", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }

    const tests = await db.select().from(abTestsTable).where(eq(abTestsTable.projectId, projectId));
    const active = tests.filter(t => t.status === "running" || t.status === "paused");
    const completed = tests.filter(t => t.status === "completed");
    const withWinner = completed.filter(t => !!t.winner);
    const winRate = completed.length > 0 ? (withWinner.length / completed.length) * 100 : 0;
    const avgConfidence = completed.length > 0
      ? completed.reduce((s, t) => s + (t.confidence || 0), 0) / completed.length
      : 0;

    const since = Date.now() - 30 * 86_400_000;
    const recent = completed.filter(t => (t.endDate?.getTime() ?? 0) >= since);
    const revenueImpact30d = recent.reduce((s, t) => {
      if (t.winner === "A") return s + (t.variantARevenue - t.variantBRevenue);
      if (t.winner === "B") return s + (t.variantBRevenue - t.variantARevenue);
      return s;
    }, 0);

    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const testsThisMonth = tests.filter(t => t.createdAt >= monthAgo).length;

    res.json({
      activeTests: active.length,
      completedTests: completed.length,
      winRate, avgConfidence,
      revenueImpact30d,
      testsThisMonth,
      totalLearnings: withWinner.length,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/projects/:projectId/ab-tests/_active", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
    const tests = await db.select().from(abTestsTable)
      .where(eq(abTestsTable.projectId, projectId))
      .orderBy(desc(abTestsTable.createdAt));
    const active = tests.filter(t => t.status === "running" || t.status === "paused");
    const productRows = await db.select().from(productsTable).where(eq(productsTable.projectId, projectId));
    const cogsRows = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const productMap = new Map(productRows.map(p => [p.shopifyProductId, p]));
    const cogsMap = new Map(cogsRows.map(c => [c.shopifyProductId, c]));
    const shaped = await Promise.all(active.map(t => shapeABTest(t, { productMap, cogsMap })));
    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/projects/:projectId/ab-tests/_history", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
    const limit = Math.min(parseInt((req.query.limit as string) || "20", 10) || 20, 100);

    const tests = await db.select().from(abTestsTable)
      .where(eq(abTestsTable.projectId, projectId))
      .orderBy(desc(abTestsTable.createdAt));
    const completed = tests.filter(t => t.status === "completed" || t.status === "cancelled").slice(0, limit);

    const productMap = new Map<string, typeof productsTable.$inferSelect>();
    for (const t of completed) {
      if (productMap.has(t.shopifyProductId)) continue;
      const [p] = await db.select().from(productsTable)
        .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, t.shopifyProductId)));
      if (p) productMap.set(t.shopifyProductId, p);
    }

    res.json(completed.map(t => {
      const product = productMap.get(t.shopifyProductId);
      const aRate = t.variantAVisitors > 0 ? t.variantAConversions / t.variantAVisitors : 0;
      const bRate = t.variantBVisitors > 0 ? t.variantBConversions / t.variantBVisitors : 0;
      const lift = aRate > 0 ? ((bRate - aRate) / aRate) * 100 : 0;
      const revenueDiff = t.winner === "A" ? t.variantARevenue - t.variantBRevenue
        : t.winner === "B" ? t.variantBRevenue - t.variantARevenue : 0;
      const startMs = t.startDate.getTime();
      const endMs = t.endDate?.getTime() ?? Date.now();
      return {
        id: String(t.id),
        productTitle: t.productTitle,
        productImageUrl: getProductImageUrl(product),
        type: t.testType === "price" ? "price" : "image",
        hypothesis: t.hypothesis,
        status: t.status,
        winnerVariant: t.winner as "A" | "B" | null,
        conversionLift: lift,
        revenueImpact: revenueDiff,
        durationDays: Math.max(0, Math.floor((endMs - startMs) / 86_400_000)),
        completedAt: (t.endDate ?? t.updatedAt).toISOString(),
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.get("/projects/:projectId/ab-tests/_products", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) { res.status(400).json({ error: "projectId inválido" }); return; }
    const products = await db.select().from(productsTable)
      .where(eq(productsTable.projectId, projectId))
      .orderBy(desc(productsTable.updatedAt))
      .limit(200);
    const cogsRows = await db.select().from(cogsTable).where(eq(cogsTable.projectId, projectId));
    const cogsMap = new Map(cogsRows.map(c => [c.shopifyProductId, c]));
    res.json(products.map(p => shapeProduct(p, cogsMap.get(p.shopifyProductId))));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ─────── IMAGE WIZARD ───────
router.post("/projects/:projectId/ab-tests/image/analyze", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { imageUrl } = req.body as { productId: string; imageUrl: string };
    if (Number.isNaN(projectId) || !imageUrl) { res.status(400).json({ error: "projectId e imageUrl requeridos" }); return; }

    const img = await fetchImageAsBase64(imageUrl);
    const prompt = `Analiza esta imagen de producto e-commerce y devuelve EXCLUSIVAMENTE un JSON con esta estructura (todos los scores son 0-10 excepto scoreOverall que es 0-100):

{
  "scoreOverall": <0-100, agregado ponderado>,
  "scoreComposition": <0-10>,
  "scoreLighting": <0-10>,
  "scoreContext": <0-10>,
  "scoreAppeal": <0-10>,
  "scoreClarity": <0-10>,
  "warnings": ["problema crítico 1", "problema crítico 2"],
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "improvementSuggestions": ["sugerencia accionable 1", "sugerencia 2"],
  "detectedElements": ["elemento visible 1", "elemento 2"]
}

Sé crítico y honesto. Una imagen genérica de fondo blanco mediocre debería rondar 50/100. Una foto profesional excepcional 85+. Responde SOLO el JSON.`;
    const text = await askClaudeWithVision(projectId, prompt, [img], "Eres un experto en fotografía de producto e-commerce. Analizas imágenes con criterio profesional crítico. SIEMPRE devuelves JSON válido.", 4096);
    const parsed = safeJsonParse<Record<string, unknown>>(text, "image-analyze");
    res.json({
      imageUrl,
      scoreOverall: Number(parsed.scoreOverall) || 0,
      scoreComposition: Number(parsed.scoreComposition) || 0,
      scoreLighting: Number(parsed.scoreLighting) || 0,
      scoreContext: Number(parsed.scoreContext) || 0,
      scoreAppeal: Number(parsed.scoreAppeal) || 0,
      scoreClarity: Number(parsed.scoreClarity) || 0,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvementSuggestions: Array.isArray(parsed.improvementSuggestions) ? parsed.improvementSuggestions : [],
      detectedElements: Array.isArray(parsed.detectedElements) ? parsed.detectedElements : [],
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "image/analyze failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error analizando imagen" });
  }
});

async function generateOneVariant(projectId: number, productId: string, style: string) {
  const stylePrompt = STYLE_PROMPTS[style];
  if (!stylePrompt) throw new Error(`Estilo desconocido: ${style}`);

  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
  if (!product) throw new Error("Producto no encontrado");

  const refUrl = getProductImageUrl(product);
  const references: { buffer: Buffer; mimeType: string }[] = [];
  if (refUrl) {
    try {
      const r = await fetchImageAsBase64(refUrl);
      references.push({ buffer: Buffer.from(r.base64, "base64"), mimeType: r.mediaType });
    } catch (e) {
      logger.warn({ err: e }, "Could not fetch reference image, generating without ref");
    }
  }

  const prompt = `${stylePrompt}. Product: "${product.title}"${product.productType ? ` (${product.productType})` : ""}. Maintain product identity from reference. Hero composition for ecommerce listing.`;

  const result = await generateNanoBanana(prompt, { references, aspectRatio: "1:1", outputFormat: "jpg" });
  const base64 = result.buffer.toString("base64");
  const dataUrl = `data:${result.mimeType};base64,${base64}`;

  const analysis = await analyzeImageBase64(projectId, base64, result.mimeType, dataUrl);

  return {
    id: `${productId}-${style}-${Date.now()}`,
    style,
    url: dataUrl,
    prompt,
    generationProvider: result.provider === "gemini" ? "gemini" : "replicate",
    generationCost: result.provider === "gemini" ? 0.04 : 0.30,
    analysis,
    generatedAt: new Date().toISOString(),
  };
}

async function analyzeImageBase64(projectId: number, base64: string, mimeType: string, imageUrl: string) {
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";
  if (mimeType.includes("png")) mediaType = "image/png";
  else if (mimeType.includes("webp")) mediaType = "image/webp";
  else if (mimeType.includes("gif")) mediaType = "image/gif";

  const prompt = `Analiza esta imagen de producto e-commerce y devuelve EXCLUSIVAMENTE JSON: { "scoreOverall": 0-100, "scoreComposition": 0-10, "scoreLighting": 0-10, "scoreContext": 0-10, "scoreAppeal": 0-10, "scoreClarity": 0-10, "warnings": [], "strengths": [], "improvementSuggestions": [], "detectedElements": [] }. Sé crítico.`;
  try {
    const text = await askClaudeWithVision(projectId, prompt, [{ base64, mediaType }], "Experto fotografía producto. JSON estricto.", 2048);
    const parsed = safeJsonParse<Record<string, unknown>>(text, "variant-analyze");
    return {
      imageUrl,
      scoreOverall: Number(parsed.scoreOverall) || 0,
      scoreComposition: Number(parsed.scoreComposition) || 0,
      scoreLighting: Number(parsed.scoreLighting) || 0,
      scoreContext: Number(parsed.scoreContext) || 0,
      scoreAppeal: Number(parsed.scoreAppeal) || 0,
      scoreClarity: Number(parsed.scoreClarity) || 0,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvementSuggestions: Array.isArray(parsed.improvementSuggestions) ? parsed.improvementSuggestions : [],
      detectedElements: Array.isArray(parsed.detectedElements) ? parsed.detectedElements : [],
      analyzedAt: new Date().toISOString(),
    };
  } catch (e) {
    logger.warn({ err: e }, "Variant analysis failed, returning baseline");
    return {
      imageUrl, scoreOverall: 0, scoreComposition: 0, scoreLighting: 0, scoreContext: 0, scoreAppeal: 0, scoreClarity: 0,
      warnings: ["Análisis IA no disponible"], strengths: [], improvementSuggestions: [], detectedElements: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}

router.post("/projects/:projectId/ab-tests/image/generate-variant", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { productId, style } = req.body as { productId: string; style: string };
    if (Number.isNaN(projectId) || !productId || !style) { res.status(400).json({ error: "Parámetros faltantes" }); return; }
    const v = await generateOneVariant(projectId, productId, style);
    res.json(v);
  } catch (err) {
    logger.error({ err }, "generate-variant failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error generando variante" });
  }
});

router.post("/projects/:projectId/ab-tests/image/generate-all", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { productId } = req.body as { productId: string };
    if (Number.isNaN(projectId) || !productId) { res.status(400).json({ error: "Parámetros faltantes" }); return; }
    const styles = ["lifestyle", "studio", "context", "detail"];
    const variants: unknown[] = [];
    for (const style of styles) {
      try {
        variants.push(await generateOneVariant(projectId, productId, style));
      } catch (e) {
        logger.warn({ err: e, style }, "Variant generation failed, skipping");
      }
    }
    if (variants.length === 0) { res.status(500).json({ error: "Ninguna variante pudo ser generada" }); return; }
    res.json(variants);
  } catch (err) {
    logger.error({ err }, "generate-all failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ─────── PRICE WIZARD ───────
router.post("/projects/:projectId/ab-tests/price/competitors", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { productId } = req.body as { productId: string };
    if (Number.isNaN(projectId) || !productId) { res.status(400).json({ error: "Parámetros faltantes" }); return; }

    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
    if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));

    const currentPrice = parseFloat(product.price || "0") || 0;
    const niche = proj?.storeNiche || "e-commerce";

    const prompt = `Analiza el rango de precios competitivo para este producto en el mercado europeo.

Producto: "${product.title}"
Categoría: ${product.productType || "general"}
Nicho de tienda: ${niche}
Precio actual: €${currentPrice.toFixed(2)}

Basándote en tu conocimiento del mercado para esta categoría, devuelve EXCLUSIVAMENTE este JSON:
{
  "min": <precio mínimo típico €>,
  "max": <precio máximo típico €>,
  "median": <precio mediano del mercado €>,
  "average": <precio medio €>,
  "yourPosition": "underpriced" | "fair" | "premium" | "overpriced",
  "percentileRank": <0-100, dónde está €${currentPrice} en la distribución>,
  "reasoning": "Explicación breve (max 200 palabras) del rango y posicionamiento, basada en categoría, calidad típica del mercado y comparables conocidos"
}

NO inventes URLs ni nombres de competidores específicos. Da rangos creíbles basados en mercado real.`;

    const text = await askClaudeJsonWithBrain<{
      min: number; max: number; median: number; average: number;
      yourPosition: "underpriced" | "fair" | "premium" | "overpriced";
      percentileRank: number; reasoning: string;
    }>(projectId, prompt, "Eres un analista de pricing senior con conocimiento profundo del mercado e-commerce europeo. Devuelves JSON estricto y honesto.", "ab_test_prediction", niche, 4096);

    res.json({
      productId,
      totalSourcesScraped: 0,
      competitors: [],
      priceStats: {
        min: text.min, max: text.max, median: text.median, average: text.average,
        yourPosition: text.yourPosition, percentileRank: text.percentileRank,
      },
      source: "ai_estimate",
      reasoning: text.reasoning,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "competitors analysis failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error analizando competencia" });
  }
});

router.post("/projects/:projectId/ab-tests/price/supplier-impact", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { productId } = req.body as { productId: string };
    if (Number.isNaN(projectId) || !productId) { res.status(400).json({ error: "Parámetros faltantes" }); return; }

    const [cogs] = await db.select().from(cogsTable)
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, productId)));
    if (!cogs || cogs.totalCogs <= 0) { res.status(404).json({ error: "Sin datos COGS para este producto" }); return; }

    const suppliers = await db.select().from(supplierEntriesTable)
      .where(eq(supplierEntriesTable.projectId, String(projectId)))
      .limit(20);

    if (suppliers.length === 0) { res.status(404).json({ error: "Sin proveedores alternativos investigados" }); return; }

    const currentCOGS = cogs.totalCogs;
    const options = suppliers
      .filter(s => s.priceRangeMin && s.priceRangeMin > 0)
      .map((s, idx) => {
        const cost = s.priceRangeMin || currentCOGS;
        return {
          supplierId: s.id,
          supplierName: s.name,
          costPerUnit: cost,
          totalCOGSImpact: cost,
          qualityScore: s.score ? s.score / 10 : 5,
          leadTimeDays: parseInt(s.leadDays || "0", 10) || 30,
          isCurrent: idx === 0,
          isRecommended: false,
          savingsPerUnit: Math.max(0, currentCOGS - cost),
        };
      })
      .sort((a, b) => a.costPerUnit - b.costPerUnit);

    if (options.length > 0) options[0].isRecommended = true;
    const bestCost = options[0]?.costPerUnit ?? currentCOGS;
    const savingsPerUnit = Math.max(0, currentCOGS - bestCost);

    // Anualización: derivada de ventas reales últimos 90d (track_events purchase
    // de tests de este producto en este proyecto), extrapoladas × 4.
    // Si no hay datos, devolvemos null (no inventamos volumen).
    const since90 = new Date(Date.now() - 90 * 86_400_000);
    const projectTests = await db.select({ id: abTestsTable.id }).from(abTestsTable)
      .where(and(eq(abTestsTable.projectId, projectId), eq(abTestsTable.shopifyProductId, productId)));
    const projectTestIds = new Set(projectTests.map(t => String(t.id)));
    let recentPurchases = 0;
    if (projectTestIds.size > 0) {
      const events = await db.select().from(trackEventsTable)
        .where(and(
          eq(trackEventsTable.shopifyProductId, productId),
          eq(trackEventsTable.eventType, "purchase"),
        ));
      recentPurchases = events.filter(e => e.createdAt >= since90 && projectTestIds.has(e.testId)).length;
    }
    const annualVolumeEstimated = recentPurchases > 0 ? recentPurchases * 4 : null;
    const potentialSavingsAnnual = annualVolumeEstimated !== null ? savingsPerUnit * annualVolumeEstimated : null;

    res.json({
      productId,
      currentCOGS,
      bestAlternativeCOGS: bestCost,
      potentialSavingsPerUnit: savingsPerUnit,
      potentialSavingsAnnual,
      annualVolumeBasis: annualVolumeEstimated !== null
        ? `Extrapolado de ${recentPurchases} compras en últimos 90 días`
        : "Sin datos suficientes de ventas para anualizar",
      options,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/projects/:projectId/ab-tests/price/recommend", async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { productId } = req.body as { productId: string };
    if (Number.isNaN(projectId) || !productId) { res.status(400).json({ error: "Parámetros faltantes" }); return; }

    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, productId)));
    const [cogs] = await db.select().from(cogsTable)
      .where(and(eq(cogsTable.projectId, projectId), eq(cogsTable.shopifyProductId, productId)));
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!product) { res.status(404).json({ error: "Producto no encontrado" }); return; }

    const currentPrice = parseFloat(product.price || "0") || 0;
    const cogsValue = cogs?.totalCogs || 0;
    const breakEven = cogs?.breakEvenPrice || cogsValue * 1.3;

    const prompt = `Recomienda 3 niveles de precio para este test A/B basándote en datos reales:

Producto: "${product.title}"
Categoría: ${product.productType || "general"}
Nicho: ${proj?.storeNiche || "e-commerce"}
Audiencia: ${proj?.targetAudience || "general"}
Precio actual: €${currentPrice.toFixed(2)}
COGS total: €${cogsValue.toFixed(2)}
Precio break-even: €${breakEven.toFixed(2)}
Margen actual: ${currentPrice > 0 ? (((currentPrice - cogsValue) / currentPrice) * 100).toFixed(1) : "0"}%

Devuelve EXCLUSIVAMENTE este JSON:
{
  "conservative": <precio €, cambio mínimo de bajo riesgo>,
  "optimal": <precio € recomendado IA, equilibrio óptimo>,
  "aggressive": <precio € maximizando margen aceptando riesgo>,
  "justification": "Justificación detallada (max 250 palabras) explicando lógica detrás de cada nivel, considerando elasticidad de precio del nicho, posicionamiento y márgenes",
  "risks": ["riesgo 1 concreto", "riesgo 2", "riesgo 3"]
}

Los precios deben ser realistas y respetar el break-even mínimo.`;

    const result = await askClaudeJsonWithBrain<{
      conservative: number; optimal: number; aggressive: number;
      justification: string; risks: string[];
    }>(projectId, prompt, "Eres un consultor senior de pricing strategy. Recomendaciones data-driven, justificadas, con análisis de riesgo realista.", "ab_test_prediction", proj?.storeNiche || undefined, 4096);

    res.json({
      conservative: result.conservative,
      optimal: result.optimal,
      aggressive: result.aggressive,
      justification: result.justification,
      risks: Array.isArray(result.risks) ? result.risks : [],
    });
  } catch (err) {
    logger.error({ err }, "price/recommend failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error generando recomendación" });
  }
});

// ─────── CREATE (new shape) ───────
router.post("/projects/:projectId/ab-tests/image", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const cfg = req.body as {
      productId: string; hypothesis: string; primaryMetric: string;
      controlImageUrl: string; challengerImageUrl: string; challengerVariantId: string;
      minVisitors: number;
    };
    if (Number.isNaN(projectId) || !cfg.productId || !cfg.controlImageUrl || !cfg.challengerImageUrl) {
      res.status(400).json({ error: "Parámetros faltantes" }); return;
    }
    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, cfg.productId)));

    const [test] = await db.insert(abTestsTable).values({
      projectId,
      shopifyProductId: cfg.productId,
      productTitle: product?.title ?? cfg.productId,
      testType: "image",
      imageType: "lifestyle",
      hypothesis: cfg.hypothesis,
      targetMetric: cfg.primaryMetric || "conversion",
      variantAUrl: cfg.controlImageUrl,
      variantBUrl: cfg.challengerImageUrl,
      variantBShopifyImageId: cfg.challengerVariantId,
      minimumSampleSize: cfg.minVisitors || 1000,
      status: "running",
      startDate: new Date(),
    }).returning();

    res.status(201).json(await shapeABTest(test));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/projects/:projectId/ab-tests/price", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const cfg = req.body as {
      productId: string; hypothesis: string; primaryMetric: string;
      controlPrice: number; challengerPrice: number;
      competitorContext: unknown; supplierContext: unknown;
      minVisitors: number;
    };
    if (Number.isNaN(projectId) || !cfg.productId || !cfg.controlPrice || !cfg.challengerPrice) {
      res.status(400).json({ error: "Parámetros faltantes" }); return;
    }
    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.projectId, projectId), eq(productsTable.shopifyProductId, cfg.productId)));

    const [test] = await db.insert(abTestsTable).values({
      projectId,
      shopifyProductId: cfg.productId,
      productTitle: product?.title ?? cfg.productId,
      testType: "price",
      imageType: "price",
      hypothesis: cfg.hypothesis,
      targetMetric: cfg.primaryMetric || "revenue_per_visitor",
      variantAPrice: String(cfg.controlPrice),
      variantBPrice: String(cfg.challengerPrice),
      aiPrediction: {
        competitorContext: cfg.competitorContext,
        supplierContext: cfg.supplierContext,
      } as Record<string, unknown>,
      minimumSampleSize: cfg.minVisitors || 1500,
      status: "running",
      startDate: new Date(),
    }).returning();

    res.status(201).json(await shapeABTest(test));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// ─────── LIFECYCLE ───────
async function setStatus(req: import("express").Request, res: import("express").Response, newStatus: string, finalize = false) {
  const projectId = parseInt(req.params.projectId, 10);
  const testId = parseInt(req.params.testId, 10);
  if (Number.isNaN(projectId) || Number.isNaN(testId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

  const updates: Record<string, unknown> = { status: newStatus };
  if (finalize) updates.endDate = new Date();
  if (newStatus === "running") updates.endDate = null;

  const [test] = await db.update(abTestsTable)
    .set(updates)
    .where(and(eq(abTestsTable.id, testId), eq(abTestsTable.projectId, projectId)))
    .returning();
  if (!test) { res.status(404).json({ error: "Test no encontrado" }); return; }
  res.json(await shapeABTest(test));
}

router.post("/projects/:projectId/ab-tests/:testId/start",  (req, res) => { void setStatus(req, res, "running"); });
router.post("/projects/:projectId/ab-tests/:testId/pause",  (req, res) => { void setStatus(req, res, "paused"); });
router.post("/projects/:projectId/ab-tests/:testId/resume", (req, res) => { void setStatus(req, res, "running"); });
router.post("/projects/:projectId/ab-tests/:testId/cancel", (req, res) => { void setStatus(req, res, "cancelled", true); });

router.get("/projects/:projectId/ab-tests/:testId/stats", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const testId = parseInt(req.params.testId, 10);
    if (Number.isNaN(projectId) || Number.isNaN(testId)) { res.status(400).json({ error: "IDs inválidos" }); return; }
    const [test] = await db.select().from(abTestsTable)
      .where(and(eq(abTestsTable.id, testId), eq(abTestsTable.projectId, projectId)));
    if (!test) { res.status(404).json({ error: "Test no encontrado" }); return; }
    res.json(computeStats(test));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

router.post("/projects/:projectId/ab-tests/:testId/report", requireProjectAccess, async (req, res): Promise<void> => {
  enableLongRunning(res);
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const testId = parseInt(String(req.params.testId), 10);
    if (Number.isNaN(projectId) || Number.isNaN(testId)) { res.status(400).json({ error: "IDs inválidos" }); return; }

    const [test] = await db.select().from(abTestsTable)
      .where(and(eq(abTestsTable.id, testId), eq(abTestsTable.projectId, projectId)));
    if (!test) { res.status(404).json({ error: "Test no encontrado" }); return; }

    const shaped = await shapeABTest(test) as Record<string, any>;
    const stats = shaped.stats as Record<string, any>;
    const product = shaped.product as Record<string, any>;
    const config = shaped.config as Record<string, any>;
    const currency = product?.currency || "EUR";
    const isImage = test.testType === "image";
    const winnerLetter = (test.winner as "A" | "B" | null) ?? (stats.isSignificant ? stats.winner : null);
    const winnerLabel = winnerLetter ? `Variante ${winnerLetter}` : "Sin ganador estadístico todavía";

    // Diferencias clave para narrativa
    const cvrDelta = stats.variantB.conversionRate - stats.variantA.conversionRate;
    const cvrLiftPct = stats.variantA.conversionRate > 0
      ? (cvrDelta / stats.variantA.conversionRate) * 100 : 0;
    const revenueDelta = stats.variantB.revenue - stats.variantA.revenue;

    // Narrativa Claude (con fallback robusto)
    type Narrative = {
      executiveSummary: string;
      keyFindings: string[];
      recommendation: string;
      risks: string[];
      nextSteps: string[];
    };
    let narrative: Narrative = {
      executiveSummary: `Test ${isImage ? "de imagen" : "de precio"} sobre "${test.productTitle}". ${stats.visitorsTotal} visitantes acumulados en ${stats.daysElapsed} días con ${stats.confidence.toFixed(1)}% de confianza estadística. ${winnerLabel}.`,
      keyFindings: [
        `Tasa de conversión A: ${fmtPct(stats.variantA.conversionRate)} · B: ${fmtPct(stats.variantB.conversionRate)} (Δ ${cvrLiftPct >= 0 ? "+" : ""}${cvrLiftPct.toFixed(1)}%)`,
        `Ingresos A: ${fmtMoney(stats.variantA.revenue, currency)} · B: ${fmtMoney(stats.variantB.revenue, currency)} (Δ ${fmtMoney(revenueDelta, currency)})`,
        `Significancia estadística: ${stats.isSignificant ? "alcanzada" : "no alcanzada"} (${stats.confidence.toFixed(1)}% / objetivo 95%)`,
      ],
      recommendation: stats.isSignificant && winnerLetter
        ? `Aplicar la variante ${winnerLetter} en producción y monitorizar 14 días post-lanzamiento.`
        : `Continuar el test ${stats.daysRemaining} días más o hasta alcanzar la muestra mínima.`,
      risks: [],
      nextSteps: [
        stats.isSignificant ? "Aplicar ganador a Shopify desde el panel" : "Mantener el test activo",
        "Documentar el aprendizaje en el Brain del proyecto",
      ],
    };

    try {
      const prompt = `Eres analista senior de A/B testing en e-commerce. Genera narrativa ejecutiva en español, profesional y sobria, basada SOLO en estos datos reales:

PRODUCTO: ${test.productTitle}
TIPO TEST: ${isImage ? "Imagen" : "Precio"}
HIPÓTESIS: ${test.hypothesis || "(no especificada)"}
MÉTRICA OBJETIVO: ${test.targetMetric}
ESTADO: ${test.status}
DÍAS TRANSCURRIDOS: ${stats.daysElapsed}
VARIANTE A: visitantes=${stats.variantA.visitors}, conversiones=${stats.variantA.conversions}, CVR=${fmtPct(stats.variantA.conversionRate)}, ingresos=${fmtMoney(stats.variantA.revenue, currency)}, AOV=${fmtMoney(stats.variantA.aov, currency)}
VARIANTE B: visitantes=${stats.variantB.visitors}, conversiones=${stats.variantB.conversions}, CVR=${fmtPct(stats.variantB.conversionRate)}, ingresos=${fmtMoney(stats.variantB.revenue, currency)}, AOV=${fmtMoney(stats.variantB.aov, currency)}
CONFIANZA: ${stats.confidence.toFixed(1)}%
SIGNIFICATIVO: ${stats.isSignificant}
GANADOR ACTUAL: ${winnerLabel}

Devuelve JSON estricto con esta forma exacta:
{
  "executiveSummary": "string 2-3 frases",
  "keyFindings": ["string", "string", "string"],
  "recommendation": "string accionable",
  "risks": ["string"],
  "nextSteps": ["string", "string"]
}

Reglas: nada de inventar cifras, no usar emojis, tono ejecutivo. Si los datos son insuficientes, dilo explícitamente.`;
      const ai = await askClaudeJsonWithBrain<Narrative>(
        projectId,
        prompt,
        "Eres un analista de e-commerce que produce informes ejecutivos en español. Solo respondes JSON válido.",
        "general",
        undefined,
        2000,
        45_000,
      );
      if (ai && typeof ai === "object" && ai.executiveSummary) {
        narrative = {
          executiveSummary: String(ai.executiveSummary),
          keyFindings: Array.isArray(ai.keyFindings) ? ai.keyFindings.map(String).slice(0, 6) : narrative.keyFindings,
          recommendation: String(ai.recommendation || narrative.recommendation),
          risks: Array.isArray(ai.risks) ? ai.risks.map(String).slice(0, 5) : [],
          nextSteps: Array.isArray(ai.nextSteps) ? ai.nextSteps.map(String).slice(0, 6) : narrative.nextSteps,
        };
      }
    } catch (e) {
      logger.warn({ err: e instanceof Error ? e.message : String(e) }, "[ab-report] Claude narrative failed, using fallback");
    }

    const generatedAt = new Date();
    const fileName = `ab-test-${test.id}-${generatedAt.getTime()}.html`;
    const filePath = path.join(AB_REPORTS_DIR, fileName);
    await fsp.mkdir(AB_REPORTS_DIR, { recursive: true });

    const variantAImg = isImage && test.variantAUrl ? `<img src="${escapeHtml(test.variantAUrl)}" alt="Variante A" />` : "";
    const variantBImg = isImage && test.variantBUrl ? `<img src="${escapeHtml(test.variantBUrl)}" alt="Variante B" />` : "";
    const variantAPriceRow = !isImage ? `<tr><td>Precio</td><td><strong>${fmtMoney(parseFloat(test.variantAPrice || "0"), currency)}</strong></td></tr>` : "";
    const variantBPriceRow = !isImage ? `<tr><td>Precio</td><td><strong>${fmtMoney(parseFloat(test.variantBPrice || "0"), currency)}</strong></td></tr>` : "";

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Informe A/B Test #${test.id} · ${escapeHtml(test.productTitle)}</title>
<style>
  :root { --bg:#0b0f17; --card:#111827; --line:#1f2937; --text:#e5e7eb; --muted:#9ca3af; --accent:#7c3aed; --good:#10b981; --bad:#ef4444; --warn:#f59e0b; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 24px 80px; }
  header { border-bottom:1px solid var(--line); padding-bottom:24px; margin-bottom:32px; }
  .eyebrow { color:var(--muted); text-transform:uppercase; letter-spacing:.12em; font-size:11px; font-weight:600; }
  h1 { font-size:28px; margin:8px 0 6px; font-weight:700; }
  h2 { font-size:18px; margin:32px 0 14px; font-weight:600; border-left:3px solid var(--accent); padding-left:12px; }
  .meta { display:flex; gap:24px; flex-wrap:wrap; color:var(--muted); font-size:13px; }
  .meta b { color:var(--text); font-weight:500; }
  .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
  .badge.win { background:rgba(16,185,129,.15); color:var(--good); }
  .badge.warn { background:rgba(245,158,11,.15); color:var(--warn); }
  .badge.muted { background:rgba(156,163,175,.15); color:var(--muted); }
  .summary { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; }
  .card h3 { margin:0 0 12px; font-size:15px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
  .card img { width:100%; border-radius:10px; margin-bottom:12px; max-height:280px; object-fit:cover; background:#000; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  table td { padding:8px 0; border-bottom:1px solid var(--line); }
  table td:first-child { color:var(--muted); }
  table td:last-child { text-align:right; }
  table tr:last-child td { border-bottom:0; }
  ul { margin:0; padding-left:20px; }
  ul li { margin-bottom:6px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; }
  .kpi .lbl { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
  .kpi .val { font-size:22px; font-weight:700; margin-top:4px; }
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; text-align:center; }
  @media print {
    body { background:#fff; color:#000; }
    .wrap { max-width:none; padding:24px; }
    .summary,.card,.kpi { background:#fafafa; border-color:#ddd; color:#000; }
    h2 { color:#000; }
    .meta,.kpi .lbl,table td:first-child { color:#444; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">Shopy Crafter · Informe A/B Test</div>
    <h1>${escapeHtml(test.productTitle)}</h1>
    <div class="meta">
      <span><b>Test #${test.id}</b></span>
      <span>Tipo: <b>${isImage ? "Imagen" : "Precio"}</b></span>
      <span>Estado: <b>${escapeHtml(test.status)}</b></span>
      <span>Inicio: <b>${test.startDate.toLocaleDateString("es-ES")}</b></span>
      <span>Días transcurridos: <b>${stats.daysElapsed}</b></span>
      <span>${stats.isSignificant
        ? `<span class="badge win">${escapeHtml(winnerLabel)} · ${stats.confidence.toFixed(1)}%</span>`
        : `<span class="badge warn">Sin significancia · ${stats.confidence.toFixed(1)}%</span>`}</span>
    </div>
  </header>

  <div class="kpis">
    <div class="kpi"><div class="lbl">Visitantes totales</div><div class="val">${fmtNum(stats.visitorsTotal)}</div></div>
    <div class="kpi"><div class="lbl">Conversiones (A+B)</div><div class="val">${fmtNum(stats.variantA.conversions + stats.variantB.conversions)}</div></div>
    <div class="kpi"><div class="lbl">Ingresos totales</div><div class="val">${fmtMoney(stats.variantA.revenue + stats.variantB.revenue, currency)}</div></div>
    <div class="kpi"><div class="lbl">Confianza</div><div class="val">${stats.confidence.toFixed(1)}%</div></div>
  </div>

  <h2>Resumen ejecutivo</h2>
  <div class="summary">
    <p style="margin:0 0 14px">${escapeHtml(narrative.executiveSummary)}</p>
    <p style="margin:0"><b>Recomendación:</b> ${escapeHtml(narrative.recommendation)}</p>
  </div>

  <h2>Comparativa de variantes</h2>
  <div class="grid2">
    <div class="card">
      <h3>Variante A · Control ${winnerLetter === "A" ? '<span class="badge win">Ganador</span>' : ""}</h3>
      ${variantAImg}
      <table>
        ${variantAPriceRow}
        <tr><td>Visitantes</td><td>${fmtNum(stats.variantA.visitors)}</td></tr>
        <tr><td>Conversiones</td><td>${fmtNum(stats.variantA.conversions)}</td></tr>
        <tr><td>Tasa conversión</td><td><strong>${fmtPct(stats.variantA.conversionRate)}</strong></td></tr>
        <tr><td>Ingresos</td><td>${fmtMoney(stats.variantA.revenue, currency)}</td></tr>
        <tr><td>AOV</td><td>${fmtMoney(stats.variantA.aov, currency)}</td></tr>
      </table>
    </div>
    <div class="card">
      <h3>Variante B · Challenger ${winnerLetter === "B" ? '<span class="badge win">Ganador</span>' : ""}</h3>
      ${variantBImg}
      <table>
        ${variantBPriceRow}
        <tr><td>Visitantes</td><td>${fmtNum(stats.variantB.visitors)}</td></tr>
        <tr><td>Conversiones</td><td>${fmtNum(stats.variantB.conversions)}</td></tr>
        <tr><td>Tasa conversión</td><td><strong>${fmtPct(stats.variantB.conversionRate)}</strong></td></tr>
        <tr><td>Ingresos</td><td>${fmtMoney(stats.variantB.revenue, currency)}</td></tr>
        <tr><td>AOV</td><td>${fmtMoney(stats.variantB.aov, currency)}</td></tr>
      </table>
    </div>
  </div>

  <h2>Hallazgos clave</h2>
  <div class="card"><ul>${narrative.keyFindings.map(k => `<li>${escapeHtml(k)}</li>`).join("")}</ul></div>

  ${narrative.risks.length ? `<h2>Riesgos</h2><div class="card"><ul>${narrative.risks.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>` : ""}

  <h2>Próximos pasos</h2>
  <div class="card"><ul>${narrative.nextSteps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>

  <h2>Hipótesis y configuración</h2>
  <div class="card">
    <table>
      <tr><td>Hipótesis</td><td style="text-align:left;max-width:60%">${escapeHtml(test.hypothesis || "—")}</td></tr>
      <tr><td>Métrica objetivo</td><td>${escapeHtml(test.targetMetric)}</td></tr>
      <tr><td>Tamaño muestra mínimo</td><td>${fmtNum(test.minimumSampleSize)}</td></tr>
      <tr><td>Duración objetivo</td><td>${isImage ? 14 : 21} días</td></tr>
      <tr><td>Estrategia ganador</td><td>${escapeHtml((config as any).winnerStrategy)}</td></tr>
    </table>
  </div>

  <footer>
    Generado por Shopy Crafter · ${generatedAt.toLocaleString("es-ES")} · Proyecto #${projectId}
    <br/>Imprime esta página (Cmd/Ctrl + P) para guardar como PDF.
  </footer>
</div>
</body>
</html>`;

    await fsp.writeFile(filePath, html, "utf8");

    // Registrar en Brain (no bloqueante)
    try {
      learnFromOperation({
        operationType: "ab_report",
        title: `Informe A/B Test #${test.id} · ${test.productTitle}`,
        content: `${narrative.executiveSummary}\n\nRecomendación: ${narrative.recommendation}`,
        tags: ["ab_test", "report", isImage ? "imagen" : "precio"],
        sourceProjectId: projectId,
        relatedProductId: test.shopifyProductId,
      });
    } catch (e) {
      logger.warn({ err: e instanceof Error ? e.message : String(e) }, "[ab-report] learnFromOperation failed");
    }

    res.json({
      reportUrl: `/api/reports/${fileName}`,
      fileName,
      generatedAt: generatedAt.toISOString(),
      test: shaped,
    });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[ab-report] failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Error generando informe" });
  }
});

export default router;
