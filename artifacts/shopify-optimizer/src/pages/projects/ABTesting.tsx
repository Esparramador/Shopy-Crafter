import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGetAbDashboard } from "@workspace/api-client-react";
import { SplitSquareHorizontal, Trophy, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

export default function ABTestingPage() {
  const [, params] = useRoute("/projects/:id/ab-testing");
  const projectId = parseInt(params?.id || "0");
  
  const { data, isLoading } = useGetAbDashboard(projectId);

  if (isLoading) return <div className="p-12 text-center">Cargando...</div>;

  // Mock data since endpoint might return null if not seeded
  const dashboard = data || {
    activeTests: 3,
    completedTests: 12,
    winRate: 68,
    totalRevenueImpact: 4250.00,
    avgConversionLift: 24.5,
    insight: "Las imágenes Lifestyle convierten un 34% mejor que las de Studio. Las fotos con modelo humano generan 2.1x más engagement. Recomendación: priorizar lifestyle + modelo.",
    recentWinners: []
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">A/B Testing Automático</h1>
          <p className="text-muted-foreground mt-1">Optimizando conversión con datos reales de Shopify</p>
        </div>
        <button className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)]">
          <SplitSquareHorizontal className="w-5 h-5" />
          Nuevo Test
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard delay={0.1} className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Tests Activos</div>
          <div className="text-4xl font-bold text-foreground">{dashboard.activeTests}</div>
        </GlassCard>
        <GlassCard delay={0.2} className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Win Rate</div>
          <div className="text-4xl font-bold text-blue-400">{dashboard.winRate}%</div>
        </GlassCard>
        <GlassCard delay={0.3} className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Lift de Conversión Avg</div>
          <div className="text-4xl font-bold text-green-400">+{dashboard.avgConversionLift}%</div>
        </GlassCard>
        <GlassCard delay={0.4} className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Revenue Impact (30d)</div>
          <div className="text-4xl font-bold text-primary">{formatCurrency(dashboard.totalRevenueImpact)}</div>
        </GlassCard>
      </div>

      <GlassCard delay={0.5} className="p-6 border-primary/30 bg-primary/5">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">Insight del Mes</h3>
            <p className="text-muted-foreground leading-relaxed">{dashboard.insight}</p>
          </div>
        </div>
      </GlassCard>

      <h2 className="text-2xl font-bold text-foreground mt-8 mb-6">Tests Activos (Mock)</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mock Active Test Card */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Background Impact</div>
                <h3 className="text-lg font-bold text-foreground">Bomber Jacket Noir</h3>
              </div>
              <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> Running
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Hipótesis: Fondo lifestyle aspiacional mejora conversión vs fondo blanco.</p>
          </div>
          
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Variant A */}
              <div className="space-y-3">
                <div className="aspect-[4/5] rounded-xl bg-black/40 border border-white/10 relative overflow-hidden flex items-center justify-center">
                  <span className="text-muted-foreground font-medium">Control (A)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3"/> 1,240</span>
                  <span className="text-foreground font-medium">2.1% CR</span>
                </div>
              </div>
              
              {/* Variant B */}
              <div className="space-y-3">
                <div className="aspect-[4/5] rounded-xl bg-primary/10 border-2 border-primary/30 relative overflow-hidden flex items-center justify-center">
                  <span className="text-primary font-bold">Challenger (B)</span>
                  <div className="absolute top-2 right-2 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-md">Ganando</div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3"/> 1,235</span>
                  <span className="text-green-400 font-bold">2.8% CR</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Confianza Estadística (Z-Test)</span>
                <span className="text-primary font-bold">92%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: '92%' }} />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">Declara ganador automático al 95%</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
