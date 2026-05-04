// ============================================================
// PRICING.TSX - Página principal del módulo de Pricing
// ============================================================
//
// Esta es la página completa que reemplaza tu /pricing actual.
// Incluye:
//   - KPIs superiores (margen global, alertas, etc.)
//   - Tabla de productos con scores y grados
//   - 4 botones funcionales por producto: Optimizar, Simular, Estructura, Auto
//   - Botón "Auto-estimar todos" con barra de progreso real
//   - Integración con los 3 modales/drawers
//
// IMPORTANTE: Para que funcione, tu backend debe exponer los endpoints
// definidos en /lib/api.ts. Ver /README.md.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Settings, AlertTriangle, TrendingUp, Loader2, X } from 'lucide-react';
import { ActionButton } from './components/ActionButton';
import { COGSStructureModal } from './components/COGSStructureModal';
import { SimulatorDrawer } from './components/SimulatorDrawer';
import { OptimizationModal } from './components/OptimizationModal';
import { useBatchProgress } from './hooks/useAIAction';
import { pricingAPI } from './lib/api';
import type { ShopifyProduct, PricingKPIs } from './lib/types';

export default function Pricing() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [kpis, setKPIs] = useState<PricingKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Modal states
  const [structureProduct, setStructureProduct] = useState<ShopifyProduct | null>(null);
  const [simulatorProduct, setSimulatorProduct] = useState<ShopifyProduct | null>(null);
  const [optimizationProduct, setOptimizationProduct] = useState<ShopifyProduct | null>(null);

  // Batch progress hook
  const { progress, startBatch, cancelBatch, isRunning } = useBatchProgress({
    onComplete: () => loadData(),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [prods, k] = await Promise.all([
        pricingAPI.getProducts(),
        pricingAPI.getKPIs(),
      ]);
      setProducts(prods);
      setKPIs(k);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleAutoEstimateAll = async () => {
    await startBatch();
  };

  const handleProductUpdated = (productId: string, updates: Partial<ShopifyProduct>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
    // Reload KPIs en background
    pricingAPI.getKPIs().then(setKPIs).catch(() => {});
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando módulo de pricing...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-medium mb-1">Error al cargar pricing</p>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md text-sm transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* ============== HEADER ============== */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
          <span className="text-xs text-teal-400 uppercase tracking-widest font-semibold">
            Pricing Engine · v2.0
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
              Calculadora COGS y optimización de precios
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Análisis automático de costes con IA real · {products.length} productos en tienda
            </p>
          </div>
          <div className="flex gap-2">
            <ActionButton
              variant="ai"
              size="md"
              loadingText="Iniciando..."
              successText="Iniciado"
              confirmMessage={`Vas a estimar el COGS de ${products.length} productos con IA. Coste estimado: €${(products.length * 0.05).toFixed(2)}. ¿Continuar?`}
              estimatedCost={products.length * 0.05}
              onAction={handleAutoEstimateAll}
              disabled={isRunning}
            >
              Auto-estimar todos
            </ActionButton>
            <button className="px-4 py-2 text-sm text-slate-300 border border-slate-700 hover:bg-slate-800 rounded-md transition flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Config
            </button>
          </div>
        </div>
      </header>

      {/* ============== BARRA DE PROGRESO BATCH ============== */}
      {isRunning && (
        <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              <span className="text-sm text-violet-300 font-medium">{progress.message}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-violet-400 tabular-nums">
                {progress.current} / {progress.total}
                {progress.errors > 0 && (
                  <span className="text-amber-400 ml-2">· {progress.errors} errores</span>
                )}
              </span>
              <button
                onClick={cancelBatch}
                className="text-xs text-violet-300 hover:text-violet-100 underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </div>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-violet-400 h-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ============== ALERTAS DE MARGEN ============== */}
      {kpis && (kpis.productsLowMargin > 0 || kpis.productsCriticalMargin > 0) && (
        <div className="space-y-2 mb-6">
          {kpis.avgMarginPct < 20 && (
            <Alert
              level="warning"
              text={`Margen bruto global por debajo del 20% — revisar estructura de costes`}
            />
          )}
          {kpis.productsCriticalMargin > 0 && (
            <Alert
              level="critical"
              text={`${kpis.productsCriticalMargin} productos con margen < 15% — riesgo de pérdida con devoluciones`}
            />
          )}
        </div>
      )}

      {/* ============== KPIs ============== */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard
            label="Productos analizados"
            value={`${kpis.productsWithCOGS}/${kpis.totalProducts}`}
            color="teal"
          />
          <KPICard
            label="Margen promedio"
            value={`${kpis.avgMarginPct.toFixed(1)}%`}
            color="cyan"
            warning={kpis.avgMarginPct < 20}
          />
          <KPICard
            label="Margen crítico"
            value={`${kpis.productsCriticalMargin}`}
            sublabel="productos < 15%"
            color="red"
            warning={kpis.productsCriticalMargin > 0}
          />
          <KPICard
            label="Ahorro potencial"
            value={`€${kpis.potentialSavings.toFixed(0)}`}
            sublabel="optimizando"
            color="violet"
          />
        </div>
      )}

      {/* ============== TABLA DE PRODUCTOS ============== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Calculadora COGS por Producto</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click en "Optimizar" para calcular el precio óptimo con IA
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Producto</th>
                <th className="text-right px-3 py-3 font-semibold">Precio actual</th>
                <th className="text-right px-3 py-3 font-semibold">COGS</th>
                <th className="text-right px-3 py-3 font-semibold">Margen</th>
                <th className="text-center px-3 py-3 font-semibold">Score Img</th>
                <th className="text-center px-3 py-3 font-semibold">Grado</th>
                <th className="text-right px-5 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  onSimulate={() => setSimulatorProduct(p)}
                  onOptimize={() => setOptimizationProduct(p)}
                  onEditStructure={() => setStructureProduct(p)}
                  onProductUpdated={handleProductUpdated}
                />
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No hay productos en la tienda. Sincroniza con Shopify primero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============== MODALES ============== */}
      {structureProduct && (
        <COGSStructureModal
          product={structureProduct}
          open
          onClose={() => setStructureProduct(null)}
          onSaved={(cogs) => {
            handleProductUpdated(structureProduct.id, { cogsData: cogs });
            setStructureProduct(null);
          }}
        />
      )}

      {simulatorProduct && (
        <SimulatorDrawer
          product={simulatorProduct}
          open
          onClose={() => setSimulatorProduct(null)}
          onPriceApplied={(newPrice) => {
            handleProductUpdated(simulatorProduct.id, { currentPrice: newPrice });
            setSimulatorProduct(null);
          }}
        />
      )}

      {optimizationProduct && (
        <OptimizationModal
          product={optimizationProduct}
          open
          onClose={() => setOptimizationProduct(null)}
          onPriceApplied={(newPrice) => {
            handleProductUpdated(optimizationProduct.id, {
              currentPrice: newPrice,
              hasOptimizedPrice: true,
            });
            setOptimizationProduct(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTES
// ============================================================

function ProductRow({
  product, onSimulate, onOptimize, onEditStructure, onProductUpdated,
}: {
  product: ShopifyProduct;
  onSimulate: () => void;
  onOptimize: () => void;
  onEditStructure: () => void;
  onProductUpdated: (id: string, updates: Partial<ShopifyProduct>) => void;
}) {
  const cogs = product.cogsData?.cogsTotal || 0;
  const margenPct = product.currentPrice > 0 && cogs > 0
    ? ((product.currentPrice - cogs) / product.currentPrice) * 100
    : 0;
  const hasCOGS = cogs > 0;

  const handleAutoEstimate = async () => {
    const data = await pricingAPI.estimateCOGS(product.id);
    onProductUpdated(product.id, { cogsData: data });
  };

  return (
    <tr className="border-t border-slate-800 hover:bg-slate-900/50 transition">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-9 h-9 rounded object-cover bg-slate-800"
            />
          ) : (
            <div className="w-9 h-9 rounded bg-slate-800" />
          )}
          <div className="min-w-0">
            <p className="text-sm text-slate-100 font-medium truncate max-w-xs" title={product.title}>
              {product.title}
            </p>
            {product.category && (
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                {product.category.replace('_', ' ')}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="text-right px-3 py-3 tabular-nums text-slate-200">
        €{product.currentPrice.toFixed(2)}
      </td>
      <td className="text-right px-3 py-3 tabular-nums">
        {hasCOGS ? (
          <span className="text-slate-200">€{cogs.toFixed(2)}</span>
        ) : (
          <span className="text-slate-600 text-xs italic">Sin estimar</span>
        )}
      </td>
      <td className="text-right px-3 py-3 tabular-nums">
        {hasCOGS ? (
          <span
            className={
              margenPct >= 30 ? 'text-teal-400' :
              margenPct >= 15 ? 'text-amber-400' :
              'text-red-400'
            }
          >
            {margenPct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="text-center px-3 py-3 tabular-nums text-slate-400">
        {product.imageScore ?? '—'}/100
      </td>
      <td className="text-center px-3 py-3">
        {product.grade && <GradeBadge grade={product.grade} />}
      </td>
      <td className="text-right px-5 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <ActionButton
            variant="ghost"
            size="sm"
            loadingText="Estimando..."
            successText="OK"
            onAction={handleAutoEstimate}
          >
            Auto
          </ActionButton>
          <button
            onClick={onEditStructure}
            className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded transition"
          >
            Estructura
          </button>
          <button
            onClick={onSimulate}
            className="px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded transition flex items-center gap-1"
            disabled={!hasCOGS}
          >
            <TrendingUp className="w-3 h-3" />
            Simular
          </button>
          <button
            onClick={onOptimize}
            className="px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-500/10 rounded transition flex items-center gap-1"
            disabled={!hasCOGS}
          >
            <Sparkles className="w-3 h-3" />
            Optimizar
          </button>
        </div>
      </td>
    </tr>
  );
}

function KPICard({
  label, value, sublabel, color, warning,
}: {
  label: string; value: string; sublabel?: string;
  color: 'teal' | 'cyan' | 'amber' | 'violet' | 'red';
  warning?: boolean;
}) {
  const borderColor = {
    teal: 'border-l-teal-500',
    cyan: 'border-l-cyan-500',
    amber: 'border-l-amber-500',
    violet: 'border-l-violet-500',
    red: 'border-l-red-500',
  }[color];

  return (
    <div className={`bg-slate-900 border border-slate-800 ${borderColor} border-l-2 rounded-lg p-4`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular-nums ${warning ? 'text-amber-300' : 'text-slate-100'}`}>
        {value}
      </p>
      {sublabel && <p className="text-[10px] text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );
}

function Alert({ level, text }: { level: 'warning' | 'critical'; text: string }) {
  const styles = level === 'critical'
    ? 'bg-red-500/10 border-red-500/30 text-red-300'
    : 'bg-amber-500/10 border-amber-500/30 text-amber-300';

  return (
    <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${styles}`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' | 'D' | 'F' }) {
  const colorMap = {
    A: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
    B: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    C: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    D: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    F: 'bg-red-500/20 text-red-400 border-red-500/40',
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border ${colorMap[grade]}`}>
      {grade}
    </span>
  );
}
