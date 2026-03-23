import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGetVisualDna, useGetConsistencyScores } from "@workspace/api-client-react";
import { Palette, Fingerprint, RefreshCcw, Check, AlertTriangle, XCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ConsistencyPage() {
  const [, params] = useRoute("/projects/:id/consistency");
  const projectId = parseInt(params?.id || "0");
  
  const { data: dnaData, isLoading: isLoadingDna } = useGetVisualDna(projectId);
  const { data: scoresData, isLoading: isLoadingScores } = useGetConsistencyScores(projectId);

  if (isLoadingDna || isLoadingScores) return <div className="p-12 text-center">Cargando...</div>;

  const dna = dnaData || {
    backgroundStyle: "Fondo blanco puro, seamless",
    lightingStyle: "Soft box profesional, iluminación neutra sin sombras duras",
    mood: "Minimalista, limpio, premium",
    brandColors: ["#ffffff", "#000000", "#f5f5f5"],
    props: ["Ninguno", "Pedestal acrílico"],
    consistencyScore: 82
  };

  const scores = scoresData || {
    totalProducts: 120,
    consistent: 85,
    offBrand: 25,
    inconsistent: 10,
    products: []
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Consistencia Visual</h1>
          <p className="text-muted-foreground mt-1">Asegurando una identidad de marca unificada en todo el catálogo.</p>
        </div>
        <button className="bg-white/5 border border-white/10 text-foreground px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-white/10 transition-all">
          <Fingerprint className="w-5 h-5" />
          Re-extraer DNA
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual DNA Extractor Card */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <Palette className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Visual DNA de la Marca (StyleLock)</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Background Style</p>
              <p className="text-foreground">{dna.backgroundStyle}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Iluminación</p>
              <p className="text-foreground">{dna.lightingStyle}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Mood / Atmósfera</p>
              <p className="text-foreground">{dna.mood}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Props Permitidos</p>
              <div className="flex gap-2 mt-1">
                {dna.props?.map((prop, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 text-muted-foreground border border-white/10">{prop}</span>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Global Score Card */}
        <GlassCard className="p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-bold text-foreground mb-4">Consistencia Global</h3>
          <div className="relative w-40 h-40 flex items-center justify-center mb-4">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <path
                className="text-white/10"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="text-primary"
                strokeDasharray={`${dna.consistencyScore}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-display font-bold text-foreground">{dna.consistencyScore}%</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Catálogo {dna.consistencyScore! > 80 ? 'Cohesivo' : 'Inconsistente'}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-6 border-orange-500/20 bg-orange-500/5">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Productos Off-Brand Detectados</h2>
              <p className="text-sm text-muted-foreground">{scores.offBrand} productos requieren corrección de estilo.</p>
            </div>
          </div>
          <button className="bg-orange-500 text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-400 transition-all shadow-[0_0_15px_rgba(255,140,66,0.3)]">
            <RefreshCcw className="w-4 h-4" />
            Reparar Consistencia Masiva
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
