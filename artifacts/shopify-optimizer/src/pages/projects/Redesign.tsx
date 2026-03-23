import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { useGetProjectProducts, useRedesignProduct, useApplyRedesign, useBulkRedesign } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { Wand2, Layers, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RedesignPage() {
  const [, params] = useRoute("/projects/:id/redesign");
  const projectId = parseInt(params?.id || "0");
  
  const { data, isLoading } = useGetProjectProducts(projectId, { limit: 100 });
  const redesign = useRedesignProduct();
  const apply = useApplyRedesign();
  const bulkRedesign = useBulkRedesign();

  const [activeRedesign, setActiveRedesign] = useState<string | null>(null);
  const [redesignResults, setRedesignResults] = useState<Record<string, any>>({});

  const handleRedesign = (productId: string) => {
    setActiveRedesign(productId);
    redesign.mutate({ projectId, productId }, {
      onSuccess: (res) => {
        setRedesignResults(prev => ({ ...prev, [productId]: res }));
        setActiveRedesign(null);
      },
      onError: () => {
        setActiveRedesign(null);
      }
    });
  };

  const handleApply = (productId: string) => {
    apply.mutate({ 
      projectId, 
      productId, 
      data: { fields: ["title", "bodyHtml", "price", "tags"] } 
    });
  };

  const handleBulk = (mode: string) => {
    bulkRedesign.mutate({ projectId, data: { mode } });
  };

  if (isLoading) return <div className="p-12 text-center">Cargando...</div>;

  const products = data?.products || [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Rediseño IA</h1>
          <p className="text-muted-foreground mt-1">Reescritura completa de títulos, descripciones SEO y precios.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleBulk("weak")} className="bg-white/5 border border-white/10 text-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
            Rediseñar Débiles (C-F)
          </button>
          <button onClick={() => handleBulk("all")} className="bg-primary/20 border border-primary/30 text-primary px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/30 transition-colors">
            Rediseñar Todo
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {products.map((product) => {
          const result = redesignResults[product.id];
          const isRedesigning = activeRedesign === product.id;

          return (
            <GlassCard key={product.id} className="p-6">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: Original */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <GradeBadge grade={product.auditGrade} className="w-8 h-8 text-sm" />
                    <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Original</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{product.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{product.bodyHtml?.replace(/<[^>]*>?/gm, '') || "Sin descripción"}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="bg-white/5 px-3 py-1 rounded-lg text-foreground font-mono">{formatCurrency(product.price)}</span>
                      <span className="text-muted-foreground">{product.tags || "Sin tags"}</span>
                    </div>
                  </div>
                  
                  {!result && (
                    <button 
                      onClick={() => handleRedesign(product.id)}
                      disabled={isRedesigning}
                      className="mt-4 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {isRedesigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
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
                      className="flex-1 space-y-4 pl-0 lg:pl-8 lg:border-l border-white/10 relative"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <Wand2 className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Rediseño Claude</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">{result.title}</h3>
                        <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{result.shortDescription}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg font-mono font-bold border border-green-500/30">
                            {formatCurrency(result.price)}
                          </span>
                          {result.compareAtPrice && (
                            <span className="text-muted-foreground line-through decoration-red-500/50">
                              {formatCurrency(result.compareAtPrice)}
                            </span>
                          )}
                          <span className="text-primary text-xs bg-primary/10 px-2 py-1 rounded border border-primary/20">{result.tags?.split(',')[0]}</span>
                        </div>
                      </div>
                      
                      <div className="pt-4 flex gap-3">
                        <button 
                          onClick={() => handleApply(product.id)}
                          className="bg-green-500 text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(0,214,143,0.2)]"
                        >
                          <Check className="w-4 h-4" />
                          Aplicar a Shopify
                        </button>
                        <button className="bg-white/5 text-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                          Ver Detalles
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
