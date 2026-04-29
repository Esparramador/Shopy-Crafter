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
import{ TrendingUp, AlertTriangle, Scale, Loader2, CheckCircle, ChevronDown, ChevronUp, X, Package, Calculator, BarChart3, Target, Brain }from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import SaveReportButton from "@/components/SaveReportButton";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Product = { id: string; title: string; price?: number | null; images?: Array<{ src: string }> };

type CostCategory = {
  id: string;
  label: string;
  icon: string;
  fields: Array<{ key: string; label: string; placeholder?: string; suffix?: string }>;
};

const COST_CATEGORIES: CostCategory[] = [
  {
    id: "production", label: "Producción y Fabricación", icon: "🏭",
    fields: [
      { key: "unitCost", label: "Coste unitario producto" },
      { key: "materialCost", label: "Materiales (marcos, componentes...)" },
      { key: "fabricCost", label: "Tejidos / Telas" },
      { key: "printingCost", label: "Impresión digital" },
      { key: "screenPrintingCost", label: "Serigrafía" },
      { key: "moldAmortization", label: "Amortización moldes/utillajes" },
      { key: "assemblyCost", label: "Montaje / Ensamblaje" },
      { key: "laborCostPerUnit", label: "Mano de obra por unidad" },
      { key: "qualityControlCost", label: "Control de calidad" },
    ],
  },
  {
    id: "packaging", label: "Embalaje y Etiquetado", icon: "📦",
    fields: [
      { key: "packagingCost", label: "Embalaje / Packaging" },
      { key: "labelCost", label: "Etiquetas / Pegatinas" },
    ],
  },
  {
    id: "logistics", label: "Logística y Envío", icon: "🚚",
    fields: [
      { key: "shippingCostDomestic", label: "Envío nacional" },
      { key: "shippingCostInternational", label: "Envío internacional" },
      { key: "fulfillmentFee", label: "Fulfillment / Preparación pedido" },
      { key: "warehouseCostPerUnit", label: "Almacén por unidad" },
      { key: "customsDuty", label: "Aranceles / Aduanas" },
      { key: "insuranceCost", label: "Seguro de envío" },
    ],
  },
  {
    id: "returns", label: "Devoluciones", icon: "🔄",
    fields: [
      { key: "returnRate", label: "Tasa de devolución", placeholder: "0.08", suffix: "%" },
      { key: "returnProcessingCost", label: "Coste procesar devolución" },
    ],
  },
  {
    id: "platform", label: "Plataforma y Pagos", icon: "💳",
    fields: [
      { key: "shopifyPaymentFee", label: "Comisión pasarela de pago", placeholder: "0.015", suffix: "%" },
      { key: "shopifyPlanCostPerOrder", label: "Coste plataforma por pedido" },
      { key: "paymentProcessingFee", label: "Comisión pasarela pago" },
      { key: "platformCommission", label: "Comisión marketplace / plataforma" },
    ],
  },
  {
    id: "marketing", label: "Marketing y Adquisición", icon: "📣",
    fields: [
      { key: "cac", label: "CAC (Coste Adquisición Cliente)" },
      { key: "affiliateFee", label: "Comisión afiliados" },
      { key: "digitalMarketingCost", label: "Marketing digital por unidad" },
      { key: "influencerCostPerUnit", label: "Influencers por unidad" },
      { key: "seoCostPerUnit", label: "SEO por unidad" },
    ],
  },
  {
    id: "taxes", label: "Impuestos y Legal", icon: "📋",
    fields: [
      { key: "vatRate", label: "IVA / Tax Rate", placeholder: "0.21", suffix: "%" },
      { key: "corporateTaxRate", label: "Impuesto sociedades", suffix: "%" },
      { key: "consultingFee", label: "Asesoría / Consultoría" },
      { key: "legalCostPerUnit", label: "Legal por unidad" },
    ],
  },
  {
    id: "tech", label: "Tecnología e IA", icon: "🤖",
    fields: [
      { key: "aiApiCostPerUnit", label: "APIs de IA por unidad (Claude, Replicate...)" },
      { key: "designCostPerUnit", label: "Diseño gráfico por unidad" },
    ],
  },
  {
    id: "overhead", label: "Gastos Generales", icon: "🏢",
    fields: [
      { key: "overheadPerUnit", label: "Overhead / gastos generales por unidad" },
    ],
  },
];

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

  const ex = (existingCogs ?? {}) as Record<string, any>;
  const allKeys = COST_CATEGORIES.flatMap(c => c.fields.map(f => f.key));
  const initialState: Record<string, string> = {};
  for (const k of allKeys) initialState[k] = ex[k]?.toString() ?? "";
  initialState["targetMarginPct"] = "60";

  const [cogs, setCogs] = useState(initialState);
  const [customCosts, setCustomCosts] = useState<Array<{ name: string; cost: string }>>(
    Array.isArray(ex.customCosts) ? ex.customCosts.map((c: any) => ({ name: c.name ?? "", cost: String(c.cost ?? "0") })) : []
  );
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["production", "logistics"]));
  const [notes, setNotes] = useState(ex.notes ?? "");

  const [optimalData, setOptimalData] = useState<{
    suggestedPrice?: number;
    optimalPrice?: number;
    psychologicalPrice?: number;
    compareAtPrice?: number;
    margin?: number;
    reasoning?: string;
    recommendedStrategy?: string;
    competitorAnalysis?: string;
    supplierAnalysis?: string;
    marginWaterfall?: { revenue: number; platformFees: number; cogs: number; packaging: number; shipping: number; returns: number; marketing: number; overhead: number; netMargin: number; netMarginPct: number };
    priceImpactEstimate?: { currentPrice: number; suggestedPrice: number; expectedSalesChange: string; expectedRevenueChange: string; confidenceLevel: string };
    marketResearch?: {
      competitorPrices: Array<{ source: string; price: string; productName?: string }>;
      marketPriceRange: { min: number; max: number; median: number };
      marketPosition: string;
      avgSupplierCost: number;
      supplierInsight: string;
    };
  } | null>(null);

  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<{
    ownEquipment: Record<string, number>;
    externalService: Record<string, number>;
    reasoning: string;
    shippingBreakdown?: Array<{ carrier: string; domestic: number; international: number; estimatedWeight: string }>;
    materialBreakdown?: Array<{ material: string; costPerUnit: number; notes: string }>;
    productionMethod?: string;
    colorComplexity?: string;
    confidenceLevel?: string;
  } | null>(null);
  const [activeScenario, setActiveScenario] = useState<"ownEquipment" | "externalService">("ownEquipment");

  const handleAiEstimate = async () => {
    setAiEstimating(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/products/${product.id}/ai-estimate-cogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error estimando costes");
      const data = await res.json();
      setAiEstimate(data);
      const scenario = data.ownEquipment || {};
      const newCogs: Record<string, string> = { ...cogs };
      for (const k of allKeys) {
        if (scenario[k] != null) {
          newCogs[k] = String(scenario[k]);
        }
      }
      setCogs(newCogs);
      setExpandedCats(new Set(COST_CATEGORIES.map(c => c.id)));
      toast({ title: "Costes estimados por IA — revisa y ajusta" });
    } catch {
      toast({ title: "Error estimando costes con IA", variant: "destructive" });
    } finally {
      setAiEstimating(false);
    }
  };

  const applyScenario = (scenario: "ownEquipment" | "externalService") => {
    if (!aiEstimate) return;
    setActiveScenario(scenario);
    const data = aiEstimate[scenario] || {};
    const newCogs: Record<string, string> = { ...cogs };
    for (const k of allKeys) {
      if (data[k] != null) {
        newCogs[k] = String(data[k]);
      }
    }
    setCogs(newCogs);
  };

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const n = (k: string) => parseFloat(cogs[k] || "0") || 0;
  const price = product.price ?? 0;

  const categoryTotals = COST_CATEGORIES.map(cat => {
    let total = 0;
    if (cat.id === "returns") {
      total = n("returnRate") * n("returnProcessingCost");
    } else if (cat.id === "platform") {
      total = (price * n("shopifyPaymentFee")) + n("shopifyPlanCostPerOrder") + n("paymentProcessingFee") + n("platformCommission");
    } else {
      total = cat.fields.reduce((sum, f) => {
        if (f.suffix === "%") return sum;
        return sum + n(f.key);
      }, 0);
    }
    return { id: cat.id, label: cat.label, total };
  });

  const customTotal = customCosts.reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0);
  const subtotal = categoryTotals.reduce((sum, c) => sum + c.total, 0) + customTotal;
  const vatRate = cogs.vatRate !== "" ? (parseFloat(cogs.vatRate) ?? 0.21) : 0.21;
  const totalWithVat = subtotal * (1 + vatRate);

  const currentMargin = product.price && subtotal > 0
    ? Math.round(((product.price - subtotal) / product.price) * 100)
    : null;

  const handleSave = () => {
    const data: Record<string, any> = {};
    for (const k of allKeys) data[k] = parseFloat(cogs[k]) || 0;
    data.customCosts = customCosts.filter(c => c.name).map(c => ({ name: c.name, cost: parseFloat(c.cost) || 0 }));
    data.notes = notes;
    data.finalPrice = product.price ?? 0;
    saveCogs.mutate(
      { projectId, productId: product.id, data: data as any },
      {
        onSuccess: () => toast({ title: "Costes guardados correctamente" }),
        onError: () => toast({ title: "Error guardando costes", variant: "destructive" }),
      }
    );
  };

  const handleCalcOptimal = () => {
    calcOptimal.mutate(
      { projectId, productId: product.id },
      {
        onSuccess: (d) => setOptimalData(d as typeof optimalData),
        onError: () => toast({ title: "Error calculando precio", variant: "destructive" }),
      }
    );
  };

  const handleApply = (price: number, compareAt?: number) => {
    applyPrice.mutate(
      { projectId, productId: product.id, data: { price: String(price), compareAtPrice: compareAt ? String(compareAt) : undefined } },
      {
        onSuccess: () => { toast({ title: "Precio aplicado en tu tienda" }); onClose(); },
        onError: () => toast({ title: "Error aplicando precio", variant: "destructive" }),
      }
    );
  };

  const inputClass = "w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-primary text-sm transition-all";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f0f1a] z-10">
          <div>
            <h3 className="font-bold text-foreground text-lg">Estructura de Costes Real</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{product.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="border border-primary/30 rounded-xl p-4 bg-primary/[0.03]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
              <button
                onClick={handleAiEstimate}
                disabled={aiEstimating}
                className="flex-1 w-full sm:w-auto bg-primary text-white py-2.5 px-4 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {aiEstimating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                {aiEstimating ? "Analizando producto..." : "Auto-estimar con IA"}
              </button>
              {aiEstimate && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => applyScenario("ownEquipment")}
                    className={`flex-1 sm:flex-none text-xs px-3 py-2 rounded-lg border transition-colors ${activeScenario === "ownEquipment" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"}`}
                  >
                    Equipo Propio
                  </button>
                  <button
                    onClick={() => applyScenario("externalService")}
                    className={`flex-1 sm:flex-none text-xs px-3 py-2 rounded-lg border transition-colors ${activeScenario === "externalService" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"}`}
                  >
                    Servicio Externo
                  </button>
                </div>
              )}
            </div>
            {aiEstimate && (
              <div className="space-y-2">
                {aiEstimate.productionMethod && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">{aiEstimate.productionMethod}</span>
                    {aiEstimate.colorComplexity && <span className="bg-white/5 text-muted-foreground px-2 py-0.5 rounded-md border border-white/10">{aiEstimate.colorComplexity}</span>}
                    {aiEstimate.confidenceLevel && <span className={`px-2 py-0.5 rounded-md border ${aiEstimate.confidenceLevel === "high" ? "bg-green-500/10 text-green-400 border-green-500/20" : aiEstimate.confidenceLevel === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>{aiEstimate.confidenceLevel === "high" ? "Alta confianza" : aiEstimate.confidenceLevel === "medium" ? "Confianza media" : "Confianza baja"}</span>}
                  </div>
                )}
                {aiEstimate.materialBreakdown && aiEstimate.materialBreakdown.length > 0 && (
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Desglose de Materiales</p>
                    {aiEstimate.materialBreakdown.map((m, i) => (
                      <div key={i} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-muted-foreground">{m.material}</span>
                        <span className="text-foreground font-medium">{formatCurrency(m.costPerUnit)} <span className="text-muted-foreground">{m.notes}</span></span>
                      </div>
                    ))}
                  </div>
                )}
                {aiEstimate.shippingBreakdown && aiEstimate.shippingBreakdown.length > 0 && (
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Tarifas por Transportista</p>
                    {aiEstimate.shippingBreakdown.map((s, i) => (
                      <div key={i} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-muted-foreground">{s.carrier} ({s.estimatedWeight})</span>
                        <span className="text-foreground font-medium">Nacional: {formatCurrency(s.domestic)} · Int: {formatCurrency(s.international)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiEstimate.reasoning && (
                  <details className="text-[11px]">
                    <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">Ver razonamiento completo</summary>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap bg-black/20 rounded-lg p-3 border border-white/5 max-h-32 overflow-y-auto">{aiEstimate.reasoning}</p>
                  </details>
                )}
              </div>
            )}
            {!aiEstimate && !aiEstimating && (
              <p className="text-[11px] text-muted-foreground">Shopy Crafter analiza el producto, materiales, logística, y estima todos los costes automáticamente. Proporciona 2 escenarios: equipo propio vs servicio externo.</p>
            )}
          </div>
          {COST_CATEGORIES.map(cat => {
            const catTotal = categoryTotals.find(c => c.id === cat.id)?.total ?? 0;
            const isExpanded = expandedCats.has(cat.id);
            const hasValues = cat.fields.some(f => parseFloat(cogs[f.key] || "0") > 0);

            return (
              <div key={cat.id} className={`border rounded-xl overflow-hidden transition-colors ${hasValues ? "border-primary/30 bg-primary/[0.02]" : "border-white/5"}`}>
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-sm font-medium text-foreground">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {catTotal > 0 && <span className="text-xs font-bold text-primary">{formatCurrency(catTotal)}</span>}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.fields.map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">{field.label}</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={cogs[field.key]}
                            onChange={(e) => setCogs({ ...cogs, [field.key]: e.target.value })}
                            className={inputClass}
                            placeholder={field.placeholder ?? "0.00"}
                          />
                          {field.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.suffix}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="border border-white/5 rounded-xl overflow-hidden">
            <button onClick={() => toggleCat("custom")} className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-base">➕</span>
                <span className="text-sm font-medium text-foreground">Costes Personalizados</span>
              </div>
              <div className="flex items-center gap-2">
                {customTotal > 0 && <span className="text-xs font-bold text-primary">{formatCurrency(customTotal)}</span>}
                {expandedCats.has("custom") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>
            {expandedCats.has("custom") && (
              <div className="px-3 pb-3 space-y-2">
                {customCosts.map((cc, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={cc.name}
                      onChange={e => { const arr = [...customCosts]; arr[i] = { ...arr[i], name: e.target.value }; setCustomCosts(arr); }}
                      className={`${inputClass} flex-1`}
                      placeholder="Nombre del coste..."
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={cc.cost}
                      onChange={e => { const arr = [...customCosts]; arr[i] = { ...arr[i], cost: e.target.value }; setCustomCosts(arr); }}
                      className={`${inputClass} w-28`}
                      placeholder="0.00"
                    />
                    <button onClick={() => setCustomCosts(customCosts.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 p-1"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button
                  onClick={() => setCustomCosts([...customCosts, { name: "", cost: "" }])}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  + Agregar coste personalizado
                </button>
              </div>
            )}
          </div>

          <div className="bg-black/30 rounded-xl p-4 border border-white/5">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-transparent border-none text-sm text-muted-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none"
              rows={2}
              placeholder="Notas sobre la estructura de costes (proveedores, APIs utilizadas, materiales...)"
            />
          </div>

          <div className="bg-black/40 rounded-xl p-4 border border-primary/20 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal COGS (sin IVA)</span>
              <span className="font-bold text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA ({(vatRate * 100).toFixed(0)}%)</span>
              <span className="text-muted-foreground">{formatCurrency(subtotal * vatRate)}</span>
            </div>
            <div className="flex justify-between text-base border-t border-white/10 pt-2">
              <span className="font-bold text-foreground">TOTAL con IVA</span>
              <span className="font-bold text-primary">{formatCurrency(totalWithVat)}</span>
            </div>
            {product.price && (
              <div className="flex justify-between text-sm pt-1 border-t border-white/5">
                <span className="text-muted-foreground">Precio venta actual</span>
                <span className="text-foreground">{formatCurrency(product.price)}</span>
              </div>
            )}
            {currentMargin !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margen actual</span>
                <span className="font-bold" style={{ color: currentMargin >= 40 ? "#00d68f" : currentMargin >= 20 ? "#ffd32a" : "#ff4757" }}>
                  {currentMargin}%
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Precio mínimo viable (+15%)</span>
              <span className="text-yellow-400">{formatCurrency(subtotal * 1.15)}</span>
            </div>
          </div>

          {categoryTotals.filter(c => c.total > 0).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Desglose por categoría</p>
              {categoryTotals.filter(c => c.total > 0).map(c => {
                const pct = subtotal > 0 ? (c.total / subtotal) * 100 : 0;
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-40 truncate">{c.label}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="bg-primary/60 h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-foreground w-16 text-right">{formatCurrency(c.total)}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
              {customTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-40 truncate">Personalizados</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="bg-primary/60 h-full rounded-full" style={{ width: `${Math.min((customTotal / subtotal) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs text-foreground w-16 text-right">{formatCurrency(customTotal)}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{subtotal > 0 ? ((customTotal / subtotal) * 100).toFixed(0) : 0}%</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Margen objetivo (%)</label>
              <input type="number" min="5" max="95" value={cogs.targetMarginPct} onChange={e => setCogs({ ...cogs, targetMarginPct: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saveCogs.isPending}
              className="flex-1 bg-white/5 border border-white/10 text-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              {saveCogs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar Costes
            </button>
            <button onClick={handleCalcOptimal} disabled={calcOptimal.isPending}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {calcOptimal.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
              Calcular Precio Óptimo
            </button>
          </div>

          {optimalData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Recomendación IA{optimalData.marketResearch?.competitorPrices?.length ? " (con datos de mercado reales)" : ""}
              </h4>

              <div className="flex flex-wrap gap-4">
                <div className="bg-green-500/10 rounded-lg p-3 flex-1 min-w-[120px]">
                  <p className="text-xs text-muted-foreground">Precio Óptimo</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(optimalData.optimalPrice ?? optimalData.suggestedPrice ?? 0)}</p>
                </div>
                {optimalData.psychologicalPrice && (
                  <div className="bg-blue-500/10 rounded-lg p-3 flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Precio Psicológico</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(optimalData.psychologicalPrice)}</p>
                  </div>
                )}
                {optimalData.compareAtPrice && (
                  <div className="bg-white/5 rounded-lg p-3 flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Compare At</p>
                    <p className="text-2xl font-bold text-muted-foreground line-through">{formatCurrency(optimalData.compareAtPrice)}</p>
                  </div>
                )}
                {(optimalData.marginWaterfall?.netMarginPct ?? optimalData.margin) != null && (
                  <div className="bg-primary/10 rounded-lg p-3 flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Margen Neto</p>
                    <p className="text-2xl font-bold text-primary">{optimalData.marginWaterfall?.netMarginPct ?? optimalData.margin}%</p>
                  </div>
                )}
              </div>

              {optimalData.recommendedStrategy && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-1">Estrategia Recomendada</p>
                  <p className="text-xs text-foreground">{optimalData.recommendedStrategy}</p>
                </div>
              )}

              {optimalData.marketResearch && optimalData.marketResearch.competitorPrices.length > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-400 mb-2">Precios de Competidores ({optimalData.marketResearch.competitorPrices.length} encontrados)</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {optimalData.marketResearch.competitorPrices.slice(0, 6).map((c, i) => (
                      <span key={i} className="text-xs bg-blue-500/10 px-2 py-1 rounded-lg">
                        {c.source}: <span className="font-semibold text-blue-300">€{c.price}</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Rango: €{optimalData.marketResearch.marketPriceRange.min} – €{optimalData.marketResearch.marketPriceRange.max}</span>
                    <span>Mediana: <span className="text-blue-300 font-semibold">€{optimalData.marketResearch.marketPriceRange.median}</span></span>
                  </div>
                </div>
              )}

              {optimalData.marketResearch && optimalData.marketResearch.avgSupplierCost > 0 && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-400 mb-1">Coste Medio Proveedores</p>
                  <p className="text-lg font-bold text-orange-300">€{optimalData.marketResearch.avgSupplierCost.toFixed(2)}</p>
                  {optimalData.marketResearch.supplierInsight && (
                    <p className="text-xs text-muted-foreground mt-1">{optimalData.marketResearch.supplierInsight}</p>
                  )}
                </div>
              )}

              {optimalData.priceImpactEstimate && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-400 mb-2">Impacto Estimado del Cambio</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Ventas: </span><span className="text-foreground">{optimalData.priceImpactEstimate.expectedSalesChange}</span></div>
                    <div><span className="text-muted-foreground">Revenue: </span><span className="text-foreground">{optimalData.priceImpactEstimate.expectedRevenueChange}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Confianza: </span><span className="text-purple-300">{optimalData.priceImpactEstimate.confidenceLevel}</span></div>
                  </div>
                </div>
              )}

              {optimalData.reasoning && <p className="text-xs text-muted-foreground">{optimalData.reasoning}</p>}

              <button
                onClick={() => {
                  const price = optimalData.optimalPrice ?? optimalData.suggestedPrice;
                  if (price && isFinite(price)) {
                    handleApply(price, optimalData.compareAtPrice ?? price * 1.3);
                  }
                }}
                disabled={applyPrice.isPending || !(optimalData.optimalPrice ?? optimalData.suggestedPrice)}
                className="w-full bg-green-500 text-black py-2.5 rounded-xl text-sm font-bold hover:bg-green-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {applyPrice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Aplicar Precio
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}


function PriceSimulator({ projectId, product, onClose }: { projectId: number; product: Product; onClose: () => void }) {
  const [newPrice, setNewPrice] = useState(product.price?.toString() ?? "");
  const [units, setUnits] = useState("30");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [estimatingCogs, setEstimatingCogs] = useState(false);
  const { toast } = useToast();

  const simulate = async () => {
    setLoading(true);
    try {
      const cogsRes = await fetch(`${API_BASE}/api/projects/${projectId}/products/${product.id}/cogs`, { credentials: "include" });
      if (cogsRes.ok) {
        const cogsData = await cogsRes.json();
        if (!cogsData?.totalCogs || cogsData.totalCogs === 0) {
          setEstimatingCogs(true);
          toast({ title: "Sin COGS guardados — estimando con IA..." });
          try {
            const estRes = await fetch(`${API_BASE}/api/projects/${projectId}/products/${product.id}/ai-estimate-cogs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            });
            if (estRes.ok) {
              const estimate = await estRes.json();
              const scenario = estimate.ownEquipment || {};
              scenario.finalPrice = product.price ?? 0;
              const saveRes = await fetch(`${API_BASE}/api/projects/${projectId}/products/${product.id}/cogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(scenario),
              });
              if (saveRes.ok) {
                toast({ title: "COGS estimados y guardados — simulando..." });
              }
            } else {
              toast({ title: "No se pudieron estimar los COGS, simulando con datos parciales", variant: "destructive" });
            }
          } catch {
            toast({ title: "Error estimando COGS con IA", variant: "destructive" });
          }
          setEstimatingCogs(false);
        }
      }

      const res = await fetch(`${API_BASE}/api/projects/${projectId}/products/${product.id}/price-simulator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPrice: parseFloat(newPrice), unitsPerMonth: parseInt(units) }),
      });
      if (!res.ok) throw new Error("Error en simulación");
      setResult(await res.json());
    } catch {
      toast({ title: "Error al simular precio", variant: "destructive" });
    } finally {
      setLoading(false);
      setEstimatingCogs(false);
    }
  };

  const inputClass = "bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-primary text-sm w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Simulador de Precio
          </h3>
          <button onClick={onClose} aria-label="Cerrar simulador" className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{product.title}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nuevo Precio (€)</label>
            <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Uds/Mes Estimadas</label>
            <input type="number" value={units} onChange={e => setUnits(e.target.value)} className={inputClass} />
          </div>
        </div>

        <button onClick={simulate} disabled={loading || !newPrice} className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mb-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          {estimatingCogs ? "Estimando costes con IA..." : loading ? "Simulando..." : "Simular Impacto"}
        </button>

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Precio Actual</span>
                <span className="text-foreground font-bold">{formatCurrency(result.currentPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Nuevo Precio</span>
                <span className="text-primary font-bold">{formatCurrency(result.newPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Cambio</span>
                <span className={result.priceChangePct > 0 ? "text-green-400" : "text-red-400"}>
                  {result.priceChangePct > 0 ? "+" : ""}{result.priceChangePct}%
                </span>
              </div>
              {result.breakEvenUnits && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Break-even</span>
                  <span className="text-yellow-400">{result.breakEvenUnits} uds</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {result.scenarios?.map((s: any) => (
                <div key={s.scenario} className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">{s.scenario}</span>
                    <span className={`text-xs font-bold ${s.monthlyProfit > 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(s.monthlyProfit)}/mes
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{s.estimatedUnits} uds</span>
                    <span>Rev: {formatCurrency(s.monthlyRevenue)}</span>
                    <span>Margen: {s.marginPct}%</span>
                  </div>
                </div>
              ))}
            </div>

            {result.scenarios && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.scenarios}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="scenario" tick={{ fill: "#999", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#999", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 12, color: "#fff" }} />
                    <Bar dataKey="monthlyRevenue" name="Revenue" fill="var(--gold, #d4a574)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="monthlyProfit" name="Beneficio" fill="var(--jade, #00d68f)" radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ color: "#999", fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function ForecastSection({ projectId }: { projectId: number }) {
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(12);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/financial-forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ months }),
      });
      setForecast(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const baseScenario = forecast?.forecast?.find((f: any) => f.scenario === "base");

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Forecast P&L Predictivo
        </h2>
        <div className="flex items-center gap-2">
          <select value={months} onChange={e => setMonths(parseInt(e.target.value))} className="bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-sm">
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
          <button onClick={loadForecast} disabled={loading} className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Generar
          </button>
        </div>
      </div>

      {forecast && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/30 rounded-xl p-3 border border-white/5">
              <p className="text-xs text-muted-foreground">Revenue Actual/Mes</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(forecast.currentMonthlyRevenue)}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-3 border border-white/5">
              <p className="text-xs text-muted-foreground">Pedidos/Mes</p>
              <p className="text-lg font-bold text-foreground">{forecast.currentMonthlyOrders}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-3 border border-white/5">
              <p className="text-xs text-muted-foreground">COGS Medio/Pedido</p>
              <p className="text-lg font-bold text-red-400">{formatCurrency(forecast.avgCogsPerOrder)}</p>
            </div>
            {forecast.breakEvenMonth && (
              <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/20">
                <p className="text-xs text-muted-foreground">Break-even</p>
                <p className="text-lg font-bold text-green-400">Mes {forecast.breakEvenMonth}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {forecast.forecast?.map((f: any) => (
              <div key={f.scenario} className="bg-black/20 rounded-xl p-3 border border-white/5">
                <p className="text-xs font-semibold text-muted-foreground mb-1 capitalize">{f.scenario}</p>
                <p className="text-sm font-bold text-foreground">{formatCurrency(f.totals.revenue)}</p>
                <p className={`text-xs ${f.totals.profit > 0 ? "text-green-400" : "text-red-400"}`}>
                  Beneficio: {formatCurrency(f.totals.profit)}
                </p>
                <p className="text-xs text-muted-foreground">Margen: {f.totals.avgMargin}%</p>
              </div>
            ))}
          </div>

          {baseScenario && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={baseScenario.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" tick={{ fill: "#999", fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
                  <YAxis tick={{ fill: "#999", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 12, color: "#fff" }} formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--gold, #d4a574)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Beneficio" stroke="var(--jade, #00d68f)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="costs" name="Costes" stroke="#ff4757" strokeWidth={2} dot={false} />
                  <Legend wrapperStyle={{ color: "#999", fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}
    </GlassCard>
  );
}

export default function PricingPage() {
  const [, params] = useRoute("/projects/:id/pricing");
  const projectId = parseInt(params?.id || "0");
  const { toast } = useToast();

  const { data: dashboard, isLoading: isLoadingDash } = useGetFinancialDashboard(projectId);
  const { data: productsData } = useGetProjectProducts(projectId, { limit: 500 });
  const analyzeCompetitors = useAnalyzeCompetitorPrices();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [simulatorProduct, setSimulatorProduct] = useState<Product | null>(null);
  const [bulkEstimating, setBulkEstimating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorResult, setCompetitorResult] = useState<{
    analysis?: string;
    positioningRecommendation?: string;
    recommendations?: Array<string | { priority?: string; action?: string; impact?: string; kpi?: string }>;
  } | null>(null);

  const handleCompetitorAnalysis = () => {
    if (!competitorUrl) return;
    analyzeCompetitors.mutate(
      { projectId, productId: selectedProduct?.id ?? "", data: { competitorUrls: [competitorUrl] } },
      {
        onSuccess: (d) => setCompetitorResult(d as typeof competitorResult),
        onError: () => toast({ title: "Error analizando competidores", variant: "destructive" }),
      }
    );
  };

  const handleBulkEstimate = async () => {
    const allProducts = productsData?.products || [];
    if (!allProducts.length) return;
    setBulkEstimating(true);
    setBulkProgress({ done: 0, total: allProducts.length });
    let successCount = 0;
    const failedProducts: string[] = [];
    for (const product of allProducts) {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/products/${product.id}/ai-estimate-cogs`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          successCount++;
        } else {
          failedProducts.push(product.title || `ID ${product.id}`);
        }
      } catch {
        failedProducts.push(product.title || `ID ${product.id}`);
      }
      setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    setBulkEstimating(false);
    toast({
      title: "Estimación masiva completada",
      description: failedProducts.length > 0
        ? `${successCount} OK, ${failedProducts.length} fallidos: ${failedProducts.slice(0, 3).join(", ")}${failedProducts.length > 3 ? "…" : ""}`
        : `${successCount} de ${allProducts.length} productos estimados correctamente.`,
    });
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
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Economista IA</h1>
          <p className="text-muted-foreground mt-1">P&L, márgenes, COGS y optimización de precios con IA.</p>
        </div>
        <SaveReportButton
          projectId={projectId}
          title="Informe Financiero"
          fileType="financial"
          category="financial"
          compact
          buildContent={() => {
            return `
<h2>Dashboard Financiero</h2>
<div class="metric-grid">
  <div class="metric-card"><div class="label">Revenue Bruto (30d)</div><div class="value">${formatCurrency(dash.grossRevenue)}</div></div>
  <div class="metric-card"><div class="label">Gross Profit</div><div class="value status-ok">${formatCurrency(dash.grossProfit)}</div></div>
  <div class="metric-card"><div class="label">Margen Neto</div><div class="value">${dash.netMarginPct}%</div></div>
  <div class="metric-card"><div class="label">AOV</div><div class="value">${formatCurrency(dash.aov)}</div></div>
</div>
${dash.alerts?.length ? `<h2>Alertas Financieras</h2><ul>${dash.alerts.map((a: any) => `<li><strong>${a.severity || "info"}:</strong> ${a.message || a}</li>`).join("")}</ul>` : ""}
<h2>Productos y Márgenes</h2>
<table><tr><th>Producto</th><th>Precio</th></tr>
${products.slice(0, 50).map((p: any) => `<tr><td>${p.title}</td><td>${p.price ? formatCurrency(Number(p.price)) : "—"}</td></tr>`).join("")}
</table>`;
          }}
        />
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
          <button
            onClick={handleBulkEstimate}
            disabled={bulkEstimating}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shrink-0"
            style={{
              background: bulkEstimating ? "rgba(200,168,75,.08)" : "rgba(200,168,75,.12)",
              border: "1px solid rgba(200,168,75,.3)",
              color: "#c8a84b",
            }}
          >
            {bulkEstimating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Estimando {bulkProgress.done}/{bulkProgress.total}...</>
            ) : (
              <><Brain className="w-4 h-4" /> Auto-estimar todos</>
            )}
          </button>
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
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => setSimulatorProduct(p as Product)}
                        className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                      >
                        <Calculator className="w-3 h-3" />
                        Simular
                      </button>
                      <button
                        onClick={() => setSelectedProduct(p as Product)}
                        className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
                        <Scale className="w-3 h-3" />
                        Optimizar
                      </button>
                    </div>
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
            {competitorResult.positioningRecommendation && (
              <p className="text-sm text-foreground mb-3">
                <strong className="text-amber-400">Posicionamiento: </strong>
                {competitorResult.positioningRecommendation}
              </p>
            )}
            {competitorResult.recommendations?.map((rec, i) => {
              const isObj = rec && typeof rec === "object";
              const priority = isObj ? (rec as any).priority : undefined;
              const action = isObj ? (rec as any).action : undefined;
              const impact = isObj ? (rec as any).impact : undefined;
              const kpi = isObj ? (rec as any).kpi : undefined;
              const text = typeof rec === "string"
                ? rec
                : (action || JSON.stringify(rec));
              return (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {priority && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 mr-2 rounded bg-amber-500/20 text-amber-300 uppercase font-bold">
                        {String(priority)}
                      </span>
                    )}
                    <span>{text}</span>
                    {impact && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <strong>Impacto:</strong> {String(impact)}
                      </div>
                    )}
                    {kpi && (
                      <div className="text-xs text-muted-foreground">
                        <strong>KPI:</strong> {String(kpi)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* P&L Forecast */}
      <ForecastSection projectId={projectId} />

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

      {/* Price Simulator Modal */}
      <AnimatePresence>
        {simulatorProduct && (
          <PriceSimulator
            projectId={projectId}
            product={simulatorProduct}
            onClose={() => setSimulatorProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
