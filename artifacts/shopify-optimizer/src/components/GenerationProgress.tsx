import { useEffect, useState, useRef } from "react";
import { Brain, CheckCircle, Loader2, Clock } from "lucide-react";

export type GenerationStepId =
  | "connecting"
  | "loading_products"
  | "loading_history"
  | "building_context"
  | "analyzing"
  | "generating_content"
  | "generating_images"
  | "generating_email"
  | "generating_seo"
  | "generating_pricing"
  | "generating_forecast"
  | "studying"
  | "saving"
  | "finalizing";

interface Step {
  id: GenerationStepId;
  label: string;
  detail: string;
}

const ALL_STEPS: Record<GenerationStepId, Step> = {
  connecting:         { id: "connecting",         label: "Conectando con la tienda",       detail: "Autenticando acceso a la tienda..." },
  loading_products:   { id: "loading_products",   label: "Cargando catálogo",            detail: "Leyendo productos, precios e inventario..." },
  loading_history:    { id: "loading_history",    label: "Analizando historial",         detail: "Revisando datos históricos y tendencias..." },
  building_context:   { id: "building_context",   label: "Construyendo contexto",        detail: "Cargando memorias y aprendizajes previos..." },
  analyzing:          { id: "analyzing",          label: "Analizando con IA",            detail: "Claude procesa y extrae insights estratégicos..." },
  generating_content: { id: "generating_content", label: "Generando contenido",          detail: "Claude redacta contenido optimizado para tu nicho..." },
  generating_images:  { id: "generating_images",  label: "Generando imagen",             detail: "Flux IA renderiza la imagen con tus especificaciones..." },
  generating_email:   { id: "generating_email",   label: "Escribiendo email",            detail: "Claude redacta copy persuasivo y subject lines..." },
  generating_seo:     { id: "generating_seo",     label: "Optimizando SEO",              detail: "Generando títulos, meta, schema y contenido orgánico..." },
  generating_pricing: { id: "generating_pricing", label: "Calculando precios",           detail: "Analizando COGS, competencia y elasticidad de demanda..." },
  generating_forecast:{ id: "generating_forecast",label: "Procesando ML",               detail: "Modelo de predicción analiza patrones históricos..." },
  studying:           { id: "studying",           label: "Estudiando dominio",           detail: "Profundizando en conocimiento especializado..." },
  saving:             { id: "saving",             label: "Guardando resultados",         detail: "Almacenando insights y actualizando memorias..." },
  finalizing:         { id: "finalizing",         label: "Finalizando",                  detail: "Aprendiendo de esta operación para mejorar..." },
};

type OperationType =
  | "analysis"
  | "email"
  | "images"
  | "seo"
  | "pricing"
  | "forecast"
  | "study"
  | "redesign"
  | "generic";

const OPERATION_FLOWS: Record<OperationType, GenerationStepId[]> = {
  analysis:  ["connecting", "loading_products", "loading_history", "building_context", "analyzing", "saving", "finalizing"],
  email:     ["connecting", "loading_products", "building_context", "generating_email", "finalizing"],
  images:    ["connecting", "loading_products", "building_context", "generating_images", "saving", "finalizing"],
  seo:       ["connecting", "loading_products", "building_context", "generating_seo", "saving", "finalizing"],
  pricing:   ["connecting", "loading_products", "loading_history", "building_context", "generating_pricing", "saving", "finalizing"],
  forecast:  ["connecting", "loading_history", "building_context", "analyzing", "generating_forecast", "saving", "finalizing"],
  study:     ["connecting", "building_context", "studying", "analyzing", "saving", "finalizing"],
  redesign:  ["connecting", "loading_products", "building_context", "analyzing", "generating_content", "saving", "finalizing"],
  generic:   ["connecting", "building_context", "analyzing", "generating_content", "finalizing"],
};

