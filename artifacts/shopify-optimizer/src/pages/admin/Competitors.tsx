import { useState, useEffect, useRef } from "react";
import {
  Plus, Scan, Trash2, AlertTriangle, X, Download, BarChart3,
  Loader2, Zap, Target, TrendingUp, Search, ChevronDown, ChevronUp,
  Globe, ShoppingBag, AlertCircle, CheckCircle2, ArrowRight,
} from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import SaveToVaultButton from "@/components/SaveToVaultButton";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEP_LABELS = [
  { key: "context",    icon: "📂", label: "Cargando contexto de tu tienda…" },
  { key: "searching",  icon: "🔍", label: "Buscando competidores en Google (3 ángulos en paralelo)…" },
  { key: "scraping",   icon: "🌐", label: "Escaneando webs de competidores en paralelo…" },
  { key: "analyzing",  icon: "🧠", label: "Analizando con IA: precios, productos, servicios…" },
  { key: "gaps",       icon: "⚡", label: "Detectando brechas y oportunidades…" },
  { key: "done",       icon: "✅", label: "Análisis completado" },
];

const STEP_TIMING = [0, 2000, 8000, 14000, 22000, 0];

const THREAT_COLOR: Record<string, string> = {
  high: "var(--crim)",
  medium: "var(--gold)",
  low: "#34d399",
};

const TYPE_LABEL: Record<string, string> = {
  direct: "Directo",
  indirect: "Indirecto",
  substitute: "Sustituto",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--crim)",
  medium: "var(--gold)",
  low: "var(--t3)",
};

