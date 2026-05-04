// ============================================================
// SimulatorDrawer - Simulador de pricing en tiempo real
// ============================================================
// Drawer lateral derecho con sliders de precio/volumen/conversión/CAC
// Cálculos en tiempo real (sin IA, math puro)
// Gráfico de sensibilidad de beneficio vs variación de precio
// ============================================================

import { useState, useMemo } from 'react';
import { X, TrendingUp, Check } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { pricingAPI } from '../lib/api';
import type { ShopifyProduct } from '../lib/types';

interface Props {
  product: ShopifyProduct;
  open: boolean;
  onClose: () => void;
  onPriceApplied: (newPrice: number) => void;
}

export function SimulatorDrawer({ product, open, onClose, onPriceApplied }: Props) {
  const [priceDelta, setPriceDelta] = useState(0); // -50 a +50 (%)
  const [volume, setVolume] = useState(100);
  const [conversion, setConversion] = useState(2.5);
  const [cac, setCac] = useState(8);

  const cogsTotal = product.cogsData?.cogsTotal || 0;
  const basePrice = product.currentPrice;
  const newPrice = basePrice * (1 + priceDelta / 100);

  // Cálculos en tiempo real
  const calc = useMemo(() => {
    const revenue = newPrice * volume;
    const totalCOGS = cogsTotal * volume;
    const grossProfit = revenue - totalCOGS;
    const acquisitionCost = cac * volume;
    const netProfit = grossProfit - acquisitionCost;
    const breakEvenUnits = cogsTotal > 0 && newPrice > cogsTotal
      ? Math.ceil(acquisitionCost / (newPrice - cogsTotal))
      : 0;
    const marginPct = newPrice > 0 ? ((newPrice - cogsTotal) / newPrice) * 100 : 0;

    // Curva de sensibilidad: -30% a +30% en pasos de 5%
    const sensitivityCurve = [];
    for (let delta = -30; delta <= 30; delta += 5) {
      const p = basePrice * (1 + delta / 100);
      const np = (p - cogsTotal) * volume - acquisitionCost;
      sensitivityCurve.push({ delta, profit: np });
    }

    return { revenue, totalCOGS, grossProfit, netProfit, breakEvenUnits, marginPct, sensitivityCurve };
  }, [newPrice, volume, cogsTotal, cac, basePrice]);

  if (!open) return null;

  const handleApply = async () => {
    await pricingAPI.applyPrice(product.id, Number(newPrice.toFixed(2)));
    onPriceApplied(Number(newPrice.toFixed(2)));
    onClose();
  };

  // Encontrar el punto óptimo de la curva
  const maxProfit = Math.max(...calc.sensitivityCurve.map((p) => p.profit));
  const minProfit = Math.min(...calc.sensitivityCurve.map((p) => p.profit));
  const profitRange = maxProfit - minProfit || 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-5 flex justify-between items-start z-10">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-cyan-400 uppercase tracking-wider font-semibold">Simulador</span>
            </div>
            <h2 className="text-base font-semibold text-slate-100">{product.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Precio actual: €{basePrice.toFixed(2)} · COGS: €{cogsTotal.toFixed(2)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sliders */}
        <div className="p-5 space-y-5 border-b border-slate-700">
          <Slider
            label="Variación precio"
            value={priceDelta}
            min={-50}
            max={50}
            step={1}
            unit="%"
            color="teal"
            onChange={setPriceDelta}
            display={`€${newPrice.toFixed(2)} (${priceDelta > 0 ? '+' : ''}${priceDelta}%)`}
          />
          <Slider
            label="Volumen mensual estimado"
            value={volume}
            min={0}
            max={1000}
            step={10}
            unit="ud"
            color="cyan"
            onChange={setVolume}
          />
          <Slider
            label="Tasa de conversión"
            value={conversion}
            min={0}
            max={15}
            step={0.1}
            unit="%"
            color="amber"
            onChange={setConversion}
          />
          <Slider
            label="Coste adquisición cliente (CAC)"
            value={cac}
            min={0}
            max={50}
            step={0.5}
            unit="€"
            color="violet"
            onChange={setCac}
          />
        </div>

        {/* Resultados */}
        <div className="p-5 space-y-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Proyección mensual</p>
          <ResultRow label="Revenue" value={`€${calc.revenue.toFixed(0)}`} />
          <ResultRow label="COGS total" value={`€${calc.totalCOGS.toFixed(0)}`} muted />
          <ResultRow label="Beneficio bruto" value={`€${calc.grossProfit.toFixed(0)}`} accent="teal" />
          <ResultRow label="Coste adquisición" value={`€${(cac * volume).toFixed(0)}`} muted />
          <ResultRow
            label="Beneficio NETO"
            value={`€${calc.netProfit.toFixed(0)}`}
            accent={calc.netProfit > 0 ? 'teal' : 'red'}
            bold
          />
          <ResultRow label="Margen" value={`${calc.marginPct.toFixed(1)}%`} muted />
          <ResultRow label="Punto equilibrio" value={`${calc.breakEvenUnits} ud`} muted />
        </div>

        {/* Gráfico sensibilidad */}
        <div className="p-5 border-b border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
            Sensibilidad: variación precio vs beneficio
          </p>
          <div className="bg-slate-950 rounded-md p-4 relative h-32">
            <svg viewBox="0 0 240 80" className="w-full h-full" preserveAspectRatio="none">
              {/* Línea de cero */}
              <line
                x1="0"
                y1={80 - ((-minProfit / profitRange) * 80)}
                x2="240"
                y2={80 - ((-minProfit / profitRange) * 80)}
                stroke="#475569"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
              {/* Curva de profit */}
              <polyline
                fill="none"
                stroke="#14b8a6"
                strokeWidth="2"
                points={calc.sensitivityCurve.map((p, i) => {
                  const x = (i / (calc.sensitivityCurve.length - 1)) * 240;
                  const y = 80 - ((p.profit - minProfit) / profitRange) * 80;
                  return `${x},${y}`;
                }).join(' ')}
              />
              {/* Punto actual */}
              {(() => {
                const currentIdx = calc.sensitivityCurve.findIndex((p) => p.delta === Math.round(priceDelta / 5) * 5);
                if (currentIdx === -1) return null;
                const x = (currentIdx / (calc.sensitivityCurve.length - 1)) * 240;
                const y = 80 - ((calc.sensitivityCurve[currentIdx].profit - minProfit) / profitRange) * 80;
                return <circle cx={x} cy={y} r="3" fill="#14b8a6" />;
              })()}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
            <span>-30%</span>
            <span>0%</span>
            <span>+30%</span>
          </div>
        </div>

        {/* Aplicar precio */}
        <div className="p-5 sticky bottom-0 bg-slate-900 border-t border-slate-700">
          <ActionButton
            variant="primary"
            size="lg"
            fullWidth
            icon={<Check className="w-4 h-4" />}
            confirmMessage={`Aplicar precio €${newPrice.toFixed(2)} a Shopify?`}
            loadingText="Aplicando a Shopify..."
            successText="Precio actualizado"
            onAction={handleApply}
            disabled={priceDelta === 0}
          >
            Aplicar este precio
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

const colorClasses = {
  teal: 'accent-teal-500',
  cyan: 'accent-cyan-500',
  amber: 'accent-amber-500',
  violet: 'accent-violet-500',
};

function Slider({
  label, value, min, max, step, unit, color, onChange, display,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; color: keyof typeof colorClasses;
  onChange: (v: number) => void; display?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-xs text-slate-300 font-medium">{label}</label>
        <span className="text-xs text-slate-100 font-semibold tabular-nums">
          {display || `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer ${colorClasses[color]}`}
      />
    </div>
  );
}

function ResultRow({
  label, value, accent, muted, bold,
}: { label: string; value: string; accent?: 'teal' | 'red'; muted?: boolean; bold?: boolean }) {
  const valueColor =
    accent === 'teal' ? 'text-teal-400' :
    accent === 'red' ? 'text-red-400' :
    muted ? 'text-slate-400' :
    'text-slate-100';

  return (
    <div className={`flex justify-between text-sm ${bold ? 'pt-2 border-t border-slate-800' : ''}`}>
      <span className="text-slate-400">{label}</span>
      <span className={`tabular-nums ${valueColor} ${bold ? 'font-semibold text-base' : ''}`}>{value}</span>
    </div>
  );
}
