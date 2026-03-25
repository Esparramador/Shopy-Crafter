import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  useGetProjectProducts,
  useGenerateImage,
  useGenerateInfographic,
  useBulkGenerateImages,
  useBuildImagePrompt,
  useGetGenerationJob,
  getGetProjectProductsQueryKey,
} from "@workspace/api-client-react";
import ReferenceMediaPanel from "@/components/ReferenceMediaPanel";
import GenerationProgress from "@/components/GenerationProgress";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Zap,
  FileCode2,
  Loader2,
  Copy,
  Download,
  Eye,
  X,
  CheckCircle,
  ImageOff,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-draft-persistence";

const IMAGE_TYPES = [
  { id: "hero", label: "Hero (Studio)", icon: "📸", model: "Flux 1.1 Pro", color: "blue" },
  { id: "lifestyle", label: "Lifestyle", icon: "🌿", model: "Flux 1.1 Pro", color: "green" },
  { id: "detalle", label: "Detalle/Macro", icon: "🔍", model: "Flux Dev", color: "purple" },
  { id: "packaging", label: "Packaging", icon: "📦", model: "Recraft v3", color: "orange" },
  { id: "ugc", label: "Social/UGC", icon: "📱", model: "Recraft v3", color: "pink" },
  { id: "escala", label: "Escala", icon: "📏", model: "Flux Dev", color: "yellow" },
  { id: "bundle", label: "Bundle", icon: "🛍️", model: "Flux 1.1 Pro", color: "indigo" },
  { id: "infografia", label: "Infografía SVG", icon: "📊", model: "Claude SVG", color: "teal" },
];

type JobEntry = { jobId: string; type: string };

function JobPoller({
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
    if (status === "completed" || status === "failed") {
      onComplete(data);
    }
  }, [data, onComplete]);

  return null;
}

