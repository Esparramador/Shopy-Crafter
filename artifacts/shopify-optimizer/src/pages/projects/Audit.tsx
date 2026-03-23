import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  useGetProjectProducts,
  useSyncProducts,
  useGetCatalogOpportunities,
  getGetProjectProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Search,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Package,
  ShoppingBag,
  Tag,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency, getGradeColor } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

type OppDifficulty = "Fácil" | "Media" | "Difícil";

const DIFFICULTY_COLOR: Record<OppDifficulty, string> = {
  Fácil: "text-green-400 bg-green-500/10 border-green-500/20",
  Media: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Difícil: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function AuditPage() {
  const [, params] = useRoute("/projects/:id/audit");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();

  const [filterGrade, setFilterGrade] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"products" | "opportunities">("products");
  const [scanStatus, setScanStatus] = useState<"idle" | "syncing" | "auditing">("idle");

  const { data, isLoading } = useGetProjectProducts(projectId, { grade: filterGrade || undefined });
  const syncProducts = useSyncProducts();
  const getCatalogOpps = useGetCatalogOpportunities();
  const oppsData = getCatalogOpps.data ?? [];
  const isLoadingOpps = getCatalogOpps.isPending;
  const refetchOpps = () => getCatalogOpps.mutate({ projectId });

  const handleScan = async () => {
    setScanStatus("syncing");
    try {
      await syncProducts.mutateAsync({ projectId });
      setScanStatus("auditing");
      await new Promise((r) => setTimeout(r, 500));
      await queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
    } finally {
      setScanStatus("idle");
    }
  };

  const isScanning = scanStatus !== "idle";
  const products = data?.products || [];

  const needImprovement =
    (data?.gradeCounts?.C || 0) + (data?.gradeCounts?.D || 0) + (data?.gradeCounts?.F || 0);
  const pctNeedImprovement = data?.total ? Math.round((needImprovement / data.total) * 100) : 0;
  const revImpact = data?.avgScore ? Math.round((100 - data.avgScore) * 12.5) : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Auditoría del Catálogo</h1>
          <p className="text-muted-foreground mt-1">
            {data?.total ? `Analizando ${data.total} productos` : "Escanea tu tienda para comenzar"}
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-70"
        >
          <RefreshCw className={`w-5 h-5 ${isScanning ? "animate-spin" : ""}`} />
          {scanStatus === "syncing"
            ? "Sincronizando Shopify..."
            : scanStatus === "auditing"
            ? "Calculando scores..."
            : "Escanear Tienda"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard delay={0.1} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Productos</p>
              <h3 className="text-2xl font-bold text-foreground">{data?.total || 0}</h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.2} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Score Promedio</p>
              <h3 className="text-2xl font-bold text-foreground">
                {data?.avgScore ? Math.round(data.avgScore) : 0}
                <span className="text-sm text-muted-foreground">/100</span>
              </h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.3} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Necesitan Mejora</p>
              <h3 className="text-2xl font-bold text-foreground">
                {needImprovement}
                <span className="text-sm text-muted-foreground ml-1">({pctNeedImprovement}%)</span>
              </h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.4} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Revenue Potencial</p>
              <h3 className="text-2xl font-bold text-[#00d68f]">+{formatCurrency(revImpact)}</h3>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Grade Distribution */}
      {data?.gradeCounts && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Distribución de Grados</h3>
            <div className="flex gap-2">
              {(["A", "B", "C", "D", "F"] as const).map((g) => (
                <div key={g} className="flex items-center gap-1">
                  <span
                    className="text-xs font-bold w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${getGradeColor(g)}20`, color: getGradeColor(g) }}
                  >
                    {g}
                  </span>
                  <span className="text-xs text-muted-foreground">{data.gradeCounts?.[g] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {(["A", "B", "C", "D", "F"] as const).map((g) => {
              const count = data.gradeCounts?.[g] || 0;
              const pct = data.total ? (count / data.total) * 100 : 0;
              return pct > 0 ? (
                <div
                  key={g}
                  style={{ width: `${pct}%`, backgroundColor: getGradeColor(g) }}
                  className="h-full"
                  title={`Grado ${g}: ${count}`}
                />
              ) : null;
            })}
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-0">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all ${
            activeTab === "products"
              ? "text-primary bg-primary/10 border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          Catálogo ({data?.total || 0})
        </button>
        <button
          onClick={() => {
            setActiveTab("opportunities");
            if (!oppsData) refetchOpps();
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all ${
            activeTab === "opportunities"
              ? "text-primary bg-primary/10 border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          Oportunidades de Catálogo
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Resultados</h2>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="bg-card border border-white/10 rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Todos los grados</option>
              {(["A", "B", "C", "D", "F"] as const).map((g) => (
                <option key={g} value={g}>
                  Grado {g} ({data?.gradeCounts?.[g] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {products.map((product, idx) => (
              <GlassCard
                key={product.id}
                delay={0.05 * (idx % 10)}
                hoverEffect
                className="p-0 flex flex-col md:flex-row border-white/5 overflow-hidden"
              >
                <div className="w-full md:w-36 h-44 md:h-auto bg-black/40 relative flex-shrink-0">
                  {product.images?.[0]?.src ? (
                    <img
                      src={product.images[0].src}
                      alt={product.title}
                      className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      Sin Imagen
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <GradeBadge grade={product.auditGrade} />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-0.5 line-clamp-2">{product.title}</h3>
                    <p className="text-primary font-medium text-sm">
                      {product.price ? formatCurrency(product.price) : "Sin precio"}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: "SEO", score: product.seoScore },
                        { label: "Img", score: product.imageScore },
                        { label: "Txt", score: product.descriptionScore },
                        { label: "Tít", score: product.titleScore },
                        { label: "Prc", score: product.priceScore },
                      ].map((axis, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${axis.score || 0}%`,
                                backgroundColor:
                                  (axis.score || 0) > 70
                                    ? "#00d68f"
                                    : (axis.score || 0) > 40
                                    ? "#ffd32a"
                                    : "#ff4757",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{axis.label}</span>
                        </div>
                      ))}
                    </div>

                    {product.auditProblems && product.auditProblems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {product.auditProblems.slice(0, 3).map((prob, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20"
                          >
                            {prob}
                          </span>
                        ))}
                        {product.auditProblems.length > 3 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground border border-white/10">
                            +{product.auditProblems.length - 3} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay productos. Haz clic en <strong>"Escanear Tienda"</strong> para sincronizar tu catálogo.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Opportunities Tab */}
      {activeTab === "opportunities" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Oportunidades de Catálogo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Productos que tu nicho demanda y que aún no tienes en tu tienda.
              </p>
            </div>
            <button
              onClick={() => refetchOpps()}
              className="flex items-center gap-2 text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              Analizar con IA
            </button>
          </div>

          {isLoadingOpps && (
            <div className="flex items-center justify-center py-20 gap-3">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
              <p className="text-muted-foreground">Claude analizando tu nicho...</p>
            </div>
          )}

          {oppsData && oppsData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {oppsData.map((opp, i) => {
                const difficulty = opp.sourcingDifficulty as OppDifficulty;
                const diffClass = DIFFICULTY_COLOR[difficulty] ?? "text-muted-foreground bg-white/5 border-white/10";
                return (
                  <GlassCard key={i} delay={0.05 * i} className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-foreground">{opp.productName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-md border flex-shrink-0 ${diffClass}`}>
                        {opp.sourcingDifficulty}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">{opp.whyItFits}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-semibold text-green-400">{opp.estimatedPriceRange}</span>
                      </div>
                      <button className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Crear Ficha
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {!isLoadingOpps && !oppsData?.length && (
            <div className="py-20 text-center">
              <Lightbulb className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Haz clic en <strong>"Analizar con IA"</strong> para que Claude detecte oportunidades de producto.
              </p>
              <p className="text-xs text-muted-foreground">
                (Requiere haber escaneado la tienda y configurado el nicho del proyecto)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
