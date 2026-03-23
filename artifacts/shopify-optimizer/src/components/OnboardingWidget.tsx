import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle, Circle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  { key: "store_connected", label: "Conectar tienda Shopify", icon: "🏪" },
  { key: "audit_run", label: "Ejecutar auditoría IA", icon: "📊" },
  { key: "image_generated", label: "Generar imágenes IA", icon: "🎨" },
  { key: "price_optimized", label: "Optimizar precios", icon: "💰" },
  { key: "ab_test_active", label: "Lanzar A/B Test", icon: "📈" },
  { key: "seo_applied", label: "Aplicar SEO masivo", icon: "🔍" },
  { key: "client_invited", label: "Invitar al cliente", icon: "👥" },
];

const STEP_FIELD_MAP: Record<string, string> = {
  store_connected: "stepStoreConnected",
  audit_run: "stepAuditRun",
  image_generated: "stepImageGenerated",
  price_optimized: "stepPriceOptimized",
  ab_test_active: "stepAbTestActive",
  seo_applied: "stepSeoApplied",
  client_invited: "stepClientInvited",
};

export function OnboardingWidget() {
  const [progress, setProgress] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/onboarding/progress`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setProgress(d.progress);
        if (d.progress?.onboardingCompleted === 1) setDismissed(true);
      })
      .catch(() => {});
  }, []);

  if (!progress || dismissed) return null;

  const completionPct = progress.completionPct ?? 0;
  if (completionPct === 100) return null;

  const completedSteps = STEPS.filter(s => progress[STEP_FIELD_MAP[s.key]] === 1);
  const nextStep = STEPS.find(s => progress[STEP_FIELD_MAP[s.key]] !== 1);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 84, zIndex: 800,
      background: "var(--ink2)", border: "1px solid var(--gold)",
      borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(200,168,75,0.1)",
      width: 280, overflow: "hidden",
    }}>
      <div
        style={{
          padding: "12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", borderBottom: collapsed ? "none" : "1px solid var(--ink3)",
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", marginBottom: 1 }}>Setup: {completionPct}%</p>
            <p style={{ fontSize: 10, color: "var(--t3)" }}>{completedSteps.length}/{STEPS.length} pasos completados</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={e => { e.stopPropagation(); setDismissed(true); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", fontSize: 14, padding: 2 }}
            title="Cerrar"
          >×</button>
          {collapsed ? <ChevronUp size={14} style={{ color: "var(--t3)" }} /> : <ChevronDown size={14} style={{ color: "var(--t3)" }} />}
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "10px 0" }}>
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ height: 4, background: "var(--ink3)", borderRadius: 2 }}>
              <div style={{
                height: "100%", borderRadius: 2, width: `${completionPct}%`,
                background: "linear-gradient(90deg, var(--gold), var(--jade))",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>

          {STEPS.map(step => {
            const done = progress[STEP_FIELD_MAP[step.key]] === 1;
            const isNext = step.key === nextStep?.key;
            return (
              <div key={step.key} style={{
                padding: "8px 16px",
                display: "flex", alignItems: "center", gap: 8,
                background: isNext ? "rgba(200,168,75,0.06)" : "transparent",
              }}>
                {done
                  ? <CheckCircle size={14} style={{ color: "var(--jade)", flexShrink: 0 }} />
                  : <Circle size={14} style={{ color: isNext ? "var(--gold)" : "var(--t4)", flexShrink: 0 }} />
                }
                <span style={{ fontSize: 12, color: done ? "var(--t3)" : isNext ? "var(--t)" : "var(--t3)", textDecoration: done ? "line-through" : "none" }}>
                  {step.icon} {step.label}
                </span>
                {isNext && <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 700, marginLeft: "auto" }}>SIGUIENTE</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
