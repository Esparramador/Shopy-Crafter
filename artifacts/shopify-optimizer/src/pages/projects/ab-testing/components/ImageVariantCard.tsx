import { Check, Star, AlertTriangle } from "lucide-react";
import type { ImageVariant, ImageAnalysis } from "../lib/types";

interface Props {
  type: "original" | "variant";
  variant?: ImageVariant;
  imageUrl: string;
  analysis?: ImageAnalysis;
  isSelected?: boolean;
  isRecommended?: boolean;
  onSelect?: () => void;
  generating?: boolean;
}

const styleLabels: Record<string, { label: string; cls: string }> = {
  lifestyle: { label: "Lifestyle", cls: "bg-teal-500/90" },
  studio:    { label: "Studio",    cls: "bg-cyan-500/90" },
  context:   { label: "Contexto",  cls: "bg-violet-500/90" },
  detail:    { label: "Detalle",   cls: "bg-amber-500/90" },
  minimalist:{ label: "Minimal",   cls: "bg-slate-500/90" },
};

export function ImageVariantCard({
  type, variant, imageUrl, analysis, isSelected, isRecommended, onSelect, generating,
}: Props) {
  const score = analysis?.scoreOverall || variant?.analysis?.scoreOverall || 0;
  const styleInfo = variant ? styleLabels[variant.style] : null;
  const scoreColor =
    score >= 80 ? "text-teal-400" :
    score >= 65 ? "text-cyan-400" :
    score >= 50 ? "text-amber-400" :
    "text-red-400";

  return (
    <button
      onClick={onSelect}
      disabled={generating || !onSelect}
      className={`
        relative bg-slate-900 rounded-lg overflow-hidden transition-all text-left w-full
        ${isSelected
          ? "border-2 border-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.15)]"
          : "border border-slate-800 hover:border-slate-600"}
        ${generating ? "opacity-50 cursor-wait" : onSelect ? "cursor-pointer" : "cursor-default"}
      `}
    >
      <div className="absolute top-2 left-2 z-10 flex gap-1 flex-wrap">
        {type === "original" && (
          <span className="bg-slate-700 text-slate-200 text-[9px] px-2 py-1 rounded font-semibold uppercase tracking-wider">
            Original
          </span>
        )}
        {type === "variant" && styleInfo && (
          <span className={`${styleInfo.cls} text-white text-[9px] px-2 py-1 rounded font-semibold uppercase tracking-wider`}>
            {styleInfo.label}
          </span>
        )}
        {isRecommended && (
          <span className="bg-teal-500 text-slate-950 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-current" />
            Recomendada
          </span>
        )}
      </div>

      {isSelected && (
        <div className="absolute top-2 right-2 z-10 bg-teal-500 text-slate-950 rounded-full p-1">
          <Check className="w-3 h-3" />
        </div>
      )}

      <div className="relative bg-slate-950 aspect-square overflow-hidden">
        {generating ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              Generando...
            </div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Variant"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">
            Sin imagen
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Score IA</span>
          <span className={`text-base font-semibold tabular-nums ${scoreColor}`}>
            {score > 0 ? `${score.toFixed(0)}/100` : "—"}
          </span>
        </div>

        {analysis && (
          <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
            <SubScore label="Composición" value={analysis.scoreComposition} />
            <SubScore label="Iluminación" value={analysis.scoreLighting} />
            <SubScore label="Contexto" value={analysis.scoreContext} />
            <SubScore label="Apelación" value={analysis.scoreAppeal} />
          </div>
        )}

        {analysis?.warnings && analysis.warnings.length > 0 && (
          <div className="flex items-start gap-1 mt-2">
            <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-amber-300 leading-snug">
              {analysis.warnings[0]}
            </p>
          </div>
        )}

        {variant && (
          <div className="text-[9px] text-slate-500 mt-2 flex justify-between">
            <span>{variant.generationProvider}</span>
            <span>€{variant.generationCost.toFixed(3)}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const color =
    value >= 7 ? "text-teal-400" :
    value >= 5 ? "text-amber-400" :
    "text-red-400";
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 truncate">{label}</span>
      <span className={`tabular-nums ${color} font-medium`}>{value.toFixed(1)}</span>
    </div>
  );
}
