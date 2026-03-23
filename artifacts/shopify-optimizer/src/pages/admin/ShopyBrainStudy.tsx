import { useState, useEffect } from "react";
import { BookOpen, Play, Clock, Zap, Brain, CheckCircle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ALL_DOMAINS = [
  { id: "ecommerce", label: "eCommerce · CRO · UX", icon: "🛒" },
  { id: "shopify_technical", label: "Shopify Técnico", icon: "⚙️" },
  { id: "financial_analysis", label: "Finanzas · P&L", icon: "💰" },
  { id: "trading_markets", label: "Trading · Mercados", icon: "📈" },
  { id: "investment", label: "Inversión", icon: "💎" },
  { id: "marketing", label: "Marketing · Ventas", icon: "📣" },
  { id: "sales", label: "Ventas · Psicología", icon: "🎯" },
  { id: "design_ux", label: "Diseño · UX", icon: "🎨" },
  { id: "merchandising", label: "Merchandising", icon: "🏪" },
  { id: "seo_content", label: "SEO · Contenido", icon: "🔍" },
  { id: "logistics", label: "Logística · Stock", icon: "📦" },
  { id: "paid_media", label: "Paid Media · ROAS", icon: "💸" },
  { id: "consumer_psychology", label: "Psicología Consumidor", icon: "🧠" },
  { id: "pricing_science", label: "Pricing Science", icon: "💱" },
];

interface Session {
  id: string; sessionType: string; domainsStudied?: string;
  insightsCreated: number; insightsUpdated: number; summary?: string;
  keyDiscoveries?: string; tokensUsed?: number;
  durationSeconds?: number; createdAt: string;
}

export default function ShopyBrainStudy() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState<string[]>(["ecommerce", "marketing", "seo_content", "pricing_science"]);
  const [studying, setStudying] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/shopybrain/sessions`, { credentials: "include" })
      .then(r => r.json()).then(d => { setSessions(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleDomain = (id: string) => {
    setSelectedDomains(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const startStudy = async () => {
    if (!selectedDomains.length) return;
    setStudying(true);
    setLastResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/shopybrain/study`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: selectedDomains, sessionType: "manual_trigger", trigger: "admin_study_page" }),
      });
      const data = await res.json();
      setLastResult(data);
      const sessRes = await fetch(`${API_BASE}/api/shopybrain/sessions`, { credentials: "include" });
      setSessions(await sessRes.json());
    } catch {}
    setStudying(false);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>📚 Sesiones de Estudio</h1>
        <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 3 }}>Profundiza el conocimiento de Shopy Brain en dominios específicos</p>
      </div>

      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Nueva sesión de estudio</h3>
        <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 16 }}>
          Selecciona los dominios donde quieres que Shopy Brain profundice su conocimiento.
          Cuantos más dominios, más tiempo tomará (Claude generará insights cross-domain).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 20 }}>
          {ALL_DOMAINS.map(d => (
            <button
              key={d.id}
              onClick={() => toggleDomain(d.id)}
              style={{
                background: selectedDomains.includes(d.id) ? "rgba(200,168,75,0.12)" : "var(--ink3)",
                border: `1px solid ${selectedDomains.includes(d.id) ? "var(--gold)" : "var(--bdr)"}`,
                borderRadius: 8, padding: "10px 12px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16 }}>{d.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: selectedDomains.includes(d.id) ? "var(--gold)" : "var(--t)" }}>{d.label}</span>
              {selectedDomains.includes(d.id) && <CheckCircle size={12} color="var(--gold)" style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={startStudy}
            disabled={studying || !selectedDomains.length}
            className="btn-primary"
            style={{ minWidth: 180 }}
          >
            {studying
              ? <><Brain size={14} style={{ animation: "spin 1s linear infinite" }} /> Estudiando ({selectedDomains.length} dominios)...</>
              : <><Play size={14} /> Iniciar sesión ({selectedDomains.length} dominios)</>}
          </button>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>~{Math.max(30, selectedDomains.length * 15)}s estimado</span>
        </div>
      </div>

      {lastResult && (
        <div className="glass-card" style={{ marginBottom: 20, borderColor: "var(--jade)", borderWidth: 1, borderStyle: "solid" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CheckCircle size={16} color="var(--jade)" />
            <span style={{ fontWeight: 700, color: "var(--jade)" }}>Sesión completada</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--t3)" }}>{lastResult.durationMs ? `${Math.round(lastResult.durationMs / 1000)}s` : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
            <div style={{ textAlign: "center", padding: 12, background: "var(--ink3)", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--jade)" }}>{lastResult.insightsCreated}</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>insights nuevos</div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: "var(--ink3)", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--gold)" }}>{selectedDomains.length}</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>dominios estudiados</div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: "var(--ink3)", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#5b4eff" }}>{lastResult.durationMs ? Math.round(lastResult.durationMs / 1000) : 0}s</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>duración</div>
            </div>
          </div>
          {lastResult.summary && <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 10 }}>{lastResult.summary}</p>}
          {lastResult.keyDiscoveries?.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🔑 Descubrimientos clave:</p>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {lastResult.keyDiscoveries.map((d: string, i: number) => (
                  <li key={i} style={{ fontSize: 12, color: "var(--t)", marginBottom: 4 }}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="glass-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Historial de sesiones</h3>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t3)" }}>Cargando...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3)" }}>
            <BookOpen size={36} style={{ opacity: 0.3, marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            <p>Sin sesiones de estudio aún.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sessions.map(s => {
              let domains: string[] = [];
              try { domains = JSON.parse(s.domainsStudied ?? "[]"); } catch {}
              let discoveries: string[] = [];
              try { discoveries = JSON.parse(s.keyDiscoveries ?? "[]"); } catch {}
              return (
                <div key={s.id} style={{ padding: "14px 16px", background: "var(--ink3)", borderRadius: 10, border: "1px solid var(--bdr)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <BookOpen size={14} color="var(--gold)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{s.sessionType.replace(/_/g, " ")}</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                      {domains.slice(0, 4).map(d => (
                        <span key={d} style={{ fontSize: 10, padding: "2px 6px", background: "var(--ink4)", borderRadius: 4, color: "var(--t3)" }}>{d}</span>
                      ))}
                      {domains.length > 4 && <span style={{ fontSize: 10, color: "var(--t3)" }}>+{domains.length - 4} más</span>}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "var(--jade)" }}>+{s.insightsCreated} insights</span>
                      {s.durationSeconds && <span style={{ fontSize: 12, color: "var(--t3)" }}>{s.durationSeconds}s</span>}
                      {s.tokensUsed && <span style={{ fontSize: 12, color: "var(--t3)" }}>{(s.tokensUsed / 1000).toFixed(1)}k tokens</span>}
                    </div>
                  </div>
                  {s.summary && <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: discoveries.length ? 8 : 0 }}>{s.summary}</p>}
                  {discoveries.length > 0 && (
                    <ul style={{ paddingLeft: 14, margin: 0 }}>
                      {discoveries.slice(0, 2).map((d, i) => <li key={i} style={{ fontSize: 11, color: "var(--t3)" }}>{d}</li>)}
                    </ul>
                  )}
                  <p style={{ fontSize: 10, color: "var(--t3)", marginTop: 8 }}>
                    {new Date(s.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