const STEP_DURATIONS: Partial<Record<GenerationStepId, number>> = {
  connecting:          1200,
  loading_products:    2000,
  loading_history:     1800,
  building_context:    2500,
  analyzing:           4000,
  generating_content:  5000,
  generating_images:   8000,
  generating_email:    4500,
  generating_seo:      5000,
  generating_pricing:  3500,
  generating_forecast: 4000,
  studying:            6000,
  saving:              1500,
  finalizing:          1000,
};

interface GenerationProgressProps {
  active: boolean;
  operation: OperationType;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export default function GenerationProgress({
  active,
  operation,
  title,
  subtitle,
  onComplete,
  style,
}: GenerationProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flow = OPERATION_FLOWS[operation] ?? OPERATION_FLOWS.generic;

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      setCurrentStepIndex(0);
      setElapsedSeconds(0);
      setCompletedSteps(new Set());
      return;
    }

    setCurrentStepIndex(0);
    setElapsedSeconds(0);
    setCompletedSteps(new Set());

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    let idx = 0;
    const advance = () => {
      if (idx >= flow.length - 1) {
        onComplete?.();
        return;
      }
      const stepId = flow[idx];
      const duration = STEP_DURATIONS[stepId] ?? 2000;
      stepTimerRef.current = setTimeout(() => {
        setCompletedSteps((prev) => new Set([...prev, idx]));
        idx++;
        setCurrentStepIndex(idx);
        advance();
      }, duration);
    };
    advance();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [active, operation]);

  if (!active) return null;

  const totalEstimated = flow.reduce((sum, id) => sum + (STEP_DURATIONS[id] ?? 2000), 0) / 1000;
  const progressPct = Math.min(100, (elapsedSeconds / totalEstimated) * 100);
  const currentStep = flow[currentStepIndex] ? ALL_STEPS[flow[currentStepIndex]] : null;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div
      style={{
        background: "var(--ink2)",
        border: "1px solid var(--ink3)",
        borderRadius: 14,
        padding: "20px 24px",
        marginBottom: 20,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "rgba(200,168,75,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulse 2s ease-in-out infinite",
        }}>
          <Brain size={20} style={{ color: "var(--gold)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>
            {title ?? "Shopy Crafter generando..."}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--t3)", fontSize: 12 }}>
          <Clock size={13} />
          <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
            {fmt(elapsedSeconds)}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          {currentStep && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Loader2 size={12} style={{ color: "var(--gold)", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>
                {currentStep.label}
              </span>
            </div>
          )}
          <span style={{ fontSize: 11, color: "var(--t4)", marginLeft: "auto" }}>
            ~{Math.max(0, Math.round(totalEstimated - elapsedSeconds))}s restantes
          </span>
        </div>
        <div style={{ height: 5, background: "var(--ink3)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, var(--gold), #e8c87b)",
            borderRadius: 10,
            transition: "width 1s linear",
          }} />
        </div>
      </div>

      {currentStep && (
        <div style={{
          fontSize: 11, color: "var(--t3)", marginBottom: 14,
          padding: "8px 12px", background: "var(--ink3)", borderRadius: 8,
          fontStyle: "italic",
        }}>
          {currentStep.detail}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {flow.map((stepId, i) => {
          const step = ALL_STEPS[stepId];
          const isDone = completedSteps.has(i);
          const isCurrent = i === currentStepIndex;
          const isPending = i > currentStepIndex;
          return (
            <div key={stepId} style={{
              display: "flex", alignItems: "center", gap: 8,
              opacity: isPending ? 0.35 : 1,
              transition: "opacity 0.3s",
            }}>
              <div style={{ flexShrink: 0, width: 16 }}>
                {isDone ? (
                  <CheckCircle size={14} style={{ color: "var(--jade)" }} />
                ) : isCurrent ? (
                  <Loader2 size={14} style={{ color: "var(--gold)", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid var(--ink3)" }} />
                )}
              </div>
              <span style={{
                fontSize: 12,
                color: isDone ? "var(--t3)" : isCurrent ? "var(--t)" : "var(--t4)",
                fontWeight: isCurrent ? 600 : 400,
                textDecoration: isDone ? "line-through" : "none",
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
