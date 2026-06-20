// ============================================================
// OptimizationModal - Optimización de precio con Claude IA
// ============================================================

import { useState, useEffect } from 'react';
import { X, Sparkles, Check, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { pricingAPI } from '../lib/api';
import type { ShopifyProduct, OptimizationResult } from '../lib/types';

interface Props {
  product: ShopifyProduct;
  open: boolean;
  onClose: () => void;
  onPriceApplied: (newPrice: number) => void;
}

export function OptimizationModal({ product, open, onClose, onPriceApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  useEffect(() => {
    if (open && !result && !loading) {
      runOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runOptimization = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await pricingAPI.optimizePrice(product.id);
      setResult(data);
      setSelectedPrice(data.precioOptimo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al optimizar');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const handleApply = async () => {
    if (!selectedPrice) return;
    await pricingAPI.applyPrice(product.id, selectedPrice);
    onPriceApplied(selectedPrice);
    onClose();
  };

  const handleCreateABTest = async () => {
    if (!result) return;
    await pricingAPI.createABTest(
      product.id,
      result.abTestSugerido.variantA,
      result.abTestSugerido.variantB,
      result.abTestSugerido.duracionDias
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl my-8 shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-700 p-5 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-violet-400 uppercase tracking-wider font-semibold">
                AI Pricing Optimizer · Claude Opus 4.7
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100">{product.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Precio actual: €{product.currentPrice.toFixed(2)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Loading */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-4" />
              <p className="text-slate-300 text-sm font-medium">Analizando con IA...</p>
              <p className="text-slate-500 text-xs mt-1">
                Evaluando COGS, márgenes, competencia y elasticidad
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300 mb-1">Error en optimización</p>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
                <button
                  onClick={runOptimization}
                  className="text-xs text-red-300 hover:text-red-200 underline"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Resultado */}
          {result && !loading && (
            <>
              {/* Comparativa de precios */}
              <div className="mb-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
                  Recomendaciones de precio
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <PriceCard
                    label="Conservador"
                    sublabel="Menor riesgo"
                    price={result.precioConservador}
                    selected={selectedPrice === result.precioConservador}
                    onClick={() => setSelectedPrice(result.precioConservador)}
                    color="cyan"
                  />
                  <PriceCard
                    label="Óptimo"
                    sublabel="Recomendado"
                    price={result.precioOptimo}
                    selected={selectedPrice === result.precioOptimo}
                    onClick={() => setSelectedPrice(result.precioOptimo)}
                    color="teal"
                    highlight
                  />
                  <PriceCard
                    label="Agresivo"
                    sublabel="Mayor margen"
                    price={result.precioAgresivo}
                    selected={selectedPrice === result.precioAgresivo}
                    onClick={() => setSelectedPrice(result.precioAgresivo)}
                    color="amber"
                  />
                </div>

                {/* Comparativa visual con precio actual */}
                <div className="mt-4 bg-slate-950 rounded-lg p-4 flex items-center gap-4">
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Actual</p>
                    <p className="text-xl font-semibold text-slate-300">€{product.currentPrice.toFixed(2)}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600" />
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Seleccionado</p>
                    <p className="text-xl font-semibold text-teal-400">
                      €{(selectedPrice || result.precioOptimo).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-teal-300 mt-0.5">
                      {(((selectedPrice || result.precioOptimo) - product.currentPrice) / product.currentPrice * 100).toFixed(1)}%
                      · Margen objetivo: {result.margenObjetivo.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Justificación */}
              <div className="mb-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
                  Análisis de Claude
                </p>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 border border-slate-800 rounded-lg p-4">
                  {result.justificacion}
                </p>
              </div>

              {/* Riesgos */}
              {result.riesgos.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
                    Riesgos a considerar
                  </p>
                  <ul className="space-y-1">
                    {result.riesgos.map((r, i) => (
                      <li key={i} className="text-xs text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Upsell oportunidades */}
              {result.upsellOportunidades.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
                    Oportunidades adicionales
                  </p>
                  <ul className="space-y-1">
                    {result.upsellOportunidades.map((u, i) => (
                      <li key={i} className="text-xs text-cyan-300 flex items-start gap-2">
                        <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {result && !loading && (
          <div className="border-t border-slate-700 p-5 flex justify-between gap-2">
            <ActionButton
              variant="ai"
              size="md"
              loadingText="Creando test..."
              successText="Test creado"
              onAction={handleCreateABTest}
              confirmMessage={`Crear A/B test entre €${result.abTestSugerido.variantA} y €${result.abTestSugerido.variantB} durante ${result.abTestSugerido.duracionDias} días?`}
            >
              Crear A/B test
            </ActionButton>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition"
              >
                Cancelar
              </button>
              <ActionButton
                variant="primary"
                icon={<Check className="w-4 h-4" />}
                loadingText="Aplicando..."
                successText="Aplicado"
                confirmMessage={`Aplicar precio €${selectedPrice?.toFixed(2)} a Shopify?`}
                onAction={handleApply}
                disabled={!selectedPrice}
              >
                Aplicar precio seleccionado
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PriceCard
// ============================================================

function PriceCard({
  label, sublabel, price, selected, onClick, color, highlight,
}: {
  label: string; sublabel: string; price: number; selected: boolean;
  onClick: () => void; color: 'cyan' | 'teal' | 'amber'; highlight?: boolean;
}) {
  const colorMap = {
    cyan: { border: 'border-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    teal: { border: 'border-teal-500', text: 'text-teal-400', bg: 'bg-teal-500/10' },
    amber: { border: 'border-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border-2 transition-all text-left
        ${selected ? `${c.border} ${c.bg}` : 'border-slate-700 bg-slate-950 hover:border-slate-600'}
      `}
    >
      {highlight && (
        <span className="absolute -top-2 right-3 bg-teal-500 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
          Recomendado
        </span>
      )}
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className="text-[10px] text-slate-400 mb-2">{sublabel}</p>
      <p className={`text-2xl font-semibold ${selected ? c.text : 'text-slate-100'}`}>€{price.toFixed(2)}</p>
    </button>
  );
}
