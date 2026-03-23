import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  useGetAbDashboard,
  useListAbTests,
  useCreateAbTest,
  useDeclareAbTestWinner,
  useGetProjectProducts,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SplitSquareHorizontal,
  Trophy,
  TrendingUp,
  Users,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Clock,
  BarChart2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

function NewTestModal({
  projectId,
  onClose,
  products,
}: {
  projectId: number;
  onClose: () => void;
  products: Array<{ id: string; title: string; images?: Array<{ src: string }> }>;
}) {
  const createTest = useCreateAbTest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    productId: "",
    hypothesis: "",
    variantADescription: "",
    variantBDescription: "",
    durationDays: "14",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId) return;

    createTest.mutate(
      {
        projectId,
        data: {
          productId: form.productId,
          hypothesis: form.hypothesis,
          variantADescription: form.variantADescription,
          variantBDescription: form.variantBDescription,
          durationDays: parseInt(form.durationDays) || 14,
        } as unknown as Parameters<typeof createTest.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: "Test A/B creado exitosamente" });
          onClose();
        },
        onError: () => toast({ title: "Error creando test", variant: "destructive" }),
      }
    );
  };

  const inputClass =
    "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm transition-all";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h3 className="text-lg font-bold text-foreground">Crear Test A/B</h3>
            <p className="text-sm text-muted-foreground">Compara dos variantes de imagen con datos reales.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Producto *</label>
            <select
              required
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              className={inputClass}
            >
              <option value="">Selecciona un producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hipótesis del Test *</label>
            <input
              required
              type="text"
              value={form.hypothesis}
              onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
              className={inputClass}
              placeholder="Ej: La imagen lifestyle convierte mejor que la de fondo blanco"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-blue-400">Control (A)</label>
              <input
                type="text"
                value={form.variantADescription}
                onChange={(e) => setForm({ ...form, variantADescription: e.target.value })}
                className={inputClass}
                placeholder="Imagen actual (fondo blanco)"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-green-400">Challenger (B)</label>
              <input
                type="text"
                value={form.variantBDescription}
                onChange={(e) => setForm({ ...form, variantBDescription: e.target.value })}
                className={inputClass}
                placeholder="Nueva imagen lifestyle"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Duración del test (días)</label>
            <input
              type="number"
              min="7"
              max="90"
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={createTest.isPending}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {createTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {createTest.isPending ? "Creando..." : "Crear Test"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

type ABTest = {
  id: number;
  productId: string;
  hypothesis?: string;
  variantADescription?: string;
  variantBDescription?: string;
  status?: string;
  variantAConversions?: number;
  variantBConversions?: number;
  variantAViews?: number;
  variantBViews?: number;
  winner?: string | null;
  confidenceLevel?: number;
};

function TestCard({
  test,
  projectId,
}: {
  test: ABTest;
  projectId: number;
}) {
  const declareWinner = useDeclareAbTestWinner();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const crA =
    test.variantAViews && test.variantAViews > 0
      ? ((test.variantAConversions ?? 0) / test.variantAViews) * 100
      : 0;
  const crB =
    test.variantBViews && test.variantBViews > 0
      ? ((test.variantBConversions ?? 0) / test.variantBViews) * 100
      : 0;
  const bWinning = crB > crA;

  const handleDeclareWinner = (winner: "A" | "B") => {
    declareWinner.mutate(
      { projectId, testId: test.id, data: { winner, applyToShopify: false } as unknown as Parameters<typeof declareWinner.mutate>[0]["data"] },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: `✓ Variante ${winner} declarada ganadora` });
        },
        onError: () => toast({ title: "Error al declarar ganador", variant: "destructive" }),
      }
    );
  };

  const statusColor =
    test.status === "running"
      ? "bg-blue-500/20 text-blue-400"
      : test.status === "completed"
      ? "bg-green-500/20 text-green-400"
      : "bg-muted/20 text-muted-foreground";

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="p-5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
              A/B Test #{test.id}
            </div>
            <p className="text-base font-semibold text-foreground line-clamp-2">
              {test.hypothesis || "Sin hipótesis definida"}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusColor}`}>
            {test.status === "running" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            {test.status === "running" ? "Activo" : test.status === "completed" ? "Completado" : "Pausado"}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {/* Variant A */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Control (A)</div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 min-h-[60px] flex items-center justify-center text-sm text-muted-foreground text-center">
              {test.variantADescription || "Imagen original"}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> {test.variantAViews ?? 0}
              </span>
              <span className="text-foreground font-medium">{crA.toFixed(1)}% CR</span>
            </div>
          </div>

          {/* Variant B */}
          <div className="space-y-2">
            <div className={`text-xs font-semibold mb-2 ${bWinning ? "text-green-400" : "text-muted-foreground"}`}>
              Challenger (B) {bWinning && "🏆"}
            </div>
            <div
              className={`rounded-xl p-3 border min-h-[60px] flex items-center justify-center text-sm text-center relative ${
                bWinning ? "bg-primary/5 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-muted-foreground"
              }`}
            >
              {bWinning && (
                <div className="absolute top-2 right-2 bg-green-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
                  Ganando
                </div>
              )}
              {test.variantBDescription || "Nueva variante"}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> {test.variantBViews ?? 0}
              </span>
              <span className={`font-bold ${bWinning ? "text-green-400" : "text-foreground"}`}>
                {crB.toFixed(1)}% CR
              </span>
            </div>
          </div>
        </div>

        {/* Confidence */}
        {test.confidenceLevel !== undefined && (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Confianza estadística</span>
              <span className="text-primary font-bold">{test.confidenceLevel}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${test.confidenceLevel}%`,
                  backgroundColor: test.confidenceLevel >= 95 ? "#00d68f" : "#5b4eff",
                }}
              />
            </div>
            {test.confidenceLevel >= 95 && (
              <p className="text-xs text-green-400 mt-1">¡Estadísticamente significativo! Listo para declarar ganador.</p>
            )}
          </div>
        )}

        {/* Actions */}
        {test.status === "running" && (
          <div className="flex gap-2 pt-2 border-t border-white/5">
            <button
              onClick={() => handleDeclareWinner("A")}
              disabled={declareWinner.isPending}
              className="flex-1 text-xs bg-white/5 border border-white/10 text-muted-foreground py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Gana A
            </button>
            <button
              onClick={() => handleDeclareWinner("B")}
              disabled={declareWinner.isPending}
              className="flex-1 text-xs bg-green-500/10 border border-green-500/20 text-green-400 py-2 rounded-lg hover:bg-green-500/20 transition-colors font-medium"
            >
              Gana B 🏆
            </button>
          </div>
        )}

        {test.status === "completed" && test.winner && (
          <div className="flex items-center gap-2 text-sm text-green-400 pt-2 border-t border-white/5">
            <CheckCircle className="w-4 h-4" />
            Variante {test.winner} ganó el test
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default function ABTestingPage() {
  const [, params] = useRoute("/projects/:id/ab-testing");
  const projectId = parseInt(params?.id || "0");

  const { data: dashboard } = useGetAbDashboard(projectId);
  const { data: testsData, isLoading } = useListAbTests(projectId);
  const { data: productsData } = useGetProjectProducts(projectId, { limit: 100 });
  const [showNewTestModal, setShowNewTestModal] = useState(false);

  const dash = (dashboard as {
    activeTests?: number;
    completedTests?: number;
    winRate?: number;
    totalRevenueImpact?: number;
    avgConversionLift?: number;
    insight?: string;
  } | null | undefined) || {};

  const tests: ABTest[] = (testsData as ABTest[] | undefined) || [];
  const products = productsData?.products || [];
  const activeTests = tests.filter((t) => t.status === "running");
  const completedTests = tests.filter((t) => t.status === "completed");

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">A/B Testing Automático</h1>
          <p className="text-muted-foreground mt-1">Pruebas estadísticas de imágenes con datos reales de Shopify.</p>
        </div>
        <button
          onClick={() => setShowNewTestModal(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)]"
        >
          <Plus className="w-5 h-5" />
          Nuevo Test
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <div className="text-xs text-muted-foreground mb-1">Tests Activos</div>
          <div className="text-3xl font-bold text-foreground">{activeTests.length || dash.activeTests || 0}</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs text-muted-foreground mb-1">Tests Completados</div>
          <div className="text-3xl font-bold text-blue-400">{completedTests.length || dash.completedTests || 0}</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
          <div className="text-3xl font-bold text-green-400">{dash.winRate ?? 0}%</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs text-muted-foreground mb-1">Revenue Impact (30d)</div>
          <div className="text-3xl font-bold text-primary">{formatCurrency(dash.totalRevenueImpact ?? 0)}</div>
        </GlassCard>
      </div>

      {/* Insight */}
      {dash.insight && (
        <GlassCard className="p-5 border-primary/20 bg-primary/5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Insight del Mes</h3>
              <p className="text-sm text-muted-foreground">{dash.insight}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Active Tests */}
      {!isLoading && (
        <>
          {activeTests.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Tests Activos ({activeTests.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeTests.map((t) => (
                  <TestCard key={t.id} test={t} projectId={projectId} />
                ))}
              </div>
            </>
          )}

          {completedTests.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Tests Completados ({completedTests.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {completedTests.map((t) => (
                  <TestCard key={t.id} test={t} projectId={projectId} />
                ))}
              </div>
            </>
          )}

          {tests.length === 0 && (
            <div className="py-20 text-center">
              <SplitSquareHorizontal className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No hay tests activos.</p>
              <button
                onClick={() => setShowNewTestModal(true)}
                className="bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Crear Primer Test
              </button>
            </div>
          )}
        </>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* New Test Modal */}
      <AnimatePresence>
        {showNewTestModal && (
          <NewTestModal
            projectId={projectId}
            onClose={() => setShowNewTestModal(false)}
            products={products}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
