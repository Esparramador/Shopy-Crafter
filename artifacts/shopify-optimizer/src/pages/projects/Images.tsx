import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGetProjectProducts, useGenerateImage } from "@workspace/api-client-react";
import { Camera, Zap, FileJson, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const IMAGE_TYPES = [
  { id: "hero", label: "Hero (Studio)", model: "flux-1.1-pro" },
  { id: "lifestyle", label: "Lifestyle", model: "flux-1.1-pro" },
  { id: "detalle", label: "Detalle/Macro", model: "flux-dev" },
  { id: "packaging", label: "Packaging", model: "recraft-v3" },
  { id: "ugc", label: "Social/UGC", model: "recraft-v3" },
  { id: "escala", label: "Escala", model: "flux-dev" },
  { id: "bundle", label: "Bundle", model: "flux-1.1-pro" },
  { id: "infografia", label: "Infografía SVG", model: "claude-svg" }
];

export default function ImagesPage() {
  const [, params] = useRoute("/projects/:id/images");
  const projectId = parseInt(params?.id || "0");
  const { data, isLoading } = useGetProjectProducts(projectId);
  const generateImage = useGenerateImage();
  
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const handleGenerate = (productId: string, imageType: string) => {
    const key = `${productId}-${imageType}`;
    setGenerating(prev => ({ ...prev, [key]: true }));
    generateImage.mutate({
      projectId,
      productId,
      data: { imageType }
    }, {
      onSettled: () => {
        setGenerating(prev => ({ ...prev, [key]: false }));
      }
    });
  };

  if (isLoading) return <div className="p-12 text-center">Cargando...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Motor de Imágenes</h1>
          <p className="text-muted-foreground mt-1">Generación fotorealista con Replicate (Flux 1.1 Pro & Recraft v3)</p>
        </div>
        <button className="bg-gradient-to-r from-purple-600 to-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(91,78,255,0.4)]">
          <Zap className="w-5 h-5 fill-white" />
          Boost Masivo
        </button>
      </div>

      <div className="space-y-8">
        {data?.products.map((product) => (
          <GlassCard key={product.id} className="p-6">
            <div className="flex items-center gap-4 mb-6">
              {product.images?.[0]?.src && (
                <img src={product.images[0].src} className="w-12 h-12 rounded-lg object-cover bg-black/50" />
              )}
              <div>
                <h3 className="text-lg font-bold text-foreground">{product.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Score Actual: <span className="text-primary font-bold">{product.imageScore}/100</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {IMAGE_TYPES.map((type) => {
                const isGen = generating[`${product.id}-${type.id}`];
                // Mocking existence for demo if ID is long
                const exists = false; 

                return (
                  <div key={type.id} className={cn(
                    "relative group rounded-xl border p-4 flex flex-col items-center justify-center min-h-[140px] text-center transition-all",
                    exists 
                      ? "bg-card border-white/10" 
                      : "bg-black/20 border-dashed border-white/10 hover:border-primary/50",
                    isGen && "border-primary/50 bg-primary/5"
                  )}>
                    {isGen && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    )}
                    
                    <div className="mb-3">
                      {type.id === 'infografia' ? (
                        <FileJson className={cn("w-6 h-6", isGen ? "text-primary animate-pulse" : "text-muted-foreground")} />
                      ) : (
                        <Camera className={cn("w-6 h-6", isGen ? "text-primary animate-pulse" : "text-muted-foreground")} />
                      )}
                    </div>
                    <span className="font-medium text-sm text-foreground mb-1">{type.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{type.model}</span>
                    
                    {!exists && !isGen && (
                      <button 
                        onClick={() => handleGenerate(product.id, type.id)}
                        className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 text-foreground text-xs px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white"
                      >
                        Generar (~$0.03)
                      </button>
                    )}
                    
                    {isGen && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-primary font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Procesando...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
