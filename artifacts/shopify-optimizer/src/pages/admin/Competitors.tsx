import { useState, useEffect } from "react";
import { Plus, Scan, Trash2, AlertTriangle, X, Download } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Competitors() {
  const { data: projects } = useListProjects();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", url: "", type: "direct" });

  useEffect(() => {
    if (!selectedProject && projects?.length > 0) setSelectedProject(String(projects[0].id));
  }, [projects]);

  useEffect(() => {
    if (selectedProject) loadData();
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, alertRes] = await Promise.all([
        fetch(`${API_BASE}/api/competitors?projectId=${selectedProject}`, { credentials: "include" }),
        fetch(`${API_BASE}/api/competitors/alerts?projectId=${selectedProject}`, { credentials: "include" }),
      ]);
      setCompetitors(await compRes.json());
      setAlerts(await alertRes.json());
    } finally {
      setLoading(false);
    }
  };

  const addCompetitor = async () => {
    if (!newComp.name || !newComp.url) return;
    await fetch(`${API_BASE}/api/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId: selectedProject, ...newComp }),
    });
    setShowAdd(false);
    setNewComp({ name: "", url: "", type: "direct" });
    loadData();
  };

  const scan = async (competitorId: string) => {
    setScanning(competitorId);
    try {
      await fetch(`${API_BASE}/api/competitors/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProject, competitorId }),
      });
      loadData();
    } finally {
      setScanning(null);
    }
  };

  const deleteComp = async (id: string) => {
    await fetch(`${API_BASE}/api/competitors/${id}`, { method: "DELETE", credentials: "include" });
    loadData();
  };

  const dismissAlert = async (id: string) => {
    await fetch(`${API_BASE}/api/competitors/alerts/${id}/dismiss`, { method: "POST", credentials: "include" });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const exportPDF = () => {
    const content = `COMPETITOR INTELLIGENCE REPORT\n\nCompetitors:\n${competitors.map(c => `- ${c.name}: ${c.url}`).join("\n")}\n\nAlerts:\n${alerts.map(a => `- [${a.severity?.toUpperCase()}] ${a.title}: ${a.description}`).join("\n")}`;
    const a = document.createElement("a");
    a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
    a.download = "competitor-report.txt";
    a.click();
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Competitor Intelligence</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Monitoreo de competidores con análisis IA en tiempo real</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="input-field" style={{ width: 180 }}>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-secondary" onClick={exportPDF} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> Exportar
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Añadir Competidor
          </button>
        </div>
      </div>

      {activeAlerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--crim)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> {activeAlerts.length} alertas activas
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeAlerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="glass-card" style={{
                padding: "12px 16px",
                borderLeft: `3px solid ${alert.severity === "high" ? "var(--crim)" : alert.severity === "medium" ? "var(--gold)" : "var(--t3)"}`,
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

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />)}
        </div>
      ) : competitors.length === 0 ? (
        <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
          <span style={{ fontSize: 40 }}>🎯</span>
          <h3 style={{ fontSize: 16, color: "var(--t2)", marginBottom: 8, marginTop: 12 }}>Sin competidores monitoreados</h3>
          <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>Añade competidores para empezar a monitorear precios y estrategias.</p>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} style={{ marginRight: 6 }} /> Añadir primer competidor
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {competitors.map(comp => (
            <div key={comp.id} className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>{comp.name}</h4>
                  <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--t3)", textDecoration: "none" }}>{comp.url}</a>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: comp.type === "direct" ? "rgba(220,53,69,0.15)" : "rgba(200,168,75,0.15)",
                    color: comp.type === "direct" ? "var(--crim)" : "var(--gold)",
                  }}>{comp.type?.toUpperCase()}</span>
                </div>
              </div>
              {comp.lastScanned && (
                <p style={{ fontSize: 11, color: "var(--t4)", marginBottom: 12 }}>
                  Último scan: {new Date(comp.lastScanned).toLocaleDateString()}
                </p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => scan(comp.id)}
                  disabled={scanning === comp.id}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
                >
                  <Scan size={12} />
                  {scanning === comp.id ? "Analizando..." : "Escanear con IA"}
                </button>
                <button
                  onClick={() => deleteComp(comp.id)}
                  style={{ background: "none", border: "1px solid var(--ink3)", borderRadius: 8, cursor: "pointer", padding: "6px 10px", color: "var(--t3)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowAdd(false)}>
          <div style={{ background: "var(--ink2)", borderRadius: 16, padding: 28, width: 480 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t)", marginBottom: 20 }}>Añadir Competidor</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn-primary" onClick={addCompetitor} style={{ flex: 1 }}>Añadir</button>
              <button className="btn-secondary" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
