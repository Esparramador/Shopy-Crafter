import { useState, useEffect } from "react";
import { Brain, Zap, TrendingUp, BookOpen, Clock, Star, Play, Database, Layers, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BrainStatus {
  totalMemories: number;
  totalInsights: number;
  totalNicheProfiles: number;
  brainHealth: number;
  domains: Array<{ domain: string; label: string; knowledgeDepth: number; totalInsights: number; lastStudySession?: string }>;
  recentSessions: Array<{ id: string; sessionType: string; insightsCreated: number; summary?: string; createdAt: string }>;
  topMemories: Array<{ id: string; title: string; memoryType: string; niche?: string; confidence: number }>;
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  niche_keyword: "#c8a84b",
  pricing_pattern: "#2dd49f",
  image_pattern: "#5b4eff",
  prompt_template: "#e84558",
  competitor_intel: "#f97316",
  ab_insight: "#06b6d4",
  seasonal_pattern: "#8b5cf6",
  general: "#6b7280",
  web_research: "#2dd49f",
};

export default function ShopyBrain() {
  const [status, setStatus] = useState<BrainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyResult, setStudyResult] = useState<any>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/api/shopybrain/status`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const triggerStudy = async () => {
    setStudyLoading(true);
    setStudyResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/shopybrain/study`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType: "manual_trigger", trigger: "admin_dashboard" }),
      });
      const data = await res.json();
      setStudyResult(data);
      const statusRes = await fetch(`${API_BASE}/api/shopybrain/status`, { credentials: "include" });
      setStatus(await statusRes.json());
    } catch {}
    setStudyLoading(false);
  };

  const healthColor = (h: number) => h >= 70 ? "var(--jade)" : h >= 40 ? "var(--gold)" : "var(--crim)";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #c8a84b, #5b4eff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 30px rgba(200,168,75,0.4)",
          }}>
            <Brain size={28} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, fontFamily: "var(--fh)" }}>
              Shopy <span style={{ color: "var(--gold)" }}>Brain</span>
            </h1>
            <p style={{ fontSize: 13, color: "var(--t2)" }}>OmniCore Memory Engine — Megacerebro de la plataforma</p>
          </div>
        </div>
        <button
          onClick={triggerStudy}
          disabled={studyLoading}
          className="btn-primary"
          style={{ gap: 8, fontSize: 13 }}
        >
          {studyLoading ? <><Clock size={15} style={{ animation: "spin 1s linear infinite" }} /> Estudiando...</>
            : <><Play size={15} /> Sesión de estudio</>}
        </button>
      </div>

      {studyResult && (
        <div className="glass-card" style={{ marginBottom: 20, borderColor: "var(--jade)", borderWidth: 1, borderStyle: "solid" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Zap size={16} color="var(--jade)" />
            <span style={{ fontWeight: 700, color: "var(--jade)", fontSize: 13 }}>
              Sesión completada — {studyResult.insightsCreated} nuevos insights generados
            </span>
          </div>
          {studyResult.summary && <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 8 }}>{studyResult.summary}</p>}
          {studyResult.keyDiscoveries?.length > 0 && (
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {studyResult.keyDiscoveries.map((d: string, i: number) => (
                <li key={i} style={{ fontSize: 12, color: "var(--t)", marginBottom: 3 }}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--t3)" }}>
          <Brain size={32} style={{ animation: "pulse 2s infinite" }} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Memorias totales", value: status?.totalMemories ?? 0, icon: <Database size={20} />, color: "var(--gold)", sub: "Conocimiento acumulado" },
              { label: "Insights activos", value: status?.totalInsights ?? 0, icon: <Zap size={20} />, color: "var(--jade)", sub: "10 dominios de expertise" },
              { label: "Nichos perfilados", value: status?.totalNicheProfiles ?? 0, icon: <Layers size={20} />, color: "#5b4eff", sub: "Perfiles de mercado" },
              { label: "Salud del cerebro", value: `${status?.brainHealth ?? 0}%`, icon: <Brain size={20} />, color: healthColor(status?.brainHealth ?? 0), sub: "Nivel de expertise" },
            ].map((m, i) => (
              <div key={i} className="glass-card" style={{ textAlign: "center" }}>
                <div style={{ color: m.color, marginBottom: 8, display: "flex", justifyContent: "center" }}>{m.icon}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: m.color, fontFamily: "var(--fh)", letterSpacing: -1 }}>{m.value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="glass-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>🧠 Dominios de conocimiento</h3>
                <button onClick={() => navigate("/admin/shopybrain/insights")} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  Ver todos <ArrowRight size={12} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(status?.domains ?? []).slice(0, 8).map(d => (
                  <div key={d.domain} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{d.label}</span>
                        <span style={{ color: "var(--t3)" }}>{d.knowledgeDepth ?? 0}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--ink4)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          background: `linear-gradient(90deg, var(--gold), var(--jade))`,
                          width: `${d.knowledgeDepth ?? 0}%`,
                          transition: "width 1s ease",
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--t3)", minWidth: 40, textAlign: "right" }}>{d.totalInsights ?? 0} insights</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>⚡ Memorias top (por confianza)</h3>
                <button onClick={() => navigate("/admin/shopybrain/memories")} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  Ver todas <ArrowRight size={12} />
                </button>
              </div>
              {(status?.topMemories ?? []).length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t3)" }}>
                  <Brain size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ fontSize: 13 }}>Shopy Brain aún está aprendiendo.</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Lanza una sesión de estudio para empezar.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(status?.topMemories ?? []).map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--ink3)", borderRadius: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: MEMORY_TYPE_COLORS[m.memoryType] ?? "var(--t3)",
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)" }}>{m.niche ?? "universal"} · {m.memoryType}</p>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--jade)", fontWeight: 700, flexShrink: 0 }}>
                        {Math.round((m.confidence ?? 0.5) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>📚 Últimas sesiones de estudio</h3>
              <button onClick={() => navigate("/admin/shopybrain/study")} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                Historial <ArrowRight size={12} />
              </button>
            </div>
            {(status?.recentSessions ?? []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--t3)", fontSize: 13 }}>
                Sin sesiones aún. Lanza la primera sesión de estudio arriba.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {(status?.recentSessions ?? []).map(s => (
                  <div key={s.id} style={{ padding: "12px 14px", background: "var(--ink3)", borderRadius: 8, border: "1px solid var(--bdr)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <BookOpen size={14} color="var(--gold)" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{s.sessionType.replace(/_/g, " ")}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--t3)" }}>
                        +{s.insightsCreated} insights
                      </span>
                    </div>
                    {s.summary && <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{s.summary.slice(0, 120)}...</p>}
                    <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
                      {new Date(s.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 20 }}>
            {[
              { label: "Explorar Memorias", desc: "Navega y gestiona el conocimiento acumulado", icon: <Database size={20} />, path: "/admin/shopybrain/memories", color: "var(--gold)" },
              { label: "Knowledge Domains", desc: "10 dominios de expertise en profundidad", icon: <Brain size={20} />, path: "/admin/shopybrain/insights", color: "#5b4eff" },
              { label: "Mi Pricing CFO", desc: "OmniCore como tu director financiero", icon: <TrendingUp size={20} />, path: "/admin/my-pricing", color: "var(--jade)" },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => navigate(item.path)}
                style={{ background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 12, padding: "18px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = item.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--bdr)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ color: item.color, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--t3)" }}>{item.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
