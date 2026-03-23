import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { useGetProjectProducts, useRunAudit, getGetProjectProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, AlertCircle, TrendingUp, Lightbulb } from "lucide-react";
import { formatCurrency, getGradeColor } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

export default function AuditPage() {
  const [, params] = useRoute("/projects/:id/audit");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();
  
  const [filterGrade, setFilterGrade] = useState<string>("");
  
  const { data, isLoading } = useGetProjectProducts(projectId, { grade: filterGrade || undefined });
  const runAudit = useRunAudit();

  const handleScan = () => {
    runAudit.mutate({ projectId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
      }
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 text-primary animate-spin" /></div>;

  const products = data?.products || [];

  return (
    <div className="space-y-8 pb-12">
      {/* KPI Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Auditoría del Catálogo</h1>
          <p className="text-muted-foreground mt-1">Analizando {data?.total || 0} productos en la tienda</p>
        </div>
        <button 
          onClick={handleScan}
          disabled={runAudit.isPending}
          className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-70"
        >
          <RefreshCw className={`w-5 h-5 ${runAudit.isPending ? 'animate-spin' : ''}`} />
          {runAudit.isPending ? "Escaneando..." : "Escanear Tienda"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard delay={0.1} className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Score Promedio</p>
              <h3 className="text-3xl font-bold text-foreground">{data?.avgScore ? Math.round(data.avgScore) : 0}/100</h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.2} className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Necesitan Mejora (C-F)</p>
              <h3 className="text-3xl font-bold text-foreground">
                {(data?.gradeCounts?.C || 0) + (data?.gradeCounts?.D || 0) + (data?.gradeCounts?.F || 0)}
              </h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.3} className="p-6 md:col-span-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Impacto de Revenue Proyectado</p>
              <h3 className="text-3xl font-bold text-[#00d68f]">+ {formatCurrency(2450.50)} /mes</h3>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="flex justify-between items-center mt-8">
        <h2 className="text-2xl font-bold text-foreground">Resultados</h2>
        <select 
          value={filterGrade} 
          onChange={e => setFilterGrade(e.target.value)}
          className="bg-card border border-white/10 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">Todos los grados</option>
          <option value="A">Grado A</option>
          <option value="B">Grado B</option>
          <option value="C">Grado C</option>
          <option value="D">Grado D</option>
          <option value="F">Grado F</option>
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product, idx) => (
          <GlassCard key={product.id} delay={0.1 * (idx % 10)} hoverEffect className="p-0 flex flex-col md:flex-row border-white/5">
            <div className="w-full md:w-40 h-48 md:h-auto bg-black/40 relative">
              {product.images?.[0]?.src ? (
                <img src={product.images[0].src} alt={product.title} className="w-full h-full object-cover mix-blend-luminosity opacity-80 hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sin Imagen</div>
              )}
              <div className="absolute top-3 left-3">
                <GradeBadge grade={product.auditGrade} />
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1 line-clamp-1">{product.title}</h3>
                <p className="text-primary font-medium">{product.price ? formatCurrency(product.price) : 'Sin precio'}</p>
              </div>
              
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'SEO', score: product.seoScore },
                    { label: 'Img', score: product.imageScore },
                    { label: 'Txt', score: product.descriptionScore },
                    { label: 'Tit', score: product.titleScore },
                    { label: 'Prc', score: product.priceScore },
                  ].map((axis, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${axis.score && axis.score > 70 ? 'bg-[#00d68f]' : axis.score && axis.score > 40 ? 'bg-[#ffd32a]' : 'bg-[#ff4757]'}`} 
                          style={{ width: `${axis.score || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{axis.label}</span>
                    </div>
                  ))}
                </div>

                {product.auditProblems && product.auditProblems.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {product.auditProblems.slice(0, 3).map((prob, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                        {prob}
                      </span>
                    ))}
                    {product.auditProblems.length > 3 && (
                      <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-muted-foreground border border-white/10">
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
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No se encontraron productos. Ejecuta un escaneo primero.
          </div>
        )}
      </div>
    </div>
  );
}
