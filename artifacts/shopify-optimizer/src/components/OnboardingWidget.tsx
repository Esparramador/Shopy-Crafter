import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, CheckCircle, Circle, ExternalLink } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useDraggable } from "@/hooks/use-draggable";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StepDef {
  key: string;
  label: string;
  icon: string;
  field: string;
  route: (pid: number | null) => string;
  hint: (count: number) => string;
}

const STEPS: StepDef[] = [
  {
    key: "store_connected", label: "Conectar tienda", icon: "🏪",
    field: "stepStoreConnected",
    route: () => "/home",
    hint: () => "Conecta tu tienda Shopify para empezar",
  },
  {
    key: "audit_run", label: "Ejecutar auditoría IA", icon: "📊",
    field: "stepAuditRun",
    route: (pid) => pid ? `/projects/${pid}/audit` : "/home",
    hint: (c) => c > 0 ? `${c} auditoría${c > 1 ? "s" : ""} completada${c > 1 ? "s" : ""}` : "Analiza tu tienda con IA",
  },
  {
    key: "image_generated", label: "Generar imágenes IA", icon: "🎨",
    field: "stepImageGenerated",
    route: (pid) => pid ? `/projects/${pid}/images` : "/home",
    hint: (c) => c > 0 ? `${c} imagen${c > 1 ? "es" : ""} generada${c > 1 ? "s" : ""}` : "Crea imágenes profesionales con IA",
  },
  {
    key: "price_optimized", label: "Optimizar precios", icon: "💰",
    field: "stepPriceOptimized",
    route: (pid) => pid ? `/projects/${pid}/pricing` : "/home",
    hint: (c) => c > 0 ? `${c} cambio${c > 1 ? "s" : ""} de precio` : "Optimiza precios con datos reales",
  },
  {
    key: "ab_test_active", label: "Lanzar A/B Test", icon: "📈",
    field: "stepAbTestActive",
    route: (pid) => pid ? `/projects/${pid}/ab-testing` : "/home",
    hint: (c) => c > 0 ? `${c} test${c > 1 ? "s" : ""} activo${c > 1 ? "s" : ""}` : "Compara variantes con datos",
  },
  {
    key: "seo_applied", label: "Aplicar SEO masivo", icon: "🔍",
    field: "stepSeoApplied",
    route: (pid) => pid ? `/projects/${pid}/seo` : "/home",
    hint: (c) => c > 0 ? `${c} producto${c > 1 ? "s" : ""} optimizado${c > 1 ? "s" : ""}` : "Mejora el SEO de todos tus productos",
  },
  {
    key: "client_invited", label: "Invitar al cliente", icon: "👥",
    field: "stepClientInvited",
    route: () => "/clients",
    hint: (c) => c > 0 ? `${c} cliente${c > 1 ? "s" : ""} invitado${c > 1 ? "s" : ""}` : "Da acceso a tu cliente",
  },
];

const DETAIL_COUNTS: Record<string, string> = {
  store_connected: "projectCount",
  audit_run: "auditCount",
  image_generated: "imageCount",
  price_optimized: "priceCount",
  ab_test_active: "abCount",
  seo_applied: "seoCount",
  client_invited: "clientCount",
};

