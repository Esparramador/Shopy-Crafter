import { useRoute, Link } from "wouter";
import DOMPurify from "dompurify";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  useGetProjectProducts,
  useGenerateImage,
  useGenerateInfographic,
  useBulkGenerateImages,
  useBuildImagePrompt,
  useGetGenerationJob,
  useListImageEngines,
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
import{ useOnlineStatus }from "@/hooks/use-draft-persistence";

const IMAGE_TYPES = [
  { id: "hero", label: "Hero (Studio)", icon: "📸", model: "Flux 1.1 Pro", color: "blue" },
  { id: "lifestyle", label: "Lifestyle", icon: "🌿", model: "Flux 1.1 Pro", color: "green" },
  { id: "detalle", label: "Detalle/Macro", icon: "🔍", model: "Flux Dev", color: "purple" },
  { id: "packaging", label: "Packaging", icon: "📦", model: "Recraft v3", color: "orange" },
  { id: "ugc", label: "Social/UGC", icon: "📱", model: "Recraft v3", color: "pink" },
  { id: "escala", label: "Escala", icon: "📏", model: "Flux Dev", color: "yellow" },
  { id: "bundle", label: "Bundle", icon: "🛍️", model: "Flux 1.1 Pro", color: "indigo" },
  { id: "infografia", label: "Infografía SVG", icon: "📊", model: "Claude SVG", color: "teal" },
  { id: "infografia-premium", label: "Infografía Premium", icon: "💎", model: "Ideogram v3 (texto real)", color: "amber" },
  { id: "tryon", label: "Virtual Try-On", icon: "🧍", model: "Gemini Fusion", color: "rose" },
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
  const [_referenceIntelligence, setReferenceIntelligence] = useState<string | null>(null);
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
            context={`Generación de imagen tipo "${IMAGE_TYPES.find(t => t.id === imageType)?.label}" para producto eCommerce`}
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

function TryonModal({
  productId,
  projectId,
  productTitle,
  productDescription,
  productImages,
  onClose,
  onSuccess,
}: {
  productId: string;
  projectId: number;
  productTitle: string;
  productDescription: string;
  productImages: string[];
  onClose: () => void;
  onSuccess: (dataUri: string) => void;
}) {
  const { toast } = useToast();
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [scene, setScene] = useState("model_front");
  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [selectedProductImageUrl, setSelectedProductImageUrl] = useState<string>(productImages[0] || "");
  const [loading, setLoading] = useState(false);

  const SCENES = [
    { key: "model_front", label: "Frontal estudio" },
    { key: "model_street", label: "Street style urbano" },
    { key: "model_lifestyle", label: "Lifestyle natural" },
    { key: "model_editorial", label: "Editorial revista" },
    { key: "model_close", label: "Close-up del producto puesto" },
  ];
  const ASPECTS = ["3:4", "9:16", "1:1", "4:3", "16:9"];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setModelFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  };

  const handleGenerate = async () => {
    if (!modelFile) {
      toast({ title: "Falta la imagen", description: "Sube una foto de la persona/modelo", variant: "destructive" });
      return;
    }
    if (productImages.length > 0 && !selectedProductImageUrl) {
      toast({ title: "Selecciona una foto del producto", description: "Elige cuál de las imágenes del producto se usará como referencia.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("modelImage", modelFile);
      fd.append("scene", scene);
      fd.append("aspectRatio", aspectRatio);
      if (selectedProductImageUrl) fd.append("productImageUrl", selectedProductImageUrl);
      const resp = await fetch(`/api/projects/${projectId}/products/${productId}/images/tryon-quick`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (!data.dataUri) throw new Error("Respuesta sin imagen");
      onSuccess(data.dataUri);
      toast({ title: "✓ Try-On generado", description: "Imagen lista en la galería del producto." });
      onClose();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Error en virtual try-on";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            🧍 Virtual Try-On
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
          <div className="text-xs uppercase tracking-wide text-rose-300 font-semibold mb-1">Producto</div>
          <div className="text-sm font-bold text-foreground line-clamp-1">{productTitle}</div>
          {productDescription && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{productDescription}</div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Sube una foto de la persona/modelo y elige qué imagen oficial del producto usar como referencia.
          Fusión con Gemini 2.5 Flash Image (preserva identidad y producto exactos).
        </p>

        <div className="space-y-4">
          {productImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                🖼️ Imagen del producto a usar como referencia
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({productImages.length} disponible{productImages.length === 1 ? "" : "s"})
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {productImages.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedProductImageUrl(url)}
                    data-testid={`tryon-product-image-${url.slice(-30)}`}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      selectedProductImageUrl === url
                        ? "border-rose-400 ring-2 ring-rose-400/40"
                        : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={url} alt="Imagen del producto" className="w-full h-full object-cover" />
                    {selectedProductImageUrl === url && (
                      <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-rose-200 drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {productImages.length === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              Este producto no tiene imágenes en Shopify. El try-on no podrá usar referencia visual del producto.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">📷 Foto del modelo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              data-testid="tryon-model-file"
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary/80"
            />
            {previewUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                <img src={previewUrl} alt="Preview modelo" className="w-full h-48 object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">🎬 Escena</label>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              data-testid="tryon-scene"
              className="w-full bg-background border border-white/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {SCENES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">📐 Proporción</label>
            <div className="flex gap-2 flex-wrap">
              {ASPECTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAspectRatio(a)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md border transition-colors",
                    aspectRatio === a
                      ? "bg-primary text-white border-primary"
                      : "bg-white/5 text-foreground border-white/10 hover:bg-white/10"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !modelFile}
            data-testid="tryon-generate"
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Fusionando con Gemini...
              </>
            ) : (
              <>🧍 Generar Try-On (~$0.04)</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// InfographicPremiumModal — selector de imagen del producto + idioma + textMode
// ============================================================================
function InfographicPremiumModal({
  productId,
  projectId,
  productTitle,
  productDescription,
  productImages,
  defaultLanguage,
  defaultTextMode,
  onClose,
  onSuccess,
}: {
  productId: string;
  projectId: number;
  productTitle: string;
  productDescription: string;
  productImages: string[];
  defaultLanguage: string;
  defaultTextMode: "ai" | "overlay";
  onClose: () => void;
  onSuccess: (dataUri: string) => void;
}) {
  const { toast } = useToast();
  const [selectedProductImageUrl, setSelectedProductImageUrl] = useState<string>(productImages[0] || "");
  const [language, setLanguage] = useState<string>(defaultLanguage);
  const [textMode, setTextMode] = useState<"ai" | "overlay">(defaultTextMode);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [loading, setLoading] = useState(false);

  const ASPECTS = ["1:1", "4:5", "3:4", "9:16", "16:9"];

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/products/${productId}/images/generate-infographic-premium`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspectRatio,
          model: "ideogram-v3-turbo",
          language,
          textMode,
          ...(selectedProductImageUrl ? { productImageUrl: selectedProductImageUrl } : {}),
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.code === "AI_TEXT_UNAVAILABLE" && err.suggestedTextMode === "overlay") {
          throw new Error("Ideogram sin saldo. Cambia a 'Vectorial' arriba y reintenta.");
        }
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (!data.dataUri) throw new Error("Respuesta sin imagen");
      onSuccess(data.dataUri);
      toast({ title: "✓ Infografía Premium generada", description: "Imagen lista en la galería del producto." });
      onClose();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Error en infografía premium";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-amber-500/30 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">💎 Infografía Premium</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <div className="text-xs uppercase tracking-wide text-amber-300 font-semibold mb-1">Producto</div>
          <div className="text-sm font-bold text-foreground line-clamp-1">{productTitle}</div>
          {productDescription && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{productDescription}</div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Elige qué imagen del producto se usará como referencia visual real. La infografía mostrará el producto
          tal cual es (color, forma, branding) sin inventos.
        </p>

        <div className="space-y-4">
          {productImages.length > 0 ? (
            <div>
              <label className="block text-sm font-medium mb-2">
                🖼️ Imagen del producto
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({productImages.length} disponible{productImages.length === 1 ? "" : "s"})
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {productImages.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedProductImageUrl(url)}
                    data-testid={`premium-product-image-${url.slice(-30)}`}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      selectedProductImageUrl === url
                        ? "border-amber-400 ring-2 ring-amber-400/40"
                        : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={url} alt="Imagen del producto" className="w-full h-full object-cover" />
                    {selectedProductImageUrl === url && (
                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-amber-200 drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              Este producto no tiene imágenes en Shopify. La infografía se generará solo con el texto del producto.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">🌐 Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                data-testid="premium-modal-language"
                className="w-full bg-background border border-amber-500/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="auto">Auto (idioma del producto)</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">🛡️ Modo texto</label>
              <select
                value={textMode}
                onChange={(e) => setTextMode(e.target.value as "ai" | "overlay")}
                data-testid="premium-modal-text-mode"
                className="w-full bg-background border border-amber-500/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="overlay">Vectorial (perfecto)</option>
                <option value="ai">IA Ideogram (texto AI)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">📐 Proporción</label>
            <div className="flex gap-2 flex-wrap">
              {ASPECTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspectRatio(a)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md border transition-colors",
                    aspectRatio === a
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white/5 text-foreground border-white/10 hover:bg-white/10"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            data-testid="premium-modal-generate"
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generando infografía...
              </>
            ) : (
              <>💎 Generar Infografía Premium (~$0.03)</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// ImageLightbox — visor seguro para imágenes generadas (data: URIs y URLs)
// Resuelve el bug del botón "Ver" que rompía al abrir data: URIs gigantes en
// nueva pestaña (los navegadores bloquean top-frame navigation a data: URLs).
// ============================================================================
function ImageLightbox({
  src,
  filename,
  onClose,
  onDownload,
}: {
  src: string;
  filename?: string;
  onClose: () => void;
  onDownload?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="image-lightbox"
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        className="relative max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={filename || "Imagen generada"}
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="bg-amber-500/90 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 shadow-lg"
              data-testid="lightbox-download"
            >
              <Download className="w-4 h-4" /> Descargar
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-black/70 hover:bg-black text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 shadow-lg"
            data-testid="lightbox-close"
          >
            <X className="w-4 h-4" /> Cerrar
          </button>
        </div>
        {filename && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2.5 py-1 rounded-md">
            {filename}
          </div>
        )}
      </motion.div>
    </motion.div>
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
  const [tryonModal, setTryonModal] = useState<{ productId: string } | null>(null);
  // Motor IA seleccionado por (productId+tipo). Vacío = motor por defecto del backend.
  const [selectedEngines, setSelectedEngines] = useState<Record<string, string>>({});
  // Premium Infographic — language + text mode (per-project, persisted in localStorage)
  // Whitelist de idiomas soportados por el backend; cualquier otro valor se sanea a "auto".
  const SUPPORTED_LANGS = ["auto", "es", "en", "fr", "it", "pt", "de", "ja", "zh"] as const;
  const [premiumLanguage, setPremiumLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    const raw = localStorage.getItem("premiumInfographicLang");
    return raw && (SUPPORTED_LANGS as readonly string[]).includes(raw) ? raw : "auto";
  });
  const [premiumTextMode, setPremiumTextMode] = useState<"ai" | "overlay">(() => {
    if (typeof window === "undefined") return "overlay";
    const raw = localStorage.getItem("premiumInfographicTextMode");
    return raw === "ai" || raw === "overlay" ? raw : "overlay";
  });
  useEffect(() => { try { localStorage.setItem("premiumInfographicLang", premiumLanguage); } catch {} }, [premiumLanguage]);
  useEffect(() => { try { localStorage.setItem("premiumInfographicTextMode", premiumTextMode); } catch {} }, [premiumTextMode]);
  const { data: enginesData } = useListImageEngines();
  const engines = (enginesData as { engines?: Array<{ id: string; label: string; model: string; cost: number; description?: string }> } | undefined)?.engines ?? [];

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

  const handleGenerate = (productId: string, imageType: string, engine?: string) => {
    const key = jobKey(productId, imageType);

    if (imageType === "tryon") {
      setTryonModal({ productId });
      return;
    }

    if (imageType === "infografia-premium") {
      setJobs((prev) => ({ ...prev, [key]: { jobId: "infografia-premium", type: imageType } }));
      (async () => {
        try {
          const resp = await fetch(`/api/projects/${projectId}/products/${productId}/images/generate-infographic-premium`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aspectRatio: "1:1",
              model: "ideogram-v3-turbo",
              language: premiumLanguage,
              textMode: premiumTextMode,
            }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            // Si AI mode falla por falta de Ideogram, sugerir overlay
            if (err.code === "AI_TEXT_UNAVAILABLE" && err.suggestedTextMode === "overlay") {
              throw new Error("Ideogram sin saldo. Cambia a 'Texto Garantizado (Vectorial)' en el selector y reintenta.");
            }
            throw new Error(err.error || `HTTP ${resp.status}`);
          }
          const data = await resp.json();
          if (!data.dataUri) throw new Error("Respuesta sin imagen");
          setCompletedImages((prev) => ({ ...prev, [key]: data.dataUri }));
          setJobs((prev) => { const next = { ...prev }; delete next[key]; return next; });
          const modeMsg = data.textMode === "overlay" ? `Texto vectorial garantizado en ${data.language}.` : "Texto perfectamente legible con datos reales.";
          toast({ title: "✓ Infografía Premium generada", description: modeMsg });
        } catch (err) {
          setJobs((prev) => { const next = { ...prev }; delete next[key]; return next; });
          const msg = (err as { message?: string })?.message || "Error generando infografía premium";
          toast({ title: "Error", description: msg, variant: "destructive" });
        }
      })();
      return;
    }

    if (imageType === "infografia") {
      setJobs((prev) => ({ ...prev, [key]: { jobId: "infografia", type: imageType } }));
      generateInfographic.mutate(
        { projectId, productId },
        {
          onSuccess: (res) => {
            // El backend devuelve { svgContent, pngBase64, uploaded } según el spec OpenAPI.
            const svgContent = (res as { svgContent?: string }).svgContent ?? "";
            if (!svgContent || !svgContent.includes("<svg")) {
              setJobs((prev) => { const next = { ...prev }; delete next[key]; return next; });
              toast({ title: "El motor no devolvió un SVG válido", description: "Vuelve a intentarlo en unos segundos.", variant: "destructive" });
              return;
            }
            setCompletedSvgs((prev) => ({ ...prev, [key]: svgContent }));
            setJobs((prev) => { const next = { ...prev }; delete next[key]; return next; });
            toast({ title: "Infografía SVG generada", description: "Guardada en el repositorio del proyecto." });
          },
          onError: (err) => {
            setJobs((prev) => { const next = { ...prev }; delete next[key]; return next; });
            const msg = (err as { message?: string })?.message || "Error al generar la infografía";
            toast({ title: "Error generando SVG", description: msg, variant: "destructive" });
          },
        }
      );
      return;
    }

    generateImage.mutate(
      { projectId, productId, data: { imageType, engine: engine ?? null } },
      {
        onSuccess: (res) => {
          const jobId = (res as { jobId?: string }).jobId;
          if (jobId) {
            setJobs((prev) => ({ ...prev, [key]: { jobId, type: imageType } }));
          }
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message || "Error al iniciar generación";
          toast({ title: msg, variant: "destructive" });
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

  // Universal downloader: works with both data URIs (base64) and HTTP(S) URLs
  const downloadDataUri = (uriOrUrl: string, filename: string) => {
    try {
      const a = document.createElement("a");
      a.href = uriOrUrl;
      a.download = filename;
      a.target = uriOrUrl.startsWith("data:") ? "_self" : "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "No se pudo descargar";
      toast({ title: "Error de descarga", description: msg, variant: "destructive" });
    }
  };

  const extFromDataUri = (uri: string): string => {
    if (!uri.startsWith("data:")) return "png";
    const m = /^data:([^;]+);/.exec(uri);
    const mime = m?.[1] || "image/png";
    if (mime.includes("png")) return "png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    return "png";
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
        .filter(([, e]) => e.jobId && e.jobId !== "infografia" && e.jobId !== "infografia-premium" && e.jobId !== "tryon")
        .map(([key, entry]) => (
          <JobPoller key={key} projectId={projectId} jobId={entry.jobId} onComplete={handleJobComplete(key)} />
        ))}

      {/* Bulk job poller */}
      {bulkJobId && (
        <JobPoller
          projectId={projectId}
          jobId={bulkJobId}
          onComplete={(_d) => {
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
          <Link
            href={`/projects/${projectId}/vault`}
            data-testid="link-vault-from-images"
            className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-amber-500/25 transition-all"
            title="Ver y descargar todos tus archivos generados"
          >
            <Download className="w-4 h-4" />
            Bóveda
          </Link>
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
        subtitle="Flux IA procesa cada producto del catálogo con prompts optimizados por Shopy Crafter"
      />

      {/* Premium Infographic — Idioma + Modo de texto (controla ortografía 100%) */}
      <GlassCard className="p-4 border-amber-500/20" data-testid="premium-text-config">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💎</span>
            <div>
              <div className="font-semibold text-amber-300">Infografía Premium — Texto</div>
              <div className="text-xs text-muted-foreground">
                Elige idioma y modo de renderizado del texto. <strong className="text-amber-200">Modo Vectorial</strong> garantiza ortografía 100% perfecta en cualquier idioma.
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col">
              <label htmlFor="premium-lang" className="text-xs text-muted-foreground mb-1">Idioma</label>
              <select
                id="premium-lang"
                data-testid="select-premium-language"
                value={premiumLanguage}
                onChange={(e) => setPremiumLanguage(e.target.value)}
                className="bg-background border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-foreground focus:border-amber-400 focus:outline-none min-w-[160px]"
              >
                <option value="auto">Auto (idioma del producto)</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語 (Japonés)</option>
                <option value="zh">中文 (Chino)</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="premium-text-mode" className="text-xs text-muted-foreground mb-1">Modo de texto</label>
              <select
                id="premium-text-mode"
                data-testid="select-premium-text-mode"
                value={premiumTextMode}
                onChange={(e) => setPremiumTextMode(e.target.value as "ai" | "overlay")}
                className="bg-background border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-foreground focus:border-amber-400 focus:outline-none min-w-[260px]"
              >
                <option value="overlay">🛡️ Vectorial (ortografía 100% garantizada)</option>
                <option value="ai">🤖 IA (Ideogram renderiza el texto — requiere saldo)</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

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

                    {/* SVG preview — sanitized before rendering (FIX F-05) */}
                    {svgContent && (
                      <div
                        className="w-full aspect-square overflow-hidden bg-black/50"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(svgContent, {
                            USE_PROFILES: { svg: true, svgFilters: true },
                            FORBID_TAGS: ["foreignObject", "script", "style", "animate", "set"],
                            FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
                            ALLOW_DATA_ATTR: false,
                            ALLOW_UNKNOWN_PROTOCOLS: false,
                            WHOLE_DOCUMENT: false,
                          }),
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
                            {/* Selector de motor IA — sólo para tipos que NO son SVG */}
                            {type.id !== "infografia" && engines.length > 0 && (
                              <select
                                aria-label={`Motor IA para ${type.label}`}
                                value={selectedEngines[key] ?? ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setSelectedEngines((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="w-full text-[11px] bg-black/80 text-foreground border border-white/20 rounded-md px-1.5 py-1 focus:outline-none focus:border-primary"
                              >
                                <option value="">⚡ Motor automático ({type.model})</option>
                                {engines.map((eng) => (
                                  <option key={eng.id} value={eng.model}>
                                    {eng.label} (~${eng.cost.toFixed(3)})
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => handleGenerate(product.id, type.id, selectedEngines[key] || undefined)}
                              className="w-full text-xs bg-primary text-white px-2 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                              {type.id === "infografia"
                                ? "Generar SVG"
                                : type.id === "infografia-premium"
                                ? "💎 Generar Premium (~$0.03)"
                                : type.id === "tryon"
                                ? "🧍 Configurar Try-On"
                                : selectedEngines[key]
                                ? `Generar con ${engines.find((e) => e.model === selectedEngines[key])?.label ?? "motor"}`
                                : "Generar (~$0.04)"}
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
                              <>
                                <a
                                  href={imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full text-xs bg-white/10 text-foreground px-2 py-1.5 rounded-lg font-medium hover:bg-white/20 flex items-center justify-center gap-1"
                                >
                                  <Eye className="w-3 h-3" /> Ver
                                </a>
                                <button
                                  onClick={() =>
                                    downloadDataUri(
                                      imageUrl,
                                      `${type.id}-${product.handle || product.id}.${extFromDataUri(imageUrl)}`
                                    )
                                  }
                                  className="w-full text-xs bg-amber-500/20 text-amber-300 px-2 py-1.5 rounded-lg hover:bg-amber-500/30 flex items-center justify-center gap-1"
                                >
                                  <Download className="w-3 h-3" /> Descargar
                                </button>
                              </>
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

      {/* Virtual Try-On Modal */}
      <AnimatePresence>
        {tryonModal && (() => {
          const products = (data as { products?: Array<{ id: string; title?: string; description?: string; images?: Array<{ src: string }> }> } | undefined)?.products ?? [];
          const product = products.find((p) => p.id === tryonModal.productId);
          const images = (product?.images ?? []).map((i) => i.src).filter(Boolean);
          const uniqueImages = Array.from(new Set(images));
          return (
            <TryonModal
              productId={tryonModal.productId}
              projectId={projectId}
              productTitle={product?.title || ""}
              productDescription={product?.description || ""}
              productImages={uniqueImages}
              onClose={() => setTryonModal(null)}
              onSuccess={(dataUri) => {
                setCompletedImages((prev) => ({
                  ...prev,
                  [jobKey(tryonModal.productId, "tryon")]: dataUri,
                }));
              }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
