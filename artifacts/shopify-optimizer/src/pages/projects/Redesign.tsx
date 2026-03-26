import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  useGetProjectProducts,
  useRedesignProduct,
  useApplyRedesign,
  useBulkRedesign,
  useGetGenerationJob,
  getGetProjectProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import GenerationProgress from "@/components/GenerationProgress";
import ReferenceMediaPanel from "@/components/ReferenceMediaPanel";
import {
  Wand2,
  Check,
  Loader2,
  X,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  BarChart2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import SaveReportButton from "@/components/SaveReportButton";

type RedesignResult = {
  title?: string;
  bodyHtml?: string;
  shortDescription?: string;
  price?: number;
  compareAtPrice?: number;
  tags?: string;
  metaTitle?: string;
  metaDescription?: string;
  photoBriefs?: string[];
};

function BulkProgressPoller({
  projectId,
  jobId,
  onComplete,
}: {
  projectId: number;
  jobId: string;
  onComplete: (data: unknown) => void;
}) {
  const { data } = useGetGenerationJob(projectId, jobId, {
    query: {
      queryKey: ["generation-job", projectId, jobId],
      refetchInterval: (query: { state: { data: unknown } }) => {
        const status = (query.state.data as { status?: string } | undefined)?.status;
        if (status === "completed" || status === "failed") return false;
        return 2000;
      },
    },
  });

  useEffect(() => {
    const status = (data as { status?: string } | undefined)?.status;
    if (status === "completed" || status === "failed") onComplete(data);
  }, [data, onComplete]);

  const progress = data as {
    status?: string;
    completed?: number;
    total?: number;
    log?: string[];
  } | undefined;

  return (
    <GlassCard className="p-5 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-sm font-semibold text-primary">
          Rediseñando catálogo... ({progress?.completed ?? 0}/{progress?.total ?? "?"})
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{
            width: progress?.total ? `${((progress.completed ?? 0) / progress.total) * 100}%` : "0%",
          }}
        />
      </div>
      {progress?.log && progress.log.length > 0 && (
        <p className="text-[10px] font-mono text-muted-foreground truncate">
          {progress.log[progress.log.length - 1]}
        </p>
      )}
    </GlassCard>
  );
}

