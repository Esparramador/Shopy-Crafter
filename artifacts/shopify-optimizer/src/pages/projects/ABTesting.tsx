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
import{ SplitSquareHorizontal, Trophy, TrendingUp, Users, Plus, X, Loader2, CheckCircle, DollarSign, ImageIcon }from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import SaveReportButton from "@/components/SaveReportButton";

function NewTestModal({
  projectId,
  onClose,
  products,
}: {
  projectId: number;
  onClose: () => void;
  products: Array<{ id: string; title: string; price?: string; images?: Array<{ src: string }> }>;
}) {
  const createTest = useCreateAbTest();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    productId: "",
    testType: "image" as "image" | "price",
    hypothesis: "",
    variantADescription: "",
    variantBDescription: "",
    variantAPrice: "",
    variantBPrice: "",
    durationDays: "14",
  });

  const selectedProduct = products.find(p => p.id === form.productId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId) return;

    createTest.mutate(
      {
        projectId,
        data: {
          productId: form.productId,
          testType: form.testType,
          hypothesis: form.hypothesis,
          variantADescription: form.variantADescription,
          variantBDescription: form.variantBDescription,
          variantAPrice: form.testType === "price" ? form.variantAPrice : undefined,
          variantBPrice: form.testType === "price" ? form.variantBPrice : undefined,
          durationDays: parseInt(form.durationDays) || 14,
        } as unknown as Parameters<typeof createTest.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: form.testType === "price" ? "Test de precio creado con predicción IA" : "Test A/B de imagen creado" });
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
            <p className="text-sm text-muted-foreground">
              {form.testType === "price"
                ? "Compara dos precios con predicción de impacto económico IA."
                : "Compara dos variantes de imagen con datos reales."}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, testType: "image" })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                form.testType === "image"
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Test de Imagen
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({
                  ...form,
                  testType: "price",
                  variantAPrice: selectedProduct?.price || "",
                  hypothesis: form.hypothesis || "El precio sugerido mejorará la conversión sin sacrificar margen",
                });
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                form.testType === "price"
                  ? "bg-green-500/20 border-green-500 text-green-400"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
              }`}
            >
              <DollarSign className="w-4 h-4" /> Test de Precio
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Producto *</label>
            <select
              required
              value={form.productId}
              onChange={(e) => {
                const prod = products.find(p => p.id === e.target.value);
                setForm({
                  ...form,
                  productId: e.target.value,
                  variantAPrice: form.testType === "price" ? (prod?.price || "") : form.variantAPrice,
                });
              }}
              className={inputClass}
            >
              <option value="">Selecciona un producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.price ? `(€${p.price})` : ""}
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
              placeholder={
                form.testType === "price"
                  ? "Ej: Subir el precio un 15% no reducirá las ventas significativamente"
                  : "Ej: La imagen lifestyle convierte mejor que la de fondo blanco"
              }
            />
          </div>

          {form.testType === "price" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-blue-400">Precio Actual (A) €</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.variantAPrice}
                  onChange={(e) => setForm({ ...form, variantAPrice: e.target.value })}
                  className={inputClass}
                  placeholder="19.99"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-green-400">Precio Sugerido (B) €</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.variantBPrice}
                  onChange={(e) => setForm({ ...form, variantBPrice: e.target.value })}
                  className={inputClass}
                  placeholder="24.95"
                />
              </div>
              {form.variantAPrice && form.variantBPrice && (
                <div className="col-span-2 bg-white/5 rounded-xl p-3 border border-white/10 text-xs text-muted-foreground">
                  Cambio: {((parseFloat(form.variantBPrice) - parseFloat(form.variantAPrice)) / parseFloat(form.variantAPrice) * 100).toFixed(1)}%
                  {" · "}La IA predecirá el impacto en conversión, revenue y margen al crear el test.
                </div>
              )}
            </div>
          ) : (
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
          )}

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
            {createTest.isPending
              ? form.testType === "price" ? "Analizando impacto con IA..." : "Creando..."
              : form.testType === "price" ? "Crear Test de Precio + Predicción IA" : "Crear Test de Imagen"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

type AiPrediction = {
  predictedConversionChangeA?: string;
  predictedConversionChangeB?: string;
  predictedRevenueImpactA?: string;
  predictedRevenueImpactB?: string;
  predictedMarginA?: number;
  predictedMarginB?: number;
  salesVolumeImpact?: string;
  visualImpact?: string;
  economicImpact?: string;
  recommendation?: string;
  riskLevel?: string;
  priceElasticity?: string;
};

type ABTest = {
  id: number;
  productId: string;
  productTitle?: string;
  testType?: string;
  hypothesis?: string;
  variantADescription?: string;
  variantBDescription?: string;
  variantAPrice?: string;
  variantBPrice?: string;
  aiPrediction?: AiPrediction | null;
  status?: string;
  variantAConversions?: number;
  variantBConversions?: number;
  variantAVisitors?: number;
  variantBVisitors?: number;
  winner?: string | null;
  confidence?: number;
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
    test.variantAVisitors && test.variantAVisitors > 0
      ? ((test.variantAConversions ?? 0) / test.variantAVisitors) * 100
      : 0;
  const crB =
    test.variantBVisitors && test.variantBVisitors > 0
      ? ((test.variantBConversions ?? 0) / test.variantBVisitors) * 100
      : 0;
  const bWinning = crB > crA;

  const handleDeclareWinner = (winner: "A" | "B") => {
    declareWinner.mutate(
      { projectId, testId: String(test.id), data: { winner, applyToShopify: false } as unknown as Parameters<typeof declareWinner.mutate>[0]["data"] },
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

  const isPriceTest = test.testType === "price";
  const pred = test.aiPrediction as AiPrediction | null | undefined;

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="p-5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-xs font-bold text-primary uppercase tracking-wider">
                {isPriceTest ? "💰 Test Precio" : "🖼 Test Imagen"} #{test.id}
              </div>
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
        {isPriceTest && test.variantAPrice && test.variantBPrice && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
              <div className="text-xs text-blue-400 mb-1">Precio Actual (A)</div>
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(parseFloat(test.variantAPrice))}</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <div className="text-xs text-green-400 mb-1">Precio Sugerido (B)</div>
              <div className="text-2xl font-bold text-green-400">{formatCurrency(parseFloat(test.variantBPrice))}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {((parseFloat(test.variantBPrice) - parseFloat(test.variantAPrice)) / parseFloat(test.variantAPrice) * 100).toFixed(1)}% cambio
              </div>
            </div>
          </div>
        )}

        {isPriceTest && pred && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Predicción IA
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <div className="text-[10px] text-muted-foreground">Revenue A</div>
                <div className="text-sm font-semibold text-foreground">{pred.predictedRevenueImpactA ?? "—"}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <div className="text-[10px] text-muted-foreground">Revenue B</div>
                <div className="text-sm font-semibold text-green-400">{pred.predictedRevenueImpactB ?? "—"}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <div className="text-[10px] text-muted-foreground">Margen A</div>
                <div className="text-sm font-semibold text-foreground">{pred.predictedMarginA != null ? `${pred.predictedMarginA}%` : "—"}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <div className="text-[10px] text-muted-foreground">Margen B</div>
                <div className="text-sm font-semibold text-green-400">{pred.predictedMarginB != null ? `${pred.predictedMarginB}%` : "—"}</div>
              </div>
            </div>
            {pred.visualImpact && (
              <div className="text-xs text-muted-foreground bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-foreground font-medium">Impacto visual:</span> {pred.visualImpact}
              </div>
            )}
            {pred.economicImpact && (
              <div className="text-xs text-muted-foreground bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-foreground font-medium">Impacto económico:</span> {pred.economicImpact}
              </div>
            )}
            {pred.recommendation && (
              <div className={`text-xs rounded-lg p-2.5 border ${
                pred.riskLevel === "bajo" ? "bg-green-500/10 border-green-500/20 text-green-400"
                : pred.riskLevel === "alto" ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              }`}>
                <span className="font-medium">Recomendación ({pred.riskLevel ?? "medio"}):</span> {pred.recommendation}
              </div>
            )}
          </div>
        )}

        {!isPriceTest && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Control (A)</div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 min-h-[60px] flex items-center justify-center text-sm text-muted-foreground text-center">
              {test.variantADescription || "Imagen original"}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> {test.variantAVisitors ?? 0}
              </span>
              <span className="text-foreground font-medium">{crA.toFixed(1)}% CR</span>
            </div>
          </div>

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
                <Users className="w-3 h-3" /> {test.variantBVisitors ?? 0}
              </span>
              <span className={`font-bold ${bWinning ? "text-green-400" : "text-foreground"}`}>
                {crB.toFixed(1)}% CR
              </span>
            </div>
          </div>
        </div>
        )}

        {/* Confidence */}
        {test.confidence !== undefined && (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Confianza estadística</span>
              <span className="text-primary font-bold">{test.confidence}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${test.confidence}%`,
                  backgroundColor: (test.confidence ?? 0) >= 95 ? "#00d68f" : "#5b4eff",
                }}
              />
            </div>
            {(test.confidence ?? 0) >= 95 && (
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
          <p className="text-muted-foreground mt-1">Pruebas de imágenes y precios con datos reales y predicción IA.</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <SaveReportButton
            projectId={projectId}
            title="Informe A/B Testing"
            fileType="ab_testing"
            category="ab_testing"
            compact
            buildContent={() => {
              return `
<h2>Resumen A/B Testing</h2>
<div class="metric-grid">
  <div class="metric-card"><div class="label">Tests Activos</div><div class="value">${activeTests.length || dash.activeTests || 0}</div></div>
  <div class="metric-card"><div class="label">Tests Completados</div><div class="value">${completedTests.length || dash.completedTests || 0}</div></div>
  <div class="metric-card"><div class="label">Win Rate</div><div class="value">${dash.winRate ?? 0}%</div></div>
  <div class="metric-card"><div class="label">Impacto Revenue</div><div class="value">${formatCurrency(dash.totalRevenueImpact || 0)}</div></div>
</div>
${dash.insight ? `<blockquote style="border-left:3px solid #c8a84b;padding:12px 16px;margin:16px 0;font-style:italic;color:#c8a84b">${dash.insight}</blockquote>` : ""}
${tests.length > 0 ? `<h2>Historial de Tests</h2><table><tr><th>Producto</th><th>Tipo</th><th>Estado</th><th>Variante A (CTR)</th><th>Variante B (CTR)</th><th>Ganador</th></tr>${tests.map((t: any) => `<tr><td>${t.productTitle || t.productId}</td><td>${t.testType}</td><td>${t.status}</td><td>${((t.variantAClicks || 0) / Math.max(t.variantAImpressions || 1, 1) * 100).toFixed(1)}%</td><td>${((t.variantBClicks || 0) / Math.max(t.variantBImpressions || 1, 1) * 100).toFixed(1)}%</td><td>${t.winner || "—"}</td></tr>`).join("")}</table>` : "<p>No hay tests registrados aún.</p>"}`;

            }}
          />
          <button
            onClick={() => setShowNewTestModal(true)}
            className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)]"
          >
            <Plus className="w-5 h-5" />
            Nuevo Test
          </button>
        </div>
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
            products={products as any}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
