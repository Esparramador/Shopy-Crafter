import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  useGetFinancialDashboard,
  useGetProductCogs,
  useSaveProductCogs,
  useAnalyzeCompetitorPrices,
  useCalculateOptimalPrice,
  useApplyPriceToShopify,
  useGetProjectProducts,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Scale,
  Loader2,
  CheckCircle,
  Edit3,
  ChevronDown,
  ChevronUp,
  X,
  Package,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type Product = { id: string; title: string; price?: number | null; images?: Array<{ src: string }> };

function CogsModal({
  product,
  projectId,
  onClose,
}: {
  product: Product;
  projectId: number;
  onClose: () => void;
}) {
  const { data: existingCogs } = useGetProductCogs(projectId, product.id);
  const saveCogs = useSaveProductCogs();
  const calcOptimal = useCalculateOptimalPrice();
  const applyPrice = useApplyPriceToShopify();
  const { toast } = useToast();

  const existingCogsData = existingCogs as { unitCost?: number; shippingCostDomestic?: number; packagingCost?: number; cac?: number } | undefined;
  const [cogs, setCogs] = useState({
    unitCost: existingCogsData?.unitCost?.toString() ?? "",
    shippingCostDomestic: existingCogsData?.shippingCostDomestic?.toString() ?? "",
    packagingCost: existingCogsData?.packagingCost?.toString() ?? "",
    cac: existingCogsData?.cac?.toString() ?? "",
    targetMarginPct: "60",
  });

  const [optimalData, setOptimalData] = useState<{
    suggestedPrice?: number;
    compareAtPrice?: number;
    margin?: number;
    reasoning?: string;
  } | null>(null);

  const totalCogs =
    parseFloat(cogs.unitCost || "0") +
    parseFloat(cogs.shippingCostDomestic || "0") +
    parseFloat(cogs.packagingCost || "0") +
    parseFloat(cogs.cac || "0");

  const currentMargin = product.price && totalCogs > 0
    ? Math.round(((product.price - totalCogs) / product.price) * 100)
    : null;

  const handleSave = () => {
    saveCogs.mutate(
      {
        projectId,
        productId: product.id,
        data: {
          unitCost: parseFloat(cogs.unitCost) || 0,
          shippingCostDomestic: parseFloat(cogs.shippingCostDomestic) || 0,
          packagingCost: parseFloat(cogs.packagingCost) || 0,
          cac: parseFloat(cogs.cac) || 0,
          fulfillmentFee: 0,
          returnRate: 0.08,
        },
      },
      {
        onSuccess: () => toast({ title: "COGS guardados" }),
        onError: () => toast({ title: "Error guardando COGS", variant: "destructive" }),
      }
    );
  };

  const handleCalcOptimal = () => {
    calcOptimal.mutate(
      {
        projectId,
        productId: product.id,
        data: {
          cogs: totalCogs,
          targetMarginPct: parseFloat(cogs.targetMarginPct) || 60,
        },
      },
      {
        onSuccess: (d) => setOptimalData(d as typeof optimalData),
        onError: () => toast({ title: "Error calculando precio", variant: "destructive" }),
      }
    );
  };

  const handleApply = (price: number, compareAt: number) => {
    applyPrice.mutate(
      {
        projectId,
        productId: product.id,
        data: { price: String(price), compareAtPrice: String(compareAt) },
      },
      {
        onSuccess: () => {
          toast({ title: "✓ Precio aplicado en Shopify" });
          onClose();
        },
        onError: () => toast({ title: "Error aplicando precio", variant: "destructive" }),
      }
    );
  };

  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm transition-all";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h3 className="font-bold text-foreground">{product.title}</h3>
            <p className="text-sm text-muted-foreground">Calculadora COGS & Precio Óptimo</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* COGS Form */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Costo del Producto (€)</label>
              <input
                type="number"
                step="0.01"
                value={cogs.unitCost}
                onChange={(e) => setCogs({ ...cogs, unitCost: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Costo Envío (€)</label>
              <input
                type="number"
                step="0.01"
                value={cogs.shippingCostDomestic}
                onChange={(e) => setCogs({ ...cogs, shippingCostDomestic: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Packaging (€)</label>
              <input
                type="number"
                step="0.01"
                value={cogs.packagingCost}
                onChange={(e) => setCogs({ ...cogs, packagingCost: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ad Spend por Venta (€)</label>
              <input
                type="number"
                step="0.01"
                value={cogs.cac}
                onChange={(e) => setCogs({ ...cogs, cac: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Margen Objetivo (%)</label>
            <input
              type="number"
              step="1"
              min="0"
              max="95"
              value={cogs.targetMarginPct}
              onChange={(e) => setCogs({ ...cogs, targetMarginPct: e.target.value })}
              className={inputClass}
              placeholder="60"
            />
          </div>

          {/* COGS Summary */}
          <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">COGS Total</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(totalCogs)}</p>
            </div>
            {product.price && (
              <div>
                <p className="text-xs text-muted-foreground">Precio Actual</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(product.price)}</p>
              </div>
            )}
            {currentMargin !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Margen Actual</p>
                <p
                  className="text-xl font-bold"
                  style={{ color: currentMargin >= 50 ? "#00d68f" : currentMargin >= 30 ? "#ffd32a" : "#ff4757" }}
                >
                  {currentMargin}%
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saveCogs.isPending}
              className="flex-1 bg-white/5 border border-white/10 text-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              {saveCogs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar COGS
            </button>
            <button
              onClick={handleCalcOptimal}
              disabled={calcOptimal.isPending || totalCogs === 0}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {calcOptimal.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
              Calcular Precio Óptimo
            </button>
          </div>

          {/* Optimal Price Result */}
          {optimalData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/5 border border-green-500/20 rounded-xl p-5"
            >
              <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Recomendación de Claude
              </h4>
              <div className="flex gap-6 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Precio Sugerido</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(optimalData.suggestedPrice ?? 0)}</p>
                </div>
                {optimalData.compareAtPrice && (
                  <div>
                    <p className="text-xs text-muted-foreground">Compare At</p>
                    <p className="text-2xl font-bold text-muted-foreground line-through">
                      {formatCurrency(optimalData.compareAtPrice)}
                    </p>
                  </div>
                )}
                {optimalData.margin && (
                  <div>
                    <p className="text-xs text-muted-foreground">Margen</p>
                    <p className="text-2xl font-bold text-primary">{optimalData.margin}%</p>
                  </div>
                )}
              </div>
              {optimalData.reasoning && (
                <p className="text-xs text-muted-foreground mb-4">{optimalData.reasoning}</p>
              )}
              <button
                onClick={() => handleApply(optimalData.suggestedPrice!, optimalData.compareAtPrice!)}
                disabled={applyPrice.isPending}
                className="w-full bg-green-500 text-black py-2.5 rounded-xl text-sm font-bold hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
              >
                {applyPrice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Aplicar Precio en Shopify
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function PricingPage() {
  const [, params] = useRoute("/projects/:id/pricing");
  const projectId = parseInt(params?.id || "0");
  const { toast } = useToast();

  const { data: dashboard, isLoading: isLoadingDash } = useGetFinancialDashboard(projectId);
  const { data: productsData } = useGetProjectProducts(projectId, { limit: 100 });
  const analyzeCompetitors = useAnalyzeCompetitorPrices();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorResult, setCompetitorResult] = useState<{
    analysis?: string;
    recommendations?: string[];
  } | null>(null);

  const handleCompetitorAnalysis = () => {
    if (!competitorUrl) return;
    analyzeCompetitors.mutate(
      { projectId, data: { competitorUrls: [competitorUrl] } },
      {
        onSuccess: (d) => setCompetitorResult(d as typeof competitorResult),
        onError: () => toast({ title: "Error analizando competidores", variant: "destructive" }),
      }
    );
  };

  if (isLoadingDash) return <div className="p-12 text-center text-muted-foreground">Cargando...</div>;

  const dash = dashboard || {
    grossRevenue: 0,
    totalCogs: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    netMarginPct: 0,
    aov: 0,
    productProfitability: [],
    alerts: [],
  };

  const products = productsData?.products || [];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Economista IA</h1>
        <p className="text-muted-foreground mt-1">P&L, márgenes, COGS y optimización de precios con IA.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Revenue Bruto (30d)", value: formatCurrency(dash.grossRevenue), color: "text-foreground" },
          { label: "Gross Profit", value: formatCurrency(dash.grossProfit), color: "text-green-400" },
          { label: "Margen Neto %", value: `${dash.netMarginPct}%`, color: "text-primary" },
          { label: "AOV", value: formatCurrency(dash.aov), color: "text-blue-400" },
        ].map((kpi, i) => (
          <GlassCard key={i} className="p-5">
            <div className="text-xs text-muted-foreground mb-1">{kpi.label}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </GlassCard>
        ))}
      </div>

      {/* Alerts */}
      {dash.alerts && dash.alerts.length > 0 && (
        <GlassCard className="p-5 bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="font-bold text-foreground">Alertas de Margen</h2>
          </div>
          <div className="space-y-2">
            {dash.alerts.map((alert, i) => (
              <div key={i} className="text-sm text-red-200 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                {alert}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* COGS Calculator — per product */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Calculadora COGS por Producto</h2>
            <p className="text-sm text-muted-foreground">Haz clic en "Optimizar" para calcular el precio óptimo con IA.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">Producto</th>
                <th className="p-4 font-medium text-right">Precio Actual</th>
                <th className="p-4 font-medium text-right">Score Img</th>
                <th className="p-4 font-medium text-center">Grado</th>
                <th className="p-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {p.images?.[0]?.src ? (
                        <img src={p.images[0].src} alt={p.title} className="w-9 h-9 rounded-lg object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium text-foreground line-clamp-1 max-w-[200px]">{p.title}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right text-foreground">
                    {p.price ? formatCurrency(p.price) : <span className="text-red-400">Sin precio</span>}
                  </td>
                  <td className="p-4 text-right text-muted-foreground">{p.imageScore ?? 0}/100</td>
                  <td className="p-4 text-center">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{
                        backgroundColor: `${p.auditGrade === "A" ? "#00d68f" : p.auditGrade === "B" ? "#00b4d8" : p.auditGrade === "C" ? "#ffd32a" : "#ff4757"}20`,
                        color: p.auditGrade === "A" ? "#00d68f" : p.auditGrade === "B" ? "#00b4d8" : p.auditGrade === "C" ? "#ffd32a" : "#ff4757",
                      }}
                    >
                      {p.auditGrade ?? "–"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedProduct(p as Product)}
                      className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Scale className="w-3 h-3" />
                      Optimizar Precio
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    Escanea tu tienda en Auditoría primero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Competitor Analysis */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Análisis de Competidores
        </h2>
        <div className="flex gap-3">
          <input
            type="url"
            value={competitorUrl}
            onChange={(e) => setCompetitorUrl(e.target.value)}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm"
            placeholder="https://competidor.myshopify.com"
          />
          <button
            onClick={handleCompetitorAnalysis}
            disabled={analyzeCompetitors.isPending || !competitorUrl}
            className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {analyzeCompetitors.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Analizar
          </button>
        </div>

        {competitorResult && (
          <div className="mt-4 bg-black/20 rounded-xl p-4 border border-white/5">
            {competitorResult.analysis && (
              <p className="text-sm text-muted-foreground mb-3">{competitorResult.analysis}</p>
            )}
            {competitorResult.recommendations?.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                {rec}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* COGS Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <CogsModal
            product={selectedProduct}
            projectId={projectId}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