function PhotoBriefsModal({
  briefs,
  productTitle,
  onClose,
}: {
  briefs: string[];
  productTitle: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const PHOTO_TYPES = ["Hero (Studio)", "Lifestyle", "Detalle/Macro", "Packaging"];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Photo Briefs</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{productTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {briefs.map((brief, i) => (
            <div key={i} className="bg-black/30 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                  {PHOTO_TYPES[i] ?? `Foto ${i + 1}`}
                </h4>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(brief);
                    toast({ title: "Brief copiado" });
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{brief}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function RedesignPage() {
  const [, params] = useRoute("/projects/:id/redesign");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetProjectProducts(projectId, { limit: 100 });
  const redesign = useRedesignProduct();
  const apply = useApplyRedesign();
  const bulkRedesign = useBulkRedesign();

  const [activeRedesign, setActiveRedesign] = useState<string | null>(null);
  const [redesignResults, setRedesignResults] = useState<Record<string, RedesignResult>>({});
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [referenceIntelligence, setReferenceIntelligence] = useState<string | null>(null);
  const [expandedHtml, setExpandedHtml] = useState<Record<string, boolean>>({});
  const [photoBriefsModal, setPhotoBriefsModal] = useState<{
    productId: string;
    title: string;
    briefs: string[];
  } | null>(null);

  const handleRedesign = (productId: string) => {
    setActiveRedesign(productId);
    redesign.mutate(
      { projectId, productId },
      {
        onSuccess: (res) => {
          setRedesignResults((prev) => ({ ...prev, [productId]: res as unknown as RedesignResult }));
          setActiveRedesign(null);
          toast({ title: "✓ Rediseño generado" });
        },
        onError: () => {
          setActiveRedesign(null);
          toast({ title: "Error generando rediseño", variant: "destructive" });
        },
      }
    );
  };

  const handleApply = (productId: string) => {
    apply.mutate(
      {
        projectId,
        productId,
        data: { fields: ["title", "bodyHtml", "price", "tags", "metafields"] },
      },
      {
        onSuccess: () => {
          toast({ title: "✓ Cambios aplicados en Shopify" });
          queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
        },
        onError: () => toast({ title: "Error aplicando cambios", variant: "destructive" }),
      }
    );
  };

  const handleBulk = (mode: "weak" | "all") => {
    bulkRedesign.mutate(
      { projectId, data: { mode } },
      {
        onSuccess: (res) => {
          const jobId = (res as { jobId?: string }).jobId;
          if (jobId) {
            setBulkJobId(jobId);
            toast({
              title: `Rediseño masivo iniciado (${mode === "weak" ? "C-F" : "todo el catálogo"})`,
            });
          }
        },
        onError: () => toast({ title: "Error al iniciar bulk", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Cargando...</div>;

  const products = data?.products || [];
  const isAnyRedesigning = redesign.isPending || bulkRedesign.isPending;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Rediseño IA</h1>
          <p className="text-muted-foreground mt-1">
            Reescritura completa con Claude: título SEO, descripción HTML, precio, tags y photo briefs.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <SaveReportButton
            projectId={projectId}
            title="Informe Rediseño IA"
            fileType="redesign"
            category="redesign"
            compact
            buildContent={() => {
              const results = redesignResults;
              const redesignedProducts = products.filter(p => results[(p as any).shopifyGid || (p as any).id]);
              return `
<h2>Resumen de Rediseño IA</h2>
<div class="metric-grid">
  <div class="metric-card"><div class="label">Total Productos</div><div class="value">${products.length}</div></div>
  <div class="metric-card"><div class="label">Rediseñados</div><div class="value status-ok">${redesignedProducts.length}</div></div>
  <div class="metric-card"><div class="label">Pendientes</div><div class="value">${products.length - redesignedProducts.length}</div></div>
</div>
${redesignedProducts.length > 0 ? `<h2>Productos Rediseñados</h2>${redesignedProducts.map(p => {<!-- nosemgrep -->
  const r = results[(p as any).shopifyGid || (p as any).id];
  return `<div style="margin:16px 0;padding:16px;border:1px solid rgba(200,168,75,0.2);border-radius:12px"> // nosemgrep
  <h3>${r?.title || (p as any).title}</h3>
  ${r?.shortDescription ? `<p style="color:#aaa">${r.shortDescription}</p>` : ""}<!-- nosemgrep -->
  ${r?.price ? `<p><strong>Precio sugerido:</strong> ${r.price}€</p>` : ""}<!-- nosemgrep -->
  ${r?.tags?.length ? `<p><strong>Tags:</strong> ${r.tags.join(", ")}</p>` : ""}<!-- nosemgrep -->
  ${r?.photoBriefs?.length ? `<h4>Photo Briefs</h4><ol>${r.photoBriefs.map(b => `<li>${b}</li>`).join("")}</ol>` : ""}<!-- nosemgrep -->
</div>`;
}).join("")}` : "<p>Aún no se han generado rediseños en esta sesión.</p>"}`;
            }}
          />
          <button
            onClick={() => handleBulk("weak")}
            disabled={bulkRedesign.isPending || !!bulkJobId}
            className="bg-white/5 border border-white/10 text-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Rediseñar Débiles (C-F)
          </button>
          <button
            onClick={() => handleBulk("all")}
            disabled={bulkRedesign.isPending || !!bulkJobId}
            className="bg-primary/20 border border-primary/30 text-primary px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
          >
            Rediseñar Todo
          </button>
        </div>
      </div>

      {/* Reference media + generation progress */}
      <ReferenceMediaPanel
        projectId={projectId}
        onIntelligenceReady={setReferenceIntelligence}
        context="Rediseño de producto Shopify — título, descripción, pricing y photo briefs"
        collapsed
      />
      <GenerationProgress
        active={isAnyRedesigning}
        operation="redesign"
        title={bulkRedesign.isPending ? "Rediseño masivo en progreso..." : "Rediseñando producto con IA..."}
        subtitle="Claude reescribe título SEO, descripción HTML, precio y genera photo briefs"
      />

      {/* Bulk Progress */}
      {bulkJobId && (
        <BulkProgressPoller
          projectId={projectId}
          jobId={bulkJobId}
          onComplete={(d) => {
            setBulkJobId(null);
            queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
            toast({ title: "✓ Rediseño masivo completado" });
          }}
        />
      )}

      {/* Product Cards */}
      <div className="space-y-6">
        {products.map((product) => {
          const result = redesignResults[product.id];
          const isRedesigning = activeRedesign === product.id;
          const showHtml = expandedHtml[product.id];

          return (
            <GlassCard key={product.id} className="p-6">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: Original */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <GradeBadge grade={product.auditGrade} className="w-8 h-8 text-sm" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Original
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{product.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-3 mb-3">
                      {product.bodyHtml?.replace(/<[^>]*>?/gm, "") || "Sin descripción"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="bg-white/5 px-3 py-1 rounded-lg text-foreground font-mono">
                        {formatCurrency(product.price ?? 0)}
                      </span>
                      <span className="text-muted-foreground text-xs line-clamp-1 max-w-[200px]">
                        {product.tags || "Sin tags"}
                      </span>
                    </div>
                  </div>

                  {!result && (
                    <button
                      onClick={() => handleRedesign(product.id)}
                      disabled={isRedesigning}
                      className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 w-fit"
                    >
                      {isRedesigning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      {isRedesigning ? "Claude pensando..." : "Generar Rediseño"}
                    </button>
                  )}
                </div>

                {/* Right: Redesign Result */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex-1 space-y-4 pl-0 lg:pl-8 lg:border-l border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                            <Wand2 className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                            Rediseño Claude
                          </span>
                        </div>
                        <button
                          onClick={() => handleRedesign(product.id)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Wand2 className="w-3 h-3" /> Regenerar
                        </button>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">{result.title}</h3>
                        <p className="text-muted-foreground text-sm mb-3">{result.shortDescription}</p>

                        {/* HTML preview toggle */}
                        <button
                          onClick={() =>
                            setExpandedHtml((prev) => ({ ...prev, [product.id]: !prev[product.id] }))
                          }
                          className="text-xs text-primary flex items-center gap-1 mb-3"
                        >
                          {showHtml ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showHtml ? "Ocultar descripción HTML" : "Ver descripción HTML completa"}
                        </button>

                        <AnimatePresence>
                          {showHtml && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div
                                className="prose prose-invert prose-sm max-w-none bg-black/20 rounded-xl p-4 border border-white/5 text-muted-foreground text-xs mb-3 max-h-60 overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: result.bodyHtml || "" }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg font-mono font-bold border border-green-500/30">
                            {formatCurrency(result.price ?? 0)}
                          </span>
                          {result.compareAtPrice && (
                            <span className="text-muted-foreground line-through text-sm">
                              {formatCurrency(result.compareAtPrice)}
                            </span>
                          )}
                        </div>

                        {result.tags && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {result.tags
                              .split(",")
                              .slice(0, 5)
                              .map((tag, i) => (
                                <span key={i} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                                  {tag.trim()}
                                </span>
                              ))}
                            {result.tags.split(",").length > 5 && (
                              <span className="text-[10px] text-muted-foreground px-2 py-0.5">
                                +{result.tags.split(",").length - 5} más
                              </span>
                            )}
                          </div>
                        )}

                        {/* Meta info */}
                        {(result.metaTitle || result.metaDescription) && (
                          <div className="bg-black/20 rounded-lg p-3 border border-white/5 text-xs mb-3 space-y-1">
                            {result.metaTitle && (
                              <p>
                                <span className="text-muted-foreground">Meta title: </span>
                                <span className="text-foreground">{result.metaTitle}</span>
                              </p>
                            )}
                            {result.metaDescription && (
                              <p>
                                <span className="text-muted-foreground">Meta desc: </span>
                                <span className="text-foreground">{result.metaDescription}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleApply(product.id)}
                          disabled={apply.isPending}
                          className="bg-green-500 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(0,214,143,0.2)]"
                        >
                          {apply.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Aplicar a Shopify
                        </button>

                        {result.photoBriefs && result.photoBriefs.length > 0 && (
                          <button
                            onClick={() =>
                              setPhotoBriefsModal({
                                productId: product.id,
                                title: product.title,
                                briefs: result.photoBriefs!,
                              })
                            }
                            className="bg-white/5 border border-white/10 text-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            Photo Briefs ({result.photoBriefs.length})
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          );
        })}

        {products.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <BarChart2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p>Escanea tu tienda en Auditoría primero.</p>
          </div>
        )}
      </div>

      {/* Photo Briefs Modal */}
      <AnimatePresence>
        {photoBriefsModal && (
          <PhotoBriefsModal
            briefs={photoBriefsModal.briefs}
            productTitle={photoBriefsModal.title}
            onClose={() => setPhotoBriefsModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
