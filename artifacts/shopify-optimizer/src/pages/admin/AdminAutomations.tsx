import { useState, useEffect } from "react";
import { Play, RefreshCw, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  description: string;
  category: string;
  lastRunTime: string | null;
  lastRunResult: string | null;
  nextRunTime: string | null;
  status: "idle" | "running" | "error";
}

const CATEGORY_COLORS: Record<string, string> = {
  Aprendizaje: "#c8a84b",
  Datos: "#4a9edd",
  Sistema: "#2dd49f",
};

const CATEGORY_ICONS: Record<string, string> = {
  Aprendizaje: "🧠",
  Datos: "📊",
  Sistema: "⚙️",
};

export default function AdminAutomations() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  const loadJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/automations/jobs`, { credentials: "include" });
      const data = await res.json();
      setJobs(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 10000); return () => clearInterval(t); }, []);

  const triggerJob = async (jobId: string) => {
    setRunningJobs(prev => new Set([...prev, jobId]));
    try {
      const res = await fetch(`${API_BASE}/api/automations/jobs/${jobId}/run`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        setRunningJobs(prev => { const n = new Set(prev); n.delete(jobId); return n; });
        alert(data.error ?? `Error ${res.status}`);
        return;
      }
      setTimeout(() => {
        setRunningJobs(prev => { const n = new Set(prev); n.delete(jobId); return n; });
        loadJobs();
      }, 5000);
    } catch {
      setRunningJobs(prev => { const n = new Set(prev); n.delete(jobId); return n; });
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatRelative = (iso: string | null) => {
    if (!iso) return "";
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return "ya pasado";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `en ${hours}h ${mins}m`;
    return `en ${mins}m`;
  };

  const categories = [...new Set(jobs.map(j => j.category))];

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--gold)", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 13, color: "var(--t3)" }}>Cargando automaciones...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Automaciones</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Cron jobs programados del sistema</p>
        </div>
        <button onClick={loadJobs} className="glass-card" style={{
          padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--t2)",
        }}>
          <RefreshCw size={13} /> Refrescar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Jobs", value: jobs.length, icon: "⚡", color: "#c8a84b" },
          { label: "En ejecución", value: jobs.filter(j => j.status === "running" || runningJobs.has(j.id)).length, icon: "🔄", color: "#2dd49f" },
          { label: "Categorías", value: categories.length, icon: "📂", color: "#4a9edd" },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {categories.map(category => (
        <div key={category} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[category] ?? "📋"}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: CATEGORY_COLORS[category] ?? "var(--t)" }}>{category}</span>
            <span style={{ fontSize: 11, color: "var(--t4)" }}>({jobs.filter(j => j.category === category).length} jobs)</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340, 1fr))", gap: 12 }}>
            {jobs.filter(j => j.category === category).map(job => {
              const isRunning = job.status === "running" || runningJobs.has(job.id);
              return (
                <div key={job.id} className="glass-card" style={{
                  padding: 20, position: "relative", overflow: "hidden",
                  borderColor: isRunning ? "#2dd49f" : "transparent",
                  transition: "border-color 0.3s",
                }}>
                  {isRunning && (
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: "linear-gradient(90deg, transparent, #2dd49f, transparent)",
                      animation: "shimmer 1.5s infinite",
                    }} />
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>{job.name}</h3>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{job.description}</p>
                    </div>
                    <button
                      onClick={() => triggerJob(job.id)}
                      disabled={isRunning}
                      style={{
                        padding: "6px 12px", borderRadius: 8, border: "none", cursor: isRunning ? "not-allowed" : "pointer",
                        background: isRunning ? "rgba(45,212,159,0.1)" : "rgba(200,168,75,0.1)",
                        color: isRunning ? "#2dd49f" : "var(--gold)",
                        fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                        opacity: isRunning ? 0.6 : 1, transition: "all 0.2s", flexShrink: 0,
                      }}
                    >
                      {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      {isRunning ? "Running..." : "Run Now"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} style={{ color: "var(--t4)" }} />
                      <span style={{ fontSize: 11, color: "var(--t3)" }}>Cron: </span>
                      <code style={{ fontSize: 11, color: "var(--gold)", fontFamily: "monospace" }}>{job.schedule}</code>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--ink3)" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--t4)", marginBottom: 2 }}>Última ejecución</div>
                      <div style={{ fontSize: 12, color: "var(--t2)", display: "flex", alignItems: "center", gap: 4 }}>
                        {job.lastRunResult === "success" ? <CheckCircle size={11} style={{ color: "#2dd49f" }} /> :
                         job.lastRunResult === "error" ? <AlertCircle size={11} style={{ color: "#e84558" }} /> : null}
                        {formatTime(job.lastRunTime)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--t4)", marginBottom: 2 }}>Próxima ejecución</div>
                      <div style={{ fontSize: 12, color: "var(--t2)" }}>
                        {formatTime(job.nextRunTime)}
                        {job.nextRunTime && <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: 4 }}>({formatRelative(job.nextRunTime)})</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
