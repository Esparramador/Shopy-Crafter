import { logger } from "./logger.js";

export interface PageSpeedResult {
  url: string;
  strategy: "mobile" | "desktop";
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  coreWebVitals: {
    lcp: { value: number | null; unit: string; status: string };
    cls: { value: number | null; unit: string; status: string };
    inp: { value: number | null; unit: string; status: string };
    fcp: { value: number | null; unit: string; status: string };
    tbt: { value: number | null; unit: string; status: string };
    si: { value: number | null; unit: string; status: string };
    tti: { value: number | null; unit: string; status: string };
    ttfb: { value: number | null; unit: string; status: string };
  };
  fieldData: {
    category: string | null;
    lcp: string | null;
    cls: string | null;
    inp: string | null;
  };
  issues: string[];
  fixes: string[];
  opportunities: Array<{ title: string; savings: string; impact: "high" | "medium" | "low" }>;
}

export async function runPageSpeedAudit(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<PageSpeedResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("GOOGLE_PAGESPEED_API_KEY no configurada");
  }

  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES`;

  let resp: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      resp = await fetch(psiUrl, { signal: AbortSignal.timeout(90_000) });
      if (resp.ok) break;
      if (resp.status >= 500 && attempt === 0) {
        logger.warn({ status: resp.status, url, attempt }, "PageSpeed API 5xx — retrying in 3s");
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      break;
    } catch (err) {
      if (attempt === 0) {
        logger.warn({ url, err: String(err) }, "PageSpeed fetch error — retrying in 3s");
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }

  if (!resp || !resp.ok) {
    const errText = resp ? await resp.text().catch(() => "") : "No response";
    logger.warn({ status: resp?.status, url, errText: String(errText).slice(0, 200) }, "PageSpeed API error");
    throw new Error(`PageSpeed API respondió ${resp?.status ?? "timeout"}`);
  }

  const data = await resp.json() as {
    lighthouseResult?: {
      categories?: {
        performance?: { score?: number };
        seo?: { score?: number };
        accessibility?: { score?: number };
        "best-practices"?: { score?: number };
      };
      audits?: Record<string, { numericValue?: number; displayValue?: string; score?: number }>;
    };
    loadingExperience?: {
      overall_category?: string;
      metrics?: {
        LARGEST_CONTENTFUL_PAINT_MS?: { percentile?: number; category?: string };
        CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile?: number; category?: string };
        INTERACTION_TO_NEXT_PAINT?: { percentile?: number; category?: string };
      };
    };
  };

  const lighthouse = data.lighthouseResult;
  const audits = lighthouse?.audits ?? {};
  const cats = lighthouse?.categories ?? {};
  const fieldMetrics = data.loadingExperience?.metrics ?? {};

  const perfScore = cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null;
  const seoScore = cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null;
  const accessScore = cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null;
  const bestScore = cats["best-practices"]?.score != null ? Math.round(cats["best-practices"].score * 100) : null;

  const lcpRaw = audits["largest-contentful-paint"]?.numericValue;
  const clsRaw = audits["cumulative-layout-shift"]?.numericValue;
  const fcpRaw = audits["first-contentful-paint"]?.numericValue;
  const tbtRaw = audits["total-blocking-time"]?.numericValue;
  const siRaw = audits["speed-index"]?.numericValue;
  const ttiRaw = audits["interactive"]?.numericValue;
  const inpRaw = audits["interaction-to-next-paint"]?.numericValue;
  const ttfbRaw = audits["server-response-time"]?.numericValue;

  const lcp = lcpRaw != null ? lcpRaw / 1000 : null;
  const cls = clsRaw ?? null;
  const fcp = fcpRaw != null ? fcpRaw / 1000 : null;
  const tbt = tbtRaw ?? null;
  const si = siRaw != null ? siRaw / 1000 : null;
  const tti = ttiRaw != null ? ttiRaw / 1000 : null;
  const inp = inpRaw ?? null;
  const ttfb = ttfbRaw ?? null;

  const issues: string[] = [];
  const fixes: string[] = [];
  const opportunities: Array<{ title: string; savings: string; impact: "high" | "medium" | "low" }> = [];

  if (lcp != null && lcp > 2.5) {
    issues.push(`LCP lento: ${lcp.toFixed(1)}s (objetivo <2.5s)`);
    fixes.push("Optimiza el elemento más grande de la vista: preload de imagen hero, compresión WebP, CDN con cache-control largo");
    opportunities.push({ title: "Mejorar LCP", savings: `${(lcp - 2.5).toFixed(1)}s más lento`, impact: "high" });
  }
  if (cls != null && cls > 0.1) {
    issues.push(`CLS alto: ${cls.toFixed(3)} (objetivo <0.1)`);
    fixes.push("Define width y height explícitos en imágenes y videos para eliminar layout shifts");
    opportunities.push({ title: "Reducir CLS", savings: `Score ${cls.toFixed(3)}`, impact: "high" });
  }
  if (tbt != null && tbt > 200) {
    issues.push(`TBT alto: ${tbt.toFixed(0)}ms (objetivo <200ms)`);
    fixes.push("Divide bundles JS con code splitting, aplica lazy loading de scripts no críticos");
    opportunities.push({ title: "Reducir TBT", savings: `${tbt.toFixed(0)}ms de bloqueo`, impact: "medium" });
  }
  if (inp != null && inp > 200) {
    issues.push(`INP alto: ${inp.toFixed(0)}ms (objetivo <200ms)`);
    fixes.push("Aplica async/defer a scripts no críticos, optimiza event listeners pesados");
  }
  if (ttfb != null && ttfb > 600) {
    issues.push(`TTFB lento: ${ttfb.toFixed(0)}ms (objetivo <600ms)`);
    fixes.push("Activa Shopify CDN en todas las regiones, considera edge caching para páginas de producto");
    opportunities.push({ title: "Reducir TTFB", savings: `${ttfb.toFixed(0)}ms servidor`, impact: "medium" });
  }
  if (fcp != null && fcp > 1.8) {
    issues.push(`FCP lento: ${fcp.toFixed(1)}s (objetivo <1.8s)`);
    fixes.push("Inline el CSS crítico, elimina render-blocking resources del <head>");
  }

  const metricStatus = (val: number | null, good: number, mid: number) =>
    val == null ? "unknown" : val <= good ? "good" : val <= mid ? "needs-improvement" : "poor";

  const fmt = (val: number | null, decimals: number) => val != null ? parseFloat(val.toFixed(decimals)) : null;

  return {
    url,
    strategy,
    performanceScore: perfScore,
    seoScore,
    accessibilityScore: accessScore,
    bestPracticesScore: bestScore,
    coreWebVitals: {
      lcp: { value: fmt(lcp, 2), unit: "s", status: metricStatus(lcp, 2.5, 4) },
      cls: { value: fmt(cls, 3), unit: "", status: metricStatus(cls, 0.1, 0.25) },
      inp: { value: inp, unit: "ms", status: metricStatus(inp, 200, 500) },
      fcp: { value: fmt(fcp, 2), unit: "s", status: metricStatus(fcp, 1.8, 3) },
      tbt: { value: tbt, unit: "ms", status: metricStatus(tbt, 200, 600) },
      si: { value: fmt(si, 2), unit: "s", status: metricStatus(si, 3.4, 5.8) },
      tti: { value: fmt(tti, 2), unit: "s", status: metricStatus(tti, 3.8, 7.3) },
      ttfb: { value: ttfb, unit: "ms", status: metricStatus(ttfb, 600, 1800) },
    },
    fieldData: {
      category: data.loadingExperience?.overall_category ?? null,
      lcp: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.category ?? null,
      cls: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category ?? null,
      inp: fieldMetrics.INTERACTION_TO_NEXT_PAINT?.category ?? null,
    },
    issues,
    fixes,
    opportunities,
  };
}

export async function runDualPageSpeed(url: string): Promise<{
  mobile: PageSpeedResult | null;
  desktop: PageSpeedResult | null;
  summary: string;
}> {
  const [mobileSettled, desktopSettled] = await Promise.allSettled([
    runPageSpeedAudit(url, "mobile"),
    runPageSpeedAudit(url, "desktop"),
  ]);

  const mobile = mobileSettled.status === "fulfilled" ? mobileSettled.value : null;
  const desktop = desktopSettled.status === "fulfilled" ? desktopSettled.value : null;

  if (!mobile && !desktop) {
    return { mobile: null, desktop: null, summary: "No se pudieron obtener datos de PageSpeed para esta URL." };
  }

  const lines: string[] = ["📊 DATOS REALES DE GOOGLE PAGESPEED INSIGHTS:"];

  const v = (val: number | null, unit: string) => val != null ? `${val}${unit}` : "N/A";

  const renderDevice = (label: string, d: PageSpeedResult) => {
    lines.push(`\n${label}:`);
    lines.push(`  Rendimiento: ${d.performanceScore ?? "N/A"}/100 | SEO: ${d.seoScore ?? "N/A"}/100 | Accesibilidad: ${d.accessibilityScore ?? "N/A"}/100`);
    lines.push(`  Core Web Vitals: LCP=${v(d.coreWebVitals.lcp.value, "s")} (${d.coreWebVitals.lcp.status}), CLS=${v(d.coreWebVitals.cls.value, "")} (${d.coreWebVitals.cls.status}), INP=${v(d.coreWebVitals.inp.value, "ms")} (${d.coreWebVitals.inp.status})`);
    lines.push(`  FCP=${v(d.coreWebVitals.fcp.value, "s")}, TBT=${v(d.coreWebVitals.tbt.value, "ms")}, SI=${v(d.coreWebVitals.si.value, "s")}, TTI=${v(d.coreWebVitals.tti.value, "s")}, TTFB=${v(d.coreWebVitals.ttfb.value, "ms")}`);
    if (d.fieldData.category) lines.push(`  Experiencia de campo: ${d.fieldData.category}`);
    if (d.issues.length > 0) lines.push(`  Problemas: ${d.issues.join("; ")}`);
  };

  if (mobile) renderDevice("📱 MÓVIL", mobile);
  if (desktop) renderDevice("🖥️ ESCRITORIO", desktop);

  const allFixes = [...new Set([...(mobile?.fixes ?? []), ...(desktop?.fixes ?? [])])];
  if (allFixes.length > 0) {
    lines.push(`\n🔧 CORRECCIONES RECOMENDADAS:`);
    allFixes.forEach(f => lines.push(`  • ${f}`));
  }

  return { mobile, desktop, summary: lines.join("\n") };
}

export function formatPageSpeedForPrompt(ps: { mobile: PageSpeedResult | null; desktop: PageSpeedResult | null; summary: string }): string {
  return ps.summary;
}
