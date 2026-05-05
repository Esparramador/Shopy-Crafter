// ============================================================
// PriceTestWizard - Wizard para crear Test de Precio
// ============================================================
// Análisis multi-fuente:
// 1. Selección producto
// 2. Análisis competencia + proveedores (en paralelo)
// 3. Selección variante de precio (3 niveles)
// 4. Configuración + lanzar
// ============================================================

import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, DollarSign, Check, Sparkles,
  Globe, Factory, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { ActionButton } from './ActionButton';
import { abTestingAPI } from '../lib/api';
import type {
  ShopifyProduct, CompetitorAnalysis, SupplierImpactAnalysis, PriceTestConfig,
} from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (testId: string) => void;
  preselectedProduct?: ShopifyProduct;
}

interface PriceRecommendation {
  conservative: number;
  optimal: number;
  aggressive: number;
  justification: string;
  risks: string[];
}

export function PriceTestWizard({ open, onClose, onCreated, preselectedProduct }: Props) {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(preselectedProduct || null);
  const [competitorAnalysis, setCompetitorAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [supplierAnalysis, setSupplierAnalysis] = useState<SupplierImpactAnalysis | null>(null);
  const [recommendation, setRecommendation] = useState<PriceRecommendation | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>('');
  const [selectedPriceTier, setSelectedPriceTier] = useState<'conservative' | 'optimal' | 'aggressive'>('optimal');
  const [hypothesis, setHypothesis] = useState('');
  const [config, setConfig] = useState({
    splitTraffic: 50,
    durationDays: 21,
    minVisitors: 1500,
  });

  useEffect(() => {
    if (open && products.length === 0) {
      abTestingAPI.getProducts().then(setProducts).catch(() => {});
    }
  }, [open, products.length]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCompetitorAnalysis(null);
      setSupplierAnalysis(null);
      setRecommendation(null);
      setHypothesis('');
    }
  }, [open]);

  if (!open) return null;

  // Lanza los 3 análisis en paralelo al entrar al step 2
  const runAnalysis = async () => {
    if (!selectedProduct) return;
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const [comp, sup, rec] = await Promise.all([
        abTestingAPI.analyzeCompetitors(selectedProduct.id),
        abTestingAPI.analyzeSupplierImpact(selectedProduct.id).catch(() => null),
        abTestingAPI.recommendPrice(selectedProduct.id),
      ]);
      setCompetitorAnalysis(comp);
      setSupplierAnalysis(sup);
      setRecommendation(rec);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Error en análisis');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const challengerPrice = recommendation
    ? recommendation[selectedPriceTier]
    : selectedProduct?.currentPrice || 0;

  const canGoNext = (() => {
    if (step === 1) return !!selectedProduct;
    if (step === 2) return !!recommendation && !!selectedPriceTier;
    if (step === 3) return hypothesis.trim().length > 10;
    return true;
  })();

  const handleCreateTest = async () => {
    if (!selectedProduct || !competitorAnalysis || !recommendation) return;

    const testConfig: PriceTestConfig = {
      type: 'price',
      productId: selectedProduct.id,
      hypothesis,
      primaryMetric: 'revenue_per_visitor',
      secondaryMetrics: ['conversion_rate', 'aov'],
      splitTraffic: config.splitTraffic,
      durationDays: config.durationDays,
      minVisitors: config.minVisitors,
      minConfidence: 95,
      winnerStrategy: 'auto_winner',
      autoApplyWinner: false, // Precio: siempre revisión manual por seguridad
      controlPrice: selectedProduct.currentPrice,
      challengerPrice,
      competitorContext: competitorAnalysis,
      supplierContext: supplierAnalysis || undefined,
    };

    const test = await abTestingAPI.createPriceTest(testConfig);
    onCreated(test.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl my-8 shadow-2xl">

        {/* HEADER */}
        <div className="border-b border-slate-700 p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-teal-400 uppercase tracking-wider font-semibold">
                Test de Precio · Análisis multi-fuente
              </span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {['Producto', 'Análisis', 'Configuración', 'Lanzar'].map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === step;
              const done = stepNum < step;
              return (
                <div key={label} className="flex items-center flex-1">
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold flex-1
                    ${active ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' :
                      done ? 'bg-slate-800 text-slate-300' :
                      'bg-slate-800/50 text-slate-500'}
                  `}>
                    {done ? <Check className="w-3 h-3" /> : <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">{stepNum}</span>}
                    {label}
                  </div>
                  {i < 3 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">Producto a testear</h3>
              <p className="text-xs text-slate-400 mb-4">
                El precio se contrastará con competidores reales y proveedores alternativos
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition text-left
                      ${selectedProduct?.id === p.id
                        ? 'bg-teal-500/10 border-teal-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-600'}
                    `}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-12 h-12 rounded object-cover bg-slate-800 flex-shrink-0" />
                    ) : <div className="w-12 h-12 rounded bg-slate-800 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-100 font-medium truncate">{p.title}</p>
                      <div className="flex justify-between items-baseline mt-1">
                        <p className="text-[10px] text-slate-500">€{p.currentPrice.toFixed(2)}</p>
                        {p.marginPct !== undefined && (
                          <p className={`text-[10px] ${p.marginPct >= 30 ? 'text-teal-400' : p.marginPct >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                            {p.marginPct.toFixed(0)}% margen
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Análisis completo */}
          {step === 2 && selectedProduct && (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 mb-1">Análisis de mercado</h3>
                  <p className="text-xs text-slate-400">
                    Competencia · Proveedores alternativos · Recomendación IA
                  </p>
                </div>
                {!recommendation && !analysisLoading && (
                  <ActionButton
                    variant="ai"
                    size="md"
                    icon={<Sparkles className="w-4 h-4" />}
                    loadingText="Analizando 3 fuentes..."
                    successText="Análisis completo"
                    estimatedCost={0.45}
                    onAction={runAnalysis}
                  >
                    Iniciar análisis
                  </ActionButton>
                )}
              </div>

              {analysisLoading && (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-300 font-medium">Ejecutando análisis multi-fuente...</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Scraping competencia · Buscando proveedores · Pidiendo recomendación a Claude
                  </p>
                </div>
              )}

              {analysisError && !analysisLoading && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-300 mb-2">Error en análisis: {analysisError}</p>
                  <ActionButton variant="secondary" size="sm" onAction={runAnalysis}>Reintentar</ActionButton>
                </div>
              )}

              {recommendation && competitorAnalysis && (
                <div className="space-y-4">
                  {/* Competencia + Proveedores side-by-side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <CompetitorPanel data={competitorAnalysis} currentPrice={selectedProduct.currentPrice} />
                    {supplierAnalysis && <SupplierPanel data={supplierAnalysis} />}
                    {!supplierAnalysis && (
                      <div className="bg-slate-950 border border-dashed border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                        <Factory className="w-6 h-6 text-slate-600 mb-2" />
                        <p className="text-xs text-slate-400">Sin proveedores alternativos detectados</p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          Configura el módulo Supplier Intelligence para análisis completo
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 3 niveles de precio */}
                  <div className="grid grid-cols-3 gap-3">
                    <PriceTierCard
                      tier="conservative"
                      label="Conservador"
                      sublabel="Menor riesgo"
                      price={recommendation.conservative}
                      currentPrice={selectedProduct.currentPrice}
                      cogs={selectedProduct.cogsTotal}
                      selected={selectedPriceTier === 'conservative'}
                      onClick={() => setSelectedPriceTier('conservative')}
                    />
                    <PriceTierCard
                      tier="optimal"
                      label="Óptimo"
                      sublabel="Recomendado"
                      price={recommendation.optimal}
                      currentPrice={selectedProduct.currentPrice}
                      cogs={selectedProduct.cogsTotal}
                      selected={selectedPriceTier === 'optimal'}
                      onClick={() => setSelectedPriceTier('optimal')}
                      highlight
                    />
                    <PriceTierCard
                      tier="aggressive"
                      label="Agresivo"
                      sublabel="Mayor margen"
                      price={recommendation.aggressive}
                      currentPrice={selectedProduct.currentPrice}
                      cogs={selectedProduct.cogsTotal}
                      selected={selectedPriceTier === 'aggressive'}
                      onClick={() => setSelectedPriceTier('aggressive')}
                    />
                  </div>

                  {/* Justificación */}
                  <div className="bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      <span className="text-xs text-violet-400 font-semibold uppercase tracking-wider">Análisis Claude</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed mb-3">{recommendation.justification}</p>
                    {recommendation.risks.length > 0 && (
                      <div className="border-t border-violet-500/20 pt-3 mt-3">
                        <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-1">Riesgos a considerar</p>
                        <ul className="space-y-1">
                          {recommendation.risks.map((r, i) => (
                            <li key={i} className="text-xs text-amber-200 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Config */}
          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">Configuración del test</h3>
              <p className="text-xs text-slate-400 mb-5">
                Tests de precio recomiendan más duración (mín. 21 días) para captar variabilidad
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1.5 block">
                    Hipótesis del test <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                    placeholder="Ej: Subir el precio de €10.99 a €16.99 mantendrá la conversión similar pero aumentará el revenue por visitante un 35%, ya que estamos 42% por debajo de la mediana del mercado..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <NumField label="Split traffic (% Challenger)" value={config.splitTraffic} onChange={(v) => setConfig({ ...config, splitTraffic: v })} suffix="%" />
                  <NumField label="Duración" value={config.durationDays} onChange={(v) => setConfig({ ...config, durationDays: v })} suffix=" días" min={14} />
                  <NumField label="Visitas mínimas" value={config.minVisitors} onChange={(v) => setConfig({ ...config, minVisitors: v })} suffix="" />
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">
                    Tests de precio NO se aplican automáticamente — siempre requieren revisión manual
                    para evitar cambios de pricing no autorizados.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Resumen */}
          {step === 4 && selectedProduct && recommendation && (
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">Confirmar y lanzar</h3>
              <p className="text-xs text-slate-400 mb-5">Revisa antes de iniciar</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Control (A)</p>
                  <p className="text-3xl font-semibold text-slate-100">€{selectedProduct.currentPrice.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-2">Precio actual en Shopify</p>
                </div>
                <div className="bg-teal-500/5 border border-teal-500/30 rounded-lg p-4">
                  <p className="text-[10px] text-teal-400 uppercase tracking-wider mb-2 font-semibold">Challenger (B)</p>
                  <p className="text-3xl font-semibold text-teal-400">€{challengerPrice.toFixed(2)}</p>
                  <p className="text-xs text-teal-300 mt-2">
                    {challengerPrice > selectedProduct.currentPrice ? '+' : ''}
                    {((challengerPrice - selectedProduct.currentPrice) / selectedProduct.currentPrice * 100).toFixed(1)}% vs actual
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
                <SumRow label="Producto" value={selectedProduct.title} />
                <SumRow label="Hipótesis" value={hypothesis} />
                <SumRow label="Split traffic" value={`${100 - config.splitTraffic}% / ${config.splitTraffic}%`} />
                <SumRow label="Duración" value={`${config.durationDays} días`} />
                <SumRow label="Visitas mínimas" value={config.minVisitors.toLocaleString()} />
                {competitorAnalysis && (
                  <SumRow label="Competidores analizados" value={`${competitorAnalysis.totalSourcesScraped} fuentes`} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-700 p-4 flex justify-between items-center">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancelar' : 'Anterior'}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext}
              className="px-4 py-2 text-sm bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium rounded-md transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <ActionButton
              variant="primary"
              size="md"
              icon={<Check className="w-4 h-4" />}
              loadingText="Lanzando test..."
              successText="Test lanzado"
              confirmMessage="Iniciará split traffic real entre los dos precios. ¿Continuar?"
              onAction={handleCreateTest}
            >
              Lanzar test
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTES
// ============================================================

function CompetitorPanel({ data, currentPrice }: { data: CompetitorAnalysis; currentPrice: number }) {
  const positionLabel = {
    underpriced: { text: 'Subvalorado', color: 'text-red-400', bg: 'bg-red-500/10' },
    fair: { text: 'En rango', color: 'text-teal-400', bg: 'bg-teal-500/10' },
    premium: { text: 'Premium', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    overpriced: { text: 'Sobrevalorado', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  }[data.priceStats.yourPosition];

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">
          Competencia · {data.totalSourcesScraped} fuentes
        </span>
      </div>

      <div className="space-y-2 mb-3">
        {data.competitors.slice(0, 4).map((c, i) => (
          <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 truncate">{c.storeName}</p>
              <p className="text-[10px] text-slate-500 truncate">{c.productTitle}</p>
            </div>
            <span className="text-slate-100 font-semibold tabular-nums ml-2">€{c.price.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-md p-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Mín" value={`€${data.priceStats.min.toFixed(2)}`} />
        <Stat label="Mediana" value={`€${data.priceStats.median.toFixed(2)}`} highlight />
        <Stat label="Máx" value={`€${data.priceStats.max.toFixed(2)}`} />
      </div>

      <div className={`mt-3 ${positionLabel.bg} rounded-md p-2 flex items-center justify-between`}>
        <span className="text-[10px] text-slate-400">Tu precio €{currentPrice.toFixed(2)}:</span>
        <span className={`text-xs font-semibold ${positionLabel.color}`}>
          {positionLabel.text} · P{data.priceStats.percentileRank}
        </span>
      </div>
    </div>
  );
}

function SupplierPanel({ data }: { data: SupplierImpactAnalysis }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Factory className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-xs text-teal-400 font-semibold uppercase tracking-wider">
          Impacto de proveedores
        </span>
      </div>
      <div className="space-y-2 mb-3">
        {data.options.slice(0, 4).map((o) => (
          <div key={o.supplierId} className={`flex justify-between items-center text-xs py-1.5 border-b border-slate-800 last:border-0 ${o.isCurrent ? 'opacity-60' : ''}`}>
            <div className="min-w-0 flex-1 flex items-center gap-1">
              {o.isRecommended && <span className="text-teal-400">★</span>}
              <span className={`truncate ${o.isRecommended ? 'text-teal-300' : 'text-slate-200'}`}>
                {o.isCurrent ? '(actual) ' : ''}{o.supplierName}
              </span>
            </div>
            <span className={`tabular-nums ml-2 ${o.isRecommended ? 'text-teal-400 font-semibold' : 'text-slate-300'}`}>
              €{o.costPerUnit.toFixed(2)}/ud
            </span>
          </div>
        ))}
      </div>
      <div className="bg-teal-500/10 rounded-md p-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">Ahorro potencial:</span>
        <span className="text-xs text-teal-400 font-semibold">
          −€{data.potentialSavingsPerUnit.toFixed(2)}/ud · €{data.potentialSavingsAnnual.toFixed(0)}/año
        </span>
      </div>
    </div>
  );
}

function PriceTierCard({
  label, sublabel, price, currentPrice, cogs, selected, onClick, highlight,
}: {
  tier: string; label: string; sublabel: string; price: number; currentPrice: number;
  cogs?: number; selected: boolean; onClick: () => void; highlight?: boolean;
}) {
  const delta = ((price - currentPrice) / currentPrice) * 100;
  const margin = cogs ? ((price - cogs) / price) * 100 : 0;
  const isUp = price > currentPrice;

  return (
    <button
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border-2 text-left transition-all
        ${selected
          ? 'border-teal-500 bg-teal-500/10'
          : 'border-slate-700 bg-slate-950 hover:border-slate-600'}
      `}
    >
      {highlight && (
        <span className="absolute -top-2 right-3 bg-teal-500 text-slate-950 text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
          Recomendado
        </span>
      )}
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className="text-[10px] text-slate-400 mb-2">{sublabel}</p>
      <p className={`text-2xl font-semibold ${selected ? 'text-teal-400' : 'text-slate-100'}`}>
        €{price.toFixed(2)}
      </p>
      <div className="mt-2 flex items-center gap-1 text-[10px]">
        {isUp ? <ArrowUpRight className="w-2.5 h-2.5 text-teal-400" /> : <ArrowDownRight className="w-2.5 h-2.5 text-amber-400" />}
        <span className={isUp ? 'text-teal-400' : 'text-amber-400'}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
        </span>
        {cogs && <span className="text-slate-500 ml-2">· Margen {margin.toFixed(0)}%</span>}
      </div>
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${highlight ? 'text-teal-400' : 'text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-slate-200 text-right truncate" title={value}>{value}</span>
    </div>
  );
}

function NumField({
  label, value, onChange, suffix, min,
}: { label: string; value: number; onChange: (v: number) => void; suffix: string; min?: number }) {
  return (
    <div>
      <label className="text-xs text-slate-300 font-medium mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}
