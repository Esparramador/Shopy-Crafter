import { useJobStatus } from "@/hooks/useJobStatus";
import { useRoute } from "wouter";
import { ModalOverlay } from "@/components/ModalOverlay";
import DOMPurify from "dompurify";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  useGetProjectProducts,
  useRedesignProduct,
  useApplyRedesign,
  useBulkRedesign,
  getGetProjectProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import GenerationProgress from "@/components/GenerationProgress";
import SaveReportButton from "@/components/SaveReportButton";
import ReferenceMediaPanel from "@/components/ReferenceMediaPanel";
import { LiveOperation } from "@/components/LiveOperation";
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
type RedesignResult ={ title?: string;
  bodyHtml?: string;
  shortDescription?: string;
  price?: number;
  compareAtPrice?: number;
  tags?: string;
  metaTitle?: string;
  metaDescription?: string;
  photoBriefs?: string[]; };

const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type ApprovalState = "pending" | "approved" | "rejected" | null;

/** Mensaje real del servidor (cuota agotada, aprobación pendiente…) en vez de un error genérico. */
function serverMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: string } } | null)?.data;
  return data?.error ?? fallback;
}

interface SavedRedesignRow {
  shopify_product_id: string; new_title: string; new_body_html: string; new_short_description: string;
  new_price: string; new_compare_at_price: string; new_tags: string; meta_title: string; meta_description: string;
  photo_brief: string[] | null; approval_status: ApprovalState; client_comment: string | null;
}

