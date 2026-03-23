import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  useGetVisualDna,
  useExtractVisualDna,
  useGetConsistencyScores,
  useRepairConsistency,
  useGetJobStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Palette,
  Fingerprint,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

function RepairPoller({
  projectId,
  jobId,
  onComplete,
}: {
  projectId: number;
  jobId: string;
  onComplete: () => void;
}) {
  const { data } = useGetJobStatus(projectId, jobId, {
    query: {
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
      onComplete();
    }
  }, [data, onComplete]);

  const progress = (data as { completed?: number; total?: number; log?: string[] } | undefined);

  return (
    <div className="mt-4 bg-black/20 rounded-xl p-4 border border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-sm text-primary font-medium">Reparando consistencia...</span>
      </div>
      {progress && (
        <>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{progress.completed ?? 0} / {progress.total ?? 0} productos</span>
            <span>{progress.total ? Math.round(((progress.completed ?? 0) / progress.total) * 100) : 0}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress.total ? ((progress.completed ?? 0) / progress.total) * 100 : 0}%` }}
            />
          </div>
          {progress.log && progress.log.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 font-mono truncate">
              {progress.log[progress.log.length - 1]}
            </p>
          )}
        </>
      )}
    </div>
  );
}

type DnaData = {
  backgroundStyle?: string | null;
  lightingStyle?: string | null;
  colorTemp?: string | null;
  composition?: string | null;
  mood?: string | null;
  props?: string[] | null;
  humanPresence?: string | null;
  consistencyScore?: number | null;
  brandColors?: string[] | null;
  extractedAt?: string | null;
};

type ScoresData = {
  totalProducts?: number;
  consistent?: number;
  offBrand?: number;
  inconsistent?: number;
  globalConsistencyScore?: number;
  products?: Array<{
    productId: string;
    title: string;
    imageUrl?: string | null;
    consistencyLevel: string;
    score: number;
    issues: string[];
  }>;
};

export default function ConsistencyPage() {
  const [, params] = useRoute("/projects/:id/consistency");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: dnaRaw,
    isLoading: isLoadingDna,
    refetch: refetchDna,
  } = useGetVisualDna(projectId);
  const {
    data: scoresRaw,
    isLoading: isLoadingScores,
    refetch: refetchScores,
  } = useGetConsistencyScores(projectId);

  const extractDna = useExtractVisualDna();
  const repairConsistency = useRepairConsistency();
  const [repairJobId, setRepairJobId] = useState<string | null>(null);

  const dna = dnaRaw as DnaData | null;
  const scores = scoresRaw as unknown as ScoresData | null;

  const hasDna = dna?.backgroundStyle;

  const handleExtractDna = () => {
    extractDna.mutate(
      { projectId },
      {
        onSuccess: () => {
          refetchDna();
          refetchScores();
          toast({ title: "ADN visual extraído exitosamente" });
        },
        onError: () => toast({ title: "Error extrayendo ADN visual", variant: "destructive" }),
      }
    );
  };

  const handleRepair = () => {
    repairConsistency.mutate(
      { projectId, data: { productIds: [] } },
      {
        onSuccess: (data) => {
          const jobId = (data as { jobId?: string }).jobId;
          if (jobId) setRepairJobId(jobId);
          toast({ title: "Reparación masiva iniciada" });
        },
        onError: () => toast({ title: "Error al iniciar reparación", variant: "destructive" }),
      }
    );
  };

  const globalScore = scores?.globalConsistencyScore ?? dna?.consistencyScore ?? null;

  if (isLoadingDna || isLoadingScores) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Consistencia Visual</h1>
          <p className="text-muted-foreground mt-1">
            Extrae el ADN visual de tu marca y garantiza coherencia en todo el catálogo.
          </p>
        </div>
        <button
          onClick={handleExtractDna}
          disabled={extractDna.isPending}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-60"
        >
          {extractDna.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Fingerprint className="w-5 h-5" />
          )}
          {extractDna.isPending ? "Analizando..." : hasDna ? "Re-extraer DNA" : "Extraer DNA Visual"}
        </button>
      </div>

      {/* DNA + Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DNA Card */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <Palette className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Visual DNA de la Marca (StyleLock)</h2>
            {dna?.extractedAt && (
              <span className="text-xs text-muted-foreground ml-auto">
                Extraído: {new Date(dna.extractedAt).toLocaleDateString("es-ES")}
              </span>
            )}
          </div>

          {hasDna ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { label: "Background Style", value: dna?.backgroundStyle },
                { label: "Iluminación", value: dna?.lightingStyle },
                { label: "Temperatura de Color", value: dna?.colorTemp },
                { label: "Composición", value: dna?.composition },
                { label: "Mood / Atmósfera", value: dna?.mood },
                { label: "Presencia Humana", value: dna?.humanPresence },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-sm text-foreground">{item.value || "–"}</p>
                </div>
              ))}

              {dna?.brandColors && dna.brandColors.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Paleta de Marca</p>
                  <div className="flex gap-2">
                    {dna.brandColors.map((color, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-md border border-white/10 flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[10px] font-mono text-muted-foreground">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dna?.props && dna.props.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Props Permitidos</p>
                  <div className="flex flex-wrap gap-2">
                    {dna.props.map((prop, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 text-muted-foreground border border-white/10">
                        {prop}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No hay DNA visual extraído.</p>
              <p className="text-xs text-muted-foreground">
                Haz clic en "Extraer DNA Visual" para que Claude analice tu catálogo.
              </p>
            </div>
          )}
        </GlassCard>

        {/* Score Ring */}
        <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-bold text-foreground mb-4">Consistencia Global</h3>
          <div className="relative w-40 h-40 flex items-center justify-center mb-4">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#ffffff15"
                strokeWidth="3"
              />
              {globalScore !== null && (
                <path
                  strokeDasharray={`${globalScore}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={globalScore > 80 ? "#00d68f" : globalScore > 60 ? "#ffd32a" : "#ff4757"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-display font-bold text-foreground">
                {globalScore !== null ? `${Math.round(globalScore)}%` : "–"}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {globalScore !== null
              ? globalScore > 80
                ? "Catálogo muy cohesivo"
                : globalScore > 60
                ? "Consistencia aceptable"
                : "Necesita corrección"
              : "Ejecuta el análisis"}
          </p>

          {scores && (
            <div className="mt-4 w-full space-y-2 text-sm">
              {[
                { label: "Consistentes", count: scores.consistent, color: "text-green-400" },
                { label: "Off-Brand", count: scores.offBrand, color: "text-orange-400" },
                { label: "Inconsistentes", count: scores.inconsistent, color: "text-red-400" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-bold ${item.color}`}>{item.count ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Off-Brand Products + Repair */}
      <GlassCard className="p-6 border-orange-500/20 bg-orange-500/5">
        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Productos Off-Brand Detectados</h2>
              <p className="text-sm text-muted-foreground">
                {(scores?.offBrand ?? 0) + (scores?.inconsistent ?? 0)} productos requieren corrección de estilo
              </p>
            </div>
          </div>
          <button
            onClick={handleRepair}
            disabled={repairConsistency.isPending || !!repairJobId}
            className="flex-shrink-0 bg-orange-500 text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-400 transition-all shadow-[0_0_15px_rgba(255,140,66,0.3)] disabled:opacity-60"
          >
            {repairConsistency.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            Reparar Consistencia Masiva
          </button>
        </div>

        {/* Repair progress */}
        {repairJobId && (
          <RepairPoller
            projectId={projectId}
            jobId={repairJobId}
            onComplete={() => {
              setRepairJobId(null);
              refetchScores();
              toast({ title: "✓ Reparación completada" });
            }}
          />
        )}
      </GlassCard>

      {/* Product Consistency List */}
      {scores?.products && scores.products.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Análisis por Producto ({scores.products.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scores.products
              .filter((p) => p.consistencyLevel !== "consistent")
              .slice(0, 12)
              .map((product, i) => (
                <GlassCard key={i} className="p-4 flex gap-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-black/40 flex-shrink-0 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{product.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {product.consistencyLevel === "off-brand" ? (
                        <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      )}
                      <span
                        className={`text-xs ${
                          product.consistencyLevel === "off-brand" ? "text-orange-400" : "text-red-400"
                        }`}
                      >
                        {product.consistencyLevel === "off-brand" ? "Off-Brand" : "Inconsistente"}
                      </span>
                    </div>
                    {product.issues.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{product.issues[0]}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className="text-sm font-bold"
                      style={{
                        color:
                          product.score > 70
                            ? "#00d68f"
                            : product.score > 40
                            ? "#ffd32a"
                            : "#ff4757",
                      }}
                    >
                      {product.score}%
                    </span>
                  </div>
                </GlassCard>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
