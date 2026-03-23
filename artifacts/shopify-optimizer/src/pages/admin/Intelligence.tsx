import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Zap, BarChart3, DollarSign, RefreshCw, Download } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StatCard({ icon, label, value, delta, color = "var(--gold)" }: any) {
  return (
    <div className="glass-card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        {delta !== undefined && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: delta >= 0 ? "var(--jade)" : "var(--crim)",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Intelligence() {
  const { data: projects } = useListProjects();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [summary, setSummary] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!selectedProject && projects?.length > 0) {
      setSelectedProject(String(projects[0].id));
    }
  }, [projects]);

  useEffect(() => {
    if (selectedProject) loadData();
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/intelligence/summary?projectId=${selectedProject}`, { credentials: "include" }),
        fetch(`${API_BASE}/api/intelligence/events?projectId=${selectedProject}&limit=20`, { credentials: "include" }),
      ]);
      setSummary(await summaryRes.json());
      setEvents(await eventsRes.json());
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/intelligence/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProject }),
      });
      const data = await res.json();
      setAnalysis(data.analysis);
    } finally {
      setAnalyzing(false);
    }
  };

  const exportCSV = () => {
    const rows = [["Fecha", "Tipo", "Producto", "Revenue Delta"]];
    events.forEach(e => rows.push([
      new Date(e.createdAt).toLocaleDateString(),
      e.eventType, e.productId || "-",
      e.revenueDelta ? `€${e.revenueDelta}` : "-",
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "intelligence-export.csv";
    a.click();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Revenue Intelligence 360°</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Atribución de revenue por canal y análisis IA</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="input-field"
            style={{ width: 180 }}
          >
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-secondary" onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> CSV
          </button>
          <button className="btn-primary" onClick={runAnalysis} disabled={analyzing || !selectedProject}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={14} />
            {analyzing ? "Analizando..." : "Analizar con IA"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid-4" style={{ gridTemplateColumns: "repeat(4, 1fr)", display: "grid", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard icon="💰" label="Revenue Atribuido (30d)" value={`€${(summary?.totalAttributedRevenue ?? 0).toFixed(0)}`} delta={summary?.trend} />
          <StatCard icon="⚡" label="Eventos Registrados" value={summary?.totalEvents ?? 0} color="var(--jade)" />
          <StatCard icon="📈" label="Tendencia Semanal" value={summary?.trend ? `${summary.trend.toFixed(1)}%` : "—"} delta={summary?.trend} />
          <StatCard icon="🎯" label="Tienda Activa" value={summary?.storeName ?? "—"} color="var(--t)" />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="glass-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink3)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)" }}>
              <BarChart3 size={14} style={{ marginRight: 6, display: "inline" }} />
              Eventos por Canal
            </h3>
          </div>
          <div style={{ padding: 20 }}>
            {Object.entries(summary?.eventBreakdown ?? {}).length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--t3)", padding: 40 }}>
                <p style={{ fontSize: 13 }}>Sin datos aún. Los eventos se registrarán automáticamente al usar la plataforma.</p>
              </div>
            ) : Object.entries(summary?.eventBreakdown ?? {}).map(([type, count]) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--t2)", textTransform: "capitalize" }}>{type.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{count as number}</span>
                </div>
                <div style={{ height: 4, background: "var(--ink3)", borderRadius: 2 }}>
                  <div style={{ height: "100%", background: "var(--gold)", borderRadius: 2, width: `${Math.min(100, (count as number) * 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink3)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--t)" }}>
              <RefreshCw size={14} style={{ marginRight: 6, display: "inline" }} />
              Últimos Eventos
            </h3>
          </div>
          <div style={{ padding: "8px 0", maxHeight: 280, overflowY: "auto" }}>
            {events.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", fontSize: 13, color: "var(--t3)" }}>Sin eventos registrados</p>
            ) : events.map(e => (
              <div key={e.id} style={{
                padding: "10px 20px",
                borderBottom: "1px solid var(--ink3)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ fontSize: 12, color: "var(--t)", textTransform: "capitalize" }}>{e.eventType.replace(/_/g, " ")}</p>
                  <p style={{ fontSize: 11, color: "var(--t3)" }}>{new Date(e.createdAt).toLocaleDateString()}</p>
                </div>
                {e.revenueDelta && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--jade)" }}>+€{e.revenueDelta}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {analysis && (
        <div className="glass-card" style={{ marginTop: 20 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink3)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>⚡ Análisis IA — Revenue Intelligence</h3>
          </div>
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16, lineHeight: 1.6 }}>{analysis.summary}</p>
            {analysis.topInsights?.length > 0 && (
              <>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Top Insights</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {analysis.topInsights.map((insight: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--gold)", fontSize: 16 }}>◆</span>
                      <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>{insight}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            {analysis.recommendations?.length > 0 && (
              <>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Recomendaciones</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {analysis.recommendations.map((rec: any, i: number) => (
                    <div key={i} style={{
                      background: "var(--ink3)", borderRadius: 8, padding: "10px 14px",
                      borderLeft: `3px solid ${rec.priority === "high" ? "var(--crim)" : rec.priority === "medium" ? "var(--gold)" : "var(--jade)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t)" }}>{rec.action}</span>
                        <span style={{
                          fontSize: 10, padding: "2px 6px", borderRadius: 4,
                          background: rec.priority === "high" ? "rgba(220,53,69,0.15)" : "rgba(200,168,75,0.15)",
                          color: rec.priority === "high" ? "var(--crim)" : "var(--gold)",
                          fontWeight: 600,
                        }}>{rec.priority?.toUpperCase()}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{rec.impact}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
