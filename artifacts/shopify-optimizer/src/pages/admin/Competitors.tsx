import { useState, useEffect } from "react";
import { Plus, Scan, Trash2, AlertTriangle, X, Download, BarChart3, Loader2 } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import SaveToVaultButton from "@/components/SaveToVaultButton";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Competitors() {
  const { data: projects } = useListProjects();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", url: "", type: "direct" });

  useEffect(() => {
    if (!selectedProject && projects && projects.length > 0) setSelectedProject(String(projects[0].id));
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
      if (compRes.ok) setCompetitors(await compRes.json());
      if (alertRes.ok) setAlerts(await alertRes.json());
    } catch {} finally {
      setLoading(false);
    }
  };

  const addCompetitor = async () => {
    if (!newComp.name || !newComp.url) return;
    try {
      await fetch(`${API_BASE}/api/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProject, ...newComp }),
      });
      setShowAdd(false);
      setNewComp({ name: "", url: "", type: "direct" });
      loadData();
    } catch {}
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
    } catch {} finally {
      setScanning(null);
    }
  };

  const deleteComp = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/competitors/${id}`, { method: "DELETE", credentials: "include" });
      loadData();
    } catch {}
  };

  const dismissAlert = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/competitors/alerts/${id}/dismiss`, { method: "POST", credentials: "include" });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const exportReport = () => {
    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const safeUrl = (u: string) => /^https?:\/\//i.test(u) ? esc(u) : "#";
    const date = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const competitorRows = competitors.map(c =>
      `<tr style="border-bottom:1px solid #1a1a28;">
        <td style="padding:10px 14px;color:#f0f0f5;font-size:13px;font-weight:600;">${esc(c.name || "—")}</td>
        <td style="padding:10px 14px;"><a href="${safeUrl(c.url || "")}" style="color:#c8a84b;text-decoration:underline;font-size:12px;" target="_blank" rel="noopener noreferrer">${esc(c.url || "—")}</a></td>
      </tr>`
    ).join("");
    const alertRows = alerts.map(a => {
      const sevColor = a.severity === "high" ? "#f43f5e" : a.severity === "medium" ? "#f59e0b" : "#34d399";
      return `<tr style="border-bottom:1px solid #1a1a28;">
        <td style="padding:8px 14px;"><span style="display:inline-block;padding:2px 8px;background:${sevColor}15;border:1px solid ${sevColor}40;border-radius:10px;font-size:11px;color:${sevColor};font-weight:600;">${esc((a.severity || "info").toUpperCase())}</span></td>
        <td style="padding:8px 14px;color:#f0f0f5;font-size:13px;font-weight:600;">${esc(a.title || "")}</td>
        <td style="padding:8px 14px;color:#6b6b80;font-size:12px;">${esc(a.description || "")}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Competitor Intelligence — Shopy Crafter</title></head>
<body style="margin:0;padding:0;background:#08080e;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#08080e;padding:24px 0;"><tr><td align="center">
<table width="720" cellpadding="0" cellspacing="0" style="background:#0c0c14;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(160deg,#0e0e18,#12121f);padding:40px 48px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="44" valign="top"><div style="width:36px;height:36px;background:linear-gradient(135deg,#c8a84b,#8b6914);border-radius:9px;text-align:center;line-height:36px;font-size:18px;font-weight:900;color:#0a0a0f;">S</div></td>
    <td style="padding-left:12px;" valign="middle"><span style="font-size:18px;font-weight:800;color:#c8a84b;">Shopy Crafter</span></td>
  </tr></table>
  <h1 style="font-size:22px;font-weight:900;color:#f0f0f5;margin:20px 0 0;">Competitor Intelligence Report</h1>
  <p style="font-size:11px;color:#6b6b80;margin:8px 0 0;">${date} &middot; Shopy Crafter AI</p>
</td></tr>
<tr><td style="padding:28px 48px;">
  <h2 style="font-size:15px;color:#c8a84b;margin:0 0 12px;">Competidores Monitorizados (${competitors.length})</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#101018;border:1px solid #1a1a28;border-radius:10px;overflow:hidden;">
    <tr style="background:#16161f;"><th style="padding:10px 14px;text-align:left;font-size:11px;color:#c8a84b;font-weight:700;">Nombre</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:#c8a84b;font-weight:700;">URL</th></tr>
    ${competitorRows || '<tr><td colspan="2" style="padding:14px;color:#6b6b80;font-size:13px;text-align:center;">Sin competidores registrados</td></tr>'}
  </table>
</td></tr>
${alerts.length > 0 ? `<tr><td style="padding:0 48px 28px;">
  <h2 style="font-size:15px;color:#c8a84b;margin:0 0 12px;">Alertas (${alerts.length})</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#101018;border:1px solid #1a1a28;border-radius:10px;overflow:hidden;">
    <tr style="background:#16161f;"><th style="padding:10px 14px;text-align:left;font-size:11px;color:#c8a84b;font-weight:700;">Severidad</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:#c8a84b;font-weight:700;">Título</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:#c8a84b;font-weight:700;">Descripción</th></tr>
    ${alertRows}
  </table>
</td></tr>` : ""}
<tr><td style="text-align:center;padding:20px 48px;border-top:1px solid #1a1a28;">
  <p style="color:#6b6b80;font-size:11px;margin:0;">Generado por <span style="color:#c8a84b;font-weight:600;">Shopy Crafter</span> AI</p>
  <p style="color:#6b6b80;font-size:11px;margin:4px 0 0;">&copy; ${new Date().getFullYear()} Shopy Crafter. Todos los derechos reservados.</p>
</td></tr>
</table></td></tr></table></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Competitor_Intelligence_${new Date().toISOString().split("T")[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateComparativeReport = async () => {
    if (!selectedProject) return;
    if (competitors.length === 0) {
      alert("Añade al menos un competidor antes de generar el informe.");
      return;
    }
    setGeneratingReport(true);
    try {
      const r = await fetch(`${API_BASE}/api/competitors/comparative-report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(selectedProject) }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Comparativa_Competidores_${new Date().toISOString().split("T")[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`No se pudo generar el informe comparativo: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Competitor Intelligence</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Monitoreo de competidores con análisis IA en tiempo real</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="input-field" style={{ width: "min(180px, 100%)" }}>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <SaveToVaultButton
            title={`Competitor Intelligence — ${new Date().toLocaleDateString("es-ES")}`}
            content={`<h2>Competidores Monitoreados</h2><p>${competitors.length} competidores, ${alerts.filter(a => !a.dismissed).length} alertas activas</p><ul>${competitors.map(c => `<li><strong>${c.name}</strong> — ${c.url} (${c.type})</li>`).join("")}</ul>`}
            fileType="competitor"
            projectId={selectedProject || undefined}
            generatedBy="competitor_intel"
            variant="small"
            label="Guardar"
          />
          <button className="btn-secondary" onClick={exportReport} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> Exportar
          </button>
          <button
            className="btn-secondary"
            onClick={generateComparativeReport}
            disabled={generatingReport || competitors.length === 0}
            title={competitors.length === 0 ? "Añade competidores primero" : "Genera informe IA con Google Search"}
            style={{ display: "flex", alignItems: "center", gap: 6, opacity: competitors.length === 0 ? 0.5 : 1 }}
          >
            {generatingReport ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            {generatingReport ? "Analizando con IA…" : "Informe Comparativo IA"}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 16 }}>
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
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
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