export function OnboardingWidget() {
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  const [details, setDetails] = useState<Record<string, any> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [location, navigate] = useLocation();
  const [routeMatch, routeParams] = useRoute("/projects/:id/*");
  const { position: dragPos, dragHandlers: widgetDragHandlers } = useDraggable({ storageKey: "onboarding", defaultBottom: 16, defaultRight: 16, dragFromAnywhere: false });

  // Auto-collapse and detect mobile (including landscape phones)
  useEffect(() => {
    const check = () => {
      const isLandscapePhone = window.innerHeight < 560 && window.matchMedia("(orientation: landscape)").matches;
      const mobile = window.innerWidth < 640 || isLandscapePhone;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  const urlProjectId = routeMatch ? parseInt(routeParams.id) : null;

  const fetchProgress = useCallback((pid: number | null) => {
    const qs = pid ? `?projectId=${pid}` : "";
    fetch(`${API_BASE}/api/onboarding/progress${qs}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setProgress(d.progress);
        setDetails(d.details ?? null);
        if (d.progress?.onboardingCompleted === 1) setDismissed(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchProgress(urlProjectId);
    const iv = setInterval(() => fetchProgress(urlProjectId), 30_000);
    return () => clearInterval(iv);
  }, [fetchProgress, urlProjectId]);

  if (!progress || dismissed) return null;

  const completionPct = progress.completionPct ?? 0;
  if (completionPct === 100) return null;

  const completedSteps = STEPS.filter(s => progress[s.field] === 1);
  const nextStep = STEPS.find(s => progress[s.field] !== 1);
  const activeProjectId = urlProjectId ?? details?.projectId ?? null;

  const handleStepClick = (step: StepDef) => {
    const route = step.route(activeProjectId);
    navigate(route);
  };

  // Mobile: bottom-center full-width panel; Desktop: draggable corner widget
  const mobileStyle: CSSProperties = {
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
    background: "var(--ink2, #111113)",
    borderTop: "1px solid var(--gold, #c8a84b)",
    borderRadius: "14px 14px 0 0",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.6), 0 0 20px rgba(200,168,75,0.08)",
    width: "100%",
    maxHeight: collapsed ? "56px" : "60vh",
    overflow: "hidden",
    display: "flex", flexDirection: "column",
    transition: "max-height 0.35s cubic-bezier(.22,1,.36,1)",
  };
  const desktopStyle: CSSProperties = {
    position: "fixed", bottom: dragPos.bottom, right: dragPos.right, zIndex: 800,
    background: "var(--ink2, #111113)", border: "1px solid var(--gold, #c8a84b)",
    borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(200,168,75,0.1)",
    width: "min(320px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 32px)",
    overflow: "hidden",
    display: "flex", flexDirection: "column",
  };

  return (
    <div style={isMobile ? mobileStyle : desktopStyle}>
      <div
        {...widgetDragHandlers}
        style={{
          padding: "12px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "grab", borderBottom: collapsed ? "none" : "1px solid var(--ink3, #1e1e22)",
          flexShrink: 0,
          touchAction: "none", userSelect: "none",
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gold, #c8a84b)", margin: 0 }}>
              Setup: {completionPct}%
            </p>
            <p style={{ fontSize: 10, color: "var(--t3, #999)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {completedSteps.length}/{STEPS.length} pasos completados
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setDismissed(true); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4, #666)", fontSize: 16, padding: "2px 4px", lineHeight: 1 }}
            title="Cerrar"
          >×</button>
          {collapsed
            ? <ChevronUp size={14} style={{ color: "var(--t3, #999)" }} />
            : <ChevronDown size={14} style={{ color: "var(--t3, #999)" }} />
          }
        </div>
      </div>

      {!collapsed && (
        <div style={{ overflowY: "auto", flexGrow: 1 }}>
          <div style={{ padding: "8px 14px 10px" }}>
            <div style={{ height: 5, background: "var(--ink3, #1e1e22)", borderRadius: 3 }}>
              <div style={{
                height: "100%", borderRadius: 3, width: `${completionPct}%`,
                background: "linear-gradient(90deg, var(--gold, #c8a84b), var(--jade, #2ecc71))",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>

          {details?.projectName && (
            <div style={{
              padding: "4px 14px 8px",
              fontSize: 10, color: "var(--t3, #999)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: details.projectId ? "var(--jade, #2ecc71)" : "var(--t4, #666)", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {details.projectName}
              </span>
            </div>
          )}

          {STEPS.map(step => {
            const done = progress[step.field] === 1;
            const isNext = step.key === nextStep?.key;
            const countKey = DETAIL_COUNTS[step.key];
            const count = details?.[countKey] ?? 0;

            return (
              <div
                key={step.key}
                onClick={() => handleStepClick(step)}
                style={{
                  padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 8,
                  background: isNext ? "rgba(200,168,75,0.08)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isNext) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isNext ? "rgba(200,168,75,0.08)" : "transparent"; }}
              >
                {done
                  ? <CheckCircle size={15} style={{ color: "var(--jade, #2ecc71)", flexShrink: 0 }} />
                  : <Circle size={15} style={{ color: isNext ? "var(--gold, #c8a84b)" : "var(--t4, #666)", flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: done ? 400 : isNext ? 600 : 400,
                    color: done ? "var(--t3, #999)" : isNext ? "var(--t, #eee)" : "var(--t3, #999)",
                    textDecoration: done ? "line-through" : "none",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>{step.icon}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.label}</span>
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: done ? "var(--jade, #2ecc71)" : "var(--t4, #666)",
                    marginTop: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {step.hint(count)}
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {isNext && (
                    <span style={{
                      fontSize: 9, color: "var(--ink2, #111113)", fontWeight: 700,
                      background: "var(--gold, #c8a84b)", padding: "2px 6px", borderRadius: 4,
                    }}>IR</span>
                  )}
                  <ExternalLink size={10} style={{ color: "var(--t4, #666)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