function BulkProgressPoller({
  projectId,
  jobId,
  onComplete,
}: {
  projectId: number;
  jobId: string;
  onComplete: (data: unknown) => void;
}) {
  const { data, error } = useJobStatus(projectId, jobId);

  useEffect(() => {
    const status = (data as { status?: string } | undefined)?.status;
    if (status === "completed" || status === "failed" || error) onComplete(data ?? { status: "failed", error: String(error) });
  }, [data, error, onComplete]);

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
    <ModalOverlay className="backdrop-blur-sm">
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
    </ModalOverlay>
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
  const [_referenceIntelligence, setReferenceIntelligence] = useState<string | null>(null);
  const [expandedHtml, setExpandedHtml] = useState<Record<string, boolean>>({});
  const [photoBriefsModal, setPhotoBriefsModal] = useState<{
    productId: string;
    title: string;
    briefs: string[];
  } | null>(null);
  const [partialConfig, setPartialConfig] = useState<Record<string, Set<string>>>({});
  const [hasClient, setHasClient] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, { status: ApprovalState; comment: string | null }>>({});
  const [sendingApproval, setSendingApproval] = useState<string | null>(null);

  // Propuestas ya guardadas (incluidas las del rediseño masivo) y su estado de aprobación.
  const loadSaved = async () => {
    try {
      const r = await fetch(`${API_ROOT}/projects/${projectId}/redesigns/latest`, { credentials: "include" });
      if (!r.ok) return;
      const d = await r.json() as { hasClient: boolean; redesigns: SavedRedesignRow[] };
      setHasClient(d.hasClient);
      const results: Record<string, RedesignResult> = {};
      const states: Record<string, { status: ApprovalState; comment: string | null }> = {};
      for (const row of d.redesigns) {
        results[row.shopify_product_id] = {
          title: row.new_title, bodyHtml: row.new_body_html, shortDescription: row.new_short_description,
          price: Number(row.new_price) || undefined, compareAtPrice: Number(row.new_compare_at_price) || undefined,
          tags: row.new_tags, metaTitle: row.meta_title, metaDescription: row.meta_description,
          photoBriefs: row.photo_brief ?? [],
        };
        states[row.shopify_product_id] = { status: row.approval_status, comment: row.client_comment };
      }
      setRedesignResults(prev => ({ ...results, ...prev }));
      setApprovals(states);
    } catch { /* sin propuestas guardadas */ }
  };

  useEffect(() => { if (projectId) void loadSaved(); }, [projectId]);

  const requestApproval = async (productId: string) => {
    setSendingApproval(productId);
    try {
      const r = await fetch(`${API_ROOT}/projects/${projectId}/products/${encodeURIComponent(productId)}/request-approval`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo enviar");
      setApprovals(prev => ({ ...prev, [productId]: { status: d.status, comment: null } }));
      toast({ title: d.status === "approved" ? "Ya estaba aprobado" : "Enviado al portal del cliente" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSendingApproval(null);
    }
  };
  const [showPartialFor, setShowPartialFor] = useState<string | null>(null);

  const REDESIGN_PARTS = [
    { key: "title", label: "Título SEO", icon: "📝" },
    { key: "bodyHtml", label: "Descripción", icon: "📄" },
    { key: "price", label: "Precio", icon: "💰" },
    { key: "tags", label: "Tags", icon: "🏷" },
    { key: "metafields", label: "SEO Meta", icon: "🔍" },
    { key: "photoBriefs", label: "Photo Briefs", icon: "📸" },
  ];

  const getSelectedParts = (productId: string) => {
    const parts = partialConfig[productId];
    if (!parts || parts.size === 0) return REDESIGN_PARTS.map(p => p.key);
    return Array.from(parts);
  };

  const togglePart = (productId: string, part: string) => {
    setPartialConfig(prev => {
      const current = prev[productId] || new Set(REDESIGN_PARTS.map(p => p.key));
      const next = new Set(current);
      if (next.has(part)) {
        if (next.size > 1) next.delete(part);
      } else {
        next.add(part);
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleRedesign = (productId: string) => {
    setActiveRedesign(productId);
    setShowPartialFor(null);
    const parts = getSelectedParts(productId);
    redesign.mutate(
      { projectId, productId, ...({ data: { parts } } as any) },
      {
        onSuccess: (res) => {
          setRedesignResults((prev) => ({ ...prev, [productId]: res as unknown as RedesignResult }));
          setApprovals(prev => ({ ...prev, [productId]: { status: null, comment: null } }));
          setActiveRedesign(null);
          toast({ title: "✓ Rediseño generado" });
        },
        onError: (err) => {
          setActiveRedesign(null);
          toast({ title: serverMessage(err, "Error generando rediseño"), variant: "destructive" });
        },
      }
    );
  };

  const handleApply = (productId: string) => {
    const selectedParts = getSelectedParts(productId);
    const fieldMap: Record<string, string> = {
      title: "title",
      bodyHtml: "description",
      price: "price",
      tags: "tags",
      metafields: "meta",
      photoBriefs: "photoBriefs",
    };
    const applyFields = selectedParts.map(p => fieldMap[p] || p).filter(Boolean);
    apply.mutate(
      {
        projectId,
        productId,
        data: { fields: applyFields },
      },
      {
        onSuccess: () => {
          toast({ title: "✓ Cambios aplicados en tu tienda" });
          queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
        },
        onError: (err) => toast({ title: serverMessage(err, "Error aplicando cambios"), variant: "destructive" }),
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
        onError: (err) => toast({ title: serverMessage(err, "Error al iniciar el rediseño masivo"), variant: "destructive" }),
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
${redesignedProducts.length > 0 ? `<h2>Productos Rediseñados</h2>${redesignedProducts.map(p => {
  const r = results[(p as any).shopifyGid || (p as any).id];
  return `<div style="margin:16px 0;padding:16px;border:1px solid rgba(200,168,75,0.2);border-radius:12px">
  <h3>${r?.title || (p as any).title}</h3>
  ${r?.shortDescription ? `<p style="color:#aaa">${r.shortDescription}</p>` : ""}
  ${r?.price ? `<p><strong>Precio sugerido:</strong> ${r.price}€</p>` : ""}
  ${r?.tags?.length ? `<p><strong>Tags:</strong> ${Array.isArray(r.tags) ? r.tags.join(", ") : r.tags}</p>` : ""}
  ${r?.photoBriefs?.length ? `<h4>Photo Briefs</h4><ol>${r.photoBriefs.map(b => `<li>${b}</li>`).join("")}</ol>` : ""}
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

      {/* Indicador de operación en curso (rediseño individual o bulk) */}
      <LiveOperation
        active={isAnyRedesigning}
        title={
          bulkRedesign.isPending
            ? "Lanzando rediseño masivo del catálogo"
            : redesign.isPending
            ? "Rediseñando producto con IA"
            : undefined
        }
        estimatedSec={bulkRedesign.isPending ? 30 : 25}
        messages={
          bulkRedesign.isPending
            ? [
                "Encolando productos para rediseño…",
                "Cada producto se procesa en background — sigue trabajando.",
                "El job continúa aunque cierres esta pestaña.",
                "Verás progreso en tiempo real en el panel inferior.",
              ]
            : [
                "Claude está reescribiendo título SEO…",
                "Reformulando descripción HTML con tu tono de marca…",
                "Sugiriendo precio según mercado y competencia…",
                "Generando tags relevantes y photo briefs…",
                "Revisando coherencia con el cerebro de tu marca…",
              ]
        }
        className="w-full"
      />

      {/* Reference media + generation progress */}
      <ReferenceMediaPanel
        projectId={projectId}
        onIntelligenceReady={setReferenceIntelligence}
        context="Rediseño de producto eCommerce — título, descripción, pricing y photo briefs"
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
          onComplete={(_d) => {
            setBulkJobId(null);
            queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
            void loadSaved();
            toast({ title: "✓ Rediseño masivo completado: revisa las propuestas abajo" });
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
                    <div className="space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleRedesign(product.id)}
                          disabled={isRedesigning}
                          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                        >
                          {isRedesigning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4" />
                          )}
                          {isRedesigning ? "Claude pensando..." : "Rediseño Completo"}
                        </button>
                        <button
                          onClick={() => setShowPartialFor(showPartialFor === product.id ? null : product.id)}
                          className="bg-white/5 border border-white/10 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          {showPartialFor === product.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          Rediseño Parcial
                        </button>
                      </div>
                      <AnimatePresence>
                        {showPartialFor === product.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
                              <p className="text-[11px] text-muted-foreground">Selecciona qué partes rediseñar:</p>
                              <div className="flex flex-wrap gap-2">
                                {REDESIGN_PARTS.map(part => {
                                  const selected = partialConfig[product.id]
                                    ? partialConfig[product.id].has(part.key)
                                    : true;
                                  return (
                                    <button
                                      key={part.key}
                                      onClick={() => togglePart(product.id, part.key)}
                                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                                        selected
                                          ? "bg-primary/20 text-primary border-primary/30"
                                          : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                                      }`}
                                    >
                                      <span>{part.icon}</span>
                                      {part.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => handleRedesign(product.id)}
                                disabled={isRedesigning}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 w-full justify-center mt-2"
                              >
                                {isRedesigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                Rediseñar Selección
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(result.bodyHtml || "", {
                                    ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "a", "img"],
                                    ALLOWED_ATTR: ["href", "src", "alt", "class"],
                                    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
                                    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onsubmit"],
                                    ALLOW_DATA_ATTR: false,
                                  }),
                                }}
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

                      {hasClient && (() => {
                        const st = approvals[product.id]?.status ?? null;
                        const label = st === "approved" ? "✓ Aprobado por el cliente"
                          : st === "pending" ? "⏳ Pendiente de aprobación del cliente"
                          : st === "rejected" ? "✗ Rechazado por el cliente" : "Sin enviar al cliente";
                        const color = st === "approved" ? "text-green-400" : st === "rejected" ? "text-red-400" : st === "pending" ? "text-yellow-400" : "text-muted-foreground";
                        return (
                          <div className={`text-xs mb-2 ${color}`}>
                            {label}
                            {st === "rejected" && approvals[product.id]?.comment ? ` — "${approvals[product.id]?.comment}"` : ""}
                          </div>
                        );
                      })()}
                      <div className="flex flex-wrap gap-2">
                        {hasClient && approvals[product.id]?.status !== "approved" && approvals[product.id]?.status !== "pending" && (
                          <button
                            onClick={() => void requestApproval(product.id)}
                            disabled={sendingApproval === product.id}
                            className="bg-primary text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all"
                          >
                            {sendingApproval === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Enviar al cliente
                          </button>
                        )}
                        <button
                          onClick={() => handleApply(product.id)}
                          disabled={apply.isPending || (hasClient && approvals[product.id]?.status !== "approved")}
                          title={hasClient && approvals[product.id]?.status !== "approved" ? "Necesita la aprobación del cliente" : undefined}
                          className="bg-green-500 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(0,214,143,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {apply.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Aplicar cambios
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