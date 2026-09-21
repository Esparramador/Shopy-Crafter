import { useState, useEffect } from "react";
import { ModalOverlay } from "@/components/ModalOverlay";
import { X, ChevronRight, ChevronLeft, Sparkles, Image as ImageIcon, Check, RefreshCw } from "lucide-react";
import { ActionButton } from "./ActionButton";
import { ImageVariantCard } from "./ImageVariantCard";
import type {
  ShopifyProduct, ImageAnalysis, ImageVariant, ImageStyle, ImageTestConfig,
} from "../lib/types";
import type { ABTestingAPI } from "../lib/api";

interface Props {
  open: boolean;
  api: ABTestingAPI;
  onClose: () => void;
  onCreated: (testId: string) => void;
  preselectedProduct?: ShopifyProduct;
}

const STYLES: { key: ImageStyle; label: string; description: string }[] = [
  { key: "lifestyle", label: "Lifestyle", description: "Producto en uso real, contexto humano" },
  { key: "studio",    label: "Studio",    description: "Fondo profesional, iluminación controlada" },
  { key: "context",   label: "Contexto",  description: "Producto en su entorno natural" },
  { key: "detail",    label: "Detalle",   description: "Close-up que muestra textura y calidad" },
];

export function ImageTestWizard({ open, api, onClose, onCreated, preselectedProduct }: Props) {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(preselectedProduct || null);
  const [originalAnalysis, setOriginalAnalysis] = useState<ImageAnalysis | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [generatingStyles, setGeneratingStyles] = useState<Set<ImageStyle>>(new Set());
  const [hypothesis, setHypothesis] = useState("");
  const [config, setConfig] = useState({
    splitTraffic: 50,
    durationDays: 14,
    minVisitors: 1000,
    primaryMetric: "conversion_rate" as const,
    autoApplyWinner: true,
  });

  useEffect(() => {
    if (open && products.length === 0) {
      api.getProducts().then(setProducts).catch(() => {});
    }
  }, [open, products.length, api]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setOriginalAnalysis(null);
      setVariants([]);
      setSelectedVariantId(null);
      setHypothesis("");
      if (!preselectedProduct) setSelectedProduct(null);
    }
  }, [open, preselectedProduct]);

  if (!open) return null;

  const canGoNext = (() => {
    if (step === 1) return !!selectedProduct;
    if (step === 2) return !!selectedVariantId;
    if (step === 3) return hypothesis.trim().length > 10;
    return true;
  })();

  const handleAnalyzeOriginal = async () => {
    if (!selectedProduct?.imageUrl) return;
    const analysis = await api.analyzeImage(selectedProduct.id, selectedProduct.imageUrl);
    setOriginalAnalysis(analysis);
  };

  const handleGenerateVariant = async (style: ImageStyle) => {
    if (!selectedProduct) return;
    setGeneratingStyles((prev) => new Set([...prev, style]));
    try {
      const variant = await api.generateImageVariant(selectedProduct.id, style);
      setVariants((prev) => [...prev.filter((v) => v.style !== style), variant]);
    } finally {
      setGeneratingStyles((prev) => {
        const next = new Set(prev);
        next.delete(style);
        return next;
      });
    }
  };

  const handleGenerateAll = async () => {
    if (!selectedProduct) return;
    setGeneratingStyles(new Set(["lifestyle", "studio", "context", "detail"]));
    try {
      const allVariants = await api.generateAllVariants(selectedProduct.id);
      setVariants(allVariants);
    } finally {
      setGeneratingStyles(new Set());
    }
  };

  const handleCreateTest = async () => {
    if (!selectedProduct || !selectedVariantId) return;
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;

    const testConfig: ImageTestConfig = {
      type: "image",
      productId: selectedProduct.id,
      hypothesis,
      primaryMetric: config.primaryMetric,
      secondaryMetrics: ["ctr", "aov"],
      splitTraffic: config.splitTraffic,
      durationDays: config.durationDays,
      minVisitors: config.minVisitors,
      minConfidence: 95,
      winnerStrategy: "auto_winner",
      autoApplyWinner: config.autoApplyWinner,
      controlImageUrl: selectedProduct.imageUrl || "",
      challengerImageUrl: variant.url,
      challengerVariantId: variant.id,
    };

    const test = await api.createImageTest(testConfig);
    onCreated(test.id);
    onClose();
  };

  const estimatedGenerationCost = 4 * 0.3;
  const recommendedVariant = variants.length > 0
    ? variants.reduce((best, v) => v.analysis.scoreOverall > best.analysis.scoreOverall ? v : best, variants[0])
    : null;

  return (
    <ModalOverlay className="backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl my-8 shadow-2xl">

        <div className="border-b border-slate-700 p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-violet-400 uppercase tracking-wider font-semibold">
                Test de Imagen · Wizard
              </span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {["Producto", "Variantes IA", "Configuración", "Lanzar"].map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === step;
              const done = stepNum < step;
              return (
                <div key={label} className="flex items-center flex-1">
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition flex-1
                    ${active ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" :
                      done ? "bg-slate-800 text-slate-300" :
                      "bg-slate-800/50 text-slate-500"}
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

        <div className="p-5 max-h-[60vh] overflow-y-auto">

          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">¿Qué producto vas a testear?</h3>
              <p className="text-xs text-slate-400 mb-4">
                Sincronizado con tu catálogo Shopify. Selecciona uno para empezar.
              </p>
              {products.length === 0 ? (
                <div className="bg-slate-950 border border-dashed border-slate-700 rounded-lg p-8 text-center text-xs text-slate-500">
                  No hay productos sincronizados. Sincroniza tu catálogo Shopify primero.
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border transition text-left
                        ${selectedProduct?.id === p.id
                          ? "bg-teal-500/10 border-teal-500"
                          : "bg-slate-950 border-slate-800 hover:border-slate-600"}
                      `}
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} className="w-12 h-12 rounded object-cover bg-slate-800 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-800 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-slate-100 font-medium truncate">{p.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">€{p.currentPrice.toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedProduct && (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 mb-1">Variantes generadas con IA</h3>
                  <p className="text-xs text-slate-400">
                    Selecciona la variante que vas a testear contra la imagen actual
                  </p>
                </div>
                {variants.length === 0 ? (
                  <ActionButton
                    variant="ai" size="md" icon={<Sparkles className="w-4 h-4" />}
                    loadingText="Generando 4 variantes..." successText="Listo"
                    estimatedCost={estimatedGenerationCost}
                    confirmMessage={`Generar 4 variantes IA. Coste estimado: €${estimatedGenerationCost.toFixed(2)}`}
                    onAction={handleGenerateAll}
                  >
                    Generar todas
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="secondary" size="sm" icon={<RefreshCw className="w-3 h-3" />}
                    onAction={handleGenerateAll}
                  >
                    Regenerar
                  </ActionButton>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <ImageVariantCard
                  type="original"
                  imageUrl={selectedProduct.imageUrl || ""}
                  analysis={originalAnalysis || undefined}
                />
                {STYLES.map((s) => {
                  const variant = variants.find((v) => v.style === s.key);
                  const isGenerating = generatingStyles.has(s.key);

                  if (!variant && !isGenerating) {
                    return (
                      <button
                        key={s.key}
                        onClick={() => handleGenerateVariant(s.key)}
                        className="aspect-[3/4] bg-slate-950 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-center p-4 hover:border-violet-500 hover:bg-violet-500/5 transition"
                      >
                        <Sparkles className="w-6 h-6 text-slate-600 mb-2" />
                        <p className="text-xs text-slate-300 font-medium mb-1">{s.label}</p>
                        <p className="text-[10px] text-slate-500 leading-snug">{s.description}</p>
                        <p className="text-[10px] text-violet-400 mt-2">Generar →</p>
                      </button>
                    );
                  }

                  return (
                    <ImageVariantCard
                      key={s.key}
                      type="variant"
                      variant={variant}
                      imageUrl={variant?.url || ""}
                      analysis={variant?.analysis}
                      isSelected={selectedVariantId === variant?.id}
                      isRecommended={variant?.id === recommendedVariant?.id}
                      onSelect={variant ? () => setSelectedVariantId(variant.id) : undefined}
                      generating={isGenerating}
                    />
                  );
                })}
              </div>

              {!originalAnalysis && selectedProduct.imageUrl && (
                <div className="mt-4">
                  <ActionButton
                    variant="ghost" size="sm"
                    onAction={handleAnalyzeOriginal}
                    loadingText="Analizando original..."
                  >
                    Analizar imagen original
                  </ActionButton>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">Configurar el test</h3>
              <p className="text-xs text-slate-400 mb-5">
                Define hipótesis, métricas y duración para resultados estadísticamente válidos
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1.5 block">
                    Hipótesis del test <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                    placeholder="Ej: La imagen lifestyle convertirá un 15% mejor que la imagen actual de fondo blanco porque genera mayor conexión emocional..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none resize-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Mínimo 10 caracteres. Sé específico: qué métrica esperas mejorar y por qué.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Métrica primaria"
                    value={config.primaryMetric}
                    onChange={(v) => setConfig({ ...config, primaryMetric: v as typeof config.primaryMetric })}
                    options={[
                      { value: "conversion_rate", label: "Tasa de conversión" },
                      { value: "aov", label: "Valor pedido promedio" },
                      { value: "revenue_per_visitor", label: "Revenue por visitante" },
                      { value: "ctr", label: "CTR (clicks)" },
                      { value: "add_to_cart", label: "Add to cart" },
                    ]}
                  />
                  <NumberField label="Split traffic (% Challenger)" value={config.splitTraffic} onChange={(v) => setConfig({ ...config, splitTraffic: v })} min={10} max={90} step={10} suffix="%" />
                  <NumberField label="Duración" value={config.durationDays} onChange={(v) => setConfig({ ...config, durationDays: v })} min={7} max={60} step={1} suffix=" días" />
                  <NumberField label="Visitas mínimas" value={config.minVisitors} onChange={(v) => setConfig({ ...config, minVisitors: v })} min={100} max={50000} step={100} suffix="" />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-4 p-3 bg-slate-950 rounded-md border border-slate-800">
                  <input
                    type="checkbox"
                    checked={config.autoApplyWinner}
                    onChange={(e) => setConfig({ ...config, autoApplyWinner: e.target.checked })}
                    className="accent-teal-500 w-4 h-4"
                  />
                  <div>
                    <p className="text-xs text-slate-200 font-medium">Auto-aplicar ganador</p>
                    <p className="text-[10px] text-slate-500">
                      Cuando se alcance 95% de confianza, aplicar la variante ganadora a Shopify automáticamente
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 4 && selectedProduct && selectedVariantId && (
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">Confirmar y lanzar</h3>
              <p className="text-xs text-slate-400 mb-5">Revisa la configuración antes de iniciar el test</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Control (A)</p>
                  <img src={selectedProduct.imageUrl} alt="" className="w-full aspect-square rounded object-cover mb-2 bg-slate-800" />
                  <p className="text-xs text-slate-300">{selectedProduct.title}</p>
                </div>
                <div className="bg-teal-500/5 border border-teal-500/30 rounded-lg p-4">
                  <p className="text-[10px] text-teal-400 uppercase tracking-wider mb-2 font-semibold">Challenger (B)</p>
                  <img
                    src={variants.find((v) => v.id === selectedVariantId)?.url}
                    alt=""
                    className="w-full aspect-square rounded object-cover mb-2 bg-slate-800"
                  />
                  <p className="text-xs text-slate-300">
                    {STYLES.find((s) => s.key === variants.find((v) => v.id === selectedVariantId)?.style)?.label}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
                <Row label="Hipótesis" value={hypothesis} />
                <Row label="Métrica primaria" value={config.primaryMetric.replace("_", " ")} />
                <Row label="Split traffic" value={`${100 - config.splitTraffic}% / ${config.splitTraffic}%`} />
                <Row label="Duración" value={`${config.durationDays} días`} />
                <Row label="Visitas mínimas" value={config.minVisitors.toLocaleString()} />
                <Row label="Auto-aplicar ganador" value={config.autoApplyWinner ? "Sí" : "No (revisión manual)"} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 p-4 flex justify-between items-center">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? "Cancelar" : "Anterior"}
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
              variant="primary" size="md" icon={<Check className="w-4 h-4" />}
              loadingText="Lanzando test..." successText="Test lanzado"
              confirmMessage="Una vez iniciado, el test enviará tráfico real a la variante. Tarda mínimo unos días para resultados válidos. ¿Continuar?"
              onAction={handleCreateTest}
            >
              Lanzar test ahora
            </ActionButton>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-slate-200 text-right truncate" title={value}>{value}</span>
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-xs text-slate-300 font-medium mb-1.5 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, step, suffix,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix: string }) {
  return (
    <div>
      <label className="text-xs text-slate-300 font-medium mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || min)}
          min={min} max={max} step={step}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
