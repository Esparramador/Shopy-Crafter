// ============================================================
// COGSStructureModal - Modal "Estructura de Costes Real"
// ============================================================
// Reemplaza el modal actual donde están todos los inputs en 0.00
// Incluye botón "Auto-estimar con IA" que rellena automáticamente
// ============================================================

import { useState, useEffect } from 'react';
import { X, Factory, Package, Truck, Sparkles, AlertTriangle, Save } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { pricingAPI } from '../lib/api';
import type { ShopifyProduct, COGSData } from '../lib/types';

interface Props {
  product: ShopifyProduct;
  open: boolean;
  onClose: () => void;
  onSaved: (cogs: COGSData) => void;
}

const emptyCOGS: Partial<COGSData> = {
  costeUnitario: 0,
  materiales: 0,
  tejidos: 0,
  impresionDigital: 0,
  serigrafia: 0,
  amortizacionMoldes: 0,
  montaje: 0,
  manoObra: 0,
  controlCalidad: 0,
  embalaje: 0,
  etiquetado: 0,
  envioNacional: 0,
  envioInternacional: 0,
  fulfillment: 0,
  almacenamiento: 0,
  creditosIA: 0,
  storageBandwidth: 0,
  paymentFees: 0,
  rotura: 0,
  marketing: 0,
};

