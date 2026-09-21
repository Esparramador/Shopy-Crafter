import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
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

// Overlays that must never be covered by the tour (e.g. the voice-call modal)
// mark their root with this attribute. While any such element is mounted the
// tour stays hidden — paused, not dismissed — and resumes when it goes away.
const TOUR_BLOCKER_SELECTOR = "[data-blocks-tour]";

function getElementRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

function useTourBlocked(): boolean {
  const [blocked, setBlocked] = useState(() =>
    typeof document !== "undefined" && !!document.querySelector(TOUR_BLOCKER_SELECTOR)
  );
  useEffect(() => {
    const check = () => setBlocked(!!document.querySelector(TOUR_BLOCKER_SELECTOR));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-blocks-tour"] });
    return () => observer.disconnect();
  }, []);
  return blocked;
}

export function CoachMarks() {
  const [step, setStep] = useState(0);
  // "active" = the tour wants to be shown (not dismissed, intro delay elapsed).
  const [active, setActive] = useState(false);
  const blocked = useTourBlocked();
  const visible = active && !blocked;
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(COACH_MARKS_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setActive(true), 1500);
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

  // Measure the actual rendered tooltip so positioning/clamping uses real
  // dimensions instead of a fixed estimate (height varies with content/locale).
  useLayoutEffect(() => {
    if (!visible) return;
    const el = tooltipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMeasured(prev =>
      prev && Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
        ? prev
        : { w: r.width, h: r.height }
    );
  }, [visible, step, targetRect]);

  const dismiss = () => {
    setActive(false);
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

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = vw <= 600;
  const TW = Math.min(320, vw - 24);
  // Use measured dimensions once available, falling back to estimates on first paint.
  const TWc = measured?.w ?? TW;
  const THc = measured?.h ?? 220;

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10001,
    background: "linear-gradient(135deg, #1a1a1e, #0f0f12)",
    border: "1px solid rgba(200,168,75,0.4)",
    borderRadius: 14,
    padding: "20px 22px",
    width: TW,
    maxWidth: "calc(100vw - 24px)",
    maxHeight: "calc(100vh - 24px)",
    overflowY: "auto",
    boxSizing: "border-box",
    boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(200,168,75,0.1)",
  };

  // On phones the sidebar targets are re-laid-out (horizontal/hidden), so a
  // positioned tooltip would land off-screen — pin it as a centered bottom sheet.
  if (isMobile || !targetRect) {
    tooltipStyle.left = "50%";
    if (isMobile && targetRect) {
      tooltipStyle.bottom = 16;
      tooltipStyle.transform = "translateX(-50%)";
    } else {
      tooltipStyle.top = "50%";
      tooltipStyle.transform = "translate(-50%, -50%)";
    }
  } else {
    const gap = 14;
    let left: number;
    let top: number;
    switch (current.position) {
      case "right":
        left = targetRect.right + gap;
        top = targetRect.top + targetRect.height / 2 - THc / 2;
        break;
      case "left":
        left = targetRect.left - gap - TWc;
        top = targetRect.top + targetRect.height / 2 - THc / 2;
        break;
      case "top":
        left = targetRect.left + targetRect.width / 2 - TWc / 2;
        top = targetRect.top - gap - THc;
        break;
      case "bottom":
      default:
        left = targetRect.left + targetRect.width / 2 - TWc / 2;
        top = targetRect.bottom + gap;
        break;
    }
    // Clamp into the viewport so the tooltip is never cut off.
    tooltipStyle.left = Math.max(12, Math.min(left, vw - TWc - 12));
    tooltipStyle.top = Math.max(12, Math.min(top, vh - THc - 12));
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

      <div ref={tooltipRef} style={tooltipStyle}>
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
