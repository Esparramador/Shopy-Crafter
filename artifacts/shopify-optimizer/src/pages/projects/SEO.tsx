import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  useRunSeoAudit,
  useGenerateSchemas,
  useGenerateMetas,
  useGenerateSitemap,
  useFixAltTexts,
  useGetKeywordIntelligence,
  useGetBlogStrategy,
  useGenerateBlogPost,
  useAuditPageSpeed,
} from "@workspace/api-client-react";
import {
  Search,
  Globe,
  FileCode2,
  Zap,
  Edit3,
  Loader2,
  CheckCircle,
  ChevronRight,
  Tag,
  FileText,
  Image as ImageIcon,
  TrendingUp,
  Gauge,
  AlertTriangle,
  Monitor,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import SaveReportButton from "@/components/SaveReportButton";

export default function SEOPage() {
  const [, params] = useRoute("/projects/:id/seo");
  const projectId = parseInt(params?.id || "0");
  const { toast } = useToast();

  const [seoData, setSeoData] = useState<{
    globalScore?: number;
    missingMetas?: number;
    missingAlts?: number;
    issues?: string[];
    keywords?: string[];
  } | null>(null);

  const [schemas, setSchemas] = useState<{ generated?: number; preview?: string } | null>(null);
  const [metas, setMetas] = useState<{ updated?: number } | null>(null);
  const [altResult, setAltResult] = useState<{ fixed?: number } | null>(null);
  const [sitemapUrl, setSitemapUrl] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<{ primary?: string[]; secondary?: string[]; longTail?: string[] } | null>(null);
  const [blogStrategy, setBlogStrategy] = useState<{ pillars?: Array<{ title: string; words: number; difficulty: string }> } | null>(null);
  const [generatedPost, setGeneratedPost] = useState<{ title?: string; content?: string } | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<string>("");

  const [psUrl, setPsUrl] = useState("");
  const [psStrategy, setPsStrategy] = useState<"mobile" | "desktop">("mobile");
  const [psResult, setPsResult] = useState<{
    performanceScore?: number;
    seoScore?: number;
    accessibilityScore?: number;
    bestPracticesScore?: number;
    coreWebVitals?: Record<string, { value: number; unit: string; status: "good" | "needs-improvement" | "poor" }>;
    fieldData?: { category?: string | null; lcp?: string | null; cls?: string | null; inp?: string | null };
    issues?: string[];
    fixes?: string[];
    opportunities?: Array<{ title: string; savings: string; impact: "high" | "medium" | "low" }>;
  } | null>(null);

  const auditPageSpeed = useAuditPageSpeed();
  const runSeoAudit = useRunSeoAudit();
  const generateSchemas = useGenerateSchemas();
  const generateMetas = useGenerateMetas();
  const generateSitemap = useGenerateSitemap();
  const fixAltTexts = useFixAltTexts();
  const getKeywords = useGetKeywordIntelligence();
  const getBlogStrategy = useGetBlogStrategy();
  const generateBlogPost = useGenerateBlogPost();

  const handleAudit = () => {
    runSeoAudit.mutate(
      { projectId },
      {
        onSuccess: (data) => {
          setSeoData(data as typeof seoData);
          toast({ title: "Auditoría SEO completada" });
        },
        onError: () => toast({ title: "Error en auditoría SEO", variant: "destructive" }),
      }
    );
  };

  const handleSchemas = () => {
    generateSchemas.mutate(
      { projectId, data: { applyToShopify: false } },
      {
        onSuccess: (data) => {
          setSchemas(data as typeof schemas);
          toast({ title: `Schemas generados para ${(data as { generated?: number }).generated ?? 0} productos` });
        },
        onError: () => toast({ title: "Error generando schemas", variant: "destructive" }),
      }
    );
  };

  const handleMetas = () => {
    generateMetas.mutate(
      { projectId, data: { applyToShopify: false } },
      {
        onSuccess: (data) => {
          setMetas(data as typeof metas);
          toast({ title: `Metas actualizadas: ${(data as { updated?: number }).updated ?? 0} productos` });
        },
        onError: () => toast({ title: "Error generando metas", variant: "destructive" }),
      }
    );
  };

  const handleSitemap = () => {
    generateSitemap.mutate(
      { projectId },
      {
        onSuccess: (data) => {
          const url = (data as { sitemapUrl?: string }).sitemapUrl;
          setSitemapUrl(url ?? "Generado");
          toast({ title: "Sitemap generado y ping a Google enviado" });
        },
        onError: () => toast({ title: "Error generando sitemap", variant: "destructive" }),
      }
    );
  };

  const handleFixAlts = () => {
    fixAltTexts.mutate(
      { projectId },
      {
        onSuccess: (data) => {
          setAltResult(data as typeof altResult);
          toast({ title: `Alt texts corregidos: ${(data as { fixed?: number }).fixed ?? 0} imágenes` });
        },
        onError: () => toast({ title: "Error corrigiendo alt texts", variant: "destructive" }),
      }
    );
  };

  const handlePageSpeed = () => {
    if (!psUrl.trim()) {
      toast({ title: "Ingresa una URL para analizar", variant: "destructive" });
      return;
    }
    auditPageSpeed.mutate(
      { projectId, data: { url: psUrl.trim(), strategy: psStrategy } as Parameters<typeof auditPageSpeed.mutate>[0]["data"] },
      {
        onSuccess: (data) => {
          setPsResult(data as typeof psResult);
          toast({ title: "Análisis PageSpeed completado" });
        },
        onError: () => toast({ title: "Error al analizar PageSpeed. Verifica que la URL sea pública.", variant: "destructive" }),
      }
    );
  };

  const handleKeywords = () => {
    getKeywords.mutate(
      { projectId, data: { productName: "" } },
      { onSuccess: (data) => setKeywords(data as typeof keywords) }
    );
  };

  const handleBlogStrategy = () => {
    getBlogStrategy.mutate(
      { projectId },
      { onSuccess: (data) => setBlogStrategy(data as typeof blogStrategy) }
    );
  };

  const handleGenerateBlogPost = (pillarTitle: string) => {
    generateBlogPost.mutate(
      { projectId, data: { topic: pillarTitle } as unknown as Parameters<typeof generateBlogPost.mutate>[0]["data"] },
      {
        onSuccess: (data) => {
          setGeneratedPost(data as typeof generatedPost);
          toast({ title: "Artículo generado" });
        },
        onError: () => toast({ title: "Error generando artículo", variant: "destructive" }),
      }
    );
  };

  const globalScore = seoData?.globalScore;
  const scoreColor = globalScore
    ? globalScore >= 90
      ? "#00d68f"
      : globalScore >= 70
      ? "#00b4d8"
      : globalScore >= 50
      ? "#ffd32a"
      : "#ff4757"
    : "#666";

  const scoreGrade = globalScore
    ? globalScore >= 90
      ? "A"
      : globalScore >= 75
      ? "B"
      : globalScore >= 60
      ? "C"
      : globalScore >= 45
      ? "D"
      : "F"
    : "–";

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">SEO Técnico & Contenido</h1>
          <p className="text-muted-foreground mt-1">Schemas, metas, alt texts, keywords y estrategia de blog.</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <SaveReportButton
            projectId={projectId}
            title="Informe SEO"
            fileType="seo_audit"
            category="seo"
            compact
            buildContent={() => {
              const score = seoData?.globalScore ?? 0;
              const issues = seoData?.issues || [];
              const kws = keywords;
              const ps = psResult;
              return `
<h2>Score SEO Global</h2>
<div class="metric-grid">
  <div class="metric-card"><div class="label">Score Global</div><div class="value">${score}/100</div></div>
  <div class="metric-card"><div class="label">Metas Faltantes</div><div class="value status-warn">${seoData?.missingMetas || 0}</div></div>
  <div class="metric-card"><div class="label">Alt Texts Faltantes</div><div class="value status-warn">${seoData?.missingAlts || 0}</div></div>
  ${schemas ? `<div class="metric-card"><div class="label">Schemas Generados</div><div class="value status-ok">${schemas.generated || 0}</div></div>` : ""}<!-- nosemgrep -->
</div>
${issues.length > 0 ? `<h2>Issues Detectados</h2><ul>${issues.map(i => `<li>${i}</li>`).join("")}</ul>` : ""}<!-- nosemgrep -->
${kws ? `<h2>Keywords</h2><h3>Primarias</h3><ul>${(kws.primary || []).map(k => `<li>${k}</li>`).join("")}</ul><h3>Long-Tail</h3><ul>${(kws.longTail || []).map(k => `<li>${k}</li>`).join("")}</ul>` : ""}<!-- nosemgrep -->
${ps ? `<h2>PageSpeed</h2><div class="metric-grid"><div class="metric-card"><div class="label">Performance</div><div class="value">${ps.performanceScore || 0}</div></div><div class="metric-card"><div class="label">SEO</div><div class="value">${ps.seoScore || 0}</div></div><div class="metric-card"><div class="label">Accessibility</div><div class="value">${ps.accessibilityScore || 0}</div></div></div>` : ""}<!-- nosemgrep -->
${blogStrategy?.pillars ? `<h2>Estrategia de Blog</h2><table><tr><th>Pilar</th><th>Palabras</th><th>Dificultad</th></tr>${blogStrategy.pillars.map(p => `<tr><td>${p.title}</td><td>${p.words}</td><td>${p.difficulty}</td></tr>`).join("")}</table>` : ""}`;<!-- nosemgrep -->
            }}
          />
          <button
            onClick={handleAudit}
            disabled={runSeoAudit.isPending}
            className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-60"
          >
            {runSeoAudit.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {runSeoAudit.isPending ? "Auditando..." : "Auditoría SEO"}
          </button>
        </div>
      </div>

      {/* Score + Issues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 col-span-1 md:col-span-2">
          <h2 className="text-xl font-bold text-foreground mb-6">One-Click Fixes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* JSON-LD */}
            <button
              onClick={handleSchemas}
              disabled={generateSchemas.isPending}
              className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-blue-500/5 hover:border-blue-500/20 transition-all group relative"
            >
              <FileCode2 className="w-6 h-6 text-blue-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-blue-400 transition-colors">
                Generar JSON-LD Schemas
              </h3>
              <p className="text-xs text-muted-foreground">Product, Organization, Breadcrumbs (Rich Results)</p>
              {generateSchemas.isPending && (
                <div className="absolute top-3 right-3">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                </div>
              )}
              {schemas && (
                <div className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {schemas.generated} schemas generados
                </div>
              )}
            </button>

            {/* Meta Tags */}
            <button
              onClick={handleMetas}
              disabled={generateMetas.isPending}
              className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-green-500/5 hover:border-green-500/20 transition-all group relative"
            >
              <Globe className="w-6 h-6 text-green-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-green-400 transition-colors">
                Meta Tags Masivos
              </h3>
              <p className="text-xs text-muted-foreground">Title y Description optimizados con keywords</p>
              {generateMetas.isPending && (
                <div className="absolute top-3 right-3">
                  <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                </div>
              )}
              {metas && (
                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {metas.updated} productos actualizados
                </div>
              )}
            </button>

            {/* Alt Texts */}
            <button
              onClick={handleFixAlts}
              disabled={fixAltTexts.isPending}
              className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-purple-500/5 hover:border-purple-500/20 transition-all group relative"
            >
              <ImageIcon className="w-6 h-6 text-purple-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-purple-400 transition-colors">
                Corregir Alt Texts
              </h3>
              <p className="text-xs text-muted-foreground">SEO descriptions para todas las imágenes del catálogo</p>
              {fixAltTexts.isPending && (
                <div className="absolute top-3 right-3">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                </div>
              )}
              {altResult && (
                <div className="mt-2 text-xs text-purple-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {altResult.fixed} alt texts corregidos
                </div>
              )}
            </button>

            {/* Sitemap */}
            <button
              onClick={handleSitemap}
              disabled={generateSitemap.isPending}
              className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-yellow-500/5 hover:border-yellow-500/20 transition-all group relative"
            >
              <Zap className="w-6 h-6 text-yellow-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-yellow-400 transition-colors">
                Sitemap XML + Ping Google
              </h3>
              <p className="text-xs text-muted-foreground">Sitemap de imágenes + notificación automática a Google</p>
              {generateSitemap.isPending && (
                <div className="absolute top-3 right-3">
                  <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                </div>
              )}
              {sitemapUrl && (
                <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Generado + Ping enviado
                </div>
              )}
            </button>
          </div>
        </GlassCard>

        {/* Score Card */}
        <GlassCard className="p-6 flex flex-col items-center justify-between text-center">
          <h3 className="text-lg font-bold text-foreground mb-4">Score SEO Global</h3>
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#ffffff15"
                strokeWidth="3"
              />
              {globalScore && (
                <path
                  strokeDasharray={`${globalScore}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-display font-bold" style={{ color: scoreColor }}>
                {scoreGrade}
              </span>
              {globalScore && (
                <span className="text-xs text-muted-foreground">{globalScore}/100</span>
              )}
            </div>
          </div>
          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Metas Faltantes</span>
              <span className={seoData ? "text-orange-400 font-bold" : "text-muted-foreground"}>
                {seoData ? `${seoData.missingMetas ?? 0} prods` : "–"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Imgs sin Alt</span>
              <span className={seoData ? "text-red-400 font-bold" : "text-muted-foreground"}>
                {seoData ? `${seoData.missingAlts ?? 0} imgs` : "–"}
              </span>
            </div>
          </div>
          {!seoData && (
            <p className="text-xs text-muted-foreground mt-4">
              Ejecuta la Auditoría SEO para ver tu score.
            </p>
          )}
        </GlassCard>
      </div>

      {/* SEO Issues */}
      {seoData?.issues && seoData.issues.length > 0 && (
        <GlassCard className="p-6 border-orange-500/20">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            Problemas Detectados
          </h2>
          <div className="space-y-2">
            {seoData.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                {issue}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* PageSpeed / Core Web Vitals */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <Gauge className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-foreground">Core Web Vitals — PageSpeed Insights</h2>
          {psResult?.performanceScore != null && (
            <span
              className="ml-auto text-xs font-bold px-2 py-1 rounded-md"
              style={{
                color: psResult.performanceScore >= 90 ? "#00d68f" : psResult.performanceScore >= 50 ? "#ffd32a" : "#ff4757",
                background: psResult.performanceScore >= 90 ? "#00d68f20" : psResult.performanceScore >= 50 ? "#ffd32a20" : "#ff475720",
              }}
            >
              {psResult.performanceScore}/100
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="url"
            value={psUrl}
            onChange={(e) => setPsUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePageSpeed()}
            placeholder="https://tu-tienda.myshopify.com/products/producto-hero"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400/40 transition-colors"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPsStrategy("mobile")}
              className={`px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 border transition-all ${psStrategy === "mobile" ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"}`}
            >
              <Smartphone className="w-4 h-4" /> Mobile
            </button>
            <button
              onClick={() => setPsStrategy("desktop")}
              className={`px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 border transition-all ${psStrategy === "desktop" ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"}`}
            >
              <Monitor className="w-4 h-4" /> Desktop
            </button>
            <button
              onClick={handlePageSpeed}
              disabled={auditPageSpeed.isPending}
              className="bg-cyan-500 text-black px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-cyan-400 disabled:opacity-60 transition-all"
            >
              {auditPageSpeed.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {auditPageSpeed.isPending ? "Analizando..." : "Analizar"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {psResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* 4 Lighthouse Scores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Rendimiento", score: psResult.performanceScore, color: "#00b4d8" },
                  { label: "SEO", score: psResult.seoScore, color: "#5b4eff" },
                  { label: "Accesibilidad", score: psResult.accessibilityScore, color: "#00d68f" },
                  { label: "Best Practices", score: psResult.bestPracticesScore, color: "#ffd32a" },
                ].map(({ label, score, color }) => {
                  const s = score ?? 0;
                  const c = s >= 90 ? "#00d68f" : s >= 50 ? "#ffd32a" : "#ff4757";
                  return (
                    <div key={label} className="bg-black/20 rounded-xl p-4 flex flex-col items-center text-center border border-white/5">
                      <div className="relative w-16 h-16 mb-2">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke={c} strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${s} 100`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold" style={{ color: c }}>{s}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Core Web Vitals Table */}
              {psResult.coreWebVitals && Object.keys(psResult.coreWebVitals).length > 0 && (
                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/5 border-b border-white/5">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métricas</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {Object.entries(psResult.coreWebVitals).map(([key, metric]) => {
                      const statusColor = metric.status === "good" ? "#00d68f" : metric.status === "needs-improvement" ? "#ffd32a" : "#ff4757";
                      const labels: Record<string, string> = {
                        lcp: "LCP — Largest Contentful Paint",
                        cls: "CLS — Cumulative Layout Shift",
                        inp: "INP — Interaction to Next Paint",
                        fcp: "FCP — First Contentful Paint",
                        tbt: "TBT — Total Blocking Time",
                        si: "SI — Speed Index",
                        tti: "TTI — Time to Interactive",
                        ttfb: "TTFB — Server Response Time",
                      };
                      return (
                        <div key={key} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                            <span className="text-sm text-muted-foreground">{labels[key] ?? key.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold" style={{ color: statusColor }}>
                              {metric.value}{metric.unit}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ color: statusColor, background: `${statusColor}15` }}
                            >
                              {metric.status === "good" ? "Bueno" : metric.status === "needs-improvement" ? "Mejorable" : "Malo"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Field Data Label */}
              {psResult.fieldData?.category && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Datos reales (CrUX):</span>
                  <span
                    className="font-semibold px-2 py-0.5 rounded-md text-xs"
                    style={{
                      color: psResult.fieldData.category === "FAST" ? "#00d68f" : psResult.fieldData.category === "AVERAGE" ? "#ffd32a" : "#ff4757",
                      background: psResult.fieldData.category === "FAST" ? "#00d68f20" : psResult.fieldData.category === "AVERAGE" ? "#ffd32a20" : "#ff475720",
                    }}
                  >
                    {psResult.fieldData.category}
                  </span>
                </div>
              )}

              {/* Opportunities */}
              {psResult.opportunities && psResult.opportunities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Oportunidades</h3>
                  {psResult.opportunities.map((opp, i) => (
                    <div key={i} className="flex items-center gap-3 bg-orange-500/5 border border-orange-500/10 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">{opp.title}</span>
                        <span className="text-xs text-orange-400 ml-2">{opp.savings}</span>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          color: opp.impact === "high" ? "#ff4757" : opp.impact === "medium" ? "#ffd32a" : "#00d68f",
                          background: opp.impact === "high" ? "#ff475715" : opp.impact === "medium" ? "#ffd32a15" : "#00d68f15",
                        }}
                      >
                        {opp.impact === "high" ? "Alto impacto" : opp.impact === "medium" ? "Medio" : "Bajo"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Issues + Fixes */}
              {psResult.issues && psResult.issues.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/20 rounded-xl p-4 border border-red-500/10">
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Problemas</h3>
                    <div className="space-y-2">
                      {psResult.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                  {psResult.fixes && psResult.fixes.length > 0 && (
                    <div className="bg-black/20 rounded-xl p-4 border border-green-500/10">
                      <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">Cómo Solucionar</h3>
                      <div className="space-y-2">
                        {psResult.fixes.map((fix, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                            {fix}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!psResult && !auditPageSpeed.isPending && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ingresa la URL de cualquier página de tu tienda para obtener su análisis Core Web Vitals en tiempo real.
          </p>
        )}
      </GlassCard>

      {/* Keyword Intelligence */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Keyword Intelligence</h2>
          </div>
          <button
            onClick={handleKeywords}
            disabled={getKeywords.isPending}
            className="text-sm bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            {getKeywords.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Analizar Keywords
          </button>
        </div>

        {keywords ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Primarias</h4>
              <div className="flex flex-wrap gap-1.5">
                {keywords.primary?.map((kw, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Secundarias</h4>
              <div className="flex flex-wrap gap-1.5">
                {keywords.secondary?.map((kw, i) => (
                  <span key={i} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Long-Tail</h4>
              <div className="flex flex-wrap gap-1.5">
                {keywords.longTail?.map((kw, i) => (
                  <span key={i} className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-md">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Haz clic en "Analizar Keywords" para que Claude genere una estrategia de keywords para tu nicho.
          </p>
        )}
      </GlassCard>

      {/* Blog Strategy */}
      <GlassCard className="p-6 border-primary/20">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Edit3 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">Estrategia de Contenido (Blog)</h2>
            <p className="text-muted-foreground text-sm">Pillar pages y cluster articles generados por Claude.</p>
          </div>
          <button
            onClick={handleBlogStrategy}
            disabled={getBlogStrategy.isPending}
            className="text-sm bg-white/5 border border-white/10 text-foreground px-4 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            {getBlogStrategy.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Generar Estrategia
          </button>
        </div>

        {blogStrategy?.pillars ? (
          <div className="space-y-3">
            {blogStrategy.pillars.map((pillar, i) => (
              <div
                key={i}
                className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{pillar.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pillar.words?.toLocaleString()} palabras • Dificultad: {pillar.difficulty}
                  </p>
                </div>
                <button
                  onClick={() => handleGenerateBlogPost(pillar.title)}
                  disabled={generateBlogPost.isPending}
                  className="flex-shrink-0 text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  {generateBlogPost.isPending && selectedPillar === pillar.title ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Edit3 className="w-3 h-3" />
                  )}
                  Generar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-black/20 rounded-xl p-6 border border-dashed border-white/10 text-center">
            <p className="text-sm text-muted-foreground">
              Haz clic en "Generar Estrategia" para crear tu plan de contenido.
            </p>
          </div>
        )}

        {/* Generated Blog Post Preview */}
        {generatedPost && (
          <div className="mt-6 bg-black/30 rounded-xl p-6 border border-green-500/20">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <h3 className="font-bold text-foreground">{generatedPost.title}</h3>
            </div>
            <div className="text-sm text-muted-foreground max-h-64 overflow-y-auto">
              {generatedPost.content}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
