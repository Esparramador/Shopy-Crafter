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
} from "@workspace/api-client-react";
import {
  Search,
  Globe,
  FileCode2,
  Zap,
  Link as LinkIcon,
  Edit3,
  Loader2,
  CheckCircle,
  ChevronRight,
  Tag,
  FileText,
  Image as ImageIcon,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

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

  const runSeoAudit = useRunSeoAudit();
  const generateSchemas = useGenerateSchemas();
  const generateMetas = useGenerateMetas();
  const generateSitemap = useGenerateSitemap();
  const fixAltTexts = useFixAltTexts();
  const getKeywords = useGetKeywordIntelligence(projectId);
  const getBlogStrategy = useGetBlogStrategy(projectId);
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
      { projectId },
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
      { projectId },
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

  const handleKeywords = () => {
    getKeywords.refetch().then(({ data }) => {
      if (data) setKeywords(data as typeof keywords);
    });
  };

  const handleBlogStrategy = () => {
    getBlogStrategy.refetch().then(({ data }) => {
      if (data) setBlogStrategy(data as typeof blogStrategy);
    });
  };

  const handleGenerateBlogPost = (pillarTitle: string) => {
    generateBlogPost.mutate(
      { projectId, data: { topic: pillarTitle } },
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

      {/* Keyword Intelligence */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Keyword Intelligence</h2>
          </div>
          <button
            onClick={handleKeywords}
            disabled={getKeywords.isFetching}
            className="text-sm bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            {getKeywords.isFetching ? (
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
            disabled={getBlogStrategy.isFetching}
            className="text-sm bg-white/5 border border-white/10 text-foreground px-4 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            {getBlogStrategy.isFetching ? (
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