export function COGSStructureModal({ product, open, onClose, onSaved }: Props) {
  const [cogs, setCOGS] = useState<Partial<COGSData>>(product.cogsData || emptyCOGS);
  const [openSections, setOpenSections] = useState({
    produccion: true,
    embalaje: false,
    logistica: false,
    digital: false,
    otros: false,
  });
  const [warnings, setWarnings] = useState<string[]>(product.cogsData?.warnings || []);
  const [confidence, setConfidence] = useState<number>(product.cogsData?.confidence || 0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (product.cogsData) {
      setCOGS(product.cogsData);
      setWarnings(product.cogsData.warnings || []);
      setConfidence(product.cogsData.confidence || 0);
    }
  }, [product.cogsData]);

  if (!open) return null;

  const updateField = (field: keyof COGSData, value: number) => {
    setCOGS((prev) => ({ ...prev, [field]: value }));
  };

  const calculateTotal = (data: Partial<COGSData>): number => {
    const fields: (keyof COGSData)[] = [
      'costeUnitario', 'materiales', 'tejidos', 'impresionDigital', 'serigrafia',
      'amortizacionMoldes', 'montaje', 'manoObra', 'controlCalidad',
      'embalaje', 'etiquetado',
      'envioNacional', 'fulfillment', 'almacenamiento',
      'creditosIA', 'storageBandwidth', 'paymentFees',
      'rotura', 'marketing',
    ];
    return fields.reduce((sum, f) => sum + (Number(data[f]) || 0), 0);
  };

  const total = calculateTotal(cogs);
  const margenBruto = product.currentPrice - total;
  const margenPct = product.currentPrice > 0 ? (margenBruto / product.currentPrice) * 100 : 0;

  // Auto-estimación con IA — rellena todos los campos con stagger animation
  const handleAutoEstimate = async () => {
    setAnimating(true);
    const result = await pricingAPI.estimateCOGS(product.id);

    // Stagger animation: rellena cada campo con 50ms entre cada uno
    const fields: (keyof COGSData)[] = [
      'costeUnitario', 'materiales', 'impresionDigital', 'montaje',
      'manoObra', 'controlCalidad', 'embalaje', 'etiquetado',
      'envioNacional', 'fulfillment', 'almacenamiento',
      'creditosIA', 'paymentFees', 'rotura', 'marketing',
    ];

    for (let i = 0; i < fields.length; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const field = fields[i];
      setCOGS((prev) => ({ ...prev, [field]: result[field] || 0 }));
    }

    setWarnings(result.warnings || []);
    setConfidence(result.confidence || 0);
    setAnimating(false);
  };

  const handleSave = async () => {
    const saved = await pricingAPI.saveCOGS(product.id, cogs);
    onSaved(saved);
    onClose();
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl my-8 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-5 flex justify-between items-start rounded-t-xl z-10">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Estructura de Costes Real</h2>
            <p className="text-sm text-slate-400 mb-2">{product.title}</p>
            <p className="text-xs text-slate-500">
              Shopy Crafter analiza el producto, materiales, logística y estima todos los costes
              automáticamente con IA real (Claude Opus 4.7).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition ml-4"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-estimar con IA */}
        <div className="p-5 border-b border-slate-700">
          <ActionButton
            variant="ai"
            size="lg"
            fullWidth
            loadingText="Analizando producto con IA..."
            successText="Estimación completada"
            onAction={handleAutoEstimate}
            disabled={animating}
          >
            Auto-estimar con IA
          </ActionButton>

          {confidence > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Confianza estimación: <span className="text-violet-300 font-medium">{Math.round(confidence * 100)}%</span>
              </span>
              {confidence < 0.6 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Estimación tentativa
                </span>
              )}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Secciones colapsables */}
        <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
          {/* PRODUCCIÓN */}
          <Section
            title="Producción y Fabricación"
            icon={<Factory className="w-4 h-4 text-teal-400" />}
            isOpen={openSections.produccion}
            onToggle={() => toggleSection('produccion')}
          >
            <Grid>
              <Field label="Coste unitario producto" value={cogs.costeUnitario} onChange={(v) => updateField('costeUnitario', v)} />
              <Field label="Materiales (marcos, componentes...)" value={cogs.materiales} onChange={(v) => updateField('materiales', v)} />
              <Field label="Tejidos / Telas" value={cogs.tejidos} onChange={(v) => updateField('tejidos', v)} />
              <Field label="Impresión digital" value={cogs.impresionDigital} onChange={(v) => updateField('impresionDigital', v)} />
              <Field label="Serigrafía" value={cogs.serigrafia} onChange={(v) => updateField('serigrafia', v)} />
              <Field label="Amortización moldes/utillajes" value={cogs.amortizacionMoldes} onChange={(v) => updateField('amortizacionMoldes', v)} />
              <Field label="Montaje / Ensamblaje" value={cogs.montaje} onChange={(v) => updateField('montaje', v)} />
              <Field label="Mano de obra por unidad" value={cogs.manoObra} onChange={(v) => updateField('manoObra', v)} />
              <Field label="Control de calidad" value={cogs.controlCalidad} onChange={(v) => updateField('controlCalidad', v)} />
            </Grid>
          </Section>

          <Section
            title="Embalaje y Etiquetado"
            icon={<Package className="w-4 h-4 text-cyan-400" />}
            isOpen={openSections.embalaje}
            onToggle={() => toggleSection('embalaje')}
          >
            <Grid>
              <Field label="Embalaje (cajas, protectores)" value={cogs.embalaje} onChange={(v) => updateField('embalaje', v)} />
              <Field label="Etiquetado" value={cogs.etiquetado} onChange={(v) => updateField('etiquetado', v)} />
            </Grid>
          </Section>

          <Section
            title="Logística y Envío"
            icon={<Truck className="w-4 h-4 text-amber-400" />}
            isOpen={openSections.logistica}
            onToggle={() => toggleSection('logistica')}
          >
            <Grid>
              <Field label="Envío nacional" value={cogs.envioNacional} onChange={(v) => updateField('envioNacional', v)} />
              <Field label="Envío internacional" value={cogs.envioInternacional} onChange={(v) => updateField('envioInternacional', v)} />
              <Field label="Fulfillment / Preparación pedido" value={cogs.fulfillment} onChange={(v) => updateField('fulfillment', v)} />
              <Field label="Almacén por unidad" value={cogs.almacenamiento} onChange={(v) => updateField('almacenamiento', v)} />
            </Grid>
          </Section>

          <Section
            title="Digital e IA"
            icon={<Sparkles className="w-4 h-4 text-violet-400" />}
            isOpen={openSections.digital}
            onToggle={() => toggleSection('digital')}
          >
            <Grid>
              <Field label="Créditos IA (generación)" value={cogs.creditosIA} onChange={(v) => updateField('creditosIA', v)} />
              <Field label="Storage + Bandwidth" value={cogs.storageBandwidth} onChange={(v) => updateField('storageBandwidth', v)} />
              <Field label="Payment fees (Stripe, etc.)" value={cogs.paymentFees} onChange={(v) => updateField('paymentFees', v)} />
            </Grid>
          </Section>

          <Section
            title="Otros costes"
            icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
            isOpen={openSections.otros}
            onToggle={() => toggleSection('otros')}
          >
            <Grid>
              <Field label="Rotura / Mermas" value={cogs.rotura} onChange={(v) => updateField('rotura', v)} />
              <Field label="Marketing por unidad" value={cogs.marketing} onChange={(v) => updateField('marketing', v)} />
            </Grid>
          </Section>
        </div>

        {/* Footer con totales */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-5 rounded-b-xl">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard label="COGS TOTAL" value={`€${total.toFixed(2)}`} color="text-slate-100" />
            <SummaryCard
              label="MARGEN BRUTO"
              value={`€${margenBruto.toFixed(2)}`}
              color={margenBruto > 0 ? 'text-teal-400' : 'text-red-400'}
            />
            <SummaryCard
              label="MARGEN %"
              value={`${margenPct.toFixed(1)}%`}
              color={margenPct >= 30 ? 'text-teal-400' : margenPct >= 15 ? 'text-amber-400' : 'text-red-400'}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition"
            >
              Cancelar
            </button>
            <ActionButton
              variant="primary"
              icon={<Save className="w-4 h-4" />}
              loadingText="Guardando..."
              successText="Guardado"
              onAction={handleSave}
            >
              Guardar costes
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Subcomponentes locales
// ============================================================

function Section({
  title, icon, isOpen, onToggle, children,
}: { title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-900/50 transition rounded-lg"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-200">{title}</span>
        </div>
        <span className="text-slate-500 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value ?? 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none transition"
      />
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-md p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
