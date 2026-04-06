import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, RotateCcw } from "lucide-react";

const COACH_MARKS_KEY = "shopycrafter_coach_dismissed";

interface CoachStep {
  selector: string;
  title: string;
  description: string;
  position: "bottom" | "right" | "left" | "top";
}

const STEPS: CoachStep[] = [
  {
    selector: ".sidebar-clients",
    title: "Tus Tiendas",
    description: "Aquí verás todas las tiendas que gestiones. Cada una tiene su propio panel de optimización.",
    position: "right",
  },
  {
    selector: ".sidebar-nav",
    title: "Navegación principal",
    description: "Accede rápidamente a los motores IA, Shopy Crafter, competidores y más herramientas de optimización.",
    position: "right",
  },
  {
    selector: ".notif-btn",
    title: "Notificaciones",
    description: "Recibe alertas cuando un motor completa una tarea o cuando hay aprobaciones pendientes de tus clientes.",
    position: "bottom",
  },
  {
    selector: ".cmd-trigger",
    title: "Paleta de comandos",
    description: "Presiona Ctrl+K para abrir la paleta de comandos y navegar rápidamente por la plataforma.",
    position: "bottom",
  },
];

function getElementRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

export function CoachMarks() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(COACH_MARKS_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const updateRect = useCallback(() => {
    if (!visible) return;
    const rect = getElementRect(STEPS[step].selector);
    setTargetRect(rect);
  }, [step, visible]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [updateRect]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(COACH_MARKS_KEY, "1");
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const current = STEPS[step];

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10001,
    background: "linear-gradient(135deg, #1a1a1e, #0f0f12)",
    border: "1px solid rgba(200,168,75,0.4)",
    borderRadius: 14,
    padding: "20px 22px",
    width: 320,
    boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(200,168,75,0.1)",
  };

  if (targetRect) {
    const gap = 14;
    switch (current.position) {
      case "right":
        tooltipStyle.left = targetRect.right + gap;
        tooltipStyle.top = targetRect.top + targetRect.height / 2 - 60;
        break;
      case "bottom":
        tooltipStyle.left = targetRect.left + targetRect.width / 2 - 160;
        tooltipStyle.top = targetRect.bottom + gap;
        break;
      case "left":
        tooltipStyle.right = window.innerWidth - targetRect.left + gap;
        tooltipStyle.top = targetRect.top + targetRect.height / 2 - 60;
        break;
      case "top":
        tooltipStyle.left = targetRect.left + targetRect.width / 2 - 160;
        tooltipStyle.bottom = window.innerHeight - targetRect.top + gap;
        break;
    }
  } else {
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.55)",
          transition: "opacity 0.3s",
        }}
      />

      {targetRect && (
        <div
          style={{
            position: "fixed",
            zIndex: 10000,
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 10,
            border: "2px solid rgba(200,168,75,0.6)",
            boxShadow: "0 0 0 4000px rgba(0,0,0,0.55), 0 0 20px rgba(200,168,75,0.3)",
            pointerEvents: "none",
            transition: "all 0.3s ease",
          }}
        />
      )}

      <div style={tooltipStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--gold)", fontWeight: 700 }}>
            Paso {step + 1} de {STEPS.length}
          </span>
          <button
            onClick={dismiss}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t3)", display: "flex", padding: 2,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 6 }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 16 }}>
          {current.description}
        </p>

        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background: i <= step ? "var(--gold)" : "rgba(255,255,255,0.1)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={dismiss}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t3)", fontSize: 12,
            }}
          >
            Saltar tour
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                onClick={prev}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "7px 12px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(255,255,255,0.05)", border: "1px solid var(--bdr)",
                  color: "var(--t2)", fontSize: 12, fontWeight: 600,
                }}
              >
                <ChevronLeft size={13} /> Anterior
              </button>
            )}
            <button
              onClick={next}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "7px 16px", borderRadius: 8, cursor: "pointer",
                background: "linear-gradient(135deg, var(--gold), var(--gold2))",
                border: "none", color: "#060400", fontSize: 12, fontWeight: 700,
              }}
            >
              {step < STEPS.length - 1 ? (
                <>Siguiente <ChevronRight size={13} /></>
              ) : (
                "Finalizar"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ResetCoachMarksButton() {
  const handleReset = () => {
    localStorage.removeItem(COACH_MARKS_KEY);
    window.location.reload();
  };

  return (
    <button
      onClick={handleReset}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 8, cursor: "pointer",
        background: "rgba(255,255,255,0.05)", border: "1px solid var(--bdr)",
        color: "var(--t2)", fontSize: 12, fontWeight: 600,
      }}
    >
      <RotateCcw size={13} /> Reiniciar tour guiado
    </button>
  );
}
