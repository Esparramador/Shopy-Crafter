import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Filter, TrendingUp, Activity, Award, Clock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ABTest {
  id: string;
  projectId: number;
  projectName: string;
  productId: string;
  productTitle: string;
  imageType: string;
  hypothesis: string;
  variantAVisitors: number;
  variantBVisitors: number;
  variantAConversions: number;
  variantBConversions: number;
  variantARevenue: number;
  variantBRevenue: number;
  confidence: number;
  winner: string | null;
  status: string;
  targetMetric: string;
  startDate: string;
  endDate: string | null;
}

interface ProjectOption {
  id: number;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  running: { label: "EN CURSO", bg: "rgba(45,212,159,0.15)", color: "#2dd49f" },
  completed: { label: "COMPLETADO", bg: "rgba(74,158,221,0.15)", color: "#4a9edd" },
  paused: { label: "PAUSADO", bg: "rgba(200,168,75,0.15)", color: "#c8a84b" },
  cancelled: { label: "CANCELADO", bg: "rgba(232,69,88,0.15)", color: "#e84558" },
};

export default function AdminABTests() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const loadTests = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterProject) params.set("projectId", filterProject);
    if (filterStatus) params.set("status", filterStatus);
    try {
      const res = await fetch(`${API_BASE}/api/admin/all-ab-tests?${params}`, { credentials: "include" });
      const data = await res.json();
      setTests(data.tests);
      setProjects(data.projects);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadTests(); }, [filterProject, filterStatus]);

  const running = tests.filter(t => t.status === "running").length;
  const completed = tests.filter(t => t.status === "completed").length;
  const avgConfidence = tests.length > 0
    ? Math.round(tests.reduce((s, t) => s + t.confidence, 0) / tests.length)
    : 0;
  const winnerTests = tests.filter(t => t.winner);
  const winRate = completed > 0 ? Math.round((winnerTests.length / completed) * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>A/B Tests Globales</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Todos los tests A/B de todos los proyectos</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: <Activity size={18} />, label: "En curso", value: running, color: "#2dd49f" },
          { icon: <Award size={18} />, label: "Completados", value: completed, color: "#4a9edd" },
          { icon: <TrendingUp size={18} />, label: "Win Rate", value: `${winRate}%`, color: "#c8a84b" },
          { icon: <Clock size={18} />, label: "Confianza media", value: `${avgConfidence}%`, color: "#e6c668" },
        ].map(stat => (
          <div key={stat.label} className="glass-card" style={{ padding: "16px 20px" }}>
            <div style={{ color: stat.color, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} style={{ color: "var(--t4)" }} />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            style={{
              padding: "8px 12px", fontSize: 13, background: "var(--ink2)",
              border: "1px solid var(--bdr)", borderRadius: 10, color: "var(--t)", outline: "none",
            }}>
            <option value="">Todos los proyectos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 12px", fontSize: 13, background: "var(--ink2)",
            border: "1px solid var(--bdr)", borderRadius: 10, color: "var(--t)", outline: "none",
          }}>
          <option value="">Todos los estados</option>
          <option value="running">En curso</option>
          <option value="completed">Completado</option>
          <option value="paused">Pausado</option>
        </select>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>Cargando tests...</div>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ink3)" }}>
                {["Producto", "Proyecto", "Hipótesis", "Var. A", "Var. B", "Confianza", "Ganador", "Estado"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tests.map(t => {
                const convA = t.variantAVisitors > 0 ? ((t.variantAConversions / t.variantAVisitors) * 100).toFixed(1) : "0.0";
                const convB = t.variantBVisitors > 0 ? ((t.variantBConversions / t.variantBVisitors) * 100).toFixed(1) : "0.0";
                const statusCfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.running;

                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--ink3)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/projects/${t.projectId}/ab-testing`}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", cursor: "pointer" }}>{t.productTitle}</span>
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>{t.imageType}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/projects/${t.projectId}/ab-testing`}>
                        <span style={{ fontSize: 12, color: "var(--gold)", cursor: "pointer" }}>{t.projectName}</span>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--t2)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.hypothesis || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 12, color: "var(--t)" }}>{convA}%</div>
                      <div style={{ fontSize: 10, color: "var(--t4)" }}>{t.variantAConversions}/{t.variantAVisitors}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 12, color: "var(--t)" }}>{convB}%</div>
                      <div style={{ fontSize: 10, color: "var(--t4)" }}>{t.variantBConversions}/{t.variantBVisitors}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 40, height: 4, borderRadius: 2, background: "var(--ink3)", overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${Math.min(t.confidence, 100)}%`, height: "100%", borderRadius: 2,
                            background: t.confidence >= 95 ? "#2dd49f" : t.confidence >= 80 ? "#c8a84b" : "#e84558",
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.confidence >= 95 ? "#2dd49f" : "var(--t2)" }}>
                          {t.confidence}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {t.winner ? (
                        <span style={{
                          padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: "rgba(45,212,159,0.15)", color: "#2dd49f",
                        }}>Var. {t.winner}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--t4)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: statusCfg.bg, color: statusCfg.color,
                      }}>{statusCfg.label}</span>
                    </td>
                  </tr>
                );
              })}
              {tests.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "var(--t3)" }}>
                    No se encontraron tests A/B
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