function PromptModal({
  productId,
  projectId,
  imageType,
  onClose,
}: {
  productId: string;
  projectId: number;
  imageType: string;
  onClose: () => void;
}) {
  const buildPrompt = useBuildImagePrompt();
  const [promptData, setPromptData] = useState<{
    brief?: string;
    midjourneyPrompt?: string;
    dallePrompt?: string;
    photographerDirection?: string;
  } | null>(null);
  const [referenceIntelligence, setReferenceIntelligence] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    buildPrompt.mutate(
      { projectId, data: { productId, imageType } },
      {
        onSuccess: (d) => {
          setPromptData(d as typeof promptData);
        },
      }
    );
  }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado`, description: "Listo para pegar en Midjourney/DALL-E" });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Brief de Imagen — {IMAGE_TYPES.find((t) => t.id === imageType)?.label}
            </h3>
            <p className="text-sm text-muted-foreground">Generado por Claude para tu fotógrafo o IA</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <ReferenceMediaPanel
            projectId={projectId}
            onIntelligenceReady={(intel) => {
              setReferenceIntelligence(intel);
              buildPrompt.mutate(
                { projectId, data: { productId, imageType } },
                { onSuccess: (d) => setPromptData(d as typeof promptData) }
              );
            }}
            context={`Generación de imagen tipo "${IMAGE_TYPES.find(t => t.id === imageType)?.label}" para producto Shopify`}
            collapsed
          />

          {buildPrompt.isPending && (
            <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Claude generando el brief...
            </div>
          )}

          {promptData && (
            <>
              {promptData.brief && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">
                      Brief Fotográfico
                    </h4>
                    <button
                      onClick={() => copy(promptData.brief!, "Brief")}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 text-sm text-muted-foreground border border-white/5">
                    {promptData.brief}
                  </div>
                </div>
              )}
              {promptData.midjourneyPrompt && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">
                      Prompt Midjourney
                    </h4>
                    <button
                      onClick={() => copy(promptData.midjourneyPrompt!, "Prompt MJ")}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                  <div className="bg-blue-500/5 rounded-xl p-4 text-sm text-blue-200 border border-blue-500/20 font-mono">
                    {promptData.midjourneyPrompt}
                  </div>
                </div>
              )}
              {promptData.dallePrompt && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
                      Prompt DALL-E 3
                    </h4>
                    <button
                      onClick={() => copy(promptData.dallePrompt!, "Prompt DALL-E")}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                  <div className="bg-purple-500/5 rounded-xl p-4 text-sm text-purple-200 border border-purple-500/20">
                    {promptData.dallePrompt}
                  </div>
                </div>
              )}
              {promptData.photographerDirection && (
                <div>
                  <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">
                    Dirección de Fotógrafo
                  </h4>
                  <div className="bg-green-500/5 rounded-xl p-4 text-sm text-green-200 border border-green-500/20">
                    {promptData.photographerDirection}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ImagesPage() {
  const [, params] = useRoute("/projects/:id/images");
  const projectId = parseInt(params?.id || "0");
  const { data, isLoading } = useGetProjectProducts(projectId, { limit: 50 });
  const generateImage = useGenerateImage();
  const generateInfographic = useGenerateInfographic();
  const bulkGenerate = useBulkGenerateImages();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<Record<string, JobEntry>>(() => {
    try {
      const saved = localStorage.getItem(`img-jobs-${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { data: Record<string, JobEntry>; at: number };
        if (Date.now() - parsed.at < 10 * 60 * 1000) return parsed.data;
        localStorage.removeItem(`img-jobs-${projectId}`);
      }
    } catch {}
    return {};
  });
  const [completedImages, setCompletedImages] = useState<Record<string, string>>({});
  const [completedSvgs, setCompletedSvgs] = useState<Record<string, string>>({});
  const [previewModal, setPreviewModal] = useState<{
    productId: string;
    imageType: string;
  } | null>(null);
  const [bulkJobId, setBulkJobId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(`img-bulk-${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { id: string; at: number };
        if (Date.now() - parsed.at < 10 * 60 * 1000) return parsed.id;
        localStorage.removeItem(`img-bulk-${projectId}`);
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    const active = Object.keys(jobs).length > 0;
    if (active) {
      try { localStorage.setItem(`img-jobs-${projectId}`, JSON.stringify({ data: jobs, at: Date.now() })); } catch {}
    } else {
      localStorage.removeItem(`img-jobs-${projectId}`);
    }
  }, [jobs, projectId]);

  useEffect(() => {
    if (bulkJobId) {
      try { localStorage.setItem(`img-bulk-${projectId}`, JSON.stringify({ id: bulkJobId, at: Date.now() })); } catch {}
    } else {
      localStorage.removeItem(`img-bulk-${projectId}`);
    }
  }, [bulkJobId, projectId]);

  useEffect(() => {
    try {
      const savedJobs = localStorage.getItem(`img-jobs-${projectId}`);
      if (savedJobs) {
        const parsed = JSON.parse(savedJobs) as { data: Record<string, JobEntry>; at: number };
        if (Date.now() - parsed.at < 10 * 60 * 1000) { setJobs(parsed.data); } else { setJobs({}); localStorage.removeItem(`img-jobs-${projectId}`); }
      } else { setJobs({}); }
      const savedBulk = localStorage.getItem(`img-bulk-${projectId}`);
      if (savedBulk) {
        const parsed = JSON.parse(savedBulk) as { id: string; at: number };
        if (Date.now() - parsed.at < 10 * 60 * 1000) { setBulkJobId(parsed.id); } else { setBulkJobId(null); localStorage.removeItem(`img-bulk-${projectId}`); }
      } else { setBulkJobId(null); }
    } catch { setJobs({}); setBulkJobId(null); }
    setCompletedImages({});
    setCompletedSvgs({});
  }, [projectId]);

  useOnlineStatus(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
    toast({ title: "Conexión restaurada", description: "Datos actualizados" });
  }, [projectId, queryClient, toast]));

  const jobKey = (productId: string, type: string) => `${productId}::${type}`;

  const isGenerating = (productId: string, type: string) => !!jobs[jobKey(productId, type)];
  const hasImage = (productId: string, type: string) => !!completedImages[jobKey(productId, type)];
  const hasSvg = (productId: string, type: string) => !!completedSvgs[jobKey(productId, type)];

  const handleGenerate = (productId: string, imageType: string) => {
    const key = jobKey(productId, imageType);

    if (imageType === "infografia") {
      setJobs((prev) => ({ ...prev, [key]: { jobId: "infografia", type: imageType } }));
      generateInfographic.mutate(
        { projectId, productId },
        {
          onSuccess: (res) => {
            const svgContent = (res as { svg?: string }).svg ?? "";
            setCompletedSvgs((prev) => ({ ...prev, [key]: svgContent }));
            setJobs((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            toast({ title: "Infografía SVG generada" });
          },
          onError: () => {
            setJobs((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          },
        }
      );
      return;
    }

    generateImage.mutate(
      { projectId, productId, data: { imageType } },
      {
        onSuccess: (res) => {
          const jobId = (res as { jobId?: string }).jobId;
          if (jobId) {
            setJobs((prev) => ({ ...prev, [key]: { jobId, type: imageType } }));
          }
        },
        onError: () => {
          toast({ title: "Error al iniciar generación", variant: "destructive" });
        },
      }
    );
  };

  const handleJobComplete = (key: string) => (data: unknown) => {
    const d = data as { status?: string; imageUrl?: string };
    setJobs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (d?.status === "completed" && d.imageUrl) {
      setCompletedImages((prev) => ({ ...prev, [key]: d.imageUrl! }));
      toast({ title: "✓ Imagen generada", description: "Lista para usar" });
    }
  };

  const handleBoostMasivo = () => {
    const productIds = (data?.products || []).map((p) => p.id);
    bulkGenerate.mutate(
      { projectId, data: { imageTypes: ["hero"], productIds } },
      {
        onSuccess: (res) => {
          const jobId = (res as { jobId?: string }).jobId;
          if (jobId) {
            setBulkJobId(jobId);
            toast({
              title: "Boost Masivo iniciado",
              description: `Generando imágenes Hero para ${productIds.length} productos...`,
            });
          }
        },
      }
    );
  };

  const downloadSvg = (svgContent: string, filename: string) => {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Cargando productos...</div>;

  const products = data?.products || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Job pollers for in-progress jobs */}
      {Object.entries(jobs)
        .filter(([, e]) => e.jobId && e.jobId !== "infografia")
        .map(([key, entry]) => (
          <JobPoller key={key} projectId={projectId} jobId={entry.jobId} onComplete={handleJobComplete(key)} />
        ))}

      {/* Bulk job poller */}
      {bulkJobId && (
        <JobPoller
          projectId={projectId}
          jobId={bulkJobId}
          onComplete={(d) => {
            setBulkJobId(null);
            toast({ title: "Boost Masivo completado" });
            queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Motor de Imágenes IA</h1>
          <p className="text-muted-foreground mt-1">
            8 tipos de foto + Infografía SVG. Genera briefs, prompts Midjourney/DALL-E e imágenes reales con Replicate.
          </p>
        </div>
        <div className="flex gap-3">
          {bulkJobId && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
              <Loader2 className="w-4 h-4 animate-spin" />
              Boost en progreso...
            </div>
          )}
          <button
            onClick={handleBoostMasivo}
            disabled={bulkGenerate.isPending || !!bulkJobId}
            className="bg-gradient-to-r from-purple-600 to-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(91,78,255,0.4)] disabled:opacity-50"
          >
            <Zap className="w-5 h-5 fill-white" />
            Boost Masivo (Hero)
          </button>
        </div>
      </div>

      <GenerationProgress
        active={bulkGenerate.isPending || (!!bulkJobId)}
        operation="images"
        title="Motor de Imágenes generando en masa..."
        subtitle="Flux IA procesa cada producto del catálogo con prompts optimizados por ShopyBrain"
      />

      {/* Legend */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-400" />
            <span>Flux 1.1 Pro: Hero, Lifestyle, Bundle (~$0.04/img)</span>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-purple-400" />
            <span>Flux Dev: Detalle, Escala (~$0.02/img)</span>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-400" />
            <span>Recraft v3: Packaging, UGC (~$0.04/img)</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-teal-400" />
            <span>Claude SVG: Infografía (gratis con tu plan)</span>
          </div>
        </div>
      </GlassCard>

      {/* Product Cards */}
      <div className="space-y-8">
        {products.map((product) => (
          <GlassCard key={product.id} className="p-6">
            {/* Product header */}
            <div className="flex items-center gap-4 mb-6">
              {product.images?.[0]?.src ? (
                <img
                  src={product.images[0].src}
                  className="w-14 h-14 rounded-xl object-cover bg-black/50 flex-shrink-0"
                  alt={product.title}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-black/40 flex items-center justify-center flex-shrink-0">
                  <ImageOff className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground truncate">{product.title}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-sm text-muted-foreground">
                    Imágenes actuales:{" "}
                    <span className="text-primary font-bold">{product.imageCount ?? 0}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Score imagen:{" "}
                    <span
                      className="font-bold"
                      style={{
                        color:
                          (product.imageScore ?? 0) > 70
                            ? "#00d68f"
                            : (product.imageScore ?? 0) > 40
                            ? "#ffd32a"
                            : "#ff4757",
                      }}
                    >
                      {product.imageScore ?? 0}/100
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Image type grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {IMAGE_TYPES.map((type) => {
                const key = jobKey(product.id, type.id);
                const isGen = isGenerating(product.id, type.id);
                const done = hasImage(product.id, type.id);
                const svgDone = hasSvg(product.id, type.id) && type.id === "infografia";
                const imageUrl = completedImages[key];
                const svgContent = completedSvgs[key];

                return (
                  <div
                    key={type.id}
                    className={cn(
                      "relative group rounded-xl border overflow-hidden transition-all",
                      done || svgDone
                        ? "border-green-500/30 bg-green-500/5"
                        : isGen
                        ? "border-primary/50 bg-primary/5"
                        : "border-dashed border-white/10 bg-black/10 hover:border-primary/30"
                    )}
                  >
                    {/* Shimmer */}
                    {isGen && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse" />
                      </div>
                    )}

                    {/* Generated image preview */}
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={type.label}
                        className="w-full aspect-square object-cover"
                      />
                    )}

                    {/* SVG preview — sanitized before rendering */}
                    {svgContent && (
                      <div
                        className="w-full aspect-square overflow-hidden bg-black/50"
                        dangerouslySetInnerHTML={{ __html: svgContent
                          .replace(/<script[\s\S]*?<\/script>/gi, "")
                          .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
                          .replace(/javascript:/gi, "")
                        }}
                      />
                    )}

                    {/* Card body */}
                    <div
                      className={cn(
                        "p-3 text-center",
                        (done || svgDone) && (imageUrl || svgContent) ? "pt-2" : "py-5"
                      )}
                    >
                      <div className="text-xl mb-1">{type.icon}</div>
                      <span className="block text-xs font-semibold text-foreground">{type.label}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">{type.model}</span>

                      {isGen ? (
                        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-primary">
                          <Loader2 className="w-3 h-3 animate-spin" /> Generando...
                        </div>
                      ) : done || svgDone ? (
                        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-green-400">
                          <CheckCircle className="w-3 h-3" /> Lista
                        </div>
                      ) : null}
                    </div>

                    {/* Hover actions */}
                    {!isGen && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        {!done && !svgDone ? (
                          <>
                            <button
                              onClick={() => handleGenerate(product.id, type.id)}
                              className="w-full text-xs bg-primary text-white px-2 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                              {type.id === "infografia" ? "Generar SVG" : "Generar (~$0.04)"}
                            </button>
                            <button
                              onClick={() => setPreviewModal({ productId: product.id, imageType: type.id })}
                              className="w-full text-xs bg-white/10 text-foreground px-2 py-1.5 rounded-lg font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Ver Prompts
                            </button>
                          </>
                        ) : (
                          <>
                            {imageUrl && (
                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full text-xs bg-white/10 text-foreground px-2 py-1.5 rounded-lg font-medium hover:bg-white/20 flex items-center justify-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Ver
                              </a>
                            )}
                            {svgContent && (
                              <button
                                onClick={() => downloadSvg(svgContent, `infografia-${product.id}.svg`)}
                                className="w-full text-xs bg-teal-500/20 text-teal-300 px-2 py-1.5 rounded-lg hover:bg-teal-500/30 flex items-center justify-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Descargar SVG
                              </button>
                            )}
                            <button
                              onClick={() => handleGenerate(product.id, type.id)}
                              className="w-full text-xs bg-white/5 text-muted-foreground px-2 py-1.5 rounded-lg hover:bg-white/10"
                            >
                              Regenerar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}

        {products.length === 0 && (
          <div className="py-20 text-center">
            <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Ve a <strong>Auditoría</strong> y escanea tu tienda primero.
            </p>
          </div>
        )}
      </div>

      {/* Prompt Preview Modal */}
      <AnimatePresence>
        {previewModal && (
          <PromptModal
            productId={previewModal.productId}
            projectId={projectId}
            imageType={previewModal.imageType}
            onClose={() => setPreviewModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