export default function Competitors() {
  const { data: projects } = useListProjects();
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Existing data
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Auto-analyze state
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Manual add
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", url: "", type: "direct" });
  const [addingManual, setAddingManual] = useState(false);

  useEffect(() => {
    if (!selectedProject && projects && projects.length > 0)
      setSelectedProject(String(projects[0].id));
  }, [projects]);

  useEffect(() => {
    if (selectedProject) {
      setAnalysisResult(null);
      loadData();
    }
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, alertRes] = await Promise.all([
        fetch(`${API_BASE}/api/competitors?projectId=${selectedProject}`, { credentials: "include" }),
        fetch(`${API_BASE}/api/competitors/alerts?projectId=${selectedProject}`, { credentials: "include" }),
      ]);
      if (compRes.ok) setCompetitors(await compRes.json());
      if (alertRes.ok) setAlerts(await alertRes.json());
    } catch {}
    setLoading(false);
  };

  // ── Auto-Analyze ────────────────────────────────────────────────────────────
  const runAutoAnalyze = async () => {
    if (!selectedProject || analyzing) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalyzeError(null);
    setStepIndex(0);

    // Animate steps with timers
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
    STEP_TIMING.forEach((ms, i) => {
      if (ms === 0 || i === 0) return;
      const t = setTimeout(() => setStepIndex(i), ms);
      stepTimers.current.push(t);
    });

    try {
      const r = await fetch(`${API_BASE}/api/competitors/auto-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: Number(selectedProject) }),
      });
      stepTimers.current.forEach(clearTimeout);
      setStepIndex(5); // done

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setAnalyzeError(j.error || `Error ${r.status}`);
        return;
      }
      const data = await r.json();
      setAnalysisResult(data);
      await loadData(); // refresh full competitor list
    } catch (err: any) {
      stepTimers.current.forEach(clearTimeout);
      setAnalyzeError(err.message || "Error inesperado");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Manual scan ─────────────────────────────────────────────────────────────
  const scan = async (competitorId: string) => {
    setScanning(competitorId);
    try {
      await fetch(`${API_BASE}/api/competitors/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProject, competitorId }),
      });
      await loadData();
    } catch {}
    setScanning(null);
  };

  // ── Manual add ──────────────────────────────────────────────────────────────
  const addCompetitor = async () => {
    if (!newComp.name || !newComp.url || addingManual) return;
    setAddingManual(true);
    try {
      const r = await fetch(`${API_BASE}/api/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProject, ...newComp }),
      });
      if (r.ok) {
        setNewComp({ name: "", url: "", type: "direct" });
        setShowManualAdd(false);
        await loadData();
      }
    } catch {}
    setAddingManual(false);
  };

  const deleteComp = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/competitors/${id}`, { method: "DELETE", credentials: "include" });
      await loadData();
    } catch {}
  };

  const dismissAlert = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/competitors/alerts/${id}/dismiss`, { method: "POST", credentials: "include" });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const generateComparativeReport = async () => {
    if (!selectedProject || competitors.length === 0) return;
    setGeneratingReport(true);
    try {
      const r = await fetch(`${API_BASE}/api/competitors/comparative-report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(selectedProject) }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`); }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Comparativa_Competidores_${new Date().toISOString().split("T")[0]}.html`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err: any) { alert(`Error: ${err.message}`); }
    setGeneratingReport(false);
  };

  const exportReport = () => {
    const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const competitorRows = competitors.map(c =>
      `<tr style="border-bottom:1px solid #1a1a28;">
        <td style="padding:10px 14px;color:#f0f0f5;font-size:13px;font-weight:600;">${esc(c.name)}</td>
        <td style="padding:10px 14px;"><a href="${esc(c.url)}" style="color:#c8a84b;" target="_blank">${esc(c.url)}</a></td>
        <td style="padding:10px 14px;color:#6b6b80;font-size:12px;">${esc(c.type)}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Competitor Intelligence</title></head>
<body style="margin:0;padding:24px;background:#08080e;font-family:system-ui;color:#f0f0f5;">
<h1 style="color:#c8a84b;">Competitor Intelligence — ${date}</h1>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
<thead><tr style="background:#16161f;"><th style="padding:10px 14px;text-align:left;color:#c8a84b;">Nombre</th><th style="padding:10px 14px;text-align:left;color:#c8a84b;">URL</th><th style="padding:10px 14px;text-align:left;color:#c8a84b;">Tipo</th></tr></thead>
<tbody>${competitorRows}</tbody></table>
<p style="color:#6b6b80;font-size:11px;margin-top:24px;">© ${new Date().getFullYear()} Shopy Crafter</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `Competitors_${new Date().toISOString().split("T")[0]}.html`;
    link.click(); URL.revokeObjectURL(url);
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);
  const currentProject = projects?.find((p: any) => String(p.id) === selectedProject);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Competitor Intelligence</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>
            Análisis automático de competidores con IA y Google Search en tiempo real
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="input-field"
            style={{ width: "min(180px, 100%)" }}
          >
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <SaveToVaultButton
            title={`Competitor Intelligence — ${new Date().toLocaleDateString("es-ES")}`}
            content={`${competitors.length} competidores, ${activeAlerts.length} alertas activas`}
            fileType="competitor"
            projectId={selectedProject || undefined}
            generatedBy="competitor_intel"
            variant="small"
            label="Guardar"
          />
          <button className="btn-secondary" onClick={exportReport} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <Download size={13} /> Exportar
          </button>
          <button
            className="btn-secondary"
            onClick={generateComparativeReport}
            disabled={generatingReport || competitors.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: competitors.length === 0 ? 0.5 : 1 }}
          >
            {generatingReport ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
            {generatingReport ? "Generando…" : "Informe IA"}
          </button>
        </div>
      </div>

      {/* ── Context pill: sector + niche ────────────────────────────────── */}
      {currentProject && (
        <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingBag size={14} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 12, color: "var(--t3)" }}>Tienda:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t)" }}>{currentProject.name}</span>
          </div>
          {(currentProject as any).storeNiche && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Target size={14} style={{ color: "var(--gold)" }} />
              <span style={{ fontSize: 12, color: "var(--t3)" }}>Sector/nicho:</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{(currentProject as any).storeNiche}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <Globe size={13} style={{ color: "var(--t3)" }} />
            <span style={{ fontSize: 11, color: "var(--t3)" }}>{competitors.length} competidores registrados</span>
          </div>
        </div>
      )}

      {/* ── Active alerts ────────────────────────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--crim)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> {activeAlerts.length} alertas activas
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeAlerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="glass-card" style={{
                padding: "12px 16px",
                borderLeft: `3px solid ${THREAT_COLOR[alert.severity] ?? "var(--t3)"}`,
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", marginBottom: 4 }}>{alert.title}</p>
                  <p style={{ fontSize: 12, color: "var(--t3)" }}>{alert.description}</p>
                  {alert.actionSuggestion && (
                    <p style={{ fontSize: 11, color: "var(--gold)", marginTop: 4 }}>→ {alert.actionSuggestion}</p>
                  )}
                </div>
                <button onClick={() => dismissAlert(alert.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BIG AUTO-ANALYZE BUTTON ──────────────────────────────────────── */}
      <div className="glass-card" style={{
        padding: 28, marginBottom: 24, textAlign: "center",
        background: analyzing ? "rgba(200,168,75,0.04)" : "rgba(200,168,75,0.02)",
        border: analyzing ? "1px solid rgba(200,168,75,0.3)" : "1px solid rgba(200,168,75,0.1)",
      }}>
        {!analyzing && !analysisResult && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--t)", marginBottom: 8 }}>
              Análisis automático de competidores
            </h3>
            <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20, maxWidth: 520, margin: "0 auto 20px" }}>
              La IA busca competidores reales en Google usando 3 ángulos distintos, escanea sus webs en paralelo, analiza precios y servicios, y detecta las brechas que puedes aprovechar. Siempre encuentra competidores nuevos.
            </p>
            <button
              className="btn-primary"
              onClick={runAutoAnalyze}
              style={{ padding: "12px 32px", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 10 }}
            >
              <Zap size={18} /> Analizar competidores ahora
            </button>
          </>
        )}

        {analyzing && (
          <div>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--gold)", marginBottom: 16 }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 20 }}>Análisis en curso…</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420, margin: "0 auto" }}>
              {STEP_LABELS.map((step, i) => (
                <div key={step.key} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderRadius: 8,
                  background: i === stepIndex ? "rgba(200,168,75,0.12)" : "transparent",
                  opacity: i <= stepIndex ? 1 : 0.35,
                  transition: "all 0.4s ease",
                }}>
                  <span style={{ fontSize: 18 }}>{step.icon}</span>
                  <span style={{ fontSize: 13, color: i === stepIndex ? "var(--gold)" : "var(--t3)", fontWeight: i === stepIndex ? 600 : 400 }}>
                    {step.label}
                  </span>
                  {i < stepIndex && <CheckCircle2 size={14} style={{ color: "#34d399", marginLeft: "auto", flexShrink: 0 }} />}
                  {i === stepIndex && <Loader2 size={13} className="animate-spin" style={{ color: "var(--gold)", marginLeft: "auto", flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {analysisResult && !analyzing && (
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} style={{ color: "#34d399" }} />
                  Análisis completado — {analysisResult.analyzed?.length ?? 0} competidores nuevos
                </h3>
                <p style={{ fontSize: 12, color: "var(--t3)" }}>
                  Ángulos usados: {(analysisResult.angles ?? []).join(" · ")}
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={runAutoAnalyze}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <Search size={13} /> Buscar más competidores
              </button>
            </div>

            {/* Feature Gaps */}
            {analysisResult.gaps?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={15} style={{ color: "var(--gold)" }} />
                  Brechas detectadas — servicios que tienen ellos y nosotros no
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {analysisResult.gaps.map((gap: any, i: number) => (
                    <div key={i} style={{
                      padding: "6px 14px", borderRadius: 20,
                      background: `${PRIORITY_COLOR[gap.priority] ?? "var(--t3)"}18`,
                      border: `1px solid ${PRIORITY_COLOR[gap.priority] ?? "var(--t3)"}40`,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[gap.priority] ?? "var(--t3)", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--t)", fontWeight: 500 }}>{gap.feature}</span>
                      <span style={{ fontSize: 11, color: "var(--t3)" }}>{gap.competitorsWithIt}/{gap.totalAnalyzed}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>
                  Los puntos en <span style={{ color: "var(--crim)" }}>rojo</span> son los más críticos — la mayoría de competidores ya los tienen.
                </p>
              </div>
            )}

            {/* Newly analyzed competitors */}
            {analysisResult.analyzed?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)", marginBottom: 12 }}>
                  Competidores recién analizados
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px,100%), 1fr))", gap: 12 }}>
                  {analysisResult.analyzed.map((comp: any) => (
                    <div key={comp.id} className="glass-card" style={{ padding: 16, borderLeft: `3px solid ${THREAT_COLOR[comp.threatLevel] ?? "var(--t3)"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <h5 style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 2 }}>{comp.name}</h5>
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--t3)", textDecoration: "none" }}>{comp.url}</a>
                        </div>
                        <span style={{
                          padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                          background: `${THREAT_COLOR[comp.threatLevel] ?? "var(--t3)"}20`,
                          color: THREAT_COLOR[comp.threatLevel] ?? "var(--t3)",
                        }}>
                          {String(comp.threatLevel ?? "?").toUpperCase()}
                        </span>
                      </div>
                      {comp.reason && <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>{comp.reason}</p>}
                      {comp.analysis?.opportunities?.length > 0 && (
                        <div>
                          {comp.analysis.opportunities.slice(0, 2).map((opp: string, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
                              <ArrowRight size={11} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
                              <span style={{ fontSize: 11, color: "var(--t2)" }}>{opp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {analyzeError && (
          <div style={{ padding: 16, background: "rgba(220,53,69,0.08)", border: "1px solid rgba(220,53,69,0.2)", borderRadius: 10, marginTop: 12, textAlign: "left" }}>
            <p style={{ fontSize: 13, color: "var(--crim)", fontWeight: 600, marginBottom: 4 }}>Error en el análisis</p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>{analyzeError}</p>
            <button className="btn-secondary" onClick={runAutoAnalyze} style={{ marginTop: 12, fontSize: 12 }}>
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* ── Manual add form ──────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 24 }}>
        <button
          onClick={() => setShowManualAdd(v => !v)}
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={15} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t)" }}>Añadir competidor específico manualmente</span>
          </div>
          {showManualAdd ? <ChevronUp size={15} style={{ color: "var(--t3)" }} /> : <ChevronDown size={15} style={{ color: "var(--t3)" }} />}
        </button>

        {showManualAdd && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
              ¿Quieres estudiar un competidor concreto? Introduce su URL y la IA lo analizará en profundidad.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <input
                className="input-field"
                placeholder="Nombre del competidor"
                value={newComp.name}
                onChange={e => setNewComp(p => ({ ...p, name: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="URL (https://...)"
                value={newComp.url}
                onChange={e => setNewComp(p => ({ ...p, url: e.target.value }))}
              />
              <select className="input-field" value={newComp.type} onChange={e => setNewComp(p => ({ ...p, type: e.target.value }))}>
                <option value="direct">Directo</option>
                <option value="indirect">Indirecto</option>
                <option value="substitute">Sustituto</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                className="btn-primary"
                onClick={addCompetitor}
                disabled={!newComp.name || !newComp.url || addingManual}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                {addingManual ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {addingManual ? "Añadiendo…" : "Añadir y escanear"}
              </button>
              <button className="btn-secondary" onClick={() => setShowManualAdd(false)} style={{ fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Registered competitors grid ──────────────────────────────────── */}
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)" }}>
          Todos los competidores registrados
          {competitors.length > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--t3)", marginLeft: 8 }}>({competitors.length})</span>}
        </h3>
        {competitors.length > 0 && (
          <button className="btn-secondary" onClick={runAutoAnalyze} disabled={analyzing} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <Search size={12} /> Descubrir más
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      ) : competitors.length === 0 ? (
        <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
          <TrendingUp size={32} style={{ color: "var(--t4)", marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: "var(--t3)", marginBottom: 4 }}>Todavía no hay competidores registrados.</p>
          <p style={{ fontSize: 12, color: "var(--t4)" }}>Pulsa "Analizar competidores ahora" para descubrirlos automáticamente.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
          {competitors.map(comp => (
            <div key={comp.id} className="glass-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comp.name}</h4>
                  <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--t3)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {comp.url}
                  </a>
                </div>
                <span style={{
                  padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, flexShrink: 0,
                  background: comp.type === "direct" ? "rgba(220,53,69,0.12)" : "rgba(200,168,75,0.12)",
                  color: comp.type === "direct" ? "var(--crim)" : "var(--gold)",
                }}>
                  {TYPE_LABEL[comp.type] ?? comp.type?.toUpperCase()}
                </span>
              </div>

              {comp.lastScanned && (
                <p style={{ fontSize: 11, color: "var(--t4)", marginBottom: 10 }}>
                  Escaneado: {new Date(comp.lastScanned).toLocaleDateString("es-ES")}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => scan(comp.id)}
                  disabled={scanning === comp.id}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, padding: "7px 10px" }}
                >
                  {scanning === comp.id ? <Loader2 size={12} className="animate-spin" /> : <Scan size={12} />}
                  {scanning === comp.id ? "Analizando…" : "Re-escanear"}
                </button>
                <button
                  onClick={() => deleteComp(comp.id)}
                  style={{ background: "none", border: "1px solid var(--ink3)", borderRadius: 8, cursor: "pointer", padding: "7px 10px", color: "var(--t3)" }}
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
