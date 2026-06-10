import { useState, useCallback, useRef, useEffect, ReactNode } from "react";

export interface WizardStep {
  id: string;
  label: string;
  icon?: ReactNode;
  validate?: () => boolean | string;
  content: ReactNode;
}

interface StepWizardProps {
  steps: WizardStep[];
  onComplete?: () => void;
  onStepChange?: (index: number) => void;
  className?: string;
  showProgressBar?: boolean;
  showStepDots?: boolean;
  allowBack?: boolean;
  containerMinHeight?: number;
  completeLabel?: string;
  nextLabel?: string;
  backLabel?: string;
}

type StepState = "active" | "past" | "future";

export function StepWizard({
  steps,
  onComplete,
  onStepChange,
  className = "",
  showProgressBar = true,
  showStepDots = true,
  allowBack = true,
  containerMinHeight = 200,
  completeLabel = "Completar",
  nextLabel = "Siguiente →",
  backLabel = "← Atrás",
}: StepWizardProps) {
  const [current, setCurrent] = useState(0);
  const [states, setStates] = useState<StepState[]>(
    steps.map((_, i) => (i === 0 ? "active" : "future"))
  );
  const [animating, setAnimating] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(containerMinHeight);

  const activePanel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activePanel.current) {
      const h = activePanel.current.scrollHeight;
      setContainerHeight(Math.max(h, containerMinHeight));
    }
  }, [current, containerMinHeight]);

  const goTo = useCallback(
    (target: number, dir: "fwd" | "bck") => {
      if (animating || target === current) return;
      setValidationError("");
      setAnimating(true);

      setStates((prev) => {
        const next = [...prev];
        next[current] = dir === "fwd" ? "past" : "future";
        next[target] = "active";
        return next;
      });
      setCurrent(target);
      onStepChange?.(target);

      setTimeout(() => setAnimating(false), 520);
    },
    [animating, current, onStepChange]
  );

  const next = useCallback(() => {
    const step = steps[current];
    if (step.validate) {
      const result = step.validate();
      if (result !== true) {
        setValidationError(typeof result === "string" ? result : "Por favor completa este paso.");
        return;
      }
    }
    if (current < steps.length - 1) {
      goTo(current + 1, "fwd");
    } else {
      onComplete?.();
    }
  }, [current, steps, goTo, onComplete]);

  const back = useCallback(() => {
    if (current > 0 && allowBack) {
      goTo(current - 1, "bck");
    }
  }, [current, allowBack, goTo]);

  const pct = Math.round(((current + 1) / steps.length) * 100);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {(showProgressBar || showStepDots) && (
        <div className="flex flex-col gap-2">
          {showStepDots && (
            <div className="flex items-center gap-2">
              {steps.map((step, i) => {
                const done = states[i] === "past";
                const active = states[i] === "active";
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!allowBack || (!done && !active)}
                      onClick={() => {
                        if (allowBack && done) goTo(i, "bck");
                      }}
                      style={{
                        width: active ? 28 : 20,
                        height: 8,
                        borderRadius: 4,
                        background: active
                          ? "var(--sc-ai-purple, #9747ff)"
                          : done
                          ? "var(--sc-ai-emerald, #10b981)"
                          : "rgba(255,255,255,0.10)",
                        border: "none",
                        cursor: done && allowBack ? "pointer" : "default",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        padding: 0,
                        flexShrink: 0,
                      }}
                      title={step.label}
                    />
                    {i < steps.length - 1 && (
                      <div
                        style={{
                          height: 1,
                          width: 20,
                          background: done
                            ? "var(--sc-ai-emerald, #10b981)"
                            : "rgba(255,255,255,0.08)",
                          transition: "background 0.4s ease",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                );
              })}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.40)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {current + 1} / {steps.length}
              </span>
            </div>
          )}
          {showProgressBar && (
            <div
              style={{
                height: 3,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background:
                    "linear-gradient(90deg, var(--sc-ai-purple, #9747ff), var(--sc-ai-azure, #3b80e4))",
                  borderRadius: 2,
                  transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="step-container"
        style={{
          minHeight: containerMinHeight,
          height: containerHeight,
          transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.id}
            ref={states[i] === "active" ? (el) => { activePanel.current = el; } : undefined}
            className={`step-slide ${
              states[i] === "active"
                ? "step-active"
                : states[i] === "past"
                ? "step-past"
                : ""
            }`}
            style={{
              position: states[i] === "active" ? "relative" : "absolute",
              top: states[i] === "active" ? undefined : 0,
              left: states[i] === "active" ? undefined : 0,
            }}
          >
            {step.icon && (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  fontSize: 24,
                }}
              >
                {step.icon}
              </div>
            )}
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--sc-ai-purple, #9747ff)" }}>
              Paso {i + 1} — {step.label}
            </div>
            {step.content}
          </div>
        ))}
      </div>

      {validationError && (
        <div
          style={{
            fontSize: 12,
            color: "#ff4757",
            background: "rgba(255,71,87,0.10)",
            border: "1px solid rgba(255,71,87,0.25)",
            borderRadius: 8,
            padding: "8px 12px",
            animation: "slideDown 0.2s ease",
          }}
        >
          {validationError}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {allowBack && current > 0 && (
          <button
            type="button"
            onClick={back}
            disabled={animating}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.60)",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 13,
              cursor: animating ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              fontFamily: "var(--font-sans)",
            }}
          >
            {backLabel}
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={animating}
          className="sc-form-button"
          style={{ marginLeft: "auto" }}
        >
          {current === steps.length - 1 ? completeLabel : nextLabel}
        </button>
      </div>
    </div>
  );
}
