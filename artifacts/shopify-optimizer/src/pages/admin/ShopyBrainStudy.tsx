import { useState, useEffect } from "react";
import { BookOpen, Play, Brain, CheckCircle, Zap, RefreshCw, Link, Star, Activity } from "lucide-react";
import BrainExtractor from "../../components/BrainExtractor";

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

const CYCLE_JOBS = [
  {
    key: "micro-learning",
    icon: "⚡",
    name: "Micro-Learning",
    freq: "Cada 3 horas",
    desc: "2 dominios × 3 insights — Elige los más desactualizados",
    detail: "~16 ciclos/día · ~48 insights/día",
    color: "var(--gold)",
    endpoint: "/api/shopybrain/run/micro-learning",
  },
  {
    key: "consolidation",
    icon: "🧠",
    name: "Memory Consolidation",
    freq: "Cada 6 horas",
    desc: "Promueve insights de alta confianza (≥0.85) a memorias permanentes",
    detail: "~4 ciclos/día",
    color: "#5b4eff",
    endpoint: "/api/shopybrain/run/consolidation",
  },
  {
    key: "cross-synthesis",
    icon: "🔗",
    name: "Cross-Domain Synthesis",
    freq: "Cada 12 horas",
    desc: "Descubre conexiones ocultas entre 3 dominios aleatorios",
    detail: "~2 ciclos/día",
    color: "var(--jade)",
    endpoint: "/api/shopybrain/run/cross-synthesis",
  },
  {
    key: "daily-study",
    icon: "🎓",
    name: "Daily Deep Study",
    freq: "Diario 1am",
    desc: "Estudia los 14 dominios en profundidad — 5 insights premium por dominio",
    detail: "~70 insights/día · máxima profundidad",
    color: "#ff6b35",
    endpoint: "/api/shopybrain/run/daily-study",
  },
  {
    key: "mega-synthesis",
    icon: "🚀",
    name: "Mega-Synthesis",
    freq: "Domingo 00:00",
    desc: "Síntesis estratégica semanal: 8 meta-insights de nivel ejecutivo",
    detail: "1 vez/semana · máxima calidad",
    color: "#e040fb",
    endpoint: "/api/shopybrain/run/mega-synthesis",
  },
  {
    key: "retroanalysis",
    icon: "🔄",
    name: "Retroactive Reanalysis",
    freq: "Domingo 3am",
    desc: "Re-evalúa insights >7 días con conocimiento actual, actualiza confianza",
    detail: "1 vez/semana · re-evaluación",
    color: "#06b6d4",
    endpoint: "/api/shopybrain/run/retroanalysis",
  },
  {
    key: "self-evaluation",
    icon: "📊",
    name: "Auto-Evaluación Mensual",
    freq: "1º de cada mes",
    desc: "Informe de rendimiento: aprendizajes, precisión, gaps identificados",
    detail: "1 vez/mes · análisis completo",
    color: "#f97316",
    endpoint: "/api/shopybrain/run/self-evaluation",
  },
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
  const [running, setRunning] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [extractInput, setExtractInput] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/shopybrain/sessions`, { credentials: "include" })
      .then(r => r.json()).then(d => { setSessions(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const refreshSessions = () => {
    fetch(`${API_BASE}/api/shopybrain/sessions`, { credentials: "include" })
      .then(r => r.json()).then(setSessions).catch(() => {});
  };

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
      refreshSessions();
    } catch {}
    setStudying(false);
  };

  const triggerCycle = async (job: typeof CYCLE_JOBS[0]) => {
    setRunning(job.key);
    setRunMsg(null);
    try {
      const res = await fetch(`${API_BASE}${job.endpoint}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setRunMsg(data.message ?? "✅ Ciclo iniciado en background");
      setTimeout(() => { refreshSessions(); setRunMsg(null); }, 5000);
    } catch {
      setRunMsg("Error iniciando ciclo");
    }
    setRunning(null);
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>🧠 Aprendizaje Continuo 24/7</h1>
        <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 3 }}>
          Shopy Crafter aprende de forma autónoma los 365 días del año — sin interrupciones
        </p>
      </div>

      {/* Status banner */}
      <div style={{
        background: "linear-gradient(135deg, rgba(200,168,75,0.08) 0%, rgba(34,197,94,0.06) 100%)",
        border: "1px solid rgba(200,168,75,0.25)",
        borderRadius: 12, padding: "16px 20px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--jade)", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--jade)" }}>ACTIVO — Aprendiendo 24/7</span>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { label: "Ciclos/día", val: "~16" },
            { label: "Insights/día", val: "~120" },
            { label: "Dominios", val: "14" },
            { label: "Horas activo", val: "24h" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--gold)" }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {runMsg && (
        <div style={{
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          fontSize: 13, color: "var(--jade)",
        }}>
          {runMsg}
        </div>
      )}

      {/* Universal Extractor */}
      <div className="glass-card" style={{ marginBottom: 24, border: "1px solid rgba(212,160,23,0.3)", background: "linear-gradient(135deg, rgba(212,160,23,0.05), rgba(0,0,0,0.4))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Brain size={18} style={{ color: "var(--gold)" }} />
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--gold)" }}>Extractor Universal de Inteligencia</h3>
            <p style={{ fontSize: 11, color: "var(--t3)", margin: 0 }}>
              Pega cualquier URL, dominio, nombre de empresa o texto — Shopy Crafter extraerá todo el conocimiento posible
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            value={extractInput}
            onChange={e => setExtractInput(e.target.value)}
            placeholder="Ej: nike.com · Apple · tienda.myshopify.com · 'moda sostenible para millennials' · https://competidor.com"
          />
        </div>

        {extractInput.trim().length >= 2 && (
          <BrainExtractor
            value={extractInput}
            fieldContext="universal_extractor"
          />
        )}

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["amazon.com", "zara.com", "shein.com", "apple.com", "tesla.com"].map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setExtractInput(example)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 10,
                background: "rgba(255,255,255,0.05)", border: "1px solid var(--bdr)",
                color: "var(--t3)", cursor: "pointer",
              }}
            >
              {example}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "var(--t3)", paddingTop: 3 }}>— ejemplos rápidos</span>
        </div>
      </div>

      {/* Ciclos automáticos */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Ciclos de aprendizaje automático</h3>
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
          Todos los ciclos corren en background. Puedes disparar cualquiera manualmente sin interrumpir los demás.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CYCLE_JOBS.map(job => (
            <div key={job.key} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px", background: "var(--ink3)", borderRadius: 10,
              border: `1px solid var(--bdr)`,
            }}>
              <div style={{ fontSize: 22, width: 36, textAlign: "center", flexShrink: 0 }}>{job.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: job.color }}>{job.name}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 12,
                    background: `${job.color}18`, color: job.color, border: `1px solid ${job.color}35`,
                    fontWeight: 600, flexShrink: 0,
                  }}>{job.freq}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--t2)", margin: 0 }}>{job.desc}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", margin: "2px 0 0" }}>{job.detail}</p>
              </div>
              <button
                onClick={() => triggerCycle(job)}
                disabled={running === job.key}
                style={{
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                  background: running === job.key ? "var(--ink4)" : `${job.color}15`,
                  border: `1px solid ${running === job.key ? "var(--bdr)" : job.color}`,
                  color: running === job.key ? "var(--t3)" : job.color,
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                  flexShrink: 0, transition: "all 0.15s",
                }}
              >
                {running === job.key
                  ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Iniciando...</>
                  : <><Play size={12} /> Ejecutar</>}
              </button>
            </div>
          ))}
        </div>
        {/* Jobs de datos (sin trigger manual) */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
          <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>Jobs de datos (automáticos, sin trigger manual):</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { icon: "📊", label: "Revenue Snapshots", freq: "2am diario" },
              { icon: "📦", label: "Real Data Sync", freq: "3am diario" },
              { icon: "🔍", label: "Competitor Scans", freq: "6am diario" },
              { icon: "📦", label: "Inventory Sync", freq: "7am diario" },
            ].map(j => (
              <div key={j.label} style={{
                padding: "6px 12px", borderRadius: 8, background: "var(--ink4)",
                border: "1px solid var(--bdr)", display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>{j.icon}</span>
                <span style={{ fontSize: 11, color: "var(--t2)" }}>{j.label}</span>
                <span style={{ fontSize: 10, color: "var(--t3)" }}>· {j.freq}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sesión manual */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Sesión manual por dominios</h3>
        <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 16 }}>
          Profundiza en dominios específicos en este momento. Claude generará insights cross-domain en profundidad.
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
          <button onClick={startStudy} disabled={studying || !selectedDomains.length} className="btn-primary" style={{ minWidth: 200 }}>
            {studying
              ? <><Brain size={14} style={{ animation: "spin 1s linear infinite" }} /> Estudiando ({selectedDomains.length} dominios)...</>
              : <><Play size={14} /> Sesión manual ({selectedDomains.length} dominios)</>}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 12, marginBottom: 12 }}>
            {[
              { val: lastResult.insightsCreated, label: "insights nuevos", color: "var(--jade)" },
              { val: selectedDomains.length, label: "dominios estudiados", color: "var(--gold)" },
              { val: lastResult.durationMs ? Math.round(lastResult.durationMs / 1000) + "s" : "—", label: "duración", color: "#5b4eff" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center", padding: 12, background: "var(--ink3)", borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{s.label}</div>
              </div>
            ))}
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

      {/* Historial */}
      <div className="glass-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Historial de sesiones</h3>
          <button onClick={refreshSessions} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--t3)" }}>Cargando...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--t3)" }}>
            <BookOpen size={36} style={{ opacity: 0.3, marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            <p style={{ marginBottom: 4 }}>Sin sesiones registradas aún.</p>
            <p style={{ fontSize: 12 }}>Los ciclos automáticos empezarán en la próxima hora redonda ÷ 3.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map(s => {
              let domains: string[] = [];
              try { domains = JSON.parse(s.domainsStudied ?? "[]"); } catch {}
              let discoveries: string[] = [];
              try { discoveries = JSON.parse(s.keyDiscoveries ?? "[]"); } catch {}
              const typeColor: Record<string, string> = {
                daily_deep_study: "#ff6b35", weekly_mega_synthesis: "#e040fb",
                micro_learning: "var(--gold)", manual_trigger: "var(--jade)",
              };
              const col = typeColor[s.sessionType] ?? "var(--t3)";
              return (
                <div key={s.id} style={{ padding: "14px 16px", background: "var(--ink3)", borderRadius: 10, border: "1px solid var(--bdr)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Activity size={13} color={col} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{s.sessionType.replace(/_/g, " ")}</span>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
                      {domains.slice(0, 3).map(d => (
                        <span key={d} style={{ fontSize: 10, padding: "2px 6px", background: "var(--ink4)", borderRadius: 4, color: "var(--t3)" }}>{d}</span>
                      ))}
                      {domains.length > 3 && <span style={{ fontSize: 10, color: "var(--t3)" }}>+{domains.length - 3} más</span>}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "var(--jade)" }}>+{s.insightsCreated ?? 0} insights</span>
                      {s.durationSeconds && <span style={{ fontSize: 12, color: "var(--t3)" }}>{s.durationSeconds}s</span>}
                    </div>
                  </div>
                  {s.summary && <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: discoveries.length ? 6 : 0 }}>{s.summary}</p>}
                  {discoveries.length > 0 && (
                    <ul style={{ paddingLeft: 14, margin: "0 0 0" }}>
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
